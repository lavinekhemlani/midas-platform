'use client'

import { HelpCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface SortableTableHeaderProps<T extends string> {
  label: string
  sortKey: T
  currentSortBy: T
  currentSortOrder: 'asc' | 'desc'
  onSort: (key: T) => void
  align?: 'left' | 'right' | 'center'
  tooltip?: string
  className?: string
}

export function SortableTableHeader<T extends string>({
  label,
  sortKey,
  currentSortBy,
  currentSortOrder,
  onSort,
  align = 'left',
  tooltip,
  className = '',
}: SortableTableHeaderProps<T>) {
  const isActive = currentSortBy === sortKey
  const alignClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''

  return (
    <th
      className={`px-6 py-4 text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-50 cursor-pointer hover:text-amber-900 dark:hover:text-white transition-colors whitespace-nowrap ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${alignClass}`}>
        {tooltip ? (
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  {label}
                  <HelpCircle className="w-3 h-3 text-amber-800 dark:text-amber-200 opacity-60" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          label
        )}
        {isActive && <span>{currentSortOrder === 'asc' ? '↑' : '↓'}</span>}
      </div>
    </th>
  )
}
