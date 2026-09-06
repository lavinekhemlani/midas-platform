'use client'

import { useMemo } from 'react'
import { useTheme } from '@/hooks/useTheme'
import {
  useThemeEChartsConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '@/components/chat/visualizations/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2 } from 'lucide-react'
import type { DepartmentRow } from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'

interface DepartmentBreakdownProps {
  data: DepartmentRow[]
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

export function DepartmentBreakdown({ data, isLoading }: DepartmentBreakdownProps) {
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
      '#f97316', // orange-alt
      '#6366f1', // indigo
    ],
    [isLightTheme]
  )

  // Horizontal bar chart for department net amounts
  const barChartOption = useMemo(() => {
    if (!data.length) return null

    // Sort by absolute net amount and take top 10
    const sortedData = [...data]
      .sort((a, b) => Math.abs(b.net_amount) - Math.abs(a.net_amount))
      .slice(0, 10)
      .reverse() // Reverse for horizontal bar (bottom to top)

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
          const idx = params[0].dataIndex
          const item = sortedData[idx]
          return `
            <div style="padding:4px 0">
              <div style="font-weight:600;margin-bottom:8px;color:#f8fafc">${item.department}</div>
              <div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0">
                <span style="color:#94a3b8">Total Debits</span>
                <span style="font-weight:600;color:#f8fafc">${formatFullCurrency(item.total_debits)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0">
                <span style="color:#94a3b8">Total Credits</span>
                <span style="font-weight:600;color:#f8fafc">${formatFullCurrency(item.total_credits)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0;border-top:1px solid rgba(255,255,255,0.1);margin-top:4px;padding-top:6px">
                <span style="color:#94a3b8;font-weight:600">Net Amount</span>
                <span style="font-weight:700;color:${item.net_amount >= 0 ? '#2FBC8B' : '#EE3D4C'}">${formatFullCurrency(item.net_amount)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0">
                <span style="color:#94a3b8">Entries</span>
                <span style="font-weight:600;color:#f8fafc">${item.entries.toLocaleString()}</span>
              </div>
            </div>
          `
        },
      },
      grid: {
        left: '3%',
        right: '15%',
        bottom: '3%',
        top: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'value' as const,
        axisLabel: {
          ...axisLabelStyle,
          formatter: (v: number) => formatCurrency(v),
        },
        splitLine: { lineStyle: { color: splitLineStyle.color } },
      },
      yAxis: {
        type: 'category' as const,
        data: sortedData.map((d) => d.department),
        axisLabel: {
          ...axisLabelStyle,
          fontSize: 11,
          width: 100,
          overflow: 'truncate' as const,
        },
        axisLine: { lineStyle: { color: splitLineStyle.color } },
      },
      series: [
        {
          type: 'bar',
          data: sortedData.map((d, index) => ({
            value: d.net_amount,
            itemStyle: {
              color:
                d.net_amount >= 0
                  ? isLightTheme
                    ? '#178E66'
                    : '#2FBC8B'
                  : isLightTheme
                    ? '#D51323'
                    : '#EE3D4C',
              borderRadius: 0,
            },
          })),
          barWidth: '60%',
          label: {
            show: true,
            position: 'right' as const,
            formatter: (params: any) => formatCurrency(params.value),
            fontSize: 10,
            color: isLightTheme ? 'rgba(55, 65, 81, 0.8)' : 'rgba(156, 163, 175, 0.9)',
          },
        },
      ],
    }
  }, [data, isLightTheme, axisLabelStyle, splitLineStyle])

  // Treemap for department visualization
  const treemapOption = useMemo(() => {
    if (!data.length) return null

    // Filter out negative values for treemap and take top entries
    const positiveData = data
      .filter((d) => d.total_debits > 0)
      .sort((a, b) => b.total_debits - a.total_debits)
      .slice(0, 12)

    if (positiveData.length === 0) return null

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'transparent',
        borderWidth: 0,
        textStyle: { color: '#e5e7eb', fontSize: 12 },
        formatter: (params: any) => {
          const item = positiveData.find((d) => d.department === params.name)
          if (!item) return ''
          return `
            <div style="padding:4px 0">
              <div style="font-weight:600;margin-bottom:8px;color:#f8fafc">${params.name}</div>
              <div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0">
                <span style="color:#94a3b8">Total Debits</span>
                <span style="font-weight:600;color:#f8fafc">${formatFullCurrency(item.total_debits)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0">
                <span style="color:#94a3b8">Entries</span>
                <span style="font-weight:600;color:#f8fafc">${item.entries.toLocaleString()}</span>
              </div>
            </div>
          `
        },
      },
      series: [
        {
          type: 'treemap',
          width: '100%',
          height: '100%',
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          label: {
            show: true,
            formatter: '{b}',
            fontSize: 11,
            color: '#fff',
            textShadowColor: 'rgba(0,0,0,0.5)',
            textShadowBlur: 2,
          },
          itemStyle: {
            borderColor: theme === 'light' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.5)',
            borderWidth: 2,
            gapWidth: 2,
          },
          data: positiveData.map((d, index) => ({
            name: d.department,
            value: d.total_debits,
            itemStyle: { color: chartColors[index % chartColors.length] },
          })),
        },
      ],
    }
  }, [data, theme, chartColors])

  if (isLoading) {
    return (
      <Card className="glass-luxury-card border border-gray-200/10">
        <CardHeader className="pb-2 pt-4 px-6">
          <CardTitle className="text-base font-bold theme-text-primary flex items-center gap-2">
            <Building2 className="w-4 h-4 text-orange-400" />
            Department Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-4">
          <div className="flex items-center justify-center h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data.length) {
    return (
      <Card className="glass-luxury-card border border-gray-200/10">
        <CardHeader className="pb-2 pt-4 px-6">
          <CardTitle className="text-base font-bold theme-text-primary flex items-center gap-2">
            <Building2 className="w-4 h-4 text-orange-400" />
            Department Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-4">
          <div className="flex items-center justify-center h-[300px] text-gray-500">
            No department dimension data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-6">
      {/* Bar Chart - Net Amount by Department */}
      <Card className="glass-luxury-card border border-gray-200/10">
        <CardHeader className="pb-2 pt-4 px-6">
          <CardTitle className="text-base font-bold theme-text-primary flex items-center gap-2">
            <Building2 className="w-4 h-4 text-orange-400" />
            Net Amount by Department
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-4">
          {barChartOption ? (
            <div style={{ height: 350 }}>
              <ReactECharts
                option={barChartOption}
                style={{ width: '100%', height: 350 }}
                opts={canvasHighDpiOpts}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-[350px] text-gray-500">
              No department data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Treemap - Department Activity */}
      <Card className="glass-luxury-card border border-gray-200/10">
        <CardHeader className="pb-2 pt-4 px-6">
          <CardTitle className="text-base font-bold theme-text-primary flex items-center gap-2">
            <Building2 className="w-4 h-4 text-theme-green" />
            Department Activity (Debits)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-4">
          {treemapOption ? (
            <div style={{ height: 350 }}>
              <ReactECharts
                option={treemapOption}
                style={{ width: '100%', height: 350 }}
                opts={canvasHighDpiOpts}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-[350px] text-gray-500">
              No department data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
