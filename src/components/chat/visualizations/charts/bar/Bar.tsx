/**
 * @component BarChart
 * @description Unified bar chart with automatic variant detection
 *
 * Variants:
 * - Vertical (default): data[] with positive values
 * - Horizontal: orientation: 'horizontal'
 * - Stacked: series[] + labels[] (multi-series)
 * - Diverging: auto-detected from negative values in data[]
 */

'use client'

import { memo, useMemo } from 'react'

import { cn } from '@/lib/utils'
import {
  COLORS,
  colorPalette,
  useThemeEChartsConfig,
  getGridConfig,
  getCategoryXAxis,
  getValueYAxis,
  getTitleConfig,
  getLegendConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '../../shared'
import { EmptyState } from '../../shared/EmptyState'
import { getChartAspectRatio } from '../../shared/getChartAspectRatio'
import { ResponsiveChartContainer } from '../../shared/ResponsiveChartContainer'
import type { ChartBlock } from '../../shared/types'

// =============================================================================
// Types
// =============================================================================

export interface BarChartProps {
  block: ChartBlock
  className?: string
}

// =============================================================================
// Helpers
// =============================================================================

function adjustColorBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = Math.max(0, Math.min(255, (num >> 16) + amt))
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt))
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt))
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`
}

function getCurrencySymbol(currencyCode?: string): string {
  if (!currencyCode || currencyCode === 'USD') return '$'
  try {
    const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, currencyDisplay: 'narrowSymbol' }).formatToParts(0)
    return parts.find(p => p.type === 'currency')?.value || currencyCode
  } catch { return currencyCode }
}

function formatCompact(value: number, currencyCode?: string): string {
  const sym = getCurrencySymbol(currencyCode)
  if (Math.abs(value) >= 1000000) return `${sym}${(value / 1000000).toFixed(1)}M`
  if (Math.abs(value) >= 1000) return `${sym}${(value / 1000).toFixed(0)}K`
  return `${sym}${value}`
}

function formatWithSign(value: number): string {
  return `${(value / 1000).toFixed(0)}K`
}

// =============================================================================
// Component
// =============================================================================

export const BarChart = memo(function BarChart({ block, className }: BarChartProps) {
  const { title, data, series, labels, showLegend = true, orientation, currency: blockCurrency } = block
  const currencyCode = blockCurrency || 'USD'
  const { tooltipStyle, axisLabelStyle, axisLineStyle, splitLineStyle, isLightTheme } =
    useThemeEChartsConfig()

  // Detect variants
  const isMultiSeries = Boolean(series?.length && labels?.length)
  const isHorizontal = orientation === 'horizontal'
  const hasNegativeValues = data?.some((d) => (d.value ?? 0) < 0) ?? false

  // Generate a unique key to force ECharts remount when switching between variants or charts
  const variantKey = `${title || 'bar'}-${isMultiSeries ? 'stacked' : isHorizontal ? 'horizontal' : hasNegativeValues ? 'diverging' : 'vertical'}`

  const option = useMemo(() => {
    // ==========================================================================
    // Multi-Series Stacked
    // ==========================================================================
    if (isMultiSeries && series && labels) {
      const stackColors = [COLORS.amber, COLORS.blue, COLORS.emerald, COLORS.purple, COLORS.cyan]

      return {
        backgroundColor: 'transparent',
        title: getTitleConfig(title, isLightTheme),
        tooltip: {
          trigger: 'axis' as const,
          enterable: true, // Allow cursor to enter tooltip for scrolling
          backgroundColor: 'rgba(24, 24, 27, 0.95)', // Match glass-luxury-card
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          borderRadius: 12,
          padding: [16, 20],
          textStyle: { color: '#e2e8f0', fontSize: 13 },
          confine: true,
          appendToBody: true,
          hideDelay: 300,
          showDelay: 0,
          transitionDuration: 0.1,
          // Smart position: tooltip on opposite side of DATA POINT (not cursor)
          // This keeps tooltip stable when user moves cursor to scroll it
          position: function (
            point: number[],
            params: any,
            dom: HTMLElement,
            rect: any,
            size: { contentSize: number[]; viewSize: number[] }
          ) {
            const tooltipWidth = size.contentSize[0]
            const tooltipHeight = size.contentSize[1]
            const viewWidth = size.viewSize[0]
            const viewHeight = size.viewSize[1]

            // Use dataIndex to determine position (stable - doesn't change when cursor moves)
            // If data point is in left half of chart, show tooltip on right (and vice versa)
            const dataIndex = Array.isArray(params) ? params[0]?.dataIndex : params?.dataIndex
            const totalPoints = labels?.length || 1
            const isLeftHalf = dataIndex < totalPoints / 2

            const x = isLeftHalf
              ? viewWidth - tooltipWidth - 10 // Right side
              : 10 // Left side

            // Vertically center, but keep within bounds
            const y = Math.max(
              10,
              Math.min(viewHeight / 2 - tooltipHeight / 2, viewHeight - tooltipHeight - 10)
            )

            return [x, y]
          },
          extraCssText:
            'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); min-width: 280px; max-width: 380px; max-height: 60vh; overflow-y: auto; backdrop-filter: blur(12px); pointer-events: auto !important;',
          axisPointer: { type: 'shadow' },
          // Custom formatter to show ALL series values sorted by value
          formatter: (params: any[]) => {
            if (!params || params.length === 0) return ''
            const header = `<div style="font-size:15px;font-weight:700;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(148,163,184,0.3);color:#f8fafc">${params[0].axisValue}</div>`
            const sorted = [...params].sort((a, b) => (b.value || 0) - (a.value || 0))
            const items = sorted
              .map((p) => {
                const value =
                  typeof p.value === 'number'
                    ? p.value.toLocaleString('en-US', {
                        style: 'currency',
                        currency: currencyCode,
                        currencyDisplay: 'narrowSymbol',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })
                    : p.value
                return `<div style="display:flex;justify-content:space-between;align-items:center;gap:24px;padding:6px 0;border-bottom:1px solid rgba(148,163,184,0.1)">
                <span style="display:flex;align-items:center;gap:8px">${p.marker} <span style="color:#cbd5e1">${p.seriesName}</span></span>
                <span style="font-weight:600;font-family:monospace;color:#f8fafc">${value}</span>
              </div>`
              })
              .join('')
            const total = sorted.reduce((sum, p) => sum + (p.value || 0), 0)
            const totalFormatted = total.toLocaleString('en-US', {
              style: 'currency',
              currency: currencyCode,
              currencyDisplay: 'narrowSymbol',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })
            const footer = `<div style="margin-top:12px;padding-top:10px;border-top:2px solid rgba(148,163,184,0.3);display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:700;color:#f8fafc">Total</span>
              <span style="font-weight:700;font-size:15px;font-family:monospace;color:#22c55e">${totalFormatted}</span>
            </div>`
            return `${header}<div style="margin:0 -4px">${items}</div>${footer}`
          },
        },
        legend: getLegendConfig(showLegend, isLightTheme, series.length),
        grid: {
          left: '3%',
          right: '4%',
          bottom: '10%',
          top: title || showLegend ? (series.length > 3 ? '20%' : '15%') : '8%',
          containLabel: true,
        },
        xAxis: getCategoryXAxis(labels),
        yAxis: getValueYAxis(),
        series: series.map((s, idx) => ({
          name: s.name,
          type: 'bar',
          stack: 'total',
          data: s.data,
          itemStyle: {
            color: s.color || stackColors[idx % stackColors.length],
          },
        })),
      }
    }

    // Single series modes
    if (!data?.length) return null

    // ==========================================================================
    // Horizontal Bar
    // ==========================================================================
    if (isHorizontal) {
      return {
        backgroundColor: 'transparent',
        title: getTitleConfig(title, isLightTheme),
        tooltip: {
          ...tooltipStyle,
          trigger: 'axis' as const,
          axisPointer: { type: 'shadow' },
        },
        color: colorPalette,
        grid: {
          left: '3%',
          right: '15%',
          bottom: '5%',
          top: title ? '12%' : '5%',
          containLabel: true,
        },
        xAxis: {
          type: 'value' as const,
          axisLabel: { show: false },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'category' as const,
          data: data.map((d) => d.label),
          axisLabel: { ...axisLabelStyle, fontSize: 11 },
          axisLine: { lineStyle: { color: axisLineStyle.color } },
        },
        series: [
          {
            type: 'bar',
            data: data.map((item) => ({
              value: item.value,
              itemStyle: {
                color: item.color || COLORS.emerald,
                borderRadius: 0,
              },
            })),
            barMaxWidth: 30,
            label: {
              show: true,
              position: 'right',
              formatter: (p: { value: number }) => formatCompact(p.value, currencyCode),
              color: isLightTheme ? '#6b7280' : '#9ca3af',
              fontSize: 11,
            },
          },
        ],
      }
    }

    // ==========================================================================
    // Diverging (Positive/Negative)
    // ==========================================================================
    if (hasNegativeValues) {
      return {
        backgroundColor: 'transparent',
        title: getTitleConfig(title, isLightTheme),
        tooltip: {
          ...tooltipStyle,
          trigger: 'axis' as const,
          axisPointer: { type: 'shadow' },
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '10%',
          top: title ? '20%' : '10%',
          containLabel: true,
        },
        xAxis: {
          type: 'category' as const,
          data: data.map((d) => d.label),
          axisLabel: axisLabelStyle,
          axisLine: { lineStyle: { color: axisLineStyle.color } },
        },
        yAxis: {
          type: 'value' as const,
          axisLabel: {
            ...axisLabelStyle,
            formatter: (v: number) => formatWithSign(v),
          },
          splitLine: { lineStyle: { color: splitLineStyle.color } },
        },
        series: [
          {
            type: 'bar',
            data: data.map((item) => ({
              value: item.value,
              itemStyle: {
                color: (item.value ?? 0) >= 0 ? COLORS.emerald : COLORS.red,
                borderRadius: 0,
              },
            })),
            label: {
              show: false,
            },
          },
        ],
      }
    }

    // ==========================================================================
    // Default Vertical Bar
    // ==========================================================================
    return {
      backgroundColor: 'transparent',
      title: getTitleConfig(title, isLightTheme),
      tooltip: {
        ...tooltipStyle,
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' },
      },
      color: colorPalette,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: title ? '15%' : '10%',
        containLabel: true,
      },
      xAxis: getCategoryXAxis(data.map((d) => d.label)),
      yAxis: getValueYAxis(),
      series: [
        {
          type: 'bar',
          data: data.map((item, idx) => ({
            value: item.value,
            itemStyle: {
              color: item.color || {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: colorPalette[idx % colorPalette.length] },
                  {
                    offset: 1,
                    color: adjustColorBrightness(colorPalette[idx % colorPalette.length], -20),
                  },
                ],
              },
              borderRadius: 0,
            },
          })),
          barMaxWidth: 50,
          label: {
            show: true,
            position: 'top',
            formatter: (p: { value: number }) => formatCompact(p.value, currencyCode),
            color: '#9ca3af',
            fontSize: 10,
          },
        },
      ],
    }
  }, [
    data,
    series,
    labels,
    title,
    showLegend,
    isMultiSeries,
    isHorizontal,
    hasNegativeValues,
    currencyCode,
    tooltipStyle,
    axisLabelStyle,
    axisLineStyle,
    splitLineStyle,
    isLightTheme,
  ])

  // Empty state
  if ((!data?.length && !isMultiSeries) || !option) {
    return <EmptyState message="No data available for bar chart" />
  }

  // Calculate data point count for aspect ratio
  const dataPointCount = isMultiSeries ? labels?.length || 0 : data?.length || 0
  const aspectRatio = getChartAspectRatio('bar', dataPointCount, isHorizontal)

  return (
    <div className={cn('my-4 p-4 glass-luxury-card rounded-xl max-w-4xl mx-auto', className)}>
      <ResponsiveChartContainer aspectRatio={aspectRatio}>
        {({ width, height }) => (
          <ReactECharts
            key={variantKey}
            option={option}
            style={{ width, height }}
            opts={canvasHighDpiOpts}
            notMerge={true}
          />
        )}
      </ResponsiveChartContainer>
    </div>
  )
})

BarChart.displayName = 'BarChart'
