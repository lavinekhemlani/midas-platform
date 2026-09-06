'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

interface BCVendor {
  id: string
  number: string
  displayName: string
  email?: string
  phoneNumber?: string
  balance: number
  currencyCode?: string
}

interface BCAgedPayable {
  vendorId: string
  vendorNumber: string
  name: string
  currencyCode?: string
  balanceDue: number
  currentAmount: number
  period1Amount: number
  period2Amount: number
  period3Amount: number
  agedAsOfDate?: string
}

interface BCVendorSummary {
  totalAP: number
  vendorCount: number
  vendorsWithBalance: number
}

interface BCVendorsData {
  vendors: BCVendor[]
  agedPayables: BCAgedPayable[]
  agedPayablesTotal: BCAgedPayable | null
  summary: BCVendorSummary
  companyName: string | null
  lcyCurrencyCode: string
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch BC vendors')
  }
  return response.json()
}

export function useBCVendors(connectionId: string | null) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  const qs = params.toString()
  const url = connectionId ? `/api/providers/dynamics/vendors${qs ? `?${qs}` : ''}` : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-vendors', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d: BCVendorsData | null = data?.data ?? null

  return {
    vendors: d?.vendors ?? [],
    agedPayables: d?.agedPayables ?? [],
    agedPayablesTotal: d?.agedPayablesTotal ?? null,
    summary: d?.summary ?? null,
    companyName: d?.companyName ?? null,
    lcyCurrencyCode: d?.lcyCurrencyCode ?? '',
    isLoading,
    error,
    mutate,
  }
}
