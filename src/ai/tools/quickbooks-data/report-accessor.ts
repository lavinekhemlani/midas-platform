/**
 * QuickBooks Report Accessor Module
 *
 * Fetches and enriches QuickBooks reports for the AI tool system.
 * Integrates with existing enrichers and transformers to provide chart-ready data.
 *
 * Supported Reports:
 * - profit_loss: Profit & Loss Statement with KPIs and category breakdowns
 * - balance_sheet: Balance Sheet with liquidity and solvency ratios
 * - cash_flow: Cash Flow Statement with burn rate and runway metrics
 * - aged_receivables: Aged Receivables report with payment tracking
 * - aged_payables: Aged Payables report with vendor payment tracking
 * - financial_health: Composite financial health score
 * - sales: Invoice + SalesReceipt aggregation by customer
 * - bills: Bill aggregation by vendor with payment status
 */

import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import type { ProviderApiClient } from '@/lib/providers/apiClient'
import {
  transformProfitAndLoss,
  transformBalanceSheet,
  transformCashFlow,
  transformAgedReport,
  transformAgedReportDetail,
} from '@/quickbooks/reports/transformers'
import { enrichProfitAndLoss } from '@/quickbooks/reports/enrichers/profit-loss'
import { enrichBalanceSheet } from '@/quickbooks/reports/enrichers/balance-sheet'
import { enrichCashFlow } from '@/quickbooks/reports/enrichers/cash-flow'
import type { QBReportResponse } from '@/quickbooks/types/reports'
import {
  extractPnLMonthlyTrend,
  extractCashFlowMonthlyTrend,
  extractPnLLineItemMonthlyDetail,
  hasMonthlyData,
  type PnLLineItemMonthlyDetail,
} from './utils/monthly-extractor'
import { toTwoDecimals } from '@/lib/utils/financial/reportCalculations'

// ============================================================================
// Types
// ============================================================================

export interface ReportAccessorConfig {
  organizationId: string
  client: QuickBooksClient | ProviderApiClient
  currency: string
  organizationName?: string
}

export interface ReportParams {
  startDate?: string
  endDate?: string
  period?: string // e.g., 'last_month', 'last_quarter', 'ytd', 'last_year'
  accountingMethod?: 'Cash' | 'Accrual'
  summarizeBy?: 'Month' | 'Quarter' | 'Year' | 'Total'
}

export interface EnrichedReportResult {
  success: boolean
  reportType: string
  data: {
    kpis: Record<string, number>
    breakdown?: Array<{ name: string; value: number; percentage?: number }>
    /** Hierarchical revenue structure for proper parent-child aggregation */
    revenueHierarchy?: any[]
    /** Hierarchical expense structure for proper parent-child aggregation */
    expenseHierarchy?: any[]
    monthlyTrend?: any[]
    lineItemMonthlyDetail?: PnLLineItemMonthlyDetail
    details?: any
    activities?: any
    metadata?: any
  }
  summary?: Record<string, number | string>
  currency: string
  fromDate?: string
  toDate?: string
  asOfDate?: string
  generated: string
  error?: string
}

// ============================================================================
// Client Helpers
// ============================================================================

/**
 * Get a QuickBooksClient instance from the provided client
 * If the client is already a QuickBooksClient, return it
 * Otherwise, create a new QuickBooksClient instance
 */
function getQuickBooksClient(
  client: QuickBooksClient | ProviderApiClient,
  organizationId: string
): QuickBooksClient {
  // Check if it's already a QuickBooksClient by checking for the getReport method
  if ('getReport' in client && typeof client.getReport === 'function') {
    return client as QuickBooksClient
  }

  // Otherwise, create a new QuickBooksClient instance
  return new QuickBooksClient({ organizationId })
}

// ============================================================================
// Period Helpers
// ============================================================================

/**
 * Format a Date object to YYYY-MM-DD string using local timezone
 * IMPORTANT: Do NOT use toISOString() as it converts to UTC and can shift dates
 * across midnight boundaries (e.g., 11pm PST becomes next day in UTC)
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Convert period shorthand to date range
 * Uses local date formatting to avoid timezone conversion issues
 */
function periodToDateRange(period: string): { startDate: string; endDate: string } {
  const today = new Date()
  const endDate = formatLocalDate(today)
  let startDate: string

  switch (period.toLowerCase()) {
    case 'this_month': {
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      startDate = formatLocalDate(thisMonth)
      return { startDate, endDate }
    }
    case 'last_month': {
      // Use Date constructor for automatic year wraparound handling
      // When today.getMonth() = 0 (January), this correctly produces December of previous year
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      return {
        startDate: formatLocalDate(lastMonthStart),
        endDate: formatLocalDate(lastMonthEnd),
      }
    }
    case 'last_quarter': {
      const quarter = Math.floor(today.getMonth() / 3)
      // Handle Q1 (quarter=0) which needs to look back to Q4 of previous year
      const lastQuarterStart = new Date(today.getFullYear(), (quarter - 1) * 3, 1)
      const lastQuarterEnd = new Date(today.getFullYear(), quarter * 3, 0)
      return {
        startDate: formatLocalDate(lastQuarterStart),
        endDate: formatLocalDate(lastQuarterEnd),
      }
    }
    case 'ytd': {
      startDate = `${today.getFullYear()}-01-01`
      return { startDate, endDate }
    }
    case 'last_year': {
      const lastYear = today.getFullYear() - 1
      startDate = `${lastYear}-01-01`
      return {
        startDate,
        endDate: `${lastYear}-12-31`,
      }
    }
    case 'last_30_days': {
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      startDate = formatLocalDate(thirtyDaysAgo)
      return { startDate, endDate }
    }
    case 'last_90_days': {
      const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
      startDate = formatLocalDate(ninetyDaysAgo)
      return { startDate, endDate }
    }
    default:
      // Default to last month
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      return {
        startDate: formatLocalDate(lastMonthStart),
        endDate: formatLocalDate(lastMonthEnd),
      }
  }
}

