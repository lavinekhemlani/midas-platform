/**
 * Performance monitoring for report generation
 * Tracks duration, fallback usage, and performance issues
 */

import { logger } from '@/lib/logger'

export interface ReportPerformanceMetrics {
  reportType: 'profit_loss' | 'balance_sheet' | 'cash_flow' | 'summary'
  duration: number
  usedFallback: boolean
  success: boolean
  organizationId?: string
  error?: {
    message: string
    code?: string
    statusCode?: number
  }
  metadata?: {
    startDate?: string
    endDate?: string
    includeDetails?: boolean
    cacheHit?: boolean
  }
}

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
  SLOW: 5000, // 5 seconds
  CRITICAL: 10000, // 10 seconds
  WARNING: 3000, // 3 seconds
}

/**
 * Track report generation performance
 *
 * @param metrics - Performance metrics to track
 *
 * @example
 * const startTime = Date.now();
 * let usedFallback = false;
 * try {
 *   const report = await generateReport();
 *   trackReportGeneration({
 *     reportType: 'profit_loss',
 *     duration: Date.now() - startTime,
 *     usedFallback: false,
 *     success: true
 *   });
 * } catch (error) {
 *   trackReportGeneration({
 *     reportType: 'profit_loss',
 *     duration: Date.now() - startTime,
 *     usedFallback: false,
 *     success: false,
 *     error: { message: error.message }
 *   });
 * }
 */
export function trackReportGeneration(metrics: ReportPerformanceMetrics): void {
  const { reportType, duration, usedFallback, success, organizationId, error, metadata } = metrics

  // Base log data
  const logData = {
    reportType,
    duration: `${duration}ms`,
    durationSeconds: (duration / 1000).toFixed(2),
    usedFallback,
    success,
    organizationId,
    cacheHit: metadata?.cacheHit || false,
    timestamp: new Date().toISOString(),
    ...metadata,
  }

  // Determine severity level
  let severity: 'info' | 'warn' | 'error' = 'info'
  let performanceLevel: 'fast' | 'normal' | 'slow' | 'critical' = 'fast'

  if (!success) {
    severity = 'error'
    performanceLevel = 'critical'
  } else if (usedFallback) {
    severity = 'warn'
    performanceLevel = duration >= THRESHOLDS.CRITICAL ? 'critical' : 'slow'
  } else if (duration >= THRESHOLDS.CRITICAL) {
    severity = 'error'
    performanceLevel = 'critical'
  } else if (duration >= THRESHOLDS.SLOW) {
    severity = 'warn'
    performanceLevel = 'slow'
  } else if (duration >= THRESHOLDS.WARNING) {
    severity = 'info'
    performanceLevel = 'normal'
  }

  // Log with appropriate severity
  const message = `[Report Performance] ${reportType} - ${performanceLevel} (${duration}ms)`

  if (severity === 'error') {
    logger.error(message, {
      ...logData,
      performanceLevel,
      error,
      exceedsThreshold: duration >= THRESHOLDS.CRITICAL,
      thresholdExceeded: `${THRESHOLDS.CRITICAL}ms`,
    })
  } else if (severity === 'warn') {
    logger.warn(message, {
      ...logData,
      performanceLevel,
      exceedsThreshold: duration >= THRESHOLDS.SLOW,
      thresholdExceeded: usedFallback ? 'Using fallback path' : `${THRESHOLDS.SLOW}ms`,
    })
  } else {
    logger.info(message, {
      ...logData,
      performanceLevel,
    })
  }

  // Special alerts for critical scenarios
  if (usedFallback) {
    logger.warn('[ALERT] Report using slow fallback path - investigate QB API failure', {
      reportType,
      duration: `${duration}ms`,
      organizationId,
      message: 'QuickBooks official API failed, using manual aggregation fallback',
      impact: 'High - Users experiencing 10-30 second load times',
      recommendation: 'Investigate QuickBooks API integration immediately',
    })
  }

  if (duration >= THRESHOLDS.CRITICAL && !metadata?.cacheHit) {
    logger.error('[ALERT] Critical performance issue - report took >10 seconds', {
      reportType,
      duration: `${duration}ms`,
      usedFallback,
      organizationId,
      impact: 'Critical - User experience severely degraded',
      recommendation: usedFallback
        ? 'Fix QuickBooks API integration to avoid fallback'
        : 'Investigate slow query or network issues',
    })
  }
}

/**
 * Create a performance tracker for a report generation
 * Returns functions to mark fallback usage and complete tracking
 *
 * @param reportType - Type of report being generated
 * @param organizationId - Organization ID
 * @param metadata - Additional metadata
 *
 * @example
 * const tracker = createReportTracker('profit_loss', orgId, { startDate, endDate });
 *
 * try {
 *   const report = await officialAPI();
 * } catch (error) {
 *   tracker.markFallback();
 *   const report = await fallbackMethod();
 * }
 *
 * tracker.complete(true); // success
 */
export function createReportTracker(
  reportType: ReportPerformanceMetrics['reportType'],
  organizationId?: string,
  metadata?: ReportPerformanceMetrics['metadata']
) {
  const startTime = Date.now()
  let usedFallback = false
  let error: ReportPerformanceMetrics['error'] | undefined

  return {
    /**
     * Mark that the report generation is using fallback path
     */
    markFallback: () => {
      usedFallback = true
    },

    /**
     * Mark error occurred
     */
    markError: (err: any) => {
      error = {
        message: err?.message || 'Unknown error',
        code: err?.code,
        statusCode: err?.statusCode || err?.response?.status,
      }
    },

    /**
     * Complete tracking and log metrics
     */
    complete: (success: boolean = true) => {
      const duration = Date.now() - startTime

      trackReportGeneration({
        reportType,
        duration,
        usedFallback,
        success,
        organizationId,
        error,
        metadata,
      })
    },

    /**
     * Get current duration (useful for logging intermediate steps)
     */
    getDuration: () => {
      return Date.now() - startTime
    },
  }
}

/**
 * Log fallback usage with detailed context
 * This is called when QuickBooks official API fails and we fall back to manual aggregation
 */
export function logFallbackUsage(
  reportType: string,
  organizationId: string,
  reason?: string,
  errorDetails?: any
): void {
  logger.warn('[QuickBooks Fallback] Official report API failed, using manual aggregation', {
    reportType,
    organizationId,
    reason: reason || 'Official API call failed',
    errorDetails: errorDetails
      ? {
          message: errorDetails?.message,
          statusCode: errorDetails?.statusCode || errorDetails?.response?.status,
          code: errorDetails?.code,
        }
      : undefined,
    impact: 'High - Report generation will take 20-30 seconds instead of 2-3 seconds',
    timestamp: new Date().toISOString(),
  })
}
