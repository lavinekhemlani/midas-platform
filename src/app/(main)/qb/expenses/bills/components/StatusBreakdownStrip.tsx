'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface StatusBreakdownStripProps {
  paidCount: number
  unpaidCount: number
  overdueCount: number
  totalBills: number
  paidAmount: number
  unpaidAmount: number
  overdueAmount: number
  totalAmount: number
  isLoading: boolean
}

function Skeleton({ isLight }: { isLight: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div className={cn('h-24 animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')} />
      <div className={cn('h-24 animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')} />
    </div>
  )
}

export function StatusBreakdownStrip({
  paidCount,
  unpaidCount,
  overdueCount,
  totalBills,
  paidAmount,
  unpaidAmount,
  overdueAmount,
  totalAmount,
  isLoading,
}: StatusBreakdownStripProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      barBg: isLight ? 'bg-stone-100' : 'bg-white/[0.04]',
    }),
    [isLight]
  )

  if (isLoading) return <Skeleton isLight={isLight} />

  // Calculate percentages for count bar
  const paidPct = totalBills > 0 ? (paidCount / totalBills) * 100 : 0
  const unpaidPct = totalBills > 0 ? (unpaidCount / totalBills) * 100 : 0
  const overduePct = totalBills > 0 ? (overdueCount / totalBills) * 100 : 0

  // Calculate percentages for amount bar
  const paidAmtPct = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0
  const unpaidAmtPct = totalAmount > 0 ? (unpaidAmount / totalAmount) * 100 : 0

  return (
    <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-8">
      {/* Bills by Count */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={cn('text-xs font-medium', styles.textMuted)}>By Count</span>
          <span className={cn('text-sm font-mono font-semibold', styles.text)}>{totalBills}</span>
        </div>

        {/* Stacked bar */}
        <div className={cn('h-4 flex overflow-hidden rounded-sm mb-3', styles.barBg)}>
          <div
            className="bg-emerald-500 h-full transition-all"
            style={{ width: `${paidPct}%` }}
            title={`Paid: ${paidCount}`}
          />
          <div
            className="bg-amber-500 h-full transition-all"
            style={{ width: `${unpaidPct}%` }}
            title={`Unpaid: ${unpaidCount}`}
          />
          <div
            className="bg-red-500 h-full transition-all"
            style={{ width: `${overduePct}%` }}
            title={`Overdue: ${overdueCount}`}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className={styles.textMuted}>Paid</span>
            <span className={cn('font-mono font-medium', styles.text)}>{paidCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className={styles.textMuted}>Unpaid</span>
            <span className={cn('font-mono font-medium', styles.text)}>{unpaidCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className={styles.textMuted}>Overdue</span>
            <span className={cn('font-mono font-medium', styles.text)}>{overdueCount}</span>
          </div>
        </div>
      </div>

      {/* Bills by Amount */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={cn('text-xs font-medium', styles.textMuted)}>By Amount</span>
          <span className={cn('text-sm font-mono font-semibold', styles.text)}>
            {formatCompactCurrency(totalAmount, 'USD')}
          </span>
        </div>

        {/* Stacked bar */}
        <div className={cn('h-4 flex overflow-hidden rounded-sm mb-3', styles.barBg)}>
          <div
            className="bg-emerald-500 h-full transition-all"
            style={{ width: `${paidAmtPct}%` }}
            title={`Paid: ${formatCompactCurrency(paidAmount, 'USD')}`}
          />
          <div
            className="bg-amber-500 h-full transition-all"
            style={{ width: `${unpaidAmtPct}%` }}
            title={`Unpaid: ${formatCompactCurrency(unpaidAmount, 'USD')}`}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className={styles.textMuted}>Paid</span>
            <span className={cn('font-mono font-medium', styles.text)}>
              {formatCompactCurrency(paidAmount, 'USD')}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className={styles.textMuted}>Unpaid</span>
            <span className={cn('font-mono font-medium', styles.text)}>
              {formatCompactCurrency(unpaidAmount, 'USD')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
