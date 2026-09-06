'use client'

import { useState, useMemo, useEffect } from 'react'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useShopifyAbandonedCheckouts } from '../hooks/useShopifyData'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { ReactECharts } from '@/components/chat/visualizations/shared'
import { PeriodPicker } from '@/app/(main)/bc/components/PeriodPicker'
import { useShopifyDateRange } from '../hooks/useShopifyDateRange'
import type { ShopifyAbandonedCheckout } from '@/lib/providers/shopify/types'
import {
  RefreshCw,
  Loader2,
  Search,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Mail,
} from 'lucide-react'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

export default function ShopifyAbandonedCheckoutsPage() {
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

  const { data, isLoading, error, mutate } = useShopifyAbandonedCheckouts(connected, dateRange)
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !data)
  }, [isLoading, data, welcomeContext])
  const [search, setSearch] = useState('')
  const { theme } = useTheme()
  const isDark = theme !== 'light'
  const isLight = theme === 'light'
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

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
      setSortDir(col === 'email' || col === 'referring_site' ? 'asc' : 'desc')
    }
  }

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

  const checkouts = data?.checkouts ?? []
  const summary = data?.summary
  const abandonmentTrend = data?.abandonmentTrend ?? []
  const exitAnalysis = (data as any)?.exitAnalysis as {
    stages: Array<{ stage: string; count: number }>
    medianTimeMinutes: number
    totalAnalyzed: number
  } | null
  const cur = summary?.currency ?? 'USD'

  const filtered = useMemo(() => {
    let items = checkouts.filter(
      (c: ShopifyAbandonedCheckout) =>
        !search ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.customer?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.customer?.last_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.referring_site?.toLowerCase().includes(search.toLowerCase()) ||
        c.line_items.some((li) => li.title.toLowerCase().includes(search.toLowerCase()))
    )
    items.sort((a: ShopifyAbandonedCheckout, b: ShopifyAbandonedCheckout) => {
      let aVal: any, bVal: any
      switch (sortKey) {
        case 'email':
          aVal = a.email || a.customer?.first_name || ''
          bVal = b.email || b.customer?.first_name || ''
          break
        case 'created_at':
          aVal = a.created_at || ''
          bVal = b.created_at || ''
          break
        case 'total_price':
          aVal = parseFloat(a.total_price) || 0
          bVal = parseFloat(b.total_price) || 0
          break
        case 'items':
          aVal = a.line_items.length
          bVal = b.line_items.length
          break
        case 'referring_site':
          aVal = a.referring_site || ''
          bVal = b.referring_site || ''
          break
        case 'status':
          aVal = a.completed_at ? 1 : 0
          bVal = b.completed_at ? 1 : 0
          break
        default:
          aVal = a.created_at || ''
          bVal = b.created_at || ''
      }
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal)
        return sortDir === 'asc' ? cmp : -cmp
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return items
  }, [checkouts, search, sortKey, sortDir])

  // Chart colors
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const labelColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'

  // Abandonment Trend chart (dual axis: bars for abandoned, line for recovered)
  const abandonmentTrendOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? '#1e1e2e' : '#fff',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
    },
    legend: { textStyle: { color: labelColor, fontSize: 10 }, top: 0, right: 0 },
    grid: { top: 24, right: 16, bottom: 24, left: 40 },
    xAxis: {
      type: 'category' as const,
      data: abandonmentTrend.map((d) => d.date),
      axisLabel: { color: labelColor, fontSize: 10 },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value' as const,
        min: 0,
        axisLabel: { color: labelColor, fontSize: 10 },
        splitLine: { lineStyle: { color: gridColor } },
        minInterval: 1,
      },
      {
        type: 'value' as const,
        min: 0,
        axisLabel: { show: false },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Abandoned',
        type: 'bar',
        data: abandonmentTrend.map((d) => d.abandoned),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(239, 68, 68, 0.8)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.3)' },
            ],
          },
          borderRadius: 0,
        },
        barMaxWidth: 24,
      },
      {
        name: 'Recovered',
        type: 'line',
        yAxisIndex: 1,
        data: abandonmentTrend.map((d) => d.recovered),
        smooth: true,
        lineStyle: { color: '#10b981', width: 2 },
        itemStyle: { color: '#10b981' },
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  }

  // Top Abandoned Products chart (horizontal bar)
  const topProducts = summary?.topAbandonedProducts || []
  const topProductsOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? '#1e1e2e' : '#fff',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
    },
    grid: { top: 8, right: 16, bottom: 4, left: 120 },
    xAxis: {
      type: 'value' as const,
      axisLabel: { color: labelColor, fontSize: 10 },
      splitLine: { lineStyle: { color: gridColor } },
      minInterval: 1,
    },
    yAxis: {
      type: 'category' as const,
      data: topProducts.map((p) => p.title).reverse(),
      axisLabel: { color: labelColor, fontSize: 10, width: 110, overflow: 'truncate' as const },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: topProducts.map((p) => p.count).reverse(),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.5)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.9)' },
            ],
          },
          borderRadius: 0,
        },
        barMaxWidth: 18,
      },
    ],
  }

  // Cart Value Trend chart (line with area)
  const cartValueTrendOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? '#1e1e2e' : '#fff',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
    },
    grid: { top: 20, right: 16, bottom: 24, left: 60 },
    xAxis: {
      type: 'category' as const,
      data: abandonmentTrend.map((d) => d.date),
      axisLabel: { color: labelColor, fontSize: 10 },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      min: 0,
      axisLabel: {
        color: labelColor,
        fontSize: 10,
        formatter: (v: number) => formatCurrency(v, cur),
      },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: [
      {
        name: 'Abandoned Value',
        type: 'line',
        data: abandonmentTrend.map((d) => d.totalValue),
        smooth: true,
        lineStyle: { color: '#f59e0b', width: 2 },
        itemStyle: { color: '#f59e0b' },
        symbol: 'circle',
        symbolSize: 5,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245, 158, 11, 0.3)' },
              { offset: 1, color: 'rgba(245, 158, 11, 0.02)' },
            ],
          },
        },
      },
    ],
  }

  // Traffic Sources chart (horizontal bar)
  const byReferrer = summary?.byReferrer || []
  const trafficSourcesOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? '#1e1e2e' : '#fff',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
    },
    grid: { top: 8, right: 16, bottom: 4, left: 120 },
    xAxis: {
      type: 'value' as const,
      axisLabel: { color: labelColor, fontSize: 10 },
      splitLine: { lineStyle: { color: gridColor } },
      minInterval: 1,
    },
    yAxis: {
      type: 'category' as const,
      data: byReferrer.map((r) => r.source).reverse(),
      axisLabel: { color: labelColor, fontSize: 10, width: 110, overflow: 'truncate' as const },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: byReferrer.map((r) => r.count).reverse(),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(20, 184, 166, 0.5)' },
              { offset: 1, color: 'rgba(20, 184, 166, 0.9)' },
            ],
          },
          borderRadius: 0,
        },
        barMaxWidth: 18,
      },
    ],
  }

  return (
    <div className="@container space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div
        className={cn(
          'mb-10 pt-2 pb-4 border-b shadow-sm',
          isLight
            ? 'border-stone-200/80 shadow-stone-200/50'
            : 'border-white/[0.06] shadow-black/20'
        )}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[36px] font-light theme-text-primary tracking-tight">
              Abandoned Carts
            </h1>
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

      {error ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-sm text-red-500">
            Failed to load abandoned checkouts. Please try again.
          </p>
        </div>
      ) : isLoading && !data ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div
            className={cn(
              'flex flex-wrap justify-start gap-x-10 gap-y-4 pt-5 pb-3 border-b',
              isLight ? 'border-stone-200' : 'border-white/[0.08]'
            )}
          >
            <div>
              <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1 flex items-center gap-1">
                Total Abandoned
                <InfoTooltip description="Total number of checkout sessions that were started but not completed during the selected period." />
              </div>
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {summary?.totalAbandoned ?? 0}
              </div>
            </div>
            <div>
              <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1 flex items-center gap-1">
                Recovered
                <InfoTooltip description="Abandoned checkouts that were later completed by the customer, either through recovery emails or on their own." />
              </div>
              <div className="text-[28px] font-mono font-semibold tabular-nums text-green-500">
                {summary?.totalRecovered ?? 0}
              </div>
            </div>
            <div>
              <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1 flex items-center gap-1">
                Recovery Rate
                <InfoTooltip
                  description="Percentage of abandoned checkouts that were subsequently recovered and completed."
                  calculationTooltip={{
                    formula: 'Recovery Rate = (Recovered / Total Abandoned) x 100',
                    components: [
                      { label: 'Recovered', value: summary?.totalRecovered ?? 0 },
                      { label: 'Total Abandoned', value: summary?.totalAbandoned ?? 0 },
                      {
                        label: 'Recovery Rate',
                        value: formatPercent(summary?.recoveryRate ?? 0),
                        highlight: true,
                      },
                    ],
                  }}
                />
              </div>
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {formatPercent(summary?.recoveryRate ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1 flex items-center gap-1">
                Abandoned Value
                <InfoTooltip
                  description="Total monetary value of all abandoned checkout carts combined."
                  calculationTooltip={{
                    formula: 'Abandoned Value = Sum of all abandoned cart totals',
                    components: [
                      {
                        label: 'Total Abandoned Value',
                        value: formatCurrency(summary?.totalAbandonedValue ?? 0, cur),
                        highlight: true,
                      },
                      { label: 'Total Carts', value: summary?.totalAbandoned ?? 0 },
                    ],
                  }}
                />
              </div>
              <div className="text-[28px] font-mono font-semibold tabular-nums text-red-500">
                {formatCurrency(summary?.totalAbandonedValue ?? 0, cur)}
              </div>
            </div>
            <div>
              <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1 flex items-center gap-1">
                Avg Cart Value
                <InfoTooltip
                  description="Average monetary value per abandoned checkout cart."
                  calculationTooltip={{
                    formula: 'Avg Cart Value = Total Abandoned Value / Total Abandoned',
                    components: [
                      {
                        label: 'Total Abandoned Value',
                        value: formatCurrency(summary?.totalAbandonedValue ?? 0, cur),
                      },
                      { label: 'Total Abandoned', value: summary?.totalAbandoned ?? 0 },
                      {
                        label: 'Avg Cart Value',
                        value: formatCurrency(summary?.avgCartValue ?? 0, cur),
                        highlight: true,
                      },
                    ],
                  }}
                />
              </div>
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {formatCurrency(summary?.avgCartValue ?? 0, cur)}
              </div>
            </div>
            <div>
              <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1 flex items-center gap-1">
                Marketing Consent
                <InfoTooltip
                  description="Percentage of abandoned checkout customers who opted in to receive marketing communications."
                  calculationTooltip={{
                    formula: 'Consent Rate = (Consented / Total Abandoned) x 100',
                    components: [
                      { label: 'Total Abandoned', value: summary?.totalAbandoned ?? 0 },
                      {
                        label: 'Consent Rate',
                        value: formatPercent(summary?.marketingConsentRate ?? 0),
                        highlight: true,
                      },
                    ],
                  }}
                />
              </div>
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {formatPercent(summary?.marketingConsentRate ?? 0)}
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid @xl:grid-cols-2 gap-5">
            {abandonmentTrend.length > 0 && (
              <div
                className={cn(
                  'pb-4 border-b',
                  isLight ? 'border-stone-200' : 'border-white/[0.08]'
                )}
              >
                <p className="text-[11px] font-medium theme-text-secondary uppercase tracking-wider mb-3">
                  Abandonment Trend
                </p>
                <ReactECharts
                  option={abandonmentTrendOption}
                  style={{ width: '100%', height: 280 }}
                  opts={{ renderer: 'canvas' }}
                />
              </div>
            )}
            {topProducts.length > 0 && (
              <div
                className={cn(
                  'pb-4 border-b',
                  isLight ? 'border-stone-200' : 'border-white/[0.08]'
                )}
              >
                <p className="text-[11px] font-medium theme-text-secondary uppercase tracking-wider mb-3">
                  Top Abandoned Products
                </p>
                <ReactECharts
                  option={topProductsOption}
                  style={{ width: '100%', height: 280 }}
                  opts={{ renderer: 'canvas' }}
                />
              </div>
            )}
            {abandonmentTrend.length > 0 && (
              <div
                className={cn(
                  'pb-4 border-b',
                  isLight ? 'border-stone-200' : 'border-white/[0.08]'
                )}
              >
                <p className="text-[11px] font-medium theme-text-secondary uppercase tracking-wider mb-3">
                  Cart Value Trend
                </p>
                <ReactECharts
                  option={cartValueTrendOption}
                  style={{ width: '100%', height: 280 }}
                  opts={{ renderer: 'canvas' }}
                />
              </div>
            )}
            {byReferrer.length > 0 && (
              <div
                className={cn(
                  'pb-4 border-b',
                  isLight ? 'border-stone-200' : 'border-white/[0.08]'
                )}
              >
                <p className="text-[11px] font-medium theme-text-secondary uppercase tracking-wider mb-3">
                  Traffic Sources
                </p>
                <ReactECharts
                  option={trafficSourcesOption}
                  style={{ width: '100%', height: 280 }}
                  opts={{ renderer: 'canvas' }}
                />
              </div>
            )}
          </div>

          {/* Exit Analysis */}
          {exitAnalysis && exitAnalysis.stages.length > 0 && (
            <div className="pt-2 pb-4">
              <div className="flex items-center gap-3 mb-4">
                <p className="text-base font-normal uppercase tracking-wider theme-text-primary">
                  Where Customers Drop Off
                </p>
                <InfoTooltip
                  description="Estimated checkout stage where customers abandoned, inferred from what information they provided before leaving."
                  note="Shopify does not expose explicit abandonment reasons. Stages are inferred: no email = Cart, email but no address = Contact Info, address present = Shipping/Payment."
                />
              </div>
              <div className="flex flex-wrap gap-4 items-end">
                {exitAnalysis.stages.map((s) => {
                  const pct =
                    exitAnalysis.totalAnalyzed > 0
                      ? Math.round((s.count / exitAnalysis.totalAnalyzed) * 100)
                      : 0
                  return (
                    <div
                      key={s.stage}
                      className={cn(
                        'flex flex-col items-center gap-2 px-5 py-3 rounded-lg border min-w-[120px]',
                        isLight
                          ? 'border-stone-200 bg-stone-50'
                          : 'border-white/[0.06] bg-white/[0.02]'
                      )}
                    >
                      <span className="text-[11px] font-medium theme-text-secondary uppercase tracking-wider">
                        {s.stage}
                      </span>
                      <span
                        className={cn(
                          'text-[24px] font-mono font-semibold tabular-nums',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        {s.count}
                      </span>
                      <span className="text-xs text-red-400">{pct}%</span>
                    </div>
                  )
                })}
                {exitAnalysis.medianTimeMinutes > 0 && (
                  <div
                    className={cn(
                      'flex flex-col items-center gap-2 px-5 py-3 rounded-lg border min-w-[120px]',
                      isLight
                        ? 'border-stone-200 bg-stone-50'
                        : 'border-white/[0.06] bg-white/[0.02]'
                    )}
                  >
                    <span className="text-[11px] font-medium theme-text-secondary uppercase tracking-wider">
                      Median Time
                    </span>
                    <span
                      className={cn(
                        'text-[24px] font-mono font-semibold tabular-nums',
                        isLight ? 'text-stone-900' : 'text-white'
                      )}
                    >
                      {exitAnalysis.medianTimeMinutes < 60
                        ? `${exitAnalysis.medianTimeMinutes}m`
                        : `${Math.round(exitAnalysis.medianTimeMinutes / 60)}h`}
                    </span>
                    <span className="text-xs theme-text-secondary">before leaving</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search abandoned checkouts..."
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

          {/* Abandoned checkouts table */}
          <div className="overflow-x-auto overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-stone-300 dark:scrollbar-thumb-stone-700 scrollbar-track-transparent">
            <table className="w-full text-sm">
              <thead className={cn('sticky top-0 z-10', isLight ? 'bg-white' : 'bg-[#0a0a0a]')}>
                <tr
                  className={cn('border-b', isLight ? 'border-stone-200' : 'border-white/[0.08]')}
                >
                  <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('email')}
                      className="inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Customer <SortIcon col="email" />
                    </button>
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('created_at')}
                      className="inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Date <SortIcon col="created_at" />
                    </button>
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('total_price')}
                      className="inline-flex items-center gap-1 ml-auto hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Cart Value <SortIcon col="total_price" />
                    </button>
                  </th>
                  <th className="text-center py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('items')}
                      className="inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Items <SortIcon col="items" />
                    </button>
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('referring_site')}
                      className="inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Referrer <SortIcon col="referring_site" />
                    </button>
                  </th>
                  <th className="text-center py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                    Marketing
                  </th>
                  <th className="text-center py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('status')}
                      className="inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Status <SortIcon col="status" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((checkout, i) => {
                  const customerName = checkout.customer
                    ? `${checkout.customer.first_name || ''} ${checkout.customer.last_name || ''}`.trim()
                    : null
                  const displayName = customerName || checkout.email || 'Anonymous'
                  const isRecovered = checkout.completed_at != null

                  return (
                    <tr
                      key={checkout.id}
                      className={cn(
                        'transition-colors',
                        i % 2 === 1 ? (isLight ? 'bg-stone-50' : 'bg-white/[0.02]') : '',
                        isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.04]'
                      )}
                    >
                      <td className={cn('py-2.5 px-3', isLight ? 'text-stone-900' : 'text-white')}>
                        <div className="font-medium">{displayName}</div>
                        {customerName && checkout.email && (
                          <div className="text-xs text-stone-500 truncate max-w-[200px]">
                            {checkout.email}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-stone-500">
                        {formatDate(checkout.created_at)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-red-500">
                        {formatCurrency(parseFloat(checkout.total_price), checkout.currency)}
                      </td>
                      <td className="py-2.5 px-3 text-center text-stone-500">
                        {checkout.line_items.length}
                      </td>
                      <td className="py-2.5 px-3 text-stone-500 text-xs max-w-[200px] truncate">
                        {checkout.referring_site || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {checkout.buyer_accepts_marketing ? (
                          <Mail className="w-4 h-4 text-green-500 inline-block" />
                        ) : (
                          <span className="text-stone-400">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isRecovered ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Recovered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                            <XCircle className="w-3.5 h-3.5" />
                            Abandoned
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-stone-500">
                      {checkouts.length === 0
                        ? 'No abandoned checkouts found.'
                        : 'No matching checkouts.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
