/**
 * @component Treemap
 * @description Treemap chart for hierarchical data visualization
 */

'use client'

import { memo, useMemo } from 'react'

import { cn } from '@/lib/utils'
import {
  colorPalette,
  resolveColor,
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

interface TreemapDataPoint {
  label?: string
  name?: string
  value: number
  color?: string
  children?: TreemapDataPoint[]
}

interface ProcessedTreemapNode {
  name: string
  value: number
  children?: ProcessedTreemapNode[]
  itemStyle: { color: string }
}

export interface TreemapChartProps {
  block: ChartBlock
  className?: string
}

export const TreemapChart = memo(function TreemapChart({ block, className }: TreemapChartProps) {
  const { title, data, currency: blockCurrency } = block
  const currencyCode = blockCurrency || 'USD'
  const { tooltipStyle, isLightTheme } = useThemeEChartsConfig()

  const option = useMemo(() => {
    if (!data?.length) return null

    const processTreemapData = (items: TreemapDataPoint[]): ProcessedTreemapNode[] =>
      items.map((d: TreemapDataPoint, idx: number) => ({
        name: d.label || d.name || `Item ${idx + 1}`,
        value: d.value,
        children: d.children ? processTreemapData(d.children) : undefined,
        itemStyle: {
          color: resolveColor(d.color, colorPalette[idx % colorPalette.length]),
        },
      }))

    return {
      backgroundColor: 'transparent',
      title: getTitleConfig(title, isLightTheme),
      tooltip: {
        ...tooltipStyle,
        formatter: (params: { name: string; value: number }) => {
          return `<strong>${params.name}</strong><br/>${formatCompactCurrency(params.value, currencyCode)}`
        },
      },
      series: [
        {
          type: 'treemap',
          width: '90%',
          height: title ? '80%' : '85%',
          top: title ? '15%' : '10%',
          roam: false,
          nodeClick: false,
          data: processTreemapData(data),
          label: {
            show: true,
            formatter: '{b}',
            color: '#fff',
            fontSize: 12,
            fontWeight: 500,
            textShadowColor: 'rgba(0,0,0,0.5)',
            textShadowBlur: 2,
          },
          upperLabel: { show: false },
          breadcrumb: { show: false },
          itemStyle: {
            borderColor: 'rgba(17, 24, 39, 0.9)',
            borderWidth: 2,
            gapWidth: 2,
          },
          levels: [
            {
              itemStyle: {
                borderColor: '#1f2937',
                borderWidth: 0,
                gapWidth: 1,
              },
              upperLabel: { show: false },
            },
            {
              itemStyle: {
                borderColor: '#374151',
                borderWidth: 5,
                gapWidth: 1,
              },
              emphasis: {
                itemStyle: { borderColor: '#6b7280' },
              },
              label: { fontSize: 10 },
            },
            {
              colorSaturation: [0.35, 0.5],
              itemStyle: {
                borderWidth: 5,
                gapWidth: 1,
                borderColorSaturation: 0.6,
              },
            },
          ],
        },
      ],
    }
  }, [data, tooltipStyle, isLightTheme, currencyCode])

  if (!data?.length || !option) {
    return <EmptyState message="No data available for treemap chart" />
  }

  const aspectRatio = getChartAspectRatio('treemap')

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

TreemapChart.displayName = 'TreemapChart'
