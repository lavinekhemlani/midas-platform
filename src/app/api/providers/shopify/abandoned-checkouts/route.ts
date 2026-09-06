import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'
import type {
  ShopifyAbandonedCheckout,
  ShopifyAbandonedCheckoutsSummary,
  ShopifyAbandonedCheckoutTrendPoint,
  ShopifyAbandonedProductItem,
} from '@/lib/providers/shopify/types'

/**
 * Shopify Abandoned Checkouts API route.
 * Returns cart abandonment analytics.
 *
 * Query params:
 *   ?shop=domain    — target store
 *   ?startDate=...  — created_at_min
 *   ?endDate=...    — created_at_max
 */
export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    const params: Record<string, string> = {}
    if (startDate) {
      params.created_at_min = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`
    }
    if (endDate) {
      params.created_at_max = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`
    }

    let checkouts: ShopifyAbandonedCheckout[] = []
    let warning: string | undefined

    try {
      const raw = await client.getAbandonedCheckouts(params)
      checkouts = raw as unknown as ShopifyAbandonedCheckout[]
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message?.includes('403') || error.message?.includes('protected'))
      ) {
        warning =
          'Abandoned checkout data requires Protected Customer Data access. Enable it in your Shopify app settings.'
        return NextResponse.json({
          data: {
            checkouts: [],
            summary: {
              totalAbandoned: 0,
              totalRecovered: 0,
              recoveryRate: 0,
              totalAbandonedValue: 0,
              avgCartValue: 0,
              marketingConsentRate: 0,
              topAbandonedProducts: [],
              byReferrer: [],
              currency: 'USD',
            },
            abandonmentTrend: [],
            warning,
          },
        })
      }
      throw error
    }

    // Compute summary
    let totalAbandonedValue = 0
    let recoveredCount = 0
    let marketingConsentCount = 0
    const productMap: Record<string, { count: number; totalValue: number }> = {}
    const referrerMap: Record<string, { count: number; value: number }> = {}
    const trendMap: Record<string, { abandoned: number; recovered: number; totalValue: number }> =
      {}

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

    for (const c of checkouts) {
      const value = parseFloat(c.total_price || '0')
      totalAbandonedValue += value

      const isRecovered = c.completed_at !== null
      if (isRecovered) recoveredCount++

      if (c.buyer_accepts_marketing || c.buyer_accepts_sms_marketing) {
        marketingConsentCount++
      }

      // Product tracking
      for (const item of c.line_items || []) {
        const title = item.title || 'Unknown'
        if (!productMap[title]) productMap[title] = { count: 0, totalValue: 0 }
        productMap[title].count += item.quantity || 1
        productMap[title].totalValue += parseFloat(item.price || '0') * (item.quantity || 1)
      }

      // Referrer tracking
      let referrer = c.source_name || 'Direct'
      if (c.referring_site) {
        try {
          referrer = new URL(c.referring_site).hostname.replace('www.', '')
        } catch {
          referrer = c.referring_site.substring(0, 40)
        }
      }
      if (!referrerMap[referrer]) referrerMap[referrer] = { count: 0, value: 0 }
      referrerMap[referrer].count++
      referrerMap[referrer].value += value

      // Trend grouped by granularity
      const key = c.created_at ? getGroupKey(c.created_at) : ''
      if (key) {
        if (!trendMap[key]) trendMap[key] = { abandoned: 0, recovered: 0, totalValue: 0 }
        trendMap[key].abandoned++
        if (isRecovered) trendMap[key].recovered++
        trendMap[key].totalValue += value
      }
    }

    const topAbandonedProducts: ShopifyAbandonedProductItem[] = Object.entries(productMap)
      .map(([title, data]) => ({ title, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const summary: ShopifyAbandonedCheckoutsSummary = {
      totalAbandoned: checkouts.length,
      totalRecovered: recoveredCount,
      recoveryRate: checkouts.length > 0 ? (recoveredCount / checkouts.length) * 100 : 0,
      totalAbandonedValue,
      avgCartValue: checkouts.length > 0 ? totalAbandonedValue / checkouts.length : 0,
      marketingConsentRate:
        checkouts.length > 0 ? (marketingConsentCount / checkouts.length) * 100 : 0,
      topAbandonedProducts,
      byReferrer: Object.entries(referrerMap)
        .map(([source, data]) => ({ source, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      currency: checkouts[0]?.currency || 'USD',
    }

    // Fill all days/weeks/months in range so charts show zero-value periods
    const fillRange = (): ShopifyAbandonedCheckoutTrendPoint[] => {
      if (!startDate || !endDate) {
        return Object.entries(trendMap)
          .map(([date, data]) => ({ date, ...data }))
          .sort((a, b) => a.date.localeCompare(b.date))
      }
      const result: ShopifyAbandonedCheckoutTrendPoint[] = []
      const start = new Date(startDate + 'T00:00:00Z')
      const end = new Date(endDate + 'T00:00:00Z')
      const cursor = new Date(start)

      while (cursor <= end) {
        const key = getGroupKey(cursor.toISOString())
        const entry = trendMap[key] || { abandoned: 0, recovered: 0, totalValue: 0 }
        // Avoid duplicates for week/month grouping
        if (result.length === 0 || result[result.length - 1].date !== key) {
          result.push({ date: key, ...entry })
        }
        if (granularity === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1)
        else if (granularity === 'week') cursor.setUTCDate(cursor.getUTCDate() + 7)
        else cursor.setUTCMonth(cursor.getUTCMonth() + 1)
      }
      return result
    }
    const abandonmentTrend = fillRange()

    // Infer checkout exit stages from available data
    // Shopify doesn't expose explicit abandonment reason, but we can infer
    // how far the customer got based on what fields are populated
    let stageCart = 0
    let stageContact = 0
    let stageShipping = 0
    let stagePayment = 0
    const abandonTimes: number[] = []

    for (const c of checkouts) {
      if (c.completed_at) continue // recovered, not abandoned

      // Time spent before abandoning (created → last update)
      const created = new Date(c.created_at).getTime()
      const updated = new Date(c.updated_at).getTime()
      if (updated > created) abandonTimes.push((updated - created) / 60000) // minutes

      // Infer stage based on populated fields
      const hasEmail = !!c.email || !!c.customer?.email
      const hasAddress = !!c.customer?.default_address?.address1
      const hasLineItems = (c.line_items?.length ?? 0) > 0

      if (!hasLineItems) {
        stageCart++
      } else if (!hasEmail) {
        stageCart++
      } else if (!hasAddress) {
        stageContact++
      } else {
        // Had email + address → likely dropped at shipping selection or payment
        stagePayment++
      }
    }

    const abandonedCount = checkouts.filter((c) => !c.completed_at).length
    const medianAbandonTime =
      abandonTimes.length > 0
        ? (() => {
            const sorted = [...abandonTimes].sort((a, b) => a - b)
            const mid = Math.floor(sorted.length / 2)
            return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
          })()
        : 0

    const exitAnalysis = {
      stages: [
        { stage: 'Cart / Browse', count: stageCart },
        { stage: 'Contact Info', count: stageContact },
        { stage: 'Shipping / Payment', count: stagePayment },
      ].filter((s) => s.count > 0),
      medianTimeMinutes: Math.round(medianAbandonTime),
      totalAnalyzed: abandonedCount,
    }

    return NextResponse.json({
      data: {
        checkouts,
        summary,
        abandonmentTrend,
        exitAnalysis,
        ...(warning && { warning }),
      },
    })
  } catch (error) {
    console.error('Shopify abandoned checkouts error:', error)
    return NextResponse.json({ error: 'Failed to fetch abandoned checkouts' }, { status: 500 })
  }
})
