/**
 * Pure financial calculation utilities
 * Provider-agnostic functions for common financial metrics
 */

/**
 * Calculate Days Sales Outstanding (DSO)
 * Formula: (Accounts Receivable / Daily Revenue)
 */
export function calculateDaysOutstanding(
  outstandingAmount: number,
  dailyAverage: number
): number {
  if (dailyAverage <= 0) return 0
  return Math.round(outstandingAmount / dailyAverage)
}

/**
 * Calculate percentage safely with configurable decimal places
 */
export function calculatePercentage(
  value: number,
  total: number,
  decimals: number = 1
): number {
  if (total === 0) return 0
  const percentage = (value / total) * 100
  return Math.round(percentage * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

/**
 * Calculate gross margin percentage
 * Formula: (Gross Profit / Revenue) * 100
 */
export function calculateGrossMargin(revenue: number, grossProfit: number): number {
  return calculatePercentage(grossProfit, revenue)
}

/**
 * Calculate net profit margin percentage
 * Formula: (Net Income / Revenue) * 100
 */
export function calculateNetMargin(revenue: number, netIncome: number): number {
  return calculatePercentage(netIncome, revenue)
}

/**
 * Calculate operating margin percentage
 * Formula: (Operating Income / Revenue) * 100
 */
export function calculateOperatingMargin(
  revenue: number,
  operatingIncome: number
): number {
  return calculatePercentage(operatingIncome, revenue)
}

/**
 * Calculate current ratio
 * Formula: Current Assets / Current Liabilities
 */
export function calculateCurrentRatio(
  currentAssets: number,
  currentLiabilities: number
): number {
  if (currentLiabilities === 0) return 0
  return currentAssets / currentLiabilities
}

/**
 * Calculate quick ratio (acid test)
 * Formula: (Current Assets - Inventory) / Current Liabilities
 */
export function calculateQuickRatio(
  currentAssets: number,
  inventory: number,
  currentLiabilities: number
): number {
  if (currentLiabilities === 0) return 0
  return (currentAssets - inventory) / currentLiabilities
}

/**
 * Calculate debt-to-equity ratio
 * Formula: Total Debt / Total Equity
 */
export function calculateDebtToEquity(totalDebt: number, totalEquity: number): number {
  if (totalEquity === 0) return 0
  return totalDebt / totalEquity
}

/**
 * Calculate Return on Assets (ROA)
 * Formula: (Net Income / Total Assets) * 100
 */
export function calculateROA(netIncome: number, totalAssets: number): number {
  if (totalAssets === 0) return 0
  return (netIncome / totalAssets) * 100
}

/**
 * Calculate Return on Equity (ROE)
 * Formula: (Net Income / Total Equity) * 100
 */
export function calculateROE(netIncome: number, totalEquity: number): number {
  if (totalEquity === 0) return 0
  return (netIncome / totalEquity) * 100
}

/**
 * Calculate asset turnover ratio
 * Formula: Revenue / Total Assets
 */
export function calculateAssetTurnover(revenue: number, totalAssets: number): number {
  if (totalAssets === 0) return 0
  return revenue / totalAssets
}

/**
 * Calculate working capital
 * Formula: Current Assets - Current Liabilities
 */
export function calculateWorkingCapital(
  currentAssets: number,
  currentLiabilities: number
): number {
  return currentAssets - currentLiabilities
}

/**
 * Calculate gross burn rate (always positive)
 * Formula: Total Monthly Expenses
 * Gross burn rate is the total monthly cash outflow regardless of revenue
 */
export function calculateGrossBurnRate(monthlyExpenses: number): number {
  return Math.abs(monthlyExpenses)
}

/**
 * Calculate net burn rate (negative for cash consumption)
 * Formula: Monthly Expenses - Monthly Revenue
 * Positive result means burning cash, negative means generating cash
 */
export function calculateNetBurnRate(
  monthlyExpenses: number,
  monthlyRevenue: number
): number {
  return monthlyExpenses - monthlyRevenue
}

/**
 * Calculate burn rate (legacy - redirects to gross burn rate)
 * @deprecated Use calculateGrossBurnRate or calculateNetBurnRate instead
 */
export function calculateBurnRate(
  monthlyExpenses: number,
  monthlyRevenue: number
): number {
  // For backward compatibility, return gross burn rate
  return calculateGrossBurnRate(monthlyExpenses)
}

/**
 * Calculate runway in months
 * Formula: Cash Balance / Monthly Gross Burn Rate
 * Uses gross burn rate for a more conservative runway calculation
 */
export function calculateRunway(cashBalance: number, monthlyGrossBurnRate: number): number {
  if (monthlyGrossBurnRate <= 0 || cashBalance <= 0) return 0 // No expenses or no cash
  return cashBalance / monthlyGrossBurnRate
}

/**
 * Calculate cash conversion cycle
 * Formula: Days Inventory Outstanding + Days Sales Outstanding - Days Payable Outstanding
 */
export function calculateCashConversionCycle(
  daysInventory: number,
  daysReceivable: number,
  daysPayable: number
): number {
  return Math.max(0, daysInventory + daysReceivable - daysPayable)
}

/**
 * Calculate free cash flow
 * Formula: Operating Cash Flow - Capital Expenditures
 */
export function calculateFreeCashFlow(
  operatingCashFlow: number,
  capitalExpenditures: number
): number {
  return operatingCashFlow - capitalExpenditures
}

/**
 * Calculate operating cash flow ratio
 * Formula: Operating Cash Flow / Current Liabilities
 */
export function calculateOperatingCashFlowRatio(
  operatingCashFlow: number,
  currentLiabilities: number
): number {
  if (currentLiabilities === 0) return 0
  return operatingCashFlow / currentLiabilities
}

/**
 * Calculate cash flow coverage ratio
 * Formula: Operating Cash Flow / Total Debt
 */
export function calculateCashFlowCoverageRatio(
  operatingCashFlow: number,
  totalDebt: number
): number {
  if (totalDebt === 0) return 0
  return operatingCashFlow / totalDebt
}

/**
 * Calculate operating cash flow margin
 * Formula: (Operating Cash Flow / Revenue) * 100
 */
export function calculateOperatingCashFlowMargin(
  operatingCashFlow: number,
  revenue: number
): number {
  return calculatePercentage(operatingCashFlow, revenue)
}

/**
 * Calculate debt ratio
 * Formula: (Total Debt / Total Assets) * 100
 */
export function calculateDebtRatio(totalDebt: number, totalAssets: number): number {
  return calculatePercentage(totalDebt, totalAssets)
}

/**
 * Calculate equity multiplier
 * Formula: Total Assets / Total Equity
 */
export function calculateEquityMultiplier(
  totalAssets: number,
  totalEquity: number
): number {
  if (totalEquity === 0) return 0
  return totalAssets / totalEquity
}

/**
 * Calculate variance between two values
 */
export function calculateVariance(
  current: number,
  previous: number
): { variance: number; variancePercent: number } {
  const variance = current - previous
  const variancePercent = previous !== 0 ? (variance / previous) * 100 : 0
  return { variance, variancePercent }
}

/**
 * Calculate growth rate between two periods
 */
export function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / Math.abs(previous)) * 100
}
