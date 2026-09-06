// src/lib/auth/jwks/cache-manager.ts
/**
 * Singleton JWKS cache manager
 * Manages the lifecycle of JWKS cache instances with backoff support
 */

import { SimpleJwksCache } from 'aws-jwt-verify/jwk'
import { AUTH_CONFIG } from '../constants'
import { JwksFetcher } from './fetcher'
import { logger } from '../../logger'

/**
 * Manages JWKS cache lifecycle and backoff state
 */
export class JwksCacheManager {
  private static instance: SimpleJwksCache | null = null
  private static lastClearTime = 0
  private static backoffEndTime = 0

  /**
   * Get or create the JWKS cache instance
   * @returns The singleton cache instance
   */
  static getCache(): SimpleJwksCache {
    const now = Date.now()

    // Log backoff status if active
    if (this.isBackoffActive()) {
      logger.debug(`JWKS cache in backoff until ${new Date(this.backoffEndTime).toISOString()}`)
    }

    // Create or recreate cache if needed
    if (this.shouldRecreateCache(now)) {
      logger.debug('Creating new JWKS cache instance')

      this.instance = new SimpleJwksCache({
        fetcher: new JwksFetcher(),
        // @ts-ignore - These options might not be in type definitions but are supported
        maxAge: AUTH_CONFIG.JWKS_KEY_MAX_AGE,
        maxSize: AUTH_CONFIG.JWKS_MAX_CACHE_SIZE,
      })

      this.lastClearTime = now
      this.backoffEndTime = 0 // Reset backoff when creating new cache
    }

    return this.instance!
  }

  /**
   * Check if cache should be recreated
   * @param now Current timestamp
   * @returns true if cache should be recreated
   */
  private static shouldRecreateCache(now: number): boolean {
    // No instance exists
    if (!this.instance) {
      return true
    }

    // Cache lifetime exceeded
    const cacheAge = now - this.lastClearTime
    return cacheAge > AUTH_CONFIG.JWKS_CACHE_LIFETIME
  }

  /**
   * Check if backoff is currently active
   * @returns true if in backoff period
   */
  static isBackoffActive(): boolean {
    return this.backoffEndTime > Date.now()
  }

  /**
   * Set a backoff period (prevents immediate retry after errors)
   * @param durationMs Backoff duration in milliseconds
   */
  static setBackoff(durationMs: number = AUTH_CONFIG.DEFAULT_BACKOFF_DURATION): void {
    this.backoffEndTime = Date.now() + durationMs
    logger.debug(
      `Setting JWKS backoff for ${durationMs}ms until ${new Date(this.backoffEndTime).toISOString()}`
    )
  }

  /**
   * Clear the backoff period
   */
  static clearBackoff(): void {
    if (this.backoffEndTime > 0) {
      logger.debug('JWKS backoff cleared')
      this.backoffEndTime = 0
    }
  }

  /**
   * Reset the cache (creates new instance on next getCache call)
   */
  static resetCache(): void {
    logger.debug('Resetting JWKS cache')
    this.instance = null
    this.lastClearTime = 0
    this.backoffEndTime = 0
  }

  /**
   * Get cache metadata for debugging
   * @returns Cache state information
   */
  static getCacheMetadata() {
    const now = Date.now()
    const cacheAge = this.instance ? now - this.lastClearTime : 0
    const backoffRemaining = Math.max(0, this.backoffEndTime - now)

    return {
      hasInstance: !!this.instance,
      cacheAge,
      cacheAgeMinutes: Math.floor(cacheAge / 60000),
      isBackoffActive: this.isBackoffActive(),
      backoffRemaining,
      lastClearTime: this.lastClearTime > 0 ? new Date(this.lastClearTime).toISOString() : null,
      backoffEndTime: this.backoffEndTime > 0 ? new Date(this.backoffEndTime).toISOString() : null,
    }
  }
}
