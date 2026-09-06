/**
 * Cash Flow Report Enricher
 *
 * Takes normalized Cash Flow data from transformCashFlow and adds all business logic:
 * - KPIs calculation
 * - Burn rate and runway metrics
 * - Free cash flow and OCF ratio
 * - Cash conversion cycle
 * - Activity breakdowns with working capital changes
 * - Days metrics (receivable, payable, inventory)
 */

import {
  getCashAndEquivalents,
  getAccountsReceivable,
  getAccountsPayable,
  getInventoryValue,
} from '@/quickbooks/utils/accounts'
import { calculateTotalExpenses, toTwoDecimals } from '@/lib/utils/financial/reportCalculations'

interface NormalizedCashFlow {
  reportName: string
  startDate: string
  endDate: string
  currency: string
  generatedAt: string
  operatingActivities: {
    lines: Array<{ name: string; total: number; level: number; isSummary: boolean }>
    total: number
  }
  investingActivities: {
    lines: Array<{ name: string; total: number; level: number; isSummary: boolean }>
    total: number
  }
  financingActivities: {
    lines: Array<{ name: string; total: number; level: number; isSummary: boolean }>
    total: number
  }
  netCashChange: number
  beginningCash: number
  endingCash: number
  columns: string[]
}

interface ProfitAndLossData {
  total_income?: number
  total_expenses?: number
  net_income: number
  cogs_total?: number
  other_expenses?: number
  cost_of_goods_sold?: number
}

interface BalanceSheetData {
  total_assets?: number
  total_liabilities?: number
  total_equity?: number
  cash_and_equivalents?: number
  current_assets?: number
  current_liabilities?: number
}

interface CashFlowActivity {
  item: string
  amount: number
}

interface CashFlowKPIs {
  operatingCashFlow: number
  investingCashFlow: number
  financingCashFlow: number
  netCashFlow: number
  cashBeginning: number
  cashEnding: number
  cash_balance: number // Alias for cashEnding - used by metric handler
}

interface CashFlowMetrics {
  burn_rate: number
  runway_months: number
  days_cash: number
  operating_cash_flow_ratio: number
  free_cash_flow: number
  cash_conversion_cycle: number
  operating_cash_flow_margin?: number
  cash_flow_coverage_ratio?: number
  revenue?: number
  capital_expenditures?: number
  total_debt?: number
  days_receivable?: number
  days_payable?: number
  days_inventory?: number
  total_expenses?: number
  period_months?: number
  current_liabilities?: number
}

interface WaterfallChartData {
  name: string
  value: number
}

interface EnrichedCashFlowData {
  kpis: CashFlowKPIs
  cashMetrics: CashFlowMetrics
  operatingActivities?: CashFlowActivity[]
  investingActivities?: CashFlowActivity[]
  financingActivities?: CashFlowActivity[]
  waterfallChart: WaterfallChartData[]
  errors?: string[]
  metadata?: {
    dataQuality?: {
      isComplete: boolean
      hasPartialData: boolean
      errors?: Array<{ type: string; message: string; severity: string }>
      warnings?: string[]
    }
  }
}

interface EnrichCashFlowOptions {
  organizationId: string
  normalizedCashFlow: NormalizedCashFlow
  profitAndLoss: ProfitAndLossData
  balanceSheet?: BalanceSheetData
  includeDetails?: boolean
}

/**
 * Calculate days receivable (DSO - Days Sales Outstanding)
 */
async function calculateDaysReceivable(orgId: string, revenue: number): Promise<number> {
  try {
    if (revenue <= 0) return 0
    const ar = await getAccountsReceivable(orgId)
    const dailyRevenue = revenue / 365
    return dailyRevenue > 0 ? Math.round(ar / dailyRevenue) : 0
  } catch {
    return 0
  }
}

/**
 * Calculate days payable (DPO - Days Payable Outstanding)
 */
async function calculateDaysPayable(orgId: string, expenses: number): Promise<number> {
  try {
    if (expenses <= 0) return 0
    const ap = await getAccountsPayable(orgId)
    const dailyExpenses = expenses / 365
    return dailyExpenses > 0 ? Math.round(ap / dailyExpenses) : 0
  } catch {
    return 0
  }
}

/**
 * Calculate days inventory (DIO - Days Inventory Outstanding)
 */
