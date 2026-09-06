/**
 * Hook for fetching multiple KPIs
 */
import { useEffect, useState, useCallback } from 'react'
import useSWR, { SWRConfiguration } from 'swr'
import { logger } from '@/lib/logger'
import { KPIId, KPIBatchResponse, KPIError, UseKPIsOptions } from './types'

const API_BASE = '/api/kpis'

/**
 * Fetcher function for SWR
 */
const fetcher = async (url: string): Promise<KPIBatchResponse> => {
  const response = await fetch(url)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to fetch KPIs')
  }

  return response.json()
}

/**
 * Hook to fetch multiple KPIs with caching and real-time updates
 */
export function useKPIs(options: UseKPIsOptions = {}) {
  const {
    kpis = [],
    useCache = true,
    includeBreakdown = false,
    includeTrends = false,
    revalidateOnFocus = false,
    revalidateOnReconnect = true,
    refreshInterval = 0,
  } = options

  // Build query string
  const queryParams = new URLSearchParams()

  if (kpis.length > 0) {
    queryParams.append('kpis', kpis.join(','))
  }
  if (!useCache) {
    queryParams.append('useCache', 'false')
  }
  if (includeBreakdown) {
    queryParams.append('includeBreakdown', 'true')
  }
  if (includeTrends) {
    queryParams.append('includeTrends', 'true')
  }

  const url = `${API_BASE}${queryParams.toString() ? `?${queryParams}` : ''}`

  // SWR configuration
  const swrConfig: SWRConfiguration = {
    revalidateOnFocus,
    revalidateOnReconnect,
    refreshInterval,
    dedupingInterval: 5000,
    errorRetryCount: 3,
    errorRetryInterval: 5000,
  }

  // Use SWR for data fetching
  const { data, error, isLoading, isValidating, mutate } = useSWR<KPIBatchResponse, Error>(
    url,
    fetcher,
    swrConfig
  )

  // Refresh function
  const refresh = useCallback(() => {
    return mutate()
  }, [mutate])

  // Clear cache function
  const clearCache = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/cache-stats`, { method: 'DELETE' })
      await refresh()
    } catch (error) {
      logger.error('Failed to clear cache', { error, component: 'useKPIs' })
    }
  }, [refresh])

  return {
    data: data?.results,
    trends: data?.trends,
    breakdown: data?.breakdown,
    metadata: data?.metadata,
    isLoading,
    isValidating,
    error: error
      ? ({
          error: error.name,
          message: error.message,
          timestamp: new Date().toISOString(),
        } as KPIError)
      : undefined,
    refresh,
    clearCache,
  }
}

/**
 * Hook to fetch dashboard KPIs (predefined set)
 */
export function useDashboardKPIs() {
  return useKPIs({
    // Dashboard KPIs will be determined by the API when no specific KPIs are provided
    includeBreakdown: true,
    includeTrends: true,
    refreshInterval: 60000, // Refresh every minute
    revalidateOnFocus: true,
  })
}

/**
 * Hook to fetch specific category of KPIs
 */
export function useCategoryKPIs(
  category: 'revenue' | 'profitability' | 'cashflow' | 'liquidity' | 'efficiency' | 'balance_sheet'
) {
  const categoryKPIs: Record<string, KPIId[]> = {
    revenue: ['revenue', 'arr', 'mrr', 'revenue_growth'],
    profitability: [
      'gross_profit',
      'gross_margin',
      'net_income',
      'net_margin',
      'ebitda',
      'ebitda_margin',
    ],
    cashflow: [
      'operating_cash_flow',
      'free_cash_flow',
      'burn_rate',
      'runway_months',
      'cash_balance',
    ],
    liquidity: ['current_ratio', 'quick_ratio', 'working_capital', 'working_capital_ratio'],
    efficiency: ['dso', 'dpo', 'dio', 'cash_conversion_cycle'],
    balance_sheet: [
      'total_assets',
      'total_liabilities',
      'total_equity',
      'debt_to_equity',
      'roa',
      'roe',
    ],
  }

  return useKPIs({
    kpis: categoryKPIs[category] || [],
    includeBreakdown: false,
    includeTrends: true,
  })
}

/**
 * Hook to prefetch KPIs for performance
 */
export function usePrefetchKPIs(kpis: KPIId[]) {
  useEffect(() => {
    if (kpis.length === 0) return

    const prefetch = async () => {
      try {
        const queryParams = new URLSearchParams({
          kpis: kpis.join(','),
          useCache: 'true',
        })

        await fetch(`${API_BASE}?${queryParams}`)
      } catch (error) {
        logger.error('Prefetch failed', { error, kpis, component: 'usePrefetchKPIs' })
      }
    }

    prefetch()
  }, [kpis])
}
