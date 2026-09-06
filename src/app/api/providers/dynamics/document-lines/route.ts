import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

/**
 * GET /api/providers/dynamics/document-lines
 *
 * Fetches line items for a specific BC purchase or sales document on-demand.
 *
 * Query params:
 *   connectionId  — BC OAuth connection ID
 *   documentType  — Purchase: 'invoice' | 'order' | 'creditMemo' | 'receipt'
 *                    Sales: 'salesInvoice' | 'salesCreditMemo' | 'salesShipment'
 *   documentId    — BC document GUID
 */

const ENTITY_MAP: Record<string, { entity: string; linesNav: string }> = {
  // Purchase side
  invoice: { entity: 'purchaseInvoices', linesNav: 'purchaseInvoiceLines' },
  order: { entity: 'purchaseOrders', linesNav: 'purchaseOrderLines' },
  creditMemo: { entity: 'purchaseCreditMemos', linesNav: 'purchaseCreditMemoLines' },
  receipt: { entity: 'purchaseReceipts', linesNav: 'purchaseReceiptLines' },
  // Sales side
  salesInvoice: { entity: 'salesInvoices', linesNav: 'salesInvoiceLines' },
  salesCreditMemo: { entity: 'salesCreditMemos', linesNav: 'salesCreditMemoLines' },
  salesShipment: { entity: 'salesShipments', linesNav: 'salesShipmentLines' },
}

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const documentType = url.searchParams.get('documentType')
    const documentId = url.searchParams.get('documentId')

    if (!documentType || !documentId) {
      return NextResponse.json(
        { error: 'documentType and documentId are required' },
        { status: 400 }
      )
    }

    const mapping = ENTITY_MAP[documentType]
    if (!mapping) {
      return NextResponse.json(
        {
          error: `Invalid documentType: ${documentType}. Must be one of: ${Object.keys(ENTITY_MAP).join(', ')}`,
        },
        { status: 400 }
      )
    }

    let resolvedConnectionId = connectionId
    if (!resolvedConnectionId) {
      resolvedConnectionId = (await getActiveBCConnectionId(organizationId)) || undefined
    }
    if (!resolvedConnectionId) {
      return NextResponse.json({ error: 'No active BC connection' }, { status: 404 })
    }

    const credentials = await getBCConnectionCredentials(organizationId, resolvedConnectionId)
    if (!credentials?.connected || !credentials?.access_token) {
      return NextResponse.json({ error: 'Connection not active' }, { status: 404 })
    }

    const client = new BusinessCentralClient({ organizationId, connectionId: resolvedConnectionId })

    // Fetch line items via the navigation path: entity(id)/lines
    const result = await client.query(`${mapping.entity}(${documentId})/${mapping.linesNav}`)
    const lines = result.value || []

    logger.info('BC document lines fetched', {
      organizationId,
      documentType,
      documentId,
      lineCount: lines.length,
    })

    return NextResponse.json({ data: { lines } })
  } catch (error) {
    logger.error('Failed to fetch BC document lines', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to fetch document lines',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
