// src/ai/tools/business-central-data/bc-api-handlers.ts
/**
 * Handlers for executing BC queries via the direct BC API (OAuth path).
 * Uses GL entries + chart of accounts hierarchy for accurate P&L reporting.
 * Returns data in the same BCQueryResult shape so the AI sees consistent output.
 */

import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import type { BCDataInput, BCQueryResult } from './types'
import { logger } from '@/lib/logger'
import { createLLM } from '@/lib/llm'
import { resolveMetricName } from './metrics-registry'

// ─── Performance Profiler ────────────────────────────────────────────────────
// Tracks per-step timing so you can see exactly where time is spent per company.
// Logs a full breakdown at the end of each query.

class QueryProfiler {
  private steps: Array<{
    name: string
    startMs: number
    endMs: number | undefined
    meta?: Record<string, any>
  }> = []
  private readonly queryStart = Date.now()
  private readonly context: {
    organizationId: string
    connectionId: string
    queryType: string
    reportType?: string
  }

  constructor(context: {
    organizationId: string
    connectionId: string
    queryType: string
    reportType?: string
  }) {
    this.context = context
  }

  step(name: string): { end: (meta?: Record<string, any>) => void } {
    const entry: {
      name: string
      startMs: number
      endMs: number | undefined
      meta?: Record<string, any>
    } = { name, startMs: Date.now(), endMs: undefined }
    this.steps.push(entry)
    return {
      end: (meta?: Record<string, any>) => {
        entry.endMs = Date.now()
        if (meta) entry.meta = meta
      },
    }
  }

  finish(): Record<string, any> {
    const totalMs = Date.now() - this.queryStart
    const breakdown = this.steps.map((s) => {
      const durationMs = (s.endMs || Date.now()) - s.startMs
      return {
        step: s.name,
        durationMs,
        durationPretty:
          durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(2)}s`,
        ...(s.meta || {}),
      }
    })

    const profile = {
      organizationId: this.context.organizationId.substring(0, 12) + '...',
      connectionId: this.context.connectionId,
      queryType: this.context.queryType,
      reportType: this.context.reportType,
      totalMs,
      totalPretty: totalMs < 1000 ? `${totalMs}ms` : `${(totalMs / 1000).toFixed(2)}s`,
      steps: breakdown,
      slowestStep:
        breakdown.length > 0
          ? breakdown.reduce((a, b) => (a.durationMs > b.durationMs ? a : b))
          : null,
    }

    // Always log the profile — this is how you diagnose per-company differences
    logger.info('[BC:Perf] Query profile', profile)

    // Warn if total exceeds 10 seconds
    if (totalMs > 10000) {
      logger.warn('[BC:Perf] SLOW QUERY detected', {
        organizationId: this.context.organizationId,
        connectionId: this.context.connectionId,
        totalMs,
        slowestStep: profile.slowestStep,
      })
    }

    return profile
  }
}

/**
 * LLM-powered account filter. Sends the user's filter text + account list
 * to the LLM and returns the set of matching account numbers.
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

/** BS categories */
const BS_CATEGORIES = ['Assets', 'Liabilities', 'Equity']
/** P&L categories used for account classification */
const PL_CATEGORIES = ['Income', 'Revenue', 'Expense', 'Cost of Goods Sold']
const ALL_CATEGORIES = [...BS_CATEGORIES, ...PL_CATEGORIES]

/**
 * Classify BC accounts by activity (operating/investing/financing/cash/skip).
 * Mirrors cash-flow-indirect route logic: infers category for accounts with
 * empty `category` fields and detects cash accounts by parent section name.
 */
interface ClassifiedAccount {
  category: string
  subCategory: string
  displayName: string
  activity: 'operating' | 'investing' | 'financing' | 'cash' | 'skip'
}

function classifyBCAccounts(allAccounts: any[]): Map<string, ClassifiedAccount> {
  const sorted = [...allAccounts].sort((a: any, b: any) =>
    (a.number || '').localeCompare(b.number || '')
  )

  // 1. Build section boundaries from Begin-Total accounts for category inference
  const sectionBoundaries: Array<{ category: string; startNumber: string }> = []
  for (const acc of sorted) {
    const at = decodeOData(acc.accountType || '').toLowerCase()
    if (at !== 'begin-total') continue
    const rawCat = decodeOData(acc.category || '').trim()
    const name = (acc.displayName || acc.number || '').trim()
    if (ALL_CATEGORIES.includes(rawCat)) {
      sectionBoundaries.push({ category: rawCat, startNumber: acc.number })
    } else if (!rawCat || rawCat === ' ') {
      const lowerName = name.toLowerCase()
      for (const cat of ALL_CATEGORIES) {
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

  // 2. Build parent section name map (for cash account detection by section context)
  const parentSectionNameMap = new Map<string, string>()
  const nameStack: string[] = []
  for (const acc of sorted) {
    const at = decodeOData(acc.accountType || '').toLowerCase()
    const name = decodeOData(acc.displayName || acc.number || '').trim()
    if (at === 'begin-total') {
      nameStack.push(name)
    } else if (at === 'end-total' || at === 'total') {
      nameStack.pop()
    } else if (at === 'posting' && nameStack.length > 0) {
      parentSectionNameMap.set(acc.number, nameStack[nameStack.length - 1])
    }
  }

  // 3. Classify each posting account
  const accountMap = new Map<string, ClassifiedAccount>()
  const isCurrentSub = (s: string) =>
    s.includes('current') &&
    !s.includes('non-current') &&
    !s.includes('noncurrent') &&
    !s.includes('non current')

  for (const acc of allAccounts) {
    if (!acc.number) continue
    const accType = decodeOData(acc.accountType || '').toLowerCase()
    if (accType !== 'posting') continue

    let category = decodeOData(acc.category || '').trim()
    const subCategory = decodeOData(acc.subCategory || 'General').toLowerCase()
    const displayName = acc.displayName || acc.number
    const parentSectionName = parentSectionNameMap.get(acc.number) || null

    // Infer category when empty
    if (!category) {
      const inferred = inferSection(acc.number)
      if (inferred) category = inferred
    }

    let activity: ClassifiedAccount['activity'] = 'skip'

    if (category === 'Income' || category === 'Revenue' || category === 'Expense') {
      activity = 'operating'
    } else if (category === 'Cost of Goods Sold') {
      activity = 'operating'
    } else if (category === 'Assets') {
      const isCashBySub =
        subCategory.includes('cash') ||
        subCategory.includes('bank') ||
        subCategory.includes('checking') ||
        subCategory.includes('savings')
      const isCashByParent =
        parentSectionName !== null && /cash|bank|checking|savings/i.test(parentSectionName)
      if (isCashBySub || isCashByParent) {
        activity = 'cash'
      } else if (/clearing|transit/i.test(displayName)) {
        activity = 'operating'
      } else if (
        subCategory.includes('receivable') ||
        subCategory.includes('inventory') ||
        isCurrentSub(subCategory) ||
        subCategory.includes('prepaid') ||
        subCategory.includes('due from') ||
        subCategory.includes('due to') ||
        subCategory.includes('related companies') ||
        subCategory.includes('intercompany')
      ) {
        activity = 'operating'
      } else {
        activity = 'investing'
      }
    } else if (category === 'Liabilities') {
      if (
        subCategory.includes('payable') ||
        subCategory.includes('accrued') ||
        isCurrentSub(subCategory) ||
        subCategory.includes('due from') ||
        subCategory.includes('due to') ||
        subCategory.includes('related companies') ||
        subCategory.includes('intercompany')
      ) {
        activity = 'operating'
      } else {
        activity = 'financing'
      }
    } else if (category === 'Equity') {
      activity = 'financing'
    }

    accountMap.set(acc.number, {
      category,
      subCategory: decodeOData(acc.subCategory || 'General'),
      displayName,
      activity,
    })
  }

  return accountMap
}

interface BCApiContext {
  organizationId: string
  connectionId: string
  tenantId: string
  environmentName: string
  companyId: string
  currency?: string
  companyName?: string
  correlationId?: string
}

/** Minimal $select for accounts — only fields needed for hierarchy + classification */
const ACCOUNTS_SELECT = 'number,displayName,accountType,category,subCategory'

/**
 * Execute a BC query via direct API (for OAuth-connected clients).
 */
export async function executeBCApiQuery(
  input: BCDataInput,
  context: BCApiContext
): Promise<BCQueryResult> {
  const profiler = new QueryProfiler({
    organizationId: context.organizationId,
    connectionId: context.connectionId,
    queryType: input.queryType,
    reportType: input.reportType || undefined,
  })

  try {
    const tokenStep = profiler.step('token_warmup')
    const client = new BusinessCentralClient({
      organizationId: context.organizationId,
      connectionId: context.connectionId,
    })
    // Pre-warm token before the query so parallel fetches don't compete for the lock
    await client.warmUp()
    tokenStep.end()

    let result: BCQueryResult

    const queryStep = profiler.step(
      `query_${input.queryType}${input.reportType ? '_' + input.reportType : ''}`
    )
    switch (input.queryType) {
      case 'report':
        result = await handleReportQuery(client, input, context, profiler)
        break
      case 'entity':
        result = await handleEntityQuery(client, input, context)
        break
      case 'metric':
        result = await handleMetricQuery(client, input, context, profiler)
        break
      case 'search':
        result = await handleSearchQuery(client, input, context)
        break
      case 'detail':
        result = await handleDetailQuery(client, input, context, profiler)
        break
      default:
        result = await handleEntityQuery(client, input, context)
    }
    queryStep.end()

    const profile = profiler.finish()
    result.metadata = {
      ...result.metadata,
      executionTimeMs: profile.totalMs,
      dataSource: 'bc_api_direct',
      environment: context.environmentName,
      performanceProfile: profile,
    }

    return result
  } catch (error: any) {
    profiler.finish() // still log the profile on error
    logger.error('BC API query failed', {
      organizationId: context.organizationId,
      queryType: input.queryType,
      error: error.message,
    })

    return {
      success: false,
      queryType: input.queryType,
      data: [],
      summary: { error: error.message },
      currency: context.currency,
      sources: ['Business Central API'],
      generated: new Date().toISOString(),
      error: error.message,
    }
  }
}

/**
 * Handle report queries: trial_balance, profit_loss, balance_sheet, etc.
 */
async function handleReportQuery(
  client: BusinessCentralClient,
  input: BCDataInput,
  context: BCApiContext,
  profiler?: QueryProfiler
): Promise<BCQueryResult> {
  const reportType = input.reportType
  let data: any[] = []
  let summary: Record<string, any> = {}
  let reportCurrencyOverride: string | undefined

  // Resolve dates from input.startDate/endDate or input.period
  const { startDate, endDate } = resolveDates(input)
  const dateFilter = startDate && endDate ? `${startDate}..${endDate}` : null

  switch (reportType) {
    case 'trial_balance': {
      data = await client.getTrialBalance({
        $filter: dateFilter ? `dateFilter eq '${dateFilter}'` : undefined,
      })
      summary = {
        reportType: 'trial_balance',
        totalAccounts: data.length,
        totalDebits: data.reduce((sum: number, r: any) => sum + (r.totalDebitAmount || 0), 0),
        totalCredits: data.reduce((sum: number, r: any) => sum + (r.totalCreditAmount || 0), 0),
      }
      break
    }

    case 'profit_loss':
    case 'monthly_pnl_trend': {
      // ═══ GL Entries + Chart of Accounts Hierarchy ═══
      // Fetches raw GL entries and all accounts, walks Begin-Total/End-Total
      // hierarchy to classify accounts into Income/COGS/Expense, then aggregates.

      // 1. Fetch ALL accounts (need accountType for hierarchy walk) + GL entries in parallel
      const pnlFetchStep = profiler?.step('pnl_fetch_accounts_and_gl')
      let glEntries: any[] = []
      let glEntriesError: string | null = null
      const glParams: Record<string, any> = {
        $select: 'accountNumber,debitAmount,creditAmount,postingDate',
      }
      if (startDate && endDate) {
        glParams.$filter = `postingDate ge ${startDate} and postingDate le ${endDate}`
      }

      const [allAccounts, glResult] = await Promise.all([
        client.queryAll('accounts', { $select: ACCOUNTS_SELECT }),
        client.listGeneralLedgerEntries(glParams).catch((err) => {
          glEntriesError = err instanceof Error ? err.message : 'GL entries not available'
          return [] as any[]
        }),
      ])
      glEntries = glResult
      pnlFetchStep?.end({ accountCount: allAccounts.length, glEntryCount: glEntries.length })

      // 3. Aggregate GL by account number
      const glByAccount = new Map<string, number>()
      for (const entry of glEntries) {
        const accNo = entry.accountNumber
        if (!accNo) continue
        const net = (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)
        glByAccount.set(accNo, (glByAccount.get(accNo) ?? 0) + net)
      }

      // 4. Walk chart of accounts hierarchy (Begin-Total/End-Total markers)
      const sorted = [...allAccounts].sort((a: any, b: any) =>
        (a.number || '').localeCompare(b.number || '')
      )

      const accountCategoryMap = new Map<string, string>()
      let globalDepth = 0
      let inPLSection = false
      let plSectionCategory = ''
      const plAccountsList: any[] = []
      const sectionTotals: { category: string; total: number }[] = []
      const sumStack: number[] = []
      let relativeDepth = 0

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
          accountCategoryMap.set(acc.number, plSectionCategory)
          if (relativeDepth > 0 && nc !== 0) {
            sumStack[relativeDepth - 1] = (sumStack[relativeDepth - 1] ?? 0) + nc
          }
          plAccountsList.push({
            number: acc.number,
            name: acc.displayName,
            category: plSectionCategory,
            subCategory: decodeOData(acc.subCategory || ''),
            glAmount: nc,
          })
        }
      }

      // 5. Compute totals from section End-Totals
      let totalRevenue = 0
      let totalCOGS = 0
      let totalExpenses = 0
      for (const st of sectionTotals) {
        if (st.category === 'Income' || st.category === 'Revenue')
          totalRevenue += Math.abs(st.total)
        else if (st.category === 'Cost of Goods Sold') totalCOGS += Math.abs(st.total)
        else if (st.category === 'Expense') totalExpenses += Math.abs(st.total)
      }
      const grossProfit = totalRevenue - totalCOGS
      const netIncome = grossProfit - totalExpenses

      // 5b. Classify expense sub-components for operating income & EBITDA
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
      for (const acc of plAccountsList) {
        if (acc.category !== 'Expense') continue
        const sub = (acc.subCategory || '').trim()
        const nameAndSub = `${acc.name} ${sub}`
        const amt = Math.abs(acc.glAmount || 0)
        if (!ACCUMULATED_RE.test(acc.name) && DA_RE.test(nameAndSub)) {
          depreciationAmortization += amt
        } else if (INTEREST_RE.test(nameAndSub)) {
          interestExpense += amt
        } else if (TAX_RE.test(nameAndSub)) {
          taxExpense += amt
        } else if (NON_OPERATING_RE.test(acc.name) || (sub && NON_OPERATING_SUB_RE.test(sub))) {
          otherNonOperating += amt
        }
      }
      const nonOperatingTotal = interestExpense + taxExpense + otherNonOperating
      const operatingExpenses = totalExpenses - nonOperatingTotal
      const operatingIncome = grossProfit - operatingExpenses
      const ebitda = operatingIncome + depreciationAmortization

      // 6. Monthly breakdown (for monthly_pnl_trend)
      let monthlyTrend: any[] | null = null
      if (reportType === 'monthly_pnl_trend' && !glEntriesError) {
        const monthlyMap = new Map<string, { revenue: number; cogs: number; expenses: number }>()

        for (const entry of glEntries) {
          const accNo = entry.accountNumber
          if (!accNo) continue
          const cat = accountCategoryMap.get(accNo)
          if (!cat) continue

          const month = (entry.postingDate || '').substring(0, 7)
          if (!month) continue

          if (!monthlyMap.has(month)) monthlyMap.set(month, { revenue: 0, cogs: 0, expenses: 0 })
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

      // 7. Compute margins
      const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
      const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0

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
      data = categoryFiltered
      if (nameFilter) {
        const matchingNumbers = await llmFilterAccounts(categoryFiltered, nameFilter, {
          name: 'name',
          number: 'number',
          category: 'category',
        })
        data = categoryFiltered.filter((a: any) => matchingNumbers.has(a.number))
      }

      // Recompute KPI summary from category-filtered accounts (not name-filtered)
      let displayRevenue = totalRevenue
      let displayCOGS = totalCOGS
      let displayExpenses = totalExpenses
      if (categoryFilter) {
        displayRevenue = 0
        displayCOGS = 0
        displayExpenses = 0
        for (const acc of categoryFiltered) {
          const amt = Math.abs(acc.glAmount || 0)
          if (acc.category === 'Income') displayRevenue += amt
          else if (acc.category === 'Cost of Goods Sold') displayCOGS += amt
          else if (acc.category === 'Expense') displayExpenses += amt
        }
      }
      const displayGrossProfit = displayRevenue - displayCOGS
      const displayNetIncome = displayGrossProfit - displayExpenses
      const displayGrossMargin =
        displayRevenue > 0 ? (displayGrossProfit / displayRevenue) * 100 : 0
      const displayNetMargin = displayRevenue > 0 ? (displayNetIncome / displayRevenue) * 100 : 0

      const displayOperatingExpenses = displayExpenses - interestExpense - taxExpense
      const displayOperatingIncome = displayGrossProfit - displayOperatingExpenses
      const displayEbitda = displayOperatingIncome + depreciationAmortization
      const displayOperatingMargin =
        displayRevenue > 0 ? (displayOperatingIncome / displayRevenue) * 100 : 0
      const displayEbitdaMargin = displayRevenue > 0 ? (displayEbitda / displayRevenue) * 100 : 0

      summary = {
        reportType,
        revenue: Math.round(displayRevenue * 100) / 100,
        cogs: Math.round(displayCOGS * 100) / 100,
        grossProfit: Math.round(displayGrossProfit * 100) / 100,
        operatingExpenses: Math.round(displayOperatingExpenses * 100) / 100,
        operatingIncome: Math.round(displayOperatingIncome * 100) / 100,
        expenses: Math.round(displayExpenses * 100) / 100,
        netIncome: Math.round(displayNetIncome * 100) / 100,
        interestExpense: Math.round(interestExpense * 100) / 100,
        taxExpense: Math.round(taxExpense * 100) / 100,
        depreciationAmortization: Math.round(depreciationAmortization * 100) / 100,
        ebitda: Math.round(displayEbitda * 100) / 100,
        grossMargin: displayGrossMargin.toFixed(1) + '%',
        netMargin: displayNetMargin.toFixed(1) + '%',
        operatingMargin: displayOperatingMargin.toFixed(1) + '%',
        ebitdaMargin: displayEbitdaMargin.toFixed(1) + '%',
        totalAccounts: data.length,
        totalGLEntries: glEntries.length,
        sectionTotals,
        period: { startDate: startDate || null, endDate: endDate || null },
        ...(monthlyTrend ? { monthlyTrend } : {}),
        ...(glEntriesError ? { glEntriesError } : {}),
      }
      break
    }

    case 'balance_sheet': {
      // ═══ GL Entries + Chart of Accounts Hierarchy Walk ═══
      // Uses Begin-Total/End-Total depth tracking (same technique as P&L) to
      // precisely match BC's own report grouping. The previous range-based approach
      // included accounts outside End-Total boundaries, inflating section totals.

      // 1. Fetch accounts + GL entries in parallel
      const bsFetchStep = profiler?.step('bs_fetch_accounts_and_gl')
      const bsGlParams: Record<string, any> = {
        $select: 'accountNumber,debitAmount,creditAmount',
      }
      const bsEndDate = endDate || input.endDate || null
      if (bsEndDate) {
        bsGlParams.$filter = `postingDate le ${bsEndDate}`
      }

      const [bsAllAccounts, bsGlEntries] = await Promise.all([
        client.queryAll('accounts', { $select: ACCOUNTS_SELECT }),
        client.listGeneralLedgerEntries(bsGlParams),
      ])
      bsFetchStep?.end({ accountCount: bsAllAccounts.length, glEntryCount: bsGlEntries.length })

      const bsSorted = [...bsAllAccounts].sort((a: any, b: any) =>
        (a.number || '').localeCompare(b.number || '')
      )

      // 3. Aggregate GL by account number
      const bsGlByAccount = new Map<string, number>()
      for (const entry of bsGlEntries) {
        const accNo = entry.accountNumber
        if (!accNo) continue
        const net = (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)
        bsGlByAccount.set(accNo, (bsGlByAccount.get(accNo) ?? 0) + net)
      }

      // 4. Hierarchy walk — classify posting accounts into BS sections
      //    Only accounts INSIDE a Begin-Total/End-Total pair get classified.
      const bsSectionSums: Record<string, number> = { Assets: 0, Liabilities: 0, Equity: 0 }
      const bsAccountsList: any[] = []
      let bsGlobalDepth = 0
      let bsInSection = false
      let bsSectionCategory = ''
      let bsRelativeDepth = 0

      for (const acc of bsSorted) {
        const accType = decodeOData(acc.accountType || '').toLowerCase()
        const rawCat = decodeOData(acc.category || '').trim()
        const displayName = (acc.displayName || acc.number || '').trim()

        // Check if this Begin-Total starts a BS section (by category or display name)
        const resolvedBSCat = BS_CATEGORIES.includes(rawCat)
          ? rawCat
          : !rawCat || rawCat === ' '
            ? BS_CATEGORIES.find(
                (cat) =>
                  displayName.toLowerCase() === cat.toLowerCase() ||
                  displayName.toLowerCase().startsWith(cat.toLowerCase())
              ) || ''
            : ''

        if (accType === 'begin-total') {
          if (!bsInSection && bsGlobalDepth === 0 && resolvedBSCat) {
            bsInSection = true
            bsSectionCategory = resolvedBSCat
            bsRelativeDepth = 1
          } else if (bsInSection) {
            bsRelativeDepth++
          }
          bsGlobalDepth++
        } else if (accType === 'end-total' || accType === 'total') {
          bsGlobalDepth = Math.max(0, bsGlobalDepth - 1)
          if (bsInSection) {
            bsRelativeDepth = Math.max(0, bsRelativeDepth - 1)
            if (bsRelativeDepth === 0 && bsGlobalDepth === 0) {
              bsInSection = false
            }
          }
        } else if (bsInSection && accType === 'posting') {
          const rawBal = bsGlByAccount.get(acc.number) ?? 0
          bsSectionSums[bsSectionCategory] += rawBal
          bsAccountsList.push({
            number: acc.number,
            name: acc.displayName,
            section: bsSectionCategory,
            balance: bsSectionCategory === 'Assets' ? rawBal : -rawBal,
          })
        }
      }

      // Assets: debit normal (positive). Liabilities/Equity: credit normal (negate).
      const bsTotalAssets = bsSectionSums.Assets
      const bsTotalLiabilities = -bsSectionSums.Liabilities
      let bsTotalEquity = -bsSectionSums.Equity

      // 5. Compute Net Income from P&L accounts (hierarchy walk) and add to Equity
      let bsPnlPostingSum = 0
      let bsInPL = false
      let bsPLDepth = 0
      let bsPLRelDepth = 0

      for (const acc of bsSorted) {
        const accType = decodeOData(acc.accountType || '').toLowerCase()
        const rawCat = decodeOData(acc.category || '').trim()

        if (accType === 'begin-total') {
          if (!bsInPL && bsPLDepth === 0 && PL_CATEGORIES.includes(rawCat)) {
            bsInPL = true
            bsPLRelDepth = 1
          } else if (bsInPL) {
            bsPLRelDepth++
          }
          bsPLDepth++
        } else if (accType === 'end-total' || accType === 'total') {
          bsPLDepth = Math.max(0, bsPLDepth - 1)
          if (bsInPL) {
            bsPLRelDepth = Math.max(0, bsPLRelDepth - 1)
            if (bsPLRelDepth === 0 && bsPLDepth === 0) {
              bsInPL = false
            }
          }
        } else if (bsInPL && accType === 'posting') {
          bsPnlPostingSum += bsGlByAccount.get(acc.number) ?? 0
        }
      }

      const bsNetIncome = -bsPnlPostingSum
      bsTotalEquity += bsNetIncome

      // Apply account-level filters via LLM
      const bsFilterText = [input.filters?.accountCategory, input.filters?.accountName]
        .filter(Boolean)
        .join(' ')
      data = bsAccountsList
      if (bsFilterText) {
        const matchingNumbers = await llmFilterAccounts(bsAccountsList, bsFilterText, {
          name: 'name',
          number: 'number',
          category: 'section',
        })
        data = bsAccountsList.filter((a: any) => matchingNumbers.has(a.number))
      }

      summary = {
        reportType: 'balance_sheet',
        totalAssets: bsTotalAssets,
        totalLiabilities: bsTotalLiabilities,
        equity: bsTotalEquity,
        netIncome: bsNetIncome,
        totalAccounts: data.length,
      }
      break
    }

    case 'cash_flow': {
      // Indirect method using accounts + GL entries (same as cash-flow-indirect endpoint)

      const cfAccountStep = profiler?.step('cf_fetch_accounts')
      const cfAccounts = await client.queryAll('accounts', { $select: ACCOUNTS_SELECT })
      cfAccountStep?.end({ accountCount: cfAccounts.length })

      // Classify accounts using shared helper (matches platform cash-flow-indirect route)
      const cfAccountMap = classifyBCAccounts(cfAccounts)

      const cfStartDate = startDate || input.startDate || null
      const cfEndDate = endDate || input.endDate || null

      const cashAccountNums = new Set<string>()
      for (const [num, meta] of cfAccountMap) {
        if (meta.activity === 'cash') cashAccountNums.add(num)
      }

      // Fetch GL entries in 2 non-overlapping sets instead of 3 overlapping ones.
      // Before: beginEntries (< start) + periodEntries (start..end) + endEntries (<= end)
      // endEntries was a SUPERSET of beginEntries + periodEntries — redundant fetch.
      // Now: fetch begin + period, derive end totals by summing.
      const cfGlStep = profiler?.step('cf_fetch_gl_entries')
      const [beginCashEntries, periodEntries] = await Promise.all([
        cfStartDate
          ? client.listGeneralLedgerEntries({
              $select: 'accountNumber,debitAmount,creditAmount',
              $filter: `postingDate lt ${cfStartDate}`,
            })
          : Promise.resolve([]),
        cfStartDate && cfEndDate
          ? client.listGeneralLedgerEntries({
              $select: 'accountNumber,debitAmount,creditAmount',
              $filter: `postingDate ge ${cfStartDate} and postingDate le ${cfEndDate}`,
            })
          : cfEndDate
            ? client.listGeneralLedgerEntries({
                $select: 'accountNumber,debitAmount,creditAmount',
                $filter: `postingDate le ${cfEndDate}`,
              })
            : client.listGeneralLedgerEntries({
                $select: 'accountNumber,debitAmount,creditAmount',
              }),
      ])
      cfGlStep?.end({
        beginEntryCount: beginCashEntries.length,
        periodEntryCount: periodEntries.length,
      })

      let beginningCash = 0
      for (const e of beginCashEntries) {
        if (cashAccountNums.has(e.accountNumber))
          beginningCash += (e.debitAmount ?? 0) - (e.creditAmount ?? 0)
      }
      // Derive ending cash = beginning cash + period cash movements (no 3rd fetch needed)
      let periodCashChange = 0
      for (const e of periodEntries) {
        if (cashAccountNums.has(e.accountNumber))
          periodCashChange += (e.debitAmount ?? 0) - (e.creditAmount ?? 0)
      }
      let endingCash = beginningCash + periodCashChange

      // ── Net Income: use P&L hierarchy walk (IAS 7 indirect method) ──
      // Per accounting standards, the indirect method starts with net income
      // from the income statement, not recomputed from GL categories.
      const cfSorted = [...cfAccounts].sort((a: any, b: any) =>
        (a.number || '').localeCompare(b.number || '')
      )
      const cfGlByAccount = new Map<string, number>()
      for (const e of periodEntries) {
        if (!e.accountNumber) continue
        cfGlByAccount.set(
          e.accountNumber,
          (cfGlByAccount.get(e.accountNumber) ?? 0) + (e.debitAmount ?? 0) - (e.creditAmount ?? 0)
        )
      }

      // Hierarchy walk for P&L (same as profit_loss report handler)
      const cfAccountCategoryMap = new Map<string, string>()
      let cfGlobalDepth = 0
      let cfInPLSection = false
      let cfPLSectionCategory = ''
      const cfSumStack: number[] = []
      let cfRelativeDepth = 0
      const cfSectionTotals: { category: string; total: number }[] = []

      for (const acc of cfSorted) {
        const accType = decodeOData(acc.accountType || '').toLowerCase()
        const rawCat = decodeOData(acc.category || '').trim()
        const nc = cfGlByAccount.get(acc.number) ?? 0

        if (accType === 'begin-total') {
          if (!cfInPLSection && cfGlobalDepth === 0 && PL_CATEGORIES.includes(rawCat)) {
            cfInPLSection = true
            cfPLSectionCategory = rawCat
            cfRelativeDepth = 0
            cfSumStack[0] = 0
            cfRelativeDepth++
          } else if (cfInPLSection) {
            cfSumStack[cfRelativeDepth] = 0
            cfRelativeDepth++
          }
          cfGlobalDepth++
        } else if (accType === 'end-total' || accType === 'total') {
          cfGlobalDepth = Math.max(0, cfGlobalDepth - 1)
          if (cfInPLSection) {
            cfRelativeDepth = Math.max(0, cfRelativeDepth - 1)
            const totalAmount = cfSumStack[cfRelativeDepth] ?? 0
            if (cfRelativeDepth > 0) {
              cfSumStack[cfRelativeDepth - 1] = (cfSumStack[cfRelativeDepth - 1] ?? 0) + totalAmount
            }
            if (cfRelativeDepth === 0 && cfGlobalDepth === 0) {
              cfSectionTotals.push({ category: cfPLSectionCategory, total: totalAmount })
              cfInPLSection = false
            }
          }
        } else if (cfInPLSection && accType !== 'heading') {
          cfAccountCategoryMap.set(acc.number, cfPLSectionCategory)
          if (cfRelativeDepth > 0 && nc !== 0) {
            cfSumStack[cfRelativeDepth - 1] = (cfSumStack[cfRelativeDepth - 1] ?? 0) + nc
          }
        }
      }

      let cfRevenue = 0
      let cfCOGS = 0
      let cfExpenses = 0
      for (const st of cfSectionTotals) {
        if (st.category === 'Income' || st.category === 'Revenue') cfRevenue += Math.abs(st.total)
        else if (st.category === 'Cost of Goods Sold') cfCOGS += Math.abs(st.total)
        else if (st.category === 'Expense') cfExpenses += Math.abs(st.total)
      }
      const cfNetIncome = cfRevenue - cfCOGS - cfExpenses

      // ── Depreciation: from expense accounts in the hierarchy ──
      let cfDepreciation = 0
      for (const acc of cfSorted) {
        const accType = decodeOData(acc.accountType || '').toLowerCase()
        if (accType !== 'posting') continue
        const plCat = cfAccountCategoryMap.get(acc.number)
        if (plCat !== 'Expense') continue
        const sub = decodeOData(acc.subCategory || '').toLowerCase()
        const name = (acc.displayName || '').toLowerCase()
        if (
          sub.includes('depreciation') ||
          sub.includes('amortization') ||
          name.includes('depreciation') ||
          name.includes('amortization')
        ) {
          cfDepreciation += Math.abs(cfGlByAccount.get(acc.number) ?? 0)
        }
      }

      // ── Working capital changes, investing, financing from GL ──
      let arChange = 0,
        inventoryChange = 0,
        apChange = 0,
        otherOperating = 0
      let fixedAssetChange = 0,
        otherInvesting = 0
      let debtChange = 0,
        equityChange = 0

      for (const entry of periodEntries) {
        const meta = cfAccountMap.get(entry.accountNumber)
        if (!meta || meta.activity === 'skip' || meta.activity === 'cash') continue
        // Skip P&L accounts — already handled by hierarchy walk above
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

      const totalOperating =
        cfNetIncome + cfDepreciation + arChange + inventoryChange + apChange + otherOperating
      const totalInvesting = -fixedAssetChange - otherInvesting
      const totalFinancing = debtChange + equityChange
      const netCashChange = totalOperating + totalInvesting + totalFinancing

      data = [
        {
          beginningCash,
          operatingActivities: {
            netIncome: cfNetIncome,
            depreciation: cfDepreciation,
            arChange,
            inventoryChange,
            apChange,
            otherOperating,
            totalOperating,
          },
          investingActivities: {
            capitalExpenditures: Math.min(-fixedAssetChange, 0),
            assetSales: Math.max(-fixedAssetChange, 0),
            otherInvesting: -otherInvesting,
            totalInvesting,
          },
          financingActivities: {
            debtProceeds: Math.max(debtChange, 0),
            debtRepayments: Math.min(debtChange, 0),
            equityChanges: equityChange,
            totalFinancing,
          },
          netCashChange,
          endingCash,
        },
      ]

      summary = {
        reportType: 'cash_flow',
        beginningCash,
        totalOperating,
        totalInvesting,
        totalFinancing,
        netCashChange,
        endingCash,
        source: 'gl-entries-indirect',
      }
      break
    }

    case 'aged_receivables': {
      // Uses BC's built-in agedAccountsReceivables entity (matches UI dashboard)
      // This accounts for credit memos, partial payments, and uses BC's aging engine
      const arFilterParts: string[] = []
      if (input.filters?.customerName) {
        arFilterParts.push(`contains(name, '${input.filters.customerName.replace(/'/g, "''")}')`)
      }
      const arParams: any = {}
      if (arFilterParts.length > 0) {
        arParams.$filter = arFilterParts.join(' and ')
      }

      // Fetch aged receivables and company info (for LCY currency) in parallel
      const [agedAR, arCompanyInfo] = await Promise.all([
        client.getAgedAccountsReceivable(arParams),
        client
          .query('companyInformation', { $top: 1 })
          .then((r: any) => r.value?.[0] || null)
          .catch(() => null),
      ])

      // LCY currency from company info (aged AR values are always in LCY)
      const arLcyCurrency =
        arCompanyInfo?.currencyCode || arCompanyInfo?.localCurrencyCode || context.currency

      const arRecords = agedAR.records
      const arTotal = agedAR.total

      // Build per-customer data rows
      data = arRecords
        .filter((r: any) => Math.abs(r.balanceDue ?? 0) > 0)
        .map((r: any) => ({
          customerNumber: r.customerNumber || '',
          customerName: r.name || r.customerNumber || '',
          balanceDue: r.balanceDue ?? 0,
          current_0_days: r.currentAmount ?? 0,
          days_1_to_30: r.period1Amount ?? 0,
          days_31_to_60: r.period2Amount ?? 0,
          days_61_plus: r.period3Amount ?? 0,
          agedAsOfDate: r.agedAsOfDate || '',
        }))
        .sort((a: any, b: any) => Math.abs(b.balanceDue) - Math.abs(a.balanceDue))

      // Use the total row if available, otherwise sum from records
      const totalBalance =
        arTotal?.balanceDue ?? arRecords.reduce((s: number, r: any) => s + (r.balanceDue ?? 0), 0)
      const totalCurrent =
        arTotal?.currentAmount ??
        arRecords.reduce((s: number, r: any) => s + (r.currentAmount ?? 0), 0)
      const totalP1 =
        arTotal?.period1Amount ??
        arRecords.reduce((s: number, r: any) => s + (r.period1Amount ?? 0), 0)
      const totalP2 =
        arTotal?.period2Amount ??
        arRecords.reduce((s: number, r: any) => s + (r.period2Amount ?? 0), 0)
      const totalP3 =
        arTotal?.period3Amount ??
        arRecords.reduce((s: number, r: any) => s + (r.period3Amount ?? 0), 0)

      reportCurrencyOverride = arLcyCurrency

      summary = {
        reportType: 'aged_receivables',
        totalCustomers: arRecords.length,
        totalBalance,
        current: totalCurrent,
        days_1_30: totalP1,
        days_31_60: totalP2,
        days_over_60: totalP3,
        source: 'agedAccountsReceivables',
        currency: arLcyCurrency,
      }
      break
    }

