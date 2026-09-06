/**
 * QuickBooks Rate Limiter
 * Queue-based rate limiting with exponential backoff
 */

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum concurrent requests */
  maxConcurrent: number
  /** Maximum requests per second */
  requestsPerSecond: number
  /** Minimum delay between requests in ms */
  minDelayMs: number
  /** Maximum retries for rate limit errors */
  maxRetries: number
  /** Base retry delay in ms */
  retryDelayMs: number
  /** Maximum time to wait in queue in ms */
  maxQueueWaitMs: number
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxConcurrent: 3,
  requestsPerSecond: 8,
  minDelayMs: 125,
  maxRetries: 3,
  retryDelayMs: 2000,
  maxQueueWaitMs: 60000,
}

interface QueueItem<T> {
  execute: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
  addedAt: number
}

/**
 * Rate limiter for QuickBooks API requests
 * Implements queue-based throttling with configurable limits
 */
export class RateLimiter {
  private config: RateLimiterConfig
  private queue: QueueItem<unknown>[] = []
  private activeCount = 0
  private lastRequestTime = 0
  private recentRequests: number[] = []
  private processing = false

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        execute: fn,
        resolve: resolve as (value: unknown) => void,
        reject,
        addedAt: Date.now(),
      })
      this.processQueue()
    })
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true

    try {
      while (this.queue.length > 0) {
        // Check concurrent limit
        if (this.activeCount >= this.config.maxConcurrent) {
          await this.sleep(50)
          continue
        }

        // Clean old timestamps (older than 1 second)
        const now = Date.now()
        this.recentRequests = this.recentRequests.filter((t) => now - t < 1000)

        // Check rate limit
        if (this.recentRequests.length >= this.config.requestsPerSecond) {
          const waitTime = 1000 - (now - this.recentRequests[0]) + 10
          await this.sleep(waitTime)
          continue
        }

        // Check minimum delay
        const timeSinceLast = now - this.lastRequestTime
        if (timeSinceLast < this.config.minDelayMs) {
          await this.sleep(this.config.minDelayMs - timeSinceLast)
          continue
        }

        // Get next item
        const item = this.queue.shift()
        if (!item) continue

        // Check queue timeout
        if (now - item.addedAt > this.config.maxQueueWaitMs) {
          item.reject(new Error('Request timed out waiting in queue'))
          continue
        }

        // Execute request
        this.activeCount++
        this.lastRequestTime = Date.now()
        this.recentRequests.push(Date.now())

        this.executeWithRetry(item).finally(() => {
          this.activeCount--
        })
      }
    } finally {
      this.processing = false
    }
  }

  /**
   * Execute a request with retry logic for rate limit errors
   */
  private async executeWithRetry(item: QueueItem<unknown>, attempt = 0): Promise<void> {
    try {
      const result = await item.execute()
      item.resolve(result)
    } catch (error: unknown) {
      const isRateLimit = this.isRateLimitError(error)

      if (isRateLimit && attempt < this.config.maxRetries) {
        const delay = this.config.retryDelayMs * Math.pow(2, attempt)
        await this.sleep(delay)
        return this.executeWithRetry(item, attempt + 1)
      }

      item.reject(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Check if an error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, unknown>
      return err.status === 429 || err.statusCode === 429
    }
    return false
  }

  /**
   * Get current queue stats
   */
  getStats(): { queueLength: number; activeCount: number; recentRequests: number } {
    return {
      queueLength: this.queue.length,
      activeCount: this.activeCount,
      recentRequests: this.recentRequests.length,
    }
  }

  /**
   * Clear the queue (rejects all pending requests)
   */
  clear(): void {
    const error = new Error('Rate limiter queue cleared')
    while (this.queue.length > 0) {
      const item = this.queue.shift()
      item?.reject(error)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Global rate limiter instance
 */
let globalRateLimiter: RateLimiter | null = null

/**
 * Get or create global rate limiter
 */
export function getGlobalRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter()
  }
  return globalRateLimiter
}

/**
 * Reset global rate limiter (for testing)
 */
export function resetGlobalRateLimiter(): void {
  globalRateLimiter?.clear()
  globalRateLimiter = null
}
