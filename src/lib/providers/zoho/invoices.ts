// src/lib/providers/zoho/invoices.ts
import { providerFetch, providerFetchAll, withRetry, QueryOptions } from '../core'
import { ProviderApiClient } from '../apiClient'
import { ProviderID } from '../database'

export interface InvoiceListOptions extends QueryOptions {
  customer_id?: string
  status?: 'all' | 'sent' | 'draft' | 'overdue' | 'paid' | 'void' | 'unpaid'
  invoice_number?: string
  reference_number?: string
  search_text?: string
}

export interface InvoiceStatistics {
  total_invoices_count: number
  total_invoices_amount: number
  paid_invoices_count: number
  paid_invoices_amount: number
  unpaid_invoices_count: number
  unpaid_invoices_amount: number
  overdue_invoices_count: number
  overdue_invoices_amount: number
  draft_invoices_count: number
  pending_invoices_count: number
}

/**
 * List invoices with optional filtering
 * Reference: https://www.zoho.com/books/api/v3/invoices/#list-invoices
 */
export async function listInvoices(
  userOrgId: string,
  options: InvoiceListOptions = {},
  apiClient?: ProviderApiClient
): Promise<any[]> {
  if (!apiClient) {
    throw new Error('API client is required for listInvoices');
  }

  return withRetry(async () => {
    if (options.per_page && options.per_page > 200) {
      // Use pagination for large requests
      return providerFetchAll(apiClient, 'zoho', userOrgId, '/invoices', options)
    }
    
    const response = await providerFetch<{ invoices: any[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/invoices',
      options
    )
    
    return response.invoices || []
  })
}

/**
 * Get detailed invoice by ID
 * Reference: https://www.zoho.com/books/api/v3/invoices/#get-an-invoice
 */
export async function getInvoice(
  userOrgId: string,
  invoiceId: string,
  apiClient?: ProviderApiClient
): Promise<any> {
  if (!apiClient) {
    throw new Error('API client is required for getInvoice');
  }

  return withRetry(async () => {
    const response = await providerFetch<{ invoice: any }>(
      apiClient,
      'zoho',
      userOrgId,
      `/invoices/${invoiceId}`,
      {}
    )
    
    return response.invoice
  })
}

/**
 * Get invoice statistics
 * Reference: https://www.zoho.com/books/api/v3/invoices/#invoice-statistics
 */

export async function invoiceStatistics(
  organizationId: string,
  options?: {
    date_start?: string;
    date_end?: string;
  },
  apiClient?: ProviderApiClient
): Promise<any> { // Using 'any' for now, you can define a proper type later
  if (!apiClient) {
    throw new Error('API client is required for invoiceStatistics');
  }

  // Zoho doesn't have a dedicated statistics endpoint
  // We need to calculate statistics from the invoices list
  const queryOptions = {
    per_page: 500,
    ...(options?.date_start && { date_start: options.date_start }),
    ...(options?.date_end && { date_end: options.date_end })
  };

  const response = await providerFetch<{ invoices: any[] }>(
    apiClient,
    'zoho',
    organizationId,
    '/invoices',
    queryOptions
  );
  const invoices = response.invoices || [];

  // Calculate statistics from the invoices
  const statistics = {
    total: invoices.length,
    sent: invoices.filter((inv: any) => inv.status === 'sent').length,
    viewed: invoices.filter((inv: any) => inv.status === 'viewed').length,
    paid: invoices.filter((inv: any) => inv.status === 'paid').length,
    unpaid: invoices.filter((inv: any) => inv.status === 'sent' || inv.status === 'viewed').length,
    overdue: invoices.filter((inv: any) => inv.status === 'overdue').length,
    draft: invoices.filter((inv: any) => inv.status === 'draft').length,
    void: invoices.filter((inv: any) => inv.status === 'void').length,
    partially_paid: invoices.filter((inv: any) => inv.status === 'partially_paid').length,
    
    // Additional calculated fields
    total_amount: invoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.total || '0'), 0),
    paid_amount: invoices
      .filter((inv: any) => inv.status === 'paid')
      .reduce((sum: number, inv: any) => sum + parseFloat(inv.total || '0'), 0),
    unpaid_amount: invoices
      .filter((inv: any) => inv.status !== 'paid' && inv.status !== 'void')
      .reduce((sum: number, inv: any) => sum + parseFloat(inv.balance || '0'), 0),
    overdue_amount: invoices
      .filter((inv: any) => inv.status === 'overdue')
      .reduce((sum: number, inv: any) => sum + parseFloat(inv.balance || '0'), 0)
  };

  return statistics;
}
/**
 * Get invoices by customer
 */
