import { FinancialData } from '../types'
import { calculateNetIncome } from './profitability'
import { calculateRevenue } from './revenue'

/**
 * Calculate Total Assets
 * Direct from balance sheet
 */
export function calculateTotalAssets(data: FinancialData): number {
  if (!data.balanceSheet) return 0
  return Math.round((data.balanceSheet.total_assets || 0) * 100) / 100
}

/**
 * Calculate Total Liabilities
 * Direct from balance sheet
 */
export function calculateTotalLiabilities(data: FinancialData): number {
  if (!data.balanceSheet) return 0
  return Math.round((data.balanceSheet.total_liabilities || 0) * 100) / 100
}

/**
 * Calculate Total Equity
 * Direct from balance sheet or calculated as Assets - Liabilities
 */
export function calculateTotalEquity(data: FinancialData): number {
  if (!data.balanceSheet) return 0

  // Use reported equity if available
  if (data.balanceSheet.total_equity !== undefined) {
    return Math.round(data.balanceSheet.total_equity * 100) / 100
  }

  // Otherwise calculate: Assets - Liabilities = Equity
  const assets = data.balanceSheet.total_assets || 0
  const liabilities = data.balanceSheet.total_liabilities || 0
  const equity = assets - liabilities

  return Math.round(equity * 100) / 100
}

/**
 * Calculate Debt-to-Equity Ratio
 * Formula: Total Liabilities / Total Equity
 * Measures financial leverage and risk
 * Lower is generally safer - typical target: < 2.0
 */
export function calculateDebtToEquity(data: FinancialData): number {
  if (!data.balanceSheet) return 0

  const equity = calculateTotalEquity(data)
  if (equity <= 0) return 999 // Infinite or negative equity

  const liabilities = calculateTotalLiabilities(data)
  const ratio = liabilities / equity

  return Math.round(ratio * 100) / 100
}

/**
 * Calculate Return on Assets (ROA)
 * Formula: (Net Income / Total Assets) × 100
 * Measures how efficiently company uses assets to generate profit
 * Higher is better - typical target: > 5%
 */
export function calculateROA(data: FinancialData): number {
  if (!data.balanceSheet?.total_assets || data.balanceSheet.total_assets === 0) {
    return 0
  }

  const netIncome = calculateNetIncome(data)
  const assets = data.balanceSheet.total_assets

  // Annualize net income if needed
  const annualizedNetIncome = netIncome * (12 / (data.period?.months || 12))

  const roa = (annualizedNetIncome / assets) * 100
  return Math.round(roa * 10) / 10 // 1 decimal place for percentages
}

/**
 * Calculate Return on Equity (ROE)
 * Formula: (Net Income / Total Equity) × 100
 * Measures return generated on shareholders' equity
 * Higher is better - typical target: > 15%
 */
export function calculateROE(data: FinancialData): number {
  const equity = calculateTotalEquity(data)
  if (equity <= 0) return 0 // Can't calculate with negative or zero equity

  const netIncome = calculateNetIncome(data)

  // Annualize net income if needed
  const annualizedNetIncome = netIncome * (12 / (data.period?.months || 12))

  const roe = (annualizedNetIncome / equity) * 100
  return Math.round(roe * 10) / 10 // 1 decimal place for percentages
}

/**
 * Calculate Debt Ratio
 * Formula: Total Liabilities / Total Assets
 * Measures percentage of assets financed by debt
 * Lower is safer - typical target: < 0.6 (60%)
 */
export function calculateDebtRatio(data: FinancialData): number {
  if (!data.balanceSheet?.total_assets || data.balanceSheet.total_assets === 0) {
    return 0
  }

  const liabilities = calculateTotalLiabilities(data)
  const assets = data.balanceSheet.total_assets

  const ratio = (liabilities / assets) * 100
  return Math.round(ratio * 10) / 10 // 1 decimal place for percentages
}

/**
 * Calculate Equity Ratio
 * Formula: Total Equity / Total Assets
 * Measures percentage of assets financed by equity
 * Higher is safer - typical target: > 0.4 (40%)
 */
export function calculateEquityRatio(data: FinancialData): number {
  if (!data.balanceSheet?.total_assets || data.balanceSheet.total_assets === 0) {
    return 0
  }

  const equity = calculateTotalEquity(data)
  const assets = data.balanceSheet.total_assets

  const ratio = (equity / assets) * 100
  return Math.round(ratio * 10) / 10 // 1 decimal place for percentages
}

/**
 * Calculate Long-term Debt to Total Assets
 * Formula: Long-term Debt / Total Assets
 * Measures long-term financial obligations relative to assets
 */
export function calculateLongTermDebtToAssets(data: FinancialData): number {
  if (!data.balanceSheet?.total_assets || data.balanceSheet.total_assets === 0) {
    return 0
  }

  const longTermDebt = data.balanceSheet.long_term_debt || 0
  const assets = data.balanceSheet.total_assets

  const ratio = (longTermDebt / assets) * 100
  return Math.round(ratio * 10) / 10 // 1 decimal place for percentages
}

/**
 * Calculate Asset Turnover Ratio
 * Formula: Revenue / Average Total Assets
 * Measures efficiency of asset usage to generate revenue
 * Higher is better - typical target: > 1.0
 */
