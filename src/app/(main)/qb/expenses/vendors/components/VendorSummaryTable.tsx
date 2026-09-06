'use client'

import { useRef, useMemo, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface Vendor {
  vendor: string
  totalAmount: number
  balance: number
  transactionCount: number
  billCount: number
  creditCount: number
}

interface VendorSummaryTableProps {
  vendors: Vendor[]
  isLoading: boolean
  selectedVendor: Vendor | null
  onSelectVendor: (vendor: Vendor | null) => void
}

const ROW_HEIGHT = 36

type SortKey = 'vendor' | 'totalAmount' | 'balance' | 'transactionCount'

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

export function VendorSummaryTable({
  vendors,
  isLoading,
  selectedVendor,
  onSelectVendor,
}: VendorSummaryTableProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const parentRef = useRef<HTMLDivElement>(null)

  const [sortBy, setSortBy] = useState<SortKey>('totalAmount')
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

  const sortedVendors = useMemo(() => {
    return [...vendors].sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case 'vendor':
          aValue = a.vendor.toLowerCase()
          bValue = b.vendor.toLowerCase()
          break
        case 'totalAmount':
          aValue = a.totalAmount || 0
          bValue = b.totalAmount || 0
          break
        case 'balance':
          aValue = a.balance || 0
          bValue = b.balance || 0
          break
        case 'transactionCount':
          aValue = a.transactionCount || 0
          bValue = b.transactionCount || 0
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
  }, [vendors, sortBy, sortOrder])

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortOrder('desc')
    }
  }

  const rowVirtualizer = useVirtualizer({
    count: sortedVendors.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  if (isLoading) return <Skeleton isLight={isLight} />

  if (!vendors.length) {
    return <div className={cn('py-8 text-center text-sm', styles.textMuted)}>No vendor data</div>
  }

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortBy !== column) return null
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-3 h-3 ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1" />
    )
  }

  return (
    <div className="flex gap-6">
      {/* Table */}
      <div className={cn('flex-1', selectedVendor && '@3xl:flex-[2]')}>
        {/* Header */}
        <div
          className={cn(
            'grid grid-cols-[40px_1fr_100px_100px_80px_60px_60px] gap-2 px-2 py-2.5 text-xs font-semibold border-b',
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
            className="text-right flex items-center justify-end cursor-pointer hover:text-amber-500"
            onClick={() => handleSort('totalAmount')}
          >
            Spending <SortIcon column="totalAmount" />
          </div>
          <div
            className="text-right flex items-center justify-end cursor-pointer hover:text-amber-500"
            onClick={() => handleSort('balance')}
          >
            Balance <SortIcon column="balance" />
          </div>
          <div
            className="text-right flex items-center justify-end cursor-pointer hover:text-amber-500"
            onClick={() => handleSort('transactionCount')}
          >
            Txns <SortIcon column="transactionCount" />
          </div>
          <div className="text-right">Bills</div>
          <div className="text-right">Credits</div>
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
              const vendor = sortedVendors[virtualRow.index]
              const isSelected = selectedVendor?.vendor === vendor.vendor
              return (
                <div
                  key={virtualRow.index}
                  className={cn(
                    'absolute left-0 right-0 grid grid-cols-[40px_1fr_100px_100px_80px_60px_60px] gap-2 px-2 items-center text-xs cursor-pointer transition-colors duration-150',
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
                  onClick={() => onSelectVendor(isSelected ? null : vendor)}
                >
                  <div className={cn('font-mono', styles.textMuted)}>{virtualRow.index + 1}</div>
                  <div className={cn('truncate font-medium', styles.text)} title={vendor.vendor}>
                    {vendor.vendor}
                  </div>
                  <div className={cn('text-right font-mono tabular-nums', styles.text)}>
                    {formatCompactCurrency(vendor.totalAmount || 0, 'USD')}
                  </div>
                  <div
                    className={cn(
                      'text-right font-mono tabular-nums',
                      vendor.balance > 0
                        ? isLight
                          ? 'text-amber-600'
                          : 'text-amber-400'
                        : styles.textMuted
                    )}
                  >
                    {vendor.balance > 0 ? formatCompactCurrency(vendor.balance, 'USD') : '—'}
                  </div>
                  <div className={cn('text-right font-mono tabular-nums', styles.textMuted)}>
                    {vendor.transactionCount || 0}
                  </div>
                  <div className={cn('text-right font-mono tabular-nums', styles.textMuted)}>
                    {vendor.billCount || 0}
                  </div>
                  <div className={cn('text-right font-mono tabular-nums', styles.textMuted)}>
                    {vendor.creditCount || 0}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedVendor && (
        <div className={cn('hidden @3xl:block flex-1 border-l pl-6', styles.border)}>
          <div className="sticky top-0">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className={cn('text-sm font-semibold', styles.text)}>
                  {selectedVendor.vendor}
                </h3>
                <p className={cn('text-xs mt-1', styles.textMuted)}>Vendor Details</p>
              </div>
              <button
                onClick={() => onSelectVendor(null)}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  isLight ? 'hover:bg-stone-100' : 'hover:bg-white/5'
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className={cn('p-3 rounded', isLight ? 'bg-red-50' : 'bg-red-500/10')}>
                <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
                  Total Spending
                </div>
                <div
                  className={cn(
                    'text-lg font-mono font-semibold tabular-nums',
                    isLight ? 'text-red-600' : 'text-red-400'
                  )}
                >
                  {formatCompactCurrency(selectedVendor.totalAmount || 0, 'USD')}
                </div>
              </div>
              <div className={cn('p-3 rounded', isLight ? 'bg-amber-50' : 'bg-amber-500/10')}>
                <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
                  Balance
                </div>
                <div
                  className={cn(
                    'text-lg font-mono font-semibold tabular-nums',
                    isLight ? 'text-amber-600' : 'text-amber-400'
                  )}
                >
                  {formatCompactCurrency(selectedVendor.balance || 0, 'USD')}
                </div>
              </div>
            </div>

            {/* Transaction breakdown */}
            <div className={cn('mt-6 pt-4 border-t', styles.border)}>
              <div className={cn('text-xs font-semibold mb-3', styles.text)}>Breakdown</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className={styles.textMuted}>Bills</span>
                  <span className={cn('font-mono', styles.text)}>
                    {selectedVendor.billCount || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className={styles.textMuted}>Credits</span>
                  <span className={cn('font-mono', styles.text)}>
                    {selectedVendor.creditCount || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className={styles.textMuted}>Total Transactions</span>
                  <span className={cn('font-mono', styles.text)}>
                    {selectedVendor.transactionCount || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
