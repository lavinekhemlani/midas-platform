/**
 * QuickBooks Changes API Route
 *
 * Returns change timestamps for polling-based CDC.
 * Clients poll this endpoint to detect when data has changed.
 *
 * Usage:
 *   GET /api/quickbooks/changes?orgId=ORG%23abc123
 *
 * Response:
 *   {
 *     "timestamps": {
 *       "Invoice": "2025-12-11T05:30:00Z",
 *       "Customer": "2025-12-11T04:00:00Z"
 *     },
 *     "lastWebhookAt": "2025-12-11T05:30:00Z"
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getChangeTimestamps } from '@/quickbooks/cdc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams
  const orgId = searchParams.get('orgId')

  if (!orgId) {
    return NextResponse.json({ error: 'Missing orgId parameter' }, { status: 400 })
  }

  try {
    const timestamps = await getChangeTimestamps(orgId)

    if (timestamps === null) {
      return NextResponse.json({ error: 'Failed to fetch change timestamps' }, { status: 500 })
    }

    return NextResponse.json({
      timestamps,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[QuickBooks Changes] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch changes' }, { status: 500 })
  }
}
