// src/lib/providers/zoho/index.ts
import * as zohoInvoices from './invoices'
import * as zohoExpenses from './expenses'
import * as zohoReports from './reports'
import * as zohoReportsEnhanced from './reports-enhanced'
import * as zohoBanking from './banking'
import * as zohoCustomers from './customers'
import * as zohoBudgets from './budgets'
import * as zohoPayments from './payments'
import * as zohoOrganizations from './organizations'
import { type ProviderID } from '../database'

export type { ProviderID }

// Define the interface that all providers must implement
export interface FinancialProvider {
  invoices: {
    listInvoices: typeof zohoInvoices.listInvoices
    getInvoice: typeof zohoInvoices.getInvoice
    invoiceStatistics: typeof zohoInvoices.invoiceStatistics
    getInvoicesByCustomer: typeof zohoInvoices.getInvoicesByCustomer
    getOverdueInvoices: typeof zohoInvoices.getOverdueInvoices
    getUnpaidInvoices: typeof zohoInvoices.getUnpaidInvoices
    searchInvoices: typeof zohoInvoices.searchInvoices
    getRecentInvoices: typeof zohoInvoices.getRecentInvoices
    getInvoiceAging: typeof zohoInvoices.getInvoiceAging
  }
  expenses: {
    listExpenses: typeof zohoExpenses.listExpenses
    getExpense: typeof zohoExpenses.getExpense
    expenseCategoriesSummary: typeof zohoExpenses.expenseCategoriesSummary
    getExpensesByCategory: typeof zohoExpenses.getExpensesByCategory
    getExpensesByCustomer: typeof zohoExpenses.getExpensesByCustomer
    searchExpenses: typeof zohoExpenses.searchExpenses
    getRecentExpenses: typeof zohoExpenses.getRecentExpenses
    getMonthlyExpenseTrend: typeof zohoExpenses.getMonthlyExpenseTrend
    getTopExpenseCategories: typeof zohoExpenses.getTopExpenseCategories
  }
  reports: {
    profitAndLoss: typeof zohoReports.profitAndLoss
    cashFlow: typeof zohoReports.cashFlow
    agedReceivables: typeof zohoReports.agedReceivables
    agedPayables: typeof zohoReports.agedPayables
    balanceSheet: typeof zohoReports.balanceSheet
    trialBalance: typeof zohoReports.trialBalance
    profitAndLossComparison: typeof zohoReports.profitAndLossComparison
    financialHealthSummary: typeof zohoReports.financialHealthSummary
    getMonthlyTrends: typeof zohoReports.getMonthlyTrends
    getCompletePnLReport: typeof zohoReportsEnhanced.getCompletePnLReport
    getPnLTrend: typeof zohoReportsEnhanced.getPnLTrend
    exportPnLReport: typeof zohoReportsEnhanced.exportPnLReport
  }
  banking: {
    listBankAccounts: typeof zohoBanking.listBankAccounts
    getBankAccount: typeof zohoBanking.getBankAccount
    listBankTransactions: typeof zohoBanking.listBankTransactions
    getBankTransaction: typeof zohoBanking.getBankTransaction
    getAccountTransactions: typeof zohoBanking.getAccountTransactions
    getRecentTransactions: typeof zohoBanking.getRecentTransactions
    getCashFlowAnalysis: typeof zohoBanking.getCashFlowAnalysis
    getAccountBalanceSummary: typeof zohoBanking.getAccountBalanceSummary
    getUncategorizedTransactions: typeof zohoBanking.getUncategorizedTransactions
    searchTransactions: typeof zohoBanking.searchTransactions
    getTransactionPatterns: typeof zohoBanking.getTransactionPatterns
  }
  customers: {
    listCustomers: typeof zohoCustomers.listCustomers
    getCustomer: typeof zohoCustomers.getCustomer
    getCustomerStatistics: typeof zohoCustomers.getCustomerStatistics
    getCustomerAnalytics: typeof zohoCustomers.getCustomerAnalytics
    getTopCustomersByRevenue: typeof zohoCustomers.getTopCustomersByRevenue
    getCustomersWithCreditAlerts: typeof zohoCustomers.getCustomersWithCreditAlerts
    getCustomerPaymentPatterns: typeof zohoCustomers.getCustomerPaymentPatterns
    searchCustomers: typeof zohoCustomers.searchCustomers
  }
  budgets: {
    getBudgetVsActual: typeof zohoBudgets.getBudgetVsActual
    getBudgetForecast: typeof zohoBudgets.getBudgetForecast
    getBudgetRecommendations: typeof zohoBudgets.getBudgetRecommendations
    createBudgetAlertRules: typeof zohoBudgets.createBudgetAlertRules
    getHistoricalBudgetPerformance: typeof zohoBudgets.getHistoricalBudgetPerformance
    getBudgetOptimizationSuggestions: typeof zohoBudgets.getBudgetOptimizationSuggestions
  }
  payments: {
    listPayments: typeof zohoPayments.listPayments
    getPayment: typeof zohoPayments.getPayment
  }
  organizations: {
    getOrganizationInfo: typeof zohoOrganizations.getOrganizationInfo
    listOrganizations: typeof zohoOrganizations.listOrganizations
  }
}

