// src/lib/providers/zoho/customers.ts
import { providerFetch, providerFetchAll, withRetry, QueryOptions } from '../core'
import { ProviderApiClient } from '../apiClient'

export interface CustomerListOptions extends QueryOptions {
  contact_type?: 'customer' | 'vendor' | 'all'
  contact_name?: string
  company_name?: string
  email?: string
  phone?: string
  payment_terms?: string
  payment_terms_label?: string
  outstanding_receivable_amount_equals?: number
  outstanding_receivable_amount_less_than?: number
  outstanding_receivable_amount_less_equals?: number
  outstanding_receivable_amount_greater_than?: number
  outstanding_receivable_amount_greater_equals?: number
}

export interface Customer {
  contact_id: string
  contact_name: string
  company_name?: string
  contact_type: 'customer' | 'vendor'
  status: 'active' | 'inactive'
  payment_terms: number
  payment_terms_label: string
  currency_code: string
  outstanding_receivable_amount: number
  unused_credits_receivable_amount: number
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  mobile?: string
  website?: string
  credit_limit?: number
  notes?: string
  billing_address?: {
    address?: string
    city?: string
    state?: string
    zip?: string
    country?: string
  }
  shipping_address?: {
    address?: string
    city?: string
    state?: string
    zip?: string
    country?: string
  }
  created_time: string
  last_modified_time: string
}

export interface CustomerStatistics {
  total_customers: number
  active_customers: number
  total_receivables: number
  overdue_amount: number
  average_payment_days: number
  customers_with_overdue: number
}

export interface CustomerAnalytics {
  customer_id: string
  customer_name: string
  total_invoiced: number
  total_paid: number
  outstanding_balance: number
  average_invoice_value: number
  average_payment_days: number
  payment_behavior: 'excellent' | 'good' | 'fair' | 'poor'
  lifetime_value: number
  last_payment_date?: string
  overdue_invoices: number
  credit_utilization: number
}

/**
 * List customers
 */
