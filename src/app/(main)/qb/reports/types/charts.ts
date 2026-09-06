// src/app/(main)/reports/types/charts.ts

/**
 * Base data point for simple charts (pie, donut, bar)
 */
export interface ChartDataPoint {
  /** Display name/label */
  name: string
  /** Numeric value */
  value: number
  /** Optional color override */
  color?: string
}

/**
 * Data point for time-series charts with monthly data
 */
export interface MonthlyDataPoint {
  /** Month identifier (e.g., "2024-01", "Jan 2024") */
  month: string
  /** Primary value for this month */
  value?: number
  /** Optional additional values for multi-line charts */
  [key: string]: string | number | undefined
}

/**
 * P&L monthly trend data point
 */
export interface PnLMonthlyTrend extends MonthlyDataPoint {
  /** Total revenue for the month */
  revenue: number
  /** Total expenses for the month */
  expenses: number
  /** Net income for the month */
  netIncome: number
  /** Gross profit for the month */
  grossProfit?: number
  /** Operating income for the month */
  operatingIncome?: number
}

/**
 * Balance Sheet monthly trend data point
 */
export interface BalanceSheetMonthlyTrend extends MonthlyDataPoint {
  /** Total assets at month end */
  assets: number
  /** Total liabilities at month end */
  liabilities: number
  /** Total equity at month end */
  equity: number
  /** Current assets */
  currentAssets?: number
  /** Current liabilities */
  currentLiabilities?: number
  /** Current ratio for the month */
  currentRatio?: number
  /** Quick ratio for the month */
  quickRatio?: number
}

/**
 * Cash Flow monthly trend data point
 */
export interface CashFlowMonthlyTrend extends MonthlyDataPoint {
  /** Operating cash flow for the month */
  operating: number
  /** Investing cash flow for the month */
  investing: number
  /** Financing cash flow for the month */
  financing: number
  /** Total cash balance at month end */
  totalCash: number
  /** Ending cash balance (alias for totalCash) */
  endingCash?: number
}

/**
 * Waterfall chart data point for cash flow visualization
 */
export interface WaterfallDataPoint {
  /** Category name */
  name: string
  /** Start value */
  start: number
  /** End value */
  end: number
  /** Change amount */
  value: number
  /** Whether this is a positive or negative change */
  isPositive: boolean
}

/**
 * P&L Flow (Sankey-style) data point
 */
export interface PnLFlowDataPoint {
  /** Flow category name */
  name: string
  /** Flow value (positive for inflows, negative for outflows) */
  value: number
}

/**
 * Configuration for Recharts-based charts
 */
export interface ChartConfig {
  /** Chart title */
  title?: string
  /** Chart height in pixels */
  height?: number
  /** Whether to show legend */
  showLegend?: boolean
  /** Whether to show tooltip */
  showTooltip?: boolean
  /** Whether to show grid lines */
  showGrid?: boolean
  /** Color scheme */
  colors?: string[]
  /** Whether to animate on load */
  animate?: boolean
}

/**
 * Pie/Donut chart specific configuration
 */
export interface PieChartConfig extends ChartConfig {
  /** Whether to show as donut (hollow center) */
  isDonut?: boolean
  /** Inner radius percentage (0-100) for donut charts */
  innerRadius?: number
  /** Outer radius percentage (0-100) */
  outerRadius?: number
  /** Whether to show labels */
  showLabels?: boolean
  /** Label position */
  labelPosition?: 'inside' | 'outside'
}

/**
 * Line/Area chart specific configuration
 */
export interface LineChartConfig extends ChartConfig {
  /** Whether to show area fill */
  showArea?: boolean
  /** Whether to show data points */
  showDots?: boolean
  /** Line stroke width */
  strokeWidth?: number
  /** Curve type */
  curveType?: 'linear' | 'monotone' | 'step'
}

/**
 * Bar chart specific configuration
 */
export interface BarChartConfig extends ChartConfig {
  /** Bar orientation */
  layout?: 'horizontal' | 'vertical'
  /** Whether bars are stacked */
  stacked?: boolean
  /** Bar size */
  barSize?: number
  /** Bar category gap */
  barCategoryGap?: string | number
}

/**
 * Waterfall chart specific configuration
 */
export interface WaterfallChartConfig extends ChartConfig {
  /** Color for positive values */
  positiveColor?: string
  /** Color for negative values */
  negativeColor?: string
  /** Color for total bars */
  totalColor?: string
}

/**
 * Chart data types for different visualizations
 */
export type ChartData =
  | ChartDataPoint[]
  | MonthlyDataPoint[]
  | PnLMonthlyTrend[]
  | BalanceSheetMonthlyTrend[]
  | CashFlowMonthlyTrend[]
  | WaterfallDataPoint[]
  | PnLFlowDataPoint[]

/**
 * Chart component props interface
 */
export interface ChartComponentProps<T = ChartData> {
  /** Chart data */
  data: T
  /** Chart configuration */
  config?: ChartConfig
  /** Whether data is loading */
  isLoading?: boolean
  /** Error message if chart failed to load */
  error?: string
  /** Custom className for styling */
  className?: string
}

/**
 * Financial Chart types enum for type discrimination
 */
export enum FinancialChartType {
  PIE = 'pie',
  DONUT = 'donut',
  LINE = 'line',
  AREA = 'area',
  BAR = 'bar',
  STACKED_BAR = 'stacked-bar',
  WATERFALL = 'waterfall',
  COMPOSED = 'composed',
}

/**
 * Chart export configuration
 */
export interface ChartExportConfig {
  /** Export format */
  format: 'png' | 'jpg' | 'svg' | 'pdf'
  /** Image quality (0-1) for raster formats */
  quality?: number
  /** File name */
  filename?: string
  /** Include chart title in export */
  includeTitle?: boolean
}