// ============================================================================
// Report Fetchers
// ============================================================================

/**
 * Fetch and enrich Profit & Loss report
 */
async function fetchProfitAndLoss(
  params: ReportParams,
  config: ReportAccessorConfig
): Promise<EnrichedReportResult> {
  // Priority: explicit dates > period > default
  const { startDate, endDate } =
    params.startDate && params.endDate
      ? { startDate: params.startDate, endDate: params.endDate }
      : params.period
        ? periodToDateRange(params.period)
        : periodToDateRange('this_year')

  // Get a QuickBooksClient instance
  const qbClient = getQuickBooksClient(config.client, config.organizationId)

  // Fetch raw report using the client's method
  // Always request monthly breakdown for trend charts
  const rawReport = await qbClient.getProfitAndLoss({
    start_date: startDate,
    end_date: endDate,
    accounting_method: params.accountingMethod || 'Accrual',
    summarize_column_by: params.summarizeBy || 'Month',
  })

  // Transform to normalized format
  const normalized = transformProfitAndLoss(rawReport as QBReportResponse)

  // Extract monthly trend if report has monthly data
  let monthlyTrend: any[] = []
  let lineItemMonthlyDetail: PnLLineItemMonthlyDetail | undefined
  if (hasMonthlyData(normalized)) {
    monthlyTrend = extractPnLMonthlyTrend(normalized)
    lineItemMonthlyDetail = extractPnLLineItemMonthlyDetail(normalized)
  }

  // Convert to enricher-compatible format
  const enricherInput = {
    total_income: normalized.income.total,
    total_expenses: normalized.expenses.total,
    net_income: normalized.netIncome,
    gross_profit: normalized.grossProfit,
    cogs_total: normalized.costOfGoodsSold.total,
    other_income: normalized.otherIncome.total,
    other_expenses: normalized.otherExpenses.total,
    income: normalized.income,
    expenses: normalized.expenses,
    costOfGoodsSold: normalized.costOfGoodsSold,
    otherIncome: normalized.otherIncome,
    otherExpenses: normalized.otherExpenses,
  }

  // Enrich with KPIs
  const enriched = await enrichProfitAndLoss(enricherInput, config.organizationId, {
    startDate,
    endDate,
    currency: config.currency,
    organizationName: config.organizationName,
    includeDetails: true,
  })

  // Build chart-ready breakdown
  const breakdown =
    enriched.data.revenueByCategory?.map((item: any) => ({
      name: item.name,
      value: item.value,
      percentage: item.percentage,
    })) || []

  return {
    success: true,
    reportType: 'profit_loss',
    data: {
      kpis: enriched.data.kpis,
      breakdown,
      // Include hierarchy for proper parent-child aggregation
      // Agent should use revenueHierarchy when filtering by account category (e.g., Online/Offline)
      // as it has pre-calculated totals that avoid double-counting
      revenueHierarchy: enriched.data.revenueHierarchy,
      expenseHierarchy: enriched.data.expenseHierarchy,
      monthlyTrend,
      lineItemMonthlyDetail,
      details: enriched.data.detailedStatement,
      metadata: enriched.data.metadata,
    },
    summary: {
      totalRevenue: enriched.data.kpis.totalRevenue,
      totalExpenses: enriched.data.kpis.totalExpenses,
      netIncome: enriched.data.kpis.netIncome,
      profitMargin: enriched.data.kpis.profitMargin,
    },
    currency: config.currency,
    fromDate: startDate,
    toDate: endDate,
    generated: new Date().toISOString(),
  }
}

/**
 * Fetch and enrich Balance Sheet report
 */
