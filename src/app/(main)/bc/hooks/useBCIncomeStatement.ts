'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

interface DateRange {
  startDate: string
  endDate: string
}

interface BCIncomeStatementLine {
  lineNumber: number
  display: string
  netChange: number
  lineType: string
  indentation: number
  _category?: string
  _subCategory?: string
  _accountNumber?: string
}

interface PnLTotals {
  totalRevenue: number
  totalCOGS: number
  grossProfit: number
  totalExpenses: number
  operatingExpenses: number
  operatingIncome: number
  netIncome: number
  interestExpense: number
  taxExpense: number
  depreciationAmortization: number
  ebitda: number
}

interface BCIncomeStatementData {
  lines: BCIncomeStatementLine[]
  totals: PnLTotals
  companyName: string | null
  currency: string
  period: { startDate?: string; endDate?: string }
  source: 'incomeStatement' | 'trialBalance' | 'gl-entries' | 'accounts-all-time'
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch BC income statement')
  }
  return response.json()
}

export function useBCIncomeStatement(connectionId: string | null, dateRange?: DateRange) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (dateRange?.startDate) params.set('startDate', dateRange.startDate)
  if (dateRange?.endDate) params.set('endDate', dateRange.endDate)
  const qs = params.toString()
  const url = connectionId
    ? `/api/providers/dynamics/income-statement-test?mode=pnl${qs ? `&${qs}` : ''}`
    : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-income-statement', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d: BCIncomeStatementData | null = data?.data ?? null

  return {
    lines: d?.lines ?? [],
    totals: d?.totals ?? null,
    companyName: d?.companyName ?? null,
    currency: d?.currency,
    period: d?.period ?? null,
    source: d?.source ?? null,
    isLoading,
    error,
    mutate,
  }
}
