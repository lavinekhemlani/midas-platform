'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from './InfoTooltip'

interface InventoryOverviewCardProps {
  data: {
    total_items: number
    items_with_stock: number
    total_inventory_value: number
    total_units_on_hand: number
    average_unit_cost: number
  } | null
  isLoading: boolean
  currency?: string
  className?: string
  tooltip?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

export function InventoryOverviewCard({
  data,
  isLoading,
  currency = 'USD',
  className,
  tooltip,
  tooltipProps,
}: InventoryOverviewCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
    }),
    [isLight]
  )

  const stockPercentage =
    data && data.total_items > 0
      ? ((data.items_with_stock / data.total_items) * 100).toFixed(1)
      : '0'

  if (isLoading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-1.5 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Inventory Overview
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={cn('h-[72px] animate-pulse rounded-lg', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')} />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className={className}>
        <div className="flex items-center gap-1.5 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Inventory Overview
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No inventory data available</p>
      </div>
    )
  }

  const metrics = [
    {
      label: 'Total Items',
      value: data.total_items.toLocaleString(),
      subValue: `${stockPercentage}% with stock`,
      color: 'text-orange-500',
    },
    {
      label: 'Items with Stock',
      value: data.items_with_stock.toLocaleString(),
      subValue: 'Active SKUs',
      color: isLight ? 'text-blue-600' : 'text-blue-400',
    },
    {
      label: 'Total Value',
      value: formatCompactCurrency(data.total_inventory_value, currency),
      subValue: 'Inventory at cost',
      color: isLight ? 'text-green-600' : 'text-green-400',
    },
    {
      label: 'Total Units',
      value: data.total_units_on_hand.toLocaleString(),
      subValue: 'Quantity on hand',
      color: 'text-purple-500',
    },
    {
      label: 'Avg Unit Cost',
      value: formatCompactCurrency(data.average_unit_cost, currency),
      subValue: 'Weighted average',
      color: 'text-amber-500',
    },
  ]

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-5">
        <span
          className={cn(
            'relative text-base font-normal uppercase tracking-wider',
            isLight ? 'text-stone-800' : 'text-stone-300'
          )}
        >
          Inventory Overview
          <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
        </span>
        {tooltipProps ? (
          <InfoTooltip {...tooltipProps} />
        ) : tooltip ? (
          <InfoTooltip content={tooltip} />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 pb-8">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className={cn(
              'p-3',
              isLight ? 'bg-stone-200/40' : 'bg-white/[0.03]'
            )}
          >
            <div className={cn('text-[12px] uppercase tracking-wider font-medium mb-1', styles.textMuted)}>
              {metric.label}
            </div>
            <div className={cn('text-[20px] font-mono font-semibold tabular-nums leading-tight', metric.color)}>
              {metric.value}
            </div>
            <div className={cn('text-[12px] mt-0.5', styles.textMuted)}>{metric.subValue}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
