// src/lib/providers/oauth-security.ts
import { randomUUID } from 'crypto'
import { storeOAuthState, getOAuthState, deleteOAuthState, OAuthStateRecord } from './database'
import { oauthMonitoring } from './oauthMonitoring'

/**
 * OAuth Security utilities for CSRF protection and state management
 */

export interface OAuthState {
  id: string
  nonce: string
  userId: string
  organizationId: string
  provider: string
  redirect: string
  timestamp: number
  expiresAt: number
  codeVerifier?: string // PKCE code verifier for Azure AD OAuth
  shopDomain?: string // Shopify store domain (e.g. my-store.myshopify.com)
  shopifyClientId?: string // Per-app Shopify Client ID (custom distribution)
  shopifyClientSecret?: string // Per-app Shopify Client Secret (custom distribution)
}

// In-memory fallback store for OAuth states (used when database is not available)
const stateStore = new Map<string, OAuthState>()

// State expiry time (10 minutes)
const STATE_EXPIRY_MS = 10 * 60 * 1000

/**
 * Generate a cryptographically secure state parameter for OAuth
 */
export async function generateSecureState(params: {
  userId: string
  organizationId: string
  provider: string
  redirect: string
  codeVerifier?: string // PKCE code verifier for Azure AD OAuth
  shopDomain?: string // Shopify store domain
  shopifyClientId?: string // Per-app Shopify Client ID
  shopifyClientSecret?: string // Per-app Shopify Client Secret
}): Promise<string> {
  const stateId = randomUUID()
  const nonce = randomUUID()
  const timestamp = Date.now()

  const state: OAuthState = {
    id: stateId,
    nonce,
    userId: params.userId,
    organizationId: params.organizationId,
    provider: params.provider,
    redirect: params.redirect,
    timestamp,
    expiresAt: timestamp + STATE_EXPIRY_MS,
    codeVerifier: params.codeVerifier,
    shopDomain: params.shopDomain,
    shopifyClientId: params.shopifyClientId,
    shopifyClientSecret: params.shopifyClientSecret,
  }

  // Try to store in database first
  const dbState: OAuthStateRecord = {
    stateId,
    nonce,
    userId: params.userId,
    organizationId: params.organizationId,
    provider: params.provider,
    redirect: params.redirect,
    timestamp,
    expiresAt: timestamp + STATE_EXPIRY_MS,
    codeVerifier: params.codeVerifier,
    shopDomain: params.shopDomain,
    shopifyClientId: params.shopifyClientId,
    shopifyClientSecret: params.shopifyClientSecret,
  }

  const stored = await storeOAuthState(dbState)

  // If database storage fails, use in-memory fallback
  if (!stored) {
    stateStore.set(stateId, state)
    cleanupExpiredStates()
  }

  // Create state parameter
  const stateData = {
    stateId,
    nonce,
    userId: params.userId,
    organizationId: params.organizationId,
    provider: params.provider,
    redirect: params.redirect,
  }

  // Log state generation
  oauthMonitoring.logOAuthState({
    userId: params.userId,
    organizationId: params.organizationId,
    providerId: params.provider,
    event: 'generated',
  })

  return Buffer.from(JSON.stringify(stateData)).toString('base64')
}

/**
 * Validate OAuth state parameter
 */
export async function validateState(encodedState: string): Promise<{
  valid: boolean
  data?: OAuthState
  error?: string
}> {
  try {
    // Decode the state
    const stateData = JSON.parse(Buffer.from(encodedState, 'base64').toString('utf-8'))

    if (!stateData.stateId || !stateData.nonce) {
      return { valid: false, error: 'Invalid state structure' }
    }

    // Try to retrieve from database first
    const dbState = await getOAuthState(stateData.stateId)

    let storedState: OAuthState | null = null

    if (dbState) {
      // Convert database state to OAuthState
      storedState = {
        id: dbState.stateId,
        nonce: dbState.nonce,
        userId: dbState.userId,
        organizationId: dbState.organizationId,
        provider: dbState.provider,
        redirect: dbState.redirect,
        timestamp: dbState.timestamp,
        expiresAt: dbState.expiresAt,
        codeVerifier: dbState.codeVerifier,
        shopDomain: dbState.shopDomain,
        shopifyClientId: dbState.shopifyClientId,
        shopifyClientSecret: dbState.shopifyClientSecret,
      }

      // Delete from database after retrieval (one-time use)
      await deleteOAuthState(stateData.stateId)
    } else {
      // Fallback to in-memory store
      storedState = stateStore.get(stateData.stateId) || null

      if (storedState) {
        // Remove from in-memory store (one-time use)
        stateStore.delete(stateData.stateId)
      }
    }

    if (!storedState) {
      // Log state validation failure
      oauthMonitoring.logOAuthState({
        userId: stateData.userId || 'unknown',
        organizationId: stateData.organizationId || 'unknown',
        providerId: stateData.provider || 'unknown',
        event: 'invalid',
        error: 'State not found or expired',
      })
      return { valid: false, error: 'State not found or expired' }
    }

    // Check expiry
    if (Date.now() > storedState.expiresAt) {
      oauthMonitoring.logOAuthState({
        userId: storedState.userId,
        organizationId: storedState.organizationId,
        providerId: storedState.provider,
        event: 'expired',
        error: 'State expired',
      })
      return { valid: false, error: 'State expired' }
    }

    // Validate nonce
    if (storedState.nonce !== stateData.nonce) {
      oauthMonitoring.logOAuthState({
        userId: storedState.userId,
        organizationId: storedState.organizationId,
        providerId: storedState.provider,
        event: 'invalid',
        error: 'Invalid nonce',
      })
      return { valid: false, error: 'Invalid nonce' }
    }

    // Validate other parameters match
    if (
      storedState.userId !== stateData.userId ||
      storedState.organizationId !== stateData.organizationId ||
      storedState.provider !== stateData.provider
    ) {
      oauthMonitoring.logOAuthState({
        userId: storedState.userId,
        organizationId: storedState.organizationId,
        providerId: storedState.provider,
        event: 'invalid',
        error: 'State parameters mismatch',
      })
      return { valid: false, error: 'State parameters mismatch' }
    }

    // Log successful validation
    oauthMonitoring.logOAuthState({
      userId: storedState.userId,
      organizationId: storedState.organizationId,
      providerId: storedState.provider,
      event: 'validated',
    })

    return { valid: true, data: storedState }
  } catch (error) {
    console.error('State validation error:', error)
    return { valid: false, error: 'Invalid state format' }
  }
}

