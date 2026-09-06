// AlertsContext - Client-side threshold-based metric alerts
// This context aggregates data from various hooks and generates alerts
'use client'

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { MetricAlert, AlertCategory } from '@/lib/types/metric-alert'
import { useCombinedAlerts } from '@/hooks/useMetricAlerts'
import { useUnpaidBills } from '@/hooks/useUnpaidBills'
import { useOutstandingPayments } from '@/hooks/useOutstandingPayments'
import { useMultiCompanyAlerts, parseQBCompanies } from '@/hooks/useMultiCompanyAlerts'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useSession } from '@/hooks/useSession'
import { logger } from '@/lib/logger'

const STORAGE_KEY = 'midas_dismissed_alerts'
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

interface DismissedAlert {
  alertId: string
  dismissedAt: number
  dismissUntil: number
}

interface CompanyInfo {
  realmId: string
  companyName: string
}

interface AlertsContextType {
  // Alert data
  alerts: MetricAlert[]
  activeAlerts: MetricAlert[] // Excludes dismissed alerts
  unreadCount: number

  // Multi-company support
  alertsByCompany: Map<string, MetricAlert[]>
  companies: CompanyInfo[]
  hasMultipleCompanies: boolean

  // Loading states
  isLoading: boolean

  // Actions
  dismissAlert: (alertId: string, duration?: number) => void
  dismissAllAlerts: () => void
  clearDismissed: () => void

  // Filter by category
  getAlertsByCategory: (category: AlertCategory) => MetricAlert[]

  // For debugging/display
  lastChecked: Date | null
}

const AlertsContext = createContext<AlertsContextType | null>(null)

export function useAlerts() {
  const context = useContext(AlertsContext)
  if (!context) {
    throw new Error('useAlerts must be used within AlertsProvider')
  }
  return context
}

// Optional hook that doesn't throw
export function useAlertsOptional() {
  return useContext(AlertsContext)
}

interface AlertsProviderProps {
  children: React.ReactNode
  // Optional: provide date range for data fetching
  startDate?: string
  endDate?: string
  // Multi-company support
  providerEntities?: Record<string, string>
}

