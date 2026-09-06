'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface TransactionType {
  type: string
  count: number
  total: number
  percentage: number
}

interface TransactionTypeStripProps {
  data: TransactionType[]
  isLoading: boolean
  totalEntries: number
}

const barColors = [
  'bg-amber-500',
  'bg-orange-500',
  'bg-rose-500',
  'bg-pink-500',
  'bg-purple-500',
  'bg-violet-500',
  'bg-indigo-500',
  'bg-blue-500',
  'bg-cyan-500',
  'bg-teal-500',
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

export function TransactionTypeStrip({ data, isLoading, totalEntries }: TransactionTypeStripProps) {
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
      <div className={cn('py-8 text-center text-sm', styles.textMuted)}>No transaction data</div>
    )
  }

  // Calculate metrics
  const top3Total = data.slice(0, 3).reduce((sum, t) => sum + t.count, 0)
  const top3Percentage = totalEntries > 0 ? (top3Total / totalEntries) * 100 : 0
  const uniqueTypes = data.length
  const topType = data[0]

  // Calculate percentages for bar
  const barData = data.slice(0, 8)
  const barTotal = barData.reduce((sum, t) => sum + t.count, 0)
  const othersCount = totalEntries - barTotal

  return (
    <div>
      {/* Metrics row */}
      <div className={cn('flex gap-6 pb-3 mb-3 border-b text-xs', styles.border)}>
        <div>
          <span className={styles.textMuted}>Types </span>
          <span className={cn('font-mono font-medium', styles.text)}>{uniqueTypes}</span>
        </div>
        <div>
          <span className={styles.textMuted}>Top Type </span>
          <span className={cn('font-mono font-medium', styles.text)}>{topType?.type || '-'}</span>
        </div>
        <div>
          <span className={styles.textMuted}>Top 3 </span>
          <span className={cn('font-mono font-medium', styles.text)}>
            {top3Percentage.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Stacked bar */}
      <div className={cn('h-6 flex overflow-hidden mb-3', styles.barBg)}>
        {barData.map((type, i) => {
          const width = totalEntries > 0 ? (type.count / totalEntries) * 100 : 0
          if (width < 0.5) return null
          return (
            <div
              key={type.type}
              className={cn(
                barColors[i % barColors.length],
                'h-full transition-all relative group'
              )}
              style={{ width: `${width}%` }}
              title={`${type.type}: ${type.count} entries (${width.toFixed(1)}%)`}
            >
              {width > 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white/90">
                  {width.toFixed(0)}%
                </span>
              )}
            </div>
          )
        })}
        {othersCount > 0 && (
          <div
            className={cn('h-full', isLight ? 'bg-stone-300' : 'bg-stone-600')}
            style={{ width: `${(othersCount / totalEntries) * 100}%` }}
            title={`Others: ${othersCount} entries`}
          />
        )}
      </div>

      {/* Type list */}
      <div className="space-y-px">
        {data.slice(0, 8).map((type, i) => (
          <div
            key={type.type}
            className={cn(
              'flex items-center gap-3 py-1.5 px-2 -mx-2 text-xs transition-colors',
              i % 2 === 0 ? (isLight ? 'bg-stone-50/50' : 'bg-white/[0.01]') : '',
              isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.05]'
            )}
          >
            <div className={cn('w-2 h-2 flex-shrink-0', barColors[i % barColors.length])} />
            <span className={cn('flex-1 font-medium', styles.text)}>{type.type}</span>
            <span className={cn('font-mono tabular-nums', styles.textMuted)}>
              {type.count.toLocaleString()}
            </span>
            <span className={cn('font-mono tabular-nums w-14 text-right', styles.text)}>
              {formatCompactCurrency(type.total, 'USD')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
