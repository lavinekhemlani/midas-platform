import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'
import type {
  ShopifyPayout,
  ShopifyPayoutStatus,
  ShopifyPayoutsSummary,
  ShopifyPayoutTrendPoint,
} from '@/lib/providers/shopify/types'

/**
 * Shopify Payments Payouts API route.
 * Returns payout list, KPIs, composition, and trend for the Payouts page.
 *
 * Query params:
 *   ?shop=domain   — target store
 *   ?startDate=... — date_min (ISO 8601 or YYYY-MM-DD)
 *   ?endDate=...   — date_max (ISO 8601 or YYYY-MM-DD)
 *   ?status=paid   — optional status filter (scheduled|in_transit|paid|failed|canceled)
 */
export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const statusFilter = url.searchParams.get('status')

    const params: Record<string, string> = { limit: '250' }
    if (statusFilter) params.status = statusFilter
    if (startDate) {
      // Shopify REST payouts uses date_min / date_max (YYYY-MM-DD form)
      params.date_min = startDate.slice(0, 10)
    }
    if (endDate) {
      params.date_max = endDate.slice(0, 10)
    }

    let payouts: ShopifyPayout[] = []
    let warning: string | undefined

    try {
      payouts = await client.getPayouts(params)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : ''
      // 402 = payment required, 403 = scope/feature missing, 404 = endpoint disabled
      if (msg.includes('402') || msg.includes('403') || msg.includes('404')) {
        warning =
          'Shopify Payments payouts unavailable — this store may not use Shopify Payments or the integration scope is restricted.'
        return NextResponse.json({
          data: {
            payouts: [],
            summary: emptySummary(),
            payoutTrend: [],
            warning,
          },
        })
      }
      throw error
    }

    // ─── Aggregate KPIs ─────────────────────────────────────
    const num = (s: string | null | undefined) => parseFloat(s || '0') || 0

    let totalAmount = 0
    let paidAmount = 0
    let scheduledAmount = 0
    let inTransitAmount = 0
    let failedAmount = 0
    let totalChargesGross = 0
    let totalRefundsGross = 0
    let totalAdjustmentsGross = 0
    let totalReservedFundsGross = 0
    let totalRetriedPayoutsGross = 0
    let totalFees = 0

    const statusMap: Record<string, { count: number; amount: number }> = {}

    for (const p of payouts) {
      const amt = num(p.amount)
      totalAmount += amt

      // Per-status totals
      const st = (p.status || 'unknown') as string
      if (!statusMap[st]) statusMap[st] = { count: 0, amount: 0 }
      statusMap[st].count++
      statusMap[st].amount += amt

      if (st === 'paid') paidAmount += amt
      else if (st === 'scheduled') scheduledAmount += amt
      else if (st === 'in_transit') inTransitAmount += amt
      else if (st === 'failed') failedAmount += amt

      // Composition (sums across all payouts in window)
      const s = p.summary
      if (s) {
        totalChargesGross += num(s.charges_gross_amount)
        totalRefundsGross += num(s.refunds_gross_amount)
        totalAdjustmentsGross += num(s.adjustments_gross_amount)
        totalReservedFundsGross += num(s.reserved_funds_gross_amount)
        totalRetriedPayoutsGross += num(s.retried_payouts_gross_amount)
        totalFees +=
          num(s.charges_fee_amount) +
          num(s.refunds_fee_amount) +
          num(s.adjustments_fee_amount) +
          num(s.reserved_funds_fee_amount) +
          num(s.retried_payouts_fee_amount)
      }
    }

    const avgPayoutAmount = payouts.length > 0 ? totalAmount / payouts.length : 0
    const effectiveFeeRate = totalChargesGross > 0 ? totalFees / totalChargesGross : 0

    // Upcoming payout = the single most-recent in_transit or scheduled payout (the one
    // about to hit the bank). Sorted by date desc, then status priority (in_transit > scheduled).
    const pending = payouts
      .filter((p) => p.status === 'in_transit' || p.status === 'scheduled')
      .sort((a, b) => {
        // in_transit before scheduled
        if (a.status !== b.status) return a.status === 'in_transit' ? -1 : 1
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      })
    const upcoming = pending[0]
    const upcomingPayout = upcoming
      ? {
          id: upcoming.id,
          status: upcoming.status as ShopifyPayoutStatus,
          amount: num(upcoming.amount),
          date: upcoming.date,
        }
      : null

    const summary: ShopifyPayoutsSummary = {
      totalCount: payouts.length,
      totalAmount,
      paidAmount,
      scheduledAmount,
      inTransitAmount,
      failedAmount,
      avgPayoutAmount,
      totalChargesGross,
      totalRefundsGross,
      totalAdjustmentsGross,
      totalReservedFundsGross,
      totalRetriedPayoutsGross,
      totalFees,
      effectiveFeeRate,
      currency: payouts[0]?.currency || 'USD',
      payoutsByStatus: Object.entries(statusMap)
        .map(([status, data]) => ({
          status: status as ShopifyPayoutStatus,
          count: data.count,
          amount: data.amount,
        }))
        .sort((a, b) => b.amount - a.amount),
      upcomingPayout,
    }

    // ─── Trend by date granularity ──────────────────────────
    const rangeMs =
      startDate && endDate ? new Date(endDate).getTime() - new Date(startDate).getTime() : Infinity
    const rangeDays = rangeMs / (1000 * 60 * 60 * 24)
    const granularity: 'day' | 'week' | 'month' =
      rangeDays <= 31 ? 'day' : rangeDays <= 90 ? 'week' : 'month'

    function getGroupKey(dateStr: string): string {
      if (!dateStr) return ''
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

    const trendMap: Record<string, ShopifyPayoutTrendPoint> = {}
    for (const p of payouts) {
      const key = getGroupKey(p.date)
      if (!key) continue
      if (!trendMap[key]) {
        trendMap[key] = {
          date: key,
          amount: 0,
          count: 0,
          chargesGross: 0,
          refundsGross: 0,
          adjustmentsGross: 0,
          reservedFundsGross: 0,
          fees: 0,
        }
      }
      const point = trendMap[key]
      point.amount += num(p.amount)
      point.count++
      const s = p.summary
      if (s) {
        point.chargesGross += num(s.charges_gross_amount)
        point.refundsGross += num(s.refunds_gross_amount)
        point.adjustmentsGross += num(s.adjustments_gross_amount)
        point.reservedFundsGross += num(s.reserved_funds_gross_amount)
        point.fees +=
          num(s.charges_fee_amount) +
          num(s.refunds_fee_amount) +
          num(s.adjustments_fee_amount) +
          num(s.reserved_funds_fee_amount) +
          num(s.retried_payouts_fee_amount)
      }
    }

    const payoutTrend: ShopifyPayoutTrendPoint[] = Object.values(trendMap).sort((a, b) =>
      a.date.localeCompare(b.date)
    )

    return NextResponse.json({
      data: {
        payouts,
        summary,
        payoutTrend,
        trendGranularity: granularity,
        ...(warning && { warning }),
      },
    })
  } catch (error) {
    console.error('Shopify payouts error:', error)
    return NextResponse.json({ error: 'Failed to fetch Shopify payouts' }, { status: 500 })
  }
})

function emptySummary(): ShopifyPayoutsSummary {
  return {
    totalCount: 0,
    totalAmount: 0,
    paidAmount: 0,
    scheduledAmount: 0,
    inTransitAmount: 0,
    failedAmount: 0,
    avgPayoutAmount: 0,
    totalChargesGross: 0,
    totalRefundsGross: 0,
    totalAdjustmentsGross: 0,
    totalReservedFundsGross: 0,
    totalRetriedPayoutsGross: 0,
    totalFees: 0,
    effectiveFeeRate: 0,
    currency: 'USD',
    payoutsByStatus: [],
    upcomingPayout: null,
  }
}
