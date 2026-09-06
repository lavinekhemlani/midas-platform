'use client'

import useSWR from 'swr'
import type { MonthlyCashFlowByActivity } from '../cash-flow/components/CashFlowByActivityCard'

interface CashFlowByActivityResponse {
  data: {
    months: MonthlyCashFlowByActivity[]
    summary: { operating: number; investing: number; financing: number }
  }
  durationMs: number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function useBCOAuthCashFlowByActivity(
  connectionId: string,
  dateRange?: { startDate: string; endDate: string }
) {
  const params = new URLSearchParams()
  params.set('connectionId', connectionId)
  if (dateRange?.startDate) params.set('startDate', dateRange.startDate)
  if (dateRange?.endDate) params.set('endDate', dateRange.endDate)

  const { data, error, isLoading, mutate } = useSWR<CashFlowByActivityResponse>(
    `/api/providers/dynamics/cash-flow-by-activity?${params.toString()}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  )

  return {
    months: data?.data?.months ?? [],
    summary: data?.data?.summary ?? null,
    isLoading,
    error,
    mutate,
  }
}
