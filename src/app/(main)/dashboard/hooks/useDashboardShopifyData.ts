'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'
import type { ProviderSnapshot } from './useDashboardQBData'
import type { ShopifySummaryResponse } from '@/lib/providers/shopify/types'

interface FetchError extends Error {
  status?: number
}

const fetcher = async (url: string): Promise<{ data: ShopifySummaryResponse }> => {
  const response = await apiClient(url)
  if (!response.ok) {
    let errorData: { error?: string; message?: string } = {}
    try {
      errorData = await response.json()
    } catch {
      errorData = { message: 'Failed to fetch' }
    }
    const error: FetchError = new Error(errorData.error || 'Failed to fetch')
    error.status = response.status
    throw error
  }
  return response.json()
}

const emptySnapshot: ProviderSnapshot = {
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
 * Dashboard snapshot hook for Shopify stores.
 * Maps Shopify summary financials into ProviderSnapshot format for the ConnectionCard.
 */
export function useDashboardShopifyData(enabled: boolean, shopDomain?: string): ProviderSnapshot {
  const url =
    enabled && shopDomain
      ? `/api/providers/shopify/summary?shop=${encodeURIComponent(shopDomain)}`
      : null

  const { data, isLoading, isValidating, error } = useSWR(url, fetcher, {
    dedupingInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
    keepPreviousData: true,
    errorRetryCount: 2,
  })

  if (!enabled) return emptySnapshot

  const fin = data?.data?.financials
  const summary = data?.data?.summary

  if (!fin && !summary) {
    return {
      ...emptySnapshot,
      isLoading,
      isValidating,
      error,
    }
  }

  // Map Shopify financials to ProviderSnapshot
  // revenue = total revenue (all orders)
  // grossProfit = subtotal - discounts (product revenue net of discounts, before tax/shipping)
  // netIncome = net revenue (after refunds) — closest analogue to net income for e-commerce
  // cashBalance = Shopify Payments balance (if available)
  // ar/ap = not applicable for Shopify (e-commerce collects at checkout)

  const revenue = fin?.revenue ?? summary?.orders?.totalRevenue ?? null
  const grossProfit = fin?.grossProfit ?? null
  const netIncome = fin?.netRevenue ?? null
  const cashBalance = fin?.cashBalance ?? null
  const revenueChange = fin?.revenueChange ?? null
  const currency = fin?.currency || summary?.orders?.currency || undefined

  // Compute a simplified e-commerce health score
  const healthComponents =
    revenue != null && revenue > 0
      ? {
          // Liquidity: based on cash balance relative to revenue (proxy)
          liquidity:
            cashBalance != null ? Math.min(100, Math.round((cashBalance / revenue) * 200)) : 50,
          // Profitability: gross margin
          profitability:
            grossProfit != null
              ? Math.min(100, Math.max(0, Math.round((grossProfit / revenue) * 100)))
              : 50,
          // Efficiency: avg order value relative to $100 benchmark
          efficiency: fin?.avgOrderValue
            ? Math.min(100, Math.round((fin.avgOrderValue / 100) * 70))
            : 50,
          // Leverage: refund rate (lower is better) — inverted
          leverage:
            fin?.totalRefunded != null && revenue > 0
              ? Math.max(0, Math.round((1 - fin.totalRefunded / revenue) * 100))
              : 70,
        }
      : null

  const healthScore = healthComponents
    ? Math.round(
        (healthComponents.liquidity +
          healthComponents.profitability +
          healthComponents.efficiency +
          healthComponents.leverage) /
          4
      )
    : null

  const healthRating =
    healthScore != null
      ? healthScore >= 80
        ? 'Excellent'
        : healthScore >= 60
          ? 'Good'
          : healthScore >= 40
            ? 'Fair'
            : 'Needs Attention'
      : null

  return {
    revenue,
    revenueChange,
    grossProfit,
    grossProfitChange: null,
    netIncome,
    netIncomeChange: null,
    cashBalance,
    ar: null, // Not applicable for e-commerce
    ap: null,
    healthScore,
    healthRating,
    healthComponents,
    currency,
    isLoading,
    isValidating,
    error,
  }
}
