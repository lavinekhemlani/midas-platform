import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'

/**
 * GET /api/providers/dynamics/cash-flow-by-activity
 *
 * Returns monthly cash flow broken down by activity type (operating/investing/financing).
 * Uses account classification from the chart of accounts to assign GL entries.
 *
 * Classification (mirrors cash-flow-indirect route):
 *   Operating: Income, Expense, COGS + current asset/liability changes (AR, inventory, AP)
 *   Investing: Non-current asset accounts (fixed assets, property, equipment)
 *   Financing: Non-current liabilities + equity
 *   Cash/bank accounts are excluded.
 */

function decode(s: string): string {
  return s.replace(/_x([0-9a-fA-F]{4})_/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  )
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

    // Step 1: Fetch accounts and classify
    const allAccounts = await client.queryAll('accounts')

    type Activity = 'operating' | 'investing' | 'financing' | 'cash' | 'skip'
    const accountActivity = new Map<string, Activity>()

    for (const acc of allAccounts) {
      if (!acc.number) continue
      const accType = decode(acc.accountType || '').toLowerCase()
      if (accType !== 'posting') continue

      const category = decode(acc.category || '').trim()
      const subCategory = decode(acc.subCategory || '').toLowerCase()
      const displayName = (acc.displayName || '').toLowerCase()
      let activity: Activity = 'skip'

      // Skip accumulated depreciation — it's a non-cash contra-asset,
      // not an investing cash flow. The indirect method handles it as an
      // add-back to operating activities.
      const isDepreciation =
        subCategory.includes('depreciation') || displayName.includes('depreciation')

      if (category === 'Income' || category === 'Expense' || category === 'Cost of Goods Sold') {
        activity = 'operating'
      } else if (category === 'Assets') {
        if (
          subCategory.includes('cash') ||
          subCategory.includes('bank') ||
          subCategory.includes('checking') ||
          subCategory.includes('savings')
        ) {
          activity = 'cash'
        } else if (isDepreciation) {
          activity = 'skip'
        } else if (
          subCategory.includes('receivable') ||
          subCategory.includes('inventory') ||
          subCategory.includes('current') ||
          subCategory.includes('prepaid')
        ) {
          activity = 'operating'
        } else {
          activity = 'investing'
        }
      } else if (category === 'Liabilities') {
        if (
          subCategory.includes('payable') ||
          subCategory.includes('accrued') ||
          subCategory.includes('current')
        ) {
          activity = 'operating'
        } else {
          activity = 'financing'
        }
      } else if (category === 'Equity') {
        activity = 'financing'
      }

      accountActivity.set(acc.number, activity)
    }

    // Step 2: Fetch GL entries for the period
    const filters: string[] = []
    if (startDate) filters.push(`postingDate ge ${startDate}`)
    if (endDate) filters.push(`postingDate le ${endDate}`)

    const entries = await client.listGeneralLedgerEntries({
      $select: 'accountNumber,debitAmount,creditAmount,postingDate',
      ...(filters.length > 0 && { $filter: filters.join(' and ') }),
    })

    // Step 3: Bucket by month and activity
    const monthBuckets = new Map<
      string,
      { operating: number; investing: number; financing: number }
    >()

    for (const entry of entries) {
      const activity = accountActivity.get(entry.accountNumber)
      if (!activity || activity === 'skip' || activity === 'cash') continue

      const postingDate = entry.postingDate
      if (!postingDate) continue
      const month = postingDate.substring(0, 7) // YYYY-MM

      if (!monthBuckets.has(month)) {
        monthBuckets.set(month, { operating: 0, investing: 0, financing: 0 })
      }
      const bucket = monthBuckets.get(month)!

      const debit = entry.debitAmount ?? 0
      const credit = entry.creditAmount ?? 0
      // Net = credit - debit for income-normal accounts (operating)
      // For simplicity, use signed net: credit - debit
      const net = credit - debit

      bucket[activity] += net
    }

    // Step 4: Convert to sorted array
    const months = [...monthBuckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month: `${month}-01`, // ISO date for consistency with warehouse format
        operating: Math.round(data.operating * 100) / 100,
        investing: Math.round(data.investing * 100) / 100,
        financing: Math.round(data.financing * 100) / 100,
      }))

    // Summary totals
    const summary = {
      operating: Math.round(months.reduce((s, m) => s + m.operating, 0) * 100) / 100,
      investing: Math.round(months.reduce((s, m) => s + m.investing, 0) * 100) / 100,
      financing: Math.round(months.reduce((s, m) => s + m.financing, 0) * 100) / 100,
    }

    return NextResponse.json({
      data: { months, summary },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Cash flow by activity failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
