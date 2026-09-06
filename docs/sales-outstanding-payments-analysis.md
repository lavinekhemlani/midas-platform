# Outstanding Payments Calculation Analysis

## Executive Summary

The current outstanding payments feature in the sales page has significant limitations that prevent it from showing a complete picture of accounts receivable. This analysis examines the current implementation, identifies its constraints, and explains why it only shows current-year data.

## Current Implementation Overview

### Data Flow Architecture

```
Sales Page (page.tsx)
    ↓
useSalesCustomer Hook (useSalesData.ts)
    ↓
API Route (/api/sales/customer/route.ts)
    ↓
QuickBooks API (Invoices + Sales Receipts)
    ↓
Manual Aggregation (fallback method)
    ↓
calculateOutstandingPayments (sortUtils.ts)
```

## Critical Limitations

### 1. **MAXRESULTS Query Limit (Primary Issue)**

**Location**: `/src/app/api/sales/customer/route.ts` (lines 43-44, 51-52)

```typescript
const invoicesQuery = dateCondition
  ? `SELECT * FROM Invoice ${dateCondition} ORDERBY TxnDate DESC MAXRESULTS 1000`
  : 'SELECT * FROM Invoice ORDERBY TxnDate DESC MAXRESULTS 1000'
```

**Impact**:

- Hard limit of 1,000 invoices per query
- QuickBooks API enforces this as maximum
- No pagination support in current implementation
- Sorted by `TxnDate DESC` (newest first)
- **Older invoices beyond 1,000 limit are never retrieved**

### 2. **Date-Based Filtering Constraint**

**Code Analysis** (lines 36-39):

```typescript
let dateCondition = ''
if (startDate && endDate) {
  dateCondition = `WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`
}
```

**Issues**:

- Date range filtering is applied to invoice **transaction date** (TxnDate)
- NOT applied to invoice **status** or **balance**
- Old unpaid invoices from previous years are excluded when using current year filter
- No separate query for "all unpaid invoices regardless of date"

### 3. **Embedded Transactions Array Pattern**

**Data Structure** (lines 74-96):

```typescript
customerSales[customerId] = {
  id: customerId,
  name: customerName,
  totalSales: 0,
  invoiceCount: 0,
  salesReceiptCount: 0,
  transactions: [], // ← Invoice details stored here
}

customerSales[customerId].transactions.push({
  id: invoice.Id,
  type: 'Invoice',
  date: invoice.TxnDate,
  amount: amount,
  docNumber: invoice.DocNumber,
  dueDate: invoice.DueDate,
  balance: parseFloat(invoice.Balance || '0'), // ← Outstanding balance
})
```

**Why This Limits Outstanding Payments**:

- `transactions` array only contains invoices from the date-filtered query
- `calculateOutstandingPayments()` function (sortUtils.ts) relies solely on this array
- No separate data source for unpaid invoices

### 4. **Outstanding Payment Calculation Logic**

**Location**: `/src/app/(main)/sales/utils/sortUtils.ts` (lines 170-199)

```typescript
export function calculateOutstandingPayments(customers: Customer[]): OutstandingPayment[] {
  return customers.flatMap((customer) =>
    (customer.transactions || [])
      .filter(
        (transaction: any) =>
          transaction.type === 'Invoice' &&
          transaction.balance !== undefined &&
          transaction.balance > 0 // ← Only unpaid invoices
      )
      .map((transaction: any) => ({
        id: transaction.id,
        customerId: customer.id,
        customerName: customer.name,
        docNumber: transaction.docNumber,
        date: transaction.date,
        dueDate: transaction.dueDate,
        amount: transaction.amount,
        balance: transaction.balance,
        daysOverdue: transaction.dueDate
          ? Math.max(
              0,
              Math.floor(
                (new Date().getTime() - new Date(transaction.dueDate).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            )
          : 0,
      }))
  )
}
```

**Process**:

1. Iterates through customer transactions array
2. Filters for invoices with `balance > 0`
3. Maps to OutstandingPayment objects
4. **Problem**: Only sees transactions that were in the initial date-filtered query

## Why It Only Shows Current Year Data

### Root Cause Chain

1. **User selects date range** (e.g., "This Year" = 2025-01-01 to 2025-12-31)
2. **API applies date filter** to QuickBooks query:
   ```sql
   WHERE TxnDate >= '2025-01-01' AND TxnDate <= '2025-12-31'
   ```
3. **Only 2025 invoices are retrieved** (up to 1,000 max)
4. **Old unpaid invoices excluded** (e.g., 2024 invoice with balance ≠ shown)
5. **Outstanding tab shows incomplete data**

### Example Scenario

**Company has**:

- 50 unpaid invoices from 2024 (total: $25,000)
- 20 unpaid invoices from 2025 (total: $10,000)
- User views "This Year" (2025) on sales page

**What happens**:

- ✅ 2025 invoices retrieved (20 invoices, $10,000)
- ❌ 2024 invoices NOT retrieved (50 invoices, $25,000 missing)
- **Outstanding tab shows only $10,000 instead of actual $35,000**

