'use client'

import { useMemo } from 'react'
import { useTheme } from '@/hooks/useTheme'
import {
  useThemeEChartsConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '@/components/chat/visualizations/shared'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Activity,
  Calendar,
  Database,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { TrialBalanceRow, MonthlyPnLRow, DataDateRangeRow } from '../hooks/useWarehouseData'

interface WarehouseMetricsGridProps {
  trialBalance: TrialBalanceRow[]
  monthlyPnL: MonthlyPnLRow[]
  dataRange: DataDateRangeRow | null
  isLoading: boolean
}

// Format currency
function formatCurrency(value: number): string {
  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (absValue >= 1_000_000) {
    return `${sign}$${(absValue / 1_000_000).toFixed(1)}M`
  }
  if (absValue >= 1_000) {
    return `${sign}$${(absValue / 1_000).toFixed(0)}K`
  }
  return `${sign}$${absValue.toFixed(0)}`
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function WarehouseMetricsGrid({
  trialBalance,
  monthlyPnL,
  dataRange,
  isLoading,
}: WarehouseMetricsGridProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const borderClass = isLight ? 'border-stone-200' : 'border-white/[0.08]'
  const textMutedClass = 'text-stone-500'
  const { axisLabelStyle, splitLineStyle } = useThemeEChartsConfig()

  // Theme-aware colors
  const themeRed = useMemo(() => (theme === 'light' ? '#D51323' : '#EE3D4C'), [theme])
  const themeGreen = useMemo(() => (theme === 'light' ? '#178E66' : '#2FBC8B'), [theme])
  const themeBlue = useMemo(() => (theme === 'light' ? '#0D54A8' : '#66A7F3'), [theme])

  // Calculate aggregated metrics from trial balance
  const metrics = useMemo(() => {
    if (!trialBalance.length) {
      return {
        totalDebits: 0,
        totalCredits: 0,
        netBalance: 0,
        accountCount: 0,
      }
    }

    return {
      totalDebits: trialBalance.reduce((sum, row) => sum + (row.total_debits || 0), 0),
      totalCredits: trialBalance.reduce((sum, row) => sum + (row.total_credits || 0), 0),
      netBalance: trialBalance.reduce((sum, row) => sum + (row.net_balance || 0), 0),
      accountCount: trialBalance.length,
    }
  }, [trialBalance])

  // Monthly trend chart option
  const trendChartOption = useMemo(() => {
    if (!monthlyPnL.length) return null

    // Reverse to show oldest first
    const sortedData = [...monthlyPnL].reverse()
    const months = sortedData.map((row) => {
      const date = new Date(row.month)
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    })

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'transparent',
        borderWidth: 0,
        textStyle: { color: '#e5e7eb', fontSize: 12 },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return ''
          let content = `<div style="font-weight:600;margin-bottom:8px;color:#f8fafc">${params[0].axisValue}</div>`
          params.forEach((p: any) => {
            content += `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:2px 0">
                <span style="display:flex;align-items:center;gap:6px">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
                  <span style="color:#94a3b8">${p.seriesName}</span>
                </span>
                <span style="font-weight:600;font-family:monospace;color:#f8fafc">
                  ${formatFullCurrency(p.value)}
                </span>
              </div>
            `
          })
          return content
        },
      },
      legend: {
        show: true,
        bottom: 0,
        textStyle: { color: theme === 'light' ? '#374151' : '#9ca3af', fontSize: 11 },
        itemWidth: 12,
        itemHeight: 12,
        icon: 'circle',
      },
      grid: {
        left: '3%',
        right: '3%',
        bottom: '15%',
        top: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: months,
        axisLabel: { ...axisLabelStyle, fontSize: 10, rotate: 45 },
        axisLine: { lineStyle: { color: splitLineStyle.color } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          ...axisLabelStyle,
          formatter: (v: number) => formatCurrency(v),
        },
        splitLine: { lineStyle: { color: splitLineStyle.color } },
      },
      series: [
        {
          name: 'Total Debits',
          type: 'line',
          data: sortedData.map((row) => row.total_debits || 0),
          smooth: true,
          showSymbol: false,
          lineStyle: { color: themeGreen, width: 2 },
          itemStyle: { color: themeGreen },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${themeGreen}40` },
                { offset: 1, color: `${themeGreen}08` },
              ],
            },
          },
        },
        {
          name: 'Total Credits',
          type: 'line',
          data: sortedData.map((row) => row.total_credits || 0),
          smooth: true,
          showSymbol: false,
          lineStyle: { color: themeRed, width: 2 },
          itemStyle: { color: themeRed },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${themeRed}40` },
                { offset: 1, color: `${themeRed}08` },
              ],
            },
          },
        },
        {
          name: 'Net Amount',
          type: 'line',
          data: sortedData.map((row) => row.net_amount || 0),
          smooth: true,
          showSymbol: false,
          lineStyle: { color: themeBlue, width: 2 },
          itemStyle: { color: themeBlue },
        },
      ],
    }
  }, [monthlyPnL, theme, axisLabelStyle, splitLineStyle, themeGreen, themeRed, themeBlue])

  if (isLoading) {
    return (
      <div className="@container space-y-6 max-w-[1800px] mx-auto">
        <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={cn('p-4', isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]')}>
              <div className="space-y-2">
                <div
                  className={cn(
                    'h-3 w-20 animate-pulse',
                    isLight ? 'bg-stone-300' : 'bg-white/[0.06]'
                  )}
                />
                <div
                  className={cn(
                    'h-7 w-32 animate-pulse',
                    isLight ? 'bg-stone-300' : 'bg-white/[0.06]'
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="@container space-y-6 max-w-[1800px] mx-auto">
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-4">
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'p-4 cursor-help text-center',
                  isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider font-medium mb-1',
                    textMutedClass
                  )}
                >
                  <TrendingUp className="w-3 h-3" style={{ color: themeGreen }} />
                  Total Debits
                </div>
                <div
                  className="text-2xl font-mono font-semibold tabular-nums"
                  style={{ color: themeGreen }}
                >
                  {formatFullCurrency(metrics.totalDebits)}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Sum of all debit transactions across GL entries</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'p-4 cursor-help text-center',
                  isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider font-medium mb-1',
                    textMutedClass
                  )}
                >
                  <TrendingDown className="w-3 h-3" style={{ color: themeRed }} />
                  Total Credits
                </div>
                <div
                  className="text-2xl font-mono font-semibold tabular-nums"
                  style={{ color: themeRed }}
                >
                  {formatFullCurrency(metrics.totalCredits)}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Sum of all credit transactions across GL entries</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'p-4 cursor-help text-center',
                  isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider font-medium mb-1',
                    textMutedClass
                  )}
                >
                  <DollarSign className="w-3 h-3" style={{ color: themeBlue }} />
                  Net Balance
                </div>
                <div
                  className="text-2xl font-mono font-semibold tabular-nums"
                  style={{ color: metrics.netBalance >= 0 ? themeGreen : themeRed }}
                >
                  {formatFullCurrency(metrics.netBalance)}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Total Debits minus Total Credits</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'p-4 cursor-help text-center',
                  isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider font-medium mb-1',
                    textMutedClass
                  )}
                >
                  <FileText className="w-3 h-3 text-purple-400" />
                  Active Accounts
                </div>
                <div
                  className={cn(
                    'text-2xl font-mono font-semibold tabular-nums',
                    isLight ? 'text-stone-900' : 'text-white'
                  )}
                >
                  {metrics.accountCount.toLocaleString()}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Number of GL accounts with transaction activity</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Monthly Trend + Data Coverage */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6 border-t', borderClass)}>
        <section className={cn('pb-6 @3xl:pb-0 @3xl:pr-8 @3xl:border-r', borderClass)}>
          <div
            className={cn(
              'flex items-center gap-2 text-[14px] font-semibold uppercase tracking-wider mb-5',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            <Activity className="w-3.5 h-3.5" style={{ color: themeBlue }} />
            Monthly GL Trend
          </div>
          {trendChartOption ? (
            <div style={{ height: 300 }}>
              <ReactECharts
                option={trendChartOption}
                style={{ width: '100%', height: 300 }}
                opts={canvasHighDpiOpts}
              />
            </div>
          ) : (
            <div
              className={cn('flex items-center justify-center h-[300px] text-sm', textMutedClass)}
            >
              No monthly data available
            </div>
          )}
        </section>

        <section>
          <div
            className={cn(
              'flex items-center gap-2 text-[14px] font-semibold uppercase tracking-wider mb-5',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            Data Coverage
          </div>
          {dataRange ? (
            <div className="space-y-0">
              <div
                className={cn(
                  'flex items-center justify-between py-2.5 px-2 -mx-2 text-xs',
                  isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]'
                )}
              >
                <span className="flex items-center gap-2 theme-text-secondary">
                  <Calendar className="w-3.5 h-3.5" />
                  Earliest Date
                </span>
                <span
                  className={cn(
                    'font-mono font-semibold tabular-nums',
                    isLight ? 'text-stone-900' : 'text-white'
                  )}
                >
                  {new Date(dataRange.earliest_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5 px-2 -mx-2 text-xs">
                <span className="flex items-center gap-2 theme-text-secondary">
                  <Calendar className="w-3.5 h-3.5" />
                  Latest Date
                </span>
                <span
                  className={cn(
                    'font-mono font-semibold tabular-nums',
                    isLight ? 'text-stone-900' : 'text-white'
                  )}
                >
                  {new Date(dataRange.latest_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div
                className={cn(
                  'flex items-center justify-between py-2.5 px-2 -mx-2 text-xs',
                  isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]'
                )}
              >
                <span className="flex items-center gap-2 theme-text-secondary">
                  <Activity className="w-3.5 h-3.5" />
                  Months of Data
                </span>
                <span
                  className={cn(
                    'font-mono font-semibold tabular-nums',
                    isLight ? 'text-stone-900' : 'text-white'
                  )}
                >
                  {dataRange.months_of_data}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5 px-2 -mx-2 text-xs">
                <span className="flex items-center gap-2 theme-text-secondary">
                  <FileText className="w-3.5 h-3.5" />
                  Total Entries
                </span>
                <span
                  className={cn(
                    'font-mono font-semibold tabular-nums',
                    isLight ? 'text-stone-900' : 'text-white'
                  )}
                >
                  {dataRange.total_entries.toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <div
              className={cn('flex items-center justify-center h-[200px] text-sm', textMutedClass)}
            >
              No data range available
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
