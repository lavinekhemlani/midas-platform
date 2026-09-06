// src/lib/providers/zoho/expenses.ts
import { providerFetch, providerFetchAll, withRetry, QueryOptions } from '../core'
import { ProviderApiClient } from '../apiClient'

export interface ExpenseListOptions extends QueryOptions {
  account_id?: string
  paid_through_account_id?: string
  category_id?: string
  search_text?: string
  reference_number?: string
  expense_receipt_name?: string
  description?: string
  customer_id?: string
  project_id?: string
  recurring_expense_id?: string
  tax_id?: string
}

export interface ExpenseSummary {
  total_amount: number
  total_count: number
  by_category: Record<string, { amount: number; count: number }>
  by_month: Record<string, number>
  average_amount: number
}

/**
 * List expenses with optional filtering
 * Reference: https://www.zoho.com/books/api/v3/expenses/#list-expenses
 */
export async function listExpenses(
  userOrgId: string,
  options: ExpenseListOptions = {},
  apiClient?: ProviderApiClient
): Promise<any[]> {
  if (!apiClient) {
    throw new Error('API client is required for listExpenses');
  }

  return withRetry(async () => {
    // Build optimized query parameters with API-level filtering
    const queryParams: Record<string, any> = {
      per_page: options.per_page || 50, // Reduced default from 200 to 50 for better performance
    };
    
    // Add API-level filters using Zoho query parameters
    if (options.account_id) {
      queryParams.account_id = options.account_id;
    }
    
    if (options.paid_through_account_id) {
      queryParams.paid_through_account_id = options.paid_through_account_id;
    }
    
    if (options.category_id) {
      queryParams.category_id = options.category_id;
    }
    
    if (options.customer_id) {
      queryParams.customer_id = options.customer_id;
    }
    
    if (options.project_id) {
      queryParams.project_id = options.project_id;
    }
    
    if (options.reference_number) {
      queryParams.reference_number = options.reference_number;
    }
    
    if (options.description) {
      queryParams.description = options.description;
    }
    
    // Date range filtering at API level
    // Support both date_start/date_end and from_date/to_date formats
    if (options.date_start || (options as any).from_date) {
      queryParams['date.start'] = options.date_start || (options as any).from_date;
    }
    
    if (options.date_end || (options as any).to_date) {
      queryParams['date.end'] = options.date_end || (options as any).to_date;
    }
    
    // Search text filtering at API level
    if (options.search_text) {
      queryParams.search_text = options.search_text;
    }
    
    // Pagination parameters
    if (options.page) {
      queryParams.page = options.page;
    }
    
    // Sort order
    if (options.sort_order) {
      queryParams.sort_order = options.sort_order;
    }
    
    console.log('Zoho Expenses Query (API-optimized):', queryParams);
    
    if (queryParams.per_page > 200) {
      // Use pagination for large requests
      return providerFetchAll(apiClient, 'zoho', userOrgId, '/expenses', queryParams)
    }
    
    const response = await providerFetch<{ expenses: any[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/expenses',
      queryParams
    )
    
    return response.expenses || []
  })
}

/**
 * Get detailed expense by ID
 * Reference: https://www.zoho.com/books/api/v3/expenses/#get-an-expense
 */
export async function getExpense(
  userOrgId: string,
  expenseId: string,
  apiClient?: ProviderApiClient
): Promise<any> {
  if (!apiClient) {
    throw new Error('API client is required for getExpense');
  }

  return withRetry(async () => {
    const response = await providerFetch<{ expense: any }>(
      apiClient,
      'zoho',
      userOrgId,
      `/expenses/${expenseId}`,
      {}
    )
    
    return response.expense
  })
}

/**
 * Get expense categories summary
 * Custom analysis function
 */
export async function expenseCategoriesSummary(
  userOrgId: string,
  options: { date_start?: string; date_end?: string } = {},
  apiClient?: ProviderApiClient
): Promise<ExpenseSummary> {
  // Use API-level filtering for summary with optimized batch size
  const expenses = await listExpenses(userOrgId, {
    ...options,
    per_page: 500 // Reduced batch size for better performance
  }, apiClient)
  
  const summary: ExpenseSummary = {
    total_amount: 0,
    total_count: expenses.length,
    by_category: {},
    by_month: {},
    average_amount: 0
  }
  
  expenses.forEach(expense => {
    const amount = parseFloat(expense.total || 0)
    const category = expense.category_name || 'Uncategorized'
    const date = new Date(expense.date || expense.expense_date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    summary.total_amount += amount
    
    // By category
    if (!summary.by_category[category]) {
      summary.by_category[category] = { amount: 0, count: 0 }
    }
    summary.by_category[category].amount += amount
    summary.by_category[category].count += 1
    
    // By month
    summary.by_month[monthKey] = (summary.by_month[monthKey] || 0) + amount
  })
  
  summary.average_amount = summary.total_count > 0 ? summary.total_amount / summary.total_count : 0
  
  return summary
}

/**
 * Get expenses by category
 */
export async function getExpensesByCategory(
  userOrgId: string,
  categoryId: string,
  options: Omit<ExpenseListOptions, 'category_id'> = {},
  apiClient?: ProviderApiClient
): Promise<any[]> {
  return listExpenses(userOrgId, { ...options, category_id: categoryId }, apiClient)
}

/**
 * Get expenses by customer/project
 */
export async function getExpensesByCustomer(
  userOrgId: string,
  customerId: string,
  options: Omit<ExpenseListOptions, 'customer_id'> = {},
  apiClient?: ProviderApiClient
): Promise<any[]> {
  return listExpenses(userOrgId, { ...options, customer_id: customerId }, apiClient)
}

/**
 * Search expenses by text
 */
export async function searchExpenses(
  userOrgId: string,
  searchText: string,
  options: Omit<ExpenseListOptions, 'search_text'> = {},
  apiClient?: ProviderApiClient
): Promise<any[]> {
  return listExpenses(userOrgId, { ...options, search_text: searchText }, apiClient)
}

/**
 * Get recent expenses (last 30 days)
 */
export async function getRecentExpenses(
  userOrgId: string,
  days: number = 30,
  options: ExpenseListOptions = {},
  apiClient?: ProviderApiClient
): Promise<any[]> {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  // Use API-level date filtering with optimized pagination
  return listExpenses(userOrgId, {
    ...options,
    date_start: startDate.toISOString().split('T')[0],
    date_end: endDate.toISOString().split('T')[0],
    sort_order: 'D',
    per_page: options.per_page || 50 // Optimized default limit
  }, apiClient)
}

/**
 * Get monthly expense trend
 */
export async function getMonthlyExpenseTrend(
  userOrgId: string,
  months: number = 12,
  apiClient?: ProviderApiClient
): Promise<Array<{ month: string; amount: number; count: number }>> {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)
  
  // Use API-level filtering for trend analysis with optimized batch size
  const expenses = await listExpenses(userOrgId, {
    date_start: startDate.toISOString().split('T')[0],
    date_end: endDate.toISOString().split('T')[0],
    per_page: 500 // Reduced batch size for better performance
  }, apiClient)
  
  const monthlyData: Record<string, { amount: number; count: number }> = {}
  
  expenses.forEach(expense => {
    const date = new Date(expense.date || expense.expense_date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const amount = parseFloat(expense.total || 0)
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { amount: 0, count: 0 }
    }
    
    monthlyData[monthKey].amount += amount
    monthlyData[monthKey].count += 1
  })
  
  return Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      amount: data.amount,
      count: data.count
    }))
}

