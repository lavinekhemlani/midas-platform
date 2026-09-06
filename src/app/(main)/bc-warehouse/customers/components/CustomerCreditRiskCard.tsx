'use client'

import { useMemo } from 'react'
import { ShieldAlert, ShieldCheck, Shield, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { CustomerRiskRow, CreditRiskSummary } from '../hooks/useCustomerInsights'

interface CustomerCreditRiskCardProps {
  data: CustomerRiskRow[]
  summary: CreditRiskSummary | null
  isLoading: boolean
  currency?: string
}

function SkeletonLoader({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-3">
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
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-10 rounded-lg animate-pulse',
            isLight ? 'bg-stone-100/50' : 'bg-white/[0.02]'
          )}
        />
      ))}
    </div>
  )
}

function RiskBadge({ risk, isLight }: { risk: CustomerRiskRow['risk_score']; isLight: boolean }) {
  const config = {
    low: {
      icon: ShieldCheck,
      light: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
      dark: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      label: 'Low',
    },
    medium: {
      icon: Shield,
      light: 'bg-amber-50 text-amber-700 border-amber-200/60',
      dark: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      label: 'Med',
    },
    high: {
      icon: ShieldAlert,
      light: 'bg-orange-50 text-orange-700 border-orange-200/60',
      dark: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      label: 'High',
    },
    critical: {
      icon: AlertTriangle,
      light: 'bg-red-50 text-red-700 border-red-200/60',
      dark: 'bg-red-500/10 text-red-400 border-red-500/20',
      label: 'Crit',
    },
  }

  const { icon: Icon, light, dark, label } = config[risk]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border',
        isLight ? light : dark
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

export function CustomerCreditRiskCard({
  data,
  summary,
  isLoading,
  currency = 'USD',
}: CustomerCreditRiskCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const topRiskCustomers = data
    .filter((c) => c.risk_score === 'high' || c.risk_score === 'critical')
    .slice(0, 5)

  const styles = useMemo(
    () => ({
      card: isLight
        ? 'bg-white/90 border-stone-200/60 shadow-sm'
        : 'bg-white/[0.02] border-white/[0.06]',
      headerIcon: isLight
        ? 'bg-gradient-to-br from-red-50 to-orange-50 text-red-500 border border-red-100'
        : 'bg-gradient-to-br from-red-500/15 to-orange-500/10 text-red-400 border border-red-500/20',
      statBox: isLight
        ? 'bg-gradient-to-br from-stone-50 to-stone-100/50 border-stone-200/60'
        : 'bg-white/[0.03] border-white/[0.06]',
      rowHover: isLight ? 'hover:bg-stone-50/80' : 'hover:bg-white/[0.03]',
      divider: isLight ? 'border-stone-200/60' : 'border-white/[0.06]',
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
            <ShieldAlert className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className={cn('text-sm font-semibold', isLight ? 'text-stone-900' : 'text-white')}>
              Credit Risk
            </h3>
            <p className={cn('text-[11px]', isLight ? 'text-stone-500' : 'text-stone-500')}>
              Customer exposure analysis
            </p>
          </div>
        </div>
        {!isLoading && summary && (
          <span
            className={cn(
              'text-xs font-semibold px-2.5 py-1 rounded-full border',
              summary.high_risk_customers > 0
                ? isLight
                  ? 'bg-red-50 text-red-600 border-red-200/60'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                : isLight
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200/60'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            )}
          >
            {summary.high_risk_customers} at risk
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <SkeletonLoader isLight={isLight} />
        ) : summary ? (
          <div className="space-y-4">
            {/* Summary Stats */}
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
                  Credit Used
                </div>
                <div
                  className={cn(
                    'text-base font-bold tabular-nums',
                    isLight ? 'text-blue-600' : 'text-blue-400'
                  )}
                >
                  {summary.overall_utilization.toFixed(1)}%
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
                  Over Limit
                </div>
                <div
                  className={cn(
                    'text-base font-bold tabular-nums',
                    isLight ? 'text-orange-600' : 'text-orange-400'
                  )}
                >
                  {summary.customers_over_limit}
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
                  Overdue
                </div>
                <div
                  className={cn(
                    'text-base font-bold tabular-nums',
                    isLight ? 'text-red-600' : 'text-red-400'
                  )}
                >
                  {summary.customers_overdue}
                </div>
              </div>
            </div>

            {/* High Risk Customers */}
            {topRiskCustomers.length > 0 ? (
              <div className="space-y-1.5">
                <div
                  className={cn(
                    'text-[10px] uppercase tracking-wider font-semibold px-1',
                    isLight ? 'text-stone-500' : 'text-stone-500'
                  )}
                >
                  High Risk Customers
                </div>
                <div className="space-y-1">
                  {topRiskCustomers.map((customer) => (
                    <div
                      key={customer.no}
                      className={cn(
                        'flex items-center justify-between gap-2 py-2 px-2 rounded-lg transition-colors',
                        styles.rowHover
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <RiskBadge risk={customer.risk_score} isLight={isLight} />
                        <span
                          className={cn(
                            'text-xs truncate font-medium',
                            isLight ? 'text-stone-700' : 'text-stone-300'
                          )}
                          title={customer.name}
                        >
                          {customer.name.length > 16
                            ? customer.name.substring(0, 16) + '...'
                            : customer.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            'text-[11px] tabular-nums',
                            isLight ? 'text-stone-500' : 'text-stone-500'
                          )}
                        >
                          {customer.credit_utilization.toFixed(0)}%
                        </span>
                        <span
                          className={cn(
                            'text-xs font-mono font-semibold tabular-nums',
                            isLight ? 'text-red-600' : 'text-red-400'
                          )}
                        >
                          {formatCompactCurrency(customer.balance_due_lcy, currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    className={cn('w-5 h-5', isLight ? 'text-emerald-500' : 'text-emerald-400')}
                  />
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isLight ? 'text-emerald-600' : 'text-emerald-400'
                    )}
                  >
                    No high-risk customers
                  </span>
                </div>
              </div>
            )}

            {/* Total Exposure */}
            <div className={cn('pt-3 border-t space-y-1.5', styles.divider)}>
              <div className="flex items-center justify-between px-1">
                <span className={cn('text-[11px]', isLight ? 'text-stone-500' : 'text-stone-400')}>
                  Total AR Exposure
                </span>
                <span
                  className={cn(
                    'text-sm font-bold tabular-nums',
                    isLight ? 'text-stone-800' : 'text-white'
                  )}
                >
                  {formatCompactCurrency(summary.total_balance, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between px-1">
                <span className={cn('text-[11px]', isLight ? 'text-stone-500' : 'text-stone-400')}>
                  Overdue Amount
                </span>
                <span
                  className={cn(
                    'text-sm font-bold tabular-nums',
                    isLight ? 'text-red-600' : 'text-red-400'
                  )}
                >
                  {formatCompactCurrency(summary.total_balance_due, currency)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-40">
            <p className={cn('text-sm', isLight ? 'text-stone-500' : 'text-stone-400')}>
              No credit data available
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
