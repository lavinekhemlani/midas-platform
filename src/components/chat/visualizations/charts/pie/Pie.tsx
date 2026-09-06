/**
 * @component Pie
 * @description Pie/Donut chart for proportional data visualization
 * Styled to match /visualizations page - includes center metric for donut
 */

'use client'

import { memo, useMemo } from 'react'

import { cn } from '@/lib/utils'
import {
  COLORS,
  colorPalette,
  useThemeEChartsConfig,
  formatCompactCurrency,
  getCurrencySymbol,
  getTitleConfig,
  getPieLegendConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '../../shared'
import { EmptyState } from '../../shared/EmptyState'
import { getChartAspectRatio } from '../../shared/getChartAspectRatio'
import { ResponsiveChartContainer } from '../../shared/ResponsiveChartContainer'
import type { ChartBlock } from '../../shared/types'

export interface PieChartProps {
  block: ChartBlock
  className?: string
}

export const PieChart = memo(function PieChart({ block, className }: PieChartProps) {
  const { chartType, title, data, showLegend = true, currency: blockCurrency } = block
  const currencyCode = blockCurrency || 'USD'
  const isDonut = chartType === 'donut'
  const { tooltipStyle, isLightTheme } = useThemeEChartsConfig()

  const option = useMemo(() => {
    if (!data?.length) return null

    // Calculate total for center display
    const total = data.reduce((sum, d) => sum + d.value, 0)
    const formattedTotal = formatCompactCurrency(total, currencyCode)

    // Map colors to match visualizations page
    const pieColors = [COLORS.amber, COLORS.blue, COLORS.emerald, COLORS.purple, COLORS.cyan]

    // Chart center position - centered when no legend, adjusted for bottom legend otherwise
    const chartCenterY = showLegend ? (title ? '45%' : '42%') : '50%'

    return {
      backgroundColor: 'transparent',
      title: getTitleConfig(title, isLightTheme),
      tooltip: {
        ...tooltipStyle,
        trigger: 'item' as const,
        formatter: (params: any) => {
          const { marker, name, value, percent } = params
          const formatted = formatCompactCurrency(value, currencyCode)
          return `${marker} ${name}<br/>${formatted} (${percent}%)`
        },
      },
      legend: getPieLegendConfig(showLegend, isLightTheme, data.length),
      // Center total amount for donut charts
      graphic: isDonut
        ? {
            type: 'text',
            left: 'center',
            top: chartCenterY,
            style: {
              text: formattedTotal,
              fontSize: 24,
              fontWeight: 'bold',
              fill: COLORS.amber,
              textAlign: 'center',
            },
          }
        : undefined,
      series: [
        {
          type: 'pie',
          radius: isDonut ? ['30%', '55%'] : ['0%', '55%'],
          center: ['50%', chartCenterY],
          avoidLabelOverlap: true,
          data: data.map((item, idx) => ({
            value: item.value,
            name: item.label,
            itemStyle: {
              color: item.color || pieColors[idx % pieColors.length],
            },
          })),
          label: { show: false },
          emphasis: {
            label: {
              show: false,
            },
          },
        },
      ],
    }
  }, [data, isDonut, showLegend, title, tooltipStyle, isLightTheme, currencyCode])

  if (!data?.length || !option) {
    return <EmptyState message="No data available for pie chart" />
  }

  const aspectRatio = getChartAspectRatio('pie')

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

PieChart.displayName = 'PieChart'
