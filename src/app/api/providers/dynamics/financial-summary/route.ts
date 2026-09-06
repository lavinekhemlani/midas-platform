// src/app/api/providers/dynamics/financial-summary/route.ts
/**
 * GET /api/providers/dynamics/financial-summary
 *
 * Fetches financial snapshot data from BC API for OAuth connections.
 *
 * Uses the SAME data sources as the BC reports pages:
 *   - Revenue/COGS/Expenses/Net Income: generalLedgerEntries + accounts chart hierarchy
 *     (same as income-statement-test?mode=pnl)
 *   - Cash: GL entries aggregated by cash/bank accounts
 *     (same as enhanced-financial-data)
 *   - AR: agedAccountsReceivable report Total row (LCY)
 *   - AP: agedAccountsPayable report Total row (LCY)
 */
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

function decodeODataString(s: string): string {
  return s.replace(/_x([0-9a-f]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * Fetch GL entries for a date range and aggregate debit-credit by account number.
 * Same as getGLAmountsByAccount in income-statement-test route.
 */
async function getGLAmountsByAccount(
  client: BusinessCentralClient,
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  const filter = `postingDate ge ${startDate} and postingDate le ${endDate}`
  const entries = await client.listGeneralLedgerEntries({
    $filter: filter,
    $select: 'accountNumber,debitAmount,creditAmount',
  })

  const amounts = new Map<string, number>()
  for (const entry of entries) {
    const accNum = entry.accountNumber
    if (!accNum) continue
    amounts.set(
      accNum,
      (amounts.get(accNum) ?? 0) + (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)
    )
  }
  return amounts
}

/**
 * Fetch cumulative GL balances up to endDate (for balance sheet items like cash).
 * Same as getGLBalances in enhanced-financial-data route.
 */
async function getGLBalancesCumulative(
  client: BusinessCentralClient,
  endDate: string
): Promise<Map<string, number>> {
  const entries = await client.listGeneralLedgerEntries({
    $filter: `postingDate le ${endDate}`,
    $select: 'accountNumber,debitAmount,creditAmount',
  })

  const amounts = new Map<string, number>()
  for (const entry of entries) {
    const accNum = entry.accountNumber
    if (!accNum) continue
    amounts.set(
      accNum,
      (amounts.get(accNum) ?? 0) + (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)
    )
  }
  return amounts
}

/**
 * Compute P&L totals from accounts + GL amounts using the native BC chart hierarchy.
 * Same algorithm as buildNativeBCHierarchy in income-statement-test route,
 * but only returns the totals (no line items needed for dashboard card).
 */
function computePnLTotals(
  allAccounts: any[],
  glAmounts: Map<string, number>
): {
  totalRevenue: number
  totalCOGS: number
  grossProfit: number
  totalExpenses: number
  operatingExpenses: number
  operatingIncome: number
  netIncome: number
  interestExpense: number
  taxExpense: number
  depreciationAmortization: number
  otherNonOperating: number
  ebitda: number
} {
  const PL_CATEGORIES = ['Income', 'Expense', 'Cost of Goods Sold']

  // Sort ALL accounts by number — chart order
  const sorted = [...allAccounts].sort((a: any, b: any) =>
    (a.number || '').localeCompare(b.number || '')
  )

  // Track depth-0 End-Total lines and their accumulated sums
  let globalDepth = 0
  let inPLSection = false
  let plSectionStartDepth = 0
  let relativeDepth = 0
  let plSectionCategory = ''
  const categoryStack: string[] = []
  const sumStack: number[] = []

  // Collect depth-0 and depth-1 total lines: { category, amount, depth }
  const depth0Totals: Array<{ category: string; amount: number }> = []
  const depth1Totals: Array<{ category: string; amount: number }> = []

  for (const acc of sorted) {
    const accType = decodeODataString(acc.accountType || '').toLowerCase()
    const rawCat = decodeODataString(acc.category || '').trim()
    const nc = glAmounts.get(acc.number) ?? 0

    if (accType === 'begin-total') {
      if (!inPLSection && globalDepth === 0 && PL_CATEGORIES.includes(rawCat)) {
        inPLSection = true
        plSectionStartDepth = globalDepth
        plSectionCategory = rawCat
        relativeDepth = 0
        categoryStack[0] = rawCat
        sumStack[0] = 0
        relativeDepth++
      } else if (inPLSection) {
        categoryStack[relativeDepth] = rawCat || plSectionCategory
        sumStack[relativeDepth] = 0
        relativeDepth++
      }
      globalDepth++
    } else if (accType === 'end-total' || accType === 'total') {
      globalDepth = Math.max(0, globalDepth - 1)

      if (inPLSection) {
        relativeDepth = Math.max(0, relativeDepth - 1)
        const totalAmount = sumStack[relativeDepth] ?? 0
        if (relativeDepth > 0) {
          sumStack[relativeDepth - 1] = (sumStack[relativeDepth - 1] ?? 0) + totalAmount
        }

        // Capture depth-0 and depth-1 totals
        if (relativeDepth === 0) {
          depth0Totals.push({
            category: categoryStack[relativeDepth] || plSectionCategory,
            amount: totalAmount,
          })
        } else if (relativeDepth === 1) {
          depth1Totals.push({
            category: categoryStack[relativeDepth] || plSectionCategory,
            amount: totalAmount,
          })
        }

        if (relativeDepth === 0 && globalDepth <= plSectionStartDepth) {
          inPLSection = false
        }
      }
    } else if (inPLSection) {
      // Posting or heading account inside a P&L section
      if (accType !== 'heading' && relativeDepth > 0 && nc !== 0) {
        sumStack[relativeDepth - 1] = (sumStack[relativeDepth - 1] ?? 0) + nc
      }
    }
  }

  // Sum depth-0 totals using Math.abs — same as income-statement-test
  let totalRevenue = 0
  let totalCOGS = 0
  let totalExpenses = 0
  for (const t of depth0Totals) {
    if (t.category === 'Income') totalRevenue += Math.abs(t.amount)
    else if (t.category === 'Cost of Goods Sold') totalCOGS += Math.abs(t.amount)
    else if (t.category === 'Expense') totalExpenses += Math.abs(t.amount)
  }

  // If COGS wasn't found at depth-0, extract nested COGS from within Expense section
  if (totalCOGS === 0) {
    let nestedCOGS = 0
    for (const t of depth1Totals) {
      if (t.category === 'Cost of Goods Sold') {
        nestedCOGS += Math.abs(t.amount)
      }
    }
    if (nestedCOGS > 0) {
      totalCOGS = nestedCOGS
      totalExpenses -= nestedCOGS
    }
  }

  const grossProfit = totalRevenue - totalCOGS
  const netIncome = grossProfit - totalExpenses

  // Classify expense sub-components for operating income & EBITDA
  // Use ALL accounts with Expense category + GL activity (not hierarchy postings which can miss accounts at depth 0)
  const INTEREST_RE = /interest|finance charge|finance cost|bank charge/i
  const TAX_RE = /income tax|tax expense|federal tax|state tax|corporate tax/i
  const DA_RE = /depreciation|amortization|amortisation|depletion/i
  const ACCUMULATED_RE = /accumulated/i
  const NON_OPERATING_RE = /foreign exchange|forex|fx gain|fx loss|other income|other expense/i
  const NON_OPERATING_SUB_RE = /other income|other expense/i

  let interestExpense = 0
  let taxExpense = 0
  let depreciationAmortization = 0
  let otherNonOperating = 0
  for (const acc of sorted) {
    const cat = decodeODataString(acc.category || '').trim()
    if (cat !== 'Expense') continue
    const accType = decodeODataString(acc.accountType || '').toLowerCase()
    if (accType !== 'posting') continue
    const nc = glAmounts.get(acc.number) ?? 0
    if (nc === 0) continue
    const amt = Math.abs(nc)
    const name = acc.displayName || acc.number || ''
    const sub = decodeODataString(acc.subCategory || '').trim()
    const nameAndSub = `${name} ${sub}`
    if (!ACCUMULATED_RE.test(name) && DA_RE.test(nameAndSub)) {
      depreciationAmortization += amt
    } else if (INTEREST_RE.test(nameAndSub)) {
      interestExpense += amt
    } else if (TAX_RE.test(nameAndSub)) {
      taxExpense += amt
    } else if (NON_OPERATING_RE.test(name) || (sub && NON_OPERATING_SUB_RE.test(sub))) {
      otherNonOperating += amt
    }
  }

  const nonOperatingTotal = interestExpense + taxExpense + otherNonOperating
  const operatingExpenses = totalExpenses - nonOperatingTotal
  const operatingIncome = grossProfit - operatingExpenses
  const ebitda = operatingIncome + depreciationAmortization

  return {
    totalRevenue,
    totalCOGS,
    grossProfit,
    totalExpenses,
    operatingExpenses,
    operatingIncome,
    netIncome,
    interestExpense,
    taxExpense,
    depreciationAmortization,
    otherNonOperating,
    ebitda,
  }
}

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined

    let resolvedConnectionId = connectionId
    if (!resolvedConnectionId) {
      resolvedConnectionId = (await getActiveBCConnectionId(organizationId)) || undefined
    }

    if (!resolvedConnectionId) {
      return NextResponse.json({ error: 'No active BC OAuth connection' }, { status: 404 })
    }

    const credentials = await getBCConnectionCredentials(organizationId, resolvedConnectionId)
    if (!credentials?.connected || !credentials?.access_token) {
      return NextResponse.json({ error: 'BC connection not found or not active' }, { status: 404 })
    }

    const client = new BusinessCentralClient({
      organizationId,
      connectionId: resolvedConnectionId,
    })

    // Date range — accept query params, default to this year (YTD)
    const thisYear = new Date().getFullYear()
    const today = new Date().toISOString().split('T')[0]
    const startDate = url.searchParams.get('startDate') || `${thisYear}-01-01`
    const endDate = url.searchParams.get('endDate') || today

    // Pre-fetch token before parallel burst to avoid lock contention
    const warmUpStart = Date.now()
    await client.warmUp()
    const warmUpMs = Date.now() - warmUpStart

    // ── Fetch all data in parallel ──
    // Use $select on accounts to reduce payload (only need fields for hierarchy + cash classification)
    const fetchStart = Date.now()
    const [
      companyInfoResult,
      accountsResult,
      glPeriodResult,
      glCumulativeResult,
      openSalesResult,
      openPurchaseResult,
    ] = await Promise.allSettled([
      // 1. Company info for currency
      client
        .query('companyInformation', { $top: 1 })
        .then((r) => r.value?.[0])
        .catch((e) => {
          logger.warn('companyInformation query failed', { error: e.message })
          return null
        }),

      // 2. All accounts (chart of accounts — for hierarchy + cash identification)
      client
        .queryAll('accounts', { $select: 'number,displayName,accountType,category,subCategory' })
        .catch((e) => {
          logger.warn('accounts query failed', { error: e.message })
          return [] as any[]
        }),

      // 3. GL entries for the PERIOD (for P&L: revenue, COGS, expenses)
      getGLAmountsByAccount(client, startDate, endDate).catch((e) => {
        logger.warn('GL period entries query failed', { error: e.message })
        return new Map<string, number>()
      }),

      // 4. GL entries CUMULATIVE up to endDate (for balance sheet: cash)
      getGLBalancesCumulative(client, endDate).catch((e) => {
        logger.warn('GL cumulative entries query failed', { error: e.message })
        return new Map<string, number>()
      }),

      // 5. Aged accounts receivable (LCY totals from BC report)
      client.getAgedAccountsReceivable().catch((e) => {
        logger.warn('agedAccountsReceivable query failed', { error: e.message })
        return { total: null, records: [] }
      }),

      // 6. Aged accounts payable (LCY totals from BC report)
      client.getAgedAccountsPayable().catch((e) => {
        logger.warn('agedAccountsPayable query failed', { error: e.message })
        return { total: null, records: [] }
      }),
    ])
    const fetchMs = Date.now() - fetchStart

    // Extract results
    const companyInfo = companyInfoResult.status === 'fulfilled' ? companyInfoResult.value : null
    const allAccounts = accountsResult.status === 'fulfilled' ? (accountsResult.value as any[]) : []
    const glPeriodAmounts =
      glPeriodResult.status === 'fulfilled'
        ? (glPeriodResult.value as Map<string, number>)
        : new Map<string, number>()
    const glCumulativeAmounts =
      glCumulativeResult.status === 'fulfilled'
        ? (glCumulativeResult.value as Map<string, number>)
        : new Map<string, number>()
    const agedARData =
      openSalesResult.status === 'fulfilled'
        ? (openSalesResult.value as { total: any | null; records: any[] })
        : { total: null, records: [] }
    const agedAPData =
      openPurchaseResult.status === 'fulfilled'
        ? (openPurchaseResult.value as { total: any | null; records: any[] })
        : { total: null, records: [] }

    const currency = companyInfo?.currencyCode || 'USD'

    // ── P&L from GL entries + chart hierarchy (same as income-statement-test?mode=pnl) ──
    let revenue: number | null = null
    let totalCOGS: number | null = null
    let grossProfit: number | null = null
    let totalExpenses: number | null = null
    let netIncome: number | null = null

    let operatingIncome: number | null = null

    if (allAccounts.length > 0 && glPeriodAmounts.size > 0) {
      const pnl = computePnLTotals(allAccounts, glPeriodAmounts)
      revenue = pnl.totalRevenue
      totalCOGS = pnl.totalCOGS
      grossProfit = pnl.grossProfit
      totalExpenses = pnl.totalExpenses
      operatingIncome = pnl.operatingIncome
      netIncome = pnl.netIncome
    }

    // ── Cash Balance from cumulative GL entries ──
    const cashSubCategories = ['cash', 'bank', 'checking', 'savings']
    let cashBalance: number | null = null

    if (allAccounts.length > 0 && glCumulativeAmounts.size > 0) {
      let totalCash = 0
      let foundCash = false
      for (const acc of allAccounts) {
        if (!acc.number) continue
        const accType = decodeODataString(acc.accountType || '').toLowerCase()
        if (accType !== 'posting') continue

        const cat = (acc.category || '').trim()
        if (cat !== 'Assets') continue

        const sub = (acc.subCategory || '').toLowerCase()
        if (!cashSubCategories.some((s) => sub.includes(s))) continue

        const bal = glCumulativeAmounts.get(acc.number) ?? 0
        totalCash += bal
        foundCash = true
      }
      if (foundCash) cashBalance = totalCash
    }

    // ── AR from aged accounts receivable report Total row (LCY) ──
    const ar = agedARData.total ? (agedARData.total.balanceDue ?? null) : null

    // ── AP from aged accounts payable report Total row (LCY) ──
    // BC returns AP as negative (liabilities) — use Math.abs
    const ap = agedAPData.total ? Math.abs(agedAPData.total.balanceDue ?? 0) : null

    // ── Health Score ──
    let healthScore: number | null = null
    let healthRating: string | null = null
    let healthComponents: {
      liquidity: number
      profitability: number
      efficiency: number
      leverage: number
    } | null = null

    if (revenue != null || cashBalance != null || ar != null || ap != null) {
      const liquidityScore =
        cashBalance != null && ap != null && ap > 0
          ? Math.min(100, Math.round((cashBalance / ap) * 50))
          : 50
      const profitMargin =
        grossProfit != null && revenue != null && revenue > 0
          ? grossProfit / revenue
          : netIncome != null && revenue != null && revenue > 0
            ? netIncome / revenue
            : null
      const profitabilityScore =
        profitMargin != null ? Math.min(100, Math.max(0, Math.round(profitMargin * 333))) : 50
      const efficiencyScore =
        revenue != null && revenue > 0 && ar != null
          ? Math.min(100, Math.max(0, Math.round(((365 - (ar / revenue) * 365) / 365) * 100)))
          : 50
      const leverageScore = 50

      healthScore = Math.round(
        liquidityScore * 0.3 +
          profitabilityScore * 0.3 +
          efficiencyScore * 0.25 +
          leverageScore * 0.15
      )

      if (healthScore >= 75) healthRating = 'Excellent'
      else if (healthScore >= 55) healthRating = 'Good'
      else if (healthScore >= 35) healthRating = 'Fair'
      else healthRating = 'Needs Attention'

      healthComponents = {
        liquidity: liquidityScore,
        profitability: profitabilityScore,
        efficiency: efficiencyScore,
        leverage: leverageScore,
      }
    }

    const data = {
      revenue,
      revenueChange: null,
      totalCOGS,
      grossProfit,
      grossProfitChange: null,
      totalExpenses,
      operatingIncome,
      netIncome,
      netIncomeChange: null,
      cashBalance,
      ar,
      ap,
      healthScore,
      healthRating,
      healthComponents,
      currency,
      companyName: credentials.company_name || null,
      connectionId: resolvedConnectionId,
      period: { startDate, endDate },
    }

    logger.info('BC OAuth financial summary fetched', {
      organizationId,
      connectionId: resolvedConnectionId,
      period: `${startDate} → ${endDate}`,
      source: 'gl-entries+chart-hierarchy',
      timing: {
        warmUpMs,
        fetchMs,
        totalMs: Date.now() - warmUpStart,
      },
      counts: {
        accounts: allAccounts.length,
        glPeriodAccounts: glPeriodAmounts.size,
        glCumulativeAccounts: glCumulativeAmounts.size,
        agedARRecords: agedARData.records.length,
        agedAPRecords: agedAPData.records.length,
      },
      revenue,
      grossProfit,
      netIncome,
      cashBalance,
      ar,
      ap,
    })

    return NextResponse.json({ data })
  } catch (error) {
    logger.error('Failed to fetch BC financial summary', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to fetch financial summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
