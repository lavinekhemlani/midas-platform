'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { CustomerPaymentSummary } from '../hooks/useCustomerInsights'

interface PaymentTermsChartProps {
  data: CustomerPaymentSummary[]
  isLoading: boolean
  currency?: string
}

// Color palette for payment terms
const termColors = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
]

function Skeleton({ isLight }: { isLight: boolean }) {
  return (
    <div>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-7 animate-pulse',
            i % 2 === 0 ? (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]') : ''
          )}
        />
      ))}
    </div>
  )
}

export function PaymentTermsChart({ data, isLoading, currency = 'USD' }: PaymentTermsChartProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  // Sort by total sales and take top 6
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b.total_sales - a.total_sales).slice(0, 6)
  }, [data])

  // Calculate max for bar scaling
  const maxSales = useMemo(() => {
    return Math.max(...sortedData.map((d) => d.total_sales), 1)
  }, [sortedData])

  // Calculate totals
  const totals = useMemo(() => {
    return {
      customers: data.reduce((sum, d) => sum + d.customer_count, 0),
      sales: data.reduce((sum, d) => sum + d.total_sales, 0),
      balance: data.reduce((sum, d) => sum + d.total_balance, 0),
      overdue: data.reduce((sum, d) => sum + d.total_balance_due, 0),
    }
  }, [data])

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      barBg: isLight ? 'bg-stone-100' : 'bg-white/[0.04]',
    }),
    [isLight]
  )

  if (isLoading) return <Skeleton isLight={isLight} />

  if (!data.length) {
    return (
      <div className={cn('py-6 text-center text-sm', styles.textMuted)}>No payment terms data</div>
    )
  }

  return (
    <div>
      {/* Summary stats */}
      <div className={cn('flex gap-6 pb-3 mb-3 border-b text-xs', styles.border)}>
        <div>
          <span className={styles.textMuted}>Terms </span>
          <span className={cn('font-mono font-medium', styles.text)}>{data.length}</span>
        </div>
        <div>
          <span className={styles.textMuted}>Total Sales </span>
          <span className={cn('font-mono font-medium', styles.text)}>
            {formatCompactCurrency(totals.sales, currency)}
          </span>
        </div>
        <div>
          <span className={styles.textMuted}>Overdue </span>
          <span
            className={cn(
              'font-mono font-medium',
              totals.overdue > 0 ? (isLight ? 'text-red-600' : 'text-red-400') : styles.textMuted
            )}
          >
            {totals.overdue > 0 ? formatCompactCurrency(totals.overdue, currency) : '—'}
          </span>
        </div>
      </div>

      {/* Header row */}
      <div
        className={cn('flex items-center gap-2 py-1.5 px-2 text-xs border-b mb-0.5', styles.border)}
      >
        <span className={cn('w-14 text-right font-medium', styles.textMuted)}>Terms</span>
        <span className={cn('flex-1 font-medium', styles.textMuted)}>Sales</span>
        <span className={cn('w-10 text-right font-medium', styles.textMuted)}>Count</span>
        <span className={cn('w-10 text-right font-medium', styles.textMuted)}>Due</span>
      </div>

      {/* Horizontal bar chart - matching inventory styling */}
      <div>
        {sortedData.map((term, i) => {
          const barWidth = (term.total_sales / maxSales) * 100
          const overdueRatio =
            term.total_balance > 0 ? (term.total_balance_due / term.total_balance) * 100 : 0
          const color = termColors[i % termColors.length]

          return (
            <div
              key={term.payment_terms_code}
              className={cn(
                'flex items-center gap-2 py-1.5 px-2 text-xs transition-colors',
                i % 2 === 0 ? (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]') : '',
                isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]'
              )}
            >
              {/* Term code */}
              <div
                className={cn('w-14 font-mono font-medium truncate text-right', styles.text)}
                title={term.payment_terms_code || 'Not Set'}
              >
                {term.payment_terms_code || 'None'}
              </div>

              {/* Bar */}
              <div className={cn('flex-1 h-5 relative', styles.barBg)}>
                <div
                  className="h-full transition-all duration-500 flex items-center justify-end pr-2"
                  style={{
                    width: `${Math.max(barWidth, 2)}%`,
                    backgroundColor: color,
                  }}
                >
                  {barWidth > 25 && (
                    <span className="text-[10px] font-mono text-white/90 tabular-nums">
                      {formatCompactCurrency(term.total_sales, currency)}
                    </span>
                  )}
                </div>
              </div>

              {/* Customer count */}
              <div
                className={cn(
                  'w-10 text-right font-mono tabular-nums text-[10px] font-medium',
                  styles.textMuted
                )}
              >
                {term.customer_count}
              </div>

              {/* Overdue indicator */}
              <div className="w-10 text-right">
                <span
                  className={cn(
                    'font-mono text-[10px] tabular-nums font-medium',
                    overdueRatio > 30
                      ? isLight
                        ? 'text-red-600'
                        : 'text-red-400'
                      : overdueRatio > 15
                        ? isLight
                          ? 'text-amber-600'
                          : 'text-amber-400'
                        : styles.textMuted
                  )}
                >
                  {overdueRatio > 0 ? `${overdueRatio.toFixed(0)}%` : '—'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Total row */}
      <div className={cn('pt-3 mt-3 border-t flex justify-between', styles.border)}>
        <span
          className={cn('text-[9px] uppercase tracking-widest font-semibold', styles.textMuted)}
        >
          Total Sales
        </span>
        <span
          className={cn('text-base font-mono font-bold tabular-nums tracking-tight', styles.text)}
        >
          {formatCompactCurrency(totals.sales, currency)}
        </span>
      </div>
    </div>
  )
}
