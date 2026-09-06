'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ReportGridProps {
  children: ReactNode
  className?: string
  columns?: 1 | 2 | 3 | 4 | 6 | 12
  gap?: 'sm' | 'md' | 'lg' | 'xl'
}

export function ReportGrid({
  children,
  className,
  columns = 12,
  gap = 'md'
}: ReportGridProps) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8'
  }

  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 @md:grid-cols-2',
    3: 'grid-cols-1 @md:grid-cols-2 @lg:grid-cols-3',
    4: 'grid-cols-1 @md:grid-cols-2 @lg:grid-cols-4',
    6: 'grid-cols-1 @md:grid-cols-3 @lg:grid-cols-6',
    12: 'grid-cols-12'
  }

  return (
    <div className={cn(
      'grid',
      columnClasses[columns],
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  )
}

interface ReportGridItemProps {
  children: ReactNode
  className?: string
  colSpan?: 1 | 2 | 3 | 4 | 6 | 12 | 'full'
  rowSpan?: 1 | 2 | 3 | 4
}

export function ReportGridItem({
  children,
  className,
  colSpan = 1,
  rowSpan = 1
}: ReportGridItemProps) {
  const colSpanClasses = {
    1: 'col-span-1',
    2: 'col-span-2',
    3: 'col-span-3',
    4: 'col-span-4',
    6: 'col-span-6',
    12: 'col-span-12',
    'full': 'col-span-full'
  }

  const rowSpanClasses = {
    1: 'row-span-1',
    2: 'row-span-2',
    3: 'row-span-3',
    4: 'row-span-4'
  }

  return (
    <div className={cn(
      colSpanClasses[colSpan],
      rowSpanClasses[rowSpan],
      className
    )}>
      {children}
    </div>
  )
}