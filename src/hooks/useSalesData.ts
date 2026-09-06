// src/hooks/useSalesData.ts
'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'
import { useQBRealmId, appendRealmId } from './useQBRealmId'

interface SalesResponse {
  success: boolean
  data?: any
  error?: string
  message?: string
  [key: string]: any
}

// Custom fetcher function that handles the apiClient pattern
const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    const error = new Error('Failed to fetch sales data')
    // Attach response status for better error handling
    ;(error as any).status = response.status
    throw error
  }
  return response.json()
}

// Base SWR configuration for all sales hooks
const baseConfig = {
  // Cache for 10 minutes (sales data changes frequently)
  dedupingInterval: 10 * 60 * 1000,
  // Keep data fresh for 5 minutes before background revalidation
  focusThrottleInterval: 5 * 60 * 1000,
  // Revalidate when the window regains focus
  revalidateOnFocus: true,
  // Revalidate when coming back online
  revalidateOnReconnect: true,
  // Retry on errors but not on 404s
  shouldRetryOnError: (error: any) => error.status !== 404,
  // Keep previous data while revalidating for smooth UX
  keepPreviousData: true,
  // Error retry configuration
  errorRetryCount: 2,
  errorRetryInterval: 2000,
}

/**
 * Interface for sales class summary filters
 */
interface SalesClassSummaryFilters {
  period?: string
  startDate?: string
  endDate?: string
  dateMacro?: string
  accountingMethod?: 'Cash' | 'Accrual'
  summarizeColumnBy?:
    | 'Total'
    | 'Month'
    | 'Week'
    | 'Days'
    | 'Quarter'
    | 'Year'
    | 'Customers'
    | 'Vendors'
    | 'Classes'
    | 'Departments'
    | 'Employees'
    | 'ProductsAndServices'
  customer?: string // comma-separated customer IDs
  department?: string // comma-separated department IDs
  class?: string // comma-separated class IDs
  item?: string // comma-separated item IDs
}

/**
 * Hook for fetching and caching sales by class summary data
 * Used by the sales summary page with comprehensive filtering support
 */
