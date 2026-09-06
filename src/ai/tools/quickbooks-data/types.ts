// src/ai/tools/quickbooks-data/types.ts
// TypeScript types for QuickBooks data tool

import type { FinancialProvider } from '@/lib/providers/interfaces'
import type { ProviderApiClient } from '@/lib/providers/apiClient'
import type { QuickBooksClient } from '@/lib/providers/quickbooks/client'

// =============================================================================
// Tool Context Type (shared with financial.ts)
// =============================================================================

export interface ToolContext {
  organizationId: string
  provider: FinancialProvider
  apiClient: ProviderApiClient | QuickBooksClient
  currency: string
  correlationId?: string
  userId?: string
  realmId?: string
}

// =============================================================================
// Base Query Type
// =============================================================================

export type QueryType = 'report' | 'analyze' | 'compare' | 'entity' | 'metric' | 'search'

// =============================================================================
// Report Query (fetch standard financial reports)
// =============================================================================

export interface ReportQuery {
  queryType: 'report'
  reportType:
    | 'profit_loss'
    | 'balance_sheet'
    | 'cash_flow'
    | 'aged_receivables'
    | 'aged_receivables_detail'
    | 'aged_payables'
    | 'aged_payables_detail'
    | 'financial_health'
    | 'sales'
    | 'bills'
  period?:
    | 'this_month'
    | 'last_month'
    | 'this_quarter'
    | 'last_quarter'
    | 'this_year'
    | 'last_year'
    | null
  startDate?: string | null // YYYY-MM-DD
  endDate?: string | null // YYYY-MM-DD
  summarizeBy?: 'Month' | 'Quarter' | 'Year' | 'Total' | null
}

// =============================================================================
// Analyze Query (deep dive analysis with AI insights)
// =============================================================================

export interface AnalyzeQuery {
  queryType: 'analyze'
  analysisType: 'trends' | 'anomalies' | 'forecast' | 'breakdown' | 'performance'
  focusArea?: 'revenue' | 'expenses' | 'cash_flow' | 'profitability' | 'liquidity'
  period?: 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year'
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  includeRecommendations?: boolean
}

// =============================================================================
// Compare Query (period-over-period or entity comparisons)
// =============================================================================

export interface CompareQuery {
  queryType: 'compare'
  compareType: 'period' | 'budget' | 'forecast' | 'benchmark'
  compareReportType?:
    | 'profit_loss'
    | 'balance_sheet'
    | 'cash_flow'
    | 'aged_receivables'
    | 'aged_payables'
  metric?: 'revenue' | 'expenses' | 'profit' | 'cash_flow' | 'margins'
  currentPeriod?: string
  comparisonPeriod?: string
  currentStartDate?: string // YYYY-MM-DD
  currentEndDate?: string // YYYY-MM-DD
  comparisonStartDate?: string // YYYY-MM-DD
  comparisonEndDate?: string // YYYY-MM-DD
}

// =============================================================================
// Entity Query (fetch specific entities: customers, vendors, accounts, etc.)
// =============================================================================

export interface EntityQuery {
  queryType: 'entity'
  entityType: 'customer' | 'vendor' | 'account' | 'invoice' | 'bill' | 'payment' | 'transaction'
  entityId?: string // Optional: specific entity ID
  filters?: {
    status?: 'active' | 'inactive' | 'all'
    minAmount?: number
    maxAmount?: number
    startDate?: string // YYYY-MM-DD
    endDate?: string // YYYY-MM-DD
    category?: string
    customerId?: string // Filter invoices by customer ID
    customerName?: string // Filter invoices by customer name (partial match)
    vendorId?: string // Filter bills by vendor ID
    vendorName?: string // Filter bills by vendor name (partial match)
    docNumber?: string // Invoice/Bill document number (e.g., INV-2360)
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }
  limit?: number
  offset?: number
}

// =============================================================================
// Metric Query (single KPI or calculated metric)
// =============================================================================

