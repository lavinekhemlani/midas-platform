'use client'

import useSWR from 'swr'

// Re-export DateRange for consistency
export interface DateRange {
  startDate: string | null // ISO format YYYY-MM-DD
  endDate: string | null // ISO format YYYY-MM-DD
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface QueryResult<T = Record<string, unknown>> {
  success: boolean
  data: T[]
  count: number
  columns: string[]
  totalCount?: number
  schema?: string
  error?: string
}

// Inventory Overview Types
export interface InventoryOverviewRow {
  total_items: number
  items_with_stock: number
  total_inventory_value: number
  total_units_on_hand: number
  average_unit_cost: number
}

// Inventory by Category Types
export interface InventoryByCategoryRow {
  item_category_code: string
  item_count: number
  total_units: number
  total_value: number
  average_unit_cost: number
}

// Inventory Movement Types
export interface InventoryMovementRow {
  entry_no: number
  posting_date: string
  entry_type: string
  item_no: string
  description: string
  quantity: number
  cost_amount_actual: number
  document_no: string
  source_type: string
}

export interface MonthlyMovementTrendRow {
  month: string
  entry_type: string
  total_quantity: number
  total_cost: number
  entry_count: number
}

// Top Items Types
export interface TopItemByValueRow {
  item_no: string
  description: string
  inventory: number
  unit_cost: number
  inventory_value: number
  item_category_code: string
}

// Slow Moving Inventory Types
export interface SlowMovingItemRow {
  item_no: string
  description: string
  inventory: number
  unit_cost: number
  inventory_value: number
  sales_qty: number
  purchases_qty: number
  turnover_ratio: number
  days_since_last_sale: number | null
}

// Inventory Valuation Types
export interface InventoryValuationRow {
  item_no: string
  description: string
  inventory: number
  unit_cost: number
  standard_cost: number
  last_direct_cost: number
  inventory_value: number
  costing_method: string
}

export interface InventoryValuationSummary {
  total_items: number
  total_units: number
  total_value_at_unit_cost: number
  total_value_at_standard_cost: number
  total_value_at_last_direct_cost: number
}

// Inventory Turnover Types
export interface InventoryTurnoverRow {
  cogs_annual: number
  average_inventory: number
  current_inventory: number
  turnover_ratio: number
  days_inventory_outstanding: number
}

// ============================================================================
// Fetcher Function
// ============================================================================

async function warehouseFetcher<T>(query: string): Promise<QueryResult<T>> {
  const response = await fetch('/api/redshift/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    if (response.status === 403) {
      console.warn('[inventoryData] Schema access denied (403) — returning empty result')
      return { success: false, data: [], count: 0, columns: [], error: 'Schema access denied' }
    }
    throw new Error(`Warehouse query failed: ${response.statusText}`)
  }

  return response.json()
}

// ============================================================================
// Hook 1: useInventoryOverview
// Overall inventory statistics
// ============================================================================

