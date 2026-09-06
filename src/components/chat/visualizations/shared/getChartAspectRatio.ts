export type ChartType =
  | 'line'
  | 'bar'
  | 'pie'
  | 'waterfall'
  | 'sankey'
  | 'treemap'
  | 'scatter'
  | 'radar'
  | 'boxplot'

/**
 * Determines the optimal aspect ratio for a chart based on its type and data characteristics.
 * Returns a CSS aspect-ratio string (e.g., '16/9', '4/3').
 */
export function getChartAspectRatio(
  chartType: ChartType,
  dataPointCount?: number,
  isHorizontal?: boolean
): string {
  // Pie/Donut charts - more square for circular display
  if (chartType === 'pie') {
    return '4/3'
  }

  // Horizontal bar charts - need more height for categories
  if (chartType === 'bar' && isHorizontal) {
    const categoryCount = dataPointCount || 5
    if (categoryCount > 8) return '3/4' // Taller for many categories
    if (categoryCount > 5) return '1/1' // Square
    return '4/3'
  }

  // Line/Area charts - wider for more data points
  if (chartType === 'line') {
    const points = dataPointCount || 6
    if (points > 12) return '2/1' // Very wide for lots of data
    if (points > 6) return '16/9' // Standard widescreen
    return '4/3' // More square for few points
  }

  // Sankey/Treemap - moderate aspect for hierarchical data
  if (chartType === 'sankey' || chartType === 'treemap') {
    return '4/3'
  }

  // Scatter/Radar - more square for better data point visibility
  if (chartType === 'scatter' || chartType === 'radar') {
    return '4/3'
  }

  // Boxplot - moderate width
  if (chartType === 'boxplot') {
    const categories = dataPointCount || 5
    if (categories > 6) return '2/1'
    return '16/9'
  }

  // Default (vertical bar, waterfall, etc.)
  return '16/9'
}
