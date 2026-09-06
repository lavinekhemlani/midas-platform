'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

export interface BCSalesCustomer {
  customerNumber: string
  customerName: string
  invoiceCount: number
  creditMemoCount: number
  totalSales: number
  totalReturns: number
  netSales: number
  arBalance: number
}

export interface BCSalesTopCustomer {
  name: string
  total: number
  invoiceCount: number
}

export interface BCSalesInvoice {
  invoiceNumber: string
  customerNumber: string
  customerName: string
  postingDate: string
  amount: number
  status: string
}

export interface BCSalesByCustomerSummary {
  totalCustomers: number
  totalInvoices: number
  totalCreditMemos: number
  totalSales: number
  totalReturns: number
  netSales: number
  totalArBalance: number
}

interface BCSalesByCustomerData {
  customers: BCSalesCustomer[]
  topCustomers: BCSalesTopCustomer[]
  invoices: BCSalesInvoice[]
  summary: BCSalesByCustomerSummary
  creditMemos: { available: boolean; error: string | null; count: number }
  companyName: string | null
  period: { startDate: string | null; endDate: string | null }
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch BC sales by customer')
  }
  return response.json()
}

export function useBCSalesByCustomer(
  connectionId: string | null,
  startDate?: string,
  endDate?: string
) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const qs = params.toString()
  const url = connectionId ? `/api/providers/dynamics/sales-by-customer${qs ? `?${qs}` : ''}` : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-sales-by-customer', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d: BCSalesByCustomerData | null = data?.data ?? null

  return {
    customers: d?.customers ?? [],
    topCustomers: d?.topCustomers ?? [],
    invoices: d?.invoices ?? [],
    summary: d?.summary ?? null,
    creditMemos: d?.creditMemos ?? null,
    companyName: d?.companyName ?? null,
    period: d?.period ?? null,
    isLoading,
    error,
    mutate,
  }
}
