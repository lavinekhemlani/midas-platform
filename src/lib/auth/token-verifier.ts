// src/lib/auth/token-verifier.ts
/**
 * JWT token verification with retry logic
 * Main entry point for token authentication
 */

import type { NextRequest } from 'next/server'
import type { VerificationResult, ExtractedToken } from './types'
import { TOKEN_CONFIG } from './constants'
import { TokenExtractor } from './token-extractor'
import { VerifierFactory } from './jwks/verifier-factory'
import { JwksCacheManager } from './jwks/cache-manager'
import { RetryHandler } from './retry/handler'
import { shouldRetryTokenVerification, classifyError } from './retry/strategies'
import { logger } from '../logger'

/**
 * Verifies JWT tokens from HTTP requests
 */
export class TokenVerifier {
  /**
   * Verify token from request
   * @param request The Next.js request object
   * @returns Verification result with user ID and payload
   * @throws Error if verification fails
   */
  static async verify(request: NextRequest): Promise<VerificationResult> {
    const correlationId = request.headers.get('x-correlation-id') || 'unknown'
    const pathname = request.nextUrl?.pathname || 'unknown'
    const method = request.method

    logger.debug('[TokenVerifier] Token verification started', {
      correlationId,
      pathname,
      method,
    })

    // Extract token
    const token = TokenExtractor.extract(request)

    if (!token.value) {
      const hasCookies = !!request.headers.get('cookie')
      const hasAuthHeader = !!request.headers.get('authorization')

      logger.debug('[TokenVerifier] Authentication token missing', {
        correlationId,
        pathname,
        method,
        hasCookies,
        hasAuthHeader,
      })

      // Provide specific error message about where we looked
      const searchedLocations = []
      if (hasAuthHeader) searchedLocations.push('Authorization header')
      if (hasCookies) searchedLocations.push('cookies (accessToken, idToken)')

      const message =
        searchedLocations.length > 0
          ? `Authentication token missing. Searched in: ${searchedLocations.join(', ')}`
          : 'Authentication token missing. No Authorization header or cookies found.'

      throw new Error(message)
    }

    logger.debug('[TokenVerifier] Token extracted successfully', {
      correlationId,
      tokenType: token.type,
      tokenLength: token.value.length,
      tokenSource: request.headers.get('authorization') ? 'header' : 'cookie',
    })

    // Validate token format
    this.validateTokenFormat(token, correlationId)

    // Verify with retry
    return this.verifyWithRetry(token, correlationId, request)
  }

  /**
   * Validate token has correct JWT format
   * @param token The extracted token
   * @param correlationId Correlation ID for logging
   * @throws Error if token format is invalid
   */
  private static validateTokenFormat(token: ExtractedToken, correlationId: string): void {
    const tokenParts = token.value!.split(TOKEN_CONFIG.JWT_SEPARATOR)

    if (tokenParts.length !== TOKEN_CONFIG.JWT_PARTS_COUNT) {
      logger.error('[TokenVerifier] Invalid token format', {
        correlationId,
        tokenType: token.type,
        tokenLength: token.value!.length,
        parts: tokenParts.length,
      })
      throw new Error('JWT string does not consist of exactly 3 parts (header, payload, signature)')
    }
  }