## Comparison with Aged Receivables Report

### Aged Receivables Approach (Better Implementation)

**Location**: `/src/app/api/reports/aged-receivables/route.ts`

**Key Differences**:

1. **No Date Filtering on Query**:

```typescript
const invoiceQuery = buildOptimizedQuery('Invoice', invoiceFields, ["Balance > '0'"])
```

- Retrieves ALL invoices with balance > 0
- Not limited by transaction date
- Shows historical unpaid invoices

2. **Pagination Support**:

```typescript
const invoices = await paginatedQuery<any>(client, invoiceQuery.replace(' MAXRESULTS 500', ''), 500)
```

- Handles more than 500/1000 invoices
- Uses helper function `paginatedQuery` to fetch all results
- No data loss from query limits

3. **Credit Memo Integration**:

```typescript
const { adjustedInvoices, totalCreditsApplied, unusedCredits } = applyCustomerCredits(
  invoices,
  creditMemos,
  asOfDate
)
```

- Accounts for customer credits
- More accurate outstanding balances

4. **Aging Bucket Calculation**:

```typescript
const bucket = getAgingBucket(dueDate, asOfDate)
// Returns: 'current', '1-30', '31-60', '61-90', '91+'
```

- Categorizes by days past due
- Based on due date, not transaction date

## Data Consistency Issues

### Sales vs Receivables Mismatch

**Sales Page Outstanding Tab**:

- Source: Sales API with date filters
- Shows: ~$10,000 (current year only)
- Missing: Historical unpaid invoices

**Aged Receivables Report**:

- Source: Direct invoice query (balance > 0)
- Shows: ~$35,000 (all unpaid)
- Accurate: Complete A/R picture

**User Confusion**:

- Same company, different numbers
- No clear explanation why they differ
- Undermines trust in reporting accuracy

## API Endpoint Comparison

### Sales Customer Endpoint

```
GET /api/sales/customer?start_date=2025-01-01&end_date=2025-12-31
```

**Purpose**: Sales performance analysis
**Optimized for**: Revenue reporting, period comparisons
**Data returned**: Sales by customer in date range
**Outstanding calculation**: Side-effect, not primary purpose

### Aged Receivables Endpoint

```
GET /api/reports/aged-receivables?date=2025-12-26
```

**Purpose**: A/R management and collections
**Optimized for**: Outstanding balance tracking
**Data returned**: All unpaid invoices with aging
**Outstanding calculation**: Primary purpose

## Technical Debt Identified

### 1. **Dual-Purpose API Issue**

- Sales API trying to serve both sales analysis AND A/R tracking
- Conflicting requirements (date filtering vs. balance filtering)
- Should be separate concerns

### 2. **Missing Pagination**

- Sales API doesn't implement `paginatedQuery` helper
- Aged Receivables API does implement it
- Inconsistent patterns across codebase

### 3. **No Balance-Based Query**

- Sales API queries by date, then filters balance
- Should query by balance first (like A/R report)
- More efficient and accurate

### 4. **Transaction Array Coupling**

- Outstanding payments tightly coupled to customer sales data
- Should be independent data structure
- Current design prevents showing full A/R without full sales history

## Recommended Solutions

### Option 1: Use Dedicated Invoices Endpoint (Preferred)

**Create new API route**: `/api/invoices/outstanding`

```typescript
// Query all unpaid invoices, no date filter
const query = "SELECT * FROM Invoice WHERE Balance > '0' ORDERBY DueDate"
const invoices = await paginatedQuery(client, query, 500)

// Return standalone outstanding payments list
return {
  outstanding: invoices.map((inv) => ({
    id: inv.Id,
    customerId: inv.CustomerRef.value,
    customerName: inv.CustomerRef.name,
    docNumber: inv.DocNumber,
    date: inv.TxnDate,
    dueDate: inv.DueDate,
    amount: parseFloat(inv.TotalAmt),
    balance: parseFloat(inv.Balance),
    daysOverdue: calculateDaysOverdue(inv.DueDate),
  })),
  summary: {
    totalOutstanding: invoices.reduce((sum, inv) => sum + inv.Balance, 0),
    invoiceCount: invoices.length,
  },
}
```

**Advantages**:

- Decoupled from sales date filtering
- Shows all unpaid invoices regardless of age
- Can implement proper pagination
- Consistent with A/R report logic
- Single source of truth

### Option 2: Dual Query in Sales API (Compromise)

**Modify**: `/api/sales/customer` to fetch two datasets

```typescript
// Query 1: Sales data (with date filter for performance)
const salesInvoices = await querySalesInvoices(startDate, endDate)

// Query 2: Outstanding invoices (no date filter)
const outstandingInvoices = await queryOutstandingInvoices()

return {
  salesByCustomer: processSalesData(salesInvoices),
  outstandingPayments: processOutstandingData(outstandingInvoices),
  summary: { ... }
}
```

**Advantages**:

- Maintains backward compatibility
- Shows complete outstanding data
- Single API call from frontend

**Disadvantages**:

- Increased API response time
- More complex response structure
- Still couples two concerns

