'use client'

import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from '@/components/ui/InfoTooltip'
import type { TopVendorRow } from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'

interface TopVendorsCardProps {
  vendors: TopVendorRow[]
  isLoading: boolean
  currency?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

export function TopVendorsCard({
  vendors,
  isLoading,
  currency = 'USD',
  tooltipProps,
}: TopVendorsCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
    }),
    [isLight]
  )

  const maxSpend = vendors.length > 0 ? Math.max(...vendors.map((v) => Number(v.total_spend))) : 0

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
              Top Vendors
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn('h-8 animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
          />
        ))}
      </div>
    )
  }

  if (vendors.length === 0) {
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
              Top Vendors
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No vendor data</p>
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
            Top Vendors
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps && <InfoTooltip {...tooltipProps} />}
        </div>
        <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
      </div>
      <div className="space-y-3">
        {vendors.map((vendor, i) => {
          const spend = Number(vendor.total_spend)
          const barWidth = maxSpend > 0 ? Math.max(8, (spend / maxSpend) * 100) : 0
          return (
            <div key={vendor.vendor_no || i} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-sm theme-text-secondary truncate flex-1"
                  title={vendor.vendor_name}
                >
                  {vendor.vendor_name.length > 28
                    ? vendor.vendor_name.substring(0, 28) + '...'
                    : vendor.vendor_name}
                </span>
                <span className="text-base font-mono font-semibold tabular-nums theme-text-primary whitespace-nowrap">
                  {formatCompactCurrency(spend, currency)}
                </span>
              </div>
              <div className={cn('w-full h-1.5', isLight ? 'bg-stone-100' : 'bg-white/[0.04]')}>
                <div
                  className="h-full bg-orange-500/60 transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