  /**
   * Verify token with retry logic
   * @param token The extracted token
   * @param correlationId Correlation ID for logging
   * @param request Original request for fallback
   * @returns Verification result
   *
   * Note: This uses custom retry logic instead of RetryHandler because:
   * - JWKS errors require specific cache clearing and backoff management
   * - Different error types need different retry strategies and delays
   * - Expired tokens trigger immediate fallback (no retry)
   * - Network errors use exponential backoff while JWKS errors use fixed delays
   * - The complexity of token-specific error handling doesn't fit the generic RetryHandler
   */
  private static async verifyWithRetry(
    token: ExtractedToken,
    correlationId: string,
    request: NextRequest
  ): Promise<VerificationResult> {
    let lastError: any
    let jwksBackoffDetected = false

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        logger.debug(`[TokenVerifier] Verification attempt ${attempt + 1}/3`, {
          correlationId,
          tokenType: token.type,
        })

        const verifier = VerifierFactory.getVerifier(token.type)
        const payload = await verifier.verify(token.value)

        // Clear backoff on success
        if (jwksBackoffDetected) {
          JwksCacheManager.clearBackoff()
        }

        logger.debug('[TokenVerifier] Token verification successful', {
          correlationId,
          userId: payload.sub,
          tokenType: token.type,
          attempt: attempt + 1,
        })

        return {
          userId: payload.sub,
          payload: token.type === 'id' ? payload : undefined,
        }
      } catch (error: any) {
        lastError = error
        const errorMessage = error?.message || 'Unknown error'
        const classification = classifyError(error)

        logger.debug(`[TokenVerifier] Verification attempt ${attempt + 1} failed`, {
          correlationId,
          error: errorMessage,
          tokenType: token.type,
          errorCategory: classification.category,
        })

        // Handle JWKS backoff
        if (classification.category === 'jwks') {
          jwksBackoffDetected = true
          await this.handleJwksBackoff(attempt)
          if (attempt < 2) continue
        }

        // Handle timeout/network errors
        if (classification.category === 'timeout' || classification.category === 'network') {
          await this.handleNetworkError(attempt, errorMessage)
          if (attempt < 2) continue
        }

        // Handle expired tokens (try fallback immediately)
        if (classification.category === 'auth' && errorMessage.includes('expired')) {
          const fallbackResult = await this.attemptFallback(request, token.type)
          if (fallbackResult) return fallbackResult

          throw new Error(`Token expired at ${new Date().toISOString()}`)
        }

        // Retry other errors with short delay
        if (attempt < 2 && shouldRetryTokenVerification(error)) {
          const delay = Math.pow(2, attempt) * 500 // 500ms, 1s
          logger.debug(`Retrying in ${delay}ms...`)
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }
      }
    }

    // All retries exhausted - try final fallback
    const fallbackResult = await this.attemptFallback(request, token.type)
    if (fallbackResult) return fallbackResult

    // Report failure
    if (jwksBackoffDetected) {
      logger.error('[TokenVerifier] All verification attempts failed due to JWKS backoff', {
        correlationId,
      })
      throw new Error(
        'JWKS verification temporarily unavailable. Please try again in a few moments.'
      )
    }

    logger.error('[TokenVerifier] All verification attempts exhausted', {
      correlationId,
      tokenType: token.type,
      lastError: lastError?.message,
      attempts: 3,
    })

    throw new Error(
      'Token verification failed after 3 attempts: ' + (lastError?.message || 'Unknown error')
    )
  }

  /**
   * Handle JWKS backoff error
   * @param attempt Current attempt number
   */
  private static async handleJwksBackoff(attempt: number): Promise<void> {
    if (attempt === 0) {
      logger.debug('Resetting JWKS cache due to backoff error')
      JwksCacheManager.resetCache()
      VerifierFactory.clearCache()
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } else {
      const delay = Math.pow(2, attempt + 1) * 1000 // 4s, 8s
      logger.debug(`JWKS backoff detected, waiting ${delay}ms`)
      JwksCacheManager.setBackoff(delay * 2)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  /**
   * Handle network/timeout error
   * @param attempt Current attempt number
   * @param errorMessage Error message
   */
  private static async handleNetworkError(attempt: number, errorMessage: string): Promise<void> {
    const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
    logger.debug('Token verification network error, retrying', {
      attempt: attempt + 1,
      totalAttempts: 3,
      errorMessage,
      retryDelayMs: delay,
    })
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  /**
   * Attempt to verify alternate token type as fallback
   * @param request Original request
   * @param primaryType The primary token type that failed
   * @returns Verification result or null if fallback also fails
   *
   * Note: Fallback only works from ID token to access token (not the reverse).
   * This is intentional because:
   * - ID tokens contain full user profile information
   * - Access tokens are primarily for authorization
   * - If the ID token fails, we can fall back to basic auth with the access token
   * - The reverse doesn't make sense as we'd be losing information
   */
  private static async attemptFallback(
    request: NextRequest,
    primaryType: 'access' | 'id'
  ): Promise<VerificationResult | null> {
    if (primaryType !== 'id') {
      return null // Only fall back from ID to access token (see note above)
    }

    const accessToken = TokenExtractor.extract(request, 'access')

    if (!accessToken.value) {
      return null
    }

    try {
      const verifier = VerifierFactory.getVerifier('access')
      const payload = await verifier.verify(accessToken.value)
      logger.info('Fallback to access token successful')

      return { userId: payload.sub }
    } catch (fallbackError: any) {
      logger.debug('Fallback token also failed', {
        error: fallbackError?.message,
      })
      return null
    }
  }

  /**
   * Clear verifier and JWKS cache
   */
  static clearCache(): void {
    VerifierFactory.clearCache()
  }

  /**
   * Warm up cache (optional optimization)
   */
  static async warmCache(): Promise<void> {
    return VerifierFactory.warmCache()
  }

  /**
   * Start cache refresh (for long-running processes)
   */
  static startCacheRefresh(intervalMs?: number): NodeJS.Timeout | null {
    return VerifierFactory.startCacheRefresh(intervalMs)
  }
}
