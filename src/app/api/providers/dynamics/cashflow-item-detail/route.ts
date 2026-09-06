import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

/**
 * GET /api/providers/dynamics/cashflow-item-detail
 *
 * Returns granular detail for a cash flow statement line item.
 * Unlike balance sheet (single account), cash flow items aggregate
 * across multiple accounts by subcategory (e.g. all receivable accounts
 * for "Change in Accounts Receivable").
 *
 * Query params:
 *   connectionId — BC OAuth connection ID
 *   itemType     — cash flow item identifier (ar-change, ap-change, inventory-change, etc.)
 *   startDate    — period start (YYYY-MM-DD)
 *   endDate      — period end (YYYY-MM-DD)
 */

// Map cash flow item IDs to account subcategory matching patterns
const ITEM_TYPE_CONFIG: Record<
  string,
  {
    label: string
    category: string // Assets | Liabilities | Equity | Income | Expense
    subPatterns: string[] // subcategory patterns to match (case-insensitive includes)
    subLedgerType?: 'receivables' | 'payables' | 'inventory' | 'bank'
  }
> = {
  'ar-change': {
    label: 'Change in Accounts Receivable',
    category: 'Assets',
    subPatterns: ['receivable'],
    subLedgerType: 'receivables',
  },
  'ap-change': {
    label: 'Change in Accounts Payable',
    category: 'Liabilities',
    subPatterns: ['payable'],
    subLedgerType: 'payables',
  },
  'inventory-change': {
    label: 'Change in Inventory',
    category: 'Assets',
    subPatterns: ['inventory'],
    subLedgerType: 'inventory',
  },
  depreciation: {
    label: 'Depreciation & Amortization',
    category: 'Assets',
    subPatterns: ['depreciation', 'amortization'],
  },
  'prepaid-change': {
    label: 'Change in Prepaid Expenses',
    category: 'Assets',
    subPatterns: ['prepaid'],
  },
  'accrued-change': {
    label: 'Change in Accrued Liabilities',
    category: 'Liabilities',
    subPatterns: ['accrued'],
  },
  'deferred-revenue-change': {
    label: 'Change in Deferred Revenue',
    category: 'Liabilities',
    subPatterns: ['deferred'],
  },
  capex: {
    label: 'Capital Expenditures',
    category: 'Assets',
    subPatterns: ['fixed', 'property', 'equipment', 'capital'],
  },
  'asset-sales': {
    label: 'Asset Sales',
    category: 'Assets',
    subPatterns: ['fixed', 'property', 'equipment'],
  },
  'debt-proceeds': {
    label: 'Debt Proceeds',
    category: 'Liabilities',
    subPatterns: ['long', 'loan', 'note', 'mortgage', 'bond'],
  },
  'debt-repayments': {
    label: 'Debt Repayments',
    category: 'Liabilities',
    subPatterns: ['long', 'loan', 'note', 'mortgage', 'bond'],
  },
  'equity-changes': {
    label: 'Equity Changes',
    category: 'Equity',
    subPatterns: ['equity', 'capital', 'retained', 'share', 'stock'],
  },
  'net-income': {
    label: 'Net Income',
    category: 'Income',
    subPatterns: [], // special case — uses Income + Expense categories
  },
}