async function fetchBalanceSheet(
  params: ReportParams,
  config: ReportAccessorConfig
): Promise<EnrichedReportResult> {
  const endDate = params.endDate || formatLocalDate(new Date())

  // Get a QuickBooksClient instance
  const qbClient = getQuickBooksClient(config.client, config.organizationId)

  // Fetch raw report using the client's method
  const rawReport = await qbClient.getBalanceSheet({
    end_date: endDate,
    accounting_method: params.accountingMethod || 'Accrual',
  })

  // Transform to normalized format
  const normalized = transformBalanceSheet(rawReport as QBReportResponse)

  // Debug: Log fetched balance sheet summary to help diagnose caching issues
  console.log(`[BalanceSheet:Debug] Fetched for date=${endDate}:`, {
    asOfDate: normalized.asOfDate,
    totalAssets: normalized.assets.total,
    totalLiabilities: normalized.liabilities.total,
    totalEquity: normalized.equity.total,
    requestedEndDate: endDate,
  })

  // Convert to enricher-compatible format
  const enricherInput = {
    reportDate: normalized.asOfDate,
    total_assets: normalized.assets.total,
    total_liabilities: normalized.liabilities.total,
    total_equity: normalized.equity.total,
    current_assets: normalized.assets.current.total,
    current_liabilities: normalized.liabilities.current.total,
    assets: [
      ...normalized.assets.current.lines.map((line) => ({
        name: line.name,
        value: line.total,
        classification: 'current' as const,
      })),
      ...normalized.assets.fixed.lines.map((line) => ({
        name: line.name,
        value: line.total,
        classification: 'non-current' as const,
      })),
      ...normalized.assets.other.lines.map((line) => ({
        name: line.name,
        value: line.total,
        classification: 'non-current' as const,
      })),
    ],
    liabilities: [
      ...normalized.liabilities.current.lines.map((line) => ({
        name: line.name,
        value: line.total,
        classification: 'current' as const,
      })),
      ...normalized.liabilities.longTerm.lines.map((line) => ({
        name: line.name,
        value: line.total,
        classification: 'non-current' as const,
      })),
    ],
    equity: normalized.equity.lines.map((line) => ({
      name: line.name,
      value: line.total,
    })),
  }

  // Fetch P&L data for ROA/ROE calculations
  let profitAndLossData: { total_income: number; net_income: number } | undefined
  try {
    // Calculate year-to-date range (January 1st to endDate)
    const yearStart = new Date(endDate)
    yearStart.setMonth(0, 1) // January 1st of the same year
    const startDate = formatLocalDate(yearStart)

    // Fetch P&L report using the client's method
    const rawPL = await qbClient.getProfitAndLoss({
      start_date: startDate,
      end_date: endDate,
      accounting_method: params.accountingMethod || 'Accrual',
    })

    // Transform to normalized format
    const normalizedPL = transformProfitAndLoss(rawPL as QBReportResponse)

    // Extract data for enrichment
    profitAndLossData = {
      total_income: normalizedPL.income.total,
      net_income: normalizedPL.netIncome,
    }
  } catch (error) {
    // Log error but continue without P&L data (ROA/ROE will be excluded)
    console.warn('[Balance Sheet] Failed to fetch P&L data for ROA/ROE:', error)
  }

  // Enrich with KPIs (with P&L data for ROA/ROE if available)
  const enriched = enrichBalanceSheet(enricherInput, profitAndLossData, config.currency)

  // Build chart-ready breakdown
  const breakdown = enriched.data.assetComposition.map((item) => ({
    name: item.name,
    value: item.value,
    percentage: item.percentage,
  }))

  // Normalize KPIs to snake_case for AI handler compatibility
  const normalizedKpis: Record<string, number> = {
    total_assets: enriched.data.kpis.totalAssets,
    total_liabilities: enriched.data.kpis.totalLiabilities,
    total_equity: enriched.data.kpis.totalEquity,
    working_capital: enriched.data.kpis.workingCapital,
    current_assets: enriched.data.kpis.currentAssets,
    current_liabilities: enriched.data.kpis.currentLiabilities,
    inventory: enriched.data.kpis.inventory,
    current_ratio: enriched.data.kpis.currentRatio,
    debt_to_equity: enriched.data.kpis.debtToEquity,
    quick_ratio: enriched.data.kpis.quickRatio,
    roa: enriched.data.kpis.roa,
  }

  return {
    success: true,
    reportType: 'balance_sheet',
    data: {
      kpis: normalizedKpis,
      breakdown,
      details: {
        assets: enriched.data.assetComposition,
        liabilities: enriched.data.liabilityBreakdown,
        equity: enriched.data.equityComposition,
      },
      metadata: enriched.data.ratios,
    },
    summary: {
      totalAssets: enriched.data.kpis.totalAssets,
      totalLiabilities: enriched.data.kpis.totalLiabilities,
      totalEquity: enriched.data.kpis.totalEquity,
      currentRatio: enriched.data.kpis.currentRatio,
      debtToEquity: enriched.data.kpis.debtToEquity,
    },
    currency: config.currency,
    asOfDate: endDate,
    generated: new Date().toISOString(),
  }
}

/**
 * Fetch and enrich Cash Flow report
 */
async function fetchCashFlow(
  params: ReportParams,
  config: ReportAccessorConfig
): Promise<EnrichedReportResult> {
  // Priority: explicit dates > period > default
  const { startDate, endDate } =
    params.startDate && params.endDate
      ? { startDate: params.startDate, endDate: params.endDate }
      : params.period
        ? periodToDateRange(params.period)
        : periodToDateRange('this_year')

  // Get a QuickBooksClient instance
  const qbClient = getQuickBooksClient(config.client, config.organizationId)

  // Fetch raw report using the client's method
  // Always request monthly breakdown for cash flow reports to enable trend charts
  const rawReport = await qbClient.getCashFlow({
    start_date: startDate,
    end_date: endDate,
    summarize_column_by: params.summarizeBy || 'Month',
  })

  // Transform to normalized format
  const normalizedCashFlow = transformCashFlow(rawReport as QBReportResponse)

  // Extract monthly trend if report has monthly data
  // Always extract if available - don't require summarizeBy to be set
  let monthlyTrend: any[] = []
  if (hasMonthlyData(normalizedCashFlow)) {
    monthlyTrend = extractCashFlowMonthlyTrend(normalizedCashFlow)
  }

  // Fetch P&L for enrichment using the client's method
  const rawPL = await qbClient.getProfitAndLoss({
    start_date: startDate,
    end_date: endDate,
    accounting_method: params.accountingMethod || 'Accrual',
  })
  const normalizedPL = transformProfitAndLoss(rawPL as QBReportResponse)

  const profitAndLoss = {
    total_income: normalizedPL.income.total,
    total_expenses: normalizedPL.expenses.total,
    net_income: normalizedPL.netIncome,
    cogs_total: normalizedPL.costOfGoodsSold.total,
    other_expenses: normalizedPL.otherExpenses.total,
  }

  // Enrich with KPIs and metrics
  const enriched = await enrichCashFlow({
    organizationId: config.organizationId,
    normalizedCashFlow,
    profitAndLoss,
    includeDetails: true,
  })

  // Build chart-ready breakdown (waterfall chart data)
  const breakdown = enriched.waterfallChart.map((item) => ({
    name: item.name,
    value: item.value,
  }))

  // Merge kpis and cashMetrics so AI handler can access all metrics from kpis
  const mergedKpis: Record<string, number> = {
    ...(enriched.kpis as unknown as Record<string, number>),
    // Include cash metrics directly in kpis for AI accessibility
    runway_months: enriched.cashMetrics.runway_months,
    operating_cash_flow_ratio: enriched.cashMetrics.operating_cash_flow_ratio,
    cash_conversion_cycle: enriched.cashMetrics.cash_conversion_cycle,
    cash_flow_coverage_ratio: enriched.cashMetrics.cash_flow_coverage_ratio ?? 0,
    burn_rate: enriched.cashMetrics.burn_rate,
    days_cash: enriched.cashMetrics.days_cash,
    free_cash_flow: enriched.cashMetrics.free_cash_flow,
    operating_cash_flow_margin: enriched.cashMetrics.operating_cash_flow_margin ?? 0,
  }

  return {
    success: true,
    reportType: 'cash_flow',
    data: {
      kpis: mergedKpis,
      breakdown,
      monthlyTrend,
      activities: {
        operating: enriched.operatingActivities,
        investing: enriched.investingActivities,
        financing: enriched.financingActivities,
      },
      metadata: enriched.cashMetrics,
    },
    summary: {
      operatingCashFlow: enriched.kpis.operatingCashFlow,
      netCashFlow: enriched.kpis.netCashFlow,
      cashEnding: enriched.kpis.cashEnding,
      burnRate: enriched.cashMetrics.burn_rate,
      runwayMonths: enriched.cashMetrics.runway_months,
    },
    currency: config.currency,
    fromDate: startDate,
    toDate: endDate,
    generated: new Date().toISOString(),
  }
}

