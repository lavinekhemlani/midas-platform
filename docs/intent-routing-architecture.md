# Intent Routing Architecture

> How user messages are routed, processed, and handled by the AI agent in Zenith OS.

## Table of Contents

1. [High-Level Overview](#high-level-overview)
2. [Entry Point](#1-entry-point)
3. [Intent Routing (3-Tier System)](#2-intent-routing-3-tier-system)
4. [Context Preparation](#3-context-preparation)
5. [Agent Architecture](#4-agent-architecture)
6. [Tool Definitions & Selection](#5-tool-definitions--selection)
7. [How Everything Links Together](#6-how-everything-links-together)
8. [Complete Flow Example](#7-complete-flow-example)
9. [Key Files Reference](#8-key-files-reference)

---

## High-Level Overview

Zenith OS uses a **hybrid approach**: Pattern matching for speed + LLM for flexibility.

```
User Message → 3-Tier Router → Context Preparation → LangGraph Agent → Tool Execution → Response
```

**Key Principle:** The router provides **hints and optimization**, but the LLM has **final autonomy** on tool calls.

---

## 1. Entry Point

**File:** `src/app/api/chat/route.ts`

User messages arrive via `POST /api/chat`:

```typescript
// Request validation with Zod schema
const { input, messageId } = parseChatRequest(body)

// Rate limiting: 15 requests/60 seconds per user
await checkRateLimit(userId)

// Get company context
const { currency, companyName } = await getCompanyMetadata(organizationId)
```

---

## 2. Intent Routing (3-Tier System)

**File:** `src/ai/router/matcher.ts`

### Tier 1: Exact Pattern Matching (HIGH confidence)

- **41 hardcoded regex patterns**
- **Speed:** < 1ms
- **When matched:** Pre-fetches data, high confidence

```typescript
// Example patterns from src/ai/router/patterns.ts
{
  pattern: /^(what('s| is)|how much is)( my| our| the)? (cash )?runway/i,
  intent: 'forecast',
  reports: ['cash_flow', 'balance_sheet'],
}

{
  pattern: /compare (this|current) (month|quarter|year) (to|vs|with|against) (last|previous)/i,
  intent: 'comparison',
  reports: ['profit_loss', 'pnl_comparison'],
}
```

### Tier 2: Keyword Matching (MEDIUM confidence)

- Matches keywords from `REPORT_KEYWORDS` dictionary
- Detects intent from `INTENT_PATTERNS`
- Extracts time periods from `PERIOD_PATTERNS`

```typescript
// Keyword → Report mapping
REPORT_KEYWORDS = {
  profit_loss: ['revenue', 'income', 'sales', 'expenses', 'profit', 'margin', 'p&l'],
  balance_sheet: ['assets', 'liabilities', 'equity', 'debt', 'net worth'],
  cash_flow: ['cash flow', 'burn rate', 'liquidity', 'cash position'],
  aged_receivables: ['receivable', 'ar aging', 'owed to us', 'outstanding invoices'],
  // ...
}

// Intent detection patterns
INTENT_PATTERNS = {
  forecast: /(runway|forecast|predict|burn rate|cash last)/i,
  comparison: /(compare|vs|versus|difference|against)/i,
  trend: /(trend|over time|monthly|growth|trajectory)/i,
  anomaly: /(unusual|spike|drop|why did|what happened)/i,
  health_check: /(overview|summary|status|health|how.*doing)/i,
  // ...
}
```

### Tier 3: Fallback (LOW confidence)

- Returns generic intent
- No pre-fetching
- Delegates fully to LLM

```typescript
function createFallbackResult(): RouteResult {
  return {
    intent: 'general',
    reports: [],
    periods: ['last_year'],
    memoryTypes: [],
    confidence: 'low',
    matchedTier: 'fallback',
  }
}
```

### Route Result Structure

```typescript
interface RouteResult {
  intent: QueryIntent // 8 types: point_query, trend, comparison, forecast, anomaly, health_check, drill_down, general
  reports: ReportType[] // Reports to pre-fetch
  periods: RoutePeriod[] // Time periods detected
  memoryTypes: MemoryType[] // Aligned memory types
  confidence: 'high' | 'medium' | 'low'
  matchedTier: 'exact' | 'keyword' | 'fallback'
  matchedPattern?: string // For debugging
}
```

---

## 3. Context Preparation

**File:** `src/ai/router/contextPreparer.ts`

Based on routing decision:

```typescript
export async function prepareContext(options: PrepareContextOptions): Promise<PreparedContext> {
  const [prefetchedData, memories] = await Promise.all([
    // Only pre-fetch for HIGH confidence routes
    shouldPrefetch(route)
      ? prefetchReports(route, organizationId, provider, apiClient, currency)
      : Promise.resolve({}),

    // Always fetch query-aligned memories
    fetchAlignedMemories(userId, organizationId, route.memoryTypes),
  ])

  return { route, prefetchedData, memories, fetchDuration }
}
```

### Memory Alignment

Maps intents to relevant memory types:

```typescript
INTENT_MEMORY_ALIGNMENT = {
  forecast: ['expense', 'income', 'goal'], // Runway needs expense/income history
  comparison: ['goal', 'decision'], // Comparison needs goals as reference
  trend: ['decision', 'context'], // Trends explained by past decisions
  anomaly: ['decision', 'context', 'expense'], // Anomalies explained by context
  health_check: ['goal', 'deadline', 'expense', 'income'], // Holistic view
  drill_down: ['context'],
  point_query: [], // Usually doesn't need memory
  general: [], // Let agent decide
}
```

---

## 4. Agent Architecture

**File:** `src/ai/agent.ts`

### LangGraph State Machine

```
START → agent (LLM invocation) → shouldContinue (conditional)
                                    │
                            ┌───────┴───────┐
                            │               │
                    No tool calls      Has tool calls
                            │               │
                            ▼               ▼
                           END         tools (execute)
                                            │
                                            └──→ Loop back to agent
```

### Tool Binding

```typescript
// All tools are bound to the LLM
const modelWithTools = model.bindTools(allTools)

// LLM decides autonomously which tools to call
const response = await modelWithTools.invoke(messages)
```

### System Prompt Building

```typescript
function buildSystemPrompt(context: ExtendedAgentContext): string {
  // Includes:
  // - Company name, currency, date/time
  // - Pre-fetched financial data (formatted)
  // - User memories (sanitized)
  // - Tool documentation
  // - Proactive alert guidelines
}
```

---

## 5. Tool Definitions & Selection

**File:** `src/ai/tools/index.ts`

### Available Tools

```typescript
export const allTools = [
  quickbooksData, // Main financial data tool
  financialCalculator, // burn_rate, runway, break_even, what_if
  dateCalculator, // Date operations
  createVisualization, // Charts, tables, KPIs
  webSearch, // External web search
  stockPrice, // Stock market data
  memoryTool, // Remember user preferences
]
```

### Tool Selection

The LLM **decides autonomously** which tools to call based on:

1. User query
2. Pre-fetched data in context
3. Tool descriptions in system prompt
4. Conversation history

**Not hardcoded routing** - LLM has full autonomy.

---

## 6. How Everything Links Together

### The Mapping Chain

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  EXACT_PATTERNS  │     │  REPORT_KEYWORDS │     │  INTENT_PATTERNS │
│  (41 patterns)   │     │  (14 report      │     │  (8 intents)     │
│                  │     │   types)         │     │                  │
│  regex → intent  │     │  keywords →      │     │  regex →         │
│        + reports │     │  report type     │     │  intent          │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │      MATCHER.TS          │
                    │   routeQuery(input)      │
                    └──────────────────────────┘
```

### Three Linking Mechanisms

#### A) Pattern → Intent + Reports (Direct Link)

```typescript
// patterns.ts - EXACT_PATTERNS
{
  pattern: /why (did|has|is) (revenue|income|expenses|profit|cash) (drop|fall|spike|jump|change)/i,
  intent: 'anomaly',
  reports: ['profit_loss', 'revenue_trend'],
}
```

#### B) Intent → Memory Types (Alignment Table)

```typescript
// patterns.ts - INTENT_MEMORY_ALIGNMENT
INTENT_MEMORY_ALIGNMENT = {
  forecast: ['expense', 'income', 'goal'],
  anomaly: ['decision', 'context', 'expense'],
  // ...
}
```

#### C) Keyword → Report (Fallback Link)

```typescript
// patterns.ts - REPORT_KEYWORDS
REPORT_KEYWORDS = {
  profit_loss: ['revenue', 'income', 'sales', 'expenses', ...],
  balance_sheet: ['assets', 'liabilities', 'equity', ...],
  // ...
}
```

### Complete Link Chain

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   User       │    │   Router     │    │   Context    │    │   Agent      │
│   Input      │───▶│   Patterns   │───▶│   Preparer   │───▶│   + LLM      │
│              │    │              │    │              │    │              │
│ "What's my   │    │ intent:      │    │ Pre-fetch:   │    │ Decides:     │
│  runway?"    │    │  forecast    │    │  cash_flow   │    │ Call tool?   │
│              │    │ reports:     │    │  balance_    │    │ Or answer    │
│              │    │  cash_flow,  │    │  sheet       │    │ directly?    │
│              │    │  balance_    │    │ memories:    │    │              │
│              │    │  sheet       │    │  expense,    │    │              │
│              │    │              │    │  income      │    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘

LINK 1: Pattern defines intent + reports
LINK 2: Intent defines which memories to fetch
LINK 3: Pre-fetched data goes into system prompt
LINK 4: LLM uses context to decide tool calls
```

---

## 7. Complete Flow Example

### Example: "Why did expenses spike?"

```
User: "Why did expenses spike?"
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: EXACT PATTERN MATCH                                     │
│  Pattern: /why (did|has|is) ... (spike|jump|change)/i            │
│  MATCHED! → intent: 'anomaly', reports: ['profit_loss',          │
│             'revenue_trend']                                     │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: MEMORY ALIGNMENT                                        │
│  INTENT_MEMORY_ALIGNMENT['anomaly'] = ['decision', 'context',    │
│  'expense']                                                      │
│  Why? Anomalies are often explained by past decisions/context    │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: CONTEXT PREPARATION (HIGH confidence)                   │
│  Pre-fetch in parallel:                                          │
│  ├─ profit_loss report (last year data)                          │
│  ├─ revenue_trend report (12 months history)                     │
│  └─ memories of type: decision, context, expense                 │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: AGENT RECEIVES ENRICHED CONTEXT                         │
│  System Prompt includes:                                         │
│  - Pre-fetched P&L data                                          │
│  - Pre-fetched revenue trend (12 months)                         │
│  - User memories: "Hired 5 engineers in Nov"                     │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: LLM DECISION                                            │
│  LLM sees: expenses jumped $100k→$150k + memory about hires      │
│  LLM Response: "Expenses increased 50% primarily due to the 5    │
│  new engineering hires. Payroll went from $60k to $95k."         │
│  No additional tool calls needed - had all the data!             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Key Files Reference

| Component            | Path                               | Purpose                                  |
| -------------------- | ---------------------------------- | ---------------------------------------- |
| **Chat API**         | `src/app/api/chat/route.ts`        | Entry point, request handling, streaming |
| **Agent**            | `src/ai/agent.ts`                  | LangGraph state machine, tool binding    |
| **Router Matcher**   | `src/ai/router/matcher.ts`         | 3-tier pattern matching logic            |
| **Router Patterns**  | `src/ai/router/patterns.ts`        | All patterns, keywords, mappings         |
| **Router Types**     | `src/ai/router/types.ts`           | Type definitions                         |
| **Context Preparer** | `src/ai/router/contextPreparer.ts` | Pre-fetch logic, memory alignment        |
| **Tools Index**      | `src/ai/tools/index.ts`            | Tool registry                            |
| **System Prompts**   | `src/ai/prompts/system.ts`         | Prompt templates                         |
| **Circuit Breaker**  | `src/ai/circuit-breaker.ts`        | Failure tracking, circuit state          |

---

## Summary

| Aspect                | Implementation                                     |
| --------------------- | -------------------------------------------------- |
| **Routing Method**    | Hybrid: Pattern matching + LLM autonomy            |
| **Pattern Types**     | 41 exact patterns, 14 report keywords, 8 intents   |
| **Confidence Levels** | High (pre-fetch), Medium (partial), Low (fallback) |
| **Pre-fetching**      | Only for HIGH confidence routes                    |
| **Memory Alignment**  | Intent-based memory type selection                 |
| **Tool Selection**    | LLM autonomous (not hardcoded)                     |
| **Error Handling**    | Circuit breaker pattern (per-user, per-tool)       |

**Key Insight:** The router provides **optimization hints**, but the LLM has **final autonomy** on tool calls. If pre-fetch fails or is insufficient, the LLM can still call any tool it needs.
