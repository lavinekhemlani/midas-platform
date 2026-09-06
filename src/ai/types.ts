// src/ai/types.ts
// Core types for financial data structures

// =============================================================================
// Re-export Memory types from canonical location
// =============================================================================

export type { Memory, MemoryType } from './memory/types'

// =============================================================================
// Date Types
// =============================================================================

export interface DateRange {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
}

export type ReportPeriod =
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year'

// =============================================================================
// Executive Summary
// =============================================================================

export interface ExecutiveSummaryData {
  period: string
  generatedAt: string
  organization: string
  currency: string
  keyMetrics: {
    revenue: {
      current: number
      previous: number
      change: number
      changePercent: number
      grossMargin: number
      netMargin: number
    }
    profit: {
      current: number
      previous: number
      change: number
      changePercent: number
      margin: number
      ebitda: number
    }
    expenses: {
      current: number
      previous: number
      change: number
      changePercent: number
      ratio: number
      burnRate: number
    }
    cashFlow: {
      current: number
      operating: number
      investing: number
      financing: number
      netChange: number
      runway: number
      burnRate: number
    }
  }
  financialHealth: {
    score: number
    trend: 'improving' | 'stable' | 'declining'
    factors: Array<{
      name: string
      score: number
      weight: number
    }>
  }
  revenueBreakdown: Array<{
    category: string
    amount: number
    percentage: number
    trend: string
  }>
  expenseBreakdown: Array<{
    category: string
    amount: number
    percentage: number
    optimized: boolean
  }>
  insights: Array<{
    type: 'positive' | 'warning' | 'info'
    priority: 'high' | 'medium' | 'low'
    title: string
    description: string
    metric: string
    actionable: boolean
  }>
}

// =============================================================================
// Profit & Loss
// =============================================================================

export interface ProfitLossData {
  kpis: {
    totalRevenue: number
    totalExpenses: number
    netIncome: number
    profitMargin: number
    expenseRatio: number
    grossProfit: number
    costOfGoodsSold: number
    otherExpenses: number
    otherIncome: number
    operatingExpenses: number
    grossMargin: number
    operatingMargin: number
    ebitda: number
    burnRate: number
    grossBurnRate: number
    cashBalance: number
  }
  revenueByCategory?: Array<{
    name: string
    value: number
    percentage: number
    isContraRevenue?: boolean
  }>
  expenseCategories?: Array<{
    name: string
    section: 'COGS' | 'Operating' | 'Other'
    amount: number
    percentage: number
  }>
  insights: {
    positive: string[]
    concerns: string[]
  }
}

// =============================================================================
// Balance Sheet
// =============================================================================

export interface BalanceSheetData {
  kpis: {
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
    workingCapital: number
    currentAssets: number
    currentLiabilities: number
    inventory: number
    currentRatio: number
    debtToEquity: number
    quickRatio: number
    roa: number
  }
  assetComposition?: Array<{
    name: string
    value: number
    percentage: number
  }>
  liabilityBreakdown?: Array<{
    name: string
    value: number
    percentage: number
  }>
  equityComposition?: Array<{
    name: string
    value: number
    percentage: number
  }>
  ratios: {
    assetTurnover: number
    equityMultiplier: number
    returnOnEquity: number
    debtRatio: number
    revenue: number
    netIncome: number
    totalDebt: number
  }
}

// =============================================================================
// Cash Flow
// =============================================================================

export interface CashFlowData {
  kpis: {
    operatingCashFlow: number
    investingCashFlow: number
    financingCashFlow: number
    netCashFlow: number
    cashBeginning: number
    cashEnding: number
  }
  cashMetrics: {
    burn_rate: number
    runway_months: number
    days_cash: number
    operating_cash_flow_ratio: number
    free_cash_flow: number
    cash_conversion_cycle: number
    operating_cash_flow_margin: number
    cash_flow_coverage_ratio: number
  }
  operatingActivities?: Array<{ item: string; amount: number }>
  investingActivities?: Array<{ item: string; amount: number }>
  financingActivities?: Array<{ item: string; amount: number }>
  waterfallChart?: Array<{ name: string; value: number }>
}

// =============================================================================
// Sales Data
// =============================================================================

export interface SalesData {
  salesByCustomer: Array<{
    id: string
    name: string
    totalSales: number
    invoiceCount: number
    salesReceiptCount: number
    transactions: Array<{
      id: string
      type: 'Invoice' | 'SalesReceipt'
      date: string
      amount: number
      docNumber: string
      dueDate?: string
      balance?: number
    }>
  }>
  summary: {
    totalSales: number
    totalTransactions: number
    customerCount: number
  }
}

// =============================================================================
// Bills/Expenses Data
// =============================================================================

export interface BillsData {
  bills: Array<{
    id: string
    vendorName: string
    amount: number
    balance: number
    dueDate: string
    status: 'paid' | 'unpaid' | 'overdue'
  }>
  kpis: {
    totalBills: number
    totalAmount: number
    totalPaid: number
    totalUnpaid: number
    overdueCount: number
    overdueAmount: number
    vendorCount: number
  }
  vendorSummary: Array<{
    name: string
    totalAmount: number
    unpaidAmount: number
    billCount: number
  }>
}

// =============================================================================
// Agent Context
// =============================================================================

export interface AgentContext {
  organizationId: string
  userId: string
  accessToken: string
  realmId: string
  currency: string
  companyName: string
  threadId: string
  // Optional context for personalization
  userRole?: string // CEO, CFO, Founder, etc.
  strategicFocus?: 'growth' | 'profitability' | 'runway' | 'balanced'
}

// =============================================================================
// Tool Response
// =============================================================================

export interface ToolResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
