/**
 * QuickBooks Manual Sync API Route
 * Triggers manual data synchronization for an organization
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * POST handler to trigger manual sync
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { organizationId, entityTypes, since } = body

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 })
    }

    // Lazy import to avoid initialization issues
    const { getPipeline, getSupportedEntityTypes } = await import('@/quickbooks')

    const pipeline = getPipeline()

    // Parse since date if provided
    const sinceDate = since ? new Date(since) : undefined

    // Determine which entity types to sync
    const typesToSync =
      entityTypes && entityTypes.length > 0 ? entityTypes : getSupportedEntityTypes()

    // Run full or partial sync
    const result = await pipeline.fullSync(organizationId, {
      entityTypes: typesToSync,
      since: sinceDate,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[QuickBooks Sync] Error:', error)

    // Check if it's an auth error
    const { isQBAuthError } = await import('@/quickbooks')
    if (isQBAuthError(error)) {
      return NextResponse.json(
        { error: 'QuickBooks not connected', code: error.code },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Sync failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Sync route configuration
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