function decodeOData(s: string): string {
  return s.replace(/_x([0-9a-f]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  const t0 = Date.now()

  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const itemType = url.searchParams.get('itemType')
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined

    if (!itemType) {
      return NextResponse.json({ error: 'itemType is required' }, { status: 400 })
    }

    const config = ITEM_TYPE_CONFIG[itemType]
    if (!config) {
      return NextResponse.json({ error: `Unknown itemType: ${itemType}` }, { status: 400 })
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

    // 1. Fetch accounts to find which ones match this cash flow item
    const allAccounts = await client.queryAll('accounts', {
      $select: 'number,displayName,accountType,category,subCategory',
    })

    // Filter to posting accounts matching the config
    const matchingAccounts = allAccounts.filter((acc: any) => {
      const accType = decodeOData(acc.accountType || '').toLowerCase()
      if (accType !== 'posting') return false

      const accCategory = decodeOData(acc.category || '').trim()
      const accSub = decodeOData(acc.subCategory || '').toLowerCase()
      const accName = (acc.displayName || '').toLowerCase()

      // Special case: net-income uses Income + COGS + Expense categories
      if (itemType === 'net-income') {
        return ['Income', 'Cost of Goods Sold', 'Expense'].includes(accCategory)
      }

      // Match by category + subcategory patterns
      if (config.category !== accCategory) return false
      if (config.subPatterns.length === 0) return true
      return config.subPatterns.some((p) => accSub.includes(p) || accName.includes(p))
    })

    const matchingAccountNumbers = new Set(matchingAccounts.map((a: any) => a.number))

    // 2. Fetch GL entries for the period for these accounts
    let glFilter = ''
    if (startDate && endDate) {
      glFilter = `postingDate ge ${startDate} and postingDate le ${endDate}`
    } else if (endDate) {
      glFilter = `postingDate le ${endDate}`
    }

    const glEntries = await client.listGeneralLedgerEntries({
      $filter: glFilter || undefined,
      $select:
        'accountNumber,debitAmount,creditAmount,postingDate,documentNumber,documentType,description',
      $orderby: 'postingDate desc',
    })

    // Filter to only matching accounts
    const relevantEntries = glEntries.filter((e: any) =>
      matchingAccountNumbers.has(e.accountNumber)
    )

    // 3. Compute per-account breakdown
    const accountBreakdown = new Map<
      string,
      { name: string; debit: number; credit: number; net: number; entryCount: number }
    >()
    for (const entry of relevantEntries) {
      const accNo = entry.accountNumber
      if (!accountBreakdown.has(accNo)) {
        const accInfo = matchingAccounts.find((a: any) => a.number === accNo)
        accountBreakdown.set(accNo, {
          name: accInfo?.displayName || accNo,
          debit: 0,
          credit: 0,
          net: 0,
          entryCount: 0,
        })
      }
      const acc = accountBreakdown.get(accNo)!
      acc.debit += entry.debitAmount ?? 0
      acc.credit += entry.creditAmount ?? 0
      acc.net += (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)
      acc.entryCount++
    }

    const accountsList = [...accountBreakdown.entries()]
      .map(([number, data]) => ({ number, ...data }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))

    // 4. Compute totals
    const totalDebit = relevantEntries.reduce((s: number, e: any) => s + (e.debitAmount ?? 0), 0)
    const totalCredit = relevantEntries.reduce((s: number, e: any) => s + (e.creditAmount ?? 0), 0)

    // 5. Monthly trend for this category
    const monthlyMap = new Map<string, number>()
    for (const entry of relevantEntries) {
      const month = (entry.postingDate || '').substring(0, 7)
      if (!month) continue
      const net = (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)
      monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + net)
    }
    const monthlyTrend = [...monthlyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }))

    // 6. All period transactions — frontend handles pagination
    const recentTransactions = relevantEntries.map((e: any) => ({
      postingDate: e.postingDate || '',
      accountNumber: e.accountNumber || '',
      documentNumber: e.documentNumber || '',
      documentType: e.documentType || '',
      description: e.description || '',
      debitAmount: e.debitAmount ?? 0,
      creditAmount: e.creditAmount ?? 0,
    }))

    // 7. Sub-ledger data (if applicable)
    let subLedger: { type: string | null; data: any[] } = { type: null, data: [] }
    try {
      if (config.subLedgerType === 'receivables') {
        const ar = await client.getAgedAccountsReceivable()
        subLedger = {
          type: 'receivables',
          data: ar.records
            .filter((r: any) => Math.abs(r.balanceDue ?? 0) > 0)
            .sort((a: any, b: any) => Math.abs(b.balanceDue ?? 0) - Math.abs(a.balanceDue ?? 0))
            .slice(0, 10)
            .map((r: any) => ({
              name: r.customerName || r.name || 'Unknown',
              number: r.customerNumber || '',
              balanceDue: r.balanceDue ?? 0,
              currentAmount: r.currentAmount ?? 0,
              period1Amount: r.period1Amount ?? 0,
              period2Amount: r.period2Amount ?? 0,
              period3Amount: r.period3Amount ?? 0,
            })),
        }
      } else if (config.subLedgerType === 'payables') {
        const ap = await client.getAgedAccountsPayable()
        subLedger = {
          type: 'payables',
          data: ap.records
            .filter((r: any) => Math.abs(r.balanceDue ?? 0) > 0)
            .sort((a: any, b: any) => Math.abs(b.balanceDue ?? 0) - Math.abs(a.balanceDue ?? 0))
            .slice(0, 10)
            .map((r: any) => ({
              name: r.vendorName || r.name || 'Unknown',
              number: r.vendorNumber || '',
              balanceDue: Math.abs(r.balanceDue ?? 0),
              currentAmount: Math.abs(r.currentAmount ?? 0),
              period1Amount: Math.abs(r.period1Amount ?? 0),
              period2Amount: Math.abs(r.period2Amount ?? 0),
              period3Amount: Math.abs(r.period3Amount ?? 0),
            })),
        }
      } else if (config.subLedgerType === 'inventory') {
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
    } catch (err) {
      logger.warn('[cashflow-item-detail] Sub-ledger fetch failed', {
        itemType,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    const currency = credentials.home_currency || credentials.currency || 'USD'

    logger.info('[cashflow-item-detail] Detail fetched', {
      organizationId,
      itemType,
      matchingAccounts: matchingAccounts.length,
      glEntryCount: relevantEntries.length,
      durationMs: Date.now() - t0,
    })

    return NextResponse.json({
      data: {
        itemType,
        label: config.label,
        category: config.category,
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        netAmount: Math.round((totalDebit - totalCredit) * 100) / 100,
        accountBreakdown: accountsList,
        monthlyTrend,
        recentTransactions,
        transactionCount: relevantEntries.length,
        subLedger,
        currency,
      },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    logger.error('[cashflow-item-detail] Failed', {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - t0,
    })
    return NextResponse.json(
      {
        error: 'Failed to fetch cash flow item detail',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
