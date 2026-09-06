'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { TopItemByValueRow } from '../hooks/useInventoryData'

interface TopItemsHorizontalChartProps {
  data: (TopItemByValueRow & { percentage?: number })[]
  totalValue: number
  isLoading: boolean
  currency?: string
}

// Color palette for items
const itemColors = [
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
]

function Skeleton({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div
            className={cn(
              'w-6 h-4 animate-pulse rounded',
              isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
            )}
          />
          <div
            className={cn(
              'flex-1 h-7 animate-pulse rounded',
              isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
            )}
          />
          <div
            className={cn(
              'w-16 h-4 animate-pulse rounded',
              isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
            )}
          />
        </div>
      ))}
    </div>
  )
}

export function TopItemsHorizontalChart({
  data,
  totalValue,
  isLoading,
  currency = 'USD',
}: TopItemsHorizontalChartProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  // Calculate max for bar scaling
  const maxValue = useMemo(() => {
    return Math.max(...data.map((d) => d.inventory_value), 1)
  }, [data])

  // Calculate concentration metrics
  const metrics = useMemo(() => {
    if (!data.length || !totalValue) return null

    const top3Value = data.slice(0, 3).reduce((sum, d) => sum + d.inventory_value, 0)
    const top5Value = data.slice(0, 5).reduce((sum, d) => sum + d.inventory_value, 0)

    return {
      top3Percentage: (top3Value / totalValue) * 100,
      top5Percentage: (top5Value / totalValue) * 100,
    }
  }, [data, totalValue])

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

  if (!data.length) {
    return (
      <div className={cn('py-6 text-center text-sm', styles.textMuted)}>No inventory items</div>
    )
  }

  const displayItems = data.slice(0, 8)

  return (
    <div>
      {/* Summary stats */}
      {metrics && (
        <div className={cn('flex gap-6 pb-3 mb-3 border-b text-xs', styles.border)}>
          <div>
            <span className={styles.textMuted}>Top 3 </span>
            <span className={cn('font-mono font-medium', styles.text)}>
              {metrics.top3Percentage.toFixed(0)}%
            </span>
          </div>
          <div>
            <span className={styles.textMuted}>Top 5 </span>
            <span className={cn('font-mono font-medium', styles.text)}>
              {metrics.top5Percentage.toFixed(0)}%
            </span>
          </div>
          <div>
            <span className={styles.textMuted}>Total </span>
            <span className={cn('font-mono font-medium', styles.text)}>
              {formatCompactCurrency(totalValue, currency)}
            </span>
          </div>
        </div>
      )}

      {/* Horizontal bar chart */}
      <div className="space-y-1.5">
        {displayItems.map((item, i) => {
          const barWidth = (item.inventory_value / maxValue) * 100
          const color = itemColors[i % itemColors.length]
          const pct = totalValue > 0 ? (item.inventory_value / totalValue) * 100 : 0

          return (
            <div key={item.item_no} className="flex items-center gap-3 text-xs">
              {/* Rank */}
              <div
                className={cn('w-4 font-mono font-bold tabular-nums text-right', styles.textMuted)}
              >
                {i + 1}
              </div>

              {/* Bar */}
              <div className={cn('flex-1 h-6 relative', styles.barBg)}>
                <div
                  className="h-full transition-all duration-500 flex items-center px-2"
                  style={{
                    width: `${Math.max(barWidth, 3)}%`,
                    backgroundColor: color,
                  }}
                >
                  {barWidth > 25 && (
                    <span
                      className="text-[10px] font-medium text-white/90 truncate"
                      title={item.description}
                    >
                      {item.description}
                    </span>
                  )}
                </div>
                {barWidth <= 25 && (
                  <span
                    className={cn(
                      'absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium truncate max-w-[60%]',
                      styles.text
                    )}
                    style={{ left: `calc(${barWidth}% + 8px)` }}
                    title={item.description}
                  >
                    {item.description}
                  </span>
                )}
              </div>

              {/* Units */}
              <div
                className={cn(
                  'w-14 text-right font-mono tabular-nums text-[10px]',
                  styles.textMuted
                )}
              >
                {item.inventory.toLocaleString()}
              </div>

              {/* Value */}
              <div
                className={cn('w-16 text-right font-mono tabular-nums font-medium', styles.text)}
              >
                {formatCompactCurrency(item.inventory_value, currency)}
              </div>

              {/* Percentage */}
              <div
                className={cn(
                  'w-10 text-right font-mono tabular-nums text-[10px]',
                  styles.textMuted
                )}
              >
                {pct.toFixed(0)}%
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div
        className={cn(
          'flex items-center justify-end gap-6 pt-3 mt-3 border-t text-[10px]',
          styles.border
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className={styles.textMuted}>Units</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={styles.textMuted}>Value</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={styles.textMuted}>% of Total</span>
        </div>
      </div>
    </div>
  )
}
