// src/lib/providers/interfaces/reports.ts
import { BaseQueryOptions } from './invoices'

/**
 * Options for generating reports across different providers
 */
export interface ReportOptions extends BaseQueryOptions {
  period?:
    | 'today'
    | 'this_week'
    | 'this_month'
    | 'this_quarter'
    | 'this_year'
    | 'yesterday'
    | 'previous_week'
    | 'previous_month'
    | 'previous_quarter'
    | 'previous_year'
    | 'last_7_days'
    | 'last_30_days'
    | 'last_90_days'
    | 'last_365_days'
    | 'custom'
  start_date?: string
  end_date?: string
  from_date?: string
  to_date?: string
  report_basis?: 'cash' | 'accrual'
}

/**
 * Profit and Loss report data structure
 */
export interface ProfitLossData {
  report_name: string
  start_date: string
  end_date: string
  report_basis: string
  income: any[]
  cost_of_goods_sold: any[]
  gross_profit: number
  expenses: any[] // Operating expenses only
  other_expense_items?: any[] // Other expense line items (separate from operating)
  other_income_items?: any[] // Other income line items (non-operating income)
  net_income: number
  total_income: number
  total_expenses: number // Operating expenses total
  other_expenses?: number // Other expenses total
  other_income?: number // Other income total (non-operating income)
  cogs_total?: number
}

/**
 * Cash Flow line item structure
 */
export interface CashFlowLineItem {
  item: string
  amount: number
  isSubItem?: boolean // For nested items like adjustments
}

/**
 * Cash Flow section structure
 */
export interface CashFlowSection {
  name: string
  items: CashFlowLineItem[]
  total: number
}

/**
 * Cash Flow report data structure
 */
export interface CashFlowData {
  report_name: string
  start_date: string
  end_date: string
  net_cash_from_operating_activities: number
  net_cash_from_investing_activities: number
  net_cash_from_financing_activities: number
  net_change_in_cash: number
  cash_at_beginning: number
  cash_at_end: number
  // Detailed sections (optional, for providers that support it)
  operating_activities_details?: CashFlowSection
  investing_activities_details?: CashFlowSection
  financing_activities_details?: CashFlowSection
}

/**
 * Aged Receivables report data structure
 */
export interface AgedReceivablesData {
  report_name: string
  report_date: string
  contact_name: string
  current: number
  days_1_30: number
  days_31_60: number
  days_61_90: number
  days_over_90: number
  total: number
}

/**
 * Aged Payables report data structure
 */
export interface AgedPayablesData {
  report_name: string
  report_date: string
  vendor_name: string
  current: number
  days_1_30: number
  days_31_60: number
  days_61_90: number
  days_over_90: number
  total: number
}

/**
 * Balance Sheet report data structure
 */
export interface BalanceSheetData {
  report_name: string
  report_date: string
  assets: any[]
  liabilities: any[]
  equity: any[]
  total_assets: number
  total_liabilities: number
  total_equity: number
  cash_and_equivalents?: number // Optional for backward compatibility
  accounts_receivable?: number // Optional for backward compatibility
  accounts_payable?: number // Optional for backward compatibility
}

/**
 * Trial Balance report data structure
 */
export interface TrialBalanceData {
  report_name: string
  start_date: string
  end_date: string
  accounts: Array<{
    account_name: string
    account_type: string
    debit_balance: number
    credit_balance: number
  }>
  total_debit: number
  total_credit: number
}

/**
 * P&L comparison data structure
 */
export interface ProfitLossComparison {
  current: ProfitLossData
  previous: ProfitLossData
  variance: {
    revenue_change: number
    revenue_change_percent: number
    expense_change: number
    expense_change_percent: number
    profit_change: number
    profit_change_percent: number
  }
}

/**
 * Financial health summary data structure
 */
export interface FinancialHealthSummary {
  profitability: {
    gross_profit_margin: number
    net_profit_margin: number
    revenue_growth: number
  }
  liquidity: {
    current_ratio: number
    quick_ratio: number
    cash_flow_operational: number
  }
  efficiency: {
    total_receivables: number
    total_payables: number
    working_capital: number
  }
}

/**
 * Monthly trends data structure
 */
export interface MonthlyTrend {
  month: string
  revenue: number
  expenses: number
  profit: number
  cash_flow: number
}

/**
 * New KPI-specific methods for optimized calculations
 */
export interface KPIProvider {
  /**
   * Get Gross Margin directly from P&L data
   * @param userOrgId - The organization ID
   * @param period - Report period options
   * @returns Promise resolving to gross margin percentage
   */
  getGrossMargin(userOrgId: string, period?: ReportOptions): Promise<number>

