# Cash Flow Statement Query Fixes

## Issues Identified and Fixed

### Issue 1: Keyword Routing Failure ✅ FIXED

**Problem:** When users asked "show me my cashflow statement", the system called `getCashFlowOptimized()` (1 KPI card) instead of `getCashFlowStatementReport()` (4 KPI cards).

### Issue 2: Missing Return Fields in extractCashFlowData() ✅ FIXED

**Problem:** Cash flow statement showed $0 for investing and financing activities, despite QuickBooks API returning correct values (-$13,495 and $15,662.50).

---

## Root Causes

### Problem 1A: Underscore vs Space Mismatch

The CFO agent passes intents like:

```json
{ "intent": "cash_flow_statement" }
```

But keywords were defined with spaces:

```javascript
keywords: ['cash flow statement', ...]  // with spaces
```

The string `"cash_flow_statement"` doesn't match because `.includes()` looks for exact substrings.

### Problem 1B: Missing One-Word Variants

Users might type "cashflow" (one word) or "cash flow" (two words), but only the two-word variant was in keywords.

### Problem 2: Incomplete Return Statement

**File:** `src/lib/ai/tools/unifiedDataTool.ts:11005-11010`

The `extractCashFlowData()` method successfully parsed all values:

- `operatingCashFlow`: 1896.02 ✅
- `investingCashFlow`: -13495 ✅ (parsed but not returned)
- `financingCashFlow`: 15662.5 ✅ (parsed but not returned)

But the return statement was missing two fields:

```typescript
// BEFORE (BROKEN)
return {
  cash_at_end: endingCash,
  cash_at_beginning: beginningCash,
  net_cash_from_operating_activities: operatingCashFlow,
  net_change_in_cash: netChange,
  // ❌ Missing: net_cash_from_investing_activities
  // ❌ Missing: net_cash_from_financing_activities
}
```

This caused `getCashFlowStatementReport()` at line 13337 and 13351 to evaluate:

- `cfData.net_cash_from_investing_activities || 0` → `0` (field undefined)
- `cfData.net_cash_from_financing_activities || 0` → `0` (field undefined)

---

## Solutions Applied

### Fix 1: Normalize Underscores to Spaces

**File:** `src/lib/ai/tools/unifiedDataTool.ts:366`

Added underscore-to-space conversion in `normalizeQuery()`:

```typescript
private normalizeQuery(query: string): string {
  let normalized = query.toLowerCase().trim()

  // Convert underscores to spaces (for agent-generated intents)
  normalized = normalized.replace(/_/g, ' ')  // ✅ NEW

  // Fix common double letter typos
  normalized = normalized.replace(/([a-z])\1{2,}/g, '$1$1')
  normalized = normalized.replace(/oo([a-z])/g, 'o$1')

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ')

  return normalized
}
```

**Effect:**

- `"cash_flow_statement"` → `"cash flow statement"` ✅
- Now matches the keyword `"cash flow statement"`

### Fix 2: Added One-Word Variants to Keywords

**File:** `src/lib/ai/tools/unifiedDataTool.ts:815-839`

```typescript
{
  keywords: [
    'cash flow statement',
    'cashflow statement',        // ✅ NEW: One word variant
    'statement of cash flows',
    'statement of cashflows',    // ✅ NEW: One word variant
    'operating activities',
    'investing activities',
    'financing activities',
    'show cash flow',
    'show cashflow',            // ✅ NEW: One word variant
    'show me cash flow',
    'show me cashflow',         // ✅ NEW: One word variant
    'give me cash flow',
    'give me cashflow',         // ✅ NEW: One word variant
    'tell me cash flow',
    'tell me cashflow',         // ✅ NEW: One word variant
    'show me my cash flow',
    'show me my cashflow',      // ✅ NEW: One word variant
    'give me my cash flow',
    'give me my cashflow',      // ✅ NEW: One word variant
    'cash movements',
  ],
  handler: () => this.getCashFlowStatementReport(),  // ✅ Correct method
},
```

### Fix 3: Added Missing Return Fields