    case 'aged_payables': {
      // Uses BC's built-in agedAccountsPayables entity (matches UI dashboard)
      // This accounts for credit memos, partial payments, and uses BC's aging engine
      const apFilterParts: string[] = []
      if (input.filters?.vendorName) {
        apFilterParts.push(`contains(name, '${input.filters.vendorName.replace(/'/g, "''")}')`)
      }
      const apParams: any = {}
      if (apFilterParts.length > 0) {
        apParams.$filter = apFilterParts.join(' and ')
      }

      // Fetch aged payables and company info (for LCY currency) in parallel
      const [agedAP, apCompanyInfo] = await Promise.all([
        client.getAgedAccountsPayable(apParams),
        client
          .query('companyInformation', { $top: 1 })
          .then((r: any) => r.value?.[0] || null)
          .catch(() => null),
      ])

      // LCY currency from company info (aged AP values are always in LCY)
      const apLcyCurrency =
        apCompanyInfo?.currencyCode || apCompanyInfo?.localCurrencyCode || context.currency

      const apRecords = agedAP.records
      const apTotal = agedAP.total

      // Build per-vendor data rows
      data = apRecords
        .filter((r: any) => Math.abs(r.balanceDue ?? 0) > 0)
        .map((r: any) => ({
          vendorNumber: r.vendorNumber || '',
          vendorName: r.name || r.vendorNumber || '',
          balanceDue: r.balanceDue ?? 0,
          current_0_days: r.currentAmount ?? 0,
          days_1_to_30: r.period1Amount ?? 0,
          days_31_to_60: r.period2Amount ?? 0,
          days_61_plus: r.period3Amount ?? 0,
          agedAsOfDate: r.agedAsOfDate || '',
        }))
        .sort((a: any, b: any) => Math.abs(b.balanceDue) - Math.abs(a.balanceDue))

      // Use the total row if available, otherwise sum from records
      const apTotalBalance =
        apTotal?.balanceDue ?? apRecords.reduce((s: number, r: any) => s + (r.balanceDue ?? 0), 0)
      const apTotalCurrent =
        apTotal?.currentAmount ??
        apRecords.reduce((s: number, r: any) => s + (r.currentAmount ?? 0), 0)
      const apTotalP1 =
        apTotal?.period1Amount ??
        apRecords.reduce((s: number, r: any) => s + (r.period1Amount ?? 0), 0)
      const apTotalP2 =
        apTotal?.period2Amount ??
        apRecords.reduce((s: number, r: any) => s + (r.period2Amount ?? 0), 0)
      const apTotalP3 =
        apTotal?.period3Amount ??
        apRecords.reduce((s: number, r: any) => s + (r.period3Amount ?? 0), 0)

      reportCurrencyOverride = apLcyCurrency

      summary = {
        reportType: 'aged_payables',
        totalVendors: apRecords.length,
        vendorsWithBalance: data.length,
        totalBalance: apTotalBalance,
        current: apTotalCurrent,
        days_1_30: apTotalP1,
        days_31_60: apTotalP2,
        days_over_60: apTotalP3,
        source: 'agedAccountsPayables',
        currency: apLcyCurrency,
      }
      break
    }

    case 'sales_by_customer': {
      const scFilterParts: string[] = []
      if (startDate && endDate) {
        scFilterParts.push(`postingDate ge ${startDate} and postingDate le ${endDate}`)
      }
      if (input.filters?.customerName) {
        scFilterParts.push(
          `contains(customerName, '${input.filters.customerName.replace(/'/g, "''")}')`
        )
      }
      const invoices = await client.listSalesInvoices({
        $filter: scFilterParts.length > 0 ? scFilterParts.join(' and ') : undefined,
        $select: 'customerName,totalAmountIncludingTax,postingDate',
      })
      const byCustomer: Record<string, number> = {}
      for (const inv of invoices) {
        const name = inv.customerName || 'Unknown'
        byCustomer[name] = (byCustomer[name] || 0) + (inv.totalAmountIncludingTax || 0)
      }
      data = Object.entries(byCustomer)
        .map(([name, total]) => ({ customerName: name, totalSales: total }))
        .sort((a, b) => b.totalSales - a.totalSales)

      // Apply amount filters post-aggregation
      if (input.filters?.minAmount) {
        data = data.filter((r: any) => r.totalSales >= input.filters!.minAmount!)
      }
      if (input.filters?.maxAmount) {
        data = data.filter((r: any) => r.totalSales <= input.filters!.maxAmount!)
      }

      summary = {
        reportType: 'sales_by_customer',
        totalCustomers: data.length,
        totalSales: data.reduce((sum: number, r: any) => sum + r.totalSales, 0),
      }
      break
    }

    case 'purchases_by_vendor': {
      const pvFilterParts: string[] = []
      if (startDate && endDate) {
        pvFilterParts.push(`invoiceDate ge ${startDate} and invoiceDate le ${endDate}`)
      }
      if (input.filters?.vendorName) {
        pvFilterParts.push(
          `contains(vendorName, '${input.filters.vendorName.replace(/'/g, "''")}')`
        )
      }
      const pInvoices = await client.listPurchaseInvoices({
        $filter: pvFilterParts.length > 0 ? pvFilterParts.join(' and ') : undefined,
        $select: 'vendorName,totalAmountIncludingTax,invoiceDate',
      })
      const byVendor: Record<string, number> = {}
      for (const inv of pInvoices) {
        const name = inv.vendorName || 'Unknown'
        byVendor[name] = (byVendor[name] || 0) + (inv.totalAmountIncludingTax || 0)
      }
      data = Object.entries(byVendor)
        .map(([name, total]) => ({ vendorName: name, totalPurchases: total }))
        .sort((a, b) => b.totalPurchases - a.totalPurchases)

      // Apply amount filters post-aggregation
      if (input.filters?.minAmount) {
        data = data.filter((r: any) => r.totalPurchases >= input.filters!.minAmount!)
      }
      if (input.filters?.maxAmount) {
        data = data.filter((r: any) => r.totalPurchases <= input.filters!.maxAmount!)
      }

      summary = {
        reportType: 'purchases_by_vendor',
        totalVendors: data.length,
        totalPurchases: data.reduce((sum: number, r: any) => sum + r.totalPurchases, 0),
      }
      break
    }

