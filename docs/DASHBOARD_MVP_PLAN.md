# Dashboard MVP Plan: Unified Data Source Strategy

## Executive Summary

After comprehensive analysis of the codebase, I've identified the data flow architecture and the discrepancies between the Reports pages (which show accurate data) and the Dashboard (which shows incorrect metrics). This document outlines the simplest approach to make the Dashboard use the same reliable data sources as the Reports.

## Current State Analysis

### Single Source of Truth: Report API Endpoints

The Reports pages use these reliable API endpoints that directly call QuickBooks:

1. **Balance Sheet**: `/api/reports/balance-sheet`
   - Source: `src/app/api/reports/balance-sheet/route.ts`
   - Hook: `useBalanceSheet()` from `src/hooks/useReportData.ts`
   - Data flow: QuickBooks API → `provider.reports.balanceSheet()` → Frontend

2. **Profit & Loss**: `/api/reports/profit-loss`
   - Source: `src/app/api/reports/profit-loss/route.ts`
   - Hook: `useProfitLoss()` from `src/hooks/useReportData.ts`
   - Data flow: QuickBooks API → `provider.reports.profitAndLoss()` → Frontend

### Dashboard's Current Approach (Problematic)

The Dashboard currently uses `/api/dashboard` which:

- Attempts to calculate metrics independently using `calculateKeyMetrics()`
- Uses different date ranges and fallback strategies
- Transforms data differently than the report endpoints
- Results in discrepancies with the actual P&L and Balance Sheet reports

### Key Issues Identified

1. **Different Calculation Methods**:
   - Reports: Direct QuickBooks P&L/BS data with minimal transformation
   - Dashboard: Complex calculations in `calculateKeyMetrics()` that may not match QB's logic

2. **Date Range Mismatches**:
   - Reports: User-selected date ranges
   - Dashboard: Multiple fallback strategies (YTD → Last Month → 30 days)

3. **Data Transformation Issues**:
   - Dashboard transforms KPIs differently than reports
   - Revenue calculations don't always match P&L total_income
   - Burn rate and runway calculations may use different periods

## Recommended Solution: MVP Approach

### Option 1: Direct Report API Reuse (SIMPLEST - RECOMMENDED)

**Implementation Steps:**

1. **Modify Dashboard to Call Report APIs Directly**

   ```typescript
   // In useDashboardData.ts or new hook
   const { reportData: pnlData } = useProfitLoss(startDate, endDate)
   const { reportData: bsData } = useBalanceSheet(asOfDate)
   const { reportData: cfData } = useCashFlow(startDate, endDate)
   ```

2. **Extract KPIs from Report Data**

   ```typescript
   // Transform report data to dashboard KPIs
   const kpis = {
     arr: pnlData?.data?.kpis?.totalRevenue * 12, // Annualized
     gross_profit: pnlData?.data?.kpis?.grossProfit,
     gross_margin_pct: pnlData?.data?.kpis?.grossMargin,
     net_profit_margin: (pnlData?.data?.kpis?.netIncome / pnlData?.data?.kpis?.totalRevenue) * 100,
     burn_rate: Math.abs(pnlData?.data?.kpis?.netIncome),
     runway_months: bsData?.data?.kpis?.cashBalance / Math.abs(pnlData?.data?.kpis?.netIncome),
     cash_balance: bsData?.data?.kpis?.cashBalance,
     ocf: cfData?.data?.kpis?.operatingCashFlow,
   }
   ```

3. **Use Report Chart Data**
   - Revenue/Expense Trend: Use `pnlData.data.monthlyTrend`
   - Cash Flow: Use existing daily cash flow from transactions
   - Revenue Breakdown: Use `pnlData.data.revenueByCategory`

### Option 2: Shared Report Helpers (More Work, Better Long-term)

