/**
 * @module visualizations
 * @description Public API for visualization components
 *
 * This module provides the main entry point for all visualization rendering.
 * It maintains backward compatibility with the original monolithic implementation.
 *
 * Architecture:
 * - VisualizationRenderer: Main router for all visualization blocks
 * - ChartRenderer: Handles all chart types (20 chart types)
 * - Component renderers: KPI, Metric, Comparison, Progress, Timeline
 */

// Main visualization renderer (public API)
export { VisualizationRenderer } from './VisualizationRenderer'
export type { VisualizationRendererProps } from './VisualizationRenderer'

// Chart renderer (handles all chart types)
export { ChartRenderer } from './charts'

// Individual component renderers (backward compatibility)
export {
  KPIRenderer,
  MetricRenderer,
  ComparisonRenderer,
  ProgressRenderer,
  TimelineRenderer,
} from './components'

// Re-export types for external use
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
} from './shared/types'

// Re-export color utilities
export { CHART_COLORS, FINANCIAL_COLORS, getChartColor } from './shared/types'
export { colorPalette, resolveColor, getColorByIndex, COLORS } from './shared/colors'

// Re-export formatters
export { formatValue, formatCell, formatAxisLabel } from './shared/formatters'
