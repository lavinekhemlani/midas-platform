/**
 * @component SingleMetric
 * @description Single metric display with optional sparkline
 */

'use client'

import { memo, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { COLORS, formatValue, canvasHighDpiOpts } from '../shared'
import type { MetricBlock } from '../shared/types'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

export interface MetricRendererProps {
  block: MetricBlock
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

export const MetricRenderer = memo(function MetricRenderer({
  block,
  className,
}: MetricRendererProps) {
  const { label, value, format, description, trend, color, sparkline, currencyCode } = block

  const getColorClass = (c?: string) => colorClasses[c || ''] || 'theme-text-primary'

  const sparklineOption = useMemo(() => {
    if (!sparkline?.length) return null

    return {
      backgroundColor: 'transparent',
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: { type: 'category' as const, show: false, data: sparkline.map((_, i) => i) },
      yAxis: { type: 'value' as const, show: false },
      series: [
        {
          type: 'line',
          data: sparkline,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.5, color: COLORS.amber },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(245, 158, 11, 0.3)' },
                { offset: 1, color: 'rgba(245, 158, 11, 0.05)' },
              ],
            },
          },
        },
      ],
    }
  }, [sparkline])

  const numericValue = typeof value === 'string' ? parseFloat(value) || 0 : value

  return (
    <div className={cn('my-4 glass-luxury-card rounded-lg p-4 inline-flex flex-col', className)}>
      <span className="text-xs theme-text-secondary">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className={cn('text-2xl font-bold', getColorClass(color))}>
          {formatValue(numericValue, format === 'currency' ? currencyCode : undefined, format)}
        </span>
        {trend && (
          <div className="flex items-center gap-1">
            {trend.direction === 'up' ? (
              <ArrowUp
                className={cn(
                  'w-4 h-4',
                  trend.isGood !== false ? 'text-emerald-500' : 'text-red-500'
                )}
              />
            ) : trend.direction === 'down' ? (
              <ArrowDown
                className={cn(
                  'w-4 h-4',
                  trend.isGood === true ? 'text-emerald-500' : 'text-red-500'
                )}
              />
            ) : (
              <Minus className="w-4 h-4 text-gray-400" />
            )}
            <span
              className={cn(
                'text-sm',
                trend.direction === 'up'
                  ? trend.isGood !== false
                    ? 'text-emerald-500'
                    : 'text-red-500'
                  : trend.direction === 'down'
                    ? trend.isGood === true
                      ? 'text-emerald-500'
                      : 'text-red-500'
                    : 'text-gray-400'
              )}
            >
              {typeof trend.value === 'number' ? trend.value.toFixed(1) : trend.value}%
            </span>
          </div>
        )}
      </div>
      {sparklineOption && (
        <div className="mt-2 h-8">
          <ReactECharts
            option={sparklineOption}
            style={{ height: '100%', width: '100%' }}
            opts={canvasHighDpiOpts}
          />
        </div>
      )}
      {description && <span className="text-xs theme-text-secondary mt-1">{description}</span>}
    </div>
  )
})

MetricRenderer.displayName = 'MetricRenderer'
