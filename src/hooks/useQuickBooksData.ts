/**
 * TanStack Query hooks for QuickBooks data with automatic cache invalidation
 *
 * IMPORTANT: This file requires @tanstack/react-query to be installed:
 * npm install @tanstack/react-query
 *
 * Also requires QueryClientProvider to be set up in the app layout.
 *
 * @example
 * ```tsx
 * // In app/layout.tsx or app/dev/qb/layout.tsx
 * import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
 *
 * const queryClient = new QueryClient({
 *   defaultOptions: {
 *     queries: {
 *       staleTime: 5 * 60 * 1000, // 5 minutes
 *       refetchOnWindowFocus: false,
 *     },
 *   },
 * })
 *
 * export default function Layout({ children }: { children: React.ReactNode }) {
 *   return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
 * }
 * ```
 */

'use client'

import { useQuery, useQueryClient, useMutation, type UseQueryOptions } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import type { QBWebhookEntityType } from '@/quickbooks/types/events'
import { useQuickBooksChanges } from './useQuickBooksEvents'
import { useQBRealmId } from './useQBRealmId'

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Centralized query key factory for QuickBooks data
 * This ensures consistent cache keys across the application
 */
export const qbQueryKeys = {
  all: ['qb'] as const,

  // Entity queries
  entities: (orgId: string) => [...qbQueryKeys.all, 'entities', orgId] as const,
  entityType: (orgId: string, type: string) => [...qbQueryKeys.entities(orgId), type] as const,
  entityList: (orgId: string, type: string, filters?: EntityFilters) =>
    [...qbQueryKeys.entityType(orgId, type), 'list', filters] as const,
  entityDetail: (orgId: string, type: string, id: string) =>
    [...qbQueryKeys.entityType(orgId, type), 'detail', id] as const,

  // Report queries
  reports: (orgId: string) => [...qbQueryKeys.all, 'reports', orgId] as const,
  reportType: (orgId: string, type: string) => [...qbQueryKeys.reports(orgId), type] as const,
  report: (orgId: string, type: string, params: ReportParams) =>
    [...qbQueryKeys.reportType(orgId, type), params] as const,

  // CDC queries
  changes: (orgId: string) => [...qbQueryKeys.all, 'changes', orgId] as const,
}

// ============================================================================
// Types
// ============================================================================

export interface EntityFilters {
  limit?: number
  offset?: number
  where?: string
  since?: string
}

export interface ReportParams {
  startDate?: string
  endDate?: string
  summarizeBy?: string
  accountingMethod?: string
}

export interface DateRange {
  start: string
  end: string
}

export interface QBEntityResponse<T = unknown> {
  success: boolean
  data?: T[]
  count?: number
  error?: string
  message?: string
}

export interface QBReportResponse<T = unknown> {
  success: boolean
  reportType: string
  data?: T
  error?: string
  message?: string
}

// ============================================================================
// Entity Hooks
// ============================================================================

/**
 * Fetch QuickBooks entities with automatic caching and invalidation
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useQBEntities('ORG#123', 'Invoice', {
 *   limit: 50,
 *   where: 'Balance > 0'
 * })
 * ```
 */
export function useQBEntities<T = unknown>(
  orgId: string | null | undefined,
  entityType: QBWebhookEntityType,
  filters?: EntityFilters,
  options?: Omit<UseQueryOptions<T[], Error>, 'queryKey' | 'queryFn'>
) {
  const realmId = useQBRealmId()
  return useQuery<T[], Error>({
    queryKey: [...qbQueryKeys.entityList(orgId || '', entityType, filters), realmId] as const,
    queryFn: async () => {
      if (!orgId) throw new Error('Organization ID is required')

      const params = new URLSearchParams({
        organizationId: orgId,
        entityType,
        limit: String(filters?.limit || 50),
      })

      if (realmId) params.set('realmId', realmId)
      if (filters?.offset) params.set('offset', String(filters.offset))
      if (filters?.where) params.set('where', filters.where)
      if (filters?.since) params.set('since', filters.since)

      const response = await fetch(`/api/quickbooks/query?${params}`)
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || 'Failed to fetch entities')
      }

      const result: QBEntityResponse<T> = await response.json()
      if (!result.success) {
        throw new Error(result.error || result.message || 'Query failed')
      }

      return result.data || []
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  })
}

/**
 * Fetch a single QuickBooks entity by ID
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useQBEntity('ORG#123', 'Invoice', '42')
 * ```
 */
