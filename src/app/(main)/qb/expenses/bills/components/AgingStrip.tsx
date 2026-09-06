'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'

interface AgingBucket {
  bucket: string
  count: number
  amount?: number
}

interface AgingStripProps {
  data: AgingBucket[]
  isLoading: boolean
  totalUnpaid: number
}

const bucketColors = ['bg-emerald-500', 'bg-amber-400', 'bg-orange-500', 'bg-red-500', 'bg-red-700']

function Skeleton({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-3">
      <div className={cn('h-6 animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')} />
      <div className="space-y-1">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={cn('h-4 animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')}
          />
        ))}
      </div>
    </div>
  )
}

export function AgingStrip({ data, isLoading, totalUnpaid }: AgingStripProps) {
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
    return <div className={cn('py-8 text-center text-sm', styles.textMuted)}>No aging data</div>
  }

  // Calculate total count
  const totalCount = data.reduce((sum, b) => sum + b.count, 0)

  // Get current vs overdue counts
  const currentCount = data.find((b) => b.bucket === 'Current')?.count || 0
  const overdueCount = totalCount - currentCount
  const overduePct = totalCount > 0 ? (overdueCount / totalCount) * 100 : 0

  return (
    <div>
      {/* Metrics row */}
      <div className={cn('flex gap-6 pb-3 mb-3 border-b text-xs', styles.border)}>
        <div>
          <span className={styles.textMuted}>Total Unpaid </span>
          <span className={cn('font-mono font-medium', styles.text)}>{totalUnpaid}</span>
        </div>
        <div>
          <span className={styles.textMuted}>Current </span>
          <span
            className={cn(
              'font-mono font-medium',
              isLight ? 'text-emerald-600' : 'text-emerald-400'
            )}
          >
            {currentCount}
          </span>
        </div>
        <div>
          <span className={styles.textMuted}>Overdue </span>
          <span className={cn('font-mono font-medium', isLight ? 'text-red-600' : 'text-red-400')}>
            {overdueCount}
          </span>
        </div>
        <div>
          <span className={styles.textMuted}>Overdue % </span>
          <span className={cn('font-mono font-medium', styles.text)}>{overduePct.toFixed(0)}%</span>
        </div>
      </div>

      {/* Stacked bar */}
      <div className={cn('h-6 flex overflow-hidden mb-3', styles.barBg)}>
        {data.map((bucket, i) => {
          const width = totalCount > 0 ? (bucket.count / totalCount) * 100 : 0
          if (width < 0.5) return null
          return (
            <div
              key={bucket.bucket}
              className={cn(
                bucketColors[i % bucketColors.length],
                'h-full transition-all relative'
              )}
              style={{ width: `${width}%` }}
              title={`${bucket.bucket}: ${bucket.count} bills (${width.toFixed(1)}%)`}
            >
              {width > 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white/90">
                  {bucket.count}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Bucket list */}
      <div className="space-y-px">
        {data.map((bucket, i) => {
          const pct = totalCount > 0 ? (bucket.count / totalCount) * 100 : 0
          return (
            <div
              key={bucket.bucket}
              className={cn(
                'flex items-center gap-3 py-1.5 px-2 -mx-2 text-xs transition-colors',
                i % 2 === 0 ? (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]') : '',
                isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]'
              )}
            >
              <div className={cn('w-2 h-2 flex-shrink-0', bucketColors[i % bucketColors.length])} />
              <span className={cn('flex-1 font-medium', styles.text)}>{bucket.bucket}</span>
              <span className={cn('font-mono tabular-nums w-10 text-right', styles.text)}>
                {bucket.count}
              </span>
              <span className={cn('font-mono tabular-nums w-10 text-right', styles.textMuted)}>
                {pct.toFixed(0)}%
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className={cn('flex gap-4 pt-3 mt-3 border-t text-[10px]', styles.border)}>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className={styles.textMuted}>Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className={styles.textMuted}>1-30 days</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span className={styles.textMuted}>31-60 days</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className={styles.textMuted}>61-90 days</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-700" />
          <span className={styles.textMuted}>90+ days</span>
        </div>
      </div>
    </div>
  )
}
