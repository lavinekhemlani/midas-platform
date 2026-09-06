import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'
import type {
  ShopifyCustomer,
  ShopifyCustomerAcquisitionPoint,
  ShopifyGraphQLCustomerNode,
  ShopifyVIPCustomer,
  ShopifyRetentionCohort,
  ShopifyOrder,
} from '@/lib/providers/shopify/types'

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    const customerParams: Record<string, string> = {}
    const countParams: Record<string, string> = {}

    if (startDate) {
      const iso = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`
      customerParams.created_at_min = iso
      countParams.created_at_min = iso
    }
    if (endDate) {
      const iso = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`
      customerParams.created_at_max = iso
      countParams.created_at_max = iso
    }

    let customers: ShopifyCustomer[] = []
    let totalCount = 0
    let restWarning: string | undefined

    let storeTimezone: string | undefined

    try {
      ;[customers, totalCount] = await Promise.all([
        client.getCustomers(customerParams),
        client.getCustomersCount(countParams),
      ])
      try {
        const shop = await client.getShop()
        storeTimezone = shop.iana_timezone
      } catch {
        // Non-critical
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes('403')) {
        restWarning =
          'Protected customer data access required. Enable it in your Shopify app settings under Configuration > Protected customer data access.'
      } else {
        throw error
      }
    }

    // Fetch richer GraphQL customer data in parallel
    let graphqlCustomers: ShopifyGraphQLCustomerNode[] | undefined
    let graphqlWarning: string | undefined
    try {
      graphqlCustomers = await client.getCustomersGraphQL()
    } catch (error: unknown) {
      console.warn('GraphQL customers fetch failed, falling back to REST only:', error)
      const msg = error instanceof Error ? error.message : ''
      if (msg.includes('protected') || msg.includes('not approved')) {
        graphqlWarning =
          'Enhanced customer insights (LTV, marketing consent) require Protected Customer Data access. Enable it in your Shopify app settings under Configuration > Protected customer data access.'
      } else {
        graphqlWarning = 'Enhanced customer analytics unavailable — using basic data.'
      }
    }

    // Compute base stats from REST data
    const totalSpent = customers.reduce((sum, c) => sum + parseFloat(c.total_spent || '0'), 0)
    const avgSpent = customers.length > 0 ? totalSpent / customers.length : 0
    const withOrdersCount = customers.filter((c) => (c.orders_count || 0) > 0).length
    const totalOrders = customers.reduce((sum, c) => sum + (c.orders_count || 0), 0)

    // Compute enhanced segmentation stats
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    let avgOrderValue: number | undefined
    let returningRate: number | undefined
    let emailSubscribers: number | undefined
    let smsSubscribers: number | undefined
    let topSpenders: number | undefined
    let atRisk: number | undefined
    let newLast30d: number | undefined
    let predictedHighTier: number | undefined
    let totalStoreCredit: number | undefined
    let customersWithStoreCredit: number | undefined
    const atRiskCustomers: Array<{
      email: string | null
      name: string
      totalSpent: string
      currency: string
      lastOrderDate: string
      orderCount: number
    }> = []

    if (graphqlCustomers && graphqlCustomers.length > 0) {
      // Use GraphQL data for richer stats
      const gqlTotalSpent = graphqlCustomers.reduce(
        (sum, c) => sum + parseFloat(c.amountSpent.amount || '0'),
        0
      )
      const gqlTotalOrders = graphqlCustomers.reduce(
        (sum, c) => sum + parseInt(c.numberOfOrders || '0', 10),
        0
      )

      avgOrderValue = gqlTotalOrders > 0 ? gqlTotalSpent / gqlTotalOrders : 0

      const customersWithOrders = graphqlCustomers.filter(
        (c) => parseInt(c.numberOfOrders || '0', 10) > 0
      )
      const returningCustomers = graphqlCustomers.filter(
        (c) => parseInt(c.numberOfOrders || '0', 10) > 1
      )
      returningRate =
        customersWithOrders.length > 0
          ? (returningCustomers.length / customersWithOrders.length) * 100
          : 0

      emailSubscribers = graphqlCustomers.filter(
        (c) => c.emailMarketingConsent?.marketingState === 'SUBSCRIBED'
      ).length

      smsSubscribers = graphqlCustomers.filter(
        (c) => c.smsMarketingConsent?.marketingState === 'SUBSCRIBED'
      ).length

      const avgGqlSpent = graphqlCustomers.length > 0 ? gqlTotalSpent / graphqlCustomers.length : 0
      topSpenders = graphqlCustomers.filter(
        (c) => parseFloat(c.amountSpent.amount || '0') > avgGqlSpent * 2
      ).length

      for (const c of graphqlCustomers) {
        const orders = parseInt(c.numberOfOrders || '0', 10)
        if (orders === 0) continue
        const lastOrderDate = c.lastOrder?.createdAt ? new Date(c.lastOrder.createdAt) : null
        if (lastOrderDate !== null && lastOrderDate < ninetyDaysAgo) {
          atRiskCustomers.push({
            email: c.email,
            name: c.displayName || c.email || 'Unknown',
            totalSpent: c.amountSpent.amount,
            currency: c.amountSpent.currencyCode,
            lastOrderDate: c.lastOrder!.createdAt,
            orderCount: orders,
          })
        }
      }
      atRisk = atRiskCustomers.length

      newLast30d = graphqlCustomers.filter((c) => new Date(c.createdAt) >= thirtyDaysAgo).length

      // Predicted spend tier (Shopify ML output) — only count customers
      // for whom Shopify returned the field; missing scope/data = undefined.
      const tierAvailable = graphqlCustomers.some((c) => c.statistics?.predictedSpendTier != null)
      if (tierAvailable) {
        predictedHighTier = graphqlCustomers.filter(
          (c) => c.statistics?.predictedSpendTier === 'HIGH'
        ).length
      }

      // Store credit aggregates — sum balances across every account.
      // Skip the entire summary if no customer returned the field at all
      // (so we can distinguish "zero credit issued" from "scope missing").
      const creditAvailable = graphqlCustomers.some((c) => c.storeCreditAccounts != null)
      if (creditAvailable) {
        let creditTotal = 0
        let creditCustomers = 0
        for (const c of graphqlCustomers) {
          const accounts = c.storeCreditAccounts?.edges?.map((e) => e.node) ?? []
          const customerBalance = accounts.reduce(
            (sum, a) => sum + parseFloat(a.balance.amount || '0'),
            0
          )
          if (customerBalance > 0) {
            creditCustomers += 1
            creditTotal += customerBalance
          }
        }
        totalStoreCredit = creditTotal
        customersWithStoreCredit = creditCustomers
      }
    } else if (customers.length > 0) {
      // Fallback: compute what we can from REST data
      avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0

      const customersWithOrders = customers.filter((c) => (c.orders_count || 0) > 0)
      const returningCustomers = customers.filter((c) => (c.orders_count || 0) > 1)
      returningRate =
        customersWithOrders.length > 0
          ? (returningCustomers.length / customersWithOrders.length) * 100
          : 0

      topSpenders = customers.filter((c) => parseFloat(c.total_spent || '0') > avgSpent * 2).length

      for (const c of customers) {
        if ((c.orders_count || 0) === 0) continue
        const proxyDate = c.updated_at ? new Date(c.updated_at) : null
        if (proxyDate !== null && proxyDate < ninetyDaysAgo) {
          atRiskCustomers.push({
            email: c.email,
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || 'Unknown',
            totalSpent: c.total_spent || '0',
            currency: c.currency || 'USD',
            lastOrderDate: c.updated_at,
            orderCount: c.orders_count || 0,
          })
        }
      }
      atRisk = atRiskCustomers.length

      newLast30d = customers.filter(
        (c) => c.created_at && new Date(c.created_at) >= thirtyDaysAgo
      ).length
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

    // Compute customer acquisition trends grouped by granularity
    const acquisitionMap = new Map<string, { newCustomers: number; totalSpent: number }>()

    if (graphqlCustomers && graphqlCustomers.length > 0) {
      for (const c of graphqlCustomers) {
        const key = getGroupKey(c.createdAt)
        const entry = acquisitionMap.get(key) || { newCustomers: 0, totalSpent: 0 }
        entry.newCustomers += 1
        entry.totalSpent += parseFloat(c.amountSpent.amount || '0')
        acquisitionMap.set(key, entry)
      }
    } else if (customers.length > 0) {
      for (const c of customers) {
        if (!c.created_at) continue
        const key = getGroupKey(c.created_at)
        const entry = acquisitionMap.get(key) || { newCustomers: 0, totalSpent: 0 }
        entry.newCustomers += 1
        entry.totalSpent += parseFloat(c.total_spent || '0')
        acquisitionMap.set(key, entry)
      }
    }

    const acquisitionTrend: ShopifyCustomerAcquisitionPoint[] = Array.from(acquisitionMap.entries())
      .map(([date, { newCustomers, totalSpent }]) => ({ date, newCustomers, totalSpent }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // ── VIP Customers: top spenders + most ordered ──
    let vipCustomers: ShopifyVIPCustomer[] = []
    let mostOrdered: Array<{
      productTitle: string
      totalOrdered: number
      uniqueCustomers: number
    }> = []
    let avgDaysBetweenOrders: number | undefined
    let repeatPurchaseRate: number | undefined
    let avgOrderFrequency: number | undefined
    let retentionCohorts: ShopifyRetentionCohort[] = []

    try {
      // Build VIP list from GraphQL or REST data
      if (graphqlCustomers && graphqlCustomers.length > 0) {
        const gqlAvgSpent =
          graphqlCustomers.reduce((s, c) => s + parseFloat(c.amountSpent.amount || '0'), 0) /
          graphqlCustomers.length
        vipCustomers = graphqlCustomers
          .filter(
            (c) =>
              parseFloat(c.amountSpent.amount || '0') > gqlAvgSpent * 2 &&
              parseInt(c.numberOfOrders || '0', 10) > 0
          )
          .sort(
            (a, b) =>
              parseFloat(b.amountSpent.amount || '0') - parseFloat(a.amountSpent.amount || '0')
          )
          .slice(0, 15)
          .map((c) => ({
            name: c.displayName || c.email || 'Unknown',
            email: c.email,
            totalSpent: parseFloat(c.amountSpent.amount || '0'),
            ordersCount: parseInt(c.numberOfOrders || '0', 10),
            avgOrderValue:
              parseInt(c.numberOfOrders || '0', 10) > 0
                ? parseFloat(c.amountSpent.amount || '0') / parseInt(c.numberOfOrders || '0', 10)
                : 0,
            lastOrderDate: c.lastOrder?.createdAt || null,
            currency: c.amountSpent.currencyCode,
          }))

        // Repeat purchase metrics from GraphQL
        const withOrders = graphqlCustomers.filter((c) => parseInt(c.numberOfOrders || '0', 10) > 0)
        const repeaters = graphqlCustomers.filter((c) => parseInt(c.numberOfOrders || '0', 10) > 1)
        repeatPurchaseRate =
          withOrders.length > 0 ? Math.round((repeaters.length / withOrders.length) * 1000) / 10 : 0
        avgOrderFrequency =
          withOrders.length > 0
            ? Math.round(
                (withOrders.reduce((s, c) => s + parseInt(c.numberOfOrders || '0', 10), 0) /
                  withOrders.length) *
                  10
              ) / 10
            : 0
      } else if (customers.length > 0) {
        vipCustomers = customers
          .filter(
            (c) => parseFloat(c.total_spent || '0') > avgSpent * 2 && (c.orders_count || 0) > 0
          )
          .sort((a, b) => parseFloat(b.total_spent || '0') - parseFloat(a.total_spent || '0'))
          .slice(0, 15)
          .map((c) => ({
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || 'Unknown',
            email: c.email,
            totalSpent: parseFloat(c.total_spent || '0'),
            ordersCount: c.orders_count || 0,
            avgOrderValue:
              (c.orders_count || 0) > 0
                ? parseFloat(c.total_spent || '0') / (c.orders_count || 0)
                : 0,
            lastOrderDate: c.updated_at,
            currency: c.currency || 'USD',
          }))

        const withOrders = customers.filter((c) => (c.orders_count || 0) > 0)
        const repeaters = customers.filter((c) => (c.orders_count || 0) > 1)
        repeatPurchaseRate =
          withOrders.length > 0 ? Math.round((repeaters.length / withOrders.length) * 1000) / 10 : 0
        avgOrderFrequency =
          withOrders.length > 0
            ? Math.round(
                (withOrders.reduce((s, c) => s + (c.orders_count || 0), 0) / withOrders.length) * 10
              ) / 10
            : 0
      }

      // Fetch orders to compute most-ordered products and avg days between orders
      const orderParams: Record<string, string> = { limit: '250', status: 'any' }
      if (startDate)
        orderParams.created_at_min = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`
      if (endDate)
        orderParams.created_at_max = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`

      const allOrders: ShopifyOrder[] = await client.getOrders(orderParams)
      const validOrders = allOrders.filter((o) => o.cancelled_at === null && !o.test)

      // Most ordered products
      const productOrderMap = new Map<string, { totalOrdered: number; customers: Set<string> }>()
      for (const order of validOrders) {
        const custKey = order.customer?.email || order.customer?.id?.toString() || ''
        for (const li of order.line_items) {
          const title = li.title || 'Unknown'
          if (!productOrderMap.has(title))
            productOrderMap.set(title, { totalOrdered: 0, customers: new Set() })
          const m = productOrderMap.get(title)!
          m.totalOrdered += li.quantity
          if (custKey) m.customers.add(custKey)
        }
      }
      mostOrdered = Array.from(productOrderMap.entries())
        .map(([productTitle, m]) => ({
          productTitle,
          totalOrdered: m.totalOrdered,
          uniqueCustomers: m.customers.size,
        }))
        .sort((a, b) => b.totalOrdered - a.totalOrdered)
        .slice(0, 10)

      // Avg days between orders (for repeat customers)
      const customerOrders = new Map<string, Date[]>()
      for (const order of validOrders) {
        const custKey = order.customer?.email || order.customer?.id?.toString() || ''
        if (!custKey) continue
        if (!customerOrders.has(custKey)) customerOrders.set(custKey, [])
        customerOrders.get(custKey)!.push(new Date(order.created_at))
      }
      const daysBetween: number[] = []
      for (const [, dates] of customerOrders) {
        if (dates.length < 2) continue
        dates.sort((a, b) => a.getTime() - b.getTime())
        for (let i = 1; i < dates.length; i++) {
          daysBetween.push((dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24))
        }
      }
      avgDaysBetweenOrders =
        daysBetween.length > 0
          ? Math.round((daysBetween.reduce((s, d) => s + d, 0) / daysBetween.length) * 10) / 10
          : undefined

      // Retention cohorts (by month of first purchase)
      const customerFirstPurchase = new Map<string, { firstDate: Date; allDates: Date[] }>()
      for (const [custKey, dates] of customerOrders) {
        dates.sort((a, b) => a.getTime() - b.getTime())
        customerFirstPurchase.set(custKey, { firstDate: dates[0], allDates: dates })
      }
      const cohortMap = new Map<
        string,
        { total: number; at30: number; at60: number; at90: number }
      >()
      for (const [, { firstDate, allDates }] of customerFirstPurchase) {
        const cohortKey = `${firstDate.getFullYear()}-${String(firstDate.getMonth() + 1).padStart(2, '0')}`
        if (!cohortMap.has(cohortKey))
          cohortMap.set(cohortKey, { total: 0, at30: 0, at60: 0, at90: 0 })
        const c = cohortMap.get(cohortKey)!
        c.total++
        if (allDates.length < 2) continue
        const firstMs = firstDate.getTime()
        const hasRepurchaseWithin = (days: number) =>
          allDates.some((d, i) => i > 0 && (d.getTime() - firstMs) / (1000 * 60 * 60 * 24) <= days)
        if (hasRepurchaseWithin(30)) c.at30++
        if (hasRepurchaseWithin(60)) c.at60++
        if (hasRepurchaseWithin(90)) c.at90++
      }
      retentionCohorts = Array.from(cohortMap.entries())
        .map(([cohortMonth, c]) => ({
          cohortMonth,
          customersInCohort: c.total,
          retainedAt30d: c.total > 0 ? Math.round((c.at30 / c.total) * 1000) / 10 : 0,
          retainedAt60d: c.total > 0 ? Math.round((c.at60 / c.total) * 1000) / 10 : 0,
          retainedAt90d: c.total > 0 ? Math.round((c.at90 / c.total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth))
        .slice(-12) // Last 12 months
    } catch {
      // Non-critical enrichment — continue with basic data
    }

    // If REST failed with 403 but GraphQL succeeded, still return the 403 warning
    // but include whatever data we have
    if (restWarning && !graphqlCustomers) {
      return NextResponse.json({
        data: {
          customers: [],
          summary: {
            totalCount: 0,
            totalSpent: 0,
            avgSpent: 0,
            withOrdersCount: 0,
            totalOrders: 0,
            currency: 'USD',
          },
          warning: restWarning,
          acquisitionTrend: [],
        },
      })
    }

    const currency =
      graphqlCustomers?.[0]?.amountSpent?.currencyCode || customers[0]?.currency || 'USD'

    return NextResponse.json({
      data: {
        customers,
        ...(graphqlCustomers && { graphqlCustomers }),
        summary: {
          totalCount: totalCount || customers.length,
          totalSpent,
          avgSpent,
          withOrdersCount,
          totalOrders,
          currency,
          avgOrderValue,
          returningRate,
          emailSubscribers,
          smsSubscribers,
          topSpenders,
          atRisk,
          atRiskCustomers,
          newLast30d,
          avgDaysBetweenOrders,
          repeatPurchaseRate,
          avgOrderFrequency,
          predictedHighTier,
          totalStoreCredit,
          customersWithStoreCredit,
        },
        acquisitionTrend,
        ...(vipCustomers.length > 0 && { vipCustomers }),
        ...(mostOrdered.length > 0 && { mostOrdered }),
        ...(retentionCohorts.length > 0 && { retentionCohorts }),
        ...(storeTimezone && { storeTimezone }),
        ...(restWarning && { warning: restWarning }),
        ...(graphqlWarning && { graphqlWarning }),
      },
    })
  } catch (error) {
    console.error('Shopify customers error:', error)
    return NextResponse.json({ error: 'Failed to fetch Shopify customers' }, { status: 500 })
  }
})