export function useQBEntity<T = unknown>(
  orgId: string | null | undefined,
  entityType: QBWebhookEntityType,
  entityId: string | null | undefined,
  options?: Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'>
) {
  const realmId = useQBRealmId()
  return useQuery<T, Error>({
    queryKey: [
      ...qbQueryKeys.entityDetail(orgId || '', entityType, entityId || ''),
      realmId,
    ] as const,
    queryFn: async () => {
      if (!orgId) throw new Error('Organization ID is required')
      if (!entityId) throw new Error('Entity ID is required')

      const params = new URLSearchParams({
        organizationId: orgId,
        entityType,
        entityId,
      })
      if (realmId) params.set('realmId', realmId)

      const response = await fetch(`/api/quickbooks/query?${params}`)
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || 'Failed to fetch entity')
      }

      const result: QBEntityResponse<T> = await response.json()
      if (!result.success || !result.data?.[0]) {
        throw new Error(result.error || 'Entity not found')
      }

      return result.data[0]
    },
    enabled: !!orgId && !!entityId,
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

// ============================================================================
// Report Hooks
// ============================================================================

/**
 * Fetch QuickBooks financial reports with caching
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useQBReport('ORG#123', 'ProfitAndLoss', {
 *   startDate: '2024-01-01',
 *   endDate: '2024-12-31',
 *   accountingMethod: 'Accrual'
 * })
 * ```
 */
export function useQBReport<T = unknown>(
  orgId: string | null | undefined,
  reportType: string,
  params?: ReportParams,
  options?: Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'>
) {
  const realmId = useQBRealmId()
  return useQuery<T, Error>({
    queryKey: [...qbQueryKeys.report(orgId || '', reportType, params || {}), realmId] as const,
    queryFn: async () => {
      if (!orgId) throw new Error('Organization ID is required')

      const urlParams = new URLSearchParams({
        orgId,
        type: reportType,
      })

      if (realmId) urlParams.set('realmId', realmId)
      if (params?.startDate) urlParams.set('start_date', params.startDate)
      if (params?.endDate) urlParams.set('end_date', params.endDate)
      if (params?.summarizeBy) urlParams.set('summarize_column_by', params.summarizeBy)
      if (params?.accountingMethod) urlParams.set('accounting_method', params.accountingMethod)

      const response = await fetch(`/api/quickbooks/reports?${urlParams}`)
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || 'Failed to fetch report')
      }

      const result: QBReportResponse<T> = await response.json()
      if (!result.success) {
        throw new Error(result.error || result.message || 'Report fetch failed')
      }

      return result.data as T
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

/**
 * Convenience hook for Profit & Loss report
 */
export function useQBProfitLoss(
  orgId: string | null | undefined,
  dateRange: DateRange,
  accountingMethod: 'Accrual' | 'Cash' = 'Accrual',
  options?: Omit<UseQueryOptions<unknown, Error>, 'queryKey' | 'queryFn'>
) {
  return useQBReport(
    orgId,
    'ProfitAndLoss',
    {
      startDate: dateRange.start,
      endDate: dateRange.end,
      accountingMethod,
    },
    options
  )
}

/**
 * Convenience hook for Balance Sheet report
 */
export function useQBBalanceSheet(
  orgId: string | null | undefined,
  asOfDate: string,
  accountingMethod: 'Accrual' | 'Cash' = 'Accrual',
  options?: Omit<UseQueryOptions<unknown, Error>, 'queryKey' | 'queryFn'>
) {
  return useQBReport(
    orgId,
    'BalanceSheet',
    {
      endDate: asOfDate,
      accountingMethod,
    },
    options
  )
}

/**
 * Convenience hook for Cash Flow report
 */
export function useQBCashFlow(
  orgId: string | null | undefined,
  dateRange: DateRange,
  options?: Omit<UseQueryOptions<unknown, Error>, 'queryKey' | 'queryFn'>
) {
  return useQBReport(
    orgId,
    'CashFlow',
    {
      startDate: dateRange.start,
      endDate: dateRange.end,
    },
    options
  )
}

// ============================================================================
// CDC Integration
// ============================================================================

/**
 * Automatically invalidate queries when QuickBooks data changes
 * This hook integrates the CDC system with TanStack Query's cache invalidation
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   useQBChangeInvalidation('ORG#123')
 *
 *   // Your queries will automatically refetch when changes are detected
 *   const { data: invoices } = useQBEntities('ORG#123', 'Invoice')
 *   const { data: customers } = useQBEntities('ORG#123', 'Customer')
 * }
 * ```
 */
export function useQBChangeInvalidation(
  orgId: string | null | undefined,
  options?: {
    enabled?: boolean
    pollInterval?: number
    onInvalidate?: (types: QBWebhookEntityType[]) => void
  }
) {
  const queryClient = useQueryClient()

  const { changedTypes, clearChanges } = useQuickBooksChanges({
    organizationId: orgId,
    enabled: options?.enabled !== false && !!orgId,
    pollInterval: options?.pollInterval || 30000, // 30 seconds default
  })

  const onInvalidateRef = useRef(options?.onInvalidate)
  useEffect(() => {
    onInvalidateRef.current = options?.onInvalidate
  }, [options?.onInvalidate])

  useEffect(() => {
    if (!orgId || changedTypes.length === 0) return

    // Invalidate queries for each changed entity type
    changedTypes.forEach((type) => {
      // Invalidate all queries for this entity type
      queryClient.invalidateQueries({
        queryKey: qbQueryKeys.entityType(orgId, type),
      })
    })

    // Invalidate all reports as entity changes may affect them
    queryClient.invalidateQueries({
      queryKey: qbQueryKeys.reports(orgId),
    })

    // Notify callback
    onInvalidateRef.current?.(changedTypes)

    // Clear the changes after invalidation
    clearChanges()
  }, [changedTypes, orgId, queryClient, clearChanges])

  return { changedTypes }
}

// ============================================================================
// Mutation Hooks (for future use)
// ============================================================================

/**
 * Generic mutation hook for QuickBooks entity updates
 * This is a placeholder for future implementation
 *
 * @example
 * ```tsx
 * const { mutate, isLoading } = useQBMutation('ORG#123', 'Invoice')
 *
 * mutate({
 *   action: 'update',
 *   entityId: '42',
 *   data: { /* entity data *\/ }
 * })
 * ```
 */
export function useQBMutation<T = unknown>(
  orgId: string | null | undefined,
  entityType: QBWebhookEntityType
) {
  const queryClient = useQueryClient()

  return useMutation<T, Error, { action: string; entityId?: string; data: unknown }>({
    mutationFn: async ({ action, entityId, data }) => {
      if (!orgId) throw new Error('Organization ID is required')

      // This is a placeholder - implement actual mutation logic based on your API
      const response = await fetch('/api/quickbooks/mutate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          entityType,
          action,
          entityId,
          data,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || 'Mutation failed')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate relevant queries after successful mutation
      queryClient.invalidateQueries({
        queryKey: qbQueryKeys.entityType(orgId || '', entityType),
      })
    },
  })
}

// ============================================================================
// Prefetch Utilities
// ============================================================================

/**
 * Prefetch QuickBooks entities for faster navigation
 *
 * @example
 * ```tsx
 * const prefetchInvoices = usePrefetchQBEntities()
 *
 * // Prefetch on hover
 * <Link onMouseEnter={() => prefetchInvoices('ORG#123', 'Invoice')}>
 *   View Invoices
 * </Link>
 * ```
 */
export function usePrefetchQBEntities() {
  const queryClient = useQueryClient()

  return async (orgId: string, entityType: QBWebhookEntityType, filters?: EntityFilters) => {
    await queryClient.prefetchQuery({
      queryKey: qbQueryKeys.entityList(orgId, entityType, filters),
      queryFn: async () => {
        const params = new URLSearchParams({
          organizationId: orgId,
          entityType,
          limit: String(filters?.limit || 50),
        })

        if (filters?.where) params.set('where', filters.where)

        const response = await fetch(`/api/quickbooks/query?${params}`)
        const result = await response.json()
        return result.data || []
      },
      staleTime: 5 * 60 * 1000,
    })
  }
}

/**
 * Prefetch QuickBooks report for faster navigation
 */
export function usePrefetchQBReport() {
  const queryClient = useQueryClient()

  return async (orgId: string, reportType: string, params?: ReportParams) => {
    await queryClient.prefetchQuery({
      queryKey: qbQueryKeys.report(orgId, reportType, params || {}),
      queryFn: async () => {
        const urlParams = new URLSearchParams({ orgId, type: reportType })

        if (params?.startDate) urlParams.set('start_date', params.startDate)
        if (params?.endDate) urlParams.set('end_date', params.endDate)

        const response = await fetch(`/api/quickbooks/reports?${urlParams}`)
        const result = await response.json()
        return result.data
      },
      staleTime: 5 * 60 * 1000,
    })
  }
}
