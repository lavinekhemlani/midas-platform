// src/ai/tools/business-central-data/query-builder.ts
// Translates BC tool schema inputs into Redshift SQL queries
// Uses hardcoded templates for safety — never lets the LLM write raw SQL

import type { BCDataInput } from './types'

// ============================================================================
// Fivetran XML Encoding Helpers
// ============================================================================

/**
 * Encode a human-readable value to Fivetran XML format for WHERE clauses.
 * Fivetran encodes enum fields: spaces → _x0020_, hyphens → _x002D_
 */
export function encodeForFivetran(value: string): string {
  return value.replace(/ /g, '_x0020_').replace(/-/g, '_x002D_')
}

/**
 * SQL expression to decode Fivetran XML encoding in SELECT clauses.
 * Use this to make output human-readable.
 */
export function decodeFivetranSQL(column: string): string {
  return `REPLACE(REPLACE(${column}, '_x0020_', ' '), '_x002D_', '-')`
}

// ============================================================================
// Date Range Resolution
// ============================================================================

interface DateRange {
  startDate: string
  endDate: string
}

export function resolveDateRange(input: BCDataInput): DateRange {
  // If explicit dates provided, use them
  if (input.startDate && input.endDate) {
    return { startDate: input.startDate, endDate: input.endDate }
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed

  if (input.period) {
    switch (input.period) {
      case 'this_month': {
        const start = new Date(year, month, 1)
        return { startDate: fmt(start), endDate: fmt(now) }
      }
      case 'last_month': {
        const start = new Date(year, month - 1, 1)
        const end = new Date(year, month, 0)
        return { startDate: fmt(start), endDate: fmt(end) }
      }
      case 'this_quarter': {
        const qStart = Math.floor(month / 3) * 3
        const start = new Date(year, qStart, 1)
        return { startDate: fmt(start), endDate: fmt(now) }
      }
      case 'last_quarter': {
        const qStart = Math.floor(month / 3) * 3 - 3
        const start = new Date(year, qStart, 1)
        const end = new Date(year, qStart + 3, 0)
        return { startDate: fmt(start), endDate: fmt(end) }
      }
      case 'this_year':
        return { startDate: `${year}-01-01`, endDate: fmt(now) }
      case 'last_year':
        return { startDate: `${year - 1}-01-01`, endDate: `${year - 1}-12-31` }
      case 'ytd':
        return { startDate: `${year}-01-01`, endDate: fmt(now) }
      case 'last_30_days': {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        return { startDate: fmt(start), endDate: fmt(now) }
      }
      case 'last_90_days': {
        const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        return { startDate: fmt(start), endDate: fmt(now) }
      }
    }
  }

  // Default: this year (YTD)
  return { startDate: `${year}-01-01`, endDate: fmt(now) }
}

/**
 * Format a Date object to YYYY-MM-DD string using local timezone.
 * Do NOT use toISOString() as it converts to UTC and can shift dates
 * across midnight boundaries (e.g., midnight IST becomes previous day in UTC).
 */
function fmt(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ============================================================================
// SQL Builders
// ============================================================================

/**
 * Returns a Redshift DATE_TRUNC expression for time period grouping.
 * Maps summarizeBy parameter to the appropriate truncation level.
 */
function getDateTrunc(summarizeBy?: string | null, alias = 'g'): string {
  const level =
    summarizeBy?.toLowerCase() === 'quarter'
      ? 'quarter'
      : summarizeBy?.toLowerCase() === 'year'
        ? 'year'
        : 'month'
  return `DATE_TRUNC('${level}', ${alias}.posting_date)::date`
}

/**
 * Returns a SQL WHERE fragment for department/cost center filtering.
 * BC stores department in global_dimension_1_code on g_l_entry.
 * @param alias - table alias for g_l_entry (e.g., 'g')
 */
function departmentFilter(input: BCDataInput, alias = 'g'): string {
  if (!input.filters?.department) return ''
  const dept = input.filters.department.replace(/'/g, "''")
  return `\n  AND ${alias}.global_dimension_1_code = '${dept}'`
}

/**
 * Common WHERE clause fragments for GL entry queries
 */
function glEntryFilters(schema: string, dateRange: DateRange, extraWhere = ''): string {
  return `FROM ${schema}.g_l_entry
WHERE _fivetran_deleted = false
  AND reversed = false
  AND posting_date >= '${dateRange.startDate}'
  AND posting_date <= '${dateRange.endDate}'${extraWhere}`
}

/**
 * Build the SQL query based on the input parameters
 */
export function buildQuery(
  input: BCDataInput,
  schema: string
): { sql: string; description: string } {
  const dateRange = resolveDateRange(input)
  // When summarizeBy is active, each entity produces one row per period.
  // Multiply the base limit so later periods aren't cut off by the row cap.
  const baseLimit = input.limit || 100
  const periodMultiplier = input.summarizeBy
    ? input.summarizeBy === 'year'
      ? 3
      : input.summarizeBy === 'quarter'
        ? 4
        : 12
    : 1
  const limit = baseLimit * periodMultiplier

  switch (input.queryType) {
    case 'report':
      return buildReportQuery(input, schema, dateRange, limit)
    case 'entity':
      return buildEntityQuery(input, schema, dateRange, limit)
    case 'metric':
      return buildMetricQuery(input, schema, dateRange)
    case 'search':
      return buildSearchQuery(input, schema, limit)
    case 'analyze':
      return buildAnalyzeQuery(input, schema, dateRange, limit)
    case 'compare':
      return buildCompareQuery(input, schema)
    default:
      return { sql: '', description: 'Unknown query type' }
  }
}

// ============================================================================
// Entity Count Query (for accurate totalCount in entity responses)
// ============================================================================

/**
 * Build a COUNT(*) query for entity types so the LLM gets the real total
 * (e.g., 373 customers) instead of just the LIMIT-capped row count (100).
 */
export function buildCountQuery(input: BCDataInput, schema: string): string | null {
  if (input.queryType !== 'entity') return null

  const dateRange = resolveDateRange(input)
  const filters = input.filters

  switch (input.entityType) {
    case 'customer': {
      const where = [`c._fivetran_deleted = false`]
      if (filters?.customerName)
        where.push(
          `LOWER(c.name) LIKE '%${filters.customerName.replace(/'/g, "''").toLowerCase()}%'`
        )
      if (filters?.minAmount) where.push(`COALESCE(c.balance_lcy, 0) >= ${filters.minAmount}`)
      return `SELECT COUNT(*) AS total FROM ${schema}.customer c WHERE ${where.join(' AND ')}`
    }

    case 'vendor': {
      const where = [`v._fivetran_deleted = false`]
      if (filters?.vendorName)
        where.push(`LOWER(v.name) LIKE '%${filters.vendorName.replace(/'/g, "''").toLowerCase()}%'`)
      return `SELECT COUNT(*) AS total FROM ${schema}.vendor v WHERE ${where.join(' AND ')}`
    }

    case 'item': {
      const where = [`i._fivetran_deleted = false`]
      if (filters?.itemNo) where.push(`i.no = '${filters.itemNo.replace(/'/g, "''")}'`)
      if (filters?.itemName)
        where.push(
          `LOWER(i.description) LIKE '%${filters.itemName.toLowerCase().replace(/'/g, "''")}%'`
        )
      return `SELECT COUNT(*) AS total FROM ${schema}.item i WHERE ${where.join(' AND ')}`
    }

    case 'account':
      return `SELECT COUNT(*) AS total FROM ${schema}.g_l_account a WHERE a._fivetran_deleted = false AND a.account_type = 'Posting'`

    case 'sales_invoice': {
      const where = [`h._fivetran_deleted = false`]
      if (filters?.customerName)
        where.push(
          `LOWER(h.sell_to_customer_name) LIKE '%${filters.customerName.replace(/'/g, "''").toLowerCase()}%'`
        )
      if (filters?.minAmount) where.push(`h.amount >= ${filters.minAmount}`)
      if (filters?.maxAmount) where.push(`h.amount <= ${filters.maxAmount}`)
      where.push(`h.posting_date >= '${dateRange.startDate}'`)
      where.push(`h.posting_date <= '${dateRange.endDate}'`)
      return `SELECT COUNT(*) AS total FROM ${schema}.sales_invoice_header h WHERE ${where.join(' AND ')}`
    }

    case 'purchase_invoice': {
      const where = [`h._fivetran_deleted = false`]
      if (filters?.vendorName)
        where.push(
          `LOWER(h.buy_from_vendor_name) LIKE '%${filters.vendorName.replace(/'/g, "''").toLowerCase()}%'`
        )
      if (filters?.minAmount) where.push(`h.amount >= ${filters.minAmount}`)
      if (filters?.maxAmount) where.push(`h.amount <= ${filters.maxAmount}`)
      where.push(`h.posting_date >= '${dateRange.startDate}'`)
      where.push(`h.posting_date <= '${dateRange.endDate}'`)
      return `SELECT COUNT(*) AS total FROM ${schema}.purch_inv_header h WHERE ${where.join(' AND ')}`
    }

    case 'general_ledger_entry': {
      const where = [
        `g._fivetran_deleted = false`,
        `g.reversed = false`,
        `g.posting_date >= '${dateRange.startDate}'`,
        `g.posting_date <= '${dateRange.endDate}'`,
      ]
      if (filters?.department)
        where.push(`g.global_dimension_1_code = '${filters.department.replace(/'/g, "''")}'`)
      return `SELECT COUNT(*) AS total FROM ${schema}.g_l_entry g WHERE ${where.join(' AND ')}`
    }

    case 'bank_account':
      return `SELECT COUNT(*) AS total FROM ${schema}.bank_account b WHERE b._fivetran_deleted = false`

    default:
      return null
  }
}

// ============================================================================
// Report Queries
// ============================================================================

function buildReportQuery(
  input: BCDataInput,
  schema: string,
  dateRange: DateRange,
  limit: number
): { sql: string; description: string } {
  switch (input.reportType) {
    case 'trial_balance': {
      const tbDateTrunc = input.summarizeBy ? getDateTrunc(input.summarizeBy) : null
      return {
        sql: `SELECT
  ${tbDateTrunc ? `${tbDateTrunc} AS period,\n  ` : ''}a.no AS account_no,
  a.name AS account_name,
  ${decodeFivetranSQL('a.account_category')} AS account_category,
  ${decodeFivetranSQL('a.account_type')} AS account_type,
  COALESCE(SUM(g.debit_amount), 0) AS total_debits,
  COALESCE(SUM(g.credit_amount), 0) AS total_credits,
  COALESCE(SUM(g.debit_amount), 0) - COALESCE(SUM(g.credit_amount), 0) AS net_balance
FROM ${schema}.g_l_account a
LEFT JOIN ${schema}.g_l_entry g
  ON a.no = g.g_laccount_no AND a.company_id = g.company_id
  AND g._fivetran_deleted = false AND g.reversed = false
  AND g.posting_date >= '${dateRange.startDate}' AND g.posting_date <= '${dateRange.endDate}'${departmentFilter(input)}
WHERE a._fivetran_deleted = false
  AND a.account_type = 'Posting'
GROUP BY ${tbDateTrunc ? `${tbDateTrunc}, ` : ''}a.no, a.name, a.account_category, a.account_type
HAVING COALESCE(SUM(g.debit_amount), 0) != 0 OR COALESCE(SUM(g.credit_amount), 0) != 0
ORDER BY ${tbDateTrunc ? 'period, ' : ''}a.no`,
        // LIMIT ${limit} — removed: reports need all rows for correct totals
        description: `Trial Balance for ${dateRange.startDate} to ${dateRange.endDate}${input.summarizeBy ? ` (by ${input.summarizeBy})` : ''}${input.filters?.department ? ` (dept: ${input.filters.department})` : ''}`,
      }
    }

    case 'profit_loss': {
      const plDateTrunc = input.summarizeBy ? getDateTrunc(input.summarizeBy) : null
      return {
        sql: `SELECT
  ${plDateTrunc ? `${plDateTrunc} AS period,\n  ` : ''}${decodeFivetranSQL('a.account_category')} AS category,
  a.name AS account_name,
  a.no AS account_no,
  ${decodeFivetranSQL('a.account_subcategory_descript')} AS subcategory,
  CASE
    WHEN a.account_category = 'Income' THEN COALESCE(SUM(g.credit_amount), 0) - COALESCE(SUM(g.debit_amount), 0)
    ELSE COALESCE(SUM(g.debit_amount), 0) - COALESCE(SUM(g.credit_amount), 0)
  END AS amount
FROM ${schema}.g_l_account a
JOIN ${schema}.g_l_entry g
  ON a.no = g.g_laccount_no AND a.company_id = g.company_id
WHERE a._fivetran_deleted = false
  AND g._fivetran_deleted = false
  AND g.reversed = false
  AND a.account_type = 'Posting'
  AND a.account_category IN ('Income', 'Cost_x0020_of_x0020_Goods_x0020_Sold', 'Expense')
  AND g.posting_date >= '${dateRange.startDate}'
  AND g.posting_date <= '${dateRange.endDate}'${departmentFilter(input)}
GROUP BY ${plDateTrunc ? `${plDateTrunc}, ` : ''}a.account_category, a.name, a.no, a.account_subcategory_descript
ORDER BY ${plDateTrunc ? 'period, ' : ''}a.account_category, a.no`,
        description: `Profit & Loss for ${dateRange.startDate} to ${dateRange.endDate}${input.summarizeBy ? ` (by ${input.summarizeBy})` : ''}${input.filters?.department ? ` (dept: ${input.filters.department})` : ''}`,
      }
    }

    case 'balance_sheet': {
      const bsDateTrunc = input.summarizeBy ? getDateTrunc(input.summarizeBy) : null
      return {
        sql: `SELECT
  ${bsDateTrunc ? `${bsDateTrunc} AS period,\n  ` : ''}${decodeFivetranSQL('a.account_category')} AS category,
  a.name AS account_name,
  a.no AS account_no,
  ${decodeFivetranSQL('a.account_subcategory_descript')} AS subcategory,
  CASE
    WHEN a.account_category IN ('Assets') THEN COALESCE(SUM(g.debit_amount), 0) - COALESCE(SUM(g.credit_amount), 0)
    ELSE COALESCE(SUM(g.credit_amount), 0) - COALESCE(SUM(g.debit_amount), 0)
  END AS balance
FROM ${schema}.g_l_account a
JOIN ${schema}.g_l_entry g
  ON a.no = g.g_laccount_no AND a.company_id = g.company_id
WHERE a._fivetran_deleted = false
  AND g._fivetran_deleted = false
  AND g.reversed = false
  AND a.account_type = 'Posting'
  AND a.account_category IN ('Assets', 'Liabilities', 'Equity', 'Income', 'Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
  AND g.posting_date <= '${dateRange.endDate}'${bsDateTrunc ? `\n  AND g.posting_date >= '${dateRange.startDate}'` : ''}${departmentFilter(input)}
GROUP BY ${bsDateTrunc ? `${bsDateTrunc}, ` : ''}a.account_category, a.name, a.no, a.account_subcategory_descript
HAVING ABS(COALESCE(SUM(g.debit_amount), 0) - COALESCE(SUM(g.credit_amount), 0)) > 0.01
ORDER BY ${bsDateTrunc ? 'period, ' : ''}a.account_category, a.no`,
        description: `Balance Sheet ${bsDateTrunc ? `for ${dateRange.startDate} to ${dateRange.endDate} (by ${input.summarizeBy})` : `as of ${dateRange.endDate}`}${input.filters?.department ? ` (dept: ${input.filters.department})` : ''}`,
      }
    }

    case 'cash_flow': {
      const cfDateTrunc = getDateTrunc(input.summarizeBy)
      return {
        sql: `SELECT
  ${cfDateTrunc} AS period,
  -- P&L components
  COALESCE(SUM(CASE WHEN a.account_category = 'Income' THEN g.credit_amount - g.debit_amount ELSE 0 END), 0) AS operating_inflows,
  COALESCE(SUM(CASE WHEN a.account_category IN ('Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold') THEN g.debit_amount - g.credit_amount ELSE 0 END), 0) AS operating_outflows,
  COALESCE(SUM(CASE WHEN a.account_category = 'Income' THEN g.credit_amount - g.debit_amount
                     WHEN a.account_category IN ('Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold') THEN -(g.debit_amount - g.credit_amount)
                     ELSE 0 END), 0) AS net_income,
  -- Non-cash adjustments
  COALESCE(SUM(CASE WHEN a.name ILIKE '%depreciation%' OR a.account_subcategory_descript ILIKE '%depreciation%'
                     THEN g.credit_amount - g.debit_amount ELSE 0 END), 0) AS depreciation,
  -- Working capital changes (indirect method)
  COALESCE(SUM(CASE WHEN a.account_category = 'Assets'
                     AND (a.account_subcategory_descript ILIKE '%receivable%' OR a.name ILIKE '%receivable%')
                     THEN g.credit_amount - g.debit_amount ELSE 0 END), 0) AS ar_change,
  COALESCE(SUM(CASE WHEN a.account_category = 'Assets'
                     AND (a.account_subcategory_descript ILIKE '%inventory%' OR a.name ILIKE '%inventory%')
                     THEN g.credit_amount - g.debit_amount ELSE 0 END), 0) AS inventory_change,
  COALESCE(SUM(CASE WHEN a.account_category = 'Liabilities'
                     AND (a.account_subcategory_descript ILIKE '%payable%' OR a.name ILIKE '%payable%')
                     THEN g.credit_amount - g.debit_amount ELSE 0 END), 0) AS ap_change,
  -- Other working capital changes
  COALESCE(SUM(CASE WHEN a.account_category = 'Assets'
                     AND (a.account_subcategory_descript ILIKE '%prepaid%' OR a.name ILIKE '%prepaid%')
                     THEN g.credit_amount - g.debit_amount ELSE 0 END), 0) AS prepaid_change,
  COALESCE(SUM(CASE WHEN a.account_category = 'Liabilities'
                     AND (a.account_subcategory_descript ILIKE '%accrued%' OR a.name ILIKE '%accrued%')
                     THEN g.credit_amount - g.debit_amount ELSE 0 END), 0) AS accrued_liabilities_change,
  COALESCE(SUM(CASE WHEN a.account_category = 'Liabilities'
                     AND (a.account_subcategory_descript ILIKE '%deferred%' OR a.name ILIKE '%deferred%' OR a.name ILIKE '%unearned%')
                     THEN g.credit_amount - g.debit_amount ELSE 0 END), 0) AS deferred_revenue_change,
  -- Investing activities
  COALESCE(SUM(CASE WHEN a.account_category = 'Assets'
                     AND (a.account_subcategory_descript ILIKE '%fixed%'
                          OR a.account_subcategory_descript ILIKE '%property%'
                          OR a.account_subcategory_descript ILIKE '%equipment%')
                     THEN g.debit_amount - g.credit_amount ELSE 0 END), 0) AS fixed_asset_change,
  -- Financing activities
  COALESCE(SUM(CASE WHEN a.account_category = 'Liabilities'
                     AND a.account_subcategory_descript NOT ILIKE '%payable%'
                     AND a.account_subcategory_descript NOT ILIKE '%accrued%'
                     AND a.account_subcategory_descript NOT ILIKE '%current%'
                     THEN g.credit_amount - g.debit_amount ELSE 0 END), 0) AS debt_change,
  COALESCE(SUM(CASE WHEN a.account_category = 'Equity'
                     THEN g.credit_amount - g.debit_amount ELSE 0 END), 0) AS equity_change
FROM ${schema}.g_l_entry g
JOIN ${schema}.g_l_account a
  ON g.g_laccount_no = a.no AND g.company_id = a.company_id
WHERE g._fivetran_deleted = false
  AND g.reversed = false
  AND a._fivetran_deleted = false
  AND a.account_type = 'Posting'
  AND g.posting_date >= '${dateRange.startDate}'
  AND g.posting_date <= '${dateRange.endDate}'${departmentFilter(input)}
GROUP BY ${cfDateTrunc}
ORDER BY period`,
        description: `Cash Flow (indirect method) for ${dateRange.startDate} to ${dateRange.endDate}${input.summarizeBy ? ` (by ${input.summarizeBy})` : ''}${input.filters?.department ? ` (dept: ${input.filters.department})` : ''}`,
      }
    }

    case 'aged_receivables':
      return {
        sql: `SELECT
  c.name AS customer_name,
  c.no AS customer_no,
  COALESCE(c.balance_lcy, 0) AS total_balance,
  COALESCE(c.balance_lcy, 0) - COALESCE(c.balance_due_lcy, 0) AS current_amount,
  COALESCE(c.balance_due_lcy, 0) AS overdue_amount
FROM ${schema}.customer c
WHERE c._fivetran_deleted = false
  AND COALESCE(c.balance_lcy, 0) != 0
ORDER BY COALESCE(c.balance_lcy, 0) DESC`,
        // LIMIT ${limit} — removed: reports need all rows for correct totals
        description: 'Aged Receivables (Customer Balances)',
      }

    case 'aged_payables':
      return {
        sql: `SELECT
  v.name AS vendor_name,
  v.no AS vendor_no,
  ABS(COALESCE(v.balance_lcy, 0)) AS total_balance,
  ABS(COALESCE(v.balance_lcy, 0)) - ABS(COALESCE(v.balance_due_lcy, 0)) AS current_amount,
  ABS(COALESCE(v.balance_due_lcy, 0)) AS overdue_amount
FROM ${schema}.vendor v
WHERE v._fivetran_deleted = false
  AND COALESCE(v.balance_lcy, 0) != 0
ORDER BY ABS(COALESCE(v.balance_lcy, 0)) DESC`,
        // LIMIT ${limit} — removed: reports need all rows for correct totals
        description: 'Aged Payables (Vendor Balances)',
      }

    case 'sales_by_customer': {
      const scDateTrunc = input.summarizeBy ? getDateTrunc(input.summarizeBy, 'h') : null
      return {
        sql: `SELECT
  ${scDateTrunc ? `${scDateTrunc} AS period,\n  ` : ''}h.sell_to_customer_name AS customer_name,
  h.sell_to_customer_no AS customer_no,
  COUNT(h.no) AS invoice_count,
  COALESCE(SUM(h.amount_including_vat), 0) AS total_revenue
FROM ${schema}.sales_invoice_header h
WHERE h._fivetran_deleted = false
  AND h.posting_date >= '${dateRange.startDate}'
  AND h.posting_date <= '${dateRange.endDate}'
GROUP BY ${scDateTrunc ? `${scDateTrunc}, ` : ''}h.sell_to_customer_name, h.sell_to_customer_no
ORDER BY ${scDateTrunc ? 'period, ' : ''}total_revenue DESC`,
        // LIMIT ${limit} — removed: reports need all rows for correct totals
        description: `Sales by Customer for ${dateRange.startDate} to ${dateRange.endDate}${input.summarizeBy ? ` (by ${input.summarizeBy})` : ''}`,
      }
    }

    case 'purchases_by_vendor': {
      const pvDateTrunc = input.summarizeBy ? getDateTrunc(input.summarizeBy, 'h') : null
      return {
        sql: `SELECT
  ${pvDateTrunc ? `${pvDateTrunc} AS period,\n  ` : ''}h.buy_from_vendor_name AS vendor_name,
  h.buy_from_vendor_no AS vendor_no,
  COUNT(DISTINCT h.no) AS invoice_count,
  COALESCE(SUM(l.amount), 0) AS total_spend
FROM ${schema}.purch_inv_header h
JOIN ${schema}.purch_inv_line l
  ON h.no = l.document_no AND h.company_id = l.company_id
WHERE h._fivetran_deleted = false
  AND l._fivetran_deleted = false
  AND h.posting_date >= '${dateRange.startDate}'
  AND h.posting_date <= '${dateRange.endDate}'
GROUP BY ${pvDateTrunc ? `${pvDateTrunc}, ` : ''}h.buy_from_vendor_name, h.buy_from_vendor_no
ORDER BY ${pvDateTrunc ? 'period, ' : ''}total_spend DESC`,
        // LIMIT ${limit} — removed: reports need all rows for correct totals
        description: `Purchases by Vendor for ${dateRange.startDate} to ${dateRange.endDate}${input.summarizeBy ? ` (by ${input.summarizeBy})` : ''}`,
      }
    }

    case 'sales_by_item': {
      const siDateTrunc = input.summarizeBy ? getDateTrunc(input.summarizeBy, 'h') : null
      const itemWhere = [
        `l._fivetran_deleted = false`,
        `h._fivetran_deleted = false`,
        `l.no IS NOT NULL`,
        `l.no != ''`,
        `h.posting_date >= '${dateRange.startDate}'`,
        `h.posting_date <= '${dateRange.endDate}'`,
      ]
      if (input.filters?.itemNo)
        itemWhere.push(`l.no = '${input.filters.itemNo.replace(/'/g, "''")}'`)
      if (input.filters?.itemName)
        itemWhere.push(
          `LOWER(l.description) LIKE '%${input.filters.itemName.toLowerCase().replace(/'/g, "''")}%'`
        )
      if (input.filters?.customerName)
        itemWhere.push(
          `LOWER(h.sell_to_customer_name) LIKE '%${input.filters.customerName.toLowerCase().replace(/'/g, "''")}%'`
        )
      return {
        sql: `SELECT
  ${siDateTrunc ? `${siDateTrunc} AS period,\n  ` : ''}l.no AS item_no,
  l.description AS item_name,
  SUM(l.quantity) AS total_quantity,
  COALESCE(SUM(l.amount), 0) AS total_revenue,
  COUNT(DISTINCT l.document_no) AS invoice_count
FROM ${schema}.sales_invoice_line l
JOIN ${schema}.sales_invoice_header h
  ON l.document_no = h.no AND l.company_id = h.company_id
WHERE ${itemWhere.join('\n  AND ')}
GROUP BY ${siDateTrunc ? `${siDateTrunc}, ` : ''}l.no, l.description
ORDER BY ${siDateTrunc ? 'period, ' : ''}total_revenue DESC`,
        // LIMIT ${limit} — removed: reports need all rows for correct totals
        description: `Sales by Item/SKU for ${dateRange.startDate} to ${dateRange.endDate}${input.summarizeBy ? ` (by ${input.summarizeBy})` : ''}`,
      }
    }

    case 'purchases_by_item': {
      const piDateTrunc = input.summarizeBy ? getDateTrunc(input.summarizeBy, 'h') : null
      const pItemWhere = [
        `l._fivetran_deleted = false`,
        `h._fivetran_deleted = false`,
        `l.no IS NOT NULL`,
        `l.no != ''`,
        `h.posting_date >= '${dateRange.startDate}'`,
        `h.posting_date <= '${dateRange.endDate}'`,
      ]
      if (input.filters?.itemNo)
        pItemWhere.push(`l.no = '${input.filters.itemNo.replace(/'/g, "''")}'`)
      if (input.filters?.itemName)
        pItemWhere.push(
          `LOWER(l.description) LIKE '%${input.filters.itemName.toLowerCase().replace(/'/g, "''")}%'`
        )
      if (input.filters?.vendorName)
        pItemWhere.push(
          `LOWER(h.buy_from_vendor_name) LIKE '%${input.filters.vendorName.toLowerCase().replace(/'/g, "''")}%'`
        )
      return {
        sql: `SELECT
  ${piDateTrunc ? `${piDateTrunc} AS period,\n  ` : ''}l.no AS item_no,
  l.description AS item_name,
  SUM(l.quantity) AS total_quantity,
  COALESCE(SUM(l.amount), 0) AS total_spend,
  COUNT(DISTINCT l.document_no) AS invoice_count
FROM ${schema}.purch_inv_line l
JOIN ${schema}.purch_inv_header h
  ON l.document_no = h.no AND l.company_id = h.company_id
WHERE ${pItemWhere.join('\n  AND ')}
GROUP BY ${piDateTrunc ? `${piDateTrunc}, ` : ''}l.no, l.description
ORDER BY ${piDateTrunc ? 'period, ' : ''}total_spend DESC`,
        // LIMIT ${limit} — removed: reports need all rows for correct totals
        description: `Purchases by Item/SKU for ${dateRange.startDate} to ${dateRange.endDate}${input.summarizeBy ? ` (by ${input.summarizeBy})` : ''}`,
      }
    }

    case 'inventory_valuation':
      return {
        sql: `WITH period_entries AS (
  SELECT
    ile.item_no,
    COALESCE(i.description, '') AS item_name,
    ile.posting_date,
    COALESCE(ile.quantity, 0) AS quantity,
    COALESCE(ile.cost_amount_actual, 0) AS cost_amount_actual
  FROM ${schema}.item_ledger_entry ile
  LEFT JOIN ${schema}.item i
    ON ile.item_no = i.no AND ile.company_id = i.company_id
    AND COALESCE(i._fivetran_deleted, false) = false
  WHERE COALESCE(ile._fivetran_deleted, false) = false
),
item_summary AS (
  SELECT
    item_no,
    item_name,
    SUM(CASE WHEN posting_date < '${dateRange.startDate}' THEN quantity ELSE 0 END) AS opening_qty,
    SUM(CASE WHEN posting_date < '${dateRange.startDate}' THEN cost_amount_actual ELSE 0 END) AS opening_value,
    SUM(CASE WHEN posting_date >= '${dateRange.startDate}' AND posting_date <= '${dateRange.endDate}' AND quantity > 0 THEN quantity ELSE 0 END) AS increase_qty,
    SUM(CASE WHEN posting_date >= '${dateRange.startDate}' AND posting_date <= '${dateRange.endDate}' AND cost_amount_actual > 0 THEN cost_amount_actual ELSE 0 END) AS increase_value,
    SUM(CASE WHEN posting_date >= '${dateRange.startDate}' AND posting_date <= '${dateRange.endDate}' AND quantity < 0 THEN ABS(quantity) ELSE 0 END) AS decrease_qty,
    SUM(CASE WHEN posting_date >= '${dateRange.startDate}' AND posting_date <= '${dateRange.endDate}' AND cost_amount_actual < 0 THEN ABS(cost_amount_actual) ELSE 0 END) AS decrease_value,
    SUM(CASE WHEN posting_date <= '${dateRange.endDate}' THEN quantity ELSE 0 END) AS closing_qty,
    SUM(CASE WHEN posting_date <= '${dateRange.endDate}' THEN cost_amount_actual ELSE 0 END) AS closing_value
  FROM period_entries
  GROUP BY item_no, item_name
  HAVING SUM(CASE WHEN posting_date >= '${dateRange.startDate}' AND posting_date <= '${dateRange.endDate}' THEN ABS(quantity) ELSE 0 END) > 0
),
stock_on_hand AS (
  SELECT
    COUNT(*) AS items_in_stock,
    COALESCE(SUM(closing_qty), 0) AS total_stock_qty,
    COALESCE(SUM(closing_value), 0) AS total_stock_value
  FROM (
    SELECT
      item_no,
      SUM(CASE WHEN posting_date <= '${dateRange.endDate}' THEN quantity ELSE 0 END) AS closing_qty,
      SUM(CASE WHEN posting_date <= '${dateRange.endDate}' THEN cost_amount_actual ELSE 0 END) AS closing_value
    FROM period_entries
    GROUP BY item_no
    HAVING SUM(CASE WHEN posting_date <= '${dateRange.endDate}' THEN quantity ELSE 0 END) > 0
  ) all_stock
)
SELECT
  item_no, item_name,
  opening_qty, opening_value, increase_qty, increase_value,
  decrease_qty, decrease_value, closing_qty, closing_value,
  SUM(opening_value) OVER () AS grand_opening_value,
  SUM(increase_value) OVER () AS grand_increase_value,
  SUM(decrease_value) OVER () AS grand_decrease_value,
  SUM(closing_value) OVER () AS grand_closing_value,
  SUM(closing_qty) OVER () AS grand_closing_qty,
  COUNT(*) OVER () AS total_item_count,
  soh.items_in_stock,
  soh.total_stock_qty,
  soh.total_stock_value
FROM item_summary
CROSS JOIN stock_on_hand soh
ORDER BY closing_value DESC
LIMIT ${limit}`,
        description: `Inventory Valuation for ${dateRange.startDate} to ${dateRange.endDate}`,
      }

    case 'monthly_pnl_trend': {
      const trendDateTrunc = getDateTrunc(input.summarizeBy)
      return {
        sql: `SELECT
  ${trendDateTrunc} AS period,
  COALESCE(SUM(CASE WHEN a.account_category = 'Income' THEN g.credit_amount - g.debit_amount ELSE 0 END), 0) AS revenue,
  COALESCE(SUM(CASE WHEN a.account_category = 'Cost_x0020_of_x0020_Goods_x0020_Sold' THEN g.debit_amount - g.credit_amount ELSE 0 END), 0) AS cogs,
  COALESCE(SUM(CASE WHEN a.account_category = 'Expense' THEN g.debit_amount - g.credit_amount ELSE 0 END), 0) AS expenses,
  COALESCE(SUM(CASE WHEN a.account_category = 'Income' THEN g.credit_amount - g.debit_amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN a.account_category IN ('Cost_x0020_of_x0020_Goods_x0020_Sold', 'Expense') THEN g.debit_amount - g.credit_amount ELSE 0 END), 0) AS net_income
FROM ${schema}.g_l_entry g
JOIN ${schema}.g_l_account a
  ON g.g_laccount_no = a.no AND g.company_id = a.company_id
WHERE g._fivetran_deleted = false
  AND g.reversed = false
  AND a._fivetran_deleted = false
  AND a.account_type = 'Posting'
  AND a.account_category IN ('Income', 'Cost_x0020_of_x0020_Goods_x0020_Sold', 'Expense')
  AND g.posting_date >= '${dateRange.startDate}'
  AND g.posting_date <= '${dateRange.endDate}'${departmentFilter(input)}
GROUP BY ${trendDateTrunc}
ORDER BY period`,
        description: `P&L Trend for ${dateRange.startDate} to ${dateRange.endDate}${input.summarizeBy ? ` (by ${input.summarizeBy})` : ''}${input.filters?.department ? ` (dept: ${input.filters.department})` : ''}`,
      }
    }

    default:
      return { sql: '', description: 'Unknown report type' }
  }
}

// ============================================================================
// Entity Queries
// ============================================================================

function buildEntityQuery(
  input: BCDataInput,
  schema: string,
  dateRange: DateRange,
  limit: number
): { sql: string; description: string } {
  const filters = input.filters

  switch (input.entityType) {
    case 'customer': {
      const where = [`c._fivetran_deleted = false`]
      if (filters?.customerName)
        where.push(
          `LOWER(c.name) LIKE '%${filters.customerName.replace(/'/g, "''").toLowerCase()}%'`
        )
      if (filters?.minAmount) where.push(`COALESCE(c.balance_lcy, 0) >= ${filters.minAmount}`)
      return {
        sql: `SELECT c.no, c.name, c.city, c.country_region_code, c.phone_no,
  COALESCE(c.balance_lcy, 0) AS balance, COALESCE(c.balance_due_lcy, 0) AS balance_due
FROM ${schema}.customer c
WHERE ${where.join(' AND ')}
ORDER BY c.name
LIMIT ${limit}`,
        description: 'Customer list',
      }
    }

    case 'vendor': {
      const where = [`v._fivetran_deleted = false`]
      if (filters?.vendorName)
        where.push(`LOWER(v.name) LIKE '%${filters.vendorName.replace(/'/g, "''").toLowerCase()}%'`)
      return {
        sql: `SELECT v.no, v.name, v.city, v.country_region_code, v.phone_no,
  ABS(COALESCE(v.balance_lcy, 0)) AS balance, ABS(COALESCE(v.balance_due_lcy, 0)) AS balance_due
FROM ${schema}.vendor v
WHERE ${where.join(' AND ')}
ORDER BY v.name
LIMIT ${limit}`,
        description: 'Vendor list',
      }
    }

    case 'item': {
      const itemWhere = [`i._fivetran_deleted = false`]
      if (filters?.itemNo) itemWhere.push(`i.no = '${filters.itemNo.replace(/'/g, "''")}'`)
      if (filters?.itemName)
        itemWhere.push(
          `LOWER(i.description) LIKE '%${filters.itemName.toLowerCase().replace(/'/g, "''")}%'`
        )
      // When filtering for a specific item, return ALL columns for discovery
      const itemSelect =
        filters?.itemNo || filters?.itemName
          ? `SELECT i.*`
          : `SELECT i.no, i.description AS name, i.base_unit_of_measure,
  COALESCE(i.inventory, 0) AS quantity_on_hand,
  COALESCE(i.unit_cost, 0) AS unit_cost,
  COALESCE(i.unit_price, 0) AS unit_price`
      return {
        sql: `${itemSelect}
FROM ${schema}.item i
WHERE ${itemWhere.join(' AND ')}
ORDER BY i.description
LIMIT ${limit}`,
        description:
          filters?.itemNo || filters?.itemName
            ? `Item detail for ${filters.itemNo || filters.itemName}`
            : 'Item list',
      }
    }

    case 'account':
      return {
        sql: `SELECT a.no, a.name,
  ${decodeFivetranSQL('a.account_category')} AS account_category,
  ${decodeFivetranSQL('a.account_type')} AS account_type,
  ${decodeFivetranSQL('a.account_subcategory_descript')} AS subcategory
FROM ${schema}.g_l_account a
WHERE a._fivetran_deleted = false
  AND a.account_type = 'Posting'
ORDER BY a.no
LIMIT ${limit}`,
        description: 'Chart of Accounts',
      }

    case 'sales_invoice': {
      const where = [`h._fivetran_deleted = false`]
      if (filters?.customerName)
        where.push(
          `LOWER(h.sell_to_customer_name) LIKE '%${filters.customerName.replace(/'/g, "''").toLowerCase()}%'`
        )
      if (filters?.minAmount) where.push(`h.amount >= ${filters.minAmount}`)
      if (filters?.maxAmount) where.push(`h.amount <= ${filters.maxAmount}`)
      where.push(`h.posting_date >= '${dateRange.startDate}'`)
      where.push(`h.posting_date <= '${dateRange.endDate}'`)
      return {
        sql: `SELECT h.no AS invoice_no, h.sell_to_customer_name AS customer_name,
  h.posting_date, h.due_date, h.amount, h.amount_including_vat,
  h.currency_code, h.remaining_amount
FROM ${schema}.sales_invoice_header h
WHERE ${where.join(' AND ')}
ORDER BY h.posting_date DESC
LIMIT ${limit}`,
        description: `Sales invoices for ${dateRange.startDate} to ${dateRange.endDate}`,
      }
    }

    case 'purchase_invoice': {
      const where = [`h._fivetran_deleted = false`]
      if (filters?.vendorName)
        where.push(
          `LOWER(h.buy_from_vendor_name) LIKE '%${filters.vendorName.replace(/'/g, "''").toLowerCase()}%'`
        )
      if (filters?.minAmount) where.push(`h.amount >= ${filters.minAmount}`)
      if (filters?.maxAmount) where.push(`h.amount <= ${filters.maxAmount}`)
      where.push(`h.posting_date >= '${dateRange.startDate}'`)
      where.push(`h.posting_date <= '${dateRange.endDate}'`)
      return {
        sql: `SELECT h.no AS invoice_no, h.buy_from_vendor_name AS vendor_name,
  h.posting_date, h.due_date, h.amount, h.amount_including_vat,
  h.currency_code, h.remaining_amount
FROM ${schema}.purch_inv_header h
WHERE ${where.join(' AND ')}
ORDER BY h.posting_date DESC
LIMIT ${limit}`,
        description: `Purchase invoices for ${dateRange.startDate} to ${dateRange.endDate}`,
      }
    }

    case 'general_ledger_entry': {
      const glWhere = [
        `g._fivetran_deleted = false`,
        `g.reversed = false`,
        `g.posting_date >= '${dateRange.startDate}'`,
        `g.posting_date <= '${dateRange.endDate}'`,
      ]
      if (filters?.department)
        glWhere.push(`g.global_dimension_1_code = '${filters.department.replace(/'/g, "''")}'`)
      if (filters?.accountCategory)
        glWhere.push(`a.account_category = '${encodeForFivetran(filters.accountCategory)}'`)
      // If filtering by account category, need to join g_l_account
      const needsAccountJoin = !!filters?.accountCategory
      return {
        sql: `SELECT g.entry_no, g.posting_date, g.document_type, g.document_no,
  g.g_laccount_no AS account_no, g.description,
  g.debit_amount, g.credit_amount, g.amount,
  g.global_dimension_1_code AS department
FROM ${schema}.g_l_entry g${needsAccountJoin ? `\nJOIN ${schema}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id` : ''}
WHERE ${glWhere.join('\n  AND ')}
ORDER BY g.posting_date DESC, g.entry_no DESC
LIMIT ${limit}`,
        description: `GL entries for ${dateRange.startDate} to ${dateRange.endDate}${filters?.department ? ` (dept: ${filters.department})` : ''}`,
      }
    }

    case 'bank_account':
      return {
        sql: `SELECT b.no, b.name, b.bank_account_no,
  b.currency_code, COALESCE(b.balance, 0) AS balance,
  COALESCE(b.balance_lcy, 0) AS balance_lcy
FROM ${schema}.bank_account b
WHERE b._fivetran_deleted = false
ORDER BY ABS(COALESCE(b.balance_lcy, 0)) DESC
LIMIT ${limit}`,
        description: 'Bank Accounts',
      }

    default:
      return { sql: '', description: 'Unknown entity type' }
  }
}

// ============================================================================
// Metric Queries
// ============================================================================

function buildMetricQuery(
  input: BCDataInput,
  schema: string,
  dateRange: DateRange
): { sql: string; description: string } {
  switch (input.metricName) {
    case 'total_revenue':
      return {
        sql: `SELECT COALESCE(SUM(g.credit_amount - g.debit_amount), 0) AS total_revenue
FROM ${schema}.g_l_entry g
JOIN ${schema}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id
WHERE g._fivetran_deleted = false AND g.reversed = false
  AND a._fivetran_deleted = false AND a.account_type = 'Posting'
  AND a.account_category = 'Income'
  AND g.posting_date >= '${dateRange.startDate}' AND g.posting_date <= '${dateRange.endDate}'`,
        description: `Total Revenue for ${dateRange.startDate} to ${dateRange.endDate}`,
      }

    case 'total_expenses':
      return {
        sql: `SELECT COALESCE(SUM(g.debit_amount - g.credit_amount), 0) AS total_expenses
FROM ${schema}.g_l_entry g
JOIN ${schema}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id
WHERE g._fivetran_deleted = false AND g.reversed = false
  AND a._fivetran_deleted = false AND a.account_type = 'Posting'
  AND a.account_category IN ('Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
  AND g.posting_date >= '${dateRange.startDate}' AND g.posting_date <= '${dateRange.endDate}'`,
        description: `Total Expenses for ${dateRange.startDate} to ${dateRange.endDate}`,
      }

    case 'net_income':
      return {
        sql: `SELECT
  COALESCE(SUM(CASE WHEN a.account_category = 'Income' THEN g.credit_amount - g.debit_amount ELSE 0 END), 0) AS revenue,
  COALESCE(SUM(CASE WHEN a.account_category IN ('Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold') THEN g.debit_amount - g.credit_amount ELSE 0 END), 0) AS total_expenses,
  COALESCE(SUM(CASE WHEN a.account_category = 'Income' THEN g.credit_amount - g.debit_amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN a.account_category IN ('Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold') THEN g.debit_amount - g.credit_amount ELSE 0 END), 0) AS net_income
FROM ${schema}.g_l_entry g
JOIN ${schema}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id
WHERE g._fivetran_deleted = false AND g.reversed = false
  AND a._fivetran_deleted = false AND a.account_type = 'Posting'
  AND a.account_category IN ('Income', 'Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
  AND g.posting_date >= '${dateRange.startDate}' AND g.posting_date <= '${dateRange.endDate}'`,
        description: `Net Income for ${dateRange.startDate} to ${dateRange.endDate}`,
      }

    case 'gross_margin':
    case 'net_margin':
    case 'operating_margin':
    case 'ebitda_margin':
    case 'gross_profit':
    case 'operating_income':
    case 'ebitda':
      return {
        sql: `SELECT
  COALESCE(SUM(CASE WHEN a.account_category = 'Income' THEN g.credit_amount - g.debit_amount ELSE 0 END), 0) AS revenue,
  COALESCE(SUM(CASE WHEN a.account_category = 'Cost_x0020_of_x0020_Goods_x0020_Sold' THEN g.debit_amount - g.credit_amount ELSE 0 END), 0) AS cogs,
  COALESCE(SUM(CASE WHEN a.account_category = 'Expense' THEN g.debit_amount - g.credit_amount ELSE 0 END), 0) AS operating_expenses
FROM ${schema}.g_l_entry g
JOIN ${schema}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id
WHERE g._fivetran_deleted = false AND g.reversed = false
  AND a._fivetran_deleted = false AND a.account_type = 'Posting'
  AND a.account_category IN ('Income', 'Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
  AND g.posting_date >= '${dateRange.startDate}' AND g.posting_date <= '${dateRange.endDate}'`,
        description: `Margin metrics for ${dateRange.startDate} to ${dateRange.endDate}`,
      }

    case 'total_assets':
    case 'total_liabilities':
    case 'total_equity':
    case 'current_ratio':
    case 'quick_ratio':
    case 'debt_to_equity':
    case 'debt_ratio':
    case 'working_capital':
      return {
        sql: `SELECT
  ${decodeFivetranSQL('a.account_category')} AS category,
  ${decodeFivetranSQL('a.account_subcategory_descript')} AS subcategory,
  a.name AS account_name,
  CASE
    WHEN a.account_category = 'Assets' THEN COALESCE(SUM(g.debit_amount - g.credit_amount), 0)
    ELSE COALESCE(SUM(g.credit_amount - g.debit_amount), 0)
  END AS balance
FROM ${schema}.g_l_entry g
JOIN ${schema}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id
WHERE g._fivetran_deleted = false AND g.reversed = false
  AND a._fivetran_deleted = false AND a.account_type = 'Posting'
  AND a.account_category IN ('Assets', 'Liabilities', 'Equity', 'Income', 'Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
  AND g.posting_date <= '${dateRange.endDate}'
GROUP BY a.account_category, a.account_subcategory_descript, a.name
HAVING ABS(COALESCE(SUM(g.debit_amount - g.credit_amount), 0)) > 0.01`,
        description: `Balance sheet aggregates as of ${dateRange.endDate}`,
      }

    case 'dso':
      return {
        sql: `SELECT
  COALESCE(SUM(c.balance_lcy), 0) AS total_receivables,
  (SELECT COALESCE(SUM(g.credit_amount - g.debit_amount), 0) / NULLIF(DATEDIFF(day, '${dateRange.startDate}', '${dateRange.endDate}'), 0)
   FROM ${schema}.g_l_entry g
   JOIN ${schema}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id
   WHERE g._fivetran_deleted = false AND g.reversed = false
     AND a._fivetran_deleted = false AND a.account_type = 'Posting' AND a.account_category = 'Income'
     AND g.posting_date >= '${dateRange.startDate}' AND g.posting_date <= '${dateRange.endDate}'
  ) AS daily_revenue
FROM ${schema}.customer c WHERE c._fivetran_deleted = false`,
        description: `Days Sales Outstanding for ${dateRange.startDate} to ${dateRange.endDate}`,
      }

    case 'dpo':
      return {
        sql: `SELECT
  COALESCE(SUM(ABS(v.balance_lcy)), 0) AS total_payables,
  (SELECT COALESCE(SUM(g.debit_amount - g.credit_amount), 0) / NULLIF(DATEDIFF(day, '${dateRange.startDate}', '${dateRange.endDate}'), 0)
   FROM ${schema}.g_l_entry g
   JOIN ${schema}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id
   WHERE g._fivetran_deleted = false AND g.reversed = false
     AND a._fivetran_deleted = false AND a.account_type = 'Posting' AND a.account_category = 'Cost_x0020_of_x0020_Goods_x0020_Sold'
     AND g.posting_date >= '${dateRange.startDate}' AND g.posting_date <= '${dateRange.endDate}'
  ) AS daily_cogs
FROM ${schema}.vendor v WHERE v._fivetran_deleted = false`,
        description: `Days Payable Outstanding for ${dateRange.startDate} to ${dateRange.endDate}`,
      }

    case 'inventory_turnover':
      return {
        // Old COGS-based: sql: `SELECT COALESCE(SUM(CASE WHEN a.account_category = 'Cost_x0020_of_x0020_Goods_x0020_Sold' THEN g.debit_amount - g.credit_amount ELSE 0 END), 0) AS cogs, (SELECT COALESCE(SUM(i.inventory * i.unit_cost), 0) FROM ${schema}.item i WHERE i._fivetran_deleted = false AND i.inventory > 0) AS avg_inventory FROM ${schema}.g_l_entry g JOIN ${schema}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id WHERE g._fivetran_deleted = false AND g.reversed = false AND a._fivetran_deleted = false AND a.account_type = 'Posting' AND g.posting_date >= '${dateRange.startDate}' AND g.posting_date <= '${dateRange.endDate}'`
        sql: `SELECT
  COALESCE(SUM(CASE WHEN ile.posting_date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}' AND ile.entry_type IN ('Sale', 'Negative Adjmt.', 'Consumption') THEN ABS(ile.quantity) ELSE 0 END), 0) AS outbound_qty,
  ABS(COALESCE(SUM(CASE WHEN ile.posting_date < '${dateRange.startDate}' THEN ile.quantity ELSE 0 END), 0)) AS opening_qty,
  ABS(COALESCE(SUM(CASE WHEN ile.posting_date <= '${dateRange.endDate}' THEN ile.quantity ELSE 0 END), 0)) AS closing_qty,
  CASE WHEN (ABS(COALESCE(SUM(CASE WHEN ile.posting_date < '${dateRange.startDate}' THEN ile.quantity ELSE 0 END), 0)) + ABS(COALESCE(SUM(CASE WHEN ile.posting_date <= '${dateRange.endDate}' THEN ile.quantity ELSE 0 END), 0))) != 0
    THEN ROUND(CAST(COALESCE(SUM(CASE WHEN ile.posting_date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}' AND ile.entry_type IN ('Sale', 'Negative Adjmt.', 'Consumption') THEN ABS(ile.quantity) ELSE 0 END), 0) AS FLOAT) / ((ABS(CAST(COALESCE(SUM(CASE WHEN ile.posting_date < '${dateRange.startDate}' THEN ile.quantity ELSE 0 END), 0) AS FLOAT)) + ABS(CAST(COALESCE(SUM(CASE WHEN ile.posting_date <= '${dateRange.endDate}' THEN ile.quantity ELSE 0 END), 0) AS FLOAT))) / 2.0), 2)
    ELSE 0 END AS turnover_ratio
FROM ${schema}.item_ledger_entry ile
WHERE ile._fivetran_deleted = false AND ile.item_no IS NOT NULL AND ile.item_no != ''`,
        description: `Inventory Turnover for ${dateRange.startDate} to ${dateRange.endDate}`,
      }

    case 'cash_conversion_cycle':
      // Returns DSO + DIO - DPO components for the agent to calculate
      return {
        sql: `SELECT
  COALESCE(SUM(c.balance_lcy), 0) AS total_receivables,
  (SELECT COALESCE(SUM(ABS(v.balance_lcy)), 0) FROM ${schema}.vendor v WHERE v._fivetran_deleted = false) AS total_payables,
  (SELECT COALESCE(SUM(i.inventory * i.unit_cost), 0) FROM ${schema}.item i WHERE i._fivetran_deleted = false AND i.inventory > 0) AS inventory_value,
  (SELECT COALESCE(SUM(g.credit_amount - g.debit_amount), 0) FROM ${schema}.g_l_entry g JOIN ${schema}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id WHERE g._fivetran_deleted = false AND g.reversed = false AND a._fivetran_deleted = false AND a.account_type = 'Posting' AND a.account_category = 'Income' AND g.posting_date >= '${dateRange.startDate}' AND g.posting_date <= '${dateRange.endDate}') AS total_revenue,
  (SELECT COALESCE(SUM(g.debit_amount - g.credit_amount), 0) FROM ${schema}.g_l_entry g JOIN ${schema}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id WHERE g._fivetran_deleted = false AND g.reversed = false AND a._fivetran_deleted = false AND a.account_type = 'Posting' AND a.account_category = 'Cost_x0020_of_x0020_Goods_x0020_Sold' AND g.posting_date >= '${dateRange.startDate}' AND g.posting_date <= '${dateRange.endDate}') AS total_cogs,
  DATEDIFF(day, '${dateRange.startDate}', '${dateRange.endDate}') AS period_days
FROM ${schema}.customer c WHERE c._fivetran_deleted = false`,
        description: `Cash Conversion Cycle components for ${dateRange.startDate} to ${dateRange.endDate}`,
      }

    default:
      return { sql: '', description: 'Unknown metric' }
  }
}

// ============================================================================
// Search Queries
// ============================================================================

function buildSearchQuery(
  input: BCDataInput,
  schema: string,
  limit: number
): { sql: string; description: string } {
  const searchText = (input.searchText || '').toLowerCase().replace(/'/g, "''")
  const scope = input.searchScope || 'all'

  const queries: string[] = []

  if (scope === 'all' || scope === 'customers') {
    queries.push(`SELECT 'customer' AS entity_type, no AS id, name, city AS detail
FROM ${schema}.customer WHERE _fivetran_deleted = false AND LOWER(name) LIKE '%${searchText}%'`)
  }
  if (scope === 'all' || scope === 'vendors') {
    queries.push(`SELECT 'vendor' AS entity_type, no AS id, name, city AS detail
FROM ${schema}.vendor WHERE _fivetran_deleted = false AND LOWER(name) LIKE '%${searchText}%'`)
  }
  if (scope === 'all' || scope === 'items') {
    queries.push(`SELECT 'item' AS entity_type, no AS id, description AS name, base_unit_of_measure AS detail
FROM ${schema}.item WHERE _fivetran_deleted = false AND LOWER(description) LIKE '%${searchText}%'`)
  }
  if (scope === 'all' || scope === 'accounts') {
    queries.push(`SELECT 'account' AS entity_type, no AS id, name, ${decodeFivetranSQL('account_category')} AS detail
FROM ${schema}.g_l_account WHERE _fivetran_deleted = false AND LOWER(name) LIKE '%${searchText}%'`)
  }

  if (queries.length === 0) {
    return { sql: '', description: 'No search scope specified' }
  }

  return {
    sql: `${queries.join('\nUNION ALL\n')}\nORDER BY entity_type, name\nLIMIT ${limit}`,
    description: `Search for "${input.searchText}" in ${scope}`,
  }
}

// ============================================================================
// Analyze Queries
// ============================================================================

function buildAnalyzeQuery(
  input: BCDataInput,
  schema: string,
  dateRange: DateRange,
  limit: number
): { sql: string; description: string } {
  // For analysis, we fetch the relevant report data and let the agent analyze it
  switch (input.focusArea || 'revenue') {
    case 'revenue':
      return buildReportQuery(
        { ...input, queryType: 'report', reportType: 'monthly_pnl_trend' },
        schema,
        dateRange,
        limit
      )
    case 'expenses':
      return buildReportQuery(
        { ...input, queryType: 'report', reportType: 'profit_loss' },
        schema,
        dateRange,
        limit
      )
    case 'inventory':
      return buildReportQuery(
        { ...input, queryType: 'report', reportType: 'inventory_valuation' },
        schema,
        dateRange,
        limit
      )
    case 'profitability':
      return buildReportQuery(
        { ...input, queryType: 'report', reportType: 'monthly_pnl_trend' },
        schema,
        dateRange,
        limit
      )
    case 'cash_flow':
      return buildReportQuery(
        { ...input, queryType: 'report', reportType: 'cash_flow' },
        schema,
        dateRange,
        limit
      )
    default:
      return buildReportQuery(
        { ...input, queryType: 'report', reportType: 'profit_loss' },
        schema,
        dateRange,
        limit
      )
  }
}

// ============================================================================
// Compare Queries
// ============================================================================

function buildCompareQuery(
  input: BCDataInput,
  schema: string
): { sql: string; description: string } {
  const currentRange = {
    startDate: input.currentStartDate || `${new Date().getFullYear()}-01-01`,
    endDate: input.currentEndDate || fmt(new Date()),
  }
  const comparisonRange = {
    startDate: input.comparisonStartDate || `${new Date().getFullYear() - 1}-01-01`,
    endDate: input.comparisonEndDate || `${new Date().getFullYear() - 1}-12-31`,
  }

  return {
    sql: `SELECT
  'current' AS period_label,
  COALESCE(SUM(CASE WHEN a.account_category = 'Income' THEN g.credit_amount - g.debit_amount ELSE 0 END), 0) AS revenue,
  COALESCE(SUM(CASE WHEN a.account_category = 'Cost_x0020_of_x0020_Goods_x0020_Sold' THEN g.debit_amount - g.credit_amount ELSE 0 END), 0) AS cogs,
  COALESCE(SUM(CASE WHEN a.account_category = 'Expense' THEN g.debit_amount - g.credit_amount ELSE 0 END), 0) AS expenses
FROM ${schema}.g_l_entry g
JOIN ${schema}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id
WHERE g._fivetran_deleted = false AND g.reversed = false AND a._fivetran_deleted = false AND a.account_type = 'Posting'
  AND a.account_category IN ('Income', 'Cost_x0020_of_x0020_Goods_x0020_Sold', 'Expense')
  AND g.posting_date >= '${currentRange.startDate}' AND g.posting_date <= '${currentRange.endDate}'
UNION ALL
SELECT
  'comparison' AS period_label,
  COALESCE(SUM(CASE WHEN a.account_category = 'Income' THEN g.credit_amount - g.debit_amount ELSE 0 END), 0) AS revenue,
  COALESCE(SUM(CASE WHEN a.account_category = 'Cost_x0020_of_x0020_Goods_x0020_Sold' THEN g.debit_amount - g.credit_amount ELSE 0 END), 0) AS cogs,
  COALESCE(SUM(CASE WHEN a.account_category = 'Expense' THEN g.debit_amount - g.credit_amount ELSE 0 END), 0) AS expenses
FROM ${schema}.g_l_entry g
JOIN ${schema}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id
WHERE g._fivetran_deleted = false AND g.reversed = false AND a._fivetran_deleted = false AND a.account_type = 'Posting'
  AND a.account_category IN ('Income', 'Cost_x0020_of_x0020_Goods_x0020_Sold', 'Expense')
  AND g.posting_date >= '${comparisonRange.startDate}' AND g.posting_date <= '${comparisonRange.endDate}'`,
    description: `Comparison: ${currentRange.startDate}..${currentRange.endDate} vs ${comparisonRange.startDate}..${comparisonRange.endDate}`,
  }
}
