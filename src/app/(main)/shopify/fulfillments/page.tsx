'use client'

import { Fragment, useState, useMemo, useEffect } from 'react'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useShopifyFulfillmentOps } from '../hooks/useShopifyData'
import { PeriodPicker } from '@/app/(main)/bc/components/PeriodPicker'
import { useShopifyDateRange } from '../hooks/useShopifyDateRange'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { ReactECharts, useThemeEChartsConfig } from '@/components/chat/visualizations/shared'
import type {
  ShopifyFulfillmentOrderItem,
  ShopifyFulfillmentOrderStatus,
} from '@/lib/providers/shopify/types'
import {
  RefreshCw,
  Loader2,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Clock,
  Truck,
  Package,
  MapPin,
} from 'lucide-react'
import { InfoTooltip, type InfoTooltipProps } from '@/components/ui/InfoTooltip'
import { InfoTooltipBody } from '@/components/ui/InfoTooltipBody'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FulfillmentDetailPanel } from './FulfillmentDetailPanel'

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

function humanize(str: string): string {
  return str
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function fmtHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${Math.round(hours * 10) / 10}h`
  return `${Math.round((hours / 24) * 10) / 10}d`
}

const STATUS_COLORS: Record<ShopifyFulfillmentOrderStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  ON_HOLD: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  SCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  CLOSED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
  INCOMPLETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const STATUS_CHART_COLORS: Record<ShopifyFulfillmentOrderStatus, string> = {
  OPEN: '#3b82f6',
  IN_PROGRESS: '#6366f1',
  ON_HOLD: '#f59e0b',
  SCHEDULED: '#a855f7',
  CLOSED: '#10b981',
  CANCELLED: '#94a3b8',
  INCOMPLETE: '#ef4444',
}

function StatusBadge({ status }: { status: ShopifyFulfillmentOrderStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 text-xs font-medium uppercase tracking-wider',
        STATUS_COLORS[status]
      )}
    >
      {humanize(status)}
    </span>
  )
}

type StatusFilter = 'all' | ShopifyFulfillmentOrderStatus

export default function ShopifyFulfillmentsPage() {
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

  const [includeClosed, setIncludeClosed] = useState(true)
  const { data, isLoading, error, mutate } = useShopifyFulfillmentOps(connected, dateRange, {
    includeClosed,
  })
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !data)
  }, [isLoading, data, welcomeContext])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
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
  const [expandedFO, setExpandedFO] = useState<string | null>(null)

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
      setSortDir(col === 'orderName' || col === 'status' || col === 'location' ? 'asc' : 'desc')
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

  const fulfillmentOrders = data?.fulfillmentOrders ?? []
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

  // ── Filtering & sorting ──
  const filtered = useMemo(() => {
    let items = fulfillmentOrders.filter((fo: ShopifyFulfillmentOrderItem) => {
      if (statusFilter !== 'all' && fo.status !== statusFilter) return false
      if (!search) return true
      const s = search.toLowerCase()
      return (
        fo.orderName.toLowerCase().includes(s) ||
        (fo.assignedLocation?.toLowerCase().includes(s) ?? false) ||
        fo.lineItems.some(
          (li) => li.productTitle?.toLowerCase().includes(s) || li.sku?.toLowerCase().includes(s)
        )
      )
    })
    items.sort((a: ShopifyFulfillmentOrderItem, b: ShopifyFulfillmentOrderItem) => {
      let aVal: any, bVal: any
      switch (sortKey) {
        case 'orderName':
          aVal = a.orderName
          bVal = b.orderName
          break
        case 'status':
          aVal = a.status
          bVal = b.status
          break
        case 'location':
          aVal = a.assignedLocation || ''
          bVal = b.assignedLocation || ''
          break
        case 'items':
          aVal = a.totalQuantity
          bVal = b.totalQuantity
          break
        case 'processing':
          aVal = a.processingHours ?? 99999
          bVal = b.processingHours ?? 99999
          break
        case 'sla':
          aVal = a.slaHoursRemaining ?? 99999
          bVal = b.slaHoursRemaining ?? 99999
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
  }, [fulfillmentOrders, search, statusFilter, sortKey, sortDir])

  // ── Charts ──
  const trendData = summary?.trend || []
  const manyPoints = trendData.length > 12
  const xAxisRotate = manyPoints ? 45 : 0
  const gridBottom = manyPoints ? 48 : 24

  const pipelineTrendOption = {
    tooltip: {
      trigger: 'axis' as const,
      ...tooltipStyle,
      formatter: (params: any) => {
        const arr = Array.isArray(params) ? params : [params]
        const idx = arr[0]?.dataIndex ?? 0
        const d = trendData[idx]
        if (!d) return ''
        return `<div style="min-width:200px">
          <strong>${formatTrendDate(d.date)}</strong><br/>
          Created: ${d.created}<br/>
          Fulfilled: ${d.fulfilled}<br/>
          On Hold: ${d.onHold}<br/>
          <span style="color:#6366f1">Avg Processing: ${d.avgProcessingHours > 0 ? fmtHours(d.avgProcessingHours) : 'N/A'}</span>
        </div>`
      },
    },
    legend: { textStyle: { ...axisLabelStyle }, top: 0, left: 'center', itemGap: 24 },
    grid: { top: 44, right: 56, bottom: gridBottom, left: 60 },
    xAxis: {
      type: 'category' as const,
      data: trendData.map((d) => formatTrendDate(d.date)),
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
        axisLabel: { ...axisLabelStyle, formatter: (v: number) => fmtHours(v) },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Created',
        type: 'bar',
        stack: 'volume',
        data: trendData.map((d) => d.created),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(99, 102, 241, 0.7)' },
              { offset: 1, color: 'rgba(99, 102, 241, 0.25)' },
            ],
          },
          borderRadius: 0,
        },
        barMaxWidth: 24,
      },
      {
        name: 'On Hold',
        type: 'bar',
        stack: 'volume',
        data: trendData.map((d) => d.onHold),
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
        name: 'Avg Processing',
        type: 'line',
        yAxisIndex: 1,
        data: trendData.map((d) => d.avgProcessingHours),
        smooth: true,
        lineStyle: { color: '#10b981', width: 2 },
        itemStyle: { color: '#10b981' },
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
              { offset: 0, color: 'rgba(16, 185, 129, 0.18)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.02)' },
            ],
          },
        },
      },
    ],
  }

  const statusBreakdown = summary?.statusBreakdown ?? []
  const statusChartOption = {
    tooltip: { trigger: 'axis' as const, ...tooltipStyle },
    grid: { top: 8, right: 16, bottom: 24, left: 60 },
    xAxis: {
      type: 'category' as const,
      data: statusBreakdown.map((b) => humanize(b.status)),
      axisLabel: { ...axisLabelStyle, rotate: statusBreakdown.length > 5 ? 30 : 0 },
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
        data: statusBreakdown.map((b) => ({
          value: b.count,
          itemStyle: {
            color: STATUS_CHART_COLORS[b.status] || '#94a3b8',
          },
        })),
        barMaxWidth: 40,
      },
    ],
  }

  const holdReasons = summary?.holdReasonBreakdown ?? []
  const holdReasonsOption = {
    tooltip: { trigger: 'axis' as const, ...tooltipStyle },
    grid: { top: 8, right: 16, bottom: 4, left: 160 },
    xAxis: {
      type: 'value' as const,
      axisLabel: axisLabelStyle,
      splitLine: { lineStyle: splitLineStyle },
      minInterval: 1,
    },
    yAxis: {
      type: 'category' as const,
      data: holdReasons.map((r) => humanize(r.reason)).reverse(),
      axisLabel: { ...axisLabelStyle, width: 150, overflow: 'truncate' as const },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: holdReasons.map((r) => r.count).reverse(),
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

  const locationData = summary?.locationBreakdown ?? []
  const locationChartOption = {
    tooltip: {
      trigger: 'axis' as const,
      ...tooltipStyle,
      formatter: (params: any) => {
        const arr = Array.isArray(params) ? params : [params]
        const idx = arr[0]?.dataIndex ?? 0
        const loc = locationData[locationData.length - 1 - idx]
        if (!loc) return ''
        return `<div style="min-width:180px">
          <strong>${loc.location}</strong><br/>
          Orders: ${loc.count}<br/>
          Avg Processing: ${loc.avgProcessingHours > 0 ? fmtHours(loc.avgProcessingHours) : 'N/A'}<br/>
          <span style="color:#ef4444">SLA Breaches: ${loc.slaBreachCount}</span>
        </div>`
      },
    },
    grid: { top: 8, right: 16, bottom: 4, left: 140 },
    xAxis: {
      type: 'value' as const,
      axisLabel: axisLabelStyle,
      splitLine: { lineStyle: splitLineStyle },
      minInterval: 1,
    },
    yAxis: {
      type: 'category' as const,
      data: locationData.map((l) => l.location).reverse(),
      axisLabel: { ...axisLabelStyle, width: 130, overflow: 'truncate' as const },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: locationData.map((l) => l.count).reverse(),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(99, 102, 241, 0.4)' },
              { offset: 1, color: 'rgba(99, 102, 241, 0.8)' },
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
              Fulfillment Operations
            </h1>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#7AB55C]/80 mt-2">
              Shopify
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIncludeClosed((v) => !v)}
              className="flex items-center gap-2 text-xs theme-text-secondary cursor-pointer group/toggle"
            >
              <span
                className="relative inline-flex h-[18px] w-[32px] items-center rounded-full transition-colors duration-200"
                style={{
                  backgroundColor: includeClosed
                    ? isLight
                      ? '#6366f1'
                      : '#818cf8'
                    : isLight
                      ? '#d6d3d1'
                      : 'rgba(255,255,255,0.12)',
                }}
              >
                <span
                  className={cn(
                    'inline-block h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform duration-200',
                    includeClosed ? 'translate-x-[16px]' : 'translate-x-[2px]'
                  )}
                />
              </span>
              <span className="group-hover/toggle:theme-text-primary transition-colors">
                Include closed
              </span>
            </button>
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
          <p className="text-sm text-red-500">
            Failed to load fulfillment operations. Please try again.
          </p>
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

          {/* ── KPI Strip ── */}
          <div
            className={cn(
              'grid grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-6 gap-3 pt-5 pb-3'
            )}
          >
            <StatCard
              isLight={isLight}
              label="Open"
              tooltip={{
                description:
                  'Fulfillment orders currently in OPEN or IN_PROGRESS status — your active work queue.',
                calculationTooltip: {
                  formula: 'Count where status in {OPEN, IN_PROGRESS}',
                  components: [
                    {
                      label: 'Open',
                      value: summary?.openCount ?? 0,
                      highlight: true,
                    },
                    { label: 'In Progress', value: summary?.inProgressCount ?? 0 },
                    { label: 'Scheduled', value: summary?.scheduledCount ?? 0 },
                  ],
                },
              }}
            >
              <div className="text-[28px] font-mono font-semibold tabular-nums text-blue-500">
                {(summary?.openCount ?? 0) + (summary?.inProgressCount ?? 0)}
              </div>
              <div className="text-xs theme-text-secondary mt-0.5">
                {summary?.scheduledCount ? `+${summary.scheduledCount} scheduled` : 'active queue'}
              </div>
            </StatCard>

            <StatCard
              isLight={isLight}
              label="On Hold"
              tooltip={{
                description:
                  'Fulfillment orders blocked by a hold — fraud review, OOS, incorrect address, awaiting payment, etc. These cannot proceed until the hold is released.',
                calculationTooltip: {
                  formula: 'Count where status = ON_HOLD',
                  components: [
                    { label: 'On Hold', value: summary?.onHoldCount ?? 0, highlight: true },
                    {
                      label: 'Hold Rate',
                      value: `${summary?.holdRate ?? 0}%`,
                    },
                  ],
                },
              }}
            >
              <div className="text-[28px] font-mono font-semibold tabular-nums text-amber-500">
                {summary?.onHoldCount ?? 0}
              </div>
              <div className="text-xs theme-text-secondary mt-0.5">
                {summary?.holdRate ?? 0}% hold rate
              </div>
            </StatCard>

            <StatCard
              isLight={isLight}
              label="SLA Compliance"
              tooltip={{
                description:
                  'Percentage of fulfillment orders with a fulfillBy deadline that were fulfilled on time. Only counts orders that have an SLA deadline set.',
                calculationTooltip: {
                  formula: 'On-time ÷ Total with SLA × 100',
                  components: [
                    {
                      label: 'Compliance',
                      value: `${summary?.slaComplianceRate ?? 100}%`,
                      highlight: true,
                    },
                    { label: 'Breaches', value: summary?.slaBreachCount ?? 0 },
                  ],
                },
              }}
            >
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  (summary?.slaComplianceRate ?? 100) >= 95
                    ? 'text-green-500'
                    : (summary?.slaComplianceRate ?? 100) >= 80
                      ? 'text-amber-500'
                      : 'text-red-500'
                )}
              >
                {summary?.slaComplianceRate ?? 100}%
              </div>
              <div className="text-xs theme-text-secondary mt-0.5">
                {summary?.slaBreachCount ?? 0} breaches
              </div>
            </StatCard>

            <StatCard
              isLight={isLight}
              label="Avg Processing"
              tooltip={{
                description:
                  'Average time from fulfillment order creation to the first shipment being created. Measures your warehouse-to-ship speed.',
                calculationTooltip: {
                  formula: 'Avg(first fulfillment.createdAt - FO.createdAt)',
                  components: [
                    {
                      label: 'Average',
                      value: fmtHours(summary?.avgProcessingHours ?? 0),
                      highlight: true,
                    },
                    {
                      label: 'Median',
                      value: fmtHours(summary?.medianProcessingHours ?? 0),
                    },
                  ],
                },
              }}
            >
              <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
                {fmtHours(summary?.avgProcessingHours ?? 0)}
              </div>
              <div className="text-xs theme-text-secondary mt-0.5">
                {fmtHours(summary?.medianProcessingHours ?? 0)} median
              </div>
            </StatCard>

            <StatCard
              isLight={isLight}
              label="3PL Rejections"
              tooltip={{
                description:
                  'Rate at which third-party fulfillment services reject fulfillment requests. High rejection rates signal integration or inventory sync issues with your 3PL.',
                calculationTooltip: {
                  formula: 'Rejected ÷ Total submitted × 100',
                  components: [
                    {
                      label: 'Rejection Rate',
                      value: `${summary?.rejectionRate ?? 0}%`,
                      highlight: true,
                    },
                  ],
                },
              }}
            >
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  (summary?.rejectionRate ?? 0) === 0
                    ? 'text-green-500'
                    : (summary?.rejectionRate ?? 0) < 5
                      ? 'text-amber-500'
                      : 'text-red-500'
                )}
              >
                {summary?.rejectionRate ?? 0}%
              </div>
              <div className="text-xs theme-text-secondary mt-0.5">rejection rate</div>
            </StatCard>

            <StatCard
              isLight={isLight}
              label="Completed"
              tooltip={{
                description:
                  'Total fulfillment orders that have been closed (successfully fulfilled) in the period.',
                calculationTooltip: {
                  formula: 'Count where status = CLOSED',
                  components: [
                    { label: 'Closed', value: summary?.closedCount ?? 0, highlight: true },
                    { label: 'Cancelled', value: summary?.cancelledCount ?? 0 },
                    { label: 'Incomplete', value: summary?.incompleteCount ?? 0 },
                  ],
                },
              }}
            >
              <div className="text-[28px] font-mono font-semibold tabular-nums text-green-500">
                {summary?.closedCount ?? 0}
              </div>
              <div className="text-xs theme-text-secondary mt-0.5">
                of {summary?.totalFulfillmentOrders ?? 0} total
              </div>
            </StatCard>
          </div>

          {/* ── TRENDS ── */}
          {(trendData.length > 0 ||
            statusBreakdown.length > 0 ||
            holdReasons.length > 0 ||
            locationData.length > 0) && (
            <div className="space-y-12">
              <div className="flex items-center gap-3">
                <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                  Operations
                </h2>
                <div className="h-px flex-1 section-divider-line" />
              </div>

              {trendData.length > 0 && (
                <section className={cn('flex flex-col', sectionHover)}>
                  <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-2 flex items-center gap-2">
                    Fulfillment Volume & Speed
                    <InfoTooltip
                      description="Fulfillment orders created each period with average processing time overlay. Shows whether your fulfillment capacity is keeping up with order volume."
                      calculationTooltip={{
                        formula: 'Created + On Hold (stacked bar) with avg processing time (line)',
                      }}
                    />
                  </p>
                  <div className="flex-1 min-h-[300px]">
                    <ReactECharts
                      option={pipelineTrendOption}
                      style={{ width: '100%', height: 300 }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </div>
                </section>
              )}

              <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-16')}>
                {statusBreakdown.length > 0 && (
                  <section
                    className={cn(
                      'flex flex-col @3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
                      isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
                      sectionHover
                    )}
                  >
                    <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-2 flex items-center gap-2">
                      Pipeline Status
                      <InfoTooltip description="Current distribution of fulfillment orders across lifecycle stages. The pipeline shows bottlenecks — large ON_HOLD or OPEN counts mean orders are stuck." />
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

                {holdReasons.length > 0 && (
                  <section className={cn('flex flex-col', sectionHover)}>
                    <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-2 flex items-center gap-2">
                      Hold Reasons
                      <InfoTooltip description="Why fulfillment orders are being held. Common reasons include fraud review, out-of-stock inventory, incorrect addresses, and awaiting payment. Address the top reasons to unblock your pipeline." />
                    </p>
                    <div className="flex-1 min-h-[280px]">
                      <ReactECharts
                        option={holdReasonsOption}
                        style={{ width: '100%', height: 280 }}
                        opts={{ renderer: 'canvas' }}
                      />
                    </div>
                  </section>
                )}
              </div>

              {locationData.length > 1 && (
                <section className={cn('flex flex-col', sectionHover)}>
                  <p className="text-base font-normal uppercase tracking-wider theme-text-primary mb-2 flex items-center gap-2">
                    By Location
                    <InfoTooltip description="Fulfillment order volume per assigned warehouse/location. Hover for processing time and SLA breach count per location." />
                  </p>
                  <div className="flex-1 min-h-[280px]">
                    <ReactECharts
                      option={locationChartOption}
                      style={{ width: '100%', height: Math.max(200, locationData.length * 36) }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ── FULFILLMENT ORDER TABLE ── */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
                Fulfillment Orders
              </h2>
              <div className="h-px flex-1 section-divider-line" />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-6 flex-wrap">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-secondary pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search orders, products, SKUs..."
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
              <div className="flex items-center gap-1.5">
                {(
                  ['all', 'OPEN', 'IN_PROGRESS', 'ON_HOLD', 'SCHEDULED', 'CLOSED'] as StatusFilter[]
                ).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'px-2 py-1 text-[11px] font-medium uppercase tracking-wider rounded-[3px] transition-colors',
                      statusFilter === s
                        ? isLight
                          ? 'bg-stone-800 text-white'
                          : 'bg-white/20 text-white'
                        : isLight
                          ? 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                          : 'bg-white/[0.04] text-stone-500 hover:bg-white/[0.08]'
                    )}
                  >
                    {s === 'all' ? 'All' : humanize(s)}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
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
                        onClick={() => handleSort('status')}
                        className="inline-flex items-center gap-1 hover:text-amber-500 transition-colors"
                      >
                        Status <SortIcon col="status" />
                      </button>
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('location')}
                        className="inline-flex items-center gap-1 hover:text-amber-500 transition-colors"
                      >
                        Location <SortIcon col="location" />
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
                      <button
                        onClick={() => handleSort('processing')}
                        className="inline-flex items-center gap-1 hover:text-amber-500 transition-colors"
                      >
                        Processing <SortIcon col="processing" />
                      </button>
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('sla')}
                        className="inline-flex items-center gap-1 hover:text-amber-500 transition-colors"
                      >
                        SLA <SortIcon col="sla" />
                      </button>
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
                  {filtered.map((fo, i) => {
                    const isExpanded = expandedFO === fo.id
                    return (
                      <Fragment key={fo.id}>
                        <tr
                          onClick={() => setExpandedFO(isExpanded ? null : fo.id)}
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
                              {fo.orderName}
                              {fo.holds.length > 0 && (
                                <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                              )}
                              {fo.slaBreach && (
                                <Clock className="w-3 h-3 text-red-500 flex-shrink-0" />
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusBadge status={fo.status} />
                          </td>
                          <td className="py-2.5 px-3 theme-text-secondary text-xs">
                            {fo.assignedLocation || '-'}
                          </td>
                          <td className="py-2.5 px-3 theme-text-secondary">{fo.totalQuantity}</td>
                          <td className="py-2.5 px-3 theme-text-secondary">
                            {fo.processingHours !== null ? (
                              <span className="font-mono">{fmtHours(fo.processingHours)}</span>
                            ) : (
                              <span className="text-stone-400">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {fo.fulfillBy ? (
                              <span
                                className={cn(
                                  'font-mono text-xs',
                                  fo.slaBreach
                                    ? 'text-red-500'
                                    : fo.slaHoursRemaining !== null && fo.slaHoursRemaining < 24
                                      ? 'text-amber-500'
                                      : 'theme-text-secondary'
                                )}
                              >
                                {fo.slaBreach
                                  ? 'Breached'
                                  : fo.slaHoursRemaining !== null
                                    ? `${Math.round(fo.slaHoursRemaining)}h left`
                                    : formatDate(fo.fulfillBy)}
                              </span>
                            ) : (
                              <span className="text-stone-400 text-xs">No SLA</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 theme-text-secondary">
                            {formatDate(fo.createdAt)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="p-0 border-none">
                              <FulfillmentDetailPanel
                                item={fo}
                                isLight={isLight}
                                onClose={() => setExpandedFO(null)}
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
                        {fulfillmentOrders.length === 0
                          ? 'No fulfillment orders found.'
                          : 'No matching fulfillment orders.'}
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
