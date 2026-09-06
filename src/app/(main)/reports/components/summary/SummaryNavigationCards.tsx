'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPnLCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { EChartsLine } from '@/components/charts/echarts'
import { useViewTransitionRouter } from '@/hooks/useViewTransitionRouter'
import { useSearchParams } from 'next/navigation'
import { useTheme } from '@/hooks/useTheme'
import { BalanceSheetWaterfall } from '@/components/reports/summary/BalanceSheetWaterfall'
import { ChartLegend } from '@/components/charts/ChartLegend'
import {
  useThemeEChartsConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '@/components/chat/visualizations/shared'

interface PnLMetrics {
  totalRevenue?: number
  totalExpenses?: number
  netIncome?: number
}

interface BalanceSheetMetrics {
  totalAssets?: number
  totalLiabilities?: number
  totalEquity?: number
}

interface CashFlowMetrics {
  cashEnding?: number
  operatingCashFlow?: number
  netCashFlow?: number
}

interface TrendDataItem {
  month: string
  revenue?: number
  expenses?: number
  netIncome?: number
  operating?: number
  investing?: number
  financing?: number
  totalCash?: number
}

interface SummaryNavigationCardsProps {
  pnlMetrics: PnLMetrics
  bsMetrics: BalanceSheetMetrics
  cfMetrics: CashFlowMetrics
  pnlLoading: boolean
  bsLoading: boolean
  cfLoading: boolean
  pnlLastUpdated?: string
  balanceSheetLastUpdated?: string
  cashFlowLastUpdated?: string
  periodMonths: number
  currency?: string
  pnlError?: any
  bsError?: any
  cfError?: any
  onRetryPnL?: () => void
  onRetryBS?: () => void
  onRetryCF?: () => void
  // Chart data props
  pnlTrendData?: TrendDataItem[]
  cfTrendData?: TrendDataItem[]
  pnlTrendLoading?: boolean
  cfTrendLoading?: boolean
  isSingleMonth?: boolean
  // New styling props
  sectionHover?: string
  isLight?: boolean
}

// Mini metric component for horizontal display - center aligned like design
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
        <span className={cn('inline-block w-20 h-6 animate-pulse', isLight ? 'bg-stone-200/60' : 'bg-gray-700/30')} />
      ) : (
        <span className={cn('text-base font-mono font-semibold tabular-nums whitespace-nowrap', color)}>{value}</span>
      )}
    </div>
  )
}

const CF_OPERATING_COLOR = '#2BB5C6'
const CF_INVESTING_COLOR = '#E879A0'
const CF_FINANCING_COLOR = '#F59E42'
const CF_LEGEND_ITEMS = [
  { name: 'Operating', color: CF_OPERATING_COLOR },
  { name: 'Investing', color: CF_INVESTING_COLOR },
  { name: 'Financing', color: CF_FINANCING_COLOR },
]

