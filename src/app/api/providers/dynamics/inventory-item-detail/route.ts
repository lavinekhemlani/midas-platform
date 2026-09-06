import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'

/**
 * GET /api/providers/dynamics/inventory-item-detail
 *
 * Per-item detail endpoint — fetches a single item, its ledger entries,
 * and default dimensions from BC, then computes monthly movement breakdown.
 *
 * Query params:
 *   connectionId  — BC OAuth connection ID
 *   itemNumber    — the BC item number to fetch
 *   startDate     — period start (YYYY-MM-DD)
 *   endDate       — period end (YYYY-MM-DD)
 */

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  const t0 = Date.now()

  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const itemNumber = url.searchParams.get('itemNumber')
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined

    if (!itemNumber) {
      return NextResponse.json({ error: 'itemNumber is required' }, { status: 400 })
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

    // ── Parallel fetches: item, ledger entries, dimensions ──
    const ledgerFilter: string[] = [`itemNumber eq '${itemNumber}'`]
    if (startDate) ledgerFilter.push(`postingDate ge ${startDate}`)
    if (endDate) ledgerFilter.push(`postingDate le ${endDate}`)

    const hasDateFilter = !!(startDate && endDate)

    const [itemResult, ledgerResult, allLedgerResult, dimensionsResult] = await Promise.allSettled([
      client.queryAll('items', { $filter: `number eq '${itemNumber}'` }),
      // Date-filtered ledger entries — used for movement trend & period stats
      client.queryAll('itemLedgerEntries', { $filter: ledgerFilter.join(' and ') }),
      // ALL ledger entries (no date filter) — used for accurate cost valuation
      // Only fetch separately when a date filter is applied; otherwise the above already has everything
      hasDateFilter
        ? client.queryAll('itemLedgerEntries', {
            $filter: `itemNumber eq '${itemNumber}'`,
          })
        : Promise.resolve([] as any[]),
      client
        .queryAll('defaultDimensions', {
          $filter: `parentId eq ${itemNumber}`,
        })
        .catch(() => []), // dimensions may not be available
    ])

    const items: any[] = itemResult.status === 'fulfilled' ? itemResult.value : []
    const item = items[0] || null
    const ledgerEntries: any[] = ledgerResult.status === 'fulfilled' ? ledgerResult.value : []
    // For valuation: use all-time entries when date-filtered, otherwise the main fetch is already unfiltered
    const allTimeLedgerEntries: any[] = hasDateFilter
      ? allLedgerResult.status === 'fulfilled'
        ? allLedgerResult.value
        : []
      : ledgerEntries
    const dimensions: any[] = dimensionsResult.status === 'fulfilled' ? dimensionsResult.value : []

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // ── Process ledger entries ──
    const processedEntries = ledgerEntries.map((e: any) => ({
      entryNumber: e.entryNumber ?? e.entryNo ?? 0,
      postingDate: e.postingDate || '',
      entryType: e.entryType || '',
      sourceNumber: e.sourceNumber || e.sourceNo || '',
      sourceType: e.sourceType || '',
      documentNumber: e.documentNumber || e.documentNo || '',
      documentType: e.documentType || '',
      description: e.description || '',
      quantity: e.quantity ?? 0,
      salesAmountActual: e.salesAmountActual ?? 0,
      costAmountActual: e.costAmountActual ?? 0,
    }))

    // ── Monthly movement breakdown ──
    const monthlyMap: Record<
      string,
      {
        purchases_qty: number
        purchases_cost: number
        sales_qty: number
        sales_cost: number
        positive_adjustments_cost: number
        negative_adjustments_cost: number
        transfers_cost: number
      }
    > = {}

    for (const entry of ledgerEntries) {
      const month = (entry.postingDate || '').substring(0, 7)
      if (!month) continue
      if (!monthlyMap[month]) {
        monthlyMap[month] = {
          purchases_qty: 0,
          purchases_cost: 0,
          sales_qty: 0,
          sales_cost: 0,
          positive_adjustments_cost: 0,
          negative_adjustments_cost: 0,
          transfers_cost: 0,
        }
      }
      const entryType = (entry.entryType || '').toLowerCase()
      const qty = Math.abs(entry.quantity ?? 0)
      const cost = Math.abs(entry.costAmountActual ?? 0)

      if (entryType.includes('purchase')) {
        monthlyMap[month].purchases_qty += qty
        monthlyMap[month].purchases_cost += cost
      } else if (entryType.includes('sale')) {
        monthlyMap[month].sales_qty += qty
        monthlyMap[month].sales_cost += cost
      } else if (entryType.includes('positive')) {
        monthlyMap[month].positive_adjustments_cost += cost
      } else if (entryType.includes('negative')) {
        monthlyMap[month].negative_adjustments_cost += cost
      } else if (entryType.includes('transfer')) {
        monthlyMap[month].transfers_cost += cost
      }
    }

    const movementByMonth = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        purchases_qty: Math.round(data.purchases_qty * 100) / 100,
        purchases_cost: Math.round(data.purchases_cost * 100) / 100,
        sales_qty: Math.round(data.sales_qty * 100) / 100,
        sales_cost: Math.round(data.sales_cost * 100) / 100,
        positive_adjustments_cost: Math.round(data.positive_adjustments_cost * 100) / 100,
        negative_adjustments_cost: Math.round(data.negative_adjustments_cost * 100) / 100,
        transfers_cost: Math.round(data.transfers_cost * 100) / 100,
      }))

    // ── Summary stats ──
    let totalPurchased = 0
    let totalSold = 0
    let netMovement = 0
    let firstTransaction: string | null = null
    let lastTransaction: string | null = null

    for (const entry of ledgerEntries) {
      const entryType = (entry.entryType || '').toLowerCase()
      const qty = entry.quantity ?? 0
      if (entryType.includes('purchase')) {
        totalPurchased += Math.abs(qty)
      } else if (entryType.includes('sale')) {
        totalSold += Math.abs(qty)
      }
      netMovement += qty

      const date = entry.postingDate || ''
      if (date) {
        if (!firstTransaction || date < firstTransaction) firstTransaction = date
        if (!lastTransaction || date > lastTransaction) lastTransaction = date
      }
    }

    // ── Ledger-based inventory valuation ──
    // Sum costAmountActual across ALL ledger entries (purchases +, sales -, adjustments ±).
    // This matches BC's Inventory Valuation report (Report 1001) and the dashboard card values.
    const ledgerBasedValue = allTimeLedgerEntries.reduce(
      (sum: number, e: any) => sum + (e.costAmountActual ?? 0),
      0
    )

    // ── Dimensions ──
    const processedDimensions = dimensions.map((d: any) => ({
      dimensionCode: d.dimensionCode || d.code || '',
      dimensionValueCode: d.dimensionValueCode || d.valueCode || '',
    }))

    return NextResponse.json({
      data: {
        item: {
          number: item.number || '',
          displayName: item.displayName || '',
          type: item.type || '',
          itemCategoryCode: item.itemCategoryCode || '',
          inventory: item.inventory ?? 0,
          unitCost: item.unitCost ?? 0,
          unitPrice: item.unitPrice ?? 0,
          blocked: item.blocked ?? false,
          baseUnitOfMeasureCode: item.baseUnitOfMeasureCode || '',
          gtin: item.gtin || '',
          lastModifiedDateTime: item.lastModifiedDateTime || '',
          generalProductPostingGroupCode: item.generalProductPostingGroupCode || '',
          inventoryPostingGroupCode: item.inventoryPostingGroupCode || '',
        },
        ledgerEntries: processedEntries,
        dimensions: processedDimensions,
        movementByMonth,
        ledgerBasedValue: Math.round(ledgerBasedValue * 100) / 100,
        totalPurchased: Math.round(totalPurchased * 100) / 100,
        totalSold: Math.round(totalSold * 100) / 100,
        netMovement: Math.round(netMovement * 100) / 100,
        firstTransaction,
        lastTransaction,
      },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch item detail',
        details: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - t0,
      },
      { status: 500 }
    )
  }
})
