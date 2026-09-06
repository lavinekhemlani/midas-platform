'use client'

import { Calendar, Users, Package, AlertCircle, LayoutDashboard } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { SalesTab } from '../../types'

const periodOptions = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
]

interface SalesHeaderProps {
  period: string
  dateRange: { start: string; end: string }
  activeTab: SalesTab
  outstandingCount: number
  onPeriodChange: (period: string) => void
  onTabChange: (tab: SalesTab) => void
}

export function SalesHeader({
  period,
  dateRange,
  activeTab,
  outstandingCount,
  onPeriodChange,
  onTabChange,
}: SalesHeaderProps) {
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
    <div className="space-y-4 border-b border-gray-200/10">
      {/* Top row: Title + Date selector */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-xl theme-text-secondary">
          Comprehensive sales analysis by customer and product
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm theme-text-secondary whitespace-nowrap">
            {formatDateRange()}
          </span>
          <Select value={period} onValueChange={onPeriodChange}>
            <SelectTrigger className="w-[160px] h-9 glass-luxury-card border-amber-500/20 hover:border-amber-500/40 transition-all duration-200 text-sm">
              <Calendar className="w-3.5 h-3.5 mr-2 text-amber-500" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent className="glass-luxury-card">
              {periodOptions.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="text-sm cursor-pointer"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs navigation */}
      <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as SalesTab)}>
        <TabsList className="grid w-full max-w-2xl grid-cols-4 bg-transparent gap-1 p-0">
          <TabsTrigger
            value="overview"
            className="flex items-center gap-2 text-sm font-medium theme-text-secondary transition-all hover:bg-white/5 data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 data-[state=active]:bg-transparent rounded-none pb-2"
          >
            <LayoutDashboard className="w-4 h-4 transition-all" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger
            value="customers"
            className="flex items-center gap-2 text-sm font-medium theme-text-secondary transition-all hover:bg-white/5 data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 data-[state=active]:bg-transparent rounded-none pb-2"
          >
            <Users className="w-4 h-4 transition-all" />
            <span className="hidden sm:inline">Customers</span>
          </TabsTrigger>
          <TabsTrigger
            value="products"
            className="flex items-center gap-2 text-sm font-medium theme-text-secondary transition-all hover:bg-white/5 data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 data-[state=active]:bg-transparent rounded-none pb-2"
          >
            <Package className="w-4 h-4 transition-all" />
            <span className="hidden sm:inline">Products</span>
          </TabsTrigger>
          <TabsTrigger
            value="outstanding"
            className="flex items-center gap-2 relative text-sm font-medium theme-text-secondary transition-all hover:bg-white/5 data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 data-[state=active]:bg-transparent rounded-none pb-2"
          >
            <AlertCircle className="w-4 h-4 transition-all" />
            <span className="hidden sm:inline">Outstanding</span>
            {outstandingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {outstandingCount > 99 ? '99+' : outstandingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