/**
 * Clean up expired states from memory
 */
function cleanupExpiredStates(): void {
  const now = Date.now()
  const entries = Array.from(stateStore.entries())
  for (const [id, state] of entries) {
    if (now > state.expiresAt) {
      stateStore.delete(id)
    }
  }
}

/**
 * Handle invalid_grant error specifically for QuickBooks
 */
export function isInvalidGrantError(error: any): boolean {
  if (!error) return false

  // Check various error formats
  const errorMessage = error.message || error.error || ''
  const errorDescription = error.error_description || ''

  return (
    errorMessage.includes('invalid_grant') ||
    errorDescription.includes('invalid_grant') ||
    error.response?.data?.error === 'invalid_grant' ||
    (error.response?.status === 400 && errorDescription.includes('Token is invalid')) ||
    // Additional QuickBooks specific checks
    errorMessage.includes('refresh token is invalid') ||
    errorMessage.includes('token refresh failed') ||
    (error.status === 400 && errorMessage.includes('refresh'))
  )
}

/**
 * Validate QuickBooks token refresh response
 */
export function validateQuickBooksTokenResponse(tokenData: any): {
  valid: boolean
  error?: string
} {
  if (!tokenData) {
    return { valid: false, error: 'Empty token response from QuickBooks' }
  }

  if (!tokenData.access_token) {
    return { valid: false, error: 'Missing access_token in QuickBooks response' }
  }

  if (!tokenData.refresh_token) {
    return {
      valid: false,
      error:
        'Missing refresh_token in QuickBooks response - this violates QuickBooks token rotation requirements',
    }
  }

  if (!tokenData.expires_in || tokenData.expires_in <= 0) {
    return { valid: false, error: 'Invalid or missing expires_in in QuickBooks response' }
  }

  // Check token format (should be opaque strings)
  if (typeof tokenData.access_token !== 'string' || tokenData.access_token.length < 10) {
    return { valid: false, error: 'Invalid access_token format from QuickBooks' }
  }

  if (typeof tokenData.refresh_token !== 'string' || tokenData.refresh_token.length < 10) {
    return { valid: false, error: 'Invalid refresh_token format from QuickBooks' }
  }

  return { valid: true }
}

/**
 * Extract error details for logging
 */
export function extractOAuthError(error: any): {
  type: string
  message: string
  details?: any
} {
  if (isInvalidGrantError(error)) {
    return {
      type: 'invalid_grant',
      message: 'The provided authorization grant or refresh token is invalid, expired, or revoked',
      details: error.error_description || error.message,
    }
  }

  if (error.error === 'invalid_client') {
    return {
      type: 'invalid_client',
      message: 'Client authentication failed',
      details: error.error_description,
    }
  }

  if (error.error === 'invalid_request') {
    return {
      type: 'invalid_request',
      message: 'The request is missing a required parameter or includes an invalid parameter',
      details: error.error_description,
    }
  }

  return {
    type: 'unknown',
    message: error.message || 'Unknown OAuth error',
    details: error,
  }
}

/**
 * Generate a secure session identifier for token storage
 */
export function generateSessionId(): string {
  return randomUUID()
}

/**
 * Validate redirect URI to prevent open redirects
 */
export function isValidRedirectUri(uri: string): boolean {
  const allowedPaths = [
    '/onboarding/setup',
    '/onboarding/connect',
    '/onboarding/step1_getting_started', // Keep for backward compatibility
    '/onboarding/step2_connect_finish', // Keep for backward compatibility
    '/onboarding/provider_connect', // Keep for backward compatibility
    '/dashboard',
    '/settings/integrations',
    '/settings', // Allow settings page
    '/reports', // Allow reports page
    '/onboarding',
    '/onboarding/bc-setup', // BC OAuth post-auth environment/company picker
    '/quickbooks-test', // Allow redirect to QuickBooks test page
    // Provider-prefixed routes
    '/qb',
    '/bc',
    '/shopify',
    // Provider-required pages that show ConnectionPrompt
    '/sales',
    '/journal',
    '/coa',
    '/expenses',
    '/receivables',
    '/payables',
    '/banking',
    '/cash',
    '/projects',
    '/classes',
    '/budgets',
    '/invoicing',
    '/analytics',
    '/customers',
    '/memories',
    '/learn',
    '/forecasting',
  ]

  try {
    // Check if it's a relative path
    if (uri.startsWith('/')) {
      return allowedPaths.some((path) => uri.startsWith(path))
    }

    // For absolute URLs, validate the domain
    const url = new URL(uri)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const appDomain = new URL(appUrl).hostname

    return url.hostname === appDomain
  } catch {
    return false
  }
}
