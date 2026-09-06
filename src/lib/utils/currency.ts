// src/lib/utils/currency.ts

/**
 * Currency metadata mapping for common currencies
 * Used to get symbol and format from ISO currency code
 */
export const CURRENCY_MAP: Record<string, { symbol: string; format: string; decimals: number }> = {
  USD: { symbol: '$', format: '$#,##0.00', decimals: 2 },
  CAD: { symbol: '$', format: '$#,##0.00', decimals: 2 },
  GBP: { symbol: '£', format: '£#,##0.00', decimals: 2 },
  EUR: { symbol: '€', format: '€#,##0.00', decimals: 2 },
  AED: { symbol: 'AED', format: 'AED #,##0.00', decimals: 2 },
  AUD: { symbol: '$', format: '$#,##0.00', decimals: 2 },
  INR: { symbol: '₹', format: '₹#,##0.00', decimals: 2 },
  JPY: { symbol: '¥', format: '¥#,##0', decimals: 0 },
  CHF: { symbol: 'CHF', format: 'CHF #,##0.00', decimals: 2 },
  CNY: { symbol: '¥', format: '¥#,##0.00', decimals: 2 },
  HKD: { symbol: '$', format: '$#,##0.00', decimals: 2 },
  SGD: { symbol: '$', format: '$#,##0.00', decimals: 2 },
  NZD: { symbol: '$', format: '$#,##0.00', decimals: 2 },
  MXN: { symbol: '$', format: '$#,##0.00', decimals: 2 },
  BRL: { symbol: '$', format: '$#,##0.00', decimals: 2 },
  ZAR: { symbol: 'R', format: 'R#,##0.00', decimals: 2 },
  SEK: { symbol: 'kr', format: '#,##0.00 kr', decimals: 2 },
  NOK: { symbol: 'kr', format: '#,##0.00 kr', decimals: 2 },
  DKK: { symbol: 'kr', format: '#,##0.00 kr', decimals: 2 },
  PLN: { symbol: 'zł', format: '#,##0.00 zł', decimals: 2 },
  THB: { symbol: '฿', format: '฿#,##0.00', decimals: 2 },
  MYR: { symbol: 'RM', format: 'RM#,##0.00', decimals: 2 },
  PHP: { symbol: '₱', format: '₱#,##0.00', decimals: 2 },
  IDR: { symbol: 'Rp', format: 'Rp#,##0', decimals: 0 },
  KRW: { symbol: '₩', format: '₩#,##0', decimals: 0 },
  TWD: { symbol: '$', format: '$#,##0.00', decimals: 2 },
  SAR: { symbol: 'SAR', format: 'SAR #,##0.00', decimals: 2 },
  QAR: { symbol: 'QAR', format: 'QAR #,##0.00', decimals: 2 },
  KWD: { symbol: 'KWD', format: 'KWD #,##0.000', decimals: 3 },
  BHD: { symbol: 'BHD', format: 'BHD #,##0.000', decimals: 3 },
  OMR: { symbol: 'OMR', format: 'OMR #,##0.000', decimals: 3 },
  NGN: { symbol: '₦', format: '₦#,##0.00', decimals: 2 },
  KES: { symbol: 'Sh', format: 'Sh#,##0.00', decimals: 2 },
  GHS: { symbol: '₵', format: '₵#,##0.00', decimals: 2 },
  TZS: { symbol: 'Sh', format: 'Sh#,##0.00', decimals: 2 },
  UGX: { symbol: 'Sh', format: 'Sh#,##0', decimals: 0 },
  XOF: { symbol: 'CFA', format: 'CFA#,##0', decimals: 0 },
  EGP: { symbol: '£', format: '£#,##0.00', decimals: 2 },
  MAD: { symbol: 'MAD', format: 'MAD #,##0.00', decimals: 2 },
}

/**
 * Full currency names for display purposes
 */