    case 'inventory_valuation': {
      const ivParams: any = {
        $select: 'number,displayName,inventory,unitCost,unitPrice,itemCategoryCode',
      }
      // OData filter for item number
      if (input.filters?.itemNo) {
        ivParams.$filter = `contains(number, '${input.filters.itemNo.replace(/'/g, "''")}')`
      }
      // Fetch items and ALL ledger entries in parallel for accurate cost valuation.
      // No $select on ledger entries — mirrors the inventory-enhanced page endpoint.
      const [ivAllItems, ivLedgerEntries] = await Promise.all([
        client.listItems(ivParams),
        client.queryAll('itemLedgerEntries'),
      ])

      // Build per-item cost from ledger entries (matches BC Report 1001 / inventory-enhanced page).
      // costAmountActual signs naturally net out: purchases +, sales -, adjustments ±.
      const ivCostByItem: Record<string, number> = {}
      for (const entry of ivLedgerEntries) {
        const itemNum = entry.itemNumber || ''
        if (!itemNum) continue
        ivCostByItem[itemNum] = (ivCostByItem[itemNum] ?? 0) + (entry.costAmountActual ?? 0)
      }
      const getIvItemValue = (item: any): number => {
        const itemNo = item.number || ''
        if (itemNo in ivCostByItem) return ivCostByItem[itemNo]
        // Fallback to qty × unitCost if no ledger entries found
        return (item.inventory ?? 0) * (item.unitCost ?? 0)
      }

      // Compute totals over ALL items (matching the inventory overview card on the BC page)
      const ivTotalUnits = ivAllItems.reduce((s: number, i: any) => s + (i.inventory ?? 0), 0)
      const ivTotalValue = ivAllItems.reduce((s: number, i: any) => s + getIvItemValue(i), 0)

      // Filter to items with stock, enrich with ledger-based inventory_value, and sort by value
      data = ivAllItems
        .filter((item: any) => (item.inventory || 0) > 0)
        .map((item: any) => ({
          ...item,
          inventory_value: Math.round(getIvItemValue(item) * 100) / 100,
        }))
        .sort((a: any, b: any) => b.inventory_value - a.inventory_value)

      // Post-fetch filters for fields that may not support OData contains
      if (input.filters?.itemName) {
        const nameFilter = input.filters.itemName.toLowerCase()
        data = data.filter((item: any) =>
          (item.displayName || '').toLowerCase().includes(nameFilter)
        )
      }
      if (input.filters?.itemCategory) {
        const catFilter = input.filters.itemCategory.toLowerCase()
        data = data.filter((item: any) =>
          (item.itemCategoryCode || '').toLowerCase().includes(catFilter)
        )
      }

      summary = {
        reportType: 'inventory_valuation',
        totalItems: data.length,
        totalUnits: ivTotalUnits,
        totalValue: Math.round(ivTotalValue * 100) / 100,
      }
      break
    }

    case 'enhanced_financial_summary': {
      // Comprehensive dashboard: top customers/vendors, aged AR/AP, ratios, efficiency, cash runway, inventory
      const efsFetchStep = profiler?.step('efs_fetch_all')
      const [
        efsAccounts,
        efsGlEntries,
        efsOpenAR,
        efsOpenAP,
        efsPaidInvoices,
        efsCustomers,
        efsVendors,
        efsItems,
        efsBankAccounts,
      ] = await Promise.allSettled([
        client.queryAll('accounts', { $select: ACCOUNTS_SELECT }),
        client.listGeneralLedgerEntries({
          $select: 'accountNumber,debitAmount,creditAmount',
          ...(endDate ? { $filter: `postingDate le ${endDate}` } : {}),
        }),
        client.listSalesInvoices({ $filter: "status eq 'Open'" }),
        client.listPurchaseInvoices({ $filter: "status eq 'Open'" }),
        startDate && endDate
          ? client.listSalesInvoices({
              $filter: `postingDate ge ${startDate} and postingDate le ${endDate}`,
              $select: 'customerName,totalAmountIncludingTax,postingDate',
            })
          : client.listSalesInvoices({
              $select: 'customerName,totalAmountIncludingTax,postingDate',
            }),
        client.listCustomers({ $select: 'displayName,number,balanceDue' }),
        client.listVendors({ $select: 'displayName,number,balance' }),
        client.listItems({
          $select: 'number,displayName,inventory,unitCost,unitPrice,itemCategoryCode',
        }),
        client.listBankAccounts(),
      ])
      efsFetchStep?.end()

      const resolveSettled = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
        r.status === 'fulfilled' ? r.value : fallback

      const accts = resolveSettled(efsAccounts, [])
      const glEnts = resolveSettled(efsGlEntries, [])
      const openAR = resolveSettled(efsOpenAR, [])
      const openAP = resolveSettled(efsOpenAP, [])
      const paidInvs = resolveSettled(efsPaidInvoices, [])
      const custs = resolveSettled(efsCustomers, [])
      const vends = resolveSettled(efsVendors, [])
      const items = resolveSettled(efsItems, [])
      const banks = resolveSettled(efsBankAccounts, [])

      // Top customers by sales
      const custSales: Record<string, { total: number; count: number }> = {}
      for (const inv of paidInvs) {
        const name = inv.customerName || 'Unknown'
        if (!custSales[name]) custSales[name] = { total: 0, count: 0 }
        custSales[name].total += inv.totalAmountIncludingTax || 0
        custSales[name].count++
      }
      const topCustomers = Object.entries(custSales)
        .map(([name, v]) => ({ name, total_revenue: v.total, invoice_count: v.count }))
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 10)

      // Top vendors by spend (from open AP)
      const vendSpend: Record<string, { total: number; count: number }> = {}
      for (const inv of openAP) {
        const name = inv.vendorName || 'Unknown'
        if (!vendSpend[name]) vendSpend[name] = { total: 0, count: 0 }
        vendSpend[name].total += inv.totalAmountIncludingTax || inv.totalAmount || 0
        vendSpend[name].count++
      }
      const topVendors = Object.entries(vendSpend)
        .map(([name, v]) => ({ name, total_spend: v.total, invoice_count: v.count }))
        .sort((a, b) => b.total_spend - a.total_spend)
        .slice(0, 10)

      // Aged AR/AP
      const arBucketsEfs = ageInvoices(openAR)
      const apBucketsEfs = ageInvoices(openAP)

      // Cash balance
      const totalCash = banks.reduce((s: number, b: any) => s + (b.balance ?? 0), 0)

      // Inventory summary
      const itemsWithStock = items.filter((i: any) => (i.inventory || 0) > 0)
      const totalInventoryValue = itemsWithStock.reduce(
        (s: number, i: any) => s + (i.inventory || 0) * (i.unitCost || 0),
        0
      )

      // Financial ratios from GL
      const efsGlByAccount = new Map<string, number>()
      for (const e of glEnts) {
        if (!e.accountNumber) continue
        efsGlByAccount.set(
          e.accountNumber,
          (efsGlByAccount.get(e.accountNumber) ?? 0) + (e.debitAmount ?? 0) - (e.creditAmount ?? 0)
        )
      }
      let efsAssets = 0,
        efsLiabilities = 0
      for (const acc of accts) {
        const cat = (acc.category || '').trim()
        const bal = efsGlByAccount.get(acc.number) ?? 0
        if (cat === 'Assets') efsAssets += bal
        else if (cat === 'Liabilities') efsLiabilities += -bal
      }
      const currentRatio = efsLiabilities > 0 ? efsAssets / efsLiabilities : 0
      const workingCapital = efsAssets - efsLiabilities

      data = [
        {
          topCustomers,
          topVendors,
          agedReceivables: {
            ...arBucketsEfs,
            customer_count: new Set(openAR.map((i: any) => i.customerNumber)).size,
          },
          agedPayables: {
            ...apBucketsEfs,
            vendor_count: new Set(openAP.map((i: any) => i.vendorNumber)).size,
          },
          bankAccounts: banks.map((b: any) => ({
            name: b.displayName || b.number,
            balance: b.balance ?? 0,
          })),
          totalCash,
          financialRatios: { currentRatio: Math.round(currentRatio * 100) / 100, workingCapital },
          inventorySummary: {
            item_count: items.length,
            items_with_stock: itemsWithStock.length,
            total_inventory_value: Math.round(totalInventoryValue * 100) / 100,
            total_units: itemsWithStock.reduce((s: number, i: any) => s + (i.inventory || 0), 0),
          },
          customerCount: custs.length,
          vendorCount: vends.length,
        },
      ]

