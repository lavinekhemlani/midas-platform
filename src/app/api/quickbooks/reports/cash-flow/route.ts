/**
 * Cash Flow Report API
 *
 * Unified endpoint for fetching enriched Cash Flow Statement reports.
 * Returns the same structure as /api/reports/cash-flow for compatibility.
 *
 * GET /api/quickbooks/reports/cash-flow
 *
 * Query Parameters:
 * - start: Start date YYYY-MM-DD (optional, default: 6 months ago)
 * - end: End date YYYY-MM-DD (optional, default: today)
 * - details: Include detailed activities (optional, default: true)
 */

import { createReportTracker } from '@/lib/monitoring/reportPerformance'
import { getProviderCompanyMetadata, updateProviderCompanyMetadata } from '@/lib/providers/database'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { calculateTotalExpenses } from '@/lib/utils/financial/reportCalculations'
import { withRetry } from '@/lib/utils/throttle'
import { transformCashFlow } from '@/quickbooks/reports/transformers'
import {
  getAccountsPayable,
  getAccountsReceivable,
  getCashAndEquivalents,
  getInventoryValue,
} from '@/quickbooks/utils/accounts'
import {
  calculateCashFlowMetrics as calculateCashFlowMetricsHelper,
  calculateDaysInventory as calculateDaysInventoryHelper,
  calculateDaysPayable as calculateDaysPayableHelper,
  calculateDaysReceivable as calculateDaysReceivableHelper,
  getDefaultCashFlowEndDate,
  getDefaultCashFlowStartDate,
} from '@/quickbooks/utils/report-helpers'
import type { CashFlowActivity, CashFlowMetrics as CashFlowMetricsType } from '@/types/cashflow'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Request deduplication cache
const requestCache = new Map<string, Promise<any>>()

// Get default date range (last 6 months)
function getDefaultStartDate(): string {
  return getDefaultCashFlowStartDate()
}

function getDefaultEndDate(): string {
  return getDefaultCashFlowEndDate()
}

// Wrapper function for cash metrics calculation
function calculateCashMetrics(
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
): CashFlowMetricsType {
  return calculateCashFlowMetricsHelper(
    cashBalance,
    monthlyExpenses,
    operatingCashFlow,
    currentLiabilities,
    capitalExpenditures,
    revenue,
    daysReceivable,
    daysPayable,
    daysInventory,
    totalDebt,
    totalExpenses,
    periodMonths
  )
}

// Wrapper functions for calculating days metrics
async function calculateDaysReceivable(
  orgId: string,
  revenue: number,
  realmId?: string
): Promise<number> {
  return calculateDaysReceivableHelper(orgId, revenue, (id: string) =>
    getAccountsReceivable(id, undefined, realmId)
  )
}

async function calculateDaysPayable(
  orgId: string,
  expenses: number,
  realmId?: string
): Promise<number> {
  return calculateDaysPayableHelper(orgId, expenses, (id: string) =>
    getAccountsPayable(id, undefined, realmId)
  )
}

async function calculateDaysInventory(
  orgId: string,
  cogs: number,
  realmId?: string
): Promise<number> {
  return calculateDaysInventoryHelper(orgId, cogs, (id: string) => getInventoryValue(id, realmId))
}

