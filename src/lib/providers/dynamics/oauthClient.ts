// src/lib/providers/dynamics/oauthClient.ts
/**
 * Business Central OAuth Client using Azure AD / Entra ID
 * Implements OAuth 2.0 Authorization Code flow with PKCE
 *
 * No SDK — raw HTTP requests against Microsoft Identity Platform v2.0 endpoints.
 * Designed for serverless environments (Vercel):
 * - No in-memory state persisted between requests
 * - All token state stored in DynamoDB
 * - Distributed locking prevents race conditions during refresh
 */
import { randomBytes, createHash } from 'crypto'
import {
  getProviderCredentialsFromDB,
  storeProviderCredentialsInDB,
  storeProviderError,
  getBCConnectionCredentials,
  getActiveBCConnectionId,
  storeBCConnectionCredentials,
  storeBCConnectionError,
} from '../database'
import type { ProviderCredentials } from '../database'
import { withTokenRefreshLock } from '../tokenLock'
import { bcLogger } from './logger'

// ─── Configuration ──────────────────────────────────────────────────────────────

const CLIENT_ID = process.env.BC_AZURE_CLIENT_ID!
const CLIENT_SECRET = process.env.BC_AZURE_CLIENT_SECRET!
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/providers/callback`

// Microsoft Identity Platform v2.0 endpoints
const AUTHORITY = 'https://login.microsoftonline.com/organizations'
const AUTHORIZE_URL = `${AUTHORITY}/oauth2/v2.0/authorize`
const TOKEN_URL = `${AUTHORITY}/oauth2/v2.0/token`

// BC API scopes
// openid is required to get an id_token with the tenant ID (tid) claim
const BC_SCOPES =
  'https://api.businesscentral.dynamics.com/user_impersonation offline_access openid'

// BC API base URL
const BC_API_BASE = 'https://api.businesscentral.dynamics.com'

// Token refresh buffer — refresh 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_SECONDS = 5 * 60

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface BCToken {
  token_type: string
  access_token: string
  refresh_token: string
  expires_in: number // seconds (~3600)
  scope: string
  id_token?: string
}

export interface BCEnvironment {
  name: string // e.g., "Production", "Sandbox"
  type: 'Production' | 'Sandbox'
  friendlyName: string
  aadTenantId: string
  webServiceUrl: string
  webClientLoginUrl: string
}

export interface BCCompany {
  id: string // GUID
  systemVersion: string
  name: string
  displayName: string
  businessProfileId: string
}

// ─── PKCE Helpers ───────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random PKCE code verifier (43-128 chars, URL-safe)
 */
export function generateCodeVerifier(): string {
  // 32 bytes → 43 base64url chars
  return randomBytes(32).toString('base64url')
}

/**
 * Generate PKCE code challenge from a code verifier (SHA256, base64url)
 */
export function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

// ─── Authorization URL ─────────────────────────────────────────────────────────

/**
 * Build the Azure AD authorization URL for BC OAuth
 * @param state - CSRF state parameter (base64-encoded)
 * @param codeChallenge - PKCE code challenge (S256)
 * @param adminConsent - If true, requests admin consent instead of user consent
 */
export function getAuthorizationUrl(
  state: string,
  codeChallenge: string,
  adminConsent: boolean = false
): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    response_mode: 'query',
    scope: BC_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  // Only set prompt when explicitly needed:
  // - admin_consent: forces admin consent grant (for tenant-wide approval)
  // - select_account: lets user pick account without re-triggering consent
  // Do NOT use 'consent' — it forces the consent screen even after admin approval,
  // which causes "Need admin approval" errors on tenants with restricted consent policies.
  if (adminConsent) {
    params.set('prompt', 'admin_consent')
  }

  const url = `${AUTHORIZE_URL}?${params.toString()}`

  bcLogger.logAuthFlow('Authorization URL generated', {
    adminConsent,
    prompt: adminConsent ? 'admin_consent' : '(none - Azure AD decides)',
    redirectUri: REDIRECT_URI,
    scopes: BC_SCOPES,
    fullUrl: url,
  })

  return url
}

// ─── Token Exchange ─────────────────────────────────────────────────────────────

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<BCToken> {
  bcLogger.info('Exchanging authorization code for tokens')

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: BC_SCOPES,
    code,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    bcLogger.error('Token exchange failed', undefined, {
      status: response.status,
      error: errorData.error,
      errorDescription: errorData.error_description,
    })
    const msg = errorData.error_description || errorData.error || 'Token exchange failed'
    const err: any = new Error(msg)
    err.error = errorData.error
    err.error_description = errorData.error_description
    err.status = response.status
    throw err
  }

  const tokenData: BCToken = await response.json()

  console.log('[BC] Token exchange successful:', {
    hasAccessToken: !!tokenData.access_token,
    hasRefreshToken: !!tokenData.refresh_token,
    hasIdToken: !!tokenData.id_token,
    expiresIn: tokenData.expires_in,
    scope: tokenData.scope,
  })

  return tokenData
}

// ─── Token Refresh ──────────────────────────────────────────────────────────────

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  organizationId?: string
): Promise<BCToken> {
  bcLogger.info('Refreshing BC access token', { organizationId })

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: BC_SCOPES,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    bcLogger.error(
      'Token refresh failed',
      { organizationId },
      {
        status: response.status,
        error: errorData.error,
        errorDescription: errorData.error_description,
      }
    )

    if (errorData.error === 'invalid_grant') {
      const invalidGrantError: any = new Error(
        'Business Central authentication expired - please reconnect'
      )
      invalidGrantError.code = 'PROVIDER_INVALID_GRANT'
      invalidGrantError.error = 'invalid_grant'
      invalidGrantError.requiresReconnect = true
      throw invalidGrantError
    }

    const msg = errorData.error_description || errorData.error || 'Token refresh failed'
    throw new Error(msg)
  }

  const tokenData: BCToken = await response.json()

  if (!tokenData.access_token) {
    throw new Error('No access token in refresh response')
  }
  if (!tokenData.refresh_token) {
    throw new Error('No refresh token in refresh response - token rotation failed')
  }

  bcLogger.info('Token refresh successful', {
    organizationId,
    expiresIn: tokenData.expires_in,
  })

  return tokenData
}

// ─── Discovery APIs ─────────────────────────────────────────────────────────────

/**
 * Discover available BC environments for the authenticated tenant
 */
export async function discoverEnvironments(accessToken: string): Promise<BCEnvironment[]> {
  // BC environments endpoint for connecting apps (not the Admin Center API which requires admin role)
  // Docs: https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/webservices/api-get-environments
  const url = `${BC_API_BASE}/environments/v1.2`
  console.log('[BC] Discovering environments:', url)

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('[BC] Environment discovery failed:', {
      status: response.status,
      statusText: response.statusText,
      body: errorBody,
      url,
    })
    throw new Error(`Failed to discover BC environments: ${response.status} — ${errorBody}`)
  }

  const data = await response.json()
  const environments: BCEnvironment[] = (data.value || []).map((env: any) => ({
    name: env.name,
    type: env.type,
    friendlyName: env.friendlyName || env.name,
    aadTenantId: env.aadTenantId,
    webServiceUrl: env.webServiceUrl,
    webClientLoginUrl: env.webClientLoginUrl,
  }))

  console.log('[BC] Environments discovered:', environments.length)
  return environments
}

/**
 * Discover available companies within a BC environment
 */
export async function discoverCompanies(
  accessToken: string,
  tenantId: string,
  environmentName: string
): Promise<BCCompany[]> {
  const url = `${BC_API_BASE}/v2.0/${tenantId}/${environmentName}/api/v2.0/companies`
  console.log('[BC] Discovering companies:', { url, tenantId, environment: environmentName })

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('[BC] Company discovery failed:', {
      status: response.status,
      statusText: response.statusText,
      body: errorBody,
      url,
    })
    throw new Error(`Failed to discover BC companies: ${response.status} — ${errorBody}`)
  }

  const data = await response.json()
  const companies: BCCompany[] = (data.value || []).map((co: any) => ({
    id: co.id,
    systemVersion: co.systemVersion,
    name: co.name,
    displayName: co.displayName,
    businessProfileId: co.businessProfileId,
  }))

  console.log('[BC] Companies discovered:', {
    tenantId,
    environment: environmentName,
    count: companies.length,
  })
  return companies
}

// ─── Token Utility Functions ────────────────────────────────────────────────────

/**
 * Extract Azure AD tenant ID from a JWT id_token
 */
export function extractTenantIdFromToken(idToken: string): string | null {
  try {
    // JWT structure: header.payload.signature
    const payload = idToken.split('.')[1]
    if (!payload) return null
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
    return decoded.tid || null
  } catch {
    return null
  }
}

/**
 * Convert BCToken to database credentials format
 */
export function tokenToCredentials(
  token: BCToken,
  tenantId?: string
): {
  access_token: string
  refresh_token: string
  expires_at: number
  tenant_id?: string
} {
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + (token.expires_in || 3600)

  return {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: expiresAt,
    tenant_id: tenantId,
  }
}

/**
 * Convert database credentials to BCToken format
 */
export function credentialsToToken(credentials: {
  access_token: string
  refresh_token?: string
  expires_at: number
}): BCToken {
  const expiresIn = 3600
  return {
    token_type: 'Bearer',
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token || '',
    expires_in: expiresIn,
    scope: BC_SCOPES,
  }
}

/**
 * Check if the access token from DB credentials is still valid
 * Uses 5-minute buffer before expiry, same as QuickBooks
 */
export function isAccessTokenValidFromCredentials(credentials: { expires_at: number }): boolean {
  const now = Math.floor(Date.now() / 1000)
  return now < credentials.expires_at - TOKEN_REFRESH_BUFFER_SECONDS
}

// ─── In-memory token cache ──────────────────────────────────────────────────────
// Prevents thundering herd when multiple route handlers create separate BC clients
// for the same connection and all try to refresh simultaneously.

interface CachedToken {
  accessToken: string
  connectionId: string
  expiresAt: number // unix seconds
}

const tokenCache = new Map<string, CachedToken>()
const inflightRefresh = new Map<string, Promise<{ accessToken: string; connectionId: string }>>()

function getCacheKey(orgId: string, connId: string): string {
  return `${orgId}::${connId}`
}

// ─── Token Manager ──────────────────────────────────────────────────────────────

/**
 * Get a valid access token for an organization's BC connection.
 * Handles token refresh with distributed locking.
 * Uses in-memory cache + promise dedup to prevent thundering herd across
 * concurrent route handlers sharing the same process.
 *
 * @param organizationId - The organization ID
 * @param connectionId - The specific BC connection (envName_companyId)
 * @param forceRefresh - Force refresh even if token appears valid (e.g., after 401)
 */
export async function getValidAccessToken(
  organizationId: string,
  connectionId?: string,
  forceRefresh: boolean = false
): Promise<{
  accessToken: string
  connectionId: string
}> {
  // Get credentials — check oauthConnections first (via connectionId or active),
  // then fall back to generic getProviderCredentialsFromDB (which also checks oauthConnections)
  let credentials: ProviderCredentials | null = null
  let resolvedConnectionId = connectionId || ''

  if (connectionId) {
    credentials = await getBCConnectionCredentials(organizationId, connectionId)
  }
  if (!credentials) {
    // Try active connection
    const activeId = await getActiveBCConnectionId(organizationId)
    if (activeId) {
      credentials = await getBCConnectionCredentials(organizationId, activeId)
      if (credentials) resolvedConnectionId = activeId
    }
  }
  if (!credentials) {
    // Fall back to generic path (covers both oauthConnections and legacy credentials)
    credentials = await getProviderCredentialsFromDB(organizationId, 'dynamics')
    if (!resolvedConnectionId) resolvedConnectionId = 'default'
  }

  if (!credentials || !credentials.connected) {
    throw new Error('Business Central not connected for this organization')
  }

  if (!resolvedConnectionId) resolvedConnectionId = 'default'

  if (!credentials.access_token) {
    throw new Error('No access token found - please reconnect Business Central')
  }

  const cacheKey = getCacheKey(organizationId, resolvedConnectionId)

  // Fast path: check in-memory cache first (avoids DynamoDB read entirely)
  if (!forceRefresh) {
    const cached = tokenCache.get(cacheKey)
    if (cached && Math.floor(Date.now() / 1000) < cached.expiresAt - TOKEN_REFRESH_BUFFER_SECONDS) {
      return { accessToken: cached.accessToken, connectionId: cached.connectionId }
    }
  }

  // Check if access token from DB is still valid
  if (!forceRefresh && isAccessTokenValidFromCredentials(credentials)) {
    bcLogger.debug('Access token is valid, no refresh needed', {
      organizationId,
      connectionId: resolvedConnectionId,
    })
    // Populate cache from DB read
    tokenCache.set(cacheKey, {
      accessToken: credentials.access_token,
      connectionId: resolvedConnectionId,
      expiresAt: credentials.expires_at,
    })
    return {
      accessToken: credentials.access_token,
      connectionId: resolvedConnectionId,
    }
  }

  // Token needs refresh — deduplicate concurrent refresh attempts across route handlers
  if (!forceRefresh) {
    const inflight = inflightRefresh.get(cacheKey)
    if (inflight) {
      bcLogger.debug('Joining existing token refresh in progress', {
        organizationId,
        connectionId: resolvedConnectionId,
      })
      return inflight
    }
  }

  // Token expired or force refresh — use distributed lock
  bcLogger.info(
    forceRefresh
      ? 'Force refresh requested, initiating refresh with distributed lock...'
      : 'Access token expired or expiring soon, initiating refresh...',
    { organizationId, connectionId: resolvedConnectionId }
  )

  if (!credentials.refresh_token) {
    await storeProviderError(
      organizationId,
      'dynamics',
      'No refresh token available - re-authentication required'
    )
    throw new Error('No refresh token available - please reconnect Business Central')
  }

  // Wrap refresh in inflight promise for cross-route dedup
  const refreshPromise = withTokenRefreshLock(
    organizationId,
    'dynamics',
    async () => {
      // Re-check credentials inside the lock (use same resolution as outer scope)
      let freshCredentials: ProviderCredentials | null = null
      if (resolvedConnectionId && resolvedConnectionId !== 'default') {
        freshCredentials = await getBCConnectionCredentials(organizationId, resolvedConnectionId)
      }
      if (!freshCredentials) {
        freshCredentials = await getProviderCredentialsFromDB(organizationId, 'dynamics')
      }

      if (!freshCredentials || !freshCredentials.connected) {
        throw new Error('Business Central disconnected while waiting for lock')
      }

      // Check if token was refreshed by another process
      if (isAccessTokenValidFromCredentials(freshCredentials)) {
        bcLogger.info('Token was already refreshed by another process', {
          organizationId,
          connectionId: resolvedConnectionId,
        })
        const result = {
          accessToken: freshCredentials.access_token,
          connectionId: resolvedConnectionId,
        }
        // Update in-memory cache
        tokenCache.set(cacheKey, {
          ...result,
          expiresAt: freshCredentials.expires_at,
        })
        return result
      }

      if (!freshCredentials.refresh_token) {
        throw new Error('No refresh token available - please reconnect Business Central')
      }

      try {
        const newToken = await refreshAccessToken(freshCredentials.refresh_token, organizationId)
        const newCredentials = tokenToCredentials(newToken, freshCredentials.tenant_id)

        // Store refreshed tokens — use connection-aware store for OAuth
        const refreshedCreds = {
          ...newCredentials,
          connected: true,
          auth_type: 'oauth',
          company_name: freshCredentials.company_name,
          home_currency: freshCredentials.home_currency,
          tenant_id: freshCredentials.tenant_id,
          environment_name: freshCredentials.environment_name,
          company_id: freshCredentials.company_id,
        }

        if (resolvedConnectionId && resolvedConnectionId !== 'default') {
          // OAuth connection: targeted write to oauthConnections (preserves faux_credentials)
          await storeBCConnectionCredentials(
            organizationId,
            resolvedConnectionId,
            'Microsoft Dynamics 365 BC',
            refreshedCreds
          )
        } else {
          // Legacy faux_credentials path (shouldn't normally hit for OAuth)
          await storeProviderCredentialsInDB(
            organizationId,
            'dynamics',
            'Microsoft Dynamics 365 BC',
            refreshedCreds
          )
        }

        bcLogger.info('Token refresh complete, credentials updated', {
          organizationId,
          connectionId: resolvedConnectionId,
        })

        const result = {
          accessToken: newToken.access_token,
          connectionId: resolvedConnectionId,
        }
        // Update in-memory cache
        tokenCache.set(cacheKey, {
          ...result,
          expiresAt: newCredentials.expires_at,
        })
        return result
      } catch (error: any) {
        if (error.code === 'PROVIDER_INVALID_GRANT' || error.error === 'invalid_grant') {
          bcLogger.error('Invalid grant - marking BC connection as disconnected', {
            organizationId,
            connectionId: resolvedConnectionId,
          })

          // Mark the SPECIFIC connection as errored, not the entire dynamics provider.
          // Using storeProviderError would mark ALL BC connections as disconnected.
          if (resolvedConnectionId && resolvedConnectionId !== 'default') {
            await storeBCConnectionError(
              organizationId,
              resolvedConnectionId,
              'invalid_grant - Authentication expired, please reconnect'
            )
          } else {
            await storeProviderError(
              organizationId,
              'dynamics',
              'invalid_grant - Authentication expired, please reconnect'
            )
          }
        }
        throw error
      }
    },
    {
      maxWaitMs: 30000,
      timeoutMs: 60000,
      realmId: resolvedConnectionId, // Per-connection lock
    }
  )

  // Register as inflight so concurrent callers can join
  if (!forceRefresh) {
    inflightRefresh.set(cacheKey, refreshPromise)
  }
  try {
    return await refreshPromise
  } finally {
    inflightRefresh.delete(cacheKey)
  }
}
