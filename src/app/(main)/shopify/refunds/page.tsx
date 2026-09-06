'use client'

import { Fragment, useState, useMemo, useEffect } from 'react'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useShopifyRefunds } from '../hooks/useShopifyData'
import { PeriodPicker } from '@/app/(main)/bc/components/PeriodPicker'
import { useShopifyDateRange } from '../hooks/useShopifyDateRange'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { ReactECharts, useThemeEChartsConfig } from '@/components/chat/visualizations/shared'
import type {
  ShopifyRefundItem,
  ShopifyRefundTimingBucket,
  ShopifyRefundByTag,
  ShopifyExchangeItem,
} from '@/lib/providers/shopify/types'
import {
  RefreshCw,
  Loader2,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
} from 'lucide-react'
import { InfoTooltip, type InfoTooltipProps } from '@/components/ui/InfoTooltip'
import { InfoTooltipBody } from '@/components/ui/InfoTooltipBody'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RefundDetailPanel } from './RefundDetailPanel'

function StatCard({
  label,
  tooltip,
  children,
  isLight,
}: {
  label: string
  tooltip: Pick<InfoTooltipProps, 'description' | 'calculationTooltip' | 'note'>
  children: React.ReactNode
  isLight?: boolean
}) {
  const content = (
    <div className={cn('group/stat px-5 py-4', isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]')}>
      <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1 decoration-current/15 underline-offset-2 group-hover/stat:underline">
        {label}
      </div>
      {children}
    </div>
  )

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          sideOffset={8}
          className="kpi-tooltip text-xs rounded-lg shadow-xl border z-[100] w-72 p-3 max-w-none"
        >
          <InfoTooltipBody {...tooltip} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

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

function RestockBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    return: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    legacy_restock: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    no_restock: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
    cancel: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  const labels: Record<string, string> = {
    return: 'Restocked',
    legacy_restock: 'Restocked',
    no_restock: 'Not restocked',
    cancel: 'Cancelled',
  }
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium ${colors[type] || colors.no_restock}`}
    >
      {labels[type] || type}
    </span>
  )
}

export default function ShopifyRefundsPage() {
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

  const { data, isLoading, error, mutate } = useShopifyRefunds(connected, dateRange)
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !data)
  }, [isLoading, data, welcomeContext])
  const [search, setSearch] = useState('')
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
  const [sortKey, setSortKey] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedRefund, setExpandedRefund] = useState<string | null>(null)

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
      setSortDir(
        col === 'title' || col === 'name' || col === 'reason' || col === 'customer' ? 'asc' : 'desc'
      )
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

  const refunds = data?.refunds ?? []
  const summary = data?.summary
  const enhanced = data?.enhancedSummary
  const cur = summary?.currency ?? 'USD'
  const restockTrend = data?.restockTrend ?? []
  const trendGranularity = data?.trendGranularity ?? 'month'

  // Format trend date labels based on granularity
  const formatTrendDate = (dateStr: string) => {
    if (trendGranularity === 'day') {
      const d = new Date(dateStr + 'T00:00:00Z')
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    }
    if (trendGranularity === 'week') {
      const d = new Date(dateStr + 'T00:00:00Z')
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    }
    // month: "2025-03" → "Mar 2025"
    const [y, m] = dateStr.split('-')
    const d = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, 1))
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  }

  const filtered = useMemo(() => {
    let items = refunds.filter(
      (r: ShopifyRefundItem) =>
        !search ||
        r.orderName.toLowerCase().includes(search.toLowerCase()) ||
        r.note?.toLowerCase().includes(search.toLowerCase()) ||
        r.lineItems.some((li) => li.title.toLowerCase().includes(search.toLowerCase()))
    )
    items.sort((a: ShopifyRefundItem, b: ShopifyRefundItem) => {
      let aVal: any, bVal: any
      switch (sortKey) {
        case 'orderName':
          aVal = a.orderName || ''
          bVal = b.orderName || ''
          break
        case 'createdAt':
          aVal = a.createdAt || ''
          bVal = b.createdAt || ''
          break
        case 'items':
          aVal = a.lineItems.length
          bVal = b.lineItems.length
          break
        case 'note':
          aVal = a.note || ''
          bVal = b.note || ''
          break
        case 'totalRefunded':
          aVal = a.totalRefunded || 0
          bVal = b.totalRefunded || 0
          break
        default:
          aVal = a.createdAt || ''
          bVal = b.createdAt || ''
      }
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal)
        return sortDir === 'asc' ? cmp : -cmp
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return items
  }, [refunds, search, sortKey, sortDir])

  // Chart options — use centralized theme config
  const periodData = summary?.refundsByPeriod || []
  const manyPoints = periodData.length > 12
  const xAxisRotate = manyPoints ? 45 : 0
  const gridBottom = manyPoints ? 48 : 24
  const refundsTrendOption = {
    tooltip: { trigger: 'axis' as const, ...tooltipStyle },
    grid: { top: 20, right: 16, bottom: gridBottom, left: 60 },
    xAxis: {
      type: 'category' as const,
      data: periodData.map((d) => formatTrendDate(d.date)),
      axisLabel: { ...axisLabelStyle, rotate: xAxisRotate },
      axisLine: { lineStyle: splitLineStyle },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value' as const,
        axisLabel: { ...axisLabelStyle, formatter: (v: number) => formatCurrency(v, cur) },
        splitLine: { lineStyle: splitLineStyle },
      },
      { type: 'value' as const, axisLabel: { show: false }, splitLine: { show: false } },
    ],
    series: [
      {
        name: 'Refund Amount',
        type: 'bar',
        data: periodData.map((d) => d.amount),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(239, 68, 68, 0.7)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.25)' },
            ],
          },
          borderRadius: 0,
        },
        barMaxWidth: 24,
      },
      {
        name: 'Refund Count',
        type: 'line',
        yAxisIndex: 1,
        data: periodData.map((d) => d.count),
        smooth: true,
        lineStyle: { color: '#f59e0b', width: 2 },
        itemStyle: { color: '#f59e0b' },
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  }

  // Returns as % of Revenue — combo chart: bar is gross revenue, line is refund %.
  // Shows both the "size of the pot" and the share being refunded for each period.
  const hasRevenueSeries = periodData.some((d) => (d.revenue ?? 0) > 0)
  const refundPctTrendOption = {
    tooltip: {
      trigger: 'axis' as const,
      ...tooltipStyle,
      formatter: (params: any) => {
        const arr = Array.isArray(params) ? params : [params]
        const idx = arr[0]?.dataIndex ?? 0
        const d = periodData[idx]
        if (!d) return ''
        const revenue = d.revenue ?? 0
        const refundAmt = d.amount ?? 0
        const pct = d.refundPct ?? 0
        return `<div style="min-width:180px">
          <strong>${formatTrendDate(d.date)}</strong><br/>
          Revenue: ${formatCurrency(revenue, cur)}<br/>
          Refunds: ${formatCurrency(refundAmt, cur)}<br/>
          <span style="color:#ef4444">Return Rate: ${pct}%</span>
        </div>`
      },
    },
    legend: {
      textStyle: { ...axisLabelStyle },
      top: 0,
      left: 'center',
      itemGap: 24,
    },
    grid: { top: 44, right: 56, bottom: gridBottom, left: 60 },
    xAxis: {
      type: 'category' as const,
      data: periodData.map((d) => formatTrendDate(d.date)),
      axisLabel: { ...axisLabelStyle, rotate: xAxisRotate },
      axisLine: { lineStyle: splitLineStyle },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value' as const,
        axisLabel: { ...axisLabelStyle, formatter: (v: number) => formatCurrency(v, cur) },
        splitLine: { lineStyle: splitLineStyle },
      },
      {
        type: 'value' as const,
        position: 'right' as const,
        axisLabel: { ...axisLabelStyle, formatter: (v: number) => `${v}%` },
        splitLine: { show: false },
        min: 0,
        max: (value: { max: number }) => Math.max(10, Math.ceil(value.max * 1.1)),
      },
    ],
    series: [
      {
        name: 'Revenue',
        type: 'bar',
        data: periodData.map((d) => d.revenue ?? 0),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(122, 181, 92, 0.6)' },
              { offset: 1, color: 'rgba(122, 181, 92, 0.2)' },
            ],
          },
          borderRadius: 0,
        },
        barMaxWidth: 24,
      },
      {
        name: 'Return %',
        type: 'line',
        yAxisIndex: 1,
        data: periodData.map((d) => d.refundPct ?? 0),
        smooth: true,
        lineStyle: { color: '#ef4444', width: 2 },
        itemStyle: { color: '#ef4444' },
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 6,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(239, 68, 68, 0.18)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.02)' },
            ],
          },
        },
      },
    ],
  }

  const topProducts = summary?.topRefundedProducts || []
  const topProductsOption = {
    tooltip: { trigger: 'axis' as const, ...tooltipStyle },
    grid: { top: 8, right: 16, bottom: 4, left: 120 },
    xAxis: {
      type: 'value' as const,
      axisLabel: { ...axisLabelStyle, formatter: (v: number) => formatCurrency(v, cur) },
      splitLine: { lineStyle: splitLineStyle },
    },
    yAxis: {
      type: 'category' as const,
      data: topProducts.map((p) => p.title).reverse(),
      axisLabel: { ...axisLabelStyle, width: 110, overflow: 'truncate' as const },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: topProducts.map((p) => p.amount).reverse(),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(239, 68, 68, 0.4)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.8)' },
            ],
          },
          borderRadius: 0,
        },
        barMaxWidth: 18,
      },
    ],
  }

  const restockTrendOption = {
    tooltip: { trigger: 'axis' as const, ...tooltipStyle },
    legend: { textStyle: { ...axisLabelStyle }, top: 0, right: 0 },
    grid: { top: 20, right: 16, bottom: gridBottom, left: 40 },
    xAxis: {
      type: 'category' as const,
      data: restockTrend.map((d) => formatTrendDate(d.date)),
      axisLabel: { ...axisLabelStyle, rotate: xAxisRotate },
      axisLine: { lineStyle: splitLineStyle },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: axisLabelStyle,
      splitLine: { lineStyle: splitLineStyle },
      minInterval: 1,
    },
    series: [
      {
        name: 'Restocked',
        type: 'bar',
        stack: 'restock',
        data: restockTrend.map((d) => d.restocked),
        itemStyle: { color: '#10b981' },
        barMaxWidth: 24,
      },
      {
        name: 'Not Restocked',
        type: 'bar',
        stack: 'restock',
        data: restockTrend.map((d) => d.notRestocked),
        itemStyle: { color: '#94a3b8', borderRadius: 0 },
        barMaxWidth: 24,
      },
    ],
  }

  const timingBuckets = enhanced?.timingBuckets ?? []
  const timingBucketChartOption = {
    tooltip: {
      trigger: 'axis' as const,
      ...tooltipStyle,
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params
        const bucket = timingBuckets[p.dataIndex]
        if (!bucket) return ''
        return `<div><strong>${bucket.label}</strong><br/>Count: ${bucket.count} (${bucket.percentage}%)<br/>Amount: ${formatCurrency(bucket.amount, cur)}</div>`
      },
    },
    grid: { top: 20, right: 16, bottom: 24, left: 60 },
    xAxis: {
      type: 'category' as const,
      data: timingBuckets.map((b) => b.label),
      axisLabel: axisLabelStyle,
      axisLine: { lineStyle: splitLineStyle },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value' as const,
        axisLabel: { ...axisLabelStyle, formatter: (v: number) => formatCurrency(v, cur) },
        splitLine: { lineStyle: splitLineStyle },
      },
      { type: 'value' as const, axisLabel: { show: false }, splitLine: { show: false } },
    ],
    series: [
      {
        name: 'Amount',
        type: 'bar',
        data: timingBuckets.map((b) => b.amount),
        itemStyle: {
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
          borderRadius: 0,
        },
        barMaxWidth: 40,
      },
      {
        name: 'Count',
        type: 'line',
        yAxisIndex: 1,
        data: timingBuckets.map((b) => b.count),
        smooth: true,
        lineStyle: { color: '#ef4444', width: 2 },
        itemStyle: { color: '#ef4444' },
        showSymbol: true,
        symbolSize: 6,
      },
    ],
  }

  const tagRefunds = enhanced?.refundsByTag?.slice(0, 10) ?? []
  const refundsByTagChartOption = {
    tooltip: { trigger: 'axis' as const, ...tooltipStyle },
    grid: { top: 8, right: 60, bottom: 4, left: 120 },
    xAxis: {
      type: 'value' as const,
      axisLabel: { ...axisLabelStyle, formatter: (v: number) => formatCurrency(v, cur) },
      splitLine: { lineStyle: splitLineStyle },
    },
    yAxis: {
      type: 'category' as const,
      data: tagRefunds.map((t) => t.tag).reverse(),
      axisLabel: { ...axisLabelStyle, width: 110, overflow: 'truncate' as const },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: 'Refund Amount',
        type: 'bar',
        data: tagRefunds.map((t) => t.refundAmount).reverse(),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(239, 68, 68, 0.4)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.8)' },
            ],
          },
          borderRadius: 0,
        },
        barMaxWidth: 18,
        label: {
          show: true,
          position: 'right' as const,
          formatter: (p: any) => {
            const idx = tagRefunds.length - 1 - p.dataIndex
            return `${tagRefunds[idx]?.refundRate ?? 0}%`
          },
          ...axisLabelStyle,
        },
      },
    ],
  }

  return (
    <div className="@container space-y-10 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-10 pt-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="dashboard-title text-[36px] font-light theme-text-primary tracking-tight">
              Refunds
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
              className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-sm text-red-500">Failed to load refunds. Please try again.</p>
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
              'grid grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5 gap-3 pt-5 pb-3'
            )}
          >
            <StatCard
              isLight={isLight}
              label="Total Refunds"
              tooltip={{
                description:
                  'Total number of refund transactions processed during the selected period.',
                calculationTooltip: { formula: 'Count of refund transactions in period' },
              }}
            >
              <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                {summary?.totalRefunds}
              </div>
            </StatCard>
            <StatCard
              isLight={isLight}
              label="Total Refunded"
              tooltip={{
                description: 'Sum of all refund amounts issued during the selected period.',
                calculationTooltip: {
                  formula: 'Σ individual refund amounts',
                  components: [
                    {
                      label: 'Total Refunded',
                      value: formatCurrency(summary?.totalRefundedAmount ?? 0, cur),
                      highlight: true,
                    },
                    {
                      label: 'Avg per Refund',
                      value: formatCurrency(summary?.avgRefundAmount ?? 0, cur),
                    },
                  ],
                },
              }}
            >
              <div className="text-[28px] font-mono font-semibold tabular-nums text-red-500">
                {formatCurrency(summary?.totalRefundedAmount ?? 0, cur)}
              </div>
              <div className="text-xs theme-text-secondary mt-0.5">
                Avg {formatCurrency(summary?.avgRefundAmount ?? 0, cur)}
              </div>
            </StatCard>
            <StatCard
              isLight={isLight}
              label="Refund Types"
              tooltip={{
                description:
                  'Breakdown of refunds into full (entire order refunded) and partial (only some items or amounts refunded).',
                calculationTooltip: {
                  formula: 'Total Refunds = Full + Partial',
                  components: [
                    { label: 'Full Refunds', value: summary?.fullyRefundedOrders ?? 0 },
                    { label: 'Partial Refunds', value: summary?.partiallyRefundedOrders ?? 0 },
                    { label: 'Total', value: summary?.totalRefunds ?? 0, highlight: true },
                  ],
                },
              }}
            >
              <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                {summary?.fullyRefundedOrders}{' '}
                <span className="text-[16px] theme-text-secondary font-normal">full</span>
              </div>
              <div className="text-xs theme-text-secondary">
                {summary?.partiallyRefundedOrders} partial
              </div>
            </StatCard>
            <StatCard
              isLight={isLight}
              label="Restock"
              tooltip={{
                description:
                  'Number of refunded items that were returned to inventory vs. items not restocked.',
                calculationTooltip: {
                  formula: 'Total Items = Restocked + Not Restocked',
                  components: [
                    { label: 'Restocked', value: summary?.restockedCount ?? 0 },
                    { label: 'Not Restocked', value: summary?.notRestockedCount ?? 0 },
                    {
                      label: 'Total Items',
                      value: (summary?.restockedCount ?? 0) + (summary?.notRestockedCount ?? 0),
                      highlight: true,
                    },
                  ],
                },
              }}
            >
              <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                {summary?.restockedCount}{' '}
                <span className="text-[16px] theme-text-secondary font-normal">restocked</span>
              </div>
              <div className="text-xs theme-text-secondary">
                {summary?.notRestockedCount} not restocked
              </div>
            </StatCard>
            {enhanced && (
              <>
                <StatCard
                  isLight={isLight}
                  label="Refund Rate"
                  tooltip={{
                    description:
                      'Refund rate measured by value (refunded amount as % of gross revenue) and by count (orders with refunds as % of all orders).',
                    calculationTooltip: {
                      formula: 'Total Refunded ÷ Gross Revenue × 100',
                      components: [
                        {
                          label: 'By Value',
                          value: `${enhanced.refundRateByValue}%`,
                          highlight: true,
                        },
                        { label: 'By Count', value: `${enhanced.refundRateByCount}%` },
                        {
                          label: 'Gross Revenue',
                          value: formatCurrency(enhanced.totalGrossRevenue, cur),
                        },
                        { label: 'Total Orders', value: enhanced.totalOrderCount },
                      ],
                    },
                  }}
                >
                  <div className="text-[28px] font-mono font-semibold tabular-nums text-amber-500">
                    {enhanced.refundRateByValue}%
                  </div>
                  <div className="text-xs theme-text-secondary">
                    {enhanced.refundRateByCount}% of orders
                  </div>
                </StatCard>
                <StatCard
                  isLight={isLight}
                  label="Time to Refund"
                  tooltip={{
                    description:
                      'Average and median number of days between the original purchase and the refund being processed.',
                    calculationTooltip: {
                      formula: 'Σ(refund_date − order_date) ÷ count',
                      components: [
                        {
                          label: 'Average',
                          value: `${enhanced.avgDaysToRefund} days`,
                          highlight: true,
                        },
                        { label: 'Median', value: `${enhanced.medianDaysToRefund} days` },
                      ],
                    },
                  }}
                >
                  <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                    {enhanced.avgDaysToRefund}
                    <span className="text-[16px] theme-text-secondary font-normal ml-1">
                      days avg
                    </span>
                  </div>
                  <div className="text-xs theme-text-secondary">
                    {enhanced.medianDaysToRefund} days median
                  </div>
                </StatCard>
                {enhanced.estimatedMonthlyProvision != null &&
                  enhanced.estimatedMonthlyProvision > 0 && (
                    <StatCard
                      isLight={isLight}
                      label="Est. Monthly Provision"
                      tooltip={{
                        description:
                          'Estimated monthly returns provision for P&L planning, based on the current refund rate applied to estimated monthly revenue.',
                        calculationTooltip: {
                          formula: 'Refund Rate × Est. Monthly Revenue',
                          components: [
                            { label: 'Refund Rate', value: `${enhanced.refundRateByValue}%` },
                            {
                              label: 'Period Revenue',
                              value: formatCurrency(enhanced.totalGrossRevenue, cur),
                            },
                            {
                              label: 'Est. Monthly Provision',
                              value: formatCurrency(enhanced.estimatedMonthlyProvision, cur),
                              highlight: true,
                            },
                          ],
                        },
                      }}
                    >
                      <div className="text-[28px] font-mono font-semibold tabular-nums text-orange-500">
                        {formatCurrency(enhanced.estimatedMonthlyProvision, cur)}
                      </div>
                      <div className="text-xs theme-text-secondary">
                        based on {enhanced.refundRateByValue}% return rate
                      </div>
                    </StatCard>
                  )}
                {enhanced.exchangeCount != null && (
                  <StatCard
                    isLight={isLight}
                    label="Exchanges"
                    tooltip={{
                      description:
                        'Exchanges detected when a customer receives a refund and places a new order within 7 days. These are likely product swaps rather than pure returns.',
                      calculationTooltip: {
                        formula: 'Refund + new order from same customer within 7 days',
                        components: [
                          { label: 'Total Refunds', value: summary?.totalRefunds ?? 0 },
                          { label: 'Exchanges', value: enhanced.exchangeCount, highlight: true },
                          { label: 'Pure Refunds', value: enhanced.pureRefundCount ?? 0 },
                        ],
                      },
                    }}
                  >
                    <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                      {enhanced.exchangeCount}
                    </div>
                    <div className="text-xs theme-text-secondary">
                      {enhanced.pureRefundCount ?? 0} pure refunds
                    </div>
                  </StatCard>
                )}
              </>
            )}
          </div>

          {/* ── REFUND INSIGHTS ── */}
          {enhanced && (enhanced.timingBuckets.length > 0 || enhanced.refundsByTag.length > 0) && (
            <div className="space-y-12">
              <div className="flex items-center gap-3">
                <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                  Refund Insights
                </h2>
                <div className="h-px flex-1 section-divider-line" />
              </div>

              <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-16')}>
                {enhanced.timingBuckets.length > 0 && (
                  <section
                    className={cn(
                      'flex flex-col @3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
                      isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
                      sectionHover
                    )}
                  >
                    <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-2 flex items-center gap-2">
                      Refund Timing Distribution
                      <InfoTooltip description="How quickly refunds are issued after purchase. Helps build refund provisions into monthly P&L." />
                    </p>
                    <div className="flex-1 min-h-[280px]">
                      <ReactECharts
                        option={timingBucketChartOption}
                        style={{ width: '100%', height: 280 }}
                        opts={{ renderer: 'canvas' }}
                      />
                    </div>
                    <div className="mt-3 space-y-1">
                      {enhanced.timingBuckets.map((bucket) => (
                        <div
                          key={bucket.label}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="theme-text-secondary w-24">{bucket.label}</span>
                          <div
                            className={cn(
                              'flex-1 mx-3 h-1.5 rounded-full overflow-hidden',
                              isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
                            )}
                          >
                            <div
                              className="h-full rounded-full bg-amber-500/70"
                              style={{ width: `${Math.min(bucket.percentage, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono tabular-nums theme-text-secondary w-16 text-right">
                            {bucket.count} ({bucket.percentage}%)
                          </span>
                          <span className="font-mono tabular-nums text-red-500 w-24 text-right">
                            {formatCurrency(bucket.amount, cur)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {enhanced.refundsByTag.length > 0 && (
                  <section className={cn('flex flex-col', sectionHover)}>
                    <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-2 flex items-center gap-2">
                      Refunds by Product Tag
                      <InfoTooltip description="Refund breakdown by product tag. Refund rate shows what percentage of orders containing products with this tag had refunds." />
                    </p>
                    <div className="flex-1 min-h-[280px]">
                      <ReactECharts
                        option={refundsByTagChartOption}
                        style={{ width: '100%', height: 280 }}
                        opts={{ renderer: 'canvas' }}
                      />
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}

          {/* Exchanges Table */}
          {enhanced && enhanced.exchanges && enhanced.exchanges.length > 0 && (
            <div className={cn('pb-4 border-b', borderClass)}>
              <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-4 flex items-center gap-2">
                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />
                Exchanges
                <InfoTooltip description="Transactions where a customer received a refund and placed a new order within 7 days, indicating a product exchange rather than a pure return." />
              </p>
              <div
                className={cn(
                  'overflow-x-auto max-h-[400px] overflow-y-auto rounded-[4px] border',
                  borderClass
                )}
              >
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-[var(--theme-bg)]">
                    <tr className={cn('border-b', borderClass)}>
                      <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                        Original Order
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                        Refunded Items
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                        Refund Date
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                        New Order
                      </th>
                      <th className="text-right py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                        New Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {enhanced.exchanges.map((ex, i) => (
                      <tr
                        key={`${ex.orderId}-${i}`}
                        className={cn(
                          i % 2 === 1 ? (isLight ? 'bg-black/[0.015]' : 'bg-white/[0.015]') : ''
                        )}
                      >
                        <td className="py-2 px-3 font-medium theme-text-primary">{ex.orderName}</td>
                        <td className="py-2 px-3">
                          <div className="space-y-0.5">
                            {ex.refundedItems.map((item, j) => (
                              <div key={j} className="text-xs theme-text-secondary">
                                {item.title} &times; {item.quantity}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-3 theme-text-secondary">
                          {formatDate(ex.refundDate)}
                        </td>
                        <td
                          className={cn(
                            'py-2 px-3 font-medium',
                            isLight ? 'text-blue-600' : 'text-blue-400'
                          )}
                        >
                          {ex.newOrderName || '-'}
                          {ex.newOrderDate && (
                            <div className="text-xs theme-text-secondary font-normal">
                              {formatDate(ex.newOrderDate)}
                            </div>
                          )}
                        </td>
                        <td
                          className={cn(
                            'py-2 px-3 text-right font-mono tabular-nums font-medium',
                            isLight ? 'text-emerald-600' : 'text-emerald-400'
                          )}
                        >
                          {ex.newOrderAmount != null ? formatCurrency(ex.newOrderAmount, cur) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TRENDS ── */}
          {(periodData.length > 0 || topProducts.length > 0 || restockTrend.length > 0) && (
            <div className="space-y-12">
              <div className="flex items-center gap-3">
                <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                  Trends
                </h2>
                <div className="h-px flex-1 section-divider-line" />
              </div>

              <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-16')}>
                {periodData.length > 0 && (
                  <section
                    className={cn(
                      'flex flex-col @3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
                      isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
                      sectionHover
                    )}
                  >
                    <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-6">
                      Refunds Over Time
                    </p>
                    <div className="flex-1 min-h-[280px]">
                      <ReactECharts
                        option={refundsTrendOption}
                        style={{ width: '100%', height: 280 }}
                        opts={{ renderer: 'canvas' }}
                      />
                    </div>
                  </section>
                )}
                {topProducts.length > 0 && (
                  <section className={cn('flex flex-col', sectionHover)}>
                    <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-6">
                      Most Refunded Products
                    </p>
                    <div className="flex-1 min-h-[280px]">
                      <ReactECharts
                        option={topProductsOption}
                        style={{ width: '100%', height: 280 }}
                        opts={{ renderer: 'canvas' }}
                      />
                    </div>
                  </section>
                )}
              </div>

              {periodData.length > 0 && hasRevenueSeries && (
                <section className={cn('flex flex-col', sectionHover)}>
                  <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-2 flex items-center gap-2">
                    Returns as % of Revenue
                    <InfoTooltip
                      description="Refund amount as a percentage of gross revenue for each period. Tracks how the return rate moves alongside sales volume so you can spot deteriorating periods."
                      calculationTooltip={{
                        formula: 'Refund Amount ÷ Gross Revenue × 100',
                      }}
                    />
                  </p>
                  <div className="flex-1 min-h-[300px]">
                    <ReactECharts
                      option={refundPctTrendOption}
                      style={{ width: '100%', height: 300 }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </div>
                </section>
              )}

              {restockTrend.length > 0 && (
                <section className={cn('max-w-3xl', sectionHover)}>
                  <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-6">
                    Restock Type Trend
                  </p>
                  <ReactECharts
                    option={restockTrendOption}
                    style={{ width: '100%', height: 280 }}
                    opts={{ renderer: 'canvas' }}
                  />
                </section>
              )}
            </div>
          )}

          {/* ── REFUND DETAILS ── */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                Refund Details
              </h2>
              <div className="h-px flex-1 section-divider-line" />
            </div>

            {/* Search */}
            <div className="relative w-full max-w-sm mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-secondary pointer-events-none" />
              <input
                type="text"
                placeholder="Search refunds..."
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

            {/* Refunds table */}
            <div
              className={cn(
                'overflow-x-auto overflow-y-auto max-h-[900px] rounded-[4px] border',
                borderClass,
                '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent',
                '[&::-webkit-scrollbar-thumb]:rounded-full',
                isLight
                  ? '[&::-webkit-scrollbar-thumb]:bg-stone-300'
                  : '[&::-webkit-scrollbar-thumb]:bg-white/10'
              )}
            >
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[var(--theme-bg)]">
                  <tr className={cn('border-b', borderClass)}>
                    <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('orderName')}
                        className="inline-flex items-center gap-1 hover:text-amber-500 transition-colors"
                      >
                        Order <SortIcon col="orderName" />
                      </button>
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('createdAt')}
                        className="inline-flex items-center gap-1 hover:text-amber-500 transition-colors"
                      >
                        Date <SortIcon col="createdAt" />
                      </button>
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('items')}
                        className="inline-flex items-center gap-1 hover:text-amber-500 transition-colors"
                      >
                        Items <SortIcon col="items" />
                      </button>
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      Restock
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('note')}
                        className="inline-flex items-center gap-1 hover:text-amber-500 transition-colors"
                      >
                        Note <SortIcon col="note" />
                      </button>
                    </th>
                    <th className="text-right py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('totalRefunded')}
                        className="inline-flex items-center gap-1 ml-auto hover:text-amber-500 transition-colors"
                      >
                        Amount <SortIcon col="totalRefunded" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((refund, i) => {
                    const compositeKey = `${refund.orderId}-${refund.refundId}`
                    const isExpanded = expandedRefund === compositeKey
                    return (
                      <Fragment key={refund.refundId}>
                        <tr
                          onClick={() => setExpandedRefund(isExpanded ? null : compositeKey)}
                          className={cn(
                            'transition-colors cursor-pointer',
                            i % 2 === 1 ? (isLight ? 'bg-black/[0.015]' : 'bg-white/[0.015]') : '',
                            isLight ? 'hover:bg-black/[0.03]' : 'hover:bg-white/[0.03]'
                          )}
                        >
                          <td className="py-2.5 px-3 font-medium theme-text-primary">
                            <div className="flex items-center gap-1.5">
                              <ChevronRight
                                className={cn(
                                  'w-3.5 h-3.5 theme-text-secondary transition-transform flex-shrink-0',
                                  isExpanded && 'rotate-90'
                                )}
                              />
                              {refund.orderName}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 theme-text-secondary">
                            {formatDate(refund.createdAt)}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="space-y-0.5">
                              {refund.lineItems.map((li, j) => (
                                <div key={j} className="text-xs theme-text-secondary">
                                  {li.title} &times; {li.quantity}
                                </div>
                              ))}
                              {refund.lineItems.length === 0 && (
                                <span className="text-xs theme-text-secondary">
                                  Full order refund
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {refund.lineItems.length > 0 ? (
                              <div className="space-y-0.5">
                                {refund.lineItems.map((li, j) => (
                                  <div key={j}>
                                    <RestockBadge type={li.restockType} />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs theme-text-secondary">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 theme-text-secondary text-xs max-w-[200px] truncate">
                            {refund.note || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-red-500">
                            {formatCurrency(refund.totalRefunded, refund.currency)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${refund.refundId}-details`}>
                            <td colSpan={6} className="p-0 border-none">
                              <RefundDetailPanel
                                orderId={refund.orderId}
                                refundId={refund.refundId}
                                isLight={isLight}
                                currency={refund.currency || cur}
                                onClose={() => setExpandedRefund(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center theme-text-secondary">
                        {refunds.length === 0 ? 'No refunds found.' : 'No matching refunds.'}
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
