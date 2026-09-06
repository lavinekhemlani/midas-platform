import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'

/**
 * GET /api/providers/dynamics/inventory-test
 *
 * Comprehensive inventory diagnostic — probes all inventory-related BC API entities,
 * discovers available fields, fetches sample data, and computes inventory metrics.
 *
 * Query params:
 *   connectionId  — BC OAuth connection ID
 *   startDate     — period start (YYYY-MM-DD) for movement analysis
 *   endDate       — period end (YYYY-MM-DD) for movement analysis
 */

interface EntityProbeResult {
  available: boolean
  count?: number
  fields?: string[]
  sampleRecord?: any
  error?: string
  durationMs: number
}

interface InventoryMetrics {
  totalItems: number
  totalUnits: number
  estimatedValue: number
  withStock: number
  outOfStock: number
  blocked: number
  byType: Record<string, number>
  byCategory: Array<{ category: string; count: number; totalUnits: number; totalValue: number }>
  topByValue: Array<{
    name: string
    number: string
    inventory: number
    unitCost: number
    totalValue: number
    category: string
    type: string
  }>
  topByQuantity: Array<{
    name: string
    number: string
    inventory: number
    unitCost: number
    category: string
  }>
}

interface MovementAnalysis {
  totalEntries: number
  entryTypes: Record<string, number>
  byMonth: Array<{ month: string; inbound: number; outbound: number; net: number }>
  topMovedItems: Array<{ itemNumber: string; itemName: string; totalIn: number; totalOut: number }>
  fields: string[]
}

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  const t0 = Date.now()

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

    // Warm up the token with a single request before firing parallel probes.
    // Without this, all parallel probes race to refresh the token simultaneously,
    // causing a thundering-herd of sequential lock-acquire → token-refresh cycles.
    await client.query('companyInformation', { $top: 1 })

    // ═══ Phase 1: Entity Probe ═══
    // Probe all inventory-related entities to discover availability and fields

    const inventoryEntities = [
      { name: 'items', description: 'Item master data' },
      { name: 'itemCategories', description: 'Item categories/groups' },
      { name: 'itemLedgerEntries', description: 'Item movement ledger entries' },
      { name: 'locations', description: 'Warehouse locations' },
      { name: 'itemVariants', description: 'Item variants (size, color, etc.)' },
      { name: 'unitsOfMeasure', description: 'Units of measure' },
      { name: 'salesInvoiceLines', description: 'Sales invoice line items' },
      { name: 'purchaseInvoiceLines', description: 'Purchase invoice line items' },
      { name: 'salesOrderLines', description: 'Sales order line items' },
      { name: 'purchaseOrderLines', description: 'Purchase order line items' },
      { name: 'salesCreditMemoLines', description: 'Sales credit memo lines' },
      { name: 'purchaseCreditMemoLines', description: 'Purchase credit memo lines' },
      { name: 'defaultDimensions', description: 'Default dimensions (for item dimensions)' },
    ]

    const probeResults: Record<string, EntityProbeResult & { description: string }> = {}

    await Promise.allSettled(
      inventoryEntities.map(async (entity) => {
        const et0 = Date.now()
        try {
          const res = await client.query(entity.name, { $top: 3 })
          const rows = res.value || []
          probeResults[entity.name] = {
            available: true,
            count: res['@odata.count'] ?? rows.length,
            fields: rows[0] ? Object.keys(rows[0]) : [],
            sampleRecord: rows[0] || null,
            description: entity.description,
            durationMs: Date.now() - et0,
          }
        } catch (err: any) {
          probeResults[entity.name] = {
            available: false,
            error: err.message?.slice(0, 200) || String(err),
            description: entity.description,
            durationMs: Date.now() - et0,
          }
        }
      })
    )

    const availableEntities = Object.entries(probeResults)
      .filter(([, v]) => v.available)
      .map(([k]) => k)
    const unavailableEntities = Object.entries(probeResults)
      .filter(([, v]) => !v.available)
      .map(([k]) => k)

    // ═══ Phase 2: Deep Item Analysis ═══
    // Full fetch of items for detailed metrics (only if items entity is available)

    let itemMetrics: InventoryMetrics | null = null
    let allItems: any[] = []

    if (probeResults.items?.available) {
      allItems = await client.listItems()

      const totalItems = allItems.length
      const totalUnits = allItems.reduce((s: number, i: any) => s + (i.inventory ?? 0), 0)
      const estimatedValue = allItems.reduce(
        (s: number, i: any) => s + (i.inventory ?? 0) * (i.unitCost ?? 0),
        0
      )
      const withStock = allItems.filter((i: any) => (i.inventory ?? 0) > 0).length
      const outOfStock = allItems.filter((i: any) => (i.inventory ?? 0) === 0 && !i.blocked).length
      const blocked = allItems.filter((i: any) => i.blocked).length

      // By type
      const byType: Record<string, number> = {}
      for (const item of allItems) {
        const type = item.type || 'Unknown'
        byType[type] = (byType[type] ?? 0) + 1
      }

      // By category
      const categoryMap: Record<string, { count: number; totalUnits: number; totalValue: number }> =
        {}
      for (const item of allItems) {
        const cat = item.itemCategoryCode || item.itemCategoryId || 'Uncategorized'
        if (!categoryMap[cat]) categoryMap[cat] = { count: 0, totalUnits: 0, totalValue: 0 }
        categoryMap[cat].count++
        categoryMap[cat].totalUnits += item.inventory ?? 0
        categoryMap[cat].totalValue += (item.inventory ?? 0) * (item.unitCost ?? 0)
      }
      const byCategory = Object.entries(categoryMap)
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.totalValue - a.totalValue)

      // Top items by value
      const topByValue = [...allItems]
        .sort(
          (a: any, b: any) =>
            (b.inventory ?? 0) * (b.unitCost ?? 0) - (a.inventory ?? 0) * (a.unitCost ?? 0)
        )
        .slice(0, 15)
        .map((i: any) => ({
          name: i.displayName || i.number,
          number: i.number,
          inventory: i.inventory ?? 0,
          unitCost: i.unitCost ?? 0,
          totalValue: (i.inventory ?? 0) * (i.unitCost ?? 0),
          category: i.itemCategoryCode || 'Uncategorized',
          type: i.type || 'Unknown',
        }))

      // Top items by quantity
      const topByQuantity = [...allItems]
        .sort((a: any, b: any) => (b.inventory ?? 0) - (a.inventory ?? 0))
        .slice(0, 15)
        .map((i: any) => ({
          name: i.displayName || i.number,
          number: i.number,
          inventory: i.inventory ?? 0,
          unitCost: i.unitCost ?? 0,
          category: i.itemCategoryCode || 'Uncategorized',
        }))

      itemMetrics = {
        totalItems,
        totalUnits,
        estimatedValue: Math.round(estimatedValue * 100) / 100,
        withStock,
        outOfStock,
        blocked,
        byType,
        byCategory,
        topByValue,
        topByQuantity,
      }
    }

    // ═══ Phase 3: Item Ledger Entries (Movement Analysis) ═══
    // If itemLedgerEntries is available, analyze movements for the given period

    let movementAnalysis: MovementAnalysis | null = null

    if (probeResults.itemLedgerEntries?.available) {
      try {
        const filters: string[] = []
        if (startDate) filters.push(`postingDate ge ${startDate}`)
        if (endDate) filters.push(`postingDate le ${endDate}`)

        const params: any = {}
        if (filters.length > 0) params.$filter = filters.join(' and ')

        const entries = await client.queryAll('itemLedgerEntries', params)

        // Analyze entry types
        const entryTypes: Record<string, number> = {}
        for (const entry of entries) {
          const type = entry.entryType || entry.documentType || 'Unknown'
          entryTypes[type] = (entryTypes[type] ?? 0) + 1
        }

        // Monthly movement analysis
        const monthlyMap: Record<string, { inbound: number; outbound: number }> = {}
        const itemMovements: Record<
          string,
          { itemNumber: string; totalIn: number; totalOut: number }
        > = {}

        for (const entry of entries) {
          const date = (entry.postingDate || '').substring(0, 7) // YYYY-MM
          if (!date) continue

          if (!monthlyMap[date]) monthlyMap[date] = { inbound: 0, outbound: 0 }

          const qty = entry.quantity ?? 0
          if (qty > 0) {
            monthlyMap[date].inbound += qty
          } else {
            monthlyMap[date].outbound += Math.abs(qty)
          }

          // Track per-item movements
          const itemNum = entry.itemNumber || entry.itemNo || ''
          if (itemNum) {
            if (!itemMovements[itemNum]) {
              itemMovements[itemNum] = { itemNumber: itemNum, totalIn: 0, totalOut: 0 }
            }
            if (qty > 0) itemMovements[itemNum].totalIn += qty
            else itemMovements[itemNum].totalOut += Math.abs(qty)
          }
        }

        const byMonth = Object.entries(monthlyMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, data]) => ({
            month,
            inbound: data.inbound,
            outbound: data.outbound,
            net: data.inbound - data.outbound,
          }))

        // Top moved items — build name lookup from allItems
        const itemNameMap = new Map<string, string>()
        for (const item of allItems) {
          if (item.number) itemNameMap.set(item.number, item.displayName || item.number)
        }

        const topMovedItems = Object.values(itemMovements)
          .sort((a, b) => b.totalIn + b.totalOut - (a.totalIn + a.totalOut))
          .slice(0, 15)
          .map((m) => ({
            ...m,
            itemName: itemNameMap.get(m.itemNumber) || m.itemNumber,
          }))

        movementAnalysis = {
          totalEntries: entries.length,
          entryTypes,
          byMonth,
          topMovedItems,
          fields: entries[0] ? Object.keys(entries[0]) : [],
        }
      } catch (err: any) {
        movementAnalysis = {
          totalEntries: 0,
          entryTypes: {},
          byMonth: [],
          topMovedItems: [],
          fields: [],
        }
      }
    }

    // ═══ Phase 4: Item Categories Detail ═══
    let itemCategories: any[] | null = null
    if (probeResults.itemCategories?.available) {
      try {
        itemCategories = await client.queryAll('itemCategories')
      } catch {
        itemCategories = null
      }
    }

    // ═══ Phase 5: Locations Detail ═══
    let locations: any[] | null = null
    if (probeResults.locations?.available) {
      try {
        locations = await client.queryAll('locations')
      } catch {
        locations = null
      }
    }

    // ═══ Phase 6: Turnover Calculation ═══
    // If we have both item metrics and movement data, compute turnover
    let turnoverAnalysis: any = null
    if (itemMetrics && movementAnalysis && startDate && endDate) {
      const periodDays =
        (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
      const annualizationFactor = periodDays > 0 ? 365 / periodDays : 1

      // Total outbound (sales/consumption) in period
      const totalOutbound = movementAnalysis.byMonth.reduce((s, m) => s + m.outbound, 0)
      const annualizedOutbound = totalOutbound * annualizationFactor

      // Average inventory value (rough: current value as proxy)
      const avgInventoryValue = itemMetrics.estimatedValue

      // Inventory turnover = annualized COGS (outbound * avg unit cost) / avg inventory value
      // Simplified: outbound units / current units on hand
      const inventoryTurnover =
        itemMetrics.totalUnits > 0 ? annualizedOutbound / itemMetrics.totalUnits : null

      // Days inventory outstanding
      const dio = inventoryTurnover && inventoryTurnover > 0 ? 365 / inventoryTurnover : null

      // Slow-moving items (no outbound movement in the period)
      const movedItemNumbers = new Set(
        movementAnalysis.topMovedItems.filter((m) => m.totalOut > 0).map((m) => m.itemNumber)
      )
      // Build full set of moved item numbers from entries
      const allMovedOutItems = new Set<string>()
      // We need to check all items, not just top — build from the movement map
      // Since we only have topMovedItems, approximate with what we have
      for (const m of movementAnalysis.topMovedItems) {
        if (m.totalOut > 0) allMovedOutItems.add(m.itemNumber)
      }

      const slowMovingItems = allItems
        .filter((i: any) => (i.inventory ?? 0) > 0 && !allMovedOutItems.has(i.number))
        .map((i: any) => ({
          name: i.displayName || i.number,
          number: i.number,
          inventory: i.inventory ?? 0,
          value: (i.inventory ?? 0) * (i.unitCost ?? 0),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15)

      turnoverAnalysis = {
        periodDays: Math.round(periodDays),
        totalOutboundUnits: totalOutbound,
        annualizedOutbound: Math.round(annualizedOutbound),
        inventoryTurnover:
          inventoryTurnover !== null ? Math.round(inventoryTurnover * 100) / 100 : null,
        daysInventoryOutstanding: dio !== null ? Math.round(dio) : null,
        slowMovingItemCount: slowMovingItems.length,
        slowMovingItems,
      }
    }

    // ═══ Compile Response ═══

    const companyName = credentials.company_name || null
    const currency = credentials.currency || 'USD'

    return NextResponse.json({
      data: {
        entityProbe: {
          available: availableEntities,
          unavailable: unavailableEntities,
          details: probeResults,
        },
        itemMetrics,
        movementAnalysis,
        itemCategories,
        locations,
        turnoverAnalysis,
        companyName,
        currency,
      },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Inventory diagnostic failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - t0,
      },
      { status: 500 }
    )
  }
})
