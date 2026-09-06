// src/lib/auth/index.ts
/**
 * Authentication module public API
 * Single source of truth for auth exports
 */

// Core classes
export { AuthCookies } from './cookie-manager'
export { TokenVerifier } from './token-verifier'

// Functions
export { signOutUser } from './sign-out'

// Types (for TypeScript consumers)
export type {
  TokenUse,
  TokenPayload,
  ExtractedToken,
  VerificationResult,
  RetryOptions,
  RequestContext,
  ErrorClassification,
} from './types'

// Constants (for advanced use cases)
export { AUTH_CONFIG, RETRY_CONFIG, TOKEN_CONFIG, HTTP_CONFIG } from './constants'

/*
 * Internal modules not exported (encapsulation):
 * - TokenExtractor (used internally by TokenVerifier)
 * - VerifierFactory (used internally by TokenVerifier)
 * - JwksCacheManager (used internally by VerifierFactory)
 * - JwksFetcher (used internally by JwksCacheManager)
 * - RetryHandler (used internally by various modules)
 * - Retry strategies (used internally by RetryHandler)
 */
