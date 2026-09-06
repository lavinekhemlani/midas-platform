/**
 * @component Timeline
 * @description Timeline display for event sequences
 */

'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { Calendar, AlertCircle, CheckCircle, Circle } from 'lucide-react'
import { formatValue } from '../shared/formatters'
import type { TimelineBlock } from '../shared/types'

export interface TimelineRendererProps {
  block: TimelineBlock
  className?: string
}

const getEventIcon = (type?: string) => {
  switch (type) {
    case 'positive':
      return <CheckCircle className="w-4 h-4 text-emerald-500" />
    case 'negative':
      return <AlertCircle className="w-4 h-4 text-red-500" />
    case 'warning':
      return <AlertCircle className="w-4 h-4 text-amber-500" />
    default:
      return <Circle className="w-4 h-4 text-blue-500" />
  }
}

const getEventColor = (type?: string) => {
  switch (type) {
    case 'positive':
      return 'border-emerald-500/30 bg-emerald-500/10'
    case 'negative':
      return 'border-red-500/30 bg-red-500/10'
    case 'warning':
      return 'border-amber-500/30 bg-amber-500/10'
    default:
      return 'border-blue-500/30 bg-blue-500/10'
  }
}

export const TimelineRenderer = memo(function TimelineRenderer({
  block,
  className,
}: TimelineRendererProps) {
  const { title, events } = block

  if (!events?.length) {
    return (
      <div className={cn('my-4 glass-luxury-card rounded-xl p-4', className)}>
        {title && <h4 className="text-sm font-semibold theme-text-primary mb-3">{title}</h4>}
        <p className="text-sm theme-text-secondary">No events available</p>
      </div>
    )
  }

  return (
    <div className={cn('my-4 glass-luxury-card rounded-xl p-4', className)}>
      {title && <h4 className="text-sm font-semibold theme-text-primary mb-3">{title}</h4>}

      <div className="space-y-3">
        {events.map((event, idx) => (
          <div key={idx} className="flex gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">{getEventIcon(event.type)}</div>

            {/* Content */}
            <div className={cn('flex-1 rounded-lg border p-3', getEventColor(event.type))}>
              <div className="flex items-center justify-between">
                <span className="font-medium theme-text-primary text-sm">{event.label}</span>
                <div className="flex items-center gap-1 text-xs theme-text-secondary">
                  <Calendar className="w-3 h-3" />
                  {new Date(event.date).toLocaleDateString()}
                </div>
              </div>
              {event.description && (
                <p className="text-xs theme-text-secondary mt-1">{event.description}</p>
              )}
              {event.value !== undefined && (
                <p className="text-sm font-medium theme-text-primary mt-1">
                  {formatValue(event.value)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

TimelineRenderer.displayName = 'TimelineRenderer'
