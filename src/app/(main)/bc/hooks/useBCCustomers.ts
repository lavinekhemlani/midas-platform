'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

interface BCCustomer {
  id: string
  number: string
  displayName: string
  email?: string
  phoneNumber?: string
  balanceDue: number
  creditLimit?: number
  currencyCode?: string
}

interface BCAgedReceivable {
  customerId: string
  customerNumber: string
  name: string
  currencyCode?: string
  balanceDue: number
  currentAmount: number
  period1Label?: string
  period1Amount: number
  period2Label?: string
  period2Amount: number
  period3Label?: string
  period3Amount: number
  agedAsOfDate?: string
}

interface BCCustomerSummary {
  totalAR: number
  customerCount: number
  customersWithBalance: number
}

interface BCCustomersData {
  customers: BCCustomer[]
  agedReceivables: BCAgedReceivable[]
  agedReceivablesTotal: BCAgedReceivable | null
  summary: BCCustomerSummary
  companyName: string | null
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch BC customers')
  }
  return response.json()
}

export function useBCCustomers(connectionId: string | null) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  const qs = params.toString()
  const url = connectionId ? `/api/providers/dynamics/customers${qs ? `?${qs}` : ''}` : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-customers', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d: BCCustomersData | null = data?.data ?? null

  return {
    customers: d?.customers ?? [],
    agedReceivables: d?.agedReceivables ?? [],
    agedReceivablesTotal: d?.agedReceivablesTotal ?? null,
    summary: d?.summary ?? null,
    companyName: d?.companyName ?? null,
    isLoading,
    error,
    mutate,
  }
}
