# Cash Flow Summary Cards - Complete Data Flow Analysis

## Overview

This document traces the complete data flow for the Cash Flow summary cards displayed in `/reports` Cash Flow view, from the QuickBooks API call through transformation to the frontend display.

---

## 1. Frontend Data Fetching

### Component: `CashFlowView.tsx`

**Location:** `/src/app/(main)/reports/views/CashFlowView.tsx`

**Hook Usage:**

```typescript
const { reportData, isLoading, isValidating, error, mutate } = useCashFlow(
  dateRange.start,
  dateRange.end
)
```

**Data Extraction (lines 238-244):**

```typescript
const data = reportData?.data || {}
const operatingCashFlow = data.kpis?.operatingCashFlow || 0
const investingCashFlow = data.kpis?.investingCashFlow || 0
const financingCashFlow = data.kpis?.financingCashFlow || 0
const netCashFlow = data.kpis?.netCashFlow || 0
const cashBeginning = data.kpis?.cashBeginning || 0
const cashEnding = data.kpis?.cashEnding || 0
```

---

## 2. SWR Hook Implementation

### Hook: `useCashFlow`

**Location:** `/src/hooks/useReportData.ts` (lines 328-348)

**API Endpoint Called:**

```typescript
;`/api/quickbooks/reports/cash-flow?${params.toString()}`
```

**Query Parameters:**

- `start`: Start date (YYYY-MM-DD format)
- `end`: End date (YYYY-MM-DD format)
- `details`: `"true"` (always included to fetch activity breakdowns)

**Configuration:**

- Uses SWR for automatic caching and revalidation
- Automatically refetches when date range changes
- Includes loading, validation, and error states

---

## 3. API Route Handler

### Route: `/api/quickbooks/reports/cash-flow/route.ts`

**Location:** `/src/app/api/quickbooks/reports/cash-flow/route.ts`

#### 3.1 QuickBooks API Calls

The handler makes **three separate QuickBooks API calls**:

**Call 1: Cash Flow Report**

```typescript
// Line 198-200
const rawCfReport = await withRetry(() =>
  client.request(`/reports/CashFlow?${cfParams.toString()}`)
)
```

- **Endpoint:** QuickBooks `/reports/CashFlow`
- **Parameters:**
  - `start_date`: Query start date
  - `end_date`: Query end date
  - `minorversion`: "65"

**Call 2: Profit & Loss Report**

```typescript
// Line 272-274
const rawPlReport = await withRetry(() =>
  client.request(`/reports/ProfitAndLoss?${plParams.toString()}`)
)
```

- **Endpoint:** QuickBooks `/reports/ProfitAndLoss`
- **Used for:** Net income, revenue, COGS, and expense data

**Call 3: Balance Sheet Report**

```typescript
// Line 345-347
const rawBsReport = await withRetry(() =>
  client.request(`/reports/BalanceSheet?${bsParams.toString()}`)
)
```

- **Endpoint:** QuickBooks `/reports/BalanceSheet`
- **Used for:** Total liabilities data

**Additional Data Source:**

```typescript
// Line 312
const cashBalance = await getCashAndEquivalents(organizationId)
```

- Gets current cash balance from bank accounts

#### 3.2 Data Parsing

**Cash Flow Report Parsing (lines 212-263):**

```typescript
const cfData: any = {
  net_cash_from_operating_activities: 0,
  net_cash_from_investing_activities: 0,
  net_cash_from_financing_activities: 0,
  cash_at_beginning: 0,
  cash_at_end: 0,
}

// Iterate through report rows to extract values
const cfRows = rawCfReport?.Rows?.Row || []
for (const section of cfRows) {
  const sectionType = section.group || section.Header?.ColData?.[0]?.value || ''
  const sectionTotal = section.Summary?.ColData?.[1]?.value

  // Match section types and extract totals
  if (
    sectionType.includes('OperatingActivities') ||
    sectionType.toLowerCase().includes('operating')
  ) {
    cfData.net_cash_from_operating_activities = parseFloat(sectionTotal) || 0
  } else if (
    sectionType.includes('InvestingActivities') ||
    sectionType.toLowerCase().includes('investing')
  ) {
    cfData.net_cash_from_investing_activities = parseFloat(sectionTotal) || 0
  } else if (
    sectionType.includes('FinancingActivities') ||
    sectionType.toLowerCase().includes('financing')
  ) {
    cfData.net_cash_from_financing_activities = parseFloat(sectionTotal) || 0
  }

  // Extract beginning/ending cash balances
  const headerLabel = section.Header?.ColData?.[0]?.value?.toLowerCase() || ''
  const dataLabel = section.ColData?.[0]?.value?.toLowerCase() || ''
  const label = headerLabel || dataLabel

  if (label.includes('beginning') && label.includes('cash')) {
    const value =
      section.Summary?.ColData?.[section.Summary.ColData.length - 1]?.value ||
      section.ColData?.[section.ColData.length - 1]?.value
    cfData.cash_at_beginning = parseFloat(value) || 0
  }

  if (label.includes('end') && label.includes('cash')) {
    const value =
      section.Summary?.ColData?.[section.Summary.ColData.length - 1]?.value ||
      section.ColData?.[section.ColData.length - 1]?.value
    cfData.cash_at_end = parseFloat(value) || 0
  }
}
```

