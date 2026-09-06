// src/lib/pdf/chatResponseParser.ts
/**
 * Parser for chat response DynamoDB format
 * Handles the new chat response structure with [[VIZ:X]] placeholders
 */

// Types for parsed chat response
export interface ParsedMetric {
  label: string
  value: number
  format: 'currency' | 'number' | 'percentage'
  trend?: {
    direction: 'up' | 'down' | 'flat'
    value: number
    isGood: boolean
  }
}

export interface ParsedKPIComponent {
  type: 'kpi'
  title: string
  vizIndex: number
  metrics: ParsedMetric[]
  currencyCode?: string
}

export interface ParsedChartSeries {
  name: string
  data: number[]
}

export interface ParsedLineChartComponent {
  type: 'chart:line'
  title: string
  vizIndex: number
  labels: string[]
  series: ParsedChartSeries[]
  format: 'currency' | 'number'
}

export interface ParsedDonutDataPoint {
  label: string
  value: number
}

export interface ParsedDonutChartComponent {
  type: 'chart:donut'
  title: string
  vizIndex: number
  data: ParsedDonutDataPoint[]
  format: 'currency' | 'number'
}

export interface ParsedBarChartComponent {
  type: 'chart:bar'
  title: string
  vizIndex: number
  orientation?: 'vertical' | 'horizontal'
  data?: ParsedDonutDataPoint[]
  labels?: string[]
  series?: ParsedChartSeries[]
  format: 'currency' | 'number'
}

export interface ParsedWaterfallDataPoint {
  label: string
  value: number
  type: 'initial' | 'positive' | 'negative' | 'final'
}

export interface ParsedWaterfallChartComponent {
  type: 'chart:waterfall'
  title: string
  vizIndex: number
  data: ParsedWaterfallDataPoint[]
  format: 'currency' | 'number'
}

export interface ParsedAreaChartComponent {
  type: 'chart:area'
  title: string
  vizIndex: number
  labels: string[]
  series?: ParsedChartSeries[]
  data?: ParsedDonutDataPoint[]
  format: 'currency' | 'number'
}

export interface ParsedScatterChartComponent {
  type: 'chart:scatter'
  title: string
  vizIndex: number
  data: ParsedDonutDataPoint[]
  format: 'currency' | 'number'
}

export interface ParsedRadarChartComponent {
  type: 'chart:radar'
  title: string
  vizIndex: number
  data: ParsedDonutDataPoint[]
  format: 'currency' | 'number'
}

export interface ParsedTreemapDataPoint {
  label: string
  value: number
  children?: ParsedTreemapDataPoint[]
}

export interface ParsedTreemapChartComponent {
  type: 'chart:treemap'
  title: string
  vizIndex: number
  data: ParsedTreemapDataPoint[]
  format: 'currency' | 'number'
}

export interface ParsedSankeyChartComponent {
  type: 'chart:sankey'
  title: string
  vizIndex: number
  sankeyData: {
    nodes: Array<{ name: string }>
    links: Array<{ source: string | number; target: string | number; value: number }>
  }
  format: 'currency' | 'number'
}

export interface ParsedBoxplotDataPoint {
  label: string
  values?: number[]
  min?: number
  q1?: number
  value?: number
  q3?: number
  max?: number
}

export interface ParsedBoxplotChartComponent {
  type: 'chart:boxplot'
  title: string
  vizIndex: number
  data: ParsedBoxplotDataPoint[]
  format: 'currency' | 'number'
}

export interface ParsedMetricComponent {
  type: 'metric'
  label: string
  vizIndex: number
  value: number | string
  format?: string
  description?: string
  trend?: {
    direction: 'up' | 'down' | 'flat'
    value: number
    isGood?: boolean
  }
  color?: string
  sparkline?: number[]
}

export interface ParsedComparisonPeriod {
  label: string
  value: number
  format?: string
}

export interface ParsedComparisonComponent {
  type: 'comparison'
  title?: string
  vizIndex: number
  periods: ParsedComparisonPeriod[]
  showChange?: boolean
  changeLabel?: string
}

