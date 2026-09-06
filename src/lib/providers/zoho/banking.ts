// src/lib/providers/zoho/banking.ts
import { providerFetch, providerFetchAll, withRetry, QueryOptions } from '../core'
import { ProviderApiClient } from '../apiClient'

export interface BankTransactionOptions extends QueryOptions {
  account_id?: string
  search_text?: string
  reference_number?: string
  description?: string
  debit_or_credit?: 'debit' | 'credit'
  amount_start?: number
  amount_end?: number
  transaction_type?: string
}

export interface BankAccount {
  account_id: string
  account_name: string
  account_type: string
  balance: number
  bank_balance: number
  uncategorized_transactions: number
  is_active: boolean
  currency_code: string
  account_number?: string
  routing_number?: string
}

export interface BankTransaction {
  transaction_id: string
  amount: number
  date: string
  description: string
  reference_number?: string
  debit_or_credit: 'debit' | 'credit'
  offset_account_name?: string
  customer_id?: string
  vendor_id?: string
  status: string
}

/**
 * List bank accounts
 * Reference: https://www.zoho.com/books/api/v3/bank-accounts/#list-bank-accounts
 */

export async function listBankAccounts(
  userOrgId: string,
  options: { filter_by?: 'Status.All' | 'Status.Active' | 'Status.Inactive' } = {},
  apiClient?: ProviderApiClient
): Promise<BankAccount[]> {
  if (!apiClient) {
    throw new Error('API client is required for listBankAccounts');
  }

  return withRetry(async () => {
    const response = await providerFetch<{ bankaccounts: BankAccount[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/bankaccounts',
      options
    )
    
    return response.bankaccounts || []
  })
}

/**
 * Get bank account details
 * Reference: https://www.zoho.com/books/api/v3/bank-accounts/#get-a-bank-account
 */
export async function getBankAccount(
  userOrgId: string,
  accountId: string,
  apiClient?: ProviderApiClient
): Promise<BankAccount> {
  if (!apiClient) {
    throw new Error('API client is required for getBankAccount');
  }

  return withRetry(async () => {
    const response = await providerFetch<{ bankaccount: BankAccount }>(
      apiClient,
      'zoho',
      userOrgId,
      `/bankaccounts/${accountId}`,
      {}
    )
    
    return response.bankaccount
  })
}

/**
 * List bank transactions
 * Reference: https://www.zoho.com/books/api/v3/bank-transactions/#list-bank-transactions
 */
export async function listBankTransactions(
  userOrgId: string,
  options: BankTransactionOptions = {},
  apiClient?: ProviderApiClient
): Promise<BankTransaction[]> {
  if (!apiClient) {
    throw new Error('API client is required for listBankTransactions');
  }

  return withRetry(async () => {
    if (options.per_page && options.per_page > 200) {
      // Use pagination for large requests
      return providerFetchAll(apiClient, 'zoho', userOrgId, '/banktransactions', options)
    }
    
    const response = await providerFetch<{ banktransactions: BankTransaction[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/banktransactions',
      options
    )
    
    return response.banktransactions || []
  })
}

/**
 * Get bank transaction details
 */
export async function getBankTransaction(
  userOrgId: string,
  transactionId: string,
  apiClient?: ProviderApiClient
): Promise<BankTransaction> {
  if (!apiClient) {
    throw new Error('API client is required for getBankTransaction');
  }

  return withRetry(async () => {
    const response = await providerFetch<{ banktransaction: BankTransaction }>(
      apiClient,
      'zoho',
      userOrgId,
      `/banktransactions/${transactionId}`,
      {}
    )
    
    return response.banktransaction
  })
}

/**
 * Get transactions for specific account
 */
export async function getAccountTransactions(
  userOrgId: string,
  accountId: string,
  options: Omit<BankTransactionOptions, 'account_id'> = {},
  apiClient?: ProviderApiClient
): Promise<BankTransaction[]> {
  return listBankTransactions(userOrgId, { ...options, account_id: accountId }, apiClient)
}

/**
 * Get recent transactions across all accounts
 */
export async function getRecentTransactions(
  userOrgId: string,
  days: number = 30,
  options: BankTransactionOptions = {},
  apiClient?: ProviderApiClient
): Promise<BankTransaction[]> {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  return listBankTransactions(userOrgId, {
    ...options,
    date_start: startDate.toISOString().split('T')[0],
    date_end: endDate.toISOString().split('T')[0],
    sort_order: 'D'
  }, apiClient)
}

/**
 * Get cash flow analysis from bank transactions, invoices, and expenses
 * This provides comprehensive daily cash flow data including all money movements
 */
export async function getCashFlowAnalysis(
  userOrgId: string,
  accountId?: string,
  days: number = 30,
  apiClient?: ProviderApiClient
): Promise<{
  total_inflow: number
  total_outflow: number
  net_flow: number
  daily_average_inflow: number
  daily_average_outflow: number
  daily_data: Array<{
    date: string
    day: string
    inflow: number
    outflow: number
    net: number
  }>
}> {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  // Fetch all relevant data in parallel for better performance
  const [transactions, invoices, expenses] = await Promise.all([
    // Get bank transactions
    listBankTransactions(userOrgId, {
      account_id: accountId,
      date_start: startDate.toISOString().split('T')[0],
      date_end: endDate.toISOString().split('T')[0],
      per_page: 2000 // Increased to ensure we get all transactions
    }, apiClient).catch(() => []),
    
    // Get paid invoices (inflow)
    providerFetch(apiClient!, 'zoho', userOrgId, '/invoices', {
      date_start: startDate.toISOString().split('T')[0],
      date_end: endDate.toISOString().split('T')[0],
      status: 'paid',
      per_page: 500
    }).then((res: any) => res.invoices || []).catch(() => []),
    
    // Get expenses (outflow)
    providerFetch(apiClient!, 'zoho', userOrgId, '/expenses', {
      date_start: startDate.toISOString().split('T')[0],
      date_end: endDate.toISOString().split('T')[0],
      per_page: 500
    }).then((res: any) => res.expenses || []).catch(() => [])
  ])
  
  // Group all cash flows by date
  const dailyData: Record<string, { inflow: number; outflow: number }> = {}
  let totalInflow = 0
  let totalOutflow = 0
  
  // Process bank transactions
  transactions.forEach(transaction => {
    const date = transaction.date
    const amount = Math.abs(transaction.amount || 0)
    
    if (!dailyData[date]) {
      dailyData[date] = { inflow: 0, outflow: 0 }
    }
    
    if (transaction.debit_or_credit === 'credit' || transaction.amount > 0) {
      dailyData[date].inflow += amount
      totalInflow += amount
    } else {
      dailyData[date].outflow += amount
      totalOutflow += amount
    }
  })
  
  // Process paid invoices as inflow (if not already in bank transactions)
  invoices.forEach((invoice: any) => {
    const date = invoice.payment_date || invoice.date
    const amount = Math.abs(invoice.payment_made || invoice.total || 0)
    
    if (date && amount > 0) {
      if (!dailyData[date]) {
        dailyData[date] = { inflow: 0, outflow: 0 }
      }
      // Only add if it seems not already captured in bank transactions
      // (this is a heuristic - may need adjustment based on actual data)
      if (dailyData[date].inflow < amount) {
        const additionalInflow = amount - dailyData[date].inflow
        dailyData[date].inflow += additionalInflow
        totalInflow += additionalInflow
      }
    }
  })
  
  // Process expenses as outflow (if not already in bank transactions)
  expenses.forEach((expense: any) => {
    const date = expense.date || expense.expense_date
    const amount = Math.abs(expense.total || expense.amount || 0)
    
    if (date && amount > 0) {
      if (!dailyData[date]) {
        dailyData[date] = { inflow: 0, outflow: 0 }
      }
      // Only add if it seems not already captured in bank transactions
      if (dailyData[date].outflow < amount) {
        const additionalOutflow = amount - dailyData[date].outflow
        dailyData[date].outflow += additionalOutflow
        totalOutflow += additionalOutflow
      }
    }
  })
  
  // Convert to array and fill ALL missing dates with zeros
  const dailyArray = []
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]
    const dayName = dayNames[date.getDay()]
    
    const dayData = dailyData[dateStr] || { inflow: 0, outflow: 0 }
    dailyArray.push({
      date: dateStr,
      day: dayName,
      inflow: dayData.inflow,
      outflow: dayData.outflow,
      net: dayData.inflow - dayData.outflow
    })
  }
  
  // Calculate daily averages (excluding days with no activity if needed)
  const activeDays = dailyArray.filter(d => d.inflow > 0 || d.outflow > 0).length || 1
  
  return {
    total_inflow: totalInflow,
    total_outflow: totalOutflow,
    net_flow: totalInflow - totalOutflow,
    daily_average_inflow: totalInflow / activeDays,
    daily_average_outflow: totalOutflow / activeDays,
    daily_data: dailyArray
  }
}

