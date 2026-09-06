'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronRight, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatPnLCurrency,
  formatCompactCurrency,
  formatCompactNumber,
  formatAxisCurrency,
  formatAxisCompact,
  getCurrencyInfo,
} from '@/lib/utils/currency'
import { EChartsLine, EChartsPie, EChartsWorldMap } from '@/components/charts/echarts'
import type { CountrySalesData } from '@/components/charts/echarts'
import { useTheme } from '@/hooks/useTheme'
import type {
  MonthlyPnLTrendRow,
  ARAPSummary,
  BankAccountRow,
  TopCustomerRow,
  AgedReceivablesSummary,
  AgedPayablesSummary,
  TopVendorRow,
  FinancialRatios,
  MonthlyRevenueRow,
  InventorySummary,
  InventoryItem,
  CashRunwayData,
  EfficiencyMetrics,
  FinancialHealthScore,
  SalespersonRow,
} from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { ChartLegend } from '@/components/charts/ChartLegend'
import { AgedReceivablesCard } from './AgedReceivablesCard'
import { AgedPayablesCard } from './AgedPayablesCard'
import { TopVendorsCard } from './TopVendorsCard'
import { PnLMarginsCard } from './PnLMarginsCard'
import { FinancialRatiosCard } from './FinancialRatiosCard'
import { MonthlyRevenueChart } from './MonthlyRevenueChart'
import { InventoryDashboardCard } from './InventoryDashboardCard'
import { CashRunwayCard } from './CashRunwayCard'
import { EfficiencyMetricsCard } from './EfficiencyMetricsCard'
import { FinancialHealthScoreCard } from './FinancialHealthScoreCard'
import { SalesBySalespersonCard } from './SalesBySalespersonCard'
import { AIAnalysisInlineSection } from '@/components/ai-analysis'
import type { MonthlyCashFlowByActivity } from '../../cash-flow/components/CashFlowByActivityCard'
import {
  useThemeEChartsConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '@/components/chat/visualizations/shared'

interface BCOAuthExecutiveDashboardProps {
  pnlTotals: {
    totalRevenue: number
    totalCOGS: number
    grossProfit: number
    totalExpenses: number
    operatingIncome: number
    netIncome: number
  } | null

  bsTotals: {
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
  } | null

  monthlyTrend: MonthlyPnLTrendRow[]

  // Dashboard data
  arapSummary: ARAPSummary | null
  bankAccounts: BankAccountRow[]
  totalCash: number
  topCustomers: TopCustomerRow[]

  // New dashboard data
  agedReceivablesSummary: AgedReceivablesSummary | null
  agedPayablesSummary: AgedPayablesSummary | null
  topVendors: TopVendorRow[]
  financialRatios: FinancialRatios | null
  monthlyRevenue: MonthlyRevenueRow[]

  // Cash Flow data
  cashFlowByActivity: MonthlyCashFlowByActivity[]
  cashFlowActivitySummary: { operating: number; investing: number; financing: number } | null

  // High-priority feature data
  inventorySummary: InventorySummary | null
  inventoryItems: InventoryItem[]
  cashRunwayData: CashRunwayData | null
  efficiencyMetrics: EfficiencyMetrics | null
  financialHealthScore: FinancialHealthScore | null
  salesBySalesperson: SalespersonRow[]

  // Sales geography
  salesByCountry?: CountrySalesData[]
  salesGeoLoading?: boolean

  pnlLoading: boolean
  bsLoading: boolean
  trendLoading: boolean
  cashFlowActivityLoading: boolean
  arapLoading: boolean
  bankLoading: boolean
  customersLoading: boolean
  agedARLoading: boolean
  agedAPLoading: boolean
  vendorsLoading: boolean
  ratiosLoading: boolean
  revenueLoading: boolean
  inventoryLoading: boolean
  cashRunwayLoading: boolean
  efficiencyLoading: boolean
  healthScoreLoading: boolean
  salespersonLoading: boolean

  currency?: string
  connectionId?: string | null

  // AI Analysis sections (rendered inline)
  analysisSections?: { strategic: string; forward: string; actions: string } | null
  analysisLoading?: boolean
}

function MiniMetric({
  label,
  value,
  color,
  isLoading,
  isLight,
}: {
  label: string
  value: string
  color: string
  isLoading?: boolean
  isLight?: boolean
}) {
  return (
    <div className="flex flex-col items-center text-center flex-1 min-w-0">
      <span className="text-xs theme-text-secondary uppercase tracking-wider font-medium mb-1 whitespace-nowrap">
        {label}
      </span>
      {isLoading ? (
        <span
          className={cn(
            'inline-block w-20 h-6 animate-pulse',
            isLight ? 'bg-stone-200' : 'bg-gray-700/30'
          )}
        />
      ) : (
        <span
          className={cn('text-base font-mono font-semibold tabular-nums whitespace-nowrap', color)}
        >
          {value}
        </span>
      )}
    </div>
  )
}

function LoadingSpinner({ color = 'border-amber-500' }: { color?: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className={cn('animate-spin rounded-full h-8 w-8 border-b-2', color)} />
    </div>
  )
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center justify-between mb-6">
      <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
        {children}
        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
      </span>
      <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
    </Link>
  )
}

