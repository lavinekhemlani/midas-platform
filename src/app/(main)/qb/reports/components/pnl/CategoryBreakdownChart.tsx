'use client'

import { memo, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  useThemeEChartsConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '@/components/chat/visualizations/shared'
import { ResponsiveChartContainer } from '@/components/chat/visualizations/shared/ResponsiveChartContainer'
import { getChartAspectRatio } from '@/components/chat/visualizations/shared/getChartAspectRatio'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// =============================================================================
// Types
// =============================================================================

export interface CategorySeries {
  name: string
  data: number[]
}

export interface CategoryData {
  labels: string[]
  series: CategorySeries[]
}

export interface CategoryBreakdownChartProps {
  expensesData: CategoryData
  revenueData: CategoryData
  currency?: string
  isLoading?: boolean
  className?: string
  isSingleMonth?: boolean
}

// =============================================================================
// Helpers
// =============================================================================

// Compact axis formatter (K/M notation with currency)
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

// Format currency for tooltip
function formatTooltipCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// =============================================================================
// Component
// =============================================================================

export const CategoryBreakdownChart = memo(function CategoryBreakdownChart({
  expensesData,
  revenueData,
  isLoading,
  className,
  isSingleMonth = false,
}: CategoryBreakdownChartProps) {
  const [activeTab, setActiveTab] = useState<'expenses' | 'revenue'>('expenses')
  const { axisLabelStyle, axisLineStyle, splitLineStyle, isLightTheme } = useThemeEChartsConfig()

  // Theme-aware category colors
  const themeRed = isLightTheme ? '#D51323' : '#EE3D4C'
  const themeGreen = isLightTheme ? '#178E66' : '#2FBC8B'
  const themeYellow = isLightTheme ? '#CF6900' : '#FF8100'
  const themePurple = isLightTheme ? '#6F1CBD' : '#BF92E9'
  const categoryColors = useMemo(
    () => [
      themeGreen, // theme-aware green
      themeYellow, // theme-aware yellow
      isLightTheme ? '#0D54A8' : '#66A7F3', // theme-aware blue
      themeRed, // theme-aware red
      themePurple, // theme-aware purple
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#f97316', // orange
      '#84cc16', // lime
      '#6366f1', // indigo
    ],
    [isLightTheme, themeRed, themeGreen, themeYellow, themePurple]
  )

  const data = activeTab === 'expenses' ? expensesData : revenueData

  // ECharts option for multi-series line chart
  const chartOption = useMemo(() => {
    if (!data?.series?.length || !data?.labels?.length) return null

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

          // Sort by value descending
          const sortedParams = [...params].sort((a, b) => (b.value || 0) - (a.value || 0))

          // Calculate total
          const total = sortedParams.reduce((sum, p) => sum + (p.value || 0), 0)

          let content = `<div style="font-weight:600;margin-bottom:8px;color:#f8fafc">${params[0].axisValue}</div>`

          sortedParams.forEach((p) => {
            const value = Math.round(p.value * 100) / 100
            content += `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:3px 0">
                <span style="display:flex;align-items:center;gap:6px">
                  ${p.marker}
                  <span style="color:#94a3b8">${p.seriesName}</span>
                </span>
                <span style="font-weight:600;font-family:monospace;color:#f8fafc">
                  ${formatTooltipCurrency(value)}
                </span>
              </div>
            `
          })

          // Add total row
          content += `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:6px 0 3px 0;margin-top:6px;border-top:1px solid rgba(255,255,255,0.1)">
              <span style="color:#94a3b8;font-weight:600">Total</span>
              <span style="font-weight:700;font-family:monospace;color:#f8fafc">
                ${formatTooltipCurrency(total)}
              </span>
            </div>
          `

          return content
        },
      },
      legend: {
        type: 'scroll' as const,
        bottom: '0%',
        left: 'center',
        orient: 'horizontal' as const,
        textStyle: {
          color: isLightTheme ? 'rgba(55, 65, 81, 0.8)' : 'rgba(156, 163, 175, 0.8)',
          fontSize: 11,
        },
        pageTextStyle: {
          color: isLightTheme ? 'rgba(55, 65, 81, 0.8)' : 'rgba(156, 163, 175, 0.8)',
        },
        pageIconColor: isLightTheme ? 'rgba(55, 65, 81, 0.6)' : 'rgba(156, 163, 175, 0.6)',
        pageIconInactiveColor: isLightTheme ? 'rgba(55, 65, 81, 0.2)' : 'rgba(156, 163, 175, 0.2)',
        itemGap: 12,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '5%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        boundaryGap: false,
        data: data.labels,
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
      series: data.series.map((s, index) => ({
        name: s.name,
        type: 'line',
        data: s.data,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
        emphasis: {
          focus: 'series',
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
        lineStyle: {
          color: categoryColors[index % categoryColors.length],
          width: 2,
        },
        itemStyle: {
          color: categoryColors[index % categoryColors.length],
        },
      })),
    }
  }, [data, axisLabelStyle, axisLineStyle, splitLineStyle, isLightTheme, categoryColors])

  // Single-month horizontal bar chart: show categories ranked by value
  const singleMonthBarOption = useMemo(() => {
    if (!isSingleMonth || !data?.series?.length) return null

    // Collect all categories with their single data point, sorted by value descending
    const items = data.series
      .map((s, index) => ({
        name: s.name,
        value: s.data[0] || 0,
        color: categoryColors[index % categoryColors.length],
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => a.value - b.value) // ascending for horizontal bar (bottom-to-top)

    if (items.length === 0) return null

    // Dynamic height based on number of categories (min 280, ~36px per bar)
    const barHeight = Math.max(280, items.length * 36 + 60)

    return {
      height: barHeight,
      option: {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis' as const,
          axisPointer: { type: 'shadow' as const },
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          borderRadius: 12,
          padding: [12, 16],
          textStyle: { color: '#e2e8f0', fontSize: 12 },
          formatter: (params: any[]) => {
            if (!params || params.length === 0) return ''
            const p = params[0]
            return `
              <div style="display:flex;align-items:center;gap:8px">
                ${p.marker}
                <span style="color:#94a3b8">${p.name}</span>
                <span style="font-weight:600;font-family:monospace;color:#f8fafc;margin-left:auto">
                  ${formatTooltipCurrency(p.value)}
                </span>
              </div>
            `
          },
        },
        legend: { show: false },
        grid: {
          left: '3%',
          right: '15%',
          bottom: '3%',
          top: '3%',
          containLabel: true,
        },
        xAxis: {
          type: 'value' as const,
          axisLabel: {
            ...axisLabelStyle,
            formatter: (v: number) => formatAxisValue(v),
          },
          splitLine: { lineStyle: { color: splitLineStyle.color } },
        },
        yAxis: {
          type: 'category' as const,
          data: items.map((d) => d.name),
          axisLabel: {
            ...axisLabelStyle,
            fontSize: 11,
            width: 120,
            overflow: 'truncate' as const,
          },
          axisLine: { lineStyle: { color: axisLineStyle.color } },
        },
        series: [
          {
            type: 'bar',
            data: items.map((d) => ({
              value: d.value,
              itemStyle: { color: d.color, borderRadius: [0, 4, 4, 0] },
            })),
            barWidth: '65%',
            label: {
              show: true,
              position: 'right' as const,
              formatter: (params: any) => formatTooltipCurrency(params.value),
              fontSize: 11,
              color: isLightTheme ? 'rgba(55, 65, 81, 0.8)' : 'rgba(156, 163, 175, 0.9)',
            },
            emphasis: {
              itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
            },
          },
        ],
      },
    }
  }, [
    isSingleMonth,
    data,
    categoryColors,
    axisLabelStyle,
    axisLineStyle,
    splitLineStyle,
    isLightTheme,
  ])

  const aspectRatio = getChartAspectRatio('line', data?.labels?.length || 6)

  // Empty state
  const hasData = data?.series?.length > 0 && data?.labels?.length > 0

  return (
    <Card className={cn('glass-luxury-card', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium theme-text-primary">
            {isSingleMonth ? 'Category Breakdown' : 'Monthly Category Breakdown'}
          </CardTitle>
          {/* Tab buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('expenses')}
              className={cn(
                'text-sm font-medium transition-colors duration-200',
                activeTab === 'expenses'
                  ? 'text-amber-500 dark:text-amber-400'
                  : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
              )}
            >
              Expenses
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('revenue')}
              className={cn(
                'text-sm font-medium transition-colors duration-200',
                activeTab === 'revenue'
                  ? 'text-theme-green'
                  : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
              )}
            >
              Revenue
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-[300px] text-gray-500 dark:text-gray-400">
            <p>No data available for the selected period</p>
          </div>
        ) : isSingleMonth && singleMonthBarOption ? (
          <div style={{ height: singleMonthBarOption.height }}>
            <ReactECharts
              option={singleMonthBarOption.option}
              style={{ width: '100%', height: singleMonthBarOption.height }}
              opts={canvasHighDpiOpts}
            />
          </div>
        ) : (
          <ResponsiveChartContainer aspectRatio={aspectRatio} minHeight={280} maxHeight={380}>
            {({ width, height }) => (
              <ReactECharts
                option={chartOption!}
                style={{ width, height }}
                opts={canvasHighDpiOpts}
              />
            )}
          </ResponsiveChartContainer>
        )}
      </CardContent>
    </Card>
  )
})

CategoryBreakdownChart.displayName = 'CategoryBreakdownChart'