/**
 * Get top expense categories
 */
export async function getTopExpenseCategories(
  userOrgId: string,
  limit: number = 10,
  options: { date_start?: string; date_end?: string } = {},
  apiClient?: ProviderApiClient
): Promise<Array<{ category: string; amount: number; count: number; percentage: number }>> {
  const summary = await expenseCategoriesSummary(userOrgId, options, apiClient)
  
  return Object.entries(summary.by_category)
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count,
      percentage: summary.total_amount > 0 ? (data.amount / summary.total_amount) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}

// New optimized specialized query methods for common use cases

/**
 * Get expenses above a certain amount using API-level filtering
 * Performance optimized with amount comparison
 */
export async function getExpensesAboveAmount(
  userOrgId: string,
  amount: number,
  options?: { date_start?: string; date_end?: string },
  apiClient?: ProviderApiClient
): Promise<any[]> {
  if (!apiClient) {
    throw new Error('API client is required for getExpensesAboveAmount');
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
  
  console.log('Zoho Expenses Above Amount Query:', queryParams);
  
  return withRetry(async () => {
    const response = await providerFetch<{ expenses: any[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/expenses',
      queryParams
    )
    
    return response.expenses || []
  })
}

/**
 * Get expenses by vendor using API-level filtering
 * Performance optimized with vendor filtering
 */
export async function getExpensesByVendor(
  userOrgId: string,
  vendorId: string,
  options?: { date_start?: string; date_end?: string },
  apiClient?: ProviderApiClient
): Promise<any[]> {
  if (!apiClient) {
    throw new Error('API client is required for getExpensesByVendor');
  }
  
  // Build query with vendor filtering
  const queryParams: Record<string, any> = {
    vendor_id: vendorId,
    sort_order: 'D',
    per_page: 200
  };
  
  // Add date filtering if specified
  if (options?.date_start) {
    queryParams['date.start'] = options.date_start;
  }
  
  if (options?.date_end) {
    queryParams['date.end'] = options.date_end;
  }
  
  console.log('Zoho Expenses by Vendor Query:', queryParams);
  
  return withRetry(async () => {
    const response = await providerFetch<{ expenses: any[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/expenses',
      queryParams
    )
    
    return response.expenses || []
  })
}

/**
 * Get project expenses using API-level filtering
 * Performance optimized with project filtering
 */
export async function getProjectExpenses(
  userOrgId: string,
  projectId: string,
  options?: { date_start?: string; date_end?: string },
  apiClient?: ProviderApiClient
): Promise<any[]> {
  if (!apiClient) {
    throw new Error('API client is required for getProjectExpenses');
  }
  
  // Build query with project filtering
  const queryParams: Record<string, any> = {
    project_id: projectId,
    sort_order: 'D',
    per_page: 200
  };
  
  // Add date filtering if specified
  if (options?.date_start) {
    queryParams['date.start'] = options.date_start;
  }
  
  if (options?.date_end) {
    queryParams['date.end'] = options.date_end;
  }
  
  console.log('Zoho Project Expenses Query:', queryParams);
  
  return withRetry(async () => {
    const response = await providerFetch<{ expenses: any[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/expenses',
      queryParams
    )
    
    return response.expenses || []
  })
}

/**
 * Get pending expense reports using API-level filtering
 * Performance optimized with status filtering
 */
export async function getPendingExpenseReports(
  userOrgId: string,
  apiClient?: ProviderApiClient
): Promise<any[]> {
  if (!apiClient) {
    throw new Error('API client is required for getPendingExpenseReports');
  }
  
  // Build query with status filtering for pending expenses
  const queryParams: Record<string, any> = {
    status: 'pending',
    sort_order: 'D',
    per_page: 100
  };
  
  console.log('Zoho Pending Expense Reports Query:', queryParams);
  
  return withRetry(async () => {
    const response = await providerFetch<{ expenses: any[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/expenses',
      queryParams
    )
    
    return response.expenses || []
  })
}

/**
 * Get top spending categories using API-level filtering and aggregation
 * Performance optimized with efficient querying
 */
export async function getTopSpendingCategories(
  userOrgId: string,
  limit: number = 10,
  options?: { date_start?: string; date_end?: string },
  apiClient?: ProviderApiClient
): Promise<Array<{
  category_id: string;
  category_name: string;
  total_amount: number;
  expense_count: number;
  percentage: number;
}>> {
  if (!apiClient) {
    throw new Error('API client is required for getTopSpendingCategories');
  }
  
  // Build query with date filtering
  const queryParams: Record<string, any> = {
    per_page: 200, // Get more expenses for analysis
    sort_order: 'D'
  };
  
  // Add date filtering if specified
  if (options?.date_start) {
    queryParams['date.start'] = options.date_start;
  }
  
  if (options?.date_end) {
    queryParams['date.end'] = options.date_end;
  }
  
  console.log('Zoho Top Spending Categories Query:', queryParams);
  
  return withRetry(async () => {
    // Get all expenses with API-level filtering
    const expenses = await providerFetchAll(
      apiClient,
      'zoho',
      userOrgId,
      '/expenses',
      queryParams
    );
    
    // Aggregate by category
    const categorySpending = new Map<string, {
      name: string;
      totalAmount: number;
      count: number;
    }>();
    
    let totalSpending = 0;
    
    expenses.forEach((expense: any) => {
      const categoryId = expense.category_id || 'uncategorized';
      const categoryName = expense.category_name || 'Uncategorized';
      const amount = parseFloat(expense.total || 0);
      
      totalSpending += amount;
      
      const existing = categorySpending.get(categoryId) || {
        name: categoryName,
        totalAmount: 0,
        count: 0
      };
      
      existing.totalAmount += amount;
      existing.count += 1;
      
      categorySpending.set(categoryId, existing);
    });
    
    // Sort by spending and limit results
    return Array.from(categorySpending.entries())
      .map(([categoryId, data]) => ({
        category_id: categoryId,
        category_name: data.name,
        total_amount: data.totalAmount,
        expense_count: data.count,
        percentage: totalSpending > 0 ? (data.totalAmount / totalSpending) * 100 : 0
      }))
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, limit);
  })
}
