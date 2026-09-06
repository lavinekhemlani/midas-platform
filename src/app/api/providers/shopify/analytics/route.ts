import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'
import { getPreviousPeriodRange } from '@/lib/utils/dateRanges'
import type {
  ShopifyQLTableData,
  ShopifyQLColumn,
  ShopifyQLRow,
  ShopifyOrder,
} from '@/lib/providers/shopify/types'

/**
 * Shopify Analytics API route using ShopifyQL.
 * Returns aggregated sales data, time series, and top products.
 *
 * Query params:
 *   ?shop=domain          — target store
 *   ?period=30d|90d|12m   — time range (default: 30d)
 *   ?startDate=YYYY-MM-DD — custom start date
 *   ?endDate=YYYY-MM-DD   — custom end date
 */
export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const url = new URL(request.url)
    const period = url.searchParams.get('period') || '30d'
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Build date filter for ShopifyQL
    let dateFilter: string
    if (startDate && endDate) {
      dateFilter = `SINCE ${startDate} UNTIL ${endDate}`
    } else {
      const periodMap: Record<string, string> = {
        '7d': '-7d',
        '30d': '-30d',
        '90d': '-90d',
        '6m': '-6m',
        '12m': '-12m',
        last_year: '-12m',
        this_quarter: '-3m',
        this_month: '-1m',
        this_year: '-12m',
      }
      dateFilter = `SINCE ${periodMap[period] || '-30d'}`
    }

    // Compute previous period date filter for comparison
    let prevDateFilter: string | null = null
    if (startDate && endDate) {
      const prev = getPreviousPeriodRange(startDate, endDate)
      prevDateFilter = `SINCE ${prev.start} UNTIL ${prev.end}`
    }

    // Run ShopifyQL queries in parallel
    const [
      salesSummary,
      dailyTrend,
      topProducts,
      salesByChannel,
      geoBreakdown,
      discountCodes,
      referrerSales,
      hourlyPattern,
      aovTrend,
      discountTrend,
      returnsTrend,
      sessionsTrend,
      productTypeSales,
      vendorSales,
      prevAovTrend,
      prevSessionsTrend,
    ] = await Promise.allSettled([
      // 1. Aggregated sales summary
      client.shopifyqlQuery(
        `FROM sales SHOW total_sales, gross_sales, net_sales, orders, discounts, returns, taxes ${dateFilter}`
      ),

      // 2. Daily revenue trend
      client.shopifyqlQuery(
        `FROM sales SHOW total_sales, gross_sales, discounts, net_sales, taxes, orders TIMESERIES day ${dateFilter}`
      ),

      // 3. Top products by revenue
      client.shopifyqlQuery(
        `FROM sales SHOW total_sales, net_sales, orders GROUP BY product_title ORDER BY total_sales DESC LIMIT 10 ${dateFilter}`
      ),

      // 4. Sales by channel
      client.shopifyqlQuery(
        `FROM sales SHOW total_sales, orders GROUP BY channel ORDER BY total_sales DESC ${dateFilter}`
      ),

      // 5. Geographic revenue breakdown
      client.shopifyqlQuery(
        `FROM sales SHOW total_sales, orders GROUP BY billing_country ORDER BY total_sales DESC LIMIT 20 ${dateFilter}`
      ),

      // 6. Discount code effectiveness
      client.shopifyqlQuery(
        `FROM sales SHOW total_sales, orders, discounts GROUP BY discount_code ORDER BY total_sales DESC LIMIT 15 ${dateFilter}`
      ),

      // 7. Sales by referrer source
      client.shopifyqlQuery(
        `FROM sales SHOW total_sales, orders GROUP BY referrer_source ORDER BY total_sales DESC LIMIT 15 ${dateFilter}`
      ),

      // 8. Hourly sales pattern (fixed 7-day window for recent patterns)
      client.shopifyqlQuery(`FROM sales SHOW total_sales, orders TIMESERIES hour SINCE -7d`),

      // 9. AOV trend
      client.shopifyqlQuery(`FROM sales SHOW average_order_value TIMESERIES day ${dateFilter}`),

      // 10. Discount trend
      client.shopifyqlQuery(`FROM sales SHOW discounts, orders TIMESERIES day ${dateFilter}`),

      // 11. Returns trend
      client.shopifyqlQuery(`FROM sales SHOW returns TIMESERIES day ${dateFilter}`),

      // 12. Sessions trend
      client.shopifyqlQuery(`FROM sessions SHOW sessions TIMESERIES day ${dateFilter}`),

      // 13. Sales by product type
      client.shopifyqlQuery(
        `FROM sales SHOW total_sales, orders GROUP BY product_type ORDER BY total_sales DESC LIMIT 15 ${dateFilter}`
      ),

      // 14. Sales by vendor
      client.shopifyqlQuery(
        `FROM sales SHOW total_sales, orders GROUP BY product_vendor ORDER BY total_sales DESC LIMIT 15 ${dateFilter}`
      ),

      // 15. Previous period AOV trend (for comparison dotted line)
      prevDateFilter
        ? client.shopifyqlQuery(
            `FROM sales SHOW average_order_value TIMESERIES day ${prevDateFilter}`
          )
        : Promise.resolve(null as any),

      // 16. Previous period sessions trend (for comparison dotted line)
      prevDateFilter
        ? client.shopifyqlQuery(`FROM sessions SHOW sessions TIMESERIES day ${prevDateFilter}`)
        : Promise.resolve(null as any),
    ])

    // Parse results (handle individual query failures gracefully)
    function buildColMap(columns: ShopifyQLColumn[]): Record<string, number> {
      const colMap: Record<string, number> = {}
      columns.forEach((c, i) => {
        colMap[c.name] = i
      })
      return colMap
    }

    const parseSummary = (result: PromiseSettledResult<ShopifyQLTableData>) => {
      if (result.status !== 'fulfilled') return null
      if (!result.value) return null
      const { columns, rows } = result.value
      if (!rows?.length) return null
      const row = rows[0]
      const colMap = buildColMap(columns)
      const ts = parseFloat(row[colMap['total_sales']] || '0')
      const ns = parseFloat(row[colMap['net_sales']] || '0')
      const tx = parseFloat(row[colMap['taxes']] || '0')
      return {
        totalSales: ts,
        grossSales: parseFloat(row[colMap['gross_sales']] || '0'),
        netSales: ns,
        orders: parseInt(row[colMap['orders']] || '0', 10),
        discounts: parseFloat(row[colMap['discounts']] || '0'),
        returns: parseFloat(row[colMap['returns']] || '0'),
        taxes: tx,
        shipping: ts - ns - tx,
      }
    }

    const parseTimeSeries = (result: PromiseSettledResult<ShopifyQLTableData>) => {
      if (result.status !== 'fulfilled') return []
      if (!result.value) return []
      const { columns, rows } = result.value
      if (!rows?.length) return []
      const colMap = buildColMap(columns)
      return rows.map((row: ShopifyQLRow) => {
        const dts = parseFloat(row[colMap['total_sales']] || '0')
        const dns = parseFloat(row[colMap['net_sales']] || '0')
        const dtx = parseFloat(row[colMap['taxes']] || '0')
        return {
          date: row[colMap['day']],
          totalSales: dts,
          grossSales: parseFloat(row[colMap['gross_sales']] || '0'),
          discounts: parseFloat(row[colMap['discounts']] || '0'),
          netSales: dns,
          shipping: dts - dns - dtx,
          taxes: dtx,
          orders: parseInt(row[colMap['orders']] || '0', 10),
        }
      })
    }

    const parseGrouped = (result: PromiseSettledResult<ShopifyQLTableData>, groupCol: string) => {
      if (result.status !== 'fulfilled') return []
      if (!result.value) return []
      const { columns, rows } = result.value
      if (!rows?.length) return []
      const colMap = buildColMap(columns)
      return rows.map((row: ShopifyQLRow) => ({
        name: row[colMap[groupCol]] || 'Unknown',
        totalSales: parseFloat(row[colMap['total_sales']] || '0'),
        netSales:
          row[colMap['net_sales']] != null ? parseFloat(row[colMap['net_sales']]!) : undefined,
        orders: parseInt(row[colMap['orders']] || '0', 10),
      }))
    }

    const parseGeoSales = (result: PromiseSettledResult<ShopifyQLTableData>) => {
      if (result.status !== 'fulfilled' || !result.value) return []
      const { columns, rows } = result.value
      if (!rows?.length) return []
      const colMap = buildColMap(columns)
      return rows.map((row: ShopifyQLRow) => ({
        country: row[colMap['billing_country']] || 'Unknown',
        totalSales: parseFloat(row[colMap['total_sales']] || '0'),
        orders: parseInt(row[colMap['orders']] || '0', 10),
      }))
    }

    const parseDiscountPerformance = (result: PromiseSettledResult<ShopifyQLTableData>) => {
      if (result.status !== 'fulfilled' || !result.value) return []
      const { columns, rows } = result.value
      if (!rows?.length) return []
      const colMap = buildColMap(columns)
      return rows.map((row: ShopifyQLRow) => ({
        code: row[colMap['discount_code']] || 'None',
        totalSales: parseFloat(row[colMap['total_sales']] || '0'),
        orders: parseInt(row[colMap['orders']] || '0', 10),
        discountAmount: parseFloat(row[colMap['discounts']] || '0'),
      }))
    }

    const parseReferrerSales = (result: PromiseSettledResult<ShopifyQLTableData>) => {
      if (result.status !== 'fulfilled' || !result.value) return []
      const { columns, rows } = result.value
      if (!rows?.length) return []
      const colMap = buildColMap(columns)
      return rows.map((row: ShopifyQLRow) => ({
        source: row[colMap['referrer_source']] || 'Direct',
        totalSales: parseFloat(row[colMap['total_sales']] || '0'),
        orders: parseInt(row[colMap['orders']] || '0', 10),
      }))
    }

    const parseHourlySales = (result: PromiseSettledResult<ShopifyQLTableData>) => {
      if (result.status !== 'fulfilled' || !result.value) return []
      const { columns, rows } = result.value
      if (!rows?.length) return []
      const colMap = buildColMap(columns)
      return rows.map((row: ShopifyQLRow) => ({
        hour: row[colMap['hour']],
        totalSales: parseFloat(row[colMap['total_sales']] || '0'),
        orders: parseInt(row[colMap['orders']] || '0', 10),
      }))
    }

    const parseAOVTrend = (result: PromiseSettledResult<ShopifyQLTableData>) => {
      if (result.status !== 'fulfilled' || !result.value) return []
      const { columns, rows } = result.value
      if (!rows?.length) return []
      const colMap = buildColMap(columns)
      return rows.map((row: ShopifyQLRow) => ({
        date: row[colMap['day']],
        averageOrderValue: parseFloat(row[colMap['average_order_value']] || '0'),
      }))
    }

    const parseDiscountTrend = (result: PromiseSettledResult<ShopifyQLTableData>) => {
      if (result.status !== 'fulfilled' || !result.value) return []
      const { columns, rows } = result.value
      if (!rows?.length) return []
      const colMap = buildColMap(columns)
      return rows.map((row: ShopifyQLRow) => ({
        date: row[colMap['day']],
        discounts: parseFloat(row[colMap['discounts']] || '0'),
        orders: parseInt(row[colMap['orders']] || '0', 10),
      }))
    }

    const parseReturnsTrend = (result: PromiseSettledResult<ShopifyQLTableData>) => {
      if (result.status !== 'fulfilled' || !result.value) return []
      const { columns, rows } = result.value
      if (!rows?.length) return []
      const colMap = buildColMap(columns)
      return rows.map((row: ShopifyQLRow) => ({
        date: row[colMap['day']],
        returns: parseFloat(row[colMap['returns']] || '0'),
      }))
    }

    const parseSessionsTrend = (result: PromiseSettledResult<ShopifyQLTableData>) => {
      if (result.status !== 'fulfilled' || !result.value) return []
      const { columns, rows } = result.value
      if (!rows?.length) return []
      const colMap = buildColMap(columns)
      return rows.map((row: ShopifyQLRow) => ({
        date: row[colMap['day']],
        sessions: parseInt(row[colMap['sessions']] || '0', 10),
      }))
    }

    // If ShopifyQL daily trend failed (e.g. missing read_reports scope), fall back to REST orders
    let dailyTrendData = parseTimeSeries(dailyTrend)
    if (dailyTrendData.length === 0) {
      try {
        const orderParams: Record<string, string> = { limit: '250', status: 'any' }
        if (startDate) orderParams.created_at_min = `${startDate}T00:00:00Z`
        if (endDate) orderParams.created_at_max = `${endDate}T23:59:59Z`
        if (!startDate && !endDate) {
          const periodDays: Record<string, number> = {
            '7d': 7,
            '30d': 30,
            '90d': 90,
            '6m': 180,
            '12m': 365,
            this_month: 30,
            this_quarter: 90,
            this_year: 365,
            last_year: 365,
          }
          const days = periodDays[period] || 30
          const since = new Date()
          since.setDate(since.getDate() - days)
          orderParams.created_at_min = since.toISOString()
        }
        const orders = await client.getOrders(orderParams)
        const byDay: Record<
          string,
          {
            totalSales: number
            grossSales: number
            discounts: number
            netSales: number
            shipping: number
            taxes: number
            orders: number
          }
        > = {}
        for (const o of orders) {
          if (o.test) continue
          const day = o.created_at.slice(0, 10) // YYYY-MM-DD
          if (!byDay[day])
            byDay[day] = {
              totalSales: 0,
              grossSales: 0,
              discounts: 0,
              netSales: 0,
              shipping: 0,
              taxes: 0,
              orders: 0,
            }
          byDay[day].totalSales += parseFloat(o.total_price || '0')
          byDay[day].grossSales += parseFloat(o.total_line_items_price || '0')
          byDay[day].discounts += parseFloat(o.total_discounts || '0')
          byDay[day].netSales += parseFloat(o.subtotal_price || '0')
          byDay[day].shipping +=
            o.shipping_lines?.reduce((s: number, l: any) => s + parseFloat(l.price || '0'), 0) || 0
          byDay[day].taxes += parseFloat(o.total_tax || '0')
          byDay[day].orders += 1
        }
        dailyTrendData = Object.entries(byDay)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, data]) => ({ date, ...data }))
      } catch {
        // Best-effort — leave empty if REST also fails
      }
    }

    return NextResponse.json({
      data: {
        summary: parseSummary(salesSummary),
        dailyTrend: dailyTrendData,
        topProducts: parseGrouped(topProducts, 'product_title'),
        salesByChannel: parseGrouped(salesByChannel, 'channel'),
        salesByCountry: parseGeoSales(geoBreakdown),
        discountPerformance: parseDiscountPerformance(discountCodes),
        salesByReferrer: parseReferrerSales(referrerSales),
        hourlySales: parseHourlySales(hourlyPattern),
        aovTrend: parseAOVTrend(aovTrend),
        prevAovTrend: parseAOVTrend(prevAovTrend),
        discountTrend: parseDiscountTrend(discountTrend),
        returnsTrend: parseReturnsTrend(returnsTrend),
        sessionsTrend: parseSessionsTrend(sessionsTrend),
        prevSessionsTrend: parseSessionsTrend(prevSessionsTrend),
        salesByProductType: parseGrouped(productTypeSales, 'product_type'),
        salesByVendor: parseGrouped(vendorSales, 'product_vendor'),
        period,
        dateFilter,
      },
    })
  } catch (error) {
    console.error('Shopify analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch Shopify analytics' }, { status: 500 })
  }
})
