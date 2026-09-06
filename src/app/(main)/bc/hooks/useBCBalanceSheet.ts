'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

interface BCBalanceSheetLine {
  lineNumber: number
  display: string
  balance: number
  lineType: string
  indentation: number
  _category?: string
  _subCategory?: string
  _accountNumber?: string
}

interface BSTotals {
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  netIncome: number
}

interface BCBalanceSheetData {
  lines: BCBalanceSheetLine[]
  totals: BSTotals
  companyName: string | null
  currency: string
  asOfDate: string | null
  source: string
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch BC balance sheet')
  }
  return response.json()
}

export function useBCBalanceSheet(connectionId: string | null, endDate?: string) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (endDate) params.set('endDate', endDate)
  const qs = params.toString()
  const url = connectionId
    ? `/api/providers/dynamics/balance-sheet-test?mode=bs${qs ? `&${qs}` : ''}`
    : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-balance-sheet', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d: BCBalanceSheetData | null = data?.data ?? null

  return {
    lines: d?.lines ?? [],
    totals: d?.totals ?? null,
    companyName: d?.companyName ?? null,
    currency: d?.currency,
    asOfDate: d?.asOfDate ?? null,
    source: d?.source ?? null,
    isLoading,
    error,
    mutate,
  }
}
