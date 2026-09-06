import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

/**
 * GET /api/providers/dynamics/account-detail
 *
 * Returns granular detail for a single GL account:
 *   - Flow metrics (opening balance, inflows, outflows, closing balance)
 *   - Monthly trend (cumulative closing balance per month)
 *   - Recent transactions (GL entries with document info)
 *   - Sub-ledger breakdown (contextual: customers for AR, vendors for AP, items for inventory, etc.)
 *
 * Query params:
 *   connectionId   — BC OAuth connection ID
 *   accountNumber  — GL account number (required)
 *   startDate      — period start (YYYY-MM-DD)
 *   endDate        — period end (YYYY-MM-DD)
 *   category       — account category (Assets | Liabilities | Equity) for sign convention
 *   subCategory    — account subcategory for sub-ledger routing
 */

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  const t0 = Date.now()

  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const accountNumber = url.searchParams.get('accountNumber')
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined
    const category = url.searchParams.get('category') || ''
    const subCategory = url.searchParams.get('subCategory') || ''

    if (!accountNumber) {
      return NextResponse.json({ error: 'accountNumber is required' }, { status: 400 })
    }

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
    await client.warmUp()

    const escapedAccNum = accountNumber.replace(/'/g, "''")

    // ── Fetch GL entries for this account ──
    // Fetch ALL entries up to endDate (needed for opening balance + period activity)
    const glFilter = endDate
      ? `accountNumber eq '${escapedAccNum}' and postingDate le ${endDate}`
      : `accountNumber eq '${escapedAccNum}'`

    const glEntries = await client.listGeneralLedgerEntries({
      $filter: glFilter,
      $select:
        'accountNumber,debitAmount,creditAmount,postingDate,documentNumber,documentType,description',
      $orderby: 'postingDate desc',
    })

    // ── Compute flow metrics ──
    let openingBalance = 0
    let periodDebits = 0
    let periodCredits = 0
    let closingBalance = 0

    const periodEntries: any[] = []

    for (const entry of glEntries) {
      const debit = entry.debitAmount ?? 0
      const credit = entry.creditAmount ?? 0
      const net = debit - credit
      closingBalance += net

      if (startDate && entry.postingDate < startDate) {
        openingBalance += net
      } else {
        periodDebits += debit
        periodCredits += credit
        periodEntries.push(entry)
      }
    }

    // If no startDate provided, opening is 0 and closing is everything
    if (!startDate) {
      openingBalance = 0
    }

    // Sign convention: Liabilities/Equity are credit-normal (negate for display)
    const isCreditNormal = category === 'Liabilities' || category === 'Equity'
    const signMultiplier = isCreditNormal ? -1 : 1

    const flow = {
      opening: Math.round(openingBalance * signMultiplier * 100) / 100,
      inflows: Math.round((isCreditNormal ? periodCredits : periodDebits) * 100) / 100,
      outflows: Math.round((isCreditNormal ? periodDebits : periodCredits) * 100) / 100,
      closing: Math.round(closingBalance * signMultiplier * 100) / 100,
    }

    // ── Monthly trend (last 12 months) ──
    // Group all entries by month, compute cumulative closing balance at each month-end
    const monthlyBalances = new Map<string, number>()
    // Sort entries by date ascending for cumulative computation
    const sortedEntries = [...glEntries].sort((a, b) =>
      (a.postingDate || '').localeCompare(b.postingDate || '')
    )
    let runningBalance = 0
    for (const entry of sortedEntries) {
      const month = (entry.postingDate || '').substring(0, 7) // YYYY-MM
      if (!month) continue
      runningBalance += (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)
      monthlyBalances.set(month, runningBalance)
    }

    // Convert to array, apply sign convention, take last 12
    const monthlyTrend = [...monthlyBalances.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, balance]) => ({
        month,
        balance: Math.round(balance * signMultiplier * 100) / 100,
      }))

    // ── All period transactions (sorted desc) — frontend handles pagination ──
    const recentTransactions = periodEntries
      .sort((a, b) => (b.postingDate || '').localeCompare(a.postingDate || ''))
      .map((e) => ({
        postingDate: e.postingDate || '',
        documentNumber: e.documentNumber || '',
        documentType: e.documentType || '',
        description: e.description || '',
        debitAmount: e.debitAmount ?? 0,
        creditAmount: e.creditAmount ?? 0,
      }))

    // ── Sub-ledger data (contextual) ──
    const subLower = (subCategory || '').toLowerCase()
    let subLedger: { type: string | null; data: any[] } = { type: null, data: [] }

    try {
      if (
        subLower.includes('cash') ||
        subLower.includes('bank') ||
        subLower.includes('checking') ||
        subLower.includes('savings')
      ) {
        const bankAccounts = await client.listBankAccounts({
          $select: 'number,displayName,bankAccountNumber,currencyCode',
        })
        subLedger = { type: 'bank', data: bankAccounts.slice(0, 10) }
      } else if (subLower.includes('receivable')) {
        const ar = await client.getAgedAccountsReceivable()
        const topCustomers = ar.records
          .filter((r: any) => Math.abs(r.balanceDue ?? 0) > 0)
          .sort((a: any, b: any) => Math.abs(b.balanceDue ?? 0) - Math.abs(a.balanceDue ?? 0))
          .slice(0, 10)
          .map((r: any) => ({
            name: r.customerName || r.name || 'Unknown',
            number: r.customerNumber || r.customerNo || '',
            balanceDue: r.balanceDue ?? 0,
            currentAmount: r.currentAmount ?? 0,
            period1Amount: r.period1Amount ?? 0,
            period2Amount: r.period2Amount ?? 0,
            period3Amount: r.period3Amount ?? 0,
          }))
        subLedger = { type: 'receivables', data: topCustomers }
      } else if (subLower.includes('payable')) {
        const ap = await client.getAgedAccountsPayable()
        const topVendors = ap.records
          .filter((r: any) => Math.abs(r.balanceDue ?? 0) > 0)
          .sort((a: any, b: any) => Math.abs(b.balanceDue ?? 0) - Math.abs(a.balanceDue ?? 0))
          .slice(0, 10)
          .map((r: any) => ({
            name: r.vendorName || r.name || 'Unknown',
            number: r.vendorNumber || r.vendorNo || '',
            balanceDue: Math.abs(r.balanceDue ?? 0),
            currentAmount: Math.abs(r.currentAmount ?? 0),
            period1Amount: Math.abs(r.period1Amount ?? 0),
            period2Amount: Math.abs(r.period2Amount ?? 0),
            period3Amount: Math.abs(r.period3Amount ?? 0),
          }))
        subLedger = { type: 'payables', data: topVendors }
      } else if (subLower.includes('inventory')) {
        const items = await client.listItems({
          $select: 'number,displayName,inventory,unitCost,unitPrice,itemCategoryCode',
          $orderby: 'inventory desc',
          $top: 15,
        })
        subLedger = {
          type: 'inventory',
          data: items
            .filter((i: any) => (i.inventory ?? 0) > 0)
            .slice(0, 10)
            .map((i: any) => ({
              number: i.number || '',
              name: i.displayName || '',
              quantity: i.inventory ?? 0,
              unitCost: i.unitCost ?? 0,
              totalValue: Math.round((i.inventory ?? 0) * (i.unitCost ?? 0) * 100) / 100,
              category: i.itemCategoryCode || '',
            })),
        }
      }
    } catch (subLedgerError) {
      logger.warn('[account-detail] Sub-ledger fetch failed', {
        organizationId,
        accountNumber,
        subCategory,
        error: subLedgerError instanceof Error ? subLedgerError.message : String(subLedgerError),
      })
      // Sub-ledger is optional — continue with null
    }

    const currency = credentials.home_currency || credentials.currency || 'USD'

    logger.info('[account-detail] Account detail fetched', {
      organizationId,
      accountNumber,
      category,
      subCategory,
      glEntryCount: glEntries.length,
      periodEntryCount: periodEntries.length,
      subLedgerType: subLedger.type,
      durationMs: Date.now() - t0,
    })

    return NextResponse.json({
      data: {
        accountNumber,
        accountName: null, // caller already has this
        category,
        subCategory,
        flow,
        monthlyTrend,
        recentTransactions,
        transactionCount: periodEntries.length,
        subLedger,
        currency,
      },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    logger.error('[account-detail] Failed', {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - t0,
    })
    return NextResponse.json(
      {
        error: 'Failed to fetch account detail',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
