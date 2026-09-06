'use client'

import { useMemo } from 'react'
import { Receipt, FileText, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface OutstandingPayablesSummary {
  total_outstanding_ap: number
  total_overdue_ap: number
  vendors_with_balance: number
  vendors_with_overdue: number
}

interface OutstandingPayablesCardProps {
  data: OutstandingPayablesSummary | null
  isLoading: boolean
  currency?: string
}

function SkeletonLoader({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-3">
      {[...Array(2)].map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-xl p-3 animate-pulse',
            isLight ? 'bg-stone-100/50' : 'bg-white/[0.02]'
          )}
        >
          <div className="flex items-center justify-between">
            <div className={cn('h-3 w-24 rounded', isLight ? 'bg-stone-200' : 'bg-white/10')} />
            <div className={cn('h-4 w-16 rounded', isLight ? 'bg-stone-200' : 'bg-white/10')} />
          </div>
        </div>
      ))}
      <div
        className={cn(
          'h-3 rounded-full animate-pulse mt-4',
          isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
        )}
      />
    </div>
  )
}

export function OutstandingPayablesCard({
  data,
  isLoading,
  currency = 'USD',
}: OutstandingPayablesCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const totalPipeline = data ? data.total_outstanding_ap : 0
  const overdueAmount = data ? data.total_overdue_ap : 0
  const currentAmount = data ? totalPipeline - overdueAmount : 0
  const overduePercentage = totalPipeline > 0 ? (overdueAmount / totalPipeline) * 100 : 0

  const styles = useMemo(
    () => ({
      card: isLight
        ? 'bg-white/90 border-stone-200/60 shadow-sm'
        : 'bg-white/[0.02] border-white/[0.06]',
      headerIcon: isLight
        ? 'bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-500 border border-blue-100'
        : 'bg-gradient-to-br from-blue-500/15 to-indigo-500/10 text-blue-400 border border-blue-500/20',
      rowBg: isLight
        ? 'bg-stone-50/50 border-stone-200/40 hover:bg-stone-50'
        : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.03]',
      barBg: isLight ? 'bg-stone-100' : 'bg-white/[0.06]',
      divider: isLight ? 'border-stone-200/60' : 'border-white/[0.06]',
    }),
    [isLight]
  )

  return (
    <div
      className={cn(
        'rounded-2xl border p-5 transition-all duration-300 flex flex-col h-full',
        styles.card
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn('w-9 h-9 rounded-xl flex items-center justify-center', styles.headerIcon)}
          >
            <Receipt className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className={cn('text-sm font-semibold', isLight ? 'text-stone-900' : 'text-white')}>
              Outstanding Payables
            </h3>
            <p className={cn('text-[11px]', isLight ? 'text-stone-500' : 'text-stone-500')}>
              Accounts payable status
            </p>
          </div>
        </div>
        {!isLoading && data && (
          <span
            className={cn(
              'text-base font-bold tabular-nums',
              isLight ? 'text-blue-600' : 'text-blue-400'
            )}
          >
            {formatCompactCurrency(totalPipeline, currency)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <SkeletonLoader isLight={isLight} />
        ) : data ? (
          <div className="space-y-3">
            {/* Pipeline Breakdown */}
            <div className="space-y-2">
              {/* Current AP */}
              <div className={cn('rounded-xl p-3 border transition-colors', styles.rowBg)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center',
                        isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/15 text-blue-400'
                      )}
                    >
                      <Receipt className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span
                        className={cn(
                          'text-xs font-medium block',
                          isLight ? 'text-stone-800' : 'text-stone-200'
                        )}
                      >
                        Current AP
                      </span>
                      <div className="flex items-center gap-1">
                        <Users
                          className={cn('w-3 h-3', isLight ? 'text-stone-400' : 'text-stone-500')}
                        />
                        <span
                          className={cn(
                            'text-[10px]',
                            isLight ? 'text-stone-500' : 'text-stone-500'
                          )}
                        >
                          {data.vendors_with_balance} vendors
                        </span>
                      </div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'text-sm font-bold tabular-nums',
                      isLight ? 'text-blue-600' : 'text-blue-400'
                    )}
                  >
                    {formatCompactCurrency(currentAmount, currency)}
                  </span>
                </div>
              </div>

              {/* Overdue */}
              <div className={cn('rounded-xl p-3 border transition-colors', styles.rowBg)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center',
                        isLight ? 'bg-red-100 text-red-600' : 'bg-red-500/15 text-red-400'
                      )}
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span
                        className={cn(
                          'text-xs font-medium block',
                          isLight ? 'text-stone-800' : 'text-stone-200'
                        )}
                      >
                        Overdue
                      </span>
                      <span
                        className={cn('text-[10px]', isLight ? 'text-stone-500' : 'text-stone-500')}
                      >
                        {overduePercentage.toFixed(1)}% of total ({data.vendors_with_overdue}{' '}
                        vendors)
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'text-sm font-bold tabular-nums',
                      isLight ? 'text-red-600' : 'text-red-400'
                    )}
                  >
                    {formatCompactCurrency(overdueAmount, currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Pipeline Visualization */}
            <div className={cn('pt-3 border-t', styles.divider)}>
              <div
                className={cn(
                  'text-[10px] uppercase tracking-wider font-semibold mb-2 px-1',
                  isLight ? 'text-stone-500' : 'text-stone-500'
                )}
              >
                AP Breakdown
              </div>
              <div className={cn('w-full h-2.5 rounded-full overflow-hidden flex', styles.barBg)}>
                {totalPipeline > 0 && (
                  <>
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${(currentAmount / totalPipeline) * 100}%` }}
                      title={`Current: ${formatCompactCurrency(currentAmount, currency)}`}
                    />
                    <div
                      className="h-full bg-red-500 transition-all duration-500"
                      style={{ width: `${overduePercentage}%` }}
                      title={`Overdue: ${formatCompactCurrency(overdueAmount, currency)}`}
                    />
                  </>
                )}
              </div>
              <div className="flex justify-between mt-2 px-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-sm bg-blue-500" />
                  <span
                    className={cn('text-[10px]', isLight ? 'text-stone-500' : 'text-stone-500')}
                  >
                    Current
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-sm bg-red-500" />
                  <span
                    className={cn('text-[10px]', isLight ? 'text-stone-500' : 'text-stone-500')}
                  >
                    Overdue
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-40">
            <p className={cn('text-sm', isLight ? 'text-stone-500' : 'text-stone-400')}>
              No payables data available
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
