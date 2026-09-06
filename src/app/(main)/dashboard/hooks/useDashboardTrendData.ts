'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'
import {
  useWarehouseConfig,
  useWarehouseCompanyInfo,
  useMonthlyRevenue,
} from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'

const trendFetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) throw new Error('Failed to fetch trend data')
  return response.json()
}

export interface MonthlyDataPoint {
  month: string // "YYYY-MM" sortable format (e.g. "2025-01")
  label: string // Display label (e.g. "Jan 2025")
  revenue: number
}

export interface TrendResult {
  data: MonthlyDataPoint[]
  currency?: string
  isLoading: boolean
}

// Last 12 months date range
const getLast12Months = () => {
  const now = new Date()
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const startDate = new Date(now)
  startDate.setFullYear(startDate.getFullYear() - 1)
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`
  return { start, end }
}

/** QB monthly revenue trend — fetches directly with explicit realmId */
export function useDashboardQBTrend(enabled: boolean, realmId?: string): TrendResult {
  const { start, end } = useMemo(getLast12Months, [])

  const url = useMemo(() => {
    if (!enabled) return null
    const params = new URLSearchParams({ start, end })
    if (realmId) params.append('realmId', realmId)
    return `/api/quickbooks/reports/profit-loss/trend?${params.toString()}`
  }, [enabled, start, end, realmId])

  const { data: response, isLoading } = useSWR(url, trendFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30 * 60 * 1000,
  })

  const trendData = response?.data?.monthlyTrend || []
  const currency = response?.currency

  const data = useMemo<MonthlyDataPoint[]>(
    () =>
      trendData.map((d: any) => ({
        month: parseToSortableMonth(d.month),
        label: d.month,
        revenue: d.revenue || 0,
      })),
    [trendData]
  )

  return {
    data: enabled ? data : [],
    currency: currency || undefined,
    isLoading: enabled ? isLoading : false,
  }
}

/** BC monthly revenue trend — wraps useMonthlyRevenue (warehouse/Redshift) */
export function useDashboardBCTrend(enabled: boolean, schemaOverride?: string): TrendResult {
  // Pass `enabled` to skip fetching warehouse config when not needed
  const { schema: defaultSchema, isLoading: configLoading, isEnabled } = useWarehouseConfig(enabled)
  const schema = schemaOverride || defaultSchema
  const effectiveSchema = enabled && (schemaOverride || isEnabled) ? schema : null
  const { data: companyInfo } = useWarehouseCompanyInfo(effectiveSchema)

  const { start, end } = useMemo(getLast12Months, [])
  const dateRange = useMemo(
    () => (effectiveSchema ? { startDate: start, endDate: end } : undefined),
    [effectiveSchema, start, end]
  )

  const { data: rawData, isLoading: dataLoading } = useMonthlyRevenue(effectiveSchema, dateRange)

  const data = useMemo<MonthlyDataPoint[]>(
    () =>
      rawData.map((d) => ({
        // BC returns ISO date string like "2024-01-01T00:00:00.000Z"
        month: parseBCToSortableMonth(d.month),
        label: formatBCMonth(d.month),
        revenue: d.total_revenue || 0,
      })),
    [rawData]
  )

  return {
    data: enabled ? data : [],
    currency: companyInfo?.currencyCode || undefined,
    isLoading: enabled ? configLoading || dataLoading : false,
  }
}

/** BC OAuth monthly revenue trend — fetches from monthly-pnl-trend API endpoint */
export function useDashboardBCOAuthTrend(enabled: boolean, connectionId?: string): TrendResult {
  const { start, end } = useMemo(getLast12Months, [])

  const url = useMemo(() => {
    if (!enabled) return null
    const params = new URLSearchParams({ startDate: start, endDate: end })
    if (connectionId) params.set('connectionId', connectionId)
    return `/api/providers/dynamics/monthly-pnl-trend?${params.toString()}`
  }, [enabled, start, end, connectionId])

  const { data: response, isLoading } = useSWR(url, trendFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30 * 60 * 1000,
  })

  const months = response?.data?.months || []
  const currency = response?.data?.currency

  const data = useMemo<MonthlyDataPoint[]>(
    () =>
      months.map((d: any) => ({
        month: d.month, // Already "YYYY-MM" sortable format
        label: formatSortableMonth(d.month),
        revenue: d.revenue || 0,
      })),
    [months]
  )

  return {
    data: enabled ? data : [],
    currency: currency || undefined,
    isLoading: enabled ? isLoading : false,
  }
}

/** Convert sortable "2024-01" to display label "Jan 2024" */
function formatSortableMonth(monthStr: string): string {
  try {
    const [year, month] = monthStr.split('-')
    const d = new Date(parseInt(year), parseInt(month) - 1, 1)
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  } catch {
    return monthStr
  }
}

/** Convert BC ISO date to display label like "Jan 2024" */
function formatBCMonth(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

/** Convert BC ISO date "2024-01-01T..." to sortable "2024-01" */
function parseBCToSortableMonth(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  } catch {
    return dateStr
  }
}

/**
 * Convert QB month label "Jan 2025" to sortable "2025-01".
 * QB column headers vary: "Jan 2025", "January 2025", etc.
 */
const MONTH_ABBREVS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
}

function parseToSortableMonth(label: string): string {
  // Try "Jan 2025" or "January 2025" pattern
  const match = label.match(/^(\w+)\s+(\d{4})$/)
  if (match) {
    const monthKey = match[1].slice(0, 3).toLowerCase()
    const num = MONTH_ABBREVS[monthKey]
    if (num) return `${match[2]}-${num}`
  }
  // Already sortable "2025-01" or unknown — return as-is
  return label
}

/** Shopify monthly revenue trend — aggregates daily ShopifyQL data into monthly buckets */
export function useDashboardShopifyTrend(enabled: boolean, shopDomain?: string): TrendResult {
  const url = useMemo(() => {
    if (!enabled || !shopDomain) return null
    const params = new URLSearchParams({
      shop: shopDomain,
      period: '12m',
    })
    return `/api/providers/shopify/analytics?${params.toString()}`
  }, [enabled, shopDomain])

  const { data: response, isLoading } = useSWR(url, trendFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30 * 60 * 1000,
  })

  const dailyTrend = response?.data?.dailyTrend || []

  const data = useMemo<MonthlyDataPoint[]>(() => {
    if (!dailyTrend.length) return []

    // Aggregate daily data into monthly buckets
    const monthlyMap = new Map<string, number>()
    for (const day of dailyTrend) {
      if (!day.date) continue
      // day.date is like "2025-03-15" or ISO format
      const monthKey = day.date.slice(0, 7) // "2025-03"
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + (day.totalSales || 0))
    }

    return Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({
        month,
        label: formatSortableMonth(month),
        revenue,
      }))
  }, [dailyTrend])

  return {
    data: enabled ? data : [],
    currency: undefined, // Shopify currency comes from the shop info, not analytics
    isLoading: enabled ? isLoading : false,
  }
}
