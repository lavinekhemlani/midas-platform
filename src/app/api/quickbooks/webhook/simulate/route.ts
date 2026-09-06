/**
 * Webhook Simulation Endpoint (Development Only)
 *
 * Simulates a QuickBooks webhook by directly updating change timestamps.
 * This is useful for testing the CDC polling system without waiting for real webhooks.
 *
 * POST /api/quickbooks/webhook/simulate
 * Body: { organizationId, entityType, timestamp? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { updateChangeTimestamp } from '@/quickbooks/cdc'
import type { QBWebhookEntityType } from '@/quickbooks/types/events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Webhook simulation is only available in development' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { organizationId, entityType, timestamp } = body

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 })
    }

    if (!entityType) {
      return NextResponse.json({ error: 'Missing entityType' }, { status: 400 })
    }

    const ts = timestamp || new Date().toISOString()

    const success = await updateChangeTimestamp(
      organizationId,
      entityType as QBWebhookEntityType,
      ts
    )

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update timestamp', success: false },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Simulated webhook for ${entityType}`,
      organizationId,
      entityType,
      timestamp: ts,
    })
  } catch (error) {
    console.error('[Webhook Simulate] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Simulation failed' },
      { status: 500 }
    )
  }
}
