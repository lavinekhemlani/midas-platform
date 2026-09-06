// src/ai/tools/business-central-data/schema.ts
// Zod validation schema for Business Central data tool
// Follows the same flat-object pattern as quickbooks-data/schema.ts

import { z } from 'zod'

export const businessCentralDataSchema = z
  .object({
    // Query type discriminator
    queryType: z
      .enum(['report', 'entity', 'metric', 'search', 'analyze', 'compare', 'detail'])
      .describe('Type of query to execute'),

    // ===== REPORT QUERY FIELDS (required when queryType="report") =====
    reportType: z
      .enum([
        'trial_balance',
        'profit_loss',
        'balance_sheet',
        'cash_flow',
        'aged_receivables',
        'aged_payables',
        'sales_by_customer',
        'purchases_by_vendor',
        'inventory_valuation',
        'monthly_pnl_trend',
        'sales_by_item',
        'purchases_by_item',
        'enhanced_financial_summary',
        'sales_by_geography',
        'monthly_cash_trend',
        'cash_flow_by_activity',
        'inventory_enhanced',
      ])
      .optional()
      .nullable()
      .describe(
        'Type of financial report to fetch (required when queryType="report"). ' +
          'trial_balance: chart of accounts with balances. ' +
          'profit_loss: revenue, COGS, expenses from GL entries by account category. ' +
          'balance_sheet: assets, liabilities, equity from GL. ' +
          'cash_flow: cash movement analysis. ' +
          'aged_receivables: customer aging from customer ledger entries. ' +
          'aged_payables: vendor aging from vendor ledger entries. ' +
          'sales_by_customer: revenue by customer from sales invoices. ' +
          'purchases_by_vendor: spending by vendor from purchase invoices. ' +
          'sales_by_item: revenue by item/SKU from sales invoice lines — use for top-selling products, SKU analysis. ' +
          'purchases_by_item: spending by item/SKU from purchase invoice lines — use for top-purchased items. ' +
          'inventory_valuation: total inventory valuation across all items — use for overall stock value questions. For a SPECIFIC item, use queryType="detail" with detailType="item_detail" instead. ' +
          'monthly_pnl_trend: month-by-month P&L breakdown. ' +
          'enhanced_financial_summary: comprehensive dashboard with top customers/vendors, aged AR/AP, financial ratios, efficiency metrics, cash runway, and inventory summary. ' +
          'sales_by_geography: sales aggregated by country and city from invoice ship-to/sell-to addresses. ' +
          'monthly_cash_trend: month-by-month cash position with inflows, outflows, and running balance from cash/bank GL accounts. ' +
          'cash_flow_by_activity: monthly GL activity bucketed into operating, investing, and financing categories. ' +
          'inventory_enhanced: comprehensive inventory with ABC classification, health scores, slow-moving items, turnover ratios, per-location stats, category breakdown, AND monthly movement trend (purchases/sales/adjustments by month using costAmountActual from item ledger entries). USE THIS for any question about inventory movement, stock movement over time, or purchase/sale trends by month — NOT item_ledger_entry entities or sales_by_item.'
      ),

    // ===== ENTITY QUERY FIELDS (required when queryType="entity") =====
    entityType: z
      .enum([
        'customer',
        'vendor',
        'item',
        'account',
        'sales_invoice',
        'purchase_invoice',
        'general_ledger_entry',
        'bank_account',
        'purchase_order',
        'purchase_credit_memo',
        'purchase_receipt',
        'vendor_payment_journal',
        'journal_line',
        'dimension',
        'item_ledger_entry',
        'sales_credit_memo',
        'sales_shipment',
      ])
      .optional()
      .nullable()
      .describe(
        'Type of entity to fetch (required when queryType="entity"). ' +
          'purchase_order: open/pending purchase orders. ' +
          'purchase_credit_memo: purchase credit memos. ' +
          'purchase_receipt: received goods/purchase receipts. ' +
          'vendor_payment_journal: vendor payment journal entries. ' +
          'journal_line: general journal lines. ' +
          'dimension: dimension values (cost centers, departments, projects). ' +
          'item_ledger_entry: item ledger entries with location/lot codes and stock movements. ' +
          'sales_credit_memo: sales credit memos. ' +
          'sales_shipment: sales shipment records.'
      ),

    // ===== DETAIL QUERY FIELDS (required when queryType="detail") =====
    detailType: z
      .enum([
        'customer_detail',
        'vendor_detail',
        'account_detail',
        'item_detail',
        'cashflow_item_detail',
        'document_lines',
      ])
      .optional()
      .nullable()
      .describe(
        'Type of detail drilldown (required when queryType="detail"). ' +
          'customer_detail: full customer profile with invoices, credit memos, shipments, and aged AR. Accepts customerName (partial match), customerNumber, or customerId. ' +
          'vendor_detail: full vendor profile with invoices, orders, credit memos, receipts, and aged AP. Accepts vendorName (partial match), vendorId, or vendorNumber. ' +
          'account_detail: GL account drilldown with transaction history, monthly trend, and sub-ledger context. Requires accountNumber. ' +
          'item_detail: deep-dive into a SPECIFIC inventory item — full item card, all ledger entries, monthly movement chart, dimensions, avg selling price, and inventory value. Accepts itemName (partial match) or itemNumber. ' +
          'cashflow_item_detail: cash flow line item breakdown by account with monthly trend. Requires cashflowItemType. ' +
          'document_lines: individual line items on an invoice, order, credit memo, or shipment. Requires documentType and documentId.'
      ),
    // Detail-specific identifiers
    accountNumber: z
      .string()
      .optional()
      .nullable()
      .describe('Account number for account_detail drilldown'),
    customerNumber: z
      .string()
      .optional()
      .nullable()
      .describe('Customer number for customer_detail drilldown'),
    customerId: z
      .string()
      .optional()
      .nullable()
      .describe('Customer GUID for customer_detail drilldown (alternative to customerNumber)'),
    vendorId: z.string().optional().nullable().describe('Vendor GUID for vendor_detail drilldown'),
    vendorName: z
      .string()
      .optional()
      .nullable()
      .describe(
        'Vendor name (partial match) for vendor_detail drilldown. Use when you have the vendor name but not the GUID. ' +
          'The handler will search for matching vendors automatically.'
      ),
    customerName: z
      .string()
      .optional()
      .nullable()
      .describe(
        'Customer name (partial match) for customer_detail drilldown. Use when you have the customer name but not the number/GUID. ' +
          'The handler will search for matching customers automatically.'
      ),
    itemNumber: z.string().optional().nullable().describe('Item number for item_detail drilldown'),
    itemName: z
      .string()
      .optional()
      .nullable()
      .describe(
        'Item name (partial match) for item_detail drilldown. Use when you have the item name but not the number. ' +
          'The handler will search for matching items automatically.'
      ),
    documentType: z
      .enum([
        'invoice',
        'order',
        'creditMemo',
        'receipt',
        'salesInvoice',
        'salesCreditMemo',
        'salesShipment',
      ])
      .optional()
      .nullable()
      .describe(
        'Document type for document_lines detail. ' +
          'Purchase side: invoice, order, creditMemo, receipt. ' +
          'Sales side: salesInvoice, salesCreditMemo, salesShipment.'
      ),
    documentId: z
      .string()
      .optional()
      .nullable()
      .describe('Document GUID for document_lines detail'),
    cashflowItemType: z
      .string()
      .optional()
      .nullable()
      .describe(
        'Cash flow item type for cashflow_item_detail. ' +
          'Examples: ar-change, ap-change, inventory-change, depreciation, capex, ' +
          'debt-proceeds, debt-repayments, equity-changes, net-income, other-operating'
      ),

    // ===== ANALYZE QUERY FIELDS (required when queryType="analyze") =====
    analysisType: z
      .enum(['trends', 'anomalies', 'breakdown', 'performance'])
      .optional()
      .nullable()
      .describe('Type of analysis to perform (required when queryType="analyze")'),
    focusArea: z
      .enum(['revenue', 'expenses', 'cash_flow', 'profitability', 'inventory'])
      .optional()
      .nullable()
      .describe('Specific area to focus analysis on'),

    // ===== COMPARE QUERY FIELDS (required when queryType="compare") =====
    compareType: z
      .enum(['period'])
      .optional()
      .nullable()
      .describe('Type of comparison to perform (required when queryType="compare")'),
    currentStartDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional()
      .nullable()
      .describe('Current period start date in YYYY-MM-DD format'),
    currentEndDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional()
      .nullable()
      .describe('Current period end date in YYYY-MM-DD format'),
    comparisonStartDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional()
      .nullable()
      .describe('Comparison period start date in YYYY-MM-DD format'),
    comparisonEndDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional()
      .nullable()
      .describe('Comparison period end date in YYYY-MM-DD format'),

    // ===== METRIC QUERY FIELDS (required when queryType="metric") =====
    metricName: z
      .string()
      .optional()
      .nullable()
      .describe(
        'Name of the financial metric/KPI to calculate (required when queryType="metric"). ' +
          'Accepts any standard financial metric name — e.g. gross_margin, dso, current_ratio, burn_rate, roa, working_capital, cash_conversion_cycle, etc. ' +
          'For full financial statements with line-item detail, prefer queryType="report" with the appropriate reportType instead.'
      ),

    // ===== SEARCH QUERY FIELDS (required when queryType="search") =====
    searchText: z
      .string()
      .optional()
      .nullable()
      .describe('Text to search for in entity names (required when queryType="search")'),
    searchScope: z
      .enum(['all', 'customers', 'vendors', 'items', 'accounts'])
      .optional()
      .nullable()
      .default('all')
      .describe('Scope of search'),

    // ===== FILTERS (used by multiple query types) =====
    filters: z
      .object({
        accountCategory: z
          .string()
          .optional()
          .nullable()
          .describe('Filter by account category (e.g., "Income", "Expense", "Cost of Goods Sold")'),
        accountName: z
          .string()
          .optional()
          .nullable()
          .describe('Filter by account name or number (partial match, e.g., "Rent", "Sales")'),
        customerName: z
          .string()
          .optional()
          .nullable()
          .describe('Filter by customer display name (partial match)'),
        customerNumber: z
          .string()
          .optional()
          .nullable()
          .describe(
            'Filter by customer number (exact match). Use this instead of customerName when you have the customer code/number.'
          ),
        vendorName: z
          .string()
          .optional()
          .nullable()
          .describe('Filter by vendor display name (partial match)'),
        vendorNumber: z
          .string()
          .optional()
          .nullable()
          .describe(
            'Filter by vendor number (exact match). Use this instead of vendorName when you have the vendor code/number.'
          ),
        itemNo: z
          .string()
          .optional()
          .nullable()
          .describe('Filter by item number (exact match, e.g., "F-239")'),
        itemName: z
          .string()
          .optional()
          .nullable()
          .describe('Filter by item name/description (partial match)'),
        itemCategory: z.string().optional().nullable().describe('Filter by item category'),
        department: z
          .string()
          .optional()
          .nullable()
          .describe('Filter by department/cost center (global_dimension_1_code)'),
        status: z
          .string()
          .optional()
          .nullable()
          .describe('Filter by document status (e.g., "Open", "Paid", "Draft", "Canceled")'),
        documentNumber: z
          .string()
          .optional()
          .nullable()
          .describe(
            'Filter by document number (e.g., invoice number, receipt number, order number). Works on entity queries for invoices, receipts, orders, credit memos.'
          ),
        minAmount: z.number().optional().nullable(),
        maxAmount: z.number().optional().nullable(),
      })
      .optional()
      .nullable()
      .describe('Filters to apply to the query'),

    // ===== SHARED FIELDS =====
    period: z
      .enum([
        'this_month',
        'last_month',
        'this_quarter',
        'last_quarter',
        'this_year',
        'last_year',
        'ytd',
        'last_30_days',
        'last_90_days',
      ])
      .optional()
      .nullable()
      .describe('Predefined time period'),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional()
      .nullable()
      .describe(
        `Start date in YYYY-MM-DD format. ` +
          `IMPORTANT: If user specifies a date or period, use that. Otherwise, default to start of this year: ${new Date().getFullYear()}-01-01.`
      ),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional()
      .nullable()
      .describe(
        `End date in YYYY-MM-DD format. ` +
          `IMPORTANT: If user specifies a date or period, use that. Otherwise, default to today's date: ${new Date().toISOString().split('T')[0]}.`
      ),

    summarizeBy: z
      .enum(['month', 'quarter', 'year'])
      .optional()
      .nullable()
      .describe(
        'Time aggregation granularity. Groups report data by month, quarter, or year. ' +
          'Applies to: profit_loss, monthly_pnl_trend, cash_flow, balance_sheet, ' +
          'sales_by_customer, purchases_by_vendor, sales_by_item, purchases_by_item, trial_balance. ' +
          'Defaults to month when omitted.'
      ),

    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .nullable()
      .default(100)
      .describe('Maximum number of results to return'),
  })
  // .strict()
  .passthrough()
