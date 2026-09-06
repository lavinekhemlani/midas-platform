// src/lib/providers/interfaces/auth.ts

/**
 * Represents the set of tokens required for a provider.
 * A refresh token may not always be present.
 */
export interface TokenSet {
  accessToken: string
  refreshToken?: string
  expiresIn: number // Duration in seconds until the access token expires
  createdAt: number // Timestamp (in seconds) when the tokens were created
}

/**
 * Defines the contract for authentication and token management for a financial provider.
 * This ensures that all providers handle OAuth flows and token refreshes in a consistent manner.
 */
export interface AuthAndTokenProvider {
  /**
   * Generates the unique URL for the user to initiate the OAuth 2.0 login flow.
   * @param state - A unique, securely generated string to prevent CSRF attacks.
   * @param secondArg - Optional provider-specific arg (PKCE code verifier for BC, shop domain for Shopify).
   * @param thirdArg - Optional provider-specific arg (per-app client ID for Shopify).
   * @returns The full URL to redirect the user to for authentication.
   */
  getLoginUrl(state: string, secondArg?: string, thirdArg?: string): string

  /**
   * Handles the callback from the provider after the user has authenticated.
   * This method is responsible for exchanging the authorization code for an access and refresh token.
   * @param code - The authorization code returned by the provider.
   * @param state - The state parameter for verification.
   * @returns A promise that resolves to a TokenSet.
   */
  handleCallback(code: string, state: string): Promise<TokenSet>

  /**
   * Refreshes an expired access token using a refresh token.
   * @param refreshToken - The refresh token to use.
   * @returns A promise that resolves to a new TokenSet.
   */
  refreshAccessToken(refreshToken: string): Promise<TokenSet>

  /**
   * Disconnects the provider for the user.
   * This may involve revoking the token with the provider's API.
   * @param accessToken - The access token to revoke.
   * @returns A promise that resolves when the disconnection is complete.
   */
  disconnect(accessToken: string): Promise<void>

  /**
   * Retrieves the stored tokens for a user/organization.
   * This is a placeholder and will likely be implemented in a higher-level manager.
   * @returns A promise that resolves to the stored TokenSet or null if not found.
   */
  getTokens(): Promise<TokenSet | null>
}
