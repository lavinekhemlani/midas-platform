'use client'

import { useMemo } from 'react'
import { useTheme } from '@/hooks/useTheme'
import {
  useThemeEChartsConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '@/components/chat/visualizations/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'
import type { DocumentTypeRow } from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'

interface DocumentTypeChartProps {
  data: DocumentTypeRow[]
  isLoading: boolean
}

function formatCurrency(value: number): string {
  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (absValue >= 1_000_000) {
    return `${sign}$${(absValue / 1_000_000).toFixed(1)}M`
  }
  if (absValue >= 1_000) {
    return `${sign}$${(absValue / 1_000).toFixed(0)}K`
  }
  return `${sign}$${absValue.toFixed(0)}`
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function DocumentTypeChart({ data, isLoading }: DocumentTypeChartProps) {
  const { theme } = useTheme()
  const { axisLabelStyle, splitLineStyle, isLightTheme } = useThemeEChartsConfig()

  const chartColors = useMemo(
    () => [
      isLightTheme ? '#178E66' : '#2FBC8B', // green
      isLightTheme ? '#0D54A8' : '#66A7F3', // blue
      isLightTheme ? '#CF6900' : '#FF8100', // orange
      isLightTheme ? '#6F1CBD' : '#BF92E9', // purple
      isLightTheme ? '#D51323' : '#EE3D4C', // red
      '#06b6d4', // cyan
      '#ec4899', // pink
      '#84cc16', // lime
    ],
    [isLightTheme]
  )

  const chartOption = useMemo(() => {
    if (!data.length) return null

    // Sort by transaction count and take top 8
    const sortedData = [...data]
      .sort((a, b) => b.transaction_count - a.transaction_count)
      .slice(0, 8)

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'transparent',
        borderWidth: 0,
        textStyle: { color: '#e5e7eb', fontSize: 12 },
        formatter: (params: any) => {
          const item = sortedData[params.dataIndex]
          return `
            <div style="padding:4px 0">
              <div style="font-weight:600;margin-bottom:8px;color:#f8fafc">${params.name}</div>
              <div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0">
                <span style="color:#94a3b8">Transactions</span>
                <span style="font-weight:600;color:#f8fafc">${item.transaction_count.toLocaleString()}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0">
                <span style="color:#94a3b8">Total Debits</span>
                <span style="font-weight:600;color:#f8fafc">${formatFullCurrency(item.total_debits)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0">
                <span style="color:#94a3b8">Total Credits</span>
                <span style="font-weight:600;color:#f8fafc">${formatFullCurrency(item.total_credits)}</span>
              </div>
            </div>
          `
        },
      },
      legend: {
        type: 'scroll' as const,
        orient: 'vertical' as const,
        right: '5%',
        top: 'middle',
        textStyle: {
          color: isLightTheme ? '#374151' : '#9ca3af',
          fontSize: 11,
        },
        pageTextStyle: {
          color: isLightTheme ? '#374151' : '#9ca3af',
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 0,
            borderColor: theme === 'light' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.3)',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              color: isLightTheme ? '#374151' : '#f8fafc',
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
          data: sortedData.map((item, index) => ({
            name: item.document_type || 'Unknown',
            value: item.transaction_count,
            itemStyle: { color: chartColors[index % chartColors.length] },
          })),
        },
      ],
    }
  }, [data, theme, isLightTheme, chartColors])

  // Bar chart for debits/credits comparison
  const barChartOption = useMemo(() => {
    if (!data.length) return null

    const sortedData = [...data]
      .sort((a, b) => b.total_debits + b.total_credits - (a.total_debits + a.total_credits))
      .slice(0, 6)

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'transparent',
        borderWidth: 0,
        textStyle: { color: '#e5e7eb', fontSize: 12 },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return ''
          let content = `<div style="font-weight:600;margin-bottom:8px;color:#f8fafc">${params[0].axisValue}</div>`
          params.forEach((p: any) => {
            content += `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:2px 0">
                <span style="display:flex;align-items:center;gap:6px">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
                  <span style="color:#94a3b8">${p.seriesName}</span>
                </span>
                <span style="font-weight:600;font-family:monospace;color:#f8fafc">
                  ${formatFullCurrency(p.value)}
                </span>
              </div>
            `
          })
          return content
        },
      },
      legend: {
        show: true,
        bottom: 0,
        textStyle: { color: isLightTheme ? '#374151' : '#9ca3af', fontSize: 11 },
        itemWidth: 12,
        itemHeight: 12,
        icon: 'circle',
      },
      grid: {
        left: '3%',
        right: '3%',
        bottom: '15%',
        top: '5%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: sortedData.map((d) => d.document_type || 'Unknown'),
        axisLabel: { ...axisLabelStyle, fontSize: 10, rotate: 30 },
        axisLine: { lineStyle: { color: splitLineStyle.color } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          ...axisLabelStyle,
          formatter: (v: number) => formatCurrency(v),
        },
        splitLine: { lineStyle: { color: splitLineStyle.color } },
      },
      series: [
        {
          name: 'Debits',
          type: 'bar',
          data: sortedData.map((d) => d.total_debits),
          itemStyle: {
            color: isLightTheme ? '#178E66' : '#2FBC8B',
            borderRadius: 0,
          },
          barWidth: '35%',
        },
        {
          name: 'Credits',
          type: 'bar',
          data: sortedData.map((d) => d.total_credits),
          itemStyle: {
            color: isLightTheme ? '#D51323' : '#EE3D4C',
            borderRadius: 0,
          },
          barWidth: '35%',
        },
      ],
    }
  }, [data, isLightTheme, axisLabelStyle, splitLineStyle])

  if (isLoading) {
    return (
      <Card className="glass-luxury-card border border-gray-200/10">
        <CardHeader className="pb-2 pt-4 px-6">
          <CardTitle className="text-base font-bold theme-text-primary flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            Document Type Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-4">
          <div className="flex items-center justify-center h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-6">
      {/* Pie Chart - Transaction Distribution */}
      <Card className="glass-luxury-card border border-gray-200/10">
        <CardHeader className="pb-2 pt-4 px-6">
          <CardTitle className="text-base font-bold theme-text-primary flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            Transaction Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-4">
          {chartOption ? (
            <div style={{ height: 300 }}>
              <ReactECharts
                option={chartOption}
                style={{ width: '100%', height: 300 }}
                opts={canvasHighDpiOpts}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              No document type data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bar Chart - Debits vs Credits */}
      <Card className="glass-luxury-card border border-gray-200/10">
        <CardHeader className="pb-2 pt-4 px-6">
          <CardTitle className="text-base font-bold theme-text-primary flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            Debits vs Credits by Type
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-4">
          {barChartOption ? (
            <div style={{ height: 300 }}>
              <ReactECharts
                option={barChartOption}
                style={{ width: '100%', height: 300 }}
                opts={canvasHighDpiOpts}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              No document type data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
