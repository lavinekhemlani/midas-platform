/**
 * V2 KPI API Hooks
 *
 * These hooks provide a clean interface for consuming the V2 KPI API
 * with built-in caching, error handling, and real-time updates.
 */

// Core hooks
export { useKPIs, useDashboardKPIs, useCategoryKPIs, usePrefetchKPIs } from './useKPIs'
export { useKPI, useKPIBenchmark, useKPIHistory } from './useKPI'

// Cache management
export { useKPICache, useCacheMonitor } from './useKPICache'

// Catalog and metadata
export {
  useKPICatalog,
  useKPISearch,
  useKPIMetadata,
  useRecommendedKPIs,
  useKPIBenchmarks
} from './useKPICatalog'

// Types
export type {
  KPIId,
  KPICategory,
  KPIFormat,
  KPIResult,
  KPITrend,
  KPIBreakdown,
  KPIBatchResponse,
  KPICatalogItem,
  KPICatalogResponse,
  KPICacheStats,
  UseKPIsOptions,
  UseKPIOptions,
  KPIError
} from './types'

/**
 * Example usage:
 *
 * // Fetch dashboard KPIs
 * const { data, isLoading, error } = useDashboardKPIs()
 *
 * // Fetch specific KPIs
 * const { data } = useKPIs({ kpis: ['revenue', 'gross_margin', 'burn_rate'] })
 *
 * // Fetch single KPI with history
 * const { result, history } = useKPI('gross_margin', { includeHistory: true })
 *
 * // Manage cache
 * const { stats, clearCache } = useKPICache()
 *
 * // Search KPIs
 * const { results } = useKPISearch('margin')
 */