export function useInventoryOverview(schema: string | null, dateRange?: DateRange) {
  const startDate = dateRange?.startDate
  const endDate = dateRange?.endDate

  const query = schema
    ? startDate && endDate
      ? `
      SELECT
        p.total_items,
        s.items_with_stock,
        s.total_inventory_value,
        s.total_units_on_hand,
        CASE WHEN s.total_units_on_hand > 0
          THEN s.total_inventory_value / s.total_units_on_hand
          ELSE 0
        END AS average_unit_cost
      FROM (
        SELECT COUNT(DISTINCT item_no) AS total_items
        FROM ${schema}.item_ledger_entry
        WHERE COALESCE(_fivetran_deleted, false) = false
          AND posting_date >= '${startDate}'
          AND posting_date <= '${endDate}'
      ) p
      CROSS JOIN (
        SELECT
          COUNT(*) AS items_with_stock,
          COALESCE(SUM(closing_qty), 0) AS total_units_on_hand,
          COALESCE(SUM(closing_value), 0) AS total_inventory_value
        FROM (
          SELECT
            item_no,
            SUM(quantity) AS closing_qty,
            SUM(cost_amount_actual) AS closing_value
          FROM ${schema}.item_ledger_entry
          WHERE COALESCE(_fivetran_deleted, false) = false
            AND posting_date <= '${endDate}'
          GROUP BY item_no
          HAVING SUM(quantity) > 0
        ) stock
      ) s
      `
      // OLD: item table query — commented out, now using item_ledger_entry for current as-of-today KPIs
      // SELECT COUNT(*) AS total_items, ... FROM ${schema}.item WHERE COALESCE(_fivetran_deleted, false) = false
      : `
      SELECT
        p.total_items,
        s.items_with_stock,
        s.total_inventory_value,
        s.total_units_on_hand,
        CASE WHEN s.total_units_on_hand > 0
          THEN s.total_inventory_value / s.total_units_on_hand
          ELSE 0
        END AS average_unit_cost
      FROM (
        SELECT COUNT(DISTINCT item_no) AS total_items
        FROM ${schema}.item_ledger_entry
        WHERE COALESCE(_fivetran_deleted, false) = false
      ) p
      CROSS JOIN (
        SELECT
          COUNT(*) AS items_with_stock,
          COALESCE(SUM(closing_qty), 0) AS total_units_on_hand,
          COALESCE(SUM(closing_value), 0) AS total_inventory_value
        FROM (
          SELECT
            item_no,
            SUM(quantity) AS closing_qty,
            SUM(cost_amount_actual) AS closing_value
          FROM ${schema}.item_ledger_entry
          WHERE COALESCE(_fivetran_deleted, false) = false
          GROUP BY item_no
          HAVING SUM(quantity) > 0
        ) stock
      ) s
      `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<InventoryOverviewRow>>(
    query ? ['inventory-overview', schema, startDate, endDate] : null,
    () => warehouseFetcher<InventoryOverviewRow>(query!),
    { revalidateOnFocus: false }
  )

  const overview: InventoryOverviewRow | null = data?.data?.[0]
    ? {
        total_items: Number(data.data[0].total_items),
        items_with_stock: Number(data.data[0].items_with_stock),
        total_inventory_value: Number(data.data[0].total_inventory_value),
        total_units_on_hand: Number(data.data[0].total_units_on_hand),
        average_unit_cost: Number(data.data[0].average_unit_cost),
      }
    : null

  return { data: overview, isLoading, error, mutate }
}

// ============================================================================
// Hook 2: useInventoryByCategory
// Group inventory by item category
// ============================================================================