export async function getInvoicesByCustomer(
  userOrgId: string,
  customerId: string,
  options: Omit<InvoiceListOptions, 'customer_id'> = {},
  apiClient?: ProviderApiClient
): Promise<any[]> {
  return listInvoices(userOrgId, { ...options, customer_id: customerId }, apiClient)
}

/**
 * Get overdue invoices
 */
export async function getOverdueInvoices(
  userOrgId: string,
  options: Omit<InvoiceListOptions, 'status'> = {},
  apiClient?: ProviderApiClient
): Promise<any[]> {
  return listInvoices(userOrgId, { ...options, status: 'overdue' }, apiClient)
}

/**
 * Get unpaid invoices (includes sent and overdue)
 */
export async function getUnpaidInvoices(
  userOrgId: string,
  options: Omit<InvoiceListOptions, 'status'> = {},
  apiClient?: ProviderApiClient
): Promise<any[]> {
  return listInvoices(userOrgId, { ...options, status: 'unpaid' }, apiClient)
}

/**
 * Search invoices by text
 */
export async function searchInvoices(
  userOrgId: string,
  searchText: string,
  options: Omit<InvoiceListOptions, 'search_text'> = {},
  apiClient?: ProviderApiClient
): Promise<any[]> {
  return listInvoices(userOrgId, { ...options, search_text: searchText }, apiClient)
}

/**
 * Get recent invoices (last 30 days)
 */
export async function getRecentInvoices(
  userOrgId: string,
  days: number = 30,
  options: InvoiceListOptions = {},
  apiClient?: ProviderApiClient
): Promise<any[]> {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  return listInvoices(userOrgId, {
    ...options,
    date_start: startDate.toISOString().split('T')[0],
    date_end: endDate.toISOString().split('T')[0],
    sort_order: 'D'
  }, apiClient)
}

/**
 * Get invoice aging analysis
 */
export async function getInvoiceAging(
  userOrgId: string,
  apiClient?: ProviderApiClient
): Promise<{
  current: number
  days_1_30: number
  days_31_60: number
  days_61_90: number
  days_over_90: number
}> {
  const invoices = await getUnpaidInvoices(userOrgId, {}, apiClient)
  const now = new Date()
  
  const aging = {
    current: 0,
    days_1_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    days_over_90: 0
  }
  
  invoices.forEach(invoice => {
    if (!invoice.due_date) return
    
    const dueDate = new Date(invoice.due_date)
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    const amount = parseFloat(invoice.balance || invoice.total || 0)
    
    if (daysOverdue <= 0) {
      aging.current += amount
    } else if (daysOverdue <= 30) {
      aging.days_1_30 += amount
    } else if (daysOverdue <= 60) {
      aging.days_31_60 += amount
    } else if (daysOverdue <= 90) {
      aging.days_61_90 += amount
    } else {
      aging.days_over_90 += amount
    }
  })
  
  return aging
}

// New optimized specialized query methods for common use cases

/**
 * Get invoices due this week using API-level filtering
 * Performance optimized with specific date range query
 */
export async function getInvoicesDueThisWeek(
  userOrgId: string,
  apiClient?: ProviderApiClient
): Promise<any[]> {
  if (!apiClient) {
    throw new Error('API client is required for getInvoicesDueThisWeek');
  }
  
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (6 - today.getDay())); // Saturday
  
  // API-level filtering for invoices due this week
  const queryParams: Record<string, any> = {
    'due_date.start': startOfWeek.toISOString().split('T')[0],
    'due_date.end': endOfWeek.toISOString().split('T')[0],
    status: 'sent', // Only unpaid invoices
    sort_order: 'A' as 'A', // Ascending by due date
    per_page: 100
  };
  
  console.log('Zoho Invoices Due This Week Query:', queryParams);
  
  return withRetry(async () => {
    const response = await providerFetch<{ invoices: any[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/invoices',
      queryParams
    )
    
    return response.invoices || []
  })
}

/**
 * Get invoices above a certain amount using API-level filtering
 * Performance optimized with amount comparison
 */
