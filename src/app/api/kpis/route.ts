// src/app/api/kpis/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { transformBankTransactionsForCashFlow } from '@/lib/utils/dataTransformers'
import { formatCurrency } from '@/lib/utils/currency'
import { ZohoRateLimitedClient } from '@/lib/providers/zoho/rateLimitedClient'
import { getProviderCompanyMetadata, updateProviderCompanyMetadata } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

// Helper function to format dates for API (YYYY-MM-DD)
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function calculateTrend(
  current: number,
  previous: number
): { direction: 'up' | 'down' | 'stable'; percentage: number } {
  if (previous === 0)
    return { direction: current > 0 ? 'up' : 'stable', percentage: current > 0 ? 100 : 0 }
  const change = ((current - previous) / previous) * 100
  return {
    direction: Math.abs(change) < 1 ? 'stable' : change > 0 ? 'up' : 'down',
    percentage: Math.round(change * 10) / 10,
  }
}

export const GET = withActiveProvider(
  async (request, { provider, apiClient, organizationId, providerId }) => {
    try {
      const startTime = Date.now()
      const apiCallTimings: {
        name: string
        duration: number
        status: 'success' | 'failed' | 'cached'
      }[] = []

      const { searchParams } = new URL(request.url)
      console.log(
        `[KPI API] Starting - Provider: ${providerId}, Mode: ${searchParams.get('mode') || 'full'}`
      )
      const chartPeriod = searchParams.get('chartPeriod') || '12months'
      const mode = searchParams.get('mode') || 'full'

      // Calculate date ranges
      const now = new Date()
      const lookbackDays = 30
      const thirtyDaysAgo = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000)

      // Use LAST COMPLETE MONTH for P&L data to avoid partial month issues
      const lastCompleteMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      const lastCompleteMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

      // For quarterly calculations
      const threeMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 3, 1)

      // Current month for comparison
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

      // For current data, prefer last complete month if we're early in current month
      // This ensures we get data from QuickBooks when current month might be incomplete
      const dayOfMonth = now.getDate()
      const useLastCompleteMonth = dayOfMonth < 5 // Use last complete month if we're in first 5 days

      const currentPeriodStart = useLastCompleteMonth ? lastCompleteMonthStart : currentMonthStart
      const currentPeriodEnd = useLastCompleteMonth ? lastCompleteMonthEnd : now

      // Detect if we're in production based on URL or environment
      const isProduction =
        process.env.NODE_ENV === 'production' ||
        process.env.VERCEL_ENV === 'production' ||
        !request.url.includes('localhost')

      // Use longer timeouts in production where network might be slower
      const defaultTimeout = isProduction ? 20000 : 16000

      // Helper function to track API call timing with timeout
      const trackApiCall = async (
        name: string,
        apiCall: () => Promise<any>,
        timeoutMs: number = defaultTimeout
      ) => {
        const callStart = Date.now()
        try {
          // Create a timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error(`API call timed out after ${timeoutMs}ms`)),
              timeoutMs
            )
          })

          // Race between the actual API call and the timeout
          const result = await Promise.race([apiCall(), timeoutPromise])
          const duration = Date.now() - callStart
          apiCallTimings.push({ name, duration, status: 'success' })
          console.log(`[API Call] ${name}: ${duration}ms`)
          return result
        } catch (error) {
          const duration = Date.now() - callStart
          apiCallTimings.push({ name, duration, status: 'failed' })
          console.log(
            `[API Call] ${name}: FAILED after ${duration}ms:`,
            (error as any)?.message || error
          )
          throw error
        }
      }

      // Check for stored metadata first to avoid unnecessary API calls
      const storedMetadata = await getProviderCompanyMetadata(organizationId, providerId)
      let currency = storedMetadata.homeCurrency || ''
      let organizationName = storedMetadata.companyName || ''

      // PHASE 1: Get essential data
      let quarterlyPnL: any, currentPeriodPnL: any, balanceSheet: any, cashFlow: any

      // Use sequential requests for Zoho to avoid rate limits
      const phase1Start = Date.now()
      if (providerId === 'zoho') {
        const rateLimitedClient = new ZohoRateLimitedClient(apiClient)

        // Build requests array - only include org info if we don't have stored metadata
        const requests: (() => Promise<any>)[] = []

        if (!currency) {
          requests.push(() =>
            trackApiCall('Organization Info', () =>
              (provider.organizations.getOrganizationInfo as any)(organizationId, apiClient)
            )
          )
        }

        requests.push(
          // Quarterly P&L for stable metrics and ARR
          () =>
            trackApiCall('P&L Report (Quarterly)', () =>
              (provider.reports.profitAndLoss as any)(
                organizationId,
                {
                  from_date: formatDate(threeMonthsAgoStart),
                  to_date: formatDate(lastCompleteMonthEnd),
                  report_basis: 'accrual',
                },
                apiClient
              )
            ),

          // Current period P&L (either current month or last complete month)
          () =>
            trackApiCall('P&L Report (Current Period)', () =>
              (provider.reports.profitAndLoss as any)(
                organizationId,
                {
                  from_date: formatDate(currentPeriodStart),
                  to_date: formatDate(currentPeriodEnd),
                  report_basis: 'accrual',
                },
                apiClient
              )
            ),

          // Balance sheet
          () =>
            trackApiCall('Balance Sheet', () =>
              (provider.reports.balanceSheet as any)(
                organizationId,
                {
                  as_of_date: formatDate(now),
                  report_basis: 'accrual',
                },
                apiClient
              )
            ),

          // Cash flow
          () =>
            trackApiCall('Cash Flow Statement', () =>
              (provider.reports.cashFlow as any)(
                organizationId,
                {
                  from_date: formatDate(thirtyDaysAgo),
                  to_date: formatDate(now),
                },
                apiClient
              )
            )
        )

        // Execute critical requests sequentially with delays
        const results = await rateLimitedClient.executeSequential(requests, 700)

        if (!currency) {
          const orgInfo = results[0]
          ;[quarterlyPnL, currentPeriodPnL, balanceSheet, cashFlow] = results.slice(1)
          currency = orgInfo?.currency_code || 'USD'
          organizationName = orgInfo?.name || 'Your Organization'

          // Store metadata for future requests
          updateProviderCompanyMetadata(organizationId, providerId, {
            homeCurrency: currency,
            companyName: organizationName !== 'Your Organization' ? organizationName : undefined,
          }).catch((err) => console.warn('[KPI API] Failed to store metadata:', err))
        } else {
          ;[quarterlyPnL, currentPeriodPnL, balanceSheet, cashFlow] = results
          if (!organizationName) organizationName = 'Your Organization'
        }
      } else {
        // For other providers (QuickBooks), use parallel requests
        // Only fetch org info if we don't have stored metadata
        if (!currency) {
          const [orgInfo, ...reportResults] = await Promise.all([
            trackApiCall('Organization Info', () =>
              (provider.organizations.getOrganizationInfo as any)(organizationId, apiClient)
            ),
            trackApiCall('P&L Report (Quarterly)', () =>
              (provider.reports.profitAndLoss as any)(
                organizationId,
                {
                  from_date: formatDate(threeMonthsAgoStart),
                  to_date: formatDate(lastCompleteMonthEnd),
                  report_basis: 'accrual',
                },
                apiClient
              )
            ),
            trackApiCall('P&L Report (Current Period)', () =>
              (provider.reports.profitAndLoss as any)(
                organizationId,
                {
                  from_date: formatDate(currentPeriodStart),
                  to_date: formatDate(currentPeriodEnd),
                  report_basis: 'accrual',
                },
                apiClient
              )
            ),
            trackApiCall('Balance Sheet', () =>
              (provider.reports.balanceSheet as any)(
                organizationId,
                {
                  as_of_date: formatDate(now),
                  report_basis: 'accrual',
                },
                apiClient
              )
            ),
            trackApiCall('Cash Flow Statement', () =>
              (provider.reports.cashFlow as any)(
                organizationId,
                {
                  from_date: formatDate(thirtyDaysAgo),
                  to_date: formatDate(now),
                },
                apiClient
              )
            ),
          ])

          ;[quarterlyPnL, currentPeriodPnL, balanceSheet, cashFlow] = reportResults
          currency = orgInfo?.currency_code || 'USD'
          organizationName = orgInfo?.name || 'Your Organization'

          // Store metadata for future requests
          updateProviderCompanyMetadata(organizationId, providerId, {
            homeCurrency: currency,
            companyName: organizationName !== 'Your Organization' ? organizationName : undefined,
          }).catch((err) => console.warn('[KPI API] Failed to store metadata:', err))
        } else {
          // We have stored metadata, skip org info API call
          ;[quarterlyPnL, currentPeriodPnL, balanceSheet, cashFlow] = await Promise.all([
            trackApiCall('P&L Report (Quarterly)', () =>
              (provider.reports.profitAndLoss as any)(
                organizationId,
                {
                  from_date: formatDate(threeMonthsAgoStart),
                  to_date: formatDate(lastCompleteMonthEnd),
                  report_basis: 'accrual',
                },
                apiClient
              )
            ),
            trackApiCall('P&L Report (Current Period)', () =>
              (provider.reports.profitAndLoss as any)(
                organizationId,
                {
                  from_date: formatDate(currentPeriodStart),
                  to_date: formatDate(currentPeriodEnd),
                  report_basis: 'accrual',
                },
                apiClient
              )
            ),
            trackApiCall('Balance Sheet', () =>
              (provider.reports.balanceSheet as any)(
                organizationId,
                {
                  as_of_date: formatDate(now),
                  report_basis: 'accrual',
                },
                apiClient
              )
            ),
            trackApiCall('Cash Flow Statement', () =>
              (provider.reports.cashFlow as any)(
                organizationId,
                {
                  from_date: formatDate(thirtyDaysAgo),
                  to_date: formatDate(now),
                },
                apiClient
              )
            ),
          ])
          if (!organizationName) organizationName = 'Your Organization'
        }
      }
      console.log(
        `[PHASE 1] Completed in ${Date.now() - phase1Start}ms (${providerId === 'zoho' ? 'sequential' : 'parallel'}, metadata cached: ${!!storedMetadata.homeCurrency})`
      )

      // Log date ranges used for debugging
      console.log('[KPI API] Date ranges:', {
        currentPeriod: {
          start: formatDate(currentPeriodStart),
          end: formatDate(currentPeriodEnd),
          usingLastCompleteMonth: useLastCompleteMonth,
        },
        quarterly: {
          start: formatDate(threeMonthsAgoStart),
          end: formatDate(lastCompleteMonthEnd),
        },
        lastCompleteMonth: {
          start: formatDate(lastCompleteMonthStart),
          end: formatDate(lastCompleteMonthEnd),
        },
      })

      // If current period P&L returns no data, try to use quarterly data instead
      if (
        !currentPeriodPnL ||
        (currentPeriodPnL.total_income === 0 && currentPeriodPnL.total_expenses === 0)
      ) {
        console.log(
          '[KPI API] Current period P&L returned no data, using quarterly data for current metrics'
        )
        // Use the most recent month from quarterly data
        currentPeriodPnL = {
          total_income: quarterlyPnL?.total_income ? quarterlyPnL.total_income / 3 : 0,
          total_expenses: quarterlyPnL?.total_expenses ? quarterlyPnL.total_expenses / 3 : 0,
          cogs_total: quarterlyPnL?.cogs_total ? quarterlyPnL.cogs_total / 3 : 0,
          other_expenses: quarterlyPnL?.other_expenses ? quarterlyPnL.other_expenses / 3 : 0,
          gross_profit: quarterlyPnL?.gross_profit ? quarterlyPnL.gross_profit / 3 : 0,
          net_income: quarterlyPnL?.net_income ? quarterlyPnL.net_income / 3 : 0,
        }
      }

      // Extract last complete month from quarterly P&L
      // IMPORTANT: Include all THREE expense components to match reports pages
      const lastMonthPnL = {
        total_income: quarterlyPnL?.total_income ? quarterlyPnL.total_income / 3 : 0,
        total_expenses: quarterlyPnL?.total_expenses ? quarterlyPnL.total_expenses / 3 : 0, // Operating expenses only
        gross_profit: quarterlyPnL?.gross_profit ? quarterlyPnL.gross_profit / 3 : 0,
        net_income: quarterlyPnL?.net_income ? quarterlyPnL.net_income / 3 : 0,
        cost_of_goods_sold: quarterlyPnL?.cost_of_goods_sold
          ? quarterlyPnL.cost_of_goods_sold / 3
          : 0,
        cogs_total: quarterlyPnL?.cogs_total ? quarterlyPnL.cogs_total / 3 : 0, // COGS group
        other_expenses: quarterlyPnL?.other_expenses ? quarterlyPnL.other_expenses / 3 : 0, // Other expenses group
      }

      // Calculate TRUE total expenses (matching reports pages)
      const trueTotalExpensesQuarterly =
        (quarterlyPnL?.cogs_total || quarterlyPnL?.cost_of_goods_sold || 0) +
        (quarterlyPnL?.total_expenses || 0) +
        (quarterlyPnL?.other_expenses || 0)
      const trueTotalExpensesMonthly = trueTotalExpensesQuarterly / 3

      // Log P&L data
      console.log('P&L Data and TRUE Expense Calculation:', {
        quarterly: {
          total_income: quarterlyPnL?.total_income,
          total_expenses: quarterlyPnL?.total_expenses,
          cogs_total: quarterlyPnL?.cogs_total || quarterlyPnL?.cost_of_goods_sold,
          other_expenses: quarterlyPnL?.other_expenses,
          TRUE_TOTAL: trueTotalExpensesQuarterly,
        },
        currentPeriod: {
          total_income: currentPeriodPnL?.total_income,
          total_expenses: currentPeriodPnL?.total_expenses,
          cogs_total: currentPeriodPnL?.cogs_total || currentPeriodPnL?.cost_of_goods_sold,
          other_expenses: currentPeriodPnL?.other_expenses,
          period: `${formatDate(currentPeriodStart)} to ${formatDate(currentPeriodEnd)}`,
        },
        calculated: {
          trueTotalExpensesMonthly,
          burnRate: trueTotalExpensesMonthly,
        },
      })

      // For progressive mode, return Phase 1 data immediately
      if (mode === 'progressive') {
        // Calculate all KPIs from P&L/Balance Sheet/Cash Flow data
        const currentRevenue = currentPeriodPnL?.total_income || 0
        const stableMonthlyRevenue = lastMonthPnL.total_income || 0

        // Calculate TRUE expenses (matching reports pages: COGS + Operating + Other)
        const currentTrueExpenses =
          (currentPeriodPnL?.cogs_total || currentPeriodPnL?.cost_of_goods_sold || 0) +
          (currentPeriodPnL?.total_expenses || 0) +
          (currentPeriodPnL?.other_expenses || 0)
        const stableMonthlyExpenses = trueTotalExpensesMonthly // Use the true total we calculated above

        // Calculate gross profit - only from real data, no assumptions
        const grossProfit =
          lastMonthPnL.gross_profit ??
          (lastMonthPnL.cost_of_goods_sold != null
            ? stableMonthlyRevenue - lastMonthPnL.cost_of_goods_sold
            : null)

        const netIncome = lastMonthPnL.net_income || stableMonthlyRevenue - stableMonthlyExpenses

        // Calculate ARR using quarterly data for stability
        let arr = 0
        if (quarterlyPnL && quarterlyPnL.total_income > 0) {
          arr = quarterlyPnL.total_income * 4
        } else if (currentRevenue > 0) {
          arr = currentRevenue * 12
        }

        // Margins
        const grossMargin =
          grossProfit != null && stableMonthlyRevenue > 0
            ? Math.round((grossProfit / stableMonthlyRevenue) * 1000) / 10
            : null
        const netProfitMargin =
          stableMonthlyRevenue > 0 ? Math.round((netIncome / stableMonthlyRevenue) * 1000) / 10 : 0

        // Cash metrics - use real OCF data only, no 80% assumption
        const operatingCashFlow = cashFlow?.net_cash_from_operating_activities ?? null

        const cashBalance = balanceSheet?.cash_and_equivalents || cashFlow?.cash_at_end || 0

        const monthlyBurn =
          stableMonthlyExpenses > 0
            ? Math.round(stableMonthlyExpenses * 100) / 100
            : operatingCashFlow != null
              ? Math.round(Math.abs(operatingCashFlow) * 100) / 100
              : null
        const runway =
          monthlyBurn != null && monthlyBurn > 0
            ? Math.round((cashBalance / monthlyBurn) * 100) / 100
            : null

        // Build KPI array
        const kpis = [
          {
            metric: 'arr',
            value: arr,
            trend: { direction: 'stable' as const, percentage: 0 },
            period_end: now.toISOString(),
            last_update_ts: Date.now() / 1000,
            next_update_ts: Date.now() / 1000 + 1800,
            dataSource:
              quarterlyPnL && quarterlyPnL.total_income > 0
                ? `P&L (Last 3 months) × 4`
                : currentRevenue > 0
                  ? `P&L (Rolling 30-day) × 12`
                  : 'No revenue data',
            period:
              quarterlyPnL && quarterlyPnL.total_income > 0
                ? `${formatDate(threeMonthsAgoStart)} to ${formatDate(lastCompleteMonthEnd)}`
                : `${formatDate(thirtyDaysAgo)} to ${formatDate(now)}`,
            calculation:
              quarterlyPnL && quarterlyPnL.total_income > 0
                ? `${formatCurrency(quarterlyPnL.total_income, { currency })} × 4 = ${formatCurrency(arr, { currency })}`
                : currentRevenue > 0
                  ? `${formatCurrency(currentRevenue, { currency })} × 12 = ${formatCurrency(arr, { currency })}`
                  : 'N/A',
          },
          {
            metric: 'gross_profit',
            value: grossProfit,
            trend: { direction: 'stable' as const, percentage: 0 },
            period_end: now.toISOString(),
            last_update_ts: Date.now() / 1000,
            next_update_ts: Date.now() / 1000 + 1800,
            dataSource: lastMonthPnL.gross_profit
              ? 'P&L Report (gross_profit field)'
              : 'Calculated from P&L',
            period: `Monthly avg from ${formatDate(threeMonthsAgoStart)} to ${formatDate(lastCompleteMonthEnd)}`,
            calculation: lastMonthPnL.gross_profit
              ? `Direct from P&L: ${formatCurrency(grossProfit, { currency })}`
              : lastMonthPnL.cost_of_goods_sold
                ? `${formatCurrency(stableMonthlyRevenue, { currency })} - ${formatCurrency(lastMonthPnL.cost_of_goods_sold, { currency })} = ${formatCurrency(grossProfit, { currency })}`
                : `${formatCurrency(stableMonthlyRevenue, { currency })} × 0.7 = ${formatCurrency(grossProfit, { currency })}`,
          },
          {
            metric: 'gross_margin_pct',
            value: grossMargin,
            trend: { direction: 'stable' as const, percentage: 0 },
            period_end: now.toISOString(),
            last_update_ts: Date.now() / 1000,
            next_update_ts: Date.now() / 1000 + 1800,
            dataSource: stableMonthlyRevenue > 0 ? 'Calculated from P&L' : 'No revenue data',
            period: `Monthly avg from ${formatDate(threeMonthsAgoStart)} to ${formatDate(lastCompleteMonthEnd)}`,
            calculation:
              grossMargin != null && stableMonthlyRevenue > 0
                ? `(${formatCurrency(grossProfit, { currency })} ÷ ${formatCurrency(stableMonthlyRevenue, { currency })}) × 100 = ${grossMargin.toFixed(1)}%`
                : 'N/A - Unable to calculate',
          },
          {
            metric: 'net_profit_margin',
            value: netProfitMargin,
            trend: { direction: 'stable' as const, percentage: 0 },
            period_end: now.toISOString(),
            last_update_ts: Date.now() / 1000,
            next_update_ts: Date.now() / 1000 + 1800,
            dataSource: 'Calculated from P&L',
            period: `Monthly avg from ${formatDate(threeMonthsAgoStart)} to ${formatDate(lastCompleteMonthEnd)}`,
            calculation:
              stableMonthlyRevenue > 0
                ? `(${formatCurrency(netIncome, { currency })} ÷ ${formatCurrency(stableMonthlyRevenue, { currency })}) × 100 = ${netProfitMargin.toFixed(1)}%`
                : 'N/A - No revenue',
          },
          {
            metric: 'burn_rate',
            value: monthlyBurn,
            trend: { direction: 'stable' as const, percentage: 0 },
            period_end: now.toISOString(),
            last_update_ts: Date.now() / 1000,
            next_update_ts: Date.now() / 1000 + 1800,
            dataSource: 'P&L Report total_expenses',
            period: `Monthly avg from ${formatDate(threeMonthsAgoStart)} to ${formatDate(lastCompleteMonthEnd)}`,
            calculation:
              monthlyBurn != null
                ? `Monthly operating costs: ${formatCurrency(monthlyBurn, { currency })}/month`
                : 'N/A - Unable to calculate',
          },
          {
            metric: 'runway_months',
            value: runway,
            trend: { direction: 'stable' as const, percentage: 0 },
            period_end: now.toISOString(),
            last_update_ts: Date.now() / 1000,
            next_update_ts: Date.now() / 1000 + 1800,
            dataSource: 'Calculated from cash and burn rate',
            period: 'Current',
            calculation:
              runway != null && monthlyBurn != null && monthlyBurn > 0
                ? `${formatCurrency(cashBalance, { currency })} ÷ ${formatCurrency(monthlyBurn, { currency })}/month = ${runway.toFixed(1)} months`
                : monthlyBurn === 0
                  ? 'Infinite (no burn)'
                  : 'N/A - Unable to calculate',
          },
          {
            metric: 'cash_balance',
            value: cashBalance,
            trend: { direction: 'stable' as const, percentage: 0 },
            period_end: now.toISOString(),
            last_update_ts: Date.now() / 1000,
            next_update_ts: Date.now() / 1000 + 1800,
            dataSource: cashFlow?.cash_at_end ? 'Cash Flow Statement' : 'Balance Sheet',
            period: `As of ${formatDate(now)}`,
            calculation: `Current cash: ${formatCurrency(cashBalance, { currency })}`,
          },
          {
            metric: 'ocf',
            value: operatingCashFlow,
            trend: { direction: 'stable' as const, percentage: 0 },
            period_end: now.toISOString(),
            last_update_ts: Date.now() / 1000,
            next_update_ts: Date.now() / 1000 + 1800,
            dataSource: cashFlow?.net_cash_from_operating_activities
              ? 'Cash Flow Statement'
              : 'Estimated from P&L',
            period: `${formatDate(thirtyDaysAgo)} to ${formatDate(now)}`,
            calculation: cashFlow?.net_cash_from_operating_activities
              ? `From cash flow statement: ${formatCurrency(operatingCashFlow, { currency })}`
              : `Estimated (Net Income × 0.8): ${formatCurrency(operatingCashFlow, { currency })}`,
          },
        ]

        // Get revenue/expense trend chart data
        let chartData = []
        const monthsToFetch = chartPeriod === '3months' ? 3 : chartPeriod === '6months' ? 6 : 12

        try {
          const monthlyTrends = await (provider.reports.getMonthlyTrends as any)(
            organizationId,
            monthsToFetch,
            apiClient
          )

          if (monthlyTrends && monthlyTrends.length > 0) {
            chartData = monthlyTrends
          }
        } catch (error) {
          console.error('Error fetching monthly trends:', error)
        }

        // Return Phase 1 data immediately
        console.log('[PHASE 1] Returning KPIs and charts immediately')
        return NextResponse.json({
          organizationName,
          currency,
          provider: providerId,
          lastSync: Math.floor(Date.now() / 1000),
          basis: 'accrual',
          kpis,
          charts: {
            revenueExpenseTrend: chartData,
            dailyCashFlow: [], // Will be populated in Phase 2
            expenseBreakdown: [],
          },
          recentTransactions: [], // Will be populated in Phase 2
          insights: [],
          revenueBreakdown: [], // Will be populated in Phase 2
          revenueBreakdownTotal: 0,
          memorySummary: null,
          phase: 1,
          hasMoreData: true,
        })
      }

      // Full mode - fetch everything including Phase 2 data
      let invoices = []
      let expenses = []
      let recentTransactions = []
      let bankAccounts = []

      // Check if we need additional data when P&L is incomplete
      const needInvoices = currentPeriodPnL?.total_income === 0 || !currentPeriodPnL
      const needExpenses = lastMonthPnL?.total_expenses === 0 || !lastMonthPnL

      try {
        const phase2Start = Date.now()
        if (providerId === 'zoho') {
          const rateLimitedClient = new ZohoRateLimitedClient(apiClient)

          // Execute Phase 2 requests sequentially for Zoho
          const phase2Results = await rateLimitedClient.executeSequential(
            [
              // Get invoices - only if P&L incomplete
              () =>
                needInvoices
                  ? trackApiCall('Invoices (30 days)', () =>
                      (provider.invoices.listInvoices as any)(
                        organizationId,
                        {
                          per_page: 200,
                          sort_order: 'D',
                          from_date: formatDate(thirtyDaysAgo),
                          to_date: formatDate(now),
                        },
                        apiClient
                      )
                    ).catch(() => [])
                  : Promise.resolve([]),

              // Get expenses - only if P&L incomplete
              () =>
                needExpenses
                  ? trackApiCall('Expenses (30 days)', () =>
                      (provider.expenses.listExpenses as any)(
                        organizationId,
                        {
                          per_page: 200,
                          sort_order: 'D',
                          from_date: formatDate(thirtyDaysAgo),
                          to_date: formatDate(now),
                        },
                        apiClient
                      )
                    ).catch(() => [])
                  : Promise.resolve([]),

              // Get recent bank transactions (always needed)
              () =>
                trackApiCall('Bank Transactions', () =>
                  (provider.banking.getRecentTransactions as any)(organizationId, 30, {}, apiClient)
                ).catch(() => []),

              // Get bank accounts
              () =>
                trackApiCall('Bank Accounts', () =>
                  (provider.banking.listBankAccounts as any)(organizationId, {}, apiClient)
                ).catch(() => []),
            ],
            700
          ) // 700ms delay between requests

          ;[invoices, expenses, recentTransactions, bankAccounts] = phase2Results as [
            any[],
            any[],
            any[],
            any[],
          ]
        } else {
          // For other providers (QuickBooks), use proper date parameters
          const invoiceParams =
            providerId === 'quickbooks'
              ? {
                  per_page: 200,
                  sort_order: 'D',
                  date_start: formatDate(thirtyDaysAgo), // QuickBooks uses date_start
                  date_end: formatDate(now), // QuickBooks uses date_end
                }
              : {
                  per_page: 200,
                  sort_order: 'D',
                  from_date: formatDate(thirtyDaysAgo),
                  to_date: formatDate(now),
                }

          const expenseParams =
            providerId === 'quickbooks'
              ? {
                  per_page: 200,
                  sort_order: 'D',
                  date_start: formatDate(thirtyDaysAgo),
                  date_end: formatDate(now),
                }
              : {
                  per_page: 200,
                  sort_order: 'D',
                  from_date: formatDate(thirtyDaysAgo),
                  to_date: formatDate(now),
                }

          ;[invoices, expenses, recentTransactions, bankAccounts] = await Promise.all([
            needInvoices
              ? trackApiCall(
                  'Invoices (30 days)',
                  () =>
                    (provider.invoices.listInvoices as any)(
                      organizationId,
                      invoiceParams,
                      apiClient
                    ),
                  isProduction ? 18000 : 14000 // Longer timeout in production
                ).catch(async (error) => {
                  console.error(
                    '[KPI] Failed to fetch 200 invoices, trying with smaller page size:',
                    error?.message || error
                  )
                  // Keep same date range but reduce page size for faster response
                  const fallbackParams =
                    providerId === 'quickbooks'
                      ? {
                          per_page: 30, // Reduce to 30 items - should get top invoices by value
                          sort_order: 'D', // Sort descending to get most recent/largest first
                          date_start: formatDate(thirtyDaysAgo), // Keep 30 day range
                          date_end: formatDate(now),
                        }
                      : {
                          per_page: 30, // Reduce to 30 items
                          sort_order: 'D', // Sort descending
                          from_date: formatDate(thirtyDaysAgo), // Keep 30 day range
                          to_date: formatDate(now),
                        }

                  return trackApiCall(
                    'Invoices (30 days, reduced page size)',
                    () =>
                      (provider.invoices.listInvoices as any)(
                        organizationId,
                        fallbackParams,
                        apiClient
                      ),
                    isProduction ? 15000 : 11000 // Longer timeout for fallback in production
                  ).catch(async (error2) => {
                    console.error(
                      '[KPI] Reduced page size also failed, trying minimal fetch:',
                      error2?.message || error2
                    )
                    // Last resort: get just 10 most recent invoices
                    const minimalParams =
                      providerId === 'quickbooks'
                        ? {
                            per_page: 10, // Minimal set
                            sort_order: 'D',
                            date_start: formatDate(thirtyDaysAgo),
                            date_end: formatDate(now),
                          }
                        : {
                            per_page: 10,
                            sort_order: 'D',
                            from_date: formatDate(thirtyDaysAgo),
                            to_date: formatDate(now),
                          }

                    return trackApiCall(
                      'Invoices (minimal fallback)',
                      () =>
                        (provider.invoices.listInvoices as any)(
                          organizationId,
                          minimalParams,
                          apiClient
                        ),
                      8000 // Shorter timeout for minimal fetch
                    ).catch(() => {
                      console.error('[KPI] All invoice fetch attempts failed')
                      return []
                    })
                  })
                })
              : Promise.resolve([]),

            needExpenses
              ? trackApiCall('Expenses (30 days)', () =>
                  (provider.expenses?.listExpenses as any)?.(
                    organizationId,
                    expenseParams,
                    apiClient
                  )
                ).catch((error) => {
                  console.error('[KPI] Failed to fetch expenses:', error?.message || error)
                  return []
                })
              : Promise.resolve([]),

            trackApiCall('Bank Transactions', () =>
              (provider.banking.getRecentTransactions as any)(organizationId, 30, {}, apiClient)
            ).catch((error) => {
              console.error('[KPI] Failed to fetch bank transactions:', error?.message || error)
              return []
            }),

            trackApiCall('Bank Accounts', () =>
              (provider.banking.listBankAccounts as any)(organizationId, {}, apiClient)
            ).catch((error) => {
              console.error('[KPI] Failed to fetch bank accounts:', error?.message || error)
              return []
            }),
          ])
        }
        console.log(
          `[PHASE 2] Completed in ${Date.now() - phase2Start}ms (${providerId === 'zoho' ? 'sequential' : 'parallel'})`
        )
      } catch (error) {
        console.warn('Error fetching supporting data:', error)
      }

      // Use appropriate data sources for different metrics
      // Current revenue from current period P&L (fresh data)
      let currentRevenue = currentPeriodPnL?.total_income || 0
      // Stable revenue for margins from last month (extracted from quarterly)
      let stableMonthlyRevenue = lastMonthPnL.total_income || 0

      let totalInvoiceRevenue = 0
      const revenueByCustomer = new Map<string, { name: string; amount: number }>()

      if (Array.isArray(invoices)) {
        console.log('[Revenue Breakdown] Processing invoices:', {
          count: invoices.length,
          firstInvoice: invoices[0]
            ? {
                keys: Object.keys(invoices[0]),
                id: invoices[0].id,
                invoice_id: invoices[0].invoice_id,
                customer_id: invoices[0].customer_id,
                customer_name: invoices[0].customer_name,
                total: invoices[0].total,
                amount: invoices[0].amount,
                TotalAmt: invoices[0].TotalAmt,
              }
            : 'No invoices',
        })

        invoices.forEach((inv: any) => {
          // The QuickBooks provider already transforms to 'total' field
          // Prioritize the transformed field names first
          const amount = parseFloat(
            String(inv.total ?? inv.amount ?? inv.TotalAmt ?? inv.Total ?? 0)
          )

          if (amount > 0) {
            totalInvoiceRevenue += amount

            // Use the transformed field names from the provider
            const customerId =
              inv.customer_id || inv.CustomerId || inv.CustomerRef?.value || 'unknown'
            const customerName =
              inv.customer_name || inv.CustomerName || inv.CustomerRef?.name || 'Unknown Customer'

            if (!revenueByCustomer.has(customerId)) {
              revenueByCustomer.set(customerId, { name: customerName, amount: 0 })
            }

            const customer = revenueByCustomer.get(customerId)!
            customer.amount += amount
          }
        })

        // Use invoice revenue if P&L revenue is 0
        if (currentRevenue === 0 && totalInvoiceRevenue > 0) {
          currentRevenue = totalInvoiceRevenue
          console.log('Using invoice revenue as fallback:', totalInvoiceRevenue)
        }
        if (stableMonthlyRevenue === 0 && totalInvoiceRevenue > 0) {
          stableMonthlyRevenue = totalInvoiceRevenue
        }
      } else if (providerId === 'quickbooks' && currentRevenue === 0) {
        // Special case for QuickBooks: Some customers record revenue as deposits
        // Phase 2 will check for income deposits as a fallback
        console.log(
          '[Phase1] No invoice revenue and P&L shows 0 income - Phase 2 will check for deposit-based revenue'
        )
      }

      // Calculate TRUE expenses from P&L (matching reports pages: COGS + Operating + Other)
      let currentExpenses =
        (currentPeriodPnL?.cogs_total || currentPeriodPnL?.cost_of_goods_sold || 0) +
        (currentPeriodPnL?.total_expenses || 0) +
        (currentPeriodPnL?.other_expenses || 0)
      let stableMonthlyExpenses = trueTotalExpensesMonthly // Use the pre-calculated true total
      let totalExpenseAmount = 0

      if (Array.isArray(expenses)) {
        totalExpenseAmount = expenses.reduce(
          (sum: number, exp: any) => sum + parseFloat(exp.total || exp.amount || '0'),
          0
        )

        // Use expense total if P&L expenses is 0
        if (currentExpenses === 0 && totalExpenseAmount > 0) {
          currentExpenses = totalExpenseAmount
          console.log('Using expense total as fallback:', totalExpenseAmount)
        }
        if (stableMonthlyExpenses === 0 && totalExpenseAmount > 0) {
          stableMonthlyExpenses = totalExpenseAmount
        }
      }

      // Calculate gross profit using stable monthly data
      const grossProfit =
        lastMonthPnL.gross_profit ||
        stableMonthlyRevenue - (lastMonthPnL.cost_of_goods_sold || 0) ||
        stableMonthlyRevenue * 0.7 // Assume 70% gross margin if no COGS data

      const netIncome = lastMonthPnL.net_income || stableMonthlyRevenue - stableMonthlyExpenses

      // Calculate ARR using quarterly data for stability
      let arr = 0
      if (quarterlyPnL && quarterlyPnL.total_income > 0) {
        // Use quarterly revenue × 4 (most stable)
        arr = quarterlyPnL.total_income * 4
      } else if (currentRevenue > 0) {
        // Fallback to current month × 12
        arr = currentRevenue * 12
      }
      // No mock data if no revenue

      // Margins - use stable monthly data for consistency
      const grossMargin =
        stableMonthlyRevenue > 0 ? Math.round((grossProfit / stableMonthlyRevenue) * 1000) / 10 : 0
      const netProfitMargin =
        stableMonthlyRevenue > 0 ? Math.round((netIncome / stableMonthlyRevenue) * 1000) / 10 : 0

      // Cash metrics with detailed logging
      console.log('Cash Flow object keys:', Object.keys(cashFlow || {}))
      console.log('Cash Flow values:', {
        net_cash_from_operating_activities: cashFlow?.net_cash_from_operating_activities,
        cash_at_end: cashFlow?.cash_at_end,
        cash_at_beginning: cashFlow?.cash_at_beginning,
        net_change_in_cash: cashFlow?.net_change_in_cash,
        full_object: cashFlow,
      })

      const cashBalance =
        cashFlow.cash_at_end ||
        balanceSheet.cash_and_equivalents ||
        bankAccounts.reduce((sum: number, a: any) => sum + (a.balance || 0), 0)

      // Try multiple sources for Operating Cash Flow
      let operatingCashFlow = cashFlow.net_cash_from_operating_activities || 0

      // If OCF is 0, try to estimate it from P&L data
      if (operatingCashFlow === 0 && (currentRevenue > 0 || currentExpenses > 0)) {
        // Simple OCF approximation: Net Income + Non-cash expenses
        // For now, we'll use Net Income as a proxy
        const estimatedOCF = netIncome
        console.log(
          `OCF is 0, estimating from P&L: Revenue ${currentRevenue} - Expenses ${currentExpenses} = ${estimatedOCF}`
        )
        operatingCashFlow = estimatedOCF
      }

      // Round to 2 decimal places to avoid floating point precision issues
      operatingCashFlow = Math.round(operatingCashFlow * 100) / 100

      console.log('Operating Cash Flow final value:', operatingCashFlow)

      // Calculate burn rate using stable monthly expenses
      const monthlyBurn =
        Math.round(
          (stableMonthlyExpenses > 0 ? stableMonthlyExpenses : Math.abs(operatingCashFlow)) * 100
        ) / 100
      const runway = Math.round((monthlyBurn > 0 ? cashBalance / monthlyBurn : 999) * 100) / 100

      // Get AR and AP from balance sheet for DSO/DPO calculations
      const accountsReceivable = balanceSheet.accounts_receivable || 0
      const accountsPayable = balanceSheet.accounts_payable || 0

      // Calculate daily revenue and expenses for DSO/DPO
      const dailyRevenue = currentRevenue / 30
      const dailyExpenses = currentExpenses / 30

      // Calculate DSO (Days Sales Outstanding)
      const calculateDSO = () => {
        if (accountsReceivable > 0 && dailyRevenue > 0) {
          return Math.round(accountsReceivable / dailyRevenue)
        }
        // If we have unpaid invoice data, use that as fallback
        if (invoices && Array.isArray(invoices)) {
          const unpaidInvoices = invoices.filter(
            (inv: any) => parseFloat(inv.balance || inv.Balance || 0) > 0
          )
          if (unpaidInvoices.length > 0 && dailyRevenue > 0) {
            const totalUnpaid = unpaidInvoices.reduce(
              (sum: number, inv: any) => sum + parseFloat(inv.balance || inv.Balance || 0),
              0
            )
            return Math.round(totalUnpaid / dailyRevenue)
          }
        }
        return 30 // Default fallback
      }

      // Calculate DPO (Days Payable Outstanding)
      const calculateDPO = () => {
        if (accountsPayable > 0 && dailyExpenses > 0) {
          return Math.round(accountsPayable / dailyExpenses)
        }
        return 30 // Default fallback
      }

      // Transform ALL transactions for accurate cash flow calculation
      const transformedTransactions: any[] = []

      // Add ALL invoices (not just first 10) for accurate cash flow
      if (invoices && Array.isArray(invoices)) {
        invoices.forEach((inv: any) => {
          transformedTransactions.push({
            id: inv.invoice_id || inv.id,
            type: 'invoice' as const,
            description: `Invoice #${inv.invoice_number || inv.number} - ${inv.customer_name || 'Customer'}`,
            amount: Math.abs(parseFloat(inv.total || inv.amount || 0)), // Keep positive for display
            date: inv.date || inv.invoice_date,
            status: inv.status || 'pending',
          })
        })
      }

      // Add ALL expenses (not just first 10) for accurate cash flow
      if (expenses && Array.isArray(expenses)) {
        expenses.forEach((exp: any) => {
          transformedTransactions.push({
            id: exp.expense_id || exp.id,
            type: 'expense' as const,
            description: exp.description || exp.account_name || 'Expense',
            amount: Math.abs(parseFloat(exp.total || exp.amount || 0)), // Keep positive for display
            date: exp.date || exp.expense_date,
            status: exp.status || 'completed',
          })
        })
      }

      // Add ALL bank transactions for complete cash flow
      if (recentTransactions && Array.isArray(recentTransactions)) {
        recentTransactions.forEach((txn: any) => {
          // Skip if this transaction might be a duplicate of an invoice or expense
          const txnAmount = parseFloat(txn.amount || 0)
          const txnDate = new Date(txn.date || txn.transaction_date).toDateString()
          const txnDesc = (txn.description || txn.payee_name || '').toLowerCase()

          // More robust duplicate detection
          const isDuplicate = transformedTransactions.some((t) => {
            const sameAmount = Math.abs(t.amount) === Math.abs(txnAmount)
            const sameDate = new Date(t.date).toDateString() === txnDate
            const similarDesc =
              t.description.toLowerCase().includes(txnDesc.slice(0, 10)) ||
              txnDesc.includes(t.description.toLowerCase().slice(0, 10))

            // Consider it duplicate if amount and date match, or if all three are similar
            return (sameAmount && sameDate) || (sameAmount && similarDesc)
          })

          if (!isDuplicate) {
            // Interpret transaction based on debit/credit field if available
            let transactionType: 'invoice' | 'expense'
            if (txn.debit_or_credit) {
              // Bank format: debit = money IN (invoice), credit = money OUT (expense)
              transactionType = txn.debit_or_credit === 'debit' ? 'invoice' : 'expense'
            } else {
              // Fallback: positive = invoice, negative = expense
              transactionType = txnAmount > 0 ? 'invoice' : 'expense'
            }

            transformedTransactions.push({
              id: txn.transaction_id || txn.id || `bank_${Date.now()}_${Math.random()}`,
              type: transactionType,
              description:
                txn.description || txn.payee_name || txn.reference_number || 'Bank Transaction',
              amount: Math.abs(txnAmount), // Always store positive amount, type indicates direction
              date: txn.date || txn.transaction_date || new Date().toISOString(),
              status: txn.status || 'completed',
            })
          }
        })
      }

      // Sort by date
      transformedTransactions.sort((a, b) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return dateB - dateA
      })
      const recentTransactionsList = transformedTransactions.slice(0, 20)

      // Transform daily cash flow from ALL transactions (not just recent)
      // Use the full transformedTransactions array for accurate totals
      const dailyCashFlow = transformBankTransactionsForCashFlow(transformedTransactions, 30)

      // Calculate total inflow/outflow for the period
      let totalInflow = 0
      let totalOutflow = 0
      transformedTransactions.forEach((txn) => {
        // Only count transactions from last 30 days
        const txnDate = new Date(txn.date)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        if (txnDate >= thirtyDaysAgo) {
          if (txn.type === 'invoice') {
            totalInflow += txn.amount
          } else if (txn.type === 'expense') {
            totalOutflow += txn.amount
          }
        }
      })

      console.log('Cash Flow Totals (Last 30 days):', {
        totalInflow,
        totalOutflow,
        netFlow: totalInflow - totalOutflow,
        transactionCount: transformedTransactions.length,
        invoiceCount: invoices?.length || 0,
        expenseCount: expenses?.length || 0,
      })

      // Build revenue breakdown from customer data
      const isPartialData = Array.isArray(invoices) && invoices.length > 0 && invoices.length <= 30
      console.log('Building revenue breakdown:', {
        invoicesCount: invoices?.length || 0,
        invoicesAvailable: Array.isArray(invoices) && invoices.length > 0,
        isPartialData,
        revenueByCustomerSize: revenueByCustomer.size,
        currentRevenue,
        stableMonthlyRevenue,
        totalInvoiceRevenue,
        sampleInvoice: invoices?.[0] ? Object.keys(invoices[0]) : 'No invoices',
      })

      const topRevenueCustomers = Array.from(revenueByCustomer.values())
        .filter((c) => c.amount > 0) // Only include customers with revenue
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)
        .map((customer) => ({
          source: customer.name,
          amount: Math.round(customer.amount * 100) / 100, // Round to 2 decimals
          percentage:
            totalInvoiceRevenue > 0
              ? Math.round((customer.amount / totalInvoiceRevenue) * 1000) / 10
              : 0,
        }))

      console.log('[Revenue Breakdown] Final results:', {
        revenueByCustomerCount: revenueByCustomer.size,
        totalInvoiceRevenue,
        topRevenueCustomersCount: topRevenueCustomers.length,
        topCustomers: topRevenueCustomers.slice(0, 3),
      })

      // Revenue breakdown - only use actual customer data
      let revenueBreakdown: any[] = []
      let revenueBreakdownTotal = 0

      if (topRevenueCustomers.length > 0) {
        // Use actual customer data from invoices
        revenueBreakdown = topRevenueCustomers
        revenueBreakdownTotal = totalInvoiceRevenue
        console.log(
          'Using customer-based revenue breakdown:',
          revenueBreakdown.length,
          'customers, total:',
          totalInvoiceRevenue
        )
      } else if (revenueByCustomer.size > 0) {
        // If we have customer data but all amounts were filtered out, still try to show something
        console.log('[Revenue Breakdown] Warning: Have customers but no amounts > 0')
        revenueBreakdown = []
        revenueBreakdownTotal = 0
      } else {
        // No invoice data at all
        console.log('[Revenue Breakdown] No customer invoice data available')
        revenueBreakdown = []
        revenueBreakdownTotal = 0
      }

      console.log('Revenue breakdown generated:', {
        breakdownLength: revenueBreakdown.length,
        breakdown: revenueBreakdown.slice(0, 3), // Log first 3 entries
        totalAmount: revenueBreakdown.reduce((sum: number, item: any) => sum + item.amount, 0),
      })

      // Simple expense breakdown
      const expenseBreakdown = [
        {
          category: 'Operating Expenses',
          amount: currentExpenses,
          percentage: 100,
        },
      ]

      // Fetch proper monthly trends based on period
      let chartData = []
      let monthsToFetch = 12 // Default to 12 months

      if (chartPeriod === '3months') {
        monthsToFetch = 3
      } else if (chartPeriod === '6months') {
        monthsToFetch = 6
      } else {
        monthsToFetch = 12 // Default to 12 months for '12months' or any other value
      }

      try {
        // Get monthly trends from the provider
        const monthlyTrends = await (provider.reports.getMonthlyTrends as any)(
          organizationId,
          monthsToFetch,
          apiClient
        )

        if (monthlyTrends && monthlyTrends.length > 0) {
          chartData = monthlyTrends
          console.log(`Fetched ${monthlyTrends.length} months of trends data`)
        } else {
          // Fallback: generate estimated data if no trends available
          console.log('No monthly trends data, using fallback estimates')
          const estimatedData = []

          for (let i = monthsToFetch - 1; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const isCurrentMonth = i === 0

            // Use actual data for current month, estimates for others
            const revenueFactor = isCurrentMonth ? 1 : 0.9 + Math.random() * 0.2
            const expenseFactor = isCurrentMonth ? 1 : 0.95 + Math.random() * 0.1

            estimatedData.push({
              month: monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
              revenue: currentRevenue * revenueFactor,
              expenses: currentExpenses * expenseFactor,
              profit: currentRevenue * revenueFactor - currentExpenses * expenseFactor,
            })
          }

          chartData = estimatedData
        }
      } catch (error) {
        console.error('Error fetching monthly trends:', error)
        // Fallback to simple data if trends fetch fails
        // No fallback - return empty array to show "no data available"
        chartData = []
      }

      // Build KPI array with calculated values and data sources
      const kpis = [
        {
          metric: 'arr',
          value: arr,
          trend: { direction: 'stable' as const, percentage: 0 },
          period_end: now.toISOString(),
          last_update_ts: Date.now() / 1000,
          next_update_ts: Date.now() / 1000 + 1800,
          dataSource:
            quarterlyPnL && quarterlyPnL.total_income > 0
              ? `P&L (Last 3 months) × 4`
              : currentRevenue > 0
                ? lastMonthPnL.total_income > 0
                  ? `P&L (Last complete month) × 12`
                  : `Invoices (${invoices?.length || 0} from last 30 days) × 12`
                : 'No revenue data',
          period:
            quarterlyPnL && quarterlyPnL.total_income > 0
              ? `${formatDate(threeMonthsAgoStart).slice(0, 10)} to ${formatDate(lastCompleteMonthEnd).slice(0, 10)}`
              : `${formatDate(lastCompleteMonthStart).slice(0, 10)} to ${formatDate(lastCompleteMonthEnd).slice(0, 10)}`,
          fallbackUsed: lastMonthPnL.total_income === 0 && totalInvoiceRevenue > 0,
          calculation: `${formatCurrency(quarterlyPnL?.total_income || currentRevenue, { currency })} × ${quarterlyPnL?.total_income > 0 ? '4' : '12'} = ${formatCurrency(arr, { currency })}`,
        },
        {
          metric: 'gross_profit',
          value: grossProfit,
          trend: { direction: 'stable' as const, percentage: 0 },
          period_end: now.toISOString(),
          last_update_ts: Date.now() / 1000,
          next_update_ts: Date.now() / 1000 + 1800,
          dataSource: lastMonthPnL.gross_profit
            ? 'P&L Report (gross_profit field)'
            : lastMonthPnL.cost_of_goods_sold
              ? 'Calculated: Revenue - COGS'
              : 'Estimated at 70% of revenue',
          fallbackUsed: !lastMonthPnL.gross_profit,
          calculation: lastMonthPnL.gross_profit
            ? `Direct from P&L`
            : lastMonthPnL.cost_of_goods_sold
              ? `${formatCurrency(stableMonthlyRevenue, { currency })} - ${formatCurrency(lastMonthPnL.cost_of_goods_sold, { currency })}`
              : `${formatCurrency(stableMonthlyRevenue, { currency })} × 0.7`,
        },
        {
          metric: 'gross_margin_pct',
          value: grossMargin,
          trend: { direction: 'stable' as const, percentage: 0 },
          period_end: now.toISOString(),
          last_update_ts: Date.now() / 1000,
          next_update_ts: Date.now() / 1000 + 1800,
          dataSource: stableMonthlyRevenue > 0 ? 'Calculated from P&L' : 'No revenue data',
          calculation:
            stableMonthlyRevenue > 0
              ? `(${formatCurrency(grossProfit, { currency })} ÷ ${formatCurrency(stableMonthlyRevenue, { currency })}) × 100`
              : 'N/A - No revenue',
        },
        {
          metric: 'net_profit_margin',
          value: netProfitMargin,
          trend: { direction: 'stable' as const, percentage: 0 },
          period_end: now.toISOString(),
          last_update_ts: Date.now() / 1000,
          next_update_ts: Date.now() / 1000 + 1800,
          dataSource: lastMonthPnL.net_income
            ? 'P&L Report net_income'
            : 'Calculated: Revenue - Expenses',
          calculation:
            stableMonthlyRevenue > 0
              ? `(${formatCurrency(netIncome, { currency })} ÷ ${formatCurrency(stableMonthlyRevenue, { currency })}) × 100`
              : 'N/A - No revenue',
        },
        {
          metric: 'burn_rate',
          value: monthlyBurn,
          trend: { direction: 'stable' as const, percentage: 0 },
          period_end: now.toISOString(),
          last_update_ts: Date.now() / 1000,
          next_update_ts: Date.now() / 1000 + 1800,
          dataSource:
            stableMonthlyExpenses > 0
              ? lastMonthPnL.total_expenses > 0
                ? 'P&L Report total_expenses'
                : 'Expense records (fallback)'
              : 'Operating Cash Flow (negative)',
          fallbackUsed: lastMonthPnL.total_expenses === 0 && totalExpenseAmount > 0,
          calculation: `Monthly operating costs: ${formatCurrency(monthlyBurn, { currency })}`,
        },
        {
          metric: 'runway_months',
          value: runway,
          trend: { direction: 'stable' as const, percentage: 0 },
          period_end: now.toISOString(),
          last_update_ts: Date.now() / 1000,
          next_update_ts: Date.now() / 1000 + 1800,
          dataSource: 'Calculated from cash and burn rate',
          calculation:
            monthlyBurn > 0
              ? `${formatCurrency(cashBalance, { currency })} ÷ ${formatCurrency(monthlyBurn, { currency })}/month`
              : 'Infinite (no burn)',
          fallbackUsed: false,
        },
        {
          metric: 'cash_balance',
          value: cashBalance,
          trend: { direction: 'stable' as const, percentage: 0 },
          period_end: now.toISOString(),
          last_update_ts: Date.now() / 1000,
          next_update_ts: Date.now() / 1000 + 1800,
          dataSource: cashFlow.cash_at_end
            ? 'Cash Flow Statement (ending balance)'
            : balanceSheet.cash_and_equivalents
              ? 'Balance Sheet (cash & equivalents)'
              : 'Sum of bank account balances',
          calculation: `Total available cash: ${formatCurrency(cashBalance, { currency })}`,
        },
        {
          metric: 'ocf',
          value: operatingCashFlow,
          trend: { direction: 'stable' as const, percentage: 0 },
          period_end: now.toISOString(),
          last_update_ts: Date.now() / 1000,
          next_update_ts: Date.now() / 1000 + 1800,
          dataSource:
            cashFlow.net_cash_from_operating_activities &&
            cashFlow.net_cash_from_operating_activities !== 0
              ? 'Cash Flow Statement (operating activities)'
              : 'Estimated from P&L Net Income',
          fallbackUsed:
            cashFlow.net_cash_from_operating_activities === 0 ||
            !cashFlow.net_cash_from_operating_activities,
          calculation:
            operatingCashFlow >= 0
              ? `Positive cash generation: ${formatCurrency(operatingCashFlow, { currency })}`
              : `Negative cash flow: -${formatCurrency(Math.abs(operatingCashFlow), { currency })}`,
        },
        {
          metric: 'dso',
          value: 30, // Default for now
          trend: { direction: 'stable' as const, percentage: 0 },
          period_end: now.toISOString(),
          last_update_ts: Date.now() / 1000,
          next_update_ts: Date.now() / 1000 + 1800,
          dataSource: 'Default value (Aged Receivables not available)',
          calculation: 'Will be: (AR Balance ÷ Daily Revenue) when data available',
          fallbackUsed: true,
        },
        {
          metric: 'dpo',
          value: 30, // Default for now
          trend: { direction: 'stable' as const, percentage: 0 },
          period_end: now.toISOString(),
          last_update_ts: Date.now() / 1000,
          next_update_ts: Date.now() / 1000 + 1800,
          dataSource: 'Default value (Aged Payables not available)',
          calculation: 'Will be: (AP Balance ÷ Daily COGS) when data available',
          fallbackUsed: true,
        },
      ]

      // Generate insights
      const insights = []

      if (runway < 3) {
        insights.push({
          id: 'runway-critical',
          type: 'critical',
          title: 'Critical Runway Alert',
          description: `Your current runway is ${runway.toFixed(1)} months. Consider reducing expenses or increasing revenue immediately.`,
          priority: 'high',
        })
      } else if (runway < 6) {
        insights.push({
          id: 'runway-warning',
          type: 'warning',
          title: 'Low Runway Warning',
          description: `Your runway is ${runway.toFixed(1)} months. Plan for additional funding or cost reduction.`,
          priority: 'medium',
        })
      }

      if (grossMargin < 30 && stableMonthlyRevenue > 0) {
        insights.push({
          id: 'margin-low',
          type: 'warning',
          title: 'Low Gross Margin',
          description: `Your gross margin is ${grossMargin.toFixed(1)}%. Consider pricing adjustments or cost optimization.`,
          priority: 'medium',
        })
      }

      if (operatingCashFlow < 0) {
        insights.push({
          id: 'negative-ocf',
          type: 'warning',
          title: 'Negative Operating Cash Flow',
          description: 'Your operating cash flow is negative. Monitor cash position closely.',
          priority: 'medium',
        })
      }

      // Add insight if we're using fallback data
      if (currentPeriodPnL?.total_income === 0 && totalInvoiceRevenue > 0) {
        insights.push({
          id: 'pnl-data-issue',
          type: 'info',
          title: 'Using Invoice Data',
          description: `P&L report returned no income data. Using ${invoices.length} invoice records totaling ${formatCurrency(totalInvoiceRevenue, { currency })} for revenue calculations.`,
          priority: 'low',
        })
      }

      // Add insight about expense data source
      if (currentPeriodPnL?.total_expenses === 0 && totalExpenseAmount > 0) {
        insights.push({
          id: 'expense-data-issue',
          type: 'info',
          title: 'Using Expense Records',
          description: `P&L report returned no expense data. Using ${expenses.length} expense records totaling ${formatCurrency(totalExpenseAmount, { currency })} for calculations.`,
          priority: 'low',
        })
      }

      // Skip memory fetch to reduce complexity
      const memorySummary = null

      // Log diagnostic information
      console.log('KPI Calculation Summary:')
      console.log('- Current Period P&L Revenue:', currentPeriodPnL?.total_income || 0)
      console.log(
        '- Current Period:',
        `${formatDate(currentPeriodStart)} to ${formatDate(currentPeriodEnd)}`
      )
      console.log('- Stable Monthly Revenue (from quarterly):', stableMonthlyRevenue)
      console.log('- Invoice Revenue (fallback):', totalInvoiceRevenue)
      console.log('- Current Revenue Used:', currentRevenue)
      console.log('- TRUE Total Expenses Calculation:')
      console.log('  - COGS:', quarterlyPnL?.cogs_total || quarterlyPnL?.cost_of_goods_sold || 0)
      console.log('  - Operating Expenses:', quarterlyPnL?.total_expenses || 0)
      console.log('  - Other Expenses:', quarterlyPnL?.other_expenses || 0)
      console.log('  - TRUE TOTAL (Quarterly):', trueTotalExpensesQuarterly)
      console.log('  - TRUE TOTAL (Monthly):', stableMonthlyExpenses)
      console.log('- Expense Records Total (fallback):', totalExpenseAmount)
      console.log('- Current Expenses Used:', currentExpenses)
      console.log('- Burn Rate:', monthlyBurn)
      console.log('- ARR Calculated:', arr)
      console.log('- Gross Profit:', grossProfit)
      console.log('- Operating Cash Flow:', operatingCashFlow)

      // Return response
      return NextResponse.json({
        organizationName,
        currency,
        provider: providerId,
        lastSync: Math.floor(Date.now() / 1000),
        basis: 'accrual',
        kpis,
        charts: {
          revenueExpenseTrend: chartData,
          dailyCashFlow,
          expenseBreakdown,
        },
        recentTransactions: recentTransactionsList,
        insights,
        revenueBreakdown,
        revenueBreakdownTotal,
        memorySummary,
      })
    } catch (error) {
      console.error('KPI API error:', error)
      return NextResponse.json(
        {
          error: 'Failed to fetch KPI data',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  }
)