export function useInventoryByCategory(schema: string | null, limit: number = 20) {
  const query = schema
    ? `
    SELECT
      COALESCE(item_category_code, 'Uncategorized') AS item_category_code,
      COUNT(*) AS item_count,
      COALESCE(SUM(COALESCE(inventory, 0)), 0) AS total_units,
      COALESCE(SUM(COALESCE(inventory, 0) * COALESCE(unit_cost, 0)), 0) AS total_value,
      CASE
        WHEN SUM(COALESCE(inventory, 0)) > 0
        THEN SUM(COALESCE(inventory, 0) * COALESCE(unit_cost, 0)) / SUM(COALESCE(inventory, 0))
        ELSE 0
      END AS average_unit_cost
    FROM ${schema}.item
    WHERE COALESCE(_fivetran_deleted, false) = false
    GROUP BY COALESCE(item_category_code, 'Uncategorized')
    ORDER BY total_value DESC
    LIMIT ${limit}
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<InventoryByCategoryRow>>(
    query ? ['inventory-by-category', schema, limit] : null,
    () => warehouseFetcher<InventoryByCategoryRow>(query!),
    { revalidateOnFocus: false }
  )

  const categories: InventoryByCategoryRow[] = (data?.data || []).map((row) => ({
    item_category_code: row.item_category_code,
    item_count: Number(row.item_count),
    total_units: Number(row.total_units),
    total_value: Number(row.total_value),
    average_unit_cost: Number(row.average_unit_cost),
  }))

  // Calculate summary
  const totalValue = categories.reduce((sum, c) => sum + c.total_value, 0)
  const categoriesWithPercentage = categories.map((c) => ({
    ...c,
    percentage: totalValue > 0 ? (c.total_value / totalValue) * 100 : 0,
  }))

  return { data: categoriesWithPercentage, isLoading, error, mutate }
}

// ============================================================================
// Hook 3: useInventoryMovements
// Recent inventory movements from item_ledger_entry
// ============================================================================

export function useInventoryMovements(
  schema: string | null,
  dateRange?: DateRange,
  limit: number = 50
) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND ile.posting_date >= '${dateRange.startDate}' AND ile.posting_date <= '${dateRange.endDate}'`
      : ''

  const query = schema
    ? `
    SELECT
      ile.entry_no,
      ile.posting_date,
      COALESCE(ile.entry_type, '') AS entry_type,
      ile.item_no,
      COALESCE(i.description, '') AS description,
      COALESCE(ile.quantity, 0) AS quantity,
      COALESCE(ile.cost_amount_actual, 0) AS cost_amount_actual,
      COALESCE(ile.document_no, '') AS document_no,
      COALESCE(ile.source_type, '') AS source_type
    FROM ${schema}.item_ledger_entry ile
    LEFT JOIN ${schema}.item i
      ON ile.item_no = i.no
      AND ile.company_id = i.company_id
      AND COALESCE(i._fivetran_deleted, false) = false
    WHERE COALESCE(ile._fivetran_deleted, false) = false
      ${dateFilter}
    ORDER BY ile.posting_date DESC, ile.entry_no DESC
    LIMIT ${limit}
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<InventoryMovementRow>>(
    query ? ['inventory-movements', schema, dateRange?.startDate, dateRange?.endDate, limit] : null,
    () => warehouseFetcher<InventoryMovementRow>(query!),
    { revalidateOnFocus: false }
  )

  const movements: InventoryMovementRow[] = (data?.data || []).map((row) => ({
    entry_no: Number(row.entry_no),
    posting_date: row.posting_date,
    entry_type: row.entry_type,
    item_no: row.item_no,
    description: row.description,
    quantity: Number(row.quantity),
    cost_amount_actual: Number(row.cost_amount_actual),
    document_no: row.document_no,
    source_type: row.source_type,
  }))

  return { data: movements, isLoading, error, mutate }
}

// ============================================================================
// Hook 3b: useInventoryMovementTrend
// Monthly trend of inventory movements
// ============================================================================

export function useInventoryMovementTrend(schema: string | null, dateRange?: DateRange) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND posting_date >= '${dateRange.startDate}' AND posting_date <= '${dateRange.endDate}'`
      : `AND posting_date >= CURRENT_DATE - INTERVAL '12 months'`

  const query = schema
    ? `
    SELECT
      DATE_TRUNC('month', posting_date) AS month,
      COALESCE(entry_type, 'Other') AS entry_type,
      COALESCE(SUM(quantity), 0) AS total_quantity,
      COALESCE(SUM(cost_amount_actual), 0) AS total_cost,
      COUNT(*) AS entry_count
    FROM ${schema}.item_ledger_entry
    WHERE COALESCE(_fivetran_deleted, false) = false
      ${dateFilter}
    GROUP BY DATE_TRUNC('month', posting_date), COALESCE(entry_type, 'Other')
    ORDER BY month DESC, entry_type
    LIMIT 100
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<MonthlyMovementTrendRow>>(
    query ? ['inventory-movement-trend', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher<MonthlyMovementTrendRow>(query!),
    { revalidateOnFocus: false }
  )

  const trends: MonthlyMovementTrendRow[] = (data?.data || []).map((row) => ({
    month: row.month,
    entry_type: row.entry_type,
    total_quantity: Number(row.total_quantity),
    total_cost: Number(row.total_cost),
    entry_count: Number(row.entry_count),
  }))

  return { data: trends, isLoading, error, mutate }
}

// ============================================================================
// Hook 4: useTopItemsByValue
// Top items sorted by inventory value
// ============================================================================

export function useTopItemsByValue(schema: string | null, limit: number = 20) {
  const query = schema
    ? `
    SELECT
      no AS item_no,
      COALESCE(description, '') AS description,
      COALESCE(inventory, 0) AS inventory,
      COALESCE(unit_cost, 0) AS unit_cost,
      COALESCE(inventory, 0) * COALESCE(unit_cost, 0) AS inventory_value,
      COALESCE(item_category_code, '') AS item_category_code
    FROM ${schema}.item
    WHERE COALESCE(_fivetran_deleted, false) = false
      AND COALESCE(inventory, 0) > 0
    ORDER BY COALESCE(inventory, 0) * COALESCE(unit_cost, 0) DESC
    LIMIT ${limit}
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<TopItemByValueRow>>(
    query ? ['top-items-by-value', schema, limit] : null,
    () => warehouseFetcher<TopItemByValueRow>(query!),
    { revalidateOnFocus: false }
  )

  const items: TopItemByValueRow[] = (data?.data || []).map((row) => ({
    item_no: row.item_no,
    description: row.description,
    inventory: Number(row.inventory),
    unit_cost: Number(row.unit_cost),
    inventory_value: Number(row.inventory_value),
    item_category_code: row.item_category_code,
  }))

  // Calculate total for percentage
  const totalValue = items.reduce((sum, item) => sum + item.inventory_value, 0)
  const itemsWithPercentage = items.map((item) => ({
    ...item,
    percentage: totalValue > 0 ? (item.inventory_value / totalValue) * 100 : 0,
  }))

  return { data: itemsWithPercentage, totalValue, isLoading, error, mutate }
}

