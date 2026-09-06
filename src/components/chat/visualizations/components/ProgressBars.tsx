/**
 * @component ProgressBars
 * @description Progress bars for goal tracking and completion status
 */

'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { formatValue, getChartColor } from '../shared'
import type { ProgressBlock } from '../shared/types'

export interface ProgressRendererProps {
  block: ProgressBlock
  className?: string
}

export const ProgressRenderer = memo(function ProgressRenderer({
  block,
  className,
}: ProgressRendererProps) {
  const { title, items, showLabels = true, currencyCode } = block

  if (!items?.length) {
    return (
      <div className={cn('my-4 glass-luxury-card rounded-xl p-4', className)}>
        {title && <h4 className="text-sm font-semibold theme-text-primary mb-3">{title}</h4>}
        <p className="text-sm theme-text-secondary">No progress data available</p>
      </div>
    )
  }

  return (
    <div className={cn('my-4 glass-luxury-card rounded-xl p-4', className)}>
      {title && <h4 className="text-sm font-semibold theme-text-primary mb-3">{title}</h4>}

      <div className="space-y-3">
        {items.map((item, idx) => {
          const percentage = Math.min((item.value / (item.max || 100)) * 100, 100)
          const color = item.color || getChartColor(idx)

          return (
            <div key={idx}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm theme-text-primary">{item.label}</span>
                {showLabels && (
                  <span className="text-sm theme-text-secondary">
                    {formatValue(
                      item.value,
                      item.format === 'currency' ? currencyCode : undefined,
                      item.format
                    )}{' '}
                    /{' '}
                    {formatValue(
                      item.max || 100,
                      item.format === 'currency' ? currencyCode : undefined,
                      item.format
                    )}
                  </span>
                )}
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%`, backgroundColor: color }}
                />
              </div>
              {item.target && (
                <div className="flex justify-end mt-0.5">
                  <span className="text-xs theme-text-secondary">
                    Target:{' '}
                    {formatValue(
                      item.target,
                      item.format === 'currency' ? currencyCode : undefined,
                      item.format
                    )}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
})

ProgressRenderer.displayName = 'ProgressRenderer'
