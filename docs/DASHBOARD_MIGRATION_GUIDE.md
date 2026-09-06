# Dashboard API Migration Guide

## Summary

Successfully migrated from old KPI endpoints to new unified `/api/dashboard` endpoint that uses `reportHelpers.ts` as single source of truth.

---

## What Changed

### ✅ **NEW: `/api/dashboard/route.ts`**

- Single endpoint for all dashboard data
- Uses `reportHelpers.ts` functions exclusively:
  - `calculateKeyMetrics()` - All financial calculations
  - `calculateFinancialHealthScore()` - Health scoring
  - `generateInsights()` - Actionable insights
  - `parseBreakdowns()` - Revenue/expense breakdowns
  - `getMonthlyPnLTrend()` - Historical trends
  - `getMonthlyCashFlow()` - Cash flow data

### ✅ **UPDATED: `useDashboardData` Hook**

- Changed from: `/api/kpis?mode=full&chartPeriod=...`
- Changed to: `/api/dashboard?chartPeriod=...`
- All functionality preserved

### ✅ **UPDATED: `useDashboardDataProgressive` Hook**

- Now uses single `/api/dashboard` endpoint
- No more separate phase 2 API call
- Simulates phase 1/2 for backward compatibility
- Faster since it's one request instead of two

### ✅ **UPDATED: `useDashboardCacheControl` Hook**

- Cache invalidation now targets `/api/dashboard`
- Maintains backward compatibility during migration

---

## Testing Steps

### 1. **Start Development Server**

```bash
npm run dev
```

### 2. **Test Dashboard Page**

Navigate to: `http://localhost:3000/dashboard`

**Expected behavior:**

- ✅ Dashboard loads without errors
- ✅ KPI cards show correct metrics
- ✅ Revenue/Expense trend chart displays
- ✅ Daily cash flow chart displays
- ✅ Revenue breakdown shows customer data
- ✅ Recent transactions populate
- ✅ Financial health score calculates

### 3. **Test API Endpoint Directly**

```bash
# Test new endpoint
curl http://localhost:3000/api/dashboard?chartPeriod=12months

# Compare with old endpoint (should show similar data)
curl http://localhost:3000/api/kpis?mode=full&chartPeriod=12months
```

### 4. **Check Browser Console**

Look for:

- ✅ No errors
- ✅ Performance logs: `[Dashboard] Phase 1/2/3 completed in Xms`
- ✅ Total duration < 10s (should be faster than old endpoint)

### 5. **Check Network Tab**

- ✅ Only one request to `/api/dashboard`
- ✅ No requests to `/api/kpis/phase2`
- ✅ Response includes all expected fields

---

## Benefits

### **Code Reduction**

- **Before**: 1,200+ lines across `/api/kpis` routes
- **After**: ~400 lines in `/api/dashboard`
- **Reduction**: ~66% less code

### **Performance**

- **Before**: 2 sequential API calls (phase 1 → phase 2)
- **After**: 1 API call with parallel report fetching
- **Expected improvement**: 20-30% faster

### **Maintainability**

- **Before**: Calculations duplicated across KPI routes
- **After**: Single source of truth in `reportHelpers.ts`
- **Bug fixes**: Fix once, applies everywhere

### **Consistency**

- Executive summary, P&L, Balance Sheet, Cash Flow all use same calculations
- No more discrepancies between reports

---

## Rollback Plan (if needed)

If issues are found, you can quickly rollback:

### Option 1: Revert Hook Changes

```typescript
// In useDashboardData.ts, change back to:
const url = `/api/kpis?mode=full&chartPeriod=${chartPeriod}&basis=accrual&viewType=${chartViewType}`
```

### Option 2: Feature Flag

Add environment variable to toggle between old/new:

```typescript
const USE_NEW_DASHBOARD = process.env.NEXT_PUBLIC_USE_NEW_DASHBOARD === 'true'
const url = USE_NEW_DASHBOARD
  ? `/api/dashboard?chartPeriod=${chartPeriod}`
  : `/api/kpis?mode=full&chartPeriod=${chartPeriod}`
```