export const GET = withActiveProvider(
  async (request, { provider, apiClient, organizationId, providerId, realmId }) => {
    // Initialize performance tracker
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start') || getDefaultStartDate()
    const endDate = searchParams.get('end') || getDefaultEndDate()
    const includeDetails = searchParams.get('details') !== 'false'

    const performanceTracker = createReportTracker('cash_flow', organizationId, {
      startDate,
      endDate,
      includeDetails,
    })

    try {
      // Input validation
      const startDateObj = new Date(startDate)
      const endDateObj = new Date(endDate)

      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format. Please use YYYY-MM-DD format.' },
          { status: 400 }
        )
      }

      if (startDateObj > endDateObj) {
        return NextResponse.json({ error: 'Start date must be before end date.' }, { status: 400 })
      }

      // Get company metadata - prefer stored values to avoid API calls
      const storedMetadata = await getProviderCompanyMetadata(organizationId, providerId)

      // Helper function to extract currency from company info
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

      let currency: string = storedMetadata.homeCurrency || ''

      if (!currency) {
        // Fallback: fetch from QuickBooksClient (also stores for future use)
        const client = new QuickBooksClient({ organizationId, realmId })
        const orgInfo = await withRetry(() => client.getCompanyInfo()).catch((err) => {
          console.error('[CF Report] Failed to fetch org info:', err)
          return null
        })

        currency = orgInfo ? getCurrency(orgInfo) : 'USD'

        // Store metadata for future requests
        if (orgInfo) {
          updateProviderCompanyMetadata(organizationId, providerId, {
            homeCurrency: currency,
            companyName: orgInfo.CompanyName || undefined,
          }).catch((err) => console.warn('[Cash Flow] Failed to store metadata:', err))
        }
      }

      // CORE DATA: Use QuickBooksClient for direct API calls
      const client = new QuickBooksClient({ organizationId, realmId })

      // Build Cash Flow params
      const cfParams = new URLSearchParams()
      cfParams.set('start_date', startDate)
      cfParams.set('end_date', endDate)
      cfParams.set('minorversion', '65')

      // Fetch raw Cash Flow report
      const rawCfReport = await withRetry(() =>
        client.request(`/reports/CashFlow?${cfParams.toString()}`)
      )

      // Transform to normalized format that matches the expected cfData structure
      const cfData: any = {
        net_cash_from_operating_activities: 0,
        net_cash_from_investing_activities: 0,
        net_cash_from_financing_activities: 0,
        cash_at_beginning: 0,
        cash_at_end: 0,
      }

      // Parse the raw QuickBooks Cash Flow report
      const cfRows = rawCfReport?.Rows?.Row || []
      for (const section of cfRows) {
        const sectionType = section.group || section.Header?.ColData?.[0]?.value || ''
        const sectionTotal = section.Summary?.ColData?.[1]?.value

        if (
          sectionType.includes('OperatingActivities') ||
          sectionType.toLowerCase().includes('operating')
        ) {
          cfData.net_cash_from_operating_activities = parseFloat(sectionTotal) || 0
        } else if (
          sectionType.includes('InvestingActivities') ||
          sectionType.toLowerCase().includes('investing')
        ) {
          cfData.net_cash_from_investing_activities = parseFloat(sectionTotal) || 0
        } else if (
          sectionType.includes('FinancingActivities') ||
          sectionType.toLowerCase().includes('financing')
        ) {
          cfData.net_cash_from_financing_activities = parseFloat(sectionTotal) || 0
        }

        // Look for cash beginning/ending in row data
        // QB Cash Flow reports have cash balance as standalone data rows,
        // not just section headers - check both Header.ColData and ColData directly
        const headerLabel = section.Header?.ColData?.[0]?.value?.toLowerCase() || ''
        const dataLabel = section.ColData?.[0]?.value?.toLowerCase() || ''
        const label = headerLabel || dataLabel

        if (label.includes('beginning') && label.includes('cash')) {
          // Value can be in Summary OR directly in ColData
          const value =
            section.Summary?.ColData?.[section.Summary.ColData.length - 1]?.value ||
            section.ColData?.[section.ColData.length - 1]?.value
          const parsed = parseFloat(value) || 0
          if (parsed !== 0 || cfData.cash_at_beginning === 0) {
            cfData.cash_at_beginning = parsed
          }
        }
        if (
          (label.includes('end') && label.includes('cash')) ||
          label.includes('cash and cash equivalents at end')
        ) {
          const value =
            section.Summary?.ColData?.[section.Summary.ColData.length - 1]?.value ||
            section.ColData?.[section.ColData.length - 1]?.value
          const parsed = parseFloat(value) || 0
          if (parsed !== 0 || cfData.cash_at_end === 0) {
            cfData.cash_at_end = parsed
          }
        }
      }

      // Build P&L params
      const plParams = new URLSearchParams()
      plParams.set('start_date', startDate)
      plParams.set('end_date', endDate)
      plParams.set('minorversion', '65')

      // Fetch raw P&L report
      const rawPlReport = await withRetry(() =>
        client.request(`/reports/ProfitAndLoss?${plParams.toString()}`)
      )

      // Parse the raw QuickBooks P&L report
      const plData: any = {
        net_income: 0,
        total_income: 0,
        cogs_total: 0,
        total_expenses: 0,
        other_expenses: 0,
        cost_of_goods_sold: 0,
      }

      const plRows = rawPlReport?.Rows?.Row || []
      for (const section of plRows) {
        const sectionType = section.group || ''
        const sectionTotal = parseFloat(section.Summary?.ColData?.[1]?.value) || 0

        if (sectionType === 'Income') {
          plData.total_income = sectionTotal
        } else if (sectionType === 'COGS') {
          plData.cogs_total = sectionTotal
          plData.cost_of_goods_sold = sectionTotal
        } else if (sectionType === 'Expenses') {
          plData.total_expenses = sectionTotal
        } else if (sectionType === 'OtherExpenses') {
          plData.other_expenses = sectionTotal
        } else if (sectionType === 'NetIncome') {
          plData.net_income = sectionTotal
        }
      }

      // Also check for NetIncome row directly
      if (plData.net_income === 0) {
        plData.net_income =
          plData.total_income - plData.cogs_total - plData.total_expenses - plData.other_expenses
      }

      // Get current cash balance
      const cashBalance = await getCashAndEquivalents(organizationId, realmId)

      console.log('[Cash Flow API] Core data received:', {
        operatingCF: cfData.net_cash_from_operating_activities,
        investingCF: cfData.net_cash_from_investing_activities,
        financingCF: cfData.net_cash_from_financing_activities,
        cashAtBeginning: cfData.cash_at_beginning,
        cashAtEnd: cfData.cash_at_end,
        cashBalanceFromQuery: cashBalance,
        netIncome: plData.net_income,
      })

      // Calculate TRUE total expenses (COGS + Operating + Other) to match P&L and Summary views
      const trueTotalExpenses = calculateTotalExpenses(
        plData.cogs_total || 0,
        plData.total_expenses || 0,
        plData.other_expenses || 0
      )

      // Calculate monthly expenses for burn rate - use Math.round for consistency with P&L API
      const periodMonths = Math.max(
        1,
        Math.round(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
        )
      )
      const monthlyExpenses = trueTotalExpenses / periodMonths

      // Get Balance Sheet data for liabilities ratio calculation
      const bsParams = new URLSearchParams()
      bsParams.set('date_macro', 'Today')
      bsParams.set('minorversion', '65')

      const rawBsReport = await withRetry(() =>
        client.request(`/reports/BalanceSheet?${bsParams.toString()}`)
      )

      // Parse Balance Sheet for total liabilities
      const bsData: any = { total_liabilities: 0 }
      const bsRows = rawBsReport?.Rows?.Row || []
      for (const section of bsRows) {
        const sectionType = section.group || ''
        if (sectionType === 'Liabilities' || sectionType.includes('Liabilities')) {
          bsData.total_liabilities = parseFloat(section.Summary?.ColData?.[1]?.value) || 0
          break
        }
      }

      // Calculate advanced metrics with additional data
      const capitalExpenditures = Math.abs(cfData.net_cash_from_investing_activities || 0)
      const revenue = plData.total_income || 0
      const totalDebt = bsData.total_liabilities || 0

      // Calculate days metrics (simplified estimates)
      const daysReceivable = await calculateDaysReceivable(organizationId, revenue, realmId)
      const daysPayable = await calculateDaysPayable(organizationId, trueTotalExpenses, realmId)
      const daysInventory = await calculateDaysInventory(
        organizationId,
        plData.cost_of_goods_sold,
        realmId
      )

      const cashMetrics = calculateCashMetrics(
        cashBalance,
        monthlyExpenses,
        cfData.net_cash_from_operating_activities,
        bsData.total_liabilities * 0.5, // Estimate current liabilities as 50% of total
        capitalExpenditures,
        revenue,
        daysReceivable,
        daysPayable,
        daysInventory,
        totalDebt,
        trueTotalExpenses,
        periodMonths
      )

      // Calculate net cash flow
      const netCashFlow =
        (cfData.net_cash_from_operating_activities || 0) +
        (cfData.net_cash_from_investing_activities || 0) +
        (cfData.net_cash_from_financing_activities || 0)

      // Transform the raw report to get normalized data (always needed for cash balances)
      const normalizedCF = transformCashFlow(rawCfReport)

      // SUPPLEMENTARY DATA: Get detailed activities from transformer
      let operatingActivitiesData: CashFlowActivity[] | undefined
      let investingActivities: CashFlowActivity[] | undefined
      let financingActivities: CashFlowActivity[] | undefined
      const allErrors: string[] = []

      if (includeDetails) {
        // Convert transformer lines to CashFlowActivity format
        operatingActivitiesData = normalizedCF.operatingActivities.lines
          .filter((line) => !line.isSummary && line.name)
          .map((line) => ({
            item: line.name,
            amount: line.value || line.total || 0,
          }))

        investingActivities = normalizedCF.investingActivities.lines
          .filter((line) => !line.isSummary && line.name)
          .map((line) => ({
            item: line.name,
            amount: line.value || line.total || 0,
          }))

        financingActivities = normalizedCF.financingActivities.lines
          .filter((line) => !line.isSummary && line.name)
          .map((line) => ({
            item: line.name,
            amount: line.value || line.total || 0,
          }))
      }

      // Build cash flow summary chart data
      // Use QB Cash Flow report's historical values as primary source
      // Fall back to transformer values, then current bank balance only as last resort
      const endingCashValue = cfData.cash_at_end || normalizedCF.endingCash || cashBalance

      // Use QB report's beginning cash, fallback to derived value
      const beginningCashValue =
        cfData.cash_at_beginning || normalizedCF.beginningCash || endingCashValue - netCashFlow

      // Log data sources for debugging
      console.log('[Cash Flow] Cash balance sources:', {
        qbReportBeginning: cfData.cash_at_beginning,
        qbReportEnding: cfData.cash_at_end,
        transformerBeginning: normalizedCF.beginningCash,
        transformerEnding: normalizedCF.endingCash,
        currentBankBalance: cashBalance,
        usedBeginning: beginningCashValue,
        usedEnding: endingCashValue,
      })

      // Horizontal bar chart shows actual values (positive = right, negative = left)
      const waterfallChart = [
        {
          name: 'Beginning Cash',
          value: beginningCashValue,
        },
        {
          name: 'Operating',
          value: cfData.net_cash_from_operating_activities || 0,
        },
        {
          name: 'Investing',
          value: cfData.net_cash_from_investing_activities || 0,
        },
        {
          name: 'Financing',
          value: cfData.net_cash_from_financing_activities || 0,
        },
        {
          name: 'Ending Cash',
          value: endingCashValue,
        },
      ]

      // Build response matching frontend structure
      const reportData = {
        reportType: 'cash_flow',
        organizationId,
        organizationName: 'Organization',
        fromDate: startDate,
        toDate: endDate,
        currency,
        generated: new Date().toISOString(),
        data: {
          kpis: {
            operatingCashFlow: cfData.net_cash_from_operating_activities || 0,
            investingCashFlow: cfData.net_cash_from_investing_activities || 0,
            financingCashFlow: cfData.net_cash_from_financing_activities || 0,
            netCashFlow,
            cashBeginning: beginningCashValue,
            cashEnding: endingCashValue,
          },
          cashMetrics,
          operatingActivities: operatingActivitiesData,
          investingActivities: investingActivities,
          financingActivities: financingActivities,
          waterfallChart,
          errors: allErrors.length > 0 ? allErrors : undefined,
          metadata: {
            dataQuality: {
              isComplete: allErrors.length === 0,
              hasPartialData: allErrors.length > 0,
              errors: allErrors.map((errMsg) => ({
                type:
                  errMsg.includes('rate limit') || errMsg.includes('429')
                    ? 'rate_limit'
                    : 'fetch_error',
                message: errMsg,
                severity:
                  errMsg.includes('rate limit') || errMsg.includes('429') ? 'warning' : 'error',
              })),
              warnings:
                allErrors.length > 0
                  ? allErrors.map((errMsg) => {
                      if (errMsg.includes('rate limit') || errMsg.includes('429')) {
                        return 'Some cash flow details are unavailable due to QuickBooks rate limiting. Please try again in a few minutes.'
                      }
                      return `Some cash flow details are unavailable: ${errMsg}`
                    })
                  : [],
            },
          },
        },
      }

      console.log('[Cash Flow API] Returning KPIs:', {
        operatingCashFlow: reportData.data.kpis.operatingCashFlow,
        cashEnding: reportData.data.kpis.cashEnding,
        cashBeginning: reportData.data.kpis.cashBeginning,
        netCashFlow: reportData.data.kpis.netCashFlow,
      })

      // Track successful report generation
      performanceTracker.complete(true)

      return NextResponse.json(reportData)
    } catch (error) {
      console.error('Error generating cash flow report:', error)

      // Track failed report generation
      performanceTracker.markError(error)
      performanceTracker.complete(false)

      // Extract error message
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Determine error type and provide helpful response
      let statusCode = 500
      let userMessage = 'Failed to generate cash flow report'
      let suggestion = 'Please try again or contact support'
      let requiresReconnect = false
      let retryAfter: number | undefined

      // Track error code for frontend handling
      let errorCode: string | undefined

      if (errorMessage.includes('not connected')) {
        statusCode = 401
        userMessage = 'QuickBooks account not connected'
        suggestion = 'Please reconnect your QuickBooks account in settings'
        requiresReconnect = true
        errorCode = 'PROVIDER_NOT_CONNECTED'
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
        requiresReconnect = true
        errorCode = 'PROVIDER_INVALID_GRANT'
      } else if (errorMessage.includes('timeout')) {
        statusCode = 504
        userMessage = 'Request timed out'
        suggestion = 'Try selecting a smaller date range'
      }

      const response = NextResponse.json(
        {
          error: userMessage,
          code: errorCode,
          suggestion,
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          timestamp: new Date().toISOString(),
          requiresReconnect,
          provider: 'quickbooks',
          userMessage: `${userMessage}. ${suggestion}`,
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
  }
)
