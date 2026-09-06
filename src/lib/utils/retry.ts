/**
 * Retry Utilities
 * Exponential backoff with jitter for resilient retry logic
 */

// Default configuration
export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.3, // 0-30% random jitter
} as const

/**
 * Calculate retry delay with exponential backoff and jitter
 *
 * @param attempt - Zero-based attempt number (0 = first retry)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @param maxDelay - Maximum delay cap in milliseconds (default: 30000)
 * @param jitterFactor - Random jitter factor 0-1 (default: 0.3 = 30%)
 * @returns Delay in milliseconds
 *
 * @example
 * getRetryDelay(0) // ~1000ms (first retry)
 * getRetryDelay(1) // ~2000ms (second retry)
 * getRetryDelay(2) // ~4000ms (third retry)
 * getRetryDelay(3) // ~8000ms (fourth retry)
 */
export function getRetryDelay(
  attempt: number,
  baseDelay: number = RETRY_CONFIG.baseDelayMs,
  maxDelay: number = RETRY_CONFIG.maxDelayMs,
  jitterFactor: number = RETRY_CONFIG.jitterFactor
): number {
  // Exponential: base * 2^attempt
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)

  // Add random jitter to prevent thundering herd
  const jitter = Math.random() * jitterFactor * exponentialDelay

  return Math.floor(exponentialDelay + jitter)
}

/**
 * Check if we should retry based on attempt count
 */
export function shouldRetry(attempt: number, maxRetries = RETRY_CONFIG.maxRetries): boolean {
  return attempt < maxRetries
}

/**
 * Get human-readable retry status
 */
export function getRetryStatus(
  attempt: number,
  maxRetries = RETRY_CONFIG.maxRetries
): {
  currentAttempt: number
  maxRetries: number
  retriesRemaining: number
  retriesExhausted: boolean
} {
  return {
    currentAttempt: attempt + 1, // 1-based for display
    maxRetries,
    retriesRemaining: Math.max(0, maxRetries - attempt - 1),
    retriesExhausted: attempt >= maxRetries,
  }
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Execute a function with retry logic
 *
 * @param fn - Async function to execute
 * @param options - Retry options
 * @returns Result of the function or throws after max retries
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    baseDelay?: number
    maxDelay?: number
    onRetry?: (attempt: number, error: Error, delay: number) => void
    shouldRetry?: (error: Error) => boolean
  } = {}
): Promise<T> {
  const {
    maxRetries = RETRY_CONFIG.maxRetries,
    baseDelay = RETRY_CONFIG.baseDelayMs,
    maxDelay = RETRY_CONFIG.maxDelayMs,
    onRetry,
    shouldRetry: shouldRetryFn = () => true,
  } = options

  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if we should retry this error
      if (!shouldRetryFn(lastError)) {
        throw lastError
      }

      // Check if we have retries remaining
      if (attempt >= maxRetries) {
        throw lastError
      }

      // Calculate delay and wait
      const delay = getRetryDelay(attempt, baseDelay, maxDelay)
      onRetry?.(attempt, lastError, delay)
      await sleep(delay)
    }
  }

  throw lastError!
}
