'use client'

import { useMemo } from 'react'
import { Wallet, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface CustomerBalance {
  no: string
  name: string
  balance_lcy: number
  balance_due_lcy: number
  credit_limit_lcy: number
  sales_lcy: number
  payment_terms_code: string
}

interface TopCustomersByBalanceCardProps {
  data: CustomerBalance[]
  isLoading: boolean
  currency?: string
}

function SkeletonLoader({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div
              className={cn(
                'h-3 w-32 rounded',
                isLight ? 'bg-stone-200 animate-pulse' : 'bg-white/10 animate-pulse'
              )}
            />
            <div
              className={cn(
                'h-3 w-16 rounded',
                isLight ? 'bg-stone-200 animate-pulse' : 'bg-white/10 animate-pulse'
              )}
            />
          </div>
          <div
            className={cn(
              'h-2 rounded-full',
              isLight ? 'bg-stone-100 animate-pulse' : 'bg-white/[0.02] animate-pulse'
            )}
          />
        </div>
      ))}
    </div>
  )
}

export function TopCustomersByBalanceCard({
  data,
  isLoading,
  currency = 'USD',
}: TopCustomersByBalanceCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const maxBalance = data.length > 0 ? Math.max(...data.map((c) => c.balance_lcy)) : 0
  const totalBalance = data.reduce((sum, c) => sum + c.balance_lcy, 0)

  const styles = useMemo(
    () => ({
      card: isLight
        ? 'bg-white/90 border-stone-200/60 shadow-sm'
        : 'bg-white/[0.02] border-white/[0.06]',
      headerIcon: isLight
        ? 'bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-500 border border-emerald-100'
        : 'bg-gradient-to-br from-emerald-500/15 to-teal-500/10 text-emerald-400 border border-emerald-500/20',
      barBg: isLight ? 'bg-stone-100' : 'bg-white/[0.06]',
      rowHover: isLight ? 'hover:bg-stone-50/80' : 'hover:bg-white/[0.03]',
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
            <Wallet className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className={cn('text-sm font-semibold', isLight ? 'text-stone-900' : 'text-white')}>
              Top AR Balances
            </h3>
            <p className={cn('text-[11px]', isLight ? 'text-stone-500' : 'text-stone-500')}>
              Accounts receivable by customer
            </p>
          </div>
        </div>
        {!isLoading && data.length > 0 && (
          <span
            className={cn(
              'text-base font-bold tabular-nums',
              isLight ? 'text-emerald-600' : 'text-emerald-400'
            )}
          >
            {formatCompactCurrency(totalBalance, currency)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <SkeletonLoader isLight={isLight} />
        ) : data.length > 0 ? (
          <div className="space-y-3">
            {/* Customer List */}
            <div className="space-y-2">
              {data.slice(0, 8).map((customer) => {
                const barWidth =
                  maxBalance > 0 ? Math.max(8, (customer.balance_lcy / maxBalance) * 100) : 0
                const hasOverdue = customer.balance_due_lcy > 0
                const overduePercent =
                  customer.balance_lcy > 0
                    ? (customer.balance_due_lcy / customer.balance_lcy) * 100
                    : 0

                return (
                  <div
                    key={customer.no}
                    className={cn('py-2 px-2 rounded-lg transition-colors', styles.rowHover)}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {hasOverdue && (
                          <AlertTriangle
                            className={cn(
                              'w-3.5 h-3.5 flex-shrink-0',
                              isLight ? 'text-red-500' : 'text-red-400'
                            )}
                          />
                        )}
                        <span
                          className={cn(
                            'text-xs truncate font-medium',
                            isLight ? 'text-stone-700' : 'text-stone-300'
                          )}
                          title={customer.name}
                        >
                          {customer.name.length > 22
                            ? customer.name.substring(0, 22) + '...'
                            : customer.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        {hasOverdue && (
                          <span
                            className={cn(
                              'text-[10px] tabular-nums',
                              isLight ? 'text-red-600' : 'text-red-400'
                            )}
                          >
                            {overduePercent.toFixed(0)}% due
                          </span>
                        )}
                        <span
                          className={cn(
                            'text-xs font-mono font-semibold tabular-nums',
                            isLight ? 'text-stone-800' : 'text-stone-200'
                          )}
                        >
                          {formatCompactCurrency(customer.balance_lcy, currency)}
                        </span>
                      </div>
                    </div>
                    <div className={cn('w-full h-2 rounded-full overflow-hidden', styles.barBg)}>
                      {hasOverdue ? (
                        <div className="h-full flex">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${barWidth * (1 - overduePercent / 100)}%` }}
                          />
                          <div
                            className="h-full bg-red-500 transition-all duration-500"
                            style={{ width: `${barWidth * (overduePercent / 100)}%` }}
                          />
                        </div>
                      ) : (
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div
              className={cn('pt-3 border-t flex items-center justify-center gap-6', styles.divider)}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm bg-emerald-500" />
                <span className={cn('text-[10px]', isLight ? 'text-stone-500' : 'text-stone-500')}>
                  Current
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm bg-red-500" />
                <span className={cn('text-[10px]', isLight ? 'text-stone-500' : 'text-stone-500')}>
                  Overdue
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-40">
            <p className={cn('text-sm', isLight ? 'text-stone-500' : 'text-stone-400')}>
              No balance data available
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