/**
 * Fetch Aged Receivables report
 */
async function fetchAgedReceivables(
  params: ReportParams,
  config: ReportAccessorConfig
): Promise<EnrichedReportResult> {
  const reportDate = params.endDate || formatLocalDate(new Date())

  // Get a QuickBooksClient instance
  const qbClient = getQuickBooksClient(config.client, config.organizationId)

  // Fetch raw report
  const rawReport = await qbClient.getReport('AgedReceivables', {
    report_date: reportDate,
    aging_period: '30',
    num_periods: '4',
  })

  // Transform to normalized format
  const normalized = transformAgedReport(rawReport as QBReportResponse)

  // Build chart-ready breakdown by period
  const breakdown = normalized.periods.map((period) => ({
    name: period,
    value: toTwoDecimals(normalized.totals[period] || 0),
    percentage: toTwoDecimals(
      normalized.grandTotal > 0 ? (normalized.totals[period] / normalized.grandTotal) * 100 : 0
    ),
  }))

  // Calculate KPIs
  const current = normalized.totals[normalized.periods[0]] || 0
  const overdue = normalized.grandTotal - current
  const overduePercentage = normalized.grandTotal > 0 ? (overdue / normalized.grandTotal) * 100 : 0

  return {
    success: true,
    reportType: 'aged_receivables',
    data: {
      kpis: {
        total: toTwoDecimals(normalized.grandTotal),
        current: toTwoDecimals(current),
        overdue: toTwoDecimals(overdue),
        overduePercentage: toTwoDecimals(overduePercentage),
      },
      breakdown,
      details: normalized.lines,
    },
    summary: {
      totalReceivables: toTwoDecimals(normalized.grandTotal),
      currentReceivables: toTwoDecimals(current),
      overdueReceivables: toTwoDecimals(overdue),
      overduePercentage: toTwoDecimals(overduePercentage),
    },
    currency: config.currency,
    asOfDate: reportDate,
    generated: new Date().toISOString(),
  }
}

/**
 * Fetch Aged Payables report
 */
async function fetchAgedPayables(
  params: ReportParams,
  config: ReportAccessorConfig
): Promise<EnrichedReportResult> {
  const reportDate = params.endDate || formatLocalDate(new Date())

  // Get a QuickBooksClient instance
  const qbClient = getQuickBooksClient(config.client, config.organizationId)

  // Fetch raw report
  const rawReport = await qbClient.getReport('AgedPayables', {
    report_date: reportDate,
    aging_period: '30',
    num_periods: '4',
  })

  // Transform to normalized format
  const normalized = transformAgedReport(rawReport as QBReportResponse)

  // Build chart-ready breakdown by period
  const breakdown = normalized.periods.map((period) => ({
    name: period,
    value: toTwoDecimals(normalized.totals[period] || 0),
    percentage: toTwoDecimals(
      normalized.grandTotal > 0 ? (normalized.totals[period] / normalized.grandTotal) * 100 : 0
    ),
  }))

  // Calculate KPIs
  const current = normalized.totals[normalized.periods[0]] || 0
  const overdue = normalized.grandTotal - current
  const overduePercentage = normalized.grandTotal > 0 ? (overdue / normalized.grandTotal) * 100 : 0

  return {
    success: true,
    reportType: 'aged_payables',
    data: {
      kpis: {
        total: toTwoDecimals(normalized.grandTotal),
        current: toTwoDecimals(current),
        overdue: toTwoDecimals(overdue),
        overduePercentage: toTwoDecimals(overduePercentage),
      },
      breakdown,
      details: normalized.lines,
    },
    summary: {
      totalPayables: toTwoDecimals(normalized.grandTotal),
      currentPayables: toTwoDecimals(current),
      overduePayables: toTwoDecimals(overdue),
      overduePercentage: toTwoDecimals(overduePercentage),
    },
    currency: config.currency,
    asOfDate: reportDate,
    generated: new Date().toISOString(),
  }
}