export function calculateAssetTurnover(data: FinancialData): number {
  if (!data.balanceSheet?.total_assets || data.balanceSheet.total_assets === 0) {
    return 0
  }

  const revenue = calculateRevenue(data)
  const assets = data.balanceSheet.total_assets

  // Annualize revenue if needed
  const annualizedRevenue = revenue * (12 / (data.period?.months || 12))

  const turnover = annualizedRevenue / assets
  return Math.round(turnover * 100) / 100 // 2 decimal places for ratio
}

/**
 * Calculate Equity Multiplier
 * Formula: Total Assets / Total Equity
 * Measures financial leverage (DuPont component)
 * Lower is more conservative - typical range: 1.5 to 3.0
 */
export function calculateEquityMultiplier(data: FinancialData): number {
  const equity = calculateTotalEquity(data)
  if (equity <= 0) return 999 // Infinite or negative equity

  const assets = calculateTotalAssets(data)
  if (assets === 0) return 0

  const multiplier = assets / equity
  return Math.round(multiplier * 100) / 100 // 2 decimal places for ratio
}

/**
 * Assess balance sheet health and financial structure
 * Returns semantic interpretation of balance sheet metrics
 */
export function assessBalanceSheetHealth(data: FinancialData): {
  status: 'strong' | 'stable' | 'leveraged' | 'risky'
  insights: string[]
  metrics: {
    assets: number
    liabilities: number
    equity: number
    debtToEquity: number
    roa: number
    roe: number
  }
} {
  const assets = calculateTotalAssets(data)
  const liabilities = calculateTotalLiabilities(data)
  const equity = calculateTotalEquity(data)
  const debtToEquity = calculateDebtToEquity(data)
  const roa = calculateROA(data)
  const roe = calculateROE(data)
  const debtRatio = calculateDebtRatio(data)
  const equityRatio = calculateEquityRatio(data)

  const insights: string[] = []
  let status: 'strong' | 'stable' | 'leveraged' | 'risky' = 'stable'

  if (!data.balanceSheet || assets === 0) {
    return {
      status: 'risky',
      insights: ['No balance sheet data available for analysis'],
      metrics: { assets, liabilities, equity, debtToEquity, roa, roe }
    }
  }

  // Assess leverage (Debt-to-Equity)
  if (debtToEquity <= 0.5) {
    insights.push(`Very low leverage (D/E: ${debtToEquity}) - conservative capital structure`)
    status = 'strong'
  } else if (debtToEquity <= 1.0) {
    insights.push(`Moderate leverage (D/E: ${debtToEquity}) - balanced capital structure`)
    status = 'stable'
  } else if (debtToEquity <= 2.0) {
    insights.push(`High leverage (D/E: ${debtToEquity}) - aggressive use of debt`)
    status = 'leveraged'
  } else {
    insights.push(`Very high leverage (D/E: ${debtToEquity}) - significant financial risk`)
    status = 'risky'
  }

  // Assess equity position
  if (equity < 0) {
    insights.push('Negative equity - liabilities exceed assets (technically insolvent)')
    status = 'risky'
  } else if (equityRatio >= 50) {
    insights.push(`Strong equity position (${equityRatio.toFixed(1)}% of assets) - solid financial foundation`)
    if (status === 'leveraged') status = 'stable'
  } else if (equityRatio >= 30) {
    insights.push(`Adequate equity position (${equityRatio.toFixed(1)}% of assets)`)
  } else {
    insights.push(`Weak equity position (${equityRatio.toFixed(1)}% of assets) - highly leveraged`)
    if (status === 'stable') status = 'leveraged'
  }

  // Assess returns
  if (roa > 0 && roe > 0) {
    if (roa >= 10) {
      insights.push(`Excellent ROA (${roa}%) - highly efficient asset utilization`)
    } else if (roa >= 5) {
      insights.push(`Good ROA (${roa}%) - effective asset management`)
    } else if (roa > 0) {
      insights.push(`Positive but low ROA (${roa}%) - consider improving asset efficiency`)
    }

    if (roe >= 20) {
      insights.push(`Excellent ROE (${roe}%) - strong returns for shareholders`)
    } else if (roe >= 15) {
      insights.push(`Good ROE (${roe}%) - healthy shareholder returns`)
    } else if (roe >= 10) {
      insights.push(`Fair ROE (${roe}%) - adequate shareholder returns`)
    } else if (roe > 0) {
      insights.push(`Low ROE (${roe}%) - minimal shareholder returns`)
    }
  } else if (roa < 0 || roe < 0) {
    insights.push('Negative returns - company is unprofitable')
    if (status === 'strong' || status === 'stable') status = 'leveraged'
  }

  // Assess debt burden
  if (debtRatio > 70) {
    insights.push(`High debt ratio (${debtRatio.toFixed(1)}%) - monitor debt serviceability`)
    if (status === 'stable') status = 'leveraged'
  } else if (debtRatio < 30) {
    insights.push(`Low debt ratio (${debtRatio.toFixed(1)}%) - conservative financing`)
  }

  // Size assessment
  if (assets < 100000) {
    insights.push('Small asset base - limited resources for growth')
  } else if (assets > 10000000) {
    insights.push('Substantial asset base - strong resource foundation')
  }

  return {
    status,
    insights,
    metrics: {
      assets,
      liabilities,
      equity,
      debtToEquity,
      roa,
      roe
    }
  }
}