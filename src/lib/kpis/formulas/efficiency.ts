import { FinancialData } from '../types'
import { calculateRevenue } from './revenue'

/**
 * Calculate Days Sales Outstanding (DSO)
 * Formula: (Accounts Receivable / Revenue) × Days in Period
 * Measures average days to collect payment after a sale
 * Lower is better - typical target: 30-45 days
 */
export function calculateDSO(data: FinancialData): number {
  if (!data.balanceSheet?.accounts_receivable) return 0

  const revenue = calculateRevenue(data)
  if (revenue === 0) return 0

  const ar = data.balanceSheet.accounts_receivable
  const daysInPeriod = (data.period?.months || 1) * 30 // Approximate days

  const dso = (ar / revenue) * daysInPeriod
  return Math.round(dso)
}

/**
 * Calculate Days Payable Outstanding (DPO)
 * Formula: (Accounts Payable / COGS) × Days in Period
 * Measures average days to pay suppliers
 * Higher can be better for cash flow, but not too high
 */
export function calculateDPO(data: FinancialData): number {
  if (!data.balanceSheet?.accounts_payable) return 0

  const cogs = data.pnl?.cost_of_goods_sold || 0
  if (cogs === 0) {
    // For service businesses without COGS, use total expenses as proxy
    const expenses = data.pnl?.total_expenses || 0
    if (expenses === 0) return 0

    const ap = data.balanceSheet.accounts_payable
    const daysInPeriod = (data.period?.months || 1) * 30

    const dpo = (ap / expenses) * daysInPeriod
    return Math.round(dpo)
  }

  const ap = data.balanceSheet.accounts_payable
  const daysInPeriod = (data.period?.months || 1) * 30

  const dpo = (ap / cogs) * daysInPeriod
  return Math.round(dpo)
}

/**
 * Calculate Days Inventory Outstanding (DIO)
 * Formula: (Inventory / COGS) × Days in Period
 * Measures average days inventory is held before sale
 * Lower is generally better - reduces carrying costs
 */
export function calculateDIO(data: FinancialData): number {
  if (!data.balanceSheet?.inventory) return 0

  const cogs = data.pnl?.cost_of_goods_sold || 0
  if (cogs === 0) return 0 // Service businesses may have no COGS

  const inventory = data.balanceSheet.inventory
  const daysInPeriod = (data.period?.months || 1) * 30

  const dio = (inventory / cogs) * daysInPeriod
  return Math.round(dio)
}

/**
 * Calculate Cash Conversion Cycle (CCC)
 * Formula: DSO + DIO - DPO
 * Measures days between paying for inventory and collecting cash from sales
 * Lower is better - negative means collecting cash before paying suppliers
 */
export function calculateCashConversionCycle(data: FinancialData): number {
  const dso = calculateDSO(data)
  const dio = calculateDIO(data)
  const dpo = calculateDPO(data)

  const ccc = dso + dio - dpo
  return Math.round(ccc)
}

/**
 * Calculate Asset Turnover Ratio
 * Formula: Revenue / Average Total Assets
 * Measures efficiency of asset utilization
 * Higher is better - more revenue per dollar of assets
 */
export function calculateAssetTurnover(data: FinancialData): number {
  if (!data.balanceSheet?.total_assets) return 0

  const revenue = calculateRevenue(data)
  const assets = data.balanceSheet.total_assets

  if (assets === 0) return 0

  // Annualize if needed
  const annualizedRevenue = revenue * (12 / (data.period?.months || 12))

  const turnover = annualizedRevenue / assets
  return Math.round(turnover * 100) / 100
}

/**
 * Calculate Inventory Turnover Ratio
 * Formula: COGS / Average Inventory
 * Measures how many times inventory is sold and replaced
 * Higher is generally better - indicates efficient inventory management
 */
export function calculateInventoryTurnover(data: FinancialData): number {
  if (!data.balanceSheet?.inventory || data.balanceSheet.inventory === 0) return 0

  const cogs = data.pnl?.cost_of_goods_sold || 0
  if (cogs === 0) return 0

  const inventory = data.balanceSheet.inventory

  // Annualize if needed
  const annualizedCOGS = cogs * (12 / (data.period?.months || 12))

  const turnover = annualizedCOGS / inventory
  return Math.round(turnover * 10) / 10
}

/**
 * Calculate Receivables Turnover Ratio
 * Formula: Revenue / Average Accounts Receivable
 * Measures how efficiently company collects receivables
 * Higher is better - indicates faster collection
 */
export function calculateReceivablesTurnover(data: FinancialData): number {
  if (!data.balanceSheet?.accounts_receivable || data.balanceSheet.accounts_receivable === 0) {
    return 0
  }

  const revenue = calculateRevenue(data)
  const ar = data.balanceSheet.accounts_receivable

  // Annualize if needed
  const annualizedRevenue = revenue * (12 / (data.period?.months || 12))

  const turnover = annualizedRevenue / ar
  return Math.round(turnover * 10) / 10
}

