/**
 * Report Helper Functions
 *
 * Shared utility functions for QuickBooks reports including:
 * - Key metrics calculation
 * - Financial health scoring
 * - Report data parsing and breakdowns
 * - Insight generation
 * - EBITDA calculations
 * - P&L insights and statements
 * - Data validation
 * - Cash flow metrics
 * - Date formatting and ranges
 */

import {
  formatDate as formatDateUtil,
  formatReportDate as formatReportDateUtil,
  formatCurrency as formatCurrencyUtil,
} from '@/lib/utils/financial'
import {
  safeDivide,
  validateCurrency,
  validatePercentage,
  calculateMetricSafely,
} from '@/lib/utils/metricValidation'

// Re-export core financial utilities for convenience
export {
  formatDate,
  formatReportDate,
  getDateRange,
  getDateRangeByDays as getDateRange2,
  getLastQuarters,
  getLastMonths,
  getDefaultCashFlowStartDate,
  getDefaultCashFlowEndDate,
  getAgingBucket,
} from '@/lib/utils/financial/dateHelpers'

export { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils/financial/formatting'

export { calculatePercentage } from '@/lib/utils/financial/calculations'

export {
  calculateDaysOutstanding,
  calculateGrossMargin,
  calculateNetMargin,
  calculateCurrentRatio,
  calculateQuickRatio,
  calculateDebtToEquity,
  calculateROA,
  calculateROE,
  calculateWorkingCapital,
  calculateVariance,
  calculateGrowthRate,
} from '@/lib/utils/financial/calculations'

// ===== EXECUTIVE SUMMARY HELPERS =====

/**
 * Calculate key financial metrics from reports
 */
export function calculateKeyMetrics(
  pnl: any,
  balanceSheet: any,
  cashFlow: any,
  receivables: any,
  payables: any
) {
  const revenue = pnl?.total_income || 0
  const expenses = pnl?.total_expenses || 0
  const netIncome = pnl?.net_income || 0
  const grossProfit = pnl?.gross_profit || revenue - (pnl?.cost_of_goods_sold || 0)

  // Financial ratios with validation
  const grossMarginResult = safeDivide(grossProfit * 100, revenue, 0)
  const grossMargin = grossMarginResult.value ?? 0

  const netMarginResult = safeDivide(netIncome * 100, revenue, 0)
  const netMargin = netMarginResult.value ?? 0

  const expenseRatioResult = safeDivide(expenses * 100, revenue, 0)
  const expenseRatio = expenseRatioResult.value ?? 0

  // Liquidity metrics
  const totalAssets = balanceSheet?.total_assets || 0
  const totalLiabilities = balanceSheet?.total_liabilities || 0
  const totalEquity = balanceSheet?.total_equity || totalAssets - totalLiabilities

  // Current assets and liabilities for working capital and liquidity ratios
  const currentAssets = balanceSheet?.current_assets || 0
  const currentLiabilities = balanceSheet?.current_liabilities || 0

  // Get cash balance from multiple sources with fallbacks
  const cashBalance =
    balanceSheet?.cash_and_equivalents || cashFlow?.cash_at_end || cashFlow?.cash_at_beginning || 0

  // Validate cash balance
  const cashValidation = validateCurrency(cashBalance, true)

  // Current ratio: Current Assets / Current Liabilities
  const currentRatioResult = safeDivide(currentAssets, currentLiabilities, 1.5)
  const currentRatio = currentRatioResult.value ?? 1.5

  // Quick ratio: (Cash + Receivables) / Current Liabilities
  const quickRatioResult = safeDivide(
    cashBalance + (receivables?.total || 0),
    currentLiabilities,
    1.2
  )
  const quickRatio = quickRatioResult.value ?? 1.2

  // Working capital: Current Assets - Current Liabilities
  const workingCapital = currentAssets - currentLiabilities

  // Cash flow metrics - with fallback calculations if not available
  // Use actual cash flow data only - don't estimate
  const operatingCashFlow = cashFlow?.net_cash_from_operating_activities || null
  const investingCashFlow = cashFlow?.net_cash_from_investing_activities || 0
  const financingCashFlow = cashFlow?.net_cash_from_financing_activities || 0

  // Flag to indicate if cash flow data is available
  const hasCashFlowData = operatingCashFlow !== null && operatingCashFlow !== undefined

  // If no cash flow data, use null to indicate unavailability
  const effectiveOperatingCashFlow = hasCashFlowData ? operatingCashFlow : null

  const netCashChange =
    cashFlow?.net_change_in_cash ||
    (hasCashFlowData ? operatingCashFlow + investingCashFlow + financingCashFlow : null)

  // Calculate burn rate and runway
  // If we have monthly data, use it directly; otherwise estimate from period
  const daysInPeriod =
    Math.ceil(
      (new Date(pnl?.end_date || new Date()).getTime() -
        new Date(pnl?.start_date || new Date()).getTime()) /
        (1000 * 60 * 60 * 24)
    ) || 30
  const monthsInPeriod = Math.max(1, daysInPeriod / 30)
  const monthlyExpenses = expenses / monthsInPeriod
  const monthlyRevenue = revenue / monthsInPeriod

  // Calculate both gross and net burn rates
  const grossBurnRate = Math.abs(monthlyExpenses) // Total monthly expenses
  const netBurnRate = Math.abs(monthlyExpenses - monthlyRevenue) // Monthly net cash consumption

  // Runway calculation (using net burn rate if positive, else use gross)
  const effectiveBurnRate = monthlyExpenses > monthlyRevenue ? netBurnRate : 0
  const runwayMonthsResult = safeDivide(cashBalance, effectiveBurnRate, 999)
  const runwayMonths = runwayMonthsResult.value ?? 999
  const runwayDays = Math.round(runwayMonths * 30)

  // Working capital metrics with validation
  const receivablesDaysResult = calculateMetricSafely({
    metricId: 'receivables_days',
    metricName: 'Days Sales Outstanding',
    calculate: () => {
      const dailyRevenue = safeDivide(revenue, 365, 0)
      if (!dailyRevenue.isValid || !receivables?.total) return 30
      const dsoResult = safeDivide(receivables.total, dailyRevenue.value!, 30)
      return Math.round(dsoResult.value ?? 30)
    },
  })
  const receivablesDays = receivablesDaysResult.value ?? 30

  const payablesDaysResult = calculateMetricSafely({
    metricId: 'payables_days',
    metricName: 'Days Payable Outstanding',
    calculate: () => {
      const dailyExpenses = safeDivide(expenses, 365, 0)
      if (!dailyExpenses.isValid || !payables?.total) return 28
      const dpoResult = safeDivide(payables.total, dailyExpenses.value!, 28)
      return Math.round(dpoResult.value ?? 28)
    },
  })
  const payablesDays = payablesDaysResult.value ?? 28

  return {
    revenue: {
      current: revenue,
      grossProfit,
      grossMargin,
      netMargin,
    },
    expenses: {
      current: expenses,
      ratio: expenseRatio,
      burnRate: grossBurnRate, // Keep for backward compatibility
      grossBurnRate,
      netBurnRate,
    },
    profitability: {
      netIncome,
      grossMargin,
      netMargin,
      /**
       * EBITDA Estimate
       *
       * NOTE: This is an ESTIMATE using a 1.2x multiplier when detailed
       * Depreciation & Amortization data is not available from QuickBooks.
       *
       * Calculation: Net Income × 1.2
       *
       * For accurate EBITDA, use extractEBITDAComponents() with full P&L report data.
       * The ebitdaIsEstimated flag indicates when this estimation method is used.
       */
      ebitda: netIncome * 1.2,
      ebitdaIsEstimated: true, // Flag indicating this is an estimate, not actual D&A data
    },
    liquidity: {
      cashBalance,
      currentRatio,
      quickRatio,
      workingCapital,
      runwayDays,
      runwayMonths,
    },
    cashFlow: {
      operating: effectiveOperatingCashFlow,
      investing: investingCashFlow,
      financing: financingCashFlow,
      netChange: netCashChange,
      isEstimated: !hasCashFlowData, // Flag to indicate if data is estimated or unavailable
    },
    efficiency: {
      receivablesDays,
      payablesDays,
      totalReceivables: receivables?.total || 0,
      totalPayables: payables?.total || 0,
    },
    balanceSheet: {
      totalAssets,
      totalLiabilities,
      totalEquity,
    },
    validation: {
      hasErrors:
        !grossMarginResult.isValid ||
        !netMarginResult.isValid ||
        !currentRatioResult.isValid ||
        !quickRatioResult.isValid ||
        !runwayMonthsResult.isValid ||
        !cashValidation.isValid,
      warnings: [
        grossMarginResult.warning,
        netMarginResult.warning,
        expenseRatioResult.warning,
        currentRatioResult.warning,
        quickRatioResult.warning,
        runwayMonthsResult.warning,
        cashValidation.warning,
        receivablesDaysResult.warnings,
        payablesDaysResult.warnings,
      ]
        .flat()
        .filter(Boolean),
      errors: [
        grossMarginResult.error,
        netMarginResult.error,
        expenseRatioResult.error,
        currentRatioResult.error,
        quickRatioResult.error,
        runwayMonthsResult.error,
        cashValidation.error,
        receivablesDaysResult.errors,
        payablesDaysResult.errors,
      ]
        .flat()
        .filter(Boolean),
      missingData: {
        cashFlow: !hasCashFlowData,
        receivables: !receivables?.total,
        payables: !payables?.total,
      },
    },
  }
}

/**
 * Calculate financial health score based on multiple factors
 */
export function calculateFinancialHealthScore(metrics: any) {
  let score = 50 // Base score
  const components = []

  // Profitability component (30 points max)
  const profitabilityScore = Math.min(100, Math.max(0, 50 + metrics.profitability.netMargin * 2))
  components.push({
    name: 'Profitability',
    score: profitabilityScore,
    weight: 0.3,
    metrics: {
      grossMargin: metrics.profitability.grossMargin,
      netMargin: metrics.profitability.netMargin,
    },
  })

  // Liquidity component (25 points max)
  const liquidityScore = Math.min(100, Math.max(0, metrics.liquidity.currentRatio * 40))
  components.push({
    name: 'Liquidity',
    score: liquidityScore,
    weight: 0.25,
    metrics: {
      currentRatio: metrics.liquidity.currentRatio,
      quickRatio: metrics.liquidity.quickRatio,
      workingCapital: metrics.liquidity.workingCapital,
    },
  })

  // Efficiency component (25 points max)
  const efficiencyScore = Math.min(
    100,
    Math.max(
      0,
      100 - (metrics.efficiency.receivablesDays - 30 + (metrics.efficiency.payablesDays - 30))
    )
  )
  components.push({
    name: 'Efficiency',
    score: efficiencyScore,
    weight: 0.25,
    metrics: {
      receivablesDays: metrics.efficiency.receivablesDays,
      payablesDays: metrics.efficiency.payablesDays,
    },
  })

  // Cash Flow component (20 points max)
  const cashFlowScore = metrics.cashFlow.operating > 0 ? 80 : 40
  components.push({
    name: 'Cash Flow',
    score: cashFlowScore,
    weight: 0.2,
    metrics: {
      operatingCashFlow: metrics.cashFlow.operating,
      runwayDays: metrics.liquidity.runwayDays,
    },
  })

  // Calculate weighted score
  score = components.reduce((total, comp) => total + comp.score * comp.weight, 0)

  const rating =
    score >= 80
      ? 'Excellent'
      : score >= 70
        ? 'Good'
        : score >= 60
          ? 'Fair'
          : score >= 50
            ? 'Needs Improvement'
            : 'Critical'

  return {
    score: Math.round(score),
    rating,
    components,
  }
}

/**
 * Parse revenue and expense breakdowns from QuickBooks data
 */
export function parseBreakdowns(pnl: any) {
  const revenueBreakdown = []
  const expenseBreakdown = []

  const totalRevenue = pnl?.total_income || 0
  const totalExpenses = pnl?.total_expenses || 0

  // Use actual detailed breakdowns from QuickBooks if available
  if (pnl?.income_details && pnl.income_details.length > 0) {
    // Group income by top-level categories
    const incomeGroups = pnl.income_details.reduce((acc: any, item: any) => {
      const category = item.name.split(' - ')[0] || item.name
      if (!acc[category]) {
        acc[category] = { amount: 0, items: [] }
      }
      acc[category].amount += item.value
      acc[category].items.push(item)
      return acc
    }, {})

    // Convert to breakdown format
    for (const [category, data] of Object.entries(incomeGroups)) {
      const amount = (data as any).amount
      revenueBreakdown.push({
        category,
        amount,
        percentage: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0,
        trend: 'stable', // TODO: Calculate trend from historical data
      })
    }
  } else if (totalRevenue > 0) {
    // Fallback to estimates if no detailed data
    revenueBreakdown.push(
      { category: 'Sales Revenue', amount: totalRevenue * 0.9, percentage: 90, trend: 'up' },
      { category: 'Other Income', amount: totalRevenue * 0.1, percentage: 10, trend: 'stable' }
    )
  }

  // Parse expense breakdown
  if (pnl?.expense_details && pnl.expense_details.length > 0) {
    // Group expenses by top-level categories
    const expenseGroups = pnl.expense_details.reduce((acc: any, item: any) => {
      const category = item.name.split(' - ')[0] || item.name
      if (!acc[category]) {
        acc[category] = { amount: 0, items: [] }
      }
      acc[category].amount += item.value
      acc[category].items.push(item)
      return acc
    }, {})

    // Add COGS if present
    if (pnl?.cogs_details && pnl.cogs_details.length > 0) {
      const cogsTotal = pnl.cogs_details.reduce((sum: number, item: any) => sum + item.value, 0)
      expenseGroups['Cost of Goods Sold'] = { amount: cogsTotal, items: pnl.cogs_details }
    }

    // Convert to breakdown format
    for (const [category, data] of Object.entries(expenseGroups)) {
      const amount = (data as any).amount
      const totalWithCOGS = totalExpenses + (pnl?.cost_of_goods_sold || 0)
      expenseBreakdown.push({
        category,
        amount,
        percentage: totalWithCOGS > 0 ? (amount / totalWithCOGS) * 100 : 0,
        optimized: false, // TODO: Track optimization status
      })
    }
  } else if (totalExpenses > 0) {
    // Fallback to estimates if no detailed data
    const cogs = pnl?.cost_of_goods_sold || 0
    const opex = totalExpenses

    if (cogs > 0) {
      expenseBreakdown.push({
        category: 'Cost of Goods Sold',
        amount: cogs,
        percentage: (cogs / (totalExpenses + cogs)) * 100,
        optimized: false,
      })
    }

    expenseBreakdown.push({
      category: 'Operating Expenses',
      amount: opex,
      percentage: (opex / (totalExpenses + cogs)) * 100,
      optimized: false,
    })
  }

  // Sort by amount descending
  revenueBreakdown.sort((a, b) => b.amount - a.amount)
  expenseBreakdown.sort((a, b) => b.amount - a.amount)

  return { revenueBreakdown, expenseBreakdown }
}

/**
 * Generate insights based on financial data
 */
export function generateInsights(
  metrics: any,
  previousMetrics: any = null,
  currency: string = 'USD'
) {
  const insights = []

  // Revenue insights
  if (metrics.revenue.current > 0) {
    if (previousMetrics && metrics.revenue.current > previousMetrics.revenue.current) {
      const growth =
        ((metrics.revenue.current - previousMetrics.revenue.current) /
          previousMetrics.revenue.current) *
        100
      insights.push({
        type: 'positive',
        priority: 'high',
        title: 'Revenue Growth',
        description: `Revenue increased by ${growth.toFixed(1)}% compared to previous period`,
        metric: 'revenue',
        actionable: true,
      })
    }

    if (metrics.profitability.grossMargin < 30) {
      insights.push({
        type: 'warning',
        priority: 'high',
        title: 'Low Gross Margin',
        description: `Gross margin at ${metrics.profitability.grossMargin.toFixed(1)}% is below industry standards. Consider reviewing pricing or reducing COGS.`,
        metric: 'profitability',
        actionable: true,
      })
    }
  }

  // Cash flow insights
  if (metrics.cashFlow.operating > 0) {
    insights.push({
      type: 'positive',
      priority: 'medium',
      title: 'Positive Operating Cash Flow',
      description: `Operating activities generated ${formatCurrencyUtil(metrics.cashFlow.operating, currency)} in cash`,
      metric: 'cashFlow',
      actionable: false,
    })
  } else if (metrics.cashFlow.operating < 0) {
    insights.push({
      type: 'warning',
      priority: 'high',
      title: 'Negative Operating Cash Flow',
      description:
        'Business operations are consuming cash. Review revenue collection and expense management.',
      metric: 'cashFlow',
      actionable: true,
    })
  }

  // Liquidity insights
  if (metrics.liquidity.runwayDays < 180) {
    insights.push({
      type: 'warning',
      priority: 'high',
      title: 'Limited Cash Runway',
      description: `Current cash runway of ${metrics.liquidity.runwayDays} days. Consider fundraising or reducing burn rate.`,
      metric: 'liquidity',
      actionable: true,
    })
  }

  // Efficiency insights
  if (metrics.efficiency.receivablesDays > 45) {
    insights.push({
      type: 'info',
      priority: 'medium',
      title: 'High Receivables Days',
      description: `DSO at ${metrics.efficiency.receivablesDays} days. Consider improving collection processes.`,
      metric: 'efficiency',
      actionable: true,
    })
  }

  return insights
}

// ===== P&L REPORT HELPERS =====

/**
 * Extract EBITDA components from P&L report
 */
export function extractEBITDAComponents(plReport: any): {
  interestExpense: number
  taxExpense: number
  depreciationAmortization: number
} {
  let interestExpense = 0
  let taxExpense = 0
  let depreciationAmortization = 0

  // Recursive function to search through P&L rows
  function searchRows(rows: any[], keywords: string[]): number {
    let total = 0

    if (!Array.isArray(rows)) return 0

    for (const row of rows) {
      // Get the account name from the first column
      const name = (row?.ColData?.[0]?.value || '').toLowerCase()

      // Skip accumulated depreciation/amortization (balance sheet contra-assets, not expenses)
      if (name.includes('accumulated')) continue

      // Check if row name matches any keyword
      if (keywords.some((kw) => name.includes(kw.toLowerCase()))) {
        // Get the amount from the second column (usually index 1)
        const amount = parseFloat(row?.ColData?.[1]?.value || '0')
        // Expenses in QuickBooks are typically negative, we want positive values
        total += Math.abs(amount)
      }

      // Recursively search sub-rows if they exist
      if (row?.Rows?.Row) {
        total += searchRows(Array.isArray(row.Rows.Row) ? row.Rows.Row : [row.Rows.Row], keywords)
      }
    }
    return total
  }

  // Parse the P&L report structure
  const rows = plReport?.Rows?.Row || []
  const rowsArray = Array.isArray(rows) ? rows : [rows]

  // Search for each component with relevant keywords
  interestExpense = searchRows(rowsArray, [
    'interest expense',
    'interest paid',
    'interest on loan',
    'loan interest',
    'bank charges and interest',
    'finance charges',
    'finance costs',
  ])

  taxExpense = searchRows(rowsArray, [
    'income tax',
    'tax expense',
    'taxes',
    'federal tax',
    'state tax',
    'corporate tax',
  ])

  depreciationAmortization = searchRows(rowsArray, [
    'depreciation',
    'amortization',
    'amortisation', // UK spelling
    'd&a',
    'depreciation expense',
    'amortization expense',
    'depreciation and amortization',
    'depletion', // Natural resource depletion
  ])

  return {
    interestExpense,
    taxExpense,
    depreciationAmortization,
  }
}

/**
 * Generate insights for P&L reports
 */
export function generatePnLInsights(current: any, previous: any) {
  const insights = {
    positive: [] as string[],
    concerns: [] as string[],
  }

  if (!current || !previous) {
    return insights
  }

  // Revenue insights
  const revenueChange =
    previous.total_income > 0
      ? ((current.total_income - previous.total_income) / previous.total_income) * 100
      : 0

  if (revenueChange > 10) {
    insights.positive.push(
      `Revenue increased by ${revenueChange.toFixed(1)}% compared to previous period`
    )
  } else if (revenueChange < -10) {
    insights.concerns.push(
      `Revenue decreased by ${Math.abs(revenueChange).toFixed(1)}% compared to previous period`
    )
  }

  // Expense insights
  const expenseChange =
    previous.total_expenses > 0
      ? ((current.total_expenses - previous.total_expenses) / previous.total_expenses) * 100
      : 0

  if (expenseChange > revenueChange && revenueChange > 0) {
    insights.concerns.push(
      `Expenses grew faster than revenue (${expenseChange.toFixed(1)}% vs ${revenueChange.toFixed(1)}%)`
    )
  } else if (expenseChange < 0) {
    insights.positive.push(`Expenses reduced by ${Math.abs(expenseChange).toFixed(1)}%`)
  }

  // Profit margin insights
  const currentMargin =
    current.total_income > 0 ? (current.net_income / current.total_income) * 100 : 0
  const previousMargin =
    previous.total_income > 0 ? (previous.net_income / previous.total_income) * 100 : 0

  const marginChange = currentMargin - previousMargin
  if (marginChange > 2) {
    insights.positive.push(`Profit margin improved by ${marginChange.toFixed(1)} percentage points`)
  } else if (marginChange < -2) {
    insights.concerns.push(
      `Profit margin declined by ${Math.abs(marginChange).toFixed(1)} percentage points`
    )
  }

  // Net income insights
  if (current.net_income > 0 && previous.net_income <= 0) {
    insights.positive.push('Returned to profitability this period')
  } else if (current.net_income <= 0 && previous.net_income > 0) {
    insights.concerns.push('Moved into loss-making territory this period')
  }

  return insights
}

/**
 * Generate detailed statement comparison
 */
export function generatePnLDetailedStatement(current: any, previous: any) {
  const calculateVariance = (curr: number, prev: number) => ({
    variance: curr - prev,
    variancePercent: prev !== 0 ? ((curr - prev) / prev) * 100 : 0,
  })

  // Use cogs_total for numeric COGS value (cost_of_goods_sold is an array)
  const currentCOGS = current.cogs_total || 0
  const previousCOGS = previous?.cogs_total || 0

  return [
    {
      account: 'Revenue',
      currentPeriod: current.total_income || 0,
      previousPeriod: previous?.total_income || 0,
      ...calculateVariance(current.total_income || 0, previous?.total_income || 0),
    },
    {
      account: 'Cost of Goods Sold',
      currentPeriod: currentCOGS,
      previousPeriod: previousCOGS,
      ...calculateVariance(currentCOGS, previousCOGS),
    },
    {
      account: 'Gross Profit',
      currentPeriod: current.gross_profit || 0,
      previousPeriod: previous?.gross_profit || 0,
      ...calculateVariance(current.gross_profit || 0, previous?.gross_profit || 0),
    },
    {
      account: 'Operating Expenses',
      currentPeriod: current.total_expenses || 0,
      previousPeriod: previous?.total_expenses || 0,
      ...calculateVariance(current.total_expenses || 0, previous?.total_expenses || 0),
    },
    {
      account: 'Other Expenses',
      currentPeriod: current.other_expenses || 0,
      previousPeriod: previous?.other_expenses || 0,
      ...calculateVariance(current.other_expenses || 0, previous?.other_expenses || 0),
    },
    {
      account: 'Net Income',
      currentPeriod: current.net_income || 0,
      previousPeriod: previous?.net_income || 0,
      ...calculateVariance(current.net_income || 0, previous?.net_income || 0),
    },
  ]
}

/**
 * Reconcile P&L data by detecting and correcting double-counting issues
 *
 * This function detects when QuickBooks includes "other_expenses" within "total_expenses"
 * and adjusts the values to prevent double-counting. Returns a NEW object without
 * mutating the original data.
 *
 * @param data - The P&L data object to reconcile (supports both transformer output and legacy formats)
 * @returns A new reconciled data object with normalized property names
 */
export function reconcilePnLData(data: any): any {
  const warnings: string[] = []

  // Normalize the data - support both transformer output (camelCase nested) and legacy (snake_case flat)
  // Transformer returns: { income: { lines, total }, expenses: { lines, total }, netIncome, ... }
  // This function expects: { total_income, total_expenses, net_income, ... }
  const reconciledData = {
    // Preserve original nested objects for line item access
    income: data.income,
    costOfGoodsSold: data.costOfGoodsSold,
    expenses: data.expenses,
    otherIncome: data.otherIncome,
    otherExpenses: data.otherExpenses,
    // Normalize totals - support both formats
    total_income: data.total_income ?? data.income?.total ?? 0,
    cogs_total: data.cogs_total ?? data.costOfGoodsSold?.total ?? 0,
    total_expenses: data.total_expenses ?? data.expenses?.total ?? 0,
    other_income: data.other_income ?? data.otherIncome?.total ?? 0,
    other_expenses: data.other_expenses ?? data.otherExpenses?.total ?? 0,
    // Calculate gross_profit if not provided (revenue - COGS)
    gross_profit:
      data.gross_profit ??
      data.grossProfit ??
      (data.total_income ?? data.income?.total ?? 0) -
        (data.cogs_total ?? data.costOfGoodsSold?.total ?? 0),
    // Calculate net_income if not provided (revenue - COGS - expenses - other expenses)
    net_income:
      data.net_income ??
      data.netIncome ??
      (data.total_income ?? data.income?.total ?? 0) -
        (data.cogs_total ?? data.costOfGoodsSold?.total ?? 0) -
        (data.total_expenses ?? data.expenses?.total ?? 0) -
        (data.other_expenses ?? data.otherExpenses?.total ?? 0),
    // Calculate net_operating_income if not provided (revenue - COGS - operating expenses)
    net_operating_income:
      data.net_operating_income ??
      data.netOperatingIncome ??
      (data.total_income ?? data.income?.total ?? 0) -
        (data.cogs_total ?? data.costOfGoodsSold?.total ?? 0) -
        (data.total_expenses ?? data.expenses?.total ?? 0),
    // Preserve metadata
    reportName: data.reportName,
    reportBasis: data.reportBasis,
    startDate: data.startDate,
    endDate: data.endDate,
    currency: data.currency,
    generatedAt: data.generatedAt,
    columns: data.columns,
  }

  // Store original values for logging
  const originalOtherExpenses = reconciledData.other_expenses || 0
  const originalTotalExpenses = reconciledData.total_expenses || 0

  // Check if net income calculation is consistent
  const calculatedNetIncome =
    reconciledData.total_income -
    (reconciledData.cogs_total || 0) -
    reconciledData.total_expenses -
    (reconciledData.other_expenses || 0)
  const reportedNetIncome = reconciledData.net_income
  const discrepancy = Math.abs(reportedNetIncome - calculatedNetIncome)

  if (discrepancy > 1) {
    warnings.push(
      `NetIncome discrepancy: Reported ${reportedNetIncome}, Calculated ${calculatedNetIncome}, Diff ${discrepancy}`
    )

    // Check if other expenses might be included in total expenses
    const netIncomeWithoutOther =
      reconciledData.total_income - (reconciledData.cogs_total || 0) - reconciledData.total_expenses
    if (Math.abs(reportedNetIncome - netIncomeWithoutOther) < 1) {
      warnings.push('Other Expenses appears to be included in Total Expenses')
      // IMPORTANT: If other expenses were included in total_expenses, we need to adjust
      // to avoid double-counting BUT keep the original values if QuickBooks provided them correctly
      if (originalOtherExpenses > 0 && originalTotalExpenses > originalOtherExpenses) {
        // Only adjust if it makes sense (total expenses should be larger than other expenses)
        reconciledData.total_expenses = originalTotalExpenses - originalOtherExpenses
        warnings.push(
          `Adjusted total_expenses from ${originalTotalExpenses} to ${reconciledData.total_expenses} (removed other expenses)`
        )
        // Set other_expenses to 0 since it was already included
        reconciledData.other_expenses = 0
      } else {
        // Keep original values if adjustment doesn't make sense
        warnings.push(
          'Keeping original expense values as adjustment would result in negative operating expenses'
        )
      }
    }
  }

  // Check if gross profit calculation is consistent
  const calculatedGrossProfit = reconciledData.total_income - (reconciledData.cogs_total || 0)
  if (Math.abs(reconciledData.gross_profit - calculatedGrossProfit) > 1) {
    warnings.push(
      `GrossProfit discrepancy: Reported ${reconciledData.gross_profit}, Calculated ${calculatedGrossProfit}`
    )
  }

  if (warnings.length > 0) {
    console.warn('[P&L Reconciliation] Data reconciliation warnings:', warnings)
  }

  return reconciledData
}

/**
 * @deprecated Use reconcilePnLData instead. This function name was confusing because
 * it mutates data rather than just validating. reconcilePnLData returns a new object
 * and has clearer semantics.
 */
export const validatePnLData = reconcilePnLData

// ===== CASH FLOW HELPERS =====

/**
 * Enhanced cash flow metrics calculation
 */
export function calculateCashFlowMetrics(
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
): any {
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
    burn_rate: burnRate,
    runway_months: Math.min(runwayMonths, 999),
    days_cash: Math.min(Math.round(daysCash), 999),
    operating_cash_flow_ratio: Math.round(operatingCashFlowRatio * 10000) / 10000,
    free_cash_flow: freeCashFlow,
    cash_conversion_cycle: Math.round(cashConversionCycle),
    operating_cash_flow_margin:
      operatingCashFlowMargin !== undefined
        ? Math.round(operatingCashFlowMargin * 100) / 100
        : undefined,
    cash_flow_coverage_ratio:
      cashFlowCoverageRatio !== undefined
        ? Math.round(cashFlowCoverageRatio * 10000) / 10000
        : undefined,
    // Include component values for tooltips
    revenue,
    capital_expenditures: capitalExpenditures,
    total_debt: totalDebt,
    days_receivable: daysReceivable,
    days_payable: daysPayable,
    days_inventory: daysInventory,
    // Add these fields for gross burn rate calculation in frontend
    total_expenses: totalExpenses,
    period_months: periodMonths,
  }
}

/**
 * Calculate days receivable
 */
export async function calculateDaysReceivable(
  orgId: string,
  revenue: number,
  getAccountsReceivable: any
): Promise<number> {
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
 * Calculate days payable
 */
export async function calculateDaysPayable(
  orgId: string,
  expenses: number,
  getAccountsPayable: any
): Promise<number> {
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
 * Calculate days inventory
 */
export async function calculateDaysInventory(
  orgId: string,
  cogs: number,
  getInventoryValue: any
): Promise<number> {
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

// Note: formatReportDate and getDateRange are already re-exported from '@/lib/utils/financial/dateHelpers' at the top of this file
