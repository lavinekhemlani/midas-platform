import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

/**
 * GET /api/providers/dynamics/gl-account-detail
 *
 * Fetches individual GL entries for a specific account number within a date range.
 * Used for drill-down from the P&L Income Statement — clicking a leaf account
 * shows all the journal entries that make up that line's total.
 *
 * Query params:
 *   connectionId   — BC OAuth connection ID
 *   accountNumber  — the BC account number (e.g. "40100")
 *   startDate      — period start (YYYY-MM-DD)
 *   endDate        — period end (YYYY-MM-DD)
 */

function decodeODataString(s: string): string {
  return s.replace(/_x([0-9a-f]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  const t0 = Date.now()

  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const accountNumber = url.searchParams.get('accountNumber')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    if (!accountNumber) {
      return NextResponse.json({ error: 'accountNumber is required' }, { status: 400 })
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

    // Warm up token before parallel requests
    await client.warmUp()

    // Build GL filter
    const escapedAccountNumber = accountNumber.replace(/'/g, "''")
    const filterParts = [`accountNumber eq '${escapedAccountNumber}'`]
    if (startDate) filterParts.push(`postingDate ge ${startDate}`)
    if (endDate) filterParts.push(`postingDate le ${endDate}`)

    // Fetch GL entries + account info + company info in parallel
    const [glEntriesResult, accountsResult, companyInfoResult] = await Promise.allSettled([
      client.listGeneralLedgerEntries({
        $filter: filterParts.join(' and '),
        $select:
          'entryNumber,postingDate,documentNumber,documentType,description,debitAmount,creditAmount,accountNumber',
        $orderby: 'postingDate desc',
      }),
      client.queryAll('accounts', {
        $filter: `number eq '${escapedAccountNumber}'`,
      }),
      client
        .query('companyInformation', { $top: 1 })
        .then((r: any) => r.value?.[0] || null)
        .catch(() => null),
    ])

    const glEntries: any[] = glEntriesResult.status === 'fulfilled' ? glEntriesResult.value : []
    const accounts: any[] = accountsResult.status === 'fulfilled' ? accountsResult.value : []
    const companyInfo: any =
      companyInfoResult.status === 'fulfilled' ? companyInfoResult.value : null

    const account = accounts[0] || null
    const currency = companyInfo?.currencyCode || 'USD'

    // Process GL entries
    const processedEntries = glEntries.map((entry: any) => ({
      entryNumber: entry.entryNumber ?? 0,
      postingDate: entry.postingDate || '',
      documentNumber: entry.documentNumber || '',
      documentType: entry.documentType || '',
      description: entry.description || '',
      debitAmount: Math.round((entry.debitAmount ?? 0) * 100) / 100,
      creditAmount: Math.round((entry.creditAmount ?? 0) * 100) / 100,
      netAmount: Math.round(((entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)) * 100) / 100,
    }))

    // Compute summary
    const totalDebit = processedEntries.reduce((s: number, e: any) => s + e.debitAmount, 0)
    const totalCredit = processedEntries.reduce((s: number, e: any) => s + e.creditAmount, 0)
    const netAmount = totalDebit - totalCredit

    // Group by document type for the info card
    const byDocType: Record<string, { count: number; totalDebit: number; totalCredit: number }> = {}
    for (const entry of processedEntries) {
      const docType = entry.documentType || 'Other'
      if (!byDocType[docType]) byDocType[docType] = { count: 0, totalDebit: 0, totalCredit: 0 }
      byDocType[docType].count++
      byDocType[docType].totalDebit += entry.debitAmount
      byDocType[docType].totalCredit += entry.creditAmount
    }

    logger.info('BC GL account detail fetched', {
      organizationId,
      connectionId: resolvedConnectionId,
      accountNumber,
      entryCount: processedEntries.length,
      netAmount,
    })

    return NextResponse.json({
      data: {
        account: account
          ? {
              number: account.number || '',
              displayName: account.displayName || '',
              category: decodeODataString(account.category || ''),
              subCategory: decodeODataString(account.subCategory || ''),
              accountType: decodeODataString(account.accountType || ''),
              blocked: account.blocked ?? false,
            }
          : null,
        entries: processedEntries,
        currency,
        period: { startDate, endDate },
        summary: {
          entryCount: processedEntries.length,
          totalDebit: Math.round(totalDebit * 100) / 100,
          totalCredit: Math.round(totalCredit * 100) / 100,
          netAmount: Math.round(netAmount * 100) / 100,
          byDocumentType: Object.entries(byDocType)
            .map(([type, data]) => ({
              type,
              count: data.count,
              totalDebit: Math.round(data.totalDebit * 100) / 100,
              totalCredit: Math.round(data.totalCredit * 100) / 100,
            }))
            .sort((a, b) => b.count - a.count),
        },
      },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    logger.error('Failed to fetch BC GL account detail', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to fetch GL account detail',
        details: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - t0,
      },
      { status: 500 }
    )
  }
})
