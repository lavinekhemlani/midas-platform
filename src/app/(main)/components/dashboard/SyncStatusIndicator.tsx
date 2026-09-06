// app/(main)/components/SyncStatusIndicator.tsx
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface SyncStatusIndicatorProps {
  lastSync: number // Unix timestamp
  className?: string
}

export default function SyncStatusIndicator({ lastSync, className }: SyncStatusIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState<'right' | 'left'>('right')

  // Calculate time since last sync
  const now = Date.now() / 1000
  const timeSinceSync = now - lastSync
  
  // Determine status and color
  const getStatus = () => {
    if (timeSinceSync <= 1800) { // 30 minutes
      return {
        color: 'bg-emerald-400',
        status: 'current',
        label: 'Data Current'
      }
    } else if (timeSinceSync <= 3600) { // 1 hour
      return {
        color: 'bg-amber-400',
        status: 'warning',
        label: 'Sync Needed'
      }
    } else {
      return {
        color: 'bg-red-400',
        status: 'critical',
        label: 'Data Stale'
      }
    }
  }

  const statusInfo = getStatus()

  // Check if tooltip would go off screen and adjust position
  const handleMouseEnter = () => {
    const viewportWidth = window.innerWidth
    const elementRect = document.querySelector('.sync-status-container')?.getBoundingClientRect()
    
    if (elementRect) {
      // If there's not enough space on the right (tooltip width ~256px + margin)
      if (elementRect.right + 280 > viewportWidth) {
        setTooltipPosition('left')
      } else {
        setTooltipPosition('right')
      }
    }
    
    setShowTooltip(true)
  }

  // Format time since last sync
  const formatTimeSince = (seconds: number) => {
    if (seconds < 60) return `${Math.floor(seconds)}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  // Format last sync time
  const formatLastSync = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  // Calculate next scheduled update (assuming 30-minute intervals)
  const nextUpdateTime = Math.ceil((lastSync + 1800) / 1800) * 1800
  const formatNextUpdate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <div 
      className={cn("relative sync-status-container", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Glowing status indicator */}
      <div className="relative flex items-center justify-center">
        {/* Outer glow ring */}
        <div 
          className={cn(
            "absolute w-4 h-4 rounded-full opacity-30 animate-ping",
            statusInfo.color
          )}
        />
        
        {/* Inner solid dot */}
        <div 
          className={cn(
            "w-3 h-3 rounded-full shadow-sm",
            statusInfo.color,
            statusInfo.status === 'current' && "shadow-emerald-400/50",
            statusInfo.status === 'warning' && "shadow-amber-400/50",
            statusInfo.status === 'critical' && "shadow-red-400/50"
          )}
        />
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 w-64 p-3 glass-luxury-card border border-amber-500/20 rounded-lg shadow-xl z-50",
          tooltipPosition === 'right' ? "left-full ml-3" : "right-full mr-3"
        )}>
          <div className="space-y-2">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium theme-text-secondary">Status</span>
              <span className={cn(
                "text-xs font-semibold",
                statusInfo.status === 'current' && "text-emerald-400",
                statusInfo.status === 'warning' && "text-amber-400",
                statusInfo.status === 'critical' && "text-red-400"
              )}>
                {statusInfo.label}
              </span>
            </div>

            {/* Last update */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium theme-text-secondary">Last Update</span>
              <span className="text-xs theme-text-primary">
                {formatLastSync(lastSync)}
              </span>
            </div>

            {/* Age of data */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium theme-text-secondary">Data Age</span>
              <span className="text-xs theme-text-primary">
                {formatTimeSince(timeSinceSync)}
              </span>
            </div>

            {/* Next update */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium theme-text-secondary">Next Update</span>
              <span className="text-xs theme-text-primary">
                {nextUpdateTime > now ? formatNextUpdate(nextUpdateTime) : 'Soon'}
              </span>
            </div>

            {/* Additional info based on status */}
            {statusInfo.status !== 'current' && (
              <div className="pt-2 mt-2 border-t border-amber-500/10">
                <p className="text-xs theme-text-secondary">
                  {statusInfo.status === 'warning' 
                    ? 'Data refresh in progress or scheduled soon'
                    : 'Manual refresh recommended'
                  }
                </p>
              </div>
            )}
          </div>

          {/* Tooltip arrow - positioned at left side, pointing left */}
          {tooltipPosition === 'right' ? (
            <div className="absolute top-1/2 left-0 -translate-y-1/2 -ml-1 w-0 h-0 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-amber-500"></div>
          ) : (
            <div className="absolute top-1/2 right-0 -translate-y-1/2 -mr-1 w-0 h-0 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-amber-500"></div>
          )}
        </div>
      )}
    </div>
  )
}