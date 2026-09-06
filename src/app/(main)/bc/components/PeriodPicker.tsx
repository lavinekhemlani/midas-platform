'use client'

import { useState, useCallback, useMemo } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  PERIOD_OPTION_GROUPS,
  PERIOD_OPTIONS,
  formatDate,
  getDateRangeForPeriod,
} from '@/lib/utils/dateRanges'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'

interface PeriodPickerProps {
  selectedPeriod: string
  onPeriodChange: (period: string) => void
  customStartDate: string
  customEndDate: string
  onCustomStartDateChange: (date: string) => void
  onCustomEndDateChange: (date: string) => void
  disabled?: boolean
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function PeriodPicker({
  selectedPeriod,
  onPeriodChange,
  customStartDate,
  customEndDate,
  onCustomStartDateChange,
  onCustomEndDateChange,
  disabled,
}: PeriodPickerProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [open, setOpen] = useState(false)

  const displayLabel =
    selectedPeriod === 'custom'
      ? 'Custom Range'
      : PERIOD_OPTIONS.find((o) => o.value === selectedPeriod)?.label || 'Select period'

  const dateRange = useMemo(() => {
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      return { start: customStartDate, end: customEndDate }
    }
    return getDateRangeForPeriod(selectedPeriod)
  }, [selectedPeriod, customStartDate, customEndDate])

  const handleOptionClick = useCallback(
    (value: string) => {
      onPeriodChange(value)
      if (value !== 'custom') {
        setOpen(false)
      }
    },
    [onPeriodChange]
  )

  return (
    <div className="flex items-center gap-3">
      {dateRange.start && dateRange.end && (
        <span className="hidden sm:flex items-center gap-2 text-sm theme-text-secondary">
          <span className="font-serif italic text-[0.9rem] theme-text-primary">from</span>
          <span>{fmtDate(dateRange.start)}</span>
          <span className="font-serif italic text-[0.9rem] theme-text-primary">to</span>
          <span>{fmtDate(dateRange.end)}</span>
        </span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            disabled={disabled}
            className="flex items-center h-9 px-3 rounded-[1px] glass-luxury-card border border-amber-500/20 hover:border-amber-500/40 transition-all duration-200 text-sm theme-text-primary disabled:opacity-50"
          >
            <Calendar className="w-3.5 h-3.5 mr-2 text-amber-500" />
            <span className="whitespace-nowrap">{displayLabel}</span>
            <ChevronDown className="w-3.5 h-3.5 ml-2 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="!w-[380px] !z-[60] p-0" sideOffset={8}>
          {selectedPeriod === 'custom' && (
            <div
              className={cn(
                'px-3 py-3 space-y-2',
                isLight ? 'border-b border-stone-200' : 'border-b border-white/[0.08]'
              )}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label
                    className={cn(
                      'text-[11px] uppercase tracking-wider font-semibold mb-1 block',
                      isLight ? 'text-stone-500' : 'text-stone-400'
                    )}
                  >
                    From
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => onCustomStartDateChange(e.target.value)}
                    className={cn(
                      'w-full h-8 px-2 text-[13px] rounded border outline-none transition-colors',
                      isLight
                        ? 'bg-white border-stone-300 text-stone-900 focus:border-amber-500'
                        : 'bg-white/[0.05] border-white/[0.12] text-white focus:border-amber-500'
                    )}
                  />
                </div>
                <div className="flex-1">
                  <label
                    className={cn(
                      'text-[11px] uppercase tracking-wider font-semibold mb-1 block',
                      isLight ? 'text-stone-500' : 'text-stone-400'
                    )}
                  >
                    To
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => onCustomEndDateChange(e.target.value)}
                    max={formatDate(new Date())}
                    className={cn(
                      'w-full h-8 px-2 text-[13px] rounded border outline-none transition-colors',
                      isLight
                        ? 'bg-white border-stone-300 text-stone-900 focus:border-amber-500'
                        : 'bg-white/[0.05] border-white/[0.12] text-white focus:border-amber-500'
                    )}
                  />
                </div>
              </div>
              {customStartDate && customEndDate && (
                <button
                  onClick={() => setOpen(false)}
                  className={cn(
                    'w-full h-7 text-[12px] font-medium rounded transition-colors',
                    isLight
                      ? 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20'
                      : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                  )}
                >
                  Apply
                </button>
              )}
            </div>
          )}
          <div className="flex">
            <div
              className={cn(
                'px-2 py-1.5 space-y-3',
                isLight ? 'border-r border-stone-200' : 'border-r border-white/[0.08]'
              )}
            >
              {PERIOD_OPTION_GROUPS.slice(0, 3).map((group) => (
                <div key={group.label}>
                  <div
                    className={cn(
                      'text-[12px] uppercase tracking-wider font-semibold px-1.5 py-0.5',
                      isLight ? 'text-amber-500/70' : 'text-amber-400'
                    )}
                  >
                    {group.label}
                  </div>
                  {group.options.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleOptionClick(option.value)}
                      className={cn(
                        'w-full text-left text-[14px] px-1.5 py-1 transition-colors whitespace-nowrap',
                        selectedPeriod === option.value
                          ? isLight
                            ? 'bg-amber-500/10 text-amber-600 font-medium'
                            : 'bg-amber-500/15 text-amber-400 font-medium'
                          : isLight
                            ? 'text-stone-600 hover:text-stone-900'
                            : 'text-stone-300 hover:text-white',
                        selectedPeriod !== option.value &&
                          (isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.05]')
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="px-2 py-1.5 space-y-3">
              {PERIOD_OPTION_GROUPS.slice(3).map((group) => (
                <div key={group.label}>
                  <div
                    className={cn(
                      'text-[12px] uppercase tracking-wider font-semibold px-1.5 py-0.5',
                      isLight ? 'text-amber-500/70' : 'text-amber-400'
                    )}
                  >
                    {group.label}
                  </div>
                  {group.options.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleOptionClick(option.value)}
                      className={cn(
                        'w-full text-left text-[14px] px-1.5 py-1 transition-colors whitespace-nowrap',
                        selectedPeriod === option.value
                          ? isLight
                            ? 'bg-amber-500/10 text-amber-600 font-medium'
                            : 'bg-amber-500/15 text-amber-400 font-medium'
                          : isLight
                            ? 'text-stone-600 hover:text-stone-900'
                            : 'text-stone-300 hover:text-white',
                        selectedPeriod !== option.value &&
                          (isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.05]')
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
