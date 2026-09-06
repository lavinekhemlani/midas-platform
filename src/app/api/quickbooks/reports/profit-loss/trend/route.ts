/**
 * Profit and Loss Trend Report API
 *
 * Returns monthly trend data for profit and loss over a specified period.
 *
 * GET /api/quickbooks/reports/profit-loss/trend
 *
 * Query Parameters:
 * - start: Start date YYYY-MM-DD (optional, default: first day of current month)
 * - end: End date YYYY-MM-DD (optional, default: today)
 * - summarize_column_by: Month, Quarter, Year (optional, default: Month)
 * - accounting_method: Accrual or Cash (optional)
 */

import { NextRequest, NextResponse } from 'next/server'
import { transformProfitAndLoss } from '@/quickbooks/reports'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import {
  formatReportDate,
  withRetry,
  validateDateRange,
  formatErrorResponse,
} from '@/quickbooks/utils/route-helpers'
import type { QBProfitAndLossParams } from '@/quickbooks/types/reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Helper functions for default dates
function formatDate(date: Date): string {
  return formatReportDate(date)
}

function getDefaultStartDate(): string {
  const date = new Date()
  date.setDate(1) // First day of current month
  return formatDate(date)
}

function getDefaultEndDate(): string {
  const date = new Date()
  return formatDate(date)
}

// Always use monthly aggregation for accurate trend visualization
function getSmartAggregation(startDate: Date, endDate: Date): string {
  // Monthly aggregation provides the most granular and accurate trend data
  // Quarterly/yearly can be added as user-selectable options in the future
  return 'Month'
}

export const GET = withActiveProvider(async (request, { organizationId, apiClient, realmId }) => {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams

  const startDate = searchParams.get('start') || getDefaultStartDate()
  const endDate = searchParams.get('end') || getDefaultEndDate()

  // Validate date inputs
  const startDateObj = new Date(startDate)
  const endDateObj = new Date(endDate)

  const summarizeBy =
    searchParams.get('summarize_column_by') || getSmartAggregation(startDateObj, endDateObj)

  const dateValidation = validateDateRange(startDateObj, endDateObj)
  if (!dateValidation.valid && dateValidation.error) {
    return NextResponse.json(
      {
        error: dateValidation.error.message,
        suggestion: dateValidation.error.suggestion,
        timestamp: new Date().toISOString(),
      },
      { status: dateValidation.error.statusCode }
    )
  }

  try {
    // Build params
    const params: QBProfitAndLossParams = {
      start_date: startDate,
      end_date: endDate,
      summarize_column_by: summarizeBy as QBProfitAndLossParams['summarize_column_by'],
    }

    // Optional accounting method
    const accountingMethod = searchParams.get('accounting_method')
    if (accountingMethod) {
      params.accounting_method = accountingMethod as QBProfitAndLossParams['accounting_method']
    }

    // Build report URL with query parameters
    const reportParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        reportParams.set(key, String(value))
      }
    })
    reportParams.set('minorversion', '65')

    // Fetch raw P&L report with retry logic
    const client = new QuickBooksClient({ organizationId, realmId })
    const rawReport = await withRetry(() =>
      client.request(`/reports/ProfitAndLoss?${reportParams.toString()}`)
    )

    // Normalize the raw report
    const normalized = transformProfitAndLoss(rawReport)

    // Get organization info for currency
    const orgInfo = await withRetry(() => client.getCompanyInfo()).catch((err) => {
      console.error('[P&L Trend] Failed to fetch org info:', err)
      return null
    })

    // Improved currency extraction
    const getCurrency = (info: any): string => {
      if (info?.HomeCurrency?.value) return info.HomeCurrency.value
      if (info?.currency_code) return info.currency_code
      if (info?.Country === 'US') return 'USD'
      if (info?.Country === 'CA') return 'CAD'
      if (info?.Country === 'GB') return 'GBP'
      if (info?.Country === 'AU') return 'AUD'
      if (info?.Country === 'HK') return 'HKD'
      return 'USD'
    }

    const currency = getCurrency(orgInfo)

    // Extract monthly trend data from columns
    const columns = normalized.columns || []

    // Filter out "Total" column - we only want individual period data
    // Note: Do NOT use slice(1) here - extractColumnHeaders already removed the empty first column,
    // so columns[0] = first month and col_0 = first month's data (they are already aligned)
    const periodColumns = columns.filter((col) => !col.toLowerCase().includes('total'))

    const monthlyTrend = periodColumns.map((period: string, index: number) => {
      // Filter out summary rows to avoid double-counting
      // Summary rows contain the section total which would duplicate the sum of detail items
      const income = normalized.income.lines
        .filter((line) => !line.isSummary)
        .reduce((sum, line) => {
          return sum + (line.values[`col_${index}`] || 0)
        }, 0)

      // Cost of Goods Sold - must be subtracted to get correct net income
      const cogs = normalized.costOfGoodsSold.lines
        .filter((line) => !line.isSummary)
        .reduce((sum, line) => {
          return sum + (line.values[`col_${index}`] || 0)
        }, 0)

      const expenses = normalized.expenses.lines
        .filter((line) => !line.isSummary)
        .reduce((sum, line) => {
          return sum + (line.values[`col_${index}`] || 0)
        }, 0)

      // Other Income (non-operating income like interest, gains)
      const otherIncome = normalized.otherIncome.lines
        .filter((line) => !line.isSummary)
        .reduce((sum, line) => {
          return sum + (line.values[`col_${index}`] || 0)
        }, 0)

      // Other Expenses (non-operating expenses)
      const otherExpenses = normalized.otherExpenses.lines
        .filter((line) => !line.isSummary)
        .reduce((sum, line) => {
          return sum + (line.values[`col_${index}`] || 0)
        }, 0)

      return {
        month: period, // Frontend expects "month" not "period"
        revenue: income, // Frontend expects "revenue" not "income"
        expenses, // Operating Expenses only (excludes COGS and Other Expenses)
        netIncome: income - cogs - expenses + otherIncome - otherExpenses,
      }
    })

    const responseData = {
      reportType: 'profit_loss_trend',
      organizationId,
      fromDate: startDate,
      toDate: endDate,
      currency,
      summarizeBy,
      generated: new Date().toISOString(),
      data: {
        monthlyTrend,
      },
      metadata: {
        queryTime: Date.now() - startTime,
        periodCount: monthlyTrend.length,
      },
    }

    return NextResponse.json(responseData)
  } catch (error) {
    return formatErrorResponse(error, 'Failed to generate P&L trend data')
  }
})
