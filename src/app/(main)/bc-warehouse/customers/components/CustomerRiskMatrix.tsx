'use client'

import { useMemo, useState } from 'react'
import { ShieldAlert, ShieldCheck, Shield, AlertOctagon, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { CustomerRiskRow } from '../hooks/useCustomerInsights'

interface CustomerRiskMatrixProps {
  data: CustomerRiskRow[]
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

function RiskBubble({
  customer,
  maxBalance,
  isLight,
  currency,
  onClick,
}: {
  customer: CustomerRiskRow
  maxBalance: number
  isLight: boolean
  currency: string
  onClick: () => void
}) {
  const config = riskConfig[customer.risk_score]
  const sizeRatio = Math.max(0.4, Math.min(1, customer.balance_lcy / maxBalance))
  const size = 32 + sizeRatio * 40 // 32px to 72px

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative rounded-full transition-all duration-300 hover:scale-110 hover:z-10 flex items-center justify-center',
        'shadow-lg hover:shadow-xl cursor-pointer',
        `bg-gradient-to-br ${config.gradient}`
      )}
      style={{ width: size, height: size }}
      title={`${customer.name}: ${formatCompactCurrency(customer.balance_lcy, currency)}`}
    >
      <config.icon className="w-4 h-4 text-white/90" />
      <div
        className={cn(
          'absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none',
          'bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap z-20',
          isLight ? 'bg-stone-900 text-white' : 'bg-white text-stone-900'
        )}
      >
        <div className="font-semibold">
          {customer.name.substring(0, 20)}
          {customer.name.length > 20 ? '...' : ''}
        </div>
        <div className="text-[10px] opacity-80">
          Balance: {formatCompactCurrency(customer.balance_lcy, currency)}
        </div>
      </div>
    </button>
  )
}

function RiskLane({
  level,
  customers,
  maxBalance,
  isLight,
  currency,
  onCustomerClick,
}: {
  level: 'critical' | 'high' | 'medium' | 'low'
  customers: CustomerRiskRow[]
  maxBalance: number
  isLight: boolean
  currency: string
  onCustomerClick: (customer: CustomerRiskRow) => void
}) {
  const config = riskConfig[level]
  const Icon = config.icon
  const totalBalance = customers.reduce((sum, c) => sum + c.balance_lcy, 0)

  return (
    <div
      className={cn(
        'relative rounded-2xl p-4 border transition-all duration-300',
        isLight ? config.bg.light : config.bg.dark,
        isLight ? config.border.light : config.border.dark
      )}
    >
      {/* Lane Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              `bg-gradient-to-br ${config.gradient}`
            )}
          >
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div>
            <span
              className={cn(
                'text-sm font-semibold block',
                isLight ? config.text.light : config.text.dark
              )}
            >
              {config.label} Risk
            </span>
            <span className={cn('text-[10px]', isLight ? 'text-stone-500' : 'text-stone-500')}>
              {customers.length} customers
            </span>
          </div>
        </div>
        <div className="text-right">
          <span
            className={cn(
              'text-sm font-bold tabular-nums block',
              isLight ? config.text.light : config.text.dark
            )}
          >
            {formatCompactCurrency(totalBalance, currency)}
          </span>
          <span className={cn('text-[10px]', isLight ? 'text-stone-500' : 'text-stone-500')}>
            total exposure
          </span>
        </div>
      </div>

      {/* Bubbles Container */}
      <div className="flex flex-wrap gap-2 min-h-[60px] items-center">
        {customers.length > 0 ? (
          customers
            .slice(0, 12)
            .map((customer) => (
              <RiskBubble
                key={customer.no}
                customer={customer}
                maxBalance={maxBalance}
                isLight={isLight}
                currency={currency}
                onClick={() => onCustomerClick(customer)}
              />
            ))
        ) : (
          <span className={cn('text-xs italic', isLight ? 'text-stone-400' : 'text-stone-500')}>
            No customers in this risk category
          </span>
        )}
        {customers.length > 12 && (
          <div
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium',
              isLight ? 'bg-stone-200 text-stone-600' : 'bg-white/10 text-stone-400'
            )}
          >
            +{customers.length - 12} more
          </div>
        )}
      </div>
    </div>
  )
}

