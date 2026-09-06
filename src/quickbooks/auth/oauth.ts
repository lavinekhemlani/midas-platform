/**
 * QuickBooks OAuth Client
 * Wrapper around intuit-oauth for token management
 */

import OAuthClient from 'intuit-oauth'

/**
 * QuickBooks token data
 */
export interface QBToken {
  accessToken: string
  refreshToken: string
  expiresAt: number // Unix timestamp in seconds
  realmId: string
  createdAt?: number // Unix timestamp in seconds
}

/**
 * OAuth configuration
 */
export interface QBOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  environment: 'sandbox' | 'production'
}

/**
 * Get OAuth configuration from environment variables
 * @param dynamicRedirectUri - Optional redirect URI derived from request (for dynamic URL detection)
 */
export function getOAuthConfig(dynamicRedirectUri?: string): QBOAuthConfig {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET

  // Priority: explicit env var > dynamic from request > fallback to NEXT_PUBLIC_APP_URL
  const redirectUri =
    process.env.QUICKBOOKS_REDIRECT_URI ??
    dynamicRedirectUri ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/quickbooks/callback`

  const environment = (process.env.QUICKBOOKS_ENVIRONMENT ?? 'sandbox') as 'sandbox' | 'production'

  if (!clientId || !clientSecret) {
    throw new Error('QuickBooks OAuth configuration is incomplete')
  }

  if (!redirectUri || redirectUri === 'undefined/api/quickbooks/callback') {
    throw new Error(
      'QuickBooks redirect URI could not be determined. Set QUICKBOOKS_REDIRECT_URI or pass dynamicRedirectUri.'
    )
  }

  return { clientId, clientSecret, redirectUri, environment }
}

/**
 * QuickBooks OAuth client for handling OAuth 2.0 flows
 */
export class QuickBooksOAuth {
  private config: QBOAuthConfig

  /**
   * Create a new QuickBooks OAuth client
   * @param config - Optional partial config to override defaults
   * @param dynamicRedirectUri - Optional redirect URI derived from request headers
   */
  constructor(config?: Partial<QBOAuthConfig>, dynamicRedirectUri?: string) {
    const defaultConfig = getOAuthConfig(dynamicRedirectUri)
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * Create an intuit-oauth client instance
   */
  private createClient(token?: Partial<QBToken>): OAuthClient {
    const client = new OAuthClient({
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      environment: this.config.environment,
      redirectUri: this.config.redirectUri,
      logging: false,
    })

    if (token?.accessToken) {
      client.setToken({
        access_token: token.accessToken,
        refresh_token: token.refreshToken ?? '',
        token_type: 'bearer',
        expires_in: token.expiresAt
          ? Math.max(0, token.expiresAt - Math.floor(Date.now() / 1000))
          : 3600,
        x_refresh_token_expires_in: 100 * 24 * 60 * 60, // 100 days
      })
    }

    return client
  }

  /**
   * Generate the authorization URL for OAuth flow
   */
  getAuthorizationUrl(state: string): string {
    const client = this.createClient()
    return client.authorizeUri({
      scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
      state,
    })
  }

  /**
   * Safely get expires_in with validation
   */
  private getExpiresIn(expiresIn: unknown): number {
    const DEFAULT_EXPIRES_IN = 3600 // 1 hour default
    if (typeof expiresIn === 'number' && expiresIn > 0) {
      return expiresIn
    }
    return DEFAULT_EXPIRES_IN
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(redirectUrl: string): Promise<QBToken> {
    const client = this.createClient()
    const response = await client.createToken(redirectUrl)
    const token = response.token

    // Extract realmId from redirect URL
    const url = new URL(redirectUrl)
    const realmId = url.searchParams.get('realmId') ?? ''

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + this.getExpiresIn(token.expires_in),
      realmId,
    }
  }

  /**
   * Refresh an expired access token
   */
  async refreshToken(refreshToken: string): Promise<QBToken> {
    const client = this.createClient()
    const response = await client.refreshUsingToken(refreshToken)
    const token = response.token

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + this.getExpiresIn(token.expires_in),
      realmId: token.realmId ?? '',
    }
  }

  /**
   * Revoke a token (logout)
   */
  async revokeToken(token: QBToken): Promise<void> {
    const client = this.createClient(token)
    await client.revoke()
  }

  /**
   * Validate a token is still valid
   */
  async validateToken(token: QBToken): Promise<boolean> {
    const client = this.createClient(token)
    return client.isAccessTokenValid()
  }

  /**
   * Get the OAuth configuration
   */
  getConfig(): Readonly<QBOAuthConfig> {
    return { ...this.config }
  }
}
