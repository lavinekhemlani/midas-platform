// src/lib/providers/constants.ts

/**
 * Shared constants for provider authentication and token management
 */

/**
 * Token refresh buffer time in seconds
 * Tokens are refreshed this many seconds before expiry to prevent race conditions
 *
 * QuickBooks access tokens expire after 1 hour, so 30 minutes buffer ensures
 * we refresh halfway through the token lifetime for maximum reliability
 */
export const TOKEN_REFRESH_BUFFER_SECONDS = 1800 // 30 minutes

/**
 * Maximum time to wait for a distributed token refresh lock (milliseconds)
 */
export const TOKEN_LOCK_MAX_WAIT_MS = 30000 // 30 seconds

/**
 * Timeout for individual token refresh operations (milliseconds)
 */
export const TOKEN_REFRESH_TIMEOUT_MS = 60000 // 60 seconds

/**
 * Number of retry attempts for token refresh operations
 */
export const TOKEN_REFRESH_RETRY_ATTEMPTS = 3

/**
 * Base delay for token refresh retry backoff (milliseconds)
 */
export const TOKEN_REFRESH_RETRY_BASE_DELAY_MS = 1000 // 1 second

/**
 * Network error codes that indicate connectivity issues
 */
export const NETWORK_ERROR_CODES = [
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ENETUNREACH',
  'EAI_AGAIN',
] as const

/**
 * HTTP status codes that indicate rate limiting
 */
export const RATE_LIMIT_STATUS_CODES = [429, 503] as const

/**
 * HTTP status codes that indicate gateway/server errors (retryable)
 */
export const GATEWAY_ERROR_STATUS_CODES = [502, 503, 504] as const
