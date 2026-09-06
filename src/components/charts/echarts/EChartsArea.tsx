'use client'

import ReactECharts from 'echarts-for-react'
import { useMemo, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useChartThemeColors } from '../useChartThemeColors'
import { canvasHighDpiOpts } from '@/components/chat/visualizations/shared/echarts-config'
import { ChartLegend } from '../ChartLegend'

export interface AreaSeries {
  key: string
  name: string
  color?: string
  stack?: string
}

export interface EChartsAreaProps {
  data: Array<Record<string, any>>
  xKey: string
  series: AreaSeries[]
  height?: number
  formatX?: (value: any) => string
  formatY?: (value: number) => string
  showLegend?: boolean
  gradient?: boolean
  className?: string
  title?: string
}

export function EChartsArea({
  data,
  xKey,
  series,
  height = 350,
  formatX = (val) => String(val),
  formatY = (val) => val.toLocaleString(),
  showLegend = true,
  gradient = true,
  className,
  title,
}: EChartsAreaProps) {
  // Ref for ECharts instance to dispatch legend actions
  const chartRef = useRef<any>(null)

  // Track selected series for custom legend
  const [selectedSeries, setSelectedSeries] = useState<Record<string, boolean>>({})

  // Get theme-reactive colors
  const { textColor, tooltipBg, tooltipBorder, tooltipText, gridColor } = useChartThemeColors()

  const option = useMemo(() => {
    // Default colors for series
    const defaultColors = [
      '#10b981', // emerald
      '#ef4444', // red
      '#3b82f6', // blue
      '#f59e0b', // amber
      '#8b5cf6', // violet
      '#ec4899', // pink
    ]

    // Create gradient colors for each series
    const gradientColors = series.map((s, index) => {
      const color = s.color || defaultColors[index % defaultColors.length]
      return {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: `${color}80` }, // 50% opacity at top
          { offset: 1, color: `${color}10` }, // 6% opacity at bottom
        ],
      }
    })

    return {
      title: title
        ? {
            text: title,
            left: 'center',
            textStyle: {
              color: textColor,
              fontSize: 14,
              fontWeight: 500,
            },
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
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: gridColor,
          },
        },
        formatter: (params: any) => {
          const items = Array.isArray(params) ? params : [params]
          const xValue = formatX(items[0]?.axisValue)
          const lines = items.map((item: any) => {
            const color = item.color?.colorStops?.[0]?.color.slice(0, -2) || item.color
            return `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 4px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${color};"></div>
                <span style="color: ${textColor}; font-size: 12px;">${item.seriesName}</span>
              </div>
              <span style="color: ${tooltipText}; font-weight: 500; font-size: 12px;">${formatY(item.value)}</span>
            </div>`
          })
          return `<div style="padding: 4px 0;">
            <div style="font-weight: 500; margin-bottom: 6px; color: ${tooltipText};">${xValue}</div>
            ${lines.join('')}
          </div>`
        },
      },
      // Hide native legend - using custom React legend instead
      legend: { show: false },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: title ? '15%' : '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.map((item) => item[xKey]),
        boundaryGap: false,
        axisLine: {
          lineStyle: {
            color: gridColor,
          },
        },
        axisLabel: {
          color: textColor,
          fontSize: 11,
          formatter: formatX,
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: textColor,
          fontSize: 11,
          formatter: formatY,
        },
        splitLine: {
          lineStyle: {
            color: gridColor,
            type: 'dashed',
          },
        },
      },
      series: series.map((s, index) => ({
        name: s.name,
        type: 'line',
        data: data.map((item) => item[s.key]),
        smooth: true,
        areaStyle: gradient
          ? {
              color: gradientColors[index],
            }
          : {
              color: `${s.color || defaultColors[index % defaultColors.length]}20`,
            },
        lineStyle: {
          color: s.color || defaultColors[index % defaultColors.length],
          width: 2,
        },
        itemStyle: {
          color: s.color || defaultColors[index % defaultColors.length],
        },
        emphasis: {
          focus: 'series',
        },
        stack: s.stack,
      })),
    }
  }, [
    data,
    xKey,
    series,
    formatX,
    formatY,
    gradient,
    title,
    textColor,
    tooltipBg,
    tooltipBorder,
    tooltipText,
    gridColor,
  ])

  // Default colors for series (moved outside useMemo for legend use)
  const defaultColorsForLegend = [
    '#10b981', // emerald
    '#ef4444', // red
    '#3b82f6', // blue
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
  ]

  // Handle legend toggle via ECharts dispatchAction
  const handleLegendToggle = (name: string) => {
    const instance = chartRef.current?.getEchartsInstance()
    if (instance) {
      instance.dispatchAction({ type: 'legendToggleSelect', name })
      setSelectedSeries((prev) => ({
        ...prev,
        [name]: prev[name] === false ? true : false,
      }))
    }
  }

  // Build legend items from series config
  const legendItems = series.map((s, i) => ({
    name: s.name,
    color: s.color || defaultColorsForLegend[i % defaultColorsForLegend.length],
  }))

  return (
    <div className={cn('w-full', className)}>
      <ReactECharts ref={chartRef} option={option} style={{ height }} opts={canvasHighDpiOpts} />
      {showLegend && (
        <ChartLegend items={legendItems} selected={selectedSeries} onToggle={handleLegendToggle} />
      )}
    </div>
  )
}
