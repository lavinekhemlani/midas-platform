// src/lib/chat/visualizationBlocks.ts
// Parses fenced code blocks into visualization components
// Supports extensive chart types for financial data visualization

import YAML from 'yaml'
import { aiDebug } from '@/lib/debug'

// =============================================================================
// Types
// =============================================================================

// Chart types - expanded library (ECharts-based)
export type ChartType =
  // Basic charts
  | 'donut'
  | 'pie'
  | 'bar' // Unified: handles vertical, horizontal, stacked, diverging
  | 'line'
  | 'area' // Handles both single and stacked multi-series
  | 'scatter'
  | 'radar'
  // Financial charts
  | 'waterfall'
  // Hierarchical charts
  | 'treemap'
  // Relationship/flow charts
  | 'sankey'
  // Distribution charts
  | 'boxplot'

export interface ChartDataPoint {
  label: string
  value: number
  color?: string
  // For multi-series charts
  series?: string
  // For waterfall charts
  type?: 'initial' | 'positive' | 'negative' | 'final'
}

export interface ChartSeries {
  name: string
  data: number[]
  color?: string
}

export interface ChartBlock {
  type: 'chart'
  chartType: ChartType
  title?: string
  data: ChartDataPoint[]
  // Multi-series support
  series?: ChartSeries[]
  labels?: string[]
  // Axis configuration
  xAxis?: string
  yAxis?: string
  // Options
  orientation?: 'vertical' | 'horizontal' // For bar charts
  stacked?: boolean
  currency?: string
  showLabels?: boolean
  showLegend?: boolean
  // For progress/gauge
  max?: number
  target?: number
  // Sankey-specific data
  sankeyData?: {
    nodes: Array<{ name: string }>
    links: Array<{ source: string; target: string; value: number }>
  }
}

export interface KPIItem {
  label: string
  value: number | string
  format?: 'currency' | 'percent' | 'number' | 'compact'
  trend?: {
    direction: 'up' | 'down' | 'flat'
    value: number
    label?: string
    isGood?: boolean // For metrics where down is good (expenses, burn rate)
  }
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray'
  icon?: string
  description?: string
}

export interface KPIBlock {
  type: 'kpi'
  title?: string
  metrics: KPIItem[]
  columns?: number
  variant?: 'default' | 'compact' | 'large'
  currencyCode?: string
}

export interface MetricBlock {
  type: 'metric'
  label: string
  value: number | string
  format?: 'currency' | 'percent' | 'number' | 'compact'
  description?: string
  trend?: {
    direction: 'up' | 'down' | 'flat'
    value: number
    isGood?: boolean
  }
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray'
  sparkline?: number[]
  currencyCode?: string
}

export interface ComparisonBlock {
  type: 'comparison'
  title?: string
  periods: {
    label: string
    value: number
    format?: 'currency' | 'percent' | 'number'
  }[]
  showChange?: boolean
  changeLabel?: string
  currencyCode?: string
}

export interface ProgressBlock {
  type: 'progress'
  title?: string
  items: {
    label: string
    value: number
    max?: number
    target?: number
    color?: string
    format?: 'currency' | 'percent' | 'number'
  }[]
  showLabels?: boolean
  currencyCode?: string
}

export interface TimelineBlock {
  type: 'timeline'
  title?: string
  events: {
    date: string
    label: string
    description?: string
    type?: 'positive' | 'negative' | 'neutral' | 'warning'
    value?: number
  }[]
}

export type VisualizationBlock =
  | ChartBlock
  | KPIBlock
  | MetricBlock
  | ComparisonBlock
  | ProgressBlock
  | TimelineBlock

// =============================================================================
// Parser
// =============================================================================

/**
 * Parse a fenced code block language tag
 * Examples: "chart:pie", "chart:waterfall", "table", "kpi", "comparison", "progress", "timeline"
 */
