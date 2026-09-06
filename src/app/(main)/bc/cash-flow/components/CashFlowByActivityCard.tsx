'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { formatPnLCurrency, formatAxisCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import {
  useThemeEChartsConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '@/components/chat/visualizations/shared'

export interface MonthlyCashFlowByActivity {
  month: string
  operating: number
  investing: number
  financing: number
}

interface CashFlowByActivityCardProps {
  data: MonthlyCashFlowByActivity[]
  isLoading: boolean
  currency?: string
  isLight?: boolean
}

export function CashFlowByActivityCard({
  data,
  isLoading,
  currency = 'USD',
  isLight: isLightProp,
}: CashFlowByActivityCardProps) {
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

  const operatingColor = useMemo(() => (theme === 'light' ? '#178E66' : '#2FBC8B'), [theme])
  const investingColor = useMemo(() => (theme === 'light' ? '#0D54A8' : '#66A7F3'), [theme])
  const financingColor = useMemo(() => (theme === 'light' ? '#7C3AED' : '#A78BFA'), [theme])

  const formattedData = useMemo(() => {
    return [...data]
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
      .map((row) => {
        const date = new Date(row.month)
        return {
          month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          operating: row.operating,
          investing: row.investing,
          financing: row.financing,
        }
      })
  }, [data])

  const chartOption = useMemo(() => {
    if (formattedData.length === 0) return null

    const months = formattedData.map((d) => d.month)

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(38, 38, 38, 0.95)',
        borderColor: 'transparent',
        borderWidth: 0,
        textStyle: { color: '#e5e7eb', fontSize: 12 },
        axisPointer: {
          type: 'shadow' as const,
        },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return ''
          let content = `<div style="font-weight:600;margin-bottom:8px;color:#f8fafc">${params[0].axisValue}</div>`
          let total = 0
          params.forEach((p: any) => {
            total += p.value || 0
            const valueColor = p.value >= 0 ? '#2FBC8B' : '#EE3D4C'
            content += `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:2px 0">
                <span style="display:flex;align-items:center;gap:6px">
                  <span style="display:inline-block;width:8px;height:8px;background:${p.color}"></span>
                  <span style="color:#94a3b8">${p.seriesName}</span>
                </span>
                <span style="font-weight:600;font-family:monospace;color:${valueColor}">
                  ${formatPnLCurrency(p.value, currency)}
                </span>
              </div>
            `
          })
          content += `
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:space-between;gap:16px">
              <span style="color:#94a3b8">Net Cash Flow</span>
              <span style="font-weight:700;font-family:monospace;color:${total >= 0 ? '#2FBC8B' : '#EE3D4C'}">
                ${formatPnLCurrency(total, currency)}
              </span>
            </div>
          `
          return content
        },
      },
      legend: {
        show: true,
        bottom: 0,
        textStyle: { color: theme === 'light' ? '#374151' : '#9ca3af', fontSize: 10 },
        itemWidth: 10,
        itemHeight: 10,
        icon: 'rect',
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
        axisLabel: { ...axisLabelStyle, fontSize: 10 },
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
          name: 'Operating',
          type: 'bar',
          stack: 'cashflow',
          data: formattedData.map((d) => d.operating),
          itemStyle: {
            color: operatingColor,
          },
          barMaxWidth: 32,
        },
        {
          name: 'Investing',
          type: 'bar',
          stack: 'cashflow',
          data: formattedData.map((d) => d.investing),
          itemStyle: {
            color: investingColor,
          },
          barMaxWidth: 32,
        },
        {
          name: 'Financing',
          type: 'bar',
          stack: 'cashflow',
          data: formattedData.map((d) => d.financing),
          itemStyle: {
            color: financingColor,
          },
          barMaxWidth: 32,
        },
      ],
    }
  }, [
    formattedData,
    operatingColor,
    investingColor,
    financingColor,
    currency,
    theme,
    axisLabelStyle,
    splitLineStyle,
  ])

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
            Cash Flow by Activity
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <div
          className={cn('h-[250px] animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')}
        />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-5">
        <span
          className={cn(
            'relative text-base font-normal uppercase tracking-wider',
            isLight ? 'text-stone-800' : 'text-stone-300'
          )}
        >
          Cash Flow by Activity
          <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
        </span>
      </div>

      {chartOption ? (
        <div style={{ height: 250 }}>
          <ReactECharts
            option={chartOption}
            style={{ width: '100%', height: 250 }}
            opts={canvasHighDpiOpts}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-[250px]">
          <p className={cn('text-sm', styles.textMuted)}>No activity data available</p>
        </div>
      )}
    </div>
  )
}
