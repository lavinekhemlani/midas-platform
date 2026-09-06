'use client'

import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useThemeTooltipStyle } from '@/components/chat/visualizations/shared/useThemeTooltip'

interface BalanceSheetWaterfallProps {
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  currency?: string
  height?: number
  className?: string
}

export function BalanceSheetWaterfall({
  totalAssets,
  totalLiabilities,
  totalEquity,
  currency = 'USD',
  height = 220,
  className,
}: BalanceSheetWaterfallProps) {
  const { theme } = useTheme()
  const isLightTheme = theme === 'light'
  const tooltipStyle = useThemeTooltipStyle()

  // Theme-aware colors
  const equityBlue = isLightTheme ? '#0D54A8' : '#66A7F3'

  const option = useMemo(() => {
    const categories = ['Liabilities', 'Equity', 'Assets']

    // Normalize values to magnitudes to ensure correct visualization regardless of accounting signs
    const absAssets = Math.abs(totalAssets)
    const absLiabilities = Math.abs(totalLiabilities)

    // Calculate equity geometry to ensure the chart connects perfectly
    const equityHeight = Math.abs(absAssets - absLiabilities)
    const equityStart = Math.min(absAssets, absLiabilities)
    const isDeficit = absLiabilities > absAssets

    const help = [
      0, // Liabilities starts at 0
      equityStart, // Equity floated
      0, // Assets starts at 0
    ]

    const values = [
      { value: absLiabilities, itemStyle: { color: '#ef4444' } },
      { value: equityHeight, itemStyle: { color: isDeficit ? '#ef4444' : equityBlue } },
      { value: absAssets, itemStyle: { color: '#10b981' } },
    ]

    const textPrimary = isLightTheme ? '#1f2937' : '#f3f4f6'
    const textSecondary = isLightTheme ? '#6b7280' : '#9ca3af'

    return {
      backgroundColor: 'transparent',
      tooltip: {
        ...tooltipStyle,
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return ''
          // Find the visible bar value (not the transparent helper)
          const valueParam = params.find((p: any) => p.seriesName === 'Value')
          if (!valueParam) return ''
          const name = valueParam.axisValue
          const value = valueParam.value
          return `<div style="font-weight:600;color:${textPrimary}">${name}</div><div style="color:${textSecondary};margin-top:4px">${formatCompactCurrency(typeof value === 'object' ? value.value : value, currency)}</div>`
        },
      },
      grid: {
        left: '3%',
        right: '3%',
        bottom: '10%',
        top: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: categories,
        splitLine: { show: false },
        axisLabel: {
          color: '#9ca3af',
          fontSize: 11,
        },
        axisLine: {
          lineStyle: { color: '#374151' },
        },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          color: '#9ca3af',
          fontSize: 10,
          formatter: (v: number) => formatCompactCurrency(v, currency),
        },
        splitLine: {
          lineStyle: { color: '#374151', type: 'dashed' as const },
        },
      },
      series: [
        {
          name: 'Helper',
          type: 'bar',
          stack: 'waterfall',
          itemStyle: {
            barBorderColor: 'rgba(0,0,0,0)',
            color: 'rgba(0,0,0,0)',
          },
          emphasis: {
            itemStyle: {
              barBorderColor: 'rgba(0,0,0,0)',
              color: 'rgba(0,0,0,0)',
            },
          },
          data: help,
        },
        {
          name: 'Value',
          type: 'bar',
          stack: 'waterfall',
          barWidth: '40%',
          data: values,
          label: {
            show: true,
            position: 'top',
            formatter: (p: { value: number }) => formatCompactCurrency(p.value, currency),
            color: '#9ca3af',
            fontSize: 10,
          },
        },
      ],
    }
  }, [totalAssets, totalLiabilities, totalEquity, currency, equityBlue, tooltipStyle, isLightTheme])

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ReactECharts
        option={option}
        style={{ width: '100%', height: '100%' }}
        opts={{ renderer: 'canvas', devicePixelRatio: 2 }}
        notMerge={true}
      />
    </div>
  )
}

export default BalanceSheetWaterfall
