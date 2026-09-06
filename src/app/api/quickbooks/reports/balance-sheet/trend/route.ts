/**
 * Balance Sheet Trend Report API
 *
 * Returns periodic trend data for balance sheet over a specified period.
 *
 * GET /api/quickbooks/reports/balance-sheet/trend
 *
 * Query Parameters:
 * - start: Start date YYYY-MM-DD (optional, default: 6 months ago)
 * - end: End date YYYY-MM-DD (optional, default: end of current month)
 * - summarize_column_by: Month, Quarter, Year (optional, default: Month)
 * - accounting_method: Accrual or Cash (optional)
 */

import { NextRequest, NextResponse } from 'next/server'
import { transformBalanceSheet } from '@/quickbooks/reports'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { formatReportDate, withRetry, formatErrorResponse } from '@/quickbooks/utils/route-helpers'
import type { QBBalanceSheetParams } from '@/quickbooks/types/reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Get default as-of date (end of current month)
function getDefaultAsOfDate(): string {
  const date = new Date()
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return formatReportDate(lastDay)
}

// Get default start date (6 months back)
function getDefaultStartDate(): string {
  const date = new Date()
  date.setMonth(date.getMonth() - 5) // 6 months back
  return formatReportDate(new Date(date.getFullYear(), date.getMonth(), 1))
}

export const GET = withActiveProvider(async (request, { organizationId, apiClient, realmId }) => {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams

  const startDate = searchParams.get('start') || getDefaultStartDate()
  const endDate = searchParams.get('end') || getDefaultAsOfDate()
  const summarizeBy = searchParams.get('summarize_column_by') || 'Month'

  try {
    // Build params
    const params: QBBalanceSheetParams = {
      start_date: startDate,
      end_date: endDate,
      summarize_column_by: summarizeBy as QBBalanceSheetParams['summarize_column_by'],
    }

    // Optional accounting method
    const accountingMethod = searchParams.get('accounting_method')
    if (accountingMethod) {
      params.accounting_method = accountingMethod as QBBalanceSheetParams['accounting_method']
    }

    // Build report URL with query parameters
    const reportParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        reportParams.set(key, String(value))
      }
    })
    reportParams.set('minorversion', '65')

    // Fetch raw Balance Sheet report with retry logic
    const client = new QuickBooksClient({ organizationId, realmId })
    const rawReport = await withRetry(() =>
      client.request(`/reports/BalanceSheet?${reportParams.toString()}`)
    )

    // Normalize the raw report
    const normalized = transformBalanceSheet(rawReport)

    // Get organization info for currency
    const orgInfo = await withRetry(() => client.getCompanyInfo()).catch((err) => {
      console.error('[BS Trend] Failed to fetch org info:', err)
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
    // Pattern: columns[0] is the label, columns[1+] are period headers
    // line.values[`col_${index}`] contains the value for each period
    const columns = normalized.columns || []
    const monthlyTrend = columns.slice(1).map((period: string, index: number) => {
      // Calculate total assets per period (sum all asset sections)
      const currentAssetsTotal = normalized.assets.current.lines.reduce((sum, line) => {
        return sum + (line.values[`col_${index}`] || 0)
      }, 0)

      const fixedAssetsTotal = normalized.assets.fixed.lines.reduce((sum, line) => {
        return sum + (line.values[`col_${index}`] || 0)
      }, 0)

      const otherAssetsTotal = normalized.assets.other.lines.reduce((sum, line) => {
        return sum + (line.values[`col_${index}`] || 0)
      }, 0)

      const assets = currentAssetsTotal + fixedAssetsTotal + otherAssetsTotal

      // Calculate total liabilities per period (sum all liability sections)
      const currentLiabilitiesTotal = normalized.liabilities.current.lines.reduce((sum, line) => {
        return sum + (line.values[`col_${index}`] || 0)
      }, 0)

      const longTermLiabilitiesTotal = normalized.liabilities.longTerm.lines.reduce((sum, line) => {
        return sum + (line.values[`col_${index}`] || 0)
      }, 0)

      const liabilities = currentLiabilitiesTotal + longTermLiabilitiesTotal

      // Calculate equity per period
      const equity = normalized.equity.lines.reduce((sum, line) => {
        return sum + (line.values[`col_${index}`] || 0)
      }, 0)

      return {
        month: period, // Frontend expects "month" field for chart xKey
        assets,
        liabilities,
        equity,
        currentAssets: currentAssetsTotal, // For Current Ratio calculation
        currentLiabilities: currentLiabilitiesTotal, // For Quick Ratio calculation
      }
    })

    const responseData = {
      reportType: 'balance_sheet_trend',
      organizationId,
      startDate,
      endDate,
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
    return formatErrorResponse(error, 'Failed to generate balance sheet trend data')
  }
})
