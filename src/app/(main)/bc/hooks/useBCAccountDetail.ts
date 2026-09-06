'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

interface FlowMetrics {
  opening: number
  inflows: number
  outflows: number
  closing: number
}

interface MonthlyPoint {
  month: string
  balance: number
}

interface Transaction {
  postingDate: string
  documentNumber: string
  documentType: string
  description: string
  debitAmount: number
  creditAmount: number
}

interface SubLedgerEntry {
  name?: string
  number?: string
  balanceDue?: number
  currentAmount?: number
  period1Amount?: number
  period2Amount?: number
  period3Amount?: number
  quantity?: number
  unitCost?: number
  totalValue?: number
  category?: string
  displayName?: string
  bankAccountNumber?: string
  currencyCode?: string
}

export interface AccountDetailData {
  accountNumber: string
  category: string
  subCategory: string
  flow: FlowMetrics
  monthlyTrend: MonthlyPoint[]
  recentTransactions: Transaction[]
  transactionCount: number
  subLedger: {
    type: 'bank' | 'receivables' | 'payables' | 'inventory' | null
    data: SubLedgerEntry[]
  }
  currency: string
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch account detail')
  }
  return response.json()
}

export function useBCAccountDetail(
  connectionId: string | null,
  accountNumber: string | null,
  startDate?: string,
  endDate?: string,
  category?: string,
  subCategory?: string
) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (accountNumber) params.set('accountNumber', accountNumber)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  if (category) params.set('category', category)
  if (subCategory) params.set('subCategory', subCategory)
  const qs = params.toString()

  const url = connectionId && accountNumber ? `/api/providers/dynamics/account-detail?${qs}` : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-account-detail', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 2 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d: AccountDetailData | null = data?.data ?? null

  return {
    flow: d?.flow ?? null,
    monthlyTrend: d?.monthlyTrend ?? [],
    recentTransactions: d?.recentTransactions ?? [],
    transactionCount: d?.transactionCount ?? 0,
    subLedger: d?.subLedger ?? { type: null, data: [] },
    currency: d?.currency ?? 'USD',
    isLoading,
    error,
    mutate,
  }
}
