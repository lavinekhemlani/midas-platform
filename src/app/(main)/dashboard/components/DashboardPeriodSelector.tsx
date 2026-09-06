'use client'

import { useState } from 'react'
import { Calendar } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DateRangeInputs } from '@/app/(main)/qb/reports/components/DateRangeInputs'
import { PERIOD_OPTION_GROUPS } from '@/lib/utils/dateRanges'

interface DashboardPeriodSelectorProps {
  period: string
  onPeriodChange: (period: string) => void
  customStart: string
  customEnd: string
  onCustomStartChange: (date: string) => void
  onCustomEndChange: (date: string) => void
}

export function DashboardPeriodSelector({
  period,
  onPeriodChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: DashboardPeriodSelectorProps) {
  const [customOpen, setCustomOpen] = useState(false)

  const handlePeriodChange = (value: string) => {
    onPeriodChange(value)
    if (value === 'custom') {
      setCustomOpen(true)
    } else {
      setCustomOpen(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={period} onValueChange={handlePeriodChange}>
        <SelectTrigger className="h-8 w-[180px] glass-luxury-card border-amber-500/20 hover:border-amber-500/40 transition-all duration-200 text-xs">
          <Calendar className="w-3 h-3 mr-1.5 text-amber-500" />
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent className="glass-luxury-card max-h-[400px]">
          {PERIOD_OPTION_GROUPS.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel className="text-[10px] uppercase tracking-wider text-amber-500/70 font-semibold px-2 py-1">
                {group.label}
              </SelectLabel>
              {group.options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="text-xs cursor-pointer pl-3"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {period === 'custom' && (
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <button className="h-8 px-3 rounded-lg text-xs font-medium border border-amber-500/20 bg-amber-500/[0.06] hover:bg-amber-500/[0.12] hover:border-amber-500/40 transition-all duration-200 theme-text-secondary cursor-pointer">
              {customStart && customEnd
                ? `${formatShortDate(customStart)} - ${formatShortDate(customEnd)}`
                : 'Pick dates'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] glass-luxury-card p-4" align="end">
            <DateRangeInputs
              startDate={customStart}
              endDate={customEnd}
              onStartChange={onCustomStartChange}
              onEndChange={onCustomEndChange}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`
}
