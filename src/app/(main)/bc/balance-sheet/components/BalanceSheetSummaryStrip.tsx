'use client'

import { useMemo, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface BalanceSheetSummaryStripProps {
  data: {
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
    isBalanced: boolean
  } | null
  isLoading: boolean
  currency: string
  exportButtons?: ReactNode
}

export function BalanceSheetSummaryStrip({
  data,
  isLoading,
  currency,
  exportButtons,
}: BalanceSheetSummaryStripProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
    }),
    [isLight]
  )

  if (isLoading) {
    return (
      <div className={cn('flex gap-10 py-5 border-b', styles.border)}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div
              className={cn(
                'h-3 w-16 animate-pulse rounded',
                isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
              )}
            />
            <div
              className={cn(
                'h-7 w-24 animate-pulse rounded',
                isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
              )}
            />
          </div>
        ))}
      </div>
    )
  }

  if (!data) return null

  const debtToAssetRatio =
    data.totalAssets > 0 ? (data.totalLiabilities / data.totalAssets) * 100 : 0
  const equityRatio = data.totalAssets > 0 ? (data.totalEquity / data.totalAssets) * 100 : 0

  return (
    <div className={cn('flex flex-wrap gap-8 @lg:gap-10 py-5 border-b', styles.border)}>
      {/* Total Assets */}
      <div>
        <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
          Total Assets
        </div>
        <div className={cn('text-2xl font-mono font-semibold tabular-nums', styles.text)}>
          {formatCompactCurrency(data.totalAssets, currency)}
        </div>
      </div>

      {/* Total Liabilities */}
      <div>
        <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
          Liabilities
        </div>
        <div
          className={cn(
            'text-2xl font-mono font-semibold tabular-nums',
            data.totalLiabilities > 0 ? (isLight ? 'text-red-600' : 'text-red-400') : styles.text
          )}
        >
          {formatCompactCurrency(data.totalLiabilities, currency)}
        </div>
        <div className={cn('text-[10px] font-mono', styles.textMuted)}>
          {debtToAssetRatio.toFixed(1)}% of assets
        </div>
      </div>

      {/* Total Equity */}
      <div>
        <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
          Equity
        </div>
        <div
          className={cn(
            'text-2xl font-mono font-semibold tabular-nums',
            data.totalEquity >= 0 ? (isLight ? 'text-green-600' : 'text-green-400') : styles.text
          )}
        >
          {formatCompactCurrency(data.totalEquity, currency)}
        </div>
        <div className={cn('text-[10px] font-mono', styles.textMuted)}>
          {equityRatio.toFixed(1)}% of assets
        </div>
      </div>

      {/* Balance Status */}
      <div>
        <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
          Status
        </div>
        <div className="flex items-center gap-1.5">
          {data.isBalanced ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span
                className={cn('text-sm font-medium', isLight ? 'text-green-600' : 'text-green-400')}
              >
                Balanced
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <span
                className={cn('text-sm font-medium', isLight ? 'text-amber-600' : 'text-amber-400')}
              >
                Unbalanced
              </span>
            </>
          )}
        </div>
      </div>

      {/* Export Buttons */}
      {exportButtons && <div className="ml-auto flex items-center">{exportButtons}</div>}
    </div>
  )
}
