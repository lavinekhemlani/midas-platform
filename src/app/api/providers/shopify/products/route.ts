import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'
import type {
  ShopifyProductEnriched,
  ShopifyProductTagSales,
  ShopifyOrder,
} from '@/lib/providers/shopify/types'

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const [allProducts, totalCount] = await Promise.all([
      client.getProducts(),
      client.getProductsCount(),
    ])

    // Filter by created_at date range if provided
    const products =
      startDate || endDate
        ? allProducts.filter((p) => {
            if (!p.created_at) return true
            const created = p.created_at.slice(0, 10)
            if (startDate && created < startDate) return false
            if (endDate && created > endDate) return false
            return true
          })
        : allProducts

    // Compute stats
    const activeCount = products.filter((p) => p.status === 'active').length
    const draftCount = products.filter((p) => p.status === 'draft').length
    const archivedCount = products.filter((p) => p.status === 'archived').length
    const totalVariants = products.reduce((sum, p) => sum + (p.variants?.length || 0), 0)
    const productTypes = [...new Set(products.map((p) => p.product_type).filter(Boolean))]
    const vendors = [...new Set(products.map((p) => p.vendor).filter(Boolean))]

    // ── Enrichment: fetch orders + inventory for revenue, stock, weeks cover ──
    let enriched: ShopifyProductEnriched[] | undefined
    let salesByTag: ShopifyProductTagSales[] | undefined
    let totalRevenue = 0
    let totalUnitsSold = 0
    let currency = 'USD'

    try {
      // Fetch orders for the last 90 days (or date range) to compute revenue/units
      const orderParams: Record<string, string> = { limit: '250', status: 'any' }
      const now = new Date()
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      orderParams.created_at_min = ninetyDaysAgo.toISOString()

      const [allOrders, locations, inventoryLevelsRaw] = await Promise.all([
        client.getOrders(orderParams),
        client.getLocations(),
        // We'll fetch inventory per location below
        Promise.resolve([] as any[]),
      ])

      const orders: ShopifyOrder[] = allOrders.filter((o) => o.cancelled_at === null && !o.test)
      currency = orders[0]?.currency || 'USD'

      // Fetch inventory levels for all locations
      const inventoryByLocation = new Map<number, Map<number, number>>() // locationId -> (inventoryItemId -> available)
      const locationNames = new Map<number, string>()
      for (const loc of locations) {
        locationNames.set(loc.id, loc.name)
        try {
          const levels = await client.getInventoryLevels(String(loc.id))
          const locMap = new Map<number, number>()
          for (const level of levels) {
            locMap.set(level.inventory_item_id, level.available ?? 0)
          }
          inventoryByLocation.set(loc.id, locMap)
        } catch {
          // Skip location if inventory fetch fails
        }
      }

      // Build product variant -> inventory_item_id map
      const variantInventoryMap = new Map<number, number>() // productId -> total stock
      const variantItemIds = new Map<number, number[]>() // productId -> inventory_item_ids
      for (const product of allProducts) {
        let totalStock = 0
        const itemIds: number[] = []
        for (const v of product.variants || []) {
          if (v.inventory_item_id) {
            itemIds.push(v.inventory_item_id)
            // Sum across all locations
            for (const [, locMap] of inventoryByLocation) {
              totalStock += locMap.get(v.inventory_item_id) ?? 0
            }
          }
        }
        variantInventoryMap.set(product.id, totalStock)
        variantItemIds.set(product.id, itemIds)
      }

      // Aggregate revenue and units sold per product from orders
      const productRevenue = new Map<number, number>()
      const productUnits = new Map<number, number>()
      const weeksInRange = 90 / 7 // 90-day window

      for (const order of orders) {
        for (const li of order.line_items) {
          if (!li.product_id) continue
          productRevenue.set(
            li.product_id,
            (productRevenue.get(li.product_id) || 0) + parseFloat(li.price) * li.quantity
          )
          productUnits.set(li.product_id, (productUnits.get(li.product_id) || 0) + li.quantity)
        }
      }

      // Compute totals
      for (const [, rev] of productRevenue) totalRevenue += rev
      for (const [, units] of productUnits) totalUnitsSold += units

      // Build tag map
      const productTagMap = new Map<number, string[]>()
      for (const product of allProducts) {
        const tags = (product.tags || '')
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean)
        productTagMap.set(product.id, tags)
      }

      // Build enriched data per product
      enriched = allProducts.map((product) => {
        const revenue = productRevenue.get(product.id) || 0
        const unitsSold = productUnits.get(product.id) || 0
        const totalStock = variantInventoryMap.get(product.id) || 0
        const avgWeeklySales = unitsSold / weeksInRange
        const weeksCover = avgWeeklySales > 0 ? totalStock / avgWeeklySales : null
        const tags = productTagMap.get(product.id) || []

        // Stock by location with risk assessment
        const itemIds = variantItemIds.get(product.id) || []
        const stockByLocation = Array.from(locationNames.entries()).map(([locId, locName]) => {
          const locMap = inventoryByLocation.get(locId)
          let available = 0
          for (const itemId of itemIds) {
            available += locMap?.get(itemId) ?? 0
          }
          const locWeeksCover = avgWeeklySales > 0 ? available / avgWeeklySales : null
          let risk: 'out_of_stock' | 'critical' | 'low' | 'healthy' = 'healthy'
          if (available <= 0) risk = 'out_of_stock'
          else if (locWeeksCover !== null && locWeeksCover < 2) risk = 'critical'
          else if (locWeeksCover !== null && locWeeksCover < 4) risk = 'low'
          return {
            locationName: locName,
            available,
            weeksCover: locWeeksCover !== null ? Math.round(locWeeksCover * 10) / 10 : null,
            risk,
          }
        })

        return {
          productId: product.id,
          revenue: Math.round(revenue * 100) / 100,
          unitsSold,
          totalStock,
          avgWeeklySales: Math.round(avgWeeklySales * 10) / 10,
          weeksCover: weeksCover !== null ? Math.round(weeksCover * 10) / 10 : null,
          tags,
          stockByLocation,
        }
      })

      // Aggregate sales by tag
      const tagSalesMap = new Map<
        string,
        { revenue: number; unitsSold: number; productIds: Set<number> }
      >()
      for (const e of enriched) {
        for (const tag of e.tags) {
          if (!tagSalesMap.has(tag))
            tagSalesMap.set(tag, { revenue: 0, unitsSold: 0, productIds: new Set() })
          const m = tagSalesMap.get(tag)!
          m.revenue += e.revenue
          m.unitsSold += e.unitsSold
          m.productIds.add(e.productId)
        }
      }
      salesByTag = Array.from(tagSalesMap.entries())
        .map(([tag, m]) => ({
          tag,
          revenue: Math.round(m.revenue * 100) / 100,
          unitsSold: m.unitsSold,
          productCount: m.productIds.size,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20)
    } catch {
      // Enrichment failed — return basic data
    }

    return NextResponse.json({
      data: {
        products,
        summary: {
          totalCount: products.length,
          activeCount,
          draftCount,
          archivedCount,
          totalVariants,
          productTypes,
          vendors,
          totalRevenue: totalRevenue > 0 ? Math.round(totalRevenue * 100) / 100 : undefined,
          totalUnitsSold: totalUnitsSold > 0 ? totalUnitsSold : undefined,
          currency,
        },
        ...(enriched && { enriched }),
        ...(salesByTag && salesByTag.length > 0 && { salesByTag }),
      },
    })
  } catch (error) {
    console.error('Shopify products error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Shopify products', details: (error as Error).message },
      { status: 500 }
    )
  }
})