async function calculateDaysInventory(orgId: string, cogs: number): Promise<number> {
  try {
    if (cogs <= 0) return 0
    const inventoryResult = await getInventoryValue(orgId)
    const inventory = inventoryResult.value
    const dailyCOGS = cogs / 365
    return dailyCOGS > 0 ? Math.round(inventory / dailyCOGS) : 0
  } catch {
    return 0
  }
}

/**
 * Calculate cash flow metrics
 */
function calculateCashFlowMetrics(
  cashBalance: number,
  monthlyExpenses: number,
  operatingCashFlow: number,
  currentLiabilities: number,
  capitalExpenditures: number = 0,
  revenue: number = 0,
  daysReceivable: number = 0,
  daysPayable: number = 0,
  daysInventory: number = 0,
  totalDebt: number = 0,
  totalExpenses: number = 0,
  periodMonths: number = 1
): CashFlowMetrics {
  // Basic metrics
  const burnRate = -Math.abs(monthlyExpenses) // Always negative
  const runwayMonths = burnRate !== 0 ? cashBalance / Math.abs(burnRate) : 999
  const daysCash = monthlyExpenses > 0 ? cashBalance / (monthlyExpenses / 30) : 999
  const operatingCashFlowRatio = currentLiabilities > 0 ? operatingCashFlow / currentLiabilities : 0

  // Advanced metrics
  const freeCashFlow = operatingCashFlow - capitalExpenditures
  const cashConversionCycle = Math.max(0, daysReceivable + daysInventory - daysPayable)
  const operatingCashFlowMargin = revenue > 0 ? (operatingCashFlow / revenue) * 100 : undefined
  const cashFlowCoverageRatio = totalDebt > 0 ? operatingCashFlow / totalDebt : undefined

  return {
    burn_rate: toTwoDecimals(burnRate),
    runway_months: toTwoDecimals(Math.min(runwayMonths, 999)),
    days_cash: Math.min(Math.round(daysCash), 999),
    operating_cash_flow_ratio: toTwoDecimals(operatingCashFlowRatio),
    free_cash_flow: toTwoDecimals(freeCashFlow),
    cash_conversion_cycle: Math.round(cashConversionCycle),
    operating_cash_flow_margin: toTwoDecimals(
      operatingCashFlowMargin !== undefined ? operatingCashFlowMargin : 0
    ),
    cash_flow_coverage_ratio: toTwoDecimals(
      cashFlowCoverageRatio !== undefined ? cashFlowCoverageRatio : 0
    ),
    // Include component values for tooltips
    revenue: toTwoDecimals(revenue),
    capital_expenditures: toTwoDecimals(capitalExpenditures),
    total_debt: toTwoDecimals(totalDebt),
    days_receivable: daysReceivable,
    days_payable: daysPayable,
    days_inventory: daysInventory,
    total_expenses: toTwoDecimals(totalExpenses),
    period_months: periodMonths,
    current_liabilities: toTwoDecimals(currentLiabilities),
  }
}

/**
 * Convert normalized lines to activity array
 */
function convertLinesToActivities(
  lines: Array<{ name: string; total: number; level: number; isSummary: boolean }>
): CashFlowActivity[] {
  return lines
    .filter((line) => !line.isSummary) // Exclude summary rows
    .map((line) => ({
      item: line.name,
      amount: toTwoDecimals(line.total),
    }))
}

/**
 * Enrich normalized Cash Flow data with all business logic
 */