**P&L Report Parsing (lines 276-309):**

```typescript
const plData: any = {
  net_income: 0,
  total_income: 0,
  cogs_total: 0,
  total_expenses: 0,
  other_expenses: 0,
  cost_of_goods_sold: 0,
}

const plRows = rawPlReport?.Rows?.Row || []
for (const section of plRows) {
  const sectionType = section.group || ''
  const sectionTotal = parseFloat(section.Summary?.ColData?.[1]?.value) || 0

  if (sectionType === 'Income') plData.total_income = sectionTotal
  else if (sectionType === 'COGS') plData.cogs_total = sectionTotal
  else if (sectionType === 'Expenses') plData.total_expenses = sectionTotal
  else if (sectionType === 'OtherExpenses') plData.other_expenses = sectionTotal
  else if (sectionType === 'NetIncome') plData.net_income = sectionTotal
}
```

**Balance Sheet Parsing (lines 349-358):**

```typescript
const bsData: any = { total_liabilities: 0 }
const bsRows = rawBsReport?.Rows?.Row || []
for (const section of bsRows) {
  const sectionType = section.group || ''
  if (sectionType === 'Liabilities' || sectionType.includes('Liabilities')) {
    bsData.total_liabilities = parseFloat(section.Summary?.ColData?.[1]?.value) || 0
    break
  }
}
```

#### 3.3 Transformer Usage

**transformCashFlow Function Call (line 392):**

```typescript
const normalizedCF = transformCashFlow(rawCfReport)
```

**What the transformer does:**

- Located at: `/src/quickbooks/reports/transformers.ts` (lines 392-481)
- Parses QuickBooks report structure into normalized format
- Extracts operating, investing, and financing activity line items
- Calculates beginning/ending cash balances
- Returns `NormalizedCashFlow` object with:
  - `operatingActivities.lines` and `.total`
  - `investingActivities.lines` and `.total`
  - `financingActivities.lines` and `.total`
  - `beginningCash` and `endingCash`

**Note:** The transformer is used primarily for **detailed activity breakdowns**. The summary card KPIs come from direct parsing of the raw report.

#### 3.4 KPI Calculation

**Net Cash Flow Calculation (lines 386-389):**

```typescript
const netCashFlow =
  (cfData.net_cash_from_operating_activities || 0) +
  (cfData.net_cash_from_investing_activities || 0) +
  (cfData.net_cash_from_financing_activities || 0)
```

**Cash Balance Sources (lines 427-432):**

```typescript
// Primary: QB Cash Flow report values
// Fallback 1: Transformer values
// Fallback 2: Current bank balance

const endingCashValue = cfData.cash_at_end || normalizedCF.endingCash || cashBalance

const beginningCashValue =
  cfData.cash_at_beginning || normalizedCF.beginningCash || endingCashValue - netCashFlow
```

**Priority order for cash balances:**

1. QuickBooks Cash Flow report (most accurate for the period)
2. Transformer-parsed values (backup)
3. Current bank balance / derived calculation (last resort)

#### 3.5 Response Structure

**Final KPIs Object (lines 478-485):**

```typescript
kpis: {
  operatingCashFlow: cfData.net_cash_from_operating_activities || 0,
  investingCashFlow: cfData.net_cash_from_investing_activities || 0,
  financingCashFlow: cfData.net_cash_from_financing_activities || 0,
  netCashFlow,
  cashBeginning: beginningCashValue,
  cashEnding: endingCashValue,
}
```

**Complete Response (lines 469-517):**

```typescript
{
  reportType: 'cash_flow',
  organizationId: string,
  organizationName: string,
  fromDate: string,
  toDate: string,
  currency: string,
  generated: string,
  data: {
    kpis: { ... },                       // Summary card values
    cashMetrics: { ... },                // Advanced metrics
    operatingActivities: [...],          // Detailed breakdown
    investingActivities: [...],          // Detailed breakdown
    financingActivities: [...],          // Detailed breakdown
    waterfallChart: [...],               // Chart data
    errors: [...] | undefined,           // Any errors
    metadata: { ... }                    // Data quality info
  }
}
```

---

## 4. Type Definitions

### CashFlowKPIs Interface

**Location:** `/src/types/cashflow.ts` (lines 16-24)

```typescript
export interface CashFlowKPIs {
  operatingCashFlow: number // Net cash from operating activities
  investingCashFlow: number // Net cash from investing activities
  financingCashFlow: number // Net cash from financing activities
  netCashFlow: number // Sum of all three categories
  cashBeginning: number // Cash at beginning of period
  cashEnding: number // Cash at end of period
  cash_balance: number // Alias for cashEnding
}
```

