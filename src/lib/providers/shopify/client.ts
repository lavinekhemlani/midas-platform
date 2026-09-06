// src/lib/providers/shopify/client.ts
// Shopify Admin API client for REST and GraphQL API calls

import type {
  ShopifyShop,
  ShopifyOrder,
  ShopifyProduct,
  ShopifyCustomer,
  ShopifyLocation,
  ShopifyInventoryLevel,
  ShopifyInventoryItem,
  ShopifyBalance,
  ShopifyPayout,
  ShopifyQLTableData,
  ShopifyGraphQLOrderNode,
  ShopifyGraphQLFulfillment,
  ShopifyRiskAssessment,
  ShopifyGraphQLCustomerNode,
  ShopifyGraphQLInventoryItem,
} from './types'

export interface ShopifyClientConfig {
  shopDomain: string
  accessToken: string
  apiVersion?: string
}

export interface GraphQLResponse<T = any> {
  data: T
  errors?: Array<{
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: string[]
  }>
  extensions?: {
    cost: {
      requestedQueryCost: number
      actualQueryCost: number
      throttleStatus: Record<string, unknown>
    }
  }
}

export class ShopifyClient {
  private shopDomain: string
  private accessToken: string
  private apiVersion: string

  constructor(config: ShopifyClientConfig) {
    this.shopDomain = config.shopDomain
    this.accessToken = config.accessToken
    this.apiVersion = config.apiVersion || '2026-01'
  }

  private get baseUrl() {
    return `https://${this.shopDomain}/admin/api/${this.apiVersion}`
  }

