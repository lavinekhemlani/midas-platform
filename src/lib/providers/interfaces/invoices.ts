// src/lib/providers/interfaces/invoices.ts

/**
 * Common query options that most providers support for listing operations
 */
export interface BaseQueryOptions {
  page?: number;
  per_page?: number;
  limit?: number;
  sort_column?: string;
  sort_order?: 'A' | 'D' | 'asc' | 'desc';
  date_start?: string;
  date_end?: string;
}

/**
 * Options for listing invoices across different providers
 */
export interface InvoiceListOptions extends BaseQueryOptions {
  customer_id?: string;
  status?: 'all' | 'sent' | 'draft' | 'overdue' | 'paid' | 'void' | 'unpaid' | 'viewed' | 'partially_paid';
  invoice_number?: string;
  reference_number?: string;
  search_text?: string;
}

/**
 * Standardized invoice statistics structure
 */
export interface InvoiceStatistics {
  total_invoices_count: number;
  total_invoices_amount: number;
  paid_invoices_count: number;
  paid_invoices_amount: number;
  unpaid_invoices_count: number;
  unpaid_invoices_amount: number;
  overdue_invoices_count: number;
  overdue_invoices_amount: number;
  draft_invoices_count: number;
  pending_invoices_count?: number;
  void_invoices_count?: number;
  partially_paid_count?: number;
}

/**
 * Invoice aging analysis structure
 */
export interface InvoiceAging {
  current: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  days_over_90: number;
}

/**
 * Generic invoice object structure that providers should map to
 */
export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  date: string;
  due_date: string;
  status: string;
  total: number;
  balance: number;
  currency_code: string;
  reference_number?: string;
  notes?: string;
  terms?: string;
  created_time?: string;
  last_modified_time?: string;
}

/**
 * Interface that all invoice providers must implement
 */
export interface InvoiceProvider {
  /**
   * List invoices with optional filtering
   * @param userOrgId - The organization ID
   * @param options - Filtering and pagination options
   * @returns Promise resolving to an array of invoices
   */
  listInvoices(userOrgId: string, options?: InvoiceListOptions): Promise<Invoice[]>;

  /**
   * Get detailed invoice by ID
   * @param userOrgId - The organization ID
   * @param invoiceId - The invoice ID
   * @returns Promise resolving to a single invoice
   */
  getInvoice(userOrgId: string, invoiceId: string): Promise<Invoice>;

  /**
   * Get invoice statistics for the organization
   * @param userOrgId - The organization ID
   * @param options - Date range options
   * @returns Promise resolving to invoice statistics
   */
  invoiceStatistics(userOrgId: string, options?: { date_start?: string; date_end?: string }): Promise<InvoiceStatistics>;

  /**
   * Get invoices for a specific customer
   * @param userOrgId - The organization ID
   * @param customerId - The customer ID
   * @param options - Additional filtering options
   * @returns Promise resolving to an array of invoices
   */
  getInvoicesByCustomer(userOrgId: string, customerId: string, options?: Omit<InvoiceListOptions, 'customer_id'>): Promise<Invoice[]>;

  /**
   * Get overdue invoices
   * @param userOrgId - The organization ID
   * @param options - Additional filtering options
   * @returns Promise resolving to an array of overdue invoices
   */
  getOverdueInvoices(userOrgId: string, options?: Omit<InvoiceListOptions, 'status'>): Promise<Invoice[]>;

  /**
   * Get unpaid invoices (includes sent and overdue)
   * @param userOrgId - The organization ID
   * @param options - Additional filtering options
   * @returns Promise resolving to an array of unpaid invoices
   */
  getUnpaidInvoices(userOrgId: string, options?: Omit<InvoiceListOptions, 'status'>): Promise<Invoice[]>;

  /**
   * Search invoices by text
   * @param userOrgId - The organization ID
   * @param searchText - Text to search for
   * @param options - Additional filtering options
   * @returns Promise resolving to an array of matching invoices
   */
  searchInvoices(userOrgId: string, searchText: string, options?: Omit<InvoiceListOptions, 'search_text'>): Promise<Invoice[]>;

  /**
   * Get recent invoices (last N days)
   * @param userOrgId - The organization ID
   * @param days - Number of days to look back (default: 30)
   * @param options - Additional filtering options
   * @returns Promise resolving to an array of recent invoices
   */
  getRecentInvoices(userOrgId: string, days?: number, options?: InvoiceListOptions): Promise<Invoice[]>;

  /**
   * Get invoice aging analysis
   * @param userOrgId - The organization ID
   * @returns Promise resolving to aging analysis data
   */
  getInvoiceAging(userOrgId: string): Promise<InvoiceAging>;
}
