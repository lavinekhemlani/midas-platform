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
    const disputeId = parseInt(pathParts[pathParts.length - 1], 10)

    if (isNaN(disputeId)) {
      return NextResponse.json({ error: 'Invalid dispute ID' }, { status: 400 })
    }

    const dispute = await client.getDisputeDetail(disputeId)

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }

    return NextResponse.json({ data: dispute })
  } catch (error) {
    console.error('Shopify dispute detail error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch dispute detail' },
      { status: 500 }
    )
  }
})
