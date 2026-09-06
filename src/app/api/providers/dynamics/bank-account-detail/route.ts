import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

/**
 * GET /api/providers/dynamics/bank-account-detail
 *
 * Returns granular transaction-level detail for a specific bank/cash account.
 * Fetches GL entries filtered to the given account number, with monthly trend
 * and period summary.
 *
 * Query params:
 *   connectionId  — BC OAuth connection ID
 *   accountNumber — GL account number to drill into
 *   startDate     — period start (YYYY-MM-DD)
 *   endDate       — period end (YYYY-MM-DD)
 */
export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  const t0 = Date.now()

  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const accountNumber = url.searchParams.get('accountNumber')
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined

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

    // Fetch account metadata
    const allAccounts = await client.queryAll('accounts', {
      $select: 'number,displayName,category,subCategory,accountType',
    })
    const accountMeta = allAccounts.find((a: any) => a.number === accountNumber)

    // Build GL filter for the period
    let glFilter = `accountNumber eq '${accountNumber}'`
    if (startDate && endDate) {
      glFilter += ` and postingDate ge ${startDate} and postingDate le ${endDate}`
    } else if (endDate) {
      glFilter += ` and postingDate le ${endDate}`
    } else if (startDate) {
      glFilter += ` and postingDate ge ${startDate}`
    }

    // Fetch GL entries + cumulative balance in parallel
    const [periodEntries, cumulativeEntries] = await Promise.all([
      client.listGeneralLedgerEntries({
        $filter: glFilter,
        $select:
          'accountNumber,debitAmount,creditAmount,postingDate,documentNumber,documentType,description',
        $orderby: 'postingDate desc',
      }),
      // Cumulative balance up to endDate
      endDate
        ? client.listGeneralLedgerEntries({
            $filter: `accountNumber eq '${accountNumber}' and postingDate le ${endDate}`,
            $select: 'debitAmount,creditAmount',
          })
        : Promise.resolve([]),
    ])

    // Period totals
    let totalDebit = 0
    let totalCredit = 0
    for (const e of periodEntries) {
      totalDebit += e.debitAmount ?? 0
      totalCredit += e.creditAmount ?? 0
    }
    const netAmount = totalDebit - totalCredit

    // Cumulative balance
    let balance = 0
    for (const e of cumulativeEntries) {
      balance += (e.debitAmount ?? 0) - (e.creditAmount ?? 0)
    }

    // Monthly trend
    const monthMap = new Map<string, { inflow: number; outflow: number }>()
    for (const e of periodEntries) {
      const month = (e.postingDate || '').substring(0, 7)
      if (!month) continue
      if (!monthMap.has(month)) monthMap.set(month, { inflow: 0, outflow: 0 })
      const bucket = monthMap.get(month)!
      bucket.inflow += e.debitAmount ?? 0
      bucket.outflow += e.creditAmount ?? 0
    }

    const monthlyTrend = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        inflow: data.inflow,
        outflow: data.outflow,
        net: data.inflow - data.outflow,
      }))

    // Top counterparties: group by description to show where money came from / went to
    const counterpartyMap = new Map<
      string,
      { name: string; debit: number; credit: number; count: number }
    >()
    for (const e of periodEntries) {
      const name = e.description || e.documentType || 'Other'
      const existing = counterpartyMap.get(name)
      if (existing) {
        existing.debit += e.debitAmount ?? 0
        existing.credit += e.creditAmount ?? 0
        existing.count++
      } else {
        counterpartyMap.set(name, {
          name,
          debit: e.debitAmount ?? 0,
          credit: e.creditAmount ?? 0,
          count: 1,
        })
      }
    }

    const topCounterparties = [...counterpartyMap.values()]
      .sort((a, b) => b.debit + b.credit - (a.debit + a.credit))
      .slice(0, 15)

    // Currency
    let currency = 'USD'
    try {
      const companyInfo = await client
        .query('companyInformation', { $top: 1 })
        .then((r) => r.value?.[0])
      if (companyInfo?.currencyCode) currency = companyInfo.currencyCode
    } catch {
      // ignore
    }

    logger.info('BC bank account detail fetched', {
      organizationId,
      accountNumber,
      entryCount: periodEntries.length,
      durationMs: Date.now() - t0,
    })

    return NextResponse.json({
      data: {
        accountNumber,
        accountName: accountMeta?.displayName || accountNumber,
        category: accountMeta?.category || 'Assets',
        subCategory: accountMeta?.subCategory || 'Bank',
        balance,
        totalDebit,
        totalCredit,
        netAmount,
        transactionCount: periodEntries.length,
        monthlyTrend,
        transactions: periodEntries.map((e: any) => ({
          postingDate: e.postingDate,
          documentNumber: e.documentNumber,
          documentType: e.documentType,
          description: e.description,
          debitAmount: e.debitAmount ?? 0,
          creditAmount: e.creditAmount ?? 0,
        })),
        topCounterparties,
        currency,
        period: { startDate, endDate },
      },
    })
  } catch (error) {
    logger.error('Failed to fetch bank account detail', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to fetch bank account detail',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
