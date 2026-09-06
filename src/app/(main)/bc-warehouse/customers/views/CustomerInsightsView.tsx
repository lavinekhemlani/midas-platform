'use client'

import { useState, useMemo, useEffect } from 'react'
import { Users, RefreshCw, AlertCircle, Calendar, X } from 'lucide-react'
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
  useCustomerCreditRisk,
  useCustomerConcentration,
  useOutstandingOrders,
  useTopCustomersByBalance,
  usePaymentTermsDistribution,
  useCustomerOverview,
  type DateRange,
} from '../hooks/useCustomerInsights'
import {
  CustomerRiskTable,
  ARFlowStrip,
  RiskDistributionChart,
  PaymentTermsChart,
  RevenueConcentrationDonut,
} from '../components'
import { DateRangeInputs } from '@/app/(main)/reports/components/DateRangeInputs'
import { getDateRangeForPeriod } from '@/lib/utils/dateRanges'
import { EntityExportDropdown } from '@/app/(main)/bc/components/EntityExportDropdown'

// Period options for customer reports
const customerPeriodOptions = [
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
function CustomerPeriodSelect({
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
        {customerPeriodOptions.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-sm cursor-pointer">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function CustomerInsightsView() {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const welcomeContext = useWelcomeContextOptional()

  // Date range filter state - default to last_year to match Summary page
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
    data: creditRiskData,
    summary: creditRiskSummary,
    isLoading: creditRiskLoading,
    mutate: mutateCreditRisk,
  } = useCustomerCreditRisk(schema, 20, effectiveDateRange)

  const {
    data: concentrationData,
    metrics: concentrationMetrics,
    isLoading: concentrationLoading,
    mutate: mutateConcentration,
  } = useCustomerConcentration(schema, 10, effectiveDateRange)

  const {
    data: outstandingOrders,
    isLoading: ordersLoading,
    mutate: mutateOrders,
  } = useOutstandingOrders(schema)

  const {
    data: topByBalance,
    isLoading: balanceLoading,
    mutate: mutateBalance,
  } = useTopCustomersByBalance(schema, 10)

  const {
    data: paymentTerms,
    isLoading: termsLoading,
    mutate: mutateTerms,
  } = usePaymentTermsDistribution(schema)

  const {
    data: overview,
    isLoading: overviewLoading,
    mutate: mutateOverview,
  } = useCustomerOverview(schema, effectiveDateRange)

  const isLoading =
    creditRiskLoading ||
    concentrationLoading ||
    ordersLoading ||
    balanceLoading ||
    termsLoading ||
    overviewLoading

  useEffect(() => {
    const hasData = !!overview || !!creditRiskData
    welcomeContext?.setDataLoading(configLoading || (isLoading && !hasData))
  }, [welcomeContext, configLoading, isLoading, overview, creditRiskData])

  const mutateAll = () => {
    mutateCreditRisk()
    mutateConcentration()
    mutateOrders()
    mutateBalance()
    mutateTerms()
    mutateOverview()
  }

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
          <Users className="w-5 h-5 text-amber-400" />
          <div>
            <h1 className={cn('text-lg font-semibold', styles.text)}>Customers</h1>
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
            <CustomerPeriodSelect
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

      {/* Key metrics strip - larger hierarchy */}
      {overview && (
        <div className={cn('flex gap-10 py-5 border-b', styles.border)}>
          <div>
            <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
              Customers
            </div>
            <div className={cn('text-2xl font-mono font-semibold tabular-nums', styles.text)}>
              {overview.total_customers.toLocaleString()}
            </div>
          </div>
          <div>
            <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
              Sales
            </div>
            <div className={cn('text-2xl font-mono font-semibold tabular-nums', styles.text)}>
              {formatCompactCurrency(overview.total_sales, currency)}
            </div>
          </div>
          <div>
            <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
              AR Balance
            </div>
            <div className={cn('text-2xl font-mono font-semibold tabular-nums', styles.text)}>
              {formatCompactCurrency(overview.total_ar, currency)}
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
                overview.blocked_customers > 0
                  ? isLight
                    ? 'text-red-600'
                    : 'text-red-400'
                  : styles.text
              )}
            >
              {overview.blocked_customers}
            </div>
          </div>
          <div className="ml-auto flex items-center">
            <EntityExportDropdown
              entityType="customer"
              schema={schema}
              currency={currency}
              totalCount={overview.total_customers}
              companyName={companyName}
            />
          </div>
        </div>
      )}

      {/* Risk Distribution & AR Pipeline */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6 border-t', styles.border)}>
        {/* Risk Distribution */}
        <section className={cn('pb-6 @3xl:pb-0 @3xl:pr-8 @3xl:border-r', styles.border)}>
          <h2 className={cn('text-xs font-medium uppercase tracking-wider mb-4', styles.textMuted)}>
            Risk Distribution
          </h2>
          <RiskDistributionChart
            data={creditRiskData}
            summary={creditRiskSummary}
            isLoading={creditRiskLoading}
            currency={currency}
          />
        </section>

        {/* AR Pipeline */}
        <section>
          <h2 className={cn('text-xs font-medium uppercase tracking-wider mb-4', styles.textMuted)}>
            AR Pipeline
          </h2>
          <ARFlowStrip data={outstandingOrders} isLoading={ordersLoading} currency={currency} />
        </section>
      </div>

      {/* Main grid */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6 border-t', styles.border)}>
        {/* Credit Risk */}
        <section className={cn('pb-6 @3xl:pb-0 @3xl:pr-8 @3xl:border-r', styles.border)}>
          <h2 className={cn('text-xs font-medium uppercase tracking-wider mb-4', styles.textMuted)}>
            Credit Risk Details
          </h2>
          <CustomerRiskTable
            data={creditRiskData}
            summary={creditRiskSummary}
            isLoading={creditRiskLoading}
            currency={currency}
          />
        </section>

        {/* Revenue Concentration */}
        <section>
          <h2 className={cn('text-xs font-medium uppercase tracking-wider mb-4', styles.textMuted)}>
            Revenue Concentration
          </h2>
          <RevenueConcentrationDonut
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
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-7 animate-pulse',
                    i % 2 === 0 ? (isLight ? 'bg-slate-100/70' : 'bg-white/[0.02]') : ''
                  )}
                />
              ))}
            </div>
          ) : topByBalance.length > 0 ? (
            <div>
              {topByBalance.slice(0, 8).map((customer, i) => (
                <div
                  key={customer.no}
                  className={cn(
                    'flex items-center gap-4 py-1.5 px-2 -mx-2 text-xs transition-colors',
                    i % 2 === 0 ? (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]') : '',
                    isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]'
                  )}
                >
                  <span className={cn('w-4 text-right font-mono', styles.textMuted)}>{i + 1}</span>
                  <span className={cn('flex-1 truncate', styles.text)} title={customer.name}>
                    {customer.name}
                  </span>
                  <span className={cn('font-mono tabular-nums', styles.text)}>
                    {formatCompactCurrency(customer.balance_lcy, currency)}
                  </span>
                  {customer.balance_due_lcy > 0 && (
                    <span
                      className={cn(
                        'font-mono tabular-nums text-[10px]',
                        isLight ? 'text-red-600' : 'text-red-400'
                      )}
                    >
                      {formatCompactCurrency(customer.balance_due_lcy, currency)} due
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
          <PaymentTermsChart data={paymentTerms} isLoading={termsLoading} currency={currency} />
        </section>
      </div>
    </div>
  )
}
