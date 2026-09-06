'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

interface DateRange {
  startDate: string
  endDate: string
}

export interface ItemDetail {
  number: string
  displayName: string
  type: string
  itemCategoryCode: string
  inventory: number
  unitCost: number
  unitPrice: number
  blocked: boolean
  baseUnitOfMeasureCode: string
  gtin: string
  lastModifiedDateTime: string
  generalProductPostingGroupCode: string
  inventoryPostingGroupCode: string
}

export interface LedgerEntry {
  entryNumber: number
  postingDate: string
  entryType: string
  sourceNumber: string
  sourceType: string
  documentNumber: string
  documentType: string
  description: string
  quantity: number
  salesAmountActual: number
  costAmountActual: number
}

export interface MonthlyMovement {
  month: string
  purchases_qty: number
  purchases_cost: number
  sales_qty: number
  sales_cost: number
  positive_adjustments_cost: number
  negative_adjustments_cost: number
  transfers_cost: number
}

export interface ItemDimension {
  dimensionCode: string
  dimensionValueCode: string
}

export interface ItemDetailData {
  item: ItemDetail
  ledgerEntries: LedgerEntry[]
  dimensions: ItemDimension[]
  movementByMonth: MonthlyMovement[]
  ledgerBasedValue: number
  totalPurchased: number
  totalSold: number
  netMovement: number
  firstTransaction: string | null
  lastTransaction: string | null
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch item detail')
  }
  return response.json()
}

export function useBCItemDetail(
  connectionId: string | null,
  itemNumber: string | null,
  dateRange?: DateRange
) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (itemNumber) params.set('itemNumber', itemNumber)
  if (dateRange?.startDate) params.set('startDate', dateRange.startDate)
  if (dateRange?.endDate) params.set('endDate', dateRange.endDate)
  const qs = params.toString()

  // Only fetch when both connectionId and itemNumber are present
  const url =
    connectionId && itemNumber ? `/api/providers/dynamics/inventory-item-detail?${qs}` : null

  const { data, isLoading, error } = useSWR(
    url ? ['bc-item-detail', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 2 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d: ItemDetailData | null = data?.data ?? null

  return {
    item: d?.item ?? null,
    ledgerEntries: d?.ledgerEntries ?? [],
    dimensions: d?.dimensions ?? [],
    movementByMonth: d?.movementByMonth ?? [],
    ledgerBasedValue: d?.ledgerBasedValue ?? null,
    totalPurchased: d?.totalPurchased ?? 0,
    totalSold: d?.totalSold ?? 0,
    netMovement: d?.netMovement ?? 0,
    firstTransaction: d?.firstTransaction ?? null,
    lastTransaction: d?.lastTransaction ?? null,
    isLoading,
    error,
  }
}
