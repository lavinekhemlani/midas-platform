'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useBCGLAccountDetail } from '../../hooks/useBCGLAccountDetail'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import {
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  X,
  Search,
} from 'lucide-react'
import { EChartsBar } from '@/components/charts/echarts'
import { formatStatementAmount } from '@/lib/utils/currency'
import type { GLEntry } from '../../hooks/useBCGLAccountDetail'

const ROWS_PER_PAGE = 10

type SortDir = 'asc' | 'desc'

interface PnLAccountDetailDrawerProps {
  open: boolean
  onClose: () => void
  connectionId: string
  accountNumber: string | null
  accountName: string | null
  category: string | null
  startDate: string
  endDate: string
  currency: string
}

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function DocTypeBadge({ docType, isLight }: { docType: string; isLight: boolean }) {
  const normalized = (docType || '').toLowerCase().trim()
  let color = isLight ? 'bg-stone-200 text-stone-600' : 'bg-white/[0.08] text-stone-400'

  if (normalized === 'invoice' || normalized === 'sales invoice') {
    color = isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400'
  } else if (normalized === 'credit memo' || normalized === 'sales credit memo') {
    color = isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-400'
  } else if (normalized === 'payment') {
    color = isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/15 text-blue-400'
  } else if (normalized === 'purchase invoice') {
    color = isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/15 text-purple-400'
  } else if (normalized === '' || normalized === ' ') {
    color = isLight ? 'bg-stone-100 text-stone-500' : 'bg-white/[0.05] text-stone-500'
  }

  return (
    <span
      className={cn(
        'inline-block px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide whitespace-nowrap',
        color
      )}
    >
      {docType || 'Journal'}
    </span>
  )
}

