'use client'

import { useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  DollarSign,
  Building2,
  Wallet,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { PaymentRiskSummary, VendorOverviewData } from '../hooks/useVendorInsights'

interface VendorHealthDashboardProps {
  overview: VendorOverviewData | null
  riskSummary: PaymentRiskSummary | null
  isLoading: boolean
  currency?: string
}

function CircularGauge({
  value,
  max = 100,
  color,
  size = 120,
  strokeWidth = 10,
  label,
  sublabel,
  isLight,
}: {
  value: number
  max?: number
  color: string
  size?: number
  strokeWidth?: number
  label: string
  sublabel?: string
  isLight: boolean
}) {
  const percentage = Math.min((value / max) * 100, 100)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isLight ? '#e5e7eb' : 'rgba(255,255,255,0.06)'}
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'text-2xl font-bold tabular-nums',
              isLight ? 'text-stone-900' : 'text-white'
            )}
          >
            {value.toFixed(0)}%
          </span>
        </div>
      </div>
      <span
        className={cn('text-xs font-semibold mt-2', isLight ? 'text-stone-700' : 'text-stone-300')}
      >
        {label}
      </span>
      {sublabel && (
        <span className={cn('text-[10px]', isLight ? 'text-stone-500' : 'text-stone-500')}>
          {sublabel}
        </span>
      )}
    </div>
  )
}

function MetricTile({
  icon: Icon,
  label,
  value,
  subvalue,
  trend,
  color,
  isLight,
}: {
  icon: React.ElementType
  label: string
  value: string
  subvalue?: string
  trend?: 'up' | 'down' | 'neutral'
  color: string
  isLight: boolean
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl p-4 transition-all duration-300',
        isLight
          ? 'bg-gradient-to-br from-white to-stone-50 border border-stone-200/60 shadow-sm hover:shadow-md'
          : 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] hover:border-white/[0.12]'
      )}
    >
      {/* Decorative gradient orb */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-20"
        style={{ background: color }}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              isLight ? 'bg-stone-100' : 'bg-white/[0.06]'
            )}
            style={{ color }}
          >
            <Icon className="w-5 h-5" />
          </div>
          {trend && (
            <div
              className={cn(
                'flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full',
                trend === 'up'
                  ? isLight
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-emerald-500/10 text-emerald-400'
                  : trend === 'down'
                    ? isLight
                      ? 'bg-red-50 text-red-600'
                      : 'bg-red-500/10 text-red-400'
                    : isLight
                      ? 'bg-stone-100 text-stone-600'
                      : 'bg-white/[0.06] text-stone-400'
              )}
            >
              {trend === 'up' ? (
                <TrendingUp className="w-3 h-3" />
              ) : trend === 'down' ? (
                <TrendingDown className="w-3 h-3" />
              ) : null}
            </div>
          )}
        </div>

        <div
          className={cn(
            'text-2xl font-bold tabular-nums tracking-tight',
            isLight ? 'text-stone-900' : 'text-white'
          )}
        >
          {value}
        </div>

        <div
          className={cn('text-xs font-medium mt-1', isLight ? 'text-stone-600' : 'text-stone-400')}
        >
          {label}
        </div>

        {subvalue && (
          <div className={cn('text-[10px] mt-0.5', isLight ? 'text-stone-500' : 'text-stone-500')}>
            {subvalue}
          </div>
        )}
      </div>
    </div>
  )
}

function SkeletonLoader({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'rounded-2xl p-4 animate-pulse',
              isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
            )}
          >
            <div
              className={cn('w-10 h-10 rounded-xl mb-3', isLight ? 'bg-stone-200' : 'bg-white/10')}
            />
            <div
              className={cn('h-6 w-20 rounded mb-2', isLight ? 'bg-stone-200' : 'bg-white/10')}
            />
            <div className={cn('h-3 w-16 rounded', isLight ? 'bg-stone-200' : 'bg-white/10')} />
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-8">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-[120px] h-[150px] rounded-full animate-pulse',
              isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
            )}
          />
        ))}
      </div>
    </div>
  )
}

