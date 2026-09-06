/**
 * Hook for fetching KPI catalog and metadata
 */
import useSWR from 'swr'
import { KPICatalogResponse, KPICategory, KPIId } from './types'

const API_BASE = '/api/kpis'

/**
 * Fetcher for catalog
 */
const fetcher = async (url: string): Promise<KPICatalogResponse> => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Failed to fetch KPI catalog')
  }

  return response.json()
}

/**
 * Hook to fetch KPI catalog with all available metrics
 */
export function useKPICatalog(
  options: {
    category?: KPICategory
    format?: 'full' | 'compact'
  } = {}
) {
  const { category, format = 'full' } = options

  // Build query string
  const queryParams = new URLSearchParams()
  if (category) {
    queryParams.append('category', category)
  }
  if (format) {
    queryParams.append('format', format)
  }

  const url = `${API_BASE}/catalog${queryParams.toString() ? `?${queryParams}` : ''}`

  const { data, error, isLoading } = useSWR<KPICatalogResponse>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000, // Cache for 1 minute
  })

  return {
    catalog: data,
    kpis: data?.kpis,
    grouped: data?.grouped,
    categories: data?.categories,
    isLoading,
    error,
  }
}

/**
 * Hook to search KPIs by name or description
 */
export function useKPISearch(searchTerm: string) {
  const { catalog, isLoading } = useKPICatalog()

  if (!catalog || searchTerm.length < 2) {
    return {
      results: [],
      isLoading,
    }
  }

  const normalizedSearch = searchTerm.toLowerCase()

  const results = catalog.kpis.filter(
    (kpi) =>
      kpi.name.toLowerCase().includes(normalizedSearch) ||
      kpi.displayName?.toLowerCase().includes(normalizedSearch) ||
      kpi.description.toLowerCase().includes(normalizedSearch) ||
      kpi.id.toLowerCase().includes(normalizedSearch)
  )

  return {
    results,
    isLoading: false,
  }
}

/**
 * Hook to get KPI metadata by ID
 */
export function useKPIMetadata(kpiId: KPIId) {
  const { catalog, isLoading } = useKPICatalog()

  const metadata = catalog?.kpis.find((kpi) => kpi.id === kpiId)

  return {
    metadata,
    isLoading,
    notFound: !isLoading && !metadata,
  }
}

/**
 * Hook to get recommended KPIs based on industry
 */
export function useRecommendedKPIs(industry?: string) {
  const { catalog, isLoading } = useKPICatalog()

  if (!catalog || isLoading) {
    return {
      recommended: [],
      isLoading,
    }
  }

  // Define industry-specific recommendations
  const recommendations: Record<string, KPIId[]> = {
    saas: ['arr', 'mrr', 'gross_margin', 'burn_rate', 'runway_months', 'current_ratio'],
    ecommerce: ['revenue', 'gross_margin', 'inventory_turnover', 'dso', 'working_capital'],
    manufacturing: [
      'gross_margin',
      'inventory_turnover',
      'cash_conversion_cycle',
      'roa',
      'debt_to_equity',
    ],
    services: ['revenue', 'net_margin', 'dso', 'current_ratio', 'operating_cash_flow'],
    default: ['revenue', 'gross_margin', 'net_margin', 'cash_balance', 'current_ratio'],
  }

  const industryKPIs = recommendations[industry || 'default'] || recommendations.default

  const recommended = catalog.kpis.filter((kpi) => industryKPIs.includes(kpi.id))

  return {
    recommended,
    isLoading: false,
  }
}

/**
 * Hook to get KPIs by category
 */
export function useCategoryKPIs(category: KPICategory) {
  const { grouped, isLoading } = useKPICatalog()

  return {
    kpis: grouped?.[category] || [],
    isLoading,
  }
}

/**
 * Hook to get KPI benchmark comparison
 */
export function useKPIBenchmarks() {
  const { catalog, isLoading } = useKPICatalog()

  if (!catalog || isLoading) {
    return {
      benchmarks: {},
      isLoading,
    }
  }

  const benchmarks = catalog.kpis.reduce(
    (acc, kpi) => {
      if (kpi.benchmark) {
        acc[kpi.id] = kpi.benchmark
      }
      return acc
    },
    {} as Record<string, any>
  )

  return {
    benchmarks,
    isLoading: false,
  }
}