export interface MetricQuery {
  queryType: 'metric'
  metricName:
    | 'revenue'
    | 'net_income'
    | 'gross_margin'
    | 'operating_margin'
    | 'current_ratio'
    | 'quick_ratio'
    | 'debt_to_equity'
    | 'cash_balance'
    | 'burn_rate'
    | 'runway_months'
    | 'ar_aging'
    | 'ap_aging'
  period?: 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year'
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  includeHistory?: boolean // Include historical trend data
}

// =============================================================================
// Search Query (natural language search across all QuickBooks data)
// =============================================================================

export interface SearchQuery {
  queryType: 'search'
  searchText: string
  searchScope?: 'all' | 'transactions' | 'entities' | 'reports'
  limit?: number
}

// =============================================================================
// Flattened Input Type (for LLM compatibility)
// =============================================================================
// Note: Using a flat interface instead of discriminated union to match the
// flattened Zod schema and avoid Claude API validation issues.

export interface QuickBooksDataInput {
  // Query type discriminator
  queryType: QueryType

  // Multi-entity: which QB company to query (optional, defaults to active)
  realmId?: string

  // Report query fields
  reportType?:
    | 'profit_loss'
    | 'balance_sheet'
    | 'cash_flow'
    | 'aged_receivables'
    | 'aged_receivables_detail'
    | 'aged_payables'
    | 'aged_payables_detail'
    | 'financial_health'
    | 'sales'
    | 'bills'
    | null

  // Analyze query fields
  analysisType?: 'trends' | 'anomalies' | 'forecast' | 'breakdown' | 'performance'
  focusArea?: 'revenue' | 'expenses' | 'cash_flow' | 'profitability' | 'liquidity'
  includeRecommendations?: boolean

  // Compare query fields
  compareType?: 'period' | 'budget' | 'forecast' | 'benchmark'
  compareReportType?:
    | 'profit_loss'
    | 'balance_sheet'
    | 'cash_flow'
    | 'aged_receivables'
    | 'aged_payables'
  metric?: 'revenue' | 'expenses' | 'profit' | 'cash_flow' | 'margins'
  currentPeriod?: string
  comparisonPeriod?: string
  currentStartDate?: string // YYYY-MM-DD
  currentEndDate?: string // YYYY-MM-DD
  comparisonStartDate?: string // YYYY-MM-DD
  comparisonEndDate?: string // YYYY-MM-DD

  // Entity query fields
  entityType?: 'customer' | 'vendor' | 'account' | 'invoice' | 'bill' | 'payment' | 'transaction'
  entityId?: string
  filters?: {
    status?: 'active' | 'inactive' | 'all'
    minAmount?: number
    maxAmount?: number
    startDate?: string // YYYY-MM-DD
    endDate?: string // YYYY-MM-DD
    category?: string
    customerId?: string // Filter invoices by customer ID
    customerName?: string // Filter invoices by customer name (partial match)
    vendorId?: string // Filter bills by vendor ID
    vendorName?: string // Filter bills by vendor name (partial match)
    docNumber?: string // Invoice/Bill document number (e.g., INV-2360)
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }
  includePdfActions?: boolean // Only show PDF widgets when explicitly requested
  offset?: number

  // Metric query fields
  metricName?:
    | 'revenue'
    | 'net_income'
    | 'gross_margin'
    | 'operating_margin'
    | 'current_ratio'
    | 'quick_ratio'
    | 'debt_to_equity'
    | 'cash_balance'
    | 'burn_rate'
    | 'runway_months'
    | 'ar_aging'
    | 'ap_aging'
  includeHistory?: boolean

  // Search query fields
  searchText?: string
  searchScope?: 'all' | 'transactions' | 'entities' | 'reports'

  // Shared fields (used by multiple query types)
  period?: 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year'
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  summarizeBy?: string // Accepts any string, normalized to 'Month' | 'Quarter' | 'Year' | 'Total' in query-planner
  limit?: number
}

// =============================================================================
// Result Types
// =============================================================================

export interface QuickBooksDataResult {
  success: boolean
  queryType: QueryType
  data?: any
  summary?: {
    total?: number
    count?: number
    period?: string
    currency?: string
    [key: string]: any
  }
  currency?: string
  error?: string
  timestamp?: string
}
