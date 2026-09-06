'use client'

import { useMemo, useState } from 'react'
import { ShieldAlert, ShieldCheck, Shield, AlertOctagon, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { VendorPaymentRiskRow } from '../hooks/useVendorInsights'

interface VendorRiskHeatmapProps {
  data: VendorPaymentRiskRow[]
  isLoading: boolean
  currency?: string
}

const riskConfig = {
  critical: {
    icon: AlertOctagon,
    gradient: 'from-red-500 to-rose-600',
    bg: { light: 'bg-red-50', dark: 'bg-red-500/10' },
    border: { light: 'border-red-200', dark: 'border-red-500/20' },
    text: { light: 'text-red-700', dark: 'text-red-400' },
    label: 'Critical',
  },
  high: {
    icon: ShieldAlert,
    gradient: 'from-orange-500 to-amber-600',
    bg: { light: 'bg-orange-50', dark: 'bg-orange-500/10' },
    border: { light: 'border-orange-200', dark: 'border-orange-500/20' },
    text: { light: 'text-orange-700', dark: 'text-orange-400' },
    label: 'High',
  },
  medium: {
    icon: Shield,
    gradient: 'from-amber-500 to-yellow-600',
    bg: { light: 'bg-amber-50', dark: 'bg-amber-500/10' },
    border: { light: 'border-amber-200', dark: 'border-amber-500/20' },
    text: { light: 'text-amber-700', dark: 'text-amber-400' },
    label: 'Medium',
  },
  low: {
    icon: ShieldCheck,
    gradient: 'from-emerald-500 to-green-600',
    bg: { light: 'bg-emerald-50', dark: 'bg-emerald-500/10' },
    border: { light: 'border-emerald-200', dark: 'border-emerald-500/20' },
    text: { light: 'text-emerald-700', dark: 'text-emerald-400' },
    label: 'Low',
  },
}

function HeatmapCell({
  vendor,
  maxBalance,
  isLight,
  currency,
  onClick,
  isSelected,
}: {
  vendor: VendorPaymentRiskRow
  maxBalance: number
  isLight: boolean
  currency: string
  onClick: () => void
  isSelected: boolean
}) {
  const config = riskConfig[vendor.risk_score]
  const intensity = Math.min(1, vendor.balance_lcy / maxBalance)

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative w-full aspect-square rounded-xl transition-all duration-300 overflow-hidden',
        'hover:scale-105 hover:z-10 cursor-pointer',
        isSelected ? 'ring-2 ring-offset-2' : '',
        isLight
          ? `${config.bg.light} ${config.border.light} border ring-offset-white`
          : `${config.bg.dark} ${config.border.dark} border ring-offset-stone-900`,
        isSelected && (isLight ? 'ring-stone-400' : 'ring-white/40')
      )}
      style={{
        opacity: 0.4 + intensity * 0.6,
      }}
      title={`${vendor.name}: ${formatCompactCurrency(vendor.balance_lcy, currency)}`}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <config.icon
          className={cn(
            'w-5 h-5 transition-transform group-hover:scale-110',
            isLight ? config.text.light : config.text.dark
          )}
        />
      </div>

      {/* Hover tooltip */}
      <div
        className={cn(
          'absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none',
          'bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap z-20',
          isLight ? 'bg-stone-900 text-white' : 'bg-white text-stone-900'
        )}
      >
        <div className="font-semibold">
          {vendor.name.substring(0, 18)}
          {vendor.name.length > 18 ? '...' : ''}
        </div>
        <div className="text-[10px] opacity-80">
          {formatCompactCurrency(vendor.balance_lcy, currency)} | {vendor.overdue_ratio.toFixed(0)}%
          overdue
        </div>
      </div>
    </button>
  )
}

