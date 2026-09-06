import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'
import { getPreviousPeriodRange } from '@/lib/utils/dateRanges'
import type {
  ShopifyMarketingChannelRow,
  ShopifyMarketingSessionTrend,
  ShopifyMarketingAttributionSummary,
} from '@/lib/providers/shopify/types'

function buildColMap(columns: Array<{ name: string }>): Record<string, number> {
  const map: Record<string, number> = {}
  columns.forEach((c, i) => {
    map[c.name] = i
  })
  return map
}

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const attributionModel = url.searchParams.get('attributionModel') || 'last_click' // first_click | last_click | last_non_direct

    let dateFilter: string
    if (startDate && endDate) {
      dateFilter = `SINCE ${startDate} UNTIL ${endDate}`
    } else {
      dateFilter = 'SINCE -30d'
    }

    let warning: string | undefined

    // Build previous period date filter for change % comparison
    let prevDateFilter: string | null = null
    if (startDate && endDate) {
      const prev = getPreviousPeriodRange(startDate, endDate)
      prevDateFilter = `SINCE ${prev.start} UNTIL ${prev.end}`
    }

    // Build GraphQL date query for customer journey orders
    let journeyQuery: string | undefined
    if (startDate && endDate) {
      journeyQuery = `created_at:>=${startDate} created_at:<=${endDate}`
    } else if (startDate) {
      journeyQuery = `created_at:>=${startDate}`
    }

    const [
      sessionsSummaryResult,
      salesSummaryResult,
      sessionsChannelsResult,
      salesChannelsResult,
      trendResult,
      salesTrendResult,
      prevSessionsResult,
      prevSalesResult,
      marketingActivitiesResult,
      marketingEventsResult,
      journeyOrdersResult,
    ] = await Promise.allSettled([
      client.shopifyqlQuery(`FROM sessions SHOW sessions ${dateFilter}`),
      client.shopifyqlQuery(`FROM sales SHOW orders, total_sales ${dateFilter}`),
      client.shopifyqlQuery(
        `FROM sessions SHOW sessions GROUP BY referring_channel, traffic_type ORDER BY sessions DESC LIMIT 100 ${dateFilter}`
      ),
      client.shopifyqlQuery(
        `FROM sales SHOW total_sales, orders GROUP BY referring_channel, traffic_type ORDER BY total_sales DESC LIMIT 100 ${dateFilter}`
      ),
      client.shopifyqlQuery(
        `FROM sessions SHOW sessions GROUP BY referring_channel TIMESERIES day ${dateFilter}`
      ),
      // Daily sales + orders timeseries for sparklines
      client.shopifyqlQuery(`FROM sales SHOW total_sales, orders TIMESERIES day ${dateFilter}`),
      // Previous period for change %
      prevDateFilter
        ? client.shopifyqlQuery(`FROM sessions SHOW sessions ${prevDateFilter}`)
        : Promise.resolve(null),
      prevDateFilter
        ? client.shopifyqlQuery(`FROM sales SHOW orders, total_sales ${prevDateFilter}`)
        : Promise.resolve(null),
      // Marketing activities (GraphQL) for ad spend / ROAS
      client.getMarketingActivities(250).catch((err: any) => {
        console.warn('[marketing] Failed to fetch marketing activities for ad spend:', err.message)
        return [] as any[]
      }),
      // Marketing events (REST) — fallback for ad spend via budget field
      client.getMarketingEvents().catch((err: any) => {
        console.warn('[marketing] Failed to fetch marketing events (REST):', err.message)
        return [] as any[]
      }),
      // Customer journey orders — for new vs returning per channel
      // Uses customerOrderIndex (1=new, >1=returning) + lastVisit.source for channel attribution
      client.getCustomerJourneys(250, journeyQuery).catch((err: any) => {
        console.warn(
          '[marketing] Failed to fetch customer journeys for new/returning:',
          err.message
        )
        return [] as any[]
      }),
    ])

    function val(row: any[], colMap: Record<string, number>, key: string): string {
      const idx = colMap[key]
      return String(idx != null ? (row[idx] ?? '0') : '0')
    }

    // Parse summary
    let totalSessions = 0
    let totalOrders = 0
    let totalSales = 0

    if (sessionsSummaryResult.status === 'fulfilled' && sessionsSummaryResult.value.rows?.length) {
      const colMap = buildColMap(sessionsSummaryResult.value.columns)
      totalSessions = parseInt(val(sessionsSummaryResult.value.rows[0], colMap, 'sessions'), 10)
    } else if (sessionsSummaryResult.status === 'rejected') {
      const msg = sessionsSummaryResult.reason?.message || ''
      console.error('Sessions summary query failed:', msg)
      if (msg.includes('read_reports') || msg.includes('scope') || msg.includes('shopifyqlQuery')) {
        warning =
          'Marketing attribution data requires the read_reports scope. Check your app permissions.'
      } else {
        warning = `Marketing attribution data unavailable: ${msg.slice(0, 200)}`
      }
    }

    if (salesSummaryResult.status === 'fulfilled' && salesSummaryResult.value.rows?.length) {
      const colMap = buildColMap(salesSummaryResult.value.columns)
      totalOrders = parseInt(val(salesSummaryResult.value.rows[0], colMap, 'orders'), 10)
      totalSales = parseFloat(val(salesSummaryResult.value.rows[0], colMap, 'total_sales'))
    }

    let summary: ShopifyMarketingAttributionSummary = {
      totalSessions,
      totalOrders,
      totalSales,
      conversionRate: totalSessions > 0 ? (totalOrders / totalSessions) * 100 : 0,
      currency: 'USD',
    }

    // Parse sales + orders by channel+type into a lookup map
    const salesByKey: Record<string, { orders: number; totalSales: number }> = {}
    if (salesChannelsResult.status === 'fulfilled' && salesChannelsResult.value.rows?.length) {
      const colMap = buildColMap(salesChannelsResult.value.columns)
      for (const row of salesChannelsResult.value.rows) {
        const channel = (val(row, colMap, 'referring_channel') || 'Direct').toLowerCase()
        const type = (val(row, colMap, 'traffic_type') || 'unknown').toLowerCase()
        const key = `${channel}::${type}`
        const sales = parseFloat(val(row, colMap, 'total_sales'))
        const orders = parseInt(val(row, colMap, 'orders'), 10)
        salesByKey[key] = {
          totalSales: (salesByKey[key]?.totalSales ?? 0) + sales,
          orders: (salesByKey[key]?.orders ?? 0) + orders,
        }
      }
    } else if (salesChannelsResult.status === 'rejected') {
      console.error(
        '[marketing] Sales by channel query failed:',
        salesChannelsResult.reason?.message
      )
    }

    // Build channels from sessions (grouped by channel+type), merge with sales
    const channels: ShopifyMarketingChannelRow[] = []
    if (
      sessionsChannelsResult.status === 'fulfilled' &&
      sessionsChannelsResult.value.rows?.length
    ) {
      const colMap = buildColMap(sessionsChannelsResult.value.columns)
      for (const row of sessionsChannelsResult.value.rows) {
        const channel = val(row, colMap, 'referring_channel') || 'Direct'
        const type = val(row, colMap, 'traffic_type') || 'unknown'
        const sessions = parseInt(val(row, colMap, 'sessions'), 10)

        const key = `${channel.toLowerCase()}::${type.toLowerCase()}`
        const channelTotalSales = salesByKey[key]?.totalSales ?? 0
        const orders = salesByKey[key]?.orders ?? 0

        channels.push({
          channel,
          type,
          sessions,
          orders,
          totalSales: channelTotalSales,
          conversionRate: sessions > 0 ? (orders / sessions) * 100 : 0,
        })
      }
    }

    // ── Ad Spend from Marketing Activities → ROAS ──
    // Map marketing channel type → lowercase channel name used in ShopifyQL
    const CHANNEL_TYPE_MAP: Record<string, string> = {
      SEARCH: 'google',
      SOCIAL: 'facebook',
      DISPLAY: 'google',
      EMAIL: 'shopify_email',
      REFERRAL: 'referral',
    }

    // Build ad spend by channel from marketing activities
    const adSpendByChannel: Record<string, number> = {}
    let totalAdSpend = 0

    if (
      marketingActivitiesResult.status === 'fulfilled' &&
      Array.isArray(marketingActivitiesResult.value)
    ) {
      const activities = marketingActivitiesResult.value
      const periodStart = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000)
      const periodEnd = endDate ? new Date(endDate) : new Date()

      for (const activity of activities) {
        if (!activity.adSpend?.amount || parseFloat(activity.adSpend.amount) === 0) continue

        // Filter to activities overlapping the selected period
        const activityStart = activity.marketingEvent?.startedAt
          ? new Date(activity.marketingEvent.startedAt)
          : activity.createdAt
            ? new Date(activity.createdAt)
            : null
        const activityEnd = activity.marketingEvent?.endedAt
          ? new Date(activity.marketingEvent.endedAt)
          : null

        if (activityStart && activityStart > periodEnd) continue
        if (activityEnd && activityEnd < periodStart) continue

        const spend = parseFloat(activity.adSpend.amount)

        // Determine channel: prefer UTM source, fall back to channel type mapping
        let channel =
          activity.utmParameters?.source?.toLowerCase() ||
          CHANNEL_TYPE_MAP[activity.marketingChannelType] ||
          activity.marketingChannelType?.toLowerCase() ||
          'unknown'

        // Normalize common channel names
        if (channel === 'ig' || channel === 'instagram') channel = 'instagram'
        if (channel === 'fb' || channel === 'meta') channel = 'facebook'
        if (channel === 'yt') channel = 'youtube'

        adSpendByChannel[channel] = (adSpendByChannel[channel] || 0) + spend
        totalAdSpend += spend
      }
    }

    // Fallback: if no spend from GraphQL activities, try REST marketing events (budget field)
    if (
      totalAdSpend === 0 &&
      marketingEventsResult.status === 'fulfilled' &&
      Array.isArray(marketingEventsResult.value)
    ) {
      const events = marketingEventsResult.value
      const periodStart = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000)
      const periodEnd = endDate ? new Date(endDate) : new Date()

      for (const event of events) {
        if (!event.budget || parseFloat(event.budget) === 0) continue

        const eventStart = event.started_at ? new Date(event.started_at) : null
        const eventEnd =
          event.ended_at || event.scheduled_to_end_at
            ? new Date(event.ended_at || event.scheduled_to_end_at)
            : null

        if (eventStart && eventStart > periodEnd) continue
        if (eventEnd && eventEnd < periodStart) continue

        const spend = parseFloat(event.budget)

        let channel =
          event.utm_source?.toLowerCase() || event.marketing_channel?.toLowerCase() || 'unknown'

        if (channel === 'ig' || channel === 'instagram') channel = 'instagram'
        if (channel === 'fb' || channel === 'meta') channel = 'facebook'
        if (channel === 'yt') channel = 'youtube'

        adSpendByChannel[channel] = (adSpendByChannel[channel] || 0) + spend
        totalAdSpend += spend
      }
    }

    // Attach ad spend + ROAS to each channel row
    for (const ch of channels) {
      const chKey = ch.channel.toLowerCase()
      const spend = adSpendByChannel[chKey] || 0
      if (spend > 0) {
        ch.adSpend = spend
        ch.roas = ch.totalSales / spend
      } else {
        ch.adSpend = 0
        ch.roas = null
      }
    }

    // Overall ROAS in summary
    summary.totalAdSpend = totalAdSpend
    summary.roas = totalAdSpend > 0 ? totalSales / totalAdSpend : null

    // ── Attribution from Customer Journeys ──
    // Normalizes a raw journey source to a consistent lowercase channel key
    const normalizeSource = (raw: string): string => {
      let src = raw.toLowerCase().trim()
      // Strip URL protocols, paths, query strings, and trailing slashes
      // e.g. "https://tradedoubler.com/path?q=1" → "tradedoubler.com"
      src = src.replace(/^https?:\/\//, '')
      src = src.replace(/[/?#].*$/, '') // strip everything after first / ? or #
      // Strip domain suffixes
      src = src.replace(/\.(com|co|org|net|io|app|de|uk|se|fr|nl|be|au|ca|in|jp)$/, '')
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
        if (src.startsWith(prefix)) {
          src = src.slice(prefix.length)
          break
        }
      }
      // If still contains a dot (e.g. "abc.tradedoubler"), take the last segment
      if (src.includes('.')) {
        const parts = src.split('.')
        src = parts[parts.length - 1]
      }
      return src
    }

    // Resolve a visit object to a normalized source string
    // Prioritize visit.source (the referring channel) over UTM — this matches how
    // Shopify's Attribution page attributes (e.g. source="tradedoubler" not utm="trdblr")
    const resolveVisit = (visit: any): string | null => {
      const raw = visit?.source || visit?.utmParameters?.source
      return raw ? normalizeSource(raw) : null
    }

    // Pick attribution source based on selected model
    const getAttributionSource = (journey: any): string | null => {
      const first = resolveVisit(journey.firstVisit)
      const last = resolveVisit(journey.lastVisit)

      if (attributionModel === 'first_click') {
        return first || last || null
      }
      if (attributionModel === 'last_non_direct') {
        if (last && last !== 'direct') return last
        if (first && first !== 'direct') return first
        return last || first || null
      }
      // last_click (default)
      return last || first || null
    }

    // Aggregate journey data by source
    const newBySource: Record<string, number> = {}
    const returningBySource: Record<string, number> = {}
    const journeySalesBySource: Record<string, number> = {}
    const journeyOrdersBySource: Record<string, number> = {}
    let journeyTotalSales = 0
    let journeyTotalOrders = 0

    if (journeyOrdersResult.status === 'fulfilled' && Array.isArray(journeyOrdersResult.value)) {
      for (const order of journeyOrdersResult.value) {
        const journey = order.customerJourneySummary
        if (!journey) continue

        const src = getAttributionSource(journey)
        if (!src) continue

        const isNew = journey.customerOrderIndex === 1
        if (isNew) {
          newBySource[src] = (newBySource[src] || 0) + 1
        } else {
          returningBySource[src] = (returningBySource[src] || 0) + 1
        }

        const orderTotal = parseFloat(order.totalPriceSet?.shopMoney?.amount || '0')
        journeySalesBySource[src] = (journeySalesBySource[src] || 0) + orderTotal
        journeyOrdersBySource[src] = (journeyOrdersBySource[src] || 0) + 1
        journeyTotalSales += orderTotal
        journeyTotalOrders += 1
      }
    }

    // ── Distribute journey values to channel rows ──
    // Unique key per channel row (channel name + type)
    const chKey = (ch: ShopifyMarketingChannelRow) =>
      `${ch.channel.toLowerCase()}::${ch.type.toLowerCase()}`

    // Distribute a source map to channel rows using proportional split by sessions.
    const distributeToChannels = (
      sourceMap: Record<string, number>,
      roundToInt: boolean
    ): Record<string, number> => {
      const result: Record<string, number> = {}
      for (const ch of channels) result[chKey(ch)] = 0

      for (const [src, totalValue] of Object.entries(sourceMap)) {
        // Find matching channels: exact + first-word combined, then contains as fallback
        const seen = new Set<string>()
        const matches: ShopifyMarketingChannelRow[] = []

        // Exact match
        for (const ch of channels) {
          if (ch.channel.toLowerCase() === src) {
            const k = chKey(ch)
            if (!seen.has(k)) {
              seen.add(k)
              matches.push(ch)
            }
          }
        }

        // First-word match (always add alongside exact)
        for (const ch of channels) {
          const lc = ch.channel.toLowerCase()
          const fw = lc.split(/[\s_-]/)[0]
          if (fw !== lc && fw === src) {
            const k = chKey(ch)
            if (!seen.has(k)) {
              seen.add(k)
              matches.push(ch)
            }
          }
        }

        // Contains (only if nothing above)
        if (matches.length === 0 && src.length > 3) {
          for (const ch of channels) {
            const lc = ch.channel.toLowerCase()
            if (lc.includes(src) || src.includes(lc)) {
              const k = chKey(ch)
              if (!seen.has(k)) {
                seen.add(k)
                matches.push(ch)
              }
            }
          }
        }

        if (matches.length === 0) continue

        // Always split proportionally by sessions across ALL matching channels
        const totalSessions = matches.reduce((s, ch) => s + ch.sessions, 0)
        if (totalSessions === 0) {
          const share = totalValue / matches.length
          for (const ch of matches) {
            result[chKey(ch)] = (result[chKey(ch)] || 0) + share
          }
        } else {
          for (const ch of matches) {
            const proportion = ch.sessions / totalSessions
            result[chKey(ch)] = (result[chKey(ch)] || 0) + totalValue * proportion
          }
        }
      }

      // Round values
      for (const key of Object.keys(result)) {
        result[key] = roundToInt ? Math.round(result[key]) : Math.round(result[key] * 100) / 100
      }
      return result
    }

    // For non-default models: re-attribute sales/orders using journey data
    const useJourneyAttribution =
      attributionModel === 'first_click' || attributionModel === 'last_non_direct'

    if (useJourneyAttribution) {
      const distSales = distributeToChannels(journeySalesBySource, false)
      const distOrders = distributeToChannels(journeyOrdersBySource, true)

      for (const ch of channels) {
        const key = chKey(ch)
        ch.totalSales = distSales[key] ?? 0
        ch.orders = distOrders[key] ?? 0
        ch.conversionRate = ch.sessions > 0 ? (ch.orders / ch.sessions) * 100 : 0
        if (ch.adSpend && ch.adSpend > 0) {
          ch.roas = ch.totalSales / ch.adSpend
        }
      }

      // Add unmatched journey sources as new channel rows
      const allMatchedSources = new Set<string>()
      for (const ch of channels) {
        const lc = ch.channel.toLowerCase()
        allMatchedSources.add(lc)
        const fw = lc.split(/[\s_-]/)[0]
        if (fw !== lc) allMatchedSources.add(fw)
      }
      for (const [src, sales] of Object.entries(journeySalesBySource)) {
        if (allMatchedSources.has(src)) continue
        channels.push({
          channel: src.charAt(0).toUpperCase() + src.slice(1),
          type: 'unknown',
          sessions: 0,
          orders: journeyOrdersBySource[src] || 0,
          totalSales: Math.round(sales * 100) / 100,
          conversionRate: 0,
          adSpend: 0,
          roas: null,
          newCustomers: newBySource[src] || 0,
          returningCustomers: returningBySource[src] || 0,
        })
      }

      // Update summary totals
      summary.totalSales = journeyTotalSales
      summary.totalOrders = journeyTotalOrders
      summary.conversionRate = totalSessions > 0 ? (journeyTotalOrders / totalSessions) * 100 : 0
      if (summary.totalAdSpend && summary.totalAdSpend > 0) {
        summary.roas = journeyTotalSales / summary.totalAdSpend
      }
    }

    // Attach new/returning counts
    const distNew = distributeToChannels(newBySource, true)
    const distReturning = distributeToChannels(returningBySource, true)
    for (const ch of channels) {
      const key = chKey(ch)
      ch.newCustomers = distNew[key] ?? 0
      ch.returningCustomers = distReturning[key] ?? 0
    }

    // Parse session trend
    const sessionsTrend: ShopifyMarketingSessionTrend[] = []
    if (trendResult.status === 'fulfilled' && trendResult.value.rows?.length) {
      const colMap = buildColMap(trendResult.value.columns)
      for (const row of trendResult.value.rows) {
        sessionsTrend.push({
          date: String(val(row, colMap, 'day')).slice(0, 10),
          channel: val(row, colMap, 'referring_channel') || 'Direct',
          sessions: parseInt(val(row, colMap, 'sessions'), 10),
        })
      }
    }

    // Parse daily sales trend for sparklines
    const salesTrend: { date: string; totalSales: number; orders: number }[] = []
    if (salesTrendResult.status === 'fulfilled' && salesTrendResult.value?.rows?.length) {
      const colMap = buildColMap(salesTrendResult.value.columns)
      for (const row of salesTrendResult.value.rows) {
        salesTrend.push({
          date: String(val(row, colMap, 'day')).slice(0, 10),
          totalSales: parseFloat(val(row, colMap, 'total_sales')),
          orders: parseInt(val(row, colMap, 'orders'), 10),
        })
      }
    }

    // Parse previous period for change %
    let prevSessions = 0
    let prevOrders = 0
    let prevSales = 0
    if (prevSessionsResult.status === 'fulfilled' && prevSessionsResult.value?.rows?.length) {
      const colMap = buildColMap(prevSessionsResult.value.columns)
      prevSessions = parseInt(val(prevSessionsResult.value.rows[0], colMap, 'sessions'), 10)
    }
    if (prevSalesResult.status === 'fulfilled' && prevSalesResult.value?.rows?.length) {
      const colMap = buildColMap(prevSalesResult.value.columns)
      prevOrders = parseInt(val(prevSalesResult.value.rows[0], colMap, 'orders'), 10)
      prevSales = parseFloat(val(prevSalesResult.value.rows[0], colMap, 'total_sales'))
    }
    const prevConversion = prevSessions > 0 ? (prevOrders / prevSessions) * 100 : 0

    const pctChange = (cur: number, prev: number) =>
      prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null

    try {
      const shop = await client.getShop()
      summary.currency = shop.currency
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      data: {
        summary,
        channels,
        sessionsTrend,
        salesTrend,
        attributionModel,
        comparison: prevDateFilter
          ? {
              sessionsChange: pctChange(totalSessions, prevSessions),
              salesChange: pctChange(totalSales, prevSales),
              ordersChange: pctChange(totalOrders, prevOrders),
              conversionChange: pctChange(summary.conversionRate, prevConversion),
            }
          : null,
        ...(warning && { warning }),
      },
    })
  } catch (error) {
    console.error('Shopify marketing error:', error)
    return NextResponse.json({ error: 'Failed to fetch Shopify marketing data' }, { status: 500 })
  }
})
