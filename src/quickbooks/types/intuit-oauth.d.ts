/**
 * Type declarations for intuit-oauth module
 */
declare module 'intuit-oauth' {
  export interface OAuthClientConfig {
    clientId: string
    clientSecret: string
    environment: 'sandbox' | 'production'
    redirectUri: string
    logging?: boolean
  }

  export interface TokenResponse {
    access_token: string
    refresh_token: string
    token_type: string
    x_refresh_token_expires_in: number
    expires_in: number
    id_token?: string
    latency?: number
    realmId?: string
  }

  export interface AuthResponse {
    token: TokenResponse
    response: unknown
    body: unknown
    json: TokenResponse
    intuit_tid: string
  }

  export default class OAuthClient {
    constructor(config: OAuthClientConfig)

    authorizeUri(options: { scope: string[] | string; state?: string }): string

    createToken(redirectUrl: string): Promise<AuthResponse>

    refreshUsingToken(refreshToken: string): Promise<AuthResponse>

    revoke(params?: { access_token?: string; refresh_token?: string }): Promise<AuthResponse>

    getToken(): TokenResponse | null
    setToken(token: TokenResponse): void

    isAccessTokenValid(): boolean

    static scopes: {
      Accounting: string
      Payment: string
      Payroll: string
      TimeTracking: string
      Benefits: string
      Profile: string
      Email: string
      Phone: string
      Address: string
      OpenId: string
    }
  }
}
