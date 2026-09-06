'use client'

import useSWR from 'swr'
import type { QueryResult } from '@/app/(main)/bc/inventory/hooks/useInventoryData'

export interface WarehouseItem {
  item_no: string
  description: string
  inventory: number
  unit_cost: number
  inventory_value: number
  item_category_code: string
  sales_qty: number
  purchases_qty: number
  turnover_ratio: number
  days_since_last_sale: number | null
  abc_class: 'A' | 'B' | 'C'
  health_score: number
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
 * Fetches all inventory items from Redshift with computed ABC class, health score,
 * sales/purchase quantities, and turnover metrics.
 */
export function useWarehouseInventoryItems(schema: string | null, dateRange?: DateRange) {
  const startDate = dateRange?.startDate
  const endDate = dateRange?.endDate

  const dateFilter =
    startDate && endDate
      ? `AND ile.posting_date >= '${startDate}' AND ile.posting_date <= '${endDate}'`
      : `AND ile.posting_date >= CURRENT_DATE - INTERVAL '12 months'`

  const query = schema
    ? `
    WITH item_movements AS (
      SELECT
        ile.item_no,
        ile.company_id,
        COALESCE(SUM(CASE WHEN ile.entry_type = 'Sale' THEN ABS(ile.quantity) ELSE 0 END), 0) AS sales_qty,
        COALESCE(SUM(CASE WHEN ile.entry_type = 'Purchase' THEN ile.quantity ELSE 0 END), 0) AS purchases_qty,
        MAX(CASE WHEN ile.entry_type = 'Sale' THEN ile.posting_date END) AS last_sale_date
      FROM ${schema}.item_ledger_entry ile
      WHERE COALESCE(ile._fivetran_deleted, false) = false
        ${dateFilter}
      GROUP BY ile.item_no, ile.company_id
    ),
    items_base AS (
      SELECT
        i.no AS item_no,
        COALESCE(i.description, '') AS description,
        COALESCE(i.inventory, 0) AS inventory,
        COALESCE(i.unit_cost, 0) AS unit_cost,
        COALESCE(i.inventory, 0) * COALESCE(i.unit_cost, 0) AS inventory_value,
        COALESCE(i.item_category_code, '') AS item_category_code,
        COALESCE(im.sales_qty, 0) AS sales_qty,
        COALESCE(im.purchases_qty, 0) AS purchases_qty,
        CASE
          WHEN COALESCE(i.inventory, 0) > 0 AND COALESCE(im.sales_qty, 0) > 0
          THEN COALESCE(im.sales_qty, 0)::float / COALESCE(i.inventory, 0)
          ELSE 0
        END AS turnover_ratio,
        CASE
          WHEN im.last_sale_date IS NULL THEN NULL
          ELSE DATEDIFF(day, im.last_sale_date, CURRENT_DATE)
        END AS days_since_last_sale
      FROM ${schema}.item i
      LEFT JOIN item_movements im ON i.no = im.item_no AND i.company_id = im.company_id
      WHERE COALESCE(i._fivetran_deleted, false) = false
    ),
    total_value AS (
      SELECT SUM(inventory_value) AS total_inv_value
      FROM items_base
      WHERE inventory > 0
    ),
    abc_ranked AS (
      SELECT
        ib.*,
        tv.total_inv_value,
        SUM(ib.inventory_value) OVER (ORDER BY ib.inventory_value DESC ROWS UNBOUNDED PRECEDING) AS cumulative_value
      FROM items_base ib
      CROSS JOIN total_value tv
    )
    SELECT
      item_no,
      description,
      inventory,
      unit_cost,
      inventory_value,
      item_category_code,
      sales_qty,
      purchases_qty,
      turnover_ratio,
      days_since_last_sale,
      CASE
        WHEN total_inv_value > 0 AND cumulative_value <= total_inv_value * 0.8 THEN 'A'
        WHEN total_inv_value > 0 AND cumulative_value <= total_inv_value * 0.95 THEN 'B'
        ELSE 'C'
      END AS abc_class,
      -- Health score: turnover (0-30) + recency (0-30) + availability (0-20) + ABC value (0-20)
      LEAST(100, GREATEST(0,
        -- Turnover contribution (0-30)
        CASE
          WHEN turnover_ratio >= 6 THEN 30
          WHEN turnover_ratio >= 3 THEN 20
          WHEN turnover_ratio >= 1 THEN 10
          ELSE 0
        END
        -- Recency contribution (0-30)
        + CASE
          WHEN days_since_last_sale IS NULL THEN 0
          WHEN days_since_last_sale <= 30 THEN 30
          WHEN days_since_last_sale <= 90 THEN 20
          WHEN days_since_last_sale <= 180 THEN 10
          ELSE 0
        END
        -- Availability (0-20)
        + CASE WHEN inventory > 0 THEN 20 ELSE 0 END
        -- Value tier (0-20)
        + CASE
          WHEN total_inv_value > 0 AND cumulative_value <= total_inv_value * 0.8 THEN 20
          WHEN total_inv_value > 0 AND cumulative_value <= total_inv_value * 0.95 THEN 10
          ELSE 5
        END
      )) AS health_score
    FROM abc_ranked
    ORDER BY inventory_value DESC
    LIMIT 1000
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<WarehouseItem>>(
    query ? ['warehouse-inventory-items', schema, startDate, endDate] : null,
    () => warehouseFetcher<WarehouseItem>(query!),
    { revalidateOnFocus: false }
  )

  const items: WarehouseItem[] = (data?.data || []).map((row) => ({
    item_no: row.item_no,
    description: row.description,
    inventory: Number(row.inventory),
    unit_cost: Number(row.unit_cost),
    inventory_value: Number(row.inventory_value),
    item_category_code: row.item_category_code,
    sales_qty: Number(row.sales_qty),
    purchases_qty: Number(row.purchases_qty),
    turnover_ratio: Number(row.turnover_ratio),
    days_since_last_sale:
      row.days_since_last_sale != null ? Number(row.days_since_last_sale) : null,
    abc_class: (row.abc_class as 'A' | 'B' | 'C') || 'C',
    health_score: Number(row.health_score) || 0,
  }))

  return { data: items, isLoading, error, mutate }
}
