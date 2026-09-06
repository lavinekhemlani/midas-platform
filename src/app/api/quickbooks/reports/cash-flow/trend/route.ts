/**
 * Cash Flow Trend Report API
 *
 * Returns periodic trend data for cash flow over a specified period.
 *
 * GET /api/quickbooks/reports/cash-flow/trend
 *
 * Query Parameters:
 * - start: Start date YYYY-MM-DD (optional, default: first day of current month)
 * - end: End date YYYY-MM-DD (optional, default: today)
 * - summarize_column_by: Month, Quarter, Year (optional, default: Month)
 * - accounting_method: Accrual or Cash (optional)
 */

import { NextRequest, NextResponse } from 'next/server'
import { transformCashFlow } from '@/quickbooks/reports'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { withRetry, formatErrorResponse, formatReportDate } from '@/quickbooks/utils/route-helpers'
import type { QBCashFlowParams } from '@/quickbooks/types/reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Helper functions for default dates
function formatDate(date: Date): string {
  return formatReportDate(date)
}

function getDefaultCashFlowStartDate(): string {
  const date = new Date()
  date.setDate(1) // First day of current month
  return formatDate(date)
}

function getDefaultCashFlowEndDate(): string {
  const date = new Date()
  return formatDate(date)
}

export const GET = withActiveProvider(async (request, { organizationId, apiClient, realmId }) => {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams

  const startDate = searchParams.get('start') || getDefaultCashFlowStartDate()
  const endDate = searchParams.get('end') || getDefaultCashFlowEndDate()
  const summarizeBy = searchParams.get('summarize_column_by') || 'Month'

  try {
    // Build params
    const params: QBCashFlowParams = {
      start_date: startDate,
      end_date: endDate,
      summarize_column_by: summarizeBy as QBCashFlowParams['summarize_column_by'],
    }

    // Optional accounting method
    const accountingMethod = searchParams.get('accounting_method')
    if (accountingMethod) {
      params.accounting_method = accountingMethod as QBCashFlowParams['accounting_method']
    }

    // Build report URL with query parameters
    const reportParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        reportParams.set(key, String(value))
      }
    })
    reportParams.set('minorversion', '65')

    // Fetch raw Cash Flow report with retry logic
    const client = new QuickBooksClient({ organizationId, realmId })
    const rawReport = await withRetry(() =>
      client.request(`/reports/CashFlow?${reportParams.toString()}`)
    )

    // Normalize the raw report
    const normalized = transformCashFlow(rawReport)

    // Get organization info for currency
    const orgInfo = await withRetry(() => client.getCompanyInfo()).catch((err) => {
      console.error('[CF Trend] Failed to fetch org info:', err)
      return null
    })

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

    // Extract monthly trend data from columns with cumulative cash balance
    const columns = normalized.columns || []

    // Get beginning cash balance from normalized report for cumulative calculation
    const beginningCash = normalized.beginningCash || 0
    let runningCashBalance = beginningCash

    // Filter out "Total" column - we only want individual period data
    // Note: Do NOT use slice(1) here - extractColumnHeaders already removed the empty first column,
    // so columns[0] = first month and col_0 = first month's data (they are already aligned)
    const periodColumns = columns.filter((col) => !col.toLowerCase().includes('total'))

    const monthlyFlow = periodColumns.map((period: string, index: number) => {
      // Filter out summary rows to avoid double-counting
      // Summary rows contain the section total which would duplicate the sum of detail items
      const operating = normalized.operatingActivities.lines
        .filter((line) => !line.isSummary)
        .reduce((sum, line) => {
          return sum + (line.values[`col_${index}`] || 0)
        }, 0)

      const investing = normalized.investingActivities.lines
        .filter((line) => !line.isSummary)
        .reduce((sum, line) => {
          return sum + (line.values[`col_${index}`] || 0)
        }, 0)

      const financing = normalized.financingActivities.lines
        .filter((line) => !line.isSummary)
        .reduce((sum, line) => {
          return sum + (line.values[`col_${index}`] || 0)
        }, 0)

      const netChange = operating + investing + financing

      // Calculate cumulative cash balance at end of this period
      runningCashBalance = runningCashBalance + netChange

      return {
        month: period, // Frontend expects "month" for xKey consistency with P&L chart
        operating,
        investing,
        financing,
        netChange,
        totalCash: runningCashBalance,
      }
    })

    const responseData = {
      reportType: 'cash_flow_trend',
      organizationId,
      startDate,
      endDate,
      currency,
      summarizeBy,
      generated: new Date().toISOString(),
      data: {
        monthlyFlow,
        beginningCash,
      },
      metadata: {
        queryTime: Date.now() - startTime,
        periodCount: monthlyFlow.length,
      },
    }

    return NextResponse.json(responseData)
  } catch (error) {
    return formatErrorResponse(error, 'Failed to generate cash flow trend data')
  }
})
