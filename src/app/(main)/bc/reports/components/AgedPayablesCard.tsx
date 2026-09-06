'use client'

import { useMemo } from 'react'
import { AlertCircle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from '@/components/ui/InfoTooltip'
import type { AgedPayablesSummary } from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'

interface AgedPayablesCardProps {
  summary: AgedPayablesSummary | null
  isLoading: boolean
  currency?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

export function AgedPayablesCard({
  summary,
  isLoading,
  currency = 'USD',
  tooltipProps,
}: AgedPayablesCardProps) {
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

  // Calculate aging bucket percentages for the stacked bar
  // Always 4 buckets: Current, 1-30, 31-60, 61+
  // 61+ is computed as residual (total - current - p1 - p2) to guarantee it balances,
  // since days_61_90/days_over_90 come from a separate shifted API call.
  const over61 = summary
    ? summary.total - summary.current - summary.days_1_30 - summary.days_31_60
    : 0
  const buckets = useMemo(() => {
    if (!summary || summary.total === 0) return []
    return [
      {
        label: 'Current',
        value: summary.current,
        color: '#10b981',
        percent: (summary.current / summary.total) * 100,
      },
      {
        label: '1-30',
        value: summary.days_1_30,
        color: '#f59e0b',
        percent: (summary.days_1_30 / summary.total) * 100,
      },
      {
        label: '31-60',
        value: summary.days_31_60,
        color: '#f97316',
        percent: (summary.days_31_60 / summary.total) * 100,
      },
      {
        label: '61+',
        value: over61,
        color: '#dc2626',
        percent: (over61 / summary.total) * 100,
      },
    ].filter((b) => b.value > 0)
  }, [summary, over61])

  // Overdue = everything past current (residual from total)
  const overdueAmount = summary ? summary.total - summary.current : 0
  const overduePercent = summary && summary.total > 0 ? (overdueAmount / summary.total) * 100 : 0

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
              Aged Payables
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        <div
          className={cn('h-3 w-full animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
        />
        <div className="grid grid-cols-5 gap-1 mt-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={cn('h-10 animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
            />
          ))}
        </div>
      </div>
    )
  }

  if (!summary) {
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
              Aged Payables
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No payables data</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Aged Payables
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps && <InfoTooltip {...tooltipProps} />}
        </div>
        <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
      </div>

      <span className="text-[28px] font-mono font-semibold tabular-nums block mb-4 text-red-500">
        {formatCompactCurrency(summary.total, currency)}
      </span>

      {/* Stacked aging bar */}
      <div
        className="w-full h-3 overflow-hidden flex gap-[2px]"
        style={{
          backgroundColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
        }}
      >
        {buckets.map((bucket) => (
          <div
            key={bucket.label}
            className="h-full transition-all duration-500"
            style={{
              width: `${bucket.percent}%`,
              backgroundColor: bucket.color,
            }}
            title={`${bucket.label}: ${formatCompactCurrency(bucket.value, currency)} (${bucket.percent.toFixed(1)}%)`}
          />
        ))}
      </div>

      {/* Bucket breakdown - table style */}
      <div className="mt-3">
        {[
          { label: 'Current', value: summary.current, color: '#10b981' },
          { label: '1-30 days', value: summary.days_1_30, color: '#f59e0b' },
          { label: '31-60 days', value: summary.days_31_60, color: '#f97316' },
          { label: '61+ days', value: over61, color: '#dc2626' },
        ].map((bucket, i) => (
          <div
            key={bucket.label}
            className={cn(
              'flex items-center justify-between py-2.5 px-2 -mx-2 text-sm',
              i % 2 === 0 && (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]')
            )}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2" style={{ backgroundColor: bucket.color }} />
              <span className={isLight ? 'text-stone-700' : 'text-stone-300'}>{bucket.label}</span>
            </div>
            <span className={cn('font-mono font-medium tabular-nums', styles.text)}>
              {formatCompactCurrency(bucket.value, currency)}
            </span>
          </div>
        ))}
      </div>

      {/* Overdue warning */}
      {overdueAmount > 0 && (
        <div
          className={cn(
            'flex items-center justify-between py-2.5 px-2 -mx-2 mt-2 border-t',
            styles.border
          )}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-[14px] font-medium text-red-500">Overdue</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-mono font-bold tabular-nums text-red-500">
              {formatCompactCurrency(overdueAmount, currency)}
            </span>
            <span className={cn('text-[10px] font-mono', styles.textMuted)}>
              ({overduePercent.toFixed(0)}%)
            </span>
          </div>
        </div>
      )}

      {/* Vendor count */}
      <div className={cn('text-xs pt-2 mt-2 border-t', styles.border, styles.textMuted)}>
        {summary.vendor_count} vendors with outstanding balances
      </div>
    </div>
  )
}
