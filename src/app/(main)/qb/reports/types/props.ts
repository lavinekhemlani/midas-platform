// src/app/(main)/reports/types/props.ts

import type { LucideIcon } from 'lucide-react'
import type {
  PnLMetrics,
  BalanceSheetMetrics,
  CashFlowMetrics,
  BurnRateMetrics,
  MetricContextData,
} from './metrics'
import type { ChartDataPoint, MonthlyDataPoint } from './charts'

/**
 * Date range for report filtering
 */
export interface DateRange {
  /** Start date in ISO format (YYYY-MM-DD) */
  start: string
  /** End date in ISO format (YYYY-MM-DD) */
  end: string
}

/**
 * Report view type identifier
 */
export type ReportView = 'summary' | 'pnl' | 'balance-sheet' | 'cash-flow'

/**
 * Common props for all report view components
 */
export interface BaseReportViewProps {
  /** Date range for the report */
  dateRange: DateRange
  /** Whether data is loading */
  isLoading?: boolean
  /** Whether data is being revalidated in background */
  isValidating?: boolean
  /** Error object if data fetch failed */
  error?: Error | null
  /** Function to retry data fetch */
  onRetry?: () => void
}

/**
 * Props for P&L (Profit & Loss) view component
 */
export interface PnLViewProps extends BaseReportViewProps {
  /** P&L metrics data */
  metrics?: PnLMetrics
  /** Revenue breakdown by category */
  incomeBreakdown?: ChartDataPoint[]
  /** Expense breakdown by category */
  expenseBreakdown?: ChartDataPoint[]
  /** Monthly trend data */
  monthlyTrend?: MonthlyDataPoint[]
}

/**
 * Props for Balance Sheet view component
 */
export interface BalanceSheetViewProps extends BaseReportViewProps {
  /** Balance sheet metrics data */
  metrics?: BalanceSheetMetrics
  /** Asset composition breakdown */
  assetComposition?: ChartDataPoint[]
  /** Liability breakdown */
  liabilityBreakdown?: ChartDataPoint[]
  /** Equity composition */
  equityComposition?: ChartDataPoint[]
  /** Monthly trend data */
  monthlyTrend?: MonthlyDataPoint[]
  /** As-of date for the balance sheet */
  asOfDate: string
}

/**
 * Props for Cash Flow view component
 */
export interface CashFlowViewProps extends BaseReportViewProps {
  /** Cash flow metrics data */
  metrics?: CashFlowMetrics
  /** Operating activities breakdown */
  operatingBreakdown?: ChartDataPoint[]
  /** Investing activities breakdown */
  investingBreakdown?: ChartDataPoint[]
  /** Financing activities breakdown */
  financingBreakdown?: ChartDataPoint[]
  /** Monthly cash flow data */
  monthlyFlow?: MonthlyDataPoint[]
}

/**
 * Props for Summary view component
 */
export interface SummaryViewProps extends BaseReportViewProps {
  /** P&L metrics for summary cards */
  pnlMetrics: PnLMetrics
  /** Balance sheet metrics for summary cards */
  balanceSheetMetrics: BalanceSheetMetrics
  /** Cash flow metrics for summary cards */
  cashFlowMetrics: CashFlowMetrics
  /** Loading states for each report type */
  loadingStates: {
    pnl: boolean
    balanceSheet: boolean
    cashFlow: boolean
  }
  /** Last updated timestamps */
  lastUpdated?: {
    pnl?: string
    balanceSheet?: string
    cashFlow?: string
  }
}

/**
 * Props for metrics grid components
 */
export interface MetricsGridProps {
  /** Context data for learn pages */
  contextData: MetricContextData
  /** Whether data is loading */
  isLoading: boolean
}

/**
 * Props for P&L metrics grid
 */
export interface PnLMetricsGridProps extends MetricsGridProps {
  /** Total revenue */
  totalRevenue: number
  /** Total expenses */
  totalExpenses: number
  /** Net income */
  netIncome: number
  /** Gross profit */
  grossProfit: number
  /** Cost of goods sold */
  costOfGoodsSold: number
  /** Operating expenses */
  operatingExpenses: number
  /** Gross margin percentage (nullable) */
  grossMarginRaw: number | null
  /** Operating margin percentage (nullable) */
  operatingMarginRaw: number | null
  /** Expense ratio percentage (nullable) */
  expenseRatioRaw: number | null
  /** Gross burn rate */
  grossBurnRate: number
  /** Number of months in period */
  monthsInPeriod: number
  /** Cash balance */
  cashBalance: number
  /** Runway in months */
  runway: number
  /** Revenue breakdown data */
  incomeBreakdown: ChartDataPoint[]
  /** Expense breakdown data */
  expenseBreakdown: ChartDataPoint[]
  /** P&L flow/waterfall data */
  plFlowData: ChartDataPoint[]
  /** Additional data from API */
  data: {
    monthlyTrend?: MonthlyDataPoint[]
    kpis?: {
      ebitda?: number
      interestExpense?: number
      taxExpense?: number
      depreciationAmortization?: number
    }
  }
}

/**
 * Props for Balance Sheet metrics grid
 */
