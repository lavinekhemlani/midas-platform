import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'

/**
 * GET /api/providers/dynamics/income-statement-test
 *
 * Two approaches for P&L:
 *   1. accounts entity (all-time only — netChange FlowField can't be date-filtered on this tenant)
 *   2. generalLedgerEntries aggregated by account (date-filterable via postingDate)
 *
 * The hierarchy comes from accounts (Begin-Total / End-Total structure).
 * Period amounts come from GL entries when dates are provided.
 */

interface PnLLine {
  lineNumber: number
  display: string
  netChange: number
  lineType: 'header' | 'detail' | 'total' | 'spacer' | 'computed'
  indentation: number
  _accountNumber?: string
  _accountType?: string
  _category?: string
  _subCategory?: string
  _computed?: boolean
}

/**
 * Decode OData-encoded strings from BC API.
 * BC encodes special chars as _xHHHH_ (e.g., _x0020_ = space, _x002d_ = hyphen).
 */
function decodeODataString(s: string): string {
  return s.replace(/_x([0-9a-f]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * Build P&L hierarchy from the FULL chart of accounts using Begin-Total/End-Total structure.
 *
 * BC's native Income Statement doesn't filter by the `category` field — it uses the chart
 * structure. An account that sits between the "Cost of Goods Sold" Begin-Total and its
 * End-Total is a COGS account, even if its individual `category` field is blank.
 *
 * Algorithm:
 *   1. Sort ALL accounts by number (chart order)
 *   2. Walk through tracking Begin-Total/End-Total depth
 *   3. When a depth-0 Begin-Total has a P&L category, we're in a P&L section → emit lines
 *   4. When that section's End-Total closes, stop emitting until the next P&L section
 *
 * If `glAmounts` is provided, use those for line amounts instead of account.netChange.
 */
function buildNativeBCHierarchy(
  allAccounts: any[],
  glAmounts?: Map<string, number>
): {
  lines: PnLLine[]
  totals: {
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
  }
  stats: { totalAccounts: number; plAccounts: number; linesBuilt: number }
} {
  const PL_CATEGORIES = ['Income', 'Expense', 'Cost of Goods Sold']

  // Sort ALL accounts by number — this is the chart order
  const sorted = [...allAccounts].sort((a: any, b: any) =>
    (a.number || '').localeCompare(b.number || '')
  )

  const lines: PnLLine[] = []
  let lineNumber = 0

  // Global depth tracks nesting across the ENTIRE chart of accounts
  let globalDepth = 0
  // Whether we're currently inside a P&L section (depth-0 Begin-Total with P&L category)
  let inPLSection = false
  // The depth at which the current P&L section started (always 0 for top-level sections)
  let plSectionStartDepth = 0
  // Relative depth within the P&L section (for indentation)
  let relativeDepth = 0
  // Category of the current P&L section
  let plSectionCategory = ''
  // Stack of categories at each depth level (for nested sections)
  const categoryStack: string[] = []
  // Stack of running sums for each nesting level within the P&L section
  const sumStack: number[] = []

  let plAccountCount = 0

  for (const acc of sorted) {
    const accType = decodeODataString(acc.accountType || '').toLowerCase()
    const name = acc.displayName || acc.number
    const rawCat = decodeODataString(acc.category || '').trim()

    // Determine the amount for this account
    const nc = glAmounts ? (glAmounts.get(acc.number) ?? 0) : (acc.netChange ?? 0)

    if (accType === 'begin-total') {
      if (!inPLSection && globalDepth === 0 && PL_CATEGORIES.includes(rawCat)) {
        // Entering a top-level P&L section
        inPLSection = true
        plSectionStartDepth = globalDepth
        plSectionCategory = rawCat
        relativeDepth = 0
        categoryStack[0] = rawCat
        sumStack[0] = 0

        lines.push({
          lineNumber: lineNumber++,
          display: name,
          netChange: 0,
          lineType: 'header',
          indentation: 0,
          _accountNumber: acc.number,
          _accountType: accType,
          _category: rawCat,
        })
        plAccountCount++
        relativeDepth++
      } else if (inPLSection) {
        // Nested Begin-Total within a P&L section
        categoryStack[relativeDepth] = rawCat || plSectionCategory
        sumStack[relativeDepth] = 0

        lines.push({
          lineNumber: lineNumber++,
          display: name,
          netChange: 0,
          lineType: 'header',
          indentation: relativeDepth,
          _accountNumber: acc.number,
          _accountType: accType,
          _category: rawCat || plSectionCategory,
        })
        plAccountCount++
        relativeDepth++
      }
      globalDepth++
    } else if (accType === 'end-total' || accType === 'total') {
      globalDepth = Math.max(0, globalDepth - 1)

      if (inPLSection) {
        relativeDepth = Math.max(0, relativeDepth - 1)
        // Use GL-aggregated sum if available, otherwise use account's own netChange
        const totalAmount = glAmounts ? (sumStack[relativeDepth] ?? 0) : nc
        // Propagate sum up to parent section
        if (relativeDepth > 0) {
          sumStack[relativeDepth - 1] = (sumStack[relativeDepth - 1] ?? 0) + totalAmount
        }

        lines.push({
          lineNumber: lineNumber++,
          display: name,
          netChange: totalAmount,
          lineType: 'total',
          indentation: relativeDepth,
          _accountNumber: acc.number,
          _accountType: accType,
          _category: categoryStack[relativeDepth] || plSectionCategory,
        })
        plAccountCount++

        // If we closed back to the top-level P&L section, we're done with it
        if (relativeDepth === 0 && globalDepth <= plSectionStartDepth) {
          inPLSection = false
        }
      }
    } else if (inPLSection) {
      // Heading or Posting account inside a P&L section
      if (accType === 'heading') {
        lines.push({
          lineNumber: lineNumber++,
          display: name,
          netChange: 0,
          lineType: 'header',
          indentation: relativeDepth,
          _accountNumber: acc.number,
          _accountType: accType,
          _category: plSectionCategory,
        })
      } else {
        // Posting account (or any other type — treat as detail)
        if (relativeDepth > 0 && nc !== 0) {
          sumStack[relativeDepth - 1] = (sumStack[relativeDepth - 1] ?? 0) + nc
        }
        lines.push({
          lineNumber: lineNumber++,
          display: name,
          netChange: nc,
          lineType: 'detail',
          indentation: relativeDepth,
          _accountNumber: acc.number,
          _accountType: accType,
          _category: plSectionCategory,
          _subCategory: decodeODataString(acc.subCategory || ''),
        })
      }
      plAccountCount++
    }
    // else: non-P&L section account — skip
  }

  // Compute summary from depth-0 End-Total lines
  let totalRevenue = 0
  let totalExpenses = 0
  let totalCOGS = 0
  for (const line of lines) {
    if (line.lineType !== 'total' || line.indentation !== 0) continue
    const cat = line._category || ''
    if (cat === 'Income') totalRevenue += Math.abs(line.netChange)
    else if (cat === 'Cost of Goods Sold') totalCOGS += Math.abs(line.netChange)
    else if (cat === 'Expense') totalExpenses += Math.abs(line.netChange)
  }

  // If COGS wasn't found at depth-0, it may be nested inside the Expense section.
  // Look for depth-1 totals with category 'Cost of Goods Sold' and extract them
  // from totalExpenses so COGS and operating expenses are reported separately.
  if (totalCOGS === 0) {
    let nestedCOGS = 0
    for (const line of lines) {
      if (line.lineType !== 'total' || line.indentation !== 1) continue
      const cat = line._category || ''
      if (cat === 'Cost of Goods Sold') {
        nestedCOGS += Math.abs(line.netChange)
      }
    }
    if (nestedCOGS > 0) {
      totalCOGS = nestedCOGS
      totalExpenses -= nestedCOGS
    }
  }

  const grossProfit = totalRevenue - totalCOGS

  // Classify expense sub-components for operating income & EBITDA
  // Iterate ALL accounts with Expense category directly (not hierarchy lines which can miss accounts at depth 0)
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
    const at = decodeODataString(acc.accountType || '').toLowerCase()
    if (at !== 'posting') continue
    const nc = glAmounts ? (glAmounts.get(acc.number) ?? 0) : (acc.netChange ?? 0)
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
  const netIncome = grossProfit - totalExpenses
  const ebitda = operatingIncome + depreciationAmortization

  lines.push({
    lineNumber: lineNumber++,
    display: '',
    netChange: 0,
    lineType: 'spacer',
    indentation: 0,
  })
  lines.push({
    lineNumber: lineNumber++,
    display: 'Gross Profit',
    netChange: grossProfit,
    lineType: 'computed',
    indentation: 0,
    _computed: true,
  })
  lines.push({
    lineNumber: lineNumber++,
    display: 'Net Income',
    netChange: netIncome,
    lineType: 'computed',
    indentation: 0,
    _computed: true,
  })

  return {
    lines,
    totals: {
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
    },
    stats: {
      totalAccounts: allAccounts.length,
      plAccounts: plAccountCount,
      linesBuilt: lines.length,
    },
  }
}

/**
 * Fetch GL entries for a date range and aggregate debit-credit by account number.
 * Returns a Map of accountNumber → netAmount (debit - credit).
 */
async function getGLAmountsByAccount(
  client: BusinessCentralClient,
  startDate: string,
  endDate: string
): Promise<{ amounts: Map<string, number>; entryCount: number }> {
  const filter = `postingDate ge ${startDate} and postingDate le ${endDate}`
  const entries = await client.listGeneralLedgerEntries({
    $filter: filter,
    $select: 'accountNumber,debitAmount,creditAmount',
  })

  const amounts = new Map<string, number>()
  for (const entry of entries) {
    const accNum = entry.accountNumber
    if (!accNum) continue
    const debit = entry.debitAmount ?? 0
    const credit = entry.creditAmount ?? 0
    amounts.set(accNum, (amounts.get(accNum) ?? 0) + debit - credit)
  }

  return { amounts, entryCount: entries.length }
}

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const mode = url.searchParams.get('mode') || 'diagnostic'

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
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined

    // ── P&L mode: return the hierarchy for rendering ──
    if (mode === 'pnl') {
      const t0 = Date.now()

      // Fetch accounts + company info (for currency) in parallel
      const [allAccounts, companyInfo] = await Promise.all([
        client.queryAll('accounts'),
        client
          .query('companyInformation', { $top: 1 })
          .then((r: any) => r.value?.[0])
          .catch(() => null),
      ])
      const currency = companyInfo?.currencyCode || 'USD'

      // If dates provided, fetch GL entries for period amounts
      let glAmounts: Map<string, number> | undefined
      let glEntryCount = 0
      if (startDate && endDate) {
        const gl = await getGLAmountsByAccount(client, startDate, endDate)
        glAmounts = gl.amounts
        glEntryCount = gl.entryCount
      }

      const result = buildNativeBCHierarchy(allAccounts, glAmounts)

      // Debug: collect all unique categories (decoded) from accounts
      const categoryCounts: Record<string, number> = {}
      for (const acc of allAccounts) {
        const cat = decodeODataString(acc.category || '') || '(empty)'
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
      }

      // Debug: find accounts that might be "missing" — search by name fragments
      const missingSearch = [
        'FBA',
        'Stripe',
        'Advertising',
        'Inventory Write',
        'Foreign Exchange',
        'Rounding',
        'Depreciation - Furniture',
        'PRC',
      ]
      const missingMatches = allAccounts
        .filter((a: any) => {
          const name = (a.displayName || a.number || '').toLowerCase()
          return missingSearch.some((s) => name.includes(s.toLowerCase()))
        })
        .map((a: any) => ({
          number: a.number,
          displayName: a.displayName,
          category: a.category,
          categoryDecoded: decodeODataString(a.category || ''),
          accountType: a.accountType,
          accountTypeDecoded: decodeODataString(a.accountType || ''),
          subCategory: a.subCategory,
        }))

      // Also list ALL accounts by their decoded accountType to spot any unhandled types
      const accountTypeCounts: Record<string, number> = {}
      for (const acc of allAccounts) {
        const t = decodeODataString(acc.accountType || '') || '(empty)'
        accountTypeCounts[t] = (accountTypeCounts[t] || 0) + 1
      }

      return NextResponse.json({
        data: {
          lines: result.lines,
          totals: result.totals,
          companyName: credentials.company_name || null,
          currency,
          period: { startDate, endDate },
          source: glAmounts ? 'gl-entries' : 'accounts-all-time',
          glEntryCount,
          dateFiltered: !!glAmounts,
        },
        _debug: {
          categoryCounts,
          accountTypeCounts,
          plAccountsIncluded: result.stats.plAccounts,
          totalAccounts: allAccounts.length,
          missingAccountSearch: missingMatches,
        },
        durationMs: Date.now() - t0,
      })
    }

    // ── Individual test mode: run a single phase ──
    const testParam = url.searchParams.get('test')

    if (testParam === 'entity-probe') {
      const t0 = Date.now()
      await client.query('companyInformation', { $top: 1 })

      const pnlEntities = [
        { name: 'accounts', description: 'Chart of accounts' },
        { name: 'generalLedgerEntries', description: 'GL entries' },
        { name: 'incomeStatement', description: 'Native BC income statement' },
        { name: 'trialBalance', description: 'Trial balance' },
        {
          name: 'salesInvoices',
          description: 'Sales invoices — 57 fields incl. sellToCity/Country',
        },
        { name: 'purchaseInvoices', description: 'Purchase invoices' },
        { name: 'salesInvoiceLines', description: 'Sales invoice line items' },
        { name: 'purchaseInvoiceLines', description: 'Purchase invoice line items' },
        { name: 'salesCreditMemoLines', description: 'Sales credit memo lines' },
        { name: 'purchaseCreditMemoLines', description: 'Purchase credit memo lines' },
        { name: 'customers', description: 'Customer master — city, state, country' },
        { name: 'vendors', description: 'Vendor master — city, state, country' },
        { name: 'dimensions', description: 'Dimension definitions' },
        { name: 'dimensionValues', description: 'Dimension value options' },
        { name: 'dimensionSetEntries', description: 'Dimension set entries' },
        { name: 'locations', description: 'Location/warehouse master' },
      ]

      const probe: Record<string, any> = {}
      await Promise.allSettled(
        pnlEntities.map(async (entity) => {
          const et0 = Date.now()
          try {
            const res = await client.query(entity.name, { $top: 3 })
            const rows = res.value || []
            probe[entity.name] = {
              available: true,
              count: res['@odata.count'] ?? rows.length,
              fields: rows[0] ? Object.keys(rows[0]) : [],
              sampleRecord: rows[0] || null,
              description: entity.description,
              durationMs: Date.now() - et0,
            }
          } catch (err: any) {
            probe[entity.name] = {
              available: false,
              error: err.message?.slice(0, 200) || String(err),
              description: entity.description,
              durationMs: Date.now() - et0,
            }
          }
        })
      )

      return NextResponse.json({
        test: 'entity-probe',
        entityProbe: probe,
        durationMs: Date.now() - t0,
      })
    }

    if (testParam === 'sales-geography') {
      const t0 = Date.now()

      // ── Customer name → country inference map ──
      // Patterns to infer country when sellToCountry/shipToCountry is empty
      const CUSTOMER_COUNTRY_PATTERNS: Array<{
        pattern: RegExp
        country: string
        region?: string
      }> = [
        { pattern: /amazon\s*(us|usa|u\.s)/i, country: 'US', region: 'Amazon US' },
        { pattern: /amazon.*united\s*states/i, country: 'US', region: 'Amazon US' },
        { pattern: /amazon\s*(eu|europe)/i, country: 'EU', region: 'Amazon EU' },
        {
          pattern: /amazon\s*(uk|united\s*kingdom|gb|britain)/i,
          country: 'GB',
          region: 'Amazon UK',
        },
        { pattern: /amazon\s*(ca|canada)/i, country: 'CA', region: 'Amazon CA' },
        { pattern: /amazon\s*(au|australia)/i, country: 'AU', region: 'Amazon AU' },
        { pattern: /amazon\s*(de|germany|deutschland)/i, country: 'DE', region: 'Amazon DE' },
        { pattern: /amazon\s*(fr|france)/i, country: 'FR', region: 'Amazon FR' },
        { pattern: /amazon\s*(it|ital)/i, country: 'IT', region: 'Amazon IT' },
        { pattern: /amazon\s*(es|spain|españa)/i, country: 'ES', region: 'Amazon ES' },
        { pattern: /amazon\s*(jp|japan)/i, country: 'JP', region: 'Amazon JP' },
        { pattern: /amazon\s*(mx|mexico)/i, country: 'MX', region: 'Amazon MX' },
        { pattern: /\(us\)\s*(limited|ltd|inc|corp|llc)/i, country: 'US' },
        { pattern: /\(uk\)\s*(limited|ltd|inc|corp|llc)/i, country: 'GB' },
        { pattern: /teknoloji\s*ürün/i, country: 'TR' }, // Turkish tech company
      ]

      function inferCountryFromName(
        name: string
      ): { country: string; inferred: boolean; region?: string } | null {
        for (const rule of CUSTOMER_COUNTRY_PATTERNS) {
          if (rule.pattern.test(name)) {
            return { country: rule.country, inferred: true, region: rule.region }
          }
        }
        return null
      }

      // Fetch all sales invoices for the period with geographic fields
      const filters: string[] = []
      if (startDate) filters.push(`invoiceDate ge ${startDate}`)
      if (endDate) filters.push(`invoiceDate le ${endDate}`)

      const invoices = await client.queryAll('salesInvoices', {
        $select:
          'number,invoiceDate,customerNumber,customerName,sellToCity,sellToCountry,sellToState,shipToCity,shipToCountry,shipToState,totalAmountExcludingTax,totalAmountIncludingTax,currencyCode,shortcutDimension1Code,shortcutDimension2Code',
        ...(filters.length > 0 && { $filter: filters.join(' and ') }),
      })

      // ── Pass 1: Build per-customer country/city frequency maps ──
      // This lets us pick the MOST COMMON country/city for each customer (not the first one)
      const custGeoFrequency: Record<
        string,
        {
          countries: Record<string, number>
          cities: Record<string, number>
          states: Record<string, number>
        }
      > = {}

      for (const inv of invoices) {
        const custNum = inv.customerNumber || 'Unknown'
        if (!custGeoFrequency[custNum]) {
          custGeoFrequency[custNum] = { countries: {}, cities: {}, states: {} }
        }
        const rawCountry = inv.sellToCountry || inv.shipToCountry || ''
        const rawCity = inv.sellToCity || inv.shipToCity || ''
        const rawState = inv.sellToState || inv.shipToState || ''
        if (rawCountry)
          custGeoFrequency[custNum].countries[rawCountry] =
            (custGeoFrequency[custNum].countries[rawCountry] || 0) + 1
        if (rawCity)
          custGeoFrequency[custNum].cities[rawCity] =
            (custGeoFrequency[custNum].cities[rawCity] || 0) + 1
        if (rawState)
          custGeoFrequency[custNum].states[rawState] =
            (custGeoFrequency[custNum].states[rawState] || 0) + 1
      }

      // Helper: get most frequent value from a frequency map
      function mostFrequent(freq: Record<string, number>): string {
        let best = '',
          bestCount = 0
        for (const [val, count] of Object.entries(freq)) {
          if (count > bestCount) {
            best = val
            bestCount = count
          }
        }
        return best
      }

      // ── Pass 2: Aggregate with smart country resolution ──
      const byCountry: Record<
        string,
        {
          country: string
          totalAmount: number
          invoiceCount: number
          inferredCount: number
          customers: Set<string>
          cities: Set<string>
        }
      > = {}
      const byCity: Record<
        string,
        {
          city: string
          country: string
          state: string
          totalAmount: number
          invoiceCount: number
          customers: Set<string>
        }
      > = {}
      const byCustomer: Record<
        string,
        {
          customerNumber: string
          name: string
          city: string
          country: string
          state: string
          totalAmount: number
          invoiceCount: number
          countrySource: string
        }
      > = {}
      const byDimension1: Record<
        string,
        { code: string; totalAmount: number; invoiceCount: number }
      > = {}
      const byDimension2: Record<
        string,
        { code: string; totalAmount: number; invoiceCount: number }
      > = {}
      const inferenceLog: Array<{
        customer: string
        originalCountry: string
        inferredCountry: string
        rule: string
      }> = []

      for (const inv of invoices) {
        const amount = inv.totalAmountIncludingTax ?? 0
        const custNum = inv.customerNumber || 'Unknown'
        const custName = inv.customerName || custNum

        // Resolve country: invoice field → customer name inference → unknown
        let country = inv.sellToCountry || inv.shipToCountry || ''
        let city = inv.sellToCity || inv.shipToCity || ''
        let state = inv.sellToState || inv.shipToState || ''
        let countrySource = country ? 'invoice' : ''

        if (!country) {
          // Try customer name inference
          const inferred = inferCountryFromName(custName)
          if (inferred) {
            country = inferred.country
            countrySource = `inferred:${inferred.region || custName}`
          } else {
            // Try most frequent country from this customer's other invoices
            const freq = custGeoFrequency[custNum]
            if (freq) {
              const freqCountry = mostFrequent(freq.countries)
              if (freqCountry) {
                country = freqCountry
                countrySource = 'frequency'
              }
            }
          }
        }
        if (!city) {
          const freq = custGeoFrequency[custNum]
          if (freq) {
            const freqCity = mostFrequent(freq.cities)
            if (freqCity) city = freqCity
          }
        }
        if (!state) {
          const freq = custGeoFrequency[custNum]
          if (freq) {
            const freqState = mostFrequent(freq.states)
            if (freqState) state = freqState
          }
        }

        // Normalize UK → GB for consistency
        if (country === 'UK') country = 'GB'

        const finalCountry = country || '(unknown)'
        const finalCity = city || '(unknown)'
        const cityKey = `${finalCity}|${finalCountry}`

        // By country
        if (!byCountry[finalCountry]) {
          byCountry[finalCountry] = {
            country: finalCountry,
            totalAmount: 0,
            invoiceCount: 0,
            inferredCount: 0,
            customers: new Set(),
            cities: new Set(),
          }
        }
        byCountry[finalCountry].totalAmount += amount
        byCountry[finalCountry].invoiceCount++
        if (countrySource.startsWith('inferred') || countrySource === 'frequency')
          byCountry[finalCountry].inferredCount++
        byCountry[finalCountry].customers.add(custName)
        byCountry[finalCountry].cities.add(finalCity)

        // By city
        if (!byCity[cityKey]) {
          byCity[cityKey] = {
            city: finalCity,
            country: finalCountry,
            state,
            totalAmount: 0,
            invoiceCount: 0,
            customers: new Set(),
          }
        }
        byCity[cityKey].totalAmount += amount
        byCity[cityKey].invoiceCount++
        byCity[cityKey].customers.add(custName)

        // By customer — use best available geo
        if (!byCustomer[custNum]) {
          // For byCustomer, use the most frequent non-unknown country/city
          const freq = custGeoFrequency[custNum]
          let bestCountry = mostFrequent(freq?.countries || {}) || ''
          let bestCity = mostFrequent(freq?.cities || {}) || ''
          let bestState = mostFrequent(freq?.states || {}) || ''
          let bestCountrySource = bestCountry ? 'most-frequent' : ''

          // If still no country, try name inference
          if (!bestCountry) {
            const inferred = inferCountryFromName(custName)
            if (inferred) {
              bestCountry = inferred.country
              bestCountrySource = `inferred:${inferred.region || custName}`
              // Log inference for transparency
              inferenceLog.push({
                customer: custName,
                originalCountry: '(unknown)',
                inferredCountry: inferred.country,
                rule: inferred.region || 'name-pattern',
              })
            }
          }
          if (bestCountry === 'UK') bestCountry = 'GB'

          byCustomer[custNum] = {
            customerNumber: custNum,
            name: custName,
            city: bestCity || '(unknown)',
            country: bestCountry || '(unknown)',
            state: bestState,
            totalAmount: 0,
            invoiceCount: 0,
            countrySource: bestCountrySource || 'unknown',
          }
        }
        byCustomer[custNum].totalAmount += amount
        byCustomer[custNum].invoiceCount++

        // By dimensions
        const dim1 = inv.shortcutDimension1Code || ''
        const dim2 = inv.shortcutDimension2Code || ''
        if (dim1) {
          if (!byDimension1[dim1])
            byDimension1[dim1] = { code: dim1, totalAmount: 0, invoiceCount: 0 }
          byDimension1[dim1].totalAmount += amount
          byDimension1[dim1].invoiceCount++
        }
        if (dim2) {
          if (!byDimension2[dim2])
            byDimension2[dim2] = { code: dim2, totalAmount: 0, invoiceCount: 0 }
          byDimension2[dim2].totalAmount += amount
          byDimension2[dim2].invoiceCount++
        }
      }

      // Convert sets to arrays for JSON serialization
      const countrySales = Object.values(byCountry)
        .map((c) => ({
          country: c.country,
          totalAmount: c.totalAmount,
          invoiceCount: c.invoiceCount,
          customerCount: c.customers.size,
          inferredCount: c.inferredCount,
          cities: [...c.cities].filter((c) => c !== '(unknown)'),
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)

      const citySales = Object.values(byCity)
        .map((c) => ({
          city: c.city,
          country: c.country,
          state: c.state,
          totalAmount: c.totalAmount,
          invoiceCount: c.invoiceCount,
          customerCount: c.customers.size,
          customers: [...c.customers].slice(0, 5),
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)

      const customerSales = Object.values(byCustomer)
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 30)

      const dim1Sales = Object.values(byDimension1).sort((a, b) => b.totalAmount - a.totalAmount)
      const dim2Sales = Object.values(byDimension2).sort((a, b) => b.totalAmount - a.totalAmount)

      // Summary stats
      const totalUnknownBefore = invoices.filter(
        (inv: any) => !inv.sellToCountry && !inv.shipToCountry
      ).length
      const totalUnknownAfter =
        countrySales.find((c) => c.country === '(unknown)')?.invoiceCount || 0
      const resolvedCount = totalUnknownBefore - totalUnknownAfter

      return NextResponse.json({
        test: 'sales-geography',
        totalInvoices: invoices.length,
        totalAmount: invoices.reduce(
          (s: number, inv: any) => s + (inv.totalAmountIncludingTax ?? 0),
          0
        ),
        byCountry: countrySales,
        byCity: citySales,
        byCustomer: customerSales,
        byDimension1: dim1Sales,
        byDimension2: dim2Sales,
        countryResolution: {
          totalWithoutCountry: totalUnknownBefore,
          resolvedByInference: resolvedCount,
          stillUnknown: totalUnknownAfter,
          inferenceLog,
        },
        period: { startDate, endDate },
        companyName: credentials.company_name || null,
        durationMs: Date.now() - t0,
      })
    }

    if (testParam === 'account-analysis') {
      const t0 = Date.now()
      const allAccounts = await client.queryAll('accounts')

      const categoryCounts: Record<string, number> = {}
      const accountTypeCounts: Record<string, number> = {}
      const subCategoryCounts: Record<string, number> = {}
      let plAccountCount = 0
      let postingCount = 0

      for (const acc of allAccounts) {
        const cat = decodeODataString(acc.category || '') || '(empty)'
        const accType = decodeODataString(acc.accountType || '') || '(empty)'
        const sub = decodeODataString(acc.subCategory || '') || '(empty)'
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
        accountTypeCounts[accType] = (accountTypeCounts[accType] || 0) + 1
        if (['Income', 'Expense', 'Cost of Goods Sold'].includes(cat)) {
          plAccountCount++
          subCategoryCounts[`${cat} → ${sub}`] = (subCategoryCounts[`${cat} → ${sub}`] || 0) + 1
        }
        if (accType.toLowerCase() === 'posting') postingCount++
      }

      return NextResponse.json({
        test: 'account-analysis',
        accountAnalysis: {
          totalAccounts: allAccounts.length,
          plAccountCount,
          postingCount,
          categoryCounts,
          accountTypeCounts,
          subCategoryCounts: Object.entries(subCategoryCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([k, v]) => ({ path: k, count: v })),
        },
        durationMs: Date.now() - t0,
      })
    }

    if (testParam === 'statement-tests') {
      const t0 = Date.now()
      const allAccounts = await client.queryAll('accounts')
      const tests: any[] = []

      // All-time
      try {
        const result = buildNativeBCHierarchy(allAccounts)
        tests.push({
          method: 'accounts.netChange (all-time)',
          description: 'Cumulative all-time',
          totals: result.totals,
          linesBuilt: result.stats.linesBuilt,
          durationMs: Date.now() - t0,
        })
      } catch (err: any) {
        tests.push({
          method: 'accounts.netChange (all-time)',
          description: 'Failed',
          totals: null,
          linesBuilt: 0,
          durationMs: Date.now() - t0,
          error: err.message,
        })
      }

      // GL entries for period
      if (startDate && endDate) {
        const t1 = Date.now()
        try {
          const gl = await getGLAmountsByAccount(client, startDate, endDate)
          const result = buildNativeBCHierarchy(allAccounts, gl.amounts)
          tests.push({
            method: `GL entries (${startDate} to ${endDate})`,
            description: `${gl.entryCount} GL entries → ${gl.amounts.size} accounts`,
            totals: result.totals,
            linesBuilt: result.stats.linesBuilt,
            durationMs: Date.now() - t1,
          })
        } catch (err: any) {
          tests.push({
            method: `GL entries (${startDate} to ${endDate})`,
            description: 'Failed',
            totals: null,
            linesBuilt: 0,
            durationMs: Date.now() - t1,
            error: err.message,
          })
        }
      }

      return NextResponse.json({
        test: 'statement-tests',
        statementTests: tests,
        durationMs: Date.now() - t0,
      })
    }

    if (testParam === 'monthly-trend') {
      const t0 = Date.now()
      const allAccounts = await client.queryAll('accounts')
      const glEntries = await client.listGeneralLedgerEntries({
        ...(startDate &&
          endDate && { $filter: `postingDate ge ${startDate} and postingDate le ${endDate}` }),
        $select: 'accountNumber,debitAmount,creditAmount,postingDate',
      })

      const accountCatMap = new Map<string, string>()
      for (const acc of allAccounts) {
        const cat = decodeODataString(acc.category || '')
        const t = decodeODataString(acc.accountType || '').toLowerCase()
        if (t === 'posting' && ['Income', 'Expense', 'Cost of Goods Sold'].includes(cat)) {
          accountCatMap.set(acc.number, cat)
        }
      }

      const monthlyMap: Record<string, { revenue: number; cogs: number; expenses: number }> = {}
      for (const entry of glEntries) {
        const cat = accountCatMap.get(entry.accountNumber)
        if (!cat) continue
        const month = (entry.postingDate || '').substring(0, 7)
        if (!month) continue
        if (!monthlyMap[month]) monthlyMap[month] = { revenue: 0, cogs: 0, expenses: 0 }
        const debit = entry.debitAmount ?? 0
        const credit = entry.creditAmount ?? 0
        if (cat === 'Income') monthlyMap[month].revenue += credit - debit
        else if (cat === 'Cost of Goods Sold') monthlyMap[month].cogs += debit - credit
        else if (cat === 'Expense') monthlyMap[month].expenses += debit - credit
      }

      const monthlyTrend = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          revenue: data.revenue,
          cogs: data.cogs,
          grossProfit: data.revenue - data.cogs,
          expenses: data.expenses,
          netIncome: data.revenue - data.cogs - data.expenses,
        }))

      return NextResponse.json({ test: 'monthly-trend', monthlyTrend, durationMs: Date.now() - t0 })
    }

    // ── Full diagnostic mode (runs all phases) ──

    const t0All = Date.now()

    // Warm up token
    await client.query('companyInformation', { $top: 1 })

    // ═══ Phase 1: Entity Probe ═══
    const pnlEntities = [
      {
        name: 'accounts',
        description: 'Chart of accounts — categories, hierarchy, netChange FlowField',
      },
      { name: 'generalLedgerEntries', description: 'GL entries — primary source for dated P&L' },
      { name: 'incomeStatement', description: 'Native BC income statement report entity' },
      { name: 'trialBalance', description: 'Trial balance — totalDebit/totalCredit for period' },
      { name: 'salesInvoices', description: 'Sales invoices — revenue by customer/document' },
      { name: 'purchaseInvoices', description: 'Purchase invoices — expenses by vendor/document' },
      { name: 'salesInvoiceLines', description: 'Sales invoice line items — product-level sales' },
      {
        name: 'purchaseInvoiceLines',
        description: 'Purchase invoice line items — product-level purchases',
      },
      { name: 'salesCreditMemoLines', description: 'Sales credit memo lines — returns/refunds' },
      {
        name: 'purchaseCreditMemoLines',
        description: 'Purchase credit memo lines — purchase returns',
      },
      { name: 'customers', description: 'Customer master data — address, city, contact info' },
      { name: 'vendors', description: 'Vendor master data — address, city, contact info' },
      {
        name: 'dimensions',
        description: 'Dimension definitions (Department, Location, Project, etc.)',
      },
      { name: 'dimensionValues', description: 'Dimension value options' },
      { name: 'dimensionSetEntries', description: 'Dimension set entries linked to GL entries' },
      { name: 'locations', description: 'Location/warehouse master data' },
    ]

    const entityProbe: Record<
      string,
      {
        available: boolean
        count?: number
        fields?: string[]
        sampleRecord?: any
        error?: string
        durationMs: number
        description: string
      }
    > = {}

    await Promise.allSettled(
      pnlEntities.map(async (entity) => {
        const et0 = Date.now()
        try {
          const res = await client.query(entity.name, { $top: 3 })
          const rows = res.value || []
          entityProbe[entity.name] = {
            available: true,
            count: res['@odata.count'] ?? rows.length,
            fields: rows[0] ? Object.keys(rows[0]) : [],
            sampleRecord: rows[0] || null,
            description: entity.description,
            durationMs: Date.now() - et0,
          }
        } catch (err: any) {
          entityProbe[entity.name] = {
            available: false,
            error: err.message?.slice(0, 200) || String(err),
            description: entity.description,
            durationMs: Date.now() - et0,
          }
        }
      })
    )

    // ═══ Phase 2: Chart of Accounts Analysis ═══
    let accountAnalysis: any = null
    let allAccounts: any[] = []

    if (entityProbe.accounts?.available) {
      allAccounts = await client.queryAll('accounts')

      // Category breakdown
      const categoryCounts: Record<string, number> = {}
      const accountTypeCounts: Record<string, number> = {}
      const subCategoryCounts: Record<string, number> = {}
      let plAccountCount = 0
      let postingCount = 0

      for (const acc of allAccounts) {
        const cat = decodeODataString(acc.category || '') || '(empty)'
        const accType = decodeODataString(acc.accountType || '') || '(empty)'
        const sub = decodeODataString(acc.subCategory || '') || '(empty)'

        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
        accountTypeCounts[accType] = (accountTypeCounts[accType] || 0) + 1

        if (['Income', 'Expense', 'Cost of Goods Sold'].includes(cat)) {
          plAccountCount++
          subCategoryCounts[`${cat} → ${sub}`] = (subCategoryCounts[`${cat} → ${sub}`] || 0) + 1
        }
        if (accType.toLowerCase() === 'posting') postingCount++
      }

      accountAnalysis = {
        totalAccounts: allAccounts.length,
        plAccountCount,
        postingCount,
        categoryCounts,
        accountTypeCounts,
        subCategoryCounts: Object.entries(subCategoryCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([k, v]) => ({ path: k, count: v })),
      }
    }

    // ═══ Phase 3: P&L Statement Tests ═══
    let statementTests: any = null

    if (allAccounts.length > 0) {
      const tests: Array<{
        method: string
        description: string
        totals: any
        linesBuilt: number
        durationMs: number
        error?: string
      }> = []

      // Test A: All-time (accounts.netChange)
      {
        const t0 = Date.now()
        try {
          const result = buildNativeBCHierarchy(allAccounts)
          tests.push({
            method: 'accounts.netChange (all-time)',
            description: 'Uses account FlowField netChange — cumulative all-time amounts',
            totals: result.totals,
            linesBuilt: result.stats.linesBuilt,
            durationMs: Date.now() - t0,
          })
        } catch (err: any) {
          tests.push({
            method: 'accounts.netChange (all-time)',
            description: 'Failed',
            totals: null,
            linesBuilt: 0,
            durationMs: Date.now() - t0,
            error: err.message,
          })
        }
      }

      // Test B: GL entries for period
      if (startDate && endDate) {
        const t0 = Date.now()
        try {
          const gl = await getGLAmountsByAccount(client, startDate, endDate)
          const result = buildNativeBCHierarchy(allAccounts, gl.amounts)
          tests.push({
            method: `GL entries (${startDate} to ${endDate})`,
            description: `${gl.entryCount} GL entries → ${gl.amounts.size} accounts with activity`,
            totals: result.totals,
            linesBuilt: result.stats.linesBuilt,
            durationMs: Date.now() - t0,
          })
        } catch (err: any) {
          tests.push({
            method: `GL entries (${startDate} to ${endDate})`,
            description: 'Failed',
            totals: null,
            linesBuilt: 0,
            durationMs: Date.now() - t0,
            error: err.message,
          })
        }
      }

      // Test C: Native incomeStatement entity
      if (entityProbe.incomeStatement?.available) {
        const t0 = Date.now()
        try {
          let filter: string | undefined
          if (startDate && endDate) {
            filter = `dateFilter eq '${startDate}..${endDate}'`
          }
          const res = await client.query(
            'incomeStatement',
            filter ? { $filter: filter } : undefined
          )
          const rows = res.value || []

          // Extract totals from native format
          let nativeRevenue = 0
          let nativeCOGS = 0
          let nativeExpenses = 0
          for (const row of rows) {
            const lineType = (row.lineType || '').toLowerCase()
            const display = (row.display || '').toLowerCase()
            const amount = Math.abs(row.netChange ?? 0)
            if (lineType === 'total' || lineType === 'end-total') {
              if (
                display.includes('income') ||
                display.includes('revenue') ||
                display.includes('sales')
              ) {
                nativeRevenue = Math.max(nativeRevenue, amount)
              } else if (display.includes('cost') && display.includes('goods')) {
                nativeCOGS = Math.max(nativeCOGS, amount)
              } else if (display.includes('expense')) {
                nativeExpenses = Math.max(nativeExpenses, amount)
              }
            }
          }

          tests.push({
            method: 'Native incomeStatement entity',
            description: `${rows.length} rows from BC incomeStatement report`,
            totals: {
              totalRevenue: nativeRevenue,
              totalCOGS: nativeCOGS,
              grossProfit: nativeRevenue - nativeCOGS,
              totalExpenses: nativeExpenses,
              operatingIncome: nativeRevenue - nativeCOGS - nativeExpenses,
              netIncome: nativeRevenue - nativeCOGS - nativeExpenses,
            },
            linesBuilt: rows.length,
            durationMs: Date.now() - t0,
          })
        } catch (err: any) {
          tests.push({
            method: 'Native incomeStatement entity',
            description: 'Failed',
            totals: null,
            linesBuilt: 0,
            durationMs: Date.now() - t0,
            error: err.message,
          })
        }
      }

      statementTests = tests
    }

    // ═══ Phase 4: Revenue Analysis ═══
    let revenueAnalysis: any = null

    if (startDate && endDate && allAccounts.length > 0) {
      try {
        const gl = await getGLAmountsByAccount(client, startDate, endDate)

        // Group revenue by subcategory
        const revenueBySubCategory: Record<string, { amount: number; accounts: string[] }> = {}
        for (const acc of allAccounts) {
          const cat = decodeODataString(acc.category || '')
          if (cat !== 'Income') continue
          const accType = decodeODataString(acc.accountType || '').toLowerCase()
          if (accType !== 'posting') continue
          const amount = gl.amounts.get(acc.number) ?? 0
          if (amount === 0) continue

          const sub = decodeODataString(acc.subCategory || '') || 'General'
          if (!revenueBySubCategory[sub]) revenueBySubCategory[sub] = { amount: 0, accounts: [] }
          revenueBySubCategory[sub].amount += Math.abs(amount)
          revenueBySubCategory[sub].accounts.push(`${acc.number} ${acc.displayName}`)
        }

        // Top revenue accounts
        const revenueAccounts = allAccounts
          .filter((a: any) => {
            const cat = decodeODataString(a.category || '')
            const t = decodeODataString(a.accountType || '').toLowerCase()
            return cat === 'Income' && t === 'posting'
          })
          .map((a: any) => ({
            number: a.number,
            name: a.displayName || a.number,
            subCategory: decodeODataString(a.subCategory || ''),
            amount: Math.abs(gl.amounts.get(a.number) ?? 0),
          }))
          .filter((a) => a.amount > 0)
          .sort((a, b) => b.amount - a.amount)

        // Sales by customer (if salesInvoices available) — enriched with address data
        let salesByCustomer: any[] = []
        if (entityProbe.salesInvoices?.available) {
          try {
            // Fetch customers for address lookup (in parallel with invoices if possible)
            const [invoices, allCustomers] = await Promise.all([
              client.queryAll('salesInvoices', {
                $filter: `invoiceDate ge ${startDate} and invoiceDate le ${endDate}`,
                $select:
                  'number,invoiceDate,customerNumber,customerName,totalAmountIncludingTax,status',
              }),
              entityProbe.customers?.available
                ? client.queryAll('customers').catch(() => [] as any[])
                : Promise.resolve([] as any[]),
            ])

            // Build customer address lookup map
            const customerAddressMap = new Map<
              string,
              { city: string; state: string; country: string; address: string; postalCode: string }
            >()
            for (const cust of allCustomers) {
              const num = cust.number || cust.id
              if (!num) continue
              customerAddressMap.set(num, {
                city: cust.city || '',
                state: cust.state || cust.county || '',
                country: cust.country || cust.countryRegionCode || '',
                address: cust.addressLine1 || cust.address || '',
                postalCode: cust.postalCode || '',
              })
            }

            const customerMap: Record<
              string,
              {
                name: string
                totalAmount: number
                invoiceCount: number
                city: string
                state: string
                country: string
              }
            > = {}
            for (const inv of invoices) {
              const custNum = inv.customerNumber || 'Unknown'
              if (!customerMap[custNum]) {
                const addr = customerAddressMap.get(custNum)
                customerMap[custNum] = {
                  name: inv.customerName || custNum,
                  totalAmount: 0,
                  invoiceCount: 0,
                  city: addr?.city || '',
                  state: addr?.state || '',
                  country: addr?.country || '',
                }
              }
              customerMap[custNum].totalAmount += inv.totalAmountIncludingTax ?? 0
              customerMap[custNum].invoiceCount++
            }

            salesByCustomer = Object.entries(customerMap)
              .map(([number, data]) => ({ customerNumber: number, ...data }))
              .sort((a, b) => b.totalAmount - a.totalAmount)
              .slice(0, 20)
          } catch {
            // ignore — salesInvoices may not support date filter
          }
        }

        revenueAnalysis = {
          bySubCategory: Object.entries(revenueBySubCategory)
            .sort(([, a], [, b]) => b.amount - a.amount)
            .map(([sub, data]) => ({
              subCategory: sub,
              amount: data.amount,
              accountCount: data.accounts.length,
            })),
          topAccounts: revenueAccounts.slice(0, 15),
          salesByCustomer,
          totalRevenue: revenueAccounts.reduce((s, a) => s + a.amount, 0),
        }
      } catch {
        // skip revenue analysis on error
      }
    }

    // ═══ Phase 5: Expense Analysis ═══
    let expenseAnalysis: any = null

    if (startDate && endDate && allAccounts.length > 0) {
      try {
        const gl = await getGLAmountsByAccount(client, startDate, endDate)

        const expenseBySubCategory: Record<string, { amount: number; accounts: string[] }> = {}
        for (const acc of allAccounts) {
          const cat = decodeODataString(acc.category || '')
          if (cat !== 'Expense' && cat !== 'Cost of Goods Sold') continue
          const accType = decodeODataString(acc.accountType || '').toLowerCase()
          if (accType !== 'posting') continue
          const rawAmount = gl.amounts.get(acc.number) ?? 0
          if (rawAmount === 0) continue
          const amount = Math.abs(rawAmount)

          const sub = decodeODataString(acc.subCategory || '') || 'General'
          if (!expenseBySubCategory[sub]) expenseBySubCategory[sub] = { amount: 0, accounts: [] }
          expenseBySubCategory[sub].amount += amount
          expenseBySubCategory[sub].accounts.push(`${acc.number} ${acc.displayName}`)
        }

        // Top expense accounts
        const expenseAccounts = allAccounts
          .filter((a: any) => {
            const cat = decodeODataString(a.category || '')
            const t = decodeODataString(a.accountType || '').toLowerCase()
            return (cat === 'Expense' || cat === 'Cost of Goods Sold') && t === 'posting'
          })
          .map((a: any) => ({
            number: a.number,
            name: a.displayName || a.number,
            category: decodeODataString(a.category || ''),
            subCategory: decodeODataString(a.subCategory || ''),
            amount: Math.abs(gl.amounts.get(a.number) ?? 0),
          }))
          .filter((a) => a.amount > 0)
          .sort((a, b) => b.amount - a.amount)

        // Purchases by vendor (if purchaseInvoices available) — enriched with address data
        let purchasesByVendor: any[] = []
        if (entityProbe.purchaseInvoices?.available) {
          try {
            const [invoices, allVendors] = await Promise.all([
              client.queryAll('purchaseInvoices', {
                $filter: `invoiceDate ge ${startDate} and invoiceDate le ${endDate}`,
                $select:
                  'number,invoiceDate,vendorNumber,vendorName,totalAmountIncludingTax,status',
              }),
              entityProbe.vendors?.available
                ? client.queryAll('vendors').catch(() => [] as any[])
                : Promise.resolve([] as any[]),
            ])

            // Build vendor address lookup map
            const vendorAddressMap = new Map<
              string,
              { city: string; state: string; country: string }
            >()
            for (const vend of allVendors) {
              const num = vend.number || vend.id
              if (!num) continue
              vendorAddressMap.set(num, {
                city: vend.city || '',
                state: vend.state || vend.county || '',
                country: vend.country || vend.countryRegionCode || '',
              })
            }

            const vendorMap: Record<
              string,
              {
                name: string
                totalAmount: number
                invoiceCount: number
                city: string
                state: string
                country: string
              }
            > = {}
            for (const inv of invoices) {
              const vendNum = inv.vendorNumber || 'Unknown'
              if (!vendorMap[vendNum]) {
                const addr = vendorAddressMap.get(vendNum)
                vendorMap[vendNum] = {
                  name: inv.vendorName || vendNum,
                  totalAmount: 0,
                  invoiceCount: 0,
                  city: addr?.city || '',
                  state: addr?.state || '',
                  country: addr?.country || '',
                }
              }
              vendorMap[vendNum].totalAmount += inv.totalAmountIncludingTax ?? 0
              vendorMap[vendNum].invoiceCount++
            }

            purchasesByVendor = Object.entries(vendorMap)
              .map(([number, data]) => ({ vendorNumber: number, ...data }))
              .sort((a, b) => b.totalAmount - a.totalAmount)
              .slice(0, 20)
          } catch {
            // ignore
          }
        }

        expenseAnalysis = {
          bySubCategory: Object.entries(expenseBySubCategory)
            .sort(([, a], [, b]) => b.amount - a.amount)
            .map(([sub, data]) => ({
              subCategory: sub,
              amount: data.amount,
              accountCount: data.accounts.length,
            })),
          topAccounts: expenseAccounts.slice(0, 15),
          purchasesByVendor,
          totalExpenses: expenseAccounts.reduce((s, a) => s + a.amount, 0),
        }
      } catch {
        // skip expense analysis on error
      }
    }

    // ═══ Phase 6: Customer & Vendor Analysis ═══
    let customerVendorAnalysis: any = null

    {
      const cvData: any = {}

      // Deep customer analysis — discover all address/geographic fields
      if (entityProbe.customers?.available) {
        try {
          const allCustomers = await client.queryAll('customers')
          const customerFields = allCustomers.length > 0 ? Object.keys(allCustomers[0]) : []

          // Identify address-related fields dynamically
          const addressFieldPatterns = [
            'city',
            'state',
            'county',
            'country',
            'address',
            'postal',
            'zip',
            'phone',
            'email',
            'contact',
            'region',
          ]
          const addressFields = customerFields.filter((f) =>
            addressFieldPatterns.some((p) => f.toLowerCase().includes(p))
          )

          // Geographic breakdown — group by city
          const byCity: Record<string, { count: number; customers: string[] }> = {}
          const byState: Record<string, { count: number }> = {}
          const byCountry: Record<string, { count: number }> = {}

          for (const cust of allCustomers) {
            const city = cust.city || '(no city)'
            const state = cust.state || cust.county || '(no state)'
            const country = cust.country || cust.countryRegionCode || '(no country)'

            if (!byCity[city]) byCity[city] = { count: 0, customers: [] }
            byCity[city].count++
            if (byCity[city].customers.length < 5) {
              byCity[city].customers.push(cust.displayName || cust.number || cust.id)
            }

            byState[state] = { count: (byState[state]?.count || 0) + 1 }
            byCountry[country] = { count: (byCountry[country]?.count || 0) + 1 }
          }

          cvData.customers = {
            totalCount: allCustomers.length,
            allFields: customerFields,
            addressFields,
            sampleCustomer: allCustomers[0] || null,
            byCity: Object.entries(byCity)
              .sort(([, a], [, b]) => b.count - a.count)
              .slice(0, 20)
              .map(([city, data]) => ({ city, ...data })),
            byState: Object.entries(byState)
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([state, data]) => ({ state, ...data })),
            byCountry: Object.entries(byCountry)
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([country, data]) => ({ country, ...data })),
          }
        } catch (err: any) {
          cvData.customers = { error: err.message?.slice(0, 200) || String(err) }
        }
      }

      // Deep vendor analysis — discover all address/geographic fields
      if (entityProbe.vendors?.available) {
        try {
          const allVendors = await client.queryAll('vendors')
          const vendorFields = allVendors.length > 0 ? Object.keys(allVendors[0]) : []

          const addressFieldPatterns = [
            'city',
            'state',
            'county',
            'country',
            'address',
            'postal',
            'zip',
            'phone',
            'email',
            'contact',
            'region',
          ]
          const addressFields = vendorFields.filter((f) =>
            addressFieldPatterns.some((p) => f.toLowerCase().includes(p))
          )

          const byCity: Record<string, { count: number; vendors: string[] }> = {}
          const byCountry: Record<string, { count: number }> = {}

          for (const vend of allVendors) {
            const city = vend.city || '(no city)'
            const country = vend.country || vend.countryRegionCode || '(no country)'

            if (!byCity[city]) byCity[city] = { count: 0, vendors: [] }
            byCity[city].count++
            if (byCity[city].vendors.length < 5) {
              byCity[city].vendors.push(vend.displayName || vend.number || vend.id)
            }

            byCountry[country] = { count: (byCountry[country]?.count || 0) + 1 }
          }

          cvData.vendors = {
            totalCount: allVendors.length,
            allFields: vendorFields,
            addressFields,
            sampleVendor: allVendors[0] || null,
            byCity: Object.entries(byCity)
              .sort(([, a], [, b]) => b.count - a.count)
              .slice(0, 20)
              .map(([city, data]) => ({ city, ...data })),
            byCountry: Object.entries(byCountry)
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([country, data]) => ({ country, ...data })),
          }
        } catch (err: any) {
          cvData.vendors = { error: err.message?.slice(0, 200) || String(err) }
        }
      }

      // Sales invoice lines analysis — product-level detail
      if (entityProbe.salesInvoiceLines?.available && startDate && endDate) {
        try {
          const lines = await client.queryAll('salesInvoiceLines', { $top: 100 })
          const lineFields = lines.length > 0 ? Object.keys(lines[0]) : []

          cvData.salesInvoiceLines = {
            sampleCount: lines.length,
            fields: lineFields,
            sampleRecord: lines[0] || null,
          }
        } catch {
          cvData.salesInvoiceLines = { error: 'Failed to fetch sales invoice lines' }
        }
      }

      if (Object.keys(cvData).length > 0) {
        customerVendorAnalysis = cvData
      }
    }

    // ═══ Phase 8: Dimensional Analysis (Sales-to-Location linking) ═══
    let dimensionalAnalysis: any = null

    {
      const dimensionData: any = {}

      // Fetch dimensions
      if (entityProbe.dimensions?.available) {
        try {
          const dims = await client.listDimensions()
          dimensionData.dimensions = dims.map((d: any) => ({
            id: d.id,
            code: d.code,
            displayName: d.displayName,
          }))
        } catch {
          dimensionData.dimensions = []
        }
      }

      // Fetch dimension values
      if (entityProbe.dimensionValues?.available) {
        try {
          const vals = await client.queryAll('dimensionValues', { $top: 100 })
          const byDimension: Record<string, any[]> = {}
          for (const v of vals) {
            const dimCode = v.dimensionCode || v.code || 'Unknown'
            if (!byDimension[dimCode]) byDimension[dimCode] = []
            byDimension[dimCode].push({
              code: v.code,
              displayName: v.displayName,
              dimensionValueType: v.dimensionValueType,
            })
          }
          dimensionData.dimensionValues = byDimension
        } catch {
          dimensionData.dimensionValues = {}
        }
      }

      // Probe dimensionSetEntries — can we link GL entries to dimensions?
      if (entityProbe.dimensionSetEntries?.available) {
        try {
          const entries = await client.queryAll('dimensionSetEntries', { $top: 20 })
          dimensionData.dimensionSetEntriesSample = entries.slice(0, 5)
          dimensionData.dimensionSetEntriesFields =
            entries.length > 0 ? Object.keys(entries[0]) : []
          dimensionData.dimensionSetEntriesAvailable = true
        } catch {
          dimensionData.dimensionSetEntriesAvailable = false
        }
      }

      // Try to link GL entries to dimension set entries for revenue accounts
      if (
        dimensionData.dimensionSetEntriesAvailable &&
        startDate &&
        endDate &&
        allAccounts.length > 0
      ) {
        try {
          // Get revenue GL entries with dimensionSetEntryNumber
          const revenueAccountNums = new Set(
            allAccounts
              .filter((a: any) => {
                const cat = decodeODataString(a.category || '')
                const t = decodeODataString(a.accountType || '').toLowerCase()
                return cat === 'Income' && t === 'posting'
              })
              .map((a: any) => a.number)
          )

          const glEntries = await client.listGeneralLedgerEntries({
            $filter: `postingDate ge ${startDate} and postingDate le ${endDate}`,
            $select:
              'accountNumber,debitAmount,creditAmount,dimensionSetID,postingDate,description',
            $top: 500,
          })

          const revenueGLEntries = glEntries.filter((e: any) =>
            revenueAccountNums.has(e.accountNumber)
          )

          // Check if dimensionSetID is populated
          const withDimSet = revenueGLEntries.filter(
            (e: any) => e.dimensionSetID && e.dimensionSetID !== 0
          )

          // Group by dimensionSetID to see distribution
          const dimSetCounts: Record<string, number> = {}
          for (const e of withDimSet) {
            const key = String(e.dimensionSetID)
            dimSetCounts[key] = (dimSetCounts[key] || 0) + 1
          }

          dimensionData.revenueGLLinking = {
            totalRevenueGLEntries: revenueGLEntries.length,
            withDimensionSetID: withDimSet.length,
            uniqueDimensionSets: Object.keys(dimSetCounts).length,
            linkageRate:
              revenueGLEntries.length > 0
                ? `${Math.round((withDimSet.length / revenueGLEntries.length) * 100)}%`
                : 'N/A',
            sampleEntries: withDimSet.slice(0, 5).map((e: any) => ({
              accountNumber: e.accountNumber,
              amount: (e.creditAmount ?? 0) - (e.debitAmount ?? 0),
              dimensionSetID: e.dimensionSetID,
              description: e.description,
              postingDate: e.postingDate,
            })),
          }
        } catch {
          dimensionData.revenueGLLinking = { error: 'Failed to analyze GL-dimension linking' }
        }
      }

      // Location probe
      if (entityProbe.locations?.available) {
        try {
          const locations = await client.queryAll('locations')
          dimensionData.locations = locations.map((l: any) => ({
            code: l.code,
            displayName: l.displayName,
            contact: l.contact,
            address: l.addressLine1 || l.address,
            city: l.city,
          }))
        } catch {
          dimensionData.locations = []
        }
      }

      if (Object.keys(dimensionData).length > 0) {
        dimensionalAnalysis = dimensionData
      }
    }

    // ═══ Phase 9: Monthly P&L Trend ═══
    let monthlyTrend: any = null

    if (startDate && endDate && allAccounts.length > 0) {
      try {
        const glEntries = await client.listGeneralLedgerEntries({
          $filter: `postingDate ge ${startDate} and postingDate le ${endDate}`,
          $select: 'accountNumber,debitAmount,creditAmount,postingDate',
        })

        // Build account category map (posting accounts only)
        const accountCatMap = new Map<string, string>()
        for (const acc of allAccounts) {
          const cat = decodeODataString(acc.category || '')
          const t = decodeODataString(acc.accountType || '').toLowerCase()
          if (t === 'posting' && ['Income', 'Expense', 'Cost of Goods Sold'].includes(cat)) {
            accountCatMap.set(acc.number, cat)
          }
        }

        const monthlyMap: Record<string, { revenue: number; cogs: number; expenses: number }> = {}

        for (const entry of glEntries) {
          const cat = accountCatMap.get(entry.accountNumber)
          if (!cat) continue
          const month = (entry.postingDate || '').substring(0, 7)
          if (!month) continue

          if (!monthlyMap[month]) monthlyMap[month] = { revenue: 0, cogs: 0, expenses: 0 }
          const debit = entry.debitAmount ?? 0
          const credit = entry.creditAmount ?? 0

          if (cat === 'Income') {
            monthlyMap[month].revenue += credit - debit
          } else if (cat === 'Cost of Goods Sold') {
            monthlyMap[month].cogs += debit - credit
          } else if (cat === 'Expense') {
            monthlyMap[month].expenses += debit - credit
          }
        }

        monthlyTrend = Object.entries(monthlyMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, data]) => ({
            month,
            revenue: data.revenue,
            cogs: data.cogs,
            grossProfit: data.revenue - data.cogs,
            expenses: data.expenses,
            netIncome: data.revenue - data.cogs - data.expenses,
          }))
      } catch {
        // skip monthly trend on error
      }
    }

    return NextResponse.json({
      connectionId: resolvedConnectionId,
      companyName: credentials.company_name || null,
      startDate,
      endDate,
      entityProbe,
      accountAnalysis,
      statementTests,
      revenueAnalysis,
      expenseAnalysis,
      customerVendorAnalysis,
      dimensionalAnalysis,
      monthlyTrend,
      durationMs: Date.now() - t0All,
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
