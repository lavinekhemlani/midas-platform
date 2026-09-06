# END-TO-END FLOW: "What's my runway?" Query Processing

**Query**: `"What's my runway?"`
**Date**: 2025-12-16
**System**: Zenith OS AI Financial Assistant (Midas)

---

## 🎯 COMPLETE EXECUTION PATH

### **STEP 1: Router (Pattern Matching)**

**File**: `/src/ai/router/matcher.ts`

**Function Flow**:

1. `routeQuery("What's my runway?")` → Main entry point
2. Normalizes query: `"what's my runway?"` (lowercase, trimmed)
3. `tryExactPatterns()` → Tier 1 matching

**Pattern Match** (Line 173 in `/src/ai/router/patterns.ts`):

```javascript
{
  pattern: /^(what('s| is)|how much is)( my| our| the)? (cash )?runway/i,
  intent: 'forecast',
  reports: ['cash_flow', 'balance_sheet']
}
```

**Router Output**:

```javascript
{
  intent: 'forecast',
  reports: ['cash_flow', 'balance_sheet'],
  periods: ['this_year'],  // Default when no period specified
  memoryTypes: ['expense', 'income', 'goal'],  // From INTENT_MEMORY_ALIGNMENT
  confidence: 'high',
  matchedTier: 'exact',
  matchedPattern: '^(what('s| is)|how much is)( my| our| the)? (cash )?runway'
}
```

---

### **STEP 2: Context Preparer (Data Pre-fetching)**

**File**: `/src/ai/router/contextPreparer.ts`

**Process**:

1. Receives router result with `reports: ['cash_flow', 'balance_sheet']`
2. **Likely pre-fetches** both reports in parallel:
   - Fetches Cash Flow report (YTD by default)
   - Fetches Balance Sheet (as of today)
3. Formats data for agent context
4. Retrieves relevant memories based on `memoryTypes: ['expense', 'income', 'goal']`

**Output**: Pre-loaded financial data + prepared memories ready for agent context

---

### **STEP 3: Agent (LLM Decision Making)**

**File**: `/src/ai/agent.ts`

**System Prompt Includes**:

```
## Tools
1. **quickbooks_data** - Intelligent QuickBooks data retrieval

   **Metrics** (33 KPIs via metricName parameter):
   - Cash Flow: operating_cash_flow, free_cash_flow, burn_rate, runway_months, cash_flow_margin

   **Reports** (reportType parameter):
   - 'cash_flow' - Cash Balance, Operating, investing, financing activities

## Pre-loaded Financial Data
The following data has been pre-loaded based on your query analysis:
[Cash Flow Report Data]
[Balance Sheet Data]
```

**Agent Decision Path**:

The agent has **3 possible approaches**:

#### **Option A: Use Pre-fetched Data (Most Likely)**

- Agent sees pre-loaded cash_flow report in system prompt
- Extracts `runway_months` from `enriched.cashMetrics.runway_months`
- Directly answers without calling tools
- **Fastest path** (~1-2 seconds)

#### **Option B: Direct Metric Query**

```javascript
quickbooks_data({
  queryType: 'metric',
  metricName: 'runway_months',
  period: 'ytd',
})
```

- Goes through query-planner → handlers.ts → handleMetricQuery
- Fetches cash_flow report
- Extracts pre-calculated `runway_months` from KPIs
- **Medium speed** (~3-5 seconds)

#### **Option C: Full Report Query + Manual Calculation**

```javascript
quickbooks_data({
  queryType: 'report',
  reportType: 'cash_flow',
  period: 'ytd',
})
```

- Gets full cash flow report with `summary.runwayMonths`
- Alternative: Uses `financial_calculator` tool with explicit inputs
- **Slowest path** (~5-10 seconds)

---

### **STEP 4A: Query Planner (If Tool Called)**

**File**: `/src/ai/tools/quickbooks-data/query-planner.ts`

**For Metric Query** (`queryType: 'metric'`):

1. **Intent Detection**:

```javascript
detectMetricIntent(input) → {
  intent: 'metric_calculation',
  confidence: 0.97,
  suggestedReports: ['cash_flow'],  // From METRIC_DEPENDENCIES
  suggestedMetrics: ['runway_months'],
  estimatedComplexity: 'medium',
  requiresMultipleDataSources: false
}
```

2. **Query Plan**:

```javascript
{
  queryType: 'metric',
  operations: [{
    type: 'fetch',
    target: 'cash_flow',
    params: {
      startDate: '2025-01-01',
      endDate: '2025-12-16',
      period: 'ytd'
    }
  }],
  dataSources: ['cash_flow'],
  metadata: {
    intent: 'metric_calculation',
    metricName: 'runway_months'
  }
}
```

