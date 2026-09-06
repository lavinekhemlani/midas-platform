'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface CategoryItem {
  name: string
  value: number
  count: number
}

interface BalanceSheetWaterfallChartProps {
  data: {
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
    isBalanced: boolean
  } | null
  categoryBreakdown: {
    assetCategories: CategoryItem[]
    liabilityCategories: CategoryItem[]
    equityCategories: CategoryItem[]
  } | null
  isLoading: boolean
  currency: string
}

export function BalanceSheetWaterfallChart({
  data,
  categoryBreakdown,
  isLoading,
  currency,
}: BalanceSheetWaterfallChartProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      rowEven: isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]',
      rowHover: isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]',
    }),
    [isLight]
  )

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={cn('h-8 animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
          />
        ))}
      </div>
    )
  }

  if (!data) {
    return <p className={cn('text-sm py-4', styles.textMuted)}>No balance sheet data available</p>
  }

  // Calculate key ratios
  const debtToEquityRatio = data.totalEquity > 0 ? data.totalLiabilities / data.totalEquity : 0
  const equityMultiplier = data.totalEquity > 0 ? data.totalAssets / data.totalEquity : 0
  const debtRatio = data.totalAssets > 0 ? (data.totalLiabilities / data.totalAssets) * 100 : 0
  const equityRatio = data.totalAssets > 0 ? (data.totalEquity / data.totalAssets) * 100 : 0

  // Rating based on debt to equity
  const getDebtRating = () => {
    if (debtToEquityRatio <= 0.5) return { label: 'Conservative', color: '#10b981' }
    if (debtToEquityRatio <= 1) return { label: 'Balanced', color: '#3b82f6' }
    if (debtToEquityRatio <= 2) return { label: 'Leveraged', color: '#f59e0b' }
    return { label: 'High Risk', color: '#ef4444' }
  }

  const debtRating = getDebtRating()

  return (
    <div className="space-y-4">
      {/* Balance Equation - Stacked Bar */}
      <div>
        <div className={cn('text-[10px] uppercase tracking-wider mb-2', styles.textMuted)}>
          Capital Structure
        </div>
        <div className="h-6 flex overflow-hidden">
          <div
            className="h-full bg-red-500 transition-all duration-500"
            style={{ width: `${debtRatio}%` }}
            title={`Liabilities: ${formatCompactCurrency(data.totalLiabilities, currency)}`}
          />
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: `${equityRatio}%` }}
            title={`Equity: ${formatCompactCurrency(data.totalEquity, currency)}`}
          />
        </div>
        <div className="flex justify-between mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-red-500" />
            <span className={cn('text-[10px]', styles.textMuted)}>
              Debt {debtRatio.toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500" />
            <span className={cn('text-[10px]', styles.textMuted)}>
              Equity {equityRatio.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Key Metrics Table */}
      <div className={cn('border-t pt-4', styles.border)}>
        {/* Debt to Equity */}
        <div
          className={cn(
            'flex items-center justify-between py-2.5 px-2 -mx-2 text-xs',
            styles.rowEven
          )}
        >
          <span className={cn('font-medium', styles.text)}>Debt to Equity</span>
          <div className="flex items-center gap-3">
            <span
              className="text-[10px] font-medium px-1.5 py-0.5"
              style={{ backgroundColor: `${debtRating.color}15`, color: debtRating.color }}
            >
              {debtRating.label}
            </span>
            <span className={cn('font-mono font-bold tabular-nums', styles.text)}>
              {debtToEquityRatio.toFixed(2)}x
            </span>
          </div>
        </div>

        {/* Equity Multiplier */}
        <div
          className={cn(
            'flex items-center justify-between py-2.5 px-2 -mx-2 text-xs',
            styles.rowHover
          )}
        >
          <span className={styles.textMuted}>Equity Multiplier</span>
          <span className={cn('font-mono font-semibold tabular-nums', styles.text)}>
            {equityMultiplier.toFixed(2)}x
          </span>
        </div>

        {/* Debt Ratio */}
        <div
          className={cn(
            'flex items-center justify-between py-2.5 px-2 -mx-2 text-xs',
            styles.rowEven
          )}
        >
          <span className={styles.textMuted}>Debt Ratio</span>
          <span className={cn('font-mono font-semibold tabular-nums', styles.text)}>
            {debtRatio.toFixed(1)}%
          </span>
        </div>

        {/* Equity Ratio */}
        <div
          className={cn(
            'flex items-center justify-between py-2.5 px-2 -mx-2 text-xs',
            styles.rowHover
          )}
        >
          <span className={styles.textMuted}>Equity Ratio</span>
          <span className={cn('font-mono font-semibold tabular-nums', styles.text)}>
            {equityRatio.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}
