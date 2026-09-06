// src/app/(main)/reports/components/DateRangeInputs.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'

interface DateRangeInputsProps {
  startDate: string  // YYYY-MM-DD format
  endDate: string    // YYYY-MM-DD format
  onStartChange: (date: string) => void
  onEndChange: (date: string) => void
  disabled?: boolean
  compact?: boolean
}

export function DateRangeInputs({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  disabled = false,
  compact = false,
}: DateRangeInputsProps) {
  const [startOpen, setStartOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)

  // Convert YYYY-MM-DD to Date object
  const startDateObj = startDate ? new Date(startDate + 'T00:00:00') : undefined
  const endDateObj = endDate ? new Date(endDate + 'T00:00:00') : undefined

  const handleStartSelect = (date: Date | undefined) => {
    if (date) {
      // Convert Date to YYYY-MM-DD format
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const isoDate = `${year}-${month}-${day}`

      // Validate that start date is before or equal to end date
      if (endDate && isoDate <= endDate) {
        onStartChange(isoDate)
        setStartOpen(false)
      } else if (!endDate) {
        onStartChange(isoDate)
        setStartOpen(false)
      }
    }
  }

  const handleEndSelect = (date: Date | undefined) => {
    if (date) {
      // Convert Date to YYYY-MM-DD format
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const isoDate = `${year}-${month}-${day}`

      // Validate that end date is after or equal to start date
      if (startDate && isoDate >= startDate) {
        onEndChange(isoDate)
        setEndOpen(false)
      } else if (!startDate) {
        onEndChange(isoDate)
        setEndOpen(false)
      }
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3 w-full">
        <span className="font-serif italic text-[0.9rem] theme-text-primary flex-shrink-0">from</span>
        {/* From Date - compact */}
        <Popover open={startOpen} onOpenChange={setStartOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={disabled}
              className={cn(
                'group date-trigger h-8 w-[120px] flex-shrink-0 justify-start text-left text-[14px] font-normal bg-transparent border-0 border-b border-gray-500/30 rounded-none shadow-none !px-1 hover:bg-transparent hover:text-inherit',
                !startDateObj && 'theme-text-secondary'
              )}
              style={{ color: startDateObj ? 'var(--theme-text-primary)' : '#6b7280' }}
            >
              <CalendarIcon className="mr-0.5 h-3 w-3 flex-shrink-0 calendar-glow" style={{ color: 'var(--theme-yellow)' }} />
              <span className="truncate group-hover:font-semibold transition-all duration-200">
                {startDateObj ? format(startDateObj, 'MMM dd, yyyy') : 'Pick a date'}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDateObj}
              onSelect={handleStartSelect}
              disabled={(date) => {
                const today = new Date()
                today.setHours(23, 59, 59, 999)
                if (date > today) return true
                if (endDateObj && date > endDateObj) return true
                return false
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <span className="font-serif italic text-[0.9rem] theme-text-primary flex-shrink-0 ml-2">to</span>

        {/* To Date - compact */}
        <Popover open={endOpen} onOpenChange={setEndOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={disabled}
              className={cn(
                'group date-trigger h-8 w-[120px] flex-shrink-0 justify-start text-left text-[14px] font-normal bg-transparent border-0 border-b border-gray-500/30 rounded-none shadow-none !px-1 hover:bg-transparent hover:text-inherit',
                !endDateObj && 'theme-text-secondary'
              )}
              style={{ color: endDateObj ? 'var(--theme-text-primary)' : '#6b7280' }}
            >
              <CalendarIcon className="mr-0.5 h-3 w-3 flex-shrink-0 calendar-glow" style={{ color: 'var(--theme-yellow)' }} />
              <span className="truncate group-hover:font-semibold transition-all duration-200">
                {endDateObj ? format(endDateObj, 'MMM dd, yyyy') : 'Pick a date'}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={endDateObj}
              onSelect={handleEndSelect}
              disabled={(date) => {
                const today = new Date()
                today.setHours(23, 59, 59, 999)
                if (date > today) return true
                if (startDateObj && date < startDateObj) return true
                return false
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* From Date */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-wide theme-text-secondary font-semibold">
          From
        </label>
        <Popover open={startOpen} onOpenChange={setStartOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={disabled}
              className={cn(
                'group date-trigger w-full h-9 justify-start text-left font-normal glass-morphism border-amber-500/30',
                !startDateObj && 'theme-text-secondary'
              )}
              style={{
                backgroundColor: 'var(--theme-bg)',
                color: 'var(--theme-text-primary)',
              }}
            >
              <CalendarIcon className="mr-2 h-4 w-4 calendar-glow" style={{ color: 'var(--theme-yellow)' }} />
              <span className="group-hover:font-semibold transition-all duration-200">
                {startDateObj ? format(startDateObj, 'MMM dd, yyyy') : 'Pick a date'}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDateObj}
              onSelect={handleStartSelect}
              disabled={(date) => {
                const today = new Date()
                today.setHours(23, 59, 59, 999)
                // Disable future dates and dates after end date
                if (date > today) return true
                if (endDateObj && date > endDateObj) return true
                return false
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* To Date */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-wide theme-text-secondary font-semibold">
          To
        </label>
        <Popover open={endOpen} onOpenChange={setEndOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={disabled}
              className={cn(
                'group date-trigger w-full h-9 justify-start text-left font-normal glass-morphism border-amber-500/30',
                !endDateObj && 'theme-text-secondary'
              )}
              style={{
                backgroundColor: 'var(--theme-bg)',
                color: 'var(--theme-text-primary)',
              }}
            >
              <CalendarIcon className="mr-2 h-4 w-4 calendar-glow" style={{ color: 'var(--theme-yellow)' }} />
              <span className="group-hover:font-semibold transition-all duration-200">
                {endDateObj ? format(endDateObj, 'MMM dd, yyyy') : 'Pick a date'}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDateObj}
              onSelect={handleEndSelect}
              disabled={(date) => {
                const today = new Date()
                today.setHours(23, 59, 59, 999)
                // Disable future dates and dates before start date
                if (date > today) return true
                if (startDateObj && date < startDateObj) return true
                return false
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