export function parseBlockType(lang: string): { type: string; subtype?: string } | null {
  if (!lang) return null

  const normalized = lang.toLowerCase().trim()

  // Chart types with subtypes
  if (normalized.startsWith('chart:')) {
    const subtype = normalized.split(':')[1]
    const validChartTypes = [
      'donut',
      'bar', // Unified: handles vertical, horizontal, stacked, diverging
      'line',
      'area', // Handles both single and stacked multi-series
      'scatter',
      'radar',
      'waterfall',
      // Hierarchical
      'treemap',
      // Relationship
      'sankey',
      // Distribution
      'boxplot',
    ]
    if (validChartTypes.includes(subtype)) {
      return { type: 'chart', subtype }
    }
  }

  // Direct block types
  const directTypes = ['table', 'kpi', 'metric', 'comparison', 'progress', 'timeline']
  if (directTypes.includes(normalized)) {
    return { type: normalized }
  }

  return null
}

/**
 * Parse the content of a visualization block (YAML or JSON)
 */
export function parseBlockContent(content: string): Record<string, any> | null {
  const trimmed = content.trim()

  // Try JSON first (starts with { or [)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      // Fall through to YAML
    }
  }

  // Try YAML
  try {
    return YAML.parse(trimmed)
  } catch {
    console.warn('[VisualizationBlocks] Failed to parse block content')
    return null
  }
}

/**
 * Parse a complete visualization block from language and content
 */
export function parseVisualizationBlock(lang: string, content: string): VisualizationBlock | null {
  const blockType = parseBlockType(lang)
  if (!blockType) return null

  const parsed = parseBlockContent(content)
  if (!parsed) return null

  switch (blockType.type) {
    case 'chart':
      return parseChartBlock(blockType.subtype as ChartType, parsed)
    case 'kpi':
      return parseKPIBlock(parsed)
    case 'metric':
      return parseMetricBlock(parsed)
    case 'comparison':
      return parseComparisonBlock(parsed)
    case 'progress':
      return parseProgressBlock(parsed)
    case 'timeline':
      return parseTimelineBlock(parsed)
    default:
      return null
  }
}

// =============================================================================
// Block-Specific Parsers
// =============================================================================

function parseChartBlock(chartType: ChartType, data: Record<string, any>): ChartBlock | null {
  // Handle array format (just data points)
  if (Array.isArray(data)) {
    return {
      type: 'chart',
      chartType,
      data: normalizeChartData(data, chartType),
    }
  }

  // Handle object format with metadata
  const chartData = Array.isArray(data.data) ? data.data : []

  // Handle multi-series format
  let series: ChartSeries[] | undefined
  let labels: string[] | undefined

  if (data.series && Array.isArray(data.series)) {
    series = data.series.map((s: any) => ({
      name: s.name || s.label || 'Series',
      data: Array.isArray(s.data) ? s.data : [],
      color: s.color,
    }))
    labels = data.labels || []
  }

  return {
    type: 'chart',
    chartType,
    title: data.title,
    data: normalizeChartData(chartData, chartType),
    series,
    labels,
    xAxis: data.xAxis || data.x_axis,
    yAxis: data.yAxis || data.y_axis,
    orientation: data.orientation || (data.horizontal ? 'horizontal' : undefined),
    stacked: data.stacked,
    currency: data.currency,
    showLabels: data.showLabels ?? true,
    showLegend: data.showLegend ?? true,
    max: data.max,
    target: data.target,
  }
}

function normalizeChartData(data: any[], chartType: ChartType): ChartDataPoint[] {
  return data.map((item) => {
    if (typeof item === 'object') {
      // Normalize label field - support common naming variations
      const label =
        item.label || item.name || item.category || item.month || item.period || 'Unknown'

      // Normalize value field - support financial report field names
      // Priority: explicit 'value' first, then common financial metrics
      const value = Number(
        item.value ??
          item.amount ??
          item.total ??
          item.netCashFlow ??
          item.netChange ??
          item.netIncome ??
          item.revenue ??
          item.operating ??
          item.investing ??
          item.financing ??
          item.grossProfit ??
          item.expenses ??
          0
      )

      return {
        label,
        value,
        color: item.color,
        series: item.series,
        // Waterfall-specific
        type: chartType === 'waterfall' ? item.type || inferWaterfallType(item) : undefined,
      }
    }
    return { label: 'Unknown', value: 0 }
  })
}

