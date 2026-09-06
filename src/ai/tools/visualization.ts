// src/ai/tools/visualization.ts
// Visualization creation tool

import { tool } from '@langchain/core/tools'
import { z } from 'zod'

// =============================================================================
// Schemas
// =============================================================================

const chartDataPointSchema = z
  .object({
    label: z.string().optional().describe('Label for this data point (auto-generated if missing)'),
    value: z.number().optional().describe('Numeric value (required for most charts)'),
    color: z.string().optional().describe('Optional hex color'),
    type: z
      .enum(['initial', 'positive', 'negative', 'final'])
      .optional()
      .describe('For waterfall charts'),
    category: z.string().optional().describe('Category for grouping in stacked charts'),
    series: z.string().optional().describe('Series name for multi-series charts'),
    // Scatter/heatmap coordinates
    x: z
      .union([z.number(), z.string()])
      .optional()
      .describe('X coordinate or category for scatter/heatmap'),
    y: z
      .union([z.number(), z.string()])
      .optional()
      .describe('Y coordinate or category for scatter/heatmap'),
    size: z.number().optional().describe('Size for bubble charts'),
    // Value alternatives
    amount: z.number().optional().describe('Alternative to value for amounts'),
    count: z.number().optional().describe('Count value'),
    percent: z.number().optional().describe('Percentage value'),
    total: z.number().optional().describe('Total value'),
    // Boxplot fields
    min: z.number().optional().describe('Minimum value for boxplot'),
    q1: z.number().optional().describe('First quartile for boxplot'),
    median: z.number().optional().describe('Median for boxplot'),
    q3: z.number().optional().describe('Third quartile for boxplot'),
    max: z.number().optional().describe('Maximum value for boxplot'),
    // Hierarchical data (treemap/sunburst)
    children: z.array(z.any()).optional().describe('Child nodes for hierarchical charts'),
  })
  .passthrough()

const trendSchema = z.object({
  direction: z.enum(['up', 'down', 'flat']).describe('Trend direction'),
  value: z.number().describe('Percentage change'),
  isGood: z.boolean().optional().describe('Whether this trend is positive'),
})

// Valid format values for KPI metrics
const VALID_FORMATS = ['currency', 'percent', 'number', 'compact'] as const
type ValidFormat = (typeof VALID_FORMATS)[number]

/**
 * Sanitize format values to prevent tool validation errors from invalid LLM outputs.
 * Maps common invalid formats to their correct values.
 */
function sanitizeFormat(value: unknown): ValidFormat | undefined {
  if (value === undefined || value === null) return undefined
  const str = String(value).toLowerCase().trim()

  // Direct matches
  if (VALID_FORMATS.includes(str as ValidFormat)) return str as ValidFormat

  // Common LLM mistakes - map to correct format
  const formatMap: Record<string, ValidFormat> = {
    $: 'currency',
    money: 'currency',
    usd: 'currency',
    dollar: 'currency',
    dollars: 'currency',
    '%': 'percent',
    percentage: 'percent',
    ratio: 'percent',
    int: 'number',
    integer: 'number',
    decimal: 'number',
    float: 'number',
    num: 'number',
    short: 'compact',
    abbreviated: 'compact',
    k: 'compact',
    m: 'compact',
  }

  return formatMap[str] || 'number' // Default to 'number' for any unknown format
}

const kpiItemSchema = z.object({
  label: z.string().describe('Metric name'),
  value: z.union([z.number(), z.string()]).describe('Metric value'),
  format: z
    .any()
    .optional()
    .transform(sanitizeFormat)
    .describe(
      'Display format. Use "currency" for money, "percent" for %, "number" for plain numbers. AVOID "compact" - it adds k/M suffixes which can misrepresent data.'
    ),
  trend: trendSchema.optional(),
  color: z.string().optional().describe('Color name'),
})

const timelineEventSchema = z.object({
  date: z.string().describe('ISO date string'),
  label: z.string().describe('Event title'),
  description: z.string().optional(),
  type: z.enum(['positive', 'negative', 'neutral', 'warning']).optional(),
  value: z.number().optional().describe('Associated monetary value'),
})

