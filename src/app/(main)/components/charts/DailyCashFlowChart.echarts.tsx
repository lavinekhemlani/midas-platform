// src/app/(main)/components/charts/DailyCashFlowChart.echarts.tsx
'use client'

import { useMemo } from 'react'
import { logger } from '@/lib/logger'
import { useCurrency } from '@/contexts/CurrencyContext'
import {
  ReactECharts,
  useThemeEChartsConfig,
  ResponsiveChartContainer,
  DASHBOARD_GRADIENTS,
  DASHBOARD_COLORS,
  createGradient,
  formatCurrencyValue,
  formatCompactCurrency,
  formatAxisCurrency,
  formatDateLabel,
  canvasHighDpiOpts,
} from './shared'

interface DailyCashFlowData {
  date: string
  day: string
  inflow: number
  outflow: number
  net: number
}

interface DailyCashFlowChartProps {
  data: DailyCashFlowData[]
  currency?: string
  height?: number
  isLoading?: boolean
  dataSource?: {
    inflowTypes?: string[]
    outflowTypes?: string[]
    period?: string
    counts?: {
      invoices?: number
      deposits?: number
      expenses?: number
    }
  }
}

export default function DailyCashFlowChart({
  data,
  currency: propCurrency,
  height = 320,
  isLoading = false,
}: DailyCashFlowChartProps) {
  const { currency: contextCurrency } = useCurrency()
  const currency = propCurrency || contextCurrency
  const { tooltipStyle, axisLabelStyle, axisLineStyle, splitLineStyle, isLightTheme } =
    useThemeEChartsConfig()

  // Debug log
  if (data && data.length > 0) {
    logger.debug('DailyCashFlowChart ECharts data sample', {
      component: 'DailyCashFlowChart.echarts',
      sample: data[0],
      totalOutflows: data.reduce((sum, d) => sum + d.outflow, 0),
    })
  }

  const hasData = data && data.length > 0

  // Sort data chronologically
  const sortedData = useMemo(() => {
    if (!hasData) return []
    return [...data].sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateA - dateB
    })
  }, [data, hasData])

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalInflow = sortedData.reduce((sum, day) => sum + day.inflow, 0)
    const totalOutflow = sortedData.reduce((sum, day) => sum + day.outflow, 0)
    const netFlow = totalInflow - totalOutflow
    const avgDailyInflow = totalInflow / (sortedData.length || 1)
    const avgDailyOutflow = totalOutflow / (sortedData.length || 1)

    const stats = {
      totalInflow,
      totalOutflow,
      netFlow,
      avgDailyNet: avgDailyInflow - avgDailyOutflow,
    }

    logger.debug('Summary stats calculated', {
      component: 'DailyCashFlowChart.echarts',
      stats,
      dataLength: sortedData.length,
    })

    return stats
  }, [sortedData])

  // ECharts option
  const option = useMemo(() => {
    if (!hasData) return null

    const dates = sortedData.map((d) => d.date)
    const inflowData = sortedData.map((d) => d.inflow)
    const outflowData = sortedData.map((d) => d.outflow)
    const netData = sortedData.map((d) => d.net)

    return {
      backgroundColor: 'transparent',
      tooltip: {
        ...tooltipStyle,
        trigger: 'axis' as const,
        confine: true,
        axisPointer: {
          type: 'line',
          lineStyle: { color: 'rgba(148, 163, 184, 0.5)', width: 1, type: 'dashed' },
        },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return ''

          const textPrimary = isLightTheme ? '#1f2937' : '#f3f4f6'
          const textSecondary = isLightTheme ? '#6b7280' : '#9ca3af'
          const redColor = isLightTheme ? '#D51323' : '#EE3D4C'

          const date = new Date(params[0].axisValue)
          const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })

          let content = `<div style="font-weight:600;margin-bottom:8px;color:${textPrimary}">${formattedDate}</div>`

          params.forEach((p) => {
            const value = p.value || 0
            const colorClass =
              p.seriesName === 'Money In'
                ? '#10b981'
                : p.seriesName === 'Money Out'
                  ? redColor
                  : value >= 0
                    ? '#10b981'
                    : redColor

            content += `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:3px 0">
                <span style="display:flex;align-items:center;gap:6px">
                  ${p.marker}
                  <span style="color:${textSecondary}">${p.seriesName}</span>
                </span>
                <span style="font-weight:600;font-family:monospace;color:${colorClass}">
                  ${formatCompactCurrency(value, currency)}
                </span>
              </div>
            `
          })

          const netValue = params.find((p) => p.seriesName === 'Net Flow')?.value
          if (netValue !== undefined) {
            const borderColor = isLightTheme ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
            content += `
              <div style="margin-top:8px;padding-top:8px;border-top:1px solid ${borderColor}">
                <span style="font-size:10px;color:${textSecondary}">Daily Balance: ${formatCurrencyValue(netValue, currency)}</span>
              </div>
            `
          }

          return content
        },
      },
      legend: {
        data: ['Money In', 'Money Out', 'Net Flow'],
        bottom: 0,
        left: 'center',
        itemWidth: 12,
        itemHeight: 12,
        icon: 'circle',
        textStyle: {
          color: isLightTheme ? '#374151' : '#94a3b8',
          fontSize: 12,
          fontWeight: 500,
        },
        itemGap: 24,
      },
      grid: {
        left: '3%',
        right: '4%',
        top: '5%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: dates,
        boundaryGap: false,
        axisLabel: {
          ...axisLabelStyle,
          fontSize: 10,
          fontWeight: 500,
          rotate: 45,
          interval: 4,
          formatter: formatDateLabel,
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          ...axisLabelStyle,
          fontSize: 11,
          fontWeight: 500,
          formatter: (v: number) => formatAxisCurrency(v, currency),
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          lineStyle: {
            color: splitLineStyle.color,
            type: 'dashed',
          },
        },
      },
      series: [
        {
          name: 'Money In',
          type: 'line',
          data: inflowData,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: DASHBOARD_COLORS.inflow, width: 2 },
          areaStyle: { color: createGradient(DASHBOARD_GRADIENTS.inflow) },
        },
        {
          name: 'Money Out',
          type: 'line',
          data: outflowData,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: DASHBOARD_COLORS.outflow, width: 2 },
          areaStyle: { color: createGradient(DASHBOARD_GRADIENTS.outflow) },
        },
        {
          name: 'Net Flow',
          type: 'line',
          data: netData,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: DASHBOARD_COLORS.net,
            width: 2,
            type: 'dashed',
          },
          areaStyle: undefined, // No fill for net flow
        },
      ],
    }
  }, [sortedData, hasData, currency, axisLabelStyle, splitLineStyle, isLightTheme])

  // Loading state
  if (isLoading || (!hasData && isLoading !== false)) {
    return (
      <div className="w-full relative overflow-hidden rounded-lg" style={{ height }}>
        <span className="absolute inset-0 shimmer-bg-10" />
        <span className="absolute inset-0 shimmer-gradient-light animate-shimmer-fast" />
      </div>
    )
  }

  // No data state
  if (!hasData || !option) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height }}>
        <div className="text-center">
          <p className="theme-text-secondary text-sm">No cash flow data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="px-2" style={{ width: '100%', height }}>
        <ResponsiveChartContainer aspectRatio="16/9" minHeight={280} maxHeight={height}>
          {({ width, height: containerHeight }) => (
            <ReactECharts
              option={option}
              style={{ width, height: containerHeight }}
              opts={canvasHighDpiOpts}
              notMerge={true}
            />
          )}
        </ResponsiveChartContainer>
      </div>

      {/* Summary statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-1 pt-2 border-t border-amber-500/10">
        <div className="text-center">
          <div className="text-xs theme-text-secondary mb-1">30-Day Inflow</div>
          <div className="text-sm font-bold text-emerald-400">
            {formatCurrencyValue(summaryStats.totalInflow, currency)}
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs theme-text-secondary mb-1">30-Day Outflow</div>
          <div className="text-sm font-bold text-red-400">
            {formatCurrencyValue(summaryStats.totalOutflow, currency)}
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs theme-text-secondary mb-1">Net Flow</div>
          <div
            className={`text-sm font-bold ${summaryStats.netFlow >= 0 ? 'text-emerald-400' : 'text-red-400'} flex items-center justify-center space-x-1`}
          >
            <span>{formatCurrencyValue(summaryStats.netFlow, currency)}</span>
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs theme-text-secondary mb-1">Avg Daily Net</div>
          <div
            className={`text-sm font-bold ${summaryStats.avgDailyNet >= 0 ? 'text-emerald-400' : 'text-red-400'} flex items-center justify-center space-x-1`}
          >
            <span>{formatCurrencyValue(summaryStats.avgDailyNet, currency)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
