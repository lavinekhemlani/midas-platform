import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'
import type { ShopifyOrder } from '@/lib/providers/shopify/types'

/**
 * Shopify Reconciliation API — compares REST order data against ShopifyQL analytics.
 *
 * Returns a day-by-day breakdown of:
 *   - gross_sales (ShopifyQL — Shopify's source of truth)
 *   - gross_sales computed from REST total_line_items_price
 *   - total_price from REST (what our app previously reported as "revenue")
 *   - discounts, taxes, shipping per day
 *   - diff between ShopifyQL and REST gross_sales
 *
 * Query params:
 *   ?shop=domain
 *   ?startDate=YYYY-MM-DD (default: 30 days ago)
 *   ?endDate=YYYY-MM-DD   (default: today)
 */
export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const url = new URL(request.url)
    const endDate = url.searchParams.get('endDate') || new Date().toISOString().slice(0, 10)
    const startDate =
      url.searchParams.get('startDate') ||
      (() => {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        return d.toISOString().slice(0, 10)
      })()

    // --- Fetch REST orders and ShopifyQL in parallel ---
    const [orders, shopifyqlResult] = await Promise.allSettled([
      client.getOrders({
        limit: '250',
        status: 'any',
        created_at_min: `${startDate}T00:00:00Z`,
        created_at_max: `${endDate}T23:59:59Z`,
      }),
      client.shopifyqlQuery(
        `FROM sales SHOW gross_sales, net_sales, total_sales, discounts, returns, taxes, orders TIMESERIES day SINCE ${startDate} UNTIL ${endDate}`
      ),
    ])

    // --- Parse ShopifyQL daily data ---
    const shopifyqlDaily: Record<
      string,
      {
        gross_sales: number
        net_sales: number
        total_sales: number
        discounts: number
        returns: number
        taxes: number
        shipping: number
        orders: number
      }
    > = {}

    if (shopifyqlResult.status === 'fulfilled') {
      const { columns, rows } = shopifyqlResult.value
      const colMap: Record<string, number> = {}
      columns.forEach((c, i) => {
        colMap[c.name] = i
      })

      for (const row of rows) {
        const day = row[colMap['day']]
        if (!day) continue
        const rns = parseFloat(row[colMap['net_sales']] || '0')
        const rtx = parseFloat(row[colMap['taxes']] || '0')
        const rts = parseFloat(row[colMap['total_sales']] || '0')
        shopifyqlDaily[day] = {
          gross_sales: parseFloat(row[colMap['gross_sales']] || '0'),
          net_sales: rns,
          total_sales: rts,
          discounts: parseFloat(row[colMap['discounts']] || '0'),
          returns: parseFloat(row[colMap['returns']] || '0'),
          taxes: rtx,
          shipping: rts - rns - rtx,
          orders: parseInt(row[colMap['orders']] || '0', 10),
        }
      }
    }

    // --- Compute daily metrics from REST orders ---
    const restOrders: ShopifyOrder[] = orders.status === 'fulfilled' ? orders.value : []

    const restDaily: Record<
      string,
      {
        gross_sales: number
        total_price: number
        subtotal_price: number
        discounts: number
        taxes: number
        shipping: number
        orders: number
        cancelled: number
        test: number
        refunded_total: number
      }
    > = {}

    for (const order of restOrders) {
      // Use created_at (matches Shopify dashboard day grouping)
      const day = order.created_at?.slice(0, 10)
      if (!day) continue

      if (!restDaily[day]) {
        restDaily[day] = {
          gross_sales: 0,
          total_price: 0,
          subtotal_price: 0,
          discounts: 0,
          taxes: 0,
          shipping: 0,
          orders: 0,
          cancelled: 0,
          test: 0,
          refunded_total: 0,
        }
      }

      const d = restDaily[day]

      // gross_sales = total_line_items_price (line items before discounts/tax/shipping)
      d.gross_sales += parseFloat(order.total_line_items_price || '0')
      d.total_price += parseFloat(order.total_price || '0')
      d.subtotal_price += parseFloat(order.subtotal_price || '0')
      d.discounts += parseFloat(order.total_discounts || '0')
      d.taxes += parseFloat(order.total_tax || '0')
      d.shipping += parseFloat(order.total_shipping_price_set?.shop_money?.amount || '0')
      d.orders++

      if (order.cancelled_at) d.cancelled++
      if (order.test) d.test++

      // Track refund amounts
      if (
        order.financial_status === 'refunded' ||
        order.financial_status === 'partially_refunded'
      ) {
        for (const refund of order.refunds || []) {
          for (const txn of refund.transactions || []) {
            if (txn.kind === 'refund' && txn.status === 'success') {
              d.refunded_total += parseFloat(txn.amount || '0')
            }
          }
        }
      }
    }

    // --- Build day-by-day comparison ---
    const allDays = new Set([...Object.keys(shopifyqlDaily), ...Object.keys(restDaily)])
    const sortedDays = Array.from(allDays).sort()

    const comparison = sortedDays.map((day) => {
      const sq = shopifyqlDaily[day]
      const rest = restDaily[day]

      const sqGross = sq?.gross_sales ?? null
      const restGross = rest?.gross_sales ?? 0
      const grossDiff = sqGross !== null ? sqGross - restGross : null

      return {
        day,
        shopifyql: sq
          ? {
              gross_sales: sq.gross_sales,
              net_sales: sq.net_sales,
              total_sales: sq.total_sales,
              discounts: sq.discounts,
              returns: sq.returns,
              taxes: sq.taxes,
              shipping: sq.shipping,
              orders: sq.orders,
            }
          : null,
        rest: rest
          ? {
              gross_sales: round2(rest.gross_sales),
              total_price: round2(rest.total_price),
              subtotal_price: round2(rest.subtotal_price),
              discounts: round2(rest.discounts),
              taxes: round2(rest.taxes),
              shipping: round2(rest.shipping),
              orders: rest.orders,
              cancelled: rest.cancelled,
              test: rest.test,
              refunded_total: round2(rest.refunded_total),
            }
          : null,
        diff: {
          gross_sales: grossDiff !== null ? round2(grossDiff) : null,
          matches: grossDiff !== null ? Math.abs(grossDiff) < 0.02 : null,
        },
      }
    })

    // --- Totals ---
    const totals = {
      shopifyql: {
        gross_sales: sum(comparison, (c) => c.shopifyql?.gross_sales),
        net_sales: sum(comparison, (c) => c.shopifyql?.net_sales),
        total_sales: sum(comparison, (c) => c.shopifyql?.total_sales),
        discounts: sum(comparison, (c) => c.shopifyql?.discounts),
        returns: sum(comparison, (c) => c.shopifyql?.returns),
        orders: sum(comparison, (c) => c.shopifyql?.orders),
      },
      rest: {
        gross_sales: sum(comparison, (c) => c.rest?.gross_sales),
        total_price: sum(comparison, (c) => c.rest?.total_price),
        subtotal_price: sum(comparison, (c) => c.rest?.subtotal_price),
        discounts: sum(comparison, (c) => c.rest?.discounts),
        taxes: sum(comparison, (c) => c.rest?.taxes),
        shipping: sum(comparison, (c) => c.rest?.shipping),
        orders: sum(comparison, (c) => c.rest?.orders),
        cancelled: sum(comparison, (c) => c.rest?.cancelled),
        test: sum(comparison, (c) => c.rest?.test),
        refunded_total: sum(comparison, (c) => c.rest?.refunded_total),
      },
      mismatched_days: comparison.filter((c) => c.diff.matches === false).length,
    }

    const issues: string[] = []
    if (totals.mismatched_days > 0) {
      issues.push(
        `${totals.mismatched_days} day(s) have gross_sales mismatches between ShopifyQL and REST API`
      )
    }
    const gapTotalVsGross = totals.rest.gross_sales - totals.rest.total_price
    if (Math.abs(gapTotalVsGross) > 0.01) {
      issues.push(
        `REST gross_sales ($${totals.rest.gross_sales.toFixed(2)}) differs from total_price ($${totals.rest.total_price.toFixed(2)}) by $${gapTotalVsGross.toFixed(2)} — this gap = discounts ($${totals.rest.discounts.toFixed(2)}) + refunded order amounts`
      )
    }
    if (totals.rest.cancelled > 0) {
      issues.push(
        `${totals.rest.cancelled} cancelled order(s) found — Shopify includes these in gross_sales`
      )
    }
    if (totals.rest.test > 0) {
      issues.push(`${totals.rest.test} test order(s) found — verify whether Shopify includes these`)
    }

    return NextResponse.json({
      data: {
        period: { startDate, endDate },
        comparison,
        totals,
        issues,
        metric_definitions: {
          gross_sales:
            'Sum of line item prices × qty, before discounts/taxes/shipping/refunds (= total_line_items_price in REST)',
          total_price:
            'Customer-facing total after discounts, including taxes + shipping (what our app previously called "revenue")',
          subtotal_price: 'After discounts, before taxes + shipping',
          net_sales: 'gross_sales - discounts - returns (ShopifyQL only)',
          total_sales: 'net_sales + taxes + shipping (ShopifyQL only, ≈ total_price)',
        },
        ...(shopifyqlResult.status === 'rejected' && {
          shopifyqlError: String(shopifyqlResult.reason),
        }),
        ...(orders.status === 'rejected' && {
          restError: String(orders.reason),
        }),
      },
    })
  } catch (error) {
    console.error('Shopify reconcile error:', error)
    return NextResponse.json({ error: 'Failed to run reconciliation' }, { status: 500 })
  }
})

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function sum<T>(arr: T[], fn: (item: T) => number | null | undefined): number {
  return round2(arr.reduce((s, item) => s + (fn(item) || 0), 0))
}
