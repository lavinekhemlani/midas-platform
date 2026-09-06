// src/lib/providers/interfaces/customers.ts
import { BaseQueryOptions } from './invoices';

/**
 * Options for listing customers across different providers
 */
export interface CustomerListOptions extends BaseQueryOptions {
  contact_type?: 'customer' | 'vendor' | 'all';
  contact_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  payment_terms?: string;
  payment_terms_label?: string;
  outstanding_receivable_amount_equals?: number;
  outstanding_receivable_amount_less_than?: number;
  outstanding_receivable_amount_less_equals?: number;
  outstanding_receivable_amount_greater_than?: number;
  outstanding_receivable_amount_greater_equals?: number;
}

/**
 * Generic customer structure that providers should map to
 */
export interface Customer {
  contact_id: string;
  contact_name: string;
  company_name?: string;
  contact_type: 'customer' | 'vendor';
  status: 'active' | 'inactive';
  payment_terms: number;
  payment_terms_label: string;
  currency_code: string;
  outstanding_receivable_amount: number;
  unused_credits_receivable_amount: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  credit_limit?: number;
  notes?: string;
  billing_address?: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  shipping_address?: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  created_time: string;
  last_modified_time: string;
}

/**
 * Customer statistics data structure
 */
export interface CustomerStatistics {
  total_customers: number;
  active_customers: number;
  total_receivables: number;
  overdue_amount: number;
  average_payment_days: number;
  customers_with_overdue: number;
}

/**
 * Customer analytics data structure
 */
export interface CustomerAnalytics {
  customer_id: string;
  customer_name: string;
  total_invoiced: number;
  total_paid: number;
  outstanding_balance: number;
  average_invoice_value: number;
  average_payment_days: number;
  payment_behavior: 'excellent' | 'good' | 'fair' | 'poor';
  lifetime_value: number;
  last_payment_date?: string;
  overdue_invoices: number;
  credit_utilization: number;
}

/**
 * Top customer by revenue data structure
 */
export interface TopCustomerByRevenue {
  customer: Customer;
  revenue: number;
  invoice_count: number;
  last_invoice_date: string;
}

/**
 * Customer credit alert data structure
 */
export interface CustomerCreditAlert {
  customer: Customer;
  credit_limit: number;
  outstanding: number;
  utilization_percentage: number;
  available_credit: number;
}

/**
 * Customer payment patterns data structure
 */
export interface CustomerPaymentPatterns {
  average_days_to_pay: number;
  on_time_payment_rate: number;
  early_payment_rate: number;
  late_payment_rate: number;
  monthly_pattern: Array<{
    month: string;
    invoices_sent: number;
    invoices_paid: number;
    average_days: number;
    total_amount: number;
  }>;
}

/**
 * Interface that all customer providers must implement
 */
export interface CustomerProvider {
  /**
   * List customers with optional filtering
   * @param userOrgId - The organization ID
   * @param options - Filtering and pagination options
   * @returns Promise resolving to an array of customers
   */
  listCustomers(userOrgId: string, options?: CustomerListOptions): Promise<Customer[]>;

  /**
   * Get customer details
   * @param userOrgId - The organization ID
   * @param customerId - The customer ID
   * @returns Promise resolving to a single customer
   */
  getCustomer(userOrgId: string, customerId: string): Promise<Customer>;

  /**
   * Get customer statistics
   * @param userOrgId - The organization ID
   * @returns Promise resolving to customer statistics
   */
  getCustomerStatistics(userOrgId: string): Promise<CustomerStatistics>;

  /**
   * Get customer analytics
   * @param userOrgId - The organization ID
   * @param customerId - Optional specific customer ID
   * @param options - Options including limit
   * @returns Promise resolving to customer analytics data
   */
  getCustomerAnalytics(userOrgId: string, customerId?: string, options?: { limit?: number }): Promise<CustomerAnalytics[]>;

  /**
   * Get top customers by revenue
   * @param userOrgId - The organization ID
   * @param limit - Number of top customers to return (default: 10)
   * @param options - Date range options
   * @returns Promise resolving to top customers data
   */
  getTopCustomersByRevenue(userOrgId: string, limit?: number, options?: { date_start?: string; date_end?: string }): Promise<TopCustomerByRevenue[]>;

  /**
   * Get customers with credit limit alerts
   * @param userOrgId - The organization ID
   * @param threshold - Credit utilization threshold percentage (default: 80)
   * @returns Promise resolving to customers with credit alerts
   */
  getCustomersWithCreditAlerts(userOrgId: string, threshold?: number): Promise<CustomerCreditAlert[]>;

  /**
   * Get customer payment patterns
   * @param userOrgId - The organization ID
   * @param customerId - The customer ID
   * @param months - Number of months to analyze (default: 12)
   * @returns Promise resolving to payment patterns data
   */
  getCustomerPaymentPatterns(userOrgId: string, customerId: string, months?: number): Promise<CustomerPaymentPatterns>;

  /**
   * Search customers by text
   * @param userOrgId - The organization ID
   * @param searchText - Text to search for
   * @param options - Additional filtering options
   * @returns Promise resolving to an array of matching customers
   */
  searchCustomers(userOrgId: string, searchText: string, options?: Omit<CustomerListOptions, 'contact_name'>): Promise<Customer[]>;
}
