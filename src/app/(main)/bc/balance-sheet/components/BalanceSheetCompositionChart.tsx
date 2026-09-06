'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface CategoryItem {
  name: string
  value: number
  count: number
}

interface BalanceSheetCompositionChartProps {
  data: {
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
    isBalanced: boolean
  } | null
  categoryBreakdown: {
    assetCategories: CategoryItem[]
    liabilityCategories: CategoryItem[]
    equityCategories: CategoryItem[]
  } | null
  isLoading: boolean
  currency: string
}

const ASSET_COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']
const LIABILITY_COLORS = ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2']
const EQUITY_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5']

interface DonutChartProps {
  data: Array<{ value: number; color: string; label: string }>
  size?: number
  thickness?: number
  isLight: boolean
  centerLabel?: string
  centerValue?: string
  onHover?: (index: number | null) => void
  hoveredIndex?: number | null
}

function DonutChart({
  data,
  size = 160,
  thickness = 24,
  isLight,
  centerLabel,
  centerValue,
  onHover,
  hoveredIndex,
}: DonutChartProps) {
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2
  const total = data.reduce((sum, d) => sum + Math.abs(d.value), 0)

  let cumulativePercentage = 0

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
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
          const percentage = total > 0 ? (Math.abs(segment.value) / total) * 100 : 0
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
              onMouseEnter={() => onHover?.(i)}
              onMouseLeave={() => onHover?.(null)}
            />
          )
        })}
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {hoveredIndex !== null && hoveredIndex !== undefined && data[hoveredIndex] ? (
          <>
            <span
              className={cn(
                'text-lg font-mono font-bold',
                isLight ? 'text-stone-900' : 'text-white'
              )}
            >
              {((Math.abs(data[hoveredIndex].value) / total) * 100).toFixed(0)}%
            </span>
            <span
              className={cn(
                'text-[9px] uppercase tracking-wider text-center px-2',
                isLight ? 'text-stone-500' : 'text-stone-400'
              )}
            >
              {data[hoveredIndex].label.length > 12
                ? data[hoveredIndex].label.substring(0, 12) + '...'
                : data[hoveredIndex].label}
            </span>
          </>
        ) : (
          <>
            <span
              className={cn(
                'text-sm font-mono font-bold',
                isLight ? 'text-stone-900' : 'text-white'
              )}
            >
              {centerValue}
            </span>
            <span
              className={cn(
                'text-[8px] uppercase tracking-widest',
                isLight ? 'text-stone-400' : 'text-stone-500'
              )}
            >
              {centerLabel}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

export function BalanceSheetCompositionChart({
  data,
  categoryBreakdown,
  isLoading,
  currency,
}: BalanceSheetCompositionChartProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      rowEven: isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]',
      rowHover: isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]',
    }),
    [isLight]
  )

  if (isLoading) {
    return (
      <div className="flex gap-6">
        <div className="flex-shrink-0 flex items-center">
          <div
            className={cn(
              'w-[160px] h-[160px] rounded-full animate-pulse',
              isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
            )}
          />
        </div>
        <div className="flex-1 space-y-2">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={cn('h-7 animate-pulse', isLight ? 'bg-slate-100/70' : 'bg-white/[0.02]')}
            />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return <p className={cn('text-sm py-4', styles.textMuted)}>No balance sheet data available</p>
  }

  // Create donut chart data with Assets, Liabilities, Equity
  const donutData = [
    { value: data.totalAssets, color: '#3b82f6', label: 'Assets' },
    { value: data.totalLiabilities, color: '#ef4444', label: 'Liabilities' },
    { value: data.totalEquity, color: '#10b981', label: 'Equity' },
  ].filter((d) => d.value !== 0)

  const total = data.totalAssets + data.totalLiabilities + data.totalEquity

  return (
    <div className="flex gap-6">
      {/* Donut Chart - vertically centered */}
      <div className="flex-shrink-0 flex items-center">
        <DonutChart
          data={donutData}
          size={160}
          thickness={22}
          isLight={isLight}
          centerValue={formatCompactCurrency(data.totalAssets, currency)}
          centerLabel="Assets"
          onHover={setHoveredIndex}
          hoveredIndex={hoveredIndex}
        />
      </div>

      {/* Breakdown List */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Assets */}
        <div
          className={cn(
            'flex items-center gap-3 py-2 px-2 -mx-2 text-xs',
            styles.rowEven,
            styles.rowHover
          )}
          onMouseEnter={() => setHoveredIndex(0)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <div className="w-3 h-3 rounded bg-blue-500 flex-shrink-0" />
          <span className={cn('flex-1 font-medium', styles.text)}>Assets</span>
          <span className={cn('font-mono tabular-nums text-[11px]', styles.textMuted)}>
            {data.totalAssets > 0 && total > 0
              ? ((data.totalAssets / total) * 100).toFixed(0) + '%'
              : '—'}
          </span>
          <span className={cn('font-mono tabular-nums font-semibold', styles.text)}>
            {formatCompactCurrency(data.totalAssets, currency)}
          </span>
        </div>

        {/* Asset subcategories */}
        {categoryBreakdown?.assetCategories
          .filter((c) => c.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 3)
          .map((cat, i) => (
            <div
              key={cat.name}
              className={cn(
                'flex items-center gap-3 py-1.5 px-2 pl-6 -mx-2 text-xs',
                styles.rowHover
              )}
            >
              <div
                className="w-2 h-2 rounded flex-shrink-0"
                style={{ backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length] }}
              />
              <span className={cn('flex-1 truncate', styles.textMuted)} title={cat.name}>
                {cat.name}
              </span>
              <span className={cn('font-mono tabular-nums text-[10px]', styles.textMuted)}>
                {cat.count} acct{cat.count !== 1 ? 's' : ''}
              </span>
              <span className={cn('font-mono tabular-nums text-[11px]', styles.text)}>
                {formatCompactCurrency(cat.value, currency)}
              </span>
            </div>
          ))}

        {/* Liabilities */}
        <div
          className={cn(
            'flex items-center gap-3 py-2 px-2 -mx-2 text-xs mt-2',
            styles.rowEven,
            styles.rowHover
          )}
          onMouseEnter={() => setHoveredIndex(1)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <div className="w-3 h-3 rounded bg-red-500 flex-shrink-0" />
          <span className={cn('flex-1 font-medium', styles.text)}>Liabilities</span>
          <span className={cn('font-mono tabular-nums text-[11px]', styles.textMuted)}>
            {data.totalLiabilities > 0 && total > 0
              ? ((data.totalLiabilities / total) * 100).toFixed(0) + '%'
              : '—'}
          </span>
          <span
            className={cn(
              'font-mono tabular-nums font-semibold',
              isLight ? 'text-red-600' : 'text-red-400'
            )}
          >
            {formatCompactCurrency(data.totalLiabilities, currency)}
          </span>
        </div>

        {/* Liability subcategories */}
        {categoryBreakdown?.liabilityCategories
          .filter((c) => c.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 2)
          .map((cat, i) => (
            <div
              key={cat.name}
              className={cn(
                'flex items-center gap-3 py-1.5 px-2 pl-6 -mx-2 text-xs',
                styles.rowHover
              )}
            >
              <div
                className="w-2 h-2 rounded flex-shrink-0"
                style={{ backgroundColor: LIABILITY_COLORS[i % LIABILITY_COLORS.length] }}
              />
              <span className={cn('flex-1 truncate', styles.textMuted)} title={cat.name}>
                {cat.name}
              </span>
              <span className={cn('font-mono tabular-nums text-[11px]', styles.text)}>
                {formatCompactCurrency(cat.value, currency)}
              </span>
            </div>
          ))}

        {/* Equity */}
        <div
          className={cn(
            'flex items-center gap-3 py-2 px-2 -mx-2 text-xs mt-2',
            styles.rowEven,
            styles.rowHover
          )}
          onMouseEnter={() => setHoveredIndex(2)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <div className="w-3 h-3 rounded bg-green-500 flex-shrink-0" />
          <span className={cn('flex-1 font-medium', styles.text)}>Equity</span>
          <span className={cn('font-mono tabular-nums text-[11px]', styles.textMuted)}>
            {data.totalEquity > 0 && total > 0
              ? ((data.totalEquity / total) * 100).toFixed(0) + '%'
              : '—'}
          </span>
          <span
            className={cn(
              'font-mono tabular-nums font-semibold',
              isLight ? 'text-green-600' : 'text-green-400'
            )}
          >
            {formatCompactCurrency(data.totalEquity, currency)}
          </span>
        </div>

        {/* Equity subcategories */}
        {categoryBreakdown?.equityCategories
          .filter((c) => c.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 2)
          .map((cat, i) => (
            <div
              key={cat.name}
              className={cn(
                'flex items-center gap-3 py-1.5 px-2 pl-6 -mx-2 text-xs',
                styles.rowHover
              )}
            >
              <div
                className="w-2 h-2 rounded flex-shrink-0"
                style={{ backgroundColor: EQUITY_COLORS[i % EQUITY_COLORS.length] }}
              />
              <span className={cn('flex-1 truncate', styles.textMuted)} title={cat.name}>
                {cat.name}
              </span>
              <span className={cn('font-mono tabular-nums text-[11px]', styles.text)}>
                {formatCompactCurrency(cat.value, currency)}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}
