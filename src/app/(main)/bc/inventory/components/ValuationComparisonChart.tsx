'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { InventoryValuationSummary } from '../hooks/useInventoryData'

interface ValuationComparisonChartProps {
  summary: InventoryValuationSummary | null
  isLoading: boolean
  currency?: string
}

const valuationConfig = {
  unitCost: {
    label: 'Unit Cost',
    color: '#3b82f6',
    lightColor: '#2563eb',
    description: 'Current carrying value',
  },
  standardCost: {
    label: 'Standard Cost',
    color: '#8b5cf6',
    lightColor: '#7c3aed',
    description: 'Target cost baseline',
  },
  lastDirectCost: {
    label: 'Last Direct',
    color: '#06b6d4',
    lightColor: '#0891b2',
    description: 'Most recent purchase cost',
  },
}

function Skeleton({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div
            className={cn(
              'w-20 h-4 animate-pulse rounded',
              isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
            )}
          />
          <div
            className={cn(
              'flex-1 h-6 animate-pulse rounded',
              isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
            )}
          />
          <div
            className={cn(
              'w-20 h-4 animate-pulse rounded',
              isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
            )}
          />
        </div>
      ))}
    </div>
  )
}

export function ValuationComparisonChart({
  summary,
  isLoading,
  currency = 'USD',
}: ValuationComparisonChartProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  // Prepare data for visualization
  const valuationData = useMemo(() => {
    if (!summary) return []

    return [
      {
        key: 'unitCost',
        value: summary.total_value_at_unit_cost,
        config: valuationConfig.unitCost,
      },
      {
        key: 'standardCost',
        value: summary.total_value_at_standard_cost,
        config: valuationConfig.standardCost,
      },
      {
        key: 'lastDirectCost',
        value: summary.total_value_at_last_direct_cost,
        config: valuationConfig.lastDirectCost,
      },
    ].filter((d) => d.value > 0)
  }, [summary])

  // Calculate max for bar scaling
  const maxValue = useMemo(() => {
    return Math.max(...valuationData.map((d) => d.value), 1)
  }, [valuationData])

  // Calculate variance
  const variance = useMemo(() => {
    if (!summary) return null
    const diff = summary.total_value_at_unit_cost - summary.total_value_at_standard_cost
    const pct =
      summary.total_value_at_standard_cost > 0
        ? (diff / summary.total_value_at_standard_cost) * 100
        : 0
    return { amount: diff, percentage: pct }
  }, [summary])

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      barBg: isLight ? 'bg-stone-300' : 'bg-white/[0.10]',
    }),
    [isLight]
  )

  if (isLoading) return <Skeleton isLight={isLight} />

  if (!summary || valuationData.length === 0) {
    return <div className={cn('py-6 text-center text-sm', styles.textMuted)}>No valuation data</div>
  }

  return (
    <div>
      {/* Summary header */}
      <div className={cn('flex gap-6 pb-3 mb-4 border-b text-xs', styles.border)}>
        <div>
          <span className={styles.textMuted}>Items </span>
          <span className={cn('font-mono font-medium', styles.text)}>
            {summary.total_items.toLocaleString()}
          </span>
        </div>
        <div>
          <span className={styles.textMuted}>Units </span>
          <span className={cn('font-mono font-medium', styles.text)}>
            {summary.total_units.toLocaleString()}
          </span>
        </div>
        {variance && variance.amount !== 0 && (
          <div>
            <span className={styles.textMuted}>Variance </span>
            <span
              className={cn(
                'font-mono font-medium',
                variance.amount > 0
                  ? isLight
                    ? 'text-red-600'
                    : 'text-red-400'
                  : isLight
                    ? 'text-green-600'
                    : 'text-green-400'
              )}
            >
              {variance.amount > 0 ? '+' : ''}
              {variance.percentage.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Horizontal comparison bars */}
      <div className="space-y-3">
        {valuationData.map((item) => {
          const barWidth = (item.value / maxValue) * 100
          const config = item.config

          return (
            <div key={item.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: isLight ? config.lightColor : config.color }}
                  />
                  <span className={cn('font-medium', styles.text)}>{config.label}</span>
                </div>
                <span className={cn('font-mono tabular-nums font-semibold', styles.text)}>
                  {formatCompactCurrency(item.value, currency)}
                </span>
              </div>
              <div className={cn('h-5 relative', styles.barBg)}>
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${Math.max(barWidth, 2)}%`,
                    backgroundColor: isLight ? config.lightColor : config.color,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Variance indicator */}
      {variance && variance.amount !== 0 && (
        <div className={cn('mt-4 pt-3 border-t', styles.border)}>
          <div className="flex items-center justify-between text-xs">
            <span className={styles.textMuted}>Unit vs Standard Cost Variance</span>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'font-mono tabular-nums font-bold',
                  variance.amount > 0
                    ? isLight
                      ? 'text-red-600'
                      : 'text-red-400'
                    : isLight
                      ? 'text-green-600'
                      : 'text-green-400'
                )}
              >
                {variance.amount > 0 ? '+' : ''}
                {formatCompactCurrency(variance.amount, currency)}
              </span>
              <span
                className="text-[10px] font-mono px-1.5 py-0.5"
                style={{
                  color:
                    variance.amount > 0
                      ? isLight
                        ? '#dc2626'
                        : '#f87171'
                      : isLight
                        ? '#16a34a'
                        : '#4ade80',
                  backgroundColor:
                    variance.amount > 0
                      ? isLight
                        ? '#fef2f2'
                        : 'rgba(239, 68, 68, 0.15)'
                      : isLight
                        ? '#f0fdf4'
                        : 'rgba(34, 197, 94, 0.15)',
                }}
              >
                {variance.amount > 0 ? 'OVER' : 'UNDER'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
