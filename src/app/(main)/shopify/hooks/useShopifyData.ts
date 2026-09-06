'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'
import { useSearchParams } from 'next/navigation'
import type {
  ShopifyOrderDetail,
  ShopifyProductDetail,
  ShopifyCustomerDetail,
  ShopifyDisputeDetail,
  ShopifyDraftOrderDetail,
  ShopifyRefundDetailOrder,
  ShopifyCollectionDetail,
  ShopifyInventoryItemDetail,
  ShopifySummaryResponse,
  ShopifyOrdersResponse,
  ShopifyProductsResponse,
  ShopifyCustomersResponse,
  ShopifyInventoryResponse,
  ShopifyAnalyticsResponse,
  ShopifyRefundsResponse,
  ShopifyDisputesResponse,
  ShopifyCollectionsResponse,
  ShopifyDraftOrdersResponse,
  ShopifyMarketingResponse,
  ShopifyMarketingAttributionResponse,
  ShopifyAbandonedCheckoutsResponse,
  ShopifyTagReportingResponse,
  ShopifyReturnsResponse,
  ShopifyPayoutsResponse,
  ShopifyFulfillmentOpsResponse,
} from '@/lib/providers/shopify/types'

const fetcher = async <T>(url: string): Promise<{ data: T } | null> => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error(`Failed to fetch: ${url}`)
  }
  return response.json()
}

const swrOptions = { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }

interface DateRange {
  startDate?: string
  endDate?: string
}

