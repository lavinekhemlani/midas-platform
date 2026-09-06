'use client'

import { useState, useMemo, useEffect } from 'react'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import {
  useShopifySummary,
  useShopifyAnalytics,
  useShopifyTags,
  useShopifyOrders,
} from '../hooks/useShopifyData'
import { ReactECharts } from '@/components/chat/visualizations/shared'
import { useTheme } from '@/hooks/useTheme'
import { PeriodPicker } from '@/app/(main)/bc/components/PeriodPicker'
import { KPIStrip } from '@/app/(main)/shopify/components/KPIStrip'
import { useShopifyDateRange } from '../hooks/useShopifyDateRange'
import type {
  ShopifyDailyTrend,
  ShopifyProductSales,
  ShopifyChannelSales,
  ShopifyPayoutEntry,
  ShopifyGeoSales,
  ShopifyDiscountPerformance,
  ShopifyReferrerSales,
  ShopifyHourlySales,
  ShopifyAOVTrendPoint,
  ShopifyDiscountTrendPoint,
  ShopifyReturnsTrendPoint,
  ShopifySessionsTrendPoint,
  ShopifyProductTypeSales,
} from '@/lib/providers/shopify/types'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  ReceiptText,
  Tag,
  Truck,
  RotateCcw,
  Loader2,
  Globe,
  Link2,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function formatCurrencyFull(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    Number.isFinite(amount) ? amount : 0
  )
}

