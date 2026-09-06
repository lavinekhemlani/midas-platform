// src/ai/tools/quickbooks-data/schema.ts
// Zod validation schemas for QuickBooks data tool

import { z } from 'zod'

// =============================================================================
// Common Schema Pieces
// =============================================================================

const periodEnum = z.enum([
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

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')

// =============================================================================
// Flattened Schema for LLM Compatibility
// =============================================================================
// Note: Using a flat object schema instead of discriminated union to avoid
// Claude API validation issues. The API validates ALL union variants instead
// of using the discriminator, which causes spurious validation errors.

export const quickbooksDataSchema = z
  .object({
    // Query type discriminator
    queryType: z
      .enum(['report', 'analyze', 'compare', 'entity', 'metric', 'search'])
      .describe('Type of query to execute'),

    // Multi-entity: specify which QB company to query
    realmId: z
      .string()
      .optional()
      .describe(
        'QuickBooks company realmId to query. Use this when the user mentions a specific company by name. ' +
          'If omitted, queries the active/default company.'
      ),

    // ===== REPORT QUERY FIELDS (required when queryType="report") =====
    reportType: z
      .enum([
        'profit_loss',
        'balance_sheet',
        'cash_flow',
        'aged_receivables',
        'aged_receivables_detail',
        'aged_payables',
        'aged_payables_detail',
        'financial_health',
        'sales',
        'bills',
      ])
      .optional()
      .nullable()
      .describe(
        'Type of financial report to fetch (required when queryType="report"). ' +
          'profit_loss: revenue, expenses, net income, margins. ' +
          'balance_sheet: assets, liabilities, equity, ratios. ' +
          'cash_flow: operating/investing/financing cash flows. ' +
          'aged_receivables: summary of outstanding customer invoices by aging bucket. ' +
          'aged_receivables_detail: detailed list of individual invoices with dates, due dates, and terms. ' +
          'aged_payables: summary of outstanding vendor bills by aging bucket. ' +
          'aged_payables_detail: detailed list of individual bills with dates, due dates, and terms. ' +
          'financial_health: comprehensive metrics from all reports. ' +
          'sales: invoice and sales receipt aggregation by customer. ' +
          'bills: bill aggregation by vendor with payment status.'
      ),

    // ===== ANALYZE QUERY FIELDS (required when queryType="analyze") =====
    analysisType: z
      .enum(['trends', 'anomalies', 'forecast', 'breakdown', 'performance'])
      .optional()
      .nullable()
      .describe('Type of analysis to perform (required when queryType="analyze")'),
    focusArea: z
      .enum(['revenue', 'expenses', 'cash_flow', 'profitability', 'liquidity'])
      .optional()
      .nullable()
      .describe('Specific area to focus analysis on (optional for queryType="analyze")'),
    includeRecommendations: z
      .boolean()
      .optional()
      .nullable()
      .describe(
        'Whether to include AI-generated recommendations (optional for queryType="analyze")'
      ),

    // ===== COMPARE QUERY FIELDS (required when queryType="compare") =====
    compareType: z
      .enum(['period', 'budget', 'forecast', 'benchmark'])
      .optional()
      .nullable()
      .describe('Type of comparison to perform (required when queryType="compare")'),
    compareReportType: z
      .enum(['profit_loss', 'balance_sheet', 'cash_flow', 'aged_receivables', 'aged_payables'])
      .optional()
      .nullable()
      .describe('The report type to compare (defaults to profit_loss if not specified)'),
    metric: z
      .enum(['revenue', 'expenses', 'profit', 'cash_flow', 'margins'])
      .optional()
      .nullable()
      .describe('Specific metric to compare (optional for queryType="compare")'),
    currentPeriod: z
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
      .describe('Current period for comparison (optional for queryType="compare")'),
    comparisonPeriod: z
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
      .describe('Period to compare against (optional for queryType="compare")'),
    currentStartDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional()
      .nullable()
      .describe(
        'Current period start date in YYYY-MM-DD format (optional for queryType="compare")'
      ),
    currentEndDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional()
      .nullable()
      .describe('Current period end date in YYYY-MM-DD format (optional for queryType="compare")'),
    comparisonStartDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional()
      .nullable()
      .describe(
        'Comparison period start date in YYYY-MM-DD format (optional for queryType="compare")'
      ),
    comparisonEndDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional()
      .nullable()
      .describe(
        'Comparison period end date in YYYY-MM-DD format (optional for queryType="compare")'
      ),

    // ===== ENTITY QUERY FIELDS (required when queryType="entity") =====
    entityType: z
      .enum([
        'account',
        'bill',
        'class',
        'customer',
        'department',
        'invoice',
        'item',
        'payment',
        'purchase',
        'transaction',
        'vendor',
      ])
      .optional()
      .nullable()
      .describe('Type of entity to fetch (required when queryType="entity")'),
    entityId: z
      .string()
      .optional()
      .nullable()
      .describe('Specific entity ID to fetch (optional for queryType="entity")'),
    filters: z
      .object({
        status: z
          .enum(['active', 'inactive', 'all', 'open', 'paid', 'overdue', 'unpaid', 'closed'])
          .optional()
          .nullable(),
        minAmount: z.number().nullish(),
        maxAmount: z.number().nullish(),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
          .optional()
          .nullable(),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
          .optional()
          .nullable(),
        category: z.string().nullish(),
        customerId: z
          .string()
          .optional()
          .nullable()
          .describe('QuickBooks Customer ID to filter invoices by specific customer'),
        customerName: z
          .string()
          .optional()
          .nullable()
          .describe(
            'Customer name to filter invoices (partial match supported). ' +
              'Use this when you know the customer name but not their ID.'
          ),
        vendorId: z
          .string()
          .optional()
          .nullable()
          .describe('QuickBooks Vendor ID to filter bills by specific vendor'),
        vendorName: z
          .string()
          .optional()
          .nullable()
          .describe(
            'Vendor name to filter bills (partial match supported). ' +
              'Use this when you know the vendor name but not their ID.'
          ),
        sortBy: z
          .string()
          .optional()
          .nullable()
          .describe('Field to sort results by (e.g., txnDate, total, customerName, balance)'),
        sortOrder: z
          .enum(['asc', 'desc'])
          .optional()
          .nullable()
          .describe('Sort order: asc for ascending, desc for descending'),
        docNumber: z
          .string()
          .optional()
          .nullable()
          .describe(
            'Document number to filter by (e.g., INV-2360, 2360, BILL-1234). ' +
              'Uses partial matching to find documents. ' +
              'Use this for invoice number or bill number lookups.'
          ),
      })
      .optional()
      .nullable()
      .describe(
        'Filters to apply when fetching entities. For invoice/bill number lookup, use docNumber. ' +
          'For invoices by customer, use customerId/customerName. ' +
          'For bills by vendor, use vendorId/vendorName. Use sortBy/sortOrder to sort results.'
      ),
    includePdfActions: z
      .boolean()
      .optional()
      .nullable()
      .default(false)
      .describe(
        'Set to true ONLY when user explicitly asks for PDF downloads, viewing PDFs, or invoice documents. ' +
          'Examples: "download invoice PDFs", "view invoice PDF", "get PDF for invoice", "show invoice documents". ' +
          'Do NOT set this for general invoice queries like "show invoices" or "which customer owes me money".'
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .nullable()
      .default(100)
      .describe(
        'Maximum number of results to return (optional for queryType="entity" or "search")'
      ),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .nullable()
      .default(0)
      .describe('Number of results to skip for pagination (optional for queryType="entity")'),
    sortBy: z
      .string()
      .optional()
      .nullable()
      .describe('Field to sort results by (e.g., txnDate, total, customerName, balance)'),
    sortOrder: z
      .enum(['asc', 'desc'])
      .optional()
      .nullable()
      .describe('Sort order: asc for ascending, desc for descending'),

    // ===== METRIC QUERY FIELDS (required when queryType="metric") =====
    metricName: z
      .enum([
        'asset_turnover',
        'burn_rate',
        'cash_balance',
        'cash_conversion_cycle',
        'cash_flow_margin',
        'cash_ratio',
        'current_ratio',
        'customer_growth',
        'debt_ratio',
        'debt_to_equity',
        'dpo',
        'dso',
        'ebitda_margin',
        'equity_ratio',
        'expense_growth',
        'free_cash_flow',
        'gross_margin',
        'gross_profit',
        'interest_coverage',
        'inventory_turnover',
        'net_margin',
        'operating_cash_flow',
        'operating_income',
        'operating_margin',
        'payables_turnover',
        'profit_growth',
        'quick_ratio',
        'receivables_turnover',
        'revenue_growth',
        'roa',
        'roe',
        'runway_months',
        'working_capital',
      ])
      .optional()
      .nullable()
      .describe('Name of the metric/KPI to calculate (required when queryType="metric")'),
    includeHistory: z
      .boolean()
      .optional()
      .nullable()
      .default(false)
      .describe('Include historical trend data for the metric (optional for queryType="metric")'),

    // ===== SEARCH QUERY FIELDS (required when queryType="search") =====
    searchText: z
      .string()
      .optional()
      .nullable()
      .describe('Natural language search query (required when queryType="search")'),
    searchScope: z
      .enum(['all', 'transactions', 'entities', 'reports'])
      .optional()
      .nullable()
      .default('all')
      .describe('Scope of search (optional for queryType="search")'),

    // ===== SHARED FIELDS (used by multiple query types) =====
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
      .describe('Predefined time period (optional for most query types)'),
    summarizeBy: z
      .string()
      .optional()
      .nullable()
      .describe(
        'Time aggregation for trend data. Must be one of: Month, Quarter, Year, Total (case-insensitive). ' +
          'IMPORTANT: For profit_loss reports, using summarizeBy="Month" returns EACH service line/income category with its own monthly breakdown in lineItemMonthlyDetail. ' +
          'Use this when user asks about service line performance over time.'
      ),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional()
      .nullable()
      .describe(
        `Start date in YYYY-MM-DD format. Current date and time: ${new Date().toISOString()} (${new Date().toLocaleString()}). ` +
          `IMPORTANT: If user specifies a date or period, use that. Otherwise, ALWAYS default to start of this year: ${new Date().getFullYear()}-01-01.`
      ),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional()
      .nullable()
      .describe(
        `End date in YYYY-MM-DD format. Current date and time: ${new Date().toISOString()} (${new Date().toLocaleString()}). ` +
          `IMPORTANT: If user specifies a date or period, use that. Otherwise, ALWAYS default to today's date: ${new Date().toISOString().split('T')[0]}.`
      ),
  })
  .strict()
