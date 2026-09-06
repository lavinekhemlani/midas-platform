// src/app/(main)/reports/components/ReportContentGrid.tsx
'use client'

import { ReactNode } from 'react'

interface ReportContentGridProps {
  children: ReactNode
}

/**
 * Unified responsive grid layout for all report views
 * - Desktop (lg+): 3 columns × 2 rows
 * - Tablet (md): 2 columns × 3 rows
 * - Mobile: 1 column × 6 rows
 *
 * All cards are equal height within their row using auto-rows-fr
 */
export function ReportContentGrid({ children }: ReportContentGridProps) {
  return (
    <div className="w-full h-full p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
        {children}
      </div>
    </div>
  )
}
