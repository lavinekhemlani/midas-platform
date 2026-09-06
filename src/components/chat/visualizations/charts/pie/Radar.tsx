/**
 * @component Radar
 * @description Radar chart for multi-dimensional comparison
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
import type { ChartBlock } from '../../shared/types'

export interface RadarChartProps {
  block: ChartBlock
  className?: string
}

export const RadarChart = memo(function RadarChart({ block, className }: RadarChartProps) {
  const { title, data, currency: blockCurrency } = block
  const currencyCode = blockCurrency || 'USD'
  const { tooltipStyle, isLightTheme, axisLabelStyle } = useThemeEChartsConfig()

  const option = useMemo(() => {
    if (!data?.length) return null

    // Calculate max value for indicators
    // Round to avoid floating point precision issues (e.g., 100 * 1.2 = 120.00000000000001)
    const maxValue = Math.round(Math.max(...data.map((d) => d.value)) * 1.2)

    // Theme-reactive colors for radar
    const axisNameColor = isLightTheme ? '#374151' : '#9ca3af'
    const axisLineColor = isLightTheme ? 'rgba(0, 0, 0, 0.15)' : 'rgba(107, 114, 128, 0.3)'
    const splitLineColor = isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(107, 114, 128, 0.2)'
    const splitAreaColors = isLightTheme
      ? ['rgba(0, 0, 0, 0.02)', 'rgba(0, 0, 0, 0.04)']
      : ['rgba(107, 114, 128, 0.03)', 'rgba(107, 114, 128, 0.06)']

    return {
      backgroundColor: 'transparent',
      title: getTitleConfig(title, isLightTheme),
      tooltip: {
        ...tooltipStyle,
        formatter: (params: { value?: number[]; name?: string }) => {
          if (!params.value) return params.name || ''
          const items = data.map(
            (d, i) => `${d.label}: ${formatCompactCurrency(params.value![i], currencyCode)}`
          )
          return `<strong>${params.name || ''}</strong><br/>${items.join('<br/>')}`
        },
      },
      radar: {
        indicator: data.map((d) => ({
          name: d.label,
          max: maxValue >= 100 ? maxValue : 100,
        })),
        axisName: {
          color: axisNameColor,
          fontSize: 11,
        },
        axisLine: {
          lineStyle: { color: axisLineColor },
        },
        splitLine: {
          lineStyle: { color: splitLineColor },
        },
        splitArea: {
          areaStyle: {
            color: splitAreaColors,
          },
        },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: data.map((d) => d.value),
              name: 'Performance',
              areaStyle: { color: 'rgba(147, 51, 234, 0.25)' }, // Purple for better visibility
              lineStyle: { color: '#a855f7', width: 2 }, // Purple-500
              itemStyle: { color: '#a855f7' },
            },
          ],
        },
      ],
    }
  }, [data, tooltipStyle, isLightTheme, currencyCode])

  if (!data?.length || !option) {
    return <EmptyState message="No data available for radar chart" />
  }

  const aspectRatio = getChartAspectRatio('radar')

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

RadarChart.displayName = 'RadarChart'
