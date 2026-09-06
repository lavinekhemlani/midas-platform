/**
 * useQuickBooksQuery - React Hook for Querying QuickBooks Data
 *
 * Fetches data from QuickBooks API with automatic refetch on CDC events.
 * Integrates with useQuickBooksEvents for real-time updates.
 *
 * @example
 * ```tsx
 * function InvoiceList() {
 *   const { data, isLoading, error, refetch } = useQuickBooksQuery({
 *     organizationId: 'ORG#abc123',
 *     entityType: 'Invoice',
 *     limit: 50,
 *   })
 *
 *   if (isLoading) return <Spinner />
 *   if (error) return <Error message={error.message} />
 *
 *   return (
 *     <ul>
 *       {data?.map(invoice => (
 *         <li key={invoice.Id}>{invoice.DocNumber}</li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { QBWebhookEntityType } from '@/quickbooks/types/events'
import { useQBRealmId } from './useQBRealmId'

export interface UseQuickBooksQueryOptions<T = unknown> {
  /**
   * Organization ID (must match format stored in DB)
   */
  organizationId: string | null | undefined

  /**
   * Entity type to query
   */
  entityType: QBWebhookEntityType

  /**
   * Specific entity ID (for single entity fetch)
   */
  entityId?: string

  /**
   * Maximum number of results (default: 50)
   */
  limit?: number

  /**
   * Offset for pagination
   */
  offset?: number

  /**
   * Additional WHERE clause
   */
  where?: string

  /**
   * ISO timestamp for incremental sync
   */
  since?: string

  /**
   * Whether to enable the query (default: true)
   */
  enabled?: boolean

  /**
   * Transform the response data
   */
  transform?: (data: unknown[]) => T[]

  /**
   * Callback on successful fetch
   */
  onSuccess?: (data: T[]) => void

  /**
   * Callback on error
   */
  onError?: (error: Error) => void
}

export interface UseQuickBooksQueryReturn<T> {
  /**
   * The fetched data
   */
  data: T[] | null

  /**
   * Whether the query is loading
   */
  isLoading: boolean

  /**
   * Whether the query is fetching (includes refetches)
   */
  isFetching: boolean

  /**
   * Error if the query failed
   */
  error: Error | null

  /**
   * Cursor for next page (for incremental sync)
   */
  cursor: string | null

  /**
   * Whether there are more results
   */
  hasMore: boolean

  /**
   * Manually refetch the data
   */
  refetch: () => Promise<void>

  /**
   * Fetch next page
   */
  fetchMore: () => Promise<void>
}

export function useQuickBooksQuery<T = unknown>(
  options: UseQuickBooksQueryOptions<T>
): UseQuickBooksQueryReturn<T> {
  const {
    organizationId,
    entityType,
    entityId,
    limit = 50,
    offset = 0,
    where,
    since,
    enabled = true,
    transform,
    onSuccess,
    onError,
  } = options
  const realmId = useQBRealmId()

  const [data, setData] = useState<T[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [currentOffset, setCurrentOffset] = useState(offset)

  // Stable callback refs
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  const transformRef = useRef(transform)

  useEffect(() => {
    onSuccessRef.current = onSuccess
    onErrorRef.current = onError
    transformRef.current = transform
  }, [onSuccess, onError, transform])

  const fetchData = useCallback(
    async (fetchOffset: number = 0, append: boolean = false) => {
      if (!organizationId || !enabled) {
        return
      }

      const isInitialLoad = !append && data === null
      if (isInitialLoad) {
        setIsLoading(true)
      }
      setIsFetching(true)
      setError(null)

      try {
        // Build query URL
        const url = new URL('/api/quickbooks/query', window.location.origin)
        url.searchParams.set('orgId', organizationId)
        url.searchParams.set('entityType', entityType)
        if (realmId) url.searchParams.set('realmId', realmId)

        if (entityId) {
          url.searchParams.set('entityId', entityId)
        } else {
          url.searchParams.set('limit', String(limit))
          url.searchParams.set('offset', String(fetchOffset))

          if (where) {
            url.searchParams.set('where', where)
          }

          if (since) {
            url.searchParams.set('since', since)
          }
        }

        const response = await fetch(url.toString())

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`)
        }

        const result = await response.json()

        // Transform data if transform function provided
        let transformedData = result.data || []
        if (transformRef.current) {
          transformedData = transformRef.current(transformedData)
        }

        if (append) {
          setData((prev) => [...(prev || []), ...transformedData])
        } else {
          setData(transformedData)
        }

        setCursor(result.cursor || null)
        setHasMore(result.hasMore || false)
        setCurrentOffset(fetchOffset + transformedData.length)

        onSuccessRef.current?.(transformedData)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        onErrorRef.current?.(error)
      } finally {
        setIsLoading(false)
        setIsFetching(false)
      }
    },
    [organizationId, entityType, entityId, limit, where, since, enabled, data, realmId]
  )

  const refetch = useCallback(async () => {
    setCurrentOffset(offset)
    await fetchData(offset, false)
  }, [fetchData, offset])

  const fetchMore = useCallback(async () => {
    if (!hasMore || isFetching) {
      return
    }
    await fetchData(currentOffset, true)
  }, [fetchData, currentOffset, hasMore, isFetching])

  // Initial fetch
  useEffect(() => {
    if (enabled && organizationId) {
      fetchData(offset, false)
    }
  }, [enabled, organizationId, entityType, entityId, limit, offset, where, since])

  return {
    data,
    isLoading,
    isFetching,
    error,
    cursor,
    hasMore,
    refetch,
    fetchMore,
  }
}

export default useQuickBooksQuery
