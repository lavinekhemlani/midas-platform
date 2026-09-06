'use client'

import { useMemo } from 'react'
import { TrendingDown, TrendingUp, Infinity, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from '@/components/ui/InfoTooltip'
import type { CalculationTooltip } from '@/components/ui/InfoTooltip'
import type { CashRunwayData } from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'

interface CashRunwayCardProps {
  data: CashRunwayData | null
  isLoading: boolean
  currency?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

export function CashRunwayCard({
  data,
  isLoading,
  currency = 'USD',
  tooltipProps,
}: CashRunwayCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
    }),
    [isLight]
  )

  // Runway color and rating
  const getRunwayStatus = (months: number | null) => {
    if (months === null) {
      return {
        color: isLight ? 'text-green-600' : 'text-green-400',
        label: 'Profitable',
        barColor: '#10b981',
      }
    }
    if (months < 3) {
      return {
        color: isLight ? 'text-red-600' : 'text-red-400',
        label: 'Critical',
        barColor: '#ef4444',
      }
    }
    if (months < 6) {
      return { color: 'text-orange-500', label: 'Warning', barColor: '#f97316' }
    }
    if (months < 12) {
      return { color: 'text-amber-500', label: 'Moderate', barColor: '#f59e0b' }
    }
    return {
      color: isLight ? 'text-green-600' : 'text-green-400',
      label: 'Healthy',
      barColor: '#10b981',
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Cash Runway & Burn
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        <div className={cn('h-16 animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')} />
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={cn('h-8 animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
          />
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Cash Runway & Burn
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No data available</p>
      </div>
    )
  }

  const runwayStatus = getRunwayStatus(data.cashRunwayMonths)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Cash Runway & Burn
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps && <InfoTooltip {...tooltipProps} />}
        </div>
        <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
      </div>

      {/* Runway Display */}
      <div className="py-4 px-2 -mx-2 mb-2">
        <div className="flex items-end justify-between">
          <div className="flex items-end gap-3">
            {data.cashRunwayMonths === null ? (
              <Infinity className={cn('w-8 h-8', runwayStatus.color)} />
            ) : (
              <span
                className={cn(
                  'text-[28px] font-mono font-bold tabular-nums leading-none',
                  runwayStatus.color
                )}
              >
                {data.cashRunwayMonths.toFixed(1)}
              </span>
            )}
            <span className={cn('text-xs mb-0.5', styles.textMuted)}>
              {data.cashRunwayMonths === null ? '' : 'months runway'}
            </span>
            <InfoTooltip
              description={
                data.cashRunwayMonths === null
                  ? 'Company is profitable — revenue exceeds expenses, so cash is growing.'
                  : 'Estimated months until cash runs out at current net burn rate.'
              }
              calculationTooltip={{
                formula:
                  data.cashRunwayMonths === null
                    ? data.grossBurnRate <= 0
                      ? 'FCF is positive — cash is growing'
                      : 'Cash Balance \u00f7 Monthly Burn Rate'
                    : 'Cash Balance \u00f7 Monthly Burn Rate',
                components: [
                  { label: 'Cash Balance', value: formatCompactCurrency(data.totalCash, currency) },
                  ...(data.grossBurnRate > 0
                    ? [
                        {
                          label: '\u00f7 Burn Rate',
                          value: `${formatCompactCurrency(data.grossBurnRate, currency)}/mo`,
                        },
                      ]
                    : []),
                  {
                    label: '= Runway',
                    value:
                      data.cashRunwayMonths !== null
                        ? `${data.cashRunwayMonths.toFixed(1)} months`
                        : data.grossBurnRate <= 0
                          ? 'No burn (cash growing)'
                          : '—',
                    highlight: true,
                  },
                ],
              }}
            />
          </div>
          <span
            className="text-[14px] font-medium px-1.5 py-0.5"
            style={{
              color: runwayStatus.barColor,
              backgroundColor: `${runwayStatus.barColor}15`,
            }}
          >
            {runwayStatus.label}
          </span>
        </div>

        {/* Runway bar */}
        {data.cashRunwayMonths !== null && (
          <div className={cn('h-1.5 w-full mt-3', isLight ? 'bg-stone-100' : 'bg-white/[0.04]')}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.min((data.cashRunwayMonths / 24) * 100, 100)}%`,
                backgroundColor: runwayStatus.barColor,
              }}
            />
          </div>
        )}
      </div>

      {/* Burn Rate Metrics */}
      <div className={cn('border-t pt-2', styles.border)}>
        {/* Monthly Burn Rate */}
        <div className="flex items-center justify-between py-2.5 px-2 -mx-2 text-sm">
          <div className="flex items-center gap-1.5">
            <span className={isLight ? 'text-stone-700' : 'text-stone-300'}>Monthly Burn</span>
            <InfoTooltip
              description={
                data.grossBurnRate > 0
                  ? 'Monthly cash consumed based on Free Cash Flow. Positive = company is spending more cash than it generates.'
                  : 'Company is generating positive Free Cash Flow — no cash burn.'
              }
              calculationTooltip={{
                formula: 'OCF - CapEx = FCF, Burn = |Monthly FCF| if negative',
                components: [
                  {
                    label: 'Monthly Revenue',
                    value: `${formatCompactCurrency(data.monthlyRevenue, currency)}/mo`,
                  },
                  {
                    label: 'Monthly Expenses',
                    value: `${formatCompactCurrency(data.monthlyExpenses, currency)}/mo`,
                  },
                  {
                    label: '= Burn Rate',
                    value:
                      data.grossBurnRate > 0
                        ? `${formatCompactCurrency(data.grossBurnRate, currency)}/mo`
                        : 'No burn (FCF positive)',
                    highlight: true,
                  },
                ],
              }}
            />
          </div>
          <span
            className={cn(
              'text-base font-mono font-semibold tabular-nums',
              data.grossBurnRate > 0
                ? 'text-orange-500'
                : isLight
                  ? 'text-green-600'
                  : 'text-green-400'
            )}
          >
            {data.grossBurnRate > 0
              ? `${formatCompactCurrency(data.grossBurnRate, currency)}/mo`
              : `${formatCompactCurrency(0, currency)}/mo`}
          </span>
        </div>

        {/* Monthly Revenue */}
        <div className="flex items-center justify-between py-2.5 px-2 -mx-2 text-sm">
          <div className="flex items-center gap-2">
            <TrendingUp
              className={cn('w-3.5 h-3.5', isLight ? 'text-green-600' : 'text-green-400')}
            />
            <span className={isLight ? 'text-stone-700' : 'text-stone-300'}>Monthly Revenue</span>
          </div>
          <span
            className={cn(
              'text-base font-mono font-semibold tabular-nums',
              isLight ? 'text-green-600' : 'text-green-400'
            )}
          >
            {formatCompactCurrency(data.monthlyRevenue, currency)}/mo
          </span>
        </div>

        {/* Monthly Expenses */}
        <div className="flex items-center justify-between py-2.5 px-2 -mx-2 text-sm">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-3.5 h-3.5 text-orange-500" />
            <span className={isLight ? 'text-stone-700' : 'text-stone-300'}>Monthly Expenses</span>
          </div>
          <span className="text-base font-mono font-semibold tabular-nums text-orange-500">
            {formatCompactCurrency(data.monthlyExpenses, currency)}/mo
          </span>
        </div>

        {/* Monthly Revenue */}
        <div className="flex items-center justify-between py-2.5 px-2 -mx-2 text-sm">
          <div className="flex items-center gap-2">
            <TrendingUp
              className={cn('w-3.5 h-3.5', isLight ? 'text-green-600' : 'text-green-400')}
            />
            <span className={isLight ? 'text-stone-700' : 'text-stone-300'}>Monthly Revenue</span>
          </div>
          <span
            className={cn(
              'text-base font-mono font-semibold tabular-nums',
              isLight ? 'text-green-600' : 'text-green-400'
            )}
          >
            {formatCompactCurrency(data.monthlyRevenue, currency)}/mo
          </span>
        </div>

        {/* Cash Balance */}
        <div
          className={cn(
            'flex items-center justify-between py-2.5 px-2 -mx-2 mt-2 border-t',
            styles.border
          )}
        >
          <span className={cn('text-sm font-normal uppercase tracking-wider', styles.textMuted)}>
            Cash Balance
          </span>
          <span className={cn('text-base font-mono font-bold tabular-nums', styles.text)}>
            {formatCompactCurrency(data.totalCash, currency)}
          </span>
        </div>
      </div>
    </div>
  )
}
