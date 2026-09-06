'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

interface DateRange {
  startDate: string
  endDate: string
}

export interface LedgerEntry {
  entryNumber: number
  itemNumber: string
  postingDate: string
  entryType: string
  documentNumber: string
  documentType: string
  description: string
  quantity: number
  remainingQuantity: number
  costAmountActual: number
  salesAmountActual: number
  sourceNumber: string
  sourceType: string
  locationCode: string
  lotNo: string
  unitOfMeasureCode: string
  open: boolean
}

export interface LedgerSummary {
  totalEntries: number
  purchases: { quantity: number; cost: number }
  sales: { quantity: number; cost: number }
  adjustments: { quantity: number; cost: number }
}

interface LedgerEntriesData {
  entries: LedgerEntry[]
  summary: LedgerSummary
  currency: string
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch ledger entries')
  }
  return response.json()
}

export function useBCLedgerEntries(connectionId: string | null, dateRange?: DateRange) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (dateRange?.startDate) params.set('startDate', dateRange.startDate)
  if (dateRange?.endDate) params.set('endDate', dateRange.endDate)
  const qs = params.toString()
  const url = connectionId ? `/api/providers/dynamics/ledger-entries${qs ? `?${qs}` : ''}` : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-ledger-entries', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d: LedgerEntriesData | null = data?.data ?? null

  return {
    entries: d?.entries ?? [],
    summary: d?.summary ?? {
      totalEntries: 0,
      purchases: { quantity: 0, cost: 0 },
      sales: { quantity: 0, cost: 0 },
      adjustments: { quantity: 0, cost: 0 },
    },
    currency: d?.currency,
    isLoading,
    error,
    mutate,
  }
}
