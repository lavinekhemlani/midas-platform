import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'
import type {
  ShopifyDispute,
  ShopifyGraphQLInventoryItem,
  ShopifyTagPerformance,
  ShopifyTagTrendPoint,
  ShopifyTagReportingSummary,
  ShopifyTagReportingResponse,
  ShopifyTagComparisonData,
  ShopifyTagProduct,
} from '@/lib/providers/shopify/types'

/**
 * Shopify Tag-Based Product Reporting API route.
 *
 * Fetches orders with line items, resolves each line item's product tags,
 * and computes sales / units / refunds / discounts by tag.
 *
 * Double-counting strategy:
 *   By default, full attribution — each line item's revenue is attributed
 *   to ALL of its product's tags. This intentionally means the sum across
 *   tags will exceed total revenue. A clear note is shown in the UI.
 *   Optional ?attribution=fractional divides revenue by the number of tags.
 *
 * Query params:
 *   ?shop=domain              — target store
 *   ?startDate=YYYY-MM-DD     — filter start
 *   ?endDate=YYYY-MM-DD       — filter end
 *   ?attribution=full|fractional — how to handle multi-tag products (default: full)
 *   ?compareTags=tag1,tag2    — optional: compare specific tags over time
 */
export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const attribution = url.searchParams.get('attribution') === 'fractional' ? 'fractional' : 'full'
    const compareTags = url.searchParams
      .get('compareTags')
      ?.split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    // Determine aggregation granularity
    const rangeMs =
      startDate && endDate ? new Date(endDate).getTime() - new Date(startDate).getTime() : Infinity
    const rangeDays = rangeMs / (1000 * 60 * 60 * 24)
    const granularity: 'day' | 'week' | 'month' =
      rangeDays <= 31 ? 'day' : rangeDays <= 90 ? 'week' : 'month'

    function getGroupKey(dateStr: string): string {
      if (granularity === 'day') return dateStr.slice(0, 10)
      if (granularity === 'week') {
        const d = new Date(dateStr)
        const day = d.getUTCDay()
        const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1)
        const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff))
        return monday.toISOString().slice(0, 10)
      }
      return dateStr.slice(0, 7)
    }

    // Fetch orders and products in parallel
    const orderParams: Record<string, string> = { limit: '250', status: 'any' }
    if (startDate) {
      orderParams.created_at_min = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`
    }
    if (endDate) {
      orderParams.created_at_max = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`
    }

    // Disputes: fetch over the same window, but gracefully no-op on 403/missing scope
    const disputeParams: Record<string, string> = {}
    if (startDate) {
      disputeParams.initiated_at_min = startDate.includes('T')
        ? startDate
        : `${startDate}T00:00:00Z`
    }
    if (endDate) {
      disputeParams.initiated_at_max = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`
    }

    const [allOrders, allProducts, allDisputes, allInventoryItems] = await Promise.all([
      client.getOrders(orderParams),
      // Include variants so we can build an inventory_item_id → product map
      // for the inventory-exposure join below.
      client.getProducts({ limit: '250', fields: 'id,tags,title,image,variants' }),
      client
        .getDisputes(disputeParams)
        .then((d) => d as unknown as ShopifyDispute[])
        .catch((err: unknown) => {
          // 403: store isn't on Shopify Payments or scope missing — continue without disputes
          if (err instanceof Error && err.message?.includes('403')) return [] as ShopifyDispute[]
          console.warn('Shopify tags: disputes fetch failed', err)
          return [] as ShopifyDispute[]
        }),
      client.getInventoryItemsGraphQL(250).catch((err: unknown) => {
        console.warn('Shopify tags: inventory fetch failed', err)
        return [] as ShopifyGraphQLInventoryItem[]
      }),
    ])

    // Build product ID → tags lookup map + inventory_item_id → product ID map
    const productTagMap = new Map<number, string[]>()
    const inventoryItemToVariant = new Map<number, { productId: number }>()
    const allTagSet = new Set<string>()
    for (const product of allProducts) {
      const tags = (product.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      productTagMap.set(product.id, tags)
      tags.forEach((t) => allTagSet.add(t))

      for (const variant of product.variants || []) {
        if (variant.inventory_item_id) {
          inventoryItemToVariant.set(variant.inventory_item_id, { productId: product.id })
        }
      }
    }

    // Filter out cancelled/test orders
    const orders = allOrders.filter((o) => o.cancelled_at === null && !o.test)

    // Aggregate metrics by tag
    const tagMetrics = new Map<
      string,
      {
        grossSales: number
        netSales: number
        unitsSold: number
        orderIds: Set<number>
        refundAmount: number
        refundUnits: number
        discountAmount: number
        lineItemCount: number
        disputeIds: Set<number>
        disputeAmount: number
        inventoryValue: number
        inventoryUnits: number
      }
    >()

    // Tag trend data: groupKey → tag → { grossSales, unitsSold }
    const trendMap = new Map<string, Map<string, { grossSales: number; unitsSold: number }>>()

    function ensureTag(tag: string) {
      if (!tagMetrics.has(tag)) {
        tagMetrics.set(tag, {
          grossSales: 0,
          netSales: 0,
          unitsSold: 0,
          orderIds: new Set(),
          refundAmount: 0,
          refundUnits: 0,
          discountAmount: 0,
          lineItemCount: 0,
          disputeIds: new Set(),
          disputeAmount: 0,
          inventoryValue: 0,
          inventoryUnits: 0,
        })
      }
      return tagMetrics.get(tag)!
    }

    function ensureTrend(groupKey: string, tag: string) {
      if (!trendMap.has(groupKey)) trendMap.set(groupKey, new Map())
      const periodMap = trendMap.get(groupKey)!
      if (!periodMap.has(tag)) periodMap.set(tag, { grossSales: 0, unitsSold: 0 })
      return periodMap.get(tag)!
    }

    for (const order of orders) {
      const groupKey = getGroupKey(order.created_at)

      for (const li of order.line_items) {
        if (!li.product_id) continue

        const tags = productTagMap.get(li.product_id)
        if (!tags || tags.length === 0) continue

        const divisor = attribution === 'fractional' ? tags.length : 1
        const lineGross = parseFloat(li.price) * li.quantity
        const lineDiscount = parseFloat(li.total_discount || '0')
        const lineNet = lineGross - lineDiscount

        for (const tag of tags) {
          const m = ensureTag(tag)
          m.grossSales += lineGross / divisor
          m.netSales += lineNet / divisor
          m.unitsSold += li.quantity
          m.orderIds.add(order.id)
          m.discountAmount += lineDiscount / divisor
          m.lineItemCount++

          const t = ensureTrend(groupKey, tag)
          t.grossSales += lineGross / divisor
          t.unitsSold += li.quantity
        }
      }

      // Process refunds by tag
      if (order.refunds?.length) {
        for (const refund of order.refunds) {
          for (const rli of refund.refund_line_items || []) {
            const productId = rli.line_item?.product_id
            if (!productId) continue

            const tags = productTagMap.get(productId)
            if (!tags || tags.length === 0) continue

            const divisor = attribution === 'fractional' ? tags.length : 1
            const refundAmt = rli.subtotal || 0

            for (const tag of tags) {
              const m = ensureTag(tag)
              m.refundAmount += refundAmt / divisor
              m.refundUnits += rli.quantity
            }
          }
        }
      }
    }

    // ─── Join disputes → tags via order_id → line_item.product_id → tags ───
    // Disputes are per-order, so we attribute each dispute's amount to every
    // tag represented in the disputed order's line items. A dispute that
    // touches N distinct tags counts toward each (same "full" attribution
    // logic as revenue). Dispute is de-duplicated per tag via disputeIds.
    const orderById = new Map<number, (typeof orders)[number]>()
    for (const o of orders) orderById.set(o.id, o)

    let totalDisputeCount = 0
    let totalDisputeAmount = 0
    const countedDisputeIds = new Set<number>()
    for (const dispute of allDisputes) {
      if (!dispute.order_id) continue
      const order = orderById.get(dispute.order_id)
      if (!order) continue // dispute for an order outside the current window

      // Collect unique tags across line items in the disputed order
      const disputedTags = new Set<string>()
      for (const li of order.line_items) {
        if (!li.product_id) continue
        const tags = productTagMap.get(li.product_id)
        if (!tags) continue
        for (const t of tags) disputedTags.add(t)
      }
      if (disputedTags.size === 0) continue

      const amt = parseFloat(dispute.amount || '0')
      if (!countedDisputeIds.has(dispute.id)) {
        countedDisputeIds.add(dispute.id)
        totalDisputeCount++
        totalDisputeAmount += amt
      }
      for (const tag of disputedTags) {
        const m = ensureTag(tag)
        if (!m.disputeIds.has(dispute.id)) {
          m.disputeIds.add(dispute.id)
          m.disputeAmount += amt
        }
      }
    }

    // ─── Join inventory → tags via inventory_item_id → product → tags ───
    // Sum unit_cost × on_hand per tag (true working-capital exposure). When
    // unit_cost is not set on an item we do NOT fabricate a number — we skip
    // it for the $ total but still count its units. Units on hand is honest
    // signal even without COGS; inferring cost from retail price is not.
    //
    // Attribution:
    //   full       — each tag gets the product's full inventory value
    //   fractional — value is divided by the number of tags on the product
    let totalInventoryValue = 0
    let matchedItemCount = 0
    let missingCostCount = 0
    let totalInventoryUnits = 0
    const countedInventoryItems = new Set<string>()
    for (const item of allInventoryItems) {
      const numericItemId = parseInt(item.id.split('/').pop() || '', 10)

      // 1) Primary: look up by inventory_item_id from REST variants
      const variantEntry = numericItemId ? inventoryItemToVariant.get(numericItemId) : undefined
      let productId = variantEntry?.productId
      // 2) Fallback: GraphQL variant.product.id
      if (!productId) {
        const productGid = item.variant?.product?.id
        if (productGid) {
          const parsed = parseInt(productGid.split('/').pop() || '', 10)
          if (parsed) productId = parsed
        }
      }
      if (!productId) continue

      const tags = productTagMap.get(productId)
      if (!tags || tags.length === 0) continue

      // Sum on_hand across all locations for this inventory item
      let onHand = 0
      for (const lvl of item.inventoryLevels.edges) {
        const onHandQty = lvl.node.quantities.find((q) => q.name === 'on_hand')?.quantity ?? 0
        onHand += onHandQty
      }
      if (onHand <= 0) continue

      matchedItemCount++
      const unitCost = parseFloat(item.unitCost?.amount || '0')
      if (!unitCost) missingCostCount++

      const itemValue = unitCost * onHand
      const divisor = attribution === 'fractional' ? tags.length : 1

      if (!countedInventoryItems.has(item.id)) {
        countedInventoryItems.add(item.id)
        totalInventoryValue += itemValue
        totalInventoryUnits += onHand
      }
      for (const tag of tags) {
        const m = ensureTag(tag)
        m.inventoryValue += itemValue / divisor
        m.inventoryUnits += onHand
      }
    }

    // Valuation coverage tells the UI whether to show $ or fall back to units
    const inventoryValuationMethod: 'cost' | 'partial' | 'none' =
      matchedItemCount === 0
        ? 'none'
        : missingCostCount === matchedItemCount
          ? 'none' // all items missing cost — $ total will be 0
          : missingCostCount === 0
            ? 'cost'
            : 'partial'

    console.log(
      `[shopify/tags] inventory join: ${allInventoryItems.length} items fetched, ` +
        `${matchedItemCount} matched tagged products (${missingCostCount} missing unit_cost), ` +
        `${totalInventoryUnits} units on hand, total cost-based value $${totalInventoryValue.toFixed(2)} ` +
        `(${inventoryValuationMethod})`
    )

    // Build tag performance array
    const tags: ShopifyTagPerformance[] = Array.from(tagMetrics.entries())
      .map(([tag, m]) => ({
        tag,
        grossSales: Math.round(m.grossSales * 100) / 100,
        netSales: Math.round(m.netSales * 100) / 100,
        unitsSold: m.unitsSold,
        orderCount: m.orderIds.size,
        refundAmount: Math.round(m.refundAmount * 100) / 100,
        refundUnits: m.refundUnits,
        discountAmount: Math.round(m.discountAmount * 100) / 100,
        avgOrderValue:
          m.orderIds.size > 0 ? Math.round((m.grossSales / m.orderIds.size) * 100) / 100 : 0,
        lineItemCount: m.lineItemCount,
        disputeCount: m.disputeIds.size,
        disputeAmount: Math.round(m.disputeAmount * 100) / 100,
        disputeRate:
          m.orderIds.size > 0 ? Math.round((m.disputeIds.size / m.orderIds.size) * 10000) / 100 : 0,
        inventoryValue: Math.round(m.inventoryValue * 100) / 100,
        inventoryUnits: m.inventoryUnits,
      }))
      .sort((a, b) => b.grossSales - a.grossSales)

    // Build trend data (top 10 tags by gross sales + any compare tags)
    const topTagNames = new Set(tags.slice(0, 10).map((t) => t.tag))
    if (compareTags) compareTags.forEach((t) => topTagNames.add(t))

    const tagTrend: ShopifyTagTrendPoint[] = []
    const sortedGroupKeys = Array.from(trendMap.keys()).sort()
    for (const groupKey of sortedGroupKeys) {
      const periodMap = trendMap.get(groupKey)!
      for (const tag of topTagNames) {
        const data = periodMap.get(tag)
        tagTrend.push({
          date: groupKey,
          tag,
          grossSales: data ? Math.round(data.grossSales * 100) / 100 : 0,
          unitsSold: data?.unitsSold ?? 0,
        })
      }
    }

    // Build comparison data if requested
    let comparison: ShopifyTagComparisonData | undefined
    if (compareTags && compareTags.length >= 2) {
      comparison = {
        tags: compareTags,
        periods: sortedGroupKeys.map((date) => {
          const periodMap = trendMap.get(date)!
          const values: Record<string, { grossSales: number; unitsSold: number }> = {}
          for (const tag of compareTags) {
            const data = periodMap.get(tag)
            values[tag] = {
              grossSales: data ? Math.round(data.grossSales * 100) / 100 : 0,
              unitsSold: data?.unitsSold ?? 0,
            }
          }
          return { date, values }
        }),
      }
    }

    // Summary
    const totalGrossSales = tags.reduce((s, t) => s + t.grossSales, 0)
    const summary: ShopifyTagReportingSummary = {
      totalTags: tags.length,
      totalGrossSales: Math.round(totalGrossSales * 100) / 100,
      totalNetSales: Math.round(tags.reduce((s, t) => s + t.netSales, 0) * 100) / 100,
      totalUnitsSold: tags.reduce((s, t) => s + t.unitsSold, 0),
      totalRefundAmount: Math.round(tags.reduce((s, t) => s + t.refundAmount, 0) * 100) / 100,
      totalDiscountAmount: Math.round(tags.reduce((s, t) => s + t.discountAmount, 0) * 100) / 100,
      totalDisputeCount,
      totalDisputeAmount: Math.round(totalDisputeAmount * 100) / 100,
      totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
      totalInventoryUnits,
      inventoryItemsMissingCost: missingCostCount,
      inventoryValuationMethod,
      attributionMethod: attribution,
      currency: orders[0]?.currency || 'USD',
    }

    // Build per-product-per-tag sales data
    const productInfoMap = new Map<
      number,
      { title: string; imageUrl: string | null; tags: string[] }
    >()
    for (const product of allProducts) {
      productInfoMap.set(product.id, {
        title: product.title || 'Unknown',
        imageUrl: product.image?.src ?? null,
        tags: productTagMap.get(product.id) || [],
      })
    }

    // Aggregate per-product sales from orders
    const productSalesMap = new Map<
      number,
      { grossSales: number; unitsSold: number; orderIds: Set<number> }
    >()
    for (const order of orders) {
      for (const li of order.line_items) {
        if (!li.product_id) continue
        if (!productSalesMap.has(li.product_id)) {
          productSalesMap.set(li.product_id, { grossSales: 0, unitsSold: 0, orderIds: new Set() })
        }
        const ps = productSalesMap.get(li.product_id)!
        ps.grossSales += parseFloat(li.price) * li.quantity
        ps.unitsSold += li.quantity
        ps.orderIds.add(order.id)
      }
    }

    // Group products by tag
    const productsByTag: Record<string, ShopifyTagProduct[]> = {}
    for (const [productId, info] of productInfoMap) {
      if (info.tags.length === 0) continue
      const sales = productSalesMap.get(productId)
      const entry: ShopifyTagProduct = {
        productId,
        title: info.title,
        imageUrl: info.imageUrl,
        grossSales: sales ? Math.round(sales.grossSales * 100) / 100 : 0,
        unitsSold: sales?.unitsSold ?? 0,
        orderCount: sales?.orderIds.size ?? 0,
        tags: info.tags,
      }
      for (const tag of info.tags) {
        if (!productsByTag[tag]) productsByTag[tag] = []
        productsByTag[tag].push(entry)
      }
    }
    // Sort products within each tag by grossSales desc
    for (const tag of Object.keys(productsByTag)) {
      productsByTag[tag].sort((a, b) => b.grossSales - a.grossSales)
    }

    const response: ShopifyTagReportingResponse = {
      tags,
      summary,
      tagTrend,
      comparison,
      trendGranularity: granularity,
      availableTags: Array.from(allTagSet).sort(),
      productsByTag,
      warning:
        attribution === 'full'
          ? 'Products with multiple tags are attributed to each tag. Tag totals will exceed actual revenue.'
          : undefined,
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Shopify tags error:', error)
    return NextResponse.json({ error: 'Failed to fetch Shopify tag reporting' }, { status: 500 })
  }
})