function inferWaterfallType(item: any): 'initial' | 'positive' | 'negative' | 'final' {
  if (item.type) return item.type
  const label = (item.label || item.name || '').toLowerCase()
  if (label.includes('start') || label.includes('opening') || label.includes('initial'))
    return 'initial'
  if (
    label.includes('end') ||
    label.includes('closing') ||
    label.includes('final') ||
    label.includes('total')
  )
    return 'final'
  const value = Number(item.value || item.amount || 0)
  return value >= 0 ? 'positive' : 'negative'
}

function parseKPIBlock(data: Record<string, any>): KPIBlock | null {
  const metrics = Array.isArray(data.metrics) ? data.metrics : Array.isArray(data) ? data : []

  if (metrics.length === 0) return null

  return {
    type: 'kpi',
    title: data.title,
    metrics: metrics.map((m: any) => ({
      label: m.label || m.name || 'Metric',
      value: m.value ?? 0,
      format: m.format,
      trend: m.trend
        ? {
            direction: m.trend.direction || 'flat',
            value: m.trend.value || 0,
            label: m.trend.label,
            isGood: m.trend.isGood,
          }
        : undefined,
      color: m.color,
      icon: m.icon,
      description: m.description,
    })),
    columns: data.columns,
    variant: data.variant || 'default',
  }
}

function parseMetricBlock(data: Record<string, any>): MetricBlock | null {
  return {
    type: 'metric',
    label: data.label || data.name || 'Metric',
    value: data.value ?? 0,
    format: data.format,
    description: data.description,
    trend: data.trend
      ? {
          direction: data.trend.direction || 'flat',
          value: data.trend.value || 0,
          isGood: data.trend.isGood,
        }
      : undefined,
    color: data.color,
    sparkline: data.sparkline,
  }
}

function parseComparisonBlock(data: Record<string, any>): ComparisonBlock | null {
  const periods = Array.isArray(data.periods) ? data.periods : []

  if (periods.length < 2) return null

  return {
    type: 'comparison',
    title: data.title,
    periods: periods.map((p: any) => ({
      label: p.label || p.name || p.period || 'Period',
      value: Number(p.value || p.amount || 0),
      format: p.format,
    })),
    showChange: data.showChange ?? true,
    changeLabel: data.changeLabel,
  }
}

function parseProgressBlock(data: Record<string, any>): ProgressBlock | null {
  const items = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : []

  if (items.length === 0) return null

  return {
    type: 'progress',
    title: data.title,
    items: items.map((item: any) => ({
      label: item.label || item.name || 'Item',
      value: Number(item.value || 0),
      max: item.max || 100,
      target: item.target,
      color: item.color,
      format: item.format,
    })),
    showLabels: data.showLabels ?? true,
  }
}

function parseTimelineBlock(data: Record<string, any>): TimelineBlock | null {
  const events = Array.isArray(data.events) ? data.events : Array.isArray(data) ? data : []

  if (events.length === 0) return null

  return {
    type: 'timeline',
    title: data.title,
    events: events.map((e: any) => ({
      date: e.date || new Date().toISOString(),
      label: e.label || e.title || e.name || 'Event',
      description: e.description,
      type: e.type || 'neutral',
      value: e.value,
    })),
  }
}

// =============================================================================
// Color Palette for Charts
// =============================================================================

export const CHART_COLORS = [
  '#f59e0b', // amber-500
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#ef4444', // red-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
]

// Semantic colors for financial data
export const FINANCIAL_COLORS = {
  positive: '#10b981', // emerald-500
  negative: '#ef4444', // red-500
  neutral: '#6b7280', // gray-500
  initial: '#3b82f6', // blue-500
  final: '#8b5cf6', // violet-500
  warning: '#f59e0b', // amber-500
  info: '#06b6d4', // cyan-500
}

export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

