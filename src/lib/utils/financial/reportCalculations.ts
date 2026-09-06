/**
 * Pure calculation functions for financial reports
 * These functions are extracted from API routes to enable testing and reusability
 * All functions are pure (no side effects) and return undefined for invalid inputs
 */

/**
 * Calculate profit margin percentage
 * Formula: (Net Income / Revenue) * 100
 *
 * @param netIncome - Net income for the period
 * @param revenue - Total revenue for the period
 * @returns Profit margin as percentage (0-100), or undefined if revenue is zero
 *
 * @example
 * calculateProfitMargin(25000, 100000) // Returns 25
 * calculateProfitMargin(0, 0) // Returns undefined
 */
export function calculateProfitMargin(netIncome: number, revenue: number): number | undefined {
  return revenue > 0 ? (netIncome / revenue) * 100 : undefined
}

/**
 * Calculate gross margin percentage
 * Formula: (Gross Profit / Revenue) * 100
 *
 * @param grossProfit - Total revenue minus cost of goods sold
 * @param revenue - Total revenue for the period
 * @returns Gross margin as percentage (0-100), or undefined if revenue is zero
 *
 * @example
 * calculateGrossMargin(40000, 100000) // Returns 40
 */
export function calculateGrossMargin(grossProfit: number, revenue: number): number | undefined {
  return revenue > 0 ? (grossProfit / revenue) * 100 : undefined
}

/**
 * Calculate operating margin percentage
 * Formula: ((Revenue - COGS - Operating Expenses) / Revenue) * 100
 *
 * @param revenue - Total revenue for the period
 * @param cogs - Cost of goods sold
 * @param operatingExpenses - Operating expenses (excluding COGS and other expenses)
 * @returns Operating margin as percentage (0-100), or undefined if revenue is zero
 *
 * @example
 * calculateOperatingMargin(100000, 30000, 40000) // Returns 30
 */
export function calculateOperatingMargin(
  revenue: number,
  cogs: number,
  operatingExpenses: number
): number | undefined {
  return revenue > 0 ? ((revenue - cogs - operatingExpenses) / revenue) * 100 : undefined
}

/**
 * Calculate expense ratio
 * Formula: (Total Expenses / Revenue) * 100
 *
 * @param totalExpenses - Total expenses for the period
 * @param revenue - Total revenue for the period
 * @returns Expense ratio as percentage (0-100), or undefined if revenue is zero
 *
 * @example
 * calculateExpenseRatio(70000, 100000) // Returns 70
 */
export function calculateExpenseRatio(totalExpenses: number, revenue: number): number | undefined {
  return revenue > 0 ? (totalExpenses / revenue) * 100 : undefined
}

/**
 * Calculate growth rate between current and previous period
 * Returns undefined for special cases (new revenue, both zero)
 *
 * @param current - Current period value
 * @param previous - Previous period value
 * @returns Growth rate as percentage, or undefined for special cases
 *
 * @example
 * calculateGrowthRate(120000, 100000) // Returns 20
 * calculateGrowthRate(100000, 120000) // Returns -16.67
 * calculateGrowthRate(100000, 0) // Returns undefined (new revenue)
 * calculateGrowthRate(0, 0) // Returns 0
 */
export function calculateGrowthRate(
  current: number,
  previous: number | undefined | null
): number | undefined {
  // No previous data
  if (previous === undefined || previous === null) {
    return undefined
  }

  // Previous period had value, calculate growth
  if (previous > 0) {
    return ((current - previous) / previous) * 100
  }

  // Previous was zero, current has value = new revenue (don't show misleading %)
  if (current > 0) {
    return undefined
  }

  // Both zero
  return 0
}

/**
 * Calculate total expenses (COGS + Operating + Other)
 *
 * @param cogs - Cost of goods sold
 * @param operatingExpenses - Operating expenses
 * @param otherExpenses - Other expenses
 * @returns Total of all expense categories
 *
 * @example
 * calculateTotalExpenses(30000, 40000, 5000) // Returns 75000
 */
