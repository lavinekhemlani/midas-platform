// src/app/api/providers/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getProvider, isProviderSupported, ProviderID } from '@/lib/providers'
import {
  storeProviderCredentialsInDB,
  storeProviderError,
  getProviderCredentialsFromDB,
  updateProviderCompanyMetadata,
  storeQBConnectionCredentials,
  updateQBConnectionMetadata,
  migrateToMultiEntity,
  getQBConnectionCredentials,
  storeShopifyConnectionCredentials,
} from '@/lib/providers/database'
import {
  validateState,
  extractOAuthError,
  isValidRedirectUri,
} from '@/lib/providers/oauth-security'
import { logger } from '@/lib/logger'
import { withRequestContext } from '@/lib/middleware/requestContext'

const USE_SANDBOX = process.env.QUICKBOOKS_ENVIRONMENT !== 'production'
const QUICKBOOKS_API_BASE = USE_SANDBOX
  ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
  : 'https://quickbooks.api.intuit.com/v3/company'

/**
 * Fetch company metadata (currency and name) from QuickBooks using fresh access token
 * This is called immediately after OAuth to store in DynamoDB
 */
async function fetchQuickBooksCompanyMetadata(
  accessToken: string,
  realmId: string
): Promise<{ homeCurrency: string | null; companyName: string | null }> {
  let homeCurrency: string | null = null
  let companyName: string | null = null

  try {
    // Fetch company info first (gets both name and country for currency fallback)
    const companyResponse = await fetch(
      `${QUICKBOOKS_API_BASE}/${realmId}/companyinfo/${realmId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    )

    if (companyResponse.ok) {
      const companyData = await companyResponse.json()
      const companyInfo = companyData?.CompanyInfo
      companyName = companyInfo?.CompanyName || companyInfo?.LegalName || null
      const country = companyInfo?.Country

      logger.info('Fetched company info from QuickBooks', { companyName, country, realmId })

      // Use country as currency fallback if preferences fail
      if (country === 'CA') {
        homeCurrency = 'CAD'
      }
    }

    // Fetch preferences to get home currency (more accurate than country-based)
    const prefsResponse = await fetch(`${QUICKBOOKS_API_BASE}/${realmId}/preferences`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    if (prefsResponse.ok) {
      const data = await prefsResponse.json()
      const prefsCurrency =
        data?.Preferences?.CurrencyPrefs?.HomeCurrency?.value ||
        data?.CurrencyPrefs?.HomeCurrency?.value

      if (prefsCurrency) {
        homeCurrency = prefsCurrency
        logger.info('Fetched home currency from QuickBooks preferences', {
          homeCurrency,
          realmId,
        })
      }
    }

    // Default to USD if no currency found
    if (!homeCurrency) {
      homeCurrency = 'USD'
      logger.info('Defaulting to USD for home currency', { realmId })
    }

    return { homeCurrency, companyName }
  } catch (error) {
    logger.error('Error fetching QuickBooks company metadata', { error, realmId })
    return { homeCurrency: 'USD', companyName: null }
  }
}

/**
 * Get base URL for redirects - prioritizes environment variable for security
 */
function getBaseUrl(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }

  const protocol = req.headers.get('x-forwarded-proto') || 'http'
  const host = req.headers.get('host')

  if (!host) {
    throw new Error('Cannot determine base URL - no host header')
  }

  return `${protocol}://${host}`
}

/**
 * Verify that the session has been established after OAuth token storage.
 * For multi-entity QB, verifies the specific realmId connection.
 */
async function verifySessionEstablished(
  organizationId: string,
  providerId: ProviderID,
  realmId?: string
): Promise<boolean> {
  try {
    // For QB multi-entity, verify the specific connection
    let credentials
    if (providerId === 'quickbooks' && realmId) {
      credentials = await getQBConnectionCredentials(organizationId, realmId)
    }
    if (!credentials) {
      credentials = await getProviderCredentialsFromDB(organizationId, providerId)
    }

    if (!credentials) {
      logger.warn('Session verification failed: credentials not found', {
        organizationId,
        providerId,
        realmId,
      })
      return false
    }

    if (!credentials.connected) {
      logger.warn('Session verification failed: credentials not connected', {
        organizationId,
        providerId,
        realmId,
      })
      return false
    }

    if (!credentials.access_token) {
      logger.warn('Session verification failed: missing access token', {
        organizationId,
        providerId,
        realmId,
      })
      return false
    }

    logger.info('Session verification successful', { organizationId, providerId, realmId })
    return true
  } catch (error) {
    logger.error('Session verification error', { organizationId, providerId, realmId, error })
    return false
  }
}

export const GET = withRequestContext(async (req: NextRequest) => {
  logger.workflow('provider_integration', 'oauth_callback_received', {
    hasCode: !!req.nextUrl.searchParams.get('code'),
    hasError: !!req.nextUrl.searchParams.get('error'),
    hasState: !!req.nextUrl.searchParams.get('state'),
  })

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state')
  const realmId = searchParams.get('realmId') // QuickBooks-specific parameter

  logger.debug('OAuth callback params extracted', {
    hasCode: !!code,
    error,
    hasState: !!state,
    realmId,
  })

  // Default fallback values
  let finalRedirectUrl = '/onboarding/connect'
  let userId: string | null = null
  let organizationId: string | null = null
  let providerId: ProviderID | null = null

  // Validate CSRF state parameter
  if (!state) {
    logger.error('No state parameter provided in OAuth callback - possible CSRF attack')
    return NextResponse.redirect(new URL(`/onboarding/connect?oauth_error=missing_state`, req.url))
  }

  const stateValidation = await validateState(state)

  if (!stateValidation.valid) {
    logger.error('State validation failed', { error: stateValidation.error })
    return NextResponse.redirect(
      new URL(
        `/onboarding/connect?oauth_error=${encodeURIComponent(stateValidation.error || 'invalid_state')}`,
        req.url
      )
    )
  }

  // Extract validated state data
  if (stateValidation.data) {
    userId = stateValidation.data.userId
    organizationId = stateValidation.data.organizationId
    providerId = stateValidation.data.provider as ProviderID
    finalRedirectUrl = stateValidation.data.redirect

    // Validate redirect URL to prevent open redirect vulnerability
    if (!isValidRedirectUri(finalRedirectUrl)) {
      logger.error('Invalid redirect URL in OAuth state', {
        redirect: finalRedirectUrl,
        userId,
        organizationId,
      })
      return NextResponse.redirect(
        new URL(`/onboarding/connect?oauth_error=invalid_redirect`, req.url)
      )
    }

    logger.info('OAuth state validated successfully', { userId, organizationId, providerId })
  } else {
    logger.error('State validation succeeded but no data returned')
    return NextResponse.redirect(
      new URL(`/onboarding/connect?oauth_error=state_data_missing`, req.url)
    )
  }

  logger.debug('Provider callback processed', {
    code: !!code,
    error,
    providerId,
    userId,
    organizationId,
    realmId,
  })

  if (!userId || !organizationId || !providerId) {
    logger.error('Missing required parameters in provider callback')
    return NextResponse.redirect(
      new URL(`${finalRedirectUrl}?oauth_error=missing_parameters`, req.url)
    )
  }

  if (!isProviderSupported(providerId)) {
    logger.error('Unsupported provider in callback', { providerId })
    return NextResponse.redirect(
      new URL(`${finalRedirectUrl}?oauth_error=unsupported_provider`, req.url)
    )
  }

  try {
    if (error) {
      console.error(`${providerId} OAuth error:`, error)
      await storeProviderError(organizationId, providerId, `OAuth error: ${error}`)
      return NextResponse.redirect(
        new URL(`${finalRedirectUrl}?oauth_error=${encodeURIComponent(error)}`, req.url)
      )
    }

    if (!code) {
      console.error(`Missing authorization code in ${providerId} callback`)
      await storeProviderError(organizationId, providerId, 'Missing authorization code')
      return NextResponse.redirect(new URL(`${finalRedirectUrl}?oauth_error=missing_code`, req.url))
    }

    // Get provider instance
    const provider = getProvider(providerId, organizationId)
    if (!provider) {
      console.error(`Provider ${providerId} not available`)
      await storeProviderError(organizationId, providerId, 'Provider not available')
      return NextResponse.redirect(
        new URL(`${finalRedirectUrl}?oauth_error=provider_unavailable`, req.url)
      )
    }

    console.log(`Exchanging authorization code for ${providerId} tokens...`)
    console.log(`Using provider: ${providerId}, Code length: ${code.length}`)

    // Handle the OAuth callback and get tokens
    // For QuickBooks, we pass the full redirect URL to the SDK (it needs the query params)
    // For BC (dynamics), we pass the code and a state containing the PKCE codeVerifier
    let tokenSet
    try {
      let codeOrUrl: string
      let stateForCallback: string

      if (providerId === 'quickbooks') {
        // QB SDK needs the full redirect URL with query params
        codeOrUrl = req.url
        stateForCallback = state || ''
      } else if (providerId === 'dynamics' && stateValidation.data?.codeVerifier) {
        // BC needs the authorization code and the PKCE code verifier
        // Re-encode state with codeVerifier so auth.handleCallback can extract it
        codeOrUrl = code
        stateForCallback = Buffer.from(
          JSON.stringify({ codeVerifier: stateValidation.data.codeVerifier })
        ).toString('base64')
      } else if (providerId === 'shopify' && stateValidation.data?.shopDomain) {
        // Shopify needs the shop domain and per-app credentials to exchange the code for a token
        // Re-encode state with shopDomain + credentials so auth.handleCallback can extract them
        codeOrUrl = code
        stateForCallback = Buffer.from(
          JSON.stringify({
            shopDomain: stateValidation.data.shopDomain,
            shopifyClientId: stateValidation.data.shopifyClientId,
            shopifyClientSecret: stateValidation.data.shopifyClientSecret,
          })
        ).toString('base64')
      } else {
        // Other providers: pass just the code
        codeOrUrl = code
        stateForCallback = state || ''
      }

      tokenSet = await provider.auth.handleCallback(codeOrUrl, stateForCallback)
      console.log('Token exchange successful:', {
        hasAccessToken: !!tokenSet.accessToken,
        hasRefreshToken: !!tokenSet.refreshToken,
        expiresIn: tokenSet.expiresIn,
        hasRealmId: !!(tokenSet as any).realmId,
        hasTenantId: !!(tokenSet as any).tenantId,
      })
    } catch (tokenError) {
      console.error('Token exchange failed:', tokenError)
      throw tokenError
    }

    // Build credentials object with provider-specific fields
    const credentials: any = {
      access_token: tokenSet.accessToken,
      refresh_token: tokenSet.refreshToken,
      expires_at: Math.floor(Date.now() / 1000) + (tokenSet.expiresIn || 3600),
      connected: true,
      last_synced: Math.floor(Date.now() / 1000),
    }

    // Add QuickBooks-specific fields
    if (providerId === 'quickbooks') {
      console.log('Processing QuickBooks-specific fields...')
      console.log('RealmId from URL:', realmId)
      console.log('RealmId from tokenSet:', (tokenSet as any).realmId)

      // QuickBooks sends realmId as a query parameter
      if (realmId) {
        credentials.realm_id = realmId
        credentials.provider_organization_id = realmId // Also store as provider_organization_id for UI
        console.log('Using realmId from URL:', realmId)
      } else if ('realmId' in tokenSet) {
        credentials.realm_id = (tokenSet as any).realmId
        credentials.provider_organization_id = (tokenSet as any).realmId // Also store as provider_organization_id for UI
        console.log('Using realmId from tokenSet:', (tokenSet as any).realmId)
      } else {
        console.warn('No realmId found for QuickBooks connection!')
      }
    }

    // Add Business Central (dynamics) OAuth-specific fields
    if (providerId === 'dynamics') {
      const tenantId = (tokenSet as any).tenantId
      if (tenantId) {
        credentials.tenant_id = tenantId
        credentials.provider_organization_id = tenantId
        console.log('BC tenant ID from token:', tenantId)
      }
      // Mark as OAuth-authenticated, pending environment/company selection
      credentials.auth_type = 'oauth'
      credentials.pending_environment_selection = true
      credentials.connected = false // Not fully connected until env+company selected
    }

    // Add Shopify-specific fields
    if (providerId === 'shopify' && stateValidation.data?.shopDomain) {
      credentials.shop_domain = stateValidation.data.shopDomain
      credentials.provider_organization_id = stateValidation.data.shopDomain
      // Store per-app credentials so token exchanges use the correct app
      if (stateValidation.data.shopifyClientId) {
        credentials.client_id = stateValidation.data.shopifyClientId
      }
      if (stateValidation.data.shopifyClientSecret) {
        credentials.client_secret = stateValidation.data.shopifyClientSecret
      }
      // Fetch the store's display name from Shopify API so sidebar/dashboard show it
      try {
        const { ShopifyClient } = await import('@/lib/providers/shopify/client')
        const shopClient = new ShopifyClient({
          shopDomain: stateValidation.data.shopDomain,
          accessToken: credentials.access_token,
        })
        const shop = await shopClient.getShop()
        if (shop.name) {
          credentials.company_name = shop.name
          logger.info('Fetched Shopify store name', {
            shopDomain: stateValidation.data.shopDomain,
            shopName: shop.name,
          })
        }
        if (shop.currency) {
          credentials.home_currency = shop.currency
        }
      } catch (shopErr) {
        logger.warn('Failed to fetch Shopify store name, will use domain as fallback', {
          shopDomain: stateValidation.data.shopDomain,
          error: shopErr,
        })
      }
      console.log('Shopify shop domain from state:', stateValidation.data.shopDomain)
    }

    // Log the complete credentials object before storing
    console.log('Storing credentials for provider:', providerId, {
      hasAccessToken: !!credentials.access_token,
      hasRefreshToken: !!credentials.refresh_token,
      connected: credentials.connected,
      realmId: credentials.realm_id,
      providerOrgId: credentials.provider_organization_id,
    })

    // Store the credentials in the database
    let success: boolean
    if (providerId === 'quickbooks' && credentials.realm_id) {
      // Multi-entity QB: additive storage — doesn't overwrite other connections
      // First, migrate legacy format if needed
      await migrateToMultiEntity(organizationId)

      success = await storeQBConnectionCredentials(
        organizationId,
        credentials.realm_id,
        getProviderDisplayName(providerId),
        credentials,
        userId || undefined
      )
    } else if (providerId === 'dynamics' && credentials.auth_type === 'oauth') {
      // BC OAuth: store initial tokens in oauthConnections (additive — preserves faux_credentials)
      // Use a temp connection ID; the real one is set when user picks environment+company
      const { storeBCConnectionCredentials } = await import('@/lib/providers/database')
      success = await storeBCConnectionCredentials(
        organizationId,
        '_pending_oauth',
        getProviderDisplayName(providerId),
        credentials,
        userId || undefined
      )
    } else if (providerId === 'shopify' && credentials.shop_domain) {
      // Multi-store Shopify: additive storage — each store keyed by shop domain
      success = await storeShopifyConnectionCredentials(
        organizationId,
        credentials.shop_domain,
        getProviderDisplayName(providerId),
        credentials,
        userId || undefined
      )
    } else {
      // Other providers: standard overwrite storage
      success = await storeProviderCredentialsInDB(
        organizationId,
        providerId,
        getProviderDisplayName(providerId),
        credentials
      )
    }

    if (!success) {
      console.error(`Failed to store ${providerId} credentials`)
      await storeProviderError(organizationId, providerId, 'Failed to store credentials')
      const baseUrl = getBaseUrl(req)
      return NextResponse.redirect(
        new URL(`${finalRedirectUrl}?oauth_error=storage_failed`, baseUrl)
      )
    }

    console.log(`${providerId} OAuth success! Tokens stored for organization:`, organizationId)

    // For BC OAuth: tokens are stored but user still needs to select environment + company.
    // Redirect to the BC setup page instead of the dashboard.
    if (providerId === 'dynamics' && credentials.auth_type === 'oauth') {
      const baseUrl = getBaseUrl(req)
      logger.info('BC OAuth initial auth complete — redirecting to environment picker', {
        organizationId,
        tenantId: credentials.tenant_id,
      })
      return NextResponse.redirect(
        new URL(`/onboarding/bc-setup?oauth_success=true&provider=dynamics`, baseUrl)
      )
    }

    // Verify the stored data by reading it back
    if (providerId === 'quickbooks' && credentials.realm_id) {
      try {
        const verifyConn = await getQBConnectionCredentials(organizationId, credentials.realm_id)
        console.log('[QB OAuth] Verification read-back:', {
          realmId: credentials.realm_id,
          foundConnection: !!verifyConn,
          connected: verifyConn?.connected,
          hasAccessToken: !!verifyConn?.access_token,
          companyName: verifyConn?.company_name,
        })
      } catch (verifyErr) {
        console.error('[QB OAuth] Verification read-back FAILED:', verifyErr)
      }
    }

    // Fetch and store company metadata (currency and name) for QuickBooks connections
    if (providerId === 'quickbooks' && credentials.realm_id && credentials.access_token) {
      logger.info('Fetching company metadata for QuickBooks connection', {
        organizationId,
        realmId: credentials.realm_id,
      })

      const metadata = await fetchQuickBooksCompanyMetadata(
        credentials.access_token,
        credentials.realm_id
      )

      if (metadata.homeCurrency || metadata.companyName) {
        // Use multi-entity metadata update for the specific connection
        const metadataStored = await updateQBConnectionMetadata(
          organizationId,
          credentials.realm_id,
          {
            homeCurrency: metadata.homeCurrency || undefined,
            companyName: metadata.companyName || undefined,
          }
        )
        if (metadataStored) {
          logger.info('Company metadata stored successfully', {
            organizationId,
            realmId: credentials.realm_id,
            homeCurrency: metadata.homeCurrency,
            companyName: metadata.companyName,
          })
        } else {
          logger.warn('Failed to store company metadata, will fetch on demand', { organizationId })
        }
      }
    }

    // Verify session establishment before redirect with exponential backoff
    logger.info('Verifying session establishment after token storage', {
      organizationId,
      providerId,
    })

    const maxRetries = 3
    const retryDelays = [200, 500, 1000] // Exponential backoff in ms
    let sessionEstablished = false

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const ready = await verifySessionEstablished(organizationId, providerId, credentials.realm_id)

      if (ready) {
        sessionEstablished = true
        if (attempt > 0) {
          logger.info('Session established after retry', { organizationId, providerId, attempt })
        }
        break
      }

      if (attempt < maxRetries - 1) {
        logger.warn('Session not ready, retrying', {
          organizationId,
          providerId,
          attempt: attempt + 1,
          nextDelay: retryDelays[attempt],
        })
        await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]))
      }
    }

    if (!sessionEstablished) {
      logger.error('Session establishment failed after all retries - disconnecting provider', {
        organizationId,
        providerId,
        realmId: credentials.realm_id,
        attempts: maxRetries,
      })

      // Session failed to establish - mark the specific connection as failed
      if (providerId === 'quickbooks' && credentials.realm_id) {
        const { storeQBConnectionError } = await import('@/lib/providers/database')
        await storeQBConnectionError(
          organizationId,
          credentials.realm_id,
          'session_establishment_failed - Failed to establish session after OAuth'
        )
      } else {
        await storeProviderCredentialsInDB(
          organizationId,
          providerId,
          getProviderDisplayName(providerId),
          {
            connected: false,
            error: 'session_establishment_failed',
            error_message: 'Failed to establish session after OAuth - please reconnect',
            last_error_at: Math.floor(Date.now() / 1000),
          }
        )
      }

      // Log the failure for monitoring
      await storeProviderError(
        organizationId,
        providerId,
        'Session propagation timeout - user needs to reconnect'
      )

      // Redirect to original page - the UI will detect disconnected state from DB
      const baseUrl = getBaseUrl(req)
      return NextResponse.redirect(new URL(finalRedirectUrl, baseUrl))
    }

    // Successful session establishment - redirect to original page
    const baseUrl = getBaseUrl(req)
    return NextResponse.redirect(
      new URL(`${finalRedirectUrl}?oauth_success=true&provider=${providerId}`, baseUrl)
    )
  } catch (authError) {
    console.error(`${providerId} OAuth callback error:`, authError)

    // Extract and categorize OAuth errors
    const errorDetails = extractOAuthError(authError)
    console.error('OAuth error details:', errorDetails)

    // Store error in database
    if (organizationId && providerId) {
      await storeProviderError(
        organizationId,
        providerId,
        `${errorDetails.type}: ${errorDetails.message}`
      )
    }

    // Special handling for invalid_grant errors
    if (errorDetails.type === 'invalid_grant') {
      console.error('Invalid grant error - user needs to re-authenticate')
      const baseUrl = getBaseUrl(req)
      return NextResponse.redirect(
        new URL(
          `${finalRedirectUrl}?oauth_error=invalid_grant&message=${encodeURIComponent('Please re-authenticate with ' + providerId)}`,
          baseUrl
        )
      )
    }

    const errorMessage =
      authError instanceof Error ? authError.message : 'Unknown authentication error'
    const baseUrl = getBaseUrl(req)
    return NextResponse.redirect(
      new URL(`${finalRedirectUrl}?oauth_error=${encodeURIComponent(errorMessage)}`, baseUrl)
    )
  }
})

function getProviderDisplayName(providerId: ProviderID): string {
  const displayNames: Record<ProviderID, string> = {
    zoho: 'Zoho Books',
    quickbooks: 'QuickBooks Online',
    xero: 'Xero',
    stripe: 'Stripe',
    dynamics: 'Microsoft Dynamics 365 BC',
    shopify: 'Shopify',
  }
  return displayNames[providerId] || providerId
}
