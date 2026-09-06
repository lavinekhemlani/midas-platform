'use client'

import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import {
  InfoTooltip,
  type InfoTooltipProps,
  type CalculationTooltip,
} from '@/components/ui/InfoTooltip'
import type { EfficiencyMetrics } from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'

interface EfficiencyMetricsCardProps {
  metrics: EfficiencyMetrics | null
  isLoading: boolean
  currency?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

function MetricRow({
  label,
  value,
  suffix,
  target,
  isGood,
  isLight,
  isEven,
  calculationTooltip,
  description,
}: {
  label: string
  value: number | null
  suffix: string
  target: string
  isGood?: boolean
  isLight: boolean
  isEven: boolean
  calculationTooltip?: CalculationTooltip
  description?: string
}) {
  const getValueColor = () => {
    if (value === null || isGood === undefined) return isLight ? 'text-stone-900' : 'text-white'
    return isGood
      ? isLight
        ? 'text-green-600'
        : 'text-green-400'
      : isLight
        ? 'text-red-600'
        : 'text-red-400'
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between py-2.5 px-2 -mx-2',
        isEven && (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]')
      )}
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-sm', isLight ? 'text-stone-900' : 'text-white')}>{label}</span>
          {calculationTooltip && (
            <InfoTooltip calculationTooltip={calculationTooltip} description={description} />
          )}
        </div>
        <span className={cn('text-xs', isLight ? 'text-stone-400' : 'text-stone-600')}>
          Target: {target}
        </span>
      </div>
      <span className={cn('text-base font-mono font-semibold tabular-nums', getValueColor())}>
        {value !== null ? `${value.toFixed(1)}${suffix}` : '—'}
      </span>
    </div>
  )
}

