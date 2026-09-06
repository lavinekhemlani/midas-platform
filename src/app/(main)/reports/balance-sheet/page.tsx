'use client'

import { Calendar } from 'lucide-react'
import { useReportsContext } from '@/contexts/ReportsContext'
import { BalanceSheetView } from '../views/BalanceSheetView'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getDateRangeForPeriod } from '@/lib/report-utils'

const periodOptions = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
]

export default function BalanceSheetPage() {
  const { period, dateRange, setPeriod, setDateRange } = useReportsContext()

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
    const range = getDateRangeForPeriod(newPeriod)
    setDateRange(range)
  }

  const formatDateRange = () => {
    if (!dateRange.start || !dateRange.end) return null
    const start = new Date(dateRange.start).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    const end = new Date(dateRange.end).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    return (
      <span className="flex items-center gap-2">
        <span className="font-serif italic text-[0.9rem] theme-text-primary">from</span>
        <span>{start}</span>
        <span className="font-serif italic text-[0.9rem] theme-text-primary">to</span>
        <span>{end}</span>
      </span>
    )
  }

  return (
    <div className="@container space-y-4">
      {/* Subheading + Time Period Selector */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-xl theme-text-secondary">Assets, liabilities, and equity</span>
        <div className="flex items-center gap-3">
          <span className="text-sm theme-text-secondary whitespace-nowrap">
            {formatDateRange()}
          </span>
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[160px] h-9 glass-luxury-card border-amber-500/20 hover:border-amber-500/40 transition-all duration-200 text-sm">
              <Calendar className="w-3.5 h-3.5 mr-2 text-amber-500" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent className="glass-luxury-card">
              {periodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <BalanceSheetView />
    </div>
  )
}
