'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

interface DateRange {
  startDate: string
  endDate: string
}

export interface CountrySalesRow {
  country: string
  totalAmount: number
  invoiceCount: number
  customerCount: number
  inferredCount: number
  cities: string[]
}

export interface CitySalesRow {
  city: string
  country: string
  state: string
  totalAmount: number
  invoiceCount: number
  customerCount: number
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch sales geography')
  }
  return response.json()
}

export function useBCSalesGeography(connectionId: string | null, dateRange?: DateRange) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (dateRange?.startDate) params.set('startDate', dateRange.startDate)
  if (dateRange?.endDate) params.set('endDate', dateRange.endDate)
  const qs = params.toString()
  const url = connectionId ? `/api/providers/dynamics/sales-geography${qs ? `?${qs}` : ''}` : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-sales-geography', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d = data?.data ?? null

  return {
    byCountry: (d?.byCountry ?? []) as CountrySalesRow[],
    byCity: (d?.byCity ?? []) as CitySalesRow[],
    totalInvoices: (d?.totalInvoices ?? 0) as number,
    totalAmount: (d?.totalAmount ?? 0) as number,
    isLoading,
    error,
    mutate,
  }
}
