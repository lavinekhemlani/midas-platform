// src/app/api/dev/bc-agent-diagnostic/route.ts
/**
 * POST /api/dev/bc-agent-diagnostic?connectionId=xxx
 * Accepts the agent query builder payload and calls BC APIs directly
 * using BusinessCentralClient. Returns raw BC data for diagnostic comparison.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { logger } from '@/lib/logger'
import { createLLM } from '@/lib/llm'

/**
 * LLM-powered account filter. Sends the user's filter text + account list
 * to the LLM and returns only the accounts the LLM deems matching.
 */
async function llmFilterAccounts(
  accounts: any[],
  filterText: string,
  fieldMap: { name: string; number: string; category: string }
): Promise<Set<string>> {
  if (!filterText || accounts.length === 0) return new Set(accounts.map((a) => a[fieldMap.number]))

  const accountSummary = accounts
    .map((a) => `${a[fieldMap.number]} | ${a[fieldMap.name]} | ${a[fieldMap.category]}`)
    .join('\n')

  const llm = createLLM({ temperature: 0, maxTokens: 2000 })
  const response = await llm.invoke([
    {
      role: 'system',
      content: `You are an accounting filter. Given a list of accounts and a user's filter query, return ONLY the account numbers that match the user's intent. Understand synonyms (e.g. "revenue"="Income", "COGS"="Cost of Goods Sold", "opex"="operating expenses"). Return a JSON array of matching account numbers. If the filter matches a category, include ALL accounts in that category. Return ONLY the JSON array, nothing else.`,
    },
    {
      role: 'user',
      content: `Filter: "${filterText}"\n\nAccounts (number | name | category):\n${accountSummary}`,
    },
  ])

  try {
    const text =
      typeof response.content === 'string' ? response.content : JSON.stringify(response.content)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const numbers: string[] = JSON.parse(jsonMatch[0])
      return new Set(numbers.map(String))
    }
  } catch {
    logger.warn('LLM filter parse failed, returning all accounts')
  }
  return new Set(accounts.map((a) => a[fieldMap.number]))
}

/**
 * Decode OData-encoded strings from BC API.
 * BC encodes special chars as _xHHHH_ (e.g., _x0020_ = space, _x002d_ = hyphen).
 */
