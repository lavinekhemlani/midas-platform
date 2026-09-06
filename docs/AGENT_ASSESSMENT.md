# Zenith Agent System Assessment (Main Branch)

## Executive Summary

This document analyzes the current agentic system architecture on the **main branch** and identifies improvements for:

1. **Tool call accuracy** - ensuring the right tools are called with correct parameters
2. **Data granularity** - fetching the right level of detail (summary vs. detailed)
3. **Intent routing** - understanding user intent and routing to appropriate data sources

---

## Current Architecture Analysis

### Data Flow

```
User Query
    ↓
[Router] routeQuery() - Pattern-based (NO LLM)
    │ Tier 1: Exact pattern match (35 patterns)
    │ Tier 2: Keyword matching
    │ Tier 3: Fallback (agent decides)
    ↓
[Context Preparer] - Pre-fetch + memories (parallel)
    │ Only pre-fetches for HIGH confidence routes
    ↓
[Main Agent] ← Full LLM (Groq)
    │ Has: pre-fetched data, tool schemas, system prompt
    │ Decides: which tools to call, what parameters
    ↓
[Tool Execution] ← Custom tool node with circuit breaker
    │ Returns: structured data
    ↓
[Response Generation]
```

### Current Strengths

| Strength                   | Location                          | Benefit                                        |
| -------------------------- | --------------------------------- | ---------------------------------------------- |
| **3-tier routing**         | `router/matcher.ts:29-50`         | Fast (<1ms), deterministic pattern matching    |
| **35 exact patterns**      | `router/patterns.ts:121-341`      | High confidence for common queries             |
| **Ambiguity detection**    | `matcher.ts:252-292`              | Detects revenue/expenses/profit/cash ambiguity |
| **Clarification protocol** | `prompts/system.ts:169-206`       | Agent asks before guessing                     |
| **Pre-fetching**           | `router/contextPreparer.ts:50-71` | Parallel fetch for high-confidence routes      |
| **Memory alignment**       | `patterns.ts:394-418`             | Right memories for each intent type            |
| **Circuit breaker**        | `circuit-breaker.ts`              | Per-user isolation                             |

### Current Weaknesses

#### 1. Tool Call Accuracy Gaps

| Issue                                       | Location                | Impact                                        |
| ------------------------------------------- | ----------------------- | --------------------------------------------- |
| **Pattern coverage limited**                | `patterns.ts`           | Only 35 patterns; many queries fall to Tier 3 |
| **No validation of tool params**            | `agent.ts`              | LLM can pass invalid enum combinations        |
| **Fallback gives NO guidance**              | `matcher.ts:132-146`    | Tier 3 returns empty reports[], agent guesses |
| **Pre-fetch skipped for medium confidence** | `contextPreparer.ts:52` | Only HIGH confidence gets pre-fetch           |

**Example failure:**

```
User: "What's causing my margin drop?"
Router: Tier 2 match → intent='anomaly', confidence='medium'
Pre-fetch: SKIPPED (medium, not high)
Agent: Must call tool without guidance → may fetch wrong report
```

#### 2. Granularity Decision Gaps

| Issue                                  | Location                    | Impact                                    |
| -------------------------------------- | --------------------------- | ----------------------------------------- |
| **Router doesn't specify granularity** | `types.ts`                  | RouteResult has no `suggestedGranularity` |
| **No `summarizeBy` in pre-fetch**      | `contextPreparer.ts:89-125` | Pre-fetched data is always `Total`        |
| **LLM decides granularity ad-hoc**     | Throughout                  | May miss "by month" in query              |
| **No escalation logic**                | None exists                 | If summary insufficient, no auto-retry    |

**Example failure:**

```
User: "Show me revenue by month"
Router: Detects 'trend' intent, suggests revenue_trend
Pre-fetch: Fetches revenue_trend with summarizeBy='Total' (wrong!)
Agent: Has pre-fetched data but it's wrong granularity
Result: Agent must re-fetch with summarizeBy='Month'
```

#### 3. Intent Routing Gaps

