'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
// import { useSession } from '@/contexts/SessionContext' // Now provided by shared layout
import { useWarehouseDev } from './_shared/WarehouseDevLayout'
import { DataTable, Column } from '@/components/ui/DataTable'
import { cn } from '@/lib/utils'

type ViewMode = 'table' | 'json'

// WarehouseSchema and WarehouseConfig now come from shared layout
// interface WarehouseSchema {
//   schema_name: string
//   source_type: string
//   display_name: string
//   connected_at: number
//   last_synced?: number
//   tables?: string[]
// }

// interface WarehouseConfig {
//   enabled: boolean
//   schemas: WarehouseSchema[]
//   default_schema?: string
// }

interface QueryResult {
  success: boolean
  data: Record<string, unknown>[]
  count: number
  columns: string[]
  totalCount?: number
  schema?: string
  error?: string
}

// ConfigResult now comes from shared layout (WarehouseConfigResult)
// interface ConfigResult {
//   success: boolean
//   organizationId?: string
//   organizationName?: string
//   config?: WarehouseConfig
//   error?: string
// }

interface QueryPreset {
  label: string
  category: 'financial' | 'sales' | 'purchasing' | 'inventory' | 'data_quality'
  description: string
  getQuery: (schema: string) => string
}

// BC financial query presets
const QUERY_PRESETS: QueryPreset[] = [
  {
    label: 'Trial Balance',
    category: 'financial',
    description: 'Account totals - debits, credits, net balance',
    getQuery: (s) =>
      `SELECT g_laccount_no, g_laccount_name, SUM(debit_amount) AS total_debits, SUM(credit_amount) AS total_credits, SUM(amount) AS net_balance FROM ${s}.g_l_entry WHERE _fivetran_deleted = false AND reversed = false GROUP BY g_laccount_no, g_laccount_name ORDER BY g_laccount_no`,
  },
  {
    label: 'Monthly P&L',
    category: 'financial',
    description: 'Monthly debits, credits and net amounts',
    getQuery: (s) =>
      `SELECT DATE_TRUNC('month', posting_date) AS month, SUM(debit_amount) AS total_debits, SUM(credit_amount) AS total_credits, SUM(amount) AS net_amount FROM ${s}.g_l_entry WHERE _fivetran_deleted = false AND reversed = false GROUP BY DATE_TRUNC('month', posting_date) ORDER BY month DESC`,
  },
  {
    label: 'By Document Type',
    category: 'financial',
    description: 'Transaction counts and totals by document type',
    getQuery: (s) =>
      `SELECT document_type, COUNT(*) AS transaction_count, SUM(debit_amount) AS total_debits, SUM(credit_amount) AS total_credits FROM ${s}.g_l_entry WHERE _fivetran_deleted = false AND reversed = false GROUP BY document_type ORDER BY transaction_count DESC`,
  },
  {
    label: 'Recent Transactions',
    category: 'financial',
    description: 'Latest 100 GL entries',
    getQuery: (s) =>
      `SELECT posting_date, document_no, document_type, g_laccount_no, g_laccount_name, description, debit_amount, credit_amount, amount, reversed FROM ${s}.g_l_entry WHERE _fivetran_deleted = false AND reversed = false ORDER BY posting_date DESC, entry_no DESC LIMIT 100`,
  },
  {
    label: 'By Department',
    category: 'financial',
    description: 'Totals by Global Dimension 1 (department/cost center)',
    getQuery: (s) =>
      `SELECT global_dimension_1_code AS department, SUM(debit_amount) AS total_debits, SUM(credit_amount) AS total_credits, SUM(amount) AS net_amount, COUNT(*) AS entries FROM ${s}.g_l_entry WHERE _fivetran_deleted = false AND reversed = false AND global_dimension_1_code IS NOT NULL AND global_dimension_1_code != '' GROUP BY global_dimension_1_code ORDER BY net_amount DESC`,
  },
  {
    label: 'Top Customers',
    category: 'sales',
    description: 'Revenue by customer from sales invoices',
    getQuery: (s) =>
      `SELECT h.sell_to_customer_no, h.sell_to_customer_name, COUNT(*) AS invoice_count, SUM(l.amount) AS total_revenue FROM ${s}.sales_invoice_header h JOIN ${s}.sales_invoice_line l ON h.no = l.document_no AND h.company_id = l.company_id WHERE h._fivetran_deleted = false AND l._fivetran_deleted = false GROUP BY h.sell_to_customer_no, h.sell_to_customer_name ORDER BY total_revenue DESC LIMIT 50`,
  },
  {
    label: 'Monthly Revenue',
    category: 'sales',
    description: 'Revenue trend by month from sales invoices',
    getQuery: (s) =>
      `SELECT DATE_TRUNC('month', h.posting_date) AS month, COUNT(DISTINCT h.no) AS invoice_count, SUM(l.amount) AS total_revenue FROM ${s}.sales_invoice_header h JOIN ${s}.sales_invoice_line l ON h.no = l.document_no AND h.company_id = l.company_id WHERE h._fivetran_deleted = false AND l._fivetran_deleted = false GROUP BY DATE_TRUNC('month', h.posting_date) ORDER BY month DESC`,
  },
  {
    label: 'Top Vendors',
    category: 'purchasing',
    description: 'Spend by vendor from purchase invoices',
    getQuery: (s) =>
      `SELECT h.buy_from_vendor_no, h.buy_from_vendor_name, COUNT(*) AS invoice_count, SUM(l.amount) AS total_spend FROM ${s}.purch_inv_header h JOIN ${s}.purch_inv_line l ON h.no = l.document_no AND h.company_id = l.company_id WHERE h._fivetran_deleted = false AND l._fivetran_deleted = false GROUP BY h.buy_from_vendor_no, h.buy_from_vendor_name ORDER BY total_spend DESC LIMIT 50`,
  },
  {
    label: 'Inventory Summary',
    category: 'inventory',
    description: 'Items with ledger entry counts',
    getQuery: (s) =>
      `SELECT i.no AS item_no, i.description, i.base_unit_of_measure, COUNT(ile.entry_no) AS movement_count FROM ${s}.item i LEFT JOIN ${s}.item_ledger_entry ile ON i.no = ile.item_no AND i.company_id = ile.company_id AND ile._fivetran_deleted = false WHERE i._fivetran_deleted = false GROUP BY i.no, i.description, i.base_unit_of_measure ORDER BY movement_count DESC LIMIT 100`,
  },
  {
    label: 'Data Date Range',
    category: 'data_quality',
    description: 'Earliest/latest dates and months of data',
    getQuery: (s) =>
      `SELECT MIN(posting_date) AS earliest_date, MAX(posting_date) AS latest_date, COUNT(DISTINCT DATE_TRUNC('month', posting_date)) AS months_of_data, COUNT(*) AS total_entries FROM ${s}.g_l_entry WHERE _fivetran_deleted = false AND reversed = false`,
  },
  {
    label: 'Table Row Counts',
    category: 'data_quality',
    description: 'Row counts for all key tables',
    getQuery: (s) =>
      `SELECT 'g_l_entry' AS table_name, COUNT(*) AS row_count FROM ${s}.g_l_entry WHERE _fivetran_deleted = false AND reversed = false UNION ALL SELECT 'customer', COUNT(*) FROM ${s}.customer WHERE _fivetran_deleted = false UNION ALL SELECT 'vendor', COUNT(*) FROM ${s}.vendor WHERE _fivetran_deleted = false UNION ALL SELECT 'sales_invoice_header', COUNT(*) FROM ${s}.sales_invoice_header WHERE _fivetran_deleted = false UNION ALL SELECT 'purch_inv_header', COUNT(*) FROM ${s}.purch_inv_header WHERE _fivetran_deleted = false UNION ALL SELECT 'item', COUNT(*) FROM ${s}.item WHERE _fivetran_deleted = false UNION ALL SELECT 'item_ledger_entry', COUNT(*) FROM ${s}.item_ledger_entry WHERE _fivetran_deleted = false ORDER BY row_count DESC`,
  },
  {
    label: 'Chart of Accounts',
    category: 'financial',
    description: 'Full chart of accounts structure',
    getQuery: (s) =>
      `SELECT no, name, REPLACE(REPLACE(account_type, '_x002D_', '-'), '_x0020_', ' ') AS account_type, REPLACE(REPLACE(account_category, '_x0020_', ' '), '_x002D_', '-') AS account_category, account_subcategory_descript, debit_credit, blocked FROM ${s}.g_l_account WHERE _fivetran_deleted = false ORDER BY no`,
  },
]

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  financial: { label: 'Financial', color: 'text-emerald-400' },
  sales: { label: 'Sales', color: 'text-blue-400' },
  purchasing: { label: 'Purchasing', color: 'text-orange-400' },
  inventory: { label: 'Inventory', color: 'text-purple-400' },
  data_quality: { label: 'Data Quality', color: 'text-gray-400' },
}

