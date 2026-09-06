// src/ai/router/contextPreparer.ts
// Handles pre-fetching and memory alignment based on routing decisions

import type { RouteResult, PreparedContext, ReportType } from './types'
import type { FinancialProvider } from '@/lib/providers/interfaces'
import type { ProviderApiClient } from '@/lib/providers/apiClient'
import type { MemoryType } from '../memory/types'
import { getDateRange } from '../tools/dates'
import { logger } from '@/lib/logger'
import { getMemoriesForContext } from '../tools/memory'

// =============================================================================
// Types
// =============================================================================

export interface PrepareContextOptions {
  /** The routing decision */
  route: RouteResult
  /** Organization ID for data fetching */
  organizationId: string
  /** User ID for memory retrieval */
  userId: string
  /** QuickBooks realm ID for scoping memories (like chat history) */
  realmId?: string
  /** Financial data provider */
  provider: FinancialProvider
  /** API client for provider calls */
  apiClient: ProviderApiClient
  /** Currency for formatting */
  currency: string
}

interface FetchResult {
  report: ReportType
  data: unknown
  success: boolean
  error?: string
}

// =============================================================================
// Main Context Preparation Function
// =============================================================================

/**
 * Prepares context for the agent based on routing decision
 *
 * - High confidence: Pre-fetches suggested reports in parallel
 * - All confidence levels: Fetches query-aligned memories
 *
 * This is an optimization layer - if pre-fetch fails, agent can still
 * call tools directly.
 */
export async function prepareContext(options: PrepareContextOptions): Promise<PreparedContext> {
  const { route, organizationId, userId, realmId, provider, apiClient, currency } = options
  const startTime = Date.now()

  // Run pre-fetch and memory retrieval in parallel
  const [prefetchedData, memories] = await Promise.all([
    // Only pre-fetch for high confidence routes
    shouldPrefetch(route)
      ? prefetchReports(route, organizationId, provider, apiClient, currency)
      : Promise.resolve({}),

    // Always fetch query-aligned memories (scoped by realmId like chat history)
    fetchAlignedMemories(userId, organizationId, realmId, route.memoryTypes),
  ])

  return {
    route,
    prefetchedData,
    memories,
    fetchDuration: Date.now() - startTime,
  }
}

// =============================================================================
// Pre-fetch Logic
// =============================================================================

/**
 * Determines if we should pre-fetch based on route confidence
 */
function shouldPrefetch(route: RouteResult): boolean {
  // Only pre-fetch for high confidence with actual reports suggested
  return route.confidence === 'high' && route.reports.length > 0
}

/**
 * Pre-fetches reports in parallel based on routing decision
 * Failures are logged but don't block - agent can still call tools
 */
async function prefetchReports(
  route: RouteResult,
  organizationId: string,
  provider: FinancialProvider,
  apiClient: ProviderApiClient,
  currency: string
): Promise<Record<string, unknown>> {
  // Use primary period or default to This Year (YTD)
  const period = route.periods[0] || 'this_year'
  const dateRange = getDateRange(period)

  // Fetch all reports in parallel
  const fetchPromises = route.reports.map((report) =>
    fetchSingleReport(report, organizationId, provider, apiClient, dateRange)
  )

  const results = await Promise.all(fetchPromises)

  // Build result object from successful fetches
  const prefetchedData: Record<string, unknown> = {}

  const successReports: string[] = []

  for (const result of results) {
    if (result.success && result.data) {
      prefetchedData[result.report] = {
        ...normalizeReportData(result.data),
        currency,
        period,
        prefetched: true,
      }
      successReports.push(result.report)
    } else if (result.error) {
      // Log failures but don't block
      // console.warn(`[Router] Failed to prefetch ${result.report}:`, result.error)
      logger.warn(
        `[Router:Prefetch] Failed to prefetch ${result.report} (non-critical, agent will fetch via tools)`,
        {
          error: result.error,
        }
      )
    }
  }

  if (successReports.length > 0) {
    logger.step(0, `Prefetch complete: ${successReports.join(', ')}`, {
      reports: successReports,
      period,
    })
  }

  return prefetchedData
}

