/**
 * Hook for fetching a single KPI
 */
import { useCallback } from 'react'
import useSWR, { SWRConfiguration } from 'swr'
import { KPIId, KPIResult, KPIError, UseKPIOptions } from './types'

const API_BASE = '/api/kpis'

interface SingleKPIResponse {
  kpi: {
    id: KPIId
    name: string
    displayName?: string
    category: string
    description: string
    format: string
    benchmark?: {
      good: number
      average: number
      poor: number
    }
  }
  result: KPIResult
  history?: Array<{
    date: string
    value: number
    formatted: string
  }>
  metadata: {
    calculationTime: number
    timestamp: string
    provider: string
    cacheHit: boolean
  }
}

/**
 * Fetcher function for single KPI
 */
const fetcher = async (url: string): Promise<SingleKPIResponse> => {
  const response = await fetch(url)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to fetch KPI')
  }

  return response.json()
}

/**
 * Hook to fetch a single KPI with detailed information
 */
export function useKPI(kpiId: KPIId, options: UseKPIOptions = {}) {
  const {
    useCache = true,
    includeHistory = false,
    revalidateOnFocus = false,
    revalidateOnReconnect = true,
    refreshInterval = 0,
  } = options

  // Build query string
  const queryParams = new URLSearchParams()

  if (!useCache) {
    queryParams.append('useCache', 'false')
  }
  if (includeHistory) {
    queryParams.append('includeHistory', 'true')
  }

  const url = `${API_BASE}/${kpiId}${queryParams.toString() ? `?${queryParams}` : ''}`

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
  const { data, error, isLoading, isValidating, mutate } = useSWR<SingleKPIResponse, Error>(
    url,
    fetcher,
    swrConfig
  )

  // Refresh function
  const refresh = useCallback(() => {
    return mutate()
  }, [mutate])

  // Helper to check if value is within benchmark
  const getBenchmarkStatus = useCallback((): 'good' | 'average' | 'poor' | 'unknown' => {
    if (!data?.kpi.benchmark || !data?.result) return 'unknown'

    const { value } = data.result
    const { good, average, poor } = data.kpi.benchmark

    if (value >= good) return 'good'
    if (value >= average) return 'average'
    if (value >= poor) return 'poor'
    return 'poor'
  }, [data])

  // Helper to get trend from history
  const getTrend = useCallback((): 'up' | 'down' | 'stable' | null => {
    if (!data?.history || data.history.length < 2) return null

    const latest = data.history[data.history.length - 1].value
    const previous = data.history[data.history.length - 2].value

    if (latest > previous * 1.05) return 'up'
    if (latest < previous * 0.95) return 'down'
    return 'stable'
  }, [data])

  return {
    kpi: data?.kpi,
    result: data?.result,
    history: data?.history,
    metadata: data?.metadata,
    benchmarkStatus: getBenchmarkStatus(),
    trend: getTrend(),
    isLoading,
    isValidating,
    error: error
      ? ({
          error: error.name,
          message: error.message,
          kpiId,
          timestamp: new Date().toISOString(),
        } as KPIError)
      : undefined,
    refresh,
  }
}

/**
 * Hook to compare a KPI value against benchmarks
 */
export function useKPIBenchmark(kpiId: KPIId, value: number) {
  const { kpi, isLoading } = useKPI(kpiId, { includeHistory: false })

  if (isLoading || !kpi?.benchmark) {
    return {
      status: 'unknown' as const,
      benchmark: null,
      isLoading,
    }
  }

  const { good, average, poor } = kpi.benchmark

  let status: 'excellent' | 'good' | 'average' | 'poor'
  let message: string

  if (value >= good * 1.2) {
    status = 'excellent'
    message = `Excellent - ${((value / good - 1) * 100).toFixed(0)}% above target`
  } else if (value >= good) {
    status = 'good'
    message = 'Good - meeting or exceeding target'
  } else if (value >= average) {
    status = 'average'
    message = 'Average - room for improvement'
  } else {
    status = 'poor'
    message = 'Below average - attention needed'
  }

  return {
    status,
    message,
    benchmark: kpi.benchmark,
    isLoading: false,
  }
}

/**
 * Hook to track KPI changes over time
 */
export function useKPIHistory(kpiId: KPIId) {
  const { history, result, isLoading, error } = useKPI(kpiId, { includeHistory: true })

  // Calculate statistics from history
  const stats =
    history && history.length > 0
      ? {
          min: Math.min(...history.map((h) => h.value)),
          max: Math.max(...history.map((h) => h.value)),
          average: history.reduce((sum, h) => sum + h.value, 0) / history.length,
          current: result?.value || 0,
          trend: calculateTrend(history.map((h) => h.value)),
        }
      : null

  return {
    history,
    stats,
    isLoading,
    error,
  }
}

/**
 * Calculate trend from historical values
 */
function calculateTrend(values: number[]): 'improving' | 'declining' | 'stable' {
  if (values.length < 3) return 'stable'

  // Simple linear regression
  const n = values.length
  const indices = Array.from({ length: n }, (_, i) => i)

  const sumX = indices.reduce((a, b) => a + b, 0)
  const sumY = values.reduce((a, b) => a + b, 0)
  const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0)
  const sumX2 = indices.reduce((sum, x) => sum + x * x, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

  // Determine trend based on slope
  if (slope > 0.01) return 'improving'
  if (slope < -0.01) return 'declining'
  return 'stable'
}
