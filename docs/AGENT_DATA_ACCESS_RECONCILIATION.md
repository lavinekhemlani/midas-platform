# Agent Data Access Reconciliation

## Executive Summary

This document provides a comprehensive analysis of the data access capabilities between the Zenith OS UI pages and the AI agent's UnifiedDataTool. Currently, the agent has access to approximately 30-40% of the data and functionality available in the UI, with critical gaps in sales, expense details, and advanced analytics.

## Current State Analysis

### 1. Sales Pages Data Access

#### Available in UI (`/sales/*` pages)

**Customer Sales Analysis** - `/api/sales/customer`

- Customer ID, name, and contact information
- Total sales per customer with market share percentages
- Transaction count (invoices + sales receipts)
- Average transaction value per customer
- Outstanding balance tracking
- Individual transaction details with dates, amounts, and status
- Days overdue calculation for unpaid invoices
- Drill-down to specific customer transactions

**Product Sales Analysis** - `/api/sales/product`

- Product ID, name, and type (Service/Inventory/NonInventory)
- Total sales revenue per product
- Market share by product
- Quantity sold and average unit price
- Transaction count per product
- Customer purchase details for each product
- Product type distribution analysis

#### Agent Current Access: ❌ NONE

The agent has NO access to sales-specific data endpoints. It can only infer sales data from P&L reports.

---

### 2. Expenses Pages Data Access

#### Available in UI (`/expenses/*` pages)

**Bills Management** - `/api/expenses/bills`

```json
{
  "bills": [
    {
      "id": "string",
      "vendor": "string",
      "docNumber": "string",
      "date": "date",
      "dueDate": "date",
      "amount": "number",
      "balance": "number",
      "status": "Paid|Unpaid|Overdue",
      "lineItems": [
        {
          "description": "string",
          "account": "string",
          "amount": "number"
        }
      ]
    }
  ],
  "aging": {
    "current": "number",
    "days_1_30": "number",
    "days_31_60": "number",
    "days_61_90": "number",
    "days_90_plus": "number"
  },
  "kpis": {
    "totalBills": "number",
    "totalAmount": "number",
    "totalPaid": "number",
    "totalUnpaid": "number",
    "overdueCount": "number",
    "overdueAmount": "number"
  }
}
```

**Vendor Analysis** - `/api/expenses/vendors`

```json
{
  "vendors": [
    {
      "id": "string",
      "name": "string",
      "totalSpending": "number",
      "currentBalance": "number",
      "transactionCount": "number",
      "billCount": "number",
      "creditCount": "number",
      "transactions": [
        {
          "date": "date",
          "type": "Bill|BillCredit|Payment",
          "docNumber": "string",
          "amount": "number",
          "balance": "number"
        }
      ]
    }
  ],
  "kpis": {
    "totalExpenses": "number",
    "totalPaid": "number",
    "totalUnpaid": "number",
    "vendorCount": "number",
    "categoryCount": "number",
    "largestBalance": "number"
  }
}
```

**Journal Report** - `/api/reports/journal-report`

- Complete general ledger entries
- Debit and credit columns
- Account-level transaction details
- Transaction type breakdown
- Memo/description fields

#### Agent Current Access: ⚠️ PARTIAL

- ✅ Can get total expenses from P&L report
- ✅ Can get expense breakdowns by category
- ❌ Cannot get vendor-specific data
- ❌ Cannot get bill-level details
- ❌ Cannot get payment status or aging
- ❌ Cannot access journal entries

---

### 3. Reports Pages Data Access

#### Available in UI (`/reports/*` pages)

**Financial Reports Available:**

1. **Profit & Loss** (`/api/reports/profit-loss`)
   - Revenue, COGS, Operating Expenses, Other Expenses
   - Gross Profit, Net Income, Margins
   - Monthly trends and category breakdowns
   - YoY/QoQ comparisons
   - EBITDA components

2. **Balance Sheet** (`/api/reports/balance-sheet`)
   - Assets, Liabilities, Equity breakdowns
   - Current ratio, Quick ratio, Debt-to-equity
   - ROA, ROE calculations
   - Asset composition and liability structure
   - Working capital analysis

3. **Cash Flow** (`/api/reports/cash-flow`)
   - Operating, Investing, Financing activities
   - Beginning and ending cash
   - Net cash change
   - Free cash flow calculation

