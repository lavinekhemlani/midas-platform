'use client'

import { createContext, useContext, useState, useMemo, type ReactNode } from 'react'
import { getDateRangeForPeriod } from '@/lib/utils/dateRanges'

interface ShopifyDateContextValue {
  selectedPeriod: string
  setSelectedPeriod: (period: string) => void
  customStartDate: string
  setCustomStartDate: (date: string) => void
  customEndDate: string
  setCustomEndDate: (date: string) => void
  dateRange: { startDate: string; endDate: string } | undefined
}

const ShopifyDateContext = createContext<ShopifyDateContextValue | null>(null)

export function ShopifyDateProvider({ children }: { children: ReactNode }) {
  const [selectedPeriod, setSelectedPeriod] = useState('last_30_days')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const dateRange = useMemo(() => {
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate }
    }
    if (selectedPeriod === 'all_dates') return undefined
    const range = getDateRangeForPeriod(selectedPeriod)
    return { startDate: range.start, endDate: range.end }
  }, [selectedPeriod, customStartDate, customEndDate])

  return (
    <ShopifyDateContext.Provider
      value={{
        selectedPeriod,
        setSelectedPeriod,
        customStartDate,
        setCustomStartDate,
        customEndDate,
        setCustomEndDate,
        dateRange,
      }}
    >
      {children}
    </ShopifyDateContext.Provider>
  )
}

export function useShopifyDateRange() {
  const ctx = useContext(ShopifyDateContext)
  if (!ctx) {
    throw new Error('useShopifyDateRange must be used within a ShopifyDateProvider')
  }
  return ctx
}
