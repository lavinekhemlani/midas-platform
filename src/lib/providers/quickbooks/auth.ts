// src/lib/providers/quickbooks/auth.ts
/**
 * QuickBooks OAuth Authentication using the official intuit-oauth SDK
 *
 * This module provides the auth interface expected by the provider system,
 * delegating all OAuth operations to the SDK via oauthClient.ts
 */
import { AuthAndTokenProvider, TokenSet } from '../interfaces/auth'
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken as sdkRefreshAccessToken,
  revokeTokens,
  IntuitToken,
} from './oauthClient'
import { qbLogger } from './logger'

export const auth: AuthAndTokenProvider = {
  /**
   * Generate the OAuth authorization URL
   */
  getLoginUrl(state: string): string {
    qbLogger.debug('QuickBooks OAuth initiated via SDK')
    return getAuthorizationUrl(state)
  },

  /**
   * Handle the OAuth callback and exchange code for tokens
   * @param code - The authorization code (or full redirect URL for SDK)
   * @param state - The state parameter (unused when full URL is passed as code)
   */
  async handleCallback(code: string, state?: string): Promise<TokenSet & { realmId?: string }> {
    try {
      qbLogger.debug('QuickBooks token exchange started via SDK')

      // The SDK expects the full redirect URL with query params
      // If the code looks like a URL, use it directly; otherwise build the URL
      const fullRedirectUrl = code.startsWith('http')
        ? code
        : `${process.env.NEXT_PUBLIC_APP_URL}/api/providers/callback?code=${encodeURIComponent(code)}`

      const { token, realmId } = await exchangeCodeForTokens(fullRedirectUrl)

      const tokenSet: TokenSet & { realmId?: string } = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresIn: token.expires_in || 3600,
        createdAt: Math.floor(Date.now() / 1000),
        realmId,
      }

      qbLogger.info('QuickBooks tokens obtained successfully via SDK', {
        realmId,
        expiresIn: tokenSet.expiresIn,
      })

      return tokenSet
    } catch (error) {
      qbLogger.error('QuickBooks callback error:', { error })
      throw error
    }
  },

  /**
   * Refresh access token using refresh token
   * Uses the SDK which handles all the complexity
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenSet> {
    try {
      qbLogger.debug('QuickBooks token refresh started via SDK')

      const newToken: IntuitToken = await sdkRefreshAccessToken(refreshToken)

      const tokenSet: TokenSet = {
        accessToken: newToken.access_token,
        refreshToken: newToken.refresh_token,
        expiresIn: newToken.expires_in || 3600,
        createdAt: Math.floor(Date.now() / 1000),
      }

      qbLogger.info('QuickBooks access token refreshed successfully via SDK')
      return tokenSet
    } catch (error) {
      qbLogger.error('QuickBooks refresh token error:', { error })
      throw error
    }
  },

  /**
   * Disconnect/revoke tokens
   */
  async disconnect(accessToken: string): Promise<void> {
    try {
      await revokeTokens(accessToken)
      qbLogger.info('QuickBooks disconnected successfully via SDK')
    } catch (error) {
      qbLogger.error('QuickBooks disconnect error:', { error })
      throw error
    }
  },

  /**
   * Get tokens - placeholder for interface compatibility
   * Actual token retrieval is done through the database
   */
  async getTokens(): Promise<TokenSet | null> {
    // Token retrieval is handled by the database layer
    return null
  },
}