4. **Accounts Receivable Aging** (`/api/reports/aged-receivables`)
   - Customer balances by aging bucket
   - Overdue invoice tracking
   - Credit risk assessment

5. **Accounts Payable Aging** (`/api/reports/aged-payables`)
   - Vendor balances by aging bucket
   - Payment prioritization
   - Cash flow planning

6. **Executive Summary** (`/api/reports/executive-summary`)
   - Financial health score
   - Key insights and recommendations
   - Trend analysis
   - Alert conditions

#### Agent Current Access: ✅ GOOD

- ✅ Full access to P&L, Balance Sheet, Cash Flow
- ✅ Can calculate financial ratios and metrics
- ✅ Can generate insights and recommendations
- ❌ Cannot access aging reports directly
- ❌ Cannot drill down to transaction level

---

## Gap Analysis Table

| Feature Category       | Specific Capability       | UI Has | Agent Has | Priority | Implementation Effort |
| ---------------------- | ------------------------- | ------ | --------- | -------- | --------------------- |
| **Sales - Customer**   | Customer list with totals | ✅     | ❌        | P0       | Medium                |
|                        | Transaction history       | ✅     | ❌        | P0       | Medium                |
|                        | Outstanding invoices      | ✅     | ❌        | P0       | Low                   |
|                        | Market share analysis     | ✅     | ❌        | P1       | Low                   |
|                        | Average transaction value | ✅     | ❌        | P1       | Low                   |
| **Sales - Product**    | Product performance       | ✅     | ❌        | P0       | Medium                |
|                        | Quantity & pricing        | ✅     | ❌        | P0       | Low                   |
|                        | Product type analysis     | ✅     | ❌        | P1       | Low                   |
| **Expenses - Vendors** | Vendor spending breakdown | ✅     | ❌        | P1       | Medium                |
|                        | Vendor balances           | ✅     | ❌        | P1       | Low                   |
|                        | Transaction history       | ✅     | ❌        | P2       | Medium                |
| **Expenses - Bills**   | Bill details & line items | ✅     | ❌        | P1       | Medium                |
|                        | Due date tracking         | ✅     | ❌        | P0       | Low                   |
|                        | Payment status            | ✅     | Partial   | P1       | Low                   |
|                        | AP aging analysis         | ✅     | ❌        | P2       | Medium                |
| **Financial Reports**  | P&L Statement             | ✅     | ✅        | -        | -                     |
|                        | Balance Sheet             | ✅     | ✅        | -        | -                     |
|                        | Cash Flow                 | ✅     | ✅        | -        | -                     |
|                        | AR Aging                  | ✅     | ❌        | P2       | Medium                |
|                        | AP Aging                  | ✅     | ❌        | P2       | Medium                |
|                        | Executive Summary         | ✅     | ✅        | -        | -                     |
| **Advanced Analytics** | Transaction drill-down    | ✅     | ❌        | P2       | High                  |
|                        | Custom date ranges        | ✅     | ✅        | -        | -                     |
|                        | Filtering by entity       | ✅     | Partial   | P2       | Medium                |
|                        | Export capabilities       | ✅     | Partial   | P3       | Low                   |

---

## Implementation Roadmap

### Phase 1: Critical Sales Data (Week 1)

**Goal:** Give agent visibility into sales performance

#### 1.1 Add Sales by Customer Method

```typescript
private async getSalesByCustomer(): Promise<string> {
  const response = await fetch('/api/sales/customer');
  // Transform and return customer sales data with visualization hints
}
```

**Intent mappings to add:**

- "show me sales by customer"
- "which customers buy the most"
- "customer revenue breakdown"
- "who are my top customers"

#### 1.2 Add Sales by Product Method

```typescript
private async getSalesByProduct(): Promise<string> {
  const response = await fetch('/api/sales/product');
  // Transform and return product performance data with visualization hints
}
```

**Intent mappings to add:**

- "show me sales by product"
- "which products sell best"
- "product revenue analysis"
- "what are my top selling items"

#### 1.3 Add Outstanding Invoices Method

```typescript
private async getOutstandingInvoices(): Promise<string> {
  // Get unpaid/partially paid invoices with aging
}
```

---

### Phase 2: Expense Details & Vendor Analysis (Week 2)

**Goal:** Provide detailed expense visibility

#### 2.1 Add Vendor Analysis Method

