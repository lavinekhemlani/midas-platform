'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { VendorConcentration } from '../hooks/useVendorInsights'

interface SpendStripProps {
  data: VendorConcentration[]
  metrics: {
    topVendorPercentage: number
    top5Percentage: number
    top10Percentage: number
    concentrationRisk: 'low' | 'medium' | 'high'
  }
  isLoading: boolean
  currency?: string
}

const barColors = [
  'bg-orange-500',
  'bg-amber-500',
  'bg-yellow-500',
  'bg-lime-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-indigo-500',
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

export function SpendStrip({ data, metrics, isLoading, currency = 'USD' }: SpendStripProps) {
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
    return <div className={cn('py-8 text-center text-sm', styles.textMuted)}>No spend data</div>
  }

  const top10Total = data.slice(0, 10).reduce((sum, v) => sum + Number(v.percentage), 0)
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
              metrics.topVendorPercentage > 30
                ? isLight
                  ? 'text-red-600'
                  : 'text-red-400'
                : styles.text
            )}
          >
            {metrics.topVendorPercentage.toFixed(1)}%
          </span>
        </div>
        <div>
          <span className={styles.textMuted}>Top 5 </span>
          <span
            className={cn(
              'font-mono font-medium',
              metrics.top5Percentage > 60
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
            {metrics.concentrationRisk} dependency
          </span>
        </div>
      </div>

      {/* Stacked bar */}
      <div className={cn('h-6 flex overflow-hidden mb-3', styles.barBg)}>
        {data.slice(0, 10).map((vendor, i) => {
          const width = Number(vendor.percentage)
          if (width < 0.5) return null
          return (
            <div
              key={vendor.no}
              className={cn(barColors[i], 'h-full transition-all relative group')}
              style={{ width: `${width}%` }}
              title={`${vendor.name}: ${width.toFixed(1)}%`}
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

      {/* Vendor list */}
      <div className="space-y-px">
        {data.slice(0, 8).map((vendor, i) => (
          <div key={vendor.no} className={cn('flex items-center gap-3 py-1 text-xs')}>
            <div className={cn('w-2 h-2 flex-shrink-0', barColors[i])} />
            <span className={cn('flex-1 truncate', styles.text)} title={vendor.name}>
              {vendor.name}
            </span>
            <span className={cn('font-mono tabular-nums', styles.textMuted)}>
              {formatCompactCurrency(vendor.purchases_lcy, currency)}
            </span>
            <span className={cn('font-mono tabular-nums w-12 text-right', styles.text)}>
              {Number(vendor.percentage).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
