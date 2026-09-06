import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'
import type {
  ShopifyReturnItem,
  ShopifyReturnLineItem,
  ShopifyReturnExchangeLineItem,
  ShopifyReturnReverseFulfillment,
  ShopifyReturnLinkedRefund,
  ShopifyReturnsSummary,
  ShopifyReturnReasonBucket,
  ShopifyReturnStatusBucket,
  ShopifyReturnTopProduct,
  ShopifyReturnTrendPoint,
  ShopifyReturnStatus,
} from '@/lib/providers/shopify/types'

/**
 * Shopify Returns (RMA workflow) API route.
 *
 * Fetches the GraphQL `returns` connection — the operational return workflow
 * that precedes a refund. Complements the Refunds page (which shows the
 * financial event) with the request → approve/decline → reverse-fulfillment
 * lifecycle.
 *
 * Query params:
 *   ?shop=domain          — target store
 *   ?startDate=YYYY-MM-DD — filter by Return.createdAt (inclusive)
 *   ?endDate=YYYY-MM-DD   — filter by Return.createdAt (inclusive)
 */

/**
 * Shopify's Admin GraphQL API doesn't expose `returns` as a top-level
 * QueryRoot field — Returns are only reachable via `Order.returns`. So we
 * walk orders that have a non-NO_RETURN returnStatus and pull each order's
 * returns inline. The `query` arg filters at the order level (created_at)
 * and returnStatus excludes orders with no returns to keep the working set
 * small.
 */
const ORDERS_WITH_RETURNS_QUERY = `
  query OrdersWithReturns($first: Int!, $query: String, $after: String) {
    orders(first: $first, query: $query, after: $after, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          name
          createdAt
          currencyCode
          customer {
            id
            displayName
            email
          }
          returns(first: 5) {
            edges {
              node {
                id
                name
                status
                totalQuantity
                decline { reason note }
                returnLineItems(first: 10) {
                  edges {
                    node {
                      id
                      quantity
                      ... on ReturnLineItem {
                        returnReason
                        returnReasonNote
                        customerNote
                        restockingFee {
                          amountSet { shopMoney { amount currencyCode } }
                        }
                        fulfillmentLineItem {
                          lineItem {
                            id
                            title
                            sku
                            image { url }
                          }
                        }
                      }
                    }
                  }
                }
                exchangeLineItems(first: 5) {
                  edges {
                    node {
                      id
                      quantity
                      lineItem {
                        id
                        title
                        sku
                        originalUnitPriceSet { shopMoney { amount currencyCode } }
                      }
                    }
                  }
                }
                reverseFulfillmentOrders(first: 3) {
                  edges {
                    node {
                      id
                      status
                      reverseDeliveries(first: 2) {
                        edges {
                          node {
                            id
                            deliverable {
                              ... on ReverseDeliveryShippingDeliverable {
                                tracking { number url carrierName }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
                refunds(first: 5) {
                  edges {
                    node {
                      id
                      createdAt
                      totalRefundedSet { shopMoney { amount currencyCode } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`

/** Extract numeric portion from a Shopify GID, e.g. "gid://shopify/Return/123" → 123 */
function numericGid(gid: string | null | undefined): number {
  if (!gid) return 0
  const m = gid.match(/(\d+)$/)
  return m ? parseInt(m[1], 10) : 0
}

function parseMoney(amount: string | null | undefined): number {
  if (!amount) return 0
  const n = parseFloat(amount)
  return Number.isFinite(n) ? n : 0
}

