// src/app/(main)/reports/components/ReportsBottomBar.tsx
'use client'

import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReportsContext } from '@/contexts/ReportsContext'
import { cn } from '@/lib/utils'
import { formatLastUpdated } from '@/lib/report-utils'

export function ReportsBottomBar() {
  const { dataStatus, lastUpdated, isRefreshing, refresh } = useReportsContext()

  return (
    <div className="space-y-3">
      {/* Status indicator + Last updated + Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-3 h-3 rounded-full',
              dataStatus === 'fresh' && 'bg-theme-green',
              dataStatus === 'stale' && 'bg-theme-yellow',
              dataStatus === 'error' && 'bg-theme-red'
            )}
            aria-label={`Data status: ${dataStatus}`}
          />
          <span className="text-xs theme-text-secondary">
            {lastUpdated ? `Last synced: ${formatLastUpdated(lastUpdated)}` : 'Never synced'}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={refresh}
          disabled={isRefreshing}
          className="w-8 h-8 theme-text-secondary hover:theme-text-primary hover:bg-gray-800/50"
          title="Refresh data"
        >
          <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  )
}