export interface BalanceSheetMetricsGridProps extends MetricsGridProps {
  /** Total assets */
  totalAssets: number
  /** Total liabilities */
  totalLiabilities: number
  /** Total equity */
  totalEquity: number
  /** Asset composition breakdown */
  assetComposition: ChartDataPoint[]
  /** Liability breakdown */
  liabilityBreakdown: ChartDataPoint[]
  /** Equity composition */
  equityComposition: ChartDataPoint[]
  /** Monthly trend data with ratios */
  monthlyTrendData: Array<{
    month: string
    currentRatio: number
    quickRatio: number
    assets: number
    liabilities: number
    equity: number
  }>
  /** Additional data from API */
  data: {
    kpis?: {
      currentRatio?: number
      quickRatio?: number
      workingCapital?: number
      debtToEquity?: number
    }
    ratios?: {
      assetTurnover?: number
      equityMultiplier?: number
      returnOnEquity?: number
      debtRatio?: number
    }
  }
}

/**
 * Props for Cash Flow metrics grid
 */
export interface CashFlowMetricsGridProps extends MetricsGridProps {
  /** Operating cash flow */
  operatingCashFlow: number
  /** Investing cash flow */
  investingCashFlow: number
  /** Financing cash flow */
  financingCashFlow: number
  /** Net cash flow */
  netCashFlow: number
  /** Beginning cash balance */
  cashBeginning: number
  /** Ending cash balance */
  cashEnding: number
  /** Operating activities breakdown */
  operatingBreakdown: ChartDataPoint[]
  /** Investing and financing activities combined */
  investingFinancingBreakdown: ChartDataPoint[]
  /** Waterfall chart data */
  waterfallData: ChartDataPoint[]
  /** Monthly cash flow data */
  monthlyFlowData: Array<{
    month: string
    operating: number
    investing: number
    financing: number
    totalCash: number
  }>
  /** Cash metrics from API */
  cashMetrics: {
    period_months?: number
    total_expenses?: number
    runway_months?: number
    operating_cash_flow_ratio?: number
    free_cash_flow?: number
    cash_conversion_cycle?: number
    operating_cash_flow_margin?: number
    cash_flow_coverage_ratio?: number
    dso?: number
    dpo?: number
  }
  /** Number of months in period */
  periodMonths: number
}

/**
 * Props for report navigation cards (summary page)
 */
export interface SummaryNavigationCardsProps {
  /** P&L metrics for card */
  pnlMetrics: PnLMetrics
  /** Balance sheet metrics for card */
  bsMetrics: BalanceSheetMetrics
  /** Cash flow metrics for card */
  cfMetrics: CashFlowMetrics
  /** P&L loading state */
  pnlLoading: boolean
  /** Balance sheet loading state */
  bsLoading: boolean
  /** Cash flow loading state */
  cfLoading: boolean
  /** Last updated timestamps */
  pnlLastUpdated?: string
  balanceSheetLastUpdated?: string
  cashFlowLastUpdated?: string
  /** Number of months in period for burn rate calculation */
  periodMonths: number
}

/**
 * Props for individual report navigation card
 */
export interface ReportNavigationCardProps {
  /** Card title */
  title: string
  /** Card description */
  description: string
  /** Link href */
  href: string
  /** Icon component */
  icon: LucideIcon
  /** Icon color class */
  iconColor: string
  /** Whether data is loading */
  isLoading: boolean
  /** Last updated timestamp */
  lastUpdated?: string
  /** Metrics to display on card */
  metrics: Array<{
    label: string
    value: number | string
    format: 'currency' | 'percentage' | 'number' | 'custom'
    icon?: LucideIcon
    color?: string
  }>
}

/**
 * Props for metric card component
 */
export interface MetricCardProps {
  /** Metric label */
  label: string
  /** Metric value */
  value: number | string
  /** Format type */
  format?: 'currency' | 'percentage' | 'number' | 'custom'
  /** Icon component */
  icon?: LucideIcon
  /** Icon color */
  iconColor?: string
  /** Whether to show learn button */
  showLearnButton?: boolean
  /** Term ID for learn page */
  termId?: string
  /** Tooltip content */
  tooltip?: string | React.ReactNode
  /** Whether value is loading */
  isLoading?: boolean
  /** Trend indicator */
  trend?: 'up' | 'down' | 'stable'
  /** Change percentage */
  changePercent?: number
  /** Additional CSS classes */
  className?: string
}

/**
 * Props for report loading state component
 */
export interface ReportLoadingStateProps {
  /** Loading message to display */
  message?: string
  /** Whether to show as overlay (for revalidation) */
  isOverlay?: boolean
}

/**
 * Props for report error state component
 */
export interface ReportErrorStateProps {
  /** Error object */
  error: Error
  /** Retry function */
  onRetry?: () => void
  /** Custom error message */
  message?: string
}

/**
 * Props for date range selector component
 */
export interface DateRangeSelectorProps {
  /** Current date range */
  dateRange: DateRange
  /** Handler for date range change */
  onChange: (dateRange: DateRange) => void
  /** Preset options to show */
  presets?: Array<{
    label: string
    value: DateRange
  }>
  /** Whether selector is disabled */
  disabled?: boolean
  /** Maximum selectable date */
  maxDate?: Date
  /** Minimum selectable date */
  minDate?: Date
}

/**
 * Props for export button component
 */
export interface ExportButtonProps {
  /** Export format */
  format: 'csv' | 'pdf' | 'xlsx'
  /** Data to export */
  data: any
  /** File name */
  filename: string
  /** Whether export is in progress */
  isExporting?: boolean
  /** Handler for export click */
  onExport?: () => void
  /** Additional CSS classes */
  className?: string
}
