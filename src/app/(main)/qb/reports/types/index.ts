// src/app/(main)/reports/types/index.ts

/**
 * Centralized type definitions for the Reports module.
 *
 * This barrel file exports all type definitions used across the reports module,
 * providing a single import point for cleaner imports throughout the codebase.
 *
 * @example
 * ```typescript
 * import { PnLItem, PnLMetrics, ChartDataPoint } from '@/app/(main)/reports/types'
 * ```
 */

// Table Types
export type {
  BaseTableItem,
  PnLItem,
  BalanceSheetItem,
  CashFlowItem,
  TrialBalanceItem,
  GeneralLedgerTransaction,
  GeneralLedgerItem,
  TableRowItem,
  FinancialStatementTableProps,
  BalanceSheetTableProps,
  TableSortConfig,
  TableFilterConfig,
} from './table'

// Metrics Types
export type {
  BaseMetric,
  PnLMetrics,
  BalanceSheetMetrics,
  CashFlowMetrics,
  BurnRateMetrics,
  MetricContextData,
  MetricFormatConfig,
  MetricTarget,
  HealthScoreComponent,
  HealthScore,
  MetricTooltipData,
} from './metrics'

// Charts Types
export type {
  ChartDataPoint,
  MonthlyDataPoint,
  PnLMonthlyTrend,
  BalanceSheetMonthlyTrend,
  CashFlowMonthlyTrend,
  WaterfallDataPoint,
  PnLFlowDataPoint,
  ChartConfig,
  PieChartConfig,
  LineChartConfig,
  BarChartConfig,
  WaterfallChartConfig,
  ChartData,
  ChartComponentProps,
  ChartExportConfig,
} from './charts'

export { FinancialChartType } from './charts'

// Financial Health Types
export type {
  FinancialHealthMetric,
  FinancialHealthSettings,
  FinancialHealthCardProps,
  FinancialHealthSettingsDialogProps,
  MetricConfiguration,
  FinancialHealthResult,
  TooltipData,
  HealthScoreThresholds,
  MetricWeights,
} from './financial-health'

export {
  DEFAULT_HEALTH_THRESHOLDS,
  DEFAULT_METRIC_WEIGHTS,
  FINANCIAL_HEALTH_METRICS,
  getFinancialHealthMetric,
  getMetricsByCategory,
} from './financial-health'

// Props Types
export type {
  DateRange,
  ReportView,
  BaseReportViewProps,
  PnLViewProps,
  BalanceSheetViewProps,
  CashFlowViewProps,
  SummaryViewProps,
  MetricsGridProps,
  PnLMetricsGridProps,
  BalanceSheetMetricsGridProps,
  CashFlowMetricsGridProps,
  SummaryNavigationCardsProps,
  ReportNavigationCardProps,
  MetricCardProps,
  ReportLoadingStateProps,
  ReportErrorStateProps,
  DateRangeSelectorProps,
  ExportButtonProps,
} from './props'

/**
 * Type guard to check if a table item is a P&L item
 */
export function isPnLItem(item: any): item is import('./table').PnLItem {
  return 'category' in item && 'name' in item && 'amount' in item
}

/**
 * Type guard to check if a table item is a Balance Sheet item
 */
export function isBalanceSheetItem(item: any): item is import('./table').BalanceSheetItem {
  return (
    'category' in item &&
    'name' in item &&
    'amount' in item &&
    ('isSubHeader' in item || 'isNestedChild' in item)
  )
}

/**
 * Type guard to check if a table item is a Cash Flow item
 */
export function isCashFlowItem(item: any): item is import('./table').CashFlowItem {
  return 'category' in item && 'name' in item && 'amount' in item
}

/**
 * Type guard to check if data is chart data point array
 */
export function isChartDataPoint(data: any): data is import('./charts').ChartDataPoint[] {
  return Array.isArray(data) && data.length > 0 && 'name' in data[0] && 'value' in data[0]
}

/**
 * Type guard to check if data is monthly data point array
 */
export function isMonthlyDataPoint(data: any): data is import('./charts').MonthlyDataPoint[] {
  return Array.isArray(data) && data.length > 0 && 'month' in data[0]
}

/**
 * Helper type for nullable metrics (when data might not be available)
 */
export type NullableMetrics<T> = {
  [K in keyof T]: T[K] | null
}

/**
 * Helper type for partial metrics (when some fields might be missing)
 */
export type PartialMetrics<T> = Partial<T>

/**
 * Helper type for API response wrapper
 */
export interface APIResponse<T> {
  data: T
  success: boolean
  error?: string
  timestamp?: string
}

/**
 * Helper type for paginated responses
 */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/**
 * Common status type for async operations
 */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

/**
 * Common sort direction type
 */
export type SortDirection = 'asc' | 'desc'

/**
 * Common trend direction type
 */
export type TrendDirection = 'up' | 'down' | 'stable'

/**
 * Utility type to make specific properties required
 */
export type RequireProperties<T, K extends keyof T> = T & Required<Pick<T, K>>

/**
 * Utility type to make specific properties optional
 */
export type OptionalProperties<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