**File:** `src/lib/ai/tools/unifiedDataTool.ts:11005-11012`

```typescript
// AFTER (FIXED)
return {
  cash_at_end: endingCash,
  cash_at_beginning: beginningCash,
  net_cash_from_operating_activities: operatingCashFlow,
  net_cash_from_investing_activities: investingCashFlow, // ✅ ADDED
  net_cash_from_financing_activities: financingCashFlow, // ✅ ADDED
  net_change_in_cash: netChange,
}
```

---

## Impact of Fixes

### Before All Fixes

**User Query:** `"tell me about my cashflow statement"`

**What Happened:**

1. Intent passed as `"cash_flow_statement"` (with underscores)
2. No keyword match found → Falls back to `getComprehensiveAnalysisWithInsights()`
3. Calls `getCashFlowOptimized()` → Returns 1 KPI card (cash balance only)
4. Even if it called `getCashFlowStatementReport()`, investing/financing would show $0

**Result:** ❌ Only cash balance, missing all details

### After All Fixes

**User Query:** `"tell me about my cashflow statement"`

**What Happens:**

1. Intent normalized: `"cash_flow_statement"` → `"cash flow statement"`
2. Matches keyword → Calls `getCashFlowStatementReport()` directly
3. `extractCashFlowData()` returns complete data including investing/financing
4. Returns 4 KPI cards with correct values

**Result:** ✅ Full cash flow statement with:

- Operating Cash Flow: $1,896.02
- Investing Cash Flow: -$13,495.00
- Financing Cash Flow: $15,662.50
- Free Cash Flow: $1,896.02
- Beginning cash, ending cash, net change details

---

## Comparison: Why Reports Page Worked

The Reports page uses `src/lib/providers/quickbooks/reports.ts:cashFlow()` which correctly returns all fields:

```typescript
// reports.ts:806-816 (CORRECT)
const result: any = {
  report_name: 'Cash Flow Statement',
  net_cash_from_operating_activities: operatingCashFlow,
  net_cash_from_investing_activities: investingCashFlow, // ✓ PRESENT
  net_cash_from_financing_activities: financingCashFlow, // ✓ PRESENT
  net_change_in_cash: netChange,
  cash_at_beginning: beginningCash,
  cash_at_end: endingCash,
}
```

The UnifiedDataTool's `extractCashFlowData()` was parsing the same data but not including all fields in its return statement.

---

## Files Modified

1. **src/lib/ai/tools/unifiedDataTool.ts**
   - Line 366: Added underscore-to-space normalization
   - Lines 817-837: Added one-word "cashflow" keyword variants
   - Lines 11009-11010: Added missing investing/financing return fields

---

## Test Cases

All of these should now return the complete cash flow statement with 4 KPI cards:

```
✅ "tell me about my cashflow statement" (original failing query)
✅ "show me my cashflow statement"
✅ "show me my cash flow statement"
✅ "give me my cashflow statement"
✅ "cash flow statement"
✅ "statement of cashflows"
✅ "show operating activities"
✅ "investing activities"
✅ "financing activities"
```

Expected output:

- Operating Cash Flow KPI: $1,896.02
- Investing Cash Flow KPI: -$13,495.00
- Financing Cash Flow KPI: $15,662.50
- Free Cash Flow KPI: $1,896.02

---

## Why These Bugs Weren't Caught Earlier

1. **Routing Issue:** The CFO agent uses underscore format (`cash_flow_statement`) while humans naturally type with spaces or as one word
2. **Missing Fields:** The `|| 0` fallback in KPI generation silently converted `undefined` to `0`, masking the bug
3. **Logs Were Misleading:** Console logs showed correct parsing but didn't reveal the incomplete return statement
4. **Reports Page Worked:** Since the Reports page uses a different code path, this bug only affected the chat interface

---

## Summary

**Three simple fixes solved two major issues:**

1. Underscore-to-space normalization (1 line)
2. One-word keyword variants (8 new keywords)
3. Complete return statement (2 missing fields)

Total changes: **11 lines of code** to fix incorrect routing and missing data fields.
