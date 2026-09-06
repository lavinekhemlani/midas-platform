// src/app/(main)/reports/components/PeriodSelect.tsx
'use client'

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
import {
  PERIOD_OPTION_GROUPS,
  PERIOD_OPTIONS_COMPACT,
  type PeriodOption,
} from '@/lib/utils/dateRanges'

interface PeriodSelectProps {
  value: string
  onChange: (period: string) => void
  disabled?: boolean
  /** Use compact list instead of grouped options */
  compact?: boolean
  /** Custom options override */
  options?: PeriodOption[]
}

export function PeriodSelect({
  value,
  onChange,
  disabled = false,
  compact = false,
  options,
}: PeriodSelectProps) {
  // Use custom options if provided, otherwise use compact or grouped
  const useCompact = compact || !!options
  const flatOptions = options || PERIOD_OPTIONS_COMPACT

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full h-9 glass-luxury-card border-amber-500/20 hover:border-amber-500/40 transition-all duration-200 text-[14px]">
        <Calendar className="w-3.5 h-3.5 mr-2 text-amber-500" />
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent className="glass-luxury-card max-h-[400px]">
        {useCompact
          ? // Flat list for compact mode or custom options
            flatOptions.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="text-[14px] cursor-pointer"
              >
                {option.label}
              </SelectItem>
            ))
          : // Grouped options for full mode
            PERIOD_OPTION_GROUPS.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel className="text-[11px] uppercase tracking-wider text-amber-500/70 font-semibold px-2 py-1.5">
                  {group.label}
                </SelectLabel>
                {group.options.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-[14px] cursor-pointer pl-4"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
      </SelectContent>
    </Select>
  )
}
