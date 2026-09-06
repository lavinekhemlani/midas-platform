// Financial precision - use smaller epsilon
const FINANCIAL_EPSILON = 0.001 // $0.001 tolerance

export const EPSILON = FINANCIAL_EPSILON

/**
 * Parse a monetary amount from QuickBooks
 * QB API can send amounts as strings ("100.00") or numbers (100.00)
 */
export function parseAmount(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0

  // Handle number type directly
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value
  }

  // Handle string type
  if (value === '' || value === '-') return 0
  const cleaned = value.replace(/[$,\s]/g, '')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Apply exchange rate to convert from transaction currency to home currency
 */
export function applyExchangeRate(amount: number, exchangeRate: number | undefined | null): number {
  if (!exchangeRate || exchangeRate === 0) return amount
  return amount * exchangeRate
}

/**
 * Parse multi-currency amounts
 * Returns both transaction amount and home currency amount
 */
export function parseMultiCurrencyAmount(
  amount: string | number | undefined | null,
  homeAmount: string | number | undefined | null,
  exchangeRate: number | undefined | null
): {
  amount: number
  homeAmount: number
  exchangeRate: number | null
} {
  const parsedAmount = parseAmount(amount)
  const parsedHomeAmount =
    homeAmount !== undefined && homeAmount !== null
      ? parseAmount(homeAmount)
      : applyExchangeRate(parsedAmount, exchangeRate)

  return {
    amount: parsedAmount,
    homeAmount: parsedHomeAmount,
    exchangeRate: exchangeRate ?? null,
  }
}

export function amountsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < FINANCIAL_EPSILON
}

export function isEffectivelyZero(value: number | undefined): boolean {
  return value === undefined || Math.abs(value) < EPSILON
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
