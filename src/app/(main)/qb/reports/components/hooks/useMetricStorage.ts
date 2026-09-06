import { useEffect } from 'react'
import { logger } from '@/lib/logger'

/**
 * Hook for persisting metric data to sessionStorage
 * @param contextData - The metric data to store
 * @param dateRange - The date range for the report
 * @param isLoading - Whether the report is currently loading
 * @param shouldMerge - Whether to merge with existing data (default: true). Set to false to overwrite.
 */
export function useMetricStorage(
  contextData: Record<string, any>,
  dateRange: { start: string; end: string },
  isLoading: boolean,
  shouldMerge: boolean = true
) {
  useEffect(() => {
    if (!isLoading) {
      const hasData = Object.values(contextData).some(
        (value) => value !== 0 && value !== null && value !== undefined
      )

      if (hasData) {
        try {
          let dataToStore = contextData

          if (shouldMerge) {
            const existing = sessionStorage.getItem('reportMetrics')
            const existingData = existing ? JSON.parse(existing).data : {}
            dataToStore = { ...existingData, ...contextData }
          }

          sessionStorage.setItem(
            'reportMetrics',
            JSON.stringify({
              data: dataToStore,
              timestamp: Date.now(),
              dateRange: dateRange,
            })
          )
        } catch (error) {
          logger.error('Failed to store report metrics', { error, component: 'useMetricStorage' })
        }
      }
    }
  }, [contextData, dateRange, isLoading, shouldMerge])
}
