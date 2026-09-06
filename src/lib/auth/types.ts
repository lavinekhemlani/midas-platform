// src/lib/auth/types.ts
/**
 * Shared TypeScript types and interfaces for the auth module
 */

/**
 * Token use type - determines which Cognito token verifier to use
 */
export type TokenUse = 'access' | 'id'

/**
 * JWT token payload structure
 */
export interface TokenPayload {
  /** User ID (sub claim) */
  sub: string
  /** Additional claims */
  [key: string]: any
}

/**
 * Extracted token from request with metadata
 */
export interface ExtractedToken {
  /** Token string value (null if not found) */
  value: string | null
  /** Token type that was extracted */
  type: TokenUse
}

/**
 * Result of token verification
 */
export interface VerificationResult {
  /** User ID extracted from token */
  userId: string
  /** Full token payload (only for ID tokens) */
  payload?: TokenPayload
}

/**
 * Options for retry operations
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts: number
  /** Base delay in milliseconds */
  baseDelay: number
  /** Multiplier for exponential backoff */
  backoffMultiplier: number
  /** Optional custom function to determine if error should be retried */
  shouldRetry?: (error: any) => boolean
}

/**
 * Context information for logging and tracking
 */
export interface RequestContext {
  /** Correlation ID for request tracking */
  correlationId: string
  /** Request pathname */
  pathname: string
  /** HTTP method */
  method: string
}

/**
 * Error classification for retry logic
 */
export interface ErrorClassification {
  /** Whether error is retryable */
  isRetryable: boolean
  /** Error category */
  category: 'timeout' | 'network' | 'auth' | 'jwks' | 'client' | 'server' | 'unknown'
  /** Whether exponential backoff should be applied */
  useBackoff: boolean
}
