import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'

/**
 * GET /api/providers/dynamics/diagnostic
 *
 * Comprehensive BC API diagnostic — probes all available entities and computes
 * financial metrics used across the dashboard pages.
 *
 * Query params:
 *   connectionId  — BC OAuth connection ID
 *   startDate     — period start (YYYY-MM-DD)
 *   endDate       — period end (YYYY-MM-DD)
 *   tests         — comma-separated list of test IDs to run (default: all)
 */

// ── Shared Utilities ──

function decodeOData(s: string): string {
  return s.replace(/_x([0-9a-f]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * Map posting accounts to their enclosing section category using RANGE-BASED
 * section detection from Begin-Total accounts.
 *
 * BC's chart of accounts can have unbalanced Begin-Total/End-Total pairs (e.g.,
 * "Bank Loan" Begin-Total with no matching End-Total). This causes depth-based
 * section tracking to fail. Instead, we identify section boundaries from Begin-Total
 * accounts with target categories, then assign each posting account to the section
 * whose number range it falls into.
 *
 * @param allAccounts - All accounts from `queryAll('accounts')`
 * @param targetCategories - Categories to include (e.g., ['Assets', 'Liabilities', 'Equity'])
 * @returns Map of accountNumber → { section, subCategory }
 */
function buildAccountCategoryMap(
  allAccounts: any[],
  targetCategories: string[]
): Map<string, { section: string; subCategory: string }> {
  const sorted = [...allAccounts].sort((a: any, b: any) =>
    (a.number || '').localeCompare(b.number || '')
  )

  // Phase 1: Find section boundaries from Begin-Total accounts with target categories
  const sectionBoundaries: Array<{ category: string; startNumber: string }> = []
  let firstNonTargetStart: string | null = null

  for (const acc of sorted) {
    const accType = decodeOData(acc.accountType || '').toLowerCase()
    if (accType !== 'begin-total') continue

    const rawCat = decodeOData(acc.category || '').trim()
    const displayName = (acc.displayName || acc.number || '').trim()

    if (targetCategories.includes(rawCat)) {
      sectionBoundaries.push({ category: rawCat, startNumber: acc.number })
    } else if (!rawCat || rawCat === ' ') {
      // Fallback: infer from displayName when category is blank
      for (const cat of targetCategories) {
        if (
          displayName.toLowerCase() === cat.toLowerCase() ||
          displayName.toLowerCase().startsWith(cat.toLowerCase())
        ) {
          sectionBoundaries.push({ category: cat, startNumber: acc.number })
          break
        }
      }
    } else if (!firstNonTargetStart && !targetCategories.includes(rawCat)) {
      // First Begin-Total with a non-target category AFTER some target sections
      // marks the end of BS territory (e.g., Revenue after Equity)
      if (
        sectionBoundaries.length > 0 &&
        acc.number > sectionBoundaries[sectionBoundaries.length - 1].startNumber
      ) {
        firstNonTargetStart = acc.number
      }
    }
  }

  sectionBoundaries.sort((a, b) => a.startNumber.localeCompare(b.startNumber))

  // Build ranges
  const ranges = sectionBoundaries.map((s, i) => ({
    category: s.category,
    startNumber: s.startNumber,
    endBefore:
      i + 1 < sectionBoundaries.length ? sectionBoundaries[i + 1].startNumber : firstNonTargetStart,
  }))

  // Phase 2: Map account number → section using ranges
  function getSection(accNumber: string): string | null {
    for (let i = ranges.length - 1; i >= 0; i--) {
      const range = ranges[i]
      if (accNumber >= range.startNumber) {
        if (range.endBefore && accNumber >= range.endBefore) return null
        return range.category
      }
    }
    return null
  }

  const result = new Map<string, { section: string; subCategory: string }>()

  for (const acc of sorted) {
    const accType = decodeOData(acc.accountType || '').toLowerCase()
    if (accType !== 'posting') continue

    const section = getSection(acc.number)
    if (section) {
      result.set(acc.number, {
        section,
        subCategory: acc.subCategory || 'General',
      })
    }
  }

  return result
}

/**
 * Fetch GL entries and aggregate debit - credit by account number.
 *
 * @param client - BC API client
 * @param options - Date filters. For cumulative (balance sheet): just endDate.
 *                  For period (P&L): both startDate and endDate.
 */
async function getGLBalances(
  client: BusinessCentralClient,
  options: { startDate?: string; endDate?: string }
): Promise<Map<string, number>> {
  const filters: string[] = []
  if (options.startDate) filters.push(`postingDate ge ${options.startDate}`)
  if (options.endDate) filters.push(`postingDate le ${options.endDate}`)

  const params: any = { $select: 'accountNumber,debitAmount,creditAmount' }
  if (filters.length > 0) params.$filter = filters.join(' and ')

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

/**
 * Compute aging buckets from a list of invoices with dueDate and an amount field.
 */
function computeAgingBuckets(
  invoices: any[],
  amountField: string,
  nameField: string
): {
  totalDue: number
  aging: {
    current: number
    period1_30: number
    period31_60: number
    period61_90: number
    period91plus: number
  }
  topByBalance: any[]
  invoiceCount: number
} {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  let totalDue = 0
  let current = 0
  let period1_30 = 0
  let period31_60 = 0
  let period61_90 = 0
  let period91plus = 0

  // Group by customer/vendor name for top balances
  const byName: Record<string, number> = {}

  for (const inv of invoices) {
    const amount = Math.abs(inv[amountField] ?? inv.totalAmountIncludingTax ?? 0)
    if (amount === 0) continue

    totalDue += amount
    const name = inv[nameField] || 'Unknown'
    byName[name] = (byName[name] ?? 0) + amount

    const dueDate = inv.dueDate || inv.postingDate || todayStr
    const dueDateObj = new Date(dueDate)
    const daysPastDue = Math.floor((now.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24))

    if (daysPastDue <= 0) current += amount
    else if (daysPastDue <= 30) period1_30 += amount
    else if (daysPastDue <= 60) period31_60 += amount
    else if (daysPastDue <= 90) period61_90 += amount
    else period91plus += amount
  }

  const topByBalance = Object.entries(byName)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, balance]) => ({ name, balance: Math.round(balance * 100) / 100 }))

  return {
    totalDue: Math.round(totalDue * 100) / 100,
    aging: {
      current: Math.round(current * 100) / 100,
      period1_30: Math.round(period1_30 * 100) / 100,
      period31_60: Math.round(period31_60 * 100) / 100,
      period61_90: Math.round(period61_90 * 100) / 100,
      period91plus: Math.round(period91plus * 100) / 100,
    },
    topByBalance,
    invoiceCount: invoices.length,
  }
}