### Option 3: Reuse Aged Receivables Data (Quick Fix)

**Modify**: Sales page to call aged receivables endpoint

```typescript
// In page.tsx or new hook
const { data: arData } = useAgedReceivables()

const outstandingPayments =
  arData?.data?.invoices?.map((inv) => ({
    id: inv.id,
    customerId: inv.customerId,
    customerName: inv.customer,
    docNumber: inv.number,
    date: inv.dueDate,
    dueDate: inv.dueDate,
    amount: inv.amount,
    balance: inv.balance,
    daysOverdue: inv.daysPastDue,
  })) || []
```

**Advantages**:

- Minimal code changes
- Leverages existing, tested endpoint
- Immediate fix

**Disadvantages**:

- Duplicate API calls if user visits both pages
- Tight coupling to A/R report structure
- May include more data than needed

## Performance Considerations

### Current Bottlenecks

1. **No Query Optimization**:
   - `SELECT *` retrieves all fields (wasteful)
   - A/R report uses `buildOptimizedQuery` with field selection
   - Sales API should specify needed fields only

2. **Synchronous Processing**:
   - Invoices and sales receipts queried sequentially
   - Could parallelize with `Promise.all()`

3. **Client-Side Calculation**:
   - Outstanding payments calculated in browser
   - Should be pre-calculated in API for caching

### Recommended Optimizations

```typescript
// Parallel queries
const [invoices, salesReceipts, credits] = await Promise.all([
  paginatedQuery(client, invoiceQuery, 500),
  paginatedQuery(client, receiptQuery, 500),
  paginatedQuery(client, creditQuery, 500),
])

// Field selection (reduces payload by ~60%)
const fields = ['Id', 'DocNumber', 'CustomerRef', 'TotalAmt', 'Balance', 'TxnDate', 'DueDate']
const query = buildOptimizedQuery('Invoice', fields, ["Balance > '0'"])
```

## Migration Path

### Phase 1: Create Dedicated Endpoint (Week 1)

1. Create `/api/invoices/outstanding` route
2. Implement pagination and field optimization
3. Add comprehensive tests
4. Deploy alongside existing API

### Phase 2: Update Sales Page (Week 2)

1. Create `useOutstandingInvoices` hook
2. Update Outstanding tab to use new endpoint
3. Add loading states and error handling
4. A/B test with existing implementation

### Phase 3: Deprecate Old Logic (Week 3)

1. Remove `calculateOutstandingPayments` from sortUtils
2. Remove transactions array from sales API response
3. Update documentation
4. Monitor for issues

### Phase 4: Optimize (Week 4)

1. Add caching layer (Redis/in-memory)
2. Implement real-time updates via webhooks
3. Add data export functionality
4. Performance monitoring

## Testing Recommendations

### Unit Tests Needed

```typescript
describe('Outstanding Invoices API', () => {
  it('should return all unpaid invoices regardless of date')
  it('should handle pagination correctly')
  it('should calculate days overdue accurately')
  it('should include customer credits')
  it('should handle missing due dates')
  it('should sort by due date by default')
})
```

### Integration Tests

```typescript
describe('Sales Page Outstanding Tab', () => {
  it('should match aged receivables total')
  it('should update when new invoice is created')
  it('should show historical unpaid invoices')
  it('should handle large datasets (1000+ invoices)')
})
```

### Manual Testing Scenarios

1. **Historical Invoice Test**:
   - Create unpaid invoice dated 2 years ago
   - Filter sales page to "This Year"
   - Verify invoice appears in Outstanding tab

2. **Pagination Test**:
   - Company with 2000+ unpaid invoices
   - Verify all invoices are shown
   - Check performance (< 3 seconds load)

3. **Consistency Test**:
   - Compare Outstanding tab total with A/R report
   - Should match exactly
   - Investigate any discrepancies

## Conclusion

The current outstanding payments implementation suffers from architectural issues that limit its accuracy and usefulness. The primary problem is the tight coupling between sales analysis (date-filtered) and A/R tracking (balance-filtered), causing incomplete data when viewing historical periods.

**Immediate Impact**:

- Users cannot trust outstanding balance figures
- Collections team missing critical information
- Reports show conflicting numbers

**Recommended Action**:
Create a dedicated `/api/invoices/outstanding` endpoint that queries all unpaid invoices regardless of transaction date, following the proven pattern used in the aged receivables report.

**Expected Outcome**:

- Accurate, complete A/R data
- Consistent with aged receivables report
- Better user trust and decision-making
- Improved code maintainability

## References

- Sales Customer API: `/src/app/api/sales/customer/route.ts`
- Sort Utils: `/src/app/(main)/sales/utils/sortUtils.ts`
- Aged Receivables API: `/src/app/api/reports/aged-receivables/route.ts`
- Sales Data Hook: `/src/hooks/useSalesData.ts`
- Sales Page Component: `/src/app/(main)/sales/page.tsx`

---

**Document Version**: 1.0
**Date**: 2025-12-26
**Author**: Code Analysis Agent
**Status**: Analysis Complete - Awaiting Implementation Decision
