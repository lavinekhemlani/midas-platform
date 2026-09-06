'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

export interface BCVendorProfile {
  id: string
  number: string
  displayName: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  country: string
  postalCode: string
  phoneNumber: string
  email: string
  website: string
  taxRegistrationNumber: string
  currencyCode: string
  balance: number
  blocked: string
  taxLiable: boolean
  lastModifiedDateTime: string
  paymentTerms: {
    code: string
    displayName: string
    dueDateCalculation: string
    discountPercent: number
  } | null
  paymentMethod: {
    code: string
    displayName: string
  } | null
  currency: {
    code: string
    displayName: string
    symbol: string
  } | null
}

export interface BCPurchaseInvoice {
  id: string
  number: string
  invoiceDate: string
  postingDate: string
  dueDate: string
  vendorInvoiceNumber: string
  status: string
  currencyCode: string
  totalAmountExcludingTax: number
  totalTaxAmount: number
  totalAmountIncludingTax: number
  orderId?: string
  orderNumber?: string
  lastModifiedDateTime: string
}

export interface BCPurchaseOrder {
  id: string
  number: string
  orderDate: string
  postingDate: string
  status: string
  fullyReceived: boolean
  currencyCode: string
  totalAmountExcludingTax: number
  totalTaxAmount: number
  totalAmountIncludingTax: number
  lastModifiedDateTime: string
}

export interface BCPurchaseCreditMemo {
  id: string
  number: string
  creditMemoDate: string
  postingDate: string
  dueDate: string
  status: string
  currencyCode: string
  invoiceNumber: string
  totalAmountExcludingTax: number
  totalTaxAmount: number
  totalAmountIncludingTax: number
  lastModifiedDateTime: string
}

export interface BCPurchaseReceipt {
  id: string
  number: string
  postingDate: string
  orderNumber: string
  vendorName: string
  lastModifiedDateTime: string
}

export interface BCAgedPayableDetail {
  vendorId: string
  vendorNumber: string
  name: string
  currencyCode: string
  balanceDue: number
  currentAmount: number
  period1Amount: number
  period2Amount: number
  period3Amount: number
  agedAsOfDate: string
}

export interface BCVendorDetailSummary {
  totalInvoiced: number
  totalCreditMemos: number
  openOrders: number
  invoiceCount: number
  orderCount: number
  creditMemoCount: number
  receiptCount: number
}

interface BCVendorDetailData {
  vendor: BCVendorProfile
  invoices: BCPurchaseInvoice[]
  orders: BCPurchaseOrder[]
  creditMemos: BCPurchaseCreditMemo[]
  receipts: BCPurchaseReceipt[]
  agedPayable: BCAgedPayableDetail | null
  lcyCurrencyCode: string
  summary: BCVendorDetailSummary
  companyName: string | null
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch BC vendor detail')
  }
  return response.json()
}

export function useBCVendorDetail(connectionId: string | null, vendorId: string | null) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (vendorId) params.set('vendorId', vendorId)
  const qs = params.toString()
  const url =
    connectionId && vendorId ? `/api/providers/dynamics/vendor-detail${qs ? `?${qs}` : ''}` : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-vendor-detail', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d: BCVendorDetailData | null = data?.data ?? null

  return {
    vendor: d?.vendor ?? null,
    invoices: d?.invoices ?? [],
    orders: d?.orders ?? [],
    creditMemos: d?.creditMemos ?? [],
    receipts: d?.receipts ?? [],
    agedPayable: d?.agedPayable ?? null,
    lcyCurrencyCode: d?.lcyCurrencyCode ?? '',
    summary: d?.summary ?? null,
    companyName: d?.companyName ?? null,
    isLoading,
    error,
    mutate,
  }
}
