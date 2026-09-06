'use client'

import { Fragment, useState, useMemo, useEffect } from 'react'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useShopifyReturns } from '../hooks/useShopifyData'
import { PeriodPicker } from '@/app/(main)/bc/components/PeriodPicker'
import { useShopifyDateRange } from '../hooks/useShopifyDateRange'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { ReactECharts, useThemeEChartsConfig } from '@/components/chat/visualizations/shared'
import type { ShopifyReturnItem, ShopifyReturnStatus } from '@/lib/providers/shopify/types'
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
import { ReturnDetailPanel } from './ReturnDetailPanel'

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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function humanizeReason(reason: string): string {
  return reason
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const STATUS_COLORS: Record<ShopifyReturnStatus, string> = {
  REQUESTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  CLOSED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  DECLINED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  CANCELED: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
}

function StatusBadge({ status }: { status: ShopifyReturnStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 text-xs font-medium uppercase tracking-wider',
        STATUS_COLORS[status]
      )}
    >
      {status.toLowerCase()}
    </span>
  )
}

export default function ShopifyReturnsPage() {
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

  const { data, isLoading, error, mutate } = useShopifyReturns(connected, dateRange)
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
  const [expandedReturn, setExpandedReturn] = useState<string | null>(null)

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
        col === 'orderName' || col === 'name' || col === 'status' || col === 'customer'
          ? 'asc'
          : 'desc'
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

  const returns = data?.returns ?? []
  const summary = data?.summary
  const trendGranularity = data?.trendGranularity ?? 'month'

  const formatTrendDate = (dateStr: string) => {
    if (trendGranularity === 'day' || trendGranularity === 'week') {
      const d = new Date(dateStr + 'T00:00:00Z')
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    }
    const [y, m] = dateStr.split('-')
    const d = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, 1))
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  }

  const filtered = useMemo(() => {
    let items = returns.filter((r: ShopifyReturnItem) => {
      if (!search) return true
      const s = search.toLowerCase()
      return (
        r.name.toLowerCase().includes(s) ||
        r.orderName.toLowerCase().includes(s) ||
        (r.customerName?.toLowerCase().includes(s) ?? false) ||
        (r.customerEmail?.toLowerCase().includes(s) ?? false) ||
        r.returnLineItems.some((li) => li.title.toLowerCase().includes(s))
      )
    })
    items.sort((a: ShopifyReturnItem, b: ShopifyReturnItem) => {
      let aVal: any, bVal: any
      switch (sortKey) {
        case 'name':
          aVal = a.name
          bVal = b.name
          break
        case 'orderName':
          aVal = a.orderName
          bVal = b.orderName
          break
        case 'status':
          aVal = a.status
          bVal = b.status
          break
        case 'customer':
          aVal = a.customerName || ''
          bVal = b.customerName || ''
          break
        case 'items':
          aVal = a.totalQuantity
          bVal = b.totalQuantity
          break
        case 'createdAt':
        default:
          aVal = a.createdAt
          bVal = b.createdAt
      }
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal)
        return sortDir === 'asc' ? cmp : -cmp
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return items
  }, [returns, search, sortKey, sortDir])

  // ── Chart options ─────────────────────────────────────
  const periodData = summary?.returnsByPeriod || []
  const manyPoints = periodData.length > 12
  const xAxisRotate = manyPoints ? 45 : 0
  const gridBottom = manyPoints ? 48 : 24

  const returnsTrendOption = {
    tooltip: {
      trigger: 'axis' as const,
      ...tooltipStyle,
      formatter: (params: any) => {
        const arr = Array.isArray(params) ? params : [params]
        const idx = arr[0]?.dataIndex ?? 0
        const d = periodData[idx]
        if (!d) return ''
        return `<div style="min-width:180px">
          <strong>${formatTrendDate(d.date)}</strong><br/>
          Returns: ${d.count}<br/>
          Orders: ${d.orderCount}<br/>
          <span style="color:#ef4444">Return Rate: ${d.returnRate}%</span>
        </div>`
      },
    },
    legend: { textStyle: { ...axisLabelStyle }, top: 0, left: 'center', itemGap: 24 },
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
        axisLabel: axisLabelStyle,
        splitLine: { lineStyle: splitLineStyle },
        minInterval: 1,
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
        name: 'Returns',
        type: 'bar',
        data: periodData.map((d) => d.count),
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
        barMaxWidth: 24,
      },
      {
        name: 'Return %',
        type: 'line',
        yAxisIndex: 1,
        data: periodData.map((d) => d.returnRate),
        smooth: true,
        lineStyle: { color: '#ef4444', width: 2 },
        itemStyle: { color: '#ef4444' },
        showSymbol: true,
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

  const topReasons = summary?.topReasons ?? []
  const reasonsChartOption = {
    tooltip: { trigger: 'axis' as const, ...tooltipStyle },
    grid: { top: 8, right: 16, bottom: 4, left: 140 },
    xAxis: {
      type: 'value' as const,
      axisLabel: axisLabelStyle,
      splitLine: { lineStyle: splitLineStyle },
      minInterval: 1,
    },
    yAxis: {
      type: 'category' as const,
      data: topReasons.map((r) => humanizeReason(r.reason)).reverse(),
      axisLabel: { ...axisLabelStyle, width: 130, overflow: 'truncate' as const },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: topReasons.map((r) => r.count).reverse(),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(245, 158, 11, 0.4)' },
              { offset: 1, color: 'rgba(245, 158, 11, 0.8)' },
            ],
          },
          borderRadius: 0,
        },
        barMaxWidth: 18,
      },
    ],
  }

  const statusBuckets = summary?.statusBuckets ?? []
  const statusChartOption = {
    tooltip: { trigger: 'axis' as const, ...tooltipStyle },
    grid: { top: 8, right: 16, bottom: 24, left: 60 },
    xAxis: {
      type: 'category' as const,
      data: statusBuckets.map((b) => b.status.toLowerCase()),
      axisLabel: axisLabelStyle,
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
        type: 'bar',
        data: statusBuckets.map((b) => {
          // Color each bar by status
          const colorMap: Record<ShopifyReturnStatus, string> = {
            REQUESTED: '#facc15',
            OPEN: '#3b82f6',
            CLOSED: '#10b981',
            DECLINED: '#ef4444',
            CANCELED: '#94a3b8',
          }
          return { value: b.count, itemStyle: { color: colorMap[b.status] } }
        }),
        barMaxWidth: 40,
      },
    ],
  }

  const topProducts = summary?.topProducts ?? []
  const topProductsOption = {
    tooltip: { trigger: 'axis' as const, ...tooltipStyle },
    grid: { top: 8, right: 16, bottom: 4, left: 140 },
    xAxis: {
      type: 'value' as const,
      axisLabel: axisLabelStyle,
      splitLine: { lineStyle: splitLineStyle },
      minInterval: 1,
    },
    yAxis: {
      type: 'category' as const,
      data: topProducts.map((p) => p.title).reverse(),
      axisLabel: { ...axisLabelStyle, width: 130, overflow: 'truncate' as const },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: topProducts.map((p) => p.quantity).reverse(),
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

  return (
    <div className="@container space-y-10 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-10 pt-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="dashboard-title text-[36px] font-light theme-text-primary tracking-tight">
              Returns
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
          <p className="text-sm text-red-500">Failed to load returns. Please try again.</p>
        </div>
      ) : isLoading && !data ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
        </div>
      ) : (
        <>
          {data?.warning && (
            <div
              className={cn(
                'px-4 py-2 text-xs rounded-[4px] border',
                isLight
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-amber-900/20 border-amber-900/40 text-amber-300'
              )}
            >
              {data.warning}
            </div>
          )}

          {/* Summary strip */}
          <div
            className={cn(
              'grid grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-6 gap-3 pt-5 pb-3'
            )}
          >
            <StatCard
              isLight={isLight}
              label="Total Returns"
              tooltip={{
                description:
                  'Total number of returns initiated during the selected period (any status).',
                calculationTooltip: { formula: 'Count of returns with createdAt in period' },
              }}
            >
              <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                {summary?.totalReturns ?? 0}
              </div>
              <div className="text-xs theme-text-secondary mt-0.5">
                {summary?.totalUnitsReturned ?? 0} units
              </div>
            </StatCard>

            <StatCard
              isLight={isLight}
              label="Open"
              tooltip={{
                description:
                  'Returns currently awaiting action — either requested by the customer or open in your queue.',
                calculationTooltip: {
                  formula: 'Count of returns where status ∈ {REQUESTED, OPEN}',
                  components: [
                    { label: 'Open / Requested', value: summary?.openCount ?? 0, highlight: true },
                    { label: 'Closed', value: summary?.closedCount ?? 0 },
                    { label: 'Declined', value: summary?.declinedCount ?? 0 },
                    { label: 'Canceled', value: summary?.canceledCount ?? 0 },
                  ],
                },
              }}
            >
              <div className="text-[28px] font-mono font-semibold tabular-nums text-blue-500">
                {summary?.openCount ?? 0}
              </div>
              <div className="text-xs theme-text-secondary mt-0.5">action queue</div>
            </StatCard>

            <StatCard
              isLight={isLight}
              label="Return Rate"
              tooltip={{
                description:
                  'Percentage of orders in the period that resulted in a return. The operational counterpart to the financial refund rate on the Refunds page.',
                calculationTooltip: {
                  formula: 'Total Returns ÷ Total Orders × 100',
                  components: [
                    {
                      label: 'Return Rate',
                      value: `${summary?.returnRateByCount ?? 0}%`,
                      highlight: true,
                    },
                    { label: 'Returns', value: summary?.totalReturns ?? 0 },
                    { label: 'Orders', value: summary?.totalOrderCount ?? 0 },
                  ],
                },
              }}
            >
              <div className="text-[28px] font-mono font-semibold tabular-nums text-amber-500">
                {summary?.returnRateByCount ?? 0}%
              </div>
              <div className="text-xs theme-text-secondary mt-0.5">
                of {summary?.totalOrderCount ?? 0} orders
              </div>
            </StatCard>

            <StatCard
              isLight={isLight}
              label="Avg Resolution"
              tooltip={{
                description:
                  'Average days from when a return is created to when it is processed (i.e. linked refund issued). A SLA signal for your returns workflow.',
                calculationTooltip: {
                  formula: 'Σ(processed − created) ÷ count',
                  components: [
                    {
                      label: 'Average',
                      value: `${summary?.avgResolutionDays ?? 0} days`,
                      highlight: true,
                    },
                    { label: 'Median', value: `${summary?.medianResolutionDays ?? 0} days` },
                  ],
                },
                note: 'Only counts returns with a linked processed refund.',
              }}
            >
              <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                {summary?.avgResolutionDays ?? 0}
                <span className="text-[16px] theme-text-secondary font-normal ml-1">days</span>
              </div>
              <div className="text-xs theme-text-secondary mt-0.5">
                {summary?.medianResolutionDays ?? 0} median
              </div>
            </StatCard>

            <StatCard
              isLight={isLight}
              label="Decline Rate"
              tooltip={{
                description:
                  'Share of returns that were declined by the merchant — a policy enforcement signal. High decline rates may indicate unclear return policies or fraud patterns.',
                calculationTooltip: {
                  formula: 'Declined ÷ Total Returns × 100',
                  components: [
                    { label: 'Declined', value: summary?.declinedCount ?? 0 },
                    { label: 'Total', value: summary?.totalReturns ?? 0 },
                    {
                      label: 'Decline Rate',
                      value: `${summary?.declineRate ?? 0}%`,
                      highlight: true,
                    },
                  ],
                },
              }}
            >
              <div className="text-[28px] font-mono font-semibold tabular-nums text-red-500">
                {summary?.declineRate ?? 0}%
              </div>
              <div className="text-xs theme-text-secondary mt-0.5">
                {summary?.declinedCount ?? 0} declined
              </div>
            </StatCard>

            <StatCard
              isLight={isLight}
              label="Exchange Rate"
              tooltip={{
                description:
                  'Share of returns that include exchange line items — i.e. the customer is swapping the product instead of just getting their money back. Higher = better revenue retention.',
                calculationTooltip: {
                  formula: 'Returns with exchanges ÷ Total Returns × 100',
                  components: [
                    { label: 'Exchanges', value: summary?.exchangeCount ?? 0 },
                    { label: 'Total', value: summary?.totalReturns ?? 0 },
                    {
                      label: 'Exchange Rate',
                      value: `${summary?.exchangeRate ?? 0}%`,
                      highlight: true,
                    },
                  ],
                },
              }}
            >
              <div className="text-[28px] font-mono font-semibold tabular-nums text-emerald-500">
                {summary?.exchangeRate ?? 0}%
              </div>
              <div className="text-xs theme-text-secondary mt-0.5">
                {summary?.exchangeCount ?? 0} exchanges
              </div>
            </StatCard>
          </div>

          {/* ── TRENDS ── */}
          {(periodData.length > 0 || topReasons.length > 0 || topProducts.length > 0) && (
            <div className="space-y-12">
              <div className="flex items-center gap-3">
                <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                  Trends
                </h2>
                <div className="h-px flex-1 section-divider-line" />
              </div>

              {periodData.length > 0 && (
                <section className={cn('flex flex-col', sectionHover)}>
                  <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-2 flex items-center gap-2">
                    Returns Over Time
                    <InfoTooltip
                      description="Number of returns initiated each period alongside the return rate (returns ÷ orders). Shows whether your operational return volume is rising independently of overall sales."
                      calculationTooltip={{
                        formula: 'Returns ÷ Orders × 100',
                      }}
                    />
                  </p>
                  <div className="flex-1 min-h-[300px]">
                    <ReactECharts
                      option={returnsTrendOption}
                      style={{ width: '100%', height: 300 }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </div>
                </section>
              )}

              <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-16')}>
                {topReasons.length > 0 && (
                  <section
                    className={cn(
                      'flex flex-col @3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
                      isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
                      sectionHover
                    )}
                  >
                    <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-2 flex items-center gap-2">
                      Top Return Reasons
                      <InfoTooltip description="Most common return reasons selected by customers — pulled from the Shopify ReturnReason enum (SIZE_TOO_LARGE, COLOR, DEFECTIVE, NOT_AS_DESCRIBED, etc.)." />
                    </p>
                    <div className="flex-1 min-h-[280px]">
                      <ReactECharts
                        option={reasonsChartOption}
                        style={{ width: '100%', height: 280 }}
                        opts={{ renderer: 'canvas' }}
                      />
                    </div>
                  </section>
                )}

                {statusBuckets.length > 0 && (
                  <section className={cn('flex flex-col', sectionHover)}>
                    <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-2 flex items-center gap-2">
                      Status Breakdown
                      <InfoTooltip description="Returns broken down by their current lifecycle status. The funnel shows how many returns sit in each stage — from initial request through resolution." />
                    </p>
                    <div className="flex-1 min-h-[280px]">
                      <ReactECharts
                        option={statusChartOption}
                        style={{ width: '100%', height: 280 }}
                        opts={{ renderer: 'canvas' }}
                      />
                    </div>
                  </section>
                )}
              </div>

              {topProducts.length > 0 && (
                <section className={cn('flex flex-col', sectionHover)}>
                  <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-2 flex items-center gap-2">
                    Most Returned Products
                    <InfoTooltip description="Products with the highest unit volume coming back through the returns workflow. Pair with the reasons chart to spot quality or sizing issues." />
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
          )}

          {/* ── RETURN DETAILS ── */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                Return Details
              </h2>
              <div className="h-px flex-1 section-divider-line" />
            </div>

            {/* Search */}
            <div className="relative w-full max-w-sm mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-secondary pointer-events-none" />
              <input
                type="text"
                placeholder="Search returns..."
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

            {/* Returns table */}
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
                        onClick={() => handleSort('name')}
                        className="inline-flex items-center gap-1 hover:text-amber-500 transition-colors"
                      >
                        Return <SortIcon col="name" />
                      </button>
                    </th>
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
                        onClick={() => handleSort('customer')}
                        className="inline-flex items-center gap-1 hover:text-amber-500 transition-colors"
                      >
                        Customer <SortIcon col="customer" />
                      </button>
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('status')}
                        className="inline-flex items-center gap-1 hover:text-amber-500 transition-colors"
                      >
                        Status <SortIcon col="status" />
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
                      Reason
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('createdAt')}
                        className="inline-flex items-center gap-1 hover:text-amber-500 transition-colors"
                      >
                        Created <SortIcon col="createdAt" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ret, i) => {
                    const isExpanded = expandedReturn === ret.id
                    // Pick the first reason as the table summary; humanize for display
                    const firstReason = ret.returnLineItems[0]?.returnReason
                    return (
                      <Fragment key={ret.id}>
                        <tr
                          onClick={() => setExpandedReturn(isExpanded ? null : ret.id)}
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
                              {ret.name}
                              {ret.exchangeLineItems.length > 0 && (
                                <ArrowRightLeft
                                  className="w-3 h-3 text-emerald-500 flex-shrink-0"
                                  aria-label="Exchange"
                                />
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 theme-text-secondary">{ret.orderName}</td>
                          <td className="py-2.5 px-3 theme-text-secondary text-xs">
                            {ret.customerName || '-'}
                            {ret.customerEmail && (
                              <div className="text-[10px] text-stone-500">{ret.customerEmail}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusBadge status={ret.status} />
                          </td>
                          <td className="py-2.5 px-3 theme-text-secondary">{ret.totalQuantity}</td>
                          <td className="py-2.5 px-3 theme-text-secondary text-xs">
                            {firstReason ? humanizeReason(firstReason) : '-'}
                            {ret.returnLineItems.length > 1 && (
                              <span className="text-stone-500">
                                {' '}
                                +{ret.returnLineItems.length - 1}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 theme-text-secondary">
                            {formatDate(ret.createdAt)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="p-0 border-none">
                              <ReturnDetailPanel
                                returnItem={ret}
                                isLight={isLight}
                                onClose={() => setExpandedReturn(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center theme-text-secondary">
                        {returns.length === 0 ? 'No returns found.' : 'No matching returns.'}
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