export function calculateTotalExpenses(
  cogs: number,
  operatingExpenses: number,
  otherExpenses: number
): number {
  return (cogs || 0) + (operatingExpenses || 0) + (otherExpenses || 0)
}

/**
 * Calculate current ratio
 * Formula: Current Assets / Current Liabilities
 *
 * @param currentAssets - Total current assets
 * @param currentLiabilities - Total current liabilities
 * @returns Current ratio, or 0 if liabilities are zero
 *
 * @example
 * calculateCurrentRatio(200000, 100000) // Returns 2
 */
export function calculateCurrentRatio(currentAssets: number, currentLiabilities: number): number {
  const absLiabilities = Math.abs(currentLiabilities)
  return absLiabilities > 0 ? currentAssets / absLiabilities : 0
}

/**
 * Calculate quick ratio (acid test)
 * Formula: (Current Assets - Inventory) / Current Liabilities
 *
 * @param currentAssets - Total current assets
 * @param inventory - Inventory value
 * @param currentLiabilities - Total current liabilities
 * @returns Quick ratio, or 0 if liabilities are zero
 *
 * @example
 * calculateQuickRatio(200000, 50000, 100000) // Returns 1.5
 */
export function calculateQuickRatio(
  currentAssets: number,
  inventory: number,
  currentLiabilities: number
): number {
  const absLiabilities = Math.abs(currentLiabilities)
  return absLiabilities > 0 ? (currentAssets - inventory) / absLiabilities : 0
}

/**
 * Calculate debt to equity ratio
 * Formula: Total Liabilities / Total Equity
 *
 * @param totalLiabilities - Total liabilities
 * @param totalEquity - Total equity
 * @returns Debt to equity ratio, or 0 if equity is zero
 *
 * @example
 * calculateDebtToEquity(150000, 300000) // Returns 0.5
 */
export function calculateDebtToEquity(totalLiabilities: number, totalEquity: number): number {
  return totalEquity !== 0 ? totalLiabilities / totalEquity : 0
}

/**
 * Calculate return on assets (ROA)
 * Formula: (Net Income / Total Assets) * 100
 *
 * @param netIncome - Net income for the period
 * @param totalAssets - Total assets
 * @returns ROA as percentage, or 0 if assets are zero
 *
 * @example
 * calculateROA(50000, 500000) // Returns 10
 */
export function calculateROA(netIncome: number, totalAssets: number): number {
  return totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0
}

/**
 * Calculate return on equity (ROE)
 * Formula: (Net Income / Total Equity) * 100
 *
 * @param netIncome - Net income for the period
 * @param totalEquity - Total equity
 * @returns ROE as percentage, or 0 if equity is zero
 *
 * @example
 * calculateROE(50000, 300000) // Returns 16.67
 */
export function calculateROE(netIncome: number, totalEquity: number): number {
  return totalEquity !== 0 ? (netIncome / totalEquity) * 100 : 0
}

/**
 * Calculate working capital
 * Formula: Current Assets - Current Liabilities
 *
 * @param currentAssets - Total current assets
 * @param currentLiabilities - Total current liabilities
 * @returns Working capital amount
 *
 * @example
 * calculateWorkingCapital(200000, 100000) // Returns 100000
 */
export function calculateWorkingCapital(currentAssets: number, currentLiabilities: number): number {
  return currentAssets - currentLiabilities
}

/**
 * Calculate burn rate (monthly)
 *
 * @param totalExpenses - Total expenses for the period
 * @param periodMonths - Number of months in the period
 * @returns Monthly burn rate
 *
 * @example
 * calculateBurnRate(300000, 3) // Returns 100000
 */
export function calculateBurnRate(totalExpenses: number, periodMonths: number): number {
  return periodMonths > 0 ? totalExpenses / periodMonths : 0
}

