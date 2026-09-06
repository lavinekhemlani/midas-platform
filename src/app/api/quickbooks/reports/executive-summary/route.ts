/**
 * Executive Summary Report API
 *
 * Aggregates data from P&L, Balance Sheet, and Cash Flow to provide a comprehensive
 * executive summary with key metrics, financial health, and insights.
 *
 * GET /api/quickbooks/reports/executive-summary
 *
 * Query Parameters:
 * - period: Time period (this_month, last_month, this_quarter, this_year, last_year)
 * - cache: Enable/disable cache (default: true)
 */

import { NextRequest, NextResponse } from 'next/server'
import { enrichExecutiveSummary } from '@/quickbooks/reports/enrichers'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { getDateRange } from '@/quickbooks/utils/report-helpers'
import {
  getProviderCompanyMetadata,
  updateProviderCompanyMetadata,
  getQBConnectionCredentials,
  updateQBConnectionMetadata,
} from '@/lib/providers/database'
import {
  transformProfitAndLoss,
  transformBalanceSheet,
  transformCashFlow,
  transformAgedReportDetail,
} from '@/quickbooks/reports/transformers'

// ANSI color codes for terminal output
const QB = '\x1b[32m' // Green for QuickBooks
const RST = '\x1b[0m' // Reset
const DIM = '\x1b[2m' // Dim

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Simple retry wrapper for rate-limited API calls
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 2000
): Promise<T> {
  let lastError: any
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      const errorMessage = error?.message || ''
      const isRateLimited =
        errorMessage.includes('429') ||
        errorMessage.includes('rate limit') ||
        error?.code === 'RATE_LIMIT_EXCEEDED'

      if (!isRateLimited || attempt === maxRetries) {
        throw error
      }

      const delay = baseDelayMs * Math.pow(2, attempt) // 2s, 4s, 8s
      console.warn(
        `[Executive Summary] Rate limited, retry ${attempt + 1}/${maxRetries} after ${delay}ms`
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw lastError
}

export const GET = withActiveProvider(async (request, { organizationId, providerId, realmId }) => {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams

  const period = searchParams.get('period') || 'this_month'
  const explicitStart = searchParams.get('startDate')
  const explicitEnd = searchParams.get('endDate')
  const useCache = searchParams.get('cache') !== 'false'

  console.log(`${QB}[QB/ExecSummary]${RST} Fetching for ${providerId} - Period: ${period}`)

  try {
    // Get date range — explicit dates override period-based calculation
    let fromDate: string, toDate: string
    if (explicitStart && explicitEnd) {
      fromDate = explicitStart
      toDate = explicitEnd
    } else {
      const range = getDateRange(period)
      fromDate = range.fromDate
      toDate = range.toDate
    }

    // Calculate previous period for comparisons (skip for custom date ranges)
    let prevFromDate = ''
    let prevToDate = ''
    if (!explicitStart || !explicitEnd) {
      const prevPeriod =
        period === 'this_month'
          ? 'last_month'
          : period === 'this_quarter'
            ? 'last_quarter'
            : period === 'this_year'
              ? 'last_year'
              : 'last_month'
      const prevRange = getDateRange(prevPeriod)
      prevFromDate = prevRange.fromDate
      prevToDate = prevRange.toDate
    }

    // Get company metadata - for multi-entity QB, check per-connection credentials first
    let currency: string = ''
    let organizationName: string = ''

    // Try per-connection credentials first (for multi-entity QB)
    if (realmId) {
      const connectionCreds = await getQBConnectionCredentials(organizationId, realmId)
      if (connectionCreds) {
        currency = connectionCreds.home_currency || ''
        organizationName = connectionCreds.company_name || ''
      }
    }

    // Fall back to provider-level metadata
    if (!currency || !organizationName) {
      const storedMetadata = await getProviderCompanyMetadata(organizationId, providerId)
      if (!currency) currency = storedMetadata.homeCurrency || ''
      if (!organizationName) organizationName = storedMetadata.companyName || ''
    }

    const client = new QuickBooksClient({ organizationId, realmId })

    if (!currency || !organizationName) {
      // Fallback: fetch from provider API
      const orgInfo = await withRetry(() => client.getCompanyInfo()).catch(() => ({
        Country: 'US',
        HomeCurrency: { value: 'USD' },
        CompanyName: 'Organization',
      }))

      if (!currency) currency = orgInfo.HomeCurrency?.value || 'USD'
      if (!organizationName) organizationName = orgInfo.CompanyName || 'Organization'

      // Store metadata for future requests - prefer per-connection storage
      if (realmId) {
        updateQBConnectionMetadata(organizationId, realmId, {
          homeCurrency: currency,
          companyName: organizationName !== 'Organization' ? organizationName : undefined,
        }).catch((err) =>
          console.warn(`${QB}[QB/ExecSummary]${RST} Failed to store connection metadata:`, err)
        )
      } else {
        updateProviderCompanyMetadata(organizationId, providerId, {
          homeCurrency: currency,
          companyName: organizationName !== 'Organization' ? organizationName : undefined,
        }).catch((err) =>
          console.warn(`${QB}[QB/ExecSummary]${RST} Failed to store metadata:`, err)
        )
      }
    }

    // Fetch all reports in parallel using QuickBooksClient directly
    const [pnl, previousPnl, balanceSheet, cashFlow, receivables, payables] = await Promise.all([
      // Current period P&L
      withRetry(() =>
        client.request(
          `/reports/ProfitAndLoss?start_date=${fromDate}&end_date=${toDate}&accounting_method=Accrual&minorversion=65`
        )
      ).catch((err: any) => {
        console.error(`${QB}[QB/ExecSummary]${RST} Failed to fetch P&L:`, err?.message || err)
        return null
      }),

      // Previous period P&L (skip for custom date ranges)
      prevFromDate && prevToDate
        ? withRetry(() =>
            client.request(
              `/reports/ProfitAndLoss?start_date=${prevFromDate}&end_date=${prevToDate}&accounting_method=Accrual&minorversion=65`
            )
          ).catch((err: any) => {
            console.error(
              `${QB}[QB/ExecSummary]${RST} Failed to fetch previous P&L:`,
              err?.message || err
            )
            return null
          })
        : Promise.resolve(null),

      // Balance Sheet
      withRetry(() =>
        client.request(
          `/reports/BalanceSheet?as_of=${toDate}&accounting_method=Accrual&minorversion=65`
        )
      ).catch((err: any) => {
        console.error(
          `${QB}[QB/ExecSummary]${RST} Failed to fetch Balance Sheet:`,
          err?.message || err
        )
        return null
      }),

      // Cash Flow
      withRetry(() =>
        client.request(
          `/reports/CashFlow?start_date=${fromDate}&end_date=${toDate}&minorversion=65`
        )
      ).catch((err: any) => {
        console.error(`${QB}[QB/ExecSummary]${RST} Failed to fetch Cash Flow:`, err?.message || err)
        return null
      }),

      // Aged Receivables
      withRetry(() =>
        client.request(`/reports/AgedReceivableDetail?report_date=${toDate}&minorversion=65`)
      ).catch((err: any) => {
        console.error(
          `${QB}[QB/ExecSummary]${RST} Failed to fetch Aged Receivables:`,
          err?.message || err
        )
        return null
      }),

      // Aged Payables
      withRetry(() =>
        client.request(`/reports/AgedPayableDetail?report_date=${toDate}&minorversion=65`)
      ).catch((err: any) => {
        console.error(
          `${QB}[QB/ExecSummary]${RST} Failed to fetch Aged Payables:`,
          err?.message || err
        )
        return null
      }),
    ])

    // Transform raw QB API responses to flat format expected by enricher/calculateKeyMetrics
    const flatPnl = pnl
      ? (() => {
          const t = transformProfitAndLoss(pnl)
          return {
            total_income: t.income.total,
            total_expenses: t.expenses.total,
            net_income: t.netIncome,
            gross_profit: t.grossProfit,
            cost_of_goods_sold: t.costOfGoodsSold.total,
            start_date: t.startDate,
            end_date: t.endDate,
            income_details: t.income.lines,
            expense_details: t.expenses.lines,
          }
        })()
      : null

    const flatPrevPnl = previousPnl
      ? (() => {
          const t = transformProfitAndLoss(previousPnl)
          return {
            total_income: t.income.total,
            total_expenses: t.expenses.total,
            net_income: t.netIncome,
            gross_profit: t.grossProfit,
            cost_of_goods_sold: t.costOfGoodsSold.total,
            start_date: t.startDate,
            end_date: t.endDate,
          }
        })()
      : null

    const flatBS = balanceSheet
      ? (() => {
          const t = transformBalanceSheet(balanceSheet)
          return {
            total_assets: t.assets.total,
            total_liabilities: t.liabilities.total,
            total_equity: t.equity.total,
            current_assets: t.assets.current.total,
            current_liabilities: t.liabilities.current.total,
            cash_and_equivalents: 0, // cashFlow.cash_at_end used as fallback
          }
        })()
      : null

    const flatCF = cashFlow
      ? (() => {
          const t = transformCashFlow(cashFlow)
          return {
            net_cash_from_operating_activities: t.operatingActivities.total,
            net_cash_from_investing_activities: t.investingActivities.total,
            net_cash_from_financing_activities: t.financingActivities.total,
            net_change_in_cash: t.netCashChange,
            cash_at_beginning: t.beginningCash,
            cash_at_end: t.endingCash,
          }
        })()
      : null

    const flatAR = receivables
      ? (() => {
          const t = transformAgedReportDetail(receivables)
          return { total: t.grandTotal }
        })()
      : null

    const flatAP = payables
      ? (() => {
          const t = transformAgedReportDetail(payables)
          return { total: t.grandTotal }
        })()
      : null

    // Enrich the executive summary
    const enriched = await enrichExecutiveSummary({
      organizationId,
      organizationName,
      currency,
      period,
      fromDate,
      toDate,
      prevFromDate,
      prevToDate,
      profitAndLoss: flatPnl,
      previousProfitAndLoss: flatPrevPnl,
      balanceSheet: flatBS,
      cashFlow: flatCF,
      receivables: flatAR,
      payables: flatAP,
    })

    // Add query time to metadata
    ;(enriched as any).metadata = {
      ...(enriched as any).metadata,
      queryTime: Date.now() - startTime,
      provider: providerId,
      organizationId,
      cached: false,
      generatedAt: new Date().toISOString(),
      nextUpdate: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    }

    console.log(`${QB}[QB/ExecSummary]${RST} ${DIM}${period} → ${Date.now() - startTime}ms${RST}`)

    return NextResponse.json({
      success: true,
      ...enriched,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`${QB}[QB/ExecSummary]${RST} Failed to generate report:`, errorMessage)

    // Determine error type and provide helpful response
    let statusCode = 500
    let userMessage = 'Failed to generate executive summary'
    let suggestion = 'Please try again or contact support'
    let retryAfter: number | undefined

    // Track error code for frontend handling
    let errorCode: string | undefined
    let requiresReconnect = false

    if (errorMessage.includes('No valid token') || errorMessage.includes('TOKEN_EXPIRED')) {
      statusCode = 401
      userMessage = 'QuickBooks authentication required'
      suggestion = 'Please reconnect your QuickBooks account in settings'
      errorCode = 'PROVIDER_INVALID_GRANT'
      requiresReconnect = true
    } else if (errorMessage.includes('not connected')) {
      statusCode = 401
      userMessage = 'QuickBooks account not connected'
      suggestion = 'Please reconnect your QuickBooks account in settings'
      errorCode = 'PROVIDER_NOT_CONNECTED'
      requiresReconnect = true
    } else if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('429') ||
      (error as any)?.code === 'RATE_LIMIT_EXCEEDED'
    ) {
      statusCode = 429
      userMessage = 'QuickBooks rate limit exceeded'
      suggestion =
        'QuickBooks has rate limited your requests. Please wait a few minutes and try again.'
      retryAfter = 120 // Suggest retry after 2 minutes
    } else if (errorMessage.includes('invalid_grant')) {
      statusCode = 401
      userMessage = 'QuickBooks authentication expired'
      suggestion = 'Please reconnect your QuickBooks account'
      errorCode = 'PROVIDER_INVALID_GRANT'
      requiresReconnect = true
    } else if (errorMessage.includes('timeout')) {
      statusCode = 504
      userMessage = 'Request timed out'
      suggestion = 'Please try again'
    }

    const response = NextResponse.json(
      {
        success: false,
        error: userMessage,
        code: errorCode,
        suggestion,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        timestamp: new Date().toISOString(),
        requiresReconnect,
        provider: 'quickbooks',
        ...(retryAfter && { retryAfter }),
      },
      { status: statusCode }
    )

    // Add Retry-After header for rate limit errors
    if (retryAfter) {
      response.headers.set('Retry-After', retryAfter.toString())
    }

    return response
  }
})
