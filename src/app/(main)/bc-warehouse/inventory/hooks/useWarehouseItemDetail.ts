'use client'

import useSWR from 'swr'
import type { QueryResult } from '@/app/(main)/bc/inventory/hooks/useInventoryData'

export interface WarehouseItemDetail {
  item_no: string
  description: string
  inventory: number
  unit_cost: number
  standard_cost: number
  last_direct_cost: number
  item_category_code: string
  costing_method: string
}

export interface WarehouseLedgerEntry {
  entry_no: number
  posting_date: string
  entry_type: string
  document_no: string
  quantity: number
  cost_amount_actual: number
}

export interface WarehouseMonthlyMovement {
  month: string
  purchases_cost: number
  sales_cost: number
  positive_adjustments_cost: number
  negative_adjustments_cost: number
  transfers_cost: number
}

interface DateRange {
  startDate: string | null
  endDate: string | null
}

async function warehouseFetcher<T>(query: string): Promise<QueryResult<T>> {
  const response = await fetch('/api/redshift/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    if (response.status === 403) {
      return { success: false, data: [], count: 0, columns: [], error: 'Schema access denied' }
    }
    throw new Error(`Warehouse query failed: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Fetches detailed item data + ledger entries from Redshift for a single item.
 */
export function useWarehouseItemDetail(
  schema: string | null,
  itemNo: string | null,
  dateRange?: DateRange
) {
  const startDate = dateRange?.startDate
  const endDate = dateRange?.endDate

  const dateFilter =
    startDate && endDate
      ? `AND ile.posting_date >= '${startDate}' AND ile.posting_date <= '${endDate}'`
      : `AND ile.posting_date >= CURRENT_DATE - INTERVAL '12 months'`

  // Item detail query
  const itemQuery =
    schema && itemNo
      ? `
    SELECT
      no AS item_no,
      COALESCE(description, '') AS description,
      COALESCE(inventory, 0) AS inventory,
      COALESCE(unit_cost, 0) AS unit_cost,
      COALESCE(standard_cost, 0) AS standard_cost,
      COALESCE(last_direct_cost, 0) AS last_direct_cost,
      COALESCE(item_category_code, '') AS item_category_code,
      COALESCE(costing_method, '') AS costing_method
    FROM ${schema}.item
    WHERE COALESCE(_fivetran_deleted, false) = false
      AND no = '${itemNo}'
    LIMIT 1
    `
      : null

  // Ledger entries query
  const ledgerQuery =
    schema && itemNo
      ? `
    SELECT
      ile.entry_no,
      ile.posting_date,
      COALESCE(ile.entry_type, '') AS entry_type,
      COALESCE(ile.document_no, '') AS document_no,
      COALESCE(ile.quantity, 0) AS quantity,
      COALESCE(ile.cost_amount_actual, 0) AS cost_amount_actual
    FROM ${schema}.item_ledger_entry ile
    WHERE COALESCE(ile._fivetran_deleted, false) = false
      AND ile.item_no = '${itemNo}'
      ${dateFilter}
    ORDER BY ile.posting_date DESC, ile.entry_no DESC
    LIMIT 200
    `
      : null

  // Monthly movement query
  const movementQuery =
    schema && itemNo
      ? `
    SELECT
      DATE_TRUNC('month', ile.posting_date) AS month,
      COALESCE(SUM(CASE WHEN ile.entry_type = 'Purchase' THEN ABS(ile.cost_amount_actual) ELSE 0 END), 0) AS purchases_cost,
      COALESCE(SUM(CASE WHEN ile.entry_type = 'Sale' THEN ABS(ile.cost_amount_actual) ELSE 0 END), 0) AS sales_cost,
      COALESCE(SUM(CASE WHEN ile.entry_type LIKE '%Adjmt%' AND ile.cost_amount_actual > 0 THEN ile.cost_amount_actual ELSE 0 END), 0) AS positive_adjustments_cost,
      COALESCE(SUM(CASE WHEN ile.entry_type LIKE '%Adjmt%' AND ile.cost_amount_actual < 0 THEN ABS(ile.cost_amount_actual) ELSE 0 END), 0) AS negative_adjustments_cost,
      COALESCE(SUM(CASE WHEN ile.entry_type = 'Transfer' THEN ABS(ile.cost_amount_actual) ELSE 0 END), 0) AS transfers_cost
    FROM ${schema}.item_ledger_entry ile
    WHERE COALESCE(ile._fivetran_deleted, false) = false
      AND ile.item_no = '${itemNo}'
      ${dateFilter}
    GROUP BY DATE_TRUNC('month', ile.posting_date)
    ORDER BY month ASC
    `
      : null

  const {
    data: itemData,
    isLoading: itemLoading,
    error: itemError,
  } = useSWR<QueryResult<WarehouseItemDetail>>(
    itemQuery ? ['warehouse-item-detail', schema, itemNo] : null,
    () => warehouseFetcher<WarehouseItemDetail>(itemQuery!),
    { revalidateOnFocus: false }
  )

  const {
    data: ledgerData,
    isLoading: ledgerLoading,
    error: ledgerError,
  } = useSWR<QueryResult<WarehouseLedgerEntry>>(
    ledgerQuery ? ['warehouse-item-ledger', schema, itemNo, startDate, endDate] : null,
    () => warehouseFetcher<WarehouseLedgerEntry>(ledgerQuery!),
    { revalidateOnFocus: false }
  )

  const {
    data: movementData,
    isLoading: movementLoading,
    error: movementError,
  } = useSWR<QueryResult<WarehouseMonthlyMovement>>(
    movementQuery ? ['warehouse-item-movement', schema, itemNo, startDate, endDate] : null,
    () => warehouseFetcher<WarehouseMonthlyMovement>(movementQuery!),
    { revalidateOnFocus: false }
  )

  const item: WarehouseItemDetail | null = itemData?.data?.[0]
    ? {
        item_no: itemData.data[0].item_no,
        description: itemData.data[0].description,
        inventory: Number(itemData.data[0].inventory),
        unit_cost: Number(itemData.data[0].unit_cost),
        standard_cost: Number(itemData.data[0].standard_cost),
        last_direct_cost: Number(itemData.data[0].last_direct_cost),
        item_category_code: itemData.data[0].item_category_code,
        costing_method: itemData.data[0].costing_method,
      }
    : null

  const ledgerEntries: WarehouseLedgerEntry[] = (ledgerData?.data || []).map((row) => ({
    entry_no: Number(row.entry_no),
    posting_date: row.posting_date,
    entry_type: row.entry_type,
    document_no: row.document_no,
    quantity: Number(row.quantity),
    cost_amount_actual: Number(row.cost_amount_actual),
  }))

  const movementByMonth: WarehouseMonthlyMovement[] = (movementData?.data || []).map((row) => ({
    month: row.month,
    purchases_cost: Number(row.purchases_cost),
    sales_cost: Number(row.sales_cost),
    positive_adjustments_cost: Number(row.positive_adjustments_cost),
    negative_adjustments_cost: Number(row.negative_adjustments_cost),
    transfers_cost: Number(row.transfers_cost),
  }))

  // Calculate summary
  const totalPurchased = ledgerEntries
    .filter((e) => e.entry_type === 'Purchase')
    .reduce((sum, e) => sum + e.quantity, 0)
  const totalSold = ledgerEntries
    .filter((e) => e.entry_type === 'Sale')
    .reduce((sum, e) => sum + Math.abs(e.quantity), 0)
  const netMovement = ledgerEntries.reduce((sum, e) => sum + e.quantity, 0)

  const dates = ledgerEntries
    .map((e) => e.posting_date)
    .filter(Boolean)
    .sort()
  const firstTransaction = dates.length > 0 ? dates[0] : null
  const lastTransaction = dates.length > 0 ? dates[dates.length - 1] : null

  return {
    item,
    ledgerEntries,
    movementByMonth,
    totalPurchased,
    totalSold,
    netMovement,
    firstTransaction,
    lastTransaction,
    isLoading: itemLoading || ledgerLoading || movementLoading,
    error: itemError || ledgerError || movementError,
  }
}
