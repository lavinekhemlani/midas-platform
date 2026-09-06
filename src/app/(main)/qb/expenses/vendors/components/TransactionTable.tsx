'use client'

import { useRef, useMemo, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface Transaction {
  id?: string
  date: string
  vendor: string
  type: string
  docNumber?: string
  amount: number
  balance: number
  status?: string
}

interface TransactionTableProps {
  transactions: Transaction[]
  isLoading: boolean
}

const ROW_HEIGHT = 36

type SortKey = 'date' | 'vendor' | 'amount' | 'balance'

function Skeleton({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-px">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className={cn('h-9 animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')}
        />
      ))}
    </div>
  )
}

export function TransactionTable({ transactions, isLoading }: TransactionTableProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const parentRef = useRef<HTMLDivElement>(null)

  const [sortBy, setSortBy] = useState<SortKey>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      headerBg: isLight ? 'bg-stone-50' : 'bg-white/[0.02]',
      rowHover: isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]',
      rowAlt: isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
    }),
    [isLight]
  )

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date).getTime()
          bValue = new Date(b.date).getTime()
          break
        case 'vendor':
          aValue = a.vendor.toLowerCase()
          bValue = b.vendor.toLowerCase()
          break
        case 'amount':
          aValue = a.amount || 0
          bValue = b.amount || 0
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
  }, [transactions, sortBy, sortOrder])

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortOrder('desc')
    }
  }

  const rowVirtualizer = useVirtualizer({
    count: sortedTransactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  if (isLoading) return <Skeleton isLight={isLight} />

  if (!transactions.length) {
    return <div className={cn('py-8 text-center text-sm', styles.textMuted)}>No transactions</div>
  }

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortBy !== column) return null
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-3 h-3 ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1" />
    )
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Paid':
        return isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-400'
      case 'Overdue':
        return isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/20 text-red-400'
      default:
        return isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-400'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Bill':
        return isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400'
      case 'Bill Credit':
        return isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-400'
      default:
        return isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-400'
    }
  }

  return (
    <div>
      {/* Header */}
      <div
        className={cn(
          'grid grid-cols-[40px_90px_1fr_80px_70px_90px_90px_70px] gap-2 px-2 py-2.5 text-xs font-semibold border-b',
          styles.border,
          styles.text
        )}
      >
        <div>#</div>
        <div
          className="flex items-center cursor-pointer hover:text-amber-500"
          onClick={() => handleSort('date')}
        >
          Date <SortIcon column="date" />
        </div>
        <div
          className="flex items-center cursor-pointer hover:text-amber-500"
          onClick={() => handleSort('vendor')}
        >
          Vendor <SortIcon column="vendor" />
        </div>
        <div>Type</div>
        <div>Doc #</div>
        <div
          className="text-right flex items-center justify-end cursor-pointer hover:text-amber-500"
          onClick={() => handleSort('amount')}
        >
          Amount <SortIcon column="amount" />
        </div>
        <div
          className="text-right flex items-center justify-end cursor-pointer hover:text-amber-500"
          onClick={() => handleSort('balance')}
        >
          Balance <SortIcon column="balance" />
        </div>
        <div className="text-center">Status</div>
      </div>

      {/* Virtualized rows */}
      <div
        ref={parentRef}
        className="h-[480px] overflow-auto styled-scrollbar"
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
            const txn = sortedTransactions[virtualRow.index]
            return (
              <div
                key={virtualRow.index}
                className={cn(
                  'absolute left-0 right-0 grid grid-cols-[40px_90px_1fr_80px_70px_90px_90px_70px] gap-2 px-2 items-center text-xs transition-colors duration-150',
                  virtualRow.index % 2 === 0 ? styles.rowAlt : '',
                  styles.rowHover
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className={cn('font-mono', styles.textMuted)}>{virtualRow.index + 1}</div>
                <div className={cn('font-mono tabular-nums', styles.textMuted)}>{txn.date}</div>
                <div className={cn('truncate font-medium', styles.text)} title={txn.vendor}>
                  {txn.vendor}
                </div>
                <div>
                  <span
                    className={cn(
                      'px-1.5 py-0.5 text-[10px] font-medium rounded',
                      getTypeColor(txn.type)
                    )}
                  >
                    {txn.type}
                  </span>
                </div>
                <div className={cn('font-mono', styles.textMuted)}>{txn.docNumber || '—'}</div>
                <div className={cn('text-right font-mono tabular-nums', styles.text)}>
                  {formatCompactCurrency(txn.amount || 0, 'USD')}
                </div>
                <div
                  className={cn(
                    'text-right font-mono tabular-nums',
                    txn.balance > 0
                      ? isLight
                        ? 'text-amber-600'
                        : 'text-amber-400'
                      : styles.textMuted
                  )}
                >
                  {txn.balance > 0 ? formatCompactCurrency(txn.balance, 'USD') : '—'}
                </div>
                <div className="flex justify-center">
                  <span
                    className={cn(
                      'px-1.5 py-0.5 text-[10px] font-medium rounded',
                      getStatusColor(txn.status)
                    )}
                  >
                    {txn.status || 'Open'}
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
