// src/lib/auth/constants.ts
/**
 * Authentication configuration constants
 * Centralizes all magic numbers and configuration values
 */

export const AUTH_CONFIG = {
  /** Cookie max-age in seconds (1 hour) */
  COOKIE_MAX_AGE: 3600,

  /** Minimum interval between JWKS fetches in milliseconds (5 seconds) */
  JWKS_MIN_FETCH_INTERVAL: 5000,

  /** Timeout for JWKS fetch requests in milliseconds (30 seconds) */
  JWKS_FETCH_TIMEOUT: 30000,

  /** JWKS cache lifetime in milliseconds (1 hour) */
  JWKS_CACHE_LIFETIME: 3600000,

  /** JWT verifier instance lifetime in milliseconds (10 minutes) */
  VERIFIER_LIFETIME: 600000,

  /** Maximum number of JWKS keys to cache */
  JWKS_MAX_CACHE_SIZE: 10,

  /** JWKS cache key max age in milliseconds (10 minutes) */
  JWKS_KEY_MAX_AGE: 600000,

  /** Clock tolerance for JWT verification in seconds (60 seconds) */
  CLOCK_TOLERANCE: 60,

  /** Default backoff duration in milliseconds (30 seconds) */
  DEFAULT_BACKOFF_DURATION: 30000,

  /** Cache refresh interval in milliseconds (5 minutes) */
  CACHE_REFRESH_INTERVAL: 300000,

  /** Percentage of verifier lifetime before refresh (80%) */
  VERIFIER_REFRESH_THRESHOLD: 0.8,

  /** Maximum backoff clear age in milliseconds (1 minute) */
  MAX_BACKOFF_CLEAR_AGE: 60000,
} as const

export const RETRY_CONFIG = {
  /** Maximum retry attempts for operations */
  MAX_ATTEMPTS: 3,

  /** Base delay for exponential backoff in milliseconds */
  BASE_DELAY: 1000,

  /** Multiplier for exponential backoff */
  BACKOFF_MULTIPLIER: 2,

  /** Minimum HTTP status for non-retryable client errors */
  MIN_CLIENT_ERROR: 400,

  /** Maximum HTTP status for client errors */
  MAX_CLIENT_ERROR: 500,

  /** HTTP status code for rate limiting (should retry) */
  RATE_LIMIT_STATUS: 429,
} as const

export const TOKEN_CONFIG = {
  /** Expected number of JWT parts (header.payload.signature) */
  JWT_PARTS_COUNT: 3,

  /** Separator for JWT parts */
  JWT_SEPARATOR: '.',
} as const

export const HTTP_CONFIG = {
  /** User-Agent string for HTTP requests */
  USER_AGENT: 'ZenithOS/1.0',
} as const
