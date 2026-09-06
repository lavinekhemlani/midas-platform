'use client'

import { useMemo } from 'react'
import { useTheme } from '@/hooks/useTheme'
import {
  useThemeEChartsConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '@/components/chat/visualizations/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, TrendingUp } from 'lucide-react'
import type {
  CustomerRow,
  MonthlyRevenueRow,
} from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'

interface TopCustomersChartProps {
  customers: CustomerRow[]
  monthlyRevenue: MonthlyRevenueRow[]
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

export function TopCustomersChart({
  customers,
  monthlyRevenue,
  isLoading,
}: TopCustomersChartProps) {
  const { theme } = useTheme()
  const { axisLabelStyle, splitLineStyle, isLightTheme } = useThemeEChartsConfig()

  const themeGreen = useMemo(() => (isLightTheme ? '#178E66' : '#2FBC8B'), [isLightTheme])
  const themeBlue = useMemo(() => (isLightTheme ? '#0D54A8' : '#66A7F3'), [isLightTheme])

  // Bar chart for top customers
  const customersChartOption = useMemo(() => {
    if (!customers.length) return null

    // Take top 8 and reverse for horizontal bar
    const topCustomers = [...customers].slice(0, 8).reverse()

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
          const customer = topCustomers[idx]
          return `
            <div style="padding:4px 0">
              <div style="font-weight:600;margin-bottom:8px;color:#f8fafc">${customer.sell_to_customer_name || customer.sell_to_customer_no}</div>
              <div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0">
                <span style="color:#94a3b8">Customer No</span>
                <span style="font-weight:600;color:#f8fafc">${customer.sell_to_customer_no}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0">
                <span style="color:#94a3b8">Invoice Count</span>
                <span style="font-weight:600;color:#f8fafc">${customer.invoice_count.toLocaleString()}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0;border-top:1px solid rgba(255,255,255,0.1);margin-top:4px;padding-top:6px">
                <span style="color:#94a3b8;font-weight:600">Total Revenue</span>
                <span style="font-weight:700;color:#2FBC8B">${formatFullCurrency(customer.total_revenue)}</span>
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
        data: topCustomers.map((c) => c.sell_to_customer_name || c.sell_to_customer_no),
        axisLabel: {
          ...axisLabelStyle,
          fontSize: 10,
          width: 100,
          overflow: 'truncate' as const,
        },
        axisLine: { lineStyle: { color: splitLineStyle.color } },
      },
      series: [
        {
          type: 'bar',
          data: topCustomers.map((c) => ({
            value: c.total_revenue,
            itemStyle: {
              color: themeGreen,
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
  }, [customers, themeGreen, isLightTheme, axisLabelStyle, splitLineStyle])

  // Line chart for monthly revenue trend
  const revenueChartOption = useMemo(() => {
    if (!monthlyRevenue.length) return null

    // Reverse to show oldest first
    const sortedData = [...monthlyRevenue].reverse()
    const months = sortedData.map((row) => {
      const date = new Date(row.month)
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    })

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'transparent',
        borderWidth: 0,
        textStyle: { color: '#e5e7eb', fontSize: 12 },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return ''
          const idx = params[0].dataIndex
          const data = sortedData[idx]
          return `
            <div style="padding:4px 0">
              <div style="font-weight:600;margin-bottom:8px;color:#f8fafc">${params[0].axisValue}</div>
              <div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0">
                <span style="color:#94a3b8">Invoice Count</span>
                <span style="font-weight:600;color:#f8fafc">${data.invoice_count.toLocaleString()}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0">
                <span style="color:#94a3b8">Total Revenue</span>
                <span style="font-weight:600;color:#2FBC8B">${formatFullCurrency(data.total_revenue)}</span>
              </div>
            </div>
          `
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
        top: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: months,
        axisLabel: { ...axisLabelStyle, fontSize: 10, rotate: 45 },
        axisLine: { lineStyle: { color: splitLineStyle.color } },
      },
      yAxis: [
        {
          type: 'value' as const,
          name: 'Revenue',
          axisLabel: {
            ...axisLabelStyle,
            formatter: (v: number) => formatCurrency(v),
          },
          splitLine: { lineStyle: { color: splitLineStyle.color } },
        },
        {
          type: 'value' as const,
          name: 'Invoices',
          axisLabel: axisLabelStyle,
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'Revenue',
          type: 'bar',
          data: sortedData.map((row) => row.total_revenue),
          itemStyle: {
            color: themeGreen,
            borderRadius: 0,
          },
          barWidth: '50%',
        },
        {
          name: 'Invoices',
          type: 'line',
          yAxisIndex: 1,
          data: sortedData.map((row) => row.invoice_count),
          smooth: true,
          showSymbol: false,
          lineStyle: { color: themeBlue, width: 2 },
          itemStyle: { color: themeBlue },
        },
      ],
    }
  }, [monthlyRevenue, themeGreen, themeBlue, isLightTheme, axisLabelStyle, splitLineStyle])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-6">
        <Card className="glass-luxury-card border border-gray-200/10">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-base font-bold theme-text-primary flex items-center gap-2">
              <Users className="w-4 h-4 text-theme-green" />
              Top Customers
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="flex items-center justify-center h-[300px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-luxury-card border border-gray-200/10">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-base font-bold theme-text-primary flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-theme-blue" />
              Monthly Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="flex items-center justify-center h-[300px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-6">
      {/* Top Customers */}
      <Card className="glass-luxury-card border border-gray-200/10">
        <CardHeader className="pb-2 pt-4 px-6">
          <CardTitle className="text-base font-bold theme-text-primary flex items-center gap-2">
            <Users className="w-4 h-4 text-theme-green" />
            Top Customers by Revenue
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-4">
          {customersChartOption ? (
            <div style={{ height: 320 }}>
              <ReactECharts
                option={customersChartOption}
                style={{ width: '100%', height: 320 }}
                opts={canvasHighDpiOpts}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-gray-500">
              No customer data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Revenue Trend */}
      <Card className="glass-luxury-card border border-gray-200/10">
        <CardHeader className="pb-2 pt-4 px-6">
          <CardTitle className="text-base font-bold theme-text-primary flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-theme-blue" />
            Monthly Sales Trend
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-4">
          {revenueChartOption ? (
            <div style={{ height: 320 }}>
              <ReactECharts
                option={revenueChartOption}
                style={{ width: '100%', height: 320 }}
                opts={canvasHighDpiOpts}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-gray-500">
              No monthly revenue data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
