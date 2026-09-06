'use client'

import { useMemo } from 'react'
import { RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from './InfoTooltip'

interface InventoryTurnoverCardProps {
  data: {
    cogs_annual: number
    average_inventory: number
    current_inventory: number
    turnover_ratio: number
    days_inventory_outstanding: number
  } | null
  rating?: 'excellent' | 'good' | 'fair' | 'poor' | null
  isLoading: boolean
  currency?: string
  tooltip?: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}

function getTurnoverRating(
  ratio: number,
  isLight: boolean
): {
  label: string
  color: string
  barColor: string
  description: string
  icon: React.ElementType
} {
  if (ratio >= 8) {
    return {
      label: 'Excellent',
      color: isLight ? 'text-green-600' : 'text-green-400',
      barColor: '#10b981',
      description: 'Outstanding inventory management',
      icon: CheckCircle,
    }
  }
  if (ratio >= 5) {
    return {
      label: 'Good',
      color: isLight ? 'text-blue-600' : 'text-blue-400',
      barColor: '#3b82f6',
      description: 'Healthy turnover rate',
      icon: CheckCircle,
    }
  }
  if (ratio >= 2) {
    return {
      label: 'Fair',
      color: 'text-amber-500',
      barColor: '#f59e0b',
      description: 'Consider optimizing inventory',
      icon: AlertTriangle,
    }
  }
  return {
    label: 'Poor',
    color: isLight ? 'text-red-600' : 'text-red-400',
    barColor: '#ef4444',
    description: 'Inventory moving too slowly',
    icon: XCircle,
  }
}

function getDIOStatus(dio: number, isLight: boolean): { color: string; status: string } {
  if (dio <= 30) return { color: isLight ? 'text-green-600' : 'text-green-400', status: 'Optimal' }
  if (dio <= 60) return { color: isLight ? 'text-blue-600' : 'text-blue-400', status: 'Good' }
  if (dio <= 90) return { color: 'text-amber-500', status: 'Moderate' }
  return { color: isLight ? 'text-red-600' : 'text-red-400', status: 'High' }
}

export function InventoryTurnoverCard({
  data,
  isLoading,
  tooltip,
  tooltipProps,
}: InventoryTurnoverCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      rowBg: isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]',
    }),
    [isLight]
  )

  const rating = data ? getTurnoverRating(data.turnover_ratio, isLight) : null
  const dioStatus = data ? getDIOStatus(data.days_inventory_outstanding, isLight) : null
  const gaugePercentage = data ? Math.min((data.turnover_ratio / 12) * 100, 100) : 0

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Inventory Turnover
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <div
          className={cn('h-[120px] animate-pulse', isLight ? 'bg-stone-200' : 'bg-white/[0.04]')}
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-5">
          <span
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            Inventory Turnover
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No turnover data available</p>
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
            Inventory Turnover
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
          </span>
          {tooltipProps ? (
            <InfoTooltip {...tooltipProps} />
          ) : tooltip ? (
            <InfoTooltip content={tooltip} />
          ) : null}
        </div>
      </div>

      {/* Main Display */}
      <div className={cn('py-4 px-2 -mx-2 mb-2', styles.rowBg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={cn('text-4xl font-mono font-bold tabular-nums', rating?.color)}>
              {data.turnover_ratio.toFixed(2)}x
            </span>
            <span className={cn('text-[14px]', styles.textMuted)}>times per year</span>
          </div>
          {rating && (
            <span
              className="text-[14px] font-medium px-1.5 py-0.5"
              style={{ color: rating.barColor, backgroundColor: `${rating.barColor}15` }}
            >
              {rating.label}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className={cn('h-1.5 w-full mt-3', isLight ? 'bg-stone-300' : 'bg-white/[0.10]')}>
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${gaugePercentage}%`, backgroundColor: rating?.barColor }}
          />
        </div>
      </div>

      {/* Metrics */}
      <div className={cn('flex items-center justify-between py-2.5 px-2 -mx-2 text-[14px]')}>
        <span className={isLight ? 'text-stone-700' : 'text-stone-300'}>Days in Inventory</span>
        <span className={cn('font-mono tabular-nums', dioStatus?.color)}>
          {Math.round(data.days_inventory_outstanding)} days ({dioStatus?.status})
        </span>
      </div>

      {/* Scale legend */}
      <div className={cn('flex justify-between text-[14px] pt-2', styles.textMuted)}>
        <span>Poor (0-2)</span>
        <span>Fair (2-5)</span>
        <span>Good (5-8)</span>
        <span>Excellent (8+)</span>
      </div>
    </div>
  )
}
