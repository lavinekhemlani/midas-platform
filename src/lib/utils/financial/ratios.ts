/**
 * Canonical Liquidity Ratio Calculations
 *
 * This is the single source of truth for all liquidity ratio calculations.
 * All other files should import from here to ensure consistency.
 *
 * Edge Case Handling:
 * - Division by zero: Returns Infinity when liabilities=0 and assets>0
 * - Both zero: Returns 0
 * - Invalid inputs (NaN, undefined): Returns 0
 * - Negative liabilities: Uses absolute value
 */

/**
 * Sentinel value representing infinite liquidity (no current liabilities)
 * UI components should use formatRatio() to display this as "∞"
 */
export const INFINITE_RATIO = Infinity

/**
 * Calculate Current Ratio
 * Formula: Current Assets / Current Liabilities
 *
 * Measures ability to pay short-term obligations with current assets.
 * Good ratio: 1.5-2.0
 *
 * @param currentAssets - Total current assets
 * @param currentLiabilities - Total current liabilities
 * @returns Current ratio, or Infinity if no liabilities but has assets
 */
export function calculateCurrentRatio(currentAssets: number, currentLiabilities: number): number {
  // Handle invalid inputs
  if (!isFinite(currentAssets) || currentAssets == null) return 0
  if (!isFinite(currentLiabilities) || currentLiabilities == null) return 0

  // Handle zero liabilities - infinite liquidity scenario
  const absLiabilities = Math.abs(currentLiabilities)
  if (absLiabilities === 0) {
    return currentAssets > 0 ? INFINITE_RATIO : 0
  }

  return currentAssets / absLiabilities
}

/**
 * Calculate Quick Ratio (Acid-Test Ratio)
 * Formula: (Cash + Receivables) / Current Liabilities
 *
 * More conservative than current ratio - only considers most liquid assets.
 * This is the standardized formula across the application.
 * Good ratio: 1.0 or higher
 *
 * @param cash - Cash and cash equivalents
 * @param receivables - Accounts receivable
 * @param currentLiabilities - Total current liabilities
 * @returns Quick ratio, or Infinity if no liabilities but has liquid assets
 */
export function calculateQuickRatio(
  cash: number,
  receivables: number,
  currentLiabilities: number
): number {
  // Handle invalid inputs with safe defaults
  const safeCash = isFinite(cash) && cash != null ? cash : 0
  const safeReceivables = isFinite(receivables) && receivables != null ? receivables : 0
  const quickAssets = safeCash + safeReceivables

  // Handle invalid liabilities
  if (!isFinite(currentLiabilities) || currentLiabilities == null) return 0

  // Handle zero liabilities - infinite liquidity scenario
  const absLiabilities = Math.abs(currentLiabilities)
  if (absLiabilities === 0) {
    return quickAssets > 0 ? INFINITE_RATIO : 0
  }

  // Guard against negative quick assets (shouldn't happen but handle gracefully)
  if (quickAssets < 0) return 0

  return quickAssets / absLiabilities
}

/**
 * Legacy Quick Ratio calculation using (Assets - Inventory) formula
 * @deprecated Use calculateQuickRatio(cash, receivables, liabilities) instead
 *
 * This function is kept for backwards compatibility during migration.
 * It will be removed in a future version.
 *
 * @param currentAssets - Total current assets
 * @param inventory - Inventory value
 * @param currentLiabilities - Total current liabilities
 * @returns Quick ratio using legacy formula
 */
export function calculateQuickRatioLegacy(
  currentAssets: number,
  inventory: number,
  currentLiabilities: number
): number {
  // Handle invalid inputs
  if (!isFinite(currentAssets) || currentAssets == null) return 0
  if (!isFinite(currentLiabilities) || currentLiabilities == null) return 0

  const safeInventory = isFinite(inventory) && inventory != null ? inventory : 0
  const quickAssets = currentAssets - safeInventory

  // Handle zero liabilities
  const absLiabilities = Math.abs(currentLiabilities)
  if (absLiabilities === 0) {
    return quickAssets > 0 ? INFINITE_RATIO : 0
  }

  // Guard against negative quick assets
  if (quickAssets < 0) return 0

  return quickAssets / absLiabilities
}

/**
 * Calculate Working Capital
 * Formula: Current Assets - Current Liabilities
 *
 * Measures the cushion available for day-to-day operations.
 *
 * @param currentAssets - Total current assets
 * @param currentLiabilities - Total current liabilities
 * @returns Working capital amount (can be negative)
 */
export function calculateWorkingCapital(currentAssets: number, currentLiabilities: number): number {
  const safeAssets = isFinite(currentAssets) && currentAssets != null ? currentAssets : 0
  const safeLiabilities =
    isFinite(currentLiabilities) && currentLiabilities != null ? currentLiabilities : 0
  return safeAssets - safeLiabilities
}

/**
 * Format a ratio value for display
 *
 * @param value - The ratio value to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string: "∞" for infinite, "N/A" for invalid, or numeric string
 */
export function formatRatio(value: number, decimals: number = 2): string {
  // Handle infinite liquidity
  if (value === INFINITE_RATIO || value >= 999) {
    return '∞'
  }

  // Handle invalid values
  if (!isFinite(value) || value == null) {
    return 'N/A'
  }

  return value.toFixed(decimals)
}

/**
 * Check if a ratio represents infinite liquidity
 *
 * @param value - The ratio value to check
 * @returns true if the ratio represents infinite liquidity
 */
export function isInfiniteRatio(value: number): boolean {
  return value === INFINITE_RATIO || value >= 999
}

/**
 * Assess current ratio health status
 *
 * @param currentRatio - The current ratio value
 * @returns Status string: 'excellent', 'good', 'adequate', 'poor', or 'critical'
 */
export function assessCurrentRatioHealth(
  currentRatio: number
): 'excellent' | 'good' | 'adequate' | 'poor' | 'critical' {
  if (isInfiniteRatio(currentRatio)) return 'excellent'
  if (currentRatio >= 2.0) return 'excellent'
  if (currentRatio >= 1.5) return 'good'
  if (currentRatio >= 1.0) return 'adequate'
  if (currentRatio >= 0.5) return 'poor'
  return 'critical'
}

/**
 * Assess quick ratio health status
 *
 * @param quickRatio - The quick ratio value
 * @returns Status string: 'excellent', 'good', 'adequate', 'poor', or 'critical'
 */
export function assessQuickRatioHealth(
  quickRatio: number
): 'excellent' | 'good' | 'adequate' | 'poor' | 'critical' {
  if (isInfiniteRatio(quickRatio)) return 'excellent'
  if (quickRatio >= 1.5) return 'excellent'
  if (quickRatio >= 1.0) return 'good'
  if (quickRatio >= 0.7) return 'adequate'
  if (quickRatio >= 0.5) return 'poor'
  return 'critical'
}
