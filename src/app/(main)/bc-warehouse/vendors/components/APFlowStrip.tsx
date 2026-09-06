'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { OutstandingPayablesSummary } from '../hooks/useVendorInsights'

interface APFlowStripProps {
  data: OutstandingPayablesSummary | null
  isLoading: boolean
  currency?: string
}

function Skeleton({ isLight }: { isLight: boolean }) {
  return <div className={cn('h-20 animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')} />
}

export function APFlowStrip({ data, isLoading, currency = 'USD' }: APFlowStripProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      barBg: isLight ? 'bg-stone-100' : 'bg-white/[0.04]',
    }),
    [isLight]
  )

  if (isLoading) return <Skeleton isLight={isLight} />

  if (!data) {
    return <div className={cn('py-6 text-center text-sm', styles.textMuted)}>No payables data</div>
  }

  const currentAP = Math.max(0, data.total_outstanding_ap - data.total_overdue_ap)
  const total = data.total_outstanding_ap
  const currentWidth = total > 0 ? (currentAP / total) * 100 : 0
  const overdueWidth = total > 0 ? (data.total_overdue_ap / total) * 100 : 0

  const stages = [
    {
      label: 'Current',
      value: currentAP,
      width: currentWidth,
      count: data.vendors_with_balance,
      color: 'bg-emerald-500',
    },
    {
      label: 'Overdue',
      value: data.total_overdue_ap,
      width: overdueWidth,
      count: data.vendors_with_overdue,
      color: 'bg-red-500',
    },
  ]

  return (
    <div>
      {/* Flow bar */}
      <div className={cn('h-8 flex overflow-hidden mb-3', styles.barBg)}>
        {stages.map((stage, i) => {
          if (stage.width < 0.5) return null
          return (
            <div
              key={stage.label}
              className={cn(stage.color, 'h-full flex items-center justify-center transition-all')}
              style={{ width: `${stage.width}%` }}
            >
              {stage.width > 15 && (
                <span className="text-[10px] font-mono text-white/90">
                  {formatCompactCurrency(stage.value, currency)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Stage details - matching inventory styling */}
      <div>
        {stages.map((stage, i) => (
          <div
            key={stage.label}
            className={cn(
              'flex items-center gap-2 py-2.5 px-2 -mx-2 text-xs transition-colors',
              i % 2 === 0 ? (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]') : '',
              isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]'
            )}
          >
            <div className={cn('w-2.5 h-2.5', stage.color)} />
            <span className={cn('font-medium', styles.text)}>{stage.label}</span>
            <span className={cn('text-[10px] font-mono', styles.textMuted)}>
              {stage.count} vendors
            </span>
            <span
              className={cn(
                'ml-auto text-base font-mono font-bold tabular-nums tracking-tight',
                stage.label === 'Current' ? 'text-emerald-500' : 'text-red-500'
              )}
            >
              {formatCompactCurrency(stage.value, currency)}
            </span>
          </div>
        ))}
      </div>

      {/* Total row */}
      <div className={cn('pt-3 mt-3 border-t flex justify-between', styles.border)}>
        <span
          className={cn('text-[9px] uppercase tracking-widest font-semibold', styles.textMuted)}
        >
          Total AP
        </span>
        <span
          className={cn('text-xl font-mono font-bold tabular-nums tracking-tight', styles.text)}
        >
          {formatCompactCurrency(total, currency)}
        </span>
      </div>
      <div className={cn('flex justify-between pt-1 text-xs')}>
        <span className={styles.textMuted}>Overdue Ratio</span>
        <span
          className={cn(
            'font-mono font-medium tabular-nums',
            overdueWidth > 30
              ? isLight
                ? 'text-red-600'
                : 'text-red-400'
              : overdueWidth > 15
                ? isLight
                  ? 'text-amber-600'
                  : 'text-amber-400'
                : styles.text
          )}
        >
          {overdueWidth.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}