function buildUrl(base: string, shop?: string | null, dateRange?: DateRange): string {
  const params = new URLSearchParams()
  if (shop) params.set('shop', shop)
  if (dateRange?.startDate) params.set('startDate', dateRange.startDate)
  if (dateRange?.endDate) params.set('endDate', dateRange.endDate)
  const qs = params.toString()
  if (!qs) return base
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}${qs}`
}

export function useShopifySummary(enabled: boolean, dateRange?: DateRange) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = buildUrl('/api/providers/shopify/summary', shop, dateRange)
  const { data, isLoading, error, mutate } = useSWR(
    enabled ? ['shopify-summary', url] : null,
    () => fetcher<ShopifySummaryResponse>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error, mutate }
}

export function useShopifyOrders(enabled: boolean, dateRange?: DateRange) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = buildUrl('/api/providers/shopify/orders', shop, dateRange)
  const { data, isLoading, error, mutate } = useSWR(
    enabled ? ['shopify-orders', url] : null,
    () => fetcher<ShopifyOrdersResponse>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error, mutate }
}

export function useShopifyProducts(enabled: boolean, dateRange?: DateRange) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = buildUrl('/api/providers/shopify/products', shop, dateRange)
  const { data, isLoading, error, mutate } = useSWR(
    enabled ? ['shopify-products', url] : null,
    () => fetcher<ShopifyProductsResponse>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error, mutate }
}

export function useShopifyProductAnalytics(enabled: boolean, dateRange?: DateRange) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = buildUrl('/api/providers/shopify/products/analytics', shop, dateRange)
  const { data, isLoading, error } = useSWR(
    enabled ? ['shopify-product-analytics', url] : null,
    () => fetcher<any>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error }
}

export function useShopifyCustomers(enabled: boolean, dateRange?: DateRange) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = buildUrl('/api/providers/shopify/customers', shop, dateRange)
  const { data, isLoading, error, mutate } = useSWR(
    enabled ? ['shopify-customers', url] : null,
    () => fetcher<ShopifyCustomersResponse>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error, mutate }
}

export function useShopifyInventory(enabled: boolean, dateRange?: DateRange) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = buildUrl('/api/providers/shopify/inventory', shop, dateRange)
  const { data, isLoading, error, mutate } = useSWR(
    enabled ? ['shopify-inventory', url] : null,
    () => fetcher<ShopifyInventoryResponse>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error, mutate }
}

export function useShopifySellThrough(enabled: boolean) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = buildUrl('/api/providers/shopify/inventory/sell-through', shop)
  const { data, isLoading, error } = useSWR(
    enabled ? ['shopify-sell-through', url] : null,
    () => fetcher<any>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error }
}

export function useShopifyAnalytics(enabled: boolean, period = '30d', dateRange?: DateRange) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const params = new URLSearchParams()
  params.set('period', period)
  if (dateRange?.startDate) params.set('startDate', dateRange.startDate)
  if (dateRange?.endDate) params.set('endDate', dateRange.endDate)
  const base = `/api/providers/shopify/analytics?${params.toString()}`
  const url = buildUrl(base, shop)
  const { data, isLoading, error, mutate } = useSWR(
    enabled ? ['shopify-analytics', url] : null,
    () => fetcher<ShopifyAnalyticsResponse>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error, mutate }
}

export function useShopifyRefunds(enabled: boolean, dateRange?: DateRange) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = buildUrl('/api/providers/shopify/refunds', shop, dateRange)
  const { data, isLoading, error, mutate } = useSWR(
    enabled ? ['shopify-refunds', url] : null,
    () => fetcher<ShopifyRefundsResponse>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error, mutate }
}

export function useShopifyReturns(enabled: boolean, dateRange?: DateRange) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = buildUrl('/api/providers/shopify/returns', shop, dateRange)
  const { data, isLoading, error, mutate } = useSWR(
    enabled ? ['shopify-returns', url] : null,
    () => fetcher<ShopifyReturnsResponse>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error, mutate }
}

export function useShopifyTags(
  enabled: boolean,
  dateRange?: DateRange,
  options?: { attribution?: 'full' | 'fractional'; compareTags?: string[] }
) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')

  // Main data fetch — excludes compareTags so it doesn't refetch when tags change
  const baseParams = new URLSearchParams()
  if (shop) baseParams.set('shop', shop)
  if (dateRange?.startDate) baseParams.set('startDate', dateRange.startDate)
  if (dateRange?.endDate) baseParams.set('endDate', dateRange.endDate)
  if (options?.attribution) baseParams.set('attribution', options.attribution)
  const baseQs = baseParams.toString()
  const baseUrl = `/api/providers/shopify/tags${baseQs ? `?${baseQs}` : ''}`
  const { data, isLoading, error, mutate } = useSWR(
    enabled ? ['shopify-tags', baseUrl] : null,
    () => fetcher<ShopifyTagReportingResponse>(baseUrl),
    swrOptions
  )

  // Separate comparison fetch — only runs when 2+ tags are selected
  const compareParams = new URLSearchParams(baseParams)
  if (options?.compareTags?.length) compareParams.set('compareTags', options.compareTags.join(','))
  const compareQs = compareParams.toString()
  const compareUrl = `/api/providers/shopify/tags${compareQs ? `?${compareQs}` : ''}`
  const hasCompareTags = (options?.compareTags?.length ?? 0) >= 2
  const { data: compareData, isLoading: compareLoading } = useSWR(
    enabled && hasCompareTags ? ['shopify-tags-compare', compareUrl] : null,
    () => fetcher<ShopifyTagReportingResponse>(compareUrl),
    swrOptions
  )

  // Merge comparison data into main data
  const merged = data?.data
    ? {
        ...data.data,
        ...(compareData?.data?.comparison ? { comparison: compareData.data.comparison } : {}),
      }
    : null

  return { data: merged, isLoading, error, mutate, compareLoading }
}

export function useShopifyDisputes(enabled: boolean, dateRange?: DateRange) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = buildUrl('/api/providers/shopify/disputes', shop, dateRange)
  const { data, isLoading, error, mutate } = useSWR(
    enabled ? ['shopify-disputes', url] : null,
    () => fetcher<ShopifyDisputesResponse>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error, mutate }
}

export function useShopifyPayouts(enabled: boolean, dateRange?: DateRange) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = buildUrl('/api/providers/shopify/payouts', shop, dateRange)
  const { data, isLoading, error, mutate } = useSWR(
    enabled ? ['shopify-payouts', url] : null,
    () => fetcher<ShopifyPayoutsResponse>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error, mutate }
}

export function useShopifyFulfillmentOps(
  enabled: boolean,
  dateRange?: DateRange,
  options?: { includeClosed?: boolean }
) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  let url = buildUrl('/api/providers/shopify/fulfillments', shop, dateRange)
  if (options?.includeClosed) {
    const sep = url.includes('?') ? '&' : '?'
    url = `${url}${sep}includeClosed=true`
  }
  const { data, isLoading, error, mutate } = useSWR(
    enabled ? ['shopify-fulfillment-ops', url] : null,
    () => fetcher<ShopifyFulfillmentOpsResponse>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error, mutate }
}

export function useShopifyCollections(enabled: boolean) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = buildUrl('/api/providers/shopify/collections', shop)
  const { data, isLoading, error, mutate } = useSWR(
    enabled ? ['shopify-collections', url] : null,
    () => fetcher<ShopifyCollectionsResponse>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error, mutate }
}

export function useShopifyDraftOrders(enabled: boolean, dateRange?: DateRange) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = buildUrl('/api/providers/shopify/draft-orders', shop, dateRange)
  const { data, isLoading, error, mutate } = useSWR(
    enabled ? ['shopify-draft-orders', url] : null,
    () => fetcher<ShopifyDraftOrdersResponse>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error, mutate }
}

// export function useShopifyMarketing(enabled: boolean) {
//   const searchParams = useSearchParams()
//   const shop = searchParams.get('shop')
//   const url = buildUrl('/api/providers/shopify/marketing', shop)
//   const { data, isLoading, error, mutate } = useSWR(
//     enabled ? ['shopify-marketing', url] : null,
//     () => fetcher<ShopifyMarketingResponse>(url),
//     swrOptions
//   )
//   return { data: data?.data ?? null, isLoading, error, mutate }
// }

export function useShopifyMarketing(
  enabled: boolean,
  dateRange?: DateRange,
  attributionModel?: 'first_click' | 'last_click' | 'last_non_direct'
) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  let url = buildUrl('/api/providers/shopify/marketing', shop, dateRange)
  if (attributionModel && attributionModel !== 'last_click') {
    const sep = url.includes('?') ? '&' : '?'
    url = `${url}${sep}attributionModel=${attributionModel}`
  }
  const { data, isLoading, error, mutate } = useSWR(
    enabled ? ['shopify-marketing', url] : null,
    () => fetcher<ShopifyMarketingAttributionResponse>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error, mutate }
}

export function useShopifyHeatmapSessions(enabled: boolean, dateRange?: DateRange) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = buildUrl('/api/providers/shopify/marketing', shop, dateRange)
  const { data, isLoading, error } = useSWR(
    enabled ? ['shopify-heatmap-sessions', url] : null,
    () => fetcher<ShopifyMarketingAttributionResponse>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error }
}

export function useShopifyCustomerJourneys(enabled: boolean, dateRange?: DateRange) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = buildUrl('/api/providers/shopify/customer-journeys', shop, dateRange)
  const { data, isLoading, error } = useSWR(
    enabled ? ['shopify-customer-journeys', url] : null,
    () => fetcher<any>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error }
}

export function useShopifyAbandonedCheckouts(enabled: boolean, dateRange?: DateRange) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = buildUrl('/api/providers/shopify/abandoned-checkouts', shop, dateRange)
  const { data, isLoading, error, mutate } = useSWR(
    enabled ? ['shopify-abandoned-checkouts', url] : null,
    () => fetcher<ShopifyAbandonedCheckoutsResponse>(url),
    swrOptions
  )
  return { data: data?.data ?? null, isLoading, error, mutate }
}

// ─── Detail hooks (for expandable rows) ─────────────────

export function useShopifyOrderDetail(orderId: string | null) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = orderId
    ? buildUrl(`/api/providers/shopify/orders/${encodeURIComponent(orderId)}`, shop)
    : null
  const { data, isLoading, error } = useSWR(
    url ? ['shopify-order-detail', url] : null,
    () => fetcher<ShopifyOrderDetail>(url!),
    { ...swrOptions, dedupingInterval: 60 * 1000 }
  )
  return { data: data?.data ?? null, isLoading, error }
}

export function useShopifyProductDetail(productId: string | null) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = productId
    ? buildUrl(`/api/providers/shopify/products/${encodeURIComponent(productId)}`, shop)
    : null
  const { data, isLoading, error } = useSWR(
    url ? ['shopify-product-detail', url] : null,
    () => fetcher<ShopifyProductDetail>(url!),
    { ...swrOptions, dedupingInterval: 60 * 1000 }
  )
  return { data: data?.data ?? null, isLoading, error }
}

export function useShopifyCustomerDetail(customerId: string | null) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = customerId
    ? buildUrl(`/api/providers/shopify/customers/${encodeURIComponent(customerId)}`, shop)
    : null
  const { data, isLoading, error } = useSWR(
    url ? ['shopify-customer-detail', url] : null,
    () => fetcher<ShopifyCustomerDetail>(url!),
    { ...swrOptions, dedupingInterval: 60 * 1000 }
  )
  return { data: data?.data ?? null, isLoading, error }
}

export function useShopifyDisputeDetail(disputeId: string | null) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = disputeId
    ? buildUrl(`/api/providers/shopify/disputes/${encodeURIComponent(disputeId)}`, shop)
    : null
  const { data, isLoading, error } = useSWR(
    url ? ['shopify-dispute-detail', url] : null,
    () => fetcher<ShopifyDisputeDetail>(url!),
    { ...swrOptions, dedupingInterval: 60 * 1000 }
  )
  return { data: data?.data ?? null, isLoading, error }
}

export function useShopifyDraftOrderDetail(draftOrderId: string | null) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = draftOrderId
    ? buildUrl(`/api/providers/shopify/draft-orders/${encodeURIComponent(draftOrderId)}`, shop)
    : null
  const { data, isLoading, error } = useSWR(
    url ? ['shopify-draft-order-detail', url] : null,
    () => fetcher<ShopifyDraftOrderDetail>(url!),
    { ...swrOptions, dedupingInterval: 60 * 1000 }
  )
  return { data: data?.data ?? null, isLoading, error }
}

export function useShopifyRefundDetail(orderId: string | null) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = orderId
    ? buildUrl(`/api/providers/shopify/refunds/${encodeURIComponent(orderId)}`, shop)
    : null
  const { data, isLoading, error } = useSWR(
    url ? ['shopify-refund-detail', url] : null,
    () => fetcher<ShopifyRefundDetailOrder>(url!),
    { ...swrOptions, dedupingInterval: 60 * 1000 }
  )
  return { data: data?.data ?? null, isLoading, error }
}

export function useShopifyCollectionDetail(collectionId: string | null) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = collectionId
    ? buildUrl(`/api/providers/shopify/collections/${encodeURIComponent(collectionId)}`, shop)
    : null
  const { data, isLoading, error } = useSWR(
    url ? ['shopify-collection-detail', url] : null,
    () => fetcher<ShopifyCollectionDetail>(url!),
    { ...swrOptions, dedupingInterval: 60 * 1000 }
  )
  return { data: data?.data ?? null, isLoading, error }
}

export function useShopifyInventoryItemDetail(inventoryItemId: string | null) {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const url = inventoryItemId
    ? buildUrl(`/api/providers/shopify/inventory/${encodeURIComponent(inventoryItemId)}`, shop)
    : null
  const { data, isLoading, error } = useSWR(
    url ? ['shopify-inventory-detail', url] : null,
    () => fetcher<ShopifyInventoryItemDetail>(url!),
    { ...swrOptions, dedupingInterval: 60 * 1000 }
  )
  return { data: data?.data ?? null, isLoading, error }
}
