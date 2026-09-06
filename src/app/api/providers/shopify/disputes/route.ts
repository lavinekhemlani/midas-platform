import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'
import type {
  ShopifyDispute,
  ShopifyDisputesSummary,
  ShopifyDisputeTrendPoint,
} from '@/lib/providers/shopify/types'

/**
 * Shopify Payments Disputes API route.
 * Returns chargebacks and inquiries with analytics.
 *
 * Query params:
 *   ?shop=domain    — target store
 *   ?status=open    — filter by status
 *   ?startDate=...  — initiated_at_min (ISO 8601 or YYYY-MM-DD)
 *   ?endDate=...    — initiated_at_max (ISO 8601 or YYYY-MM-DD)
 */
export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const url = new URL(request.url)
    const statusFilter = url.searchParams.get('status')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    const params: Record<string, string> = {}
    if (statusFilter) params.status = statusFilter
    if (startDate) {
      params.initiated_at_min = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`
    }
    if (endDate) {
      params.initiated_at_max = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`
    }

    let disputes: ShopifyDispute[] = []
    let warning: string | undefined

    try {
      const raw = await client.getDisputes(params)
      disputes = raw as unknown as ShopifyDispute[]
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes('403')) {
        warning =
          'Shopify Payments disputes access denied — this store may not use Shopify Payments or the scope is restricted.'
        return NextResponse.json({
          data: {
            disputes: [],
            summary: {
              totalDisputes: 0,
              totalDisputedAmount: 0,
              openDisputes: 0,
              wonDisputes: 0,
              lostDisputes: 0,
              needsResponse: 0,
              disputesByReason: [],
              disputesByStatus: [],
              currency: 'USD',
            },
            disputeTrend: [],
            warning,
          },
        })
      }
      throw error
    }

    // Compute summary
    const reasonMap: Record<string, { count: number; amount: number }> = {}
    const statusMap: Record<string, number> = {}
    let totalAmount = 0
    let openCount = 0
    let wonCount = 0
    let lostCount = 0
    let needsResponse = 0

    for (const d of disputes) {
      const amt = parseFloat(d.amount || '0')
      totalAmount += amt

      // Status tracking
      const st = d.status || 'unknown'
      statusMap[st] = (statusMap[st] || 0) + 1

      if (st === 'open' || st === 'needs_response' || st === 'under_review') openCount++
      if (st === 'won') wonCount++
      if (st === 'lost') lostCount++
      if (st === 'needs_response') needsResponse++

      // Reason tracking
      const reason = d.reason || 'unknown'
      if (!reasonMap[reason]) reasonMap[reason] = { count: 0, amount: 0 }
      reasonMap[reason].count++
      reasonMap[reason].amount += amt
    }

    const summary: ShopifyDisputesSummary = {
      totalDisputes: disputes.length,
      totalDisputedAmount: totalAmount,
      openDisputes: openCount,
      wonDisputes: wonCount,
      lostDisputes: lostCount,
      needsResponse,
      disputesByReason: Object.entries(reasonMap)
        .map(([reason, data]) => ({ reason, ...data }))
        .sort((a, b) => b.count - a.count),
      disputesByStatus: Object.entries(statusMap)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      currency: disputes[0]?.currency || 'USD',
    }

    // Determine aggregation granularity based on date range span
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

    // Compute dispute trends grouped by granularity
    const trendMap: Record<string, { count: number; amount: number; won: number; lost: number }> =
      {}
    for (const d of disputes) {
      const key = d.initiated_at ? getGroupKey(d.initiated_at) : ''
      if (!key) continue
      if (!trendMap[key]) trendMap[key] = { count: 0, amount: 0, won: 0, lost: 0 }
      trendMap[key].count++
      trendMap[key].amount += parseFloat(d.amount || '0')
      if (d.status === 'won') trendMap[key].won++
      if (d.status === 'lost') trendMap[key].lost++
    }

    const disputeTrend: ShopifyDisputeTrendPoint[] = Object.entries(trendMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      data: { disputes, summary, disputeTrend, ...(warning && { warning }) },
    })
  } catch (error) {
    console.error('Shopify disputes error:', error)
    return NextResponse.json({ error: 'Failed to fetch Shopify disputes' }, { status: 500 })
  }
})