export const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  CAD: 'Canadian Dollar',
  GBP: 'British Pound',
  EUR: 'Euro',
  AED: 'UAE Dirham',
  AUD: 'Australian Dollar',
  INR: 'Indian Rupee',
  JPY: 'Japanese Yen',
  CHF: 'Swiss Franc',
  CNY: 'Chinese Yuan',
  HKD: 'Hong Kong Dollar',
  SGD: 'Singapore Dollar',
  NZD: 'New Zealand Dollar',
  MXN: 'Mexican Peso',
  BRL: 'Brazilian Real',
  ZAR: 'South African Rand',
  SEK: 'Swedish Krona',
  NOK: 'Norwegian Krone',
  DKK: 'Danish Krone',
  PLN: 'Polish Zloty',
  THB: 'Thai Baht',
  MYR: 'Malaysian Ringgit',
  PHP: 'Philippine Peso',
  IDR: 'Indonesian Rupiah',
  KRW: 'South Korean Won',
  TWD: 'Taiwan Dollar',
  SAR: 'Saudi Riyal',
  QAR: 'Qatari Riyal',
  KWD: 'Kuwaiti Dinar',
  BHD: 'Bahraini Dinar',
  OMR: 'Omani Rial',
  NGN: 'Nigerian Naira',
  KES: 'Kenyan Shilling',
  GHS: 'Ghanaian Cedi',
  TZS: 'Tanzanian Shilling',
  UGX: 'Ugandan Shilling',
  XOF: 'West African CFA Franc',
  EGP: 'Egyptian Pound',
  MAD: 'Moroccan Dirham',
}

/**
 * Get the full name of a currency from its ISO code
 */
export function getCurrencyName(code: string): string {
  const upperCode = code?.toUpperCase() || 'USD'
  return CURRENCY_NAMES[upperCode] || upperCode
}

/**
 * Get currency info (symbol, format, decimals) from ISO currency code
 * Returns default values for unknown currencies
 */
export function getCurrencyInfo(code: string): {
  symbol: string
  format: string
  decimals: number
} {
  const upperCode = code?.toUpperCase() || 'USD'
  return (
    CURRENCY_MAP[upperCode] || {
      symbol: upperCode,
      format: `${upperCode} #,##0.00`,
      decimals: 2,
    }
  )
}

interface FormatCurrencyOptions {
  currency?: string
  showSign?: boolean
  compact?: boolean
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

/**
 * Format currency with proper negative number handling and decimal places
 * Ensures negative sign appears immediately before the number
 * Default: Always shows 2 decimal places for consistency
 */
export function formatCurrency(
  value: number | null | undefined,
  options: FormatCurrencyOptions = {}
): string {
  // Handle null/undefined/NaN values
  if (value === null || value === undefined || isNaN(value)) {
    const { currency = 'USD' } = options
    return (currency || 'USD') === 'USD' ? '$0.00' : '0.00'
  }

  const {
    currency: rawCurrency = 'USD',
    showSign = false,
    compact = false,
    minimumFractionDigits = 2, // Changed default to 2 for money fields
    maximumFractionDigits = 2, // Changed default to 2 for money fields
  } = options
  // Guard against empty string which would crash Intl.NumberFormat
  const currency = rawCurrency || 'USD'

  const isNegative = value < 0
  const absValue = Math.abs(value)

  // Use compact notation for large numbers
  const notation = compact && absValue >= 10000 ? 'compact' : 'standard'

  // In compact mode, drop decimals for whole-number values (e.g. $5000 not $5000.00)
  const effectiveMinFrac =
    compact && notation === 'standard' && absValue === Math.round(absValue)
      ? 0
      : minimumFractionDigits
  const effectiveMaxFrac =
    compact && notation === 'standard' && absValue === Math.round(absValue)
      ? 0
      : maximumFractionDigits

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: effectiveMinFrac,
    maximumFractionDigits: effectiveMaxFrac,
    notation,
    compactDisplay: 'short',
  }).format(absValue)

  // Extract currency symbol and number parts
  const parts = formatted.match(/^([^\d.,]+)?(.+)$/)
  if (!parts) return formatted

  const [, currencySymbol = '', numberPart] = parts

  // Use Intl's narrowSymbol — gives "$" for USD, HKD, etc. (concise, avoids redundancy)
  const sym = currencySymbol.trim()

  let result = sym

  if (isNegative) {
    result += '-'
  }

  result += numberPart

  return result
}

