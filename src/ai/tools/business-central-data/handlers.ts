// src/ai/tools/business-central-data/handlers.ts
// Handlers for executing BC queries via the Redshift warehouse API

import { executeQuery, type QueryResult } from '@/lib/redshift/client'
import {
  validateSchemaAccess,
  getOrganizationWarehouseConfig,
} from '@/lib/redshift/warehouse-access'
import { buildQuery, buildCountQuery, resolveDateRange } from './query-builder'
import type { BCDataInput, BCToolContext, BCQueryResult } from './types'
import { logger } from '@/lib/logger'

// Country code → ISO 4217 currency code mapping
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: 'USD',
  CA: 'CAD',
  GB: 'GBP',
  AU: 'AUD',
  NZ: 'NZD',
  NG: 'NGN',
  KE: 'KES',
  GH: 'GHS',
  ZA: 'ZAR',
  TZ: 'TZS',
  UG: 'UGX',
  EG: 'EGP',
  IN: 'INR',
  JP: 'JPY',
  CN: 'CNY',
  HK: 'HKD',
  SG: 'SGD',
  MY: 'MYR',
  PH: 'PHP',
  ID: 'IDR',
  TH: 'THB',
  KR: 'KRW',
  TW: 'TWD',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  IE: 'EUR',
  PT: 'EUR',
  FI: 'EUR',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  CH: 'CHF',
  PL: 'PLN',
  BR: 'BRL',
  MX: 'MXN',
  AE: 'AED',
  SA: 'SAR',
  RU: 'RUB',
}

/**
 * Resolve the display symbol for a currency code (e.g. "NGN" → "₦", "USD" → "$").
 * Uses Intl.NumberFormat with narrowSymbol for best cross-currency support.
 */
function getCurrencySymbol(currencyCode: string): string {
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0)
    return parts.find((p) => p.type === 'currency')?.value || currencyCode
  } catch {
    return currencyCode
  }
}

/**
 * Query the BC company's local currency from the company_information table.
 * Uses country_region_code → ISO 4217 mapping (Fivetran doesn't sync lcy_code).
 */
async function queryCompanyCurrency(schema: string): Promise<string | null> {
  try {
    const result = await executeQuery(
      `SELECT country_region_code FROM ${schema}.company_information WHERE _fivetran_deleted = false LIMIT 1`
    )
    if (result.success && result.data && result.data.length > 0) {
      const row = result.data[0] as Record<string, unknown>
      const country = String(row.country_region_code || '')
        .trim()
        .toUpperCase()
      logger.debug('[Tool:BC] Company country resolved', { schema, country })
      if (country && COUNTRY_TO_CURRENCY[country]) {
        return COUNTRY_TO_CURRENCY[country]
      }
    }
  } catch (err) {
    logger.warn('[Tool:BC] Could not resolve company currency', {
      schema,
      error: err instanceof Error ? err.message : String(err),
    })
  }
  return null
}

/**
 * Execute a Business Central data query.
 * Validates schema access, builds SQL, executes via Redshift, and returns structured results.
 */
