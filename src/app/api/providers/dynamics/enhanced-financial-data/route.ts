import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'

/**
 * GET /api/providers/dynamics/enhanced-financial-data
 *
 * Aggregates supplementary dashboard data: top customers/vendors, aged AR/AP,
 * financial ratios, bank accounts, efficiency metrics, cash runway, inventory,
 * monthly revenue, and sales by salesperson.
 *
 * Uses Promise.allSettled so partial failures don't block the whole response.
 */

function decodeODataString(s: string): string {
  return s.replace(/_x([0-9a-f]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * Build account-to-section map using chart-structure walk (Begin-Total/End-Total ranges).
 * Returns a Map of accountNumber → { section, subCategory, accountType }
 */
function buildAccountSectionMap(allAccounts: any[]): Map<
  string,
  {
    section: string
    subCategory: string
    accountType: string
  }
> {
  const BS_CATEGORIES = ['Assets', 'Liabilities', 'Equity']
  const PNL_CATEGORIES = ['Income', 'Revenue', 'Cost of Goods Sold', 'Expense']
  const ALL_CATEGORIES = [...BS_CATEGORIES, ...PNL_CATEGORIES]

  const sorted = [...allAccounts].sort((a: any, b: any) =>
    (a.number || '').localeCompare(b.number || '')
  )

  // Phase 1: Find section boundaries from Begin-Total accounts
  const sectionBoundaries: Array<{ category: string; startNumber: string }> = []

  for (const acc of sorted) {
    const accType = decodeODataString(acc.accountType || '').toLowerCase()
    if (accType !== 'begin-total') continue

    const rawCat = decodeODataString(acc.category || '').trim()
    const displayName = (acc.displayName || acc.number || '').trim()

    if (ALL_CATEGORIES.includes(rawCat)) {
      sectionBoundaries.push({ category: rawCat, startNumber: acc.number })
    } else if (!rawCat || rawCat === ' ') {
      const lowerName = displayName.toLowerCase()
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

  function getSection(accNumber: string): string | null {
    for (let i = sectionRanges.length - 1; i >= 0; i--) {
      const range = sectionRanges[i]
      if (accNumber >= range.startNumber) {
        if (range.endBefore && accNumber >= range.endBefore) continue
        return range.category
      }
    }
    return null
  }

  // Phase 2: Map each posting account to its section
  const result = new Map<string, { section: string; subCategory: string; accountType: string }>()
  for (const acc of sorted) {
    const accType = decodeODataString(acc.accountType || '').toLowerCase()
    const section = getSection(acc.number)
    if (section) {
      result.set(acc.number, {
        section,
        subCategory: acc.subCategory || '',
        accountType: accType,
      })
    }
  }

  return result
}

/**
 * Fetch GL entries and aggregate debit-credit by account.
 */
async function getGLBalances(
  client: BusinessCentralClient,
  opts: { endDate?: string } = {}
): Promise<Map<string, number>> {
  const filters: string[] = []
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
  return amounts
}

/** Bucket invoices by due date into aging buckets */
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

    // Build date filter for paid invoices within period
    const periodFilters: string[] = []
    if (startDate) periodFilters.push(`postingDate ge ${startDate}`)
    if (endDate) periodFilters.push(`postingDate le ${endDate}`)
    const periodFilter = periodFilters.join(' and ')

    // Fire all API calls in parallel using Promise.allSettled
    // Compute a date 30 days in the past for the shifted aged report call
    const refDate = endDate ? new Date(endDate) : new Date()
    const shiftedDate = new Date(refDate.getTime() - 30 * 24 * 60 * 60 * 1000)
    const shiftedDateStr = shiftedDate.toISOString().split('T')[0]

    const [
      accountsResult,
      glResult,
      glPeriodResult,
      agedARResult,
      agedAPResult,
      agedARShiftedResult,
      agedAPShiftedResult,
      paidSalesResult,
      paidPurchaseResult,
      customersResult,
      vendorsResult,
      itemsResult,
      bankAccountsResult,
      companyInfoResult,
    ] = await Promise.allSettled([
      // 1. Accounts (for chart-structure walk)
      client.queryAll('accounts'),
      // 2. GL entries (cumulative, for BS balances)
      getGLBalances(client, { endDate }),
      // 2b. GL entries (period-only, for P&L totals used in efficiency/burn metrics)
      startDate && endDate
        ? client
            .listGeneralLedgerEntries({
              $filter: `postingDate ge ${startDate} and postingDate le ${endDate}`,
              $select: 'accountNumber,debitAmount,creditAmount,postingDate',
            })
            .then((entries: any[]) => {
              const amounts = new Map<string, number>()
              const months = new Set<string>()
              for (const e of entries) {
                if (!e.accountNumber) continue
                amounts.set(
                  e.accountNumber,
                  (amounts.get(e.accountNumber) ?? 0) + (e.debitAmount ?? 0) - (e.creditAmount ?? 0)
                )
                if (e.postingDate) months.add(e.postingDate.substring(0, 7))
              }
              ;(amounts as any)._months = months.size
              return amounts
            })
        : Promise.resolve(null),
      // 3. BC's built-in Aged Accounts Receivable report (authoritative source)
      client.getAgedAccountsReceivable(),
      // 4. BC's built-in Aged Accounts Payable report (authoritative source)
      client.getAgedAccountsPayable(),
      // 5. Shifted AR aged report (agedAsOfDate = today - 30d) — gives us the 61-90 / 90+ split
      client.getAgedAccountsReceivable({ $filter: `agedAsOfDate eq ${shiftedDateStr}` }),
      // 6. Shifted AP aged report (same approach)
      client.getAgedAccountsPayable({ $filter: `agedAsOfDate eq ${shiftedDateStr}` }),
      // 7. Paid sales invoices in period (for top customers, monthly revenue, salesperson)
      client.listSalesInvoices(
        periodFilter
          ? { $filter: `status eq 'Paid' and ${periodFilter}` }
          : { $filter: "status eq 'Paid'" }
      ),
      // 6. Paid purchase invoices in period (for top vendors)
      client.listPurchaseInvoices(
        periodFilter
          ? { $filter: `status eq 'Paid' and ${periodFilter}` }
          : { $filter: "status eq 'Paid'" }
      ),
      // 7. Customers
      client.listCustomers({ $select: 'id,displayName,number,balanceDue' }),
      // 8. Vendors
      client.listVendors({ $select: 'id,displayName,number,balance' }),
      // 9. Items
      client.listItems(),
      // 10. Bank accounts
      client.listBankAccounts(),
      // 11. Company information
      client
        .query('companyInformation', { $top: 1 })
        .then((r: any) => r.value?.[0])
        .catch(() => null),
    ])

    // Extract successful results with fallbacks
    const allAccounts = accountsResult.status === 'fulfilled' ? accountsResult.value : []
    const glAmounts = glResult.status === 'fulfilled' ? glResult.value : new Map<string, number>()
    const glPeriodAmounts: Map<string, number> | null =
      glPeriodResult.status === 'fulfilled' ? glPeriodResult.value : null
    const agedARData =
      agedARResult.status === 'fulfilled' ? agedARResult.value : { total: null, records: [] }
    const agedAPData =
      agedAPResult.status === 'fulfilled' ? agedAPResult.value : { total: null, records: [] }
    const agedARShifted =
      agedARShiftedResult.status === 'fulfilled'
        ? agedARShiftedResult.value
        : { total: null, records: [] }
    const agedAPShifted =
      agedAPShiftedResult.status === 'fulfilled'
        ? agedAPShiftedResult.value
        : { total: null, records: [] }
    const paidSalesInvoices = paidSalesResult.status === 'fulfilled' ? paidSalesResult.value : []
    const paidPurchaseInvoices =
      paidPurchaseResult.status === 'fulfilled' ? paidPurchaseResult.value : []
    const customers = customersResult.status === 'fulfilled' ? customersResult.value : []
    const vendors = vendorsResult.status === 'fulfilled' ? vendorsResult.value : []
    const items = itemsResult.status === 'fulfilled' ? itemsResult.value : []
    const bankAccountsList =
      bankAccountsResult.status === 'fulfilled' ? bankAccountsResult.value : []
    const companyInfo = companyInfoResult.status === 'fulfilled' ? companyInfoResult.value : null

    const currency = companyInfo?.currencyCode || 'USD'
    const companyName = credentials.company_name || null

    // ── Build account section map ──
    const sectionMap = buildAccountSectionMap(allAccounts)

    // ── Compute GL balances per section/subCategory ──
    let currentAssetsGL = 0
    let currentLiabilitiesGL = 0
    let totalAssetsGL = 0
    let totalLiabilitiesGL = 0
    let totalEquityGL = 0
    let totalCash = 0

    // Cash-related subCategories
    const cashSubCategories = ['Cash', 'Bank', 'Checking', 'Savings']
    // Current asset subCategories
    const currentAssetSubCategories = [
      'Cash',
      'Bank',
      'Checking',
      'Savings',
      'Receivable',
      'Receivables',
      'Inventory',
      'Prepaid',
      'Prepaid Expenses',
      'Current',
    ]
    // Current liability subCategories
    const currentLiabilitySubCategories = [
      'Payable',
      'Payables',
      'Current',
      'Accrued',
      'Current Liabilities',
    ]
    // Inventory subCategories
    const inventorySubCategories = ['Inventory']

    let inventoryGL = 0

    // Collect individual cash/bank GL accounts for the Cash Position section
    const cashGLAccounts: Array<{
      no: string
      name: string
      balance_lcy: number
      currency_code: string
    }> = []

    // Build a lookup from account number → display name
    const accountNameMap = new Map<string, string>()
    for (const acc of allAccounts) {
      if (acc.number) {
        accountNameMap.set(acc.number, acc.displayName || acc.name || acc.number)
      }
    }

    // Build set of account numbers within Bank & Cash Balances begin-total/end-total ranges
    // This captures all accounts (including clearing accounts with empty subCategory)
    const bankCashAccountNumbers = new Set<string>()
    const sortedAccounts = [...allAccounts].sort((a: any, b: any) =>
      (a.number || '').localeCompare(b.number || '')
    )
    let inBankCashSection = false
    let bankCashDepth = 0
    for (const acc of sortedAccounts) {
      const accType = decodeODataString(acc.accountType || '').toLowerCase()
      const name = (acc.displayName || acc.name || '').toLowerCase()
      const sub = (acc.subCategory || '').toLowerCase()

      if (
        accType === 'begin-total' &&
        (name.includes('bank') || name.includes('cash') || sub === 'cash' || sub === 'bank')
      ) {
        if (!inBankCashSection) {
          inBankCashSection = true
          bankCashDepth = 1
        } else {
          bankCashDepth++
        }
        continue
      }
      if (inBankCashSection && accType === 'end-total') {
        bankCashDepth--
        if (bankCashDepth <= 0) {
          inBankCashSection = false
        }
        continue
      }
      if (inBankCashSection && accType === 'posting' && acc.number) {
        bankCashAccountNumbers.add(acc.number)
      }
    }

    for (const [accNum, info] of sectionMap) {
      if (info.accountType !== 'posting') continue
      const bal = glAmounts.get(accNum) ?? 0
      const sub = info.subCategory.toLowerCase()

      if (info.section === 'Assets') {
        totalAssetsGL += bal
        if (currentAssetSubCategories.some((s) => sub.includes(s.toLowerCase()))) {
          currentAssetsGL += bal
        }
        const isCashBySubCategory = cashSubCategories.some((s) => sub.includes(s.toLowerCase()))
        const isCashBySection = bankCashAccountNumbers.has(accNum)
        if (isCashBySubCategory || isCashBySection) {
          totalCash += bal
          // Track individual cash/bank accounts with their GL balances
          if (bal !== 0) {
            cashGLAccounts.push({
              no: accNum,
              name: accountNameMap.get(accNum) || accNum,
              balance_lcy: bal,
              currency_code: currency,
            })
          }
        }
        if (inventorySubCategories.some((s) => sub.includes(s.toLowerCase()))) {
          inventoryGL += bal
        }
      } else if (info.section === 'Liabilities') {
        totalLiabilitiesGL += bal
        if (currentLiabilitySubCategories.some((s) => sub.includes(s.toLowerCase()))) {
          currentLiabilitiesGL += bal
        }
      } else if (info.section === 'Equity') {
        totalEquityGL += bal
      }
    }

    // Sort cash GL accounts by absolute balance descending
    cashGLAccounts.sort((a, b) => Math.abs(b.balance_lcy) - Math.abs(a.balance_lcy))

    // Negate credit-normal accounts for display
    const totalLiabilities = -totalLiabilitiesGL
    const totalEquity = -totalEquityGL
    const currentAssets = currentAssetsGL
    const currentLiabilities = -currentLiabilitiesGL
    const inventoryBalance = inventoryGL

    // ── P&L totals from period-filtered GL (for efficiency metrics & burn rate) ──
    let pnlRevenue = 0
    let pnlCOGS = 0
    let pnlExpenses = 0
    if (glPeriodAmounts && sectionMap.size > 0) {
      for (const [accNum, bal] of glPeriodAmounts) {
        const info = sectionMap.get(accNum)
        if (!info) continue
        if (info.section === 'Income' || info.section === 'Revenue') {
          pnlRevenue += -bal // negate credit-normal to get positive revenue
        } else if (info.section === 'Cost of Goods Sold') {
          pnlCOGS += bal // debit-normal, positive
        } else if (info.section === 'Expense') {
          pnlExpenses += bal // debit-normal, positive
        }
      }
    }

    // ── Aged AR (from BC's agedAccountsReceivables report) ──
    // BC returns a "Total" row with LCY-converted aggregates — use it as the source of truth.
    //
    // Default call (agedAsOfDate = today, periodLengthFilter = 30D):
    //   current = Not Due, period1 = 1-30d, period2 = 31-60d, period3 = 61+ (catch-all)
    //
    // Shifted call (agedAsOfDate = today - 30 days):
    //   The date window shifts back by 30 days, so:
    //   shifted.period2 = 61-90 days overdue (from today's perspective)
    //   shifted.period3 = 90+ days overdue (from today's perspective)
    //
    // This gives us all 5 aging buckets matching the BC PDF report.
    const arTotal = agedARData.total
    const arShiftedTotal = agedARShifted.total
    const customersWithARBalance = customers.filter((c: any) => (c.balanceDue || 0) > 0).length
    const arCurrent = arTotal?.currentAmount ?? 0
    const arP1 = arTotal?.period1Amount ?? 0
    const arP2 = arTotal?.period2Amount ?? 0
    const arBal = arTotal?.balanceDue ?? 0
    // Use shifted call for 61-90 / 90+ split; fall back to combined 61+ if shifted call failed
    const ar61_90 = arShiftedTotal ? (arShiftedTotal.period2Amount ?? 0) : 0
    const ar90Plus = arShiftedTotal
      ? (arShiftedTotal.period3Amount ?? 0)
      : Math.max(0, arBal - arCurrent - arP1 - arP2)
    const agedReceivables = arTotal
      ? {
          current: arCurrent,
          days_1_30: arP1,
          days_31_60: arP2,
          days_61_90: arShiftedTotal ? ar61_90 : 0,
          days_over_90: ar90Plus,
          total: arBal,
          customer_count: customersWithARBalance,
        }
      : null

    // ── Aged AP (from BC's agedAccountsPayables report) ──
    // Same dual-call pattern. BC returns AP amounts as negative — use Math.abs.
    const apTotal = agedAPData.total
    const apShiftedTotal = agedAPShifted.total
    const vendorsWithAPBalance = vendors.filter((v: any) => Math.abs(v.balance || 0) > 0).length
    const apBalanceDue = Math.abs(apTotal?.balanceDue ?? 0)
    const apCurrent = Math.abs(apTotal?.currentAmount ?? 0)
    const apP1 = Math.abs(apTotal?.period1Amount ?? 0)
    const apP2 = Math.abs(apTotal?.period2Amount ?? 0)
    const ap61_90 = apShiftedTotal ? Math.abs(apShiftedTotal.period2Amount ?? 0) : 0
    const ap90Plus = apShiftedTotal
      ? Math.abs(apShiftedTotal.period3Amount ?? 0)
      : Math.max(0, apBalanceDue - apCurrent - apP1 - apP2)
    const agedPayables = apTotal
      ? {
          current: apCurrent,
          days_1_30: apP1,
          days_31_60: apP2,
          days_61_90: apShiftedTotal ? ap61_90 : 0,
          days_over_90: ap90Plus,
          total: apBalanceDue,
          vendor_count: vendorsWithAPBalance,
        }
      : null

    // ── Top Customers (from paid sales invoices) ──
    const customerRevMap = new Map<string, { name: string; total: number; count: number }>()
    for (const inv of paidSalesInvoices) {
      const name = inv.customerName || inv.customerNumber || 'Unknown'
      const existing = customerRevMap.get(name) || { name, total: 0, count: 0 }
      existing.total += inv.totalAmountIncludingTax ?? inv.totalAmount ?? 0
      existing.count++
      customerRevMap.set(name, existing)
    }
    const topCustomers = [...customerRevMap.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((c) => ({ name: c.name, total_revenue: c.total, invoice_count: c.count }))

    // ── Top Vendors (from paid purchase invoices) ──
    const vendorSpendMap = new Map<string, { name: string; total: number; count: number }>()
    for (const inv of paidPurchaseInvoices) {
      const name = inv.vendorName || inv.vendorNumber || 'Unknown'
      const existing = vendorSpendMap.get(name) || { name, total: 0, count: 0 }
      existing.total += inv.totalAmountIncludingTax ?? inv.totalAmount ?? 0
      existing.count++
      vendorSpendMap.set(name, existing)
    }
    const topVendors = [...vendorSpendMap.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((v) => ({
        vendor_no: '',
        vendor_name: v.name,
        total_spend: v.total,
        invoice_count: v.count,
      }))

    // ── ARAP Summary ──
    const totalAR = agedReceivables?.total ?? 0
    const arOverdue = agedReceivables
      ? agedReceivables.days_1_30 +
        agedReceivables.days_31_60 +
        agedReceivables.days_61_90 +
        agedReceivables.days_over_90
      : 0
    const totalAP = agedPayables?.total ?? 0
    const arapSummary = {
      customer_count: customers.length,
      customers_with_balance: customersWithARBalance,
      total_ar: totalAR,
      ar_overdue: arOverdue,
      vendor_count: vendors.length,
      vendors_with_balance: vendorsWithAPBalance,
      total_ap: totalAP,
    }

    // ── Bank Accounts ──
    // Prefer GL-derived cash/bank accounts (which have real balances) over the
    // bankAccounts API entity (which often returns 0 for balance).
    // Fall back to the API entity only if it has non-zero balances.
    const apiBankAccounts = bankAccountsList
      .map((ba: any) => ({
        no: ba.number || ba.id || '',
        name: ba.displayName || ba.name || '',
        balance_lcy: ba.balance ?? ba.balanceLCY ?? 0,
        currency_code: ba.currencyCode || currency,
      }))
      .sort((a: any, b: any) => Math.abs(b.balance_lcy) - Math.abs(a.balance_lcy))

    const apiHasBalances = apiBankAccounts.some((ba: any) => ba.balance_lcy !== 0)

    const bankAccounts = apiHasBalances ? apiBankAccounts : cashGLAccounts

    // ── Financial Ratios ──
    const workingCapital = currentAssets - currentLiabilities
    const financialRatios: Record<string, number | null> = {
      currentRatio: currentLiabilities !== 0 ? currentAssets / currentLiabilities : null,
      quickRatio:
        currentLiabilities !== 0 ? (currentAssets - inventoryBalance) / currentLiabilities : null,
      debtToEquity: totalEquity !== 0 ? totalLiabilities / totalEquity : null,
      workingCapital,
      // Margins computed client-side from P&L totals
      grossMargin: null,
      netMargin: null,
      operatingMargin: null,
      // Component values for tooltip formula breakdowns
      currentAssets,
      currentLiabilities,
      inventory: inventoryBalance,
      totalLiabilities,
      totalEquity,
    }

    // ── Monthly Revenue (from paid sales invoices) ──
    const monthRevMap = new Map<string, { count: number; total: number }>()
    for (const inv of paidSalesInvoices) {
      const postingDate = inv.postingDate || inv.invoiceDate
      if (!postingDate) continue
      const month = postingDate.substring(0, 7) // YYYY-MM
      const existing = monthRevMap.get(month) || { count: 0, total: 0 }
      existing.total += inv.totalAmountIncludingTax ?? inv.totalAmount ?? 0
      existing.count++
      monthRevMap.set(month, existing)
    }
    const monthlyRevenue = [...monthRevMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, invoice_count: data.count, total_revenue: data.total }))

    // ── Sales by Salesperson ──
    const salespersonMap = new Map<string, { count: number; total: number }>()
    for (const inv of paidSalesInvoices) {
      const sp = inv.salespersonCode || '(Unassigned)'
      const existing = salespersonMap.get(sp) || { count: 0, total: 0 }
      existing.total += inv.totalAmountIncludingTax ?? inv.totalAmount ?? 0
      existing.count++
      salespersonMap.set(sp, existing)
    }
    const salesBySalesperson = [...salespersonMap.entries()]
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([code, data]) => ({
        salesperson_code: code,
        invoice_count: data.count,
        total_sales: data.total,
      }))

    // ── Efficiency Metrics ──
    // Use P&L GL data (accrual basis) when available, fall back to paid invoices
    let annualizedRevenue = 0
    let annualizedCOGS = 0
    let totalPLExpenses = 0 // COGS + Operating Expenses (for burn rate)
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const periodDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

      if (pnlRevenue > 0 || pnlCOGS > 0 || pnlExpenses > 0) {
        // P&L GL data available — use accrual-basis figures (industry standard)
        annualizedRevenue = (pnlRevenue / periodDays) * 365
        annualizedCOGS = (pnlCOGS / periodDays) * 365
        totalPLExpenses = pnlCOGS + pnlExpenses
      } else {
        // Fallback: annualize from paid invoices (cash basis proxy)
        const totalPaidRevenue = paidSalesInvoices.reduce(
          (sum: number, inv: any) => sum + (inv.totalAmountIncludingTax ?? inv.totalAmount ?? 0),
          0
        )
        const totalPaidSpend = paidPurchaseInvoices.reduce(
          (sum: number, inv: any) => sum + (inv.totalAmountIncludingTax ?? inv.totalAmount ?? 0),
          0
        )
        annualizedRevenue = (totalPaidRevenue / periodDays) * 365
        annualizedCOGS = (totalPaidSpend / periodDays) * 365
        totalPLExpenses = totalPaidSpend
      }
    }

    const dso = annualizedRevenue > 0 ? (totalAR / annualizedRevenue) * 365 : null
    const dpo = annualizedCOGS > 0 ? (totalAP / annualizedCOGS) * 365 : null
    // CCC = DSO + DIO - DPO (industry standard, includes inventory holding period)
    const dio =
      inventoryBalance > 0 && annualizedCOGS > 0 ? (inventoryBalance / annualizedCOGS) * 365 : null
    const ccc = dso !== null && dpo !== null ? dso + (dio ?? 0) - dpo : null

    const efficiencyMetrics =
      dso !== null || dpo !== null
        ? {
            dso,
            dpo,
            inventoryTurnover:
              inventoryBalance > 0 && annualizedCOGS > 0 ? annualizedCOGS / inventoryBalance : null,
            cashConversionCycle: ccc,
            arTurnover: totalAR > 0 && annualizedRevenue > 0 ? annualizedRevenue / totalAR : null,
            apTurnover: totalAP > 0 && annualizedCOGS > 0 ? annualizedCOGS / totalAP : null,
            // Underlying values for formula breakdown tooltips
            _components: {
              totalAR,
              totalAP,
              annualizedRevenue,
              annualizedCOGS,
              inventoryBalance,
            },
          }
        : null

    // ── Cash Runway ──
    // Uses indirect cash flow method (matching platform cash flow page):
    // OCF = Net Income + Depreciation + WC Changes → FCF = OCF - CapEx
    // Burn Rate = |Monthly FCF| when FCF < 0
    let cashRunwayData = null
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      // Use actual months with GL data (matches platform's trend.months.length)
      const glMonthCount = (glPeriodAmounts as any)?._months || 0
      const periodMonths = Math.max(
        1,
        glMonthCount ||
          Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      )

      // Compute WC changes and CapEx from period GL
      let arChange = 0
      let apChange = 0
      let invChange = 0
      let otherWcChange = 0
      let depreciation = 0
      let fixedAssetChange = 0
      if (glPeriodAmounts && sectionMap.size > 0) {
        for (const [accNum, bal] of glPeriodAmounts) {
          const info = sectionMap.get(accNum)
          if (!info) continue
          const sub = info.subCategory.toLowerCase()
          const accName = (
            allAccounts.find((a: any) => a.number === accNum)?.displayName || ''
          ).toLowerCase()

          if (
            info.section === 'Expense' &&
            /depreciation|amortization|amortisation/i.test(accName)
          ) {
            depreciation += bal
          } else if (info.section === 'Assets') {
            if (
              sub.includes('cash') ||
              sub.includes('bank') ||
              sub.includes('checking') ||
              sub.includes('savings')
            ) {
              // skip cash accounts
            } else if (sub.includes('receivable')) {
              arChange += -bal
            } else if (sub.includes('inventory')) {
              invChange += -bal
            } else if (
              sub.includes('prepaid') ||
              (sub.includes('current') &&
                !sub.includes('non-current') &&
                !sub.includes('noncurrent') &&
                !sub.includes('non current'))
            ) {
              otherWcChange += -bal
            } else {
              fixedAssetChange += bal
            }
          } else if (info.section === 'Liabilities') {
            if (sub.includes('payable')) {
              apChange += -bal
            } else if (
              sub.includes('accrued') ||
              (sub.includes('current') &&
                !sub.includes('non-current') &&
                !sub.includes('noncurrent') &&
                !sub.includes('non current')) ||
              sub.includes('deferred')
            ) {
              otherWcChange += -bal
            }
          }
        }
      }

      const netIncome = pnlRevenue - pnlCOGS - pnlExpenses
      const ocf = netIncome + depreciation + arChange + apChange + invChange + otherWcChange
      const capex = Math.max(fixedAssetChange, 0)
      const fcf = ocf - capex
      const monthlyFCF = fcf / periodMonths

      const monthlyRevAmt = pnlRevenue > 0 ? pnlRevenue / periodMonths : 0
      const monthlyExpenses = (pnlCOGS + pnlExpenses) / periodMonths
      const grossBurnRate = monthlyFCF < 0 ? Math.abs(monthlyFCF) : 0
      const netBurnRate = grossBurnRate // burn rate IS the net cash consumption
      const avgMonthlyNetIncome = monthlyRevAmt - monthlyExpenses

      cashRunwayData = {
        totalCash,
        monthlyExpenses,
        monthlyRevenue: monthlyRevAmt,
        grossBurnRate,
        netBurnRate,
        cashRunwayMonths: grossBurnRate > 0 ? totalCash / grossBurnRate : null,
        avgMonthlyNetIncome,
      }
    }

    // ── Inventory Summary ──
    let inventorySummary = null
    const inventoryItems: any[] = []
    if (items.length > 0) {
      let totalInventoryValue = 0
      let totalCost = 0
      let itemsWithStock = 0

      for (const item of items) {
        const qty = item.inventory ?? 0
        const unitCost = item.unitCost ?? 0
        const invValue = qty * unitCost
        totalInventoryValue += invValue
        totalCost += unitCost
        if (qty > 0) itemsWithStock++

        inventoryItems.push({
          item_no: item.number || item.id || '',
          description: item.displayName || item.description || '',
          inventory: qty,
          unit_cost: unitCost,
          inventory_value: invValue,
          sales_qty: 0,
          purchases_qty: 0,
        })
      }

      // Sort by inventory value descending
      inventoryItems.sort((a: any, b: any) => b.inventory_value - a.inventory_value)

      inventorySummary = {
        item_count: items.length,
        total_inventory_value: totalInventoryValue,
        total_cost: totalCost,
        items_with_stock: itemsWithStock,
      }
    }

    return NextResponse.json({
      data: {
        topCustomers,
        topVendors,
        agedReceivables,
        agedPayables,
        arapSummary,
        bankAccounts,
        totalCash,
        financialRatios,
        efficiencyMetrics,
        cashRunwayData,
        inventorySummary,
        inventoryItems: inventoryItems.slice(0, 50), // Limit to top 50
        monthlyRevenue,
        salesBySalesperson,
        currency,
        companyName,
      },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Enhanced financial data failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
