'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

export interface CustomerDetailCustomer {
  number: string
  displayName: string
  email: string
  phoneNumber: string
  balanceDue: number
  creditLimit: number
  currencyCode: string
}

export interface CustomerDetailInvoice {
  id: string
  number: string
  postingDate: string
  dueDate: string
  currencyCode: string
  amount: number
  remainingAmount: number
  status: string
  orderNumber?: string
}

export interface CustomerDetailCreditMemo {
  id: string
  number: string
  postingDate: string
  currencyCode: string
  amount: number
  invoiceNumber?: string
}

export interface CustomerDetailShipment {
  id: string
  number: string
  postingDate: string
  orderNumber: string
}

export interface CustomerDetailAgedAR {
  balanceDue: number
  currentAmount: number
  period1Amount: number
  period2Amount: number
  period3Amount: number
  agedAsOfDate: string
}

export interface CustomerDetailSummary {
  totalInvoiced: number
  totalCredited: number
  netInvoiceSales: number
  totalRemaining: number
  invoiceCount: number
  creditMemoCount: number
  shipmentCount: number
}

interface CustomerDetailData {
  customer: CustomerDetailCustomer | null
  invoices: CustomerDetailInvoice[]
  creditMemos: CustomerDetailCreditMemo[]
  shipments: CustomerDetailShipment[]
  lcyCurrencyCode: string
  agedReceivable: CustomerDetailAgedAR | null
  summary: CustomerDetailSummary
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch customer detail')
  }
  return response.json()
}

export function useBCCustomerDetail(
  connectionId: string | null,
  customerIdentifier: string | null,
  identifierType: 'customerNumber' | 'customerId' = 'customerNumber'
) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (customerIdentifier) params.set(identifierType, customerIdentifier)
  const qs = params.toString()

  const url =
    connectionId && customerIdentifier ? `/api/providers/dynamics/customer-detail?${qs}` : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-customer-detail', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 2 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d: CustomerDetailData | null = data?.data ?? null

  return {
    customer: d?.customer ?? null,
    invoices: d?.invoices ?? [],
    creditMemos: d?.creditMemos ?? [],
    shipments: d?.shipments ?? [],
    lcyCurrencyCode: d?.lcyCurrencyCode ?? '',
    agedReceivable: d?.agedReceivable ?? null,
    summary: d?.summary ?? null,
    isLoading,
    error,
    mutate,
  }
}
