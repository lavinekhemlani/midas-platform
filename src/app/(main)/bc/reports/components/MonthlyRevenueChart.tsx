'use client'

import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPnLCurrency, formatAxisCurrency } from '@/lib/utils/currency'
import { EChartsLine } from '@/components/charts/echarts'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from '@/components/ui/InfoTooltip'
import type {
  MonthlyRevenueRow,
  MonthlyPnLTrendRow,
} from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'

interface MonthlyRevenueChartProps {
  data: MonthlyRevenueRow[] | MonthlyPnLTrendRow[]
  isLoading: boolean
  currency?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
  /** Authoritative total from the income statement — avoids summing per-entry Math.abs values */
  totalRevenue?: number
}

function isPnLTrendRow(row: MonthlyRevenueRow | MonthlyPnLTrendRow): row is MonthlyPnLTrendRow {
  return 'revenue' in row && !('total_revenue' in row)
}

export function MonthlyRevenueChart({
  data,
  isLoading,
  currency = 'USD',
  tooltipProps,
  totalRevenue: totalRevenueOverride,
}: MonthlyRevenueChartProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
    }),
    [isLight]
  )

  const themeGreen = theme === 'light' ? '#178E66' : '#2FBC8B'

  const usePnLTrend = data.length > 0 && isPnLTrendRow(data[0])

  const formattedData = useMemo(() => {
    if (usePnLTrend) {
      return (data as MonthlyPnLTrendRow[]).map((row) => {
        const date = new Date(row.month + '-01')
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        return {
          month: monthLabel,
          revenue: row.revenue,
        }
      })
    }
    return [...(data as MonthlyRevenueRow[])].reverse().map((row) => {
      const date = new Date(row.month)
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      return {
        month: monthLabel,
        revenue: Number(row.total_revenue),
      }
    })
  }, [data, usePnLTrend])

  const computedTotal = usePnLTrend
    ? (data as MonthlyPnLTrendRow[]).reduce((sum, r) => sum + r.revenue, 0)
    : (data as MonthlyRevenueRow[]).reduce((sum, r) => sum + Number(r.total_revenue), 0)
  const totalRevenue = totalRevenueOverride ?? computedTotal

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
              Monthly Revenue
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
        </div>
        <div
          className={cn('h-[200px] animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
        />
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
            Monthly Revenue
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps && <InfoTooltip {...tooltipProps} />}
        </div>
        <ChevronRight className="w-4 h-4 theme-text-secondary transition-all duration-300 ease-out group-hover:text-amber-400 group-hover:translate-x-1.5 group-hover:scale-110" />
      </div>
      {data.length > 0 && (
        <div className="flex items-center gap-10 mb-5">
          <div>
            <span className={cn('text-xs', styles.textMuted)}>Total</span>
            <span className="block text-[28px] font-mono font-semibold tabular-nums text-theme-green">
              {formatPnLCurrency(totalRevenue, currency)}
            </span>
          </div>
        </div>
      )}
      {formattedData.length > 0 ? (
        <div className="h-[200px] -ml-3">
          <EChartsLine
            data={formattedData}
            xKey="month"
            series={[
              {
                key: 'revenue',
                name: 'Revenue',
                color: themeGreen,
                showArea: true,
              },
            ]}
            formatY={(value) => formatPnLCurrency(value, currency)}
            formatAxisY={formatAxisCurrency(currency)}
            showLegend={false}
            height={200}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-[200px]">
          <p className={cn('text-sm', styles.textMuted)}>No revenue data available</p>
        </div>
      )}
    </div>
  )
}
