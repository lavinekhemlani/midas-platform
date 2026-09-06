// src/app/api/providers/quickbooks/active-company/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { TokenVerifier } from '@/lib/auth'
import {
  getUserOrganizationId,
  setActiveRealmId,
  getQBConnectionCredentials,
  getActiveRealmId,
} from '@/lib/providers/database'
import { logger } from '@/lib/logger'

/**
 * GET /api/providers/quickbooks/active-company
 * Get the currently active QuickBooks company
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

    const activeRealmId = await getActiveRealmId(organizationId)

    if (!activeRealmId) {
      return NextResponse.json({ activeRealmId: null, company: null })
    }

    const credentials = await getQBConnectionCredentials(organizationId, activeRealmId)

    return NextResponse.json({
      activeRealmId,
      company: credentials
        ? {
            realmId: activeRealmId,
            companyName: credentials.company_name || null,
            currency: credentials.home_currency || null,
            connected: credentials.connected,
          }
        : null,
    })
  } catch (error) {
    logger.error('[QB Active Company] GET error', { error })
    return NextResponse.json({ error: 'Failed to get active company' }, { status: 500 })
  }
}

/**
 * PUT /api/providers/quickbooks/active-company
 * Switch the active QuickBooks company
 * Body: { realmId: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await TokenVerifier.verify(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const organizationId = await getUserOrganizationId(userId)
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const body = await request.json()
    const { realmId } = body

    if (!realmId || typeof realmId !== 'string') {
      return NextResponse.json(
        { error: 'realmId is required in request body' },
        { status: 400 }
      )
    }

    // Verify the connection exists and is healthy
    const credentials = await getQBConnectionCredentials(organizationId, realmId)
    if (!credentials) {
      return NextResponse.json(
        { error: 'QuickBooks company not found' },
        { status: 404 }
      )
    }

    if (!credentials.connected) {
      return NextResponse.json(
        { error: 'Cannot set disconnected company as active. Please reconnect first.' },
        { status: 400 }
      )
    }

    const success = await setActiveRealmId(organizationId, realmId)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update active company' },
        { status: 500 }
      )
    }

    logger.info('[QB Active Company] Switched active entity', {
      organizationId,
      realmId,
      companyName: credentials.company_name,
    })

    return NextResponse.json({
      success: true,
      activeRealmId: realmId,
      companyName: credentials.company_name || null,
    })
  } catch (error) {
    logger.error('[QB Active Company] PUT error', { error })
    return NextResponse.json({ error: 'Failed to switch active company' }, { status: 500 })
  }
}
