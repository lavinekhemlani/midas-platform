import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'

/**
 * GET /api/providers/dynamics/entity-probe
 *
 * Generic BC entity probe for diagnostic purposes.
 * Queries any entity with arbitrary OData params and returns raw results.
 *
 * Query params:
 *   connectionId  — BC OAuth connection ID
 *   entity        — BC entity name (e.g. generalLedgerEntries, salesInvoices)
 *   $filter       — OData filter
 *   $select       — OData select
 *   $top          — OData top
 *   $orderby      — OData orderby
 */

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  const t0 = Date.now()

  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const entity = url.searchParams.get('entity')

    if (!entity) {
      return NextResponse.json({ error: 'entity is required' }, { status: 400 })
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

    // Build OData params from query string
    const params: Record<string, any> = {}
    const $filter = url.searchParams.get('$filter')
    const $select = url.searchParams.get('$select')
    const $top = url.searchParams.get('$top')
    const $orderby = url.searchParams.get('$orderby')

    if ($filter) params.$filter = $filter
    if ($select) params.$select = $select
    if ($top) params.$top = parseInt($top, 10)
    if ($orderby) params.$orderby = $orderby

    // Use query (single page) if $top is set, queryAll otherwise (but cap at reasonable limit)
    let records: any[]
    if ($top) {
      const result = await client.query(entity, params)
      records = result.value || []
    } else {
      // Safety cap — don't fetch unlimited
      params.$top = 200
      const result = await client.query(entity, params)
      records = result.value || []
    }

    const fields = records.length > 0 ? Object.keys(records[0]) : []

    return NextResponse.json({
      data: {
        entity,
        params,
        recordCount: records.length,
        fields,
        records,
      },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Entity probe failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - t0,
      },
      { status: 500 }
    )
  }
})
