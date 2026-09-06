'use client'

import { useState, useMemo, useEffect } from 'react'
import { Banknote, RefreshCw, AlertCircle, Calendar, X } from 'lucide-react'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { PERIOD_OPTION_GROUPS } from '@/lib/utils/dateRanges'
import {
  useWarehouseConfig,
  useWarehouseCompanyInfo,
  useWarehouseARAP,
  useWarehouseAgedReceivables,
  useWarehouseAgedPayables,
  useWarehouseCashRunway,
  useWarehouseEfficiencyMetrics,
  computeRatiosFromBalanceSheet,
  calculateFinancialHealthScore,
} from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'
import {
  useWarehousePnLStatement,
  useWarehouseBalanceSheet,
} from '@/app/(main)/bc-warehouse/reports/hooks/useWarehousePnLStatement'
import {
  useCashFlowData,
  useCashFlowStatement,
  useCashMetrics,
  useCashPositionTrend,
  useCashFlowByActivity,
  useBankAccountBalances,
  type DateRange,
} from '@/app/(main)/bc/cash-flow/hooks/useCashFlowData'
import {
  CashFlowOverviewCard,
  CashFlowMetricsCard,
  BankAccountsCard,
  CashPositionTrendCard,
  CashFlowByActivityCard,
  CashFlowStatementCard,
} from '@/app/(main)/bc/cash-flow/components'
import { AgedReceivablesCard } from '@/app/(main)/bc/reports/components/AgedReceivablesCard'
import { AgedPayablesCard } from '@/app/(main)/bc/reports/components/AgedPayablesCard'
import { CashRunwayCard } from '@/app/(main)/bc/reports/components/CashRunwayCard'
import { EfficiencyMetricsCard } from '@/app/(main)/bc/reports/components/EfficiencyMetricsCard'
import { FinancialRatiosCard } from '@/app/(main)/bc/reports/components/FinancialRatiosCard'
import { FinancialHealthScoreCard } from '@/app/(main)/bc/reports/components/FinancialHealthScoreCard'
import { DateRangeInputs } from '@/app/(main)/reports/components/DateRangeInputs'
import { getDateRangeForPeriod } from '@/lib/utils/dateRanges'

