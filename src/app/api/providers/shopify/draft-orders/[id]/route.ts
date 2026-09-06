import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../../getShopifyClient'

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const draftOrderId = pathParts[pathParts.length - 1]

    const gid = draftOrderId.startsWith('gid://')
      ? draftOrderId
      : `gid://shopify/DraftOrder/${draftOrderId}`

    const draftOrder = await client.getDraftOrderDetail(gid)

    if (!draftOrder) {
      return NextResponse.json({ error: 'Draft order not found' }, { status: 404 })
    }

    return NextResponse.json({ data: draftOrder })
  } catch (error) {
    console.error('Shopify draft order detail error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch draft order detail' },
      { status: 500 }
    )
  }
})
