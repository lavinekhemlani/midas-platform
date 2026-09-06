import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getShopifyClient } from '../getShopifyClient'
import type {
  ShopifyDraftOrder,
  ShopifyDraftOrdersSummary,
  ShopifyDraftOrderTrendPoint,
} from '@/lib/providers/shopify/types'

/**
 * Shopify Draft Orders API route.
 * Uses GraphQL to fetch draft orders with B2B, payment terms, and ready fields.
 *
 * Query params:
 *   ?shop=domain    — target store
 *   ?status=open    — filter by status (open, invoice_sent, completed)
 *   ?startDate=     — filter by created_at (ISO 8601 or YYYY-MM-DD)
 *   ?endDate=       — filter by created_at (ISO 8601 or YYYY-MM-DD)
 */

function parseMoney(amount: string | null | undefined): number {
  if (!amount) return 0
  const n = parseFloat(amount)
  return Number.isFinite(n) ? n : 0
}

function getGroupKey(dateStr: string, granularity: 'day' | 'week' | 'month'): string {
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

/** Map a GraphQL DraftOrder node to the REST-shaped type the page expects */
function mapGraphQLNode(node: any): ShopifyDraftOrder {
  const totalPrice = node.totalPriceSet?.shopMoney?.amount ?? '0'
  const subtotalPrice = node.subtotalPriceSet?.shopMoney?.amount ?? '0'
  const totalTax = node.totalTaxSet?.shopMoney?.amount ?? '0'
  const currency = node.currencyCode || 'USD'

  // Map status from GraphQL (OPEN, INVOICE_SENT, COMPLETED) to REST lowercase
  const statusMap: Record<string, 'open' | 'invoice_sent' | 'completed'> = {
    OPEN: 'open',
    INVOICE_SENT: 'invoice_sent',
    COMPLETED: 'completed',
  }
  const status = statusMap[node.status] || 'open'

  // Map line items from GraphQL edges to REST shape
  const lineItems = (node.lineItems?.edges || []).map((e: any) => {
    const li = e.node
    return {
      id: li.id,
      title: li.title || '',
      quantity: li.quantity ?? 0,
      sku: li.sku || null,
      variant_title: li.variantTitle || null,
      vendor: li.vendor || null,
      price: li.originalUnitPriceSet?.shopMoney?.amount ?? '0',
    }
  })

  // Detect B2B
  const isB2B = !!node.purchasingEntity?.company?.name

  return {
    id: parseInt(node.id.replace(/\D/g, ''), 10) || 0,
    admin_graphql_api_id: node.id,
    name: node.name || '',
    status,
    created_at: node.createdAt,
    updated_at: node.updatedAt,
    completed_at: node.completedAt || null,
    invoice_sent_at: node.invoiceSentAt || null,
    currency,
    total_price: totalPrice,
    subtotal_price: subtotalPrice,
    total_tax: totalTax,
    customer: node.customer
      ? {
          id: parseInt(node.customer.id.replace(/\D/g, ''), 10) || 0,
          admin_graphql_api_id: node.customer.id,
          first_name: node.customer.displayName?.split(' ')[0] || '',
          last_name: node.customer.displayName?.split(' ').slice(1).join(' ') || '',
          email: node.customer.email || null,
          default_address: null,
        }
      : null,
    email: node.email || null,
    note: node.note2 || null,
    tags: (node.tags || []).join(', '),
    line_items: lineItems,
    invoice_url: node.invoiceUrl || null,
    // New GraphQL fields
    ready: node.ready ?? false,
    visibleToCustomer: node.visibleToCustomer ?? false,
    totalQuantityOfLineItems: node.totalQuantityOfLineItems ?? 0,
    poNumber: node.poNumber || null,
    purchasingEntity: node.purchasingEntity?.company
      ? {
          company: node.purchasingEntity.company,
          contact: node.purchasingEntity.contact || null,
          location: node.purchasingEntity.location || null,
        }
      : null,
    paymentTerms: node.paymentTerms || null,
    isB2B,
    convertedOrderName: node.order?.name || null,
  }
}

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const result = await getShopifyClient(request, organizationId)
    if ('error' in result) return result.error
    const { client } = result

    const url = new URL(request.url)
    const statusFilter = url.searchParams.get('status')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Build GraphQL query filter
    const queryParts: string[] = []
    if (statusFilter && statusFilter !== 'all') {
      queryParts.push(`status:${statusFilter}`)
    }
    if (startDate) queryParts.push(`created_at:>=${startDate}`)
    if (endDate) queryParts.push(`created_at:<=${endDate}`)
    const queryStr = queryParts.length > 0 ? queryParts.join(' ') : undefined

    // Paginate through GraphQL
    const pageSize = 25
    const maxItems = 500
    const allNodes: any[] = []
    let cursor: string | null = null

    while (allNodes.length < maxItems) {
      const page = await client.getDraftOrdersGraphQL({
        first: pageSize,
        query: queryStr,
        after: cursor ?? undefined,
      })

      for (const node of page.nodes) {
        allNodes.push(node)
      }

      if (!page.pageInfo.hasNextPage) break
      cursor = page.pageInfo.endCursor
      if (!cursor) break
    }

    // Map to typed items
    const draftOrders: ShopifyDraftOrder[] = allNodes.map(mapGraphQLNode)

    // Compute summary
    let openCount = 0
    let invoiceSentCount = 0
    let completedCount = 0
    let totalValue = 0
    let readyCount = 0
    let b2bCount = 0
    let paymentTermsCount = 0
    let totalLineItemQty = 0
    const paymentTermsMap: Record<string, number> = {}

    for (const d of draftOrders) {
      const price = parseFloat(d.total_price || '0')
      totalValue += price
      totalLineItemQty += d.totalQuantityOfLineItems ?? d.line_items?.length ?? 0

      switch (d.status) {
        case 'open':
          openCount++
          break
        case 'invoice_sent':
          invoiceSentCount++
          break
        case 'completed':
          completedCount++
          break
      }

      if (d.ready) readyCount++
      if (d.isB2B) b2bCount++
      if (d.paymentTerms) {
        paymentTermsCount++
        const name = d.paymentTerms.paymentTermsName || 'Unknown'
        paymentTermsMap[name] = (paymentTermsMap[name] || 0) + 1
      }
    }

    const paymentTermsBreakdown = Object.entries(paymentTermsMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    const summary: ShopifyDraftOrdersSummary = {
      totalDrafts: draftOrders.length,
      openCount,
      invoiceSentCount,
      completedCount,
      totalValue,
      avgValue: draftOrders.length > 0 ? totalValue / draftOrders.length : 0,
      currency: draftOrders[0]?.currency || 'USD',
      readyCount,
      b2bCount,
      paymentTermsCount,
      totalLineItemQty,
      paymentTermsBreakdown,
    }

    // Determine aggregation granularity
    const rangeMs =
      startDate && endDate ? new Date(endDate).getTime() - new Date(startDate).getTime() : Infinity
    const rangeDays = rangeMs / (1000 * 60 * 60 * 24)
    const granularity: 'day' | 'week' | 'month' =
      rangeDays <= 31 ? 'day' : rangeDays <= 90 ? 'week' : 'month'

    // Compute trend
    const trendMap = new Map<string, { created: number; completed: number; totalValue: number }>()

    for (const d of draftOrders) {
      const key = d.created_at ? getGroupKey(d.created_at, granularity) : ''
      if (!key) continue

      let bucket = trendMap.get(key)
      if (!bucket) {
        bucket = { created: 0, completed: 0, totalValue: 0 }
        trendMap.set(key, bucket)
      }

      bucket.created++
      if (d.status === 'completed') bucket.completed++
      bucket.totalValue += parseFloat(d.total_price || '0')
    }

    const draftTrend: ShopifyDraftOrderTrendPoint[] = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { created, completed, totalValue }]) => ({
        date,
        created,
        completed,
        totalValue,
      }))

    return NextResponse.json({ data: { draftOrders, summary, draftTrend } })
  } catch (error) {
    console.error('Shopify draft orders error:', error)
    return NextResponse.json({ error: 'Failed to fetch Shopify draft orders' }, { status: 500 })
  }
})