function CashFlowChart({ data, currency, theme, axisLabelStyle, splitLineStyle }: {
  data: any[]
  currency: string
  theme: string
  axisLabelStyle: any
  splitLineStyle: any
}) {
  const [selectedSeries, setSelectedSeries] = useState<Record<string, boolean>>({})
  const handleToggle = (name: string) => {
    setSelectedSeries((prev) => ({ ...prev, [name]: prev[name] === false ? true : false }))
  }

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 300,
    animationEasing: 'quarticOut',
    animationDurationUpdate: 300,
    animationEasingUpdate: 'quarticOut',
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: theme === 'light' ? 'rgba(255,255,255,0.95)' : 'rgba(38,38,38,0.95)',
      borderColor: 'transparent',
      borderWidth: 0,
      textStyle: { color: theme === 'light' ? '#374151' : '#e5e7eb', fontSize: 12 },
      axisPointer: { type: 'line' as const, lineStyle: { color: 'transparent' } },
      formatter: (params: any[]) => {
        if (!params?.length) return ''
        const hc = theme === 'light' ? '#111827' : '#f8fafc'
        const lc = theme === 'light' ? '#6b7280' : '#94a3b8'
        let html = `<div style="font-weight:600;margin-bottom:6px;color:${hc}">${params[0].axisValue}</div>`
        let total = 0
        params.forEach((p: any) => {
          total += p.value || 0
          const vc = p.value >= 0 ? '#10B981' : '#EF4444'
          html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:1px 0"><span style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span><span style="color:${lc}">${p.seriesName}</span></span><span style="font-weight:500;font-family:monospace;color:${vc}">${formatPnLCurrency(p.value, currency)}</span></div>`
        })
        const bc = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
        html += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid ${bc};display:flex;justify-content:space-between;gap:12px"><span style="color:${lc}">Net</span><span style="font-weight:700;font-family:monospace;color:${total >= 0 ? '#10B981' : '#EF4444'}">${formatPnLCurrency(total, currency)}</span></div>`
        return html
      },
    },
    legend: { show: false, data: ['Operating', 'Investing', 'Financing'], selected: selectedSeries },
    grid: { left: '3%', right: '3%', bottom: '3%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: data.map((d) => d.month),
      axisLabel: { color: axisLabelStyle.color, fontSize: 11 },
      axisLine: { lineStyle: { color: axisLabelStyle.color } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: axisLabelStyle.color, fontSize: 11 },
      splitLine: { lineStyle: { color: splitLineStyle.color, type: 'dashed' } },
    },
    series: [
      { name: 'Operating', type: 'bar', stack: 'cf', data: data.map((d) => d.operating), itemStyle: { color: CF_OPERATING_COLOR }, barMaxWidth: 32 },
      { name: 'Investing', type: 'bar', stack: 'cf', data: data.map((d) => d.investing), itemStyle: { color: CF_INVESTING_COLOR }, barMaxWidth: 32 },
      { name: 'Financing', type: 'bar', stack: 'cf', data: data.map((d) => d.financing), itemStyle: { color: CF_FINANCING_COLOR }, barMaxWidth: 32 },
    ],
  }), [data, currency, theme, axisLabelStyle, splitLineStyle, selectedSeries])

  return (
    <div className="flex flex-col">
      <ReactECharts option={option} style={{ width: '100%', height: 200 }} opts={canvasHighDpiOpts} />
      <div className="h-8 flex items-center justify-center">
        <ChartLegend items={CF_LEGEND_ITEMS} selected={selectedSeries} onToggle={handleToggle} className="pt-0" />
      </div>
    </div>
  )
}

