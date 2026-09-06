// src/app/(main)/components/charts/RevenueChart.echarts.tsx
'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/contexts/CurrencyContext'
import {
  ReactECharts,
  useThemeEChartsConfig,
  ResponsiveChartContainer,
  DASHBOARD_COLORS,
  formatCompactCurrency,
  formatAxisCurrency,
  canvasHighDpiOpts,
} from './shared'

interface RevenueDataPoint {
  month: string
  revenue: number
  expenses: number
  profit: number
}

interface RevenueChartProps {
  data: RevenueDataPoint[]
  currency?: string
  height?: number
  onPeriodChange?: (period: string) => void
  currentPeriod?: string
  isLoading?: boolean
  viewType?: 'monthly' | 'weekly'
  onViewTypeChange?: (type: 'monthly' | 'weekly') => void
  dataSource?: {
    revenue?: string
    expenses?: string
    calculation?: string
  }
}

export default function RevenueChart({
  data,
  currency: propCurrency,
  height = 300,
  onPeriodChange,
  currentPeriod = '3months',
  isLoading = false,
  viewType = 'monthly',
  onViewTypeChange,
}: RevenueChartProps) {
  const { currency: contextCurrency } = useCurrency()
  const currency = propCurrency || contextCurrency
  const { tooltipStyle, axisLabelStyle, splitLineStyle, isLightTheme } = useThemeEChartsConfig()

  // Track which metrics are selected (for interactive legend)
  const [selectedMetrics, setSelectedMetrics] = useState({
    revenue: true,
    expenses: true,
    profit: true,
  })

  // Handle legend select change
  const handleLegendChange = useCallback((params: any) => {
    setSelectedMetrics(params.selected)
  }, [])

  // ECharts events
  const onEvents = useMemo(
    () => ({
      legendselectchanged: handleLegendChange,
    }),
    [handleLegendChange]
  )

  // ECharts option
  const option = useMemo(() => {
    if (!data || data.length === 0) return null

    const months = data.map((d) => d.month)
    const revenueData = data.map((d) => d.revenue)
    const expensesData = data.map((d) => d.expenses)
    const profitData = data.map((d) => d.profit)

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

          let content = `<div style="font-weight:600;margin-bottom:8px;color:${textPrimary}">${params[0].axisValue}</div>`

          params.forEach((p) => {
            content += `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:3px 0">
                <span style="display:flex;align-items:center;gap:6px">
                  ${p.marker}
                  <span style="color:${textSecondary};text-transform:capitalize">${p.seriesName}</span>
                </span>
                <span style="font-weight:600;font-family:monospace;color:${textPrimary}">
                  ${formatCompactCurrency(p.value, currency)}
                </span>
              </div>
            `
          })

          const profitEntry = params.find((p) => p.seriesName === 'Profit')
          const revenueEntry = params.find((p) => p.seriesName === 'Revenue')
          if (profitEntry && revenueEntry && revenueEntry.value > 0) {
            const margin = ((profitEntry.value / revenueEntry.value) * 100).toFixed(1)
            const borderColor = isLightTheme ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
            content += `
              <div style="margin-top:8px;padding-top:8px;border-top:1px solid ${borderColor}">
                <span style="font-size:10px;color:${textSecondary}">Profit Margin: ${margin}%</span>
              </div>
            `
          }

          return content
        },
      },
      legend: {
        data: ['Revenue', 'Expenses', 'Profit'],
        selected: selectedMetrics,
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
        selectedMode: true, // Enable click to toggle
      },
      grid: {
        left: '3%',
        right: '4%',
        top: '8%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: months,
        boundaryGap: false,
        axisLabel: {
          ...axisLabelStyle,
          fontSize: 11,
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          ...axisLabelStyle,
          fontSize: 11,
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
          name: 'Revenue',
          type: 'line',
          data: revenueData,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: DASHBOARD_COLORS.revenue, width: 2 },
          itemStyle: { color: DASHBOARD_COLORS.revenue },
        },
        {
          name: 'Expenses',
          type: 'line',
          data: expensesData,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: DASHBOARD_COLORS.expenses, width: 2 },
          itemStyle: { color: DASHBOARD_COLORS.expenses },
        },
        {
          name: 'Profit',
          type: 'line',
          data: profitData,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: DASHBOARD_COLORS.profit,
            width: 2,
            type: 'dashed',
          },
          itemStyle: { color: DASHBOARD_COLORS.profit },
        },
      ],
    }
  }, [data, currency, selectedMetrics, axisLabelStyle, splitLineStyle, isLightTheme])

  // Loading state
  if (isLoading) {
    return (
      <div style={{ width: '100%', height }}>
        <div className="skeleton h-full animate-pulse" />
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Controls row */}
      {onPeriodChange && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {/* View Type Toggle for 3 months */}
            {currentPeriod === '3months' && onViewTypeChange && (
              <div className="flex items-center space-x-1 bg-slate-500/10 rounded-lg p-1">
                <button
                  onClick={() => onViewTypeChange('weekly')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-all',
                    viewType === 'weekly'
                      ? 'bg-blue-500 text-white'
                      : 'theme-text-secondary hover:theme-text-primary'
                  )}
                >
                  Weekly
                </button>
                <button
                  onClick={() => onViewTypeChange('monthly')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-all',
                    viewType === 'monthly'
                      ? 'bg-blue-500 text-white'
                      : 'theme-text-secondary hover:theme-text-primary'
                  )}
                >
                  Monthly
                </button>
              </div>
            )}

            {/* Period Selector */}
            <div className="flex items-center space-x-1 bg-slate-500/10 rounded-lg p-1">
              <button
                onClick={() => onPeriodChange('12months')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded transition-all',
                  currentPeriod === '12months'
                    ? 'bg-amber-500 text-white'
                    : 'theme-text-secondary hover:theme-text-primary'
                )}
              >
                1Y
              </button>
              <button
                onClick={() => onPeriodChange('3months')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded transition-all',
                  currentPeriod === '3months'
                    ? 'bg-amber-500 text-white'
                    : 'theme-text-secondary hover:theme-text-primary'
                )}
              >
                3M
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="px-2" style={{ width: '100%', height }}>
        {option ? (
          <ResponsiveChartContainer aspectRatio="16/9" minHeight={250} maxHeight={height}>
            {({ width, height: containerHeight }) => (
              <ReactECharts
                option={option}
                style={{ width, height: containerHeight }}
                opts={canvasHighDpiOpts}
                notMerge={true}
                onEvents={onEvents}
              />
            )}
          </ResponsiveChartContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="theme-text-secondary text-sm">No revenue data available</p>
          </div>
        )}
      </div>
    </div>
  )
}