/**
 * Fetch Aged Receivables Detail report (with invoice-level details)
 */
async function fetchAgedReceivablesDetail(
  params: ReportParams,
  config: ReportAccessorConfig
): Promise<EnrichedReportResult> {
  const reportDate = params.endDate || formatLocalDate(new Date())

  // Get a QuickBooksClient instance
  const qbClient = getQuickBooksClient(config.client, config.organizationId)

  // Fetch raw detail report
  const rawReport = await qbClient.getReport('AgedReceivableDetail', {
    report_date: reportDate,
    aging_period: '30',
    num_periods: '4',
  })

  // Transform to normalized format with transaction details
  const normalized = transformAgedReportDetail(rawReport as QBReportResponse)

  // Build chart-ready breakdown by period
  const breakdown = normalized.periods.map((period) => ({
    name: period,
    value: toTwoDecimals(normalized.totals[period] || 0),
    percentage: toTwoDecimals(
      normalized.grandTotal > 0 ? (normalized.totals[period] / normalized.grandTotal) * 100 : 0
    ),
  }))

  // Calculate KPIs
  const current = normalized.totals[normalized.periods[0]] || 0
  const overdue = normalized.grandTotal - current
  const overduePercentage = normalized.grandTotal > 0 ? (overdue / normalized.grandTotal) * 100 : 0

  // Calculate average days past due from transactions
  let totalDaysPastDue = 0
  let countWithDays = 0
  for (const line of normalized.lines) {
    for (const txn of line.transactions) {
      if (txn.daysPastDue !== undefined && txn.daysPastDue > 0) {
        totalDaysPastDue += txn.daysPastDue
        countWithDays++
      }
    }
  }
  const avgDaysPastDue = countWithDays > 0 ? totalDaysPastDue / countWithDays : 0

  return {
    success: true,
    reportType: 'aged_receivables_detail',
    data: {
      kpis: {
        total: toTwoDecimals(normalized.grandTotal),
        current: toTwoDecimals(current),
        overdue: toTwoDecimals(overdue),
        overduePercentage: toTwoDecimals(overduePercentage),
        transactionCount: normalized.transactionCount,
        customerCount: normalized.lines.length,
        avgDaysPastDue: toTwoDecimals(avgDaysPastDue),
      },
      breakdown,
      details: normalized.lines,
    },
    summary: {
      totalReceivables: toTwoDecimals(normalized.grandTotal),
      currentReceivables: toTwoDecimals(current),
      overdueReceivables: toTwoDecimals(overdue),
      overduePercentage: toTwoDecimals(overduePercentage),
      transactionCount: normalized.transactionCount,
      customerCount: normalized.lines.length,
    },
    currency: config.currency,
    asOfDate: reportDate,
    generated: new Date().toISOString(),
  }
}

/**
 * Fetch Aged Payables Detail report (with bill-level details)
 */
async function fetchAgedPayablesDetail(
  params: ReportParams,
  config: ReportAccessorConfig
): Promise<EnrichedReportResult> {
  const reportDate = params.endDate || formatLocalDate(new Date())

  // Get a QuickBooksClient instance
  const qbClient = getQuickBooksClient(config.client, config.organizationId)

  // Fetch raw detail report
  const rawReport = await qbClient.getReport('AgedPayableDetail', {
    report_date: reportDate,
    aging_period: '30',
    num_periods: '4',
  })

  // Transform to normalized format with transaction details
  const normalized = transformAgedReportDetail(rawReport as QBReportResponse)

  // Build chart-ready breakdown by period
  const breakdown = normalized.periods.map((period) => ({
    name: period,
    value: toTwoDecimals(normalized.totals[period] || 0),
    percentage: toTwoDecimals(
      normalized.grandTotal > 0 ? (normalized.totals[period] / normalized.grandTotal) * 100 : 0
    ),
  }))

  // Calculate KPIs
  const current = normalized.totals[normalized.periods[0]] || 0
  const overdue = normalized.grandTotal - current
  const overduePercentage = normalized.grandTotal > 0 ? (overdue / normalized.grandTotal) * 100 : 0

  // Calculate average days past due from transactions
  let totalDaysPastDue = 0
  let countWithDays = 0
  for (const line of normalized.lines) {
    for (const txn of line.transactions) {
      if (txn.daysPastDue !== undefined && txn.daysPastDue > 0) {
        totalDaysPastDue += txn.daysPastDue
        countWithDays++
      }
    }
  }
  const avgDaysPastDue = countWithDays > 0 ? totalDaysPastDue / countWithDays : 0

  return {
    success: true,
    reportType: 'aged_payables_detail',
    data: {
      kpis: {
        total: toTwoDecimals(normalized.grandTotal),
        current: toTwoDecimals(current),
        overdue: toTwoDecimals(overdue),
        overduePercentage: toTwoDecimals(overduePercentage),
        transactionCount: normalized.transactionCount,
        vendorCount: normalized.lines.length,
        avgDaysPastDue: toTwoDecimals(avgDaysPastDue),
      },
      breakdown,
      details: normalized.lines,
    },
    summary: {
      totalPayables: toTwoDecimals(normalized.grandTotal),
      currentPayables: toTwoDecimals(current),
      overduePayables: toTwoDecimals(overdue),
      overduePercentage: toTwoDecimals(overduePercentage),
      transactionCount: normalized.transactionCount,
      vendorCount: normalized.lines.length,
    },
    currency: config.currency,
    asOfDate: reportDate,
    generated: new Date().toISOString(),
  }
}

/**
 * Fetch Sales report (Invoice + SalesReceipt aggregation by customer)
 */
