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

    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined

    let filter: string | undefined
    if (startDate && endDate) {
      filter = `dateFilter ge ${startDate} and dateFilter le ${endDate}`
    } else if (endDate) {
      filter = `dateFilter le ${endDate}`
    }

    const data = await client.getTrialBalance(filter ? { $filter: filter } : undefined)

    // Compute totals
    const totalDebit = data.reduce((sum: number, row: any) => sum + (row.totalDebit || 0), 0)
    const totalCredit = data.reduce((sum: number, row: any) => sum + (row.totalCredit || 0), 0)

    const companyName = credentials.company_name || null

    logger.info('BC trial balance fetched', {
      organizationId,
      connectionId: resolvedConnectionId,
      accountCount: data.length,
    })

    return NextResponse.json({
      data: {
        accounts: data,
        totals: { totalDebit, totalCredit },
        companyName,
        period: { startDate, endDate },
      },
    })
  } catch (error) {
    logger.error('Failed to fetch BC trial balance', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to fetch trial balance',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