---

### **STEP 4B: Handler Execution**

**File**: `/src/ai/tools/quickbooks-data/handlers.ts`

**Function**: `handleMetricQuery()`

**Process** (Lines 360-439):

1. Gets metric definition from `METRICS_REGISTRY['runway_months']`
2. Identifies required sources: `['cash_flow']`
3. Calls `fetchEnrichedReport('cash_flow', params, config)`

---

### **STEP 5: Report Accessor**

**File**: `/src/ai/tools/quickbooks-data/report-accessor.ts`

**Function**: `fetchCashFlow()` (Lines 391-480)

**Execution Flow**:

1. **Date Range Resolution**:
   - Input: `period: 'ytd'` or default `'this_year'`
   - Calculates: `startDate: '2025-01-01'`, `endDate: '2025-12-16'`

2. **Raw Data Fetch**:

   ```javascript
   const rawReport = await qbClient.getCashFlow({
     start_date: '2025-01-01',
     end_date: '2025-12-16',
   })
   ```

3. **Transform to Normalized Format**:

   ```javascript
   const normalizedCashFlow = transformCashFlow(rawReport)
   ```

4. **Fetch P&L for Enrichment**:

   ```javascript
   const rawPL = await qbClient.getProfitAndLoss({
     start_date: '2025-01-01',
     end_date: '2025-12-16',
   })
   ```

5. **Call Enricher**:

   ```javascript
   const enriched = await enrichCashFlow({
     organizationId,
     normalizedCashFlow,
     profitAndLoss: {
       total_income: normalizedPL.income.total,
       total_expenses: normalizedPL.expenses.total,
       net_income: normalizedPL.netIncome,
       cogs_total: normalizedPL.costOfGoodsSold.total,
     },
   })
   ```

6. **Return Enriched Data**:
   ```javascript
   return {
     success: true,
     reportType: 'cash_flow',
     data: {
       kpis: enriched.kpis,
       metadata: enriched.cashMetrics, // Contains runway_months
     },
     summary: {
       burnRate: enriched.cashMetrics.burn_rate,
       runwayMonths: enriched.cashMetrics.runway_months, // ← THE ANSWER
     },
     currency: 'USD',
     fromDate: '2025-01-01',
     toDate: '2025-12-16',
   }
   ```

---

### **STEP 6: Cash Flow Enricher (THE CALCULATION)**

**File**: `/src/quickbooks/reports/enrichers/cash-flow.ts`

**Function**: `enrichCashFlow()` (Lines 242-405)

#### **Critical Calculation Steps**:

**A. Extract Cash Balance** (Lines 266-272):

```javascript
let cashBalance = kpis.cashEnding // From normalized cash flow
try {
  cashBalance = await getCashAndEquivalents(organizationId) // Live balance
} catch {
  // Use ending cash from report
}
```

**B. Calculate TRUE Total Expenses** (Lines 274-279):

```javascript
const trueTotalExpenses = calculateTotalExpenses(
  profitAndLoss.cogs_total || 0, // Cost of Goods Sold
  profitAndLoss.total_expenses || 0, // Operating Expenses
  profitAndLoss.other_expenses || 0 // Other Expenses
)
```

**C. Calculate Period & Monthly Expenses** (Lines 282-288):

```javascript
const startDate = new Date(normalizedCashFlow.startDate) // 2025-01-01
const endDate = new Date(normalizedCashFlow.endDate) // 2025-12-16
const periodMonths = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24 * 30))) // ~11.5 months

const monthlyExpenses = trueTotalExpenses / periodMonths
```

**D. Call Cash Flow Metrics Calculator** (Line 325):

```javascript
const cashMetrics = calculateCashFlowMetrics(
  cashBalance, // Current cash
  monthlyExpenses, // Monthly burn
  operatingCashFlow, // OCF from cash flow statement
  currentLiabilities,
  capitalExpenditures,
  revenue,
  daysReceivable,
  daysPayable,
  daysInventory,
  totalDebt,
  trueTotalExpenses,
  periodMonths
)
```

**E. Runway Calculation** (Lines 188-192 in `calculateCashFlowMetrics`):

```javascript
const burnRate = -Math.abs(monthlyExpenses) // Always negative
const runwayMonths = burnRate !== 0 ? cashBalance / Math.abs(burnRate) : 999 // Infinite if no expenses

return {
  burn_rate: toTwoDecimals(burnRate),
  runway_months: toTwoDecimals(Math.min(runwayMonths, 999)),
}
```