// ── Test Runner ──

interface TestResult {
  id: string
  label: string
  success: boolean
  detail: string
  data?: any
  rowCount?: number
  sampleRows?: any[]
  sampleFields?: string[]
  error?: string
  durationMs: number
}

async function runTest(
  id: string,
  label: string,
  fn: () => Promise<{
    detail: string
    data?: any
    rowCount?: number
    sampleRows?: any[]
    sampleFields?: string[]
  }>
): Promise<TestResult> {
  const t0 = Date.now()
  try {
    const result = await fn()
    return { id, label, success: true, durationMs: Date.now() - t0, ...result }
  } catch (err: any) {
    return {
      id,
      label,
      success: false,
      detail: err.message || String(err),
      error: err.message || String(err),
      durationMs: Date.now() - t0,
    }
  }
}

// ── Route Handler ──

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined
    const testsParam = url.searchParams.get('tests') || undefined
    const requestedTests = testsParam ? testsParam.split(',').map((t) => t.trim()) : null

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

    const shouldRun = (id: string) => !requestedTests || requestedTests.includes(id)

    const results: TestResult[] = []

    // ── 1. Entity Availability Probe ──
    if (shouldRun('entity-probe')) {
      results.push(
        await runTest('entity-probe', 'Entity Availability Probe', async () => {
          const entities = [
            { name: 'accounts', method: () => client.query('accounts', { $top: 1 }) },
            {
              name: 'generalLedgerEntries',
              method: () => client.query('generalLedgerEntries', { $top: 1 }),
            },
            { name: 'customers', method: () => client.query('customers', { $top: 1 }) },
            { name: 'vendors', method: () => client.query('vendors', { $top: 1 }) },
            { name: 'items', method: () => client.query('items', { $top: 1 }) },
            { name: 'bankAccounts', method: () => client.query('bankAccounts', { $top: 1 }) },
            {
              name: 'companyInformation',
              method: () => client.query('companyInformation', { $top: 1 }),
            },
            { name: 'salesInvoices', method: () => client.query('salesInvoices', { $top: 1 }) },
            {
              name: 'purchaseInvoices',
              method: () => client.query('purchaseInvoices', { $top: 1 }),
            },
            { name: 'dimensions', method: () => client.query('dimensions', { $top: 1 }) },
            { name: 'incomeStatement', method: () => client.query('incomeStatement', { $top: 1 }) },
            { name: 'balanceSheet', method: () => client.query('balanceSheet', { $top: 1 }) },
            { name: 'trialBalance', method: () => client.query('trialBalance', { $top: 1 }) },
            {
              name: 'cashFlowStatement',
              method: () => client.query('cashFlowStatement', { $top: 1 }),
            },
            {
              name: 'agedAccountsReceivables',
              method: () => client.query('agedAccountsReceivables', { $top: 1 }),
            },
            {
              name: 'agedAccountsPayables',
              method: () => client.query('agedAccountsPayables', { $top: 1 }),
            },
          ]

          const probeResults: Record<
            string,
            { available: boolean; fields?: string[]; error?: string }
          > = {}
          await Promise.allSettled(
            entities.map(async (e) => {
              try {
                const res = await e.method()
                const row = res.value?.[0]
                probeResults[e.name] = { available: true, fields: row ? Object.keys(row) : [] }
              } catch (err: any) {
                probeResults[e.name] = { available: false, error: err.message?.slice(0, 100) }
              }
            })
          )

          const available = Object.entries(probeResults)
            .filter(([, v]) => v.available)
            .map(([k]) => k)
          const unavailable = Object.entries(probeResults)
            .filter(([, v]) => !v.available)
            .map(([k]) => k)

          return {
            detail: `${available.length} available, ${unavailable.length} unavailable`,
            data: probeResults,
            rowCount: available.length,
          }
        })
      )
    }

    // ── 2. Company Information ──
    if (shouldRun('company-info')) {
      results.push(
        await runTest('company-info', 'Company Information', async () => {
          const res = await client.query('companyInformation', { $top: 1 })
          const info = res.value?.[0] || {}

          return {
            detail: `${info.displayName || info.name || '?'} | ${info.currencyCode || '?'} | ${info.country || '?'}`,
            data: {
              name: info.displayName || info.name,
              currencyCode: info.currencyCode,
              address: info.address,
              country: info.country,
              phoneNumber: info.phoneNumber,
              email: info.email,
              website: info.website,
              taxRegistrationNumber: info.taxRegistrationNumber,
              industry: info.industry,
              fiscalYearStartDate: info.fiscalYearStartDate,
            },
          }
        })
      )
    }

    // ── 3. Balance Sheet (chart-structure walk + GL entries) ──
    if (shouldRun('balance-sheet')) {
      results.push(
        await runTest('balance-sheet', 'Balance Sheet (chart walk + GL)', async () => {
          const BS_CATEGORIES = ['Assets', 'Liabilities', 'Equity']
          const allAccounts = await client.queryAll('accounts')

          // Build account→section map using chart-structure walk
          const accountMap = buildAccountCategoryMap(allAccounts, BS_CATEGORIES)

          // Get cumulative GL balances (all entries up to endDate)
          const glAmounts = await getGLBalances(client, { endDate })

          let totalAssets = 0,
            totalLiabilities = 0,
            totalEquity = 0
          let currentAssets = 0,
            currentLiabilities = 0
          const subCategorySums: Record<string, Record<string, number>> = {}
          let accountsIncluded = 0

          for (const [accNum, info] of accountMap) {
            const rawBalance = glAmounts.get(accNum) ?? 0
            if (rawBalance === 0) continue

            // Assets: debit normal (positive). Liabilities/Equity: credit normal (negate).
            const balance = info.section === 'Assets' ? rawBalance : -rawBalance

            accountsIncluded++

            // Accumulate totals
            if (info.section === 'Assets') totalAssets += balance
            else if (info.section === 'Liabilities') totalLiabilities += balance
            else if (info.section === 'Equity') totalEquity += balance

            // SubCategory breakdown
            if (!subCategorySums[info.section]) subCategorySums[info.section] = {}
            subCategorySums[info.section][info.subCategory] =
              (subCategorySums[info.section][info.subCategory] ?? 0) + balance

            // Classify current vs non-current
            const subLower = info.subCategory.toLowerCase()
            if (info.section === 'Assets') {
              if (
                subLower.includes('cash') ||
                subLower.includes('bank') ||
                subLower.includes('receivable') ||
                subLower.includes('prepaid') ||
                subLower.includes('inventory') ||
                subLower === 'current assets'
              ) {
                currentAssets += balance
              }
            } else if (info.section === 'Liabilities') {
              if (
                subLower.includes('payable') ||
                subLower.includes('accrued') ||
                subLower === 'current liabilities'
              ) {
                currentLiabilities += balance
              }
            }
          }

          const workingCapital = currentAssets - currentLiabilities
          const currentRatio = currentLiabilities !== 0 ? currentAssets / currentLiabilities : 0
          const quickRatio =
            currentLiabilities !== 0
              ? (currentAssets - (subCategorySums['Assets']?.['Inventory'] ?? 0)) /
                currentLiabilities
              : 0
          const debtToEquity = totalEquity !== 0 ? totalLiabilities / totalEquity : 0
          const balanceCheckDiff = totalAssets - totalLiabilities - totalEquity

          return {
            detail: `Assets: ${totalAssets.toLocaleString()}, Liabilities: ${totalLiabilities.toLocaleString()}, Equity: ${totalEquity.toLocaleString()} | A=L+E check: diff=${Math.round(balanceCheckDiff)}`,
            data: {
              totals: {
                totalAssets: Math.round(totalAssets * 100) / 100,
                totalLiabilities: Math.round(totalLiabilities * 100) / 100,
                totalEquity: Math.round(totalEquity * 100) / 100,
              },
              currentAssets: Math.round(currentAssets * 100) / 100,
              currentLiabilities: Math.round(currentLiabilities * 100) / 100,
              ratios: {
                workingCapital: Math.round(workingCapital * 100) / 100,
                currentRatio: Math.round(currentRatio * 100) / 100,
                quickRatio: Math.round(quickRatio * 100) / 100,
                debtToEquity: Math.round(debtToEquity * 100) / 100,
              },
              balanceCheck: {
                diff: Math.round(balanceCheckDiff * 100) / 100,
                balanced: Math.abs(balanceCheckDiff) < 1,
              },
              subCategorySums,
              accountsIncluded,
              accountsMapped: accountMap.size,
            },
          }
        })
      )
    }

    // ── 4. Bank Accounts / Cash Position (chart walk + GL) ──
    if (shouldRun('bank-accounts')) {
      results.push(
        await runTest('bank-accounts', 'Cash & Bank Position (GL-based)', async () => {
          const allAccounts = await client.queryAll('accounts')

          // Find cash/bank accounts via chart-structure walk
          const accountMap = buildAccountCategoryMap(allAccounts, ['Assets'])

          // Get cumulative GL balances
          const glAmounts = await getGLBalances(client, { endDate })

          // Filter to cash/bank subCategories
          const cashAccounts: Array<{
            number: string
            name: string
            balance: number
            subCategory: string
          }> = []
          for (const [accNum, info] of accountMap) {
            const subLower = info.subCategory.toLowerCase()
            if (subLower.includes('cash') || subLower.includes('bank')) {
              const balance = glAmounts.get(accNum) ?? 0 // Assets are debit normal, positive = cash on hand
              // Find display name
              const acc = allAccounts.find((a: any) => a.number === accNum)
              cashAccounts.push({
                number: accNum,
                name: acc?.displayName || accNum,
                balance: Math.round(balance * 100) / 100,
                subCategory: info.subCategory,
              })
            }
          }

          const totalCash = cashAccounts.reduce((s, a) => s + a.balance, 0)
          const withBalance = cashAccounts.filter((a) => a.balance !== 0)

          // Also fetch bankAccounts entity for comparison
          const bankEntities = await client.listBankAccounts().catch(() => [])
          const bankEntityTotal = bankEntities.reduce(
            (s: number, b: any) => s + (b.balance ?? 0),
            0
          )

          return {
            detail: `${cashAccounts.length} cash/bank accounts, total: ${totalCash.toLocaleString()} (GL-based). bankAccounts entity: ${bankEntityTotal.toLocaleString()}`,
            data: {
              totalCash: Math.round(totalCash * 100) / 100,
              accountCount: cashAccounts.length,
              withBalance: withBalance.length,
              accounts: cashAccounts.sort((a, b) => b.balance - a.balance),
              bankEntityComparison: {
                entityCount: bankEntities.length,
                entityTotal: bankEntityTotal,
              },
            },
            rowCount: cashAccounts.length,
          }
        })
      )
    }

    // ── 5. Customers (with AR from salesInvoices) ──
    if (shouldRun('customers')) {
      results.push(
        await runTest('customers', 'Customers (AR from Invoices)', async () => {
          const [customers, salesInvoices] = await Promise.all([
            client.listCustomers(),
            client.listSalesInvoices().catch(() => []),
          ])

          // Calculate AR from invoices with remaining amounts
          const arByCustomer: Record<
            string,
            { name: string; balance: number; invoiceCount: number }
          > = {}
          let totalAR = 0

          for (const inv of salesInvoices) {
            const remaining = inv.remainingAmount ?? 0
            if (remaining <= 0) continue

            const custName = inv.customerName || inv.customerId || 'Unknown'
            if (!arByCustomer[custName])
              arByCustomer[custName] = { name: custName, balance: 0, invoiceCount: 0 }
            arByCustomer[custName].balance += remaining
            arByCustomer[custName].invoiceCount++
            totalAR += remaining
          }

          const customersWithAR = Object.values(arByCustomer).filter((c) => c.balance > 0)
          const topByBalance = [...customersWithAR]
            .sort((a, b) => b.balance - a.balance)
            .slice(0, 10)
            .map((c) => ({
              name: c.name,
              balance: Math.round(c.balance * 100) / 100,
              invoiceCount: c.invoiceCount,
            }))

          // Also show what the entity says (for comparison)
          const entityAR = customers.reduce(
            (s: number, c: any) => s + (c.balance ?? c.balanceDue ?? 0),
            0
          )

          return {
            detail: `${customers.length} customers, ${customersWithAR.length} with AR, total AR: ${totalAR.toLocaleString()} (from ${salesInvoices.length} invoices). Entity AR: ${entityAR.toLocaleString()}`,
            data: {
              totalCustomers: customers.length,
              customersWithAR: customersWithAR.length,
              totalAR: Math.round(totalAR * 100) / 100,
              topByBalance,
              invoicesAnalyzed: salesInvoices.length,
              entityARComparison: entityAR,
            },
            rowCount: customers.length,
          }
        })
      )
    }

    // ── 6. Vendors (AP from vendors.balance entity field) ──
    if (shouldRun('vendors')) {
      results.push(
        await runTest('vendors', 'Vendors (AP from vendor balances)', async () => {
          const vendors = await client.listVendors()

          // vendors.balance is the reliable AP field (unlike purchaseInvoices which lacks remainingAmount)
          const totalAP = vendors.reduce((s: number, v: any) => s + Math.abs(v.balance ?? 0), 0)
          const withAP = vendors.filter((v: any) => (v.balance ?? 0) !== 0)
          const topByBalance = [...vendors]
            .sort((a: any, b: any) => Math.abs(b.balance ?? 0) - Math.abs(a.balance ?? 0))
            .slice(0, 10)
            .filter((v: any) => (v.balance ?? 0) !== 0)
            .map((v: any) => ({
              name: v.displayName || v.number,
              number: v.number,
              balance: Math.abs(v.balance ?? 0),
            }))

          return {
            detail: `${vendors.length} vendors, ${withAP.length} with AP, total AP: ${totalAP.toLocaleString()}`,
            data: {
              totalVendors: vendors.length,
              vendorsWithAP: withAP.length,
              totalAP: Math.round(totalAP * 100) / 100,
              topByBalance,
            },
            rowCount: vendors.length,
          }
        })
      )
    }

    // ── 7. Aged Accounts Receivable (from salesInvoices) ──
    if (shouldRun('aged-ar')) {
      results.push(
        await runTest('aged-ar', 'Aged Accounts Receivable (Invoices)', async () => {
          const salesInvoices = await client.listSalesInvoices().catch(() => [])

          // Filter to invoices with remaining amounts (open/unpaid)
          const openInvoices = salesInvoices.filter((inv: any) => (inv.remainingAmount ?? 0) > 0)
          const aging = computeAgingBuckets(openInvoices, 'remainingAmount', 'customerName')

          return {
            detail: `${aging.invoiceCount} open invoices, total due: ${aging.totalDue.toLocaleString()}. Current: ${aging.aging.current.toLocaleString()}, 1-30: ${aging.aging.period1_30.toLocaleString()}, 31-60: ${aging.aging.period31_60.toLocaleString()}, 61-90: ${aging.aging.period61_90.toLocaleString()}, 91+: ${aging.aging.period91plus.toLocaleString()}`,
            data: {
              totalDue: aging.totalDue,
              aging: aging.aging,
              periodLabels: {
                current: 'Current',
                period1: '1-30 Days',
                period2: '31-60 Days',
                period3: '61-90 Days',
                period4: '91+ Days',
              },
              topByBalance: aging.topByBalance,
              openInvoiceCount: aging.invoiceCount,
              totalInvoicesAnalyzed: salesInvoices.length,
            },
            rowCount: aging.invoiceCount,
          }
        })
      )
    }

    // ── 8. Aged Accounts Payable (from vendors.balance + purchaseInvoices for aging) ──
    if (shouldRun('aged-ap')) {
      results.push(
        await runTest('aged-ap', 'Aged Accounts Payable', async () => {
          // purchaseInvoices lacks remainingAmount, so filter by status for open invoices
          // and use totalAmountIncludingTax as the amount
          const purchaseInvoices = await client.listPurchaseInvoices().catch(() => [])

          // Filter to unpaid invoices (status !== 'Paid') — use totalAmountIncludingTax
          const openInvoices = purchaseInvoices.filter((inv: any) => {
            const status = (inv.status || '').toLowerCase()
            return (
              status !== 'paid' &&
              status !== 'canceled' &&
              status !== 'cancelled' &&
              (inv.totalAmountIncludingTax ?? 0) > 0
            )
          })
          const aging = computeAgingBuckets(openInvoices, 'totalAmountIncludingTax', 'vendorName')

          return {
            detail: `${aging.invoiceCount} open invoices, total due: ${aging.totalDue.toLocaleString()}. Current: ${aging.aging.current.toLocaleString()}, 1-30: ${aging.aging.period1_30.toLocaleString()}, 31-60: ${aging.aging.period31_60.toLocaleString()}, 61-90: ${aging.aging.period61_90.toLocaleString()}, 91+: ${aging.aging.period91plus.toLocaleString()}`,
            data: {
              totalDue: aging.totalDue,
              aging: aging.aging,
              periodLabels: {
                current: 'Current',
                period1: '1-30 Days',
                period2: '31-60 Days',
                period3: '61-90 Days',
                period4: '91+ Days',
              },
              topByBalance: aging.topByBalance,
              openInvoiceCount: aging.invoiceCount,
              totalInvoicesAnalyzed: purchaseInvoices.length,
            },
            rowCount: aging.invoiceCount,
          }
        })
      )
    }

    // ── 9. Inventory (Items) ──
    if (shouldRun('inventory')) {
      results.push(
        await runTest('inventory', 'Inventory (Items)', async () => {
          const items = await client.listItems()
          const totalInventory = items.reduce((s: number, i: any) => s + (i.inventory ?? 0), 0)
          const totalValue = items.reduce(
            (s: number, i: any) => s + (i.inventory ?? 0) * (i.unitCost ?? 0),
            0
          )
          const withStock = items.filter((i: any) => (i.inventory ?? 0) > 0)
          const topByValue = [...items]
            .sort(
              (a: any, b: any) =>
                (b.inventory ?? 0) * (b.unitCost ?? 0) - (a.inventory ?? 0) * (a.unitCost ?? 0)
            )
            .slice(0, 10)
            .map((i: any) => ({
              name: i.displayName || i.number,
              number: i.number,
              inventory: i.inventory,
              unitCost: i.unitCost,
              totalValue: (i.inventory ?? 0) * (i.unitCost ?? 0),
              type: i.type,
            }))

          return {
            detail: `${items.length} items, ${withStock.length} in stock, total units: ${totalInventory.toLocaleString()}, est. value: ${totalValue.toLocaleString()}`,
            data: {
              totalItems: items.length,
              withStock: withStock.length,
              totalInventory,
              estimatedValue: totalValue,
              topByValue,
            },
            rowCount: items.length,
            sampleFields: items[0] ? Object.keys(items[0]) : [],
          }
        })
      )
    }

    // ── 10. Sales & Purchase Invoices ──
    if (shouldRun('invoices')) {
      results.push(
        await runTest('invoices', 'Sales & Purchase Invoices', async () => {
          const [sales, purchases] = await Promise.all([
            client.listSalesInvoices({ $top: 100, $orderby: 'postingDate desc' }).catch(() => []),
            client
              .listPurchaseInvoices({ $top: 100, $orderby: 'postingDate desc' })
              .catch(() => []),
          ])

          const salesTotal = sales.reduce(
            (s: number, i: any) => s + (i.totalAmountIncludingTax ?? 0),
            0
          )
          const purchaseTotal = purchases.reduce(
            (s: number, i: any) => s + (i.totalAmountIncludingTax ?? 0),
            0
          )

          return {
            detail: `${sales.length} sales invoices (${salesTotal.toLocaleString()}), ${purchases.length} purchase invoices (${purchaseTotal.toLocaleString()})`,
            data: {
              sales: {
                count: sales.length,
                totalAmount: salesTotal,
                recent: sales.slice(0, 5).map((i: any) => ({
                  number: i.number,
                  customerName: i.customerName,
                  amount: i.totalAmountIncludingTax,
                  date: i.postingDate,
                  status: i.status,
                })),
              },
              purchases: {
                count: purchases.length,
                totalAmount: purchaseTotal,
                recent: purchases.slice(0, 5).map((i: any) => ({
                  number: i.number,
                  vendorName: i.vendorName,
                  amount: i.totalAmountIncludingTax,
                  date: i.postingDate,
                  status: i.status,
                })),
              },
            },
            rowCount: sales.length + purchases.length,
            sampleFields: sales[0] ? Object.keys(sales[0]) : [],
          }
        })
      )
    }

    // ── 11. Monthly P&L Trend (chart-structure walk + GL entries) ──
    if (shouldRun('monthly-pnl') && startDate && endDate) {
      results.push(
        await runTest('monthly-pnl', `Monthly P&L Trend (${startDate} to ${endDate})`, async () => {
          const PL_CATEGORIES = ['Income', 'Expense', 'Cost of Goods Sold']
          const allAccounts = await client.queryAll('accounts')

          // Build account→category map using chart-structure walk (handles blank categories)
          const accountCategoryMap = buildAccountCategoryMap(allAccounts, PL_CATEGORIES)

          // Fetch GL entries for the period (need postingDate for monthly grouping)
          const filter = `postingDate ge ${startDate} and postingDate le ${endDate}`
          const entries = await client.listGeneralLedgerEntries({
            $filter: filter,
            $select: 'accountNumber,debitAmount,creditAmount,postingDate',
          })

          // Aggregate by month and category
          const monthlyData: Record<string, { revenue: number; cogs: number; expenses: number }> =
            {}
          for (const entry of entries) {
            const accNum = entry.accountNumber
            const info = accountCategoryMap.get(accNum)
            if (!info) continue

            const date = entry.postingDate?.substring(0, 7) // YYYY-MM
            if (!date) continue

            if (!monthlyData[date]) monthlyData[date] = { revenue: 0, cogs: 0, expenses: 0 }
            const amount = (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)

            if (info.section === 'Income') monthlyData[date].revenue += Math.abs(amount)
            else if (info.section === 'Cost of Goods Sold')
              monthlyData[date].cogs += Math.abs(amount)
            else if (info.section === 'Expense') monthlyData[date].expenses += Math.abs(amount)
          }

          // Sort by month and compute net income
          const months = Object.keys(monthlyData).sort()
          const trend = months.map((month) => ({
            month,
            revenue: Math.round(monthlyData[month].revenue * 100) / 100,
            cogs: Math.round(monthlyData[month].cogs * 100) / 100,
            expenses: Math.round(monthlyData[month].expenses * 100) / 100,
            grossProfit:
              Math.round((monthlyData[month].revenue - monthlyData[month].cogs) * 100) / 100,
            netIncome:
              Math.round(
                (monthlyData[month].revenue -
                  monthlyData[month].cogs -
                  monthlyData[month].expenses) *
                  100
              ) / 100,
          }))

          const totalRevenue = trend.reduce((s, m) => s + m.revenue, 0)
          const totalCogs = trend.reduce((s, m) => s + m.cogs, 0)
          const totalExpenses = trend.reduce((s, m) => s + m.expenses, 0)
          const grossMarginPct =
            totalRevenue > 0 ? ((totalRevenue - totalCogs) / totalRevenue) * 100 : 0
          const netMarginPct =
            totalRevenue > 0 ? ((totalRevenue - totalCogs - totalExpenses) / totalRevenue) * 100 : 0

          return {
            detail: `${months.length} months, ${entries.length} GL entries, ${accountCategoryMap.size} P&L accounts mapped. Gross Margin: ${grossMarginPct.toFixed(1)}%, Net Margin: ${netMarginPct.toFixed(1)}%`,
            data: {
              trend,
              summary: {
                totalRevenue: Math.round(totalRevenue),
                totalCogs: Math.round(totalCogs),
                totalExpenses: Math.round(totalExpenses),
                grossMarginPct: Math.round(grossMarginPct * 10) / 10,
                netMarginPct: Math.round(netMarginPct * 10) / 10,
                avgMonthlyRevenue: Math.round(months.length > 0 ? totalRevenue / months.length : 0),
                avgMonthlyExpenses: Math.round(
                  months.length > 0 ? (totalCogs + totalExpenses) / months.length : 0
                ),
                monthsInPeriod: months.length,
                plAccountsMapped: accountCategoryMap.size,
              },
            },
            rowCount: months.length,
          }
        })
      )
    }

    // ── 12. Financial Health Score (4-component, matching warehouse) ──
    if (shouldRun('health-score')) {
      results.push(
        await runTest('health-score', 'Financial Health Score', async () => {
          const allAccounts = await client.queryAll('accounts')
          const BS_CATEGORIES = ['Assets', 'Liabilities', 'Equity']
          const PL_CATEGORIES = ['Income', 'Expense', 'Cost of Goods Sold']

          // Build maps for both BS and P&L
          const bsMap = buildAccountCategoryMap(allAccounts, BS_CATEGORIES)
          const plMap = buildAccountCategoryMap(allAccounts, PL_CATEGORIES)

          // Fetch GL balances: cumulative for BS, period for P&L
          const [cumulativeGL, periodGL] = await Promise.all([
            getGLBalances(client, { endDate }),
            startDate && endDate
              ? getGLBalances(client, { startDate, endDate })
              : Promise.resolve(new Map<string, number>()),
          ])

          // ── Compute BS metrics ──
          let totalAssets = 0,
            totalLiabilities = 0,
            totalEquity = 0
          let currentAssets = 0,
            currentLiabilities = 0
          let totalCash = 0,
            inventoryValue = 0

          for (const [accNum, info] of bsMap) {
            const rawBalance = cumulativeGL.get(accNum) ?? 0
            if (rawBalance === 0) continue
            const balance = info.section === 'Assets' ? rawBalance : -rawBalance

            if (info.section === 'Assets') {
              totalAssets += balance
              const subLower = info.subCategory.toLowerCase()
              if (subLower.includes('cash') || subLower.includes('bank')) {
                totalCash += balance
                currentAssets += balance
              } else if (subLower.includes('receivable') || subLower.includes('prepaid')) {
                currentAssets += balance
              } else if (subLower.includes('inventory')) {
                currentAssets += balance
                inventoryValue += balance
              } else if (subLower === 'current assets') {
                currentAssets += balance
              }
            } else if (info.section === 'Liabilities') {
              totalLiabilities += balance
              const subLower = info.subCategory.toLowerCase()
              if (
                subLower.includes('payable') ||
                subLower.includes('accrued') ||
                subLower === 'current liabilities'
              ) {
                currentLiabilities += balance
              }
            } else {
              totalEquity += balance
            }
          }

          // ── Compute P&L metrics ──
          let periodRevenue = 0,
            periodCogs = 0,
            periodExpenses = 0
          for (const [accNum, info] of plMap) {
            const rawAmount = periodGL.get(accNum) ?? 0
            if (rawAmount === 0) continue
            const amount = Math.abs(rawAmount)
            if (info.section === 'Income') periodRevenue += amount
            else if (info.section === 'Cost of Goods Sold') periodCogs += amount
            else if (info.section === 'Expense') periodExpenses += amount
          }
          const netIncome = periodRevenue - periodCogs - periodExpenses

          // ── Compute AR from salesInvoices, AP from vendors.balance ──
          const [salesInvoices, vendors] = await Promise.all([
            client.listSalesInvoices().catch(() => []),
            client.listVendors().catch(() => []),
          ])
          const totalAR = salesInvoices.reduce(
            (s: number, inv: any) => s + ((inv.remainingAmount ?? 0) > 0 ? inv.remainingAmount : 0),
            0
          )
          const totalAP = vendors.reduce((s: number, v: any) => s + Math.abs(v.balance ?? 0), 0)

          // ── Derived ratios ──
          const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : null
          const netMarginPct = periodRevenue > 0 ? (netIncome / periodRevenue) * 100 : null
          const debtToEquity = totalEquity > 0 ? totalLiabilities / totalEquity : null
          const monthlyBurn = (periodCogs + periodExpenses) / 12
          const cashRunway = monthlyBurn > 0 ? totalCash / monthlyBurn : null
          const dso = periodRevenue > 0 ? (totalAR / periodRevenue) * 365 : null

          // ── Liquidity Score (25%) ──
          let liquidityScore = 50
          let liquidityDetails = 'Insufficient data'
          if (currentRatio !== null) {
            if (currentRatio >= 2) liquidityScore = 100
            else if (currentRatio >= 1.5) liquidityScore = 80
            else if (currentRatio >= 1) liquidityScore = 60
            else if (currentRatio >= 0.5) liquidityScore = 40
            else liquidityScore = 20
            liquidityDetails = `Current Ratio: ${currentRatio.toFixed(2)}`
          } else if (cashRunway !== null) {
            if (cashRunway >= 24) liquidityScore = 100
            else if (cashRunway >= 12) liquidityScore = 80
            else if (cashRunway >= 6) liquidityScore = 60
            else if (cashRunway >= 3) liquidityScore = 40
            else liquidityScore = 20
            liquidityDetails = `Cash Runway: ${cashRunway.toFixed(1)} months`
          }

          // ── Profitability Score (25%) ──
          let profitabilityScore = 50
          let profitabilityDetails = 'Insufficient data'
          if (netMarginPct !== null) {
            if (netMarginPct >= 20) profitabilityScore = 100
            else if (netMarginPct >= 10) profitabilityScore = 80
            else if (netMarginPct >= 5) profitabilityScore = 60
            else if (netMarginPct >= 0) profitabilityScore = 40
            else profitabilityScore = 20
            profitabilityDetails = `Net Margin: ${netMarginPct.toFixed(1)}%`
          }

          // ── Efficiency Score (25%) ──
          let efficiencyScore = 50
          let efficiencyDetails = 'Insufficient data'
          if (dso !== null) {
            if (dso <= 30) efficiencyScore = 100
            else if (dso <= 45) efficiencyScore = 80
            else if (dso <= 60) efficiencyScore = 60
            else if (dso <= 90) efficiencyScore = 40
            else efficiencyScore = 20
            efficiencyDetails = `DSO: ${dso.toFixed(0)} days`
          }

          // ── Leverage Score (25%) ──
          let leverageScore = 50
          let leverageDetails = 'Insufficient data'
          if (debtToEquity !== null) {
            if (debtToEquity <= 0.5) leverageScore = 100
            else if (debtToEquity <= 1) leverageScore = 80
            else if (debtToEquity <= 2) leverageScore = 60
            else if (debtToEquity <= 3) leverageScore = 40
            else leverageScore = 20
            leverageDetails = `D/E: ${debtToEquity.toFixed(2)}`
          }

          const overallScore = Math.round(
            liquidityScore * 0.25 +
              profitabilityScore * 0.25 +
              efficiencyScore * 0.25 +
              leverageScore * 0.25
          )
          const rating =
            overallScore >= 80
              ? 'Excellent'
              : overallScore >= 60
                ? 'Good'
                : overallScore >= 40
                  ? 'Fair'
                  : overallScore >= 20
                    ? 'Needs Attention'
                    : 'Critical'

          return {
            detail: `Score: ${overallScore}/100 (${rating}). Liquidity: ${liquidityScore}, Profitability: ${profitabilityScore}, Efficiency: ${efficiencyScore}, Leverage: ${leverageScore}`,
            data: {
              overallScore,
              rating,
              components: {
                liquidity: { score: liquidityScore, weight: 25, details: liquidityDetails },
                profitability: {
                  score: profitabilityScore,
                  weight: 25,
                  details: profitabilityDetails,
                },
                efficiency: { score: efficiencyScore, weight: 25, details: efficiencyDetails },
                leverage: { score: leverageScore, weight: 25, details: leverageDetails },
              },
              metrics: {
                totalAssets: Math.round(totalAssets),
                totalLiabilities: Math.round(totalLiabilities),
                totalEquity: Math.round(totalEquity),
                currentAssets: Math.round(currentAssets),
                currentLiabilities: Math.round(currentLiabilities),
                totalCash: Math.round(totalCash),
                totalAR: Math.round(totalAR),
                totalAP: Math.round(totalAP),
                periodRevenue: Math.round(periodRevenue),
                periodCogs: Math.round(periodCogs),
                periodExpenses: Math.round(periodCogs + periodExpenses),
                netIncome: Math.round(netIncome),
                currentRatio: currentRatio !== null ? Math.round(currentRatio * 100) / 100 : null,
                netMarginPct: netMarginPct !== null ? Math.round(netMarginPct * 10) / 10 : null,
                debtToEquity: debtToEquity !== null ? Math.round(debtToEquity * 100) / 100 : null,
                dso: dso !== null ? Math.round(dso) : null,
                cashRunway: cashRunway !== null ? Math.round(cashRunway * 10) / 10 : null,
                monthlyBurn: Math.round(monthlyBurn),
              },
            },
          }
        })
      )
    }

    // ── 13. Efficiency Metrics ──
    if (shouldRun('efficiency')) {
      results.push(
        await runTest('efficiency', 'Efficiency Metrics', async () => {
          const allAccounts = await client.queryAll('accounts')
          const PL_CATEGORIES = ['Income', 'Expense', 'Cost of Goods Sold']

          // Chart-structure walk for P&L accounts
          const plMap = buildAccountCategoryMap(allAccounts, PL_CATEGORIES)

          // Period GL for revenue/COGS
          let periodRevenue = 0,
            periodCogs = 0
          if (startDate && endDate) {
            const periodGL = await getGLBalances(client, { startDate, endDate })
            for (const [accNum, info] of plMap) {
              const rawAmount = periodGL.get(accNum) ?? 0
              if (rawAmount === 0) continue
              const amount = Math.abs(rawAmount)
              if (info.section === 'Income') periodRevenue += amount
              else if (info.section === 'Cost of Goods Sold') periodCogs += amount
            }
          }

          // AR from salesInvoices, AP from vendors.balance, inventory from items
          const [salesInvoices, vendors, items] = await Promise.all([
            client.listSalesInvoices().catch(() => []),
            client.listVendors().catch(() => []),
            client.listItems().catch(() => []),
          ])

          const totalAR = salesInvoices.reduce(
            (s: number, inv: any) => s + ((inv.remainingAmount ?? 0) > 0 ? inv.remainingAmount : 0),
            0
          )
          const totalAP = vendors.reduce((s: number, v: any) => s + Math.abs(v.balance ?? 0), 0)
          const totalInventory = items.reduce(
            (s: number, i: any) => s + (i.inventory ?? 0) * (i.unitCost ?? 0),
            0
          )

          // Daily figures (annualized from period)
          const dailyRevenue = periodRevenue / 365
          const dailyCogs = periodCogs / 365

          // DSO = (AR / Annual Revenue) * 365 = AR / dailyRevenue
          const dso = dailyRevenue > 0 ? totalAR / dailyRevenue : null
          // DPO = (AP / Annual COGS) * 365 = AP / dailyCogs
          const dpo = dailyCogs > 0 ? totalAP / dailyCogs : null
          // Inventory Turnover = COGS / Inventory
          const inventoryTurnover = totalInventory > 0 ? periodCogs / totalInventory : null
          // Cash Conversion Cycle = DSO - DPO
          const cashConversionCycle = dso !== null && dpo !== null ? dso - dpo : null
          // AR Turnover = Revenue / AR
          const arTurnover = totalAR > 0 ? periodRevenue / totalAR : null
          // AP Turnover = COGS / AP
          const apTurnover = totalAP > 0 ? periodCogs / totalAP : null

          const metrics = {
            dso: dso !== null ? Math.round(dso * 10) / 10 : null,
            dpo: dpo !== null ? Math.round(dpo * 10) / 10 : null,
            inventoryTurnover:
              inventoryTurnover !== null ? Math.round(inventoryTurnover * 100) / 100 : null,
            cashConversionCycle:
              cashConversionCycle !== null ? Math.round(cashConversionCycle * 10) / 10 : null,
            arTurnover: arTurnover !== null ? Math.round(arTurnover * 100) / 100 : null,
            apTurnover: apTurnover !== null ? Math.round(apTurnover * 100) / 100 : null,
          }

          const parts: string[] = []
          if (metrics.dso !== null) parts.push(`DSO: ${metrics.dso} days`)
          if (metrics.dpo !== null) parts.push(`DPO: ${metrics.dpo} days`)
          if (metrics.cashConversionCycle !== null)
            parts.push(`CCC: ${metrics.cashConversionCycle} days`)
          if (metrics.inventoryTurnover !== null)
            parts.push(`Inv Turns: ${metrics.inventoryTurnover}x`)

          return {
            detail:
              parts.length > 0 ? parts.join(', ') : 'Insufficient data for efficiency metrics',
            data: {
              metrics,
              inputs: {
                periodRevenue: Math.round(periodRevenue),
                periodCogs: Math.round(periodCogs),
                totalAR: Math.round(totalAR * 100) / 100,
                totalAP: Math.round(totalAP * 100) / 100,
                totalInventory: Math.round(totalInventory * 100) / 100,
              },
            },
          }
        })
      )
    }

    return NextResponse.json({
      connectionId: resolvedConnectionId,
      companyName: credentials.company_name || null,
      period: { startDate, endDate },
      testsRun: results.length,
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
