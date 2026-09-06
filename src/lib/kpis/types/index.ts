// KPI identifier types
export type KPIId =
  // Revenue
  | 'revenue' | 'arr' | 'mrr' | 'revenue_growth'
  // Profitability
  | 'gross_profit' | 'gross_margin' | 'total_expenses'
  | 'net_income' | 'net_margin' | 'ebitda' | 'ebitda_margin'
  // Cash Flow
  | 'operating_cash_flow' | 'investing_cash_flow' | 'financing_cash_flow'
  | 'net_cash_flow' | 'beginning_cash' | 'days_cash'
  | 'free_cash_flow' | 'burn_rate' | 'runway_months' | 'cash_balance'
  // Liquidity
  | 'current_ratio' | 'quick_ratio' | 'working_capital' | 'working_capital_ratio'
  // Efficiency
  | 'dso' | 'dpo' | 'dio' | 'cash_conversion_cycle'
  // Balance Sheet
  | 'total_assets' | 'total_liabilities' | 'total_equity'
  | 'debt_to_equity' | 'roa' | 'roe' | 'asset_turnover' | 'equity_multiplier'
  // Receivables
  | 'receivables_outstanding' | 'receivables_overdue' | 'receivables_past_due_pct'
  | 'receivables_current_pct' | 'receivables_90_plus_pct'
  | 'avg_invoice_size' | 'customer_count' | 'collection_efficiency'
  // Payables
  | 'payables_outstanding' | 'payables_overdue' | 'payables_past_due_pct'
  | 'payables_current_pct' | 'payables_90_plus_pct'
  | 'avg_bill_size' | 'vendor_count' | 'payment_efficiency'

export type KPICategory =
  | 'revenue'
  | 'profitability'
  | 'cashflow'
  | 'liquidity'
  | 'efficiency'
  | 'balance_sheet'
  | 'receivables'
  | 'payables'

export type KPIFormat =
  | 'currency'
  | 'percentage'
  | 'ratio'
  | 'days'
  | 'months'
  | 'number'

// Financial data input structure
export interface FinancialData {
  pnl?: {
    total_income: number
    cost_of_goods_sold: number
    gross_profit?: number
    total_expenses: number
    operating_expenses?: number
    net_income?: number
    depreciation?: number
    amortization?: number
    interest_expense?: number
    tax_expense?: number
    other_expenses?: number
  }
  balanceSheet?: {
    total_assets: number
    total_liabilities: number
    total_equity: number
    current_assets?: number
    current_liabilities?: number
    cash_and_equivalents?: number
    accounts_receivable?: number
    accounts_payable?: number
    inventory?: number
    short_term_debt?: number
    long_term_debt?: number
    fixed_assets?: number
  }
  cashFlow?: {
    net_cash_from_operating_activities?: number
    net_cash_from_investing_activities?: number
    net_cash_from_financing_activities?: number
    cash_at_beginning?: number
    cash_at_end?: number
    capital_expenditures?: number
  }
  // Supporting data for fallbacks
  invoices?: Array<{
    id: string
    total: number
    date: string
    status: string
    customer_id?: string
    customer_name?: string
    due_date?: string
  }>
  bills?: Array<{
    id: string
    total: number
    date: string
    status: string
    vendor_id?: string
    vendor_name?: string
    due_date?: string
  }>
  deposits?: Array<{
    id: string
    total: number
    date: string
    lines?: Array<{
      account_type: string
      account_name: string
      amount: number
    }>
  }>
  salesReceipts?: Array<{
    id: string
    total: number
    date: string
  }>
  bankAccounts?: Array<{
    id: string
    name: string
    type: string
    balance: number
  }>
  // Aged reports
  agedReceivables?: Array<{
    customer_id?: string
    customer_name?: string
    current: number
    days_1_30?: number
    days_31_60?: number
    days_61_90?: number
    days_over_90?: number
    total: number
  }>
  agedPayables?: Array<{
    vendor_id?: string
    vendor_name?: string
    current: number
    days_1_30?: number
    days_31_60?: number
    days_61_90?: number
    days_over_90?: number
    total: number
  }>
  // Organization profile for context
  profile?: {
    accountingBasis: 'cash' | 'accrual'
    quickbooksVersion?: 'desktop' | 'online'
    currency: string
    fiscalYearStart?: number // Month (1-12)
    industry?: string
  }
  // Period information
  period?: {
    start: Date
    end: Date
    months: number
  }
}

// KPI definition structure
export interface KPIDefinition {
  id: KPIId
  name: string
  displayName?: string
  category: KPICategory
  format: KPIFormat
  precision: number
  calculate: (data: FinancialData) => number
  validate?: (value: number, data: FinancialData) => boolean
  dataSources: string[]
  description: string
  quickbooksField?: string // Direct QB field mapping if applicable
  benchmark?: {
    good: number
    average: number
    poor: number
  }
}

// Calculation result structure
export interface KPIResult {
  id: KPIId
  value: number
  formatted: string
  confidence: 'high' | 'medium' | 'low'
  source: string
  dataQuality?: {
    completeness: number // 0-100
    recency: number // 0-100
    accuracy: number // 0-100
  }
  warnings?: string[]
  metadata?: {
    calculatedAt: Date
    periodStart?: Date
    periodEnd?: Date
    fallbackUsed?: boolean
  }
  semantic?: {
    meaning: string
    interpretation: string
    benchmark?: string
  }
}

// Batch calculation request
export interface KPIBatchRequest {
  kpiIds: KPIId[]
  organizationId: string
  period?: {
    start: string
    end: string
  }
  useCache?: boolean
  includeTrends?: boolean
  includeBreakdown?: boolean
}

// Batch calculation response
export interface KPIBatchResponse {
  results: Record<KPIId, KPIResult>
  metadata: {
    calculationTime: number
    cacheHit: boolean
    dataFreshness: Date
    provider: string
  }
  trends?: Record<KPIId, TrendData>
  breakdown?: Record<KPIId, BreakdownData>
}

// Trend data structure
export interface TrendData {
  direction: 'up' | 'down' | 'stable'
  percentage: number
  previousValue: number
  currentValue: number
  sparkline?: number[]
}

// Breakdown data structure
export interface BreakdownData {
  components: Array<{
    name: string
    value: number
    percentage?: number
  }>
  total: number
}

// Cache entry structure
export interface CacheEntry {
  key: string
  data: any
  timestamp: Date
  ttl: number
  hits: number
}

// Validation result
export interface ValidationResult {
  kpiId: KPIId
  isValid: boolean
  quickbooksValue?: number
  calculatedValue: number
  difference: number
  percentageDiff: number
  possibleReasons?: string[]
}

// Error types
export class KPICalculationError extends Error {
  constructor(
    public kpiId: KPIId,
    public reason: string,
    public originalError?: Error
  ) {
    super(`KPI calculation failed for ${kpiId}: ${reason}`)
    this.name = 'KPICalculationError'
  }
}

export class DataFetchError extends Error {
  constructor(
    public dataSource: string,
    public reason: string,
    public originalError?: Error
  ) {
    super(`Failed to fetch ${dataSource}: ${reason}`)
    this.name = 'DataFetchError'
  }
}