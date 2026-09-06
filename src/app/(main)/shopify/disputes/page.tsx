'use client'

import { Fragment, useState, useMemo, useEffect } from 'react'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useShopifyDisputes } from '../hooks/useShopifyData'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { PeriodPicker } from '@/app/(main)/bc/components/PeriodPicker'
import { useShopifyDateRange } from '../hooks/useShopifyDateRange'
import type { ShopifyDispute } from '@/lib/providers/shopify/types'
import { DisputeDetailPanel } from './DisputeDetailPanel'
import { ReactECharts } from '@/components/chat/visualizations/shared'
import {
  AlertTriangle,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

function formatCurrency(amount: number | string, currency = 'USD') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function DisputeStatusBadge({ status, isLight }: { status: string; isLight: boolean }) {
  const config: Record<string, { color: string; icon: React.ElementType }> = {
    needs_response: {
      color: cn('text-red-600', isLight ? 'bg-red-50' : 'bg-red-900/20 text-red-400'),
      icon: AlertTriangle,
    },
    under_review: {
      color: cn(isLight ? 'bg-yellow-50 text-yellow-700' : 'bg-yellow-900/20 text-yellow-400'),
      icon: Clock,
    },
    open: {
      color: cn(isLight ? 'bg-yellow-50 text-yellow-700' : 'bg-yellow-900/20 text-yellow-400'),
      icon: Clock,
    },
    won: {
      color: cn(isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-900/20 text-emerald-400'),
      icon: CheckCircle2,
    },
    lost: {
      color: cn(isLight ? 'bg-stone-100 text-stone-600' : 'bg-stone-700/30 text-stone-400'),
      icon: XCircle,
    },
    accepted: {
      color: cn(isLight ? 'bg-stone-100 text-stone-600' : 'bg-stone-700/30 text-stone-400'),
      icon: XCircle,
    },
  }
  const { color, icon: Icon } = config[status] || {
    color: cn(isLight ? 'bg-stone-100 text-stone-600' : 'bg-stone-700/30 text-stone-400'),
    icon: Shield,
  }

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium', color)}>
      <Icon className="w-3 h-3" />
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export default function ShopifyDisputesPage() {
  const {
    selectedPeriod,
    setSelectedPeriod,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    dateRange,
  } = useShopifyDateRange()

  const { connected, isLoading: connLoading } = useShopifyConnection()
  const { data, isLoading, error, mutate } = useShopifyDisputes(connected, dateRange)
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !data)
  }, [isLoading, data, welcomeContext])
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('initiated_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedDispute, setExpandedDispute] = useState<number | null>(null)

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
        <p className="text-sm text-stone-500">
          No Shopify connection found. Please connect via Settings.
        </p>
      </div>
    )
  }

  const disputes = (data as any)?.disputes ?? []
  const summary = (data as any)?.summary
  const cur = summary?.currency ?? 'USD'
  const warning = (data as any)?.warning
  const disputeTrend = (data as any)?.disputeTrend ?? []
  const isDark = theme !== 'light'

  // Chart colors
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const labelColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'

  // Chart 1: Dispute Volume & Amount Trend (dual axis)
  const volumeAmountChartOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? '#1e1e2e' : '#fff',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
    },
    grid: { top: 20, right: 60, bottom: 24, left: 60 },
    xAxis: {
      type: 'category' as const,
      data: disputeTrend.map((d: any) => d.date),
      axisLabel: { color: labelColor, fontSize: 10 },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value' as const,
        axisLabel: {
          color: labelColor,
          fontSize: 10,
          formatter: (v: number) => formatCurrency(v, cur),
        },
        splitLine: { lineStyle: { color: gridColor } },
      },
      {
        type: 'value' as const,
        axisLabel: { color: labelColor, fontSize: 10 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Amount',
        type: 'bar',
        data: disputeTrend.map((d: any) => d.amount),
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
        name: 'Count',
        type: 'line',
        yAxisIndex: 1,
        data: disputeTrend.map((d: any) => d.count),
        smooth: true,
        lineStyle: { color: '#f59e0b', width: 2 },
        itemStyle: { color: '#f59e0b' },
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  }

  // Chart 2: Win/Loss Trend (stacked bar)
  const winLossChartOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? '#1e1e2e' : '#fff',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
    },
    grid: { top: 20, right: 16, bottom: 24, left: 40 },
    xAxis: {
      type: 'category' as const,
      data: disputeTrend.map((d: any) => d.date),
      axisLabel: { color: labelColor, fontSize: 10 },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: labelColor, fontSize: 10 },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: [
      {
        name: 'Won',
        type: 'bar',
        stack: 'outcome',
        data: disputeTrend.map((d: any) => d.won),
        itemStyle: {
          color: '#10b981',
          borderRadius: 0,
        },
        barMaxWidth: 24,
      },
      {
        name: 'Lost',
        type: 'bar',
        stack: 'outcome',
        data: disputeTrend.map((d: any) => d.lost),
        itemStyle: {
          color: '#ef4444',
        },
        barMaxWidth: 24,
      },
    ],
  }

  const filtered = useMemo(() => {
    let items = disputes as ShopifyDispute[]
    if (statusFilter) {
      items = items.filter((d: ShopifyDispute) => d.status === statusFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(
        (d: ShopifyDispute) =>
          String(d.id).toLowerCase().includes(q) ||
          d.status.toLowerCase().includes(q) ||
          d.reason.replace(/_/g, ' ').toLowerCase().includes(q)
      )
    }
    items.sort((a: ShopifyDispute, b: ShopifyDispute) => {
      let aVal: any, bVal: any
      switch (sortKey) {
        case 'id':
          aVal = a.id
          bVal = b.id
          break
        case 'status':
          aVal = a.status
          bVal = b.status
          break
        case 'reason':
          aVal = a.reason
          bVal = b.reason
          break
        case 'initiated_at':
          aVal = a.initiated_at || ''
          bVal = b.initiated_at || ''
          break
        case 'evidence_due_by':
          aVal = a.evidence_due_by || ''
          bVal = b.evidence_due_by || ''
          break
        case 'finalized_on':
          aVal = a.finalized_on || ''
          bVal = b.finalized_on || ''
          break
        case 'amount':
          aVal = parseFloat(String(a.amount)) || 0
          bVal = parseFloat(String(b.amount)) || 0
          break
        default:
          aVal = a.initiated_at || ''
          bVal = b.initiated_at || ''
      }
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal)
        return sortDir === 'asc' ? cmp : -cmp
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return items
  }, [disputes, statusFilter, search, sortKey, sortDir])

  return (
    <div className="@container space-y-6 max-w-[1800px] mx-auto">
      {/* BC-style header */}
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
              Disputes & Chargebacks
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
          <p className="text-sm text-red-500">Failed to load disputes. Please try again.</p>
        </div>
      ) : isLoading && !data ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#7AB55C]" />
        </div>
      ) : (
        <>
          {warning && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">{warning}</p>
            </div>
          )}

          {/* Summary KPIs */}
          <div className="flex flex-wrap gap-3 pt-5 pb-3">
            <div className={cn('flex flex-col gap-1.5 px-5 py-4 min-w-[240px]', isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]')}>
              <div className="text-[12px] uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1">
                Total Disputes
                <InfoTooltip
                  description="Total number of chargebacks and payment disputes filed against your store."
                  calculationTooltip={{
                    formula: 'Total Disputes = Needs Response + Won + Lost + Other',
                    components: [
                      {
                        label: 'Total Disputes',
                        value: summary?.totalDisputes ?? 0,
                        highlight: true,
                      },
                      {
                        label: 'Total Disputed',
                        value: formatCurrency(summary?.totalDisputedAmount ?? 0, cur),
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
                {summary?.totalDisputes}
              </div>
              <div className="text-[11px] text-stone-500 mt-0.5">
                {formatCurrency(summary?.totalDisputedAmount ?? 0, cur)} disputed
              </div>
            </div>
            <div className={cn('flex flex-col gap-1.5 px-5 py-4 min-w-[240px]', isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]')}>
              <div className="text-[12px] uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1">
                Needs Response
                <InfoTooltip description="Disputes currently awaiting your evidence submission. These require action before the evidence deadline." />
              </div>
              <div className="text-[28px] font-mono font-semibold tabular-nums text-red-500">
                {summary?.needsResponse}
              </div>
            </div>
            <div className={cn('flex flex-col gap-1.5 px-5 py-4 min-w-[240px]', isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]')}>
              <div className="text-[12px] uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1">
                Won
                <InfoTooltip description="Disputes resolved in your favor. The disputed funds were returned to you." />
              </div>
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-emerald-600' : 'text-emerald-400'
                )}
              >
                {summary?.wonDisputes}
              </div>
            </div>
            <div className={cn('flex flex-col gap-1.5 px-5 py-4 min-w-[240px]', isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]')}>
              <div className="text-[12px] uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1">
                Lost
                <InfoTooltip description="Disputes resolved against you. The disputed funds were returned to the customer." />
              </div>
              <div className="text-[28px] font-mono font-semibold tabular-nums text-stone-500">
                {summary?.lostDisputes}
              </div>
            </div>
          </div>

          {/* Dispute reasons breakdown */}
          {summary?.disputesByReason?.length > 0 && (
            <div
              className={cn(
                'pt-4 pb-4 border-b',
                isLight ? 'border-stone-200' : 'border-white/[0.08]'
              )}
            >
              <p className="text-[12px] uppercase tracking-wider text-stone-500 mb-3">
                Disputes by Reason
              </p>
              <div className="grid grid-cols-2 @lg:grid-cols-4 gap-3">
                {summary.disputesByReason.map((r: any) => (
                  <div
                    key={r.reason}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-lg',
                      isLight ? 'bg-stone-100/80' : 'bg-white/[0.03]'
                    )}
                  >
                    <span
                      className={cn(
                        'text-sm capitalize',
                        isLight ? 'text-stone-900' : 'text-white'
                      )}
                    >
                      {r.reason.replace(/_/g, ' ')}
                    </span>
                    <div className="text-right">
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        {r.count}
                      </span>
                      <span className="text-xs text-stone-500 ml-1.5">
                        {formatCurrency(r.amount, cur)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trend Charts */}
          {disputeTrend.length > 0 && (
            <div className="grid @xl:grid-cols-2 gap-5">
              <div
                className={cn(
                  'pb-4 border-b',
                  isLight ? 'border-stone-200' : 'border-white/[0.08]'
                )}
              >
                <p className="text-[11px] font-medium theme-text-secondary uppercase tracking-wider mb-3">
                  Dispute Volume &amp; Amount Trend
                </p>
                <ReactECharts
                  option={volumeAmountChartOption}
                  style={{ width: '100%', height: 280 }}
                  opts={{ renderer: 'canvas' }}
                />
              </div>
              <div
                className={cn(
                  'pb-4 border-b',
                  isLight ? 'border-stone-200' : 'border-white/[0.08]'
                )}
              >
                <p className="text-[11px] font-medium theme-text-secondary uppercase tracking-wider mb-3">
                  Win / Loss Trend
                </p>
                <ReactECharts
                  option={winLossChartOption}
                  style={{ width: '100%', height: 280 }}
                  opts={{ renderer: 'canvas' }}
                />
              </div>
            </div>
          )}

          {/* Status filter - BC tab style */}
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors border-b-2',
                !statusFilter
                  ? cn(
                      isLight
                        ? 'text-stone-900 bg-stone-200/80 border-[#7AB55C]'
                        : 'text-white bg-white/[0.08] border-[#7AB55C]'
                    )
                  : cn(
                      'text-stone-500 border-transparent',
                      isLight
                        ? 'hover:bg-stone-200/50 hover:text-stone-700'
                        : 'hover:bg-white/[0.06] hover:text-stone-300'
                    )
              )}
            >
              All
            </button>
            {summary?.disputesByStatus?.map((s: any) => {
              const isActive = statusFilter === s.status
              return (
                <button
                  key={s.status}
                  onClick={() => setStatusFilter(s.status)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors border-b-2',
                    isActive
                      ? cn(
                          isLight
                            ? 'text-stone-900 bg-stone-200/80 border-[#7AB55C]'
                            : 'text-white bg-white/[0.08] border-[#7AB55C]'
                        )
                      : cn(
                          'text-stone-500 border-transparent',
                          isLight
                            ? 'hover:bg-stone-200/50 hover:text-stone-700'
                            : 'hover:bg-white/[0.06] hover:text-stone-300'
                        )
                  )}
                >
                  {s.status.replace(/_/g, ' ')} ({s.count})
                </button>
              )
            })}
          </div>

          {/* Search */}
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search disputes..."
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

          {/* Disputes table - BC style */}
          <div className="overflow-x-auto overflow-y-auto max-h-[900px] scrollbar-thin scrollbar-thumb-stone-300 dark:scrollbar-thumb-stone-700 scrollbar-track-transparent">
            <table className="w-full text-sm">
              <thead className={cn('sticky top-0 z-10', isLight ? 'bg-white' : 'bg-[#0a0a0a]')}>
                <tr
                  className={cn('border-b', isLight ? 'border-stone-200' : 'border-white/[0.08]')}
                >
                  <th className="w-8 px-2 py-3" />
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                    <button
                      onClick={() => handleSort('id')}
                      className="inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      ID <SortIcon col="id" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                    <button
                      onClick={() => handleSort('status')}
                      className="inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Status <SortIcon col="status" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                    <button
                      onClick={() => handleSort('reason')}
                      className="inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Reason <SortIcon col="reason" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                    <button
                      onClick={() => handleSort('initiated_at')}
                      className="inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Initiated <SortIcon col="initiated_at" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                    <button
                      onClick={() => handleSort('evidence_due_by')}
                      className="inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Evidence Due <SortIcon col="evidence_due_by" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                    <button
                      onClick={() => handleSort('finalized_on')}
                      className="inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Finalized <SortIcon col="finalized_on" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                    <button
                      onClick={() => handleSort('amount')}
                      className="inline-flex items-center gap-1 ml-auto hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Amount <SortIcon col="amount" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((dispute: ShopifyDispute, index: number) => (
                  <Fragment key={dispute.id}>
                    <tr
                      onClick={() =>
                        setExpandedDispute(expandedDispute === dispute.id ? null : dispute.id)
                      }
                      className={cn(
                        'transition-colors cursor-pointer',
                        index % 2 === 1 ? (isLight ? 'bg-stone-50' : 'bg-white/[0.02]') : '',
                        isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.04]'
                      )}
                    >
                      <td className="w-8 px-2 py-3 text-stone-400">
                        <ChevronRight
                          className={cn(
                            'w-3.5 h-3.5 transition-transform',
                            expandedDispute === dispute.id && 'rotate-90'
                          )}
                        />
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 font-mono text-xs tabular-nums',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        #{dispute.id}
                      </td>
                      <td className="px-4 py-3">
                        <DisputeStatusBadge status={dispute.status} isLight={isLight} />
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 capitalize',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        {dispute.reason.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-stone-500">
                        {formatDate(dispute.initiated_at)}
                      </td>
                      <td className="px-4 py-3 text-stone-500">
                        {formatDate(dispute.evidence_due_by)}
                      </td>
                      <td className="px-4 py-3 text-stone-500">
                        {formatDate(dispute.finalized_on)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-red-500">
                        {formatCurrency(dispute.amount, dispute.currency)}
                      </td>
                    </tr>
                    {expandedDispute === dispute.id && (
                      <tr key={`${dispute.id}-details`}>
                        <td colSpan={8} className="p-0 border-none">
                          <DisputeDetailPanel
                            disputeId={dispute.id}
                            isLight={isLight}
                            currency={dispute.currency || cur}
                            onClose={() => setExpandedDispute(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-stone-500">
                      {disputes.length === 0
                        ? 'No disputes found -- this is good!'
                        : 'No disputes matching filter.'}
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