/* ─── Cash Flow Activity Chart (inline) ─── */
function CashFlowActivityChart({
  data,
  currency,
}: {
  data: MonthlyCashFlowByActivity[]
  currency: string
}) {
  const { theme } = useTheme()
  const { splitLineStyle } = useThemeEChartsConfig()
  const [selectedSeries, setSelectedSeries] = useState<Record<string, boolean>>({})
  const [axisTextColor, setAxisTextColor] = useState('#94a3b8')

  useEffect(() => {
    const update = () => {
      const c = getComputedStyle(document.documentElement)
        .getPropertyValue('--theme-text-secondary')
        .trim()
      if (c) setAxisTextColor(c)
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const operatingColor = '#2BB5C6'
  const investingColor = '#E879A0'
  const financingColor = '#F59E42'

  const legendItems = useMemo(
    () => [
      { name: 'Operating', color: operatingColor },
      { name: 'Investing', color: investingColor },
      { name: 'Financing', color: financingColor },
    ],
    [operatingColor, investingColor, financingColor]
  )

  const handleLegendToggle = (name: string) => {
    setSelectedSeries((prev) => ({ ...prev, [name]: prev[name] === false ? true : false }))
  }

  const sorted = useMemo(() => {
    return [...data]
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
      .map((row) => ({
        month: new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        operating: row.operating,
        investing: row.investing,
        financing: row.financing,
      }))
  }, [data])

  const option = useMemo(
    () => ({
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 300,
      animationEasing: 'quarticOut',
      animationDurationUpdate: 300,
      animationEasingUpdate: 'quarticOut',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(38, 38, 38, 0.95)',
        borderColor: 'transparent',
        borderWidth: 0,
        textStyle: { color: theme === 'light' ? '#374151' : '#e5e7eb', fontSize: 12 },
        axisPointer: { type: 'line' as const, lineStyle: { color: 'transparent' } },
        formatter: (params: any[]) => {
          if (!params?.length) return ''
          const headerColor = theme === 'light' ? '#111827' : '#f8fafc'
          const labelColor = theme === 'light' ? '#6b7280' : '#94a3b8'
          const positiveColor = '#10B981'
          const negativeColor = '#EF4444'
          const borderColor = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
          let html = `<div style="font-weight:600;margin-bottom:6px;color:${headerColor}">${params[0].axisValue}</div>`
          let total = 0
          params.forEach((p: any) => {
            total += p.value || 0
            const c = p.value >= 0 ? positiveColor : negativeColor
            html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:1px 0">
            <span style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span><span style="color:${labelColor}">${p.seriesName}</span></span>
            <span style="font-weight:500;font-family:monospace;color:${c}">${formatPnLCurrency(p.value, currency)}</span></div>`
          })
          html += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid ${borderColor};display:flex;justify-content:space-between;gap:12px"><span style="color:${labelColor}">Net</span><span style="font-weight:700;font-family:monospace;color:${total >= 0 ? positiveColor : negativeColor}">${formatPnLCurrency(total, currency)}</span></div>`
          return html
        },
      },
      legend: {
        show: false,
        data: ['Operating', 'Investing', 'Financing'],
        selected: selectedSeries,
      },
      grid: { left: '3%', right: '3%', bottom: '3%', top: '8%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: sorted.map((d) => d.month),
        axisLabel: { color: axisTextColor, fontSize: 11, fontFamily: 'DM Sans, sans-serif' },
        axisLine: { lineStyle: { color: axisTextColor } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          color: axisTextColor,
          fontSize: 11,
          fontFamily: 'DM Sans, sans-serif',
          formatter: formatAxisCompact,
        },
        splitLine: { lineStyle: { color: splitLineStyle.color, type: 'dashed' } },
      },
      series: [
        {
          name: 'Operating',
          type: 'bar',
          stack: 'cf',
          data: sorted.map((d) => d.operating),
          itemStyle: { color: operatingColor },
          emphasis: {
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: operatingColor },
                  { offset: 1, color: `${operatingColor}B3` },
                ],
              },
              borderColor: operatingColor,
              borderWidth: 1,
            },
          },
          barMaxWidth: 32,
        },
        {
          name: 'Investing',
          type: 'bar',
          stack: 'cf',
          data: sorted.map((d) => d.investing),
          itemStyle: { color: investingColor },
          emphasis: {
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: investingColor },
                  { offset: 1, color: `${investingColor}B3` },
                ],
              },
              borderColor: investingColor,
              borderWidth: 1,
            },
          },
          barMaxWidth: 32,
        },
        {
          name: 'Financing',
          type: 'bar',
          stack: 'cf',
          data: sorted.map((d) => d.financing),
          itemStyle: { color: financingColor },
          emphasis: {
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: financingColor },
                  { offset: 1, color: `${financingColor}B3` },
                ],
              },
              borderColor: financingColor,
              borderWidth: 1,
            },
          },
          barMaxWidth: 32,
        },
      ],
    }),
    [
      sorted,
      operatingColor,
      investingColor,
      financingColor,
      currency,
      theme,
      axisTextColor,
      splitLineStyle,
      selectedSeries,
    ]
  )

  return (
    <div className="flex flex-col">
      <ReactECharts
        option={option}
        style={{ width: '100%', height: 200 }}
        opts={canvasHighDpiOpts}
      />
      <div className="h-8 flex items-center justify-center">
        <ChartLegend
          items={legendItems}
          selected={selectedSeries}
          onToggle={handleLegendToggle}
          className="pt-0"
        />
      </div>
    </div>
  )
}