// Table categorization for BC
const TABLE_CATEGORIES: Record<string, string[]> = {
  'Core Financial': [
    'g_l_entry',
    'g_l_account',
    'company_information',
    'gen_journal_batch',
    'gen_journal_line',
    'posted_gen_journal_batch',
    'posted_gen_journal_line',
  ],
  'Sales & AR': [
    'customer',
    'sales_header',
    'sales_line',
    'sales_invoice_header',
    'sales_invoice_line',
    'sales_cr_memo_header',
    'sales_cr_memo_line',
    'sales_shipment_header',
    'sales_shipment_line',
  ],
  'Purchasing & AP': [
    'vendor',
    'purchase_header',
    'purchase_line',
    'purch_inv_header',
    'purch_inv_line',
    'purch_rcpt_header',
    'purch_rcpt_line',
  ],
  Inventory: [
    'item',
    'item_ledger_entry',
    'item_category',
    'item_variant',
    'item_budget_entry',
    'location',
    'inventory_posting_group',
    'unit_of_measure',
    'value_entry',
  ],
  Banking: ['bank_account'],
  Dimensions: ['dimension', 'dimension_value', 'dimension_set_entry', 'default_dimension'],
  Reference: [
    'company',
    'contact',
    'country_region',
    'currency',
    'currency_exchange_rate',
    'employee',
    'gen_product_posting_group',
    'job',
    'opportunity',
    'payment_method',
    'payment_terms',
    'reason_code',
    'shipment_method',
    'time_sheet_detail',
  ],
}

