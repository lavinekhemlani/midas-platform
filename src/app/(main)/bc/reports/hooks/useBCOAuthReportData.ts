'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'
import type { DateRange } from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'

/**
 * Fetches BC financial data directly from the BC API (for OAuth connections).
 * Returns data shaped for WarehouseExecutiveDashboard props.
 */

interface BCFinancialSummary {
  revenue: number | null
  totalCOGS: number | null
  grossProfit: number | null
  totalExpenses: number | null
  netIncome: number | null
  cashBalance: number | null
  ar: number | null
  ap: number | null
  healthScore: number | null
  healthRating: string | null
  healthComponents: {
    liquidity: number
    profitability: number
    efficiency: number
    leverage: number
  } | null
  currency: string
  companyName: string | null
  connectionId: string
  period: { startDate: string; endDate: string }
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch BC API report data')
  }
  return response.json()
}

export function useBCOAuthReportData(
  enabled: boolean,
  connectionId?: string,
  dateRange?: DateRange
) {
  // Build URL with date range params
  let url: string | null = null
  if (enabled) {
    const params = new URLSearchParams()
    if (connectionId) params.set('connectionId', connectionId)
    if (dateRange?.startDate) params.set('startDate', dateRange.startDate)
    if (dateRange?.endDate) params.set('endDate', dateRange.endDate)
    const qs = params.toString()
    url = `/api/providers/dynamics/financial-summary${qs ? `?${qs}` : ''}`
  }

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-oauth-report', url] : null,
    () => fetcher(url!),
    {
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
      errorRetryCount: 2,
    }
  )

  const d: BCFinancialSummary | null = data?.data ?? null

  // Transform into WarehouseExecutiveDashboard-compatible props
  const pnlTotals = d
    ? {
        totalRevenue: d.revenue ?? 0,
        totalCOGS: d.totalCOGS ?? 0,
        grossProfit: d.grossProfit ?? d.revenue ?? 0,
        totalExpenses: d.totalExpenses ?? 0,
        operatingIncome: d.netIncome ?? 0,
        netIncome: d.netIncome ?? 0,
      }
    : null

  const arapSummary = d
    ? {
        customer_count: 0,
        total_ar: d.ar ?? 0,
        ar_overdue: 0,
        vendor_count: 0,
        total_ap: d.ap ?? 0,
      }
    : null

  const financialHealthScore =
    d?.healthScore != null
      ? {
          score: d.healthScore,
          rating: (d.healthRating ?? 'Fair') as
            | 'Excellent'
            | 'Good'
            | 'Fair'
            | 'Needs Attention'
            | 'Critical',
          components: {
            liquidity: {
              score: d.healthComponents?.liquidity ?? 50,
              weight: 30,
              details:
                d.cashBalance != null && d.ap != null
                  ? `Cash/AP: ${(d.cashBalance / (d.ap || 1)).toFixed(2)}`
                  : 'Insufficient data',
            },
            profitability: {
              score: d.healthComponents?.profitability ?? 50,
              weight: 30,
              details:
                d.revenue != null && d.netIncome != null
                  ? `Net Margin: ${((d.netIncome / (d.revenue || 1)) * 100).toFixed(1)}%`
                  : 'Insufficient data',
            },
            efficiency: {
              score: d.healthComponents?.efficiency ?? 50,
              weight: 25,
              details: 'From BC API',
            },
            leverage: {
              score: d.healthComponents?.leverage ?? 50,
              weight: 15,
              details: 'Insufficient data',
            },
          },
        }
      : null

  return {
    // Data
    pnlTotals,
    arapSummary,
    totalCash: d?.cashBalance ?? 0,
    financialHealthScore,
    currency: d?.currency,
    companyName: d?.companyName ?? '',
    period: d?.period ?? null,

    // Loading/error
    isLoading,
    error,
    mutate,
  }
}
