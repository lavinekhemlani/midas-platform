'use client'

import ReactECharts from 'echarts-for-react'
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useChartThemeColors } from '../useChartThemeColors'
import { canvasHighDpiOpts } from '@/components/chat/visualizations/shared/echarts-config'
import { ChartLegend } from '../ChartLegend'

export interface LineSeriesConfig {
  key: string
  name: string
  color?: string
  smooth?: boolean
  showArea?: boolean
  showSymbol?: boolean
}

export interface EChartsLineProps {
  data: Array<Record<string, any>>
  xKey: string
  series: LineSeriesConfig[]
  height?: number
  formatX?: (value: any) => string
  formatY?: (value: number) => string
  formatAxisY?: (value: number) => string
  showLegend?: boolean
  className?: string
  legendClassName?: string
  title?: string
  showGrid?: boolean
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f97316', // orange
  '#a855f7', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
]

// Compact axis formatter (K/M notation) for Y-axis labels
function formatAxisCompact(value: number): string {
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

// Strip year from month labels (e.g., "Jan 2025" -> "Jan")
function formatMonthLabel(value: string): string {
  if (typeof value === 'string' && value.includes(' ')) {
    return value.split(' ')[0]
  }
  return value
}

export function EChartsLine({
  data,
  xKey,
  series,
  height = 350,
  formatX = (val) => String(val),
  formatY = (val) => val.toLocaleString(),
  formatAxisY,
  showLegend = true,
  className,
  legendClassName,
  title,
  showGrid = true,
}: EChartsLineProps) {
  // Track selected series for custom legend - initialize with all series enabled
  const [selectedSeries, setSelectedSeries] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    series.forEach((s) => {
      initial[s.name] = true
    })
    return initial
  })

  // Get theme-reactive colors
  const { textColor, tooltipBg, tooltipBorder, tooltipText } = useChartThemeColors()

  const option = useMemo(() => {
    const xAxisData = data.map((item) => formatMonthLabel(formatX(item[xKey])))

    return {
      animation: true,
      animationDuration: 300,
      animationEasing: 'quarticOut',
      animationDurationUpdate: 300,
      animationEasingUpdate: 'quarticOut',
      title: title
        ? {
            text: title,
            textStyle: {
              color: textColor,
              fontSize: 14,
              fontWeight: 'normal',
            },
            left: 'center',
          }
        : undefined,
      tooltip: {
        trigger: 'axis',
        backgroundColor: tooltipBg,
        borderColor: 'transparent',
        borderWidth: 0,
        textStyle: {
          color: tooltipText,
        },
        formatter: (params: any) => {
          if (!params || params.length === 0) return ''
          let result = `<div style="font-weight: 500; margin-bottom: 4px;">${params[0].axisValue}</div>`
          params.forEach((param: any) => {
            // Round to 2 decimal places to fix floating point precision issues
            const roundedValue = Math.round(param.value * 100) / 100
            result += `
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${param.color};"></span>
                  <span style="color: ${textColor}; font-size: 12px;">${param.seriesName}</span>
                </div>
                <span style="font-weight: 500; font-size: 12px;">${formatY(roundedValue)}</span>
              </div>
            `
          })
          return result
        },
      },
      // Hide native legend visually but use 'selected' to control series visibility
      legend: {
        show: false,
        data: series.map((s) => s.name),
        selected: selectedSeries,
      },
      grid: {
        left: '3%',
        right: '3%',
        bottom: '2%',
        top: title ? '8%' : '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        axisLine: {
          lineStyle: {
            color: textColor,
          },
        },
        axisTick: { show: false },
        axisLabel: {
          color: textColor,
          rotate: 45,
          interval: 0,
          fontSize: 11,
          fontFamily: 'DM Sans, sans-serif',
          overflow: 'truncate',
          width: 80,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: {
          lineStyle: {
            color: textColor,
          },
        },
        axisLabel: {
          color: textColor,
          fontSize: 11,
          fontFamily: 'DM Sans, sans-serif',
          formatter: formatAxisY || formatAxisCompact,
        },
        splitLine: {
          show: showGrid,
          lineStyle: {
            color: 'rgba(75, 85, 99, 0.2)',
            type: 'dashed',
          },
        },
      },
      series: series.map((seriesConfig: LineSeriesConfig, index) => {
        const color = seriesConfig.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
        const seriesData = data.map((item) => item[seriesConfig.key])

        return {
          name: seriesConfig.name,
          type: 'line',
          data: seriesData,
          smooth: seriesConfig.smooth !== false,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: {
            width: 2,
            color: color,
          },
          itemStyle: {
            color: color,
          },
          areaStyle: seriesConfig.showArea
            ? {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: `${color}cc` },
                    { offset: 1, color: `${color}1a` },
                  ],
                },
              }
            : undefined,
        }
      }),
    }
  }, [
    data,
    xKey,
    series,
    formatX,
    formatY,
    formatAxisY,
    title,
    textColor,
    tooltipBg,
    tooltipBorder,
    tooltipText,
    selectedSeries,
    showGrid,
  ])

  // Handle legend toggle - updates state which flows through to option.legend.selected
  const handleLegendToggle = (name: string) => {
    setSelectedSeries((prev) => ({
      ...prev,
      [name]: !prev[name],
    }))
  }

  // Build legend items from series config
  const legendItems = series.map((s, i) => ({
    name: s.name,
    color: s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }))

  return (
    <div className={cn('w-full', className)}>
      <ReactECharts
        option={option}
        style={{ height }}
        opts={canvasHighDpiOpts}
        notMerge={true}
        lazyUpdate={true}
      />
      {showLegend && (
        <div className={cn('pt-3 flex items-center justify-center', legendClassName)}>
          <ChartLegend
            items={legendItems}
            selected={selectedSeries}
            onToggle={handleLegendToggle}
            className="pt-0"
          />
        </div>
      )}
    </div>
  )
}