// =============================================================================
// Visualization Index Tracking (Session-Scoped)
// =============================================================================

/**
 * CRITICAL FIX: Use session-scoped state instead of global state to prevent
 * race conditions when handling concurrent requests.
 *
 * Global state (like `let currentVizIndex = 0`) is NOT thread-safe in Node.js
 * concurrent execution contexts. Multiple simultaneous requests would corrupt
 * each other's visualization indexes.
 *
 * Solution: Map each session ID to its own visualization index counter.
 */
const sessionVizIndexes = new Map<string, number>()

/**
 * Get the current visualization index for a specific session
 */
function getSessionVizIndex(sessionId: string): number {
  return sessionVizIndexes.get(sessionId) || 0
}

/**
 * Increment and return the next visualization index for a session
 */
function incrementSessionVizIndex(sessionId: string): number {
  const current = getSessionVizIndex(sessionId)
  const next = current + 1
  sessionVizIndexes.set(sessionId, next)
  return next
}

/**
 * Reset visualization index for a specific session or all sessions
 * @param sessionId - Optional session ID. If omitted, clears all sessions.
 */
export function resetVisualizationIndex(sessionId?: string) {
  if (sessionId) {
    sessionVizIndexes.delete(sessionId)
  } else {
    sessionVizIndexes.clear()
  }
}

// =============================================================================
// Visualization Tool
// =============================================================================

