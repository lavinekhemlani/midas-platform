'use client'

import { useMemo } from 'react'
import { Receipt, Clock, AlertTriangle, ArrowRight, TrendingDown, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { OutstandingPayablesSummary } from '../hooks/useVendorInsights'

interface APPayablesFlowProps {
  data: OutstandingPayablesSummary | null
  isLoading: boolean
  currency?: string
}

interface PayableStage {
  id: string
  label: string
  sublabel: string
  icon: React.ElementType
  value: number
  vendorCount?: number
  color: string
  gradientFrom: string
  gradientTo: string
}

function PayableStageCard({
  stage,
  totalValue,
  isLight,
  currency,
  isLast,
}: {
  stage: PayableStage
  totalValue: number
  isLight: boolean
  currency: string
  isLast: boolean
}) {
  const Icon = stage.icon
  const percentage = totalValue > 0 ? (stage.value / totalValue) * 100 : 0

  return (
    <div className="flex items-center flex-1">
      <div
        className={cn(
          'relative flex-1 rounded-2xl p-4 transition-all duration-300 group overflow-hidden',
          isLight
            ? 'bg-white border border-stone-200/60 shadow-sm hover:shadow-md'
            : 'bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.12]'
        )}
      >
        {/* Gradient background accent */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `linear-gradient(135deg, ${stage.gradientFrom}10, ${stage.gradientTo}05)`,
          }}
        />

        {/* Top bar indicator */}
        <div
          className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
          style={{
            background: `linear-gradient(90deg, ${stage.gradientFrom}, ${stage.gradientTo})`,
          }}
        />

        <div className="relative">
          {/* Icon */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
            style={{
              background: `linear-gradient(135deg, ${stage.gradientFrom}, ${stage.gradientTo})`,
            }}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>

          {/* Label */}
          <div
            className={cn(
              'text-xs font-semibold uppercase tracking-wider mb-1',
              isLight ? 'text-stone-500' : 'text-stone-400'
            )}
          >
            {stage.label}
          </div>

          {/* Value */}
          <div
            className={cn(
              'text-2xl font-bold tabular-nums tracking-tight',
              isLight ? 'text-stone-900' : 'text-white'
            )}
          >
            {formatCompactCurrency(stage.value, currency)}
          </div>

          {/* Sublabel */}
          <div className={cn('text-[11px] mt-1', isLight ? 'text-stone-500' : 'text-stone-500')}>
            {stage.sublabel}
          </div>

          {/* Vendor count if available */}
          {stage.vendorCount !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              <Building2 className={cn('w-3 h-3', isLight ? 'text-stone-400' : 'text-stone-500')} />
              <span className={cn('text-[10px]', isLight ? 'text-stone-500' : 'text-stone-500')}>
                {stage.vendorCount} vendors
              </span>
            </div>
          )}

          {/* Percentage bar */}
          <div
            className={cn(
              'mt-3 h-1.5 rounded-full overflow-hidden',
              isLight ? 'bg-stone-100' : 'bg-white/[0.06]'
            )}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${percentage}%`,
                background: `linear-gradient(90deg, ${stage.gradientFrom}, ${stage.gradientTo})`,
              }}
            />
          </div>
          <div
            className={cn(
              'text-[10px] mt-1 tabular-nums',
              isLight ? 'text-stone-500' : 'text-stone-500'
            )}
          >
            {percentage.toFixed(1)}% of total
          </div>
        </div>
      </div>

      {/* Arrow connector */}
      {!isLast && (
        <div className={cn('flex-shrink-0 mx-2', isLight ? 'text-stone-300' : 'text-stone-600')}>
          <ArrowRight className="w-5 h-5" />
        </div>
      )}
    </div>
  )
}

function SkeletonLoader({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 rounded-2xl p-4 animate-pulse',
              isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
            )}
          >
            <div
              className={cn('w-12 h-12 rounded-xl mb-3', isLight ? 'bg-stone-200' : 'bg-white/10')}
            />
            <div
              className={cn('h-3 w-16 rounded mb-2', isLight ? 'bg-stone-200' : 'bg-white/10')}
            />
            <div
              className={cn('h-6 w-24 rounded mb-2', isLight ? 'bg-stone-200' : 'bg-white/10')}
            />
            <div className={cn('h-2 w-20 rounded', isLight ? 'bg-stone-200' : 'bg-white/10')} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function APPayablesFlow({ data, isLoading, currency = 'USD' }: APPayablesFlowProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  // Calculate current (non-overdue) portion
  const currentAP = useMemo(() => {
    if (!data) return 0
    return Math.max(0, data.total_outstanding_ap - data.total_overdue_ap)
  }, [data])

  const stages: PayableStage[] = useMemo(() => {
    if (!data) return []

    return [
      {
        id: 'current',
        label: 'Current AP',
        sublabel: 'Not yet due',
        icon: Receipt,
        value: currentAP,
        vendorCount: data.vendors_with_balance,
        color: '#10b981',
        gradientFrom: '#10b981',
        gradientTo: '#14b8a6',
      },
      {
        id: 'overdue',
        label: 'Overdue AP',
        sublabel: 'Past due date',
        icon: AlertTriangle,
        value: data.total_overdue_ap,
        vendorCount: data.vendors_with_overdue,
        color: '#ef4444',
        gradientFrom: '#ef4444',
        gradientTo: '#f97316',
      },
    ]
  }, [data, currentAP])

  const totalPayables = useMemo(() => {
    if (!data) return 0
    return data.total_outstanding_ap
  }, [data])

  const overduePercentage = useMemo(() => {
    if (!data || data.total_outstanding_ap === 0) return 0
    return (data.total_overdue_ap / data.total_outstanding_ap) * 100
  }, [data])

  const styles = useMemo(
    () => ({
      card: isLight
        ? 'bg-gradient-to-br from-white via-white to-stone-50/30 border-stone-200/60 shadow-sm'
        : 'bg-gradient-to-br from-white/[0.03] via-white/[0.02] to-transparent border-white/[0.06]',
    }),
    [isLight]
  )

  return (
    <div className={cn('rounded-2xl border p-5 transition-all duration-300', styles.card)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3
            className={cn(
              'text-base font-semibold flex items-center gap-2',
              isLight ? 'text-stone-900' : 'text-white'
            )}
          >
            <TrendingDown className="w-5 h-5 text-orange-500" />
            AP Status
          </h3>
          <p className={cn('text-xs', isLight ? 'text-stone-500' : 'text-stone-400')}>
            Accounts payable aging breakdown
          </p>
        </div>
        {!isLoading && data && (
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'px-4 py-2 rounded-xl border',
                isLight ? 'bg-stone-50 border-stone-200' : 'bg-white/[0.04] border-white/[0.08]'
              )}
            >
              <span
                className={cn(
                  'text-[10px] uppercase tracking-wider font-medium block',
                  isLight ? 'text-stone-500' : 'text-stone-500'
                )}
              >
                Total AP
              </span>
              <span
                className={cn(
                  'text-lg font-bold tabular-nums',
                  isLight ? 'text-stone-800' : 'text-white'
                )}
              >
                {formatCompactCurrency(totalPayables, currency)}
              </span>
            </div>
            <div
              className={cn(
                'px-4 py-2 rounded-xl border',
                overduePercentage > 30
                  ? isLight
                    ? 'bg-red-50 border-red-200'
                    : 'bg-red-500/10 border-red-500/20'
                  : overduePercentage > 15
                    ? isLight
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-amber-500/10 border-amber-500/20'
                    : isLight
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-emerald-500/10 border-emerald-500/20'
              )}
            >
              <span
                className={cn(
                  'text-[10px] uppercase tracking-wider font-medium block',
                  overduePercentage > 30
                    ? isLight
                      ? 'text-red-600'
                      : 'text-red-400'
                    : overduePercentage > 15
                      ? isLight
                        ? 'text-amber-600'
                        : 'text-amber-400'
                      : isLight
                        ? 'text-emerald-600'
                        : 'text-emerald-400'
                )}
              >
                Overdue Ratio
              </span>
              <span
                className={cn(
                  'text-lg font-bold tabular-nums',
                  overduePercentage > 30
                    ? isLight
                      ? 'text-red-700'
                      : 'text-red-400'
                    : overduePercentage > 15
                      ? isLight
                        ? 'text-amber-700'
                        : 'text-amber-400'
                      : isLight
                        ? 'text-emerald-700'
                        : 'text-emerald-400'
                )}
              >
                {overduePercentage.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <SkeletonLoader isLight={isLight} />
      ) : data ? (
        <div className="space-y-5">
          {/* Pipeline Flow */}
          <div className="flex items-stretch gap-0">
            {stages.map((stage, i) => (
              <PayableStageCard
                key={stage.id}
                stage={stage}
                totalValue={totalPayables}
                isLight={isLight}
                currency={currency}
                isLast={i === stages.length - 1}
              />
            ))}
          </div>

          {/* Flow Visualization */}
          <div
            className={cn(
              'relative h-8 rounded-full overflow-hidden flex',
              isLight ? 'bg-stone-100' : 'bg-white/[0.04]'
            )}
          >
            {stages.map((stage, i) => {
              const width = totalPayables > 0 ? (stage.value / totalPayables) * 100 : 0
              return (
                <div
                  key={stage.id}
                  className="h-full transition-all duration-700 relative group"
                  style={{
                    width: `${width}%`,
                    background: `linear-gradient(90deg, ${stage.gradientFrom}, ${stage.gradientTo})`,
                  }}
                >
                  {/* Tooltip on hover */}
                  <div
                    className={cn(
                      'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-xs',
                      'opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none',
                      isLight ? 'bg-stone-800 text-white' : 'bg-white text-stone-900'
                    )}
                  >
                    {stage.label}: {formatCompactCurrency(stage.value, currency)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6">
            {stages.map((stage) => (
              <div key={stage.id} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${stage.gradientFrom}, ${stage.gradientTo})`,
                  }}
                />
                <span className={cn('text-xs', isLight ? 'text-stone-600' : 'text-stone-400')}>
                  {stage.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-48">
          <p className={cn('text-sm', isLight ? 'text-stone-500' : 'text-stone-400')}>
            No payables data available
          </p>
        </div>
      )}
    </div>
  )
}
