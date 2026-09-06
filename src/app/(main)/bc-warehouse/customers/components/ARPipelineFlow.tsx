'use client'

import { useMemo } from 'react'
import { ShoppingCart, Truck, FileText, ArrowRight, TrendingUp, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { OutstandingOrdersSummary } from '../hooks/useCustomerInsights'

interface ARPipelineFlowProps {
  data: OutstandingOrdersSummary | null
  isLoading: boolean
  currency?: string
}

interface PipelineStage {
  id: string
  label: string
  sublabel: string
  icon: React.ElementType
  value: number
  customerCount?: number
  color: string
  gradientFrom: string
  gradientTo: string
}

function PipelineStageCard({
  stage,
  totalValue,
  isLight,
  currency,
  isLast,
}: {
  stage: PipelineStage
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

          {/* Customer count if available */}
          {stage.customerCount !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              <Users className={cn('w-3 h-3', isLight ? 'text-stone-400' : 'text-stone-500')} />
              <span className={cn('text-[10px]', isLight ? 'text-stone-500' : 'text-stone-500')}>
                {stage.customerCount} customers
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
            {percentage.toFixed(1)}% of pipeline
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
        {[...Array(3)].map((_, i) => (
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

export function ARPipelineFlow({ data, isLoading, currency = 'USD' }: ARPipelineFlowProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const stages: PipelineStage[] = useMemo(() => {
    if (!data) return []

    return [
      {
        id: 'orders',
        label: 'Open Orders',
        sublabel: 'Awaiting fulfillment',
        icon: ShoppingCart,
        value: data.total_outstanding_orders,
        customerCount: data.customers_with_orders,
        color: '#3b82f6',
        gradientFrom: '#3b82f6',
        gradientTo: '#6366f1',
      },
      {
        id: 'shipped',
        label: 'Shipped',
        sublabel: 'Ready to invoice',
        icon: Truck,
        value: data.total_shipped_not_invoiced,
        color: '#f59e0b',
        gradientFrom: '#f59e0b',
        gradientTo: '#f97316',
      },
      {
        id: 'invoiced',
        label: 'Open Invoices',
        sublabel: 'Awaiting payment',
        icon: FileText,
        value: data.total_outstanding_invoices,
        customerCount: data.customers_with_invoices,
        color: '#10b981',
        gradientFrom: '#10b981',
        gradientTo: '#14b8a6',
      },
    ]
  }, [data])

  const totalPipeline = useMemo(() => {
    if (!data) return 0
    return (
      data.total_outstanding_orders +
      data.total_shipped_not_invoiced +
      data.total_outstanding_invoices
    )
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
            <TrendingUp className="w-5 h-5 text-blue-500" />
            AR Pipeline
          </h3>
          <p className={cn('text-xs', isLight ? 'text-stone-500' : 'text-stone-400')}>
            Order-to-cash workflow progression
          </p>
        </div>
        {!isLoading && data && (
          <div
            className={cn(
              'px-4 py-2 rounded-xl border',
              isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-500/10 border-blue-500/20'
            )}
          >
            <span
              className={cn(
                'text-[10px] uppercase tracking-wider font-medium block',
                isLight ? 'text-blue-600' : 'text-blue-400'
              )}
            >
              Total Pipeline
            </span>
            <span
              className={cn(
                'text-lg font-bold tabular-nums',
                isLight ? 'text-blue-700' : 'text-blue-400'
              )}
            >
              {formatCompactCurrency(totalPipeline, currency)}
            </span>
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
              <PipelineStageCard
                key={stage.id}
                stage={stage}
                totalValue={totalPipeline}
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
              const width = totalPipeline > 0 ? (stage.value / totalPipeline) * 100 : 0
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
            No pipeline data available
          </p>
        </div>
      )}
    </div>
  )
}
