// src/contexts/ReportsContext.tsx
'use client'

import { createContext, useContext } from 'react'

export type ReportView = 'summary' | 'pnl' | 'balance-sheet' | 'cash-flow'

export interface ReportsContextValue {
  // View state
  activeView: ReportView
  setActiveView: (view: ReportView) => void

  // Date state
  dateRange: { start: string; end: string }
  setDateRange: (range: { start: string; end: string }) => void

  period: string
  setPeriod: (period: string) => void

  // Display preferences
  showAccountNumbers: boolean
  setShowAccountNumbers: (show: boolean) => void

  // Metadata (from API responses)
  currency: string
  organizationName: string

  // Data freshness
  lastUpdated: Date | null
  isRefreshing: boolean
  dataStatus: 'fresh' | 'stale' | 'error'
  refresh: () => Promise<void>
}

export const ReportsContext = createContext<ReportsContextValue | undefined>(undefined)

export function useReportsContext() {
  const context = useContext(ReportsContext)
  if (!context) {
    throw new Error('useReportsContext must be used within ReportsProvider')
  }
  return context
}
