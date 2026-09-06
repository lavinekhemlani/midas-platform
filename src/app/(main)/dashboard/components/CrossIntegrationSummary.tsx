'use client'

import { useState, useMemo } from 'react'
import {
  Wallet,
  TrendingUp,
  ArrowLeftRight,
  Activity,
  Plus,
  Layers,
  ChevronDown,
  Info,
  RefreshCw,
} from 'lucide-react'
import {
  formatCompactCurrency,
  formatAxisCurrency,
  convertCurrency,
  getCurrencyInfo,
  getCurrencyName,
} from '@/lib/utils/currency'
import { Skeleton } from '@/components/ui/skeleton'
import { ReactECharts } from '@/components/chat/visualizations/shared'
import type { ProviderSnapshot } from '../hooks/useDashboardQBData'
import type { MonthlyDataPoint } from '../hooks/useDashboardTrendData'
import type { ProviderID } from '@/lib/providers/database'

interface ProviderEntry {
  entityKey: string // Unique: "quickbooks-9130350993512365" or "dynamics-bc_aquaculture"
  providerId: ProviderID // For provider-level logic (icon, color fallback)
  name: string // Entity display name
  color: string
  snapshot: ProviderSnapshot
}

export interface ProviderTrendData {
  entityKey: string
  providerId: ProviderID
  name: string
  color: string
  data: MonthlyDataPoint[]
  currency: string
  isLoading: boolean
}

// ─── Entity Radio Toggles ────────────────────────────────────
// Radio-style toggles with colored indicator

function EntityToggles({
  providers,
  hiddenEntities,
  onToggle,
}: {
  providers: ProviderEntry[]
  hiddenEntities: Set<string>
  onToggle: (entityKey: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {providers.map((p) => {
        const isActive = !hiddenEntities.has(p.entityKey)
        return (
          <button
            key={p.entityKey}
            onClick={() => onToggle(p.entityKey)}
            className={`entity-toggle flex items-center gap-1.5 text-xs cursor-pointer select-none transition-all duration-200 ${
              isActive ? 'theme-text-primary' : 'theme-text-secondary opacity-40 hover:opacity-60'
            }`}
          >
            <span
              className={`w-3.5 h-3.5 rounded-full flex-shrink-0 border-2 transition-all duration-200 flex items-center justify-center`}
              style={{
                borderColor: isActive ? p.color : 'currentColor',
              }}
            >
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
              )}
            </span>
            {p.name}
          </button>
        )
      })}
    </div>
  )
}

// ─── Proportion Bar ──────────────────────────────────────────
// Consistent mini horizontal stacked bar used in every metric card.
// Shows each entity's share of the total using provider colors.

