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
    const productId = pathParts[pathParts.length - 1]

    const gid = productId.startsWith('gid://') ? productId : `gid://shopify/Product/${productId}`

    const product = await client.getProductDetail(gid)

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ data: product })
  } catch (error) {
    console.error('Shopify product detail error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch product detail' },
      { status: 500 }
    )
  }
})