| Issue                               | Location              | Impact                                          |
| ----------------------------------- | --------------------- | ----------------------------------------------- |
| **Intent patterns too broad**       | `patterns.ts:349-358` | Many queries match multiple intents             |
| **No priority within Tier 2**       | `matcher.ts:95-122`   | First match wins, may not be best               |
| **Comparison not detected well**    | `patterns.ts:351`     | "Q1 vs Q2" may not trigger comparison           |
| **Drill-down pattern too specific** | `patterns.ts:355`     | "why are expenses up" → anomaly, not drill_down |

**Example failure:**

```
User: "Compare my Q1 expenses to Q2"
Pattern check: /(compare|vs|versus|difference|change from|against|over.*over)/i
Match: "Compare" matches, but "Q1...Q2" is the real signal
Intent: 'comparison' ✓
Reports: ['profit_loss', 'pnl_comparison']
Problem: Tool call uses queryType='report' instead of queryType='compare'
```

---

## Gap Analysis by Category

### A. Pattern Coverage Analysis

Current exact patterns cover:

- ✅ Revenue/expense/profit point queries
- ✅ Runway/burn rate forecasts
- ✅ Financial statement requests (P&L, BS, CF)
- ✅ Health check queries
- ✅ AR/AP queries
- ✅ Basic trend queries

Missing patterns for:

- ❌ "Which customers are late?" (entity + filter)
- ❌ "Show me my top 10 vendors" (entity + sort + limit)
- ❌ "What's my DSO?" (specific metric)
- ❌ "Project my cash for next 3 months" (forecast + calculation)
- ❌ "Email invoice to X" (action query)
- ❌ Category-specific breakdown ("online vs offline revenue")

### B. Granularity Signal Detection

| Signal       | Current Detection    | Gap                                 |
| ------------ | -------------------- | ----------------------------------- |
| "by month"   | Intent='trend'       | No summarizeBy='Month' passed       |
| "by quarter" | Intent='trend'       | No summarizeBy='Quarter' passed     |
| "breakdown"  | Intent='drill_down'  | Doesn't request detailed hierarchy  |
| "top 10"     | Not detected         | No limit=10 in route result         |
| "overdue"    | Intent='point_query' | Doesn't add filter.status='overdue' |

### C. Query Type Mapping

The router detects INTENT but doesn't map to QUERY TYPE:

| User Intent             | Detected Intent | Expected queryType       | Actual Result              |
| ----------------------- | --------------- | ------------------------ | -------------------------- |
| "Compare Q1 vs Q2"      | comparison      | `compare`                | Agent may use `report`     |
| "Show me trends"        | trend           | `report` + `summarizeBy` | Agent may miss summarizeBy |
| "Who owes me?"          | point_query     | `entity`                 | Agent may use `report`     |
| "What's my DSO?"        | point_query     | `metric`                 | Agent may use `report`     |
| "Why did revenue drop?" | anomaly         | `analyze`                | Agent may use `report`     |

---

## Proposed Solutions

### Solution 1: Enhanced Route Result (High Priority)

**Problem:** Router detects intent but doesn't provide enough guidance.

**Solution:** Extend `RouteResult` to include tool-level suggestions.

```typescript
// ENHANCED: src/ai/router/types.ts

export interface RouteResult {
  // Existing fields
  intent: QueryIntent
  reports: ReportType[]
  periods: RoutePeriod[]
  memoryTypes: MemoryType[]
  confidence: RouteConfidence
  matchedTier: MatchTier
  ambiguousTerms: string[]
  requiresClarification: boolean

  // NEW: Tool-level guidance
  suggestedQueryType?: 'report' | 'analyze' | 'compare' | 'entity' | 'metric' | 'search'
  suggestedGranularity?: 'Total' | 'Month' | 'Quarter' | 'Year'
  suggestedFilters?: {
    status?: string
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }

  // NEW: Confidence breakdown
  confidenceDetails?: {
    patternMatch: number // 0-1
    keywordMatch: number // 0-1
    granularityDetected: boolean
    filtersDetected: boolean
  }
}
```

**Implementation in patterns:**

