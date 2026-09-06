import { FinancialData } from '../types'
import { calculateNetIncome } from './profitability'
import { calculateRevenue } from './revenue'

/**
 * Calculate Operating Cash Flow (OCF)
 * Priority: Cash Flow Statement > Calculated from P&L (indirect method)
 * See: docs/api-v2/kpi-definitions/catalog.md#operating-cash-flow
 */
export function calculateOperatingCashFlow(data: FinancialData): number {
  // Use cash flow statement if available
  if (data.cashFlow?.net_cash_from_operating_activities !== undefined) {
    return Math.round(data.cashFlow.net_cash_from_operating_activities * 100) / 100
  }

  // Indirect method calculation from P&L
  const netIncome = calculateNetIncome(data)

  // Add back non-cash expenses
  const depreciation = data.pnl?.depreciation || 0
  const amortization = data.pnl?.amortization || 0

  // Working capital changes (if balance sheet data available)
  let workingCapitalChanges = 0
  if (data.balanceSheet) {
    // Note: This is simplified - real calculation would need period-over-period changes
    // For now, we'll estimate based on current levels
    workingCapitalChanges = 0
  }

  // Simple estimation: Net Income + D&A + Working Capital Changes
  const estimatedOCF = netIncome + depreciation + amortization + workingCapitalChanges

  // If still zero and we have net income, use 80% of net income as rough estimate
  if (estimatedOCF === 0 && netIncome !== 0) {
    return Math.round(netIncome * 0.8 * 100) / 100
  }

  return Math.round(estimatedOCF * 100) / 100
}

/**
 * Calculate Investing Cash Flow
 * Direct from Cash Flow Statement
 */
export function calculateInvestingCashFlow(data: FinancialData): number {
  if (data.cashFlow?.net_cash_from_investing_activities !== undefined) {
    return Math.round(data.cashFlow.net_cash_from_investing_activities * 100) / 100
  }

  // Fallback: negative of capital expenditures if available
  if (data.cashFlow?.capital_expenditures !== undefined) {
    return Math.round(-Math.abs(data.cashFlow.capital_expenditures) * 100) / 100
  }

  return 0
}

/**
 * Calculate Financing Cash Flow
 * Direct from Cash Flow Statement
 */
export function calculateFinancingCashFlow(data: FinancialData): number {
  if (data.cashFlow?.net_cash_from_financing_activities !== undefined) {
    return Math.round(data.cashFlow.net_cash_from_financing_activities * 100) / 100
  }
  return 0
}

/**
 * Calculate Net Cash Flow
 * Formula: Operating CF + Investing CF + Financing CF
 */
export function calculateNetCashFlow(data: FinancialData): number {
  const operating = calculateOperatingCashFlow(data)
  const investing = calculateInvestingCashFlow(data)
  const financing = calculateFinancingCashFlow(data)

  const netCashFlow = operating + investing + financing
  return Math.round(netCashFlow * 100) / 100
}

/**
 * Calculate Beginning Cash Balance
 * Direct from Cash Flow Statement
 */
export function calculateBeginningCash(data: FinancialData): number {
  if (data.cashFlow?.cash_at_beginning !== undefined) {
    return Math.round(data.cashFlow.cash_at_beginning * 100) / 100
  }

  // Fallback: Calculate from ending cash and net change
  if (data.cashFlow?.cash_at_end !== undefined) {
    const netChange = calculateNetCashFlow(data)
    return Math.round((data.cashFlow.cash_at_end - netChange) * 100) / 100
  }

  return 0
}

/**
 * Calculate Days Cash on Hand
 * Formula: (Cash Balance / Daily Operating Expenses)
 * Shows how many days the company can operate with current cash
 */
export function calculateDaysCash(data: FinancialData): number {
  const cashBalance = calculateCashBalance(data)
  const periodMonths = data.period?.months || 1
  const dailyExpenses = (data.pnl?.total_expenses || 0) / (periodMonths * 30)

  if (dailyExpenses === 0) return 999 // Infinite if no expenses

  const daysCash = cashBalance / dailyExpenses
  return Math.round(daysCash)
}

/**
 * Calculate Free Cash Flow (FCF)
 * Formula: Operating Cash Flow - Capital Expenditures
 */
export function calculateFreeCashFlow(data: FinancialData): number {
  const ocf = calculateOperatingCashFlow(data)
  const capex = data.cashFlow?.capital_expenditures || 0

  const fcf = ocf - Math.abs(capex) // CapEx is typically negative in cash flow statements
  return Math.round(fcf * 100) / 100
}

/**
 * Calculate Monthly Gross Burn Rate
 * Formula: Total Monthly Expenses
 * Gross burn rate is the total monthly cash outflow regardless of revenue
 */
export function calculateGrossBurnRate(data: FinancialData): number {
  const periodMonths = data.period?.months || 1
  const monthlyExpenses = (data.pnl?.total_expenses || 0) / periodMonths

  return Math.round(Math.abs(monthlyExpenses) * 100) / 100
}

/**
 * Calculate Monthly Net Burn Rate
 * Formula: Monthly Expenses - Monthly Revenue
 * Positive result means burning cash, negative means generating cash
 */
export function calculateNetBurnRate(data: FinancialData): number {
  const periodMonths = data.period?.months || 1
  const monthlyRevenue = calculateRevenue(data) / periodMonths
  const monthlyExpenses = (data.pnl?.total_expenses || 0) / periodMonths

  const netBurn = monthlyExpenses - monthlyRevenue
  return Math.round(netBurn * 100) / 100
}

