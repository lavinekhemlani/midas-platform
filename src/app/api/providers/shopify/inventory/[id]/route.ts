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
    const itemId = pathParts[pathParts.length - 1]

    const gid = itemId.startsWith('gid://') ? itemId : `gid://shopify/InventoryItem/${itemId}`

    const item = await client.getInventoryItemDetail(gid)

    if (!item) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 })
    }

    return NextResponse.json({ data: item })
  } catch (error) {
    console.error('Shopify inventory detail error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch inventory detail' },
      { status: 500 }
    )
  }
})
