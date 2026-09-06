'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { SlowMovingItemRow } from '../hooks/useInventoryData'

interface SlowMovingInventoryDonutProps {
  data: SlowMovingItemRow[]
  summary: {
    totalItems: number
    totalValue: number
    zeroSalesCount: number
    zeroSalesValue: number
  } | null
  isLoading: boolean
  currency?: string
}

const riskConfig = {
  zeroSales: {
    label: 'No Sales',
    color: '#ef4444',
    lightColor: '#dc2626',
    description: 'Zero sales in period',
  },
  lowTurnover: {
    label: 'Low Turnover',
    color: '#f97316',
    lightColor: '#ea580c',
    description: 'Low sales relative to stock',
  },
}

function Skeleton({ isLight }: { isLight: boolean }) {
  return (
    <div className="flex items-center gap-6">
      <div
        className={cn(
          'w-[120px] h-[120px] rounded-full animate-pulse',
          isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
        )}
      />
      <div className="flex-1 space-y-2">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-8 animate-pulse rounded',
              isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
            )}
          />
        ))}
      </div>
    </div>
  )
}

export function SlowMovingInventoryDonut({
  data,
  summary,
  isLoading,
  currency = 'USD',
}: SlowMovingInventoryDonutProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null)

  // Calculate distribution
  const distribution = useMemo(() => {
    if (!summary || !data.length) return []

    const zeroSalesItems = data.filter((item) => item.sales_qty === 0)
    const lowTurnoverItems = data.filter((item) => item.sales_qty > 0)

    const zeroSalesValue = zeroSalesItems.reduce((sum, item) => sum + item.inventory_value, 0)
    const lowTurnoverValue = lowTurnoverItems.reduce((sum, item) => sum + item.inventory_value, 0)
    const totalValue = zeroSalesValue + lowTurnoverValue

    return [
      {
        key: 'zeroSales',
        count: zeroSalesItems.length,
        value: zeroSalesValue,
        percentage: totalValue > 0 ? (zeroSalesValue / totalValue) * 100 : 0,
        config: riskConfig.zeroSales,
      },
      {
        key: 'lowTurnover',
        count: lowTurnoverItems.length,
        value: lowTurnoverValue,
        percentage: totalValue > 0 ? (lowTurnoverValue / totalValue) * 100 : 0,
        config: riskConfig.lowTurnover,
      },
    ].filter((d) => d.count > 0)
  }, [data, summary])

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
    }),
    [isLight]
  )

  if (isLoading) return <Skeleton isLight={isLight} />

  if (!data.length || !summary) {
    return (
      <div className={cn('py-6 text-center text-sm', styles.textMuted)}>
        No slow-moving inventory
      </div>
    )
  }

  // SVG donut chart calculations
  const size = 120
  const strokeWidth = 20
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  let cumulativePercentage = 0

  const totalAtRisk = summary.totalValue
  const hoveredData = hoveredSegment ? distribution.find((d) => d.key === hoveredSegment) : null

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

          {/* Risk segments */}
          {distribution.map((segment) => {
            if (segment.percentage < 0.5) return null

            const config = segment.config
            const startOffset = (cumulativePercentage / 100) * circumference
            const segmentLength = (segment.percentage / 100) * circumference
            cumulativePercentage += segment.percentage

            const isHovered = hoveredSegment === segment.key

            return (
              <circle
                key={segment.key}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={isLight ? config.lightColor : config.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                strokeDashoffset={-startOffset}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredSegment(segment.key)}
                onMouseLeave={() => setHoveredSegment(null)}
              />
            )
          })}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {hoveredData ? (
            <>
              <span className={cn('text-lg font-bold tabular-nums', styles.text)}>
                {hoveredData.count}
              </span>
              <span className={cn('text-[9px] uppercase tracking-wider', styles.textMuted)}>
                {hoveredData.config.label}
              </span>
            </>
          ) : (
            <>
              <span className={cn('text-lg font-bold tabular-nums', styles.text)}>
                {summary.totalItems}
              </span>
              <span className={cn('text-[9px] uppercase tracking-wider', styles.textMuted)}>
                At Risk
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend with details */}
      <div className="flex-1 space-y-2">
        {distribution.map((segment) => {
          const isHovered = hoveredSegment === segment.key
          return (
            <div
              key={segment.key}
              className={cn(
                'flex items-center gap-3 py-2 px-2 -mx-2 rounded transition-colors text-xs',
                isHovered ? (isLight ? 'bg-stone-100' : 'bg-white/[0.06]') : ''
              )}
              onMouseEnter={() => setHoveredSegment(segment.key)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{
                  backgroundColor: isLight ? segment.config.lightColor : segment.config.color,
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={cn('font-medium', styles.text)}>{segment.config.label}</span>
                  <span className={cn('font-mono tabular-nums', styles.textMuted)}>
                    {segment.count} items
                  </span>
                </div>
                <div className={cn('text-[10px]', styles.textMuted)}>
                  {segment.config.description}
                </div>
              </div>
              <div className="text-right">
                <div className={cn('font-mono tabular-nums font-medium', styles.text)}>
                  {formatCompactCurrency(segment.value, currency)}
                </div>
                <div className={cn('font-mono text-[10px] tabular-nums', styles.textMuted)}>
                  {segment.percentage.toFixed(0)}%
                </div>
              </div>
            </div>
          )
        })}

        {/* Total at risk */}
        <div className={cn('pt-2 mt-2 border-t flex justify-between', styles.border)}>
          <span className={cn('text-xs', styles.textMuted)}>Total at Risk</span>
          <span
            className={cn(
              'text-xs font-mono font-bold tabular-nums',
              isLight ? 'text-red-600' : 'text-red-400'
            )}
          >
            {formatCompactCurrency(totalAtRisk, currency)}
          </span>
        </div>
      </div>
    </div>
  )
}