async function fetchSales(
  params: ReportParams,
  config: ReportAccessorConfig
): Promise<EnrichedReportResult> {
  // Priority: explicit dates > period > default
  const { startDate, endDate } =
    params.startDate && params.endDate
      ? { startDate: params.startDate, endDate: params.endDate }
      : params.period
        ? periodToDateRange(params.period)
        : periodToDateRange('this_year')

  // Get a QuickBooksClient instance
  const qbClient = getQuickBooksClient(config.client, config.organizationId)

  // Fetch invoices, sales receipts, and customers in parallel
  const [invoicesResponse, salesReceiptsResponse, customersResponse] = await Promise.all([
    qbClient.query(
      `SELECT * FROM Invoice WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' ORDERBY TxnDate DESC MAXRESULTS 1000`
    ),
    qbClient.query(
      `SELECT * FROM SalesReceipt WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' ORDERBY TxnDate DESC MAXRESULTS 1000`
    ),
    qbClient.query('SELECT Id, DisplayName FROM Customer MAXRESULTS 1000'),
  ])

  const invoices = (invoicesResponse as any).QueryResponse?.Invoice || []
  const salesReceipts = (salesReceiptsResponse as any).QueryResponse?.SalesReceipt || []
  const customers = (customersResponse as any).QueryResponse?.Customer || []

  // Build customer lookup map
  const customerMap = new Map<string, string>()
  customers.forEach((c: any) => {
    customerMap.set(c.Id, c.DisplayName || c.CompanyName || 'Unknown')
  })

  // Aggregate sales by customer
  const customerSales: Record<
    string,
    {
      id: string
      name: string
      totalSales: number
      invoiceCount: number
      salesReceiptCount: number
      transactions: Array<{
        id: string
        type: 'Invoice' | 'SalesReceipt'
        date: string
        amount: number
        docNumber?: string
        dueDate?: string
        balance?: number
      }>
    }
  > = {}

  // Process invoices
  for (const invoice of invoices) {
    const customerId = invoice.CustomerRef?.value
    const customerName = invoice.CustomerRef?.name || customerMap.get(customerId) || 'Unknown'
    const amount = parseFloat(invoice.TotalAmt || '0')

    if (customerId) {
      if (!customerSales[customerId]) {
        customerSales[customerId] = {
          id: customerId,
          name: customerName,
          totalSales: 0,
          invoiceCount: 0,
          salesReceiptCount: 0,
          transactions: [],
        }
      }

      customerSales[customerId].totalSales += amount
      customerSales[customerId].invoiceCount += 1
      customerSales[customerId].transactions.push({
        id: invoice.Id,
        type: 'Invoice',
        date: invoice.TxnDate,
        amount,
        docNumber: invoice.DocNumber,
        dueDate: invoice.DueDate,
        balance: parseFloat(invoice.Balance || '0'),
      })
    }
  }

  // Process sales receipts
  for (const receipt of salesReceipts) {
    const customerId = receipt.CustomerRef?.value
    const customerName = receipt.CustomerRef?.name || customerMap.get(customerId) || 'Unknown'
    const amount = parseFloat(receipt.TotalAmt || '0')

    if (customerId) {
      if (!customerSales[customerId]) {
        customerSales[customerId] = {
          id: customerId,
          name: customerName,
          totalSales: 0,
          invoiceCount: 0,
          salesReceiptCount: 0,
          transactions: [],
        }
      }

      customerSales[customerId].totalSales += amount
      customerSales[customerId].salesReceiptCount += 1
      customerSales[customerId].transactions.push({
        id: receipt.Id,
        type: 'SalesReceipt',
        date: receipt.TxnDate,
        amount,
        docNumber: receipt.DocNumber,
      })
    }
  }

  // Convert to array and sort by total sales (descending)
  const salesByCustomer = Object.values(customerSales).sort((a, b) => b.totalSales - a.totalSales)

  // Calculate KPIs
  const totalSales = salesByCustomer.reduce((sum, c) => sum + c.totalSales, 0)
  const invoiceCount = invoices.length
  const salesReceiptCount = salesReceipts.length
  const totalTransactions = invoiceCount + salesReceiptCount
  const customerCount = salesByCustomer.length
  const avgDealSize = totalTransactions > 0 ? totalSales / totalTransactions : 0
  const topCustomer = salesByCustomer[0]

  // Build chart-ready breakdown (top 10 customers)
  const breakdown = salesByCustomer.slice(0, 10).map((customer) => ({
    name: customer.name,
    value: toTwoDecimals(customer.totalSales),
    percentage: toTwoDecimals(totalSales > 0 ? (customer.totalSales / totalSales) * 100 : 0),
  }))

  // Build sales by type breakdown
  const invoiceTotal = invoices.reduce(
    (sum: number, inv: any) => sum + parseFloat(inv.TotalAmt || '0'),
    0
  )
  const salesReceiptTotal = salesReceipts.reduce(
    (sum: number, sr: any) => sum + parseFloat(sr.TotalAmt || '0'),
    0
  )

  return {
    success: true,
    reportType: 'sales',
    data: {
      kpis: {
        totalSales: toTwoDecimals(totalSales),
        invoiceCount,
        salesReceiptCount,
        totalTransactions,
        customerCount,
        avgDealSize: toTwoDecimals(avgDealSize),
        topCustomerSales: toTwoDecimals(topCustomer?.totalSales || 0),
        invoiceTotal: toTwoDecimals(invoiceTotal),
        salesReceiptTotal: toTwoDecimals(salesReceiptTotal),
      },
      breakdown,
      details: {
        salesByCustomer,
        salesByType: [
          { name: 'Invoices', value: toTwoDecimals(invoiceTotal), count: invoiceCount },
          {
            name: 'Sales Receipts',
            value: toTwoDecimals(salesReceiptTotal),
            count: salesReceiptCount,
          },
        ],
      },
      metadata: {
        topCustomerName: topCustomer?.name || null,
        dataSource: 'Invoice + SalesReceipt aggregation',
      },
    },
    summary: {
      totalSales: toTwoDecimals(totalSales),
      invoiceCount,
      salesReceiptCount,
      customerCount,
      avgDealSize: toTwoDecimals(avgDealSize),
    },
    currency: config.currency,
    fromDate: startDate,
    toDate: endDate,
    generated: new Date().toISOString(),
  }
}