export async function listCustomers(
  userOrgId: string,
  options: CustomerListOptions = {},
  apiClient?: ProviderApiClient
): Promise<Customer[]> {
  if (!apiClient) {
    throw new Error('API client is required for listCustomers');
  }

  return withRetry(async () => {
    // Build optimized query parameters with API-level filtering
    const queryParams: Record<string, any> = {
      contact_type: 'customer',
      per_page: options.per_page || 50, // Reduced default from 200 to 50 for better performance
    };
    
    // Add API-level filters using Zoho query parameters
    if (options.contact_name) {
      queryParams.contact_name_contains = options.contact_name;
    }
    
    if (options.company_name) {
      queryParams.company_name_contains = options.company_name;
    }
    
    if (options.email) {
      queryParams.email = options.email;
    }
    
    if (options.phone) {
      queryParams.phone = options.phone;
    }
    
    if (options.payment_terms) {
      queryParams.payment_terms = options.payment_terms;
    }
    
    if (options.payment_terms_label) {
      queryParams.payment_terms_label = options.payment_terms_label;
    }
    
    // Outstanding balance filtering at API level
    if (options.outstanding_receivable_amount_equals !== undefined) {
      queryParams['outstanding_receivable_amount.equals'] = options.outstanding_receivable_amount_equals;
    }
    
    if (options.outstanding_receivable_amount_less_than !== undefined) {
      queryParams['outstanding_receivable_amount.less_than'] = options.outstanding_receivable_amount_less_than;
    }
    
    if (options.outstanding_receivable_amount_less_equals !== undefined) {
      queryParams['outstanding_receivable_amount.less_equals'] = options.outstanding_receivable_amount_less_equals;
    }
    
    if (options.outstanding_receivable_amount_greater_than !== undefined) {
      queryParams['outstanding_receivable_amount.greater_than'] = options.outstanding_receivable_amount_greater_than;
    }
    
    if (options.outstanding_receivable_amount_greater_equals !== undefined) {
      queryParams['outstanding_receivable_amount.greater_equals'] = options.outstanding_receivable_amount_greater_equals;
    }
    
    // Pagination parameters
    if (options.page) {
      queryParams.page = options.page;
    }
    
    // Sort order
    if (options.sort_order) {
      queryParams.sort_order = options.sort_order;
    }
    
    console.log('Zoho Customers Query (API-optimized):', queryParams);
    
    if (queryParams.per_page > 200) {
      // Use pagination for large requests
      return providerFetchAll(apiClient, 'zoho', userOrgId, '/contacts', queryParams)
    }
    
    const response = await providerFetch<{ contacts: Customer[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/contacts',
      queryParams
    )
    
    return response.contacts || []
  })
}

/**
 * Get customer details
 */
export async function getCustomer(
  userOrgId: string,
  customerId: string,
  apiClient?: ProviderApiClient
): Promise<Customer> {
  if (!apiClient) {
    throw new Error('API client is required for getCustomer');
  }

  return withRetry(async () => {
    const response = await providerFetch<{ contact: Customer }>(
      apiClient,
      'zoho',
      userOrgId,
      `/contacts/${customerId}`,
      {}
    )
    
    return response.contact
  })
}

/**
 * Get customer statistics
 */
export async function getCustomerStatistics(
  userOrgId: string,
  apiClient?: ProviderApiClient
): Promise<CustomerStatistics> {
  // Use API-level filtering for statistics with optimized batch size
  const customers = await listCustomers(userOrgId, { per_page: 500 }, apiClient)
  
  const activeCustomers = customers.filter(c => c.status === 'active')
  const totalReceivables = customers.reduce((sum, c) => sum + (c.outstanding_receivable_amount || 0), 0)
  
  // Would need invoice data for average payment days
  return {
    total_customers: customers.length,
    active_customers: activeCustomers.length,
    total_receivables: totalReceivables,
    overdue_amount: 0, // Would need to calculate from invoices
    average_payment_days: 0, // Would need to calculate from payment history
    customers_with_overdue: customers.filter(c => (c.outstanding_receivable_amount || 0) > 0).length
  }
}

/**
 * Get customer analytics
 */
export async function getCustomerAnalytics(
  userOrgId: string,
  customerId?: string,
  options: { limit?: number } = {},
  apiClient?: ProviderApiClient
): Promise<CustomerAnalytics[]> {
  // Import invoice functions from the invoices module
  const { listInvoices, getInvoicesByCustomer } = await import('./invoices')
  const { listPayments } = await import('./payments')
  
  const customers = customerId 
    ? [await getCustomer(userOrgId, customerId, apiClient)]
    : await listCustomers(userOrgId, { per_page: options.limit || 100 }, apiClient)
  
  const analytics: CustomerAnalytics[] = []
  
  for (const customer of customers) {
    const invoices = await getInvoicesByCustomer(userOrgId, customer.contact_id, {}, apiClient)
    const totalInvoiced = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0)
    const totalPaid = invoices.reduce((sum, inv) => sum + (parseFloat(inv.payment_made) || 0), 0)
    const outstanding = totalInvoiced - totalPaid
    
    // Calculate average payment days
    const paidInvoices = invoices.filter(inv => inv.status === 'paid')
    let avgPaymentDays = 0
    if (paidInvoices.length > 0) {
      // Would need payment dates to calculate this accurately
      avgPaymentDays = 30 // Placeholder
    }
    
    // Determine payment behavior
    let paymentBehavior: CustomerAnalytics['payment_behavior'] = 'good'
    if (avgPaymentDays <= 15) paymentBehavior = 'excellent'
    else if (avgPaymentDays <= 30) paymentBehavior = 'good'
    else if (avgPaymentDays <= 45) paymentBehavior = 'fair'
    else paymentBehavior = 'poor'
    
    // Calculate credit utilization
    const creditLimit = customer.credit_limit || 0
    const creditUtilization = creditLimit > 0 ? (outstanding / creditLimit) * 100 : 0
    
    analytics.push({
      customer_id: customer.contact_id,
      customer_name: customer.contact_name,
      total_invoiced: totalInvoiced,
      total_paid: totalPaid,
      outstanding_balance: outstanding,
      average_invoice_value: invoices.length > 0 ? totalInvoiced / invoices.length : 0,
      average_payment_days: avgPaymentDays,
      payment_behavior: paymentBehavior,
      lifetime_value: totalPaid,
      last_payment_date: paidInvoices.length > 0 ? paidInvoices[0].last_payment_date : undefined,
      overdue_invoices: invoices.filter(inv => inv.status === 'overdue').length,
      credit_utilization: creditUtilization
    })
  }
  
  return analytics
}

/**
 * Get top customers by revenue
 */