```typescript
// ENHANCED: src/ai/router/patterns.ts

export const EXACT_PATTERNS: ExactPattern[] = [
  {
    pattern: /compare (this|current) (month|quarter|year) (to|vs|with|against) (last|previous)/i,
    intent: 'comparison',
    reports: ['profit_loss', 'pnl_comparison'],
    // NEW: Tool-level mapping
    queryType: 'compare',
    compareType: 'period',
  },
  {
    pattern: /revenue (trend|over time|by month|growth|trajectory)/i,
    intent: 'trend',
    reports: ['revenue_trend'],
    // NEW: Granularity hint
    summarizeBy: 'Month',
  },
  {
    pattern: /who owes (us|me)|outstanding invoices/i,
    intent: 'point_query',
    reports: ['aged_receivables'],
    // NEW: Entity query mapping
    queryType: 'entity',
    entityType: 'invoice',
    filters: { status: 'open' },
  },
]
```

---

### Solution 2: Granularity Detection Engine (High Priority)

**Problem:** Router doesn't detect or pass granularity signals.

**Solution:** Add explicit granularity detection in router.

```typescript
// NEW: src/ai/router/granularity.ts

export type GranularityLevel = 'summary' | 'monthly' | 'quarterly' | 'detailed' | 'transaction'

interface GranularitySignal {
  level: GranularityLevel
  summarizeBy?: 'Month' | 'Quarter' | 'Year' | 'Total'
  includeLineItems?: boolean
  filters?: Record<string, any>
}

const GRANULARITY_PATTERNS: Record<GranularityLevel, RegExp[]> = {
  monthly: [
    /by month/i,
    /month(ly)?( breakdown| trend| view)?/i,
    /each month/i,
    /per month/i,
    /mom|month.over.month/i,
  ],
  quarterly: [
    /by quarter/i,
    /quarter(ly)?( breakdown| trend| view)?/i,
    /each quarter/i,
    /qoq|quarter.over.quarter/i,
  ],
  detailed: [
    /break(down|ing)/i,
    /by (category|type|account|customer|vendor)/i,
    /line.?item/i,
    /detail(ed|s)?/i,
    /what('s| is) driving/i,
  ],
  transaction: [
    /each (invoice|bill|transaction|payment)/i,
    /individual/i,
    /list (all|every)/i,
    /top \d+/i,
  ],
  summary: [/total/i, /overall/i, /summary/i, /snapshot/i],
}

export function detectGranularity(query: string): GranularitySignal {
  const normalized = query.toLowerCase()

  // Check patterns in priority order (most specific first)
  for (const level of [
    'transaction',
    'detailed',
    'monthly',
    'quarterly',
    'summary',
  ] as GranularityLevel[]) {
    const patterns = GRANULARITY_PATTERNS[level]
    if (patterns.some((p) => p.test(normalized))) {
      return mapLevelToSignal(level)
    }
  }

  // Default to summary
  return { level: 'summary', summarizeBy: 'Total' }
}

function mapLevelToSignal(level: GranularityLevel): GranularitySignal {
  switch (level) {
    case 'monthly':
      return { level, summarizeBy: 'Month' }
    case 'quarterly':
      return { level, summarizeBy: 'Quarter' }
    case 'detailed':
      return { level, summarizeBy: 'Total', includeLineItems: true }
    case 'transaction':
      return { level, summarizeBy: 'Total', includeLineItems: true }
    default:
      return { level: 'summary', summarizeBy: 'Total' }
  }
}
```

**Integration in router:**

```typescript
// MODIFIED: src/ai/router/matcher.ts

import { detectGranularity } from './granularity'

export function routeQuery(query: string): RouteResult {
  const normalizedQuery = normalizeQuery(query)

  // Existing tier matching...

  // NEW: Detect granularity
  const granularity = detectGranularity(normalizedQuery)

  return {
    ...baseResult,
    suggestedGranularity: granularity.summarizeBy,
    suggestedFilters: granularity.filters,
  }
}
```

---

### Solution 3: Pre-fetch with Granularity (High Priority)

**Problem:** Pre-fetch always uses `Total` summarization.

**Solution:** Pass detected granularity to pre-fetch.

