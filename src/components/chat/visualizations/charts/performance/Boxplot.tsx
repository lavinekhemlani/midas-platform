/**
 * @component Boxplot
 * @description Boxplot chart for statistical distribution visualization
 */

'use client'

import { memo, useMemo } from 'react'

import { cn } from '@/lib/utils'
import {
  COLORS,
  useThemeEChartsConfig,
  formatCompactCurrency,
  ReactECharts,
  canvasHighDpiOpts,
} from '../../shared'
import { EmptyState } from '../../shared/EmptyState'
import { getChartAspectRatio } from '../../shared/getChartAspectRatio'
import { ResponsiveChartContainer } from '../../shared/ResponsiveChartContainer'
import type { ChartBlock, ChartDataPoint } from '../../shared/types'

interface BoxplotDataPoint extends ChartDataPoint {
  values?: number[]
  min?: number
  q1?: number
  q3?: number
  max?: number
}

export interface BoxplotChartProps {
  block: ChartBlock
  className?: string
}

export const BoxplotChart = memo(function BoxplotChart({ block, className }: BoxplotChartProps) {
  const { title, data, currency: blockCurrency } = block
  const currencyCode = blockCurrency || 'USD'
  const { tooltipStyle, axisLabelStyle, axisLineStyle, splitLineStyle } = useThemeEChartsConfig()

  const option = useMemo(() => {
    if (!data?.length) return null

    // Expects data array with boxplot values [min, Q1, median, Q3, max]
    const boxData = data.map(
      (d: BoxplotDataPoint) =>
        d.values || [d.min || 0, d.q1 || 0, d.value || 0, d.q3 || 0, d.max || 0]
    )

    return {
      backgroundColor: 'transparent',
      tooltip: { ...tooltipStyle, trigger: 'item' as const },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: title ? '15%' : '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: data.map((d) => d.label),
        axisLabel: axisLabelStyle,
        axisLine: { lineStyle: axisLineStyle },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          ...axisLabelStyle,
          formatter: (v: number) => formatCompactCurrency(v, currencyCode),
        },
        splitLine: { lineStyle: splitLineStyle },
      },
      series: [
        {
          type: 'boxplot',
          data: boxData,
          itemStyle: { color: COLORS.blue, borderColor: COLORS.blue },
        },
      ],
    }
  }, [data, title, tooltipStyle, axisLabelStyle, axisLineStyle, splitLineStyle, currencyCode])

  if (!data?.length || !option) {
    return <EmptyState message="No data available for boxplot chart" />
  }

  const aspectRatio = getChartAspectRatio('boxplot', data?.length)

  return (
    <div className={cn('my-4 p-4 glass-luxury-card rounded-xl max-w-4xl mx-auto', className)}>
      <ResponsiveChartContainer aspectRatio={aspectRatio}>
        {({ width, height }) => (
          <ReactECharts option={option} style={{ width, height }} opts={canvasHighDpiOpts} />
        )}
      </ResponsiveChartContainer>
    </div>
  )
})

BoxplotChart.displayName = 'BoxplotChart'
