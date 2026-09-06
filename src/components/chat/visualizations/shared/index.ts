/**
 * @module shared
 * @description Barrel export for shared visualization utilities
 */

// Colors
export {
  COLORS,
  colorPalette,
  namedColorMap,
  semanticColors,
  resolveColor,
  getColorByIndex,
} from './colors'

// Formatters
export {
  formatCompactNumber,
  formatCompactCurrency,
  formatValue,
  formatCell,
  formatAxisLabel,
  getCurrencySymbol,
} from './formatters'

// ECharts configuration (static - for backwards compatibility)
export {
  tooltipStyle,
  axisLabelStyle,
  axisLineStyle,
  splitLineStyle,
  getBaseChartConfig,
  getGridConfig,
  getCategoryXAxis,
  getValueYAxis,
  getTitleConfig,
  getLegendConfig,
  getPieLegendConfig,
  // High-quality rendering options
  getHighQualityOpts,
  canvasHighDpiOpts,
  svgOpts,
} from './echarts-config'

// Theme-reactive ECharts configuration hooks
export {
  useThemeColors,
  useThemeTooltipStyle,
  useThemeAxisLabelStyle,
  useThemeAxisLineStyle,
  useThemeSplitLineStyle,
  useThemeEChartsConfig,
  DARK_THEME_COLORS,
  LIGHT_THEME_COLORS,
} from './useThemeTooltip'
export type { ThemeTooltipColors } from './useThemeTooltip'

// ECharts wrapper
export { ReactECharts, ChartLoadingSkeleton } from './ReactEChartsWrapper'

// Types
export type {
  VisualizationBlock,
  ChartBlock,
  KPIBlock,
  MetricBlock,
  ComparisonBlock,
  ProgressBlock,
  TimelineBlock,
  ChartDataPoint,
  ChartSeries,
  KPIItem,
  ChartType,
  BaseChartProps,
  EChartsChartProps,
  MultiSeriesChartProps,
  EmptyStateProps,
  ErrorFallbackProps,
} from './types'

export { CHART_COLORS, FINANCIAL_COLORS, getChartColor } from './types'
