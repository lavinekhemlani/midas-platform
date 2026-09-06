/**
 * @component Scatter
 * @description Scatter plot for correlation and distribution visualization
 * Styled to match /visualizations page
 */

'use client'

import { memo, useMemo } from 'react'

import { cn } from '@/lib/utils'
import {
  COLORS,
  colorPalette,
  useThemeEChartsConfig,
  formatCompactCurrency,
  getTitleConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '../../shared'
import { EmptyState } from '../../shared/EmptyState'
import { getChartAspectRatio } from '../../shared/getChartAspectRatio'
import { ResponsiveChartContainer } from '../../shared/ResponsiveChartContainer'
import type { ChartBlock, ChartDataPoint } from '../../shared/types'

interface ScatterDataPoint extends ChartDataPoint {
  x?: number
  y?: number
}

export interface ScatterChartProps {
  block: ChartBlock
  className?: string
}

export const ScatterChart = memo(function ScatterChart({ block, className }: ScatterChartProps) {
  const { title, data, currency: blockCurrency } = block
  const currencyCode = blockCurrency || 'USD'
  const { tooltipStyle, axisLabelStyle, splitLineStyle, isLightTheme } = useThemeEChartsConfig()

  const option = useMemo(() => {
    if (!data?.length) return null

    const scatterData = data as ScatterDataPoint[]

    // Support both formats: {x, y} pairs and {label, value}
    const hasXY = scatterData[0]?.x !== undefined && scatterData[0]?.y !== undefined
    const chartData = hasXY
      ? scatterData.map((d) => [d.x!, d.y!])
      : scatterData.map((d, idx) => [idx, d.value])

    const nameTextColor = isLightTheme ? '#6b7280' : '#9ca3af'

    return {
      backgroundColor: 'transparent',
      title: getTitleConfig(title, isLightTheme),
      tooltip: {
        ...tooltipStyle,
        trigger: 'item' as const,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: title ? '15%' : '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'value' as const,
        name: hasXY ? 'X' : undefined,
        nameTextStyle: { color: nameTextColor },
        axisLabel: {
          ...axisLabelStyle,
          formatter: (v: number) => formatCompactCurrency(v, currencyCode),
        },
        splitLine: { lineStyle: { color: splitLineStyle.color } },
      },
      yAxis: {
        type: 'value' as const,
        name: hasXY ? 'Y' : undefined,
        nameTextStyle: { color: nameTextColor },
        axisLabel: {
          ...axisLabelStyle,
          formatter: (v: number) => formatCompactCurrency(v, currencyCode),
        },
        splitLine: { lineStyle: { color: splitLineStyle.color } },
      },
      series: [
        {
          type: 'scatter',
          symbolSize: 15,
          data: chartData,
          itemStyle: {
            color: COLORS.amber,
            shadowBlur: 10,
            shadowColor: 'rgba(245, 158, 11, 0.5)',
          },
        },
      ],
    }
  }, [data, title, tooltipStyle, axisLabelStyle, splitLineStyle, isLightTheme, currencyCode])

  if (!data?.length || !option) {
    return <EmptyState message="No data available for scatter chart" />
  }

  const aspectRatio = getChartAspectRatio('scatter')

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

ScatterChart.displayName = 'ScatterChart'
