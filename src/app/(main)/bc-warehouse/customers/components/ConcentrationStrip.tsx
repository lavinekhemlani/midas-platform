'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { CustomerConcentration } from '../hooks/useCustomerInsights'

interface ConcentrationStripProps {
  data: CustomerConcentration[]
  metrics: {
    topCustomerPercentage: number
    top5Percentage: number
    top10Percentage: number
    concentrationRisk: 'low' | 'medium' | 'high'
  }
  isLoading: boolean
  currency?: string
}

const barColors = [
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-fuchsia-500',
  'bg-pink-500',
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-yellow-500',
]

function Skeleton({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-3">
      <div className={cn('h-6 animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')} />
      <div className="space-y-1">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn('h-4 animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')}
          />
        ))}
      </div>
    </div>
  )
}

export function ConcentrationStrip({
  data,
  metrics,
  isLoading,
  currency = 'USD',
}: ConcentrationStripProps) {
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

  if (!data.length) {
    return (
      <div className={cn('py-8 text-center text-sm', styles.textMuted)}>No concentration data</div>
    )
  }

  const top10Total = data.slice(0, 10).reduce((sum, c) => sum + Number(c.percentage), 0)
  const othersPercentage = Math.max(0, 100 - top10Total)

  return (
    <div>
      {/* Metrics row */}
      <div className={cn('flex gap-6 pb-3 mb-3 border-b text-xs', styles.border)}>
        <div>
          <span className={styles.textMuted}>Top 1 </span>
          <span
            className={cn(
              'font-mono font-medium',
              metrics.topCustomerPercentage > 25
                ? isLight
                  ? 'text-red-600'
                  : 'text-red-400'
                : styles.text
            )}
          >
            {metrics.topCustomerPercentage.toFixed(1)}%
          </span>
        </div>
        <div>
          <span className={styles.textMuted}>Top 5 </span>
          <span
            className={cn(
              'font-mono font-medium',
              metrics.top5Percentage > 50
                ? isLight
                  ? 'text-amber-600'
                  : 'text-amber-400'
                : styles.text
            )}
          >
            {metrics.top5Percentage.toFixed(1)}%
          </span>
        </div>
        <div>
          <span className={styles.textMuted}>Top 10 </span>
          <span className={cn('font-mono font-medium', styles.text)}>
            {metrics.top10Percentage.toFixed(1)}%
          </span>
        </div>
        <div className="ml-auto">
          <span
            className={cn(
              'font-mono font-medium uppercase text-[10px]',
              metrics.concentrationRisk === 'high'
                ? isLight
                  ? 'text-red-600'
                  : 'text-red-400'
                : metrics.concentrationRisk === 'medium'
                  ? isLight
                    ? 'text-amber-600'
                    : 'text-amber-400'
                  : styles.textMuted
            )}
          >
            {metrics.concentrationRisk} risk
          </span>
        </div>
      </div>

      {/* Stacked bar */}
      <div className={cn('h-6 flex overflow-hidden mb-3', styles.barBg)}>
        {data.slice(0, 10).map((customer, i) => {
          const width = Number(customer.percentage)
          if (width < 0.5) return null
          return (
            <div
              key={customer.no}
              className={cn(barColors[i], 'h-full transition-all relative group')}
              style={{ width: `${width}%` }}
              title={`${customer.name}: ${width.toFixed(1)}%`}
            >
              {width > 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white/90">
                  {width.toFixed(0)}%
                </span>
              )}
            </div>
          )
        })}
        {othersPercentage > 0.5 && (
          <div
            className={cn('h-full', isLight ? 'bg-stone-300' : 'bg-stone-600')}
            style={{ width: `${othersPercentage}%` }}
            title={`Others: ${othersPercentage.toFixed(1)}%`}
          />
        )}
      </div>

      {/* Customer list */}
      <div className="space-y-px">
        {data.slice(0, 8).map((customer, i) => (
          <div key={customer.no} className={cn('flex items-center gap-3 py-1 text-xs')}>
            <div className={cn('w-2 h-2 flex-shrink-0', barColors[i])} />
            <span className={cn('flex-1 truncate', styles.text)} title={customer.name}>
              {customer.name}
            </span>
            <span className={cn('font-mono tabular-nums', styles.textMuted)}>
              {formatCompactCurrency(customer.sales_lcy, currency)}
            </span>
            <span className={cn('font-mono tabular-nums w-12 text-right', styles.text)}>
              {Number(customer.percentage).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
