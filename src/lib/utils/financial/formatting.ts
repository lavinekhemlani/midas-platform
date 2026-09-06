/**
 * Formatting utilities for financial reports
 * Display formatting for currency, numbers, and percentages
 */

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

/**
 * Format number with commas
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format large numbers with suffixes (K, M, B)
 */
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

/**
 * Round number to specified decimal places
 */
export function roundToDecimal(value: number, decimals: number): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

/**
 * Format ratio (e.g., 1.5:1)
 */
export function formatRatio(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}:1`
}

/**
 * Format days with suffix (e.g., "45 days")
 */
export function formatDays(days: number): string {
  return `${Math.round(days)} ${days === 1 ? 'day' : 'days'}`
}

/**
 * Format months with suffix (e.g., "12 months")
 */
export function formatMonths(months: number): string {
  return `${Math.round(months)} ${months === 1 ? 'month' : 'months'}`
}

/**
 * Format change with + or - sign
 */
export function formatChange(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}`
}

/**
 * Format change percentage with + or - sign and % suffix
 */
export function formatChangePercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Abbreviate text to a maximum length
 */
export function abbreviateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength - 3)}...`
}
