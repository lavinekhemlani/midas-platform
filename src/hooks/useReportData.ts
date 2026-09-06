// src/hooks/useReportData.ts
'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { useQBRealmId, appendRealmId } from './useQBRealmId'

interface ReportResponse {
  data?: any
  reportData?: any
  currency?: string
  fromDate?: string
  toDate?: string
  organizationName?: string
  asOfDate?: string
  [key: string]: any
}

// Custom fetcher function that handles the apiClient pattern
const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    // Try to parse error response body
    let errorData: any = {}
    try {
      errorData = await response.json()
    } catch {
      // If JSON parsing fails, use default error
      errorData = { message: 'Failed to fetch report data' }
    }

    // Create error with all the details from the API response
    const error: any = new Error(
      errorData.error || errorData.message || 'Failed to fetch report data'
    )

    // Attach all error details for proper handling
    error.status = response.status
    error.code = errorData.code
    error.requiresReconnect = errorData.requiresReconnect
    error.provider = errorData.provider
    error.redirectUrl = errorData.redirectUrl
    error.userMessage = errorData.userMessage
    error.details = errorData.details
    error.retryAfter = errorData.retryAfter

    // For rate limit errors, attach the retry-after header value
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After')
      if (retryAfterHeader) {
        error.retryAfter = parseInt(retryAfterHeader, 10)
      }
    }

    throw error
  }
  return response.json()
}

// Base SWR configuration for all report hooks
// Aligned with ReportsProvider to prevent unnecessary refetches
const baseConfig = {
  // Cache for 30 minutes (reports don't change frequently)
  dedupingInterval: 30 * 60 * 1000,
  // Keep data fresh for 5 minutes before background revalidation
  focusThrottleInterval: 5 * 60 * 1000,
  // Don't revalidate on window focus (prevents refetch spam when switching views)
  revalidateOnFocus: false,
  // Always revalidate on mount to ensure fresh data on page load/refresh
  // This fixes race conditions where stale/partial cache data was being shown
  revalidateOnMount: true,
  // Allow revalidation if data is stale (works with revalidateOnMount)
  revalidateIfStale: true,
  // Revalidate when coming back online
  revalidateOnReconnect: true,
  // Retry on errors but not on 404s, auth errors, or provider connection errors
  shouldRetryOnError: (error: any) => {
    // Don't retry on auth errors
    if (error.status === 401 || error.status === 403 || error.status === 404) {
      return false
    }
    // Don't retry on provider connection errors - requires user action to reconnect
    if (
      error.code === 'NO_PROVIDER_CONNECTED' ||
      error.code === 'PROVIDER_NOT_CONNECTED' ||
      error.code === 'PROVIDER_INVALID_GRANT' ||
      error.requiresReconnect
    ) {
      return false
    }
    return true
  },
  // Keep previous data while revalidating for smooth UX
  keepPreviousData: true,
  // Error retry configuration - 2 retries with exponential backoff
  errorRetryCount: 2,
  errorRetryInterval: 3000, // Base 3 second interval
  // Custom error retry handler that respects Retry-After header for rate limits
  onErrorRetry: (
    error: any,
    _key: string,
    _config: any,
    revalidate: (opts?: { retryCount?: number }) => void,
    { retryCount }: { retryCount: number }
  ) => {
    // Don't retry on authentication errors - requires user action
    if (error.status === 401 || error.status === 403) {
      logger.debug('SWR not retrying auth error', {
        status: error.status,
        component: 'useReportData',
      })
      return
    }

    // Don't retry on 404 - resource doesn't exist
    if (error.status === 404) {
      logger.debug('SWR not retrying 404 error', { component: 'useReportData' })
      return
    }

    // Don't retry on provider connection errors - requires user action to reconnect
    if (
      error.code === 'NO_PROVIDER_CONNECTED' ||
      error.code === 'PROVIDER_NOT_CONNECTED' ||
      error.code === 'PROVIDER_INVALID_GRANT' ||
      error.requiresReconnect
    ) {
      logger.debug('SWR not retrying provider connection error', {
        code: error.code,
        component: 'useReportData',
      })
      return
    }

    // Stop after max retries
    if (retryCount >= 2) {
      logger.debug('SWR max retries exceeded, stopping retry', { component: 'useReportData' })
      return
    }

    // For rate limit errors (429), respect Retry-After header
    if (error.status === 429 && error.retryAfter) {
      const retryAfterMs = error.retryAfter * 1000
      logger.info('SWR rate limited, retrying after delay', {
        retryAfterSeconds: error.retryAfter,
        component: 'useReportData',
      })
      setTimeout(() => revalidate({ retryCount }), retryAfterMs)
      return
    }

    // Exponential backoff: 3s, 6s (base * 2^retryCount)
    const delay = 3000 * Math.pow(2, retryCount)
    logger.debug('SWR retrying with exponential backoff', {
      delayMs: delay,
      attempt: retryCount + 1,
      maxRetries: 2,
      component: 'useReportData',
    })
    setTimeout(() => revalidate({ retryCount }), delay)
  },
}