function decodeOData(s: string): string {
  return s.replace(/_x([0-9a-f]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/** P&L categories used for account classification */
const PL_CATEGORIES = ['Income', 'Expense', 'Cost of Goods Sold']
/** BS categories */
const BS_CATEGORIES = ['Assets', 'Liabilities', 'Equity']

export const POST = withAuth(async (request: NextRequest, { organizationId }) => {
  const url = new URL(request.url)
  const connectionId = url.searchParams.get('connectionId') || undefined

  // Resolve connection
  let resolvedConnectionId = connectionId
  if (!resolvedConnectionId) {
    resolvedConnectionId = (await getActiveBCConnectionId(organizationId)) || undefined
  }
  if (!resolvedConnectionId) {
    return NextResponse.json({ error: 'No active BC connection' }, { status: 404 })
  }

  // Get credentials
  const credentials = await getBCConnectionCredentials(organizationId, resolvedConnectionId)
  if (!credentials || !(credentials as any).connected) {
    return NextResponse.json(
      { error: 'Connection not active or credentials missing' },
      { status: 404 }
    )
  }

  const creds = credentials as any

  // Parse request body (query builder payload)
  const input = await request.json()
  const { queryType, reportType, startDate, endDate } = input

  const startTime = Date.now()

  try {
    const client = new BusinessCentralClient({
      organizationId,
      connectionId: resolvedConnectionId,
    })

    let result: any = {}

    if (queryType === 'report') {
      switch (reportType) {
        case 'profit_loss':
        case 'monthly_pnl_trend': {
          // 1. Fetch ALL accounts (need accountType for Begin-Total/End-Total hierarchy)
          const allAccounts = await client.queryAll('accounts')

          // 2. Fetch ALL GL entries for the date range
          //    Include postingDate for monthly_pnl_trend breakdown
          let glEntries: any[] = []
          let glEntriesError: string | null = null
          const glParams: Record<string, any> = {
            $select: 'accountNumber,debitAmount,creditAmount,postingDate',
          }
          if (startDate && endDate) {
            glParams.$filter = `postingDate ge ${startDate} and postingDate le ${endDate}`
          }
          try {
            glEntries = await client.listGeneralLedgerEntries(glParams)
          } catch (err) {
            glEntriesError = err instanceof Error ? err.message : 'GL entries not available'
          }

          // 3. Build account → P&L category map by walking chart of accounts hierarchy
          const sorted = [...allAccounts].sort((a: any, b: any) =>
            (a.number || '').localeCompare(b.number || '')
          )

          const accountCategoryMap = new Map<string, string>() // accountNumber → 'Income'|'Cost of Goods Sold'|'Expense'
          let globalDepth = 0
          let inPLSection = false
          let plSectionCategory = ''
          const plAccountsList: any[] = []
          const sectionTotals: { category: string; total: number }[] = []
          const sumStack: number[] = []
          let relativeDepth = 0

          // 4. Aggregate GL by account number (for the aggregate P&L view)
          const glByAccount = new Map<string, number>()
          for (const entry of glEntries) {
            const accNo = entry.accountNumber
            if (!accNo) continue
            const net = (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)
            glByAccount.set(accNo, (glByAccount.get(accNo) ?? 0) + net)
          }

          for (const acc of sorted) {
            const accType = decodeOData(acc.accountType || '').toLowerCase()
            const rawCat = decodeOData(acc.category || '').trim()
            const nc = glByAccount.get(acc.number) ?? 0

            if (accType === 'begin-total') {
              if (!inPLSection && globalDepth === 0 && PL_CATEGORIES.includes(rawCat)) {
                inPLSection = true
                plSectionCategory = rawCat
                relativeDepth = 0
                sumStack[0] = 0
                relativeDepth++
              } else if (inPLSection) {
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
                if (relativeDepth === 0 && globalDepth === 0) {
                  sectionTotals.push({ category: plSectionCategory, total: totalAmount })
                  inPLSection = false
                }
              }
            } else if (inPLSection && accType !== 'heading') {
              // Posting account inside a P&L section — record its category
              accountCategoryMap.set(acc.number, plSectionCategory)
              if (relativeDepth > 0 && nc !== 0) {
                sumStack[relativeDepth - 1] = (sumStack[relativeDepth - 1] ?? 0) + nc
              }
              plAccountsList.push({
                number: acc.number,
                name: acc.displayName,
                category: plSectionCategory,
                subCategory: acc.subCategory || '',
                glAmount: nc,
              })
            }
          }

          // 5. Compute totals from section End-Totals
          let totalRevenue = 0
          let totalCOGS = 0
          let totalExpenses = 0
          for (const st of sectionTotals) {
            if (st.category === 'Income') totalRevenue += Math.abs(st.total)
            else if (st.category === 'Cost of Goods Sold') totalCOGS += Math.abs(st.total)
            else if (st.category === 'Expense') totalExpenses += Math.abs(st.total)
          }
          const grossProfit = totalRevenue - totalCOGS
          const netIncome = grossProfit - totalExpenses

          // 6. Monthly breakdown (for monthly_pnl_trend)
          let monthlyTrend: any[] | null = null
          if (reportType === 'monthly_pnl_trend' && !glEntriesError) {
            const monthlyMap = new Map<
              string,
              { revenue: number; cogs: number; expenses: number }
            >()

            for (const entry of glEntries) {
              const accNo = entry.accountNumber
              if (!accNo) continue
              const cat = accountCategoryMap.get(accNo)
              if (!cat) continue // not a P&L account

              const month = (entry.postingDate || '').substring(0, 7) // YYYY-MM
              if (!month) continue

              if (!monthlyMap.has(month))
                monthlyMap.set(month, { revenue: 0, cogs: 0, expenses: 0 })
              const m = monthlyMap.get(month)!
              const net = (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)

              // Sign convention: Income credits are negative net, negate to get positive revenue.
              // COGS/Expense debits are positive net, use as-is. No Math.abs anywhere —
              // this ensures monthly sums exactly match section totals for any period aggregation.
              if (cat === 'Income') m.revenue += -net
              else if (cat === 'Cost of Goods Sold') m.cogs += net
              else if (cat === 'Expense') m.expenses += net
            }

            monthlyTrend = [...monthlyMap.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([month, m]) => ({
                month,
                revenue: Math.round(m.revenue * 100) / 100,
                cogs: Math.round(m.cogs * 100) / 100,
                grossProfit: Math.round((m.revenue - m.cogs) * 100) / 100,
                expenses: Math.round(m.expenses * 100) / 100,
                netIncome: Math.round((m.revenue - m.cogs - m.expenses) * 100) / 100,
              }))
          }

          // Apply account-level filters via LLM
          // Category filter → recomputes KPI summary (e.g. "revenue" shows only income totals)
          // Name filter → only filters the account list, KPIs stay global
          const categoryFilter = input.filters?.accountCategory || ''
          const nameFilter = input.filters?.accountName || ''

          // Step 1: Category filter — affects both KPIs and list
          let categoryFiltered = plAccountsList
          if (categoryFilter) {
            const matchingNumbers = await llmFilterAccounts(plAccountsList, categoryFilter, {
              name: 'name',
              number: 'number',
              category: 'category',
            })
            categoryFiltered = plAccountsList.filter((a: any) => matchingNumbers.has(a.number))
          }

          // Step 2: Name filter — further narrows the list only
          let filteredAccounts = categoryFiltered
          if (nameFilter) {
            const matchingNumbers = await llmFilterAccounts(categoryFiltered, nameFilter, {
              name: 'name',
              number: 'number',
              category: 'category',
            })
            filteredAccounts = categoryFiltered.filter((a: any) => matchingNumbers.has(a.number))
          }

          // Recompute KPI summary from category-filtered accounts (not name-filtered)
          let displaySummary
          if (categoryFilter) {
            let filtRevenue = 0
            let filtCOGS = 0
            let filtExpenses = 0
            for (const acc of categoryFiltered) {
              const amt = Math.abs(acc.glAmount || 0)
              if (acc.category === 'Income') filtRevenue += amt
              else if (acc.category === 'Cost of Goods Sold') filtCOGS += amt
              else if (acc.category === 'Expense') filtExpenses += amt
            }
            displaySummary = {
              totalRevenue: filtRevenue,
              totalCOGS: filtCOGS,
              grossProfit: filtRevenue - filtCOGS,
              totalExpenses: filtExpenses,
              netIncome: filtRevenue - filtCOGS - filtExpenses,
            }
          } else {
            displaySummary = {
              totalRevenue,
              totalCOGS,
              grossProfit,
              totalExpenses,
              netIncome,
            }
          }

          result = {
            reportType,
            source: startDate && endDate ? 'gl-entries' : 'accounts-all-time',
            period: { startDate: startDate || null, endDate: endDate || null },
            summary: displaySummary,
            ...(monthlyTrend ? { monthlyTrend } : {}),
            glEntries: {
              available: !glEntriesError,
              error: glEntriesError,
              count: glEntries.length,
            },
            accounts: {
              total: allAccounts.length,
              plAccounts: plAccountsList.length,
              sectionTotals,
              list: filteredAccounts,
            },
          }
          break
        }

        case 'balance_sheet': {
          // BS uses range-based section detection (same as balance-sheet-test)
          // because BC chart can have unbalanced Begin-Total/End-Total pairs.
          //
          // Key difference from P&L:
          //   - GL entries are CUMULATIVE (postingDate le endDate), not period-based
          //   - Assets: debit normal (positive raw = asset value)
          //   - Liabilities/Equity: credit normal (negate raw for display)
          //   - Net Income from P&L accounts is added to Equity

          // 1. Fetch ALL accounts
          const allAccounts = await client.queryAll('accounts')
          const sorted = [...allAccounts].sort((a: any, b: any) =>
            (a.number || '').localeCompare(b.number || '')
          )

          // 2. Fetch GL entries — cumulative snapshot up to endDate
          let glEntries: any[] = []
          let glEntriesError: string | null = null
          const glParams: Record<string, any> = {
            $select: 'accountNumber,debitAmount,creditAmount',
          }
          if (endDate) {
            glParams.$filter = `postingDate le ${endDate}`
          }
          try {
            glEntries = await client.listGeneralLedgerEntries(glParams)
          } catch (err) {
            glEntriesError = err instanceof Error ? err.message : 'GL entries not available'
          }

          // 3. Aggregate GL by account number
          const glByAccount = new Map<string, number>()
          for (const entry of glEntries) {
            const accNo = entry.accountNumber
            if (!accNo) continue
            const net = (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)
            glByAccount.set(accNo, (glByAccount.get(accNo) ?? 0) + net)
          }

          // 4. Phase 1: Find BS section RANGES from Begin-Total accounts
          const sectionBoundaries: Array<{ category: string; startNumber: string }> = []
          let pnlStartNumber: string | null = null

          for (const acc of sorted) {
            const accType = decodeOData(acc.accountType || '').toLowerCase()
            if (accType !== 'begin-total') continue
            const rawCat = decodeOData(acc.category || '').trim()
            const displayName = (acc.displayName || acc.number || '').trim()

            if (BS_CATEGORIES.includes(rawCat)) {
              sectionBoundaries.push({ category: rawCat, startNumber: acc.number })
            } else if (!rawCat || rawCat === ' ') {
              const lowerName = displayName.toLowerCase()
              for (const cat of BS_CATEGORIES) {
                if (lowerName === cat.toLowerCase() || lowerName.startsWith(cat.toLowerCase())) {
                  sectionBoundaries.push({ category: cat, startNumber: acc.number })
                  break
                }
              }
            }
            if (!pnlStartNumber && PL_CATEGORIES.includes(rawCat)) {
              pnlStartNumber = acc.number
            }
          }

          sectionBoundaries.sort((a, b) => a.startNumber.localeCompare(b.startNumber))
          const sectionRanges = sectionBoundaries.map((s, i) => ({
            category: s.category,
            startNumber: s.startNumber,
            endBefore:
              i + 1 < sectionBoundaries.length
                ? sectionBoundaries[i + 1].startNumber
                : pnlStartNumber,
          }))

          const getSection = (accNumber: string): string | null => {
            for (let i = sectionRanges.length - 1; i >= 0; i--) {
              const range = sectionRanges[i]
              if (accNumber >= range.startNumber) {
                if (range.endBefore && accNumber >= range.endBefore) return null
                return range.category
              }
            }
            return null
          }

          // 5. Phase 2: Compute totals from posting accounts' GL amounts
          const sectionPostingSums: Record<string, number> = {
            Assets: 0,
            Liabilities: 0,
            Equity: 0,
          }
          const bsAccountsList: any[] = []

          for (const acc of sorted) {
            const accType = decodeOData(acc.accountType || '').toLowerCase()
            if (accType !== 'posting') continue
            const section = getSection(acc.number)
            if (!section) continue
            const rawBal = glByAccount.get(acc.number) ?? 0
            sectionPostingSums[section] += rawBal
            bsAccountsList.push({
              number: acc.number,
              name: acc.displayName,
              section,
              subCategory: acc.subCategory || '',
              rawBalance: rawBal,
              displayBalance: section === 'Assets' ? rawBal : -rawBal,
            })
          }

          // Assets: debit normal (positive). Liabilities/Equity: credit normal (negate).
          const totalAssets = sectionPostingSums.Assets
          const totalLiabilities = -sectionPostingSums.Liabilities
          let totalEquity = -sectionPostingSums.Equity

          // 6. Compute Net Income from P&L accounts (non-BS posting accounts)
          let pnlPostingSum = 0
          for (const acc of sorted) {
            const accType = decodeOData(acc.accountType || '').toLowerCase()
            if (accType !== 'posting') continue
            const section = getSection(acc.number)
            if (section) continue // BS account — skip
            pnlPostingSum += glByAccount.get(acc.number) ?? 0
          }
          const netIncome = -pnlPostingSum
          totalEquity += netIncome

          result = {
            reportType: 'balance_sheet',
            source: endDate ? `gl-entries (cumulative le ${endDate})` : 'gl-entries (all-time)',
            asOfDate: endDate || null,
            summary: {
              totalAssets,
              totalLiabilities,
              totalEquity,
              netIncome,
              totalLiabilitiesPlusEquity: totalLiabilities + totalEquity,
              balanceCheck: Math.round((totalAssets - totalLiabilities - totalEquity) * 100) / 100,
            },
            glEntries: {
              available: !glEntriesError,
              error: glEntriesError,
              count: glEntries.length,
            },
            accounts: {
              total: allAccounts.length,
              bsAccounts: bsAccountsList.length,
              sectionRanges,
              bySectionCount: {
                Assets: bsAccountsList.filter((a) => a.section === 'Assets').length,
                Liabilities: bsAccountsList.filter((a) => a.section === 'Liabilities').length,
                Equity: bsAccountsList.filter((a) => a.section === 'Equity').length,
              },
              list: await (async () => {
                const bsFilterText = [input.filters?.accountCategory, input.filters?.accountName]
                  .filter(Boolean)
                  .join(' ')
                if (!bsFilterText) return bsAccountsList
                const matchingNumbers = await llmFilterAccounts(bsAccountsList, bsFilterText, {
                  name: 'name',
                  number: 'number',
                  category: 'section',
                })
                return bsAccountsList.filter((a: any) => matchingNumbers.has(a.number))
              })(),
            },
          }
          break
        }

        case 'inventory_valuation': {
          // 1. Fetch ALL items then apply filters
          let allItems = await client.listItems()

          // Apply item filters from input.filters
          if (input.filters?.itemName) {
            const nameFilter = input.filters.itemName.toLowerCase()
            allItems = allItems.filter((i: any) =>
              (i.displayName || '').toLowerCase().includes(nameFilter)
            )
          }
          if (input.filters?.itemNo) {
            const noFilter = input.filters.itemNo.toLowerCase()
            allItems = allItems.filter((i: any) =>
              (i.number || '').toLowerCase().includes(noFilter)
            )
          }
          if (input.filters?.itemCategory) {
            const catFilter = input.filters.itemCategory.toLowerCase()
            allItems = allItems.filter((i: any) =>
              (i.itemCategoryCode || '').toLowerCase().includes(catFilter)
            )
          }

          // 2. Compute item-level metrics
          const withStock = allItems.filter((i: any) => (i.inventory ?? 0) > 0)
          const totalUnits = allItems.reduce((s: number, i: any) => s + (i.inventory ?? 0), 0)
          const totalValue = allItems.reduce(
            (s: number, i: any) => s + (i.inventory ?? 0) * (i.unitCost ?? 0),
            0
          )

          // 3. Group by category
          const categoryMap: Record<
            string,
            { count: number; totalUnits: number; totalValue: number }
          > = {}
          for (const item of allItems) {
            const cat = item.itemCategoryCode || 'Uncategorized'
            if (!categoryMap[cat]) categoryMap[cat] = { count: 0, totalUnits: 0, totalValue: 0 }
            categoryMap[cat].count++
            categoryMap[cat].totalUnits += item.inventory ?? 0
            categoryMap[cat].totalValue += (item.inventory ?? 0) * (item.unitCost ?? 0)
          }
          const byCategory = Object.entries(categoryMap)
            .map(([category, data]) => ({ category, ...data }))
            .sort((a, b) => b.totalValue - a.totalValue)

          // 4. Group by type
          const byType: Record<string, number> = {}
          for (const item of allItems) {
            const type = item.type || 'Unknown'
            byType[type] = (byType[type] ?? 0) + 1
          }

          // 5. Top items by value
          const topByValue = [...allItems]
            .sort(
              (a: any, b: any) =>
                (b.inventory ?? 0) * (b.unitCost ?? 0) - (a.inventory ?? 0) * (a.unitCost ?? 0)
            )
            .slice(0, 15)
            .map((i: any) => ({
              number: i.number,
              name: i.displayName || i.number,
              inventory: i.inventory ?? 0,
              unitCost: i.unitCost ?? 0,
              unitPrice: i.unitPrice ?? 0,
              totalValue: Math.round((i.inventory ?? 0) * (i.unitCost ?? 0) * 100) / 100,
              category: i.itemCategoryCode || 'Uncategorized',
              type: i.type || 'Unknown',
            }))

          // 6. Item ledger entries for movement analysis (if dates provided)
          let movementAnalysis: any = null
          const hasItemFilters =
            input.filters?.itemName || input.filters?.itemNo || input.filters?.itemCategory
          if (startDate && endDate) {
            try {
              // Fetch ALL entries up to endDate for opening/closing inventory calculation
              const ledgerEntries = await client.queryAll('itemLedgerEntries', {
                $filter: `postingDate le ${endDate}`,
              })

              // When item filters are active, only include ledger entries for matching items
              const filteredItemNumbers = hasItemFilters
                ? new Set(allItems.map((i: any) => i.number))
                : null

              // Opening / closing inventory value calculation
              let openingValue = 0
              let increaseValue = 0
              let decreaseValue = 0
              let closingValue = 0

              // Monthly movement (only in-period entries)
              const monthlyMap: Record<string, { inbound: number; outbound: number }> = {}
              const itemMovements: Record<
                string,
                { itemNumber: string; totalIn: number; totalOut: number }
              > = {}

              for (const entry of ledgerEntries) {
                const itemNum = entry.itemNumber || entry.itemNo || ''

                // Skip entries for items not in filtered set
                if (filteredItemNumbers && !filteredItemNumbers.has(itemNum)) continue

                const postingDate = entry.postingDate || ''
                const costAmount = entry.costAmountActual ?? 0
                const qty = entry.quantity ?? 0

                // Accumulate closing value (all entries up to endDate)
                closingValue += costAmount

                const isInPeriod = postingDate >= startDate && postingDate <= endDate

                if (postingDate < startDate) {
                  // Pre-period: contributes to opening value
                  openingValue += costAmount
                } else if (isInPeriod) {
                  // In-period: split into increases/decreases
                  if (costAmount > 0) increaseValue += costAmount
                  else decreaseValue += Math.abs(costAmount)
                }

                // Monthly movement analysis — only for in-period entries
                if (!isInPeriod) continue

                const date = postingDate.substring(0, 7) // YYYY-MM
                if (!date) continue

                if (!monthlyMap[date]) monthlyMap[date] = { inbound: 0, outbound: 0 }
                if (qty > 0) monthlyMap[date].inbound += qty
                else monthlyMap[date].outbound += Math.abs(qty)

                if (itemNum) {
                  if (!itemMovements[itemNum])
                    itemMovements[itemNum] = { itemNumber: itemNum, totalIn: 0, totalOut: 0 }
                  if (qty > 0) itemMovements[itemNum].totalIn += qty
                  else itemMovements[itemNum].totalOut += Math.abs(qty)
                }
              }

              // Build name lookup from items
              const itemNameMap = new Map<string, string>()
              for (const item of allItems) {
                if (item.number) itemNameMap.set(item.number, item.displayName || item.number)
              }

              const byMonth = Object.entries(monthlyMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, data]) => ({
                  month,
                  inbound: data.inbound,
                  outbound: data.outbound,
                  net: data.inbound - data.outbound,
                }))

              const topMovedItems = Object.values(itemMovements)
                .sort((a, b) => b.totalIn + b.totalOut - (a.totalIn + a.totalOut))
                .slice(0, 15)
                .map((m) => ({ ...m, itemName: itemNameMap.get(m.itemNumber) || m.itemNumber }))

              // Turnover calculation
              const periodDays =
                (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                (1000 * 60 * 60 * 24)
              const totalOutbound = byMonth.reduce((s, m) => s + m.outbound, 0)
              const annualizationFactor = periodDays > 0 ? 365 / periodDays : 1
              const annualizedOutbound = totalOutbound * annualizationFactor
              const inventoryTurnover = totalUnits > 0 ? annualizedOutbound / totalUnits : null
              const dio =
                inventoryTurnover && inventoryTurnover > 0 ? 365 / inventoryTurnover : null

              movementAnalysis = {
                totalEntries: ledgerEntries.length,
                byMonth,
                topMovedItems,
                turnover: {
                  periodDays: Math.round(periodDays),
                  totalOutboundUnits: totalOutbound,
                  annualizedOutbound: Math.round(annualizedOutbound),
                  inventoryTurnover:
                    inventoryTurnover !== null ? Math.round(inventoryTurnover * 100) / 100 : null,
                  daysInventoryOutstanding: dio !== null ? Math.round(dio) : null,
                },
                valuation: {
                  openingValue: Math.round(openingValue * 100) / 100,
                  increaseValue: Math.round(increaseValue * 100) / 100,
                  decreaseValue: Math.round(decreaseValue * 100) / 100,
                  closingValue: Math.round(closingValue * 100) / 100,
                  netMovement: Math.round((increaseValue - decreaseValue) * 100) / 100,
                },
              }
            } catch (err) {
              movementAnalysis = {
                error: err instanceof Error ? err.message : 'Ledger entries not available',
              }
            }
          }

          result = {
            reportType: 'inventory_valuation',
            period: { startDate: startDate || null, endDate: endDate || null },
            summary: {
              totalItems: allItems.length,
              itemsWithStock: withStock.length,
              outOfStock: allItems.length - withStock.length,
              totalUnits,
              totalValue: Math.round(totalValue * 100) / 100,
            },
            byCategory,
            byType,
            topByValue,
            movementAnalysis,
            items: withStock.map((i: any) => ({
              number: i.number,
              name: i.displayName || i.number,
              category: i.itemCategoryCode || 'Uncategorized',
              type: i.type || 'Unknown',
              inventory: i.inventory ?? 0,
              unitCost: i.unitCost ?? 0,
              unitPrice: i.unitPrice ?? 0,
              totalValue: Math.round((i.inventory ?? 0) * (i.unitCost ?? 0) * 100) / 100,
              blocked: i.blocked || false,
            })),
          }
          break
        }

        case 'cash_flow': {
          // Indirect cash flow using accounts + GL entries
          const cfAccounts = await client.queryAll('accounts')
          const cfSorted = [...cfAccounts].sort((a: any, b: any) =>
            (a.number || '').localeCompare(b.number || '')
          )

          // Classify accounts by activity
          type Activity = 'operating' | 'investing' | 'financing' | 'cash' | 'skip'
          const cfAccountMap = new Map<
            string,
            { category: string; subCategory: string; displayName: string; activity: Activity }
          >()

          for (const acc of cfSorted) {
            if (!acc.number) continue
            const accType = decodeOData(acc.accountType || '').toLowerCase()
            if (accType !== 'posting') continue

            const category = decodeOData(acc.category || '').trim()
            const sub = decodeOData(acc.subCategory || 'General').toLowerCase()
            let activity: Activity = 'skip'

            if (
              category === 'Income' ||
              category === 'Expense' ||
              category === 'Cost of Goods Sold'
            ) {
              activity = 'operating'
            } else if (category === 'Assets') {
              if (
                sub.includes('cash') ||
                sub.includes('bank') ||
                sub.includes('checking') ||
                sub.includes('savings')
              ) {
                activity = 'cash'
              } else if (
                sub.includes('receivable') ||
                sub.includes('inventory') ||
                (sub.includes('current') &&
                  !sub.includes('non-current') &&
                  !sub.includes('noncurrent') &&
                  !sub.includes('non current')) ||
                sub.includes('prepaid')
              ) {
                activity = 'operating'
              } else {
                activity = 'investing'
              }
            } else if (category === 'Liabilities') {
              if (
                sub.includes('payable') ||
                sub.includes('accrued') ||
                (sub.includes('current') &&
                  !sub.includes('non-current') &&
                  !sub.includes('noncurrent') &&
                  !sub.includes('non current'))
              ) {
                activity = 'operating'
              } else {
                activity = 'financing'
              }
            } else if (category === 'Equity') {
              activity = 'financing'
            }

            cfAccountMap.set(acc.number, {
              category,
              subCategory: decodeOData(acc.subCategory || 'General'),
              displayName: acc.displayName || acc.number,
              activity,
            })
          }

          const cashAccountNums = new Set<string>()
          for (const [num, meta] of cfAccountMap) {
            if (meta.activity === 'cash') cashAccountNums.add(num)
          }

          // Fetch 3 GL entry sets in parallel
          const [beginCashEntries, periodEntries, endCashEntries] = await Promise.all([
            startDate
              ? client.listGeneralLedgerEntries({
                  $select: 'accountNumber,debitAmount,creditAmount',
                  $filter: `postingDate lt ${startDate}`,
                })
              : Promise.resolve([]),
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
            endDate
              ? client.listGeneralLedgerEntries({
                  $select: 'accountNumber,debitAmount,creditAmount',
                  $filter: `postingDate le ${endDate}`,
                })
              : client.listGeneralLedgerEntries({
                  $select: 'accountNumber,debitAmount,creditAmount',
                }),
          ])

          // Beginning and ending cash
          let beginningCash = 0
          for (const e of beginCashEntries) {
            if (cashAccountNums.has(e.accountNumber))
              beginningCash += (e.debitAmount ?? 0) - (e.creditAmount ?? 0)
          }
          let endingCash = 0
          for (const e of endCashEntries) {
            if (cashAccountNums.has(e.accountNumber))
              endingCash += (e.debitAmount ?? 0) - (e.creditAmount ?? 0)
          }

          // Process period entries
          let cfRevenue = 0,
            cfExpenses = 0,
            cfDepreciation = 0
          let arChange = 0,
            inventoryChange = 0,
            apChange = 0,
            otherOperating = 0
          let fixedAssetChange = 0,
            otherInvesting = 0
          let debtChange = 0,
            equityChange = 0

          // Track per-account amounts for the accounts table
          const cfAccountAmounts = new Map<string, number>()

          for (const entry of periodEntries) {
            const meta = cfAccountMap.get(entry.accountNumber)
            if (!meta || meta.activity === 'skip' || meta.activity === 'cash') continue
            const debit = entry.debitAmount ?? 0
            const credit = entry.creditAmount ?? 0
            const sub = meta.subCategory.toLowerCase()

            // Accumulate per-account
            cfAccountAmounts.set(
              entry.accountNumber,
              (cfAccountAmounts.get(entry.accountNumber) ?? 0) + (debit - credit)
            )

            if (meta.category === 'Income') {
              cfRevenue += credit - debit
            } else if (meta.category === 'Expense' || meta.category === 'Cost of Goods Sold') {
              if (
                sub.includes('depreciation') ||
                meta.displayName.toLowerCase().includes('depreciation')
              ) {
                cfDepreciation += debit - credit
              } else {
                cfExpenses += debit - credit
              }
            } else if (meta.category === 'Assets' && meta.activity === 'operating') {
              const change = credit - debit
              if (sub.includes('receivable')) arChange += change
              else if (sub.includes('inventory')) inventoryChange += change
              else otherOperating += change
            } else if (meta.category === 'Assets' && meta.activity === 'investing') {
              if (
                sub.includes('depreciation') ||
                meta.displayName.toLowerCase().includes('depreciation')
              ) {
                cfDepreciation += credit - debit
              } else if (
                sub.includes('investment') ||
                sub.includes('securities') ||
                sub.includes('bonds')
              ) {
                otherInvesting += debit - credit
              } else {
                fixedAssetChange += debit - credit
              }
            } else if (meta.category === 'Liabilities' && meta.activity === 'operating') {
              const change = credit - debit
              if (sub.includes('payable')) apChange += change
              else otherOperating += change
            } else if (meta.category === 'Liabilities' && meta.activity === 'financing') {
              debtChange += credit - debit
            } else if (meta.category === 'Equity') {
              equityChange += credit - debit
            }
          }

          const cfNetIncome = cfRevenue - cfExpenses - cfDepreciation
          const totalOperating =
            cfNetIncome + cfDepreciation + arChange + inventoryChange + apChange + otherOperating
          const totalInvesting = -fixedAssetChange - otherInvesting
          const totalFinancing = debtChange + equityChange
          const netCashChange = totalOperating + totalInvesting + totalFinancing

          // Build accounts list for the table
          const cfAccountsList: any[] = []
          for (const [accNo, meta] of cfAccountMap) {
            if (meta.activity === 'skip') continue
            const amount = cfAccountAmounts.get(accNo) ?? 0
            // Include cash accounts (with 0 period amount) and non-cash accounts with activity
            if (meta.activity === 'cash' || amount !== 0) {
              cfAccountsList.push({
                number: accNo,
                name: meta.displayName,
                category: meta.category,
                activity: meta.activity,
                subCategory: meta.subCategory,
                amount: Math.round(amount * 100) / 100,
              })
            }
          }

          // Apply LLM filter on accounts
          const cfFilterText = [input.filters?.accountCategory, input.filters?.accountName]
            .filter(Boolean)
            .join(' ')
          let cfFilteredAccounts = cfAccountsList
          if (cfFilterText) {
            const matchingNumbers = await llmFilterAccounts(cfAccountsList, cfFilterText, {
              name: 'name',
              number: 'number',
              category: 'activity',
            })
            cfFilteredAccounts = cfAccountsList.filter((a: any) => matchingNumbers.has(a.number))
          }

          result = {
            reportType: 'cash_flow',
            source: 'gl-entries-indirect',
            period: { startDate: startDate || null, endDate: endDate || null },
            summary: {
              beginningCash: Math.round(beginningCash * 100) / 100,
              totalOperating: Math.round(totalOperating * 100) / 100,
              totalInvesting: Math.round(totalInvesting * 100) / 100,
              totalFinancing: Math.round(totalFinancing * 100) / 100,
              netCashChange: Math.round(netCashChange * 100) / 100,
              endingCash: Math.round(endingCash * 100) / 100,
            },
            operatingActivities: {
              netIncome: Math.round(cfNetIncome * 100) / 100,
              depreciation: Math.round(cfDepreciation * 100) / 100,
              arChange: Math.round(arChange * 100) / 100,
              inventoryChange: Math.round(inventoryChange * 100) / 100,
              apChange: Math.round(apChange * 100) / 100,
              otherOperating: Math.round(otherOperating * 100) / 100,
              totalOperating: Math.round(totalOperating * 100) / 100,
            },
            investingActivities: {
              capitalExpenditures: Math.round(Math.min(-fixedAssetChange, 0) * 100) / 100,
              assetSales: Math.round(Math.max(-fixedAssetChange, 0) * 100) / 100,
              otherInvesting: Math.round(-otherInvesting * 100) / 100,
              totalInvesting: Math.round(totalInvesting * 100) / 100,
            },
            financingActivities: {
              debtProceeds: Math.round(Math.max(debtChange, 0) * 100) / 100,
              debtRepayments: Math.round(Math.min(debtChange, 0) * 100) / 100,
              equityChanges: Math.round(equityChange * 100) / 100,
              totalFinancing: Math.round(totalFinancing * 100) / 100,
            },
            glEntries: {
              beginCash: beginCashEntries.length,
              period: periodEntries.length,
              endCash: endCashEntries.length,
            },
            accounts: {
              total: cfAccountsList.length,
              list: cfFilteredAccounts,
            },
          }
          break
        }

        case 'aged_receivables': {
          // Open sales invoices aged by due date
          const arFilterParts = ["status eq 'Open'"]
          if (input.filters?.customerName) {
            arFilterParts.push(
              `contains(customerName, '${input.filters.customerName.replace(/'/g, "''")}')`
            )
          }
          const openSalesInvoices = await client.listSalesInvoices({
            $filter: arFilterParts.join(' and '),
          })

          const now = new Date()
          const arBuckets = {
            current: 0,
            days_1_30: 0,
            days_31_60: 0,
            days_61_90: 0,
            days_over_90: 0,
            total: 0,
          }
          for (const inv of openSalesInvoices) {
            const amount = inv.totalAmountIncludingTax ?? inv.totalAmount ?? 0
            if (amount === 0) continue
            arBuckets.total += amount
            const dueDateStr = inv.dueDate || inv.postingDate
            if (!dueDateStr) {
              arBuckets.current += amount
              continue
            }
            const daysPastDue = Math.floor(
              (now.getTime() - new Date(dueDateStr).getTime()) / (1000 * 60 * 60 * 24)
            )
            if (daysPastDue <= 0) arBuckets.current += amount
            else if (daysPastDue <= 30) arBuckets.days_1_30 += amount
            else if (daysPastDue <= 60) arBuckets.days_31_60 += amount
            else if (daysPastDue <= 90) arBuckets.days_61_90 += amount
            else arBuckets.days_over_90 += amount
          }

          const arCustomerSet = new Set(
            openSalesInvoices.map((inv: any) => inv.customerNumber || inv.customerId)
          )

          // Build per-customer aggregation
          const arByCustomer = new Map<
            string,
            { name: string; total: number; invoiceCount: number }
          >()
          const arInvoiceList = openSalesInvoices
            .filter((inv: any) => (inv.totalAmountIncludingTax ?? inv.totalAmount ?? 0) !== 0)
            .map((inv: any) => {
              const custKey = inv.customerNumber || inv.customerId || 'Unknown'
              const custName = inv.customerName || custKey
              const amount = inv.totalAmountIncludingTax ?? inv.totalAmount ?? 0
              const dueDateStr = inv.dueDate || inv.postingDate
              const daysPastDue = dueDateStr
                ? Math.floor(
                    (now.getTime() - new Date(dueDateStr).getTime()) / (1000 * 60 * 60 * 24)
                  )
                : 0
              if (!arByCustomer.has(custKey))
                arByCustomer.set(custKey, { name: custName, total: 0, invoiceCount: 0 })
              const cust = arByCustomer.get(custKey)!
              cust.total += amount
              cust.invoiceCount++
              return {
                customerNumber: custKey,
                customerName: custName,
                invoiceNumber: inv.number,
                dueDate: inv.dueDate,
                amount,
                daysPastDue: Math.max(daysPastDue, 0),
              }
            })
            .sort((a: any, b: any) => b.amount - a.amount)

          const arTopCustomers = [...arByCustomer.values()]
            .sort((a, b) => b.total - a.total)
            .slice(0, 10)
            .map((c) => ({
              name: c.name,
              total: Math.round(c.total * 100) / 100,
              invoiceCount: c.invoiceCount,
            }))

          result = {
            reportType: 'aged_receivables',
            period: { startDate: startDate || null, endDate: endDate || null },
            summary: {
              totalCustomers: arCustomerSet.size,
              totalInvoices: arInvoiceList.length,
              totalBalance: Math.round(arBuckets.total * 100) / 100,
              current: Math.round(arBuckets.current * 100) / 100,
              days_1_30: Math.round(arBuckets.days_1_30 * 100) / 100,
              days_31_60: Math.round(arBuckets.days_31_60 * 100) / 100,
              days_61_90: Math.round(arBuckets.days_61_90 * 100) / 100,
              days_over_90: Math.round(arBuckets.days_over_90 * 100) / 100,
            },
            topCustomers: arTopCustomers,
            invoices: arInvoiceList,
          }
          break
        }

        case 'aged_payables': {
          // Open purchase invoices aged by due date
          const apFilterParts = ["status eq 'Open'"]
          if (input.filters?.vendorName) {
            apFilterParts.push(
              `contains(vendorName, '${input.filters.vendorName.replace(/'/g, "''")}')`
            )
          }
          const openPurchaseInvoices = await client.listPurchaseInvoices({
            $filter: apFilterParts.join(' and '),
          })

          const apNow = new Date()
          const apBuckets = {
            current: 0,
            days_1_30: 0,
            days_31_60: 0,
            days_61_90: 0,
            days_over_90: 0,
            total: 0,
          }
          for (const inv of openPurchaseInvoices) {
            const amount = inv.totalAmountIncludingTax ?? inv.totalAmount ?? 0
            if (amount === 0) continue
            apBuckets.total += amount
            const dueDateStr = inv.dueDate || inv.postingDate
            if (!dueDateStr) {
              apBuckets.current += amount
              continue
            }
            const daysPastDue = Math.floor(
              (apNow.getTime() - new Date(dueDateStr).getTime()) / (1000 * 60 * 60 * 24)
            )
            if (daysPastDue <= 0) apBuckets.current += amount
            else if (daysPastDue <= 30) apBuckets.days_1_30 += amount
            else if (daysPastDue <= 60) apBuckets.days_31_60 += amount
            else if (daysPastDue <= 90) apBuckets.days_61_90 += amount
            else apBuckets.days_over_90 += amount
          }

          const apVendorSet = new Set(
            openPurchaseInvoices.map((inv: any) => inv.vendorNumber || inv.vendorId)
          )

          // Build per-vendor aggregation
          const apByVendor = new Map<
            string,
            { name: string; total: number; invoiceCount: number }
          >()
          const apInvoiceList = openPurchaseInvoices
            .filter((inv: any) => (inv.totalAmountIncludingTax ?? inv.totalAmount ?? 0) !== 0)
            .map((inv: any) => {
              const vendKey = inv.vendorNumber || inv.vendorId || 'Unknown'
              const vendName = inv.vendorName || vendKey
              const amount = inv.totalAmountIncludingTax ?? inv.totalAmount ?? 0
              const dueDateStr = inv.dueDate || inv.postingDate
              const daysPastDue = dueDateStr
                ? Math.floor(
                    (apNow.getTime() - new Date(dueDateStr).getTime()) / (1000 * 60 * 60 * 24)
                  )
                : 0
              if (!apByVendor.has(vendKey))
                apByVendor.set(vendKey, { name: vendName, total: 0, invoiceCount: 0 })
              const vend = apByVendor.get(vendKey)!
              vend.total += amount
              vend.invoiceCount++
              return {
                vendorNumber: vendKey,
                vendorName: vendName,
                invoiceNumber: inv.number,
                dueDate: inv.dueDate,
                amount,
                daysPastDue: Math.max(daysPastDue, 0),
              }
            })
            .sort((a: any, b: any) => b.amount - a.amount)

          const apTopVendors = [...apByVendor.values()]
            .sort((a, b) => b.total - a.total)
            .slice(0, 10)
            .map((v) => ({
              name: v.name,
              total: Math.round(v.total * 100) / 100,
              invoiceCount: v.invoiceCount,
            }))

          result = {
            reportType: 'aged_payables',
            period: { startDate: startDate || null, endDate: endDate || null },
            summary: {
              totalVendors: apVendorSet.size,
              totalInvoices: apInvoiceList.length,
              totalBalance: Math.round(apBuckets.total * 100) / 100,
              current: Math.round(apBuckets.current * 100) / 100,
              days_1_30: Math.round(apBuckets.days_1_30 * 100) / 100,
              days_31_60: Math.round(apBuckets.days_31_60 * 100) / 100,
              days_61_90: Math.round(apBuckets.days_61_90 * 100) / 100,
              days_over_90: Math.round(apBuckets.days_over_90 * 100) / 100,
            },
            topVendors: apTopVendors,
            invoices: apInvoiceList,
          }
          break
        }

        case 'trial_balance': {
          // Use accounts + GL entries (trialBalance endpoint doesn't exist in v2.0 API)
          const tbAllAccounts = await client.queryAll('accounts')
          const tbSorted = [...tbAllAccounts].sort((a: any, b: any) =>
            (a.number || '').localeCompare(b.number || '')
          )

          // Fetch GL entries for the period
          const tbGlParams: Record<string, any> = {
            $select: 'accountNumber,debitAmount,creditAmount',
          }
          if (startDate && endDate) {
            tbGlParams.$filter = `postingDate ge ${startDate} and postingDate le ${endDate}`
          }
          const tbGlEntries = await client.listGeneralLedgerEntries(tbGlParams)

          // Aggregate GL by account number (separate debits and credits)
          const tbGlDebits = new Map<string, number>()
          const tbGlCredits = new Map<string, number>()
          for (const entry of tbGlEntries) {
            const accNo = entry.accountNumber
            if (!accNo) continue
            tbGlDebits.set(accNo, (tbGlDebits.get(accNo) ?? 0) + (entry.debitAmount ?? 0))
            tbGlCredits.set(accNo, (tbGlCredits.get(accNo) ?? 0) + (entry.creditAmount ?? 0))
          }

          // Build accounts list with debits/credits from GL
          const tbByCategory = new Map<
            string,
            { totalDebits: number; totalCredits: number; netBalance: number; count: number }
          >()
          const tbAccountsList: any[] = []

          for (const acc of tbSorted) {
            if (!acc.number) continue
            const accType = decodeOData(acc.accountType || '').toLowerCase()
            if (accType !== 'posting') continue

            const debit = tbGlDebits.get(acc.number) ?? 0
            const credit = tbGlCredits.get(acc.number) ?? 0
            if (debit === 0 && credit === 0) continue

            const net = debit - credit
            const category = decodeOData(acc.category || 'Uncategorized').trim()

            if (!tbByCategory.has(category))
              tbByCategory.set(category, {
                totalDebits: 0,
                totalCredits: 0,
                netBalance: 0,
                count: 0,
              })
            const cat = tbByCategory.get(category)!
            cat.totalDebits += debit
            cat.totalCredits += credit
            cat.netBalance += net
            cat.count++

            tbAccountsList.push({
              number: acc.number,
              name: acc.displayName || acc.number,
              category,
              debit: Math.round(debit * 100) / 100,
              credit: Math.round(credit * 100) / 100,
              netBalance: Math.round(net * 100) / 100,
            })
          }

          const totalDebits = tbAccountsList.reduce((s: number, a: any) => s + a.debit, 0)
          const totalCredits = tbAccountsList.reduce((s: number, a: any) => s + a.credit, 0)

          const tbCategorySummary = [...tbByCategory.entries()]
            .map(([category, vals]) => ({
              category,
              totalDebits: Math.round(vals.totalDebits * 100) / 100,
              totalCredits: Math.round(vals.totalCredits * 100) / 100,
              netBalance: Math.round(vals.netBalance * 100) / 100,
              count: vals.count,
            }))
            .sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance))

          // Apply LLM filter — category recomputes KPIs, name only narrows list
          let tbCategoryFiltered = tbAccountsList
          if (input.filters?.accountCategory) {
            const matchingNumbers = await llmFilterAccounts(
              tbAccountsList,
              input.filters.accountCategory,
              { name: 'name', number: 'number', category: 'category' }
            )
            tbCategoryFiltered = tbAccountsList.filter((a: any) => matchingNumbers.has(a.number))
          }

          const tbFilteredDebits = tbCategoryFiltered.reduce((s: number, a: any) => s + a.debit, 0)
          const tbFilteredCredits = tbCategoryFiltered.reduce(
            (s: number, a: any) => s + a.credit,
            0
          )

          let tbFilteredAccounts = tbCategoryFiltered
          if (input.filters?.accountName) {
            const matchingNumbers = await llmFilterAccounts(
              tbCategoryFiltered,
              input.filters.accountName,
              { name: 'name', number: 'number', category: 'category' }
            )
            tbFilteredAccounts = tbCategoryFiltered.filter((a: any) =>
              matchingNumbers.has(a.number)
            )
          }

          result = {
            reportType: 'trial_balance',
            source: 'gl-entries',
            period: { startDate: startDate || null, endDate: endDate || null },
            summary: {
              totalAccounts: tbAllAccounts.length,
              accountsWithActivity: tbAccountsList.length,
              totalDebits: Math.round(tbFilteredDebits * 100) / 100,
              totalCredits: Math.round(tbFilteredCredits * 100) / 100,
              netBalance: Math.round((tbFilteredDebits - tbFilteredCredits) * 100) / 100,
              isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
            },
            byCategory: tbCategorySummary,
            accounts: {
              total: tbAccountsList.length,
              list: tbFilteredAccounts,
            },
          }
          break
        }

        case 'sales_by_customer': {
          // 1. Fetch ALL customers to seed the map (so 0-invoice customers still appear)
          const sbcCustomerFilter: string[] = []
          if (input.filters?.customerName) {
            sbcCustomerFilter.push(
              `contains(displayName, '${input.filters.customerName.replace(/'/g, "''")}')`
            )
          }
          const sbcAllCustomers = await client.listCustomers({
            $select: 'id,number,displayName,email,phoneNumber,balanceDue,creditLimit,currencyCode',
            ...(sbcCustomerFilter.length > 0 ? { $filter: sbcCustomerFilter.join(' and ') } : {}),
          })

          // 2. Build invoice filters (by postingDate, all posted invoices — accrual basis)
          const sbcFilterParts: string[] = []
          if (startDate && endDate) {
            sbcFilterParts.push(`postingDate ge ${startDate} and postingDate le ${endDate}`)
          } else if (startDate) {
            sbcFilterParts.push(`postingDate ge ${startDate}`)
          } else if (endDate) {
            sbcFilterParts.push(`postingDate le ${endDate}`)
          }
          if (input.filters?.customerName) {
            sbcFilterParts.push(
              `contains(customerName, '${input.filters.customerName.replace(/'/g, "''")}')`
            )
          }
          const sbcParams: Record<string, any> = {
            $select:
              'number,customerNumber,customerName,postingDate,totalAmountIncludingTax,status',
          }
          if (sbcFilterParts.length > 0) sbcParams.$filter = sbcFilterParts.join(' and ')

          const sbcInvoices = await client.listSalesInvoices(sbcParams)

          // 3. Fetch credit memos (returns) in same date range
          let sbcCreditMemos: any[] = []
          let sbcCreditMemosError: string | null = null
          try {
            const cmFilterParts: string[] = []
            if (startDate && endDate) {
              cmFilterParts.push(`postingDate ge ${startDate} and postingDate le ${endDate}`)
            } else if (startDate) {
              cmFilterParts.push(`postingDate ge ${startDate}`)
            } else if (endDate) {
              cmFilterParts.push(`postingDate le ${endDate}`)
            }
            if (input.filters?.customerName) {
              cmFilterParts.push(
                `contains(customerName, '${input.filters.customerName.replace(/'/g, "''")}')`
              )
            }
            const cmParams: Record<string, any> = {
              $select: 'number,customerNumber,customerName,postingDate,totalAmountIncludingTax',
            }
            if (cmFilterParts.length > 0) cmParams.$filter = cmFilterParts.join(' and ')
            sbcCreditMemos = await client.queryAll('salesCreditMemos', cmParams)
          } catch (err) {
            sbcCreditMemosError = err instanceof Error ? err.message : 'Credit memos not available'
          }

          // 4. Seed map with ALL customers at 0 so they always appear in results
          const sbcArBalance = new Map<string, number>()
          const sbcByCustomer = new Map<
            string,
            {
              customerNumber: string
              customerName: string
              totalSales: number
              totalReturns: number
              invoiceCount: number
              creditMemoCount: number
            }
          >()

          for (const c of sbcAllCustomers) {
            if (!c.number) continue
            sbcArBalance.set(c.number, c.balanceDue ?? 0)
            sbcByCustomer.set(c.number, {
              customerNumber: c.number,
              customerName: c.displayName || c.number,
              totalSales: 0,
              totalReturns: 0,
              invoiceCount: 0,
              creditMemoCount: 0,
            })
          }

          // 5. Accumulate invoices
          for (const inv of sbcInvoices) {
            const custKey = inv.customerNumber || inv.customerId || 'Unknown'
            const custName = inv.customerName || custKey
            const amount = inv.totalAmountIncludingTax ?? 0
            if (!sbcByCustomer.has(custKey)) {
              sbcByCustomer.set(custKey, {
                customerNumber: custKey,
                customerName: custName,
                totalSales: 0,
                totalReturns: 0,
                invoiceCount: 0,
                creditMemoCount: 0,
              })
            }
            const cust = sbcByCustomer.get(custKey)!
            cust.totalSales += amount
            cust.invoiceCount++
          }

          // 6. Accumulate credit memos
          for (const cm of sbcCreditMemos) {
            const custKey = cm.customerNumber || cm.customerId || 'Unknown'
            const custName = cm.customerName || custKey
            const amount = cm.totalAmountIncludingTax ?? 0
            if (!sbcByCustomer.has(custKey)) {
              sbcByCustomer.set(custKey, {
                customerNumber: custKey,
                customerName: custName,
                totalSales: 0,
                totalReturns: 0,
                invoiceCount: 0,
                creditMemoCount: 0,
              })
            }
            const cust = sbcByCustomer.get(custKey)!
            cust.totalReturns += amount
            cust.creditMemoCount++
          }

          // 7. Build customer list, filter out blank/Unknown entries, apply amount filters, sort
          let sbcCustomerList = [...sbcByCustomer.values()]
            .filter((c) => c.customerNumber !== 'Unknown')
            .map((c) => ({
              customerNumber: c.customerNumber,
              customerName: c.customerName,
              invoiceCount: c.invoiceCount,
              creditMemoCount: c.creditMemoCount,
              totalSales: Math.round(c.totalSales * 100) / 100,
              totalReturns: Math.round(c.totalReturns * 100) / 100,
              netSales: Math.round((c.totalSales - c.totalReturns) * 100) / 100,
              arBalance: Math.round((sbcArBalance.get(c.customerNumber) ?? 0) * 100) / 100,
            }))
            .sort((a, b) => b.netSales - a.netSales)

          if (input.filters?.minAmount != null) {
            sbcCustomerList = sbcCustomerList.filter((c) => c.netSales >= input.filters.minAmount)
          }
          if (input.filters?.maxAmount != null) {
            sbcCustomerList = sbcCustomerList.filter((c) => c.netSales <= input.filters.maxAmount)
          }

          const sbcLimit = input.limit ?? 100
          const sbcTopCustomers = sbcCustomerList.slice(0, 10).map((c) => ({
            name: c.customerName,
            total: c.netSales,
            invoiceCount: c.invoiceCount,
          }))

          // 8. Invoice list sorted by amount desc
          const sbcInvoiceList = sbcInvoices
            .map((inv: any) => ({
              invoiceNumber: inv.number,
              customerNumber: inv.customerNumber || inv.customerId || 'Unknown',
              customerName: inv.customerName || 'Unknown',
              postingDate: inv.postingDate,
              amount: Math.round((inv.totalAmountIncludingTax ?? inv.totalAmount ?? 0) * 100) / 100,
              status: inv.status || 'Posted',
            }))
            .sort((a: any, b: any) => b.amount - a.amount)
            .slice(0, sbcLimit)

          // 9. Summary totals
          const sbcTotalSales = sbcCustomerList.reduce((s, c) => s + c.totalSales, 0)
          const sbcTotalReturns = sbcCustomerList.reduce((s, c) => s + c.totalReturns, 0)

          result = {
            reportType: 'sales_by_customer',
            period: { startDate: startDate || null, endDate: endDate || null },
            summary: {
              totalCustomers: sbcCustomerList.length,
              totalInvoices: sbcInvoices.length,
              totalCreditMemos: sbcCreditMemos.length,
              totalSales: Math.round(sbcTotalSales * 100) / 100,
              totalReturns: Math.round(sbcTotalReturns * 100) / 100,
              netSales: Math.round((sbcTotalSales - sbcTotalReturns) * 100) / 100,
              totalArBalance:
                Math.round(sbcCustomerList.reduce((s, c) => s + (c.arBalance ?? 0), 0) * 100) / 100,
            },
            creditMemos: {
              available: !sbcCreditMemosError,
              error: sbcCreditMemosError,
              count: sbcCreditMemos.length,
            },
            topCustomers: sbcTopCustomers,
            customers: sbcCustomerList.slice(0, sbcLimit),
            invoices: sbcInvoiceList,
          }
          break
        }

        case 'purchases_by_vendor': {
          // 1. Fetch ALL vendors
          const pbvVendorFilter: string[] = []
          if (input.filters?.vendorName) {
            pbvVendorFilter.push(
              `contains(displayName, '${input.filters.vendorName.replace(/'/g, "''")}')`
            )
          }
          const pbvAllVendors = await client.listVendors({
            $select: 'id,number,displayName,email,phoneNumber,balance,currencyCode',
            ...(pbvVendorFilter.length > 0 ? { $filter: pbvVendorFilter.join(' and ') } : {}),
          })

          // 2. Build purchase invoice filters (by postingDate)
          const pbvFilterParts: string[] = []
          if (startDate && endDate) {
            pbvFilterParts.push(`postingDate ge ${startDate} and postingDate le ${endDate}`)
          } else if (startDate) {
            pbvFilterParts.push(`postingDate ge ${startDate}`)
          } else if (endDate) {
            pbvFilterParts.push(`postingDate le ${endDate}`)
          }
          if (input.filters?.vendorName) {
            pbvFilterParts.push(
              `contains(vendorName, '${input.filters.vendorName.replace(/'/g, "''")}')`
            )
          }

          const pbvParams: Record<string, any> = {
            $select: 'number,vendorNumber,vendorName,postingDate,totalAmountIncludingTax,status',
          }
          if (pbvFilterParts.length > 0) pbvParams.$filter = pbvFilterParts.join(' and ')

          const pbvInvoices = await client.listPurchaseInvoices(pbvParams)

          // 3. Fetch purchase credit memos (returns)
          let pbvCreditMemos: any[] = []
          let pbvCreditMemosError: string | null = null
          try {
            const pbvCmDateParts: string[] = []
            if (startDate && endDate) {
              pbvCmDateParts.push(`postingDate ge ${startDate} and postingDate le ${endDate}`)
            } else if (startDate) {
              pbvCmDateParts.push(`postingDate ge ${startDate}`)
            } else if (endDate) {
              pbvCmDateParts.push(`postingDate le ${endDate}`)
            }
            const pbvCmParams: Record<string, any> = {}
            if (pbvCmDateParts.length > 0) pbvCmParams.$filter = pbvCmDateParts.join(' and ')
            pbvCreditMemos = await client.queryAll('purchaseCreditMemos', pbvCmParams)
          } catch (err) {
            pbvCreditMemosError =
              err instanceof Error ? err.message : 'Purchase credit memos not available'
          }

          // 4. Seed map with ALL vendors at 0
          const pbvApBalance = new Map<string, number>()
          const pbvByVendor = new Map<
            string,
            {
              vendorNumber: string
              vendorName: string
              totalPurchases: number
              totalReturns: number
              invoiceCount: number
              creditMemoCount: number
            }
          >()

          for (const v of pbvAllVendors) {
            if (!v.number) continue
            pbvApBalance.set(v.number, v.balance ?? 0)
            pbvByVendor.set(v.number, {
              vendorNumber: v.number,
              vendorName: v.displayName || v.number,
              totalPurchases: 0,
              totalReturns: 0,
              invoiceCount: 0,
              creditMemoCount: 0,
            })
          }

          // 5. Accumulate purchase invoices
          for (const inv of pbvInvoices) {
            const vendorKey =
              inv.vendorNumber || inv.buyFromVendorNumber || inv.vendorId || 'Unknown'
            const vendorName = inv.vendorName || inv.buyFromVendorName || vendorKey
            const amount = inv.totalAmountIncludingTax ?? 0
            if (!pbvByVendor.has(vendorKey)) {
              pbvByVendor.set(vendorKey, {
                vendorNumber: vendorKey,
                vendorName,
                totalPurchases: 0,
                totalReturns: 0,
                invoiceCount: 0,
                creditMemoCount: 0,
              })
            }
            const vendor = pbvByVendor.get(vendorKey)!
            vendor.totalPurchases += amount
            vendor.invoiceCount++
          }

          // 6. Accumulate credit memos
          for (const cm of pbvCreditMemos) {
            const vendorKey = cm.vendorNumber || cm.buyFromVendorNumber || cm.vendorId || 'Unknown'
            const vendorName = cm.vendorName || cm.buyFromVendorName || vendorKey
            const amount = cm.totalAmountIncludingTax ?? 0
            if (!pbvByVendor.has(vendorKey)) {
              pbvByVendor.set(vendorKey, {
                vendorNumber: vendorKey,
                vendorName,
                totalPurchases: 0,
                totalReturns: 0,
                invoiceCount: 0,
                creditMemoCount: 0,
              })
            }
            const vendor = pbvByVendor.get(vendorKey)!
            vendor.totalReturns += amount
            vendor.creditMemoCount++
          }

          // 7. Build vendor list, filter, sort
          let pbvVendorList = [...pbvByVendor.values()]
            .filter((v) => v.vendorNumber !== 'Unknown')
            .map((v) => ({
              vendorNumber: v.vendorNumber,
              vendorName: v.vendorName,
              invoiceCount: v.invoiceCount,
              creditMemoCount: v.creditMemoCount,
              totalPurchases: Math.round(v.totalPurchases * 100) / 100,
              totalReturns: Math.round(v.totalReturns * 100) / 100,
              netPurchases: Math.round((v.totalPurchases - v.totalReturns) * 100) / 100,
              apBalance: Math.round((pbvApBalance.get(v.vendorNumber) ?? 0) * 100) / 100,
            }))
            .sort((a, b) => b.netPurchases - a.netPurchases)

          if (input.filters?.minAmount != null) {
            pbvVendorList = pbvVendorList.filter((v) => v.netPurchases >= input.filters.minAmount)
          }
          if (input.filters?.maxAmount != null) {
            pbvVendorList = pbvVendorList.filter((v) => v.netPurchases <= input.filters.maxAmount)
          }

          const pbvLimit = input.limit ?? 100
          const pbvTopVendors = pbvVendorList.slice(0, 10).map((v) => ({
            name: v.vendorName,
            total: v.netPurchases,
            invoiceCount: v.invoiceCount,
          }))

          // 8. Invoice list sorted by amount desc
          const pbvInvoiceList = pbvInvoices
            .map((inv: any) => ({
              invoiceNumber: inv.number,
              vendorNumber: inv.vendorNumber || inv.vendorId || 'Unknown',
              vendorName: inv.vendorName || 'Unknown',
              postingDate: inv.postingDate,
              amount: Math.round((inv.totalAmountIncludingTax ?? 0) * 100) / 100,
              status: inv.status || 'Posted',
            }))
            .sort((a: any, b: any) => b.amount - a.amount)
            .slice(0, pbvLimit)

          // 9. Summary totals
          const pbvTotalPurchases = pbvVendorList.reduce((s, v) => s + v.totalPurchases, 0)
          const pbvTotalReturns = pbvVendorList.reduce((s, v) => s + v.totalReturns, 0)

          result = {
            reportType: 'purchases_by_vendor',
            period: { startDate: startDate || null, endDate: endDate || null },
            summary: {
              totalVendors: pbvVendorList.length,
              totalInvoices: pbvInvoices.length,
              totalCreditMemos: pbvCreditMemos.length,
              totalPurchases: Math.round(pbvTotalPurchases * 100) / 100,
              totalReturns: Math.round(pbvTotalReturns * 100) / 100,
              netPurchases: Math.round((pbvTotalPurchases - pbvTotalReturns) * 100) / 100,
              totalApBalance:
                Math.round(pbvVendorList.reduce((s, v) => s + (v.apBalance ?? 0), 0) * 100) / 100,
            },
            creditMemos: {
              available: !pbvCreditMemosError,
              error: pbvCreditMemosError,
              count: pbvCreditMemos.length,
            },
            topVendors: pbvTopVendors,
            vendors: pbvVendorList.slice(0, pbvLimit),
            invoices: pbvInvoiceList,
          }
          break
        }

        case 'sales_by_item': {
          // Build date filter for invoice headers
          const sbiDateParts: string[] = []
          if (startDate && endDate) {
            sbiDateParts.push(`postingDate ge ${startDate} and postingDate le ${endDate}`)
          } else if (startDate) {
            sbiDateParts.push(`postingDate ge ${startDate}`)
          } else if (endDate) {
            sbiDateParts.push(`postingDate le ${endDate}`)
          }

          // 1. Fetch invoices + lines via $expand
          // BC OData v2.0: salesInvoiceLine uses amountExcludingTax (not lineAmount)
          const sbiInvParams: Record<string, any> = {
            $select: 'number,postingDate,customerNumber,customerName',
            $expand:
              'salesInvoiceLines($select=lineObjectNumber,description,quantity,unitPrice,amountExcludingTax)',
          }
          if (sbiDateParts.length > 0) sbiInvParams.$filter = sbiDateParts.join(' and ')

          const sbiInvoices = await client.listSalesInvoices(sbiInvParams)

          // 2. Fetch credit memo lines via $expand (graceful fallback)
          let sbiCreditMemos: any[] = []
          let sbiCreditMemosError: string | null = null
          try {
            const sbiCmParams: Record<string, any> = {
              $select: 'number,postingDate,customerNumber,customerName',
              $expand:
                'salesCreditMemoLines($select=lineObjectNumber,description,quantity,amountExcludingTax)',
            }
            if (sbiDateParts.length > 0) sbiCmParams.$filter = sbiDateParts.join(' and ')
            sbiCreditMemos = await client.queryAll('salesCreditMemos', sbiCmParams)
          } catch (err) {
            sbiCreditMemosError = err instanceof Error ? err.message : 'Credit memos unavailable'
          }

          // 3. Aggregate by item number
          const sbiByItem = new Map<
            string,
            {
              itemNumber: string
              itemName: string
              totalQuantity: number
              totalSales: number
              totalReturnQty: number
              totalReturns: number
              invoiceCount: number
              creditMemoCount: number
            }
          >()

          const ensureItem = (key: string, name: string) => {
            if (!sbiByItem.has(key)) {
              sbiByItem.set(key, {
                itemNumber: key,
                itemName: name,
                totalQuantity: 0,
                totalSales: 0,
                totalReturnQty: 0,
                totalReturns: 0,
                invoiceCount: 0,
                creditMemoCount: 0,
              })
            }
            return sbiByItem.get(key)!
          }

          for (const inv of sbiInvoices) {
            const lines: any[] = inv.salesInvoiceLines || []
            for (const line of lines) {
              const key = line.lineObjectNumber
              if (!key) continue // skip non-item lines (GL, resource, etc.)
              const item = ensureItem(key, line.description || key)
              item.totalQuantity += line.quantity ?? 0
              item.totalSales += line.amountExcludingTax ?? 0
              item.invoiceCount++
            }
          }

          for (const cm of sbiCreditMemos) {
            const lines: any[] = cm.salesCreditMemoLines || []
            for (const line of lines) {
              const key = line.lineObjectNumber
              if (!key) continue
              const item = ensureItem(key, line.description || key)
              item.totalReturnQty += line.quantity ?? 0
              item.totalReturns += line.amountExcludingTax ?? 0
              item.creditMemoCount++
            }
          }

          // 4. Apply item filters, build list, sort
          let sbiItemList = [...sbiByItem.values()].map((it) => ({
            itemNumber: it.itemNumber,
            itemName: it.itemName,
            invoiceCount: it.invoiceCount,
            creditMemoCount: it.creditMemoCount,
            totalQuantity: Math.round(it.totalQuantity * 1000) / 1000,
            totalSales: Math.round(it.totalSales * 100) / 100,
            totalReturnQty: Math.round(it.totalReturnQty * 1000) / 1000,
            totalReturns: Math.round(it.totalReturns * 100) / 100,
            netSales: Math.round((it.totalSales - it.totalReturns) * 100) / 100,
            netQuantity: Math.round((it.totalQuantity - it.totalReturnQty) * 1000) / 1000,
          }))

          // Apply item number / name filters
          if (input.filters?.itemNo) {
            const q = input.filters.itemNo.toLowerCase()
            sbiItemList = sbiItemList.filter((it) => it.itemNumber.toLowerCase().includes(q))
          }
          if (input.filters?.itemName) {
            const q = input.filters.itemName.toLowerCase()
            sbiItemList = sbiItemList.filter((it) => it.itemName.toLowerCase().includes(q))
          }
          if (input.filters?.minAmount != null) {
            sbiItemList = sbiItemList.filter((it) => it.netSales >= input.filters.minAmount)
          }
          if (input.filters?.maxAmount != null) {
            sbiItemList = sbiItemList.filter((it) => it.netSales <= input.filters.maxAmount)
          }

          sbiItemList.sort((a, b) => b.netSales - a.netSales)

          const sbiLimit = input.limit ?? 100
          const sbiTopItems = sbiItemList.slice(0, 10).map((it) => ({
            name: it.itemName,
            number: it.itemNumber,
            total: it.netSales,
            quantity: it.netQuantity,
          }))

          const sbiTotalSales = sbiItemList.reduce((s, it) => s + it.totalSales, 0)
          const sbiTotalReturns = sbiItemList.reduce((s, it) => s + it.totalReturns, 0)

          result = {
            reportType: 'sales_by_item',
            period: { startDate: startDate || null, endDate: endDate || null },
            summary: {
              totalItems: sbiItemList.length,
              totalInvoiceLines: sbiInvoices.reduce(
                (s, inv) => s + (inv.salesInvoiceLines?.length ?? 0),
                0
              ),
              totalCreditMemoLines: sbiCreditMemos.reduce(
                (s, cm) => s + (cm.salesCreditMemoLines?.length ?? 0),
                0
              ),
              totalSales: Math.round(sbiTotalSales * 100) / 100,
              totalReturns: Math.round(sbiTotalReturns * 100) / 100,
              netSales: Math.round((sbiTotalSales - sbiTotalReturns) * 100) / 100,
            },
            creditMemos: {
              available: !sbiCreditMemosError,
              error: sbiCreditMemosError,
            },
            topItems: sbiTopItems,
            items: sbiItemList.slice(0, sbiLimit),
          }
          break
        }

        case 'purchases_by_item': {
          // Build date filter for purchase invoice headers
          const pbiDateParts: string[] = []
          if (startDate && endDate) {
            pbiDateParts.push(`postingDate ge ${startDate} and postingDate le ${endDate}`)
          } else if (startDate) {
            pbiDateParts.push(`postingDate ge ${startDate}`)
          } else if (endDate) {
            pbiDateParts.push(`postingDate le ${endDate}`)
          }

          // 1. Fetch purchase invoices + lines via $expand
          // BC purchase invoice lines use directUnitCost (not unitPrice) and amountExcludingTax
          const pbiInvParams: Record<string, any> = {
            $select: 'number,postingDate',
            // No $select on lines — field names vary by BC version
            // (amountExcludingTax vs lineAmount vs amount)
            $expand: 'purchaseInvoiceLines',
          }
          if (pbiDateParts.length > 0) pbiInvParams.$filter = pbiDateParts.join(' and ')

          const pbiInvoices = await client.listPurchaseInvoices(pbiInvParams)

          // 2. Fetch purchase credit memos + lines via $expand (graceful fallback)
          let pbiCreditMemos: any[] = []
          let pbiCreditMemosError: string | null = null
          try {
            const pbiCmParams: Record<string, any> = {
              // No $select on lines — field names vary by BC version
              $expand: 'purchaseCreditMemoLines',
            }
            if (pbiDateParts.length > 0) pbiCmParams.$filter = pbiDateParts.join(' and ')
            pbiCreditMemos = await client.queryAll('purchaseCreditMemos', pbiCmParams)
          } catch (err) {
            pbiCreditMemosError = err instanceof Error ? err.message : 'Credit memos unavailable'
          }

          // 3. Aggregate by item number
          const pbiByItem = new Map<
            string,
            {
              itemNumber: string
              itemName: string
              totalQuantity: number
              totalCost: number
              totalReturnQty: number
              totalReturns: number
              invoiceCount: number
              creditMemoCount: number
            }
          >()

          const ensurePbiItem = (key: string, name: string) => {
            if (!pbiByItem.has(key)) {
              pbiByItem.set(key, {
                itemNumber: key,
                itemName: name,
                totalQuantity: 0,
                totalCost: 0,
                totalReturnQty: 0,
                totalReturns: 0,
                invoiceCount: 0,
                creditMemoCount: 0,
              })
            }
            return pbiByItem.get(key)!
          }

          // BC purchase line amount field varies by version: try all known variants
          // netAmount comes first — some BC instances have amountExcludingTax=0 with correct value in netAmount
          const pbiLineAmount = (line: any): number =>
            line.netAmount ?? line.lineAmount ?? line.amountExcludingTax ?? line.amount ?? 0

          for (const inv of pbiInvoices) {
            const lines: any[] = inv.purchaseInvoiceLines || []
            for (const line of lines) {
              const key = line.lineObjectNumber
              if (!key) continue // skip non-item lines (GL, resource, etc.)
              const item = ensurePbiItem(key, line.description || key)
              item.totalQuantity += line.quantity ?? 0
              item.totalCost += pbiLineAmount(line)
              item.invoiceCount++
            }
          }

          for (const cm of pbiCreditMemos) {
            const lines: any[] = cm.purchaseCreditMemoLines || []
            for (const line of lines) {
              const key = line.lineObjectNumber
              if (!key) continue
              const item = ensurePbiItem(key, line.description || key)
              item.totalReturnQty += line.quantity ?? 0
              item.totalReturns += pbiLineAmount(line)
              item.creditMemoCount++
            }
          }

          // 4. Apply filters, build list, sort by net cost desc
          let pbiItemList = [...pbiByItem.values()].map((it) => ({
            itemNumber: it.itemNumber,
            itemName: it.itemName,
            invoiceCount: it.invoiceCount,
            creditMemoCount: it.creditMemoCount,
            totalQuantity: Math.round(it.totalQuantity * 1000) / 1000,
            totalCost: Math.round(it.totalCost * 100) / 100,
            totalReturnQty: Math.round(it.totalReturnQty * 1000) / 1000,
            totalReturns: Math.round(it.totalReturns * 100) / 100,
            netCost: Math.round((it.totalCost - it.totalReturns) * 100) / 100,
            netQuantity: Math.round((it.totalQuantity - it.totalReturnQty) * 1000) / 1000,
          }))

          if (input.filters?.itemNo) {
            const q = input.filters.itemNo.toLowerCase()
            pbiItemList = pbiItemList.filter((it) => it.itemNumber.toLowerCase().includes(q))
          }
          if (input.filters?.itemName) {
            const q = input.filters.itemName.toLowerCase()
            pbiItemList = pbiItemList.filter((it) => it.itemName.toLowerCase().includes(q))
          }
          if (input.filters?.minAmount != null) {
            pbiItemList = pbiItemList.filter((it) => it.netCost >= input.filters.minAmount)
          }
          if (input.filters?.maxAmount != null) {
            pbiItemList = pbiItemList.filter((it) => it.netCost <= input.filters.maxAmount)
          }

          pbiItemList.sort((a, b) => b.netCost - a.netCost)

          const pbiLimit = input.limit ?? 100
          const pbiTopItems = pbiItemList.slice(0, 10).map((it) => ({
            name: it.itemName,
            number: it.itemNumber,
            total: it.netCost,
            quantity: it.netQuantity,
          }))

          const pbiTotalCost = pbiItemList.reduce((s, it) => s + it.totalCost, 0)
          const pbiTotalReturns = pbiItemList.reduce((s, it) => s + it.totalReturns, 0)

          // Debug: capture sample line to inspect actual BC field names
          const pbiSampleLine =
            pbiInvoices.find((inv: any) => inv.purchaseInvoiceLines?.length > 0)
              ?.purchaseInvoiceLines?.[0] ?? null

          result = {
            reportType: 'purchases_by_item',
            _debug: {
              sampleLineKeys: pbiSampleLine ? Object.keys(pbiSampleLine) : [],
              sampleLine: pbiSampleLine,
            },
            period: { startDate: startDate || null, endDate: endDate || null },
            summary: {
              totalItems: pbiItemList.length,
              totalInvoiceLines: pbiInvoices.reduce(
                (s, inv) => s + (inv.purchaseInvoiceLines?.length ?? 0),
                0
              ),
              totalCreditMemoLines: pbiCreditMemos.reduce(
                (s, cm) => s + (cm.purchaseCreditMemoLines?.length ?? 0),
                0
              ),
              totalCost: Math.round(pbiTotalCost * 100) / 100,
              totalReturns: Math.round(pbiTotalReturns * 100) / 100,
              netCost: Math.round((pbiTotalCost - pbiTotalReturns) * 100) / 100,
            },
            creditMemos: {
              available: !pbiCreditMemosError,
              error: pbiCreditMemosError,
            },
            topItems: pbiTopItems,
            items: pbiItemList.slice(0, pbiLimit),
          }
          break
        }

        default:
          result = { error: `Report type "${reportType}" not yet supported in diagnostic` }
      }
    } else {
      result = {
        error: `Query type "${queryType}" not yet supported in diagnostic. Only "report" with "profit_loss" is supported.`,
      }
    }

    const durationMs = Date.now() - startTime

    return NextResponse.json({
      success: true,
      result,
      durationMs,
      requestPayload: input,
      connection: {
        connectionId: resolvedConnectionId,
        companyName: creds.company_name,
        environmentName: creds.environment_name,
        currency: creds.home_currency,
      },
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    logger.error('BC agent diagnostic failed', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs,
        requestPayload: input,
      },
      { status: 500 }
    )
  }
})