export async function getInvoicesAboveAmount(
  userOrgId: string,
  amount: number,
  options?: { date_start?: string; date_end?: string },
  apiClient?: ProviderApiClient
): Promise<any[]> {
  if (!apiClient) {
    throw new Error('API client is required for getInvoicesAboveAmount');
  }
  
  // Build query with amount filtering
  const queryParams: Record<string, any> = {
    'total.greater_than': amount,
    sort_order: 'D', // Descending by total
    per_page: 100
  };
  
  // Add date filtering if specified
  if (options?.date_start) {
    queryParams['date.start'] = options.date_start;
  }
  
  if (options?.date_end) {
    queryParams['date.end'] = options.date_end;
  }
  
  console.log('Zoho Invoices Above Amount Query:', queryParams);
  
  return withRetry(async () => {
    const response = await providerFetch<{ invoices: any[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/invoices',
      queryParams
    )
    
    return response.invoices || []
  })
}

/**
 * Get customer revenue summary using API-level filtering
 * Performance optimized with customer and status filtering
 */
export async function getCustomerRevenueSummary(
  userOrgId: string,
  customerId: string,
  options?: { date_start?: string; date_end?: string },
  apiClient?: ProviderApiClient
): Promise<{
  total_invoiced: number;
  total_paid: number;
  outstanding_balance: number;
  invoice_count: number;
}> {
  if (!apiClient) {
    throw new Error('API client is required for getCustomerRevenueSummary');
  }
  
  // Build query with customer filtering
  const queryParams: Record<string, any> = {
    customer_id: customerId,
    per_page: 200
  };
  
  // Add date filtering if specified
  if (options?.date_start) {
    queryParams['date.start'] = options.date_start;
  }
  
  if (options?.date_end) {
    queryParams['date.end'] = options.date_end;
  }
  
  console.log('Zoho Customer Revenue Summary Query:', queryParams);
  
  return withRetry(async () => {
    const response = await providerFetch<{ invoices: any[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/invoices',
      queryParams
    )
    
    const invoices = response.invoices || [];
    
    let totalInvoiced = 0;
    let totalPaid = 0;
    let outstandingBalance = 0;
    
    invoices.forEach(invoice => {
      const total = parseFloat(invoice.total || 0);
      const balance = parseFloat(invoice.balance || 0);
      const paymentMade = parseFloat(invoice.payment_made || 0);
      
      totalInvoiced += total;
      totalPaid += paymentMade;
      outstandingBalance += balance;
    });
    
    return {
      total_invoiced: totalInvoiced,
      total_paid: totalPaid,
      outstanding_balance: outstandingBalance,
      invoice_count: invoices.length
    };
  })
}

/**
 * Get top customers by revenue using API-level filtering and aggregation
 * Performance optimized with efficient querying
 */
export async function getTopCustomersByRevenue(
  userOrgId: string,
  limit: number = 10,
  options?: { date_start?: string; date_end?: string },
  apiClient?: ProviderApiClient
): Promise<Array<{
  customer_id: string;
  customer_name: string;
  total_revenue: number;
  invoice_count: number;
  last_invoice_date: string;
}>> {
  if (!apiClient) {
    throw new Error('API client is required for getTopCustomersByRevenue');
  }
  
  // Build query with date filtering
  const queryParams: Record<string, any> = {
    per_page: 200, // Get more invoices for analysis
    sort_order: 'D'
  };
  
  // Add date filtering if specified
  if (options?.date_start) {
    queryParams['date.start'] = options.date_start;
  }
  
  if (options?.date_end) {
    queryParams['date.end'] = options.date_end;
  }
  
  console.log('Zoho Top Customers Revenue Query:', queryParams);
  
  return withRetry(async () => {
    // Get all invoices with API-level filtering
    const invoices = await providerFetchAll(
      apiClient,
      'zoho',
      userOrgId,
      '/invoices',
      queryParams
    );
    
    // Aggregate by customer
    const customerRevenue = new Map<string, {
      name: string;
      totalRevenue: number;
      count: number;
      lastDate: string;
    }>();
    
    invoices.forEach((invoice: any) => {
      const customerId = invoice.customer_id;
      const customerName = invoice.customer_name || 'Unknown Customer';
      const total = parseFloat(invoice.total || 0);
      const date = invoice.date;
      
      if (customerId) {
        const existing = customerRevenue.get(customerId) || {
          name: customerName,
          totalRevenue: 0,
          count: 0,
          lastDate: ''
        };
        
        existing.totalRevenue += total;
        existing.count += 1;
        if (date > existing.lastDate) {
          existing.lastDate = date;
        }
        
        customerRevenue.set(customerId, existing);
      }
    });
    
    // Sort by revenue and limit results
    return Array.from(customerRevenue.entries())
      .map(([customerId, data]) => ({
        customer_id: customerId,
        customer_name: data.name,
        total_revenue: data.totalRevenue,
        invoice_count: data.count,
        last_invoice_date: data.lastDate
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, limit);
  })
}
