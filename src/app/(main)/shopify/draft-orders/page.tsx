'use client'

import { useState, useMemo, Fragment, useEffect } from 'react'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useShopifyDraftOrders } from '../hooks/useShopifyData'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PeriodPicker } from '@/app/(main)/bc/components/PeriodPicker'
import { useShopifyDateRange } from '../hooks/useShopifyDateRange'
import type { ShopifyDraftOrder } from '@/lib/providers/shopify/types'
import { DraftOrderDetailPanel } from './DraftOrderDetailPanel'
import { ReactECharts } from '@/components/chat/visualizations/shared'
import {
  FileEdit,
  Send,
  CheckCircle2,
  DollarSign,
  Loader2,
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Building2,
  Clock,
} from 'lucide-react'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

function formatCurrency(amount: number | string, currency = 'USD') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function DraftStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: React.ElementType }> = {
    open: {
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      icon: FileEdit,
    },
    invoice_sent: {
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      icon: Send,
    },
    completed: {
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      icon: CheckCircle2,
    },
  }
  const { color, icon: Icon } = config[status] || {
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
    icon: FileEdit,
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {status.replace(/_/g, ' ')}
    </span>
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

function DraftOrdersSkeleton({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-12">
      {/* KPI strip skeleton */}
      <div
        className={cn(
          'flex flex-wrap justify-start gap-x-10 gap-y-4 pt-5 pb-3 border-b',
          isLight ? 'border-stone-200' : 'border-white/[0.08]'
        )}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <ShimmerBlock className="h-3 w-20" isLight={isLight} />
            <ShimmerBlock className="h-8 w-28" isLight={isLight} />
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid @xl:grid-cols-2 gap-x-10 gap-y-16">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <ShimmerBlock className="h-4 w-48" isLight={isLight} />
            <ShimmerBlock className="h-[280px] w-full" isLight={isLight} />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="space-y-4">
        <ShimmerBlock className="h-4 w-32" isLight={isLight} />
        <div className="flex gap-3">
          <ShimmerBlock className="h-9 w-full max-w-sm" isLight={isLight} />
          <ShimmerBlock className="h-9 w-[160px]" isLight={isLight} />
        </div>
        <div className="space-y-0">
          <ShimmerBlock className="h-10 w-full rounded-none" isLight={isLight} />
          {Array.from({ length: 6 }).map((_, i) => (
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
    </div>
  )
}

export default function ShopifyDraftOrdersPage() {
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

  const { data, isLoading, error, mutate } = useShopifyDraftOrders(connected, dateRange)
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !data)
  }, [isLoading, data, welcomeContext])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const isDark = theme !== 'light'
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedDraft, setExpandedDraft] = useState<number | null>(null)

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

  const draftOrders = data?.draftOrders ?? []
  const summary = data?.summary
  const cur = summary?.currency ?? 'USD'
  const draftTrend = data?.draftTrend ?? []

  const filtered = useMemo(() => {
    let items = draftOrders.filter((d: ShopifyDraftOrder) => {
      const matchesSearch =
        !search ||
        d.name?.toLowerCase().includes(search.toLowerCase()) ||
        d.email?.toLowerCase().includes(search.toLowerCase()) ||
        `${d.customer?.first_name ?? ''} ${d.customer?.last_name ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase())
      const matchesStatus = !statusFilter || statusFilter === 'all' || d.status === statusFilter
      return matchesSearch && matchesStatus
    })
    items.sort((a: ShopifyDraftOrder, b: ShopifyDraftOrder) => {
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
        case 'customer': {
          aVal = a.customer
            ? `${a.customer.first_name || ''} ${a.customer.last_name || ''}`.trim()
            : a.email || ''
          bVal = b.customer
            ? `${b.customer.first_name || ''} ${b.customer.last_name || ''}`.trim()
            : b.email || ''
          break
        }
        case 'status':
          aVal = a.status
          bVal = b.status
          break
        case 'items':
          aVal = a.line_items?.length || 0
          bVal = b.line_items?.length || 0
          break
        case 'total_price':
          aVal = parseFloat(String(a.total_price)) || 0
          bVal = parseFloat(String(b.total_price)) || 0
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
  }, [draftOrders, search, statusFilter, sortKey, sortDir])

  return (
    <div className="@container space-y-12 max-w-[1800px] mx-auto">
      {/* BC-style header */}
      <div className={cn('mb-10 pt-2 pb-4')}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[36px] font-light theme-text-primary tracking-tight">
              Draft Orders
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
          <p className="text-sm text-red-500">Failed to load draft orders. Please try again.</p>
        </div>
      ) : isLoading && !data ? (
        <DraftOrdersSkeleton isLight={isLight} />
      ) : (
        <>
          {/* Summary KPI strip */}
          <div
            className={cn(
              'flex flex-wrap justify-start gap-x-10 gap-y-4 pt-5 pb-3 border-b',
              isLight ? 'border-stone-200' : 'border-white/[0.08]'
            )}
          >
            <div>
              <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1 flex items-center gap-1">
                Total Drafts
                <InfoTooltip description="Total number of draft orders created during the selected period, across all statuses (open, invoice sent, completed)." />
              </div>
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {summary?.totalDrafts}
              </div>
            </div>
            <div>
              <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1 flex items-center gap-1">
                Pipeline Value
                <InfoTooltip
                  description="Total monetary value of all draft orders. Represents potential revenue if all drafts convert to paid orders."
                  calculationTooltip={{
                    formula: 'Pipeline Value = Sum of all draft order totals',
                    components: [
                      {
                        label: 'Total Value',
                        value: formatCurrency(summary?.totalValue ?? 0, cur),
                        highlight: true,
                      },
                      {
                        label: 'Avg per Draft',
                        value: formatCurrency(summary?.avgValue ?? 0, cur),
                      },
                      { label: 'Total Drafts', value: summary?.totalDrafts ?? 0 },
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
                {formatCurrency(summary?.totalValue ?? 0, cur)}
              </div>
              <div className="text-[11px] text-stone-500 mt-0.5">
                Avg {formatCurrency(summary?.avgValue ?? 0, cur)}
              </div>
            </div>
            <div>
              <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1 flex items-center gap-1">
                Open
                <InfoTooltip description="Draft orders that are still being edited and have not yet been sent to the customer." />
              </div>
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-amber-600' : 'text-amber-400'
                )}
              >
                {summary?.openCount}
              </div>
            </div>
            <div>
              <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1 flex items-center gap-1">
                Invoice Sent
                <InfoTooltip description="Draft orders where an invoice has been emailed to the customer and is awaiting payment." />
              </div>
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-blue-600' : 'text-blue-400'
                )}
              >
                {summary?.invoiceSentCount}
              </div>
            </div>
            {(summary?.b2bCount ?? 0) > 0 && (
              <div className="">
                <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1 flex items-center gap-1">
                  B2B Orders
                  <InfoTooltip description="Draft orders placed by a B2B purchasing company (via purchasingEntity). These have a company buyer rather than a direct consumer." />
                </div>
                <div
                  className={cn(
                    'text-[28px] font-mono font-semibold tabular-nums',
                    isLight ? 'text-indigo-600' : 'text-indigo-400'
                  )}
                >
                  {summary?.b2bCount}
                </div>
              </div>
            )}
            {(summary?.paymentTermsCount ?? 0) > 0 && (
              <div className="">
                <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1 flex items-center gap-1">
                  Net Terms
                  <InfoTooltip
                    description="Draft orders with payment terms set (e.g. Net 30, Net 60). These allow the buyer to pay after receiving goods."
                    calculationTooltip={
                      summary?.paymentTermsBreakdown?.length
                        ? {
                            formula: 'Drafts with paymentTerms set',
                            components: summary.paymentTermsBreakdown.map((t) => ({
                              label: t.name,
                              value: t.count,
                            })),
                          }
                        : undefined
                    }
                  />
                </div>
                <div
                  className={cn(
                    'text-[28px] font-mono font-semibold tabular-nums',
                    isLight ? 'text-purple-600' : 'text-purple-400'
                  )}
                >
                  {summary?.paymentTermsCount}
                </div>
              </div>
            )}
            <div className="">
              <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1 flex items-center gap-1">
                Total Units
                <InfoTooltip description="Total line-item quantity across all draft orders. Uses Shopify's totalQuantityOfLineItems field for accuracy." />
              </div>
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {summary?.totalLineItemQty ?? 0}
              </div>
            </div>
          </div>

          {/* Historical Trend Charts */}
          {draftTrend.length > 0 &&
            (() => {
              const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
              const labelColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'
              const tooltipStyle = {
                trigger: 'axis' as const,
                backgroundColor: isDark ? '#1e1e2e' : '#fff',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
              }

              return (
                <div
                  className={cn(
                    'grid @xl:grid-cols-2 gap-x-10 gap-y-16',
                    isLight
                      ? '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-stone-200 @xl:[&>*:nth-child(odd)]:pr-10'
                      : '@xl:[&>*:nth-child(odd)]:border-r @xl:[&>*:nth-child(odd)]:border-white/[0.08] @xl:[&>*:nth-child(odd)]:pr-10'
                  )}
                >
                  {/* Chart 1: Draft Orders Over Time */}
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
                        Draft Orders Over Time
                        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                      </span>
                    </div>
                    <ReactECharts
                      option={{
                        tooltip: tooltipStyle,
                        grid: { top: 20, right: 60, bottom: 24, left: 60 },
                        xAxis: {
                          type: 'category',
                          data: draftTrend.map((d: any) => d.date),
                          axisLine: { lineStyle: { color: gridColor } },
                          axisLabel: { color: labelColor, fontSize: 11 },
                        },
                        yAxis: [
                          {
                            type: 'value',
                            axisLabel: { color: labelColor, fontSize: 11 },
                            splitLine: { lineStyle: { color: gridColor } },
                          },
                          {
                            type: 'value',
                            axisLabel: {
                              color: labelColor,
                              fontSize: 11,
                              formatter: (v: number) => formatCurrency(v, cur),
                            },
                            splitLine: { show: false },
                          },
                        ],
                        series: [
                          {
                            name: 'Created',
                            type: 'bar',
                            data: draftTrend.map((d: any) => d.created),
                            barMaxWidth: 24,
                            itemStyle: {
                              borderRadius: 0,
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
                            },
                          },
                          {
                            name: 'Total Value',
                            type: 'line',
                            yAxisIndex: 1,
                            smooth: true,
                            data: draftTrend.map((d: any) => d.totalValue),
                            itemStyle: { color: '#3b82f6' },
                            lineStyle: { color: '#3b82f6' },
                            symbolSize: 6,
                          },
                        ],
                      }}
                      style={{ width: '100%', height: 280 }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </section>

                  {/* Chart 2: Conversion Trend */}
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
                        Conversion Trend
                        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                      </span>
                    </div>
                    <ReactECharts
                      option={{
                        tooltip: tooltipStyle,
                        grid: { top: 20, right: 16, bottom: 24, left: 40 },
                        xAxis: {
                          type: 'category',
                          data: draftTrend.map((d: any) => d.date),
                          axisLine: { lineStyle: { color: gridColor } },
                          axisLabel: { color: labelColor, fontSize: 11 },
                        },
                        yAxis: {
                          type: 'value',
                          axisLabel: { color: labelColor, fontSize: 11 },
                          splitLine: { lineStyle: { color: gridColor } },
                        },
                        series: [
                          {
                            name: 'Created',
                            type: 'bar',
                            data: draftTrend.map((d: any) => d.created),
                            barMaxWidth: 10,
                            itemStyle: { color: 'rgba(245, 158, 11, 0.7)' },
                          },
                          {
                            name: 'Completed',
                            type: 'bar',
                            data: draftTrend.map((d: any) => d.completed),
                            barMaxWidth: 10,
                            itemStyle: { color: 'rgba(16, 185, 129, 0.7)' },
                          },
                        ],
                      }}
                      style={{ width: '100%', height: 280 }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </section>
                </div>
              )
            })()}

          {/* Draft Orders List */}
          <div>
            <div className="mb-4">
              <span className="text-base font-normal uppercase tracking-wider theme-text-primary">
                Draft Orders
              </span>
            </div>
            <div className="flex gap-3 mb-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search drafts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn(
                    'w-full h-9 pl-9 pr-3 rounded-lg text-sm focus:outline-none transition-colors',
                    'border bg-transparent',
                    isLight
                      ? 'border-stone-200 text-stone-900 placeholder:text-stone-400 focus:border-amber-500/40'
                      : 'border-white/[0.08] text-white placeholder:text-stone-500 focus:border-amber-500/40'
                  )}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger
                  className={cn(
                    'w-[160px] h-9 text-sm border',
                    isLight ? 'border-stone-200' : 'border-white/[0.08]'
                  )}
                >
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent className="glass-luxury-card">
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="invoice_sent">Invoice Sent</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-[900px] scrollbar-thin scrollbar-thumb-stone-300 dark:scrollbar-thumb-stone-700 scrollbar-track-transparent">
              <table className="w-full text-sm">
                <thead className={cn('sticky top-0 z-10', isLight ? 'bg-white' : 'bg-[#0a0a0a]')}>
                  <tr
                    className={cn('border-b', isLight ? 'border-stone-200' : 'border-white/[0.08]')}
                  >
                    <th className="text-left px-4 py-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('name')}
                        className="inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                      >
                        Draft <SortIcon col="name" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('created_at')}
                        className="inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                      >
                        Date <SortIcon col="created_at" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('customer')}
                        className="inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                      >
                        Customer <SortIcon col="customer" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('status')}
                        className="inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                      >
                        Status <SortIcon col="status" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      Type
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      Terms
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('items')}
                        className="inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                      >
                        Qty <SortIcon col="items" />
                      </button>
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('total_price')}
                        className="inline-flex items-center gap-1 ml-auto hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                      >
                        Total <SortIcon col="total_price" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((draft: ShopifyDraftOrder, i: number) => (
                    <Fragment key={draft.id}>
                      <tr
                        onClick={() =>
                          setExpandedDraft(expandedDraft === draft.id ? null : draft.id)
                        }
                        className={cn(
                          'transition-colors cursor-pointer',
                          i % 2 === 1 ? (isLight ? 'bg-stone-200/50' : 'bg-white/[0.08]') : '',
                          isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.04]'
                        )}
                      >
                        <td
                          className={cn(
                            'px-4 py-3 font-medium',
                            isLight ? 'text-stone-900' : 'text-white'
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <ChevronRight
                              className={cn(
                                'w-3.5 h-3.5 text-stone-400 transition-transform',
                                expandedDraft === draft.id && 'rotate-90'
                              )}
                            />
                            {draft.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-stone-500">{formatDate(draft.created_at)}</td>
                        <td className={cn('px-4 py-3', isLight ? 'text-stone-900' : 'text-white')}>
                          {draft.customer
                            ? `${draft.customer.first_name || ''} ${draft.customer.last_name || ''}`.trim()
                            : draft.email || 'No customer'}
                        </td>
                        <td className="px-4 py-3">
                          <DraftStatusBadge status={draft.status} />
                        </td>
                        <td className="px-4 py-3">
                          {draft.isB2B ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                              <Building2 className="w-2.5 h-2.5" /> B2B
                            </span>
                          ) : (
                            <span className="text-xs text-stone-400">DTC</span>
                          )}
                          {draft.poNumber && (
                            <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                              PO: {draft.poNumber}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs theme-text-secondary">
                          {draft.paymentTerms ? (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 flex-shrink-0" />
                              <span>{draft.paymentTerms.paymentTermsName}</span>
                              {draft.paymentTerms.overdue && (
                                <span className="text-red-500 font-medium ml-1">Overdue</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-stone-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-500 font-mono tabular-nums">
                          {draft.totalQuantityOfLineItems ?? draft.line_items?.length ?? 0}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3 text-right font-medium font-mono tabular-nums',
                            isLight ? 'text-stone-900' : 'text-white'
                          )}
                        >
                          {formatCurrency(draft.total_price, draft.currency)}
                        </td>
                      </tr>
                      {expandedDraft === draft.id && (
                        <tr key={`${draft.id}-details`}>
                          <td colSpan={8} className="p-0 border-none">
                            <DraftOrderDetailPanel
                              draftOrderId={draft.id}
                              isLight={isLight}
                              onClose={() => setExpandedDraft(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-stone-500">
                        No draft orders found.
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
