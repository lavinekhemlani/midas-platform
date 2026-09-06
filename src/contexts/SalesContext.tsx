'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { getDateRangeForPeriod } from '@/lib/report-utils'

interface SalesContextType {
  period: string
  dateRange: { start: string; end: string }
  setPeriod: (period: string) => void
  setDateRange: (range: { start: string; end: string }) => void
}

const SalesContext = createContext<SalesContextType | undefined>(undefined)

export function SalesProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState('last_year')
  const [dateRange, setDateRange] = useState(getDateRangeForPeriod('last_year'))

  return (
    <SalesContext.Provider value={{ period, dateRange, setPeriod, setDateRange }}>
      {children}
    </SalesContext.Provider>
  )
}

export function useSalesContext() {
  const context = useContext(SalesContext)
  if (!context) {
    throw new Error('useSalesContext must be used within SalesProvider')
  }
  return context
}
