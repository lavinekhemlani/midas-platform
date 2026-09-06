'use client'

import { useState, useMemo, useEffect } from 'react'
import { useBCSummary } from '../../hooks/useBCSummary'
import { useBCIncomeStatement } from '../../hooks/useBCIncomeStatement'
import { useBCBalanceSheet } from '../../hooks/useBCBalanceSheet'
import { useBCEnhancedData } from '../../hooks/useBCEnhancedData'
import { useBCMonthlyTrend } from '../../hooks/useBCMonthlyTrend'
import { useBCSalesGeography } from '../../hooks/useBCSalesGeography'
import { useBCOAuthCashFlowByActivity } from '../../hooks/useBCOAuthCashFlowByActivity'
import { useBCOAuthCashFlowStatement } from '../../hooks/useBCOAuthCashFlowStatement'
import { BCOAuthExecutiveDashboard } from '../components/BCOAuthExecutiveDashboard'
import { KPIStrip } from '@/app/(main)/shopify/components/KPIStrip'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useAIAnalysis, formatAnalysisSections } from '@/components/ai-analysis'
import { calculateFinancialHealthScore } from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'
import type { FinancialRatios } from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'
import { getDateRangeForPeriod } from '@/lib/utils/dateRanges'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { AlertCircle, RefreshCw, Calendar, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PERIOD_OPTION_GROUPS, PERIOD_OPTIONS } from '@/lib/utils/dateRanges'
import { PeriodPicker } from '../../components/PeriodPicker'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { useCurrency } from '@/contexts/CurrencyContext'