/**
 * Assess operational efficiency based on activity ratios
 * Returns semantic interpretation of efficiency metrics
 */
export function assessEfficiencyHealth(data: FinancialData): {
  status: 'excellent' | 'good' | 'fair' | 'poor'
  insights: string[]
  metrics: {
    dso: number
    dpo: number
    dio: number
    ccc: number
    assetTurnover: number
  }
} {
  const dso = calculateDSO(data)
  const dpo = calculateDPO(data)
  const dio = calculateDIO(data)
  const ccc = calculateCashConversionCycle(data)
  const assetTurnover = calculateAssetTurnover(data)

  const insights: string[] = []
  let status: 'excellent' | 'good' | 'fair' | 'poor' = 'fair'
  let scorePoints = 0
  let maxPoints = 0

  // Assess DSO (Days Sales Outstanding)
  if (dso > 0) {
    maxPoints += 2
    if (dso <= 30) {
      insights.push(`Excellent collection period (${dso} days) - very efficient receivables management`)
      scorePoints += 2
    } else if (dso <= 45) {
      insights.push(`Good collection period (${dso} days) - standard for most industries`)
      scorePoints += 1.5
    } else if (dso <= 60) {
      insights.push(`Fair collection period (${dso} days) - consider improving collection processes`)
      scorePoints += 1
    } else {
      insights.push(`Slow collections (${dso} days) - significant working capital tied up in receivables`)
      scorePoints += 0.5
    }
  }

  // Assess DIO (Days Inventory Outstanding) - only for businesses with inventory
  if (dio > 0) {
    maxPoints += 2
    if (dio <= 30) {
      insights.push(`Fast inventory turnover (${dio} days) - efficient inventory management`)
      scorePoints += 2
    } else if (dio <= 60) {
      insights.push(`Good inventory turnover (${dio} days) - reasonable for most businesses`)
      scorePoints += 1.5
    } else if (dio <= 90) {
      insights.push(`Slow inventory turnover (${dio} days) - consider reducing inventory levels`)
      scorePoints += 1
    } else {
      insights.push(`Very slow inventory turnover (${dio} days) - excess inventory tying up capital`)
      scorePoints += 0.5
    }
  }

  // Assess Cash Conversion Cycle
  if (dso > 0 || dio > 0 || dpo > 0) {
    maxPoints += 2
    if (ccc < 0) {
      insights.push(`Negative cash conversion cycle (${ccc} days) - collecting cash before paying suppliers`)
      scorePoints += 2
      status = 'excellent'
    } else if (ccc <= 30) {
      insights.push(`Excellent cash conversion cycle (${ccc} days) - efficient working capital management`)
      scorePoints += 2
    } else if (ccc <= 60) {
      insights.push(`Good cash conversion cycle (${ccc} days) - reasonable working capital efficiency`)
      scorePoints += 1.5
    } else if (ccc <= 90) {
      insights.push(`Fair cash conversion cycle (${ccc} days) - room for improvement`)
      scorePoints += 1
    } else {
      insights.push(`Poor cash conversion cycle (${ccc} days) - significant cash tied up in operations`)
      scorePoints += 0.5
    }
  }

  // Assess Asset Turnover
  if (assetTurnover > 0) {
    maxPoints += 2
    if (assetTurnover >= 2.0) {
      insights.push(`High asset turnover (${assetTurnover}x) - excellent asset utilization`)
      scorePoints += 2
    } else if (assetTurnover >= 1.0) {
      insights.push(`Good asset turnover (${assetTurnover}x) - generating revenue equal to assets`)
      scorePoints += 1.5
    } else if (assetTurnover >= 0.5) {
      insights.push(`Fair asset turnover (${assetTurnover}x) - consider improving asset efficiency`)
      scorePoints += 1
    } else {
      insights.push(`Low asset turnover (${assetTurnover}x) - underutilized assets`)
      scorePoints += 0.5
    }
  }

  // Calculate overall status based on score
  if (maxPoints > 0) {
    const scorePercentage = (scorePoints / maxPoints) * 100
    if (scorePercentage >= 85) {
      status = 'excellent'
    } else if (scorePercentage >= 70) {
      status = 'good'
    } else if (scorePercentage >= 50) {
      status = 'fair'
    } else {
      status = 'poor'
    }
  } else {
    insights.push('Insufficient data for efficiency analysis')
    status = 'poor'
  }

  // Add DPO insight
  if (dpo > 0) {
    if (dpo > 60) {
      insights.push(`Extended payment terms (${dpo} days) - good for cash flow but monitor supplier relationships`)
    } else if (dpo < 20) {
      insights.push(`Quick supplier payments (${dpo} days) - consider negotiating longer payment terms`)
    }
  }

  return {
    status,
    insights,
    metrics: {
      dso,
      dpo,
      dio,
      ccc,
      assetTurnover
    }
  }
}