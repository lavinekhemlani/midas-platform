import { FinancialData } from '../types'

/**
 * Calculate Current Ratio
 * Formula: Current Assets / Current Liabilities
 * Measures ability to pay short-term obligations
 * Good ratio: 1.5-2.0
 */
export function calculateCurrentRatio(data: FinancialData): number {
  if (!data.balanceSheet) return 0

  const currentAssets = data.balanceSheet.current_assets || 0
  const currentLiabilities = data.balanceSheet.current_liabilities || 0

  if (currentLiabilities === 0) {
    // If no current liabilities, the company has infinite liquidity
    return currentAssets > 0 ? 999 : 0
  }

  const ratio = currentAssets / currentLiabilities
  return Math.round(ratio * 100) / 100 // 2 decimal places for ratios
}

/**
 * Calculate Quick Ratio (Acid-Test Ratio)
 * Formula: (Current Assets - Inventory) / Current Liabilities
 * More conservative than current ratio as it excludes inventory
 * Good ratio: 1.0 or higher
 */
export function calculateQuickRatio(data: FinancialData): number {
  if (!data.balanceSheet) return 0

  const currentAssets = data.balanceSheet.current_assets || 0
  const inventory = data.balanceSheet.inventory || 0
  const currentLiabilities = data.balanceSheet.current_liabilities || 0

  // Quick assets = Current Assets - Inventory
  const quickAssets = currentAssets - inventory

  if (currentLiabilities === 0) {
    return quickAssets > 0 ? 999 : 0
  }

  const ratio = quickAssets / currentLiabilities
  return Math.round(ratio * 100) / 100
}

/**
 * Calculate Working Capital
 * Formula: Current Assets - Current Liabilities
 * Measures the cushion available for day-to-day operations
 */
export function calculateWorkingCapital(data: FinancialData): number {
  if (!data.balanceSheet) return 0

  const currentAssets = data.balanceSheet.current_assets || 0
  const currentLiabilities = data.balanceSheet.current_liabilities || 0

  const workingCapital = currentAssets - currentLiabilities
  return Math.round(workingCapital * 100) / 100
}

/**
 * Calculate Working Capital Ratio (as a percentage)
 * Formula: (Working Capital / Current Assets) × 100
 * Shows working capital as a percentage of current assets
 */
export function calculateWorkingCapitalRatio(data: FinancialData): number {
  if (!data.balanceSheet) return 0

  const currentAssets = data.balanceSheet.current_assets || 0
  if (currentAssets === 0) return 0

  const workingCapital = calculateWorkingCapital(data)
  const ratio = (workingCapital / currentAssets) * 100
  return Math.round(ratio * 10) / 10 // 1 decimal place for percentages
}

/**
 * Calculate Cash Ratio
 * Formula: Cash and Cash Equivalents / Current Liabilities
 * Most conservative liquidity ratio
 * Good ratio: 0.5 or higher
 */
export function calculateCashRatio(data: FinancialData): number {
  if (!data.balanceSheet) return 0

  const cash = data.balanceSheet.cash_and_equivalents || 0
  const currentLiabilities = data.balanceSheet.current_liabilities || 0

  if (currentLiabilities === 0) {
    return cash > 0 ? 999 : 0
  }

  const ratio = cash / currentLiabilities
  return Math.round(ratio * 100) / 100
}

/**
 * Assess liquidity health based on multiple ratios
 * Returns semantic interpretation of liquidity position
 */
export function assessLiquidityHealth(data: FinancialData): {
  status: 'excellent' | 'good' | 'fair' | 'poor'
  insights: string[]
  ratios: {
    current: number
    quick: number
    cash: number
    workingCapital: number
  }
} {
  const currentRatio = calculateCurrentRatio(data)
  const quickRatio = calculateQuickRatio(data)
  const cashRatio = calculateCashRatio(data)
  const workingCapital = calculateWorkingCapital(data)

  const insights: string[] = []
  let status: 'excellent' | 'good' | 'fair' | 'poor' = 'fair'

  // Assess Current Ratio
  if (currentRatio >= 2.0) {
    insights.push(`Strong current ratio (${currentRatio}) - excellent short-term liquidity`)
    status = 'excellent'
  } else if (currentRatio >= 1.5) {
    insights.push(`Good current ratio (${currentRatio}) - healthy liquidity position`)
    status = 'good'
  } else if (currentRatio >= 1.0) {
    insights.push(`Adequate current ratio (${currentRatio}) - can meet short-term obligations`)
    status = 'fair'
  } else if (currentRatio > 0) {
    insights.push(`Low current ratio (${currentRatio}) - potential liquidity concerns`)
    status = 'poor'
  } else {
    insights.push('No balance sheet data available for liquidity analysis')
    return {
      status: 'poor',
      insights,
      ratios: {
        current: currentRatio,
        quick: quickRatio,
        cash: cashRatio,
        workingCapital
      }
    }
  }

  // Assess Quick Ratio
  if (quickRatio >= 1.0) {
    insights.push(`Solid quick ratio (${quickRatio}) - can cover liabilities without selling inventory`)
  } else if (quickRatio >= 0.7) {
    insights.push(`Fair quick ratio (${quickRatio}) - may need to rely on inventory sales`)
    if (status === 'excellent') status = 'good'
  } else {
    insights.push(`Low quick ratio (${quickRatio}) - heavily dependent on inventory conversion`)
    if (status !== 'poor') status = 'fair'
  }

  // Assess Cash Ratio
  if (cashRatio >= 0.5) {
    insights.push(`Strong cash position (${cashRatio}) - can cover 50%+ of current liabilities with cash`)
  } else if (cashRatio >= 0.2) {
    insights.push(`Moderate cash position (${cashRatio}) - sufficient for immediate needs`)
  } else {
    insights.push(`Low cash ratio (${cashRatio}) - limited immediate liquidity`)
    if (status === 'excellent') status = 'good'
  }

  // Assess Working Capital
  if (workingCapital > 0) {
    const wcMessage = `Positive working capital ($${(workingCapital / 1000).toFixed(1)}k) - cushion for operations`
    insights.push(wcMessage)
  } else if (workingCapital === 0) {
    insights.push('Break-even working capital - tight operational cushion')
    if (status !== 'poor') status = 'fair'
  } else {
    const wcDeficit = Math.abs(workingCapital / 1000).toFixed(1)
    insights.push(`Negative working capital ($${wcDeficit}k deficit) - immediate funding needed`)
    status = 'poor'
  }

  return {
    status,
    insights,
    ratios: {
      current: currentRatio,
      quick: quickRatio,
      cash: cashRatio,
      workingCapital
    }
  }
}