**Formula**:

```
runway_months = cash_balance / |monthly_expenses|

Where:
- cash_balance = Live cash from getCashAndEquivalents() OR ending cash from report
- monthly_expenses = total_expenses / period_months
- total_expenses = COGS + Operating Expenses + Other Expenses
```

---

### **STEP 7: Alternative Calculation (Formula Library)**

**File**: `/src/lib/kpis/formulas/cashflow.ts`

**Functions**:

1. **`calculateRunway()`** (Lines 169-178):

   ```javascript
   export function calculateRunway(data: FinancialData): number {
     const cashBalance = calculateCashBalance(data)
     const grossBurnRate = calculateGrossBurnRate(data)

     if (grossBurnRate <= 0 || cashBalance <= 0) return 0

     const runwayMonths = cashBalance / grossBurnRate
     return Math.round(runwayMonths)
   }
   ```

2. **`calculateGrossBurnRate()`** (Lines 134-139):

   ```javascript
   export function calculateGrossBurnRate(data: FinancialData): number {
     const periodMonths = data.period?.months || 1
     const monthlyExpenses = (data.pnl?.total_expenses || 0) / periodMonths

     return Math.round(Math.abs(monthlyExpenses) * 100) / 100
   }
   ```

3. **`calculateCashBalance()`** (Lines 184-209):

   ```javascript
   export function calculateCashBalance(data: FinancialData): number {
     // Priority 1: Cash flow statement ending balance
     if (data.cashFlow?.cash_at_end !== undefined) {
       return Math.round(data.cashFlow.cash_at_end * 100) / 100
     }

     // Priority 2: Balance sheet cash and equivalents
     if (data.balanceSheet?.cash_and_equivalents !== undefined) {
       return Math.round(data.balanceSheet.cash_and_equivalents * 100) / 100
     }

     // Priority 3: Sum of bank account balances
     if (data.bankAccounts && data.bankAccounts.length > 0) {
       const totalCash = data.bankAccounts
         .filter(account =>
           account.type === 'Bank' ||
           account.type === 'Cash'
         )
         .reduce((sum, account) => sum + (account.balance || 0), 0)
       return Math.round(totalCash * 100) / 100
     }

     return 0
   }
   ```

**Note**: This formula library is used by the **financial_calculator** tool (Option C) if the agent chooses to calculate manually.

---

### **STEP 8: Handler Returns Result**

**File**: `/src/ai/tools/quickbooks-data/handlers.ts`

**Return Value** (Lines 416-438):

```javascript
return {
  success: true,
  queryType: 'metric',
  data: {
    metricName: 'Cash Runway',
    metricId: 'runway_months',
    value: 14.73, // EXAMPLE: toTwoDecimals(runwayMonths)
    formattedValue: '14.73 months',
    unit: 'months',
    category: 'Cash Flow',
    description: 'Months until cash runs out at current burn rate',
  },
  summary: {
    value: 14.73,
    metric: 'Runway',
  },
  currency: 'USD',
  sources: ['cash_flow'],
  metadata: {
    interpretation: 'Shows how many months the company can operate...',
  },
  generated: '2025-12-16T10:30:00.000Z',
}
```

---

### **STEP 9: Agent Generates Response**

**File**: `/src/ai/agent.ts`

**Agent receives tool result and generates natural language response**:

**Example Response**:

```
Your cash runway is 14.7 months.

Based on your current cash balance of $450,000 and monthly burn rate
of $30,500, you have approximately 14.7 months of runway.

This is calculated as:
- Current cash: $450,000
- Monthly expenses: $30,500 (COGS + Operating + Other)
- Runway: $450,000 / $30,500 = 14.7 months

Your runway is healthy - companies typically aim for 12+ months to
maintain financial stability.
```

---

## 📊 DATA SOURCES & DEPENDENCIES

### **Primary Data Sources**:

1. **Cash Flow Statement** (QuickBooks API)
   - Operating activities
   - Investing activities
   - Financing activities
   - Beginning/ending cash

2. **Profit & Loss Statement** (QuickBooks API)
   - COGS (Cost of Goods Sold)
   - Operating expenses
   - Other expenses
   - Total income

3. **Live Cash Balance** (QuickBooks Chart of Accounts)
   - Bank account balances
   - Cash equivalents

### **Metric Dependencies** (From `metrics-registry.ts`):

```javascript
runway_months: ['cash_flow']
burn_rate: ['cash_flow']
operating_cash_flow: ['cash_flow']
free_cash_flow: ['cash_flow']
```

