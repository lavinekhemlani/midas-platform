'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useBCBankAccountDetail } from '../../hooks/useBCBankAccountDetail'
import { EChartsBar } from '@/components/charts/echarts'
import { formatStatementAmount } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import {
  Loader2,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  X,
  Search,
  Landmark,
} from 'lucide-react'

const ROWS_PER_PAGE = 20

interface BankAccountDetailDrawerProps {
  open: boolean
  onClose: () => void
  connectionId: string
  accountNumber: string | null
  accountName: string | null
  startDate: string
  endDate: string
  currency: string
}

export function BankAccountDetailDrawer({
  open,
  onClose,
  connectionId,
  accountNumber,
  accountName,
  startDate,
  endDate,
  currency,
}: BankAccountDetailDrawerProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [open, accountNumber])

  const { data, isLoading, error } = useBCBankAccountDetail(
    open ? connectionId : null,
    open ? accountNumber : null,
    startDate,
    endDate
  )

  const [txPage, setTxPage] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  useEffect(() => {
    setTxPage(0)
    setSearchQuery('')
  }, [accountNumber])

  const trendChartData = useMemo(() => {
    if (!data?.monthlyTrend) return []
    return data.monthlyTrend.map((m) => ({
      month: m.month,
      inflow: m.inflow,
      outflow: -m.outflow,
    }))
  }, [data?.monthlyTrend])

  const chartSeries = useMemo(
    () => [
      { key: 'inflow', name: 'Inflow', color: isLight ? '#16a34a' : '#4ade80' },
      { key: 'outflow', name: 'Outflow', color: isLight ? '#dc2626' : '#f87171' },
    ],
    [isLight]
  )

  const formatMonth = (val: any) => {
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
  }

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
                  isLight ? 'bg-amber-500/10 text-amber-600' : 'bg-amber-500/20 text-amber-400'
                )}
              >
                Bank Account
              </span>
            </div>
            <h3 className={cn('text-lg font-semibold', isLight ? 'text-stone-900' : 'text-white')}>
              {accountName || data?.accountName || accountNumber || 'Account Detail'}
            </h3>
            <p
              className={cn(
                'text-xs font-mono mt-1',
                isLight ? 'text-stone-500' : 'text-stone-500'
              )}
            >
              {accountNumber} &middot; {startDate} to {endDate}
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

        {!isLoading && !error && data && (
          <>
            {/* Summary Metrics */}
            <div>
              <h4
                className={cn(
                  'text-[11px] uppercase tracking-wider font-medium mb-3',
                  isLight ? 'text-stone-400' : 'text-stone-500'
                )}
              >
                Period Summary
              </h4>
              <div className="grid grid-cols-4 gap-3">
                <MetricBox
                  label="Total Inflow"
                  value={data.totalDebit}
                  currency={currency}
                  isLight={isLight}
                  icon={<ArrowDownRight className="w-3 h-3 text-green-500" />}
                  valueColor="text-green-500"
                />
                <MetricBox
                  label="Total Outflow"
                  value={data.totalCredit}
                  currency={currency}
                  isLight={isLight}
                  icon={<ArrowUpRight className="w-3 h-3 text-red-500" />}
                  valueColor="text-red-500"
                />
                <MetricBox
                  label="Net Change"
                  value={data.netAmount}
                  currency={currency}
                  isLight={isLight}
                  valueColor={
                    data.netAmount >= 0
                      ? isLight
                        ? 'text-green-600'
                        : 'text-green-400'
                      : isLight
                        ? 'text-red-600'
                        : 'text-red-400'
                  }
                />
                <MetricBox
                  label="Balance"
                  value={data.balance}
                  currency={currency}
                  isLight={isLight}
                  icon={<Landmark className="w-3 h-3 text-amber-500" />}
                  valueColor={
                    data.balance >= 0
                      ? isLight
                        ? 'text-green-600'
                        : 'text-green-400'
                      : isLight
                        ? 'text-red-600'
                        : 'text-red-400'
                  }
                />
              </div>
            </div>

            {/* Monthly Trend */}
            {trendChartData.length > 1 && (
              <div>
                <h4
                  className={cn(
                    'text-[11px] uppercase tracking-wider font-medium mb-3',
                    isLight ? 'text-stone-400' : 'text-stone-500'
                  )}
                >
                  Monthly Activity
                </h4>
                <div
                  className={cn(
                    'rounded-lg border border-[var(--theme-card-border)] p-3',
                    isLight ? 'bg-[var(--theme-bg)]' : 'bg-white/[0.02]'
                  )}
                >
                  <EChartsBar
                    data={trendChartData}
                    xKey="month"
                    series={chartSeries}
                    height={160}
                    formatX={formatMonth}
                    formatY={(v) => formatStatementAmount(Math.abs(v), currency)}
                    showLegend={true}
                    showGrid={false}
                  />
                </div>
              </div>
            )}

            {/* Top Counterparties */}
            {data.topCounterparties.length > 0 && (
              <div>
                <h4
                  className={cn(
                    'text-[11px] uppercase tracking-wider font-medium mb-3',
                    isLight ? 'text-stone-400' : 'text-stone-500'
                  )}
                >
                  Top Sources &amp; Uses ({data.topCounterparties.length})
                </h4>
                <div
                  className={cn(
                    'rounded-lg border border-[var(--theme-card-border)] overflow-hidden'
                  )}
                >
                  <div
                    className={cn(
                      'grid grid-cols-[1fr_80px_80px_50px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider font-medium border-b border-[var(--theme-card-border)]',
                      isLight
                        ? 'bg-[var(--theme-bg)] text-stone-500'
                        : 'bg-white/[0.02] text-stone-500'
                    )}
                  >
                    <span>Description</span>
                    <span className="text-right">Inflow</span>
                    <span className="text-right">Outflow</span>
                    <span className="text-right">#</span>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    {data.topCounterparties.map((cp, i) => (
                      <div
                        key={`${cp.name}-${i}`}
                        className={cn(
                          'grid grid-cols-[1fr_80px_80px_50px] gap-2 px-3 py-1.5 text-[12px] border-b last:border-b-0',
                          i % 2 === 0
                            ? isLight
                              ? 'bg-white'
                              : 'bg-transparent'
                            : isLight
                              ? 'bg-stone-50/60'
                              : 'bg-white/[0.01]',
                          isLight ? 'border-stone-100' : 'border-white/[0.04]'
                        )}
                      >
                        <span
                          className={cn('truncate', isLight ? 'text-stone-700' : 'text-stone-300')}
                          title={cp.name}
                        >
                          {cp.name}
                        </span>
                        <span
                          className={cn(
                            'text-right font-mono tabular-nums text-[11px]',
                            isLight ? 'text-green-600' : 'text-green-400'
                          )}
                        >
                          {cp.debit > 0 ? formatStatementAmount(cp.debit, currency) : '—'}
                        </span>
                        <span
                          className={cn(
                            'text-right font-mono tabular-nums text-[11px]',
                            isLight ? 'text-red-600' : 'text-red-400'
                          )}
                        >
                          {cp.credit > 0 ? formatStatementAmount(cp.credit, currency) : '—'}
                        </span>
                        <span
                          className={cn(
                            'text-right font-mono tabular-nums text-[11px]',
                            isLight ? 'text-stone-400' : 'text-stone-500'
                          )}
                        >
                          {cp.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Transactions */}
            {data.transactions.length > 0 &&
              (() => {
                const q = searchQuery.toLowerCase().trim()
                const filtered = q
                  ? data.transactions.filter(
                      (tx) =>
                        (tx.description || '').toLowerCase().includes(q) ||
                        (tx.documentNumber || '').toLowerCase().includes(q) ||
                        (tx.documentType || '').toLowerCase().includes(q) ||
                        (tx.postingDate || '').includes(q)
                    )
                  : data.transactions
                const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE)
                const pageStart = txPage * ROWS_PER_PAGE
                const pageEnd = pageStart + ROWS_PER_PAGE
                const pageRows = filtered.slice(pageStart, pageEnd)

                return (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4
                        className={cn(
                          'text-[11px] uppercase tracking-wider font-medium',
                          isLight ? 'text-stone-400' : 'text-stone-500'
                        )}
                      >
                        Transactions ({filtered.length}
                        {searchQuery ? ` of ${data.transactions.length}` : ''} entries)
                      </h4>
                      {totalPages > 1 && (
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
                              isLight ? 'text-stone-500' : 'text-stone-400'
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
                            <ChevronRightIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Search */}
                    <div className="relative mb-3">
                      <Search
                        className={cn(
                          'absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5',
                          isLight ? 'text-stone-400' : 'text-stone-500'
                        )}
                      />
                      <input
                        type="text"
                        placeholder="Search transactions..."
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
                    </div>
                    <div
                      className={cn(
                        'rounded-lg border border-[var(--theme-card-border)] overflow-hidden'
                      )}
                    >
                      <div
                        className={cn(
                          'grid grid-cols-[80px_1fr_80px_80px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider font-medium border-b border-[var(--theme-card-border)]',
                          isLight
                            ? 'bg-[var(--theme-bg)] text-stone-500'
                            : 'bg-white/[0.02] text-stone-500'
                        )}
                      >
                        <span>Date</span>
                        <span>Description</span>
                        <span className="text-right">Debit</span>
                        <span className="text-right">Credit</span>
                      </div>
                      <div>
                        {pageRows.map((tx, i) => (
                          <div
                            key={`${tx.postingDate}-${tx.documentNumber}-${pageStart + i}`}
                            className={cn(
                              'grid grid-cols-[80px_1fr_80px_80px] gap-2 px-3 py-1.5 text-[12px] border-b last:border-b-0',
                              i % 2 === 0
                                ? isLight
                                  ? 'bg-white'
                                  : 'bg-transparent'
                                : isLight
                                  ? 'bg-stone-50/60'
                                  : 'bg-white/[0.01]',
                              isLight ? 'border-stone-100' : 'border-white/[0.04]'
                            )}
                          >
                            <span
                              className={cn(
                                'font-mono text-[11px]',
                                isLight ? 'text-stone-600' : 'text-stone-400'
                              )}
                            >
                              {tx.postingDate}
                            </span>
                            <span
                              className={cn(
                                'truncate',
                                isLight ? 'text-stone-700' : 'text-stone-300'
                              )}
                              title={`${tx.documentNumber}: ${tx.description || tx.documentType}`}
                            >
                              {tx.description || tx.documentNumber || tx.documentType}
                            </span>
                            <span
                              className={cn(
                                'text-right font-mono tabular-nums',
                                tx.debitAmount > 0
                                  ? isLight
                                    ? 'text-green-600'
                                    : 'text-green-400'
                                  : isLight
                                    ? 'text-stone-300'
                                    : 'text-stone-600'
                              )}
                            >
                              {tx.debitAmount > 0
                                ? formatStatementAmount(tx.debitAmount, currency)
                                : '—'}
                            </span>
                            <span
                              className={cn(
                                'text-right font-mono tabular-nums',
                                tx.creditAmount > 0
                                  ? isLight
                                    ? 'text-red-600'
                                    : 'text-red-400'
                                  : isLight
                                    ? 'text-stone-300'
                                    : 'text-stone-600'
                              )}
                            >
                              {tx.creditAmount > 0
                                ? formatStatementAmount(tx.creditAmount, currency)
                                : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                      {totalPages > 1 && (
                        <div
                          className={cn(
                            'px-3 py-1.5 text-[10px] border-t border-[var(--theme-card-border)]',
                            isLight
                              ? 'text-stone-400 bg-[var(--theme-bg)]'
                              : 'text-stone-500 bg-white/[0.02]'
                          )}
                        >
                          Showing {pageStart + 1}–{Math.min(pageEnd, filtered.length)} of{' '}
                          {filtered.length}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

            {data.transactions.length === 0 && (
              <div
                className={cn(
                  'text-center py-10 text-sm',
                  isLight ? 'text-stone-400' : 'text-stone-500'
                )}
              >
                No transactions found for this account in the selected period
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function MetricBox({
  label,
  value,
  currency,
  isLight,
  icon,
  valueColor,
  highlight,
}: {
  label: string
  value: number
  currency: string
  isLight: boolean
  icon?: React.ReactNode
  valueColor?: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5',
        highlight
          ? isLight
            ? 'border-amber-200 bg-amber-50/50'
            : 'border-amber-500/20 bg-amber-500/5'
          : isLight
            ? 'border-[var(--theme-card-border)] bg-[var(--theme-bg)]'
            : 'border-[var(--theme-card-border)] bg-white/[0.02]'
      )}
    >
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <span
          className={cn(
            'text-[10px] uppercase tracking-wider',
            isLight ? 'text-stone-400' : 'text-stone-500'
          )}
        >
          {label}
        </span>
      </div>
      <div
        className={cn(
          'text-[14px] font-mono font-semibold tabular-nums',
          valueColor || (highlight ? 'text-amber-500' : isLight ? 'text-stone-800' : 'text-white')
        )}
      >
        {formatStatementAmount(value, currency)}
      </div>
    </div>
  )
}