  /**
   * Calculate ARR from recurring revenue data
   * @param userOrgId - The organization ID
   * @param period - Report period options
   * @returns Promise resolving to ARR value
   */
  getARR(userOrgId: string, period?: ReportOptions): Promise<number>

  /**
   * Get burn rate from expense data
   * @param userOrgId - The organization ID
   * @param period - Report period options
   * @returns Promise resolving to monthly burn rate
   */
  getBurnRate(userOrgId: string, period?: ReportOptions): Promise<number>

  /**
   * Calculate runway from cash balance and burn rate
   * @param userOrgId - The organization ID
   * @param period - Report period options
   * @returns Promise resolving to runway in months
   */
  getRunway(userOrgId: string, period?: ReportOptions): Promise<number>

  /**
   * Get Net Profit Margin from P&L ratios
   * @param userOrgId - The organization ID
   * @param period - Report period options
   * @returns Promise resolving to net profit margin percentage
   */
  getNetProfitMargin(userOrgId: string, period?: ReportOptions): Promise<number>

  /**
   * Get operating cash flow from cash flow statement
   * @param userOrgId - The organization ID
   * @param period - Report period options
   * @returns Promise resolving to operating cash flow
   */
  getOperatingCashFlow(userOrgId: string, period?: ReportOptions): Promise<number>

  /**
   * Get current cash balance
   * @param userOrgId - The organization ID
   * @returns Promise resolving to current cash balance
   */
  getCashBalance(userOrgId: string): Promise<number>

  /**
   * Get Days Sales Outstanding (DSO)
   * @param userOrgId - The organization ID
   * @param period - Report period options
   * @returns Promise resolving to DSO in days
   */
  getDSO(userOrgId: string, period?: ReportOptions): Promise<number>

  /**
   * Get Days Payable Outstanding (DPO)
   * @param userOrgId - The organization ID
   * @param period - Report period options
   * @returns Promise resolving to DPO in days
   */
  getDPO(userOrgId: string, period?: ReportOptions): Promise<number>
}

/**
 * Interface that all report providers must implement
 */
export interface ReportProvider extends KPIProvider {
  /**
   * Get Profit and Loss report
   * @param userOrgId - The organization ID
   * @param options - Report options including date range and basis
   * @returns Promise resolving to P&L data
   */
  profitAndLoss(userOrgId: string, options?: ReportOptions): Promise<ProfitLossData>

  /**
   * Get Cash Flow report
   * @param userOrgId - The organization ID
   * @param options - Report options including date range
   * @returns Promise resolving to cash flow data
   */
  cashFlow(userOrgId: string, options?: ReportOptions): Promise<CashFlowData>

  /**
   * Get Aged Receivables report
   * @param userOrgId - The organization ID
   * @param options - Report options
   * @returns Promise resolving to aged receivables data
   */
  agedReceivables(
    userOrgId: string,
    options?: Omit<ReportOptions, 'period' | 'report_basis'>
  ): Promise<{ receivables: AgedReceivablesData[]; total: number }>

  /**
   * Get Aged Payables report
   * @param userOrgId - The organization ID
   * @param options - Report options
   * @returns Promise resolving to aged payables data
   */
  agedPayables(
    userOrgId: string,
    options?: Omit<ReportOptions, 'period' | 'report_basis'>
  ): Promise<{ payables: AgedPayablesData[]; total: number }>

  /**
   * Get Balance Sheet report
   * @param userOrgId - The organization ID
   * @param options - Report options
   * @returns Promise resolving to balance sheet data
   */
  balanceSheet(userOrgId: string, options?: ReportOptions): Promise<BalanceSheetData>

  /**
   * Get Trial Balance report
   * @param userOrgId - The organization ID
   * @param options - Report options
   * @returns Promise resolving to trial balance data
   */
  trialBalance(userOrgId: string, options?: ReportOptions): Promise<TrialBalanceData>

  /**
   * Get Profit and Loss comparison between periods
   * @param userOrgId - The organization ID
   * @param currentPeriod - Current period options
   * @param previousPeriod - Previous period options
   * @returns Promise resolving to P&L comparison data
   */
  profitAndLossComparison(
    userOrgId: string,
    currentPeriod?: ReportOptions,
    previousPeriod?: ReportOptions
  ): Promise<ProfitLossComparison>

  /**
   * Get financial health summary
   * @param userOrgId - The organization ID
   * @param period - Report period options
   * @returns Promise resolving to financial health summary
   */
  financialHealthSummary(userOrgId: string, period?: ReportOptions): Promise<FinancialHealthSummary>

  /**
   * Get monthly trends for key metrics
   * @param userOrgId - The organization ID
   * @param months - Number of months to look back (default: 12)
   * @returns Promise resolving to monthly trends data
   */
  getMonthlyTrends(userOrgId: string, months?: number): Promise<MonthlyTrend[]>
}
