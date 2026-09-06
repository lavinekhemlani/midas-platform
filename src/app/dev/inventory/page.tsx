'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSession } from '@/contexts/SessionContext'
import { DataTable, Column } from '@/components/ui/DataTable'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = 'table' | 'json'
type PresetCategory = 'overview' | 'movement' | 'discovery' | 'comparison'

interface WarehouseSchema {
  schema_name: string
  source_type: string
  display_name: string
  connected_at: number
  last_synced?: number
  tables?: string[]
}

interface WarehouseConfig {
  enabled: boolean
  schemas: WarehouseSchema[]
  default_schema?: string
}

interface QueryResult {
  success: boolean
  data: Record<string, unknown>[]
  count: number
  columns: string[]
  totalCount?: number
  schema?: string
  error?: string
}

interface ConfigResult {
  success: boolean
  organizationId?: string
  organizationName?: string
  config?: WarehouseConfig
  error?: string
}

interface InventoryPreset {
  id: string
  label: string
  category: PresetCategory
  description: string
  getQuery: (schema: string, limit: number) => string
}

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<PresetCategory, { label: string; color: string }> = {
  overview: { label: 'Overview', color: 'text-emerald-400' },
  movement: { label: 'Movement', color: 'text-blue-400' },
  discovery: { label: 'Discovery', color: 'text-purple-400' },
  comparison: { label: 'Comparison', color: 'text-orange-400' },
}

// ---------------------------------------------------------------------------
// Query presets
// ---------------------------------------------------------------------------

