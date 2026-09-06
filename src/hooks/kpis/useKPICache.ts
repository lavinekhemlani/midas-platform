/**
 * Hook for managing KPI cache
 */
import { useCallback, useEffect } from 'react'
import useSWR from 'swr'
import { logger } from '@/lib/logger'
import { KPICacheStats } from './types'

const API_BASE = '/api/kpis'

/**
 * Fetcher for cache stats
 */
const fetcher = async (url: string): Promise<KPICacheStats> => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Failed to fetch cache stats')
  }

  return response.json()
}

/**
 * Hook to manage and monitor KPI cache
 */
export function useKPICache(options: { autoRefresh?: boolean; refreshInterval?: number } = {}) {
  const { autoRefresh = false, refreshInterval = 10000 } = options

  const { data, error, isLoading, mutate } = useSWR<KPICacheStats>(
    `${API_BASE}/cache-stats`,
    fetcher,
    {
      refreshInterval: autoRefresh ? refreshInterval : 0,
      revalidateOnFocus: false,
    }
  )

  /**
   * Clear entire cache
   */
  const clearCache = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/cache-stats`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to clear cache')
      }

      // Refresh stats after clearing
      await mutate()

      return { success: true }
    } catch (error) {
      logger.error('Failed to clear cache', { error, component: 'useKPICache' })
      return { success: false, error }
    }
  }, [mutate])

  /**
   * Clear cache entries matching a pattern
   */
  const clearPattern = useCallback(
    async (pattern: string) => {
      try {
        const response = await fetch(
          `${API_BASE}/cache-stats?pattern=${encodeURIComponent(pattern)}`,
          {
            method: 'DELETE',
          }
        )

        if (!response.ok) {
          throw new Error('Failed to clear cache pattern')
        }

        const result = await response.json()

        // Refresh stats after clearing
        await mutate()

        return { success: true, cleared: result.cleared }
      } catch (error) {
        logger.error('Failed to clear cache pattern', { error, pattern, component: 'useKPICache' })
        return { success: false, error }
      }
    },
    [mutate]
  )

  /**
   * Warm up cache with common KPIs
   */
  const warmupCache = useCallback(
    async (kpiIds?: string[]) => {
      try {
        const queryParams = kpiIds ? `?kpis=${kpiIds.join(',')}` : ''
        const response = await fetch(`${API_BASE}${queryParams}`)

        if (!response.ok) {
          throw new Error('Failed to warm up cache')
        }

        // Refresh stats after warming
        await mutate()

        return { success: true }
      } catch (error) {
        logger.error('Failed to warm up cache', { error, kpiIds, component: 'useKPICache' })
        return { success: false, error }
      }
    },
    [mutate]
  )

  /**
   * Refresh cache stats
   */
  const refresh = useCallback(() => {
    return mutate()
  }, [mutate])

  // Calculate cache health score
  const cacheHealth = data
    ? {
        score: calculateHealthScore(data.cache.hitRate, data.cache.size, data.cache.maxSize),
        status: getHealthStatus(data.performance.efficiency),
        recommendations: getRecommendations(data),
      }
    : null

  return {
    stats: data,
    isLoading,
    error,
    clearCache,
    clearPattern,
    warmupCache,
    refresh,
    cacheHealth,
  }
}

/**
 * Calculate cache health score (0-100)
 */
function calculateHealthScore(hitRate: number, size: number, maxSize: number): number {
  const hitRateScore = hitRate * 0.6 // 60% weight
  const sizeScore = (1 - size / maxSize) * 40 // 40% weight

  return Math.round(hitRateScore + sizeScore)
}

/**
 * Get health status from efficiency
 */
function getHealthStatus(efficiency: string): 'healthy' | 'warning' | 'critical' {
  switch (efficiency) {
    case 'Excellent':
    case 'Good':
      return 'healthy'
    case 'Fair':
      return 'warning'
    default:
      return 'critical'
  }
}

/**
 * Get cache optimization recommendations
 */
function getRecommendations(stats: KPICacheStats): string[] {
  const recommendations: string[] = []

  // Hit rate recommendations
  if (stats.cache.hitRate < 60) {
    recommendations.push('Low hit rate detected. Consider pre-warming cache with common KPIs.')
  }

  // Size recommendations
  const sizePercentage = (stats.cache.size / stats.cache.maxSize) * 100
  if (sizePercentage > 80) {
    recommendations.push(
      'Cache is nearly full. Consider increasing cache size or clearing old entries.'
    )
  }

  // Memory recommendations
  if (stats.cache.memory.total > 10 * 1024 * 1024) {
    // 10MB
    recommendations.push('High memory usage detected. Consider optimizing cache entry size.')
  }

  // Eviction recommendations
  if (stats.cache.evictions > stats.cache.hits * 0.1) {
    recommendations.push('High eviction rate. Consider increasing cache size.')
  }

  return recommendations
}

/**
 * Hook to monitor cache performance
 */
export function useCacheMonitor() {
  const { stats, cacheHealth } = useKPICache({ autoRefresh: true, refreshInterval: 5000 })

  useEffect(() => {
    if (!cacheHealth) return

    // Log warnings if cache health is poor
    if (cacheHealth.status === 'critical') {
      logger.warn('KPI cache critical status detected', {
        recommendations: cacheHealth.recommendations,
        component: 'useCacheMonitor',
      })
    } else if (cacheHealth.status === 'warning') {
      logger.warn('KPI cache warning status', {
        recommendations: cacheHealth.recommendations,
        component: 'useCacheMonitor',
      })
    }
  }, [cacheHealth])

  return {
    stats,
    health: cacheHealth,
  }
}