export function PnLAccountDetailDrawer({
  open,
  onClose,
  connectionId,
  accountNumber,
  accountName,
  category,
  startDate,
  endDate,
  currency,
}: PnLAccountDetailDrawerProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [open, accountNumber])

  const [sortKey, setSortKey] = useState<string>('postingDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [txPage, setTxPage] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  // Reset page and search on account change
  useEffect(() => {
    setTxPage(0)
    setSearchQuery('')
  }, [accountNumber])

  const { account, entries, summary, isLoading, error } = useBCGLAccountDetail(
    open ? connectionId : null,
    open ? accountNumber : null,
    { startDate, endDate }
  )

  const styles = useMemo(
    () => ({
      border: 'border-[var(--theme-card-border)]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      card: isLight
        ? 'bg-[var(--theme-bg)] border-[var(--theme-card-border)]'
        : 'bg-white/[0.02] border-[var(--theme-card-border)]',
    }),
    [isLight]
  )

  // Compute monthly trend from entries
  const monthlyTrend = useMemo(() => {
    if (entries.length === 0) return []
    const monthMap = new Map<string, number>()
    for (const e of entries) {
      const month = (e.postingDate || '').substring(0, 7)
      if (!month) continue
      monthMap.set(month, (monthMap.get(month) ?? 0) + Math.abs(e.netAmount))
    }
    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }))
  }, [entries])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'entryNumber' || key === 'documentNumber' ? 'asc' : 'desc')
    }
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-amber-500" />
    ) : (
      <ChevronDown className="w-3 h-3 text-amber-500" />
    )
  }

  function sortItems<T extends Record<string, any>>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const aVal = a[sortKey] ?? ''
      const bVal = b[sortKey] ?? ''
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }

  const categoryColor =
    category === 'Income'
      ? isLight
        ? 'bg-green-500/10 text-green-600'
        : 'bg-green-500/20 text-green-400'
      : category === 'Expense'
        ? isLight
          ? 'bg-red-500/10 text-red-600'
          : 'bg-red-500/20 text-red-400'
        : category === 'Cost of Goods Sold'
          ? isLight
            ? 'bg-amber-500/10 text-amber-600'
            : 'bg-amber-500/20 text-amber-400'
          : isLight
            ? 'bg-stone-200 text-stone-600'
            : 'bg-white/[0.08] text-stone-400'

  if (!open) return null

  return (
    <div
      ref={cardRef}
      className={cn(
        'my-3 border border-[var(--theme-card-border)] overflow-hidden scroll-mt-4 bg-[var(--theme-card-bg)]',
        isLight ? 'shadow-lg shadow-stone-200/50' : 'shadow-lg shadow-black/30'
      )}
    >
      {/* Header */}
      <div className={cn('px-6 pt-5 pb-4 border-b border-[var(--theme-card-border)]')}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider',
                  categoryColor
                )}
              >
                {category || 'Account'}
              </span>
            </div>
            <h3 className={cn('text-lg font-semibold', isLight ? 'text-stone-900' : 'text-white')}>
              {accountName || accountNumber || 'Account Detail'}
            </h3>
            <p
              className={cn(
                'text-xs font-mono mt-1',
                isLight ? 'text-stone-500' : 'text-stone-500'
              )}
            >
              Account {accountNumber} &middot; {startDate} to {endDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className={cn(
              'p-1.5 rounded-lg transition-colors shrink-0 mt-1',
              isLight ? 'hover:bg-stone-100 text-stone-400' : 'hover:bg-white/[0.06] text-stone-500'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-5 space-y-6">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2
              className={cn('w-6 h-6 animate-spin', isLight ? 'text-stone-400' : 'text-stone-500')}
            />
          </div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
            <p className={cn('text-sm', isLight ? 'text-stone-500' : 'text-stone-400')}>
              Failed to load account detail
            </p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Info Cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Account Details */}
              <div className={cn('rounded-lg border p-3 space-y-2', styles.card)}>
                <h4
                  className={cn(
                    'text-[10px] font-medium uppercase tracking-wider',
                    styles.textMuted
                  )}
                >
                  Account Details
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className={styles.textMuted}>Type</span>
                    <span className={cn('font-medium', styles.text)}>
                      {account?.accountType || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={styles.textMuted}>Category</span>
                    <span className={cn('font-medium', styles.text)}>
                      {account?.category || category || '—'}
                    </span>
                  </div>
                  {account?.subCategory && (
                    <div className="flex justify-between">
                      <span className={styles.textMuted}>Sub-Category</span>
                      <span className={cn('font-medium', styles.text)}>{account.subCategory}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* By Document Type */}
              <div className={cn('rounded-lg border p-3 space-y-2', styles.card)}>
                <h4
                  className={cn(
                    'text-[10px] font-medium uppercase tracking-wider',
                    styles.textMuted
                  )}
                >
                  By Document Type
                </h4>
                {summary && summary.byDocumentType.length > 0 ? (
                  <div className="space-y-1.5 text-xs">
                    {summary.byDocumentType.slice(0, 4).map((dt) => (
                      <div key={dt.type} className="flex justify-between">
                        <span className={styles.textMuted}>{dt.type || 'Journal'}</span>
                        <span className={cn('font-mono', styles.text)}>{dt.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={cn('text-xs', styles.textMuted)}>No entries</p>
                )}
              </div>
            </div>

            {/* Key metrics strip */}
            {summary && (
              <div
                className={cn(
                  'flex flex-wrap justify-start gap-x-8 gap-y-3 pt-4 pb-2 border-b',
                  styles.border
                )}
              >
                <div>
                  <div className="text-[10px] uppercase tracking-wider theme-text-secondary mb-1">
                    Total Debit
                  </div>
                  <div
                    className={cn('text-[20px] font-mono font-semibold tabular-nums', styles.text)}
                  >
                    {formatCompactCurrency(summary.totalDebit, currency)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider theme-text-secondary mb-1">
                    Total Credit
                  </div>
                  <div
                    className={cn('text-[20px] font-mono font-semibold tabular-nums', styles.text)}
                  >
                    {formatCompactCurrency(summary.totalCredit, currency)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider theme-text-secondary mb-1">
                    Net Amount
                  </div>
                  <div
                    className={cn(
                      'text-[20px] font-mono font-semibold tabular-nums',
                      summary.netAmount >= 0
                        ? isLight
                          ? 'text-emerald-600'
                          : 'text-emerald-400'
                        : isLight
                          ? 'text-red-600'
                          : 'text-red-400'
                    )}
                  >
                    {formatCompactCurrency(summary.netAmount, currency)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider theme-text-secondary mb-1">
                    Entries
                  </div>
                  <div
                    className={cn('text-[20px] font-mono font-semibold tabular-nums', styles.text)}
                  >
                    {summary.entryCount}
                  </div>
                </div>
              </div>
            )}

            {/* Monthly Activity Chart */}
            {monthlyTrend.length > 1 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className={cn('w-3.5 h-3.5', styles.textMuted)} />
                  <h4
                    className={cn(
                      'text-[10px] font-medium uppercase tracking-wider',
                      styles.textMuted
                    )}
                  >
                    Monthly Activity
                  </h4>
                </div>
                <div className={cn('rounded-lg border p-3', styles.card)}>
                  <EChartsBar
                    data={monthlyTrend}
                    xKey="month"
                    series={[
                      {
                        key: 'amount',
                        name: 'Amount',
                        color: category === 'Income' ? '#10b981' : '#f59e0b',
                      },
                    ]}
                    height={140}
                    formatX={(val) => {
                      const [, m] = String(val).split('-')
                      const months = [
                        'Jan',
                        'Feb',
                        'Mar',
                        'Apr',
                        'May',
                        'Jun',
                        'Jul',
                        'Aug',
                        'Sep',
                        'Oct',
                        'Nov',
                        'Dec',
                      ]
                      return months[parseInt(m, 10) - 1] || val
                    }}
                    formatY={(v) => formatStatementAmount(v, currency)}
                    showLegend={false}
                    showGrid={false}
                  />
                </div>
              </div>
            )}

            {/* GL Entries Table */}
            {entries.length > 0 ? (
              (() => {
                const q = searchQuery.toLowerCase().trim()
                const filtered = q
                  ? entries.filter(
                      (e) =>
                        (e.documentNumber || '').toLowerCase().includes(q) ||
                        (e.description || '').toLowerCase().includes(q) ||
                        (e.documentType || '').toLowerCase().includes(q) ||
                        formatDate(e.postingDate).toLowerCase().includes(q)
                    )
                  : entries
                const sorted = sortItems(filtered)
                const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE)
                const pageStart = txPage * ROWS_PER_PAGE
                const pageEnd = pageStart + ROWS_PER_PAGE
                const pageRows = sorted.slice(pageStart, pageEnd)

                return (
                  <div>
                    {/* Search bar */}
                    <div className="relative mb-2">
                      <Search
                        className={cn(
                          'absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5',
                          isLight ? 'text-stone-400' : 'text-stone-500'
                        )}
                      />
                      <input
                        type="text"
                        placeholder="Search entries..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          setTxPage(0)
                        }}
                        className={cn(
                          'w-full pl-8 pr-3 py-1.5 text-xs rounded-md border outline-none transition-colors',
                          isLight
                            ? 'bg-white border-stone-200 text-stone-800 placeholder:text-stone-400 focus:border-amber-400'
                            : 'bg-white/[0.04] border-white/[0.08] text-white placeholder:text-stone-500 focus:border-amber-500/50'
                        )}
                      />
                      {searchQuery && (
                        <span
                          className={cn(
                            'absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px]',
                            styles.textMuted
                          )}
                        >
                          {filtered.length} of {entries.length}
                        </span>
                      )}
                    </div>
                    {/* Pagination header */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn('text-[11px]', styles.textMuted)}>
                          Showing {pageStart + 1}–{Math.min(pageEnd, sorted.length)} of{' '}
                          {sorted.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setTxPage((p) => Math.max(0, p - 1))}
                            disabled={txPage === 0}
                            className={cn(
                              'p-1 rounded transition-colors disabled:opacity-30',
                              isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.05]'
                            )}
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span
                            className={cn(
                              'text-[11px] font-mono tabular-nums px-1',
                              styles.textMuted
                            )}
                          >
                            {txPage + 1} / {totalPages}
                          </span>
                          <button
                            onClick={() => setTxPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={txPage >= totalPages - 1}
                            className={cn(
                              'p-1 rounded transition-colors disabled:opacity-30',
                              isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.05]'
                            )}
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="overflow-auto">
                      <table className="w-full text-xs">
                        <thead className={cn('sticky top-0 z-10 bg-[var(--theme-card-bg)]')}>
                          <tr className={cn('border-b', styles.border)}>
                            {[
                              { key: 'postingDate', label: 'Date', align: 'left' },
                              { key: 'documentNumber', label: 'Document #', align: 'left' },
                              { key: 'documentType', label: 'Type', align: 'left' },
                              { key: 'description', label: 'Description', align: 'left' },
                              { key: 'debitAmount', label: `Debit`, align: 'right' },
                              { key: 'creditAmount', label: `Credit`, align: 'right' },
                              { key: 'netAmount', label: `Net`, align: 'right' },
                            ].map((col) => (
                              <th
                                key={col.key}
                                className={cn(
                                  'py-2 px-2 font-medium whitespace-nowrap',
                                  col.align === 'right' ? 'text-right' : 'text-left',
                                  styles.textMuted
                                )}
                              >
                                <button
                                  onClick={() => handleSort(col.key)}
                                  className={cn(
                                    'flex items-center gap-1 cursor-pointer select-none',
                                    col.align === 'right' && 'justify-end ml-auto'
                                  )}
                                >
                                  {col.label} <SortIcon col={col.key} />
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pageRows.map((entry: GLEntry, i: number) => (
                            <tr
                              key={`${entry.entryNumber}-${i}`}
                              className={cn(
                                'transition-colors',
                                i % 2 === 0
                                  ? isLight
                                    ? 'bg-stone-100/80'
                                    : 'bg-white/[0.02]'
                                  : '',
                                isLight ? 'hover:bg-stone-200/60' : 'hover:bg-white/[0.04]'
                              )}
                            >
                              <td className={cn('py-1.5 px-2 whitespace-nowrap', styles.text)}>
                                {formatDate(entry.postingDate)}
                              </td>
                              <td className={cn('py-1.5 px-2 font-mono font-medium', styles.text)}>
                                {entry.documentNumber || '—'}
                              </td>
                              <td className="py-1.5 px-2">
                                <DocTypeBadge docType={entry.documentType} isLight={isLight} />
                              </td>
                              <td
                                className={cn(
                                  'py-1.5 px-2 max-w-[180px] truncate',
                                  styles.textMuted
                                )}
                                title={entry.description}
                              >
                                {entry.description || '—'}
                              </td>
                              <td
                                className={cn(
                                  'py-1.5 px-2 text-right font-mono tabular-nums whitespace-nowrap',
                                  entry.debitAmount > 0 ? styles.text : styles.textMuted
                                )}
                              >
                                {entry.debitAmount > 0
                                  ? formatCurrency(entry.debitAmount, { currency })
                                  : '—'}
                              </td>
                              <td
                                className={cn(
                                  'py-1.5 px-2 text-right font-mono tabular-nums whitespace-nowrap',
                                  entry.creditAmount > 0 ? styles.text : styles.textMuted
                                )}
                              >
                                {entry.creditAmount > 0
                                  ? formatCurrency(entry.creditAmount, { currency })
                                  : '—'}
                              </td>
                              <td
                                className={cn(
                                  'py-1.5 px-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap',
                                  entry.netAmount > 0
                                    ? isLight
                                      ? 'text-emerald-600'
                                      : 'text-emerald-400'
                                    : entry.netAmount < 0
                                      ? isLight
                                        ? 'text-red-600'
                                        : 'text-red-400'
                                      : styles.textMuted
                                )}
                              >
                                {formatCurrency(entry.netAmount, { currency })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className={cn('sticky bottom-0 z-10 bg-[var(--theme-card-bg)]')}>
                          <tr
                            className={cn(
                              'border-t-2',
                              isLight ? 'border-stone-300' : 'border-white/[0.15]'
                            )}
                          >
                            <td
                              className={cn(
                                'py-2 px-2 font-semibold text-[10px] uppercase tracking-wider',
                                styles.textMuted
                              )}
                              colSpan={4}
                            >
                              Total ({filtered.length} {filtered.length !== 1 ? 'entries' : 'entry'}
                              {searchQuery ? ` matching` : ''})
                            </td>
                            <td
                              className={cn(
                                'py-2 px-2 text-right font-mono tabular-nums font-bold whitespace-nowrap',
                                styles.text
                              )}
                            >
                              {formatCurrency(
                                filtered.reduce((sum, e) => sum + e.debitAmount, 0),
                                { currency }
                              )}
                            </td>
                            <td
                              className={cn(
                                'py-2 px-2 text-right font-mono tabular-nums font-bold whitespace-nowrap',
                                styles.text
                              )}
                            >
                              {formatCurrency(
                                filtered.reduce((sum, e) => sum + e.creditAmount, 0),
                                { currency }
                              )}
                            </td>
                            <td
                              className={cn(
                                'py-2 px-2 text-right font-mono tabular-nums font-bold whitespace-nowrap',
                                (() => {
                                  const net = filtered.reduce((sum, e) => sum + e.netAmount, 0)
                                  return net >= 0
                                    ? isLight
                                      ? 'text-emerald-600'
                                      : 'text-emerald-400'
                                    : isLight
                                      ? 'text-red-600'
                                      : 'text-red-400'
                                })()
                              )}
                            >
                              {formatCurrency(
                                filtered.reduce((sum, e) => sum + e.netAmount, 0),
                                { currency }
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )
              })()
            ) : (
              <p className={cn('text-sm py-4', styles.textMuted)}>
                No general ledger entries found for this account in the selected period.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