function getGroupKey(dateStr: string, granularity: 'day' | 'week' | 'month'): string {
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

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Build the GraphQL order-search query. We filter by created_at on the
    // *order* (since returns aren't queryable directly) and use return_status
    // to skip orders that never had a return, keeping the working set small.
    const queryParts: string[] = ['-return_status:no_return']
    if (startDate) queryParts.push(`created_at:>=${startDate}`)
    if (endDate) queryParts.push(`created_at:<=${endDate}`)
    const queryStr = queryParts.join(' ')

    // Cursor-based pagination. Page size is constrained by Shopify's 1000-cost
    // GraphQL ceiling — with our nested return/line-item connections, ~5
    // orders per page keeps us safely under the cap. We trade more round-trips
    // for fitting under cost.
    const pageSize = 5
    const maxOrders = 500
    const orderNodes: any[] = []
    let cursor: string | null = null
    let warning: string | undefined

    while (orderNodes.length < maxOrders) {
      const variables: Record<string, any> = { first: pageSize, query: queryStr }
      if (cursor) variables.after = cursor

      let pageData: any
      try {
        const resp = await client.graphql<{ orders: any }>(ORDERS_WITH_RETURNS_QUERY, variables)
        pageData = resp.data?.orders
      } catch (err) {
        // If the very first page fails, surface the error; otherwise return what we have
        if (orderNodes.length === 0) throw err
        warning = `Returns query failed mid-pagination after ${orderNodes.length} orders`
        break
      }

      if (!pageData) break
      const edges = pageData.edges || []
      for (const edge of edges) {
        if (edge.node) orderNodes.push(edge.node)
      }

      if (!pageData.pageInfo?.hasNextPage) break
      cursor = pageData.pageInfo.endCursor
      if (!cursor) break
    }

    if (orderNodes.length >= maxOrders) {
      warning = `Showing returns from first ${maxOrders} orders. Narrow the date range to see more.`
    }

    // ── Flatten orders → returns and map to ShopifyReturnItem ──
    const returns: ShopifyReturnItem[] = []
    for (const order of orderNodes) {
      const customer = order.customer || null
      const currency = order.currencyCode || 'USD'
      const returnEdges = order.returns?.edges || []

      for (const re of returnEdges) {
        const node = re.node
        if (!node) continue

        // Return line items
        const returnLineItems: ShopifyReturnLineItem[] = (node.returnLineItems?.edges || []).map(
          (e: any) => {
            const rli = e.node || {}
            const li = rli.fulfillmentLineItem?.lineItem || {}
            const imageUrl = li.image?.url || null
            return {
              id: rli.id || '',
              quantity: rli.quantity ?? 0,
              returnReason: rli.returnReason || 'UNKNOWN',
              returnReasonNote: rli.returnReasonNote || null,
              customerNote: rli.customerNote || null,
              restockingFeeAmount: parseMoney(rli.restockingFee?.amountSet?.shopMoney?.amount),
              title: li.title || 'Unknown',
              sku: li.sku || null,
              imageUrl,
            }
          }
        )

        // Exchange line items
        const exchangeLineItems: ShopifyReturnExchangeLineItem[] = (
          node.exchangeLineItems?.edges || []
        ).map((e: any) => {
          const xli = e.node
          const li = xli.lineItem || {}
          return {
            id: xli.id,
            quantity: xli.quantity ?? 0,
            title: li.title || 'Unknown',
            sku: li.sku || null,
            unitPrice: parseMoney(li.originalUnitPriceSet?.shopMoney?.amount),
          }
        })

        // Reverse fulfillments — flatten across reverseDeliveries
        const reverseFulfillments: ShopifyReturnReverseFulfillment[] = (
          node.reverseFulfillmentOrders?.edges || []
        ).map((e: any) => {
          const rfo = e.node
          const delivery = rfo.reverseDeliveries?.edges?.[0]?.node
          const tracking = delivery?.deliverable?.tracking || null
          return {
            id: rfo.id,
            status: rfo.status || 'UNKNOWN',
            trackingNumber: tracking?.number || null,
            trackingUrl: tracking?.url || null,
            trackingCompany: tracking?.carrierName || null,
          }
        })

        // Linked refunds
        const linkedRefunds: ShopifyReturnLinkedRefund[] = (node.refunds?.edges || []).map(
          (e: any) => {
            const rf = e.node || {}
            return {
              id: rf.id,
              numericId: numericGid(rf.id),
              createdAt: rf.createdAt,
              totalRefunded: parseMoney(rf.totalRefundedSet?.shopMoney?.amount),
              currency: rf.totalRefundedSet?.shopMoney?.currencyCode || currency,
            }
          }
        )

        returns.push({
          id: node.id,
          numericId: numericGid(node.id),
          name: node.name || `Return ${numericGid(node.id)}`,
          status: (node.status || 'OPEN') as ShopifyReturnStatus,
          // Return.createdAt isn't exposed on all API versions — fall back to
          // the parent order's createdAt for trend bucketing
          createdAt: order.createdAt || new Date().toISOString(),
          // processedAt isn't exposed either; use the first linked refund's
          // createdAt as a proxy for "when the return was resolved"
          processedAt: linkedRefunds[0]?.createdAt || null,
          totalQuantity: node.totalQuantity ?? 0,
          declineReason: node.decline?.reason || null,
          declineNote: node.decline?.note || null,
          orderId: numericGid(order.id),
          orderName: order.name || '',
          customerId: customer?.id ? numericGid(customer.id) : null,
          customerName: customer?.displayName || null,
          customerEmail: customer?.email || null,
          returnLineItems,
          exchangeLineItems,
          reverseFulfillments,
          linkedRefunds,
          currency,
        })
      }
    }

    // Sort newest first
    returns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // ── Compute summary KPIs ───────────────────────────────
    const totalReturns = returns.length

    let openCount = 0
    let closedCount = 0
    let declinedCount = 0
    let canceledCount = 0
    let exchangeCount = 0
    let totalUnitsReturned = 0
    const reasonMap = new Map<string, { count: number; quantity: number }>()
    const statusMap = new Map<ShopifyReturnStatus, number>()
    const productMap = new Map<string, { quantity: number; returnCount: number }>()
    const resolutionDays: number[] = []

    for (const r of returns) {
      // Status buckets
      switch (r.status) {
        case 'OPEN':
        case 'REQUESTED':
          openCount++
          break
        case 'CLOSED':
          closedCount++
          break
        case 'DECLINED':
          declinedCount++
          break
        case 'CANCELED':
          canceledCount++
          break
      }
      statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1)

      // Exchanges
      if (r.exchangeLineItems.length > 0) exchangeCount++

      // Units & per-product / per-reason rollups
      const productsInThisReturn = new Set<string>()
      for (const li of r.returnLineItems) {
        totalUnitsReturned += li.quantity

        const reasonKey = li.returnReason || 'UNKNOWN'
        const reasonEntry = reasonMap.get(reasonKey) || { count: 0, quantity: 0 }
        reasonEntry.count++
        reasonEntry.quantity += li.quantity
        reasonMap.set(reasonKey, reasonEntry)

        const productEntry = productMap.get(li.title) || { quantity: 0, returnCount: 0 }
        productEntry.quantity += li.quantity
        if (!productsInThisReturn.has(li.title)) {
          productEntry.returnCount++
          productsInThisReturn.add(li.title)
        }
        productMap.set(li.title, productEntry)
      }

      // Resolution time (days from createdAt to processedAt)
      if (r.processedAt) {
        const days =
          (new Date(r.processedAt).getTime() - new Date(r.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
        if (days >= 0 && Number.isFinite(days)) resolutionDays.push(days)
      }
    }

    const avgResolutionDays =
      resolutionDays.length > 0
        ? resolutionDays.reduce((s, d) => s + d, 0) / resolutionDays.length
        : 0
    const sortedDays = [...resolutionDays].sort((a, b) => a - b)
    const medianResolutionDays =
      sortedDays.length > 0
        ? sortedDays.length % 2 === 0
          ? (sortedDays[sortedDays.length / 2 - 1] + sortedDays[sortedDays.length / 2]) / 2
          : sortedDays[Math.floor(sortedDays.length / 2)]
        : 0

    // Top reasons (sorted by count desc, top 10)
    const topReasons: ShopifyReturnReasonBucket[] = Array.from(reasonMap.entries())
      .map(([reason, data]) => ({ reason, count: data.count, quantity: data.quantity }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Status funnel (stable order)
    const statusOrder: ShopifyReturnStatus[] = [
      'REQUESTED',
      'OPEN',
      'CLOSED',
      'DECLINED',
      'CANCELED',
    ]
    const statusBuckets: ShopifyReturnStatusBucket[] = statusOrder
      .map((status) => ({ status, count: statusMap.get(status) || 0 }))
      .filter((b) => b.count > 0)

    // Top products by total quantity returned
    const topProducts: ShopifyReturnTopProduct[] = Array.from(productMap.entries())
      .map(([title, data]) => ({ title, quantity: data.quantity, returnCount: data.returnCount }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)

    // ── Get total order count for return rate denominator ──
    // We use the same REST `getOrders` path as the Refunds route so the
    // denominator is consistent across both pages.
    let totalOrderCount = 0
    const periodOrderCounts: Record<string, number> = {}
    try {
      const orderParams: Record<string, string> = { limit: '250', status: 'any' }
      if (startDate) orderParams.created_at_min = `${startDate}T00:00:00Z`
      if (endDate) orderParams.created_at_max = `${endDate}T23:59:59Z`
      const allOrders = await client.getOrders(orderParams)
      const orders = allOrders.filter((o: any) => o.cancelled_at === null && !o.test)
      totalOrderCount = orders.length

      // Per-period order counts (for return-rate trend)
      const rangeMs =
        startDate && endDate
          ? new Date(endDate).getTime() - new Date(startDate).getTime()
          : Infinity
      const rangeDays = rangeMs / (1000 * 60 * 60 * 24)
      const granularity: 'day' | 'week' | 'month' =
        rangeDays <= 31 ? 'day' : rangeDays <= 90 ? 'week' : 'month'
      for (const order of orders) {
        const key = getGroupKey(order.created_at, granularity)
        periodOrderCounts[key] = (periodOrderCounts[key] || 0) + 1
      }
    } catch {
      // If orders fetch fails, leave totalOrderCount at 0 — page still renders
    }

    // Granularity (also needed below for the trend)
    const rangeMs =
      startDate && endDate ? new Date(endDate).getTime() - new Date(startDate).getTime() : Infinity
    const rangeDays = rangeMs / (1000 * 60 * 60 * 24)
    const granularity: 'day' | 'week' | 'month' =
      rangeDays <= 31 ? 'day' : rangeDays <= 90 ? 'week' : 'month'

    // ── Returns by period ──────────────────────────────────
    const periodReturns: Record<string, number> = {}
    for (const r of returns) {
      const key = getGroupKey(r.createdAt, granularity)
      periodReturns[key] = (periodReturns[key] || 0) + 1
    }

    // Union all period keys so periods with orders but no returns still render at 0%
    const keySet = new Set<string>([
      ...Object.keys(periodReturns),
      ...Object.keys(periodOrderCounts),
    ])
    const returnsByPeriod: ShopifyReturnTrendPoint[] = Array.from(keySet)
      .map((date) => {
        const count = periodReturns[date] || 0
        const orderCount = periodOrderCounts[date] || 0
        const returnRate = orderCount > 0 ? Math.round((count / orderCount) * 1000) / 10 : 0
        return { date, count, orderCount, returnRate }
      })
      .sort((a, b) => a.date.localeCompare(b.date))

    const returnRateByCount =
      totalOrderCount > 0 ? Math.round((totalReturns / totalOrderCount) * 1000) / 10 : 0
    const declineRate =
      totalReturns > 0 ? Math.round((declinedCount / totalReturns) * 1000) / 10 : 0
    const exchangeRate =
      totalReturns > 0 ? Math.round((exchangeCount / totalReturns) * 1000) / 10 : 0

    const summary: ShopifyReturnsSummary = {
      totalReturns,
      openCount,
      closedCount,
      declinedCount,
      canceledCount,
      exchangeCount,
      totalUnitsReturned,
      returnRateByCount,
      totalOrderCount,
      avgResolutionDays: Math.round(avgResolutionDays * 10) / 10,
      medianResolutionDays: Math.round(medianResolutionDays * 10) / 10,
      declineRate,
      exchangeRate,
      topReasons,
      statusBuckets,
      topProducts,
      returnsByPeriod,
      currency: returns[0]?.currency || 'USD',
    }

    return NextResponse.json({
      data: { returns, summary, trendGranularity: granularity, warning },
    })
  } catch (error) {
    console.error('Shopify returns error:', error)
    return NextResponse.json({ error: 'Failed to fetch Shopify returns' }, { status: 500 })
  }
})
