/**
 * Executive Summary Report Enricher
 *
 * Aggregates data from P&L, Balance Sheet, and Cash Flow reports to create
 * a comprehensive executive summary with:
 * - High-level KPIs (revenue, profit, expenses, cash flow)
 * - Financial health score
 * - Revenue and expense breakdowns
 * - Cash flow waterfall
 * - Working capital summary
 * - Insights and recommendations
 */

import {
  calculateKeyMetrics,
  calculateFinancialHealthScore,
  parseBreakdowns,
  generateInsights,
} from '@/quickbooks/utils/report-helpers'

interface ExecutiveSummaryOptions {
  organizationId: string
  organizationName: string
  currency: string
  period: string
  fromDate: string
  toDate: string
  prevFromDate: string
  prevToDate: string
  profitAndLoss: any
  previousProfitAndLoss?: any
  balanceSheet?: any
  cashFlow?: any
  receivables?: any
  payables?: any
}

export async function enrichExecutiveSummary(options: ExecutiveSummaryOptions) {
  const {
    organizationId,
    organizationName,
    currency,
    period,
    fromDate,
    toDate,
    prevFromDate,
    prevToDate,
    profitAndLoss: pnl,
    previousProfitAndLoss: previousPnl,
    balanceSheet,
    cashFlow,
    receivables,
    payables,
  } = options

  // Calculate key metrics from actual data
  const metrics = calculateKeyMetrics(pnl, balanceSheet, cashFlow, receivables, payables)
  const previousMetrics = previousPnl
    ? calculateKeyMetrics(previousPnl, null, null, null, null)
    : null

  // Calculate financial health score
  const financialHealth = calculateFinancialHealthScore(metrics)

  // Parse revenue and expense breakdowns
  const { revenueBreakdown, expenseBreakdown } = parseBreakdowns(pnl)

  // Generate insights
  const insights = generateInsights(metrics, previousMetrics, currency)

  // Calculate changes and comparisons
  const revenueChange = previousMetrics
    ? metrics.revenue.current - previousMetrics.revenue.current
    : 0
  const revenueChangePercent =
    previousMetrics && previousMetrics.revenue.current > 0
      ? (revenueChange / previousMetrics.revenue.current) * 100
      : 0

  const expenseChange = previousMetrics
    ? metrics.expenses.current - previousMetrics.expenses.current
    : 0
  const expenseChangePercent =
    previousMetrics && previousMetrics.expenses.current > 0
      ? (expenseChange / previousMetrics.expenses.current) * 100
      : 0

  const profitChange = previousMetrics
    ? metrics.profitability.netIncome - previousMetrics.profitability.netIncome
    : 0
  const profitChangePercent =
    previousMetrics && previousMetrics.profitability.netIncome !== 0
      ? (profitChange / Math.abs(previousMetrics.profitability.netIncome)) * 100
      : 0

  // Build executive summary response
  const executiveSummary = {
    period,
    generatedAt: new Date().toISOString(),
    organization: organizationName,
    currency,

    // High-level KPIs
    keyMetrics: {
      revenue: {
        current: metrics.revenue.current,
        previous: previousMetrics?.revenue.current || 0,
        change: revenueChange,
        changePercent: revenueChangePercent,
        grossProfit: metrics.revenue.grossProfit,
        grossMargin: metrics.revenue.grossMargin,
        netMargin: metrics.revenue.netMargin,
      },
      profit: {
        current: metrics.profitability.netIncome,
        previous: previousMetrics?.profitability.netIncome || 0,
        change: profitChange,
        changePercent: profitChangePercent,
        margin: metrics.profitability.netMargin,
        ebitda: metrics.profitability.ebitda,
      },
      expenses: {
        current: metrics.expenses.current,
        previous: previousMetrics?.expenses.current || 0,
        change: expenseChange,
        changePercent: expenseChangePercent,
        ratio: metrics.expenses.ratio,
        burnRate: metrics.expenses.burnRate,
      },
      cashFlow: {
        current: metrics.cashFlow.netChange,
        operating: metrics.cashFlow.operating,
        investing: metrics.cashFlow.investing,
        financing: metrics.cashFlow.financing,
        netChange: metrics.cashFlow.netChange,
        runway: metrics.liquidity.runwayDays,
        burnRate: metrics.expenses.burnRate,
      },
    },

    // Financial Health Score
    financialHealth,

    // Revenue & Expense Breakdowns
    revenueBreakdown,
    expenseBreakdown,

    // Cash Flow Waterfall
    cashFlowWaterfall: [
      {
        name: 'Starting Cash',
        value: metrics.liquidity.cashBalance - metrics.cashFlow.netChange,
        type: 'initial',
      },
      {
        name: 'Operating Activities',
        value: metrics.cashFlow.operating,
        type: metrics.cashFlow.operating >= 0 ? 'positive' : 'negative',
      },
      {
        name: 'Investing Activities',
        value: metrics.cashFlow.investing,
        type: metrics.cashFlow.investing >= 0 ? 'positive' : 'negative',
      },
      {
        name: 'Financing Activities',
        value: metrics.cashFlow.financing,
        type: metrics.cashFlow.financing >= 0 ? 'positive' : 'negative',
      },
      { name: 'Ending Cash', value: metrics.liquidity.cashBalance, type: 'final' },
    ],

    // Working Capital Summary
    workingCapital: {
      accountsReceivable: {
        total: metrics.efficiency.totalReceivables,
        dso: metrics.efficiency.receivablesDays,
      },
      accountsPayable: {
        total: metrics.efficiency.totalPayables,
        dpo: metrics.efficiency.payablesDays,
      },
      netWorkingCapital: metrics.liquidity.workingCapital,
    },

    // Insights
    insights,

    // Balance Sheet Summary
    balanceSheet: {
      totalAssets: metrics.balanceSheet.totalAssets,
      totalLiabilities: metrics.balanceSheet.totalLiabilities,
      totalEquity: metrics.balanceSheet.totalEquity,
      currentRatio: metrics.liquidity.currentRatio,
      quickRatio: metrics.liquidity.quickRatio,
    },

    // Period Information
    reportPeriod: {
      startDate: fromDate,
      endDate: toDate,
      previousStartDate: prevFromDate,
      previousEndDate: prevToDate,
    },
  }

  return {
    reportType: 'executive_summary',
    organizationId,
    organizationName,
    currency,
    generated: new Date().toISOString(),
    data: executiveSummary,
    metadata: {
      dataAvailability: {
        profitLoss: !!pnl,
        balanceSheet: !!balanceSheet,
        cashFlow: !!cashFlow,
        receivables: !!receivables,
        payables: !!payables,
      },
      dataQuality: {
        isComplete: !!pnl && !!balanceSheet && !!cashFlow,
        hasPartialData: !pnl || !balanceSheet || !cashFlow,
        warnings: [],
      },
    },
  }
}
