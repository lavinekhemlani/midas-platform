'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

export interface BCDocumentLine {
  id: string
  sequence: number
  lineType: string // Comment, Account, Item, Resource, Fixed Asset, Charge
  lineObjectNumber: string
  description: string
  description2?: string
  quantity: number
  unitCost?: number
  directUnitCost?: number
  unitOfMeasureCode: string
  discountAmount?: number
  discountPercent?: number
  amountExcludingTax: number
  amountIncludingTax: number
  totalTaxAmount?: number
  netAmount?: number
  netAmountIncludingTax?: number
  taxCode?: string
  taxPercent?: number
  // Purchase order fulfillment fields
  receivedQuantity?: number
  invoicedQuantity?: number
  receiveQuantity?: number
  invoiceQuantity?: number
  expectedReceiptDate?: string
  // Sales-specific fields
  unitPrice?: number
  shippedQuantity?: number
  shipmentDate?: string
  itemId?: string
  accountId?: string
}

type DocumentType =
  | 'invoice'
  | 'order'
  | 'creditMemo'
  | 'receipt'
  | 'salesInvoice'
  | 'salesCreditMemo'
  | 'salesShipment'

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch document lines')
  }
  return response.json()
}

export function useBCDocumentLines(
  connectionId: string | null,
  documentType: DocumentType | null,
  documentId: string | null
) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (documentType) params.set('documentType', documentType)
  if (documentId) params.set('documentId', documentId)
  const qs = params.toString()
  const url =
    connectionId && documentType && documentId
      ? `/api/providers/dynamics/document-lines${qs ? `?${qs}` : ''}`
      : null

  const { data, isLoading, error } = useSWR(
    url ? ['bc-doc-lines', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  return {
    lines: (data?.data?.lines ?? []) as BCDocumentLine[],
    isLoading,
    error,
  }
}