```typescript
// MODIFIED: src/ai/router/contextPreparer.ts

export async function prepareContext(options: PrepareContextOptions): Promise<PreparedContext> {
  const { route, organizationId, provider, apiClient, currency } = options

  // Pre-fetch with correct granularity
  const prefetchedData = shouldPrefetch(route)
    ? await prefetchReports(
        route,
        organizationId,
        provider,
        apiClient,
        currency,
        route.suggestedGranularity // NEW: Pass granularity
      )
    : {}

  // Also pre-fetch for MEDIUM confidence if we have clear suggestions
  const shouldAlsoPrefetch =
    route.confidence === 'medium' && route.suggestedQueryType && route.reports.length > 0

  if (shouldAlsoPrefetch && Object.keys(prefetchedData).length === 0) {
    // Fetch with lower priority
    prefetchedData = await prefetchReports(
      route,
      organizationId,
      provider,
      apiClient,
      currency,
      route.suggestedGranularity
    )
  }

  return { route, prefetchedData, memories }
}

async function prefetchReports(
  route: RouteResult,
  organizationId: string,
  provider: string,
  apiClient: any,
  currency: string,
  summarizeBy?: 'Month' | 'Quarter' | 'Year' | 'Total' // NEW param
): Promise<Record<string, unknown>> {
  // Use detected granularity
  const params = {
    period: route.periods[0] || 'last_year',
    summarizeBy: summarizeBy || 'Total', // Use detected or default
  }

  // Fetch in parallel...
}
```

---

### Solution 4: Query Type Inference (Medium Priority)

**Problem:** Router detects intent but doesn't map to tool's `queryType`.

**Solution:** Add intent-to-queryType mapping.

```typescript
// NEW: src/ai/router/queryTypeMapper.ts

type ToolQueryType = 'report' | 'analyze' | 'compare' | 'entity' | 'metric' | 'search'

const INTENT_TO_QUERY_TYPE: Record<QueryIntent, ToolQueryType[]> = {
  point_query: ['report', 'metric'], // Could be either
  trend: ['report'], // With summarizeBy
  comparison: ['compare'], // Use compare queryType
  forecast: ['metric', 'report'], // Metric for runway, report for cash
  anomaly: ['analyze'], // Use analyze queryType
  health_check: ['report'], // financial_health report
  drill_down: ['report', 'analyze'], // Report with breakdown or analyze
  general: ['report'], // Default to report
}

// Specific metric keywords that should use queryType='metric'
const METRIC_KEYWORDS = [
  'dso',
  'dpo',
  'current ratio',
  'quick ratio',
  'burn rate',
  'runway',
  'gross margin',
  'net margin',
  'operating margin',
  'debt to equity',
  'roa',
  'roe',
  'working capital',
]

export function inferQueryType(
  intent: QueryIntent,
  query: string,
  reports: ReportType[]
): ToolQueryType {
  const normalized = query.toLowerCase()

  // Check for specific metric keywords
  if (METRIC_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return 'metric'
  }

  // Check for comparison signals
  if (intent === 'comparison' || /\bvs\.?\b|versus|compared? to/i.test(query)) {
    return 'compare'
  }

  // Check for analysis signals
  if (intent === 'anomaly' || /why|what caused|unusual|spike|drop/i.test(query)) {
    return 'analyze'
  }

  // Check for entity signals
  if (/who owes|customers?|vendors?|invoices?|bills?/i.test(query)) {
    return 'entity'
  }

  // Default based on intent
  return INTENT_TO_QUERY_TYPE[intent][0]
}
```

---

### Solution 5: Tool Call Validation (Medium Priority)

**Problem:** LLM may call tools with invalid parameter combinations.

**Solution:** Add pre-call validation in tool node.

