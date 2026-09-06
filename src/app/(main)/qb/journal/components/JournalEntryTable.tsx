'use client'

import { useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { X, FileText, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface JournalEntry {
  id?: string
  date: string
  transactionType: string
  account: string
  memo?: string
  debit?: number
  credit?: number
  num?: string
}

interface JournalEntryTableProps {
  entries: JournalEntry[]
  isLoading: boolean
  selectedEntry: JournalEntry | null
  onSelectEntry: (entry: JournalEntry | null) => void
}

const ROW_HEIGHT = 32

function Skeleton({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-px">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className={cn('h-8 animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')}
        />
      ))}
    </div>
  )
}

export function JournalEntryTable({
  entries,
  isLoading,
  selectedEntry,
  onSelectEntry,
}: JournalEntryTableProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const parentRef = useRef<HTMLDivElement>(null)

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
      debit: isLight ? 'text-emerald-600' : 'text-emerald-400',
      credit: isLight ? 'text-blue-600' : 'text-blue-400',
    }),
    [isLight]
  )

  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  if (isLoading) return <Skeleton isLight={isLight} />

  if (!entries.length) {
    return (
      <div className={cn('py-8 text-center text-sm', styles.textMuted)}>No journal entries</div>
    )
  }

  return (
    <div className="flex gap-6">
      {/* Table */}
      <div className={cn('flex-1', selectedEntry && '@3xl:flex-[2]')}>
        {/* Header */}
        <div
          className={cn(
            'grid grid-cols-[60px_100px_100px_1fr_100px_100px] gap-2 px-2 py-2.5 text-xs font-semibold border-b',
            styles.border,
            styles.text
          )}
        >
          <div>#</div>
          <div>Date</div>
          <div>Type</div>
          <div>Account</div>
          <div className="text-right">Debit</div>
          <div className="text-right">Credit</div>
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
              const entry = entries[virtualRow.index]
              const isSelected =
                selectedEntry?.id === entry.id && selectedEntry?.date === entry.date
              return (
                <div
                  key={virtualRow.index}
                  className={cn(
                    'absolute left-0 right-0 grid grid-cols-[60px_100px_100px_1fr_100px_100px] gap-2 px-2 items-center text-xs cursor-pointer transition-colors duration-150',
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
                  onClick={() => onSelectEntry(isSelected ? null : entry)}
                >
                  <div className={cn('font-mono', styles.textMuted)}>{virtualRow.index + 1}</div>
                  <div className={cn('font-mono tabular-nums', styles.textMuted)}>{entry.date}</div>
                  <div>
                    <span
                      className={cn(
                        'px-1.5 py-0.5 text-[10px] font-medium rounded',
                        isLight ? 'bg-stone-100 text-stone-600' : 'bg-white/5 text-stone-400'
                      )}
                    >
                      {entry.transactionType}
                    </span>
                  </div>
                  <div className={cn('truncate', styles.text)} title={entry.account}>
                    {entry.account}
                  </div>
                  <div className={cn('text-right font-mono tabular-nums', styles.debit)}>
                    {entry.debit ? formatCompactCurrency(entry.debit, 'USD') : '—'}
                  </div>
                  <div className={cn('text-right font-mono tabular-nums', styles.credit)}>
                    {entry.credit ? formatCompactCurrency(entry.credit, 'USD') : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedEntry && (
        <div className={cn('hidden @3xl:block flex-1 border-l pl-6', styles.border)}>
          <div className="sticky top-0">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className={cn('text-sm font-semibold', styles.text)}>
                  {selectedEntry.account}
                </h3>
                <p className={cn('text-xs mt-1', styles.textMuted)}>Entry Details</p>
              </div>
              <button
                onClick={() => onSelectEntry(null)}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  isLight ? 'hover:bg-stone-100' : 'hover:bg-white/5'
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Entry info */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className={cn('block mb-1', styles.textMuted)}>Date</span>
                  <span className={cn('font-mono', styles.text)}>{selectedEntry.date}</span>
                </div>
                <div>
                  <span className={cn('block mb-1', styles.textMuted)}>Type</span>
                  <span
                    className={cn(
                      'inline-block px-2 py-0.5 text-[10px] font-medium rounded',
                      isLight ? 'bg-stone-100 text-stone-600' : 'bg-white/5 text-stone-400'
                    )}
                  >
                    {selectedEntry.transactionType}
                  </span>
                </div>
                {selectedEntry.num && (
                  <div className="col-span-2">
                    <span className={cn('block mb-1', styles.textMuted)}>Reference</span>
                    <span className={cn('font-mono', styles.text)}>{selectedEntry.num}</span>
                  </div>
                )}
                {selectedEntry.memo && (
                  <div className="col-span-2">
                    <span className={cn('block mb-1', styles.textMuted)}>Memo</span>
                    <span className={styles.text}>{selectedEntry.memo}</span>
                  </div>
                )}
              </div>

              {/* Amounts */}
              <div className={cn('pt-4 border-t', styles.border)}>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className={cn('p-3 rounded', isLight ? 'bg-emerald-50' : 'bg-emerald-500/10')}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowUpRight className={cn('w-3 h-3', styles.debit)} />
                      <span
                        className={cn('text-[10px] uppercase tracking-wider', styles.textMuted)}
                      >
                        Debit
                      </span>
                    </div>
                    <div
                      className={cn('text-lg font-mono font-semibold tabular-nums', styles.debit)}
                    >
                      {selectedEntry.debit
                        ? formatCompactCurrency(selectedEntry.debit, 'USD')
                        : '$0'}
                    </div>
                  </div>
                  <div className={cn('p-3 rounded', isLight ? 'bg-blue-50' : 'bg-blue-500/10')}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowDownRight className={cn('w-3 h-3', styles.credit)} />
                      <span
                        className={cn('text-[10px] uppercase tracking-wider', styles.textMuted)}
                      >
                        Credit
                      </span>
                    </div>
                    <div
                      className={cn('text-lg font-mono font-semibold tabular-nums', styles.credit)}
                    >
                      {selectedEntry.credit
                        ? formatCompactCurrency(selectedEntry.credit, 'USD')
                        : '$0'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Net */}
              <div className={cn('flex justify-between pt-3 border-t text-xs', styles.border)}>
                <span className={styles.textMuted}>Net Amount</span>
                <span className={cn('font-mono font-medium tabular-nums', styles.text)}>
                  {formatCompactCurrency(
                    Math.abs((selectedEntry.debit || 0) - (selectedEntry.credit || 0)),
                    'USD'
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
