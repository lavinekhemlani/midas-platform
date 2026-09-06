import { FinancialData } from '../types'
import { calculateRevenue } from './revenue'

/**
 * Calculate Gross Profit
 * Formula: Revenue - COGS
 * Handles QB Desktop vs Online differences for cash basis accounting
 * See: docs/api-v2/kpi-definitions/catalog.md#gross-profit
 */
export function calculateGrossProfit(data: FinancialData): number {
  const revenue = calculateRevenue(data)
  let cogs = data.pnl?.cost_of_goods_sold || 0

  // Handle QuickBooks version differences for cash basis accounting
  if (data.profile?.accountingBasis === 'cash') {
    // For cash basis, COGS timing differs between QB Desktop and Online
    // Desktop: COGS recognized when sale is made
    // Online: COGS recognized when purchased
    // Without detailed transaction data, we use the reported COGS
    cogs = data.pnl?.cost_of_goods_sold || 0
  }

  const grossProfit = revenue - cogs
  return Math.round(grossProfit * 100) / 100
}

/**
 * Calculate Gross Margin percentage
 * Formula: (Gross Profit / Revenue) × 100
 * Returns 0 if revenue is 0 to avoid division by zero
 */
export function calculateGrossMargin(data: FinancialData): number {
  const revenue = calculateRevenue(data)
  if (revenue === 0) return 0

  const grossProfit = calculateGrossProfit(data)
  const margin = (grossProfit / revenue) * 100
  return Math.round(margin * 10) / 10 // 1 decimal place for percentages
}

/**
 * Calculate Total Expenses
 * Formula: Direct from P&L report or sum of expense categories
 * See: docs/api-v2/kpi-definitions/catalog.md#total-expenses
 */
export function calculateTotalExpenses(data: FinancialData): number {
  // Use reported total expenses if available
  if (data.pnl?.total_expenses !== undefined) {
    return Math.round(data.pnl.total_expenses * 100) / 100
  }

  // Calculate from components if available
  const operatingExpenses = data.pnl?.operating_expenses || 0
  const interestExpense = data.pnl?.interest_expense || 0
  const taxExpense = data.pnl?.tax_expense || 0
  const otherExpenses = data.pnl?.other_expenses || 0

  const totalExpenses = operatingExpenses + interestExpense + taxExpense + otherExpenses
  return Math.round(totalExpenses * 100) / 100
}

/**
 * Calculate Net Income
 * Formula: Total Income - Total Expenses
 * Uses P&L report data or calculates from components
 */
export function calculateNetIncome(data: FinancialData): number {
  // Use reported net income if available
  if (data.pnl?.net_income !== undefined) {
    return Math.round(data.pnl.net_income * 100) / 100
  }

  // Calculate from revenue and expenses
  const revenue = calculateRevenue(data)
  const totalExpenses = calculateTotalExpenses(data)
  const netIncome = revenue - totalExpenses
  return Math.round(netIncome * 100) / 100
}

/**
 * Calculate Net Profit Margin percentage
 * Formula: (Net Income / Revenue) × 100
 * Returns 0 if revenue is 0 to avoid division by zero
 */
export function calculateNetMargin(data: FinancialData): number {
  const revenue = calculateRevenue(data)
  if (revenue === 0) return 0

  const netIncome = calculateNetIncome(data)
  const margin = (netIncome / revenue) * 100
  return Math.round(margin * 10) / 10 // 1 decimal place for percentages
}

/**
 * Calculate EBITDA (Earnings Before Interest, Taxes, Depreciation, and Amortization)
 * Formula: Net Income + Interest + Taxes + Depreciation + Amortization
 * Alternative: Revenue - Operating Expenses (excluding D&A)
 */
export function calculateEBITDA(data: FinancialData): number {
  // Method 1: Add back from net income
  if (data.pnl?.net_income !== undefined) {
    const netIncome = data.pnl.net_income
    const interest = data.pnl.interest_expense || 0
    const taxes = data.pnl.tax_expense || 0
    const depreciation = data.pnl.depreciation || 0
    const amortization = data.pnl.amortization || 0

    const ebitda = netIncome + interest + taxes + depreciation + amortization
    return Math.round(ebitda * 100) / 100
  }

  // Method 2: Revenue minus operating expenses (excluding D&A)
  const revenue = calculateRevenue(data)
  const operatingExpenses = data.pnl?.operating_expenses || data.pnl?.total_expenses || 0
  const depreciation = data.pnl?.depreciation || 0
  const amortization = data.pnl?.amortization || 0

  // If operating expenses include D&A, add them back
  const ebitda = revenue - (operatingExpenses - depreciation - amortization)
  return Math.round(ebitda * 100) / 100
}

/**
 * Calculate EBITDA Margin percentage
 * Formula: (EBITDA / Revenue) × 100
 * Returns 0 if revenue is 0 to avoid division by zero
 */
export function calculateEBITDAMargin(data: FinancialData): number {
  const revenue = calculateRevenue(data)
  if (revenue === 0) return 0

  const ebitda = calculateEBITDA(data)
  const margin = (ebitda / revenue) * 100
  return Math.round(margin * 10) / 10 // 1 decimal place for percentages
}

/**
 * Get profitability health assessment based on margins
 * Returns a semantic interpretation of the profitability metrics
 */
export function assessProfitabilityHealth(data: FinancialData): {
  status: 'excellent' | 'good' | 'fair' | 'poor'
  insights: string[]
} {
  const grossMargin = calculateGrossMargin(data)
  const netMargin = calculateNetMargin(data)
  const industry = data.profile?.industry || 'general'

  const insights: string[] = []
  let status: 'excellent' | 'good' | 'fair' | 'poor' = 'fair'

  // Industry-specific benchmarks
  const benchmarks = {
    saas: { grossMargin: 70, netMargin: 15 },
    ecommerce: { grossMargin: 45, netMargin: 5 },
    manufacturing: { grossMargin: 30, netMargin: 8 },
    general: { grossMargin: 50, netMargin: 10 }
  }

  const benchmark = benchmarks[industry as keyof typeof benchmarks] || benchmarks.general

  // Assess gross margin
  if (grossMargin >= benchmark.grossMargin * 1.2) {
    insights.push(`Excellent gross margin (${grossMargin}%) - well above industry average`)
    status = 'excellent'
  } else if (grossMargin >= benchmark.grossMargin) {
    insights.push(`Good gross margin (${grossMargin}%) - at or above industry average`)
    status = 'good'
  } else if (grossMargin >= benchmark.grossMargin * 0.8) {
    insights.push(`Fair gross margin (${grossMargin}%) - slightly below industry average`)
    status = 'fair'
  } else {
    insights.push(`Poor gross margin (${grossMargin}%) - significantly below industry average`)
    status = 'poor'
  }

  // Assess net margin
  if (netMargin < 0) {
    insights.push('Operating at a loss - focus on cost reduction or revenue growth')
    status = 'poor'
  } else if (netMargin >= benchmark.netMargin) {
    insights.push(`Healthy net margin (${netMargin}%) - profitable operations`)
  } else {
    insights.push(`Low net margin (${netMargin}%) - consider operational efficiency improvements`)
    if (status === 'excellent' || status === 'good') status = 'fair'
  }

  return { status, insights }
}