---

## Next Steps After Testing

Once confirmed working:

1. **Monitor Performance**
   - Check server logs for timing
   - Compare load times with old endpoint
   - Monitor error rates

2. **Deprecate Old Endpoints** (after 2 weeks of stable operation)
   - Add deprecation warning to `/api/kpis`
   - Remove in next major release

3. **Extend to Other Pages**
   - Reports page
   - Analytics pages
   - Any other pages using KPI data

4. **Clean Up**
   - Remove old `/api/kpis` routes
   - Remove old `/api/kpis/phase2` route
   - Remove legacy code

---

## Troubleshooting

### Issue: "No data available"

**Solution:** Check provider connection in `/settings` (Integrations section)

### Issue: Different values than before

**Solution:**

1. Check `reportHelpers.ts` calculations
2. Compare raw report data from both endpoints
3. Verify date ranges are identical

### Issue: Slow performance

**Solution:**

1. Check which phase is slow in logs
2. Verify provider API isn't rate limiting
3. Consider caching report data

### Issue: Missing fields in response

**Solution:**

1. Check `transformMetricsToKPIs()` function
2. Verify `calculateKeyMetrics()` returns all expected fields
3. Check TypeScript types match

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│                                                          │
│  Dashboard Page → useDashboardData() hook               │
│                      ↓                                   │
│                 SWR Cache Layer                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓ HTTP GET
┌────────────────────────────────────────────────────────┐
│              Backend (Next.js API Route)                │
│                                                         │
│  /api/dashboard/route.ts                               │
│    ↓                                                   │
│  Phase 1: Fetch Reports (parallel)                    │
│    - P&L, Balance Sheet, Cash Flow, AR, AP           │
│    ↓                                                   │
│  Phase 2: Calculate Metrics                           │
│    - reportHelpers.calculateKeyMetrics()              │
│    - reportHelpers.calculateFinancialHealthScore()    │
│    - reportHelpers.generateInsights()                 │
│    - reportHelpers.parseBreakdowns()                  │
│    ↓                                                   │
│  Phase 3: Fetch Trends                                │
│    - reportHelpers.getMonthlyPnLTrend()              │
│    - reportHelpers.getMonthlyCashFlow()              │
│    ↓                                                   │
│  Phase 4: Transform & Return                          │
│    - transformMetricsToKPIs()                         │
│    - Build standardized response                      │
└────────────────────────────────────────────────────────┘
                     │
                     ↓
┌────────────────────────────────────────────────────────┐
│           Provider API (QuickBooks/Zoho)                │
│                                                         │
│  - Profit & Loss Report                                │
│  - Balance Sheet Report                                │
│  - Cash Flow Statement                                 │
│  - Aged Receivables                                    │
│  - Aged Payables                                       │
└────────────────────────────────────────────────────────┘
```

---

## Files Changed

### Created:

- ✅ `src/app/api/dashboard/route.ts` (new unified endpoint)

### Modified:

- ✅ `src/hooks/useDashboardData.ts` (updated 3 hooks)

### Reference (no changes needed):

- `src/lib/providers/quickbooks/utils/reportHelpers.ts`
- `src/lib/utils/reportHelpers.ts`
- `src/app/(main)/dashboard/page.tsx`

---

## Success Criteria

✅ Dashboard loads without errors
✅ All KPIs display correct values
✅ Charts render properly
✅ Performance is equal or better
✅ No console errors
✅ SWR caching works correctly
✅ Health score calculates
✅ Insights generate

---

## Support

If you encounter issues:

1. Check browser console for errors
2. Check server logs: `[Dashboard]` prefix
3. Compare response from `/api/dashboard` vs `/api/kpis`
4. Verify `reportHelpers.ts` functions are working
5. Test with different chart periods (3/6/12 months)

---

Generated: 2025-01-10
Migration Status: ✅ Complete - Ready for Testing