export function AlertsProvider({
  children,
  startDate,
  endDate,
  providerEntities = {},
}: AlertsProviderProps) {
  const { organization } = useSession()
  const { currency } = useCurrency()

  // State for dismissed alerts (persisted to localStorage)
  const [dismissedAlerts, setDismissedAlerts] = useState<DismissedAlert[]>([])
  const lastCheckedRef = useRef<Date | null>(null)

  // Calculate default date range if not provided (last 30 days)
  const defaultEndDate = new Date().toISOString().split('T')[0]

  const defaultStartDate = (() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })()

  const effectiveStartDate = startDate || defaultStartDate
  const effectiveEndDate = endDate || defaultEndDate

  // Parse companies from providerEntities
  const companies = useMemo(() => parseQBCompanies(providerEntities), [providerEntities])
  const hasMultipleCompanies = companies.length > 1

  // Use multi-company alerts if multiple companies are connected
  const multiCompanyAlerts = useMultiCompanyAlerts(
    providerEntities,
    effectiveStartDate,
    effectiveEndDate
  )

  // Fallback to single company alerts for backward compatibility
  const { unpaidBillsData, isLoading: billsLoading } = useUnpaidBills(
    effectiveStartDate,
    effectiveEndDate,
    organization?.organization_id
  )

  const { outstandingData, isLoading: paymentsLoading } = useOutstandingPayments(
    effectiveStartDate,
    effectiveEndDate
  )

  // Generate single-company alerts as fallback
  const singleCompanyAlerts = useCombinedAlerts(
    unpaidBillsData,
    outstandingData,
    undefined, // Financial metrics - can be added later
    currency
  )

  // Use multi-company alerts if available, otherwise fall back to single company
  const alerts = hasMultipleCompanies ? multiCompanyAlerts.alerts : singleCompanyAlerts
  const alertsByCompany = hasMultipleCompanies
    ? multiCompanyAlerts.alertsByCompany
    : new Map<string, MetricAlert[]>()

  const isLoading = hasMultipleCompanies
    ? multiCompanyAlerts.isLoading
    : billsLoading || paymentsLoading

  // Load dismissed alerts from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed: DismissedAlert[] = JSON.parse(stored)
        // Filter out expired dismissals
        const now = Date.now()
        const valid = parsed.filter((d) => d.dismissUntil > now)
        setDismissedAlerts(valid)

        // Clean up expired ones from storage
        if (valid.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(valid))
        }
      }
    } catch (error) {
      logger.error('Error loading dismissed alerts', { error, component: 'AlertsContext' })
    }
  }, [])

  // Track last checked timestamp — update ref during render (no extra re-render needed)
  if (!isLoading && (unpaidBillsData || outstandingData)) {
    lastCheckedRef.current = new Date()
  }

  // Filter out dismissed alerts
  const activeAlerts = useMemo(() => {
    const now = Date.now()
    const dismissedIds = new Set(
      dismissedAlerts.filter((d) => d.dismissUntil > now).map((d) => d.alertId)
    )
    return alerts.filter((alert) => !dismissedIds.has(alert.id))
  }, [alerts, dismissedAlerts])

  // Dismiss an alert
  const dismissAlert = useCallback((alertId: string, duration: number = DISMISS_DURATION_MS) => {
    const now = Date.now()
    const newDismissal: DismissedAlert = {
      alertId,
      dismissedAt: now,
      dismissUntil: now + duration,
    }

    setDismissedAlerts((prev) => {
      // Remove any existing dismissal for this alert
      const filtered = prev.filter((d) => d.alertId !== alertId)
      const updated = [...filtered, newDismissal]

      // Persist to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch (error) {
        logger.error('Error saving dismissed alerts', { error, component: 'AlertsContext' })
      }

      return updated
    })
  }, [])

  // Dismiss all current alerts
  const dismissAllAlerts = useCallback(() => {
    const now = Date.now()
    const newDismissals: DismissedAlert[] = alerts.map((alert) => ({
      alertId: alert.id,
      dismissedAt: now,
      dismissUntil: now + DISMISS_DURATION_MS,
    }))

    setDismissedAlerts((prev) => {
      // Merge with existing dismissals
      const existingIds = new Set(newDismissals.map((d) => d.alertId))
      const filtered = prev.filter((d) => !existingIds.has(d.alertId))
      const updated = [...filtered, ...newDismissals]

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch (error) {
        logger.error('Error saving dismissed alerts', { error, component: 'AlertsContext' })
      }

      return updated
    })
  }, [alerts])

  // Clear all dismissed alerts
  const clearDismissed = useCallback(() => {
    setDismissedAlerts([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      logger.error('Error clearing dismissed alerts', { error, component: 'AlertsContext' })
    }
  }, [])

  // Get alerts by category
  const getAlertsByCategory = useCallback(
    (category: AlertCategory) => {
      return activeAlerts.filter((alert) => alert.category === category)
    },
    [activeAlerts]
  )

  // Filter alertsByCompany to exclude dismissed alerts
  const activeAlertsByCompany = useMemo(() => {
    const now = Date.now()
    const dismissedIds = new Set(
      dismissedAlerts.filter((d) => d.dismissUntil > now).map((d) => d.alertId)
    )
    const filtered = new Map<string, MetricAlert[]>()
    alertsByCompany.forEach((companyAlerts, companyId) => {
      const active = companyAlerts.filter((alert) => !dismissedIds.has(alert.id))
      if (active.length > 0) {
        filtered.set(companyId, active)
      }
    })
    return filtered
  }, [alertsByCompany, dismissedAlerts])

  const value: AlertsContextType = {
    alerts,
    activeAlerts,
    unreadCount: activeAlerts.length,
    alertsByCompany: activeAlertsByCompany,
    companies,
    hasMultipleCompanies,
    isLoading,
    dismissAlert,
    dismissAllAlerts,
    clearDismissed,
    getAlertsByCategory,
    lastChecked: lastCheckedRef.current,
  }

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
}