1. **Create Shared Data Fetcher**

   ```typescript
   // src/lib/services/financialDataService.ts
   export async function fetchFinancialData(orgId, dateRange) {
     // Single function that both reports and dashboard use
     const [pnl, bs, cf] = await Promise.all([
       provider.reports.profitAndLoss(...),
       provider.reports.balanceSheet(...),
       provider.reports.cashFlow(...)
     ]);
     return { pnl, bs, cf };
   }
   ```

2. **Unified KPI Calculator**
   ```typescript
   // src/lib/utils/kpiCalculator.ts
   export function calculateStandardKPIs(pnl, bs, cf) {
     // Single source for all KPI calculations
     return {
       revenue: pnl.total_income,
       expenses: pnl.total_expenses,
       netIncome: pnl.net_income,
       grossProfit: pnl.gross_profit,
       // ... etc
     }
   }
   ```

## Implementation Priority

### Phase 1: Quick Win (1-2 days)

1. Modify dashboard page to use existing report hooks
2. Map report data to dashboard KPI format
3. Test that dashboard numbers match reports exactly

### Phase 2: Optimization (3-5 days)

1. Add caching layer if not already present
2. Implement parallel data fetching
3. Add loading states for better UX

### Phase 3: Enhancement (Optional)

1. Create unified data service
2. Standardize all calculations
3. Add data validation layer

## Code Changes Required

### 1. Dashboard Page (`src/app/(main)/dashboard/page.tsx`)

```typescript
// Replace useDashboardDataProgressive with:
const { reportData: pnlData } = useProfitLossData({
  startDate: getStartDate(chartPeriod),
  endDate: new Date().toISOString().split('T')[0],
  enabled: true,
})

const { reportData: bsData } = useBalanceSheet(new Date().toISOString().split('T')[0])
```

### 2. KPI Transformation

```typescript
// New function to transform report data to dashboard KPIs
function transformReportDataToKPIs(pnlData, bsData, cfData) {
  if (!pnlData?.data || !bsData?.data) return []

  return [
    {
      metric: 'arr',
      value: (pnlData.data.kpis.totalRevenue || 0) * 12,
      // ... other fields
    },
    {
      metric: 'gross_profit',
      value: pnlData.data.kpis.grossProfit || 0,
      // ... other fields
    },
    // ... etc
  ]
}
```

### 3. Chart Data Mapping

```typescript
// Use report data directly for charts
const chartData = {
  revenueExpenseTrend: pnlData?.data?.monthlyTrend || [],
  expenseBreakdown: pnlData?.data?.expenseCategories || [],
  revenueBreakdown: pnlData?.data?.revenueByCategory || [],
}
```

## Benefits of This Approach

1. **Immediate Accuracy**: Dashboard will show exact same numbers as reports
2. **Single Source of Truth**: No duplicate calculation logic
3. **Easier Maintenance**: Changes to calculations only need to happen in one place
4. **Better Caching**: Can leverage existing report caching
5. **Reduced API Calls**: Can share data between components

## Testing Strategy

1. **Number Verification**:
   - Compare dashboard KPIs with report page values
   - All numbers should match exactly

2. **Date Range Testing**:
   - Test different periods (3mo, 6mo, 12mo)
   - Verify data updates correctly

3. **Performance Testing**:
   - Measure load times
   - Verify caching works

## Migration Path

1. **Week 1**: Implement Phase 1 changes
2. **Week 2**: Test and validate accuracy
3. **Week 3**: Deploy to staging
4. **Week 4**: Monitor and optimize

## Risk Mitigation

- **Risk**: Slower initial load
  - **Mitigation**: Implement progressive loading with SWR

- **Risk**: Breaking existing functionality
  - **Mitigation**: Feature flag the new implementation

- **Risk**: Cache invalidation issues
  - **Mitigation**: Use same cache keys as reports

## Conclusion

The simplest and most effective approach is to have the Dashboard directly use the same Report API endpoints that are already proven to work correctly. This eliminates the need for duplicate calculation logic and ensures consistency across the application.

**Recommended Next Step**: Start with Option 1 (Direct Report API Reuse) as it requires minimal code changes and provides immediate accuracy improvements.
