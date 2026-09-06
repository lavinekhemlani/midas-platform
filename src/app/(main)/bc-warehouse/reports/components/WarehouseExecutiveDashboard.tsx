'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  Building2,
  Wallet,
  Users,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  ChevronRight,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPnLCurrency, formatCompactCurrency, formatAxisCurrency } from '@/lib/utils/currency'
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
} from '../hooks/useWarehouseData'
import { ChartLegend } from '@/components/charts/ChartLegend'
import { AgedReceivablesCard } from '@/app/(main)/bc/reports/components/AgedReceivablesCard'
import { AgedPayablesCard } from '@/app/(main)/bc/reports/components/AgedPayablesCard'
import { TopVendorsCard } from '@/app/(main)/bc/reports/components/TopVendorsCard'
import { PnLMarginsCard } from '@/app/(main)/bc/reports/components/PnLMarginsCard'
import { FinancialRatiosCard } from '@/app/(main)/bc/reports/components/FinancialRatiosCard'
import { MonthlyRevenueChart } from '@/app/(main)/bc/reports/components/MonthlyRevenueChart'
import { InventoryDashboardCard } from '@/app/(main)/bc/reports/components/InventoryDashboardCard'
import { CashRunwayCard } from '@/app/(main)/bc/reports/components/CashRunwayCard'
import { EfficiencyMetricsCard } from '@/app/(main)/bc/reports/components/EfficiencyMetricsCard'
import { FinancialHealthScoreCard } from '@/app/(main)/bc/reports/components/FinancialHealthScoreCard'
import { SalesBySalespersonCard } from '@/app/(main)/bc/reports/components/SalesBySalespersonCard'
import type { MonthlyCashFlowByActivity } from '@/app/(main)/bc/cash-flow/components/CashFlowByActivityCard'
import {
  useThemeEChartsConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '@/components/chat/visualizations/shared'

interface WarehouseExecutiveDashboardProps {
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
  schema?: string | null
  // Route prefix for links: '/bc' for OAuth, '/bc-warehouse' for warehouse
  routePrefix?: '/bc' | '/bc-warehouse'
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
      <span className="text-[10px] theme-text-secondary uppercase tracking-wider font-medium mb-1 whitespace-nowrap">
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
          className={cn('text-sm font-mono font-semibold tabular-nums whitespace-nowrap', color)}
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
      <span className="relative text-sm font-semibold uppercase tracking-wider theme-text-primary">
        {children}
        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
      </span>
      <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-500 group-hover:translate-x-1.5 group-hover:scale-110" />
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
  const { axisLabelStyle, splitLineStyle } = useThemeEChartsConfig()
  const [selectedSeries, setSelectedSeries] = useState<Record<string, boolean>>({})

  const operatingColor = theme === 'light' ? '#178E66' : '#2FBC8B'
  const investingColor = theme === 'light' ? '#0D54A8' : '#66A7F3'
  const financingColor = theme === 'light' ? '#7C3AED' : '#A78BFA'

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
        borderColor: theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'transparent',
        textStyle: { color: theme === 'light' ? '#374151' : '#e5e7eb', fontSize: 11 },
        axisPointer: { type: 'shadow' as const },
        formatter: (params: any[]) => {
          if (!params?.length) return ''
          const headerColor = theme === 'light' ? '#111827' : '#f8fafc'
          const labelColor = theme === 'light' ? '#6b7280' : '#94a3b8'
          const positiveColor = theme === 'light' ? '#178E66' : '#2FBC8B'
          const negativeColor = theme === 'light' ? '#D51323' : '#EE3D4C'
          const borderColor = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
          let html = `<div style="font-weight:600;margin-bottom:6px;color:${headerColor}">${params[0].axisValue}</div>`
          let total = 0
          params.forEach((p: any) => {
            total += p.value || 0
            const c = p.value >= 0 ? positiveColor : negativeColor
            html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:1px 0">
            <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${p.color}"></span><span style="color:${labelColor}">${p.seriesName}</span></span>
            <span style="font-weight:600;font-family:monospace;color:${c}">${formatPnLCurrency(p.value, currency)}</span></div>`
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
        axisLabel: { ...axisLabelStyle, fontSize: 9 },
        axisLine: { lineStyle: { color: splitLineStyle.color } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { ...axisLabelStyle, formatter: formatAxisCurrency(currency) },
        splitLine: { lineStyle: { color: splitLineStyle.color, type: 'dashed' } },
      },
      series: [
        {
          name: 'Operating',
          type: 'bar',
          stack: 'cf',
          data: sorted.map((d) => d.operating),
          itemStyle: { color: operatingColor },
          barMaxWidth: 32,
        },
        {
          name: 'Investing',
          type: 'bar',
          stack: 'cf',
          data: sorted.map((d) => d.investing),
          itemStyle: { color: investingColor },
          barMaxWidth: 32,
        },
        {
          name: 'Financing',
          type: 'bar',
          stack: 'cf',
          data: sorted.map((d) => d.financing),
          itemStyle: { color: financingColor, borderRadius: 0 },
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
      axisLabelStyle,
      splitLineStyle,
      selectedSeries,
    ]
  )

  return (
    <div>
      <ReactECharts
        option={option}
        style={{ width: '100%', height: 200 }}
        opts={canvasHighDpiOpts}
      />
      <ChartLegend items={legendItems} selected={selectedSeries} onToggle={handleLegendToggle} />
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
}: {
  arapSummary: ARAPSummary | null
  arapLoading: boolean
  currency: string
  isLight: boolean
  borderClass: string
}) {
  const ar = arapSummary?.total_ar || 0
  const ap = arapSummary?.total_ap || 0
  const overdue = arapSummary?.ar_overdue || 0
  const netPosition = ar - ap
  const overduePercent = ar > 0 ? (overdue / ar) * 100 : 0
  const arBarPercent = ar + ap > 0 ? (ar / (ar + ap)) * 100 : 50

  const textMutedClass = 'text-stone-500'
  const heading = (
    <div className="mb-5">
      <span
        className={cn(
          'relative text-[14px] font-semibold uppercase tracking-wider',
          isLight ? 'text-stone-800' : 'text-stone-300'
        )}
      >
        Receivables & Payables
        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
      </span>
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
                'text-[10px] uppercase tracking-wider font-medium mb-1',
                textMutedClass
              )}
            >
              Receivable
            </div>
            <div
              className={cn(
                'text-lg font-mono font-semibold tabular-nums leading-tight',
                isLight ? 'text-green-600' : 'text-green-400'
              )}
            >
              {formatCompactCurrency(ar, currency)}
            </div>
            <div className={cn('text-[10px] mt-0.5', textMutedClass)}>
              {arapSummary.customer_count} customers
            </div>
          </div>
          <div className={cn('p-3', isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]')}>
            <div
              className={cn(
                'text-[10px] uppercase tracking-wider font-medium mb-1',
                textMutedClass
              )}
            >
              Payable
            </div>
            <div
              className={cn(
                'text-lg font-mono font-semibold tabular-nums leading-tight',
                isLight ? 'text-red-600' : 'text-red-400'
              )}
            >
              {formatCompactCurrency(ap, currency)}
            </div>
            <div className={cn('text-[10px] mt-0.5', textMutedClass)}>
              {arapSummary.vendor_count} vendors
            </div>
          </div>
        </div>

        {/* AR vs AP visual bar */}
        <div>
          <div className={cn('flex items-center justify-between text-[10px] mb-1', textMutedClass)}>
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
                backgroundColor: isLight ? '#178E66' : '#2FBC8B',
              }}
            />
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${100 - arBarPercent}%`,
                backgroundColor: isLight ? '#D51323' : '#EE3D4C',
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
                <span className="text-xs theme-text-secondary">Overdue</span>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 font-mono font-semibold tabular-nums',
                    isLight ? 'bg-red-100 text-red-600' : 'bg-red-500/10 text-red-400'
                  )}
                >
                  {overduePercent.toFixed(0)}%
                </span>
              </div>
              <span
                className={cn(
                  'text-xs font-mono font-semibold tabular-nums',
                  isLight ? 'text-red-600' : 'text-red-400'
                )}
              >
                {formatCompactCurrency(overdue, currency)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs font-medium theme-text-secondary">Net Position</span>
            <span
              className={cn(
                'text-sm font-mono font-bold tabular-nums',
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
}: {
  bankAccounts: BankAccountRow[]
  totalCash: number
  bankLoading: boolean
  currency: string
  isLight: boolean
  borderClass: string
}) {
  const textMutedClass = 'text-stone-500'
  const cashHeading = (
    <span
      className={cn(
        'relative text-[14px] font-semibold uppercase tracking-wider',
        isLight ? 'text-stone-800' : 'text-stone-300'
      )}
    >
      Cash Position
      <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
    </span>
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
      <div className="flex items-center justify-between mb-5">
        {cashHeading}
        <span
          className={cn(
            'text-sm font-mono font-semibold tabular-nums',
            isLight ? 'text-green-600' : 'text-green-400'
          )}
        >
          {formatCompactCurrency(totalCash, currency)}
        </span>
      </div>

      {bankAccounts.length > 0 ? (
        <div className="space-y-2">
          {bankAccounts.slice(0, 5).map((bank) => (
            <div
              key={bank.no}
              className={cn('flex items-center justify-between gap-2 py-1.5 px-2 -mx-2 text-xs')}
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
          {bankAccounts.length > 5 && (
            <p className={cn('text-xs text-center pt-1', textMutedClass)}>
              +{bankAccounts.length - 5} more accounts
            </p>
          )}
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
}: {
  topCustomers: TopCustomerRow[]
  customersLoading: boolean
  currency: string
  isLight: boolean
}) {
  const maxCustomerRevenue =
    topCustomers.length > 0 ? Math.max(...topCustomers.map((c) => Number(c.total_revenue))) : 0

  const textMutedClass = 'text-stone-500'
  const sectionHeadingClass = cn(
    'text-[14px] font-semibold uppercase tracking-wider mb-5',
    isLight ? 'text-stone-800' : 'text-stone-300'
  )

  const linkedHeading = (title: string) => (
    <div className="flex items-center justify-between mb-5">
      <span
        className={cn(
          'relative text-[14px] font-semibold uppercase tracking-wider',
          isLight ? 'text-stone-800' : 'text-stone-300'
        )}
      >
        {title}
        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
      </span>
      <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-500 group-hover:translate-x-1.5 group-hover:scale-110" />
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
                  className="text-xs theme-text-secondary truncate flex-1"
                  title={customer.name}
                >
                  {customer.name.length > 28
                    ? customer.name.substring(0, 28) + '...'
                    : customer.name}
                </span>
                <span className="text-xs font-mono font-semibold tabular-nums theme-text-primary whitespace-nowrap">
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

export function WarehouseExecutiveDashboard({
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
  currency = 'USD',
  schema,
  routePrefix = '/bc-warehouse',
}: WarehouseExecutiveDashboardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const borderClass = isLight ? 'border-stone-200' : 'border-white/[0.08]'
  const sectionHover = cn(
    'group relative -mx-3 px-3 -mt-4 pt-4 -mb-6 pb-6',
    "before:content-[''] before:absolute before:inset-y-2 before:inset-x-1 before:rounded-[1px] before:-z-[1] before:transition-colors before:duration-200",
    isLight ? 'hover:before:bg-black/[0.03]' : 'hover:before:bg-white/[0.03]'
  )

  // Helper to build links with correct prefix and query param
  const withSchema = (path: string) => {
    const finalPath = path.replace(/^\/bc\//, `${routePrefix}/`)
    if (!schema || schema === 'default') return finalPath
    const paramName = routePrefix === '/bc-warehouse' ? 'schema' : 'connectionId'
    return `${finalPath}?${paramName}=${schema}`
  }

  // Theme-aware chart colors
  const themeGreen = theme === 'light' ? '#178E66' : '#2FBC8B'
  const themeRed = theme === 'light' ? '#D51323' : '#EE3D4C'

  // Combined expenses for display
  const totalExpensesDisplay = pnlTotals ? pnlTotals.totalCOGS + pnlTotals.totalExpenses : 0

  // Format monthly trend data for EChartsLine
  const formattedTrendData = useMemo(() => {
    return monthlyTrend.map((row) => {
      const date = new Date(row.month)
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      return {
        month: monthLabel,
        revenue: row.revenue,
        expenses: row.cogs + row.expenses,
        netIncome: row.net_income,
      }
    })
  }, [monthlyTrend])

  // Balance Sheet donut data
  const balanceSheetDonutData = useMemo(() => {
    if (!bsTotals) return []
    return [
      { name: 'Assets', value: Math.abs(bsTotals.totalAssets), color: '#10b981' },
      { name: 'Liabilities', value: Math.abs(bsTotals.totalLiabilities), color: '#ef4444' },
      { name: 'Equity', value: Math.abs(bsTotals.totalEquity), color: '#3b82f6' },
    ].filter((item) => item.value > 0)
  }, [bsTotals])

  return (
    <div className="@container space-y-6 max-w-[1800px] mx-auto">
      {/* Row 1: P&L + Balance Sheet + Cash Flow */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-3 gap-8')}>
        <section
          className={cn(
            '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
            isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
            sectionHover
          )}
        >
          <SectionLink href={withSchema('/bc/pnl')}>Profit & Loss</SectionLink>

          <div
            className={cn(
              'flex items-center justify-between gap-2 mb-4 pb-3 border-b',
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

          <div className="min-h-[220px]">
            {trendLoading ? (
              <LoadingSpinner />
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
                height={220}
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
            '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
            isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
            sectionHover
          )}
        >
          <SectionLink href={withSchema('/bc/balance-sheet')}>Balance Sheet</SectionLink>

          <div
            className={cn(
              'flex items-center justify-between gap-2 mb-4 pb-3 border-b',
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

          <div className="flex flex-col items-center justify-center min-h-[220px]">
            {bsLoading ? (
              <LoadingSpinner color="border-emerald-500" />
            ) : balanceSheetDonutData.length > 0 ? (
              <div className="w-full flex flex-col items-center">
                <EChartsPie
                  data={balanceSheetDonutData}
                  innerRadius="45%"
                  outerRadius="70%"
                  showLabels={false}
                  showLegend={false}
                  showCenterTotal={false}
                  formatValue={(value) => formatPnLCurrency(value, currency)}
                  height={150}
                  enableEmphasis={true}
                  colors={['#10b981', '#ef4444', '#3b82f6']}
                />
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
                  {balanceSheetDonutData.map((item) => {
                    const total = balanceSheetDonutData.reduce((sum, d) => sum + d.value, 0)
                    const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
                    return (
                      <div key={item.name} className="flex items-center gap-2 text-xs">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="theme-text-secondary">{item.name}:</span>
                        <span className="theme-text-primary font-mono font-semibold tabular-nums">
                          {formatPnLCurrency(item.value, currency)}
                        </span>
                        <span className="theme-text-secondary">({percentage}%)</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm theme-text-secondary">No data available</p>
              </div>
            )}
          </div>
        </section>

        <section className={sectionHover}>
          <SectionLink href={withSchema('/bc/cash-flow')}>Cash Flow</SectionLink>

          <div
            className={cn(
              'flex items-center justify-between gap-2 mb-4 pb-3 border-b',
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

          <div className="min-h-[220px]">
            {cashFlowActivityLoading ? (
              <LoadingSpinner color="border-green-500" />
            ) : cashFlowByActivity.length > 0 ? (
              <CashFlowActivityChart data={cashFlowByActivity} currency={currency} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm theme-text-secondary">No activity data</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Row 2: Sales Geography (full width) */}
      <div className={cn('pt-6 border-t', borderClass)}>
        <div className="flex items-center justify-between mb-5">
          <span
            className={cn(
              'relative text-[14px] font-semibold uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Sales Geography
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
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
            height={420}
            formatCurrency={(v) => formatCompactCurrency(v, currency)}
          />
        ) : (
          <div className="flex items-center justify-center min-h-[300px]">
            <p className="text-sm theme-text-secondary">No sales geography data available</p>
          </div>
        )}
      </div>

      {/* Row 3: Cash Position + AR/AP */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6 border-t', borderClass)}>
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
            currency={currency}
            isLight={isLight}
            borderClass={borderClass}
          />
        </section>
        <section className={sectionHover}>
          <ARAPSection
            arapSummary={arapSummary}
            arapLoading={arapLoading}
            currency={currency}
            isLight={isLight}
            borderClass={borderClass}
          />
        </section>
      </div>

      {/* Row 4: Top Customers + Top Vendors */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6 border-t', borderClass)}>
        <section
          className={cn(
            '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
            isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
            sectionHover
          )}
        >
          <Link href={withSchema('/bc/customers')} className="block">
            <TopCustomersSection
              topCustomers={topCustomers}
              customersLoading={customersLoading}
              currency={currency}
              isLight={isLight}
            />
          </Link>
        </section>
        <section className={sectionHover}>
          <Link href={withSchema('/bc/vendors')} className="block">
            <TopVendorsCard vendors={topVendors} isLoading={vendorsLoading} currency={currency} />
          </Link>
        </section>
      </div>

      {/* Row 5: Aged Receivables + Aged Payables */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6 border-t', borderClass)}>
        <section
          className={cn(
            '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
            isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
            sectionHover
          )}
        >
          <Link href={withSchema('/bc/customers')} className="block">
            <AgedReceivablesCard
              summary={agedReceivablesSummary}
              isLoading={agedARLoading}
              currency={currency}
            />
          </Link>
        </section>
        <section className={sectionHover}>
          <Link href={withSchema('/bc/vendors')} className="block">
            <AgedPayablesCard
              summary={agedPayablesSummary}
              isLoading={agedAPLoading}
              currency={currency}
            />
          </Link>
        </section>
      </div>

      {/* Row 6: P&L Margins + Financial Ratios */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6 border-t', borderClass)}>
        <section
          className={cn(
            '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
            isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
            sectionHover
          )}
        >
          <Link href={withSchema('/bc/pnl')} className="block">
            <PnLMarginsCard pnlTotals={pnlTotals} isLoading={pnlLoading} currency={currency} />
          </Link>
        </section>
        <section className={sectionHover}>
          <Link href={withSchema('/bc/balance-sheet')} className="block">
            <FinancialRatiosCard
              ratios={financialRatios}
              isLoading={ratiosLoading}
              currency={currency}
            />
          </Link>
        </section>
      </div>

      {/* Row 7: Efficiency Metrics + Financial Health */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6 border-t', borderClass)}>
        <section
          className={cn(
            '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
            isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
            sectionHover
          )}
        >
          <Link href={withSchema('/bc/balance-sheet')} className="block">
            <EfficiencyMetricsCard metrics={efficiencyMetrics} isLoading={efficiencyLoading} />
          </Link>
        </section>
        <section className={sectionHover}>
          <FinancialHealthScoreCard
            healthScore={financialHealthScore}
            isLoading={healthScoreLoading}
          />
        </section>
      </div>

      {/* Row 8: Cash Runway + Monthly Revenue */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6 border-t', borderClass)}>
        <section
          className={cn(
            '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
            isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
            sectionHover
          )}
        >
          <Link href={withSchema('/bc/cash-flow')} className="block">
            <CashRunwayCard
              data={cashRunwayData}
              isLoading={cashRunwayLoading}
              currency={currency}
            />
          </Link>
        </section>
        <section className={sectionHover}>
          <Link href={withSchema('/bc/pnl')} className="block">
            <MonthlyRevenueChart
              data={monthlyRevenue}
              isLoading={revenueLoading}
              currency={currency}
            />
          </Link>
        </section>
      </div>

      {/* Row 9: Sales by Salesperson + Inventory */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6 border-t', borderClass)}>
        <section
          className={cn(
            '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
            isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
            sectionHover
          )}
        >
          <Link href={withSchema('/bc/pnl')} className="block">
            <SalesBySalespersonCard
              data={salesBySalesperson}
              isLoading={salespersonLoading}
              currency={currency}
            />
          </Link>
        </section>
        <section className={sectionHover}>
          <Link href={withSchema('/bc/inventory')} className="block">
            <InventoryDashboardCard
              summary={inventorySummary}
              items={inventoryItems}
              isLoading={inventoryLoading}
              currency={currency}
            />
          </Link>
        </section>
      </div>
    </div>
  )
}