export interface ParsedProgressItem {
  label: string
  value: number
  max?: number
  target?: number
  format?: string
  color?: string
}

export interface ParsedProgressComponent {
  type: 'progress'
  title?: string
  vizIndex: number
  items: ParsedProgressItem[]
  showLabels?: boolean
}

export interface ParsedTimelineEvent {
  label: string
  date: string | number
  description?: string
  value?: number
  type?: 'positive' | 'negative' | 'warning'
}

export interface ParsedTimelineComponent {
  type: 'timeline'
  title?: string
  vizIndex: number
  events: ParsedTimelineEvent[]
}

export type ParsedComponent =
  | ParsedKPIComponent
  | ParsedLineChartComponent
  | ParsedDonutChartComponent
  | ParsedBarChartComponent
  | ParsedWaterfallChartComponent
  | ParsedAreaChartComponent
  | ParsedScatterChartComponent
  | ParsedRadarChartComponent
  | ParsedTreemapChartComponent
  | ParsedSankeyChartComponent
  | ParsedBoxplotChartComponent
  | ParsedMetricComponent
  | ParsedComparisonComponent
  | ParsedProgressComponent
  | ParsedTimelineComponent

export interface ParsedChatResponse {
  id: string
  role: string
  content: string
  timestamp: number
  components: ParsedComponent[]
}

/**
 * Parse a DynamoDB value to its JavaScript equivalent
 * Handles S (string), N (number), M (map), L (list), BOOL (boolean), NULL (null)
 */
