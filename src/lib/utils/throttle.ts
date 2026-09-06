/**
 * Throttling utility for managing API request rates
 * Prevents hitting rate limits and improves performance
 */

interface ThrottleConfig {
  maxConcurrent?: number
  delayMs?: number
  retryAttempts?: number
  backoffMultiplier?: number
}

/**
 * Execute promises with throttling to prevent rate limiting
 * @param promises Array of promise-returning functions
 * @param maxConcurrent Maximum concurrent executions (default: 2)
 * @param delayMs Delay between batches in milliseconds (default: 500)
 */
export async function throttledRequests<T>(
  promises: (() => Promise<T>)[],
  maxConcurrent: number = 2,
  delayMs: number = 500
): Promise<T[]> {
  const results: T[] = []

  for (let i = 0; i < promises.length; i += maxConcurrent) {
    const batch = promises.slice(i, i + maxConcurrent)
    const batchResults = await Promise.all(batch.map((fn) => fn()))
    results.push(...batchResults)

    // Add delay between batches (except for last batch)
    if (i + maxConcurrent < promises.length && delayMs > 0) {
      await sleep(delayMs)
    }
  }

  return results
}

/**
 * Execute a single promise with retry and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  backoffMultiplier: number = 2,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Check if error is rate limit related
      if (isRateLimitError(error)) {
        const delay = initialDelay * Math.pow(backoffMultiplier, attempt)
        console.log(
          `Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`
        )
        await sleep(delay)
      } else {
        // For non-rate-limit errors, throw immediately
        throw error
      }
    }
  }

  throw lastError!
}

/**
 * Create a rate-limited function wrapper
 */
export function createRateLimiter(
  requestsPerSecond: number = 5
): <T>(fn: () => Promise<T>) => Promise<T> {
  const queue: Array<{
    fn: () => Promise<any>
    resolve: (value: any) => void
    reject: (error: any) => void
  }> = []
  let processing = false
  const minDelay = 1000 / requestsPerSecond

  const processQueue = async () => {
    if (processing || queue.length === 0) return
    processing = true

    while (queue.length > 0) {
      const item = queue.shift()!
      const startTime = Date.now()

      try {
        const result = await item.fn()
        item.resolve(result)
      } catch (error) {
        item.reject(error)
      }

      // Ensure minimum delay between requests
      const elapsedTime = Date.now() - startTime
      if (elapsedTime < minDelay && queue.length > 0) {
        await sleep(minDelay - elapsedTime)
      }
    }

    processing = false
  }

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject })
      processQueue()
    })
  }
}

/**
 * Helper function to check if an error is rate limit related
 */
function isRateLimitError(error: any): boolean {
  if (!error) return false

  // Check for common rate limit indicators
  const errorMessage = error.message?.toLowerCase() || ''
  const statusCode = error.response?.status || error.statusCode || error.code

  return (
    statusCode === 429 ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorMessage.includes('throttl') ||
    error.code === 'RATE_LIMIT_EXCEEDED'
  )
}

/**
 * Sleep utility for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
