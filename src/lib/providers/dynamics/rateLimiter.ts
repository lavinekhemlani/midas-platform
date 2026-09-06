// src/lib/providers/dynamics/rateLimiter.ts
/**
 * Rate Limiter for Business Central API
 *
 * BC API rate limits: ~300 requests per minute per tenant (configurable by BC admin).
 * We use conservative defaults to stay well under the limit.
 */

import { bcLogger } from './logger'

interface QueueItem<T> {
  fn: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: any) => void
  addedAt: number
  organizationId?: string
  endpoint?: string
}

interface RateLimiterConfig {
  maxConcurrent: number
  requestsPerSecond: number
  minDelayBetweenMs: number
  retryOnRateLimit: boolean
  maxRetries: number
  retryDelayMs: number
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxConcurrent: 8, // Increased from 6; BC supports many concurrent requests per tenant
  requestsPerSecond: 10, // ~600/min, matching BC's default limit
  minDelayBetweenMs: 0, // Removed artificial 100ms floor — the requestsPerSecond window handles pacing
  retryOnRateLimit: true,
  maxRetries: 3,
  retryDelayMs: 3000,
}

class BusinessCentralRateLimiter {
  private queue: QueueItem<any>[] = []
  private activeRequests: number = 0
  private lastRequestTime: number = 0
  private requestTimestamps: number[] = []
  private config: RateLimiterConfig
  private processing: boolean = false

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

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
      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true

    try {
      while (this.queue.length > 0) {
        if (this.activeRequests >= this.config.maxConcurrent) {
          await this.sleep(50)
          continue
        }

        const now = Date.now()
        this.requestTimestamps = this.requestTimestamps.filter((t) => now - t < 1000)
        if (this.requestTimestamps.length >= this.config.requestsPerSecond) {
          const oldestTimestamp = this.requestTimestamps[0]
          const waitTime = 1000 - (now - oldestTimestamp) + 10
          if (waitTime > 0) {
            await this.sleep(waitTime)
            continue
          }
        }

        const timeSinceLastRequest = now - this.lastRequestTime
        if (timeSinceLastRequest < this.config.minDelayBetweenMs) {
          await this.sleep(this.config.minDelayBetweenMs - timeSinceLastRequest)
        }

        const item = this.queue.shift()
        if (!item) break

        const waitTime = Date.now() - item.addedAt
        if (waitTime > 60000) {
          item.reject(
            new Error(`BC API request timed out in queue (waited ${Math.round(waitTime / 1000)}s)`)
          )
          continue
        }

        this.activeRequests++
        this.lastRequestTime = Date.now()
        this.requestTimestamps.push(Date.now())

        this.executeRequest(item)
      }
    } finally {
      this.processing = false
    }
  }

  private async executeRequest<T>(item: QueueItem<T>): Promise<void> {
    let lastError: any
    let retries = 0

    try {
      while (retries <= this.config.maxRetries) {
        try {
          const result = await item.fn()
          item.resolve(result)
          return
        } catch (error: any) {
          lastError = error

          if (this.isRateLimitError(error) && this.config.retryOnRateLimit) {
            retries++
            if (retries <= this.config.maxRetries) {
              const delay = this.config.retryDelayMs * Math.pow(2, retries - 1)
              bcLogger.warning(`BC rate limit hit, retrying in ${delay}ms`, {
                organizationId: item.organizationId,
                endpoint: item.endpoint,
              })
              await this.sleep(delay)
              continue
            }
          }

          throw error
        }
      }

      item.reject(lastError)
    } catch (error) {
      item.reject(error)
    } finally {
      this.activeRequests--
      if (this.queue.length > 0 && !this.processing) {
        this.processQueue()
      }
    }
  }

  private isRateLimitError(error: any): boolean {
    if (!error) return false
    const statusCode = error.status || error.statusCode
    const message = (error.message || '').toLowerCase()
    return (
      statusCode === 429 ||
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('throttl')
    )
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Per-organization rate limiters to prevent one heavy org from starving others.
 * Falls back to a shared default for unknown/missing orgIds.
 */
const orgRateLimiters = new Map<string, BusinessCentralRateLimiter>()
const defaultRateLimiter = new BusinessCentralRateLimiter()

export function getBCRateLimiter(organizationId?: string): BusinessCentralRateLimiter {
  if (!organizationId) return defaultRateLimiter
  let limiter = orgRateLimiters.get(organizationId)
  if (!limiter) {
    limiter = new BusinessCentralRateLimiter()
    orgRateLimiters.set(organizationId, limiter)
  }
  return limiter
}

// Backward-compatible default export for existing callers
export const bcRateLimiter = defaultRateLimiter