/**
 * Calculate Monthly Burn Rate (legacy - redirects to gross burn rate)
 * @deprecated Use calculateGrossBurnRate or calculateNetBurnRate instead
 */
export function calculateBurnRate(data: FinancialData): number {
  // For backward compatibility, return gross burn rate
  return calculateGrossBurnRate(data)
}

/**
 * Calculate Cash Runway in months
 * Formula: Cash Balance / Monthly Gross Burn Rate
 * Uses gross burn rate for a more conservative runway calculation
 */
export function calculateRunway(data: FinancialData): number {
  const cashBalance = calculateCashBalance(data)
  const grossBurnRate = calculateGrossBurnRate(data)

  // Avoid division by zero
  if (grossBurnRate <= 0 || cashBalance <= 0) return 0 // No expenses or no cash

  const runwayMonths = cashBalance / grossBurnRate
  return Math.round(runwayMonths)
}

/**
 * Calculate current cash balance
 * Priority: Cash Flow Statement > Balance Sheet > Bank Accounts
 */
export function calculateCashBalance(data: FinancialData): number {
  // Priority 1: Cash flow statement ending balance
  if (data.cashFlow?.cash_at_end !== undefined) {
    return Math.round(data.cashFlow.cash_at_end * 100) / 100
  }

  // Priority 2: Balance sheet cash and equivalents
  if (data.balanceSheet?.cash_and_equivalents !== undefined) {
    return Math.round(data.balanceSheet.cash_and_equivalents * 100) / 100
  }

  // Priority 3: Sum of bank account balances
  if (data.bankAccounts && data.bankAccounts.length > 0) {
    const totalCash = data.bankAccounts
      .filter(account =>
        account.type === 'Bank' ||
        account.type === 'Cash' ||
        account.type?.toLowerCase().includes('bank') ||
        account.type?.toLowerCase().includes('cash')
      )
      .reduce((sum, account) => sum + (account.balance || 0), 0)
    return Math.round(totalCash * 100) / 100
  }

  return 0
}

/**
 * Calculate cash flow health metrics
 * Returns semantic interpretation of cash flow status
 */
export function assessCashFlowHealth(data: FinancialData): {
  status: 'strong' | 'adequate' | 'concerning' | 'critical'
  insights: string[]
  metrics: {
    ocf: number
    fcf: number
    grossBurnRate: number
    netBurnRate: number
    runway: number
    cashBalance: number
  }
} {
  const ocf = calculateOperatingCashFlow(data)
  const fcf = calculateFreeCashFlow(data)
  const grossBurnRate = calculateGrossBurnRate(data)
  const netBurnRate = calculateNetBurnRate(data)
  const runway = calculateRunway(data)
  const cashBalance = calculateCashBalance(data)

  const insights: string[] = []
  let status: 'strong' | 'adequate' | 'concerning' | 'critical' = 'adequate'

  // Assess OCF
  if (ocf > 0) {
    insights.push('Positive operating cash flow - business is cash generative')
    status = 'strong'
  } else {
    insights.push('Negative operating cash flow - burning cash from operations')
    status = 'concerning'
  }

  // Assess FCF
  if (fcf > 0) {
    insights.push('Positive free cash flow - generating cash after investments')
  } else if (fcf < 0 && ocf > 0) {
    insights.push('Negative free cash flow due to investments - monitor CapEx levels')
  } else {
    insights.push('Negative free cash flow - both operations and investments consuming cash')
  }

  // Assess runway (using gross burn rate now, so no infinite runway for profitable companies)
  if (runway >= 18) {
    insights.push(`${runway} months runway - healthy cash position`)
    if (netBurnRate <= 0) status = 'strong' // Profitable with good runway
  } else if (runway >= 12) {
    insights.push(`${runway} months runway - adequate time to reach profitability or raise funds`)
    if (status === 'concerning') status = 'adequate'
  } else if (runway >= 6) {
    insights.push(`${runway} months runway - consider fundraising or cost reduction`)
    status = 'concerning'
  } else if (runway > 0) {
    insights.push(`Only ${runway} months runway - immediate action required`)
    status = 'critical'
  } else {
    insights.push('No runway calculated - check cash and expense data')
  }

  // Assess burn rates
  if (netBurnRate <= 0) {
    insights.push('Company is profitable or cash flow positive')
    if (status !== 'critical') status = 'strong'
  } else if (netBurnRate < grossBurnRate * 0.5) {
    insights.push('Revenue covering more than 50% of expenses')
  } else {
    insights.push(`High net burn rate: ${Math.round(netBurnRate)} per month`)
  }

  // Assess cash balance relative to monthly expenses
  const monthlyExpenses = (data.pnl?.total_expenses || 0) / (data.period?.months || 1)
  const cashCoverageMonths = monthlyExpenses > 0 ? cashBalance / monthlyExpenses : 0

  if (cashCoverageMonths < 3 && netBurnRate > 0) {
    insights.push('Low cash reserves - less than 3 months of expenses')
    if (status === 'adequate') status = 'concerning'
  }

  return {
    status,
    insights,
    metrics: {
      ocf,
      fcf,
      grossBurnRate,
      netBurnRate,
      runway,
      cashBalance
    }
  }
}