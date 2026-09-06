// src/app/api/providers/[provider]/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getProvider, isProviderSupported } from '@/lib/providers'
import { generateSecureState, isValidRedirectUri } from '@/lib/providers/oauth-security'
import { logger } from '@/lib/logger'

/**
 * Shared login logic for both GET (standard OAuth) and POST (Shopify with credentials).
 */
async function handleLogin(
  request: NextRequest,
  userId: string,
  organizationId: string,
  body?: { shop_domain?: string; shopify_client_id?: string; shopify_client_secret?: string }
) {
  const url = new URL(request.url)
  const pathSegments = url.pathname.split('/')
  const providerIndex = pathSegments.findIndex((segment) => segment === 'providers')
  const providerId = pathSegments[providerIndex + 1]

  if (!providerId || !isProviderSupported(providerId)) {
    return NextResponse.json({ error: `Unsupported provider: ${providerId}` }, { status: 400 })
  }

  try {
    const provider = getProvider(providerId, organizationId)
    if (!provider) {
      return NextResponse.json({ error: `Provider ${providerId} not available` }, { status: 500 })
    }

    // Get redirect URL from query params or use default
    const redirectUrl = url.searchParams.get('redirect_uri') || '/onboarding/connect'

    // Validate redirect URI to prevent open redirects
    if (!isValidRedirectUri(redirectUrl)) {
      logger.warn('Invalid redirect URI attempted', { redirectUrl })
      return NextResponse.json({ error: 'Invalid redirect URI' }, { status: 400 })
    }

    // Create secure state parameter with CSRF protection
    // For BC (dynamics), generate PKCE code verifier and store it in state
    let codeVerifier: string | undefined
    if (providerId === 'dynamics') {
      const { generateCodeVerifier } = await import('@/lib/providers/dynamics/oauthClient')
      codeVerifier = generateCodeVerifier()
    }

    // For Shopify, get shop domain and per-app credentials
    // POST body takes priority (secure), query params as fallback for shop_domain only
    const shopDomain =
      providerId === 'shopify'
        ? body?.shop_domain || url.searchParams.get('shop_domain') || undefined
        : undefined
    if (providerId === 'shopify' && !shopDomain) {
      return NextResponse.json({ error: 'Shopify store domain is required' }, { status: 400 })
    }
    // Per-app credentials only come from POST body (never from URL)
    const shopifyClientId = providerId === 'shopify' ? body?.shopify_client_id : undefined
    const shopifyClientSecret = providerId === 'shopify' ? body?.shopify_client_secret : undefined

    const stateData = {
      userId,
      organizationId,
      provider: providerId,
      redirect: redirectUrl,
      codeVerifier,
      shopDomain,
      shopifyClientId,
      shopifyClientSecret,
    }
    const state = await generateSecureState(stateData)

    // Get the OAuth login URL from the provider
    // For Shopify, pass the shop domain as second argument and optional per-app client ID as third
    // For BC (dynamics), pass the PKCE code verifier as second argument
    const loginUrl = provider.auth.getLoginUrl(
      state,
      providerId === 'shopify' ? shopDomain : codeVerifier,
      providerId === 'shopify' ? shopifyClientId : undefined
    )

    logger.debug('OAuth login redirect', { provider: providerId, userId, organizationId })

    // POST returns JSON with the login URL (client handles redirect)
    // GET redirects directly
    if (body) {
      return NextResponse.json({ loginUrl })
    }
    return NextResponse.redirect(loginUrl)
  } catch (error) {
    logger.error('Provider login error', { provider: providerId, error })
    return NextResponse.json(
      {
        error: `Failed to initiate ${providerId} login`,
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Standard GET-based OAuth redirect (non-Shopify providers, or Shopify without per-app creds)
export const GET = withAuth(async (request: NextRequest, { userId, organizationId }) => {
  return handleLogin(request, userId, organizationId)
})

// POST-based login for Shopify — credentials sent in request body, never in URL
export const POST = withAuth(async (request: NextRequest, { userId, organizationId }) => {
  const body = await request.json()
  return handleLogin(request, userId, organizationId, body)
})
