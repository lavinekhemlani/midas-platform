'use client'

import { useMemo } from 'react'
import { Clock, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface VendorPaymentSummary {
  payment_terms_code: string
  vendor_count: number
  total_purchases: number
  total_balance: number
  total_balance_due: number
}

interface VendorPaymentTermsCardProps {
  data: VendorPaymentSummary[]
  isLoading: boolean
  currency?: string
}

function SkeletonLoader({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-2 h-2 rounded-full',
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
                'h-3 w-20 rounded',
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

const barColors = [
  'bg-cyan-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-pink-500',
]

export function VendorPaymentTermsCard({
  data,
  isLoading,
  currency = 'USD',
}: VendorPaymentTermsCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const totalVendors = data.reduce((sum, p) => sum + p.vendor_count, 0)
  const totalPurchases = data.reduce((sum, p) => sum + p.total_purchases, 0)
  const maxPurchases = data.length > 0 ? Math.max(...data.map((p) => p.total_purchases)) : 0

  const styles = useMemo(
    () => ({
      card: isLight
        ? 'bg-white/90 border-stone-200/60 shadow-sm'
        : 'bg-white/[0.02] border-white/[0.06]',
      headerIcon: isLight
        ? 'bg-gradient-to-br from-cyan-50 to-blue-50 text-cyan-500 border border-cyan-100'
        : 'bg-gradient-to-br from-cyan-500/15 to-blue-500/10 text-cyan-400 border border-cyan-500/20',
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
            <Clock className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className={cn('text-sm font-semibold', isLight ? 'text-stone-900' : 'text-white')}>
              Payment Terms
            </h3>
            <p className={cn('text-[11px]', isLight ? 'text-stone-500' : 'text-stone-500')}>
              Vendor payment breakdown
            </p>
          </div>
        </div>
        {!isLoading && data.length > 0 && (
          <span
            className={cn(
              'text-xs font-semibold px-2.5 py-1 rounded-full border',
              isLight
                ? 'bg-cyan-50 text-cyan-600 border-cyan-200/60'
                : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
            )}
          >
            {data.length} terms
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <SkeletonLoader isLight={isLight} />
        ) : data.length > 0 ? (
          <div className="space-y-3">
            {/* Terms List */}
            <div className="space-y-2">
              {data.slice(0, 6).map((terms, i) => {
                const purchasesPercent =
                  totalPurchases > 0 ? (terms.total_purchases / totalPurchases) * 100 : 0
                const barWidth =
                  maxPurchases > 0 ? Math.max(8, (terms.total_purchases / maxPurchases) * 100) : 0
                const overduePercent =
                  terms.total_balance > 0
                    ? (terms.total_balance_due / terms.total_balance) * 100
                    : 0

                return (
                  <div
                    key={terms.payment_terms_code}
                    className={cn('py-2 px-2 rounded-lg transition-colors', styles.rowHover)}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className={cn(
                            'w-2.5 h-2.5 rounded-full flex-shrink-0',
                            barColors[i % barColors.length]
                          )}
                        />
                        <span
                          className={cn(
                            'text-xs font-medium',
                            isLight ? 'text-stone-800' : 'text-stone-200'
                          )}
                        >
                          {terms.payment_terms_code || 'Not Set'}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] flex items-center gap-0.5',
                            isLight ? 'text-stone-500' : 'text-stone-500'
                          )}
                        >
                          <Users className="w-3 h-3" />
                          {terms.vendor_count}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            'text-[10px] tabular-nums',
                            isLight ? 'text-stone-500' : 'text-stone-500'
                          )}
                        >
                          {purchasesPercent.toFixed(1)}%
                        </span>
                        <span
                          className={cn(
                            'text-xs font-mono font-semibold tabular-nums',
                            isLight ? 'text-stone-800' : 'text-stone-200'
                          )}
                        >
                          {formatCompactCurrency(terms.total_purchases, currency)}
                        </span>
                      </div>
                    </div>
                    <div className={cn('w-full h-2 rounded-full overflow-hidden', styles.barBg)}>
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          barColors[i % barColors.length]
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    {overduePercent > 0 && (
                      <div className="flex items-center justify-end mt-1">
                        <span
                          className={cn(
                            'text-[10px] tabular-nums',
                            isLight ? 'text-red-600' : 'text-red-400'
                          )}
                        >
                          {overduePercent.toFixed(0)}% overdue
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Summary */}
            <div className={cn('pt-3 border-t', styles.divider)}>
              <div className="flex items-center justify-between px-1">
                <span className={cn('text-[11px]', isLight ? 'text-stone-500' : 'text-stone-400')}>
                  Total Vendors
                </span>
                <span
                  className={cn(
                    'text-sm font-bold tabular-nums',
                    isLight ? 'text-stone-800' : 'text-white'
                  )}
                >
                  {totalVendors.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-40">
            <p className={cn('text-sm', isLight ? 'text-stone-500' : 'text-stone-400')}>
              No payment terms data available
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
