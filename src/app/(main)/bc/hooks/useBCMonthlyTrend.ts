'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'
import type { MonthlyPnLTrendRow } from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'

interface DateRange {
  startDate: string
  endDate: string
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch monthly P&L trend')
  }
  return response.json()
}

export function useBCMonthlyTrend(connectionId: string | null, dateRange?: DateRange) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (dateRange?.startDate) params.set('startDate', dateRange.startDate)
  if (dateRange?.endDate) params.set('endDate', dateRange.endDate)
  const qs = params.toString()
  const url = connectionId ? `/api/providers/dynamics/monthly-pnl-trend${qs ? `?${qs}` : ''}` : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-monthly-trend', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d = data?.data ?? null

  return {
    months: (d?.months ?? []) as MonthlyPnLTrendRow[],
    currency: d?.currency,
    companyName: d?.companyName ?? null,
    glEntryCount: d?.glEntryCount ?? 0,
    isLoading,
    error,
    mutate,
  }
}
