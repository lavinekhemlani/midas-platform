'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useSession } from '@/contexts/SessionContext'
import { cn } from '@/lib/utils'
import { ReactECharts } from '@/components/chat/visualizations/shared/ReactEChartsWrapper'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ── Date Helpers ──────────────────────────────────────────────────────────────

const formatDateISO = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface DatePreset {
  label: string
  getRange: () => { start: string; end: string }
}

const DATE_PRESETS: Record<string, DatePreset> = {
  thisWeek: {
    label: 'This Week',
    getRange: () => {
      const now = new Date()
      const day = now.getDay()
      const diff = day === 0 ? 6 : day - 1 // Monday as start of week
      const start = new Date(now)
      start.setDate(now.getDate() - diff)
      return { start: formatDateISO(start), end: formatDateISO(now) }
    },
  },
  lastWeek: {
    label: 'Last Week',
    getRange: () => {
      const now = new Date()
      const day = now.getDay()
      const diff = day === 0 ? 6 : day - 1
      const thisMonday = new Date(now)
      thisMonday.setDate(now.getDate() - diff)
      const lastMonday = new Date(thisMonday)
      lastMonday.setDate(thisMonday.getDate() - 7)
      const lastSunday = new Date(thisMonday)
      lastSunday.setDate(thisMonday.getDate() - 1)
      return { start: formatDateISO(lastMonday), end: formatDateISO(lastSunday) }
    },
  },
  thisMonth: {
    label: 'This Month',
    getRange: () => {
      const now = new Date()
      return {
        start: formatDateISO(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: formatDateISO(now),
      }
    },
  },
  lastMonth: {
    label: 'Last Month',
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: formatDateISO(start), end: formatDateISO(end) }
    },
  },
  thisQuarter: {
    label: 'This Quarter',
    getRange: () => {
      const now = new Date()
      const q = Math.floor(now.getMonth() / 3)
      return {
        start: formatDateISO(new Date(now.getFullYear(), q * 3, 1)),
        end: formatDateISO(now),
      }
    },
  },
  lastQuarter: {
    label: 'Last Quarter',
    getRange: () => {
      const now = new Date()
      const q = Math.floor(now.getMonth() / 3) - 1
      const y = q < 0 ? now.getFullYear() - 1 : now.getFullYear()
      const qAdj = q < 0 ? 3 : q
      return {
        start: formatDateISO(new Date(y, qAdj * 3, 1)),
        end: formatDateISO(new Date(y, (qAdj + 1) * 3, 0)),
      }
    },
  },
  thisYear: {
    label: 'This Year',
    getRange: () => {
      const now = new Date()
      return {
        start: formatDateISO(new Date(now.getFullYear(), 0, 1)),
        end: formatDateISO(now),
      }
    },
  },
  lastYear: {
    label: 'Last Year',
    getRange: () => {
      const now = new Date()
      const y = now.getFullYear() - 1
      return {
        start: formatDateISO(new Date(y, 0, 1)),
        end: formatDateISO(new Date(y, 11, 31)),
      }
    },
  },
  allTime: {
    label: 'All Time',
    getRange: () => ({ start: '', end: '' }),
  },
}

// ── Schema enums (same as bcoauth agent) ─────────────────────────────────────

const QUERY_TYPES = [
  'report',
  'entity',
  'metric',
  'search',
  'analyze',
  'calculator',
  'custom_sql',
] as const

const REPORT_TYPES = [
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
] as const

const ENTITY_TYPES = [
  'customer',
  'vendor',
  'item',
  'account',
  'sales_invoice',
  'purchase_invoice',
  'general_ledger_entry',
  'bank_account',
] as const

const METRIC_NAMES = [
  'total_revenue',
  'total_expenses',
  'net_income',
  'gross_margin',
  'inventory_turnover',
  'dso',
  'dpo',
  'total_assets',
  'total_liabilities',
] as const

const CALCULATOR_RATIOS = [
  'all_ratios',
  'current_ratio',
  'quick_ratio',
  'debt_to_equity',
  'working_capital',
] as const

const SEARCH_SCOPES = ['all', 'customers', 'vendors', 'items', 'accounts'] as const
const ANALYSIS_TYPES = ['trends', 'breakdown', 'performance'] as const
const FOCUS_AREAS = ['revenue', 'expenses', 'cash_flow', 'profitability', 'inventory'] as const

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatLabel = (s: string) =>
  s
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())

