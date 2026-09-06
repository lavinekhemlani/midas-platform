/**
 * @module types
 * @description Type definitions for visualization components
 * Re-exports types from source of truth and defines shared props
 */

// Import ChartBlock for extension (need value import for interface extension)
import type { ChartBlock as ChartBlockType } from '@/lib/chat/visualizationBlocks'

// Re-export all visualization block types from source of truth
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
} from '@/lib/chat/visualizationBlocks'

// Re-export color utilities
export { CHART_COLORS, FINANCIAL_COLORS, getChartColor } from '@/lib/chat/visualizationBlocks'

/**
 * Base props shared by all chart components
 */
export interface BaseChartProps {
  /** Optional CSS class for container styling */
  className?: string
}

/**
 * Props for ECharts-based chart components
 */
export interface EChartsChartProps extends BaseChartProps {
  /** Chart data points */
  data: Array<{ label: string; value: number; color?: string }>
  /** Chart title */
  title?: string
  /** Currency code for value formatting */
  currency?: string
  /** Whether to show legend */
  showLegend?: boolean
}

/**
 * Props for multi-series chart components
 */
export interface MultiSeriesChartProps extends EChartsChartProps {
  /** Multiple data series */
  series?: Array<{ name: string; data: number[]; color?: string }>
  /** X-axis labels for series data */
  labels?: string[]
}

/**
 * Empty state component props
 */
export interface EmptyStateProps {
  /** Message to display when no data available */
  message?: string
}

/**
 * Error boundary fallback props
 */
export interface ErrorFallbackProps {
  /** Error that was caught */
  error: Error
  /** Chart type that failed */
  chartType?: string
}

/**
 * Specialized data point types for charts that need extra fields
 */

/**
 * Sankey diagram node representation
 */
export interface SankeyNode {
  name: string
  value?: number
}

/**
 * Sankey diagram link between nodes
 * source/target can be node name (string) or node index (number)
 */
export interface SankeyLink {
  source: string | number
  target: string | number
  value: number
}

/**
 * Complete Sankey diagram data structure
 */
export interface SankeyData {
  nodes: SankeyNode[]
  links: SankeyLink[]
}

/**
 * Box plot data point with statistical values
 */
export interface BoxplotDataPoint {
  label: string
  values: number[] // [min, Q1, median, Q3, max]
}

/**
 * Treemap data point with hierarchical structure
 */
export interface TreemapDataPoint {
  name: string
  value: number
  children?: TreemapDataPoint[]
}

/**
 * Extended block types for specialized charts
 */

/**
 * Sankey diagram visualization block
 */
export interface SankeyBlock extends ChartBlockType {
  sankeyData?: SankeyData
}
