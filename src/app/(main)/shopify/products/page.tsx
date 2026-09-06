'use client'

import { Fragment, useState, useMemo, useEffect } from 'react'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useShopifyProducts, useShopifyProductAnalytics } from '../hooks/useShopifyData'
import { ReactECharts, useThemeEChartsConfig } from '@/components/chat/visualizations/shared'
import { ProductDetailPanel } from './ProductDetailPanel'
import { getDateRangeForPeriod } from '@/lib/utils/dateRanges'
import type {
  ShopifyProduct,
  ShopifyProductEnriched,
  ShopifyProductTagSales,
} from '@/lib/providers/shopify/types'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { KPIStrip } from '@/app/(main)/shopify/components/KPIStrip'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

function formatCurrency(amount: number | string, currency = 'USD') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num)
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    archived: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
  }
  const color = colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${color}`}>
      {status}
    </span>
  )
}

function RiskBadge({ risk }: { risk: string }) {
  const colors: Record<string, string> = {
    out_of_stock: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    critical: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    low: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    healthy: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  }
  const labels: Record<string, string> = {
    out_of_stock: 'Out of Stock',
    critical: 'Critical',
    low: 'Low Stock',
    healthy: 'Healthy',
  }
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium ${colors[risk] || colors.healthy}`}
    >
      {labels[risk] || risk}
    </span>
  )
}