      summary = {
        reportType: 'enhanced_financial_summary',
        totalCash,
        totalAR: arBucketsEfs.total,
        totalAP: apBucketsEfs.total,
        totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
        customerCount: custs.length,
        vendorCount: vends.length,
        currentRatio: Math.round(currentRatio * 100) / 100,
      }
      break
    }

    case 'sales_by_geography': {
      // Sales by country/city from invoice ship-to/sell-to addresses
      const geoFilterParts: string[] = []
      if (startDate && endDate) {
        geoFilterParts.push(`postingDate ge ${startDate} and postingDate le ${endDate}`)
      }
      const geoInvoices = await client.queryAll('salesInvoices', {
        $select:
          'customerName,totalAmountIncludingTax,postingDate,sellToAddressLine1,sellToCity,sellToState,sellToCountry,shipToCity,shipToCountry',
        ...(geoFilterParts.length > 0 ? { $filter: geoFilterParts.join(' and ') } : {}),
      })

      // Aggregate by country
      const byCountry: Record<
        string,
        { total: number; count: number; customers: Set<string>; cities: Set<string> }
      > = {}
      const byCity: Record<
        string,
        { total: number; count: number; customers: Set<string>; country: string; state: string }
      > = {}

      for (const inv of geoInvoices) {
        const amount = inv.totalAmountIncludingTax || 0
        // Prefer shipToCountry, fall back to sellToCountry
        let country = (inv.shipToCountry || inv.sellToCountry || '').trim()
        if (country === 'UK') country = 'GB'
        if (!country) country = 'Unknown'

        const city = (inv.shipToCity || inv.sellToCity || '').trim()
        const state = (inv.sellToState || '').trim()
        const custName = inv.customerName || 'Unknown'

        if (!byCountry[country])
          byCountry[country] = { total: 0, count: 0, customers: new Set(), cities: new Set() }
        byCountry[country].total += amount
        byCountry[country].count++
        byCountry[country].customers.add(custName)
        if (city) byCountry[country].cities.add(city)

        if (city) {
          const cityKey = `${city}|${country}`
          if (!byCity[cityKey])
            byCity[cityKey] = { total: 0, count: 0, customers: new Set(), country, state }
          byCity[cityKey].total += amount
          byCity[cityKey].count++
          byCity[cityKey].customers.add(custName)
        }
      }

      const countryData = Object.entries(byCountry)
        .map(([country, v]) => ({
          country,
          totalAmount: Math.round(v.total * 100) / 100,
          invoiceCount: v.count,
          customerCount: v.customers.size,
          cities: [...v.cities],
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)

      const cityData = Object.entries(byCity)
        .map(([key, v]) => {
          const city = key.split('|')[0]
          return {
            city,
            country: v.country,
            state: v.state,
            totalAmount: Math.round(v.total * 100) / 100,
            invoiceCount: v.count,
            customerCount: v.customers.size,
          }
        })
        .sort((a, b) => b.totalAmount - a.totalAmount)

      data = [{ byCountry: countryData, byCity: cityData }]
      summary = {
        reportType: 'sales_by_geography',
        totalInvoices: geoInvoices.length,
        totalAmount: geoInvoices.reduce(
          (s: number, i: any) => s + (i.totalAmountIncludingTax || 0),
          0
        ),
        countries: countryData.length,
        cities: cityData.length,
      }
      break
    }

    case 'monthly_cash_trend': {
      // Month-by-month cash position with inflows, outflows, running balance
      const mctAccountStep = profiler?.step('mct_fetch_accounts')
      const mctAccounts = await client.queryAll('accounts', { $select: ACCOUNTS_SELECT })
      mctAccountStep?.end({ accountCount: mctAccounts.length })

      // Identify cash/bank posting accounts using shared classifier
      // (matches cash_flow report and UI platform logic — includes section hierarchy detection)
      const mctAccountMap = classifyBCAccounts(mctAccounts)
      const cashAccNums = new Set<string>()
      for (const [num, meta] of mctAccountMap) {
        if (meta.activity === 'cash') cashAccNums.add(num)
      }

      // Fetch GL entries for cash accounts in period + cumulative
      const mctGlStep = profiler?.step('mct_fetch_gl')
      const mctGlFilter: string[] = []
      if (startDate && endDate) {
        mctGlFilter.push(`postingDate ge ${startDate} and postingDate le ${endDate}`)
      }
      const [mctPeriodEntries, mctCumulativeEntries] = await Promise.all([
        client.listGeneralLedgerEntries({
          $select: 'accountNumber,debitAmount,creditAmount,postingDate',
          ...(mctGlFilter.length > 0 ? { $filter: mctGlFilter.join(' and ') } : {}),
        }),
        client.listGeneralLedgerEntries({
          $select: 'accountNumber,debitAmount,creditAmount',
          ...(endDate ? { $filter: `postingDate le ${endDate}` } : {}),
        }),
      ])
      mctGlStep?.end({
        periodEntries: mctPeriodEntries.length,
        cumulativeEntries: mctCumulativeEntries.length,
      })

      // Cumulative cash balance
      let cumulativeCash = 0
      for (const e of mctCumulativeEntries) {
        if (cashAccNums.has(e.accountNumber))
          cumulativeCash += (e.debitAmount ?? 0) - (e.creditAmount ?? 0)
      }

      // Period cash movements by month
      const monthlyMap = new Map<string, { inflow: number; outflow: number }>()
      let periodNetChange = 0
      for (const e of mctPeriodEntries) {
        if (!cashAccNums.has(e.accountNumber)) continue
        const month = (e.postingDate || '').substring(0, 7)
        if (!month) continue
        if (!monthlyMap.has(month)) monthlyMap.set(month, { inflow: 0, outflow: 0 })
        const m = monthlyMap.get(month)!
        const debit = e.debitAmount ?? 0
        const credit = e.creditAmount ?? 0
        m.inflow += debit
        m.outflow += credit
        periodNetChange += debit - credit
      }

      // Build running balance from opening
      const openingCash = cumulativeCash - periodNetChange
      let runningBalance = openingCash
      const months = [...monthlyMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, m]) => {
          const netChange = m.inflow - m.outflow
          runningBalance += netChange
          return {
            month,
            inflow: Math.round(m.inflow * 100) / 100,
            outflow: Math.round(m.outflow * 100) / 100,
            netChange: Math.round(netChange * 100) / 100,
            runningBalance: Math.round(runningBalance * 100) / 100,
          }
        })

      data = months
      summary = {
        reportType: 'monthly_cash_trend',
        cashBalance: Math.round(cumulativeCash * 100) / 100,
        openingCash: Math.round(openingCash * 100) / 100,
        monthCount: months.length,
        cashAccountCount: cashAccNums.size,
      }
      break
    }

    case 'cash_flow_by_activity': {
      // Monthly GL activity bucketed by operating/investing/financing
      const cfaAccountStep = profiler?.step('cfa_fetch_accounts')
      const cfaAccounts = await client.queryAll('accounts', { $select: ACCOUNTS_SELECT })
      cfaAccountStep?.end({ accountCount: cfaAccounts.length })

      // Classify accounts using shared helper, then map to activity-only
      // Cash and depreciation accounts are skipped for activity bucketing
      const cfaFullMap = classifyBCAccounts(cfaAccounts)
      const cfaAccountActivity = new Map<string, 'operating' | 'investing' | 'financing' | 'skip'>()
      for (const [num, meta] of cfaFullMap) {
        if (meta.activity === 'cash') {
          cfaAccountActivity.set(num, 'skip')
        } else {
          const sub = meta.subCategory.toLowerCase()
          if (sub.includes('depreciation') || sub.includes('amortization')) {
            cfaAccountActivity.set(num, 'skip')
          } else {
            cfaAccountActivity.set(num, meta.activity === 'skip' ? 'skip' : meta.activity)
          }
        }
      }

      // Fetch GL entries for the period
      const cfaGlStep = profiler?.step('cfa_fetch_gl')
      const cfaGlFilter: string[] = []
      if (startDate && endDate) {
        cfaGlFilter.push(`postingDate ge ${startDate} and postingDate le ${endDate}`)
      }
      const cfaGlEntries = await client.listGeneralLedgerEntries({
        $select: 'accountNumber,debitAmount,creditAmount,postingDate',
        ...(cfaGlFilter.length > 0 ? { $filter: cfaGlFilter.join(' and ') } : {}),
      })
      cfaGlStep?.end({ glEntryCount: cfaGlEntries.length })

      // Bucket by month + activity
      const cfaMonthly = new Map<
        string,
        { operating: number; investing: number; financing: number }
      >()
      let cfaTotalOp = 0,
        cfaTotalInv = 0,
        cfaTotalFin = 0

      for (const e of cfaGlEntries) {
        const activity = cfaAccountActivity.get(e.accountNumber)
        if (!activity || activity === 'skip') continue
        const month = (e.postingDate || '').substring(0, 7)
        if (!month) continue
        const net = (e.creditAmount ?? 0) - (e.debitAmount ?? 0) // Income-normal sign

        if (!cfaMonthly.has(month))
          cfaMonthly.set(month, { operating: 0, investing: 0, financing: 0 })
        const m = cfaMonthly.get(month)!
        m[activity] += net

        if (activity === 'operating') cfaTotalOp += net
        else if (activity === 'investing') cfaTotalInv += net
        else cfaTotalFin += net
      }

      const cfaMonths = [...cfaMonthly.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, m]) => ({
          month,
          operating: Math.round(m.operating * 100) / 100,
          investing: Math.round(m.investing * 100) / 100,
          financing: Math.round(m.financing * 100) / 100,
        }))

      data = cfaMonths
      summary = {
        reportType: 'cash_flow_by_activity',
        operating: Math.round(cfaTotalOp * 100) / 100,
        investing: Math.round(cfaTotalInv * 100) / 100,
        financing: Math.round(cfaTotalFin * 100) / 100,
        monthCount: cfaMonths.length,
      }
      break
    }

    case 'inventory_enhanced': {
      // Comprehensive inventory: ABC classification, health scores, slow-moving, turnover, locations
      const ieFetchStep = profiler?.step('ie_fetch_all')
      const [ieItems, ieCategories, ieLedgerEntries, ieLocations] = await Promise.allSettled([
        client.listItems({
          $select:
            'number,displayName,inventory,unitCost,unitPrice,itemCategoryCode,baseUnitOfMeasureCode,type',
        }),
        client.queryAll('itemCategories').catch(() => []),
        // No $select — mirrors the inventory-enhanced page endpoint to get all fields
        client.queryAll('itemLedgerEntries'),
        client.queryAll('locations').catch(() => []),
      ])
      ieFetchStep?.end()

      const ieItemsList = ieItems.status === 'fulfilled' ? ieItems.value : []
      const ieCatsList = ieCategories.status === 'fulfilled' ? ieCategories.value : []
      const ieLedgerList = ieLedgerEntries.status === 'fulfilled' ? ieLedgerEntries.value : []
      const ieLocList = ieLocations.status === 'fulfilled' ? ieLocations.value : []

      // Build per-item cost from ledger entries (matches BC Report 1001 / inventory-enhanced page).
      // costAmountActual signs naturally net out: purchases +, sales -, adjustments ±.
      const ieCostByItem: Record<string, number> = {}
      // Also compute per-item metrics for sales/purchase tracking
      const itemMetrics = new Map<
        string,
        {
          salesQty: number
          purchaseQty: number
          lastSaleDate: string | null
          lastPurchaseDate: string | null
        }
      >()
      for (const e of ieLedgerList) {
        const itemNo = e.itemNumber || e.Item_No || ''
        if (!itemNo) continue
        // Accumulate costAmountActual without Math.abs — signs net naturally
        ieCostByItem[itemNo] = (ieCostByItem[itemNo] ?? 0) + (e.costAmountActual ?? 0)
        if (!itemMetrics.has(itemNo))
          itemMetrics.set(itemNo, {
            salesQty: 0,
            purchaseQty: 0,
            lastSaleDate: null,
            lastPurchaseDate: null,
          })
        const m = itemMetrics.get(itemNo)!
        const entryType = (e.entryType || e.Entry_Type || '').toLowerCase()
        const qty = Math.abs(e.quantity || e.Quantity || 0)
        const postDate = e.postingDate || e.Posting_Date || ''
        if (entryType === 'sale') {
          m.salesQty += qty
          if (!m.lastSaleDate || postDate > m.lastSaleDate) m.lastSaleDate = postDate
        } else if (entryType === 'purchase') {
          m.purchaseQty += qty
          if (!m.lastPurchaseDate || postDate > m.lastPurchaseDate) m.lastPurchaseDate = postDate
        }
      }
      // Helper: get accurate inventory value for an item (same as page endpoint)
      const getIeItemValue = (item: any): number => {
        const itemNo = item.number || ''
        if (itemNo in ieCostByItem) return ieCostByItem[itemNo]
        return (item.inventory ?? 0) * (item.unitCost ?? 0)
      }

      // Compute total value over ALL items (matching the inventory overview card on the BC page)
      const totalValue = ieItemsList.reduce((s: number, i: any) => s + getIeItemValue(i), 0)

      // Inventory values and ABC classification (only items with stock for display)
      const itemsWithValues = ieItemsList
        .filter((i: any) => (i.inventory || 0) > 0)
        .map((i: any) => {
          const invValue = getIeItemValue(i)
          const metrics = itemMetrics.get(i.number)
          const daysSinceLastSale = metrics?.lastSaleDate
            ? Math.floor(
                (Date.now() - new Date(metrics.lastSaleDate).getTime()) / (1000 * 60 * 60 * 24)
              )
            : null
          return {
            item_no: i.number,
            description: i.displayName,
            inventory: i.inventory,
            unit_cost: i.unitCost,
            unit_price: i.unitPrice,
            item_category: i.itemCategoryCode,
            inventory_value: Math.round(invValue * 100) / 100,
            sales_qty: metrics?.salesQty || 0,
            purchase_qty: metrics?.purchaseQty || 0,
            days_since_last_sale: daysSinceLastSale,
            last_sale_date: metrics?.lastSaleDate || null,
          }
        })
        .sort((a: any, b: any) => b.inventory_value - a.inventory_value)

      // ABC classification (A=80%, B=15%, C=5%)
      let cumValue = 0
      const abc = {
        A: { count: 0, value: 0 },
        B: { count: 0, value: 0 },
        C: { count: 0, value: 0 },
      }
      for (const item of itemsWithValues) {
        cumValue += item.inventory_value
        const pct = totalValue > 0 ? cumValue / totalValue : 1
        const cls = pct <= 0.8 ? 'A' : pct <= 0.95 ? 'B' : 'C'
        abc[cls].count++
        abc[cls].value += item.inventory_value
      }

      // Slow-moving items — matches the page: all items with stock sorted by risk
      // (null days = never sold first, then by days descending), top 20.
      // No threshold pre-filter — the frontend component handles risk tier display.
      const slowMoving = [...itemsWithValues]
        .sort((a: any, b: any) => {
          if (a.days_since_last_sale === null && b.days_since_last_sale === null)
            return b.inventory_value - a.inventory_value
          if (a.days_since_last_sale === null) return -1
          if (b.days_since_last_sale === null) return 1
          return b.days_since_last_sale - a.days_since_last_sale
        })
        .slice(0, 20)
      const zeroSalesItems = slowMoving.filter((i: any) => i.days_since_last_sale === null)

      // Category breakdown
      const catMap: Record<string, { count: number; value: number }> = {}
      for (const item of itemsWithValues) {
        const cat = item.item_category || 'Uncategorized'
        if (!catMap[cat]) catMap[cat] = { count: 0, value: 0 }
        catMap[cat].count++
        catMap[cat].value += item.inventory_value
      }

      data = [
        {
          overview: {
            total_items: ieItemsList.length,
            items_with_stock: itemsWithValues.length,
            total_inventory_value: Math.round(totalValue * 100) / 100,
            total_units: ieItemsList.reduce((s: number, i: any) => s + (i.inventory ?? 0), 0),
          },
          abcClassification: {
            A: {
              ...abc.A,
              value: Math.round(abc.A.value * 100) / 100,
              percentage: totalValue > 0 ? Math.round((abc.A.value / totalValue) * 100) : 0,
            },
            B: {
              ...abc.B,
              value: Math.round(abc.B.value * 100) / 100,
              percentage: totalValue > 0 ? Math.round((abc.B.value / totalValue) * 100) : 0,
            },
            C: {
              ...abc.C,
              value: Math.round(abc.C.value * 100) / 100,
              percentage: totalValue > 0 ? Math.round((abc.C.value / totalValue) * 100) : 0,
            },
          },
          slowMoving: {
            items: slowMoving,
            summary: {
              totalItems: slowMoving.length,
              totalValue:
                Math.round(
                  slowMoving.reduce((s: number, i: any) => s + i.inventory_value, 0) * 100
                ) / 100,
              zeroSalesCount: zeroSalesItems.length,
              zeroSalesValue:
                Math.round(
                  zeroSalesItems.reduce((s: number, i: any) => s + i.inventory_value, 0) * 100
                ) / 100,
            },
          },
          byCategory: Object.entries(catMap)
            .map(([cat, v]) => ({
              category: cat,
              item_count: v.count,
              total_value: Math.round(v.value * 100) / 100,
            }))
            .sort((a, b) => b.total_value - a.total_value),
          topItemsByValue: itemsWithValues.slice(0, 20),
          // Movement trend: monthly purchases/sales/adjustments from item ledger entries (matches UI grouping)
          movementTrend: (() => {
            const decodeOData = (s: string) =>
              s.replace(/_x([0-9a-fA-F]{4})_/g, (_: string, hex: string) =>
                String.fromCharCode(parseInt(hex, 16))
              )
            // Use requested date range, or default to last 12 months
            const now = new Date()
            const defaultStart = new Date(now.getFullYear() - 1, now.getMonth(), 1)
              .toISOString()
              .substring(0, 10)
            const mtStart = startDate || defaultStart
            const mtEnd = endDate || now.toISOString().substring(0, 10)
            const mtMap: Record<string, { Purchases: number; Sales: number; Adjustments: number }> =
              {}
            for (const e of ieLedgerList) {
              const postDate = e.postingDate || ''
              if (postDate < mtStart || postDate > mtEnd) continue
              const month = postDate.substring(0, 7)
              if (!month) continue
              const rawType = decodeOData(e.entryType || 'Unknown').toLowerCase()
              // Match UI grouping (InventoryMovementTrendCard.tsx lines 101-107)
              let bucket: 'Purchases' | 'Sales' | 'Adjustments'
              if (rawType.includes('purchase') || rawType.includes('positive')) bucket = 'Purchases'
              else if (rawType.includes('sale') || rawType.includes('negative')) bucket = 'Sales'
              else bucket = 'Adjustments'
              if (!mtMap[month]) mtMap[month] = { Purchases: 0, Sales: 0, Adjustments: 0 }
              mtMap[month][bucket] += Math.abs(e.costAmountActual ?? 0)
            }
            return Object.entries(mtMap)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([month, buckets]) => ({
                month,
                Purchases: Math.round(buckets.Purchases * 100) / 100,
                Sales: Math.round(buckets.Sales * 100) / 100,
                Adjustments: Math.round(buckets.Adjustments * 100) / 100,
              }))
          })(),
          locations: ieLocList.map((l: any) => ({
            code: l.code,
            name: l.displayName || l.name || l.code,
          })),
        },
      ]

      summary = {
        reportType: 'inventory_enhanced',
        totalItems: ieItemsList.length,
        itemsWithStock: itemsWithValues.length,
        totalInventoryValue: Math.round(totalValue * 100) / 100,
        totalUnits: ieItemsList.reduce((s: number, i: any) => s + (i.inventory ?? 0), 0),
        categories: Object.keys(catMap).length,
        slowMovingCount: slowMoving.length,
        locationCount: ieLocList.length,
      }
      break
    }

    case 'sales_by_item': {
      const sbiFilterParts: string[] = []
      if (startDate && endDate) {
        sbiFilterParts.push(`postingDate ge ${startDate} and postingDate le ${endDate}`)
      }
      const sbiInvoices = await client.listSalesInvoices({
        $filter: sbiFilterParts.length > 0 ? sbiFilterParts.join(' and ') : undefined,
        $expand: 'salesInvoiceLines',
      })

      const byItem: Record<
        string,
        { itemName: string; totalRevenue: number; totalQuantity: number }
      > = {}
      for (const inv of sbiInvoices) {
        const lines = inv.salesInvoiceLines || []
        for (const line of lines) {
          // Skip non-item lines (comments, GL accounts, resources)
          const lineType = (line.lineObjectType || line.lineType || '').toLowerCase()
          if (lineType && lineType !== 'item') continue

          const itemNo = line.lineObjectNumber || line.itemId || line.number || ''
          if (!itemNo) continue

          const desc = line.description || 'Unknown'
          const key = itemNo
          const qty = line.quantity ?? 0
          const amount =
            line.amountExcludingTax ??
            line.lineAmount ??
            line.netAmount ??
            line.amount ??
            line.totalAmount ??
            0

          if (!byItem[key]) {
            byItem[key] = { itemName: desc, totalRevenue: 0, totalQuantity: 0 }
          }
          byItem[key].totalRevenue += amount
          byItem[key].totalQuantity += qty
        }
      }

      data = Object.entries(byItem)
        .map(([itemNo, info]) => ({
          itemNo,
          itemName: info.itemName,
          totalRevenue: Math.round(info.totalRevenue * 100) / 100,
          totalQuantity: info.totalQuantity,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)

      // Apply item category filter post-aggregation if requested
      if (input.filters?.itemCategory) {
        // Fetch items to get category mappings
        const items = await client.listItems({
          $select: 'number,itemCategoryCode',
        })
        const categoryFilter = input.filters.itemCategory.toLowerCase()
        const matchingItemNos = new Set(
          items
            .filter((item: any) =>
              (item.itemCategoryCode || '').toLowerCase().includes(categoryFilter)
            )
            .map((item: any) => item.number)
        )
        data = data.filter((r: any) => matchingItemNos.has(r.itemNo))
      }

      // Apply amount filters
      if (input.filters?.minAmount) {
        data = data.filter((r: any) => r.totalRevenue >= input.filters!.minAmount!)
      }
      if (input.filters?.maxAmount) {
        data = data.filter((r: any) => r.totalRevenue <= input.filters!.maxAmount!)
      }

      // Apply limit
      if (input.limit) {
        data = data.slice(0, input.limit)
      }

      const sbiTotalRevenue = data.reduce((sum: number, r: any) => sum + r.totalRevenue, 0)
      const sbiTotalQty = data.reduce((sum: number, r: any) => sum + r.totalQuantity, 0)
      summary = {
        reportType: 'sales_by_item',
        itemCount: data.length,
        totalRevenue: Math.round(sbiTotalRevenue * 100) / 100,
        totalQuantitySold: sbiTotalQty,
      }
      break
    }

    case 'purchases_by_item': {
      const pbiFilterParts: string[] = []
      if (startDate && endDate) {
        pbiFilterParts.push(`invoiceDate ge ${startDate} and invoiceDate le ${endDate}`)
      }
      const pbiInvoices = await client.listPurchaseInvoices({
        $filter: pbiFilterParts.length > 0 ? pbiFilterParts.join(' and ') : undefined,
        $expand: 'purchaseInvoiceLines',
      })

      const byPurchaseItem: Record<
        string,
        { itemName: string; totalSpend: number; totalQuantity: number }
      > = {}
      for (const inv of pbiInvoices) {
        const lines = inv.purchaseInvoiceLines || []
        for (const line of lines) {
          const lineType = (line.lineObjectType || line.lineType || '').toLowerCase()
          if (lineType && lineType !== 'item') continue

          const itemNo = line.lineObjectNumber || line.itemId || line.number || ''
          if (!itemNo) continue

          const desc = line.description || 'Unknown'
          const key = itemNo
          const qty = line.quantity ?? 0
          const amount =
            line.amountExcludingTax ??
            line.lineAmount ??
            line.netAmount ??
            line.amount ??
            line.directCost ??
            0

          if (!byPurchaseItem[key]) {
            byPurchaseItem[key] = { itemName: desc, totalSpend: 0, totalQuantity: 0 }
          }
          byPurchaseItem[key].totalSpend += amount
          byPurchaseItem[key].totalQuantity += qty
        }
      }

      data = Object.entries(byPurchaseItem)
        .map(([itemNo, info]) => ({
          itemNo,
          itemName: info.itemName,
          totalSpend: Math.round(info.totalSpend * 100) / 100,
          totalQuantity: info.totalQuantity,
        }))
        .sort((a, b) => b.totalSpend - a.totalSpend)

      // Apply item category filter post-aggregation if requested
      if (input.filters?.itemCategory) {
        const pbiItems = await client.listItems({
          $select: 'number,itemCategoryCode',
        })
        const pbiCategoryFilter = input.filters.itemCategory.toLowerCase()
        const pbiMatchingItemNos = new Set(
          pbiItems
            .filter((item: any) =>
              (item.itemCategoryCode || '').toLowerCase().includes(pbiCategoryFilter)
            )
            .map((item: any) => item.number)
        )
        data = data.filter((r: any) => pbiMatchingItemNos.has(r.itemNo))
      }

      if (input.filters?.minAmount) {
        data = data.filter((r: any) => r.totalSpend >= input.filters!.minAmount!)
      }
      if (input.filters?.maxAmount) {
        data = data.filter((r: any) => r.totalSpend <= input.filters!.maxAmount!)
      }

      if (input.limit) {
        data = data.slice(0, input.limit)
      }

      const pbiTotalSpend = data.reduce((sum: number, r: any) => sum + r.totalSpend, 0)
      const pbiTotalQty = data.reduce((sum: number, r: any) => sum + r.totalQuantity, 0)
      summary = {
        reportType: 'purchases_by_item',
        itemCount: data.length,
        totalSpend: Math.round(pbiTotalSpend * 100) / 100,
        totalQuantityPurchased: pbiTotalQty,
      }
      break
    }

    default:
      data = await client.listGeneralLedgerEntries({
        $top: input.limit || 100,
        $orderby: 'postingDate desc',
      })
      summary = {
        reportType: reportType || 'general_ledger',
        totalEntries: data.length,
      }
  }

  // ─── No-data detection ─────────────────────────────────────────────────────
  // When a queried period has no financial activity, return a clear signal so the
  // LLM tells the user directly instead of presenting a zero-filled report.
  const hasNoData = (() => {
    switch (reportType) {
      case 'profit_loss':
      case 'monthly_pnl_trend':
        return (
          summary.totalGLEntries === 0 &&
          summary.revenue === 0 &&
          summary.cogs === 0 &&
          summary.expenses === 0
        )
      case 'trial_balance':
        return summary.totalDebits === 0 && summary.totalCredits === 0
      case 'sales_by_customer':
      case 'purchases_by_vendor':
      case 'inventory_valuation':
      case 'sales_by_item':
      case 'purchases_by_item':
        return data.length === 0
      case 'aged_receivables':
      case 'aged_payables':
        return data.length === 0
      default:
        return Array.isArray(data) && data.length === 0
    }
  })()

  if (hasNoData) {
    const periodStr = startDate && endDate ? `${startDate} to ${endDate}` : 'the requested period'
    return {
      success: true,
      queryType: 'report',
      data: [],
      summary: {
        reportType,
        noData: true,
        message: `No financial data exists for ${periodStr}. There are no transactions in Business Central for this date range. Ask the user to try a more recent period.`,
        queriedPeriod: { startDate, endDate },
      },
      currency: context.currency,
      sources: [`Business Central API (${context.environmentName})`],
      generated: new Date().toISOString(),
    }
  }

  return {
    success: true,
    queryType: 'report',
    data,
    summary,
    currency: reportCurrencyOverride || context.currency,
    sources: [`Business Central API (${context.environmentName})`],
    generated: new Date().toISOString(),
  }
}

/**
 * Handle entity queries: customer, vendor, item, account, etc.
 */
