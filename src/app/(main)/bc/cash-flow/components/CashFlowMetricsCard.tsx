'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Infinity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import {
  InfoTooltip,
  type InfoTooltipProps,
  type CalculationTooltip,
} from '@/components/ui/InfoTooltip'

export interface CashFlowMetricsData {
  operatingCashFlow: number
  freeCashFlow: number
  cashRunway: number | null
  burnRate: number
  cashConversionCycle?: number | null
  operatingCashFlowRatio?: number | null
}

export interface CashFlowBreakdown {
  netIncome?: number
  depreciation?: number
  arChange?: number
  inventoryChange?: number
  apChange?: number
  otherWCChanges?: number
  capitalExpenditures?: number
  cashBalance?: number
  monthCount?: number
}

interface CashFlowMetricsCardProps {
  data: CashFlowMetricsData | null
  isLoading: boolean
  currency?: string
  isLight?: boolean
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
  breakdown?: CashFlowBreakdown
}

export function CashFlowMetricsCard({
  data,
  isLoading,
  currency = 'USD',
  isLight: isLightProp,
  tooltipProps,
  breakdown,
}: CashFlowMetricsCardProps) {
  const { theme } = useTheme()
  const isLight = isLightProp ?? theme === 'light'

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
      <div>
        <div className="mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Cash Flow Metrics
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <div className="space-y-1">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={cn('h-12 animate-pulse', isLight ? 'bg-stone-100/70' : 'bg-white/[0.02]')}
            />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <div className="mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Cash Flow Metrics
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No metrics data</p>
      </div>
    )
  }

  const metrics: Array<{
    label: string
    value: string
    isPositive: boolean
    isWarning?: boolean
    isCritical?: boolean
    icon: any
    color: string
    subLabel?: string
    calculationTooltip?: CalculationTooltip
    description?: string
  }> = [
    {
      label: 'Operating Cash Flow',
      value: formatCompactCurrency(data.operatingCashFlow, currency),
      isPositive: data.operatingCashFlow >= 0,
      icon: data.operatingCashFlow >= 0 ? TrendingUp : TrendingDown,
      color: data.operatingCashFlow >= 0 ? 'green' : 'red',
      description:
        'Cash generated from core business operations, excluding investing and financing activities.',
      calculationTooltip: {
        formula: 'Net Income + Non-Cash Adjustments + Working Capital Changes',
        components: [
          ...(breakdown?.netIncome != null
            ? [{ label: 'Net Income', value: formatCompactCurrency(breakdown.netIncome, currency) }]
            : []),
          ...(breakdown?.depreciation
            ? [
                {
                  label: 'Depreciation',
                  value: formatCompactCurrency(breakdown.depreciation, currency),
                },
              ]
            : []),
          ...(breakdown?.arChange != null
            ? [{ label: 'AR Change', value: formatCompactCurrency(breakdown.arChange, currency) }]
            : []),
          ...(breakdown?.inventoryChange != null
            ? [
                {
                  label: 'Inventory Change',
                  value: formatCompactCurrency(breakdown.inventoryChange, currency),
                },
              ]
            : []),
          ...(breakdown?.apChange != null
            ? [{ label: 'AP Change', value: formatCompactCurrency(breakdown.apChange, currency) }]
            : []),
          ...(breakdown?.otherWCChanges
            ? [
                {
                  label: 'Other WC Changes',
                  value: formatCompactCurrency(breakdown.otherWCChanges, currency),
                },
              ]
            : []),
          {
            label: '= Operating Cash Flow',
            value: formatCompactCurrency(data.operatingCashFlow, currency),
            highlight: true,
          },
        ],
      },
    },
    {
      label: 'Free Cash Flow',
      value: formatCompactCurrency(data.freeCashFlow, currency),
      isPositive: data.freeCashFlow >= 0,
      icon: data.freeCashFlow >= 0 ? TrendingUp : TrendingDown,
      color: data.freeCashFlow >= 0 ? 'green' : 'red',
      description:
        'Cash available after operating expenses and capital expenditures. Positive FCF means excess cash for growth or debt reduction.',
      calculationTooltip: {
        formula: 'Operating Cash Flow - Capital Expenditures',
        components: [
          {
            label: 'Operating CF',
            value: formatCompactCurrency(data.operatingCashFlow, currency),
          },
          {
            label: 'Capital Expenditures',
            value: breakdown?.capitalExpenditures
              ? formatCompactCurrency(breakdown.capitalExpenditures, currency)
              : '$0',
          },
          {
            label: '= Free Cash Flow',
            value: formatCompactCurrency(data.freeCashFlow, currency),
            highlight: true,
          },
        ],
      },
    },
    {
      label: 'Cash Runway',
      value:
        data.cashRunway !== null
          ? `${data.cashRunway.toFixed(1)} mo`
          : data.burnRate <= 0
            ? `∞`
            : '0.0 mo',
      subLabel:
        data.cashRunway === null && data.burnRate > 0 && (breakdown?.cashBalance ?? 0) <= 0
          ? `Cash balance is negative (${formatCompactCurrency(breakdown?.cashBalance ?? 0, currency)}). No runway left — immediate funding required.`
          : data.cashRunway === null && data.burnRate <= 0
            ? `No burn — generating ${formatCompactCurrency(Math.abs(data.freeCashFlow / (breakdown?.monthCount || 12)), currency)}/mo net cash`
            : data.cashRunway !== null && data.cashRunway === 0
              ? `No runway left — cash balance (${formatCompactCurrency(breakdown?.cashBalance ?? 0, currency)}) cannot cover burn rate of ${formatCompactCurrency(data.burnRate, currency)}/mo.`
              : data.cashRunway !== null && data.cashRunway <= 3
                ? `Only ${data.cashRunway.toFixed(1)} months of cash remaining at current burn rate.`
                : undefined,
      isPositive: data.cashRunway === null ? data.burnRate <= 0 : data.cashRunway > 6,
      isWarning: data.cashRunway !== null && data.cashRunway <= 6 && data.cashRunway > 3,
      isCritical: data.cashRunway !== null ? data.cashRunway <= 3 : data.burnRate > 0,
      icon:
        data.cashRunway === null
          ? data.burnRate <= 0
            ? Infinity
            : TrendingDown
          : data.cashRunway > 6
            ? TrendingUp
            : TrendingDown,
      color:
        data.cashRunway === null
          ? data.burnRate <= 0
            ? 'green'
            : 'red'
          : data.cashRunway > 6
            ? 'green'
            : data.cashRunway <= 3
              ? 'red'
              : 'amber',
      description:
        data.cashRunway === null && data.burnRate > 0 && (breakdown?.cashBalance ?? 0) <= 0
          ? 'Cash balance is already negative. The company has exhausted its cash reserves and requires immediate capital injection or cost reduction.'
          : 'Months until cash runs out at the current net burn rate.',
      calculationTooltip:
        data.burnRate > 0
          ? {
              formula: 'Cash Balance ÷ Monthly Burn Rate',
              components: [
                {
                  label: 'Cash Balance',
                  value: formatCompactCurrency(breakdown?.cashBalance ?? 0, currency),
                },
                {
                  label: '÷ Burn Rate',
                  value: `${formatCompactCurrency(data.burnRate, currency)}/mo`,
                },
                {
                  label: '= Runway',
                  value:
                    data.cashRunway !== null
                      ? `${data.cashRunway.toFixed(1)} months`
                      : (breakdown?.cashBalance ?? 0) <= 0
                        ? 'Cash depleted'
                        : '—',
                  highlight: true,
                },
              ],
            }
          : undefined,
    },
    {
      label: 'Monthly Burn Rate',
      value: formatCompactCurrency(data.burnRate, currency),
      isPositive: data.burnRate <= 0,
      subLabel: data.burnRate > 0 ? '/mo consumed' : '/mo — no burn',
      icon: data.burnRate > 0 ? TrendingDown : TrendingUp,
      color: data.burnRate > 0 ? 'amber' : 'green',
      description:
        data.burnRate > 0
          ? 'Monthly cash consumed based on Free Cash Flow (OCF minus CapEx). Higher burn = shorter runway.'
          : 'Free Cash Flow is positive — the company generates more cash than it spends.',
      calculationTooltip: {
        formula: '|Monthly FCF| when negative, else $0',
        components: [
          {
            label: 'Operating Cash Flow',
            value: formatCompactCurrency(data.operatingCashFlow, currency),
          },
          ...(breakdown?.capitalExpenditures != null
            ? [
                {
                  label: '- Capital Expenditures',
                  value: formatCompactCurrency(Math.abs(breakdown.capitalExpenditures), currency),
                },
              ]
            : []),
          {
            label: '= Free Cash Flow',
            value: formatCompactCurrency(data.freeCashFlow, currency),
          },
          ...(breakdown?.monthCount
            ? [{ label: '\u00f7 Months', value: `${breakdown.monthCount}` }]
            : []),
          {
            label: '= Burn Rate',
            value:
              data.burnRate > 0
                ? `${formatCompactCurrency(data.burnRate, currency)}/mo`
                : 'No burn (FCF positive)',
            highlight: true,
          },
        ],
      },
    },
  ]

  const getColorClasses = (color: string, isIcon = false) => {
    const colors: Record<string, { icon: string; text: string; bg: string }> = {
      green: {
        icon: isLight ? 'text-green-600' : 'text-green-400',
        text: isLight ? 'text-green-600' : 'text-green-400',
        bg: isLight ? 'bg-green-100' : 'bg-green-500/10',
      },
      red: {
        icon: isLight ? 'text-red-600' : 'text-red-400',
        text: isLight ? 'text-red-600' : 'text-red-400',
        bg: isLight ? 'bg-red-100' : 'bg-red-500/10',
      },
      amber: {
        icon: isLight ? 'text-amber-600' : 'text-amber-400',
        text: isLight ? 'text-amber-600' : 'text-amber-400',
        bg: isLight ? 'bg-amber-100' : 'bg-amber-500/10',
      },
    }
    return colors[color] || colors.green
  }

  return (
    <div>
      {/* Header with icon */}
      <div className="mb-5">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Cash Flow Metrics
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps && <InfoTooltip {...tooltipProps} />}
        </div>
      </div>

      {/* Metrics list */}
      <div className="space-y-1">
        {metrics.map((metric, i) => {
          const colorClasses = getColorClasses(metric.color)
          const hasAlert = metric.isCritical && metric.subLabel && metric.subLabel.length > 20
          return (
            <div key={metric.label}>
              <div
                className={cn(
                  'flex items-center justify-between py-2.5 px-2 -mx-2 text-xs transition-colors',
                  i % 2 === 0 ? styles.rowEven : '',
                  styles.rowHover
                )}
              >
                <div className="flex items-center gap-3">
                  <metric.icon className={cn('w-3.5 h-3.5', colorClasses.icon)} />
                  <span className={cn('font-medium text-[13px]', styles.text)}>{metric.label}</span>
                  {metric.calculationTooltip && (
                    <InfoTooltip
                      calculationTooltip={metric.calculationTooltip}
                      description={metric.description}
                    />
                  )}
                </div>
                <div className="text-right">
                  <span
                    className={cn(
                      'text-base font-mono font-bold tabular-nums tracking-tight',
                      colorClasses.text
                    )}
                  >
                    {metric.value}
                  </span>
                  {metric.subLabel && !hasAlert && (
                    <span className={cn('text-[10px] ml-1', styles.textMuted)}>
                      {metric.subLabel}
                    </span>
                  )}
                </div>
              </div>
              {hasAlert && (
                <div
                  className={cn(
                    'mx-2 -mt-1 mb-1 px-3 py-2 rounded-md text-[11px] font-medium',
                    isLight
                      ? 'bg-red-50 text-red-700 border border-red-200/60'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  )}
                >
                  {metric.subLabel}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
