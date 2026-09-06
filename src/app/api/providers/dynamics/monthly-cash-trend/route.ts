import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

/**
 * GET /api/providers/dynamics/monthly-cash-trend
 *
 * Returns monthly cash flow breakdown for trend charts.
 * Uses GL entries filtered to cash/bank posting accounts, bucketed by month.
 *
 * Returns: { months[], currency, companyName, cashBalance }
 */
export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  const t0 = Date.now()

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

    const client = new BusinessCentralClient({
      organizationId,
      connectionId: resolvedConnectionId,
    })

    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined

    // 1. Fetch accounts to identify cash/bank posting accounts
    const allAccounts = await client.queryAll('accounts')
    const cashSubCategories = ['cash', 'bank', 'checking', 'savings']
    const cashNums = new Set<string>()

    // Build section boundaries to infer category for accounts with empty category
    const decode = (s: string) =>
      s.replace(/_x([0-9a-fA-F]{4})_/g, (_: string, hex: string) =>
        String.fromCharCode(parseInt(hex, 16))
      )
    const ALL_CATS = [
      'Assets',
      'Liabilities',
      'Equity',
      'Income',
      'Revenue',
      'Cost of Goods Sold',
      'Expense',
    ]
    const sortedForBoundaries = [...allAccounts].sort((a: any, b: any) =>
      (a.number || '').localeCompare(b.number || '')
    )
    const boundaries: Array<{ category: string; startNumber: string }> = []
    for (const acc of sortedForBoundaries) {
      const at = decode(acc.accountType || '').toLowerCase()
      if (at !== 'begin-total') continue
      const rawCat = decode(acc.category || '').trim()
      const name = (acc.displayName || acc.number || '').trim()
      if (ALL_CATS.includes(rawCat)) {
        boundaries.push({ category: rawCat, startNumber: acc.number })
      } else if (!rawCat || rawCat === ' ') {
        const lowerName = name.toLowerCase()
        for (const cat of ALL_CATS) {
          if (lowerName === cat.toLowerCase() || lowerName.startsWith(cat.toLowerCase())) {
            boundaries.push({ category: cat, startNumber: acc.number })
            break
          }
        }
      }
    }
    boundaries.sort((a, b) => a.startNumber.localeCompare(b.startNumber))
    const ranges = boundaries.map((s, i) => ({
      category: s.category,
      startNumber: s.startNumber,
      endBefore: i + 1 < boundaries.length ? boundaries[i + 1].startNumber : null,
    }))
    function inferCat(accNumber: string): string | null {
      for (let i = ranges.length - 1; i >= 0; i--) {
        const r = ranges[i]
        if (accNumber >= r.startNumber) {
          if (r.endBefore && accNumber >= r.endBefore) continue
          return r.category
        }
      }
      return null
    }

    // Build parent section name map to detect accounts under "Bank" sections
    const nameStack: string[] = []
    const parentSectionNames = new Map<string, string>()
    for (const acc of sortedForBoundaries) {
      const at = decode(acc.accountType || '').toLowerCase()
      const name = decode(acc.displayName || acc.number || '').trim()
      if (at === 'begin-total') {
        nameStack.push(name)
      } else if (at === 'end-total' || at === 'total') {
        nameStack.pop()
      } else if (at === 'posting' && nameStack.length > 0) {
        parentSectionNames.set(acc.number, nameStack[nameStack.length - 1])
      }
    }

    for (const acc of allAccounts) {
      if (!acc.number) continue
      const accType = (acc.accountType || '')
        .replace(/_x([0-9a-f]{4})_/gi, (_: string, hex: string) =>
          String.fromCharCode(parseInt(hex, 16))
        )
        .toLowerCase()
      if (accType !== 'posting') continue
      let cat = (acc.category || '').trim()
      if (!cat) cat = inferCat(acc.number) || ''
      if (cat !== 'Assets') continue
      const sub = (acc.subCategory || '').toLowerCase()
      const isCashBySub = cashSubCategories.some((s) => sub.includes(s))
      const parentName = parentSectionNames.get(acc.number) || ''
      const isCashByParent = /cash|bank|checking|savings/i.test(parentName)
      if (!isCashBySub && !isCashByParent) continue
      cashNums.add(acc.number)
    }

    if (cashNums.size === 0) {
      return NextResponse.json({
        data: {
          months: [],
          currency: 'USD',
          companyName: credentials.company_name || null,
          cashBalance: 0,
          glEntryCount: 0,
        },
        durationMs: Date.now() - t0,
      })
    }

    // 2. Fetch GL entries for the period + cumulative up to endDate in parallel
    const periodFilter =
      startDate && endDate
        ? `postingDate ge ${startDate} and postingDate le ${endDate}`
        : endDate
          ? `postingDate le ${endDate}`
          : startDate
            ? `postingDate ge ${startDate}`
            : undefined

    const [periodEntries, cumulativeEntries] = await Promise.all([
      client.listGeneralLedgerEntries({
        $select: 'accountNumber,debitAmount,creditAmount,postingDate',
        ...(periodFilter && { $filter: periodFilter }),
      }),
      // Cumulative for cash balance
      endDate
        ? client.listGeneralLedgerEntries({
            $select: 'accountNumber,debitAmount,creditAmount',
            $filter: `postingDate le ${endDate}`,
          })
        : Promise.resolve([]),
    ])

    // 3. Compute cumulative cash balance
    let cashBalance = 0
    for (const entry of cumulativeEntries) {
      if (!entry.accountNumber || !cashNums.has(entry.accountNumber)) continue
      cashBalance += (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)
    }

    // Build account name map for per-account breakdown
    const accountNameMap = new Map<string, string>()
    for (const acc of allAccounts) {
      if (acc.number && cashNums.has(acc.number)) {
        accountNameMap.set(acc.number, decode(acc.displayName || acc.number))
      }
    }

    // 4. Bucket period entries by month AND by account within each month
    interface AccountBucket {
      inflow: number
      outflow: number
    }
    const monthMap = new Map<
      string,
      { inflow: number; outflow: number; byAccount: Map<string, AccountBucket> }
    >()

    for (const entry of periodEntries) {
      if (!entry.accountNumber || !cashNums.has(entry.accountNumber)) continue
      const date = entry.postingDate || ''
      const month = date.substring(0, 7) // "YYYY-MM"
      if (!month) continue

      if (!monthMap.has(month)) {
        monthMap.set(month, { inflow: 0, outflow: 0, byAccount: new Map() })
      }
      const bucket = monthMap.get(month)!
      const debit = entry.debitAmount ?? 0
      const credit = entry.creditAmount ?? 0
      bucket.inflow += debit
      bucket.outflow += credit

      const accBucket = bucket.byAccount.get(entry.accountNumber) || { inflow: 0, outflow: 0 }
      accBucket.inflow += debit
      accBucket.outflow += credit
      bucket.byAccount.set(entry.accountNumber, accBucket)
    }

    // 5. Sort months and compute running balance
    const sortedMonths = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b))

    // To compute running balance, we need the starting balance (cumulative up to start of period)
    let startingBalance = cashBalance
    // Subtract period net change to get opening balance
    for (const [, data] of sortedMonths) {
      startingBalance -= data.inflow - data.outflow
    }

    let runningBalance = startingBalance
    const months = sortedMonths.map(([month, data]) => {
      const netChange = data.inflow - data.outflow
      runningBalance += netChange
      return {
        month,
        inflow: data.inflow,
        outflow: data.outflow,
        netChange,
        runningBalance,
        accounts: [...data.byAccount.entries()]
          .map(([accNo, ab]) => ({
            accountNumber: accNo,
            accountName: accountNameMap.get(accNo) || accNo,
            inflow: ab.inflow,
            outflow: ab.outflow,
            netChange: ab.inflow - ab.outflow,
          }))
          .sort((a, b) => Math.abs(b.netChange) - Math.abs(a.netChange)),
      }
    })

    // Currency from company info
    let currency = 'USD'
    try {
      const companyInfo = await client
        .query('companyInformation', { $top: 1 })
        .then((r) => r.value?.[0])
      if (companyInfo?.currencyCode) currency = companyInfo.currencyCode
    } catch {
      // ignore
    }

    logger.info('BC monthly cash trend fetched', {
      organizationId,
      months: months.length,
      glEntryCount: periodEntries.length,
      cashBalance,
    })

    return NextResponse.json({
      data: {
        months,
        currency,
        companyName: credentials.company_name || null,
        cashBalance,
        glEntryCount: periodEntries.length,
      },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    logger.error('Failed to fetch monthly cash trend', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to fetch monthly cash trend',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
