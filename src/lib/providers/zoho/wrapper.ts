// src/lib/providers/zoho/wrapper.ts
// This wrapper provides a consistent interface for Zoho providers that matches QuickBooks
// It handles the apiClient internally so that the KPI route doesn't need to pass it

import { ProviderApiClient } from '../apiClient';
import * as zohoReports from './reports';
import * as zohoOrganizations from './organizations';
import * as zohoBanking from './banking';
import * as zohoInvoices from './invoices';
import * as zohoExpenses from './expenses';
import * as zohoCustomers from './customers';

/**
 * Creates a wrapped Zoho provider that handles apiClient internally
 * This ensures consistency with QuickBooks which creates its own client
 */
export function createZohoProviderWrapper(apiClient: ProviderApiClient) {
  return {
    reports: {
      profitAndLoss: (organizationId: string, options?: any) => 
        zohoReports.profitAndLoss(organizationId, options || {}, apiClient),
      
      cashFlow: (organizationId: string, options?: any) => 
        zohoReports.cashFlow(organizationId, options || {}, apiClient),
      
      balanceSheet: (organizationId: string, options?: any) => 
        zohoReports.balanceSheet(organizationId, options || {}, apiClient),
      
      agedReceivables: (organizationId: string, options?: any) => 
        zohoReports.agedReceivables(organizationId, options || {}, apiClient),
      
      agedPayables: (organizationId: string, options?: any) => 
        zohoReports.agedPayables(organizationId, options || {}, apiClient),
      
      trialBalance: (organizationId: string, options?: any) => 
        zohoReports.trialBalance(organizationId, options || {}, apiClient),
      
      profitAndLossComparison: (organizationId: string, currentPeriod?: any, previousPeriod?: any) => 
        zohoReports.profitAndLossComparison(organizationId, currentPeriod || {}, previousPeriod || {}, apiClient),
      
      financialHealthSummary: (organizationId: string, options?: any) => 
        zohoReports.financialHealthSummary(organizationId, options || {}, apiClient),
      
      getMonthlyTrends: (organizationId: string, months?: number) => 
        zohoReports.getMonthlyTrends(organizationId, months, apiClient),
    },
    
    organizations: {
      getOrganizationInfo: (organizationId: string) => 
        zohoOrganizations.getOrganizationInfo(organizationId, apiClient),
      
      listOrganizations: (organizationId: string) => 
        zohoOrganizations.listOrganizations(organizationId, apiClient),
    },
    
    banking: {
      listBankAccounts: (organizationId: string, options?: any) => 
        zohoBanking.listBankAccounts(organizationId, options || {}, apiClient),
      
      getBankAccount: (organizationId: string, accountId: string) => 
        zohoBanking.getBankAccount(organizationId, accountId, apiClient),
      
      listBankTransactions: (organizationId: string, options?: any) => 
        zohoBanking.listBankTransactions(organizationId, options || {}, apiClient),
      
      getBankTransaction: (organizationId: string, transactionId: string) => 
        zohoBanking.getBankTransaction(organizationId, transactionId, apiClient),
      
      getAccountTransactions: (organizationId: string, accountId: string, options?: any) => 
        zohoBanking.getAccountTransactions(organizationId, accountId, options || {}, apiClient),
      
      getRecentTransactions: (organizationId: string, days?: number) => 
        zohoBanking.getRecentTransactions(organizationId, days, {}, apiClient),
      
      getCashFlowAnalysis: (organizationId: string, accountId?: string, days?: number) => 
        zohoBanking.getCashFlowAnalysis(organizationId, accountId, days || 30, apiClient),
      
      getAccountBalanceSummary: (organizationId: string) => 
        zohoBanking.getAccountBalanceSummary(organizationId, apiClient),
      
      getUncategorizedTransactions: (organizationId: string, limit?: number) => 
        zohoBanking.getUncategorizedTransactions(organizationId, undefined, apiClient),
      
      searchTransactions: (organizationId: string, searchText: string, accountId?: string) => 
        zohoBanking.searchTransactions(organizationId, searchText, accountId, {}, apiClient),
      
      getTransactionPatterns: (organizationId: string, accountId?: string, days?: number) => 
        zohoBanking.getTransactionPatterns(organizationId, accountId, days, apiClient),
    },
    
    invoices: {
      listInvoices: (organizationId: string, options?: any) => 
        zohoInvoices.listInvoices(organizationId, options || {}, apiClient),
      
      getInvoice: (organizationId: string, invoiceId: string) => 
        zohoInvoices.getInvoice(organizationId, invoiceId, apiClient),
      
      invoiceStatistics: (organizationId: string, options?: any) => 
        zohoInvoices.invoiceStatistics(organizationId, options || {}, apiClient),
      
      getInvoicesByCustomer: (organizationId: string, customerId: string, options?: any) => 
        zohoInvoices.getInvoicesByCustomer(organizationId, customerId, options || {}, apiClient),
      
      getOverdueInvoices: (organizationId: string, options?: any) => 
        zohoInvoices.getOverdueInvoices(organizationId, options || {}, apiClient),
      
      getUnpaidInvoices: (organizationId: string, options?: any) => 
        zohoInvoices.getUnpaidInvoices(organizationId, options || {}, apiClient),
      
      searchInvoices: (organizationId: string, searchText: string, options?: any) => 
        zohoInvoices.searchInvoices(organizationId, searchText, options || {}, apiClient),
      
      getRecentInvoices: (organizationId: string, days?: number, options?: any) => 
        zohoInvoices.getRecentInvoices(organizationId, days, options || {}, apiClient),
      
      getInvoiceAging: (organizationId: string) => 
        zohoInvoices.getInvoiceAging(organizationId, apiClient),
    },
    
    expenses: {
      listExpenses: (organizationId: string, options?: any) => 
        zohoExpenses.listExpenses(organizationId, options || {}, apiClient),
      
      getExpense: (organizationId: string, expenseId: string) => 
        zohoExpenses.getExpense(organizationId, expenseId, apiClient),
      
      expenseCategoriesSummary: (organizationId: string, options?: any) => 
        zohoExpenses.expenseCategoriesSummary(organizationId, options || {}, apiClient),
      
      getExpensesByCategory: (organizationId: string, categoryId: string, options?: any) => 
        zohoExpenses.getExpensesByCategory(organizationId, categoryId, options || {}, apiClient),
      
      getExpensesByCustomer: (organizationId: string, customerId: string, options?: any) => 
        zohoExpenses.getExpensesByCustomer(organizationId, customerId, options || {}, apiClient),
      
      searchExpenses: (organizationId: string, searchText: string, options?: any) => 
        zohoExpenses.searchExpenses(organizationId, searchText, options || {}, apiClient),
      
      getRecentExpenses: (organizationId: string, days?: number, options?: any) => 
        zohoExpenses.getRecentExpenses(organizationId, days, options || {}, apiClient),
      
      getMonthlyExpenseTrend: (organizationId: string, months?: number) => 
        zohoExpenses.getMonthlyExpenseTrend(organizationId, months, apiClient),
      
      getTopExpenseCategories: (organizationId: string, limit?: number, options?: any) => 
        zohoExpenses.getTopExpenseCategories(organizationId, limit, options || {}, apiClient),
    },
    
    customers: {
      listCustomers: (organizationId: string, options?: any) => 
        zohoCustomers.listCustomers(organizationId, options || {}, apiClient),
      
      getCustomer: (organizationId: string, customerId: string) => 
        zohoCustomers.getCustomer(organizationId, customerId, apiClient),
      
      getCustomerStatistics: (organizationId: string) => 
        zohoCustomers.getCustomerStatistics(organizationId, apiClient),
      
      getCustomerAnalytics: (organizationId: string, customerId?: string, options?: any) => 
        zohoCustomers.getCustomerAnalytics(organizationId, customerId, options || {}, apiClient),
      
      getTopCustomersByRevenue: (organizationId: string, limit?: number, options?: any) => 
        zohoCustomers.getTopCustomersByRevenue(organizationId, limit, options || {}, apiClient),
      
      getCustomersWithCreditAlerts: (organizationId: string, options?: any) => 
        zohoCustomers.getCustomersWithCreditAlerts(organizationId, options || {}, apiClient),
      
      getCustomerPaymentPatterns: (organizationId: string, customerId: string, options?: any) => 
        zohoCustomers.getCustomerPaymentPatterns(organizationId, customerId, options || {}, apiClient),
      
      searchCustomers: (organizationId: string, searchText: string, options?: any) => 
        zohoCustomers.searchCustomers(organizationId, searchText, options || {}, apiClient),
    },
    
    // Items and Vendors are not available in all Zoho plans
    // Return empty stubs to prevent errors
    items: {
      listItems: (organizationId: string, options?: any) => 
        Promise.resolve([]), // Not available in all plans
    },
    
    vendors: {
      listVendors: (organizationId: string, options?: any) => 
        Promise.resolve([]), // Not available in all plans
    }
  };
}