// ─── KPI Card ─────────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
  change,
  isLight,
  valueColor,
}: {
  label: string
  value: string
  sub?: string
  change?: number | null
  isLight: boolean
  valueColor?: string
}) {
  return (
    <div>
      <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">{label}</div>
      <div
        className={cn(
          'text-[28px] font-mono font-semibold tabular-nums',
          valueColor || (isLight ? 'text-stone-900' : 'text-white')
        )}
      >
        {value}
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        {change != null && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              change >= 0
                ? isLight
                  ? 'text-emerald-600'
                  : 'text-emerald-400'
                : isLight
                  ? 'text-red-600'
                  : 'text-red-400'
            )}
          >
            {change >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        {sub && <p className="text-[11px] theme-text-secondary">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Period Selector ──────────────────────────────────────

const PERIODS = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '6m', label: '6 Months' },
  { value: '12m', label: '12 Months' },
]

// ─── Main Page ────────────────────────────────────────────

export default function ShopifyReportsPage() {
  const { connected, isLoading: connLoading } = useShopifyConnection()
  const {
    selectedPeriod,
    setSelectedPeriod,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    dateRange,
  } = useShopifyDateRange()

  const {
    data: summaryData,
    isLoading: summaryLoading,
    error: summaryError,
  } = useShopifySummary(connected, dateRange)

  // Map period picker values to analytics period format
  const analyticsPeriod = useMemo(() => {
    switch (selectedPeriod) {
      case 'last_7_days':
        return '7d'
      case 'last_30_days':
        return '30d'
      case 'last_90_days':
        return '90d'
      case 'last_6_months':
        return '6m'
      case 'last_12_months':
      case 'last_year':
        return '12m'
      case 'this_month':
        return 'this_month'
      case 'this_quarter':
        return 'this_quarter'
      case 'this_year':
        return 'this_year'
      default:
        return '30d'
    }
  }, [selectedPeriod])

  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    error: analyticsError,
  } = useShopifyAnalytics(connected, analyticsPeriod, dateRange)
  const { data: tagsData, isLoading: tagsLoading } = useShopifyTags(connected, dateRange)
  const { data: ordersData, isLoading: ordersLoading } = useShopifyOrders(connected, dateRange)
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(
      (summaryLoading && !summaryData) || (analyticsLoading && !analyticsData)
    )
  }, [summaryLoading, summaryData, analyticsLoading, analyticsData, welcomeContext])
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const isDark = !isLight

  if (connLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#7AB55C]" />
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm theme-text-secondary">
          No Shopify connection found. Please connect via Settings.
        </p>
      </div>
    )
  }

  const shop = summaryData?.shop
  const summary = summaryData?.summary
  const financials = summaryData?.financials
  // ShopifyQL authoritative breakdown from summary route (matches Shopify dashboard)
  const salesBreakdown = (summaryData as any)?.salesBreakdown as {
    grossSales: number
    discounts: number
    returns: number
    netSales: number
    taxes: number
    shipping: number
    totalSales: number
    orders: number
  } | null
  const kpiSparklines = (summaryData as any)?.kpiSparklines as {
    grossSales: number[]
    netSales: number[]
    orders: number[]
    discounts: number[]
    returns: number[]
    taxes: number[]
    shipping: number[]
  } | null
  const prevPeriod = (summaryData as any)?.prevPeriod as {
    grossSales: number
    netSales: number
    orders: number
    discounts: number
    returns: number
    taxes: number
    shipping: number
  } | null
  const cur = financials?.currency || summary?.orders?.currency || 'USD'

  // Helper for change %
  const pctChange = (current: number, prev: number) =>
    prev > 0 ? Math.round(((current - prev) / prev) * 100) : null

  // Chart colors
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const labelColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'
  const borderClass = isLight ? 'border-stone-200' : 'border-white/[0.08]'
  const sectionHover = cn(
    'group relative z-0 hover:z-10 -mx-3 px-3 pt-4 pb-6',
    'transition-all duration-300 ease-out',
    'hover:scale-[1.02] hover:z-10 origin-center',
    isLight
      ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] hover:bg-white/80'
      : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] hover:bg-[#1e1e2e]/80'
  )
  const dividerAfter = cn(
    '@xl:pr-6 @xl:after:absolute @xl:after:right-0 @xl:after:top-4 @xl:after:bottom-4 @xl:after:w-px',
    isLight ? '@xl:after:bg-stone-200' : '@xl:after:bg-white/[0.08]'
  )

  // Revenue trend chart
  const trendData: ShopifyDailyTrend[] = analyticsData?.dailyTrend || []
  const trendXAxis = {
    type: 'category' as const,
    name: 'Date',
    nameLocation: 'middle' as const,
    nameGap: 22,
    nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
    data: trendData.map((d) => d.date),
    axisLabel: {
      color: labelColor,
      fontSize: 10,
      formatter: (v: string) => {
        const d = new Date(v)
        return `${d.getMonth() + 1}/${d.getDate()}`
      },
    },
    axisLine: { lineStyle: { color: gridColor } },
    axisTick: { show: false },
  }
  const trendTooltipStyle = {
    trigger: 'axis' as const,
    backgroundColor: isDark ? '#1c1c1c' : '#fff',
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
  }

  const salesTrendOption = {
    tooltip: {
      ...trendTooltipStyle,
      formatter: (
        params: Array<{ seriesName: string; axisValue: string; value: number; color: string }>
      ) => {
        const byName: Record<string, { value: number; color: string }> = {}
        for (const p of params) byName[p.seriesName] = { value: p.value, color: p.color }

        const row = (label: string, value: number, color: string, sign?: string) =>
          `<div style="display:flex;align-items:center;gap:6px;margin-top:2px;font-size:11px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span><span style="flex:1;opacity:0.8">${sign ? sign + ' ' : ''}${label}</span><span style="font-weight:500">${sign === '\u2212' ? '\u2212 ' : ''}${formatCurrencyFull(Math.abs(value), cur)}</span></div>`

        const header = `<div style="font-size:11px;opacity:0.6;margin-bottom:6px">${params[0].axisValue}</div>`
        const gross = row(
          'Gross Sales',
          byName['Gross Sales']?.value ?? 0,
          byName['Gross Sales']?.color ?? '#3b82f6'
        )
        const discounts = row(
          'Discounts',
          byName['Discounts']?.value ?? 0,
          byName['Discounts']?.color ?? '#ef4444',
          '\u2212'
        )
        const net = row(
          'Net Sales',
          byName['Net Sales']?.value ?? 0,
          byName['Net Sales']?.color ?? '#8b5cf6',
          '='
        )
        const shipping = row(
          'Shipping',
          byName['Shipping']?.value ?? 0,
          byName['Shipping']?.color ?? '#f59e0b',
          '+'
        )
        const taxes = row(
          'Taxes',
          byName['Taxes']?.value ?? 0,
          byName['Taxes']?.color ?? '#06b6d4',
          '+'
        )
        const divider = `<div style="border-top:1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'};margin-top:5px;padding-top:5px"></div>`
        const total = `<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${byName['Total Sales']?.color ?? '#7AB55C'}"></span><span style="flex:1">Total Sales</span><span>${formatCurrencyFull(byName['Total Sales']?.value ?? 0, cur)}</span></div>`

        return header + gross + discounts + net + shipping + taxes + divider + total
      },
    },
    legend: {
      bottom: 0,
      itemWidth: 12,
      itemHeight: 8,
      formatter: (name: string) => (name === 'Total Sales' ? `{bold|${name}}` : name),
      textStyle: {
        color: labelColor,
        fontSize: 12,
        rich: {
          bold: { fontSize: 12, fontWeight: 'bold' as const, color: isDark ? '#e0e0e0' : '#333' },
        },
      },
    },
    grid: { top: 12, right: 8, bottom: 80, left: 62 },
    xAxis: trendXAxis,
    yAxis: {
      type: 'value' as const,
      name: `Sales (${cur})`,
      nameLocation: 'middle' as const,
      nameGap: 36,
      nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      axisLabel: {
        color: labelColor,
        fontSize: 10,
        formatter: (v: number) => formatCurrency(v, cur),
      },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: [
      {
        name: 'Gross Sales',
        type: 'line',
        data: trendData.map((d) => d.grossSales),
        smooth: true,
        lineStyle: { color: '#3b82f6', width: 1.5, type: 'dotted' as const },
        itemStyle: { color: '#3b82f6' },
        emphasis: {
          focus: 'series' as const,
          lineStyle: { color: '#3b82f6', width: 2, type: 'solid' as const },
        },
        symbol: 'none',
      },
      {
        name: 'Net Sales',
        type: 'line',
        data: trendData.map((d) => d.netSales),
        smooth: true,
        lineStyle: { color: '#8b5cf6', width: 1.5, type: 'dotted' as const },
        itemStyle: { color: '#8b5cf6' },
        emphasis: {
          focus: 'series' as const,
          lineStyle: { color: '#8b5cf6', width: 2, type: 'solid' as const },
        },
        symbol: 'none',
      },
      {
        name: 'Discounts',
        type: 'line',
        data: trendData.map((d) => d.discounts),
        smooth: true,
        lineStyle: { color: '#ef4444', width: 1.5, type: 'dotted' as const },
        itemStyle: { color: '#ef4444' },
        emphasis: {
          focus: 'series' as const,
          lineStyle: { color: '#ef4444', width: 2, type: 'solid' as const },
        },
        symbol: 'none',
      },
      {
        name: 'Shipping',
        type: 'line',
        data: trendData.map((d) => d.shipping),
        smooth: true,
        lineStyle: { color: '#f59e0b', width: 1.5, type: 'dotted' as const },
        itemStyle: { color: '#f59e0b' },
        emphasis: {
          focus: 'series' as const,
          lineStyle: { color: '#f59e0b', width: 2, type: 'solid' as const },
        },
        symbol: 'none',
      },
      {
        name: 'Taxes',
        type: 'line',
        data: trendData.map((d) => d.taxes),
        smooth: true,
        lineStyle: { color: '#06b6d4', width: 1.5, type: 'dotted' as const },
        itemStyle: { color: '#06b6d4' },
        emphasis: {
          focus: 'series' as const,
          lineStyle: { color: '#06b6d4', width: 2, type: 'solid' as const },
        },
        symbol: 'none',
      },
      {
        name: 'Total Sales',
        type: 'line',
        data: trendData.map((d) => d.totalSales),
        smooth: true,
        z: 10,
        lineStyle: { color: '#7AB55C', width: 2.5 },
        itemStyle: { color: '#7AB55C' },
        emphasis: { focus: 'series' as const },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(122, 181, 92, 0.15)' },
              { offset: 1, color: 'rgba(122, 181, 92, 0.02)' },
            ],
          },
        },
        symbol: 'none',
      },
    ],
  }

  const orderVolumeTrendOption = {
    tooltip: {
      ...trendTooltipStyle,
      formatter: (params: Array<{ axisValue: string; value: number }>) => {
        const p = params[0]
        return `<div style="font-size:11px;opacity:0.6">${p.axisValue}</div>
          <div style="font-weight:600;margin-top:2px">${p.value} orders</div>`
      },
    },
    grid: { top: 12, right: 8, bottom: 44, left: 36 },
    xAxis: trendXAxis,
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: labelColor, fontSize: 10 },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: [
      {
        name: 'Orders',
        type: 'bar',
        data: trendData.map((d) => d.orders),
        barMaxWidth: 16,
        itemStyle: {
          borderRadius: 0,
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245, 158, 11, 0.7)' },
              { offset: 1, color: 'rgba(245, 158, 11, 0.25)' },
            ],
          },
        },
      },
    ],
  }

  // Top products chart
  const topProducts: ShopifyProductSales[] = analyticsData?.topProducts || []
  const topProductsOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? '#1c1c1c' : '#fff',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      formatter: (params: Array<{ name: string; value: number; dataIndex: number }>) => {
        const p = params[0]
        return `<div style="font-size:11px;opacity:0.6">${p.name}</div>
          <div style="font-weight:600;margin-top:2px">${formatCurrencyFull(p.value, cur)}</div>
          <div style="font-size:11px;opacity:0.6;margin-top:2px">${topProducts[p.dataIndex]?.orders || 0} orders</div>`
      },
    },
    grid: { top: 8, right: 8, bottom: 44, left: 140 },
    xAxis: {
      type: 'value' as const,
      name: 'Sales Amount',
      nameLocation: 'middle' as const,
      nameGap: 24,
      nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      axisLabel: {
        color: labelColor,
        fontSize: 10,
        formatter: (v: number) => formatCurrency(v, cur),
      },
      splitLine: { lineStyle: { color: gridColor } },
    },
    yAxis: {
      type: 'category' as const,
      data: topProducts.map((p) => p.name).reverse(),
      axisLabel: {
        color: labelColor,
        fontSize: 10,
        width: 130,
        overflow: 'truncate' as const,
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: 'Total Sales',
        type: 'bar',
        data: topProducts.map((p) => p.totalSales).reverse(),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(122, 181, 92, 0.6)' },
              { offset: 1, color: 'rgba(122, 181, 92, 1)' },
            ],
          },
          borderRadius: 0,
        },
        barMaxWidth: 18,
      },
    ],
  }

  // Sales by channel pie
  const salesByChannel: ShopifyChannelSales[] = analyticsData?.salesByChannel || []
  const channelColors = ['#7AB55C', '#5CBDB5', '#5B8DEF', '#F5A623', '#E86C6C', '#A78BFA']
  const channelPieOption = {
    tooltip: {
      backgroundColor: isDark ? '#1c1c1c' : '#fff',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      formatter: (params: { name: string; value: number; percent?: number }) => {
        return `<div style="font-size:11px;opacity:0.6">${params.name}</div>
          <div style="font-weight:600;margin-top:2px">${formatCurrencyFull(params.value, cur)}</div>
          <div style="font-size:11px;opacity:0.6;margin-top:2px">${params.percent?.toFixed(1)}%</div>`
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 0, borderColor: isDark ? '#1e1e2e' : '#fff', borderWidth: 2 },
        label: {
          show: true,
          position: 'outside',
          color: labelColor,
          fontSize: 10,
          formatter: '{b}',
        },
        labelLine: { lineStyle: { color: gridColor } },
        data: salesByChannel.map((c, i) => ({
          name: c.name,
          value: c.totalSales,
          itemStyle: { color: channelColors[i % channelColors.length] },
        })),
      },
    ],
  }

  // Analytics summary (ShopifyQL)
  const aSummary = analyticsData?.summary

  // Geographic data
  const geoData: ShopifyGeoSales[] = analyticsData?.salesByCountry || []
  const geoChartOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? '#1c1c1c' : '#fff',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
    },
    grid: { top: 8, right: 8, bottom: 44, left: 120 },
    xAxis: {
      type: 'value' as const,
      name: 'Sales Amount',
      nameLocation: 'middle' as const,
      nameGap: 24,
      nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      axisLabel: {
        color: labelColor,
        fontSize: 10,
        formatter: (v: number) => formatCurrency(v, cur),
      },
      splitLine: { lineStyle: { color: gridColor } },
    },
    yAxis: {
      type: 'category' as const,
      data: geoData
        .slice(0, 10)
        .map((g) => g.country)
        .reverse(),
      axisLabel: { color: labelColor, fontSize: 10, width: 110, overflow: 'truncate' as const },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: 'Sales by Country',
        type: 'bar',
        data: geoData
          .slice(0, 10)
          .map((g) => g.totalSales)
          .reverse(),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(91, 141, 239, 0.6)' },
              { offset: 1, color: 'rgba(91, 141, 239, 1)' },
            ],
          },
          borderRadius: 0,
        },
        barMaxWidth: 18,
      },
    ],
  }

  // Referrer data
  const referrerData: ShopifyReferrerSales[] = analyticsData?.salesByReferrer || []
  const referrerChartOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? '#1c1c1c' : '#fff',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
    },
    grid: { top: 8, right: 8, bottom: 44, left: 120 },
    xAxis: {
      type: 'value' as const,
      name: 'Sales Amount',
      nameLocation: 'middle' as const,
      nameGap: 24,
      nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      axisLabel: {
        color: labelColor,
        fontSize: 10,
        formatter: (v: number) => formatCurrency(v, cur),
      },
      splitLine: { lineStyle: { color: gridColor } },
    },
    yAxis: {
      type: 'category' as const,
      data: referrerData
        .slice(0, 10)
        .map((r) => r.source)
        .reverse(),
      axisLabel: { color: labelColor, fontSize: 10, width: 110, overflow: 'truncate' as const },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: 'Traffic Sales',
        type: 'bar',
        data: referrerData
          .slice(0, 10)
          .map((r) => r.totalSales)
          .reverse(),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(92, 189, 181, 0.6)' },
              { offset: 1, color: 'rgba(92, 189, 181, 1)' },
            ],
          },
          borderRadius: 0,
        },
        barMaxWidth: 18,
      },
    ],
  }

  // Hourly data
  const hourlyData: ShopifyHourlySales[] = analyticsData?.hourlySales || []
  const hourlyChartOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? '#1c1c1c' : '#fff',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
    },
    grid: { top: 12, right: 8, bottom: 52, left: 62 },
    xAxis: {
      type: 'category' as const,
      name: 'Hour of Day',
      nameLocation: 'middle' as const,
      nameGap: 22,
      nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      data: hourlyData.map((h) => {
        if (h.hour.includes('T')) {
          const d = new Date(h.hour)
          return `${d.getHours()}:00`
        }
        return h.hour
      }),
      axisLabel: {
        color: labelColor,
        fontSize: 10,
      },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      name: `Sales (${cur})`,
      nameLocation: 'middle' as const,
      nameGap: 36,
      nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      axisLabel: {
        color: labelColor,
        fontSize: 10,
        formatter: (v: number) => formatCurrency(v, cur),
      },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: [
      {
        name: 'Hourly Sales',
        type: 'bar',
        data: hourlyData.map((h) => h.totalSales),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(167, 139, 250, 0.9)' },
              { offset: 1, color: 'rgba(167, 139, 250, 0.3)' },
            ],
          },
          borderRadius: 0,
        },
        barMaxWidth: 20,
      },
    ],
  }

  // Discount data
  const discountData: ShopifyDiscountPerformance[] = analyticsData?.discountPerformance || []

  // New trend data from ShopifyQL
  const aovTrendData: ShopifyAOVTrendPoint[] = analyticsData?.aovTrend || []
  const prevAovTrendData: ShopifyAOVTrendPoint[] = analyticsData?.prevAovTrend || []
  const discountTrendData: ShopifyDiscountTrendPoint[] = analyticsData?.discountTrend || []
  const returnsTrendData: ShopifyReturnsTrendPoint[] = analyticsData?.returnsTrend || []
  const sessionsTrendData: ShopifySessionsTrendPoint[] = analyticsData?.sessionsTrend || []
  const prevSessionsTrendData: ShopifySessionsTrendPoint[] = analyticsData?.prevSessionsTrend || []
  const productTypeSalesData: ShopifyProductTypeSales[] = analyticsData?.salesByProductType || []
  const vendorSalesData: ShopifyProductTypeSales[] = analyticsData?.salesByVendor || []

  const dateFmt = (v: string) => {
    const d = new Date(v)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const dateFmtLong = (v: string) => {
    const d = new Date(v)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // AOV Trend chart — with previous period comparison
  // Align previous period data by index (day 1 vs day 1, etc.)
  const prevAovByIndex = prevAovTrendData.map((d) => d.averageOrderValue)

  const aovTrendOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? 'rgba(38, 38, 38, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e5e7eb' : '#333', fontSize: 12 },
      formatter: (params: any) => {
        const items = Array.isArray(params) ? params : [params]
        const idx = items[0]?.dataIndex ?? 0
        const current = items.find((p: any) => p.seriesName === 'Current Period')
        const prev = items.find((p: any) => p.seriesName === 'Previous Period')
        const prevDate = prevAovTrendData[idx]?.date
        const solidMarker = `<span style="display:inline-block;width:10px;height:3px;background:#8b5cf6;border-radius:1px;margin-right:6px"></span>`
        const dashedMarker = `<span style="display:inline-block;width:10px;height:0;border-top:2px dashed rgba(139,92,246,0.5);margin-right:6px"></span>`
        let html = ''
        if (current) {
          html += `<div style="font-size:11px;opacity:0.5;margin-bottom:2px">Current period</div>`
          html += `<div style="display:flex;align-items:center;font-size:12px">${solidMarker}${dateFmtLong(current.axisValue)}, <strong>${formatCurrencyFull(current.value, cur)}</strong></div>`
        }
        if (prev && prevDate) {
          html += `<div style="font-size:11px;opacity:0.5;margin-top:8px;margin-bottom:2px">Previous period</div>`
          html += `<div style="display:flex;align-items:center;font-size:12px">${dashedMarker}${dateFmtLong(prevDate)}, <strong>${formatCurrencyFull(prev.value, cur)}</strong></div>`
        }
        return html
      },
    },
    legend: {
      data: prevAovByIndex.length > 0 ? ['Current Period', 'Previous Period'] : ['Current Period'],
      bottom: 0,
      textStyle: { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', fontSize: 12 },
    },
    grid: { top: 12, right: 8, bottom: prevAovByIndex.length > 0 ? 68 : 44, left: 62 },
    xAxis: {
      type: 'category' as const,
      name: 'Date',
      nameLocation: 'middle' as const,
      nameGap: 22,
      nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      data: aovTrendData.map((d) => d.date),
      axisLabel: { color: labelColor, fontSize: 10, formatter: dateFmt },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      name: `AOV (${cur})`,
      nameLocation: 'middle' as const,
      nameGap: 36,
      nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      axisLabel: {
        color: labelColor,
        fontSize: 10,
        formatter: (v: number) => formatCurrency(v, cur),
      },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: [
      {
        name: 'Current Period',
        type: 'line',
        data: aovTrendData.map((d) => d.averageOrderValue),
        smooth: true,
        lineStyle: { color: '#8b5cf6', width: 2 },
        itemStyle: { color: '#8b5cf6' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(139, 92, 246, 0.2)' },
              { offset: 1, color: 'rgba(139, 92, 246, 0.02)' },
            ],
          },
        },
        symbol: 'none',
      },
      ...(prevAovByIndex.length > 0
        ? [
            {
              name: 'Previous Period',
              type: 'line',
              data: prevAovByIndex,
              smooth: true,
              lineStyle: { color: '#8b5cf6', width: 1.5, type: 'dashed' as const, opacity: 0.4 },
              itemStyle: { color: '#8b5cf6', opacity: 0.4 },
              symbol: 'none',
            },
          ]
        : []),
    ],
  }

  // Discount trend chart (dual axis)
  const discountTrendOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? '#1c1c1c' : '#fff',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
    },
    legend: {
      data: ['Discount Amount', 'Orders w/ Discount'],
      textStyle: { color: labelColor, fontSize: 12 },
      bottom: 0,
    },
    grid: { top: 12, right: 44, bottom: 72, left: 62 },
    xAxis: {
      type: 'category' as const,
      name: 'Date',
      nameLocation: 'middle' as const,
      nameGap: 22,
      nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      data: discountTrendData.map((d) => d.date),
      axisLabel: { color: labelColor, fontSize: 10, formatter: dateFmt },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value' as const,
        name: `Amount (${cur})`,
        nameLocation: 'middle' as const,
        nameGap: 36,
        nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
        axisLabel: {
          color: labelColor,
          fontSize: 10,
          formatter: (v: number) => formatCurrency(v, cur),
        },
        splitLine: { lineStyle: { color: gridColor } },
      },
      {
        type: 'value' as const,
        name: 'Orders',
        nameLocation: 'middle' as const,
        nameGap: 28,
        nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
        axisLabel: { color: labelColor, fontSize: 10 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Discount Amount',
        type: 'bar',
        data: discountTrendData.map((d) => Math.abs(d.discounts)),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245, 158, 11, 0.8)' },
              { offset: 1, color: 'rgba(245, 158, 11, 0.3)' },
            ],
          },
          borderRadius: 0,
        },
        barMaxWidth: 12,
      },
      {
        name: 'Orders w/ Discount',
        type: 'line',
        yAxisIndex: 1,
        data: discountTrendData.map((d) => d.orders),
        smooth: true,
        lineStyle: { color: '#f59e0b', width: 2 },
        itemStyle: { color: '#f59e0b' },
        symbol: 'circle',
        symbolSize: 4,
      },
    ],
  }

  // Returns trend chart
  const returnsTrendOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? '#1c1c1c' : '#fff',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
    },
    grid: { top: 12, right: 8, bottom: 44, left: 62 },
    xAxis: {
      type: 'category' as const,
      name: 'Date',
      nameLocation: 'middle' as const,
      nameGap: 22,
      nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      data: returnsTrendData.map((d) => d.date),
      axisLabel: { color: labelColor, fontSize: 10, formatter: dateFmt },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      name: `Returns (${cur})`,
      nameLocation: 'middle' as const,
      nameGap: 36,
      nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      axisLabel: {
        color: labelColor,
        fontSize: 10,
        formatter: (v: number) => formatCurrency(v, cur),
      },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: [
      {
        name: 'Returns',
        type: 'line',
        data: returnsTrendData.map((d) => Math.abs(d.returns)),
        smooth: true,
        lineStyle: { color: '#ef4444', width: 2 },
        itemStyle: { color: '#ef4444' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(239, 68, 68, 0.2)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.02)' },
            ],
          },
        },
        symbol: 'none',
      },
    ],
  }

  // Sessions trend chart
  // Sessions trend — with previous period comparison
  const prevSessionsByIndex = prevSessionsTrendData.map((d) => d.sessions)

  const sessionsTrendOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? 'rgba(38, 38, 38, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e5e7eb' : '#333', fontSize: 12 },
      formatter: (params: any) => {
        const items = Array.isArray(params) ? params : [params]
        const idx = items[0]?.dataIndex ?? 0
        const current = items.find((p: any) => p.seriesName === 'Current Period')
        const prev = items.find((p: any) => p.seriesName === 'Previous Period')
        const prevDate = prevSessionsTrendData[idx]?.date
        const solidMarker = `<span style="display:inline-block;width:10px;height:3px;background:#5CBDB5;border-radius:1px;margin-right:6px"></span>`
        const dashedMarker = `<span style="display:inline-block;width:10px;height:0;border-top:2px dashed rgba(92,189,181,0.5);margin-right:6px"></span>`
        let html = ''
        if (current) {
          html += `<div style="font-size:11px;opacity:0.5;margin-bottom:2px">Current period</div>`
          html += `<div style="display:flex;align-items:center;font-size:12px">${solidMarker}${dateFmtLong(current.axisValue)}, <strong>${current.value.toLocaleString()} sessions</strong></div>`
        }
        if (prev && prevDate) {
          html += `<div style="font-size:11px;opacity:0.5;margin-top:8px;margin-bottom:2px">Previous period</div>`
          html += `<div style="display:flex;align-items:center;font-size:12px">${dashedMarker}${dateFmtLong(prevDate)}, <strong>${prev.value.toLocaleString()} sessions</strong></div>`
        }
        return html
      },
    },
    legend: {
      data:
        prevSessionsByIndex.length > 0 ? ['Current Period', 'Previous Period'] : ['Current Period'],
      bottom: 0,
      textStyle: { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', fontSize: 12 },
    },
    grid: { top: 12, right: 8, bottom: prevSessionsByIndex.length > 0 ? 68 : 44, left: 50 },
    xAxis: {
      type: 'category' as const,
      name: 'Date',
      nameLocation: 'middle' as const,
      nameGap: 22,
      nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      data: sessionsTrendData.map((d) => d.date),
      axisLabel: { color: labelColor, fontSize: 10, formatter: dateFmt },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      name: 'Sessions',
      nameLocation: 'middle' as const,
      nameGap: 28,
      nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      axisLabel: { color: labelColor, fontSize: 10 },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: [
      {
        name: 'Current Period',
        type: 'line',
        data: sessionsTrendData.map((d) => d.sessions),
        smooth: true,
        lineStyle: { color: '#5CBDB5', width: 2 },
        itemStyle: { color: '#5CBDB5' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(92, 189, 181, 0.25)' },
              { offset: 1, color: 'rgba(92, 189, 181, 0.02)' },
            ],
          },
        },
        symbol: 'none',
      },
      ...(prevSessionsByIndex.length > 0
        ? [
            {
              name: 'Previous Period',
              type: 'line',
              data: prevSessionsByIndex,
              smooth: true,
              lineStyle: { color: '#5CBDB5', width: 1.5, type: 'dashed' as const, opacity: 0.4 },
              itemStyle: { color: '#5CBDB5', opacity: 0.4 },
              symbol: 'none',
            },
          ]
        : []),
    ],
  }

  // Sales by product type chart
  const ptData = productTypeSalesData.slice(0, 10)
  const productTypeOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? '#1c1c1c' : '#fff',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
    },
    grid: { top: 8, right: 8, bottom: 44, left: 140 },
    xAxis: {
      type: 'value' as const,
      name: 'Sales Amount',
      nameLocation: 'middle' as const,
      nameGap: 24,
      nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      axisLabel: {
        color: labelColor,
        fontSize: 10,
        formatter: (v: number) => formatCurrency(v, cur),
      },
      splitLine: { lineStyle: { color: gridColor } },
    },
    yAxis: {
      type: 'category' as const,
      data: ptData.map((p) => p.name).reverse(),
      axisLabel: { color: labelColor, fontSize: 10, width: 130, overflow: 'truncate' as const },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: 'Sales by Type',
        type: 'bar',
        data: ptData.map((p) => p.totalSales).reverse(),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(91, 141, 239, 0.6)' },
              { offset: 1, color: 'rgba(91, 141, 239, 1)' },
            ],
          },
          borderRadius: 0,
        },
        barMaxWidth: 18,
      },
    ],
  }

  // Sales by vendor chart
  const vData = vendorSalesData.slice(0, 10)
  const vendorOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? '#1c1c1c' : '#fff',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
    },
    grid: { top: 8, right: 8, bottom: 44, left: 140 },
    xAxis: {
      type: 'value' as const,
      name: 'Sales Amount',
      nameLocation: 'middle' as const,
      nameGap: 24,
      nameTextStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      axisLabel: {
        color: labelColor,
        fontSize: 10,
        formatter: (v: number) => formatCurrency(v, cur),
      },
      splitLine: { lineStyle: { color: gridColor } },
    },
    yAxis: {
      type: 'category' as const,
      data: vData.map((p) => p.name).reverse(),
      axisLabel: { color: labelColor, fontSize: 10, width: 130, overflow: 'truncate' as const },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: 'Sales by Vendor',
        type: 'bar',
        data: vData.map((p) => p.totalSales).reverse(),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(92, 189, 181, 0.6)' },
              { offset: 1, color: 'rgba(92, 189, 181, 1)' },
            ],
          },
          borderRadius: 0,
        },
        barMaxWidth: 18,
      },
    ],
  }

  return (
    <div className="@container space-y-20 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-10 pt-2 pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[36px] font-light theme-text-primary tracking-tight">
              {shop?.name || 'Reports'}
            </h1>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#7AB55C]/80 mt-2">
              Shopify{shop?.domain ? ` \u00b7 ${shop.domain}` : ''}
            </p>
          </div>
          <PeriodPicker
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomStartDateChange={setCustomStartDate}
            onCustomEndDateChange={setCustomEndDate}
            disabled={summaryLoading}
          />
        </div>
      </div>

      {summaryError ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-sm text-red-500">Failed to load Shopify data. Please try again.</p>
        </div>
      ) : summaryLoading && !summaryData ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#7AB55C]" />
        </div>
      ) : (
        <>
          {/* ── SALES OVERVIEW ── */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                Sales Overview
              </h2>
              <div className="h-px flex-1 section-divider-line" />
            </div>

            {/* Primary KPI strip */}
            {(() => {
              const grossSalesVal =
                salesBreakdown?.grossSales ?? aSummary?.grossSales ?? financials?.grossSales ?? 0
              const netSalesVal =
                salesBreakdown?.netSales ?? aSummary?.netSales ?? financials?.netSales ?? 0
              const ordersVal =
                salesBreakdown?.orders ?? aSummary?.orders ?? summary?.orders?.total ?? 0
              const aovVal = financials?.avgOrderValue ?? summary?.orders?.avgOrderValue ?? 0
              const prevAov =
                prevPeriod && prevPeriod.orders > 0 ? prevPeriod.grossSales / prevPeriod.orders : 0
              const discVal = salesBreakdown
                ? Math.abs(salesBreakdown.discounts)
                : (financials?.totalDiscounts ?? 0)
              const retVal = salesBreakdown
                ? Math.abs(salesBreakdown.returns)
                : (financials?.totalRefunded ?? 0)
              const fc = (v: number) => formatCurrencyFull(v, cur)

              return (
                <KPIStrip
                  isLight={isLight}
                  isLoading={summaryLoading}
                  cards={[
                    {
                      label: 'Gross Sales',
                      tooltip: {
                        description:
                          'Total line item revenue before discounts, returns, taxes, and shipping.',
                        calculationTooltip: {
                          formula: 'Sum of (line item price × quantity) for all orders',
                          components: [
                            { label: 'Gross Sales', value: fc(grossSalesVal), highlight: true },
                          ],
                        },
                        note: 'Source: ShopifyQL sales dataset',
                      },
                      kpi: {
                        value: grossSalesVal,
                        changePercent: prevPeriod
                          ? pctChange(grossSalesVal, prevPeriod.grossSales)
                          : (financials?.revenueChange ?? null),
                        sparkline: kpiSparklines?.grossSales,
                      },
                      format: (v) => formatCurrencyFull(v, cur),
                    },
                    {
                      label: 'Net Sales',
                      tooltip: {
                        description:
                          'Revenue after discounts and returns are deducted. Does not include taxes or shipping.',
                        calculationTooltip: {
                          formula: 'Gross Sales − Discounts − Returns',
                          components: [
                            { label: 'Gross Sales', value: fc(grossSalesVal) },
                            { label: '− Discounts', value: fc(discVal) },
                            { label: '− Returns', value: fc(retVal) },
                            { label: '= Net Sales', value: fc(netSalesVal), highlight: true },
                          ],
                        },
                      },
                      kpi: {
                        value: netSalesVal,
                        changePercent: prevPeriod
                          ? pctChange(netSalesVal, prevPeriod.netSales)
                          : null,
                        sparkline: kpiSparklines?.netSales,
                      },
                      format: (v) => formatCurrencyFull(v, cur),
                    },
                    {
                      label: 'Orders',
                      tooltip: {
                        description: 'Total number of orders placed during the selected period.',
                      },
                      kpi: {
                        value: ordersVal,
                        changePercent: prevPeriod ? pctChange(ordersVal, prevPeriod.orders) : null,
                        sparkline: kpiSparklines?.orders,
                      },
                      format: (v) => new Intl.NumberFormat('en-US').format(v),
                    },
                    {
                      label: 'Avg Order Value',
                      tooltip: {
                        description: 'Average revenue per order.',
                        calculationTooltip: {
                          formula: 'Total Revenue ÷ Number of Orders',
                          components: [
                            { label: 'Total Revenue', value: fc(financials?.revenue ?? 0) },
                            { label: '÷ Orders', value: String(ordersVal) },
                            { label: '= AOV', value: fc(aovVal), highlight: true },
                          ],
                        },
                      },
                      kpi: {
                        value: aovVal,
                        changePercent: prevAov > 0 ? pctChange(aovVal, prevAov) : null,
                      },
                      format: (v) => formatCurrencyFull(v, cur),
                    },
                  ]}
                />
              )
            })()}

            {/* Waterfall Breakdown + List Breakdown side by side */}
            <div
              className={cn(
                'grid @xl:grid-cols-[2fr_1fr] gap-x-8 gap-y-16 pt-4',
                isLight
                  ? '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-stone-200 @xl:[&>*:nth-child(odd)]:pr-6 @xl:[&>*:nth-child(even)]:pl-6'
                  : '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-white/[0.08] @xl:[&>*:nth-child(odd)]:pr-6 @xl:[&>*:nth-child(even)]:pl-6'
              )}
            >
              {/* Total Sales Breakdown — Waterfall Chart */}
              <section
                className={cn(
                  'group relative px-3 pt-4 pb-6',
                  'transition-all duration-300 ease-out',
                  'hover:scale-[1.02] hover:z-10 origin-center',
                  isLight
                    ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                    : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                )}
              >
                <div className="mb-3">
                  <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                    Total sales breakdown
                    <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                  </span>
                </div>
                {(() => {
                  const bd =
                    salesBreakdown ??
                    aSummary ??
                    (financials
                      ? {
                          grossSales: financials.grossSales,
                          discounts: financials.totalDiscounts,
                          returns: financials.totalRefunded,
                          netSales: financials.netSales,
                          shipping: financials.totalShipping,
                          taxes: financials.totalTax,
                        }
                      : null)
                  if (!bd) return <p className="text-xs theme-text-secondary">No data available</p>

                  const discAbs = Math.abs(bd.discounts || 0)
                  const retAbs = Math.abs(bd.returns || 0)
                  const totalSales = (bd.netSales || 0) + (bd.taxes || 0) + (bd.shipping || 0)

                  // Custom SVG Sankey
                  const W = 700
                  const H = 320
                  const nodeW = 16
                  const pad = { top: 10, bottom: 10, left: 0, right: 0 }
                  const colGap = 12

                  // Build nodes for each column
                  type SNode = { name: string; value: number; color: string; y: number; h: number }

                  const leftItems: { name: string; value: number; color: string }[] = [
                    {
                      name: 'Gross Sales',
                      value: bd.grossSales || 0,
                      color: isDark ? '#7AB55C' : '#6da44e',
                    },
                    ...(bd.shipping
                      ? [
                          {
                            name: 'Shipping',
                            value: bd.shipping,
                            color: isDark ? '#a78bfa' : '#7c3aed',
                          },
                        ]
                      : []),
                    ...(bd.taxes
                      ? [{ name: 'Taxes', value: bd.taxes, color: isDark ? '#f59e0b' : '#d97706' }]
                      : []),
                  ]
                  const midItems: { name: string; value: number; color: string }[] = [
                    {
                      name: 'Net Sales',
                      value: bd.netSales || 0,
                      color: isDark ? '#60a5fa' : '#3b82f6',
                    },
                    ...(discAbs
                      ? [
                          {
                            name: 'Discounts',
                            value: discAbs,
                            color: isDark ? '#E86C6C' : '#d45454',
                          },
                        ]
                      : []),
                    ...(retAbs
                      ? [{ name: 'Returns', value: retAbs, color: isDark ? '#E86C6C' : '#d45454' }]
                      : []),
                  ]
                  const rightItems: { name: string; value: number; color: string }[] = [
                    {
                      name: 'Total Sales',
                      value: totalSales,
                      color: isDark ? '#34d399' : '#059669',
                    },
                  ]

                  const usableH = H - pad.top - pad.bottom
                  const gap = 8
                  const minNodeH = 4

                  // Use the largest column total as the shared scale
                  const maxColTotal = Math.max(
                    leftItems.reduce((s, i) => s + i.value, 0),
                    midItems.reduce((s, i) => s + i.value, 0),
                    rightItems.reduce((s, i) => s + i.value, 0),
                    1
                  )

                  function layoutColumn(
                    items: { name: string; value: number; color: string }[]
                  ): SNode[] {
                    if (items.length === 0) return []
                    const totalGap = gap * (items.length - 1)
                    const availH = usableH - totalGap
                    const nodes: SNode[] = []
                    let y = pad.top
                    for (const it of items) {
                      const h = Math.max(minNodeH, (it.value / maxColTotal) * availH)
                      nodes.push({ ...it, y, h })
                      y += h + gap
                    }
                    return nodes
                  }

                  const leftNodes = layoutColumn(leftItems)
                  const midNodes = layoutColumn(midItems)
                  const rightNodes = layoutColumn(rightItems)

                  const col0x = pad.left
                  const col1x = W / 2 - nodeW / 2
                  const col2x = W - pad.right - nodeW

                  const nodeMap = new Map<string, { x: number; node: SNode }>()
                  for (const n of leftNodes) nodeMap.set(n.name, { x: col0x, node: n })
                  for (const n of midNodes) nodeMap.set(n.name, { x: col1x, node: n })
                  for (const n of rightNodes) nodeMap.set(n.name, { x: col2x, node: n })

                  // Track how much of each node's height is consumed by links
                  const srcOffset = new Map<string, number>()
                  const tgtOffset = new Map<string, number>()

                  type Link = { source: string; target: string; value: number }
                  const links: Link[] = [
                    { source: 'Gross Sales', target: 'Net Sales', value: bd.netSales || 0 },
                    ...(discAbs
                      ? [{ source: 'Gross Sales', target: 'Discounts', value: discAbs }]
                      : []),
                    ...(retAbs
                      ? [{ source: 'Gross Sales', target: 'Returns', value: retAbs }]
                      : []),
                    { source: 'Net Sales', target: 'Total Sales', value: bd.netSales || 0 },
                    ...(bd.shipping
                      ? [{ source: 'Shipping', target: 'Total Sales', value: bd.shipping }]
                      : []),
                    ...(bd.taxes
                      ? [{ source: 'Taxes', target: 'Total Sales', value: bd.taxes }]
                      : []),
                  ]

                  function drawFlow(link: Link): string | null {
                    const src = nodeMap.get(link.source)
                    const tgt = nodeMap.get(link.target)
                    if (!src || !tgt || link.value <= 0) return null

                    const srcProportion = src.node.value > 0 ? link.value / src.node.value : 0
                    const tgtProportion = tgt.node.value > 0 ? link.value / tgt.node.value : 0
                    const srcH = srcProportion * src.node.h
                    const tgtH = tgtProportion * tgt.node.h

                    const so = srcOffset.get(link.source) || 0
                    const to = tgtOffset.get(link.target) || 0
                    srcOffset.set(link.source, so + srcH)
                    tgtOffset.set(link.target, to + tgtH)

                    const x0 = src.x + nodeW + colGap
                    const x1 = tgt.x - colGap
                    const y0top = src.node.y + so
                    const y0bot = y0top + srcH
                    const y1top = tgt.node.y + to
                    const y1bot = y1top + tgtH

                    // Simple forward-only cubic bezier — control points at 60% across
                    const cx = (x1 - x0) * 0.6
                    return `M${x0},${y0top} C${x0 + cx},${y0top} ${x1 - cx},${y1top} ${x1},${y1top} L${x1},${y1bot} C${x1 - cx},${y1bot} ${x0 + cx},${y0bot} ${x0},${y0bot} Z`
                  }

                  function getFlowColor(src: SNode, tgt: SNode): string {
                    return `url(#grad-${src.name.replace(/\s/g, '')}-${tgt.name.replace(/\s/g, '')})`
                  }

                  const labelColor2 = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)'
                  const labelColorSub = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'

                  return (
                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 360 }}>
                      <defs>
                        {links.map((link) => {
                          const src = nodeMap.get(link.source)
                          const tgt = nodeMap.get(link.target)
                          if (!src || !tgt) return null
                          return (
                            <linearGradient
                              key={`grad-${link.source}-${link.target}`}
                              id={`grad-${link.source.replace(/\s/g, '')}-${link.target.replace(/\s/g, '')}`}
                              x1="0"
                              y1="0"
                              x2="1"
                              y2="0"
                            >
                              <stop offset="0%" stopColor={src.node.color} stopOpacity={0.35} />
                              <stop offset="100%" stopColor={tgt.node.color} stopOpacity={0.35} />
                            </linearGradient>
                          )
                        })}
                      </defs>

                      {/* Flow paths */}
                      {links.map((link) => {
                        const path = drawFlow(link)
                        if (!path) return null
                        const src = nodeMap.get(link.source)!
                        const tgt = nodeMap.get(link.target)!
                        return (
                          <path
                            key={`${link.source}-${link.target}`}
                            d={path}
                            fill={getFlowColor(src.node, tgt.node)}
                            stroke="none"
                          >
                            <title>{`${link.source} → ${link.target}: ${formatCurrencyFull(link.value, cur)}`}</title>
                          </path>
                        )
                      })}

                      {/* Node bars + labels */}
                      {[...nodeMap.entries()].map(([name, { x, node }]) => (
                        <g key={name}>
                          <rect
                            x={x}
                            y={node.y}
                            width={nodeW}
                            height={node.h}
                            rx={0}
                            fill={node.color}
                          >
                            <title>{`${name}: ${formatCurrencyFull(node.value, cur)}`}</title>
                          </rect>
                          {node.h > 20 && (
                            <>
                              <text
                                x={x < W / 2 ? x + nodeW + colGap + 4 : x - colGap - 4}
                                y={node.y + node.h / 2 - 7}
                                fill={labelColor2}
                                fontSize={11}
                                textAnchor={x < W / 2 ? 'start' : 'end'}
                                dominantBaseline="middle"
                              >
                                {name}
                              </text>
                              <text
                                x={x < W / 2 ? x + nodeW + colGap + 4 : x - colGap - 4}
                                y={node.y + node.h / 2 + 7}
                                fill={labelColorSub}
                                fontSize={10}
                                textAnchor={x < W / 2 ? 'start' : 'end'}
                                dominantBaseline="middle"
                              >
                                {formatCurrencyFull(node.value, cur)}
                              </text>
                            </>
                          )}
                          {node.h <= 20 && (
                            <text
                              x={x < W / 2 ? x + nodeW + colGap + 4 : x - colGap - 4}
                              y={node.y + node.h / 2}
                              fill={labelColor2}
                              fontSize={10}
                              textAnchor={x < W / 2 ? 'start' : 'end'}
                              dominantBaseline="middle"
                            >
                              {name} {formatCurrencyFull(node.value, cur)}
                            </text>
                          )}
                        </g>
                      ))}
                    </svg>
                  )
                })()}
              </section>

              {/* Total Sales Breakdown — List View */}
              <section
                className={cn(
                  'group relative px-3 pt-4 pb-6',
                  'transition-all duration-300 ease-out',
                  'hover:scale-[1.02] hover:z-10 origin-center',
                  isLight
                    ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                    : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                )}
              >
                <div className="mb-3">
                  <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                    Breakdown details
                    <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                  </span>
                </div>
                {(() => {
                  const bd =
                    salesBreakdown ??
                    aSummary ??
                    (financials
                      ? {
                          grossSales: financials.grossSales,
                          discounts: financials.totalDiscounts,
                          returns: financials.totalRefunded,
                          netSales: financials.netSales,
                          shipping: financials.totalShipping,
                          taxes: financials.totalTax,
                        }
                      : null)
                  if (!bd) return <p className="text-xs theme-text-secondary">No data available</p>

                  const discAbs = Math.abs(bd.discounts || 0)
                  const retAbs = Math.abs(bd.returns || 0)
                  const totalSales = (bd.netSales || 0) + (bd.taxes || 0) + (bd.shipping || 0)

                  const rows = [
                    { label: 'Gross Sales', value: bd.grossSales || 0, type: 'positive' as const },
                    { label: 'Discounts', value: discAbs, type: 'negative' as const },
                    { label: 'Returns', value: retAbs, type: 'negative' as const },
                    { label: 'Net Sales', value: bd.netSales || 0, type: 'subtotal' as const },
                    { label: 'Shipping', value: bd.shipping || 0, type: 'positive' as const },
                    { label: 'Taxes', value: bd.taxes || 0, type: 'positive' as const },
                    { label: 'Total Sales', value: totalSales, type: 'total' as const },
                  ]

                  return (
                    <div className="space-y-0">
                      {rows.map((row, i) => (
                        <div
                          key={row.label}
                          className={cn(
                            'flex items-center justify-between py-2.5 border-b',
                            isLight ? 'border-stone-100' : 'border-white/[0.04]',
                            row.type === 'total' && 'border-t-2 mt-1 pt-3',
                            row.type === 'total' &&
                              (isLight ? 'border-t-stone-300' : 'border-t-white/[0.12]'),
                            row.type === 'subtotal' && 'border-t',
                            row.type === 'subtotal' &&
                              (isLight ? 'border-t-stone-200' : 'border-t-white/[0.08]')
                          )}
                        >
                          <span
                            className={cn(
                              'text-[13px]',
                              row.type === 'total' ? 'font-semibold' : 'font-medium',
                              row.type === 'total'
                                ? isLight
                                  ? 'text-stone-900'
                                  : 'text-white'
                                : 'text-stone-500'
                            )}
                          >
                            {row.label}
                          </span>
                          <span
                            className={cn(
                              'text-[14px] font-mono tabular-nums font-semibold',
                              row.type === 'negative'
                                ? isLight
                                  ? 'text-red-600'
                                  : 'text-red-400'
                                : row.type === 'total'
                                  ? 'text-theme-green'
                                  : row.type === 'subtotal'
                                    ? isLight
                                      ? 'text-stone-900'
                                      : 'text-white'
                                    : isLight
                                      ? 'text-stone-800'
                                      : 'text-stone-200'
                            )}
                          >
                            {row.type === 'negative' ? '-' : ''}
                            {formatCurrencyFull(row.value, cur)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </section>
            </div>

            {/* Sales & Order Volume over time — side by side */}
            <div
              className={cn(
                'grid @xl:grid-cols-2 gap-x-8 gap-y-16 mt-8',
                isLight
                  ? '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-stone-200 @xl:[&>*:nth-child(odd)]:pr-6 @xl:[&>*:nth-child(even)]:pl-6'
                  : '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-white/[0.08] @xl:[&>*:nth-child(odd)]:pr-6 @xl:[&>*:nth-child(even)]:pl-6'
              )}
            >
              <section
                className={cn(
                  'group relative px-3 pt-4 pb-6',
                  'transition-all duration-300 ease-out',
                  'hover:scale-[1.02] hover:z-10 origin-center',
                  isLight
                    ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                    : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                )}
              >
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                    Total sales over time
                    <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                  </span>
                  {(salesBreakdown || aSummary) && (
                    <span
                      className={cn(
                        'text-[20px] font-mono font-semibold tabular-nums',
                        isLight ? 'text-stone-900' : 'text-white'
                      )}
                    >
                      {(() => {
                        const bd = salesBreakdown ?? aSummary!
                        return formatCurrency(
                          (bd.netSales || 0) + (bd.taxes || 0) + (bd.shipping || 0),
                          cur
                        )
                      })()}
                    </span>
                  )}
                </div>
                {analyticsLoading ? (
                  <div className="flex items-center justify-center h-[280px]">
                    <Loader2 className="w-6 h-6 animate-spin theme-text-secondary" />
                  </div>
                ) : trendData.length > 0 ? (
                  <ReactECharts
                    option={salesTrendOption}
                    style={{ width: '100%', height: 320 }}
                    opts={{ renderer: 'canvas' }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[280px]">
                    <p className="text-xs theme-text-secondary">
                      {analyticsError
                        ? 'Analytics data unavailable'
                        : 'No trend data for this period'}
                    </p>
                  </div>
                )}
              </section>

              <section
                className={cn(
                  'group relative px-3 pt-4 pb-6',
                  'transition-all duration-300 ease-out',
                  'hover:scale-[1.02] hover:z-10 origin-center',
                  isLight
                    ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                    : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                )}
              >
                <div className="mb-3">
                  <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                    Order volume over time
                    <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                  </span>
                </div>
                {analyticsLoading ? (
                  <div className="flex items-center justify-center h-[280px]">
                    <Loader2 className="w-6 h-6 animate-spin theme-text-secondary" />
                  </div>
                ) : trendData.length > 0 ? (
                  <ReactECharts
                    option={orderVolumeTrendOption}
                    style={{ width: '100%', height: 280 }}
                    opts={{ renderer: 'canvas' }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[280px]">
                    <p className="text-xs theme-text-secondary">
                      {analyticsError
                        ? 'Analytics data unavailable'
                        : 'No trend data for this period'}
                    </p>
                  </div>
                )}
              </section>
            </div>

            {/* Financial Details — Gross Profit, Products, Payments */}
            {financials && (
              <div
                className={cn(
                  'grid @xl:grid-cols-2 gap-x-8 gap-y-16 mt-8',
                  isLight
                    ? '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-stone-200 @xl:[&>*:nth-child(odd)]:pr-6 @xl:[&>*:nth-child(even)]:pl-6'
                    : '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-white/[0.08] @xl:[&>*:nth-child(odd)]:pr-6 @xl:[&>*:nth-child(even)]:pl-6'
                )}
              >
                <section
                  className={cn(
                    'group relative px-3 pt-4 pb-6',
                    'transition-all duration-300 ease-out',
                    'hover:scale-[1.02] hover:z-10 origin-center',
                    isLight
                      ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                      : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                  )}
                >
                  <div className="mb-3">
                    <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                      Financial Overview
                      <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className={cn('px-3 py-1.5', isLight ? 'bg-stone-200/40' : 'bg-white/[0.03]')}
                    >
                      <div className="text-[12px] uppercase tracking-wider font-medium mb-1 text-stone-500">
                        Gross Profit
                      </div>
                      <div className="text-[28px] font-mono font-semibold tabular-nums leading-tight mt-2 text-theme-green">
                        {formatCurrency(financials.grossProfit, cur)}
                      </div>
                    </div>
                    <div
                      className={cn('px-3 py-1.5', isLight ? 'bg-stone-200/40' : 'bg-white/[0.03]')}
                    >
                      <div className="text-[12px] uppercase tracking-wider font-medium mb-1 text-stone-500">
                        Products
                      </div>
                      <div
                        className={cn(
                          'text-[28px] font-mono font-semibold tabular-nums leading-tight mt-2',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        {summary?.products?.total ?? 0}
                      </div>
                      <div className="text-[12px] mt-0.5 text-stone-500">
                        {summary?.products?.active ?? 0} active
                      </div>
                    </div>
                  </div>
                </section>

                {financials.cashBalance != null && (
                  <section
                    className={cn(
                      'group relative px-3 pt-4 pb-6',
                      'transition-all duration-300 ease-out',
                      'hover:scale-[1.02] hover:z-10 origin-center',
                      isLight
                        ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                        : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                    )}
                  >
                    <div className="mb-3">
                      <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                        Shopify Payments
                        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                      </span>
                    </div>
                    <div className="text-[12px] uppercase tracking-wider font-medium mb-1 text-stone-500">
                      Balance
                    </div>
                    <div
                      className={cn(
                        'text-[28px] font-mono font-semibold tabular-nums leading-tight mt-2 mb-4',
                        isLight ? 'text-stone-900' : 'text-white'
                      )}
                    >
                      {formatCurrencyFull(financials.cashBalance, cur)}
                    </div>
                    {financials.recentPayouts?.length > 0 && (
                      <div>
                        <p className="text-[12px] uppercase tracking-wider text-stone-500 mb-2">
                          Recent Payouts
                        </p>
                        <table className="w-full text-[14px]">
                          <thead>
                            <tr
                              className={cn(
                                'border-b',
                                isLight ? 'border-stone-300/60' : 'border-white/[0.08]'
                              )}
                            >
                              <th className="text-left py-1.5 pr-6 font-medium text-stone-500">
                                Date
                              </th>
                              <th className="text-right py-1.5 pr-6 font-medium text-stone-500">
                                Amount
                              </th>
                              <th className="text-left py-1.5 font-medium text-stone-500">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {financials.recentPayouts.slice(0, 3).map((p: ShopifyPayoutEntry) => (
                              <tr
                                key={p.id}
                                className={cn(
                                  'border-b',
                                  isLight ? 'border-stone-200/60' : 'border-white/[0.04]'
                                )}
                              >
                                <td className="py-1.5 pr-6 font-mono tabular-nums text-stone-500">
                                  {p.date}
                                </td>
                                <td
                                  className={cn(
                                    'py-1.5 pr-6 text-right font-mono tabular-nums font-medium',
                                    isLight ? 'text-stone-900' : 'text-white'
                                  )}
                                >
                                  {formatCurrencyFull(p.amount, cur)}
                                </td>
                                <td className="py-1.5">
                                  <span
                                    className={cn(
                                      'inline-flex items-center gap-1.5 text-[14px]',
                                      p.status === 'paid'
                                        ? isLight
                                          ? 'text-emerald-600'
                                          : 'text-emerald-400'
                                        : p.status === 'in_transit'
                                          ? isLight
                                            ? 'text-yellow-600'
                                            : 'text-yellow-400'
                                          : 'text-stone-500'
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        'w-1.5 h-1.5 rounded-full',
                                        p.status === 'paid'
                                          ? 'bg-emerald-500'
                                          : p.status === 'in_transit'
                                            ? 'bg-yellow-500'
                                            : 'bg-gray-400'
                                      )}
                                    />
                                    {p.status === 'in_transit'
                                      ? 'In Transit'
                                      : p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}
            {/* Order financials KPI strip — tips, duties, A/R, gateway, edits, B2B */}
            {(() => {
              const orderSummary = (ordersData as any)?.summary as
                | {
                    tipRevenue?: number
                    dutiesCollected?: number
                    outstandingBalance?: number
                    unpaidCount?: number
                    editedCount?: number
                    editedRate?: number
                    b2bOrderCount?: number
                    dtcOrderCount?: number
                    paymentGatewayBreakdown?: Record<string, number>
                  }
                | undefined
              const tipRevenue = orderSummary?.tipRevenue ?? 0
              const dutiesCollected = orderSummary?.dutiesCollected ?? 0
              const outstandingBalance = orderSummary?.outstandingBalance ?? 0
              const unpaidCount = orderSummary?.unpaidCount ?? 0
              const editedRate = orderSummary?.editedRate ?? 0
              const editedCount = orderSummary?.editedCount ?? 0
              const b2bCount = orderSummary?.b2bOrderCount ?? 0
              const dtcCount = orderSummary?.dtcOrderCount ?? 0
              const totalClassified = b2bCount + dtcCount
              const b2bShare = totalClassified > 0 ? (b2bCount / totalClassified) * 100 : 0
              const gatewayEntries = Object.entries(
                orderSummary?.paymentGatewayBreakdown ?? {}
              ).sort((a, b) => b[1] - a[1])
              const gatewayTotal = gatewayEntries.reduce((s, [, v]) => s + v, 0)
              const topGateway = gatewayEntries[0]
              const topGatewayShare =
                topGateway && gatewayTotal > 0 ? (topGateway[1] / gatewayTotal) * 100 : 0
              const prettyGateway = (g: string) =>
                g
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, (c) => c.toUpperCase())
                  .replace(/\bshopify\b/i, 'Shopify')
                  .replace(/\bpaypal\b/i, 'PayPal')

              // Build conditional card list: hide metrics that don't apply to this store
              type CardDef = Parameters<typeof KPIStrip>[0]['cards'][number]
              const cards: CardDef[] = []
              const hiddenLabels: string[] = []

              if (tipRevenue > 0) {
                cards.push({
                  label: 'Tip Revenue',
                  tooltip: {
                    description:
                      'Sum of customer tips received across orders in the selected period. Pure-margin revenue — no COGS associated.',
                    note: 'Source: Order.totalTipReceivedSet',
                  },
                  kpi: { value: tipRevenue, changePercent: null },
                  format: (v) => formatCurrencyFull(v, cur),
                })
              } else {
                hiddenLabels.push('Tips')
              }

              if (dutiesCollected > 0) {
                cards.push({
                  label: 'Duties Collected',
                  tooltip: {
                    description:
                      'Duties collected on international orders. Only populated for stores that charge duties at checkout.',
                    note: 'Source: Order.currentTotalDutiesSet',
                  },
                  kpi: { value: dutiesCollected, changePercent: null },
                  format: (v) => formatCurrencyFull(v, cur),
                })
              } else {
                hiddenLabels.push('Duties')
              }

              if (outstandingBalance > 0 || unpaidCount > 0) {
                cards.push({
                  label: 'Outstanding A/R',
                  tooltip: {
                    description:
                      'Unpaid balance across all orders — primarily B2B invoices on net-X terms. Represents accounts receivable.',
                    calculationTooltip: {
                      formula: 'Σ Order.totalOutstanding',
                      components: [
                        {
                          label: 'Outstanding balance',
                          value: formatCurrencyFull(outstandingBalance, cur),
                          highlight: true,
                        },
                        { label: 'Unpaid orders', value: String(unpaidCount) },
                      ],
                    },
                    note: 'Source: Order.totalOutstandingSet + Order.unpaid',
                  },
                  kpi: { value: outstandingBalance, changePercent: null },
                  format: (v) => formatCurrencyFull(v, cur),
                  valueColor: isLight ? 'text-amber-700' : 'text-amber-400',
                })
              } else {
                hiddenLabels.push('Outstanding A/R')
              }

              if (topGateway) {
                cards.push({
                  label: 'Top Gateway',
                  tooltip: {
                    description:
                      'Payment gateway that processed the most orders in the period. Full breakdown shown below the KPI strip.',
                    note: 'Source: Order.paymentGatewayNames',
                  },
                  kpi: { value: topGatewayShare, changePercent: null },
                  format: (v) => `${prettyGateway(topGateway[0])} · ${Math.round(v)}%`,
                })
              }

              // Always show edited rate — 0% is a meaningful "clean operations" signal
              cards.push({
                label: 'Edited Orders',
                tooltip: {
                  description:
                    'Share of orders that were modified after creation. A persistently high rate signals upstream quality issues (wrong SKUs, pricing, etc).',
                  calculationTooltip: {
                    formula: 'Edited orders ÷ Total orders',
                    components: [
                      { label: 'Edited', value: String(editedCount) },
                      { label: '÷ Total', value: String(totalClassified || dtcCount) },
                      {
                        label: '= Rate',
                        value: `${(editedRate * 100).toFixed(1)}%`,
                        highlight: true,
                      },
                    ],
                  },
                  note: 'Source: Order.edited',
                },
                kpi: { value: editedRate * 100, changePercent: null },
                format: (v) => `${v.toFixed(1)}%`,
                invertChange: true,
              })

              if (b2bCount > 0) {
                cards.push({
                  label: 'B2B Share',
                  tooltip: {
                    description:
                      'Share of orders placed by a B2B purchasing company. Helps track B2B vs DTC channel mix.',
                    calculationTooltip: {
                      formula: 'B2B orders ÷ Total classified orders',
                      components: [
                        { label: 'B2B', value: String(b2bCount) },
                        { label: 'DTC', value: String(dtcCount) },
                        {
                          label: '= B2B share',
                          value: `${b2bShare.toFixed(1)}%`,
                          highlight: true,
                        },
                      ],
                    },
                    note: 'Source: Order.purchasingEntity',
                  },
                  kpi: { value: b2bShare, changePercent: null },
                  format: (v) => `${v.toFixed(1)}%`,
                })
              } else {
                hiddenLabels.push('B2B')
              }

              // Don't render the section if we have nothing meaningful to show
              if (cards.length === 0 && gatewayEntries.length === 0) return null

              return (
                <div className="space-y-3 pt-12">
                  <div className="flex items-baseline justify-between">
                    <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                      Order financials
                    </span>
                    <span className="text-[11px] theme-text-secondary">
                      Pulled per-order from Shopify GraphQL
                    </span>
                  </div>
                  <KPIStrip
                    isLight={isLight}
                    isLoading={ordersLoading && !ordersData}
                    cards={cards}
                  />
                  {gatewayEntries.length > 0 && (
                    <div
                      className={cn(
                        'flex flex-wrap items-center gap-2 pt-1 text-[11px]',
                        isLight ? 'text-stone-600' : 'text-gray-400'
                      )}
                    >
                      <span className="uppercase tracking-wider">Gateway mix:</span>
                      {gatewayEntries.map(([name, count]) => {
                        const share = gatewayTotal > 0 ? (count / gatewayTotal) * 100 : 0
                        return (
                          <span
                            key={name}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5',
                              isLight ? 'bg-stone-200/60' : 'bg-white/[0.06]'
                            )}
                          >
                            <span className="font-medium">{prettyGateway(name)}</span>
                            <span className="tabular-nums">
                              {count} ({share.toFixed(0)}%)
                            </span>
                          </span>
                        )
                      })}
                    </div>
                  )}
                  {hiddenLabels.length > 0 && (
                    <div
                      className={cn(
                        'text-[10px] italic pt-0.5',
                        isLight ? 'text-stone-400' : 'text-gray-500'
                      )}
                    >
                      Not applicable to this store: {hiddenLabels.join(' · ')}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
          {/* end SALES OVERVIEW */}

          {/* ── CHANNEL & PRODUCT PERFORMANCE ── */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                Channel &amp; Product Performance
              </h2>
              <div className="h-px flex-1 section-divider-line" />
            </div>

            {/* Charts row: Channel + Top Products */}
            <div
              className={cn(
                'grid @xl:grid-cols-2 gap-x-8 gap-y-16 pt-4',
                isLight
                  ? '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-stone-200 @xl:[&>*:nth-child(odd)]:pr-6 @xl:[&>*:nth-child(even)]:pl-6'
                  : '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-white/[0.08] @xl:[&>*:nth-child(odd)]:pr-6 @xl:[&>*:nth-child(even)]:pl-6'
              )}
            >
              {/* Sales by Tag */}
              <section
                className={cn(
                  'group relative px-3 pt-4 pb-6',
                  'transition-all duration-300 ease-out',
                  'hover:scale-[1.02] hover:z-10 origin-center',
                  isLight
                    ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                    : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                )}
              >
                <div className="mb-3">
                  <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                    Sales by tag
                    <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                  </span>
                </div>
                {tagsLoading ? (
                  <div className="flex items-center justify-center h-[280px]">
                    <Loader2 className="w-6 h-6 animate-spin theme-text-secondary" />
                  </div>
                ) : (tagsData?.tags?.length ?? 0) > 0 ? (
                  <ReactECharts
                    option={{
                      tooltip: {
                        trigger: 'axis' as const,
                        axisPointer: { type: 'shadow' as const },
                        backgroundColor: isDark ? '#1c1c1c' : '#fff',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
                        formatter: (params: any) => {
                          const p = Array.isArray(params) ? params[0] : params
                          const tag = tagsData!.tags[tagsData!.tags.length - 1 - p.dataIndex]
                          return `<div style="font-weight:600">${tag?.tag}</div>
                            <div style="margin-top:4px">${formatCurrencyFull(tag?.grossSales ?? 0, cur)}</div>
                            <div style="font-size:11px;opacity:0.6;margin-top:2px">${tag?.unitsSold ?? 0} units · ${tag?.orderCount ?? 0} orders</div>`
                        },
                      },
                      grid: { top: 8, right: 80, bottom: 0, left: 8, containLabel: true },
                      xAxis: {
                        type: 'value' as const,
                        axisLabel: {
                          color: labelColor,
                          fontSize: 10,
                          formatter: (v: number) => formatCurrency(v, cur),
                        },
                        splitLine: { lineStyle: { color: gridColor } },
                      },
                      yAxis: {
                        type: 'category' as const,
                        data: [...tagsData!.tags]
                          .slice(0, 10)
                          .reverse()
                          .map((t) => t.tag),
                        axisLabel: {
                          color: labelColor,
                          fontSize: 10,
                          width: 120,
                          overflow: 'truncate' as const,
                        },
                        axisLine: { show: false },
                        axisTick: { show: false },
                      },
                      series: [
                        {
                          type: 'bar',
                          data: [...tagsData!.tags]
                            .slice(0, 10)
                            .reverse()
                            .map((t) => t.grossSales),
                          barMaxWidth: 20,
                          itemStyle: {
                            borderRadius: 0,
                            color: {
                              type: 'linear',
                              x: 0,
                              y: 0,
                              x2: 1,
                              y2: 0,
                              colorStops: [
                                { offset: 0, color: 'rgba(168, 85, 247, 0.35)' },
                                { offset: 1, color: 'rgba(168, 85, 247, 0.75)' },
                              ],
                            },
                          },
                          label: {
                            show: true,
                            position: 'right' as const,
                            formatter: (p: any) => formatCurrency(p.value, cur),
                            color: labelColor,
                            fontSize: 10,
                          },
                        },
                      ],
                    }}
                    style={{ width: '100%', height: 380 }}
                    opts={{ renderer: 'canvas' }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[280px]">
                    <p className="text-xs theme-text-secondary">No tag data</p>
                  </div>
                )}
              </section>

              {/* Top Products */}
              <section
                className={cn(
                  'group relative px-3 pt-4 pb-6',
                  'transition-all duration-300 ease-out',
                  'hover:scale-[1.02] hover:z-10 origin-center',
                  isLight
                    ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                    : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                )}
              >
                <div className="mb-3">
                  <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                    Total sales by product
                    <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                  </span>
                </div>
                {analyticsLoading ? (
                  <div className="flex items-center justify-center h-[280px]">
                    <Loader2 className="w-6 h-6 animate-spin theme-text-secondary" />
                  </div>
                ) : topProducts.length > 0 ? (
                  <ReactECharts
                    option={topProductsOption}
                    style={{ width: '100%', height: 380 }}
                    opts={{ renderer: 'canvas' }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[280px]">
                    <p className="text-xs theme-text-secondary">
                      {analyticsError
                        ? 'Analytics data unavailable'
                        : 'No product data for this period'}
                    </p>
                  </div>
                )}
              </section>
            </div>

            {/* Sales by Category (within Channel & Product Performance) */}
            {(productTypeSalesData.length > 0 || vendorSalesData.length > 0) && (
              <div
                className={cn(
                  'grid @xl:grid-cols-2 gap-x-8 gap-y-16 pt-4',
                  isLight
                    ? '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-stone-200 @xl:[&>*:nth-child(odd)]:pr-6 @xl:[&>*:nth-child(even)]:pl-6'
                    : '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-white/[0.08] @xl:[&>*:nth-child(odd)]:pr-6 @xl:[&>*:nth-child(even)]:pl-6'
                )}
              >
                {productTypeSalesData.length > 0 && (
                  <section
                    className={cn(
                      'group relative px-3 pt-4 pb-6',
                      'transition-all duration-300 ease-out',
                      'hover:scale-[1.02] hover:z-10 origin-center',
                      isLight
                        ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                        : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                    )}
                  >
                    <div className="mb-3">
                      <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                        Sales by Product Type
                        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                      </span>
                    </div>
                    <ReactECharts
                      option={productTypeOption}
                      style={{ width: '100%', height: 380 }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </section>
                )}
                {vendorSalesData.length > 0 && (
                  <section
                    className={cn(
                      'group relative px-3 pt-4 pb-6',
                      'transition-all duration-300 ease-out',
                      'hover:scale-[1.02] hover:z-10 origin-center',
                      isLight
                        ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                        : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                    )}
                  >
                    <div className="mb-3">
                      <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                        Sales by Vendor
                        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                      </span>
                    </div>
                    <ReactECharts
                      option={vendorOption}
                      style={{ width: '100%', height: 380 }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </section>
                )}
              </div>
            )}
          </div>
          {/* end CHANNEL & PRODUCT PERFORMANCE */}

          {/* ── CUSTOMER GEOGRAPHY & TRAFFIC ── */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                Customer Geography &amp; Traffic
              </h2>
              <div className="h-px flex-1 section-divider-line" />
            </div>

            <div
              className={cn(
                'grid @xl:grid-cols-2 gap-x-8 gap-y-16',
                isLight
                  ? '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-stone-200 @xl:[&>*:nth-child(odd)]:pr-6 @xl:[&>*:nth-child(even)]:pl-6'
                  : '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-white/[0.08] @xl:[&>*:nth-child(odd)]:pr-6 @xl:[&>*:nth-child(even)]:pl-6'
              )}
            >
              {/* Sales by Country */}
              <section
                className={cn(
                  'group relative px-3 pt-4 pb-6',
                  'transition-all duration-300 ease-out',
                  'hover:scale-[1.02] hover:z-10 origin-center',
                  isLight
                    ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                    : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-3.5 h-3.5 theme-text-secondary" />
                  <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                    Sales by Country
                    <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                  </span>
                </div>
                {analyticsLoading ? (
                  <div className="flex items-center justify-center h-[280px]">
                    <Loader2 className="w-6 h-6 animate-spin theme-text-secondary" />
                  </div>
                ) : geoData.length > 0 ? (
                  <ReactECharts
                    option={geoChartOption}
                    style={{ width: '100%', height: 380 }}
                    opts={{ renderer: 'canvas' }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[280px]">
                    <p className="text-xs theme-text-secondary">
                      No geographic data for this period
                    </p>
                  </div>
                )}
              </section>

              {/* Sales by Referrer */}
              <section
                className={cn(
                  'group relative px-3 pt-4 pb-6',
                  'transition-all duration-300 ease-out',
                  'hover:scale-[1.02] hover:z-10 origin-center',
                  isLight
                    ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                    : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="w-3.5 h-3.5 theme-text-secondary" />
                  <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                    Traffic Sources
                    <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                  </span>
                </div>
                {analyticsLoading ? (
                  <div className="flex items-center justify-center h-[280px]">
                    <Loader2 className="w-6 h-6 animate-spin theme-text-secondary" />
                  </div>
                ) : referrerData.length > 0 ? (
                  <ReactECharts
                    option={referrerChartOption}
                    style={{ width: '100%', height: 380 }}
                    opts={{ renderer: 'canvas' }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[280px]">
                    <p className="text-xs theme-text-secondary">No referrer data for this period</p>
                  </div>
                )}
              </section>
            </div>
          </div>
          {/* end CUSTOMER GEOGRAPHY & TRAFFIC */}

          {/* ── TRENDS & ANALYTICS ── */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                Trends &amp; Analytics
              </h2>
              <div className="h-px flex-1 section-divider-line" />
            </div>

            {/* Hourly Sales Pattern */}
            {hourlyData.length > 0 && (
              <section
                className={cn(
                  'group relative px-3 pt-4 pb-6',
                  'transition-all duration-300 ease-out',
                  'hover:scale-[1.02] hover:z-10 origin-center',
                  isLight
                    ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                    : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                )}
              >
                <div className="mb-3">
                  <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                    Sales by Hour of Day (Last 7 Days)
                    <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                  </span>
                </div>
                <ReactECharts
                  option={hourlyChartOption}
                  notMerge={true}
                  style={{ width: '100%', height: 380 }}
                  opts={{ renderer: 'canvas' }}
                />
              </section>
            )}

            {/* Additional Trend Analytics */}
            {(aovTrendData.length > 0 ||
              discountTrendData.length > 0 ||
              returnsTrendData.length > 0 ||
              sessionsTrendData.length > 0) && (
              <div
                className={cn(
                  'grid @xl:grid-cols-2 gap-x-8 gap-y-16 pt-4',
                  isLight
                    ? '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-stone-200 @xl:[&>*:nth-child(odd)]:pr-6 @xl:[&>*:nth-child(even)]:pl-6'
                    : '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-white/[0.08] @xl:[&>*:nth-child(odd)]:pr-6 @xl:[&>*:nth-child(even)]:pl-6'
                )}
              >
                {aovTrendData.length > 0 && (
                  <section
                    className={cn(
                      'group relative px-3 pt-4 pb-6',
                      'transition-all duration-300 ease-out',
                      'hover:scale-[1.02] hover:z-10 origin-center',
                      isLight
                        ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                        : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                    )}
                  >
                    <div className="mb-3">
                      <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                        Average Order Value Trend
                        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                      </span>
                    </div>
                    <ReactECharts
                      option={aovTrendOption}
                      style={{ width: '100%', height: 380 }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </section>
                )}
                {sessionsTrendData.length > 0 && (
                  <section
                    className={cn(
                      'group relative px-3 pt-4 pb-6',
                      'transition-all duration-300 ease-out',
                      'hover:scale-[1.02] hover:z-10 origin-center',
                      isLight
                        ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                        : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                    )}
                  >
                    <div className="mb-3">
                      <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                        Sessions / Traffic Trend
                        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                      </span>
                    </div>
                    <ReactECharts
                      option={sessionsTrendOption}
                      style={{ width: '100%', height: 380 }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </section>
                )}
                {discountTrendData.length > 0 && (
                  <section
                    className={cn(
                      'group relative px-3 pt-4 pb-6',
                      'transition-all duration-300 ease-out',
                      'hover:scale-[1.02] hover:z-10 origin-center',
                      isLight
                        ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                        : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                    )}
                  >
                    <div className="mb-3">
                      <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                        Discount Usage Trend
                        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                      </span>
                    </div>
                    <ReactECharts
                      option={discountTrendOption}
                      style={{ width: '100%', height: 380 }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </section>
                )}
                {returnsTrendData.length > 0 && (
                  <section
                    className={cn(
                      'group relative px-3 pt-4 pb-6',
                      'transition-all duration-300 ease-out',
                      'hover:scale-[1.02] hover:z-10 origin-center',
                      isLight
                        ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                        : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                    )}
                  >
                    <div className="mb-3">
                      <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                        Returns Trend
                        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                      </span>
                    </div>
                    <ReactECharts
                      option={returnsTrendOption}
                      style={{ width: '100%', height: 380 }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </section>
                )}
              </div>
            )}
          </div>
          {/* end TRENDS & ANALYTICS */}

          {/* ── PROMOTIONS ── */}
          {discountData.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-8">
                <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                  Promotions
                </h2>
                <div className="h-px flex-1 section-divider-line" />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-3.5 h-3.5 theme-text-secondary" />
                  <p className="text-base font-normal uppercase tracking-wider theme-text-primary">
                    Discount Code Performance
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr
                        className={cn(
                          'border-b',
                          isLight ? 'border-stone-200' : 'border-white/[0.08]'
                        )}
                      >
                        <th className="text-left py-2 pr-4 text-xs font-medium text-stone-500">
                          Code
                        </th>
                        <th className="text-right py-2 px-4 text-xs font-medium text-stone-500">
                          Revenue
                        </th>
                        <th className="text-right py-2 px-4 text-xs font-medium text-stone-500">
                          Orders
                        </th>
                        <th className="text-right py-2 pl-4 text-xs font-medium text-stone-500">
                          Discount Given
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {discountData.map((d, i) => (
                        <tr
                          key={d.code ? `${d.code}-${i}` : i}
                          className={cn(
                            'transition-colors',
                            i % 2 === 0 ? (isLight ? 'bg-stone-100/80' : 'bg-white/[0.02]') : '',
                            isLight ? 'hover:bg-stone-200/60' : 'hover:bg-white/[0.04]'
                          )}
                        >
                          <td
                            className={cn(
                              'py-2 pr-4 font-mono text-xs',
                              isLight ? 'text-stone-900' : 'text-white'
                            )}
                          >
                            {d.code}
                          </td>
                          <td
                            className={cn(
                              'py-2 px-4 text-right font-mono tabular-nums font-medium',
                              isLight ? 'text-stone-900' : 'text-white'
                            )}
                          >
                            {formatCurrency(d.totalSales, cur)}
                          </td>
                          <td className="py-2 px-4 text-right text-stone-500">{d.orders}</td>
                          <td
                            className={cn(
                              'py-2 pl-4 text-right font-mono tabular-nums',
                              isLight ? 'text-red-600' : 'text-red-400'
                            )}
                          >
                            {formatCurrency(Math.abs(d.discountAmount), cur)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
