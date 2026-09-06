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
    const customerId = pathParts[pathParts.length - 1]

    const gid = customerId.startsWith('gid://')
      ? customerId
      : `gid://shopify/Customer/${customerId}`

    const customer = await client.getCustomerDetail(gid)

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    return NextResponse.json({ data: customer })
  } catch (error) {
    console.error('Shopify customer detail error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch customer detail' },
      { status: 500 }
    )
  }
})