  private async request<T = any>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`)
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    }

    const response = await this.fetchWithRetry(url.toString())

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Shopify API error ${response.status}: ${errorText}`)
    }

    return response.json()
  }

  private async fetchWithRetry(url: string): Promise<Response> {
    const maxRetries = 3
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json',
        },
      })

      if (response.status === 429) {
        const retryAfter = parseFloat(response.headers.get('Retry-After') || '1')
        const delay = Math.max(retryAfter, 1) * 1000
        console.warn(
          `Shopify rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      return response
    }

    throw new Error('Shopify API rate limit exceeded after retries')
  }

  private async paginatedRequest<T = any>(
    endpoint: string,
    resourceKey: string,
    params?: Record<string, string>,
    limit = 250
  ): Promise<T[]> {
    const allItems: T[] = []
    let url: string | null = `${this.baseUrl}${endpoint}`
    const queryParams = { ...params, limit: String(limit) }

    // First request
    const firstUrl = new URL(url)
    Object.entries(queryParams).forEach(([k, v]) => firstUrl.searchParams.set(k, v))

    let response = await this.fetchWithRetry(firstUrl.toString())

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Shopify API error ${response.status}: ${errorText}`)
    }

    let data = await response.json()
    allItems.push(...(data[resourceKey] || []))

    // Follow pagination via Link header
    let linkHeader = response.headers.get('Link')
    while (linkHeader) {
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
      if (!nextMatch) break

      response = await this.fetchWithRetry(nextMatch[1])

      if (!response.ok) break

      data = await response.json()
      allItems.push(...(data[resourceKey] || []))
      linkHeader = response.headers.get('Link')
    }

    return allItems
  }

  // --- Orders ---

  async getOrders(params?: Record<string, string>): Promise<ShopifyOrder[]> {
    return this.paginatedRequest<ShopifyOrder>('/orders.json', 'orders', {
      status: 'any',
      ...params,
    })
  }

  async getOrdersCount(params?: Record<string, string>): Promise<number> {
    const data = await this.request<{ count: number }>('/orders/count.json', {
      status: 'any',
      ...params,
    })
    return data.count
  }

  // --- Products ---

  async getProducts(params?: Record<string, string>): Promise<ShopifyProduct[]> {
    return this.paginatedRequest<ShopifyProduct>('/products.json', 'products', params)
  }

  async getProductsCount(): Promise<number> {
    const data = await this.request<{ count: number }>('/products/count.json')
    return data.count
  }

  // --- Customers ---

  async getCustomers(params?: Record<string, string>): Promise<ShopifyCustomer[]> {
    return this.paginatedRequest<ShopifyCustomer>('/customers.json', 'customers', params)
  }

  async getCustomersCount(params?: Record<string, string>): Promise<number> {
    const data = await this.request<{ count: number }>('/customers/count.json', params)
    return data.count
  }

  // --- Inventory ---

  async getLocations(): Promise<ShopifyLocation[]> {
    const data = await this.request<{ locations: ShopifyLocation[] }>('/locations.json')
    return data.locations
  }

  async getInventoryLevels(
    locationId: string,
    params?: Record<string, string>
  ): Promise<ShopifyInventoryLevel[]> {
    return this.paginatedRequest<ShopifyInventoryLevel>(
      '/inventory_levels.json',
      'inventory_levels',
      {
        location_ids: locationId,
        ...params,
      }
    )
  }

  async getInventoryItems(ids: string[]): Promise<ShopifyInventoryItem[]> {
    const data = await this.request<{ inventory_items: ShopifyInventoryItem[] }>(
      '/inventory_items.json',
      {
        ids: ids.join(','),
      }
    )
    return data.inventory_items
  }

  // --- Shop info ---

  async getShop(): Promise<ShopifyShop> {
    const data = await this.request<{ shop: ShopifyShop }>('/shop.json')
    return data.shop
  }

  // --- GraphQL Admin API ---

  async graphql<T = any>(
    query: string,
    variables?: Record<string, any>
  ): Promise<GraphQLResponse<T>> {
    const url = `${this.baseUrl}/graphql.json`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Shopify GraphQL error ${response.status}: ${errorText}`)
    }

    const result: GraphQLResponse<T> = await response.json()
    if (result.errors?.length) {
      const messages = result.errors.map((e) => e.message).join('; ')
      throw new Error(`Shopify GraphQL query error: ${messages}`)
    }

    return result
  }

  // --- GraphQL: Order Detail ---

  async getOrderDetail(orderId: string): Promise<any> {
    const gql = `
      query orderDetail($id: ID!) {
        order(id: $id) {
          id name createdAt note tags returnStatus
          customer {
            id displayName email phone numberOfOrders
            amountSpent { amount currencyCode }
          }
          billingAddress { formatted }
          shippingAddress { formatted }
          lineItems(first: 50) {
            edges { node {
              id title quantity fulfillmentStatus
              variant {
                id title sku price
                image { url altText }
              }
              originalTotalSet { shopMoney { amount currencyCode } }
              discountAllocations {
                allocatedAmountSet { shopMoney { amount currencyCode } }
              }
              taxLines { title rate priceSet { shopMoney { amount currencyCode } } }
            }}
          }
          transactions(first: 20) {
            id kind status
            amountSet { shopMoney { amount currencyCode } }
            gateway formattedGateway createdAt errorCode
          }
          fulfillments {
            id status displayStatus createdAt deliveredAt estimatedDeliveryAt
            trackingInfo { number url company }
            fulfillmentLineItems(first: 20) {
              edges { node { id quantity lineItem { title } } }
            }
          }
          refunds(first: 10) {
            id createdAt note
            totalRefundedSet { shopMoney { amount currencyCode } }
            refundLineItems(first: 20) {
              edges { node {
                quantity restockType
                lineItem { title sku }
                subtotalSet { shopMoney { amount currencyCode } }
              }}
            }
          }
          risks {
            level
            message
          }
          events(first: 20, sortKey: CREATED_AT, reverse: true) {
            edges { node { message createdAt } }
          }
          subtotalPriceSet { shopMoney { amount currencyCode } }
          totalTaxSet { shopMoney { amount currencyCode } }
          totalDiscountsSet { shopMoney { amount currencyCode } }
          totalShippingPriceSet { shopMoney { amount currencyCode } }
          totalPriceSet { shopMoney { amount currencyCode } }
          totalRefundedSet { shopMoney { amount currencyCode } }
          currentTotalPriceSet { shopMoney { amount currencyCode } }
        }
      }
    `
    const result = await this.graphql(gql, { id: orderId })
    return result.data.order
  }

  // --- REST: Dispute Detail + Evidence ---

  async getDisputeDetail(disputeId: number): Promise<any> {
    const dispute = await this.request<{ dispute: any }>(
      `/shopify_payments/disputes/${disputeId}.json`
    )
    let evidence: any = null
    try {
      const ev = await this.request<{ dispute_evidence: any }>(
        `/shopify_payments/disputes/${disputeId}/dispute_evidences.json`
      )
      evidence = ev.dispute_evidence
    } catch {
      // Evidence may not exist or be accessible
    }

    // Also fetch the linked order if we have an order_id
    let order: any = null
    if (dispute.dispute?.order_id) {
      try {
        const o = await this.request<{ order: any }>(
          `/orders/${dispute.dispute.order_id}.json?fields=id,name,created_at,total_price,currency,financial_status,fulfillment_status,customer,line_items,shipping_address,billing_address`
        )
        order = o.order
      } catch {
        // Order may not be accessible
      }
    }

    return { ...dispute.dispute, evidence, order }
  }

  // --- GraphQL: Refund Detail (via parent order) ---

  async getRefundDetail(orderId: string): Promise<any> {
    const gql = `
      query refundDetail($id: ID!) {
        order(id: $id) {
          id name createdAt
          customer {
            id displayName email phone
          }
          totalPriceSet { shopMoney { amount currencyCode } }
          displayFinancialStatus
          displayFulfillmentStatus
          refunds(first: 20) {
            id createdAt note
            totalRefundedSet { shopMoney { amount currencyCode } }
            refundLineItems(first: 50) {
              edges { node {
                quantity restockType restocked
                location { id name }
                lineItem {
                  id title sku quantity
                  image { url altText }
                  variant {
                    id title sku
                    image { url altText }
                    price
                  }
                }
                priceSet { shopMoney { amount currencyCode } }
                subtotalSet { shopMoney { amount currencyCode } }
                totalTaxSet { shopMoney { amount currencyCode } }
              }}
            }
            transactions(first: 10) {
              edges { node {
                id kind status processedAt
                amountSet { shopMoney { amount currencyCode } }
                gateway formattedGateway
              }}
            }
            return {
              id status
              returnLineItems(first: 20) {
                edges { node {
                  id quantity returnReason returnReasonNote customerNote
                }}
              }
            }
          }
        }
      }
    `
    const result = await this.graphql(gql, { id: orderId })
    return result.data.order
  }

  // --- GraphQL: Collection Detail ---

  async getCollectionDetail(collectionId: string): Promise<any> {
    const gql = `
      query collectionDetail($id: ID!) {
        collection(id: $id) {
          id title handle descriptionHtml
          sortOrder updatedAt
          templateSuffix
          image { url altText width height }
          seo { title description }
          productsCount { count }
          ruleSet {
            appliedDisjunctively
            rules {
              column
              relation
              condition
            }
          }
          products(first: 20, sortKey: BEST_SELLING) {
            edges { node {
              id title handle status vendor productType
              totalInventory
              priceRangeV2 {
                minVariantPrice { amount currencyCode }
                maxVariantPrice { amount currencyCode }
              }
              featuredImage { url altText }
              variants(first: 3) {
                edges { node {
                  id title price compareAtPrice
                }}
              }
            }}
          }
          metafields(first: 10) {
            edges { node { namespace key value type } }
          }
        }
      }
    `
    const result = await this.graphql(gql, { id: collectionId })
    return result.data.collection
  }

  // --- GraphQL: Draft Order Detail ---

  // --- GraphQL: Inventory Item Detail ---

  async getInventoryItemDetail(inventoryItemId: string): Promise<any> {
    const gql = `
      query inventoryItemDetail($id: ID!) {
        inventoryItem(id: $id) {
          id sku tracked requiresShipping
          createdAt updatedAt
          unitCost { amount currencyCode }
          countryCodeOfOrigin
          provinceCodeOfOrigin
          harmonizedSystemCode
          countryHarmonizedSystemCodes(first: 10) {
            edges { node { harmonizedSystemCode countryCode } }
          }
          measurement { weight { unit value } }
          variant {
            id title sku barcode price compareAtPrice
            image { url altText }
            selectedOptions { name value }
            product {
              id title status vendor productType handle
              featuredImage { url altText }
              onlineStoreUrl
            }
          }
          inventoryLevels(first: 20) {
            edges { node {
              id
              location { id name isActive }
              quantities(names: ["available", "on_hand", "committed", "incoming", "reserved", "damaged", "quality_control", "safety_stock"]) {
                name quantity updatedAt
              }
            }}
          }
        }
      }
    `
    const result = await this.graphql(gql, { id: inventoryItemId })
    return result.data.inventoryItem
  }

  async getDraftOrderDetail(draftOrderId: string): Promise<any> {
    const gql = `
      query draftOrderDetail($id: ID!) {
        draftOrder(id: $id) {
          id name status createdAt updatedAt completedAt
          note2 tags email phone
          invoiceUrl invoiceSentAt
          taxesIncluded taxExempt
          currencyCode
          ready
          visibleToCustomer
          totalQuantityOfLineItems
          poNumber
          purchasingEntity {
            ... on PurchasingCompany {
              company { id name }
              contact { id }
              location { id name }
            }
          }
          paymentTerms {
            paymentTermsName
            paymentTermsType
            dueInDays
            overdue
            paymentSchedules(first: 1) {
              edges {
                node { issuedAt dueAt completedAt }
              }
            }
          }
          subtotalPriceSet { shopMoney { amount currencyCode } }
          totalPriceSet { shopMoney { amount currencyCode } }
          totalTaxSet { shopMoney { amount currencyCode } }
          totalShippingPriceSet { shopMoney { amount currencyCode } }
          totalDiscountsSet { shopMoney { amount currencyCode } }
          customer {
            id displayName email phone
            numberOfOrders
            amountSpent { amount currencyCode }
          }
          billingAddress {
            address1 address2 city company
            country province zip phone
            formatted
          }
          shippingAddress {
            address1 address2 city company
            country province zip phone
            formatted
          }
          shippingLine {
            title custom
            originalPriceSet { shopMoney { amount currencyCode } }
          }
          appliedDiscount {
            title description value valueType
            amountSet { shopMoney { amount currencyCode } }
          }
          lineItems(first: 50) {
            edges { node {
              id title quantity sku variantTitle vendor
              requiresShipping taxable
              originalUnitPriceSet { shopMoney { amount currencyCode } }
              discountedUnitPriceSet { shopMoney { amount currencyCode } }
              totalDiscountSet { shopMoney { amount currencyCode } }
              image { url altText }
              variant {
                id title sku
                image { url altText }
                product { id title handle }
              }
              appliedDiscount {
                title description value valueType
                amountSet { shopMoney { amount currencyCode } }
              }
              taxLines {
                title rate
                priceSet { shopMoney { amount currencyCode } }
              }
            }}
          }
          taxLines {
            title rate
            priceSet { shopMoney { amount currencyCode } }
          }
          order { id name }
          metafields(first: 10) {
            edges { node { namespace key value type } }
          }
        }
      }
    `
    const result = await this.graphql(gql, { id: draftOrderId })
    return result.data.draftOrder
  }

  // --- GraphQL: Product Detail ---

  async getProductDetail(productId: string): Promise<any> {
    const gql = `
      query productDetail($id: ID!) {
        product(id: $id) {
          id title descriptionHtml handle status vendor productType tags
          createdAt updatedAt publishedAt onlineStoreUrl
          totalInventory tracksInventory hasOnlyDefaultVariant
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
          featuredMedia {
            preview { image { url altText width height } }
          }
          seo { title description }
          collections(first: 10) {
            edges { node { id title handle } }
          }
          variants(first: 100) {
            edges { node {
              id title sku barcode price compareAtPrice
              inventoryQuantity
              selectedOptions { name value }
              image { url altText }
              inventoryItem {
                id
                unitCost { amount currencyCode }
                tracked
                countryCodeOfOrigin
                harmonizedSystemCode
                inventoryLevels(first: 10) {
                  edges { node {
                    location { id name }
                    quantities(names: ["available", "on_hand", "committed", "incoming"]) {
                      name quantity
                    }
                  }}
                }
              }
            }}
          }
          media(first: 20) {
            edges { node {
              mediaContentType
              preview { image { url altText width height } }
            }}
          }
          metafields(first: 20) {
            edges { node { namespace key value type } }
          }
        }
      }
    `
    const result = await this.graphql(gql, { id: productId })
    return result.data.product
  }

  // --- GraphQL: Customer Detail ---

  async getCustomerDetail(customerId: string): Promise<any> {
    // Base fields available to any install with read_customers + protected
    // customer data access. Mirrors the fallback strategy in
    // getCustomersGraphQL — see that method for the rationale.
    const baseFields = `
      id displayName firstName lastName email phone
      locale note tags state verifiedEmail
      createdAt updatedAt
      numberOfOrders
      amountSpent { amount currencyCode }
      lifetimeDuration
      image { url altText }
      emailMarketingConsent {
        marketingState marketingOptInLevel consentUpdatedAt
      }
      smsMarketingConsent {
        marketingState marketingOptInLevel consentUpdatedAt
      }
      defaultAddress {
        address1 address2 city company
        country countryCodeV2 province provinceCode zip phone
        formatted
      }
      addresses(first: 10) {
        address1 address2 city company
        country countryCodeV2 province provinceCode zip phone
        formatted
      }
      orders(first: 10, sortKey: CREATED_AT, reverse: true) {
        edges { node {
          id name createdAt
          displayFinancialStatus displayFulfillmentStatus
          totalPriceSet { shopMoney { amount currencyCode } }
        }}
      }
      lastOrder {
        id name createdAt
        totalPriceSet { shopMoney { amount currencyCode } }
      }
      taxExempt
      metafields(first: 10) {
        edges { node { namespace key value type } }
      }
    `
    const enrichedGql = `
      query customerDetail($id: ID!) {
        customer(id: $id) {
          ${baseFields}
          statistics {
            predictedSpendTier
            rfmGroup
          }
          storeCreditAccounts(first: 10) {
            edges {
              node {
                id
                balance { amount currencyCode }
              }
            }
          }
          events(first: 30, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                __typename
                id
                action
                message
                createdAt
                appTitle
                attributeToApp
                attributeToUser
                criticalAlert
              }
            }
          }
        }
      }
    `
    try {
      const result = await this.graphql(enrichedGql, { id: customerId })
      return result.data.customer
    } catch (error) {
      const msg = error instanceof Error ? error.message : ''
      const isFieldOrScopeError =
        /access denied/i.test(msg) ||
        /doesn't exist on type/i.test(msg) ||
        /not approved to access/i.test(msg) ||
        /storeCreditAccounts/i.test(msg) ||
        /statistics/i.test(msg) ||
        /events/i.test(msg) ||
        /read_customer_events/i.test(msg)
      if (!isFieldOrScopeError) throw error
      console.warn(
        'Shopify enriched customer detail query failed (likely missing scope), falling back to base fields:',
        msg
      )
      const baseGql = `
        query customerDetail($id: ID!) {
          customer(id: $id) {
            ${baseFields}
          }
        }
      `
      const result = await this.graphql(baseGql, { id: customerId })
      return result.data.customer
    }
  }

  // --- ShopifyQL Analytics ---

  async shopifyqlQuery(query: string): Promise<ShopifyQLTableData> {
    const gql = `query { shopifyqlQuery(query: ${JSON.stringify(query)}) { tableData { columns { name dataType displayName } rows } parseErrors } }`
    const result = await this.graphql<{
      shopifyqlQuery: { tableData: ShopifyQLTableData; parseErrors: string[] }
    }>(gql)
    const ql = result.data.shopifyqlQuery
    if (ql.parseErrors?.length) {
      throw new Error(`ShopifyQL parse error: ${JSON.stringify(ql.parseErrors)}`)
    }
    const { columns, rows } = ql.tableData
    // API 2025-10+ returns rows as objects {column_name: value} instead of arrays.
    // Normalize to arrays so all existing colMap-based parsing code works.
    const normalizedRows = rows.map((row: any) => {
      if (Array.isArray(row)) return row
      return columns.map((col) => row[col.name] ?? null)
    })
    return { columns, rows: normalizedRows }
  }

  // --- Shopify Payments ---

  async getPayouts(params?: Record<string, string>): Promise<ShopifyPayout[]> {
    const data = await this.request<{ payouts: ShopifyPayout[] }>(
      '/shopify_payments/payouts.json',
      params
    )
    return data.payouts
  }

  async getBalance(): Promise<ShopifyBalance[]> {
    const data = await this.request<{ balance: ShopifyBalance[] }>('/shopify_payments/balance.json')
    return data.balance
  }

  async getBalanceTransactions(params?: Record<string, string>) {
    return this.paginatedRequest(
      '/shopify_payments/balance/transactions.json',
      'transactions',
      params
    )
  }

  async getDisputes(params?: Record<string, string>) {
    const data = await this.request<{ disputes: Record<string, unknown>[] }>(
      '/shopify_payments/disputes.json',
      params
    )
    return data.disputes
  }

  // --- GraphQL: Orders with rich financial fields ---

  async getOrdersGraphQL(first = 50, query?: string): Promise<ShopifyGraphQLOrderNode[]> {
    const gql = `
      query($first: Int!, $query: String) {
        orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
              displayFinancialStatus
              displayFulfillmentStatus
              totalPriceSet { shopMoney { amount currencyCode } }
              subtotalPriceSet { shopMoney { amount currencyCode } }
              totalTaxSet { shopMoney { amount currencyCode } }
              totalDiscountsSet { shopMoney { amount currencyCode } }
              totalShippingPriceSet { shopMoney { amount currencyCode } }
              totalRefundedSet { shopMoney { amount currencyCode } }
              netPaymentSet { shopMoney { amount currencyCode } }
              currentTotalPriceSet { shopMoney { amount currencyCode } }
              totalTipReceivedSet { shopMoney { amount currencyCode } }
              currentTotalDutiesSet { shopMoney { amount currencyCode } }
              totalOutstandingSet { shopMoney { amount currencyCode } }
              paymentGatewayNames
              edited
              unpaid
              poNumber
              purchasingEntity { __typename }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `
    const result = await this.graphql<{
      orders: {
        edges: Array<{ node: ShopifyGraphQLOrderNode }>
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
      }
    }>(gql, { first, query })
    return result.data.orders.edges.map((e) => e.node)
  }

  // --- GraphQL: Orders with fulfillment and risk data ---

  async getOrdersWithFulfillments(
    first = 50,
    query?: string
  ): Promise<
    Array<
      ShopifyGraphQLOrderNode & {
        fulfillments: ShopifyGraphQLFulfillment[]
        riskLevel: string | null
      }
    >
  > {
    const gql = `
      query($first: Int!, $query: String) {
        orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
              displayFinancialStatus
              displayFulfillmentStatus
              totalPriceSet { shopMoney { amount currencyCode } }
              subtotalPriceSet { shopMoney { amount currencyCode } }
              totalTaxSet { shopMoney { amount currencyCode } }
              totalDiscountsSet { shopMoney { amount currencyCode } }
              totalShippingPriceSet { shopMoney { amount currencyCode } }
              totalRefundedSet { shopMoney { amount currencyCode } }
              netPaymentSet { shopMoney { amount currencyCode } }
              currentTotalPriceSet { shopMoney { amount currencyCode } }
              totalTipReceivedSet { shopMoney { amount currencyCode } }
              currentTotalDutiesSet { shopMoney { amount currencyCode } }
              totalOutstandingSet { shopMoney { amount currencyCode } }
              paymentGatewayNames
              edited
              unpaid
              poNumber
              purchasingEntity { __typename }
              cancelReason
              cancelledAt
              channelInformation {
                channelDefinition {
                  handle
                  channelName
                  subChannelName
                }
              }
              app { name }
              publication { name }
              paymentTerms {
                dueInDays
                paymentTermsName
                paymentTermsType
              }
              customerJourneySummary {
                customerOrderIndex
              }
              retailLocation { name }
              fulfillments {
                id
                status
                createdAt
                updatedAt
                deliveredAt
                estimatedDeliveryAt
                displayStatus
                trackingInfo { number url company }
                fulfillmentLineItems(first: 1) {
                  edges { node { originalTotalSet { shopMoney { amount } } } }
                }
                events(first: 5) {
                  edges { node { status happenedAt city province country message } }
                }
              }
              fulfillmentOrders(first: 5) {
                edges {
                  node {
                    assignedLocation { name countryCode }
                  }
                }
              }
              risk { recommendation }
            }
          }
        }
      }
    `
    const result = await this.graphql<{
      orders: {
        edges: Array<{
          node: ShopifyGraphQLOrderNode & {
            fulfillments: Array<
              Omit<ShopifyGraphQLFulfillment, 'events'> & {
                events: { edges: Array<{ node: ShopifyGraphQLFulfillment['events'][0] }> }
              }
            >
            risk: { recommendation: string } | null
          }
        }>
      }
    }>(gql, { first, query: query || null })
    return result.data.orders.edges.map((e) => ({
      ...e.node,
      fulfillments: e.node.fulfillments.map((f) => ({
        ...f,
        events: f.events.edges.map((ev) => ev.node),
      })),
      fulfillmentLocations:
        (e.node as any).fulfillmentOrders?.edges
          ?.map((fo: any) => fo.node?.assignedLocation)
          .filter(Boolean) ?? [],
      riskLevel: e.node.risk?.recommendation || null,
      customerOrderIndex: (e.node as any).customerJourneySummary?.customerOrderIndex ?? null,
    }))
  }

  // --- GraphQL: Customers with LTV and marketing consent ---

  async getCustomersGraphQL(first = 100): Promise<ShopifyGraphQLCustomerNode[]> {
    // Base fields that every install with read_customers can fetch.
    const baseFields = `
      id
      displayName
      email
      phone
      numberOfOrders
      amountSpent { amount currencyCode }
      createdAt
      updatedAt
      tags
      note
      emailMarketingConsent {
        marketingState
        marketingOptInLevel
        consentUpdatedAt
      }
      smsMarketingConsent {
        marketingState
        marketingOptInLevel
        consentUpdatedAt
      }
      lastOrder {
        id
        createdAt
        totalPriceSet { shopMoney { amount currencyCode } }
      }
      defaultAddress {
        city
        provinceCode
        countryCode
      }
    `
    // Enrichment fields that require additional scopes:
    //  - statistics: requires read_orders
    //  - storeCreditAccounts: requires read_store_credit_account_transactions
    // If the merchant install lacks either, the whole query errors, so we
    // attempt the enriched query first and fall back to base on failure.
    const enrichedGql = `
      query($first: Int!) {
        customers(first: $first, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              ${baseFields}
              statistics {
                predictedSpendTier
                rfmGroup
              }
              storeCreditAccounts(first: 5) {
                edges {
                  node {
                    id
                    balance { amount currencyCode }
                  }
                }
              }
            }
          }
        }
      }
    `
    try {
      const result = await this.graphql<{
        customers: { edges: Array<{ node: ShopifyGraphQLCustomerNode }> }
      }>(enrichedGql, { first })
      return result.data.customers.edges.map((e) => e.node)
    } catch (error) {
      const msg = error instanceof Error ? error.message : ''
      // Detect missing-scope / unknown-field errors and fall back to base query.
      // Shopify reports these as "access denied", "Access denied", or "Field 'X' doesn't exist".
      const isFieldOrScopeError =
        /access denied/i.test(msg) ||
        /doesn't exist on type/i.test(msg) ||
        /not approved to access/i.test(msg) ||
        /storeCreditAccounts/i.test(msg) ||
        /statistics/i.test(msg)
      if (!isFieldOrScopeError) throw error
      console.warn(
        'Shopify enriched customer query failed (likely missing scope), falling back to base fields:',
        msg
      )
      const baseGql = `
        query($first: Int!) {
          customers(first: $first, sortKey: UPDATED_AT, reverse: true) {
            edges {
              node {
                ${baseFields}
              }
            }
          }
        }
      `
      const result = await this.graphql<{
        customers: { edges: Array<{ node: ShopifyGraphQLCustomerNode }> }
      }>(baseGql, { first })
      return result.data.customers.edges.map((e) => e.node)
    }
  }

  // --- Collections ---

  async getSmartCollections(params?: Record<string, string>): Promise<any[]> {
    return this.paginatedRequest('/smart_collections.json', 'smart_collections', params)
  }

  async getCustomCollections(params?: Record<string, string>): Promise<any[]> {
    return this.paginatedRequest('/custom_collections.json', 'custom_collections', params)
  }

  async getCollectionProducts(collectionId: number): Promise<number> {
    const data = await this.request<{ count: number }>(`/products/count.json`, {
      collection_id: String(collectionId),
    })
    return data.count
  }

  // --- Draft Orders ---

  async getDraftOrders(params?: Record<string, string>): Promise<any[]> {
    return this.paginatedRequest('/draft_orders.json', 'draft_orders', params)
  }

  async getDraftOrdersCount(): Promise<number> {
    const data = await this.request<{ count: number }>('/draft_orders/count.json')
    return data.count
  }

  async getDraftOrdersGraphQL(
    options: { first?: number; query?: string; after?: string } = {}
  ): Promise<{ nodes: any[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }> {
    const gql = `
      query draftOrders($first: Int!, $query: String, $after: String) {
        draftOrders(first: $first, query: $query, after: $after, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              id name status createdAt updatedAt completedAt
              note2 tags email phone
              invoiceUrl invoiceSentAt
              currencyCode
              ready
              visibleToCustomer
              totalQuantityOfLineItems
              poNumber
              purchasingEntity {
                ... on PurchasingCompany {
                  company { id name }
                  contact { id }
                  location { id name }
                }
              }
              paymentTerms {
                paymentTermsName
                paymentTermsType
                dueInDays
                overdue
                paymentSchedules(first: 1) {
                  edges {
                    node {
                      issuedAt
                      dueAt
                      completedAt
                    }
                  }
                }
              }
              subtotalPriceSet { shopMoney { amount currencyCode } }
              totalPriceSet { shopMoney { amount currencyCode } }
              totalTaxSet { shopMoney { amount currencyCode } }
              totalShippingPriceSet { shopMoney { amount currencyCode } }
              totalDiscountsSet { shopMoney { amount currencyCode } }
              customer {
                id displayName email phone
                numberOfOrders
                amountSpent { amount currencyCode }
              }
              lineItems(first: 10) {
                edges {
                  node {
                    id title quantity sku variantTitle vendor
                    originalUnitPriceSet { shopMoney { amount currencyCode } }
                    image { url altText }
                  }
                }
              }
              order { id name }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `
    const variables = {
      first: options.first ?? 25,
      query: options.query ?? null,
      after: options.after ?? null,
    }
    const result = await this.graphql<{ draftOrders: any }>(gql, variables)
    const data = result.data.draftOrders
    return {
      nodes: (data.edges || []).map((e: any) => e.node),
      pageInfo: data.pageInfo || { hasNextPage: false, endCursor: null },
    }
  }

  // --- Marketing Events (REST) ---

  async getMarketingEvents(params?: Record<string, string>): Promise<any[]> {
    return this.paginatedRequest('/marketing_events.json', 'marketing_events', params)
  }

  // --- Customer Journey (GraphQL) ---

  async getCustomerJourneys(maxOrders = 250, query?: string): Promise<any[]> {
    const gql = `
      query($first: Int!, $after: String, $query: String) {
        orders(first: $first, sortKey: CREATED_AT, reverse: true, after: $after, query: $query) {
          edges {
            cursor
            node {
              id
              name
              createdAt
              totalPriceSet { shopMoney { amount currencyCode } }
              customerJourneySummary {
                customerOrderIndex
                daysToConversion
                firstVisit {
                  landingPage
                  referralCode
                  referralInfoHtml
                  referrerUrl
                  source
                  sourceType
                  utmParameters { source medium campaign content term }
                }
                lastVisit {
                  landingPage
                  referralCode
                  referralInfoHtml
                  referrerUrl
                  source
                  sourceType
                  utmParameters { source medium campaign content term }
                }
                momentsCount { count precision }
                ready
              }
            }
          }
          pageInfo { hasNextPage }
        }
      }
    `
    const allOrders: any[] = []
    let after: string | null = null
    const pageSize = Math.min(maxOrders, 250)

    while (allOrders.length < maxOrders) {
      const result = await this.graphql<{
        orders: { edges: Array<{ cursor: string; node: any }>; pageInfo: { hasNextPage: boolean } }
      }>(gql, { first: pageSize, after, query: query || null })

      const edges = result.data.orders.edges
      if (edges.length === 0) break

      allOrders.push(...edges.map((e) => e.node))
      after = edges[edges.length - 1].cursor

      if (!result.data.orders.pageInfo.hasNextPage) break
    }

    return allOrders.slice(0, maxOrders)
  }

  // --- Marketing Activities (GraphQL) ---

  async getMarketingActivities(first = 100): Promise<any[]> {
    const gql = `
      query($first: Int!) {
        marketingActivities(first: $first, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              title
              status
              tactic
              marketingChannelType
              adSpend { amount currencyCode }
              budget {
                budgetType
              }
              createdAt
              updatedAt
              sourceAndMedium
              utmParameters { source medium campaign }
              marketingEvent {
                id
                startedAt
                endedAt
                remoteId
              }
              app { title }
            }
          }
        }
      }
    `
    const result = await this.graphql<{
      marketingActivities: { edges: Array<{ node: any }> }
    }>(gql, { first })
    return result.data.marketingActivities.edges.map((e) => e.node)
  }

  // --- Abandoned Checkouts ---

  async getAbandonedCheckouts(params?: Record<string, string>): Promise<any[]> {
    return this.paginatedRequest('/checkouts.json', 'checkouts', params)
  }

  async getAbandonedCheckoutsCount(params?: Record<string, string>): Promise<number> {
    const data = await this.request<{ count: number }>('/checkouts/count.json', params)
    return data.count
  }

  // --- GraphQL: Inventory with cost and quantity states ---

  async getInventoryItemsGraphQL(first = 100): Promise<ShopifyGraphQLInventoryItem[]> {
    const gql = `
      query($first: Int!) {
        inventoryItems(first: $first) {
          edges {
            node {
              id
              sku
              tracked
              unitCost { amount currencyCode }
              variant {
                id
                title
                price
                product { id title status }
              }
              inventoryLevels(first: 10) {
                edges {
                  node {
                    id
                    location { id name }
                    quantities(names: ["available", "on_hand", "committed", "incoming"]) {
                      name
                      quantity
                      updatedAt
                    }
                  }
                }
              }
            }
          }
        }
      }
    `
    const result = await this.graphql<{
      inventoryItems: { edges: Array<{ node: ShopifyGraphQLInventoryItem }> }
    }>(gql, { first })
    return result.data.inventoryItems.edges.map((e) => e.node)
  }

  // --- GraphQL: Fulfillment Orders ---

  async getFulfillmentOrders(
    options: {
      first?: number
      query?: string
      after?: string
      includeClosed?: boolean
    } = {}
  ): Promise<{ nodes: any[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }> {
    const gql = `
      query fulfillmentOrders($first: Int!, $query: String, $after: String, $includeClosed: Boolean) {
        fulfillmentOrders(
          first: $first
          query: $query
          after: $after
          includeClosed: $includeClosed
          sortKey: UPDATED_AT
          reverse: true
        ) {
          edges {
            node {
              id
              status
              requestStatus
              createdAt
              updatedAt
              fulfillAt
              fulfillBy
              orderName
              assignedLocation {
                name
                city
                province
                countryCode
                location { id name }
              }
              destination {
                firstName
                lastName
                company
                city
                province
                countryCode
              }
              deliveryMethod {
                methodType
              }
              fulfillmentHolds {
                reason
                reasonNotes
                displayReason
              }
              lineItems(first: 20) {
                edges {
                  node {
                    id
                    productTitle
                    variantTitle
                    sku
                    totalQuantity
                    remainingQuantity
                    image { url altText }
                    vendor
                  }
                }
              }
              supportedActions {
                action
              }
              merchantRequests(first: 5) {
                edges {
                  node {
                    kind
                    message
                    sentAt
                    responseData
                  }
                }
              }
              fulfillments(first: 5) {
                edges {
                  node {
                    id
                    status
                    displayStatus
                    createdAt
                    deliveredAt
                    estimatedDeliveryAt
                    inTransitAt
                    trackingInfo {
                      company
                      number
                      url
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `
    const variables = {
      first: options.first ?? 20,
      query: options.query ?? null,
      after: options.after ?? null,
      includeClosed: options.includeClosed ?? false,
    }
    const result = await this.graphql<{ fulfillmentOrders: any }>(gql, variables)
    const data = result.data.fulfillmentOrders
    return {
      nodes: (data.edges || []).map((e: any) => e.node),
      pageInfo: data.pageInfo || { hasNextPage: false, endCursor: null },
    }
  }
}
