'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

interface MonthlyPoint {
  month: string
  inflow: number
  outflow: number
  net: number
}

interface Transaction {
  postingDate: string
  documentNumber: string
  documentType: string
  description: string
  debitAmount: number
  creditAmount: number
}

interface Counterparty {
  name: string
  debit: number
  credit: number
  count: number
}

export interface BankAccountDetailData {
  accountNumber: string
  accountName: string
  category: string
  subCategory: string
  balance: number
  totalDebit: number
  totalCredit: number
  netAmount: number
  transactionCount: number
  monthlyTrend: MonthlyPoint[]
  transactions: Transaction[]
  topCounterparties: Counterparty[]
  currency: string
  period: { startDate?: string; endDate?: string }
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch bank account detail')
  }
  return response.json()
}

export function useBCBankAccountDetail(
  connectionId: string | null,
  accountNumber: string | null,
  startDate?: string,
  endDate?: string
) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (accountNumber) params.set('accountNumber', accountNumber)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const qs = params.toString()

  const url =
    connectionId && accountNumber ? `/api/providers/dynamics/bank-account-detail?${qs}` : null

  const { data, isLoading, error } = useSWR(
    url ? ['bc-bank-account-detail', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 2 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d: BankAccountDetailData | null = data?.data ?? null

  return {
    data: d,
    isLoading,
    error,
  }
}
