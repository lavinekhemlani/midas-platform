'use client'

import { useRef, useMemo, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface Bill {
  id?: string
  vendor: string
  txnDate: string
  dueDate: string
  totalAmount?: number
  balance: number
  status: string
  memo?: string
  lineItems?: any[]
  daysUntilDue?: number
}

interface BillsTableProps {
  bills: Bill[]
  isLoading: boolean
  selectedBill: Bill | null
  onSelectBill: (bill: Bill | null) => void
}

const ROW_HEIGHT = 36

type SortKey = 'vendor' | 'txnDate' | 'dueDate' | 'totalAmount' | 'balance'

function Skeleton({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-px">
      {[...Array(10)].map((_, i) => (
        <div
          key={i}
          className={cn('h-9 animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')}
        />
      ))}
    </div>
  )
}

export function BillsTable({ bills, isLoading, selectedBill, onSelectBill }: BillsTableProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const parentRef = useRef<HTMLDivElement>(null)

  const [sortBy, setSortBy] = useState<SortKey>('dueDate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      headerBg: isLight ? 'bg-stone-50' : 'bg-white/[0.02]',
      rowHover: isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]',
      rowAlt: isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]',
      rowSelected: isLight ? 'bg-amber-100' : 'bg-amber-500/10',
      rowSelectedHover: isLight ? 'hover:bg-amber-200/70' : 'hover:bg-amber-500/15',
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
        case 'totalAmount':
          aValue = a.totalAmount || a.balance || 0
          bValue = b.totalAmount || b.balance || 0
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
    overscan: 10,
  })

  if (isLoading) return <Skeleton isLight={isLight} />

  if (!bills.length) {
    return <div className={cn('py-8 text-center text-sm', styles.textMuted)}>No bills</div>
  }

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortBy !== column) return null
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-3 h-3 ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1" />
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid':
        return isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-400'
      case 'Overdue':
        return isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/20 text-red-400'
      default:
        return isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-400'
    }
  }

  return (
    <div className="flex gap-6">
      {/* Table */}
      <div className={cn('flex-1', selectedBill && '@3xl:flex-[2]')}>
        {/* Header */}
        <div
          className={cn(
            'grid grid-cols-[40px_1fr_90px_90px_90px_90px_70px] gap-2 px-2 py-2.5 text-xs font-semibold border-b',
            styles.border,
            styles.text
          )}
        >
          <div>#</div>
          <div
            className="flex items-center cursor-pointer hover:text-amber-500"
            onClick={() => handleSort('vendor')}
          >
            Vendor <SortIcon column="vendor" />
          </div>
          <div
            className="flex items-center cursor-pointer hover:text-amber-500"
            onClick={() => handleSort('txnDate')}
          >
            Date <SortIcon column="txnDate" />
          </div>
          <div
            className="flex items-center cursor-pointer hover:text-amber-500"
            onClick={() => handleSort('dueDate')}
          >
            Due <SortIcon column="dueDate" />
          </div>
          <div
            className="text-right flex items-center justify-end cursor-pointer hover:text-amber-500"
            onClick={() => handleSort('totalAmount')}
          >
            Amount <SortIcon column="totalAmount" />
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
          className="h-[400px] overflow-auto styled-scrollbar"
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
              const isSelected = selectedBill?.id === bill.id
              return (
                <div
                  key={virtualRow.index}
                  className={cn(
                    'absolute left-0 right-0 grid grid-cols-[40px_1fr_90px_90px_90px_90px_70px] gap-2 px-2 items-center text-xs cursor-pointer transition-colors duration-150',
                    isSelected
                      ? styles.rowSelected
                      : virtualRow.index % 2 === 0
                        ? styles.rowAlt
                        : '',
                    isSelected ? styles.rowSelectedHover : styles.rowHover
                  )}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => onSelectBill(isSelected ? null : bill)}
                >
                  <div className={cn('font-mono', styles.textMuted)}>{virtualRow.index + 1}</div>
                  <div className={cn('truncate font-medium', styles.text)} title={bill.vendor}>
                    {bill.vendor}
                  </div>
                  <div className={cn('font-mono tabular-nums', styles.textMuted)}>
                    {bill.txnDate}
                  </div>
                  <div className={cn('font-mono tabular-nums', styles.textMuted)}>
                    {bill.dueDate}
                  </div>
                  <div className={cn('text-right font-mono tabular-nums', styles.text)}>
                    {formatCompactCurrency(bill.totalAmount || bill.balance || 0, 'USD')}
                  </div>
                  <div
                    className={cn(
                      'text-right font-mono tabular-nums',
                      bill.balance > 0
                        ? isLight
                          ? 'text-amber-600'
                          : 'text-amber-400'
                        : styles.textMuted
                    )}
                  >
                    {bill.balance > 0 ? formatCompactCurrency(bill.balance, 'USD') : '—'}
                  </div>
                  <div className="flex justify-center">
                    <span
                      className={cn(
                        'px-1.5 py-0.5 text-[10px] font-medium rounded',
                        getStatusColor(bill.status)
                      )}
                    >
                      {bill.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedBill && (
        <div className={cn('hidden @3xl:block flex-1 border-l pl-6', styles.border)}>
          <div className="sticky top-0">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className={cn('text-sm font-semibold', styles.text)}>{selectedBill.vendor}</h3>
                <p className={cn('text-xs mt-1', styles.textMuted)}>Bill Details</p>
              </div>
              <button
                onClick={() => onSelectBill(null)}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  isLight ? 'hover:bg-stone-100' : 'hover:bg-white/5'
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
                  Bill Date
                </div>
                <div className={cn('text-sm font-mono', styles.text)}>{selectedBill.txnDate}</div>
              </div>
              <div>
                <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
                  Due Date
                </div>
                <div className={cn('text-sm font-mono', styles.text)}>{selectedBill.dueDate}</div>
              </div>
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className={cn('p-3 rounded', isLight ? 'bg-blue-50' : 'bg-blue-500/10')}>
                <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
                  Total
                </div>
                <div
                  className={cn(
                    'text-lg font-mono font-semibold tabular-nums',
                    isLight ? 'text-blue-600' : 'text-blue-400'
                  )}
                >
                  {formatCompactCurrency(
                    selectedBill.totalAmount || selectedBill.balance || 0,
                    'USD'
                  )}
                </div>
              </div>
              {selectedBill.balance > 0 && (
                <div className={cn('p-3 rounded', isLight ? 'bg-red-50' : 'bg-red-500/10')}>
                  <div
                    className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}
                  >
                    Balance
                  </div>
                  <div
                    className={cn(
                      'text-lg font-mono font-semibold tabular-nums',
                      isLight ? 'text-red-600' : 'text-red-400'
                    )}
                  >
                    {formatCompactCurrency(selectedBill.balance, 'USD')}
                  </div>
                </div>
              )}
            </div>

            {/* Status */}
            <div className={cn('flex items-center justify-center py-3 border-t', styles.border)}>
              <span
                className={cn(
                  'px-3 py-1 text-sm font-medium rounded',
                  getStatusColor(selectedBill.status)
                )}
              >
                {selectedBill.status}
                {selectedBill.daysUntilDue !== undefined && selectedBill.status !== 'Paid' && (
                  <span className="ml-2 opacity-80">
                    (
                    {selectedBill.daysUntilDue > 0
                      ? `${selectedBill.daysUntilDue}d left`
                      : `${Math.abs(selectedBill.daysUntilDue)}d overdue`}
                    )
                  </span>
                )}
              </span>
            </div>

            {/* Line Items */}
            {selectedBill.lineItems && selectedBill.lineItems.length > 0 && (
              <div className={cn('mt-4 pt-4 border-t', styles.border)}>
                <div className={cn('text-xs font-semibold mb-2', styles.text)}>Line Items</div>
                <div className="space-y-1">
                  {selectedBill.lineItems.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex justify-between items-center py-1.5 px-2 text-xs rounded',
                        idx % 2 === 0 ? (isLight ? 'bg-stone-100' : 'bg-white/[0.02]') : ''
                      )}
                    >
                      <span className={cn('truncate flex-1 mr-2', styles.text)}>
                        {item.description}
                      </span>
                      <span className={cn('font-mono tabular-nums', styles.text)}>
                        {formatCompactCurrency(item.amount, 'USD')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Memo */}
            {selectedBill.memo && (
              <div className={cn('mt-4 pt-4 border-t', styles.border)}>
                <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
                  Memo
                </div>
                <p className={cn('text-sm', styles.text)}>{selectedBill.memo}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
