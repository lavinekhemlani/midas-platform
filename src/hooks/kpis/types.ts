/**
 * Frontend types for V2 KPI API
 */

export type KPIId =
  | 'revenue' | 'arr' | 'mrr' | 'revenue_growth'
  | 'gross_profit' | 'gross_margin'
  | 'net_income' | 'net_margin' | 'ebitda' | 'ebitda_margin'
  | 'operating_cash_flow' | 'free_cash_flow' | 'burn_rate' | 'runway_months' | 'cash_balance'
  | 'current_ratio' | 'quick_ratio' | 'working_capital' | 'working_capital_ratio'
  | 'dso' | 'dpo' | 'dio' | 'cash_conversion_cycle' | 'inventory_turnover'
  | 'total_assets' | 'total_liabilities' | 'total_equity'
  | 'debt_to_equity' | 'roa' | 'roe'

export type KPICategory =
  | 'revenue'
  | 'profitability'
  | 'cashflow'
  | 'liquidity'
  | 'efficiency'
  | 'balance_sheet'

export type KPIFormat =
  | 'currency'
  | 'percentage'
  | 'ratio'
  | 'days'
  | 'months'

export interface KPIResult {
  id: KPIId
  value: number
  formatted: string
  confidence: 'high' | 'medium' | 'low'
  source: string
  dataQuality?: {
    completeness: number
    recency: number
    accuracy: number
  }
  warnings?: string[]
  metadata?: {
    calculatedAt: Date
    periodStart?: Date
    periodEnd?: Date
    fallbackUsed?: boolean
  }
  semantic?: {
    meaning: string
    interpretation: string
    benchmark?: string
  }
}

export interface KPITrend {
  direction: 'up' | 'down' | 'stable'
  percentage: number
  previousValue: number
  currentValue: number
  sparkline?: number[]
}

export interface KPIBreakdown {
  components: Array<{
    name: string
    value: number
    percentage?: number
  }>
  total: number
}

export interface KPIBatchResponse {
  results: Record<KPIId, KPIResult>
  metadata: {
    calculationTime: number
    cacheHit: boolean
    dataFreshness: Date
    provider: string
  }
  trends?: Record<KPIId, KPITrend>
  breakdown?: Record<KPIId, KPIBreakdown>
}

export interface KPICatalogItem {
  id: KPIId
  name: string
  displayName?: string
  category: KPICategory
  description: string
  format: KPIFormat
  precision: number
  dataSources: string[]
  quickbooksField?: string
  benchmark?: {
    good: number
    average: number
    poor: number
  }
}

export interface KPICatalogResponse {
  kpis: KPICatalogItem[]
  grouped: Record<KPICategory, KPICatalogItem[]>
  total: number
  categories: Record<KPICategory, number>
  metadata: {
    version: string
    lastUpdated: string
    totalAvailable: number
  }
}

export interface KPICacheStats {
  cache: {
    size: number
    maxSize: number
    hits: number
    misses: number
    hitRate: number
    evictions: number
    entries: Array<{
      key: string
      age: number
      hits: number
      size: number
    }>
    memory: {
      total: number
      average: number
      totalFormatted: string
      averageFormatted: string
      largest: {
        key: string
        size: number
      }
    }
  }
  performance: {
    hitRate: string
    totalRequests: number
    efficiency: 'Excellent' | 'Good' | 'Fair' | 'Poor'
  }
  timestamp: string
}

export interface UseKPIsOptions {
  kpis?: KPIId[]
  useCache?: boolean
  includeBreakdown?: boolean
  includeTrends?: boolean
  revalidateOnFocus?: boolean
  revalidateOnReconnect?: boolean
  refreshInterval?: number
}

export interface UseKPIOptions {
  useCache?: boolean
  includeHistory?: boolean
  revalidateOnFocus?: boolean
  revalidateOnReconnect?: boolean
  refreshInterval?: number
}

export interface KPIError {
  error: string
  message: string
  kpiId?: KPIId
  timestamp: string
}