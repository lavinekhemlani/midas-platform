import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'
import type {
  ShopifyFulfillmentOrderItem,
  ShopifyFulfillmentOrderStatus,
  ShopifyFulfillmentOrderRequestStatus,
  ShopifyFulfillmentHoldReason,
  ShopifyDeliveryMethodType,
  ShopifyFulfillmentHold,
  ShopifyFulfillmentOrderLineItem,
  ShopifyFulfillmentOrderMerchantRequest,
  ShopifyFulfillmentOrderFulfillment,
  ShopifyFulfillmentOpsSummary,
  ShopifyFulfillmentOpsTrendPoint,
  ShopifyFulfillmentOpsResponse,
  ShopifyFulfillmentOrderDestination,
} from '@/lib/providers/shopify/types'

/**
 * Shopify Fulfillment Operations API route.
 *
 * Fetches FulfillmentOrder objects via the Admin GraphQL API and computes
 * operational KPIs: SLA compliance, holds queue, 3PL request status,
 * processing time, and location-level metrics.
 *
 * Query params:
 *   ?shop=domain          — target store
 *   ?startDate=YYYY-MM-DD — filter by updatedAt (inclusive)
 *   ?endDate=YYYY-MM-DD   — filter by updatedAt (inclusive)
 *   ?includeClosed=true   — include closed/completed fulfillment orders
 */

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

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function mapFulfillmentOrder(node: any): ShopifyFulfillmentOrderItem {
  const holds: ShopifyFulfillmentHold[] = (node.fulfillmentHolds || []).map((h: any) => ({
    reason: h.reason || 'OTHER',
    reasonNotes: h.reasonNotes || null,
    displayReason: h.displayReason || null,
    heldByApp: null,
  }))

  const lineItems: ShopifyFulfillmentOrderLineItem[] = (node.lineItems?.edges || []).map(
    (e: any) => {
      const li = e.node
      return {
        id: li.id,
        productTitle: li.productTitle || null,
        variantTitle: li.variantTitle || null,
        sku: li.sku || null,
        totalQuantity: li.totalQuantity ?? 0,
        remainingQuantity: li.remainingQuantity ?? 0,
        image: li.image || null,
        vendor: li.vendor || null,
      }
    }
  )

  const merchantRequests: ShopifyFulfillmentOrderMerchantRequest[] = (
    node.merchantRequests?.edges || []
  ).map((e: any) => ({
    kind: e.node.kind,
    message: e.node.message || null,
    sentAt: e.node.sentAt,
    responseData: e.node.responseData || null,
  }))

  const fulfillments: ShopifyFulfillmentOrderFulfillment[] = (node.fulfillments?.edges || []).map(
    (e: any) => ({
      id: e.node.id,
      status: e.node.status,
      displayStatus: e.node.displayStatus || null,
      createdAt: e.node.createdAt,
      deliveredAt: e.node.deliveredAt || null,
      estimatedDeliveryAt: e.node.estimatedDeliveryAt || null,
      inTransitAt: e.node.inTransitAt || null,
      trackingInfo: (e.node.trackingInfo || []).map((t: any) => ({
        number: t.number || null,
        url: t.url || null,
        company: t.company || null,
      })),
    })
  )

  const totalQuantity = lineItems.reduce((sum, li) => sum + li.totalQuantity, 0)

  const destination: ShopifyFulfillmentOrderDestination | null = node.destination
    ? {
        firstName: node.destination.firstName || null,
        lastName: node.destination.lastName || null,
        company: node.destination.company || null,
        city: node.destination.city || null,
        province: node.destination.province || null,
        countryCode: node.destination.countryCode || null,
      }
    : null

  // Processing time: creation → first fulfillment
  let processingHours: number | null = null
  if (fulfillments.length > 0) {
    const earliest = fulfillments.reduce((min, f) => (f.createdAt < min.createdAt ? f : min))
    const diff = new Date(earliest.createdAt).getTime() - new Date(node.createdAt).getTime()
    processingHours = Math.round((diff / (1000 * 60 * 60)) * 10) / 10
  }

  // SLA tracking
  let slaBreach = false
  let slaHoursRemaining: number | null = null
  if (node.fulfillBy) {
    const deadline = new Date(node.fulfillBy).getTime()
    const now = Date.now()
    if (fulfillments.length > 0) {
      // Already fulfilled — check if it was on time
      const earliest = fulfillments.reduce((min, f) => (f.createdAt < min.createdAt ? f : min))
      slaBreach = new Date(earliest.createdAt).getTime() > deadline
    } else {
      // Not yet fulfilled — check if deadline passed
      slaBreach = now > deadline
    }
    slaHoursRemaining = Math.round(((deadline - now) / (1000 * 60 * 60)) * 10) / 10
  }

  // Extract order ID from orderName fallback or from the order field
  const orderId = node.order?.id || node.orderId || ''

  return {
    id: node.id,
    status: node.status as ShopifyFulfillmentOrderStatus,
    requestStatus: node.requestStatus as ShopifyFulfillmentOrderRequestStatus,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    fulfillBy: node.fulfillBy || null,
    fulfillAt: node.fulfillAt || null,
    orderName: node.orderName || '',
    orderId,
    assignedLocation: node.assignedLocation?.name || node.assignedLocation?.location?.name || null,
    assignedLocationCity: node.assignedLocation?.city || null,
    destination,
    deliveryMethodType: (node.deliveryMethod?.methodType as ShopifyDeliveryMethodType) || null,
    holds,
    lineItems,
    totalQuantity,
    merchantRequests,
    fulfillments,
    supportedActions: (node.supportedActions || []).map((a: any) => a.action),
    processingHours,
    slaBreach,
    slaHoursRemaining,
  }
}

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const includeClosed = url.searchParams.get('includeClosed') === 'true'

    // Build query filter
    const queryParts: string[] = []
    if (startDate) queryParts.push(`updated_at:>=${startDate}`)
    if (endDate) queryParts.push(`updated_at:<=${endDate}`)
    const queryStr = queryParts.length > 0 ? queryParts.join(' ') : undefined

    // Paginate through fulfillment orders
    const pageSize = 20
    const maxItems = 500
    const allNodes: any[] = []
    let cursor: string | null = null
    let warning: string | undefined

    while (allNodes.length < maxItems) {
      let page: { nodes: any[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
      try {
        page = await client.getFulfillmentOrders({
          first: pageSize,
          query: queryStr,
          after: cursor ?? undefined,
          includeClosed,
        })
      } catch (err) {
        if (allNodes.length === 0) throw err
        warning = `Fulfillment orders query failed mid-pagination after ${allNodes.length} items`
        break
      }

      for (const node of page.nodes) {
        allNodes.push(node)
      }

      if (!page.pageInfo.hasNextPage) break
      cursor = page.pageInfo.endCursor
      if (!cursor) break
    }

    if (allNodes.length >= maxItems) {
      warning = `Showing first ${maxItems} fulfillment orders. Narrow the date range to see more.`
    }

    // Map to typed items
    const fulfillmentOrders: ShopifyFulfillmentOrderItem[] = allNodes.map(mapFulfillmentOrder)

    // ── Compute KPIs ──
    const statusCounts: Record<string, number> = {}
    const holdReasonCounts: Record<string, number> = {}
    const deliveryMethodCounts: Record<string, number> = {}
    const locationMap: Record<
      string,
      { count: number; processingTimes: number[]; slaBreaches: number }
    > = {}
    const processingTimes: number[] = []
    let slaBreachCount = 0
    let slaTotal = 0
    let slaOnTime = 0
    let submittedCount = 0
    let rejectedCount = 0
    let holdCount = 0

    for (const fo of fulfillmentOrders) {
      // Status counts
      statusCounts[fo.status] = (statusCounts[fo.status] || 0) + 1

      // Hold tracking
      if (fo.holds.length > 0 || fo.status === 'ON_HOLD') {
        holdCount++
        for (const h of fo.holds) {
          holdReasonCounts[h.reason] = (holdReasonCounts[h.reason] || 0) + 1
        }
      }

      // Delivery method
      if (fo.deliveryMethodType) {
        deliveryMethodCounts[fo.deliveryMethodType] =
          (deliveryMethodCounts[fo.deliveryMethodType] || 0) + 1
      }

      // Location metrics
      const loc = fo.assignedLocation || 'Unknown'
      if (!locationMap[loc]) locationMap[loc] = { count: 0, processingTimes: [], slaBreaches: 0 }
      locationMap[loc].count++
      if (fo.processingHours !== null) locationMap[loc].processingTimes.push(fo.processingHours)
      if (fo.slaBreach) locationMap[loc].slaBreaches++

      // Processing time
      if (fo.processingHours !== null) processingTimes.push(fo.processingHours)

      // SLA
      if (fo.fulfillBy) {
        slaTotal++
        if (fo.slaBreach) slaBreachCount++
        else slaOnTime++
      }

      // 3PL request status
      if (
        fo.requestStatus === 'SUBMITTED' ||
        fo.requestStatus === 'ACCEPTED' ||
        fo.requestStatus === 'REJECTED'
      ) {
        submittedCount++
      }
      if (fo.requestStatus === 'REJECTED' || fo.requestStatus === 'CANCELLATION_REJECTED') {
        rejectedCount++
      }
    }

    // Trend calculation
    const daySpan =
      startDate && endDate
        ? Math.ceil(
            (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
          )
        : 30
    const granularity: 'day' | 'week' | 'month' =
      daySpan <= 14 ? 'day' : daySpan <= 90 ? 'week' : 'month'

    const trendMap: Record<
      string,
      { created: number; fulfilled: number; onHold: number; processingTimes: number[] }
    > = {}
    for (const fo of fulfillmentOrders) {
      const key = getGroupKey(fo.createdAt, granularity)
      if (!trendMap[key])
        trendMap[key] = { created: 0, fulfilled: 0, onHold: 0, processingTimes: [] }
      trendMap[key].created++
      if (fo.status === 'CLOSED') trendMap[key].fulfilled++
      if (fo.status === 'ON_HOLD') trendMap[key].onHold++
      if (fo.processingHours !== null) trendMap[key].processingTimes.push(fo.processingHours)
    }

    const trend: ShopifyFulfillmentOpsTrendPoint[] = Object.entries(trendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        created: d.created,
        fulfilled: d.fulfilled,
        onHold: d.onHold,
        avgProcessingHours:
          d.processingTimes.length > 0
            ? Math.round(
                (d.processingTimes.reduce((s, v) => s + v, 0) / d.processingTimes.length) * 10
              ) / 10
            : 0,
      }))

    const avgProcessingHours =
      processingTimes.length > 0
        ? Math.round((processingTimes.reduce((s, v) => s + v, 0) / processingTimes.length) * 10) /
          10
        : 0

    const statusBreakdown = (
      [
        'OPEN',
        'IN_PROGRESS',
        'ON_HOLD',
        'SCHEDULED',
        'CLOSED',
        'CANCELLED',
        'INCOMPLETE',
      ] as ShopifyFulfillmentOrderStatus[]
    )
      .map((status) => ({ status, count: statusCounts[status] || 0 }))
      .filter((b) => b.count > 0)

    const holdReasonBreakdown = Object.entries(holdReasonCounts)
      .map(([reason, count]) => ({ reason: reason as ShopifyFulfillmentHoldReason, count }))
      .sort((a, b) => b.count - a.count)

    const deliveryMethodBreakdown = Object.entries(deliveryMethodCounts)
      .map(([method, count]) => ({ method: method as ShopifyDeliveryMethodType, count }))
      .sort((a, b) => b.count - a.count)

    const locationBreakdown = Object.entries(locationMap)
      .map(([location, data]) => ({
        location,
        count: data.count,
        avgProcessingHours:
          data.processingTimes.length > 0
            ? Math.round(
                (data.processingTimes.reduce((s, v) => s + v, 0) / data.processingTimes.length) * 10
              ) / 10
            : 0,
        slaBreachCount: data.slaBreaches,
      }))
      .sort((a, b) => b.count - a.count)

    const summary: ShopifyFulfillmentOpsSummary = {
      totalFulfillmentOrders: fulfillmentOrders.length,
      openCount: statusCounts['OPEN'] || 0,
      inProgressCount: statusCounts['IN_PROGRESS'] || 0,
      onHoldCount: statusCounts['ON_HOLD'] || 0,
      scheduledCount: statusCounts['SCHEDULED'] || 0,
      closedCount: statusCounts['CLOSED'] || 0,
      cancelledCount: statusCounts['CANCELLED'] || 0,
      incompleteCount: statusCounts['INCOMPLETE'] || 0,
      slaBreachCount,
      slaComplianceRate: slaTotal > 0 ? Math.round((slaOnTime / slaTotal) * 1000) / 10 : 100,
      avgProcessingHours,
      medianProcessingHours: Math.round(median(processingTimes) * 10) / 10,
      rejectionRate:
        submittedCount > 0 ? Math.round((rejectedCount / submittedCount) * 1000) / 10 : 0,
      holdRate:
        fulfillmentOrders.length > 0
          ? Math.round((holdCount / fulfillmentOrders.length) * 1000) / 10
          : 0,
      holdReasonBreakdown,
      statusBreakdown,
      deliveryMethodBreakdown,
      locationBreakdown,
      trend,
      currency: 'USD',
    }

    const response: ShopifyFulfillmentOpsResponse = {
      fulfillmentOrders,
      summary,
      trendGranularity: granularity,
      warning,
    }

    return NextResponse.json({ data: response })
  } catch (err: any) {
    console.error('[Shopify Fulfillments]', err)
    return NextResponse.json(
      { error: err.message || 'Failed to load fulfillment orders' },
      { status: 500 }
    )
  }
})
