/**
 * Balance Sheet Report API
 *
 * Enriched Balance Sheet endpoint with KPIs, ratios, and hierarchical data.
 * Frontend computes chart percentages/colors from hierarchy.
 *
 * GET /api/quickbooks/reports/balance-sheet?orgId=ORG%23xxx
 *
 * Query Parameters:
 * - orgId: Organization ID (required via withActiveProvider)
 * - date: As of date YYYY-MM-DD (optional, default: end of current month)
 */

import { NextResponse } from 'next/server'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { enrichBalanceSheet } from '@/quickbooks/reports/enrichers/balance-sheet'
import { formatDate } from '@/quickbooks/utils/accounts'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { withRetry, formatErrorResponse, formatReportDate } from '@/quickbooks/utils/route-helpers'
import { transformBalanceSheet, transformProfitAndLoss } from '@/quickbooks/reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get default as-of date (end of current month)
 */
function getDefaultAsOfDate(): string {
  const date = new Date()
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return formatDate(lastDay)
}

/**
 * Helper to extract currency from company info
 */
function getCurrency(info: any): string {
  if (info?.HomeCurrency?.value) return info.HomeCurrency.value
  if (info?.currency_code) return info.currency_code
  if (info?.Country === 'US') return 'USD'
  if (info?.Country === 'CA') return 'CAD'
  if (info?.Country === 'GB') return 'GBP'
  if (info?.Country === 'AU') return 'AUD'
  if (info?.Country === 'HK') return 'HKD'
  return 'USD'
}

/**
 * Calculate period averages for GAAP-compliant ROA/ROE
 */
async function fetchPeriodAverages(
  client: QuickBooksClient,
  plStartDate: string,
  plEndDate: string
): Promise<{ avgAssets: number; avgEquity: number } | null> {
  try {
    const beginningDate = new Date(plStartDate)
    beginningDate.setDate(beginningDate.getDate() - 1)
    const beginningDateStr = formatReportDate(beginningDate)

    const beginningParams = new URLSearchParams()
    beginningParams.set('end_date', beginningDateStr)
    beginningParams.set('accounting_method', 'Accrual')
    beginningParams.set('minorversion', '65')

    const endingParams = new URLSearchParams()
    endingParams.set('end_date', plEndDate)
    endingParams.set('accounting_method', 'Accrual')
    endingParams.set('minorversion', '65')

    const [rawBeginningBs, rawEndingBs] = await Promise.all([
      withRetry(() => client.request(`/reports/BalanceSheet?${beginningParams.toString()}`)),
      withRetry(() => client.request(`/reports/BalanceSheet?${endingParams.toString()}`)),
    ])

    const beginningBs = transformBalanceSheet(rawBeginningBs)
    const endingBs = transformBalanceSheet(rawEndingBs)

    return {
      avgAssets: (beginningBs.assets.total + endingBs.assets.total) / 2,
      avgEquity: (beginningBs.equity.total + endingBs.equity.total) / 2,
    }
  } catch (error) {
    console.error('[BS Report] Failed to fetch period averages:', error)
    return null
  }
}

// ============================================================================
// Main Route Handler
// ============================================================================

