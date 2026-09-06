import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined

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

    const items = await client.listItems({
      $select: 'id,number,displayName,type,itemCategoryCode,inventory,unitPrice,unitCost,blocked,baseUnitOfMeasureCode',
      $orderby: 'displayName',
    })

    // Summary metrics
    const totalItems = items.length
    const totalInventoryValue = items.reduce(
      (sum: number, item: any) => sum + (item.inventory || 0) * (item.unitCost || 0),
      0
    )
    const totalUnits = items.reduce((sum: number, item: any) => sum + (item.inventory || 0), 0)
    const lowStockItems = items.filter(
      (item: any) => item.inventory > 0 && item.inventory <= 10
    ).length
    const outOfStockItems = items.filter(
      (item: any) => item.inventory === 0 && !item.blocked
    ).length

    const companyName = credentials.company_name || null

    logger.info('BC inventory fetched', {
      organizationId,
      connectionId: resolvedConnectionId,
      itemCount: items.length,
    })

    return NextResponse.json({
      data: {
        items,
        summary: { totalItems, totalInventoryValue, totalUnits, lowStockItems, outOfStockItems },
        companyName,
      },
    })
  } catch (error) {
    logger.error('Failed to fetch BC inventory', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to fetch inventory',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
