'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'
import type { ProviderSnapshot } from './useDashboardQBData'
import type { DashboardDateRange } from './types'

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null // No OAuth connection
    const error: any = new Error('Failed to fetch BC OAuth data')
    error.status = response.status
    throw error
  }
  return response.json()
}

const EMPTY: ProviderSnapshot = {
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

/**
 * Dashboard hook for BC OAuth connections.
 * Fetches financial snapshot from the BC API (not Redshift).
 */
export function useDashboardBCOAuthData(
  enabled: boolean,
  connectionId?: string,
  dateRange?: DashboardDateRange
): ProviderSnapshot {
  const url = useMemo(() => {
    if (!enabled) return null
    const params = new URLSearchParams()
    if (connectionId) params.set('connectionId', connectionId)
    if (dateRange) {
      params.set('startDate', dateRange.startDate)
      params.set('endDate', dateRange.endDate)
    }
    const qs = params.toString()
    return `/api/providers/dynamics/financial-summary${qs ? '?' + qs : ''}`
  }, [enabled, connectionId, dateRange?.startDate, dateRange?.endDate])

  const { data, isLoading, isValidating, error } = useSWR(url, fetcher, {
    dedupingInterval: 15 * 60 * 1000,
    revalidateOnFocus: false,
    keepPreviousData: true,
    errorRetryCount: 2,
  })

  if (!enabled) return EMPTY

  const d = data?.data
  if (!d) return { ...EMPTY, isLoading, isValidating, error }

  return {
    revenue: d.revenue ?? null,
    revenueChange: d.revenueChange ?? null,
    grossProfit: d.grossProfit ?? null,
    grossProfitChange: d.grossProfitChange ?? null,
    netIncome: d.netIncome ?? null,
    netIncomeChange: d.netIncomeChange ?? null,
    cashBalance: d.cashBalance ?? null,
    ar: d.ar ?? null,
    ap: d.ap ?? null,
    healthScore: d.healthScore ?? null,
    healthRating: d.healthRating ?? null,
    healthComponents: d.healthComponents ?? null,
    currency: d.currency || undefined,
    isLoading,
    isValidating,
    error,
  }
}