export const createVisualization = tool(
  async (input, config): Promise<string> => {
    // Extract session ID from config (LangChain provides this via configurable context)
    // Fall back to 'default' if no session ID is available
    const sessionId = config?.configurable?.sessionId || 'default'

    // Use session-scoped index instead of global state
    const vizIndex = incrementSessionVizIndex(sessionId)

    // Normalize data points - auto-generate labels if missing
    // This prevents tool validation errors when LLM omits labels
    const normalizedInput = { ...input }

    // Auto-inject currency from configurable context when LLM omits currencyCode.
    // The LLM frequently forgets to pass currencyCode even though the prompt says to.
    // This ensures non-USD currencies (NGN, CAD, etc.) display correctly.
    if (!normalizedInput.currencyCode && config?.configurable?.currency) {
      normalizedInput.currencyCode = config.configurable.currency
    }

    if (normalizedInput.data && Array.isArray(normalizedInput.data)) {
      normalizedInput.data = normalizedInput.data.map((point, index) => {
        if (!point.label) {
          // Auto-generate label from available fields
          const autoLabel =
            point.x?.toString() || point.category || point.series || `Item ${index + 1}`
          return { ...point, label: autoLabel }
        }
        return point
      })
    }

    return JSON.stringify({
      success: true,
      visualization: normalizedInput,
      vizIndex,
      marker: `[[VIZ:${vizIndex}]]`,
      instruction: `Visualization #${vizIndex} created. Include the marker [[VIZ:${vizIndex}]] in your response text exactly where you want this ${input.type || 'visualization'} to appear.`,
    })
  },
  {
    name: 'create_visualization',
    description: `Create a chart, KPI display, or other visualization. You MUST call this tool to display any visual data. For tables, use markdown tables directly in your response - they automatically get pagination and styling.

MANDATORY: You must call this tool BEFORE writing any [[VIZ:N]] marker. The marker only works if this tool was called first.
After calling, include the returned marker (e.g., [[VIZ:1]]) in your response text where you want the chart to appear.

**Basic Charts:**
- chart:bar - Bar charts for comparisons (auto-detects stacked when using series[], diverging when values are negative, use orientation:"horizontal" for horizontal bars)
- chart:line, chart:area - Line/area charts for trends (use series[] for multi-series, area auto-stacks)
- chart:pie, chart:donut - Pie charts for composition/breakdown
- chart:scatter - Correlation analysis
- chart:radar - Multi-dimensional performance comparison

**Financial Charts:**
- chart:waterfall - Cash flow analysis (use type: initial/positive/negative/final)

**Hierarchical Charts:**
- chart:treemap - Hierarchical data with area proportions

**Flow Charts:**
- chart:sankey - Flow visualization (requires sankeyData with nodes and links)

**Distribution Charts:**
- chart:boxplot - Statistical distribution (min, q1, median, q3, max)

**Other Visualizations:**
- kpi - 2-4 key metrics with optional trends
- metric - Single highlighted number
- comparison - Period-over-period analysis
- progress - Budget/goal tracking with progress bars
- timeline - Scheduled events and dates

Always provide a title and meaningful labels for data points.`,
    schema: z.object({
      currencyCode: z
        .string()
        .optional()
        .describe(
          'ISO 4217 currency code for formatting money values (e.g. "NGN", "USD", "GBP"). Pass this ONLY when the chart displays monetary/currency data. Do NOT pass currencyCode for charts showing quantities, units, counts, or percentages — it will incorrectly add currency symbols to the axis.'
        ),
      type: z
        .enum([
          // Basic charts
          'chart:bar', // Unified: handles vertical, horizontal, stacked, diverging
          'chart:line',
          'chart:area', // Handles both single and stacked multi-series
          'chart:pie',
          'chart:donut',
          'chart:scatter',
          'chart:radar',
          // Financial charts
          'chart:waterfall',
          // Hierarchical charts
          'chart:treemap',
          // Flow charts
          'chart:sankey',
          // Distribution charts
          'chart:boxplot',
          // Other visualizations
          'kpi',
          'metric',
          'comparison',
          'progress',
          'timeline',
        ])
        .describe('The type of visualization to create'),
      title: z.string().optional().describe('Title for the visualization'),
      orientation: z
        .enum(['vertical', 'horizontal'])
        .optional()
        .describe(
          'Bar chart orientation (default: vertical). Use horizontal for long labels or ranked lists.'
        ),
      data: z.array(chartDataPointSchema).optional().describe('Data points for charts'),
      max: z.number().optional().describe('Maximum value for progress bars'),
      target: z.number().optional().describe('Target value for progress bars'),
      metrics: z.array(kpiItemSchema).optional().describe('Metrics for KPI display'),
      label: z.string().optional().describe('Label for single metric'),
      value: z.union([z.number(), z.string()]).optional().describe('Value for single metric'),
      format: z
        .any()
        .optional()
        .transform(sanitizeFormat)
        .describe(
          'Display format. Use "currency" for money, "percent" for %, "number" for plain. AVOID "compact" - it adds k/M suffixes which can misrepresent exact values.'
        ),
      trend: trendSchema.optional(),
      color: z.string().optional().describe('Color name'),
      periods: z
        .array(
          z.object({
            label: z.string(),
            value: z.number(),
            format: z.any().optional().transform(sanitizeFormat),
          })
        )
        .optional()
        .describe('Periods for comparison'),
      showChange: z.boolean().optional().describe('Show percentage change between periods'),
      items: z
        .array(
          z.object({
            label: z.string(),
            value: z.number(),
            max: z.number().optional(),
            target: z.number().optional(),
            format: z.any().optional().transform(sanitizeFormat),
          })
        )
        .optional()
        .describe('Items for progress bars'),
      events: z.array(timelineEventSchema).optional().describe('Events for timeline'),
      // Multi-series support for stacked charts
      labels: z.array(z.string()).optional().describe('X-axis labels for multi-series charts'),
      xAxisLabel: z.string().optional().describe('Label for X-axis'),
      yAxisLabel: z.string().optional().describe('Label for Y-axis'),
      series: z
        .array(
          z.object({
            name: z.string().describe('Series name'),
            data: z
              .array(z.number().nullable())
              .describe('Series values (null for missing data points)'),
            color: z.string().optional(),
          })
        )
        .optional()
        .describe('Multiple data series for stacked/multi-line charts'),
      // Sankey chart specific
      sankeyData: z
        .object({
          nodes: z.array(z.object({ name: z.string() })).describe('Sankey nodes'),
          links: z
            .array(
              z.object({
                source: z.union([z.string(), z.number()]).describe('Source node name or index'),
                target: z.union([z.string(), z.number()]).describe('Target node name or index'),
                value: z.number(),
              })
            )
            .describe('Sankey links - source/target can be node name (string) or index (number)'),
        })
        .optional()
        .describe('Data for sankey chart (nodes and links)'),
    }),
  }
)