export async function executeBCQuery(
  input: BCDataInput,
  context: BCToolContext
): Promise<BCQueryResult> {
  const startTime = Date.now()
  const schema = context.defaultSchema

  // 1. Validate schema access
  const { config } = await getOrganizationWarehouseConfig(context.organizationId)
  if (!config || !config.enabled) {
    return errorResult(input, 'Business Central warehouse is not enabled for this organization')
  }

  const accessCheck = validateSchemaAccess(config, schema)
  if (!accessCheck.valid) {
    return errorResult(input, accessCheck.error || 'Schema access denied')
  }

  // 2. Resolve the BC company's actual currency from Redshift
  // This is authoritative — queries company_information.lcy_code / country_region_code
  let currency = context.currency
  if (!currency || currency === 'USD') {
    const bcCurrency = await queryCompanyCurrency(schema)
    if (bcCurrency) {
      currency = bcCurrency
      logger.debug('[Tool:BC] Resolved company currency from Redshift', {
        correlationId: context.correlationId,
        currency: bcCurrency,
      })
    }
  }

  // 3. Build SQL query
  const { sql, description } = buildQuery(input, schema)

  if (!sql) {
    return errorResult(
      input,
      `Unable to build query for ${input.queryType}/${input.reportType || input.entityType || input.metricName || 'unknown'}`
    )
  }

  logger.debug('[Tool:BC] Executing query', {
    correlationId: context.correlationId,
    queryType: input.queryType,
    description,
    sqlLength: sql.length,
  })

  // 4. For entity queries, run a COUNT query first to get the real total
  let entityTotalCount: number | null = null
  if (input.queryType === 'entity') {
    const countSql = buildCountQuery(input, schema)
    if (countSql) {
      try {
        const countResult = await executeQuery<{ total: number }>(countSql)
        if (countResult.success && countResult.data.length > 0) {
          entityTotalCount = Number(countResult.data[0].total) || 0
        }
      } catch (err) {
        // COUNT query failed — non-critical, fall back to rows.length
        logger.warn('[Tool:BC] COUNT query failed, falling back to row count', {
          correlationId: context.correlationId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  // 5. Execute main query via Redshift
  const result = await executeQuery(sql)

  if (!result.success) {
    logger.error('[Tool:BC] Query failed', {
      correlationId: context.correlationId,
      error: result.error,
      queryType: input.queryType,
    })
    return errorResult(input, `Query failed: ${result.error}`)
  }

  const dateRange = resolveDateRange(input)

  // 6. Post-process results based on query type
  const processed = postProcessResults(input, result, dateRange, entityTotalCount)

  logger.info('[Tool:BC] Query completed', {
    correlationId: context.correlationId,
    queryType: input.queryType,
    rowCount: result.count,
    currency,
    duration: Date.now() - startTime,
  })

  const resolvedCurrency = currency || 'USD'

  // Summary + metadata placed BEFORE data so they survive token truncation.
  // The data array can be huge (100+ items) and gets truncated first,
  // but the LLM always sees the accurate KPIs.
  return {
    success: true,
    queryType: input.queryType,
    summary: processed.summary,
    currency: resolvedCurrency,
    currencySymbol: getCurrencySymbol(resolvedCurrency),
    metadata: {
      description,
      dateRange,
      rowCount: result.count,
      executionTime: result.executionTime,
      schema,
      syncNote: 'Data sourced from Fivetran warehouse sync (may be 15min–1hr delayed)',
    },
    sources: [`Business Central (${schema})`, `Fivetran warehouse`],
    generated: new Date().toISOString(),
    data: processed.data,
  }
}

// ============================================================================
// Post-Processing
// ============================================================================

interface ProcessedResult {
  data: Record<string, unknown> | unknown[]
  summary: Record<string, unknown>
}

function postProcessResults(
  input: BCDataInput,
  result: QueryResult,
  dateRange: { startDate: string; endDate: string },
  entityTotalCount?: number | null
): ProcessedResult {
  const rows = result.data as Record<string, unknown>[]

  switch (input.queryType) {
    case 'report':
      return postProcessReport(input, rows, dateRange)
    case 'entity': {
      const realTotal = entityTotalCount ?? rows.length
      return { data: rows, summary: { totalCount: realTotal, showing: rows.length } }
    }
    case 'metric':
      return postProcessMetric(input, rows)
    case 'search':
      return { data: rows, summary: { totalResults: rows.length } }
    case 'analyze':
      return postProcessReport(input, rows, dateRange)
    case 'compare':
      return postProcessComparison(rows)
    default:
      return { data: rows, summary: {} }
  }
}

/**
 * Detect if rows contain period-grouped data (from summarizeBy).
 * When true, data needs to be restructured into period-indexed format.
 */
function hasPeriodColumn(rows: Record<string, unknown>[]): boolean {
  return rows.length > 0 && rows[0].period !== undefined
}

/**
 * Extract sorted unique period values from rows.
 */
function extractPeriods(rows: Record<string, unknown>[]): string[] {
  const periods = new Set<string>()
  for (const row of rows) {
    if (row.period != null) periods.add(String(row.period))
  }
  return [...periods].sort()
}

/**
 * Group rows by a key field and build period-indexed data.
 * Returns entries with { ...identifiers, byPeriod: { period: value }, total }.
 */
function groupByKeyWithPeriods<T extends Record<string, unknown>>(
  rows: T[],
  keyField: string,
  valueField: string,
  extraFields: string[] = []
): Array<Record<string, unknown>> {
  const grouped = new Map<
    string,
    { fields: Record<string, unknown>; byPeriod: Record<string, number>; total: number }
  >()

  for (const row of rows) {
    const key = String(row[keyField] || '')
    const period = String(row.period || '')
    const value = Number(row[valueField]) || 0

    if (!grouped.has(key)) {
      const fields: Record<string, unknown> = { [keyField]: row[keyField] }
      for (const f of extraFields) fields[f] = row[f]
      grouped.set(key, { fields, byPeriod: {}, total: 0 })
    }

    const entry = grouped.get(key)!
    entry.byPeriod[period] = (entry.byPeriod[period] || 0) + value
    entry.total += value
  }

  return [...grouped.values()]
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
    .map((e) => ({ ...e.fields, byPeriod: e.byPeriod, total: e.total }))
}

function postProcessReport(
  input: BCDataInput,
  rows: Record<string, unknown>[],
  dateRange: { startDate: string; endDate: string }
): ProcessedResult {
  if (rows.length === 0) {
    return {
      data: {},
      summary: {
        message: `No data found for ${input.reportType || 'this report'} in the requested period (${dateRange.startDate} to ${dateRange.endDate}).`,
        rowCount: 0,
      },
    }
  }

  const granularity = input.summarizeBy || 'month'

  switch (input.reportType) {
    case 'profit_loss': {
      // Period-grouped P&L: per-account breakdown by time period
      if (hasPeriodColumn(rows)) {
        const periods = extractPeriods(rows)
        const incomeRows = rows.filter((r) => String(r.category) === 'Income')
        const cogsRows = rows.filter((r) => String(r.category) === 'Cost of Goods Sold')
        const expenseRows = rows.filter((r) => String(r.category) === 'Expense')

        const income = groupByKeyWithPeriods(incomeRows, 'account_no', 'amount', [
          'account_name',
          'category',
        ])
        const costOfGoodsSold = groupByKeyWithPeriods(cogsRows, 'account_no', 'amount', [
          'account_name',
          'category',
        ])
        const expenseDetail = groupByKeyWithPeriods(expenseRows, 'account_no', 'amount', [
          'account_name',
          'category',
        ])

        // Compute periodTotals for trend charting
        const periodTotals = periods.map((p) => {
          const rev = incomeRows
            .filter((r) => String(r.period) === p)
            .reduce((s, r) => s + (Number(r.amount) || 0), 0)
          const cg = cogsRows
            .filter((r) => String(r.period) === p)
            .reduce((s, r) => s + (Number(r.amount) || 0), 0)
          const exp = expenseRows
            .filter((r) => String(r.period) === p)
            .reduce((s, r) => s + (Number(r.amount) || 0), 0)
          const net = rev - cg - exp
          return {
            period: p,
            revenue: rev,
            cogs: cg,
            expenses: exp,
            netIncome: net,
            margin: rev > 0 ? Math.round((net / rev) * 10000) / 100 : 0,
          }
        })

        // Aggregate KPIs
        const revenue = periodTotals.reduce((s, p) => s + p.revenue, 0)
        const cogs = periodTotals.reduce((s, p) => s + p.cogs, 0)
        const expenses = periodTotals.reduce((s, p) => s + p.expenses, 0)
        const grossProfit = revenue - cogs
        const netIncome = grossProfit - expenses
        const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0
        const netMargin = revenue > 0 ? (netIncome / revenue) * 100 : 0

        // Classify expense sub-components for operating income & EBITDA
        const INTEREST_RE_T = /interest|finance charge|finance cost|bank charge/i
        const TAX_RE_T = /income tax|tax expense|federal tax|state tax|corporate tax/i
        const DA_RE_T = /depreciation|amortization|amortisation|depletion/i
        const ACCUMULATED_RE_T = /accumulated/i
        const NON_OP_RE_T = /foreign exchange|forex|fx gain|fx loss|other income|other expense/i
        const NON_OP_SUB_RE_T = /other income|other expense/i
        let tInterest = 0,
          tTax = 0,
          tDA = 0,
          tOtherNonOp = 0
        for (const row of expenseRows) {
          const amt = Math.abs(Number(row.amount) || 0)
          const sub = String(row.subcategory || '').trim()
          const nameAndSub = `${row.account_name || ''} ${sub}`
          const accName = String(row.account_name || '')
          if (!ACCUMULATED_RE_T.test(accName) && DA_RE_T.test(nameAndSub)) {
            tDA += amt
          } else if (INTEREST_RE_T.test(nameAndSub)) {
            tInterest += amt
          } else if (TAX_RE_T.test(nameAndSub)) {
            tTax += amt
          } else if (NON_OP_RE_T.test(accName) || (sub && NON_OP_SUB_RE_T.test(sub))) {
            tOtherNonOp += amt
          }
        }
        const tOperatingExpenses = expenses - tInterest - tTax - tOtherNonOp
        const tOperatingIncome = grossProfit - tOperatingExpenses
        const tEbitda = tOperatingIncome + tDA

        return {
          data: { periods, granularity, income, costOfGoodsSold, expenses: expenseDetail },
          summary: {
            periodCount: periods.length,
            granularity,
            revenue,
            costOfGoodsSold: cogs,
            grossProfit,
            operatingExpenses: Math.round(tOperatingExpenses * 100) / 100,
            operatingIncome: Math.round(tOperatingIncome * 100) / 100,
            netIncome,
            interestExpense: Math.round(tInterest * 100) / 100,
            taxExpense: Math.round(tTax * 100) / 100,
            depreciationAmortization: Math.round(tDA * 100) / 100,
            ebitda: Math.round(tEbitda * 100) / 100,
            grossMargin: Math.round(grossMargin * 100) / 100,
            netMargin: Math.round(netMargin * 100) / 100,
            periodTotals,
          },
        }
      }

      // Aggregate P&L (no summarizeBy — existing behavior)
      let revenue = 0
      let cogs = 0
      let expenses = 0
      let interestExpense = 0
      let taxExpense = 0
      let depreciationAmortization = 0
      let otherNonOperating = 0
      const incomeLines: Record<string, unknown>[] = []
      const cogsLines: Record<string, unknown>[] = []
      const expenseLines: Record<string, unknown>[] = []

      // Patterns to identify non-operating expense components from account name/subcategory
      const INTEREST_RE = /interest|finance charge|finance cost|bank charge/i
      const TAX_RE = /income tax|tax expense|federal tax|state tax|corporate tax/i
      const DA_RE = /depreciation|amortization|amortisation|depletion/i
      const ACCUMULATED_RE = /accumulated/i
      const NON_OPERATING_RE = /foreign exchange|forex|fx gain|fx loss|other income|other expense/i
      const NON_OPERATING_SUB_RE = /other income|other expense/i

      for (const row of rows) {
        const amount = Number(row.amount) || 0
        const category = String(row.category || '')
        const accountName = String(row.account_name || '')
        const subcategory = String(row.subcategory || '').trim()
        const nameAndSub = `${accountName} ${subcategory}`

        if (category === 'Income') {
          revenue += amount
          incomeLines.push(row)
        } else if (category === 'Cost of Goods Sold') {
          cogs += amount
          cogsLines.push(row)
        } else if (category === 'Expense') {
          expenses += amount
          expenseLines.push(row)

          // Classify expense sub-components for operating income & EBITDA
          if (!ACCUMULATED_RE.test(accountName) && DA_RE.test(nameAndSub)) {
            depreciationAmortization += amount
          } else if (INTEREST_RE.test(nameAndSub)) {
            interestExpense += amount
          } else if (TAX_RE.test(nameAndSub)) {
            taxExpense += amount
          } else if (
            NON_OPERATING_RE.test(accountName) ||
            (subcategory && NON_OPERATING_SUB_RE.test(subcategory))
          ) {
            otherNonOperating += amount
          }
        }
      }

      const grossProfit = revenue - cogs
      const totalExpenses = cogs + expenses
      // Operating expenses exclude interest, taxes, and other non-operating items
      const nonOperatingTotal = interestExpense + taxExpense + otherNonOperating
      const operatingExpenses = expenses - nonOperatingTotal
      const operatingIncome = grossProfit - operatingExpenses
      const netIncome = grossProfit - expenses
      const ebitda = operatingIncome + depreciationAmortization
      const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0
      const netMargin = revenue > 0 ? (netIncome / revenue) * 100 : 0
      const operatingMargin = revenue > 0 ? (operatingIncome / revenue) * 100 : 0
      const ebitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0
      const expenseRatio = revenue > 0 ? (totalExpenses / revenue) * 100 : 0

      const startMs = new Date(dateRange.startDate).getTime()
      const endMs = new Date(dateRange.endDate).getTime()
      const monthsInPeriod = Math.max(1, (endMs - startMs) / (1000 * 60 * 60 * 24 * 30.44))
      const burnRate = totalExpenses / monthsInPeriod
      const revenuePerMonth = revenue / monthsInPeriod

      // Let LLM get all the data and decide according to user query. Don't pre-aggregate to top N here since we want to preserve granularity for better analysis and insights in the summary (e.g. identifying if a long tail of accounts is driving expenses/revenue).
      // const TOP_N = 10
      const sortByAmount = (a: Record<string, unknown>, b: Record<string, unknown>) =>
        Math.abs(Number(b.amount) || 0) - Math.abs(Number(a.amount) || 0)

      return {
        data: {
          income: incomeLines.sort(sortByAmount),
          costOfGoodsSold: cogsLines.sort(sortByAmount),
          expenses: expenseLines.sort(sortByAmount),
          period: dateRange,
        },
        summary: {
          revenue,
          costOfGoodsSold: cogs,
          grossProfit,
          operatingExpenses: Math.round(operatingExpenses * 100) / 100,
          operatingIncome: Math.round(operatingIncome * 100) / 100,
          netIncome,
          interestExpense: Math.round(interestExpense * 100) / 100,
          taxExpense: Math.round(taxExpense * 100) / 100,
          depreciationAmortization: Math.round(depreciationAmortization * 100) / 100,
          grossMargin: Math.round(grossMargin * 100) / 100,
          netMargin: Math.round(netMargin * 100) / 100,
          operatingMargin: Math.round(operatingMargin * 100) / 100,
          ebitda: Math.round(ebitda * 100) / 100,
          ebitdaMargin: Math.round(ebitdaMargin * 100) / 100,
          expenseRatio: Math.round(expenseRatio * 100) / 100,
          burnRate: Math.round(burnRate * 100) / 100,
          revenuePerMonth: Math.round(revenuePerMonth * 100) / 100,
          totalIncomeAccounts: incomeLines.length,
          totalCogsAccounts: cogsLines.length,
          totalExpenseAccounts: expenseLines.length,
        },
      }
    }

    case 'balance_sheet': {
      // Period-grouped balance sheet: activity breakdown by time period
      if (hasPeriodColumn(rows)) {
        const periods = extractPeriods(rows)
        const assetRows = rows.filter((r) => String(r.category) === 'Assets')
        const liabRows = rows.filter((r) => String(r.category) === 'Liabilities')
        const eqRows = rows.filter((r) => String(r.category) === 'Equity')
        const pnlRows = rows.filter(
          (r) =>
            String(r.category) === 'Income' ||
            String(r.category) === 'Expense' ||
            String(r.category) === 'Cost of Goods Sold'
        )

        const assets = groupByKeyWithPeriods(assetRows, 'account_no', 'balance', [
          'account_name',
          'category',
        ])
        const liabilities = groupByKeyWithPeriods(liabRows, 'account_no', 'balance', [
          'account_name',
          'category',
        ])
        const equity = groupByKeyWithPeriods(eqRows, 'account_no', 'balance', [
          'account_name',
          'category',
        ])

        const totalAssets = assetRows.reduce((s, r) => s + (Number(r.balance) || 0), 0)
        const totalLiabilities = liabRows.reduce((s, r) => s + (Number(r.balance) || 0), 0)
        const totalEquityBase = eqRows.reduce((s, r) => s + (Number(r.balance) || 0), 0)
        const netIncome = pnlRows.reduce((s, r) => s + (Number(r.balance) || 0), 0)
        const totalEquity = totalEquityBase + netIncome

        return {
          data: { periods, granularity, assets, liabilities, equity },
          summary: {
            periodCount: periods.length,
            granularity,
            totalAssets,
            totalLiabilities,
            totalEquity,
            netIncomeForPeriod: netIncome,
          },
        }
      }

      // Aggregate balance sheet (existing behavior)
      let totalAssets = 0
      let totalLiabilities = 0
      let totalEquity = 0
      let currentAssets = 0
      let currentLiabilities = 0
      let inventory = 0
      let netIncomeForPeriod = 0
      const assetLines: Record<string, unknown>[] = []
      const liabilityLines: Record<string, unknown>[] = []
      const equityLines: Record<string, unknown>[] = []

      // Inverse classification: assume current unless subcategory explicitly says non-current.
      // This matches the platform's computeRatiosFromBalanceSheet logic.
      const NON_CURRENT_ASSET_RE =
        /non.?current|property|plant|equipment|intangible|depreciation|amortization|long.?term|fixed.?asset/i
      const NON_CURRENT_LIABILITY_RE = /non.?current|long.?term|pension|deferred|employee.?end/i
      const INVENTORY_RE = /inventor/i

      for (const row of rows) {
        const balance = Number(row.balance) || 0
        const category = String(row.category || '')
        const subcategory = String(row.subcategory || '').toLowerCase()
        const accountName = String(row.name || row.account_name || '').toLowerCase()

        if (category === 'Assets') {
          totalAssets += balance
          assetLines.push(row)
          if (!NON_CURRENT_ASSET_RE.test(subcategory)) currentAssets += balance
          if (INVENTORY_RE.test(subcategory) || INVENTORY_RE.test(accountName)) {
            inventory += balance
          }
        } else if (category === 'Liabilities') {
          totalLiabilities += balance
          liabilityLines.push(row)
          if (!NON_CURRENT_LIABILITY_RE.test(subcategory)) currentLiabilities += balance
        } else if (category === 'Equity') {
          totalEquity += balance
          equityLines.push(row)
        } else {
          // Income/Expense/COGS — compute Profit for the Period
          // SQL uses credit−debit for non-Asset rows, so:
          //   Income → positive balance (credit > debit)
          //   Expense/COGS → negative balance (debit > credit)
          // Summing all P&L balances naturally gives net income.
          netIncomeForPeriod += balance
        }
      }

      // Add Profit for the Period to equity (matches platform's synthetic account)
      totalEquity += netIncomeForPeriod

      const currentRatio =
        currentLiabilities > 0 ? Math.round((currentAssets / currentLiabilities) * 100) / 100 : null
      const quickRatio =
        currentLiabilities > 0
          ? Math.round(((currentAssets - inventory) / currentLiabilities) * 100) / 100
          : null
      const workingCapital = currentAssets - currentLiabilities
      const debtToEquity =
        totalEquity > 0 ? Math.round((totalLiabilities / totalEquity) * 100) / 100 : null
      const debtRatio =
        totalAssets > 0 ? Math.round((totalLiabilities / totalAssets) * 10000) / 100 : null
      const equityMultiplier =
        totalEquity > 0 ? Math.round((totalAssets / totalEquity) * 100) / 100 : null

      // Return top 10 accounts per category to keep response compact
      // const TOP_N = 10
      const sortByBalance = (a: Record<string, unknown>, b: Record<string, unknown>) =>
        Math.abs(Number(b.balance) || 0) - Math.abs(Number(a.balance) || 0)

      return {
        data: {
          assets: assetLines.sort(sortByBalance),
          liabilities: liabilityLines.sort(sortByBalance),
          equity: equityLines.sort(sortByBalance),
        },
        summary: {
          totalAssets,
          totalLiabilities,
          totalEquity,
          currentAssets,
          currentLiabilities,
          inventory,
          currentRatio,
          quickRatio,
          workingCapital,
          debtToEquity,
          debtRatio,
          equityMultiplier,
          totalAssetAccounts: assetLines.length,
          totalLiabilityAccounts: liabilityLines.length,
          totalEquityAccounts: equityLines.length,
        },
      }
    }

    case 'monthly_pnl_trend': {
      return {
        data: rows,
        summary: {
          periodCount: rows.length,
          granularity,
          period: dateRange,
        },
      }
    }

    case 'cash_flow': {
      // Aggregate all cash flow components across periods
      let totalOperatingInflows = 0
      let totalOperatingOutflows = 0
      let totalNetIncome = 0
      let totalDepreciation = 0
      let totalArChange = 0
      let totalInventoryChange = 0
      let totalApChange = 0
      let totalFixedAssetChange = 0
      let totalDebtChange = 0
      let totalEquityChange = 0
      let totalPrepaidChange = 0
      let totalAccruedLiabilitiesChange = 0
      let totalDeferredRevenueChange = 0

      for (const row of rows) {
        totalOperatingInflows += Number(row.operating_inflows || 0)
        totalOperatingOutflows += Math.abs(Number(row.operating_outflows || 0))
        totalNetIncome += Number(row.net_income || 0)
        totalDepreciation += Number(row.depreciation || 0)
        totalArChange += Number(row.ar_change || 0)
        totalInventoryChange += Number(row.inventory_change || 0)
        totalApChange += Number(row.ap_change || 0)
        totalPrepaidChange += Number(row.prepaid_change || 0)
        totalAccruedLiabilitiesChange += Number(row.accrued_liabilities_change || 0)
        totalDeferredRevenueChange += Number(row.deferred_revenue_change || 0)
        totalFixedAssetChange += Number(row.fixed_asset_change || 0)
        totalDebtChange += Number(row.debt_change || 0)
        totalEquityChange += Number(row.equity_change || 0)
      }

      const round = (v: number) => Math.round(v * 100) / 100
      const otherWcChanges =
        totalPrepaidChange + totalAccruedLiabilitiesChange + totalDeferredRevenueChange
      const workingCapitalChange =
        totalArChange + totalInventoryChange + totalApChange + otherWcChanges
      const operatingCashFlow = totalNetIncome + totalDepreciation + workingCapitalChange
      const investingCashFlow = -totalFixedAssetChange
      const financingCashFlow = totalDebtChange + totalEquityChange
      const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow
      const periodCount = Math.max(1, rows.length)

      return {
        data: rows,
        summary: {
          periodCount: rows.length,
          granularity,
          period: dateRange,
          // Operating activities breakdown (indirect method)
          netIncome: round(totalNetIncome),
          depreciation: round(totalDepreciation),
          arChange: round(totalArChange),
          inventoryChange: round(totalInventoryChange),
          apChange: round(totalApChange),
          prepaidChange: round(totalPrepaidChange),
          accruedLiabilitiesChange: round(totalAccruedLiabilitiesChange),
          deferredRevenueChange: round(totalDeferredRevenueChange),
          workingCapitalChange: round(workingCapitalChange),
          operatingCashFlow: round(operatingCashFlow),
          // Investing activities
          fixedAssetChange: round(totalFixedAssetChange),
          investingCashFlow: round(investingCashFlow),
          // Financing activities
          debtChange: round(totalDebtChange),
          equityChange: round(totalEquityChange),
          financingCashFlow: round(financingCashFlow),
          // Totals
          netCashFlow: round(netCashFlow),
          totalOperatingInflows: round(totalOperatingInflows),
          totalOperatingOutflows: round(totalOperatingOutflows),
          burnRate: round(totalOperatingOutflows / periodCount),
          averageNetCash: round(netCashFlow / periodCount),
        },
      }
    }

    case 'aged_receivables':
    case 'aged_payables': {
      const totalBalance = rows.reduce((sum, r) => sum + (Number(r.total_balance) || 0), 0)
      const totalOverdue = rows.reduce((sum, r) => sum + (Number(r.overdue_amount) || 0), 0)
      const entityCount = rows.length
      const currentAmount = totalBalance - totalOverdue
      const overduePercentage =
        totalBalance > 0 ? Math.round((totalOverdue / totalBalance) * 10000) / 100 : 0
      const averageBalance =
        entityCount > 0 ? Math.round((totalBalance / entityCount) * 100) / 100 : 0

      return {
        data: rows,
        summary: {
          entityCount,
          totalBalance,
          totalOverdue,
          currentAmount,
          overduePercentage,
          averageBalance,
        },
      }
    }

    case 'sales_by_customer':
    case 'purchases_by_vendor': {
      const isSales = input.reportType === 'sales_by_customer'
      const valueField = isSales ? 'total_revenue' : 'total_spend'
      const nameField = isSales ? 'customer_name' : 'vendor_name'
      const idField = isSales ? 'customer_no' : 'vendor_no'

      // Period-grouped: entity breakdown by time period
      if (hasPeriodColumn(rows)) {
        const periods = extractPeriods(rows)
        const entries = groupByKeyWithPeriods(rows, idField, valueField, [nameField])
        const totalAmount = rows.reduce((sum, r) => sum + (Number(r[valueField]) || 0), 0)
        return {
          data: { periods, granularity, entries },
          summary: {
            entityCount: entries.length,
            periodCount: periods.length,
            granularity,
            totalAmount,
          },
        }
      }

      // Aggregate (existing behavior)
      const totalAmount = rows.reduce(
        (sum, r) => sum + (Number(r.total_revenue || r.total_spend) || 0),
        0
      )
      // Return top 25 entities to keep response compact (already sorted by amount DESC from SQL)
      //const TOP_N = 25
      return {
        data: rows,
        summary: {
          entityCount: rows.length,
          totalAmount,
          // showing: Math.min(rows.length, TOP_N),
        },
      }
    }

    case 'sales_by_item': {
      // Period-grouped: item breakdown by time period
      if (hasPeriodColumn(rows)) {
        const periods = extractPeriods(rows)
        const items = groupByKeyWithPeriods(rows, 'item_no', 'total_revenue', ['item_name'])
        const totalRevenue = rows.reduce((sum, r) => sum + (Number(r.total_revenue) || 0), 0)
        return {
          data: { periods, granularity, items },
          summary: {
            itemCount: items.length,
            periodCount: periods.length,
            granularity,
            totalRevenue,
          },
        }
      }

      // Aggregate (existing behavior)
      const totalRevenue = rows.reduce((sum, r) => sum + (Number(r.total_revenue) || 0), 0)
      const totalQty = rows.reduce((sum, r) => sum + (Number(r.total_quantity) || 0), 0)
      // const TOP_N = 25
      return {
        data: rows,
        summary: {
          itemCount: rows.length,
          totalRevenue,
          totalQuantitySold: totalQty,
          // showing: Math.min(rows.length, TOP_N),
        },
      }
    }

    case 'purchases_by_item': {
      // Period-grouped: item breakdown by time period
      if (hasPeriodColumn(rows)) {
        const periods = extractPeriods(rows)
        const items = groupByKeyWithPeriods(rows, 'item_no', 'total_spend', ['item_name'])
        const totalSpend = rows.reduce((sum, r) => sum + (Number(r.total_spend) || 0), 0)

        return {
          data: { periods, granularity, items },
          summary: {
            itemCount: items.length,
            periodCount: periods.length,
            granularity,
            totalSpend,
          },
        }
      }

      // Aggregate (existing behavior)
      const totalSpend = rows.reduce((sum, r) => sum + (Number(r.total_spend) || 0), 0)
      const totalQtyPurchased = rows.reduce((sum, r) => sum + (Number(r.total_quantity) || 0), 0)
      // const TOP_N = 25
      return {
        data: rows,
        summary: {
          itemCount: rows.length,
          totalSpend,
          totalQuantityPurchased: totalQtyPurchased,
          // showing: Math.min(rows.length, TOP_N),
        },
      }
    }

    case 'inventory_valuation': {
      // Grand totals are computed via window functions across ALL items (before LIMIT),
      // so the summary is always accurate regardless of how many detail rows are returned.
      const first = rows[0] || {}
      const totalItemCount = Number(first.total_item_count) || rows.length
      const totalOpeningValue = Number(first.grand_opening_value) || 0
      const totalIncreaseValue = Number(first.grand_increase_value) || 0
      const totalDecreaseValue = Number(first.grand_decrease_value) || 0
      const totalClosingValue = Number(first.grand_closing_value) || 0
      const totalClosingQty = Number(first.grand_closing_qty) || 0
      const netMovement = totalIncreaseValue - totalDecreaseValue
      // Stock on hand: all items with positive closing qty as of end date (includes items with no movement in period)
      const itemsInStock = Number(first.items_in_stock) || 0
      const totalStockQty = Number(first.total_stock_qty) || 0
      const totalStockValue = Number(first.total_stock_value) || 0

      // Strip grand_ / window columns from detail rows to keep data clean
      const detailRows = rows.map((r) => {
        const {
          grand_opening_value,
          grand_increase_value,
          grand_decrease_value,
          grand_closing_value,
          grand_closing_qty,
          total_item_count,
          items_in_stock,
          total_stock_qty,
          total_stock_value,
          ...item
        } = r
        return item
      })

      return {
        data: detailRows,
        summary: {
          totalItems: totalItemCount,
          showing: rows.length,
          totalOpeningValue,
          totalIncreaseValue,
          totalDecreaseValue,
          totalClosingValue,
          totalClosingQty,
          netMovement,
          itemsInStock,
          totalStockQty,
          totalStockValue,
        },
      }
    }

    case 'trial_balance': {
      // Period-grouped: per-account debits/credits/net by time period
      if (hasPeriodColumn(rows)) {
        const periods = extractPeriods(rows)

        // Build multi-value period map per account (debits, credits, net)
        const accountMap = new Map<
          string,
          {
            account_no: string
            account_name: string
            account_category: string
            byPeriod: Record<string, { debits: number; credits: number; net: number }>
            totalDebits: number
            totalCredits: number
            totalNet: number
          }
        >()

        for (const row of rows) {
          const acctNo = String(row.account_no || '')
          const period = String(row.period || '')
          const debits = Number(row.total_debits) || 0
          const credits = Number(row.total_credits) || 0
          const net = Number(row.net_balance) || 0

          if (!accountMap.has(acctNo)) {
            accountMap.set(acctNo, {
              account_no: acctNo,
              account_name: String(row.account_name || ''),
              account_category: String(row.account_category || ''),
              byPeriod: {},
              totalDebits: 0,
              totalCredits: 0,
              totalNet: 0,
            })
          }

          const entry = accountMap.get(acctNo)!
          entry.byPeriod[period] = { debits, credits, net }
          entry.totalDebits += debits
          entry.totalCredits += credits
          entry.totalNet += net
        }

        const accounts = [...accountMap.values()].sort(
          (a, b) => Math.abs(b.totalNet) - Math.abs(a.totalNet)
        )

        return {
          data: { periods, granularity, accounts },
          summary: {
            accountCount: accounts.length,
            periodCount: periods.length,
            granularity,
          },
        }
      }

      // Aggregate (existing behavior — falls through to default)
      return { data: rows, summary: { accountCount: rows.length } }
    }

    default:
      return { data: rows, summary: { rowCount: rows.length } }
  }
}

function postProcessMetric(input: BCDataInput, rows: Record<string, unknown>[]): ProcessedResult {
  if (rows.length === 0) {
    return { data: {}, summary: { error: 'No data returned' } }
  }

  const row = rows[0]

  switch (input.metricName) {
    case 'gross_margin': {
      const revenue = Number(row.revenue) || 0
      const cogs = Number(row.cogs) || 0
      const grossProfit = revenue - cogs
      const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0
      return {
        data: { revenue, cogs, grossProfit, grossMargin },
        summary: {
          metricName: 'gross_margin',
          value: Math.round(grossMargin * 100) / 100,
          unit: '%',
        },
      }
    }

    case 'net_margin':
    case 'operating_margin':
    case 'ebitda_margin':
    case 'gross_profit':
    case 'operating_income':
    case 'ebitda': {
      const revenue = Number(row.revenue) || 0
      const cogs = Number(row.cogs) || 0
      const opex = Number(row.operating_expenses) || 0
      const grossProfit = revenue - cogs
      const netIncome = revenue - cogs - opex
      // For now, operating_income = net_income (FX/interest separation requires per-account scan)
      // The P&L report handler already does full classification
      const operatingIncome = netIncome
      const ebitda = operatingIncome
      const netMargin = revenue > 0 ? (netIncome / revenue) * 100 : 0
      const operatingMargin = revenue > 0 ? (operatingIncome / revenue) * 100 : 0
      const ebitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0

      const metricMap: Record<string, { value: number; unit: string }> = {
        net_margin: { value: Math.round(netMargin * 100) / 100, unit: '%' },
        operating_margin: { value: Math.round(operatingMargin * 100) / 100, unit: '%' },
        ebitda_margin: { value: Math.round(ebitdaMargin * 100) / 100, unit: '%' },
        gross_profit: { value: Math.round(grossProfit * 100) / 100, unit: 'currency' },
        operating_income: { value: Math.round(operatingIncome * 100) / 100, unit: 'currency' },
        ebitda: { value: Math.round(ebitda * 100) / 100, unit: 'currency' },
      }
      const m = metricMap[input.metricName!] || {
        value: Math.round(netMargin * 100) / 100,
        unit: '%',
      }
      return {
        data: {
          revenue,
          cogs,
          grossProfit,
          operatingExpenses: opex,
          operatingIncome,
          netIncome,
          ebitda,
        },
        summary: { metricName: input.metricName, ...m },
      }
    }

    case 'current_ratio':
    case 'quick_ratio':
    case 'debt_to_equity':
    case 'debt_ratio':
    case 'working_capital':
    case 'total_assets':
    case 'total_liabilities':
    case 'total_equity': {
      // Per-account balance sheet rows with subcategory for current/non-current classification
      let totalAssets = 0,
        totalLiabilities = 0,
        totalEquity = 0
      let currentAssets = 0,
        currentLiabilities = 0,
        inventory = 0
      let netIncomeForPeriod = 0

      const NON_CURRENT_ASSET_RE =
        /non.?current|property|plant|equipment|intangible|depreciation|amortization|long.?term|fixed.?asset/i
      const NON_CURRENT_LIABILITY_RE = /non.?current|long.?term|pension|deferred|employee.?end/i
      const INVENTORY_RE = /inventor/i

      for (const r of rows) {
        const cat = String(r.category || '')
        const subcategory = String(r.subcategory || '').toLowerCase()
        const accountName = String(r.account_name || '').toLowerCase()
        const bal = Number(r.balance) || 0

        if (cat === 'Assets') {
          totalAssets += bal
          if (!NON_CURRENT_ASSET_RE.test(subcategory)) currentAssets += bal
          if (INVENTORY_RE.test(subcategory) || INVENTORY_RE.test(accountName)) inventory += bal
        } else if (cat === 'Liabilities') {
          totalLiabilities += bal
          if (!NON_CURRENT_LIABILITY_RE.test(subcategory)) currentLiabilities += bal
        } else if (cat === 'Equity') {
          totalEquity += bal
        } else {
          // Income/Expense/COGS — Profit for the Period
          // Income → positive, Expense/COGS → negative (SQL uses credit−debit for non-Assets)
          netIncomeForPeriod += bal
        }
      }

      // Add Profit for the Period to equity (matches platform logic)
      totalEquity += netIncomeForPeriod

      const r2 = (v: number) => Math.round(v * 100) / 100
      const metricValues: Record<string, { value: number; unit: string }> = {
        total_assets: { value: totalAssets, unit: 'currency' },
        total_liabilities: { value: totalLiabilities, unit: 'currency' },
        total_equity: { value: totalEquity, unit: 'currency' },
        current_ratio: {
          value: currentLiabilities > 0 ? r2(currentAssets / currentLiabilities) : 0,
          unit: 'ratio',
        },
        quick_ratio: {
          value: currentLiabilities > 0 ? r2((currentAssets - inventory) / currentLiabilities) : 0,
          unit: 'ratio',
        },
        debt_to_equity: {
          value: totalEquity > 0 ? r2(totalLiabilities / totalEquity) : 0,
          unit: 'ratio',
        },
        debt_ratio: {
          value: totalAssets > 0 ? r2((totalLiabilities / totalAssets) * 100) : 0,
          unit: '%',
        },
        working_capital: { value: currentAssets - currentLiabilities, unit: 'currency' },
      }

      const metric = metricValues[input.metricName!] || { value: 0, unit: '' }
      return {
        data: {
          totalAssets,
          totalLiabilities,
          totalEquity,
          currentAssets,
          currentLiabilities,
          inventory,
        },
        summary: { metricName: input.metricName, ...metric },
      }
    }

    case 'dso': {
      const receivables = Number(row.total_receivables) || 0
      const dailyRevenue = Number(row.daily_revenue) || 0
      const dso = dailyRevenue > 0 ? Math.round(receivables / dailyRevenue) : null
      return {
        data: { totalReceivables: receivables, dailyRevenue },
        summary: { metricName: 'dso', value: dso, unit: 'days' },
      }
    }

    case 'dpo': {
      const payables = Number(row.total_payables) || 0
      const dailyCogs = Number(row.daily_cogs) || 0
      const dpo = dailyCogs > 0 ? Math.round(payables / dailyCogs) : null
      return {
        data: { totalPayables: payables, dailyCogs },
        summary: { metricName: 'dpo', value: dpo, unit: 'days' },
      }
    }

    case 'inventory_turnover': {
      // Old COGS-based: const cogs = Number(row.cogs) || 0; const avgInventory = Number(row.avg_inventory) || 0; const turnover = avgInventory > 0 ? Math.round((cogs / avgInventory) * 100) / 100 : null; return { data: { cogs, avgInventory }, summary: { metricName: 'inventory_turnover', value: turnover, unit: 'times' } }
      const outboundQty = Number(row.outbound_qty) || 0
      const openingQty = Number(row.opening_qty) || 0
      const closingQty = Number(row.closing_qty) || 0
      const turnover = Number(row.turnover_ratio) || 0
      return {
        data: { outboundQty, openingQty, closingQty },
        summary: { metricName: 'inventory_turnover', value: turnover, unit: 'times' },
      }
    }

    default:
      return { data: row, summary: { metricName: input.metricName, rawData: row } }
  }
}

function postProcessComparison(rows: Record<string, unknown>[]): ProcessedResult {
  const current = rows.find((r) => r.period_label === 'current') || {}
  const comparison = rows.find((r) => r.period_label === 'comparison') || {}

  const curRevenue = Number(current.revenue) || 0
  const compRevenue = Number(comparison.revenue) || 0
  const curCogs = Number(current.cogs) || 0
  const compCogs = Number(comparison.cogs) || 0
  const curExpenses = curCogs + (Number(current.expenses) || 0)
  const compExpenses = compCogs + (Number(comparison.expenses) || 0)
  const curGrossProfit = curRevenue - curCogs
  const compGrossProfit = compRevenue - compCogs
  const curNetIncome = curRevenue - curExpenses
  const compNetIncome = compRevenue - compExpenses
  const curGrossMargin = curRevenue > 0 ? (curGrossProfit / curRevenue) * 100 : 0
  const compGrossMargin = compRevenue > 0 ? (compGrossProfit / compRevenue) * 100 : 0
  const curNetMargin = curRevenue > 0 ? (curNetIncome / curRevenue) * 100 : 0
  const compNetMargin = compRevenue > 0 ? (compNetIncome / compRevenue) * 100 : 0

  const computeVariance = (cur: number, comp: number) => ({
    absolute: Math.round((cur - comp) * 100) / 100,
    percentage: comp !== 0 ? Math.round(((cur - comp) / Math.abs(comp)) * 10000) / 100 : null,
    direction: cur > comp ? ('up' as const) : cur < comp ? ('down' as const) : ('flat' as const),
  })

  return {
    data: { current, comparison },
    summary: {
      current: {
        revenue: curRevenue,
        cogs: curCogs,
        grossProfit: curGrossProfit,
        grossMargin: Math.round(curGrossMargin * 100) / 100,
        netIncome: curNetIncome,
        netMargin: Math.round(curNetMargin * 100) / 100,
      },
      comparison: {
        revenue: compRevenue,
        cogs: compCogs,
        grossProfit: compGrossProfit,
        grossMargin: Math.round(compGrossMargin * 100) / 100,
        netIncome: compNetIncome,
        netMargin: Math.round(compNetMargin * 100) / 100,
      },
      variance: {
        revenue: computeVariance(curRevenue, compRevenue),
        cogs: computeVariance(curCogs, compCogs),
        grossProfit: computeVariance(curGrossProfit, compGrossProfit),
        grossMargin: computeVariance(curGrossMargin, compGrossMargin),
        netIncome: computeVariance(curNetIncome, compNetIncome),
        netMargin: computeVariance(curNetMargin, compNetMargin),
      },
    },
  }
}

// ============================================================================
// Helpers
// ============================================================================

function errorResult(input: BCDataInput, error: string): BCQueryResult {
  return {
    success: false,
    queryType: input.queryType,
    data: {},
    summary: {},
    sources: [],
    generated: new Date().toISOString(),
    error,
  }
}