export async function enrichCashFlow(
  options: EnrichCashFlowOptions
): Promise<EnrichedCashFlowData> {
  const {
    organizationId,
    normalizedCashFlow,
    profitAndLoss,
    balanceSheet,
    includeDetails = true,
  } = options

  const errors: string[] = []

  // Extract KPIs from normalized data
  const kpis: CashFlowKPIs = {
    operatingCashFlow: toTwoDecimals(normalizedCashFlow.operatingActivities.total),
    investingCashFlow: toTwoDecimals(normalizedCashFlow.investingActivities.total),
    financingCashFlow: toTwoDecimals(normalizedCashFlow.financingActivities.total),
    netCashFlow: toTwoDecimals(normalizedCashFlow.netCashChange),
    cashBeginning: toTwoDecimals(normalizedCashFlow.beginningCash),
    cashEnding: toTwoDecimals(normalizedCashFlow.endingCash),
    cash_balance: toTwoDecimals(normalizedCashFlow.endingCash), // Alias for metric handler
  }

  // Get current cash balance (real-time from bank accounts)
  let cashBalance = kpis.cashEnding
  try {
    cashBalance = await getCashAndEquivalents(organizationId)
    // Update the KPI with real-time value so AI agent gets correct cash balance
    kpis.cash_balance = toTwoDecimals(cashBalance)
  } catch (error) {
    console.warn('Failed to fetch current cash balance, using ending cash from report')
  }

  // Calculate TRUE total expenses (COGS + Operating + Other)
  const trueTotalExpenses = calculateTotalExpenses(
    profitAndLoss.cogs_total || 0,
    profitAndLoss.total_expenses || 0,
    profitAndLoss.other_expenses || 0
  )

  // Calculate period months for burn rate
  const startDate = new Date(normalizedCashFlow.startDate)
  const endDate = new Date(normalizedCashFlow.endDate)
  const periodMonths = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
  )
  const monthlyExpenses = trueTotalExpenses / periodMonths

  // Calculate advanced metrics with additional data
  const capitalExpenditures = Math.abs(kpis.investingCashFlow || 0)
  const revenue = profitAndLoss.total_income || 0
  const totalDebt = balanceSheet?.total_liabilities || 0
  const currentLiabilities =
    balanceSheet?.current_liabilities ||
    (balanceSheet?.total_liabilities ? balanceSheet.total_liabilities * 0.5 : 0)

  // Calculate days metrics
  let daysReceivable = 0
  let daysPayable = 0
  let daysInventory = 0

  try {
    daysReceivable = await calculateDaysReceivable(organizationId, revenue)
  } catch (error) {
    console.warn('Failed to calculate days receivable:', error)
  }

  try {
    daysPayable = await calculateDaysPayable(organizationId, trueTotalExpenses)
  } catch (error) {
    console.warn('Failed to calculate days payable:', error)
  }

  try {
    daysInventory = await calculateDaysInventory(
      organizationId,
      profitAndLoss.cogs_total || profitAndLoss.cost_of_goods_sold || 0
    )
  } catch (error) {
    console.warn('Failed to calculate days inventory:', error)
  }

  // Calculate cash flow metrics
  const cashMetrics = calculateCashFlowMetrics(
    cashBalance,
    monthlyExpenses,
    kpis.operatingCashFlow,
    currentLiabilities,
    capitalExpenditures,
    revenue,
    daysReceivable,
    daysPayable,
    daysInventory,
    totalDebt,
    trueTotalExpenses,
    periodMonths
  )

  // Build waterfall chart data
  const waterfallChart: WaterfallChartData[] = [
    {
      name: 'Beginning Cash',
      value: toTwoDecimals(kpis.cashBeginning),
    },
    {
      name: 'Operating',
      value: toTwoDecimals(kpis.operatingCashFlow),
    },
    {
      name: 'Investing',
      value: toTwoDecimals(kpis.investingCashFlow),
    },
    {
      name: 'Financing',
      value: toTwoDecimals(kpis.financingCashFlow),
    },
    {
      name: 'Ending Cash',
      value: toTwoDecimals(kpis.cashEnding),
    },
  ]

  // Convert normalized lines to activity arrays if details are requested
  let operatingActivities: CashFlowActivity[] | undefined
  let investingActivities: CashFlowActivity[] | undefined
  let financingActivities: CashFlowActivity[] | undefined

  if (includeDetails) {
    operatingActivities = convertLinesToActivities(normalizedCashFlow.operatingActivities.lines)
    investingActivities = convertLinesToActivities(normalizedCashFlow.investingActivities.lines)
    financingActivities = convertLinesToActivities(normalizedCashFlow.financingActivities.lines)
  }

  return {
    kpis,
    cashMetrics,
    operatingActivities,
    investingActivities,
    financingActivities,
    waterfallChart,
    errors: errors.length > 0 ? errors : undefined,
    metadata: {
      dataQuality: {
        isComplete: errors.length === 0,
        hasPartialData: errors.length > 0,
        errors: errors.map((errMsg) => ({
          type:
            errMsg.includes('rate limit') || errMsg.includes('429') ? 'rate_limit' : 'fetch_error',
          message: errMsg,
          severity: errMsg.includes('rate limit') || errMsg.includes('429') ? 'warning' : 'error',
        })),
        warnings:
          errors.length > 0
            ? errors.map((errMsg) => {
                if (errMsg.includes('rate limit') || errMsg.includes('429')) {
                  return 'Some cash flow details are unavailable due to QuickBooks rate limiting. Please try again in a few minutes.'
                }
                return `Some cash flow details are unavailable: ${errMsg}`
              })
            : [],
      },
    },
  }
}
