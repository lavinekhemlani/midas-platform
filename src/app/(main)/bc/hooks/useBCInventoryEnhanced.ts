'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

interface DateRange {
  startDate: string
  endDate: string
}

interface OverviewData {
  total_items: number
  items_with_stock: number
  total_inventory_value: number
  total_units_on_hand: number
  average_unit_cost: number
}

interface CategoryData {
  item_category_code: string
  total_value: number
  item_count: number
}

interface MovementData {
  month: string
  entry_type: string
  total_quantity: number
  total_cost: number
  entry_count: number
}

interface TurnoverData {
  cogs_annual: number
  average_inventory: number
  current_inventory: number
  turnover_ratio: number
  days_inventory_outstanding: number
}

interface SlowMovingItem {
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

interface SlowMovingSummary {
  totalItems: number
  totalValue: number
  zeroSalesCount: number
  zeroSalesValue: number
}

interface TopItemByValue {
  item_no: string
  description: string
  inventory: number
  unit_cost: number
  inventory_value: number
  item_category_code: string
  percentage: number
}

export interface LocationInventoryStats {
  net_quantity: number
  total_cost: number
  sales_qty: number
  sales_cost: number
  purchases_qty: number
  purchases_cost: number
  entry_count: number
  unique_items: number
}

export interface LocationRow {
  code: string
  name: string
  address: string
  addressLine2: string
  city: string
  state: string
  country: string
  postalCode: string
  contact: string
  phoneNumber: string
  email: string
  website: string
  inventory_stats: LocationInventoryStats | null
}

export interface EnhancedCategory {
  code: string
  description: string
  item_count: number
  total_value: number
  total_units: number
  percentage_of_total_value: number
  avg_unit_cost: number
}

export interface ABCClassData {
  count: number
  totalValue: number
  percentage: number
}

export interface ABCClassification {
  A: ABCClassData
  B: ABCClassData
  C: ABCClassData
}

export interface StockHealth {
  averageScore: number
  distribution: {
    excellent: number
    good: number
    fair: number
    poor: number
  }
}

export interface FullItem {
  item_no: string
  description: string
  inventory: number
  unit_cost: number
  unit_price: number
  inventory_value: number
  item_category_code: string
  category_name: string
  type: string
  blocked: boolean
  base_uom: string
  abc_class: 'A' | 'B' | 'C'
  health_score: number
  sales_qty: number
  purchases_qty: number
  days_since_last_sale: number | null
  turnover_ratio: number
}

interface InventoryEnhancedData {
  overview: OverviewData
  byCategory: CategoryData[]
  movementTrend: MovementData[]
  turnover: TurnoverData | null
  slowMoving: { items: SlowMovingItem[]; summary: SlowMovingSummary }
  topItemsByValue: TopItemByValue[]
  totalInventoryValue: number
  locations: LocationRow[]
  locationStatsSource: 'odata_ws' | 'api_v2'
  locationStatsAvailable: boolean
  categories: EnhancedCategory[]
  abcClassification: ABCClassification
  stockHealth: StockHealth
  allItems: FullItem[]
  companyName: string | null
  currency: string
  itemCount: number
  ledgerEntryCount: number
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch enhanced inventory data')
  }
  return response.json()
}

export function useBCInventoryEnhanced(connectionId: string | null, dateRange?: DateRange) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (dateRange?.startDate) params.set('startDate', dateRange.startDate)
  if (dateRange?.endDate) params.set('endDate', dateRange.endDate)
  const qs = params.toString()
  const url = connectionId
    ? `/api/providers/dynamics/inventory-enhanced${qs ? `?${qs}` : ''}`
    : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-inventory-enhanced', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d: InventoryEnhancedData | null = data?.data ?? null

  return {
    overview: d?.overview ?? null,
    byCategory: d?.byCategory ?? [],
    movementTrend: d?.movementTrend ?? [],
    turnover: d?.turnover ?? null,
    slowMoving: d?.slowMoving ?? {
      items: [],
      summary: { totalItems: 0, totalValue: 0, zeroSalesCount: 0, zeroSalesValue: 0 },
    },
    topItemsByValue: d?.topItemsByValue ?? [],
    totalInventoryValue: d?.totalInventoryValue ?? 0,
    locations: d?.locations ?? [],
    locationStatsSource: d?.locationStatsSource ?? 'api_v2',
    locationStatsAvailable: d?.locationStatsAvailable ?? false,
    categories: d?.categories ?? [],
    abcClassification: d?.abcClassification ?? {
      A: { count: 0, totalValue: 0, percentage: 0 },
      B: { count: 0, totalValue: 0, percentage: 0 },
      C: { count: 0, totalValue: 0, percentage: 0 },
    },
    stockHealth: d?.stockHealth ?? {
      averageScore: 0,
      distribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
    },
    allItems: d?.allItems ?? [],
    companyName: d?.companyName ?? null,
    currency: d?.currency,
    itemCount: d?.itemCount ?? 0,
    ledgerEntryCount: d?.ledgerEntryCount ?? 0,
    isLoading,
    error,
    mutate,
  }
}