const formatNumber = (value: number) => {
  if (Number.isInteger(value)) return value.toLocaleString()
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatCompact = (v: number) => {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return String(v)
}

const CHART_COLORS = [
  '#f59e0b',
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#f97316',
]

const DARK_TOOLTIP = {
  backgroundColor: 'rgba(17, 24, 39, 0.95)',
  borderColor: 'transparent',
  textStyle: { color: '#e5e7eb' },
  confine: true,
}

// ── Types ────────────────────────────────────────────────────────────────────

interface QueryResult {
  success: boolean
  data: Record<string, unknown>[]
  count: number
  columns: string[]
  error?: string
}

interface WarehouseConfig {
  enabled: boolean
  schemas: { schema_name: string; source_type: string; display_name: string }[]
  default_schema?: string
}

// ── SQL Builders ─────────────────────────────────────────────────────────────

function dateWhere(col: string, start: string, end: string): string {
  if (start && end) return `AND ${col} BETWEEN '${start}' AND '${end}'`
  if (start) return `AND ${col} >= '${start}'`
  if (end) return `AND ${col} <= '${end}'`
  return ''
}

function buildReportSQL(
  reportType: string,
  s: string,
  startDate: string,
  endDate: string,
  filters: Record<string, string>,
  limit: number
): string {
  const df = dateWhere('posting_date', startDate, endDate)
  const dfH = dateWhere('h.posting_date', startDate, endDate)
  const dfIle = dateWhere('ile.posting_date', startDate, endDate)

  switch (reportType) {
    case 'trial_balance':
      return `SELECT
  g_laccount_no AS account_no, g_laccount_name AS account_name,
  SUM(debit_amount) AS total_debits, SUM(credit_amount) AS total_credits,
  SUM(amount) AS net_balance
FROM ${s}.g_l_entry
WHERE _fivetran_deleted = false AND reversed = false ${df}
  ${filters.accountName ? `AND g_laccount_name ILIKE '%${filters.accountName}%'` : ''}
  ${filters.accountCategory ? `AND g_laccount_name ILIKE '%${filters.accountCategory}%'` : ''}
GROUP BY g_laccount_no, g_laccount_name
ORDER BY g_laccount_no
LIMIT ${limit}`

    case 'profit_loss': {
      const acctFilter = filters.accountName ? `AND a.name ILIKE '%${filters.accountName}%'` : ''
      const catFilter = filters.accountCategory
        ? `AND REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') ILIKE '%${filters.accountCategory}%'`
        : ''
      return `SELECT
  a.no AS account_no, a.name AS account_name,
  REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') AS account_category,
  REPLACE(REPLACE(a.account_subcategory_descript, '_x0020_', ' '), '_x002D_', '-') AS subcategory,
  SUM(g.amount) AS gl_amount
FROM ${s}.g_l_entry g
JOIN ${s}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id AND a._fivetran_deleted = false
WHERE g._fivetran_deleted = false AND g.reversed = false ${df}
  AND REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') IN ('Income', 'Cost of Goods Sold', 'Expense')
  ${acctFilter} ${catFilter}
GROUP BY a.no, a.name, a.account_category, a.account_subcategory_descript
ORDER BY a.no
LIMIT ${limit}`
    }

    case 'monthly_pnl_trend': {
      return `SELECT
  DATE_TRUNC('month', g.posting_date) AS month,
  REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') AS account_category,
  SUM(g.amount) AS gl_amount
FROM ${s}.g_l_entry g
JOIN ${s}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id AND a._fivetran_deleted = false
WHERE g._fivetran_deleted = false AND g.reversed = false ${df}
  AND REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') IN ('Income', 'Cost of Goods Sold', 'Expense')
GROUP BY DATE_TRUNC('month', g.posting_date), a.account_category
ORDER BY month
LIMIT ${limit}`
    }

    case 'balance_sheet': {
      const acctFilter = filters.accountName ? `AND a.name ILIKE '%${filters.accountName}%'` : ''
      return `SELECT
  a.no AS account_no, a.name AS account_name,
  REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') AS account_category,
  SUM(g.amount) AS balance
FROM ${s}.g_l_entry g
JOIN ${s}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id AND a._fivetran_deleted = false
WHERE g._fivetran_deleted = false AND g.reversed = false ${df}
  AND REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') IN ('Assets', 'Liabilities', 'Equity')
  ${acctFilter}
GROUP BY a.no, a.name, a.account_category
ORDER BY a.no
LIMIT ${limit}`
    }

    case 'cash_flow': {
      return `SELECT
  a.no AS account_no, a.name AS account_name,
  REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') AS account_category,
  REPLACE(REPLACE(a.account_subcategory_descript, '_x0020_', ' '), '_x002D_', '-') AS subcategory,
  SUM(g.debit_amount) AS total_debits,
  SUM(g.credit_amount) AS total_credits,
  SUM(g.amount) AS net_amount
FROM ${s}.g_l_entry g
JOIN ${s}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id AND a._fivetran_deleted = false
WHERE g._fivetran_deleted = false AND g.reversed = false ${df}
GROUP BY a.no, a.name, a.account_category, a.account_subcategory_descript
ORDER BY a.no
LIMIT ${limit}`
    }

    case 'aged_receivables':
      return `SELECT
  h.no AS invoice_no, h.sell_to_customer_no AS customer_no,
  h.sell_to_customer_name AS customer_name,
  h.posting_date, h.due_date,
  DATEDIFF(day, h.due_date, CURRENT_DATE) AS days_past_due,
  SUM(l.amount) AS amount
FROM ${s}.sales_invoice_header h
JOIN ${s}.sales_invoice_line l ON h.no = l.document_no AND h.company_id = l.company_id AND l._fivetran_deleted = false
WHERE h._fivetran_deleted = false ${dfH}
  ${filters.customerName ? `AND h.sell_to_customer_name ILIKE '%${filters.customerName}%'` : ''}
GROUP BY h.no, h.sell_to_customer_no, h.sell_to_customer_name, h.posting_date, h.due_date
ORDER BY days_past_due DESC
LIMIT ${limit}`

    case 'aged_payables':
      return `SELECT
  h.no AS invoice_no, h.buy_from_vendor_no AS vendor_no,
  h.buy_from_vendor_name AS vendor_name,
  h.posting_date, h.due_date,
  DATEDIFF(day, h.due_date, CURRENT_DATE) AS days_past_due,
  SUM(l.amount) AS amount
FROM ${s}.purch_inv_header h
JOIN ${s}.purch_inv_line l ON h.no = l.document_no AND h.company_id = l.company_id AND l._fivetran_deleted = false
WHERE h._fivetran_deleted = false ${dfH}
  ${filters.vendorName ? `AND h.buy_from_vendor_name ILIKE '%${filters.vendorName}%'` : ''}
GROUP BY h.no, h.buy_from_vendor_no, h.buy_from_vendor_name, h.posting_date, h.due_date
ORDER BY days_past_due DESC
LIMIT ${limit}`

    case 'sales_by_customer':
      return `SELECT
  h.sell_to_customer_no AS customer_no, h.sell_to_customer_name AS customer_name,
  COUNT(DISTINCT h.no) AS invoice_count,
  SUM(l.quantity) AS total_quantity,
  SUM(l.amount) AS total_sales
FROM ${s}.sales_invoice_header h
JOIN ${s}.sales_invoice_line l ON h.no = l.document_no AND h.company_id = l.company_id AND l._fivetran_deleted = false
WHERE h._fivetran_deleted = false ${dfH}
  ${filters.customerName ? `AND h.sell_to_customer_name ILIKE '%${filters.customerName}%'` : ''}
  ${filters.minAmount ? `AND l.amount >= ${filters.minAmount}` : ''}
  ${filters.maxAmount ? `AND l.amount <= ${filters.maxAmount}` : ''}
GROUP BY h.sell_to_customer_no, h.sell_to_customer_name
ORDER BY total_sales DESC
LIMIT ${limit}`

    case 'purchases_by_vendor':
      return `SELECT
  h.buy_from_vendor_no AS vendor_no, h.buy_from_vendor_name AS vendor_name,
  COUNT(DISTINCT h.no) AS invoice_count,
  SUM(l.quantity) AS total_quantity,
  SUM(l.amount) AS total_spend
FROM ${s}.purch_inv_header h
JOIN ${s}.purch_inv_line l ON h.no = l.document_no AND h.company_id = l.company_id AND l._fivetran_deleted = false
WHERE h._fivetran_deleted = false ${dfH}
  ${filters.vendorName ? `AND h.buy_from_vendor_name ILIKE '%${filters.vendorName}%'` : ''}
  ${filters.minAmount ? `AND l.amount >= ${filters.minAmount}` : ''}
  ${filters.maxAmount ? `AND l.amount <= ${filters.maxAmount}` : ''}
GROUP BY h.buy_from_vendor_no, h.buy_from_vendor_name
ORDER BY total_spend DESC
LIMIT ${limit}`

    case 'inventory_valuation': {
      // Opening = all entries BEFORE startDate (0 if no startDate)
      const hasStart = !!startDate
      const hasEnd = !!endDate
      const openingDateFilter = hasStart ? `AND ile_o.posting_date < '${startDate}'` : `AND 1=0`
      const periodDateFilter =
        hasStart && hasEnd
          ? `AND ile_p.posting_date BETWEEN '${startDate}' AND '${endDate}'`
          : hasStart
            ? `AND ile_p.posting_date >= '${startDate}'`
            : hasEnd
              ? `AND ile_p.posting_date <= '${endDate}'`
              : ''
      const closingDateFilter = hasEnd ? `AND ile_c.posting_date <= '${endDate}'` : ''
      const itemFilters = [
        filters.itemNo ? `AND i.no ILIKE '%${filters.itemNo}%'` : '',
        filters.itemName ? `AND i.description ILIKE '%${filters.itemName}%'` : '',
        filters.itemCategory ? `AND i.item_category_code ILIKE '%${filters.itemCategory}%'` : '',
      ].join('\n  ')
      return `WITH period_items AS (
  SELECT DISTINCT item_no, company_id
  FROM ${s}.item_ledger_entry
  WHERE _fivetran_deleted = false ${periodDateFilter.replace(/ile_p\./g, '')}
), base_items AS (
  SELECT item_no, company_id FROM period_items
  UNION
  SELECT item_no, company_id
  FROM ${s}.item_ledger_entry
  WHERE _fivetran_deleted = false ${closingDateFilter.replace(/ile_c\./g, '')}
  GROUP BY item_no, company_id
  HAVING SUM(quantity) > 0
  UNION
  SELECT item_no, company_id
  FROM ${s}.item_ledger_entry
  WHERE _fivetran_deleted = false
  GROUP BY item_no, company_id
  HAVING SUM(quantity) > 0
)
SELECT
  i.no AS item_no, i.description, i.item_category_code, i.base_unit_of_measure,
  COALESCE(o.opening_qty, 0) AS opening_qty,
  COALESCE(o.opening_cost, 0) AS opening_cost,
  COALESCE(p.outbound_qty, 0) AS outbound_qty,
  COALESCE(c.closing_qty, 0) AS closing_qty,
  COALESCE(c.closing_cost, 0) AS closing_cost,
  CASE WHEN COALESCE(c.closing_qty, 0) != 0
    THEN ROUND(CAST(COALESCE(c.closing_cost, 0) AS FLOAT) / CAST(COALESCE(c.closing_qty, 0) AS FLOAT), 2)
    ELSE 0 END AS avg_unit_cost,
  CASE WHEN (ABS(COALESCE(o.opening_qty, 0)) + ABS(COALESCE(c.closing_qty, 0))) != 0
    THEN ROUND(CAST(COALESCE(p.outbound_qty, 0) AS FLOAT) / ((ABS(CAST(COALESCE(o.opening_qty, 0) AS FLOAT)) + ABS(CAST(COALESCE(c.closing_qty, 0) AS FLOAT))) / 2.0), 2)
    ELSE 0 END AS turnover_ratio,
  COALESCE(ls.days_since_last_sale, -1) AS days_since_last_sale,
  CASE WHEN COALESCE(p.outbound_qty, 0) = 0 AND COALESCE(c.closing_qty, 0) > 0 THEN 1 ELSE 0 END AS is_slow_moving_period,
  CASE WHEN COALESCE(cur.current_qty, 0) > 0 AND (ls.last_sale_date IS NULL OR DATEDIFF(day, ls.last_sale_date, CURRENT_DATE) > 90) THEN 1 ELSE 0 END AS is_slow_moving_absolute,
  SUM(COALESCE(o.opening_qty, 0)) OVER () AS grand_opening_qty,
  SUM(COALESCE(o.opening_cost, 0)) OVER () AS grand_opening_cost,
  SUM(COALESCE(p.outbound_qty, 0)) OVER () AS grand_outbound_qty,
  SUM(COALESCE(c.closing_qty, 0)) OVER () AS grand_closing_qty,
  SUM(COALESCE(c.closing_cost, 0)) OVER () AS grand_closing_cost,
  SUM(CASE WHEN COALESCE(p.outbound_qty, 0) = 0 AND COALESCE(c.closing_qty, 0) > 0 THEN 1 ELSE 0 END) OVER () AS grand_slow_moving_period,
  SUM(CASE WHEN COALESCE(cur.current_qty, 0) > 0 AND (ls.last_sale_date IS NULL OR DATEDIFF(day, ls.last_sale_date, CURRENT_DATE) > 90) THEN 1 ELSE 0 END) OVER () AS grand_slow_moving_absolute,
  COUNT(*) OVER () AS grand_item_count,
  SUM(CASE WHEN pi.item_no IS NOT NULL THEN 1 ELSE 0 END) OVER () AS grand_period_item_count
FROM base_items b
JOIN ${s}.item i ON b.item_no = i.no AND b.company_id = i.company_id AND i._fivetran_deleted = false
LEFT JOIN period_items pi ON b.item_no = pi.item_no AND b.company_id = pi.company_id
LEFT JOIN (
  SELECT item_no, company_id,
    MAX(CASE WHEN entry_type = 'Sale' THEN posting_date END) AS last_sale_date,
    DATEDIFF(day, MAX(CASE WHEN entry_type = 'Sale' THEN posting_date END), CURRENT_DATE) AS days_since_last_sale
  FROM ${s}.item_ledger_entry
  WHERE _fivetran_deleted = false
  GROUP BY item_no, company_id
) ls ON b.item_no = ls.item_no AND b.company_id = ls.company_id
LEFT JOIN (
  SELECT ile_o.item_no, ile_o.company_id,
    SUM(ile_o.quantity) AS opening_qty,
    SUM(ile_o.cost_amount_actual) AS opening_cost
  FROM ${s}.item_ledger_entry ile_o
  WHERE ile_o._fivetran_deleted = false ${openingDateFilter}
  GROUP BY ile_o.item_no, ile_o.company_id
) o ON b.item_no = o.item_no AND b.company_id = o.company_id
LEFT JOIN (
  SELECT ile_p.item_no, ile_p.company_id,
    SUM(CASE WHEN ile_p.entry_type IN ('Purchase','Positive Adjmt.','Output') THEN ile_p.quantity ELSE 0 END) AS inbound_qty,
    SUM(CASE WHEN ile_p.entry_type IN ('Sale','Negative Adjmt.','Consumption') THEN ABS(ile_p.quantity) ELSE 0 END) AS outbound_qty
  FROM ${s}.item_ledger_entry ile_p
  WHERE ile_p._fivetran_deleted = false ${periodDateFilter}
  GROUP BY ile_p.item_no, ile_p.company_id
) p ON b.item_no = p.item_no AND b.company_id = p.company_id
LEFT JOIN (
  SELECT ile_c.item_no, ile_c.company_id,
    SUM(ile_c.quantity) AS closing_qty,
    SUM(ile_c.cost_amount_actual) AS closing_cost
  FROM ${s}.item_ledger_entry ile_c
  WHERE ile_c._fivetran_deleted = false ${closingDateFilter}
  GROUP BY ile_c.item_no, ile_c.company_id
) c ON b.item_no = c.item_no AND b.company_id = c.company_id
LEFT JOIN (
  SELECT item_no, company_id,
    SUM(quantity) AS current_qty
  FROM ${s}.item_ledger_entry
  WHERE _fivetran_deleted = false
  GROUP BY item_no, company_id
) cur ON b.item_no = cur.item_no AND b.company_id = cur.company_id
WHERE 1=1
  ${itemFilters}
ORDER BY closing_cost DESC
LIMIT ${limit}`
    }

    case 'sales_by_item':
      return `SELECT
  l.no AS item_no, l.description AS item_name,
  SUM(l.quantity) AS total_quantity,
  SUM(l.amount) AS total_sales,
  COUNT(DISTINCT l.document_no) AS invoice_count
FROM ${s}.sales_invoice_line l
JOIN ${s}.sales_invoice_header h ON l.document_no = h.no AND l.company_id = h.company_id AND h._fivetran_deleted = false
WHERE l._fivetran_deleted = false AND l.type = 'Item' ${dfH}
  ${filters.itemNo ? `AND l.no ILIKE '%${filters.itemNo}%'` : ''}
  ${filters.itemName ? `AND l.description ILIKE '%${filters.itemName}%'` : ''}
GROUP BY l.no, l.description
ORDER BY total_sales DESC
LIMIT ${limit}`

    case 'purchases_by_item':
      return `SELECT
  l.no AS item_no, l.description AS item_name,
  SUM(l.quantity) AS total_quantity,
  SUM(l.amount) AS total_cost,
  COUNT(DISTINCT l.document_no) AS invoice_count
FROM ${s}.purch_inv_line l
JOIN ${s}.purch_inv_header h ON l.document_no = h.no AND l.company_id = h.company_id AND h._fivetran_deleted = false
WHERE l._fivetran_deleted = false AND l.type = 'Item' ${dfH}
  ${filters.itemNo ? `AND l.no ILIKE '%${filters.itemNo}%'` : ''}
  ${filters.itemName ? `AND l.description ILIKE '%${filters.itemName}%'` : ''}
GROUP BY l.no, l.description
ORDER BY total_cost DESC
LIMIT ${limit}`

    default:
      return ''
  }
}

function buildEntitySQL(
  entityType: string,
  s: string,
  startDate: string,
  endDate: string,
  filters: Record<string, string>,
  limit: number
): string {
  const df = dateWhere('posting_date', startDate, endDate)
  const dfH = dateWhere('h.posting_date', startDate, endDate)

  switch (entityType) {
    case 'customer':
      return `SELECT no, name, address, city, phone_no, email, balance_lcy, credit_limit_lcy
FROM ${s}.customer WHERE _fivetran_deleted = false
  ${filters.customerName ? `AND name ILIKE '%${filters.customerName}%'` : ''}
ORDER BY name LIMIT ${limit}`

    case 'vendor':
      return `SELECT no, name, address, city, phone_no, email, balance_lcy
FROM ${s}.vendor WHERE _fivetran_deleted = false
  ${filters.vendorName ? `AND name ILIKE '%${filters.vendorName}%'` : ''}
ORDER BY name LIMIT ${limit}`

    case 'item':
      return `SELECT
  i.no, i.description, i.base_unit_of_measure, i.item_category_code, i.unit_cost, i.unit_price,
  COUNT(ile.entry_no) AS movement_count
FROM ${s}.item i
LEFT JOIN ${s}.item_ledger_entry ile ON i.no = ile.item_no AND i.company_id = ile.company_id AND ile._fivetran_deleted = false
WHERE i._fivetran_deleted = false
  ${filters.itemNo ? `AND i.no ILIKE '%${filters.itemNo}%'` : ''}
  ${filters.itemName ? `AND i.description ILIKE '%${filters.itemName}%'` : ''}
  ${filters.itemCategory ? `AND i.item_category_code ILIKE '%${filters.itemCategory}%'` : ''}
GROUP BY i.no, i.description, i.base_unit_of_measure, i.item_category_code, i.unit_cost, i.unit_price
ORDER BY i.no LIMIT ${limit}`

    case 'account':
      return `SELECT
  no, name,
  REPLACE(REPLACE(account_type, '_x002D_', '-'), '_x0020_', ' ') AS account_type,
  REPLACE(REPLACE(account_category, '_x0020_', ' '), '_x002D_', '-') AS account_category,
  account_subcategory_descript, debit_credit, blocked
FROM ${s}.g_l_account WHERE _fivetran_deleted = false
  ${filters.accountName ? `AND name ILIKE '%${filters.accountName}%'` : ''}
  ${filters.accountCategory ? `AND account_category ILIKE '%${filters.accountCategory}%'` : ''}
ORDER BY no LIMIT ${limit}`

    case 'sales_invoice':
      return `SELECT
  h.no, h.sell_to_customer_no, h.sell_to_customer_name,
  h.posting_date, h.due_date,
  SUM(l.amount) AS total_amount
FROM ${s}.sales_invoice_header h
JOIN ${s}.sales_invoice_line l ON h.no = l.document_no AND h.company_id = l.company_id AND l._fivetran_deleted = false
WHERE h._fivetran_deleted = false ${dfH}
  ${filters.customerName ? `AND h.sell_to_customer_name ILIKE '%${filters.customerName}%'` : ''}
GROUP BY h.no, h.sell_to_customer_no, h.sell_to_customer_name, h.posting_date, h.due_date
ORDER BY h.posting_date DESC LIMIT ${limit}`

    case 'purchase_invoice':
      return `SELECT
  h.no, h.buy_from_vendor_no, h.buy_from_vendor_name,
  h.posting_date, h.due_date,
  SUM(l.amount) AS total_amount
FROM ${s}.purch_inv_header h
JOIN ${s}.purch_inv_line l ON h.no = l.document_no AND h.company_id = l.company_id AND l._fivetran_deleted = false
WHERE h._fivetran_deleted = false ${dfH}
  ${filters.vendorName ? `AND h.buy_from_vendor_name ILIKE '%${filters.vendorName}%'` : ''}
GROUP BY h.no, h.buy_from_vendor_no, h.buy_from_vendor_name, h.posting_date, h.due_date
ORDER BY h.posting_date DESC LIMIT ${limit}`

    case 'general_ledger_entry':
      return `SELECT
  entry_no, posting_date, document_no, document_type,
  g_laccount_no, g_laccount_name, description,
  debit_amount, credit_amount, amount
FROM ${s}.g_l_entry
WHERE _fivetran_deleted = false AND reversed = false ${df}
  ${filters.accountName ? `AND g_laccount_name ILIKE '%${filters.accountName}%'` : ''}
ORDER BY posting_date DESC, entry_no DESC
LIMIT ${limit}`

    case 'bank_account':
      return `SELECT no, name, bank_account_no, currency_code, balance
FROM ${s}.bank_account WHERE _fivetran_deleted = false
ORDER BY name LIMIT ${limit}`

    default:
      return ''
  }
}

function buildMetricSQL(metricName: string, s: string, startDate: string, endDate: string): string {
  const df = dateWhere('g.posting_date', startDate, endDate)

  switch (metricName) {
    case 'total_revenue':
      return `SELECT 'total_revenue' AS metric,
  SUM(ABS(g.amount)) AS value
FROM ${s}.g_l_entry g
JOIN ${s}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id AND a._fivetran_deleted = false
WHERE g._fivetran_deleted = false AND g.reversed = false ${df}
  AND REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') = 'Income'`

    case 'total_expenses':
      return `SELECT 'total_expenses' AS metric,
  SUM(ABS(g.amount)) AS value
FROM ${s}.g_l_entry g
JOIN ${s}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id AND a._fivetran_deleted = false
WHERE g._fivetran_deleted = false AND g.reversed = false ${df}
  AND REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') = 'Expense'`

    case 'net_income':
      return `SELECT 'net_income' AS metric,
  SUM(CASE WHEN REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') = 'Income' THEN ABS(g.amount) ELSE 0 END)
  - SUM(CASE WHEN REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') IN ('Cost of Goods Sold', 'Expense') THEN ABS(g.amount) ELSE 0 END) AS value
FROM ${s}.g_l_entry g
JOIN ${s}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id AND a._fivetran_deleted = false
WHERE g._fivetran_deleted = false AND g.reversed = false ${df}`

    case 'gross_margin':
      return `SELECT 'gross_margin' AS metric,
  CASE WHEN SUM(CASE WHEN cat = 'Income' THEN val ELSE 0 END) != 0
    THEN ROUND(
      (SUM(CASE WHEN cat = 'Income' THEN val ELSE 0 END) - SUM(CASE WHEN cat = 'Cost of Goods Sold' THEN val ELSE 0 END))
      / SUM(CASE WHEN cat = 'Income' THEN val ELSE 0 END) * 100, 2)
    ELSE 0 END AS value
FROM (
  SELECT REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') AS cat, ABS(SUM(g.amount)) AS val
  FROM ${s}.g_l_entry g
  JOIN ${s}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id AND a._fivetran_deleted = false
  WHERE g._fivetran_deleted = false AND g.reversed = false ${df}
    AND REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') IN ('Income', 'Cost of Goods Sold')
  GROUP BY a.account_category
) sub`

    case 'inventory_turnover': {
      const dfIle = dateWhere('ile.posting_date', startDate, endDate)
      return `SELECT 'inventory_turnover' AS metric,
  CASE WHEN SUM(ile.quantity) != 0
    THEN ROUND(CAST(SUM(CASE WHEN ile.entry_type IN ('Sale','Negative Adjmt.','Consumption') THEN ABS(ile.quantity) ELSE 0 END) AS FLOAT)
    / CAST(ABS(SUM(ile.quantity)) AS FLOAT), 2) ELSE 0 END AS value
FROM ${s}.item_ledger_entry ile
WHERE ile._fivetran_deleted = false ${dfIle}`
    }

    case 'dso':
      return `SELECT 'dso' AS metric,
  CASE WHEN SUM(l.amount) != 0
    THEN ROUND(SUM(CASE WHEN DATEDIFF(day, h.due_date, CURRENT_DATE) > 0 THEN l.amount ELSE 0 END)
    / (SUM(l.amount) / 365.0), 0) ELSE 0 END AS value
FROM ${s}.sales_invoice_header h
JOIN ${s}.sales_invoice_line l ON h.no = l.document_no AND h.company_id = l.company_id AND l._fivetran_deleted = false
WHERE h._fivetran_deleted = false ${dateWhere('h.posting_date', startDate, endDate)}`

    case 'dpo':
      return `SELECT 'dpo' AS metric,
  CASE WHEN SUM(l.amount) != 0
    THEN ROUND(SUM(CASE WHEN DATEDIFF(day, h.due_date, CURRENT_DATE) > 0 THEN l.amount ELSE 0 END)
    / (SUM(l.amount) / 365.0), 0) ELSE 0 END AS value
FROM ${s}.purch_inv_header h
JOIN ${s}.purch_inv_line l ON h.no = l.document_no AND h.company_id = l.company_id AND l._fivetran_deleted = false
WHERE h._fivetran_deleted = false ${dateWhere('h.posting_date', startDate, endDate)}`

    case 'total_assets':
      return `SELECT 'total_assets' AS metric,
  SUM(g.amount) AS value
FROM ${s}.g_l_entry g
JOIN ${s}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id AND a._fivetran_deleted = false
WHERE g._fivetran_deleted = false AND g.reversed = false ${df}
  AND REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') = 'Assets'`

    case 'total_liabilities':
      return `SELECT 'total_liabilities' AS metric,
  ABS(SUM(g.amount)) AS value
FROM ${s}.g_l_entry g
JOIN ${s}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id AND a._fivetran_deleted = false
WHERE g._fivetran_deleted = false AND g.reversed = false ${df}
  AND REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') = 'Liabilities'`

    default:
      return ''
  }
}

function buildSearchSQL(scope: string, text: string, s: string, limit: number): string {
  const q = text.replace(/'/g, "''")
  const searches: string[] = []

  if (scope === 'all' || scope === 'customers')
    searches.push(
      `SELECT 'Customer' AS type, no, name, '' AS extra FROM ${s}.customer WHERE _fivetran_deleted = false AND (no ILIKE '%${q}%' OR name ILIKE '%${q}%')`
    )
  if (scope === 'all' || scope === 'vendors')
    searches.push(
      `SELECT 'Vendor' AS type, no, name, '' AS extra FROM ${s}.vendor WHERE _fivetran_deleted = false AND (no ILIKE '%${q}%' OR name ILIKE '%${q}%')`
    )
  if (scope === 'all' || scope === 'items')
    searches.push(
      `SELECT 'Item' AS type, no, description AS name, item_category_code AS extra FROM ${s}.item WHERE _fivetran_deleted = false AND (no ILIKE '%${q}%' OR description ILIKE '%${q}%')`
    )
  if (scope === 'all' || scope === 'accounts')
    searches.push(
      `SELECT 'Account' AS type, no, name, REPLACE(REPLACE(account_category, '_x0020_', ' '), '_x002D_', '-') AS extra FROM ${s}.g_l_account WHERE _fivetran_deleted = false AND (no ILIKE '%${q}%' OR name ILIKE '%${q}%')`
    )

  return searches.join('\nUNION ALL\n') + `\nORDER BY type, name LIMIT ${limit}`
}

function buildAnalyzeSQL(
  analysisType: string,
  focusArea: string,
  s: string,
  startDate: string,
  endDate: string,
  limit: number
): string {
  const df = dateWhere('g.posting_date', startDate, endDate)

  if (analysisType === 'trends') {
    if (focusArea === 'revenue') {
      return `SELECT DATE_TRUNC('month', g.posting_date) AS month, SUM(ABS(g.amount)) AS value
FROM ${s}.g_l_entry g
JOIN ${s}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id AND a._fivetran_deleted = false
WHERE g._fivetran_deleted = false AND g.reversed = false ${df}
  AND REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') = 'Income'
GROUP BY DATE_TRUNC('month', g.posting_date) ORDER BY month LIMIT ${limit}`
    }
    if (focusArea === 'expenses') {
      return `SELECT DATE_TRUNC('month', g.posting_date) AS month, SUM(ABS(g.amount)) AS value
FROM ${s}.g_l_entry g
JOIN ${s}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id AND a._fivetran_deleted = false
WHERE g._fivetran_deleted = false AND g.reversed = false ${df}
  AND REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') = 'Expense'
GROUP BY DATE_TRUNC('month', g.posting_date) ORDER BY month LIMIT ${limit}`
    }
    if (focusArea === 'inventory') {
      const dfIle = dateWhere('ile.posting_date', startDate, endDate)
      return `SELECT DATE_TRUNC('month', ile.posting_date) AS month,
  SUM(CASE WHEN ile.entry_type IN ('Purchase','Positive Adjmt.','Output') THEN ile.quantity ELSE 0 END) AS inbound,
  SUM(CASE WHEN ile.entry_type IN ('Sale','Negative Adjmt.','Consumption') THEN ABS(ile.quantity) ELSE 0 END) AS outbound,
  SUM(ile.quantity) AS net
FROM ${s}.item_ledger_entry ile
WHERE ile._fivetran_deleted = false ${dfIle}
GROUP BY DATE_TRUNC('month', ile.posting_date) ORDER BY month LIMIT ${limit}`
    }
    if (focusArea === 'profitability') {
      return `SELECT DATE_TRUNC('month', g.posting_date) AS month,
  SUM(CASE WHEN REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') = 'Income' THEN ABS(g.amount) ELSE 0 END) AS revenue,
  SUM(CASE WHEN REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') IN ('Cost of Goods Sold','Expense') THEN ABS(g.amount) ELSE 0 END) AS costs,
  SUM(CASE WHEN REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') = 'Income' THEN ABS(g.amount) ELSE 0 END)
  - SUM(CASE WHEN REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') IN ('Cost of Goods Sold','Expense') THEN ABS(g.amount) ELSE 0 END) AS net_income
FROM ${s}.g_l_entry g
JOIN ${s}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id AND a._fivetran_deleted = false
WHERE g._fivetran_deleted = false AND g.reversed = false ${df}
GROUP BY DATE_TRUNC('month', g.posting_date) ORDER BY month LIMIT ${limit}`
    }
    if (focusArea === 'cash_flow') {
      return `SELECT DATE_TRUNC('month', posting_date) AS month,
  SUM(debit_amount) AS total_debits, SUM(credit_amount) AS total_credits, SUM(amount) AS net_amount
FROM ${s}.g_l_entry
WHERE _fivetran_deleted = false AND reversed = false ${dateWhere('posting_date', startDate, endDate)}
GROUP BY DATE_TRUNC('month', posting_date) ORDER BY month LIMIT ${limit}`
    }
  }

  if (analysisType === 'breakdown') {
    if (focusArea === 'revenue') {
      return `SELECT h.sell_to_customer_name AS category, SUM(l.amount) AS value, COUNT(DISTINCT h.no) AS count
FROM ${s}.sales_invoice_header h
JOIN ${s}.sales_invoice_line l ON h.no = l.document_no AND h.company_id = l.company_id AND l._fivetran_deleted = false
WHERE h._fivetran_deleted = false ${dateWhere('h.posting_date', startDate, endDate)}
GROUP BY h.sell_to_customer_name ORDER BY value DESC LIMIT ${limit}`
    }
    if (focusArea === 'expenses') {
      return `SELECT a.name AS category, SUM(ABS(g.amount)) AS value, COUNT(*) AS count
FROM ${s}.g_l_entry g
JOIN ${s}.g_l_account a ON g.g_laccount_no = a.no AND g.company_id = a.company_id AND a._fivetran_deleted = false
WHERE g._fivetran_deleted = false AND g.reversed = false ${df}
  AND REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') = 'Expense'
GROUP BY a.name ORDER BY value DESC LIMIT ${limit}`
    }
    if (focusArea === 'inventory') {
      const dfIle = dateWhere('ile.posting_date', startDate, endDate)
      return `SELECT i.item_category_code AS category, SUM(ile.quantity) AS net_quantity,
  SUM(ile.cost_amount_actual) AS total_cost, COUNT(DISTINCT ile.item_no) AS item_count
FROM ${s}.item_ledger_entry ile
JOIN ${s}.item i ON ile.item_no = i.no AND ile.company_id = i.company_id AND i._fivetran_deleted = false
WHERE ile._fivetran_deleted = false ${dfIle}
GROUP BY i.item_category_code ORDER BY total_cost DESC LIMIT ${limit}`
    }
    return `SELECT global_dimension_1_code AS category, SUM(debit_amount) AS total_debits, SUM(credit_amount) AS total_credits, SUM(amount) AS net_amount
FROM ${s}.g_l_entry WHERE _fivetran_deleted = false AND reversed = false ${dateWhere('posting_date', startDate, endDate)}
  AND global_dimension_1_code IS NOT NULL AND global_dimension_1_code != ''
GROUP BY global_dimension_1_code ORDER BY net_amount DESC LIMIT ${limit}`
  }

  if (analysisType === 'performance') {
    if (focusArea === 'revenue' || focusArea === 'profitability') {
      return `SELECT DATE_TRUNC('month', h.posting_date) AS month,
  SUM(l.amount) AS revenue, COUNT(DISTINCT h.no) AS invoice_count,
  COUNT(DISTINCT h.sell_to_customer_no) AS customer_count
FROM ${s}.sales_invoice_header h
JOIN ${s}.sales_invoice_line l ON h.no = l.document_no AND h.company_id = l.company_id AND l._fivetran_deleted = false
WHERE h._fivetran_deleted = false ${dateWhere('h.posting_date', startDate, endDate)}
GROUP BY DATE_TRUNC('month', h.posting_date) ORDER BY month LIMIT ${limit}`
    }
    return `SELECT DATE_TRUNC('month', posting_date) AS month,
  COUNT(*) AS entry_count, SUM(debit_amount) AS total_debits, SUM(credit_amount) AS total_credits
FROM ${s}.g_l_entry WHERE _fivetran_deleted = false AND reversed = false ${dateWhere('posting_date', startDate, endDate)}
GROUP BY DATE_TRUNC('month', posting_date) ORDER BY month LIMIT ${limit}`
  }

  return ''
}

function buildCalculatorSQL(ratio: string, s: string, startDate: string, endDate: string): string {
  // Exact same query as useWarehouseFinancialRatios in useWarehouseData.ts
  // Uses raw Fivetran-encoded columns (no REPLACE) — matches production exactly
  const df = dateWhere('e.posting_date', startDate, endDate)
  return `SELECT
  COALESCE(SUM(CASE
    WHEN a.account_category = 'Assets'
    AND (a.account_subcategory_descript ILIKE '%current%' OR a.account_subcategory_descript ILIKE '%cash%' OR a.account_subcategory_descript ILIKE '%receivable%' OR a.account_subcategory_descript ILIKE '%inventory%')
    THEN e.debit_amount - e.credit_amount
    ELSE 0
  END), 0) AS current_assets,
  COALESCE(SUM(CASE
    WHEN a.account_category = 'Assets'
    AND (a.account_subcategory_descript ILIKE '%cash%' OR a.account_subcategory_descript ILIKE '%receivable%')
    THEN e.debit_amount - e.credit_amount
    ELSE 0
  END), 0) AS quick_assets,
  COALESCE(SUM(CASE
    WHEN a.account_category = 'Liabilities'
    AND (a.account_subcategory_descript ILIKE '%current%' OR a.account_subcategory_descript ILIKE '%payable%' OR a.account_subcategory_descript ILIKE '%accrued%')
    THEN e.credit_amount - e.debit_amount
    ELSE 0
  END), 0) AS current_liabilities,
  COALESCE(SUM(CASE
    WHEN a.account_category = 'Liabilities'
    THEN e.credit_amount - e.debit_amount
    ELSE 0
  END), 0) AS total_liabilities,
  COALESCE(SUM(CASE
    WHEN a.account_category = 'Equity'
    THEN e.credit_amount - e.debit_amount
    ELSE 0
  END), 0) AS total_equity
FROM ${s}.g_l_entry e
JOIN ${s}.g_l_account a
  ON e.g_laccount_no = a.no
  AND e.company_id = a.company_id
WHERE e._fivetran_deleted = false
  AND e.reversed = false
  AND a._fivetran_deleted = false
  AND a.account_type = 'Posting'
  ${df}`
}

// ── Component ────────────────────────────────────────────────────────────────

export default function WarehouseAgentPage() {
  const { status: sessionStatus } = useSession()

  // Config
  const [schema, setSchema] = useState<string>('')
  const [configLoading, setConfigLoading] = useState(true)
  const [warehouseConfig, setWarehouseConfig] = useState<WarehouseConfig | null>(null)

  // Date
  const [selectedPreset, setSelectedPreset] = useState<string>('lastYear')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Form
  const [queryType, setQueryType] = useState<(typeof QUERY_TYPES)[number]>('report')
  const [reportType, setReportType] = useState<string>('profit_loss')
  const [entityType, setEntityType] = useState<string>('customer')
  const [metricName, setMetricName] = useState<string>('total_revenue')
  const [searchText, setSearchText] = useState<string>('')
  const [searchScope, setSearchScope] = useState<string>('all')
  const [analysisType, setAnalysisType] = useState<string>('trends')
  const [focusArea, setFocusArea] = useState<string>('revenue')
  const [calculatorRatio, setCalculatorRatio] = useState<string>('all_ratios')
  const [limit, setLimit] = useState<string>('200')
  const [customSql, setCustomSql] = useState<string>('')

  // Filters
  const [customerName, setCustomerName] = useState<string>('')
  const [vendorName, setVendorName] = useState<string>('')
  const [itemNo, setItemNo] = useState<string>('')
  const [itemName, setItemName] = useState<string>('')
  const [itemCategory, setItemCategory] = useState<string>('')
  const [accountName, setAccountName] = useState<string>('')
  const [accountCategory, setAccountCategory] = useState<string>('')
  const [minAmount, setMinAmount] = useState<string>('')
  const [maxAmount, setMaxAmount] = useState<string>('')

  // Result
  const [result, setResult] = useState<QueryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastQueryTime, setLastQueryTime] = useState<number | null>(null)
  const [showPayload, setShowPayload] = useState(false)
  const [showJson, setShowJson] = useState(false)
  const [showMarkdown, setShowMarkdown] = useState(false)
  const [copied, setCopied] = useState(false)

  // Init dates
  useEffect(() => {
    const preset = DATE_PRESETS['lastYear']
    if (preset) {
      const { start, end } = preset.getRange()
      setStartDate(start)
      setEndDate(end)
    }
  }, [])

  // Load config
  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch('/api/redshift/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_warehouse_config' }),
        })
        const data = await response.json()
        if (data.success && data.config) {
          setWarehouseConfig(data.config)
          const defaultSchema = data.config.default_schema || data.config.schemas?.[0]?.schema_name
          if (defaultSchema) setSchema(defaultSchema)
        }
      } catch (err) {
        console.error('[Warehouse Agent] Config load error:', err)
      } finally {
        setConfigLoading(false)
      }
    }
    if (sessionStatus === 'authenticated') loadConfig()
  }, [sessionStatus])

  const applyPreset = useCallback((key: string) => {
    setSelectedPreset(key)
    const preset = DATE_PRESETS[key]
    if (preset) {
      const { start, end } = preset.getRange()
      setStartDate(start)
      setEndDate(end)
    }
  }, [])

  // Build SQL
  const currentQuery = useMemo(() => {
    if (!schema) return ''
    const filters: Record<string, string> = {}
    if (customerName) filters.customerName = customerName
    if (vendorName) filters.vendorName = vendorName
    if (itemNo) filters.itemNo = itemNo
    if (itemName) filters.itemName = itemName
    if (itemCategory) filters.itemCategory = itemCategory
    if (accountName) filters.accountName = accountName
    if (accountCategory) filters.accountCategory = accountCategory
    if (minAmount) filters.minAmount = minAmount
    if (maxAmount) filters.maxAmount = maxAmount
    const lim = parseInt(limit, 10) || 200

    if (queryType === 'custom_sql') return customSql
    if (queryType === 'report')
      return buildReportSQL(reportType, schema, startDate, endDate, filters, lim)
    if (queryType === 'entity')
      return buildEntitySQL(entityType, schema, startDate, endDate, filters, lim)
    if (queryType === 'metric') return buildMetricSQL(metricName, schema, startDate, endDate)
    if (queryType === 'search') return buildSearchSQL(searchScope, searchText, schema, lim)
    if (queryType === 'analyze')
      return buildAnalyzeSQL(analysisType, focusArea, schema, startDate, endDate, lim)
    if (queryType === 'calculator')
      return buildCalculatorSQL(calculatorRatio, schema, startDate, endDate)
    return ''
  }, [
    schema,
    queryType,
    reportType,
    entityType,
    metricName,
    searchText,
    searchScope,
    analysisType,
    focusArea,
    calculatorRatio,
    startDate,
    endDate,
    limit,
    customSql,
    customerName,
    vendorName,
    itemNo,
    itemName,
    itemCategory,
    accountName,
    accountCategory,
    minAmount,
    maxAmount,
  ])

  // Submit
  const handleSubmit = useCallback(async () => {
    const sql = currentQuery.trim()
    if (!sql) {
      setError('No query to execute')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    const startTime = Date.now()

    try {
      const response = await fetch('/api/redshift/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql }),
      })
      const elapsed = Date.now() - startTime
      setLastQueryTime(elapsed)
      const data = await response.json()
      if (!response.ok || !data.success) {
        setError(data.error || `HTTP ${response.status}`)
        setResult(data)
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [currentQuery])

  const handleCopy = useCallback(() => {
    if (!result) return
    navigator.clipboard.writeText(JSON.stringify(result.data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [result])

  // Auth & config
  if (sessionStatus === 'loading' || configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="theme-text-secondary">Loading warehouse agent...</p>
        </div>
      </div>
    )
  }

  if (sessionStatus !== 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-luxury-card p-8 text-center">
          <h2 className="text-xl font-semibold theme-text-primary mb-2">Authentication Required</h2>
          <p className="theme-text-secondary">Please sign in to access the warehouse agent.</p>
        </div>
      </div>
    )
  }

  // Which filters to show
  const showCustomer =
    (queryType === 'report' && ['sales_by_customer', 'aged_receivables'].includes(reportType)) ||
    (queryType === 'entity' && entityType === 'customer')
  const showVendor =
    (queryType === 'report' && ['purchases_by_vendor', 'aged_payables'].includes(reportType)) ||
    (queryType === 'entity' && entityType === 'vendor')
  const showItem =
    (queryType === 'report' &&
      ['inventory_valuation', 'sales_by_item', 'purchases_by_item'].includes(reportType)) ||
    (queryType === 'entity' && entityType === 'item')
  const showAmount =
    queryType === 'report' &&
    ['sales_by_customer', 'purchases_by_vendor', 'sales_by_item', 'purchases_by_item'].includes(
      reportType
    )
  const showAccount =
    (queryType === 'report' &&
      ['trial_balance', 'profit_loss', 'monthly_pnl_trend', 'balance_sheet', 'cash_flow'].includes(
        reportType
      )) ||
    (queryType === 'entity' && entityType === 'account') ||
    (queryType === 'entity' && entityType === 'general_ledger_entry')
  const hasFilters = showCustomer || showVendor || showItem || showAmount || showAccount

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--theme-bg)' }}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass-luxury-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold theme-text-primary">Warehouse Agent Tester</h1>
              <p className="theme-text-secondary mt-1">
                Query Redshift warehouse data — reports, entities, metrics, and analysis.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {schema && (
                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium font-mono">
                  {schema}
                </span>
              )}
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium">
                DEV
              </span>
            </div>
          </div>
        </div>

        {/* Schema selector */}
        {warehouseConfig && warehouseConfig.schemas.length > 1 && (
          <div className="glass-luxury-card p-6">
            <h2 className="text-lg font-medium theme-text-primary mb-4">Data Source</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {warehouseConfig.schemas.map((s) => (
                <button
                  key={s.schema_name}
                  onClick={() => setSchema(s.schema_name)}
                  className={cn(
                    'p-4 rounded-lg border text-left transition-all',
                    schema === s.schema_name
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  )}
                >
                  <p className="font-medium theme-text-primary">{s.display_name}</p>
                  <p className="text-xs font-mono theme-text-secondary mt-1">{s.schema_name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Query Builder */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-6">
          <h2 className="text-lg font-medium text-zinc-100">Query Builder</h2>

          {/* Query Type */}
          <div className="flex flex-wrap gap-2">
            {QUERY_TYPES.map((qt) => (
              <button
                key={qt}
                onClick={() => setQueryType(qt)}
                className={cn(
                  'px-4 py-2 text-sm rounded-lg font-medium transition-colors',
                  queryType === qt
                    ? 'bg-blue-600 text-white'
                    : 'border border-white/10 text-zinc-400 hover:bg-white/5'
                )}
              >
                {formatLabel(qt)}
              </button>
            ))}
          </div>

          {/* Report Type */}
          {queryType === 'report' && (
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Report Type</label>
              <div className="flex flex-wrap gap-2">
                {REPORT_TYPES.map((rt) => (
                  <button
                    key={rt}
                    onClick={() => setReportType(rt)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                      reportType === rt
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'border-white/10 text-zinc-400 hover:bg-white/5'
                    )}
                  >
                    {formatLabel(rt)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Entity Type */}
          {queryType === 'entity' && (
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Entity Type</label>
              <div className="flex flex-wrap gap-2">
                {ENTITY_TYPES.map((et) => (
                  <button
                    key={et}
                    onClick={() => setEntityType(et)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                      entityType === et
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'border-white/10 text-zinc-400 hover:bg-white/5'
                    )}
                  >
                    {formatLabel(et)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Metric */}
          {queryType === 'metric' && (
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Metric</label>
              <div className="flex flex-wrap gap-2">
                {METRIC_NAMES.map((mn) => (
                  <button
                    key={mn}
                    onClick={() => setMetricName(mn)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                      metricName === mn
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'border-white/10 text-zinc-400 hover:bg-white/5'
                    )}
                  >
                    {formatLabel(mn)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          {queryType === 'search' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Search Scope</label>
                <div className="flex flex-wrap gap-2">
                  {SEARCH_SCOPES.map((ss) => (
                    <button
                      key={ss}
                      onClick={() => setSearchScope(ss)}
                      className={cn(
                        'px-3 py-1.5 text-sm rounded-lg border transition-colors capitalize',
                        searchScope === ss
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'border-white/10 text-zinc-400 hover:bg-white/5'
                      )}
                    >
                      {ss}
                    </button>
                  ))}
                </div>
              </div>
              <InputField
                label="Search Text"
                value={searchText}
                onChange={setSearchText}
                placeholder="e.g. fish, salmon"
              />
            </div>
          )}

          {/* Analyze */}
          {queryType === 'analyze' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Analysis Type</label>
                <div className="flex flex-wrap gap-2">
                  {ANALYSIS_TYPES.map((at) => (
                    <button
                      key={at}
                      onClick={() => setAnalysisType(at)}
                      className={cn(
                        'px-3 py-1.5 text-sm rounded-lg border transition-colors capitalize',
                        analysisType === at
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'border-white/10 text-zinc-400 hover:bg-white/5'
                      )}
                    >
                      {at}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Focus Area</label>
                <div className="flex flex-wrap gap-2">
                  {FOCUS_AREAS.map((fa) => (
                    <button
                      key={fa}
                      onClick={() => setFocusArea(fa)}
                      className={cn(
                        'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                        focusArea === fa
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'border-white/10 text-zinc-400 hover:bg-white/5'
                      )}
                    >
                      {formatLabel(fa)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Calculator */}
          {queryType === 'calculator' && (
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Financial Ratio</label>
              <div className="flex flex-wrap gap-2">
                {CALCULATOR_RATIOS.map((cr) => (
                  <button
                    key={cr}
                    onClick={() => setCalculatorRatio(cr)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                      calculatorRatio === cr
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'border-white/10 text-zinc-400 hover:bg-white/5'
                    )}
                  >
                    {formatLabel(cr)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Uses the same GL query as the platform. Select a date range or leave blank for all
                time.
              </p>
            </div>
          )}

          {/* Custom SQL */}
          {queryType === 'custom_sql' && (
            <div>
              <label className="block text-sm text-zinc-400 mb-2">SQL Query</label>
              <textarea
                value={customSql}
                onChange={(e) => setCustomSql(e.target.value)}
                placeholder={`SELECT * FROM ${schema || 'schema'}.table_name WHERE ...`}
                rows={6}
                className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-zinc-100 placeholder:text-white/30 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Only SELECT queries allowed. Max 1000 rows.
              </p>
            </div>
          )}

          {/* Date Period */}
          {queryType !== 'custom_sql' && (
            <div className="border-t border-white/10 pt-5 space-y-4">
              <h3 className="text-base font-medium text-zinc-200">Date Period</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(DATE_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg transition-colors',
                      selectedPreset === key
                        ? 'bg-blue-600 text-white'
                        : 'border border-white/10 text-zinc-400 hover:bg-white/5'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      setSelectedPreset('custom')
                    }}
                    className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value)
                      setSelectedPreset('custom')
                    }}
                    className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Limit */}
          {queryType !== 'custom_sql' && queryType !== 'calculator' && (
            <div className="border-t border-white/10 pt-5">
              <div className="w-32">
                <label className="block text-sm text-zinc-400 mb-1">Limit</label>
                <input
                  type="text"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="200"
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>
          )}

          {/* Filters */}
          {hasFilters && queryType !== 'custom_sql' && (
            <div className="border-t border-white/10 pt-5 space-y-4">
              <h3 className="text-base font-medium text-zinc-200">Filters</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {showCustomer && (
                  <InputField
                    label="Customer Name"
                    value={customerName}
                    onChange={setCustomerName}
                    placeholder="partial match"
                  />
                )}
                {showVendor && (
                  <InputField
                    label="Vendor Name"
                    value={vendorName}
                    onChange={setVendorName}
                    placeholder="partial match"
                  />
                )}
                {showItem && (
                  <>
                    <InputField
                      label="Item No"
                      value={itemNo}
                      onChange={setItemNo}
                      placeholder="e.g. F-003"
                    />
                    <InputField
                      label="Item Name"
                      value={itemName}
                      onChange={setItemName}
                      placeholder="partial match"
                    />
                    <InputField
                      label="Item Category"
                      value={itemCategory}
                      onChange={setItemCategory}
                      placeholder="e.g. FISH"
                    />
                  </>
                )}
                {showAccount && (
                  <>
                    <InputField
                      label="Account Name"
                      value={accountName}
                      onChange={setAccountName}
                      placeholder="e.g. Rent, Sales"
                    />
                    <InputField
                      label="Account Category"
                      value={accountCategory}
                      onChange={setAccountCategory}
                      placeholder="e.g. Income, Expense"
                    />
                  </>
                )}
                {showAmount && (
                  <>
                    <InputField
                      label="Min Amount"
                      value={minAmount}
                      onChange={setMinAmount}
                      placeholder="number"
                    />
                    <InputField
                      label="Max Amount"
                      value={maxAmount}
                      onChange={setMaxAmount}
                      placeholder="number"
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="border-t border-white/10 pt-5 flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={loading || !schema}
              className={cn(
                'px-6 py-2.5 rounded-lg text-sm font-medium transition-colors',
                loading || !schema
                  ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              )}
            >
              {loading ? 'Running...' : 'Execute Query'}
            </button>
            {queryType !== 'custom_sql' && (
              <button
                onClick={() => setShowPayload(!showPayload)}
                className="px-4 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-white/10 hover:bg-white/5 transition-colors"
              >
                {showPayload ? 'Hide' : 'Show'} SQL
              </button>
            )}
          </div>

          {showPayload && (
            <pre className="bg-black/50 border border-white/10 rounded-lg p-4 text-xs text-zinc-300 overflow-auto max-h-60 font-mono whitespace-pre-wrap">
              {currentQuery || '(no query)'}
            </pre>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {result && result.success && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-medium text-zinc-100">Result</h2>
                {lastQueryTime !== null && (
                  <span className="text-xs font-mono text-zinc-500">{lastQueryTime}ms</span>
                )}
                <span className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
                  {result.count} rows
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowMarkdown(!showMarkdown)
                    setShowJson(false)
                  }}
                  className={cn(
                    'px-3.5 py-1 text-xs font-medium rounded-full border transition-colors',
                    showMarkdown
                      ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                      : 'bg-slate-500/10 border-white/10 text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  Markdown
                </button>
                <button
                  onClick={() => {
                    setShowJson(!showJson)
                    setShowMarkdown(false)
                  }}
                  className={cn(
                    'px-3.5 py-1 text-xs font-medium rounded-full border transition-colors',
                    showJson
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                      : 'bg-slate-500/10 border-white/10 text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  JSON
                </button>
                {showJson && (
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy JSON'}
                  </button>
                )}
              </div>
            </div>

            {showJson ? (
              <pre className="mt-4 bg-black/50 border border-white/10 rounded-lg p-4 text-xs text-zinc-300 overflow-auto max-h-[600px] font-mono">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            ) : (
              <div className="mt-4">
                <ResultVisualView
                  result={result}
                  queryType={queryType}
                  subType={
                    queryType === 'report'
                      ? reportType
                      : queryType === 'entity'
                        ? entityType
                        : queryType === 'metric'
                          ? metricName
                          : queryType === 'analyze'
                            ? `${analysisType}_${focusArea}`
                            : queryType === 'calculator'
                              ? calculatorRatio
                              : queryType
                  }
                  schema={schema}
                  startDate={startDate}
                  endDate={endDate}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Visual Result View ───────────────────────────────────────────────────────

function ResultVisualView({
  result,
  queryType,
  subType,
  schema,
  startDate,
  endDate,
}: {
  result: QueryResult
  queryType: string
  subType: string
  schema: string
  startDate: string
  endDate: string
}) {
  const data = result.data
  if (!data?.length) return <p className="text-zinc-500 text-sm">No data returned.</p>

  return (
    <div className="space-y-5">
      <KPICards data={data} queryType={queryType} subType={subType} />
      <ChartView data={data} queryType={queryType} subType={subType} />
      <DataTableView data={data} columns={result.columns} />
      {queryType === 'report' && subType === 'inventory_valuation' && schema && (
        <InventoryRelatedTables schema={schema} startDate={startDate} endDate={endDate} />
      )}
    </div>
  )
}

// ── KPI Cards ────────────────────────────────────────────────────────────────

function KPICards({
  data,
  queryType,
  subType,
}: {
  data: Record<string, unknown>[]
  queryType: string
  subType: string
}) {
  const kpis = useMemo(() => {
    const cards: { label: string; value: string; color: string }[] = []

    if (queryType === 'report') {
      if (subType === 'trial_balance') {
        const debits = data.reduce((s, r) => s + (Number(r.total_debits) || 0), 0)
        const credits = data.reduce((s, r) => s + (Number(r.total_credits) || 0), 0)
        const net = data.reduce((s, r) => s + (Number(r.net_balance) || 0), 0)
        cards.push(
          { label: 'Accounts', value: data.length.toLocaleString(), color: 'text-blue-400' },
          { label: 'Total Debits', value: formatNumber(debits), color: 'text-emerald-400' },
          { label: 'Total Credits', value: formatNumber(credits), color: 'text-red-400' },
          {
            label: 'Net Balance',
            value: formatNumber(net),
            color: net >= 0 ? 'text-emerald-400' : 'text-red-400',
          }
        )
      } else if (subType === 'profit_loss') {
        const revenue = data
          .filter((r) => String(r.account_category) === 'Income')
          .reduce((s, r) => s + Math.abs(Number(r.gl_amount) || 0), 0)
        const cogs = data
          .filter((r) => String(r.account_category) === 'Cost of Goods Sold')
          .reduce((s, r) => s + Math.abs(Number(r.gl_amount) || 0), 0)
        const expenses = data
          .filter((r) => String(r.account_category) === 'Expense')
          .reduce((s, r) => s + Math.abs(Number(r.gl_amount) || 0), 0)
        const netIncome = revenue - cogs - expenses
        cards.push(
          { label: 'Revenue', value: formatNumber(revenue), color: 'text-emerald-400' },
          { label: 'COGS', value: formatNumber(cogs), color: 'text-red-400' },
          { label: 'Gross Profit', value: formatNumber(revenue - cogs), color: 'text-blue-400' },
          { label: 'Expenses', value: formatNumber(expenses), color: 'text-amber-400' },
          {
            label: 'Net Income',
            value: formatNumber(netIncome),
            color: netIncome >= 0 ? 'text-emerald-400' : 'text-red-400',
          }
        )
      } else if (subType === 'balance_sheet') {
        const assets = data
          .filter((r) => String(r.account_category) === 'Assets')
          .reduce((s, r) => s + (Number(r.balance) || 0), 0)
        const liabilities = data
          .filter((r) => String(r.account_category) === 'Liabilities')
          .reduce((s, r) => s + Math.abs(Number(r.balance) || 0), 0)
        const equity = data
          .filter((r) => String(r.account_category) === 'Equity')
          .reduce((s, r) => s + Math.abs(Number(r.balance) || 0), 0)
        cards.push(
          { label: 'Total Assets', value: formatNumber(assets), color: 'text-emerald-400' },
          { label: 'Total Liabilities', value: formatNumber(liabilities), color: 'text-red-400' },
          { label: 'Total Equity', value: formatNumber(equity), color: 'text-blue-400' }
        )
      } else if (subType === 'sales_by_customer' || subType === 'purchases_by_vendor') {
        const totalKey = subType === 'sales_by_customer' ? 'total_sales' : 'total_spend'
        const total = data.reduce((s, r) => s + (Number(r[totalKey]) || 0), 0)
        const invoices = data.reduce((s, r) => s + (Number(r.invoice_count) || 0), 0)
        cards.push(
          {
            label: subType === 'sales_by_customer' ? 'Customers' : 'Vendors',
            value: data.length.toLocaleString(),
            color: 'text-blue-400',
          },
          { label: 'Total Invoices', value: invoices.toLocaleString(), color: 'text-purple-400' },
          {
            label: subType === 'sales_by_customer' ? 'Total Sales' : 'Total Spend',
            value: formatNumber(total),
            color: 'text-emerald-400',
          }
        )
      } else if (subType === 'inventory_valuation') {
        // Use grand totals from window functions (computed across ALL items before LIMIT)
        const row0 = data[0] || {}
        const skuCount =
          Number(row0.grand_period_item_count) || Number(row0.grand_item_count) || data.length
        const openingQty = Number(row0.grand_opening_qty) || 0
        const openingCost = Number(row0.grand_opening_cost) || 0
        const closingQty = Number(row0.grand_closing_qty) || 0
        const closingCost = Number(row0.grand_closing_cost) || 0
        const outbound = Number(row0.grand_outbound_qty) || 0
        const slowMovingPeriod = Number(row0.grand_slow_moving_period) || 0
        const slowMovingAbsolute = Number(row0.grand_slow_moving_absolute) || 0
        const avgInv = (Math.abs(openingQty) + Math.abs(closingQty)) / 2
        const avgTurnover = avgInv !== 0 ? outbound / avgInv : 0
        cards.push(
          { label: 'Items', value: skuCount.toLocaleString(), color: 'text-blue-400' },
          { label: 'SKUs', value: skuCount.toLocaleString(), color: 'text-blue-400' },
          { label: 'Opening Qty', value: formatNumber(openingQty), color: 'text-cyan-400' },
          { label: 'Opening Value', value: formatNumber(openingCost), color: 'text-cyan-400' },
          { label: 'Closing Qty', value: formatNumber(closingQty), color: 'text-emerald-400' },
          { label: 'Closing Value', value: formatNumber(closingCost), color: 'text-amber-400' },
          {
            label: 'Net Movement',
            value: formatNumber(closingCost - openingCost),
            color: closingCost - openingCost >= 0 ? 'text-green-400' : 'text-red-400',
          },
          { label: 'Turnover Ratio', value: avgTurnover.toFixed(2), color: 'text-purple-400' },
          {
            label: 'Slow Moving (Period)',
            value: slowMovingPeriod.toLocaleString(),
            color: slowMovingPeriod > 0 ? 'text-orange-400' : 'text-zinc-400',
          },
          {
            label: 'Slow Moving (90d+)',
            value: slowMovingAbsolute.toLocaleString(),
            color: slowMovingAbsolute > 0 ? 'text-red-400' : 'text-zinc-400',
          }
        )
      } else if (subType === 'sales_by_item' || subType === 'purchases_by_item') {
        const totalKey = subType === 'sales_by_item' ? 'total_sales' : 'total_cost'
        const total = data.reduce((s, r) => s + (Number(r[totalKey]) || 0), 0)
        const totalQty = data.reduce((s, r) => s + (Number(r.total_quantity) || 0), 0)
        cards.push(
          { label: 'Items', value: data.length.toLocaleString(), color: 'text-blue-400' },
          { label: 'Total Qty', value: formatNumber(totalQty), color: 'text-purple-400' },
          {
            label: subType === 'sales_by_item' ? 'Total Sales' : 'Total Cost',
            value: formatNumber(total),
            color: 'text-emerald-400',
          }
        )
      } else if (subType === 'aged_receivables' || subType === 'aged_payables') {
        const total = data.reduce((s, r) => s + (Number(r.amount) || 0), 0)
        const overdue = data.filter((r) => (Number(r.days_past_due) || 0) > 0)
        const over90 = data.filter((r) => (Number(r.days_past_due) || 0) > 90)
        cards.push(
          { label: 'Total Invoices', value: data.length.toLocaleString(), color: 'text-blue-400' },
          { label: 'Total Amount', value: formatNumber(total), color: 'text-amber-400' },
          { label: 'Overdue', value: overdue.length.toLocaleString(), color: 'text-orange-400' },
          { label: 'Over 90 Days', value: over90.length.toLocaleString(), color: 'text-red-400' }
        )
      }
    } else if (queryType === 'metric') {
      if (data[0]?.value !== undefined) {
        cards.push({
          label: formatLabel(subType),
          value: formatNumber(Number(data[0].value) || 0),
          color: 'text-emerald-400',
        })
      }
    } else if (queryType === 'entity') {
      cards.push({
        label: `${formatLabel(subType)}s`,
        value: data.length.toLocaleString(),
        color: 'text-blue-400',
      })
    } else if (queryType === 'calculator') {
      const row = data[0] || {}
      const currentAssets = Number(row.current_assets) || 0
      const quickAssets = Number(row.quick_assets) || 0
      const currentLiabilities = Number(row.current_liabilities) || 0
      const totalLiabilities = Number(row.total_liabilities) || 0
      const totalEquity = Number(row.total_equity) || 0
      const workingCapital = currentAssets - currentLiabilities
      const currentRatio = currentLiabilities !== 0 ? currentAssets / currentLiabilities : 0
      const quickRatio = currentLiabilities !== 0 ? quickAssets / currentLiabilities : 0
      const debtToEquity = totalEquity !== 0 ? totalLiabilities / totalEquity : 0

      // Raw values
      cards.push(
        { label: 'Current Assets', value: formatNumber(currentAssets), color: 'text-emerald-400' },
        { label: 'Quick Assets', value: formatNumber(quickAssets), color: 'text-cyan-400' },
        {
          label: 'Current Liabilities',
          value: formatNumber(currentLiabilities),
          color: 'text-red-400',
        },
        {
          label: 'Total Liabilities',
          value: formatNumber(totalLiabilities),
          color: 'text-red-400',
        },
        { label: 'Total Equity', value: formatNumber(totalEquity), color: 'text-blue-400' }
      )
      // Ratios
      cards.push(
        {
          label: 'Current Ratio',
          value: currentRatio.toFixed(4),
          color: currentRatio >= 1 ? 'text-emerald-400' : 'text-red-400',
        },
        {
          label: 'Quick Ratio',
          value: quickRatio.toFixed(4),
          color: quickRatio >= 1 ? 'text-emerald-400' : 'text-red-400',
        },
        {
          label: 'Debt to Equity',
          value: debtToEquity.toFixed(4),
          color: debtToEquity <= 2 ? 'text-emerald-400' : 'text-red-400',
        },
        {
          label: 'Working Capital',
          value: formatNumber(workingCapital),
          color: workingCapital >= 0 ? 'text-emerald-400' : 'text-red-400',
        }
      )
    }

    return cards
  }, [data, queryType, subType])

  if (kpis.length === 0) return null

  const cols =
    kpis.length <= 3
      ? 'md:grid-cols-3'
      : kpis.length <= 4
        ? 'md:grid-cols-4'
        : kpis.length <= 5
          ? 'md:grid-cols-5'
          : 'md:grid-cols-3 lg:grid-cols-5'
  return (
    <div className={`grid grid-cols-2 ${cols} gap-3`}>
      {kpis.map((kpi) => (
        <div key={kpi.label} className="p-3.5 bg-white/[0.03] rounded-lg border border-white/10">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">{kpi.label}</p>
          <p className={`text-lg font-mono mt-1 font-semibold ${kpi.color}`}>{kpi.value}</p>
        </div>
      ))}
    </div>
  )
}

// ── Charts ───────────────────────────────────────────────────────────────────

function ChartView({
  data,
  queryType,
  subType,
}: {
  data: Record<string, unknown>[]
  queryType: string
  subType: string
}) {
  // Report charts
  if (queryType === 'report') {
    if (subType === 'trial_balance') {
      const top = [...data]
        .sort((a, b) => Math.abs(Number(b.net_balance) || 0) - Math.abs(Number(a.net_balance) || 0))
        .slice(0, 15)
      return (
        <HBarChart
          data={top}
          nameKey="account_no"
          valueKey="net_balance"
          title="Top Accounts by Net Balance"
        />
      )
    }
    if (subType === 'profit_loss') {
      const revenue = data
        .filter((r) => String(r.account_category) === 'Income')
        .reduce((s, r) => s + Math.abs(Number(r.gl_amount) || 0), 0)
      const cogs = data
        .filter((r) => String(r.account_category) === 'Cost of Goods Sold')
        .reduce((s, r) => s + Math.abs(Number(r.gl_amount) || 0), 0)
      const expenses = data
        .filter((r) => String(r.account_category) === 'Expense')
        .reduce((s, r) => s + Math.abs(Number(r.gl_amount) || 0), 0)
      const barOption = {
        backgroundColor: 'transparent',
        tooltip: { ...DARK_TOOLTIP, formatter: (p: any) => `${p.name}: ${formatNumber(p.value)}` },
        grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
        xAxis: {
          type: 'category' as const,
          data: ['Revenue', 'COGS', 'Gross Profit', 'Expenses', 'Net Income'],
          axisLabel: { color: '#9ca3af', fontSize: 11 },
          axisLine: { lineStyle: { color: '#374151' } },
        },
        yAxis: {
          type: 'value' as const,
          axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        },
        series: [
          {
            type: 'bar',
            barMaxWidth: 60,
            data: [
              { value: revenue, itemStyle: { color: '#10b981' } },
              { value: cogs, itemStyle: { color: '#ef4444' } },
              { value: revenue - cogs, itemStyle: { color: '#3b82f6' } },
              { value: expenses, itemStyle: { color: '#f59e0b' } },
              {
                value: revenue - cogs - expenses,
                itemStyle: { color: revenue - cogs - expenses >= 0 ? '#10b981' : '#ef4444' },
              },
            ],
            label: {
              show: true,
              position: 'top' as const,
              color: '#9ca3af',
              fontSize: 10,
              formatter: (p: any) => formatCompact(p.value),
            },
          },
        ],
      }
      return (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Profit & Loss Breakdown</h3>
          <ReactECharts option={barOption} style={{ height: 320 }} opts={{ renderer: 'canvas' }} />
        </div>
      )
    }
    if (subType === 'monthly_pnl_trend') {
      // Group by month and category
      const months = [...new Set(data.map((r) => String(r.month || '').substring(0, 7)))].sort()
      const byMonth: Record<string, Record<string, number>> = {}
      for (const row of data) {
        const m = String(row.month || '').substring(0, 7)
        const cat = String(row.account_category || '')
        if (!byMonth[m]) byMonth[m] = {}
        byMonth[m][cat] = (byMonth[m][cat] || 0) + Math.abs(Number(row.gl_amount) || 0)
      }
      const trendOption = {
        backgroundColor: 'transparent',
        tooltip: { ...DARK_TOOLTIP, trigger: 'axis' as const },
        legend: {
          bottom: 0,
          left: 'center',
          orient: 'horizontal' as const,
          textStyle: { color: '#9ca3af', fontSize: 11 },
          icon: 'circle',
        },
        grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
        xAxis: {
          type: 'category' as const,
          data: months,
          axisLabel: { color: '#9ca3af', fontSize: 11 },
          axisLine: { lineStyle: { color: '#374151' } },
        },
        yAxis: {
          type: 'value' as const,
          axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        },
        series: [
          {
            name: 'Revenue',
            type: 'bar',
            stack: 'pnl',
            data: months.map((m) => byMonth[m]?.['Income'] || 0),
            itemStyle: { color: '#10b981' },
            barMaxWidth: 40,
          },
          {
            name: 'COGS',
            type: 'bar',
            stack: 'costs',
            data: months.map((m) => byMonth[m]?.['Cost of Goods Sold'] || 0),
            itemStyle: { color: '#ef4444' },
            barMaxWidth: 40,
          },
          {
            name: 'Expenses',
            type: 'bar',
            stack: 'costs',
            data: months.map((m) => byMonth[m]?.['Expense'] || 0),
            itemStyle: { color: '#f59e0b' },
            barMaxWidth: 40,
          },
          {
            name: 'Net Income',
            type: 'line',
            data: months.map(
              (m) =>
                (byMonth[m]?.['Income'] || 0) -
                (byMonth[m]?.['Cost of Goods Sold'] || 0) -
                (byMonth[m]?.['Expense'] || 0)
            ),
            itemStyle: { color: '#8b5cf6' },
            lineStyle: { width: 2 },
            smooth: true,
          },
        ],
      }
      return (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Monthly P&L Trend</h3>
          <ReactECharts
            option={trendOption}
            style={{ height: 350 }}
            opts={{ renderer: 'canvas' }}
          />
        </div>
      )
    }
    if (subType === 'balance_sheet') {
      const assets = data
        .filter((r) => String(r.account_category) === 'Assets')
        .reduce((s, r) => s + (Number(r.balance) || 0), 0)
      const liabilities = data
        .filter((r) => String(r.account_category) === 'Liabilities')
        .reduce((s, r) => s + Math.abs(Number(r.balance) || 0), 0)
      const equity = data
        .filter((r) => String(r.account_category) === 'Equity')
        .reduce((s, r) => s + Math.abs(Number(r.balance) || 0), 0)
      const barOption = {
        backgroundColor: 'transparent',
        tooltip: { ...DARK_TOOLTIP, formatter: (p: any) => `${p.name}: ${formatNumber(p.value)}` },
        grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
        xAxis: {
          type: 'category' as const,
          data: ['Assets', 'Liabilities', 'Equity'],
          axisLabel: { color: '#9ca3af', fontSize: 11 },
          axisLine: { lineStyle: { color: '#374151' } },
        },
        yAxis: {
          type: 'value' as const,
          axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        },
        series: [
          {
            type: 'bar',
            barMaxWidth: 60,
            data: [
              { value: assets, itemStyle: { color: '#10b981' } },
              { value: liabilities, itemStyle: { color: '#ef4444' } },
              { value: equity, itemStyle: { color: '#3b82f6' } },
            ],
            label: {
              show: true,
              position: 'top' as const,
              color: '#9ca3af',
              fontSize: 10,
              formatter: (p: any) => formatCompact(p.value),
            },
          },
        ],
      }
      return (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Balance Sheet Breakdown</h3>
          <ReactECharts option={barOption} style={{ height: 320 }} opts={{ renderer: 'canvas' }} />
        </div>
      )
    }
    if (subType === 'sales_by_customer' || subType === 'purchases_by_vendor') {
      const nameKey = subType === 'sales_by_customer' ? 'customer_name' : 'vendor_name'
      const valKey = subType === 'sales_by_customer' ? 'total_sales' : 'total_spend'
      const top = [...data]
        .sort((a, b) => (Number(b[valKey]) || 0) - (Number(a[valKey]) || 0))
        .slice(0, 10)
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HBarChart
            data={top}
            nameKey={nameKey}
            valueKey={valKey}
            title={`Top ${subType === 'sales_by_customer' ? 'Customers' : 'Vendors'}`}
          />
          <PieChart data={top} nameKey={nameKey} valueKey={valKey} title="Revenue Share" />
        </div>
      )
    }
    if (subType === 'inventory_valuation') {
      const top = [...data]
        .sort((a, b) => (Number(b.closing_cost) || 0) - (Number(a.closing_cost) || 0))
        .slice(0, 10)
      const slowItems = data.filter((r) => Number(r.is_slow_moving) === 1)
      const topSlow = [...slowItems]
        .sort((a, b) => (Number(b.closing_cost) || 0) - (Number(a.closing_cost) || 0))
        .slice(0, 10)
      return (
        <div className="space-y-4">
          <HBarChart
            data={top}
            nameKey="item_no"
            valueKey="closing_cost"
            title="Top Items by Closing Value"
            color="#f59e0b"
          />
          {topSlow.length > 0 && (
            <HBarChart
              data={topSlow}
              nameKey="item_no"
              valueKey="closing_cost"
              title={`Slow Moving Items (${slowItems.length} total)`}
              color="#f97316"
            />
          )}
        </div>
      )
    }
    if (subType === 'sales_by_item' || subType === 'purchases_by_item') {
      const valKey = subType === 'sales_by_item' ? 'total_sales' : 'total_cost'
      const top = [...data]
        .sort((a, b) => (Number(b[valKey]) || 0) - (Number(a[valKey]) || 0))
        .slice(0, 10)
      return (
        <HBarChart
          data={top}
          nameKey="item_no"
          valueKey={valKey}
          title={`Top Items by ${subType === 'sales_by_item' ? 'Sales' : 'Cost'}`}
        />
      )
    }
    if (subType === 'aged_receivables' || subType === 'aged_payables') {
      // Group into aging buckets
      const buckets = {
        Current: 0,
        '1-30 Days': 0,
        '31-60 Days': 0,
        '61-90 Days': 0,
        'Over 90 Days': 0,
      }
      for (const row of data) {
        const days = Number(row.days_past_due) || 0
        const amt = Number(row.amount) || 0
        if (days <= 0) buckets['Current'] += amt
        else if (days <= 30) buckets['1-30 Days'] += amt
        else if (days <= 60) buckets['31-60 Days'] += amt
        else if (days <= 90) buckets['61-90 Days'] += amt
        else buckets['Over 90 Days'] += amt
      }
      const colors = ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444']
      const barOption = {
        backgroundColor: 'transparent',
        tooltip: { ...DARK_TOOLTIP, formatter: (p: any) => `${p.name}: ${formatNumber(p.value)}` },
        grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
        xAxis: {
          type: 'category' as const,
          data: Object.keys(buckets),
          axisLabel: { color: '#9ca3af', fontSize: 11 },
          axisLine: { lineStyle: { color: '#374151' } },
        },
        yAxis: {
          type: 'value' as const,
          axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        },
        series: [
          {
            type: 'bar',
            barMaxWidth: 60,
            data: Object.values(buckets).map((v, i) => ({
              value: v,
              itemStyle: { color: colors[i] },
            })),
            label: {
              show: true,
              position: 'top' as const,
              color: '#9ca3af',
              fontSize: 10,
              formatter: (p: any) => formatCompact(p.value),
            },
          },
        ],
      }
      return (
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Aging Buckets</h3>
          <ReactECharts option={barOption} style={{ height: 320 }} opts={{ renderer: 'canvas' }} />
        </div>
      )
    }
  }

  // Analyze charts — trend lines
  if (queryType === 'analyze' && subType.startsWith('trends')) {
    const hasMonth = data[0]?.month !== undefined
    if (!hasMonth) return null
    const months = data.map((r) => String(r.month || '').substring(0, 7))
    const numericKeys = Object.keys(data[0]).filter(
      (k) => k !== 'month' && typeof data[0][k] === 'number'
    )
    const lineColors = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6']
    const trendOption = {
      backgroundColor: 'transparent',
      tooltip: { ...DARK_TOOLTIP, trigger: 'axis' as const },
      legend: {
        bottom: 0,
        left: 'center',
        orient: 'horizontal' as const,
        textStyle: { color: '#9ca3af', fontSize: 11 },
        icon: 'circle',
      },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: months,
        axisLabel: { color: '#9ca3af', fontSize: 11 },
        axisLine: { lineStyle: { color: '#374151' } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series: numericKeys.map((key, i) => ({
        name: formatLabel(key),
        type: 'line' as const,
        data: data.map((r) => Number(r[key]) || 0),
        itemStyle: { color: lineColors[i % lineColors.length] },
        smooth: true,
      })),
    }
    return (
      <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Trend Analysis</h3>
        <ReactECharts option={trendOption} style={{ height: 350 }} opts={{ renderer: 'canvas' }} />
      </div>
    )
  }

  // Analyze breakdown — pie chart
  if (queryType === 'analyze' && subType.startsWith('breakdown')) {
    const valKey =
      Object.keys(data[0]).find((k) =>
        ['value', 'total_cost', 'net_amount', 'total_debits'].includes(k)
      ) || 'value'
    const nameKey =
      Object.keys(data[0]).find((k) => ['category', 'name'].includes(k)) || Object.keys(data[0])[0]
    const top = [...data]
      .sort((a, b) => Math.abs(Number(b[valKey]) || 0) - Math.abs(Number(a[valKey]) || 0))
      .slice(0, 10)
    return <PieChart data={top} nameKey={nameKey} valueKey={valKey} title="Breakdown" />
  }

  // Analyze performance — line chart
  if (queryType === 'analyze' && subType.startsWith('performance')) {
    const hasMonth = data[0]?.month !== undefined
    if (!hasMonth) return null
    const months = data.map((r) => String(r.month || '').substring(0, 7))
    const numericKeys = Object.keys(data[0]).filter(
      (k) => k !== 'month' && typeof data[0][k] === 'number'
    )
    const lineColors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6']
    const option = {
      backgroundColor: 'transparent',
      tooltip: { ...DARK_TOOLTIP, trigger: 'axis' as const },
      legend: {
        bottom: 0,
        left: 'center',
        orient: 'horizontal' as const,
        textStyle: { color: '#9ca3af', fontSize: 11 },
        icon: 'circle',
      },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: months,
        axisLabel: { color: '#9ca3af', fontSize: 11 },
        axisLine: { lineStyle: { color: '#374151' } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { color: '#9ca3af', fontSize: 11, formatter: formatCompact },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series: numericKeys.map((key, i) => ({
        name: formatLabel(key),
        type: 'line' as const,
        data: data.map((r) => Number(r[key]) || 0),
        itemStyle: { color: lineColors[i % lineColors.length] },
        smooth: true,
      })),
    }
    return (
      <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Performance</h3>
        <ReactECharts option={option} style={{ height: 350 }} opts={{ renderer: 'canvas' }} />
      </div>
    )
  }

  return null
}

// ── Reusable Chart Components ────────────────────────────────────────────────

function HBarChart({
  data,
  nameKey,
  valueKey,
  title,
  color,
}: {
  data: Record<string, unknown>[]
  nameKey: string
  valueKey: string
  title: string
  color?: string
}) {
  const items = data.slice(0, 15)
  const option = {
    backgroundColor: 'transparent',
    tooltip: { ...DARK_TOOLTIP, formatter: (p: any) => `${p.name}: ${formatNumber(p.value)}` },
    grid: { left: '3%', right: '15%', bottom: '5%', top: '5%', containLabel: true },
    xAxis: { type: 'value' as const, axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: {
      type: 'category' as const,
      data: items
        .map((i) => {
          const n = String(i[nameKey] || '')
          return n.length > 25 ? n.slice(0, 25) + '…' : n
        })
        .reverse(),
      axisLabel: { color: '#9ca3af', fontSize: 11 },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    series: [
      {
        type: 'bar',
        data: items.map((i) => Number(i[valueKey]) || 0).reverse(),
        itemStyle: { color: color || '#10b981', borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 24,
        label: {
          show: true,
          position: 'right' as const,
          color: '#9ca3af',
          fontSize: 10,
          formatter: (p: any) => formatCompact(p.value),
        },
      },
    ],
  }
  return (
    <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-3">{title}</h3>
      <ReactECharts
        option={option}
        style={{ height: Math.max(280, items.length * 28) }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  )
}

function PieChart({
  data,
  nameKey,
  valueKey,
  title,
}: {
  data: Record<string, unknown>[]
  nameKey: string
  valueKey: string
  title: string
}) {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      ...DARK_TOOLTIP,
      formatter: (p: any) => `${p.marker} ${p.name}<br/>${formatNumber(p.value)} (${p.percent}%)`,
    },
    legend: {
      bottom: 0,
      left: 'center',
      orient: 'horizontal' as const,
      textStyle: { color: '#9ca3af', fontSize: 11 },
      itemGap: 16,
      icon: 'circle',
    },
    series: [
      {
        type: 'pie',
        radius: ['30%', '55%'],
        center: ['50%', '42%'],
        data: data.slice(0, 10).map((i, idx) => ({
          name: String(i[nameKey] || ''),
          value: Math.abs(Math.round(Number(i[valueKey]) || 0)),
          itemStyle: { color: CHART_COLORS[idx % CHART_COLORS.length] },
        })),
        label: { show: false },
      },
    ],
  }
  return (
    <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-3">{title}</h3>
      <ReactECharts option={option} style={{ height: 320 }} opts={{ renderer: 'canvas' }} />
    </div>
  )
}

// ── Data Table ───────────────────────────────────────────────────────────────

function DataTableView({ data, columns }: { data: Record<string, unknown>[]; columns: string[] }) {
  if (!data.length) return null
  const cols = columns.length > 0 ? columns : Object.keys(data[0])

  return (
    <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-3">Data ({data.length} rows)</h3>
      <div className="overflow-auto max-h-[500px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
            <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
              {cols.map((col) => (
                <th key={col} className="py-2 px-3 whitespace-nowrap">
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-white/[0.02]">
                {cols.map((col) => {
                  const val = row[col]
                  const isNum = typeof val === 'number'
                  return (
                    <td
                      key={col}
                      className={cn(
                        'py-2 px-3 whitespace-nowrap font-mono text-xs',
                        isNum ? 'text-right text-zinc-200' : 'text-zinc-300'
                      )}
                    >
                      {val === null || val === undefined
                        ? '-'
                        : isNum
                          ? formatNumber(val)
                          : typeof val === 'object'
                            ? JSON.stringify(val)
                            : String(val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Inventory Related Tables ─────────────────────────────────────────────────

function InventoryRelatedTables({
  schema,
  startDate,
  endDate,
}: {
  schema: string
  startDate: string
  endDate: string
}) {
  const [tables, setTables] = useState<
    Record<
      string,
      { loading: boolean; data: Record<string, unknown>[]; columns: string[]; error?: string }
    >
  >({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const df =
    startDate && endDate
      ? `AND posting_date BETWEEN '${startDate}' AND '${endDate}'`
      : startDate
        ? `AND posting_date >= '${startDate}'`
        : endDate
          ? `AND posting_date <= '${endDate}'`
          : ''

  const INVENTORY_TABLES = useMemo(
    () => [
      {
        key: 'item_ledger_entry',
        label: 'Item Ledger Entries',
        description: 'All stock movements — purchases, sales, adjustments',
        sql: `SELECT item_no, posting_date, entry_type, document_no, description, quantity, cost_amount_actual, location_code
FROM ${schema}.item_ledger_entry
WHERE _fivetran_deleted = false ${df}
ORDER BY posting_date DESC LIMIT 200`,
      },
      {
        key: 'value_entry',
        label: 'Value Entries',
        description: 'Cost and value postings linked to item movements',
        sql: `SELECT item_no, posting_date, item_ledger_entry_type, document_no, entry_type, cost_amount_actual, cost_posted_to_g_l, invoiced_quantity, valued_quantity
FROM ${schema}.value_entry
WHERE _fivetran_deleted = false ${df}
ORDER BY posting_date DESC LIMIT 200`,
      },
      {
        key: 'item_category',
        label: 'Item Categories',
        description: 'Product categories and groupings',
        sql: `SELECT code, description, parent_category
FROM ${schema}.item_category
WHERE _fivetran_deleted = false
ORDER BY code LIMIT 200`,
      },
      {
        key: 'item_variant',
        label: 'Item Variants',
        description: 'Item variants — size, color, etc.',
        sql: `SELECT item_no, code, description
FROM ${schema}.item_variant
WHERE _fivetran_deleted = false
ORDER BY item_no, code LIMIT 200`,
      },
      {
        key: 'location',
        label: 'Locations',
        description: 'Warehouse and storage locations',
        sql: `SELECT code, name, address, city, country_region_code
FROM ${schema}.location
WHERE _fivetran_deleted = false
ORDER BY code LIMIT 200`,
      },
      {
        key: 'inventory_posting_group',
        label: 'Inventory Posting Groups',
        description: 'GL posting configuration for inventory',
        sql: `SELECT code, description
FROM ${schema}.inventory_posting_group
WHERE _fivetran_deleted = false
ORDER BY code LIMIT 200`,
      },
      {
        key: 'unit_of_measure',
        label: 'Units of Measure',
        description: 'UOM definitions',
        sql: `SELECT code, description
FROM ${schema}.unit_of_measure
WHERE _fivetran_deleted = false
ORDER BY code LIMIT 200`,
      },
    ],
    [schema, df]
  )

  const fetchTable = useCallback(async (key: string, sql: string) => {
    setTables((prev) => ({ ...prev, [key]: { loading: true, data: [], columns: [] } }))
    try {
      const response = await fetch('/api/redshift/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql }),
      })
      const result = await response.json()
      if (result.success) {
        setTables((prev) => ({
          ...prev,
          [key]: { loading: false, data: result.data, columns: result.columns },
        }))
      } else {
        setTables((prev) => ({
          ...prev,
          [key]: { loading: false, data: [], columns: [], error: result.error },
        }))
      }
    } catch (err) {
      setTables((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          data: [],
          columns: [],
          error: err instanceof Error ? err.message : 'Failed',
        },
      }))
    }
  }, [])

  const toggleTable = useCallback(
    (key: string, sql: string) => {
      setExpanded((prev) => {
        const next = { ...prev, [key]: !prev[key] }
        // Fetch if expanding and not yet loaded
        if (next[key] && !tables[key]) {
          fetchTable(key, sql)
        }
        return next
      })
    },
    [tables, fetchTable]
  )

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">
        Inventory Tables
      </h3>
      {INVENTORY_TABLES.map((t) => {
        const isOpen = expanded[t.key]
        const tableData = tables[t.key]
        return (
          <div
            key={t.key}
            className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden"
          >
            <button
              onClick={() => toggleTable(t.key, t.sql)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
            >
              <div className="text-left">
                <span className="text-sm font-medium text-zinc-200">{t.label}</span>
                <span className="text-xs text-zinc-500 ml-3">{t.description}</span>
              </div>
              <div className="flex items-center gap-2">
                {tableData && !tableData.loading && (
                  <span className="text-xs text-zinc-500">{tableData.data.length} rows</span>
                )}
                <svg
                  className={cn(
                    'w-4 h-4 text-zinc-500 transition-transform',
                    isOpen && 'rotate-180'
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-white/10 px-4 py-3">
                {tableData?.loading && (
                  <div className="flex items-center gap-2 py-4">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                    <span className="text-xs text-zinc-500">Loading...</span>
                  </div>
                )}
                {tableData?.error && <p className="text-xs text-red-400 py-2">{tableData.error}</p>}
                {tableData &&
                  !tableData.loading &&
                  !tableData.error &&
                  tableData.data.length === 0 && (
                    <p className="text-xs text-zinc-500 py-2">No data found</p>
                  )}
                {tableData && !tableData.loading && tableData.data.length > 0 && (
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-black/80 backdrop-blur">
                        <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
                          {tableData.columns.map((col) => (
                            <th key={col} className="py-2 px-3 whitespace-nowrap">
                              {col.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {tableData.data.map((row, i) => (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            {tableData.columns.map((col) => {
                              const val = row[col]
                              const isNum = typeof val === 'number'
                              return (
                                <td
                                  key={col}
                                  className={cn(
                                    'py-2 px-3 whitespace-nowrap font-mono text-xs',
                                    isNum ? 'text-right text-zinc-200' : 'text-zinc-300'
                                  )}
                                >
                                  {val === null || val === undefined
                                    ? '-'
                                    : isNum
                                      ? formatNumber(val as number)
                                      : String(val)}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Markdown View ────────────────────────────────────────────────────────────

function ResultMarkdownView({
  result,
  queryType,
  subType,
}: {
  result: QueryResult
  queryType: string
  subType: string
}) {
  const markdown = useMemo(() => {
    const data = result.data
    if (!data?.length) return '_No data_'
    const lines: string[] = []
    lines.push(`# ${formatLabel(subType)}`)
    lines.push(`\n**Rows**: ${data.length}\n`)

    const cols = result.columns.length > 0 ? result.columns : Object.keys(data[0])
    const displayCols = cols.slice(0, 8)
    lines.push('| ' + displayCols.map((c) => c.replace(/_/g, ' ')).join(' | ') + ' |')
    lines.push('| ' + displayCols.map(() => '---').join(' | ') + ' |')
    for (const row of data.slice(0, 30)) {
      lines.push(
        '| ' +
          displayCols
            .map((c) => {
              const v = row[c]
              if (v === null || v === undefined) return '-'
              if (typeof v === 'number') return formatNumber(v)
              return String(v)
            })
            .join(' | ') +
          ' |'
      )
    }
    if (data.length > 30) lines.push(`\n_... and ${data.length - 30} more rows_`)
    return lines.join('\n')
  }, [result, subType])

  return (
    <div
      className="mt-4 rounded-lg border border-blue-500/20 bg-white/[0.02] p-5
      prose prose-invert prose-sm max-w-none
      prose-table:border-collapse prose-th:border prose-th:border-white/10 prose-th:px-3 prose-th:py-2 prose-th:bg-white/[0.05] prose-th:text-left
      prose-td:border prose-td:border-white/10 prose-td:px-3 prose-td:py-1.5
      prose-headings:text-zinc-100 prose-p:text-zinc-300
      prose-strong:text-zinc-100 prose-li:text-zinc-300 prose-li:marker:text-zinc-500"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  )
}

// ── Reusable Form Components ─────────────────────────────────────────────────

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm text-zinc-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      />
    </div>
  )
}