/**
 * Fetches a single report with error handling
 */
async function fetchSingleReport(
  report: ReportType,
  organizationId: string,
  provider: FinancialProvider,
  apiClient: ProviderApiClient,
  dateRange: { start: string; end: string }
): Promise<FetchResult> {
  // Check if provider supports reports at all
  if (!provider.reports) {
    return {
      report,
      data: null,
      success: false,
      error: 'Provider does not support reports prefetching',
    }
  }

  try {
    const data = await fetchReportByType(report, organizationId, provider, apiClient, dateRange)

    return { report, data, success: true }
  } catch (error) {
    return {
      report,
      data: null,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Routes to the appropriate provider method based on report type
 * Mirrors the logic in financial.ts tool
 */
async function fetchReportByType(
  report: ReportType,
  organizationId: string,
  provider: FinancialProvider,
  apiClient: ProviderApiClient,
  dateRange: { start: string; end: string }
): Promise<unknown> {
  switch (report) {
    case 'profit_loss':
      return (provider.reports.profitAndLoss as any)(
        organizationId,
        { start_date: dateRange.start, end_date: dateRange.end },
        apiClient
      )

    case 'balance_sheet':
      return (provider.reports.balanceSheet as any)(
        organizationId,
        { end_date: dateRange.end },
        apiClient
      )

    case 'cash_flow':
      return (provider.reports.cashFlow as any)(
        organizationId,
        { start_date: dateRange.start, end_date: dateRange.end },
        apiClient
      )

    case 'revenue_trend':
      // Map to profit_loss with monthly summarization for 12 months
      const trendEndDate = new Date(dateRange.end)
      const trendStartDate = new Date(trendEndDate)
      trendStartDate.setMonth(trendStartDate.getMonth() - 11) // 12 months including current

      return (provider.reports.profitAndLoss as any)(
        organizationId,
        {
          start_date: trendStartDate.toISOString().split('T')[0],
          end_date: dateRange.end,
          summarize_column_by: 'Month',
        },
        apiClient
      )

    case 'aged_receivables':
      return (provider.reports.agedReceivables as any)(
        organizationId,
        { end_date: dateRange.end },
        apiClient
      )

    case 'aged_payables':
      return (provider.reports.agedPayables as any)(
        organizationId,
        { end_date: dateRange.end },
        apiClient
      )

    case 'financial_health':
      return (provider.reports.financialHealthSummary as any)(
        organizationId,
        { start_date: dateRange.start, end_date: dateRange.end },
        apiClient
      )

    case 'pnl_comparison': {
      // Calculate previous period for comparison
      const prevDateRange = calculatePreviousPeriod(dateRange)
      return (provider.reports.profitAndLossComparison as any)(
        organizationId,
        { start_date: dateRange.start, end_date: dateRange.end },
        { start_date: prevDateRange.start, end_date: prevDateRange.end },
        apiClient
      )
    }

    case 'trial_balance':
      return (provider.reports.trialBalance as any)(
        organizationId,
        { start_date: dateRange.start, end_date: dateRange.end },
        apiClient
      )

    case 'sales':
      // Sales requires invoices - check if provider supports it
      if (provider.invoices?.listInvoices) {
        return (provider.invoices.listInvoices as any)(
          organizationId,
          { start_date: dateRange.start, end_date: dateRange.end },
          apiClient
        )
      }
      return null

    case 'bills':
      // Bills requires bills provider
      if (provider.bills?.listBills) {
        return (provider.bills.listBills as any)(
          organizationId,
          { start_date: dateRange.start, end_date: dateRange.end },
          apiClient
        )
      }
      return null

    default:
      return null
  }
}

/**
 * Calculates previous period dates for comparison
 */
function calculatePreviousPeriod(dateRange: { start: string; end: string }): {
  start: string
  end: string
} {
  const startDate = new Date(dateRange.start)
  const endDate = new Date(dateRange.end)
  const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  const prevEndDate = new Date(startDate)
  prevEndDate.setDate(prevEndDate.getDate() - 1)

  const prevStartDate = new Date(prevEndDate)
  prevStartDate.setDate(prevStartDate.getDate() - periodDays + 1)

  return {
    start: prevStartDate.toISOString().split('T')[0],
    end: prevEndDate.toISOString().split('T')[0],
  }
}

/**
 * Normalizes report data structure for consistent handling
 */
function normalizeReportData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    return {}
  }
  return data as Record<string, unknown>
}

// =============================================================================
// Memory Alignment
// =============================================================================

/**
 * Fetches memories aligned with the query intent
 * Uses the enhanced getMemoriesForContext with type filtering
 * Scoped by realmId (QuickBooks company ID) like chat history
 */
async function fetchAlignedMemories(
  userId: string,
  organizationId: string,
  realmId: string | undefined,
  priorityTypes: MemoryType[]
): Promise<string> {
  try {
    return await getMemoriesForContext(userId, organizationId, realmId, priorityTypes, 10)
  } catch (error) {
    console.warn('[Router] Failed to fetch memories:', error)
    return ''
  }
}

// =============================================================================
// Formatting Utilities
// =============================================================================

/**
 * Formats pre-fetched data for injection into system prompt
 * Used by agent.ts to build enriched context
 */
export function formatPrefetchedData(data: Record<string, unknown>): string {
  if (!data || Object.keys(data).length === 0) {
    return ''
  }

  const sections: string[] = []

  for (const [reportType, reportData] of Object.entries(data)) {
    if (!reportData) continue

    const title = formatReportTitle(reportType)
    const formatted = formatReportData(reportType, reportData)

    sections.push(`### ${title}\n${formatted}`)
  }

  return sections.join('\n\n')
}

/**
 * Formats report type to human-readable title
 */
function formatReportTitle(reportType: string): string {
  const titles: Record<string, string> = {
    profit_loss: 'Profit & Loss',
    balance_sheet: 'Balance Sheet',
    cash_flow: 'Cash Flow',
    revenue_trend: 'Revenue Trend (12 Months)',
    aged_receivables: 'Accounts Receivable Aging',
    aged_payables: 'Accounts Payable Aging',
    financial_health: 'Financial Health Summary',
    pnl_comparison: 'Period Comparison',
    trial_balance: 'Trial Balance',
    sales: 'Sales Data',
    bills: 'Bills Data',
  }

  return titles[reportType] || reportType.replace(/_/g, ' ').toUpperCase()
}

/**
 * Formats report data for readability in prompt
 * Extracts key metrics rather than dumping raw JSON
 */
function formatReportData(reportType: string, data: unknown): string {
  const reportData = data as Record<string, unknown>

  switch (reportType) {
    case 'profit_loss':
      return formatProfitLoss(reportData)
    case 'balance_sheet':
      return formatBalanceSheet(reportData)
    case 'cash_flow':
      return formatCashFlow(reportData)
    case 'revenue_trend':
      return formatRevenueTrend(reportData)
    case 'aged_receivables':
      return formatAgedReceivables(reportData)
    case 'aged_payables':
      return formatAgedPayables(reportData)
    case 'financial_health':
      return formatFinancialHealth(reportData)
    default:
      // Fallback to JSON for unknown types
      return '```json\n' + JSON.stringify(data, null, 2) + '\n```'
  }
}

function formatProfitLoss(data: Record<string, unknown>): string {
  const currency = (data.currency as string) || 'USD'
  const fmt = (n: unknown) => formatCurrency(n as number, currency)

  return `- Total Revenue: ${fmt(data.total_income)}
- Total Expenses: ${fmt(data.total_expenses)}
- Gross Profit: ${fmt(data.gross_profit)}
- Net Income: ${fmt(data.net_income)}
- Period: ${data.start_date} to ${data.end_date}`
}

function formatBalanceSheet(data: Record<string, unknown>): string {
  const currency = (data.currency as string) || 'USD'
  const fmt = (n: unknown) => formatCurrency(n as number, currency)

  return `- Total Assets: ${fmt(data.total_assets)}
- Total Liabilities: ${fmt(data.total_liabilities)}
- Total Equity: ${fmt(data.total_equity)}
- As of: ${data.report_date || data.end_date}`
}

function formatCashFlow(data: Record<string, unknown>): string {
  const currency = (data.currency as string) || 'USD'
  const fmt = (n: unknown) => formatCurrency(n as number, currency)

  return `- Operating Cash Flow: ${fmt(data.net_cash_from_operating_activities)}
- Investing Cash Flow: ${fmt(data.net_cash_from_investing_activities)}
- Financing Cash Flow: ${fmt(data.net_cash_from_financing_activities)}
- Net Change in Cash: ${fmt(data.net_change_in_cash)}
- Cash at End: ${fmt(data.cash_at_end)}`
}

function formatRevenueTrend(data: Record<string, unknown>): string {
  const months = data as unknown as Array<{
    month: string
    revenue: number
    expenses: number
    profit: number
  }>

  if (!Array.isArray(months) || months.length === 0) {
    return 'No trend data available'
  }

  const recentMonths = months.slice(-6)
  return recentMonths
    .map(
      (m) =>
        `- ${m.month}: Revenue ${formatCurrency(m.revenue)}, Profit ${formatCurrency(m.profit)}`
    )
    .join('\n')
}

function formatAgedReceivables(data: Record<string, unknown>): string {
  const currency = (data.currency as string) || 'USD'
  const fmt = (n: unknown) => formatCurrency(n as number, currency)
  const total = data.total as number

  return `- Total Outstanding: ${fmt(total)}
- Customer Count: ${(data.receivables as unknown[])?.length || 0}`
}

function formatAgedPayables(data: Record<string, unknown>): string {
  const currency = (data.currency as string) || 'USD'
  const fmt = (n: unknown) => formatCurrency(n as number, currency)
  const total = data.total as number

  return `- Total Outstanding: ${fmt(total)}
- Vendor Count: ${(data.payables as unknown[])?.length || 0}`
}

function formatFinancialHealth(data: Record<string, unknown>): string {
  const profitability = data.profitability as Record<string, number>
  const liquidity = data.liquidity as Record<string, number>

  return `- Gross Margin: ${formatPercent(profitability?.gross_profit_margin)}
- Net Margin: ${formatPercent(profitability?.net_profit_margin)}
- Current Ratio: ${liquidity?.current_ratio?.toFixed(2) || 'N/A'}
- Quick Ratio: ${liquidity?.quick_ratio?.toFixed(2) || 'N/A'}`
}

function formatCurrency(value: number, currency = 'USD'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A'
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return 'N/A'
  }
  // Values are already in percentage form (e.g., 15.5 for 15.5%)
  return `${value.toFixed(1)}%`
}

// =============================================================================
// Clarification Hint
// =============================================================================

/**
 * Generates a clarification hint for the agent when ambiguous terms are detected
 * Returns empty string if no clarification is needed
 */
export function getClarificationHint(route: RouteResult): string {
  if (!route.requiresClarification || route.ambiguousTerms.length === 0) {
    return ''
  }

  const terms = route.ambiguousTerms.map((t) => `"${t}"`).join(', ')
  return `\n\n⚠️ **CLARIFICATION NEEDED**: The user's query contains ambiguous term(s): ${terms}. Before fetching data, ask the user to specify which type they mean (see CLARIFICATION PROTOCOL above).\n`
}
