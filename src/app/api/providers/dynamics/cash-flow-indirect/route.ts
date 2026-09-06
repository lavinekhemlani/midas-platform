import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

/**
 * GET /api/providers/dynamics/cash-flow-indirect
 *
 * Builds a proper indirect-method Cash Flow Statement from BC GL entries.
 * Mirrors the warehouse useCashFlowStatement() hook logic but via OData API.
 *
 * Classification (matches warehouse SQL):
 *   Operating: Income, Expense, Cost of Goods Sold accounts
 *              + current asset changes (AR, inventory) + current liability changes (AP, accrued)
 *   Investing: Non-current asset accounts (fixed assets, property, equipment)
 *   Financing: Non-current liabilities + equity
 *
 * Cash/bank accounts are excluded from activity classification and used only
 * for beginning/ending cash balance computation.
 */
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

    // ── Step 1: Fetch all accounts for classification metadata ──
    const allAccounts = await client.queryAll('accounts')

    // Decode BC OData-encoded names: _xHHHH_ → char
    const decode = (s: string) =>
      s.replace(/_x([0-9a-fA-F]{4})_/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))

    // Build account classification map
    interface AccountMeta {
      category: string // Assets, Liabilities, Equity, Income, Expense
      subCategory: string // Cash, Receivables, Inventory, Fixed Assets, etc.
      displayName: string
      accountType: string // Posting, Heading, Total, etc.
      activity: 'operating' | 'investing' | 'financing' | 'cash' | 'skip'
    }

    const accountMap = new Map<string, AccountMeta>()

    // ── Build section boundaries from Begin-Total accounts ──
    // This lets us infer the category for accounts with empty `category` field
    // by determining which chart-of-accounts section they fall under.
    const ALL_CATS = [
      'Assets',
      'Liabilities',
      'Equity',
      'Income',
      'Revenue',
      'Cost of Goods Sold',
      'Expense',
    ]
    const sortedAccounts = [...allAccounts].sort((a: any, b: any) =>
      (a.number || '').localeCompare(b.number || '')
    )
    const sectionBoundaries: Array<{ category: string; startNumber: string }> = []
    for (const acc of sortedAccounts) {
      const at = decode(acc.accountType || '').toLowerCase()
      if (at !== 'begin-total') continue
      const rawCat = decode(acc.category || '').trim()
      const name = (acc.displayName || acc.number || '').trim()
      if (ALL_CATS.includes(rawCat)) {
        sectionBoundaries.push({ category: rawCat, startNumber: acc.number })
      } else if (!rawCat || rawCat === ' ') {
        const lowerName = name.toLowerCase()
        for (const cat of ALL_CATS) {
          if (lowerName === cat.toLowerCase() || lowerName.startsWith(cat.toLowerCase())) {
            sectionBoundaries.push({ category: cat, startNumber: acc.number })
            break
          }
        }
      }
    }
    sectionBoundaries.sort((a, b) => a.startNumber.localeCompare(b.startNumber))
    const sectionRanges = sectionBoundaries.map((s, i) => ({
      category: s.category,
      startNumber: s.startNumber,
      endBefore: i + 1 < sectionBoundaries.length ? sectionBoundaries[i + 1].startNumber : null,
    }))
    function inferSection(accNumber: string): string | null {
      for (let i = sectionRanges.length - 1; i >= 0; i--) {
        const range = sectionRanges[i]
        if (accNumber >= range.startNumber) {
          if (range.endBefore && accNumber >= range.endBefore) continue
          return range.category
        }
      }
      return null
    }

    // Build a map of nearest Begin-Total parent name for each posting account
    // This lets us detect if a posting account sits under a "Bank Accounts" section
    const parentSectionNameMap = new Map<string, string>()
    const nameStack: string[] = []
    for (const acc of sortedAccounts) {
      const at = decode(acc.accountType || '').toLowerCase()
      const name = decode(acc.displayName || acc.number || '').trim()
      if (at === 'begin-total') {
        nameStack.push(name)
      } else if (at === 'end-total' || at === 'total') {
        nameStack.pop()
      } else if (at === 'posting' && nameStack.length > 0) {
        // Store the immediate parent Begin-Total name
        parentSectionNameMap.set(acc.number, nameStack[nameStack.length - 1])
      }
    }

    for (const acc of allAccounts) {
      if (!acc.number) continue

      const accType = decode(acc.accountType || '').toLowerCase()
      if (accType !== 'posting') continue

      let category = decode(acc.category || '').trim()
      const subCategory = decode(acc.subCategory || 'General').toLowerCase()
      const displayName = acc.displayName || acc.number
      const parentSectionName = parentSectionNameMap.get(acc.number) || null

      // If category is empty, infer from hierarchy position
      if (!category) {
        const inferred = inferSection(acc.number)
        if (inferred) {
          logger.info('CF statement: inferred category for empty-category account', {
            accountNumber: acc.number,
            accountName: displayName,
            inferredCategory: inferred,
            subCategory,
          })
          category = inferred
        } else {
          logger.warn('CF statement: could not infer category', {
            accountNumber: acc.number,
            accountName: displayName,
            subCategory,
          })
        }
      }

      // Classification logic matching warehouse SQL
      let activity: AccountMeta['activity'] = 'skip'

      if (category === 'Income' || category === 'Revenue' || category === 'Expense') {
        activity = 'operating'
      } else if (category === 'Cost of Goods Sold') {
        activity = 'operating'
      } else if (category === 'Assets') {
        // Cash/bank accounts → used for beginning/ending balance only
        // Check subCategory, parent section name, and account name for cash/bank signals
        const isCashBySubCategory =
          subCategory.includes('cash') ||
          subCategory.includes('bank') ||
          subCategory.includes('checking') ||
          subCategory.includes('savings')
        const isCashByParentSection =
          parentSectionName !== null && /cash|bank|checking|savings/i.test(parentSectionName)
        if (isCashBySubCategory || isCashByParentSection) {
          activity = 'cash'
        }
        // Clearing/transit accounts → operating (short-term settlement)
        else if (/clearing|transit/i.test(displayName)) {
          activity = 'operating'
        }
        // Current assets (AR, inventory, prepaid, intercompany receivables) → operating
        else if (
          subCategory.includes('receivable') ||
          subCategory.includes('inventory') ||
          (subCategory.includes('current') &&
            !subCategory.includes('non-current') &&
            !subCategory.includes('noncurrent') &&
            !subCategory.includes('non current')) ||
          subCategory.includes('prepaid') ||
          subCategory.includes('due from') ||
          subCategory.includes('due to') ||
          subCategory.includes('related companies') ||
          subCategory.includes('intercompany')
        ) {
          activity = 'operating'
        }
        // Non-current assets (fixed, property, equipment) → investing
        else {
          activity = 'investing'
        }
      } else if (category === 'Liabilities') {
        // Current liabilities (payable, accrued, intercompany) → operating (working capital)
        if (
          subCategory.includes('payable') ||
          subCategory.includes('accrued') ||
          (subCategory.includes('current') &&
            !subCategory.includes('non-current') &&
            !subCategory.includes('noncurrent') &&
            !subCategory.includes('non current')) ||
          subCategory.includes('due from') ||
          subCategory.includes('due to') ||
          subCategory.includes('related companies') ||
          subCategory.includes('intercompany')
        ) {
          activity = 'operating'
        }
        // Non-current liabilities → financing
        else {
          activity = 'financing'
        }
      } else if (category === 'Equity') {
        activity = 'financing'
      }

      accountMap.set(acc.number, {
        category,
        subCategory: decode(acc.subCategory || 'General'),
        displayName,
        accountType: accType,
        activity,
      })
    }

    // ── Step 2: Fetch GL entries ──
    // We need three sets:
    //   a) Cumulative GL for cash accounts before startDate → beginning cash
    //   b) Period GL for all posting accounts → activity classification
    //   c) Cumulative GL for cash accounts up to endDate → ending cash

    const cashAccountNums = new Set<string>()
    const allPostingNums = new Set<string>()
    for (const [num, meta] of accountMap) {
      if (meta.activity === 'cash') cashAccountNums.add(num)
      if (meta.activity !== 'skip') allPostingNums.add(num)
    }

    // Parallel fetches
    const [beginningCashEntries, periodEntries, endingCashEntries] = await Promise.all([
      // Beginning cash: all GL entries before startDate for cash accounts
      startDate
        ? client.listGeneralLedgerEntries({
            $select: 'accountNumber,debitAmount,creditAmount',
            $filter: `postingDate lt ${startDate}`,
          })
        : Promise.resolve([]),

      // Period entries: all GL entries in date range for all accounts
      startDate && endDate
        ? client.listGeneralLedgerEntries({
            $select: 'accountNumber,debitAmount,creditAmount',
            $filter: `postingDate ge ${startDate} and postingDate le ${endDate}`,
          })
        : endDate
          ? client.listGeneralLedgerEntries({
              $select: 'accountNumber,debitAmount,creditAmount',
              $filter: `postingDate le ${endDate}`,
            })
          : client.listGeneralLedgerEntries({
              $select: 'accountNumber,debitAmount,creditAmount',
            }),

      // Ending cash: all GL entries up to endDate for cash accounts
      endDate
        ? client.listGeneralLedgerEntries({
            $select: 'accountNumber,debitAmount,creditAmount',
            $filter: `postingDate le ${endDate}`,
          })
        : client.listGeneralLedgerEntries({
            $select: 'accountNumber,debitAmount,creditAmount',
          }),
    ])

    // ── Step 3: Compute beginning cash balance ──
    let beginningCash = 0
    for (const entry of beginningCashEntries) {
      if (cashAccountNums.has(entry.accountNumber)) {
        beginningCash += (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)
      }
    }

    // ── Step 4: Compute ending cash balance ──
    let endingCash = 0
    for (const entry of endingCashEntries) {
      if (cashAccountNums.has(entry.accountNumber)) {
        endingCash += (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)
      }
    }

    // ── Step 5a: Net Income via P&L hierarchy walk (IAS 7 indirect method) ──
    // Per accounting standards, start with net income from the income statement.
    const PL_CATS = ['Income', 'Revenue', 'Cost of Goods Sold', 'Expense']
    const sortedAccts = sortedAccounts
    const periodGlByAccount = new Map<string, number>()
    for (const e of periodEntries) {
      if (!e.accountNumber) continue
      periodGlByAccount.set(
        e.accountNumber,
        (periodGlByAccount.get(e.accountNumber) ?? 0) + (e.debitAmount ?? 0) - (e.creditAmount ?? 0)
      )
    }

    const plAccountCategoryMap = new Map<string, string>()
    let hwGlobalDepth = 0
    let hwInPLSection = false
    let hwPLSectionCategory = ''
    const hwSumStack: number[] = []
    let hwRelativeDepth = 0
    const hwSectionTotals: { category: string; total: number }[] = []

    for (const acc of sortedAccts) {
      const accType = decode(acc.accountType || '').toLowerCase()
      const rawCat = decode(acc.category || '').trim()
      const nc = periodGlByAccount.get(acc.number) ?? 0

      if (accType === 'begin-total') {
        if (!hwInPLSection && hwGlobalDepth === 0 && PL_CATS.includes(rawCat)) {
          hwInPLSection = true
          hwPLSectionCategory = rawCat
          hwRelativeDepth = 0
          hwSumStack[0] = 0
          hwRelativeDepth++
        } else if (hwInPLSection) {
          hwSumStack[hwRelativeDepth] = 0
          hwRelativeDepth++
        }
        hwGlobalDepth++
      } else if (accType === 'end-total' || accType === 'total') {
        hwGlobalDepth = Math.max(0, hwGlobalDepth - 1)
        if (hwInPLSection) {
          hwRelativeDepth = Math.max(0, hwRelativeDepth - 1)
          const totalAmount = hwSumStack[hwRelativeDepth] ?? 0
          if (hwRelativeDepth > 0) {
            hwSumStack[hwRelativeDepth - 1] = (hwSumStack[hwRelativeDepth - 1] ?? 0) + totalAmount
          }
          if (hwRelativeDepth === 0 && hwGlobalDepth === 0) {
            hwSectionTotals.push({ category: hwPLSectionCategory, total: totalAmount })
            hwInPLSection = false
          }
        }
      } else if (hwInPLSection && accType !== 'heading') {
        plAccountCategoryMap.set(acc.number, hwPLSectionCategory)
        if (hwRelativeDepth > 0 && nc !== 0) {
          hwSumStack[hwRelativeDepth - 1] = (hwSumStack[hwRelativeDepth - 1] ?? 0) + nc
        }
      }
    }

    let hwRevenue = 0,
      hwCOGS = 0,
      hwExpenses = 0
    for (const st of hwSectionTotals) {
      if (st.category === 'Income' || st.category === 'Revenue') hwRevenue += Math.abs(st.total)
      else if (st.category === 'Cost of Goods Sold') hwCOGS += Math.abs(st.total)
      else if (st.category === 'Expense') hwExpenses += Math.abs(st.total)
    }
    const netIncome = hwRevenue - hwCOGS - hwExpenses

    // ── Step 5b: Depreciation from expense accounts in the hierarchy ──
    let depreciation = 0
    for (const acc of sortedAccts) {
      const accType = decode(acc.accountType || '').toLowerCase()
      if (accType !== 'posting') continue
      const plCat = plAccountCategoryMap.get(acc.number)
      if (plCat !== 'Expense') continue
      const sub = decode(acc.subCategory || '').toLowerCase()
      const name = (acc.displayName || '').toLowerCase()
      if (
        sub.includes('depreciation') ||
        sub.includes('amortization') ||
        name.includes('depreciation') ||
        name.includes('amortization')
      ) {
        depreciation += Math.abs(periodGlByAccount.get(acc.number) ?? 0)
      }
    }

    // ── Step 5c: Working capital, investing, financing from GL ──
    let arChange = 0
    let inventoryChange = 0
    let apChange = 0
    let prepaidChange = 0
    let accruedLiabilitiesChange = 0
    let deferredRevenueChange = 0
    let otherOperating = 0
    let fixedAssetChange = 0
    let otherInvesting = 0
    let debtChange = 0
    let equityChange = 0

    for (const entry of periodEntries) {
      const meta = accountMap.get(entry.accountNumber)
      if (!meta || meta.activity === 'skip' || meta.activity === 'cash') continue
      // Skip P&L accounts — already handled by hierarchy walk
      if (
        meta.category === 'Income' ||
        meta.category === 'Revenue' ||
        meta.category === 'Expense' ||
        meta.category === 'Cost of Goods Sold'
      )
        continue

      const debit = entry.debitAmount ?? 0
      const credit = entry.creditAmount ?? 0
      const sub = meta.subCategory.toLowerCase()

      if (meta.category === 'Assets' && meta.activity === 'operating') {
        const change = credit - debit
        if (sub.includes('receivable')) arChange += change
        else if (sub.includes('inventory')) inventoryChange += change
        else if (sub.includes('prepaid') || sub.includes('prepayment')) prepaidChange += change
        else otherOperating += change
      } else if (meta.category === 'Assets' && meta.activity === 'investing') {
        const change = debit - credit
        if (
          sub.includes('depreciation') ||
          meta.displayName.toLowerCase().includes('depreciation')
        ) {
          depreciation += credit - debit
        } else if (
          sub.includes('investment') ||
          sub.includes('securities') ||
          sub.includes('bonds')
        ) {
          otherInvesting += change
        } else {
          fixedAssetChange += change
        }
      } else if (meta.category === 'Liabilities' && meta.activity === 'operating') {
        const change = credit - debit
        if (sub.includes('payable')) apChange += change
        else if (sub.includes('accrued')) accruedLiabilitiesChange += change
        else if (sub.includes('deferred') || sub.includes('unearned'))
          deferredRevenueChange += change
        else otherOperating += change
      } else if (meta.category === 'Liabilities' && meta.activity === 'financing') {
        debtChange += credit - debit
      } else if (meta.category === 'Equity') {
        equityChange += credit - debit
      }
    }

    // ── Step 6: Build indirect method statement ──

    const totalOperating =
      netIncome +
      depreciation +
      arChange +
      inventoryChange +
      apChange +
      prepaidChange +
      accruedLiabilitiesChange +
      deferredRevenueChange +
      otherOperating
    const capitalExpenditures = Math.min(-fixedAssetChange, 0) // Negative = capex outflow
    const assetSales = Math.max(-fixedAssetChange, 0) // Positive = asset sale inflow
    const totalInvesting = -fixedAssetChange - otherInvesting
    const debtProceeds = Math.max(debtChange, 0)
    const debtRepayments = Math.min(debtChange, 0)
    const totalFinancing = debtChange + equityChange
    const computedNetCashChange = totalOperating + totalInvesting + totalFinancing

    // IAS 7 para 28: Effect of exchange rate changes on cash held in foreign currency.
    // Multi-currency companies have FX gains/losses on cash balances that don't flow
    // through Operating/Investing/Financing. This line reconciles to actual cash movement.
    const actualCashChange = endingCash - beginningCash
    const exchangeRateEffect = Math.round((actualCashChange - computedNetCashChange) * 100) / 100
    const netCashChange = actualCashChange // Statement MUST tie to actual cash movement

    const statement = {
      beginningCash,
      operatingActivities: {
        netIncome,
        adjustments: {
          depreciation,
          accountsReceivableChange: arChange,
          inventoryChange,
          accountsPayableChange: apChange,
          prepaidChange,
          accruedLiabilitiesChange,
          deferredRevenueChange,
          otherAdjustments: otherOperating,
        },
        totalOperating,
      },
      investingActivities: {
        capitalExpenditures,
        assetSales,
        investments: -otherInvesting,
        totalInvesting,
      },
      financingActivities: {
        debtProceeds,
        debtRepayments,
        equityChanges: equityChange,
        dividends: 0,
        totalFinancing,
      },
      exchangeRateEffect,
      netCashChange,
      endingCash,
    }

    // Debug: classification summary
    const skippedAccountsList = [...accountMap.entries()]
      .filter(([, m]) => m.activity === 'skip')
      .map(([num, m]) => ({
        number: num,
        name: m.displayName,
        category: m.category,
        subCategory: m.subCategory,
      }))

    const classificationSummary = {
      cashAccounts: cashAccountNums.size,
      operatingAccounts: [...accountMap.values()].filter((m) => m.activity === 'operating').length,
      investingAccounts: [...accountMap.values()].filter((m) => m.activity === 'investing').length,
      financingAccounts: [...accountMap.values()].filter((m) => m.activity === 'financing').length,
      skippedAccounts: skippedAccountsList.length,
      totalGLEntries: periodEntries.length,
      exchangeRateEffect,
    }

    logger.info('BC indirect cash flow statement built', {
      organizationId,
      connectionId: resolvedConnectionId,
      beginningCash,
      endingCash,
      netCashChange,
      totalOperating,
      totalInvesting,
      totalFinancing,
      ...classificationSummary,
    })

    return NextResponse.json({
      data: {
        statement,
        period: { startDate, endDate },
        companyName: credentials.company_name || null,
        classification: classificationSummary,
      },
    })
  } catch (error) {
    logger.error('Failed to build indirect cash flow statement', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to build cash flow statement',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
