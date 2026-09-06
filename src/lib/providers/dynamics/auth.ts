// src/lib/providers/dynamics/auth.ts
/**
 * Business Central OAuth Authentication using Azure AD / Entra ID
 *
 * Implements the AuthAndTokenProvider interface expected by the provider system,
 * delegating OAuth operations to oauthClient.ts (raw HTTP, no SDK).
 */
import { TokenSet } from '../interfaces/auth'
import {
  getAuthorizationUrl,
  generateCodeChallenge,
  exchangeCodeForTokens,
  refreshAccessToken as oauthRefreshAccessToken,
  extractTenantIdFromToken,
} from './oauthClient'
import { bcLogger } from './logger'

export const auth = {
  /**
   * Generate the Azure AD authorization URL for BC OAuth.
   * The codeVerifier is passed directly by the login route (it's stored in DynamoDB,
   * NOT in the base64 state URL parameter, to avoid leaking it to the client).
   *
   * Signature: getLoginUrl(state, codeVerifier?)
   * - When called by the provider framework (QB-style), only state is passed.
   * - For BC, the login route passes codeVerifier as the second argument.
   */
  getLoginUrl(state: string, codeVerifier?: string): string {
    bcLogger.logAuthFlow('BC OAuth initiated', { provider: 'dynamics' })

    if (!codeVerifier) {
      throw new Error(
        'PKCE code verifier is required for BC OAuth — pass it as the second argument to getLoginUrl'
      )
    }

    const codeChallenge = generateCodeChallenge(codeVerifier)
    return getAuthorizationUrl(state, codeChallenge)
  },

  /**
   * Handle the OAuth callback and exchange authorization code for tokens.
   * @param code - The authorization code from Azure AD
   * @param state - The state parameter (used to retrieve the PKCE code verifier)
   */
  async handleCallback(code: string, state: string): Promise<TokenSet & { tenantId?: string }> {
    try {
      bcLogger.logAuthFlow('BC token exchange started', { hasCode: !!code })

      // The callback route passes `code` directly for non-QB providers.
      // We need the code verifier from the validated state.
      // The callback route validates state and provides it here.
      // However, by the time handleCallback is called, state has already been
      // validated and consumed. The codeVerifier needs to come from the validated
      // state data, which is available in the callback route context.
      //
      // We extract the codeVerifier from the state parameter that was passed to us.
      // Note: For BC, the callback route passes the raw code (not the full URL).
      let codeVerifier: string | undefined
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'))
        codeVerifier = stateData.codeVerifier
      } catch {
        // If state is not base64 encoded (already validated), we need
        // the callback route to pass the verifier another way.
        // This is handled by the callback route storing it.
      }

      if (!codeVerifier) {
        throw new Error('PKCE code verifier not available — cannot complete BC token exchange')
      }

      const token = await exchangeCodeForTokens(code, codeVerifier)

      // Extract tenant ID from the id_token (preferred) or access_token (fallback)
      // Both are JWTs with a `tid` (tenant ID) claim from Azure AD
      let tenantId: string | undefined
      if (token.id_token) {
        tenantId = extractTenantIdFromToken(token.id_token) || undefined
        console.log('[BC Auth] Tenant ID from id_token:', tenantId)
      }
      if (!tenantId && token.access_token) {
        tenantId = extractTenantIdFromToken(token.access_token) || undefined
        console.log('[BC Auth] Tenant ID from access_token (fallback):', tenantId)
      }
      if (!tenantId) {
        console.warn('[BC Auth] WARNING: Could not extract tenant ID from any token')
      }

      const tokenSet: TokenSet & { tenantId?: string } = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresIn: token.expires_in || 3600,
        createdAt: Math.floor(Date.now() / 1000),
        tenantId,
      }

      bcLogger.logAuthFlow('BC tokens obtained successfully', {
        tenantId,
        expiresIn: tokenSet.expiresIn,
        hasRefreshToken: !!tokenSet.refreshToken,
      })

      return tokenSet
    } catch (error) {
      bcLogger.error('BC callback error', undefined, error)
      throw error
    }
  },

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenSet> {
    try {
      bcLogger.logAuthFlow('BC token refresh started', {})

      const newToken = await oauthRefreshAccessToken(refreshToken)

      const tokenSet: TokenSet = {
        accessToken: newToken.access_token,
        refreshToken: newToken.refresh_token,
        expiresIn: newToken.expires_in || 3600,
        createdAt: Math.floor(Date.now() / 1000),
      }

      bcLogger.logAuthFlow('BC access token refreshed successfully', {
        expiresIn: tokenSet.expiresIn,
      })

      return tokenSet
    } catch (error) {
      bcLogger.error('BC refresh token error', undefined, error)
      throw error
    }
  },

  /**
   * Disconnect — Azure AD doesn't have a standard token revocation endpoint.
   * We just clean up local storage (the disconnect route handles DB cleanup).
   */
  async disconnect(_accessToken: string): Promise<void> {
    bcLogger.logAuthFlow('BC disconnected (local cleanup only)', {})
    // No external revocation needed for Azure AD
  },

  /**
   * Get tokens — placeholder for interface compatibility.
   * Actual token retrieval is done through the database layer.
   */
  async getTokens(): Promise<TokenSet | null> {
    return null
  },
}
