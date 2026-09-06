import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../../getShopifyClient'

/**
 * Shopify Refund Detail API route.
 * Fetches rich refund data for an order via GraphQL.
 * Refunds are nested under orders in Shopify's API.
 */
export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const orderId = pathParts[pathParts.length - 1]

    const gid = orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`

    const order = await client.getRefundDetail(gid)

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ data: order })
  } catch (error) {
    console.error('Shopify refund detail error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch refund detail' },
      { status: 500 }
    )
  }
})
