// src/lib/providers/quickbooks/oauthClient.ts
/**
 * QuickBooks OAuth Client using the official intuit-oauth SDK
 * This handles all OAuth operations including token refresh, validation, and API calls
 *
 * IMPORTANT: This is designed for serverless environments (Vercel):
 * - No in-memory state is persisted between requests
 * - All token state is stored in DynamoDB
 * - Distributed locking prevents race conditions during refresh
 */
import OAuthClient from 'intuit-oauth'
import {
  getProviderCredentialsFromDB,
  storeProviderCredentialsInDB,
  storeProviderError,
  getQBConnectionCredentials,
  storeQBConnectionCredentials,
  storeQBConnectionError,
  getActiveRealmId,
} from '../database'
import { withTokenRefreshLock } from '../tokenLock'
import { qbLogger } from './logger'

// Environment configuration
const ENVIRONMENT = process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox'
const IS_PRODUCTION = ENVIRONMENT === 'production'

// Use production credentials when environment is production, otherwise use sandbox
const CLIENT_ID =
  IS_PRODUCTION && process.env.QUICKBOOKS_CLIENT_ID_PROD
    ? process.env.QUICKBOOKS_CLIENT_ID_PROD
    : process.env.QUICKBOOKS_CLIENT_ID!

const CLIENT_SECRET =
  IS_PRODUCTION && process.env.QUICKBOOKS_CLIENT_SECRET_PROD
    ? process.env.QUICKBOOKS_CLIENT_SECRET_PROD
    : process.env.QUICKBOOKS_CLIENT_SECRET!