---

## 5. Data Flow Summary

### Complete Flow Diagram

```
User selects date range
        ↓
CashFlowView.tsx calls useCashFlow(start, end)
        ↓
SWR fetches /api/quickbooks/reports/cash-flow?start=X&end=Y&details=true
        ↓
API Route Handler:
  ├─ Calls QuickBooks /reports/CashFlow API
  ├─ Calls QuickBooks /reports/ProfitAndLoss API
  ├─ Calls QuickBooks /reports/BalanceSheet API
  └─ Gets current cash balance from accounts
        ↓
Parse raw QuickBooks responses:
  ├─ Extract operating/investing/financing totals
  ├─ Extract beginning/ending cash balances
  ├─ Extract detailed activity line items
  └─ Calculate net cash flow
        ↓
Transform raw report (transformCashFlow):
  ├─ Normalize section structures
  ├─ Parse activity line items
  └─ Return NormalizedCashFlow object
        ↓
Build response with KPIs:
  {
    kpis: {
      operatingCashFlow: [from QB Cash Flow report],
      investingCashFlow: [from QB Cash Flow report],
      financingCashFlow: [from QB Cash Flow report],
      netCashFlow: [calculated sum],
      cashBeginning: [from QB or derived],
      cashEnding: [from QB or derived]
    }
  }
        ↓
Return JSON response to frontend
        ↓
CashFlowView extracts reportData.data.kpis
        ↓
Pass to CashFlowMetricsGrid component
        ↓
Display summary cards
```

---

## 6. Key Insights

### 6.1 Data Sources

- **Primary source:** QuickBooks Cash Flow report (`/reports/CashFlow`)
- **Supplementary:** P&L (for expenses/income), Balance Sheet (for liabilities), Account queries (for cash balance)

### 6.2 Calculation Logic

- **Operating/Investing/Financing totals:** Directly from QB Cash Flow report section summaries
- **Net Cash Flow:** Calculated sum of the three categories
- **Beginning/Ending Cash:** Parsed from QB report rows (with fallback to derived values)

### 6.3 Transformer Role

- **Not used for summary cards** - KPIs come from direct parsing
- **Used for:** Detailed activity breakdowns, normalized data structure, fallback values

### 6.4 Data Quality Handling

- Multiple fallback sources for cash balances
- Validation checks for data consistency
- Error tracking in metadata
- Logging at key points for debugging

### 6.5 Performance Optimizations

- Uses `withRetry()` wrapper for API calls
- Request caching via Map
- SWR automatic caching on frontend
- Separate endpoint for monthly trend data

---

## 7. Important Code Locations

| Component            | Location                                             | Lines            |
| -------------------- | ---------------------------------------------------- | ---------------- |
| Frontend Hook        | `/src/hooks/useReportData.ts`                        | 328-348          |
| View Component       | `/src/app/(main)/reports/views/CashFlowView.tsx`     | 28-30, 238-244   |
| API Route Handler    | `/src/app/api/quickbooks/reports/cash-flow/route.ts` | 110-595          |
| Cash Flow Parsing    | Same as above                                        | 212-263          |
| KPI Calculation      | Same as above                                        | 386-389, 478-485 |
| Transformer Function | `/src/quickbooks/reports/transformers.ts`            | 392-481          |
| Type Definitions     | `/src/types/cashflow.ts`                             | 16-24, 52-72     |

---

## 8. QuickBooks Report Structure

### Cash Flow Report Row Structure

```javascript
{
  Rows: {
    Row: [
      {
        group: 'OperatingActivities',
        Summary: {
          ColData: [
            { value: 'Net Cash from Operating Activities' },
            { value: '12500.00' }, // ← This becomes operatingCashFlow
          ],
        },
      },
      {
        group: 'InvestingActivities',
        Summary: {
          ColData: [
            { value: 'Net Cash from Investing Activities' },
            { value: '-5000.00' }, // ← This becomes investingCashFlow
          ],
        },
      },
      {
        group: 'FinancingActivities',
        Summary: {
          ColData: [
            { value: 'Net Cash from Financing Activities' },
            { value: '2500.00' }, // ← This becomes financingCashFlow
          ],
        },
      },
      {
        ColData: [
          { value: 'Cash at Beginning of Period' },
          { value: '10000.00' }, // ← This becomes cashBeginning
        ],
      },
      {
        ColData: [
          { value: 'Cash at End of Period' },
          { value: '20000.00' }, // ← This becomes cashEnding
        ],
      },
    ]
  }
}
```

### Parsing Logic

1. **Section summaries:** Look for `section.Summary.ColData[1].value`
2. **Cash balances:** Look for rows with "beginning"/"end" + "cash" in labels
3. **Values can be in:** `Summary.ColData` (section totals) OR `ColData` (standalone rows)

---

## End of Analysis
