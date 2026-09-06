// src/contexts/FinancialDataContext.tsx
'use client'

import {
  createContext,
  useState,
  useContext,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react'
import { apiClient } from '@/lib/apiClient'
import { useSession } from '@/hooks/useSession'
import { logger } from '@/lib/logger'

interface OrganizationMetrics {
  organizationName: string
  currency: string
  lastSync: number
  kpis: any[]
  charts: {
    revenueExpenseTrend: any[]
    expenseBreakdown: any[]
    dailyCashFlow: any[]
  }
  recentTransactions: any[]
  insights: any[]
  revenueBreakdown?: Array<{
    source: string
    amount: number
    percentage: number
  }>
  revenueBreakdownTotal?: number
  invoicesByCategory?: Array<{
    category: string
    amount: number
    count: number
  }>
}

interface LoadingStates {
  basicInfo: boolean
  cashMetrics: boolean
  criticalKpis: boolean
  revenueKpis: boolean
  operationalKpis: boolean
  charts: boolean
  transactions: boolean
  insights: boolean
}

interface FinancialDataContextType {
  financialData: OrganizationMetrics | null
  partialData: Partial<OrganizationMetrics> | null
  isLoading: boolean
  isChartLoading: boolean
  loadingStates: LoadingStates
  error: string | null
  errorType?: 'connection' | 'general'
  chartPeriod: '3months' | '6months' | '12months'
  chartViewType: 'monthly' | 'weekly'
  fetchFinancialData: () => Promise<void>
  fetchProgressiveData: () => Promise<void>
  handlePeriodChange: (period: '3months' | '6months' | '12months') => Promise<void>
  handleViewTypeChange: (type: 'monthly' | 'weekly') => Promise<void>
}

const FinancialDataContext = createContext<FinancialDataContextType | undefined>(undefined)

export const FinancialDataProvider = ({ children }: { children: ReactNode }) => {
  const { isSigningOut } = useSession()
  const [financialData, setFinancialData] = useState<OrganizationMetrics | null>(null)
  const [partialData, setPartialData] = useState<Partial<OrganizationMetrics> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isChartLoading, setIsChartLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<'connection' | 'general' | undefined>(undefined)
  const [chartPeriod, setChartPeriod] = useState<'3months' | '6months' | '12months'>('12months')
  const [chartViewType, setChartViewType] = useState<'monthly' | 'weekly'>('monthly')
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    basicInfo: true,
    cashMetrics: true,
    criticalKpis: true,
    revenueKpis: true,
    operationalKpis: true,
    charts: true,
    transactions: true,
    insights: true,
  })

  // Add refs to track ongoing requests and prevent duplicates
  const abortControllerRef = useRef<AbortController | null>(null)
  const fetchInProgressRef = useRef(false)
  const lastFetchParamsRef = useRef<string>('')

  const fetchData = useCallback(
    async (
      period: '3months' | '6months' | '12months',
      viewType: 'monthly' | 'weekly',
      isInitialLoad: boolean
    ) => {
      // Don't make new requests if user is signing out
      if (isSigningOut) {
        logger.debug('Skipping fetch - user is signing out', { component: 'FinancialDataContext' })
        return
      }

      // Create a unique key for this request
      const fetchKey = `${period}-${viewType}-accrual` // Always use accrual

      // If we're already fetching with the same params, don't duplicate
      if (fetchInProgressRef.current && lastFetchParamsRef.current === fetchKey) {
        logger.debug('Skipping duplicate fetch request', { component: 'FinancialDataContext' })
        return
      }

      // Cancel any previous ongoing request
      if (abortControllerRef.current) {
        logger.debug('Aborting previous request', { component: 'FinancialDataContext' })
        abortControllerRef.current.abort()
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController()
      fetchInProgressRef.current = true
      lastFetchParamsRef.current = fetchKey

      if (isInitialLoad) {
        setIsLoading(true)
      } else {
        setIsChartLoading(true)
      }
      setError(null)

      try {
        // Always use accrual basis with full mode for regular fetching
        const url = `/api/kpis?mode=full&period=latest&chartPeriod=${period}&basis=accrual&viewType=${viewType}`
        const response = await apiClient(url, {
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorData = await response.json()

          // Handle specific error codes
          if (
            errorData.code === 'NO_PROVIDER_CONNECTED' ||
            errorData.code === 'PROVIDER_CONNECTION_FAILED' ||
            errorData.error?.includes('provider') ||
            errorData.error?.includes('connection')
          ) {
            // Set connection error type so dashboard can show connection prompt
            logger.info('Provider connection issue detected', { component: 'FinancialDataContext' })
            setError(
              errorData.error || 'Please connect your accounting provider to view financial data'
            )
            setErrorType('connection')
            setFinancialData(null)
            return // Exit early without throwing
          }

          throw new Error(errorData.error || errorData.message || 'Failed to fetch dashboard data')
        }

        const data = await response.json()

        logger.debug('API Response received', {
          hasKpis: !!data.kpis,
          kpisLength: data.kpis?.length,
          provider: data.provider,
          optimized: data.optimized,
          dataKeys: Object.keys(data),
          component: 'FinancialDataContext',
        })

        // Validate that we have the required data
        if (!data.kpis || !Array.isArray(data.kpis)) {
          logger.error('Invalid data format', { data, component: 'FinancialDataContext' })
          throw new Error('Invalid data format received from server')
        }

        setFinancialData(data)
        setError(null)
        logger.debug('Financial data set successfully', { component: 'FinancialDataContext' })

        // Notify the cached UnifiedDataTool that dashboard has new data
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('dashboard_data_version', Date.now().toString())
        }
      } catch (err: any) {
        // Ignore abort errors
        if (err.name === 'AbortError') {
          logger.debug('Request was cancelled', { component: 'FinancialDataContext' })
          return
        }

        logger.error('Error fetching financial data', {
          error: err,
          component: 'FinancialDataContext',
        })
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
        setError(errorMessage)

        // Detect connection-related errors
        if (
          errorMessage.includes('No active provider') ||
          errorMessage.includes('provider') ||
          errorMessage.includes('connection') ||
          errorMessage.includes('401') ||
          errorMessage.includes('403')
        ) {
          setErrorType('connection')
        } else {
          setErrorType('general')
        }
      } finally {
        fetchInProgressRef.current = false
        if (isInitialLoad) {
          setIsLoading(false)
        } else {
          setIsChartLoading(false)
        }
      }
    },
    [financialData, isSigningOut]
  )

  const fetchFinancialData = useCallback(async () => {
    await fetchData(chartPeriod, chartViewType, !financialData)
  }, [chartPeriod, chartViewType, fetchData, financialData])

  // Progressive data fetching - true 2-phase loading
  const fetchProgressiveData = useCallback(async () => {
    // Don't make new requests if user is signing out
    if (isSigningOut) {
      logger.debug('Skipping progressive fetch - user is signing out', {
        component: 'FinancialDataContext',
      })
      return
    }

    // Reset states
    setIsLoading(true)
    setError(null)
    setPartialData({})
    setLoadingStates({
      basicInfo: true,
      cashMetrics: true,
      criticalKpis: true,
      revenueKpis: true,
      operationalKpis: true,
      charts: true,
      transactions: true,
      insights: true,
    })

    try {
      // PHASE 1: Get KPIs and charts immediately
      const phase1Url = `/api/kpis?mode=progressive&chartPeriod=${chartPeriod}&basis=accrual&viewType=${chartViewType}`
      const phase1Response = await apiClient(phase1Url)

      if (!phase1Response.ok) {
        const errorData = await phase1Response.json()

        // Handle connection issues
        if (
          errorData.code === 'NO_PROVIDER_CONNECTED' ||
          errorData.code === 'PROVIDER_CONNECTION_FAILED' ||
          errorData.error?.includes('provider') ||
          errorData.error?.includes('connection')
        ) {
          logger.info('Provider connection issue detected in progressive loading', {
            component: 'FinancialDataContext',
          })
          setError(
            errorData.error || 'Please connect your accounting provider to view financial data'
          )
          setErrorType('connection')
          setIsLoading(false)
          return
        }

        throw new Error(errorData.error || 'Failed to fetch Phase 1 data')
      }

      const phase1Data = await phase1Response.json()

      // Set Phase 1 data immediately
      setPartialData({
        ...phase1Data,
        revenueBreakdown: [],
        recentTransactions: [],
        charts: {
          ...phase1Data.charts,
          dailyCashFlow: [],
        },
      })

      // Update loading states for Phase 1 complete items
      setLoadingStates({
        basicInfo: false,
        cashMetrics: false,
        criticalKpis: false,
        revenueKpis: false,
        operationalKpis: false,
        charts: false, // Revenue/expense trend chart is ready
        transactions: true, // Still loading
        insights: false,
      })

      // PHASE 2: Fetch transaction data for revenue breakdown, daily cash flow, recent transactions
      const phase2Url = `/api/kpis/phase2`
      let phase2Response
      let phase2Success = false
      let retryCount = 0
      const maxRetries = 2

      // Retry logic for Phase 2
      while (retryCount <= maxRetries && !phase2Success) {
        try {
          if (retryCount > 0) {
            logger.info(`Phase 2 retry attempt ${retryCount} of ${maxRetries}`, {
              component: 'FinancialDataContext',
            })
            // Wait before retry (exponential backoff)
            await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)))
          }

          phase2Response = await apiClient(phase2Url)

          if (phase2Response.ok) {
            phase2Success = true
          } else {
            logger.warn(`Phase 2 attempt ${retryCount + 1} failed`, {
              status: phase2Response.status,
              component: 'FinancialDataContext',
            })
            retryCount++
          }
        } catch (error) {
          logger.error(`Phase 2 attempt ${retryCount + 1} error`, {
            error,
            component: 'FinancialDataContext',
          })
          retryCount++
        }
      }

      if (!phase2Success) {
        logger.error('Phase 2 all attempts failed - revenue breakdown will be empty', {
          component: 'FinancialDataContext',
        })
        // Keep the loading state true for transactions to show it's incomplete
        setLoadingStates((prev) => ({
          ...prev,
          transactions: false, // Set to false but data will be empty
        }))
        // Still set the Phase 1 data as final but mark it as incomplete
        setFinancialData({
          ...phase1Data,
          phase2Failed: true, // Add a flag to indicate Phase 2 failed
        })
        setIsLoading(false)
        return
      }

      const phase2Data = await phase2Response!.json()

      // Log what we received from Phase 2
      logger.debug('Phase 2 data received', {
        hasRevenueBreakdown: !!phase2Data.revenueBreakdown,
        revenueBreakdownLength: phase2Data.revenueBreakdown?.length || 0,
        revenueBreakdownTotal: phase2Data.revenueBreakdownTotal || 0,
        hasTransactions: !!phase2Data.recentTransactions,
        transactionCount: phase2Data.recentTransactions?.length || 0,
        component: 'FinancialDataContext',
      })

      // Merge Phase 2 data with Phase 1 data
      const completeData = {
        ...phase1Data,
        revenueBreakdown: phase2Data.revenueBreakdown || [],
        revenueBreakdownTotal: phase2Data.revenueBreakdownTotal || 0,
        recentTransactions: phase2Data.recentTransactions || [],
        charts: {
          ...phase1Data.charts,
          dailyCashFlow: phase2Data.dailyCashFlow || [],
        },
        phase: 2, // Mark as phase 2 complete
        phase2Failed: false,
      }

      // Set complete data
      setFinancialData(completeData)
      setPartialData(completeData)

      // All loading complete
      setLoadingStates({
        basicInfo: false,
        cashMetrics: false,
        criticalKpis: false,
        revenueKpis: false,
        operationalKpis: false,
        charts: false,
        transactions: false,
        insights: false,
      })

      setIsLoading(false)
      logger.info('Progressive data fetch completed - both phases loaded', {
        component: 'FinancialDataContext',
      })
    } catch (err) {
      logger.error('Progressive fetch error', { error: err, component: 'FinancialDataContext' })
      setError(err instanceof Error ? err.message : 'Unknown error')
      setIsLoading(false)
    }
  }, [chartPeriod, chartViewType, isSigningOut])

  const handlePeriodChange = useCallback(
    async (newPeriod: '3months' | '6months' | '12months') => {
      if (newPeriod === chartPeriod) return
      setChartPeriod(newPeriod)
      // Reset to monthly view when changing period unless it's 3 months
      const viewType = newPeriod === '3months' ? chartViewType : 'monthly'
      setChartViewType(viewType)
      await fetchData(newPeriod, viewType, false)
    },
    [chartPeriod, chartViewType, fetchData]
  )

  const handleViewTypeChange = useCallback(
    async (newViewType: 'monthly' | 'weekly') => {
      if (newViewType === chartViewType) return
      setChartViewType(newViewType)
      await fetchData(chartPeriod, newViewType, false)
    },
    [chartPeriod, chartViewType, fetchData]
  )

  // Cancel ongoing requests when signing out
  useEffect(() => {
    if (isSigningOut && abortControllerRef.current) {
      logger.info('Sign-out detected, aborting all requests', { component: 'FinancialDataContext' })
      abortControllerRef.current.abort()
      fetchInProgressRef.current = false
    }
  }, [isSigningOut])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const contextValue = useMemo(
    () => ({
      financialData,
      partialData,
      isLoading,
      isChartLoading,
      loadingStates,
      error,
      errorType,
      fetchFinancialData,
      fetchProgressiveData,
      chartPeriod,
      chartViewType,
      handlePeriodChange,
      handleViewTypeChange,
    }),
    [
      financialData,
      partialData,
      isLoading,
      isChartLoading,
      loadingStates,
      error,
      errorType,
      fetchFinancialData,
      fetchProgressiveData,
      chartPeriod,
      chartViewType,
      handlePeriodChange,
      handleViewTypeChange,
    ]
  )

  return (
    <FinancialDataContext.Provider value={contextValue}>{children}</FinancialDataContext.Provider>
  )
}

export const useFinancialData = () => {
  const context = useContext(FinancialDataContext)
  if (context === undefined) {
    throw new Error('useFinancialData must be used within a FinancialDataProvider')
  }
  return context
}
