// src/lib/auth/retry/handler.ts
/**
 * Generic retry handler with exponential backoff
 * Provides reusable retry logic for various operations
 *
 * @deprecated Use RetryManager from '@/lib/retry' instead. This wrapper is maintained for backwards compatibility.
 */

import { RETRY_CONFIG } from '../constants'
import type { RetryOptions } from '../types'
import { RetryManager } from '@/lib/retry'
import type { RetryOptions as UnifiedRetryOptions } from '@/lib/retry'

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: RETRY_CONFIG.MAX_ATTEMPTS,
  baseDelay: RETRY_CONFIG.BASE_DELAY,
  backoffMultiplier: RETRY_CONFIG.BACKOFF_MULTIPLIER,
}

/**
 * Generic retry handler class
 *
 * @deprecated Use RetryManager from '@/lib/retry' instead. This class delegates to RetryManager
 * for backwards compatibility but will be removed in a future version.
 */
export class RetryHandler {
  /**
   * Execute an async operation with retry logic
   * @param operation The async function to execute
   * @param options Retry configuration options
   * @param context Optional context for logging
   * @returns The result of the operation
   * @throws The last error if all retries fail
   *
   * @deprecated Use RetryManager.withRetry() instead
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    context?: string
  ): Promise<T> {
    const config = { ...DEFAULT_OPTIONS, ...options }

    // Convert to UnifiedRetryOptions
    const unifiedOptions: UnifiedRetryOptions = {
      maxAttempts: config.maxAttempts,
      baseDelay: config.baseDelay,
      backoffStrategy: 'exponential',
      backoffMultiplier: config.backoffMultiplier,
      retryCondition: config.shouldRetry
        ? (error: Error, _attempt: number) => config.shouldRetry!(error)
        : undefined,
      context,
    }

    // Delegate to RetryManager
    return RetryManager.withRetry(operation, unifiedOptions)
  }

  /**
   * Calculate exponential backoff delay
   * @param attempt Current attempt number (0-indexed)
   * @param baseDelay Base delay in milliseconds
   * @param multiplier Backoff multiplier
   * @returns Delay in milliseconds
   *
   * @deprecated Internal method, no longer used
   */
  private static calculateDelay(attempt: number, baseDelay: number, multiplier: number): number {
    return Math.pow(multiplier, attempt) * baseDelay
  }

  /**
   * Sleep for specified milliseconds
   * @param ms Milliseconds to sleep
   *
   * @deprecated Internal method, no longer used
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Execute operation with custom retry delays (for specific scenarios)
   * @param operation The async function to execute
   * @param delays Array of delays in milliseconds between retries
   * @param context Optional context for logging
   * @returns The result of the operation
   *
   * @deprecated Use RetryManager.withRetry() with customDelays option instead
   */
  static async withCustomDelays<T>(
    operation: () => Promise<T>,
    delays: number[],
    context?: string
  ): Promise<T> {
    // Delegate to RetryManager with custom delays
    return RetryManager.withRetry(operation, {
      maxAttempts: delays.length + 1,
      customDelays: delays,
      context,
    })
  }
}
