/**
 * @component Comparison
 * @description Period-over-period comparison with change indicator
 * Supports 2 or more periods with change indicators between each pair
 */

'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatValue } from '../shared/formatters'
import type { ComparisonBlock } from '../shared/types'

export interface ComparisonRendererProps {
  block: ComparisonBlock
  className?: string
}

/**
 * Calculate percentage change between two values
 */
function calculateChange(prevValue: number, currentValue: number): number {
  if (prevValue === 0) return 0
  return ((currentValue - prevValue) / prevValue) * 100
}

/**
 * Render a single change indicator between two periods
 */
function ChangeIndicator({
  change,
  changeLabel,
  isLast,
}: {
  change: number
  changeLabel?: string
  isLast: boolean
}) {
  const isPositive = change > 0
  const isNeutral = change === 0

  return (
    <div className="flex flex-col items-center shrink-0">
      {isNeutral ? (
        <Minus className="w-5 h-5 theme-text-secondary" />
      ) : isPositive ? (
        <TrendingUp className="w-5 h-5 text-emerald-500" />
      ) : (
        <TrendingDown className="w-5 h-5 text-red-500" />
      )}
      <span
        className={cn(
          'text-xs font-medium',
          isNeutral ? 'theme-text-secondary' : isPositive ? 'text-emerald-500' : 'text-red-500'
        )}
      >
        {change.toFixed(1)}%
      </span>
      {changeLabel && isLast && <span className="text-xs theme-text-secondary">{changeLabel}</span>}
    </div>
  )
}

export const ComparisonRenderer = memo(function ComparisonRenderer({
  block,
  className,
}: ComparisonRendererProps) {
  const { title, periods, showChange = true, changeLabel, currencyCode } = block

  if (!periods || periods.length < 2) {
    return (
      <div className={cn('my-4 glass-luxury-card rounded-xl p-4', className)}>
        {title && <h4 className="text-sm font-semibold theme-text-primary mb-3">{title}</h4>}
        <p className="text-sm theme-text-secondary">Insufficient data for comparison</p>
      </div>
    )
  }

  return (
    <div className={cn('my-4 glass-luxury-card rounded-xl p-4', className)}>
      {title && <h4 className="text-sm font-semibold theme-text-primary mb-3">{title}</h4>}

      <div className="flex items-center justify-between gap-3">
        {periods.map((period, index) => {
          const isLast = index === periods.length - 1
          const prevPeriod = index > 0 ? periods[index - 1] : null
          const change = prevPeriod ? calculateChange(prevPeriod.value, period.value) : null

          return (
            <div key={period.label} className="contents">
              {/* Show change indicator before this period (except for the first) */}
              {showChange && change !== null && (
                <ChangeIndicator change={change} changeLabel={changeLabel} isLast={isLast} />
              )}

              {/* Period value */}
              <div className="flex-1 text-center min-w-0">
                <p className="text-xs theme-text-secondary mb-1 truncate">{period.label}</p>
                <p className="text-lg font-bold theme-text-primary">
                  {formatValue(period.value, period.format === 'currency' ? currencyCode : undefined, period.format)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

ComparisonRenderer.displayName = 'ComparisonRenderer'
