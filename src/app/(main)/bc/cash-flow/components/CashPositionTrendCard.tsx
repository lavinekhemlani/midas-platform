'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPnLCurrency, formatAxisCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import {
  useThemeEChartsConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '@/components/chat/visualizations/shared'

export interface MonthlyCashPosition {
  month: string
  ending_cash: number
  net_change: number
  cash_inflows?: number
  cash_outflows?: number
}

interface CashPositionTrendCardProps {
  data: MonthlyCashPosition[]
  isLoading: boolean
  currency?: string
  isLight?: boolean
}

export function CashPositionTrendCard({
  data,
  isLoading,
  currency = 'USD',
  isLight: isLightProp,
}: CashPositionTrendCardProps) {
  const { theme } = useTheme()
  const isLight = isLightProp ?? theme === 'light'
  const { axisLabelStyle, splitLineStyle } = useThemeEChartsConfig()

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
    }),
    [isLight]
  )

  const themeBlue = useMemo(() => (theme === 'light' ? '#0D54A8' : '#66A7F3'), [theme])
  const themeGreen = useMemo(() => (theme === 'light' ? '#178E66' : '#2FBC8B'), [theme])

  const formattedData = useMemo(() => {
    return [...data]
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
      .map((row) => {
        const date = new Date(row.month)
        return {
          month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          cashBalance: row.ending_cash,
          netChange: row.net_change,
        }
      })
  }, [data])

  const trend = useMemo(() => {
    if (formattedData.length < 2) return { direction: 'neutral', percent: 0 }
    const first = formattedData[0].cashBalance
    const last = formattedData[formattedData.length - 1].cashBalance
    const change = last - first
    const percent = first !== 0 ? (change / Math.abs(first)) * 100 : 0
    return {
      direction: change >= 0 ? 'up' : 'down',
      percent: Math.abs(percent),
      change,
    }
  }, [formattedData])

  const chartOption = useMemo(() => {
    if (formattedData.length === 0) return null

    const months = formattedData.map((d) => d.month)
    const balances = formattedData.map((d) => d.cashBalance)

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(38, 38, 38, 0.95)',
        borderColor: 'transparent',
        borderWidth: 0,
        textStyle: { color: '#e5e7eb', fontSize: 12 },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return ''
          const p = params[0]
          const dataIndex = p.dataIndex
          const netChange = formattedData[dataIndex]?.netChange || 0
          return `
            <div style="font-weight:600;margin-bottom:8px;color:#f8fafc">${p.axisValue}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:2px 0">
              <span style="display:flex;align-items:center;gap:6px">
                <span style="display:inline-block;width:8px;height:8px;background:${themeBlue}"></span>
                <span style="color:#94a3b8">Cash Balance</span>
              </span>
              <span style="font-weight:600;font-family:monospace;color:#f8fafc">
                ${formatPnLCurrency(p.value, currency)}
              </span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:2px 0">
              <span style="color:#94a3b8">Net Change</span>
              <span style="font-weight:600;font-family:monospace;color:${netChange >= 0 ? themeGreen : '#EE3D4C'}">
                ${netChange >= 0 ? '+' : ''}${formatPnLCurrency(netChange, currency)}
              </span>
            </div>
          `
        },
      },
      grid: {
        left: '3%',
        right: '3%',
        bottom: '3%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: months,
        axisLabel: { ...axisLabelStyle, fontSize: 10, rotate: 0 },
        axisLine: { lineStyle: { color: splitLineStyle.color } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          ...axisLabelStyle,
          formatter: formatAxisCurrency(currency),
        },
        splitLine: { lineStyle: { color: splitLineStyle.color, type: 'dashed' } },
      },
      series: [
        {
          name: 'Cash Balance',
          type: 'line',
          data: balances,
          smooth: true,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { color: themeBlue, width: 2 },
          itemStyle: {
            color: themeBlue,
            borderWidth: 1,
            borderColor: isLight ? '#fff' : '#1a1a1a',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${themeBlue}30` },
                { offset: 1, color: `${themeBlue}05` },
              ],
            },
          },
        },
      ],
    }
  }, [formattedData, themeBlue, themeGreen, currency, axisLabelStyle, splitLineStyle, isLight])

  const currentBalance =
    formattedData.length > 0 ? formattedData[formattedData.length - 1].cashBalance : 0

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Cash Position Trend
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <div
          className={cn('h-[220px] animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')}
        />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Cash Position Trend
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        {data.length > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <span className={cn('font-mono font-semibold', styles.text)}>
              {formatPnLCurrency(currentBalance, currency)}
            </span>
            <div
              className="flex items-center gap-1 font-semibold font-mono px-2 py-1"
              style={{
                color:
                  trend.direction === 'up'
                    ? isLight
                      ? '#15803d'
                      : '#4ade80'
                    : isLight
                      ? '#dc2626'
                      : '#f87171',
                backgroundColor:
                  trend.direction === 'up'
                    ? isLight
                      ? '#f0fdf4'
                      : 'rgba(34, 197, 94, 0.1)'
                    : isLight
                      ? '#fef2f2'
                      : 'rgba(239, 68, 68, 0.1)',
              }}
            >
              {trend.direction === 'up' ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{trend.percent.toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>

      {chartOption ? (
        <div style={{ height: 220 }}>
          <ReactECharts
            option={chartOption}
            style={{ width: '100%', height: 220 }}
            opts={canvasHighDpiOpts}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-[220px]">
          <p className={cn('text-sm', styles.textMuted)}>No trend data available</p>
        </div>
      )}
    </div>
  )
}
