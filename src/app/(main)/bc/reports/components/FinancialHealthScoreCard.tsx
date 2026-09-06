'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from '@/components/ui/InfoTooltip'
import type { FinancialHealthScore } from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'

interface FinancialHealthScoreCardProps {
  healthScore: FinancialHealthScore | null
  isLoading: boolean
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

function ComponentRow({
  label,
  score,
  details,
  isLight,
  isEven,
}: {
  label: string
  score: number
  details: string
  isLight: boolean
  isEven: boolean
}) {
  const getColor = () => {
    if (score >= 80) return isLight ? 'text-green-600' : 'text-green-400'
    if (score >= 60) return isLight ? 'text-blue-600' : 'text-blue-400'
    if (score >= 40) return 'text-amber-500'
    return isLight ? 'text-red-600' : 'text-red-400'
  }

  const getBarColor = () => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-blue-500'
    if (score >= 40) return 'bg-amber-500'
    return 'bg-red-500'
  }

  return (
    <div className={cn('py-2.5 px-2 -mx-2')}>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className={isLight ? 'text-stone-900' : 'text-white'}>{label}</span>
        <span className={cn('text-base font-mono font-semibold tabular-nums', getColor())}>{score}</span>
      </div>
      <div className={cn('h-1 w-full', isLight ? 'bg-stone-100' : 'bg-white/[0.04]')}>
        <div
          className={cn('h-full transition-all duration-500', getBarColor())}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

export function FinancialHealthScoreCard({
  healthScore,
  isLoading,
  tooltipProps,
}: FinancialHealthScoreCardProps) {
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return isLight ? 'text-green-600' : 'text-green-400'
    if (score >= 60) return isLight ? 'text-blue-600' : 'text-blue-400'
    if (score >= 40) return 'text-amber-500'
    return isLight ? 'text-red-600' : 'text-red-400'
  }

  const getRatingBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/15 text-green-500'
    if (score >= 60) return 'bg-blue-500/15 text-blue-500'
    if (score >= 40) return 'bg-amber-500/15 text-amber-500'
    return 'bg-red-500/15 text-red-500'
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Financial Health
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps && <InfoTooltip {...tooltipProps} />}
        </div>
        <div className={cn('h-16 animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')} />
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={cn('h-9 animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
          />
        ))}
      </div>
    )
  }

  if (!healthScore) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Financial Health
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps && <InfoTooltip {...tooltipProps} />}
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>
          Insufficient data to calculate health score
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <span
          className={cn(
            'relative text-base font-normal uppercase tracking-wider',
            isLight ? 'text-stone-800' : 'text-stone-300'
          )}
        >
          Financial Health
          <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
        </span>
        {tooltipProps && <InfoTooltip {...tooltipProps} />}
      </div>

      {/* Score Display */}
      <div className="py-4 px-2 -mx-2 mb-2">
        <div className="flex items-center justify-between">
          <div>
            <span
              className={cn(
                'text-4xl font-mono font-bold tabular-nums',
                getScoreColor(healthScore.score)
              )}
            >
              {healthScore.score}
            </span>
            <span className={cn('text-base ml-1', styles.textMuted)}>/100</span>
          </div>
          <span className={cn('text-[14px] font-medium px-2 py-1', getRatingBg(healthScore.score))}>
            {healthScore.rating}
          </span>
        </div>
      </div>

      {/* Component Breakdown */}
      <div className={cn('border-t pt-2', styles.border)}>
        <ComponentRow
          label="Liquidity"
          score={healthScore.components.liquidity.score}
          details={healthScore.components.liquidity.details}
          isLight={isLight}
          isEven={false}
        />
        <ComponentRow
          label="Profitability"
          score={healthScore.components.profitability.score}
          details={healthScore.components.profitability.details}
          isLight={isLight}
          isEven={true}
        />
        <ComponentRow
          label="Efficiency"
          score={healthScore.components.efficiency.score}
          details={healthScore.components.efficiency.details}
          isLight={isLight}
          isEven={false}
        />
        <ComponentRow
          label="Leverage"
          score={healthScore.components.leverage.score}
          details={healthScore.components.leverage.details}
          isLight={isLight}
          isEven={true}
        />
      </div>
    </div>
  )
}
