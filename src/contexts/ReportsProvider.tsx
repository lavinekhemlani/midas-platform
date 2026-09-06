// src/contexts/ReportsProvider.tsx
'use client'

import { ReactNode, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { SWRConfig, mutate } from 'swr'
import { ReportsContext, ReportView } from './ReportsContext'
import { getDateRangeForPeriod, getAsOfDateForPeriod } from '@/lib/report-utils'
import { toast } from 'sonner'
import { useCurrency } from './CurrencyContext'
import { useSession } from '@/hooks/useSession'
import { logger } from '@/lib/logger'

interface ReportsProviderProps {
  children: ReactNode
}

export function ReportsProvider({ children }: ReportsProviderProps) {
  const searchParams = useSearchParams()
  const { refetchSession } = useSession()
  // Track if we've already handled a provider error to prevent duplicate handling
  const providerErrorHandledRef = useRef(false)

  // Get currency from CurrencyContext (which gets it from org data)
  const { currency } = useCurrency()

  // State - Initialize from localStorage, then URL, then defaults
  const [activeView, setActiveView] = useState<ReportView>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('zenith_reports_period')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (parsed.view) return parsed.view
        } catch {
          /* ignore */
        }
      }
    }
    return 'summary'
  })
  const [period, setPeriod] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('zenith_reports_period')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (parsed.period) return parsed.period as string
        } catch {
          /* ignore */
        }
      }
    }
    return 'last_year'
  })
  const [dateRange, setDateRange] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('zenith_reports_period')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (parsed.start && parsed.end) return { start: parsed.start, end: parsed.end }
        } catch {
          /* ignore */
        }
      }
    }
    return getDateRangeForPeriod('last_year')
  })
  const [organizationName] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [hasInitialData, setHasInitialData] = useState(false)

  // Display preference: Show account numbers in financial statements
  const [showAccountNumbers, setShowAccountNumbersState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zenith_show_account_numbers') === 'true'
    }
    return false
  })

  // Wrapper to persist preference
  const setShowAccountNumbers = useCallback((show: boolean) => {
    setShowAccountNumbersState(show)
    localStorage.setItem('zenith_show_account_numbers', String(show))
  }, [])

  // Initialize from URL on mount (URL params take priority over localStorage)
  useEffect(() => {
    const urlView = searchParams.get('view') as ReportView
    const urlStart = searchParams.get('start')
    const urlEnd = searchParams.get('end')
    const urlPeriod = searchParams.get('period')

    // Only override localStorage-initialized state if URL has report params
    const hasUrlParams = urlPeriod || urlStart || urlEnd || urlView

    if (hasUrlParams) {
      const validViews: ReportView[] = ['summary', 'pnl', 'balance-sheet', 'cash-flow']
      const view = validViews.includes(urlView) ? urlView : 'summary'
      const p = urlPeriod || 'last_year'

      if (urlStart && urlEnd) {
        setDateRange({ start: urlStart, end: urlEnd })
        setPeriod(p)
      } else if (urlPeriod) {
        const range = getDateRangeForPeriod(p)
        setDateRange(range)
        setPeriod(p)
      }

      setActiveView(view)
    }

    setMounted(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Persist period, dateRange, and view to localStorage
  useEffect(() => {
    if (!mounted) return
    localStorage.setItem(
      'zenith_reports_period',
      JSON.stringify({
        period,
        start: dateRange.start,
        end: dateRange.end,
        view: activeView,
      })
    )
  }, [period, dateRange, activeView, mounted])

  // Sync state to URL (after mount)
  useEffect(() => {
    if (!mounted) return

    // Preserve entity params (realmId, schema) that the sidebar and hooks depend on
    const existing = new URLSearchParams(window.location.search)
    const params = new URLSearchParams()
    const realmId = existing.get('realmId')
    const schema = existing.get('schema')
    if (realmId) params.set('realmId', realmId)
    if (schema) params.set('schema', schema)
    params.set('view', activeView)
    params.set('start', dateRange.start)
    params.set('end', dateRange.end)
    params.set('period', period)

    // Use replaceState to avoid polluting history
    const newUrl = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState({}, '', newUrl)
  }, [activeView, dateRange, period, mounted])

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const urlView = (params.get('view') as ReportView) || 'summary'
      const urlStart = params.get('start') || ''
      const urlEnd = params.get('end') || ''
      const urlPeriod = params.get('period') || 'last_year'

      setActiveView(urlView)
      setDateRange({ start: urlStart, end: urlEnd })
      setPeriod(urlPeriod)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Tick counter to force re-evaluation of staleness every 30s
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  // Derive dataStatus during render — no effect needed for the computation itself
  const dataStatus: 'fresh' | 'stale' | 'error' = (() => {
    if (!lastUpdated) return 'stale'
    const age = Date.now() - lastUpdated.getTime()
    if (age < 30 * 60 * 1000) return 'fresh'
    if (age < 45 * 60 * 1000) return 'stale'
    return 'error'
  })()

  // Refresh function - revalidates current view's data
  const refresh = useCallback(async () => {
    setIsRefreshing(true)

    try {
      const { start, end } = dateRange

      // Force revalidation by passing options to bypass cache
      const mutateOptions = { revalidate: true, dedupe: false }

      // Revalidate based on active view
      if (activeView === 'summary') {
        // Summary uses data from all reports
        // Use sequential approach with fail-fast to prevent multiple error notifications
        const asOfDate = getAsOfDateForPeriod(period)

        try {
          // First call acts as auth validator
          await mutate(
            `/api/quickbooks/reports/profit-loss?start=${start}&end=${end}&details=true`,
            undefined,
            mutateOptions
          )

          // If first call succeeds, fetch remaining reports in parallel
          await Promise.all([
            mutate(
              `/api/quickbooks/reports/balance-sheet?date=${asOfDate}&details=true`,
              undefined,
              mutateOptions
            ),
            mutate(
              `/api/quickbooks/reports/cash-flow?start=${start}&end=${end}&details=true`,
              undefined,
              mutateOptions
            ),
          ])
        } catch (error: any) {
          // If auth failed, stop all operations to prevent cascade of errors
          if (error?.code === 'PROVIDER_INVALID_GRANT' || error?.requiresReconnect) {
            logger.info('Auth error detected, stopping report fetching', {
              component: 'ReportsProvider',
            })
            throw error // Re-throw to be handled by outer catch
          }
          // For other errors, try to continue
          throw error
        }
      } else if (activeView === 'pnl') {
        await mutate(
          `/api/quickbooks/reports/profit-loss?start=${start}&end=${end}&details=true`,
          undefined,
          mutateOptions
        )
      } else if (activeView === 'balance-sheet') {
        const asOfDate = getAsOfDateForPeriod(period)
        await mutate(
          `/api/quickbooks/reports/balance-sheet?date=${asOfDate}&details=true`,
          undefined,
          mutateOptions
        )
      } else if (activeView === 'cash-flow') {
        await mutate(
          `/api/quickbooks/reports/cash-flow?start=${start}&end=${end}&details=true`,
          undefined,
          mutateOptions
        )
      }

      setLastUpdated(new Date())
    } catch (error) {
      logger.error('Error refreshing report data', { error, component: 'ReportsProvider' })
    } finally {
      setIsRefreshing(false)
    }
  }, [activeView, dateRange, period])

  const value = {
    activeView,
    setActiveView,
    dateRange,
    setDateRange,
    period,
    setPeriod,
    showAccountNumbers,
    setShowAccountNumbers,
    currency,
    organizationName,
    lastUpdated,
    isRefreshing,
    dataStatus,
    refresh,
  }

  // Global error handler for provider authentication issues
  const handleProviderError = useCallback(
    (error: any) => {
      // Prevent duplicate handling of provider errors
      if (providerErrorHandledRef.current) {
        logger.debug('Provider error already handled, skipping', { component: 'ReportsProvider' })
        return true
      }

      // Only handle INVALID_GRANT (refresh token expired) and NOT_CONNECTED errors
      // Regular PROVIDER_TOKEN_EXPIRED is handled silently by auto-refresh
      if (
        error?.code === 'PROVIDER_INVALID_GRANT' ||
        error?.code === 'NO_PROVIDER_CONNECTED' ||
        error?.code === 'PROVIDER_NOT_CONNECTED'
      ) {
        providerErrorHandledRef.current = true
        const provider = error?.provider || 'quickbooks'

        logger.info('Provider error detected', { error: error?.code, component: 'ReportsProvider' })

        // Store return path for post-reconnection redirect
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('returnPath', window.location.pathname)
          sessionStorage.setItem('reconnectProvider', provider)
        }

        // Refresh session to update requiresProviderConnection flag
        // The layout will redirect to /dashboard when this flag is true
        refetchSession().then(() => {
          logger.info('Session refreshed after provider error', { component: 'ReportsProvider' })
          // Reset the flag after a delay to allow re-handling if needed
          setTimeout(() => {
            providerErrorHandledRef.current = false
          }, 5000)
        })

        // Only show toast for INVALID_GRANT (connection expired)
        // For NOT_CONNECTED, the layout will redirect to /dashboard
        if (error?.code === 'PROVIDER_INVALID_GRANT') {
          toast.error('Connection expired', {
            description: `Please reconnect ${provider === 'quickbooks' ? 'QuickBooks' : provider}.`,
            duration: 5000,
          })
        }

        return true // Handled
      }

      // Silently ignore regular token expiry - auto-refresh handles it
      if (error?.code === 'PROVIDER_TOKEN_EXPIRED') {
        logger.debug('Token expired, auto-refresh will handle it', { component: 'ReportsProvider' })
        return false // Not handled
      }

      return false // Not handled
    },
    [refetchSession]
  )

  return (
    <SWRConfig
      value={{
        // Cache for 30 minutes (balance freshness vs API calls)
        // This only deduplicates identical requests within the interval
        dedupingInterval: 30 * 60 * 1000,

        // Don't revalidate on window focus (avoid spam)
        revalidateOnFocus: false,

        // Allow refetch when data is stale - CRITICAL for period changes to work
        // When the SWR key changes (new date), we need to fetch fresh data
        revalidateIfStale: true,

        // Keep previous data while revalidating (smooth UX during refetch)
        keepPreviousData: true,

        // Revalidate on reconnect
        revalidateOnReconnect: true,

        // Don't retry on provider connection errors - requires user action to reconnect
        shouldRetryOnError: (error: any) => {
          if (
            error?.code === 'NO_PROVIDER_CONNECTED' ||
            error?.code === 'PROVIDER_NOT_CONNECTED' ||
            error?.code === 'PROVIDER_INVALID_GRANT' ||
            error?.requiresReconnect
          ) {
            return false
          }
          return true
        },

        // Background revalidation interval: 30 minutes
        refreshInterval: 30 * 60 * 1000,

        // Only refresh when tab is visible
        refreshWhenHidden: false,
        refreshWhenOffline: false,

        // Global success handler to update lastUpdated
        onSuccess: (data, key, config) => {
          // Only update if we don't have a lastUpdated yet or if it's been more than 1 minute
          if (!lastUpdated || Date.now() - lastUpdated.getTime() > 60000) {
            setLastUpdated(new Date())
            setHasInitialData(true)
          }
        },

        // Global error handler
        onError: (error, key) => {
          logger.error('SWR Error', { error, key, component: 'ReportsProvider' })

          // Try to handle provider errors
          handleProviderError(error)
        },
      }}
    >
      <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>
    </SWRConfig>
  )
}
