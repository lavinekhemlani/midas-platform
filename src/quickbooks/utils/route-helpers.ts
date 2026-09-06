/**
 * Route Helper Utilities for QuickBooks Reports
 *
 * Shared utilities for API route handlers to reduce code duplication.
 * Includes retry logic, date validation, and error response formatting.
 */

import { NextResponse } from 'next/server'

/**
 * Retry wrapper with exponential backoff for rate-limited API calls
 *
 * @param fn - Async function to execute with retry logic
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in milliseconds for exponential backoff (default: 2000ms)
 * @returns Promise resolving to the function result
 * @throws Last error if all retries are exhausted
 *
 * @example
 * ```ts
 * const data = await withRetry(
 *   () => client.request('/reports/ProfitAndLoss'),
 *   3,
 *   2000
 * )
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000
): Promise<T> {
  let lastError: any

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      const errorMessage = error?.message || ''
      const isRateLimited =
        errorMessage.includes('429') ||
        errorMessage.includes('rate limit') ||
        error?.code === 'RATE_LIMIT_EXCEEDED'

      // If not rate limited or out of retries, throw immediately
      if (!isRateLimited || attempt === maxRetries) {
        throw error
      }

      // Exponential backoff: 2s, 4s, 8s
      const delay = baseDelay * Math.pow(2, attempt)
      console.warn(
        `[QuickBooks API] Rate limited, retry ${attempt + 1}/${maxRetries} after ${delay}ms`
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * Date range validation result
 */
export interface DateValidationResult {
  valid: boolean
  error?: {
    message: string
    suggestion: string
    statusCode: number
  }
}

/**
 * Validates date range for QuickBooks report queries
 *
 * Checks for:
 * - Valid date objects
 * - Start date before end date
 * - Reasonable date range (max 5 years)
 *
 * @param start - Start date
 * @param end - End date
 * @param maxYears - Maximum allowed years in range (default: 5)
 * @returns Validation result with error details if invalid
 *
 * @example
 * ```ts
 * const validation = validateDateRange(startDate, endDate)
 * if (!validation.valid) {
 *   return NextResponse.json(validation.error, { status: validation.error.statusCode })
 * }
 * ```
 */
export function validateDateRange(
  start: Date,
  end: Date,
  maxYears: number = 11
): DateValidationResult {
  // Check for invalid dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      valid: false,
      error: {
        message: 'Invalid date format',
        suggestion: 'Please provide dates in YYYY-MM-DD format',
        statusCode: 400,
      },
    }
  }

  // Check start date is before end date
  if (start > end) {
    return {
      valid: false,
      error: {
        message: 'Invalid date range',
        suggestion: 'Start date must be before end date',
        statusCode: 400,
      },
    }
  }

  // Check for unreasonably long periods
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  const maxDays = maxYears * 365
  if (daysDiff > maxDays) {
    return {
      valid: false,
      error: {
        message: 'Date range too large',
        suggestion: `Please select a period of ${maxYears} years or less`,
        statusCode: 400,
      },
    }
  }

  return { valid: true }
}

/**
 * Error response configuration
 */
export interface ErrorResponseConfig {
  message: string
  suggestion: string
  statusCode: number
  retryAfter?: number
  details?: string
  code?: string
  requiresReconnect?: boolean
  provider?: string
}

/**
 * Formats consistent error responses for QuickBooks API routes
 *
 * Analyzes error types and provides user-friendly messages with suggestions.
 * Handles common QuickBooks errors: authentication, rate limiting, timeouts.
 *
 * @param error - Error object or unknown error
 * @param defaultMessage - Default error message if type cannot be determined
 * @returns NextResponse with formatted error JSON and appropriate status code
 *
 * @example
 * ```ts
 * try {
 *   const data = await client.request('/reports/ProfitAndLoss')
 *   return NextResponse.json(data)
 * } catch (error) {
 *   return formatErrorResponse(error, 'Failed to generate profit & loss report')
 * }
 * ```
 */
export function formatErrorResponse(error: unknown, defaultMessage: string): NextResponse {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  const errorCode = (error as any)?.code
  const requiresReconnect = (error as any)?.requiresReconnect
  console.error('[QuickBooks Route] Error:', errorMessage, { code: errorCode })

  const config: ErrorResponseConfig = {
    message: defaultMessage,
    suggestion: 'Please try again or contact support',
    statusCode: 500,
  }

  // Check for error code property first (set by QuickBooksClient)
  if (errorCode === 'PROVIDER_INVALID_GRANT' || requiresReconnect) {
    config.statusCode = 401
    config.message = 'QuickBooks authentication expired'
    config.suggestion = 'Please reconnect your QuickBooks account in settings'
    config.code = 'PROVIDER_INVALID_GRANT'
    config.requiresReconnect = true
    config.provider = 'quickbooks'
  }
  // Authentication errors (check message patterns)
  else if (
    errorMessage.includes('No valid token') ||
    errorMessage.includes('TOKEN_EXPIRED') ||
    errorMessage.includes('invalid_grant') ||
    errorMessage.includes('authentication failed')
  ) {
    config.statusCode = 401
    config.message = 'QuickBooks authentication required'
    config.suggestion = 'Please reconnect your QuickBooks account in settings'
    config.code = 'PROVIDER_INVALID_GRANT'
    config.requiresReconnect = true
    config.provider = 'quickbooks'
  }
  // Not connected errors
  else if (errorMessage.includes('not connected')) {
    config.statusCode = 401
    config.message = 'QuickBooks account not connected'
    config.suggestion = 'Please reconnect your QuickBooks account in settings'
    config.code = 'PROVIDER_NOT_CONNECTED'
    config.requiresReconnect = true
    config.provider = 'quickbooks'
  }
  // Rate limit errors
  else if (
    errorMessage.includes('rate limit') ||
    errorMessage.includes('429') ||
    (error as any)?.code === 'RATE_LIMIT_EXCEEDED'
  ) {
    config.statusCode = 429
    config.message = 'QuickBooks rate limit exceeded'
    config.suggestion =
      'QuickBooks has rate limited your requests. Please wait a few minutes and try again.'
    config.retryAfter = 120 // 2 minutes
  }
  // Timeout errors
  else if (errorMessage.includes('timeout')) {
    config.statusCode = 504
    config.message = 'Request timed out'
    config.suggestion = 'Try selecting a smaller date range'
  }

  // Add detailed error message in development mode
  if (process.env.NODE_ENV === 'development') {
    config.details = errorMessage
  }

  const response = NextResponse.json(
    {
      error: config.message,
      suggestion: config.suggestion,
      ...(config.code && { code: config.code }),
      ...(config.requiresReconnect && { requiresReconnect: config.requiresReconnect }),
      ...(config.provider && { provider: config.provider }),
      ...(config.details && { details: config.details }),
      timestamp: new Date().toISOString(),
      ...(config.retryAfter && { retryAfter: config.retryAfter }),
    },
    { status: config.statusCode }
  )

  // Add Retry-After header for rate limit errors
  if (config.retryAfter) {
    response.headers.set('Retry-After', config.retryAfter.toString())
  }

  return response
}

/**
 * Helper to format dates for QuickBooks reports
 * Re-exported from report-helpers for convenience
 */
export { formatReportDate } from './report-helpers'
