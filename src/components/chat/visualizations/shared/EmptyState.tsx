/**
 * @component EmptyState
 * @description Displays when a chart has no data available
 * Provides a consistent empty state UI across all visualizations
 */

'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { EmptyStateProps } from './types'

export const EmptyState = memo(function EmptyState({
  message = 'No data available',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'w-full h-full min-h-[200px]',
        'flex items-center justify-center',
        'text-sm theme-text-secondary',
        'bg-white/5 rounded-lg border border-white/10'
      )}
      role="status"
      aria-label={message}
    >
      <p>{message}</p>
    </div>
  )
})

EmptyState.displayName = 'EmptyState'