/**
 * Get account balance summary
 */
export async function getAccountBalanceSummary(
  userOrgId: string,
  apiClient?: ProviderApiClient
): Promise<{
  total_balance: number
  total_bank_balance: number
  accounts: Array<{
    account_id: string
    account_name: string
    balance: number
    bank_balance: number
    currency_code: string
    uncategorized_count: number
  }>
}> {
  const accounts = await listBankAccounts(userOrgId, { filter_by: 'Status.Active' }, apiClient)
  
  let totalBalance = 0
  let totalBankBalance = 0
  
  const accountSummary = accounts.map(account => {
    const balance = account.balance || 0
    const bankBalance = account.bank_balance || 0
    
    totalBalance += balance
    totalBankBalance += bankBalance
    
    return {
      account_id: account.account_id,
      account_name: account.account_name,
      balance,
      bank_balance: bankBalance,
      currency_code: account.currency_code,
      uncategorized_count: account.uncategorized_transactions || 0
    }
  })
  
  return {
    total_balance: totalBalance,
    total_bank_balance: totalBankBalance,
    accounts: accountSummary
  }
}

/**
 * Get uncategorized transactions requiring attention
 */
export async function getUncategorizedTransactions(
  userOrgId: string,
  accountId?: string,
  apiClient?: ProviderApiClient
): Promise<BankTransaction[]> {
  // Note: Zoho doesn't have a direct filter for uncategorized, 
  // so we'll get recent transactions and filter by status
  const transactions = await listBankTransactions(userOrgId, {
    account_id: accountId,
    per_page: 200,
    sort_order: 'D'
  }, apiClient)
  
  // Filter for transactions that might need categorization
  // This is a heuristic - adjust based on actual Zoho response structure
  return transactions.filter(transaction => 
    !transaction.offset_account_name || 
    transaction.status === 'uncategorized' ||
    (!transaction.customer_id && !transaction.vendor_id)
  )
}

