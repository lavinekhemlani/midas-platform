'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import {
  InfoTooltip,
  type InfoTooltipProps,
  type CalculationTooltip,
} from '@/components/ui/InfoTooltip'
import type { FinancialRatios } from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'

interface FinancialRatiosCardProps {
  ratios: FinancialRatios | null
  isLoading: boolean
  currency?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

function RatioRow({
  label,
  value,
  format,
  benchmark,
  currency,
  isLight,
  isEven,
  calculationTooltip,
  description,
}: {
  label: string
  value: number | null
  format: 'ratio' | 'currency' | 'percent'
  benchmark?: { good: number; warning: number; isHigherBetter: boolean }
  currency: string
  isLight: boolean
  isEven: boolean
  calculationTooltip?: CalculationTooltip
  description?: string
}) {
  const getFormattedValue = () => {
    if (value === null) return '—'
    switch (format) {
      case 'ratio':
        return value.toFixed(2)
      case 'percent':
        return `${value.toFixed(1)}%`
      case 'currency':
        return formatCompactCurrency(value, currency)
      default:
        return value.toString()
    }
  }

  const getStatus = () => {
    if (value === null || !benchmark) return { isGood: true, isWarning: false }

    const isGood = benchmark.isHigherBetter ? value >= benchmark.good : value <= benchmark.good
    const isWarning = benchmark.isHigherBetter
      ? value >= benchmark.warning && value < benchmark.good
      : value > benchmark.good && value <= benchmark.warning

    return { isGood, isWarning }
  }

  const { isGood, isWarning } = getStatus()

  const getValueColor = () => {
    if (value === null) return isLight ? 'text-stone-400' : 'text-stone-500'
    if (isGood) return isLight ? 'text-green-600' : 'text-green-400'
    if (isWarning) return 'text-amber-500'
    return isLight ? 'text-red-600' : 'text-red-400'
  }

  const Icon = value === null ? Minus : isGood ? TrendingUp : TrendingDown

  return (
    <div className={cn('flex items-center justify-between py-2.5 px-2 -mx-2 text-sm')}>
      <div className="flex items-center gap-2">
        <Icon className={cn('w-3.5 h-3.5', getValueColor())} />
        <span className={isLight ? 'text-stone-900' : 'text-white'}>{label}</span>
        {calculationTooltip && (
          <InfoTooltip calculationTooltip={calculationTooltip} description={description} />
        )}
      </div>
      <span className={cn('text-[16px] font-mono font-semibold tabular-nums', getValueColor())}>
        {getFormattedValue()}
      </span>
    </div>
  )
}

export function FinancialRatiosCard({
  ratios,
  isLoading,
  currency = 'USD',
  tooltipProps,
}: FinancialRatiosCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
    }),
    [isLight]
  )

  // Calculate health indicator
  const healthIndicator = useMemo(() => {
    if (!ratios) return null

    let score = 0
    let count = 0

    if (ratios.currentRatio !== null) {
      score += ratios.currentRatio >= 2 ? 1 : ratios.currentRatio >= 1 ? 0.5 : 0
      count++
    }
    if (ratios.quickRatio !== null) {
      score += ratios.quickRatio >= 1 ? 1 : ratios.quickRatio >= 0.5 ? 0.5 : 0
      count++
    }
    if (ratios.debtToEquity !== null) {
      score += ratios.debtToEquity <= 1 ? 1 : ratios.debtToEquity <= 2 ? 0.5 : 0
      count++
    }
    if (ratios.workingCapital > 0) {
      score += 1
      count++
    }

    if (count === 0) return null
    return (score / count) * 100
  }, [ratios])

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Financial Ratios
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={cn('h-10 animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
          />
        ))}
      </div>
    )
  }

  if (!ratios) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Financial Ratios
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No ratio data available</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Financial Ratios
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps && <InfoTooltip {...tooltipProps} />}
        </div>
        <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
      </div>

      <RatioRow
        label="Current Ratio"
        value={ratios.currentRatio}
        format="ratio"
        benchmark={{ good: 2, warning: 1, isHigherBetter: true }}
        currency={currency}
        isLight={isLight}
        isEven={true}
        description="Measures ability to pay short-term obligations. Above 1.0 = sufficient liquidity, 1.5-2.0 = healthy, above 3.0 may indicate inefficient asset use."
        calculationTooltip={
          ratios.currentAssets !== undefined
            ? {
                formula: 'Current Assets \u00f7 Current Liabilities',
                components: [
                  {
                    label: 'Current Assets',
                    value: formatCompactCurrency(ratios.currentAssets, currency),
                  },
                  {
                    label: '\u00f7 Current Liabilities',
                    value: formatCompactCurrency(ratios.currentLiabilities ?? 0, currency),
                  },
                  {
                    label: '= Current Ratio',
                    value: ratios.currentRatio !== null ? ratios.currentRatio.toFixed(2) : 'N/A',
                    highlight: true,
                  },
                ],
              }
            : undefined
        }
      />
      <RatioRow
        label="Quick Ratio"
        value={ratios.quickRatio}
        format="ratio"
        benchmark={{ good: 1, warning: 0.5, isHigherBetter: true }}
        currency={currency}
        isLight={isLight}
        isEven={false}
        description="Liquid assets (excluding inventory) vs current liabilities. More stringent than current ratio. Above 1.0 indicates strong short-term solvency."
        calculationTooltip={
          ratios.currentAssets !== undefined
            ? {
                formula: '(Current Assets - Inventory) \u00f7 Current Liabilities',
                components: [
                  {
                    label: 'Current Assets',
                    value: formatCompactCurrency(ratios.currentAssets, currency),
                  },
                  {
                    label: '- Inventory',
                    value: formatCompactCurrency(ratios.inventory ?? 0, currency),
                  },
                  {
                    label: '\u00f7 Current Liabilities',
                    value: formatCompactCurrency(ratios.currentLiabilities ?? 0, currency),
                  },
                  {
                    label: '= Quick Ratio',
                    value: ratios.quickRatio !== null ? ratios.quickRatio.toFixed(2) : 'N/A',
                    highlight: true,
                  },
                ],
              }
            : undefined
        }
      />
      <RatioRow
        label="Debt to Equity"
        value={ratios.debtToEquity}
        format="ratio"
        benchmark={{ good: 1, warning: 2, isHigherBetter: false }}
        currency={currency}
        isLight={isLight}
        isEven={true}
        description="Total debt relative to shareholder equity. Lower ratios indicate less leverage and financial risk. Above 2.0 is generally considered high risk."
        calculationTooltip={
          ratios.totalLiabilities !== undefined
            ? {
                formula: 'Total Liabilities \u00f7 Total Equity',
                components: [
                  {
                    label: 'Total Liabilities',
                    value: formatCompactCurrency(ratios.totalLiabilities, currency),
                  },
                  {
                    label: '\u00f7 Total Equity',
                    value: formatCompactCurrency(Math.abs(ratios.totalEquity ?? 0), currency),
                  },
                  {
                    label: '= Debt to Equity',
                    value: ratios.debtToEquity !== null ? ratios.debtToEquity.toFixed(2) : 'N/A',
                    highlight: true,
                  },
                ],
              }
            : undefined
        }
      />
      <RatioRow
        label="Working Capital"
        value={ratios.workingCapital}
        format="currency"
        currency={currency}
        isLight={isLight}
        isEven={false}
        description="Liquid capital available for daily operations. Positive = healthy short-term position; negative = potential difficulty meeting obligations."
        calculationTooltip={
          ratios.currentAssets !== undefined
            ? {
                formula: 'Current Assets - Current Liabilities',
                components: [
                  {
                    label: 'Current Assets',
                    value: formatCompactCurrency(ratios.currentAssets, currency),
                  },
                  {
                    label: '- Current Liabilities',
                    value: formatCompactCurrency(ratios.currentLiabilities ?? 0, currency),
                  },
                  {
                    label: '= Working Capital',
                    value: formatCompactCurrency(ratios.workingCapital, currency),
                    highlight: true,
                  },
                ],
              }
            : undefined
        }
      />

      {/* Health indicator bar */}
      {healthIndicator !== null && (
        <div className={cn('pt-3 mt-2 border-t', styles.border)}>
          <div className={cn('flex items-center justify-between text-sm mb-3', styles.textMuted)}>
            <span className="uppercase tracking-wider">Ratio Health</span>
            <span className="font-mono text-sm font-medium tabular-nums">
              {healthIndicator.toFixed(0)}%
            </span>
          </div>
          <div className={cn('h-1.5 w-full', isLight ? 'bg-stone-100' : 'bg-white/[0.04]')}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${healthIndicator}%`,
                backgroundColor:
                  healthIndicator >= 75 ? '#10b981' : healthIndicator >= 50 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
