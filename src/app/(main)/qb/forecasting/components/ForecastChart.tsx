'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Brain, ExternalLink, RotateCcw, Info, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type {
  ForecastPeriod,
  ForecastHorizon,
  ForecastSummary,
  ForecastAssumptions,
  ForecastMemories,
  ForecastAlgorithm,
} from '@/types/forecasting'
import { ALGORITHM_INFO } from '@/types/forecasting'
import { cn } from '@/lib/utils'

// ============================================================================
// Custom dot renderer — only shows on the memories line
// ============================================================================

function MemoryDot(props: any) {
  const { cx, cy, payload } = props
  if (!cx || !cy || !payload?.hasMemoryMarker) return null
  // Determine color by net impact of all markers in this period
  const markers = payload.memoryMarkers || []
  const netAmount = markers.reduce(
    (sum: number, m: any) => sum + (m.type === 'income' ? m.amount : -m.amount),
    0
  )
  const color = netAmount >= 0 ? '#10b981' : '#ef4444'
  const size = 5
  return (
    <g>
      <line
        x1={cx - size}
        y1={cy - size}
        x2={cx + size}
        y2={cy + size}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <line
        x1={cx + size}
        y1={cy - size}
        x2={cx - size}
        y2={cy + size}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </g>
  )
}

// ============================================================================
// Props
// ============================================================================

interface ForecastChartProps {
  periods: ForecastPeriod[]
  memories: ForecastMemories
  horizon: ForecastHorizon
  currency: string
  currentCash: number
  summary: ForecastSummary
  assumptions: ForecastAssumptions
  onAssumptionsChange: (a: ForecastAssumptions) => void
  onResetAssumptions: () => void
  hasCustomAssumptions: boolean
  allMemoriesEnabled: boolean
  onToggleAllMemories: (enabled: boolean) => void
  isValidating: boolean
  welcomeComplete: boolean
}

// ============================================================================
// Main Component
// ============================================================================

