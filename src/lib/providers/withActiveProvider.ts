// src/lib/providers/withActiveProvider.ts
import { NextRequest, NextResponse } from 'next/server'
import { TokenVerifier } from '@/lib/auth'
import {
  getUserOrganizationId,
  getProviderCredentialsFromDB,
  getProviderInfoFromDB,
  getQBConnectionCredentials,
  getActiveRealmId,
  ProviderID,
} from './database'
import { getProvider } from './index'
import { FinancialProvider } from './interfaces'
import { ProviderApiClient } from './apiClient'
import { getActiveProviderForUser } from './active-provider'
import { logger } from '@/lib/logger'

/**
 * Extract provider ID from URL path if it's a provider-specific route
 * E.g., /api/quickbooks/reports/profit-loss -> 'quickbooks'
 *       /api/dynamics/reports/pnl -> 'dynamics'
 */
function extractProviderFromPath(pathname: string): ProviderID | null {
  const providerPatterns: { pattern: RegExp; provider: ProviderID }[] = [
    { pattern: /^\/api\/quickbooks\//, provider: 'quickbooks' },
    { pattern: /^\/api\/dynamics\//, provider: 'dynamics' },
    { pattern: /^\/api\/zoho\//, provider: 'zoho' },
    { pattern: /^\/api\/xero\//, provider: 'xero' },
    { pattern: /^\/api\/stripe\//, provider: 'stripe' },
  ]

  for (const { pattern, provider } of providerPatterns) {
    if (pattern.test(pathname)) {
      return provider
    }
  }

  return null
}

export interface ActiveProviderContext {
  provider: FinancialProvider
  apiClient: ProviderApiClient
  organizationId: string
  userId: string
  providerId: ProviderID
  // QuickBooks realm ID — identifies the active QB company for API calls
  realmId?: string
  // QuickBooks plan information
  plan?: 'SimpleStart' | 'Essentials' | 'Plus' | 'Advanced' | 'Unknown'
  planLastChecked?: number
  features?: string[]
}

export type ActiveProviderHandler = (
  request: NextRequest,
  context: ActiveProviderContext
) => Promise<NextResponse> | NextResponse

/**
 * Higher-order component that handles authentication and automatically determines the active provider
 * This is used for routes that don't have a provider in the URL path
 *
 * CRITICAL: The apiClient provided in the context MUST be passed as the final parameter
 * to ALL provider method calls. This ensures proper authentication, rate limiting, and error handling.
 *
 * Example usage:
 * ```typescript
 * export const GET = withActiveProvider(async (request, { provider, apiClient, organizationId }) => {
 *   // ALWAYS pass apiClient as the last parameter
 *   const data = await (provider.invoices.listInvoices as any)(organizationId, {}, apiClient);
 * })
 * ```
 */
export function withActiveProvider(handler: ActiveProviderHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const pathname = request.nextUrl.pathname
    const method = request.method

    logger.debug('[Provider] Request started', {
      pathname,
      method,
      hasAuthHeader: !!request.headers.get('authorization'),
      hasCookies: !!request.headers.get('cookie'),
    })

    try {
      // 1. Verify authentication
      const { userId } = await TokenVerifier.verify(request)
      if (!userId) {
        logger.error('[Provider] Auth failed - no userId', {
          pathname,
          method,
        })
        return NextResponse.json(
          {
            error: 'Authentication required',
            code: 'AUTH_USER_ID_MISSING',
          },
          { status: 401 }
        )
      }

      logger.debug('[Provider] Auth successful', { userId })

      // 2. Get organization ID
      const organizationId = await getUserOrganizationId(userId)
      if (!organizationId) {
        return NextResponse.json({ error: 'No organization found for user' }, { status: 404 })
      }

      // 3. Determine active provider
      // Priority: query param > URL path > active provider for user
      const { searchParams } = new URL(request.url)
      const providerFromQuery = searchParams.get('provider') as ProviderID | null
      const providerFromPath = extractProviderFromPath(pathname)
      const providerId =
        providerFromQuery || providerFromPath || (await getActiveProviderForUser(userId))

      if (!providerId) {
        logger.error('[Provider] No active provider found', { userId })
        return NextResponse.json(
          {
            error: 'No financial provider connected',
            message: 'Please connect QuickBooks, Zoho, or Xero in Account Settings',
            code: 'NO_PROVIDER_CONNECTED',
          },
          { status: 400 }
        )
      }

      // 4. Validate provider ID
      const validProviders: ProviderID[] = [
        'zoho',
        'quickbooks',
        'xero',
        'stripe',
        'dynamics',
        'shopify',
      ]
      if (!validProviders.includes(providerId)) {
        return NextResponse.json({ error: `Unsupported provider: ${providerId}` }, { status: 400 })
      }

      // 5. Get provider credentials
      // For QuickBooks, support multi-entity: resolve target realmId, then get credentials
      // from the connections map with legacy fallback
      let credentials
      let resolvedRealmId: string | undefined

      if (providerId === 'quickbooks') {
        // Priority for realmId: ?realmId query param > activeRealmId for org
        const realmIdFromQuery = searchParams.get('realmId')
        resolvedRealmId = realmIdFromQuery || (await getActiveRealmId(organizationId)) || undefined

        // Try multi-entity connection first, then legacy
        if (resolvedRealmId) {
          const realmCreds = await getQBConnectionCredentials(organizationId, resolvedRealmId)
          // Only use if actually connected — skip disconnected/errored entries
          if (realmCreds?.connected) {
            credentials = realmCreds
          }
        }
        if (!credentials) {
          // Fallback: getProviderCredentialsFromDB finds the first connected entry
          credentials = await getProviderCredentialsFromDB(organizationId, providerId)
          // If found via fallback, use that entry's realm_id
          if (credentials) {
            resolvedRealmId = credentials.realm_id || resolvedRealmId
          }
        }
      } else {
        credentials = await getProviderCredentialsFromDB(organizationId, providerId)
      }

      if (!credentials || !credentials.connected) {
        return NextResponse.json(
          {
            error: `${providerId} not connected for this organization`,
          },
          { status: 404 }
        )
      }

      // 6. Get provider instance
      const provider = getProvider(providerId, organizationId)
      if (!provider) {
        return NextResponse.json(
          {
            error: `Provider ${providerId} not available`,
          },
          { status: 500 }
        )
      }

      // 7. Create API client for this provider
      const baseUrls: Record<ProviderID, string> = {
        zoho: 'https://www.zohoapis.com/books/v3',
        quickbooks:
          process.env.QUICKBOOKS_ENVIRONMENT === 'production'
            ? 'https://api.intuit.com/v3/company'
            : 'https://sandbox-quickbooks.api.intuit.com/v3/company',
        xero: 'https://api.xero.com/api.xro/2.0',
        stripe: 'https://api.stripe.com/v1',
        dynamics: '', // Dynamics BC data comes from Redshift, not direct API
        shopify: `https://${process.env.SHOPIFY_SHOP_DOMAIN || 'shop.myshopify.com'}/admin/api/2025-01`,
      }

      // For QuickBooks, include the resolved realm ID in the base URL
      const effectiveRealmId = resolvedRealmId || credentials.realm_id
      let apiBaseUrl = baseUrls[providerId]
      if (providerId === 'quickbooks' && effectiveRealmId) {
        apiBaseUrl = `${apiBaseUrl}/${effectiveRealmId}`
      }

      const apiClient = new ProviderApiClient(organizationId, providerId, apiBaseUrl)

      // 8. Get plan info for QuickBooks (from multi-entity connection or legacy)
      let plan: ActiveProviderContext['plan']
      let planLastChecked: number | undefined
      let features: string[] | undefined

      if (providerId === 'quickbooks') {
        const providerInfo = await getProviderInfoFromDB(organizationId, providerId)
        if (providerInfo) {
          plan = providerInfo.plan
          planLastChecked = providerInfo.planLastChecked
          features = providerInfo.features
        }
      }

      // 9. Call the actual handler with context
      const context: ActiveProviderContext = {
        provider,
        apiClient,
        organizationId,
        userId,
        providerId,
        realmId: effectiveRealmId,
        plan,
        planLastChecked,
        features,
      }

      // console.log('🔧 withActiveProvider context created:', {
      //   providerId,
      //   organizationId,
      //   hasProvider: !!provider,
      //   hasApiClient: !!apiClient,
      //   baseUrl: apiBaseUrl,
      //   plan
      // });

      return await handler(request, context)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorCode = (error as any)?.code

      logger.error('[Provider] Handler error', {
        error: errorMessage,
        code: errorCode,
        path: request.nextUrl.pathname,
        method: request.method,
      })

      // Check for authentication token errors
      if (errorMessage.includes('Authentication token missing')) {
        logger.error('[Provider] Missing authentication token', {
          path: request.nextUrl.pathname,
        })
        return NextResponse.json(
          {
            error: 'Authentication required',
            code: 'AUTH_TOKEN_MISSING',
            userMessage: 'Please sign in to continue.',
            details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          },
          { status: 401 }
        )
      }

      if (errorMessage.includes('Token expired') || errorMessage.includes('expired')) {
        logger.error('[Provider] Token expired', {
          path: request.nextUrl.pathname,
        })
        return NextResponse.json(
          {
            error: 'Authentication expired',
            code: 'AUTH_TOKEN_EXPIRED',
            userMessage: 'Your session has expired. Please sign in again.',
            details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          },
          { status: 401 }
        )
      }

      // Check for specific provider authentication errors

      // Handle INVALID_GRANT specifically (refresh token expired/revoked)
      // This means provider needs full reconnection
      if (errorCode === 'PROVIDER_INVALID_GRANT' || errorMessage.includes('invalid_grant')) {
        const provider = (error as any)?.provider || 'quickbooks'
        return NextResponse.json(
          {
            error: `${provider === 'quickbooks' ? 'QuickBooks' : provider} authentication expired`,
            code: 'PROVIDER_INVALID_GRANT',
            requiresReconnect: true,
            provider,
            userMessage: `Your ${provider === 'quickbooks' ? 'QuickBooks' : provider} connection has expired. Please reconnect.`,
            details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          },
          { status: 401 }
        )
      }

      // Handle provider not connected (before first connection)
      if (errorMessage.includes('not connected for this organization')) {
        const provider =
          errorMessage.match(/(quickbooks|zoho|xero)/i)?.[0]?.toLowerCase() || 'unknown'
        return NextResponse.json(
          {
            error: 'Provider not connected',
            code: 'PROVIDER_NOT_CONNECTED',
            requiresReconnect: true,
            provider,
            userMessage: `Please connect ${provider === 'quickbooks' ? 'QuickBooks' : provider} to view your financial data.`,
            details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          },
          { status: 400 }
        )
      }

      // For regular "authentication expired" (access token expired but refresh token valid),
      // this is handled by auto-refresh in QuickBooksClient
      // Don't return a special error - just return generic 500
      // The retry logic in client.ts will handle the refresh

      return NextResponse.json(
        {
          error: 'Internal server error',
          code: 'API_SERVER_ERROR',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        },
        { status: 500 }
      )
    }
  }
}
