'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface CategoryItem {
  name: string
  value: number
}

interface CategoryBreakdownStripProps {
  data: CategoryItem[]
  isLoading: boolean
  totalAmount: number
}

const barColors = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-yellow-500',
  'bg-lime-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
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

export function CategoryBreakdownStrip({
  data,
  isLoading,
  totalAmount,
}: CategoryBreakdownStripProps) {
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
    return <div className={cn('py-8 text-center text-sm', styles.textMuted)}>No category data</div>
  }

  // Calculate metrics
  const topCategory = data[0]
  const top3Total = data.slice(0, 3).reduce((sum, c) => sum + c.value, 0)
  const top3Percentage = totalAmount > 0 ? (top3Total / totalAmount) * 100 : 0

  // Calculate bar data
  const barData = data.slice(0, 8)
  const barTotal = barData.reduce((sum, c) => sum + c.value, 0)
  const othersAmount = totalAmount - barTotal

  return (
    <div>
      {/* Metrics row */}
      <div className={cn('flex gap-6 pb-3 mb-3 border-b text-xs', styles.border)}>
        <div>
          <span className={styles.textMuted}>Categories </span>
          <span className={cn('font-mono font-medium', styles.text)}>{data.length}</span>
        </div>
        <div>
          <span className={styles.textMuted}>Top </span>
          <span className={cn('font-mono font-medium', styles.text)}>
            {topCategory?.name || '-'}
          </span>
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
        {barData.map((category, i) => {
          const width = totalAmount > 0 ? (category.value / totalAmount) * 100 : 0
          if (width < 0.5) return null
          return (
            <div
              key={category.name}
              className={cn(barColors[i % barColors.length], 'h-full transition-all relative')}
              style={{ width: `${width}%` }}
              title={`${category.name}: ${formatCompactCurrency(category.value, 'USD')} (${width.toFixed(1)}%)`}
            >
              {width > 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white/90">
                  {width.toFixed(0)}%
                </span>
              )}
            </div>
          )
        })}
        {othersAmount > 0 && (
          <div
            className={cn('h-full', isLight ? 'bg-stone-300' : 'bg-stone-600')}
            style={{ width: `${(othersAmount / totalAmount) * 100}%` }}
            title={`Others: ${formatCompactCurrency(othersAmount, 'USD')}`}
          />
        )}
      </div>

      {/* Category list */}
      <div className="space-y-px">
        {data.slice(0, 8).map((category, i) => {
          const pct = totalAmount > 0 ? (category.value / totalAmount) * 100 : 0
          return (
            <div
              key={category.name}
              className={cn(
                'flex items-center gap-3 py-1.5 px-2 -mx-2 text-xs transition-colors',
                i % 2 === 0 ? (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]') : '',
                isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]'
              )}
            >
              <div className={cn('w-2 h-2 flex-shrink-0', barColors[i % barColors.length])} />
              <span className={cn('flex-1 truncate font-medium', styles.text)}>
                {category.name}
              </span>
              <span className={cn('font-mono tabular-nums w-16 text-right', styles.text)}>
                {formatCompactCurrency(category.value, 'USD')}
              </span>
              <span className={cn('font-mono tabular-nums w-10 text-right', styles.textMuted)}>
                {pct.toFixed(0)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
