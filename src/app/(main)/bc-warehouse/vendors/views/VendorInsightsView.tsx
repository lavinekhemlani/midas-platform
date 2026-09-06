'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Truck, RefreshCw, AlertCircle, Calendar, X, Download, Loader2 } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { formatCompactCurrency } from '@/lib/utils/currency'
import {
  useWarehouseConfig,
  useWarehouseCompanyInfo,
} from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'
import {
  useVendorPaymentRisk,
  useVendorConcentration,
  useOutstandingPayables,
  useTopVendorsByBalance,
  useVendorPaymentTermsDistribution,
  useVendorOverview,
  type DateRange,
} from '../hooks/useVendorInsights'
import {
  VendorRiskTable,
  SpendStrip,
  APFlowStrip,
  VendorRiskDistributionChart,
  VendorPaymentTermsChart,
  SpendConcentrationDonut,
  VendorsPDF,
} from '../components'
import { DateRangeInputs } from '@/app/(main)/reports/components/DateRangeInputs'
import { getDateRangeForPeriod } from '@/lib/utils/dateRanges'
import { EntityExportDropdown } from '@/app/(main)/bc/components/EntityExportDropdown'

// Period options for vendor reports
const vendorPeriodOptions = [
  { value: 'all_time', label: 'All Time' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' },
]

// Local PeriodSelect component
function VendorPeriodSelect({
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
      <SelectContent className="glass-luxury-card">
        {vendorPeriodOptions.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-sm cursor-pointer">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function VendorInsightsView() {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const welcomeContext = useWelcomeContextOptional()

  // Date range filter state - default to last_year to match Summary page
  const [selectedPeriod, setSelectedPeriod] = useState<string>('last_year')
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  })
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false)

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

  // Format date for display
  const formatDisplayDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Format date range for display
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

  // Handle period change
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

  const {
    config,
    schema,
    isLoading: configLoading,
    error: configError,
    isEnabled,
  } = useWarehouseConfig()

  const { data: companyInfo } = useWarehouseCompanyInfo(schema)
  const currency = companyInfo?.currencyCode || 'USD'
  const companyName = companyInfo?.companyName || ''

  const {
    data: paymentRiskData,
    summary: paymentRiskSummary,
    isLoading: paymentRiskLoading,
    mutate: mutatePaymentRisk,
  } = useVendorPaymentRisk(schema, 20, effectiveDateRange)

  const {
    data: concentrationData,
    metrics: concentrationMetrics,
    isLoading: concentrationLoading,
    mutate: mutateConcentration,
  } = useVendorConcentration(schema, 10, effectiveDateRange)

  const {
    data: outstandingPayables,
    isLoading: payablesLoading,
    mutate: mutatePayables,
  } = useOutstandingPayables(schema)

  const {
    data: topByBalance,
    isLoading: balanceLoading,
    mutate: mutateBalance,
  } = useTopVendorsByBalance(schema, 10)

  const {
    data: paymentTerms,
    isLoading: termsLoading,
    mutate: mutateTerms,
  } = useVendorPaymentTermsDistribution(schema)

  const {
    data: overview,
    isLoading: overviewLoading,
    mutate: mutateOverview,
  } = useVendorOverview(schema, effectiveDateRange)

  const isLoading =
    paymentRiskLoading ||
    concentrationLoading ||
    payablesLoading ||
    balanceLoading ||
    termsLoading ||
    overviewLoading

  useEffect(() => {
    const hasData = !!overview || !!paymentRiskData
    welcomeContext?.setDataLoading(configLoading || (isLoading && !hasData))
  }, [welcomeContext, configLoading, isLoading, overview, paymentRiskData])

  const mutateAll = () => {
    mutatePaymentRisk()
    mutateConcentration()
    mutatePayables()
    mutateBalance()
    mutateTerms()
    mutateOverview()
  }

  // PDF download handler
  const handleDownloadPDF = useCallback(async () => {
    if (!overview) return
    setIsDownloadingPDF(true)
    try {
      const blob = await pdf(
        <VendorsPDF
          overview={overview}
          paymentRiskData={paymentRiskData}
          paymentRiskSummary={paymentRiskSummary}
          concentrationData={concentrationData}
          concentrationMetrics={concentrationMetrics}
          outstandingPayables={outstandingPayables}
          topByBalance={topByBalance}
          paymentTerms={paymentTerms}
          currency={currency}
          companyName={companyName}
          schema={schema || undefined}
          dateRange={
            effectiveDateRange
              ? {
                  startDate: effectiveDateRange.startDate || '',
                  endDate: effectiveDateRange.endDate || '',
                }
              : undefined
          }
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vendor-insights-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to generate PDF:', err)
    } finally {
      setIsDownloadingPDF(false)
    }
  }, [
    overview,
    paymentRiskData,
    paymentRiskSummary,
    concentrationData,
    concentrationMetrics,
    outstandingPayables,
    topByBalance,
    paymentTerms,
    currency,
    companyName,
    schema,
    effectiveDateRange,
  ])

  if (configLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          <p className="text-sm theme-text-secondary">Loading...</p>
        </div>
      </div>
    )
  }

  if (configError || !config || !isEnabled) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-sm theme-text-secondary">
            {configError?.message || 'Warehouse not enabled'}
          </p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!schema) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm theme-text-secondary">No schema configured</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="w-5 h-5 text-amber-400" />
          <div>
            <h1 className={cn('text-lg font-semibold', styles.text)}>Vendors</h1>
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
            <VendorPeriodSelect
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
            onClick={handleDownloadPDF}
            disabled={isLoading || isDownloadingPDF || !overview}
            className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Download PDF report"
          >
            {isDownloadingPDF ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
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

      {/* Key metrics strip - larger hierarchy */}
      {overview && (
        <div className={cn('flex gap-10 py-5 border-b', styles.border)}>
          <div>
            <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
              Vendors
            </div>
            <div className={cn('text-2xl font-mono font-semibold tabular-nums', styles.text)}>
              {overview.total_vendors.toLocaleString()}
            </div>
          </div>
          <div>
            <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
              Purchases
            </div>
            <div className={cn('text-2xl font-mono font-semibold tabular-nums', styles.text)}>
              {formatCompactCurrency(overview.total_purchases, currency)}
            </div>
          </div>
          <div>
            <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
              AP Balance
            </div>
            <div className={cn('text-2xl font-mono font-semibold tabular-nums', styles.text)}>
              {formatCompactCurrency(overview.total_ap, currency)}
            </div>
          </div>
          <div>
            <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
              Overdue
            </div>
            <div
              className={cn(
                'text-2xl font-mono font-semibold tabular-nums',
                isLight ? 'text-red-600' : 'text-red-400'
              )}
            >
              {formatCompactCurrency(overview.total_overdue, currency)}
            </div>
          </div>
          <div>
            <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
              Blocked
            </div>
            <div
              className={cn(
                'text-2xl font-mono font-semibold tabular-nums',
                overview.blocked_vendors > 0
                  ? isLight
                    ? 'text-red-600'
                    : 'text-red-400'
                  : styles.text
              )}
            >
              {overview.blocked_vendors}
            </div>
          </div>
          <div className="ml-auto flex items-center">
            <EntityExportDropdown
              entityType="vendor"
              schema={schema}
              currency={currency}
              totalCount={overview.total_vendors}
              companyName={companyName}
            />
          </div>
        </div>
      )}

      {/* Risk Distribution & AP Status */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6 border-t', styles.border)}>
        {/* Risk Distribution */}
        <section className={cn('pb-6 @3xl:pb-0 @3xl:pr-8 @3xl:border-r', styles.border)}>
          <h2 className={cn('text-xs font-medium uppercase tracking-wider mb-4', styles.textMuted)}>
            Risk Distribution
          </h2>
          <VendorRiskDistributionChart
            data={paymentRiskData}
            summary={paymentRiskSummary}
            isLoading={paymentRiskLoading}
            currency={currency}
          />
        </section>

        {/* AP Status */}
        <section>
          <h2 className={cn('text-xs font-medium uppercase tracking-wider mb-4', styles.textMuted)}>
            AP Status
          </h2>
          <APFlowStrip data={outstandingPayables} isLoading={payablesLoading} currency={currency} />
        </section>
      </div>

      {/* Main grid */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6 border-t', styles.border)}>
        {/* Payment Risk */}
        <section className={cn('pb-6 @3xl:pb-0 @3xl:pr-8 @3xl:border-r', styles.border)}>
          <h2 className={cn('text-xs font-medium uppercase tracking-wider mb-4', styles.textMuted)}>
            Payment Risk Details
          </h2>
          <VendorRiskTable
            data={paymentRiskData}
            summary={paymentRiskSummary}
            isLoading={paymentRiskLoading}
            currency={currency}
          />
        </section>

        {/* Spend Concentration */}
        <section>
          <h2 className={cn('text-xs font-medium uppercase tracking-wider mb-4', styles.textMuted)}>
            Spend Concentration
          </h2>
          <SpendConcentrationDonut
            data={concentrationData}
            metrics={concentrationMetrics}
            isLoading={concentrationLoading}
            currency={currency}
          />
        </section>
      </div>

      {/* Bottom sections */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6 border-t', styles.border)}>
        {/* Top Balances */}
        <section className={cn('pb-6 @3xl:pb-0 @3xl:pr-8 @3xl:border-r', styles.border)}>
          <h2 className={cn('text-xs font-medium uppercase tracking-wider mb-4', styles.textMuted)}>
            Top Balances
          </h2>
          {balanceLoading ? (
            <div>
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-7 animate-pulse',
                    i % 2 === 0 ? (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]') : ''
                  )}
                />
              ))}
            </div>
          ) : topByBalance.length > 0 ? (
            <div
              className="max-h-[280px] overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 dark:[&::-webkit-scrollbar-thumb]:bg-stone-600"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: isLight ? '#a8a29e transparent' : '#57534e transparent',
              }}
            >
              {topByBalance.slice(0, 10).map((vendor, i) => (
                <div
                  key={vendor.no}
                  className={cn(
                    'flex items-center gap-2 py-1.5 px-2 text-xs transition-colors',
                    i % 2 === 0 ? (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]') : '',
                    isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]'
                  )}
                >
                  <span className={cn('w-4 text-right font-mono text-[10px]', styles.textMuted)}>
                    {i + 1}
                  </span>
                  <span
                    className={cn('flex-1 truncate font-medium', styles.text)}
                    title={vendor.name}
                  >
                    {vendor.name}
                  </span>
                  <span
                    className={cn('font-mono tabular-nums font-semibold text-[11px]', styles.text)}
                  >
                    {formatCompactCurrency(vendor.balance_lcy, currency)}
                  </span>
                  {vendor.balance_due_lcy > 0 && (
                    <span
                      className={cn(
                        'font-mono tabular-nums text-[10px] font-medium',
                        isLight ? 'text-red-600' : 'text-red-400'
                      )}
                    >
                      {formatCompactCurrency(vendor.balance_due_lcy, currency)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className={cn('text-sm py-4', styles.textMuted)}>No balance data</p>
          )}
        </section>

        {/* Payment Terms */}
        <section>
          <h2 className={cn('text-xs font-medium uppercase tracking-wider mb-4', styles.textMuted)}>
            Payment Terms
          </h2>
          <VendorPaymentTermsChart
            data={paymentTerms}
            isLoading={termsLoading}
            currency={currency}
          />
        </section>
      </div>
    </div>
  )
}