function CustomerDetailPanel({
  customer,
  isLight,
  currency,
  onClose,
}: {
  customer: CustomerRiskRow | null
  isLight: boolean
  currency: string
  onClose: () => void
}) {
  if (!customer) return null

  const config = riskConfig[customer.risk_score]
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
              {customer.name}
            </h4>
            <span className={cn('text-xs', isLight ? 'text-stone-500' : 'text-stone-400')}>
              #{customer.no}
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
            {formatCompactCurrency(customer.balance_lcy, currency)}
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
              customer.balance_due_lcy > 0
                ? isLight
                  ? 'text-red-600'
                  : 'text-red-400'
                : isLight
                  ? 'text-stone-900'
                  : 'text-white'
            )}
          >
            {formatCompactCurrency(customer.balance_due_lcy, currency)}
          </span>
        </div>
        <div className={cn('rounded-xl p-3', isLight ? 'bg-stone-50' : 'bg-white/[0.03]')}>
          <span
            className={cn(
              'text-[10px] uppercase tracking-wider font-medium block',
              isLight ? 'text-stone-500' : 'text-stone-500'
            )}
          >
            Credit Limit
          </span>
          <span
            className={cn(
              'text-lg font-bold tabular-nums',
              isLight ? 'text-stone-900' : 'text-white'
            )}
          >
            {formatCompactCurrency(customer.credit_limit_lcy, currency)}
          </span>
        </div>
        <div className={cn('rounded-xl p-3', isLight ? 'bg-stone-50' : 'bg-white/[0.03]')}>
          <span
            className={cn(
              'text-[10px] uppercase tracking-wider font-medium block',
              isLight ? 'text-stone-500' : 'text-stone-500'
            )}
          >
            Utilization
          </span>
          <span
            className={cn(
              'text-lg font-bold tabular-nums',
              customer.credit_utilization > 100
                ? isLight
                  ? 'text-red-600'
                  : 'text-red-400'
                : customer.credit_utilization > 80
                  ? isLight
                    ? 'text-amber-600'
                    : 'text-amber-400'
                  : isLight
                    ? 'text-emerald-600'
                    : 'text-emerald-400'
            )}
          >
            {customer.credit_utilization.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Credit utilization bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className={cn(isLight ? 'text-stone-500' : 'text-stone-400')}>
            Credit Utilization
          </span>
          <span className={cn(isLight ? 'text-stone-600' : 'text-stone-300')}>
            {customer.credit_utilization.toFixed(1)}%
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
              customer.credit_utilization > 100
                ? 'bg-red-500'
                : customer.credit_utilization > 80
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            )}
            style={{ width: `${Math.min(customer.credit_utilization, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function SkeletonLoader({ isLight }: { isLight: boolean }) {
  return (
    <div className="space-y-4">
      {['critical', 'high', 'medium', 'low'].map((level) => (
        <div
          key={level}
          className={cn(
            'rounded-2xl p-4 animate-pulse',
            isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
          )}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={cn('w-8 h-8 rounded-lg', isLight ? 'bg-stone-200' : 'bg-white/10')} />
            <div className={cn('h-4 w-24 rounded', isLight ? 'bg-stone-200' : 'bg-white/10')} />
          </div>
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className={cn('w-12 h-12 rounded-full', isLight ? 'bg-stone-200' : 'bg-white/10')}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function CustomerRiskMatrix({ data, isLoading, currency = 'USD' }: CustomerRiskMatrixProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRiskRow | null>(null)

  const { critical, high, medium, low, maxBalance } = useMemo(() => {
    const groups = {
      critical: data.filter((c) => c.risk_score === 'critical'),
      high: data.filter((c) => c.risk_score === 'high'),
      medium: data.filter((c) => c.risk_score === 'medium'),
      low: data.filter((c) => c.risk_score === 'low'),
    }
    const max = Math.max(...data.map((c) => c.balance_lcy), 1)
    return { ...groups, maxBalance: max }
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
            Customer Risk Matrix
          </h3>
          <p className={cn('text-xs', isLight ? 'text-stone-500' : 'text-stone-400')}>
            Visual risk distribution by credit exposure
          </p>
        </div>
        <div
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium',
            isLight ? 'bg-stone-100 text-stone-600' : 'bg-white/[0.06] text-stone-400'
          )}
        >
          {data.length} customers
        </div>
      </div>

      {isLoading ? (
        <SkeletonLoader isLight={isLight} />
      ) : data.length > 0 ? (
        <div className="flex gap-5">
          {/* Risk Lanes */}
          <div className="flex-1 space-y-3">
            <RiskLane
              level="critical"
              customers={critical}
              maxBalance={maxBalance}
              isLight={isLight}
              currency={currency}
              onCustomerClick={setSelectedCustomer}
            />
            <RiskLane
              level="high"
              customers={high}
              maxBalance={maxBalance}
              isLight={isLight}
              currency={currency}
              onCustomerClick={setSelectedCustomer}
            />
            <RiskLane
              level="medium"
              customers={medium}
              maxBalance={maxBalance}
              isLight={isLight}
              currency={currency}
              onCustomerClick={setSelectedCustomer}
            />
            <RiskLane
              level="low"
              customers={low}
              maxBalance={maxBalance}
              isLight={isLight}
              currency={currency}
              onCustomerClick={setSelectedCustomer}
            />
          </div>

          {/* Detail Panel */}
          {selectedCustomer && (
            <div className="w-72 flex-shrink-0">
              <CustomerDetailPanel
                customer={selectedCustomer}
                isLight={isLight}
                currency={currency}
                onClose={() => setSelectedCustomer(null)}
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
