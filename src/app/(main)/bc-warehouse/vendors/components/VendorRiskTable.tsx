'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { VendorPaymentRiskRow, PaymentRiskSummary } from '../hooks/useVendorInsights'

interface VendorRiskTableProps {
  data: VendorPaymentRiskRow[]
  summary: PaymentRiskSummary | null
  isLoading: boolean
  currency?: string
}

const riskColors = {
  critical: { light: 'text-red-600', dark: 'text-red-400' },
  high: { light: 'text-orange-600', dark: 'text-orange-400' },
  medium: { light: 'text-amber-600', dark: 'text-amber-400' },
  low: { light: 'text-stone-400', dark: 'text-stone-500' },
}

function Skeleton({ isLight }: { isLight: boolean }) {
  return (
    <div>
      {[...Array(8)].map((_, i) => (
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

export function VendorRiskTable({
  data,
  summary,
  isLoading,
  currency = 'USD',
}: VendorRiskTableProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const sortedData = useMemo(() => {
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return [...data]
      .sort((a, b) => {
        const diff = riskOrder[a.risk_score] - riskOrder[b.risk_score]
        if (diff !== 0) return diff
        return b.balance_due_lcy - a.balance_due_lcy
      })
      .slice(0, 12)
  }, [data])

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
    }),
    [isLight]
  )

  if (isLoading) return <Skeleton isLight={isLight} />

  if (!data.length) {
    return (
      <div className={cn('py-8 text-center text-sm', styles.textMuted)}>No payment risk data</div>
    )
  }

  return (
    <div>
      {/* Summary row */}
      {summary && (
        <div className={cn('flex gap-8 pb-3 mb-3 border-b text-xs', styles.border)}>
          <div>
            <span className={styles.textMuted}>AP Balance </span>
            <span className={cn('font-mono font-medium', styles.text)}>
              {formatCompactCurrency(summary.total_balance, currency)}
            </span>
          </div>
          <div>
            <span className={styles.textMuted}>Overdue </span>
            <span
              className={cn('font-mono font-medium', isLight ? 'text-red-600' : 'text-red-400')}
            >
              {formatCompactCurrency(summary.total_balance_due, currency)}
            </span>
          </div>
          <div>
            <span className={styles.textMuted}>Ratio </span>
            <span className={cn('font-mono font-medium', styles.text)}>
              {summary.overdue_ratio.toFixed(0)}%
            </span>
          </div>
          <div>
            <span className={styles.textMuted}>At Risk </span>
            <span
              className={cn(
                'font-mono font-medium',
                summary.high_risk_vendors > 0
                  ? isLight
                    ? 'text-red-600'
                    : 'text-red-400'
                  : styles.text
              )}
            >
              {summary.high_risk_vendors}
            </span>
          </div>
        </div>
      )}

      {/* Header row */}
      <div
        className={cn('flex items-center gap-2 py-1.5 px-2 text-xs border-b mb-0.5', styles.border)}
      >
        <span className={cn('flex-1 font-medium', styles.textMuted)}>Vendor</span>
        <span className={cn('w-16 text-right font-medium', styles.textMuted)}>Balance</span>
        <span className={cn('w-16 text-right font-medium', styles.textMuted)}>Overdue</span>
        <span className={cn('w-12 text-right font-medium', styles.textMuted)}>Ratio</span>
        <span className={cn('w-10 text-right font-medium', styles.textMuted)}>Risk</span>
      </div>

      {/* Data rows - matching inventory list styling */}
      <div
        className="max-h-[280px] overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 dark:[&::-webkit-scrollbar-thumb]:bg-stone-600"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: isLight ? '#a8a29e transparent' : '#57534e transparent',
        }}
      >
        {sortedData.map((vendor, i) => {
          const riskColor = riskColors[vendor.risk_score]
          return (
            <div
              key={vendor.no}
              className={cn(
                'flex items-center gap-2 py-1.5 px-2 text-xs transition-colors',
                i % 2 === 0 ? (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]') : '',
                isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]'
              )}
            >
              <span className={cn('flex-1 truncate font-medium', styles.text)} title={vendor.name}>
                {vendor.name}
              </span>
              <span
                className={cn('w-16 text-right font-mono tabular-nums text-[11px]', styles.text)}
              >
                {formatCompactCurrency(vendor.balance_lcy, currency)}
              </span>
              <span
                className={cn(
                  'w-16 text-right font-mono tabular-nums text-[11px]',
                  vendor.balance_due_lcy > 0
                    ? isLight
                      ? 'text-red-600'
                      : 'text-red-400'
                    : styles.textMuted
                )}
              >
                {vendor.balance_due_lcy > 0
                  ? formatCompactCurrency(vendor.balance_due_lcy, currency)
                  : '—'}
              </span>
              <span
                className={cn(
                  'w-12 text-right font-mono tabular-nums text-[10px] font-medium',
                  vendor.overdue_ratio > 75
                    ? isLight
                      ? 'text-red-600'
                      : 'text-red-400'
                    : vendor.overdue_ratio > 50
                      ? isLight
                        ? 'text-amber-600'
                        : 'text-amber-400'
                      : styles.textMuted
                )}
              >
                {vendor.overdue_ratio.toFixed(0)}%
              </span>
              <span
                className={cn(
                  'w-10 text-right font-mono font-bold uppercase text-[10px]',
                  isLight ? riskColor.light : riskColor.dark
                )}
              >
                {vendor.risk_score === 'critical'
                  ? 'CRIT'
                  : vendor.risk_score.toUpperCase().slice(0, 3)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
