'use client'

import { memo, useMemo } from 'react'
import {
  useThemeEChartsConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '@/components/chat/visualizations/shared'

interface BalanceSheetSankeyProps {
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  formatCurrency: (value: number) => string
  height?: number
}

export const BalanceSheetSankey = memo(function BalanceSheetSankey({
  totalAssets,
  totalLiabilities,
  totalEquity,
  formatCurrency,
  height = 150,
}: BalanceSheetSankeyProps) {
  const { isLightTheme } = useThemeEChartsConfig()

  // Theme-aware colors
  const themeGreen = isLightTheme ? '#178E66' : '#2FBC8B'
  const themeRed = isLightTheme ? '#D51323' : '#EE3D4C'
  const COLORS = {
    assets: themeGreen,
    liabilities: themeRed,
    equity: isLightTheme ? '#0D54A8' : '#66A7F3', // theme-aware blue
  }

  const option = useMemo(() => {
    // Need positive values for Sankey
    const assets = Math.abs(totalAssets)
    const liabilities = Math.abs(totalLiabilities)
    const equity = Math.abs(totalEquity)

    if (assets === 0 || (liabilities === 0 && equity === 0)) {
      return null
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderRadius: 8,
        padding: [8, 12],
        textStyle: { color: '#e2e8f0', fontSize: 11 },
        formatter: (params: any) => {
          if (params.dataType === 'edge' && params.data) {
            return `${params.data.source} → ${params.data.target}<br/><strong>${formatCurrency(params.data.value)}</strong>`
          }
          if (params.data?.value) {
            return `<strong>${params.name}</strong><br/>${formatCurrency(params.data.value)}`
          }
          return `<strong>${params.name || ''}</strong>`
        },
      },
      series: [
        {
          type: 'sankey',
          left: '15%',
          right: '20%',
          top: '8%',
          bottom: '8%',
          nodeWidth: 16,
          nodeGap: 16,
          layoutIterations: 32,
          emphasis: { focus: 'adjacency' },
          data: [
            {
              name: 'Assets',
              value: assets,
              itemStyle: { color: COLORS.assets, borderWidth: 0 },
            },
            {
              name: 'Liabilities',
              value: liabilities,
              itemStyle: { color: COLORS.liabilities, borderWidth: 0 },
            },
            {
              name: 'Equity',
              value: equity,
              itemStyle: { color: COLORS.equity, borderWidth: 0 },
            },
          ],
          links: [
            { source: 'Assets', target: 'Liabilities', value: liabilities },
            { source: 'Assets', target: 'Equity', value: equity },
          ],
          lineStyle: {
            color: 'gradient',
            curveness: 0.5,
            opacity: 0.5,
          },
          label: {
            show: true,
            color: isLightTheme ? '#374151' : '#d1d5db',
            fontSize: 11,
            fontWeight: 500,
            formatter: '{b}',
          },
        },
      ],
    }
  }, [
    totalAssets,
    totalLiabilities,
    totalEquity,
    formatCurrency,
    isLightTheme,
    COLORS.assets,
    COLORS.liabilities,
    COLORS.equity,
  ])

  if (!option) {
    return null
  }

  return (
    <ReactECharts
      option={option}
      style={{ width: '100%', height }}
      opts={canvasHighDpiOpts}
      notMerge={true}
    />
  )
})

BalanceSheetSankey.displayName = 'BalanceSheetSankey'