/**
 * Search transactions by description or reference
 */
export async function searchTransactions(
  userOrgId: string,
  searchText: string,
  accountId?: string,
  options: Omit<BankTransactionOptions, 'search_text' | 'account_id'> = {},
  apiClient?: ProviderApiClient
): Promise<BankTransaction[]> {
  return listBankTransactions(userOrgId, {
    ...options,
    search_text: searchText,
    account_id: accountId
  }, apiClient)
}

/**
 * Get transaction patterns analysis
 */
export async function getTransactionPatterns(
  userOrgId: string,
  accountId?: string,
  days: number = 90,
  apiClient?: ProviderApiClient
): Promise<{
  recurring_patterns: Array<{
    description_pattern: string
    frequency: number
    average_amount: number
    last_occurrence: string
  }>
  top_vendors: Array<{
    description: string
    transaction_count: number
    total_amount: number
  }>
  spending_categories: Array<{
    category: string
    count: number
    total_amount: number
  }>
}> {
  const transactions = await getRecentTransactions(userOrgId, days, { account_id: accountId }, apiClient)
  
  // Group by description patterns (simplified)
  const patterns: Record<string, Array<BankTransaction>> = {}
  const vendorSpending: Record<string, { count: number; total: number }> = {}
  
  transactions.forEach(transaction => {
    const description = transaction.description || 'Unknown'
    const amount = Math.abs(transaction.amount || 0)
    
    // Simple pattern matching - group by first 20 characters
    const pattern = description.substring(0, 20).trim()
    if (!patterns[pattern]) patterns[pattern] = []
    patterns[pattern].push(transaction)
    
    // Vendor analysis for outgoing transactions
    if (transaction.debit_or_credit === 'debit') {
      if (!vendorSpending[description]) {
        vendorSpending[description] = { count: 0, total: 0 }
      }
      vendorSpending[description].count++
      vendorSpending[description].total += amount
    }
  })
  
  const recurringPatterns = Object.entries(patterns)
    .filter(([_, txns]) => txns.length >= 2) // At least 2 occurrences
    .map(([pattern, txns]) => ({
      description_pattern: pattern,
      frequency: txns.length,
      average_amount: txns.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) / txns.length,
      last_occurrence: txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
    }))
    .sort((a, b) => b.frequency - a.frequency)
  
  const topVendors = Object.entries(vendorSpending)
    .map(([description, data]) => ({
      description,
      transaction_count: data.count,
      total_amount: data.total
    }))
    .sort((a, b) => b.total_amount - a.total_amount)
    .slice(0, 10)
  
  return {
    recurring_patterns: recurringPatterns.slice(0, 10),
    top_vendors: topVendors,
    spending_categories: [] // Would need category mapping for this
  }
}
