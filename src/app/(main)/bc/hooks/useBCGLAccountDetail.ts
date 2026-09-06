'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

export interface GLAccountInfo {
  number: string
  displayName: string
  category: string
  subCategory: string
  accountType: string
  blocked: boolean
}

export interface GLEntry {
  entryNumber: number
  postingDate: string
  documentNumber: string
  documentType: string
  description: string
  debitAmount: number
  creditAmount: number
  netAmount: number
}

export interface GLDocTypeSummary {
  type: string
  count: number
  totalDebit: number
  totalCredit: number
}

export interface GLAccountSummary {
  entryCount: number
  totalDebit: number
  totalCredit: number
  netAmount: number
  byDocumentType: GLDocTypeSummary[]
}

interface GLAccountDetailData {
  account: GLAccountInfo | null
  entries: GLEntry[]
  currency: string
  period: { startDate: string | null; endDate: string | null }
  summary: GLAccountSummary
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch GL account detail')
  }
  return response.json()
}

export function useBCGLAccountDetail(
  connectionId: string | null,
  accountNumber: string | null,
  dateRange?: { startDate?: string; endDate?: string }
) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (accountNumber) params.set('accountNumber', accountNumber)
  if (dateRange?.startDate) params.set('startDate', dateRange.startDate)
  if (dateRange?.endDate) params.set('endDate', dateRange.endDate)
  const qs = params.toString()

  const url =
    connectionId && accountNumber ? `/api/providers/dynamics/gl-account-detail?${qs}` : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-gl-account-detail', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 2 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d: GLAccountDetailData | null = data?.data ?? null

  return {
    account: d?.account ?? null,
    entries: d?.entries ?? [],
    currency: d?.currency ?? 'USD',
    period: d?.period ?? null,
    summary: d?.summary ?? null,
    isLoading,
    error,
    mutate,
  }
}