export async function getTopCustomersByRevenue(
  userOrgId: string,
  limit: number = 10,
  options: { date_start?: string; date_end?: string } = {},
  apiClient?: ProviderApiClient
): Promise<Array<{
  customer: Customer
  revenue: number
  invoice_count: number
  last_invoice_date: string
}>> {
  const { listInvoices } = await import('./invoices')
  
  // Use optimized customer query with smaller batch size
  const customers = await listCustomers(userOrgId, { per_page: 100 }, apiClient)
  const customerRevenue: Map<string, { revenue: number; count: number; lastDate: string }> = new Map()
  
  // Get invoices with API-level date filtering and optimized batch size
  const invoices = await listInvoices(userOrgId, {
    date_start: options.date_start,
    date_end: options.date_end,
    per_page: 500 // Reduced batch size for better performance
  }, apiClient)
  
  // Aggregate by customer
  invoices.forEach(invoice => {
    const customerId = invoice.customer_id
    if (!customerId) return
    
    const existing = customerRevenue.get(customerId) || { revenue: 0, count: 0, lastDate: '' }
    customerRevenue.set(customerId, {
      revenue: existing.revenue + (parseFloat(invoice.total) || 0),
      count: existing.count + 1,
      lastDate: invoice.date > existing.lastDate ? invoice.date : existing.lastDate
    })
  })
  
  // Sort and limit
  const sortedCustomers = Array.from(customerRevenue.entries())
    .sort(([, a], [, b]) => b.revenue - a.revenue)
    .slice(0, limit)
  
  // Get customer details
  const result = []
  for (const [customerId, data] of sortedCustomers) {
    const customer = customers.find(c => c.contact_id === customerId)
    if (customer) {
      result.push({
        customer,
        revenue: data.revenue,
        invoice_count: data.count,
        last_invoice_date: data.lastDate
      })
    }
  }
  
  return result
}

/**
 * Get customers with credit limit alerts
 */
export async function getCustomersWithCreditAlerts(
  userOrgId: string,
  threshold: number = 80, // percentage
  apiClient?: ProviderApiClient
): Promise<Array<{
  customer: Customer
  credit_limit: number
  outstanding: number
  utilization_percentage: number
  available_credit: number
}>> {
  // Use API-level filtering for customers with outstanding balances
  const customers = await listCustomers(userOrgId, {
    outstanding_receivable_amount_greater_than: 0, // Only customers with outstanding balances
    per_page: 200 // Optimized batch size
  }, apiClient)
  
  const alerts = []
  
  for (const customer of customers) {
    if (!customer.credit_limit || customer.credit_limit === 0) continue
    
    const outstanding = customer.outstanding_receivable_amount || 0
    const utilization = (outstanding / customer.credit_limit) * 100
    
    if (utilization >= threshold) {
      alerts.push({
        customer,
        credit_limit: customer.credit_limit,
        outstanding,
        utilization_percentage: utilization,
        available_credit: Math.max(0, customer.credit_limit - outstanding)
      })
    }
  }
  
  return alerts.sort((a, b) => b.utilization_percentage - a.utilization_percentage)
}

/**
 * Get customer payment patterns
 */
