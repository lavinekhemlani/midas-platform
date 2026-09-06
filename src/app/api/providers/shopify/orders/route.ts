import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'
import { getPreviousPeriodRange } from '@/lib/utils/dateRanges'
import type {
  ShopifyOrder,
  ShopifyGraphQLOrderNode,
  ShopifyGraphQLFulfillment,
  ShopifyOrderTrendPoint,
  ShopifyFulfillmentSpeedPoint,
  ShopifyOrdersKPIs,
  ShopifyKPICardData,
} from '@/lib/providers/shopify/types'

type GraphQLOrderWithDetails = ShopifyGraphQLOrderNode & {
  fulfillments: ShopifyGraphQLFulfillment[]
  riskLevel: string | null
  customerOrderIndex?: number | null
}

type OrderEnrichment = {
  cancelReason: string | null
  cancelledAt: string | null
  channelName: string | null
  channelHandle: string | null
  appName: string | null
  publicationName: string | null
  paymentTermsName: string | null
  paymentTermsDueInDays: number | null
  customerOrderIndex: number | null
  retailLocationName: string | null
}

// ─── Helpers ────────────────────────────────────────────────

function computeMedian(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = []
  const d = new Date(start + 'T00:00:00Z')
  const endDate = new Date(end + 'T00:00:00Z')
  while (d <= endDate) {
    days.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return days
}

function buildKPI(current: number, prev: number, sparkline: number[]): ShopifyKPICardData {
  const changePercent = prev > 0 ? Math.round(((current - prev) / prev) * 100) : null
  return { value: current, prevValue: prev, changePercent, sparkline }
}

function parseQLRow(result: any): Record<string, number> {
  if (!result?.columns || !result?.rows?.length) return {}
  const out: Record<string, number> = {}
  result.columns.forEach((c: any, i: number) => {
    const name = c.name || c.displayName
    if (name && result.rows[0][i] != null) {
      out[name] = parseFloat(String(result.rows[0][i])) || 0
    }
  })
  return out
}

// ─── Route ──────────────────────────────────────────────────

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const url = new URL(request.url)
    const limit = url.searchParams.get('limit') || '50'
    const status = url.searchParams.get('status') || 'any'
    const dateField = url.searchParams.get('date_field') || 'created_at'
    const dateMin = url.searchParams.get(`${dateField}_min`) || url.searchParams.get('startDate')
    const dateMax = url.searchParams.get(`${dateField}_max`) || url.searchParams.get('endDate')

    const orderParams: Record<string, string> = { limit, status }
    const countParams: Record<string, string> = { status }

    if (dateMin) {
      const iso = dateMin.includes('T') ? dateMin : `${dateMin}T00:00:00Z`
      orderParams[`${dateField}_min`] = iso
      countParams[`${dateField}_min`] = iso
    }
    if (dateMax) {
      const iso = dateMax.includes('T') ? dateMax : `${dateMax}T23:59:59Z`
      orderParams[`${dateField}_max`] = iso
      countParams[`${dateField}_max`] = iso
    }

    let orders: ShopifyOrder[] = []
    let totalCount = 0
    let storeTimezone: string | undefined
    let protectedDataError = false

    try {
      ;[orders, totalCount] = await Promise.all([
        client.getOrders(orderParams),
        client.getOrdersCount(countParams),
      ])
      try {
        const shop = await client.getShop()
        storeTimezone = shop.iana_timezone
      } catch {
        // Non-critical
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes('403')) {
        protectedDataError = true
      } else {
        throw error
      }
    }

    if (protectedDataError) {
      return NextResponse.json({
        data: {
          orders: [],
          summary: {
            totalCount: 0,
            totalRevenue: 0,
            avgOrderValue: 0,
            fulfilledCount: 0,
            refundedCount: 0,
            unfulfilled: 0,
            partiallyFulfilled: 0,
            pendingPayment: 0,
            cancelledCount: 0,
            currency: 'USD',
          },
          fulfillmentPipeline: null,
          warning:
            'Protected customer data access required. Enable it in your Shopify app settings under Configuration > Protected customer data access.',
        },
      })
    }

    // ─── ShopifyQL + GraphQL parallel fetches ───────────────
    let graphqlOrders: GraphQLOrderWithDetails[] | null = null
    let graphqlWarning: string | undefined
    let shopifyqlGrossSales: number | null = null
    let shopifyqlReturns: number | null = null
    let shopifyqlOrders: number | null = null
    let shopifyqlItems: number | null = null
    let qlOrdersFulfilled: number | null = null
    let qlOrdersDelivered: number | null = null
    let qlOrdersShipped: number | null = null

    const qlDateFilter =
      dateMin && dateMax
        ? `SINCE ${dateMin.slice(0, 10)} UNTIL ${dateMax.slice(0, 10)}`
        : dateMin
          ? `SINCE ${dateMin.slice(0, 10)}`
          : null

    // GraphQL: use updated_at so we capture orders fulfilled/delivered in period
    const gqlUpdatedQuery =
      dateMin && dateMax
        ? `updated_at:>=${dateMin.slice(0, 10)} updated_at:<=${dateMax.slice(0, 10)}`
        : dateMin
          ? `updated_at:>=${dateMin.slice(0, 10)}`
          : undefined

    const parallelPromises: Promise<any>[] = [
      // [0] GraphQL: fulfillments/risk — 250 max, updated_at filtered
      client.getOrdersWithFulfillments(250, gqlUpdatedQuery),
    ]
    if (qlDateFilter) {
      // [1] ShopifyQL sales: orders count, gross_sales, returns (authoritative)
      parallelPromises.push(
        client.shopifyqlQuery(`FROM sales SHOW gross_sales, returns, orders ${qlDateFilter}`)
      )
      // [2] ShopifyQL fulfillments: fulfilled, shipped, delivered (authoritative)
      parallelPromises.push(
        client.shopifyqlQuery(
          `FROM fulfillments SHOW orders_fulfilled, orders_shipped, orders_delivered ${qlDateFilter}`
        )
      )
      // [3] ShopifyQL items ordered — try products, then sales fallback
      parallelPromises.push(
        client
          .shopifyqlQuery(`FROM products SHOW sum(ordered_product_quantity) ${qlDateFilter}`)
          .catch(() => client.shopifyqlQuery(`FROM sales SHOW units_sold ${qlDateFilter}`))
          .catch(() => null)
      )
    }

    const settled = await Promise.allSettled(parallelPromises)

    // [0] GraphQL
    if (settled[0].status === 'fulfilled') {
      graphqlOrders = settled[0].value
    } else {
      console.warn('GraphQL fulfillment/risk fetch failed:', settled[0].reason)
      const msg = settled[0].reason instanceof Error ? settled[0].reason.message : ''
      graphqlWarning =
        msg.includes('protected') || msg.includes('not approved')
          ? 'Fulfillment tracking and risk data require Protected Customer Data access. Enable it in your Shopify app settings.'
          : 'Fulfillment pipeline and risk data unavailable — using basic order data.'
    }

    // [1] ShopifyQL sales
    if (qlDateFilter && settled[1]?.status === 'fulfilled') {
      const data = parseQLRow(settled[1].value)
      if (data.gross_sales != null) shopifyqlGrossSales = data.gross_sales
      if (data.returns != null) shopifyqlReturns = Math.abs(data.returns)
      if (data.orders != null) shopifyqlOrders = Math.round(data.orders)
    }

    // [2] ShopifyQL fulfillments — authoritative for fulfilled/shipped/delivered
    if (qlDateFilter && settled[2]?.status === 'fulfilled') {
      const data = parseQLRow(settled[2].value)
      if (data.orders_fulfilled != null) qlOrdersFulfilled = Math.round(data.orders_fulfilled)
      if (data.orders_shipped != null) qlOrdersShipped = Math.round(data.orders_shipped)
      if (data.orders_delivered != null) qlOrdersDelivered = Math.round(data.orders_delivered)
    } else if (qlDateFilter && settled[2]?.status === 'rejected') {
      console.warn('ShopifyQL fulfillments query failed:', (settled[2] as any).reason)
    }

    // [3] ShopifyQL items ordered
    if (qlDateFilter && settled[3]?.status === 'fulfilled' && settled[3].value?.rows?.length) {
      const cols = settled[3].value.columns
      const row = settled[3].value.rows[0]
      const qtyIdx = cols.findIndex((c: any) => {
        const name = (c.name || c.displayName || '').toLowerCase()
        return name.includes('ordered_product_quantity') || name.includes('units_sold')
      })
      if (qtyIdx >= 0) {
        shopifyqlItems = Math.round(parseFloat(String(row[qtyIdx])) || 0)
      }
    }

    // ─── Summary stats from REST ────────────────────────────
    const allOrders = orders.filter((o) => !o.test)
    const cancelledCount = allOrders.filter((o) => o.cancelled_at !== null).length

    const restGrossSales = allOrders.reduce(
      (sum, o) => sum + parseFloat(o.total_line_items_price || '0'),
      0
    )
    const grossSales = shopifyqlGrossSales ?? restGrossSales
    const grossSalesSource = shopifyqlGrossSales != null ? 'shopifyql' : 'rest'
    const totalRevenue = allOrders.reduce((sum, o) => sum + parseFloat(o.total_price || '0'), 0)
    const avgOrderValue = allOrders.length > 0 ? totalRevenue / allOrders.length : 0
    const restFulfilledCount = allOrders.filter((o) => o.fulfillment_status === 'fulfilled').length
    const fulfilledCount = qlOrdersFulfilled ?? restFulfilledCount
    const refundedCount = allOrders.filter(
      (o) => o.financial_status === 'refunded' || o.financial_status === 'partially_refunded'
    ).length
    const unfulfilled = allOrders.filter((o) => o.fulfillment_status === null).length
    const partiallyFulfilled = allOrders.filter((o) => o.fulfillment_status === 'partial').length
    const pendingPayment = allOrders.filter(
      (o) => o.financial_status === 'pending' || o.financial_status === 'authorized'
    ).length

    // ─── Trend data ─────────────────────────────────────────
    const rangeMs =
      dateMin && dateMax ? new Date(dateMax).getTime() - new Date(dateMin).getTime() : Infinity
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

    let orderTrend: ShopifyOrderTrendPoint[] = []
    let prevOrderTrend: ShopifyOrderTrendPoint[] = []
    let prevFulfillmentSpeedTrend: ShopifyFulfillmentSpeedPoint[] = []
    let trendSource: 'shopifyql' | 'rest' = 'rest'

    if (dateMin && dateMax) {
      try {
        const dateFilter = `SINCE ${dateMin.slice(0, 10)} UNTIL ${dateMax.slice(0, 10)}`
        const timeseriesGranularity = granularity === 'week' ? 'week' : granularity
        const [salesResult, aovResult] = await Promise.all([
          client.shopifyqlQuery(
            `FROM sales SHOW total_sales, gross_sales, discounts, net_sales, shipping, taxes, orders TIMESERIES ${timeseriesGranularity} ${dateFilter}`
          ),
          client.shopifyqlQuery(
            `FROM sales SHOW average_order_value TIMESERIES ${timeseriesGranularity} ${dateFilter}`
          ),
        ])

        const salesCols = salesResult.columns.map((c: any) => c.name || c.displayName)
        const aovCols = aovResult.columns.map((c: any) => c.name || c.displayName)
        const dateColIdx = salesCols.findIndex((n: string) => /day|week|month/i.test(n))
        const totalSalesIdx = salesCols.indexOf('total_sales')
        const grossSalesIdx = salesCols.indexOf('gross_sales')
        const discountsIdx = salesCols.indexOf('discounts')
        const netSalesIdx = salesCols.indexOf('net_sales')
        const shippingIdx = salesCols.indexOf('shipping')
        const taxesIdx = salesCols.indexOf('taxes')
        const ordersIdx = salesCols.indexOf('orders')
        const aovDateIdx = aovCols.findIndex((n: string) => /day|week|month/i.test(n))
        const aovIdx = aovCols.indexOf('average_order_value')

        if (dateColIdx >= 0 && ordersIdx >= 0) {
          const aovMap = new Map<string, number>()
          if (aovDateIdx >= 0 && aovIdx >= 0) {
            for (const row of aovResult.rows) {
              const key = String(row[aovDateIdx]).slice(0, 10)
              aovMap.set(key, parseFloat(String(row[aovIdx])) || 0)
            }
          }
          orderTrend = salesResult.rows.map((row: any[]) => {
            const dateKey = String(row[dateColIdx]).slice(0, 10)
            const orderCount = parseInt(String(row[ordersIdx]), 10) || 0
            const gross = grossSalesIdx >= 0 ? parseFloat(String(row[grossSalesIdx])) || 0 : 0
            const total = totalSalesIdx >= 0 ? parseFloat(String(row[totalSalesIdx])) || 0 : 0
            return {
              date: dateKey,
              orders: orderCount,
              revenue: total,
              grossSales: gross,
              discounts: discountsIdx >= 0 ? parseFloat(String(row[discountsIdx])) || 0 : 0,
              netSales: netSalesIdx >= 0 ? parseFloat(String(row[netSalesIdx])) || 0 : 0,
              shipping: shippingIdx >= 0 ? parseFloat(String(row[shippingIdx])) || 0 : 0,
              taxes: taxesIdx >= 0 ? parseFloat(String(row[taxesIdx])) || 0 : 0,
              avgOrderValue: aovMap.get(dateKey) ?? (orderCount > 0 ? total / orderCount : 0),
            }
          })
          trendSource = 'shopifyql'
        }
      } catch {
        // ShopifyQL unavailable — fall back to REST
      }
    }

    if (trendSource === 'rest') {
      const orderTrendMap = new Map<
        string,
        {
          orders: number
          grossSales: number
          discounts: number
          netSales: number
          shipping: number
          taxes: number
          revenue: number
        }
      >()
      for (const order of allOrders) {
        if (!order.created_at) continue
        const key = getGroupKey(order.created_at)
        const existing = orderTrendMap.get(key) || {
          orders: 0,
          grossSales: 0,
          discounts: 0,
          netSales: 0,
          shipping: 0,
          taxes: 0,
          revenue: 0,
        }
        existing.orders++
        existing.grossSales += parseFloat(order.total_line_items_price || '0')
        existing.discounts += parseFloat(order.total_discounts || '0')
        existing.netSales += parseFloat(order.subtotal_price || '0')
        existing.shipping +=
          order.shipping_lines?.reduce((s: number, l: any) => s + parseFloat(l.price || '0'), 0) ||
          0
        existing.taxes += parseFloat(order.total_tax || '0')
        existing.revenue += parseFloat(order.total_price || '0')
        orderTrendMap.set(key, existing)
      }
      orderTrend = Array.from(orderTrendMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, d]) => ({
          date,
          orders: d.orders,
          revenue: d.revenue,
          grossSales: d.grossSales,
          discounts: d.discounts,
          netSales: d.netSales,
          shipping: d.shipping,
          taxes: d.taxes,
          avgOrderValue: d.orders > 0 ? d.revenue / d.orders : 0,
        }))
    }

    let fulfillmentSpeedTrend: ShopifyFulfillmentSpeedPoint[] = []
    if (graphqlOrders) {
      const speedMap = new Map<string, { totalDays: number; count: number }>()
      for (const order of graphqlOrders) {
        if (!order.createdAt || !order.fulfillments || order.fulfillments.length === 0) continue
        const fulfillment = order.fulfillments.find((f) => f.createdAt)
        if (!fulfillment || !fulfillment.createdAt) continue
        const diffDays =
          (new Date(fulfillment.createdAt).getTime() - new Date(order.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
        const key = getGroupKey(order.createdAt)
        const existing = speedMap.get(key) || { totalDays: 0, count: 0 }
        existing.totalDays += diffDays
        existing.count++
        speedMap.set(key, existing)
      }
      fulfillmentSpeedTrend = Array.from(speedMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, { totalDays, count }]) => ({
          date,
          avgDaysToFulfill: count > 0 ? totalDays / count : 0,
          ordersCount: count,
        }))
    }

    const fulfillmentPipeline = {
      unfulfilled,
      partiallyFulfilled,
      fulfilled: fulfilledCount,
      cancelled: cancelledCount,
    }

    let riskHigh = 0
    let riskMedium = 0
    const riskOrders: Array<{
      name: string
      customer: string
      total: string
      currency: string
      createdAt: string
      riskLevel: 'high' | 'medium'
    }> = []
    if (graphqlOrders) {
      for (const order of graphqlOrders) {
        if (order.riskLevel === 'CANCEL') {
          riskHigh++
          riskOrders.push({
            name: order.name,
            customer: '',
            total: order.totalPriceSet.shopMoney.amount,
            currency: order.totalPriceSet.shopMoney.currencyCode,
            createdAt: order.createdAt,
            riskLevel: 'high',
          })
        }
        if (order.riskLevel === 'INVESTIGATE') {
          riskMedium++
          riskOrders.push({
            name: order.name,
            customer: '',
            total: order.totalPriceSet.shopMoney.amount,
            currency: order.totalPriceSet.shopMoney.currencyCode,
            createdAt: order.createdAt,
            riskLevel: 'medium',
          })
        }
      }
      // Match customer names from REST orders by order name
      const restByName = new Map(orders.map((o) => [o.name, o]))
      for (const ro of riskOrders) {
        const rest = restByName.get(ro.name)
        if (rest?.customer) {
          ro.customer = `${rest.customer.first_name || ''} ${rest.customer.last_name || ''}`.trim()
        }
      }
    }

    // ─── KPI Computation ────────────────────────────────────
    let kpis: ShopifyOrdersKPIs | undefined
    let prevGrossSales = 0
    let prevNetSales = 0

    if (dateMin && dateMax) {
      const startStr = dateMin.slice(0, 10)
      const endStr = dateMax.slice(0, 10)
      const prev = getPreviousPeriodRange(startStr, endStr)

      // --- Current period values ---
      // Orders: ShopifyQL sales → REST fallback
      const currentOrders = shopifyqlOrders ?? (totalCount || allOrders.length)

      // Items ordered: ShopifyQL → REST line_items fallback
      const restItems = allOrders.reduce(
        (sum, o) => sum + (o.line_items || []).reduce((s, li) => s + (li.quantity || 0), 0),
        0
      )
      const currentItems = shopifyqlItems ?? restItems

      // Returns: ShopifyQL → REST refund transactions fallback
      let restReturns = 0
      const dailyReturns = new Map<string, number>()
      for (const order of allOrders) {
        if (!order.refunds) continue
        for (const refund of order.refunds) {
          const refundTotal =
            refund.transactions
              ?.filter((t) => t.kind === 'refund' && t.status === 'success')
              .reduce((s, t) => s + parseFloat(t.amount || '0'), 0) ?? 0
          restReturns += refundTotal
          if (refund.created_at) {
            const day = refund.created_at.slice(0, 10)
            dailyReturns.set(day, (dailyReturns.get(day) || 0) + refundTotal)
          }
        }
      }
      const currentReturns = shopifyqlReturns ?? restReturns

      // Fulfilled: ShopifyQL fulfillments (authoritative) → GraphQL event-date fallback
      let gqlFulfilledInPeriod = 0
      let gqlDeliveredInPeriod = 0
      const dailyFulfilled = new Map<string, number>()
      const dailyDelivered = new Map<string, number>()
      const fulfillmentHours: number[] = []
      const dailyFulfillmentHours = new Map<string, number[]>()

      if (graphqlOrders) {
        const periodStart = new Date(`${startStr}T00:00:00Z`).getTime()
        const periodEnd = new Date(`${endStr}T23:59:59Z`).getTime()

        for (const order of graphqlOrders) {
          if (!order.fulfillments || order.fulfillments.length === 0) continue

          // Fulfilled: fulfillment created in the period
          for (const f of order.fulfillments) {
            if (f.createdAt) {
              const fTime = new Date(f.createdAt).getTime()
              if (fTime >= periodStart && fTime <= periodEnd) {
                gqlFulfilledInPeriod++
                const day = f.createdAt.slice(0, 10)
                dailyFulfilled.set(day, (dailyFulfilled.get(day) || 0) + 1)
                // Fulfillment time
                if (order.createdAt) {
                  const hours = (fTime - new Date(order.createdAt).getTime()) / (1000 * 60 * 60)
                  fulfillmentHours.push(hours)
                  dailyFulfillmentHours.set(day, [...(dailyFulfillmentHours.get(day) || []), hours])
                }
                break // count each order once
              }
            }
          }

          // Delivered: deliveredAt in the period
          for (const f of order.fulfillments) {
            if (f.deliveredAt) {
              const dTime = new Date(f.deliveredAt).getTime()
              if (dTime >= periodStart && dTime <= periodEnd) {
                gqlDeliveredInPeriod++
                const day = f.deliveredAt.slice(0, 10)
                dailyDelivered.set(day, (dailyDelivered.get(day) || 0) + 1)
                break
              }
            }
          }
        }
      }

      // Use ShopifyQL fulfillments (authoritative) when available, GraphQL fallback
      const currentFulfilled = qlOrdersFulfilled ?? gqlFulfilledInPeriod
      const currentDelivered = qlOrdersDelivered ?? gqlDeliveredInPeriod
      const medianFulfillmentHours = computeMedian(fulfillmentHours)

      // --- Sparklines ---
      const dailyMap = new Map<string, { orders: number; items: number }>()
      for (const order of allOrders) {
        if (!order.created_at) continue
        const day = order.created_at.slice(0, 10)
        const entry = dailyMap.get(day) || { orders: 0, items: 0 }
        entry.orders++
        entry.items += (order.line_items || []).reduce((s, li) => s + (li.quantity || 0), 0)
        dailyMap.set(day, entry)
      }

      const allDays = getDaysInRange(startStr, endStr)
      const ordersSparkline = allDays.map((d) => dailyMap.get(d)?.orders ?? 0)
      const itemsSparkline = allDays.map((d) => dailyMap.get(d)?.items ?? 0)
      const returnsSparkline = allDays.map((d) => dailyReturns.get(d) ?? 0)
      const fulfilledSparkline = allDays.map((d) => dailyFulfilled.get(d) ?? 0)
      const deliveredSparkline = allDays.map((d) => dailyDelivered.get(d) ?? 0)
      const fulfillmentTimeSparkline = allDays.map((d) => {
        const arr = dailyFulfillmentHours.get(d)
        return arr && arr.length > 0 ? computeMedian(arr) : 0
      })

      // --- Previous period comparison ---
      let prevOrders = 0
      let prevItems = 0
      let prevReturns = 0
      let prevFulfilled = 0
      let prevDelivered = 0
      let prevFulfillmentHours = 0

      try {
        const prevQlFilter = `SINCE ${prev.start} UNTIL ${prev.end}`
        const prevIsoMin = `${prev.start}T00:00:00Z`
        const prevIsoMax = `${prev.end}T23:59:59Z`

        const prevTimeseriesGranularity = granularity === 'week' ? 'week' : granularity
        const prevSettled = await Promise.allSettled([
          // [0] ShopifyQL sales: orders + returns + financial metrics for KPI comparison
          client.shopifyqlQuery(
            `FROM sales SHOW orders, returns, gross_sales, net_sales ${prevQlFilter}`
          ),
          // [1] ShopifyQL fulfillments: fulfilled + delivered
          client.shopifyqlQuery(
            `FROM fulfillments SHOW orders_fulfilled, orders_delivered ${prevQlFilter}`
          ),
          // [2] ShopifyQL items
          client
            .shopifyqlQuery(`FROM products SHOW sum(ordered_product_quantity) ${prevQlFilter}`)
            .catch(() => client.shopifyqlQuery(`FROM sales SHOW units_sold ${prevQlFilter}`))
            .catch(() => null),
          // [3] REST: fallback data
          client.getOrders({
            limit: '250',
            status: 'any',
            [`${dateField}_min`]: prevIsoMin,
            [`${dateField}_max`]: prevIsoMax,
          }),
          // [4] GraphQL: fulfillment time + fallback for fulfilled/delivered
          client.getOrdersWithFulfillments(
            250,
            `updated_at:>=${prev.start} updated_at:<=${prev.end}`
          ),
          // [5] ShopifyQL previous period sales timeseries (for AOV trend)
          Promise.all([
            client.shopifyqlQuery(
              `FROM sales SHOW total_sales, gross_sales, discounts, net_sales, shipping, taxes, orders TIMESERIES ${prevTimeseriesGranularity} ${prevQlFilter}`
            ),
            client.shopifyqlQuery(
              `FROM sales SHOW average_order_value TIMESERIES ${prevTimeseriesGranularity} ${prevQlFilter}`
            ),
          ]),
        ])

        // [0] Previous period sales + financial metrics
        if (prevSettled[0].status === 'fulfilled') {
          const data = parseQLRow(prevSettled[0].value)
          if (data.orders != null) prevOrders = Math.round(data.orders)
          if (data.returns != null) prevReturns = Math.abs(data.returns)
          if (data.gross_sales != null) prevGrossSales = data.gross_sales
          if (data.net_sales != null) prevNetSales = data.net_sales
        }

        // [1] Previous period fulfillments
        if (prevSettled[1].status === 'fulfilled') {
          const data = parseQLRow(prevSettled[1].value)
          if (data.orders_fulfilled != null) prevFulfilled = Math.round(data.orders_fulfilled)
          if (data.orders_delivered != null) prevDelivered = Math.round(data.orders_delivered)
        }

        // [2] Previous period items
        if (prevSettled[2].status === 'fulfilled' && prevSettled[2].value?.rows?.length) {
          const cols = prevSettled[2].value.columns
          const row = prevSettled[2].value.rows[0]
          const qtyIdx = cols.findIndex((c: any) => {
            const name = (c.name || c.displayName || '').toLowerCase()
            return name.includes('ordered_product_quantity') || name.includes('units_sold')
          })
          if (qtyIdx >= 0) prevItems = Math.round(parseFloat(String(row[qtyIdx])) || 0)
        }

        // [3] REST fallbacks
        if (prevSettled[3].status === 'fulfilled') {
          const prevAll = (prevSettled[3].value as ShopifyOrder[]).filter((o) => !o.test)
          if (prevOrders === 0) prevOrders = prevAll.length
          if (prevItems === 0) {
            prevItems = prevAll.reduce(
              (sum: number, o: ShopifyOrder) =>
                sum + (o.line_items || []).reduce((s, li) => s + (li.quantity || 0), 0),
              0
            )
          }
          if (prevReturns === 0) {
            for (const o of prevAll) {
              if (!o.refunds) continue
              for (const refund of o.refunds) {
                prevReturns +=
                  refund.transactions
                    ?.filter((t) => t.kind === 'refund' && t.status === 'success')
                    .reduce((s, t) => s + parseFloat(t.amount || '0'), 0) ?? 0
              }
            }
          }
          // REST fallback for previous period order trend (AOV)
          if (prevOrderTrend.length === 0 && prevAll.length > 0) {
            const prevTrendMap = new Map<
              string,
              {
                orders: number
                grossSales: number
                discounts: number
                netSales: number
                shipping: number
                taxes: number
                revenue: number
              }
            >()
            for (const order of prevAll) {
              if (!order.created_at) continue
              const key = getGroupKey(order.created_at)
              const existing = prevTrendMap.get(key) || {
                orders: 0,
                grossSales: 0,
                discounts: 0,
                netSales: 0,
                shipping: 0,
                taxes: 0,
                revenue: 0,
              }
              existing.orders++
              existing.grossSales += parseFloat(order.total_line_items_price || '0')
              existing.discounts += parseFloat(order.total_discounts || '0')
              existing.netSales += parseFloat(order.subtotal_price || '0')
              existing.shipping +=
                order.shipping_lines?.reduce(
                  (s: number, l: any) => s + parseFloat(l.price || '0'),
                  0
                ) || 0
              existing.taxes += parseFloat(order.total_tax || '0')
              existing.revenue += parseFloat(order.total_price || '0')
              prevTrendMap.set(key, existing)
            }
            prevOrderTrend = Array.from(prevTrendMap.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, d]) => ({
                date,
                orders: d.orders,
                revenue: d.revenue,
                grossSales: d.grossSales,
                discounts: d.discounts,
                netSales: d.netSales,
                shipping: d.shipping,
                taxes: d.taxes,
                avgOrderValue: d.orders > 0 ? d.revenue / d.orders : 0,
              }))
          }
        }

        // [4] GraphQL: fulfillment time + fallback for fulfilled/delivered
        if (prevSettled[4].status === 'fulfilled') {
          const prevGql = prevSettled[4].value as GraphQLOrderWithDetails[]
          const prevFulfHours: number[] = []
          const pStart = new Date(`${prev.start}T00:00:00Z`).getTime()
          const pEnd = new Date(`${prev.end}T23:59:59Z`).getTime()
          let gqlPrevFulfilled = 0
          let gqlPrevDelivered = 0

          for (const order of prevGql) {
            if (!order.fulfillments || order.fulfillments.length === 0) continue
            for (const f of order.fulfillments) {
              if (f.createdAt) {
                const fTime = new Date(f.createdAt).getTime()
                if (fTime >= pStart && fTime <= pEnd) {
                  gqlPrevFulfilled++
                  if (order.createdAt) {
                    prevFulfHours.push(
                      (fTime - new Date(order.createdAt).getTime()) / (1000 * 60 * 60)
                    )
                  }
                  break
                }
              }
            }
            for (const f of order.fulfillments) {
              if (f.deliveredAt) {
                const dTime = new Date(f.deliveredAt).getTime()
                if (dTime >= pStart && dTime <= pEnd) {
                  gqlPrevDelivered++
                  break
                }
              }
            }
          }
          // Use GraphQL as fallback if ShopifyQL fulfillments didn't return data
          if (prevFulfilled === 0) prevFulfilled = gqlPrevFulfilled
          if (prevDelivered === 0) prevDelivered = gqlPrevDelivered
          prevFulfillmentHours = computeMedian(prevFulfHours)

          // Build previous period fulfillment speed trend from GraphQL data
          const prevSpeedMap = new Map<string, { totalDays: number; count: number }>()
          for (const order of prevGql) {
            if (!order.fulfillments || order.fulfillments.length === 0 || !order.createdAt) continue
            const fulfillment = order.fulfillments.find((f) => f.createdAt)
            if (!fulfillment || !fulfillment.createdAt) continue
            const diffDays =
              (new Date(fulfillment.createdAt).getTime() - new Date(order.createdAt).getTime()) /
              (1000 * 60 * 60 * 24)
            const key = getGroupKey(order.createdAt)
            const existing = prevSpeedMap.get(key) || { totalDays: 0, count: 0 }
            existing.totalDays += diffDays
            existing.count++
            prevSpeedMap.set(key, existing)
          }
          prevFulfillmentSpeedTrend = Array.from(prevSpeedMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, { totalDays, count }]) => ({
              date,
              avgDaysToFulfill: count > 0 ? totalDays / count : 0,
              ordersCount: count,
            }))
        }

        // [5] Previous period sales timeseries (AOV trend)
        if (prevSettled[5].status === 'fulfilled') {
          const [prevSalesResult, prevAovResult] = prevSettled[5].value as [any, any]
          const prevSalesCols =
            prevSalesResult.columns?.map((c: any) => c.name || c.displayName) ?? []
          const prevAovCols = prevAovResult.columns?.map((c: any) => c.name || c.displayName) ?? []
          const prevDateColIdx = prevSalesCols.findIndex((n: string) => /day|week|month/i.test(n))
          const prevTotalSalesIdx = prevSalesCols.indexOf('total_sales')
          const prevGrossSalesIdx = prevSalesCols.indexOf('gross_sales')
          const prevDiscountsIdx = prevSalesCols.indexOf('discounts')
          const prevNetSalesIdx = prevSalesCols.indexOf('net_sales')
          const prevShippingIdx = prevSalesCols.indexOf('shipping')
          const prevTaxesIdx = prevSalesCols.indexOf('taxes')
          const prevOrdersIdx = prevSalesCols.indexOf('orders')
          const prevAovDateIdx = prevAovCols.findIndex((n: string) => /day|week|month/i.test(n))
          const prevAovIdx = prevAovCols.indexOf('average_order_value')

          if (prevDateColIdx >= 0 && prevOrdersIdx >= 0) {
            const prevAovMap = new Map<string, number>()
            if (prevAovDateIdx >= 0 && prevAovIdx >= 0) {
              for (const row of prevAovResult.rows) {
                const key = String(row[prevAovDateIdx]).slice(0, 10)
                prevAovMap.set(key, parseFloat(String(row[prevAovIdx])) || 0)
              }
            }
            prevOrderTrend = prevSalesResult.rows.map((row: any[]) => {
              const dateKey = String(row[prevDateColIdx]).slice(0, 10)
              const orderCount = parseInt(String(row[prevOrdersIdx]), 10) || 0
              const gross =
                prevGrossSalesIdx >= 0 ? parseFloat(String(row[prevGrossSalesIdx])) || 0 : 0
              const total =
                prevTotalSalesIdx >= 0 ? parseFloat(String(row[prevTotalSalesIdx])) || 0 : 0
              return {
                date: dateKey,
                orders: orderCount,
                revenue: total,
                grossSales: gross,
                discounts:
                  prevDiscountsIdx >= 0 ? parseFloat(String(row[prevDiscountsIdx])) || 0 : 0,
                netSales: prevNetSalesIdx >= 0 ? parseFloat(String(row[prevNetSalesIdx])) || 0 : 0,
                shipping: prevShippingIdx >= 0 ? parseFloat(String(row[prevShippingIdx])) || 0 : 0,
                taxes: prevTaxesIdx >= 0 ? parseFloat(String(row[prevTaxesIdx])) || 0 : 0,
                avgOrderValue: prevAovMap.get(dateKey) ?? (orderCount > 0 ? total / orderCount : 0),
              }
            })
          }
        }
      } catch (e) {
        console.warn('Previous period KPI fetch failed:', e)
      }

      // --- Build KPI cards ---
      kpis = {
        orders: buildKPI(currentOrders, prevOrders, ordersSparkline),
        itemsOrdered: buildKPI(currentItems, prevItems, itemsSparkline),
        returns: buildKPI(currentReturns, prevReturns, returnsSparkline),
        ordersFulfilled: buildKPI(currentFulfilled, prevFulfilled, fulfilledSparkline),
        ordersDelivered: buildKPI(currentDelivered, prevDelivered, deliveredSparkline),
        fulfillmentTime: buildKPI(
          medianFulfillmentHours,
          prevFulfillmentHours,
          fulfillmentTimeSparkline
        ),
      }
    }

    // Build per-order enrichment from GraphQL: keyed by order name
    const orderEnrichmentMap: Record<string, OrderEnrichment> = {}
    const cancellationReasons: Record<string, number> = {}
    const channelBreakdown: Record<string, number> = {}
    const retailLocationBreakdown: Record<string, number> = {}
    let firstTimeCount = 0
    let repeatCount = 0
    let b2bCount = 0

    // New financial KPI accumulators (from GraphQL)
    let tipRevenue = 0
    let dutiesCollected = 0
    let outstandingBalance = 0
    let unpaidCount = 0
    let editedCount = 0
    let b2bOrderCount = 0
    let dtcOrderCount = 0
    const paymentGatewayBreakdown: Record<string, number> = {}

    if (graphqlOrders) {
      for (const o of graphqlOrders) {
        const node = o as GraphQLOrderWithDetails & {
          channelInformation?: any
          app?: { name: string } | null
          publication?: { name: string } | null
          paymentTerms?: any
          retailLocation?: { name: string } | null
          totalTipReceivedSet?: { shopMoney: { amount: string } } | null
          currentTotalDutiesSet?: { shopMoney: { amount: string } } | null
          totalOutstandingSet?: { shopMoney: { amount: string } } | null
          paymentGatewayNames?: string[] | null
          edited?: boolean | null
          unpaid?: boolean | null
          poNumber?: string | null
          purchasingEntity?: { __typename?: string } | null
        }
        const channelDef = node.channelInformation?.channelDefinition
        const channelName: string | null =
          channelDef?.channelName ?? channelDef?.subChannelName ?? null
        const channelHandle: string | null = channelDef?.handle ?? null
        const appName: string | null = node.app?.name ?? null
        const publicationName: string | null = node.publication?.name ?? null
        const paymentTermsName: string | null = node.paymentTerms?.paymentTermsName ?? null
        const paymentTermsDueInDays: number | null = node.paymentTerms?.dueInDays ?? null
        const retailLocationName: string | null = node.retailLocation?.name ?? null
        const cancelReason: string | null = node.cancelReason ?? null
        const cancelledAt: string | null = node.cancelledAt ?? null
        const customerOrderIndex: number | null = node.customerOrderIndex ?? null

        orderEnrichmentMap[o.name] = {
          cancelReason,
          cancelledAt,
          channelName,
          channelHandle,
          appName,
          publicationName,
          paymentTermsName,
          paymentTermsDueInDays,
          customerOrderIndex,
          retailLocationName,
        }

        if (cancelReason) {
          cancellationReasons[cancelReason] = (cancellationReasons[cancelReason] || 0) + 1
        }
        const channelLabel = channelName ?? appName ?? 'Unknown'
        channelBreakdown[channelLabel] = (channelBreakdown[channelLabel] || 0) + 1
        if (retailLocationName) {
          retailLocationBreakdown[retailLocationName] =
            (retailLocationBreakdown[retailLocationName] || 0) + 1
        }
        if (typeof customerOrderIndex === 'number') {
          if (customerOrderIndex <= 1) firstTimeCount++
          else repeatCount++
        }
        if (paymentTermsName) b2bCount++

        // --- Financial KPI accumulation ---
        tipRevenue += parseFloat(node.totalTipReceivedSet?.shopMoney?.amount || '0')
        dutiesCollected += parseFloat(node.currentTotalDutiesSet?.shopMoney?.amount || '0')
        outstandingBalance += parseFloat(node.totalOutstandingSet?.shopMoney?.amount || '0')
        if (node.unpaid) unpaidCount++
        if (node.edited) editedCount++

        // B2B vs DTC split — Shopify returns a PurchasingCompany typename for B2B orders
        const purchasingType = node.purchasingEntity?.__typename ?? null
        if (purchasingType === 'PurchasingCompany' || node.poNumber) {
          b2bOrderCount++
        } else if (purchasingType) {
          dtcOrderCount++
        }

        // Payment gateway breakdown — order can have multiple gateways (rare), count each
        const gateways = node.paymentGatewayNames ?? []
        for (const g of gateways) {
          if (!g) continue
          paymentGatewayBreakdown[g] = (paymentGatewayBreakdown[g] || 0) + 1
        }
      }
    }

    // Orders without any purchasingEntity typename fall back to DTC to keep the split total coherent
    const graphqlOrderCount = graphqlOrders?.length ?? 0
    if (graphqlOrderCount > 0 && dtcOrderCount === 0 && b2bOrderCount === 0) {
      dtcOrderCount = graphqlOrderCount
    } else if (graphqlOrderCount > 0) {
      const classified = b2bOrderCount + dtcOrderCount
      if (classified < graphqlOrderCount) {
        dtcOrderCount += graphqlOrderCount - classified
      }
    }

    const editedRate = graphqlOrderCount > 0 ? editedCount / graphqlOrderCount : 0

    // Build fulfillment location lookup: order name → ship-from location name(s)
    // Uses REST fulfillment location_id + Shopify Locations API for names
    const fulfillmentLocationMap: Record<string, string[]> = {}
    const locationIds = new Set<number>()
    for (const order of allOrders) {
      for (const f of (order as any).fulfillments || []) {
        if (f.location_id) locationIds.add(f.location_id)
      }
    }
    if (locationIds.size > 0) {
      try {
        const locations = await client.getLocations()
        const locationNameMap = new Map<number, string>()
        for (const loc of locations) {
          locationNameMap.set(loc.id, loc.name)
        }
        for (const order of allOrders) {
          const names = new Set<string>()
          for (const f of (order as any).fulfillments || []) {
            if (f.location_id && locationNameMap.has(f.location_id)) {
              names.add(locationNameMap.get(f.location_id)!)
            }
          }
          if (names.size > 0) {
            fulfillmentLocationMap[order.name] = [...names]
          }
        }
      } catch {
        // Locations API unavailable — leave map empty
      }
    }

    // Build geographic overview from order shipping addresses
    const geoOverview: { country: string; countryCode: string; city: string; count: number }[] = []
    const geoMap = new Map<
      string,
      { country: string; countryCode: string; city: string; count: number }
    >()
    for (const order of allOrders) {
      const addr = order.shipping_address || order.billing_address
      if (!addr?.country_code) continue
      const key = `${addr.country_code}::${addr.city || 'Unknown'}`
      const existing = geoMap.get(key)
      if (existing) {
        existing.count++
      } else {
        geoMap.set(key, {
          country: addr.country || addr.country_code,
          countryCode: addr.country_code,
          city: addr.city || 'Unknown',
          count: 1,
        })
      }
    }
    geoOverview.push(...Array.from(geoMap.values()).sort((a, b) => b.count - a.count))

    return NextResponse.json({
      data: {
        orders,
        summary: {
          totalCount: totalCount || orders.length,
          grossSales,
          grossSalesSource,
          totalRevenue,
          avgOrderValue,
          fulfilledCount,
          ordersDelivered: qlOrdersDelivered,
          ordersShipped: qlOrdersShipped,
          refundedCount,
          unfulfilled,
          partiallyFulfilled,
          pendingPayment,
          cancelledCount,
          riskHigh,
          riskMedium,
          currency: orders[0]?.currency || 'USD',
          // New financial KPIs (from GraphQL order nodes)
          tipRevenue,
          dutiesCollected,
          outstandingBalance,
          unpaidCount,
          editedCount,
          editedRate,
          b2bOrderCount,
          dtcOrderCount,
          paymentGatewayBreakdown,
        },
        kpis,
        financialKpis:
          kpis && orderTrend.length > 0
            ? {
                grossSales: buildKPI(
                  grossSales,
                  prevGrossSales,
                  orderTrend.map((d: any) => d.grossSales ?? d.revenue ?? 0)
                ),
                netRevenue: buildKPI(
                  totalRevenue,
                  prevNetSales,
                  orderTrend.map((d: any) => d.revenue ?? 0)
                ),
                avgOrderValue: buildKPI(
                  avgOrderValue,
                  kpis?.orders?.prevValue && kpis.orders.prevValue > 0
                    ? prevGrossSales / kpis.orders.prevValue
                    : 0,
                  orderTrend.map((d: any) =>
                    d.orders > 0 ? (d.grossSales ?? d.revenue ?? 0) / d.orders : 0
                  )
                ),
              }
            : undefined,
        fulfillmentPipeline,
        orderTrend,
        ...(prevOrderTrend.length > 0 && { prevOrderTrend }),
        fulfillmentSpeedTrend,
        ...(prevFulfillmentSpeedTrend.length > 0 && { prevFulfillmentSpeedTrend }),
        trendGranularity: granularity,
        ...(riskOrders.length > 0 && { riskOrders }),
        fulfillmentLocationMap,
        orderEnrichmentMap,
        attributionStats: {
          cancellationReasons,
          channelBreakdown,
          retailLocationBreakdown,
          firstTimeCount,
          repeatCount,
          b2bCount,
        },
        geoOverview: geoOverview.slice(0, 20),
        ...(storeTimezone && { storeTimezone }),
        ...(graphqlWarning && { graphqlWarning }),
      },
    })
  } catch (error) {
    console.error('Shopify orders error:', error)
    return NextResponse.json({ error: 'Failed to fetch Shopify orders' }, { status: 500 })
  }
})
