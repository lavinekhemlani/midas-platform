import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'
import { getPreviousPeriodRange } from '@/lib/utils/dateRanges'
import type {
  ShopifyOrder,
  ShopifyProduct,
  ShopifyCustomer,
  ShopifyBalance,
  ShopifyPayout,
} from '@/lib/providers/shopify/types'

// Helper to catch 403s on protected customer data endpoints
async function safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    // 403: protected customer data, 402: payment required, 404: endpoint not available (e.g. Shopify Payments)
    if (
      msg.includes('403') ||
      msg.includes('402') ||
      msg.includes('404') ||
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('protected customer data')
    ) {
      console.warn('Shopify data access denied or unavailable, using fallback:', msg.slice(0, 100))
      return fallback
    }
    throw error
  }
}

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    // Accept optional date range for order filtering
    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Default to created_at — Shopify's sales reports/dashboard use created_at for day grouping.
    // Use ?date_field=processed_at for payment-focused reporting.
    const dateField = url.searchParams.get('date_field') || 'created_at'

    // Build order query params with date filtering
    const orderParams: Record<string, string> = { limit: '250' }
    const countParams: Record<string, string> = {}
    if (startDate) {
      const iso = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`
      orderParams[`${dateField}_min`] = iso
      countParams[`${dateField}_min`] = iso
    }
    if (endDate) {
      const iso = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`
      orderParams[`${dateField}_max`] = iso
      countParams[`${dateField}_max`] = iso
    }

    // Fetch core data in batches of 2 to stay within Shopify's 2 req/s rate limit
    // Batch 1: shop info + orders (the two most important calls)
    const [shop, orders] = await Promise.all([
      client.getShop(),
      safeCall<ShopifyOrder[]>(() => client.getOrders(orderParams), []),
    ])

    // Batch 2: products + customers
    const [products, customers] = await Promise.all([
      safeCall<ShopifyProduct[]>(() => client.getProducts(), []),
      safeCall<ShopifyCustomer[]>(() => client.getCustomers(), []),
    ])

    // Batch 3: counts
    const [ordersCount, productsCount, customersCount] = await Promise.all([
      safeCall(() => client.getOrdersCount(countParams), 0),
      safeCall(() => client.getProductsCount(), 0),
      safeCall(() => client.getCustomersCount(), 0),
    ])

    // Batch 4: Shopify Payments data (may 404 if not using Shopify Payments)
    const [balance, payouts] = await Promise.all([
      safeCall<ShopifyBalance[]>(() => client.getBalance(), []),
      safeCall<ShopifyPayout[]>(() => client.getPayouts({ limit: '10' }), []),
    ])

    // Batch 5: ShopifyQL — dedicated gross_sales query + full breakdown (matching orders route)
    // REST only sees refunds on orders created in the period, but ShopifyQL counts
    // refunds processed in the period (on any order). This matches Shopify's dashboard.
    let shopifyqlBreakdown: {
      grossSales: number
      discounts: number
      returns: number
      netSales: number
      taxes: number
      shipping: number
      totalSales: number
      orders: number
    } | null = null
    let shopifyqlGrossSales: number | null = null

    // KPI sparklines + previous period comparison
    let kpiSparklines: {
      grossSales: number[]
      netSales: number[]
      orders: number[]
      discounts: number[]
      returns: number[]
      taxes: number[]
      shipping: number[]
    } | null = null
    let prevPeriod: {
      grossSales: number
      netSales: number
      orders: number
      discounts: number
      returns: number
      taxes: number
      shipping: number
    } | null = null

    // Build date filter matching orders route: only query ShopifyQL when dates exist,
    // use .slice(0, 10) for clean YYYY-MM-DD format
    const qlDateFilter =
      startDate && endDate
        ? `SINCE ${startDate.slice(0, 10)} UNTIL ${endDate.slice(0, 10)}`
        : startDate
          ? `SINCE ${startDate.slice(0, 10)}`
          : null

    // Build previous period date filter for KPI comparison
    let prevDateFilter: string | null = null
    if (startDate && endDate) {
      const prev = getPreviousPeriodRange(startDate, endDate)
      prevDateFilter = `SINCE ${prev.start} UNTIL ${prev.end}`
    }

    if (qlDateFilter) {
      try {
        // Run dedicated gross_sales query + full breakdown + daily trend + previous period in parallel
        const [grossSalesResult, breakdownResult, dailyTrendResult, prevBreakdownResult] =
          await Promise.allSettled([
            client.shopifyqlQuery(`FROM sales SHOW gross_sales ${qlDateFilter}`),
            client.shopifyqlQuery(
              `FROM sales SHOW gross_sales, discounts, returns, net_sales, taxes, total_sales, orders ${qlDateFilter}`
            ),
            // Daily sparkline data for KPI strip
            client.shopifyqlQuery(
              `FROM sales SHOW gross_sales, net_sales, orders, discounts, returns, taxes, total_sales TIMESERIES day ${qlDateFilter}`
            ),
            // Previous period for change %
            prevDateFilter
              ? client.shopifyqlQuery(
                  `FROM sales SHOW gross_sales, net_sales, orders, discounts, returns, taxes, total_sales ${prevDateFilter}`
                )
              : Promise.resolve(null),
          ])

        // Parse dedicated gross_sales (preferred source, matching orders route)
        if (grossSalesResult.status === 'fulfilled' && grossSalesResult.value?.rows?.length) {
          const colMap: Record<string, number> = {}
          grossSalesResult.value.columns.forEach((c: any, i: number) => {
            colMap[c.name] = i
          })
          shopifyqlGrossSales = parseFloat(
            grossSalesResult.value.rows[0][colMap['gross_sales']] || '0'
          )
        }

        // Parse full breakdown for other metrics
        if (breakdownResult.status === 'fulfilled' && breakdownResult.value?.rows?.length) {
          const colMap: Record<string, number> = {}
          breakdownResult.value.columns.forEach((c: any, i: number) => {
            colMap[c.name] = i
          })
          const row = breakdownResult.value.rows[0]
          const qlNetSales = parseFloat(row[colMap['net_sales']] || '0')
          const qlTaxes = parseFloat(row[colMap['taxes']] || '0')
          const qlTotalSales = parseFloat(row[colMap['total_sales']] || '0')
          shopifyqlBreakdown = {
            grossSales: parseFloat(row[colMap['gross_sales']] || '0'),
            discounts: parseFloat(row[colMap['discounts']] || '0'),
            returns: parseFloat(row[colMap['returns']] || '0'),
            netSales: qlNetSales,
            taxes: qlTaxes,
            shipping: qlTotalSales - qlNetSales - qlTaxes,
            totalSales: qlTotalSales,
            orders: parseInt(row[colMap['orders']] || '0', 10),
          }
        }
        // Parse daily trend for sparklines
        if (dailyTrendResult.status === 'fulfilled' && dailyTrendResult.value?.rows?.length) {
          const colMap: Record<string, number> = {}
          dailyTrendResult.value.columns.forEach((c: any, i: number) => {
            colMap[c.name] = i
          })
          const grossArr: number[] = []
          const netArr: number[] = []
          const ordersArr: number[] = []
          const discountsArr: number[] = []
          const returnsArr: number[] = []
          const taxesArr: number[] = []
          const shippingArr: number[] = []
          for (const row of dailyTrendResult.value.rows) {
            const dayNet = parseFloat(row[colMap['net_sales']] || '0')
            const dayTax = parseFloat(row[colMap['taxes']] || '0')
            const dayTotal = parseFloat(row[colMap['total_sales']] || '0')
            grossArr.push(parseFloat(row[colMap['gross_sales']] || '0'))
            netArr.push(dayNet)
            ordersArr.push(parseInt(row[colMap['orders']] || '0', 10))
            discountsArr.push(Math.abs(parseFloat(row[colMap['discounts']] || '0')))
            returnsArr.push(Math.abs(parseFloat(row[colMap['returns']] || '0')))
            taxesArr.push(dayTax)
            shippingArr.push(dayTotal - dayNet - dayTax)
          }
          kpiSparklines = {
            grossSales: grossArr,
            netSales: netArr,
            orders: ordersArr,
            discounts: discountsArr,
            returns: returnsArr,
            taxes: taxesArr,
            shipping: shippingArr,
          }
        }

        // Parse previous period for change %
        if (prevBreakdownResult.status === 'fulfilled' && prevBreakdownResult.value?.rows?.length) {
          const colMap: Record<string, number> = {}
          prevBreakdownResult.value.columns.forEach((c: any, i: number) => {
            colMap[c.name] = i
          })
          const row = prevBreakdownResult.value.rows[0]
          const prevNet = parseFloat(row[colMap['net_sales']] || '0')
          const prevTax = parseFloat(row[colMap['taxes']] || '0')
          const prevTotal = parseFloat(row[colMap['total_sales']] || '0')
          prevPeriod = {
            grossSales: parseFloat(row[colMap['gross_sales']] || '0'),
            netSales: prevNet,
            orders: parseInt(row[colMap['orders']] || '0', 10),
            discounts: Math.abs(parseFloat(row[colMap['discounts']] || '0')),
            returns: Math.abs(parseFloat(row[colMap['returns']] || '0')),
            taxes: prevTax,
            shipping: prevTotal - prevNet - prevTax,
          }
        }
      } catch {
        // ShopifyQL requires read_reports scope — fall through to REST approach
      }
    }

    // Batch 6: Capture refunds on older orders via updated_at (REST fallback)
    // Orders created before the date range but refunded during it won't appear in
    // the main created_at fetch. We fetch orders updated in the period and extract
    // refund transactions that occurred within the date window.
    let olderOrderRefunds = 0
    if (!shopifyqlBreakdown && startDate) {
      try {
        const updMinDate = new Date(startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`)
        const updatedOrders = await safeCall<ShopifyOrder[]>(
          () =>
            client.getOrders({
              limit: '250',
              status: 'any',
              updated_at_min: updMinDate.toISOString(),
              ...(endDate && {
                updated_at_max: endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`,
              }),
            }),
          []
        )
        for (const order of updatedOrders) {
          if (order.test) continue
          // Skip orders already in the created_at set
          if (new Date(order.created_at) >= updMinDate) continue
          if (
            order.financial_status !== 'refunded' &&
            order.financial_status !== 'partially_refunded'
          )
            continue
          for (const refund of order.refunds || []) {
            const refundDate = new Date(refund.processed_at || refund.created_at)
            if (refundDate < updMinDate) continue
            for (const txn of refund.transactions || []) {
              if (txn.kind === 'refund' && txn.status === 'success') {
                olderOrderRefunds += parseFloat(txn.amount || '0')
              }
            }
          }
        }
      } catch {
        // Best-effort — if this fails, refunds will be understated
      }
    }

    // --- Financial Breakdown ---
    // Exclude test orders only. Cancelled orders are excluded from net metrics but
    // included in gross_sales to match Shopify's dashboard. Refunded orders are also
    // included in gross_sales (refunds tracked separately).
    const allOrders = orders.filter((o) => !o.test)
    const cancelledCount = allOrders.filter((o) => o.cancelled_at !== null).length

    // gross_sales = sum of line item prices before discounts/tax/shipping (matches Shopify dashboard)
    const grossSales = allOrders.reduce(
      (sum, o) => sum + parseFloat(o.total_line_items_price || '0'),
      0
    )

    // total_price = customer-facing total (after discounts, including tax + shipping)
    const totalRevenue = allOrders.reduce((sum, o) => sum + parseFloat(o.total_price || '0'), 0)
    const totalSubtotal = allOrders.reduce((sum, o) => sum + parseFloat(o.subtotal_price || '0'), 0)
    const totalTax = allOrders.reduce((sum, o) => sum + parseFloat(o.total_tax || '0'), 0)
    const totalDiscounts = allOrders.reduce(
      (sum, o) => sum + parseFloat(o.total_discounts || '0'),
      0
    )
    const totalShipping = allOrders.reduce(
      (sum, o) => sum + parseFloat(o.total_shipping_price_set?.shop_money?.amount || '0'),
      0
    )
    const avgOrderValue = allOrders.length > 0 ? totalRevenue / allOrders.length : 0

    // Refund tracking — only count successful refund transactions (kind='refund', status='success')
    const refundedOrders = allOrders.filter(
      (o) => o.financial_status === 'refunded' || o.financial_status === 'partially_refunded'
    )
    const inRangeRefunds = refundedOrders.reduce((sum, o) => {
      const refundSum = (o.refunds || []).reduce(
        (rs, r) =>
          rs +
          (r.transactions || []).reduce(
            (ts, t) =>
              ts +
              (t.kind === 'refund' && t.status === 'success' ? parseFloat(t.amount || '0') : 0),
            0
          ),
        0
      )
      return sum + refundSum
    }, 0)
    // Total = refunds on orders created in period + refunds on older orders processed in period
    const totalRefunded = inRangeRefunds + olderOrderRefunds

    // Shopify-aligned metrics:
    // net_sales = gross_sales - discounts - returns (matches Shopify's net_sales)
    const netSales = grossSales - totalDiscounts - totalRefunded
    // total_sales = net_sales + tax + shipping (matches Shopify's total_sales ≈ total_price)
    // net_revenue = total_price - refunds (our previous "netRevenue")
    const netRevenue = totalRevenue - totalRefunded
    // Gross profit estimate = subtotal (product revenue after discounts) - no COGS available
    const grossProfit = totalSubtotal - totalDiscounts

    // Recent orders (last 30 days) for period-over-period comparison
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    const getOrderDate = (o: ShopifyOrder) => new Date(o.created_at)
    const recentOrders = allOrders.filter((o) => getOrderDate(o) >= thirtyDaysAgo)
    const priorOrders = allOrders.filter(
      (o) => getOrderDate(o) >= sixtyDaysAgo && getOrderDate(o) < thirtyDaysAgo
    )
    const recentGrossSales = recentOrders.reduce(
      (sum, o) => sum + parseFloat(o.total_line_items_price || '0'),
      0
    )
    const priorGrossSales = priorOrders.reduce(
      (sum, o) => sum + parseFloat(o.total_line_items_price || '0'),
      0
    )
    const recentRevenue = recentOrders.reduce((sum, o) => sum + parseFloat(o.total_price || '0'), 0)
    const priorRevenue = priorOrders.reduce((sum, o) => sum + parseFloat(o.total_price || '0'), 0)
    const revenueChange =
      priorGrossSales > 0 ? ((recentGrossSales - priorGrossSales) / priorGrossSales) * 100 : null

    // Products
    const activeProducts = products.filter((p) => p.status === 'active')

    // Customer stats
    const totalCustomerSpend = customers.reduce(
      (sum, c) => sum + parseFloat(c.total_spent || '0'),
      0
    )
    const returningCustomers = customers.filter((c) => (c.orders_count || 0) > 1).length

    // Shopify Payments balance
    const cashBalance =
      balance.length > 0 ? balance.reduce((s, b) => s + parseFloat(b.amount || '0'), 0) : null

    return NextResponse.json({
      data: {
        shop: {
          name: shop.name,
          email: shop.email,
          domain: shop.domain,
          currency: shop.currency,
          timezone: shop.iana_timezone,
          plan: shop.plan_display_name,
          country: shop.country_name,
        },
        summary: {
          orders: {
            total: ordersCount || orders.length,
            financialOrderCount: allOrders.length,
            cancelledCount,
            grossSales: shopifyqlGrossSales ?? grossSales,
            totalRevenue,
            avgOrderValue,
            recentCount: recentOrders.length,
            recentGrossSales,
            recentRevenue,
            currency: shop.currency,
          },
          products: {
            total: productsCount || products.length,
            active: activeProducts.length,
          },
          customers: {
            total: customersCount || customers.length,
            totalSpend: totalCustomerSpend,
            returning: returningCustomers,
          },
        },
        // ShopifyQL authoritative breakdown (null if read_reports scope unavailable)
        salesBreakdown: shopifyqlBreakdown,
        // KPI sparklines + previous period for KPIStrip
        kpiSparklines,
        prevPeriod,
        // Financial data — ShopifyQL values preferred, REST+updated_at fallback
        financials: {
          grossSales: shopifyqlGrossSales ?? shopifyqlBreakdown?.grossSales ?? grossSales,
          netSales: shopifyqlBreakdown?.netSales ?? netSales,
          revenue: totalRevenue,
          netRevenue,
          grossProfit,
          totalTax: shopifyqlBreakdown?.taxes ?? totalTax,
          totalDiscounts: shopifyqlBreakdown
            ? Math.abs(shopifyqlBreakdown.discounts)
            : totalDiscounts,
          totalShipping: shopifyqlBreakdown?.shipping ?? totalShipping,
          totalRefunded: shopifyqlBreakdown ? Math.abs(shopifyqlBreakdown.returns) : totalRefunded,
          refundedOrderCount: refundedOrders.length,
          avgOrderValue,
          revenueChange,
          cashBalance,
          currency: shop.currency,
          recentPayouts: payouts.slice(0, 5).map((p) => ({
            id: p.id,
            status: p.status,
            amount: parseFloat(p.amount || '0'),
            date: p.date,
          })),
        },
      },
    })
  } catch (error) {
    console.error('Shopify summary error:', error)
    return NextResponse.json({ error: 'Failed to fetch Shopify summary' }, { status: 500 })
  }
})
