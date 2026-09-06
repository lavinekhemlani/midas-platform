'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, RefreshCw, AlertCircle, Calendar, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { PERIOD_OPTION_GROUPS } from '@/lib/utils/dateRanges'
import {
  useWarehouseConfig,
  useWarehouseCompanyInfo,
  useWarehouseARAP,
  useWarehouseBankAccounts,
  useWarehouseAgedReceivables,
  useWarehouseAgedPayables,
  computeRatiosFromBalanceSheet,
  useWarehouseCashRunway,
  useWarehouseEfficiencyMetrics,
  calculateFinancialHealthScore,
  type DateRange,
} from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'
import {
  useWarehouseBalanceSheet,
  useWarehousePnLStatement,
} from '@/app/(main)/bc-warehouse/reports/hooks/useWarehousePnLStatement'
import { WarehouseBalanceSheet } from '@/app/(main)/bc-warehouse/reports/components/WarehouseBalanceSheet'
import dynamic from 'next/dynamic'
const WarehouseExportButtons = dynamic(
  () =>
    import('@/app/(main)/bc-warehouse/reports/components/WarehouseExportButtons').then(
      (m) => m.WarehouseExportButtons
    ),
  { ssr: false }
)
import { AgedReceivablesCard } from '@/app/(main)/bc/reports/components/AgedReceivablesCard'
import { AgedPayablesCard } from '@/app/(main)/bc/reports/components/AgedPayablesCard'
import { FinancialRatiosCard } from '@/app/(main)/bc/reports/components/FinancialRatiosCard'
import { CashRunwayCard } from '@/app/(main)/bc/reports/components/CashRunwayCard'
import { FinancialHealthScoreCard } from '@/app/(main)/bc/reports/components/FinancialHealthScoreCard'
import { EfficiencyMetricsCard } from '@/app/(main)/bc/reports/components/EfficiencyMetricsCard'
import { DateRangeInputs } from '@/app/(main)/reports/components/DateRangeInputs'
import { getDateRangeForPeriod } from '@/lib/utils/dateRanges'
import { BalanceSheetCompositionChart } from '@/app/(main)/bc/balance-sheet/components/BalanceSheetCompositionChart'
import { BalanceSheetSummaryStrip } from '@/app/(main)/bc/balance-sheet/components/BalanceSheetSummaryStrip'
import { BalanceSheetWaterfallChart } from '@/app/(main)/bc/balance-sheet/components/BalanceSheetWaterfallChart'