export function getFinancialColor(
  type: 'positive' | 'negative' | 'neutral' | 'initial' | 'final' | 'warning' | 'info'
): string {
  return FINANCIAL_COLORS[type]
}

// Format compact numbers (K, M, B)
export function formatCompactNumber(value: number): string {
  if (Math.abs(value) >= 1e9) {
    return `${(value / 1e9).toFixed(1)}B`
  }
  if (Math.abs(value) >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`
  }
  if (Math.abs(value) >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`
  }
  return value.toFixed(0)
}

// =============================================================================
// Structured Output Transformer
// Converts create_visualization tool output to VisualizationBlock format
// =============================================================================

/**
 * Transform structured output from create_visualization tool to VisualizationBlock
 * Handles type conversion: "chart:bar" -> { type: "chart", chartType: "bar" }
 */
export function transformStructuredVisualization(
  input: Record<string, any>
): VisualizationBlock | null {
  aiDebug.transform.input({ type: input?.type || 'undefined', raw: input })

  if (!input || !input.type) {
    aiDebug.transform.error({ inputType: 'undefined', reason: 'Missing input or type' })
    return null
  }

  const inputType = input.type as string

  // Handle chart types (chart:bar, chart:pie, etc.)
  if (inputType.startsWith('chart:')) {
    let chartType = inputType.split(':')[1] as ChartType
    // Map 'pie' to 'donut' since renderer only has 'donut' (they're visually the same)
    if (chartType === ('pie' as ChartType)) {
      chartType = 'donut'
    }

    let chartData = input.data || []

    // Normalize data points - ensure each has 'label' and 'value' fields
    // LLM might use different field names (month instead of label, netCashFlow instead of value)
    // Also round values to avoid floating point precision issues in ECharts axis calculation
    chartData = chartData.map((point: any) => {
      // Normalize label field
      const label =
        point.label ?? point.name ?? point.category ?? point.month ?? point.period ?? 'Unknown'

      // Normalize value field - includes common financial metric names
      let value = point.value
      if (value === undefined || value === null) {
        value =
          point.amount ??
          point.count ??
          point.total ??
          point.percent ??
          point.y ??
          point.netCashFlow ??
          point.netChange ??
          point.netIncome ??
          point.revenue ??
          point.operating ??
          point.investing ??
          point.financing ??
          point.grossProfit ??
          point.expenses ??
          0
      }
      // Round to 2 decimal places to avoid floating point issues like 110.00000000000001
      const roundedValue = typeof value === 'number' ? Math.round(value * 100) / 100 : value
      return { ...point, label, value: roundedValue }
    })

    // For multi-series charts, transform flat data with series field
    // into grouped series arrays that the renderer expects
    let series: ChartSeries[] | undefined
    let labels: string[] | undefined

    // Check if this chart supports multi-series and data has series field
    const isMultiSeriesChart = chartType === 'bar' || chartType === 'line' || chartType === 'area'
    const hasFlatSeriesData = chartData.length > 0 && chartData.some((d: any) => d.series)
    const hasPreGroupedSeries = Array.isArray(input.series) && input.series.length > 0

    // If LLM already sent pre-grouped series data, use it directly
    if (hasPreGroupedSeries) {
      series = input.series.map((s: any, idx: number) => ({
        name: s.name || s.label || `Series ${idx + 1}`,
        data: Array.isArray(s.data) ? s.data : [],
        color: s.color || CHART_COLORS[idx % CHART_COLORS.length],
      }))
      labels = input.labels || []
      aiDebug.transform.output({
        type: 'chart',
        chartType,
        success: true,
      } as any)
    } else if (isMultiSeriesChart && hasFlatSeriesData) {
      // Group flat data by series name
      // Input: [{label: "Q1", series: "Product A", value: 100}, {label: "Q1", series: "Product B", value: 50}, ...]
      // Output: { series: [{name: "Product A", data: [100, ...]}, ...], labels: ["Q1", ...] }

      // Detect degenerate case: all data points have the same label (LLM used series name as label).
      // When top-level labels[] are provided with distinct values, use those as x-axis instead
      // and map data points by index within each series group.
      const uniqueDataLabels = new Set(chartData.map((d: any) => d.label || 'Unknown'))
      const hasTopLevelLabels = Array.isArray(input.labels) && input.labels.length > 0
      const allSameLabel = uniqueDataLabels.size === 1 && chartData.length > 1

      if (allSameLabel && hasTopLevelLabels) {
        // LLM sent data[] with identical labels but correct top-level labels[]
        // Group by series name and use positional index to map values to labels
        const seriesGroups = new Map<string, number[]>()
        for (const point of chartData) {
          const seriesName = point.series || 'Default'
          if (!seriesGroups.has(seriesName)) seriesGroups.set(seriesName, [])
          seriesGroups.get(seriesName)!.push(point.value)
        }
        labels = input.labels
        series = Array.from(seriesGroups.entries()).map(([name, values], idx) => ({
          name,
          data: values.slice(0, labels!.length),
          color: CHART_COLORS[idx % CHART_COLORS.length],
        }))
      } else {
        const seriesMap = new Map<string, Map<string, number>>()
        const labelSet = new Set<string>()

        // Collect all labels and series data
        for (const point of chartData) {
          const seriesName = point.series || 'Default'
          const label = point.label || 'Unknown'

          labelSet.add(label)

          if (!seriesMap.has(seriesName)) {
            seriesMap.set(seriesName, new Map())
          }
          seriesMap.get(seriesName)!.set(label, point.value)
        }

        // Convert to arrays
        labels = Array.from(labelSet)
        series = Array.from(seriesMap.entries()).map(([name, dataMap], idx) => ({
          name,
          data: labels!.map((label) => dataMap.get(label) || 0),
          color: CHART_COLORS[idx % CHART_COLORS.length],
        }))
      }

      aiDebug.transform.output({
        type: 'chart',
        chartType,
        success: true,
      } as any)
    }

    const result: ChartBlock = {
      type: 'chart',
      chartType,
      title: input.title,
      data: chartData,
      series,
      labels,
      orientation: input.orientation,
      max: input.max,
      target: input.target,
      showLegend: true,
      showLabels: true,
      currency: input.currencyCode,
      // Pass through chart-specific properties (optional fields)
      ...(input.sankeyData && { sankeyData: input.sankeyData }),
    }

    aiDebug.transform.output({ type: 'chart', chartType, success: true })
    return result
  }

  // Handle KPI type
  if (inputType === 'kpi') {
    const result = {
      type: 'kpi',
      title: input.title,
      metrics: input.metrics || [],
      currencyCode: input.currencyCode,
    } as KPIBlock
    aiDebug.transform.output({ type: 'kpi', success: true })
    return result
  }

  // Handle single metric type
  if (inputType === 'metric') {
    const result = {
      type: 'metric',
      label: input.label || 'Metric',
      value: input.value ?? 0,
      format: input.format,
      trend: input.trend,
      color: input.color,
      currencyCode: input.currencyCode,
    } as MetricBlock
    aiDebug.transform.output({ type: 'metric', success: true })
    return result
  }

  // Handle comparison type
  if (inputType === 'comparison') {
    const result = {
      type: 'comparison',
      title: input.title,
      periods: input.periods || [],
      showChange: input.showChange ?? true,
      currencyCode: input.currencyCode,
    } as ComparisonBlock
    aiDebug.transform.output({ type: 'comparison', success: true })
    return result
  }

  // Handle progress type
  if (inputType === 'progress') {
    const result = {
      type: 'progress',
      title: input.title,
      items: input.items || [],
      showLabels: true,
      currencyCode: input.currencyCode,
    } as ProgressBlock
    aiDebug.transform.output({ type: 'progress', success: true })
    return result
  }

  // Handle timeline type
  if (inputType === 'timeline') {
    const result = {
      type: 'timeline',
      title: input.title,
      events: input.events || [],
    } as TimelineBlock
    aiDebug.transform.output({ type: 'timeline', success: true })
    return result
  }

  aiDebug.transform.error({ inputType, reason: `Unrecognized visualization type: ${inputType}` })
  return null
}
