// src/app/(main)/reports/components/ReportsTopBar.tsx
'use client'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useReportsContext } from '@/contexts/ReportsContext'
import { getDateRangeForPeriod } from '@/lib/report-utils'
import { format } from 'date-fns'
import { Info, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { DateRangeInputs } from './DateRangeInputs'
import { PeriodSelect } from './PeriodSelect'

export function ReportsTopBar() {
  const { period, setPeriod, dateRange, setDateRange, isRefreshing, refresh } = useReportsContext()

  // Track pending custom date changes
  const [pendingDateRange, setPendingDateRange] = useState<{ start: string; end: string } | null>(
    null
  )

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)

    // Only update date range if not custom
    if (newPeriod !== 'custom') {
      const range = getDateRangeForPeriod(newPeriod)
      setDateRange(range)
      setPendingDateRange(null) // Clear any pending changes
      // Auto-refresh for preset periods
      setTimeout(() => refresh(), 0)
    } else {
      // Seed pending range from current dates so the inputs aren't empty
      setPendingDateRange({ start: dateRange.start, end: dateRange.end })
    }
  }

  const handleStartDateChange = (newStart: string) => {
    // Store pending change, don't update context yet
    const newRange = { start: newStart, end: pendingDateRange?.end || dateRange.end }
    setPendingDateRange(newRange)
    setPeriod('custom')
  }

  const handleEndDateChange = (newEnd: string) => {
    // Store pending change, don't update context yet
    const newRange = { start: pendingDateRange?.start || dateRange.start, end: newEnd }
    setPendingDateRange(newRange)
    setPeriod('custom')
  }

  const handleApply = () => {
    // Apply pending changes and refresh
    if (pendingDateRange) {
      setDateRange(pendingDateRange)
      setPendingDateRange(null)
    }
    refresh()
  }

  // Determine which date range to display
  const displayDateRange = pendingDateRange || dateRange

  const isCustom = period === 'custom'

  // Format dates for the info popup
  const formatInfoDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr + 'T00:00:00'), 'MMM dd, yyyy')
    } catch {
      return dateStr
    }
  }

  return (
    <div className="p-3 flex-shrink-0 space-y-2.5">
      {/* Period Selector + Info */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0">
          <PeriodSelect value={period} onChange={handlePeriodChange} disabled={isRefreshing} />
        </div>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex-shrink-0 p-1.5 rounded-md text-amber-500/60 hover:text-amber-500 hover:bg-amber-500/10 transition-colors">
                <Info className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="end"
              className="w-52 p-3 glass-luxury-card border-amber-500/20 text-xs"
            >
              <p className="font-semibold theme-text-primary mb-2">Data Range</p>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="theme-text-secondary">From</span>
                  <span className="theme-text-primary font-medium">
                    {formatInfoDate(displayDateRange.start)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="theme-text-secondary">To</span>
                  <span className="theme-text-primary font-medium">
                    {formatInfoDate(displayDateRange.end)}
                  </span>
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-gray-200/10">
                <p className="theme-text-secondary leading-relaxed">
                  QuickBooks data is available from the date your account was created.
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Inline Date Inputs - only when Custom is selected */}
      {isCustom && (
        <div className="flex items-center gap-1.5">
          <DateRangeInputs
            startDate={displayDateRange.start}
            endDate={displayDateRange.end}
            onStartChange={handleStartDateChange}
            onEndChange={handleEndDateChange}
            disabled={isRefreshing}
            compact
          />
        </div>
      )}

      {/* Apply/Refresh Button */}
      <div className="w-full">
        <Button
          onClick={handleApply}
          disabled={isRefreshing}
          className="w-full h-9 border border-amber-500/70 bg-transparent text-amber-500 hover:border-amber-500 hover:bg-transparent font-semibold"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Apply'}
        </Button>
      </div>
    </div>
  )
}
