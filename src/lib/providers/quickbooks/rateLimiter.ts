// src/lib/providers/quickbooks/rateLimiter.ts
/**
 * Global Rate Limiter for QuickBooks API
 *
 * QuickBooks Online has rate limits:
 * - ~10 requests per second per realm (company)
 * - ~500 requests per minute per realm
 *
 * This singleton rate limiter ensures ALL QuickBooks API calls go through
 * a single queue to prevent rate limit errors when multiple routes make
 * concurrent requests.
 */

import { qbLogger } from './logger'

interface QueueItem<T> {
  fn: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: any) => void
  addedAt: number
  organizationId?: string
  endpoint?: string
}

interface RateLimiterConfig {
  maxConcurrent: number // Max concurrent requests
  requestsPerSecond: number // Max requests per second
  minDelayBetweenMs: number // Minimum delay between requests
  retryOnRateLimit: boolean // Retry on 429 errors
  maxRetries: number // Max retries for rate limit errors
  retryDelayMs: number // Base delay for retry backoff
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxConcurrent: 2, // Conservative: only 2 concurrent requests
  requestsPerSecond: 5, // Stay well under 10/sec limit
  minDelayBetweenMs: 200, // 200ms minimum between requests
  retryOnRateLimit: true,
  maxRetries: 3,
  retryDelayMs: 2000, // 2 second base delay for retries
}

class QuickBooksRateLimiter {
  private queue: QueueItem<any>[] = []
  private activeRequests: number = 0
  private lastRequestTime: number = 0
  private requestTimestamps: number[] = [] // Track request times for rate limiting
  private config: RateLimiterConfig
  private processing: boolean = false
  private metrics: {
    totalRequests: number
    rateLimitHits: number
    successfulRequests: number
    failedRequests: number
    averageWaitTime: number
    totalWaitTime: number
  }

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.metrics = {
      totalRequests: 0,
      rateLimitHits: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageWaitTime: 0,
      totalWaitTime: 0,
    }
  }

  /**
   * Add a request to the queue and return a promise that resolves when complete
   */
  async request<T>(
    fn: () => Promise<T>,
    options?: { organizationId?: string; endpoint?: string }
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn,
        resolve,
        reject,
        addedAt: Date.now(),
        organizationId: options?.organizationId,
        endpoint: options?.endpoint,
      })

      this.metrics.totalRequests++
      this.processQueue()
    })
  }

  /**
   * Process the queue, respecting rate limits
   */
  private async processQueue(): Promise<void> {
    // Prevent multiple concurrent queue processors
    if (this.processing) return
    this.processing = true

    try {
      while (this.queue.length > 0) {
        // Check if we can make a request
        if (this.activeRequests >= this.config.maxConcurrent) {
          // Wait for a slot to open up
          await this.sleep(50)
          continue
        }

        // Check rate limit (requests per second)
        const now = Date.now()
        this.requestTimestamps = this.requestTimestamps.filter((t) => now - t < 1000)
        if (this.requestTimestamps.length >= this.config.requestsPerSecond) {
          // Wait until we can make another request
          const oldestTimestamp = this.requestTimestamps[0]
          const waitTime = 1000 - (now - oldestTimestamp) + 10 // Add 10ms buffer
          if (waitTime > 0) {
            await this.sleep(waitTime)
            continue
          }
        }

        // Ensure minimum delay between requests
        const timeSinceLastRequest = now - this.lastRequestTime
        if (timeSinceLastRequest < this.config.minDelayBetweenMs) {
          await this.sleep(this.config.minDelayBetweenMs - timeSinceLastRequest)
        }

        // Get the next item from the queue
        const item = this.queue.shift()
        if (!item) break

        // Track wait time
        const waitTime = Date.now() - item.addedAt
        this.metrics.totalWaitTime += waitTime
        this.metrics.averageWaitTime = this.metrics.totalWaitTime / this.metrics.totalRequests

        // Check if request has been waiting too long in queue (60 seconds max)
        const MAX_QUEUE_WAIT_MS = 60000
        if (waitTime > MAX_QUEUE_WAIT_MS) {
          console.error('[Rate Limiter] Request timed out waiting in queue', {
            waitTimeMs: waitTime,
            maxWaitMs: MAX_QUEUE_WAIT_MS,
            organizationId: item.organizationId,
            endpoint: item.endpoint,
          })
          item.reject(
            new Error(`Request timed out waiting in queue (waited ${Math.round(waitTime / 1000)}s)`)
          )
          this.metrics.failedRequests++
          continue
        }

        // Execute the request
        this.activeRequests++
        this.lastRequestTime = Date.now()
        this.requestTimestamps.push(Date.now())

        // Execute without awaiting to allow concurrent processing
        this.executeRequest(item)
      }
    } finally {
      this.processing = false
    }
  }

  /**
   * Execute a single request with retry logic for rate limits
   */
  private async executeRequest<T>(item: QueueItem<T>): Promise<void> {
    let lastError: any
    let retries = 0

    try {
      while (retries <= this.config.maxRetries) {
        try {
          const result = await item.fn()
          this.metrics.successfulRequests++
          item.resolve(result)
          return
        } catch (error: any) {
          lastError = error

          // Check if it's a rate limit error
          if (this.isRateLimitError(error) && this.config.retryOnRateLimit) {
            this.metrics.rateLimitHits++
            retries++

            if (retries <= this.config.maxRetries) {
              // Exponential backoff: 2s, 4s, 8s
              const delay = this.config.retryDelayMs * Math.pow(2, retries - 1)
              qbLogger.warning(`Rate limit hit, retrying in ${delay}ms`, {
                organizationId: item.organizationId,
                endpoint: item.endpoint,
                attempt: retries,
                maxRetries: this.config.maxRetries,
              })
              await this.sleep(delay)
              continue
            }
          }

          // Non-rate-limit error or max retries exceeded
          throw error
        }
      }

      // Max retries exceeded
      this.metrics.failedRequests++
      item.reject(lastError)
    } catch (error) {
      this.metrics.failedRequests++
      item.reject(error)
    } finally {
      this.activeRequests--
      // Continue processing the queue
      if (this.queue.length > 0 && !this.processing) {
        this.processQueue()
      }
    }
  }

  /**
   * Check if an error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    if (!error) return false

    const errorMessage = (error.message || '').toLowerCase()
    const statusCode = error.response?.status || error.statusCode || error.status

    return (
      statusCode === 429 ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('throttl') ||
      error.code === 'RATE_LIMIT_EXCEEDED'
    )
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get current queue status and metrics
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      metrics: { ...this.metrics },
      config: { ...this.config },
    }
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      rateLimitHits: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageWaitTime: 0,
      totalWaitTime: 0,
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimiterConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Clear the queue (cancels all pending requests)
   */
  clearQueue(): void {
    while (this.queue.length > 0) {
      const item = this.queue.shift()
      item?.reject(new Error('Queue cleared'))
    }
  }
}

// Export a singleton instance
// This ensures ALL QuickBooks API calls across the application go through the same rate limiter
export const qbRateLimiter = new QuickBooksRateLimiter()

// Export the class for testing purposes
export { QuickBooksRateLimiter }
export type { RateLimiterConfig }