export function ForecastChart({
  periods,
  memories,
  horizon,
  currency,
  currentCash,
  summary,
  assumptions,
  onAssumptionsChange,
  onResetAssumptions,
  hasCustomAssumptions,
  allMemoriesEnabled,
  onToggleAllMemories,
  isValidating,
  welcomeComplete,
}: ForecastChartProps) {
  const isWeekly = horizon === '13-week'

  const lastHistoricalIndex = useMemo(() => {
    for (let i = periods.length - 1; i >= 0; i--) {
      if (periods[i].isHistorical) return i
    }
    return -1
  }, [periods])

  const memoryMarkerMap = useMemo(() => {
    const map = new Map<
      number,
      { type: 'income' | 'expense'; description: string; amount: number }[]
    >()
    const allMems = [...memories.income, ...memories.expenses]
    for (const memory of allMems) {
      const periodIndex = periods.findIndex((p) => {
        if (p.isHistorical) return false
        const pd = new Date(p.date)
        const md = new Date(memory.date)
        if (isWeekly) {
          const end = new Date(pd)
          end.setDate(end.getDate() + 7)
          return md >= pd && md < end
        }
        return md.getMonth() === pd.getMonth() && md.getFullYear() === pd.getFullYear()
      })
      if (periodIndex >= 0) {
        if (!map.has(periodIndex)) map.set(periodIndex, [])
        map.get(periodIndex)!.push({
          type: memory.type,
          description: memory.description,
          amount: memory.amount,
        })
      }
    }
    return map
  }, [memories, periods, isWeekly])

  // Use numeric index for x-axis so ReferenceLine always works
  const chartData = useMemo(() => {
    // Pre-check if any forecast period has memory impact
    const hasAnyMemoryImpact =
      allMemoriesEnabled &&
      periods.some(
        (p) =>
          !p.isHistorical &&
          p.forecastBase !== undefined &&
          Math.abs(p.cumulativeCash - (p.forecastBase ?? 0)) > 0.01
      )

    return periods.map((period, i) => {
      const markers = memoryMarkerMap.get(i) || []
      // Only show memory line when memories are actually enabled
      const hasMemoryImpact =
        allMemoriesEnabled &&
        period.forecastBase !== undefined &&
        Math.abs(period.cumulativeCash - (period.forecastBase ?? 0)) > 0.01

      if (period.isHistorical) {
        // On the LAST historical point, also start the forecast lines
        // so the dashed line branches from exactly where actuals end
        const isLastHistorical = i === lastHistoricalIndex
        return {
          index: i,
          label: period.label,
          historical: period.cumulativeCash,
          forecastBase: isLastHistorical
            ? period.cumulativeCash
            : (undefined as number | undefined),
          forecastMemories:
            isLastHistorical && allMemoriesEnabled && hasAnyMemoryImpact
              ? period.cumulativeCash
              : (undefined as number | undefined),
          confidenceUpper: isLastHistorical ? period.cumulativeCash : undefined,
          confidenceLower: isLastHistorical ? period.cumulativeCash : undefined,
          // For stacked area: the "band" is the difference between upper and lower
          confidenceBand: isLastHistorical ? 0 : undefined,
          isHistorical: true,
          memoryAdjustment: 0,
          hasMemoryMarker: false,
          memoryMarkerType: undefined as 'income' | 'expense' | undefined,
          memoryMarkers: [] as {
            type: 'income' | 'expense'
            description: string
            amount: number
          }[],
          inflow: period.inflow,
          outflow: period.outflow,
        }
      }

      const forecastBaseVal = period.forecastBase ?? period.forecast

      // Show memories line on ALL forecast periods once any memory impact exists,
      // so the line is continuous (no gaps from connectNulls=false)
      const showMemoriesValue = allMemoriesEnabled && hasAnyMemoryImpact

      return {
        index: i,
        label: period.label,
        historical: undefined as number | undefined,
        forecastBase: forecastBaseVal,
        forecastMemories: showMemoriesValue ? period.cumulativeCash : undefined,
        confidenceUpper: period.confidenceUpper,
        confidenceLower: period.confidenceLower,
        // For stacked area: the "band" is the difference between upper and lower
        confidenceBand:
          period.confidenceUpper != null && period.confidenceLower != null
            ? period.confidenceUpper - period.confidenceLower
            : undefined,
        isHistorical: false,
        memoryAdjustment: period.memoryAdjustment,
        hasMemoryMarker: allMemoriesEnabled && markers.length > 0,
        memoryMarkerType: markers[0]?.type,
        memoryMarkers: allMemoriesEnabled ? markers : [],
        inflow: period.inflow,
        outflow: period.outflow,
      }
    })
  }, [periods, lastHistoricalIndex, memoryMarkerMap, allMemoriesEnabled])

  const hasMemoryLine = chartData.some((d) => d.forecastMemories != null)
  const hasMemoryMarkers = chartData.some((d) => d.hasMemoryMarker)
  const hasMemories = memories.expenses.length > 0 || memories.income.length > 0
  const totalMemoryCount = new Set([
    ...memories.income.map((m) => m.sourceMemoryId),
    ...memories.expenses.map((m) => m.sourceMemoryId),
  ]).size

  const yDomain = useMemo(() => {
    let min = currentCash
    let max = currentCash
    for (const p of periods) {
      // Include confidence bounds in domain calculation
      for (const v of [
        p.cumulativeCash,
        p.forecastBase ?? p.forecast,
        p.confidenceUpper,
        p.confidenceLower,
      ]) {
        if (v != null) {
          if (v < min) min = v
          if (v > max) max = v
        }
      }
    }
    const pad = (max - min) * 0.12 || 1000
    return [Math.floor(min - pad), Math.ceil(max + pad)]
  }, [periods, currentCash])

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    if (!d) return null
    return (
      <div className="kpi-tooltip p-3 rounded-lg shadow-xl text-xs min-w-[200px]">
        <p className="font-semibold theme-text-primary mb-2">{d.label}</p>
        {d.historical != null && (
          <div className="flex justify-between gap-4 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-[3px] bg-blue-500 rounded-full inline-block" />
              <span className="theme-text-secondary">Actual</span>
            </span>
            <span className="font-mono font-semibold theme-text-primary">
              {formatCompactCurrency(d.historical, currency)}
            </span>
          </div>
        )}
        {d.forecastBase != null && (
          <div className="flex justify-between gap-4 mb-1">
            <span className="flex items-center gap-1.5">
              <span
                className="w-3 h-0.5 inline-block"
                style={{ borderTop: '2px dashed #f87171' }}
              />
              <span className="theme-text-secondary">Forecast</span>
            </span>
            <span className="font-mono font-semibold theme-text-primary">
              {formatCompactCurrency(d.forecastBase, currency)}
            </span>
          </div>
        )}
        {d.forecastMemories != null && (
          <div className="flex justify-between gap-4 mb-1">
            <span className="flex items-center gap-1.5">
              <span
                className="w-3 h-0.5 inline-block"
                style={{ borderTop: '2px dashed #fbbf24' }}
              />
              <span className="theme-text-secondary">With Memories</span>
            </span>
            <span className="font-mono font-semibold theme-text-primary">
              {formatCompactCurrency(d.forecastMemories, currency)}
            </span>
          </div>
        )}
        {d.memoryMarkers && d.memoryMarkers.length > 0 && (
          <div className="pt-1.5 mt-1.5 border-t border-gray-200/10 space-y-1">
            {d.memoryMarkers.map((m: any, idx: number) => (
              <div key={idx} className="flex justify-between gap-3">
                <span
                  className={cn(
                    'truncate',
                    m.type === 'income' ? 'text-theme-green' : 'text-theme-red'
                  )}
                >
                  {m.description || (m.type === 'income' ? 'Cash Inflow' : 'Cash Outflow')}
                </span>
                <span
                  className={cn(
                    'font-mono font-semibold whitespace-nowrap',
                    m.type === 'income' ? 'text-theme-green' : 'text-theme-red'
                  )}
                >
                  {m.type === 'income' ? '+' : '-'}
                  {formatCompactCurrency(m.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Animation: only play on initial load or horizon change
  // animKey forces Recharts to remount lines and replay the draw animation
  const [animKey, setAnimKey] = useState(0)
  const welcomeCompleteRef = useRef(false)
  const prevHorizonRef = useRef(horizon)

  // First animation after welcome completes
  useEffect(() => {
    if (welcomeComplete && !welcomeCompleteRef.current) {
      welcomeCompleteRef.current = true
      setAnimKey((k) => k + 1)
    }
  }, [welcomeComplete])

  // Re-trigger animation ONLY when horizon changes (13-week <-> 6-month)
  // NOT when assumptions or memories change - those should update instantly
  useEffect(() => {
    if (welcomeCompleteRef.current && horizon !== prevHorizonRef.current) {
      prevHorizonRef.current = horizon
      setAnimKey((k) => k + 1)
    }
  }, [horizon])

  const shouldAnimate = welcomeComplete
  const HIST_DURATION = 1200
  const FORECAST_DELAY = HIST_DURATION // forecast lines start after historical finishes
  const FORECAST_DURATION = 1200

  const axisTickColor = 'var(--theme-text-secondary)'

  return (
    <Card className="glass-luxury-card border border-gray-200/10 overflow-hidden gap-0">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="chart-title text-base">
            {isWeekly ? '13-Week' : '6-Month'} Cash Projection
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* Memory toggle with info tooltip */}
            {hasMemories && (
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-xs font-medium flex items-center gap-1',
                    allMemoriesEnabled ? 'text-theme-purple' : 'theme-text-secondary'
                  )}
                >
                  <Brain className="w-3.5 h-3.5" />
                  Memories ({totalMemoryCount})
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allMemoriesEnabled}
                  onClick={() => onToggleAllMemories(!allMemoriesEnabled)}
                  className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
                  style={{
                    backgroundColor: allMemoriesEnabled
                      ? 'rgb(168, 85, 247)'
                      : 'rgba(148, 163, 184, 0.3)',
                  }}
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
                      allMemoriesEnabled ? 'translate-x-4' : 'translate-x-0'
                    )}
                  />
                </button>
                <TooltipProvider delayDuration={200}>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <button className="theme-text-secondary hover:text-theme-purple transition-colors">
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      align="end"
                      className="w-64 p-3 space-y-2"
                      style={{
                        background: 'var(--theme-card-bg)',
                        borderColor: 'var(--theme-card-border)',
                        backdropFilter: 'blur(24px)',
                      }}
                    >
                      <p className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
                        <Brain className="w-3 h-3 text-theme-purple" />
                        Memory Impact
                      </p>
                      <div className="flex gap-3 text-[10px]">
                        <div className="text-center flex-1">
                          <p className="uppercase tracking-wider theme-text-secondary">Income</p>
                          <p className="text-sm font-semibold text-theme-green">
                            +{formatCompactCurrency(memories.totalIncomeImpact, currency)}
                          </p>
                          <p className="theme-text-secondary">{memories.income.length} events</p>
                        </div>
                        <div className="w-px" style={{ background: 'var(--theme-card-border)' }} />
                        <div className="text-center flex-1">
                          <p className="uppercase tracking-wider theme-text-secondary">Expense</p>
                          <p className="text-sm font-semibold text-theme-red">
                            -{formatCompactCurrency(memories.totalExpenseImpact, currency)}
                          </p>
                          <p className="theme-text-secondary">{memories.expenses.length} events</p>
                        </div>
                      </div>
                      <Link
                        href="/memories"
                        className="flex items-center gap-1 text-[10px] text-theme-purple hover:opacity-80 transition-opacity pt-1"
                        style={{ borderTop: '1px solid var(--theme-card-border)' }}
                      >
                        <ExternalLink className="w-3 h-3" /> Manage memories
                      </Link>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Chart with loading overlay */}
        <div className="relative px-6" style={{ width: '100%', height: 400 }}>
          {isValidating && (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center rounded-lg"
              style={{
                backgroundColor: 'rgba(var(--theme-bg-rgb), 0.3)',
                backdropFilter: 'blur(1px)',
              }}
            >
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-full border shadow-lg"
                style={{
                  background: 'var(--theme-card-bg)',
                  borderColor: 'var(--theme-card-border)',
                }}
              >
                <Loader2
                  className="w-4 h-4 animate-spin"
                  style={{ color: 'var(--theme-yellow)' }}
                />
                <span className="text-xs font-medium" style={{ color: 'var(--theme-yellow)' }}>
                  Updating forecast...
                </span>
              </div>
            </div>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="fg-hist-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="fg-confidence-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.15} />
                  <stop offset="50%" stopColor="#f87171" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0.15} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148,163,184,0.12)"
                vertical={false}
              />

              <XAxis
                dataKey="label"
                tick={{ fill: axisTickColor, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
                interval={isWeekly ? 1 : 0}
                dy={5}
              />

              <YAxis
                tick={{ fill: axisTickColor, fontSize: 11 }}
                tickFormatter={(v) => formatCompactCurrency(v, currency)}
                tickLine={false}
                axisLine={false}
                domain={yDomain}
                width={70}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Zero line */}
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" />

              {/* TODAY divider line — use the label of the last historical data point */}
              {lastHistoricalIndex >= 0 && chartData[lastHistoricalIndex] && (
                <ReferenceLine
                  x={chartData[lastHistoricalIndex].label}
                  stroke="var(--theme-text-secondary)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  isFront
                  label={{
                    value: 'Today',
                    position: 'insideTopRight',
                    fontSize: 11,
                    fontWeight: 600,
                    fill: 'var(--theme-text-secondary)',
                    offset: 8,
                  }}
                />
              )}

              {/* Historical area fill */}
              <Area
                key={`area-hist-${animKey}`}
                type="monotone"
                dataKey="historical"
                stroke="none"
                fill="url(#fg-hist-fill)"
                connectNulls={false}
                legendType="none"
                isAnimationActive={shouldAnimate}
                animationDuration={HIST_DURATION}
                animationEasing="ease-out"
              />

              {/* Historical line: solid blue */}
              <Line
                key={`line-hist-${animKey}`}
                type="monotone"
                dataKey="historical"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={false}
                connectNulls={false}
                activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                legendType="none"
                isAnimationActive={shouldAnimate}
                animationDuration={HIST_DURATION}
                animationEasing="ease-out"
              />

              {/* Confidence band: stacked areas - lower (invisible) + band (visible) */}
              <Area
                key={`area-confidence-lower-${animKey}`}
                type="monotone"
                dataKey="confidenceLower"
                stroke="transparent"
                fill="transparent"
                stackId="confidence"
                connectNulls={false}
                legendType="none"
                isAnimationActive={shouldAnimate}
                animationBegin={FORECAST_DELAY}
                animationDuration={FORECAST_DURATION}
                animationEasing="ease-out"
              />
              <Area
                key={`area-confidence-band-${animKey}`}
                type="monotone"
                dataKey="confidenceBand"
                stroke="transparent"
                fill="url(#fg-confidence-fill)"
                fillOpacity={1}
                stackId="confidence"
                connectNulls={false}
                legendType="none"
                isAnimationActive={shouldAnimate}
                animationBegin={FORECAST_DELAY}
                animationDuration={FORECAST_DURATION}
                animationEasing="ease-out"
              />
              {/* Upper boundary stroke line */}
              <Line
                key={`line-confidence-upper-${animKey}`}
                type="monotone"
                dataKey="confidenceUpper"
                stroke="#f8717140"
                strokeWidth={1}
                strokeDasharray="4 2"
                dot={false}
                connectNulls={false}
                legendType="none"
                isAnimationActive={shouldAnimate}
                animationBegin={FORECAST_DELAY}
                animationDuration={FORECAST_DURATION}
                animationEasing="ease-out"
              />
              {/* Lower boundary stroke line */}
              <Line
                key={`line-confidence-lower-${animKey}`}
                type="monotone"
                dataKey="confidenceLower"
                stroke="#f8717140"
                strokeWidth={1}
                strokeDasharray="4 2"
                dot={false}
                connectNulls={false}
                legendType="none"
                isAnimationActive={shouldAnimate}
                animationBegin={FORECAST_DELAY}
                animationDuration={FORECAST_DURATION}
                animationEasing="ease-out"
              />

              {/* Forecast base line: dashed red/coral — starts after historical finishes */}
              <Line
                key={`line-forecast-${animKey}`}
                type="monotone"
                dataKey="forecastBase"
                stroke="#f87171"
                strokeWidth={2.5}
                strokeDasharray="8 4"
                dot={false}
                connectNulls={false}
                activeDot={{ r: 5, fill: '#f87171', stroke: '#fff', strokeWidth: 2 }}
                legendType="none"
                isAnimationActive={shouldAnimate}
                animationBegin={FORECAST_DELAY}
                animationDuration={FORECAST_DURATION}
                animationEasing="ease-out"
              />

              {/* Forecast with memories line: dashed amber — starts after historical finishes */}
              {hasMemoryLine && (
                <Line
                  key={`line-mem-${animKey}`}
                  type="monotone"
                  dataKey="forecastMemories"
                  stroke="#fbbf24"
                  strokeWidth={2.5}
                  strokeDasharray="6 3"
                  dot={({ key, ...props }: any) => <MemoryDot key={key} {...props} />}
                  connectNulls={false}
                  activeDot={{ r: 5, fill: '#fbbf24', stroke: '#fff', strokeWidth: 2 }}
                  legendType="none"
                  isAnimationActive={shouldAnimate}
                  animationBegin={FORECAST_DELAY}
                  animationDuration={FORECAST_DURATION}
                  animationEasing="ease-out"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend — centered below chart */}
        <div className="flex items-center justify-center gap-4 px-6 pt-2 pb-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-5 h-[3px] bg-blue-500 rounded-full" />
            <span className="theme-text-secondary">Actual</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <svg width="20" height="4">
              <line
                x1="0"
                y1="2"
                x2="20"
                y2="2"
                stroke="#f87171"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
            </svg>
            <span className="theme-text-secondary">Forecast</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div
              className="w-5 h-3 rounded-sm"
              style={{
                background: 'rgba(248, 113, 113, 0.15)',
                border: '1px dashed rgba(248, 113, 113, 0.4)',
              }}
            />
            <span className="theme-text-secondary">{assumptions.confidenceLevel}% CI</span>
          </div>
          {hasMemoryLine && (
            <div className="flex items-center gap-1.5 text-xs">
              <svg width="20" height="4">
                <line
                  x1="0"
                  y1="2"
                  x2="20"
                  y2="2"
                  stroke="#fbbf24"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
              </svg>
              <span className="theme-text-secondary">With Memories</span>
            </div>
          )}
          {hasMemoryMarkers && (
            <>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-emerald-500 font-bold text-sm">&#x2715;</span>
                <span className="theme-text-secondary">Income</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-red-500 font-bold text-sm">&#x2715;</span>
                <span className="theme-text-secondary">Expense</span>
              </div>
            </>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 @lg:grid-cols-4 gap-4 px-6 py-4">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider theme-text-secondary">Ending Cash</p>
            <p
              className={cn(
                'text-lg font-semibold',
                summary.projectedEndingCash >= 0 ? 'text-theme-green' : 'text-theme-red'
              )}
            >
              {formatCompactCurrency(summary.projectedEndingCash, currency)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider theme-text-secondary">Net Change</p>
            <p
              className={cn(
                'text-lg font-semibold',
                summary.netChange >= 0 ? 'text-theme-green' : 'text-theme-red'
              )}
            >
              {summary.netChange >= 0 ? '+' : ''}
              {formatCompactCurrency(summary.netChange, currency)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider theme-text-secondary">
              Lowest Point
            </p>
            <p
              className={cn(
                'text-lg font-semibold',
                summary.lowestCashPoint.amount >= 0 ? 'text-theme-yellow' : 'text-theme-red'
              )}
            >
              {formatCompactCurrency(summary.lowestCashPoint.amount, currency)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider theme-text-secondary">Cash Runway</p>
            <p
              className={cn(
                'text-lg font-semibold',
                summary.runway === null || summary.runway > 6
                  ? 'text-theme-green'
                  : summary.runway > 3
                    ? 'text-theme-yellow'
                    : 'text-theme-red'
              )}
            >
              {summary.runway === null
                ? '\u221E'
                : summary.runway > 12
                  ? '12+'
                  : Math.round(summary.runway)}{' '}
              mo
            </p>
          </div>
        </div>

        {/* Assumptions — horizontal sliders below chart */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span
              className="text-sm font-semibold theme-text-primary pb-1"
              style={{ borderBottom: '1px solid var(--theme-card-border)' }}
            >
              Assumptions
            </span>
            {hasCustomAssumptions && (
              <button
                onClick={onResetAssumptions}
                className="text-[10px] flex items-center gap-1 transition-colors"
                style={{ color: 'var(--theme-yellow)' }}
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
          </div>

          {/* Scenario Presets */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <span className="text-[10px] uppercase tracking-wider theme-text-secondary mr-2">
              Quick Scenarios:
            </span>
            {[
              {
                name: 'Conservative',
                inflow: 5,
                outflow: 15,
                growth: 5,
                color: 'blue',
                colorHex: '#3b82f6',
                description: 'Lower growth expectations, higher costs',
              },
              {
                name: 'Moderate',
                inflow: 15,
                outflow: 10,
                growth: 10,
                color: 'yellow',
                colorHex: 'var(--theme-yellow)',
                description: 'Balanced growth and cost assumptions',
              },
              {
                name: 'Aggressive',
                inflow: 30,
                outflow: 5,
                growth: 25,
                color: 'green',
                colorHex: '#10b981',
                description: 'Higher growth, lower cost increases',
              },
            ].map((preset) => {
              const isActive =
                assumptions.inflowGrowthRate === preset.inflow &&
                assumptions.outflowGrowthRate === preset.outflow
              return (
                <TooltipProvider key={preset.name} delayDuration={200}>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() =>
                          onAssumptionsChange({
                            ...assumptions,
                            growthRate: preset.growth,
                            inflowGrowthRate: preset.inflow,
                            outflowGrowthRate: preset.outflow,
                          })
                        }
                        className={cn(
                          'px-3 py-1.5 text-xs font-medium rounded-full border transition-all',
                          isActive
                            ? 'border-current bg-current/10'
                            : 'border-gray-500/30 hover:border-gray-400/50'
                        )}
                        style={{
                          color: isActive ? preset.colorHex : 'var(--theme-text-secondary)',
                        }}
                      >
                        {preset.name}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="text-xs"
                      style={{
                        background: 'var(--theme-card-bg)',
                        borderColor: 'var(--theme-card-border)',
                        backdropFilter: 'blur(24px)',
                      }}
                    >
                      <p className="font-medium mb-1" style={{ color: preset.colorHex }}>
                        {preset.name}
                      </p>
                      <p className="theme-text-secondary text-[10px] mb-1.5">
                        {preset.description}
                      </p>
                      <div className="flex gap-3 text-[10px]">
                        <span className="text-theme-green">+{preset.inflow}% inflow</span>
                        <span className="text-theme-red">+{preset.outflow}% outflow</span>
                      </div>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              )
            })}
          </div>
          <div className="grid grid-cols-2 @lg:grid-cols-4 gap-x-6 gap-y-5">
            <div className="flex flex-col justify-between">
              <div className="flex justify-between text-xs mb-2">
                <span className="theme-text-secondary font-medium">Growth Rate</span>
                <span className="font-mono font-semibold" style={{ color: 'var(--theme-yellow)' }}>
                  {assumptions.growthRate}%
                </span>
              </div>
              <Slider
                value={[assumptions.growthRate]}
                min={-50}
                max={100}
                step={1}
                onValueChange={([v]) =>
                  onAssumptionsChange({
                    ...assumptions,
                    growthRate: v,
                    inflowGrowthRate: v,
                    outflowGrowthRate: v,
                  })
                }
              />
            </div>
            <div className="flex flex-col justify-between">
              <div className="flex justify-between text-xs mb-2">
                <span className="theme-text-secondary font-medium">Inflow Growth</span>
                <span className="font-mono font-semibold text-theme-green">
                  {assumptions.inflowGrowthRate}%
                </span>
              </div>
              <Slider
                value={[assumptions.inflowGrowthRate]}
                min={-50}
                max={100}
                step={1}
                onValueChange={([v]) =>
                  onAssumptionsChange({ ...assumptions, inflowGrowthRate: v })
                }
              />
            </div>
            <div className="flex flex-col justify-between">
              <div className="flex justify-between text-xs mb-2">
                <span className="theme-text-secondary font-medium">Outflow Growth</span>
                <span className="font-mono font-semibold text-theme-red">
                  {assumptions.outflowGrowthRate}%
                </span>
              </div>
              <Slider
                value={[assumptions.outflowGrowthRate]}
                min={-50}
                max={100}
                step={1}
                onValueChange={([v]) =>
                  onAssumptionsChange({ ...assumptions, outflowGrowthRate: v })
                }
              />
            </div>
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-1 text-xs mb-2">
                <span className="theme-text-secondary font-medium">Rolling Average</span>
                <TooltipProvider delayDuration={200}>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 theme-text-secondary cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[240px] text-xs"
                      style={{
                        background: 'var(--theme-card-bg)',
                        borderColor: 'var(--theme-card-border)',
                        backdropFilter: 'blur(24px)',
                      }}
                    >
                      <p className="theme-text-primary font-medium mb-1">Lookback window</p>
                      <p className="theme-text-secondary">
                        How many days of historical data to average when projecting each line item.
                        Shorter windows react faster to recent trends. Longer windows smooth out
                        volatility.
                      </p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </div>
              <div className="flex gap-2">
                {([30, 60, 90] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => onAssumptionsChange({ ...assumptions, rollingAverageDays: d })}
                    className={cn(
                      'flex-1 text-xs py-1.5 rounded-md border transition-colors font-medium'
                    )}
                    style={{
                      borderColor:
                        assumptions.rollingAverageDays === d
                          ? 'rgba(var(--theme-yellow-rgb, 245, 158, 11), 0.5)'
                          : 'var(--theme-card-border)',
                      backgroundColor:
                        assumptions.rollingAverageDays === d
                          ? 'rgba(var(--theme-yellow-rgb, 245, 158, 11), 0.08)'
                          : 'transparent',
                      color:
                        assumptions.rollingAverageDays === d
                          ? 'var(--theme-yellow)'
                          : 'var(--theme-text-secondary)',
                    }}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Algorithm Selector */}
          <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--theme-card-border)' }}>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider theme-text-secondary mr-2">
                Algorithm:
              </span>
              {(Object.keys(ALGORITHM_INFO) as ForecastAlgorithm[]).map((algo) => {
                const info = ALGORITHM_INFO[algo]
                const isActive = assumptions.algorithm === algo
                return (
                  <TooltipProvider key={algo} delayDuration={200}>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onAssumptionsChange({ ...assumptions, algorithm: algo })}
                          className={cn(
                            'px-3 py-1.5 text-xs font-medium rounded-md border transition-all',
                            isActive
                              ? 'border-purple-500/50 bg-purple-500/10 text-purple-400'
                              : 'border-gray-500/30 hover:border-gray-400/50 theme-text-secondary'
                          )}
                        >
                          {info.name}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="max-w-[220px] text-xs"
                        style={{
                          background: 'var(--theme-card-bg)',
                          borderColor: 'var(--theme-card-border)',
                          backdropFilter: 'blur(24px)',
                        }}
                      >
                        <p className="theme-text-primary font-medium mb-1">{info.name}</p>
                        <p className="theme-text-secondary">{info.description}</p>
                      </TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                )
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