export function SummaryNavigationCards({
  pnlMetrics,
  bsMetrics,
  cfMetrics,
  pnlLoading,
  bsLoading,
  cfLoading,
  pnlLastUpdated,
  balanceSheetLastUpdated,
  cashFlowLastUpdated,
  periodMonths,
  currency = 'USD',
  pnlError,
  bsError,
  cfError,
  onRetryPnL,
  onRetryBS,
  onRetryCF,
  pnlTrendData,
  cfTrendData,
  pnlTrendLoading,
  cfTrendLoading,
  isSingleMonth = false,
  sectionHover,
  isLight,
}: SummaryNavigationCardsProps) {
  const { navigate } = useViewTransitionRouter()
  const searchParams = useSearchParams()
  const realmId = searchParams.get('realmId')
  const { theme } = useTheme()
  const { axisLabelStyle, splitLineStyle } = useThemeEChartsConfig()

  // Theme-aware colors for charts
  const themeBlue = theme === 'light' ? '#0D54A8' : '#66A7F3'
  const themeRed = theme === 'light' ? '#D51323' : '#EE3D4C'
  const themeGreen = theme === 'light' ? '#178E66' : '#2FBC8B'
  const themeYellow = theme === 'light' ? '#CF6900' : '#FF8100'
  const themePurple = theme === 'light' ? '#6F1CBD' : '#BF92E9'

  // Handler for navigating to report pages with view transition
  const handleNavigate = (href: string) => {
    const url = realmId ? `${href}?realmId=${realmId}` : href
    navigate(url, { type: 'fade' })
  }

  // Single-month waterfall chart: Revenue → Expenses → Net Income
  // Shows a simplified P&L flow for single month periods
  const singleMonthWaterfallOption = useMemo(() => {
    if (!isSingleMonth) return null

    const totalRevenue = pnlMetrics.totalRevenue || 0
    const totalExpenses = pnlMetrics.totalExpenses || 0
    const netIncome = pnlMetrics.netIncome || 0

    // Build waterfall steps (simplified version for summary card)
    const steps = [
      { name: 'Revenue', value: totalRevenue, type: 'total' as const },
      { name: 'Expenses', value: -Math.abs(totalExpenses), type: 'deduction' as const },
      { name: 'Net Income', value: netIncome, type: 'total' as const },
    ]

    // Calculate invisible base for each bar (the "floating" effect)
    const bases: number[] = []
    const values: number[] = []

    steps.forEach((step, index) => {
      if (step.type === 'total') {
        bases.push(0)
        values.push(step.value)
      } else {
        // Deduction: floats from the previous bar
        const absVal = Math.abs(step.value)
        const prevTotal = values[values.length - 1]
        const prevBase = bases[bases.length - 1]
        const startPoint = prevBase + prevTotal - absVal
        bases.push(startPoint)
        values.push(absVal)
      }
    })

    const getBarColor = (step: (typeof steps)[0]) => {
      if (step.type === 'deduction') return themeRed
      if (step.name === 'Net Income') return netIncome >= 0 ? themeGreen : themeRed
      return themeGreen
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'transparent',
        borderWidth: 0,
        textStyle: { color: '#e5e7eb', fontSize: 12 },
        formatter: (params: any[]) => {
          const visible = params.find((p: any) => p.seriesIndex === 1)
          if (!visible) return ''
          const step = steps[visible.dataIndex]
          const displayValue = step.type === 'deduction' ? step.value : step.value
          return `
            <div style="display:flex;align-items:center;gap:8px;padding:2px 0">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${getBarColor(step)}"></span>
              <span style="color:#94a3b8">${step.name}</span>
              <span style="font-weight:600;font-family:monospace;color:#f8fafc;margin-left:auto">
                ${formatPnLCurrency(displayValue, currency)}
              </span>
            </div>
          `
        },
      },
      legend: { show: false },
      grid: {
        left: '3%',
        right: '3%',
        bottom: '3%',
        top: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: steps.map((s) => s.name),
        axisLabel: {
          ...axisLabelStyle,
          fontSize: 11,
          interval: 0,
        },
        axisLine: { lineStyle: { color: splitLineStyle.color } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          ...axisLabelStyle,
          formatter: (v: number) => formatCompactCurrency(v, currency),
        },
        splitLine: { lineStyle: { color: splitLineStyle.color } },
      },
      series: [
        // Invisible base (transparent)
        {
          name: 'Base',
          type: 'bar',
          stack: 'waterfall',
          data: bases,
          itemStyle: { color: 'transparent' },
          emphasis: { itemStyle: { color: 'transparent' } },
          tooltip: { show: false },
        },
        // Visible bars
        {
          name: 'Amount',
          type: 'bar',
          stack: 'waterfall',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: getBarColor(steps[i]),
              borderRadius: steps[i].type === 'deduction' ? [0, 0, 4, 4] : [4, 4, 0, 0],
            },
          })),
          barWidth: '45%',
          label: {
            show: true,
            position: 'top' as const,
            formatter: (params: any) => {
              const step = steps[params.dataIndex]
              return formatCompactCurrency(step.value, currency)
            },
            fontSize: 11,
            fontWeight: 600,
            color: theme === 'light' ? 'rgba(55, 65, 81, 0.85)' : 'rgba(226, 232, 240, 0.85)',
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
          },
        },
      ],
    }
  }, [
    isSingleMonth,
    pnlMetrics,
    themeGreen,
    themeRed,
    theme,
    axisLabelStyle,
    splitLineStyle,
    currency,
  ])

  // Single-month waterfall chart for Cash Flow: Operating → Investing → Financing → Net Cash
  // Shows the components that make up net cash flow for single month periods
  const singleMonthCashFlowWaterfallOption = useMemo(() => {
    if (!isSingleMonth) return null

    // Get values from trend data if available (single data point), otherwise use cfMetrics
    const operating = cfTrendData?.[0]?.operating ?? cfMetrics.operatingCashFlow ?? 0
    const investing = cfTrendData?.[0]?.investing ?? 0
    const financing = cfTrendData?.[0]?.financing ?? 0
    const netCash = cfTrendData?.[0]?.totalCash ?? cfMetrics.netCashFlow ?? 0

    // Build waterfall steps for cash flow components
    const steps = [
      { name: 'Operating', value: operating, type: 'component' as const },
      { name: 'Investing', value: investing, type: 'component' as const },
      { name: 'Financing', value: financing, type: 'component' as const },
      { name: 'Net Cash', value: netCash, type: 'total' as const },
    ]

    // Calculate invisible base for each bar (the "floating" effect)
    // For cash flow, we show each component stacked to form the total
    const bases: number[] = []
    const values: number[] = []
    let runningTotal = 0

    steps.forEach((step) => {
      if (step.type === 'total') {
        // Net Cash total bar starts from 0
        bases.push(0)
        values.push(step.value)
      } else {
        // Component bars stack on each other
        if (step.value >= 0) {
          bases.push(runningTotal)
          values.push(step.value)
          runningTotal += step.value
        } else {
          // Negative value: bar goes down from current position
          bases.push(runningTotal + step.value)
          values.push(Math.abs(step.value))
          runningTotal += step.value
        }
      }
    })

    const getBarColor = (step: (typeof steps)[0]) => {
      if (step.name === 'Operating') return step.value >= 0 ? themeGreen : themeRed
      if (step.name === 'Investing') return step.value >= 0 ? themeYellow : themeRed
      if (step.name === 'Financing') return step.value >= 0 ? themePurple : themeRed
      if (step.name === 'Net Cash') return step.value >= 0 ? themeBlue : themeRed
      return themeBlue
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'transparent',
        borderWidth: 0,
        textStyle: { color: '#e5e7eb', fontSize: 12 },
        formatter: (params: any[]) => {
          const visible = params.find((p: any) => p.seriesIndex === 1)
          if (!visible) return ''
          const step = steps[visible.dataIndex]
          return `
            <div style="display:flex;align-items:center;gap:8px;padding:2px 0">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${getBarColor(step)}"></span>
              <span style="color:#94a3b8">${step.name}</span>
              <span style="font-weight:600;font-family:monospace;color:#f8fafc;margin-left:auto">
                ${formatPnLCurrency(step.value, currency)}
              </span>
            </div>
          `
        },
      },
      legend: { show: false },
      grid: {
        left: '3%',
        right: '3%',
        bottom: '3%',
        top: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: steps.map((s) => s.name),
        axisLabel: {
          ...axisLabelStyle,
          fontSize: 11,
          interval: 0,
        },
        axisLine: { lineStyle: { color: splitLineStyle.color } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          ...axisLabelStyle,
          formatter: (v: number) => formatCompactCurrency(v, currency),
        },
        splitLine: { lineStyle: { color: splitLineStyle.color } },
      },
      series: [
        // Invisible base (transparent)
        {
          name: 'Base',
          type: 'bar',
          stack: 'waterfall',
          data: bases,
          itemStyle: { color: 'transparent' },
          emphasis: { itemStyle: { color: 'transparent' } },
          tooltip: { show: false },
        },
        // Visible bars
        {
          name: 'Amount',
          type: 'bar',
          stack: 'waterfall',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: getBarColor(steps[i]),
              borderRadius: [4, 4, 4, 4],
            },
          })),
          barWidth: '45%',
          label: {
            show: true,
            position: 'top' as const,
            formatter: (params: any) => {
              const step = steps[params.dataIndex]
              return formatCompactCurrency(step.value, currency)
            },
            fontSize: 11,
            fontWeight: 600,
            color: theme === 'light' ? 'rgba(55, 65, 81, 0.85)' : 'rgba(226, 232, 240, 0.85)',
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
          },
        },
      ],
    }
  }, [
    isSingleMonth,
    cfTrendData,
    cfMetrics,
    themeGreen,
    themeRed,
    themeYellow,
    themePurple,
    themeBlue,
    theme,
    axisLabelStyle,
    splitLineStyle,
    currency,
  ])

  // Prepare Balance Sheet donut data - using same colors as P&L and Cash Flow charts
  const balanceSheetDonutData = [
    { name: 'Assets', value: Math.abs(bsMetrics.totalAssets || 0), color: '#10B981' },
    { name: 'Liabilities', value: Math.abs(bsMetrics.totalLiabilities || 0), color: '#EF4444' },
    { name: 'Equity', value: Math.abs(bsMetrics.totalEquity || 0), color: '#2BB5C6' },
  ].filter((item) => item.value > 0)

  return (
    <>
      {/* P&L Report Card with Chart */}
      <section
        className={cn(
          'flex flex-col',
          sectionHover,
          '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
          isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]'
        )}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleNavigate('/reports/pnl')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleNavigate('/reports/pnl')
            }
          }}
          className="group flex items-center justify-between mb-6 cursor-pointer focus:outline-none"
        >
          <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
            Profit & Loss
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>

        {pnlError ? (
          <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
            <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
            <p className="text-sm text-red-400 mb-2">
              {pnlError.status === 429 ? 'Rate limited' : 'Failed to load'}
            </p>
            {onRetryPnL && (
              <Button variant="ghost" size="sm" onClick={onRetryPnL} className="h-8 px-3 text-xs gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className={cn('flex items-center justify-between gap-2 mb-6 pb-4 border-b', isLight ? 'border-stone-200' : 'border-white/[0.08]')}>
              <MiniMetric label="Revenue" value={formatCompactCurrency(pnlMetrics.totalRevenue || 0, currency)} color={isLight ? 'text-green-600' : 'text-green-400'} isLoading={pnlLoading} isLight={isLight} />
              <MiniMetric label="Expenses" value={formatCompactCurrency(pnlMetrics.totalExpenses || 0, currency)} color={isLight ? 'text-red-600' : 'text-red-400'} isLoading={pnlLoading} isLight={isLight} />
              <MiniMetric label="Net Income" value={formatCompactCurrency(pnlMetrics.netIncome || 0, currency)} color={(pnlMetrics.netIncome || 0) >= 0 ? (isLight ? 'text-green-600' : 'text-green-400') : (isLight ? 'text-red-600' : 'text-red-400')} isLoading={pnlLoading} isLight={isLight} />
            </div>

            <div className="flex-1 min-h-[200px]">
              {pnlTrendLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                </div>
              ) : isSingleMonth && singleMonthWaterfallOption ? (
                <div className="w-full h-full flex items-center justify-center">
                  <ReactECharts option={singleMonthWaterfallOption} style={{ width: '100%', height: 220 }} opts={canvasHighDpiOpts} />
                </div>
              ) : pnlTrendData && pnlTrendData.length > 0 ? (
                <EChartsLine
                  data={pnlTrendData}
                  xKey="month"
                  series={[
                    { key: 'revenue', name: 'Revenue', color: themeGreen, showArea: true },
                    { key: 'expenses', name: 'Expenses', color: themeRed, showArea: true },
                    { key: 'netIncome', name: 'Net Income', color: '#f59e0b', showArea: true },
                  ]}
                  formatY={(value) => formatPnLCurrency(value, currency)}
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
          </>
        )}
      </section>

      {/* Balance Sheet Report Card with Donut Chart */}
      <section
        className={cn(
          'flex flex-col',
          sectionHover,
          '@5xl:pr-8 relative @5xl:after:absolute @5xl:after:right-0 @5xl:after:top-4 @5xl:after:bottom-4 @5xl:after:w-px',
          isLight ? '@5xl:after:bg-stone-200' : '@5xl:after:bg-white/[0.08]'
        )}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleNavigate('/reports/balance-sheet')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleNavigate('/reports/balance-sheet')
            }
          }}
          className="group flex items-center justify-between mb-6 cursor-pointer focus:outline-none"
        >
          <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
            Balance Sheet
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>

        {bsError ? (
          <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
            <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
            <p className="text-sm text-red-400 mb-2">
              {bsError.status === 429 ? 'Rate limited' : 'Failed to load'}
            </p>
            {onRetryBS && (
              <Button variant="ghost" size="sm" onClick={onRetryBS} className="h-8 px-3 text-xs gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className={cn('flex items-center justify-between gap-2 mb-6 pb-4 border-b', isLight ? 'border-stone-200' : 'border-white/[0.08]')}>
              <MiniMetric label="Assets" value={formatCompactCurrency(bsMetrics.totalAssets || 0, currency)} color={isLight ? 'text-green-600' : 'text-green-400'} isLoading={bsLoading} isLight={isLight} />
              <MiniMetric label="Liabilities" value={formatCompactCurrency(bsMetrics.totalLiabilities || 0, currency)} color={isLight ? 'text-red-600' : 'text-red-400'} isLoading={bsLoading} isLight={isLight} />
              <MiniMetric label="Equity" value={formatCompactCurrency(bsMetrics.totalEquity || 0, currency)} color={isLight ? 'text-blue-600' : 'text-blue-400'} isLoading={bsLoading} isLight={isLight} />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center min-h-[200px]">
              {bsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                </div>
              ) : balanceSheetDonutData.length > 0 ? (
                (() => {
                  const maxVal = Math.max(...balanceSheetDonutData.map((d) => d.value))
                  return (
                    <>
                      <ReactECharts
                        option={{
                          backgroundColor: 'transparent',
                          animation: true,
                          animationDuration: 800,
                          animationEasing: 'cubicOut',
                          tooltip: {
                            trigger: 'item',
                            backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(38,38,38,0.95)',
                            borderColor: 'transparent',
                            borderWidth: 0,
                            textStyle: { color: isLight ? '#374151' : '#e5e7eb', fontSize: 12 },
                            formatter: (params: any) => {
                              return `<div style="display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color}"></span><span>${params.name}</span></div><div style="font-weight:600;font-family:monospace;margin-top:4px">${formatPnLCurrency(params.value, currency)}</div>`
                            },
                          },
                          polar: { radius: ['25%', '80%'], center: ['50%', '50%'] },
                          angleAxis: { max: maxVal * 1.1, show: false, startAngle: 90 },
                          radiusAxis: {
                            type: 'category',
                            data: [...balanceSheetDonutData].reverse().map((d) => d.name),
                            show: false,
                          },
                          series: [{
                            type: 'bar',
                            coordinateSystem: 'polar',
                            data: [...balanceSheetDonutData].reverse().map((d) => ({
                              value: d.value,
                              itemStyle: { color: d.color, borderRadius: 0 },
                              emphasis: {
                                itemStyle: {
                                  color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: d.color }, { offset: 1, color: `${d.color}B3` }] },
                                },
                              },
                            })),
                            barWidth: '75%',
                            roundCap: false,
                            barCategoryGap: '15%',
                            showBackground: false,
                            label: { show: false },
                          }],
                        }}
                        style={{ width: '100%', height: 200 }}
                        opts={canvasHighDpiOpts}
                      />
                      <div className="pt-3 flex items-center justify-center">
                        <div className="flex flex-wrap gap-4 justify-center">
                          {balanceSheetDonutData.map((item) => (
                            <div key={item.name} className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="text-sm theme-text-secondary">{item.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )
                })()
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm theme-text-secondary">No data available</p>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Cash Flow Report Card with Chart */}
      <section className={cn('flex flex-col', sectionHover)}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleNavigate('/reports/cash-flow')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleNavigate('/reports/cash-flow')
            }
          }}
          className="group flex items-center justify-between mb-6 cursor-pointer focus:outline-none"
        >
          <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
            Cash Flow
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>

        {cfError ? (
          <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
            <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
            <p className="text-sm text-red-400 mb-2">
              {cfError.status === 429 ? 'Rate limited' : 'Failed to load'}
            </p>
            {onRetryCF && (
              <Button variant="ghost" size="sm" onClick={onRetryCF} className="h-8 px-3 text-xs gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className={cn('flex items-center justify-between gap-2 mb-6 pb-4 border-b', isLight ? 'border-stone-200' : 'border-white/[0.08]')}>
              <MiniMetric label="Operating" value={formatCompactCurrency(cfMetrics.operatingCashFlow || 0, currency)} color={(cfMetrics.operatingCashFlow || 0) >= 0 ? (isLight ? 'text-green-600' : 'text-green-400') : (isLight ? 'text-red-600' : 'text-red-400')} isLoading={cfLoading} isLight={isLight} />
              <MiniMetric label="Investing" value={formatCompactCurrency(cfMetrics.investingCashFlow || 0, currency)} color={(cfMetrics.investingCashFlow || 0) >= 0 ? (isLight ? 'text-green-600' : 'text-green-400') : (isLight ? 'text-red-600' : 'text-red-400')} isLoading={cfLoading} isLight={isLight} />
              <MiniMetric label="Financing" value={formatCompactCurrency(cfMetrics.financingCashFlow || 0, currency)} color={(cfMetrics.financingCashFlow || 0) >= 0 ? (isLight ? 'text-green-600' : 'text-green-400') : (isLight ? 'text-red-600' : 'text-red-400')} isLoading={cfLoading} isLight={isLight} />
            </div>

            <div className="flex-1 min-h-[200px]">
              {cfTrendLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : isSingleMonth && singleMonthCashFlowWaterfallOption ? (
                <div className="w-full h-full flex items-center justify-center">
                  <ReactECharts option={singleMonthCashFlowWaterfallOption} style={{ width: '100%', height: 220 }} opts={canvasHighDpiOpts} />
                </div>
              ) : cfTrendData && cfTrendData.length > 0 ? (
                <CashFlowChart data={cfTrendData} currency={currency} theme={theme} axisLabelStyle={axisLabelStyle} splitLineStyle={splitLineStyle} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm theme-text-secondary">No trend data available</p>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </>
  )
}