async function handleEntityQuery(
  client: BusinessCentralClient,
  input: BCDataInput,
  context: BCApiContext
): Promise<BCQueryResult> {
  const entityType = input.entityType || 'account'
  const limit = input.limit || 50
  let data: any[] = []

  const params: any = { $top: limit }
  const filterParts: string[] = []
  const searchTerm = input.searchText || ''
  if (searchTerm) {
    const searchField = getSearchField(entityType)
    filterParts.push(`contains(${searchField}, '${searchTerm.replace(/'/g, "''")}')`)
  }

  // Apply entity-specific filters.
  // When a name filter can't be applied to the requested entity, resolve it via cross-entity
  // search instead of silently ignoring it. This handles cases like vendorName on GL entries.
  if (input.filters?.customerName) {
    if (entityType === 'customer') {
      filterParts.push(`contains(displayName, '${input.filters.customerName.replace(/'/g, "''")}')`)
    } else if (
      entityType === 'sales_invoice' ||
      entityType === 'sales_credit_memo' ||
      entityType === 'sales_shipment'
    ) {
      filterParts.push(
        `contains(customerName, '${input.filters.customerName.replace(/'/g, "''")}')`
      )
    } else {
      // Cross-entity: resolve customer by name and redirect to customer_detail
      logger.info(
        '[BC:SmartSearch] customerName filter on unsupported entity, resolving via lookup',
        {
          entityType,
          customerName: input.filters.customerName,
        }
      )
      const resolution = await resolveCustomerByName(client, input.filters.customerName)
      if (resolution.resolved) {
        return handleDetailQuery(
          client,
          {
            ...input,
            queryType: 'detail' as any,
            detailType: 'customer_detail' as any,
            customerNumber: resolution.resolved.number,
          } as any,
          context
        )
      }
      if (resolution.candidates) {
        return {
          success: true,
          queryType: 'entity',
          data: resolution.candidates,
          summary: {
            message: `Multiple customers match "${input.filters.customerName}". Please specify which one.`,
            matchCount: resolution.candidates.length,
          },
          sources: [`Business Central API (${context.environmentName})`],
          generated: new Date().toISOString(),
        }
      }
      return {
        success: false,
        queryType: 'entity',
        data: [],
        summary: { error: resolution.error },
        sources: [],
        generated: new Date().toISOString(),
        error: resolution.error,
      }
    }
  }
  if (input.filters?.customerNumber) {
    const escaped = input.filters.customerNumber.replace(/'/g, "''")
    if (entityType === 'customer') {
      filterParts.push(`number eq '${escaped}'`)
    } else if (
      entityType === 'sales_invoice' ||
      entityType === 'sales_credit_memo' ||
      entityType === 'sales_shipment'
    ) {
      filterParts.push(`customerNumber eq '${escaped}'`)
    } else {
      // Cross-entity: redirect to customer_detail
      return handleDetailQuery(
        client,
        {
          ...input,
          queryType: 'detail' as any,
          detailType: 'customer_detail' as any,
          customerNumber: input.filters.customerNumber,
        } as any,
        context
      )
    }
  }
  if (input.filters?.vendorName) {
    if (entityType === 'vendor') {
      filterParts.push(`contains(displayName, '${input.filters.vendorName.replace(/'/g, "''")}')`)
    } else if (
      entityType === 'purchase_invoice' ||
      entityType === 'purchase_order' ||
      entityType === 'purchase_credit_memo' ||
      entityType === 'purchase_receipt'
    ) {
      filterParts.push(`contains(vendorName, '${input.filters.vendorName.replace(/'/g, "''")}')`)
    } else {
      // Cross-entity: resolve vendor by name and redirect to vendor_detail
      logger.info(
        '[BC:SmartSearch] vendorName filter on unsupported entity, resolving via lookup',
        {
          entityType,
          vendorName: input.filters.vendorName,
        }
      )
      const resolution = await resolveVendorByName(client, input.filters.vendorName)
      if (resolution.resolved) {
        return handleDetailQuery(
          client,
          {
            ...input,
            queryType: 'detail' as any,
            detailType: 'vendor_detail' as any,
            vendorId: resolution.resolved.id,
          } as any,
          context
        )
      }
      if (resolution.candidates) {
        return {
          success: true,
          queryType: 'entity',
          data: resolution.candidates,
          summary: {
            message: `Multiple vendors match "${input.filters.vendorName}". Please specify which one.`,
            matchCount: resolution.candidates.length,
          },
          sources: [`Business Central API (${context.environmentName})`],
          generated: new Date().toISOString(),
        }
      }
      return {
        success: false,
        queryType: 'entity',
        data: [],
        summary: { error: resolution.error },
        sources: [],
        generated: new Date().toISOString(),
        error: resolution.error,
      }
    }
  }
  if (input.filters?.vendorNumber) {
    const escaped = input.filters.vendorNumber.replace(/'/g, "''")
    if (entityType === 'vendor') {
      filterParts.push(`number eq '${escaped}'`)
    } else if (
      entityType === 'purchase_invoice' ||
      entityType === 'purchase_order' ||
      entityType === 'purchase_credit_memo' ||
      entityType === 'purchase_receipt'
    ) {
      filterParts.push(`vendorNumber eq '${escaped}'`)
    } else {
      // Cross-entity: redirect to vendor_detail
      return handleDetailQuery(
        client,
        {
          ...input,
          queryType: 'detail' as any,
          detailType: 'vendor_detail' as any,
          vendorId: undefined,
          vendorName: input.filters.vendorNumber,
        } as any,
        context
      )
    }
  }
  if (input.filters?.itemNo) {
    if (entityType === 'item') {
      filterParts.push(`contains(number, '${input.filters.itemNo.replace(/'/g, "''")}')`)
    } else if (entityType === 'item_ledger_entry') {
      filterParts.push(`itemNumber eq '${input.filters.itemNo.replace(/'/g, "''")}'`)
    }
  }
  if (input.filters?.itemName && entityType === 'item') {
    filterParts.push(`contains(displayName, '${input.filters.itemName.replace(/'/g, "''")}')`)
  }
  if (input.filters?.documentNumber) {
    const docNumEntities = new Set([
      'sales_invoice',
      'purchase_invoice',
      'purchase_order',
      'purchase_credit_memo',
      'purchase_receipt',
      'sales_credit_memo',
      'sales_shipment',
    ])
    if (docNumEntities.has(entityType)) {
      filterParts.push(`number eq '${input.filters.documentNumber.replace(/'/g, "''")}'`)
    }
  }
  if (input.filters?.status) {
    const statusEntities = new Set([
      'sales_invoice',
      'purchase_invoice',
      'purchase_order',
      'purchase_credit_memo',
      'sales_credit_memo',
    ])
    if (statusEntities.has(entityType)) {
      filterParts.push(`status eq '${input.filters.status.replace(/'/g, "''")}'`)
    }
  }

  if (filterParts.length > 0) {
    params.$filter = filterParts.join(' and ')
  }

  // Entity-to-OData mapping. Use client.query() (single page, respects $top) for high-volume
  // entities instead of queryAll which paginates through ALL records.
  const entityODataMap: Record<string, string> = {
    customer: 'customers',
    vendor: 'vendors',
    item: 'items',
    account: 'accounts',
    sales_invoice: 'salesInvoices',
    purchase_invoice: 'purchaseInvoices',
    general_ledger_entry: 'generalLedgerEntries',
    bank_account: 'bankAccounts',
    purchase_order: 'purchaseOrders',
    purchase_credit_memo: 'purchaseCreditMemos',
    purchase_receipt: 'purchaseReceipts',
    vendor_payment_journal: 'vendorPaymentJournals',
    journal_line: 'journalLines',
    dimension: 'dimensions',
    item_ledger_entry: 'itemLedgerEntries',
    sales_credit_memo: 'salesCreditMemos',
    sales_shipment: 'salesShipments',
  }

  // High-volume entities: use single-page query to avoid fetching 100K+ records
  const HIGH_VOLUME = new Set([
    'general_ledger_entry',
    'item_ledger_entry',
    'journal_line',
    'sales_invoice',
    'purchase_invoice',
    'sales_credit_memo',
    'sales_shipment',
    'purchase_order',
    'purchase_receipt',
    'purchase_credit_memo',
  ])

  // Time-series entities get sorted by date
  const TIME_SERIES = new Set([
    'general_ledger_entry',
    'item_ledger_entry',
    'journal_line',
    'sales_invoice',
    'purchase_invoice',
    'sales_credit_memo',
    'sales_shipment',
    'purchase_order',
    'purchase_receipt',
    'purchase_credit_memo',
  ])

  if (TIME_SERIES.has(entityType)) {
    params.$orderby = 'postingDate desc'
  }

  // GL entries: limit fields to reduce payload (100+ fields → 9 essential ones)
  if (entityType === 'general_ledger_entry') {
    params.$select =
      'entryNumber,postingDate,documentNumber,documentType,accountNumber,description,debitAmount,creditAmount,balanceAccountNumber'
  }

  const odataEntity = entityODataMap[entityType]
  if (!odataEntity) {
    return {
      success: false,
      queryType: 'entity',
      data: [],
      summary: { error: `Unknown entity type: ${entityType}` },
      sources: [],
      generated: new Date().toISOString(),
      error: `Unknown entity type: ${entityType}`,
    }
  }

  let totalCount: number | undefined
  if (HIGH_VOLUME.has(entityType)) {
    // Single page — respects $top, no pagination through entire table
    // Include $count to get the real total even though we only fetch one page
    const result = await client.query(odataEntity, { ...params, $count: true })
    data = result.value || []
    totalCount = result['@odata.count']
  } else {
    // Low-volume entities (customers, vendors, items, etc.) — safe to fetch all
    data = await client.queryAll(odataEntity, params)
  }

  // Compute server-side summary for financial entities so the LLM doesn't
  // have to sum truncated data.  Covers invoices, credit memos, and purchase docs.
  const entitySummary: Record<string, any> = {
    entityType,
    count: data.length,
    // Include total count from API when available (for high-volume entities where we only fetch one page)
    ...(totalCount != null && totalCount > data.length && { totalCount }),
    limit,
    searchTerm: searchTerm || null,
  }

  if (
    ['sales_invoice', 'sales_credit_memo', 'purchase_invoice', 'purchase_credit_memo'].includes(
      entityType
    )
  ) {
    const totalAmount = data.reduce(
      (s: number, r: any) => s + (r.totalAmountIncludingTax ?? r.totalAmount ?? 0),
      0
    )
    const totalRemaining = data.reduce((s: number, r: any) => s + (r.remainingAmount ?? 0), 0)
    entitySummary.totalAmountIncludingTax = Math.round(totalAmount * 100) / 100
    entitySummary.totalRemaining = Math.round(totalRemaining * 100) / 100
    // Flag when totals are partial (only a subset of records was fetched)
    if (totalCount != null && totalCount > data.length) {
      entitySummary._partialTotals = `Totals are based on ${data.length} of ${totalCount} records. Do NOT present these as definitive KPIs.`
    }

    // Derive currency from document-level currencyCode
    const docCurrencies = new Set(data.map((r: any) => r.currencyCode).filter(Boolean))
    if (docCurrencies.size === 1) {
      entitySummary.currency = [...docCurrencies][0]
    } else if (docCurrencies.size > 1) {
      entitySummary.currency = 'mixed'
    }
  }

  // Pre-compute balance summary for vendor entities so the LLM
  // sees accurate totals even after data array truncation.
  if (entityType === 'vendor') {
    const withBalance = data.filter((r: any) => r.balance != null && r.balance > 0)
    entitySummary.vendorsWithBalance = withBalance.length
    // Total AP from BC's agedAccountsPayables (LCY-converted, matches UI dashboard)
    const agedAPData = await client
      .getAgedAccountsPayable()
      .catch(() => ({ total: null, records: [] }))
    entitySummary.totalAP = agedAPData.total?.balanceDue ?? null
    entitySummary.totalAP_currency = 'HKD'
    entitySummary._note =
      'Use totalAP as the authoritative total. Do NOT sum balanceDetails — vendors use different currencies. Show each vendor balance individually with its own currency.'
    // Include all positive-balance entries — this list is always small
    // and ensures the LLM can report on every outstanding balance
    entitySummary.balanceDetails = withBalance.map((r: any) => ({
      number: r.number,
      displayName: r.displayName,
      balance: r.balance,
      currencyCode: r.currencyCode,
    }))
  }

  // Use document-level currency when available, otherwise fall back to context
  const resolvedCurrency =
    entitySummary.currency && entitySummary.currency !== 'mixed'
      ? entitySummary.currency
      : context.currency

  return {
    success: true,
    queryType: 'entity',
    data,
    summary: entitySummary,
    currency: resolvedCurrency,
    sources: [`Business Central API (${context.environmentName})`],
    generated: new Date().toISOString(),
  }
}

/**
 * Handle metric queries: specific KPIs.
 * Uses GL entries + hierarchy for accurate P&L metrics, balance sheet endpoint for B/S metrics.
 */
async function handleMetricQuery(
  client: BusinessCentralClient,
  input: BCDataInput,
  context: BCApiContext,
  profiler?: QueryProfiler
): Promise<BCQueryResult> {
  // Uses accounts + GL entries approach (same as bc-agent-diagnostic)
  // because /incomeStatement and /balanceSheet OData report entities don't exist on all BC environments.

  // Resolve free-form metric name against registry
  const rawMetricName = input.metricName || ''
  const resolved = resolveMetricName(rawMetricName)
  const resolvedId = resolved?.metric.id || rawMetricName
  const resolvedCategory = resolved?.metric.category || null

  logger.info('[Tool:BC:Metric] Metric resolution', {
    correlationId: context.correlationId,
    requested: rawMetricName,
    resolvedId,
    resolvedCategory,
    matchType: resolved?.matchType || 'none',
    metricName: resolved?.metric.name || 'unknown',
  })

  const { startDate, endDate } = resolveDates(input)

  // 1. Always fetch CUMULATIVE GL (up to endDate). BS needs all historical entries,
  //    P&L is filtered in-memory by startDate. This ensures mixed metrics like ROA
  //    get correct BS totals AND correct P&L figures from a single GL fetch.
  const metricFetchStep = profiler?.step('metric_fetch_accounts_and_gl')
  const glParams: Record<string, any> = {
    $select: 'accountNumber,debitAmount,creditAmount,postingDate',
  }
  if (endDate) {
    glParams.$filter = `postingDate le ${endDate}`
  }
  const [allAccounts, glEntries] = await Promise.all([
    client.queryAll('accounts', { $select: ACCOUNTS_SELECT }),
    client.listGeneralLedgerEntries(glParams).catch(() => []),
  ])
  metricFetchStep?.end({ accountCount: allAccounts.length, glEntryCount: glEntries.length })

  const sorted = [...allAccounts].sort((a: any, b: any) =>
    (a.number || '').localeCompare(b.number || '')
  )

  // 2. Build TWO GL aggregations:
  //    - glCumulative: all entries up to endDate (for BS — point-in-time snapshot)
  //    - glPeriod: only entries within startDate..endDate (for P&L — period flow)
  const glCumulative = new Map<string, number>()
  const glPeriod = new Map<string, number>()
  const glPeriodMonths = new Set<string>() // Track distinct months with GL data
  for (const entry of glEntries) {
    const accNo = entry.accountNumber
    if (!accNo) continue
    const net = (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)
    glCumulative.set(accNo, (glCumulative.get(accNo) ?? 0) + net)
    if (!startDate || (entry.postingDate && entry.postingDate >= startDate)) {
      glPeriod.set(accNo, (glPeriod.get(accNo) ?? 0) + net)
      if (entry.postingDate) glPeriodMonths.add(entry.postingDate.substring(0, 7))
    }
  }

  // 3. BS: Hierarchy walk using CUMULATIVE GL (matches balance_sheet report handler)
  const bsSectionSums: Record<string, number> = { Assets: 0, Liabilities: 0, Equity: 0 }
  let bsGlobalDepth = 0
  let bsInSection = false
  let bsSectionCategory = ''
  let bsRelativeDepth = 0
  let currentAssetsSum = 0
  let currentLiabilitiesSum = 0
  let inventorySum = 0

  for (const acc of sorted) {
    const accType = decodeOData(acc.accountType || '').toLowerCase()
    const rawCat = decodeOData(acc.category || '').trim()
    const displayName = (acc.displayName || acc.number || '').trim()

    const resolvedBSCat = BS_CATEGORIES.includes(rawCat)
      ? rawCat
      : !rawCat || rawCat === ' '
        ? BS_CATEGORIES.find(
            (cat) =>
              displayName.toLowerCase() === cat.toLowerCase() ||
              displayName.toLowerCase().startsWith(cat.toLowerCase())
          ) || ''
        : ''

    if (accType === 'begin-total') {
      if (!bsInSection && bsGlobalDepth === 0 && resolvedBSCat) {
        bsInSection = true
        bsSectionCategory = resolvedBSCat
        bsRelativeDepth = 1
      } else if (bsInSection) {
        bsRelativeDepth++
      }
      bsGlobalDepth++
    } else if (accType === 'end-total' || accType === 'total') {
      bsGlobalDepth = Math.max(0, bsGlobalDepth - 1)
      if (bsInSection) {
        bsRelativeDepth = Math.max(0, bsRelativeDepth - 1)
        if (bsRelativeDepth === 0 && bsGlobalDepth === 0) {
          bsInSection = false
        }
      }
    } else if (bsInSection && accType === 'posting') {
      const bal = glCumulative.get(acc.number) ?? 0
      bsSectionSums[bsSectionCategory] += bal
      // Classify current assets/liabilities by subCategory
      const sub = (acc.subCategory || '').toLowerCase()
      if (bsSectionCategory === 'Assets') {
        if (
          [
            'cash',
            'bank',
            'checking',
            'savings',
            'receivable',
            'receivables',
            'inventory',
            'prepaid',
            'prepaid expenses',
            'current',
          ].some((s) => sub.includes(s))
        ) {
          currentAssetsSum += bal
        }
        if (sub.includes('inventory')) {
          inventorySum += bal
        }
      } else if (bsSectionCategory === 'Liabilities') {
        if (
          ['payable', 'payables', 'current', 'accrued', 'current liabilities'].some((s) =>
            sub.includes(s)
          )
        ) {
          currentLiabilitiesSum += bal
        }
      }
    }
  }

  const assets = bsSectionSums.Assets
  const liabilities = -bsSectionSums.Liabilities
  let equity = -bsSectionSums.Equity
  const currentAssets = currentAssetsSum
  const currentLiabilities = -currentLiabilitiesSum
  const inventoryForRatios = inventorySum

  // 4. P&L: Hierarchy walk using PERIOD-FILTERED GL
  let totalRevenue = 0
  let totalCOGS = 0
  let totalExpenses = 0

  let globalDepth = 0
  let inPLSection = false
  let plSectionCategory = ''
  const sumStack: number[] = []
  let relativeDepth = 0
  const plSectionTotals: { category: string; total: number }[] = []

  for (const acc of sorted) {
    const accType = decodeOData(acc.accountType || '').toLowerCase()
    const rawCat = decodeOData(acc.category || '').trim()
    const nc = glPeriod.get(acc.number) ?? 0

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
          plSectionTotals.push({ category: plSectionCategory, total: totalAmount })
          inPLSection = false
        }
      }
    } else if (inPLSection && accType !== 'heading') {
      if (relativeDepth > 0 && nc !== 0) {
        sumStack[relativeDepth - 1] = (sumStack[relativeDepth - 1] ?? 0) + nc
      }
    }
  }

  for (const st of plSectionTotals) {
    if (st.category === 'Income' || st.category === 'Revenue') totalRevenue += Math.abs(st.total)
    else if (st.category === 'Cost of Goods Sold') totalCOGS += Math.abs(st.total)
    else if (st.category === 'Expense') totalExpenses += Math.abs(st.total)
  }

  const grossProfit = totalRevenue - totalCOGS
  const netIncome = grossProfit - totalExpenses

  // Classify expense accounts for operating income (same approach as financial-summary route)
  const M_INTEREST_RE = /interest|finance charge|finance cost|bank charge/i
  const M_TAX_RE = /income tax|tax expense|federal tax|state tax|corporate tax/i
  const M_DA_RE = /depreciation|amortization|amortisation|depletion/i
  const M_ACCUMULATED_RE = /accumulated/i
  const M_NON_OP_RE = /foreign exchange|forex|fx gain|fx loss|other income|other expense/i
  const M_NON_OP_SUB_RE = /other income|other expense/i

  let mInterest = 0,
    mTax = 0,
    mDA = 0,
    mOtherNonOp = 0
  for (const acc of sorted) {
    const cat = decodeOData(acc.category || '').trim()
    if (cat !== 'Expense') continue
    const at = decodeOData(acc.accountType || '').toLowerCase()
    if (at !== 'posting') continue
    const nc = glPeriod.get(acc.number) ?? 0
    if (nc === 0) continue
    const amt = Math.abs(nc)
    const name = acc.displayName || acc.number || ''
    const sub = decodeOData(acc.subCategory || '').trim()
    const nameAndSub = `${name} ${sub}`
    if (!M_ACCUMULATED_RE.test(name) && M_DA_RE.test(nameAndSub)) {
      mDA += amt
    } else if (M_INTEREST_RE.test(nameAndSub)) {
      mInterest += amt
    } else if (M_TAX_RE.test(nameAndSub)) {
      mTax += amt
    } else if (M_NON_OP_RE.test(name) || (sub && M_NON_OP_SUB_RE.test(sub))) {
      mOtherNonOp += amt
    }
  }
  const mNonOpTotal = mInterest + mTax + mOtherNonOp
  const operatingExpenses = totalExpenses - mNonOpTotal
  const operatingIncome = grossProfit - operatingExpenses
  const ebitda = operatingIncome + mDA

  // Add net income to equity
  equity += netIncome

  // 6. Determine which data groups this metric needs, then fetch only those
  const AR_AP_METRICS = [
    'dso',
    'dpo',
    'accounts_receivable',
    'accounts_payable',
    'receivables_turnover',
    'payables_turnover',
    'cash_conversion_cycle',
  ]
  const CASH_METRICS = [
    'cash_balance',
    'burn_rate',
    'cash_runway',
    'cash_ratio',
    'cash_flow_margin',
    'free_cash_flow',
    'operating_cash_flow',
  ]
  const INVENTORY_METRICS = ['inventory_turnover', 'quick_ratio', 'cash_conversion_cycle']

  // Unknown metrics (no match) fetch everything to be safe
  const needsArAp = AR_AP_METRICS.includes(resolvedId) || !resolved
  const needsCash = CASH_METRICS.includes(resolvedId) || !resolved
  const needsInventory = INVENTORY_METRICS.includes(resolvedId) || !resolved

  logger.info('[Tool:BC:Metric] Fetch groups determined', {
    correlationId: context.correlationId,
    resolvedId,
    groups: {
      gl: true,
      ar_ap: needsArAp,
      cash: needsCash,
      inventory: needsInventory,
    },
  })

  // Fetch AR/AP and Cash groups in parallel (only if needed)
  // Only fetch invoices for AR/AP metrics (burn rate now uses P&L expenses, no invoices needed)
  const metricInvoiceStep = profiler?.step('metric_fetch_conditional_groups')
  const [openSalesInvoices, openPurchaseInvoices] = await Promise.all([
    needsArAp
      ? client.listSalesInvoices({ $filter: "status eq 'Open'" }).catch(() => [])
      : Promise.resolve([]),
    needsArAp
      ? client.listPurchaseInvoices({ $filter: "status eq 'Open'" }).catch(() => [])
      : Promise.resolve([]),
  ])
  metricInvoiceStep?.end({
    openSales: openSalesInvoices.length,
    openPurchases: openPurchaseInvoices.length,
    skippedArAp: !needsArAp,
  })

  const accountsReceivable = openSalesInvoices.reduce(
    (sum: number, inv: any) => sum + (inv.totalAmountIncludingTax ?? inv.totalAmount ?? 0),
    0
  )
  const accountsPayable = openPurchaseInvoices.reduce(
    (sum: number, inv: any) => sum + (inv.totalAmountIncludingTax ?? inv.totalAmount ?? 0),
    0
  )

  // Classify accounts using shared helper (matches platform cash-flow-indirect route)
  const metricAccountMap = classifyBCAccounts(allAccounts)

  // Cash balance: derive from cumulative GL on cash-classified accounts
  let cashBalance = 0
  if (needsCash) {
    let matchedAccounts = 0
    for (const [accNum, meta] of metricAccountMap) {
      if (meta.activity === 'cash') {
        cashBalance += glCumulative.get(accNum) ?? 0
        matchedAccounts++
      }
    }
    logger.info('[Tool:BC:Metric] Cash balance from GL cash/bank accounts', {
      correlationId: context.correlationId,
      cashBalance,
      matchedAccounts,
    })
  }

  // Burn rate and runway — uses indirect cash flow method (matching platform dashboard):
  // OCF = Net Income + Depreciation + Working Capital Changes
  // FCF = OCF - CapEx
  // Burn Rate = |Monthly FCF| when FCF < 0
  let grossBurnRate = 0
  let netBurnRate = 0
  let monthlyRevenueAmt = 0
  let cashRunwayMonths: number | null = null
  let periodDays = 365
  let periodMonths = 12
  let operatingCashFlow = 0
  let freeCashFlow = 0
  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    periodDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    // Use actual months with GL data (matches platform's trend.months.length)
    periodMonths = Math.max(
      1,
      glPeriodMonths.size ||
        Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    )

    // Compute working capital changes and capex from period GL (same as cash-flow-indirect route)
    let arChange = 0
    let apChange = 0
    let inventoryChange = 0
    let otherWcChange = 0
    let fixedAssetChange = 0
    let cfDepreciation = 0 // accumulated depreciation from asset contra-accounts
    for (const [accNum, meta] of metricAccountMap) {
      if (meta.activity === 'skip' || meta.activity === 'cash') continue
      // Skip P&L accounts — already handled by hierarchy walk
      if (
        meta.category === 'Income' ||
        meta.category === 'Revenue' ||
        meta.category === 'Expense' ||
        meta.category === 'Cost of Goods Sold'
      )
        continue
      const periodBal = glPeriod.get(accNum) ?? 0
      if (periodBal === 0) continue

      const sub = meta.subCategory.toLowerCase()
      const accName = meta.displayName.toLowerCase()
      if (meta.category === 'Assets' && meta.activity === 'operating') {
        if (
          sub.includes('receivable') ||
          sub.includes('due from') ||
          sub.includes('due to') ||
          sub.includes('related companies') ||
          sub.includes('intercompany')
        ) {
          arChange += -periodBal
        } else if (sub.includes('inventory')) {
          inventoryChange += -periodBal
        } else {
          otherWcChange += -periodBal
        }
      } else if (meta.category === 'Liabilities' && meta.activity === 'operating') {
        if (
          sub.includes('payable') ||
          sub.includes('due from') ||
          sub.includes('due to') ||
          sub.includes('related companies') ||
          sub.includes('intercompany')
        ) {
          apChange += -periodBal
        } else {
          otherWcChange += -periodBal
        }
      }
    }

    // OCF = Net Income + D&A (from P&L + accumulated depreciation) + WC Changes
    // Matches cash-flow-indirect route which captures D&A from both expense and contra-asset accounts
    operatingCashFlow =
      netIncome + mDA + cfDepreciation + arChange + apChange + inventoryChange + otherWcChange
    // FCF = OCF - CapEx
    const capex = Math.max(fixedAssetChange, 0)
    freeCashFlow = operatingCashFlow - capex

    const monthlyFCF = freeCashFlow / periodMonths
    // Burn rate = |monthly FCF| when negative (matching platform)
    grossBurnRate = monthlyFCF < 0 ? Math.abs(monthlyFCF) : 0
    monthlyRevenueAmt = totalRevenue / periodMonths
    netBurnRate = grossBurnRate // burn rate IS the net cash consumption
    // Runway = Cash / Burn Rate (null if not burning)
    cashRunwayMonths = grossBurnRate > 0 ? cashBalance / grossBurnRate : null
  }

  // 7. Fetch inventory (only when needed)
  let inventoryValue = 0
  let ledgerBasedCOGS: number | null = null
  if (needsInventory) {
    const inventoryStep = profiler?.step('metric_fetch_inventory')
    try {
      // Fetch items + ledger entries in parallel (mirrors API route exactly).
      // ALL entries for inventory valuation, date-filtered for COGS.
      const ledgerFilter: string[] = []
      if (startDate) ledgerFilter.push(`postingDate ge ${startDate}`)
      if (endDate) ledgerFilter.push(`postingDate le ${endDate}`)
      const hasDateFilter = ledgerFilter.length > 0
      const [items, allLedgerResult, filteredLedgerResult] = await Promise.all([
        client.listItems({ $select: 'number,inventory,unitCost' }),
        client.queryAll('itemLedgerEntries').catch(() => [] as any[]),
        hasDateFilter
          ? client
              .queryAll('itemLedgerEntries', { $filter: ledgerFilter.join(' and ') })
              .catch(() => [] as any[])
          : Promise.resolve([] as any[]),
      ])
      const allLedgerEntries = allLedgerResult
      const periodEntries = hasDateFilter ? filteredLedgerResult : allLedgerEntries

      // Inventory value from ledger-based costAmountActual (matches API route)
      const costByItem: Record<string, number> = {}
      for (const e of allLedgerEntries) {
        const itemNo = e.itemNumber || ''
        if (!itemNo) continue
        costByItem[itemNo] = (costByItem[itemNo] ?? 0) + (e.costAmountActual ?? 0)
      }
      inventoryValue = items.reduce((sum: number, item: any) => {
        const itemNo = item.number || ''
        return (
          sum +
          (itemNo in costByItem ? costByItem[itemNo] : (item.inventory ?? 0) * (item.unitCost ?? 0))
        )
      }, 0)

      // COGS from date-filtered Sale entries (absolute costAmountActual)
      if (periodEntries.length > 0) {
        ledgerBasedCOGS = periodEntries
          .filter((e: any) => e.entryType === 'Sale')
          .reduce((s: number, e: any) => s + Math.abs(e.costAmountActual ?? 0), 0)
      }

      inventoryStep?.end({ itemCount: items.length, inventoryValue, ledgerCOGS: ledgerBasedCOGS })
    } catch {
      // Fall back to GL-based inventory value
      inventoryValue = inventoryForRatios
      inventoryStep?.end({ error: 'items fetch failed', fallbackToGL: inventoryValue })
      logger.warn(
        '[Tool:BC:Metric] Failed to fetch items for inventory metrics, using GL fallback',
        {
          correlationId: context.correlationId,
          glInventoryValue: inventoryValue,
        }
      )
    }
  }

  // No-data detection for metrics
  if (glEntries.length === 0 && totalRevenue === 0 && totalExpenses === 0) {
    const periodStr = startDate && endDate ? `${startDate} to ${endDate}` : 'the requested period'
    logger.warn('[Tool:BC:Metric] No data found for metric query', {
      correlationId: context.correlationId,
      requested: rawMetricName,
      resolvedId,
      period: periodStr,
    })
    return {
      success: true,
      queryType: 'metric',
      data: {},
      summary: {
        metricName: resolvedId,
        noData: true,
        message: `No financial data exists for ${periodStr}. There are no transactions in Business Central for this date range. Ask the user to try a more recent period.`,
        queriedPeriod: { startDate, endDate },
      },
      currency: context.currency,
      sources: [`Business Central API (${context.environmentName})`],
      generated: new Date().toISOString(),
    }
  }

  // 8. Compute metrics — only include metrics whose data group was fetched.
  //    Skipped groups are omitted entirely so the LLM doesn't see misleading zeros.
  const dailyRevenue = periodDays > 0 ? totalRevenue / periodDays : 0
  const dailyCOGS = periodDays > 0 ? totalCOGS / periodDays : 0

  // GL metrics (always computed)
  const metrics: Record<string, number | string | null> = {
    // Absolute values
    revenue: totalRevenue,
    cogs: totalCOGS,
    gross_profit: grossProfit,
    operating_expenses: operatingExpenses,
    expenses: totalExpenses,
    operating_income: operatingIncome,
    net_income: netIncome,
    ebitda,
    interest_expense: mInterest,
    tax_expense: mTax,
    depreciation_amortization: mDA,
    other_non_operating: mOtherNonOp,
    // Profitability ratios
    gross_margin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
    operating_margin: totalRevenue > 0 ? (operatingIncome / totalRevenue) * 100 : 0,
    ebitda_margin: totalRevenue > 0 ? (ebitda / totalRevenue) * 100 : 0,
    net_margin: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
    roa: assets > 0 ? (netIncome / assets) * 100 : 0,
    roe: equity > 0 ? (netIncome / equity) * 100 : 0,
    // Balance sheet
    total_assets: assets,
    total_liabilities: liabilities,
    equity,
    // Liquidity (current assets/liabilities from GL subCategory classification)
    current_ratio: currentLiabilities > 0 ? currentAssets / currentLiabilities : 0,
    quick_ratio:
      currentLiabilities > 0 ? (currentAssets - inventoryForRatios) / currentLiabilities : 0,
    working_capital: currentAssets - currentLiabilities,
    current_assets: currentAssets,
    current_liabilities: currentLiabilities,
    inventory: inventoryForRatios,
    debt_to_equity: equity > 0 ? liabilities / equity : 0,
    debt_ratio: assets > 0 ? (liabilities / assets) * 100 : 0,
    equity_ratio: assets > 0 ? (equity / assets) * 100 : 0,
    // Efficiency (GL-only)
    asset_turnover: assets > 0 ? totalRevenue / assets : 0,
    // Leverage
    interest_coverage: mInterest > 0 ? operatingIncome / mInterest : null,
  }

  // AR/AP metrics (only when invoices were fetched)
  if (needsArAp) {
    metrics.accounts_receivable = accountsReceivable
    metrics.accounts_payable = accountsPayable
    metrics.dso = dailyRevenue > 0 ? accountsReceivable / dailyRevenue : null
    metrics.dpo = dailyCOGS > 0 ? accountsPayable / dailyCOGS : null
    metrics.receivables_turnover = accountsReceivable > 0 ? totalRevenue / accountsReceivable : null
    metrics.payables_turnover = accountsPayable > 0 ? totalCOGS / accountsPayable : null
  }

  // Cash metrics (only when cash group was fetched)
  if (needsCash) {
    metrics.cash_balance = cashBalance
    metrics.monthly_revenue = monthlyRevenueAmt
    metrics.operating_cash_flow = operatingCashFlow
    metrics.free_cash_flow = freeCashFlow
    metrics.gross_burn_rate = grossBurnRate
    metrics.net_burn_rate = netBurnRate
    metrics.burn_rate = grossBurnRate
    metrics.cash_runway = cashRunwayMonths
    metrics.cash_ratio = liabilities > 0 ? cashBalance / liabilities : null
  }

  // Inventory metrics (only when items were fetched)
  if (needsInventory) {
    // Use annualized ledger-based COGS for turnover (matches UI inventory-enhanced route)
    if (ledgerBasedCOGS != null && inventoryValue > 0) {
      const annFactor = periodDays > 0 ? 365 / periodDays : 1
      metrics.inventory_turnover =
        Math.round(((ledgerBasedCOGS * annFactor) / inventoryValue) * 100) / 100
    } else {
      // Fallback to GL COGS / GL inventory
      metrics.inventory_turnover = inventoryValue > 0 ? totalCOGS / inventoryValue : null
    }
    metrics.quick_ratio = liabilities > 0 ? (assets - inventoryValue) / liabilities : null
  }

  // Composite metrics (need multiple groups)
  if (needsArAp && needsInventory) {
    const dso = dailyRevenue > 0 ? accountsReceivable / dailyRevenue : null
    const dpo = dailyCOGS > 0 ? accountsPayable / dailyCOGS : null
    const dio = dailyCOGS > 0 && inventoryValue > 0 ? inventoryValue / dailyCOGS : null
    metrics.cash_conversion_cycle =
      dso != null && dpo != null && dio != null ? dso + dio - dpo : null
  }

  logger.info('[Tool:BC:Metric] Computation complete', {
    correlationId: context.correlationId,
    requested: rawMetricName,
    resolvedId,
    computedMetrics: Object.keys(metrics).length,
    hasData: glEntries.length > 0,
  })

  return {
    success: true,
    queryType: 'metric',
    data: metrics,
    summary: {
      metricName: resolvedId,
      requestedAs: rawMetricName !== resolvedId ? rawMetricName : undefined,
      resolvedFrom: resolved?.matchType || 'none',
      computedMetrics: Object.keys(metrics).length,
      period: { startDate, endDate },
      dataFetched: {
        gl: true,
        invoices: needsArAp,
        bankAccounts: needsCash,
        inventory: needsInventory,
      },
      note: !needsCash
        ? 'Cash balance, burn rate, and runway were NOT fetched — do not assume they are zero. Use queryType "metric" with metricName "cash_balance" to get actual cash data.'
        : !needsArAp
          ? 'AR/AP metrics were NOT fetched — do not assume they are zero. Use queryType "metric" with metricName "dso" to get actual AR/AP data.'
          : undefined,
    },
    currency: context.currency,
    sources: [`Business Central API (${context.environmentName})`],
    generated: new Date().toISOString(),
  }
}

