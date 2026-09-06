# LangGraph Branch Migration Changelog

**Created:** 2026-01-18
**Last Updated:** 2026-01-18
**Base Branch:** `main`
**Feature Branch:** `langgraph`
**Total Commits:** 50+ commits ahead of main

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Changes](#architecture-changes)
3. [New Components](#new-components)
4. [Modified Components](#modified-components)
5. [Removed Components](#removed-components)
6. [State Management Changes](#state-management-changes)
7. [API Changes](#api-changes)
8. [Logging System](#logging-system)
9. [Performance Improvements](#performance-improvements)
10. [File Change Summary](#file-change-summary)
11. [Migration Checklist](#migration-checklist)

---

## Executive Summary

The `langgraph` branch introduces a fundamental architectural shift from a **ReAct Loop** pattern to a **Plan-Execute** pattern. This migration provides:

| Metric            | Main Branch   | LangGraph Branch | Improvement        |
| ----------------- | ------------- | ---------------- | ------------------ |
| LLM Calls         | 5+ minimum    | 3 minimum        | ~40% fewer         |
| Tool Calls        | 15-23         | 4-8              | ~65% fewer         |
| Response Time     | 60-100s       | 20-40s           | ~50% faster        |
| State Persistence | Cross-session | Per-request      | Simpler, stateless |

### Architecture Comparison

```
MAIN BRANCH (ReAct):
┌─────────────┐    ┌───────────────┐    ┌───────┐
│ routeQuery  │───▶│ prepareContext│───▶│ agent │◀──▶ tools ───▶ END
└─────────────┘    └───────────────┘    └───────┘
      │                    │
      │                    ▼
      │              ┌───────────┐
      └─────────────▶│checkpointer│ (persists state)
                     └───────────┘

LANGGRAPH BRANCH (Plan-Execute):
┌──────────┐    ┌─────────┐    ┌──────────┐    ┌───────────┐
│ enhancer │───▶│ planner │───▶│ executor │◀──▶│ replanner │
└──────────┘    └─────────┘    └──────────┘    └───────────┘
                                    │                │
                                    ▼                │
                                 tools ──────────────┘
                                    │
                                    ▼
                                  END (when response set)
```

---

## Architecture Changes

### 1. From ReAct to Plan-Execute

| Aspect                | Main (ReAct)                       | LangGraph (Plan-Execute)          |
| --------------------- | ---------------------------------- | --------------------------------- |
| **Decision Making**   | Agent decides each step reactively | Planner creates upfront plan      |
| **Tool Calling**      | Unbounded loop                     | Budget-limited (12 max/turn)      |
| **Progress Tracking** | Implicit in messages               | Explicit `pastSteps` array        |
| **Termination**       | Agent says "done"                  | `response` field set by replanner |
| **Debugging**         | Hard to trace                      | Full plan visibility              |

### 2. From Stateful to Stateless

| Aspect              | Main                     | LangGraph                 |
| ------------------- | ------------------------ | ------------------------- |
| **State Storage**   | MemorySaver checkpointer | DynamoDB (per-request)    |
| **Cross-Session**   | Yes (via thread_id)      | No (fresh each request)   |
| **Message History** | Managed by checkpointer  | Fetched from DB each time |
| **Complexity**      | Higher (sync issues)     | Lower (predictable)       |

### 3. From Pattern Router to KPI Prefetch

| Aspect             | Main                        | LangGraph               |
| ------------------ | --------------------------- | ----------------------- |
| **Query Analysis** | Pattern matching (785 LOC)  | Removed entirely        |
| **Data Prefetch**  | Confidence-based, selective | All KPIs in single call |
| **Context Prep**   | 547 lines                   | 117 lines               |
| **Routing Files**  | matcher.ts, patterns.ts     | Deleted                 |

---

## New Components

### 1. Planner Node (`src/ai/planner/`)

**Purpose:** Generates execution plan before any tools run.

**Files:**

- `node.ts` (194 lines) - Main planner logic
- `prompt.ts` (96 lines) - Planning prompt template
- `types.ts` (39 lines) - Type definitions
- `index.ts` (6 lines) - Exports

**Key Features:**

- Creates 2-4 step plans using structured output
- Extracts conversation context and company info
- Uses fast LLM (configurable via MODEL_CONFIG.planner)
- Timeout handling with fallback to single-step plan

**Example Plan Output:**

```typescript
{
  originalInput: "How's my cash situation?",
  plan: [
    "Fetch cash balance and cash flow report",
    "Fetch AR/AP aging for timing context",
    "Assess runway and flag concerns"
  ],
  pastSteps: [],
  response: null
}
```

---

### 2. Replanner Node (`src/ai/replanner/`)

**Purpose:** Evaluates progress and decides whether to respond or continue.

**Files:**

- `node.ts` (362 lines) - Main replanner logic
- `prompt.ts` (87 lines) - Replanning prompt template
- `types.ts` (36 lines) - Type definitions
- `index.ts` (12 lines) - Exports

**Key Features:**

- Two tool options: `respond` (task complete) or `update_plan` (continue)
- Max steps limit (10) with graceful fallback
- Extracts visualization markers from completed steps
- Generates fallback response if replanning fails

**Decision Flow:**

```
pastSteps.length >= 10? ──▶ Force response synthesis
         │
         ▼
Invoke replanner LLM with:
  - objective (original question)
  - learnings (from working memory)
  - pastSteps (completed work)
  - remainingPlan (pending steps)
         │
         ▼
┌────────────────────────────┐
│ respond tool called?       │──▶ Return { response: "..." }
└────────────────────────────┘
         │ no
         ▼
┌────────────────────────────┐
│ update_plan tool called?   │──▶ Return { plan: [...] }
└────────────────────────────┘
```

---

### 3. Query Enhancer (`src/ai/enhancer/`)

**Purpose:** Provides context-aware guidance for the main agent.

**Files:**

- `node.ts` (277 lines) - Main enhancer logic
- `prompt.ts` (125 lines) - Enhancement prompt
- `types.ts` (14 lines) - Type definitions
- `index.ts` (6 lines) - Exports

**Key Features:**

- Extracts conversation context, memories, tool results
- Uses fast reasoning model for quick enhancement
- Provides suggestive (not prescriptive) guidance
- Handles clarification detection

**Context Extraction:**

```typescript
// Memory context flags
;(hasExpenses, hasIncome, hasGoals, hasDeadlines, hasPreferences)

// Tool results context
;('Already shown: profit_loss report (revenue: $1.2M, expenses: $800K)')

// Company context
;('Company: Acme Corp (USD)')
```

---

### 4. Cognitive Reflection (`src/ai/cognitive/`)

**Purpose:** Open-ended reflection after data-fetching tools.

**Files:**

- `reflect.ts` (146 lines) - Reflection logic
- `types.ts` (46 lines) - Working memory types

**Key Features:**

- Triggers for data tools: `quickbooks_data`, `web_search`, `stock_price`
- Infers confidence from natural language (no rigid JSON parsing)
- Prunes learnings when exceeding 5 entries
- Summarizes older learnings to prevent unbounded growth

**Working Memory Structure:**

```typescript
interface WorkingMemory {
  learnings: string[] // What agent has learned
  confidence: 'low' | 'medium' | 'high' // Inferred from text
  iteration: number // Current iteration
  maxIterations: number // Limit (default: 5)
}
```

---

### 5. Shared Utilities (`src/ai/utils/`)

**Files:**

- `context.ts` (84 lines) - Context extraction utilities
- `tokens.ts` (81 lines) - Token estimation utilities
- `index.ts` (8 lines) - Exports

**Key Functions:**

```typescript
// Extract conversation summary from messages
extractConversationContext(messages: BaseMessage[]): ConversationContext

// Calculate message breakdown for logging
calculateMessageBreakdown(messages: BaseMessage[]): MessageBreakdown

// Estimate tokens in text
estimateTokens(text: string): number
```

---

### 6. CycleLogger (`src/lib/logger.ts`)

**Purpose:** Structured logging for LangGraph cycles.

**New Class:** `CycleLogger` (~400 lines added)

**Methods:**
| Method | Purpose |
|--------|---------|
| `startCycle()` | Begin logging a new cycle |
| `endCycle()` | End cycle with duration |
| `logNode(name, icon, data, breakdown)` | Log node execution |
| `logPlannerNode(objective, plan, ...)` | Log plan generation |
| `logReplannerNode(decision, ...)` | Log replanning decision |
| `logToolCall(name, input, output)` | Log tool execution |
| `logUserMessage(content, id, breakdown)` | Log user input |
| `logInitialState(breakdown)` | Log starting state |

**New Logger Methods:**
| Method | Purpose |
|--------|---------|
| `enhancement()` | Cyan-styled query enhancement logs |
| `contextInfo()` | Compact token breakdown |
| `contextBreakdown()` | Detailed per-type analysis |

---

## Modified Components

### 1. Agent (`src/ai/agent.ts`)

**Changes:** +1400 lines, major restructuring

| Change                | Description                          |
| --------------------- | ------------------------------------ |
| Tool call budget      | Added MAX_TOOL_CALLS_PER_TURN = 12   |
| Token estimation      | Changed from 2.5 to 4 chars/token    |
| KPI formatting        | New `formatPreloadedKPIs()` function |
| Enhancement injection | Guidance added to system prompt      |
| Context calculation   | Now includes prefetchedData tokens   |
| Logging               | Integrated CycleLogger throughout    |
| Graph routing         | Added plan-execute conditional edges |

**New Functions:**

```typescript
formatPreloadedKPIs(kpis: Record<string, number | string>): string
formatEnhancementGuidance(enhancement: QueryEnhancement): string
```

**Tool Call Budget Implementation:**

```typescript
function shouldContinue(state: AgentStateType): 'tools' | typeof END {
  const MAX_TOOL_CALLS_PER_TURN = 12

  let toolCallCount = 0
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const msg = state.messages[i]
    if (msg._getType() === 'human') break
    if (msg._getType() === 'ai' && 'tool_calls' in msg) {
      toolCallCount += (msg as AIMessage).tool_calls?.length || 0
    }
  }

  if (toolCallCount >= MAX_TOOL_CALLS_PER_TURN) {
    logger.warn('[Agent] Tool call budget exceeded')
    return END
  }
  // ... rest of logic
}
```

---

### 2. State (`src/ai/state.ts`)

**Changes:** +100 lines, new fields and reducer

**New Message Reducer:**

```typescript
function deduplicatedMessagesReducer(
  prev: BaseMessage[],
  next: BaseMessage[] | BaseMessage
): BaseMessage[] {
  const merged = messagesStateReducer(prev, next)

  // Deduplicate by content hash, keeping LAST occurrence
  const seenHashes = new Map<string, number>()
  merged.forEach((msg, index) => {
    const hash = getMessageContentHash(msg)
    seenHashes.set(hash, index)
  })

  return merged.filter((msg, index) => seenHashes.get(getMessageContentHash(msg)) === index)
}
```

**New State Fields:**

```typescript
// Plan-Execute fields
originalInput: Annotation<string> // User's question
plan: Annotation<string[]> // Current plan steps
pastSteps: Annotation<[string, string][]> // [step, result] pairs
response: Annotation<string | null> // Final response
workingMemory: Annotation<WorkingMemory> // Cognitive state

// Enhanced existing
queryEnhancement: Annotation<QueryEnhancement | null>
```

---

### 3. Context Preparer (`src/ai/router/contextPreparer.ts`)

**Changes:** -430 lines (547 → 117)

**Before (Main):**

- Pattern-based confidence routing
- Selective report prefetching
- Complex error handling per report
- Multiple provider API calls

**After (LangGraph):**

```typescript
export async function prepareContext(options: PrepareContextOptions): Promise<PreparedContext> {
  const [memories, kpis] = await Promise.all([
    fetchMemories(userId, organizationId),
    fetchKPIs(organizationId, currency),
  ])
  return { memories, kpis, fetchDuration: Date.now() - startTime }
}
```

---

### 4. Chat Route (`src/app/api/chat/route.ts`)

**Changes:** +200 lines, major restructuring

| Change  | Description                            |
| ------- | -------------------------------------- |
| Removed | `routeQuery()` call                    |
| Removed | `thread_id` for checkpointer           |
| Added   | `CycleLogger` integration              |
| Added   | Chat history fetch BEFORE save         |
| Added   | Plan-execute response extraction       |
| Added   | Token filtering for non-agent nodes    |
| Changed | Context preparation to single KPI call |

**Key Changes:**

```typescript
// Before (Main)
const route = routeQuery(input)
const preparedContext = await prepareContext({ route, ... })
const configurable = { thread_id: threadId, ... }

// After (LangGraph)
const preparedContext = await prepareContext({ organizationId, userId, currency })
const cycleLogger = new CycleLogger({ correlationId, threadId, userId })
const configurable = { sessionId: threadId, cycleLogger, ... }

// Fetch history BEFORE saving to prevent duplication
const chatHistory = await fetchLastN(userId, 15, realmId)
await saveMessage(...)

// Extract plan-execute response
if (eventType === 'on_chain_end' && event.name === 'LangGraph') {
  const output = event.data?.output
  if (output?.response) {
    planExecuteResponse = output.response
  }
}
```

---

### 5. Router Types (`src/ai/router/types.ts`)

**Changes:** -100 lines, simplified

**Removed Types:**

- `QueryIntent` (8 variants)
- `ReportType` (11 variants)
- `RoutePeriod` (6 variants)
- `RouteConfidence`
- `MatchTier`
- `RouteResult`

**New Types:**

```typescript
export interface PreparedContext {
  memories: string
  kpis?: PreloadedKPIs
  fetchDuration: number
}

export interface PreloadedKPIs {
  // All KPI fields
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  // ... etc
}

export const FINANCIAL_MEMORY_TYPES: MemoryType[] = [...]
```

---

### 6. Visualization Tool (`src/ai/tools/visualization.ts`)

**Changes:** Removed table type

```typescript
// Before
type: z.enum(['bar', 'line', 'pie', 'area', 'donut', 'waterfall', 'sunburst', 'table', 'kpi'])

// After
type: z.enum(['bar', 'line', 'pie', 'area', 'donut', 'waterfall', 'sunburst', 'kpi'])
```

---

### 7. LLM Configuration (`src/lib/llm.ts`)

**Changes:** Added model configs for new nodes

```typescript
export const MODEL_CONFIG = {
  name: 'deepseek-r1-distill-llama-70b',
  // ... existing config

  // NEW: Node-specific configs
  planner: {
    model: 'llama-3.3-70b-versatile',
    temperature: 0.2,
    maxTokens: 500,
    timeout: 10000,
  },
  replanner: {
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    maxTokens: 2000,
    timeout: 15000,
  },
  enhancer: {
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    maxTokens: 500,
    timeout: 8000,
  },
}
```

---

## Removed Components

| File                                                      | Lines | Purpose                             | Reason for Removal              |
| --------------------------------------------------------- | ----- | ----------------------------------- | ------------------------------- |
| `src/ai/checkpointer.ts`                                  | 51    | MemorySaver for cross-session state | Moved to stateless architecture |
| `src/ai/router/matcher.ts`                                | 292   | Pattern matching for queries        | Replaced by enhancer/planner    |
| `src/ai/router/patterns.ts`                               | 493   | Query pattern definitions           | No longer needed                |
| `src/ai/router/__tests__/matcher.manual-test.ts`          | 283   | Tests for matcher                   | Matcher removed                 |
| `@AGENT.md`                                               | 168   | Agent documentation                 | Replaced by new docs            |
| `@fix_plan.md`                                            | 32    | Fix planning notes                  | Completed                       |
| `PROMPT.md`                                               | 311   | Prompt documentation                | Integrated elsewhere            |
| `src/app/(main)/visualizations/breakbs/`                  | 1000+ | DrillDownWaterfall component        | Refactored                      |
| `src/components/chat/visualizations/components/Table.tsx` | 94    | Table visualization                 | Removed viz type                |

---

## State Management Changes

### Message Flow Comparison

**Main Branch:**

```
1. User sends message
2. Checkpointer loads previous state (if thread_id exists)
3. Agent processes with full history
4. Checkpointer saves updated state
5. Next request loads from checkpointer
```

**LangGraph Branch:**

```
1. User sends message
2. Fetch last N messages from DynamoDB
3. Deduplicate messages by content hash
4. Build fresh state with messages + KPIs
5. Agent processes (stateless)
6. Save response to DynamoDB
7. Next request fetches fresh from DB
```

### State Field Changes

| Field              | Main                   | LangGraph                     | Change       |
| ------------------ | ---------------------- | ----------------------------- | ------------ |
| `messages`         | `messagesStateReducer` | `deduplicatedMessagesReducer` | Custom dedup |
| `prefetchedData`   | Reports by type        | KPIs object                   | Simplified   |
| `originalInput`    | N/A                    | `string`                      | NEW          |
| `plan`             | N/A                    | `string[]`                    | NEW          |
| `pastSteps`        | N/A                    | `[string, string][]`          | NEW          |
| `response`         | N/A                    | `string \| null`              | NEW          |
| `workingMemory`    | N/A                    | `WorkingMemory`               | NEW          |
| `queryEnhancement` | N/A                    | `QueryEnhancement \| null`    | NEW          |

---

## API Changes

### Chat Route Request/Response

**No external API changes** - the request/response format remains the same.

**Internal Changes:**

- Configurable object no longer includes `thread_id`
- New `cycleLogger` in configurable
- Response may come from `state.response` (plan-execute) instead of streamed tokens

### Context Preparation

**Before:**

```typescript
interface PrepareContextOptions {
  route: RouteResult
  organizationId: string
  userId: string
  provider: FinancialProvider
  apiClient: ProviderApiClient
  currency: string
}

interface PreparedContext {
  route: RouteResult
  prefetchedData: Record<string, unknown>
  memories: string
  fetchDuration: number
}
```

**After:**

```typescript
interface PrepareContextOptions {
  organizationId: string
  userId: string
  currency?: string
}

interface PreparedContext {
  memories: string
  kpis?: PreloadedKPIs
  fetchDuration: number
}
```

---

## Logging System

### New Log Output Format

**Cycle Start:**

```
═══════════════════════════════════════════════════════════════
🔄 LANGGRAPH CYCLE START
───────────────────────────────────────────────────────────────
📍 Thread: user123_org456
🔗 Correlation: abc-123-def
───────────────────────────────────────────────────────────────
```

**Node Execution:**

```
├── ⚡ enhancer
│   Guidance: Focus on cash flow analysis...
│   📊 3 human, 2 ai, 1 tool (1,234 tokens)
│   ⏱️ 245ms
```

**Tool Call:**

```
┌─ 🔧 quickbooks_data ─────────────────────────────────────────
│ ⚡ Executing...
├─ Input:
│   { "queryType": "report", "reportType": "cash_flow" }
├─ ✓ Success (1,523ms)
└─ Output (12,345 chars): {"success":true,"data":{...
```

**Cycle End:**

```
═══════════════════════════════════════════════════════════════
✓ CYCLE COMPLETE (2,345ms)
  📊 Final: 5 human, 4 ai, 3 tool (8,765 tokens)
  📈 Growth: +2,100 tokens
═══════════════════════════════════════════════════════════════
```

---

## Performance Improvements

### Token Usage

| Metric               | Main          | LangGraph     | Improvement          |
| -------------------- | ------------- | ------------- | -------------------- |
| System prompt        | ~2,000 tokens | ~2,500 tokens | +500 (KPIs included) |
| Tool calls per query | 15-23         | 4-8           | -65%                 |
| LLM round trips      | 5+            | 3             | -40%                 |
| Total tokens/query   | ~50,000       | ~20,000       | -60%                 |

### Response Time

| Phase        | Main    | LangGraph |
| ------------ | ------- | --------- |
| Context prep | 2-5s    | 1-2s      |
| Planning     | N/A     | 1-2s      |
| Execution    | 40-80s  | 10-25s    |
| Replanning   | N/A     | 1-3s      |
| **Total**    | 60-100s | 20-40s    |

### Tool Call Reduction

**Example Query: "How's my business doing?"**

| Branch    | Tool Calls | Reason                       |
| --------- | ---------- | ---------------------------- |
| Main      | 15-20      | Agent explores reactively    |
| LangGraph | 4-6        | Planner creates focused plan |

---

## File Change Summary

### Statistics

```
88 files changed
+10,651 insertions
-5,590 deletions
Net: +5,061 lines
```

### By Category

**Added Files (New Functionality):**

```
src/ai/planner/           ~335 lines (4 files)
src/ai/replanner/         ~497 lines (4 files)
src/ai/enhancer/          ~422 lines (4 files)
src/ai/cognitive/         ~192 lines (2 files)
src/ai/utils/             ~173 lines (3 files)
docs/architecture/        ~1,743 lines (4 files)
PLAN_EXECUTE_IMPLEMENTATION.md  853 lines
AGENT_INTELLIGENCE_DIAGNOSIS.md 1,495 lines
```

**Modified Files (Major Changes):**

```
src/ai/agent.ts           +1,400 lines
src/lib/logger.ts         +793 lines
src/app/api/chat/route.ts +200 lines
src/ai/state.ts           +100 lines
```

**Removed Files:**

```
src/ai/checkpointer.ts           -51 lines
src/ai/router/matcher.ts         -292 lines
src/ai/router/patterns.ts        -493 lines
@AGENT.md                        -168 lines
PROMPT.md                        -311 lines
DrillDownWaterfall component     -815 lines
```

---

## Migration Checklist

### Pre-Migration

- [ ] Review all changes in this document
- [ ] Backup main branch state
- [ ] Ensure all tests pass on main
- [ ] Document current performance baseline

### Migration Steps

- [ ] Merge langgraph into main (or rebase)
- [ ] Update environment variables if needed
- [ ] Run database migrations (if any)
- [ ] Update MODEL_CONFIG if using different models
- [ ] Test plan-execute flow end-to-end

### Post-Migration

- [ ] Monitor CycleLogger output for issues
- [ ] Compare performance metrics to baseline
- [ ] Verify tool call counts are reduced
- [ ] Check response quality hasn't degraded
- [ ] Update external documentation

### Rollback Plan

If issues arise:

1. Revert merge commit
2. Restore checkpointer.ts
3. Restore matcher.ts and patterns.ts
4. Update imports in agent.ts and route.ts

---

## Appendix: Key Commits

| Commit     | Message                                            | Impact              |
| ---------- | -------------------------------------------------- | ------------------- |
| `a7e911f4` | feat(ai): add Plan-Execute architecture foundation | Core architecture   |
| `db5fc4f3` | feat(ai): implement executor with tool loop        | Executor node       |
| `9121217f` | feat(api): integrate Plan-Execute responses        | API integration     |
| `198727dd` | refactor(ai): consolidate logging into CycleLogger | Logging system      |
| `7af755ba` | feat: prefetch all KPIs in single call             | KPI optimization    |
| `f0a2df6a` | fix: add content-based message deduplication       | State dedup         |
| `81b01756` | chore: removed cross session persistence           | Stateless migration |

---

## Questions & Contact

For questions about this migration:

- Review `PLAN_EXECUTE_IMPLEMENTATION.md` for detailed architecture
- Check `docs/architecture/AI_AGENT_BEST_PRACTICES.md` for patterns
- See `AGENT_INTELLIGENCE_DIAGNOSIS.md` for debugging tips

---

_Document generated: 2026-01-18_
