/**
 * @module formatters
 * @description Value formatting utilities for visualization labels and tooltips
 * Provides consistent number formatting across all chart types with performance optimizations
 */

import { formatCompactNumber } from '@/lib/chat/visualizationBlocks'

// Re-export for convenience
export { formatCompactNumber }

/**
 * Get the display symbol for a currency code (e.g. "NGN" → "₦", "USD" → "$")
 */
export function getCurrencySymbol(currencyCode?: string): string {
  if (!currencyCode || currencyCode === 'USD') return '$'
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0)
    return parts.find((p) => p.type === 'currency')?.value || currencyCode
  } catch {
    return currencyCode
  }
}

/**
 * Format a number in compact notation with the correct currency symbol
 */
export function formatCompactCurrency(value: number, currencyCode?: string): string {
  const sym = getCurrencySymbol(currencyCode)
  if (Math.abs(value) >= 1e9) return `${sym}${(value / 1e9).toFixed(1)}B`
  if (Math.abs(value) >= 1e6) return `${sym}${(value / 1e6).toFixed(1)}M`
  if (Math.abs(value) >= 1e3) return `${sym}${(value / 1e3).toFixed(1)}K`
  return `${sym}${value}`
}

/**
 * Cached formatters for performance
 * Reusing Intl.NumberFormat instances is significantly faster than creating new ones
 */
const cachedFormatters = {
  currency: new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }),
  currencyDecimal: new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  number: new Intl.NumberFormat('en-US'),
  percent: new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }),
  compact: new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }),
}

/**
 * Validate that a value is a valid finite number
 *
 * @param value - Value to validate
 * @returns True if value is a valid number
 */
function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value) && !isNaN(value)
}

/**
 * Simple HTML sanitization for tooltip content
 * Prevents XSS attacks by escaping HTML special characters
 *
 * @param text - Text to sanitize
 * @returns Sanitized text safe for HTML display
 */
export function sanitizeForTooltip(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Format a numeric value based on type
 *
 * @param value - Numeric value to format
 * @param currency - Optional currency code (e.g., 'USD')
 * @param format - Format type: 'compact', 'percent', 'currency', or default
 * @returns Formatted string
 */
export function formatValue(value: number, currency?: string, format?: string): string {
  // Validate input
  if (!isValidNumber(value)) {
    return '-'
  }

  if (format === 'compact') {
    if (currency) {
      // Use Intl narrowSymbol to get the correct currency symbol (₦, $, £, etc.)
      const parts = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
      }).formatToParts(0)
      const symbol = parts.find((p) => p.type === 'currency')?.value || '$'
      return `${symbol}${formatCompactNumber(value)}`
    }
    return formatCompactNumber(value)
  }

  if (format === 'percent') {
    // Data is already in percentage form (e.g., 15.5 for 15.5%)
    return `${value.toFixed(1)}%`
  }

  if (currency || format === 'currency') {
    // Use cached formatter for USD, create new one for other currencies
    if (currency && currency !== 'USD') {
      // Compact notation for large values to prevent overflow in KPI cards
      if (Math.abs(value) >= 1e6) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency,
          currencyDisplay: 'narrowSymbol',
          notation: 'compact',
          maximumFractionDigits: 1,
        }).format(value)
      }
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    }
    return cachedFormatters.currency.format(value)
  }

  return cachedFormatters.number.format(value)
}

/**
 * Format cell value for tables based on column format
 *
 * @param value - Cell value (any type)
 * @param format - Format type: 'currency', 'percent', 'number', 'date'
 * @returns Formatted string
 */
export function formatCell(value: unknown, format?: string, currencyCode?: string): string {
  if (value === null || value === undefined) return '-'

  switch (format) {
    case 'currency': {
      const numValue = Number(value)
      if (!isValidNumber(numValue)) return '-'
      if (currencyCode && currencyCode !== 'USD') {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currencyCode,
          currencyDisplay: 'narrowSymbol',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(numValue)
      }
      return cachedFormatters.currencyDecimal.format(numValue)
    }
    case 'percent': {
      const numValue = Number(value)
      if (!isValidNumber(numValue)) return '-'
      return `${numValue.toFixed(1)}%`
    }
    case 'number': {
      const numValue = Number(value)
      if (!isValidNumber(numValue)) return '-'
      return cachedFormatters.number.format(numValue)
    }
    case 'date': {
      try {
        const date = new Date(String(value))
        if (isNaN(date.getTime())) return String(value)
        return date.toLocaleDateString()
      } catch {
        return String(value)
      }
    }
    default:
      return String(value)
  }
}

/**
 * Format axis labels for ECharts (compact notation for large numbers)
 *
 * @param value - Numeric value
 * @returns Compact formatted string
 */
export function formatAxisLabel(value: number): string {
  // Validate input
  if (!isValidNumber(value)) {
    return '0'
  }

  return formatCompactNumber(value)
}