/**
 * Hook for fetching and caching executive summary report data
 * Used by the executive summary page
 */
export function useExecutiveSummary(period: string = 'this_month') {
  const realmId = useQBRealmId()
  const params = new URLSearchParams({ period })
  appendRealmId(params, realmId)

  const { data, error, isLoading, mutate } = useSWR<any>(
    `/api/quickbooks/reports/executive-summary?${params.toString()}`,
    fetcher,
    {
      ...baseConfig,
      // Summary data cached for 15 minutes as it aggregates multiple reports
      dedupingInterval: 15 * 60 * 1000,
    }
  )

  return {
    data: data?.data,
    isLoading,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching summary report data
 * Used by the main reports dashboard page
 */
export function useReportSummary(period: string = 'this_month') {
  const { data, error, isLoading, isValidating, mutate } = useSWR<ReportResponse>(
    `/api/reports?type=summary&period=${period}`,
    fetcher,
    {
      ...baseConfig,
      // Summary data cached for 15 minutes as it aggregates multiple reports
      dedupingInterval: 15 * 60 * 1000,
    }
  )

  return {
    reportData: data,
    isLoading,
    isValidating,
    error,
    mutate,
    // Helper methods
    refetch: () => mutate(),
    // Optimistic update for period changes
    updatePeriod: (newPeriod: string) => {
      // SWR will automatically refetch when the key changes
      return mutate()
    },
  }
}

/**
 * Hook for fetching and caching Profit & Loss report data
 * Legacy version for compatibility
 */
export function useProfitLossData(options: {
  startDate?: string
  endDate?: string
  enabled?: boolean
}) {
  const realmId = useQBRealmId()
  const params = new URLSearchParams()
  if (options.startDate) params.append('start', options.startDate)
  if (options.endDate) params.append('end', options.endDate)
  params.append('details', 'true')
  appendRealmId(params, realmId)

  const { data, error, isLoading, isValidating, mutate } = useSWR<ReportResponse>(
    options.enabled && options.startDate && options.endDate
      ? `/api/quickbooks/reports/profit-loss?${params.toString()}`
      : null,
    fetcher,
    baseConfig
  )

  return {
    reportData: data,
    isLoading,
    isValidating,
    error,
    mutate,
    refresh: () => mutate(),
  }
}

/**
 * Hook for fetching and caching Profit & Loss report data
 */
export function useProfitLoss(startDate?: string, endDate?: string) {
  const realmId = useQBRealmId()
  const params = new URLSearchParams()
  if (startDate) params.append('start', startDate)
  if (endDate) params.append('end', endDate)
  params.append('details', 'true')
  appendRealmId(params, realmId)

  const { data, error, isLoading, mutate } = useSWR<ReportResponse>(
    startDate && endDate ? `/api/quickbooks/reports/profit-loss?${params.toString()}` : null,
    fetcher,
    baseConfig
  )

  return {
    reportData: data,
    isLoading,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching P&L monthly trend data separately
 * This is fetched independently to allow core P&L data to load faster
 */
export function usePnLMonthlyTrend(startDate?: string, endDate?: string) {
  const realmId = useQBRealmId()
  const params = new URLSearchParams()
  if (startDate) params.append('start', startDate)
  if (endDate) params.append('end', endDate)
  appendRealmId(params, realmId)

  const { data, error, isLoading, isValidating, mutate } = useSWR<ReportResponse>(
    startDate && endDate ? `/api/quickbooks/reports/profit-loss/trend?${params.toString()}` : null,
    fetcher,
    {
      ...baseConfig,
      // Monthly trend can have a slightly longer cache since it's historical data
      dedupingInterval: 30 * 60 * 1000,
    }
  )

  return {
    trendData: data?.data?.monthlyTrend || [],
    currency: data?.currency,
    isLoading,
    isValidating,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching category breakdown trend data (expenses & revenue by category over time)
 * Used by the P&L page for the multi-series line chart with tabs
 */
export function useCategoryBreakdownTrend(startDate?: string, endDate?: string) {
  const realmId = useQBRealmId()
  const params = new URLSearchParams()
  if (startDate) params.append('start', startDate)
  if (endDate) params.append('end', endDate)
  appendRealmId(params, realmId)

  const { data, error, isLoading, isValidating, mutate } = useSWR<ReportResponse>(
    startDate && endDate
      ? `/api/quickbooks/reports/category-breakdown-trend?${params.toString()}`
      : null,
    fetcher,
    {
      ...baseConfig,
      // Category breakdown can have a longer cache since it's historical data
      dedupingInterval: 30 * 60 * 1000,
    }
  )

  return {
    expensesData: data?.data?.expenses || { labels: [], series: [] },
    revenueData: data?.data?.revenue || { labels: [], series: [] },
    currency: data?.currency,
    isLoading,
    isValidating,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching Balance Sheet monthly trend data separately
 * This is fetched independently to allow core Balance Sheet data to load faster
 */
export function useBalanceSheetMonthlyTrend(startDate?: string, endDate?: string) {
  const realmId = useQBRealmId()
  const params = new URLSearchParams()
  if (startDate) params.append('start', startDate)
  if (endDate) params.append('end', endDate)
  params.append('summarize_column_by', 'Month')
  appendRealmId(params, realmId)

  const { data, error, isLoading, isValidating, mutate } = useSWR<ReportResponse>(
    endDate ? `/api/quickbooks/reports/balance-sheet/trend?${params.toString()}` : null,
    fetcher,
    {
      ...baseConfig,
      // Monthly trend can have a slightly longer cache since it's historical data
      dedupingInterval: 30 * 60 * 1000,
    }
  )

  return {
    trendData: data?.data?.monthlyTrend || [],
    currency: data?.currency,
    isLoading,
    isValidating,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching Balance Sheet report data
 */
export function useBalanceSheet(asOfDate?: string) {
  const realmId = useQBRealmId()
  const params = new URLSearchParams()
  if (asOfDate) params.append('date', asOfDate)
  params.append('details', 'true')
  appendRealmId(params, realmId)

  const swrKey = asOfDate ? `/api/quickbooks/reports/balance-sheet?${params.toString()}` : null

  // Debug: Log SWR key changes
  logger.debug('Balance sheet SWR key updated', { swrKey, asOfDate, component: 'useBalanceSheet' })

  const { data, error, isLoading, isValidating, mutate } = useSWR<ReportResponse>(swrKey, fetcher, {
    ...baseConfig,
    // Balance sheet data is more stable, cache longer
    dedupingInterval: 30 * 60 * 1000,
  })

  return {
    reportData: data,
    isLoading,
    isValidating,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching Cash Flow report data
 */
export function useCashFlow(startDate?: string, endDate?: string) {
  const realmId = useQBRealmId()
  const params = new URLSearchParams()
  if (startDate) params.append('start', startDate)
  if (endDate) params.append('end', endDate)
  params.append('details', 'true')
  appendRealmId(params, realmId)

  const { data, error, isLoading, isValidating, mutate } = useSWR<ReportResponse>(
    startDate && endDate ? `/api/quickbooks/reports/cash-flow?${params.toString()}` : null,
    fetcher,
    baseConfig
  )

  return {
    reportData: data,
    isLoading,
    isValidating,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching Cash Flow monthly trend data separately
 * This is fetched independently to allow core Cash Flow data to load faster
 */
export function useCashFlowMonthlyTrend(startDate?: string, endDate?: string) {
  const realmId = useQBRealmId()
  const params = new URLSearchParams()
  if (startDate) params.append('start', startDate)
  if (endDate) params.append('end', endDate)
  params.append('summarize_column_by', 'Month')
  appendRealmId(params, realmId)

  const { data, error, isLoading, isValidating, mutate } = useSWR<ReportResponse>(
    startDate && endDate ? `/api/quickbooks/reports/cash-flow/trend?${params.toString()}` : null,
    fetcher,
    {
      ...baseConfig,
      // Monthly trend can have a slightly longer cache since it's historical data
      dedupingInterval: 30 * 60 * 1000,
    }
  )

  return {
    trendData: data?.data?.monthlyFlow || [],
    currency: data?.currency,
    isLoading,
    isValidating,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching Aged Receivables report data
 * NOTE: This uses the old /api/reports/aged-receivables endpoint which has calculation issues.
 * For accurate QuickBooks AR data, use useQuickBooksARAging instead.
 */
export function useAgedReceivables(asOfDate?: string) {
  const params = new URLSearchParams()
  if (asOfDate) params.append('date', asOfDate)
  params.append('details', 'true')

  const { data, error, isLoading, mutate } = useSWR<ReportResponse>(
    asOfDate ? `/api/reports/aged-receivables?${params.toString()}` : null,
    fetcher,
    {
      ...baseConfig,
      // AR data changes more frequently, shorter cache
      dedupingInterval: 5 * 60 * 1000,
      focusThrottleInterval: 3 * 60 * 1000,
    }
  )

  return {
    reportData: data,
    isLoading,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching AR Aging directly from QuickBooks API
 * This uses the correct /api/quickbooks/reports endpoint which returns accurate data
 *
 * @param organizationId - The organization ID (PK with ORG# prefix)
 * @param explicitRealmId - Optional explicit realmId (for multi-company support)
 */
export function useQuickBooksARAging(organizationId?: string, explicitRealmId?: string) {
  const urlRealmId = useQBRealmId()
  // Use explicit realmId if provided, otherwise fall back to URL-based realmId
  const realmId = explicitRealmId ?? urlRealmId
  const params = new URLSearchParams()
  if (organizationId) params.append('orgId', organizationId)
  params.append('type', 'AgedReceivables')
  appendRealmId(params, realmId)

  const { data, error, isLoading, mutate } = useSWR<ReportResponse>(
    organizationId ? `/api/quickbooks/reports?${params.toString()}` : null,
    fetcher,
    {
      ...baseConfig,
      // AR data changes more frequently, shorter cache
      dedupingInterval: 5 * 60 * 1000,
      focusThrottleInterval: 3 * 60 * 1000,
    }
  )

  return {
    reportData: data?.data, // The actual report data is nested under 'data'
    isLoading,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching Aged Payables report data
 */
export function useAgedPayables(asOfDate?: string) {
  const params = new URLSearchParams()
  if (asOfDate) params.append('date', asOfDate)
  params.append('details', 'true')

  const { data, error, isLoading, mutate } = useSWR<ReportResponse>(
    asOfDate ? `/api/reports/aged-payables?${params.toString()}` : null,
    fetcher,
    {
      ...baseConfig,
      // AP data changes more frequently, shorter cache
      dedupingInterval: 5 * 60 * 1000,
      focusThrottleInterval: 3 * 60 * 1000,
    }
  )

  return {
    reportData: data,
    isLoading,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching Journal Report data
 */
export function useJournalReport(startDate?: string, endDate?: string, provider?: string) {
  const realmId = useQBRealmId()
  const params = new URLSearchParams()
  if (startDate) params.append('start', startDate)
  if (endDate) params.append('end', endDate)
  if (provider) params.append('provider', provider)
  appendRealmId(params, realmId)

  const { data, error, isLoading, mutate } = useSWR<ReportResponse>(
    startDate && endDate ? `/api/reports/journal-report?${params.toString()}` : null,
    fetcher,
    baseConfig
  )

  return {
    reportData: data,
    isLoading,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching Vendor Expenses report data
 */
export function useVendorExpenses(startDate?: string, endDate?: string) {
  const params = new URLSearchParams()
  if (startDate) params.append('start', startDate)
  if (endDate) params.append('end', endDate)

  const { data, error, isLoading, mutate } = useSWR<ReportResponse>(
    startDate && endDate ? `/api/reports/vendor-expenses?${params.toString()}` : null,
    fetcher,
    baseConfig
  )

  return {
    reportData: data,
    isLoading,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching AP Aging report data
 */
export function useAPAging(asOfDate?: string) {
  const params = new URLSearchParams()
  if (asOfDate) params.append('date', asOfDate)

  const { data, error, isLoading, mutate } = useSWR<ReportResponse>(
    asOfDate ? `/api/reports/ap-aging?${params.toString()}` : null,
    fetcher,
    {
      ...baseConfig,
      // AP aging data changes frequently, shorter cache
      dedupingInterval: 5 * 60 * 1000,
      focusThrottleInterval: 3 * 60 * 1000,
    }
  )

  return {
    reportData: data,
    isLoading,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching Vendor Balance report data
 */
export function useVendorBalance(asOfDate?: string) {
  const params = new URLSearchParams()
  if (asOfDate) params.append('date', asOfDate)

  const { data, error, isLoading, mutate } = useSWR<ReportResponse>(
    asOfDate ? `/api/reports/vendor-balance?${params.toString()}` : null,
    fetcher,
    {
      ...baseConfig,
      // Vendor balance data changes frequently, shorter cache
      dedupingInterval: 5 * 60 * 1000,
      focusThrottleInterval: 3 * 60 * 1000,
    }
  )

  return {
    reportData: data,
    isLoading,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching Bills data
 */
export function useBills(
  startDate?: string,
  endDate?: string,
  view: 'bills' | 'aging' = 'bills',
  organizationId?: string,
  explicitRealmId?: string
) {
  const urlRealmId = useQBRealmId()
  // Use explicit realmId if provided, otherwise fall back to URL-based realmId
  const realmId = explicitRealmId ?? urlRealmId
  const params = new URLSearchParams()
  if (organizationId) params.append('organizationId', organizationId)
  if (startDate) params.append('start', startDate)
  if (endDate) params.append('end', endDate)
  params.append('view', view)
  if (view === 'aging') {
    params.append('asOfDate', endDate || '')
  }
  appendRealmId(params, realmId)

  const { data, error, isLoading, mutate } = useSWR<ReportResponse>(
    startDate && endDate && organizationId ? `/api/quickbooks/bills?${params.toString()}` : null,
    fetcher,
    {
      ...baseConfig,
      // Bills data changes frequently, shorter cache
      dedupingInterval: 5 * 60 * 1000,
      focusThrottleInterval: 3 * 60 * 1000,
      // Force fetch on mount even if global config says otherwise
      revalidateOnMount: true,
      revalidateIfStale: true,
    }
  )

  return {
    reportData: data,
    isLoading,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching Vendor Analysis data
 */
export function useVendorAnalysis(startDate?: string, endDate?: string, provider?: string) {
  const realmId = useQBRealmId()
  const params = new URLSearchParams()
  if (startDate) params.append('start', startDate)
  if (endDate) params.append('end', endDate)
  if (provider) params.append('provider', provider)
  appendRealmId(params, realmId)

  const { data, error, isLoading, mutate } = useSWR<ReportResponse>(
    startDate && endDate ? `/api/expenses/vendors?${params.toString()}` : null,
    fetcher,
    {
      ...baseConfig,
      // Vendor data changes frequently, shorter cache
      dedupingInterval: 5 * 60 * 1000,
      focusThrottleInterval: 3 * 60 * 1000,
    }
  )

  return {
    reportData: data,
    isLoading,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching Trial Balance report data
 * Includes enriched account data from Chart of Accounts
 */
export function useTrialBalance(asOfDate?: string, accountingMethod?: 'Accrual' | 'Cash') {
  const params = new URLSearchParams()
  if (asOfDate) params.append('date', asOfDate)
  if (accountingMethod) params.append('accounting_method', accountingMethod)

  const { data, error, isLoading, isValidating, mutate } = useSWR<ReportResponse>(
    asOfDate ? `/api/quickbooks/reports/trial-balance?${params.toString()}` : null,
    fetcher,
    {
      ...baseConfig,
      // Trial Balance is a point-in-time snapshot, cache for 30 minutes
      dedupingInterval: 30 * 60 * 1000,
    }
  )

  return {
    reportData: data,
    isLoading,
    isValidating,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching General Ledger report data
 * Includes enriched account data from Chart of Accounts and transaction details
 */
export function useGeneralLedger(
  startDate?: string,
  endDate?: string,
  accountingMethod?: 'Accrual' | 'Cash',
  accountId?: string
) {
  const params = new URLSearchParams()
  if (startDate) params.append('start_date', startDate)
  if (endDate) params.append('end_date', endDate)
  if (accountingMethod) params.append('accounting_method', accountingMethod)
  if (accountId) params.append('account', accountId)

  const { data, error, isLoading, isValidating, mutate } = useSWR<ReportResponse>(
    startDate && endDate ? `/api/quickbooks/reports/general-ledger?${params.toString()}` : null,
    fetcher,
    {
      ...baseConfig,
      // General Ledger has lots of transaction data, cache for 15 minutes
      dedupingInterval: 15 * 60 * 1000,
    }
  )

  return {
    reportData: data,
    isLoading,
    isValidating,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for invalidating all report caches
 * Useful when you know the underlying data has changed
 */
export function useReportCacheControl() {
  const { mutate: mutateSummary } = useSWR('/api/reports?type=summary', null, {
    revalidateOnMount: false,
  })
  const { mutate: mutatePnL } = useSWR('/api/reports?type=profit_loss', null, {
    revalidateOnMount: false,
  })
  const { mutate: mutateBS } = useSWR('/api/reports?type=balance_sheet', null, {
    revalidateOnMount: false,
  })
  const { mutate: mutateCF } = useSWR('/api/reports?type=cash_flow', null, {
    revalidateOnMount: false,
  })
  const { mutate: mutateAR } = useSWR('/api/reports?type=aged_receivables', null, {
    revalidateOnMount: false,
  })
  const { mutate: mutateAP } = useSWR('/api/reports?type=aged_payables', null, {
    revalidateOnMount: false,
  })

  return {
    invalidateAll: () => {
      // Invalidate all report caches
      mutateSummary?.()
      mutatePnL?.()
      mutateBS?.()
      mutateCF?.()
      mutateAR?.()
      mutateAP?.()
    },
    invalidateSummary: () => mutateSummary?.(),
    invalidateProfitLoss: () => mutatePnL?.(),
    invalidateBalanceSheet: () => mutateBS?.(),
    invalidateCashFlow: () => mutateCF?.(),
    invalidateAgedReceivables: () => mutateAR?.(),
    invalidateAgedPayables: () => mutateAP?.(),
  }
}

// ============================================================================
// Forecasting Hooks
// ============================================================================

import type { ForecastAssumptions, ForecastData, ForecastApiResponse } from '@/types/forecasting'

interface UseForecastDataOptions {
  horizon: '13-week' | '6-month'
  assumptions: ForecastAssumptions
  enabledMemoryIds?: string[]
  enabled?: boolean
}

/**
 * Hook for fetching and caching forecast data
 * Uses the same baseConfig, fetcher, and error handling patterns as all other report hooks
 */
export function useForecastData(options: UseForecastDataOptions) {
  const { horizon, assumptions, enabledMemoryIds, enabled = true } = options

  const params = new URLSearchParams({
    horizon,
    growthRate: assumptions.growthRate.toString(),
    inflowGrowthRate: assumptions.inflowGrowthRate.toString(),
    outflowGrowthRate: assumptions.outflowGrowthRate.toString(),
    rollingDays: assumptions.rollingAverageDays.toString(),
    confidenceLevel: (assumptions.confidenceLevel ?? 90).toString(),
  })
  if (enabledMemoryIds) {
    params.append('memoryIds', enabledMemoryIds.join(','))
  }

  const { data, error, isLoading, isValidating, mutate } = useSWR<ForecastApiResponse>(
    enabled ? `/api/forecasting?${params.toString()}` : null,
    fetcher,
    {
      ...baseConfig,
      // Forecasts change with parameter inputs, shorter dedup
      dedupingInterval: 30 * 1000,
      // Keep previous data for smooth transitions between assumption changes
      keepPreviousData: true,
    }
  )

  return {
    forecastData: data?.data as ForecastData | undefined,
    isLoading,
    isValidating,
    error: error?.message || (data && !data.success ? 'Failed to load forecast' : null),
    isError: !!error || (data ? !data.success : false),
    refresh: () => mutate(),
    mutate,
  }
}
