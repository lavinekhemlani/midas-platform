// src/app/(main)/reports/components/DataStatusIndicator.tsx
'use client'

import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { formatLastUpdated } from '@/lib/report-utils'

interface DataStatusIndicatorProps {
  status: 'fresh' | 'stale' | 'error'
  lastUpdated: Date | null
}

export function DataStatusIndicator({ status, lastUpdated }: DataStatusIndicatorProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                status === 'fresh' && 'bg-theme-green',
                status === 'stale' && 'bg-theme-yellow',
                status === 'error' && 'bg-theme-red'
              )}
              aria-label={`Data status: ${status}`}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p>{formatLastUpdated(lastUpdated)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