/**
 * Format number for statement line items (no currency symbol — symbol shown in column header)
 * Always shows absolute value — negatives are indicated by red text in the UI.
 */
export function formatStatementAmount(
  value: number | null | undefined,
  currency: string = 'USD'
): string {
  if (value === null || value === undefined || isNaN(value)) return '0.00'
  const { decimals } = getCurrencyInfo(currency)
  const absValue = Math.abs(value)
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(absValue)
  return formatted
}

/**
 * Format currency for display in P&L / Balance Sheet / Cash Flow reports.
 * Always shows absolute value — negatives are indicated by red text in the UI,
 * not by a minus sign (standard accounting presentation).
 */
export function formatPnLCurrency(
  value: number | null | undefined,
  currency: string = 'USD'
): string {
  const currencyInfo = getCurrencyInfo(currency)
  return formatCurrency(value != null ? Math.abs(value) : value, {
    currency,
    minimumFractionDigits: currencyInfo.decimals,
    maximumFractionDigits: currencyInfo.decimals,
  })
}

/**
 * Format currency with sign always shown
 */
export function formatCurrencyWithSign(value: number, currency: string = 'USD'): string {
  return formatCurrency(value, { currency, showSign: true })
}

/**
 * Get the narrow currency symbol via Intl (e.g. "$" for both USD and HKD).
 * This is concise and avoids redundancy when the currency is already stated elsewhere.
 */
function getNarrowCurrencySymbol(currency: string): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(0)
  const match = formatted.match(/^([^\d.,]+)/)
  return match ? match[1].trim() : '$'
}

/**
 * Format compact currency (for charts and summaries).
 * Uses 3 decimal places for 1M-10M range for better precision.
 */
export function formatCompactCurrency(value: number, currency: string = 'USD'): string {
  // Guard against empty string which would crash Intl.NumberFormat
  const safeCurrency = currency || 'USD'
  // For values 1M-10M, use 3 decimal places in M notation (e.g. "$6.435M")
  if (value !== null && value !== undefined && !isNaN(value)) {
    const absValue = Math.abs(value)
    if (absValue >= 1_000_000 && absValue < 10_000_000) {
      const symbol = getNarrowCurrencySymbol(safeCurrency)
      const sign = value < 0 ? '-' : ''
      const mVal = (absValue / 1_000_000).toFixed(3)
      return `${symbol}${sign}${mVal}M`
    }
  }

  return formatCurrency(value, { currency: safeCurrency, compact: true })
}

/**
 * Format compact number without currency symbol (e.g. "2.367M", "-450K").
 * Same precision rules as formatCompactCurrency.
 */
export function formatCompactNumber(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return '0'
  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (absValue >= 1_000_000 && absValue < 10_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(3)}M`
  }
  if (absValue >= 10_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(absValue % 1_000_000 === 0 ? 0 : 1)}M`
  }
  if (absValue >= 1_000) {
    return `${sign}${(absValue / 1_000).toFixed(absValue % 1_000 === 0 ? 0 : 1)}K`
  }
  if (absValue === 0) return '0'
  return `${sign}${Math.round(absValue)}`
}

/**
 * Format currency for chart axis labels (compact K/M notation with currency symbol)
 * Returns a function suitable for ECharts axis formatter
 */
export function formatAxisCurrency(currency: string = 'USD'): (value: number) => string {
  const symbol = getNarrowCurrencySymbol(currency)
  return (value: number) => {
    const absValue = Math.abs(value)
    const sign = value < 0 ? '-' : ''
    let num: string
    if (absValue >= 1_000_000) {
      num = `${(absValue / 1_000_000).toFixed(absValue % 1_000_000 === 0 ? 0 : 1)}M`
    } else if (absValue >= 1_000) {
      num = `${Math.round(absValue / 1_000)}K`
    } else if (absValue === 0) {
      num = '0'
    } else {
      num = `${Math.round(absValue)}`
    }
    return `${sign}${symbol}${num}`
  }
}