/**
 * Fetch Bills report (Bill aggregation by vendor with payment status)
 */
async function fetchBills(
  params: ReportParams,
  config: ReportAccessorConfig
): Promise<EnrichedReportResult> {
  // Priority: explicit dates > period > default
  const { startDate, endDate } =
    params.startDate && params.endDate
      ? { startDate: params.startDate, endDate: params.endDate }
      : params.period
        ? periodToDateRange(params.period)
        : periodToDateRange('this_year')

  // Get a QuickBooksClient instance
  const qbClient = getQuickBooksClient(config.client, config.organizationId)

  // Fetch bills and vendors in parallel
  const [billsResponse, vendorsResponse] = await Promise.all([
    qbClient.query(
      `SELECT * FROM Bill WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' ORDERBY TxnDate DESC MAXRESULTS 1000`
    ),
    qbClient.query('SELECT Id, DisplayName FROM Vendor MAXRESULTS 1000'),
  ])

  const bills = (billsResponse as any).QueryResponse?.Bill || []
  const vendors = (vendorsResponse as any).QueryResponse?.Vendor || []

  // Build vendor lookup map
  const vendorMap = new Map<string, string>()
  vendors.forEach((v: any) => {
    vendorMap.set(v.Id, v.DisplayName || v.CompanyName || 'Unknown')
  })

  // Aggregate bills by vendor
  const vendorBills: Record<
    string,
    {
      id: string
      name: string
      totalBills: number
      unpaidAmount: number
      paidAmount: number
      billCount: number
      transactions: Array<{
        id: string
        date: string
        amount: number
        balance: number
        docNumber?: string
        dueDate?: string
        status: 'paid' | 'unpaid' | 'partial'
      }>
    }
  > = {}

  // Process bills
  for (const bill of bills) {
    const vendorId = bill.VendorRef?.value
    const vendorName = bill.VendorRef?.name || vendorMap.get(vendorId) || 'Unknown'
    const amount = parseFloat(bill.TotalAmt || '0')
    const balance = parseFloat(bill.Balance || '0')

    if (vendorId) {
      if (!vendorBills[vendorId]) {
        vendorBills[vendorId] = {
          id: vendorId,
          name: vendorName,
          totalBills: 0,
          unpaidAmount: 0,
          paidAmount: 0,
          billCount: 0,
          transactions: [],
        }
      }

      vendorBills[vendorId].totalBills += amount
      vendorBills[vendorId].unpaidAmount += balance
      vendorBills[vendorId].paidAmount += amount - balance
      vendorBills[vendorId].billCount += 1

      // Determine status
      let status: 'paid' | 'unpaid' | 'partial' = 'unpaid'
      if (balance === 0) status = 'paid'
      else if (balance < amount) status = 'partial'

      vendorBills[vendorId].transactions.push({
        id: bill.Id,
        date: bill.TxnDate,
        amount,
        balance,
        docNumber: bill.DocNumber,
        dueDate: bill.DueDate,
        status,
      })
    }
  }

  // Convert to array and sort by total bills (descending)
  const billsByVendor = Object.values(vendorBills).sort((a, b) => b.totalBills - a.totalBills)

  // Calculate KPIs
  const totalBills = billsByVendor.reduce((sum, v) => sum + v.totalBills, 0)
  const unpaidAmount = billsByVendor.reduce((sum, v) => sum + v.unpaidAmount, 0)
  const paidAmount = totalBills - unpaidAmount
  const billCount = bills.length
  const vendorCount = billsByVendor.length
  const avgBillSize = billCount > 0 ? totalBills / billCount : 0
  const topVendor = billsByVendor[0]

  // Count by status
  const paidCount = bills.filter((b: any) => parseFloat(b.Balance || '0') === 0).length
  const unpaidCount = bills.filter((b: any) => parseFloat(b.Balance || '0') > 0).length

  // Build chart-ready breakdown (top 10 vendors)
  const breakdown = billsByVendor.slice(0, 10).map((vendor) => ({
    name: vendor.name,
    value: toTwoDecimals(vendor.totalBills),
    percentage: toTwoDecimals(totalBills > 0 ? (vendor.totalBills / totalBills) * 100 : 0),
  }))

  return {
    success: true,
    reportType: 'bills',
    data: {
      kpis: {
        totalBills: toTwoDecimals(totalBills),
        unpaidAmount: toTwoDecimals(unpaidAmount),
        paidAmount: toTwoDecimals(paidAmount),
        billCount,
        vendorCount,
        avgBillSize: toTwoDecimals(avgBillSize),
        paidCount,
        unpaidCount,
        topVendorAmount: toTwoDecimals(topVendor?.totalBills || 0),
      },
      breakdown,
      details: {
        billsByVendor,
        billsByStatus: [
          { name: 'Paid', value: toTwoDecimals(paidAmount), count: paidCount },
          { name: 'Unpaid', value: toTwoDecimals(unpaidAmount), count: unpaidCount },
        ],
      },
      metadata: {
        topVendorName: topVendor?.name || null,
        dataSource: 'Bill entity aggregation',
      },
    },
    summary: {
      totalBills: toTwoDecimals(totalBills),
      unpaidAmount: toTwoDecimals(unpaidAmount),
      paidAmount: toTwoDecimals(paidAmount),
      vendorCount,
      avgBillSize: toTwoDecimals(avgBillSize),
    },
    currency: config.currency,
    fromDate: startDate,
    toDate: endDate,
    generated: new Date().toISOString(),
  }
}