export function VendorHealthDashboard({
  overview,
  riskSummary,
  isLoading,
  currency = 'USD',
}: VendorHealthDashboardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const healthScore = useMemo(() => {
    if (!overview || !riskSummary) return 0
    // Calculate health score based on:
    // - Overdue ratio (lower is better)
    // - High risk vendor ratio (lower is better)
    const overdueRatio =
      overview.total_ap > 0 ? (overview.total_overdue / overview.total_ap) * 100 : 0
    const overdueScore = Math.max(0, 100 - overdueRatio)
    const riskRatio =
      overview.total_vendors > 0
        ? (riskSummary.high_risk_vendors / overview.total_vendors) * 100
        : 0
    const riskScore = Math.max(0, 100 - riskRatio * 2)
    const blockedRatio =
      overview.total_vendors > 0 ? (overview.blocked_vendors / overview.total_vendors) * 100 : 0
    const blockedScore = Math.max(0, 100 - blockedRatio * 5)

    return overdueScore * 0.5 + riskScore * 0.3 + blockedScore * 0.2
  }, [overview, riskSummary])

  const overduePercentage = useMemo(() => {
    if (!overview || overview.total_ap === 0) return 0
    return (overview.total_overdue / overview.total_ap) * 100
  }, [overview])

  const styles = useMemo(
    () => ({
      card: isLight
        ? 'bg-gradient-to-br from-white via-white to-stone-50/50 border-stone-200/60 shadow-lg'
        : 'bg-gradient-to-br from-white/[0.03] via-white/[0.02] to-transparent border-white/[0.08]',
    }),
    [isLight]
  )

  const getHealthColor = (score: number) => {
    if (score >= 80) return '#10b981' // emerald
    if (score >= 60) return '#f59e0b' // amber
    if (score >= 40) return '#f97316' // orange
    return '#ef4444' // red
  }

  return (
    <div className={cn('rounded-3xl border p-6 transition-all duration-300', styles.card)}>
      {isLoading ? (
        <SkeletonLoader isLight={isLight} />
      ) : overview ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className={cn('text-lg font-bold', isLight ? 'text-stone-900' : 'text-white')}>
                Vendor Portfolio Health
              </h2>
              <p className={cn('text-sm', isLight ? 'text-stone-500' : 'text-stone-400')}>
                Real-time payables & risk analysis
              </p>
            </div>
            <div
              className={cn(
                'px-4 py-2 rounded-full border flex items-center gap-2',
                healthScore >= 70
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : healthScore >= 50
                    ? isLight
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : isLight
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
              )}
            >
              <Shield className="w-4 h-4" />
              <span className="text-sm font-semibold">
                {healthScore >= 70 ? 'Healthy' : healthScore >= 50 ? 'Moderate' : 'At Risk'}
              </span>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricTile
              icon={Building2}
              label="Total Vendors"
              value={overview.total_vendors.toLocaleString()}
              subvalue={`${overview.vendors_with_balance} with balance`}
              color="#6366f1"
              isLight={isLight}
            />
            <MetricTile
              icon={DollarSign}
              label="Total AP"
              value={formatCompactCurrency(overview.total_ap, currency)}
              subvalue={`${formatCompactCurrency(overview.total_overdue, currency)} overdue`}
              trend={overduePercentage > 20 ? 'down' : 'up'}
              color="#f59e0b"
              isLight={isLight}
            />
            <MetricTile
              icon={Wallet}
              label="Total Purchases"
              value={formatCompactCurrency(overview.total_purchases, currency)}
              subvalue="YTD spend"
              color="#10b981"
              isLight={isLight}
            />
            <MetricTile
              icon={AlertTriangle}
              label="At-Risk Vendors"
              value={(riskSummary?.high_risk_vendors || 0).toString()}
              subvalue={`${riskSummary?.vendors_overdue || 0} overdue`}
              trend={(riskSummary?.high_risk_vendors || 0) > 5 ? 'down' : 'neutral'}
              color="#ef4444"
              isLight={isLight}
            />
          </div>

          {/* Circular Gauges */}
          <div
            className={cn(
              'flex flex-wrap justify-center gap-8 py-4 px-6 rounded-2xl',
              isLight ? 'bg-stone-50/50' : 'bg-white/[0.02]'
            )}
          >
            <CircularGauge
              value={healthScore}
              color={getHealthColor(healthScore)}
              label="Health Score"
              sublabel="Overall portfolio"
              isLight={isLight}
            />
            <CircularGauge
              value={overduePercentage}
              color={
                overduePercentage > 30 ? '#ef4444' : overduePercentage > 15 ? '#f59e0b' : '#10b981'
              }
              label="Overdue Ratio"
              sublabel="AP at risk"
              isLight={isLight}
            />
            <CircularGauge
              value={riskSummary?.overdue_ratio || 0}
              color={
                (riskSummary?.overdue_ratio || 0) > 50
                  ? '#ef4444'
                  : (riskSummary?.overdue_ratio || 0) > 25
                    ? '#f59e0b'
                    : '#10b981'
              }
              label="Payment Risk"
              sublabel="High-risk exposure"
              isLight={isLight}
            />
          </div>

          {/* Bottom Stats Bar */}
          <div
            className={cn(
              'flex flex-wrap justify-between items-center gap-4 pt-4 border-t',
              isLight ? 'border-stone-200/60' : 'border-white/[0.06]'
            )}
          >
            <div className="flex items-center gap-6">
              <div>
                <span
                  className={cn(
                    'text-[10px] uppercase tracking-wider font-medium block',
                    isLight ? 'text-stone-500' : 'text-stone-500'
                  )}
                >
                  Total Purchases
                </span>
                <span
                  className={cn(
                    'text-sm font-bold tabular-nums',
                    isLight ? 'text-stone-800' : 'text-white'
                  )}
                >
                  {formatCompactCurrency(overview.total_purchases, currency)}
                </span>
              </div>
              <div className={cn('w-px h-8', isLight ? 'bg-stone-200' : 'bg-white/10')} />
              <div>
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
                    'text-sm font-bold tabular-nums',
                    isLight ? 'text-red-600' : 'text-red-400'
                  )}
                >
                  {formatCompactCurrency(overview.total_overdue, currency)}
                </span>
              </div>
              <div className={cn('w-px h-8', isLight ? 'bg-stone-200' : 'bg-white/10')} />
              <div>
                <span
                  className={cn(
                    'text-[10px] uppercase tracking-wider font-medium block',
                    isLight ? 'text-stone-500' : 'text-stone-500'
                  )}
                >
                  Blocked
                </span>
                <span
                  className={cn(
                    'text-sm font-bold tabular-nums',
                    overview.blocked_vendors > 0
                      ? isLight
                        ? 'text-red-600'
                        : 'text-red-400'
                      : isLight
                        ? 'text-stone-800'
                        : 'text-white'
                  )}
                >
                  {overview.blocked_vendors} vendors
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className={cn('w-4 h-4', isLight ? 'text-stone-400' : 'text-stone-500')} />
              <span className={cn('text-xs', isLight ? 'text-stone-500' : 'text-stone-500')}>
                Updated just now
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-64">
          <p className={cn('text-sm', isLight ? 'text-stone-500' : 'text-stone-400')}>
            No vendor data available
          </p>
        </div>
      )}
    </div>
  )
}
