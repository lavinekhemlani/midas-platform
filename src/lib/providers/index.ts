// src/lib/providers/index.ts
import { FinancialProvider } from './interfaces'
import { ProviderID } from './database'

// Import Zoho provider modules
import { auth } from './zoho/auth'
import * as zohoInvoices from './zoho/invoices'
import * as zohoExpenses from './zoho/expenses'
import * as zohoReports from './zoho/reports'
import * as zohoBanking from './zoho/banking'
import * as zohoCustomers from './zoho/customers'
import * as zohoBudgets from './zoho/budgets'
import * as zohoPayments from './zoho/payments'
import * as zohoOrganizations from './zoho/organizations'

// Import QuickBooks auth only - entity modules are deprecated
// Use QuickBooksClient from @/quickbooks/client for all QuickBooks operations
import { auth as quickbooksAuth } from './quickbooks/auth'

// Dynamics BC OAuth auth via Azure AD / Entra ID
import { auth as dynamicsAuth } from './dynamics/auth'

// Shopify OAuth
import { auth as shopifyAuth } from './shopify/auth'

// Provider registry
const providers: Partial<Record<ProviderID, FinancialProvider>> = {
  // Dynamics BC - data comes from Redshift via Fivetran
  dynamics: {
    auth: dynamicsAuth,
    invoices: {} as any,
    expenses: {} as any,
    banking: {} as any,
    customers: {} as any,
    budgets: {} as any,
    payments: {} as any,
    organizations: {} as any,
    reports: {} as any,
  },
  zoho: {
    auth,
    invoices: zohoInvoices,
    expenses: zohoExpenses,
    reports: zohoReports as any,
    banking: zohoBanking,
    customers: zohoCustomers,
    budgets: zohoBudgets,
    payments: zohoPayments,
    organizations: zohoOrganizations,
  },
  // Shopify - e-commerce data integration
  shopify: {
    auth: shopifyAuth,
    invoices: {} as any,
    expenses: {} as any,
    banking: {} as any,
    customers: {} as any,
    budgets: {} as any,
    payments: {} as any,
    organizations: {} as any,
    reports: {} as any,
  },
  // QuickBooks now uses the new unified QuickBooksClient architecture
  // Legacy entity modules have been removed - use @/quickbooks/client instead
  quickbooks: {
    auth: quickbooksAuth,
    invoices: {} as any,
    expenses: {} as any,
    banking: {} as any,
    customers: {} as any,
    budgets: {} as any,
    payments: {} as any,
    organizations: {} as any,
    reports: {
      // Core report methods
      profitAndLoss: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
      cashFlow: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
      balanceSheet: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
      agedReceivables: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
      agedPayables: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
      trialBalance: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
      profitAndLossComparison: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
      financialHealthSummary: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
      getMonthlyTrends: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
      // KPI methods
      getGrossMargin: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
      getARR: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
      getBurnRate: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
      getRunway: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
      getNetProfitMargin: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
      getOperatingCashFlow: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
      getCashBalance: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
      getDSO: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
      getDPO: async () => {
        throw new Error('QuickBooks reports: Use quickbooks_data tool instead')
      },
    },
  },
}

/**
 * Get a provider instance by ID
 */
export function getProvider(
  providerId: ProviderID,
  organizationId: string
): FinancialProvider | null {
  const provider = providers[providerId]
  if (!provider) {
    console.warn(`Provider ${providerId} not found in registry`)
    return null
  }
  return provider
}

/**
 * Get list of available provider IDs
 */
export function getAvailableProviders(): ProviderID[] {
  return Object.keys(providers) as ProviderID[]
}

/**
 * Check if a provider is supported
 */
export function isProviderSupported(providerId: string): providerId is ProviderID {
  return providerId in providers
}

// Re-export types and interfaces
export * from './interfaces'
export * from './database'
export type { ProviderID }
