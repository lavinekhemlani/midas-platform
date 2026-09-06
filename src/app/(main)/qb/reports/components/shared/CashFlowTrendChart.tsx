'use client'

import { memo, useMemo } from 'react'
import {
  useThemeEChartsConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '@/components/chat/visualizations/shared'
import { ResponsiveChartContainer } from '@/components/chat/visualizations/shared/ResponsiveChartContainer'
import { getChartAspectRatio } from '@/components/chat/visualizations/shared/getChartAspectRatio'

// =============================================================================
// Types
// =============================================================================

export interface CashFlowTrendDataPoint {
  month: string
  operating: number
  investing: number
  financing: number
  totalCash: number
}

export interface CashFlowTrendChartProps {
  data: CashFlowTrendDataPoint[]
  formatCurrency: (value: number) => string
  className?: string
}

// =============================================================================
// Base Colors - theme values applied in component via useMemo
// =============================================================================

// Compact axis formatter (K/M notation)
function formatAxisValue(value: number): string {
  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (absValue >= 1_000_000) {
    return `${sign}$${(absValue / 1_000_000).toFixed(absValue % 1_000_000 === 0 ? 0 : 1)}M`
  }
  if (absValue >= 1_000) {
    return `${sign}$${Math.round(absValue / 1_000)}K`
  }
  if (absValue === 0) {
    return '$0'
  }
  return `${sign}$${Math.round(absValue)}`
}

// =============================================================================
// Component
// =============================================================================

export const CashFlowTrendChart = memo(function CashFlowTrendChart({
  data,
  formatCurrency,
  className,
}: CashFlowTrendChartProps) {
  const { axisLabelStyle, axisLineStyle, splitLineStyle, isLightTheme } = useThemeEChartsConfig()

  // Theme-aware colors
  const totalCashBlue = isLightTheme ? '#0D54A8' : '#66A7F3'
  const operatingGreen = isLightTheme ? '#178E66' : '#2FBC8B'
  const investingYellow = isLightTheme ? '#CF6900' : '#FF8100'
  const financingPurple = isLightTheme ? '#6F1CBD' : '#BF92E9'

  // ECharts option for bar-line combo chart
  const chartOption = useMemo(() => {
    if (!data?.length) return null

    // Strip year from month labels (e.g., "Jan 2025" -> "Jan")
    const labels = data.map((d) => d.month.split(' ')[0])

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderRadius: 12,
        padding: [12, 16],
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        axisPointer: {
          type: 'shadow',
        },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return ''

          let content = `<div style="font-weight:600;margin-bottom:8px;color:#f8fafc">${params[0].axisValue}</div>`

          params.forEach((p) => {
            content += `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:3px 0">
                <span style="display:flex;align-items:center;gap:6px">
                  ${p.marker}
                  <span style="color:#94a3b8">${p.seriesName}</span>
                </span>
                <span style="font-weight:600;font-family:monospace;color:#f8fafc">
                  ${formatCurrency(p.value)}
                </span>
              </div>
            `
          })

          return content
        },
      },
      legend: {
        bottom: 0,
        left: 'center',
        orient: 'horizontal' as const,
        textStyle: {
          color: isLightTheme ? 'rgba(55, 65, 81, 0.8)' : 'rgba(156, 163, 175, 0.8)',
          fontSize: 11,
        },
        itemGap: 16,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
      },
      grid: {
        left: '3%',
        right: '4%',
        top: '8%',
        bottom: '18%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: labels,
        axisLabel: {
          ...axisLabelStyle,
          rotate: 45,
          fontSize: 10,
        },
        axisLine: { lineStyle: { color: axisLineStyle.color } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          ...axisLabelStyle,
          fontSize: 10,
          formatter: (v: number) => formatAxisValue(v),
        },
        splitLine: { lineStyle: { color: splitLineStyle.color } },
        axisLine: { show: false },
      },
      series: [
        // Stacked bars for cash flow activities
        {
          name: 'Operating',
          type: 'bar',
          stack: 'cashflow',
          data: data.map((d) => d.operating),
          itemStyle: { color: '#10b981' },
          barMaxWidth: 30,
        },
        {
          name: 'Investing',
          type: 'bar',
          stack: 'cashflow',
          data: data.map((d) => d.investing),
          itemStyle: { color: '#f59e0b' },
          barMaxWidth: 30,
        },
        {
          name: 'Financing',
          type: 'bar',
          stack: 'cashflow',
          data: data.map((d) => d.financing),
          itemStyle: { color: '#8b5cf6' },
          barMaxWidth: 30,
        },
        // Line for total cash
        {
          name: 'Total Cash',
          type: 'line',
          data: data.map((d) => d.totalCash),
          smooth: true,
          lineStyle: { color: '#3b82f6', width: 3 },
          itemStyle: { color: '#3b82f6' },
          symbol: 'none',
        },
      ],
    }
  }, [
    data,
    formatCurrency,
    axisLabelStyle,
    axisLineStyle,
    splitLineStyle,
    isLightTheme,
    totalCashBlue,
    operatingGreen,
    investingYellow,
  ])

  const aspectRatio = getChartAspectRatio('bar', data?.length || 6)

  if (!chartOption) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[280px]">
        <p className="text-gray-400 text-sm">No cash flow trend data available</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <ResponsiveChartContainer aspectRatio={aspectRatio} minHeight={280} maxHeight={350}>
        {({ width, height }) => (
          <ReactECharts
            option={chartOption}
            style={{ width, height }}
            opts={canvasHighDpiOpts}
            notMerge={true}
          />
        )}
      </ResponsiveChartContainer>
    </div>
  )
})

CashFlowTrendChart.displayName = 'CashFlowTrendChart'