function BalanceSheetPeriodSelect({
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

export function BalanceSheetView() {
  const router = useRouter()
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const welcomeContext = useWelcomeContextOptional()

  const [selectedPeriod, setSelectedPeriod] = useState<string>('last_year')
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  })

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      sectionBg: isLight ? 'bg-white' : 'bg-white/[0.02]',
      filterBg: isLight ? 'bg-stone-50' : 'bg-white/[0.02]',
      filterBorder: isLight ? 'border-stone-200' : 'border-white/[0.08]',
    }),
    [isLight]
  )

  const effectiveDateRange: DateRange | undefined = useMemo(() => {
    if (selectedPeriod === 'all_time') return undefined
    if (selectedPeriod === 'custom') {
      if (customDateRange.start && customDateRange.end) {
        return { startDate: customDateRange.start, endDate: customDateRange.end }
      }
      return undefined
    }
    const range = getDateRangeForPeriod(selectedPeriod)
    return { startDate: range.start, endDate: range.end }
  }, [selectedPeriod, customDateRange])

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
    if (period !== 'custom') {
      setCustomDateRange({ start: '', end: '' })
    } else {
      const range = getDateRangeForPeriod(
        selectedPeriod === 'all_time' ? 'last_year' : selectedPeriod
      )
      setCustomDateRange({ start: range.start, end: range.end })
    }
  }

  const formatDisplayDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return ''
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatDateRange = () => {
    if (!effectiveDateRange) return null
    return (
      <span className="flex items-center gap-2 text-sm theme-text-secondary">
        <span className="font-serif italic text-[0.9rem] theme-text-primary">from</span>
        <span>{formatDisplayDate(effectiveDateRange.startDate)}</span>
        <span className="font-serif italic text-[0.9rem] theme-text-primary">to</span>
        <span>{formatDisplayDate(effectiveDateRange.endDate)}</span>
      </span>
    )
  }

  const {
    config,
    schema,
    isLoading: configLoading,
    error: configError,
    isEnabled,
  } = useWarehouseConfig()

  useEffect(() => {
    if (!configLoading && (configError || !config || !isEnabled || !schema)) {
      router.replace('/settings?connect=dynamics')
    }
  }, [configLoading, configError, config, isEnabled, schema, router])

  const { data: companyInfo } = useWarehouseCompanyInfo(schema)
  const currency = companyInfo?.currencyCode || 'USD'
  const companyName = companyInfo?.companyName || ''

  const {
    data: balanceSheetData,
    isLoading: balanceSheetLoading,
    error: balanceSheetError,
    mutate: mutateBalanceSheet,
  } = useWarehouseBalanceSheet(schema, effectiveDateRange)

  const { data: pnlStatementData, isLoading: pnlLoading } = useWarehousePnLStatement(
    schema,
    effectiveDateRange
  )

  const { data: arapSummary, isLoading: arapLoading } = useWarehouseARAP(schema)
  const { totalCash, isLoading: bankLoading } = useWarehouseBankAccounts(schema)
  const { summary: agedReceivablesSummary, isLoading: agedARLoading } =
    useWarehouseAgedReceivables(schema)
  const { summary: agedPayablesSummary, isLoading: agedAPLoading } =
    useWarehouseAgedPayables(schema)
  // Derive ratios from BS data (single source of truth, industry standard formulas)
  const financialRatios = useMemo(
    () => (balanceSheetData ? computeRatiosFromBalanceSheet(balanceSheetData) : null),
    [balanceSheetData]
  )
  const ratiosLoading = balanceSheetLoading
  const { data: cashRunwayData, isLoading: cashRunwayLoading } = useWarehouseCashRunway(
    schema,
    totalCash,
    effectiveDateRange
  )
  const { data: efficiencyMetrics, isLoading: efficiencyLoading } = useWarehouseEfficiencyMetrics(
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

  const isLoading = balanceSheetLoading

  useEffect(() => {
    const hasData = !!balanceSheetData
    welcomeContext?.setDataLoading(configLoading || (isLoading && !hasData))
  }, [welcomeContext, configLoading, isLoading, balanceSheetData])

  // Prepare composition data for charts
  const compositionData = useMemo(() => {
    if (!balanceSheetData?.totals) return null
    return {
      totalAssets: balanceSheetData.totals.totalAssets,
      totalLiabilities: balanceSheetData.totals.totalLiabilities,
      totalEquity: balanceSheetData.totals.totalEquity,
      isBalanced:
        Math.abs(
          balanceSheetData.totals.totalAssets - balanceSheetData.totals.totalLiabilitiesAndEquity
        ) < 0.01,
    }
  }, [balanceSheetData?.totals])

  // Group asset and liability categories for visualization
  const categoryBreakdown = useMemo(() => {
    if (!balanceSheetData) return null

    const assetCategories = Object.entries(balanceSheetData.assetGroups).map(
      ([name, accounts]) => ({
        name,
        value: accounts.reduce((sum, acc) => sum + acc.total_debits - acc.total_credits, 0),
        count: accounts.length,
      })
    )

    const liabilityCategories = Object.entries(balanceSheetData.liabilityGroups).map(
      ([name, accounts]) => ({
        name,
        value: accounts.reduce((sum, acc) => sum + acc.total_credits - acc.total_debits, 0),
        count: accounts.length,
      })
    )

    const equityCategories = Object.entries(balanceSheetData.equityGroups).map(
      ([name, accounts]) => ({
        name,
        value: accounts.reduce((sum, acc) => sum + acc.total_credits - acc.total_debits, 0),
        count: accounts.length,
      })
    )

    return { assetCategories, liabilityCategories, equityCategories }
  }, [balanceSheetData])

  const mutateAll = () => {
    mutateBalanceSheet()
  }

  if (configLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
          <p className="text-sm theme-text-secondary">Loading warehouse configuration...</p>
        </div>
      </div>
    )
  }

  if (configError || !config || !isEnabled || !schema) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
          <p className="text-sm theme-text-secondary">Redirecting to settings...</p>
        </div>
      </div>
    )
  }

  if (balanceSheetError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500" />
          <h3 className="text-lg font-semibold theme-text-primary">Data Load Error</h3>
          <p className="text-sm theme-text-secondary">
            {typeof balanceSheetError === 'object' &&
            balanceSheetError !== null &&
            'message' in balanceSheetError
              ? (balanceSheetError as Error).message
              : 'Failed to load data. Please try again.'}
          </p>
          <Button variant="outline" onClick={() => mutateBalanceSheet()} className="mt-2">
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-amber-400" />
          <div>
            <h1 className={cn('text-lg font-semibold', styles.text)}>Balance Sheet</h1>
            <p className={cn('text-xs font-mono', styles.textMuted)}>
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
            <BalanceSheetPeriodSelect
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
            onClick={mutateAll}
            disabled={isLoading}
            className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Key metrics strip */}
      {compositionData && (
        <BalanceSheetSummaryStrip
          data={compositionData}
          isLoading={balanceSheetLoading}
          currency={currency}
          exportButtons={
            <WarehouseExportButtons
              type="balance-sheet"
              balanceSheetData={balanceSheetData}
              companyName={companyName}
              currency={currency}
              asOfDate={effectiveDateRange?.endDate ?? undefined}
            />
          }
        />
      )}

      {/* Composition Charts Section */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6 border-t', styles.border)}>
        {/* Assets vs Liabilities/Equity Composition */}
        <section className={cn('pb-6 @3xl:pb-0 @3xl:pr-8 @3xl:border-r', styles.border)}>
          <h2 className={cn('text-xs font-medium uppercase tracking-wider mb-4', styles.textMuted)}>
            Balance Composition
          </h2>
          <BalanceSheetCompositionChart
            data={compositionData}
            categoryBreakdown={categoryBreakdown}
            isLoading={balanceSheetLoading}
            currency={currency}
          />
        </section>

        {/* Waterfall / Structure */}
        <section>
          <h2 className={cn('text-xs font-medium uppercase tracking-wider mb-4', styles.textMuted)}>
            Financial Structure
          </h2>
          <BalanceSheetWaterfallChart
            data={compositionData}
            categoryBreakdown={categoryBreakdown}
            isLoading={balanceSheetLoading}
            currency={currency}
          />
        </section>
      </div>

      {/* Financial Health Section */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-3 gap-8 pt-6 border-t', styles.border)}>
        <section className={cn('pb-6 @3xl:pb-0 @3xl:pr-8 @3xl:border-r', styles.border)}>
          <FinancialRatiosCard
            ratios={financialRatios}
            isLoading={ratiosLoading}
            currency={currency}
          />
        </section>
        <section className={cn('pb-6 @3xl:pb-0 @3xl:pr-8 @3xl:border-r', styles.border)}>
          <EfficiencyMetricsCard metrics={efficiencyMetrics} isLoading={efficiencyLoading} />
        </section>
        <section>
          <FinancialHealthScoreCard
            healthScore={financialHealthScore}
            isLoading={pnlLoading || ratiosLoading || efficiencyLoading || cashRunwayLoading}
          />
        </section>
      </div>

      {/* Receivables & Payables Section */}
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
          <CashRunwayCard data={cashRunwayData} isLoading={cashRunwayLoading} currency={currency} />
        </div>
      </div>

      {/* Balance Sheet Statement */}
      <div className={cn('pt-6 border-t', styles.border)}>
        <WarehouseBalanceSheet
          data={balanceSheetData}
          isLoading={balanceSheetLoading}
          asOfDate={effectiveDateRange?.endDate ?? undefined}
          currency={currency}
        />
      </div>
    </div>
  )
}
