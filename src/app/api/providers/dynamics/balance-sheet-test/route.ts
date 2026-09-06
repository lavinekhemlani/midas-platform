import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'

/**
 * GET /api/providers/dynamics/balance-sheet-test
 *
 * Two modes:
 *   mode=bs      — Returns full balance sheet hierarchy for rendering (like income-statement-test?mode=pnl)
 *   mode=diagnostic (default) — Returns diagnostic tests with debug info
 *
 * Uses chart-structure walk (Begin-Total/End-Total) to identify BS accounts,
 * and GL entries for cumulative balances. Includes extensive debug output to
 * diagnose issues like Equity = 0.
 */

interface BSLine {
  lineNumber: number
  display: string
  balance: number
  lineType: 'header' | 'detail' | 'total' | 'spacer' | 'computed'
  indentation: number
  _accountNumber?: string
  _accountType?: string
  _category?: string
  _subCategory?: string
  _computed?: boolean
}

function decodeODataString(s: string): string {
  return s.replace(/_x([0-9a-f]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * Build BS hierarchy using RANGE-BASED section detection.
 *
 * Problem: BC's chart of accounts can have unbalanced Begin-Total/End-Total pairs
 * (e.g., "Bank Loan" Begin-Total with no matching End-Total), causing depth-based
 * section tracking to fail — Liabilities/Equity sections never "close".
 *
 * Solution: Two-phase approach:
 *   Phase 1: Find BS section RANGES from Begin-Total accounts with BS categories.
 *            Each account's section is determined by which range its number falls into.
 *   Phase 2: Compute totals by summing GL amounts of posting accounts per range.
 *   Phase 3: Walk chart for display, using Begin-Total/End-Total for indentation
 *            within each section, but section transitions reset depth tracking.
 */
function buildNativeBSHierarchy(
  allAccounts: any[],
  glAmounts?: Map<string, number>
): {
  lines: BSLine[]
  totals: { totalAssets: number; totalLiabilities: number; totalEquity: number; netIncome: number }
  stats: { totalAccounts: number; bsAccounts: number; linesBuilt: number }
  debug: {
    chartWalkTrace: Array<{
      number: string
      name: string
      type: string
      category: string
      depth: number
      action: string
    }>
    sectionSummary: Record<string, { accountCount: number; totalBalance: number }>
    unmappedAccounts: Array<{
      number: string
      name: string
      category: string
      type: string
      balance: number
    }>
    sectionRanges: Array<{ category: string; startNumber: string; endBefore: string | null }>
  }
} {
  const BS_CATEGORIES = ['Assets', 'Liabilities', 'Equity']
  const PNL_CATEGORIES = ['Income', 'Revenue', 'Cost of Goods Sold', 'Expense']

  const sorted = [...allAccounts].sort((a: any, b: any) =>
    (a.number || '').localeCompare(b.number || '')
  )

  // ═══ Phase 1: Identify BS section boundaries from Begin-Total accounts ═══
  const sectionBoundaries: Array<{ category: string; startNumber: string }> = []
  let pnlStartNumber: string | null = null

  for (const acc of sorted) {
    const accType = decodeODataString(acc.accountType || '').toLowerCase()
    if (accType !== 'begin-total') continue

    const rawCat = decodeODataString(acc.category || '').trim()
    const displayName = (acc.displayName || acc.number || '').trim()

    if (BS_CATEGORIES.includes(rawCat)) {
      sectionBoundaries.push({ category: rawCat, startNumber: acc.number })
    } else if (!rawCat || rawCat === ' ') {
      // Fallback: infer section from displayName when category field is blank
      const lowerName = displayName.toLowerCase()
      for (const cat of BS_CATEGORIES) {
        if (lowerName === cat.toLowerCase() || lowerName.startsWith(cat.toLowerCase())) {
          sectionBoundaries.push({ category: cat, startNumber: acc.number })
          break
        }
      }
    }

    if (!pnlStartNumber && PNL_CATEGORIES.includes(rawCat)) {
      pnlStartNumber = acc.number
    }
  }

  // Build ranges: each section runs from its startNumber to the next section's startNumber (or P&L start)
  sectionBoundaries.sort((a, b) => a.startNumber.localeCompare(b.startNumber))
  const sectionRanges = sectionBoundaries.map((s, i) => ({
    category: s.category,
    startNumber: s.startNumber,
    endBefore:
      i + 1 < sectionBoundaries.length ? sectionBoundaries[i + 1].startNumber : pnlStartNumber,
  }))

  // Map account number → BS section (or null if outside BS)
  function getSection(accNumber: string): string | null {
    for (let i = sectionRanges.length - 1; i >= 0; i--) {
      const range = sectionRanges[i]
      if (accNumber >= range.startNumber) {
        if (range.endBefore && accNumber >= range.endBefore) return null
        return range.category
      }
    }
    return null
  }

  // ═══ Phase 2: Compute authoritative totals from posting accounts' GL amounts ═══
  const sectionPostingSums: Record<string, number> = { Assets: 0, Liabilities: 0, Equity: 0 }
  const sectionPostingCounts: Record<string, number> = { Assets: 0, Liabilities: 0, Equity: 0 }

  for (const acc of sorted) {
    const accType = decodeODataString(acc.accountType || '').toLowerCase()
    if (accType !== 'posting') continue
    const section = getSection(acc.number)
    if (!section) continue
    const rawBal = glAmounts
      ? (glAmounts.get(acc.number) ?? 0)
      : (acc.balance ?? acc.netChange ?? 0)
    sectionPostingSums[section] += rawBal
    sectionPostingCounts[section]++
  }

  // Assets: debit normal (positive raw = asset value, display as-is)
  // Liabilities/Equity: credit normal (negative raw = liability/equity value, negate for display)
  const totalAssets = sectionPostingSums.Assets
  const totalLiabilities = -sectionPostingSums.Liabilities
  let totalEquity = -sectionPostingSums.Equity

  // ═══ Phase 3: Build display lines with chart structure ═══
  const lines: BSLine[] = []
  let lineNumber = 0
  let bsAccountCount = 0

  let currentSection: string | null = null
  let relDepth = 0
  const sumStack: number[] = []

  // Debug
  const chartWalkTrace: Array<{
    number: string
    name: string
    type: string
    category: string
    depth: number
    action: string
  }> = []
  const sectionSummary: Record<string, { accountCount: number; totalBalance: number }> = {}

  for (const acc of sorted) {
    const accType = decodeODataString(acc.accountType || '').toLowerCase()
    const name = acc.displayName || acc.number
    const rawCat = decodeODataString(acc.category || '').trim()
    const section = getSection(acc.number)

    // Skip accounts outside BS sections
    if (!section) {
      if (currentSection) {
        // Section didn't close via End-Total — emit computed total at indent 0
        if (relDepth > 0) {
          const computedTotal =
            currentSection === 'Assets'
              ? sectionPostingSums[currentSection]
              : -sectionPostingSums[currentSection]
          lines.push({
            lineNumber: lineNumber++,
            display: `Total ${currentSection}`,
            balance: computedTotal,
            lineType: 'total',
            indentation: 0,
            _category: currentSection,
            _accountType: 'computed',
          })
          bsAccountCount++
        }
        chartWalkTrace.push({
          number: acc.number,
          name,
          type: accType,
          category: rawCat,
          depth: relDepth,
          action: `EXIT BS (leaving ${currentSection}, entering non-BS territory)`,
        })
        sectionSummary[currentSection] = {
          accountCount: sectionPostingCounts[currentSection],
          totalBalance:
            currentSection === 'Assets'
              ? sectionPostingSums[currentSection]
              : -sectionPostingSums[currentSection],
        }
        currentSection = null
      }
      continue
    }

    // Section transition: reset depth tracking when moving between BS sections
    if (section !== currentSection) {
      if (currentSection) {
        // Previous section didn't close via End-Total — emit computed total at indent 0
        if (relDepth > 0) {
          const computedTotal =
            currentSection === 'Assets'
              ? sectionPostingSums[currentSection]
              : -sectionPostingSums[currentSection]
          lines.push({
            lineNumber: lineNumber++,
            display: `Total ${currentSection}`,
            balance: computedTotal,
            lineType: 'total',
            indentation: 0,
            _category: currentSection,
            _accountType: 'computed',
          })
          bsAccountCount++
        }
        sectionSummary[currentSection] = {
          accountCount: sectionPostingCounts[currentSection],
          totalBalance:
            currentSection === 'Assets'
              ? sectionPostingSums[currentSection]
              : -sectionPostingSums[currentSection],
        }
        chartWalkTrace.push({
          number: acc.number,
          name,
          type: accType,
          category: rawCat,
          depth: relDepth,
          action: `TRANSITION: force-close ${currentSection} (relDepth was ${relDepth}), starting ${section}`,
        })
      }
      currentSection = section
      relDepth = 0
      sumStack.length = 0
      sumStack[0] = 0
    }

    // Handle by account type
    if (accType === 'begin-total') {
      const isSectionHeader = BS_CATEGORIES.includes(rawCat) && rawCat === section && relDepth === 0

      if (isSectionHeader) {
        chartWalkTrace.push({
          number: acc.number,
          name,
          type: accType,
          category: rawCat,
          depth: 0,
          action: `ENTER BS section: ${section}`,
        })
        lines.push({
          lineNumber: lineNumber++,
          display: name,
          balance: 0,
          lineType: 'header',
          indentation: 0,
          _accountNumber: acc.number,
          _accountType: accType,
          _category: section,
        })
        bsAccountCount++
        sumStack[0] = 0
        relDepth = 1
      } else {
        chartWalkTrace.push({
          number: acc.number,
          name,
          type: accType,
          category: rawCat,
          depth: relDepth,
          action: `nested begin-total (relDepth ${relDepth}→${relDepth + 1})`,
        })
        sumStack[relDepth] = 0
        lines.push({
          lineNumber: lineNumber++,
          display: name,
          balance: 0,
          lineType: 'header',
          indentation: relDepth,
          _accountNumber: acc.number,
          _accountType: accType,
          _category: section,
          _subCategory: acc.subCategory || '',
        })
        bsAccountCount++
        relDepth++
      }
    } else if (accType === 'end-total') {
      relDepth = Math.max(0, relDepth - 1)
      const totalAmount = glAmounts ? (sumStack[relDepth] ?? 0) : (acc.balance ?? 0)

      // Propagate sum up to parent level
      if (relDepth > 0) {
        sumStack[relDepth - 1] = (sumStack[relDepth - 1] ?? 0) + totalAmount
      }

      const displayBalance = section === 'Assets' ? totalAmount : -totalAmount

      chartWalkTrace.push({
        number: acc.number,
        name,
        type: accType,
        category: rawCat,
        depth: relDepth,
        action:
          relDepth === 0
            ? `CLOSE section via end-total: ${section} (total=${displayBalance})`
            : `close sub-total (relDepth ${relDepth})`,
      })

      lines.push({
        lineNumber: lineNumber++,
        display: name,
        balance: displayBalance,
        lineType: 'total',
        indentation: relDepth,
        _accountNumber: acc.number,
        _accountType: accType,
        _category: section,
      })
      bsAccountCount++
    } else if (accType === 'total') {
      // Standalone total — display but do NOT change depth.
      // Show the account's own balance (may be 0 for FlowField) since standalone totals
      // don't correspond to our sumStack levels (e.g., "Total L&E" spans two sections).
      const rawBal = acc.balance ?? 0
      const displayBalance = section === 'Assets' ? rawBal : -rawBal

      chartWalkTrace.push({
        number: acc.number,
        name,
        type: accType,
        category: rawCat,
        depth: relDepth,
        action: `standalone total (no depth change)`,
      })

      lines.push({
        lineNumber: lineNumber++,
        display: name,
        balance: displayBalance,
        lineType: 'total',
        indentation: relDepth,
        _accountNumber: acc.number,
        _accountType: accType,
        _category: section,
      })
      bsAccountCount++
    } else if (accType === 'heading') {
      lines.push({
        lineNumber: lineNumber++,
        display: name,
        balance: 0,
        lineType: 'header',
        indentation: relDepth,
        _accountNumber: acc.number,
        _accountType: accType,
        _category: section,
        _subCategory: acc.subCategory || '',
      })
      bsAccountCount++
    } else {
      // Posting account — accumulate into parent sum for sub-total display
      const rawBal = glAmounts
        ? (glAmounts.get(acc.number) ?? 0)
        : (acc.balance ?? acc.netChange ?? 0)
      const displayBalance = section === 'Assets' ? rawBal : -rawBal

      if (relDepth > 0) {
        sumStack[relDepth - 1] = (sumStack[relDepth - 1] ?? 0) + rawBal
      }

      lines.push({
        lineNumber: lineNumber++,
        display: name,
        balance: displayBalance,
        lineType: 'detail',
        indentation: relDepth,
        _accountNumber: acc.number,
        _accountType: accType,
        _category: section,
        _subCategory: acc.subCategory || '',
      })
      bsAccountCount++
    }
  }

  // Close any remaining open section
  if (currentSection) {
    if (relDepth > 0) {
      const computedTotal =
        currentSection === 'Assets'
          ? sectionPostingSums[currentSection]
          : -sectionPostingSums[currentSection]
      lines.push({
        lineNumber: lineNumber++,
        display: `Total ${currentSection}`,
        balance: computedTotal,
        lineType: 'total',
        indentation: 0,
        _category: currentSection,
        _accountType: 'computed',
      })
      bsAccountCount++
    }
    sectionSummary[currentSection] = {
      accountCount: sectionPostingCounts[currentSection],
      totalBalance:
        currentSection === 'Assets'
          ? sectionPostingSums[currentSection]
          : -sectionPostingSums[currentSection],
    }
  }

  // ═══ Phase 3b: Add Net Income to Equity section ═══
  // BS equation: Assets = Liabilities + Equity + Retained Earnings (unappropriated P&L)
  // If prior period P&L hasn't been closed to Retained Earnings, BS won't balance without it.
  // Compute accumulated net income from all non-BS posting accounts (P&L accounts).
  let pnlPostingSum = 0
  let pnlPostingCount = 0
  for (const acc of sorted) {
    const accType = decodeODataString(acc.accountType || '').toLowerCase()
    if (accType !== 'posting') continue
    const section = getSection(acc.number)
    if (section) continue // BS account — skip
    const rawBal = glAmounts
      ? (glAmounts.get(acc.number) ?? 0)
      : (acc.balance ?? acc.netChange ?? 0)
    pnlPostingSum += rawBal
    pnlPostingCount++
  }
  // Revenue is credit normal (negative raw), Expenses are debit normal (positive raw)
  // Net Income = -(sum of P&L raw amounts): positive = profit, negative = loss
  const netIncome = pnlPostingCount > 0 ? -pnlPostingSum : 0

  // Remove any standalone "Total Liabilities and Equity" (or similar cross-section totals)
  // from BC's chart. These are accountType 'total' lines that span multiple sections and
  // don't belong inside any single collapsible section. Our computed summary line replaces them.
  for (let i = lines.length - 1; i >= 0; i--) {
    if (
      lines[i].lineType === 'total' &&
      lines[i]._accountType === 'total' &&
      /total\s+(liabilities\s+(and|&)\s+equity|l\s*&\s*e)/i.test(lines[i].display)
    ) {
      lines.splice(i, 1)
    }
  }

  if (netIncome !== 0) {
    // Find the Equity end-total line at indent 0 (prefer end-total/computed over standalone total)
    let equityTotalIdx = -1
    for (let i = lines.length - 1; i >= 0; i--) {
      if (
        lines[i]._category === 'Equity' &&
        lines[i].lineType === 'total' &&
        lines[i].indentation === 0 &&
        (lines[i]._accountType === 'end-total' || lines[i]._accountType === 'computed')
      ) {
        equityTotalIdx = i
        break
      }
    }
    // Fallback: any Equity total at indent 0
    if (equityTotalIdx < 0) {
      for (let i = lines.length - 1; i >= 0; i--) {
        if (
          lines[i]._category === 'Equity' &&
          lines[i].lineType === 'total' &&
          lines[i].indentation === 0
        ) {
          equityTotalIdx = i
          break
        }
      }
    }

    if (equityTotalIdx >= 0) {
      // Insert Net Income detail line before Total Equity
      lines.splice(equityTotalIdx, 0, {
        lineNumber: lineNumber++,
        display: 'Net Income (Current + Prior Periods)',
        balance: netIncome,
        lineType: 'detail',
        indentation: 1,
        _category: 'Equity',
        _accountType: 'computed-net-income',
        _computed: true,
      })
      bsAccountCount++
      // Update Total Equity line (now shifted to equityTotalIdx + 1) to include net income
      lines[equityTotalIdx + 1].balance = totalEquity + netIncome
    } else {
      // No Equity total found — add Net Income as standalone Equity section
      lines.push({
        lineNumber: lineNumber++,
        display: 'Equity',
        balance: 0,
        lineType: 'header',
        indentation: 0,
        _category: 'Equity',
      })
      lines.push({
        lineNumber: lineNumber++,
        display: 'Net Income (Current + Prior Periods)',
        balance: netIncome,
        lineType: 'detail',
        indentation: 1,
        _category: 'Equity',
        _computed: true,
      })
      lines.push({
        lineNumber: lineNumber++,
        display: 'Total Equity',
        balance: netIncome,
        lineType: 'total',
        indentation: 0,
        _category: 'Equity',
        _accountType: 'computed',
      })
      bsAccountCount += 3
    }

    totalEquity += netIncome
  }

  // ═══ Computed summary lines ═══
  lines.push({
    lineNumber: lineNumber++,
    display: '',
    balance: 0,
    lineType: 'spacer',
    indentation: 0,
  })
  lines.push({
    lineNumber: lineNumber++,
    display: 'Total Liabilities + Equity',
    balance: totalLiabilities + totalEquity,
    lineType: 'computed',
    indentation: 0,
    _computed: true,
  })
  lines.push({
    lineNumber: lineNumber++,
    display: 'Balance Check (A - L - E)',
    balance: totalAssets - totalLiabilities - totalEquity,
    lineType: 'computed',
    indentation: 0,
    _computed: true,
  })

  // Find BS-category posting accounts not captured by range-based detection (debug)
  const mappedNumbers = new Set(lines.filter((l) => l._accountNumber).map((l) => l._accountNumber!))
  const unmappedAccounts = sorted
    .filter((acc: any) => {
      const cat = decodeODataString(acc.category || '').trim()
      const aType = decodeODataString(acc.accountType || '').toLowerCase()
      return BS_CATEGORIES.includes(cat) && aType === 'posting' && !mappedNumbers.has(acc.number)
    })
    .map((acc: any) => ({
      number: acc.number,
      name: acc.displayName || acc.number,
      category: decodeODataString(acc.category || '').trim(),
      type: decodeODataString(acc.accountType || ''),
      balance: glAmounts ? (glAmounts.get(acc.number) ?? 0) : (acc.balance ?? 0),
    }))

  return {
    lines,
    totals: { totalAssets, totalLiabilities, totalEquity, netIncome },
    stats: {
      totalAccounts: allAccounts.length,
      bsAccounts: bsAccountCount,
      linesBuilt: lines.length,
    },
    debug: { chartWalkTrace, sectionSummary, unmappedAccounts, sectionRanges },
  }
}

/**
 * Fetch GL entries and aggregate debit-credit by account.
 * - snapshot (cumulative):   { endDate }        → postingDate le endDate
 * - period:                  { startDate, endDate } → postingDate ge start and le end
 * - all-time:                {}                 → no filter
 */
async function getGLBalances(
  client: BusinessCentralClient,
  opts: { startDate?: string; endDate?: string } = {}
): Promise<{ amounts: Map<string, number>; entryCount: number; filter: string }> {
  const filters: string[] = []
  if (opts.startDate) filters.push(`postingDate ge ${opts.startDate}`)
  if (opts.endDate) filters.push(`postingDate le ${opts.endDate}`)

  const params: any = { $select: 'accountNumber,debitAmount,creditAmount' }
  const filterStr = filters.join(' and ')
  if (filterStr) params.$filter = filterStr

  const entries = await client.listGeneralLedgerEntries(params)
  const amounts = new Map<string, number>()
  for (const entry of entries) {
    const accNum = entry.accountNumber
    if (!accNum) continue
    amounts.set(
      accNum,
      (amounts.get(accNum) ?? 0) + (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)
    )
  }
  return { amounts, entryCount: entries.length, filter: filterStr || '(none)' }
}

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const mode = url.searchParams.get('mode') || 'diagnostic'
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

    // ── BS mode: return hierarchy for rendering ──
    if (mode === 'bs') {
      const t0 = Date.now()

      const [allAccounts, companyInfo] = await Promise.all([
        client.queryAll('accounts'),
        client
          .query('companyInformation', { $top: 1 })
          .then((r: any) => r.value?.[0])
          .catch(() => null),
      ])
      const currency = companyInfo?.currencyCode || 'USD'

      // Always fetch GL entries (cumulative snapshot up to endDate, or all-time)
      const gl = await getGLBalances(client, { endDate })
      const glAmounts = gl.amounts
      const glEntryCount = gl.entryCount

      const result = buildNativeBSHierarchy(allAccounts, glAmounts)

      // Collect debug info: all categories and account types
      const categoryCounts: Record<string, number> = {}
      const accountTypeCounts: Record<string, number> = {}
      for (const acc of allAccounts) {
        const cat = decodeODataString(acc.category || '') || '(empty)'
        const t = decodeODataString(acc.accountType || '') || '(empty)'
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
        accountTypeCounts[t] = (accountTypeCounts[t] || 0) + 1
      }

      // Find depth-0 Begin-Totals for debugging
      const depth0BeginTotals = allAccounts
        .filter((acc: any) => {
          const t = decodeODataString(acc.accountType || '').toLowerCase()
          return t === 'begin-total'
        })
        .map((acc: any) => ({
          number: acc.number,
          name: acc.displayName || acc.number,
          category: decodeODataString(acc.category || ''),
          subCategory: acc.subCategory || '',
        }))

      return NextResponse.json({
        data: {
          lines: result.lines,
          totals: result.totals,
          companyName: credentials.company_name || null,
          currency,
          asOfDate: endDate || null,
          source: endDate ? `gl-entries (le ${endDate})` : 'gl-entries (all-time)',
          glEntryCount,
        },
        _debug: {
          categoryCounts,
          accountTypeCounts,
          bsAccountsIncluded: result.stats.bsAccounts,
          totalAccounts: allAccounts.length,
          chartWalkTrace: result.debug.chartWalkTrace,
          sectionSummary: result.debug.sectionSummary,
          unmappedAccounts: result.debug.unmappedAccounts,
          sectionRanges: result.debug.sectionRanges,
          depth0BeginTotals,
        },
        durationMs: Date.now() - t0,
      })
    }

    // ── Diagnostic mode ──
    interface TestResult {
      id: string
      label: string
      detail: string
      success: boolean
      data?: any
      error?: string
      durationMs: number
    }

    const results: TestResult[] = []

    // ── Test 1: All-time (accounts balance, no GL filter) ──
    {
      const t0 = Date.now()
      try {
        const allAccounts = await client.queryAll('accounts')
        const result = buildNativeBSHierarchy(allAccounts)

        results.push({
          id: 'all-time-accounts',
          label: 'All-time (accounts.balance)',
          detail: `${result.stats.bsAccounts} BS accounts → ${result.stats.linesBuilt} lines. A: ${result.totals.totalAssets.toLocaleString()}, L: ${result.totals.totalLiabilities.toLocaleString()}, E: ${result.totals.totalEquity.toLocaleString()} (NI: ${result.totals.netIncome.toLocaleString()})`,
          success: true,
          data: {
            totals: result.totals,
            stats: result.stats,
            sectionRanges: result.debug.sectionRanges,
            sectionSummary: result.debug.sectionSummary,
            chartWalkTrace: result.debug.chartWalkTrace,
            unmappedAccounts: result.debug.unmappedAccounts,
            sampleLines: result.lines.slice(0, 30),
          },
          durationMs: Date.now() - t0,
        })
      } catch (err: any) {
        results.push({
          id: 'all-time-accounts',
          label: 'All-time (accounts.balance)',
          detail: 'queryAll("accounts") → native BS hierarchy',
          success: false,
          error: err.message || String(err),
          durationMs: Date.now() - t0,
        })
      }
    }

    // ── Test 2: GL Snapshot — cumulative as of endDate (correct BS approach) ──
    {
      const t0 = Date.now()
      try {
        const allAccounts = await client.queryAll('accounts')
        const gl = await getGLBalances(client, { endDate })
        const result = buildNativeBSHierarchy(allAccounts, gl.amounts)

        const balanceCheck =
          result.totals.totalAssets - result.totals.totalLiabilities - result.totals.totalEquity

        results.push({
          id: 'gl-snapshot',
          label: `GL Snapshot${endDate ? ` (as of ${endDate})` : ' (all-time)'}`,
          detail: `postingDate le ${endDate || '∞'} → ${gl.entryCount} entries, ${gl.amounts.size} accounts. A: ${result.totals.totalAssets.toLocaleString()}, L: ${result.totals.totalLiabilities.toLocaleString()}, E: ${result.totals.totalEquity.toLocaleString()} (NI: ${result.totals.netIncome.toLocaleString()}) | A-L-E = ${Math.round(balanceCheck)}`,
          success: true,
          data: {
            explanation:
              'Cumulative GL entries from beginning of time up to endDate. This is the correct approach for a balance sheet — it is a point-in-time snapshot.',
            filter: gl.filter,
            totals: result.totals,
            balanceCheck: {
              diff: Math.round(balanceCheck * 100) / 100,
              balanced: Math.abs(balanceCheck) < 1,
            },
            stats: result.stats,
            glEntryCount: gl.entryCount,
            glAccountsWithActivity: gl.amounts.size,
            sectionRanges: result.debug.sectionRanges,
            sectionSummary: result.debug.sectionSummary,
          },
          durationMs: Date.now() - t0,
        })
      } catch (err: any) {
        results.push({
          id: 'gl-snapshot',
          label: `GL Snapshot${endDate ? ` (as of ${endDate})` : ' (all-time)'}`,
          detail: 'GL entries aggregated for balance sheet',
          success: false,
          error: err.message || String(err),
          durationMs: Date.now() - t0,
        })
      }
    }

    // ── Test 3: GL Period Only — entries within startDate..endDate ──
    if (startDate && endDate) {
      const t0 = Date.now()
      try {
        const allAccounts = await client.queryAll('accounts')
        const gl = await getGLBalances(client, { startDate, endDate })
        const result = buildNativeBSHierarchy(allAccounts, gl.amounts)

        const balanceCheck =
          result.totals.totalAssets - result.totals.totalLiabilities - result.totals.totalEquity

        results.push({
          id: 'gl-period',
          label: `GL Period Only (${startDate} to ${endDate})`,
          detail: `postingDate ge ${startDate} and le ${endDate} → ${gl.entryCount} entries, ${gl.amounts.size} accounts. A: ${result.totals.totalAssets.toLocaleString()}, L: ${result.totals.totalLiabilities.toLocaleString()}, E: ${result.totals.totalEquity.toLocaleString()} | A-L-E = ${Math.round(balanceCheck)}`,
          success: true,
          data: {
            explanation:
              'Only GL entries WITHIN the date range. This is NOT a correct BS (which should be cumulative). This shows net changes during the period — useful for reconciling with BC reports that filter by period.',
            filter: gl.filter,
            totals: result.totals,
            balanceCheck: {
              diff: Math.round(balanceCheck * 100) / 100,
              balanced: Math.abs(balanceCheck) < 1,
            },
            stats: result.stats,
            glEntryCount: gl.entryCount,
            glAccountsWithActivity: gl.amounts.size,
            sectionSummary: result.debug.sectionSummary,
          },
          durationMs: Date.now() - t0,
        })
      } catch (err: any) {
        results.push({
          id: 'gl-period',
          label: `GL Period Only (${startDate} to ${endDate})`,
          detail: 'GL entries within period only',
          success: false,
          error: err.message || String(err),
          durationMs: Date.now() - t0,
        })
      }
    }

    // ── Test 4: trialBalance entity with dateFilter ──
    {
      const t0 = Date.now()
      try {
        // Build BC dateFilter syntax: dateFilter eq 'start..end'
        let tbFilter: string | undefined
        if (startDate && endDate) {
          tbFilter = `dateFilter eq '${startDate}..${endDate}'`
        } else if (endDate) {
          tbFilter = `dateFilter eq '..${endDate}'`
        }

        const trialBalanceData = await client.getTrialBalance(
          tbFilter ? { $filter: tbFilter } : undefined
        )
        const allAccounts = await client.queryAll('accounts')

        // Build section map from chart structure
        const sectionBounds: Array<{ category: string; startNumber: string }> = []
        const sorted = [...allAccounts].sort((a: any, b: any) =>
          (a.number || '').localeCompare(b.number || '')
        )
        for (const acc of sorted) {
          const at = decodeODataString(acc.accountType || '').toLowerCase()
          const cat = decodeODataString(acc.category || '').trim()
          if (at === 'begin-total' && ['Assets', 'Liabilities', 'Equity'].includes(cat)) {
            sectionBounds.push({ category: cat, startNumber: acc.number })
          }
        }
        sectionBounds.sort((a, b) => a.startNumber.localeCompare(b.startNumber))

        function tbSection(accNum: string): string | null {
          for (let i = sectionBounds.length - 1; i >= 0; i--) {
            if (accNum >= sectionBounds[i].startNumber) return sectionBounds[i].category
          }
          return null
        }

        // Aggregate trialBalance by section using balanceAtDate (cumulative) and total (period)
        const cumulative: Record<string, number> = { Assets: 0, Liabilities: 0, Equity: 0 }
        const period: Record<string, number> = { Assets: 0, Liabilities: 0, Equity: 0 }
        let tbAccountCount = 0

        for (const tb of trialBalanceData) {
          const section = tbSection(tb.number)
          if (!section) continue
          tbAccountCount++

          const balAtDate = (tb.balanceAtDateDebit ?? 0) - (tb.balanceAtDateCredit ?? 0)
          cumulative[section] += balAtDate

          const periodNet = (tb.totalDebit ?? 0) - (tb.totalCredit ?? 0)
          period[section] += periodNet
        }

        // Negate L/E for display
        const cumulativeTotals = {
          totalAssets: cumulative.Assets,
          totalLiabilities: -cumulative.Liabilities,
          totalEquity: -cumulative.Equity,
        }
        const periodTotals = {
          totalAssets: period.Assets,
          totalLiabilities: -period.Liabilities,
          totalEquity: -period.Equity,
        }

        const cCheck =
          cumulativeTotals.totalAssets -
          cumulativeTotals.totalLiabilities -
          cumulativeTotals.totalEquity
        const pCheck =
          periodTotals.totalAssets - periodTotals.totalLiabilities - periodTotals.totalEquity

        results.push({
          id: 'trial-balance',
          label: `trialBalance Entity${tbFilter ? ` (${tbFilter})` : ' (no filter)'}`,
          detail: `${trialBalanceData.length} rows, ${tbAccountCount} in BS sections. Cumulative A: ${cumulativeTotals.totalAssets.toLocaleString()} L: ${cumulativeTotals.totalLiabilities.toLocaleString()} E: ${cumulativeTotals.totalEquity.toLocaleString()} | Period A: ${periodTotals.totalAssets.toLocaleString()} L: ${periodTotals.totalLiabilities.toLocaleString()} E: ${periodTotals.totalEquity.toLocaleString()}`,
          success: true,
          data: {
            explanation:
              'BC trialBalance entity provides both cumulative (balanceAtDate) and period (totalDebit/totalCredit) amounts. balanceAtDate is the GL balance as of the end of the dateFilter range. totalDebit/totalCredit are entries within the range.',
            filter: tbFilter || '(none)',
            cumulative: {
              totals: cumulativeTotals,
              balanceCheck: {
                diff: Math.round(cCheck * 100) / 100,
                balanced: Math.abs(cCheck) < 1,
              },
            },
            period: {
              totals: periodTotals,
              balanceCheck: {
                diff: Math.round(pCheck * 100) / 100,
                balanced: Math.abs(pCheck) < 1,
              },
            },
            trialBalanceRows: trialBalanceData.length,
            bsAccountsCovered: tbAccountCount,
            sampleRows: trialBalanceData.slice(0, 5).map((tb: any) => ({
              number: tb.number,
              display: tb.display,
              balanceAtDateDebit: tb.balanceAtDateDebit,
              balanceAtDateCredit: tb.balanceAtDateCredit,
              totalDebit: tb.totalDebit,
              totalCredit: tb.totalCredit,
            })),
          },
          durationMs: Date.now() - t0,
        })
      } catch (err: any) {
        results.push({
          id: 'trial-balance',
          label: 'trialBalance Entity',
          detail: 'BC trialBalance report entity',
          success: false,
          error: err.message || String(err),
          durationMs: Date.now() - t0,
        })
      }
    }

    // ── Test 5: Method Comparison — all approaches side by side ──
    {
      const t0 = Date.now()
      try {
        const allAccounts = await client.queryAll('accounts')

        // Method A: accounts.balance (FlowField, all-time)
        const resultA = buildNativeBSHierarchy(allAccounts)

        // Method B: GL cumulative as of endDate
        const glB = await getGLBalances(client, { endDate })
        const resultB = buildNativeBSHierarchy(allAccounts, glB.amounts)

        // Method C: GL period only (if startDate provided)
        let resultC: {
          totals: { totalAssets: number; totalLiabilities: number; totalEquity: number }
        } | null = null
        let glCEntries = 0
        if (startDate && endDate) {
          const glC = await getGLBalances(client, { startDate, endDate })
          resultC = buildNativeBSHierarchy(allAccounts, glC.amounts)
          glCEntries = glC.entryCount
        }

        const comparison = {
          accountsBalance: {
            label: 'accounts.balance (FlowField, all-time)',
            ...resultA.totals,
            check:
              resultA.totals.totalAssets -
              resultA.totals.totalLiabilities -
              resultA.totals.totalEquity,
          },
          glSnapshot: {
            label: `GL snapshot (postingDate le ${endDate || '∞'})`,
            ...resultB.totals,
            check:
              resultB.totals.totalAssets -
              resultB.totals.totalLiabilities -
              resultB.totals.totalEquity,
            entryCount: glB.entryCount,
          },
          ...(resultC
            ? {
                glPeriod: {
                  label: `GL period (${startDate}..${endDate})`,
                  ...resultC.totals,
                  check:
                    resultC.totals.totalAssets -
                    resultC.totals.totalLiabilities -
                    resultC.totals.totalEquity,
                  entryCount: glCEntries,
                },
              }
            : {}),
        }

        // Identify which method matches closest to the PDF expectation
        const methods = Object.entries(comparison)
        const summaryLines = methods
          .map(
            ([key, m]) =>
              `${(m as any).label}: A=${(m as any).totalAssets?.toLocaleString()} L=${(m as any).totalLiabilities?.toLocaleString()} E=${(m as any).totalEquity?.toLocaleString()}`
          )
          .join(' | ')

        results.push({
          id: 'method-comparison',
          label: 'Method Comparison (all approaches)',
          detail: summaryLines,
          success: true,
          data: {
            explanation:
              'Side-by-side comparison of different data sources. accounts.balance uses BC FlowFields (often 0). GL snapshot is cumulative from beginning of time to endDate (correct for BS). GL period is only entries within the range (shows net changes, NOT a valid BS).',
            comparison,
          },
          durationMs: Date.now() - t0,
        })
      } catch (err: any) {
        results.push({
          id: 'method-comparison',
          label: 'Method Comparison (all approaches)',
          detail: 'Compare accounts.balance vs GL snapshot vs GL period',
          success: false,
          error: err.message || String(err),
          durationMs: Date.now() - t0,
        })
      }
    }

    // ── Test 6: GL Entry Analysis — document types, per-account breakdown ──
    {
      const t0 = Date.now()
      try {
        const allAccounts = await client.queryAll('accounts')

        // Build section map
        const sorted = [...allAccounts].sort((a: any, b: any) =>
          (a.number || '').localeCompare(b.number || '')
        )
        const sectionBounds: Array<{ category: string; startNumber: string }> = []
        let pnlStart: string | null = null
        for (const acc of sorted) {
          const at = decodeODataString(acc.accountType || '').toLowerCase()
          const cat = decodeODataString(acc.category || '').trim()
          if (at === 'begin-total' && ['Assets', 'Liabilities', 'Equity'].includes(cat)) {
            sectionBounds.push({ category: cat, startNumber: acc.number })
          }
          if (
            !pnlStart &&
            at === 'begin-total' &&
            ['Income', 'Revenue', 'Cost of Goods Sold', 'Expense'].includes(cat)
          ) {
            pnlStart = acc.number
          }
        }
        sectionBounds.sort((a, b) => a.startNumber.localeCompare(b.startNumber))
        const ranges = sectionBounds.map((s, i) => ({
          ...s,
          endBefore: i + 1 < sectionBounds.length ? sectionBounds[i + 1].startNumber : pnlStart,
        }))

        function glSection(accNum: string): string | null {
          for (let i = ranges.length - 1; i >= 0; i--) {
            if (accNum >= ranges[i].startNumber) {
              if (ranges[i].endBefore && accNum >= ranges[i].endBefore!) return null
              return ranges[i].category
            }
          }
          return null
        }

        // Fetch GL entries with documentType included
        const glParams: any = {
          $select: 'accountNumber,debitAmount,creditAmount,documentType,postingDate',
        }
        if (endDate) glParams.$filter = `postingDate le ${endDate}`
        const entries = await client.listGeneralLedgerEntries(glParams)

        // Analyze document types
        const docTypeCounts: Record<string, number> = {}
        const docTypeAmountsBySection: Record<string, Record<string, number>> = {}

        // Per-account GL sums for Asset section
        const assetAccountGLSums: Record<string, number> = {}
        const accountNames: Record<string, string> = {}
        for (const acc of allAccounts) {
          if (acc.number) accountNames[acc.number] = acc.displayName || acc.number
        }

        for (const entry of entries) {
          const dt = entry.documentType || '(blank)'
          const net = (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)
          docTypeCounts[dt] = (docTypeCounts[dt] || 0) + 1

          const section = glSection(entry.accountNumber)
          if (section) {
            if (!docTypeAmountsBySection[section]) docTypeAmountsBySection[section] = {}
            docTypeAmountsBySection[section][dt] = (docTypeAmountsBySection[section][dt] || 0) + net
          }

          if (section === 'Assets') {
            assetAccountGLSums[entry.accountNumber] =
              (assetAccountGLSums[entry.accountNumber] || 0) + net
          }
        }

        // Top 10 asset accounts by absolute GL balance
        const topAssets = Object.entries(assetAccountGLSums)
          .map(([num, bal]) => ({ number: num, name: accountNames[num] || num, balance: bal }))
          .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
          .slice(0, 15)

        // Asset total by document type
        const assetDocTypes = docTypeAmountsBySection['Assets'] || {}

        results.push({
          id: 'gl-entry-analysis',
          label: 'GL Entry Analysis',
          detail: `${entries.length} GL entries. Document types: ${Object.entries(docTypeCounts)
            .map(([k, v]) => `${k}:${v}`)
            .join(', ')}`,
          success: true,
          data: {
            explanation:
              'Analyzes GL entries by documentType to identify closing entries or unusual entry types that could affect BS calculations. Also shows top asset accounts by GL balance.',
            totalEntries: entries.length,
            documentTypeCounts: docTypeCounts,
            assetTotalByDocType: assetDocTypes,
            assetTotal: Object.values(assetAccountGLSums).reduce((s, v) => s + v, 0),
            topAssetAccounts: topAssets,
            liabilityDocTypes: docTypeAmountsBySection['Liabilities'] || {},
            equityDocTypes: docTypeAmountsBySection['Equity'] || {},
          },
          durationMs: Date.now() - t0,
        })
      } catch (err: any) {
        results.push({
          id: 'gl-entry-analysis',
          label: 'GL Entry Analysis',
          detail: 'Analyze GL entry document types and per-account breakdown',
          success: false,
          error: err.message || String(err),
          durationMs: Date.now() - t0,
        })
      }
    }

    // ── Test 7: Category and chart structure analysis ──
    {
      const t0 = Date.now()
      try {
        const allAccounts = await client.queryAll('accounts')
        const sorted = [...allAccounts].sort((a: any, b: any) =>
          (a.number || '').localeCompare(b.number || '')
        )

        // Analyze all Begin-Total accounts to understand chart structure
        const beginTotals = sorted
          .filter(
            (acc: any) => decodeODataString(acc.accountType || '').toLowerCase() === 'begin-total'
          )
          .map((acc: any, i: number) => ({
            index: i,
            number: acc.number,
            name: acc.displayName || acc.number,
            category: decodeODataString(acc.category || '').trim() || '(empty)',
            subCategory: acc.subCategory || '(empty)',
          }))

        // Analyze all End-Total accounts
        const endTotals = sorted
          .filter((acc: any) => {
            const t = decodeODataString(acc.accountType || '').toLowerCase()
            return t === 'end-total' || t === 'total'
          })
          .map((acc: any) => ({
            number: acc.number,
            name: acc.displayName || acc.number,
            category: decodeODataString(acc.category || '').trim() || '(empty)',
            type: decodeODataString(acc.accountType || ''),
          }))

        // Category distribution
        const categoryCounts: Record<string, number> = {}
        const categoryByType: Record<string, Record<string, number>> = {}
        for (const acc of allAccounts) {
          const cat = decodeODataString(acc.category || '').trim() || '(empty)'
          const accType = decodeODataString(acc.accountType || '').toLowerCase()
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
          if (!categoryByType[accType]) categoryByType[accType] = {}
          categoryByType[accType][cat] = (categoryByType[accType][cat] || 0) + 1
        }

        // SubCategory distribution for BS categories
        const subCategoryCounts: Record<string, Record<string, number>> = {}
        for (const acc of allAccounts) {
          const cat = decodeODataString(acc.category || '').trim()
          if (!['Assets', 'Liabilities', 'Equity'].includes(cat)) continue
          const sub = acc.subCategory || '(empty)'
          if (!subCategoryCounts[cat]) subCategoryCounts[cat] = {}
          subCategoryCounts[cat][sub] = (subCategoryCounts[cat][sub] || 0) + 1
        }

        results.push({
          id: 'chart-analysis',
          label: 'Chart of Accounts Structure Analysis',
          detail: `${allAccounts.length} accounts, ${beginTotals.length} Begin-Totals, ${endTotals.length} End-Totals. Categories: ${Object.keys(categoryCounts).join(', ')}`,
          success: true,
          data: {
            totalAccounts: allAccounts.length,
            categoryCounts,
            categoryByType,
            subCategoryCounts,
            beginTotals,
            endTotals,
          },
          durationMs: Date.now() - t0,
        })
      } catch (err: any) {
        results.push({
          id: 'chart-analysis',
          label: 'Chart of Accounts Structure Analysis',
          detail: 'Analyze chart structure',
          success: false,
          error: err.message || String(err),
          durationMs: Date.now() - t0,
        })
      }
    }

    return NextResponse.json({
      connectionId: resolvedConnectionId,
      companyName: credentials.company_name || null,
      startDate,
      endDate,
      tests: results,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Diagnostic failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
