/**
 * QuickBooks Webhook API Route
 *
 * Handles incoming webhook notifications from QuickBooks.
 * Updates CDC change timestamps for polling-based UI updates WITHOUT storing financial data.
 *
 * Flow:
 * 1. Verify webhook signature
 * 2. Parse webhook events
 * 3. Update change timestamps in DynamoDB (metadata only, no financial data)
 * 4. Return 200 OK within 3 seconds
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * GET handler for webhook verification challenge
 * QuickBooks sends a challenge parameter that must be echoed back
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const challenge = request.nextUrl.searchParams.get('challenge')

  if (challenge) {
    // Echo back the challenge for verification
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  }

  // Health check endpoint
  return NextResponse.json({ status: 'ok', service: 'quickbooks-webhook' })
}

/**
 * POST handler for webhook notifications
 * Receives and processes webhook events from QuickBooks
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Get signature header
  const signature = request.headers.get('intuit-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing intuit-signature header' }, { status: 401 })
  }

  try {
    // Get raw body for signature verification
    const body = await request.text()

    // Lazy imports to avoid initialization issues
    const { verifyWebhookSignature } = await import('@/quickbooks/webhook/signature')
    const { getOrganizationByRealmId } = await import('@/lib/db/organizations')

    // Verify signature
    const webhookVerifierToken = process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN
    if (!webhookVerifierToken) {
      console.error('[QuickBooks Webhook] Missing QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    const isValid = verifyWebhookSignature(body, signature, webhookVerifierToken)
    if (!isValid) {
      console.warn('[QuickBooks Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
    }

    // Parse payload
    let payload: {
      eventNotifications: Array<{
        realmId: string
        dataChangeEvent: {
          entities: Array<{
            name: string
            id: string
            operation: 'Create' | 'Update' | 'Delete' | 'Merge' | 'Void'
            lastUpdated: string
          }>
        }
      }>
    }

    try {
      payload = JSON.parse(body)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    if (!payload.eventNotifications || !Array.isArray(payload.eventNotifications)) {
      return NextResponse.json({ error: 'Invalid webhook payload structure' }, { status: 400 })
    }

    // Process events and update change timestamps (no financial data stored)
    const { updateChangeTimestamps } = await import('@/quickbooks/cdc')

    let processed = 0
    let failed = 0

    // Group changes by organization
    for (const notification of payload.eventNotifications) {
      const realmId = notification.realmId
      const entities = notification.dataChangeEvent?.entities || []

      if (entities.length === 0) continue

      try {
        // Resolve organization ID from realm
        const org = await getOrganizationByRealmId(realmId)

        if (!org?.PK) {
          console.warn(`[QuickBooks Webhook] No organization found for realm ${realmId}`)
          failed += entities.length
          continue
        }

        // Collect change timestamps per entity type
        const changes: Record<string, string> = {}
        for (const entity of entities) {
          const entityType = entity.name
          const timestamp = entity.lastUpdated || new Date().toISOString()

          // Keep the latest timestamp per entity type
          if (!changes[entityType] || timestamp > changes[entityType]) {
            changes[entityType] = timestamp
          }
        }

        // Update timestamps in DynamoDB (metadata only - no financial data)
        const success = await updateChangeTimestamps(org.PK, changes)

        if (success) {
          processed += entities.length
          console.log(
            `[QuickBooks Webhook] Updated timestamps for ${org.PK}:`,
            Object.keys(changes)
          )
        } else {
          failed += entities.length
        }
      } catch (error) {
        console.error(`[QuickBooks Webhook] Error processing realm ${realmId}:`, error)
        failed += entities.length
      }
    }

    console.log(`[QuickBooks Webhook] Processed: ${processed}, Failed: ${failed}`)

    // QuickBooks expects 200 OK within 3 seconds
    return new NextResponse(null, { status: 200 })
  } catch (error) {
    console.error('[QuickBooks Webhook] Error:', error)

    // Lazy import error type guard
    const { isQBWebhookError } = await import('@/quickbooks')

    // Return appropriate status codes based on error type
    if (isQBWebhookError(error)) {
      switch (error.code) {
        case 'INVALID_SIGNATURE':
          return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
        case 'INVALID_PAYLOAD':
          return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
        case 'PROCESSING_ERROR':
          return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
        default:
          return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
      }
    }

    // For unknown errors, return 500 so QuickBooks retries
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Webhook route configuration
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
