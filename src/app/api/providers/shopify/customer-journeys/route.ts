import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const url = new URL(request.url)
    const includeOrders = url.searchParams.get('includeOrders') === 'true'
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Build Shopify GraphQL query filter for date range
    let query: string | undefined
    if (startDate && endDate) {
      query = `created_at:>=${startDate} created_at:<=${endDate}`
    } else if (startDate) {
      query = `created_at:>=${startDate}`
    } else if (endDate) {
      query = `created_at:<=${endDate}`
    }

    const orders = await client.getCustomerJourneys(250, query)

    // Compute journey stats
    const withJourney = orders.filter((o) => o.customerJourneySummary?.ready)
    const totalMoments = withJourney.reduce(
      (sum, o) => sum + (o.customerJourneySummary?.momentsCount?.count || 0),
      0
    )

    const withDays = withJourney.filter((o) => o.customerJourneySummary?.daysToConversion != null)
    const totalDaysToConvert = withDays.reduce(
      (sum, o) => sum + (o.customerJourneySummary?.daysToConversion || 0),
      0
    )

    // New vs returning
    const newCustomers = withJourney.filter(
      (o) => o.customerJourneySummary?.customerOrderIndex === 1
    ).length
    const returningCustomers = withJourney.filter(
      (o) => (o.customerJourneySummary?.customerOrderIndex ?? 0) > 1
    ).length

    // Normalize journey source to lowercase for consistent matching with ShopifyQL channels
    const normalizeSource = (raw: string): string => {
      if (!raw || raw === 'unknown') return 'unknown'
      let s = raw.toLowerCase().trim()
      // Strip URL protocols, paths, query strings, and trailing slashes
      s = s.replace(/^https?:\/\//, '')
      s = s.replace(/[/?#].*$/, '')
      // Strip domain suffixes
      s = s.replace(/\.(com|co|org|net|io|app|de|uk|se|fr|nl|be|au|ca|in|jp)$/, '')
      // Strip known subdomain prefixes (tracking/redirect subdomains)
      const subdomainPrefixes = [
        'www.',
        'ads.',
        'ad.',
        'clk.',
        'click.',
        'imp.',
        'pdt.',
        'track.',
        'trk.',
        'redirect.',
        'go.',
        'out.',
        'link.',
        'r.',
        't.',
        'l.',
        'm.',
      ]
      for (const prefix of subdomainPrefixes) {
        if (s.startsWith(prefix)) {
          s = s.slice(prefix.length)
          break
        }
      }
      // If still contains a dot, take the last segment as the main domain
      if (s.includes('.')) {
        const parts = s.split('.')
        s = parts[parts.length - 1]
      }
      return s
    }

    // Source breakdown + per-source new/returning
    const sourceCount: Record<string, number> = {}
    const firstSources: Record<string, number> = {}
    const lastSources: Record<string, number> = {}
    const newBySource: Record<string, number> = {}
    const returningBySource: Record<string, number> = {}
    for (const o of withJourney) {
      const rawFirst = o.customerJourneySummary?.firstVisit?.source || 'unknown'
      const rawLast = o.customerJourneySummary?.lastVisit?.source || 'unknown'
      const first = normalizeSource(rawFirst)
      const last = normalizeSource(rawLast)
      const src = last !== 'unknown' ? last : first
      sourceCount[src] = (sourceCount[src] || 0) + 1
      firstSources[first] = (firstSources[first] || 0) + 1
      lastSources[last] = (lastSources[last] || 0) + 1

      const isNew = o.customerJourneySummary?.customerOrderIndex === 1
      if (isNew) {
        newBySource[src] = (newBySource[src] || 0) + 1
      } else {
        returningBySource[src] = (returningBySource[src] || 0) + 1
      }
    }

    const summary = {
      totalOrders: orders.length,
      ordersWithJourney: withJourney.length,
      newCustomers,
      returningCustomers,
      newPct: withJourney.length > 0 ? Math.round((newCustomers / withJourney.length) * 100) : 0,
      returningPct:
        withJourney.length > 0 ? Math.round((returningCustomers / withJourney.length) * 100) : 0,
      avgMomentsPerOrder:
        withJourney.length > 0 ? Math.round((totalMoments / withJourney.length) * 10) / 10 : 0,
      avgDaysToConversion:
        withDays.length > 0 ? Math.round((totalDaysToConvert / withDays.length) * 10) / 10 : 0,
      sourceBreakdown: Object.entries(sourceCount)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
      firstVisitSources: Object.entries(firstSources)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
      lastVisitSources: Object.entries(lastSources)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
      newBySource,
      returningBySource,
    }

    return NextResponse.json({
      data: {
        // Only include raw orders if explicitly requested (dev page)
        ...(includeOrders && { orders }),
        summary,
      },
    })
  } catch (error) {
    console.error('Shopify customer journeys error:', error)
    return NextResponse.json({ error: 'Failed to fetch customer journeys' }, { status: 500 })
  }
})
