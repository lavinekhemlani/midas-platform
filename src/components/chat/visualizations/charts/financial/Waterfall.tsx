/**
 * @component Waterfall
 * @description Waterfall chart for showing cumulative effect of sequential values
 * Styled to match /visualizations page - horizontal waterfall with proper styling
 */

'use client'

import { memo, useMemo } from 'react'

import { cn } from '@/lib/utils'
import {
  COLORS,
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

interface WaterfallDataPoint {
  label: string
  value: number
  type?: 'initial' | 'positive' | 'negative' | 'total' | 'final'
}

export interface WaterfallChartProps {
  block: ChartBlock
  className?: string
}

export const WaterfallChart = memo(function WaterfallChart({
  block,
  className,
}: WaterfallChartProps) {
  const { title, data, currency: blockCurrency } = block
  const currencyCode = blockCurrency || 'USD'
  const { tooltipStyle, axisLabelStyle, axisLineStyle, splitLineStyle, isLightTheme } =
    useThemeEChartsConfig()

  const option = useMemo(() => {
    if (!data?.length) return null

    const waterfallData = data as WaterfallDataPoint[]

    // Process waterfall data
    let cumulative = 0
    const categories: string[] = []
    const helperData: number[] = []
    const positiveData: Array<{ value: number; itemStyle: { color: string } } | number> = []
    const negativeData: Array<{ value: number; itemStyle: { color: string } } | number> = []

    waterfallData.forEach((item) => {
      categories.push(item.label)
      const type = item.type || (item.value >= 0 ? 'positive' : 'negative')

      if (type === 'initial' || type === 'total' || type === 'final') {
        helperData.push(0)
        positiveData.push({
          value: Math.abs(item.value),
          itemStyle: {
            color: type === 'initial' ? COLORS.blue : COLORS.purple,
          },
        })
        negativeData.push(0)
        cumulative = item.value
      } else if (item.value >= 0) {
        helperData.push(cumulative)
        positiveData.push({ value: item.value, itemStyle: { color: COLORS.emerald } })
        negativeData.push(0)
        cumulative += item.value
      } else {
        helperData.push(cumulative + item.value)
        positiveData.push(0)
        negativeData.push({ value: Math.abs(item.value), itemStyle: { color: COLORS.red } })
        cumulative += item.value
      }
    })

    // Add closing total if not present
    const lastItem = waterfallData[waterfallData.length - 1]
    if (lastItem?.type !== 'total' && lastItem?.type !== 'final') {
      categories.push('Closing')
      helperData.push(0)
      positiveData.push({ value: cumulative, itemStyle: { color: COLORS.purple } })
      negativeData.push(0)
    }

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
        right: '15%',
        bottom: '10%',
        top: title ? '12%' : '5%',
        containLabel: true,
      },
      xAxis: {
        type: 'value' as const,
        axisLabel: {
          ...axisLabelStyle,
          formatter: (v: number) => (v < 1000 ? `$${v.toFixed(0)}` : `$${(v / 1000).toFixed(2)}K`),
        },
        splitLine: { lineStyle: { color: splitLineStyle.color } },
      },
      yAxis: {
        type: 'category' as const,
        data: categories,
        axisLabel: { ...axisLabelStyle, fontSize: 11 },
        axisLine: { lineStyle: { color: axisLineStyle.color } },
        inverse: true,
      },
      series: [
        {
          name: 'Helper',
          type: 'bar',
          stack: 'Total',
          itemStyle: { borderColor: 'transparent', color: 'transparent' },
          emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } },
          data: helperData,
        },
        {
          name: 'Positive',
          type: 'bar',
          stack: 'Total',
          data: positiveData,
          label: {
            show: true,
            position: 'right',
            formatter: (p: { value: number }) =>
              p.value
                ? p.value < 1000
                  ? `$${p.value.toFixed(0)}`
                  : `$${(p.value / 1000).toFixed(2)}K`
                : '',
            color: isLightTheme ? '#6b7280' : '#9ca3af',
            fontSize: 10,
          },
        },
        {
          name: 'Negative',
          type: 'bar',
          stack: 'Total',
          data: negativeData,
          label: {
            show: true,
            position: 'left',
            formatter: (p: { value: number }) =>
              p.value
                ? p.value < 1000
                  ? `-$${p.value.toFixed(0)}`
                  : `-$${(p.value / 1000).toFixed(2)}K`
                : '',
            color: isLightTheme ? '#6b7280' : '#9ca3af',
            fontSize: 10,
          },
        },
      ],
    }
  }, [
    data,
    title,
    tooltipStyle,
    axisLabelStyle,
    axisLineStyle,
    splitLineStyle,
    isLightTheme,
    currencyCode,
  ])

  if (!data?.length || !option) {
    return <EmptyState message="No data available for waterfall chart" />
  }

  const aspectRatio = getChartAspectRatio('waterfall', data?.length)

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

WaterfallChart.displayName = 'WaterfallChart'
