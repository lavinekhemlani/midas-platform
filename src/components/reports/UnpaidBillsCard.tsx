// src/components/reports/UnpaidBillsCard.tsx
'use client'

import { useMemo } from 'react'
import { AlertCircle, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { useUnpaidBills } from '@/hooks/useUnpaidBills'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useSession } from '@/hooks/useSession'
import { useTheme } from '@/hooks/useTheme'

interface UnpaidBillsCardProps {
  startDate?: string
  endDate?: string
  className?: string
}

export function UnpaidBillsCard({ startDate, endDate, className }: UnpaidBillsCardProps) {
  const { organization } = useSession()
  const { unpaidBillsData, isLoading, error, refetch } = useUnpaidBills(
    startDate,
    endDate,
    organization?.organization_id
  )
  const { currency } = useCurrency()
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

  const data = unpaidBillsData || {
    totalUnpaid: 0,
    totalBills: 0,
    overdueBills: 0,
    overdueAmount: 0,
    topOverdueVendors: [],
    bills: [],
  }

  const totalUnpaid = data.totalUnpaid || 0
  const totalBills = data.totalBills || 0
  const overdueBills = data.overdueBills || 0
  const overdueAmount = data.overdueAmount || 0
  const topOverdueVendors = (data.topOverdueVendors || []).slice(0, 5)

  // Build aging-style buckets from vendor data
  const buckets = useMemo(() => {
    if (topOverdueVendors.length === 0) return []
    return topOverdueVendors.map((v, i) => ({
      label: v.name,
      value: v.amount,
      count: v.billCount,
      color: '#dc2626',
      percent: totalUnpaid > 0 ? (v.amount / totalUnpaid) * 100 : 0,
    }))
  }, [topOverdueVendors, totalUnpaid])

  if (isLoading) {
    return (
      <div className={cn('', className)}>
        <div className="flex items-center justify-between mb-3">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Unpaid Bills
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        <div
          className={cn(
            'h-8 w-32 animate-pulse mb-4',
            isLight ? 'bg-stone-200' : 'bg-white/[0.04]'
          )}
        />
        <div
          className={cn(
            'h-3 w-full animate-pulse mb-3',
            isLight ? 'bg-stone-200' : 'bg-white/[0.04]'
          )}
        />
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn('h-10 animate-pulse mb-1', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('', className)}>
        <div className="flex items-center justify-between mb-3">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Unpaid Bills
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <p className={cn('text-[14px]', styles.textMuted)}>
            {error.status === 429 ? 'Rate limited' : 'Failed to load'}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-6 px-2 text-[14px] gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (totalBills === 0) {
    return (
      <div className={cn('', className)}>
        <div className="flex items-center justify-between mb-3">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Unpaid Bills
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          <ChevronRight className="w-4 h-4 theme-text-secondary" />
        </div>
        <p className={cn('text-[14px] py-4', styles.textMuted)}>No unpaid bills</p>
      </div>
    )
  }

  return (
    <div className={cn('', className)}>
      {/* Header with underline hover */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={cn(
            'relative text-base font-normal uppercase tracking-wider',
            isLight ? 'text-stone-800' : 'text-stone-300'
          )}
        >
          Unpaid Bills
          <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
        </span>
        <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
      </div>

      {/* Big total */}
      <div className="flex items-baseline gap-3 mb-4">
        <span
          className={cn(
            'text-[28px] font-mono font-semibold tabular-nums',
            totalUnpaid > 0 ? 'text-red-500' : 'text-green-500'
          )}
        >
          {formatCurrency(totalUnpaid, { currency })}
        </span>
        <span className={cn('text-[12px] uppercase tracking-wider', styles.textMuted)}>
          Total Unpaid Bills
        </span>
      </div>

      {/* Vendor breakdown rows with alternating bg */}
      <div className="mt-3">
        {topOverdueVendors.map((vendor, i) => (
          <div
            key={vendor.name}
            className={cn(
              'flex items-center justify-between py-2.5 px-2 -mx-2 text-[14px]',
              i % 2 === 0 && (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]')
            )}
          >
            <span className={isLight ? 'text-stone-700' : 'text-stone-300'}>{vendor.name}</span>
            <span className={cn('font-mono font-medium tabular-nums text-[14px]', styles.text)}>
              {formatCurrency(vendor.amount, { currency })}
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
              {formatCurrency(overdueAmount, { currency })}
            </span>
            {totalUnpaid > 0 && (
              <span className={cn('text-[10px] font-mono', styles.textMuted)}>
                ({((overdueAmount / totalUnpaid) * 100).toFixed(0)}%)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Bill count footer */}
      <div className={cn('text-xs pt-2 mt-2 border-t', styles.border, styles.textMuted)}>
        {totalBills} bills from {topOverdueVendors.length} vendors
      </div>
    </div>
  )
}