const INVENTORY_PRESETS: InventoryPreset[] = [
  // ── Overview & Valuation ──────────────────────────────────────────────
  {
    id: 'overview',
    label: 'Inventory Overview',
    category: 'overview',
    description: 'Total items, items with stock, total value, total units, avg unit cost',
    getQuery: (s, _l) => `SELECT
  COUNT(*) AS total_items,
  COUNT(CASE WHEN COALESCE(inventory, 0) > 0 THEN 1 END) AS items_with_stock,
  COALESCE(SUM(COALESCE(inventory, 0) * COALESCE(unit_cost, 0)), 0) AS total_inventory_value,
  COALESCE(SUM(COALESCE(inventory, 0)), 0) AS total_units_on_hand,
  CASE WHEN SUM(COALESCE(inventory, 0)) > 0
    THEN COALESCE(SUM(COALESCE(inventory, 0) * COALESCE(unit_cost, 0)), 0) / SUM(COALESCE(inventory, 0))
    ELSE 0 END AS average_unit_cost
FROM ${s}.item
WHERE COALESCE(_fivetran_deleted, false) = false`,
  },
  {
    id: 'by_category',
    label: 'Inventory by Category',
    category: 'overview',
    description: 'Breakdown by item_category_code — count, units, value per category',
    getQuery: (s, l) => `SELECT
  COALESCE(item_category_code, 'Uncategorized') AS item_category_code,
  COUNT(*) AS item_count,
  COALESCE(SUM(COALESCE(inventory, 0)), 0) AS total_units,
  COALESCE(SUM(COALESCE(inventory, 0) * COALESCE(unit_cost, 0)), 0) AS total_value,
  CASE WHEN SUM(COALESCE(inventory, 0)) > 0
    THEN SUM(COALESCE(inventory, 0) * COALESCE(unit_cost, 0)) / SUM(COALESCE(inventory, 0))
    ELSE 0 END AS average_unit_cost
FROM ${s}.item
WHERE COALESCE(_fivetran_deleted, false) = false
GROUP BY COALESCE(item_category_code, 'Uncategorized')
ORDER BY total_value DESC
LIMIT ${l}`,
  },
  {
    id: 'top_items',
    label: 'Top Items by Value',
    category: 'overview',
    description: 'Highest-value items sorted by inventory × unit_cost',
    getQuery: (s, l) => `SELECT
  no AS item_no,
  COALESCE(description, '') AS description,
  COALESCE(inventory, 0) AS inventory,
  COALESCE(unit_cost, 0) AS unit_cost,
  COALESCE(inventory, 0) * COALESCE(unit_cost, 0) AS inventory_value,
  COALESCE(item_category_code, '') AS item_category_code
FROM ${s}.item
WHERE COALESCE(_fivetran_deleted, false) = false
  AND COALESCE(inventory, 0) > 0
ORDER BY COALESCE(inventory, 0) * COALESCE(unit_cost, 0) DESC
LIMIT ${l}`,
  },
  {
    id: 'valuation_detail',
    label: 'Valuation Detail',
    category: 'overview',
    description: 'All cost methods — unit_cost, standard_cost, last_direct_cost, costing_method',
    getQuery: (s, l) => `SELECT
  no AS item_no,
  COALESCE(description, '') AS description,
  COALESCE(inventory, 0) AS inventory,
  COALESCE(unit_cost, 0) AS unit_cost,
  COALESCE(standard_cost, 0) AS standard_cost,
  COALESCE(last_direct_cost, 0) AS last_direct_cost,
  COALESCE(inventory, 0) * COALESCE(unit_cost, 0) AS inventory_value,
  COALESCE(costing_method, '') AS costing_method
FROM ${s}.item
WHERE COALESCE(_fivetran_deleted, false) = false
  AND COALESCE(inventory, 0) > 0
ORDER BY COALESCE(inventory, 0) * COALESCE(unit_cost, 0) DESC
LIMIT ${l}`,
  },

  // ── Movement & Turnover ───────────────────────────────────────────────
  {
    id: 'slow_moving',
    label: 'Slow-Moving Inventory',
    category: 'movement',
    description:
      'Items with low/zero sales — turnover ratio (FLOAT), days since last sale, risk level',
    getQuery: (s, l) => `WITH period_sales AS (
  SELECT
    item_no, company_id,
    COALESCE(SUM(CASE WHEN entry_type = 'Sale' THEN ABS(quantity) ELSE 0 END), 0) AS period_sales_qty,
    COALESCE(SUM(CASE WHEN entry_type = 'Purchase' THEN quantity ELSE 0 END), 0) AS period_purchases_qty,
    COALESCE(SUM(CASE WHEN entry_type = 'Sale' THEN ABS(cost_amount_actual) ELSE 0 END), 0) AS period_sales_value
  FROM ${s}.item_ledger_entry ile
  WHERE COALESCE(_fivetran_deleted, false) = false
    AND ile.posting_date >= CURRENT_DATE - INTERVAL '12 months'
  GROUP BY item_no, company_id
),
global_last_sale AS (
  SELECT item_no, company_id, MAX(posting_date) AS last_sale_date
  FROM ${s}.item_ledger_entry
  WHERE entry_type = 'Sale'
    AND COALESCE(_fivetran_deleted, false) = false
  GROUP BY item_no, company_id
)
SELECT
  i.no AS item_no,
  COALESCE(i.description, '') AS description,
  COALESCE(i.inventory, 0) AS inventory,
  COALESCE(i.unit_cost, 0) AS unit_cost,
  COALESCE(i.inventory, 0) * COALESCE(i.unit_cost, 0) AS inventory_value,
  COALESCE(ps.period_sales_qty, 0) AS sales_qty,
  COALESCE(ps.period_purchases_qty, 0) AS purchases_qty,
  COALESCE(ps.period_sales_value, 0) AS sales_value,
  CASE
    WHEN COALESCE(i.inventory, 0) > 0 AND COALESCE(ps.period_sales_qty, 0) > 0
    THEN CAST(COALESCE(ps.period_sales_qty, 0) AS FLOAT) / NULLIF(COALESCE(i.inventory, 0), 0)
    ELSE 0
  END AS turnover_ratio,
  CASE
    WHEN gls.last_sale_date IS NULL THEN NULL
    ELSE DATEDIFF(day, gls.last_sale_date, CURRENT_DATE)
  END AS days_since_last_sale,
  CASE
    WHEN gls.last_sale_date IS NULL THEN 'No Sales'
    WHEN DATEDIFF(day, gls.last_sale_date, CURRENT_DATE) > 180 THEN 'Critical'
    WHEN DATEDIFF(day, gls.last_sale_date, CURRENT_DATE) > 90 THEN 'High'
    ELSE 'Medium'
  END AS risk_level,
  COUNT(*) OVER() AS total_matching_items,
  SUM(COALESCE(i.inventory, 0) * COALESCE(i.unit_cost, 0)) OVER() AS total_at_risk_value
FROM ${s}.item i
LEFT JOIN period_sales ps ON i.no = ps.item_no AND i.company_id = ps.company_id
LEFT JOIN global_last_sale gls ON i.no = gls.item_no AND i.company_id = gls.company_id
WHERE COALESCE(i._fivetran_deleted, false) = false
  AND COALESCE(i.inventory, 0) > 0
ORDER BY
  CASE
    WHEN COALESCE(ps.period_sales_qty, 0) = 0 THEN 0
    ELSE CAST(COALESCE(ps.period_sales_qty, 0) AS FLOAT) / NULLIF(COALESCE(i.inventory, 0), 0)
  END ASC,
  COALESCE(i.inventory, 0) * COALESCE(i.unit_cost, 0) DESC
LIMIT ${l}`,
  },
  {
    id: 'recent_movements',
    label: 'Recent Movements',
    category: 'movement',
    description: 'Latest ledger entries — entry type, qty, cost, document',
    getQuery: (s, l) => `SELECT
  ile.entry_no,
  ile.posting_date,
  COALESCE(ile.entry_type, '') AS entry_type,
  ile.item_no,
  COALESCE(i.description, '') AS description,
  COALESCE(ile.quantity, 0) AS quantity,
  COALESCE(ile.cost_amount_actual, 0) AS cost_amount_actual,
  COALESCE(ile.document_no, '') AS document_no,
  COALESCE(ile.source_type, '') AS source_type
FROM ${s}.item_ledger_entry ile
LEFT JOIN ${s}.item i
  ON ile.item_no = i.no
  AND ile.company_id = i.company_id
  AND COALESCE(i._fivetran_deleted, false) = false
WHERE COALESCE(ile._fivetran_deleted, false) = false
ORDER BY ile.posting_date DESC, ile.entry_no DESC
LIMIT ${l}`,
  },
  {
    id: 'monthly_trend',
    label: 'Monthly Movement Trend',
    category: 'movement',
    description: 'Monthly aggregation by entry type — qty, cost, count (last 12 months)',
    getQuery: (s, _l) => `SELECT
  DATE_TRUNC('month', posting_date) AS month,
  COALESCE(entry_type, 'Other') AS entry_type,
  COALESCE(SUM(quantity), 0) AS total_quantity,
  COALESCE(SUM(cost_amount_actual), 0) AS total_cost,
  COUNT(*) AS entry_count
FROM ${s}.item_ledger_entry
WHERE COALESCE(_fivetran_deleted, false) = false
  AND posting_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', posting_date), COALESCE(entry_type, 'Other')
ORDER BY month DESC, entry_type
LIMIT 200`,
  },
  {
    id: 'turnover',
    label: 'Inventory Turnover',
    category: 'movement',
    description:
      'COGS / avg inventory, turnover ratio, days inventory outstanding (last 12 months)',
    getQuery: (s, _l) => `WITH cogs_data AS (
  SELECT COALESCE(SUM(e.debit_amount - e.credit_amount), 0) AS annual_cogs
  FROM ${s}.g_l_entry e
  JOIN ${s}.g_l_account a
    ON e.g_laccount_no = a.no AND e.company_id = a.company_id
  WHERE COALESCE(e._fivetran_deleted, false) = false
    AND COALESCE(e.reversed, false) = false
    AND COALESCE(a._fivetran_deleted, false) = false
    AND a.account_type = 'Posting'
    AND a.account_category = 'Cost_x0020_of_x0020_Goods_x0020_Sold'
    AND e.posting_date >= CURRENT_DATE - INTERVAL '12 months'
),
inventory_data AS (
  SELECT COALESCE(SUM(COALESCE(inventory, 0) * COALESCE(unit_cost, 0)), 0) AS current_inventory
  FROM ${s}.item
  WHERE COALESCE(_fivetran_deleted, false) = false
)
SELECT
  cogs.annual_cogs AS cogs_annual,
  inv.current_inventory,
  inv.current_inventory AS average_inventory,
  CASE WHEN inv.current_inventory > 0 THEN CAST(cogs.annual_cogs AS FLOAT) / inv.current_inventory ELSE 0 END AS turnover_ratio,
  CASE WHEN cogs.annual_cogs > 0 THEN CAST(inv.current_inventory AS FLOAT) / cogs.annual_cogs * 365 ELSE 0 END AS days_inventory_outstanding
FROM cogs_data cogs
CROSS JOIN inventory_data inv`,
  },

  // ── Discovery (100% populated fields from item_ledger_entry) ──────────
  {
    id: 'expiring_items',
    label: 'Expiring Items',
    category: 'discovery',
    description: 'Items with expiration_date — expired or expiring within 90 days',
    getQuery: (s, l) => `SELECT
  ile.item_no,
  COALESCE(i.description, '') AS description,
  ile.lot_no,
  ile.expiration_date,
  CASE
    WHEN ile.expiration_date < CURRENT_DATE THEN 'EXPIRED'
    WHEN ile.expiration_date < CURRENT_DATE + INTERVAL '30 days' THEN 'Expires < 30d'
    WHEN ile.expiration_date < CURRENT_DATE + INTERVAL '90 days' THEN 'Expires < 90d'
    ELSE 'OK'
  END AS expiry_status,
  DATEDIFF(day, CURRENT_DATE, ile.expiration_date) AS days_until_expiry,
  COALESCE(ile.remaining_quantity, 0) AS remaining_quantity,
  COALESCE(ile.cost_amount_actual, 0) AS cost_amount_actual,
  COALESCE(ile.location_code, '') AS location_code
FROM ${s}.item_ledger_entry ile
LEFT JOIN ${s}.item i
  ON ile.item_no = i.no AND ile.company_id = i.company_id
  AND COALESCE(i._fivetran_deleted, false) = false
WHERE COALESCE(ile._fivetran_deleted, false) = false
  AND ile.expiration_date IS NOT NULL
  AND ile.expiration_date <= CURRENT_DATE + INTERVAL '90 days'
  AND COALESCE(ile.remaining_quantity, 0) > 0
ORDER BY ile.expiration_date ASC
LIMIT ${l}`,
  },
  {
    id: 'lot_tracking',
    label: 'Lot Tracking',
    category: 'discovery',
    description: 'Inventory by lot_no — quantity, value, expiration per lot',
    getQuery: (s, l) => `SELECT
  ile.lot_no,
  ile.item_no,
  COALESCE(i.description, '') AS description,
  SUM(COALESCE(ile.quantity, 0)) AS total_quantity,
  SUM(COALESCE(ile.remaining_quantity, 0)) AS remaining_quantity,
  SUM(COALESCE(ile.cost_amount_actual, 0)) AS total_cost,
  MIN(ile.posting_date) AS first_entry_date,
  MAX(ile.posting_date) AS last_entry_date,
  MAX(ile.expiration_date) AS expiration_date,
  COALESCE(ile.location_code, '') AS location_code,
  COUNT(*) AS entry_count
FROM ${s}.item_ledger_entry ile
LEFT JOIN ${s}.item i
  ON ile.item_no = i.no AND ile.company_id = i.company_id
  AND COALESCE(i._fivetran_deleted, false) = false
WHERE COALESCE(ile._fivetran_deleted, false) = false
  AND ile.lot_no IS NOT NULL AND ile.lot_no != ''
GROUP BY ile.lot_no, ile.item_no, i.description, ile.location_code
HAVING SUM(COALESCE(ile.remaining_quantity, 0)) > 0
ORDER BY remaining_quantity DESC
LIMIT ${l}`,
  },
  {
    id: 'by_location',
    label: 'Inventory by Location',
    category: 'discovery',
    description: 'Breakdown by location_code — items, quantity, value per location',
    getQuery: (s, l) => `SELECT
  COALESCE(ile.location_code, '(blank)') AS location_code,
  COUNT(DISTINCT ile.item_no) AS distinct_items,
  SUM(COALESCE(ile.remaining_quantity, 0)) AS remaining_quantity,
  SUM(COALESCE(ile.cost_amount_actual, 0)) AS total_cost,
  COUNT(*) AS entry_count,
  MIN(ile.posting_date) AS earliest_entry,
  MAX(ile.posting_date) AS latest_entry
FROM ${s}.item_ledger_entry ile
WHERE COALESCE(ile._fivetran_deleted, false) = false
GROUP BY COALESCE(ile.location_code, '(blank)')
ORDER BY total_cost DESC
LIMIT ${l}`,
  },
  {
    id: 'remaining_qty',
    label: 'Remaining Quantity',
    category: 'discovery',
    description: 'Open ledger entries with remaining_quantity > 0 — unsold/unconsumed stock',
    getQuery: (s, l) => `SELECT
  ile.item_no,
  COALESCE(i.description, '') AS description,
  COALESCE(ile.entry_type, '') AS entry_type,
  ile.posting_date,
  COALESCE(ile.quantity, 0) AS original_quantity,
  COALESCE(ile.remaining_quantity, 0) AS remaining_quantity,
  COALESCE(ile.cost_amount_actual, 0) AS cost_amount_actual,
  COALESCE(ile.lot_no, '') AS lot_no,
  COALESCE(ile.location_code, '') AS location_code,
  COALESCE(ile.document_no, '') AS document_no
FROM ${s}.item_ledger_entry ile
LEFT JOIN ${s}.item i
  ON ile.item_no = i.no AND ile.company_id = i.company_id
  AND COALESCE(i._fivetran_deleted, false) = false
WHERE COALESCE(ile._fivetran_deleted, false) = false
  AND COALESCE(ile.remaining_quantity, 0) > 0
ORDER BY COALESCE(ile.remaining_quantity, 0) DESC
LIMIT ${l}`,
  },

  // ── Agent Comparison ──────────────────────────────────────────────────
  {
    id: 'agent_valuation',
    label: 'Agent-Style Valuation',
    category: 'comparison',
    description: 'Exact SQL the agent uses — opening/closing from ledger (compare with dashboard)',
    getQuery: (s, l) => {
      const year = new Date().getFullYear()
      const startDate = `${year - 1}-01-01`
      const endDate = `${year - 1}-12-31`
      return `-- Agent default: last calendar year (${startDate} to ${endDate})
-- Dashboard default: rolling 12 months from today
WITH period_entries AS (
  SELECT
    ile.item_no,
    COALESCE(i.description, '') AS item_name,
    ile.posting_date,
    COALESCE(ile.quantity, 0) AS quantity,
    COALESCE(ile.cost_amount_actual, 0) AS cost_amount_actual
  FROM ${s}.item_ledger_entry ile
  LEFT JOIN ${s}.item i
    ON ile.item_no = i.no AND ile.company_id = i.company_id
    AND COALESCE(i._fivetran_deleted, false) = false
  WHERE COALESCE(ile._fivetran_deleted, false) = false
),
item_summary AS (
  SELECT
    item_no, item_name,
    SUM(CASE WHEN posting_date < '${startDate}' THEN quantity ELSE 0 END) AS opening_qty,
    SUM(CASE WHEN posting_date < '${startDate}' THEN cost_amount_actual ELSE 0 END) AS opening_value,
    SUM(CASE WHEN posting_date >= '${startDate}' AND posting_date <= '${endDate}' AND quantity > 0 THEN quantity ELSE 0 END) AS increase_qty,
    SUM(CASE WHEN posting_date >= '${startDate}' AND posting_date <= '${endDate}' AND cost_amount_actual > 0 THEN cost_amount_actual ELSE 0 END) AS increase_value,
    SUM(CASE WHEN posting_date >= '${startDate}' AND posting_date <= '${endDate}' AND quantity < 0 THEN ABS(quantity) ELSE 0 END) AS decrease_qty,
    SUM(CASE WHEN posting_date >= '${startDate}' AND posting_date <= '${endDate}' AND cost_amount_actual < 0 THEN ABS(cost_amount_actual) ELSE 0 END) AS decrease_value,
    SUM(CASE WHEN posting_date <= '${endDate}' THEN quantity ELSE 0 END) AS closing_qty,
    SUM(CASE WHEN posting_date <= '${endDate}' THEN cost_amount_actual ELSE 0 END) AS closing_value
  FROM period_entries
  GROUP BY item_no, item_name
  HAVING SUM(CASE WHEN posting_date >= '${startDate}' AND posting_date <= '${endDate}' THEN ABS(quantity) ELSE 0 END) > 0
)
SELECT
  item_no, item_name,
  opening_qty, opening_value,
  increase_qty, increase_value,
  decrease_qty, decrease_value,
  closing_qty, closing_value,
  SUM(opening_value) OVER () AS grand_opening_value,
  SUM(closing_value) OVER () AS grand_closing_value,
  COUNT(*) OVER () AS total_item_count
FROM item_summary
ORDER BY closing_value DESC
LIMIT ${l}`
    },
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InventoryDevPage() {
  const { status: sessionStatus } = useSession()

  // Config state
  const [warehouseConfig, setWarehouseConfig] = useState<ConfigResult | null>(null)
  const [configLoading, setConfigLoading] = useState(true)

  // Schema
  const [selectedSchema, setSelectedSchema] = useState<string>('')

  // Query state
  const [selectedPreset, setSelectedPreset] = useState<string>('overview')
  const [categoryFilter, setCategoryFilter] = useState<PresetCategory | null>(null)
  const [queryLimit, setQueryLimit] = useState(100)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [lastQueryTime, setLastQueryTime] = useState<number | null>(null)

  // Custom SQL
  const [customQuery, setCustomQuery] = useState('')

  // Load config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch('/api/redshift/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_warehouse_config' }),
        })
        const data: ConfigResult = await response.json()
        setWarehouseConfig(data)
        if (data.success && data.config?.schemas?.length) {
          setSelectedSchema(data.config.default_schema || data.config.schemas[0].schema_name)
        }
      } catch (err) {
        setWarehouseConfig({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to load warehouse config',
        })
      } finally {
        setConfigLoading(false)
      }
    }
    if (sessionStatus === 'authenticated') {
      loadConfig()
    }
  }, [sessionStatus])

  // Current preset
  const currentPreset = useMemo(
    () => INVENTORY_PRESETS.find((p) => p.id === selectedPreset) || INVENTORY_PRESETS[0],
    [selectedPreset]
  )

  // Generated SQL preview
  const generatedSQL = useMemo(() => {
    if (!selectedSchema) return ''
    return currentPreset.getQuery(selectedSchema, queryLimit)
  }, [currentPreset, selectedSchema, queryLimit])

  // Filtered presets
  const filteredPresets = categoryFilter
    ? INVENTORY_PRESETS.filter((p) => p.category === categoryFilter)
    : INVENTORY_PRESETS

  // Dynamic table columns
  const tableColumns = useMemo((): Column<Record<string, unknown>>[] => {
    if (!result?.data?.length) return []
    return Object.keys(result.data[0]).map((key) => ({
      key: key as keyof Record<string, unknown>,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      sortable: true,
      format: (value: unknown) => {
        if (value === null || value === undefined) return '-'
        if (typeof value === 'number') {
          if (Number.isInteger(value)) return value.toLocaleString()
          return value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        }
        if (typeof value === 'object') return JSON.stringify(value)
        return String(value)
      },
    }))
  }, [result?.data])

  // Schema source info
  const currentSchemaConfig = warehouseConfig?.config?.schemas?.find(
    (s) => s.schema_name === selectedSchema
  )

  // Run preset query
  const runQuery = useCallback(
    async (sql?: string) => {
      const queryToRun = sql || generatedSQL
      if (!queryToRun.trim()) {
        setError('No query to execute')
        return
      }

      setIsLoading(true)
      setError(null)
      const startTime = Date.now()

      try {
        const response = await fetch('/api/redshift/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: queryToRun }),
        })

        const elapsed = Date.now() - startTime
        const data = await response.json()
        setLastQueryTime(elapsed)

        if (!data.success) {
          setError(data.error || 'Query failed')
          setResult(null)
        } else {
          setResult(data)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to execute query')
        setResult(null)
      } finally {
        setIsLoading(false)
      }
    },
    [generatedSQL]
  )

  // Run custom SQL
  const runCustomQuery = useCallback(async () => {
    if (!customQuery.trim()) {
      setError('Please enter a query')
      return
    }
    await runQuery(customQuery)
  }, [customQuery, runQuery])

  // ── Auth / loading guards ───────────────────────────────────────────
  if (sessionStatus === 'loading' || configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="theme-text-secondary">Loading inventory configuration...</p>
        </div>
      </div>
    )
  }

  if (sessionStatus !== 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-luxury-card p-8 text-center">
          <h2 className="text-xl font-semibold theme-text-primary mb-2">Authentication Required</h2>
          <p className="theme-text-secondary">Please sign in to access the inventory explorer.</p>
        </div>
      </div>
    )
  }

  if (!warehouseConfig?.success || !warehouseConfig?.config?.enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-luxury-card p-8 text-center max-w-md">
          <h2 className="text-xl font-semibold theme-text-primary mb-2">
            Warehouse Not Configured
          </h2>
          <p className="theme-text-secondary mb-4">
            {warehouseConfig?.error ||
              'Your organization does not have warehouse access configured yet.'}
          </p>
        </div>
      </div>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--theme-bg)' }}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass-luxury-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold theme-text-primary">Inventory Explorer</h1>
              <p className="theme-text-secondary mt-1">
                {warehouseConfig.organizationName || 'Organization'} — Run inventory queries against
                Redshift
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-sm font-medium">
                {INVENTORY_PRESETS.length} Queries
              </div>
              <div className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-500 text-sm font-medium">
                DEV
              </div>
            </div>
          </div>
        </div>

        {/* Schema Selector */}
        <div className="glass-luxury-card p-6">
          <h2 className="text-lg font-medium theme-text-primary mb-4">Data Source</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {warehouseConfig.config.schemas.map((schema) => {
              const isSelected = selectedSchema === schema.schema_name
              return (
                <button
                  key={schema.schema_name}
                  onClick={() => setSelectedSchema(schema.schema_name)}
                  className={cn(
                    'p-4 rounded-lg border text-left transition-all',
                    isSelected
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-400">
                      {schema.source_type}
                    </span>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-purple-500" />}
                  </div>
                  <p className="font-medium theme-text-primary">{schema.display_name}</p>
                  <p className="text-xs font-mono theme-text-secondary mt-1">
                    {schema.schema_name}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Query Selector */}
        <div className="glass-luxury-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium theme-text-primary">Select Query</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setCategoryFilter(null)}
                className={cn(
                  'px-3 py-1 text-sm rounded-lg transition-colors',
                  !categoryFilter
                    ? 'bg-purple-600 text-white'
                    : 'border border-white/10 theme-text-secondary hover:bg-white/5'
                )}
              >
                All
              </button>
              {Object.entries(CATEGORY_CONFIG).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() =>
                    setCategoryFilter(categoryFilter === key ? null : (key as PresetCategory))
                  }
                  className={cn(
                    'px-3 py-1 text-sm rounded-lg transition-colors',
                    categoryFilter === key
                      ? 'bg-purple-600 text-white'
                      : 'border border-white/10 theme-text-secondary hover:bg-white/5'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            {filteredPresets.map((preset) => {
              const catInfo = CATEGORY_CONFIG[preset.category]
              const isSelected = selectedPreset === preset.id
              return (
                <label
                  key={preset.id}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all',
                    isSelected
                      ? 'bg-purple-500/10 border border-purple-500/30'
                      : 'bg-white/5 border border-transparent hover:bg-white/10'
                  )}
                >
                  <input
                    type="radio"
                    name="inventory-preset"
                    value={preset.id}
                    checked={isSelected}
                    onChange={() => setSelectedPreset(preset.id)}
                    className="mt-1 accent-purple-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('font-medium theme-text-primary text-sm')}>
                        {preset.label}
                      </span>
                      <span className={cn('text-[10px] uppercase tracking-wider', catInfo.color)}>
                        {catInfo.label}
                      </span>
                    </div>
                    <p className="text-xs theme-text-secondary mt-0.5">{preset.description}</p>
                  </div>
                </label>
              )
            })}
          </div>

          {/* Run controls */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10">
            <div className="w-28">
              <label className="block text-xs theme-text-secondary mb-1">Limit</label>
              <input
                type="number"
                value={queryLimit}
                onChange={(e) => setQueryLimit(Math.max(1, parseInt(e.target.value) || 100))}
                min={1}
                max={1000}
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 theme-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
            <button
              onClick={() => runQuery()}
              disabled={isLoading || !selectedSchema}
              className={cn(
                'px-6 py-2 rounded-lg font-medium transition-all mt-4',
                'bg-purple-600 hover:bg-purple-700 text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isLoading ? 'Running...' : 'Run Query'}
            </button>
          </div>
        </div>

        {/* SQL Preview */}
        {generatedSQL && (
          <div className="glass-luxury-card p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium theme-text-primary">Generated SQL</h2>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedSQL)
                }}
                className="px-3 py-1 text-xs rounded-lg border border-white/10 hover:bg-white/5 theme-text-secondary transition-colors"
              >
                Copy
              </button>
            </div>
            <pre className="p-4 rounded-lg bg-black/20 overflow-x-auto text-xs font-mono theme-text-primary max-h-[300px] overflow-y-auto whitespace-pre-wrap">
              {generatedSQL}
            </pre>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="glass-luxury-card p-4 border-l-4 border-red-500 bg-red-500/10">
            <p className="text-red-400 font-medium">Error</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && result.success && (
          <div className="glass-luxury-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-medium theme-text-primary">
                  Results ({result.count} rows
                  {result.totalCount ? ` of ${result.totalCount.toLocaleString()}` : ''})
                </h2>
                {lastQueryTime !== null && (
                  <p className="text-sm theme-text-secondary">
                    Executed in {(lastQueryTime / 1000).toFixed(1)}s
                    {result.schema && ` — ${result.schema}`}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    viewMode === 'table'
                      ? 'bg-purple-600 text-white'
                      : 'border border-white/10 theme-text-secondary hover:bg-white/5'
                  )}
                >
                  Table
                </button>
                <button
                  onClick={() => setViewMode('json')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    viewMode === 'json'
                      ? 'bg-purple-600 text-white'
                      : 'border border-white/10 theme-text-secondary hover:bg-white/5'
                  )}
                >
                  JSON
                </button>
              </div>
            </div>

            {viewMode === 'table' ? (
              <div className="overflow-hidden rounded-lg border border-white/10">
                <DataTable
                  data={result.data}
                  columns={tableColumns}
                  paginate
                  rowsPerPage={25}
                  emptyMessage="No data returned"
                />
              </div>
            ) : (
              <pre className="p-4 rounded-lg bg-black/20 overflow-x-auto text-sm font-mono theme-text-primary max-h-[600px] overflow-y-auto">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Custom SQL */}
        <div className="glass-luxury-card p-6">
          <h2 className="text-lg font-medium theme-text-primary mb-4">Custom SQL</h2>
          <textarea
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder={`SELECT * FROM ${selectedSchema || 'schema'}.item WHERE ...`}
            rows={5}
            className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 theme-text-primary placeholder:text-white/30 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y"
          />
          <div className="flex justify-between items-center mt-4">
            <p className="text-sm theme-text-secondary">
              Only SELECT queries allowed. Results limited to 1000 rows.
            </p>
            <button
              onClick={runCustomQuery}
              disabled={isLoading || !customQuery.trim()}
              className={cn(
                'px-6 py-2 rounded-lg font-medium transition-all',
                'bg-emerald-600 hover:bg-emerald-700 text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isLoading ? 'Running...' : 'Execute'}
            </button>
          </div>
        </div>

        {/* Connection Info */}
        <div className="glass-luxury-card p-6">
          <h2 className="text-lg font-medium theme-text-primary mb-4">Connection Info</h2>
          <div className="grid gap-2 text-sm font-mono">
            <div className="flex gap-4">
              <span className="theme-text-secondary w-28">Organization:</span>
              <span className="theme-text-primary">{warehouseConfig.organizationName}</span>
            </div>
            <div className="flex gap-4">
              <span className="theme-text-secondary w-28">Warehouse:</span>
              <span className="theme-text-primary">Redshift Serverless</span>
            </div>
            <div className="flex gap-4">
              <span className="theme-text-secondary w-28">Schema:</span>
              <span className="theme-text-primary">{selectedSchema || 'None'}</span>
            </div>
            <div className="flex gap-4">
              <span className="theme-text-secondary w-28">Source:</span>
              <span className="theme-text-primary">
                {currentSchemaConfig?.source_type || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