const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/providers/callback`

/**
 * Token object structure from Intuit OAuth SDK
 */
export interface IntuitToken {
  token_type: string
  access_token: string
  refresh_token: string
  expires_in: number
  x_refresh_token_expires_in: number
  id_token?: string
  realmId?: string
  createdAt?: number
}

/**
 * Create a new OAuthClient instance
 * Note: Each instance should be used for a single OAuth flow or operation
 */
export function createOAuthClient(token?: IntuitToken): OAuthClient {
  const config: any = {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    environment: IS_PRODUCTION ? 'production' : 'sandbox',
    redirectUri: REDIRECT_URI,
    logging: false, // Disabled - SDK tries to write to filesystem which doesn't work on Vercel serverless
  }

  // If token is provided, include it in config
  if (token) {
    config.token = token
  }

  return new OAuthClient(config)
}

/**
 * Get authorization URL for OAuth flow
 */
export function getAuthorizationUrl(state: string): string {
  const oauthClient = createOAuthClient()

  const authUri = oauthClient.authorizeUri({
    scope: [
      OAuthClient.scopes.Accounting,
      OAuthClient.scopes.OpenId,
      OAuthClient.scopes.Profile,
      OAuthClient.scopes.Email,
      OAuthClient.scopes.Phone,
      OAuthClient.scopes.Address,
    ],
    state: state,
  })

  qbLogger.info('Generated OAuth authorization URL', {
    environment: ENVIRONMENT,
    isProduction: IS_PRODUCTION,
  })

  return authUri
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  redirectUrl: string
): Promise<{ token: IntuitToken; realmId: string }> {
  const oauthClient = createOAuthClient()

  try {
    qbLogger.info('Exchanging authorization code for tokens')

    const authResponse = await oauthClient.createToken(redirectUrl)
    // Type assertion: SDK returns AuthResponse object with token property
    const token = (authResponse as any).token || ((authResponse as any).getToken?.() as IntuitToken)

    // Extract realmId from the redirect URL
    const url = new URL(redirectUrl)
    const realmId = url.searchParams.get('realmId') || token.realmId || ''

    if (!realmId) {
      throw new Error('No realmId found in OAuth response')
    }

    // Store realmId in token for consistency
    token.realmId = realmId

    qbLogger.info('Token exchange successful', {
      hasAccessToken: !!token.access_token,
      hasRefreshToken: !!token.refresh_token,
      expiresIn: token.expires_in,
      realmId,
    })

    return { token, realmId }
  } catch (error: any) {
    qbLogger.error('Token exchange failed', {
      error: error.message,
      errorCode: error.error,
      errorDescription: error.error_description,
      intuitTid: error.intuit_tid,
    })

    // Re-throw with better error message
    const errorMessage = error.error_description || error.message || 'Token exchange failed'
    throw new Error(errorMessage)
  }
}

/**
 * Refresh access token using refresh token
 * This is the core function that handles token refresh using the SDK
 */
export async function refreshAccessToken(
  refreshToken: string,
  organizationId?: string
): Promise<IntuitToken> {
  // Create a fresh OAuth client
  const oauthClient = createOAuthClient()

  try {
    qbLogger.info('Refreshing access token via SDK', {
      organizationId,
      hasRefreshToken: !!refreshToken,
    })

    // Use refreshUsingToken which is the explicit method for refresh token flow
    // This is more reliable than setting the token object and calling refresh()
    const authResponse = await oauthClient.refreshUsingToken(refreshToken)
    // Type assertion: SDK returns AuthResponse object with token property
    const newToken = ((authResponse as any).token ||
      (authResponse as any).getToken?.()) as IntuitToken

    // Validate the response
    if (!newToken.access_token) {
      throw new Error('No access token in refresh response')
    }

    if (!newToken.refresh_token) {
      throw new Error('No refresh token in refresh response - token rotation failed')
    }

    qbLogger.info('Token refresh successful via SDK', {
      organizationId,
      expiresIn: newToken.expires_in,
      hasNewRefreshToken: !!newToken.refresh_token,
    })

    return newToken
  } catch (error: any) {
    qbLogger.error('Token refresh failed', {
      organizationId,
      error: error.message,
      errorCode: error.error,
      errorDescription: error.error_description,
      intuitTid: error.intuit_tid,
    })

    // Check for invalid_grant error (refresh token expired/revoked)
    if (error.error === 'invalid_grant' || error.message?.includes('invalid_grant')) {
      const invalidGrantError: any = new Error(
        'QuickBooks authentication expired - please reconnect'
      )
      invalidGrantError.code = 'PROVIDER_INVALID_GRANT'
      invalidGrantError.error = 'invalid_grant'
      invalidGrantError.requiresReconnect = true
      throw invalidGrantError
    }

    throw error
  }
}

/**
 * Revoke tokens (disconnect)
 */
export async function revokeTokens(accessToken: string): Promise<void> {
  const oauthClient = createOAuthClient({
    token_type: 'bearer',
    access_token: accessToken,
    refresh_token: '',
    expires_in: 3600,
    x_refresh_token_expires_in: 0,
  })

  try {
    await oauthClient.revoke()
    qbLogger.info('Tokens revoked successfully')
  } catch (error: any) {
    qbLogger.error('Token revocation failed', {
      error: error.message,
    })
    throw error
  }
}

/**
 * Convert database credentials to IntuitToken format
 */
export function credentialsToToken(credentials: {
  access_token: string
  refresh_token?: string
  expires_at: number
  realm_id?: string
}): IntuitToken {
  // Calculate createdAt from expires_at (expires_at is in seconds, createdAt is in milliseconds)
  // expires_at = createdAt/1000 + expires_in
  // Assume expires_in is 3600 (1 hour) for QuickBooks
  const expiresIn = 3600
  const createdAt = (credentials.expires_at - expiresIn) * 1000

  return {
    token_type: 'bearer',
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token || '',
    expires_in: expiresIn,
    x_refresh_token_expires_in: 100 * 24 * 60 * 60, // 100 days in seconds
    realmId: credentials.realm_id,
    createdAt,
  }
}

/**
 * Convert IntuitToken to database credentials format
 */
export function tokenToCredentials(
  token: IntuitToken,
  realmId?: string
): {
  access_token: string
  refresh_token: string
  expires_at: number
  realm_id?: string
} {
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + (token.expires_in || 3600)

  return {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: expiresAt,
    realm_id: realmId || token.realmId,
  }
}

// Token refresh buffer in seconds - refresh 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_SECONDS = 5 * 60

/**
 * Check if the access token from DB credentials is still valid
 * Uses expires_at directly from the database (in seconds)
 */
function isAccessTokenValidFromCredentials(credentials: { expires_at: number }): boolean {
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = credentials.expires_at

  // Token is valid if current time is before (expiry - buffer)
  return now < expiresAt - TOKEN_REFRESH_BUFFER_SECONDS
}

/**
 * Get a valid access token for an organization.
 * For multi-entity QB, pass realmId to get tokens for a specific company.
 * If realmId not provided, uses activeRealmId from the org.
 *
 * @param forceRefresh - If true, forces token refresh even if current token is valid.
 *                       Used when a 401 indicates the token is invalid despite not being expired.
 */
export async function getValidAccessToken(
  organizationId: string,
  realmId?: string,
  forceRefresh: boolean = false
): Promise<{
  accessToken: string
  realmId: string
}> {
  // Resolve the target realmId
  let targetRealmId = realmId
  if (!targetRealmId) {
    targetRealmId = (await getActiveRealmId(organizationId)) || undefined
  }

  // Get credentials — try multi-entity first, then legacy
  let credentials
  if (targetRealmId) {
    credentials = await getQBConnectionCredentials(organizationId, targetRealmId)
  }
  if (!credentials) {
    credentials = await getProviderCredentialsFromDB(organizationId, 'quickbooks')
  }

  if (!credentials || !credentials.connected) {
    throw new Error('QuickBooks not connected for this organization')
  }

  const resolvedRealmId = targetRealmId || credentials.realm_id
  if (!resolvedRealmId) {
    throw new Error('QuickBooks realm ID not found')
  }

  if (!credentials.access_token) {
    throw new Error('No access token found - please reconnect QuickBooks')
  }

  // Check if access token is still valid (skip check if forceRefresh is true)
  if (!forceRefresh && isAccessTokenValidFromCredentials(credentials)) {
    qbLogger.debug('Access token is valid, no refresh needed', {
      organizationId,
      realmId: resolvedRealmId,
      expiresAt: new Date(credentials.expires_at * 1000).toISOString(),
      timeRemaining: credentials.expires_at - Math.floor(Date.now() / 1000),
    })
    return {
      accessToken: credentials.access_token,
      realmId: resolvedRealmId,
    }
  }

  // Token expired, expiring soon, or force refresh requested - need to refresh
  qbLogger.info(
    forceRefresh
      ? 'Force refresh requested, initiating refresh with distributed lock...'
      : 'Access token expired or expiring soon, initiating refresh with distributed lock...',
    {
      organizationId,
      realmId: resolvedRealmId,
      forceRefresh,
      expiresAt: new Date(credentials.expires_at * 1000).toISOString(),
      now: new Date().toISOString(),
    }
  )

  if (!credentials.refresh_token) {
    await storeQBConnectionError(
      organizationId,
      resolvedRealmId,
      'No refresh token available - re-authentication required'
    )
    throw new Error('No refresh token available - please reconnect QuickBooks')
  }

  // Use distributed lock scoped to this specific realmId
  return await withTokenRefreshLock(
    organizationId,
    'quickbooks',
    async () => {
      // Re-check credentials inside the lock
      let freshCredentials = targetRealmId
        ? await getQBConnectionCredentials(organizationId, targetRealmId)
        : null
      if (!freshCredentials) {
        freshCredentials = await getProviderCredentialsFromDB(organizationId, 'quickbooks')
      }

      if (!freshCredentials || !freshCredentials.connected) {
        throw new Error('QuickBooks disconnected while waiting for lock')
      }

      // Check if token was refreshed by another process
      if (isAccessTokenValidFromCredentials(freshCredentials)) {
        qbLogger.info('Token was already refreshed by another process', {
          organizationId,
          realmId: resolvedRealmId,
        })
        return {
          accessToken: freshCredentials.access_token,
          realmId: resolvedRealmId,
        }
      }

      if (!freshCredentials.refresh_token) {
        throw new Error('No refresh token available - please reconnect QuickBooks')
      }

      try {
        const newToken = await refreshAccessToken(freshCredentials.refresh_token, organizationId)
        const newCredentials = tokenToCredentials(newToken, resolvedRealmId)

        // Store refreshed tokens — use multi-entity if available, legacy otherwise
        await storeQBConnectionCredentials(organizationId, resolvedRealmId, 'QuickBooks Online', {
          ...newCredentials,
          connected: true,
          company_name: freshCredentials.company_name,
          home_currency: freshCredentials.home_currency,
        })

        qbLogger.info('Token refresh complete, credentials updated', {
          organizationId,
          realmId: resolvedRealmId,
          newExpiresAt: new Date(newCredentials.expires_at * 1000).toISOString(),
        })

        return {
          accessToken: newToken.access_token,
          realmId: resolvedRealmId,
        }
      } catch (error: any) {
        // Handle invalid_grant — only mark THIS entity as disconnected
        if (error.code === 'PROVIDER_INVALID_GRANT' || error.error === 'invalid_grant') {
          qbLogger.error('Invalid grant - marking entity as disconnected', {
            organizationId,
            realmId: resolvedRealmId,
          })

          await storeQBConnectionError(
            organizationId,
            resolvedRealmId,
            'invalid_grant - Authentication expired, please reconnect this company'
          )
        }

        throw error
      }
    },
    {
      maxWaitMs: 30000,
      timeoutMs: 60000,
      realmId: resolvedRealmId, // Per-company lock
    }
  )
}
