// src/lib/providers/handler.ts
import { NextRequest, NextResponse } from 'next/server'
import { TokenVerifier } from '@/lib/auth'
import { getUserOrganizationId, getProviderCredentialsFromDB, ProviderID } from './database'
import { getProvider } from './index'
import { FinancialProvider } from './interfaces'
import { ProviderApiClient } from './apiClient'

export interface ProviderContext {
  provider: FinancialProvider
  apiClient: ProviderApiClient
  organizationId: string
  userId: string
  providerId: ProviderID
}

export type ProviderHandler = (
  request: NextRequest,
  context: ProviderContext
) => Promise<NextResponse> | NextResponse

/**
 * Higher-order component that handles authentication and provider resolution
 * This replaces the need for provider-specific API routes
 */
export function withProvider(handler: ProviderHandler) {
  return async (
    request: NextRequest,
    routeContext: { params: Promise<{ provider?: string }> }
  ): Promise<NextResponse> => {
    try {
      // 1. Verify authentication
      const { userId } = await TokenVerifier.verify(request)
      if (!userId) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }

      // 2. Get organization ID
      const organizationId = await getUserOrganizationId(userId)
      if (!organizationId) {
        return NextResponse.json({ error: 'No organization found for user' }, { status: 404 })
      }

      // 3. Await params (Next.js 15+ always uses Promise)
      const resolvedParams = await routeContext.params

      // 4. Determine provider ID
      let providerId: ProviderID
      if (resolvedParams?.provider) {
        // From dynamic route parameter
        providerId = resolvedParams.provider as ProviderID
      } else {
        // Try to determine from request path or headers
        const url = new URL(request.url)
        const pathSegments = url.pathname.split('/')
        const providerIndex = pathSegments.findIndex((segment) => segment === 'providers')
        if (providerIndex !== -1 && pathSegments[providerIndex + 1]) {
          providerId = pathSegments[providerIndex + 1] as ProviderID
        } else {
          return NextResponse.json({ error: 'Provider not specified' }, { status: 400 })
        }
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
      const credentials = await getProviderCredentialsFromDB(organizationId, providerId)
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
        shopify: credentials.shop_domain
          ? `https://${credentials.shop_domain}/admin/api/2025-01`
          : '',
      }

      // For QuickBooks, we need to include the realm ID in the base URL
      let apiBaseUrl = baseUrls[providerId]
      if (providerId === 'quickbooks' && credentials.realm_id) {
        apiBaseUrl = `${apiBaseUrl}/${credentials.realm_id}`
      }

      const apiClient = new ProviderApiClient(organizationId, providerId, apiBaseUrl)

      // 8. Call the actual handler with context
      const context: ProviderContext = {
        provider,
        apiClient,
        organizationId,
        userId,
        providerId,
      }

      return await handler(request, context)
    } catch (error) {
      console.error('Provider handler error:', error)

      // Check for specific provider authentication errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Handle QuickBooks authentication errors
      if (
        errorMessage.includes('QuickBooks authentication expired') ||
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('QuickBooks not connected')
      ) {
        return NextResponse.json(
          {
            error: 'QuickBooks authentication expired',
            code: 'PROVIDER_INVALID_GRANT',
            requiresReconnect: true,
            provider: 'quickbooks',
            redirectUrl: '/settings?error=token_expired&provider=quickbooks',
            userMessage: 'Your QuickBooks connection has expired. Please reconnect to continue.',
            details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          },
          { status: 401 }
        )
      }

      // Handle Zoho authentication errors
      if (
        errorMessage.includes('Zoho authentication expired') ||
        errorMessage.includes('Zoho not connected')
      ) {
        return NextResponse.json(
          {
            error: 'Zoho authentication expired',
            code: 'PROVIDER_INVALID_GRANT',
            requiresReconnect: true,
            provider: 'zoho',
            redirectUrl: '/settings?error=token_expired&provider=zoho',
            userMessage: 'Your Zoho Books connection has expired. Please reconnect to continue.',
            details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          },
          { status: 401 }
        )
      }

      // Handle other provider disconnection scenarios
      if (errorMessage.includes('not connected for this organization')) {
        const provider =
          errorMessage.match(/(quickbooks|zoho|xero)/i)?.[0]?.toLowerCase() || 'unknown'
        return NextResponse.json(
          {
            error: 'Provider not connected',
            code: 'PROVIDER_NOT_CONNECTED',
            requiresReconnect: true,
            provider,
            redirectUrl: `/settings?error=not_connected&provider=${provider}`,
            userMessage: `Please connect ${provider === 'quickbooks' ? 'QuickBooks' : provider === 'zoho' ? 'Zoho Books' : provider} to view your financial data.`,
            details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          },
          { status: 401 }
        )
      }

      // Handle network errors
      if ((error as any).isNetworkError) {
        return NextResponse.json(
          {
            error: 'Network error',
            code: 'NETWORK_ERROR',
            userMessage: 'Unable to connect. Please check your internet connection and try again.',
            details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          },
          { status: 503 }
        )
      }

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

/**
 * Simplified version for routes that don't need provider resolution
 * Just handles authentication and organization lookup
 */
/**
 * Lightweight auth wrapper that only verifies the user token.
 * Use for endpoints that don't require an organization (e.g. listing orgs).
 */
export function withUserAuth(
  handler: (
    request: NextRequest,
    context: { userId: string }
  ) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const { userId } = await TokenVerifier.verify(request)
      if (!userId) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      return await handler(request, { userId })
    } catch (error) {
      console.error('Auth handler error:', error)
      return NextResponse.json(
        {
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  }
}

export function withAuth(
  handler: (
    request: NextRequest,
    context: { userId: string; organizationId: string }
  ) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // 1. Verify authentication
      const { userId } = await TokenVerifier.verify(request)
      if (!userId) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }

      // 2. Get organization ID
      const organizationId = await getUserOrganizationId(userId)
      if (!organizationId) {
        return NextResponse.json({ error: 'No organization found for user' }, { status: 404 })
      }

      // 3. Call the handler
      return await handler(request, { userId, organizationId })
    } catch (error) {
      console.error('Auth handler error:', error)
      return NextResponse.json(
        {
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  }
}