export function parseDynamoDBValue(value: any): any {
  if (value === null || value === undefined) return null

  // Only check for DynamoDB type descriptors on objects (not primitives)
  if (typeof value !== 'object') return value

  // String
  if ('S' in value && typeof value.S === 'string') return value.S

  // Number - guard against NaN from invalid strings
  if ('N' in value && typeof value.N === 'string') {
    const parsed = parseFloat(value.N)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  // Boolean
  if ('BOOL' in value && typeof value.BOOL === 'boolean') return value.BOOL

  // Null
  if ('NULL' in value) return null

  // Map (object)
  if ('M' in value && typeof value.M === 'object') {
    const result: any = {}
    for (const key in value.M) {
      result[key] = parseDynamoDBValue(value.M[key])
    }
    return result
  }

  // List (array)
  if ('L' in value && Array.isArray(value.L)) {
    return value.L.map((item: any) => parseDynamoDBValue(item))
  }

  // If no type descriptor, return as-is (already plain JSON)
  return value
}

/**
 * Check if a value looks like DynamoDB format (has type descriptors)
 */
function isDynamoDBFormat(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false

  // Check for common DynamoDB patterns
  // DynamoDB format has PK/SK keys or nested objects with S, N, M, L, BOOL keys
  if (obj.PK && typeof obj.PK === 'object' && 'S' in obj.PK) return true
  if (obj.content && typeof obj.content === 'object' && 'S' in obj.content) return true
  if (obj.components && typeof obj.components === 'object' && 'L' in obj.components) return true

  return false
}

/**
 * Parse a complete DynamoDB chat response to a structured format
 */
export function parseDynamoDBChatResponse(dynamoResponse: any): ParsedChatResponse {
  // Check if it's already parsed (plain JSON) vs DynamoDB format
  const isRawDynamoDB = isDynamoDBFormat(dynamoResponse)

  if (!isRawDynamoDB) {
    // Already plain JSON, just normalize the structure
    return normalizeChatResponse(dynamoResponse)
  }

  // Parse DynamoDB format
  const parsed: any = {}
  for (const key in dynamoResponse) {
    if (key === 'PK' || key === 'SK') continue
    parsed[key] = parseDynamoDBValue(dynamoResponse[key])
  }

  return normalizeChatResponse(parsed)
}

/**
 * Normalize a chat response to ensure consistent structure
 */
function normalizeChatResponse(response: any): ParsedChatResponse {
  const components = (response.components || []).map(parseComponent).filter(Boolean)

  // Handle different content field names (displayContent, content)
  const content = response.displayContent || response.content || ''

  // Handle different timestamp field names (ts, timestamp, createdAt)
  const timestamp = response.ts || response.timestamp || response.createdAt || Date.now()

  return {
    id: response.id || '',
    role: response.role || 'assistant',
    content: typeof content === 'string' ? content : '',
    timestamp: typeof timestamp === 'number' ? timestamp : Date.now(),
    components: components as ParsedComponent[],
  }
}

/**
 * Parse a component based on its type
 * Handles both formats:
 * - UI format: { type: 'chart', chartType: 'donut', ... }
 * - DynamoDB format: { type: 'chart:donut', ... }
 */
function parseComponent(component: any): ParsedComponent | null {
  // Skip non-objects and objects without type
  if (!component || typeof component !== 'object' || !component.type) return null

  let type = component.type
  const vizIndex = component.vizIndex ?? 0

  // Handle UI format where type is 'chart' and chartType specifies the chart type
  if (type === 'chart' && component.chartType) {
    type = `chart:${component.chartType}`
  }

  let parsed: ParsedComponent | null = null

  switch (type) {
    case 'kpi':
      parsed = parseKPIComponent(component, vizIndex)
      break
    case 'chart:line':
      parsed = parseLineChartComponent(component, vizIndex)
      break
    case 'chart:donut':
    case 'chart:pie':
      parsed = parseDonutChartComponent(component, vizIndex)
      break
    case 'chart:bar':
      // Unified bar chart - handles vertical, horizontal, stacked, diverging
      parsed = parseBarChartComponent(component, vizIndex)
      break
    case 'chart:waterfall':
      parsed = parseWaterfallChartComponent(component, vizIndex)
      break
    case 'chart:area':
      parsed = parseAreaChartComponent(component, vizIndex)
      break
    case 'chart:scatter':
      parsed = parseScatterChartComponent(component, vizIndex)
      break
    case 'chart:radar':
      parsed = parseRadarChartComponent(component, vizIndex)
      break
    case 'chart:treemap':
    case 'chart:sunburst': // Sunburst is rendered same as treemap (hierarchical)
      parsed = parseTreemapChartComponent(component, vizIndex)
      break
    case 'chart:sankey':
      parsed = parseSankeyChartComponent(component, vizIndex)
      break
    case 'chart:boxplot':
      parsed = parseBoxplotChartComponent(component, vizIndex)
      break
    case 'metric':
      parsed = parseMetricComponent(component, vizIndex)
      break
    case 'comparison':
      parsed = parseComparisonComponent(component, vizIndex)
      break
    case 'progress':
      parsed = parseProgressComponent(component, vizIndex)
      break
    case 'timeline':
      parsed = parseTimelineComponent(component, vizIndex)
      break
    default:
      // Log but don't fail for unknown types
      console.warn(`[PDF Export] Skipping unknown component type: ${type}`)
      return null
  }

  // Propagate currencyCode from the visualization block to all parsed components.
  // This ensures PDF export uses the correct currency (e.g. NGN) for non-USD orgs.
  // ChartBlock stores it as `currency`, KPI/table/metric blocks store it as `currencyCode`.
  const componentCurrency = component.currencyCode || component.currency
  if (parsed && componentCurrency) {
    ;(parsed as any).currencyCode = componentCurrency
  }

  return parsed
}

/**
 * Parse KPI component
 */
function parseKPIComponent(component: any, vizIndex: number): ParsedKPIComponent {
  const metrics: ParsedMetric[] = (component.metrics || []).map((metric: any) => ({
    label: metric.label || '',
    value: metric.value || 0,
    format: metric.format || 'number',
    trend: metric.trend
      ? {
          direction: metric.trend.direction || 'flat',
          value: metric.trend.value || 0,
          isGood: metric.trend.isGood ?? true,
        }
      : undefined,
  }))

  return {
    type: 'kpi',
    title: component.title || 'Key Metrics',
    vizIndex,
    metrics,
    currencyCode: component.currencyCode || undefined,
  }
}

/**
 * Parse line chart component
 * Spread original component to preserve ALL properties (series, labels, data, etc.)
 * This ensures PDF rendering has access to the same data as the UI
 */
function parseLineChartComponent(component: any, vizIndex: number): ParsedLineChartComponent {
  return {
    ...component, // Preserve ALL original properties
    type: 'chart:line', // Normalize type
    vizIndex,
    title: component.title || 'Line Chart',
    format: component.format || 'number',
    // Ensure arrays are present (may already exist from spread)
    labels: Array.isArray(component.labels) ? component.labels : [],
    series: Array.isArray(component.series)
      ? component.series.map((s: any) => ({
          ...s, // Preserve all series properties
          name: s.name || '',
          data: Array.isArray(s.data) ? s.data : [],
        }))
      : [],
  }
}

/**
 * Parse donut chart component
 */
function parseDonutChartComponent(component: any, vizIndex: number): ParsedDonutChartComponent {
  const data: ParsedDonutDataPoint[] = (component.data || []).map((d: any) => ({
    label: d.label || '',
    value: d.value || 0,
  }))

  return {
    type: 'chart:donut',
    title: component.title || 'Donut Chart',
    vizIndex,
    data,
    format: component.format || 'currency',
  }
}

/**
 * Parse unified bar chart component
 * Handles: vertical (default), horizontal, stacked (series[]+labels[]), diverging (negative values)
 */
function parseBarChartComponent(component: any, vizIndex: number): ParsedBarChartComponent {
  // Check for multi-series (stacked)
  const isMultiSeries = Boolean(component.series?.length && component.labels?.length)

  if (isMultiSeries) {
    const labels: string[] = component.labels || []
    const series: ParsedChartSeries[] = (component.series || []).map((s: any) => ({
      name: s.name || '',
      data: s.data || [],
    }))

    return {
      type: 'chart:bar',
      title: component.title || 'Stacked Bar Chart',
      vizIndex,
      orientation: component.orientation,
      labels,
      series,
      format: component.format || 'number',
    }
  }

  // Single series (vertical, horizontal, or diverging)
  const data: ParsedDonutDataPoint[] = (component.data || []).map((d: any) => ({
    label: d.label || '',
    value: d.value || 0,
  }))

  return {
    type: 'chart:bar',
    title: component.title || 'Bar Chart',
    vizIndex,
    orientation: component.orientation,
    data,
    format: component.format || 'currency',
  }
}

/**
 * Parse waterfall chart component
 */
function parseWaterfallChartComponent(
  component: any,
  vizIndex: number
): ParsedWaterfallChartComponent {
  const data: ParsedWaterfallDataPoint[] = (component.data || []).map((d: any) => ({
    label: d.label || '',
    value: d.value || 0,
    type: d.type || 'positive',
  }))

  return {
    type: 'chart:waterfall',
    title: component.title || 'Waterfall Chart',
    vizIndex,
    data,
    format: component.format || 'currency',
  }
}

/**
 * Parse area chart component
 */
function parseAreaChartComponent(component: any, vizIndex: number): ParsedAreaChartComponent {
  const labels: string[] = component.labels || []
  const series: ParsedChartSeries[] | undefined = component.series
    ? component.series.map((s: any) => ({ name: s.name || '', data: s.data || [] }))
    : undefined
  const data: ParsedDonutDataPoint[] | undefined = component.data
    ? component.data.map((d: any) => ({ label: d.label || '', value: d.value || 0 }))
    : undefined

  return {
    type: 'chart:area',
    title: component.title || 'Area Chart',
    vizIndex,
    labels,
    series,
    data,
    format: component.format || 'number',
  }
}

/**
 * Parse scatter chart component
 */
function parseScatterChartComponent(component: any, vizIndex: number): ParsedScatterChartComponent {
  const data: ParsedDonutDataPoint[] = (component.data || []).map((d: any) => ({
    label: d.label || '',
    value: d.value || 0,
  }))

  return {
    type: 'chart:scatter',
    title: component.title || 'Scatter Chart',
    vizIndex,
    data,
    format: component.format || 'number',
  }
}

/**
 * Parse radar chart component
 */
function parseRadarChartComponent(component: any, vizIndex: number): ParsedRadarChartComponent {
  const data: ParsedDonutDataPoint[] = (component.data || []).map((d: any) => ({
    label: d.label || '',
    value: d.value || 0,
  }))

  return {
    type: 'chart:radar',
    title: component.title || 'Radar Chart',
    vizIndex,
    data,
    format: component.format || 'number',
  }
}

/**
 * Parse treemap chart component
 */
function parseTreemapChartComponent(component: any, vizIndex: number): ParsedTreemapChartComponent {
  const parseTreemapData = (items: any[]): ParsedTreemapDataPoint[] =>
    items.map((d: any) => ({
      label: d.label || d.name || '',
      value: d.value || 0,
      children: d.children ? parseTreemapData(d.children) : undefined,
    }))

  return {
    type: 'chart:treemap',
    title: component.title || 'Treemap',
    vizIndex,
    data: parseTreemapData(component.data || []),
    format: component.format || 'number',
  }
}

/**
 * Parse sankey chart component
 */
function parseSankeyChartComponent(component: any, vizIndex: number): ParsedSankeyChartComponent {
  const sankeyData = component.sankeyData || { nodes: [], links: [] }

  return {
    type: 'chart:sankey',
    title: component.title || 'Sankey Diagram',
    vizIndex,
    sankeyData: {
      nodes: sankeyData.nodes || [],
      links: sankeyData.links || [],
    },
    format: component.format || 'number',
  }
}

/**
 * Parse boxplot chart component
 */
function parseBoxplotChartComponent(component: any, vizIndex: number): ParsedBoxplotChartComponent {
  const data: ParsedBoxplotDataPoint[] = (component.data || []).map((d: any) => ({
    label: d.label || '',
    values: d.values,
    min: d.min,
    q1: d.q1,
    value: d.value,
    q3: d.q3,
    max: d.max,
  }))

  return {
    type: 'chart:boxplot',
    title: component.title || 'Box Plot',
    vizIndex,
    data,
    format: component.format || 'number',
  }
}

/**
 * Parse metric component
 */
function parseMetricComponent(component: any, vizIndex: number): ParsedMetricComponent {
  return {
    type: 'metric',
    label: component.label || 'Metric',
    vizIndex,
    value: component.value || 0,
    format: component.format,
    description: component.description,
    trend: component.trend
      ? {
          direction: component.trend.direction || 'flat',
          value: component.trend.value || 0,
          isGood: component.trend.isGood,
        }
      : undefined,
    color: component.color,
    sparkline: component.sparkline,
  }
}

/**
 * Parse comparison component
 */
function parseComparisonComponent(component: any, vizIndex: number): ParsedComparisonComponent {
  const periods: ParsedComparisonPeriod[] = (component.periods || []).map((p: any) => ({
    label: p.label || '',
    value: p.value || 0,
    format: p.format,
  }))

  return {
    type: 'comparison',
    title: component.title,
    vizIndex,
    periods,
    showChange: component.showChange ?? true,
    changeLabel: component.changeLabel,
  }
}

/**
 * Parse progress component
 */
function parseProgressComponent(component: any, vizIndex: number): ParsedProgressComponent {
  const items: ParsedProgressItem[] = (component.items || []).map((item: any) => ({
    label: item.label || '',
    value: item.value || 0,
    max: item.max,
    target: item.target,
    format: item.format,
    color: item.color,
  }))

  return {
    type: 'progress',
    title: component.title,
    vizIndex,
    items,
    showLabels: component.showLabels ?? true,
  }
}

/**
 * Parse timeline component
 */
function parseTimelineComponent(component: any, vizIndex: number): ParsedTimelineComponent {
  const events: ParsedTimelineEvent[] = (component.events || []).map((event: any) => ({
    label: event.label || '',
    date: event.date || Date.now(),
    description: event.description,
    value: event.value,
    type: event.type,
  }))

  return {
    type: 'timeline',
    title: component.title,
    vizIndex,
    events,
  }
}

/**
 * Extract VIZ placeholders from content
 * Returns an array of vizIndex numbers found in the content
 */
export function extractVizPlaceholders(content: string): number[] {
  const regex = /\[\[VIZ:(\d+)\]\]/g
  const matches: number[] = []
  let match

  while ((match = regex.exec(content)) !== null) {
    matches.push(parseInt(match[1], 10))
  }

  return matches
}

/**
 * Split content into segments based on VIZ placeholders
 * Returns an array of segments, each being either text or a vizIndex
 */
export interface ContentSegment {
  type: 'text' | 'viz'
  content: string | number
}

export function splitContentByViz(content: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  const regex = /\[\[VIZ:(\d+)\]\]/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      const text = content.substring(lastIndex, match.index).trim()
      if (text) {
        segments.push({ type: 'text', content: text })
      }
    }

    // Add the VIZ placeholder
    segments.push({ type: 'viz', content: parseInt(match[1], 10) })

    lastIndex = match.index + match[0].length
  }

  // Add remaining text after last match
  if (lastIndex < content.length) {
    const text = content.substring(lastIndex).trim()
    if (text) {
      segments.push({ type: 'text', content: text })
    }
  }

  return segments
}

