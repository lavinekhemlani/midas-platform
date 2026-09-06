// src/lib/providers/interfaces/payments.ts
import { BaseQueryOptions } from './invoices';

/**
 * Options for listing payments across different providers
 */
export interface PaymentListOptions extends BaseQueryOptions {
  customer_id?: string;
  payment_mode?: string;
  reference_number?: string;
  amount?: number;
  amount_less_than?: number;
  amount_less_equals?: number;
  amount_greater_than?: number;
  amount_greater_equals?: number;
}

/**
 * Generic payment structure that providers should map to
 */
export interface Payment {
  payment_id: string;
  payment_number: string;
  payment_mode: string;
  date: string;
  amount: number;
  bank_charges?: number;
  exchange_rate?: number;
  currency_code: string;
  reference_number?: string;
  description?: string;
  customer_id: string;
  customer_name: string;
  account_id?: string;
  account_name?: string;
  invoices?: Array<{
    invoice_id: string;
    invoice_number: string;
    invoice_date: string;
    invoice_amount: number;
    amount_applied: number;
    balance_amount: number;
  }>;
  created_time: string;
  last_modified_time: string;
}

/**
 * Interface that all payment providers must implement
 */
export interface PaymentProvider {
  /**
   * List payments with optional filtering
   * @param userOrgId - The organization ID
   * @param options - Filtering and pagination options
   * @returns Promise resolving to an array of payments
   */
  listPayments(userOrgId: string, options?: PaymentListOptions): Promise<Payment[]>;

  /**
   * Get payment details
   * @param userOrgId - The organization ID
   * @param paymentId - The payment ID
   * @returns Promise resolving to a single payment
   */
  getPayment(userOrgId: string, paymentId: string): Promise<Payment>;
}