function ProportionBar({
  segments,
  isDark,
}: {
  segments: { color: string; value: number; dimmed?: boolean }[]
  isDark: boolean
}) {
  const total = segments.reduce((s, seg) => s + Math.abs(seg.value), 0)
  if (total === 0) return <div className="h-1.5 rounded-full proportion-bar-track" />

  return (
    <div className="h-1.5 rounded-full proportion-bar-track flex overflow-hidden">
      {segments.map((seg, i) => {
        const pct = (Math.abs(seg.value) / total) * 100
        if (pct <= 0) return null
        return (
          <div
            key={i}
            className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${pct}%`,
              backgroundColor: seg.color,
              opacity: seg.dimmed ? 0.2 : 0.7,
              minWidth: pct > 2 ? undefined : 2,
            }}
          />
        )
      })}
    </div>
  )
}

// ─── Monthly Trend Comparison Chart ─────────────────────────

function MonthlyTrendChart({
  trendData,
  baseCurrency,
  isDark,
}: {
  trendData: ProviderTrendData[]
  baseCurrency: string
  isDark: boolean
}) {
  const option = useMemo(() => {
    // Collect all unique months, sort by the sortable key (YYYY-MM), display by label
    const monthEntries = new Map<string, string>() // sortableKey → label
    trendData.forEach((t) =>
      t.data.forEach((d) => {
        if (!monthEntries.has(d.month)) monthEntries.set(d.month, d.label)
      })
    )
    const sortedKeys = [...monthEntries.keys()].sort() // "2024-01" < "2024-02" — correct order
    const labels = sortedKeys.map((k) => monthEntries.get(k)!)

    const series = trendData.map((t) => {
      const monthMap = new Map(t.data.map((d) => [d.month, d.revenue]))
      return {
        name: t.name,
        type: 'line' as const,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2, color: t.color },
        itemStyle: { color: t.color },
        areaStyle: { color: `${t.color}15` },
        data: sortedKeys.map((k) => {
          const raw = monthMap.get(k) ?? null
          if (raw == null) return null
          if (t.currency === baseCurrency) return raw
          return convertCurrency(raw, t.currency, baseCurrency) ?? raw
        }),
      }
    })

    const axisFormatter = formatAxisCurrency(baseCurrency)

    return {
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: isDark ? '#1a1a2e' : '#fff',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 11 },
        formatter: (params: any) => {
          const header = params[0]?.axisValue || ''
          let html = `<div style="font-weight:600;margin-bottom:4px">${header}</div>`
          params.forEach((p: any) => {
            if (p.value == null) return
            const val = formatCompactCurrency(p.value, baseCurrency)
            html += `<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>${p.seriesName}: <b>${val}</b></div>`
          })
          return html
        },
      },
      legend: { show: false },
      grid: { top: 16, bottom: 32, left: 8, right: 8, containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: labels,
        axisLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' } },
        axisLabel: {
          color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
          fontSize: 10,
          interval: Math.max(0, Math.floor(labels.length / 6) - 1),
        },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        scale: true,
        axisLabel: {
          color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
          fontSize: 10,
          formatter: axisFormatter,
        },
        splitLine: {
          lineStyle: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
        },
      },
      series,
    }
  }, [trendData, baseCurrency, isDark])

  return (
    <div className="h-[220px]">
      <ReactECharts
        option={option}
        notMerge={true}
        style={{ width: '100%', height: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  )
}

// ─── Primary Provider Picker ────────────────────────────────
// Inline labeled dropdown — "Base currency" label always visible

function PrimaryProviderPicker({
  providers,
  value,
  onChange,
}: {
  providers: ProviderEntry[]
  value: string
  onChange: (entityKey: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const selected = providers.find((p) => p.entityKey === value)
  const selectedCurrency = selected?.snapshot.currency || 'USD'
  const selectedInfo = getCurrencyInfo(selectedCurrency)

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs font-medium theme-text-secondary uppercase tracking-[0.08em] opacity-60 flex-shrink-0">
        Base currency:
      </span>

      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="primary-picker-btn flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12] transition-colors cursor-pointer min-w-[240px]"
        >
          <span className="theme-text-primary font-mono">{selectedInfo.symbol}</span>
          <span className="theme-text-primary">{selectedCurrency}</span>
          <span className="theme-text-secondary opacity-60">
            {getCurrencyName(selectedCurrency)}
          </span>
          <span className="flex-1" />
          <ChevronDown
            className={`w-3 h-3 theme-text-secondary opacity-50 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="primary-picker-dropdown absolute top-full mt-1.5 left-0 z-50 w-full min-w-fit rounded-xl shadow-2xl overflow-hidden"
              style={{
                background: 'var(--theme-bg)',
                border: '1px solid var(--theme-card-border)',
              }}
            >
              <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider theme-text-secondary opacity-60 border-b border-white/[0.06]">
                Convert all values to
              </div>
              {providers.map((p) => {
                const currency = p.snapshot.currency || 'USD' || 'USD'
                const info = getCurrencyInfo(currency)
                return (
                  <button
                    key={p.entityKey}
                    onClick={() => {
                      onChange(p.entityKey)
                      setOpen(false)
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors cursor-pointer ${
                      p.entityKey === value ? 'bg-amber-500/10' : 'hover:bg-white/[0.06]'
                    }`}
                  >
                    <span
                      className={`font-mono font-medium w-6 text-center flex-shrink-0 ${
                        p.entityKey === value ? 'text-amber-500' : 'theme-text-primary'
                      }`}
                    >
                      {info.symbol}
                    </span>
                    <span
                      className={`font-mono font-medium flex-shrink-0 ${
                        p.entityKey === value ? 'text-amber-500' : 'theme-text-primary'
                      }`}
                    >
                      {currency}
                    </span>
                    <span className="theme-text-secondary opacity-60">
                      {getCurrencyName(currency)}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Info — positioned safely to the right */}
      <div
        className="relative flex-shrink-0"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Info className="w-3.5 h-3.5 theme-text-secondary opacity-40 cursor-help" />
        {showTooltip && (
          <div className="absolute top-full mt-2 right-0 z-50 w-52">
            <div
              className="px-3 py-2 rounded-lg text-xs leading-relaxed theme-text-secondary shadow-lg"
              style={{
                background: 'var(--theme-bg)',
                border: '1px solid var(--theme-card-border)',
              }}
            >
              All values from other entities will be converted to this entity&apos;s currency using
              approximate exchange rates.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Unified Metric Card ─────────────────────────────────────
// Consistent layout: Header → Aggregate value → Divider → Entity rows

function MetricCard({
  icon: Icon,
  label,
  aggregate,
  aggregateColor,
  isEstimated,
  chart,
  children,
}: {
  icon: React.ElementType
  label: string
  aggregate: string | null
  aggregateColor?: string
  isEstimated?: boolean
  chart?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="metric-tile group rounded-2xl metric-card-bg metric-card-border p-6 transition-all duration-300 hover:metric-card-hover flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-7 h-7 rounded-lg metric-icon-bg flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5 metric-icon-color" />
        </div>
        <span className="text-xs font-medium theme-text-secondary uppercase tracking-[0.12em] opacity-70">
          {label}
        </span>
      </div>

      {aggregate != null ? (
        <>
          {/* Aggregate value */}
          <p
            className={`text-xl font-mono font-semibold tabular-nums leading-none ${!aggregateColor ? 'theme-text-primary' : ''}`}
            style={aggregateColor ? { color: aggregateColor } : undefined}
          >
            {isEstimated && <span className="theme-text-secondary text-base mr-0.5">~</span>}
            {aggregate}
          </p>

          {/* Mini chart */}
          {chart && <div className="mt-5 mb-3">{chart}</div>}

          {/* Divider + compact entity breakdown */}
          <div className="space-y-2.5 pt-4 metric-card-divider mt-auto">{children}</div>
        </>
      ) : (
        <>
          {/* No aggregate — expanded entity values take center stage */}
          {chart && <div className="mb-3">{chart}</div>}
          <div className="space-y-3 mt-auto">{children}</div>
        </>
      )}
    </div>
  )
}

function MetricCardSkeleton({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="rounded-2xl metric-card-bg p-6 flex flex-col">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-7 h-7 rounded-lg metric-icon-bg flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 metric-icon-color opacity-50" />
        </div>
        <span className="text-xs font-medium theme-text-secondary uppercase tracking-[0.12em] opacity-50">
          {label}
        </span>
      </div>
      <Skeleton className="h-7 w-28 rounded-lg" />
      <div className="h-1.5 rounded-full proportion-bar-track mt-4" />
      <div className="space-y-2 pt-4 metric-card-divider mt-auto">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
      </div>
    </div>
  )
}

// Compact row — used in compare mode under the aggregate total
function EntityRow({
  name,
  value,
  currency,
  color,
  estimated,
  dimmed,
  suffix,
}: {
  name: string
  value: number | null
  currency: string
  color: string
  estimated?: boolean
  dimmed?: boolean
  suffix?: string
}) {
  return (
    <div
      className={`flex items-center justify-between text-xs transition-opacity ${dimmed ? 'opacity-30' : ''}`}
    >
      <span className="theme-text-secondary flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        {name}
      </span>
      <span className="font-mono font-medium theme-text-primary tabular-nums">
        {estimated && value != null && <span className="theme-text-secondary mr-0.5">~</span>}
        {value != null ? formatCompactCurrency(value, currency) : suffix || '--'}
      </span>
    </div>
  )
}

// Expanded row — used when compare is off, each entity value is prominent
function EntityRowExpanded({
  name,
  value,
  currency,
  color,
  dimmed,
  suffix,
}: {
  name: string
  value: number | null
  currency: string
  color: string
  dimmed?: boolean
  suffix?: string
}) {
  return (
    <div
      className={`flex items-center justify-between transition-opacity ${dimmed ? 'opacity-30' : ''}`}
    >
      <span className="text-xs theme-text-secondary flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        {name}
      </span>
      <span className="text-base font-mono font-semibold theme-text-primary tabular-nums">
        {value != null ? formatCompactCurrency(value, currency) : suffix || '--'}
      </span>
    </div>
  )
}

// ─── Helper: convert value ──────────────────────────────────

function convertVal(value: number | null, fromCurrency: string, toCurrency: string): number | null {
  if (value == null) return null
  if (fromCurrency === toCurrency) return value
  return convertCurrency(value, fromCurrency, toCurrency)
}

// ─── Main Component ─────────────────────────────────────────

export function CrossIntegrationSummary({
  providers,
  isDark,
  trendData = [],
  onAddIntegration,
}: {
  providers: ProviderEntry[]
  isDark: boolean
  trendData?: ProviderTrendData[]
  onAddIntegration?: () => void
}) {
  // "ready" = data loaded
  const ready = useMemo(
    () => providers.filter((p) => !p.snapshot.isLoading && p.snapshot.revenue != null),
    [providers]
  )
  const anyLoading = providers.some((p) => p.snapshot.isLoading)
  const anyValidating = providers.some((p) => p.snapshot.isValidating && !p.snapshot.isLoading)

  // Use total providers count (connected), not just ready count
  const hasMultipleConnected = providers.length >= 2
  const hasMultipleReady = ready.length >= 2

  const [comparing, setComparing] = useState(true)
  const [primaryEntityKey, setPrimaryEntityKey] = useState<string | null>(null)
  const [hiddenEntities, setHiddenEntities] = useState<Set<string>>(new Set())

  const toggleEntity = (entityKey: string) => {
    setHiddenEntities((prev) => {
      const next = new Set(prev)
      if (next.has(entityKey)) next.delete(entityKey)
      else next.add(entityKey)
      return next
    })
  }

  // Visible = ready AND not hidden by toggle
  const visible = useMemo(
    () => ready.filter((p) => !hiddenEntities.has(p.entityKey)),
    [ready, hiddenEntities]
  )

  // Resolve the primary entity — default to first provider
  const primaryProvider = useMemo(() => {
    if (primaryEntityKey)
      return providers.find((p) => p.entityKey === primaryEntityKey) || providers[0]
    return providers[0]
  }, [primaryEntityKey, providers])

  const baseCurrency =
    hasMultipleConnected && primaryProvider ? primaryProvider.snapshot.currency || 'USD' : null

  if (providers.length === 0) return null

  // Only for visible providers
  const currencies = [...new Set(visible.map((p) => p.snapshot.currency || 'USD'))]
  const sameCurrency = currencies.length <= 1
  const isEstimated = comparing && !sameCurrency

  const displayCurrency =
    comparing && baseCurrency ? baseCurrency : (sameCurrency && currencies[0]) || 'USD'

  // Get value — converted if comparing
  const getVal = (p: ProviderEntry, field: 'revenue' | 'cashBalance' | 'ar' | 'ap') => {
    const raw = p.snapshot[field]
    if (!comparing || !baseCurrency || !raw) return raw
    return convertVal(raw, p.snapshot.currency || 'USD' || 'USD', baseCurrency)
  }

  const canAggregate = sameCurrency || comparing
  const totalRevenue = canAggregate
    ? visible.reduce((sum, p) => sum + (getVal(p, 'revenue') || 0), 0)
    : null
  const totalCash = canAggregate
    ? visible.reduce((sum, p) => sum + (getVal(p, 'cashBalance') || 0), 0)
    : null
  const totalAR = canAggregate ? visible.reduce((sum, p) => sum + (getVal(p, 'ar') || 0), 0) : null
  const totalAP = canAggregate ? visible.reduce((sum, p) => sum + (getVal(p, 'ap') || 0), 0) : null
  const netExposure = totalAR != null && totalAP != null ? totalAR - totalAP : null

  const healthScores = visible.filter((p) => p.snapshot.healthScore != null)
  const avgHealth =
    healthScores.length > 0
      ? Math.round(
          healthScores.reduce((sum, p) => sum + (p.snapshot.healthScore ?? 0), 0) /
            healthScores.length
        )
      : null

  const activeTrends = trendData.filter((t) => t.data.length > 0)
  const visibleTrends = activeTrends.filter((t) => !hiddenEntities.has(t.entityKey))

  return (
    <section className="cross-integration-summary @container">
      {/* ── Section heading ── */}
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-xs font-medium tracking-[0.15em] uppercase theme-text-secondary flex items-center gap-2">
          Financial Overview
          {anyValidating && <RefreshCw className="w-3 h-3 animate-spin theme-text-secondary" />}
        </h2>
        <div className="h-px flex-1 section-divider-line" />
      </div>

      {!hasMultipleConnected ? (
        /* ── Single provider: subtle prompt ── */
        <button
          onClick={onAddIntegration}
          className="group w-full max-w-md rounded-2xl metric-card-bg p-5 flex items-center gap-4 transition-all duration-300 cursor-pointer hover:border-amber-500/30 text-left"
        >
          <div className="w-10 h-10 rounded-xl metric-icon-bg flex items-center justify-center flex-shrink-0">
            <Layers className="w-5 h-5 metric-icon-color opacity-70" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm theme-text-primary font-medium">Unlock cross-platform insights</p>
            <p className="text-xs theme-text-secondary mt-1 opacity-70 leading-relaxed">
              Connect another integration to compare revenue, cash flow, and health across
              platforms.
            </p>
          </div>
          <div className="flex-shrink-0">
            <div className="w-9 h-9 rounded-xl border border-dashed prompt-add-btn flex items-center justify-center transition-all group-hover:border-amber-500/50 group-hover:bg-amber-500/10">
              <Plus className="w-4 h-4 metric-icon-color opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </button>
      ) : (
        /* ── Multi-entity: controls + cards ── */
        <div className="space-y-5">
          {/* ── Control bar ── */}
          <div className="space-y-3">
            {/* Top row: Companies on left, Compare toggle + Base currency on right */}
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-3 min-w-0">
                {hasMultipleReady && (
                  <>
                    <span className="text-xs font-medium theme-text-secondary uppercase tracking-[0.08em] opacity-60 flex-shrink-0">
                      Companies:
                    </span>
                    <EntityToggles
                      providers={ready}
                      hiddenEntities={hiddenEntities}
                      onToggle={toggleEntity}
                    />
                  </>
                )}
                {isEstimated && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/[0.06] text-amber-500/70 border border-amber-500/10 flex-shrink-0">
                    Estimated
                  </span>
                )}
              </div>

              {/* Compare — always rightmost, never moves */}
              {hasMultipleConnected && (
                <label className="compare-toggle flex items-center gap-2.5 cursor-pointer select-none flex-shrink-0">
                  <ArrowLeftRight className="w-3.5 h-3.5 theme-text-primary" />
                  <span className="text-[14px] font-medium theme-text-primary">Compare</span>
                  <button
                    role="switch"
                    aria-checked={comparing}
                    onClick={() => setComparing(!comparing)}
                    className={`compare-switch relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 flex-shrink-0 cursor-pointer ${
                      comparing ? 'bg-amber-500/25' : isDark ? 'bg-white/[0.1]' : 'bg-black/[0.08]'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full shadow-sm transition-all duration-200 ${
                        comparing
                          ? 'translate-x-[18px] bg-amber-500'
                          : isDark
                            ? 'translate-x-[3px] bg-white/30'
                            : 'translate-x-[3px] bg-black/20'
                      }`}
                    />
                  </button>
                </label>
              )}
            </div>

            {/* Second row: Base currency picker — visible whenever multiple integrations */}
            {hasMultipleConnected && (
              <div className="flex items-center gap-3">
                <PrimaryProviderPicker
                  providers={providers}
                  value={primaryProvider?.entityKey || providers[0].entityKey}
                  onChange={setPrimaryEntityKey}
                />
              </div>
            )}
          </div>

          {/* ── KPI cards ── */}
          <div>
            {!hasMultipleReady && anyLoading ? (
              <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-4 gap-4">
                <MetricCardSkeleton icon={TrendingUp} label="Revenue" />
                <MetricCardSkeleton icon={Wallet} label="Cash Position" />
                <MetricCardSkeleton icon={ArrowLeftRight} label="Net Exposure" />
                <MetricCardSkeleton icon={Activity} label="Health Score" />
              </div>
            ) : (
              <div
                className={`grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-4 gap-4 transition-opacity duration-300 ${anyValidating ? 'opacity-60' : ''}`}
              >
                {/* Revenue */}
                <MetricCard
                  icon={TrendingUp}
                  label="Revenue"
                  aggregate={
                    canAggregate && totalRevenue != null
                      ? formatCompactCurrency(totalRevenue, displayCurrency)
                      : null
                  }
                  isEstimated={isEstimated}
                  chart={
                    canAggregate ? (
                      <ProportionBar
                        isDark={isDark}
                        segments={ready.map((p) => ({
                          color: p.color,
                          value: (comparing ? getVal(p, 'revenue') : p.snapshot.revenue) || 0,
                          dimmed: hiddenEntities.has(p.entityKey),
                        }))}
                      />
                    ) : undefined
                  }
                >
                  {ready.map((p) =>
                    canAggregate ? (
                      <EntityRow
                        key={p.entityKey}
                        name={p.name}
                        value={comparing ? getVal(p, 'revenue') : p.snapshot.revenue}
                        currency={comparing ? displayCurrency : p.snapshot.currency || 'USD'}
                        color={p.color}
                        estimated={
                          isEstimated &&
                          baseCurrency != null &&
                          (p.snapshot.currency || 'USD') !== baseCurrency
                        }
                        dimmed={hiddenEntities.has(p.entityKey)}
                      />
                    ) : (
                      <EntityRowExpanded
                        key={p.entityKey}
                        name={p.name}
                        value={p.snapshot.revenue}
                        currency={p.snapshot.currency || 'USD'}
                        color={p.color}
                        dimmed={hiddenEntities.has(p.entityKey)}
                      />
                    )
                  )}
                </MetricCard>

                {/* Cash Position */}
                <MetricCard
                  icon={Wallet}
                  label="Cash Position"
                  aggregate={
                    canAggregate && totalCash != null
                      ? formatCompactCurrency(totalCash, displayCurrency)
                      : null
                  }
                  isEstimated={isEstimated}
                  chart={
                    canAggregate ? (
                      <ProportionBar
                        isDark={isDark}
                        segments={ready.map((p) => ({
                          color: p.color,
                          value:
                            (comparing ? getVal(p, 'cashBalance') : p.snapshot.cashBalance) || 0,
                          dimmed: hiddenEntities.has(p.entityKey),
                        }))}
                      />
                    ) : undefined
                  }
                >
                  {ready.map((p) =>
                    canAggregate ? (
                      <EntityRow
                        key={p.entityKey}
                        name={p.name}
                        value={comparing ? getVal(p, 'cashBalance') : p.snapshot.cashBalance}
                        currency={comparing ? displayCurrency : p.snapshot.currency || 'USD'}
                        color={p.color}
                        estimated={
                          isEstimated &&
                          baseCurrency != null &&
                          (p.snapshot.currency || 'USD') !== baseCurrency
                        }
                        dimmed={hiddenEntities.has(p.entityKey)}
                      />
                    ) : (
                      <EntityRowExpanded
                        key={p.entityKey}
                        name={p.name}
                        value={p.snapshot.cashBalance}
                        currency={p.snapshot.currency || 'USD'}
                        color={p.color}
                        dimmed={hiddenEntities.has(p.entityKey)}
                      />
                    )
                  )}
                </MetricCard>

                {/* Net Exposure (AR - AP) */}
                <MetricCard
                  icon={ArrowLeftRight}
                  label="Net Exposure"
                  aggregate={
                    canAggregate && netExposure != null
                      ? `${netExposure >= 0 ? '+' : ''}${formatCompactCurrency(netExposure, displayCurrency)}`
                      : null
                  }
                  aggregateColor={
                    netExposure != null ? (netExposure >= 0 ? '#10b981' : '#f87171') : undefined
                  }
                  isEstimated={isEstimated}
                  chart={
                    canAggregate ? (
                      <ProportionBar
                        isDark={isDark}
                        segments={ready.map((p) => {
                          const ar = (comparing ? getVal(p, 'ar') : p.snapshot.ar) || 0
                          const ap = (comparing ? getVal(p, 'ap') : p.snapshot.ap) || 0
                          return {
                            color: p.color,
                            value: Math.abs(ar - ap),
                            dimmed: hiddenEntities.has(p.entityKey),
                          }
                        })}
                      />
                    ) : undefined
                  }
                >
                  {ready.map((p) => {
                    const ar = comparing ? getVal(p, 'ar') : p.snapshot.ar
                    const ap = comparing ? getVal(p, 'ap') : p.snapshot.ap
                    const net = ar != null && ap != null ? ar - ap : null
                    return canAggregate ? (
                      <EntityRow
                        key={p.entityKey}
                        name={p.name}
                        value={net}
                        currency={comparing ? displayCurrency : p.snapshot.currency || 'USD'}
                        color={p.color}
                        estimated={
                          isEstimated &&
                          baseCurrency != null &&
                          (p.snapshot.currency || 'USD') !== baseCurrency
                        }
                        dimmed={hiddenEntities.has(p.entityKey)}
                      />
                    ) : (
                      <EntityRowExpanded
                        key={p.entityKey}
                        name={p.name}
                        value={net}
                        currency={p.snapshot.currency || 'USD'}
                        color={p.color}
                        dimmed={hiddenEntities.has(p.entityKey)}
                      />
                    )
                  })}
                </MetricCard>

                {/* Health Score — individual progress bars always meaningful */}
                <MetricCard
                  icon={Activity}
                  label="Health Score"
                  aggregate={
                    canAggregate ? (avgHealth != null ? `${avgHealth} / 100` : null) : null
                  }
                  chart={
                    <div className="space-y-2">
                      {ready.map((p) => (
                        <div
                          key={p.entityKey}
                          className={`transition-opacity ${hiddenEntities.has(p.entityKey) ? 'opacity-20' : ''}`}
                        >
                          <div className="h-1.5 rounded-full proportion-bar-track overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${p.snapshot.healthScore ?? 0}%`,
                                backgroundColor: p.color,
                                opacity: 0.7,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  }
                >
                  {ready.map((p) =>
                    canAggregate ? (
                      <EntityRow
                        key={p.entityKey}
                        name={p.name}
                        value={null}
                        currency=""
                        color={p.color}
                        dimmed={hiddenEntities.has(p.entityKey)}
                        suffix={
                          p.snapshot.healthScore != null
                            ? `${Math.round(p.snapshot.healthScore)} / 100`
                            : undefined
                        }
                      />
                    ) : (
                      <EntityRowExpanded
                        key={p.entityKey}
                        name={p.name}
                        value={null}
                        currency=""
                        color={p.color}
                        dimmed={hiddenEntities.has(p.entityKey)}
                        suffix={
                          p.snapshot.healthScore != null
                            ? `${Math.round(p.snapshot.healthScore)} / 100`
                            : undefined
                        }
                      />
                    )
                  )}
                </MetricCard>
              </div>
            )}
          </div>

          {/* ── Compare mode: Monthly trend chart ── */}
          {comparing && visibleTrends.length > 0 && baseCurrency && (
            <div className="rounded-2xl metric-card-bg p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="text-xs font-medium theme-text-secondary uppercase tracking-[0.12em] opacity-70">
                  Monthly Revenue Trend
                </span>
                {/* Entity legend for chart */}
                <div className="flex items-center gap-3 ml-auto">
                  {visibleTrends.map((t) => (
                    <span
                      key={t.entityKey}
                      className="flex items-center gap-1.5 text-xs theme-text-secondary"
                    >
                      <span
                        className="w-2 h-0.5 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
              <MonthlyTrendChart
                trendData={visibleTrends}
                baseCurrency={baseCurrency}
                isDark={isDark}
              />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
