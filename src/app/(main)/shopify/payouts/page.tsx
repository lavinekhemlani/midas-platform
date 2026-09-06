'use client'

import { useState, useMemo, useEffect } from 'react'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useShopifyPayouts } from '../hooks/useShopifyData'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { PeriodPicker } from '@/app/(main)/bc/components/PeriodPicker'
import { useShopifyDateRange } from '../hooks/useShopifyDateRange'
import type { ShopifyPayout, ShopifyPayoutStatus } from '@/lib/providers/shopify/types'
import { ReactECharts } from '@/components/chat/visualizations/shared'
import {
  Banknote,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
  Truck,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

function formatCurrency(amount: number | string, currency = 'USD') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    Number.isFinite(num) ? num : 0
  )
}

function formatCurrencyCompact(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const STATUS_LABEL: Record<ShopifyPayoutStatus, string> = {
  scheduled: 'scheduled',
  in_transit: 'in transit',
  paid: 'paid',
  failed: 'failed',
  canceled: 'canceled',
}

function PayoutStatusBadge({
  status,
  isLight,
}: {
  status: ShopifyPayoutStatus | string
  isLight: boolean
}) {
  const config: Record<string, { color: string; icon: React.ElementType }> = {
    paid: {
      color: cn(isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-900/20 text-emerald-400'),
      icon: CheckCircle2,
    },
    in_transit: {
      color: cn(isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-900/20 text-blue-400'),
      icon: Truck,
    },
    scheduled: {
      color: cn(isLight ? 'bg-yellow-50 text-yellow-700' : 'bg-yellow-900/20 text-yellow-400'),
      icon: Clock,
    },
    failed: {
      color: cn(isLight ? 'bg-red-50 text-red-700' : 'bg-red-900/20 text-red-400'),
      icon: AlertCircle,
    },
    canceled: {
      color: cn(isLight ? 'bg-stone-100 text-stone-600' : 'bg-stone-700/30 text-stone-400'),
      icon: XCircle,
    },
  }
  const { color, icon: Icon } = config[status] || {
    color: cn(isLight ? 'bg-stone-100 text-stone-600' : 'bg-stone-700/30 text-stone-400'),
    icon: Banknote,
  }
  const label = STATUS_LABEL[status as ShopifyPayoutStatus] ?? String(status).replace(/_/g, ' ')
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium', color)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

export default function ShopifyPayoutsPage() {
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
  const { data, isLoading, error, mutate } = useShopifyPayouts(connected, dateRange)
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !data)
  }, [isLoading, data, welcomeContext])
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const isDark = !isLight

  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('date')
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
      setSortDir(col === 'status' ? 'asc' : 'desc')
    }
  }

  const payouts: ShopifyPayout[] = (data as any)?.payouts ?? []
  const summary = (data as any)?.summary
  const cur = summary?.currency ?? 'USD'
  const warning = (data as any)?.warning
  const payoutTrend: any[] = (data as any)?.payoutTrend ?? []

  // Sorted + filtered table data
  const filtered = useMemo(() => {
    let items = payouts.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!String(p.id).includes(q) && !p.status.toLowerCase().includes(q)) return false
      }
      return true
    })
    items = [...items].sort((a, b) => {
      let aVal: number | string
      let bVal: number | string
      switch (sortKey) {
        case 'id':
          aVal = a.id
          bVal = b.id
          break
        case 'status':
          aVal = a.status
          bVal = b.status
          break
        case 'amount':
          aVal = parseFloat(a.amount || '0') || 0
          bVal = parseFloat(b.amount || '0') || 0
          break
        case 'charges':
          aVal = parseFloat(a.summary?.charges_gross_amount || '0') || 0
          bVal = parseFloat(b.summary?.charges_gross_amount || '0') || 0
          break
        case 'refunds':
          aVal = parseFloat(a.summary?.refunds_gross_amount || '0') || 0
          bVal = parseFloat(b.summary?.refunds_gross_amount || '0') || 0
          break
        case 'fees': {
          const sumFees = (p: ShopifyPayout) =>
            (parseFloat(p.summary?.charges_fee_amount || '0') || 0) +
            (parseFloat(p.summary?.refunds_fee_amount || '0') || 0) +
            (parseFloat(p.summary?.adjustments_fee_amount || '0') || 0)
          aVal = sumFees(a)
          bVal = sumFees(b)
          break
        }
        case 'date':
        default:
          aVal = a.date || ''
          bVal = b.date || ''
      }
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(String(bVal))
        return sortDir === 'asc' ? cmp : -cmp
      }
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
    return items
  }, [payouts, statusFilter, search, sortKey, sortDir])

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

  // ─── Chart options ──────────────────────────────────────
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const labelColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'
  const tooltipBg = isDark ? '#1e1e2e' : '#fff'
  const tooltipText = isDark ? '#e0e0e0' : '#333'

  // Chart 1: Payout amount + count trend (dual axis)
  const trendChartOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: tooltipBg,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: tooltipText, fontSize: 12 },
      valueFormatter: (v: any) =>
        typeof v === 'number' && v >= 100 ? formatCurrency(v, cur) : String(v),
    },
    legend: {
      data: ['Net Payout', 'Count'],
      textStyle: { color: labelColor, fontSize: 11 },
      top: 0,
    },
    grid: { top: 30, right: 60, bottom: 24, left: 60 },
    xAxis: {
      type: 'category' as const,
      data: payoutTrend.map((d) => d.date),
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
          formatter: (v: number) => formatCurrencyCompact(v, cur),
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
        name: 'Net Payout',
        type: 'bar',
        data: payoutTrend.map((d) => d.amount),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(122, 181, 92, 0.85)' },
              { offset: 1, color: 'rgba(122, 181, 92, 0.35)' },
            ],
          },
        },
      },
      {
        name: 'Count',
        type: 'line',
        yAxisIndex: 1,
        data: payoutTrend.map((d) => d.count),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#f59e0b', width: 2 },
        itemStyle: { color: '#f59e0b' },
      },
    ],
  }

  // Chart 2: Payout composition (stacked bar — what flowed into each payout)
  const compositionChartOption = {
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      backgroundColor: tooltipBg,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: tooltipText, fontSize: 12 },
      valueFormatter: (v: any) => formatCurrency(Number(v) || 0, cur),
    },
    legend: {
      data: ['Charges', 'Refunds', 'Adjustments', 'Reserves', 'Fees'],
      textStyle: { color: labelColor, fontSize: 11 },
      top: 0,
    },
    grid: { top: 30, right: 20, bottom: 24, left: 60 },
    xAxis: {
      type: 'category' as const,
      data: payoutTrend.map((d) => d.date),
      axisLabel: { color: labelColor, fontSize: 10 },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: {
        color: labelColor,
        fontSize: 10,
        formatter: (v: number) => formatCurrencyCompact(v, cur),
      },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: [
      {
        name: 'Charges',
        type: 'bar',
        stack: 'composition',
        data: payoutTrend.map((d) => d.chargesGross),
        itemStyle: { color: '#7AB55C' },
      },
      {
        name: 'Refunds',
        type: 'bar',
        stack: 'composition',
        data: payoutTrend.map((d) => -Math.abs(d.refundsGross || 0)),
        itemStyle: { color: '#ef4444' },
      },
      {
        name: 'Adjustments',
        type: 'bar',
        stack: 'composition',
        data: payoutTrend.map((d) => d.adjustmentsGross),
        itemStyle: { color: '#f59e0b' },
      },
      {
        name: 'Reserves',
        type: 'bar',
        stack: 'composition',
        data: payoutTrend.map((d) => d.reservedFundsGross),
        itemStyle: { color: '#a78bfa' },
      },
      {
        name: 'Fees',
        type: 'bar',
        stack: 'composition',
        data: payoutTrend.map((d) => -Math.abs(d.fees || 0)),
        itemStyle: { color: '#6b7280' },
      },
    ],
  }

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
              Payouts &amp; Cash Flow
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
          <p className="text-sm text-red-500">Failed to load payouts. Please try again.</p>
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

          {/* Upcoming payout banner */}
          {summary?.upcomingPayout && (
            <div
              className={cn(
                'flex items-center justify-between gap-4 p-4 rounded-lg border',
                isLight ? 'bg-blue-50/60 border-blue-200' : 'bg-blue-500/[0.06] border-blue-500/20'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full',
                    isLight ? 'bg-blue-100' : 'bg-blue-500/20'
                  )}
                >
                  <Truck className={cn('w-5 h-5', isLight ? 'text-blue-700' : 'text-blue-300')} />
                </div>
                <div>
                  <p
                    className={cn(
                      'text-[11px] font-semibold uppercase tracking-wider',
                      isLight ? 'text-blue-700' : 'text-blue-300'
                    )}
                  >
                    Upcoming payout ·{' '}
                    {STATUS_LABEL[summary.upcomingPayout.status as ShopifyPayoutStatus] ??
                      summary.upcomingPayout.status}
                  </p>
                  <p className={cn('text-sm', isLight ? 'text-stone-700' : 'text-stone-300')}>
                    Expected {formatDate(summary.upcomingPayout.date)} · #
                    {summary.upcomingPayout.id}
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  'text-2xl font-mono font-semibold tabular-nums',
                  isLight ? 'text-blue-900' : 'text-blue-200'
                )}
              >
                {formatCurrency(summary.upcomingPayout.amount, cur)}
              </div>
            </div>
          )}

          {/* Summary KPIs */}
          <div className="flex flex-wrap gap-3 pt-2 pb-3">
            <div
              className={cn(
                'flex flex-col gap-1.5 px-5 py-4 min-w-[240px]',
                isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]'
              )}
            >
              <div className="text-[12px] uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1">
                Net Payouts
                <InfoTooltip
                  description="Total net amount paid out (or scheduled) to your bank account in the selected period. This is the cash that actually moves to you."
                  calculationTooltip={{
                    formula: 'Σ payout.amount across all payouts in the period',
                    components: [
                      {
                        label: 'Net Payouts',
                        value: formatCurrency(summary?.totalAmount ?? 0, cur),
                        highlight: true,
                      },
                      { label: 'Payouts count', value: String(summary?.totalCount ?? 0) },
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
                {formatCurrency(summary?.totalAmount ?? 0, cur)}
              </div>
              <div className="text-[11px] text-stone-500 mt-0.5">
                {summary?.totalCount ?? 0} payouts
              </div>
            </div>

            <div
              className={cn(
                'flex flex-col gap-1.5 px-5 py-4 min-w-[240px]',
                isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]'
              )}
            >
              <div className="text-[12px] uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1">
                Paid
                <InfoTooltip description="Total of payouts that have already been deposited in your bank account." />
              </div>
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-emerald-600' : 'text-emerald-400'
                )}
              >
                {formatCurrency(summary?.paidAmount ?? 0, cur)}
              </div>
            </div>

            <div
              className={cn(
                'flex flex-col gap-1.5 px-5 py-4 min-w-[240px]',
                isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]'
              )}
            >
              <div className="text-[12px] uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1">
                In Transit + Scheduled
                <InfoTooltip description="Money that has settled out of Shopify Payments but hasn't landed in your bank account yet." />
              </div>
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-blue-600' : 'text-blue-400'
                )}
              >
                {formatCurrency(
                  (summary?.inTransitAmount ?? 0) + (summary?.scheduledAmount ?? 0),
                  cur
                )}
              </div>
            </div>

            <div
              className={cn(
                'flex flex-col gap-1.5 px-5 py-4 min-w-[240px]',
                isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]'
              )}
            >
              <div className="text-[12px] uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1">
                Avg Payout
                <InfoTooltip description="Average net amount per payout in the period." />
              </div>
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {formatCurrency(summary?.avgPayoutAmount ?? 0, cur)}
              </div>
            </div>

            <div
              className={cn(
                'flex flex-col gap-1.5 px-5 py-4 min-w-[240px]',
                isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]'
              )}
            >
              <div className="text-[12px] uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1">
                Processing Fees
                <InfoTooltip
                  description="Total Shopify Payments processing fees deducted from your sales over the period. The effective fee rate is fees ÷ gross charges."
                  calculationTooltip={{
                    formula:
                      'Σ (charges_fee + refunds_fee + adjustments_fee + reserved_funds_fee + retried_payouts_fee)',
                    components: [
                      {
                        label: 'Total fees',
                        value: formatCurrency(summary?.totalFees ?? 0, cur),
                        highlight: true,
                      },
                      {
                        label: 'Gross charges',
                        value: formatCurrency(summary?.totalChargesGross ?? 0, cur),
                      },
                      {
                        label: '= Effective rate',
                        value: `${((summary?.effectiveFeeRate ?? 0) * 100).toFixed(2)}%`,
                      },
                    ],
                  }}
                />
              </div>
              <div
                className={cn(
                  'text-[28px] font-mono font-semibold tabular-nums',
                  isLight ? 'text-amber-700' : 'text-amber-400'
                )}
              >
                {formatCurrency(summary?.totalFees ?? 0, cur)}
              </div>
              <div className="text-[11px] text-stone-500 mt-0.5">
                {((summary?.effectiveFeeRate ?? 0) * 100).toFixed(2)}% effective rate
              </div>
            </div>

            {(summary?.failedAmount ?? 0) > 0 && (
              <div
                className={cn(
                  'flex flex-col gap-1.5 px-5 py-4 min-w-[240px]',
                  isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]'
                )}
              >
                <div className="text-[12px] uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1">
                  Failed
                  <InfoTooltip description="Payouts that failed to deposit (e.g. closed bank account, insufficient routing info). Investigate and re-trigger from Shopify." />
                </div>
                <div
                  className={cn(
                    'text-[28px] font-mono font-semibold tabular-nums',
                    isLight ? 'text-red-600' : 'text-red-400'
                  )}
                >
                  {formatCurrency(summary?.failedAmount ?? 0, cur)}
                </div>
              </div>
            )}
          </div>

          {/* Trend charts */}
          {payoutTrend.length > 0 && (
            <div className="grid @xl:grid-cols-2 gap-5">
              <div
                className={cn(
                  'pb-4 border-b',
                  isLight ? 'border-stone-200' : 'border-white/[0.08]'
                )}
              >
                <p className="text-[11px] font-medium theme-text-secondary uppercase tracking-wider mb-3">
                  Payout Volume &amp; Count
                </p>
                <ReactECharts
                  option={trendChartOption}
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
                  Payout Composition (Charges − Refunds − Fees ± Adjustments + Reserves)
                </p>
                <ReactECharts
                  option={compositionChartOption}
                  style={{ width: '100%', height: 280 }}
                  opts={{ renderer: 'canvas' }}
                />
              </div>
            </div>
          )}

          {/* Status filter tabs */}
          <div className="flex gap-2 flex-wrap">
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
              All ({summary?.totalCount ?? 0})
            </button>
            {summary?.payoutsByStatus?.map((s: { status: string; count: number }) => {
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
              placeholder="Search payouts..."
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

          {/* Payouts table */}
          <div className="overflow-x-auto overflow-y-auto max-h-[900px] scrollbar-thin scrollbar-thumb-stone-300 dark:scrollbar-thumb-stone-700 scrollbar-track-transparent">
            <table className="w-full text-sm">
              <thead className={cn('sticky top-0 z-10', isLight ? 'bg-white' : 'bg-[#0a0a0a]')}>
                <tr
                  className={cn('border-b', isLight ? 'border-stone-200' : 'border-white/[0.08]')}
                >
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                    <button
                      onClick={() => handleSort('date')}
                      className="inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Date <SortIcon col="date" />
                    </button>
                  </th>
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
                  <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                    <button
                      onClick={() => handleSort('charges')}
                      className="inline-flex items-center gap-1 ml-auto hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Charges <SortIcon col="charges" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                    <button
                      onClick={() => handleSort('refunds')}
                      className="inline-flex items-center gap-1 ml-auto hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Refunds <SortIcon col="refunds" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                    <button
                      onClick={() => handleSort('fees')}
                      className="inline-flex items-center gap-1 ml-auto hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Fees <SortIcon col="fees" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                    <button
                      onClick={() => handleSort('amount')}
                      className="inline-flex items-center gap-1 ml-auto hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Net <SortIcon col="amount" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((payout, index) => {
                  const charges = parseFloat(payout.summary?.charges_gross_amount || '0') || 0
                  const refunds = parseFloat(payout.summary?.refunds_gross_amount || '0') || 0
                  const fees =
                    (parseFloat(payout.summary?.charges_fee_amount || '0') || 0) +
                    (parseFloat(payout.summary?.refunds_fee_amount || '0') || 0) +
                    (parseFloat(payout.summary?.adjustments_fee_amount || '0') || 0) +
                    (parseFloat(payout.summary?.reserved_funds_fee_amount || '0') || 0) +
                    (parseFloat(payout.summary?.retried_payouts_fee_amount || '0') || 0)
                  return (
                    <tr
                      key={payout.id}
                      className={cn(
                        'transition-colors',
                        index % 2 === 1 ? (isLight ? 'bg-stone-50' : 'bg-white/[0.02]') : '',
                        isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.04]'
                      )}
                    >
                      <td
                        className={cn(
                          'px-4 py-3 tabular-nums',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        {formatDate(payout.date)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs tabular-nums text-stone-500">
                        #{payout.id}
                      </td>
                      <td className="px-4 py-3">
                        <PayoutStatusBadge status={payout.status} isLight={isLight} />
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-mono tabular-nums',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        {formatCurrency(charges, payout.currency || cur)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-red-500">
                        {refunds > 0 ? `-${formatCurrency(refunds, payout.currency || cur)}` : '—'}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-mono tabular-nums',
                          isLight ? 'text-amber-700' : 'text-amber-400'
                        )}
                      >
                        {fees > 0 ? `-${formatCurrency(fees, payout.currency || cur)}` : '—'}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-mono font-semibold tabular-nums',
                          isLight ? 'text-emerald-700' : 'text-emerald-400'
                        )}
                      >
                        {formatCurrency(payout.amount, payout.currency || cur)}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                      {payouts.length === 0
                        ? 'No payouts in the selected period.'
                        : 'No payouts matching the current filter.'}
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
