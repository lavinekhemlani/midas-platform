// src/lib/pdf/formatUtils.ts
/**
 * Safe formatting utilities for PDF export
 * Handles edge cases like invalid currency codes and division by zero
 */

/**
 * Safely format a number as currency.
 * Falls back to USD formatting with $ prefix if currency code is invalid.
 * @param value - The numeric value to format
 * @param currency - ISO 4217 currency code (e.g., 'USD', 'EUR', 'NGN')
 * @returns Formatted currency string
 */
export function safeFormatCurrency(value: number, currency: string = 'USD'): string {
  // Handle non-finite numbers
  if (!Number.isFinite(value)) {
    return '$0.00'
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    // Fallback for invalid currency codes
    return `$${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
}

/**
 * Safely format currency with compact notation (K, M, B).
 * Falls back to USD formatting if currency code is invalid.
 * @param value - The numeric value to format
 * @param currency - ISO 4217 currency code
 * @returns Formatted compact currency string
 */
export function safeFormatCurrencyCompact(value: number, currency: string = 'USD'): string {
  // Handle non-finite numbers
  if (!Number.isFinite(value)) {
    return '$0'
  }

  const absValue = Math.abs(value)

  try {
    if (absValue >= 1_000_000_000) {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }).format(value / 1_000_000_000)
      return formatted.replace(/[\d,.]+/, (m) => m + 'B')
    }
    if (absValue >= 1_000_000) {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }).format(value / 1_000_000)
      return formatted.replace(/[\d,.]+/, (m) => m + 'M')
    }
    if (absValue >= 1_000) {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value / 1_000)
      return formatted.replace(/[\d,.]+/, (m) => m + 'K')
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    // Fallback for invalid currency codes
    if (absValue >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(1)}B`
    }
    if (absValue >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`
    }
    if (absValue >= 1_000) {
      return `$${(value / 1_000).toFixed(0)}K`
    }
    return `$${value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`
  }
}

/**
 * Safe number formatting with fallback for edge cases.
 * @param value - The numeric value to format
 * @returns Formatted number string
 */
export function safeFormatNumber(value: number): string {
  // Handle non-finite numbers
  if (!Number.isFinite(value)) {
    return '0'
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 10,
  }).format(value)
}

/**
 * Safe number formatting with compact notation (K, M, B).
 * @param value - The numeric value to format
 * @returns Formatted compact number string
 */
export function safeFormatNumberCompact(value: number): string {
  // Handle non-finite numbers
  if (!Number.isFinite(value)) {
    return '0'
  }

  const absValue = Math.abs(value)

  if (absValue >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`
  }
  if (absValue >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (absValue >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Ensure chart Y-axis range is valid (no division by zero).
 * When all values are identical, adds padding to create a valid range.
 * @param minY - Minimum Y value
 * @param maxY - Maximum Y value
 * @returns Adjusted [minY, maxY] tuple with valid range
 */
export function ensureValidChartRange(minY: number, maxY: number): [number, number] {
  const range = maxY - minY

  // Handle identical min/max (division by zero scenario)
  if (range === 0) {
    // If both are 0, use a standard range
    if (maxY === 0) {
      return [-1, 1]
    }
    // Otherwise, add 10% padding around the value
    const padding = Math.abs(maxY) * 0.1 || 1
    return [minY - padding, maxY + padding]
  }

  return [minY, maxY]
}
