import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../../getShopifyClient'
import type { ShopifyQLColumn, ShopifyQLRow } from '@/lib/providers/shopify/types'

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    const dateFilter =
      startDate && endDate ? `SINCE ${startDate} UNTIL ${endDate}` : `SINCE -30d UNTIL today`

    function buildColMap(columns: ShopifyQLColumn[]): Record<string, number> {
      const colMap: Record<string, number> = {}
      columns.forEach((c, i) => {
        colMap[c.name] = i
      })
      return colMap
    }

    // Determine granularity based on date range
    const rangeMs =
      startDate && endDate
        ? new Date(endDate).getTime() - new Date(startDate).getTime()
        : 30 * 86400000
    const rangeDays = rangeMs / 86400000
    const granularity = rangeDays <= 31 ? 'day' : rangeDays <= 90 ? 'week' : 'month'
    const timeColumn = granularity === 'day' ? 'day' : granularity === 'week' ? 'week' : 'month'

    const [topProductsByRevenue, salesByProductType, productTrendResult] = await Promise.allSettled(
      [
        // Top 10 products by total revenue
        client.shopifyqlQuery(
          `FROM sales SHOW total_sales, net_sales, orders GROUP BY product_title ORDER BY total_sales DESC LIMIT 10 ${dateFilter}`
        ),

        // Sales composition by product type
        client.shopifyqlQuery(
          `FROM sales SHOW total_sales, orders GROUP BY product_type ORDER BY total_sales DESC LIMIT 15 ${dateFilter}`
        ),

        // Product revenue trend over time (top 5 products × time)
        client.shopifyqlQuery(
          `FROM sales SHOW total_sales GROUP BY product_title, ${timeColumn} ORDER BY ${timeColumn} ASC ${dateFilter}`
        ),
      ]
    )

    function parseGrouped(
      result: PromiseSettledResult<{ columns: ShopifyQLColumn[]; rows: ShopifyQLRow[] }>,
      groupCol: string
    ) {
      if (result.status !== 'fulfilled' || !result.value?.rows?.length) return []
      const { columns, rows } = result.value
      const colMap = buildColMap(columns)
      return rows.map((row) => ({
        name: row[colMap[groupCol]] || 'Unknown',
        totalSales: parseFloat(String(row[colMap['total_sales']] || '0')),
        netSales:
          row[colMap['net_sales']] != null
            ? parseFloat(String(row[colMap['net_sales']]))
            : undefined,
        orders: parseInt(String(row[colMap['orders']] || '0'), 10),
      }))
    }

    // Parse product trend: pivot into { dates, products: [{name, data}] }
    let productTrend: {
      dates: string[]
      products: { name: string; data: number[] }[]
      granularity: string
    } | null = null
    if (productTrendResult.status === 'fulfilled' && productTrendResult.value?.rows?.length) {
      const { columns, rows } = productTrendResult.value
      const colMap = buildColMap(columns)
      // Aggregate totals per product to find top 5
      const productTotals: Record<string, number> = {}
      const productDateMap: Record<string, Record<string, number>> = {}
      const dateSet = new Set<string>()

      for (const row of rows) {
        const product = String(row[colMap['product_title']] || 'Unknown')
        const date = String(row[colMap[timeColumn]] || '')
        const sales = parseFloat(String(row[colMap['total_sales']] || '0'))
        if (!date) continue
        dateSet.add(date)
        productTotals[product] = (productTotals[product] || 0) + sales
        if (!productDateMap[product]) productDateMap[product] = {}
        productDateMap[product][date] = (productDateMap[product][date] || 0) + sales
      }

      const top5Products = Object.entries(productTotals)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name]) => name)

      const sortedDates = [...dateSet].sort()

      productTrend = {
        dates: sortedDates,
        products: top5Products.map((name) => ({
          name,
          data: sortedDates.map((d) => productDateMap[name]?.[d] ?? 0),
        })),
        granularity,
      }
    }

    return NextResponse.json({
      data: {
        topProductsByRevenue: parseGrouped(topProductsByRevenue, 'product_title'),
        salesByProductType: parseGrouped(salesByProductType, 'product_type'),
        productTrend,
      },
    })
  } catch (error) {
    console.error('Shopify product analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch product analytics' }, { status: 500 })
  }
})