export const GET = withActiveProvider(
  async (request, { provider, apiClient, organizationId, providerId, realmId }) => {
    const { searchParams } = new URL(request.url)
    const asOfDate = searchParams.get('date') || getDefaultAsOfDate()
    const useAverages = searchParams.get('use_averages') === 'true'

    try {
      // Get company info for currency and name
      const client = new QuickBooksClient({ organizationId, realmId })
      const orgInfo = await withRetry(() => client.getCompanyInfo()).catch((err) => {
        console.error('[BS Report] Failed to fetch org info:', err)
        return null
      })

      const currency = getCurrency(orgInfo)
      const organizationName = orgInfo?.CompanyName || orgInfo?.name || 'Organization'

      // Build Balance Sheet params
      const bsParams = new URLSearchParams()
      bsParams.set('end_date', asOfDate)
      bsParams.set('accounting_method', 'Accrual')
      bsParams.set('minorversion', '65')

      // Fetch raw Balance Sheet report
      const rawBsReport = await withRetry(() =>
        client.request(`/reports/BalanceSheet?${bsParams.toString()}`)
      )

      // Normalize the raw report - this provides the clean hierarchy
      const normalizedBs = transformBalanceSheet(rawBsReport)

      // Fetch P&L data for ROA/ROE calculations
      const yearStart = new Date(asOfDate)
      yearStart.setMonth(0, 1)
      const plParams = new URLSearchParams()
      plParams.set('start_date', formatReportDate(yearStart))
      plParams.set('end_date', asOfDate)
      plParams.set('minorversion', '65')

      const rawPlReport = await withRetry(() =>
        client.request(`/reports/ProfitAndLoss?${plParams.toString()}`)
      )
      const normalizedPl = transformProfitAndLoss(rawPlReport)

      // Optionally fetch period averages for GAAP-compliant ROA/ROE
      let periodAverages: { avgAssets: number; avgEquity: number } | undefined
      if (useAverages) {
        const averages = await fetchPeriodAverages(client, formatReportDate(yearStart), asOfDate)
        if (averages) {
          periodAverages = averages
        }
      }

      // Build enricher input from normalized data
      const normalizedBsData = {
        reportDate: asOfDate,
        total_assets: normalizedBs.assets.total,
        total_liabilities: normalizedBs.liabilities.total,
        total_equity: normalizedBs.equity.total,
        current_assets: normalizedBs.assets.current.total,
        current_liabilities: normalizedBs.liabilities.current.total,
        assets: [
          ...normalizedBs.assets.current.lines
            .filter((l: any) => !l.isSummary)
            .map((l: any) => ({
              name: l.name,
              value: l.total,
              classification: 'current' as const,
            })),
          ...normalizedBs.assets.fixed.lines
            .filter((l: any) => !l.isSummary)
            .map((l: any) => ({
              name: l.name,
              value: l.total,
              classification: 'non-current' as const,
            })),
          ...normalizedBs.assets.other.lines
            .filter((l: any) => !l.isSummary)
            .map((l: any) => ({
              name: l.name,
              value: l.total,
              classification: 'non-current' as const,
            })),
        ],
        liabilities: [
          ...normalizedBs.liabilities.current.lines
            .filter((l: any) => !l.isSummary)
            .map((l: any) => ({
              name: l.name,
              value: l.total,
              classification: 'current' as const,
            })),
          ...normalizedBs.liabilities.longTerm.lines
            .filter((l: any) => !l.isSummary)
            .map((l: any) => ({
              name: l.name,
              value: l.total,
              classification: 'non-current' as const,
            })),
        ],
        equity: normalizedBs.equity.lines
          .filter((l: any) => !l.isSummary)
          .map((l: any) => ({ name: l.name, value: l.total })),
      }

      const normalizedPlData = {
        total_income: normalizedPl.income.total,
        net_income: normalizedPl.netIncome,
      }

      // Enrich with KPIs, ratios, and compositions
      const enrichedData = enrichBalanceSheet(
        normalizedBsData,
        normalizedPlData,
        currency,
        periodAverages
      )

      // Build simplified response with flattened structure
      const reportData = {
        reportType: 'balance_sheet',
        organizationId,
        organizationName,
        asOfDate,
        currency,
        generated: new Date().toISOString(),

        // Flattened KPIs (no nesting in data.kpis)
        ...enrichedData.data.kpis,

        // Flattened ratios (no nesting in data.ratios)
        ...enrichedData.data.ratios,

        // Tree-only hierarchy structure (frontend computes percentages/colors for charts)
        assetsHierarchy: {
          current: {
            total: normalizedBs.assets.current.total,
            children: normalizedBs.assets.current.hierarchy || [],
          },
          fixed: {
            total: normalizedBs.assets.fixed.total,
            children: normalizedBs.assets.fixed.hierarchy || [],
          },
          other: {
            total: normalizedBs.assets.other.total,
            children: normalizedBs.assets.other.hierarchy || [],
          },
          total: normalizedBs.assets.total,
        },
        liabilitiesHierarchy: {
          current: {
            total: normalizedBs.liabilities.current.total,
            children: (normalizedBs.liabilities.current as any).hierarchy || [],
          },
          longTerm: {
            total: normalizedBs.liabilities.longTerm.total,
            children: (normalizedBs.liabilities.longTerm as any).hierarchy || [],
          },
          total: normalizedBs.liabilities.total,
        },
        // Equity is flat (no nested categories), convert lines to children format
        equityHierarchy: {
          total: normalizedBs.equity.total,
          children: normalizedBs.equity.lines
            .filter((l: any) => !l.isSummary && l.name !== 'Equity')
            .map((l: any) => ({
              name: l.name,
              value: l.total,
              accountId: l.accountId,
            })),
        },
      }

      return NextResponse.json(reportData)
    } catch (error) {
      return formatErrorResponse(error, 'Failed to generate balance sheet report')
    }
  }
)
