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

    // Fetch customers and aged receivables in parallel
    const [customers, agedARData] = await Promise.all([
      client.listCustomers({
        $select: 'id,number,displayName,email,phoneNumber,balanceDue,creditLimit,currencyCode',
        $orderby: 'displayName',
      }),
      client.getAgedAccountsReceivable().catch(() => ({ total: null, records: [] })),
    ])

    // Use BC's Total row (LCY) as authoritative; fall back to customer sum
    const totalAR =
      agedARData.total?.balanceDue ??
      customers.reduce((sum: number, c: any) => sum + (c.balanceDue || 0), 0)
    const customerCount = customers.length
    const customersWithBalance = customers.filter((c: any) => c.balanceDue > 0).length

    const companyName = credentials.company_name || null

    logger.info('BC customers fetched', {
      organizationId,
      connectionId: resolvedConnectionId,
      customerCount,
      agedARCount: agedARData.records.length,
    })

    return NextResponse.json({
      data: {
        customers,
        agedReceivables: agedARData.records,
        agedReceivablesTotal: agedARData.total,
        summary: { totalAR, customerCount, customersWithBalance },
        companyName,
      },
    })
  } catch (error) {
    logger.error('Failed to fetch BC customers', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to fetch customers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
