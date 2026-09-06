/**
 * QuickBooks Connection Status Route
 * Check if QuickBooks is connected for an organization
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * GET handler to check connection status
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const organizationId = request.nextUrl.searchParams.get('organizationId')

  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId parameter' }, { status: 400 })
  }

  try {
    const { getTokenManager } = await import('@/quickbooks')
    const tokenManager = getTokenManager()
    const isConnected = await tokenManager.isConnected(organizationId)

    return NextResponse.json({
      connected: isConnected,
      provider: 'quickbooks',
    })
  } catch (error) {
    console.error('[QuickBooks Status] Error:', error)

    return NextResponse.json({ error: 'Failed to check connection status' }, { status: 500 })
  }
}

/**
 * Status route configuration
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
