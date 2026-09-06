/**
 * Type definitions for Cash Flow Report API
 */

export interface CashFlowReportRequest {
  start?: string // YYYY-MM-DD format
  end?: string // YYYY-MM-DD format
  details?: boolean
}

export interface CashFlowActivity {
  item: string
  amount: number
}

export interface CashFlowKPIs {
  operatingCashFlow: number
  investingCashFlow: number
  financingCashFlow: number
  netCashFlow: number
  cashBeginning: number
  cashEnding: number
  cash_balance: number // Alias for cashEnding - used by metric handler
}

export interface CashFlowMetrics {
  burn_rate: number
  runway_months: number
  days_cash: number
  operating_cash_flow_ratio: number
  free_cash_flow: number
  cash_conversion_cycle: number
  operating_cash_flow_margin: number
  cash_flow_coverage_ratio: number
}

export interface MonthlyFlow {
  month: string
  operating: number
  investing: number
  financing: number
  totalCash?: number // Total cash balance at end of month
  endingCash?: number // Alternative field name for ending cash balance
}

export interface WaterfallChartData {
  name: string // Changed from 'category' to match horizontal-bar format
  value: number
  color?: string // Optional since horizontal-bar handles colors automatically
}

export interface CashFlowReportData {
  kpis: CashFlowKPIs
  cashMetrics: CashFlowMetrics
  monthlyFlow?: MonthlyFlow[]
  operatingActivities?: CashFlowActivity[]
  investingActivities?: CashFlowActivity[]
  financingActivities?: CashFlowActivity[]
  waterfallChart: WaterfallChartData[]
  errors?: string[]
}

export interface CashFlowReportResponse {
  reportType: 'cash_flow'
  organizationId: string
  organizationName: string
  fromDate: string
  toDate: string
  currency: string
  generated: string
  data: CashFlowReportData
}

export interface CashFlowError {
  error: string
  details: string
}
