// src/hooks/useLearnData.ts
'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import type { GlossaryEntry } from '@/lib/data'

interface LearnProgress {
  completedTerms: string[]
  totalTime: number
  lastActive: string
}

interface LearnTermsResponse {
  terms: GlossaryEntry[]
  total: number
}

interface LearnProgressResponse {
  learnState: {
    completed_terms: string[]
    reading_history: Array<{
      term_id: string
      timestamp: number
      time_spent: number
    }>
    updated_at: string
  }
}

// Custom fetcher function that handles the apiClient pattern
const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    const error = new Error('Failed to fetch data')
    // Attach response status for better error handling
    ;(error as any).status = response.status
    throw error
  }
  return response.json()
}

// Calculate total time from reading history
const calculateTotalTime = (history: any[]): number => {
  return history.reduce((total, h) => total + (h.time_spent || h.timeSpent || 0), 0)
}

/**
 * Hook for fetching and caching learn terms data
 * Terms data is cached for 24 hours since it changes infrequently
 */
export function useLearnTerms() {
  const { data, error, isLoading, mutate } = useSWR<LearnTermsResponse>(
    '/api/learn/terms',
    fetcher,
    {
      // Cache for 24 hours (terms don't change often)
      dedupingInterval: 24 * 60 * 60 * 1000,
      // Keep data fresh for 1 hour before background revalidation
      focusThrottleInterval: 60 * 60 * 1000,
      // Revalidate when the window regains focus
      revalidateOnFocus: true,
      // Revalidate when coming back online
      revalidateOnReconnect: true,
      // Don't retry on 404 errors (missing terms)
      shouldRetryOnError: (error) => error.status !== 404,
      // Keep previous data while revalidating
      keepPreviousData: true,
    }
  )

  return {
    terms: data?.terms || [],
    total: data?.total || 0,
    isLoading,
    error,
    mutate,
    // Helper methods
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching and caching learn progress data
 * Progress data is cached for 5 minutes for more frequent updates
 */
export function useLearnProgress() {
  const { data, error, isLoading, mutate } = useSWR<LearnProgressResponse>(
    '/api/learn/progress',
    fetcher,
    {
      // Cache for 5 minutes (progress changes more frequently)
      dedupingInterval: 5 * 60 * 1000,
      // Revalidate every 2 minutes in the background
      refreshInterval: 2 * 60 * 1000,
      // Revalidate when the window regains focus
      revalidateOnFocus: true,
      // Revalidate when coming back online
      revalidateOnReconnect: true,
      // Keep previous data while revalidating
      keepPreviousData: true,
    }
  )

  // Transform the raw API response into a more usable format
  const progress: LearnProgress = {
    completedTerms: data?.learnState?.completed_terms || [],
    totalTime: calculateTotalTime(data?.learnState?.reading_history || []),
    lastActive: data?.learnState?.updated_at || new Date().toISOString(),
  }

  return {
    progress,
    rawData: data?.learnState,
    isLoading,
    error,
    mutate,
    // Helper methods
    refetch: () => mutate(),
    // Optimistic update for progress changes
    updateProgress: async (newProgress: Partial<LearnProgress>) => {
      // Optimistically update the cache
      const currentData = data
      if (currentData) {
        const optimisticData = {
          ...currentData,
          learnState: {
            ...currentData.learnState,
            completed_terms: newProgress.completedTerms || currentData.learnState.completed_terms,
            updated_at: new Date().toISOString(),
          },
        }
        // Update cache immediately
        mutate(optimisticData, false)
      }
      // Then revalidate from server
      await mutate()
    },
  }
}

/**
 * Hook for fetching individual term data with caching
 * Individual terms are cached for 1 hour
 */
export function useLearnTerm(termId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    termId ? `/api/learn/terms/${termId}` : null,
    fetcher,
    {
      // Cache for 1 hour
      dedupingInterval: 60 * 60 * 1000,
      // Keep data fresh for 30 minutes before background revalidation
      focusThrottleInterval: 30 * 60 * 1000,
      // Revalidate when the window regains focus
      revalidateOnFocus: true,
      // Force fetch on mount if stale
      revalidateIfStale: true,
      // Always fetch on mount
      revalidateOnMount: true,
      // Don't retry on 404 errors (missing terms)
      shouldRetryOnError: (error) => error.status !== 404,
      // Keep previous data while revalidating
      keepPreviousData: true,
    }
  )

  return {
    term: data?.term || null,
    isLoading,
    error,
    mutate,
    refetch: () => mutate(),
  }
}

/**
 * Hook for fetching multiple related terms with caching
 * Prefetches related terms for faster navigation
 */
export function useRelatedTerms(termIds: string[]) {
  const { data, error, isLoading, mutate } = useSWR(
    termIds.length > 0 ? `related-terms-${termIds.join(',')}` : null,
    async () => {
      // Fetch all related terms in parallel
      const promises = termIds.slice(0, 3).map(async (relatedId: string) => {
        try {
          const response = await apiClient(`/api/learn/terms/${relatedId}`)
          if (response.ok) {
            const { term } = await response.json()
            return term
          }
        } catch (e) {
          logger.error('Failed to fetch related term', {
            relatedId,
            error: e,
            component: 'useRelatedTerms',
          })
        }
        return null
      })

      const related = await Promise.all(promises)
      return related.filter(Boolean)
    },
    {
      // Cache related terms for 1 hour
      dedupingInterval: 60 * 60 * 1000,
      // Don't revalidate too frequently
      focusThrottleInterval: 30 * 60 * 1000,
      revalidateOnFocus: false, // Don't revalidate related terms on focus
      keepPreviousData: true,
    }
  )

  return {
    relatedTerms: data || [],
    isLoading,
    error,
    mutate,
  }
}