// Still needed for Connection Info section
const SOURCE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  business_central: { label: 'Business Central', color: 'text-blue-400' },
  d365: { label: 'D365 F&O', color: 'text-purple-400' },
  shopify: { label: 'Shopify', color: 'text-green-400' },
  meta_ads: { label: 'Meta Ads', color: 'text-indigo-400' },
  amazon: { label: 'Amazon', color: 'text-orange-400' },
  tally: { label: 'Tally', color: 'text-yellow-400' },
  manual: { label: 'Manual Upload', color: 'text-gray-400' },
}

export default function WarehouseDevPage() {
  // const { status: sessionStatus } = useSession() // Now provided by shared layout
  const { selectedSchema, warehouseConfig } = useWarehouseDev()

  // Warehouse config state — now from shared layout context
  // const [warehouseConfig, setWarehouseConfig] = useState<ConfigResult | null>(null)
  // const [configLoading, setConfigLoading] = useState(true)

  // Query state — selectedSchema now from shared layout context
  // const [selectedSchema, setSelectedSchema] = useState<string>('')
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [availableTables, setAvailableTables] = useState<string[]>([])
  const [tablesLoading, setTablesLoading] = useState(false)
  const [customQuery, setCustomQuery] = useState('')
  const [queryLimit, setQueryLimit] = useState(100)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [lastQueryTime, setLastQueryTime] = useState<number | null>(null)
  const [presetFilter, setPresetFilter] = useState<string | null>(null)

  // Config loading now handled by shared WarehouseDevLayout
  // useEffect(() => {
  //   async function loadConfig() { ... }
  //   if (sessionStatus === 'authenticated') { loadConfig() }
  // }, [sessionStatus])

  // Load tables when schema changes
  useEffect(() => {
    async function loadTables() {
      if (!selectedSchema) return

      console.log(`[Warehouse UI] Loading tables for schema: "${selectedSchema}"`)
      setTablesLoading(true)
      setAvailableTables([])
      setSelectedTable('')

      try {
        const response = await fetch('/api/redshift/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'list_tables', schema: selectedSchema }),
        })

        console.log(`[Warehouse UI] list_tables response status: ${response.status}`)
        const data = await response.json()
        if (data.success && data.tables) {
          console.log(`[Warehouse UI] Loaded ${data.tables.length} tables for "${selectedSchema}"`)
          setAvailableTables(data.tables)
          if (data.tables.length > 0) {
            setSelectedTable(data.tables[0])
          }
        } else {
          console.warn(`[Warehouse UI] list_tables failed:`, data.error)
        }
      } catch (err) {
        console.error('[Warehouse UI] Failed to load tables:', err)
      } finally {
        setTablesLoading(false)
      }
    }

    loadTables()
  }, [selectedSchema])

  // Categorize tables
  const categorizedTables = useMemo(() => {
    const result: Record<string, string[]> = {}
    const uncategorized: string[] = []

    for (const table of availableTables) {
      let found = false
      for (const [category, tables] of Object.entries(TABLE_CATEGORIES)) {
        if (tables.includes(table)) {
          if (!result[category]) result[category] = []
          result[category].push(table)
          found = true
          break
        }
      }
      if (!found) uncategorized.push(table)
    }

    if (uncategorized.length > 0) {
      result['Other'] = uncategorized
    }

    return result
  }, [availableTables])

  // Generate columns for DataTable from result data
  const tableColumns = useMemo((): Column<Record<string, unknown>>[] => {
    if (!result?.data?.length) return []

    return Object.keys(result.data[0]).map((key) => {
      // Check if column is numeric by sampling first row
      const sampleValue = result.data[0][key]
      const isNumeric = typeof sampleValue === 'number'

      return {
        key: key as keyof Record<string, unknown>,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        align: isNumeric ? ('right' as const) : ('left' as const),
        sortable: true,
        format: (value: unknown) => {
          if (value === null || value === undefined) return '-'
          if (typeof value === 'number') {
            // Format large numbers with commas, decimals with 2 places
            if (Number.isInteger(value)) return value.toLocaleString()
            return value.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          }
          if (typeof value === 'object') return JSON.stringify(value)
          return String(value)
        },
      }
    })
  }, [result?.data])

  // Execute table query
  const handleTableQuery = useCallback(
    async (tableOverride?: string) => {
      const table = tableOverride || selectedTable
      if (!table || !selectedSchema) {
        setError('Please select a schema and table')
        return
      }

      console.log(`[Warehouse UI] Table query: "${selectedSchema}.${table}" LIMIT ${queryLimit}`)
      setIsLoading(true)
      setError(null)
      const startTime = Date.now()

      try {
        const response = await fetch('/api/redshift/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table,
            schema: selectedSchema,
            limit: queryLimit,
          }),
        })

        const elapsed = Date.now() - startTime
        console.log(`[Warehouse UI] Table query response: status=${response.status} (${elapsed}ms)`)
        const data = await response.json()
        setLastQueryTime(elapsed)

        if (!data.success) {
          console.warn(`[Warehouse UI] Table query failed: ${data.error}`)
          setError(data.error || 'Query failed')
          setResult(null)
        } else {
          console.log(
            `[Warehouse UI] Table query success: ${data.count} rows, ${data.columns?.length} columns, totalCount=${data.totalCount}`
          )
          setResult(data)
        }
      } catch (err) {
        console.error('[Warehouse UI] Table query error:', err)
        setError(err instanceof Error ? err.message : 'Failed to execute query')
        setResult(null)
      } finally {
        setIsLoading(false)
      }
    },
    [selectedTable, selectedSchema, queryLimit]
  )

  // Execute custom SQL query
  const handleCustomQuery = async () => {
    if (!customQuery.trim()) {
      setError('Please enter a query')
      return
    }

    console.log(
      `[Warehouse UI] Custom query: "${customQuery.substring(0, 120)}${customQuery.length > 120 ? '...' : ''}"`
    )
    setIsLoading(true)
    setError(null)
    const startTime = Date.now()

    try {
      const response = await fetch('/api/redshift/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: customQuery }),
      })

      const elapsed = Date.now() - startTime
      console.log(`[Warehouse UI] Custom query response: status=${response.status} (${elapsed}ms)`)
      const data = await response.json()
      setLastQueryTime(elapsed)

      if (!data.success) {
        console.warn(`[Warehouse UI] Custom query failed: ${data.error}`)
        setError(data.error || 'Query failed')
        setResult(null)
      } else {
        console.log(
          `[Warehouse UI] Custom query success: ${data.count} rows, ${data.columns?.length} columns`
        )
        setResult(data)
      }
    } catch (err) {
      console.error('[Warehouse UI] Custom query error:', err)
      setError(err instanceof Error ? err.message : 'Failed to execute query')
      setResult(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Apply preset query
  const applyPreset = (preset: QueryPreset) => {
    setCustomQuery(preset.getQuery(selectedSchema))
  }

  // Run preset directly
  const runPreset = async (preset: QueryPreset) => {
    const q = preset.getQuery(selectedSchema)
    console.log(`[Warehouse UI] Running preset: "${preset.label}" (${preset.category})`)
    setCustomQuery(q)
    setIsLoading(true)
    setError(null)
    const startTime = Date.now()

    try {
      const response = await fetch('/api/redshift/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })

      const elapsed = Date.now() - startTime
      console.log(
        `[Warehouse UI] Preset "${preset.label}" response: status=${response.status} (${elapsed}ms)`
      )
      const data = await response.json()
      setLastQueryTime(elapsed)

      if (!data.success) {
        console.warn(`[Warehouse UI] Preset "${preset.label}" failed: ${data.error}`)
        setError(data.error || 'Query failed')
        setResult(null)
      } else {
        console.log(
          `[Warehouse UI] Preset "${preset.label}" success: ${data.count} rows, ${data.columns?.length} columns`
        )
        setResult(data)
      }
    } catch (err) {
      console.error(`[Warehouse UI] Preset "${preset.label}" error:`, err)
      setError(err instanceof Error ? err.message : 'Failed to execute query')
      setResult(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Get current schema config
  const currentSchemaConfig = warehouseConfig?.config?.schemas?.find(
    (s) => s.schema_name === selectedSchema
  )

  // Filter presets by category
  const filteredPresets = presetFilter
    ? QUERY_PRESETS.filter((p) => p.category === presetFilter)
    : QUERY_PRESETS

  // Auth check, loading, and "not configured" states now handled by shared WarehouseDevLayout
  // if (sessionStatus === 'loading' || configLoading) { ... }
  // if (sessionStatus !== 'authenticated') { ... }
  // if (!warehouseConfig?.success || !warehouseConfig?.config?.enabled) { ... }

  return (
    <div className="space-y-6">
      {/* Header and Schema Selector now rendered by shared WarehouseDevLayout */}

      {/* Query Presets */}
      {currentSchemaConfig?.source_type === 'business_central' && (
        <div className="glass-luxury-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium theme-text-primary">Financial Queries</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setPresetFilter(null)}
                className={cn(
                  'px-3 py-1 text-sm rounded-lg transition-colors',
                  !presetFilter
                    ? 'bg-blue-600 text-white'
                    : 'border border-white/10 theme-text-secondary hover:bg-white/5'
                )}
              >
                All
              </button>
              {Object.entries(CATEGORY_LABELS).map(([key, { label, color }]) => (
                <button
                  key={key}
                  onClick={() => setPresetFilter(presetFilter === key ? null : key)}
                  className={cn(
                    'px-3 py-1 text-sm rounded-lg transition-colors',
                    presetFilter === key
                      ? 'bg-blue-600 text-white'
                      : 'border border-white/10 theme-text-secondary hover:bg-white/5'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPresets.map((preset) => {
              const catInfo = CATEGORY_LABELS[preset.category]
              return (
                <div
                  key={preset.label}
                  className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium theme-text-primary text-sm">{preset.label}</span>
                    <span className={cn('text-xs', catInfo.color)}>{catInfo.label}</span>
                  </div>
                  <p className="text-xs theme-text-secondary mb-3">{preset.description}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => runPreset(preset)}
                      disabled={isLoading}
                      className="px-3 py-1 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                    >
                      Run
                    </button>
                    <button
                      onClick={() => applyPreset(preset)}
                      className="px-3 py-1 text-xs rounded-lg border border-white/10 hover:bg-white/5 theme-text-secondary transition-colors"
                    >
                      Edit SQL
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick Query Section */}
      <div className="glass-luxury-card p-6">
        <h2 className="text-lg font-medium theme-text-primary mb-4">Quick Table Query</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm theme-text-secondary mb-2">Table</label>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              disabled={tablesLoading || availableTables.length === 0}
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
            >
              {tablesLoading ? (
                <option>Loading tables...</option>
              ) : availableTables.length === 0 ? (
                <option>No tables available</option>
              ) : (
                availableTables.map((table) => (
                  <option key={table} value={table}>
                    {table}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-sm theme-text-secondary mb-2">Limit</label>
            <input
              type="number"
              value={queryLimit}
              onChange={(e) => setQueryLimit(Math.max(1, parseInt(e.target.value) || 100))}
              min={1}
              max={1000}
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <button
            onClick={() => handleTableQuery()}
            disabled={isLoading || !selectedTable}
            className={cn(
              'px-6 py-2 rounded-lg font-medium transition-all',
              'bg-blue-600 hover:bg-blue-700 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isLoading ? 'Running...' : 'Run Query'}
          </button>
        </div>
      </div>

      {/* Custom SQL Section */}
      <div className="glass-luxury-card p-6">
        <h2 className="text-lg font-medium theme-text-primary mb-4">Custom SQL</h2>
        <textarea
          value={customQuery}
          onChange={(e) => setCustomQuery(e.target.value)}
          placeholder={`SELECT * FROM ${selectedSchema || 'schema'}.table_name WHERE ...`}
          rows={5}
          className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 theme-text-primary placeholder:text-white/30 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y"
        />
        <div className="flex justify-between items-center mt-4">
          <p className="text-sm theme-text-secondary">
            Only SELECT queries allowed. Results limited to 1000 rows.
          </p>
          <button
            onClick={handleCustomQuery}
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

      {/* Error Display */}
      {error && (
        <div className="glass-luxury-card p-4 border-l-4 border-red-500 bg-red-500/10">
          <p className="text-red-400 font-medium">Error</p>
          <p className="text-red-300 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Results Section */}
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
                  {result.schema && ` - ${result.schema}`}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white'
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
                    ? 'bg-blue-600 text-white'
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

      {/* Categorized Tables */}
      <div className="glass-luxury-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium theme-text-primary">
            Tables in {currentSchemaConfig?.display_name || selectedSchema}
          </h2>
          <span className="text-sm theme-text-secondary">
            {availableTables.length} table{availableTables.length !== 1 ? 's' : ''}
          </span>
        </div>

        {tablesLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : availableTables.length === 0 ? (
          <p className="text-center py-8 theme-text-secondary">No tables found</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(categorizedTables).map(([category, tables]) => (
              <div key={category}>
                <h3 className="text-sm font-medium theme-text-secondary mb-2">{category}</h3>
                <div className="grid gap-1">
                  {tables.map((table) => (
                    <div
                      key={table}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between"
                    >
                      <span className="font-mono text-sm text-blue-400">{table}</span>
                      <button
                        onClick={() => {
                          setSelectedTable(table)
                          handleTableQuery(table)
                        }}
                        disabled={isLoading}
                        className="px-3 py-1 text-xs rounded-lg border border-white/10 hover:bg-white/5 theme-text-secondary hover:theme-text-primary transition-colors disabled:opacity-50"
                      >
                        Query
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connection Info */}
      <div className="glass-luxury-card p-6">
        <h2 className="text-lg font-medium theme-text-primary mb-4">Connection Info</h2>
        <div className="grid gap-2 text-sm font-mono">
          <div className="flex gap-4">
            <span className="theme-text-secondary w-28">Organization:</span>
            <span className="theme-text-primary">{warehouseConfig?.organizationName}</span>
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
              {currentSchemaConfig
                ? SOURCE_TYPE_LABELS[currentSchemaConfig.source_type]?.label ||
                  currentSchemaConfig.source_type
                : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
