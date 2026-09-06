import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'

/**
 * GET /api/providers/dynamics/inventory-enhanced
 *
 * Production inventory endpoint — fetches items, categories, ledger entries,
 * and locations from BC, then computes all metrics needed by the dashboard
 * visualization components.
 *
 * Query params:
 *   connectionId  — BC OAuth connection ID
 *   startDate     — period start (YYYY-MM-DD) for movement / turnover analysis
 *   endDate       — period end (YYYY-MM-DD) for movement / turnover analysis
 */

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

    // ── Warm-up: single request to refresh token before parallel fetches ──
    let companyName: string | null = credentials.company_name || null
    let currency = credentials.currency || 'USD'
    try {
      const companyInfo = await client.query('companyInformation', { $top: 1 })
      const info = companyInfo.value?.[0]
      if (info) {
        companyName = info.displayName || info.name || companyName
        currency = info.currencyCode || currency
      }
    } catch {
      // warm-up failed — continue with credential values
    }

    // Decode BC OData encoded strings: _xHHHH_ → char
    function decodeOData(s: string): string {
      return s.replace(/_x([0-9a-fA-F]{4})_/gi, (_, hex: string) =>
        String.fromCharCode(parseInt(hex, 16))
      )
    }

    // ── Parallel data fetches ──
    // Fetch ALL ledger entries (unfiltered) for accurate cost valuation,
    // plus date-filtered entries for movement/turnover analysis.
    // Also attempt ODataWS ledger fetch to get locationCode for per-location stats.
    const hasDateFilter = !!(startDate && endDate)
    const [
      itemsResult,
      categoriesResult,
      allLedgerResult,
      filteredLedgerResult,
      locationsResult,
      odataWSLedgerResult,
    ] = await Promise.allSettled([
      client.listItems(),
      client.queryAll('itemCategories'),
      // All ledger entries — used to compute accurate inventory value via costAmountActual
      client.queryAll('itemLedgerEntries'),
      // Date-filtered ledger entries — used for movement trend & turnover analysis
      (async () => {
        if (!hasDateFilter) return [] as any[]
        const filters: string[] = []
        if (startDate) filters.push(`postingDate ge ${startDate}`)
        if (endDate) filters.push(`postingDate le ${endDate}`)
        return client.queryAll('itemLedgerEntries', { $filter: filters.join(' and ') })
      })(),
      client.queryAll('locations'),
      // ODataWS Item Ledger Entries — exposes Location_Code which standard API v2.0 doesn't
      (async () => {
        const wsEntityNames = [
          'ILE_Web_Service',
          'ILEWebService',
          'ILE',
          'ItemLedgerEntries',
          'Item_Ledger_Entries',
          'Item_Ledger_Entry',
        ]
        for (const entityName of wsEntityNames) {
          try {
            const wsParams: any = {}
            if (hasDateFilter) {
              const wsFilters: string[] = []
              if (startDate) wsFilters.push(`Posting_Date ge ${startDate}`)
              if (endDate) wsFilters.push(`Posting_Date le ${endDate}`)
              wsParams.$filter = wsFilters.join(' and ')
            }
            const entries = await client.queryODataWS(entityName, wsParams)
            if (entries.length > 0) {
              console.log(
                `[inventory-enhanced] OData WS '${entityName}' succeeded — ${entries.length} entries with Location_Code`
              )
              return entries
            }
          } catch {
            // Entity name not published, try next
          }
        }
        return [] as any[]
      })(),
    ])

    const allItems: any[] = itemsResult.status === 'fulfilled' ? itemsResult.value : []
    const allCategories: any[] =
      categoriesResult.status === 'fulfilled' ? categoriesResult.value : []
    const allLedgerEntriesFull: any[] =
      allLedgerResult.status === 'fulfilled' ? allLedgerResult.value : []
    // For movement/turnover: use date-filtered entries if available, otherwise all entries
    const allLedgerEntries: any[] = hasDateFilter
      ? filteredLedgerResult.status === 'fulfilled'
        ? filteredLedgerResult.value
        : []
      : allLedgerEntriesFull
    const allLocations: any[] = locationsResult.status === 'fulfilled' ? locationsResult.value : []
    // ODataWS ledger entries with locationCode — used for per-location stats
    const odataWSLedgerRaw: any[] =
      odataWSLedgerResult.status === 'fulfilled' ? odataWSLedgerResult.value : []
    // Normalize ODataWS entries to standard field names
    const odataWSLedger = odataWSLedgerRaw.map((e: any) => ({
      itemNumber: e.itemNumber || e.Item_No || '',
      postingDate: e.postingDate || e.Posting_Date || '',
      entryType: decodeOData(e.entryType || e.Entry_Type || ''),
      quantity: e.quantity ?? e.Quantity ?? 0,
      costAmountActual: e.costAmountActual ?? e.Cost_Amount_Actual ?? e.Cost_Amount__Actual_ ?? 0,
      salesAmountActual:
        e.salesAmountActual ?? e.Sales_Amount_Actual ?? e.Sales_Amount__Actual_ ?? 0,
      locationCode: e.locationCode || e.Location_Code || '',
    }))

    // ── Build per-item cost valuation from ALL ledger entries ──
    // Sum costAmountActual per item across all entries (purchases +, sales -, adjustments ±).
    // This matches how BC's Inventory Valuation report (Report 1001) computes value
    // using Cost Amount (Actual) from value entries, rather than qty × unitCost.
    const costByItem: Record<string, number> = {}
    for (const entry of allLedgerEntriesFull) {
      const itemNum = entry.itemNumber || ''
      if (!itemNum) continue
      costByItem[itemNum] = (costByItem[itemNum] ?? 0) + (entry.costAmountActual ?? 0)
    }
    // Helper: get accurate inventory value for an item
    const getItemValue = (item: any): number => {
      const itemNo = item.number || ''
      // Use ledger-based cost if available, fall back to qty × unitCost
      if (itemNo in costByItem) return costByItem[itemNo]
      return (item.inventory ?? 0) * (item.unitCost ?? 0)
    }

    // ══════════════════════════════════════════════════════════════════════
    // Server-side computations
    // ══════════════════════════════════════════════════════════════════════

    // ── Overview stats ──
    const totalItems = allItems.length
    const itemsWithStock = allItems.filter((i: any) => (i.inventory ?? 0) > 0).length
    const totalUnits = allItems.reduce((s: number, i: any) => s + (i.inventory ?? 0), 0)
    const totalInventoryValue = allItems.reduce((s: number, i: any) => s + getItemValue(i), 0)
    const averageUnitCost = totalUnits > 0 ? totalInventoryValue / totalUnits : 0

    const overview = {
      total_items: totalItems,
      items_with_stock: itemsWithStock,
      total_inventory_value: Math.round(totalInventoryValue * 100) / 100,
      total_units_on_hand: totalUnits,
      average_unit_cost: Math.round(averageUnitCost * 100) / 100,
    }

    // ── By category ──
    const categoryMap: Record<string, { total_value: number; item_count: number }> = {}
    for (const item of allItems) {
      const cat = item.itemCategoryCode || 'Uncategorized'
      if (!categoryMap[cat]) categoryMap[cat] = { total_value: 0, item_count: 0 }
      categoryMap[cat].item_count++
      categoryMap[cat].total_value += getItemValue(item)
    }
    const byCategory = Object.entries(categoryMap)
      .map(([code, data]) => ({ item_category_code: code, ...data }))
      .sort((a, b) => b.total_value - a.total_value)

    // ── Movement trend (grouped by month + entryType) ──
    const movementMap: Record<
      string,
      Record<string, { total_quantity: number; total_cost: number; entry_count: number }>
    > = {}
    for (const entry of allLedgerEntries) {
      const month = (entry.postingDate || '').substring(0, 7) // YYYY-MM
      if (!month) continue
      const entryType = entry.entryType || 'Unknown'
      if (!movementMap[month]) movementMap[month] = {}
      if (!movementMap[month][entryType]) {
        movementMap[month][entryType] = { total_quantity: 0, total_cost: 0, entry_count: 0 }
      }
      movementMap[month][entryType].total_quantity += Math.abs(entry.quantity ?? 0)
      movementMap[month][entryType].total_cost += Math.abs(entry.costAmountActual ?? 0)
      movementMap[month][entryType].entry_count++
    }
    const movementTrend: Array<{
      month: string
      entry_type: string
      total_quantity: number
      total_cost: number
      entry_count: number
    }> = []
    for (const [month, types] of Object.entries(movementMap)) {
      for (const [entryType, data] of Object.entries(types)) {
        movementTrend.push({
          month,
          entry_type: entryType,
          total_quantity: Math.round(data.total_quantity * 100) / 100,
          total_cost: Math.round(data.total_cost * 100) / 100,
          entry_count: data.entry_count,
        })
      }
    }
    movementTrend.sort(
      (a, b) => a.month.localeCompare(b.month) || a.entry_type.localeCompare(b.entry_type)
    )

    // ── Turnover ──
    let turnover: {
      cogs_annual: number
      average_inventory: number
      current_inventory: number
      turnover_ratio: number
      days_inventory_outstanding: number
    } | null = null

    if (startDate && endDate && totalInventoryValue > 0) {
      const periodDays =
        (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
      const annualizationFactor = periodDays > 0 ? 365 / periodDays : 1

      // COGS = sum of costAmountActual for Sale-type entries (absolute values)
      const cogsPeriod = allLedgerEntries
        .filter((e: any) => e.entryType === 'Sale')
        .reduce((s: number, e: any) => s + Math.abs(e.costAmountActual ?? 0), 0)

      const cogsAnnual = cogsPeriod * annualizationFactor
      const averageInventory = totalInventoryValue // use current as proxy
      const turnoverRatio = averageInventory > 0 ? cogsAnnual / averageInventory : 0
      const dio = turnoverRatio > 0 ? 365 / turnoverRatio : 0

      turnover = {
        cogs_annual: Math.round(cogsAnnual * 100) / 100,
        average_inventory: Math.round(averageInventory * 100) / 100,
        current_inventory: Math.round(totalInventoryValue * 100) / 100,
        turnover_ratio: Math.round(turnoverRatio * 100) / 100,
        days_inventory_outstanding: Math.round(dio),
      }
    }

    // ── Slow-moving items ──
    // Use ALL ledger entries (unfiltered) for last-sale date tracking so we get
    // the true most-recent sale, not just sales within the date range.
    const lastSaleByItem: Record<string, string> = {} // itemNumber → most recent postingDate
    for (const entry of allLedgerEntriesFull) {
      if ((entry.entryType || '') !== 'Sale') continue
      const itemNum = entry.itemNumber || ''
      if (!itemNum) continue
      const date = entry.postingDate || ''
      if (!lastSaleByItem[itemNum] || date > lastSaleByItem[itemNum]) {
        lastSaleByItem[itemNum] = date
      }
    }
    // Use date-filtered entries for period-specific sales/purchase quantities (turnover analysis)
    const salesQtyByItem: Record<string, number> = {}
    const purchasesQtyByItem: Record<string, number> = {}
    for (const entry of allLedgerEntries) {
      const itemNum = entry.itemNumber || ''
      if (!itemNum) continue
      const entryType = entry.entryType || ''
      if (entryType === 'Sale') {
        salesQtyByItem[itemNum] = (salesQtyByItem[itemNum] ?? 0) + Math.abs(entry.quantity ?? 0)
      } else if (entryType === 'Purchase') {
        purchasesQtyByItem[itemNum] =
          (purchasesQtyByItem[itemNum] ?? 0) + Math.abs(entry.quantity ?? 0)
      }
    }

    const now = new Date()
    const slowMovingItems = allItems
      .filter((i: any) => (i.inventory ?? 0) > 0)
      .map((i: any) => {
        const itemNo = i.number || ''
        const inv = i.inventory ?? 0
        const uc = i.unitCost ?? 0
        const invValue = getItemValue(i)
        const salesQty = salesQtyByItem[itemNo] ?? 0
        const purchasesQty = purchasesQtyByItem[itemNo] ?? 0
        const lastSale = lastSaleByItem[itemNo] || null
        const daysSinceLastSale = lastSale
          ? Math.round((now.getTime() - new Date(lastSale).getTime()) / (1000 * 60 * 60 * 24))
          : null
        // Annualized turnover ratio for this item
        const periodDays =
          startDate && endDate
            ? (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
            : 365
        const annFactor = periodDays > 0 ? 365 / periodDays : 1
        const itemTurnover = invValue > 0 ? (salesQty * uc * annFactor) / invValue : 0

        return {
          item_no: itemNo,
          description: i.displayName || itemNo,
          inventory: inv,
          unit_cost: uc,
          inventory_value: Math.round(invValue * 100) / 100,
          sales_qty: salesQty,
          purchases_qty: purchasesQty,
          turnover_ratio: Math.round(itemTurnover * 100) / 100,
          days_since_last_sale: daysSinceLastSale,
        }
      })
      // Sort: items with no sales first (null = highest risk), then by days descending
      .sort((a, b) => {
        if (a.days_since_last_sale === null && b.days_since_last_sale === null)
          return b.inventory_value - a.inventory_value
        if (a.days_since_last_sale === null) return -1
        if (b.days_since_last_sale === null) return 1
        return b.days_since_last_sale - a.days_since_last_sale
      })
      .slice(0, 20)

    const zeroSalesItems = slowMovingItems.filter((i) => i.days_since_last_sale === null)
    const slowMovingSummary = {
      totalItems: slowMovingItems.length,
      totalValue:
        Math.round(slowMovingItems.reduce((s, i) => s + i.inventory_value, 0) * 100) / 100,
      zeroSalesCount: zeroSalesItems.length,
      zeroSalesValue:
        Math.round(zeroSalesItems.reduce((s, i) => s + i.inventory_value, 0) * 100) / 100,
    }

    // ── Top items by value ──
    const topItemsByValue = [...allItems]
      .sort((a: any, b: any) => getItemValue(b) - getItemValue(a))
      .slice(0, 10)
      .map((i: any) => {
        const invValue = getItemValue(i)
        return {
          item_no: i.number || '',
          description: i.displayName || i.number || '',
          inventory: i.inventory ?? 0,
          unit_cost: i.unitCost ?? 0,
          inventory_value: Math.round(invValue * 100) / 100,
          item_category_code: i.itemCategoryCode || 'Uncategorized',
          percentage:
            totalInventoryValue > 0
              ? Math.round((invValue / totalInventoryValue) * 10000) / 100
              : 0,
        }
      })

    // ── Per-location inventory stats (from ledger entries) ──
    // Prefer ODataWS entries (which have Location_Code) over standard API entries.
    // Fall back to standard API entries in case a custom API page exposes locationCode.
    const locationStatsSource = odataWSLedger.length > 0 ? odataWSLedger : allLedgerEntries
    const locationStatsSourceLabel = odataWSLedger.length > 0 ? 'odata_ws' : 'api_v2'
    const locationStats: Record<
      string,
      {
        totalQty: number
        totalCost: number
        salesQty: number
        salesCost: number
        purchasesQty: number
        purchasesCost: number
        entryCount: number
        itemNumbers: Set<string>
      }
    > = {}
    for (const entry of locationStatsSource) {
      const locCode = entry.locationCode || ''
      if (!locCode) continue
      if (!locationStats[locCode]) {
        locationStats[locCode] = {
          totalQty: 0,
          totalCost: 0,
          salesQty: 0,
          salesCost: 0,
          purchasesQty: 0,
          purchasesCost: 0,
          entryCount: 0,
          itemNumbers: new Set(),
        }
      }
      const stats = locationStats[locCode]
      const qty = entry.quantity ?? 0
      const cost = Math.abs(entry.costAmountActual ?? 0)
      const entryType = (entry.entryType || '').toLowerCase()
      stats.totalQty += qty
      stats.totalCost += cost
      stats.entryCount++
      if (entry.itemNumber) stats.itemNumbers.add(entry.itemNumber)
      if (entryType.includes('sale') || entryType.includes('negative')) {
        stats.salesQty += Math.abs(qty)
        stats.salesCost += cost
      } else if (entryType.includes('purchase') || entryType.includes('positive')) {
        stats.purchasesQty += Math.abs(qty)
        stats.purchasesCost += cost
      }
    }

    // ── Locations ──
    const locations = allLocations.map((loc: any) => {
      const code = loc.code || ''
      const stats = locationStats[code]
      return {
        code,
        name: loc.displayName || loc.name || loc.code || '',
        address: loc.addressLine1 || loc.address?.street || loc.address || '',
        addressLine2: loc.addressLine2 || '',
        city: loc.city || loc.address?.city || '',
        state: loc.state || loc.address?.state || '',
        country: loc.countryRegionCode || loc.country || loc.address?.countryLetterCode || '',
        postalCode: loc.postalCode || '',
        contact: loc.contact || '',
        phoneNumber: loc.phoneNumber || '',
        email: loc.email || '',
        website: loc.website || '',
        inventory_stats: stats
          ? {
              net_quantity: Math.round(stats.totalQty * 100) / 100,
              total_cost: Math.round(stats.totalCost * 100) / 100,
              sales_qty: Math.round(stats.salesQty * 100) / 100,
              sales_cost: Math.round(stats.salesCost * 100) / 100,
              purchases_qty: Math.round(stats.purchasesQty * 100) / 100,
              purchases_cost: Math.round(stats.purchasesCost * 100) / 100,
              entry_count: stats.entryCount,
              unique_items: stats.itemNumbers.size,
            }
          : null,
      }
    })
    const locationStatsAvailable = Object.keys(locationStats).length > 0

    // ── Categories list (enhanced) ──
    const categoryTotalUnits: Record<string, number> = {}
    for (const item of allItems) {
      const cat = item.itemCategoryCode || 'Uncategorized'
      categoryTotalUnits[cat] = (categoryTotalUnits[cat] ?? 0) + (item.inventory ?? 0)
    }
    const categories = byCategory.map((cat) => {
      const catDesc = allCategories.find((c: any) => c.code === cat.item_category_code)
      const totalUnitsInCat = categoryTotalUnits[cat.item_category_code] ?? 0
      return {
        code: cat.item_category_code,
        description: catDesc?.displayName || catDesc?.description || cat.item_category_code,
        item_count: cat.item_count,
        total_value: Math.round(cat.total_value * 100) / 100,
        total_units: totalUnitsInCat,
        percentage_of_total_value:
          totalInventoryValue > 0
            ? Math.round((cat.total_value / totalInventoryValue) * 10000) / 100
            : 0,
        avg_unit_cost:
          totalUnitsInCat > 0 ? Math.round((cat.total_value / totalUnitsInCat) * 100) / 100 : 0,
      }
    })

    // ── ABC Classification (Pareto analysis) ──
    // Sort items by inventory_value desc, compute cumulative % of total
    // A = top 80% of value, B = next 15%, C = remaining 5%
    const itemsByValue = allItems
      .map((i: any) => ({
        item_no: i.number || '',
        inventory_value: getItemValue(i),
      }))
      .sort((a, b) => b.inventory_value - a.inventory_value)

    const abcMap: Record<string, 'A' | 'B' | 'C'> = {}
    let cumulativeValue = 0
    for (const item of itemsByValue) {
      cumulativeValue += item.inventory_value
      const cumulativePct = totalInventoryValue > 0 ? cumulativeValue / totalInventoryValue : 1
      if (cumulativePct <= 0.8) {
        abcMap[item.item_no] = 'A'
      } else if (cumulativePct <= 0.95) {
        abcMap[item.item_no] = 'B'
      } else {
        abcMap[item.item_no] = 'C'
      }
    }

    const abcClassification = {
      A: { count: 0, totalValue: 0, percentage: 0 },
      B: { count: 0, totalValue: 0, percentage: 0 },
      C: { count: 0, totalValue: 0, percentage: 0 },
    }
    for (const item of itemsByValue) {
      const cls = abcMap[item.item_no] || 'C'
      abcClassification[cls].count++
      abcClassification[cls].totalValue += item.inventory_value
    }
    for (const cls of ['A', 'B', 'C'] as const) {
      abcClassification[cls].totalValue = Math.round(abcClassification[cls].totalValue * 100) / 100
      abcClassification[cls].percentage =
        totalInventoryValue > 0
          ? Math.round((abcClassification[cls].totalValue / totalInventoryValue) * 10000) / 100
          : 0
    }

    // ── Stock Health Scoring ──
    // For each item with stock > 0, score 0-100 across 4 dimensions
    const healthScores: number[] = []
    const healthItemMap: Record<string, number> = {}
    for (const item of allItems) {
      const inv = item.inventory ?? 0
      if (inv <= 0) continue
      const itemNo = item.number || ''
      const uc = item.unitCost ?? 0
      const invValue = getItemValue(item)
      const salesQty = salesQtyByItem[itemNo] ?? 0
      const lastSale = lastSaleByItem[itemNo] || null
      const daysSinceSale = lastSale
        ? Math.round((now.getTime() - new Date(lastSale).getTime()) / (1000 * 60 * 60 * 24))
        : null
      const periodDays =
        startDate && endDate
          ? (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
          : 365
      const annFactor = periodDays > 0 ? 365 / periodDays : 1
      const itemTurnover = invValue > 0 ? (salesQty * uc * annFactor) / invValue : 0
      const abcClass = abcMap[itemNo] || 'C'

      // Turnover contribution (0-30 pts)
      let turnoverScore = 6
      if (itemTurnover >= 8) turnoverScore = 30
      else if (itemTurnover >= 5) turnoverScore = 22
      else if (itemTurnover >= 2) turnoverScore = 14

      // Sales recency (0-30 pts)
      let recencyScore = 0
      if (daysSinceSale !== null) {
        if (daysSinceSale < 30) recencyScore = 30
        else if (daysSinceSale < 90) recencyScore = 22
        else if (daysSinceSale < 180) recencyScore = 14
      }

      // Stock availability (0-20 pts)
      const availScore = salesQty > 0 ? 20 : 5

      // Value tier (0-20 pts)
      let tierScore = 8
      if (abcClass === 'A') tierScore = 20
      else if (abcClass === 'B') tierScore = 14

      const score = turnoverScore + recencyScore + availScore + tierScore
      healthScores.push(score)
      healthItemMap[itemNo] = score
    }

    const avgHealthScore =
      healthScores.length > 0
        ? Math.round((healthScores.reduce((s, v) => s + v, 0) / healthScores.length) * 10) / 10
        : 0
    const stockHealth = {
      averageScore: avgHealthScore,
      distribution: {
        excellent: healthScores.filter((s) => s >= 80).length,
        good: healthScores.filter((s) => s >= 60 && s < 80).length,
        fair: healthScores.filter((s) => s >= 40 && s < 60).length,
        poor: healthScores.filter((s) => s < 40).length,
      },
    }

    // ── Full Items List (allItems) ──
    // Return ALL items with every computed field for client-side filtering
    const fullItemsList = allItems.map((i: any) => {
      const itemNo = i.number || ''
      const inv = i.inventory ?? 0
      const uc = i.unitCost ?? 0
      const up = i.unitPrice ?? 0
      const invValue = getItemValue(i)
      const salesQty = salesQtyByItem[itemNo] ?? 0
      const purchasesQty = purchasesQtyByItem[itemNo] ?? 0
      const lastSale = lastSaleByItem[itemNo] || null
      const daysSinceLastSale = lastSale
        ? Math.round((now.getTime() - new Date(lastSale).getTime()) / (1000 * 60 * 60 * 24))
        : null
      const periodDays =
        startDate && endDate
          ? (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
          : 365
      const annFactor = periodDays > 0 ? 365 / periodDays : 1
      const itemTurnover = invValue > 0 ? (salesQty * uc * annFactor) / invValue : 0
      const catDesc = allCategories.find((c: any) => c.code === i.itemCategoryCode)

      return {
        item_no: itemNo,
        description: i.displayName || itemNo,
        inventory: inv,
        unit_cost: uc,
        unit_price: up,
        inventory_value: Math.round(invValue * 100) / 100,
        item_category_code: i.itemCategoryCode || 'Uncategorized',
        category_name:
          catDesc?.displayName || catDesc?.description || i.itemCategoryCode || 'Uncategorized',
        type: i.type || '',
        blocked: i.blocked ?? false,
        base_uom: i.baseUnitOfMeasureCode || '',
        abc_class: abcMap[itemNo] || 'C',
        health_score: healthItemMap[itemNo] ?? 0,
        sales_qty: salesQty,
        purchases_qty: purchasesQty,
        days_since_last_sale: daysSinceLastSale,
        turnover_ratio: Math.round(itemTurnover * 100) / 100,
      }
    })

    return NextResponse.json({
      data: {
        overview,
        byCategory,
        movementTrend,
        turnover,
        slowMoving: {
          items: slowMovingItems,
          summary: slowMovingSummary,
        },
        topItemsByValue,
        totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
        locations,
        locationStatsSource: locationStatsSourceLabel,
        locationStatsAvailable,
        categories,
        abcClassification,
        stockHealth,
        allItems: fullItemsList,
        companyName,
        currency,
        itemCount: allItems.length,
        ledgerEntryCount: allLedgerEntries.length,
      },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch inventory data',
        details: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - t0,
      },
      { status: 500 }
    )
  }
})
