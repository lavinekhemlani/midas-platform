/**
 * @module shared
 * @description Shared utilities for dashboard charts (ECharts)
 */

// Re-export from visualization shared
export {
  ReactECharts,
  ChartLoadingSkeleton,
  useThemeEChartsConfig,
  COLORS,
  formatCompactNumber,
  formatAxisLabel,
  getTitleConfig,
  getLegendConfig,
  canvasHighDpiOpts,
  svgOpts,
  getHighQualityOpts,
} from '@/components/chat/visualizations/shared'

export { ResponsiveChartContainer } from '@/components/chat/visualizations/shared/ResponsiveChartContainer'
export { getChartAspectRatio } from '@/components/chat/visualizations/shared/getChartAspectRatio'

// Dashboard-specific gradient colors
export const DASHBOARD_GRADIENTS = {
  inflow: ['rgba(16, 185, 129, 0.4)', 'rgba(16, 185, 129, 0.05)'],
  outflow: ['rgba(239, 68, 68, 0.4)', 'rgba(239, 68, 68, 0.05)'],
  revenue: ['rgba(16, 185, 129, 0.3)', 'rgba(16, 185, 129, 0.05)'],
  expenses: ['rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0.05)'],
  profit: ['rgba(245, 158, 11, 0.3)', 'rgba(245, 158, 11, 0.05)'],
  net: ['rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0.05)'],
}

// Dashboard line colors
export const DASHBOARD_COLORS = {
  inflow: '#10b981',
  outflow: '#ef4444',
  net: '#3b82f6',
  revenue: '#10b981',
  expenses: '#ef4444',
  profit: '#f59e0b',
}

/**
 * Create an ECharts linear gradient for area fill
 */
export function createGradient(colors: string[]) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: colors[0] },
      { offset: 1, color: colors[1] },
    ],
  }
}

/**
 * Format currency for tooltips
 * Rounds to 2 decimal places to avoid floating point precision issues
 */
export function formatCurrencyValue(value: number, currency: string = 'USD'): string {
  // Round to 2 decimal places to fix floating point precision issues
  const roundedValue = Math.round(value * 100) / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(roundedValue)
}

/**
 * Format currency with compact notation for large values
 * Rounds to 2 decimal places to avoid floating point precision issues
 */
export function formatCompactCurrency(value: number, currency: string = 'USD'): string {
  // Round to 2 decimal places to fix floating point precision issues
  const roundedValue = Math.round(value * 100) / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    notation: Math.abs(roundedValue) >= 10000 ? 'compact' : 'standard',
    compactDisplay: 'short',
  }).format(roundedValue)
}

/**
 * Format currency for Y-axis labels with compact notation (K/M)
 * Always uses compact notation for cleaner axis display
 */
export function formatAxisCurrency(value: number, currency: string = 'USD'): string {
  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (absValue >= 1_000_000) {
    return `${sign}$${(absValue / 1_000_000).toFixed(absValue % 1_000_000 === 0 ? 0 : 1)}M`
  }
  if (absValue >= 1_000) {
    return `${sign}$${(absValue / 1_000).toFixed(absValue % 1_000 === 0 ? 0 : 0)}K`
  }
  if (absValue === 0) {
    return '$0'
  }
  return `${sign}$${absValue.toFixed(0)}`
}

/**
 * Format date for chart labels
 */
export function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}