export function EfficiencyMetricsCard({
  metrics,
  isLoading,
  currency = 'USD',
  tooltipProps,
}: EfficiencyMetricsCardProps) {
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

  // Evaluate if metrics are good
  const isDsoGood = metrics?.dso != null ? metrics.dso <= 45 : undefined
  const isDpoGood = metrics?.dpo != null ? metrics.dpo >= 30 : undefined
  const isCccGood =
    metrics?.cashConversionCycle != null ? metrics.cashConversionCycle <= 30 : undefined
  const isInvTurnoverGood =
    metrics?.inventoryTurnover != null ? metrics.inventoryTurnover >= 4 : undefined

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Efficiency Metrics
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={cn('h-12 animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
          />
        ))}
      </div>
    )
  }

  if (!metrics) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Efficiency Metrics
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No efficiency data available</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Efficiency Metrics
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps && <InfoTooltip {...tooltipProps} />}
        </div>
        <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
      </div>

      <MetricRow
        label="Days Sales Outstanding"
        value={metrics.dso}
        suffix=" days"
        target="< 45 days"
        isGood={isDsoGood}
        isLight={isLight}
        isEven={true}
        description="Average days to collect payment after a sale. Lower is better — means faster cash collection."
        calculationTooltip={
          metrics._components
            ? {
                formula: '(Accounts Receivable \u00f7 Annualized Revenue) \u00d7 365',
                components: [
                  {
                    label: 'Accounts Receivable',
                    value: formatCompactCurrency(metrics._components.totalAR, currency),
                  },
                  {
                    label: '\u00f7 Annualized Revenue',
                    value: formatCompactCurrency(metrics._components.annualizedRevenue, currency),
                  },
                  { label: '\u00d7 365 days', value: '365' },
                  {
                    label: '= DSO',
                    value: metrics.dso !== null ? `${metrics.dso.toFixed(1)} days` : 'N/A',
                    highlight: true,
                  },
                ],
              }
            : undefined
        }
      />
      <MetricRow
        label="Days Payable Outstanding"
        value={metrics.dpo}
        suffix=" days"
        target="> 30 days"
        isGood={isDpoGood}
        isLight={isLight}
        isEven={false}
        description="Average days to pay suppliers. Higher means you hold cash longer, but too high may strain relationships."
        calculationTooltip={
          metrics._components
            ? {
                formula: '(Accounts Payable \u00f7 Annualized COGS) \u00d7 365',
                components: [
                  {
                    label: 'Accounts Payable',
                    value: formatCompactCurrency(metrics._components.totalAP, currency),
                  },
                  {
                    label: '\u00f7 Annualized COGS',
                    value: formatCompactCurrency(metrics._components.annualizedCOGS, currency),
                  },
                  { label: '\u00d7 365 days', value: '365' },
                  {
                    label: '= DPO',
                    value: metrics.dpo !== null ? `${metrics.dpo.toFixed(1)} days` : 'N/A',
                    highlight: true,
                  },
                ],
              }
            : undefined
        }
      />
      <MetricRow
        label="Cash Conversion Cycle"
        value={metrics.cashConversionCycle}
        suffix=" days"
        target="< 30 days"
        isGood={isCccGood}
        isLight={isLight}
        isEven={true}
        description="Days between paying suppliers and collecting from customers. Lower or negative means faster cash cycling."
        calculationTooltip={
          metrics.dso !== null && metrics.dpo !== null
            ? {
                formula: 'DSO + DIO - DPO',
                components: [
                  { label: 'DSO', value: `${metrics.dso!.toFixed(1)} days` },
                  ...(metrics._components &&
                  metrics._components.inventoryBalance > 0 &&
                  metrics._components.annualizedCOGS > 0
                    ? [
                        {
                          label: '+ DIO',
                          value: `${((metrics._components.inventoryBalance / metrics._components.annualizedCOGS) * 365).toFixed(1)} days`,
                        },
                      ]
                    : []),
                  { label: '- DPO', value: `${metrics.dpo!.toFixed(1)} days` },
                  {
                    label: '= CCC',
                    value:
                      metrics.cashConversionCycle !== null
                        ? `${metrics.cashConversionCycle.toFixed(1)} days`
                        : 'N/A',
                    highlight: true,
                  },
                ],
              }
            : undefined
        }
      />
      <MetricRow
        label="Inventory Turnover"
        value={metrics.inventoryTurnover}
        suffix="x"
        target="> 4x/year"
        isGood={isInvTurnoverGood}
        isLight={isLight}
        isEven={false}
        description="How many times inventory is sold and replaced per year. Higher means efficient stock management."
        calculationTooltip={
          metrics._components && metrics._components.inventoryBalance > 0
            ? {
                formula: 'Annualized COGS \u00f7 Inventory Balance',
                components: [
                  {
                    label: 'Annualized COGS',
                    value: formatCompactCurrency(metrics._components.annualizedCOGS, currency),
                  },
                  {
                    label: '\u00f7 Inventory Balance',
                    value: formatCompactCurrency(metrics._components.inventoryBalance, currency),
                  },
                  {
                    label: '= Turnover',
                    value:
                      metrics.inventoryTurnover !== null
                        ? `${metrics.inventoryTurnover.toFixed(1)}x`
                        : 'N/A',
                    highlight: true,
                  },
                ],
              }
            : undefined
        }
      />

      {/* Cash Flow Timeline */}
      {metrics.dso != null && metrics.dpo != null && (
        <div className={cn('mt-3 pt-3 border-t', styles.border)}>
          <div
            className={cn('text-sm font-normal uppercase tracking-wider mb-2', styles.textMuted)}
          >
            Cash Flow Cycle
          </div>
          <div className="flex items-center justify-between">
            <div className="text-center">
              <div
                className={cn(
                  'text-sm font-mono font-bold',
                  isLight ? 'text-green-600' : 'text-green-400'
                )}
              >
                {metrics.dso?.toFixed(0)}d
              </div>
              <div className={cn('text-xs', styles.textMuted)}>Collect</div>
            </div>
            <div className={cn('flex-1 h-px mx-3', isLight ? 'bg-stone-300' : 'bg-white/10')} />
            <div className="text-center">
              <div className={cn('text-sm font-mono font-bold', styles.text)}>
                {metrics.cashConversionCycle?.toFixed(0)}d
              </div>
              <div className={cn('text-xs', styles.textMuted)}>Convert</div>
            </div>
            <div className={cn('flex-1 h-px mx-3', isLight ? 'bg-stone-300' : 'bg-white/10')} />
            <div className="text-center">
              <div
                className={cn(
                  'text-sm font-mono font-bold',
                  isLight ? 'text-blue-600' : 'text-blue-400'
                )}
              >
                {metrics.dpo?.toFixed(0)}d
              </div>
              <div className={cn('text-xs', styles.textMuted)}>Pay</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
