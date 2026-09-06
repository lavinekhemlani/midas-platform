/**
 * Forecasting Types
 *
 * Type definitions for the cash flow forecasting feature including
 * 13-week and 6-month forecast horizons, assumptions, and memory integration.
 */

export type ForecastHorizon = '13-week' | '6-month'
export type ForecastViewMode = 'cash-flow' | 'profit-loss'
export type ForecastAlgorithm = 'weighted' | 'holt-winters' | 'trend-adjusted'

export interface ForecastAssumptions {
  growthRate: number // -50 to +100 (percentage, monthly compound rate)
  rollingAverageDays: 30 | 60 | 90
  inflowGrowthRate: number // Separate rate for inflows
  outflowGrowthRate: number // Separate rate for outflows
  confidenceLevel: 80 | 90 | 95 // Confidence band width
  algorithm: ForecastAlgorithm // Forecasting algorithm to use
}

export const DEFAULT_ASSUMPTIONS: ForecastAssumptions = {
  growthRate: 10,
  rollingAverageDays: 60,
  inflowGrowthRate: 15,
  outflowGrowthRate: 10,
  confidenceLevel: 90,
  algorithm: 'weighted',
}

// Algorithm descriptions for UI
export const ALGORITHM_INFO: Record<ForecastAlgorithm, { name: string; description: string }> = {
  weighted: {
    name: 'Weighted Average',
    description:
      'Weights recent data more heavily using exponential decay. Best for stable trends.',
  },
  'holt-winters': {
    name: 'Holt-Winters',
    description:
      'Detects and projects seasonal patterns. Best for data with monthly/quarterly cycles.',
  },
  'trend-adjusted': {
    name: 'Trend-Adjusted',
    description:
      'Identifies linear trends in historical data. Best for consistent growth/decline patterns.',
  },
}

export interface ForecastPeriod {
  date: string // ISO date (week start for 13-week, month start for 6-month)
  label: string // "Week 1", "Feb 2026", etc.
  actual?: number // Historical value (undefined for future periods)
  forecast: number // Projected value
  isHistorical: boolean
  memoryAdjustment: number // Net impact from memories
  inflow: number // Gross inflow for this period
  outflow: number // Gross outflow for this period
  cumulativeCash: number // Running cash balance
  forecastBase?: number // Forecast without memory adjustments
  confidenceUpper?: number // Upper bound of confidence interval
  confidenceLower?: number // Lower bound of confidence interval
}

export interface ForecastLineItem {
  id: string
  name: string
  category:
    | 'operating'
    | 'investing'
    | 'financing'
    | 'memory-income'
    | 'memory-expense'
    | 'income'
    | 'cogs'
    | 'opex'
    | 'other-income'
    | 'other-expense'
  subcategory?: string
  historicalAvg: number
  values: Record<string, number> // { "period_0": 1000, "period_1": 1200, ... }
  children?: ForecastLineItem[]
  level: number // Nesting level for display
  isSummary?: boolean // Is this a total/summary row
  isMemory?: boolean // Is this a scheduled memory event line item
}

export interface ScheduledMemory {
  id: string
  sourceMemoryId: string // Original memory ID for grouping (mem_xxx IDs contain underscores)
  type: 'income' | 'expense'
  description: string
  amount: number
  date: string
  recurring: boolean
  frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  enabled: boolean
  category?: string
}

export interface ForecastSummary {
  currentCash: number
  projectedEndingCash: number
  lowestCashPoint: {
    date: string
    amount: number
    periodIndex: number
  }
  highestCashPoint: {
    date: string
    amount: number
    periodIndex: number
  }
  runway: number | null // Months until cash runs out, null if infinite
  totalProjectedInflow: number
  totalProjectedOutflow: number
  netChange: number
  averageWeeklyBurn: number
  averageMonthlyBurn: number
}

export interface ForecastMemories {
  expenses: ScheduledMemory[]
  income: ScheduledMemory[]
  totalExpenseImpact: number
  totalIncomeImpact: number
  netImpact: number
}

export interface ForecastData {
  horizon: ForecastHorizon
  periods: ForecastPeriod[]
  lineItems: {
    cashFlow: ForecastLineItem[]
    profitLoss: ForecastLineItem[]
  }
  summary: ForecastSummary
  assumptions: ForecastAssumptions
  memories: ForecastMemories
  currency: string
  generated: string
  startDate: string
  endDate: string
}

export interface ForecastApiResponse {
  success: boolean
  data?: ForecastData
  error?: string
  message?: string
}

// Historical data types for internal calculation
export interface HistoricalPeriod {
  date: string
  inflow: number
  outflow: number
  net: number
  operating: number
  investing: number
  financing: number
}

export interface HistoricalCashFlowData {
  periods: HistoricalPeriod[]
  beginningCash: number
  currentCash: number
  currency: string
}

// Line item category labels
export const CASH_FLOW_CATEGORIES = {
  operating: 'Operating Activities',
  investing: 'Investing Activities',
  financing: 'Financing Activities',
  'memory-income': 'Memories: Scheduled Income',
  'memory-expense': 'Memories: Scheduled Expenses',
} as const

export const PROFIT_LOSS_CATEGORIES = {
  income: 'Income',
  cogs: 'Cost of Goods Sold',
  opex: 'Operating Expenses',
  'other-income': 'Other Income',
  'other-expense': 'Other Expenses',
  'memory-income': 'Memories: Scheduled Income',
  'memory-expense': 'Memories: Scheduled Expenses',
} as const