/**
 * Calculate runway in months
 *
 * @param cashBalance - Current cash balance
 * @param monthlyBurnRate - Monthly burn rate
 * @returns Number of months until cash runs out, capped at 999
 *
 * @example
 * calculateRunway(500000, 50000) // Returns 10
 * calculateRunway(1000000, 0) // Returns 999
 */
export function calculateRunway(cashBalance: number, monthlyBurnRate: number): number {
  if (monthlyBurnRate === 0) return 999
  return Math.min(cashBalance / Math.abs(monthlyBurnRate), 999)
}

/**
 * Calculate days cash on hand
 *
 * @param cashBalance - Current cash balance
 * @param monthlyExpenses - Monthly expenses
 * @returns Number of days cash will last, capped at 999
 *
 * @example
 * calculateDaysCash(150000, 30000) // Returns 150
 */
export function calculateDaysCash(cashBalance: number, monthlyExpenses: number): number {
  if (monthlyExpenses === 0) return 999
  return Math.min(Math.round((cashBalance / monthlyExpenses) * 30), 999)
}

/**
 * Calculate operating cash flow ratio
 * Formula: Operating Cash Flow / Current Liabilities
 *
 * @param operatingCashFlow - Cash flow from operating activities
 * @param currentLiabilities - Total current liabilities
 * @returns Operating cash flow ratio
 *
 * @example
 * calculateOperatingCashFlowRatio(80000, 100000) // Returns 0.8
 */
export function calculateOperatingCashFlowRatio(
  operatingCashFlow: number,
  currentLiabilities: number
): number {
  return currentLiabilities > 0 ? operatingCashFlow / currentLiabilities : 0
}

/**
 * Calculate free cash flow
 * Formula: Operating Cash Flow - Capital Expenditures
 *
 * @param operatingCashFlow - Cash flow from operating activities
 * @param capitalExpenditures - Capital expenditures
 * @returns Free cash flow
 *
 * @example
 * calculateFreeCashFlow(100000, 20000) // Returns 80000
 */
export function calculateFreeCashFlow(
  operatingCashFlow: number,
  capitalExpenditures: number
): number {
  return operatingCashFlow - capitalExpenditures
}

/**
 * Calculate cash conversion cycle
 * Formula: Days Receivable + Days Inventory - Days Payable
 *
 * @param daysReceivable - Days sales outstanding
 * @param daysInventory - Days inventory outstanding
 * @param daysPayable - Days payable outstanding
 * @returns Cash conversion cycle in days (minimum 0)
 *
 * @example
 * calculateCashConversionCycle(45, 30, 30) // Returns 45
 */
export function calculateCashConversionCycle(
  daysReceivable: number,
  daysInventory: number,
  daysPayable: number
): number {
  return Math.max(0, daysReceivable + daysInventory - daysPayable)
}

/**
 * Calculate operating cash flow margin
 * Formula: (Operating Cash Flow / Revenue) * 100
 *
 * @param operatingCashFlow - Cash flow from operating activities
 * @param revenue - Total revenue
 * @returns Operating cash flow margin as percentage, or undefined if revenue is zero
 *
 * @example
 * calculateOperatingCashFlowMargin(80000, 500000) // Returns 16
 */
export function calculateOperatingCashFlowMargin(
  operatingCashFlow: number,
  revenue: number
): number | undefined {
  return revenue > 0 ? (operatingCashFlow / revenue) * 100 : undefined
}

/**
 * Calculate cash flow coverage ratio
 * Formula: Operating Cash Flow / Total Debt
 *
 * @param operatingCashFlow - Cash flow from operating activities
 * @param totalDebt - Total debt
 * @returns Cash flow coverage ratio, or undefined if debt is zero
 *
 * @example
 * calculateCashFlowCoverageRatio(100000, 200000) // Returns 0.5
 */
export function calculateCashFlowCoverageRatio(
  operatingCashFlow: number,
  totalDebt: number
): number | undefined {
  return totalDebt > 0 ? operatingCashFlow / totalDebt : undefined
}

