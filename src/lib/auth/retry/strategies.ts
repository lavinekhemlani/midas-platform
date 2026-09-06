// src/lib/auth/retry/strategies.ts
/**
 * Retry strategies for different error types
 * Determines which errors should trigger retries
 */

import { RETRY_CONFIG } from '../constants'
import type { ErrorClassification } from '../types'

/**
 * Classifies an error for retry decision-making
 */
export function classifyError(error: any): ErrorClassification {
  const errorMessage = error?.message || ''
  const errorStatus = error?.response?.status

  // Timeout and network errors - retryable with backoff
  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('ECONNRESET') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('AbortError')
  ) {
    return {
      isRetryable: true,
      category: 'timeout',
      useBackoff: true,
    }
  }

  // JWKS-specific errors - retryable with backoff
  if (
    errorMessage.includes('Not allowed to fetch JWKS yet') ||
    errorMessage.includes('back off period') ||
    errorMessage.includes('JWKS')
  ) {
    return {
      isRetryable: true,
      category: 'jwks',
      useBackoff: true,
    }
  }

  // Expired token - not retryable
  if (errorMessage.includes('expired') || errorMessage.includes('Token expired')) {
    return {
      isRetryable: false,
      category: 'auth',
      useBackoff: false,
    }
  }

  // Client errors (4xx) - generally not retryable except 429
  if (
    errorStatus &&
    errorStatus >= RETRY_CONFIG.MIN_CLIENT_ERROR &&
    errorStatus < RETRY_CONFIG.MAX_CLIENT_ERROR
  ) {
    return {
      isRetryable: errorStatus === RETRY_CONFIG.RATE_LIMIT_STATUS,
      category: 'client',
      useBackoff: errorStatus === RETRY_CONFIG.RATE_LIMIT_STATUS,
    }
  }

  // Server errors (5xx) - retryable with backoff
  if (errorStatus && errorStatus >= RETRY_CONFIG.MAX_CLIENT_ERROR) {
    return {
      isRetryable: true,
      category: 'server',
      useBackoff: true,
    }
  }

  // Network-level errors - retryable
  if (
    error?.code === 'ENOTFOUND' ||
    error?.code === 'EAI_AGAIN' ||
    errorMessage.includes('network')
  ) {
    return {
      isRetryable: true,
      category: 'network',
      useBackoff: true,
    }
  }

  // Unknown errors - retryable with caution
  return {
    isRetryable: true,
    category: 'unknown',
    useBackoff: true,
  }
}

/**
 * Token verification retry strategy
 */
export function shouldRetryTokenVerification(error: any): boolean {
  const classification = classifyError(error)

  // Never retry expired tokens or client errors (except rate limit)
  if (classification.category === 'auth' || classification.category === 'client') {
    return classification.isRetryable
  }

  // Retry JWKS, timeout, network, and server errors
  return classification.isRetryable
}

/**
 * JWKS fetch retry strategy
 */
export function shouldRetryJwksFetch(error: any): boolean {
  const classification = classifyError(error)

  // Don't retry on most client errors (except 429)
  if (classification.category === 'client') {
    return classification.isRetryable
  }

  // Retry everything else
  return classification.isRetryable
}

/**
 * Generic network operation retry strategy
 */
export function shouldRetryNetworkOperation(error: any): boolean {
  const classification = classifyError(error)

  // Retry network, timeout, and server errors
  return classification.isRetryable
}
