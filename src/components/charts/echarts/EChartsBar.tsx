'use client'

import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useChartThemeColors } from '../useChartThemeColors'
import { canvasHighDpiOpts } from '@/components/chat/visualizations/shared/echarts-config'

export interface BarSeriesConfig {
  key: string
  name: string
  color?: string
  stack?: string
}

export interface EChartsBarProps {
  data: Array<Record<string, any>>
  xKey: string
  series: BarSeriesConfig[]
  height?: number
  horizontal?: boolean
  formatX?: (value: any) => string
  formatY?: (value: number) => string
  showLegend?: boolean
  barWidth?: number | string
  className?: string
  title?: string
  /** Hide grid lines on value axis (default: true) */
  showGrid?: boolean
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
]

export function EChartsBar({
  data,
  xKey,
  series,
  height = 350,
  horizontal = false,
  formatX = (val) => String(val),
  formatY = (val) => val.toLocaleString(),
  showLegend = true,
  barWidth,
  className,
  title,
  showGrid = true,
}: EChartsBarProps) {
  // Get theme-reactive colors
  const { textColor, tooltipBg, tooltipBorder, tooltipText } = useChartThemeColors()

  const option = useMemo(() => {
    const categories = data.map((item) => formatX(item[xKey]))

    const chartSeries = series.map((seriesConfig: BarSeriesConfig, index) => ({
      name: seriesConfig.name,
      type: 'bar' as const,
      stack: seriesConfig.stack,
      data: data.map((item) => item[seriesConfig.key] || 0),
      barWidth,
      itemStyle: {
        color: seriesConfig.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
        borderRadius: 0,
      },
      label: {
        show: false,
      },
    }))

    const axisConfig = {
      category: {
        type: 'category' as const,
        data: categories,
        axisLabel: {
          color: textColor,
          fontSize: 11,
          ...(horizontal
            ? {
                width: 120,
                overflow: 'truncate' as const,
                ellipsis: '...',
              }
            : {
                rotate: 45,
              }),
        },
        axisLine: {
          lineStyle: { color: '#374151' },
        },
        axisTick: {
          show: false,
        },
      },
      value: {
        type: 'value' as const,
        axisLabel: {
          formatter: formatY,
          color: textColor,
          fontSize: 11,
        },
        splitLine: {
          show: showGrid,
          lineStyle: { color: '#1f2937' },
        },
        axisLine: {
          lineStyle: { color: '#374151' },
        },
      },
    }

    return {
      backgroundColor: 'transparent',
      title: title
        ? {
            text: title,
            textStyle: { color: '#9ca3af', fontSize: 14 },
          }
        : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: tooltipBg,
        borderColor: 'transparent',
        borderWidth: 0,
        textStyle: { color: tooltipText },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return ''

          let result = `<strong>${params[0].axisValue}</strong><br/>`
          params.forEach((param: any) => {
            result += `${param.marker} ${param.seriesName}: ${formatY(param.value)}<br/>`
          })
          return result
        },
      },
      legend: showLegend
        ? {
            data: series.map((s) => s.name),
            textStyle: { color: textColor },
            top: title ? 30 : 10,
          }
        : undefined,
      grid: {
        left: horizontal ? '15%' : '3%',
        right: horizontal ? '10%' : '3%',
        bottom: horizontal ? '3%' : '15%',
        top: showLegend ? (title ? 60 : 40) : title ? 30 : 10,
        containLabel: true,
      },
      xAxis: horizontal ? axisConfig.value : axisConfig.category,
      yAxis: horizontal ? axisConfig.category : axisConfig.value,
      series: chartSeries,
    }
  }, [
    data,
    xKey,
    series,
    formatX,
    formatY,
    horizontal,
    barWidth,
    showLegend,
    title,
    textColor,
    tooltipBg,
    tooltipBorder,
    tooltipText,
  ])

  return (
    <div className={cn('w-full', className)}>
      <ReactECharts
        option={option}
        style={{ height: `${height}px`, width: '100%' }}
        opts={canvasHighDpiOpts}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  )
}
