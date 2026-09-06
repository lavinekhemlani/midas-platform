// src/lib/auth/jwks/fetcher.ts
/**
 * Custom JWKS fetcher with retry logic and rate limiting
 * Implements the Fetcher interface required by aws-jwt-verify
 */

import type { Fetcher } from 'aws-jwt-verify/https'
import { AUTH_CONFIG, RETRY_CONFIG, HTTP_CONFIG } from '../constants'
import { RetryHandler } from '../retry/handler'
import { shouldRetryJwksFetch } from '../retry/strategies'
import { logger } from '../../logger'

/**
 * Custom JWKS fetcher with rate limiting and retry logic
 */
export class JwksFetcher implements Fetcher {
  private static lastFetchTime = 0

  /**
   * Fetch JWKS from the specified URI
   * @param uri The JWKS URI to fetch from
   * @returns The JWKS data as ArrayBuffer
   */
  public async fetch(uri: string): Promise<ArrayBuffer> {
    // Apply rate limiting
    await this.applyRateLimit()

    // Fetch with retry logic
    return RetryHandler.withRetry(
      () => this.fetchOnce(uri),
      {
        maxAttempts: RETRY_CONFIG.MAX_ATTEMPTS,
        baseDelay: RETRY_CONFIG.BASE_DELAY,
        backoffMultiplier: RETRY_CONFIG.BACKOFF_MULTIPLIER,
        shouldRetry: shouldRetryJwksFetch,
      },
      `JWKS fetch from ${uri}`
    )
  }

  /**
   * Apply rate limiting between JWKS fetches
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastFetch = now - JwksFetcher.lastFetchTime

    if (timeSinceLastFetch < AUTH_CONFIG.JWKS_MIN_FETCH_INTERVAL) {
      const waitTime = AUTH_CONFIG.JWKS_MIN_FETCH_INTERVAL - timeSinceLastFetch
      logger.debug(`Rate limiting JWKS fetch, waiting ${waitTime}ms`)
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }

    JwksFetcher.lastFetchTime = Date.now()
  }

  /**
   * Perform a single fetch attempt
   * @param uri The JWKS URI to fetch from
   * @returns The JWKS data as ArrayBuffer
   */
  private async fetchOnce(uri: string): Promise<ArrayBuffer> {
    logger.debug(`Fetching JWKS from ${uri}`)

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), AUTH_CONFIG.JWKS_FETCH_TIMEOUT)

    try {
      const response = await fetch(uri, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'User-Agent': HTTP_CONFIG.USER_AGENT,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Check response status
      if (!response.ok) {
        const error: any = new Error(`HTTP error! status: ${response.status}`)
        error.response = { status: response.status }
        throw error
      }

      logger.debug('JWKS fetch successful')

      // Convert to ArrayBuffer as required by aws-jwt-verify
      return await response.arrayBuffer()
    } catch (fetchError: any) {
      clearTimeout(timeoutId)

      // Handle abort error (timeout)
      if (fetchError.name === 'AbortError') {
        fetchError.message = `Request timeout after ${AUTH_CONFIG.JWKS_FETCH_TIMEOUT / 1000} seconds`
      }

      throw fetchError
    }
  }

  /**
   * Reset the rate limiter (useful for testing)
   */
  public static resetRateLimit(): void {
    JwksFetcher.lastFetchTime = 0
  }
}
