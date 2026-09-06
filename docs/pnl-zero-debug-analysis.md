# P&L API Zero Values Debug Analysis

## Problem Summary

- Frontend shows all zeros for revenue, expenses, net income
- API returns 200 OK
- Cash balance is correctly fetched: -2755484.91
- But P&L KPIs show zeros

## Data Flow Analysis

### 1. API Route (`/src/app/api/quickbooks/reports/profit-loss/route.ts`)

**Line 107-109**: Fetches raw P&L from QuickBooks API

```typescript
const rawReport = await withRetry(() =>
  client.request(`/reports/ProfitAndLoss?${reportParams.toString()}`)
)
```

**Line 112**: Normalizes raw QB data

```typescript
const normalized = transformProfitAndLoss(rawReport)
```

**Line 124-130**: Enriches normalized data with business logic

```typescript
const enriched = await enrichProfitAndLoss(normalized, organizationId, {
  includeDetails,
  startDate,
  endDate,
  currency,
  organizationName,
})
```

**Line 138**: Returns enriched data to frontend

```typescript
return NextResponse.json(enriched)
```

### 2. Transform Function (`/src/quickbooks/reports/transformers.ts`)

**Lines 190-264**: `transformProfitAndLoss()` function

Key operations:

- **Line 195-199**: Finds sections (Income, COGS, Expenses, OtherIncome, OtherExpenses)
- **Line 202-210**: Processes each section using `processSection()`
- **Line 213-215**: Calculates derived values:
  ```typescript
  const grossProfit = income.total - cogs.total
  const netOperatingIncome = grossProfit - expenses.total
  const netIncome = netOperatingIncome + otherIncome.total - otherExpenses.total
  ```
- **Line 225-263**: Returns normalized structure with income, COGS, expenses, etc.

**POTENTIAL ISSUE #1**: `findSection()` function (lines 136-172)

- Uses case-insensitive matching with aliases
- If QuickBooks uses different section names, sections might not be found
- This would result in `{ lines: [], total: 0 }` for all sections

### 3. Enricher Function (`/src/quickbooks/reports/enrichers/profit-loss.ts`)

**Line 108**: **CRITICAL SUSPECT**

```typescript
const validatedPL = reconcilePnLData(normalizedData)
```

All subsequent calculations use `validatedPL` instead of `normalizedData`.

**Line 222-256**: KPIs are built from `validatedPL`:

```typescript
totalRevenue: validatedPL.total_income || 0,
totalExpenses: trueTotalExpenses,
netIncome: validatedPL.net_income || 0,
// ... etc
```

### 4. Reconciliation Function (`/src/quickbooks/utils/report-helpers.ts`)

**Lines 753-814**: `reconcilePnLData()` function

**CRITICAL FINDING**:
**Lines 784-791**: This code can SET `other_expenses` to ZERO:

```typescript
if (originalOtherExpenses > 0 && originalTotalExpenses > originalOtherExpenses) {
  // Only adjust if it makes sense
  reconciledData.total_expenses = originalTotalExpenses - originalOtherExpenses
  warnings.push(
    `Adjusted total_expenses from ${originalTotalExpenses} to ${reconciledData.total_expenses}`
  )
  // Set other_expenses to 0 since it was already included
  reconciledData.other_expenses = 0 // ← ZEROS OUT other_expenses
}
```

**Lines 764-770**: Calculates discrepancy:

```typescript
const calculatedNetIncome =
  reconciledData.total_income -
  (reconciledData.cogs_total || 0) -
  reconciledData.total_expenses -
  (reconciledData.other_expenses || 0) // ← Uses other_expenses in calculation
const reportedNetIncome = reconciledData.net_income
const discrepancy = Math.abs(reportedNetIncome - calculatedNetIncome)
```

## Root Cause Hypothesis

The `reconcilePnLData()` function is designed to detect double-counting of expenses (when QuickBooks includes "other_expenses" within "total_expenses"). However, there may be an issue where:

1. **Normalized data has zero or missing fields**: If `transformProfitAndLoss()` returns zeros for all sections, the reconciliation logic might not fix it
2. **Section name mismatch**: QuickBooks API might be using different section names than expected by `findSection()`
3. **Data structure mismatch**: The raw QB report structure might not match expectations

## Next Steps

1. **Check what `transformProfitAndLoss()` returns**
   - Add logging to see normalized data before enrichment
   - Verify if sections are being found correctly

2. **Examine raw QuickBooks API response**
   - Log `rawReport` to see actual structure
   - Check if section names match aliases in `findSection()`

3. **Verify reconciliation logic**
   - Check if `reconcilePnLData()` is incorrectly zeroing values
   - Review the discrepancy calculation logic

4. **Test with actual QB data**
   - Make API call directly to QB to see raw format
   - Compare with expected structure

## Files to Review Next

- `/src/quickbooks/reports/transformers.ts` - Verify section finding logic
- Raw QuickBooks API response - Compare structure
- Frontend consumption code - Check if it's reading wrong fields
