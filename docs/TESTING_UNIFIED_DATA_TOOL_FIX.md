# Testing Guide: UnifiedDataTool Period Totals Fix

## Quick Summary

The AI agent was displaying monthly averages ($4,282.62 revenue) instead of period totals ($10,200.77 revenue). This has been fixed by ensuring all visualization methods use `totalRevenue` and `totalExpenses` fields which contain period totals.

## Testing Steps

### 1. Clear All Caches (IMPORTANT)

To ensure the fixes take effect immediately:

#### Option A: Clear caches via API

```bash
# Clear KPI cache
curl -X DELETE http://localhost:3000/api/v2/kpis/cache-stats

# Or using PowerShell on Windows
Invoke-RestMethod -Method Delete -Uri "http://localhost:3000/api/v2/kpis/cache-stats"
```

#### Option B: Restart the server

```bash
# Stop the server (Ctrl+C) and restart
npm run dev
```

#### Option C: Clear Next.js build cache (if changes still don't appear)

```bash
# On Windows
del /s /q .next
npm run dev

# On Mac/Linux
rm -rf .next
npm run dev
```

### 2. Test the AI Agent

Query the agent with a financial question:

```
"What are our current financial metrics?"
```

or

```
"Show me our revenue and expenses"
```

### 3. Expected Results

#### ✅ CORRECT (After Fix):

```
Revenue: $10,200.77 (year-to-date total)
Total Expenses: $8,558.31 (year-to-date total)
Net Income: $1,642.46 (year-to-date total)
Monthly Burn Rate: $855.83/mo (monthly average for runway calculation)
```

#### ❌ INCORRECT (Before Fix):

```
Revenue: $4,282.62 (was showing monthly average)
Total Expenses: $797.19 (was showing monthly average)
Net Income: $3,485.43 (incorrect calculation)
```

### 4. Verify Against Reports Pages

Navigate to the Reports Pages in the UI and compare:

- Executive Summary page
- Profit & Loss page
- Both should show the same period totals as the AI agent

## What Was Fixed

### Files Modified

1. **`src/lib/ai/tools/unifiedDataTool.ts`**
   - `calculateKPIsFromReports()` - Separated period totals from monthly averages
   - `getComprehensiveAnalysisWithInsights()` - Updated to use totalRevenue field
   - `generateEnhancedKPIVisualizations()` - Fixed revenue/expense displays
   - `calculateKPIsFromSummaries()` - Fixed net income calculation

### Key Changes

- Added `totalRevenue` and `totalExpenses` fields for period totals
- Kept `monthlyRevenue` and `monthlyExpenses` for burn rate calculations
- Updated all visualization methods to prefer period totals
- Fixed net income calculations to use period totals

## Debugging Tips

### If values are still wrong:

1. **Check console logs**: The code includes debug logging that shows:

   ```
   CRITICAL FIX APPLIED: calculateKPIsFromReports now returns period totals
   Period Total Revenue: 10200.77
   Period Total Expenses: 8558.31
   ```

2. **Verify cache is cleared**: The 5-minute cache TTL may be holding old values

3. **Check build artifacts**: Sometimes Next.js caches compiled code

   ```bash
   # Force a clean rebuild
   del /s /q .next node_modules\.cache
   npm run dev
   ```

4. **Inspect network requests**: Use browser DevTools to check the API responses

## Rollback Instructions

If issues occur, you can revert the changes:

```bash
git checkout -- src/lib/ai/tools/unifiedDataTool.ts
```

## Success Criteria

- [ ] AI agent shows $10,200.77 revenue (not $4,282.62)
- [ ] AI agent shows $8,558.31 expenses (not $797.19)
- [ ] Values match exactly with Reports Pages UI
- [ ] Monthly burn rate still shows as monthly value ($855.83/mo)
- [ ] Net income shows $1,642.46 (period total)

## Contact for Issues

If the fixes don't work as expected:

1. Check the console logs for error messages
2. Verify the server restarted properly
3. Ensure no other code changes are interfering
4. Review the debug output in the agent's response

---

_Testing Guide Created: October 19, 2025_
_Fix Implementation: UnifiedDataTool period totals vs monthly averages_
