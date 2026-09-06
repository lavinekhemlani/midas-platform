'use client'

import { useMemo, useState } from 'react'

import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from './InfoTooltip'

interface CategoryData {
  item_category_code: string
  total_value: number
  item_count: number
}

interface InventoryByCategoryCardProps {
  data: CategoryData[]
  isLoading: boolean
  currency?: string
  tooltip?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

const CATEGORY_COLORS = [
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#ec4899', // pink
  '#14b8a6', // teal
]

// ── Donut Chart ──
function DonutChart({
  data,
  size = 140,
  thickness = 28,
  isLight,
}: {
  data: Array<{ value: number; color: string; label: string }>
  size?: number
  thickness?: number
  isLight: boolean
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2
  const total = data.reduce((sum, d) => sum + d.value, 0)

  let cumulativePercentage = 0

  return (
    <div className="relative overflow-visible" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90 overflow-visible">
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={isLight ? '#e5e7eb' : 'rgba(255,255,255,0.06)'}
          strokeWidth={thickness}
        />
        {/* Segments */}
        {data.map((segment, i) => {
          const percentage = total > 0 ? (segment.value / total) * 100 : 0
          const startOffset = (cumulativePercentage / 100) * circumference
          const segmentLength = (percentage / 100) * circumference
          cumulativePercentage += percentage

          const isHovered = hoveredIndex === i

          return (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={isHovered ? thickness + 4 : thickness}
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={-startOffset}
              className="transition-all duration-200 cursor-pointer"
              style={{ opacity: hoveredIndex !== null && !isHovered ? 0.4 : 1 }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          )
        })}
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {hoveredIndex !== null && data[hoveredIndex] ? (
          <>
            <span
              className={cn(
                'text-lg font-mono font-bold',
                isLight ? 'text-stone-900' : 'text-white'
              )}
            >
              {((data[hoveredIndex].value / total) * 100).toFixed(0)}%
            </span>
            <span
              className={cn(
                'text-[9px] uppercase tracking-wider text-center px-2',
                isLight ? 'text-stone-500' : 'text-stone-400'
              )}
            >
              {data[hoveredIndex].label.length > 10
                ? data[hoveredIndex].label.substring(0, 10) + '...'
                : data[hoveredIndex].label}
            </span>
          </>
        ) : null}
      </div>
    </div>
  )
}

export function InventoryByCategoryCard({
  data,
  isLoading,
  currency = 'USD',
  tooltip,
  tooltipProps,
}: InventoryByCategoryCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
    }),
    [isLight]
  )

  const totalValue = data.reduce((sum, item) => sum + item.total_value, 0)

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
            Inventory by Category
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <div className="flex gap-6">
          <div
            className={cn(
              'w-[140px] h-[140px] rounded-full animate-pulse flex-shrink-0',
              isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
            )}
          />
          <div className="flex-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-7 animate-pulse',
                  i % 2 === 0 ? (isLight ? 'bg-slate-100/70' : 'bg-white/[0.02]') : ''
                )}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Inventory by Category
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No category data available</p>
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
          Inventory by Category
          <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
        </span>
        {tooltipProps ? (
          <InfoTooltip {...tooltipProps} />
        ) : tooltip ? (
          <InfoTooltip content={tooltip} />
        ) : null}
      </div>

      <div className="flex gap-6 items-center">
        {/* Donut Chart */}
        <div className="flex-shrink-0 flex flex-col items-center">
          <DonutChart
            data={data
              .map((cat, i) => ({
                value: cat.total_value,
                color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                label: cat.item_category_code,
              }))
              .filter((d) => d.value > 0)}
            size={140}
            thickness={28}
            isLight={isLight}
          />
          <div className="flex flex-col items-center mt-2">
            <span className={cn('text-[28px] font-mono font-bold', isLight ? 'text-stone-700' : 'text-stone-300')}>
              {formatCompactCurrency(totalValue, currency)}
            </span>
            <span className={cn(
              'text-[12px] uppercase tracking-widest',
              isLight ? 'text-stone-400' : 'text-stone-500'
            )}>
              Total
            </span>
          </div>
        </div>

        {/* Category list */}
        <div
          className="flex-1 min-w-0 max-h-[300px] overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 dark:[&::-webkit-scrollbar-thumb]:bg-stone-600"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: isLight ? '#a8a29e transparent' : '#57534e transparent',
          }}
        >
          {data.map((cat, i) => {
            const pct = totalValue > 0 ? (cat.total_value / totalValue) * 100 : 0
            return (
              <div
                key={cat.item_category_code}
                className={cn(
                  'flex items-center gap-2 py-1.5 px-2 text-xs transition-colors',
                  i % 2 === 0 ? (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]') : '',
                  isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]'
                )}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                />
                <span
                  className={cn('flex-1 truncate font-normal text-[14px]', styles.text)}
                  title={cat.item_category_code}
                >
                  {cat.item_category_code}
                </span>
                <span
                  className={cn(
                    'font-mono tabular-nums text-[10px] font-medium',
                    isLight ? 'text-stone-700' : 'text-stone-300'
                  )}
                >
                  {pct.toFixed(0)}%
                </span>
                <span
                  className={cn(
                    'font-mono tabular-nums font-semibold text-[14px]',
                    isLight ? 'text-stone-700' : 'text-stone-300'
                  )}
                >
                  {formatCompactCurrency(cat.total_value, currency)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
