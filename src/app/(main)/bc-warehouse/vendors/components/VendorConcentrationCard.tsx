'use client'

import { useMemo } from 'react'
import { PieChart, AlertTriangle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface VendorConcentration {
  no: string
  name: string
  purchases_lcy: number
  percentage: number
}

interface VendorConcentrationCardProps {
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

function SkeletonLoader({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'rounded-xl p-3 animate-pulse',
              isLight ? 'bg-stone-100/50' : 'bg-white/[0.02]'
            )}
          >
            <div
              className={cn('h-2 w-12 rounded mb-2', isLight ? 'bg-stone-200' : 'bg-white/10')}
            />
            <div className={cn('h-5 w-10 rounded', isLight ? 'bg-stone-200' : 'bg-white/10')} />
          </div>
        ))}
      </div>
      <div
        className={cn(
          'h-3 rounded-full animate-pulse',
          isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
        )}
      />
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-6 rounded-lg animate-pulse',
            isLight ? 'bg-stone-100/50' : 'bg-white/[0.02]'
          )}
        />
      ))}
    </div>
  )
}

const barColors = [
  'bg-violet-500',
  'bg-indigo-500',
  'bg-blue-500',
  'bg-cyan-500',
  'bg-teal-500',
  'bg-emerald-500',
  'bg-lime-500',
  'bg-amber-500',
  'bg-orange-500',
  'bg-rose-500',
]

