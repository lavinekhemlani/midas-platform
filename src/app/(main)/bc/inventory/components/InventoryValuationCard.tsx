'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from './InfoTooltip'

interface ValuationRow {
  item_no: string
  description: string
  inventory: number
  unit_cost: number
  standard_cost: number
  last_direct_cost: number
  inventory_value: number
  costing_method: string
}

interface ValuationSummary {
  total_items: number
  total_units: number
  total_value_at_unit_cost: number
  total_value_at_standard_cost: number
  total_value_at_last_direct_cost: number
}

interface InventoryValuationCardProps {
  data: ValuationRow[]
  summary: ValuationSummary | null
  isLoading: boolean
  currency?: string
  tooltip?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

const COSTING_METHOD_COLORS: Record<string, string> = {
  FIFO: '#3b82f6',
  LIFO: '#8b5cf6',
  Average: '#10b981',
  Standard: '#f59e0b',
  Specific: '#06b6d4',
}

function getVarianceIndicator(
  variance: number,
  isLight: boolean
): {
  icon: React.ElementType
  color: string
  barColor: string
  label: string
} {
  if (variance > 0) {
    return {
      icon: TrendingUp,
      color: isLight ? 'text-red-600' : 'text-red-400',
      barColor: '#ef4444',
      label: 'Over standard',
    }
  }
  if (variance < 0) {
    return {
      icon: TrendingDown,
      color: isLight ? 'text-green-600' : 'text-green-400',
      barColor: '#10b981',
      label: 'Under standard',
    }
  }
  return {
    icon: Minus,
    color: isLight ? 'text-blue-600' : 'text-blue-400',
    barColor: '#3b82f6',
    label: 'On target',
  }
}

export function InventoryValuationCard({
  data,
  summary,
  isLoading,
  currency = 'USD',
  tooltip,
  tooltipProps,
}: InventoryValuationCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      rowBg: isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]',
    }),
    [isLight]
  )

  const variance = summary
    ? summary.total_value_at_unit_cost - summary.total_value_at_standard_cost
    : 0
  const variancePercentage =
    summary && summary.total_value_at_standard_cost > 0
      ? (variance / summary.total_value_at_standard_cost) * 100
      : 0

  const varianceInfo = summary ? getVarianceIndicator(variance, isLight) : null
  const VarianceIcon = varianceInfo?.icon || Minus

  const costingMethodBreakdown = useMemo(() => {
    if (!data || data.length === 0) return []

    const grouped: Record<string, { method: string; value: number; item_count: number }> = {}
    data.forEach((item) => {
      const method = item.costing_method || 'Unknown'
      if (!grouped[method]) {
        grouped[method] = { method, value: 0, item_count: 0 }
      }
      grouped[method].value += item.inventory_value
      grouped[method].item_count += 1
    })

    return Object.values(grouped).sort((a, b) => b.value - a.value)
  }, [data])

  const totalMethodValue = costingMethodBreakdown.reduce((sum, m) => sum + m.value, 0)

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Inventory Valuation
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <div
          className={cn('h-[200px] animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
        />
      </div>
    )
  }

  if (!summary) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Inventory Valuation
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No valuation data available</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Inventory Valuation
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps ? (
            <InfoTooltip {...tooltipProps} />
          ) : (
            <InfoTooltip
              content={
                tooltip ||
                'Compares inventory value across costing methods (unit cost, standard cost, last direct cost) and shows the variance between them.'
              }
            />
          )}
        </div>
      </div>

      {/* Valuation Summary */}
      <div className={cn('py-2.5 px-2 -mx-2', styles.rowBg)}>
        <div className="flex items-center justify-between text-xs">
          <span className={isLight ? 'text-stone-700' : 'text-stone-300'}>Standard Cost</span>
          <span className="font-mono font-semibold tabular-nums text-amber-500">
            {formatCompactCurrency(summary.total_value_at_standard_cost, currency)}
          </span>
        </div>
      </div>
      <div className="py-2.5 px-2 -mx-2">
        <div className="flex items-center justify-between text-xs">
          <span className={isLight ? 'text-stone-700' : 'text-stone-300'}>Unit Cost</span>
          <span
            className={cn(
              'font-mono font-semibold tabular-nums',
              isLight ? 'text-blue-600' : 'text-blue-400'
            )}
          >
            {formatCompactCurrency(summary.total_value_at_unit_cost, currency)}
          </span>
        </div>
      </div>

      {/* Variance */}
      <div className={cn('py-2.5 px-2 -mx-2', styles.rowBg)}>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <VarianceIcon className={cn('w-3.5 h-3.5', varianceInfo?.color)} />
            <div>
              <span className={isLight ? 'text-stone-700' : 'text-stone-300'}>Cost Variance</span>
              <span className={cn('text-[10px] ml-2', styles.textMuted)}>
                {varianceInfo?.label}
              </span>
            </div>
          </div>
          <span className={cn('font-mono font-semibold tabular-nums', varianceInfo?.color)}>
            {variance >= 0 ? '+' : ''}
            {formatCompactCurrency(variance, currency)} ({variancePercentage >= 0 ? '+' : ''}
            {variancePercentage.toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Costing Method Breakdown */}
      {costingMethodBreakdown.length > 0 && (
        <div className={cn('border-t pt-2 mt-2', styles.border)}>
          <div className={cn('text-[10px] uppercase tracking-wider mb-2', styles.textMuted)}>
            By Costing Method
          </div>
          {costingMethodBreakdown.map((method, index) => {
            const barColor = COSTING_METHOD_COLORS[method.method] || '#6b7280'
            const percentage = totalMethodValue > 0 ? (method.value / totalMethodValue) * 100 : 0

            return (
              <div
                key={method.method}
                className={cn(
                  'flex items-center justify-between py-1.5 px-2 -mx-2 text-xs',
                  index % 2 === 0 && styles.rowBg
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium" style={{ color: barColor }}>
                    {method.method}
                  </span>
                  <span className={styles.textMuted}>({method.item_count} items)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-medium px-1 py-0.5"
                    style={{ color: barColor, backgroundColor: `${barColor}15` }}
                  >
                    {percentage.toFixed(1)}%
                  </span>
                  <span className={cn('font-mono font-semibold tabular-nums', styles.text)}>
                    {formatCompactCurrency(method.value, currency)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