/* ─── AR/AP Section ─── */
function ARAPSection({
  arapSummary,
  arapLoading,
  currency,
  isLight,
  borderClass,
  tooltipProps,
}: {
  arapSummary: ARAPSummary | null
  arapLoading: boolean
  currency: string
  isLight: boolean
  borderClass: string
  tooltipProps?: Omit<import('@/components/ui/InfoTooltip').InfoTooltipProps, 'className'>
}) {
  const ar = arapSummary?.total_ar || 0
  const ap = arapSummary?.total_ap || 0
  const overdue = arapSummary?.ar_overdue || 0
  const netPosition = ar - ap
  const overduePercent = ar > 0 ? (overdue / ar) * 100 : 0
  const arBarPercent = ar + ap > 0 ? (ar / (ar + ap)) * 100 : 50

  const textMutedClass = 'text-stone-500'
  const heading = (
    <div className="flex items-center gap-1.5 mb-5">
      <span
        className={cn(
          'relative text-base font-normal uppercase tracking-wider',
          isLight ? 'text-stone-800' : 'text-stone-300'
        )}
      >
        Receivables & Payables
        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
      </span>
      {tooltipProps && <InfoTooltip {...tooltipProps} />}
    </div>
  )

  if (arapLoading) {
    return (
      <div className="space-y-2">
        {heading}
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={cn('h-10 animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
          />
        ))}
      </div>
    )
  }

  if (!arapSummary) {
    return (
      <div>
        {heading}
        <p className={cn('text-sm py-4', textMutedClass)}>No data</p>
      </div>
    )
  }

  return (
    <div>
      {heading}

      <div className="space-y-4">
        {/* AR / AP side-by-side */}
        <div className="grid grid-cols-2 gap-3">
          <div className={cn('p-3', isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]')}>
            <div
              className={cn(
                'text-[12px] uppercase tracking-wider font-medium mb-1',
                textMutedClass
              )}
            >
              Receivable
            </div>
            <div
              className={cn(
                'text-[28px] font-mono font-semibold tabular-nums leading-tight',
                isLight ? 'text-green-600' : 'text-green-400'
              )}
            >
              {formatCompactCurrency(ar, currency)}
            </div>
            <div className={cn('text-[12px] mt-0.5', textMutedClass)}>
              {arapSummary.customer_count} customers
            </div>
          </div>
          <div className={cn('p-3', isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]')}>
            <div
              className={cn(
                'text-[12px] uppercase tracking-wider font-medium mb-1',
                textMutedClass
              )}
            >
              Payable
            </div>
            <div
              className={cn(
                'text-[28px] font-mono font-semibold tabular-nums leading-tight',
                isLight ? 'text-red-600' : 'text-red-400'
              )}
            >
              {formatCompactCurrency(ap, currency)}
            </div>
            <div className={cn('text-[12px] mt-0.5', textMutedClass)}>
              {arapSummary.vendor_count} vendors
            </div>
          </div>
        </div>

        {/* AR vs AP visual bar */}
        <div>
          <div className={cn('flex items-center justify-between text-[12px] mb-1', textMutedClass)}>
            <span>AR</span>
            <span>AP</span>
          </div>
          <div
            className={cn(
              'w-full h-1.5 overflow-hidden flex',
              isLight ? 'bg-stone-100' : 'bg-white/[0.04]'
            )}
          >
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${arBarPercent}%`,
                backgroundColor: '#10B981',
              }}
            />
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${100 - arBarPercent}%`,
                backgroundColor: '#EF4444',
              }}
            />
          </div>
        </div>

        {/* Overdue + Net Position */}
        <div className={cn('space-y-2 pt-2 border-t', borderClass)}>
          {overdue > 0 && (
            <div className={cn('flex items-center justify-between py-1.5 border-b', borderClass)}>
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={cn('w-3.5 h-3.5', isLight ? 'text-red-600' : 'text-red-400')}
                />
                <span className="text-[14px] theme-text-secondary">Overdue</span>
                <span
                  className={cn(
                    'text-[12px] px-1.5 py-0.5 font-mono font-semibold tabular-nums',
                    isLight ? 'bg-red-100 text-red-600' : 'bg-red-500/10 text-red-400'
                  )}
                >
                  {overduePercent.toFixed(0)}%
                </span>
              </div>
              <span
                className={cn(
                  'text-[16px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-red-600' : 'text-red-400'
                )}
              >
                {formatCompactCurrency(overdue, currency)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[14px] font-medium theme-text-secondary">Net Position</span>
            <span
              className={cn(
                'text-[16px] font-mono font-bold tabular-nums',
                netPosition >= 0
                  ? isLight
                    ? 'text-green-600'
                    : 'text-green-400'
                  : isLight
                    ? 'text-red-600'
                    : 'text-red-400'
              )}
            >
              {netPosition >= 0 ? '+' : ''}
              {formatCompactCurrency(netPosition, currency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Cash Position Section ─── */
function CashPositionSection({
  bankAccounts,
  totalCash,
  bankLoading,
  currency,
  isLight,
  borderClass,
  tooltipProps,
}: {
  bankAccounts: BankAccountRow[]
  totalCash: number
  bankLoading: boolean
  currency: string
  isLight: boolean
  borderClass: string
  tooltipProps?: Omit<import('@/components/ui/InfoTooltip').InfoTooltipProps, 'className'>
}) {
  const textMutedClass = 'text-stone-500'
  const cashHeading = (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          'relative text-base font-normal uppercase tracking-wider',
          isLight ? 'text-stone-800' : 'text-stone-300'
        )}
      >
        Cash Position
        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
      </span>
      {tooltipProps && <InfoTooltip {...tooltipProps} />}
    </div>
  )

  if (bankLoading) {
    return (
      <div className="space-y-2">
        <div className="mb-5">{cashHeading}</div>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={cn('h-8 animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2">
        <div className="mb-3">{cashHeading}</div>
        <span
          className={cn(
            'text-[28px] font-mono font-semibold tabular-nums block',
            isLight ? 'text-green-600' : 'text-green-400'
          )}
        >
          {formatCompactCurrency(totalCash, currency)}
        </span>
      </div>

      {bankAccounts.length > 0 ? (
        <div
          className="max-h-[200px] -mr-3 pr-3 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 dark:[&::-webkit-scrollbar-thumb]:bg-stone-600 [&::-webkit-scrollbar-thumb]:rounded-full"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: isLight ? '#a8a29e transparent' : '#57534e transparent',
          }}
        >
          <div className="pr-2">
            {bankAccounts.map((bank, i) => (
              <div
                key={bank.no}
                className={cn(
                  'flex items-center justify-between gap-2 py-2.5 px-2 -mx-2 text-sm',
                  i % 2 === 0 && (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]')
                )}
              >
                <span className="theme-text-secondary truncate flex-1" title={bank.name}>
                  {bank.name.length > 30 ? bank.name.substring(0, 30) + '...' : bank.name}
                </span>
                <span
                  className={cn(
                    'font-mono font-semibold tabular-nums whitespace-nowrap',
                    Number(bank.balance_lcy) >= 0
                      ? isLight
                        ? 'text-stone-900'
                        : 'text-white'
                      : isLight
                        ? 'text-red-600'
                        : 'text-red-400'
                  )}
                >
                  {formatCompactCurrency(Number(bank.balance_lcy), currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className={cn('text-sm py-4', textMutedClass)}>No bank accounts</p>
      )}
    </div>
  )
}

/* ─── Top Customers Section ─── */
function TopCustomersSection({
  topCustomers,
  customersLoading,
  currency,
  isLight,
  tooltipProps,
}: {
  topCustomers: TopCustomerRow[]
  customersLoading: boolean
  currency: string
  isLight: boolean
  tooltipProps?: Omit<import('@/components/ui/InfoTooltip').InfoTooltipProps, 'className'>
}) {
  const maxCustomerRevenue =
    topCustomers.length > 0 ? Math.max(...topCustomers.map((c) => Number(c.total_revenue))) : 0

  const textMutedClass = 'text-stone-500'
  const sectionHeadingClass = cn(
    'text-base font-normal uppercase tracking-wider mb-5',
    isLight ? 'text-stone-800' : 'text-stone-300'
  )

  const linkedHeading = (title: string) => (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'relative text-base font-normal uppercase tracking-wider',
            isLight ? 'text-stone-800' : 'text-stone-300'
          )}
        >
          {title}
          <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
        </span>
        {tooltipProps && <InfoTooltip {...tooltipProps} />}
      </div>
      <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
    </div>
  )

  if (customersLoading) {
    return (
      <div className="space-y-2">
        {linkedHeading('Top Customers')}
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn('h-8 animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
          />
        ))}
      </div>
    )
  }

  if (topCustomers.length === 0) {
    return (
      <div>
        {linkedHeading('Top Customers')}
        <p className={cn('text-sm py-4', textMutedClass)}>No customer data</p>
      </div>
    )
  }

  return (
    <div>
      {linkedHeading('Top Customers')}
      <div className="space-y-3">
        {topCustomers.map((customer, i) => {
          const revenue = Number(customer.total_revenue)
          const barWidth =
            maxCustomerRevenue > 0 ? Math.max(8, (revenue / maxCustomerRevenue) * 100) : 0
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-sm theme-text-secondary truncate flex-1"
                  title={customer.name}
                >
                  {customer.name.length > 28
                    ? customer.name.substring(0, 28) + '...'
                    : customer.name}
                </span>
                <span className="text-base font-mono font-semibold tabular-nums theme-text-primary whitespace-nowrap">
                  {formatCompactCurrency(revenue, currency)}
                </span>
              </div>
              <div className={cn('w-full h-1.5', isLight ? 'bg-stone-100' : 'bg-white/[0.04]')}>
                <div
                  className="h-full bg-purple-500/60 transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function BCOAuthExecutiveDashboard({
  pnlTotals,
  bsTotals,
  monthlyTrend,
  arapSummary,
  bankAccounts,
  totalCash,
  topCustomers,
  agedReceivablesSummary,
  agedPayablesSummary,
  topVendors,
  financialRatios,
  monthlyRevenue,
  cashFlowByActivity,
  cashFlowActivitySummary,
  inventorySummary,
  inventoryItems,
  cashRunwayData,
  efficiencyMetrics,
  financialHealthScore,
  salesBySalesperson,
  pnlLoading,
  bsLoading,
  trendLoading,
  cashFlowActivityLoading,
  arapLoading,
  bankLoading,
  customersLoading,
  agedARLoading,
  agedAPLoading,
  vendorsLoading,
  ratiosLoading,
  revenueLoading,
  inventoryLoading,
  cashRunwayLoading,
  efficiencyLoading,
  healthScoreLoading,
  salespersonLoading,
  salesByCountry,
  salesGeoLoading,
  currency,
  connectionId,
  analysisSections,
  analysisLoading,
}: BCOAuthExecutiveDashboardProps) {
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

  // Helper to build links with connectionId query param
  const withConnectionId = (path: string) => {
    if (!connectionId) return path
    return `${path}?connectionId=${connectionId}`
  }

  // Theme-aware chart colors
  const themeGreen = '#10B981'
  const themeRed = '#EF4444'

  const totalExpensesDisplay = pnlTotals ? pnlTotals.totalExpenses : 0

  // Format monthly trend data for EChartsLine
  const formattedTrendData = useMemo(() => {
    return monthlyTrend.map((row) => {
      const date = new Date(row.month)
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      return {
        month: monthLabel,
        revenue: row.revenue,
        expenses: row.expenses,
        netIncome: row.net_income,
      }
    })
  }, [monthlyTrend])

  // Balance Sheet donut data
  const balanceSheetDonutData = useMemo(() => {
    if (!bsTotals) return []
    return [
      { name: 'Assets', value: Math.abs(bsTotals.totalAssets), color: '#10B981' },
      { name: 'Liabilities', value: Math.abs(bsTotals.totalLiabilities), color: '#EF4444' },
      { name: 'Equity', value: Math.abs(bsTotals.totalEquity), color: '#2BB5C6' },
    ].filter((item) => item.value > 0)
  }, [bsTotals, isLight])

  // Tooltip props for card components
  const marginsTooltipProps = useMemo(() => {
    if (!pnlTotals) return undefined
    const grossMargin =
      pnlTotals.totalRevenue !== 0
        ? ((pnlTotals.grossProfit / pnlTotals.totalRevenue) * 100).toFixed(1)
        : '0'
    const netMargin =
      pnlTotals.totalRevenue !== 0
        ? ((pnlTotals.netIncome / pnlTotals.totalRevenue) * 100).toFixed(1)
        : '0'
    return {
      description:
        'Profit margins measure how efficiently revenue converts to profit at each level.',
      calculationTooltip: {
        formula: 'Margin % = (Profit \u00f7 Revenue) \u00d7 100',
        components: [
          { label: 'Revenue', value: formatCompactCurrency(pnlTotals.totalRevenue, currency) },
          { label: 'Gross Margin', value: `${grossMargin}%`, highlight: true },
          { label: 'Net Margin', value: `${netMargin}%`, highlight: true },
        ],
      },
      note: 'Source: BC Income Statement.',
    }
  }, [pnlTotals, currency])

  const ratiosTooltipProps = useMemo(() => {
    if (!financialRatios) return undefined
    return {
      description: 'Key financial ratios measuring liquidity, leverage, and profitability.',
      calculationTooltip: {
        formula: 'Current Ratio = Current Assets \u00f7 Current Liabilities',
        components: [
          {
            label: 'Current Ratio',
            value:
              financialRatios.currentRatio !== null
                ? financialRatios.currentRatio.toFixed(2)
                : 'N/A',
          },
          {
            label: 'Quick Ratio',
            value:
              financialRatios.quickRatio !== null ? financialRatios.quickRatio.toFixed(2) : 'N/A',
          },
          {
            label: 'Working Capital',
            value: formatCompactCurrency(financialRatios.workingCapital, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC Balance Sheet & Income Statement.',
    }
  }, [financialRatios, currency])

  const efficiencyTooltipProps = useMemo(() => {
    if (!efficiencyMetrics) return undefined
    return {
      description:
        'Efficiency metrics show how effectively the company converts resources into revenue.',
      calculationTooltip: {
        formula: 'DSO = (Receivables \u00f7 Revenue) \u00d7 Days',
        components: [
          {
            label: 'Days Sales Outstanding',
            value:
              efficiencyMetrics.dso !== null ? `${efficiencyMetrics.dso.toFixed(0)} days` : 'N/A',
          },
          {
            label: 'Cash Conversion Cycle',
            value:
              efficiencyMetrics.cashConversionCycle !== null
                ? `${efficiencyMetrics.cashConversionCycle.toFixed(0)} days`
                : 'N/A',
            highlight: true,
          },
        ],
      },
      note: 'Source: BC AR/AP and Income Statement data.',
    }
  }, [efficiencyMetrics])

  const healthScoreTooltipProps = useMemo(() => {
    if (!financialHealthScore) return undefined
    return {
      description:
        'Composite financial health score (0-100) based on liquidity, profitability, and efficiency.',
      calculationTooltip: {
        formula: 'Score = Weighted Average of Key Financial Metrics',
        components: [
          { label: 'Overall Score', value: `${financialHealthScore.score}/100`, highlight: true },
          { label: 'Rating', value: financialHealthScore.rating },
        ],
      },
      note: 'Source: Derived from BC financial ratios and efficiency metrics.',
    }
  }, [financialHealthScore])

  const agedARTooltipProps = useMemo(() => {
    if (!agedReceivablesSummary) return undefined
    return {
      description:
        'Accounts receivable aged by due date. Total and buckets are in Local Currency (LCY), converted by Business Central from multi-currency invoices.',
      calculationTooltip: {
        formula: 'Total AR (LCY) from BC agedAccountsReceivables report',
        components: [
          {
            label: 'Current',
            value: formatCompactCurrency(agedReceivablesSummary.current || 0, currency),
          },
          {
            label: '1-30 Days',
            value: formatCompactCurrency(agedReceivablesSummary.days_1_30 || 0, currency),
          },
          {
            label: '31-60 Days',
            value: formatCompactCurrency(agedReceivablesSummary.days_31_60 || 0, currency),
          },
          {
            label: '61+ Days',
            value: formatCompactCurrency(
              agedReceivablesSummary.total -
                agedReceivablesSummary.current -
                agedReceivablesSummary.days_1_30 -
                agedReceivablesSummary.days_31_60,
              currency
            ),
          },
          {
            label: 'Total AR (LCY)',
            value: formatCompactCurrency(agedReceivablesSummary.total || 0, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC agedAccountsReceivables (LCY). Dual-call: default + shifted agedAsOfDate for 61-90/90+ split.',
    }
  }, [agedReceivablesSummary, currency])

  const agedAPTooltipProps = useMemo(() => {
    if (!agedPayablesSummary) return undefined
    return {
      description:
        'Accounts payable aged by due date. Total and buckets are in Local Currency (LCY), converted by Business Central from multi-currency invoices.',
      calculationTooltip: {
        formula: 'Total AP (LCY) from BC agedAccountsPayables report',
        components: [
          {
            label: 'Current',
            value: formatCompactCurrency(agedPayablesSummary.current || 0, currency),
          },
          {
            label: '1-30 Days',
            value: formatCompactCurrency(agedPayablesSummary.days_1_30 || 0, currency),
          },
          {
            label: '31-60 Days',
            value: formatCompactCurrency(agedPayablesSummary.days_31_60 || 0, currency),
          },
          {
            label: '61+ Days',
            value: formatCompactCurrency(
              agedPayablesSummary.total -
                agedPayablesSummary.current -
                agedPayablesSummary.days_1_30 -
                agedPayablesSummary.days_31_60,
              currency
            ),
          },
          {
            label: 'Total AP (LCY)',
            value: formatCompactCurrency(agedPayablesSummary.total || 0, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC agedAccountsPayables (LCY). Dual-call: default + shifted agedAsOfDate for 61-90/90+ split.',
    }
  }, [agedPayablesSummary, currency])

  const topVendorsTooltipProps = useMemo(() => {
    if (!topVendors || topVendors.length === 0) return undefined
    const totalSpend = topVendors.reduce((s, v) => s + Number(v.total_spend), 0)
    return {
      description: 'Top vendors ranked by total purchase spend.',
      calculationTooltip: {
        formula: 'Vendor Spend = \u03a3 Posted Purchase Invoices',
        components: [
          { label: 'Vendors Shown', value: topVendors.length.toString() },
          {
            label: 'Combined Spend',
            value: formatCompactCurrency(totalSpend, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC Posted Purchase Invoices.',
    }
  }, [topVendors, currency])

  const cashRunwayTooltipProps = useMemo(() => {
    if (!cashRunwayData) return undefined
    return {
      description: 'Estimates how long current cash reserves will last at the current burn rate.',
      calculationTooltip: {
        formula: 'Runway = Cash Balance \u00f7 Monthly Net Burn',
        components: [
          {
            label: 'Cash Balance',
            value: formatCompactCurrency(cashRunwayData.totalCash, currency),
          },
          {
            label: 'Monthly Revenue',
            value: formatCompactCurrency(cashRunwayData.monthlyRevenue, currency),
          },
          {
            label: 'Monthly Expenses',
            value: formatCompactCurrency(cashRunwayData.monthlyExpenses, currency),
          },
          {
            label: 'Runway',
            value:
              cashRunwayData.cashRunwayMonths !== null
                ? `${cashRunwayData.cashRunwayMonths.toFixed(1)} months`
                : '\u221e',
            highlight: true,
          },
        ],
      },
      note: 'Source: BC GL cash accounts and Income Statement averages.',
    }
  }, [cashRunwayData, currency])

  const monthlyRevenueTooltipProps = useMemo(() => {
    if (!monthlyTrend || monthlyTrend.length === 0) return undefined
    const totalRev = monthlyTrend.reduce((s, m) => s + m.revenue, 0)
    return {
      description: 'Monthly revenue trend from income statement accounts.',
      calculationTooltip: {
        formula: 'Monthly Revenue = \u03a3 Income Account GL Entries per Month',
        components: [
          { label: 'Months', value: monthlyTrend.length.toString() },
          {
            label: 'Total Revenue',
            value: formatCompactCurrency(totalRev, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC General Ledger (Income accounts).',
    }
  }, [monthlyTrend, currency])

  const salespersonTooltipProps = useMemo(() => {
    if (!salesBySalesperson || salesBySalesperson.length === 0) return undefined
    const totalSales = salesBySalesperson.reduce((s, sp) => s + Number(sp.total_sales), 0)
    return {
      description: 'Sales performance ranked by salesperson.',
      calculationTooltip: {
        formula: 'Salesperson Sales = \u03a3 Posted Invoice Amounts',
        components: [
          { label: 'Salespersons', value: salesBySalesperson.length.toString() },
          {
            label: 'Total Sales',
            value: formatCompactCurrency(totalSales, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC Posted Sales Invoices by salesperson code.',
    }
  }, [salesBySalesperson, currency])

  const inventoryTooltipProps = useMemo(() => {
    if (!inventorySummary) return undefined
    return {
      description: 'Snapshot of inventory position including total value and item count.',
      calculationTooltip: {
        formula: 'Total Value = \u03a3 (On-Hand Qty \u00d7 Unit Cost)',
        components: [
          { label: 'Total Items', value: inventorySummary.item_count.toLocaleString() },
          {
            label: 'Total Value',
            value: formatCompactCurrency(inventorySummary.total_inventory_value, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC Items entity.',
    }
  }, [inventorySummary, currency])

  const topCustomersTooltipProps = useMemo(() => {
    if (!topCustomers || topCustomers.length === 0) return undefined
    const totalRev = topCustomers.reduce((s, c) => s + Number(c.total_revenue), 0)
    return {
      description: 'Top customers ranked by total invoiced revenue.',
      calculationTooltip: {
        formula: 'Customer Revenue = \u03a3 Posted Invoice Amounts',
        components: [
          { label: 'Customers Shown', value: topCustomers.length.toString() },
          {
            label: 'Combined Revenue',
            value: formatCompactCurrency(totalRev, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC Posted Sales Invoices, grouped by customer.',
    }
  }, [topCustomers, currency])

  const cashPositionTooltipProps = useMemo(() => {
    if (bankAccounts.length === 0 && totalCash === 0) return undefined
    return {
      description: 'Total cash across all bank accounts registered in Business Central.',
      calculationTooltip: {
        formula: 'Total Cash = \u03a3 Bank Account Balances (LCY)',
        components: [
          { label: 'Bank Accounts', value: bankAccounts.length.toString() },
          {
            label: 'Total Cash',
            value: formatCompactCurrency(totalCash, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC Bank Accounts entity, balance in local currency.',
    }
  }, [bankAccounts, totalCash, currency])

  const arapTooltipProps = useMemo(() => {
    if (!arapSummary) return undefined
    const net = (arapSummary.total_ar || 0) - (arapSummary.total_ap || 0)
    return {
      description:
        'Summary of total accounts receivable vs. payable, showing net position and overdue amounts.',
      calculationTooltip: {
        formula: 'Net Position = Total AR \u2212 Total AP',
        components: [
          { label: 'Total AR', value: formatCompactCurrency(arapSummary.total_ar || 0, currency) },
          { label: 'Total AP', value: formatCompactCurrency(arapSummary.total_ap || 0, currency) },
          {
            label: 'AR Overdue',
            value: formatCompactCurrency(arapSummary.ar_overdue || 0, currency),
          },
          { label: 'Net Position', value: formatCompactCurrency(net, currency), highlight: true },
        ],
      },
      note: 'Source: BC Customer & Vendor Ledger Entries.',
    }
  }, [arapSummary, currency])

  return (
    <div className="@container space-y-16 max-w-[1800px] mx-auto">
      {/* ── FINANCIAL STATEMENTS ── */}
      <div>
        <div className="flex items-center gap-3 mb-8">
          <h2
            className={cn(
              'text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary'
            )}
          >
            Financial Statements
          </h2>
          <div className="h-px flex-1 section-divider-line" />
        </div>
        <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 @5xl:grid-cols-3 gap-x-12 gap-y-20')}>
          <section
            className={cn(
              'flex flex-col @3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
              isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
              sectionHover
            )}
          >
            <SectionLink href={withConnectionId('/bc/pnl')}>Profit & Loss</SectionLink>

            <div
              className={cn(
                'flex items-center justify-between gap-2 mb-6 pb-4 border-b',
                borderClass
              )}
            >
              <MiniMetric
                label="Revenue"
                value={formatCompactCurrency(pnlTotals?.totalRevenue || 0, currency)}
                color={isLight ? 'text-green-600' : 'text-green-400'}
                isLoading={pnlLoading}
                isLight={isLight}
              />
              <MiniMetric
                label="Expenses"
                value={formatCompactCurrency(totalExpensesDisplay, currency)}
                color={isLight ? 'text-red-600' : 'text-red-400'}
                isLoading={pnlLoading}
                isLight={isLight}
              />
              <MiniMetric
                label="Net Income"
                value={formatCompactCurrency(pnlTotals?.netIncome || 0, currency)}
                color={
                  (pnlTotals?.netIncome || 0) >= 0
                    ? isLight
                      ? 'text-green-600'
                      : 'text-green-400'
                    : isLight
                      ? 'text-red-600'
                      : 'text-red-400'
                }
                isLoading={pnlLoading}
                isLight={isLight}
              />
            </div>

            <div className="flex-1 min-h-[200px]">
              {trendLoading ? (
                <LoadingSpinner />
              ) : formattedTrendData.length > 0 ? (
                <EChartsLine
                  data={formattedTrendData}
                  xKey="month"
                  series={[
                    { key: 'revenue', name: 'Revenue', color: themeGreen, showArea: true },
                    { key: 'expenses', name: 'Expenses', color: themeRed, showArea: true },
                    { key: 'netIncome', name: 'Net Income', color: '#F59E0B', showArea: true },
                  ]}
                  formatY={(value) => formatPnLCurrency(value, currency)}
                  formatAxisY={formatAxisCompact}
                  showLegend={true}
                  showGrid={true}
                  height={200}
                  legendClassName=""
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm theme-text-secondary">No trend data available</p>
                </div>
              )}
            </div>
          </section>

          <section
            className={cn(
              'flex flex-col @5xl:pr-8 relative @5xl:after:absolute @5xl:after:right-0 @5xl:after:top-4 @5xl:after:bottom-4 @5xl:after:w-px',
              isLight ? '@5xl:after:bg-stone-200' : '@5xl:after:bg-white/[0.08]',
              sectionHover
            )}
          >
            <SectionLink href={withConnectionId('/bc/balance-sheet')}>Balance Sheet</SectionLink>

            <div
              className={cn(
                'flex items-center justify-between gap-2 mb-6 pb-4 border-b',
                borderClass
              )}
            >
              <MiniMetric
                label="Assets"
                value={formatCompactCurrency(bsTotals?.totalAssets || 0, currency)}
                color={isLight ? 'text-green-600' : 'text-green-400'}
                isLoading={bsLoading}
                isLight={isLight}
              />
              <MiniMetric
                label="Liabilities"
                value={formatCompactCurrency(bsTotals?.totalLiabilities || 0, currency)}
                color={isLight ? 'text-red-600' : 'text-red-400'}
                isLoading={bsLoading}
                isLight={isLight}
              />
              <MiniMetric
                label="Equity"
                value={formatCompactCurrency(bsTotals?.totalEquity || 0, currency)}
                color={isLight ? 'text-blue-600' : 'text-blue-400'}
                isLoading={bsLoading}
                isLight={isLight}
              />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center min-h-[200px]">
              {bsLoading ? (
                <LoadingSpinner color="border-emerald-500" />
              ) : balanceSheetDonutData.length > 0 ? (
                (() => {
                  const maxVal = Math.max(...balanceSheetDonutData.map((d) => d.value))
                  return (
                    <ReactECharts
                      option={{
                        backgroundColor: 'transparent',
                        animation: true,
                        animationDuration: 800,
                        animationEasing: 'cubicOut',
                        tooltip: {
                          trigger: 'item',
                          backgroundColor: isLight
                            ? 'rgba(255,255,255,0.95)'
                            : 'rgba(38,38,38,0.95)',
                          borderColor: 'transparent',
                          borderWidth: 0,
                          textStyle: { color: isLight ? '#374151' : '#e5e7eb', fontSize: 12 },
                          formatter: (params: any) => {
                            const pct =
                              maxVal > 0 ? ((params.value / maxVal) * 100).toFixed(0) : '0'
                            return `<div style="display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color}"></span><span>${params.name}</span></div><div style="font-weight:600;font-family:monospace;margin-top:4px">${formatPnLCurrency(params.value, currency)}</div>`
                          },
                        },
                        polar: {
                          radius: ['25%', '80%'],
                          center: ['50%', '50%'],
                        },
                        angleAxis: {
                          max: maxVal * 1.1,
                          show: false,
                          startAngle: 90,
                        },
                        radiusAxis: {
                          type: 'category',
                          data: [...balanceSheetDonutData].reverse().map((d) => d.name),
                          show: false,
                          axisLabel: { show: false },
                          axisTick: { show: false },
                          axisLine: { show: false },
                        },
                        series: [
                          {
                            type: 'bar',
                            coordinateSystem: 'polar',
                            data: [...balanceSheetDonutData].reverse().map((d) => ({
                              value: d.value,
                              itemStyle: {
                                color: d.color,
                                borderRadius: 0,
                              },
                              emphasis: {
                                itemStyle: {
                                  color: {
                                    type: 'linear',
                                    x: 0,
                                    y: 0,
                                    x2: 0,
                                    y2: 1,
                                    colorStops: [
                                      { offset: 0, color: d.color || '#10B981' },
                                      { offset: 1, color: `${d.color || '#10B981'}B3` },
                                    ],
                                  },
                                },
                              },
                            })),
                            itemStyle: {
                              borderRadius: 0,
                            },
                            label: {
                              show: false,
                            },
                            barWidth: '75%',
                            roundCap: false,
                            barCategoryGap: '15%',
                            showBackground: false,
                          },
                        ],
                      }}
                      style={{ width: '100%', height: 200 }}
                      opts={canvasHighDpiOpts}
                    />
                  )
                })()
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm theme-text-secondary">No data available</p>
                </div>
              )}
            </div>

            <div className="pt-3 flex items-center justify-center">
              <div className="flex flex-wrap gap-4 justify-center">
                {balanceSheetDonutData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm theme-text-secondary">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={cn('flex flex-col', sectionHover)}>
            <SectionLink href={withConnectionId('/bc/cash-flow')}>Cash Flow</SectionLink>

            <div
              className={cn(
                'flex items-center justify-between gap-2 mb-6 pb-4 border-b',
                borderClass
              )}
            >
              <MiniMetric
                label="Operating"
                value={formatCompactCurrency(cashFlowActivitySummary?.operating || 0, currency)}
                color={
                  (cashFlowActivitySummary?.operating || 0) >= 0
                    ? isLight
                      ? 'text-green-600'
                      : 'text-green-400'
                    : isLight
                      ? 'text-red-600'
                      : 'text-red-400'
                }
                isLoading={cashFlowActivityLoading}
                isLight={isLight}
              />
              <MiniMetric
                label="Investing"
                value={formatCompactCurrency(cashFlowActivitySummary?.investing || 0, currency)}
                color={
                  (cashFlowActivitySummary?.investing || 0) >= 0
                    ? isLight
                      ? 'text-green-600'
                      : 'text-green-400'
                    : isLight
                      ? 'text-red-600'
                      : 'text-red-400'
                }
                isLoading={cashFlowActivityLoading}
                isLight={isLight}
              />
              <MiniMetric
                label="Financing"
                value={formatCompactCurrency(cashFlowActivitySummary?.financing || 0, currency)}
                color={
                  (cashFlowActivitySummary?.financing || 0) >= 0
                    ? isLight
                      ? 'text-green-600'
                      : 'text-green-400'
                    : isLight
                      ? 'text-red-600'
                      : 'text-red-400'
                }
                isLoading={cashFlowActivityLoading}
                isLight={isLight}
              />
            </div>

            <div className="flex-1 min-h-[200px]">
              {cashFlowActivityLoading ? (
                <LoadingSpinner color="border-green-500" />
              ) : cashFlowByActivity.length > 0 ? (
                <CashFlowActivityChart data={cashFlowByActivity} currency={currency || 'USD'} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm theme-text-secondary">No activity data</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Strategic Insights — full width, 2-column grid of points */}
        <div className="mt-12">
          <AIAnalysisInlineSection
            html={analysisSections?.strategic ?? null}
            loading={!!analysisLoading}
            shimmerLines={3}
            className="pt-0"
            sectionType="strategic"
          />
        </div>
      </div>

      {/* ── SALES GEOGRAPHY ── */}
      <div className={cn('pt-10')}>
        <div className="flex items-center gap-3 mb-8">
          <h2
            className={cn(
              'text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary'
            )}
          >
            Sales Geography
          </h2>
          <div className="h-px flex-1 section-divider-line" />
          <div className="flex items-center gap-2">
            {salesGeoLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-500 border-t-transparent" />
            )}
            {!salesGeoLoading && salesByCountry && salesByCountry.length > 0 && (
              <span className="text-xs theme-text-secondary">
                {salesByCountry.filter((c) => c.country !== '(unknown)').length} countries
              </span>
            )}
          </div>
        </div>
        {salesGeoLoading ? (
          <div className="min-h-[300px]">
            <LoadingSpinner color="border-amber-500" />
          </div>
        ) : salesByCountry && salesByCountry.length > 0 ? (
          <EChartsWorldMap
            data={salesByCountry}
            height={500}
            formatCurrency={(v) => formatCompactCurrency(v, currency)}
          />
        ) : (
          <div className="flex items-center justify-center min-h-[300px]">
            <p className="text-sm theme-text-secondary">No sales geography data available</p>
          </div>
        )}
      </div>

      {/* ── BUSINESS HEALTH ── */}
      <div className={cn('pt-10')}>
        <div className="flex items-center gap-3 mb-8">
          <h2
            className={cn(
              'text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary'
            )}
          >
            Business Health
          </h2>
          <div className="h-px flex-1 section-divider-line" />
        </div>
        <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-20')}>
          <section
            className={cn(
              '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
              isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
              sectionHover
            )}
          >
            <FinancialHealthScoreCard
              healthScore={financialHealthScore}
              isLoading={healthScoreLoading}
              tooltipProps={healthScoreTooltipProps}
            />
          </section>
          <section className={sectionHover}>
            <Link href={withConnectionId('/bc/balance-sheet')} className="block">
              <EfficiencyMetricsCard
                metrics={efficiencyMetrics}
                isLoading={efficiencyLoading}
                currency={currency}
                tooltipProps={efficiencyTooltipProps}
              />
            </Link>
          </section>
        </div>

        <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-8 mt-12">
          {/* Forward-Looking Analysis — AI analysis inline */}
          <div
            className={cn(
              'relative',
              '@3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
              isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]'
            )}
          >
            <AIAnalysisInlineSection
              html={analysisSections?.forward ?? null}
              loading={!!analysisLoading}
              shimmerLines={3}
              className="pt-0 @3xl:pr-8"
              displayName="Business Health"
              sectionType="forward"
            />
          </div>

          {/* Prioritized Actions — AI analysis inline */}
          <AIAnalysisInlineSection
            html={analysisSections?.actions ?? null}
            loading={!!analysisLoading}
            shimmerLines={3}
            className="pt-0"
            displayName="Business Health"
            sectionType="actions"
          />
        </div>
      </div>

      {/* ── CASH & WORKING CAPITAL ── */}
      <div className={cn('pt-10')}>
        <div className="flex items-center gap-3 mb-8">
          <h2
            className={cn(
              'text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary'
            )}
          >
            Cash & Working Capital
          </h2>
          <div className="h-px flex-1 section-divider-line" />
        </div>
        <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-20')}>
          <section
            className={cn(
              '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
              isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
              sectionHover
            )}
          >
            <CashPositionSection
              bankAccounts={bankAccounts}
              totalCash={totalCash}
              bankLoading={bankLoading}
              currency={currency || 'USD'}
              isLight={isLight}
              borderClass={borderClass}
              tooltipProps={cashPositionTooltipProps}
            />
          </section>
          <section className={sectionHover}>
            <ARAPSection
              arapSummary={arapSummary}
              arapLoading={arapLoading}
              currency={currency || 'USD'}
              isLight={isLight}
              borderClass={borderClass}
              tooltipProps={arapTooltipProps}
            />
          </section>
        </div>
        <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-20 mt-16')}>
          <section
            className={cn(
              '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
              isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
              sectionHover
            )}
          >
            <Link href={withConnectionId('/bc/customers')} className="block">
              <AgedReceivablesCard
                summary={agedReceivablesSummary}
                isLoading={agedARLoading}
                currency={currency}
                tooltipProps={agedARTooltipProps}
              />
            </Link>
          </section>
          <section className={sectionHover}>
            <Link href={withConnectionId('/bc/vendors')} className="block">
              <AgedPayablesCard
                summary={agedPayablesSummary}
                isLoading={agedAPLoading}
                currency={currency}
                tooltipProps={agedAPTooltipProps}
              />
            </Link>
          </section>
        </div>
        <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-20 mt-16')}>
          <section className={sectionHover}>
            <Link href={withConnectionId('/bc/cash-flow')} className="block">
              <CashRunwayCard
                data={cashRunwayData}
                isLoading={cashRunwayLoading}
                currency={currency}
                tooltipProps={cashRunwayTooltipProps}
              />
            </Link>
          </section>
        </div>
      </div>

      {/* ── SALES PERFORMANCE ── */}
      <div className={cn('pt-10')}>
        <div className="flex items-center gap-3 mb-8">
          <h2
            className={cn(
              'text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary'
            )}
          >
            Sales Performance
          </h2>
          <div className="h-px flex-1 section-divider-line" />
        </div>
        <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-20')}>
          <section
            className={cn(
              '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
              isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
              sectionHover
            )}
          >
            <Link href={withConnectionId('/bc/customers')} className="block">
              <TopCustomersSection
                topCustomers={topCustomers}
                customersLoading={customersLoading}
                currency={currency || 'USD'}
                isLight={isLight}
                tooltipProps={topCustomersTooltipProps}
              />
            </Link>
          </section>
          <section className={sectionHover}>
            <Link href={withConnectionId('/bc/pnl')} className="block">
              <SalesBySalespersonCard
                data={salesBySalesperson}
                isLoading={salespersonLoading}
                currency={currency}
                tooltipProps={salespersonTooltipProps}
              />
            </Link>
          </section>
        </div>
        <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-20 mt-16')}>
          <section className={sectionHover}>
            <Link href={withConnectionId('/bc/pnl')} className="block">
              <MonthlyRevenueChart
                data={monthlyTrend}
                isLoading={trendLoading}
                currency={currency}
                tooltipProps={monthlyRevenueTooltipProps}
                totalRevenue={pnlTotals?.totalRevenue}
              />
            </Link>
          </section>
        </div>
      </div>

      {/* ── PROFITABILITY & RATIOS ── */}
      <div className={cn('pt-10')}>
        <div className="flex items-center gap-3 mb-8">
          <h2
            className={cn(
              'text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary'
            )}
          >
            Profitability & Ratios
          </h2>
          <div className="h-px flex-1 section-divider-line" />
        </div>
        <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-20')}>
          <section
            className={cn(
              '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
              isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
              sectionHover
            )}
          >
            <Link href={withConnectionId('/bc/pnl')} className="block">
              <PnLMarginsCard
                pnlTotals={pnlTotals}
                isLoading={pnlLoading}
                currency={currency}
                tooltipProps={marginsTooltipProps}
              />
            </Link>
          </section>
          <section className={sectionHover}>
            <Link href={withConnectionId('/bc/balance-sheet')} className="block">
              <FinancialRatiosCard
                ratios={financialRatios}
                isLoading={ratiosLoading}
                currency={currency}
                tooltipProps={ratiosTooltipProps}
              />
            </Link>
          </section>
        </div>
      </div>

      {/* ── OPERATIONS ── */}
      <div className={cn('pt-10')}>
        <div className="flex items-center gap-3 mb-8">
          <h2
            className={cn(
              'text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary'
            )}
          >
            Operations
          </h2>
          <div className="h-px flex-1 section-divider-line" />
        </div>
        <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-20')}>
          <section
            className={cn(
              '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
              isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
              sectionHover
            )}
          >
            <Link href={withConnectionId('/bc/vendors')} className="block">
              <TopVendorsCard
                vendors={topVendors}
                isLoading={vendorsLoading}
                currency={currency}
                tooltipProps={topVendorsTooltipProps}
              />
            </Link>
          </section>
          <section className={sectionHover}>
            <Link href={withConnectionId('/bc/inventory')} className="block">
              <InventoryDashboardCard
                summary={inventorySummary}
                items={inventoryItems}
                isLoading={inventoryLoading}
                currency={currency}
                tooltipProps={inventoryTooltipProps}
              />
            </Link>
          </section>
        </div>
      </div>
    </div>
  )
}
