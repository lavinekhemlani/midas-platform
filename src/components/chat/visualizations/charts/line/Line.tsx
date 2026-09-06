/**
 * @component LineAreaChart
 * @description Unified line/area chart with automatic single vs multi-series detection
 *
 * Behavior:
 * - Single series (data[]): Both line and area show gradient fill
 * - Multi-series (series[] + labels[]):
 *   - line: Multiple lines, no stacking
 *   - area: Stacked areas
 */

'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import {
  COLORS,
  getTitleConfig,
  ReactECharts,
  useThemeEChartsConfig,
  canvasHighDpiOpts,
} from '../../shared'
import { ChartLegend } from '@/components/charts/ChartLegend'
import { EmptyState } from '../../shared/EmptyState'
import { getChartAspectRatio } from '../../shared/getChartAspectRatio'
import { ResponsiveChartContainer } from '../../shared/ResponsiveChartContainer'
import type { ChartBlock } from '../../shared/types'

// =============================================================================
// Types
// =============================================================================

type ChartVariant = 'line' | 'area'

interface LineAreaChartProps {
  block: ChartBlock
  variant: ChartVariant
  className?: string
}

// =============================================================================
// Color Palettes
// =============================================================================

const MULTI_SERIES_COLORS = [COLORS.emerald, COLORS.blue, COLORS.purple, COLORS.amber, COLORS.cyan]

const AREA_COLORS = [
  { line: COLORS.emerald, area: 'rgba(16, 185, 129, 0.4)' },
  { line: COLORS.blue, area: 'rgba(59, 130, 246, 0.4)' },
  { line: COLORS.purple, area: 'rgba(139, 92, 246, 0.4)' },
  { line: COLORS.amber, area: 'rgba(245, 158, 11, 0.4)' },
  { line: COLORS.cyan, area: 'rgba(6, 182, 212, 0.4)' },
]

// Single series colors by variant
const SINGLE_SERIES_CONFIG = {
  line: {
    color: COLORS.amber,
    gradient: ['rgba(245, 158, 11, 0.4)', 'rgba(245, 158, 11, 0.05)'],
  },
  area: {
    color: COLORS.blue,
    gradient: ['rgba(59, 130, 246, 0.5)', 'rgba(59, 130, 246, 0.05)'],
  },
}

// =============================================================================
// Base Component
// =============================================================================