export function VendorConcentrationCard({
  data,
  metrics,
  isLoading,
  currency = 'USD',
}: VendorConcentrationCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const riskConfig = {
    low: {
      icon: CheckCircle,
      light: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
      dark: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      label: 'Low Risk',
    },
    medium: {
      icon: AlertTriangle,
      light: 'bg-amber-50 text-amber-700 border-amber-200/60',
      dark: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      label: 'Medium Risk',
    },
    high: {
      icon: AlertTriangle,
      light: 'bg-red-50 text-red-700 border-red-200/60',
      dark: 'bg-red-500/10 text-red-400 border-red-500/20',
      label: 'High Risk',
    },
  }

  const riskLevel = metrics?.concentrationRisk || 'low'
  const {
    icon: RiskIcon,
    light: riskLight,
    dark: riskDark,
    label: riskLabel,
  } = riskConfig[riskLevel]

  const topVendorPct = metrics?.topVendorPercentage ?? 0
  const top5Pct = metrics?.top5Percentage ?? 0
  const top10Pct = metrics?.top10Percentage ?? 0

  const styles = useMemo(
    () => ({
      card: isLight
        ? 'bg-white/90 border-stone-200/60 shadow-sm'
        : 'bg-white/[0.02] border-white/[0.06]',
      headerIcon: isLight
        ? 'bg-gradient-to-br from-violet-50 to-purple-50 text-violet-500 border border-violet-100'
        : 'bg-gradient-to-br from-violet-500/15 to-purple-500/10 text-violet-400 border border-violet-500/20',
      statBox: isLight
        ? 'bg-gradient-to-br from-stone-50 to-stone-100/50 border-stone-200/60'
        : 'bg-white/[0.03] border-white/[0.06]',
      barBg: isLight ? 'bg-stone-100' : 'bg-white/[0.06]',
    }),
    [isLight]
  )

  return (
    <div
      className={cn(
        'rounded-2xl border p-5 transition-all duration-300 flex flex-col h-full',
        styles.card
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn('w-9 h-9 rounded-xl flex items-center justify-center', styles.headerIcon)}
          >
            <PieChart className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className={cn('text-sm font-semibold', isLight ? 'text-stone-900' : 'text-white')}>
              Vendor Concentration
            </h3>
            <p className={cn('text-[11px]', isLight ? 'text-stone-500' : 'text-stone-500')}>
              Spend distribution risk
            </p>
          </div>
        </div>
        {!isLoading && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border',
              isLight ? riskLight : riskDark
            )}
          >
            <RiskIcon className="w-3 h-3" />
            {riskLabel}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <SkeletonLoader isLight={isLight} />
        ) : data.length > 0 ? (
          <div className="space-y-4">
            {/* Concentration Metrics */}
            <div className="grid grid-cols-3 gap-2">
              <div
                className={cn('rounded-xl p-2.5 border text-center transition-all', styles.statBox)}
              >
                <div
                  className={cn(
                    'text-[10px] uppercase tracking-wider font-medium mb-0.5',
                    isLight ? 'text-stone-500' : 'text-stone-500'
                  )}
                >
                  Top 1
                </div>
                <div
                  className={cn(
                    'text-base font-bold tabular-nums',
                    topVendorPct > 25
                      ? isLight
                        ? 'text-red-600'
                        : 'text-red-400'
                      : isLight
                        ? 'text-violet-600'
                        : 'text-violet-400'
                  )}
                >
                  {topVendorPct.toFixed(1)}%
                </div>
              </div>
              <div
                className={cn('rounded-xl p-2.5 border text-center transition-all', styles.statBox)}
              >
                <div
                  className={cn(
                    'text-[10px] uppercase tracking-wider font-medium mb-0.5',
                    isLight ? 'text-stone-500' : 'text-stone-500'
                  )}
                >
                  Top 5
                </div>
                <div
                  className={cn(
                    'text-base font-bold tabular-nums',
                    top5Pct > 50
                      ? isLight
                        ? 'text-red-600'
                        : 'text-red-400'
                      : isLight
                        ? 'text-indigo-600'
                        : 'text-indigo-400'
                  )}
                >
                  {top5Pct.toFixed(1)}%
                </div>
              </div>
              <div
                className={cn('rounded-xl p-2.5 border text-center transition-all', styles.statBox)}
              >
                <div
                  className={cn(
                    'text-[10px] uppercase tracking-wider font-medium mb-0.5',
                    isLight ? 'text-stone-500' : 'text-stone-500'
                  )}
                >
                  Top 10
                </div>
                <div
                  className={cn(
                    'text-base font-bold tabular-nums',
                    isLight ? 'text-blue-600' : 'text-blue-400'
                  )}
                >
                  {top10Pct.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Stacked Bar Visualization */}
            <div>
              <div
                className={cn(
                  'text-[10px] uppercase tracking-wider font-semibold mb-2 px-1',
                  isLight ? 'text-stone-500' : 'text-stone-500'
                )}
              >
                Spend Distribution
              </div>
              <div className={cn('w-full h-2.5 rounded-full overflow-hidden flex', styles.barBg)}>
                {data.slice(0, 10).map((vendor, i) => (
                  <div
                    key={vendor.no}
                    className={cn('h-full transition-all duration-500', barColors[i])}
                    style={{ width: `${vendor.percentage}%` }}
                    title={`${vendor.name}: ${vendor.percentage.toFixed(1)}%`}
                  />
                ))}
                {top10Pct < 100 && (
                  <div
                    className={cn('h-full', isLight ? 'bg-stone-200' : 'bg-white/10')}
                    style={{ width: `${100 - top10Pct}%` }}
                    title={`Others: ${(100 - top10Pct).toFixed(1)}%`}
                  />
                )}
              </div>
            </div>

            {/* Top Vendors List */}
            <div className="space-y-1">
              <div
                className={cn(
                  'text-[10px] uppercase tracking-wider font-semibold px-1',
                  isLight ? 'text-stone-500' : 'text-stone-500'
                )}
              >
                Top Vendors
              </div>
              {data.slice(0, 5).map((vendor, i) => (
                <div
                  key={vendor.no}
                  className="flex items-center justify-between gap-2 py-1.5 px-1"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0', barColors[i])} />
                    <span
                      className={cn(
                        'text-xs truncate font-medium',
                        isLight ? 'text-stone-700' : 'text-stone-300'
                      )}
                      title={vendor.name}
                    >
                      {vendor.name.length > 20 ? vendor.name.substring(0, 20) + '...' : vendor.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'text-[11px] tabular-nums',
                        isLight ? 'text-stone-500' : 'text-stone-500'
                      )}
                    >
                      {vendor.percentage.toFixed(1)}%
                    </span>
                    <span
                      className={cn(
                        'text-xs font-mono font-semibold tabular-nums',
                        isLight ? 'text-stone-800' : 'text-stone-200'
                      )}
                    >
                      {formatCompactCurrency(vendor.purchases_lcy, currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-40">
            <p className={cn('text-sm', isLight ? 'text-stone-500' : 'text-stone-400')}>
              No vendor data available
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
