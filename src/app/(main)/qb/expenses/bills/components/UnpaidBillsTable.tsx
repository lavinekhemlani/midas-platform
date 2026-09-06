'use client'

import { useRef, useMemo, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface UnpaidBill {
  id?: string
  vendor: string
  txnDate: string
  dueDate: string
  totalAmount?: number
  balance: number
  bucket: string
  daysOverdue?: number
}

interface UnpaidBillsTableProps {
  bills: UnpaidBill[]
  isLoading: boolean
}

const ROW_HEIGHT = 40

type SortKey = 'vendor' | 'txnDate' | 'dueDate' | 'balance'

function Skeleton({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-px">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className={cn('h-10 animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')}
        />
      ))}
    </div>
  )
}

export function UnpaidBillsTable({ bills, isLoading }: UnpaidBillsTableProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const parentRef = useRef<HTMLDivElement>(null)

  const [sortBy, setSortBy] = useState<SortKey>('balance')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      rowHover: isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]',
      rowAlt: isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
    }),
    [isLight]
  )

  const sortedBills = useMemo(() => {
    return [...bills].sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case 'vendor':
          aValue = a.vendor?.toLowerCase() || ''
          bValue = b.vendor?.toLowerCase() || ''
          break
        case 'txnDate':
          aValue = a.txnDate ? new Date(a.txnDate).getTime() : 0
          bValue = b.txnDate ? new Date(b.txnDate).getTime() : 0
          break
        case 'dueDate':
          aValue = a.dueDate ? new Date(a.dueDate).getTime() : 0
          bValue = b.dueDate ? new Date(b.dueDate).getTime() : 0
          break
        case 'balance':
          aValue = a.balance || 0
          bValue = b.balance || 0
          break
        default:
          return 0
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })
  }, [bills, sortBy, sortOrder])

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortOrder('desc')
    }
  }

  const rowVirtualizer = useVirtualizer({
    count: sortedBills.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  })

  if (isLoading) return <Skeleton isLight={isLight} />

  if (!bills.length) {
    return <div className={cn('py-8 text-center text-sm', styles.textMuted)}>No unpaid bills</div>
  }

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortBy !== column) return null
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-3 h-3 ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1" />
    )
  }

  const getBucketColor = (bucket: string) => {
    switch (bucket) {
      case 'Current':
        return isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-400'
      case '1-30':
        return isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-400'
      case '31-60':
        return isLight ? 'bg-orange-100 text-orange-700' : 'bg-orange-500/20 text-orange-400'
      case '61-90':
        return isLight ? 'bg-red-100 text-red-600' : 'bg-red-500/20 text-red-400'
      case '90+':
        return isLight ? 'bg-red-200 text-red-800' : 'bg-red-600/30 text-red-300'
      default:
        return isLight ? 'bg-stone-100 text-stone-600' : 'bg-white/5 text-stone-400'
    }
  }

  return (
    <div>
      {/* Header */}
      <div
        className={cn(
          'grid grid-cols-[1fr_90px_90px_90px_100px_60px] gap-2 px-2 py-2.5 text-xs font-semibold border-b',
          styles.border,
          styles.text
        )}
      >
        <div
          className="flex items-center cursor-pointer hover:text-amber-500"
          onClick={() => handleSort('vendor')}
        >
          Vendor <SortIcon column="vendor" />
        </div>
        <div
          className="text-right flex items-center justify-end cursor-pointer hover:text-amber-500"
          onClick={() => handleSort('txnDate')}
        >
          Bill Date <SortIcon column="txnDate" />
        </div>
        <div
          className="text-right flex items-center justify-end cursor-pointer hover:text-amber-500"
          onClick={() => handleSort('dueDate')}
        >
          Due Date <SortIcon column="dueDate" />
        </div>
        <div className="text-right">Total</div>
        <div
          className="text-right flex items-center justify-end cursor-pointer hover:text-amber-500"
          onClick={() => handleSort('balance')}
        >
          Balance <SortIcon column="balance" />
        </div>
        <div className="text-center">Aging</div>
      </div>

      {/* Virtualized rows */}
      <div
        ref={parentRef}
        className="h-[300px] overflow-auto styled-scrollbar"
        style={{ contain: 'strict' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const bill = sortedBills[virtualRow.index]
            const isOverdue = (bill.daysOverdue || 0) > 0
            return (
              <div
                key={virtualRow.index}
                className={cn(
                  'absolute left-0 right-0 grid grid-cols-[1fr_90px_90px_90px_100px_60px] gap-2 px-2 items-center text-xs transition-colors duration-150',
                  virtualRow.index % 2 === 0 ? styles.rowAlt : '',
                  styles.rowHover
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className={cn('truncate font-medium', styles.text)} title={bill.vendor}>
                  {bill.vendor}
                </div>
                <div className={cn('text-right font-mono tabular-nums', styles.textMuted)}>
                  {bill.txnDate}
                </div>
                <div className="text-right">
                  <div className={cn('font-mono tabular-nums', styles.textMuted)}>
                    {bill.dueDate}
                  </div>
                  {isOverdue && (
                    <div
                      className={cn(
                        'text-[10px] font-medium',
                        isLight ? 'text-red-600' : 'text-red-400'
                      )}
                    >
                      {bill.daysOverdue}d overdue
                    </div>
                  )}
                </div>
                <div className={cn('text-right font-mono tabular-nums', styles.textMuted)}>
                  {formatCompactCurrency(bill.totalAmount || bill.balance || 0, 'USD')}
                </div>
                <div
                  className={cn(
                    'text-right font-mono font-semibold tabular-nums',
                    isLight ? 'text-amber-600' : 'text-amber-400'
                  )}
                >
                  {formatCompactCurrency(bill.balance || 0, 'USD')}
                </div>
                <div className="flex justify-center">
                  <span
                    className={cn(
                      'px-1.5 py-0.5 text-[10px] font-medium rounded',
                      getBucketColor(bill.bucket)
                    )}
                  >
                    {bill.bucket}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
