// src/lib/auth/jwks/verifier-factory.ts
/**
 * Factory for creating and caching JWT verifiers
 * Manages verifier lifecycle and provides cache warming utilities
 */

import { CognitoJwtVerifier } from 'aws-jwt-verify'
import type { TokenUse } from '../types'
import { AUTH_CONFIG, HTTP_CONFIG } from '../constants'
import { JwksCacheManager } from './cache-manager'
import { logger } from '../../logger'

/**
 * Factory for creating and managing Cognito JWT verifiers
 */
export class VerifierFactory {
  private static verifiers = new Map<string, any>()
  private static verifierCreationTimes = new Map<string, number>()

  /**
   * Get or create a JWT verifier for the specified token type
   * @param tokenUse The type of token ('access' or 'id')
   * @returns A configured JWT verifier
   */
  static getVerifier(tokenUse: TokenUse) {
    const userPoolId = process.env.COGNITO_USER_POOL_ID
    const clientId = process.env.COGNITO_USER_POOL_CLIENT_ID

    if (!userPoolId || !clientId) {
      const missing = []
      if (!userPoolId) missing.push('COGNITO_USER_POOL_ID')
      if (!clientId) missing.push('COGNITO_USER_POOL_CLIENT_ID')
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }

    // Use pool ID + token use as cache key
    const key = `${userPoolId}-${tokenUse}`
    const now = Date.now()

    // Check if verifier should be recreated
    if (this.shouldRecreateVerifier(key, now)) {
      this.createVerifier(key, tokenUse, userPoolId, clientId, now)
    }

    return this.verifiers.get(key)
  }

  /**
   * Check if verifier should be recreated
   * @param key Verifier cache key
   * @param now Current timestamp
   * @returns true if verifier should be recreated
   */
  private static shouldRecreateVerifier(key: string, now: number): boolean {
    // Verifier doesn't exist
    if (!this.verifiers.has(key)) {
      return true
    }

    // Check verifier age
    const creationTime = this.verifierCreationTimes.get(key) || 0
    const verifierAge = now - creationTime

    return verifierAge > AUTH_CONFIG.VERIFIER_LIFETIME
  }

  /**
   * Create a new verifier instance
   * @param key Cache key
   * @param tokenUse Token type
   * @param userPoolId Cognito user pool ID
   * @param clientId Cognito client ID
   * @param now Current timestamp
   */
  private static createVerifier(
    key: string,
    tokenUse: TokenUse,
    userPoolId: string,
    clientId: string,
    now: number
  ): void {
    const creationTime = this.verifierCreationTimes.get(key) || 0
    const age = creationTime > 0 ? Math.round((now - creationTime) / 1000) : 0
    const ageInfo = creationTime > 0 ? ` (age: ${age}s)` : ' (new)'

    logger.debug(`Creating/refreshing verifier for ${tokenUse} token${ageInfo}`)

    const verifier = CognitoJwtVerifier.create(
      {
        userPoolId,
        tokenUse,
        clientId,
        clockTolerance: AUTH_CONFIG.CLOCK_TOLERANCE,
        httpOptions: {
          fetchOptions: {
            cache: 'no-cache',
            headers: {
              'User-Agent': HTTP_CONFIG.USER_AGENT,
            },
          },
        },
      },
      {
        jwksCache: JwksCacheManager.getCache(),
      }
    )

    this.verifiers.set(key, verifier)
    this.verifierCreationTimes.set(key, now)
  }

  /**
   * Clear all cached verifiers
   */
  static clearCache(): void {
    this.verifiers.clear()
    this.verifierCreationTimes.clear()
    JwksCacheManager.resetCache()
    logger.debug('Verifier factory and JWKS cache cleared')
  }

  /**
   * Warm up the cache by pre-creating verifiers
   * This is an optimization to avoid cold-start delays
   */
  static async warmCache(): Promise<void> {
    try {
      logger.debug('Warming up JWKS cache')

      // Pre-create both access and ID token verifiers
      this.getVerifier('access')
      this.getVerifier('id')

      logger.debug('JWKS cache warmed up successfully')
    } catch (error) {
      logger.warn('Failed to warm JWKS cache', { error })
      // Don't throw - warming is optional optimization
    }
  }

  /**
   * Start periodic cache refresh (for long-running processes)
   * Not suitable for serverless environments
   * @param intervalMs Refresh interval in milliseconds
   * @returns Timer ID or null if disabled
   */
  static startCacheRefresh(
    intervalMs: number = AUTH_CONFIG.CACHE_REFRESH_INTERVAL
  ): NodeJS.Timeout | null {
    // Disable in serverless environments
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      logger.debug('Cache refresh disabled in serverless environment')
      return null
    }

    logger.debug(`Starting JWKS cache refresh every ${intervalMs / 1000}s`)

    return setInterval(() => {
      try {
        this.refreshStaleVerifiers()
        this.clearOldBackoffs()
      } catch (error) {
        logger.error('Error during cache refresh', { error })
      }
    }, intervalMs)
  }

  /**
   * Refresh verifiers that are approaching their lifetime limit
   */
  private static refreshStaleVerifiers(): void {
    const now = Date.now()
    const refreshThreshold = AUTH_CONFIG.VERIFIER_LIFETIME * AUTH_CONFIG.VERIFIER_REFRESH_THRESHOLD

    for (const [key, creationTime] of this.verifierCreationTimes.entries()) {
      const age = now - creationTime

      if (age > refreshThreshold) {
        logger.debug(`Refreshing verifier ${key} (age: ${Math.round(age / 1000)}s)`)
        this.verifiers.delete(key)
        this.verifierCreationTimes.delete(key)
      }
    }
  }

  /**
   * Clear backoffs that have been active for too long
   */
  private static clearOldBackoffs(): void {
    if (JwksCacheManager.isBackoffActive()) {
      const metadata = JwksCacheManager.getCacheMetadata()

      if (metadata.backoffRemaining > AUTH_CONFIG.MAX_BACKOFF_CLEAR_AGE) {
        logger.debug('Clearing old JWKS backoff')
        JwksCacheManager.clearBackoff()
      }
    }
  }

  /**
   * Get factory metadata for debugging
   * @returns Factory state information
   */
  static getFactoryMetadata() {
    const now = Date.now()
    const verifiers: Record<string, any> = {}

    for (const [key, creationTime] of this.verifierCreationTimes.entries()) {
      const age = now - creationTime
      verifiers[key] = {
        ageMs: age,
        ageMinutes: Math.floor(age / 60000),
        createdAt: new Date(creationTime).toISOString(),
      }
    }

    return {
      verifierCount: this.verifiers.size,
      verifiers,
      cacheMetadata: JwksCacheManager.getCacheMetadata(),
    }
  }
}
