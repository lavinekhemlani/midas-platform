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

    // Fetch vendors, aged payables, and company info (for LCY currency) in parallel
    const [vendors, agedAPData, companyInfoResult] = await Promise.all([
      client.listVendors({
        $select: 'id,number,displayName,email,phoneNumber,balance,currencyCode',
        $orderby: 'displayName',
      }),
      client.getAgedAccountsPayable().catch(() => ({ total: null, records: [] })),
      client
        .query('companyInformation', { $top: 1 })
        .then((r) => r.value?.[0] || null)
        .catch(() => null),
    ])

    // Resolve the LCY currency code from BC companyInformation entity
    const lcyCurrencyCode = companyInfoResult?.currencyCode || ''

    // Use BC's Total row (LCY) as authoritative; fall back to vendor sum
    const totalAP =
      agedAPData.total?.balanceDue ??
      vendors.reduce((sum: number, v: any) => sum + (v.balance || 0), 0)
    const vendorCount = vendors.length
    const vendorsWithBalance = vendors.filter((v: any) => v.balance > 0).length

    const companyName = credentials.company_name || null

    logger.info('BC vendors fetched', {
      organizationId,
      connectionId: resolvedConnectionId,
      vendorCount,
      agedAPCount: agedAPData.records.length,
    })

    return NextResponse.json({
      data: {
        vendors,
        agedPayables: agedAPData.records,
        agedPayablesTotal: agedAPData.total,
        summary: { totalAP, vendorCount, vendorsWithBalance },
        companyName,
        lcyCurrencyCode,
      },
    })
  } catch (error) {
    logger.error('Failed to fetch BC vendors', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to fetch vendors',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
