'use client'

import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
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

export interface PnLTrendDataPoint {
  month: string
  revenue: number
  expenses: number
  netIncome: number
}

export interface PnLTrendChartProps {
  data: PnLTrendDataPoint[]
  formatCurrency: (value: number) => string
  className?: string
}

// =============================================================================
// Colors (matching AI chat) - expenses use theme-aware red
// =============================================================================

// Note: expenses color is set dynamically in the component to be theme-aware

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

export const PnLTrendChart = memo(function PnLTrendChart({
  data,
  formatCurrency,
  className,
}: PnLTrendChartProps) {
  const { axisLabelStyle, axisLineStyle, splitLineStyle, isLightTheme } = useThemeEChartsConfig()

  // Theme-aware colors
  const COLORS = useMemo(
    () => ({
      revenue: isLightTheme ? '#178E66' : '#2FBC8B', // theme-aware green
      expenses: isLightTheme ? '#D51323' : '#EE3D4C', // theme-aware red
      netIncome: isLightTheme ? '#CF6900' : '#FF8100', // theme-aware yellow
    }),
    [isLightTheme]
  )

  // ECharts option (matching AI chat Line.tsx styling)
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
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return ''

          let content = `<div style="font-weight:600;margin-bottom:8px;color:#f8fafc">${params[0].axisValue}</div>`

          params.forEach((p) => {
            const value = Math.round(p.value * 100) / 100 // Fix floating point
            content += `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:3px 0">
                <span style="display:flex;align-items:center;gap:6px">
                  ${p.marker}
                  <span style="color:#94a3b8">${p.seriesName}</span>
                </span>
                <span style="font-weight:600;font-family:monospace;color:#f8fafc">
                  ${formatCurrency(value)}
                </span>
              </div>
            `
          })

          return content
        },
      },
      legend: {
        top: '5%',
        right: '4%',
        orient: 'vertical' as const,
        textStyle: {
          color: isLightTheme ? 'rgba(55, 65, 81, 0.8)' : 'rgba(156, 163, 175, 0.8)',
          fontSize: 11,
        },
        itemGap: 6,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '5%',
        top: '5%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        boundaryGap: false,
        data: labels,
        axisLabel: axisLabelStyle,
        axisLine: { lineStyle: { color: axisLineStyle.color } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          ...axisLabelStyle,
          formatter: (v: number) => formatAxisValue(v),
        },
        splitLine: { lineStyle: { color: splitLineStyle.color } },
      },
      series: [
        {
          name: 'Revenue',
          type: 'line',
          data: data.map((d) => d.revenue),
          smooth: true,
          symbol: 'none',
          lineStyle: { color: COLORS.revenue, width: 2 },
          itemStyle: { color: COLORS.revenue },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${COLORS.revenue}cc` },
                { offset: 1, color: `${COLORS.revenue}1a` },
              ],
            },
          },
        },
        {
          name: 'Expenses',
          type: 'line',
          data: data.map((d) => d.expenses),
          smooth: true,
          symbol: 'none',
          lineStyle: { color: COLORS.expenses, width: 2 },
          itemStyle: { color: COLORS.expenses },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${COLORS.expenses}cc` },
                { offset: 1, color: `${COLORS.expenses}1a` },
              ],
            },
          },
        },
        {
          name: 'Net Income',
          type: 'line',
          data: data.map((d) => d.netIncome),
          smooth: true,
          symbol: 'none',
          lineStyle: { color: COLORS.netIncome, width: 2 },
          itemStyle: { color: COLORS.netIncome },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${COLORS.netIncome}cc` },
                { offset: 1, color: `${COLORS.netIncome}1a` },
              ],
            },
          },
        },
      ],
    }
  }, [data, axisLabelStyle, axisLineStyle, splitLineStyle, isLightTheme, formatCurrency, COLORS])

  const aspectRatio = getChartAspectRatio('line', data?.length || 6)

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {chartOption && (
        <ResponsiveChartContainer aspectRatio={aspectRatio} minHeight={250} maxHeight={350}>
          {({ width, height }) => (
            <ReactECharts option={chartOption} style={{ width, height }} opts={canvasHighDpiOpts} />
          )}
        </ResponsiveChartContainer>
      )}
    </div>
  )
})

PnLTrendChart.displayName = 'PnLTrendChart'
