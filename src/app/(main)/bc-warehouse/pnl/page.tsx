'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  useWarehouseConfig,
  useWarehousePnLData,
  useWarehouseMonthlyPnLTrend,
  useWarehouseCompanyInfo,
  useWarehouseTopCustomers,
  useWarehouseTopVendors,
  useMonthlyRevenue,
  useWarehouseInventory,
  useWarehouseSalesBySalesperson,
  type DateRange,
} from '../reports/hooks/useWarehouseData'
import { useWarehousePnLStatement } from '../reports/hooks/useWarehousePnLStatement'
import { WarehousePnLStatement } from '../reports/components/WarehousePnLStatement'
import { WarehouseExportButtons } from '../reports/components/WarehouseExportButtons'
import { PnLMarginsCard } from '@/app/(main)/bc/reports/components/PnLMarginsCard'
import { MonthlyRevenueChart } from '@/app/(main)/bc/reports/components/MonthlyRevenueChart'
import { TopVendorsCard } from '@/app/(main)/bc/reports/components/TopVendorsCard'
import { InventoryDashboardCard } from '@/app/(main)/bc/reports/components/InventoryDashboardCard'
import { SalesBySalespersonCard } from '@/app/(main)/bc/reports/components/SalesBySalespersonCard'
import { formatCompactCurrency, formatPnLCurrency, formatAxisCurrency } from '@/lib/utils/currency'
import { EChartsLine } from '@/components/charts/echarts'
import { useTheme } from '@/hooks/useTheme'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DateRangeInputs } from '@/app/(main)/reports/components/DateRangeInputs'
import { getDateRangeForPeriod } from '@/lib/utils/dateRanges'
import { AlertCircle, RefreshCw, FileBarChart, X, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
      <SelectTrigger className="w-full h-9 glass-luxury-card border-amber-500/20 hover:border-amber-500/40 transition-all duration-200 text-sm">
        <Calendar className="w-3.5 h-3.5 mr-2 text-amber-500" />
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent className="glass-luxury-card">
        {warehousePeriodOptions.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-sm cursor-pointer">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default function BCWarehousePnLPage() {
  const router = useRouter()

  const [selectedPeriod, setSelectedPeriod] = useState<string>('last_year')
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  })

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
    }
  }

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

  const { theme } = useTheme()
  const themeGreen = theme === 'light' ? '#178E66' : '#2FBC8B'
  const themeRed = theme === 'light' ? '#D51323' : '#EE3D4C'

  const { dataRange } = useWarehousePnLData(schema, effectiveDateRange)

  const {
    data: pnlStatementData,
    isLoading: pnlStatementLoading,
    error: pnlStatementError,
    mutate: mutatePnLStatement,
  } = useWarehousePnLStatement(schema, effectiveDateRange)

  const { data: monthlyPnLTrend, isLoading: trendLoading } = useWarehouseMonthlyPnLTrend(
    schema,
    effectiveDateRange
  )
  const { data: topCustomers, isLoading: customersLoading } = useWarehouseTopCustomers(
    schema,
    effectiveDateRange
  )
  const { data: topVendors, isLoading: vendorsLoading } = useWarehouseTopVendors(
    schema,
    effectiveDateRange,
    5
  )
  const { data: monthlyRevenue, isLoading: revenueLoading } = useMonthlyRevenue(
    schema,
    effectiveDateRange
  )
  const {
    summary: inventorySummary,
    data: inventoryItems,
    isLoading: inventoryLoading,
  } = useWarehouseInventory(schema)
  const { data: salesBySalesperson, isLoading: salespersonLoading } =
    useWarehouseSalesBySalesperson(schema, effectiveDateRange, 10)

  const formattedTrendData = useMemo(() => {
    return (monthlyPnLTrend || []).map((row) => {
      const date = new Date(row.month)
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      return {
        month: monthLabel,
        revenue: row.revenue,
        expenses: row.cogs + row.expenses,
        netIncome: row.net_income,
      }
    })
  }, [monthlyPnLTrend])

  const maxCustomerRevenue =
    topCustomers.length > 0 ? Math.max(...topCustomers.map((c) => Number(c.total_revenue))) : 0

  const isLoading = pnlStatementLoading
  const error = pnlStatementError

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

  if (configError || !config || !isEnabled || !schema) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
          <p className="text-sm theme-text-secondary">Redirecting to settings...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500" />
          <h3 className="text-lg font-semibold theme-text-primary">Data Load Error</h3>
          <p className="text-sm theme-text-secondary">
            {typeof error === 'object' && error !== null && 'message' in error
              ? (error as Error).message
              : 'Failed to load data. Please try again.'}
          </p>
          <Button variant="outline" onClick={() => mutatePnLStatement()} className="mt-2">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="@container space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="border-b border-gray-200/10 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2">
              <FileBarChart className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-semibold theme-text-primary">
                {companyName || 'Profit & Loss'}
              </h1>
              <p className="text-sm theme-text-secondary">Business Central Warehouse</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">{formatDateRange()}</span>
            <div className="w-[160px]">
              <WarehousePeriodSelect
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
              onClick={() => mutatePnLStatement()}
              disabled={isLoading}
              className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Custom Date Range Panel */}
      {selectedPeriod === 'custom' && (
        <div className="p-4 rounded-lg border border-gray-200/10 bg-white/[0.02]">
          <div className="flex items-start gap-6">
            <div className="flex-1 max-w-xs">
              <DateRangeInputs
                startDate={customDateRange.start}
                endDate={customDateRange.end}
                onStartChange={(date) => setCustomDateRange((prev) => ({ ...prev, start: date }))}
                onEndChange={(date) => setCustomDateRange((prev) => ({ ...prev, end: date }))}
              />
            </div>
            <div className="text-sm theme-text-secondary">
              <p className="font-medium theme-text-primary mb-1">Custom Date Range</p>
              <p>Select start and end dates to filter by posting date.</p>
              {dataRange && (
                <p className="mt-2 text-xs">
                  Available data:{' '}
                  {new Date(dataRange.earliest_date).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  -{' '}
                  {new Date(dataRange.latest_date).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              )}
              {(!customDateRange.start || !customDateRange.end) && (
                <p className="mt-2 text-xs text-theme-orange">
                  Select both dates to apply the custom filter.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* P&L Trend Chart */}
      <Card className="glass-luxury-card flex flex-col gap-0 border border-gray-200/10 !pt-0">
        <CardHeader className="px-4 pt-6 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg text-amber-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg font-bold theme-text-primary">
              Monthly P&L Trend
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-200/10">
            <div className="flex flex-col items-center text-center flex-1">
              <span className="text-[10px] theme-text-secondary uppercase tracking-wider font-medium mb-1">
                Revenue
              </span>
              {pnlStatementLoading ? (
                <span className="inline-block w-20 h-6 bg-gray-700/30 animate-pulse" />
              ) : (
                <span className="text-sm font-semibold text-theme-green">
                  {formatCompactCurrency(pnlStatementData?.totals?.totalRevenue || 0, currency)}
                </span>
              )}
            </div>
            <div className="flex flex-col items-center text-center flex-1">
              <span className="text-[10px] theme-text-secondary uppercase tracking-wider font-medium mb-1">
                Expenses
              </span>
              {pnlStatementLoading ? (
                <span className="inline-block w-20 h-6 bg-gray-700/30 animate-pulse" />
              ) : (
                <span className="text-sm font-semibold text-theme-red">
                  {formatCompactCurrency(
                    (pnlStatementData?.totals?.totalCOGS || 0) +
                      (pnlStatementData?.totals?.totalExpenses || 0),
                    currency
                  )}
                </span>
              )}
            </div>
            <div className="flex flex-col items-center text-center flex-1">
              <span className="text-[10px] theme-text-secondary uppercase tracking-wider font-medium mb-1">
                Net Income
              </span>
              {pnlStatementLoading ? (
                <span className="inline-block w-20 h-6 bg-gray-700/30 animate-pulse" />
              ) : (
                <span
                  className={cn(
                    'text-sm font-semibold',
                    (pnlStatementData?.totals?.netIncome || 0) >= 0
                      ? 'text-theme-green'
                      : 'text-theme-red'
                  )}
                >
                  {formatCompactCurrency(pnlStatementData?.totals?.netIncome || 0, currency)}
                </span>
              )}
            </div>
          </div>
          <div className="min-h-[260px]">
            {trendLoading ? (
              <div className="flex items-center justify-center h-[260px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
              </div>
            ) : formattedTrendData.length > 0 ? (
              <EChartsLine
                data={formattedTrendData}
                xKey="month"
                series={[
                  { key: 'revenue', name: 'Revenue', color: themeGreen, showArea: true },
                  { key: 'expenses', name: 'Expenses', color: themeRed, showArea: true },
                  { key: 'netIncome', name: 'Net Income', color: '#f59e0b', showArea: true },
                ]}
                formatY={(value) => formatPnLCurrency(value, currency)}
                formatAxisY={formatAxisCurrency(currency)}
                showLegend={true}
                height={260}
              />
            ) : (
              <div className="flex items-center justify-center h-[260px]">
                <p className="text-sm theme-text-secondary">No trend data available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* P&L Margins + Monthly Revenue */}
      <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3 gap-6">
        <PnLMarginsCard
          pnlTotals={pnlStatementData?.totals ?? null}
          isLoading={pnlStatementLoading}
          currency={currency}
        />
        <MonthlyRevenueChart data={monthlyRevenue} isLoading={revenueLoading} currency={currency} />

        {/* Top Customers */}
        <Card className="glass-luxury-card flex flex-col gap-0 border border-gray-200/10 !pt-0">
          <CardHeader className="px-4 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg text-purple-400">
                <Users className="w-5 h-5" />
              </div>
              <CardTitle className="text-base font-bold theme-text-primary">
                Top Customers
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex-1">
            {customersLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
              </div>
            ) : topCustomers.length > 0 ? (
              <div className="space-y-3">
                {topCustomers.map((customer, i) => {
                  const revenue = Number(customer.total_revenue)
                  const barWidth =
                    maxCustomerRevenue > 0 ? Math.max(8, (revenue / maxCustomerRevenue) * 100) : 0
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-xs theme-text-secondary truncate flex-1"
                          title={customer.name}
                        >
                          {customer.name.length > 28
                            ? customer.name.substring(0, 28) + '...'
                            : customer.name}
                        </span>
                        <span className="text-xs font-mono font-medium theme-text-primary whitespace-nowrap">
                          {formatCompactCurrency(revenue, currency)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-gray-200/10">
                        <div
                          className="h-full rounded-full bg-purple-500/60"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm theme-text-secondary text-center">No customer data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Vendors + Inventory + Sales by Salesperson */}
      <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3 gap-6">
        <TopVendorsCard vendors={topVendors} isLoading={vendorsLoading} currency={currency} />
        <InventoryDashboardCard
          summary={inventorySummary}
          items={inventoryItems}
          isLoading={inventoryLoading}
          currency={currency}
        />
        <SalesBySalespersonCard
          data={salesBySalesperson}
          isLoading={salespersonLoading}
          currency={currency}
        />
      </div>

      {/* Subheading + Export */}
      <div className="flex items-center justify-between">
        <span className="text-xl theme-text-secondary">Revenue, expenses, and profitability</span>
        <WarehouseExportButtons
          type="pnl"
          pnlData={pnlStatementData}
          companyName={companyName}
          currency={currency}
          dateRange={
            effectiveDateRange?.startDate && effectiveDateRange?.endDate
              ? { start: effectiveDateRange.startDate, end: effectiveDateRange.endDate }
              : undefined
          }
        />
      </div>

      {/* P&L Statement */}
      <WarehousePnLStatement
        data={pnlStatementData}
        isLoading={pnlStatementLoading}
        dateRange={
          effectiveDateRange?.startDate && effectiveDateRange?.endDate
            ? { start: effectiveDateRange.startDate, end: effectiveDateRange.endDate }
            : undefined
        }
        currency={currency}
      />
    </div>
  )
}
