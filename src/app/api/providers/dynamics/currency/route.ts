// src/app/api/providers/dynamics/currency/route.ts
/**
 * GET /api/providers/dynamics/currency
 *
 * Lightweight endpoint that fetches ONLY the currency code from BC's companyInformation.
 * Used by CurrencyContext to resolve the currency independently of the full financial-summary.
 * This avoids the perpetual loading state when navigating directly to BC sub-pages.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined

    let resolvedConnectionId = connectionId
    if (!resolvedConnectionId) {
      resolvedConnectionId = (await getActiveBCConnectionId(organizationId)) || undefined
    }

    if (!resolvedConnectionId) {
      return NextResponse.json({ error: 'No active BC OAuth connection' }, { status: 404 })
    }

    const credentials = await getBCConnectionCredentials(organizationId, resolvedConnectionId)
    if (!credentials?.connected || !credentials?.access_token) {
      return NextResponse.json({ error: 'BC connection not found or not active' }, { status: 404 })
    }

    // Check if we already have currency stored in the credentials
    if (credentials.home_currency) {
      logger.debug('[BC Currency] Using stored currency from credentials', {
        organizationId,
        connectionId: resolvedConnectionId,
        currency: credentials.home_currency,
      })
      return NextResponse.json({
        currency: credentials.home_currency,
        companyName: credentials.company_name || null,
        source: 'stored',
      })
    }

    // Fetch from BC API — only companyInformation, nothing else
    const client = new BusinessCentralClient({
      organizationId,
      connectionId: resolvedConnectionId,
    })

    const companyInfoResponse = await client
      .query('companyInformation', { $top: 1, $select: 'displayName,currencyCode' })
      .catch((e) => {
        logger.warn('[BC Currency] companyInformation query failed', { error: e.message })
        return null
      })

    const companyInfo = companyInfoResponse?.value?.[0]
    const currency = companyInfo?.currencyCode || null

    if (!currency) {
      return NextResponse.json(
        { error: 'Could not determine currency from Business Central' },
        { status: 404 }
      )
    }

    logger.info('[BC Currency] Fetched currency from BC API', {
      organizationId,
      connectionId: resolvedConnectionId,
      currency,
    })

    return NextResponse.json({
      currency,
      companyName: companyInfo?.displayName || credentials.company_name || null,
      source: 'api',
    })
  } catch (error) {
    logger.error('[BC Currency] Fetch error', {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to fetch BC currency' }, { status: 500 })
  }
})
