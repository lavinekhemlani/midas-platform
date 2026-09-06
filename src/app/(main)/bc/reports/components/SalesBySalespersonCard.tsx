'use client'

import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from '@/components/ui/InfoTooltip'
import type { SalespersonRow } from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'

interface SalesBySalespersonCardProps {
  data: SalespersonRow[]
  isLoading: boolean
  currency?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

export function SalesBySalespersonCard({
  data,
  isLoading,
  currency = 'USD',
  tooltipProps,
}: SalesBySalespersonCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
    }),
    [isLight]
  )

  const topSalespeople = data.slice(0, 5)
  const maxSales =
    topSalespeople.length > 0 ? Math.max(...topSalespeople.map((s) => Number(s.total_sales))) : 0
  const totalSales = topSalespeople.reduce((sum, s) => sum + Number(s.total_sales), 0)

  const colors = ['bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-blue-500', 'bg-cyan-500']

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
              Sales by Rep
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

  if (topSalespeople.length === 0) {
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
              Sales by Rep
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No salesperson data</p>
      </div>
    )
  }

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
            Sales by Rep
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps && <InfoTooltip {...tooltipProps} />}
        </div>
        <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
      </div>

      <div className="space-y-3">
        {topSalespeople.map((person, i) => {
          const sales = Number(person.total_sales)
          const barWidth = maxSales > 0 ? Math.max(8, (sales / maxSales) * 100) : 0
          const percentage = totalSales > 0 ? ((sales / totalSales) * 100).toFixed(1) : '0'

          return (
            <div key={person.salesperson_code} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className={cn('w-2 h-2 rounded-full flex-shrink-0', colors[i % colors.length])}
                  />
                  <span
                    className="text-sm theme-text-secondary truncate"
                    title={person.salesperson_code}
                  >
                    {person.salesperson_code}
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <span className={cn('text-[12px] mb-0.5', styles.textMuted)}>{percentage}%</span>
                  <span className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary whitespace-nowrap">
                    {formatCompactCurrency(sales, currency)}
                  </span>
                </div>
              </div>
              <div className={cn('w-full h-1.5', isLight ? 'bg-stone-100' : 'bg-white/[0.04]')}>
                <div
                  className={cn(
                    'h-full transition-all duration-500',
                    colors[i % colors.length].replace('bg-', 'bg-') + '/60'
                  )}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          )
        })}

        {/* Invoice count summary */}
        <div className={cn('pt-2 mt-2 border-t', styles.border)}>
          <div className="flex items-center justify-between text-sm">
            <span className={styles.textMuted}>Total Invoices</span>
            <span className="text-[16px] font-mono font-semibold tabular-nums theme-text-primary">
              {topSalespeople.reduce((sum, s) => sum + Number(s.invoice_count), 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