// ============================================================================
// Hook 5: useSlowMovingInventory
// Items with low turnover (high inventory relative to sales)
// Now date-reactive: queries item_ledger_entry for sales within the period
// ============================================================================

export function useSlowMovingInventory(
  schema: string | null,
  dateRange?: DateRange,
  limit: number = 20
) {
  // Build date filter for item_ledger_entry
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND ile.posting_date >= '${dateRange.startDate}' AND ile.posting_date <= '${dateRange.endDate}'`
      : `AND ile.posting_date >= CURRENT_DATE - INTERVAL '12 months'`

  const query = schema
    ? `
    WITH period_sales AS (
      -- Calculate sales quantity for each item within the date range
      SELECT
        item_no,
        company_id,
        COALESCE(SUM(CASE WHEN entry_type = 'Sale' THEN ABS(quantity) ELSE 0 END), 0) AS period_sales_qty,
        COALESCE(SUM(CASE WHEN entry_type = 'Purchase' THEN quantity ELSE 0 END), 0) AS period_purchases_qty,
        MAX(CASE WHEN entry_type = 'Sale' THEN posting_date END) AS last_sale_date
      FROM ${schema}.item_ledger_entry ile
      WHERE COALESCE(_fivetran_deleted, false) = false
        ${dateFilter}
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
      CASE
        WHEN COALESCE(i.inventory, 0) > 0 AND COALESCE(ps.period_sales_qty, 0) > 0
        THEN COALESCE(ps.period_sales_qty, 0) / COALESCE(i.inventory, 0)
        ELSE 0
      END AS turnover_ratio,
      CASE
        WHEN ps.last_sale_date IS NULL THEN NULL
        ELSE DATEDIFF(day, ps.last_sale_date, CURRENT_DATE)
      END AS days_since_last_sale
    FROM ${schema}.item i
    LEFT JOIN period_sales ps ON i.no = ps.item_no AND i.company_id = ps.company_id
    WHERE COALESCE(i._fivetran_deleted, false) = false
      AND COALESCE(i.inventory, 0) > 0
    ORDER BY
      CASE
        WHEN COALESCE(ps.period_sales_qty, 0) = 0 THEN 0
        ELSE COALESCE(ps.period_sales_qty, 0) / COALESCE(i.inventory, 0)
      END ASC,
      COALESCE(i.inventory, 0) * COALESCE(i.unit_cost, 0) DESC
    LIMIT ${limit}
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<SlowMovingItemRow>>(
    query
      ? ['slow-moving-inventory', schema, dateRange?.startDate, dateRange?.endDate, limit]
      : null,
    () => warehouseFetcher<SlowMovingItemRow>(query!),
    { revalidateOnFocus: false }
  )

  const items: SlowMovingItemRow[] = (data?.data || []).map((row) => ({
    item_no: row.item_no,
    description: row.description,
    inventory: Number(row.inventory),
    unit_cost: Number(row.unit_cost),
    inventory_value: Number(row.inventory_value),
    sales_qty: Number(row.sales_qty),
    purchases_qty: Number(row.purchases_qty),
    turnover_ratio: Number(row.turnover_ratio),
    days_since_last_sale:
      row.days_since_last_sale != null ? Number(row.days_since_last_sale) : null,
  }))

  // Calculate summary
  const totalSlowMovingValue = items.reduce((sum, item) => sum + item.inventory_value, 0)
  const zeroSalesItems = items.filter((item) => item.sales_qty === 0)
  const zeroSalesValue = zeroSalesItems.reduce((sum, item) => sum + item.inventory_value, 0)

  const summary = {
    totalItems: items.length,
    totalValue: totalSlowMovingValue,
    zeroSalesCount: zeroSalesItems.length,
    zeroSalesValue: zeroSalesValue,
  }

  return { data: items, summary, isLoading, error, mutate }
}

// ============================================================================
// Hook 6: useInventoryValuation
// Detailed valuation data with different cost methods
// ============================================================================

export function useInventoryValuation(schema: string | null, limit: number = 50) {
  const query = schema
    ? `
    SELECT
      no AS item_no,
      COALESCE(description, '') AS description,
      COALESCE(inventory, 0) AS inventory,
      COALESCE(unit_cost, 0) AS unit_cost,
      COALESCE(standard_cost, 0) AS standard_cost,
      COALESCE(last_direct_cost, 0) AS last_direct_cost,
      COALESCE(inventory, 0) * COALESCE(unit_cost, 0) AS inventory_value,
      COALESCE(costing_method, '') AS costing_method
    FROM ${schema}.item
    WHERE COALESCE(_fivetran_deleted, false) = false
      AND COALESCE(inventory, 0) > 0
    ORDER BY COALESCE(inventory, 0) * COALESCE(unit_cost, 0) DESC
    LIMIT ${limit}
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<InventoryValuationRow>>(
    query ? ['inventory-valuation', schema, limit] : null,
    () => warehouseFetcher<InventoryValuationRow>(query!),
    { revalidateOnFocus: false }
  )

  const items: InventoryValuationRow[] = (data?.data || []).map((row) => ({
    item_no: row.item_no,
    description: row.description,
    inventory: Number(row.inventory),
    unit_cost: Number(row.unit_cost),
    standard_cost: Number(row.standard_cost),
    last_direct_cost: Number(row.last_direct_cost),
    inventory_value: Number(row.inventory_value),
    costing_method: row.costing_method,
  }))

  // Calculate summary with different valuation methods
  const summary: InventoryValuationSummary = {
    total_items: items.length,
    total_units: items.reduce((sum, item) => sum + item.inventory, 0),
    total_value_at_unit_cost: items.reduce((sum, item) => sum + item.inventory_value, 0),
    total_value_at_standard_cost: items.reduce(
      (sum, item) => sum + item.inventory * item.standard_cost,
      0
    ),
    total_value_at_last_direct_cost: items.reduce(
      (sum, item) => sum + item.inventory * item.last_direct_cost,
      0
    ),
  }

  return { data: items, summary, isLoading, error, mutate }
}

// ============================================================================
// Hook 7: useInventoryTurnover
// Calculate inventory turnover metrics
// ============================================================================

export function useInventoryTurnover(schema: string | null, dateRange?: DateRange) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND e.posting_date >= '${dateRange.startDate}' AND e.posting_date <= '${dateRange.endDate}'`
      : `AND e.posting_date >= CURRENT_DATE - INTERVAL '12 months'`

  const query = schema
    ? `
    WITH cogs_data AS (
      SELECT COALESCE(SUM(e.debit_amount - e.credit_amount), 0) AS annual_cogs
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no
        AND e.company_id = a.company_id
      WHERE COALESCE(e._fivetran_deleted, false) = false
        AND COALESCE(e.reversed, false) = false
        AND COALESCE(a._fivetran_deleted, false) = false
        AND a.account_type = 'Posting'
        AND a.account_category = 'Cost_x0020_of_x0020_Goods_x0020_Sold'
        ${dateFilter}
    ),
    inventory_data AS (
      SELECT
        COALESCE(SUM(COALESCE(inventory, 0) * COALESCE(unit_cost, 0)), 0) AS current_inventory
      FROM ${schema}.item
      WHERE COALESCE(_fivetran_deleted, false) = false
    )
    SELECT
      cogs.annual_cogs AS cogs_annual,
      inv.current_inventory AS current_inventory,
      inv.current_inventory AS average_inventory,
      CASE
        WHEN inv.current_inventory > 0 THEN cogs.annual_cogs / inv.current_inventory
        ELSE 0
      END AS turnover_ratio,
      CASE
        WHEN cogs.annual_cogs > 0 THEN (inv.current_inventory / cogs.annual_cogs) * 365
        ELSE 0
      END AS days_inventory_outstanding
    FROM cogs_data cogs
    CROSS JOIN inventory_data inv
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<InventoryTurnoverRow>>(
    query ? ['inventory-turnover', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher<InventoryTurnoverRow>(query!),
    { revalidateOnFocus: false }
  )

  const turnover: InventoryTurnoverRow | null = data?.data?.[0]
    ? {
        cogs_annual: Number(data.data[0].cogs_annual),
        average_inventory: Number(data.data[0].average_inventory),
        current_inventory: Number(data.data[0].current_inventory),
        turnover_ratio: Number(data.data[0].turnover_ratio),
        days_inventory_outstanding: Number(data.data[0].days_inventory_outstanding),
      }
    : null

  // Provide interpretation
  let turnoverRating: 'excellent' | 'good' | 'fair' | 'poor' | null = null
  if (turnover && turnover.turnover_ratio > 0) {
    if (turnover.turnover_ratio >= 8) turnoverRating = 'excellent'
    else if (turnover.turnover_ratio >= 4) turnoverRating = 'good'
    else if (turnover.turnover_ratio >= 2) turnoverRating = 'fair'
    else turnoverRating = 'poor'
  }

  return { data: turnover, rating: turnoverRating, isLoading, error, mutate }
}

// ============================================================================
// Aggregated Hook: useInventoryData
// Combines all inventory hooks for convenience
// ============================================================================

export function useInventoryData(schema: string | null, dateRange?: DateRange) {
  const overview = useInventoryOverview(schema)
  const byCategory = useInventoryByCategory(schema)
  const movements = useInventoryMovements(schema, dateRange)
  const movementTrend = useInventoryMovementTrend(schema, dateRange)
  const topItems = useTopItemsByValue(schema)
  const slowMoving = useSlowMovingInventory(schema, dateRange)
  const valuation = useInventoryValuation(schema)
  const turnover = useInventoryTurnover(schema, dateRange)

  const isLoading =
    overview.isLoading ||
    byCategory.isLoading ||
    movements.isLoading ||
    movementTrend.isLoading ||
    topItems.isLoading ||
    slowMoving.isLoading ||
    valuation.isLoading ||
    turnover.isLoading

  const hasError =
    overview.error ||
    byCategory.error ||
    movements.error ||
    movementTrend.error ||
    topItems.error ||
    slowMoving.error ||
    valuation.error ||
    turnover.error

  const mutateAll = () => {
    overview.mutate()
    byCategory.mutate()
    movements.mutate()
    movementTrend.mutate()
    topItems.mutate()
    slowMoving.mutate()
    valuation.mutate()
    turnover.mutate()
  }

  return {
    overview: overview.data,
    byCategory: byCategory.data,
    movements: movements.data,
    movementTrend: movementTrend.data,
    topItems: topItems.data,
    topItemsTotalValue: topItems.totalValue,
    slowMoving: slowMoving.data,
    slowMovingSummary: slowMoving.summary,
    valuation: valuation.data,
    valuationSummary: valuation.summary,
    turnover: turnover.data,
    turnoverRating: turnover.rating,
    isLoading,
    error: hasError,
    mutate: mutateAll,
  }
}
