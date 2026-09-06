'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import {
  useWarehouseConfig,
  useWarehousePnLData,
  useWarehouseMonthlyPnLTrend,
  useWarehouseCompanyInfo,
  useWarehouseARAP,
  useWarehouseBankAccounts,
  useWarehouseTopCustomers,
  useWarehouseAgedReceivables,
  useWarehouseAgedPayables,
  useWarehouseTopVendors,
  computeRatiosFromBalanceSheet,
  useMonthlyRevenue,
  useWarehouseInventory,
  useWarehouseCashRunway,
  useWarehouseEfficiencyMetrics,
  useWarehouseSalesBySalesperson,
  calculateFinancialHealthScore,
  type DateRange,
} from '../hooks/useWarehouseData'
import {
  useWarehousePnLStatement,
  useWarehouseBalanceSheet,
} from '../hooks/useWarehousePnLStatement'
import { useCashFlowByActivity } from '@/app/(main)/bc/cash-flow/hooks/useCashFlowData'
import { WarehouseExecutiveDashboard } from '../components/WarehouseExecutiveDashboard'
import { DateRangeInputs } from '@/app/(main)/reports/components/DateRangeInputs'
import { getDateRangeForPeriod } from '@/lib/utils/dateRanges'
import { AlertCircle, RefreshCw, LayoutDashboard, X, Calendar, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Period options including "All Time" for warehouse reports
const warehousePeriodOptions = [
  { value: 'all_time', label: 'All Time' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' },
]

// Local PeriodSelect component with "All Time" option
function WarehousePeriodSelect({
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
      <SelectTrigger className="w-full h-9 glass-luxury-card border-amber-500/20 hover:border-amber-500/40 transition-all duration-200 text-[14px]">
        <Calendar className="w-3.5 h-3.5 mr-2 text-amber-500" />
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent className="glass-luxury-card">
        {warehousePeriodOptions.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="text-[14px] cursor-pointer"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function WarehouseSummaryView() {
  const router = useRouter()
  // Report loading state to WelcomeContext for coordinated loading UI
  const welcomeContext = useWelcomeContextOptional()

  // Date range filter state - using period-based selection like /reports
  // Default to 'this_year' to match BC's fiscal year Balance Sheet calculation
  const [selectedPeriod, setSelectedPeriod] = useState<string>('last_year')
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  })

  // Format date range for display (matching QB's serif italic style)
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

  // Redirect to settings if warehouse is not enabled or no schema available (after loading completes)
  useEffect(() => {
    if (!configLoading && (configError || !config || !isEnabled || !schema)) {
      router.replace('/settings?connect=dynamics')
    }
  }, [configLoading, configError, config, isEnabled, schema, router])

  // Company info (name + currency derived from country code)
  const { data: companyInfo } = useWarehouseCompanyInfo(schema)
  const currency = companyInfo?.currencyCode || 'USD'
  const companyName = companyInfo?.companyName || ''

  // Dashboard data - dataRange used for custom date panel info
  const { dataRange, mutate: mutateDashboard } = useWarehousePnLData(schema, effectiveDateRange)

  // Statement data — needed for pnlTotals and bsTotals passed to WarehouseExecutiveDashboard
  const {
    data: pnlStatementData,
    isLoading: pnlStatementLoading,
    mutate: mutatePnLStatement,
  } = useWarehousePnLStatement(schema, effectiveDateRange)

  const {
    data: balanceSheetData,
    isLoading: balanceSheetLoading,
    mutate: mutateBalanceSheet,
  } = useWarehouseBalanceSheet(schema, effectiveDateRange)

  // Monthly P&L trend data (for dashboard chart)
  const {
    data: monthlyPnLTrend,
    isLoading: trendLoading,
    error: trendError,
    mutate: mutateTrend,
  } = useWarehouseMonthlyPnLTrend(schema, effectiveDateRange)

  // Dashboard card data
  const { data: arapSummary, isLoading: arapLoading, mutate: mutateARAP } = useWarehouseARAP(schema)

  const {
    data: bankAccounts,
    totalCash,
    isLoading: bankLoading,
    mutate: mutateBank,
  } = useWarehouseBankAccounts(schema)

  const {
    data: topCustomers,
    isLoading: customersLoading,
    mutate: mutateTopCustomers,
  } = useWarehouseTopCustomers(schema, effectiveDateRange)

  const {
    summary: agedReceivablesSummary,
    isLoading: agedARLoading,
    mutate: mutateAgedAR,
  } = useWarehouseAgedReceivables(schema)

  const {
    summary: agedPayablesSummary,
    isLoading: agedAPLoading,
    mutate: mutateAgedAP,
  } = useWarehouseAgedPayables(schema)

  const {
    data: topVendors,
    isLoading: vendorsLoading,
    mutate: mutateTopVendors,
  } = useWarehouseTopVendors(schema, effectiveDateRange, 5)

  // Derive ratios from BS data (single source of truth, industry standard formulas)
  const financialRatios = useMemo(
    () => (balanceSheetData ? computeRatiosFromBalanceSheet(balanceSheetData) : null),
    [balanceSheetData]
  )
  const ratiosLoading = balanceSheetLoading

  const {
    data: monthlyRevenue,
    isLoading: revenueLoading,
    mutate: mutateRevenue,
  } = useMonthlyRevenue(schema, effectiveDateRange)

  const {
    summary: inventorySummary,
    data: inventoryItems,
    isLoading: inventoryLoading,
    mutate: mutateInventory,
  } = useWarehouseInventory(schema)

  const {
    data: cashRunwayData,
    isLoading: cashRunwayLoading,
    mutate: mutateCashRunway,
  } = useWarehouseCashRunway(schema, totalCash, effectiveDateRange)

  const {
    data: efficiencyMetrics,
    isLoading: efficiencyLoading,
    mutate: mutateEfficiency,
  } = useWarehouseEfficiencyMetrics(schema, effectiveDateRange)

  const {
    data: salesBySalesperson,
    isLoading: salespersonLoading,
    mutate: mutateSalesperson,
  } = useWarehouseSalesBySalesperson(schema, effectiveDateRange, 10)

  // Cash flow by activity data
  const {
    data: cashFlowByActivityRaw,
    summary: cashFlowActivitySummary,
    isLoading: cashFlowActivityLoading,
    mutate: mutateCashFlowActivity,
  } = useCashFlowByActivity(schema, effectiveDateRange)

  // Process cash flow activity data for the dashboard chart
  const cashFlowByActivity = useMemo(() => {
    return cashFlowByActivityRaw
      .reduce(
        (acc, row) => {
          let entry = acc.find((m) => m.month === row.month)
          if (!entry) {
            entry = { month: row.month, operating: 0, investing: 0, financing: 0 }
            acc.push(entry)
          }
          if (row.activity_type === 'operating') entry.operating = Number(row.net_amount)
          if (row.activity_type === 'investing') entry.investing = Number(row.net_amount)
          if (row.activity_type === 'financing') entry.financing = Number(row.net_amount)
          return acc
        },
        [] as Array<{ month: string; operating: number; investing: number; financing: number }>
      )
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
  }, [cashFlowByActivityRaw])

  // Calculate financial health score from all available data
  const financialHealthScore = useMemo(() => {
    return calculateFinancialHealthScore(
      financialRatios,
      efficiencyMetrics,
      cashRunwayData,
      pnlStatementData?.totals ?? null
    )
  }, [financialRatios, efficiencyMetrics, cashRunwayData, pnlStatementData])

  const isLoading = pnlStatementLoading || balanceSheetLoading || trendLoading
  const error = trendError

  // Report loading state to WelcomeContext
  useEffect(() => {
    const hasData = !!pnlStatementData || !!balanceSheetData
    welcomeContext?.setDataLoading(configLoading || (isLoading && !hasData))
  }, [welcomeContext, configLoading, isLoading, pnlStatementData, balanceSheetData])

  const mutate = () => {
    mutateDashboard()
    mutatePnLStatement()
    mutateBalanceSheet()
    mutateTrend()
    mutateARAP()
    mutateBank()
    mutateTopCustomers()
    mutateAgedAR()
    mutateAgedAP()
    mutateTopVendors()
    mutateRevenue()
    mutateInventory()
    mutateCashRunway()
    mutateEfficiency()
    mutateSalesperson()
    mutateCashFlowActivity()
  }

  // Handle config loading
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

  // Handle config error or not enabled - redirect to settings
  if (configError || !config || !isEnabled) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
          <p className="text-sm theme-text-secondary">Redirecting to settings...</p>
        </div>
      </div>
    )
  }

  // Handle no schema available - redirect to settings
  if (!schema) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
          <p className="text-sm theme-text-secondary">Redirecting to settings...</p>
        </div>
      </div>
    )
  }

  // Handle data error
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500" />
          <h3 className="text-lg font-semibold theme-text-primary">Data Load Error</h3>
          <p className="text-sm theme-text-secondary">
            {typeof error === 'object' && error !== null && 'message' in error
              ? (error as Error).message
              : 'Failed to load warehouse data. Please try again.'}
          </p>
          <Button variant="outline" onClick={() => mutate()} className="mt-2">
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
      <div className="border-b border-gray-200/10 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2">
              <LayoutDashboard className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-semibold theme-text-primary">Financial Reports</h1>
              <p className="text-sm theme-text-secondary">Business Central</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
            <div className="w-[160px] flex-shrink-0">
              <WarehousePeriodSelect
                value={selectedPeriod}
                onChange={handlePeriodChange}
                disabled={isLoading}
              />
            </div>
            {selectedPeriod === 'custom' && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex-shrink-0 p-1.5 rounded-md text-amber-500/60 hover:text-amber-500 hover:bg-amber-500/10 transition-colors">
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="end"
                    className="w-56 p-3 glass-luxury-card border-amber-500/20 text-xs"
                  >
                    <p className="font-semibold theme-text-primary mb-2">Available Data</p>
                    {dataRange ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between">
                          <span className="theme-text-secondary">Earliest</span>
                          <span className="theme-text-primary font-medium">
                            {new Date(dataRange.earliest_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="theme-text-secondary">Latest</span>
                          <span className="theme-text-primary font-medium">
                            {new Date(dataRange.latest_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="theme-text-secondary">Loading data range...</p>
                    )}
                    {(!customDateRange.start || !customDateRange.end) && (
                      <p className="mt-2.5 pt-2 border-t border-gray-200/10 text-amber-500/80">
                        Select both dates to apply the filter.
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {selectedPeriod !== 'all_time' && (
              <button
                onClick={() => setSelectedPeriod('all_time')}
                className="flex-shrink-0 p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors"
                title="Clear date filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => mutate()}
              disabled={isLoading}
              className="flex-shrink-0 p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Executive Dashboard */}
      <WarehouseExecutiveDashboard
        pnlTotals={pnlStatementData?.totals ?? null}
        bsTotals={
          balanceSheetData?.totals
            ? {
                totalAssets: balanceSheetData.totals.totalAssets,
                totalLiabilities: balanceSheetData.totals.totalLiabilities,
                totalEquity: balanceSheetData.totals.totalEquity,
              }
            : null
        }
        monthlyTrend={monthlyPnLTrend}
        arapSummary={arapSummary}
        bankAccounts={bankAccounts}
        totalCash={totalCash}
        topCustomers={topCustomers}
        agedReceivablesSummary={agedReceivablesSummary}
        agedPayablesSummary={agedPayablesSummary}
        topVendors={topVendors}
        financialRatios={financialRatios}
        monthlyRevenue={monthlyRevenue}
        cashFlowByActivity={cashFlowByActivity}
        cashFlowActivitySummary={cashFlowActivitySummary}
        inventorySummary={inventorySummary}
        inventoryItems={inventoryItems}
        cashRunwayData={cashRunwayData}
        efficiencyMetrics={efficiencyMetrics}
        financialHealthScore={financialHealthScore}
        salesBySalesperson={salesBySalesperson}
        pnlLoading={pnlStatementLoading}
        bsLoading={balanceSheetLoading}
        trendLoading={trendLoading}
        cashFlowActivityLoading={cashFlowActivityLoading}
        arapLoading={arapLoading}
        bankLoading={bankLoading}
        customersLoading={customersLoading}
        agedARLoading={agedARLoading}
        agedAPLoading={agedAPLoading}
        vendorsLoading={vendorsLoading}
        ratiosLoading={ratiosLoading}
        revenueLoading={revenueLoading}
        inventoryLoading={inventoryLoading}
        cashRunwayLoading={cashRunwayLoading}
        efficiencyLoading={efficiencyLoading}
        healthScoreLoading={ratiosLoading || efficiencyLoading || cashRunwayLoading}
        salespersonLoading={salespersonLoading}
        currency={currency}
        schema={schema}
        routePrefix="/bc-warehouse"
      />
    </div>
  )
}
