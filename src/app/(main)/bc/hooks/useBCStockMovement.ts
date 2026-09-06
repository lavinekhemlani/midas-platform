'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'
import type { LedgerEntry } from './useBCLedgerEntries'

interface DateRange {
  startDate: string
  endDate: string
}

export interface ItemWeight {
  number: string
  displayName: string
  netWeight: number
  baseUnitOfMeasureCode: string
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch data')
  }
  return response.json()
}

/**
 * Fetches item ledger entries for stock movement report.
 * Makes two parallel calls (both V4 OData):
 *   1. Period entries (startDate..endDate) — for movement columns
 *   2. Prior entries (before startDate) — for opening balances
 * Item name and UOM are extracted from V4 ledger entries directly.
 */
export function useBCStockMovement(connectionId: string | null, dateRange?: DateRange) {
  const periodParams = new URLSearchParams()
  if (connectionId) periodParams.set('connectionId', connectionId)
  if (dateRange?.startDate) periodParams.set('startDate', dateRange.startDate)
  if (dateRange?.endDate) periodParams.set('endDate', dateRange.endDate)
  const periodUrl = connectionId
    ? `/api/providers/dynamics/ledger-entries?${periodParams.toString()}`
    : null

  const priorParams = new URLSearchParams()
  if (connectionId) priorParams.set('connectionId', connectionId)
  if (dateRange?.startDate) {
    const dayBefore = new Date(dateRange.startDate)
    dayBefore.setDate(dayBefore.getDate() - 1)
    priorParams.set('endDate', dayBefore.toISOString().split('T')[0])
  }
  const priorUrl =
    connectionId && dateRange?.startDate
      ? `/api/providers/dynamics/ledger-entries?${priorParams.toString()}`
      : null

  const {
    data: periodData,
    isLoading: periodLoading,
    error: periodError,
  } = useSWR(
    periodUrl ? ['bc-stock-movement-period', periodUrl] : null,
    () => fetcher(periodUrl!),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const {
    data: priorData,
    isLoading: priorLoading,
    error: priorError,
  } = useSWR(priorUrl ? ['bc-stock-movement-prior', priorUrl] : null, () => fetcher(priorUrl!), {
    dedupingInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
    errorRetryCount: 3,
  })

  const periodEntries: LedgerEntry[] = periodData?.data?.entries ?? []
  const priorEntries: LedgerEntry[] = priorData?.data?.entries ?? []
  const currency = periodData?.data?.currency ?? 'USD'

  // Build item weight map from V4 ledger entries (no V2 items call needed)
  const itemWeights = new Map<string, ItemWeight>()
  const allEntries = [...periodEntries, ...priorEntries]
  for (const entry of allEntries) {
    const num = entry.itemNumber
    if (num && !itemWeights.has(num)) {
      itemWeights.set(num, {
        number: num,
        displayName: entry.description || num,
        netWeight: 0,
        baseUnitOfMeasureCode: entry.unitOfMeasureCode || '',
      })
    }
  }

  return {
    periodEntries,
    priorEntries,
    itemWeights,
    currency,
    isLoading: periodLoading || priorLoading,
    error: periodError || priorError,
  }
}
