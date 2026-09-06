// src/lib/providers/zoho/payments.ts
import { providerFetch, providerFetchAll, withRetry, QueryOptions } from '../core'
import { ProviderApiClient } from '../apiClient'

export interface PaymentListOptions extends QueryOptions {
  customer_id?: string
  payment_mode?: string
  reference_number?: string
  amount?: number
  amount_less_than?: number
  amount_less_equals?: number
  amount_greater_than?: number
  amount_greater_equals?: number
}

export interface Payment {
  payment_id: string
  payment_number: string
  payment_mode: string
  date: string
  amount: number
  bank_charges?: number
  exchange_rate?: number
  currency_code: string
  reference_number?: string
  description?: string
  customer_id: string
  customer_name: string
  account_id?: string
  account_name?: string
  invoices?: Array<{
    invoice_id: string
    invoice_number: string
    invoice_date: string
    invoice_amount: number
    amount_applied: number
    balance_amount: number
  }>
  created_time: string
  last_modified_time: string
}

/**
 * List payments
 */
export async function listPayments(
  userOrgId: string,
  options: PaymentListOptions = {},
  apiClient?: ProviderApiClient
): Promise<Payment[]> {
  if (!apiClient) {
    throw new Error('API client is required for listPayments');
  }
  return withRetry(async () => {
    if (options.per_page && options.per_page > 200) {
      return providerFetchAll(apiClient, 'zoho', userOrgId, '/customerpayments', options)
    }
    
    const response = await providerFetch<{ customerpayments: Payment[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/customerpayments',
      options
    )
    
    return response.customerpayments || []
  })
}

/**
 * Get payment details
 */
export async function getPayment(
  userOrgId: string,
  paymentId: string,
  apiClient?: ProviderApiClient
): Promise<Payment> {
  if (!apiClient) {
    throw new Error('API client is required for getPayment');
  }
  return withRetry(async () => {
    const response = await providerFetch<{ payment: Payment }>(
      apiClient,
      'zoho',
      userOrgId,
      `/customerpayments/${paymentId}`,
      {}
    )
    
    return response.payment
  })
}