export function BCOAuthSummaryView({ connectionId }: { connectionId: string }) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [selectedPeriod, setSelectedPeriod] = useState('this_year')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const dateRange = useMemo(() => {
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate }
    }
    const range = getDateRangeForPeriod(selectedPeriod)
    return { startDate: range.start, endDate: range.end }
  }, [selectedPeriod, customStartDate, customEndDate])

  const summary = useBCSummary(connectionId, dateRange)
  const pnl = useBCIncomeStatement(connectionId, dateRange)
  const bs = useBCBalanceSheet(connectionId, dateRange?.endDate)
  const enhanced = useBCEnhancedData(connectionId, dateRange)
  const trend = useBCMonthlyTrend(connectionId, dateRange)
  const salesGeo = useBCSalesGeography(connectionId, dateRange)
  const cfActivity = useBCOAuthCashFlowByActivity(connectionId, dateRange)
  const cfStatement = useBCOAuthCashFlowStatement(connectionId, dateRange)

  const isLoading =
    summary.isLoading || pnl.isLoading || bs.isLoading || enhanced.isLoading || trend.isLoading
  const error = summary.error || pnl.error || bs.error

  // Report loading state to WelcomeContext for coordinated loading UI
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    // Consider data loaded when we have ANY meaningful data OR when loading completes (even with errors)
    const hasData = !!pnl.totals || !!bs.totals || !!summary.pnlTotals
    const allDoneLoading = !summary.isLoading && !pnl.isLoading && !bs.isLoading

    // Dismiss welcome overlay when:
    // 1. We have data, OR
    // 2. All hooks finished loading (even if they returned no data or errors)
    if (hasData || allDoneLoading) {
      welcomeContext?.setDataLoading(false)
    } else {
      welcomeContext?.setDataLoading(true)
    }
  }, [
    welcomeContext,
    summary.isLoading,
    pnl.isLoading,
    bs.isLoading,
    pnl.totals,
    bs.totals,
    summary.pnlTotals,
  ])

  const mutateAll = () => {
    summary.mutate()
    pnl.mutate()
    bs.mutate()
    enhanced.mutate()
    trend.mutate()
    salesGeo.mutate()
    cfActivity.mutate()
    cfStatement.mutate()
  }

  const companyName = enhanced.companyName || summary.companyName || pnl.companyName || ''
  const currency = enhanced.currency || summary.currency
  const { setCurrency } = useCurrency()

  // Sync BC currency into the global context so TopBar can display it
  useEffect(() => {
    if (currency) setCurrency(currency)
  }, [currency, setCurrency])

  // Use P&L hook totals (more accurate from report lines) when available, fall back to summary
  const pnlTotals = pnl.totals || summary.pnlTotals

  const bsTotals = bs.totals
    ? {
        totalAssets: bs.totals.totalAssets,
        totalLiabilities: bs.totals.totalLiabilities,
        totalEquity: bs.totals.totalEquity,
      }
    : null

  // Merge financial ratios: server-side (currentRatio, quickRatio, debtToEquity, workingCapital)
  // + client-side margins from P&L totals
  const mergedRatios = useMemo((): FinancialRatios | null => {
    const serverRatios = enhanced.financialRatios
    if (!serverRatios && !pnlTotals) return null

    const revenue = pnlTotals?.totalRevenue ?? 0
    return {
      currentRatio: serverRatios?.currentRatio ?? null,
      quickRatio: serverRatios?.quickRatio ?? null,
      debtToEquity: serverRatios?.debtToEquity ?? null,
      workingCapital: serverRatios?.workingCapital ?? 0,
      grossMargin: revenue > 0 && pnlTotals ? (pnlTotals.grossProfit / revenue) * 100 : null,
      netMargin: revenue > 0 && pnlTotals ? (pnlTotals.netIncome / revenue) * 100 : null,
      operatingMargin:
        revenue > 0 && pnlTotals ? (pnlTotals.operatingIncome / revenue) * 100 : null,
      currentAssets: serverRatios?.currentAssets,
      currentLiabilities: serverRatios?.currentLiabilities,
      inventory: serverRatios?.inventory,
      totalLiabilities: serverRatios?.totalLiabilities,
      totalEquity: serverRatios?.totalEquity,
    }
  }, [enhanced.financialRatios, pnlTotals])

  // Compute financial health score
  const computedHealthScore = useMemo(() => {
    return calculateFinancialHealthScore(
      mergedRatios,
      enhanced.efficiencyMetrics,
      enhanced.cashRunwayData,
      pnlTotals ? { totalRevenue: pnlTotals.totalRevenue, netIncome: pnlTotals.netIncome } : null
    )
  }, [mergedRatios, enhanced.efficiencyMetrics, enhanced.cashRunwayData, pnlTotals])

  // Fallback aged summaries from arapSummary when aged data is null
  const arapData = enhanced.arapSummary || summary.arapSummary
  const agedReceivablesSummary = useMemo(() => {
    if (enhanced.agedReceivables) return enhanced.agedReceivables
    if (!arapData?.total_ar) return null
    // Create summary from arapSummary - put all in "current" since we don't have breakdown
    return {
      current: arapData.total_ar - (arapData.ar_overdue || 0),
      days_1_30: arapData.ar_overdue || 0,
      days_31_60: 0,
      days_61_90: 0,
      days_over_90: 0,
      total: arapData.total_ar,
      customer_count: arapData.customer_count || 0,
    }
  }, [enhanced.agedReceivables, arapData])

  const agedPayablesSummary = useMemo(() => {
    if (enhanced.agedPayables) return enhanced.agedPayables
    if (!arapData?.total_ap) return null
    // Create summary from arapSummary - put all in "current" since we don't have breakdown
    return {
      current: arapData.total_ap,
      days_1_30: 0,
      days_31_60: 0,
      days_61_90: 0,
      days_over_90: 0,
      total: arapData.total_ap,
      vendor_count: arapData.vendor_count || 0,
    }
  }, [enhanced.agedPayables, arapData])

  // AI Analysis — fetched here, sections rendered inline in the dashboard
  const aiAnalysis = useAIAnalysis({
    pageType: 'summary',
    data: {
      pnlMetrics: pnlTotals
        ? {
            totalRevenue: pnlTotals.totalRevenue,
            totalCOGS: pnlTotals.totalCOGS,
            grossProfit: pnlTotals.grossProfit,
            totalExpenses: pnlTotals.totalExpenses,
            operatingIncome: pnlTotals.operatingIncome,
            netIncome: pnlTotals.netIncome,
          }
        : null,
      bsMetrics: bsTotals,
      cashBalance: enhanced.totalCash || summary.totalCash || 0,
      financialRatios: mergedRatios,
      efficiencyMetrics: enhanced.efficiencyMetrics,
      cashRunwayData: cfStatement.statement
        ? (() => {
            const stmt = cfStatement.statement!
            const ocf = stmt.operatingActivities.totalOperating
            const capex = stmt.investingActivities.capitalExpenditures
            const fcf = ocf + capex
            const monthCount = trend.months.length || 12
            const monthlyFCF = fcf / monthCount
            const burnRate = monthlyFCF < 0 ? Math.abs(monthlyFCF) : 0
            const cashBalance = enhanced.cashRunwayData?.totalCash ?? enhanced.totalCash ?? 0
            return {
              totalCash: cashBalance,
              monthlyExpenses: burnRate,
              monthlyRevenue: enhanced.cashRunwayData?.monthlyRevenue ?? 0,
              grossBurnRate: burnRate,
              netBurnRate: burnRate,
              cashRunwayMonths: burnRate > 0 ? Math.max(0, cashBalance / burnRate) : null,
              avgMonthlyNetIncome: enhanced.cashRunwayData?.avgMonthlyNetIncome ?? 0,
            }
          })()
        : enhanced.cashRunwayData,
      monthlyTrend: trend.months,
      cashFlowByActivity: cfStatement.statement
        ? {
            operating: cfStatement.statement.operatingActivities.totalOperating,
            investing: cfStatement.statement.investingActivities.totalInvesting,
            financing: cfStatement.statement.financingActivities.totalFinancing,
          }
        : cfActivity.summary,
      topCustomers: enhanced.topCustomers,
      topVendors: enhanced.topVendors,
      agedReceivables: enhanced.agedReceivables,
      agedPayables: enhanced.agedPayables,
      inventorySummary: enhanced.inventorySummary,
    },
    dateRange: {
      start: dateRange.startDate,
      end: dateRange.endDate,
    },
    context: {
      currency,
      companyName,
      healthScore: computedHealthScore,
    },
    autoGenerate: true,
    dataLoadingStates: {
      pnlLoading: pnl.isLoading || summary.isLoading,
      bsLoading: bs.isLoading,
      trendLoading: trend.isLoading,
      cashFlowLoading: cfActivity.isLoading || cfStatement.isLoading,
      enhancedLoading: enhanced.isLoading,
    },
  })

  const analysisSections = useMemo(() => {
    if (!aiAnalysis.structuredAnalysis) return null
    return formatAnalysisSections(aiAnalysis.structuredAnalysis)
  }, [aiAnalysis.structuredAnalysis])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500" />
          <h3 className="text-lg font-semibold theme-text-primary">Data Load Error</h3>
          <p className="text-sm theme-text-secondary">
            {error instanceof Error ? error.message : 'Failed to load data. Please try again.'}
          </p>
          <Button variant="outline" onClick={mutateAll} className="mt-2">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-10 pt-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="dashboard-title text-[36px] font-light theme-text-primary tracking-tight">
              Summary
            </h1>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-amber-500/80 mt-2">
              Business Central
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PeriodPicker
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onCustomStartDateChange={setCustomStartDate}
              onCustomEndDateChange={setCustomEndDate}
              disabled={isLoading}
            />
            <button
              onClick={mutateAll}
              disabled={isLoading}
              className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <KPIStrip
        isLight={isLight}
        isLoading={isLoading}
        cards={
          pnlTotals
            ? [
                {
                  label: 'Revenue',
                  kpi: { value: pnlTotals.totalRevenue },
                  format: (v) => formatCompactCurrency(v, currency || 'USD'),
                },
                {
                  label: 'Net Income',
                  kpi: { value: pnlTotals.netIncome },
                  format: (v) => formatCompactCurrency(v, currency || 'USD'),
                  valueColor: pnlTotals.netIncome < 0 ? 'text-red-500' : undefined,
                },
                ...(bsTotals
                  ? [
                      {
                        label: 'Total Assets',
                        kpi: { value: bsTotals.totalAssets },
                        format: (v: number) => formatCompactCurrency(v, currency || 'USD'),
                      },
                      {
                        label: 'Total Equity',
                        kpi: { value: bsTotals.totalEquity },
                        format: (v: number) => formatCompactCurrency(v, currency || 'USD'),
                      },
                    ]
                  : []),
              ]
            : []
        }
      />

      {/* Executive Dashboard — OAuth-specific component */}
      <BCOAuthExecutiveDashboard
        pnlTotals={pnlTotals}
        bsTotals={bsTotals}
        monthlyTrend={trend.months}
        arapSummary={enhanced.arapSummary || summary.arapSummary}
        bankAccounts={enhanced.bankAccounts}
        totalCash={enhanced.totalCash || summary.totalCash}
        topCustomers={enhanced.topCustomers}
        agedReceivablesSummary={agedReceivablesSummary}
        agedPayablesSummary={agedPayablesSummary}
        topVendors={enhanced.topVendors}
        financialRatios={mergedRatios}
        monthlyRevenue={enhanced.monthlyRevenue}
        cashFlowByActivity={cfActivity.months}
        cashFlowActivitySummary={
          cfStatement.statement
            ? {
                operating: cfStatement.statement.operatingActivities.totalOperating,
                investing: cfStatement.statement.investingActivities.totalInvesting,
                financing: cfStatement.statement.financingActivities.totalFinancing,
              }
            : cfActivity.summary
        }
        inventorySummary={enhanced.inventorySummary}
        inventoryItems={enhanced.inventoryItems}
        cashRunwayData={(() => {
          // Use cfStatement for burn rate (indirect method) + enhanced for cash balance (bank accounts)
          console.log(
            '[CashRunway] cfStatement available:',
            !!cfStatement.statement,
            'loading:',
            cfStatement.isLoading,
            'error:',
            cfStatement.error
          )
          if (cfStatement.statement) {
            const stmt = cfStatement.statement
            const ocf = stmt.operatingActivities.totalOperating
            const capex = stmt.investingActivities.capitalExpenditures
            const fcf = ocf + capex
            const monthCount = trend.months.length || 12
            const monthlyFCF = fcf / monthCount
            const burnRate = monthlyFCF < 0 ? Math.abs(monthlyFCF) : 0
            const cashBalance = enhanced.cashRunwayData?.totalCash ?? enhanced.totalCash ?? 0
            return {
              totalCash: cashBalance,
              monthlyExpenses: burnRate,
              monthlyRevenue: enhanced.cashRunwayData?.monthlyRevenue ?? 0,
              grossBurnRate: burnRate,
              netBurnRate: burnRate,
              cashRunwayMonths: burnRate > 0 ? Math.max(0, cashBalance / burnRate) : null,
              avgMonthlyNetIncome: enhanced.cashRunwayData?.avgMonthlyNetIncome ?? 0,
            }
          }
          return enhanced.cashRunwayData
        })()}
        efficiencyMetrics={enhanced.efficiencyMetrics}
        financialHealthScore={computedHealthScore || summary.financialHealthScore}
        salesBySalesperson={enhanced.salesBySalesperson}
        pnlLoading={pnl.isLoading || summary.isLoading}
        bsLoading={bs.isLoading}
        trendLoading={trend.isLoading}
        cashFlowActivityLoading={cfActivity.isLoading || cfStatement.isLoading}
        arapLoading={enhanced.isLoading || summary.isLoading}
        bankLoading={enhanced.isLoading}
        customersLoading={enhanced.isLoading}
        agedARLoading={enhanced.isLoading}
        agedAPLoading={enhanced.isLoading}
        vendorsLoading={enhanced.isLoading}
        ratiosLoading={enhanced.isLoading}
        revenueLoading={enhanced.isLoading}
        inventoryLoading={enhanced.isLoading}
        cashRunwayLoading={enhanced.isLoading || cfStatement.isLoading}
        efficiencyLoading={enhanced.isLoading}
        healthScoreLoading={enhanced.isLoading || summary.isLoading}
        salespersonLoading={enhanced.isLoading}
        salesByCountry={salesGeo.byCountry}
        salesGeoLoading={salesGeo.isLoading}
        currency={currency}
        connectionId={connectionId}
        analysisSections={analysisSections}
        analysisLoading={aiAnalysis.loading}
      />
    </div>
  )
}
