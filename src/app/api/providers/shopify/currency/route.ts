// src/app/api/providers/shopify/currency/route.ts
/**
 * GET /api/providers/shopify/currency
 *
 * Lightweight endpoint that fetches ONLY the shop currency from Shopify.
 * Used by CurrencyContext to resolve currency without loading the full summary.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const shop = await client.getShop()
    const currency = shop?.currency || null

    if (!currency) {
      return NextResponse.json(
        { error: 'Could not determine currency from Shopify' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      currency,
      companyName: shop?.name || null,
      source: 'api',
    })
  } catch (error) {
    console.error('[Shopify Currency] Fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch Shopify currency' }, { status: 500 })
  }
})
