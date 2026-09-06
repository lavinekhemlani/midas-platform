// src/lib/retry/RetryManager.ts

import { logger } from '@/lib/logger'

export interface RetryOptions {
  /** Maximum retry attempts (default: 3) */
  maxAttempts?: number
  /** Base delay in milliseconds (default: 1000) */
  baseDelay?: number
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelay?: number
  /** Backoff strategy (default: 'exponential') */
  backoffStrategy?: 'exponential' | 'linear' | 'fixed'
  /** Backoff multiplier for exponential (default: 2) */
  backoffMultiplier?: number
  /** Add random jitter (default: false) */
  jitter?: boolean
  /** Jitter factor 0-1 (default: 0.25) */
  jitterFactor?: number
  /** Custom delay array (overrides backoff) */
  customDelays?: number[]
  /** Predicate to check if error should be retried */
  retryCondition?: (error: Error, attempt: number) => boolean
  /** Callback before each retry */
  onRetry?: (error: Error, attempt: number, delay: number) => void | Promise<void>
  /** Context string for logging */
  context?: string
}

/**
 * Default retry condition - retry on network/timeout errors
 */
export function defaultRetryCondition(error: Error): boolean {
  const msg = error.message.toLowerCase()

  // Retry on these errors
  if (msg.includes('rate limit') || msg.includes('429')) return true
  if (msg.includes('timeout') || msg.includes('etimedout')) return true
  if (msg.includes('econnrefused') || msg.includes('network')) return true
  if (msg.includes('503') || msg.includes('502') || msg.includes('504')) return true
  if (msg.includes('fetch failed')) return true

  // Don't retry auth errors
  if (msg.includes('401') || msg.includes('403') || msg.includes('400')) return false
  if (msg.includes('unauthorized') || msg.includes('forbidden')) return false

  return false
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate delay based on strategy
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  strategy: 'exponential' | 'linear' | 'fixed',
  multiplier: number,
  maxDelay: number,
  jitter: boolean,
  jitterFactor: number
): number {
  let delay: number

  switch (strategy) {
    case 'exponential':
      delay = baseDelay * Math.pow(multiplier, attempt)
      break
    case 'linear':
      delay = baseDelay * (attempt + 1)
      break
    case 'fixed':
    default:
      delay = baseDelay
  }

  // Cap at maxDelay
  delay = Math.min(delay, maxDelay)

  // Add jitter if enabled
  if (jitter) {
    const jitterAmount = delay * jitterFactor * (Math.random() * 2 - 1)
    delay = Math.max(100, delay + jitterAmount)
  }

  return Math.round(delay)
}

/**
 * Unified retry manager for async operations
 */
export class RetryManager {
  /**
   * Execute an async operation with retry logic
   */
  static async withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      backoffStrategy = 'exponential',
      backoffMultiplier = 2,
      jitter = false,
      jitterFactor = 0.25,
      customDelays,
      retryCondition = defaultRetryCondition,
      onRetry,
      context,
    } = options

    let lastError: Error = new Error('No attempts made')

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await operation()

        if (attempt > 0 && context) {
          logger.debug(`[RetryManager] Success on attempt ${attempt + 1} for ${context}`)
        }

        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Check if we should retry
        if (!retryCondition(lastError, attempt)) {
          if (context) {
            logger.debug(`[RetryManager] Error not retryable for ${context}: ${lastError.message}`)
          }
          throw lastError
        }

        // Don't delay after last attempt
        if (attempt === maxAttempts - 1) {
          break
        }

        // Calculate delay
        let delay: number
        if (customDelays && attempt < customDelays.length) {
          delay = customDelays[attempt]
        } else {
          delay = calculateDelay(
            attempt,
            baseDelay,
            backoffStrategy,
            backoffMultiplier,
            maxDelay,
            jitter,
            jitterFactor
          )
        }

        if (context) {
          logger.debug(
            `[RetryManager] Retry ${attempt + 1}/${maxAttempts} for ${context}, waiting ${delay}ms`
          )
        }

        // Call onRetry callback
        if (onRetry) {
          await onRetry(lastError, attempt, delay)
        }

        await sleep(delay)
      }
    }

    // All retries exhausted
    const operationDesc = context || 'operation'
    logger.error(`[RetryManager] All ${maxAttempts} attempts failed for ${operationDesc}`)
    throw lastError
  }

  /**
   * Execute a generator with retry logic (for streaming)
   * If the generator fails, it will be restarted from the beginning
   */
  static async *withRetryGenerator<T>(
    generatorFn: () => AsyncGenerator<T>,
    options: RetryOptions = {}
  ): AsyncGenerator<T> {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      customDelays,
      retryCondition = defaultRetryCondition,
      onRetry,
      context,
    } = options

    let attempt = 0

    while (attempt < maxAttempts) {
      try {
        yield* generatorFn()
        return // Success - exit
      } catch (error) {
        const typedError = error instanceof Error ? error : new Error(String(error))

        // Check if we should retry
        if (!retryCondition(typedError, attempt) || attempt === maxAttempts - 1) {
          if (context) {
            logger.error(`[RetryManager] Stream failed for ${context}: ${typedError.message}`)
          }
          throw typedError
        }

        // Calculate delay
        let delay: number
        if (customDelays && attempt < customDelays.length) {
          delay = customDelays[attempt]
        } else {
          delay = baseDelay * Math.pow(2, attempt)
        }

        if (context) {
          logger.debug(
            `[RetryManager] Stream retry ${attempt + 1}/${maxAttempts} for ${context}, waiting ${delay}ms`
          )
        }

        // Call onRetry callback
        if (onRetry) {
          await onRetry(typedError, attempt, delay)
        }

        await sleep(delay)
        attempt++
      }
    }
  }
}

export default RetryManager
