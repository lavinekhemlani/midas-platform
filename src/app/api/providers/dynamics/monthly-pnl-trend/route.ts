import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'

/**
 * GET /api/providers/dynamics/monthly-pnl-trend
 *
 * Returns monthly P&L breakdown for trend charts.
 * Uses chart-structure walk to identify P&L accounts, then buckets GL entries by month.
 */

function decodeODataString(s: string): string {
  return s.replace(/_x([0-9a-f]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * Map each account number to its P&L category using Begin-Total/End-Total depth walk.
 * Same algorithm as income-statement-test (KPI card) to ensure consistent classification.
 * Only accounts inside a proper Begin-Total/End-Total pair are included.
 * Returns: accountNumber → 'Income' | 'Cost of Goods Sold' | 'Expense'
 */
function buildPnLCategoryMap(allAccounts: any[]): Map<string, string> {
  const PNL_CATEGORIES = ['Income', 'Cost of Goods Sold', 'Expense']

  const sorted = [...allAccounts].sort((a: any, b: any) =>
    (a.number || '').localeCompare(b.number || '')
  )

  const result = new Map<string, string>()
  let globalDepth = 0
  let inPLSection = false
  let plSectionCategory = ''

  for (const acc of sorted) {
    const accType = decodeODataString(acc.accountType || '').toLowerCase()
    const rawCat = decodeODataString(acc.category || '').trim()

    if (accType === 'begin-total') {
      if (!inPLSection && globalDepth === 0 && PNL_CATEGORIES.includes(rawCat)) {
        inPLSection = true
        plSectionCategory = rawCat
      }
      globalDepth++
    } else if (accType === 'end-total' || accType === 'total') {
      globalDepth = Math.max(0, globalDepth - 1)
      if (inPLSection && globalDepth === 0) {
        inPLSection = false
      }
    } else if (inPLSection && accType !== 'heading') {
      // Posting account inside a P&L section
      result.set(acc.number, plSectionCategory)
    }
  }

  return result
}

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined

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
    const t0 = Date.now()

    // Fetch accounts (for chart-structure walk) and company info in parallel
    const [allAccounts, companyInfo] = await Promise.all([
      client.queryAll('accounts'),
      client
        .query('companyInformation', { $top: 1 })
        .then((r: any) => r.value?.[0])
        .catch(() => null),
    ])

    const currency = companyInfo?.currencyCode || 'USD'
    const pnlCategoryMap = buildPnLCategoryMap(allAccounts)

    // Fetch GL entries with postingDate
    const filters: string[] = []
    if (startDate) filters.push(`postingDate ge ${startDate}`)
    if (endDate) filters.push(`postingDate le ${endDate}`)

    const glParams: any = { $select: 'accountNumber,debitAmount,creditAmount,postingDate' }
    if (filters.length > 0) glParams.$filter = filters.join(' and ')

    const entries = await client.listGeneralLedgerEntries(glParams)

    // Bucket GL entries by month and P&L category
    // Sum raw net values (debit - credit) per category, then Math.abs on the monthly total.
    // This ensures refunds/reversals cancel out correctly instead of being double-counted.
    const monthBuckets = new Map<string, { revenue: number; cogs: number; expenses: number }>()

    for (const entry of entries) {
      const category = pnlCategoryMap.get(entry.accountNumber)
      if (!category) continue

      const postingDate = entry.postingDate
      if (!postingDate) continue
      const month = postingDate.substring(0, 7) // YYYY-MM

      const bucket = monthBuckets.get(month) || { revenue: 0, cogs: 0, expenses: 0 }
      const net = (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)

      // Sign convention: Income is credit-normal (negate net to get positive revenue).
      // COGS/Expense are debit-normal (net is already positive for expenses).
      if (category === 'Income') {
        bucket.revenue += -net
      } else if (category === 'Cost of Goods Sold') {
        bucket.cogs += net
      } else if (category === 'Expense') {
        bucket.expenses += net
      }

      monthBuckets.set(month, bucket)
    }

    // Convert to sorted array
    const months = [...monthBuckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        revenue: Math.round(data.revenue * 100) / 100,
        cogs: Math.round(data.cogs * 100) / 100,
        expenses: Math.round(data.expenses * 100) / 100,
        net_income: Math.round((data.revenue - data.cogs - data.expenses) * 100) / 100,
      }))

    return NextResponse.json({
      data: {
        months,
        currency,
        companyName: credentials.company_name || null,
        glEntryCount: entries.length,
      },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Monthly P&L trend failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