const LineAreaChart = memo(function LineAreaChart({
  block,
  variant,
  className,
}: LineAreaChartProps) {
  const { title, data, series, labels, showLegend = true, currency: blockCurrency } = block
  const currencyCode = blockCurrency || 'USD'
  const { tooltipStyle, axisLabelStyle, axisLineStyle, splitLineStyle, isLightTheme } =
    useThemeEChartsConfig()

  const isMultiSeries = Boolean(series?.length && labels?.length)

  // Tooltip locking state
  const chartRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [lockedDataIndex, setLockedDataIndex] = useState<number | null>(null)
  const isLocked = lockedDataIndex !== null

  // Track selected series for custom legend
  const [selectedSeries, setSelectedSeries] = useState<Record<string, boolean>>({})
  // Use ref so formatter always has current locked state (avoids stale closure)
  const isLockedRef = useRef(false)
  isLockedRef.current = isLocked

  // Handle chart ready - set up click event for locking
  const onChartReady = useCallback((chart: any) => {
    chartRef.current = chart

    // Click on data point to lock tooltip
    chart.on('click', (params: any) => {
      if (params.dataIndex !== undefined) {
        setLockedDataIndex(params.dataIndex)
      }
    })
  }, [])

  // Re-show tooltip when locked to ensure it stays visible
  useEffect(() => {
    if (lockedDataIndex !== null && chartRef.current) {
      const timer = setTimeout(() => {
        chartRef.current?.dispatchAction({
          type: 'showTip',
          seriesIndex: 0,
          dataIndex: lockedDataIndex,
        })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [lockedDataIndex])

  // Unlock and dismiss tooltip
  const unlockTooltip = useCallback(() => {
    setLockedDataIndex(null)
    chartRef.current?.dispatchAction({ type: 'hideTip' })
  }, [])

  // Click outside to dismiss locked tooltip
  useEffect(() => {
    if (!isLocked) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // Check if clicking the dismiss button
      if (target.closest('[data-tooltip-dismiss]')) {
        unlockTooltip()
        return
      }

      // Check if click is inside tooltip (allow scrolling)
      const tooltip = document.querySelector('.echarts-tooltip')
      if (tooltip?.contains(target)) return

      // Check if click is inside chart container (allow clicking other points)
      if (containerRef.current?.contains(target)) {
        return
      }

      // Click outside chart and tooltip - unlock
      unlockTooltip()
    }

    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isLocked, unlockTooltip])

  const option = useMemo(() => {
    // Multi-series mode
    if (isMultiSeries && series && labels) {
      return {
        backgroundColor: 'transparent',
        title: getTitleConfig(title, isLightTheme),
        tooltip: {
          trigger: 'axis' as const,
          enterable: true, // Allow cursor to enter tooltip for scrolling
          triggerOn: isLocked ? 'none' : 'mousemove', // Disable hover updates when locked
          backgroundColor: 'rgba(24, 24, 27, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          borderRadius: 12,
          padding: [16, 20],
          textStyle: { color: '#e2e8f0', fontSize: 13 },
          confine: true, // Keep tooltip within chart bounds
          appendToBody: false, // Keep tooltip inside chart container
          alwaysShowContent: isLocked, // Keep tooltip visible when locked
          showDelay: 0,
          transitionDuration: 0.1,
          extraCssText:
            'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); min-width: 280px; max-width: 320px; max-height: 200px; overflow-y: auto; overflow-x: hidden; backdrop-filter: blur(12px); pointer-events: auto !important; word-wrap: break-word;',
          axisPointer: {
            type: 'line',
            lineStyle: { color: 'rgba(148, 163, 184, 0.5)', width: 2, type: 'dashed' },
          },
          // Custom formatter to show ALL series values sorted by value
          formatter: (params: any[]) => {
            if (!params || params.length === 0) return ''
            // Use ref to get current locked state (avoids stale closure issue)
            const locked = isLockedRef.current
            // Dismiss button shown at top when locked
            const dismissButton = locked
              ? `<div style="display:flex;justify-content:flex-end;margin-bottom:8px">
                  <button data-tooltip-dismiss style="width:24px;height:24px;border:none;background:rgba(239,68,68,0.3);border-radius:4px;cursor:pointer;color:#fff;font-size:16px;font-weight:bold;line-height:1">&times;</button>
                </div>`
              : ''
            const header = `<div style="font-size:14px;font-weight:700;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(148,163,184,0.3);color:#f8fafc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${params[0].axisValue}</div>`
            // Sort by value descending to show largest first
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
                return `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:4px 0;font-size:12px">
                <span style="display:flex;align-items:center;gap:6px">${p.marker} <span style="color:#cbd5e1">${p.seriesName}</span></span>
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
            const footer = `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(148,163,184,0.3);display:flex;justify-content:space-between;align-items:center;font-size:13px">
              <span style="font-weight:700;color:#f8fafc">Total</span>
              <span style="font-weight:700;font-family:monospace;color:#22c55e">${totalFormatted}</span>
            </div>`
            return `${dismissButton}${header}<div>${items}</div>${footer}`
          },
        },
        // Hide native legend - using custom React legend instead
        legend: { show: false },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          top: title ? '10%' : '5%',
          containLabel: true,
        },
        xAxis: {
          type: 'category' as const,
          boundaryGap: variant === 'line',
          data: labels,
          axisLabel: axisLabelStyle,
          axisLine: { lineStyle: { color: axisLineStyle.color } },
        },
        yAxis: {
          type: 'value' as const,
          axisLabel: {
            ...axisLabelStyle,
            formatter: (v: number) => `$${(v / 1000).toFixed(0)}K`,
          },
          splitLine: { lineStyle: { color: splitLineStyle.color } },
        },
        series: series.map((s, idx) => {
          const colors = AREA_COLORS[idx % AREA_COLORS.length]
          const lineColor = s.color || MULTI_SERIES_COLORS[idx % MULTI_SERIES_COLORS.length]

          return {
            name: s.name,
            type: 'line',
            data: s.data,
            smooth: true,
            // Stack only for area variant
            stack: variant === 'area' ? 'Total' : undefined,
            // Area fill only for area variant in multi-series
            areaStyle:
              variant === 'area' ? { color: s.color ? `${s.color}66` : colors.area } : undefined,
            lineStyle: { color: lineColor, width: variant === 'area' ? 2 : 3 },
            itemStyle: { color: lineColor },
          }
        }),
      }
    }

    // Single-series mode
    if (!data?.length) return null

    const config = SINGLE_SERIES_CONFIG[variant]

    return {
      backgroundColor: 'transparent',
      title: getTitleConfig(title, isLightTheme),
      tooltip: { ...tooltipStyle, trigger: 'axis' as const },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: title ? '15%' : '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        boundaryGap: variant === 'line',
        data: data.map((d) => d.label),
        axisLabel: axisLabelStyle,
        axisLine: { lineStyle: { color: axisLineStyle.color } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          ...axisLabelStyle,
          formatter: (v: number) => `$${(v / 1000).toFixed(0)}K`,
        },
        splitLine: { lineStyle: { color: splitLineStyle.color } },
      },
      series: [
        {
          type: 'line',
          data: data.map((d) => d.value),
          smooth: true,
          lineStyle: { color: config.color, width: variant === 'area' ? 2 : 3 },
          itemStyle: { color: config.color },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: config.gradient[0] },
                { offset: 1, color: config.gradient[1] },
              ],
            },
          },
        },
      ],
    }
  }, [
    data,
    series,
    labels,
    title,
    variant,
    isMultiSeries,
    tooltipStyle,
    axisLabelStyle,
    axisLineStyle,
    splitLineStyle,
    isLightTheme,
    isLocked,
  ])

  // Handle legend toggle via ECharts dispatchAction
  const handleLegendToggle = useCallback((name: string) => {
    const instance = chartRef.current
    if (instance) {
      instance.dispatchAction({ type: 'legendToggleSelect', name })
      setSelectedSeries((prev) => ({
        ...prev,
        [name]: prev[name] === false ? true : false,
      }))
    }
  }, [])

  // Build legend items from series config (only for multi-series mode)
  const legendItems = useMemo(() => {
    if (!isMultiSeries || !series) return []
    return series.map((s, idx) => ({
      name: s.name,
      color: s.color || MULTI_SERIES_COLORS[idx % MULTI_SERIES_COLORS.length],
    }))
  }, [isMultiSeries, series])

  if ((!data?.length && !series?.length) || !option) {
    return <EmptyState message={`No data available for ${variant} chart`} />
  }

  // Calculate data point count for aspect ratio
  const dataPointCount = isMultiSeries ? labels?.length || 0 : data?.length || 0
  const aspectRatio = getChartAspectRatio('line', dataPointCount)

  return (
    <div
      ref={containerRef}
      className={cn('my-4 p-4 glass-luxury-card rounded-xl max-w-4xl mx-auto', className)}
    >
      <ResponsiveChartContainer aspectRatio={aspectRatio}>
        {({ width, height }) => (
          <ReactECharts
            option={option}
            style={{ width, height }}
            opts={canvasHighDpiOpts}
            notMerge={true}
            onChartReady={onChartReady}
          />
        )}
      </ResponsiveChartContainer>
      {showLegend && isMultiSeries && legendItems.length > 0 && (
        <ChartLegend items={legendItems} selected={selectedSeries} onToggle={handleLegendToggle} />
      )}
    </div>
  )
})

LineAreaChart.displayName = 'LineAreaChart'

// =============================================================================
// Exported Wrappers
// =============================================================================

export interface ChartProps {
  block: ChartBlock
  className?: string
}

export const LineChart = memo(function LineChart({ block, className }: ChartProps) {
  return <LineAreaChart block={block} variant="line" className={className} />
})

LineChart.displayName = 'LineChart'

export const AreaChart = memo(function AreaChart({ block, className }: ChartProps) {
  return <LineAreaChart block={block} variant="area" className={className} />
})

AreaChart.displayName = 'AreaChart'
