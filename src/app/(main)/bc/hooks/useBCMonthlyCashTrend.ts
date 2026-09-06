'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

interface DateRange {
  startDate: string
  endDate: string
}

export interface CashTrendAccountRow {
  accountNumber: string
  accountName: string
  inflow: number
  outflow: number
  netChange: number
}

export interface MonthlyCashTrendRow {
  month: string
  inflow: number
  outflow: number
  netChange: number
  runningBalance: number
  accounts?: CashTrendAccountRow[]
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch monthly cash trend')
  }
  return response.json()
}

export function useBCMonthlyCashTrend(connectionId: string | null, dateRange?: DateRange) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (dateRange?.startDate) params.set('startDate', dateRange.startDate)
  if (dateRange?.endDate) params.set('endDate', dateRange.endDate)
  const qs = params.toString()
  const url = connectionId
    ? `/api/providers/dynamics/monthly-cash-trend${qs ? `?${qs}` : ''}`
    : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-monthly-cash-trend', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d = data?.data ?? null

  return {
    months: (d?.months ?? []) as MonthlyCashTrendRow[],
    currency: d?.currency,
    companyName: d?.companyName ?? null,
    cashBalance: d?.cashBalance ?? 0,
    glEntryCount: d?.glEntryCount ?? 0,
    isLoading,
    error,
    mutate,
  }
}
