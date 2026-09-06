// src/app/api/providers/quickbooks/connections/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { TokenVerifier } from '@/lib/auth'
import { getUserOrganizationId, listQBConnections, removeQBConnection } from '@/lib/providers/database'
import { revokeTokens } from '@/lib/providers/quickbooks/oauthClient'
import { logger } from '@/lib/logger'

/**
 * GET /api/providers/quickbooks/connections
 * List all connected QuickBooks companies for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await TokenVerifier.verify(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const organizationId = await getUserOrganizationId(userId)
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const result = await listQBConnections(organizationId)

    return NextResponse.json(result)
  } catch (error) {
    logger.error('[QB Connections] GET error', { error })
    return NextResponse.json({ error: 'Failed to list connections' }, { status: 500 })
  }
}

/**
 * DELETE /api/providers/quickbooks/connections?realmId=xxx
 * Disconnect a specific QuickBooks company
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await TokenVerifier.verify(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const organizationId = await getUserOrganizationId(userId)
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const realmId = searchParams.get('realmId')

    if (!realmId) {
      return NextResponse.json(
        { error: 'realmId query parameter is required' },
        { status: 400 }
      )
    }

    // Remove the connection (handles active promotion automatically)
    const result = await removeQBConnection(organizationId, realmId)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Connection not found or already removed' },
        { status: 404 }
      )
    }

    logger.info('[QB Connections] Entity disconnected', {
      organizationId,
      realmId,
      newActiveRealmId: result.newActiveRealmId,
      remainingCount: result.remainingCount,
    })

    return NextResponse.json({
      success: true,
      message: 'QuickBooks company disconnected',
      newActiveRealmId: result.newActiveRealmId,
      remainingCount: result.remainingCount,
    })
  } catch (error) {
    logger.error('[QB Connections] DELETE error', { error })
    return NextResponse.json({ error: 'Failed to disconnect company' }, { status: 500 })
  }
}
