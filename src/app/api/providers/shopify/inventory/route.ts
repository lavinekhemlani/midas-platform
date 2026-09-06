import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'
import type { ShopifyInventoryLevel } from '@/lib/providers/shopify/types'

interface EnrichedInventoryLevel extends ShopifyInventoryLevel {
  productTitle?: string
  variantTitle?: string
  sku?: string
  unitCost?: number | null
  costCurrency?: string
  onHand?: number
  committed?: number
  incoming?: number
}

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    // Get locations first
    const locations = await client.getLocations()

    // Get inventory levels for each location
    const inventoryByLocation = await Promise.all(
      locations.map(async (location) => {
        const levels: EnrichedInventoryLevel[] = await client.getInventoryLevels(
          String(location.id)
        )
        return {
          location: {
            id: location.id,
            name: location.name,
            address: location.address1,
            city: location.city,
            country: location.country_name,
            active: location.active,
          },
          levels,
          totalItems: levels.length,
          totalAvailable: levels.reduce((sum, l) => sum + (l.available || 0), 0),
          totalOnHand: undefined as number | undefined,
          totalCommitted: undefined as number | undefined,
          inventoryValue: undefined as number | undefined,
        }
      })
    )

    // Get products to map inventory item IDs to product names
    const products = await client.getProducts()
    const variantMap = new Map<
      number,
      { productTitle: string; variantTitle: string; sku: string }
    >()
    for (const product of products) {
      for (const variant of product.variants || []) {
        variantMap.set(variant.inventory_item_id, {
          productTitle: product.title,
          variantTitle: variant.title === 'Default Title' ? '' : variant.title,
          sku: variant.sku || '',
        })
      }
    }

    // Enrich inventory levels with product info
    for (const loc of inventoryByLocation) {
      loc.levels = loc.levels.map((level) => ({
        ...level,
        ...(variantMap.get(level.inventory_item_id) || {}),
      }))
    }

    // Fetch GraphQL inventory data for cost and quantity states (graceful degradation)
    let graphQLMap: Map<
      number,
      {
        unitCost: number | null
        costCurrency: string
        levelsByLocationGid: Map<string, { onHand: number; committed: number; incoming: number }>
      }
    > | null = null

    try {
      const graphQLItems = await client.getInventoryItemsGraphQL()
      graphQLMap = new Map()

      for (const item of graphQLItems) {
        // Parse numeric ID from GID (e.g. "gid://shopify/InventoryItem/12345" -> 12345)
        const numericId = parseInt(item.id.split('/').pop() || '', 10)
        if (isNaN(numericId)) continue

        const unitCost = item.unitCost ? parseFloat(item.unitCost.amount) : null
        const costCurrency = item.unitCost?.currencyCode || ''

        const levelsByLocationGid = new Map<
          string,
          { onHand: number; committed: number; incoming: number }
        >()

        for (const edge of item.inventoryLevels.edges) {
          const level = edge.node
          const locationGid = level.location.id

          const getQuantity = (name: string) =>
            level.quantities.find((q) => q.name === name)?.quantity ?? 0

          levelsByLocationGid.set(locationGid, {
            onHand: getQuantity('on_hand'),
            committed: getQuantity('committed'),
            incoming: getQuantity('incoming'),
          })
        }

        graphQLMap.set(numericId, { unitCost, costCurrency, levelsByLocationGid })
      }
    } catch (graphQLError) {
      console.warn('GraphQL inventory fetch failed, using REST data only:', graphQLError)
    }

    // Merge GraphQL data into enriched inventory levels
    if (graphQLMap) {
      for (const loc of inventoryByLocation) {
        const locationGid = `gid://shopify/Location/${loc.location.id}`
        let locOnHand = 0
        let locCommitted = 0
        let locValue = 0

        loc.levels = loc.levels.map((level) => {
          const gqlData = graphQLMap!.get(level.inventory_item_id)
          if (!gqlData) return level

          const locationQuantities = gqlData.levelsByLocationGid.get(locationGid)
          const onHand = locationQuantities?.onHand ?? 0
          const committed = locationQuantities?.committed ?? 0
          const incoming = locationQuantities?.incoming ?? 0

          locOnHand += onHand
          locCommitted += committed
          if (gqlData.unitCost != null) {
            locValue += gqlData.unitCost * onHand
          }

          return {
            ...level,
            unitCost: gqlData.unitCost,
            costCurrency: gqlData.costCurrency,
            onHand,
            committed,
            incoming,
          }
        })

        loc.totalOnHand = locOnHand
        loc.totalCommitted = locCommitted
        loc.inventoryValue = locValue
      }
    }

    const totalLocations = locations.length
    const totalTrackedItems = inventoryByLocation.reduce((sum, loc) => sum + loc.totalItems, 0)
    const totalAvailableUnits = inventoryByLocation.reduce(
      (sum, loc) => sum + loc.totalAvailable,
      0
    )

    // Compute GraphQL-enriched summary stats
    let totalOnHand: number | undefined
    let totalCommitted: number | undefined
    let totalIncoming: number | undefined
    let totalInventoryValue: number | undefined
    let lowStockCount: number | undefined
    let outOfStockCount: number | undefined
    let costCurrency: string | undefined

    if (graphQLMap) {
      totalOnHand = 0
      totalCommitted = 0
      totalIncoming = 0
      totalInventoryValue = 0
      lowStockCount = 0
      outOfStockCount = 0

      for (const loc of inventoryByLocation) {
        for (const level of loc.levels) {
          const enriched = level as EnrichedInventoryLevel
          totalOnHand! += enriched.onHand ?? 0
          totalCommitted! += enriched.committed ?? 0
          totalIncoming! += enriched.incoming ?? 0

          if (enriched.unitCost != null && enriched.onHand != null) {
            totalInventoryValue! += enriched.unitCost * enriched.onHand
          }

          const available = level.available || 0
          if (available > 0 && available < 10) {
            lowStockCount!++
          }
          if (available <= 0) {
            outOfStockCount!++
          }

          if (!costCurrency && enriched.costCurrency) {
            costCurrency = enriched.costCurrency
          }
        }
      }
    }

    // Per-product demand forecast using ShopifyQL sales data
    let demandForecast: Array<{
      productTitle: string
      available: number
      onHand: number
      incoming: number
      unitsSold30d: number
      dailyVelocity: number
      forecast7d: number
      forecast30d: number
      daysOfStock: number | null
      status: 'critical' | 'warning' | 'healthy' | 'out_of_stock' | 'no_demand'
      dailySales?: number[]
      variantsTotal: number
      variantsInStock: number
      variantsOutOfStock: number
      // Demand analytics
      weightedVelocity: number
      forecastBaseVelocity: number
      trendSlope: number
      demandTrend: 'accelerating' | 'decelerating' | 'stable'
      demandVariability: number
      stdDevDailyDemand: number
      safetyStock: number
      reorderPoint: number
      weeklyForecast: number[]
      unitCost: number | null
    }> = []

    // Demand analytics using Holt-Winters Double Exponential Smoothing
    // DES separates level (smoothed value) and trend (smoothed rate of change)
    // Forecast at horizon h: F(h) = level + h × trend
    function computeDemandAnalytics(dailySales: number[], available: number) {
      const n = dailySales.length
      if (n < 3) {
        const mean = n > 0 ? dailySales.reduce((s, v) => s + v, 0) / n : 0
        return {
          weightedVelocity: mean,
          forecastBaseVelocity: mean,
          trendSlope: 0,
          demandTrend: 'stable' as const,
          demandVariability: 0,
          stdDevDailyDemand: 0,
          safetyStock: 0,
          reorderPoint: 0,
          trendAdjustedDaysOfStock: mean > 0 ? Math.round(available / mean) : null,
          trendAdjustedForecast7d: Math.round(mean * 7),
          // Weekly demand forecast: 8 weeks, each = mean * 7
          weeklyForecast: Array(8).fill(Math.round(mean * 7 * 10) / 10),
        }
      }

      // Aggregate daily sales into weekly buckets for smoothing
      // Weekly aggregation reduces noise from zero-sale days
      const weeklySales: number[] = []
      for (let i = 0; i < n; i += 7) {
        const weekSlice = dailySales.slice(i, Math.min(i + 7, n))
        const weekSum = weekSlice.reduce((s, v) => s + v, 0)
        // Normalize partial weeks
        weeklySales.push(weekSum * (7 / weekSlice.length))
      }
      const nw = weeklySales.length

      // Basic daily statistics (from raw daily data)
      const mean = dailySales.reduce((s, v) => s + v, 0) / n
      const variance = dailySales.reduce((s, v) => s + (v - mean) ** 2, 0) / n
      const stdDev = Math.sqrt(variance)
      const cv = mean > 0 ? stdDev / mean : 0

      // --- Holt-Winters Double Exponential Smoothing on weekly data ---
      // α (alpha): level smoothing factor (0-1). Higher = more reactive to recent data
      // β (beta): trend smoothing factor (0-1). Higher = faster trend adaptation
      const alpha = 0.3
      const beta = 0.1

      // Initialize: level = first week, trend = average weekly change over first few weeks
      let level = weeklySales[0]
      const initPeriod = Math.min(4, nw - 1)
      let trend = 0
      if (initPeriod > 0) {
        for (let i = 0; i < initPeriod; i++) {
          trend += weeklySales[i + 1] - weeklySales[i]
        }
        trend /= initPeriod
      }

      // Run DES through all weekly observations
      for (let t = 1; t < nw; t++) {
        const prevLevel = level
        const prevTrend = trend
        // Level update: α × observed + (1-α) × (prevLevel + prevTrend)
        level = alpha * weeklySales[t] + (1 - alpha) * (prevLevel + prevTrend)
        // Trend update: β × (level - prevLevel) + (1-β) × prevTrend
        trend = beta * (level - prevLevel) + (1 - beta) * prevTrend
      }

      // Generate 8-week forecast: F(h) = level + h × trend
      const weeklyForecast: number[] = []
      for (let h = 1; h <= 8; h++) {
        weeklyForecast.push(Math.max(0, Math.round((level + h * trend) * 100) / 100))
      }

      // Convert DES results back to daily equivalents for compatibility
      const forecastBaseVelocity = Math.max(0, level / 7)
      const dailyTrend = trend / 7
      const weightedVelocity = forecastBaseVelocity // DES level IS the weighted velocity

      // Trend classification
      const weeklyChangePercent = level > 0 ? Math.abs(trend) / level : 0
      const demandTrend: 'accelerating' | 'decelerating' | 'stable' =
        weeklyChangePercent < 0.03 ? 'stable' : trend > 0 ? 'accelerating' : 'decelerating'

      // Safety stock: Z × σ_daily × √(leadTime)
      const estimatedLeadTimeDays = 7
      const serviceZ = 1.65 // 95% service level
      const safetyStock = Math.ceil(serviceZ * stdDev * Math.sqrt(estimatedLeadTimeDays))

      // Reorder point
      const reorderPoint = Math.ceil(forecastBaseVelocity * estimatedLeadTimeDays + safetyStock)

      // Days until stockout using DES forecast
      let cumulativeDemand = 0
      let trendAdjustedDaysOfStock: number | null = null
      for (let d = 1; d <= 365; d++) {
        const dayDemand = Math.max(0, forecastBaseVelocity + dailyTrend * d)
        cumulativeDemand += dayDemand
        if (cumulativeDemand >= available) {
          trendAdjustedDaysOfStock = d
          break
        }
      }
      if (
        trendAdjustedDaysOfStock === null &&
        cumulativeDemand > 0 &&
        cumulativeDemand < available
      ) {
        trendAdjustedDaysOfStock = null
      }

      // 7-day forecast
      let forecast7dSum = 0
      for (let d = 1; d <= 7; d++) {
        forecast7dSum += Math.max(0, forecastBaseVelocity + dailyTrend * d)
      }

      // 30-day forecast: sum first 4 weeks from DES + remaining ~2 days extrapolated
      const forecast30dSum =
        weeklyForecast.slice(0, 4).reduce((s, v) => s + v, 0) +
        Math.max(0, (forecastBaseVelocity + dailyTrend * 30) * 2)

      return {
        weightedVelocity: Math.round(weightedVelocity * 1000) / 1000,
        forecastBaseVelocity: Math.round(forecastBaseVelocity * 1000) / 1000,
        trendSlope: Math.round(dailyTrend * 100000) / 100000,
        demandTrend,
        demandVariability: Math.round(cv * 100) / 100,
        stdDevDailyDemand: Math.round(stdDev * 1000) / 1000,
        safetyStock,
        reorderPoint,
        trendAdjustedDaysOfStock,
        trendAdjustedForecast7d: Math.round(forecast7dSum * 10) / 10,
        trendAdjustedForecast30d: Math.round(forecast30dSum * 10) / 10,
        // trendAdjustedForecast7d: Math.round(forecast7dSum),
        weeklyForecast,
      }
    }

    // Per-product daily sales history for burn-down chart
    let dailySalesByProduct: Record<string, number[]> = {}

    try {
      // Get per-product daily UNITS sold for the last year (for trend analysis + chart history)
      // Uses net_quantity (not orders) — counts actual units, not order count
      // Frontend slices to last 30 days for chart display; full year gives better regression/velocity
      const dailyResult = await client.shopifyqlQuery(
        'FROM sales SHOW net_quantity GROUP BY product_title TIMESERIES day SINCE -1y UNTIL today'
      )
      if (dailyResult.rows?.length) {
        // Build case-insensitive column lookup
        const dColMap: Record<string, number> = {}
        const dColMapLower: Record<string, number> = {}
        dailyResult.columns.forEach((c: any, i: number) => {
          dColMap[c.name] = i
          dColMapLower[c.name.toLowerCase()] = i
        })
        // Day/time column: match day, date, time_period, period
        const dayCol = dailyResult.columns.findIndex((c: any) =>
          /day|date|time|period/i.test(c.name)
        )
        // Product title column: try multiple common names
        const titleCol =
          dColMap['product_title'] ??
          dColMapLower['product_title'] ??
          dColMapLower['product'] ??
          dColMapLower['title'] ??
          dColMapLower['product_name']
        // Quantity column: try multiple common names
        const qtyCol =
          dColMap['net_quantity'] ??
          dColMapLower['net_quantity'] ??
          dColMapLower['ordered_product_quantity'] ??
          dColMapLower['orders'] ??
          dColMapLower['units_sold'] ??
          dColMapLower['quantity']

        if (dayCol >= 0 && titleCol != null && qtyCol != null) {
          // Group by product, ordered by date
          const byProduct = new Map<string, Map<string, number>>()
          for (const row of dailyResult.rows) {
            const title = String(row[titleCol] || '')
            const date = String(row[dayCol] || '').slice(0, 10)
            const qty = Math.max(0, parseInt(String(row[qtyCol] || '0'), 10))
            if (!title || !date) continue
            if (!byProduct.has(title)) byProduct.set(title, new Map())
            byProduct.get(title)!.set(date, qty)
          }
          // Convert to sorted daily arrays
          for (const [title, dateMap] of byProduct) {
            const sorted = [...dateMap.entries()].sort(([a], [b]) => a.localeCompare(b))
            dailySalesByProduct[title] = sorted.map(([, v]) => v)
          }
        }
      }
    } catch {
      // Daily timeseries not available — chart will use simulated history
    }

    try {
      // Get units sold per product in the last 30 days (FROM inventory dataset — same as sell-through)
      const salesResult = await client.shopifyqlQuery(
        'FROM inventory SHOW inventory_units_sold, ending_inventory_units WHERE inventory_is_tracked = true GROUP BY product_title ORDER BY inventory_units_sold DESC LIMIT 100 SINCE -30d UNTIL today'
      )

      if (salesResult.rows?.length) {
        const colMap: Record<string, number> = {}
        salesResult.columns.forEach((c: any, i: number) => {
          colMap[c.name] = i
        })

        // Build normalized product title → total available/onHand/incoming from inventory
        // Normalize: trim + lowercase to handle string mismatches between datasets
        const normalize = (s: string) => s.trim().toLowerCase()
        const stockByProduct = new Map<
          string,
          {
            available: number
            onHand: number
            incoming: number
            displayTitle: string
            variantsTotal: number
            variantsInStock: number
            variantsOutOfStock: number
            unitCostSum: number
            unitCostCount: number
          }
        >()
        const variantSeen = new Map<string, Set<number>>()
        for (const loc of inventoryByLocation) {
          for (const level of loc.levels) {
            const enriched = level as EnrichedInventoryLevel
            const title = enriched.productTitle
            if (!title) continue
            const key = normalize(title)
            const existing = stockByProduct.get(key) || {
              available: 0,
              onHand: 0,
              incoming: 0,
              displayTitle: title,
              variantsTotal: 0,
              variantsInStock: 0,
              variantsOutOfStock: 0,
              unitCostSum: 0,
              unitCostCount: 0,
            }
            existing.available += level.available || 0
            existing.onHand += enriched.onHand ?? 0
            existing.incoming += enriched.incoming ?? 0
            if (enriched.unitCost != null) {
              existing.unitCostSum += enriched.unitCost
              existing.unitCostCount++
            }

            // Count unique variants once (same variant at multiple locations counted once)
            if (!variantSeen.has(key)) variantSeen.set(key, new Set())
            const seen = variantSeen.get(key)!
            if (!seen.has(level.inventory_item_id)) {
              seen.add(level.inventory_item_id)
              existing.variantsTotal++
              if ((level.available || 0) > 0) existing.variantsInStock++
              else existing.variantsOutOfStock++
            }

            stockByProduct.set(key, existing)
          }
        }

        // Also normalize dailySalesByProduct keys
        const normalizedDailySales: Record<string, number[]> = {}
        for (const [title, sales] of Object.entries(dailySalesByProduct)) {
          normalizedDailySales[normalize(title)] = sales
        }

        for (const row of salesResult.rows) {
          const rawTitle = String(row[colMap['product_title']] || '')
          if (!rawTitle) continue
          const productKey = normalize(rawTitle)

          const unitsSold30d = parseInt(String(row[colMap['inventory_units_sold']] || '0'), 10)
          // Compute velocity from full daily sales history (up to 1 year) for better accuracy
          const productDailySales = normalizedDailySales[productKey]
          const totalSalesFromHistory = productDailySales
            ? productDailySales.reduce((s, v) => s + v, 0)
            : unitsSold30d
          const totalDays = productDailySales ? productDailySales.length : 30
          // Use total sales / total calendar days for true average daily demand
          // This correctly predicts depletion timeline
          const dailyVelocity = totalSalesFromHistory / Math.max(totalDays, 7)
          // Also compute recent 30-day velocity for comparison
          const recent30Sales = productDailySales
            ? productDailySales.slice(-30).reduce((s, v) => s + v, 0)
            : unitsSold30d
          const recentVelocity = recent30Sales / 30

          const stock = stockByProduct.get(productKey) || {
            available: 0,
            onHand: 0,
            incoming: 0,
            displayTitle: rawTitle,
            variantsTotal: 0,
            variantsInStock: 0,
            variantsOutOfStock: 0,
            unitCostSum: 0,
            unitCostCount: 0,
          }
          const productTitle = stock.displayTitle

          // Compute demand analytics from daily sales history
          const productDailySalesArr = normalizedDailySales[productKey] || []

          // Use the higher of long-term or recent velocity for forecasting
          const effectiveVelocity = Math.max(dailyVelocity, recentVelocity)

          // If daily sales unavailable, synthesize from velocity so DES has data to work with
          const salesForAnalytics =
            productDailySalesArr.length >= 7
              ? productDailySalesArr
              : effectiveVelocity > 0
                ? Array.from({ length: 90 }, () => effectiveVelocity)
                : productDailySalesArr
          const analytics = computeDemandAnalytics(salesForAnalytics, stock.available)

          // DES always runs now (on real data or synthesized from velocity)
          const forecast7d = analytics.trendAdjustedForecast7d
          const forecast30d = analytics.trendAdjustedForecast30d
          const daysOfStock = analytics.trendAdjustedDaysOfStock

          let status: (typeof demandForecast)[number]['status']
          if (stock.available <= 0) status = 'out_of_stock'
          else if (effectiveVelocity === 0) status = 'no_demand'
          else if (daysOfStock !== null && daysOfStock < 7) status = 'critical'
          else if (daysOfStock !== null && daysOfStock < 14) status = 'warning'
          else status = 'healthy'

          demandForecast.push({
            productTitle,
            available: stock.available,
            onHand: stock.onHand,
            incoming: stock.incoming,
            unitsSold30d,
            dailyVelocity: Math.round(Math.max(dailyVelocity, recentVelocity) * 1000) / 1000,
            forecast7d,
            forecast30d,
            daysOfStock,
            status,
            dailySales: normalizedDailySales[productKey],
            variantsTotal: stock.variantsTotal,
            variantsInStock: stock.variantsInStock,
            variantsOutOfStock: stock.variantsOutOfStock,
            // Demand analytics
            weightedVelocity: analytics.weightedVelocity,
            forecastBaseVelocity: analytics.forecastBaseVelocity,
            trendSlope: analytics.trendSlope,
            demandTrend: analytics.demandTrend,
            demandVariability: analytics.demandVariability,
            stdDevDailyDemand: analytics.stdDevDailyDemand,
            safetyStock: analytics.safetyStock,
            reorderPoint: analytics.reorderPoint,
            weeklyForecast: analytics.weeklyForecast,
            unitCost:
              stock.unitCostCount > 0
                ? Math.round((stock.unitCostSum / stock.unitCostCount) * 100) / 100
                : null,
          })
        }

        // Sort: critical first (needs attention), then warning, healthy, out_of_stock, no_demand last
        const statusOrder = { critical: 0, warning: 1, healthy: 2, out_of_stock: 3, no_demand: 4 }
        demandForecast.sort(
          (a, b) =>
            statusOrder[a.status] - statusOrder[b.status] || b.dailyVelocity - a.dailyVelocity
        )
      }
    } catch {
      // ShopifyQL not available — skip demand forecast
    }

    return NextResponse.json({
      data: {
        inventoryByLocation,
        summary: {
          totalLocations,
          totalTrackedItems,
          totalAvailableUnits,
          totalOnHand,
          totalCommitted,
          totalIncoming,
          totalInventoryValue,
          lowStockCount,
          outOfStockCount,
          costCurrency,
        },
        demandForecast,
      },
    })
  } catch (error) {
    console.error('Shopify inventory error:', error)
    return NextResponse.json({ error: 'Failed to fetch Shopify inventory' }, { status: 500 })
  }
})
