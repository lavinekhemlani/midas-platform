// src/app/(main)/reports/types/metrics.ts

/**
 * Base metric interface for all financial metrics displayed across reports
 */
export interface BaseMetric {
  /** Display label for the metric */
  label: string
  /** Numeric value of the metric */
  value: number
  /** Display format type */
  format: 'currency' | 'percentage' | 'number' | 'ratio' | 'custom'
  /** Optional Lucide icon component */
  icon?: any
  /** Optional color class for the icon (e.g., 'emerald', 'red', 'blue') */
  color?: string
}

/**
 * Profit & Loss key performance indicators
 */
export interface PnLMetrics {
  /** Total revenue for the period */
  totalRevenue?: number
  /** Total expenses for the period */
  totalExpenses?: number
  /** Net income (profit/loss) for the period */
  netIncome?: number
  /** Gross profit (revenue - COGS) */
  grossProfit?: number
  /** Cost of goods sold */
  costOfGoodsSold?: number
  /** Operating expenses */
  operatingExpenses?: number
  /** Other expenses */
  otherExpenses?: number
  /** Gross profit margin percentage */
  grossMargin?: number | null
  /** Operating profit margin percentage */
  operatingMargin?: number | null
  /** Net profit margin percentage */
  netProfitMargin?: number | null
  /** Expense ratio (expenses / revenue) */
  expenseRatio?: number | null
  /** EBITDA (Earnings Before Interest, Taxes, Depreciation, Amortization) */
  ebitda?: number
  /** Interest expense */
  interestExpense?: number
  /** Tax expense */
  taxExpense?: number
  /** Depreciation and amortization */
  depreciationAmortization?: number
  /** Number of months in the reporting period */
  monthsInPeriod?: number
}

/**
 * Balance Sheet key performance indicators
 */
export interface BalanceSheetMetrics {
  /** Total assets */
  totalAssets?: number
  /** Total liabilities */
  totalLiabilities?: number
  /** Total equity (assets - liabilities) */
  totalEquity?: number
  /** Current assets */
  currentAssets?: number
  /** Current liabilities */
  currentLiabilities?: number
  /** Working capital (current assets - current liabilities) */
  workingCapital?: number
  /** Current ratio (current assets / current liabilities) */
  currentRatio?: number
  /** Quick ratio (liquid assets / current liabilities) */
  quickRatio?: number
  /** Debt-to-equity ratio */
  debtToEquity?: number
  /** Asset turnover ratio */
  assetTurnover?: number
  /** Equity multiplier */
  equityMultiplier?: number
  /** Return on equity percentage */
  returnOnEquity?: number
  /** Debt ratio (total debt / total assets) */
  debtRatio?: number
}

/**
 * Cash Flow key performance indicators
 */
export interface CashFlowMetrics {
  /** Ending cash balance */
  cashEnding?: number
  /** Beginning cash balance */
  cashBeginning?: number
  /** Net cash from operating activities */
  operatingCashFlow?: number
  /** Net cash from investing activities */
  investingCashFlow?: number
  /** Net cash from financing activities */
  financingCashFlow?: number
  /** Net change in cash */
  netCashFlow?: number
  /** Operating cash flow ratio */
  operatingCashFlowRatio?: number
  /** Free cash flow (OCF - capital expenditures) */
  freeCashFlow?: number
  /** Cash conversion cycle in days */
  cashConversionCycle?: number
  /** Operating cash flow margin percentage */
  operatingCashFlowMargin?: number
  /** Cash flow coverage ratio */
  cashFlowCoverageRatio?: number
  /** Days sales outstanding */
  dso?: number
  /** Days payable outstanding */
  dpo?: number
}

/**
 * Burn rate and runway metrics for startups
 */
export interface BurnRateMetrics {
  /** Gross burn rate (total expenses per month) */
  grossBurnRate: number
  /** Net burn rate (expenses - revenue per month) */
  netBurnRate: number
  /** Cash balance available */
  cashBalance: number
  /** Runway in months (cash balance / burn rate) */
  runway: number
  /** Number of months in the calculation period */
  monthsInPeriod: number
}

/**
 * Context data passed to learn pages and metric tooltips.
 * Contains all calculated metrics in snake_case format for API compatibility.
 */
export interface MetricContextData {
  // P&L Metrics
  total_revenue?: number
  total_expenses?: number
  gross_profit?: number
  net_income?: number
  gross_margin_pct?: number
  operating_margin_pct?: number
  net_profit_margin?: number
  expense_ratio?: number
  ebitda?: number
  burn_rate?: number
  runway_months?: number

  // Balance Sheet Metrics
  total_assets?: number
  total_liabilities?: number
  total_equity?: number
  current_ratio?: number
  quick_ratio?: number
  working_capital?: number
  debt_to_equity?: number
  asset_turnover?: number
  equity_multiplier?: number
  roe?: number
  debt_ratio?: number

  // Cash Flow Metrics
  cash_balance?: number
  ocf?: number
  free_cash_flow?: number
  ocf_ratio?: number
  cash_conversion_cycle?: number
  ocf_margin?: number
  cf_coverage?: number
  dso?: number
  dpo?: number

  // Additional context
  [key: string]: number | string | undefined
}

/**
 * Metric display format configuration
 */
export interface MetricFormatConfig {
  /** Metric identifier */
  id: string
  /** Display name */
  name: string
  /** Value format type */
  format: 'currency' | 'percentage' | 'number' | 'ratio' | 'months'
  /** Number of decimal places */
  decimals?: number
  /** Prefix (e.g., '$', '€') */
  prefix?: string
  /** Suffix (e.g., '%', 'x', ' mo') */
  suffix?: string
  /** Whether to use compact notation (e.g., 1.2M instead of 1,200,000) */
  compact?: boolean
}

/**
 * Metric target for financial health scoring
 */
export interface MetricTarget {
  /** Unique metric identifier */
  metric_id: string
  /** Target value to achieve */
  target: number
  /** Unit of measurement */
  unit: string
}

/**
 * Health score component for individual metrics
 */
export interface HealthScoreComponent {
  /** Metric name */
  name: string
  /** Score value (0-100) */
  score: number
  /** Weight in overall health calculation */
  weight: number
  /** Status rating */
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
}

/**
 * Overall financial health score
 */
export interface HealthScore {
  /** Overall score (0-100) */
  score: number
  /** Rating label */
  rating: string
  /** Individual metric components */
  components: HealthScoreComponent[]
}

/**
 * Tooltip data for metric calculations
 */
export interface MetricTooltipData {
  /** Formula or calculation method */
  formula: string
  /** Breakdown of components used in calculation */
  components: Array<{
    label: string
    value: string | number
    highlight?: boolean
  }>
  /** Description of what the metric means */
  description: string
}