/**
 * Extended content segment that includes widgets
 */
export interface ExtendedContentSegment {
  type: 'text' | 'viz' | 'widget'
  content: string | number
}

/**
 * Split content into segments based on VIZ and WIDGET placeholders
 * Returns an array of segments, each being text, vizIndex, or widgetIndex
 * Invalid markers (malformed) are shown as [Invalid reference] text
 */
export function splitContentByMarkers(content: string): ExtendedContentSegment[] {
  const segments: ExtendedContentSegment[] = []
  // Combined regex for both VIZ and WIDGET markers - also captures malformed markers
  const validMarkerRegex = /\[\[(VIZ|WIDGET):(\d+)\]\]/g
  const malformedMarkerRegex = /\[\[(VIZ|WIDGET):[^\]]*\]\]/gi
  let lastIndex = 0
  let match

  // First pass: find all valid markers
  const validMatches: Array<{ index: number; length: number; type: 'viz' | 'widget'; id: number }> =
    []
  while ((match = validMarkerRegex.exec(content)) !== null) {
    validMatches.push({
      index: match.index,
      length: match[0].length,
      type: match[1].toLowerCase() as 'viz' | 'widget',
      id: parseInt(match[2], 10),
    })
  }

  // Second pass: find malformed markers (markers that don't match the valid pattern)
  const malformedMatches: Array<{ index: number; length: number; original: string }> = []
  while ((match = malformedMarkerRegex.exec(content)) !== null) {
    // Check if this is NOT a valid marker
    const isValid = validMatches.some(
      (vm) => vm.index === match.index && vm.length === match[0].length
    )
    if (!isValid) {
      malformedMatches.push({
        index: match.index,
        length: match[0].length,
        original: match[0],
      })
    }
  }

  // Combine and sort all markers by index
  const allMarkers = [
    ...validMatches.map((m) => ({ ...m, valid: true as const })),
    ...malformedMatches.map((m) => ({ ...m, valid: false as const })),
  ].sort((a, b) => a.index - b.index)

  // Process markers in order
  for (const marker of allMarkers) {
    // Add text before this match
    if (marker.index > lastIndex) {
      const text = content.substring(lastIndex, marker.index).trim()
      if (text) {
        segments.push({ type: 'text', content: text })
      }
    }

    if (marker.valid) {
      // Valid marker - add as viz or widget
      segments.push({ type: marker.type, content: marker.id })
    } else {
      // Malformed marker - show as invalid reference text
      segments.push({ type: 'text', content: `[Invalid reference: ${marker.original}]` })
    }

    lastIndex = marker.index + marker.length
  }

  // Add remaining text after last match
  if (lastIndex < content.length) {
    const text = content.substring(lastIndex).trim()
    if (text) {
      segments.push({ type: 'text', content: text })
    }
  }

  return segments
}

/**
 * Get component by vizIndex
 */
export function getComponentByVizIndex(
  components: ParsedComponent[],
  vizIndex: number
): ParsedComponent | undefined {
  return components.find((c) => c.vizIndex === vizIndex)
}
