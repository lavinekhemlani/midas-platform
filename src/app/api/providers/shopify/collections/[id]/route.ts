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
    const collectionId = pathParts[pathParts.length - 1]

    const gid = collectionId.startsWith('gid://')
      ? collectionId
      : `gid://shopify/Collection/${collectionId}`

    const collection = await client.getCollectionDetail(gid)

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    return NextResponse.json({ data: collection })
  } catch (error) {
    console.error('Shopify collection detail error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch collection detail' },
      { status: 500 }
    )
  }
})
