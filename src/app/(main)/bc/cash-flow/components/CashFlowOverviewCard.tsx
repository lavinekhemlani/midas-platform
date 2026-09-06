'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Wallet, ArrowRightLeft, Building, Landmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'

export interface CashFlowOverviewData {
  currentCash: number
  previousPeriodCash: number
  netCashChange: number
  operatingCashFlow: number
  investingCashFlow: number
  financingCashFlow: number
}

interface CashFlowOverviewCardProps {
  data: CashFlowOverviewData | null
  isLoading: boolean
  currency?: string
  isLight?: boolean
}

export function CashFlowOverviewCard({
  data,
  isLoading,
  currency = 'USD',
  isLight: isLightProp,
}: CashFlowOverviewCardProps) {
  const { theme } = useTheme()
  const isLight = isLightProp ?? theme === 'light'

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
    }),
    [isLight]
  )

  const netChangePercent = useMemo(() => {
    if (!data || data.previousPeriodCash === 0) return 0
    return ((data.currentCash - data.previousPeriodCash) / Math.abs(data.previousPeriodCash)) * 100
  }, [data])

  if (isLoading) {
    return (
      <div className={cn('flex flex-wrap gap-6 @3xl:gap-10 py-5 border-b', styles.border)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="space-y-2 min-w-[120px]">
            <div
              className={cn(
                'h-3 w-16 animate-pulse rounded',
                isLight ? 'bg-stone-100' : 'bg-white/[0.04]'
              )}
            />
            <div
              className={cn(
                'h-8 w-28 animate-pulse rounded',
                isLight ? 'bg-stone-100' : 'bg-white/[0.04]'
              )}
            />
          </div>
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className={cn('py-5 border-b', styles.border)}>
        <p className={cn('text-sm', styles.textMuted)}>No cash flow data available</p>
      </div>
    )
  }

  const metrics = [
    {
      label: 'Current Cash',
      value: formatCompactCurrency(data.currentCash, currency),
      color: 'default',
      icon: Wallet,
      iconColor: isLight ? 'text-stone-600' : 'text-stone-400',
    },
    {
      label: 'Net Change',
      value: `${data.netCashChange >= 0 ? '+' : ''}${formatCompactCurrency(data.netCashChange, currency)}`,
      color: data.netCashChange >= 0 ? 'green' : 'red',
      icon: data.netCashChange >= 0 ? TrendingUp : TrendingDown,
      iconColor:
        data.netCashChange >= 0
          ? isLight
            ? 'text-green-600'
            : 'text-green-400'
          : isLight
            ? 'text-red-600'
            : 'text-red-400',
      percent: netChangePercent !== 0 ? netChangePercent : null,
    },
    {
      label: 'Operating',
      value: formatCompactCurrency(data.operatingCashFlow, currency),
      color: data.operatingCashFlow >= 0 ? 'green' : 'red',
      icon: ArrowRightLeft,
      iconColor:
        data.operatingCashFlow >= 0
          ? isLight
            ? 'text-green-600'
            : 'text-green-400'
          : isLight
            ? 'text-red-600'
            : 'text-red-400',
    },
    {
      label: 'Investing',
      value: formatCompactCurrency(data.investingCashFlow, currency),
      color: data.investingCashFlow >= 0 ? 'blue' : 'amber',
      icon: Building,
      iconColor:
        data.investingCashFlow >= 0
          ? isLight
            ? 'text-blue-600'
            : 'text-blue-400'
          : isLight
            ? 'text-amber-600'
            : 'text-amber-400',
    },
    {
      label: 'Financing',
      value: formatCompactCurrency(data.financingCashFlow, currency),
      color: data.financingCashFlow >= 0 ? 'purple' : 'red',
      icon: Landmark,
      iconColor:
        data.financingCashFlow >= 0
          ? isLight
            ? 'text-purple-600'
            : 'text-purple-400'
          : isLight
            ? 'text-red-600'
            : 'text-red-400',
    },
  ]

  const getValueColor = (color: string) => {
    const colors: Record<string, string> = {
      default: styles.text,
      green: isLight ? 'text-green-600' : 'text-green-400',
      red: isLight ? 'text-red-600' : 'text-red-400',
      blue: isLight ? 'text-blue-600' : 'text-blue-400',
      amber: isLight ? 'text-amber-600' : 'text-amber-400',
      purple: isLight ? 'text-purple-600' : 'text-purple-400',
    }
    return colors[color] || styles.text
  }

  return (
    <div className={cn('flex flex-wrap gap-6 @3xl:gap-10 py-5 border-b', styles.border)}>
      {metrics.map((metric) => (
        <div key={metric.label} className="min-w-[120px]">
          <div className="flex items-center gap-2 mb-1.5">
            <metric.icon className={cn('w-3.5 h-3.5', metric.iconColor)} />
            <span
              className={cn('text-[10px] uppercase tracking-wider font-medium', styles.textMuted)}
            >
              {metric.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-2xl font-mono font-semibold tabular-nums',
                getValueColor(metric.color)
              )}
            >
              {metric.value}
            </span>
            {metric.percent && (
              <span
                className="text-xs font-mono px-1.5 py-0.5"
                style={{
                  color:
                    metric.percent >= 0
                      ? isLight
                        ? '#15803d'
                        : '#4ade80'
                      : isLight
                        ? '#dc2626'
                        : '#f87171',
                  backgroundColor:
                    metric.percent >= 0
                      ? isLight
                        ? '#f0fdf4'
                        : 'rgba(34, 197, 94, 0.1)'
                      : isLight
                        ? '#fef2f2'
                        : 'rgba(239, 68, 68, 0.1)',
                }}
              >
                {metric.percent >= 0 ? '+' : ''}
                {metric.percent.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
