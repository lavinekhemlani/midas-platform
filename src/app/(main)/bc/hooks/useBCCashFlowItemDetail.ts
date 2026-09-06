'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

interface AccountBreakdownEntry {
  number: string
  name: string
  debit: number
  credit: number
  net: number
  entryCount: number
}

interface MonthlyPoint {
  month: string
  amount: number
}

interface Transaction {
  postingDate: string
  accountNumber: string
  documentNumber: string
  documentType: string
  description: string
  debitAmount: number
  creditAmount: number
}

export interface CashFlowItemDetailData {
  itemType: string
  label: string
  category: string
  totalDebit: number
  totalCredit: number
  netAmount: number
  accountBreakdown: AccountBreakdownEntry[]
  monthlyTrend: MonthlyPoint[]
  recentTransactions: Transaction[]
  transactionCount: number
  subLedger: {
    type: 'receivables' | 'payables' | 'inventory' | null
    data: any[]
  }
  currency: string
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch cash flow item detail')
  }
  return response.json()
}

export function useBCCashFlowItemDetail(
  connectionId: string | null,
  itemType: string | null,
  startDate?: string,
  endDate?: string
) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (itemType) params.set('itemType', itemType)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const qs = params.toString()

  const url = connectionId && itemType ? `/api/providers/dynamics/cashflow-item-detail?${qs}` : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-cashflow-item-detail', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 2 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d: CashFlowItemDetailData | null = data?.data ?? null

  return {
    label: d?.label ?? null,
    category: d?.category ?? null,
    totalDebit: d?.totalDebit ?? 0,
    totalCredit: d?.totalCredit ?? 0,
    netAmount: d?.netAmount ?? 0,
    accountBreakdown: d?.accountBreakdown ?? [],
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
