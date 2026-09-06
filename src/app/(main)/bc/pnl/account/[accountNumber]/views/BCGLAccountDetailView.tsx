'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useBCGLAccountDetail } from '../../../../hooks/useBCGLAccountDetail'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import {
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Hash,
  Layers,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import type { GLEntry } from '../../../../hooks/useBCGLAccountDetail'

type SortDir = 'asc' | 'desc'

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
        'inline-block px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide',
        color
      )}
    >
      {docType || 'Journal'}
    </span>
  )
}

export function BCGLAccountDetailView({
  connectionId,
  accountNumber,
}: {
  connectionId: string
  accountNumber: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Read date range from query params (passed from PnL view)
  const startDate = searchParams.get('startDate') || undefined
  const endDate = searchParams.get('endDate') || undefined

  // Build back-link that preserves connectionId and other query params
  const pnlUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (connectionId) params.set('connectionId', connectionId)
    const qs = params.toString()
    return `/bc/pnl${qs ? `?${qs}` : ''}`
  }, [connectionId])

  const { account, entries, currency, summary, isLoading, error, mutate } = useBCGLAccountDetail(
    connectionId,
    accountNumber,
    { startDate, endDate }
  )
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const [sortKey, setSortKey] = useState<string>('postingDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      card: isLight ? 'bg-stone-50 border-stone-200' : 'bg-white/[0.02] border-white/[0.08]',
    }),
    [isLight]
  )

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

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-sm theme-text-secondary">
            {error instanceof Error ? error.message : 'Failed to load account detail.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (isLoading || !account) {
    return (
      <div className="space-y-6 max-w-[1800px] mx-auto">
        {/* Skeleton header */}
        <div className="mb-10 pt-2">
          <div
            className={cn(
              'h-4 w-20 rounded animate-pulse mb-4',
              isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
            )}
          />
          <div
            className={cn(
              'h-9 w-64 rounded animate-pulse mb-2',
              isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
            )}
          />
          <div
            className={cn(
              'h-4 w-32 rounded animate-pulse',
              isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
            )}
          />
        </div>
        {/* Skeleton metrics */}
        <div className={cn('flex flex-wrap gap-x-10 gap-y-4 pt-5 pb-3 border-b', styles.border)}>
          {[...Array(4)].map((_, i) => (
            <div key={i}>
              <div
                className={cn(
                  'h-3 w-16 rounded animate-pulse mb-2',
                  isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
                )}
              />
              <div
                className={cn(
                  'h-8 w-24 rounded animate-pulse',
                  isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
                )}
              />
            </div>
          ))}
        </div>
        {/* Skeleton table */}
        <div className="pt-6">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-10 animate-pulse mb-0.5',
                i % 2 === 0 ? (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]') : ''
              )}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="@container space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-10 pt-2">
        <button
          onClick={() => router.push(pnlUrl)}
          className={cn(
            'flex items-center gap-1.5 text-sm mb-4 transition-colors',
            styles.textMuted,
            'hover:text-amber-500'
          )}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Income Statement
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="dashboard-title text-[36px] font-light theme-text-primary tracking-tight">
              {account.displayName}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-xs font-medium tracking-[0.2em] uppercase text-amber-500/80">
                {account.number}
              </p>
              {account.category && (
                <span
                  className={cn(
                    'inline-block px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide',
                    isLight ? 'bg-stone-200 text-stone-600' : 'bg-white/[0.08] text-stone-400'
                  )}
                >
                  {account.category}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => mutate()}
            disabled={isLoading}
            className="p-1.5 theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Account Info Cards */}
      <div className="grid grid-cols-1 @lg:grid-cols-2 @xl:grid-cols-3 gap-4">
        {/* Account Details */}
        <div className={cn('rounded-lg border p-4 space-y-3', styles.card)}>
          <h3 className={cn('text-xs font-medium uppercase tracking-wider', styles.textMuted)}>
            Account Details
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className={styles.textMuted}>Account Type</span>
              <span className={cn('font-medium', styles.text)}>{account.accountType || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className={styles.textMuted}>Category</span>
              <span className={cn('font-medium', styles.text)}>{account.category || '—'}</span>
            </div>
            {account.subCategory && (
              <div className="flex justify-between">
                <span className={styles.textMuted}>Sub-Category</span>
                <span className={cn('font-medium', styles.text)}>{account.subCategory}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className={styles.textMuted}>Currency</span>
              <span className={cn('font-medium', styles.text)}>{currency}</span>
            </div>
          </div>
        </div>

        {/* Period */}
        <div className={cn('rounded-lg border p-4 space-y-3', styles.card)}>
          <h3 className={cn('text-xs font-medium uppercase tracking-wider', styles.textMuted)}>
            Period
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className={styles.textMuted}>From</span>
              <span className={cn('font-mono text-xs', styles.text)}>
                {startDate ? formatDate(startDate) : 'All time'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={styles.textMuted}>To</span>
              <span className={cn('font-mono text-xs', styles.text)}>
                {endDate ? formatDate(endDate) : 'Present'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={styles.textMuted}>Total Entries</span>
              <span className={cn('font-mono text-xs font-semibold', styles.text)}>
                {summary?.entryCount ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Document Type Breakdown */}
        <div className={cn('rounded-lg border p-4 space-y-3', styles.card)}>
          <h3 className={cn('text-xs font-medium uppercase tracking-wider', styles.textMuted)}>
            By Document Type
          </h3>
          {summary && summary.byDocumentType.length > 0 ? (
            <div className="space-y-2 text-sm">
              {summary.byDocumentType.slice(0, 5).map((dt) => (
                <div key={dt.type} className="flex justify-between">
                  <span className={styles.textMuted}>{dt.type || 'Journal'}</span>
                  <span className={cn('font-mono text-xs', styles.text)}>
                    {dt.count} {dt.count === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className={cn('text-sm', styles.textMuted)}>No entries</p>
          )}
        </div>
      </div>

      {/* Key metrics strip */}
      {summary && (
        <div
          className={cn(
            'flex flex-wrap justify-start gap-x-10 gap-y-4 pt-5 pb-3 border-b',
            styles.border
          )}
        >
          <div>
            <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
              Total Debit
            </div>
            <div className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}>
              {formatCompactCurrency(summary.totalDebit, currency)}
            </div>
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
              Total Credit
            </div>
            <div className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}>
              {formatCompactCurrency(summary.totalCredit, currency)}
            </div>
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
              Net Amount
            </div>
            <div
              className={cn(
                'text-[28px] font-mono font-semibold tabular-nums',
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
            <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
              Entries
            </div>
            <div className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}>
              {summary.entryCount}
            </div>
          </div>
        </div>
      )}

      {/* GL Entries Table */}
      <div className="pt-2">
        <div
          className={cn(
            'flex items-end gap-0 shadow-sm overflow-x-auto',
            isLight ? 'shadow-stone-200/50' : 'shadow-black/20'
          )}
        >
          <div
            className={cn(
              'px-4 py-2.5 text-sm font-medium uppercase tracking-wider flex items-center gap-2',
              styles.text,
              isLight
                ? 'bg-stone-200/80 border-b-2 border-amber-500'
                : 'bg-white/[0.08] border-b-2 border-amber-500'
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            General Ledger Entries
            <span
              className={cn(
                'text-[11px] font-mono px-1.5 py-0.5 rounded',
                isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-400'
              )}
            >
              {entries.length}
            </span>
          </div>
        </div>

        <div className="pt-6">
          {entries.length > 0 ? (
            <div
              className="overflow-auto max-h-[600px] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 dark:[&::-webkit-scrollbar-thumb]:bg-stone-600"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: isLight ? '#a8a29e transparent' : '#57534e transparent',
              }}
            >
              <table className="w-full text-sm">
                <thead className={cn('sticky top-0 z-10', isLight ? 'bg-white' : 'bg-[#0c0c0c]')}>
                  <tr className={cn('border-b', styles.border)}>
                    {[
                      { key: 'postingDate', label: 'Date', align: 'left' },
                      { key: 'documentNumber', label: 'Document #', align: 'left' },
                      { key: 'documentType', label: 'Type', align: 'left' },
                      { key: 'description', label: 'Description', align: 'left' },
                      { key: 'debitAmount', label: `Debit (${currency})`, align: 'right' },
                      { key: 'creditAmount', label: `Credit (${currency})`, align: 'right' },
                      { key: 'netAmount', label: `Net (${currency})`, align: 'right' },
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
                  {sortItems(entries).map((entry: GLEntry, i: number) => (
                    <tr
                      key={`${entry.entryNumber}-${i}`}
                      className={cn(
                        'transition-colors',
                        i % 2 === 0 ? (isLight ? 'bg-stone-100/80' : 'bg-white/[0.02]') : '',
                        isLight ? 'hover:bg-stone-200/60' : 'hover:bg-white/[0.04]'
                      )}
                    >
                      <td className={cn('py-2 px-2 whitespace-nowrap', styles.text)}>
                        {formatDate(entry.postingDate)}
                      </td>
                      <td className={cn('py-2 px-2 font-mono font-medium', styles.text)}>
                        {entry.documentNumber || '—'}
                      </td>
                      <td className="py-2 px-2">
                        <DocTypeBadge docType={entry.documentType} isLight={isLight} />
                      </td>
                      <td
                        className={cn('py-2 px-2 max-w-[300px] truncate', styles.textMuted)}
                        title={entry.description}
                      >
                        {entry.description || '—'}
                      </td>
                      <td
                        className={cn(
                          'py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap',
                          entry.debitAmount > 0 ? styles.text : styles.textMuted
                        )}
                      >
                        {entry.debitAmount > 0
                          ? formatCurrency(entry.debitAmount, { currency })
                          : '—'}
                      </td>
                      <td
                        className={cn(
                          'py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap',
                          entry.creditAmount > 0 ? styles.text : styles.textMuted
                        )}
                      >
                        {entry.creditAmount > 0
                          ? formatCurrency(entry.creditAmount, { currency })
                          : '—'}
                      </td>
                      <td
                        className={cn(
                          'py-2 px-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap',
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
                <tfoot
                  className={cn('sticky bottom-0 z-10', isLight ? 'bg-white' : 'bg-[#0c0c0c]')}
                >
                  <tr
                    className={cn(
                      'border-t-2',
                      isLight ? 'border-stone-300' : 'border-white/[0.15]'
                    )}
                  >
                    <td
                      className={cn(
                        'py-2.5 px-2 font-semibold text-xs uppercase tracking-wider',
                        styles.textMuted
                      )}
                      colSpan={4}
                    >
                      Total ({entries.length} {entries.length !== 1 ? 'entries' : 'entry'})
                    </td>
                    <td
                      className={cn(
                        'py-2.5 px-2 text-right font-mono tabular-nums font-bold whitespace-nowrap',
                        styles.text
                      )}
                    >
                      {formatCurrency(
                        entries.reduce((sum, e) => sum + e.debitAmount, 0),
                        { currency }
                      )}
                    </td>
                    <td
                      className={cn(
                        'py-2.5 px-2 text-right font-mono tabular-nums font-bold whitespace-nowrap',
                        styles.text
                      )}
                    >
                      {formatCurrency(
                        entries.reduce((sum, e) => sum + e.creditAmount, 0),
                        { currency }
                      )}
                    </td>
                    <td
                      className={cn(
                        'py-2.5 px-2 text-right font-mono tabular-nums font-bold whitespace-nowrap',
                        (summary?.netAmount ?? 0) >= 0
                          ? isLight
                            ? 'text-emerald-600'
                            : 'text-emerald-400'
                          : isLight
                            ? 'text-red-600'
                            : 'text-red-400'
                      )}
                    >
                      {formatCurrency(summary?.netAmount ?? 0, { currency })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className={cn('text-sm py-4', styles.textMuted)}>
              No general ledger entries found for this account in the selected period.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
