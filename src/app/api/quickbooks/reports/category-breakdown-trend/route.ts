/**
 * Category Breakdown Trend API
 *
 * Returns monthly breakdown of expenses and revenue by category for line chart visualization.
 * This is a separate endpoint that does NOT modify existing P&L trend data.
 *
 * GET /api/quickbooks/reports/category-breakdown-trend
 *
 * Query Parameters:
 * - start: Start date YYYY-MM-DD
 * - end: End date YYYY-MM-DD
 */

import { NextResponse } from 'next/server'
import { transformProfitAndLoss } from '@/quickbooks/reports'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { withRetry, formatErrorResponse } from '@/quickbooks/utils/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Format "Jan 2024" or "January 2024" to just "Jan"
function formatShortMonth(period: string): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]

  for (const month of months) {
    if (period.toLowerCase().startsWith(month.toLowerCase())) {
      return month
    }
  }

  // Fallback: return first 3 chars
  return period.slice(0, 3)
}

export const GET = withActiveProvider(async (request, { organizationId, realmId }) => {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams

  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 })
  }

  try {
    // Build params for monthly breakdown
    const reportParams = new URLSearchParams()
    reportParams.set('start_date', startDate)
    reportParams.set('end_date', endDate)
    reportParams.set('summarize_column_by', 'Month')
    reportParams.set('minorversion', '65')

    // Fetch raw P&L report with monthly breakdown
    const client = new QuickBooksClient({ organizationId, realmId })
    console.log('[CategoryBreakdownTrend] Fetching P&L with params:', reportParams.toString())

    const rawReport = await withRetry(() =>
      client.request(`/reports/ProfitAndLoss?${reportParams.toString()}`)
    )

    console.log('[CategoryBreakdownTrend] Raw report received, has Rows:', !!rawReport?.Rows)

    // Normalize the raw report
    let normalized
    try {
      normalized = transformProfitAndLoss(rawReport)
      console.log('[CategoryBreakdownTrend] Transform successful')
    } catch (transformError) {
      console.error('[CategoryBreakdownTrend] Transform failed:', transformError)
      throw transformError
    }

    // Debug logging
    console.log('[CategoryBreakdownTrend] Normalized columns:', normalized.columns)
    console.log('[CategoryBreakdownTrend] Expense lines count:', normalized.expenses?.lines?.length)
    console.log('[CategoryBreakdownTrend] Income lines count:', normalized.income?.lines?.length)

    // Get period columns (exclude "Total") with null safety
    const columns = normalized.columns ?? []
    const periodColumns = columns.filter((col) => !col.toLowerCase().includes('total'))
    const labels = periodColumns.map(formatShortMonth)

    console.log('[CategoryBreakdownTrend] Period columns:', periodColumns)
    console.log('[CategoryBreakdownTrend] Labels:', labels)

    // Extract expense series (top 10 by total)
    // Filter: non-summary lines only (matching profit-loss/trend approach)
    const allExpenseLines = normalized.expenses?.lines ?? []
    console.log('[CategoryBreakdownTrend] All expense lines:', allExpenseLines.length)

    // Log the levels to understand the data structure
    const levelCounts = allExpenseLines.reduce(
      (acc, line) => {
        const key = `level_${line.level ?? 'undefined'}_summary_${line.isSummary}`
        acc[key] = (acc[key] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )
    console.log('[CategoryBreakdownTrend] Expense line level distribution:', levelCounts)

    // Filter for non-summary lines only (let the sort/slice handle getting top categories)
    const expenseLines = allExpenseLines.filter((line) => !line.isSummary)
    console.log('[CategoryBreakdownTrend] Non-summary expense lines:', expenseLines.length)

    if (expenseLines.length > 0) {
      console.log('[CategoryBreakdownTrend] First expense line:', {
        name: expenseLines[0].name,
        level: expenseLines[0].level,
        values: expenseLines[0].values,
        total: expenseLines[0].total,
      })
    }

    const expenseSeries = expenseLines
      .map((line) => ({
        name: line.name,
        data: periodColumns.map((_, i) => Math.abs(line.values?.[`col_${i}`] ?? 0)),
        total: Math.abs(line.total ?? 0),
      }))
      .filter((s) => s.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(({ total, ...rest }) => rest) // Remove total from final output

    console.log('[CategoryBreakdownTrend] Final expense series count:', expenseSeries.length)

    // Extract revenue series (top 10 by total)
    const allRevenueLines = normalized.income?.lines ?? []
    const revenueLines = allRevenueLines.filter((line) => !line.isSummary)
    console.log('[CategoryBreakdownTrend] Non-summary revenue lines:', revenueLines.length)

    const revenueSeries = revenueLines
      .map((line) => ({
        name: line.name,
        data: periodColumns.map((_, i) => line.values?.[`col_${i}`] ?? 0),
        total: line.total ?? 0,
      }))
      .filter((s) => s.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(({ total, ...rest }) => rest) // Remove total from final output

    console.log('[CategoryBreakdownTrend] Final revenue series count:', revenueSeries.length)

    // Get currency from org info
    const orgInfo = await withRetry(() => client.getCompanyInfo()).catch(() => null)
    const currency = orgInfo?.HomeCurrency?.value || 'USD'

    const responseData = {
      reportType: 'category_breakdown_trend',
      organizationId,
      fromDate: startDate,
      toDate: endDate,
      currency,
      generated: new Date().toISOString(),
      data: {
        expenses: {
          labels,
          series: expenseSeries,
        },
        revenue: {
          labels,
          series: revenueSeries,
        },
      },
      metadata: {
        queryTime: Date.now() - startTime,
        periodCount: labels.length,
        expenseCategoryCount: expenseSeries.length,
        revenueCategoryCount: revenueSeries.length,
      },
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('[CategoryBreakdownTrend] Full error:', error)
    console.error(
      '[CategoryBreakdownTrend] Error stack:',
      error instanceof Error ? error.stack : 'No stack'
    )
    return formatErrorResponse(error, 'Failed to generate category breakdown trend data')
  }
})
