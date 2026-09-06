'use client'

import { useMemo, useState } from 'react'
import { PieChart, AlertTriangle, CheckCircle, TrendingDown, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { VendorConcentration } from '../hooks/useVendorInsights'

interface SpendConcentrationChartProps {
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

function RadialChart({
  data,
  size = 280,
  thickness = 35,
  isLight,
  currency,
  onHover,
}: {
  data: VendorConcentration[]
  size?: number
  thickness?: number
  isLight: boolean
  currency: string
  onHover: (vendor: VendorConcentration | null) => void
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  // Calculate total for the "others" segment
  const top10Total = data.slice(0, 10).reduce((sum, v) => sum + Number(v.percentage), 0)
  const othersPercentage = Math.max(0, 100 - top10Total)

  // Create segments including "others"
  const segments = useMemo(() => {
    const segs = data.slice(0, 10).map((vendor, i) => ({
      vendor,
      percentage: Number(vendor.percentage),
      color: arcColors[i % arcColors.length],
      index: i,
    }))

    if (othersPercentage > 0) {
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
  }, [data, othersPercentage, isLight])

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
          stroke={isLight ? '#f3f4f6' : 'rgba(255,255,255,0.04)'}
          strokeWidth={thickness}
        />

        {/* Inner decorative ring */}
        <circle
          cx={center}
          cy={center}
          r={radius - thickness / 2 - 15}
          fill="none"
          stroke={isLight ? '#f9fafb' : 'rgba(255,255,255,0.02)'}
          strokeWidth={2}
        />

        {/* Segments */}
        {segments.map((segment, i) => {
          const startOffset = (cumulativePercentage / 100) * circumference
          const segmentLength = (segment.percentage / 100) * circumference
          cumulativePercentage += segment.percentage

          const isHovered = hoveredIndex === i
          const scale = isHovered ? 1.03 : 1

          return (
            <circle
              key={segment.vendor.no}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={isHovered ? thickness + 8 : thickness}
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={-startOffset}
              className="transition-all duration-200 cursor-pointer"
              style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
              onMouseEnter={() => {
                setHoveredIndex(i)
                onHover(segment.vendor)
              }}
              onMouseLeave={() => {
                setHoveredIndex(null)
                onHover(null)
              }}
            />
          )
        })}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {hoveredIndex !== null && segments[hoveredIndex] ? (
          <>
            <span
              className={cn(
                'text-3xl font-bold tabular-nums',
                isLight ? 'text-stone-900' : 'text-white'
              )}
            >
              {segments[hoveredIndex].percentage.toFixed(1)}%
            </span>
            <span
              className={cn(
                'text-xs font-medium text-center px-4 max-w-[140px] truncate',
                isLight ? 'text-stone-600' : 'text-stone-400'
              )}
            >
              {segments[hoveredIndex].vendor.name}
            </span>
            {segments[hoveredIndex].vendor.purchases_lcy > 0 && (
              <span
                className={cn(
                  'text-xs tabular-nums mt-1',
                  isLight ? 'text-stone-500' : 'text-stone-500'
                )}
              >
                {formatCompactCurrency(segments[hoveredIndex].vendor.purchases_lcy, currency)}
              </span>
            )}
          </>
        ) : (
          <>
            <Building2
              className={cn('w-8 h-8 mb-2', isLight ? 'text-stone-300' : 'text-stone-600')}
            />
            <span className={cn('text-xs', isLight ? 'text-stone-500' : 'text-stone-500')}>
              Hover to explore
            </span>
          </>
        )}
      </div>
    </div>
  )
}

function DependencyMeter({
  value,
  label,
  threshold,
  isLight,
}: {
  value: number
  label: string
  threshold: number
  isLight: boolean
}) {
  const isRisky = value > threshold
  const color = isRisky
    ? isLight
      ? 'text-amber-600'
      : 'text-amber-400'
    : isLight
      ? 'text-emerald-600'
      : 'text-emerald-400'

  return (
    <div
      className={cn(
        'rounded-xl p-3 text-center transition-all',
        isLight ? 'bg-stone-50/80' : 'bg-white/[0.03]'
      )}
    >
      <div className={cn('text-2xl font-bold tabular-nums', color)}>{value.toFixed(1)}%</div>
      <div
        className={cn(
          'text-[10px] uppercase tracking-wider font-medium mt-1',
          isLight ? 'text-stone-500' : 'text-stone-500'
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          'w-full h-1.5 rounded-full mt-2 overflow-hidden',
          isLight ? 'bg-stone-200' : 'bg-white/10'
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isRisky ? 'bg-amber-500' : 'bg-emerald-500'
          )}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}

function SkeletonLoader({ isLight }: { isLight: boolean }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className={cn(
          'w-[280px] h-[280px] rounded-full animate-pulse',
          isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
        )}
      />
      <div className="grid grid-cols-3 gap-3 w-full">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'rounded-xl p-3 animate-pulse',
              isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
            )}
          >
            <div
              className={cn(
                'h-6 w-16 rounded mx-auto mb-2',
                isLight ? 'bg-stone-200' : 'bg-white/10'
              )}
            />
            <div
              className={cn('h-3 w-12 rounded mx-auto', isLight ? 'bg-stone-200' : 'bg-white/10')}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SpendConcentrationChart({
  data,
  metrics,
  isLoading,
  currency = 'USD',
}: SpendConcentrationChartProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [hoveredVendor, setHoveredVendor] = useState<VendorConcentration | null>(null)

  const riskConfig = {
    low: {
      icon: CheckCircle,
      label: 'Well Diversified',
      color: isLight ? 'text-emerald-600' : 'text-emerald-400',
      bg: isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/20',
    },
    medium: {
      icon: TrendingDown,
      label: 'Moderate Dependency',
      color: isLight ? 'text-amber-600' : 'text-amber-400',
      bg: isLight ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/10 border-amber-500/20',
    },
    high: {
      icon: AlertTriangle,
      label: 'High Dependency Risk',
      color: isLight ? 'text-red-600' : 'text-red-400',
      bg: isLight ? 'bg-red-50 border-red-200' : 'bg-red-500/10 border-red-500/20',
    },
  }

  const risk = riskConfig[metrics.concentrationRisk]
  const RiskIcon = risk.icon

  const styles = useMemo(
    () => ({
      card: isLight
        ? 'bg-white/90 border-stone-200/60 shadow-sm'
        : 'bg-white/[0.02] border-white/[0.06]',
    }),
    [isLight]
  )

  return (
    <div className={cn('rounded-2xl border p-5 transition-all duration-300', styles.card)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className={cn('text-base font-semibold', isLight ? 'text-stone-900' : 'text-white')}>
            Spend Concentration
          </h3>
          <p className={cn('text-xs', isLight ? 'text-stone-500' : 'text-stone-400')}>
            Vendor spend distribution analysis
          </p>
        </div>
        <div
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold',
            risk.bg
          )}
        >
          <RiskIcon className={cn('w-3.5 h-3.5', risk.color)} />
          <span className={risk.color}>{risk.label}</span>
        </div>
      </div>

      {isLoading ? (
        <SkeletonLoader isLight={isLight} />
      ) : data.length > 0 ? (
        <div className="space-y-6">
          {/* Radial Chart */}
          <div className="flex justify-center">
            <RadialChart
              data={data}
              isLight={isLight}
              currency={currency}
              onHover={setHoveredVendor}
            />
          </div>

          {/* Dependency Meters */}
          <div className="grid grid-cols-3 gap-3">
            <DependencyMeter
              value={metrics.topVendorPercentage}
              label="Top Vendor"
              threshold={30}
              isLight={isLight}
            />
            <DependencyMeter
              value={metrics.top5Percentage}
              label="Top 5"
              threshold={60}
              isLight={isLight}
            />
            <DependencyMeter
              value={metrics.top10Percentage}
              label="Top 10"
              threshold={80}
              isLight={isLight}
            />
          </div>

          {/* Legend */}
          <div
            className={cn('pt-4 border-t', isLight ? 'border-stone-200/60' : 'border-white/[0.06]')}
          >
            <div
              className={cn(
                'text-[10px] uppercase tracking-wider font-semibold mb-3',
                isLight ? 'text-stone-500' : 'text-stone-500'
              )}
            >
              Top Vendors by Spend
            </div>
            <div className="grid grid-cols-2 gap-2">
              {data.slice(0, 6).map((vendor, i) => (
                <div
                  key={vendor.no}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors',
                    hoveredVendor?.no === vendor.no
                      ? isLight
                        ? 'bg-stone-100'
                        : 'bg-white/[0.06]'
                      : ''
                  )}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: arcColors[i % arcColors.length] }}
                  />
                  <span
                    className={cn(
                      'text-xs truncate flex-1',
                      isLight ? 'text-stone-700' : 'text-stone-300'
                    )}
                    title={vendor.name}
                  >
                    {vendor.name.length > 15 ? vendor.name.substring(0, 15) + '...' : vendor.name}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-semibold tabular-nums',
                      isLight ? 'text-stone-900' : 'text-white'
                    )}
                  >
                    {Number(vendor.percentage).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-64">
          <p className={cn('text-sm', isLight ? 'text-stone-500' : 'text-stone-400')}>
            No concentration data available
          </p>
        </div>
      )}
    </div>
  )
}
