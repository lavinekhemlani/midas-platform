/**
 * @component KPIGrid
 * @description Grid of KPI metrics with trends and color coding
 */

'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { formatValue } from '../shared/formatters'
import type { KPIBlock } from '../shared/types'

export interface KPIRendererProps {
  block: KPIBlock
  className?: string
}

const colorClasses: Record<string, string> = {
  green: 'text-emerald-500',
  red: 'text-red-500',
  yellow: 'text-amber-500',
  blue: 'text-blue-500',
  purple: 'text-purple-500',
  gray: 'text-gray-400',
}

export const KPIRenderer = memo(function KPIRenderer({ block, className }: KPIRendererProps) {
  const { title, metrics, columns = 3, variant = 'default', currencyCode } = block

  const formatKPIValue = (value: number | string, format?: string) => {
    if (typeof value === 'string') return value
    // Pass currencyCode when format is 'currency' so amounts render with correct symbol (e.g. ₦ not $)
    return formatValue(value, format === 'currency' ? currencyCode : undefined, format)
  }

  const getColorClass = (color?: string) => colorClasses[color || ''] || 'theme-text-primary'

  const getTrendColorClass = (direction: string, isGood?: boolean) => {
    if (isGood !== undefined) {
      return isGood ? 'text-emerald-500' : 'text-red-500'
    }
    return direction === 'up'
      ? 'text-emerald-500'
      : direction === 'down'
        ? 'text-red-500'
        : 'text-gray-400'
  }

  if (!metrics?.length) {
    return (
      <div className={cn('my-4 glass-luxury-card rounded-xl p-4', className)}>
        {title && <h4 className="text-sm font-semibold theme-text-primary mb-3">{title}</h4>}
        <p className="text-sm theme-text-secondary">No metrics available</p>
      </div>
    )
  }

  return (
    <div className={cn('my-4', className)}>
      {title && <h4 className="text-sm font-semibold theme-text-primary mb-3">{title}</h4>}

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(columns, metrics.length)}, 1fr)` }}
      >
        {metrics.map((metric, idx) => (
          <div
            key={idx}
            className={cn(
              'glass-luxury-card rounded-lg flex flex-col',
              variant === 'compact' ? 'p-3' : variant === 'large' ? 'p-6' : 'p-4'
            )}
          >
            <span className="text-xs theme-text-secondary mb-1">{metric.label}</span>
            <span
              className={cn(
                variant === 'large' ? 'text-2xl' : 'text-xl',
                'font-bold',
                getColorClass(metric.color)
              )}
            >
              {formatKPIValue(metric.value, metric.format)}
            </span>
            {metric.trend && (
              <div className="flex items-center gap-1 mt-1">
                {metric.trend.direction === 'up' ? (
                  <ArrowUp className="w-3 h-3" />
                ) : metric.trend.direction === 'down' ? (
                  <ArrowDown className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
                <span
                  className={cn(
                    'text-xs',
                    getTrendColorClass(metric.trend.direction, metric.trend.isGood)
                  )}
                >
                  {typeof metric.trend.value === 'number'
                    ? metric.trend.value.toFixed(1)
                    : metric.trend.value}
                  %{metric.trend.label && ` ${metric.trend.label}`}
                </span>
              </div>
            )}
            {metric.description && (
              <span className="text-xs theme-text-secondary mt-1">{metric.description}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
})

KPIRenderer.displayName = 'KPIRenderer'
