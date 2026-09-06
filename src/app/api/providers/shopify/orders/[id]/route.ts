import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../../getShopifyClient'

/**
 * Shopify Order Detail API route.
 * Fetches rich order detail via GraphQL for expandable row.
 *
 * Params:
 *   [id] — Shopify order ID (numeric or GID)
 *   ?shop=domain — target store
 */
export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    // Extract order ID from URL path: /api/providers/shopify/orders/[id]
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const orderId = pathParts[pathParts.length - 1]

    // Convert numeric ID to GraphQL GID if needed
    const gid = orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`

    const order = await client.getOrderDetail(gid)

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ data: order })
  } catch (error) {
    console.error('Shopify order detail error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch order detail' },
      { status: 500 }
    )
  }
})