/**
 * Calculate asset turnover ratio
 * Formula: Revenue / Total Assets
 *
 * @param revenue - Total revenue
 * @param totalAssets - Total assets
 * @returns Asset turnover ratio
 *
 * @example
 * calculateAssetTurnover(1000000, 500000) // Returns 2
 */
export function calculateAssetTurnover(revenue: number, totalAssets: number): number {
  return totalAssets > 0 ? revenue / totalAssets : 0
}

/**
 * Calculate equity multiplier
 * Formula: Total Assets / Total Equity
 *
 * @param totalAssets - Total assets
 * @param totalEquity - Total equity
 * @returns Equity multiplier
 *
 * @example
 * calculateEquityMultiplier(500000, 300000) // Returns 1.67
 */
export function calculateEquityMultiplier(totalAssets: number, totalEquity: number): number {
  return totalEquity !== 0 ? totalAssets / totalEquity : 0
}

/**
 * Calculate debt ratio
 * Formula: (Total Liabilities / Total Assets) * 100
 *
 * @param totalLiabilities - Total liabilities
 * @param totalAssets - Total assets
 * @returns Debt ratio as percentage
 *
 * @example
 * calculateDebtRatio(200000, 500000) // Returns 40
 */
export function calculateDebtRatio(totalLiabilities: number, totalAssets: number): number {
  return totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0
}

/**
 * Truncate a number to exactly 2 decimal places without rounding
 * This ensures consistent display of amounts across the application
 *
 * @param value - The number to truncate
 * @returns Number truncated to 2 decimal places
 *
 * @example
 * toTwoDecimals(123.456) // Returns 123.45
 * toTwoDecimals(123.999) // Returns 123.99 (not 124.00)
 * toTwoDecimals(-45.678) // Returns -45.67
 * toTwoDecimals(100) // Returns 100.00
 */
export function toTwoDecimals(value: number): number {
  if (!isFinite(value)) return 0
  return Math.trunc(value * 100) / 100
}

/**
 * Truncate a number to specified decimal places without rounding
 *
 * @param value - The number to truncate
 * @param decimals - Number of decimal places (default: 2)
 * @returns Number truncated to specified decimal places
 *
 * @example
 * truncateDecimals(123.456, 2) // Returns 123.45
 * truncateDecimals(123.456, 1) // Returns 123.4
 * truncateDecimals(99.999, 2) // Returns 99.99
 */
export function truncateDecimals(value: number, decimals: number = 2): number {
  if (!isFinite(value)) return 0
  const multiplier = Math.pow(10, decimals)
  return Math.trunc(value * multiplier) / multiplier
}

/**
 * Format a percentage value for display
 * IMPORTANT: Expects value as whole number (15.5 for 15.5%), NOT decimal (0.155)
 * This matches how all backend calculations return percentages.
 *
 * @param value - Percentage as whole number (e.g., 15.5 for 15.5%)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string like "15.5%"
 *
 * @example
 * formatPercentValue(15.5) // Returns "15.5%"
 * formatPercentValue(15.567, 2) // Returns "15.56%"
 * formatPercentValue(Infinity) // Returns "0.0%"
 */
export function formatPercentValue(value: number, decimals: number = 1): string {
  if (!isFinite(value)) return '0.0%'
  return `${truncateDecimals(value, decimals).toFixed(decimals)}%`
}

/**
 * Truncate a percentage to specified decimal places without rounding
 * Use this before displaying percentages to ensure consistent precision.
 *
 * @param value - Percentage as whole number
 * @param decimals - Number of decimal places (default: 1)
 * @returns Truncated percentage value
 *
 * @example
 * truncatePercent(15.567, 1) // Returns 15.5
 * truncatePercent(99.999, 2) // Returns 99.99
 * truncatePercent(Infinity) // Returns 0
 */
export function truncatePercent(value: number, decimals: number = 1): number {
  if (!isFinite(value)) return 0
  const multiplier = Math.pow(10, decimals)
  return Math.trunc(value * multiplier) / multiplier
}