/**
 * Calculate composite financial health score
 */
async function fetchFinancialHealth(
  params: ReportParams,
  config: ReportAccessorConfig
): Promise<EnrichedReportResult> {
  // Priority: explicit dates > period > default
  const { startDate, endDate } =
    params.startDate && params.endDate
      ? { startDate: params.startDate, endDate: params.endDate }
      : params.period
        ? periodToDateRange(params.period)
        : periodToDateRange('this_year')

  // Fetch all core reports
  const [plResult, bsResult, cfResult] = await Promise.all([
    fetchProfitAndLoss({ startDate, endDate, accountingMethod: params.accountingMethod }, config),
    fetchBalanceSheet({ endDate, accountingMethod: params.accountingMethod }, config),
    fetchCashFlow({ startDate, endDate, accountingMethod: params.accountingMethod }, config),
  ])

  // Extract key metrics
  const profitMargin = plResult.data.kpis.profitMargin || 0
  const currentRatio = bsResult.data.kpis.currentRatio || 0
  const debtToEquity = bsResult.data.kpis.debtToEquity || 0
  const runwayMonths = cfResult.data.metadata?.runway_months || 0

  // Calculate health score (0-100)
  let score = 0

  // Profitability (30 points)
  if (profitMargin > 20) score += 30
  else if (profitMargin > 10) score += 20
  else if (profitMargin > 0) score += 10

  // Liquidity (30 points)
  if (currentRatio > 2) score += 30
  else if (currentRatio > 1.5) score += 20
  else if (currentRatio > 1) score += 10

  // Solvency (20 points)
  if (debtToEquity < 0.5) score += 20
  else if (debtToEquity < 1) score += 15
  else if (debtToEquity < 2) score += 10

  // Runway (20 points)
  if (runwayMonths > 12) score += 20
  else if (runwayMonths > 6) score += 15
  else if (runwayMonths > 3) score += 10

  // Determine health status
  let status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  if (score >= 80) status = 'excellent'
  else if (score >= 60) status = 'good'
  else if (score >= 40) status = 'fair'
  else if (score >= 20) status = 'poor'
  else status = 'critical'

  return {
    success: true,
    reportType: 'financial_health',
    data: {
      kpis: {
        score,
        profitMargin,
        currentRatio,
        debtToEquity,
        runwayMonths,
      },
      breakdown: [
        { name: 'Profitability', value: profitMargin },
        { name: 'Liquidity', value: currentRatio },
        { name: 'Solvency', value: 1 / (debtToEquity || 1) },
        { name: 'Runway', value: runwayMonths },
      ],
      details: {
        profitLoss: plResult.summary,
        balanceSheet: bsResult.summary,
        cashFlow: cfResult.summary,
      },
    },
    summary: {
      healthScore: score,
      status,
      profitMargin,
      currentRatio,
      debtToEquity,
      runwayMonths,
    },
    currency: config.currency,
    fromDate: startDate,
    toDate: endDate,
    generated: new Date().toISOString(),
  }
}

// ============================================================================
// Main Accessor Function
// ============================================================================

/**
 * Fetch and enrich QuickBooks report
 *
 * @param reportType - Type of report to fetch
 * @param params - Report parameters (dates, period, etc.)
 * @param config - Accessor configuration (client, organization, etc.)
 * @returns Enriched report with chart-ready data
 */
export async function fetchEnrichedReport(
  reportType: string,
  params: ReportParams,
  config: ReportAccessorConfig
): Promise<EnrichedReportResult> {
  try {
    switch (reportType.toLowerCase()) {
      case 'profit_loss':
      case 'profitandloss':
      case 'income_statement':
        return await fetchProfitAndLoss(params, config)

      case 'balance_sheet':
      case 'balancesheet':
        return await fetchBalanceSheet(params, config)

      case 'cash_flow':
      case 'cashflow':
        return await fetchCashFlow(params, config)

      case 'aged_receivables':
      case 'agedreceivables':
        return await fetchAgedReceivables(params, config)

      case 'aged_payables':
      case 'agedpayables':
        return await fetchAgedPayables(params, config)

      case 'aged_receivables_detail':
      case 'agedreceivabledetail':
        return await fetchAgedReceivablesDetail(params, config)

      case 'aged_payables_detail':
      case 'agedpayabledetail':
        return await fetchAgedPayablesDetail(params, config)

      case 'financial_health':
      case 'financialhealth':
        return await fetchFinancialHealth(params, config)

      case 'sales':
        return await fetchSales(params, config)

      case 'bills':
        return await fetchBills(params, config)

      default:
        return {
          success: false,
          reportType,
          data: { kpis: {} },
          currency: config.currency,
          generated: new Date().toISOString(),
          error: `Unsupported report type: ${reportType}. Supported types: profit_loss, balance_sheet, cash_flow, aged_receivables, aged_receivables_detail, aged_payables, aged_payables_detail, financial_health, sales, bills`,
        }
    }
  } catch (error: any) {
    return {
      success: false,
      reportType,
      data: { kpis: {} },
      currency: config.currency,
      generated: new Date().toISOString(),
      error: error.message || 'Failed to fetch report',
    }
  }
}