function RiskSummaryBar({ data, isLight }: { data: VendorPaymentRiskRow[]; isLight: boolean }) {
  const counts = useMemo(
    () => ({
      critical: data.filter((v) => v.risk_score === 'critical').length,
      high: data.filter((v) => v.risk_score === 'high').length,
      medium: data.filter((v) => v.risk_score === 'medium').length,
      low: data.filter((v) => v.risk_score === 'low').length,
    }),
    [data]
  )

  const total = data.length

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'h-3 rounded-full overflow-hidden flex',
          isLight ? 'bg-stone-100' : 'bg-white/[0.04]'
        )}
      >
        {(['critical', 'high', 'medium', 'low'] as const).map((level) => {
          const width = total > 0 ? (counts[level] / total) * 100 : 0
          if (width === 0) return null
          return (
            <div
              key={level}
              className={cn(
                'h-full transition-all duration-500',
                `bg-gradient-to-r ${riskConfig[level].gradient}`
              )}
              style={{ width: `${width}%` }}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[10px]">
        {(['critical', 'high', 'medium', 'low'] as const).map((level) => (
          <div key={level} className="flex items-center gap-1">
            <div
              className={cn('w-2 h-2 rounded-sm', `bg-gradient-to-r ${riskConfig[level].gradient}`)}
            />
            <span className={cn(isLight ? 'text-stone-500' : 'text-stone-400')}>
              {riskConfig[level].label}: {counts[level]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VendorDetailPanel({
  vendor,
  isLight,
  currency,
  onClose,
}: {
  vendor: VendorPaymentRiskRow | null
  isLight: boolean
  currency: string
  onClose: () => void
}) {
  if (!vendor) return null

  const config = riskConfig[vendor.risk_score]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 space-y-4 transition-all duration-300',
        isLight ? 'bg-white border-stone-200 shadow-lg' : 'bg-white/[0.04] border-white/[0.08]'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              `bg-gradient-to-br ${config.gradient}`
            )}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className={cn('font-semibold', isLight ? 'text-stone-900' : 'text-white')}>
              {vendor.name}
            </h4>
            <span className={cn('text-xs', isLight ? 'text-stone-500' : 'text-stone-400')}>
              #{vendor.no}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className={cn(
            'p-1 rounded-lg transition-colors',
            isLight ? 'hover:bg-stone-100 text-stone-400' : 'hover:bg-white/10 text-stone-500'
          )}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={cn('rounded-xl p-3', isLight ? 'bg-stone-50' : 'bg-white/[0.03]')}>
          <span
            className={cn(
              'text-[10px] uppercase tracking-wider font-medium block',
              isLight ? 'text-stone-500' : 'text-stone-500'
            )}
          >
            Balance
          </span>
          <span
            className={cn(
              'text-lg font-bold tabular-nums',
              isLight ? 'text-stone-900' : 'text-white'
            )}
          >
            {formatCompactCurrency(vendor.balance_lcy, currency)}
          </span>
        </div>
        <div className={cn('rounded-xl p-3', isLight ? 'bg-stone-50' : 'bg-white/[0.03]')}>
          <span
            className={cn(
              'text-[10px] uppercase tracking-wider font-medium block',
              isLight ? 'text-stone-500' : 'text-stone-500'
            )}
          >
            Overdue
          </span>
          <span
            className={cn(
              'text-lg font-bold tabular-nums',
              vendor.balance_due_lcy > 0
                ? isLight
                  ? 'text-red-600'
                  : 'text-red-400'
                : isLight
                  ? 'text-stone-900'
                  : 'text-white'
            )}
          >
            {formatCompactCurrency(vendor.balance_due_lcy, currency)}
          </span>
        </div>
        <div className={cn('rounded-xl p-3', isLight ? 'bg-stone-50' : 'bg-white/[0.03]')}>
          <span
            className={cn(
              'text-[10px] uppercase tracking-wider font-medium block',
              isLight ? 'text-stone-500' : 'text-stone-500'
            )}
          >
            Purchases
          </span>
          <span
            className={cn(
              'text-lg font-bold tabular-nums',
              isLight ? 'text-stone-900' : 'text-white'
            )}
          >
            {formatCompactCurrency(vendor.purchases_lcy, currency)}
          </span>
        </div>
        <div className={cn('rounded-xl p-3', isLight ? 'bg-stone-50' : 'bg-white/[0.03]')}>
          <span
            className={cn(
              'text-[10px] uppercase tracking-wider font-medium block',
              isLight ? 'text-stone-500' : 'text-stone-500'
            )}
          >
            Overdue Ratio
          </span>
          <span
            className={cn(
              'text-lg font-bold tabular-nums',
              vendor.overdue_ratio > 50
                ? isLight
                  ? 'text-red-600'
                  : 'text-red-400'
                : vendor.overdue_ratio > 25
                  ? isLight
                    ? 'text-amber-600'
                    : 'text-amber-400'
                  : isLight
                    ? 'text-emerald-600'
                    : 'text-emerald-400'
            )}
          >
            {vendor.overdue_ratio.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Overdue bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className={cn(isLight ? 'text-stone-500' : 'text-stone-400')}>Overdue Ratio</span>
          <span className={cn(isLight ? 'text-stone-600' : 'text-stone-300')}>
            {vendor.overdue_ratio.toFixed(1)}%
          </span>
        </div>
        <div
          className={cn(
            'h-2 rounded-full overflow-hidden',
            isLight ? 'bg-stone-100' : 'bg-white/[0.06]'
          )}
        >
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              vendor.overdue_ratio > 50
                ? 'bg-red-500'
                : vendor.overdue_ratio > 25
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            )}
            style={{ width: `${Math.min(vendor.overdue_ratio, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function SkeletonLoader({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-4">
      <div
        className={cn(
          'h-3 rounded-full animate-pulse',
          isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
        )}
      />
      <div className="grid grid-cols-6 gap-2">
        {[...Array(18)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'aspect-square rounded-xl animate-pulse',
              isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
            )}
          />
        ))}
      </div>
    </div>
  )
}

export function VendorRiskHeatmap({ data, isLoading, currency = 'USD' }: VendorRiskHeatmapProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [selectedVendor, setSelectedVendor] = useState<VendorPaymentRiskRow | null>(null)

  const maxBalance = useMemo(() => Math.max(...data.map((v) => v.balance_lcy), 1), [data])

  // Sort by risk score and balance
  const sortedData = useMemo(() => {
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return [...data].sort((a, b) => {
      const riskDiff = riskOrder[a.risk_score] - riskOrder[b.risk_score]
      if (riskDiff !== 0) return riskDiff
      return b.balance_lcy - a.balance_lcy
    })
  }, [data])

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
            Vendor Risk Heatmap
          </h3>
          <p className={cn('text-xs', isLight ? 'text-stone-500' : 'text-stone-400')}>
            Payment risk distribution by vendor
          </p>
        </div>
        <div
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium',
            isLight ? 'bg-stone-100 text-stone-600' : 'bg-white/[0.06] text-stone-400'
          )}
        >
          {data.length} vendors
        </div>
      </div>

      {isLoading ? (
        <SkeletonLoader isLight={isLight} />
      ) : data.length > 0 ? (
        <div className="flex gap-5">
          {/* Heatmap Grid */}
          <div className="flex-1 space-y-4">
            <RiskSummaryBar data={data} isLight={isLight} />

            <div className="grid grid-cols-6 gap-2">
              {sortedData.slice(0, 18).map((vendor) => (
                <HeatmapCell
                  key={vendor.no}
                  vendor={vendor}
                  maxBalance={maxBalance}
                  isLight={isLight}
                  currency={currency}
                  onClick={() =>
                    setSelectedVendor(selectedVendor?.no === vendor.no ? null : vendor)
                  }
                  isSelected={selectedVendor?.no === vendor.no}
                />
              ))}
            </div>

            {sortedData.length > 18 && (
              <div
                className={cn(
                  'text-center text-xs py-2',
                  isLight ? 'text-stone-500' : 'text-stone-400'
                )}
              >
                +{sortedData.length - 18} more vendors
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {selectedVendor && (
            <div className="w-72 flex-shrink-0">
              <VendorDetailPanel
                vendor={selectedVendor}
                isLight={isLight}
                currency={currency}
                onClose={() => setSelectedVendor(null)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64">
          <p className={cn('text-sm', isLight ? 'text-stone-500' : 'text-stone-400')}>
            No risk data available
          </p>
        </div>
      )}
    </div>
  )
}
