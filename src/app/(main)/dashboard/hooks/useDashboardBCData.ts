'use client'

import { useMemo } from 'react'
import {
  useWarehouseConfig,
  useWarehouseCompanyInfo,
  useWarehouseBankAccounts,
  useWarehouseARAP,
  computeRatiosFromBalanceSheet,
  useWarehouseEfficiencyMetrics,
  useWarehouseCashRunway,
  calculateFinancialHealthScore,
} from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'
import {
  useWarehousePnLStatement,
  useWarehouseBalanceSheet,
} from '@/app/(main)/bc-warehouse/reports/hooks/useWarehousePnLStatement'
import type { ProviderSnapshot } from './useDashboardQBData'
import type { DashboardDateRange } from './types'

export function useDashboardBCData(
  enabled: boolean,
  schemaOverride?: string,
  dateRange?: DashboardDateRange
): ProviderSnapshot {
  // Pass `enabled` to useWarehouseConfig to skip fetching warehouse config when not needed
  // (e.g., when only BC OAuth is connected, not warehouse/Redshift)
  const { schema: defaultSchema, isLoading: configLoading, isEnabled } = useWarehouseConfig(enabled)

  // Use override if provided, otherwise fall back to default config schema
  const schema = schemaOverride || defaultSchema
  // Only fetch if enabled AND (override provided OR warehouse is configured)
  const effectiveSchema = enabled && (schemaOverride || isEnabled) ? schema : null

  // Use dateRange if provided, otherwise default to last year
  const effectiveDateRange = useMemo(() => {
    if (dateRange) return { startDate: dateRange.startDate, endDate: dateRange.endDate }
    const lastYear = new Date().getFullYear() - 1
    return { startDate: `${lastYear}-01-01`, endDate: `${lastYear}-12-31` }
  }, [dateRange?.startDate, dateRange?.endDate])

  const { data: companyInfo } = useWarehouseCompanyInfo(effectiveSchema)
  const {
    data: pnlData,
    isLoading: pnlLoading,
    isValidating: pnlValidating,
  } = useWarehousePnLStatement(effectiveSchema, effectiveDateRange)
  const { totalCash, isLoading: bankLoading } = useWarehouseBankAccounts(effectiveSchema)
  const { data: arapData, isLoading: arapLoading } = useWarehouseARAP(effectiveSchema)
  const { data: balanceSheetData, isLoading: bsLoading } = useWarehouseBalanceSheet(
    effectiveSchema,
    effectiveDateRange
  )
  const ratiosData = useMemo(
    () => (balanceSheetData ? computeRatiosFromBalanceSheet(balanceSheetData) : null),
    [balanceSheetData]
  )
  const { data: efficiencyData, isLoading: efficiencyLoading } =
    useWarehouseEfficiencyMetrics(effectiveSchema)
  const { data: cashRunwayData, isLoading: cashRunwayLoading } = useWarehouseCashRunway(
    effectiveSchema,
    totalCash
  )

  const healthScore = useMemo(
    () =>
      calculateFinancialHealthScore(
        ratiosData,
        efficiencyData,
        cashRunwayData,
        pnlData?.totals
          ? { totalRevenue: pnlData.totals.totalRevenue, netIncome: pnlData.totals.netIncome }
          : null
      ),
    [ratiosData, efficiencyData, cashRunwayData, pnlData?.totals]
  )

  const currency = companyInfo?.currencyCode || undefined

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

  const isLoading =
    configLoading ||
    pnlLoading ||
    bankLoading ||
    arapLoading ||
    bsLoading ||
    efficiencyLoading ||
    cashRunwayLoading

  return {
    revenue: pnlData?.totals?.totalRevenue ?? null,
    revenueChange: null, // BC doesn't have period comparison in this hook
    grossProfit: pnlData?.totals?.grossProfit ?? null,
    grossProfitChange: null,
    netIncome: pnlData?.totals?.netIncome ?? null,
    netIncomeChange: null,
    cashBalance: totalCash || null,
    ar: arapData?.total_ar ?? null,
    ap: arapData?.total_ap ?? null,
    healthScore: healthScore?.score ?? null,
    healthRating: healthScore?.rating ?? null,
    healthComponents: healthScore?.components
      ? {
          liquidity: healthScore.components.liquidity.score,
          profitability: healthScore.components.profitability.score,
          efficiency: healthScore.components.efficiency.score,
          leverage: healthScore.components.leverage.score,
        }
      : null,
    currency,
    isLoading,
    isValidating: pnlValidating || false,
    error: null,
  }
}
