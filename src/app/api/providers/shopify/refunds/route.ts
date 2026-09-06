import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'
import type {
  ShopifyOrder,
  ShopifyRefund,
  ShopifyRefundItem,
  ShopifyRefundsSummary,
  ShopifyRestockTrendPoint,
  ShopifyRefundEnhancedSummary,
  ShopifyRefundTimingBucket,
  ShopifyRefundByTag,
  ShopifyExchangeItem,
} from '@/lib/providers/shopify/types'

/**
 * Shopify Refunds & Returns API route.
 * Extracts refund data from orders and computes analytics.
 *
 * Query params:
 *   ?shop=domain          — target store
 *   ?startDate=YYYY-MM-DD — filter start
 *   ?endDate=YYYY-MM-DD   — filter end
 */
export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Default to created_at — matches Shopify's sales dashboard day grouping.
    const dateField = url.searchParams.get('date_field') || 'created_at'

    // Fetch orders with refund data
    const orderParams: Record<string, string> = { limit: '250', status: 'any' }
    if (startDate) {
      orderParams[`${dateField}_min`] = startDate.includes('T')
        ? startDate
        : `${startDate}T00:00:00Z`
    }
    if (endDate) {
      orderParams[`${dateField}_max`] = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`
    }

    // Fetch and filter out cancelled/test orders
    const allOrders: ShopifyOrder[] = await client.getOrders(orderParams)
    const orders = allOrders.filter((o) => o.cancelled_at === null && !o.test)

    // Determine aggregation granularity based on date range span
    const rangeMs =
      startDate && endDate ? new Date(endDate).getTime() - new Date(startDate).getTime() : Infinity
    const rangeDays = rangeMs / (1000 * 60 * 60 * 24)
    const granularity: 'day' | 'week' | 'month' =
      rangeDays <= 31 ? 'day' : rangeDays <= 90 ? 'week' : 'month'

    // Helper: get the grouping key for a date string based on granularity
    function getGroupKey(dateStr: string): string {
      if (granularity === 'day') return dateStr.slice(0, 10) // "YYYY-MM-DD"
      if (granularity === 'week') {
        const d = new Date(dateStr)
        const day = d.getUTCDay()
        const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1)
        const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff))
        return monday.toISOString().slice(0, 10) // "YYYY-MM-DD" (week start)
      }
      return dateStr.slice(0, 7) // "YYYY-MM"
    }

    // Extract all refunds from orders
    const refunds: ShopifyRefundItem[] = []
    const productRefundCounts: Record<string, { quantity: number; amount: number }> = {}
    const periodRefunds: Record<string, { count: number; amount: number }> = {}
    // Gross revenue per period bucket, keyed by the same granularity key as periodRefunds.
    // Used as the denominator for the "returns as % of revenue" trend chart.
    const periodRevenue: Record<string, number> = {}
    let fullyRefunded = 0
    let partiallyRefunded = 0
    let restocked = 0
    let notRestocked = 0

    // Build per-period gross revenue map (from order.created_at) so buckets line up
    // with refund buckets regardless of when the refund itself was issued.
    for (const order of orders) {
      const key = getGroupKey(order.created_at)
      periodRevenue[key] = (periodRevenue[key] || 0) + parseFloat(order.total_price || '0')
    }

    for (const order of orders) {
      if (!order.refunds?.length) continue

      const isFullyRefunded = order.financial_status === 'refunded'
      const isPartiallyRefunded = order.financial_status === 'partially_refunded'
      if (isFullyRefunded) fullyRefunded++
      if (isPartiallyRefunded) partiallyRefunded++

      for (const refund of order.refunds) {
        let totalRefunded = 0

        // Sum transaction amounts
        for (const txn of refund.transactions || []) {
          if (txn.kind === 'refund' && txn.status === 'success') {
            totalRefunded += parseFloat(txn.amount)
          }
        }

        // Track line items
        const lineItems = (refund.refund_line_items || []).map((rli) => {
          const title = rli.line_item?.title || 'Unknown'
          const qty = rli.quantity
          const subtotal = rli.subtotal || 0

          // Track product-level refunds
          if (!productRefundCounts[title]) {
            productRefundCounts[title] = { quantity: 0, amount: 0 }
          }
          productRefundCounts[title].quantity += qty
          productRefundCounts[title].amount += subtotal

          // Track restock
          if (rli.restock_type === 'return' || rli.restock_type === 'legacy_restock') {
            restocked++
          } else {
            notRestocked++
          }

          return {
            title,
            quantity: qty,
            subtotal,
            restockType: rli.restock_type,
          }
        })

        // Period tracking using smart granularity
        const key = getGroupKey(refund.created_at)
        if (!periodRefunds[key]) {
          periodRefunds[key] = { count: 0, amount: 0 }
        }
        periodRefunds[key].count++
        periodRefunds[key].amount += totalRefunded

        refunds.push({
          orderId: order.id,
          orderName: order.name,
          refundId: refund.id,
          createdAt: refund.created_at,
          note: refund.note,
          lineItems,
          transactions: (refund.transactions || []).map((t) => ({
            amount: parseFloat(t.amount),
            currency: t.currency,
            gateway: t.gateway,
            kind: t.kind,
          })),
          totalRefunded,
          currency: order.currency,
        })
      }
    }

    // Sort refunds by date (newest first)
    refunds.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const totalRefundedAmount = refunds.reduce((s, r) => s + r.totalRefunded, 0)

    // Top refunded products
    const topRefundedProducts = Object.entries(productRefundCounts)
      .map(([title, data]) => ({ title, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    // Try ShopifyQL for returns trend data, fall back to REST aggregation
    let refundsByPeriod: Array<{
      date: string
      count: number
      amount: number
      revenue?: number
      refundPct?: number
    }> = []
    let trendSource: 'shopifyql' | 'rest' = 'rest'

    if (startDate && endDate) {
      try {
        const dateFilter = `SINCE ${startDate} UNTIL ${endDate}`
        const timeseriesGranularity = granularity === 'week' ? 'week' : granularity
        const returnsResult = await client.shopifyqlQuery(
          `FROM sales SHOW returns TIMESERIES ${timeseriesGranularity} ${dateFilter}`
        )

        const cols = returnsResult.columns.map((c: any) => c.name || c.displayName)
        const dateColIdx = cols.findIndex((n: string) => /day|week|month/i.test(n))
        const returnsIdx = cols.indexOf('returns')

        if (dateColIdx >= 0 && returnsIdx >= 0) {
          // ShopifyQL returns gives us amounts but not counts — merge with REST counts
          const restCounts = new Map(Object.entries(periodRefunds))

          refundsByPeriod = returnsResult.rows.map((row: any[]) => {
            const dateKey = String(row[dateColIdx]).slice(0, 10)
            const amount = Math.abs(parseFloat(String(row[returnsIdx])) || 0)
            const restData = restCounts.get(dateKey)
            const revenue = periodRevenue[dateKey] ?? 0
            const finalAmount = amount || restData?.amount || 0
            return {
              date: dateKey,
              count: restData?.count ?? 0,
              amount: finalAmount,
              revenue: Math.round(revenue * 100) / 100,
              refundPct: revenue > 0 ? Math.round((finalAmount / revenue) * 1000) / 10 : 0,
            }
          })
          trendSource = 'shopifyql'
        }
      } catch {
        // ShopifyQL unavailable — fall back to REST
      }
    }

    if (trendSource === 'rest') {
      // Union keys so periods with revenue but no refunds still render as 0% dots
      const keySet = new Set<string>([...Object.keys(periodRefunds), ...Object.keys(periodRevenue)])
      refundsByPeriod = Array.from(keySet)
        .map((date) => {
          const data = periodRefunds[date] ?? { count: 0, amount: 0 }
          const revenue = periodRevenue[date] ?? 0
          return {
            date,
            count: data.count,
            amount: data.amount,
            revenue: Math.round(revenue * 100) / 100,
            refundPct: revenue > 0 ? Math.round((data.amount / revenue) * 1000) / 10 : 0,
          }
        })
        .sort((a, b) => a.date.localeCompare(b.date))
    }

    const summary: ShopifyRefundsSummary = {
      totalRefunds: refunds.length,
      totalRefundedAmount,
      avgRefundAmount: refunds.length > 0 ? totalRefundedAmount / refunds.length : 0,
      fullyRefundedOrders: fullyRefunded,
      partiallyRefundedOrders: partiallyRefunded,
      restockedCount: restocked,
      notRestockedCount: notRestocked,
      topRefundedProducts,
      refundsByPeriod,
      currency: orders[0]?.currency || 'USD',
    }

    // Restock type trend: group line items using smart granularity
    const restockTrendMap: Record<string, { restocked: number; notRestocked: number }> = {}
    for (const refund of refunds) {
      const key = getGroupKey(refund.createdAt)
      if (!restockTrendMap[key]) {
        restockTrendMap[key] = { restocked: 0, notRestocked: 0 }
      }
      for (const li of refund.lineItems) {
        if (li.restockType === 'return' || li.restockType === 'legacy_restock') {
          restockTrendMap[key].restocked++
        } else {
          restockTrendMap[key].notRestocked++
        }
      }
    }
    const restockTrend: ShopifyRestockTrendPoint[] = Object.entries(restockTrendMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // ── Enhanced Refund Analytics ──────────────────────────────

    // Compute gross revenue across all orders in range (denominator for refund rate)
    const totalGrossRevenue = orders.reduce((s, o) => s + parseFloat(o.total_price || '0'), 0)

    // Compute time-to-refund for each refund (days from order.created_at to refund.created_at)
    const daysToRefund: number[] = []
    for (const order of orders) {
      if (!order.refunds?.length) continue
      const orderDate = new Date(order.created_at).getTime()
      for (const refund of order.refunds) {
        const refundDate = new Date(refund.created_at).getTime()
        const days = Math.max(0, (refundDate - orderDate) / (1000 * 60 * 60 * 24))
        daysToRefund.push(days)
      }
    }

    const avgDaysToRefund =
      daysToRefund.length > 0 ? daysToRefund.reduce((s, d) => s + d, 0) / daysToRefund.length : 0

    // Median
    const sortedDays = [...daysToRefund].sort((a, b) => a - b)
    const medianDaysToRefund =
      sortedDays.length > 0
        ? sortedDays.length % 2 === 0
          ? (sortedDays[sortedDays.length / 2 - 1] + sortedDays[sortedDays.length / 2]) / 2
          : sortedDays[Math.floor(sortedDays.length / 2)]
        : 0

    // Timing buckets
    const bucketDefs = [
      { label: '0–7 days', minDays: 0, maxDays: 7 },
      { label: '8–14 days', minDays: 8, maxDays: 14 },
      { label: '15–30 days', minDays: 15, maxDays: 30 },
      { label: '31–60 days', minDays: 31, maxDays: 60 },
      { label: '60+ days', minDays: 61, maxDays: Infinity },
    ]

    // Collect per-refund amount alongside days for bucket amounts
    const refundDaysAndAmounts: Array<{ days: number; amount: number }> = []
    for (const order of orders) {
      if (!order.refunds?.length) continue
      const orderDate = new Date(order.created_at).getTime()
      for (const refund of order.refunds) {
        const refundDate = new Date(refund.created_at).getTime()
        const days = Math.max(0, (refundDate - orderDate) / (1000 * 60 * 60 * 24))
        let amount = 0
        for (const txn of refund.transactions || []) {
          if (txn.kind === 'refund' && txn.status === 'success') {
            amount += parseFloat(txn.amount)
          }
        }
        refundDaysAndAmounts.push({ days, amount })
      }
    }

    const totalRefundCount = refundDaysAndAmounts.length
    const timingBuckets: ShopifyRefundTimingBucket[] = bucketDefs.map((b) => {
      const inBucket = refundDaysAndAmounts.filter(
        (r) => r.days >= b.minDays && r.days <= b.maxDays
      )
      return {
        label: b.label,
        minDays: b.minDays,
        maxDays: b.maxDays === Infinity ? 9999 : b.maxDays,
        count: inBucket.length,
        amount: Math.round(inBucket.reduce((s, r) => s + r.amount, 0) * 100) / 100,
        percentage:
          totalRefundCount > 0 ? Math.round((inBucket.length / totalRefundCount) * 1000) / 10 : 0,
      }
    })

    // Refund by product tag analysis
    // Build product tag map from products
    let refundsByTag: ShopifyRefundByTag[] = []
    try {
      const products = await client.getProducts({ limit: '250', fields: 'id,tags' })
      const productTagMap = new Map<number, string[]>()
      for (const product of products) {
        const tags = (product.tags || '')
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean)
        productTagMap.set(product.id, tags)
      }

      const tagRefunds = new Map<
        string,
        { count: number; amount: number; units: number; orderIds: Set<number> }
      >()
      // Also need order-level counts per tag to compute refund rate
      const tagOrderCounts = new Map<string, Set<number>>()

      // Count total orders per tag (for refund rate denominator)
      for (const order of orders) {
        for (const li of order.line_items) {
          if (!li.product_id) continue
          const tags = productTagMap.get(li.product_id)
          if (!tags) continue
          for (const tag of tags) {
            if (!tagOrderCounts.has(tag)) tagOrderCounts.set(tag, new Set())
            tagOrderCounts.get(tag)!.add(order.id)
          }
        }
      }

      // Count refunds per tag
      for (const order of orders) {
        if (!order.refunds?.length) continue
        for (const refund of order.refunds) {
          for (const rli of refund.refund_line_items || []) {
            const productId = rli.line_item?.product_id
            if (!productId) continue
            const tags = productTagMap.get(productId)
            if (!tags) continue

            for (const tag of tags) {
              if (!tagRefunds.has(tag)) {
                tagRefunds.set(tag, { count: 0, amount: 0, units: 0, orderIds: new Set() })
              }
              const m = tagRefunds.get(tag)!
              m.amount += rli.subtotal || 0
              m.units += rli.quantity
              m.orderIds.add(order.id)
            }
          }
        }
      }

      // Compute refund count from unique orders with refunds per tag
      refundsByTag = Array.from(tagRefunds.entries())
        .map(([tag, m]) => {
          const totalTagOrders = tagOrderCounts.get(tag)?.size ?? 0
          return {
            tag,
            refundCount: m.orderIds.size,
            refundAmount: Math.round(m.amount * 100) / 100,
            refundUnits: m.units,
            refundRate:
              totalTagOrders > 0 ? Math.round((m.orderIds.size / totalTagOrders) * 1000) / 10 : 0,
          }
        })
        .sort((a, b) => b.refundAmount - a.refundAmount)
        .slice(0, 20)
    } catch {
      // Products fetch failed — skip tag analysis
    }

    const ordersWithRefunds = orders.filter(
      (o) => o.financial_status === 'refunded' || o.financial_status === 'partially_refunded'
    ).length

    const refundRateByValue =
      totalGrossRevenue > 0 ? Math.round((totalRefundedAmount / totalGrossRevenue) * 1000) / 10 : 0

    // ── Exchange Detection ──
    // An "exchange" is when a customer gets a refund and places a new order within 7 days
    const exchanges: ShopifyExchangeItem[] = []
    try {
      // Build a map of customer email/id -> orders sorted by date
      const customerOrderMap = new Map<string, ShopifyOrder[]>()
      for (const order of orders) {
        const custKey = order.customer?.email || order.customer?.id?.toString() || ''
        if (!custKey) continue
        if (!customerOrderMap.has(custKey)) customerOrderMap.set(custKey, [])
        customerOrderMap.get(custKey)!.push(order)
      }
      // Sort each customer's orders by date
      for (const [, custOrders] of customerOrderMap) {
        custOrders.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      }

      // Check each refund for a matching new order within 7 days
      for (const order of orders) {
        if (!order.refunds?.length) continue
        const custKey = order.customer?.email || order.customer?.id?.toString() || ''
        if (!custKey) continue
        const custOrders = customerOrderMap.get(custKey) || []

        for (const refund of order.refunds) {
          const refundDate = new Date(refund.created_at).getTime()
          const refundedItems = (refund.refund_line_items || []).map((rli) => ({
            title: rli.line_item?.title || 'Unknown',
            quantity: rli.quantity,
            amount: rli.subtotal || 0,
          }))
          if (refundedItems.length === 0) continue

          // Find a new order from same customer within 7 days after refund
          const exchangeWindow = 7 * 24 * 60 * 60 * 1000
          const newOrder = custOrders.find((o) => {
            const oDate = new Date(o.created_at).getTime()
            return oDate > refundDate && oDate - refundDate <= exchangeWindow && o.id !== order.id
          })

          if (newOrder) {
            exchanges.push({
              orderId: order.id,
              orderName: order.name,
              refundDate: refund.created_at,
              refundedItems,
              newOrderName: newOrder.name,
              newOrderDate: newOrder.created_at,
              newOrderAmount: parseFloat(newOrder.total_price || '0'),
            })
          }
        }
      }
    } catch {
      // Exchange detection failed — continue without it
    }

    // ── Returns Provision Estimate ──
    // Monthly provision = (refund rate × monthly revenue estimate)
    // Use the period's data to estimate monthly revenue and apply refund rate
    const periodDays = rangeDays === Infinity ? 30 : rangeDays
    const dailyRevenue = periodDays > 0 ? totalGrossRevenue / periodDays : 0
    const estimatedMonthlyRevenue = dailyRevenue * 30
    const estimatedMonthlyProvision =
      estimatedMonthlyRevenue > 0
        ? Math.round((refundRateByValue / 100) * estimatedMonthlyRevenue * 100) / 100
        : 0

    const exchangeCount = exchanges.length
    const pureRefundCount = refunds.length - exchangeCount

    const enhancedSummary: ShopifyRefundEnhancedSummary = {
      refundRateByValue,
      refundRateByCount:
        orders.length > 0 ? Math.round((ordersWithRefunds / orders.length) * 1000) / 10 : 0,
      avgDaysToRefund: Math.round(avgDaysToRefund * 10) / 10,
      medianDaysToRefund: Math.round(medianDaysToRefund * 10) / 10,
      timingBuckets,
      refundsByTag,
      totalGrossRevenue: Math.round(totalGrossRevenue * 100) / 100,
      totalOrderCount: orders.length,
      estimatedMonthlyProvision,
      rollingRefundRate: refundRateByValue,
      exchangeCount,
      exchanges: exchanges.slice(0, 50), // Limit to 50 for response size
      pureRefundCount,
    }

    return NextResponse.json({
      data: { refunds, summary, enhancedSummary, restockTrend, trendGranularity: granularity },
    })
  } catch (error) {
    console.error('Shopify refunds error:', error)
    return NextResponse.json({ error: 'Failed to fetch Shopify refunds' }, { status: 500 })
  }
})
