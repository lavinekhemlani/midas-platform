'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useBCIncomeStatement } from '../../hooks/useBCIncomeStatement'
import { useBCEnhancedData } from '../../hooks/useBCEnhancedData'
import { useBCMonthlyTrend } from '../../hooks/useBCMonthlyTrend'
import { useBCSalesGeography } from '../../hooks/useBCSalesGeography'
import { PnLMarginsCard } from '../../reports/components/PnLMarginsCard'
import { TopVendorsCard } from '../../reports/components/TopVendorsCard'
import { MonthlyRevenueChart } from '../../reports/components/MonthlyRevenueChart'
import {
  CollapsibleStatementTable,
  type StatementLine,
} from '../../reports/components/CollapsibleStatementTable'
import { PnLAccountDetailDrawer } from '../components/PnLAccountDetailDrawer'
import { SalesByCityCard } from '../../reports/components/SalesByCityCard'
import { InfoTooltip, type InfoTooltipProps } from '@/components/ui/InfoTooltip'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { getDateRangeForPeriod } from '@/lib/utils/dateRanges'
import {
  AlertCircle,
  RefreshCw,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { EChartsLine } from '@/components/charts/echarts'
import { useTheme } from '@/hooks/useTheme'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { PERIOD_OPTION_GROUPS, PERIOD_OPTIONS } from '@/lib/utils/dateRanges'
import { PeriodPicker } from '../../components/PeriodPicker'
import { PnLPDF, PnLExportButtons } from '../components'
import { pdf } from '@react-pdf/renderer'

export function BCOAuthPnLView({ connectionId }: { connectionId: string }) {
  const [selectedPeriod, setSelectedPeriod] = useState('this_year')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<StatementLine | null>(null)
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const borderClass = isLight ? 'border-stone-200' : 'border-white/[0.08]'
  const sectionHover = cn(
    'group relative -mx-3 px-3 -mt-4 pt-4 -mb-6 pb-6 rounded-[4px]',
    'transition-all duration-300 ease-out',
    'hover:scale-[1.02] origin-center',
    isLight
      ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
      : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
  )

  const dateRange = useMemo(() => {
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate }
    }
    const range = getDateRangeForPeriod(selectedPeriod)
    return { startDate: range.start, endDate: range.end }
  }, [selectedPeriod, customStartDate, customEndDate])

  const { lines, totals, companyName, currency, isLoading, error, mutate } = useBCIncomeStatement(
    connectionId,
    dateRange
  )
  const enhanced = useBCEnhancedData(connectionId, dateRange)
  const trend = useBCMonthlyTrend(connectionId, dateRange)
  const salesGeo = useBCSalesGeography(connectionId, dateRange)

  // Report loading state to WelcomeContext for coordinated loading UI
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    const hasData = !!totals
    const allDoneLoading = !isLoading
    if (hasData || allDoneLoading) {
      welcomeContext?.setDataLoading(false)
    } else {
      welcomeContext?.setDataLoading(true)
    }
  }, [welcomeContext, isLoading, totals])

  const mutateAll = () => {
    mutate()
    enhanced.mutate()
    trend.mutate()
    salesGeo.mutate()
  }

  // PDF download state
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false)

  // PDF download handler
  const handleDownloadPDF = useCallback(async () => {
    setIsDownloadingPDF(true)
    try {
      const blob = await pdf(
        <PnLPDF
          totals={totals}
          lines={lines}
          monthlyTrend={trend.months}
          topCustomers={enhanced.topCustomers}
          topVendors={enhanced.topVendors}
          companyName={companyName}
          currency={currency}
          dateRange={
            dateRange.startDate && dateRange.endDate
              ? { start: dateRange.startDate, end: dateRange.endDate }
              : undefined
          }
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const filename = `pnl-${dateRange.startDate}-to-${dateRange.endDate}.pdf`
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF generation failed:', err)
    } finally {
      setIsDownloadingPDF(false)
    }
  }, [
    totals,
    lines,
    trend.months,
    enhanced.topCustomers,
    enhanced.topVendors,
    companyName,
    currency,
    dateRange,
  ])

  // Format trend data for EChartsLine
  const formattedTrendData = useMemo(() => {
    return trend.months.map((row) => {
      const date = new Date(row.month + '-01')
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      return {
        month: monthLabel,
        revenue: row.revenue,
        cogs: row.cogs,
        expenses: row.expenses,
        netIncome: row.net_income,
      }
    })
  }, [trend.months])

  // Theme colors for charts
  const themeGreen = isLight ? '#178E66' : '#2FBC8B'
  const themeRed = isLight ? '#B91C1C' : '#F87171'
  const themeBlue = isLight ? '#0D54A8' : '#66A7F3'
  const themeAmber = isLight ? '#D97706' : '#F59E0B'
  // Tooltip data builders
  const marginsTooltipProps = useMemo(() => {
    if (!totals) return undefined
    const grossMargin =
      totals.totalRevenue !== 0
        ? ((totals.grossProfit / totals.totalRevenue) * 100).toFixed(1)
        : '0'
    const netMargin =
      totals.totalRevenue !== 0 ? ((totals.netIncome / totals.totalRevenue) * 100).toFixed(1) : '0'
    const operatingMargin =
      totals.totalRevenue !== 0
        ? ((totals.operatingIncome / totals.totalRevenue) * 100).toFixed(1)
        : '0'
    return {
      description:
        'Profit margins measure how efficiently revenue converts to profit at each level — gross, operating, and net.',
      calculationTooltip: {
        formula:
          'Gross Profit = Revenue − COGS\nOperating Income = Gross Profit − Operating Expenses\nNet Income = Operating Income − Interest/Taxes + Non-Op Income',
        components: [
          { label: 'Revenue', value: formatCompactCurrency(totals.totalRevenue, currency) },
          { label: 'COGS', value: formatCompactCurrency(totals.totalCOGS, currency) },
          { label: 'Gross Profit', value: formatCompactCurrency(totals.grossProfit, currency) },
          { label: 'Gross Margin', value: `${grossMargin}%`, highlight: true },
          {
            label: 'Operating Income',
            value: formatCompactCurrency(totals.operatingIncome, currency),
          },
          { label: 'Operating Margin', value: `${operatingMargin}%`, highlight: true },
          { label: 'Net Income', value: formatCompactCurrency(totals.netIncome, currency) },
          { label: 'Net Margin', value: `${netMargin}%`, highlight: true },
        ],
      },
      note: 'Source: BC Income Statement (netChange). Period-filtered.',
    }
  }, [totals, currency])

  const topCustomersTooltipProps = useMemo(() => {
    if (!enhanced.topCustomers || enhanced.topCustomers.length === 0) return undefined
    const totalRev = enhanced.topCustomers.reduce((s, c) => s + c.total_revenue, 0)
    return {
      description: 'Top customers ranked by total invoiced revenue in the selected period.',
      calculationTooltip: {
        formula: 'Customer Revenue = Σ Posted Invoice Amounts',
        components: [
          { label: 'Customers Shown', value: enhanced.topCustomers.length.toString() },
          {
            label: 'Top Customer',
            value: `${enhanced.topCustomers[0]?.name || 'N/A'} — ${formatCompactCurrency(enhanced.topCustomers[0]?.total_revenue || 0, currency)}`,
          },
          {
            label: 'Combined Revenue',
            value: formatCompactCurrency(totalRev, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC Posted Sales Invoices, grouped by customer.',
    }
  }, [enhanced.topCustomers, currency])

  const topVendorsTooltipProps = useMemo(() => {
    if (!enhanced.topVendors || enhanced.topVendors.length === 0) return undefined
    const totalSpend = enhanced.topVendors.reduce((s, v) => s + Number(v.total_spend), 0)
    return {
      description: 'Top vendors ranked by total purchase spend in the selected period.',
      calculationTooltip: {
        formula: 'Vendor Spend = Σ Posted Purchase Invoice Amounts',
        components: [
          { label: 'Vendors Shown', value: enhanced.topVendors.length.toString() },
          {
            label: 'Top Vendor',
            value: `${enhanced.topVendors[0]?.vendor_name || 'N/A'} — ${formatCompactCurrency(Number(enhanced.topVendors[0]?.total_spend || 0), currency)}`,
          },
          {
            label: 'Combined Spend',
            value: formatCompactCurrency(totalSpend, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC Posted Purchase Invoices, grouped by vendor.',
    }
  }, [enhanced.topVendors, currency])

  const monthlyRevenueTooltipProps = useMemo(() => {
    if (!trend.months || trend.months.length === 0) return undefined
    const totalRev = trend.months.reduce((s, m) => s + m.revenue, 0)
    return {
      description: 'Monthly revenue trend from income statement accounts over the selected period.',
      calculationTooltip: {
        formula: 'Monthly Revenue = Σ Income Account GL Entries per Month',
        components: [
          { label: 'Months', value: trend.months.length.toString() },
          {
            label: 'Total Revenue',
            value: formatCompactCurrency(totalRev, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC General Ledger (Income accounts), aggregated monthly.',
    }
  }, [trend.months, currency])

  const monthlyTrendTooltipProps = useMemo(() => {
    if (!trend.months || trend.months.length === 0) return undefined
    const totalRev = trend.months.reduce((s, m) => s + m.revenue, 0)
    const totalNet = trend.months.reduce((s, m) => s + m.net_income, 0)
    return {
      description:
        'Monthly breakdown of revenue, COGS, expenses, and net income showing how profitability evolves over time.',
      calculationTooltip: {
        formula: 'Net Income = Revenue − COGS − Expenses',
        components: [
          { label: 'Months', value: trend.months.length.toString() },
          { label: 'Total Revenue', value: formatCompactCurrency(totalRev, currency) },
          {
            label: 'Total Net Income',
            value: formatCompactCurrency(totalNet, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC Income Statement entries, grouped by posting month.',
    }
  }, [trend.months, currency])

  const salesByLocationTooltipProps = useMemo(() => {
    if (!salesGeo.byCity || salesGeo.byCity.length === 0) return undefined
    const totalSales = salesGeo.byCity.reduce((s, c) => s + c.totalAmount, 0)
    const cities = salesGeo.byCity.filter((c) => c.city !== '(unknown)').length
    return {
      description:
        'Geographic distribution of sales revenue, grouped by customer ship-to city and country.',
      calculationTooltip: {
        formula: 'City Sales = Σ Invoice Amounts per Ship-to City',
        components: [
          { label: 'Cities', value: cities.toString() },
          {
            label: 'Total Sales',
            value: formatCompactCurrency(totalSales, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC Posted Sales Invoices with ship-to address data.',
    }
  }, [salesGeo.byCity, currency])

  const incomeStatementTooltipProps = useMemo(() => {
    if (!totals) return undefined
    return {
      description:
        'Full income statement with expandable line items showing all revenue and expense accounts.',
      calculationTooltip: {
        formula: 'Net Income = Total Revenue − COGS − Operating Expenses',
        components: [
          { label: 'Revenue', value: formatCompactCurrency(totals.totalRevenue, currency) },
          { label: 'COGS', value: formatCompactCurrency(totals.totalCOGS, currency) },
          { label: 'Expenses', value: formatCompactCurrency(totals.totalExpenses, currency) },
          {
            label: 'Net Income',
            value: formatCompactCurrency(totals.netIncome, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC Chart of Accounts with Income Statement category, period netChange.',
    }
  }, [totals, currency])

  // Top customers formatted for display in a simple card
  const topCustomers = enhanced.topCustomers

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500" />
          <h3 className="text-lg font-semibold theme-text-primary">Data Load Error</h3>
          <p className="text-sm theme-text-secondary">
            {error instanceof Error ? error.message : 'Failed to load P&L data.'}
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
    <div className="@container space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-10 pt-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="dashboard-title text-[36px] font-light theme-text-primary tracking-tight">
              Profit & Loss
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
              disabled={isLoading || enhanced.isLoading || trend.isLoading}
              className="p-1.5 theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading || enhanced.isLoading || trend.isLoading ? 'animate-spin' : ''}`}
              />
            </button>
            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloadingPDF || isLoading}
              className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Download PDF Report"
            >
              {isDownloadingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Key metrics strip - flat layout like Balance Sheet */}
      {totals && (
        <div
          className={cn(
            'flex flex-wrap justify-start gap-x-10 gap-y-4 pt-5 pb-3 border-b',
            borderClass
          )}
        >
          <div>
            <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
              Revenue
            </div>
            <div className="text-[28px] font-mono font-semibold tabular-nums text-theme-green">
              {formatCompactCurrency(totals.totalRevenue, currency)}
            </div>
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
              COGS
            </div>
            <div className="text-[28px] font-mono font-semibold tabular-nums text-theme-red">
              {formatCompactCurrency(-totals.totalCOGS, currency)}
            </div>
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
              Gross Profit
            </div>
            <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
              {formatCompactCurrency(totals.grossProfit, currency)}
            </div>
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
              Expenses
            </div>
            <div className="text-[28px] font-mono font-semibold tabular-nums text-theme-red">
              {formatCompactCurrency(-totals.totalExpenses, currency)}
            </div>
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
              Net Income
            </div>
            <div
              className={cn(
                'text-[28px] font-mono font-semibold tabular-nums',
                totals.netIncome >= 0 ? 'text-theme-green' : 'text-theme-red'
              )}
            >
              {formatCompactCurrency(totals.netIncome, currency)}
            </div>
          </div>
        </div>
      )}

      {/* Margins + Top Customers Row */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6')}>
        <section
          className={cn(sectionHover, 'pb-6 @3xl:pb-0 @3xl:pr-8 @3xl:border-r', borderClass)}
        >
          <PnLMarginsCard
            pnlTotals={totals}
            isLoading={isLoading}
            currency={currency}
            tooltipProps={marginsTooltipProps}
          />
        </section>
        <section className={sectionHover}>
          <TopCustomersSection
            customers={topCustomers}
            isLoading={enhanced.isLoading}
            currency={currency}
            isLight={isLight}
            tooltipProps={topCustomersTooltipProps}
          />
        </section>
      </div>

      {/* Vendors + Monthly Revenue Row */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6')}>
        <section
          className={cn(sectionHover, 'pb-6 @3xl:pb-0 @3xl:pr-8 @3xl:border-r', borderClass)}
        >
          <TopVendorsCard
            vendors={enhanced.topVendors}
            isLoading={enhanced.isLoading}
            currency={currency}
            tooltipProps={topVendorsTooltipProps}
          />
        </section>
        <section className={sectionHover}>
          <MonthlyRevenueChart
            data={trend.months}
            isLoading={trend.isLoading}
            currency={currency}
            tooltipProps={monthlyRevenueTooltipProps}
            totalRevenue={totals?.totalRevenue}
          />
        </section>
      </div>

      {/* Monthly P&L Trend Chart */}
      {formattedTrendData.length > 0 && (
        <div className={cn(sectionHover, 'pt-6 border-t', borderClass)}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'relative text-base font-normal uppercase tracking-wider',
                  isLight ? 'text-stone-800' : 'text-stone-300'
                )}
              >
                Monthly P&L Trend
                <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
              </span>
              {monthlyTrendTooltipProps && <InfoTooltip {...monthlyTrendTooltipProps} />}
            </div>
            <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
          </div>
          <div>
            <EChartsLine
              height={280}
              data={formattedTrendData}
              xKey="month"
              series={[
                { key: 'revenue', name: 'Revenue', color: themeGreen },
                { key: 'expenses', name: 'Expenses', color: themeRed },
                { key: 'cogs', name: 'COGS', color: themeAmber },
                { key: 'netIncome', name: 'Net Income', color: themeBlue },
              ]}
              formatY={(v) => formatCompactCurrency(v, currency)}
            />
          </div>
        </div>
      )}

      {/* Sales by Location */}
      <div className="pt-6">
        <SalesByCityCard
          data={salesGeo.byCity}
          currency={currency}
          isLoading={salesGeo.isLoading}
          tooltipProps={salesByLocationTooltipProps}
        />
      </div>

      {/* Collapsible Income Statement */}
      <div className="flex items-center gap-3 mb-8">
        <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
          Income Statement
        </h2>
        <div className="h-px flex-1 section-divider-line" />
      </div>
      <CollapsibleStatementTable
        lines={lines}
        amountKey="netChange"
        currency={currency}
        title="Income Statement"
        dateRange={
          dateRange.startDate && dateRange.endDate
            ? { start: dateRange.startDate, end: dateRange.endDate }
            : undefined
        }
        isLoading={isLoading}
        tooltipProps={incomeStatementTooltipProps}
        tableMaxWidth="1000px"
        onAccountClick={(line) => {
          if (line._accountNumber) {
            setSelectedAccount((prev) =>
              prev?._accountNumber === line._accountNumber ? null : line
            )
          }
        }}
        selectedAccountNumber={selectedAccount?._accountNumber ?? null}
        renderAccountDetail={() => (
          <PnLAccountDetailDrawer
            open={!!selectedAccount}
            onClose={() => setSelectedAccount(null)}
            connectionId={connectionId}
            accountNumber={selectedAccount?._accountNumber ?? null}
            accountName={selectedAccount?.display ?? null}
            category={selectedAccount?._category ?? null}
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            currency={currency}
          />
        )}
        exportButtons={
          <PnLExportButtons
            lines={lines}
            totals={totals}
            companyName={companyName}
            currency={currency}
            dateRange={
              dateRange.startDate && dateRange.endDate
                ? { start: dateRange.startDate, end: dateRange.endDate }
                : undefined
            }
          />
        }
      />
    </div>
  )
}

function TopCustomersSection({
  customers,
  isLoading,
  currency,
  isLight,
  tooltipProps,
}: {
  customers: Array<{ name: string; total_revenue: number }>
  isLoading: boolean
  currency: string
  isLight: boolean
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Top Customers
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn('h-10 animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
          />
        ))}
      </div>
    )
  }

  if (customers.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Top Customers
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        <p className={cn('text-sm py-4', isLight ? 'text-stone-500' : 'text-stone-500')}>
          No customer data
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Top Customers
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps && <InfoTooltip {...tooltipProps} />}
        </div>
        <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
      </div>
      {customers.map((c, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center justify-between py-2.5 px-2 -mx-2 text-xs',
            i % 2 === 0 && (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]')
          )}
        >
          <span
            className={cn(
              'text-[14px] truncate flex-1 mr-2',
              isLight ? 'text-stone-900' : 'text-white'
            )}
          >
            {c.name}
          </span>
          <span className="text-[16px] font-mono font-semibold tabular-nums text-theme-green">
            {formatCompactCurrency(c.total_revenue, currency)}
          </span>
        </div>
      ))}
    </div>
  )
}
