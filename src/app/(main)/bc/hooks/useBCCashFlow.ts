'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

interface DateRange {
  startDate: string
  endDate: string
}

interface BCCashFlowLine {
  lineNumber: number
  display: string
  netChange: number
  balance?: number
  lineType: string
  indentation: number
  _subCategory?: string
  _accountNumber?: string
  _isGrandTotal?: boolean
}

interface BCBankAccount {
  id: string
  number: string
  displayName: string
  bankAccountNumber?: string
  currencyCode?: string
}

interface CashFlowTotals {
  totalOperating: number
  totalInvesting: number
  totalFinancing: number
  netChange: number
  totalBalance?: number
}

interface BCCashFlowData {
  lines: BCCashFlowLine[]
  bankAccounts: BCBankAccount[]
  totals: CashFlowTotals
  companyName: string | null
  period: { startDate?: string; endDate?: string }
  source: 'cashFlowStatement' | 'trialBalance' | 'generalLedger'
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch BC cash flow statement')
  }
  return response.json()
}

export function useBCCashFlow(connectionId: string | null, dateRange?: DateRange) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (dateRange?.startDate) params.set('startDate', dateRange.startDate)
  if (dateRange?.endDate) params.set('endDate', dateRange.endDate)
  const qs = params.toString()
  const url = connectionId
    ? `/api/providers/dynamics/cash-flow-statement${qs ? `?${qs}` : ''}`
    : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-cash-flow', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d: BCCashFlowData | null = data?.data ?? null

  return {
    lines: d?.lines ?? [],
    bankAccounts: d?.bankAccounts ?? [],
    totals: d?.totals ?? null,
    companyName: d?.companyName ?? null,
    period: d?.period ?? null,
    source: d?.source ?? null,
    isLoading,
    error,
    mutate,
  }
}