```typescript
private async getVendorAnalysis(): Promise<string> {
  const response = await fetch('/api/expenses/vendors');
  // Return vendor spending breakdown with balances
}
```

**Intent mappings to add:**

- "show vendor spending"
- "which vendors do we pay the most"
- "vendor analysis"
- "who do we owe money to"

#### 2.2 Add Bill Details Method

```typescript
private async getBillDetails(filters?: BillFilters): Promise<string> {
  const response = await fetch('/api/expenses/bills');
  // Return detailed bill information with status
}
```

**Intent mappings to add:**

- "show me unpaid bills"
- "bills due this week"
- "overdue bills"
- "bill payment status"

---

### Phase 3: Aging Reports & Advanced Analytics (Week 3)

**Goal:** Enable advanced financial analysis

#### 3.1 Add AR Aging Method

```typescript
private async getARAgingReport(): Promise<string> {
  const response = await fetch('/api/reports/aged-receivables');
  // Return customer aging buckets with visualization
}
```

#### 3.2 Add AP Aging Method

```typescript
private async getAPAgingReport(): Promise<string> {
  const response = await fetch('/api/reports/aged-payables');
  // Return vendor aging buckets with visualization
}
```

#### 3.3 Add Journal Entries Access

```typescript
private async getJournalEntries(filters?: JournalFilters): Promise<string> {
  const response = await fetch('/api/reports/journal-report');
  // Return general ledger transactions
}
```

---

### Phase 4: Enhanced Drill-Down Capabilities (Week 4)

**Goal:** Enable transaction-level analysis

#### 4.1 Add Transaction Detail Methods

- getInvoiceDetails(invoiceId)
- getBillDetails(billId)
- getCustomerTransactions(customerId)
- getVendorTransactions(vendorId)

#### 4.2 Add Advanced Filtering

- Date range filters for all methods
- Status filters (paid/unpaid/overdue)
- Amount range filters
- Entity-specific queries

---

## Success Metrics

### Coverage Metrics

- **Current State:** ~30% feature coverage
- **Phase 1 Target:** 50% coverage (sales data added)
- **Phase 2 Target:** 65% coverage (expense details added)
- **Phase 3 Target:** 80% coverage (aging reports added)
- **Phase 4 Target:** 90% coverage (drill-down added)

### Query Success Rate

- Track % of financial questions the agent can answer
- Target: 95% of common business questions

### Data Accuracy

- Ensure agent data matches UI displays exactly
- Implement validation tests for each method

---

## Testing Plan

### Unit Tests for Each Method

1. Test data retrieval and transformation
2. Verify visualization hints generation
3. Test error handling

### Integration Tests

1. Test intent mapping accuracy
2. Verify caching behavior
3. Test with real QuickBooks data

### User Acceptance Tests

1. "Show me my top 5 customers" → Correct data
2. "Which bills are overdue?" → Accurate list
3. "Product sales analysis" → Proper breakdown
4. "Vendor spending last quarter" → Filtered results

---

## Appendix: Current UnifiedDataTool Methods

### Currently Implemented

- getKPIsOptimized()
- getExpensesOptimized()
- getRevenueOptimized()
- getCashFlowOptimized()
- getRunwayAnalysisOptimized()
- getProfitLossReport()
- getBalanceSheetReport()
- getCashFlowStatementReport()
- getExecutiveSummaryReport()
- getComprehensiveAnalysisWithInsights()

### To Be Implemented (Priority Order)

1. getSalesByCustomer() - P0
2. getSalesByProduct() - P0
3. getOutstandingInvoices() - P0
4. getVendorAnalysis() - P1
5. getBillDetails() - P1
6. getOverdueBills() - P1
7. getARAgingReport() - P2
8. getAPAgingReport() - P2
9. getJournalEntries() - P2
10. getTransactionDetails() - P3

---

## Conclusion

The agent currently lacks critical sales and expense detail capabilities that are essential for comprehensive business analysis. Implementing the Phase 1 and Phase 2 items will bring the agent to functional parity with the most important UI features, while Phases 3 and 4 will enable advanced analytics and drill-down capabilities.

The implementation should focus on reusing existing API endpoints and maintaining consistency with the data structures already displayed in the UI. Each new method should include appropriate visualization hints and natural language intent mappings to ensure a seamless user experience.

---

_Document created: November 2, 2025_
_Last updated: November 2, 2025_
