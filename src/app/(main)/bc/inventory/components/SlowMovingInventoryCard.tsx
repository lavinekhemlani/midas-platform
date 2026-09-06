'use client'

import React, { useMemo } from 'react'
import { AlertTriangle, Clock, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from './InfoTooltip'

interface SlowMovingItem {
  item_no: string
  description: string
  inventory: number
  unit_cost: number
  inventory_value: number
  sales_qty: number
  purchases_qty: number
  turnover_ratio: number
  days_since_last_sale: number | null
}

interface SlowMovingSummary {
  totalItems: number
  totalValue: number
  zeroSalesCount: number
  zeroSalesValue: number
}

interface SlowMovingInventoryCardProps {
  data: SlowMovingItem[]
  summary?: SlowMovingSummary | null
  isLoading: boolean
  currency?: string
  tooltip?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
  onItemClick?: (itemNo: string) => void
  selectedItemNumber?: string | null
  renderItemDetail?: () => React.ReactNode
}

function getRiskLevel(
  daysSinceSale: number | null,
  isLight: boolean
): {
  label: string
  color: string
  barColor: string
  icon: React.ElementType
} {
  if (daysSinceSale === null) {
    return {
      label: 'No Sales',
      color: isLight ? 'text-red-600' : 'text-red-400',
      barColor: '#ef4444',
      icon: XCircle,
    }
  }
  if (daysSinceSale > 180) {
    return {
      label: 'Critical',
      color: isLight ? 'text-red-600' : 'text-red-400',
      barColor: '#ef4444',
      icon: AlertTriangle,
    }
  }
  if (daysSinceSale > 90) {
    return {
      label: 'High',
      color: 'text-orange-500',
      barColor: '#f97316',
      icon: AlertTriangle,
    }
  }
  return {
    label: 'Medium',
    color: 'text-amber-500',
    barColor: '#f59e0b',
    icon: Clock,
  }
}

export function SlowMovingInventoryCard({
  data,
  summary,
  isLoading,
  currency = 'USD',
  tooltip,
  tooltipProps,
  onItemClick,
  selectedItemNumber,
  renderItemDetail,
}: SlowMovingInventoryCardProps) {
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

  const totalAtRisk =
    summary?.totalValue ?? data.reduce((sum, item) => sum + item.inventory_value, 0)
  const zeroSalesItems =
    summary?.zeroSalesCount ??
    data.filter((item) => item.days_since_last_sale === null || item.sales_qty === 0).length

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
            Slow Moving Inventory
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <div
          className={cn('h-[200px] animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
        />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Slow Moving Inventory
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <div className="flex flex-col items-center py-8 gap-2">
          <Clock className={cn('w-6 h-6', isLight ? 'text-green-600' : 'text-green-400')} />
          <p className={cn('text-sm', styles.textMuted)}>No slow-moving inventory</p>
          <p className={cn('text-[14px]', styles.textMuted)}>All items have healthy turnover</p>
        </div>
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
            Slow Moving Inventory
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps ? (
            <InfoTooltip {...tooltipProps} />
          ) : tooltip ? (
            <InfoTooltip content={tooltip} />
          ) : null}
        </div>
        <span className={cn('text-[14px] font-mono', isLight ? 'text-red-600' : 'text-red-400')}>
          {formatCompactCurrency(totalAtRisk, currency)} at risk
        </span>
      </div>

      {/* Summary Row */}
      <div className={cn('py-2.5 px-2 -mx-2 mb-2', styles.rowBg)}>
        <div className="flex items-center justify-between text-[14px]">
          <div>
            <span className={styles.textMuted}>No Sales Items: </span>
            <span
              className={cn('font-mono font-semibold', isLight ? 'text-red-600' : 'text-red-400')}
            >
              {zeroSalesItems}
            </span>
          </div>
          <div>
            <span className={styles.textMuted}>Total Items: </span>
            <span className="font-mono font-semibold text-orange-500">
              {summary?.totalItems ?? data.length}
            </span>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className={cn('border-t pt-2 max-h-[320px] overflow-y-auto', styles.border)}>
        {data.map((item, index) => {
          const risk = getRiskLevel(item.days_since_last_sale, isLight)
          const RiskIcon = risk.icon

          return (
            <React.Fragment key={item.item_no}>
              <div
                className={cn(
                  'flex items-center justify-between py-2 px-2 -mx-2 text-[14px]',
                  index % 2 === 0 && styles.rowBg,
                  onItemClick && 'cursor-pointer hover:opacity-80 transition-opacity'
                )}
                onClick={() => onItemClick?.(item.item_no)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="w-2 h-2 flex-shrink-0"
                    style={{ backgroundColor: risk.barColor }}
                  />
                  <span
                    className={cn('truncate', isLight ? 'text-stone-700' : 'text-stone-300')}
                    title={`${item.item_no} - ${item.description}`}
                  >
                    <span className={cn('font-mono', styles.textMuted)}>{item.item_no}</span>
                    {' · '}
                    {item.description}
                  </span>
                </div>
                <span className={cn('text-[14px] font-mono tabular-nums', styles.text)}>
                  {formatCompactCurrency(item.inventory_value, currency)}
                </span>
              </div>
              {item.item_no === selectedItemNumber && renderItemDetail?.()}
            </React.Fragment>
          )
        })}
      </div>

      {/* Legend */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-center gap-x-6 gap-y-1 pt-6 text-[14px]',
          styles.textMuted
        )}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-red-500" />
          <span>No sales in 6+ months</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-orange-500" />
          <span>No sales in 3-6 months</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-amber-500" />
          <span>No sales in 2-3 months</span>
        </div>
      </div>
    </div>
  )
}
