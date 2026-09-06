import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'
import type { ShopifyCollection, ShopifyCollectionsSummary } from '@/lib/providers/shopify/types'

/**
 * Shopify Collections API route.
 * Returns smart + custom collections with product counts.
 *
 * Query params:
 *   ?shop=domain — target store
 */
export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    // Fetch both collection types in parallel
    const [smartRaw, customRaw] = await Promise.all([
      client.getSmartCollections().catch(() => []),
      client.getCustomCollections().catch(() => []),
    ])

    // Normalize into unified collection type
    const collections: ShopifyCollection[] = [
      ...smartRaw.map((c: any) => ({ ...c, collection_type: 'smart' as const })),
      ...customRaw.map((c: any) => ({ ...c, collection_type: 'custom' as const })),
    ]

    // Fetch product counts in parallel (batch of 10 at a time to avoid rate limits)
    const batchSize = 10
    for (let i = 0; i < collections.length; i += batchSize) {
      const batch = collections.slice(i, i + batchSize)
      const counts = await Promise.all(
        batch.map((c) => client.getCollectionProducts(c.id).catch(() => 0))
      )
      batch.forEach((c, idx) => {
        c.products_count = counts[idx]
      })
    }

    // Sort by product count descending
    collections.sort((a, b) => (b.products_count || 0) - (a.products_count || 0))

    const publishedCount = collections.filter((c) => c.published_at != null).length

    const summary: ShopifyCollectionsSummary = {
      totalCollections: collections.length,
      smartCollections: smartRaw.length,
      customCollections: customRaw.length,
      publishedCount,
    }

    return NextResponse.json({ data: { collections, summary } })
  } catch (error) {
    console.error('Shopify collections error:', error)
    return NextResponse.json({ error: 'Failed to fetch Shopify collections' }, { status: 500 })
  }
})