// QuickBooks provider stub - to be implemented later
const quickbooksProvider: FinancialProvider = {
  invoices: {
    listInvoices: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getInvoice: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    invoiceStatistics: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getInvoicesByCustomer: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getOverdueInvoices: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getUnpaidInvoices: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    searchInvoices: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getRecentInvoices: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getInvoiceAging: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
  },
  expenses: {
    listExpenses: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getExpense: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    expenseCategoriesSummary: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getExpensesByCategory: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getExpensesByCustomer: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    searchExpenses: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getRecentExpenses: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getMonthlyExpenseTrend: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getTopExpenseCategories: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
  },
  reports: {
    profitAndLoss: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    cashFlow: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    agedReceivables: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    agedPayables: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    balanceSheet: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    trialBalance: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    profitAndLossComparison: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    financialHealthSummary: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getMonthlyTrends: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getCompletePnLReport: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getPnLTrend: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    exportPnLReport: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
  },
  banking: {
    listBankAccounts: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getBankAccount: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    listBankTransactions: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getBankTransaction: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getAccountTransactions: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getRecentTransactions: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getCashFlowAnalysis: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getAccountBalanceSummary: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getUncategorizedTransactions: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    searchTransactions: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getTransactionPatterns: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
  },
  customers: {
    listCustomers: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getCustomer: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getCustomerStatistics: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getCustomerAnalytics: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getTopCustomersByRevenue: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getCustomersWithCreditAlerts: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getCustomerPaymentPatterns: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    searchCustomers: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
  },
  budgets: {
    getBudgetVsActual: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getBudgetForecast: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getBudgetRecommendations: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    createBudgetAlertRules: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getHistoricalBudgetPerformance: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getBudgetOptimizationSuggestions: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
  },
  payments: {
    listPayments: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    getPayment: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
  },
  organizations: {
    getOrganizationInfo: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
    listOrganizations: async () => {
      throw new Error('QuickBooks provider not implemented')
    },
  },
}

// Provider registry
const providers: Record<ProviderID, FinancialProvider> = {
  zoho: {
    invoices: zohoInvoices,
    expenses: zohoExpenses,
    reports: {
      ...zohoReports,
      getCompletePnLReport: zohoReportsEnhanced.getCompletePnLReport,
      getPnLTrend: zohoReportsEnhanced.getPnLTrend,
      exportPnLReport: zohoReportsEnhanced.exportPnLReport,
    },
    banking: zohoBanking,
    customers: zohoCustomers,
    budgets: zohoBudgets,
    payments: zohoPayments,
    organizations: zohoOrganizations,
  },
  quickbooks: quickbooksProvider,
  // Placeholder providers - use quickbooks as fallback
  xero: quickbooksProvider,
  stripe: quickbooksProvider,
  // Dynamics BC - data comes from Redshift via Fivetran, not direct API
  dynamics: quickbooksProvider,
  // Shopify - e-commerce data integration
  shopify: quickbooksProvider,
}

/**
 * Get a financial data provider by ID
 * @param id Provider identifier ('zoho' or 'quickbooks')
 * @returns Provider instance with all modules
 */
export function getProvider(id: ProviderID): FinancialProvider {
  const provider = providers[id]
  if (!provider) {
    throw new Error(`Unknown provider: ${id}`)
  }
  return provider
}

/**
 * Get all available provider IDs
 */
export function getAvailableProviders(): ProviderID[] {
  return Object.keys(providers) as ProviderID[]
}

/**
 * Check if a provider is available and implemented
 */
export function isProviderAvailable(id: ProviderID): boolean {
  try {
    const provider = getProvider(id)
    return provider !== quickbooksProvider // For now, only Zoho is fully implemented
  } catch {
    return false
  }
}

/**
 * Convenience function to get the default provider (currently Zoho)
 */
export function getDefaultProvider(): FinancialProvider {
  return getProvider('zoho')
}

// Re-export types from modules for convenience
export type { InvoiceListOptions, InvoiceStatistics } from './invoices'
export type { ExpenseListOptions, ExpenseSummary } from './expenses'
export type {
  ReportOptions,
  ProfitLossData,
  CashFlowData,
  AgedReceivablesData,
  AgedPayablesData,
} from './reports'
export type { BankTransactionOptions, BankAccount, BankTransaction } from './banking'
export type {
  CustomerListOptions,
  Customer,
  CustomerStatistics,
  CustomerAnalytics,
} from './customers'
export type { BudgetListOptions, Budget, BudgetVariance, BudgetForecast } from './budgets'
export type { PaymentListOptions, Payment } from './payments'
export type { Organization } from './organizations'

// Example usage patterns:
/*
// Basic usage
const finance = getProvider('zoho')
const invoices = await finance.invoices.listInvoices(userOrgId, { status: 'sent', limit: 500 })
const customers = await finance.customers.getTopCustomersByRevenue(userOrgId, 10)
const budgetAnalysis = await finance.budgets.getBudgetVsActual(userOrgId, { period: 'this_month' })
const orgInfo = await finance.organizations.getOrganizationInfo(userOrgId)

// Future usage when QuickBooks is implemented
const finance = getProvider('quickbooks')
const expenses = await finance.expenses.listExpenses(userOrgId, { date_start: '2025-01-01' })

// Dynamic provider selection
const providerId = user.preferredProvider || 'zoho'
const finance = getProvider(providerId)
const cashFlow = await finance.reports.cashFlow(userOrgId, { period: 'this_month' })
*/
