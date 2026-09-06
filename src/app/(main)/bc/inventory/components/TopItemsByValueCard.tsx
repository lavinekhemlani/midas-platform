'use client'

import React, { useMemo } from 'react'

import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from './InfoTooltip'

interface InventoryItem {
  item_no: string
  description: string
  inventory: number
  unit_cost: number
  inventory_value: number
  item_category_code: string
  percentage: number
}

interface TopItemsByValueCardProps {
  data: InventoryItem[]
  totalValue?: number
  isLoading: boolean
  currency?: string
  tooltip?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
  onItemClick?: (itemNo: string) => void
  selectedItemNumber?: string | null
  renderItemDetail?: () => React.ReactNode
}

export function TopItemsByValueCard({
  data,
  totalValue: propTotalValue,
  isLoading,
  currency = 'USD',
  tooltip,
  tooltipProps,
  onItemClick,
  selectedItemNumber,
  renderItemDetail,
}: TopItemsByValueCardProps) {
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

  const maxValue = data.length > 0 ? Math.max(...data.map((i) => i.inventory_value)) : 0
  const totalValue = propTotalValue ?? data.reduce((sum, i) => sum + i.inventory_value, 0)

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
            Top Items by Value
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
            Top Items by Value
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No inventory items available</p>
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
            Top Items by Value
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps ? (
            <InfoTooltip {...tooltipProps} />
          ) : tooltip ? (
            <InfoTooltip content={tooltip} />
          ) : null}
        </div>
        <span className={cn('text-xs font-mono', styles.textMuted)}>
          {formatCompactCurrency(totalValue, currency)}
        </span>
      </div>

      {/* Items List */}
      <div className={cn('border-t pt-2', styles.border)}>
        {data.slice(0, 10).map((item, index) => {
          const barWidth = maxValue > 0 ? Math.max(8, (item.inventory_value / maxValue) * 100) : 0

          return (
            <React.Fragment key={item.item_no}>
              <div
                className={cn(
                  'py-2 px-2 -mx-2 transition-colors duration-150',
                  index % 2 === 0 && styles.rowBg,
                  onItemClick &&
                    cn(
                      'cursor-pointer',
                      isLight ? 'hover:bg-stone-200/80' : 'hover:bg-white/[0.06]'
                    )
                )}
                onClick={() => onItemClick?.(item.item_no)}
              >
                <div className="flex items-center justify-between gap-2 text-xs mb-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span
                      className={cn(
                        'text-[10px] font-mono flex-shrink-0',
                        isLight ? 'text-emerald-600' : 'text-emerald-400'
                      )}
                    >
                      #{index + 1}
                    </span>
                    <span
                      className={cn('truncate', isLight ? 'text-stone-700' : 'text-stone-300')}
                      title={`${item.item_no} - ${item.description}`}
                    >
                      <span className={cn('font-mono', styles.textMuted)}>{item.item_no}</span>
                      {' · '}
                      {item.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={styles.textMuted}>
                      {item.inventory.toLocaleString()} units
                    </span>
                    <span className={cn('font-mono font-semibold tabular-nums', styles.text)}>
                      {formatCompactCurrency(item.inventory_value, currency)}
                    </span>
                  </div>
                </div>
                <div className={cn('h-1 w-full', isLight ? 'bg-stone-300' : 'bg-white/[0.10]')}>
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: isLight ? '#059669' : '#10b981',
                    }}
                  />
                </div>
              </div>
              {item.item_no === selectedItemNumber && renderItemDetail?.()}
            </React.Fragment>
          )
        })}
      </div>

      {/* Summary */}
      <div className={cn('flex items-center justify-between pt-2 text-[10px]', styles.textMuted)}>
        <span>
          Top {Math.min(data.length, 10)} of {data.length} items
        </span>
        <span>Avg: {formatCompactCurrency(totalValue / data.length, currency)}/item</span>
      </div>
    </div>
  )
}
