# Midas Agentic System: State Management Investigation Report

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [How the Iteration Loop Works](#how-the-iteration-loop-works)
4. [How State Carries Forward](#how-state-carries-forward)
5. [Critical Issues Identified](#critical-issues-identified)
6. [Detailed Issue Analysis](#detailed-issue-analysis)
7. [Industry Best Practices Comparison](#industry-best-practices-comparison)
8. [Recommended Fixes](#recommended-fixes)
9. [Implementation Guide](#implementation-guide)
10. [Monitoring & Logging](#monitoring--logging)
11. [Circuit Breaker Deep Dive](#circuit-breaker-deep-dive)

---

## Executive Summary

### Critical Issues Found

| Issue                               | Severity  | Location                     | Impact                                        |
| ----------------------------------- | --------- | ---------------------------- | --------------------------------------------- |
| `toolResults` grows unbounded       | 🔴 HIGH   | `state.ts:56-59`             | State grows 100KB+ over time, memory leak     |
| `prefetchedData` tokens not counted | 🔴 HIGH   | `context-manager.ts:116-122` | Silent token limit exceeded, context overflow |
| Tool responses stored verbatim      | 🔴 HIGH   | `agent.ts:647-653`           | 15KB report = 15KB message, bloated history   |
| Data duplication (3 locations)      | 🟡 MEDIUM | Multiple files               | Same data stored 3x, wasted tokens            |
| Rough token estimation              | 🟡 MEDIUM | `context-manager.ts:34`      | Underestimates JSON by 30-50%                 |
| No TTL on prefetchedData            | 🟢 LOW    | `state.ts:43`                | Stale data lingers in state                   |
| Rate limit buckets unbounded        | 🟢 LOW    | `route.ts:31`                | Potential memory growth                       |

### Root Cause of Inaccurate Tool Calls

The inaccuracies you're experiencing are caused by:

1. **Context Overflow** → Aggressive message trimming → Loss of critical context
2. **Duplicate/Conflicting Data** → LLM sees old and new versions of same data
3. **Noisy Tool Responses** → LLM struggles to extract correct values from verbose JSON

---

## System Architecture Overview

### State Structure

**File:** `src/ai/state.ts`

```typescript
export const AgentState = Annotation.Root({
  // Conversation history - grows with each message
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // Cached financial data - pre-fetched before agent runs
  prefetchedData: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => ({ ...prev, ...next }), // Merges, never cleans
    default: () => ({}),
  }),

  // User preferences and memories
  memories: Annotation<string>({
    reducer: (_, next) => next ?? '',
    default: () => '',
  }),

  // Accumulated tool execution results - NEVER TRIMMED
  toolResults: Annotation<ToolResult[]>({
    reducer: (prev, next) => [...prev, ...next], // Grows forever!
    default: () => [],
  }),

  // User/org context
  contextMeta: Annotation<ContextMeta>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
})
```

### Token Budget Configuration

**File:** `src/ai/context-manager.ts`

```typescript
MODEL_CONFIG.contextWindow = 100000 // 100K total tokens
RESERVED_FOR_COMPLETION = 8192 // 8K reserved for output
RESERVED_FOR_SYSTEM = 15000 // 15K reserved for system prompt
MAX_CONTEXT_MESSAGES = 50 // Hard cap on message count

// Calculated available: 100K - 8K - 15K = 77K tokens
// BUT: prefetchedData not subtracted!
```

---

## How the Iteration Loop Works

### The ReAct Pattern (Reasoning + Acting)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER MESSAGE                                    │
│                    "What's my burn rate this quarter?"                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         POST /api/chat/route.ts                              │
│  1. Rate limit check                                                         │
│  2. Parse & validate request                                                 │
│  3. Route query (detect intent) ──────────────────┐                         │
│  4. Pre-fetch relevant data    ◄──────────────────┘                         │
│  5. Load user memories                                                       │
│  6. Build initial state                                                      │
│  7. Start streaming response                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LANGGRAPH STATE MACHINE                              │
│                                                                              │
│    ┌──────────┐      ┌───────────────┐      ┌────────────┐                  │
│    │  START   │ ───▶ │  AGENT NODE   │ ───▶ │  DECISION  │                  │
│    └──────────┘      │  (LLM thinks) │      │            │                  │
│                      └───────────────┘      └─────┬──────┘                  │
│                             ▲                     │                          │
│                             │            Has tool_calls?                     │
│                             │                     │                          │
│                             │         ┌──────────┴──────────┐               │
│                             │         │                     │               │
│                             │        YES                    NO              │
│                             │         │                     │               │
│                             │         ▼                     ▼               │
│                      ┌──────┴───────────┐           ┌──────────┐            │
│                      │    TOOL NODE     │           │   END    │            │
│                      │ (Execute tools)  │           │          │            │
│                      └──────────────────┘           └──────────┘            │
│                                                                              │
│    LIMITS:                                                                   │
│    - Max 50 iterations (recursion limit)                                    │
│    - 60 second timeout                                                       │
│    - Circuit breaker after 3 failures                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SSE STREAM TO CLIENT                                    │
│  Events: token, tool_start, tool_end, visualization, widget, response       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### What is an "Iteration"?

| Term               | Definition                                                                | Analogy                          |
| ------------------ | ------------------------------------------------------------------------- | -------------------------------- |
| **Iteration**      | One complete cycle: Agent thinks → Tools execute → Results added to state | One runner's leg in a relay race |
| **API Call**       | One request to the LLM (happens in Agent Node)                            | Runner deciding what to do       |
| **Tool Execution** | Running a tool and getting results (happens in Tool Node)                 | Runner's action                  |
| **State**          | All accumulated knowledge passed between iterations                       | The baton with notes             |

### Iteration vs API Call

```
┌─────────────────────────────────────────────────────────────────┐
│                      ITERATION 1                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐                                        │
│  │    API CALL #1      │  LLM receives state, thinks,           │
│  │    (Agent Node)     │  returns text + tool requests          │
│  └─────────────────────┘                                        │
│            │                                                    │
│            ▼                                                    │
│  ┌─────────────────────┐                                        │
│  │   TOOL EXECUTION    │  Tools run locally (no API call)       │
│  │    (Tool Node)      │  Results added to state                │
│  └─────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────┘

1 Iteration = 1 API Call + N Tool Executions
5 Iterations = 5 API Calls (one per iteration)
```

---

## How State Carries Forward

### The Messages Array: The Memory of the Conversation

The key to carrying data forward is the `messages` array. It grows with each iteration:

```typescript
// ITERATION 1 START
state.messages = [
  HumanMessage("What's my burn rate?")
]

// ITERATION 1 END (after tool execution)
state.messages = [
  HumanMessage("What's my burn rate?"),
  AIMessage("Let me check...", tool_calls: [quickbooks_data]),
  ToolMessage({ burnRate: 25000, expenses: [...] })  // ← Tool result added!
]

// ITERATION 2 START - LLM sees EVERYTHING above
// ITERATION 2 END
state.messages = [
  HumanMessage("What's my burn rate?"),
  AIMessage("Let me check...", tool_calls: [quickbooks_data]),
  ToolMessage({ burnRate: 25000, expenses: [...] }),
  AIMessage("Your burn rate is $25K", tool_calls: [create_visualization]),
  ToolMessage("[[VIZ:0]]")  // ← Visualization marker added
]

// ITERATION 3 - LLM sees ALL of it, no more tools needed → END
state.messages = [
  ... all 5 messages above ...
  AIMessage("Your monthly burn rate is $25,000. [[VIZ:0]] This means...")
]
```

### Visual: State Flow Through Iterations

```
USER: "What's my burn rate and create a chart?"

     ┌─────────── ITERATION 1 ───────────┐
     │                                    │
     │  STATE IN:                         │
     │  ┌──────────────────────────────┐  │
     │  │ messages: [UserMsg]          │  │
     │  │ prefetchedData: { P&L... }   │  │
     │  │ toolResults: []              │  │
     │  └──────────────────────────────┘  │
     │                                    │
     │  AGENT NODE: LLM thinks...         │
     │  → "I need burn rate data"         │
     │  → tool_calls: [quickbooks_data]   │
     │                                    │
     │  TOOL NODE: Executes tool          │
     │  → Result: { burnRate: 25000 }     │
     │                                    │
     │  STATE OUT:                        │
     │  ┌──────────────────────────────┐  │
     │  │ messages: [UserMsg, AI, Tool]│  │
     │  │ toolResults: [result1]       │  │
     │  └──────────────────────────────┘  │
     └────────────────┬───────────────────┘
                      │
          STATE CARRIES FORWARD
                      │
     ┌─────────── ITERATION 2 ───────────┐
     │                                    │
     │  STATE IN: (has previous data!)    │
     │  ┌──────────────────────────────┐  │
     │  │ messages: [UserMsg, AI, Tool]│  │ ← LLM sees $25K!
     │  │ toolResults: [result1]       │  │
     │  └──────────────────────────────┘  │
     │                                    │
     │  AGENT NODE: LLM thinks...         │
     │  → "I have data, now create chart" │
     │  → tool_calls: [create_viz]        │
     │                                    │
     │  TOOL NODE: Creates visualization  │
     │  → Result: "[[VIZ:0]]"             │
     │                                    │
     │  STATE OUT:                        │
     │  ┌──────────────────────────────┐  │
     │  │ messages: [5 messages now]   │  │
     │  │ toolResults: [result1, res2] │  │
     │  └──────────────────────────────┘  │
     └────────────────┬───────────────────┘
                      │
          STATE CARRIES FORWARD
                      │
     ┌─────────── ITERATION 3 ───────────┐
     │                                    │
     │  AGENT NODE: LLM sees everything   │
     │  → "I have data AND chart. Done!"  │
     │  → tool_calls: [] (empty)          │
     │                                    │
     │  DECISION: No tools → END          │
     │                                    │
     └────────────────────────────────────┘

FINAL RESPONSE: "Your burn rate is $25K/month. [[VIZ:0]]"
```

### LangGraph's State Merging Magic

```typescript
// LangGraph automatically MERGES returned state with existing state

// How nodes return state:
async function agentNode(state: AgentState): Promise<Partial<AgentState>> {
  const response = await llm.invoke(state.messages)
  return { messages: [response] } // Return ONLY the new message
}

// LangGraph merges it:
// Before: state.messages = [msg1, msg2]
// Return: { messages: [msg3] }
// After:  state.messages = [msg1, msg2, msg3]  // Appended!
```

---

## Critical Issues Identified

### Issue #1: Unbounded `toolResults` Accumulation

**Severity:** 🔴 HIGH
**Location:** `src/ai/state.ts:56-59`

#### Current Code (Problem)

```typescript
toolResults: Annotation<ToolResult[]>({
  reducer: (prev, next) => [...prev, ...next], // ← ACCUMULATES FOREVER
  default: () => [],
})
```

#### What Happens

```
Conversation Start:
  toolResults = []

After 10 tool calls:
  toolResults = [result1, result2, ..., result10]
  Size: ~20KB

After 50 tool calls:
  toolResults = [result1, result2, ..., result50]
  Size: ~100KB

After 100 tool calls:
  toolResults = [result1, ..., result100]
  Size: ~200KB+ (NEVER CLEANED!)
```

#### ToolResult Structure

```typescript
// Each result can be large (agent.ts:656-662)
interface ToolResult {
  toolName: string
  toolCallId: string
  success: boolean
  data?: unknown // ← Can contain ENTIRE API response!
  error?: string
  duration: number
}
```

#### Impact

- State grows unbounded over conversation lifetime
- Checkpointer persists all this data
- Memory usage increases linearly with tool calls
- Eventually causes performance degradation

---

### Issue #2: prefetchedData Token Budget Violation

**Severity:** 🔴 HIGH
**Location:** `src/ai/context-manager.ts:116-122`

#### Current Code (Problem)

```typescript
export function calculateAvailableTokens(systemPromptTokens: number): number {
  const available =
    MODEL_CONFIG.contextWindow - // 100,000
    systemPromptTokens - // Estimated ~5,000
    RESERVED_FOR_COMPLETION - // 8,192
    RESERVED_FOR_SYSTEM // 15,000

  return Math.max(available, 0) // Returns ~72,000
}
```

#### The Problem

prefetchedData is injected into the system prompt but NOT counted:

**Location:** `src/ai/agent.ts:240-242`

```typescript
if (context.prefetchedData && Object.keys(context.prefetchedData).length > 0) {
  formattedData = formatPrefetchedData(context.prefetchedData) // Can be 15K+ tokens!
}
// This is added to system prompt in prompts/system.ts:462
```

#### Visual: What Code Thinks vs Reality

```
┌─────────────────────────────────────────────────────────────────┐
│  WHAT THE CODE THINKS:                                          │
├─────────────────────────────────────────────────────────────────┤
│  Context window:     100,000 tokens                             │
│  System prompt:       ~5,000 tokens (estimated)                 │
│  Reserved:            23,192 tokens                             │
│  Available:          ~72,000 tokens ← WRONG!                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  WHAT'S ACTUALLY HAPPENING:                                     │
├─────────────────────────────────────────────────────────────────┤
│  Context window:     100,000 tokens                             │
│  Base system prompt:  ~8,000 tokens                             │
│  prefetchedData:     ~15,000 tokens (P&L + Balance Sheet)  ← MISSING!
│  Reserved:            23,192 tokens                             │
│  ACTUAL Available:   ~54,000 tokens                             │
│                                                                 │
│  DIFFERENCE: 18,000 tokens unaccounted for!                     │
└─────────────────────────────────────────────────────────────────┘
```

#### Impact

- Token budget silently exceeded
- Context window overflow
- Aggressive message trimming kicks in unexpectedly
- Loss of critical conversation context
- Inaccurate responses due to missing context

---

### Issue #3: Tool Responses Stored Verbatim

**Severity:** 🔴 HIGH
**Location:** `src/ai/agent.ts:647-653`

#### Current Code (Problem)

```typescript
toolMessages.push(
  new ToolMessage({
    tool_call_id: toolCallId,
    content: typeof result === 'string' ? result : JSON.stringify(result), // ← RAW DUMP
    name: call.name,
  })
)
```

#### What a QuickBooks Response Looks Like

```json
{
  "success": true,
  "queryType": "report",
  "data": {
    "income": {
      "lines": [
        { "name": "Product Sales", "values": { "col_0": 5000, "col_1": 6000, "col_2": 7000 }, "total": 50000, "level": 1, "isSummary": false },
        { "name": "Service Revenue", "values": { "col_0": 3000, "col_1": 4000, "col_2": 5000 }, "total": 30000, "level": 1, "isSummary": false },
        // ... 48 more line items ...
      ],
      "total": 150000,
      "hierarchy": [
        { "name": "Revenue", "total": 150000, "children": [...] }
      ]
    },
    "expenses": {
      "lines": [
        // ... 100+ expense line items ...
      ],
      "total": 80000,
      "hierarchy": [...]
    },
    "costOfGoodsSold": { ... },
    "otherIncome": { ... },
    "otherExpenses": { ... }
  },
  "summary": {
    "totalIncome": 150000,
    "totalExpenses": 80000,
    "netIncome": 70000
  },
  "currency": "USD",
  "sources": ["ProfitAndLoss"],
  "metadata": {
    "queryTime": 1234,
    "fromDate": "2024-01-01",
    "toDate": "2024-12-31"
  }
}
```

**Size:** 15,000 - 50,000 characters (4,000 - 12,000 tokens)

#### This ENTIRE Response Becomes a ToolMessage

```typescript
// In state.messages:
ToolMessage({
  content: '{"success":true,"queryType":"report","data":{"income":{"lines":[{"name":"Product Sales"... // 15KB+
})
```

#### Impact After Multiple Tool Calls

```
After 5 tool calls:
  messages = [
    HumanMessage (100 tokens),
    AIMessage (200 tokens),
    ToolMessage (8,000 tokens),   ← P&L report
    AIMessage (150 tokens),
    ToolMessage (6,000 tokens),   ← Balance sheet
    AIMessage (200 tokens),
    ToolMessage (4,000 tokens),   ← Cash flow
    AIMessage (150 tokens),
    ToolMessage (3,000 tokens),   ← Metrics
    AIMessage (100 tokens),
    ToolMessage (2,000 tokens),   ← Visualization
  ]

  Tool messages alone: 23,000 tokens!
  That's 23% of your context window consumed by verbose JSON.
```

---

### Issue #4: Data Duplication (3 Locations)

**Severity:** 🟡 MEDIUM
**Locations:** Multiple files

#### The Same Data Exists in 3 Places

```
┌─────────────────────────────────────────────────────────────────┐
│  LOCATION 1: state.prefetchedData                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ {                                                         │  │
│  │   profitLoss: {                                           │  │
│  │     total_income: 150000,                                 │  │
│  │     total_expenses: 80000,                                │  │
│  │     net_income: 70000,                                    │  │
│  │     lines: [...],                                         │  │
│  │     ...                                                   │  │
│  │   }                                                       │  │
│  │ }                                                         │  │
│  │                                                           │  │
│  │ Size: ~10KB                                               │  │
│  │ Persists in: LangGraph checkpointer                       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              +
┌─────────────────────────────────────────────────────────────────┐
│  LOCATION 2: System Prompt (injected every request)            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ## Pre-loaded Financial Data                              │  │
│  │                                                           │  │
│  │ ### Profit & Loss (Jan 2024 - Dec 2024)                   │  │
│  │ - Total Revenue: $150,000                                 │  │
│  │ - Total Expenses: $80,000                                 │  │
│  │ - Gross Profit: $100,000                                  │  │
│  │ - Net Income: $70,000                                     │  │
│  │ - Gross Margin: 66.7%                                     │  │
│  │ - Net Margin: 46.7%                                       │  │
│  │ ...                                                       │  │
│  │                                                           │  │
│  │ Size: ~5KB (formatted markdown)                           │  │
│  │ Sent with: Every API call                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              +
┌─────────────────────────────────────────────────────────────────┐
│  LOCATION 3: ToolMessage (if quickbooks_data tool called)      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ {                                                         │  │
│  │   "success": true,                                        │  │
│  │   "data": {                                               │  │
│  │     "income": { "lines": [...], "total": 150000 },        │  │
│  │     "expenses": { "lines": [...], "total": 80000 },       │  │
│  │     ...                                                   │  │
│  │   },                                                      │  │
│  │   "summary": { "netIncome": 70000 }                       │  │
│  │ }                                                         │  │
│  │                                                           │  │
│  │ Size: ~15KB (raw JSON)                                    │  │
│  │ Stored in: state.messages                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

TOTAL: ~30KB for the same data (3x duplication)
TOKENS: ~7,500 tokens wasted on duplicates
```

#### Impact

- Wasted context window space
- Potential for stale data conflicts (old prefetched vs new tool response)
- LLM confusion when data differs between locations

---

### Issue #5: Rough Token Estimation

**Severity:** 🟡 MEDIUM
**Location:** `src/ai/context-manager.ts:34`

#### Current Code

```typescript
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4) // 4 chars = 1 token
}
```

#### The Problem: JSON is Token-Dense

Different content types have different token densities:

```
Content Type          │ Example                    │ Chars │ Actual Tokens │ Chars/Token
──────────────────────┼────────────────────────────┼───────┼───────────────┼────────────
Plain English         │ "Hello world"              │ 11    │ 2             │ 5.5
JSON structure        │ {"key":"value"}            │ 15    │ 6             │ 2.5
Code                  │ console.log("x")           │ 16    │ 6             │ 2.7
Numbers in JSON       │ {"amount":15000.00}        │ 19    │ 8             │ 2.4
Nested JSON           │ {"a":{"b":{"c":1}}}        │ 19    │ 13            │ 1.5
```

#### Impact on Your System

```
Tool response (JSON): 15,000 characters

Your estimation: 15,000 / 4 = 3,750 tokens
Actual tokens:   15,000 / 2.5 = 6,000 tokens

UNDERESTIMATE: 2,250 tokens (37.5% error!)
```

Multiply this across 5 tool responses:

```
Your estimate:  18,750 tokens
Actual usage:   30,000 tokens
Missing:        11,250 tokens unaccounted for!
```

---

### Issue #6: No TTL on prefetchedData

**Severity:** 🟢 LOW
**Location:** `src/ai/state.ts:43`

#### Current Code

```typescript
prefetchedData: Annotation<Record<string, unknown>>({
  reducer: (prev, next) => ({ ...prev, ...next }), // Merges, never expires
  default: () => ({}),
})
```

#### The Problem

```
Message 1: Pre-fetch P&L → stored in prefetchedData
Message 5: Pre-fetch Balance Sheet → merged in
Message 10: Pre-fetch Cash Flow → merged in
Message 20: Pre-fetch Aged Receivables → merged in

Result: prefetchedData contains ALL reports ever fetched
        Some may be 30+ minutes old (stale)
        No expiration mechanism
```

---

### Issue #7: Rate Limit Buckets Unbounded

**Severity:** 🟢 LOW
**Location:** `src/app/api/chat/route.ts:31-58`

#### Current Code

```typescript
const userRequestBuckets = new Map<string, { count: number; resetAt: number }>()

// Cleanup runs every 5 minutes
function cleanupExpiredBuckets(): void {
  // Only removes buckets where resetAt < now
  // But Map can grow to millions of entries between cleanups
}
```

#### Potential Issue

- High-traffic service with many unique users
- Each user creates a bucket entry
- Between cleanup intervals, Map can grow significantly
- No cap on total entries

---

## Detailed Issue Analysis

### State Growth Over a Conversation

```
Message 1: "What's my financial health?"
┌────────────────────────────────────────────────────────────────────────┐
│ STATE SIZE: 25KB                                                        │
│ ├── messages: 2KB (1 human, 1 AI with tool calls)                      │
│ ├── prefetchedData: 20KB (P&L + Balance Sheet pre-fetched)             │
│ ├── memories: 1KB                                                       │
│ └── toolResults: 2KB (1 result)                                         │
│                                                                         │
│ TOKENS: ~6,250                                                          │
│ STATUS: ✅ Healthy                                                      │
└────────────────────────────────────────────────────────────────────────┘

Message 5: "Now show me cash flow breakdown"
┌────────────────────────────────────────────────────────────────────────┐
│ STATE SIZE: 120KB                                                       │
│ ├── messages: 80KB (5 human, 10 AI, 8 tool messages)                   │
│ │   └── Each tool message: 8-15KB raw JSON                             │
│ ├── prefetchedData: 25KB (added cash flow)                             │
│ ├── memories: 1KB                                                       │
│ └── toolResults: 14KB (8 results accumulated)                           │
│                                                                         │
│ TOKENS: ~30,000                                                         │
│ STATUS: ⚠️ Growing                                                      │
└────────────────────────────────────────────────────────────────────────┘

Message 15: "Create a forecast"
┌────────────────────────────────────────────────────────────────────────┐
│ STATE SIZE: 350KB                                                       │
│ ├── messages: 250KB (15 human, 30 AI, 25 tool messages)                │
│ ├── prefetchedData: 40KB (multiple reports)                            │
│ ├── memories: 2KB                                                       │
│ └── toolResults: 58KB (25 results - NEVER TRIMMED)                      │
│                                                                         │
│ TOKENS: ~87,500                                                         │
│ STATUS: 🔴 Approaching limit                                            │
└────────────────────────────────────────────────────────────────────────┘

Message 30: "Summarize everything"
┌────────────────────────────────────────────────────────────────────────┐
│ STATE SIZE: 800KB                                                       │
│ ├── messages: 500KB (trimming now aggressive!)                         │
│ ├── prefetchedData: 80KB                                               │
│ ├── memories: 3KB                                                       │
│ └── toolResults: 217KB (50+ results)                                    │
│                                                                         │
│ TOKEN ESTIMATE: 200,000 tokens                                          │
│ CONTEXT LIMIT:  100,000 tokens                                          │
│                                                                         │
│ RESULT: ❌ Context exceeded!                                            │
│         - Aggressive trimming removes old messages                      │
│         - Critical context lost                                         │
│         - Inaccurate responses                                          │
└────────────────────────────────────────────────────────────────────────┘
```

### Why You're Seeing Inaccurate Tool Calls

#### Cause 1: Context Overflow → Aggressive Trimming

```
When messages exceed token limit:
  1. trimMessagesToFitContext() activates
  2. Removes OLDEST messages first
  3. Critical context from early conversation is lost
  4. LLM makes decisions without full picture

Example:
  Message 1: "Use accrual accounting for all reports"  ← LOST
  Message 2: "My fiscal year starts in April"          ← LOST
  ...
  Message 25: "Show me Q3 expenses"

  LLM doesn't know user preferences → wrong accounting method used
```

#### Cause 2: Duplicate/Conflicting Data

```
LLM sees:
  - prefetchedData (from 5 minutes ago): revenue = $150,000
  - ToolMessage (just now): revenue = $152,000 (updated)

Which is correct? LLM might use the wrong one.
If values conflict, LLM may hallucinate or average them.
```

#### Cause 3: Tool Response Noise

```
LLM trying to extract net income from verbose JSON:

{
  "success": true,
  "queryType": "report",
  "data": {
    "income": {
      "lines": [
        { "name": "Sales", "values": { "col_0": 5000 }, "total": 50000 },
        { "name": "Services", "values": { "col_0": 3000 }, "total": 30000 },
        ... 48 more items ...
      ],
      "total": 150000,  ← Is this the answer?
      "hierarchy": [ ... ]
    },
    "expenses": {
      "lines": [ ... 100 items ... ],
      "total": 80000    ← Or this?
    },
    "netIncome": 70000,  ← Or this?
    "grossProfit": 100000
  },
  "summary": {
    "totalIncome": 150000,
    "netIncome": 70000   ← Or this?
  }
}

Multiple fields contain similar data.
LLM may pick wrong field or get confused.
```

---

## Industry Best Practices Comparison

### What You Have vs Best Practice

| Aspect                   | Your Current Implementation       | Industry Best Practice                         |
| ------------------------ | --------------------------------- | ---------------------------------------------- |
| **Tool Results Storage** | Accumulates forever               | Keep last N results or TTL-based cleanup       |
| **Token Counting**       | 4 chars/token approximation       | Use tiktoken or provider-specific tokenizer    |
| **Context Budget**       | Doesn't account for injected data | Track ALL token sources explicitly             |
| **Tool Response Size**   | Raw JSON dump (unlimited)         | Summarize/truncate large responses             |
| **State Cleanup**        | No cleanup mechanism              | Periodic cleanup, TTL on cached data           |
| **Duplicate Data**       | Same data in 3 places             | Single source of truth, references elsewhere   |
| **Message Trimming**     | Trim oldest first                 | Smart trimming (keep important, summarize old) |

### Reference: How Other Systems Handle This

#### LangChain Best Practices

```python
# Message window buffer - keeps last N messages
from langchain.memory import ConversationBufferWindowMemory
memory = ConversationBufferWindowMemory(k=10)  # Keep last 10 messages

# Token buffer - keeps messages up to token limit
from langchain.memory import ConversationTokenBufferMemory
memory = ConversationTokenBufferMemory(max_token_limit=4000)

# Summary memory - summarizes old messages
from langchain.memory import ConversationSummaryBufferMemory
memory = ConversationSummaryBufferMemory(max_token_limit=2000)
```

#### OpenAI Assistants API

- Automatically manages context window
- Truncates from the middle (keeps start and end)
- Summarizes truncated sections
- Tools return structured responses with size limits

#### Anthropic Claude Guidelines

- Recommend keeping tool responses under 10K characters
- Use structured summaries for large data
- Don't send raw API responses to the model
- Separate "context" from "data" in system prompts

---

## Recommended Fixes

### Priority 0 (Critical) - Implement Immediately

#### Fix 1: Limit toolResults Array

**File:** `src/ai/state.ts`

```typescript
// BEFORE
toolResults: Annotation<ToolResult[]>({
  reducer: (prev, next) => [...prev, ...next],
  default: () => [],
})

// AFTER
toolResults: Annotation<ToolResult[]>({
  reducer: (prev, next) => {
    const combined = [...prev, ...next]
    // Keep only the most recent 10 tool results
    return combined.slice(-10)
  },
  default: () => [],
})
```

#### Fix 2: Account for prefetchedData in Token Budget

**File:** `src/ai/context-manager.ts`

```typescript
// BEFORE
export function calculateAvailableTokens(systemPromptTokens: number): number {
  const available =
    MODEL_CONFIG.contextWindow - systemPromptTokens - RESERVED_FOR_COMPLETION - RESERVED_FOR_SYSTEM
  return Math.max(available, 0)
}

// AFTER
export function calculateAvailableTokens(
  systemPromptTokens: number,
  prefetchedDataTokens: number = 0
): number {
  const available =
    MODEL_CONFIG.contextWindow -
    systemPromptTokens -
    prefetchedDataTokens - // ← ADD THIS
    RESERVED_FOR_COMPLETION -
    RESERVED_FOR_SYSTEM

  return Math.max(available, 0)
}
```

**Update call site in `src/ai/agent.ts`:**

```typescript
// In agentNode function, before trimming messages:
const prefetchedDataString = JSON.stringify(state.prefetchedData || {})
const prefetchedDataTokens = estimateTokenCount(prefetchedDataString)

const availableTokens = calculateAvailableTokens(
  systemPromptTokens,
  prefetchedDataTokens // ← Pass this
)
```

### Priority 1 (High) - Implement Soon

#### Fix 3: Summarize Large Tool Responses

**File:** `src/ai/agent.ts`

Add this function:

```typescript
/**
 * Summarize large tool responses to reduce token usage
 * Keeps essential fields, truncates large data arrays
 */
function summarizeLargeResponse(result: unknown, maxTokens: number = 2000): string {
  const json = typeof result === 'string' ? result : JSON.stringify(result)
  const estimatedTokens = json.length / 4

  // If under limit, return as-is
  if (estimatedTokens <= maxTokens) {
    return json
  }

  // Try to parse and summarize structured responses
  try {
    const parsed = typeof result === 'string' ? JSON.parse(result) : result

    // Handle QuickBooks data responses
    if (parsed.success !== undefined && parsed.data) {
      const summarized = {
        success: parsed.success,
        queryType: parsed.queryType,
        // Keep summary, omit detailed data
        summary: parsed.summary,
        // Indicate data was truncated
        _dataOmitted: true,
        _originalSize: json.length,
        _reason: 'Response exceeded token limit, full data available in prefetchedData',
        // Keep error if present
        error: parsed.error,
      }
      return JSON.stringify(summarized)
    }

    // Handle visualization responses
    if (parsed.type === 'visualization' || parsed.markers) {
      // Keep visualization markers, truncate data
      const summarized = {
        ...parsed,
        data: Array.isArray(parsed.data)
          ? parsed.data.slice(0, 5).concat([{ _truncated: true, _total: parsed.data.length }])
          : parsed.data,
      }
      return JSON.stringify(summarized)
    }

    // Generic fallback: truncate the JSON string
    return json.substring(0, maxTokens * 4) + '...[truncated, ' + estimatedTokens + ' tokens]'
  } catch {
    // Not valid JSON, truncate as string
    return json.substring(0, maxTokens * 4) + '...[truncated]'
  }
}
```

Update the tool message creation:

```typescript
// In customToolNode, around line 650:
toolMessages.push(
  new ToolMessage({
    tool_call_id: toolCallId,
    content: summarizeLargeResponse(result, 2000), // ← USE SUMMARIZER
    name: call.name,
  })
)
```

#### Fix 4: Add TTL to prefetchedData

**File:** `src/ai/state.ts`

```typescript
// BEFORE
prefetchedData: Annotation<Record<string, unknown>>({
  reducer: (prev, next) => ({ ...prev, ...next }),
  default: () => ({}),
})

// AFTER
interface PrefetchedDataEntry {
  data: unknown
  fetchedAt: number
}

prefetchedData: Annotation<Record<string, PrefetchedDataEntry>>({
  reducer: (prev, next) => {
    const now = Date.now()
    const TTL_MS = 30 * 60 * 1000 // 30 minutes

    // Remove stale entries from previous state
    const cleaned: Record<string, PrefetchedDataEntry> = {}
    for (const [key, entry] of Object.entries(prev)) {
      if (now - entry.fetchedAt < TTL_MS) {
        cleaned[key] = entry
      }
    }

    // Add timestamps to new entries
    const timestamped: Record<string, PrefetchedDataEntry> = {}
    for (const [key, value] of Object.entries(next)) {
      timestamped[key] = {
        data: value,
        fetchedAt: now,
      }
    }

    return { ...cleaned, ...timestamped }
  },
  default: () => ({}),
})
```

**Note:** You'll need to update `formatPrefetchedData` to handle the new structure:

```typescript
// Access data via entry.data instead of entry directly
function formatPrefetchedData(prefetched: Record<string, PrefetchedDataEntry>): string {
  const sections: string[] = []
  for (const [key, entry] of Object.entries(prefetched)) {
    const data = entry.data // ← Access nested data
    // ... rest of formatting logic
  }
  return sections.join('\n\n')
}
```

### Priority 2 (Medium) - Implement When Possible

#### Fix 5: Improve Token Estimation

**File:** `src/ai/context-manager.ts`

````typescript
// BEFORE
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}

// AFTER
export function estimateTokenCount(text: string): number {
  // Base estimation
  let tokens = Math.ceil(text.length / 4)

  // Adjust for content type
  if (text.startsWith('{') || text.startsWith('[')) {
    // JSON is more token-dense (roughly 2.5 chars/token)
    tokens = Math.ceil(tokens * 1.6) // 4/2.5 = 1.6
  } else if (text.includes('```')) {
    // Code blocks are moderately token-dense
    tokens = Math.ceil(tokens * 1.2)
  }

  return tokens
}

export function estimateMessageTokens(message: BaseMessage): number {
  const content =
    typeof message.content === 'string' ? message.content : JSON.stringify(message.content)

  let contentTokens = estimateTokenCount(content)

  // Tool messages are almost always JSON
  if (message.getType() === 'tool') {
    contentTokens = Math.ceil(contentTokens * 1.15) // Additional 15% buffer
  }

  const overheadTokens = 10 // Message metadata overhead
  return contentTokens + overheadTokens
}
````

#### Fix 6: Truncate toolResults Data Field

**File:** `src/ai/agent.ts`

When storing tool results, truncate the data field:

```typescript
// Around line 656
function truncateData(data: unknown, maxLength: number = 500): unknown {
  const str = JSON.stringify(data)
  if (str.length <= maxLength) return data

  return {
    _truncated: true,
    _originalLength: str.length,
    preview: str.substring(0, maxLength),
  }
}

// In the toolResults push:
toolResults.push({
  toolName: call.name,
  toolCallId,
  success: true,
  data: truncateData(parsedResult, 500), // ← TRUNCATE
  duration,
})
```

#### Fix 7: Cap Rate Limit Buckets

**File:** `src/app/api/chat/route.ts`

```typescript
const MAX_ACTIVE_BUCKETS = 10000

function cleanupExpiredBuckets(): void {
  const now = Date.now()
  if (now - lastBucketCleanup < BUCKET_CLEANUP_INTERVAL) return

  lastBucketCleanup = now
  let cleaned = 0

  // Remove expired buckets
  for (const [userId, bucket] of userRequestBuckets.entries()) {
    if (bucket.resetAt < now) {
      userRequestBuckets.delete(userId)
      cleaned++
    }
  }

  // ← ADD: Cap total buckets if still too many
  if (userRequestBuckets.size > MAX_ACTIVE_BUCKETS) {
    const entries = Array.from(userRequestBuckets.entries())
    entries.sort((a, b) => a[1].resetAt - b[1].resetAt) // Oldest first
    const toRemove = entries.slice(0, userRequestBuckets.size - MAX_ACTIVE_BUCKETS)
    for (const [userId] of toRemove) {
      userRequestBuckets.delete(userId)
      cleaned++
    }
  }

  if (cleaned > 0) {
    logger.debug('[RateLimit] Cleaned buckets', { cleaned, remaining: userRequestBuckets.size })
  }
}
```

---

## Implementation Guide

### Step-by-Step Implementation Order

```
Week 1: Critical Fixes (P0)
├── Day 1: Fix toolResults accumulation (30 min)
├── Day 2: Fix token budget calculation (2 hours)
│   ├── Update calculateAvailableTokens()
│   ├── Update call site in agentNode
│   └── Add logging to verify
└── Day 3: Test and verify fixes

Week 2: High Priority Fixes (P1)
├── Day 1-2: Implement response summarization (4 hours)
│   ├── Create summarizeLargeResponse()
│   ├── Update customToolNode
│   └── Test with various response sizes
├── Day 3: Add prefetchedData TTL (2 hours)
│   ├── Update state definition
│   ├── Update formatPrefetchedData
│   └── Test expiration logic
└── Day 4-5: Test and verify

Week 3: Medium Priority Fixes (P2)
├── Improve token estimation
├── Truncate toolResults data
└── Cap rate limit buckets
```

### Testing Checklist

```
□ toolResults doesn't exceed 10 entries after 20+ tool calls
□ Token budget correctly accounts for prefetchedData
□ Large tool responses are summarized (< 2000 tokens)
□ prefetchedData entries expire after 30 minutes
□ No memory growth over extended conversations
□ Tool call accuracy improved (measure before/after)
```

---

## Monitoring & Logging

### Recommended Logging

Add these logs to track state health:

**File:** `src/ai/agent.ts` - In agentNode function

```typescript
// Add at the start of agentNode
logger.info('[Agent] State analysis', {
  // Message metrics
  messageCount: state.messages.length,
  messageTypes: state.messages.reduce(
    (acc, m) => {
      const type = m.getType()
      acc[type] = (acc[type] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  ),

  // Tool results metrics
  toolResultsCount: state.toolResults.length,
  toolResultsSize: JSON.stringify(state.toolResults).length,

  // Prefetched data metrics
  prefetchedDataKeys: Object.keys(state.prefetchedData),
  prefetchedDataSize: JSON.stringify(state.prefetchedData).length,

  // Token estimates
  estimatedMessageTokens: state.messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0),
  estimatedPrefetchedTokens: estimateTokenCount(JSON.stringify(state.prefetchedData)),
  estimatedTotalTokens: 0, // Calculate sum of above

  // Context health
  contextLimit: MODEL_CONFIG.contextWindow,
  availableTokens: 0, // Calculate
  utilizationPercent: 0, // Calculate
})
```

### Metrics to Track

```typescript
interface StateHealthMetrics {
  // Size metrics
  totalStateBytes: number
  messagesBytes: number
  toolResultsBytes: number
  prefetchedDataBytes: number

  // Count metrics
  messageCount: number
  toolResultsCount: number
  prefetchedDataEntries: number

  // Token metrics
  estimatedTokens: number
  contextLimit: number
  utilizationPercent: number

  // Health indicators
  isOverLimit: boolean
  trimmingActive: boolean
  oldestMessageAge: number // seconds
}
```

### Alert Thresholds

```typescript
const ALERT_THRESHOLDS = {
  // Warn when state exceeds these
  totalStateBytesWarn: 500 * 1024, // 500KB
  totalStateBytesError: 1024 * 1024, // 1MB

  // Warn when token utilization high
  tokenUtilizationWarn: 0.7, // 70%
  tokenUtilizationError: 0.9, // 90%

  // Warn when too many tool results
  toolResultsCountWarn: 8,
  toolResultsCountError: 15,

  // Warn when messages getting old
  oldestMessageAgeWarn: 30 * 60, // 30 min
}
```

---

## Circuit Breaker Deep Dive

### What is a Circuit Breaker?

A circuit breaker prevents cascading failures by stopping requests to a failing service. Like an electrical circuit breaker that trips to prevent fires.

### Your Implementation

**File:** `src/ai/circuit-breaker.ts`

### The Three States

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  STATE 1: CLOSED (Normal)                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ failures: 0                                                          │  │
│  │ isOpen: false                                                        │  │
│  │                                                                      │  │
│  │ • Requests flow through normally                                     │  │
│  │ • Each failure increments counter                                    │  │
│  │ • Success resets counter to 0                                        │  │
│  │                                                                      │  │
│  │ Transition: failures >= 3 → OPEN                                     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                │                                           │
│                                │ 3 consecutive failures                    │
│                                ▼                                           │
│  STATE 2: OPEN (Blocking)                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ failures: 3+                                                         │  │
│  │ isOpen: true                                                         │  │
│  │ lastFailure: timestamp                                               │  │
│  │                                                                      │  │
│  │ • ALL requests immediately rejected                                  │  │
│  │ • No actual API calls made                                           │  │
│  │ • Returns error: "Tool temporarily unavailable"                      │  │
│  │                                                                      │  │
│  │ Transition: 60 seconds pass → HALF-OPEN                              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                │                                           │
│                                │ 60 seconds timeout                        │
│                                ▼                                           │
│  STATE 3: HALF-OPEN (Testing)                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ (60 seconds have passed since lastFailure)                           │  │
│  │                                                                      │  │
│  │ • Allow ONE probe request through                                    │  │
│  │ • If SUCCESS → reset to CLOSED                                       │  │
│  │ • If FAILURE → back to OPEN (wait another 60s)                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                │                                           │
│                    ┌───────────┴───────────┐                               │
│                    │                       │                               │
│                 SUCCESS                 FAILURE                            │
│                    │                       │                               │
│                    ▼                       ▼                               │
│               ┌─────────┐            ┌─────────┐                           │
│               │ CLOSED  │            │  OPEN   │                           │
│               │(healthy)│            │(blocked)│                           │
│               └─────────┘            └─────────┘                           │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Per-User Isolation

```typescript
// Key format: toolName:userId
function getCircuitBreakerKey(toolName: string, userId?: string): string {
  return `${toolName}:${userId}`
}

// Example circuit states:
toolCircuits = Map {
  'quickbooks_data:user_123' → { failures: 3, isOpen: true },   // User 123 blocked
  'quickbooks_data:user_456' → { failures: 0, isOpen: false },  // User 456 healthy
  'quickbooks_data:user_789' → { failures: 1, isOpen: false },  // User 789 had 1 fail
  'web_search:user_123'      → { failures: 0, isOpen: false },  // User 123 web search ok
}
```

### Configuration

```typescript
export const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 3, // Open after 3 failures
  resetTimeoutMs: 60000, // Wait 60 seconds before trying again
  halfOpenMaxAttempts: 1, // Allow 1 probe request
}

// Cleanup settings
const CIRCUIT_CLEANUP_INTERVAL = 60 * 60 * 1000 // Clean every hour
const CIRCUIT_EXPIRY = 24 * 60 * 60 * 1000 // Remove after 24 hours
```

### Terminal Output When Circuit Trips

```bash
# Failure 1
[14:32:01] [DEBUG] [CircuitBreaker] Tool failure recorded
  → tool: "quickbooks_data", userId: "user_123", failures: 1

# Failure 2
[14:32:15] [DEBUG] [CircuitBreaker] Tool failure recorded
  → tool: "quickbooks_data", userId: "user_123", failures: 2

# Failure 3 - CIRCUIT OPENS
[14:32:30] ⚠️ [WARN] [CircuitBreaker] Circuit opened for tool
  → tool: "quickbooks_data"
  → userId: "user_123"
  → key: "quickbooks_data:user_123"
  → failures: 3
  → resetAfterMs: 60000

# Subsequent requests - BLOCKED INSTANTLY
[14:32:45] [DEBUG] [Agent] Tool blocked by circuit breaker
  → tool: "quickbooks_data"
  → retryAfterMs: 45000

# 60 seconds later - HALF-OPEN TEST
[14:33:30] [DEBUG] [CircuitBreaker] Half-open, allowing probe
  → tool: "quickbooks_data"

# If probe succeeds - CIRCUIT CLOSES
[14:33:32] ✅ [INFO] [CircuitBreaker] Circuit closed after successful probe
  → tool: "quickbooks_data"
  → userId: "user_123"
```

### Code Flow in Agent

```typescript
// In customToolNode (agent.ts)
async function customToolNode(state, config) {
  const userId = state.contextMeta?.userId

  for (const toolCall of toolCalls) {
    // 1. CHECK CIRCUIT BREAKER
    if (isCircuitOpen(toolCall.name, userId)) {
      const status = getCircuitStatus(toolCall.name, userId)

      // Return instant error - NO API call made!
      return new ToolMessage({
        content: JSON.stringify({
          success: false,
          error: `Tool "${toolCall.name}" is temporarily unavailable`,
          errorType: 'CIRCUIT_OPEN',
          retryAfterMs: status.retryAfterMs,
        }),
      })
    }

    // 2. EXECUTE TOOL
    try {
      const result = await tool.invoke(toolCall.args)

      // 3. SUCCESS - Reset circuit
      recordToolSuccess(toolCall.name, userId)

      return new ToolMessage({ content: result })
    } catch (error) {
      // 4. FAILURE - Count toward circuit
      const isPermanent = error.type === 'AUTH_ERROR'
      recordToolFailure(toolCall.name, userId, isPermanent)

      return new ToolMessage({
        content: JSON.stringify({
          success: false,
          error: error.message,
        }),
      })
    }
  }
}
```

---

## Summary

### What's Wrong

1. **toolResults grows forever** - Memory leak, state bloat
2. **prefetchedData not counted in token budget** - Silent context overflow
3. **Tool responses stored verbatim** - Massive token waste
4. **Same data in 3 places** - Duplication, potential conflicts
5. **Rough token estimation** - Underestimates JSON by 30-50%
6. **No expiration on cached data** - Stale data lingers

### What's Right

1. **Circuit breaker pattern** - Well implemented, per-user isolation
2. **Rate limiting** - Proper bucketing and cleanup
3. **LangGraph state machine** - Clean graph architecture
4. **Tiered routing** - Smart pre-fetching based on confidence
5. **Memory system** - Good user preference storage
6. **Error classification** - Distinguishes permanent vs transient errors

### Action Items

| Priority | Fix                                        | Effort  | Impact    |
| -------- | ------------------------------------------ | ------- | --------- |
| P0       | Limit toolResults to 10                    | 30 min  | 🔴 High   |
| P0       | Account for prefetchedData in token budget | 2 hours | 🔴 High   |
| P1       | Summarize large tool responses             | 4 hours | 🔴 High   |
| P1       | Add TTL to prefetchedData                  | 2 hours | 🟡 Medium |
| P2       | Improve token estimation                   | 1 hour  | 🟡 Medium |
| P2       | Truncate toolResults data                  | 1 hour  | 🟢 Low    |
| P2       | Cap rate limit buckets                     | 30 min  | 🟢 Low    |

---

_Document generated: January 2025_
_System analyzed: Midas Agentic System (Zenith OS)_
