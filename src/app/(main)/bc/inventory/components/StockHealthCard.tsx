'use client'

import { useMemo } from 'react'
import { Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from './InfoTooltip'
import type { StockHealth } from '../../hooks/useBCInventoryEnhanced'

interface StockHealthCardProps {
  data: StockHealth
  isLoading: boolean
  tooltip?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

function getScoreInfo(
  score: number,
  isLight: boolean
): { color: string; barColor: string; label: string } {
  if (score >= 80)
    return {
      color: isLight ? 'text-green-600' : 'text-green-400',
      barColor: '#10b981',
      label: 'Excellent',
    }
  if (score >= 60)
    return {
      color: isLight ? 'text-blue-600' : 'text-blue-400',
      barColor: '#3b82f6',
      label: 'Good',
    }
  if (score >= 40) return { color: 'text-amber-500', barColor: '#f59e0b', label: 'Fair' }
  return {
    color: isLight ? 'text-red-600' : 'text-red-400',
    barColor: '#ef4444',
    label: 'Poor',
  }
}

const DIST_CONFIG = [
  { key: 'excellent' as const, label: 'Excellent', barColor: '#10b981' },
  { key: 'good' as const, label: 'Good', barColor: '#3b82f6' },
  { key: 'fair' as const, label: 'Fair', barColor: '#f59e0b' },
  { key: 'poor' as const, label: 'Poor', barColor: '#ef4444' },
]

export function StockHealthCard({ data, isLoading, tooltip, tooltipProps }: StockHealthCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      rowBg: isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]',
    }),
    [isLight]
  )

  const total =
    data.distribution.excellent +
    data.distribution.good +
    data.distribution.fair +
    data.distribution.poor

  const scoreInfo = getScoreInfo(data.averageScore, isLight)

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Stock Health Score
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <div
          className={cn('h-[200px] animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
        />
      </div>
    )
  }

  if (total === 0) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Stock Health Score
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No items with stock</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <span
          className={cn(
            'relative text-base font-normal uppercase tracking-wider',
            isLight ? 'text-stone-800' : 'text-stone-300'
          )}
        >
          Stock Health Score
          <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
        </span>
        {tooltipProps ? (
          <InfoTooltip {...tooltipProps} />
        ) : (
          <InfoTooltip
            description="Each item with stock is scored 0-100 based on turnover, recency, availability, and value tier."
            calculationTooltip={{
              formula: 'Score = Turnover (30) + Recency (30) + Availability (20) + Value Tier (20)',
              components: [
                { label: 'Items Scored', value: `${total}` },
                {
                  label: 'Average Score',
                  value: `${data.averageScore.toFixed(1)}/100`,
                  highlight: true,
                },
              ],
            }}
          />
        )}
      </div>

      {/* Main Score Display */}
      <div className={cn('py-4 px-2 -mx-2 mb-2', styles.rowBg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={cn('text-4xl font-mono font-bold tabular-nums', scoreInfo.color)}>
              {data.averageScore.toFixed(1)}
            </span>
            <span className={cn('text-[12px]', styles.textMuted)}>out of 100</span>
          </div>
          <span
            className="text-[12px] font-medium px-1.5 py-0.5"
            style={{ color: scoreInfo.barColor, backgroundColor: `${scoreInfo.barColor}15` }}
          >
            {scoreInfo.label}
          </span>
        </div>

        {/* Score bar */}
        <div className={cn('h-1.5 w-full mt-3', isLight ? 'bg-stone-300' : 'bg-white/[0.10]')}>
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${data.averageScore}%`, backgroundColor: scoreInfo.barColor }}
          />
        </div>
      </div>

      {/* Distribution */}
      <div className={cn('border-t pt-2', styles.border)}>
        <div className={cn('text-[12px] uppercase tracking-wider mb-2', styles.textMuted)}>
          Distribution ({total} items)
        </div>
        {DIST_CONFIG.map((config, index) => {
          const count = data.distribution[config.key]
          const pct = total > 0 ? (count / total) * 100 : 0

          return (
            <div key={config.key} className="py-1.5 px-2 -mx-2">
              <div className="flex items-center justify-between text-[14px] mb-1">
                <span className="font-medium" style={{ color: config.barColor }}>
                  {config.label}
                </span>
                <span className={cn('text-[16px] font-mono tabular-nums', styles.textMuted)}>
                  {count} ({pct.toFixed(0)}%)
                </span>
              </div>
              <div className={cn('h-1 w-full', isLight ? 'bg-stone-300' : 'bg-white/[0.10]')}>
                <div
                  className="h-full transition-all"
                  style={{ width: `${Math.max(1, pct)}%`, backgroundColor: config.barColor }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Scale */}
      <div className={cn('flex justify-between text-[12px] pt-2', styles.textMuted)}>
        <span>0 — Poor</span>
        <span>40 — Fair</span>
        <span>60 — Good</span>
        <span>80 — Excellent</span>
        <span>100</span>
      </div>
    </div>
  )
}
