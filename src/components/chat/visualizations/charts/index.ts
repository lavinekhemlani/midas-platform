/**
 * @module charts
 * @description Barrel export for all chart components
 */

// Router
export { ChartRenderer } from './ChartRenderer'

// Bar charts (BarChart handles all variants: vertical, horizontal, stacked, diverging)
export { BarChart } from './bar'

// Line charts (AreaChart handles both single and stacked multi-series)
export { LineChart, AreaChart } from './line'

// Pie charts
export { PieChart, ScatterChart, RadarChart } from './pie'

// Financial charts
export { WaterfallChart } from './financial'

// Performance charts
export { BoxplotChart } from './performance'

// Advanced charts
export { TreemapChart, SankeyChart } from './advanced'
