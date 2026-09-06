'use client'

import { useMemo } from 'react'
import { ShoppingCart, FileText, Truck, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { OutstandingOrdersSummary } from '../hooks/useCustomerInsights'

interface OutstandingOrdersCardProps {
  data: OutstandingOrdersSummary | null
  isLoading: boolean
  currency?: string
}

function SkeletonLoader({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
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

export function OutstandingOrdersCard({
  data,
  isLoading,
  currency = 'USD',
}: OutstandingOrdersCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const totalPipeline = data
    ? data.total_outstanding_orders +
      data.total_outstanding_invoices +
      data.total_shipped_not_invoiced
    : 0

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
            <ShoppingCart className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className={cn('text-sm font-semibold', isLight ? 'text-stone-900' : 'text-white')}>
              Outstanding Orders
            </h3>
            <p className={cn('text-[11px]', isLight ? 'text-stone-500' : 'text-stone-500')}>
              Sales pipeline status
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
              {/* Outstanding Orders */}
              <div className={cn('rounded-xl p-3 border transition-colors', styles.rowBg)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center',
                        isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/15 text-blue-400'
                      )}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span
                        className={cn(
                          'text-xs font-medium block',
                          isLight ? 'text-stone-800' : 'text-stone-200'
                        )}
                      >
                        Open Orders
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
                          {data.customers_with_orders} customers
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
                    {formatCompactCurrency(data.total_outstanding_orders, currency)}
                  </span>
                </div>
              </div>

              {/* Shipped Not Invoiced */}
              <div className={cn('rounded-xl p-3 border transition-colors', styles.rowBg)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center',
                        isLight
                          ? 'bg-orange-100 text-orange-600'
                          : 'bg-orange-500/15 text-orange-400'
                      )}
                    >
                      <Truck className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span
                        className={cn(
                          'text-xs font-medium block',
                          isLight ? 'text-stone-800' : 'text-stone-200'
                        )}
                      >
                        Shipped, Not Invoiced
                      </span>
                      <span
                        className={cn('text-[10px]', isLight ? 'text-stone-500' : 'text-stone-500')}
                      >
                        Ready to bill
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'text-sm font-bold tabular-nums',
                      isLight ? 'text-orange-600' : 'text-orange-400'
                    )}
                  >
                    {formatCompactCurrency(data.total_shipped_not_invoiced, currency)}
                  </span>
                </div>
              </div>

              {/* Outstanding Invoices */}
              <div className={cn('rounded-xl p-3 border transition-colors', styles.rowBg)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center',
                        isLight
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-emerald-500/15 text-emerald-400'
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
                        Open Invoices
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
                          {data.customers_with_invoices} customers
                        </span>
                      </div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'text-sm font-bold tabular-nums',
                      isLight ? 'text-emerald-600' : 'text-emerald-400'
                    )}
                  >
                    {formatCompactCurrency(data.total_outstanding_invoices, currency)}
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
                Pipeline Breakdown
              </div>
              <div className={cn('w-full h-2.5 rounded-full overflow-hidden flex', styles.barBg)}>
                {totalPipeline > 0 && (
                  <>
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${(data.total_outstanding_orders / totalPipeline) * 100}%` }}
                      title={`Orders: ${formatCompactCurrency(data.total_outstanding_orders, currency)}`}
                    />
                    <div
                      className="h-full bg-orange-500 transition-all duration-500"
                      style={{
                        width: `${(data.total_shipped_not_invoiced / totalPipeline) * 100}%`,
                      }}
                      title={`Shipped: ${formatCompactCurrency(data.total_shipped_not_invoiced, currency)}`}
                    />
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{
                        width: `${(data.total_outstanding_invoices / totalPipeline) * 100}%`,
                      }}
                      title={`Invoices: ${formatCompactCurrency(data.total_outstanding_invoices, currency)}`}
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
                    Orders
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-sm bg-orange-500" />
                  <span
                    className={cn('text-[10px]', isLight ? 'text-stone-500' : 'text-stone-500')}
                  >
                    Shipped
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-sm bg-emerald-500" />
                  <span
                    className={cn('text-[10px]', isLight ? 'text-stone-500' : 'text-stone-500')}
                  >
                    Invoiced
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-40">
            <p className={cn('text-sm', isLight ? 'text-stone-500' : 'text-stone-400')}>
              No order data available
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
