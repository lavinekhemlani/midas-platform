'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'
import type { DashboardDateRange } from './types'

export interface ProviderSnapshot {
  revenue: number | null
  revenueChange: number | null
  grossProfit: number | null
  grossProfitChange: number | null
  netIncome: number | null
  netIncomeChange: number | null
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
  currency?: string
  isLoading: boolean
  isValidating: boolean
  error: any
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    let errorData: any = {}
    try {
      errorData = await response.json()
    } catch {
      errorData = { message: 'Failed to fetch' }
    }
    const error: any = new Error(errorData.error || 'Failed to fetch')
    error.status = response.status
    throw error
  }
  return response.json()
}

/** Clamp a ratio-based score to 0-100 */
function ratioToScore(value: number | null | undefined, ideal: number, max: number): number {
  if (value == null) return 50
  // How close is value to ideal? Normalize to 0-100
  const ratio = Math.min(value / ideal, max / ideal)
  return Math.round(Math.max(0, Math.min(100, ratio * 70)))
}

function marginToScore(margin: number | null | undefined): number {
  if (margin == null) return 50
  // 0% margin = 0 score, 30%+ = 100 score
  return Math.round(Math.max(0, Math.min(100, (margin / 30) * 100)))
}

function dsoToScore(dso: number | null | undefined): number {
  if (dso == null) return 50
  // Lower DSO = better. 0 days = 100, 90+ days = 0
  return Math.round(Math.max(0, Math.min(100, ((90 - dso) / 90) * 100)))
}

function debtEquityToScore(de: number | null | undefined): number {
  if (de == null) return 50
  // Lower D/E = better. 0 = 100, 3+ = 0
  return Math.round(Math.max(0, Math.min(100, ((3 - de) / 3) * 100)))
}

export function useDashboardQBData(
  enabled: boolean,
  realmId?: string,
  dateRange?: DashboardDateRange
): ProviderSnapshot {
  const url = useMemo(() => {
    if (!enabled) return null
    const params = new URLSearchParams()
    if (dateRange?.period === 'custom') {
      params.set('startDate', dateRange.startDate)
      params.set('endDate', dateRange.endDate)
    } else {
      params.set('period', dateRange?.period || 'last_year')
    }
    if (realmId) params.set('realmId', realmId)
    return `/api/quickbooks/reports/executive-summary?${params.toString()}`
  }, [enabled, realmId, dateRange?.period, dateRange?.startDate, dateRange?.endDate])

  const { data, isLoading, error } = useSWR<any>(url, fetcher, {
    dedupingInterval: 15 * 60 * 1000,
    revalidateOnFocus: false,
    keepPreviousData: true,
    errorRetryCount: 2,
  })

  const d = data?.data

  if (!enabled) {
    return {
      revenue: null,
      revenueChange: null,
      grossProfit: null,
      grossProfitChange: null,
      netIncome: null,
      netIncomeChange: null,
      cashBalance: null,
      ar: null,
      ap: null,
      healthScore: null,
      healthRating: null,
      healthComponents: null,
      currency: undefined,
      isLoading: false,
      isValidating: false,
      error: null,
    }
  }

  // Derive health component scores from QB data
  const healthComponents = d
    ? {
        liquidity: ratioToScore(d.balanceSheet?.currentRatio, 2, 4),
        profitability: marginToScore(d.keyMetrics?.revenue?.netMargin),
        efficiency: dsoToScore(d.workingCapital?.accountsReceivable?.dso),
        leverage: debtEquityToScore(
          d.balanceSheet?.totalLiabilities && d.balanceSheet?.totalEquity
            ? d.balanceSheet.totalLiabilities / d.balanceSheet.totalEquity
            : null
        ),
      }
    : null

  // Find ending cash from waterfall
  const endingCash = d?.cashFlowWaterfall?.find(
    (w: any) => w.name === 'Ending Cash' || w.type === 'final'
  )?.value

  return {
    revenue: d?.keyMetrics?.revenue?.current ?? null,
    revenueChange: d?.keyMetrics?.revenue?.changePercent ?? null,
    grossProfit: d?.keyMetrics?.revenue?.grossProfit ?? null,
    grossProfitChange: null,
    netIncome: d?.keyMetrics?.profit?.current ?? null,
    netIncomeChange: d?.keyMetrics?.profit?.changePercent ?? null,
    cashBalance: endingCash ?? null,
    ar: d?.workingCapital?.accountsReceivable?.total ?? null,
    ap: d?.workingCapital?.accountsPayable?.total ?? null,
    healthScore: d?.financialHealth?.score ?? null,
    healthRating: d?.financialHealth?.rating ?? null,
    healthComponents,
    currency: d?.currency || undefined,
    isLoading,
    isValidating: false,
    error,
  }
}