export async function getCustomerPaymentPatterns(
  userOrgId: string,
  customerId: string,
  months: number = 12,
  apiClient?: ProviderApiClient
): Promise<{
  average_days_to_pay: number
  on_time_payment_rate: number
  early_payment_rate: number
  late_payment_rate: number
  monthly_pattern: Array<{
    month: string
    invoices_sent: number
    invoices_paid: number
    average_days: number
    total_amount: number
  }>
}> {
  const { getInvoicesByCustomer } = await import('./invoices')
  
  const endDate = new Date()
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)
  
  const invoices = await getInvoicesByCustomer(userOrgId, customerId, {
    date_start: startDate.toISOString().split('T')[0],
    date_end: endDate.toISOString().split('T')[0]
  }, apiClient)
  
  // This is a simplified version - would need payment history for accurate calculations
  const monthlyData: Map<string, any> = new Map()
  
  invoices.forEach(invoice => {
    const month = invoice.date.substring(0, 7) // YYYY-MM
    const existing = monthlyData.get(month) || {
      invoices_sent: 0,
      invoices_paid: 0,
      total_amount: 0,
      payment_days: []
    }
    
    existing.invoices_sent++
    if (invoice.status === 'paid') {
      existing.invoices_paid++
      // Would calculate actual payment days here
      existing.payment_days.push(30) // Placeholder
    }
    existing.total_amount += parseFloat(invoice.total) || 0
    
    monthlyData.set(month, existing)
  })
  
  const monthlyPattern = Array.from(monthlyData.entries())
    .map(([month, data]) => ({
      month,
      invoices_sent: data.invoices_sent,
      invoices_paid: data.invoices_paid,
      average_days: data.payment_days.length > 0 
        ? data.payment_days.reduce((a: number, b: number) => a + b, 0) / data.payment_days.length 
        : 0,
      total_amount: data.total_amount
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
  
  return {
    average_days_to_pay: 30, // Placeholder
    on_time_payment_rate: 0.8, // Placeholder
    early_payment_rate: 0.1, // Placeholder
    late_payment_rate: 0.1, // Placeholder
    monthly_pattern: monthlyPattern
  }
}

// New optimized specialized query methods for common use cases

/**
 * Get customers with high outstanding balances using API-level filtering
 * Performance optimized with outstanding balance comparison
 */
export async function getCustomersWithHighOutstanding(
  userOrgId: string,
  minimumAmount: number = 1000,
  apiClient?: ProviderApiClient
): Promise<Customer[]> {
  if (!apiClient) {
    throw new Error('API client is required for getCustomersWithHighOutstanding');
  }
  
  // API-level filtering for customers with high outstanding balances
  const queryParams: Record<string, any> = {
    contact_type: 'customer',
    'outstanding_receivable_amount.greater_equals': minimumAmount,
    sort_order: 'D' as 'D', // Descending by outstanding amount
    per_page: 100
  };
  
  console.log('Zoho High Outstanding Customers Query:', queryParams);
  
  return withRetry(async () => {
    const response = await providerFetch<{ contacts: Customer[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/contacts',
      queryParams
    )
    
    return response.contacts || []
  })
}

/**
 * Get recently added customers using API-level filtering
 * Performance optimized with date filtering
 */
export async function getRecentlyAddedCustomers(
  userOrgId: string,
  daysBack: number = 30,
  apiClient?: ProviderApiClient
): Promise<Customer[]> {
  if (!apiClient) {
    throw new Error('API client is required for getRecentlyAddedCustomers');
  }
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  
  // API-level filtering for recently added customers
  const queryParams: Record<string, any> = {
    contact_type: 'customer',
    'created_time.start': startDate.toISOString().split('T')[0],
    sort_order: 'D' as 'D', // Descending by creation date
    per_page: 100
  };
  
  console.log('Zoho Recently Added Customers Query:', queryParams);
  
  return withRetry(async () => {
    const response = await providerFetch<{ contacts: Customer[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/contacts',
      queryParams
    )
    
    return response.contacts || []
  })
}

/**
 * Get customers by payment terms using API-level filtering
 * Performance optimized with payment terms filtering
 */
export async function getCustomersByPaymentTerms(
  userOrgId: string,
  paymentTerms: string,
  apiClient?: ProviderApiClient
): Promise<Customer[]> {
  if (!apiClient) {
    throw new Error('API client is required for getCustomersByPaymentTerms');
  }
  
  // API-level filtering for customers with specific payment terms
  const queryParams: Record<string, any> = {
    contact_type: 'customer',
    payment_terms_label: paymentTerms,
    sort_order: 'A' as 'A', // Ascending by name
    per_page: 200
  };
  
  console.log('Zoho Customers by Payment Terms Query:', queryParams);
  
  return withRetry(async () => {
    const response = await providerFetch<{ contacts: Customer[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/contacts',
      queryParams
    )
    
    return response.contacts || []
  })
}

/**
 * Get active customers with API-level filtering
 * Performance optimized with status filtering
 */
export async function getActiveCustomers(
  userOrgId: string,
  apiClient?: ProviderApiClient
): Promise<Customer[]> {
  if (!apiClient) {
    throw new Error('API client is required for getActiveCustomers');
  }
  
  // API-level filtering for active customers only
  const queryParams: Record<string, any> = {
    contact_type: 'customer',
    status: 'active',
    sort_order: 'A' as 'A', // Ascending by name
    per_page: 200
  };
  
  console.log('Zoho Active Customers Query:', queryParams);
  
  return withRetry(async () => {
    const response = await providerFetch<{ contacts: Customer[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/contacts',
      queryParams
    )
    
    return response.contacts || []
  })
}

/**
 * Search customers
 */
export async function searchCustomers(
  userOrgId: string,
  searchText: string,
  options: Omit<CustomerListOptions, 'contact_name'> = {},
  apiClient?: ProviderApiClient
): Promise<Customer[]> {
  // Use API-level search with optimized parameters
  return listCustomers(userOrgId, {
    ...options,
    contact_name: searchText,
    per_page: (options.per_page || 50) as number // Optimized default limit
  }, apiClient)
}
