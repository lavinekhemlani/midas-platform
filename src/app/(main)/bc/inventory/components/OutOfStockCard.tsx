'use client'

import React, { useMemo, useState } from 'react'
import { PackageX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip } from './InfoTooltip'
import type { FullItem } from '../../hooks/useBCInventoryEnhanced'

interface OutOfStockCardProps {
  /** All items from the enhanced hook — filtering happens here */
  allItems: FullItem[]
  isLoading: boolean
  currency?: string
  onItemClick?: (itemNo: string) => void
  selectedItemNumber?: string | null
  renderItemDetail?: () => React.ReactNode
}

export function OutOfStockCard({
  allItems,
  isLoading,
  currency = 'USD',
  onItemClick,
  selectedItemNumber,
  renderItemDetail,
}: OutOfStockCardProps) {
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

  // Items with zero inventory that are NOT blocked (potential reorder candidates)
  const outOfStockItems = allItems
    .filter((i) => i.inventory === 0 && !i.blocked)
    .sort((a, b) => {
      if (a.days_since_last_sale === null && b.days_since_last_sale === null)
        return b.unit_cost - a.unit_cost
      if (a.days_since_last_sale === null) return 1
      if (b.days_since_last_sale === null) return -1
      return a.days_since_last_sale - b.days_since_last_sale
    })

  const withPriorSales = outOfStockItems.filter((i) => i.sales_qty > 0)

  const ITEMS_PER_PAGE = 5
  const [oosPage, setOosPage] = useState(1)
  const totalPages = Math.ceil(outOfStockItems.length / ITEMS_PER_PAGE)
  const paginatedItems = outOfStockItems.slice(
    (oosPage - 1) * ITEMS_PER_PAGE,
    oosPage * ITEMS_PER_PAGE
  )

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
            Out of Stock
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <div
          className={cn('h-[200px] animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
        />
      </div>
    )
  }

  if (outOfStockItems.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Out of Stock
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <div className="flex flex-col items-center py-8 gap-2">
          <PackageX className={cn('w-6 h-6', isLight ? 'text-green-600' : 'text-green-400')} />
          <p className={cn('text-sm', styles.textMuted)}>All active items are in stock</p>
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
            Out of Stock
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          <InfoTooltip
            description="Items at zero inventory that are not blocked. Items with prior sales may need restocking."
            calculationTooltip={{
              formula: 'Out of Stock = inventory = 0 AND not blocked',
              components: [
                { label: 'Out of Stock', value: `${outOfStockItems.length} items` },
                {
                  label: 'Had Prior Sales',
                  value: `${withPriorSales.length} items`,
                  highlight: withPriorSales.length > 0,
                },
              ],
            }}
          />
        </div>
        <span className={cn('text-[14px] font-mono', isLight ? 'text-red-600' : 'text-red-400')}>
          {outOfStockItems.length} items
        </span>
      </div>

      {/* Summary Row */}
      <div className={cn('py-2.5 px-2 -mx-2 mb-2', styles.rowBg)}>
        <div className="flex items-center justify-between text-[14px]">
          <div>
            <span className={styles.textMuted}>Had Prior Sales: </span>
            <span className="font-mono text-orange-500">{withPriorSales.length}</span>
          </div>
          <div>
            <span className={styles.textMuted}>Never Sold: </span>
            <span className={cn('font-mono', styles.text)}>
              {outOfStockItems.length - withPriorSales.length}
            </span>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className={cn('border-t pt-2', styles.border)}>
        {paginatedItems.map((item, index) => (
          <React.Fragment key={item.item_no}>
            <div
              className={cn(
                'flex items-center justify-between py-2 px-4 text-[14px]',
                index % 2 === 0 && styles.rowBg,
                onItemClick && 'cursor-pointer hover:opacity-80 transition-opacity'
              )}
              onClick={() => onItemClick?.(item.item_no)}
            >
              <div className="flex-1 min-w-0">
                <span
                  className={cn('truncate block', isLight ? 'text-stone-700' : 'text-stone-300')}
                  title={`${item.item_no} — ${item.description}`}
                >
                  {item.description.length > 28
                    ? item.description.substring(0, 28) + '...'
                    : item.description}
                </span>
                <span className={cn('text-[12px]', styles.textMuted)}>
                  {item.days_since_last_sale !== null
                    ? `Last sale: ${item.days_since_last_sale}d ago`
                    : item.sales_qty > 0
                      ? 'Has prior sales'
                      : 'Never sold'}
                </span>
              </div>
              <div className="text-right flex-shrink-0">
                <span className={cn('font-mono tabular-nums', styles.text)}>
                  {formatCompactCurrency(item.unit_cost, currency)}
                </span>
              </div>
            </div>
            {item.item_no === selectedItemNumber && renderItemDetail?.()}
          </React.Fragment>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className={cn(
            'flex items-center justify-between px-4 pt-3 text-[12px]',
            styles.textMuted
          )}
        >
          <span className="font-mono tabular-nums">
            {(oosPage - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(oosPage * ITEMS_PER_PAGE, outOfStockItems.length)} of {outOfStockItems.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setOosPage((p) => Math.max(1, p - 1))}
              disabled={oosPage === 1}
              className={cn(
                'px-2 py-0.5 border',
                styles.border,
                'hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed'
              )}
            >
              Prev
            </button>
            <button
              onClick={() => setOosPage((p) => Math.min(totalPages, p + 1))}
              disabled={oosPage === totalPages}
              className={cn(
                'px-2 py-0.5 border',
                styles.border,
                'hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed'
              )}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