/**
 * Handle search queries: search across multiple entity types
 */
async function handleSearchQuery(
  client: BusinessCentralClient,
  input: BCDataInput,
  context: BCApiContext
): Promise<BCQueryResult> {
  const searchTerm = input.searchText || ''
  if (!searchTerm) {
    return {
      success: false,
      queryType: 'search',
      data: [],
      summary: { error: 'Search term is required' },
      sources: [],
      generated: new Date().toISOString(),
      error: 'Search term is required',
    }
  }

  const escaped = searchTerm.replace(/'/g, "''")

  // Search entities + documents in parallel. Document search uses number eq (exact match)
  // since document numbers are precise identifiers (e.g., "PRCP100838", "PINV2412-0003").
  const looksLikeDocNumber = /^[A-Z]{2,}[\d-]+/i.test(searchTerm)

  // BC OData doesn't support OR across distinct fields, so search by name and number separately
  const [custByName, custByNumber, vendByName, vendByNumber, items, accounts, ...docResults] =
    await Promise.all([
      client
        .listCustomers({
          $filter: `contains(displayName, '${escaped}')`,
          $top: 10,
        })
        .catch(() => []),
      client
        .listCustomers({
          $filter: `number eq '${escaped}'`,
          $top: 1,
        })
        .catch(() => []),
      client
        .listVendors({
          $filter: `contains(displayName, '${escaped}')`,
          $top: 10,
        })
        .catch(() => []),
      client
        .listVendors({
          $filter: `number eq '${escaped}'`,
          $top: 1,
        })
        .catch(() => []),
      client
        .listItems({
          $filter: `contains(displayName, '${escaped}') or contains(number, '${escaped}')`,
          $top: 10,
        })
        .catch(() => []),
      client
        .listAccounts({
          $filter: `contains(name, '${escaped}')`,
          $top: 10,
        })
        .catch(() => []),
      // Document searches — only when the search term looks like a document number
      ...(looksLikeDocNumber
        ? [
            client
              .query('salesInvoices', { $filter: `number eq '${escaped}'`, $top: 5 })
              .then((r: any) => r.value || [])
              .catch(() => []),
            client
              .query('purchaseInvoices', { $filter: `number eq '${escaped}'`, $top: 5 })
              .then((r: any) => r.value || [])
              .catch(() => []),
            client
              .query('purchaseReceipts', { $filter: `number eq '${escaped}'`, $top: 5 })
              .then((r: any) => r.value || [])
              .catch(() => []),
            client
              .query('purchaseOrders', { $filter: `number eq '${escaped}'`, $top: 5 })
              .then((r: any) => r.value || [])
              .catch(() => []),
            client
              .query('salesCreditMemos', { $filter: `number eq '${escaped}'`, $top: 5 })
              .then((r: any) => r.value || [])
              .catch(() => []),
            client
              .query('purchaseCreditMemos', { $filter: `number eq '${escaped}'`, $top: 5 })
              .then((r: any) => r.value || [])
              .catch(() => []),
          ]
        : []),
    ])

  const salesInvoices = docResults[0] || []
  const purchaseInvoices = docResults[1] || []
  const purchaseReceipts = docResults[2] || []
  const purchaseOrders = docResults[3] || []
  const salesCreditMemos = docResults[4] || []
  const purchaseCreditMemos = docResults[5] || []

  // Merge name and number search results, deduplicating by id
  const dedup = (byName: any[], byNum: any[]) => {
    const ids = new Set(byName.map((x: any) => x.id))
    return [...byName, ...byNum.filter((x: any) => !ids.has(x.id))]
  }
  const customers = dedup(custByName, custByNumber)
  const vendors = dedup(vendByName, vendByNumber)

  const results: Record<string, any[]> = {
    customers: customers.map((c: any) => ({ type: 'customer', ...c })),
    vendors: vendors.map((v: any) => ({ type: 'vendor', ...v })),
    items: items.map((i: any) => ({ type: 'item', ...i })),
    accounts: accounts.map((a: any) => ({ type: 'account', ...a })),
  }

  // Add document results if any found
  if (salesInvoices.length)
    results.salesInvoices = salesInvoices.map((d: any) => ({ type: 'sales_invoice', ...d }))
  if (purchaseInvoices.length)
    results.purchaseInvoices = purchaseInvoices.map((d: any) => ({
      type: 'purchase_invoice',
      ...d,
    }))
  if (purchaseReceipts.length)
    results.purchaseReceipts = purchaseReceipts.map((d: any) => ({
      type: 'purchase_receipt',
      ...d,
    }))
  if (purchaseOrders.length)
    results.purchaseOrders = purchaseOrders.map((d: any) => ({ type: 'purchase_order', ...d }))
  if (salesCreditMemos.length)
    results.salesCreditMemos = salesCreditMemos.map((d: any) => ({
      type: 'sales_credit_memo',
      ...d,
    }))
  if (purchaseCreditMemos.length)
    results.purchaseCreditMemos = purchaseCreditMemos.map((d: any) => ({
      type: 'purchase_credit_memo',
      ...d,
    }))

  const totalDocuments =
    salesInvoices.length +
    purchaseInvoices.length +
    purchaseReceipts.length +
    purchaseOrders.length +
    salesCreditMemos.length +
    purchaseCreditMemos.length

  return {
    success: true,
    queryType: 'search',
    data: results,
    summary: {
      searchTerm,
      customers: customers.length,
      vendors: vendors.length,
      items: items.length,
      accounts: accounts.length,
      documents: totalDocuments,
      totalResults:
        customers.length + vendors.length + items.length + accounts.length + totalDocuments,
    },
    currency: context.currency,
    sources: [`Business Central API (${context.environmentName})`],
    generated: new Date().toISOString(),
  }
}

/**
 * Resolve a vendor by name when vendorId is not available.
 * Uses partial match (contains). Also checks if the name exists as a customer
 * (same entity can be both in BC) and includes that info to prevent wrong-side lookups.
 */
async function resolveVendorByName(
  client: BusinessCentralClient,
  vendorName: string
): Promise<{ resolved?: any; candidates?: any[]; error?: string; alsoExistsAsCustomer?: any }> {
  const t0 = Date.now()
  const escaped = vendorName.replace(/'/g, "''")

  // Search vendors by name, by number, and customers by name in parallel
  // BC OData doesn't support OR across distinct fields on any entity
  const [vendByName, vendByNumber, customerResult] = await Promise.all([
    client.query('vendors', {
      $filter: `contains(displayName, '${escaped}')`,
      $select: 'id,number,displayName,email,phoneNumber,balance',
      $top: 10,
    }),
    client
      .query('vendors', {
        $filter: `number eq '${escaped}'`,
        $select: 'id,number,displayName,email,phoneNumber,balance',
        $top: 1,
      })
      .catch(() => ({ value: [] })),
    client.query('customers', {
      $filter: `contains(displayName, '${escaped}')`,
      $select: 'id,number,displayName,balanceDue',
      $top: 3,
    }),
  ])

  // Prefer name matches; fall back to number match if name finds nothing
  const vendors = (vendByName.value || []).length > 0 ? vendByName.value : vendByNumber.value || []
  const customers = customerResult.value || []
  const ms = Date.now() - t0

  const alsoCustomer = customers.length > 0 ? customers[0] : undefined

  if (vendors.length === 1) {
    logger.info('[BC:SmartSearch] Vendor resolved by name', {
      searchTerm: vendorName,
      resolved: vendors[0].displayName,
      vendorId: vendors[0].id,
      vendorNumber: vendors[0].number,
      alsoExistsAsCustomer: !!alsoCustomer,
      durationMs: ms,
    })
    return { resolved: vendors[0], alsoExistsAsCustomer: alsoCustomer }
  }
  if (vendors.length > 1) {
    logger.info('[BC:SmartSearch] Multiple vendor matches — returning candidates', {
      searchTerm: vendorName,
      matchCount: vendors.length,
      candidates: vendors.map((v: any) => v.displayName),
      durationMs: ms,
    })
    return { candidates: vendors }
  }

  // No vendor match — but might exist as customer only
  if (alsoCustomer) {
    logger.info('[BC:SmartSearch] No vendor match but found as customer', {
      searchTerm: vendorName,
      customerName: alsoCustomer.displayName,
      durationMs: ms,
    })
    return {
      error: `"${vendorName}" was not found as a vendor but exists as a customer (${alsoCustomer.displayName}, #${alsoCustomer.number}). Use customer_detail with customerNumber "${alsoCustomer.number}" instead.`,
    }
  }

  logger.info('[BC:SmartSearch] No vendor or customer match found', {
    searchTerm: vendorName,
    durationMs: ms,
  })
  return {
    error: `No vendor found matching "${vendorName}". Check the spelling or try a shorter name.`,
  }
}

/**
 * Resolve a customer by name when customerId/customerNumber is not available.
 * Uses partial match (contains). Also checks if the name exists as a vendor
 * to prevent wrong-side lookups.
 */
async function resolveCustomerByName(
  client: BusinessCentralClient,
  customerName: string
): Promise<{ resolved?: any; candidates?: any[]; error?: string; alsoExistsAsVendor?: any }> {
  const t0 = Date.now()
  const escaped = customerName.replace(/'/g, "''")

  // Search customers by name, by number, and vendors by name in parallel
  // BC OData doesn't support OR across distinct fields on any entity
  const [custByName, custByNumber, vendorResult] = await Promise.all([
    client.query('customers', {
      $filter: `contains(displayName, '${escaped}')`,
      $select: 'id,number,displayName,email,phoneNumber,balanceDue',
      $top: 10,
    }),
    client
      .query('customers', {
        $filter: `number eq '${escaped}'`,
        $select: 'id,number,displayName,email,phoneNumber,balanceDue',
        $top: 1,
      })
      .catch(() => ({ value: [] })),
    client.query('vendors', {
      $filter: `contains(displayName, '${escaped}')`,
      $select: 'id,number,displayName,balance',
      $top: 3,
    }),
  ])

  // Prefer name matches; fall back to number match if name finds nothing
  const customers =
    (custByName.value || []).length > 0 ? custByName.value : custByNumber.value || []
  const vendors = vendorResult.value || []
  const ms = Date.now() - t0

  const alsoVendor = vendors.length > 0 ? vendors[0] : undefined

  if (customers.length === 1) {
    logger.info('[BC:SmartSearch] Customer resolved by name', {
      searchTerm: customerName,
      resolved: customers[0].displayName,
      customerId: customers[0].id,
      customerNumber: customers[0].number,
      alsoExistsAsVendor: !!alsoVendor,
      durationMs: ms,
    })
    return { resolved: customers[0], alsoExistsAsVendor: alsoVendor }
  }
  if (customers.length > 1) {
    logger.info('[BC:SmartSearch] Multiple customer matches — returning candidates', {
      searchTerm: customerName,
      matchCount: customers.length,
      candidates: customers.map((c: any) => c.displayName),
      durationMs: ms,
    })
    return { candidates: customers }
  }

  // No customer match — but might exist as vendor only
  if (alsoVendor) {
    logger.info('[BC:SmartSearch] No customer match but found as vendor', {
      searchTerm: customerName,
      vendorName: alsoVendor.displayName,
      durationMs: ms,
    })
    return {
      error: `"${customerName}" was not found as a customer but exists as a vendor (${alsoVendor.displayName}, #${alsoVendor.number}). Use vendor_detail with vendorName "${alsoVendor.displayName}" instead.`,
    }
  }

  logger.info('[BC:SmartSearch] No customer or vendor match found', {
    searchTerm: customerName,
    durationMs: ms,
  })
  return {
    error: `No customer found matching "${customerName}". Check the spelling or try a shorter name.`,
  }
}

/**
 * Handle detail queries: deep drilldown into a specific entity with full context.
 * Mirrors the page-level detail endpoints (customer-detail, vendor-detail, etc.)
 * Supports name-based lookup: vendorName/customerName resolved to ID internally.
 */
async function handleDetailQuery(
  client: BusinessCentralClient,
  input: BCDataInput,
  context: BCApiContext,
  profiler?: QueryProfiler
): Promise<BCQueryResult> {
  const detailType = (input as any).detailType || 'customer_detail'
  const { startDate, endDate } = resolveDates(input)

  switch (detailType) {
    case 'customer_detail': {
      // Full customer profile with invoices, credit memos, shipments, and aged AR
      // Accepts customerId (GUID), customerNumber, or customerName (resolved via partial match)
      let custNumber = (input as any).customerNumber
      let custId = (input as any).customerId
      const customerNameInput = (input as any).customerName || input.filters?.customerName

      if (!custNumber && !custId && customerNameInput) {
        // Resolve customer by name
        const resolution = await resolveCustomerByName(client, customerNameInput)
        if (resolution.error) {
          return {
            success: false,
            queryType: 'detail',
            data: [],
            summary: { error: resolution.error },
            sources: [],
            generated: new Date().toISOString(),
            error: resolution.error,
          }
        }
        if (resolution.candidates) {
          return {
            success: true,
            queryType: 'detail',
            data: resolution.candidates,
            summary: {
              detailType: 'customer_detail',
              message: `Multiple customers match "${customerNameInput}". Please specify which one.`,
              matchCount: resolution.candidates.length,
              candidates: resolution.candidates.map((c: any) => ({
                customerId: c.id,
                customerNumber: c.number,
                displayName: c.displayName,
                balanceDue: c.balanceDue,
              })),
            },
            sources: [`Business Central API (${context.environmentName})`],
            generated: new Date().toISOString(),
          }
        }
        // Single match — use the resolved customer's number
        custNumber = resolution.resolved!.number
      }

      if (!custNumber && !custId) {
        return {
          success: false,
          queryType: 'detail',
          data: [],
          summary: {
            error: 'customerNumber, customerId, or customerName is required for customer_detail',
          },
          sources: [],
          generated: new Date().toISOString(),
          error: 'customerNumber, customerId, or customerName is required',
        }
      }

      const fetchStep = profiler?.step('customer_detail_fetch')
      const custFilter = custNumber
        ? `number eq '${custNumber.replace(/'/g, "''")}'`
        : `id eq ${custId}`
      const [customers, invoices, creditMemos, shipments, agedAR] = await Promise.allSettled([
        client.listCustomers({ $filter: custFilter }),
        client.listSalesInvoices({
          $filter: custNumber
            ? `customerNumber eq '${custNumber.replace(/'/g, "''")}'`
            : `customerId eq ${custId}`,
          $select:
            'id,number,postingDate,dueDate,customerName,totalAmountIncludingTax,remainingAmount,status,currencyCode',
          $orderby: 'postingDate desc',
          $top: input.limit || 100,
        }),
        client
          .queryAll('salesCreditMemos', {
            $filter: custNumber
              ? `customerNumber eq '${custNumber.replace(/'/g, "''")}'`
              : `customerId eq ${custId}`,
            $select: 'id,number,postingDate,amount,currencyCode',
            $top: input.limit || 100,
          })
          .catch(() => []),
        client
          .queryAll('salesShipments', {
            $filter: custNumber
              ? `customerNumber eq '${custNumber.replace(/'/g, "''")}'`
              : `customerId eq ${custId}`,
            $select: 'id,number,postingDate,orderNumber',
            $top: input.limit || 100,
          })
          .catch(() => []),
        client.getAgedAccountsReceivable({
          $filter: custNumber ? `customerNumber eq '${custNumber.replace(/'/g, "''")}'` : undefined,
        }),
      ])
      fetchStep?.end()

      const customer =
        customers.status === 'fulfilled' && customers.value.length > 0 ? customers.value[0] : null
      const invList = invoices.status === 'fulfilled' ? invoices.value : []
      const cmList = creditMemos.status === 'fulfilled' ? creditMemos.value : []
      const shipList = shipments.status === 'fulfilled' ? shipments.value : []
      const arData = agedAR.status === 'fulfilled' ? agedAR.value : { total: null, records: [] }

      // Filter aged AR to this customer (remove BC's all-zeros total row)
      const custAR =
        (arData as any).records?.find?.(
          (r: any) =>
            (custNumber && r.customerNumber === custNumber) || (custId && r.customerId === custId)
        ) || null

      const totalInvoiced = invList.reduce(
        (s: number, i: any) => s + (i.totalAmountIncludingTax || 0),
        0
      )
      const totalCredited = cmList.reduce((s: number, i: any) => s + (i.amount || 0), 0)
      const totalRemaining = invList.reduce((s: number, i: any) => s + (i.remainingAmount || 0), 0)
      const totalPaymentsReceived = totalInvoiced - totalRemaining

      return {
        success: true,
        queryType: 'detail',
        data: {
          customer,
          invoices: invList,
          creditMemos: cmList,
          shipments: shipList,
          agedReceivable: custAR,
          summary: {
            totalInvoiced,
            totalCredited,
            netInvoiceSales: totalInvoiced - totalCredited,
            totalPaymentsReceived,
            totalRemaining,
            invoiceCount: invList.length,
            creditMemoCount: cmList.length,
            shipmentCount: shipList.length,
          },
        },
        summary: {
          detailType: 'customer_detail',
          customerName: customer?.displayName || custNumber || custId,
          totalInvoiced,
          totalPaymentsReceived,
          totalRemaining,
          invoiceCount: invList.length,
        },
        currency: context.currency,
        sources: [`Business Central API (${context.environmentName})`],
        generated: new Date().toISOString(),
      }
    }

    case 'vendor_detail': {
      // Full vendor profile with invoices, orders, credit memos, receipts, and aged AP
      // Accepts vendorId (GUID), vendorNumber, or vendorName (resolved via partial match)
      let vendId = (input as any).vendorId
      const vendorNameInput = (input as any).vendorName || input.filters?.vendorName

      if (!vendId && vendorNameInput) {
        // Resolve vendor by name
        const resolution = await resolveVendorByName(client, vendorNameInput)
        if (resolution.error) {
          return {
            success: false,
            queryType: 'detail',
            data: [],
            summary: { error: resolution.error },
            sources: [],
            generated: new Date().toISOString(),
            error: resolution.error,
          }
        }
        if (resolution.candidates) {
          return {
            success: true,
            queryType: 'detail',
            data: resolution.candidates,
            summary: {
              detailType: 'vendor_detail',
              message: `Multiple vendors match "${vendorNameInput}". Please specify which one.`,
              matchCount: resolution.candidates.length,
              candidates: resolution.candidates.map((v: any) => ({
                vendorId: v.id,
                vendorNumber: v.number,
                displayName: v.displayName,
                balance: v.balance,
              })),
            },
            sources: [`Business Central API (${context.environmentName})`],
            generated: new Date().toISOString(),
          }
        }
        vendId = resolution.resolved!.id
      }

      if (!vendId) {
        return {
          success: false,
          queryType: 'detail',
          data: [],
          summary: { error: 'vendorId, vendorNumber, or vendorName is required for vendor_detail' },
          sources: [],
          generated: new Date().toISOString(),
          error: 'vendorId, vendorNumber, or vendorName is required',
        }
      }

      const fetchStep = profiler?.step('vendor_detail_fetch')

      // Phase 1: Fetch vendor profile first — need vendorNumber for receipt filter
      const vendorData = await client.getVendor(vendId, {
        $expand: 'currency,paymentTerm,paymentMethod',
      })
      const vendorNumber = vendorData?.number

      // Phase 2: Fetch all related data in parallel (now we have vendorNumber for receipts)
      const [invoices, orders, creditMemos, receipts, agedAP] = await Promise.allSettled([
        client.listPurchaseInvoices({
          $filter: `vendorId eq ${vendId}`,
          $orderby: 'invoiceDate desc',
          $top: input.limit || 100,
        }),
        client.listPurchaseOrders({
          $filter: `vendorId eq ${vendId}`,
          $top: input.limit || 50,
        }),
        client.listPurchaseCreditMemos({
          $filter: `vendorId eq ${vendId}`,
          $top: input.limit || 50,
        }),
        vendorNumber
          ? client
              .listPurchaseReceipts({
                $filter: `vendorNumber eq '${vendorNumber}'`,
                $orderby: 'postingDate desc',
                $top: input.limit || 100,
              })
              .catch(() => [])
          : Promise.resolve([]),
        client.getAgedAccountsPayable({
          $filter: `vendorId eq ${vendId}`,
        }),
      ])
      fetchStep?.end()

      const invList = invoices.status === 'fulfilled' ? invoices.value : []
      const orderList = orders.status === 'fulfilled' ? orders.value : []
      const cmList = creditMemos.status === 'fulfilled' ? creditMemos.value : []
      const filteredReceipts = receipts.status === 'fulfilled' ? receipts.value : []
      const apData = agedAP.status === 'fulfilled' ? agedAP.value : { total: null, records: [] }

      const vendorAP = (apData as any).records?.find?.((r: any) => r.vendorId === vendId) || null

      const totalInvoiced = invList.reduce(
        (s: number, i: any) => s + (i.totalAmountIncludingTax || i.totalAmount || 0),
        0
      )
      const totalCreditMemos = cmList.reduce(
        (s: number, i: any) => s + (i.totalAmountIncludingTax || i.totalAmount || 0),
        0
      )

      return {
        success: true,
        queryType: 'detail',
        data: {
          vendor: vendorData,
          invoices: invList,
          orders: orderList,
          creditMemos: cmList,
          receipts: filteredReceipts,
          agedPayable: vendorAP,
          summary: {
            totalInvoiced,
            totalCreditMemos,
            openOrders: orderList.length,
            invoiceCount: invList.length,
            orderCount: orderList.length,
            creditMemoCount: cmList.length,
            receiptCount: filteredReceipts.length,
          },
        },
        summary: {
          detailType: 'vendor_detail',
          vendorName: vendorData?.displayName || vendId,
          totalInvoiced,
          invoiceCount: invList.length,
          orderCount: orderList.length,
        },
        currency: context.currency,
        sources: [`Business Central API (${context.environmentName})`],
        generated: new Date().toISOString(),
      }
    }

    case 'account_detail': {
      // GL account drilldown with transaction history, monthly trend, sub-ledger context
      const accountNumber = (input as any).accountNumber
      if (!accountNumber) {
        return {
          success: false,
          queryType: 'detail',
          data: [],
          summary: { error: 'accountNumber is required for account_detail' },
          sources: [],
          generated: new Date().toISOString(),
          error: 'accountNumber is required',
        }
      }

      const fetchStep = profiler?.step('account_detail_fetch')
      const escapedAccNum = accountNumber.replace(/'/g, "''")

      // Fetch GL entries for this account + account metadata
      const [glEntries, allAccounts] = await Promise.all([
        client.listGeneralLedgerEntries({
          $filter: `accountNumber eq '${escapedAccNum}'${endDate ? ` and postingDate le ${endDate}` : ''}`,
          $select:
            'accountNumber,postingDate,documentNumber,documentType,description,debitAmount,creditAmount',
          $orderby: 'postingDate desc',
        }),
        client.queryAll('accounts', {
          $filter: `number eq '${escapedAccNum}'`,
          $select: 'number,displayName,accountType,category,subCategory,blocked',
        }),
      ])
      fetchStep?.end()

      const account = allAccounts.length > 0 ? allAccounts[0] : null
      const category = account ? decodeOData(account.category || '').trim() : ''
      const subCategory = account ? decodeOData(account.subCategory || '').toLowerCase() : ''

      // Separate period entries vs opening balance
      const periodEntries = startDate
        ? glEntries.filter((e: any) => e.postingDate >= startDate)
        : glEntries
      const preEntries = startDate ? glEntries.filter((e: any) => e.postingDate < startDate) : []

      // Opening balance
      const openingBalance = preEntries.reduce(
        (s: number, e: any) => s + (e.debitAmount ?? 0) - (e.creditAmount ?? 0),
        0
      )

      // Flow metrics
      const inflows = periodEntries.reduce((s: number, e: any) => s + (e.debitAmount ?? 0), 0)
      const outflows = periodEntries.reduce((s: number, e: any) => s + (e.creditAmount ?? 0), 0)
      const closingBalance = openingBalance + inflows - outflows

      // Monthly trend (last 12 months)
      const monthlyBalMap = new Map<string, number>()
      let runBal = 0
      const sortedByDate = [...glEntries].sort((a: any, b: any) =>
        (a.postingDate || '').localeCompare(b.postingDate || '')
      )
      for (const e of sortedByDate) {
        const month = (e.postingDate || '').substring(0, 7)
        if (!month) continue
        runBal += (e.debitAmount ?? 0) - (e.creditAmount ?? 0)
        monthlyBalMap.set(month, runBal)
      }
      const monthlyTrend = [...monthlyBalMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, balance]) => ({ month, balance: Math.round(balance * 100) / 100 }))

      // Document type breakdown
      const byDocType: Record<string, { count: number; totalDebit: number; totalCredit: number }> =
        {}
      for (const e of periodEntries) {
        const dt = e.documentType || 'Other'
        if (!byDocType[dt]) byDocType[dt] = { count: 0, totalDebit: 0, totalCredit: 0 }
        byDocType[dt].count++
        byDocType[dt].totalDebit += e.debitAmount ?? 0
        byDocType[dt].totalCredit += e.creditAmount ?? 0
      }

      return {
        success: true,
        queryType: 'detail',
        data: {
          account: account
            ? {
                number: account.number,
                displayName: account.displayName,
                category,
                subCategory: decodeOData(account.subCategory || ''),
                accountType: decodeOData(account.accountType || ''),
                blocked: account.blocked,
              }
            : null,
          flow: {
            opening: Math.round(openingBalance * 100) / 100,
            inflows: Math.round(inflows * 100) / 100,
            outflows: Math.round(outflows * 100) / 100,
            closing: Math.round(closingBalance * 100) / 100,
          },
          monthlyTrend,
          recentTransactions: periodEntries.slice(0, 50).map((e: any) => ({
            postingDate: e.postingDate,
            documentNumber: e.documentNumber,
            documentType: e.documentType,
            description: e.description,
            debitAmount: e.debitAmount,
            creditAmount: e.creditAmount,
          })),
          transactionCount: periodEntries.length,
          byDocumentType: Object.entries(byDocType).map(([type, v]) => ({
            type,
            count: v.count,
            totalDebit: Math.round(v.totalDebit * 100) / 100,
            totalCredit: Math.round(v.totalCredit * 100) / 100,
          })),
        },
        summary: {
          detailType: 'account_detail',
          accountNumber,
          accountName: account?.displayName || accountNumber,
          category,
          transactionCount: periodEntries.length,
          closingBalance: Math.round(closingBalance * 100) / 100,
        },
        currency: context.currency,
        sources: [`Business Central API (${context.environmentName})`],
        generated: new Date().toISOString(),
      }
    }

    case 'item_detail': {
      // Item with ledger entries, monthly movement breakdown, and dimensions.
      // Fetches ALL ledger entries (no date filter) so the item always has full history,
      // matching the inventory-item-detail page endpoint behavior.
      // Accepts itemNumber or itemName (partial match resolved to item number).
      let itemNumber = (input as any).itemNumber
      const itemNameInput = (input as any).itemName || input.filters?.itemName

      if (!itemNumber && itemNameInput) {
        // Resolve item by name (search displayName and number)
        const t0 = Date.now()
        const escaped = itemNameInput.replace(/'/g, "''")
        const result = await client.query('items', {
          $filter: `contains(displayName, '${escaped}') or contains(number, '${escaped}')`,
          $select: 'number,displayName,type,unitPrice,inventory',
          $top: 10,
        })
        const matches = result.value || []
        const ms = Date.now() - t0

        if (matches.length === 1) {
          logger.info('[BC:SmartSearch] Item resolved by name', {
            searchTerm: itemNameInput,
            resolved: matches[0].displayName,
            itemNumber: matches[0].number,
            durationMs: ms,
          })
          itemNumber = matches[0].number
        } else if (matches.length > 1) {
          logger.info('[BC:SmartSearch] Multiple item matches', {
            searchTerm: itemNameInput,
            matchCount: matches.length,
            durationMs: ms,
          })
          return {
            success: true,
            queryType: 'detail',
            data: matches,
            summary: {
              detailType: 'item_detail',
              message: `Multiple items match "${itemNameInput}". Please specify which one.`,
              matchCount: matches.length,
              candidates: matches.map((i: any) => ({
                itemNumber: i.number,
                displayName: i.displayName,
                unitPrice: i.unitPrice,
                inventory: i.inventory,
              })),
            },
            sources: [`Business Central API (${context.environmentName})`],
            generated: new Date().toISOString(),
          }
        } else {
          logger.info('[BC:SmartSearch] No item match found', {
            searchTerm: itemNameInput,
            durationMs: ms,
          })
          return {
            success: false,
            queryType: 'detail',
            data: [],
            summary: {
              error: `No item found matching "${itemNameInput}". Try a shorter name or the item number.`,
            },
            sources: [],
            generated: new Date().toISOString(),
            error: `No item found matching "${itemNameInput}"`,
          }
        }
      }

      if (!itemNumber) {
        return {
          success: false,
          queryType: 'detail',
          data: [],
          summary: { error: 'itemNumber or itemName is required for item_detail' },
          sources: [],
          generated: new Date().toISOString(),
          error: 'itemNumber or itemName is required',
        }
      }

      const fetchStep = profiler?.step('item_detail_fetch')
      const escapedItemNo = itemNumber.replace(/'/g, "''")

      const [items, ledgerEntries, dimensions] = await Promise.all([
        client.queryAll('items', { $filter: `number eq '${escapedItemNo}'` }),
        client
          .queryAll('itemLedgerEntries', {
            $filter: `itemNumber eq '${escapedItemNo}'`,
            $orderby: 'postingDate desc',
          })
          .catch(() => []),
        client
          .queryAll('defaultDimensions', {
            $filter: `parentId eq ${escapedItemNo}`,
          })
          .catch(() => []),
      ])
      fetchStep?.end()

      const item = items.length > 0 ? items[0] : null

      // Monthly movement breakdown — matches page endpoint format, plus qty for all types
      const monthlyMap: Record<
        string,
        {
          purchases_qty: number
          purchases_cost: number
          sales_qty: number
          sales_cost: number
          positive_adjustments_qty: number
          positive_adjustments_cost: number
          negative_adjustments_qty: number
          negative_adjustments_cost: number
          transfers_qty: number
          transfers_cost: number
          net_qty: number
        }
      > = {}
      let totalPurchased = 0,
        totalSold = 0,
        netMovement = 0
      let firstTx: string | null = null,
        lastTx: string | null = null

      for (const entry of ledgerEntries) {
        const month = (entry.postingDate || '').substring(0, 7)
        if (!month) continue
        if (!monthlyMap[month]) {
          monthlyMap[month] = {
            purchases_qty: 0,
            purchases_cost: 0,
            sales_qty: 0,
            sales_cost: 0,
            positive_adjustments_qty: 0,
            positive_adjustments_cost: 0,
            negative_adjustments_qty: 0,
            negative_adjustments_cost: 0,
            transfers_qty: 0,
            transfers_cost: 0,
            net_qty: 0,
          }
        }
        const entryType = (entry.entryType || '').toLowerCase()
        const qty = Math.abs(entry.quantity ?? 0)
        const cost = Math.abs(entry.costAmountActual ?? 0)
        const signedQty = entry.quantity ?? 0

        if (entryType.includes('purchase')) {
          monthlyMap[month].purchases_qty += qty
          monthlyMap[month].purchases_cost += cost
          totalPurchased += qty
        } else if (entryType.includes('sale')) {
          monthlyMap[month].sales_qty += qty
          monthlyMap[month].sales_cost += cost
          totalSold += qty
        } else if (entryType.includes('positive')) {
          monthlyMap[month].positive_adjustments_qty += qty
          monthlyMap[month].positive_adjustments_cost += cost
        } else if (entryType.includes('negative')) {
          monthlyMap[month].negative_adjustments_qty += qty
          monthlyMap[month].negative_adjustments_cost += cost
        } else if (entryType.includes('transfer')) {
          monthlyMap[month].transfers_qty += qty
          monthlyMap[month].transfers_cost += cost
        }
        // net_qty uses signed quantity so it captures the true net effect
        monthlyMap[month].net_qty += signedQty
        netMovement += signedQty

        const pd = entry.postingDate || ''
        if (!firstTx || pd < firstTx) firstTx = pd
        if (!lastTx || pd > lastTx) lastTx = pd
      }

      // Build movementByMonth with cumulative_balance
      let cumulativeBalance = 0
      const movementByMonth = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, d]) => {
          cumulativeBalance += d.net_qty
          return {
            month,
            purchases_qty: Math.round(d.purchases_qty * 100) / 100,
            purchases_cost: Math.round(d.purchases_cost * 100) / 100,
            sales_qty: Math.round(d.sales_qty * 100) / 100,
            sales_cost: Math.round(d.sales_cost * 100) / 100,
            positive_adjustments_qty: Math.round(d.positive_adjustments_qty * 100) / 100,
            positive_adjustments_cost: Math.round(d.positive_adjustments_cost * 100) / 100,
            negative_adjustments_qty: Math.round(d.negative_adjustments_qty * 100) / 100,
            negative_adjustments_cost: Math.round(d.negative_adjustments_cost * 100) / 100,
            transfers_cost: Math.round(d.transfers_cost * 100) / 100,
            net_qty: Math.round(d.net_qty * 100) / 100,
            cumulative_balance: Math.round(cumulativeBalance * 100) / 100,
          }
        })

      // Average selling price from sale-type entries
      const salesEntries = ledgerEntries.filter(
        (e: any) =>
          (e.entryType || '').toLowerCase().includes('sale') &&
          e.quantity !== 0 &&
          e.salesAmountActual !== 0
      )
      const avgSellingPrice =
        salesEntries.length > 0
          ? (() => {
              const totalSalesAmt = salesEntries.reduce(
                (s: number, e: any) => s + Math.abs(e.salesAmountActual ?? 0),
                0
              )
              const totalSalesQty = salesEntries.reduce(
                (s: number, e: any) => s + Math.abs(e.quantity ?? 0),
                0
              )
              return totalSalesQty > 0
                ? Math.round((totalSalesAmt / totalSalesQty) * 100) / 100
                : null
            })()
          : null

      // Inventory value — use ledger-based costAmountActual sum (matches inventory-enhanced page)
      const ledgerBasedValue = ledgerEntries.reduce(
        (s: number, e: any) => s + (e.costAmountActual ?? 0),
        0
      )
      const inventoryValue =
        ledgerEntries.length > 0
          ? Math.round(ledgerBasedValue * 100) / 100
          : (item?.inventory ?? 0) * (item?.unitCost ?? 0)

      return {
        success: true,
        queryType: 'detail',
        data: {
          item: item
            ? {
                number: item.number,
                displayName: item.displayName,
                type: item.type,
                itemCategoryCode: item.itemCategoryCode,
                inventory: item.inventory,
                unitCost: item.unitCost,
                unitPrice: item.unitPrice,
                baseUnitOfMeasureCode: item.baseUnitOfMeasureCode,
                blocked: item.blocked,
                gtin: item.gtin || '',
                lastModifiedDateTime: item.lastModifiedDateTime || '',
                generalProductPostingGroupCode: item.generalProductPostingGroupCode || '',
                inventoryPostingGroupCode: item.inventoryPostingGroupCode || '',
              }
            : null,
          inventoryValue,
          avgSellingPrice,
          ledgerEntries: ledgerEntries.slice(0, 100).map((e: any) => ({
            entryNumber: e.entryNumber,
            postingDate: e.postingDate,
            entryType: e.entryType,
            documentNumber: e.documentNumber,
            documentType: e.documentType || '',
            sourceNumber: e.sourceNumber || '',
            sourceType: e.sourceType || '',
            description: e.description,
            quantity: e.quantity,
            costAmountActual: e.costAmountActual,
            salesAmountActual: e.salesAmountActual,
          })),
          dimensions: dimensions.map((d: any) => ({
            dimensionCode: d.dimensionCode || d.code || '',
            dimensionValueCode: d.dimensionValueCode || d.valueCode || '',
          })),
          movementByMonth,
          totalPurchased: Math.round(totalPurchased * 100) / 100,
          totalSold: Math.round(totalSold * 100) / 100,
          netMovement: Math.round(netMovement * 100) / 100,
          firstTransaction: firstTx,
          lastTransaction: lastTx,
        },
        summary: {
          detailType: 'item_detail',
          itemNumber,
          itemName: item?.displayName || itemNumber,
          currentStock: item?.inventory || 0,
          inventoryValue,
          avgSellingPrice,
          totalPurchased: Math.round(totalPurchased * 100) / 100,
          totalSold: Math.round(totalSold * 100) / 100,
          ledgerEntryCount: ledgerEntries.length,
        },
        currency: context.currency,
        sources: [`Business Central API (${context.environmentName})`],
        generated: new Date().toISOString(),
      }
    }

    case 'cashflow_item_detail': {
      // Cash flow line item breakdown by account for a specific cash flow category
      const itemType = (input as any).cashflowItemType
      if (!itemType) {
        return {
          success: false,
          queryType: 'detail',
          data: [],
          summary: { error: 'cashflowItemType is required for cashflow_item_detail' },
          sources: [],
          generated: new Date().toISOString(),
          error: 'cashflowItemType is required',
        }
      }

      // Map cashflow item types to account category/subCategory patterns
      const cfItemConfigs: Record<
        string,
        { label: string; category: string; patterns: string[]; activity: string }
      > = {
        'net-income': {
          label: 'Net Income',
          category: 'operating',
          patterns: [],
          activity: 'operating',
        },
        'ar-change': {
          label: 'AR Changes',
          category: 'Assets',
          patterns: ['receivable'],
          activity: 'operating',
        },
        'ap-change': {
          label: 'AP Changes',
          category: 'Liabilities',
          patterns: ['payable'],
          activity: 'operating',
        },
        'inventory-change': {
          label: 'Inventory Changes',
          category: 'Assets',
          patterns: ['inventory'],
          activity: 'operating',
        },
        'other-operating': {
          label: 'Other Operating',
          category: 'operating',
          patterns: ['prepaid', 'accrued', 'current'],
          activity: 'operating',
        },
        depreciation: {
          label: 'Depreciation & Amortization',
          category: 'Assets',
          patterns: ['depreciation', 'amortization'],
          activity: 'operating',
        },
        capex: {
          label: 'Capital Expenditures',
          category: 'Assets',
          patterns: ['fixed', 'property', 'equipment'],
          activity: 'investing',
        },
        'debt-proceeds': {
          label: 'Debt Proceeds',
          category: 'Liabilities',
          patterns: ['long-term', 'loan', 'note', 'bond'],
          activity: 'financing',
        },
        'debt-repayments': {
          label: 'Debt Repayments',
          category: 'Liabilities',
          patterns: ['long-term', 'loan', 'note', 'bond'],
          activity: 'financing',
        },
        'equity-changes': {
          label: 'Equity Changes',
          category: 'Equity',
          patterns: [],
          activity: 'financing',
        },
      }

      const cfg = cfItemConfigs[itemType]
      if (!cfg) {
        return {
          success: false,
          queryType: 'detail',
          data: [],
          summary: {
            error: `Unknown cashflow item type: ${itemType}. Valid types: ${Object.keys(cfItemConfigs).join(', ')}`,
          },
          sources: [],
          generated: new Date().toISOString(),
          error: `Unknown cashflow item type: ${itemType}`,
        }
      }

      const fetchStep = profiler?.step('cf_item_fetch')
      const cfAccounts = await client.queryAll('accounts', { $select: ACCOUNTS_SELECT })

      // Find matching accounts
      const matchingAccNums: string[] = []
      for (const acc of cfAccounts) {
        const accType = decodeOData(acc.accountType || '').toLowerCase()
        if (accType !== 'posting') continue
        const cat = (acc.category || '').trim()
        const sub = decodeOData(acc.subCategory || '').toLowerCase()

        let matches = false
        if (cfg.category === 'operating' && itemType === 'net-income') {
          matches = ['Income', 'Expense', 'Cost of Goods Sold'].includes(cat)
        } else if (cfg.category === 'operating' && itemType === 'other-operating') {
          matches =
            (cat === 'Assets' || cat === 'Liabilities') &&
            cfg.patterns.some((p) => sub.includes(p)) &&
            !sub.includes('receivable') &&
            !sub.includes('payable') &&
            !sub.includes('inventory')
        } else if (cat === cfg.category) {
          if (cfg.patterns.length === 0) {
            matches = true
          } else {
            matches = cfg.patterns.some((p) => sub.includes(p))
          }
        }

        if (matches) matchingAccNums.push(acc.number)
      }

      // Fetch GL entries for matching accounts
      const glFilterParts = [
        `(${matchingAccNums.map((n) => `accountNumber eq '${n}'`).join(' or ')})`,
      ]
      if (startDate && endDate) {
        glFilterParts.push(`postingDate ge ${startDate} and postingDate le ${endDate}`)
      }

      let cfGlEntries: any[] = []
      if (matchingAccNums.length > 0) {
        // If too many accounts for a single OData filter, fetch all GL and filter in memory
        if (matchingAccNums.length > 15) {
          const allGl = await client.listGeneralLedgerEntries({
            $select: 'accountNumber,debitAmount,creditAmount,postingDate,documentNumber',
            ...(startDate && endDate
              ? { $filter: `postingDate ge ${startDate} and postingDate le ${endDate}` }
              : {}),
          })
          const accSet = new Set(matchingAccNums)
          cfGlEntries = allGl.filter((e: any) => accSet.has(e.accountNumber))
        } else {
          cfGlEntries = await client.listGeneralLedgerEntries({
            $select: 'accountNumber,debitAmount,creditAmount,postingDate,documentNumber',
            $filter: glFilterParts.join(' and '),
          })
        }
      }
      fetchStep?.end()

      // Aggregate by account
      const accBreakdown: Record<
        string,
        { name: string; debit: number; credit: number; count: number }
      > = {}
      for (const e of cfGlEntries) {
        const accNo = e.accountNumber
        if (!accBreakdown[accNo]) {
          const acc = cfAccounts.find((a: any) => a.number === accNo)
          accBreakdown[accNo] = {
            name: acc?.displayName || accNo,
            debit: 0,
            credit: 0,
            count: 0,
          }
        }
        accBreakdown[accNo].debit += e.debitAmount ?? 0
        accBreakdown[accNo].credit += e.creditAmount ?? 0
        accBreakdown[accNo].count++
      }

      const accountBreakdownList = Object.entries(accBreakdown)
        .map(([number, v]) => ({
          number,
          name: v.name,
          debit: Math.round(v.debit * 100) / 100,
          credit: Math.round(v.credit * 100) / 100,
          net: Math.round((v.debit - v.credit) * 100) / 100,
          entryCount: v.count,
        }))
        .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))

      // Monthly trend
      const cfMonthly = new Map<string, number>()
      for (const e of cfGlEntries) {
        const month = (e.postingDate || '').substring(0, 7)
        if (!month) continue
        cfMonthly.set(
          month,
          (cfMonthly.get(month) ?? 0) + (e.debitAmount ?? 0) - (e.creditAmount ?? 0)
        )
      }
      const monthlyTrendCf = [...cfMonthly.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }))

      const totalDebit = cfGlEntries.reduce((s: number, e: any) => s + (e.debitAmount ?? 0), 0)
      const totalCredit = cfGlEntries.reduce((s: number, e: any) => s + (e.creditAmount ?? 0), 0)

      return {
        success: true,
        queryType: 'detail',
        data: {
          itemType,
          label: cfg.label,
          activity: cfg.activity,
          totalDebit: Math.round(totalDebit * 100) / 100,
          totalCredit: Math.round(totalCredit * 100) / 100,
          netAmount: Math.round((totalDebit - totalCredit) * 100) / 100,
          accountBreakdown: accountBreakdownList,
          monthlyTrend: monthlyTrendCf,
          transactionCount: cfGlEntries.length,
          matchingAccountCount: matchingAccNums.length,
        },
        summary: {
          detailType: 'cashflow_item_detail',
          itemType,
          label: cfg.label,
          netAmount: Math.round((totalDebit - totalCredit) * 100) / 100,
          accountCount: accountBreakdownList.length,
          transactionCount: cfGlEntries.length,
        },
        currency: context.currency,
        sources: [`Business Central API (${context.environmentName})`],
        generated: new Date().toISOString(),
      }
    }

    case 'document_lines': {
      // Line items for a specific document (invoice, order, credit memo, shipment)
      const docType = (input as any).documentType
      const docId = (input as any).documentId
      if (!docType || !docId) {
        return {
          success: false,
          queryType: 'detail',
          data: [],
          summary: { error: 'documentType and documentId are required for document_lines' },
          sources: [],
          generated: new Date().toISOString(),
          error: 'documentType and documentId are required',
        }
      }

      const entityMap: Record<string, { entity: string; linesNav: string }> = {
        invoice: { entity: 'purchaseInvoices', linesNav: 'purchaseInvoiceLines' },
        order: { entity: 'purchaseOrders', linesNav: 'purchaseOrderLines' },
        creditMemo: { entity: 'purchaseCreditMemos', linesNav: 'purchaseCreditMemoLines' },
        receipt: { entity: 'purchaseReceipts', linesNav: 'purchaseReceiptLines' },
        salesInvoice: { entity: 'salesInvoices', linesNav: 'salesInvoiceLines' },
        salesCreditMemo: { entity: 'salesCreditMemos', linesNav: 'salesCreditMemoLines' },
        salesShipment: { entity: 'salesShipments', linesNav: 'salesShipmentLines' },
      }

      const mapping = entityMap[docType]
      if (!mapping) {
        return {
          success: false,
          queryType: 'detail',
          data: [],
          summary: {
            error: `Unknown documentType: ${docType}. Valid types: ${Object.keys(entityMap).join(', ')}`,
          },
          sources: [],
          generated: new Date().toISOString(),
          error: `Unknown documentType: ${docType}`,
        }
      }

      const endpoint = `${mapping.entity}(${docId})/${mapping.linesNav}`
      const linesResult = await client.query(endpoint)
      const rawLines = (linesResult as any)?.value || []

      // Enrich lines: BC posted documents often have amount=0 on line items.
      // Compute lineTotal from quantity × unitCost/unitPrice when amount is missing.
      const lines = rawLines.map((line: any) => {
        const qty = line.quantity ?? 0
        const unitCost = line.unitCost ?? line.directUnitCost ?? line.unitPrice ?? 0
        const existingAmount =
          line.amount ||
          line.lineAmount ||
          line.amountExcludingTax ||
          line.netAmount ||
          line.totalAmount ||
          0
        const computedAmount =
          existingAmount !== 0 ? existingAmount : Math.round(qty * unitCost * 100) / 100
        return {
          ...line,
          computedAmount,
        }
      })

      const totalAmount =
        Math.round(lines.reduce((s: number, l: any) => s + (l.computedAmount || 0), 0) * 100) / 100

      return {
        success: true,
        queryType: 'detail',
        data: {
          documentType: docType,
          documentId: docId,
          lines,
          totalAmount,
        },
        summary: {
          detailType: 'document_lines',
          documentType: docType,
          documentId: docId,
          lineCount: lines.length,
          totalAmount,
        },
        currency: context.currency,
        sources: [`Business Central API (${context.environmentName})`],
        generated: new Date().toISOString(),
      }
    }

    default:
      return {
        success: false,
        queryType: 'detail',
        data: [],
        summary: { error: `Unknown detail type: ${detailType}` },
        sources: [],
        generated: new Date().toISOString(),
        error: `Unknown detail type: ${detailType}`,
      }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSearchField(entityType: string): string {
  switch (entityType) {
    case 'customer':
    case 'vendor':
    case 'item':
      return 'displayName'
    case 'account':
      return 'name'
    default:
      return 'displayName'
  }
}

