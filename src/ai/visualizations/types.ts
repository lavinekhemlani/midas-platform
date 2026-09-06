// src/ai/visualizations/types.ts
// Re-export visualization types from the canonical location

export type {
  ChartType,
  ChartDataPoint,
  ChartSeries,
  ChartBlock,
  KPIItem,
  KPIBlock,
  MetricBlock,
  ComparisonBlock,
  ProgressBlock,
  TimelineBlock,
  VisualizationBlock,
} from '@/lib/chat/visualizationBlocks'

export {
  parseBlockType,
  parseBlockContent,
  parseVisualizationBlock,
  transformStructuredVisualization,
  CHART_COLORS,
  FINANCIAL_COLORS,
  getChartColor,
  getFinancialColor,
  formatCompactNumber,
} from '@/lib/chat/visualizationBlocks'