---

## 🔄 ALTERNATIVE PATHS

### **Path 1: Pre-fetched Data (Fastest)**

```
User Query → Router → Context Preparer (pre-fetch) → Agent → Direct Answer
Time: 1-2 seconds
```

### **Path 2: Metric Query (Medium)**

```
User Query → Router → Agent → quickbooks_data(metric) → Query Planner
→ Handler → Report Accessor → Enricher → Agent → Response
Time: 3-5 seconds
```

### **Path 3: Report Query (Detailed)**

```
User Query → Router → Agent → quickbooks_data(report) → Query Planner
→ Handler → Report Accessor → Enricher → Agent → Response
Time: 5-10 seconds
```

### **Path 4: Calculator Tool (Manual)**

```
User Query → Router → Agent → quickbooks_data(report) → Get cash + expenses
→ financial_calculator(runway) → Agent → Response
Time: 5-10 seconds
```

---

## 🧮 CALCULATION BREAKDOWN

### **ACTUAL RUNWAY CALCULATION**:

**Input Data**:

- Cash Balance: `$450,000` (from QuickBooks)
- Period: Jan 1, 2025 - Dec 16, 2025 (11.5 months)
- Total Expenses: `$350,750`
  - COGS: `$120,000`
  - Operating: `$200,000`
  - Other: `$30,750`

**Calculation Steps**:

```javascript
// Step 1: Calculate monthly expenses
periodMonths = 11.5
monthlyExpenses = $350,750 / 11.5 = $30,500

// Step 2: Calculate burn rate (always negative)
burnRate = -Math.abs($30,500) = -$30,500

// Step 3: Calculate runway
runwayMonths = $450,000 / Math.abs(-$30,500)
            = $450,000 / $30,500
            = 14.75 months

// Step 4: Round to 2 decimals
runway_months = 14.75
```

**Result**: `14.75 months` of runway

---

## 🎯 KEY FILES SUMMARY

| File                     | Purpose             | Key Function                              |
| ------------------------ | ------------------- | ----------------------------------------- |
| `router/matcher.ts`      | Pattern matching    | `routeQuery()` - Matches "runway" pattern |
| `router/patterns.ts`     | Pattern definitions | Runway pattern at line 173                |
| `agent.ts`               | AI orchestration    | Decides which tool to call                |
| `query-planner.ts`       | Query optimization  | Plans optimal data fetching               |
| `handlers.ts`            | Query execution     | `handleMetricQuery()` for metrics         |
| `report-accessor.ts`     | Report fetching     | `fetchCashFlow()` - Gets raw data         |
| `enrichers/cash-flow.ts` | Business logic      | `enrichCashFlow()` - **THE CALCULATION**  |
| `formulas/cashflow.ts`   | Calculation library | `calculateRunway()` - Alternative method  |
| `calculator.ts`          | Financial tools     | Manual runway calculation option          |

---

## ✅ VERIFICATION POINTS

**To verify the calculation is correct**:

1. **Check Cash Balance**:

   ```sql
   SELECT SUM(balance) FROM accounts WHERE type IN ('Bank', 'Cash')
   ```

2. **Check Total Expenses**:

   ```sql
   SELECT SUM(amount) FROM transactions
   WHERE type = 'expense'
   AND date BETWEEN '2025-01-01' AND '2025-12-16'
   ```

3. **Verify Calculation**:

   ```javascript
   runway = cashBalance / (totalExpenses / periodMonths)
   ```

4. **Compare with QuickBooks**:
   - Cash Flow Report → Ending Cash Balance
   - P&L Report → Total Expenses
   - Manually calculate: Cash / (Expenses / Months)

---

## 🐛 POTENTIAL ISSUES

1. **Period Miscalculation**: If period months is wrong, burn rate will be inaccurate
2. **Missing Expenses**: If COGS or Other Expenses not included, runway will be inflated
3. **Stale Cash Balance**: If using report ending cash instead of live balance
4. **Zero Expenses**: Division by zero handled with `999` (infinite runway)
5. **Negative Cash**: Not explicitly handled, will return negative runway

---

## 📝 NOTES

- Default period is **Year-to-Date (YTD)** when not specified
- Calculation uses **gross burn rate** (all expenses) not net burn (expenses - revenue)
- Runway capped at **999 months** to avoid infinity
- All currency values rounded to **2 decimal places**
- Agent can use **pre-fetched data** to avoid redundant API calls
- Router pre-fetches **cash_flow + balance_sheet** for runway queries