/**
 * Format compact axis labels without currency symbol (just "10K", "-5M")
 * Use alongside a separate currency indicator near the legend
 */
export function formatAxisCompact(value: number): string {
  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(absValue % 1_000_000 === 0 ? 0 : 1)}M`
  }
  if (absValue >= 1_000) {
    return `${sign}${Math.round(absValue / 1_000)}K`
  }
  if (absValue === 0) {
    return '0'
  }
  return `${sign}${Math.round(absValue)}`
}

// ─── Exchange Rate Utilities ────────────────────────────────

/**
 * Static USD exchange rates (value of 1 unit in USD).
 * These are approximate mid-market rates for cross-currency estimation.
 * Update periodically or replace with a live FX API for production accuracy.
 */
export const USD_EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  CAD: 0.74,
  GBP: 1.27,
  EUR: 1.08,
  AED: 0.27,
  AUD: 0.65,
  INR: 0.012,
  JPY: 0.0067,
  CHF: 1.13,
  CNY: 0.14,
  HKD: 0.13,
  SGD: 0.75,
  NZD: 0.6,
  MXN: 0.058,
  BRL: 0.18,
  ZAR: 0.055,
  SEK: 0.096,
  NOK: 0.093,
  DKK: 0.145,
  PLN: 0.25,
  THB: 0.029,
  MYR: 0.22,
  PHP: 0.018,
  IDR: 0.000063,
  KRW: 0.00074,
  TWD: 0.031,
  SAR: 0.27,
  QAR: 0.27,
  KWD: 3.26,
  BHD: 2.65,
  OMR: 2.6,
  NGN: 0.00065,
  KES: 0.0077,
  GHS: 0.063,
  TZS: 0.00038,
  UGX: 0.00027,
  XOF: 0.0016,
  EGP: 0.02,
  MAD: 0.1,
}

/**
 * Convert a monetary value from one currency to another using static USD rates.
 * Returns null if either currency is not in the exchange rate table.
 */
export function convertCurrency(
  value: number,
  fromCurrency: string,
  toCurrency: string
): number | null {
  if (fromCurrency === toCurrency) return value
  const fromRate = USD_EXCHANGE_RATES[fromCurrency.toUpperCase()]
  const toRate = USD_EXCHANGE_RATES[toCurrency.toUpperCase()]
  if (fromRate == null || toRate == null) return null
  // Convert: value in FROM → USD → TO
  return (value * fromRate) / toRate
}

/**
 * Parse currency string back to number
 */
export function parseCurrencyToNumber(currencyString: string): number {
  // Remove currency symbols, commas, and other non-numeric characters
  const cleanedString = currencyString.replace(/[^0-9.-]/g, '')
  return parseFloat(cleanedString) || 0
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: string): string {
  return getNarrowCurrencySymbol(currency)
}

/**
 * Safe percentage calculation helper with bounds
 * Returns null for invalid calculations (division by zero, infinity, etc.)
 */
export function safePercentage(numerator: number, denominator: number): number | null {
  if (!denominator || denominator === 0 || !isFinite(numerator / denominator)) {
    return null
  }
  return (numerator / denominator) * 100
}

/**
 * Format percentage for display with proper sign handling
 * Shows actual values even for extreme percentages (>1000% or <-1000%)
 */
export function formatPercentage(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || !isFinite(value)) {
    return 'N/A'
  }

  // For extreme values (> 1000% or < -1000%), show with comma formatting
  if (Math.abs(value) >= 1000) {
    const formatted = Math.round(value).toLocaleString('en-US')
    return `${formatted}%`
  }

  return `${value.toFixed(decimals)}%`
}