// Local PeriodSelect component - matching Summary page styling
function CashFlowPeriodSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (period: string) => void
  disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full h-9 glass-luxury-card border-amber-500/20 hover:border-amber-500/40 transition-all duration-200 text-sm">
        <Calendar className="w-3.5 h-3.5 mr-2 text-amber-500" />
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent className="glass-luxury-card max-h-[400px]">
        {PERIOD_OPTION_GROUPS.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel className="text-[10px] uppercase tracking-wider text-amber-500/70 font-semibold px-2 py-1">
              {group.label}
            </SelectLabel>
            {group.options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="text-sm cursor-pointer pl-3"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

export function CashFlowView() {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  // Report loading state to WelcomeContext for coordinated loading UI
  const welcomeContext = useWelcomeContextOptional()

  // Date range filter state - default to last_year for comprehensive view
  const [selectedPeriod, setSelectedPeriod] = useState<string>('last_year')
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  })

  // Theme-aware styles - matching inventory page minimal aesthetic
  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      sectionBg: isLight ? 'bg-white' : 'bg-white/[0.02]',
      codeBg: isLight ? 'bg-stone-100' : 'bg-white/[0.04]',
      filterBg: isLight ? 'bg-stone-50' : 'bg-white/[0.02]',
      filterBorder: isLight ? 'border-stone-200' : 'border-white/[0.08]',
    }),
    [isLight]
  )

  // Calculate effective date range based on selected period
  const effectiveDateRange: DateRange | undefined = useMemo(() => {
    if (selectedPeriod === 'all_time') {
      return undefined
    }
    if (selectedPeriod === 'custom') {
      if (customDateRange.start && customDateRange.end) {
        return { startDate: customDateRange.start, endDate: customDateRange.end }
      }
      return undefined
    }
    // Use preset period
    const range = getDateRangeForPeriod(selectedPeriod)
    return { startDate: range.start, endDate: range.end }
  }, [selectedPeriod, customDateRange])

  // Handle period change
  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
    if (period !== 'custom') {
      setCustomDateRange({ start: '', end: '' })
    } else {
      // Seed custom dates from current effective range
      const range = getDateRangeForPeriod(
        selectedPeriod === 'all_time' ? 'last_year' : selectedPeriod
      )
      setCustomDateRange({ start: range.start, end: range.end })
    }
  }

  // Format date for display
  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Get display label for current filter
  const getFilterLabel = () => {
    if (selectedPeriod === 'all_time') return 'All Time'
    if (selectedPeriod === 'custom' && effectiveDateRange) {
      return `${formatDateDisplay(effectiveDateRange.startDate!)} - ${formatDateDisplay(effectiveDateRange.endDate!)}`
    }
    if (effectiveDateRange) {
      return `${formatDateDisplay(effectiveDateRange.startDate!)} - ${formatDateDisplay(effectiveDateRange.endDate!)}`
    }
    return 'All Time'
  }

  // Warehouse config
  const {
    config,
    schema,
    isLoading: configLoading,
    error: configError,
    isEnabled,
  } = useWarehouseConfig()

  // Company info for currency
  const { data: companyInfo } = useWarehouseCompanyInfo(schema)
  const currency = companyInfo?.currencyCode || 'USD'
  const companyName = companyInfo?.companyName || ''

  // Cash Flow data hooks
  const {
    data: cashFlowStatementData,
    isLoading: statementLoading,
    mutate: mutateStatement,
  } = useCashFlowStatement(schema, effectiveDateRange)

  const {
    data: cashMetricsData,
    isLoading: metricsLoading,
    mutate: mutateMetrics,
  } = useCashMetrics(schema, effectiveDateRange)

  const {
    data: cashPositionTrendData,
    statistics: cashPositionStatistics,
    isLoading: trendLoading,
    mutate: mutateTrend,
  } = useCashPositionTrend(schema, effectiveDateRange)

  const {
    data: cashFlowByActivityData,
    summary: activitySummary,
    isLoading: activityLoading,
    mutate: mutateActivity,
  } = useCashFlowByActivity(schema, effectiveDateRange)

  const {
    data: bankAccountBalances,
    totalCash,
    isLoading: bankLoading,
    mutate: mutateBank,
  } = useBankAccountBalances(schema)

  // Additional warehouse data for enhanced cash flow insights
  const { data: arapSummary, isLoading: arapLoading } = useWarehouseARAP(schema)
  const { summary: agedReceivablesSummary, isLoading: agedARLoading } =
    useWarehouseAgedReceivables(schema)
  const { summary: agedPayablesSummary, isLoading: agedAPLoading } =
    useWarehouseAgedPayables(schema)
  const { data: cashRunwayData, isLoading: cashRunwayLoading } = useWarehouseCashRunway(
    schema,
    totalCash,
    effectiveDateRange
  )
  const { data: efficiencyMetrics, isLoading: efficiencyLoading } = useWarehouseEfficiencyMetrics(
    schema,
    effectiveDateRange
  )
  const { data: balanceSheetData, isLoading: bsLoading } = useWarehouseBalanceSheet(
    schema,
    effectiveDateRange
  )
  const financialRatios = useMemo(
    () => (balanceSheetData ? computeRatiosFromBalanceSheet(balanceSheetData) : null),
    [balanceSheetData]
  )
  const ratiosLoading = bsLoading
  const { data: pnlStatementData, isLoading: pnlLoading } = useWarehousePnLStatement(
    schema,
    effectiveDateRange
  )

  const financialHealthScore = useMemo(
    () =>
      calculateFinancialHealthScore(
        financialRatios,
        efficiencyMetrics,
        cashRunwayData,
        pnlStatementData?.totals
          ? {
              totalRevenue: pnlStatementData.totals.totalRevenue,
              netIncome: pnlStatementData.totals.netIncome,
            }
          : null
      ),
    [financialRatios, efficiencyMetrics, cashRunwayData, pnlStatementData?.totals]
  )

  const isLoading =
    statementLoading || metricsLoading || trendLoading || activityLoading || bankLoading

  // Report loading state to WelcomeContext
  useEffect(() => {
    const hasData = !!cashFlowStatementData || !!cashMetricsData
    welcomeContext?.setDataLoading(configLoading || (isLoading && !hasData))
  }, [welcomeContext, configLoading, isLoading, cashFlowStatementData, cashMetricsData])

  const mutateAll = () => {
    mutateStatement()
    mutateMetrics()
    mutateTrend()
    mutateActivity()
    mutateBank()
  }

  // ALL useMemo hooks MUST be called before any early returns (Rules of Hooks)
  // Prepare overview data from statistics - memoized to prevent unnecessary re-renders
  const overviewData = useMemo(() => {
    if (cashPositionStatistics) {
      return {
        currentCash: cashPositionStatistics.currentCash,
        previousPeriodCash: cashPositionStatistics.previousCash,
        netCashChange: cashPositionStatistics.monthOverMonthChange,
        operatingCashFlow: cashMetricsData?.operatingCashFlow || 0,
        investingCashFlow: activitySummary?.investing || 0,
        financingCashFlow: activitySummary?.financing || 0,
      }
    }
    return {
      currentCash: totalCash,
      previousPeriodCash: 0,
      netCashChange: 0,
      operatingCashFlow: cashMetricsData?.operatingCashFlow || 0,
      investingCashFlow: activitySummary?.investing || 0,
      financingCashFlow: activitySummary?.financing || 0,
    }
  }, [
    cashPositionStatistics,
    cashMetricsData?.operatingCashFlow,
    activitySummary?.investing,
    activitySummary?.financing,
    totalCash,
  ])

  // Prepare metrics data - memoized
  const metricsCardData = useMemo(() => {
    if (!cashMetricsData) return null
    return {
      operatingCashFlow: cashMetricsData.operatingCashFlow,
      freeCashFlow: cashMetricsData.freeCashFlow,
      cashRunway: cashMetricsData.cashRunway,
      burnRate: cashMetricsData.burnRate,
      cashConversionCycle: cashMetricsData.cashConversionCycle,
      operatingCashFlowRatio: cashMetricsData.operatingCashFlowRatio,
    }
  }, [cashMetricsData])

  // Prepare bank accounts data - memoized
  const bankAccountsData = useMemo(
    () =>
      bankAccountBalances.map((account) => ({
        no: account.no,
        name: account.name,
        balance_lcy: account.balance_lcy,
        currency_code: account.currency_code || currency,
      })),
    [bankAccountBalances, currency]
  )

  // Prepare cash position trend data - memoized
  const trendDataForChart = useMemo(
    () =>
      cashPositionTrendData
        .map((row) => ({
          month: row.month,
          ending_cash: Number(row.ending_cash),
          net_change: Number(row.net_change),
          cash_inflows: Number(row.cash_inflows),
          cash_outflows: Number(row.cash_outflows),
        }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()),
    [cashPositionTrendData]
  )

  // Prepare cash flow by activity data - memoized
  const activityDataForChart = useMemo(
    () =>
      cashFlowByActivityData
        .reduce(
          (acc, row) => {
            const monthKey = row.month
            let monthEntry = acc.find((m) => m.month === monthKey)
            if (!monthEntry) {
              monthEntry = {
                month: monthKey,
                operating: 0,
                investing: 0,
                financing: 0,
              }
              acc.push(monthEntry)
            }
            if (row.activity_type === 'operating') monthEntry.operating = Number(row.net_amount)
            if (row.activity_type === 'investing') monthEntry.investing = Number(row.net_amount)
            if (row.activity_type === 'financing') monthEntry.financing = Number(row.net_amount)
            return acc
          },
          [] as Array<{ month: string; operating: number; investing: number; financing: number }>
        )
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()),
    [cashFlowByActivityData]
  )

  // Prepare statement data
  const statementCardData = cashFlowStatementData

  // Handle config loading - AFTER all hooks
  if (configLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-sm theme-text-secondary">Loading warehouse configuration...</p>
        </div>
      </div>
    )
  }

  // Handle config error or not enabled
  if (configError || !config || !isEnabled) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h3 className="text-lg font-semibold theme-text-primary">Warehouse Access Error</h3>
          <p className="text-sm theme-text-secondary">
            {configError?.message ||
              'Warehouse is not enabled for this organization. Please contact your administrator.'}
          </p>
          <Button variant="outline" onClick={() => window.location.reload()} className="mt-2">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Handle no schema available
  if (!schema) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500" />
          <h3 className="text-lg font-semibold theme-text-primary">No Schema Available</h3>
          <p className="text-sm theme-text-secondary">
            No warehouse schema is configured for this organization.
          </p>
        </div>
      </div>
    )
  }

  // Format date range for display (matching Summary page style)
  const formatDateRange = () => {
    if (!effectiveDateRange?.startDate || !effectiveDateRange?.endDate) return null
    const fmt = (d: string) =>
      new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    return (
      <span className="flex items-center gap-2 text-sm theme-text-secondary">
        <span className="font-serif italic text-[0.9rem] theme-text-primary">from</span>
        <span>{fmt(effectiveDateRange.startDate)}</span>
        <span className="font-serif italic text-[0.9rem] theme-text-primary">to</span>
        <span>{fmt(effectiveDateRange.endDate)}</span>
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header - matching Summary page styling */}
      <div className="border-b border-gray-200/10 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2">
              <Banknote className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-semibold theme-text-primary">Cash Flow</h1>
              <p className="text-sm theme-text-secondary">
                {companyName && `${companyName} · `}
                {schema}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedPeriod === 'custom' && (
              <DateRangeInputs
                startDate={customDateRange.start}
                endDate={customDateRange.end}
                onStartChange={(date) => setCustomDateRange((prev) => ({ ...prev, start: date }))}
                onEndChange={(date) => setCustomDateRange((prev) => ({ ...prev, end: date }))}
                compact
              />
            )}
            {selectedPeriod !== 'custom' && (
              <span className="hidden sm:inline">{formatDateRange()}</span>
            )}
            <div className="w-[160px]">
              <CashFlowPeriodSelect
                value={selectedPeriod}
                onChange={handlePeriodChange}
                disabled={isLoading}
              />
            </div>
            {selectedPeriod !== 'all_time' && (
              <button
                onClick={() => setSelectedPeriod('all_time')}
                className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors"
                title="Clear date filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => mutateAll()}
              disabled={isLoading}
              className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Overview strip - similar to inventory key metrics */}
      <CashFlowOverviewCard
        data={overviewData}
        isLoading={trendLoading || metricsLoading}
        currency={currency}
        isLight={isLight}
      />

      {/* Main content grid - Metrics & Bank Accounts */}
      <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-6">
        {/* Cash Metrics */}
        <Card className="glass-luxury-card border border-gray-200/10">
          <CardContent className="p-5">
            <CashFlowMetricsCard
              data={metricsCardData}
              isLoading={metricsLoading}
              currency={currency}
            />
          </CardContent>
        </Card>

        {/* Bank Accounts */}
        <Card className="glass-luxury-card border border-gray-200/10">
          <CardContent className="p-5">
            <BankAccountsCard
              accounts={bankAccountsData}
              totalCash={totalCash}
              isLoading={bankLoading}
              currency={currency}
            />
          </CardContent>
        </Card>
      </div>

      {/* Charts section - Trend & Activity */}
      <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-6">
        <Card className="glass-luxury-card border border-gray-200/10">
          <CardContent className="p-5">
            <CashPositionTrendCard
              data={trendDataForChart}
              isLoading={trendLoading}
              currency={currency}
            />
          </CardContent>
        </Card>
        <Card className="glass-luxury-card border border-gray-200/10">
          <CardContent className="p-5">
            <CashFlowByActivityCard
              data={activityDataForChart}
              isLoading={activityLoading}
              currency={currency}
            />
          </CardContent>
        </Card>
      </div>

      {/* Financial metrics section */}
      <div className={cn('pt-6 border-t', styles.border)}>
        <h2 className={cn('text-xs font-medium uppercase tracking-wider mb-4', styles.textMuted)}>
          Financial Health
        </h2>
        <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3 gap-6">
          <CashRunwayCard data={cashRunwayData} isLoading={cashRunwayLoading} currency={currency} />
          <EfficiencyMetricsCard metrics={efficiencyMetrics} isLoading={efficiencyLoading} />
          <FinancialHealthScoreCard
            healthScore={financialHealthScore}
            isLoading={pnlLoading || ratiosLoading || efficiencyLoading || cashRunwayLoading}
          />
        </div>
      </div>

      {/* Aged balances section */}
      <div className={cn('pt-6 border-t', styles.border)}>
        <h2 className={cn('text-xs font-medium uppercase tracking-wider mb-4', styles.textMuted)}>
          Receivables & Payables
        </h2>
        <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3 gap-6">
          <AgedReceivablesCard
            summary={agedReceivablesSummary}
            isLoading={agedARLoading}
            currency={currency}
          />
          <AgedPayablesCard
            summary={agedPayablesSummary}
            isLoading={agedAPLoading}
            currency={currency}
          />
          <FinancialRatiosCard
            ratios={financialRatios}
            isLoading={ratiosLoading}
            currency={currency}
          />
        </div>
      </div>

      {/* Statement section */}
      <div className={cn('pt-6 border-t', styles.border)}>
        <CashFlowStatementCard
          data={statementCardData}
          isLoading={statementLoading}
          currency={currency}
          isLight={isLight}
          dateRange={
            effectiveDateRange?.startDate && effectiveDateRange?.endDate
              ? { start: effectiveDateRange.startDate, end: effectiveDateRange.endDate }
              : undefined
          }
        />
      </div>
    </div>
  )
}
