/**
 * useQuickBooksChanges - React Hook for QuickBooks CDC (Polling-based)
 *
 * Polls the changes endpoint to detect when QuickBooks data has been modified.
 * No Redis/SSE required - simple polling with timestamp comparison.
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { timestamps, hasChanges, changedTypes } = useQuickBooksChanges({
 *     organizationId: 'ORG#abc123',
 *     pollInterval: 30000, // 30 seconds
 *     onChanges: (changedTypes) => {
 *       // Invalidate queries for changed entity types
 *       changedTypes.forEach(type => {
 *         queryClient.invalidateQueries(['quickbooks', type])
 *       })
 *     }
 *   })
 *
 *   return <div>Changes detected: {changedTypes.join(', ')}</div>
 * }
 * ```
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { QBWebhookEntityType } from '@/quickbooks/types/events'

export type ChangeTimestamps = Partial<Record<string, string>>

export interface UseQuickBooksChangesOptions {
  /**
   * Organization ID (must match format stored in DB, e.g., "ORG#abc123")
   */
  organizationId: string | null | undefined

  /**
   * Whether to enable polling (default: true)
   */
  enabled?: boolean

  /**
   * Poll interval in milliseconds (default: 30000 = 30 seconds)
   */
  pollInterval?: number

  /**
   * Entity types to watch (default: all)
   */
  watchTypes?: QBWebhookEntityType[]

  /**
   * Callback when changes are detected
   */
  onChanges?: (changedTypes: QBWebhookEntityType[]) => void

  /**
   * Callback on error
   */
  onError?: (error: Error) => void
}

export interface UseQuickBooksChangesReturn {
  /**
   * Current change timestamps from server
   */
  timestamps: ChangeTimestamps

  /**
   * Whether any watched types have changed since last check
   */
  hasChanges: boolean

  /**
   * List of entity types that have changed
   */
  changedTypes: QBWebhookEntityType[]

  /**
   * Whether currently fetching
   */
  isPolling: boolean

  /**
   * Last poll time
   */
  lastPollAt: string | null

  /**
   * Error if any
   */
  error: Error | null

  /**
   * Manually trigger a poll
   */
  poll: () => Promise<void>

  /**
   * Clear detected changes (after handling them)
   */
  clearChanges: () => void
}

export function useQuickBooksChanges(
  options: UseQuickBooksChangesOptions
): UseQuickBooksChangesReturn {
  const {
    organizationId,
    enabled = true,
    pollInterval = 30000,
    watchTypes,
    onChanges,
    onError,
  } = options

  const [timestamps, setTimestamps] = useState<ChangeTimestamps>({})
  const [changedTypes, setChangedTypes] = useState<QBWebhookEntityType[]>([])
  const [isPolling, setIsPolling] = useState(false)
  const [lastPollAt, setLastPollAt] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Track previous timestamps for comparison
  const prevTimestampsRef = useRef<ChangeTimestamps>({})
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Stable callback refs
  const onChangesRef = useRef(onChanges)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onChangesRef.current = onChanges
    onErrorRef.current = onError
  }, [onChanges, onError])

  const poll = useCallback(async () => {
    if (!organizationId || !enabled) {
      return
    }

    setIsPolling(true)
    setError(null)

    try {
      const url = new URL('/api/quickbooks/changes', window.location.origin)
      url.searchParams.set('orgId', organizationId)

      const response = await fetch(url.toString())

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      const newTimestamps = data.timestamps || {}

      // Compare with previous timestamps to detect changes
      const changed: QBWebhookEntityType[] = []
      const typesToCheck = watchTypes || (Object.keys(newTimestamps) as QBWebhookEntityType[])

      for (const type of typesToCheck) {
        const oldTs = prevTimestampsRef.current[type]
        const newTs = newTimestamps[type]

        if (newTs && (!oldTs || newTs > oldTs)) {
          changed.push(type)
        }
      }

      // Update state
      setTimestamps(newTimestamps)
      setLastPollAt(new Date().toISOString())

      // Only trigger callback if there are actual changes (not on first poll)
      if (changed.length > 0 && Object.keys(prevTimestampsRef.current).length > 0) {
        setChangedTypes((prev) => {
          // Merge with existing changes
          const merged = new Set([...prev, ...changed])
          return Array.from(merged) as QBWebhookEntityType[]
        })
        onChangesRef.current?.(changed)
      }

      // Update previous timestamps
      prevTimestampsRef.current = newTimestamps
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      onErrorRef.current?.(error)
    } finally {
      setIsPolling(false)
    }
  }, [organizationId, enabled, watchTypes])

  const clearChanges = useCallback(() => {
    setChangedTypes([])
  }, [])

  // Setup polling interval
  useEffect(() => {
    if (!enabled || !organizationId) {
      return
    }

    // Initial poll
    poll()

    // Setup interval
    intervalRef.current = setInterval(poll, pollInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, organizationId, pollInterval, poll])

  return {
    timestamps,
    hasChanges: changedTypes.length > 0,
    changedTypes,
    isPolling,
    lastPollAt,
    error,
    poll,
    clearChanges,
  }
}

// Keep the old export name for backward compatibility
export const useQuickBooksEvents = useQuickBooksChanges

export default useQuickBooksChanges
