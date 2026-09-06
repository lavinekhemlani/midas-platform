// src/lib/providers/shopify/auth.ts
// Shopify authentication provider implementation
// Uses per-store OAuth install flow: https://{shop}.myshopify.com/admin/oauth/authorize

import { AuthAndTokenProvider, TokenSet } from '../interfaces/auth'

/**
 * Shopify authentication provider implementation
 * Uses per-store OAuth install flow for public apps.
 * The shop domain is passed dynamically (via the second argument to getLoginUrl
 * and extracted from state in handleCallback) rather than read from env vars,
 * so the same app can authenticate with any Shopify store.
 */
export const auth: AuthAndTokenProvider = {
  getLoginUrl: (state: string, shopDomain?: string, perAppClientId?: string): string => {
    const clientId = perAppClientId || process.env.SHOPIFY_CLIENT_ID
    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    if (!clientId) {
      throw new Error(
        'Shopify configuration missing: Please provide a Client ID or set SHOPIFY_CLIENT_ID environment variable'
      )
    }
    if (!appUrl) {
      throw new Error(
        'Application URL not configured: Please set NEXT_PUBLIC_APP_URL environment variable'
      )
    }
    if (!shopDomain) {
      throw new Error(
        'Shopify store domain is required. Please provide your store domain (e.g. my-store.myshopify.com)'
      )
    }

    const redirectUri = `${appUrl}/api/auth/shopify/callback`

    const scopes = [
      'read_orders',
      'read_all_orders',
      'read_draft_orders',
      'read_products',
      'read_inventory',
      'read_locations',
      'read_customers',
      'read_customer_events',
      'read_reports',
      'read_analytics',
      'read_marketing_events',
      'read_marketing_integrated_campaigns',
      'read_markets',
      'read_markets_home',
      'read_returns',
      'read_payment_terms',
      'read_merchant_managed_fulfillment_orders',
      'read_assigned_fulfillment_orders',
      'read_third_party_fulfillment_orders',
      'read_shopify_payments_accounts',
      'read_shopify_payments_payouts',
      'read_shopify_payments_bank_accounts',
      'read_shopify_payments_disputes',
    ].join(',')

    const qs = new URLSearchParams({
      client_id: clientId,
      scope: scopes,
      redirect_uri: redirectUri,
      state: state,
    })

    return `https://${shopDomain}/admin/oauth/authorize?${qs}`
  },

  handleCallback: async (code: string, state: string): Promise<TokenSet> => {
    // Extract shop domain and per-app credentials from the state parameter
    // The state is base64-encoded JSON that was stored during generateSecureState
    let shopDomain: string | undefined
    let perAppClientId: string | undefined
    let perAppClientSecret: string | undefined
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'))
      shopDomain = stateData.shopDomain
      perAppClientId = stateData.shopifyClientId
      perAppClientSecret = stateData.shopifyClientSecret
    } catch {
      // State may have already been decoded by the callback handler
      // In that case, shopDomain should be injected by the callback route
    }

    // Use per-app credentials if provided, otherwise fall back to env vars
    const clientId = perAppClientId || process.env.SHOPIFY_CLIENT_ID
    const clientSecret = perAppClientSecret || process.env.SHOPIFY_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error(
        'Shopify configuration missing: Please provide app credentials or set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET environment variables'
      )
    }

    if (!shopDomain) {
      throw new Error(
        'Shopify store domain missing from OAuth state. Please restart the connection flow.'
      )
    }

    const tokenUrl = `https://${shopDomain}/admin/oauth/access_token`

    const body = JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    })

    let tokenResponse
    let attempts = 0
    const maxAttempts = 3

    while (attempts < maxAttempts) {
      attempts++
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        break
      } catch (error: any) {
        console.log(`Shopify OAuth token exchange attempt ${attempts} failed:`, error.message)

        if (attempts >= maxAttempts) {
          throw new Error(
            `Failed to exchange Shopify OAuth token after ${maxAttempts} attempts: ${error.message}`
          )
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * attempts))
      }
    }

    if (!tokenResponse) {
      throw new Error('No response received from Shopify OAuth server')
    }

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      throw new Error(`Shopify token exchange failed: ${errorText}`)
    }

    const tokenData = await tokenResponse.json()

    // Shopify per-store tokens don't expire (offline access tokens are permanent)
    // but we set a large expiresIn for consistency with the TokenSet interface
    return {
      accessToken: tokenData.access_token,
      refreshToken: undefined,
      expiresIn: 315360000, // ~10 years — Shopify offline tokens don't expire
      createdAt: Math.floor(Date.now() / 1000),
    }
  },

  refreshAccessToken: async (_refreshToken: string): Promise<TokenSet> => {
    // Shopify offline access tokens (per-store installs) do not expire
    // and there is no refresh token flow. If the token is invalid,
    // the user needs to re-authorize.
    throw new Error(
      'Shopify offline access tokens do not expire. If the token is invalid, the user must re-authorize.'
    )
  },

  disconnect: async (_accessToken: string): Promise<void> => {
    // Shopify access tokens can be revoked by uninstalling the app from the store admin.
    // There's no API endpoint to revoke tokens for custom apps.
    // Disconnecting is handled by removing credentials from our database.
    console.log('Shopify disconnect: credentials will be removed from database')
  },

  getTokens: async (): Promise<TokenSet | null> => {
    throw new Error('getTokens should be implemented at the provider handler level')
  },
}