export function useSalesClassSummary(filters: SalesClassSummaryFilters = {}) {
  const realmId = useQBRealmId()
  const params = new URLSearchParams()

  // Handle date parameters
  if (filters.period && filters.period !== 'custom') {
    params.append('period', filters.period)
  }
  if (filters.startDate) params.append('start_date', filters.startDate)
  if (filters.endDate) params.append('end_date', filters.endDate)
  if (filters.dateMacro) params.append('date_macro', filters.dateMacro)

  // Handle filter parameters
  if (filters.accountingMethod) params.append('accounting_method', filters.accountingMethod)
  if (filters.summarizeColumnBy) params.append('summarize_column_by', filters.summarizeColumnBy)
  if (filters.customer) params.append('customer', filters.customer)
  if (filters.department) params.append('department', filters.department)
  if (filters.class) params.append('class', filters.class)
  if (filters.item) params.append('item', filters.item)
  appendRealmId(params, realmId)

  const { data, error, isLoading, mutate } = useSWR<SalesResponse>(
    `/api/sales/class-summary?${params.toString()}`,
    fetcher,
    {
      ...baseConfig,
      // Class summary data cached for 15 minutes as it aggregates multiple data sources
      dedupingInterval: 15 * 60 * 1000,
    }
  )

  return {
    salesData: data?.success ? data.data : null,
    isLoading,
    error: data?.success === false ? data.error || data.message : error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching sales by customer data
 * Simple interface with basic date filtering
 */
export function useSalesCustomer(startDate?: string, endDate?: string, provider?: string) {
  const realmId = useQBRealmId()
  const params = new URLSearchParams()
  if (startDate) params.append('start_date', startDate)
  if (endDate) params.append('end_date', endDate)
  if (provider) params.append('provider', provider)
  appendRealmId(params, realmId)

  const { data, error, isLoading, mutate } = useSWR<SalesResponse>(
    startDate && endDate ? `/api/sales/customer?${params.toString()}` : null,
    fetcher,
    {
      ...baseConfig,
      // Customer data changes frequently, shorter cache
      dedupingInterval: 8 * 60 * 1000,
      focusThrottleInterval: 4 * 60 * 1000,
      // Force fetch on mount even if global config says otherwise
      revalidateOnMount: true,
      revalidateIfStale: true,
    }
  )

  return {
    salesData: data?.success ? data : null,
    isLoading,
    error: data?.success === false ? data.error || data.message : error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching sales by department data
 */
export function useSalesDepartment(
  period: string = 'this_month',
  startDate?: string,
  endDate?: string
) {
  const realmId = useQBRealmId()
  const params = new URLSearchParams()
  if (period !== 'custom') {
    params.append('period', period)
  }
  if (startDate) params.append('start_date', startDate)
  if (endDate) params.append('end_date', endDate)
  appendRealmId(params, realmId)

  const { data, error, isLoading, mutate } = useSWR<SalesResponse>(
    `/api/sales/department?${params.toString()}`,
    fetcher,
    baseConfig
  )

  return {
    salesData: data?.success ? data.data : null,
    isLoading,
    error: data?.success === false ? data.error || data.message : error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching sales by product data
 */
export function useSalesProduct(
  period: string = 'this_month',
  startDate?: string,
  endDate?: string,
  provider?: string
) {
  const realmId = useQBRealmId()
  const params = new URLSearchParams()
  if (period !== 'custom') {
    params.append('period', period)
  }
  if (startDate) params.append('start_date', startDate)
  if (endDate) params.append('end_date', endDate)
  if (provider) params.append('provider', provider)
  appendRealmId(params, realmId)

  const { data, error, isLoading, mutate } = useSWR<SalesResponse>(
    `/api/sales/product?${params.toString()}`,
    fetcher,
    {
      ...baseConfig,
      // Product data is fairly stable, cache a bit longer
      dedupingInterval: 12 * 60 * 1000,
    }
  )

  return {
    salesData: data?.success ? data.data : null,
    isLoading,
    error: data?.success === false ? data.error || data.message : error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching sales receipt data
 */
export function useSalesReceipt(
  period: string = 'this_month',
  startDate?: string,
  endDate?: string,
  customerId?: string,
  limit: number = 100,
  offset: number = 0
) {
  const realmId = useQBRealmId()
  const params = new URLSearchParams()
  if (period !== 'custom') {
    params.append('period', period)
  }
  if (startDate) params.append('start_date', startDate)
  if (endDate) params.append('end_date', endDate)
  if (customerId) params.append('customer_id', customerId)
  if (limit) params.append('limit', limit.toString())
  if (offset) params.append('offset', offset.toString())
  appendRealmId(params, realmId)

  const { data, error, isLoading, mutate } = useSWR<SalesResponse>(
    `/api/sales/receipt?${params.toString()}`,
    fetcher,
    {
      ...baseConfig,
      // Receipt data changes very frequently, shorter cache
      dedupingInterval: 5 * 60 * 1000,
      focusThrottleInterval: 3 * 60 * 1000,
    }
  )

  return {
    salesData: data?.success ? data.data : null,
    isLoading,
    error: data?.success === false ? data.error || data.message : error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for invalidating all sales caches
 * Useful when you know the underlying data has changed
 */
export function useSalesCacheControl() {
  const { mutate: mutateClassSummary } = useSWR('/api/sales/class-summary', null, {
    revalidateOnMount: false,
  })
  const { mutate: mutateCustomer } = useSWR('/api/sales/customer', null, {
    revalidateOnMount: false,
  })
  const { mutate: mutateDepartment } = useSWR('/api/sales/department', null, {
    revalidateOnMount: false,
  })
  const { mutate: mutateProduct } = useSWR('/api/sales/product', null, { revalidateOnMount: false })
  const { mutate: mutateReceipt } = useSWR('/api/sales/receipt', null, { revalidateOnMount: false })

  return {
    invalidateAll: () => {
      // Invalidate all sales caches
      mutateClassSummary?.()
      mutateCustomer?.()
      mutateDepartment?.()
      mutateProduct?.()
      mutateReceipt?.()
    },
    invalidateClassSummary: () => mutateClassSummary?.(),
    invalidateCustomer: () => mutateCustomer?.(),
    invalidateDepartment: () => mutateDepartment?.(),
    invalidateProduct: () => mutateProduct?.(),
    invalidateReceipt: () => mutateReceipt?.(),
  }
}
