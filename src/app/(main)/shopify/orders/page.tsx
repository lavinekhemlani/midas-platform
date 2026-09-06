'use client'

import { Fragment, useState, useMemo, useRef, useEffect } from 'react'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useShopifyOrders } from '../hooks/useShopifyData'
import { OrderDetailPanel } from './OrderDetailPanel'
import { KPIStrip as SharedKPIStrip } from '@/app/(main)/shopify/components/KPIStrip'
import { PeriodPicker } from '@/app/(main)/bc/components/PeriodPicker'
import { useShopifyDateRange } from '../hooks/useShopifyDateRange'
import type { ShopifyOrder, ShopifyFulfillmentPipeline } from '@/lib/providers/shopify/types'
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  AlertTriangle,
  Shield,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { holtWintersForecast } from '@/lib/utils/forecast'
import { ReactECharts } from '@/components/chat/visualizations/shared'

function formatCurrency(amount: number | string, currency = 'USD') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num)
}

function formatDate(dateStr: string, timeZone?: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(timeZone && { timeZone }),
  })
}

function StatusBadge({
  status,
  type,
}: {
  status: string | null
  type: 'financial' | 'fulfillment'
}) {
  const colors: Record<string, string> = {
    paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    refunded: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    partially_refunded: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    fulfilled: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    unfulfilled: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
    partial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  }
  const label = status || (type === 'fulfillment' ? 'unfulfilled' : 'unknown')
  const color = colors[label] || 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${color}`}>
      {label.replace('_', ' ')}
    </span>
  )
}

function FulfillmentPipelineBar({ pipeline }: { pipeline: ShopifyFulfillmentPipeline }) {
  const stages = [
    {
      key: 'unfulfilled',
      label: 'Unfulfilled',
      count: pipeline.unfulfilled,
      color: '#94a3b8',
      icon: Clock,
    },
    {
      key: 'partiallyFulfilled',
      label: 'Partially Fulfilled',
      count: pipeline.partiallyFulfilled,
      color: '#f59e0b',
      icon: Package,
    },
    {
      key: 'fulfilled',
      label: 'Fulfilled',
      count: pipeline.fulfilled,
      color: '#10b981',
      icon: CheckCircle2,
    },
    {
      key: 'cancelled',
      label: 'Cancelled',
      count: pipeline.cancelled,
      color: '#ef4444',
      icon: XCircle,
    },
  ]
  const total = stages.reduce((s, st) => s + st.count, 0) || 1

  return (
    <div className="space-y-2">
      <div className="h-6 flex overflow-hidden">
        {stages
          .filter((s) => s.count > 0)
          .map((s) => (
            <div
              key={s.key}
              className="h-full transition-all duration-500"
              style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
              title={`${s.label}: ${s.count} (${((s.count / total) * 100).toFixed(0)}%)`}
            />
          ))}
      </div>
      <div className="flex justify-between mt-2">
        {stages
          .filter((s) => s.count > 0)
          .map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <div className="w-2 h-2" style={{ backgroundColor: s.color }} />
              <span className="text-[12px] theme-text-secondary">
                {s.label} {s.count}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}

function ShimmerBlock({ className, isLight }: { className: string; isLight: boolean }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded',
        isLight ? 'bg-stone-200/70' : 'bg-white/[0.06]',
        className
      )}
    />
  )
}

function OrdersSkeleton({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-12">
      {/* KPI strip skeleton */}
      <div className="flex gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 px-5 py-4 min-w-[240px] flex-1">
            <ShimmerBlock className="h-3 w-20" isLight={isLight} />
            <ShimmerBlock className="h-7 w-32" isLight={isLight} />
          </div>
        ))}
      </div>

      {/* Fulfillment pipeline skeleton */}
      <div className="px-3 pt-4 pb-6">
        <ShimmerBlock className="h-4 w-48 mb-3" isLight={isLight} />
        <ShimmerBlock className="h-8 w-full" isLight={isLight} />
        <div className="flex gap-8 mt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ShimmerBlock key={i} className="h-3 w-24" isLight={isLight} />
          ))}
        </div>
      </div>

      {/* Charts skeleton */}
      <div className="grid @xl:grid-cols-2 gap-x-10 gap-y-16">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 px-3 pt-4 pb-6">
            <ShimmerBlock className="h-4 w-48" isLight={isLight} />
            <ShimmerBlock className="h-[280px] w-full" isLight={isLight} />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="space-y-0">
        <ShimmerBlock className="h-10 w-full rounded-none" isLight={isLight} />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-12 w-full',
              i % 2 === 1
                ? isLight
                  ? 'bg-stone-200/30'
                  : 'bg-white/[0.03]'
                : isLight
                  ? 'bg-stone-100/40'
                  : 'bg-white/[0.015]'
            )}
          />
        ))}
      </div>
    </div>
  )
}

export default function ShopifyOrdersPage() {
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

  const { data, isLoading, error, mutate } = useShopifyOrders(connected, dateRange)
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !data)
  }, [isLoading, data, welcomeContext])
  const [search, setSearch] = useState('')
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<string>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [riskExpanded, setRiskExpanded] = useState<'high' | 'medium' | null>(null)
  const riskRef = useRef<HTMLDivElement>(null)
  const tableContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!riskExpanded) return
    const handler = (e: MouseEvent) => {
      if (riskRef.current && !riskRef.current.contains(e.target as Node)) {
        setRiskExpanded(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [riskExpanded])
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const isDark = theme !== 'light'

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

  // Data may be null during loading - destructure only when available
  const orders = data?.orders ?? []
  const summary = data?.summary
  const cur = summary?.currency ?? 'USD'
  const warning = data?.warning
  const graphqlWarning = data?.graphqlWarning
  const orderTrend = data?.orderTrend ?? []
  const prevOrderTrend = data?.prevOrderTrend ?? []
  const fulfillmentSpeedTrend = data?.fulfillmentSpeedTrend ?? []
  const prevFulfillmentSpeedTrend = data?.prevFulfillmentSpeedTrend ?? []
  const riskOrders = data?.riskOrders ?? []
  const fulfillmentLocationMap: Record<string, string[]> =
    (data as any)?.fulfillmentLocationMap ?? {}
  const geoOverview: Array<{ country: string; countryCode: string; city: string; count: number }> =
    (data as any)?.geoOverview ?? []
  const orderEnrichmentMap = data?.orderEnrichmentMap ?? {}
  const attributionStats = data?.attributionStats

  const trendGranularity = data?.trendGranularity ?? 'month'

  // Holt-Winters Double Exponential Smoothing forecast (α=0.3, β=0.1)
  // Horizon adapts to trend granularity: 7 days, 4 weeks, or 3 months
  const forecast = useMemo(() => {
    // Need enough history for a meaningful trend fit
    if (orderTrend.length < 6) return null

    const horizon = trendGranularity === 'day' ? 7 : trendGranularity === 'week' ? 4 : 3

    const ordersVals = orderTrend.map((t: any) => t.orders as number)
    const revenueVals = orderTrend.map((t: any) => (t.revenue ?? 0) as number)

    const ordersForecastValues = holtWintersForecast(ordersVals, horizon).map((v) => Math.round(v))
    const revenueForecastValues = holtWintersForecast(revenueVals, horizon).map((v) =>
      Math.round(v)
    )

    // Build future date labels respecting the granularity of the input series
    const lastDateStr = orderTrend[orderTrend.length - 1].date as string
    const futureDates: string[] = []

    if (trendGranularity === 'month') {
      // "2025-03" → "2025-04", "2025-05", ...
      const [yStr, mStr] = lastDateStr.split('-')
      const y = parseInt(yStr, 10)
      const m = parseInt(mStr, 10) // 1..12
      for (let i = 1; i <= horizon; i++) {
        const total = y * 12 + (m - 1) + i
        const ny = Math.floor(total / 12)
        const nm = (total % 12) + 1
        futureDates.push(`${ny}-${String(nm).padStart(2, '0')}`)
      }
    } else {
      // day → +1 day, week → +7 days
      const stepDays = trendGranularity === 'week' ? 7 : 1
      const last = new Date(lastDateStr + 'T00:00:00Z')
      for (let i = 1; i <= horizon; i++) {
        const next = new Date(last.getTime() + i * stepDays * 86400000)
        futureDates.push(next.toISOString().slice(0, 10))
      }
    }

    // Pad historical period with nulls; anchor forecast at the last real point
    // so the dashed line connects continuously to the solid line
    const n = ordersVals.length
    const ordersForecastSeries = [
      ...new Array(n - 1).fill(null),
      ordersVals[n - 1],
      ...ordersForecastValues,
    ]
    const revenueForecastSeries = [
      ...new Array(n - 1).fill(null),
      revenueVals[n - 1],
      ...revenueForecastValues,
    ]

    return {
      futureDates,
      ordersForecast: ordersForecastSeries,
      revenueForecast: revenueForecastSeries,
      horizon,
    }
  }, [orderTrend, trendGranularity])

  // Human label for the forecast badge ("7-day", "4-week", "3-month")
  const forecastLabel = useMemo(() => {
    if (!forecast) return ''
    const unit = trendGranularity === 'day' ? 'day' : trendGranularity === 'week' ? 'week' : 'month'
    return `${forecast.horizon}-${unit} forecast`
  }, [forecast, trendGranularity])

  // Format trend date labels based on granularity
  const formatTrendDate = (dateStr: string) => {
    if (trendGranularity === 'day') {
      // "2025-03-15" → "Mar 15"
      const d = new Date(dateStr + 'T00:00:00Z')
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    }
    if (trendGranularity === 'week') {
      // "2025-03-10" (week start) → "Mar 10"
      const d = new Date(dateStr + 'T00:00:00Z')
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    }
    // month: "2025-03" → "Mar 2025"
    const [y, m] = dateStr.split('-')
    const d = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, 1))
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  }

  const storeTimezone = data?.storeTimezone

  const filtered = useMemo(() => {
    let items = [...orders]

    if (search) {
      const q = search.toLowerCase()
      items = items.filter(
        (o: ShopifyOrder) =>
          o.name?.toLowerCase().includes(q) ||
          o.email?.toLowerCase().includes(q) ||
          `${o.customer?.first_name ?? ''} ${o.customer?.last_name ?? ''}`.toLowerCase().includes(q)
      )
    }

    items.sort((a: any, b: any) => {
      let aVal: any, bVal: any
      switch (sortKey) {
        case 'name':
          aVal = a.name || ''
          bVal = b.name || ''
          break
        case 'created_at':
          aVal = a.created_at || ''
          bVal = b.created_at || ''
          break
        case 'customer':
          aVal = `${a.customer?.first_name ?? ''} ${a.customer?.last_name ?? ''}`.trim()
          bVal = `${b.customer?.first_name ?? ''} ${b.customer?.last_name ?? ''}`.trim()
          break
        case 'total_price':
          aVal = parseFloat(a.total_price || '0')
          bVal = parseFloat(b.total_price || '0')
          break
        case 'location':
          aVal = `${a.shipping_address?.country || ''} ${a.shipping_address?.city || ''}`.trim()
          bVal = `${b.shipping_address?.country || ''} ${b.shipping_address?.city || ''}`.trim()
          break
        default:
          aVal = a[sortKey] ?? ''
          bVal = b[sortKey] ?? ''
      }
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })

    return items
  }, [orders, search, sortKey, sortDir])

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-amber-500" />
    ) : (
      <ChevronDown className="w-3 h-3 text-amber-500" />
    )
  }

  const handleSort = (col: string) => {
    if (sortKey === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(col)
      setSortDir(col === 'name' || col === 'customer' ? 'asc' : 'desc')
    }
  }

  return (
    <div className="@container space-y-12 max-w-[1800px] mx-auto">
      {/* Header - always visible */}
      <div className={cn('mb-10 pt-2 pb-4')}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[36px] font-light theme-text-primary tracking-tight">Orders</h1>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#7AB55C]/80 mt-2">
              Shopify
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PeriodPicker
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onCustomStartDateChange={setCustomStartDate}
              onCustomEndDateChange={setCustomEndDate}
              disabled={isLoading}
            />
            <button
              onClick={() => mutate()}
              disabled={isLoading}
              className="p-1.5 theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {error ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-sm text-red-500">Failed to load orders. Please try again.</p>
        </div>
      ) : isLoading && !data ? (
        <OrdersSkeleton isLight={isLight} />
      ) : (
        <>
          {warning && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">{warning}</p>
            </div>
          )}

          {graphqlWarning && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">{graphqlWarning}</p>
            </div>
          )}

          {/* KPI Strip */}
          {summary && (
            <SharedKPIStrip
              isLight={isLight}
              isLoading={isLoading}
              cards={[
                {
                  label: 'Orders',
                  tooltip: { description: 'Total orders placed during the selected period.' },
                  kpi: data?.kpis?.orders ?? { value: summary.totalCount },
                  format: (v) => v.toLocaleString(),
                },
                {
                  label: 'Gross Sales',
                  tooltip: {
                    description:
                      'Total line item revenue before discounts, returns, taxes, and shipping.',
                    calculationTooltip: {
                      formula: 'Sum of (line item price × quantity) for all orders',
                      components: [
                        {
                          label: 'Gross Sales',
                          value: formatCurrency(summary.grossSales ?? summary.totalRevenue, cur),
                          highlight: true,
                        },
                      ],
                    },
                    note: 'Source: ShopifyQL sales dataset',
                  },
                  kpi: (data as any)?.financialKpis?.grossSales ?? {
                    value: summary.grossSales ?? summary.totalRevenue,
                  },
                  format: (v) => formatCurrency(v, cur),
                },
                {
                  label: 'Net Revenue',
                  tooltip: {
                    description:
                      'Customer-facing total after discounts, including taxes and shipping.',
                    calculationTooltip: {
                      formula: 'Gross Sales − Discounts + Taxes + Shipping',
                      components: [
                        {
                          label: 'Total Revenue',
                          value: formatCurrency(summary.totalRevenue, cur),
                          highlight: true,
                        },
                      ],
                    },
                  },
                  kpi: (data as any)?.financialKpis?.netRevenue ?? {
                    value: summary.totalRevenue,
                  },
                  format: (v) => formatCurrency(v, cur),
                },
                {
                  label: 'Avg Order Value',
                  tooltip: {
                    description: 'Average revenue per order.',
                    calculationTooltip: {
                      formula: 'Total Revenue ÷ Number of Orders',
                      components: [
                        {
                          label: 'Total Revenue',
                          value: formatCurrency(summary.totalRevenue, cur),
                        },
                        { label: '÷ Orders', value: String(summary.totalCount) },
                        {
                          label: '= AOV',
                          value: formatCurrency(summary.avgOrderValue, cur),
                          highlight: true,
                        },
                      ],
                    },
                  },
                  kpi: (data as any)?.financialKpis?.avgOrderValue ?? {
                    value: summary.avgOrderValue,
                  },
                  format: (v) => formatCurrency(v, cur),
                },
                {
                  label: 'Items Ordered',
                  tooltip: { description: 'Total line items (quantity) across all orders.' },
                  kpi: data?.kpis?.itemsOrdered ?? { value: 0 },
                  format: (v) => v.toLocaleString(),
                },
                {
                  label: 'Refunded',
                  tooltip: {
                    description: 'Number of orders that have been fully or partially refunded.',
                  },
                  kpi: { value: summary.refundedCount },
                  format: (v) => String(v),
                  invertChange: true,
                },
                ...(summary.cancelledCount
                  ? [
                      {
                        label: 'Cancelled',
                        tooltip: { description: 'Number of orders cancelled during the period.' },
                        kpi: { value: summary.cancelledCount },
                        format: (v: number) => String(v),
                        invertChange: true,
                      },
                    ]
                  : []),
              ]}
            />
          )}

          {/* Fulfillment Pipeline */}
          {data?.fulfillmentPipeline && (
            <div className="px-3 pt-4 pb-6">
              <div className="mb-3">
                <span className="text-base font-normal uppercase tracking-wider theme-text-primary">
                  Fulfillment Pipeline
                </span>
              </div>
              <FulfillmentPipelineBar pipeline={data.fulfillmentPipeline} />
            </div>
          )}

          {/* Geographic Overview */}
          {geoOverview.length > 0 && (
            <div className="pt-4 pb-4">
              <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-3">
                Order Locations
              </p>
              <div className="flex flex-wrap gap-2">
                {geoOverview.slice(0, 12).map((geo) => (
                  <div
                    key={`${geo.countryCode}-${geo.city}`}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm',
                      isLight
                        ? 'border-stone-200 bg-stone-50'
                        : 'border-white/[0.06] bg-white/[0.02]'
                    )}
                  >
                    <span className="theme-text-primary font-medium">
                      {geo.city}, {geo.countryCode}
                    </span>
                    <span className="text-xs theme-text-secondary">{geo.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historical Trend Charts */}
          {orderTrend.length > 0 &&
            (() => {
              const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
              const labelColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'
              const tooltipStyle = {
                trigger: 'axis' as const,
                backgroundColor: isDark ? '#1c1c1c' : '#fff',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
              }

              const manyPoints = orderTrend.length > 12
              const xAxisRotate = manyPoints ? 45 : 0
              const gridBottom = manyPoints ? 76 : 56

              return (
                <div
                  className={cn(
                    'grid @xl:grid-cols-2 gap-x-10 gap-y-16',
                    isLight
                      ? '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-stone-200 @xl:[&>*:nth-child(odd)]:pr-10'
                      : '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-white/[0.08] @xl:[&>*:nth-child(odd)]:pr-10'
                  )}
                >
                  {/* Chart 1: Order Volume Trend + Forecast */}
                  <section
                    className={cn(
                      'group relative px-3 pt-4 pb-6',
                      'transition-all duration-300 ease-out',
                      'hover:scale-[1.02] origin-center',
                      isLight
                        ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                        : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                    )}
                  >
                    <div className="mb-3">
                      <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                        Order Volume Trend
                        {forecast && (
                          <span className="ml-2 text-amber-500/60 font-normal normal-case">
                            + {forecastLabel}
                          </span>
                        )}
                        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                      </span>
                    </div>
                    <ReactECharts
                      option={{
                        tooltip: {
                          ...tooltipStyle,
                          formatter: (
                            params: Array<{
                              seriesName: string
                              axisValue: string
                              value: number | null
                              color: string
                            }>
                          ) => {
                            const byName: Record<string, { value: number | null; color: string }> =
                              {}
                            for (const p of params)
                              byName[p.seriesName] = { value: p.value, color: p.color }

                            const header = `<div style="font-size:11px;opacity:0.6;margin-bottom:6px">${params[0].axisValue}</div>`

                            // Forecast points: only the projected line has a value
                            const forecastVal = byName['Forecast']?.value
                            const isForecastPoint =
                              (byName['Orders']?.value ?? null) == null && forecastVal != null
                            if (isForecastPoint) {
                              const color = byName['Forecast']?.color ?? '#f59e0b'
                              const projected = `<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span><span style="flex:1">Projected Orders</span><span>${Math.round(forecastVal as number).toLocaleString()}</span></div>`
                              const note = `<div style="font-size:10px;opacity:0.55;margin-top:4px;font-style:italic">Holt-Winters forecast (α=0.3, β=0.1)</div>`
                              return header + projected + note
                            }

                            const ordersColor = byName['Orders']?.color ?? '#f59e0b'
                            const ordersVal = byName['Orders']?.value ?? 0
                            return (
                              header +
                              `<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${ordersColor}"></span><span style="flex:1">Orders</span><span>${Math.round(ordersVal as number).toLocaleString()}</span></div>`
                            )
                          },
                        },
                        grid: { top: 20, right: 16, bottom: gridBottom, left: 48 },
                        xAxis: {
                          type: 'category',
                          data: [
                            ...orderTrend.map((d: any) => formatTrendDate(d.date)),
                            ...(forecast?.futureDates.map((d) => formatTrendDate(d)) ?? []),
                          ],
                          axisLine: { lineStyle: { color: gridColor } },
                          axisLabel: { color: labelColor, fontSize: 11, rotate: xAxisRotate },
                        },
                        yAxis: {
                          type: 'value',
                          axisLabel: { color: labelColor, fontSize: 11 },
                          splitLine: { lineStyle: { color: gridColor } },
                        },
                        series: [
                          {
                            name: 'Orders',
                            type: 'line',
                            smooth: true,
                            data: [
                              ...orderTrend.map((d: any) => d.orders),
                              ...(forecast
                                ? new Array(forecast.futureDates.length).fill(null)
                                : []),
                            ],
                            itemStyle: { color: '#f59e0b' },
                            lineStyle: { color: '#f59e0b' },
                            areaStyle: { opacity: 0.1 },
                            showSymbol: false,
                            symbolSize: 6,
                          },
                          ...(forecast
                            ? [
                                {
                                  name: 'Forecast',
                                  type: 'line' as const,
                                  smooth: true,
                                  data: forecast.ordersForecast,
                                  itemStyle: { color: '#f59e0b' },
                                  lineStyle: {
                                    color: '#f59e0b',
                                    type: 'dashed' as const,
                                    opacity: 0.5,
                                  },
                                  areaStyle: { opacity: 0.04 },
                                  showSymbol: false,
                                  connectNulls: false,
                                },
                              ]
                            : []),
                        ],
                      }}
                      style={{ width: '100%', height: 280 }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </section>

                  {/* Chart 2: Total Sales Trend */}
                  <section
                    className={cn(
                      'group relative px-3 pt-4 pb-6',
                      'transition-all duration-300 ease-out',
                      'hover:scale-[1.02] origin-center',
                      isLight
                        ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                        : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                    )}
                  >
                    <div className="mb-3">
                      <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                        Total Sales Trend
                        {forecast && (
                          <span className="ml-2 text-amber-500/60 font-normal normal-case">
                            + {forecastLabel}
                          </span>
                        )}
                        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                      </span>
                    </div>
                    <ReactECharts
                      option={{
                        tooltip: {
                          ...tooltipStyle,
                          formatter: (
                            params: Array<{
                              seriesName: string
                              axisValue: string
                              value: number | null
                              color: string
                            }>
                          ) => {
                            const byName: Record<string, { value: number | null; color: string }> =
                              {}
                            for (const p of params)
                              byName[p.seriesName] = { value: p.value, color: p.color }

                            const header = `<div style="font-size:11px;opacity:0.6;margin-bottom:6px">${params[0].axisValue}</div>`
                            const divider = `<div style="border-top:1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'};margin-top:5px;padding-top:5px"></div>`

                            // Forecast points have no breakdown — only the projected total
                            const forecastVal = byName['Sales Forecast']?.value
                            const isForecastPoint =
                              (byName['Total Sales']?.value ?? null) == null && forecastVal != null
                            if (isForecastPoint) {
                              const color = byName['Sales Forecast']?.color ?? '#7AB55C'
                              const projected = `<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span><span style="flex:1">Projected Total Sales</span><span>${formatCurrency(forecastVal as number, cur)}</span></div>`
                              const note = `<div style="font-size:10px;opacity:0.55;margin-top:4px;font-style:italic">Holt-Winters forecast (α=0.3, β=0.1)</div>`
                              return header + projected + note
                            }

                            const row = (
                              label: string,
                              value: number,
                              color: string,
                              sign?: string
                            ) =>
                              `<div style="display:flex;align-items:center;gap:6px;margin-top:2px;font-size:11px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span><span style="flex:1;opacity:0.8">${sign ? sign + ' ' : ''}${label}</span><span style="font-weight:500">${sign === '\u2212' ? '\u2212 ' : ''}${formatCurrency(Math.abs(value), cur)}</span></div>`

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
                            const total = `<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${byName['Total Sales']?.color ?? '#7AB55C'}"></span><span style="flex:1">Total Sales</span><span>${formatCurrency(byName['Total Sales']?.value ?? 0, cur)}</span></div>`

                            return (
                              header + gross + discounts + net + shipping + taxes + divider + total
                            )
                          },
                        },
                        legend: {
                          bottom: 0,
                          itemWidth: 12,
                          itemHeight: 8,
                          formatter: (name: string) =>
                            name === 'Total Sales' ? `{bold|${name}}` : name,
                          textStyle: {
                            color: labelColor,
                            fontSize: 12,
                            rich: {
                              bold: {
                                fontSize: 12,
                                fontWeight: 'bold' as const,
                                color: isDark ? '#e0e0e0' : '#333',
                              },
                            },
                          },
                        },
                        grid: { top: 20, right: 16, bottom: 100, left: 60 },
                        xAxis: {
                          type: 'category',
                          data: [
                            ...orderTrend.map((d: any) => formatTrendDate(d.date)),
                            ...(forecast?.futureDates.map((d) => formatTrendDate(d)) ?? []),
                          ],
                          axisLine: { lineStyle: { color: gridColor } },
                          axisLabel: { color: labelColor, fontSize: 11, rotate: xAxisRotate },
                        },
                        yAxis: {
                          type: 'value',
                          axisLabel: {
                            color: labelColor,
                            fontSize: 11,
                            formatter: (v: number) => formatCurrency(v, cur),
                          },
                          splitLine: { lineStyle: { color: gridColor } },
                        },
                        series: (() => {
                          const pad = (arr: any[]) =>
                            forecast
                              ? [...arr, ...new Array(forecast.futureDates.length).fill(null)]
                              : arr
                          return [
                            {
                              name: 'Gross Sales',
                              type: 'line',
                              data: pad(orderTrend.map((d: any) => d.grossSales)),
                              smooth: true,
                              lineStyle: { color: '#3b82f6', width: 1.5, type: 'dotted' as const },
                              itemStyle: { color: '#3b82f6' },
                              emphasis: {
                                focus: 'series' as const,
                                lineStyle: { color: '#3b82f6', width: 2, type: 'solid' as const },
                              },
                              showSymbol: false,
                            },
                            {
                              name: 'Net Sales',
                              type: 'line',
                              data: pad(orderTrend.map((d: any) => d.netSales)),
                              smooth: true,
                              lineStyle: { color: '#8b5cf6', width: 1.5, type: 'dotted' as const },
                              itemStyle: { color: '#8b5cf6' },
                              emphasis: {
                                focus: 'series' as const,
                                lineStyle: { color: '#8b5cf6', width: 2, type: 'solid' as const },
                              },
                              showSymbol: false,
                            },
                            {
                              name: 'Discounts',
                              type: 'line',
                              data: pad(orderTrend.map((d: any) => d.discounts)),
                              smooth: true,
                              lineStyle: { color: '#ef4444', width: 1.5, type: 'dotted' as const },
                              itemStyle: { color: '#ef4444' },
                              emphasis: {
                                focus: 'series' as const,
                                lineStyle: { color: '#ef4444', width: 2, type: 'solid' as const },
                              },
                              showSymbol: false,
                            },
                            {
                              name: 'Shipping',
                              type: 'line',
                              data: pad(orderTrend.map((d: any) => d.shipping)),
                              smooth: true,
                              lineStyle: { color: '#f59e0b', width: 1.5, type: 'dotted' as const },
                              itemStyle: { color: '#f59e0b' },
                              emphasis: {
                                focus: 'series' as const,
                                lineStyle: { color: '#f59e0b', width: 2, type: 'solid' as const },
                              },
                              showSymbol: false,
                            },
                            {
                              name: 'Taxes',
                              type: 'line',
                              data: pad(orderTrend.map((d: any) => d.taxes)),
                              smooth: true,
                              lineStyle: { color: '#06b6d4', width: 1.5, type: 'dotted' as const },
                              itemStyle: { color: '#06b6d4' },
                              emphasis: {
                                focus: 'series' as const,
                                lineStyle: { color: '#06b6d4', width: 2, type: 'solid' as const },
                              },
                              showSymbol: false,
                            },
                            {
                              name: 'Total Sales',
                              type: 'line',
                              data: [
                                ...orderTrend.map((d: any) => d.revenue),
                                ...(forecast
                                  ? new Array(forecast.futureDates.length).fill(null)
                                  : []),
                              ],
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
                              showSymbol: false,
                            },
                            ...(forecast
                              ? [
                                  {
                                    name: 'Sales Forecast',
                                    type: 'line' as const,
                                    smooth: true,
                                    data: forecast.revenueForecast,
                                    z: 9,
                                    itemStyle: { color: '#7AB55C' },
                                    lineStyle: {
                                      color: '#7AB55C',
                                      type: 'dashed' as const,
                                      opacity: 0.5,
                                      width: 2,
                                    },
                                    areaStyle: { opacity: 0.03 },
                                    showSymbol: false,
                                    connectNulls: false,
                                  },
                                ]
                              : []),
                          ]
                        })(),
                      }}
                      style={{ width: '100%', height: 320 }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </section>

                  {/* Chart 3: Average Order Value Trend */}
                  <section
                    className={cn(
                      'group relative px-3 pt-4 pb-6',
                      'transition-all duration-300 ease-out',
                      'hover:scale-[1.02] origin-center',
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
                      option={{
                        tooltip: {
                          trigger: 'axis' as const,
                          backgroundColor: isDark
                            ? 'rgba(38, 38, 38, 0.95)'
                            : 'rgba(255, 255, 255, 0.95)',
                          borderColor: isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(0,0,0,0.1)',
                          textStyle: { color: isDark ? '#e5e7eb' : '#333', fontSize: 12 },
                          formatter: (params: any) => {
                            const items = Array.isArray(params) ? params : [params]
                            const idx = items[0]?.dataIndex ?? 0
                            const current = items.find(
                              (p: any) => p.seriesName === 'Current Period'
                            )
                            const prev = items.find((p: any) => p.seriesName === 'Previous Period')
                            const prevDate = prevOrderTrend[idx]?.date
                            const solidMarker = `<span style="display:inline-block;width:10px;height:3px;background:#8b5cf6;border-radius:1px;margin-right:6px"></span>`
                            const dashedMarker = `<span style="display:inline-block;width:10px;height:0;border-top:2px dashed rgba(139,92,246,0.5);margin-right:6px"></span>`
                            let html = ''
                            if (current) {
                              html += `<div style="font-size:11px;opacity:0.5;margin-bottom:2px">Current period</div>`
                              html += `<div style="display:flex;align-items:center;font-size:12px">${solidMarker}${current.axisValue}, <strong>${formatCurrency(current.value, cur)}</strong></div>`
                            }
                            if (prev && prevDate) {
                              html += `<div style="font-size:11px;opacity:0.5;margin-top:8px;margin-bottom:2px">Previous period</div>`
                              html += `<div style="display:flex;align-items:center;font-size:12px">${dashedMarker}${formatTrendDate(prevDate)}, <strong>${formatCurrency(prev.value, cur)}</strong></div>`
                            }
                            return html
                          },
                        },
                        legend:
                          prevOrderTrend.length > 0
                            ? {
                                data: ['Current Period', 'Previous Period'],
                                bottom: 0,
                                textStyle: {
                                  color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                                  fontSize: 12,
                                },
                              }
                            : undefined,
                        grid: {
                          top: 20,
                          right: 16,
                          bottom: prevOrderTrend.length > 0 ? Math.max(gridBottom, 66) : gridBottom,
                          left: 60,
                        },
                        xAxis: {
                          type: 'category',
                          data: orderTrend.map((d: any) => formatTrendDate(d.date)),
                          axisLine: { lineStyle: { color: gridColor } },
                          axisLabel: { color: labelColor, fontSize: 11, rotate: xAxisRotate },
                        },
                        yAxis: {
                          type: 'value',
                          axisLabel: {
                            color: labelColor,
                            fontSize: 11,
                            formatter: (v: number) => formatCurrency(v, cur),
                          },
                          splitLine: { lineStyle: { color: gridColor } },
                        },
                        series: [
                          {
                            name: 'Current Period',
                            type: 'line',
                            smooth: true,
                            data: orderTrend.map((d: any) => d.avgOrderValue),
                            itemStyle: { color: '#8b5cf6' },
                            lineStyle: { color: '#8b5cf6', width: 2 },
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
                          ...(prevOrderTrend.length > 0
                            ? [
                                {
                                  name: 'Previous Period',
                                  type: 'line' as const,
                                  data: prevOrderTrend.map((d: any) => d.avgOrderValue),
                                  smooth: true,
                                  lineStyle: {
                                    color: '#8b5cf6',
                                    width: 1.5,
                                    type: 'dashed' as const,
                                    opacity: 0.4,
                                  },
                                  itemStyle: { color: '#8b5cf6', opacity: 0.4 },
                                  symbol: 'none',
                                },
                              ]
                            : []),
                        ],
                      }}
                      style={{ width: '100%', height: 280 }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </section>

                  {/* Chart 4: Fulfillment Speed Trend */}
                  {fulfillmentSpeedTrend.length > 0 && (
                    <section
                      className={cn(
                        'group relative px-3 pt-4 pb-6',
                        'transition-all duration-300 ease-out',
                        'hover:scale-[1.02] origin-center',
                        isLight
                          ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
                          : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
                      )}
                    >
                      <div className="mb-3">
                        <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                          Fulfillment Speed Trend
                          <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                        </span>
                      </div>
                      <ReactECharts
                        option={{
                          tooltip: {
                            trigger: 'axis' as const,
                            backgroundColor: isDark
                              ? 'rgba(38, 38, 38, 0.95)'
                              : 'rgba(255, 255, 255, 0.95)',
                            borderColor: isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(0,0,0,0.1)',
                            textStyle: { color: isDark ? '#e5e7eb' : '#333', fontSize: 12 },
                            formatter: (params: any) => {
                              const items = Array.isArray(params) ? params : [params]
                              const idx = items[0]?.dataIndex ?? 0
                              const current = items.find(
                                (p: any) => p.seriesName === 'Current Period'
                              )
                              const prev = items.find(
                                (p: any) => p.seriesName === 'Previous Period'
                              )
                              const prevDate = prevFulfillmentSpeedTrend[idx]?.date
                              const solidMarker = `<span style="display:inline-block;width:10px;height:3px;background:#3b82f6;border-radius:1px;margin-right:6px"></span>`
                              const dashedMarker = `<span style="display:inline-block;width:10px;height:0;border-top:2px dashed rgba(59,130,246,0.5);margin-right:6px"></span>`
                              let html = ''
                              if (current) {
                                html += `<div style="font-size:11px;opacity:0.5;margin-bottom:2px">Current period</div>`
                                html += `<div style="display:flex;align-items:center;font-size:12px">${solidMarker}${current.axisValue}, <strong>${current.value}d</strong></div>`
                              }
                              if (prev && prevDate) {
                                html += `<div style="font-size:11px;opacity:0.5;margin-top:8px;margin-bottom:2px">Previous period</div>`
                                html += `<div style="display:flex;align-items:center;font-size:12px">${dashedMarker}${formatTrendDate(prevDate)}, <strong>${prev.value}d</strong></div>`
                              }
                              return html
                            },
                          },
                          legend:
                            prevFulfillmentSpeedTrend.length > 0
                              ? {
                                  data: ['Current Period', 'Previous Period'],
                                  bottom: 0,
                                  textStyle: {
                                    color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                                    fontSize: 12,
                                  },
                                }
                              : undefined,
                          grid: {
                            top: 20,
                            right: 16,
                            bottom:
                              prevFulfillmentSpeedTrend.length > 0
                                ? Math.max(gridBottom, 66)
                                : gridBottom,
                            left: 60,
                          },
                          xAxis: {
                            type: 'category',
                            data: fulfillmentSpeedTrend.map((d: any) => formatTrendDate(d.date)),
                            axisLine: { lineStyle: { color: gridColor } },
                            axisLabel: { color: labelColor, fontSize: 11, rotate: xAxisRotate },
                          },
                          yAxis: {
                            type: 'value',
                            axisLabel: {
                              color: labelColor,
                              fontSize: 11,
                              formatter: (v: number) => `${Math.round(v)}d`,
                            },
                            splitLine: { lineStyle: { color: gridColor } },
                          },
                          series: [
                            {
                              name: 'Current Period',
                              type: 'line',
                              smooth: true,
                              data: fulfillmentSpeedTrend.map(
                                (d: any) => Math.round(d.avgDaysToFulfill * 10) / 10
                              ),
                              itemStyle: { color: '#3b82f6' },
                              lineStyle: { color: '#3b82f6', width: 2 },
                              areaStyle: {
                                color: {
                                  type: 'linear',
                                  x: 0,
                                  y: 0,
                                  x2: 0,
                                  y2: 1,
                                  colorStops: [
                                    { offset: 0, color: 'rgba(59, 130, 246, 0.2)' },
                                    { offset: 1, color: 'rgba(59, 130, 246, 0.02)' },
                                  ],
                                },
                              },
                              symbol: 'none',
                            },
                            ...(prevFulfillmentSpeedTrend.length > 0
                              ? [
                                  {
                                    name: 'Previous Period',
                                    type: 'line' as const,
                                    data: prevFulfillmentSpeedTrend.map(
                                      (d: any) => Math.round(d.avgDaysToFulfill * 10) / 10
                                    ),
                                    smooth: true,
                                    lineStyle: {
                                      color: '#3b82f6',
                                      width: 1.5,
                                      type: 'dashed' as const,
                                      opacity: 0.4,
                                    },
                                    itemStyle: { color: '#3b82f6', opacity: 0.4 },
                                    symbol: 'none',
                                  },
                                ]
                              : []),
                          ],
                        }}
                        style={{ width: '100%', height: 280 }}
                        opts={{ renderer: 'canvas' }}
                      />
                    </section>
                  )}
                </div>
              )
            })()}

          {/* Risk Summary */}
          {summary?.riskHigh || summary?.riskMedium ? (
            <div className="relative" ref={riskRef}>
              <div className="flex gap-3">
                {summary.riskHigh ? (
                  <button
                    onClick={() => setRiskExpanded(riskExpanded === 'high' ? null : 'high')}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                      'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20',
                      'hover:bg-red-100 dark:hover:bg-red-900/30'
                    )}
                  >
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      {summary.riskHigh} high risk
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-3 h-3 text-red-400 transition-transform',
                        riskExpanded === 'high' && 'rotate-180'
                      )}
                    />
                  </button>
                ) : null}
                {summary.riskMedium ? (
                  <button
                    onClick={() => setRiskExpanded(riskExpanded === 'medium' ? null : 'medium')}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                      'border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-900/20',
                      'hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                    )}
                  >
                    <Shield className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                      {summary.riskMedium} medium risk
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-3 h-3 text-yellow-400 transition-transform',
                        riskExpanded === 'medium' && 'rotate-180'
                      )}
                    />
                  </button>
                ) : null}
              </div>
              {riskExpanded && riskOrders.length > 0 && (
                <div
                  className={cn(
                    'absolute top-full left-0 mt-2 z-20 w-[420px] rounded-lg border shadow-lg overflow-hidden',
                    isLight ? 'bg-white border-stone-200' : 'bg-[#141414] border-white/[0.08]'
                  )}
                >
                  <div
                    className={cn(
                      'px-3 py-2 border-b',
                      riskExpanded === 'high'
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30'
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-900/30'
                    )}
                  >
                    <div
                      className={cn(
                        'text-xs font-medium uppercase tracking-wider',
                        riskExpanded === 'high'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-yellow-600 dark:text-yellow-400'
                      )}
                    >
                      {riskExpanded === 'high' ? 'High' : 'Medium'} Risk Orders
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      {riskExpanded === 'high'
                        ? 'Shopify recommends cancelling these orders due to strong fraud indicators like mismatched billing info, high-risk location, or failed verification checks.'
                        : 'Shopify flagged these orders for investigation — some fraud signals were detected (e.g. unusual IP, partial address mismatch) but the order may still be legitimate.'}
                    </p>
                  </div>
                  <div className="max-h-[240px] overflow-y-auto">
                    {riskOrders
                      .filter((ro) => ro.riskLevel === riskExpanded)
                      .map((ro) => (
                        <div
                          key={ro.name}
                          onClick={() => {
                            const match = orders.find((o) => o.name === ro.name)
                            if (match) {
                              setExpandedOrder(match.id)
                              setRiskExpanded(null)
                              requestAnimationFrame(() => {
                                const row = tableContainerRef.current?.querySelector(
                                  `tr[data-order-name="${ro.name}"]`
                                )
                                row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              })
                            }
                          }}
                          className={cn(
                            'flex items-center justify-between px-3 py-2 text-sm border-b last:border-b-0 cursor-pointer',
                            isLight
                              ? 'border-stone-100 hover:bg-stone-50'
                              : 'border-white/[0.05] hover:bg-white/[0.04]'
                          )}
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span
                              className={cn(
                                'font-medium',
                                isLight ? 'text-stone-900' : 'text-white'
                              )}
                            >
                              {ro.name}
                            </span>
                            <span className="text-xs text-stone-500 truncate">
                              {ro.customer || 'Guest'} &middot; {formatDate(ro.createdAt)}
                            </span>
                          </div>
                          <span
                            className={cn(
                              'font-mono text-sm font-semibold tabular-nums ml-3 flex-shrink-0',
                              isLight ? 'text-stone-900' : 'text-white'
                            )}
                          >
                            {formatCurrency(ro.total, ro.currency)}
                          </span>
                        </div>
                      ))}
                    {riskOrders.filter((ro) => ro.riskLevel === riskExpanded).length === 0 && (
                      <div className="px-3 py-4 text-center text-sm text-stone-500">
                        No {riskExpanded} risk orders found.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Order Mix / Attribution Insights */}
          {attributionStats &&
            (() => {
              const channelEntries = Object.entries(attributionStats.channelBreakdown)
                .filter(([k]) => k && k !== 'Unknown')
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
              const cancelEntries = Object.entries(attributionStats.cancellationReasons)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
              const retailEntries = Object.entries(attributionStats.retailLocationBreakdown)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
              const totalRepeatBase = attributionStats.firstTimeCount + attributionStats.repeatCount
              const repeatRate =
                totalRepeatBase > 0
                  ? Math.round((attributionStats.repeatCount / totalRepeatBase) * 100)
                  : null
              const hasAnyData =
                channelEntries.length > 0 ||
                cancelEntries.length > 0 ||
                retailEntries.length > 0 ||
                totalRepeatBase > 0 ||
                attributionStats.b2bCount > 0
              if (!hasAnyData) return null
              return (
                <div className="px-3 pt-4 pb-6">
                  <div className="mb-3">
                    <span className="text-base font-normal uppercase tracking-wider theme-text-primary">
                      Order Mix
                    </span>
                  </div>
                  <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 gap-x-8 gap-y-6">
                    {totalRepeatBase > 0 && (
                      <div>
                        <div className="text-xs uppercase tracking-wider text-stone-500 mb-2">
                          New vs Repeat Customers
                        </div>
                        <div className="flex items-end gap-4">
                          <div>
                            <div
                              className={cn(
                                'text-2xl font-semibold',
                                isLight ? 'text-stone-900' : 'text-white'
                              )}
                            >
                              {attributionStats.firstTimeCount}
                            </div>
                            <div className="text-xs text-stone-500">First-time</div>
                          </div>
                          <div>
                            <div
                              className={cn(
                                'text-2xl font-semibold',
                                isLight ? 'text-stone-900' : 'text-white'
                              )}
                            >
                              {attributionStats.repeatCount}
                            </div>
                            <div className="text-xs text-stone-500">Repeat</div>
                          </div>
                          {repeatRate != null && (
                            <div className="ml-auto">
                              <div className="text-2xl font-semibold text-emerald-500">
                                {repeatRate}%
                              </div>
                              <div className="text-xs text-stone-500">repeat rate</div>
                            </div>
                          )}
                        </div>
                        {attributionStats.b2bCount > 0 && (
                          <div className="mt-3 text-xs text-stone-500">
                            <span className="font-medium text-purple-500">
                              {attributionStats.b2bCount}
                            </span>{' '}
                            B2B order{attributionStats.b2bCount === 1 ? '' : 's'} with payment terms
                          </div>
                        )}
                      </div>
                    )}
                    {channelEntries.length > 0 && (
                      <div>
                        <div className="text-xs uppercase tracking-wider text-stone-500 mb-2">
                          Sales Channel
                        </div>
                        <div className="space-y-1.5">
                          {channelEntries.map(([name, count]) => (
                            <div key={name} className="flex items-center justify-between text-sm">
                              <span
                                className={cn(
                                  'truncate mr-2',
                                  isLight ? 'text-stone-700' : 'text-stone-300'
                                )}
                              >
                                {name}
                              </span>
                              <span className="font-mono tabular-nums text-stone-500">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {cancelEntries.length > 0 && (
                      <div>
                        <div className="text-xs uppercase tracking-wider text-stone-500 mb-2">
                          Cancellation Reasons
                        </div>
                        <div className="space-y-1.5">
                          {cancelEntries.map(([reason, count]) => (
                            <div key={reason} className="flex items-center justify-between text-sm">
                              <span
                                className={cn(
                                  'lowercase mr-2',
                                  isLight ? 'text-stone-700' : 'text-stone-300'
                                )}
                              >
                                {reason.toLowerCase()}
                              </span>
                              <span className="font-mono tabular-nums text-red-500">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {retailEntries.length > 0 && (
                      <div>
                        <div className="text-xs uppercase tracking-wider text-stone-500 mb-2">
                          Retail Locations
                        </div>
                        <div className="space-y-1.5">
                          {retailEntries.map(([name, count]) => (
                            <div key={name} className="flex items-center justify-between text-sm">
                              <span
                                className={cn(
                                  'truncate mr-2',
                                  isLight ? 'text-stone-700' : 'text-stone-300'
                                )}
                              >
                                {name}
                              </span>
                              <span className="font-mono tabular-nums text-stone-500">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

          {/* Orders List */}
          <div>
            <div className="mb-4">
              <span className="text-base font-normal uppercase tracking-wider theme-text-primary">
                Orders
              </span>
            </div>
            <div className="relative flex-1 min-w-[200px] max-w-sm mb-4">
              <Search
                className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4', 'text-stone-500')}
              />
              <input
                type="text"
                placeholder="Search by order, email, or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  'w-full h-9 pl-9 pr-3 rounded-lg text-sm focus:outline-none transition-colors',
                  'border bg-transparent',
                  isLight ? 'border-stone-200' : 'border-white/[0.08]',
                  isLight ? 'text-stone-900' : 'text-white',
                  'placeholder:text-stone-400',
                  'focus:border-amber-500/40'
                )}
              />
            </div>
            <div
              ref={tableContainerRef}
              className={cn(
                'overflow-x-auto max-h-[600px] overflow-y-auto',
                '[&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent',
                isLight
                  ? '[&::-webkit-scrollbar-thumb]:bg-stone-300'
                  : '[&::-webkit-scrollbar-thumb]:bg-stone-600'
              )}
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: isLight ? '#a8a29e transparent' : '#57534e transparent',
              }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className={cn(
                      'border-b sticky top-0 z-10',
                      isLight ? 'border-stone-200 bg-white' : 'border-white/[0.08] bg-[#0a0a0a]'
                    )}
                  >
                    <th className="text-left py-2 px-3">
                      <button
                        onClick={() => handleSort('name')}
                        className={cn(
                          'flex items-center gap-1 font-medium text-stone-500 hover:text-amber-500 transition-colors select-none'
                        )}
                      >
                        Order <SortIcon col="name" />
                      </button>
                    </th>
                    <th className="text-left py-2 px-3">
                      <button
                        onClick={() => handleSort('created_at')}
                        className={cn(
                          'flex items-center gap-1 font-medium text-stone-500 hover:text-amber-500 transition-colors select-none'
                        )}
                      >
                        Date <SortIcon col="created_at" />
                      </button>
                    </th>
                    <th className="text-left py-2 px-3">
                      <button
                        onClick={() => handleSort('customer')}
                        className={cn(
                          'flex items-center gap-1 font-medium text-stone-500 hover:text-amber-500 transition-colors select-none'
                        )}
                      >
                        Customer <SortIcon col="customer" />
                      </button>
                    </th>
                    <th className="text-left py-2 px-3">
                      <span className="font-medium text-stone-500">Channel</span>
                    </th>
                    <th className="text-left py-2 px-3">
                      <button
                        onClick={() => handleSort('financial_status')}
                        className={cn(
                          'flex items-center gap-1 font-medium text-stone-500 hover:text-amber-500 transition-colors select-none'
                        )}
                      >
                        Payment <SortIcon col="financial_status" />
                      </button>
                    </th>
                    <th className="text-left py-2 px-3">
                      <button
                        onClick={() => handleSort('fulfillment_status')}
                        className={cn(
                          'flex items-center gap-1 font-medium text-stone-500 hover:text-amber-500 transition-colors select-none'
                        )}
                      >
                        Fulfillment <SortIcon col="fulfillment_status" />
                      </button>
                    </th>
                    <th className="text-left py-2 px-3 hidden @3xl:table-cell">
                      <button
                        onClick={() => handleSort('location')}
                        className={cn(
                          'flex items-center gap-1 font-medium text-stone-500 hover:text-amber-500 transition-colors select-none'
                        )}
                      >
                        Location <SortIcon col="location" />
                      </button>
                    </th>
                    <th className="text-left py-2 px-3 hidden @3xl:table-cell">
                      <span className="font-medium text-stone-500">Ship From</span>
                    </th>
                    <th className="text-right py-2 px-3">
                      <button
                        onClick={() => handleSort('total_price')}
                        className={cn(
                          'flex items-center gap-1 font-medium text-stone-500 hover:text-amber-500 transition-colors select-none ml-auto'
                        )}
                      >
                        Total <SortIcon col="total_price" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order, i) => (
                    <Fragment key={order.id}>
                      <tr
                        data-order-name={order.name}
                        className={cn(
                          'transition-colors cursor-pointer',
                          i % 2 === 1 ? (isLight ? 'bg-stone-200/50' : 'bg-white/[0.08]') : '',
                          isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.04]'
                        )}
                        onClick={() =>
                          setExpandedOrder(expandedOrder === order.id ? null : order.id)
                        }
                      >
                        <td
                          className={cn(
                            'py-2.5 px-3 font-medium',
                            isLight ? 'text-stone-900' : 'text-white'
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            {expandedOrder === order.id ? (
                              <ChevronDown className="w-3 h-3 flex-shrink-0 theme-text-secondary" />
                            ) : (
                              <ChevronRight className="w-3 h-3 flex-shrink-0 theme-text-secondary" />
                            )}
                            {order.name}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-stone-500">
                          {formatDate(order.created_at, storeTimezone)}
                        </td>
                        <td
                          className={cn('py-2.5 px-3', isLight ? 'text-stone-900' : 'text-white')}
                        >
                          {order.customer
                            ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
                            : order.email || 'Guest'}
                        </td>
                        <td className="py-2.5 px-3 text-stone-500">{order.source_name || '—'}</td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={order.financial_status} type="financial" />
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={order.fulfillment_status} type="fulfillment" />
                        </td>
                        <td className="py-2.5 px-3 text-stone-500 hidden @3xl:table-cell">
                          {[
                            order.shipping_address?.city,
                            order.shipping_address?.province_code ||
                              order.shipping_address?.country_code,
                          ]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-stone-500 hidden @3xl:table-cell">
                          {fulfillmentLocationMap[order.name]?.length
                            ? fulfillmentLocationMap[order.name].join(', ')
                            : '—'}
                        </td>
                        <td
                          className={cn(
                            'py-2.5 px-3 text-right font-mono tabular-nums font-semibold',
                            isLight ? 'text-stone-900' : 'text-white'
                          )}
                        >
                          {formatCurrency(order.total_price, order.currency)}
                        </td>
                      </tr>
                      {expandedOrder === order.id && (
                        <tr key={`${order.id}-details`}>
                          <td colSpan={9} className="p-0 border-none">
                            <OrderDetailPanel
                              orderId={order.id}
                              isLight={isLight}
                              currency={order.currency || cur}
                              storeTimezone={storeTimezone}
                              onClose={() => setExpandedOrder(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-stone-500">
                        No orders found.
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