/** Get start date from a period preset (used by balance_sheet, cash_flow cases) */
function getStartDate(period?: string): string {
  return resolvePeriod(period || 'this_year').start
}

/** Get end date from a period preset (used by balance_sheet, cash_flow cases) */
function getEndDate(period?: string): string {
  return resolvePeriod(period || 'this_year').end
}

/**
 * Resolve start/end dates from input. Prefers explicit startDate/endDate,
 * falls back to resolving the `period` preset.
 */
function resolveDates(input: BCDataInput): { startDate: string | null; endDate: string | null } {
  if (input.startDate && input.endDate) {
    return { startDate: input.startDate, endDate: input.endDate }
  }
  // Default to this_year (YTD) when no period specified
  const resolved = resolvePeriod(input.period || 'this_year')
  return { startDate: resolved.start, endDate: resolved.end }
}

/**
 * Format a Date to YYYY-MM-DD using local timezone.
 * Do NOT use toISOString() — it converts to UTC which shifts dates
 * across midnight boundaries (e.g., Oct 1 00:00 IST → Sep 30 in UTC).
 */
function fmtLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function resolvePeriod(period: string): { start: string; end: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  switch (period) {
    case 'this_month':
      return {
        start: fmtLocal(new Date(year, month, 1)),
        end: fmtLocal(now),
      }
    case 'last_month': {
      const lastMonth = new Date(year, month - 1, 1)
      const lastDay = new Date(year, month, 0)
      return {
        start: fmtLocal(lastMonth),
        end: fmtLocal(lastDay),
      }
    }
    case 'this_quarter': {
      const qStart = new Date(year, Math.floor(month / 3) * 3, 1)
      return {
        start: fmtLocal(qStart),
        end: fmtLocal(now),
      }
    }
    case 'last_quarter': {
      const qMonth = Math.floor(month / 3) * 3
      const lqStart = new Date(year, qMonth - 3, 1)
      const lqEnd = new Date(year, qMonth, 0)
      return {
        start: fmtLocal(lqStart),
        end: fmtLocal(lqEnd),
      }
    }
    case 'this_year':
      return {
        start: `${year}-01-01`,
        end: fmtLocal(now),
      }
    case 'last_year':
      return {
        start: `${year - 1}-01-01`,
        end: `${year - 1}-12-31`,
      }
    case 'ytd':
      return {
        start: `${year}-01-01`,
        end: fmtLocal(now),
      }
    case 'last_30_days': {
      const d30 = new Date(now)
      d30.setDate(d30.getDate() - 30)
      return {
        start: fmtLocal(d30),
        end: fmtLocal(now),
      }
    }
    case 'last_90_days': {
      const d90 = new Date(now)
      d90.setDate(d90.getDate() - 90)
      return {
        start: fmtLocal(d90),
        end: fmtLocal(now),
      }
    }
    default:
      return {
        start: `${year}-01-01`,
        end: fmtLocal(now),
      }
  }
}

/** Bucket invoices by due date into aging buckets (same as enhanced-financial-data endpoint) */
function ageInvoices(invoices: any[]): {
  current: number
  days_1_30: number
  days_31_60: number
  days_61_90: number
  days_over_90: number
  total: number
} {
  const now = new Date()
  const buckets = {
    current: 0,
    days_1_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    days_over_90: 0,
    total: 0,
  }

  for (const inv of invoices) {
    const amount = inv.totalAmountIncludingTax ?? inv.totalAmount ?? inv.remainingAmount ?? 0
    if (amount === 0) continue
    buckets.total += amount

    const dueDateStr = inv.dueDate || inv.postingDate
    if (!dueDateStr) {
      buckets.current += amount
      continue
    }

    const dueDate = new Date(dueDateStr)
    const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysPastDue <= 0) buckets.current += amount
    else if (daysPastDue <= 30) buckets.days_1_30 += amount
    else if (daysPastDue <= 60) buckets.days_31_60 += amount
    else if (daysPastDue <= 90) buckets.days_61_90 += amount
    else buckets.days_over_90 += amount
  }

  return buckets
}