```typescript
// NEW: src/ai/tools/validation.ts

interface ValidationResult {
  isValid: boolean
  issues: ValidationIssue[]
  correctedParams?: Record<string, any>
}

interface ValidationIssue {
  field: string
  message: string
  severity: 'error' | 'warning'
  suggestion?: any
}

export function validateQuickbooksParams(
  params: Record<string, any>,
  route?: RouteResult
): ValidationResult {
  const issues: ValidationIssue[] = []
  const corrected = { ...params }

  // Rule 1: compare queryType requires compareType
  if (params.queryType === 'compare' && !params.compareType) {
    issues.push({
      field: 'compareType',
      message: 'compare queryType requires compareType',
      severity: 'error',
      suggestion: 'period',
    })
    corrected.compareType = 'period'
  }

  // Rule 2: entity queryType requires entityType
  if (params.queryType === 'entity' && !params.entityType) {
    issues.push({
      field: 'entityType',
      message: 'entity queryType requires entityType',
      severity: 'error',
      suggestion: 'invoice',
    })
  }

  // Rule 3: metric queryType requires metricName
  if (params.queryType === 'metric' && !params.metricName) {
    issues.push({
      field: 'metricName',
      message: 'metric queryType requires metricName',
      severity: 'error',
    })
  }

  // Rule 4: Check if route suggested different queryType
  if (route?.suggestedQueryType && params.queryType !== route.suggestedQueryType) {
    issues.push({
      field: 'queryType',
      message: `Router suggested '${route.suggestedQueryType}' but agent used '${params.queryType}'`,
      severity: 'warning',
    })
  }

  // Rule 5: Check if route suggested granularity
  if (route?.suggestedGranularity && params.summarizeBy !== route.suggestedGranularity) {
    issues.push({
      field: 'summarizeBy',
      message: `Router detected '${route.suggestedGranularity}' but agent used '${params.summarizeBy || 'Total'}'`,
      severity: 'warning',
    })
    // Auto-correct granularity mismatch
    corrected.summarizeBy = route.suggestedGranularity
  }

  return {
    isValid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
    correctedParams:
      Object.keys(corrected).length > Object.keys(params).length ? corrected : undefined,
  }
}
```

**Integration in agent.ts:**

```typescript
// MODIFIED: src/ai/agent.ts (in customToolNode)

import { validateQuickbooksParams } from './tools/validation'

// Before executing quickbooks_data tool:
if (call.name === 'quickbooksData') {
  const validation = validateQuickbooksParams(call.args, context.queryRoute)

  if (!validation.isValid) {
    logger.warn('[Tools] Invalid quickbooks params', { issues: validation.issues })
    // Return error with guidance
    return new ToolMessage({
      tool_call_id: call.id,
      content: JSON.stringify({
        success: false,
        error: 'Invalid parameters',
        issues: validation.issues,
        suggestion: 'Check required parameters for this queryType',
      }),
    })
  }

  // Apply corrections if any
  if (validation.correctedParams) {
    call.args = validation.correctedParams
    logger.info('[Tools] Auto-corrected params', {
      original: call.args,
      corrected: validation.correctedParams,
    })
  }
}
```

---

### Solution 6: Expand Pattern Coverage (Low Priority)

**Problem:** Only 35 exact patterns; many queries fall to Tier 3.

**Solution:** Add more patterns for common query types.

```typescript
// ADDITIONS to src/ai/router/patterns.ts

// Entity-specific patterns
{
  pattern: /who (is|are) (my )?(top|biggest|largest) (customer|vendor|client)/i,
  intent: 'point_query',
  reports: ['sales'],
  queryType: 'entity',
  entityType: 'customer',
  filters: { sortBy: 'totalAmount', sortOrder: 'desc', limit: 10 },
},
{
  pattern: /which (invoice|invoices|bill|bills) (is|are) (overdue|late|outstanding)/i,
  intent: 'point_query',
  reports: ['aged_receivables'],
  queryType: 'entity',
  entityType: 'invoice',
  filters: { status: 'overdue' },
},

// Metric-specific patterns
{
  pattern: /what('s| is) (my |our )?(dso|days sales outstanding)/i,
  intent: 'point_query',
  reports: [],
  queryType: 'metric',
  metricName: 'dso',
},
{
  pattern: /what('s| is) (my |our )?(current|quick) ratio/i,
  intent: 'point_query',
  reports: ['balance_sheet'],
  queryType: 'metric',
  metricName: 'current_ratio',  // or 'quick_ratio'
},

// Category breakdown patterns
{
  pattern: /(online|offline|digital|physical) (vs|versus|compared to|and) (online|offline|digital|physical)/i,
  intent: 'drill_down',
  reports: ['profit_loss'],
  summarizeBy: 'Total',
  useHierarchy: true,
},

// Forecast patterns
{
  pattern: /(project|forecast|estimate) (my |our )?(cash|revenue|expenses) for (next|the next)/i,
  intent: 'forecast',
  reports: ['cash_flow', 'balance_sheet'],
  queryType: 'metric',
  metricName: 'runway_months',
},
```

