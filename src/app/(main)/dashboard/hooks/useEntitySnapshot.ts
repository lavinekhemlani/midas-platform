'use client'

import { useDashboardQBData, type ProviderSnapshot } from './useDashboardQBData'
import { useDashboardBCData } from './useDashboardBCData'
import { useDashboardBCOAuthData } from './useDashboardBCOAuthData'
import { useDashboardShopifyData } from './useDashboardShopifyData'
import {
  useDashboardQBTrend,
  useDashboardBCTrend,
  useDashboardBCOAuthTrend,
  useDashboardShopifyTrend,
  type TrendResult,
} from './useDashboardTrendData'
import type { DashboardDateRange } from './types'

export type EntityType = 'qb' | 'bc' | 'bc-oauth' | 'shopify' | null

const EMPTY_SNAPSHOT: ProviderSnapshot = {
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

const EMPTY_TREND: TrendResult = {
  data: [],
  currency: undefined as any,
  isLoading: false,
}

/**
 * Unified per-entity snapshot hook.
 * Internally calls all hooks unconditionally (React requires stable hook count),
 * but only the matching type fetches real data.
 */
export function useEntitySnapshot(
  type: EntityType,
  identifier?: string,
  dateRange?: DashboardDateRange
): ProviderSnapshot {
  const qbSnapshot = useDashboardQBData(type === 'qb', identifier, dateRange)
  const bcSnapshot = useDashboardBCData(type === 'bc', identifier, dateRange)
  const bcOAuthSnapshot = useDashboardBCOAuthData(type === 'bc-oauth', identifier, dateRange)
  const shopifySnapshot = useDashboardShopifyData(type === 'shopify', identifier)

  if (type === 'qb') return qbSnapshot
  if (type === 'bc') return bcSnapshot
  if (type === 'bc-oauth') return bcOAuthSnapshot
  if (type === 'shopify') return shopifySnapshot
  return EMPTY_SNAPSHOT
}

/**
 * Unified per-entity trend hook.
 * Same stable-hook-count pattern as useEntitySnapshot.
 */
export function useEntityTrend(
  type: EntityType,
  identifier?: string,
  _dateRange?: DashboardDateRange
): TrendResult {
  const qbTrend = useDashboardQBTrend(type === 'qb', identifier)
  const bcTrend = useDashboardBCTrend(type === 'bc', identifier)
  const bcOAuthTrend = useDashboardBCOAuthTrend(type === 'bc-oauth', identifier)
  const shopifyTrend = useDashboardShopifyTrend(type === 'shopify', identifier)

  if (type === 'qb') return qbTrend
  if (type === 'bc') return bcTrend
  if (type === 'bc-oauth') return bcOAuthTrend
  if (type === 'shopify') return shopifyTrend
  return EMPTY_TREND
}
