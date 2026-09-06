'use client'

import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from '@/components/ui/InfoTooltip'
import type {
  InventorySummary,
  InventoryItem,
} from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'

interface InventoryDashboardCardProps {
  summary: InventorySummary | null
  items: InventoryItem[]
  isLoading: boolean
  currency?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

export function InventoryDashboardCard({
  summary,
  items,
  isLoading,
  currency = 'USD',
  tooltipProps,
}: InventoryDashboardCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
    }),
    [isLight]
  )

  const topItems = items.slice(0, 5)
  const maxValue =
    topItems.length > 0 ? Math.max(...topItems.map((i) => Number(i.inventory_value))) : 0

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Inventory
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        <div className={cn('h-16 animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')} />
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={cn('h-8 animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
          />
        ))}
      </div>
    )
  }

  if (!summary) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Inventory
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No inventory data</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Inventory
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps && <InfoTooltip {...tooltipProps} />}
        </div>
        <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className={cn('py-2.5 px-2', isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]')}>
          <div className={cn('text-[12px] uppercase tracking-wider mb-0.5', styles.textMuted)}>
            Items in Stock
          </div>
          <div className="text-[28px] font-mono font-semibold tabular-nums text-orange-500">
            {summary.items_with_stock}
          </div>
        </div>
        <div className={cn('py-2.5 px-2', isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]')}>
          <div className={cn('text-[12px] uppercase tracking-wider mb-0.5', styles.textMuted)}>
            Total Value
          </div>
          <div
            className={cn(
              'text-[28px] font-mono font-semibold tabular-nums',
              isLight ? 'text-blue-600' : 'text-blue-400'
            )}
          >
            {formatCompactCurrency(summary.total_inventory_value, currency)}
          </div>
        </div>
      </div>

      {/* Top Items by Value */}
      {topItems.length > 0 && (
        <div className={cn('pt-3 border-t', styles.border)}>
          <div className={cn('text-[12px] uppercase tracking-wider mb-2', styles.textMuted)}>
            Top Items by Value
          </div>
          <div className="space-y-2">
            {topItems.map((item) => {
              const value = Number(item.inventory_value)
              const barWidth = maxValue > 0 ? Math.max(8, (value / maxValue) * 100) : 0
              return (
                <div key={item.item_no} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-sm theme-text-secondary truncate flex-1"
                      title={item.description}
                    >
                      {item.description.length > 25
                        ? item.description.substring(0, 25) + '...'
                        : item.description}
                    </span>
                    <span className="text-base font-mono font-semibold tabular-nums theme-text-primary whitespace-nowrap">
                      {formatCompactCurrency(value, currency)}
                    </span>
                  </div>
                  <div className={cn('w-full h-1.5', isLight ? 'bg-stone-100' : 'bg-white/[0.04]')}>
                    <div
                      className="h-full bg-orange-500/60 transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
