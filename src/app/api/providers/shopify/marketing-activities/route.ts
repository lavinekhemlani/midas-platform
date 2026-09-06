import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const [activities, events] = await Promise.allSettled([
      client.getMarketingActivities(100),
      client.getMarketingEvents(),
    ])

    const activityList =
      activities.status === 'fulfilled' ? activities.value : []
    const eventList =
      events.status === 'fulfilled' ? events.value : []

    // Compute summary
    let totalSpend = 0
    let currency = 'USD'
    const byChannel: Record<string, { count: number; spend: number }> = {}
    const byTactic: Record<string, { count: number; spend: number }> = {}
    const byStatus: Record<string, number> = {}

    for (const a of activityList) {
      const spend = parseFloat(a.adSpend?.amount || '0')
      totalSpend += spend
      if (a.adSpend?.currencyCode) currency = a.adSpend.currencyCode

      const channel = a.marketingChannelType || 'unknown'
      if (!byChannel[channel]) byChannel[channel] = { count: 0, spend: 0 }
      byChannel[channel].count += 1
      byChannel[channel].spend += spend

      const tactic = a.tactic || 'unknown'
      if (!byTactic[tactic]) byTactic[tactic] = { count: 0, spend: 0 }
      byTactic[tactic].count += 1
      byTactic[tactic].spend += spend

      const status = a.status || 'unknown'
      byStatus[status] = (byStatus[status] || 0) + 1
    }

    return NextResponse.json({
      data: {
        activities: activityList,
        events: eventList,
        summary: {
          totalActivities: activityList.length,
          totalEvents: eventList.length,
          totalAdSpend: totalSpend,
          currency,
          byChannel: Object.entries(byChannel).map(([channel, v]) => ({
            channel,
            ...v,
          })),
          byTactic: Object.entries(byTactic).map(([tactic, v]) => ({
            tactic,
            ...v,
          })),
          byStatus: Object.entries(byStatus).map(([status, count]) => ({
            status,
            count,
          })),
        },
        ...(activities.status === 'rejected' && {
          activitiesWarning: activities.reason?.message,
        }),
        ...(events.status === 'rejected' && {
          eventsWarning: events.reason?.message,
        }),
      },
    })
  } catch (error) {
    console.error('Shopify marketing activities error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch marketing activities' },
      { status: 500 }
    )
  }
})
