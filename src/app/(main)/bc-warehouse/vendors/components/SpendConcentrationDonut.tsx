'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { VendorConcentration } from '../hooks/useVendorInsights'

interface SpendConcentrationDonutProps {
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

const arcColors = [
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
]

function Skeleton({ isLight }: { isLight: boolean }) {
  return (
    <div className="flex items-center gap-6">
      <div
        className={cn(
          'w-[160px] h-[160px] rounded-full animate-pulse',
          isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
        )}
      />
      <div className="flex-1 space-y-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-5 animate-pulse rounded',
              isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
            )}
          />
        ))}
      </div>
    </div>
  )
}

export function SpendConcentrationDonut({
  data,
  metrics,
  isLoading,
  currency = 'USD',
}: SpendConcentrationDonutProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
    }),
    [isLight]
  )

  // Calculate segments including "others"
  const segments = useMemo(() => {
    const top10Total = data.slice(0, 10).reduce((sum, v) => sum + Number(v.percentage), 0)
    const othersPercentage = Math.max(0, 100 - top10Total)

    const segs = data.slice(0, 10).map((vendor, i) => ({
      vendor,
      percentage: Number(vendor.percentage),
      color: arcColors[i % arcColors.length],
      index: i,
    }))

    if (othersPercentage > 0.5) {
      segs.push({
        vendor: {
          no: 'others',
          name: 'Other Vendors',
          purchases_lcy: 0,
          percentage: othersPercentage,
        },
        percentage: othersPercentage,
        color: isLight ? '#d1d5db' : '#404040',
        index: 10,
      })
    }

    return segs
  }, [data, isLight])

  const totalSpend = useMemo(() => {
    return data.reduce((sum, v) => sum + v.purchases_lcy, 0)
  }, [data])

  if (isLoading) return <Skeleton isLight={isLight} />

  if (!data.length) {
    return <div className={cn('py-6 text-center text-sm', styles.textMuted)}>No spend data</div>
  }

  // SVG donut chart calculations
  const size = 160
  const strokeWidth = 28
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  let cumulativePercentage = 0

  const hoveredSegment = hoveredIndex !== null ? segments[hoveredIndex] : null

  return (
    <div className="flex items-center gap-6">
      {/* Donut Chart */}
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={isLight ? '#f3f4f6' : 'rgba(255,255,255,0.04)'}
            strokeWidth={strokeWidth}
          />

          {/* Segments */}
          {segments.map((segment, i) => {
            if (segment.percentage < 0.5) return null

            const startOffset = (cumulativePercentage / 100) * circumference
            const segmentLength = (segment.percentage / 100) * circumference
            cumulativePercentage += segment.percentage

            const isHovered = hoveredIndex === i

            return (
              <circle
                key={segment.vendor.no}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
                strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                strokeDashoffset={-startOffset}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            )
          })}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {hoveredSegment ? (
            <>
              <span className={cn('text-2xl font-bold tabular-nums', styles.text)}>
                {hoveredSegment.percentage.toFixed(1)}%
              </span>
              <span
                className={cn(
                  'text-[10px] text-center px-2 max-w-[100px] truncate',
                  styles.textMuted
                )}
                title={hoveredSegment.vendor.name}
              >
                {hoveredSegment.vendor.name}
              </span>
            </>
          ) : (
            <>
              <span className={cn('text-lg font-bold tabular-nums', styles.text)}>
                {formatCompactCurrency(totalSpend, currency)}
              </span>
              <span className={cn('text-[10px] uppercase tracking-wider', styles.textMuted)}>
                Total Spend
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend and metrics */}
      <div className="flex-1 min-w-0">
        {/* Concentration metrics */}
        <div className={cn('flex gap-4 pb-2 mb-2 border-b text-xs', styles.border)}>
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
              {metrics.top5Percentage.toFixed(0)}%
            </span>
          </div>
          <div>
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
                    : isLight
                      ? 'text-emerald-600'
                      : 'text-emerald-400'
              )}
            >
              {metrics.concentrationRisk} risk
            </span>
          </div>
        </div>

        {/* Top vendors list - matching inventory list styling */}
        <div
          className="max-h-[180px] overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 dark:[&::-webkit-scrollbar-thumb]:bg-stone-600"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: isLight ? '#a8a29e transparent' : '#57534e transparent',
          }}
        >
          {segments.map((segment, i) => (
            <div
              key={segment.vendor.no}
              className={cn(
                'flex items-center gap-2 py-1.5 px-2 -mx-2 transition-colors text-xs cursor-pointer',
                i % 2 === 0 ? (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]') : '',
                hoveredIndex === i
                  ? isLight
                    ? 'bg-stone-300/50'
                    : 'bg-white/[0.05]'
                  : isLight
                    ? 'hover:bg-stone-300/50'
                    : 'hover:bg-white/[0.05]'
              )}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: segment.color }}
              />
              <span
                className={cn('flex-1 truncate font-medium', styles.text)}
                title={segment.vendor.name}
              >
                {segment.vendor.name}
              </span>
              <span
                className={cn('font-mono tabular-nums text-[10px] font-medium', styles.textMuted)}
              >
                {segment.percentage.toFixed(0)}%
              </span>
              <span className={cn('font-mono tabular-nums font-semibold text-[11px]', styles.text)}>
                {formatCompactCurrency(segment.vendor.purchases_lcy, currency)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