---

## Implementation Roadmap

### Phase 1: Quick Wins (1-2 days)

1. **Add `suggestedGranularity` to RouteResult**
   - Modify `types.ts` to add new field
   - Add granularity detection in `matcher.ts`
   - Pass to pre-fetch

2. **Fix pre-fetch to use detected granularity**
   - Modify `contextPreparer.ts` to accept `summarizeBy`
   - Pre-fetch with correct granularity

3. **Add validation in tool node**
   - Create simple validation function
   - Log warnings for mismatches

### Phase 2: Core Improvements (3-5 days)

4. **Add `suggestedQueryType` to patterns**
   - Extend `ExactPattern` type
   - Add queryType to key patterns

5. **Create queryType inference**
   - Build `queryTypeMapper.ts`
   - Integrate with route result

6. **Expand pattern coverage**
   - Add 15-20 new patterns for common gaps
   - Focus on entity and metric queries

### Phase 3: Polish (3-5 days)

7. **Add confidence breakdown**
   - Track why confidence is high/medium/low
   - Use for debugging and improvement

8. **Build evaluation suite**
   - Create test queries with expected routes
   - Measure pattern coverage

9. **Monitor and iterate**
   - Log route results in production
   - Identify patterns to add

---

## Metrics to Track

| Metric                            | Current (Estimated) | Target |
| --------------------------------- | ------------------- | ------ |
| Tier 1 (exact) match rate         | ~40%                | >60%   |
| Tier 2 (keyword) useful rate      | ~30%                | >50%   |
| Tier 3 fallback rate              | ~30%                | <20%   |
| Correct granularity on first call | ~50%                | >85%   |
| Correct queryType on first call   | ~60%                | >90%   |
| Pre-fetch utilization rate        | ~40%                | >70%   |

---

## Quick Wins (Can Implement Today)

### 1. Add Granularity Detection to Router

In `matcher.ts`, add:

```typescript
function detectGranularity(query: string): 'Month' | 'Quarter' | 'Year' | 'Total' {
  const q = query.toLowerCase()
  if (/by month|monthly|mom|each month/i.test(q)) return 'Month'
  if (/by quarter|quarterly|qoq/i.test(q)) return 'Quarter'
  if (/by year|yearly|yoy|annual/i.test(q)) return 'Year'
  return 'Total'
}
```

### 2. Pass Granularity to Pre-fetch

In `contextPreparer.ts`, modify `prefetchReports`:

```typescript
const params = {
  period: route.periods[0] || 'last_year',
  summarizeBy: detectGranularity(originalQuery), // Add this
}
```

### 3. Log Route-to-Tool Mismatch

In `agent.ts`, add after tool call:

```typescript
if (call.name === 'quickbooksData' && context.queryRoute) {
  const route = context.queryRoute
  const params = call.args as any

  if (route.intent === 'comparison' && params.queryType !== 'compare') {
    logger.warn('[Tools] Route-tool mismatch: comparison intent but not compare queryType')
  }
  if (route.intent === 'trend' && !params.summarizeBy) {
    logger.warn('[Tools] Route-tool mismatch: trend intent but no summarizeBy')
  }
}
```

---

## Conclusion

The main branch has a solid **pattern-based routing system** but lacks:

1. **Granularity detection** - doesn't pass `summarizeBy` to pre-fetch or guide agent
2. **Query type mapping** - detects intent but doesn't map to tool's `queryType`
3. **Validation layer** - doesn't catch invalid parameter combinations

Key improvements:

1. **Extend RouteResult** with `suggestedQueryType` and `suggestedGranularity`
2. **Add granularity detection** using keyword patterns
3. **Fix pre-fetch** to use detected granularity
4. **Add tool call validation** to catch and correct mismatches
5. **Expand pattern coverage** for entity and metric queries

These changes will significantly improve first-call accuracy and reduce the need for agent retries.
