'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'
import type { CashFlowStatementData } from '../cash-flow/components/CashFlowStatementCard'

interface DateRange {
  startDate: string
  endDate: string
}

interface CashFlowIndirectResponse {
  data: {
    statement: CashFlowStatementData
    period: { startDate?: string; endDate?: string }
    companyName: string | null
    classification: {
      cashAccounts: number
      operatingAccounts: number
      investingAccounts: number
      financingAccounts: number
      skippedAccounts: number
      totalGLEntries: number
    }
  }
}

const fetcher = async (url: string): Promise<CashFlowIndirectResponse | null> => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch BC indirect cash flow statement')
  }
  return response.json()
}

/**
 * Hook for the proper indirect-method Cash Flow Statement via BC OAuth API.
 * Returns Operating/Investing/Financing activities breakdown matching the
 * warehouse CashFlowStatementData shape, so it can be displayed using the
 * same CashFlowStatementCard component.
 */
export function useBCOAuthCashFlowStatement(connectionId: string | null, dateRange?: DateRange) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (dateRange?.startDate) params.set('startDate', dateRange.startDate)
  if (dateRange?.endDate) params.set('endDate', dateRange.endDate)
  const qs = params.toString()
  const url = connectionId
    ? `/api/providers/dynamics/cash-flow-indirect${qs ? `?${qs}` : ''}`
    : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-cf-indirect', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  return {
    statement: data?.data?.statement ?? null,
    companyName: data?.data?.companyName ?? null,
    period: data?.data?.period ?? null,
    classification: data?.data?.classification ?? null,
    isLoading,
    error,
    mutate,
  }
}
