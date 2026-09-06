'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { CustomerRiskRow, CreditRiskSummary } from '../hooks/useCustomerInsights'

interface RiskDistributionChartProps {
  data: CustomerRiskRow[]
  summary: CreditRiskSummary | null
  isLoading: boolean
  currency?: string
}

const riskConfig = {
  critical: {
    label: 'Critical',
    color: '#ef4444',
    lightColor: '#dc2626',
    description: 'Blocked or severely over limit',
  },
  high: {
    label: 'High',
    color: '#f97316',
    lightColor: '#ea580c',
    description: 'Over credit limit or high overdue',
  },
  medium: {
    label: 'Medium',
    color: '#f59e0b',
    lightColor: '#d97706',
    description: 'Approaching limits',
  },
  low: {
    label: 'Low',
    color: '#10b981',
    lightColor: '#059669',
    description: 'Within normal parameters',
  },
}

function Skeleton({ isLight }: { isLight: boolean }) {
  return (
    <div className="flex items-center gap-6">
      <div
        className={cn(
          'w-[140px] h-[140px] rounded-full animate-pulse',
          isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
        )}
      />
      <div className="flex-1 space-y-2">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-6 animate-pulse rounded',
              isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
            )}
          />
        ))}
      </div>
    </div>
  )
}

export function RiskDistributionChart({
  data,
  summary,
  isLoading,
  currency = 'USD',
}: RiskDistributionChartProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  // Calculate distribution
  const distribution = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 }
    const balances = { critical: 0, high: 0, medium: 0, low: 0 }

    data.forEach((customer) => {
      counts[customer.risk_score]++
      balances[customer.risk_score] += customer.balance_lcy
    })

    const total = data.length
    return Object.entries(counts).map(([risk, count]) => ({
      risk: risk as keyof typeof riskConfig,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
      balance: balances[risk as keyof typeof balances],
    }))
  }, [data])

  const totalCustomers = data.length
  const totalBalance = distribution.reduce((sum, d) => sum + d.balance, 0)

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
    }),
    [isLight]
  )

  if (isLoading) return <Skeleton isLight={isLight} />

  if (!data.length) {
    return <div className={cn('py-6 text-center text-sm', styles.textMuted)}>No risk data</div>
  }

  // SVG donut chart calculations
  const size = 140
  const strokeWidth = 24
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  let cumulativePercentage = 0

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

            const config = riskConfig[segment.risk]
            const startOffset = (cumulativePercentage / 100) * circumference
            const segmentLength = (segment.percentage / 100) * circumference
            cumulativePercentage += segment.percentage

            return (
              <circle
                key={segment.risk}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={isLight ? config.lightColor : config.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                strokeDashoffset={-startOffset}
                className="transition-all duration-500"
              />
            )
          })}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-2xl font-bold tabular-nums', styles.text)}>
            {totalCustomers}
          </span>
          <span className={cn('text-[10px] uppercase tracking-wider', styles.textMuted)}>
            Customers
          </span>
        </div>
      </div>

      {/* Legend with details - matching inventory list styling */}
      <div className="flex-1 min-w-0">
        {distribution.map((segment, i) => {
          const config = riskConfig[segment.risk]
          return (
            <div
              key={segment.risk}
              className={cn(
                'flex items-center gap-2 py-1.5 px-2 -mx-2 transition-colors text-xs',
                i % 2 === 0 ? (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]') : '',
                isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]'
              )}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: isLight ? config.lightColor : config.color }}
              />
              <span className={cn('flex-1 truncate font-medium', styles.text)}>{config.label}</span>
              <span
                className={cn('font-mono tabular-nums text-[10px] font-medium', styles.textMuted)}
              >
                {segment.count}
              </span>
              <span
                className={cn(
                  'font-mono tabular-nums text-[10px] font-medium w-10 text-right',
                  styles.textMuted
                )}
              >
                {segment.percentage.toFixed(0)}%
              </span>
              <span
                className={cn(
                  'font-mono tabular-nums font-semibold text-[11px] w-16 text-right',
                  styles.text
                )}
              >
                {formatCompactCurrency(segment.balance, currency)}
              </span>
            </div>
          )
        })}

        {/* Total AR */}
        <div className={cn('pt-3 mt-3 border-t flex justify-between', styles.border)}>
          <span
            className={cn('text-[9px] uppercase tracking-widest font-semibold', styles.textMuted)}
          >
            Total AR
          </span>
          <span
            className={cn('text-base font-mono font-bold tabular-nums tracking-tight', styles.text)}
          >
            {formatCompactCurrency(totalBalance, currency)}
          </span>
        </div>
      </div>
    </div>
  )
}