export default function ShopifyProductsPage() {
  const { connected, isLoading: connLoading } = useShopifyConnection()

  const { data, isLoading, error, mutate } = useShopifyProducts(connected)
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !data)
  }, [isLoading, data, welcomeContext])

  const analyticsDateRange = useMemo(() => {
    const range = getDateRangeForPeriod('last_30_days')
    return { startDate: range.start, endDate: range.end }
  }, [])
  const { data: analytics } = useShopifyProductAnalytics(connected, analyticsDateRange)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortKey, setSortKey] = useState<string>('title')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null)
  const [riskFilter, setRiskFilter] = useState<'out_of_stock' | 'critical' | 'low' | null>(null)
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const borderClass = isLight ? 'border-stone-200' : 'border-white/[0.08]'
  const { tooltipStyle, axisLabelStyle, splitLineStyle } = useThemeEChartsConfig()
  const sectionHover = cn(
    'group relative rounded-[4px]',
    'transition-all duration-300 ease-out',
    'hover:scale-[1.01] origin-center',
    isLight
      ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)]'
      : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]'
  )

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-amber-500" />
    ) : (
      <ChevronDown className="w-3 h-3 text-amber-500" />
    )
  }
  const handleSort = (col: string) => {
    if (sortKey === col) setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(col)
      setSortDir(col === 'title' || col === 'vendor' ? 'asc' : 'desc')
    }
  }

  const products = data?.products ?? []
  const summary = data?.summary
  const enrichedMap = useMemo(() => {
    const map = new Map<number, ShopifyProductEnriched>()
    for (const e of data?.enriched ?? []) map.set(e.productId, e)
    return map
  }, [data?.enriched])
  const salesByTag: ShopifyProductTagSales[] = data?.salesByTag ?? []
  const cur = summary?.currency ?? 'USD'

  const filtered = useMemo(() => {
    let items = [...products]
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(
        (p: ShopifyProduct) =>
          p.title?.toLowerCase().includes(q) || p.vendor?.toLowerCase().includes(q)
      )
    }
    if (typeFilter && typeFilter !== 'all')
      items = items.filter((p: ShopifyProduct) => p.product_type === typeFilter)
    if (riskFilter) {
      items = items.filter((p: ShopifyProduct) => {
        const e = enrichedMap.get(p.id)
        if (!e) return false
        if (riskFilter === 'out_of_stock') return e.totalStock <= 0
        if (riskFilter === 'critical')
          return e.totalStock > 0 && e.weeksCover !== null && e.weeksCover < 2
        if (riskFilter === 'low')
          return e.totalStock > 0 && e.weeksCover !== null && e.weeksCover < 4 && e.weeksCover >= 2
        return false
      })
    }
    items.sort((a: any, b: any) => {
      let aVal: any, bVal: any
      switch (sortKey) {
        case 'title':
          aVal = a.title || ''
          bVal = b.title || ''
          break
        case 'status':
          aVal = a.status || ''
          bVal = b.status || ''
          break
        case 'product_type':
          aVal = a.product_type || ''
          bVal = b.product_type || ''
          break
        case 'vendor':
          aVal = a.vendor || ''
          bVal = b.vendor || ''
          break
        case 'variants':
          aVal = a.variants?.length || 0
          bVal = b.variants?.length || 0
          break
        case 'price':
          aVal = parseFloat(a.variants?.[0]?.price || '0')
          bVal = parseFloat(b.variants?.[0]?.price || '0')
          break
        case 'revenue':
          aVal = enrichedMap.get(a.id)?.revenue ?? 0
          bVal = enrichedMap.get(b.id)?.revenue ?? 0
          break
        case 'stock':
          aVal = enrichedMap.get(a.id)?.totalStock ?? 0
          bVal = enrichedMap.get(b.id)?.totalStock ?? 0
          break
        case 'weeksCover':
          aVal = enrichedMap.get(a.id)?.weeksCover ?? -1
          bVal = enrichedMap.get(b.id)?.weeksCover ?? -1
          break
        default:
          aVal = ''
          bVal = ''
      }
      if (typeof aVal === 'string')
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return items
  }, [products, search, typeFilter, riskFilter, sortKey, sortDir, enrichedMap])

  // Count availability risks
  const riskCounts = useMemo(() => {
    let outOfStock = 0
    let critical = 0
    let low = 0
    for (const e of data?.enriched ?? []) {
      if (e.totalStock <= 0) outOfStock++
      else if (e.weeksCover !== null && e.weeksCover < 2) critical++
      else if (e.weeksCover !== null && e.weeksCover < 4) low++
    }
    return { outOfStock, critical, low }
  }, [data?.enriched])

  // Chart options — use centralized theme config
  const salesByTagOption =
    salesByTag.length > 0
      ? {
          tooltip: {
            trigger: 'axis' as const,
            axisPointer: { type: 'shadow' as const },
            ...tooltipStyle,
            formatter: (params: any) => {
              const p = Array.isArray(params) ? params[0] : params
              const tag = salesByTag[salesByTag.length - 1 - p.dataIndex]
              return `<strong>${tag?.tag}</strong><br/>Revenue: ${formatCurrency(tag?.revenue ?? 0, cur)}<br/>Units: ${tag?.unitsSold ?? 0}<br/>Products: ${tag?.productCount ?? 0}`
            },
          },
          grid: { top: 8, right: 80, bottom: 0, left: 8, containLabel: true },
          xAxis: {
            type: 'value' as const,
            axisLabel: {
              ...axisLabelStyle,
              formatter: (v: number) => formatCurrency(v, cur),
            },
            splitLine: { lineStyle: splitLineStyle },
          },
          yAxis: {
            type: 'category' as const,
            data: [...salesByTag].reverse().map((t) => t.tag),
            axisLabel: {
              ...axisLabelStyle,
              width: 120,
              overflow: 'truncate' as const,
            },
            axisLine: { show: false },
            axisTick: { show: false },
          },
          series: [
            {
              type: 'bar',
              data: [...salesByTag].reverse().map((t) => t.revenue),
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
                ...axisLabelStyle,
              },
            },
          ],
        }
      : null

  if (connLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
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

  return (
    <div className="@container space-y-10 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-10 pt-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="dashboard-title text-[36px] font-light theme-text-primary tracking-tight">
              Products
            </h1>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#7AB55C]/80 mt-2">
              Shopify
            </p>
          </div>
          <button
            onClick={() => mutate()}
            disabled={isLoading}
            className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-sm text-red-500">Failed to load products. Please try again.</p>
        </div>
      ) : isLoading && !data ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
        </div>
      ) : (
        <>
          {/* KPI Strip */}
          <KPIStrip
            isLight={isLight}
            isLoading={isLoading}
            cards={
              summary
                ? [
                    {
                      label: 'Total Products',
                      tooltip: {
                        description:
                          'Total number of products in your Shopify catalog across all statuses.',
                      },
                      kpi: { value: summary.totalCount ?? 0 },
                      format: (v) => v.toLocaleString(),
                    },
                    {
                      label: 'Active',
                      tooltip: {
                        description:
                          'Products currently visible and available for sale on your store.',
                      },
                      kpi: { value: summary.activeCount ?? 0 },
                      format: (v) => v.toLocaleString(),
                      valueColor: isLight ? 'text-emerald-600' : 'text-emerald-400',
                    },
                    ...(summary.totalRevenue
                      ? [
                          {
                            label: 'Revenue (90d)',
                            tooltip: {
                              description: 'Total product revenue from the last 90 days of orders.',
                            },
                            kpi: { value: summary.totalRevenue },
                            format: (v: number) => formatCurrency(v, cur),
                            valueColor: isLight ? 'text-emerald-600' : 'text-emerald-400',
                          },
                        ]
                      : []),
                    ...(summary.totalUnitsSold
                      ? [
                          {
                            label: 'Units Sold (90d)',
                            tooltip: {
                              description: 'Total units sold from the last 90 days of orders.',
                            },
                            kpi: { value: summary.totalUnitsSold },
                            format: (v: number) => v.toLocaleString(),
                          },
                        ]
                      : []),
                    {
                      label: 'Total Variants',
                      tooltip: {
                        description:
                          'Total product variants (sizes, colors, etc.) across all products.',
                      },
                      kpi: { value: summary.totalVariants ?? 0 },
                      format: (v) => v.toLocaleString(),
                    },
                  ]
                : []
            }
          />

          {/* ── PRODUCT ANALYTICS ── */}
          {(analytics?.topProductsByRevenue?.length > 0 ||
            salesByTagOption ||
            analytics?.salesByProductType?.length > 0) && (
            <div className="space-y-12">
              <div className="flex items-center gap-3">
                <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                  Product Analytics
                </h2>
                <div className="h-px flex-1 section-divider-line" />
              </div>

              <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-16')}>
                {/* Top Products by Revenue */}
                {analytics?.topProductsByRevenue?.length > 0 && (
                  <section
                    className={cn(
                      'flex flex-col @3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
                      isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
                      sectionHover
                    )}
                  >
                    <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-6">
                      Top Products by Revenue
                    </p>
                    <p className="text-xs theme-text-secondary mb-4">Last 30 days</p>
                    <div className="flex-1 min-h-[280px]">
                      <ReactECharts
                        option={{
                          tooltip: {
                            trigger: 'axis',
                            axisPointer: { type: 'shadow' },
                            ...tooltipStyle,
                            formatter: (params: any) => {
                              const p = Array.isArray(params) ? params[0] : params
                              return `${p.name}<br/>${formatCurrency(p.value, cur)}`
                            },
                          },
                          grid: { top: 8, right: 80, bottom: 0, left: 8, containLabel: true },
                          xAxis: {
                            type: 'value',
                            axisLabel: {
                              ...axisLabelStyle,
                              formatter: (v: number) => formatCurrency(v, cur),
                            },
                            splitLine: { lineStyle: splitLineStyle },
                          },
                          yAxis: {
                            type: 'category',
                            data: [...analytics.topProductsByRevenue]
                              .reverse()
                              .map((p: any) => p.name),
                            axisLabel: {
                              ...axisLabelStyle,
                              width: 120,
                              overflow: 'truncate',
                            },
                            axisLine: { show: false },
                            axisTick: { show: false },
                          },
                          series: [
                            {
                              type: 'bar',
                              data: [...analytics.topProductsByRevenue]
                                .reverse()
                                .map((p: any) => p.totalSales),
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
                                    { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
                                    { offset: 1, color: 'rgba(16, 185, 129, 0.75)' },
                                  ],
                                },
                              },
                              label: {
                                show: true,
                                position: 'right',
                                formatter: (p: any) => formatCurrency(p.value, cur),
                                ...axisLabelStyle,
                              },
                            },
                          ],
                        }}
                        style={{ width: '100%', height: 320 }}
                        opts={{ renderer: 'canvas' }}
                      />
                    </div>
                  </section>
                )}

                {/* Sales by Tag */}
                {salesByTagOption && (
                  <section className={cn('flex flex-col', sectionHover)}>
                    <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-6 flex items-center gap-2">
                      Sales by Product Tag
                      <InfoTooltip description="Revenue attributed to each product tag from the last 90 days of orders. Products with multiple tags contribute to each tag." />
                    </p>
                    <p className="text-xs theme-text-secondary mb-4">Last 90 days</p>
                    <div className="flex-1 min-h-[280px]">
                      <ReactECharts
                        option={salesByTagOption}
                        style={{ width: '100%', height: 320 }}
                        opts={{ renderer: 'canvas' }}
                      />
                    </div>
                  </section>
                )}

                {/* Sales by Product Type */}
                {analytics?.salesByProductType?.length > 0 && (
                  <section
                    className={cn(
                      'flex flex-col @3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
                      isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
                      sectionHover
                    )}
                  >
                    <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-6">
                      Sales by Product Type
                    </p>
                    <p className="text-xs theme-text-secondary mb-4">Last 30 days</p>
                    <div className="flex-1 min-h-[280px]">
                      <ReactECharts
                        option={{
                          tooltip: {
                            trigger: 'item',
                            ...tooltipStyle,
                            formatter: (p: any) =>
                              `${p.name}<br/>${formatCurrency(p.value, cur)} (${p.percent}%)`,
                          },
                          series: [
                            {
                              type: 'pie',
                              radius: ['40%', '70%'],
                              center: ['50%', '55%'],
                              avoidLabelOverlap: true,
                              itemStyle: {
                                borderRadius: 0,
                                borderColor: isLight ? '#faf8f5' : '#121212',
                                borderWidth: 2,
                              },
                              label: { ...axisLabelStyle },
                              data: analytics.salesByProductType.map((t: any, i: number) => ({
                                name: t.name || 'Uncategorized',
                                value: t.totalSales,
                                itemStyle: {
                                  color: [
                                    '#10b981',
                                    '#3b82f6',
                                    '#f59e0b',
                                    '#8b5cf6',
                                    '#ef4444',
                                    '#06b6d4',
                                    '#f97316',
                                    '#84cc16',
                                    '#ec4899',
                                    '#6366f1',
                                    '#14b8a6',
                                    '#a855f7',
                                    '#e11d48',
                                    '#0ea5e9',
                                    '#eab308',
                                  ][i % 15],
                                },
                              })),
                            },
                          ],
                        }}
                        style={{ width: '100%', height: 320 }}
                        opts={{ renderer: 'canvas' }}
                      />
                    </div>
                  </section>
                )}
              </div>

              {/* Product Revenue Trend Over Time */}
              {analytics?.productTrend?.dates?.length > 0 && (
                <section className={cn('col-span-full', sectionHover)}>
                  <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-6 flex items-center gap-2">
                    Product Revenue Trend
                    <InfoTooltip description="Revenue over time for the top 5 products by total sales. Helps identify growth and seasonal patterns." />
                  </p>
                  <p className="text-xs theme-text-secondary mb-4">Last 30 days — Top 5 products</p>
                  <div className="min-h-[320px]">
                    <ReactECharts
                      option={{
                        tooltip: {
                          trigger: 'axis',
                          ...tooltipStyle,
                          formatter: (params: any) => {
                            const items = Array.isArray(params) ? params : [params]
                            let html = `<div style="font-size:11px;opacity:0.6;margin-bottom:6px">${items[0]?.axisValue}</div>`
                            for (const p of items) {
                              if (p.value > 0) {
                                html += `<div style="display:flex;align-items:center;gap:6px;margin-top:2px;font-size:11px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span><span style="flex:1;opacity:0.8">${p.seriesName}</span><span style="font-weight:500">${formatCurrency(p.value, cur)}</span></div>`
                              }
                            }
                            return html
                          },
                        },
                        legend: {
                          data: analytics.productTrend.products.map((p: any) => p.name),
                          textStyle: { ...axisLabelStyle, fontSize: 12 },
                          bottom: 0,
                          itemWidth: 12,
                          itemHeight: 8,
                          type: 'scroll',
                        },
                        grid: { top: 12, right: 8, bottom: 60, left: 62 },
                        xAxis: {
                          type: 'category',
                          data: analytics.productTrend.dates.map((d: string) => {
                            const date = new Date(d + 'T00:00:00Z')
                            return date.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              timeZone: 'UTC',
                            })
                          }),
                          axisLabel: axisLabelStyle,
                          axisLine: { lineStyle: splitLineStyle },
                          axisTick: { show: false },
                        },
                        yAxis: {
                          type: 'value',
                          min: 0,
                          axisLabel: {
                            ...axisLabelStyle,
                            formatter: (v: number) => formatCurrency(v, cur),
                          },
                          splitLine: { lineStyle: splitLineStyle },
                        },
                        series: analytics.productTrend.products.map((p: any, i: number) => {
                          const color = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'][
                            i % 5
                          ]
                          return {
                            name: p.name,
                            type: 'line',
                            smooth: true,
                            data: p.data,
                            symbol: 'none',
                            lineStyle: { color, width: 1.5 },
                            itemStyle: { color },
                            emphasis: {
                              focus: 'series' as const,
                              lineStyle: { color, width: 2.5 },
                            },
                            areaStyle: { opacity: 0 },
                          }
                        }),
                      }}
                      style={{ width: '100%', height: 320 }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </div>
                </section>
              )}

              {/* Top Performers Ranking */}
              {analytics?.topProductsByRevenue?.length > 0 && (
                <section className={cn('col-span-full', sectionHover)}>
                  <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-6 flex items-center gap-2">
                    Top Performers
                    <InfoTooltip description="Products ranked by total revenue over the last 30 days. Shows revenue share, units, and orders." />
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={cn('border-b', borderClass)}>
                          <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider w-8">
                            #
                          </th>
                          <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                            Product
                          </th>
                          <th className="text-right py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                            Revenue
                          </th>
                          <th className="text-right py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                            Orders
                          </th>
                          <th className="text-right py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                            Share
                          </th>
                          <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider w-48"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const totalRevenue = analytics.topProductsByRevenue.reduce(
                            (s: number, p: any) => s + p.totalSales,
                            0
                          )
                          return analytics.topProductsByRevenue.map((p: any, i: number) => {
                            const share = totalRevenue > 0 ? (p.totalSales / totalRevenue) * 100 : 0
                            return (
                              <tr
                                key={p.name}
                                className={cn(
                                  i % 2 === 1 ? (isLight ? 'bg-stone-50' : 'bg-white/[0.02]') : '',
                                  isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.04]',
                                  'transition-colors'
                                )}
                              >
                                <td className="py-2.5 px-3 font-mono text-stone-400 text-xs">
                                  {i + 1}
                                </td>
                                <td
                                  className={cn(
                                    'py-2.5 px-3 font-medium',
                                    isLight ? 'text-stone-900' : 'text-white'
                                  )}
                                >
                                  {p.name}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-emerald-500">
                                  {formatCurrency(p.totalSales, cur)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-stone-500">
                                  {p.orders}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-stone-500">
                                  {share.toFixed(1)}%
                                </td>
                                <td className="py-2.5 px-3">
                                  <div
                                    className="w-full h-1.5 rounded-full overflow-hidden"
                                    style={{
                                      backgroundColor: isLight
                                        ? '#e7e5e4'
                                        : 'rgba(255,255,255,0.06)',
                                    }}
                                  >
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${share}%`, backgroundColor: '#10b981' }}
                                    />
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        })()}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <p className="text-xs theme-text-secondary">
                Revenue and stock data from last 90 days of orders.
              </p>
            </div>
          )}

          {/* ── INVENTORY ── */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                Inventory
              </h2>
              <div className="h-px flex-1 section-divider-line" />
            </div>

            {/* Availability risk alerts — clickable to filter table */}
            {(riskCounts.outOfStock > 0 || riskCounts.critical > 0 || riskCounts.low > 0) && (
              <div
                className={cn(
                  'flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-[4px] border mb-8',
                  isLight
                    ? 'border-orange-200/60 bg-orange-50/50'
                    : 'border-orange-900/30 bg-orange-900/5'
                )}
              >
                <div className="flex items-center gap-1.5 mr-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-500/80" />
                  <span
                    className={cn(
                      'text-xs font-medium uppercase tracking-wider',
                      isLight ? 'text-orange-600' : 'text-orange-400'
                    )}
                  >
                    Availability Risks
                  </span>
                </div>
                {riskCounts.outOfStock > 0 && (
                  <button
                    onClick={() =>
                      setRiskFilter(riskFilter === 'out_of_stock' ? null : 'out_of_stock')
                    }
                    className={cn(
                      'text-xs font-medium px-2.5 py-1 rounded-[3px] transition-colors cursor-pointer',
                      riskFilter === 'out_of_stock'
                        ? 'bg-red-600 text-white dark:bg-red-500'
                        : 'text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                    )}
                  >
                    {riskCounts.outOfStock}/{products.length} out of stock
                  </button>
                )}
                {riskCounts.critical > 0 && (
                  <button
                    onClick={() => setRiskFilter(riskFilter === 'critical' ? null : 'critical')}
                    className={cn(
                      'text-xs font-medium px-2.5 py-1 rounded-[3px] transition-colors cursor-pointer',
                      riskFilter === 'critical'
                        ? 'bg-orange-600 text-white dark:bg-orange-500'
                        : 'text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                    )}
                  >
                    {riskCounts.critical}/{products.length} critical (&lt;2 weeks cover)
                  </button>
                )}
                {riskCounts.low > 0 && (
                  <button
                    onClick={() => setRiskFilter(riskFilter === 'low' ? null : 'low')}
                    className={cn(
                      'text-xs font-medium px-2.5 py-1 rounded-[3px] transition-colors cursor-pointer',
                      riskFilter === 'low'
                        ? 'bg-yellow-600 text-white dark:bg-yellow-500'
                        : 'text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                    )}
                  >
                    {riskCounts.low}/{products.length} low stock (&lt;4 weeks cover)
                  </button>
                )}
                {riskFilter && (
                  <button
                    onClick={() => setRiskFilter(null)}
                    className="text-xs theme-text-secondary hover:theme-text-primary ml-1 underline transition-colors"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            )}

            {/* Filters */}
            <div className="flex gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-secondary" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn(
                    'w-full h-9 pl-9 pr-3 rounded-[4px] text-sm focus:outline-none transition-colors',
                    'border bg-transparent theme-text-primary',
                    borderClass,
                    'placeholder:text-stone-400',
                    'focus:border-amber-500/40'
                  )}
                />
              </div>
              {(summary?.productTypes?.length ?? 0) > 0 && (
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className={cn('w-[160px] h-9 text-sm border', borderClass)}>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent className="glass-luxury-card">
                    <SelectItem value="all">All types</SelectItem>
                    {(summary?.productTypes ?? []).map((t: string) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Products table */}
            <div
              className={cn(
                'overflow-x-auto max-h-[900px] overflow-y-auto rounded-[4px] border',
                borderClass,
                '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent',
                '[&::-webkit-scrollbar-thumb]:rounded-full',
                isLight
                  ? '[&::-webkit-scrollbar-thumb]:bg-stone-300'
                  : '[&::-webkit-scrollbar-thumb]:bg-white/10'
              )}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className={cn(
                      'border-b sticky top-0 z-10',
                      borderClass,
                      'bg-[var(--theme-bg)]'
                    )}
                  >
                    <th className="text-center py-2 px-2 w-10">
                      <span className="font-medium text-stone-500">#</span>
                    </th>
                    <th className="text-left py-2 px-3">
                      <button
                        onClick={() => handleSort('title')}
                        className="flex items-center gap-1 font-medium text-stone-500 hover:text-amber-500 transition-colors select-none"
                      >
                        Product <SortIcon col="title" />
                      </button>
                    </th>
                    <th className="text-left py-2 px-3">
                      <button
                        onClick={() => handleSort('status')}
                        className="flex items-center gap-1 font-medium text-stone-500 hover:text-amber-500 transition-colors select-none"
                      >
                        Status <SortIcon col="status" />
                      </button>
                    </th>
                    <th className="text-left py-2 px-3">
                      <button
                        onClick={() => handleSort('product_type')}
                        className="flex items-center gap-1 font-medium text-stone-500 hover:text-amber-500 transition-colors select-none"
                      >
                        Type <SortIcon col="product_type" />
                      </button>
                    </th>
                    <th className="text-right py-2 px-3">
                      <button
                        onClick={() => handleSort('revenue')}
                        className="flex items-center justify-end gap-1 font-medium text-stone-500 hover:text-amber-500 transition-colors select-none"
                      >
                        Revenue <SortIcon col="revenue" />
                      </button>
                    </th>
                    <th className="text-right py-2 px-3">
                      <button
                        onClick={() => handleSort('stock')}
                        className="flex items-center justify-end gap-1 font-medium text-stone-500 hover:text-amber-500 transition-colors select-none"
                      >
                        Stock <SortIcon col="stock" />
                      </button>
                    </th>
                    <th className="text-right py-2 px-3">
                      <button
                        onClick={() => handleSort('weeksCover')}
                        className="flex items-center justify-end gap-1 font-medium text-stone-500 hover:text-amber-500 transition-colors select-none"
                      >
                        Weeks Cover <SortIcon col="weeksCover" />
                      </button>
                    </th>
                    <th className="text-right py-2 px-3">
                      <button
                        onClick={() => handleSort('price')}
                        className="flex items-center justify-end gap-1 font-medium text-stone-500 hover:text-amber-500 transition-colors select-none"
                      >
                        Price <SortIcon col="price" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product, i) => {
                    const firstVariant = product.variants?.[0]
                    const e = enrichedMap.get(product.id)
                    return (
                      <Fragment key={product.id}>
                        <tr
                          className={cn(
                            'transition-colors cursor-pointer',
                            i % 2 === 0 ? (isLight ? 'bg-black/[0.015]' : 'bg-white/[0.015]') : '',
                            isLight ? 'hover:bg-black/[0.03]' : 'hover:bg-white/[0.03]'
                          )}
                          onClick={() =>
                            setExpandedProduct(expandedProduct === product.id ? null : product.id)
                          }
                        >
                          <td className="py-2.5 px-2 text-center font-mono text-xs theme-text-secondary w-10">
                            {i + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-3">
                              {expandedProduct === product.id ? (
                                <ChevronDown className="w-3 h-3 flex-shrink-0 theme-text-secondary" />
                              ) : (
                                <ChevronRight className="w-3 h-3 flex-shrink-0 theme-text-secondary" />
                              )}
                              {product.image?.src && (
                                <img
                                  src={product.image.src}
                                  alt={product.title}
                                  className="w-10 h-10 rounded-[3px] object-cover"
                                />
                              )}
                              <div>
                                <span className="font-medium theme-text-primary">
                                  {product.title}
                                </span>
                                {e && e.tags.length > 0 && (
                                  <div className="flex gap-1 mt-0.5 flex-wrap">
                                    {e.tags.slice(0, 3).map((tag) => (
                                      <span
                                        key={tag}
                                        className={cn(
                                          'text-[10px] px-1.5 py-0 rounded-full',
                                          isLight
                                            ? 'bg-purple-50 text-purple-600'
                                            : 'bg-purple-900/20 text-purple-400'
                                        )}
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                    {e.tags.length > 3 && (
                                      <span className="text-[10px] theme-text-secondary">
                                        +{e.tags.length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusBadge status={product.status} />
                          </td>
                          <td className="py-2.5 px-3 theme-text-secondary">
                            {product.product_type || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium theme-text-primary">
                            {e ? formatCurrency(e.revenue, cur) : '-'}
                            {e && e.unitsSold > 0 && (
                              <div className="text-[10px] theme-text-secondary font-normal">
                                {e.unitsSold} units
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums theme-text-primary">
                            {e ? e.totalStock.toLocaleString() : '-'}
                            {e &&
                              (() => {
                                const risk =
                                  e.totalStock <= 0
                                    ? 'out_of_stock'
                                    : e.weeksCover !== null && e.weeksCover < 2
                                      ? 'critical'
                                      : e.weeksCover !== null && e.weeksCover < 4
                                        ? 'low'
                                        : null
                                const totalLocs = e.stockByLocation.length
                                const stockedLocs = e.stockByLocation.filter(
                                  (s) => s.available > 0
                                ).length
                                const hasLocationGaps =
                                  totalLocs > 1 && stockedLocs < totalLocs && stockedLocs > 0
                                return (
                                  <>
                                    {risk && (
                                      <div className="flex justify-end mt-0.5">
                                        <RiskBadge risk={risk} />
                                      </div>
                                    )}
                                    {!risk && hasLocationGaps && (
                                      <div className="text-[10px] text-orange-500 font-normal mt-0.5">
                                        {stockedLocs}/{totalLocs} locations stocked
                                      </div>
                                    )}
                                  </>
                                )
                              })()}
                          </td>
                          <td
                            className={cn(
                              'py-2.5 px-3 text-right font-mono tabular-nums',
                              e?.weeksCover !== null &&
                                e?.weeksCover !== undefined &&
                                e.weeksCover < 4
                                ? 'text-orange-500'
                                : 'theme-text-primary'
                            )}
                          >
                            {e?.weeksCover !== null && e?.weeksCover !== undefined
                              ? `${e.weeksCover}w`
                              : '-'}
                            {e?.avgWeeklySales != null && e.avgWeeklySales > 0 && (
                              <div className="text-[10px] theme-text-secondary font-normal">
                                {e.avgWeeklySales}/wk
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium theme-text-primary">
                            {firstVariant ? formatCurrency(firstVariant.price, cur) : '-'}
                          </td>
                        </tr>
                        {expandedProduct === product.id && (
                          <tr key={`${product.id}-details`}>
                            <td colSpan={8} className="p-0 border-none">
                              <ProductDetailPanel
                                productId={product.id}
                                isLight={isLight}
                                onClose={() => setExpandedProduct(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-stone-500">
                        No products found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
