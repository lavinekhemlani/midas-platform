// Shopify Admin REST API types (2025-01)
// https://shopify.dev/docs/api/admin-rest/2025-01

// ─── Shared ──────────────────────────────────────────────

export interface ShopifyMoney {
  amount: string
  currency_code: string
}

export interface ShopifyMoneySet {
  shop_money: ShopifyMoney
  presentment_money: ShopifyMoney
}

// ─── Shop ────────────────────────────────────────────────

export interface ShopifyShop {
  id: number
  name: string
  email: string
  domain: string
  myshopify_domain: string
  shop_owner: string
  address1: string
  address2: string | null
  city: string
  province: string
  province_code: string
  country: string
  country_code: string
  country_name: string
  zip: string
  phone: string | null
  latitude: number | null
  longitude: number | null
  primary_locale: string
  currency: string
  enabled_presentment_currencies: string[]
  timezone: string
  iana_timezone: string
  weight_unit: string
  money_format: string
  money_with_currency_format: string
  plan_name: string
  plan_display_name: string
  has_discounts: boolean
  has_gift_cards: boolean
  has_storefront: boolean
  finances: boolean
  taxes_included: boolean | null
  tax_shipping: boolean | null
  primary_location_id: number
  created_at: string
  updated_at: string
}

// ─── Orders ──────────────────────────────────────────────

export type ShopifyFinancialStatus =
  | 'pending'
  | 'authorized'
  | 'partially_paid'
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'voided'

export type ShopifyFulfillmentStatus = 'fulfilled' | 'partial' | null

export interface ShopifyAddress {
  address1: string | null
  address2: string | null
  city: string | null
  company: string | null
  country: string | null
  country_code: string | null
  first_name: string | null
  last_name: string | null
  name: string | null
  phone: string | null
  province: string | null
  province_code: string | null
  zip: string | null
}

export interface ShopifyOrderCustomer {
  id: number
  admin_graphql_api_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  default_address: ShopifyAddress | null
}

export interface ShopifyTaxLine {
  title: string
  price: string
  price_set: ShopifyMoneySet
  rate: number
  channel_liable: boolean | null
}

export interface ShopifyDiscountCode {
  code: string
  amount: string
  type: 'fixed_amount' | 'percentage' | 'shipping'
}

export interface ShopifyLineItem {
  id: number
  admin_graphql_api_id: string
  product_id: number | null
  variant_id: number | null
  title: string
  name: string
  variant_title: string | null
  sku: string | null
  vendor: string | null
  quantity: number
  price: string
  price_set: ShopifyMoneySet
  total_discount: string
  total_discount_set: ShopifyMoneySet
  grams: number
  gift_card: boolean
  taxable: boolean
  requires_shipping: boolean
  fulfillment_service: string
  fulfillment_status: string | null
  tax_lines: ShopifyTaxLine[]
}

export interface ShopifyTransaction {
  id: number
  admin_graphql_api_id: string
  order_id: number
  kind: 'authorization' | 'capture' | 'sale' | 'void' | 'refund'
  gateway: string
  status: 'pending' | 'failure' | 'success' | 'error'
  amount: string
  currency: string
  created_at: string
  processed_at: string
  parent_id: number | null
  test: boolean
  message: string | null
  error_code: string | null
}

export interface ShopifyRefundLineItem {
  id: number
  line_item_id: number
  line_item: ShopifyLineItem
  quantity: number
  restock_type: 'no_restock' | 'cancel' | 'return' | 'legacy_restock'
  location_id: number | null
  subtotal: number
  total_tax: number
  subtotal_set: ShopifyMoneySet
  total_tax_set: ShopifyMoneySet
}

export interface ShopifyRefund {
  id: number
  admin_graphql_api_id: string
  order_id: number
  created_at: string
  processed_at: string
  note: string | null
  restock: boolean
  refund_line_items: ShopifyRefundLineItem[]
  transactions: ShopifyTransaction[]
}

export interface ShopifyShippingLine {
  id: number
  title: string
  price: string
  price_set: ShopifyMoneySet
  discounted_price: string
  discounted_price_set: ShopifyMoneySet
  code: string | null
  source: string | null
  tax_lines: ShopifyTaxLine[]
}

export interface ShopifyOrder {
  id: number
  admin_graphql_api_id: string
  name: string
  order_number: number
  created_at: string
  updated_at: string
  processed_at: string | null
  closed_at: string | null
  cancelled_at: string | null
  financial_status: ShopifyFinancialStatus
  fulfillment_status: ShopifyFulfillmentStatus
  currency: string
  presentment_currency: string
  total_price: string
  total_price_set: ShopifyMoneySet
  subtotal_price: string
  subtotal_price_set: ShopifyMoneySet
  total_tax: string
  total_tax_set: ShopifyMoneySet
  total_discounts: string
  total_discounts_set: ShopifyMoneySet
  total_shipping_price_set: ShopifyMoneySet
  total_line_items_price: string
  total_line_items_price_set: ShopifyMoneySet
  current_total_price: string
  current_total_price_set: ShopifyMoneySet
  total_outstanding: string
  total_tip_received: string
  total_weight: number
  taxes_included: boolean
  test: boolean
  email: string | null
  phone: string | null
  note: string | null
  tags: string
  source_name: string
  gateway: string
  payment_gateway_names: string[]
  processing_method: string
  order_status_url: string
  customer: ShopifyOrderCustomer | null
  billing_address: ShopifyAddress | null
  shipping_address: ShopifyAddress | null
  line_items: ShopifyLineItem[]
  shipping_lines: ShopifyShippingLine[]
  tax_lines: ShopifyTaxLine[]
  discount_codes: ShopifyDiscountCode[]
  refunds: ShopifyRefund[]
}

// ─── Products ────────────────────────────────────────────

export type ShopifyProductStatus = 'active' | 'archived' | 'draft'

export interface ShopifyProductImage {
  id: number
  product_id: number
  position: number
  created_at: string
  updated_at: string
  width: number
  height: number
  src: string
  alt: string | null
  variant_ids: number[]
  admin_graphql_api_id: string
}

export interface ShopifyProductVariant {
  id: number
  admin_graphql_api_id: string
  product_id: number
  title: string
  price: string
  compare_at_price: string | null
  sku: string | null
  position: number
  inventory_policy: 'deny' | 'continue'
  inventory_management: 'shopify' | string | null
  inventory_quantity: number
  inventory_item_id: number
  fulfillment_service: string
  barcode: string | null
  weight: number | null
  weight_unit: 'g' | 'kg' | 'oz' | 'lb'
  option1: string | null
  option2: string | null
  option3: string | null
  taxable: boolean
  requires_shipping: boolean
  image_id: number | null
  created_at: string
  updated_at: string
}

export interface ShopifyProductOption {
  id: number
  product_id: number
  name: string
  position: number
  values: string[]
}

export interface ShopifyProduct {
  id: number
  admin_graphql_api_id: string
  title: string
  body_html: string | null
  vendor: string | null
  product_type: string
  handle: string
  status: ShopifyProductStatus
  published_at: string | null
  published_scope: string
  template_suffix: string | null
  tags: string
  created_at: string
  updated_at: string
  variants: ShopifyProductVariant[]
  options: ShopifyProductOption[]
  images: ShopifyProductImage[]
  image: ShopifyProductImage | null
}

// ─── Customers ───────────────────────────────────────────

export interface ShopifyCustomerAddress {
  id: number
  customer_id: number
  first_name: string | null
  last_name: string | null
  company: string | null
  address1: string | null
  address2: string | null
  city: string | null
  province: string | null
  country: string | null
  zip: string | null
  phone: string | null
  province_code: string | null
  country_code: string | null
  country_name: string | null
  name: string | null
  default: boolean
}

export interface ShopifyCustomer {
  id: number
  admin_graphql_api_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  verified_email: boolean
  state: 'disabled' | 'invited' | 'enabled' | 'declined'
  tags: string
  note: string | null
  tax_exempt: boolean
  tax_exemptions: string[]
  currency: string
  orders_count: number
  total_spent: string
  last_order_id: number | null
  last_order_name: string | null
  created_at: string
  updated_at: string
  addresses: ShopifyCustomerAddress[]
  default_address: ShopifyCustomerAddress | null
}

// ─── Inventory ───────────────────────────────────────────

export interface ShopifyLocation {
  id: number
  admin_graphql_api_id: string
  name: string
  address1: string | null
  address2: string | null
  city: string | null
  zip: string | null
  province: string | null
  province_code: string | null
  country: string | null
  country_code: string | null
  country_name: string | null
  phone: string | null
  created_at: string
  updated_at: string
  legacy: boolean
  active: boolean
}

export interface ShopifyInventoryLevel {
  inventory_item_id: number
  location_id: number
  available: number | null
  updated_at: string
  admin_graphql_api_id: string
}

export interface ShopifyInventoryItem {
  id: number
  admin_graphql_api_id: string
  sku: string | null
  created_at: string
  updated_at: string
  requires_shipping: boolean
  cost: string | null
  tracked: boolean
  country_code_of_origin: string | null
  province_code_of_origin: string | null
  harmonized_system_code: string | null
}

// ─── Shopify Payments ────────────────────────────────────

export interface ShopifyBalance {
  amount: string
  currency: string
}

export interface ShopifyPayoutSummary {
  adjustments_fee_amount: string
  adjustments_gross_amount: string
  charges_fee_amount: string
  charges_gross_amount: string
  refunds_fee_amount: string
  refunds_gross_amount: string
  reserved_funds_fee_amount: string
  reserved_funds_gross_amount: string
  retried_payouts_fee_amount: string
  retried_payouts_gross_amount: string
}

export interface ShopifyPayout {
  id: number
  status: 'scheduled' | 'in_transit' | 'paid' | 'failed' | 'canceled'
  amount: string
  currency: string
  date: string
  summary: ShopifyPayoutSummary | null
}

// ─── Payouts Page Response Types ────────────────────────

export type ShopifyPayoutStatus = 'scheduled' | 'in_transit' | 'paid' | 'failed' | 'canceled'

export interface ShopifyPayoutsSummary {
  totalCount: number
  totalAmount: number
  paidAmount: number
  scheduledAmount: number
  inTransitAmount: number
  failedAmount: number
  avgPayoutAmount: number
  /** Sum of charges_gross_amount across all payouts (gross sales settled) */
  totalChargesGross: number
  /** Sum of refunds_gross_amount across all payouts (refunds settled) */
  totalRefundsGross: number
  /** Sum of adjustments_gross_amount across all payouts (chargebacks, goodwill, etc.) */
  totalAdjustmentsGross: number
  /** Sum of reserved_funds_gross_amount across all payouts (held in reserve) */
  totalReservedFundsGross: number
  /** Sum of retried_payouts_gross_amount across all payouts (re-attempted after a failure) */
  totalRetriedPayoutsGross: number
  /** Total processing fees (charges_fee + refunds_fee + adjustments_fee + reserved_funds_fee + retried_payouts_fee) */
  totalFees: number
  /** Effective fee rate (totalFees / totalChargesGross), 0..1 */
  effectiveFeeRate: number
  currency: string
  payoutsByStatus: { status: ShopifyPayoutStatus; count: number; amount: number }[]
  /** The single most-recent payout that hasn't yet hit the bank (in_transit or scheduled) */
  upcomingPayout?: {
    id: number
    status: ShopifyPayoutStatus
    amount: number
    date: string
  } | null
}

export interface ShopifyPayoutTrendPoint {
  date: string
  amount: number
  count: number
  chargesGross: number
  refundsGross: number
  adjustmentsGross: number
  reservedFundsGross: number
  fees: number
}

export interface ShopifyPayoutsResponse {
  payouts: ShopifyPayout[]
  summary: ShopifyPayoutsSummary
  payoutTrend?: ShopifyPayoutTrendPoint[]
  trendGranularity?: 'day' | 'week' | 'month'
  warning?: string
}

// ─── API Response Types (consumed by frontend) ──────────

export interface ShopifyOrdersSummary {
  totalCount: number
  grossSales: number
  totalRevenue: number
  avgOrderValue: number
  fulfilledCount: number
  ordersDelivered?: number | null
  ordersShipped?: number | null
  refundedCount: number
  currency: string
  unfulfilled?: number
  partiallyFulfilled?: number
  pendingPayment?: number
  cancelledCount?: number
  riskHigh?: number
  riskMedium?: number
  /** Total customer tips received (GraphQL totalTipReceivedSet) */
  tipRevenue?: number
  /** Total duties collected on international orders (GraphQL currentTotalDutiesSet) */
  dutiesCollected?: number
  /** Total outstanding balance across unpaid/partially-paid orders (GraphQL totalOutstandingSet) */
  outstandingBalance?: number
  /** Count of orders flagged unpaid by Shopify (GraphQL Order.unpaid) */
  unpaidCount?: number
  /** Count of orders that were edited after creation (GraphQL Order.edited) */
  editedCount?: number
  /** Share of orders that were edited after creation (0..1) */
  editedRate?: number
  /** Count of orders placed by a B2B purchasing company (GraphQL Order.purchasingEntity) */
  b2bOrderCount?: number
  /** Count of orders placed by a regular customer (non-B2B) */
  dtcOrderCount?: number
  /** Count of orders per payment gateway (e.g. shopify_payments, paypal) */
  paymentGatewayBreakdown?: Record<string, number>
}

export interface ShopifyFulfillmentPipeline {
  unfulfilled: number
  partiallyFulfilled: number
  fulfilled: number
  cancelled: number
}

export interface ShopifyOrderTrendPoint {
  date: string
  orders: number
  revenue: number
  grossSales: number
  discounts: number
  netSales: number
  shipping: number
  taxes: number
  avgOrderValue: number
}

export interface ShopifyFulfillmentSpeedPoint {
  date: string
  avgDaysToFulfill: number
  ordersCount: number
}

export interface ShopifyKPICardData {
  value: number
  prevValue: number | null
  changePercent: number | null
  sparkline: number[]
}

export interface ShopifyOrdersKPIs {
  orders: ShopifyKPICardData
  itemsOrdered: ShopifyKPICardData
  returns: ShopifyKPICardData
  ordersFulfilled: ShopifyKPICardData
  ordersDelivered: ShopifyKPICardData
  fulfillmentTime: ShopifyKPICardData
}

export interface ShopifyRiskOrder {
  name: string
  customer: string
  total: string
  currency: string
  createdAt: string
  riskLevel: 'high' | 'medium'
}

export interface ShopifyOrderEnrichment {
  cancelReason: string | null
  cancelledAt: string | null
  channelName: string | null
  channelHandle: string | null
  appName: string | null
  publicationName: string | null
  paymentTermsName: string | null
  paymentTermsDueInDays: number | null
  customerOrderIndex: number | null
  retailLocationName: string | null
}

export interface ShopifyOrdersAttributionStats {
  cancellationReasons: Record<string, number>
  channelBreakdown: Record<string, number>
  retailLocationBreakdown: Record<string, number>
  firstTimeCount: number
  repeatCount: number
  b2bCount: number
}

export interface ShopifyOrdersResponse {
  orders: ShopifyOrder[]
  summary: ShopifyOrdersSummary
  kpis?: ShopifyOrdersKPIs
  fulfillmentPipeline?: ShopifyFulfillmentPipeline
  orderTrend?: ShopifyOrderTrendPoint[]
  prevOrderTrend?: ShopifyOrderTrendPoint[]
  fulfillmentSpeedTrend?: ShopifyFulfillmentSpeedPoint[]
  prevFulfillmentSpeedTrend?: ShopifyFulfillmentSpeedPoint[]
  trendGranularity?: 'day' | 'week' | 'month'
  storeTimezone?: string
  warning?: string
  graphqlWarning?: string
  riskOrders?: ShopifyRiskOrder[]
  fulfillmentLocationMap?: Record<string, string[]>
  orderEnrichmentMap?: Record<string, ShopifyOrderEnrichment>
  attributionStats?: ShopifyOrdersAttributionStats
}

export interface ShopifyProductsSummary {
  totalCount: number
  activeCount: number
  draftCount: number
  archivedCount: number
  totalVariants: number
  productTypes: string[]
  vendors: string[]
  totalRevenue?: number
  totalUnitsSold?: number
  currency?: string
}

/** Per-product sales & inventory enrichment */
export interface ShopifyProductEnriched {
  productId: number
  revenue: number
  unitsSold: number
  totalStock: number
  avgWeeklySales: number
  weeksCover: number | null
  tags: string[]
  stockByLocation: Array<{
    locationName: string
    available: number
    weeksCover: number | null
    risk: 'out_of_stock' | 'critical' | 'low' | 'healthy'
  }>
}

/** Tag-level sales aggregation for the products page */
export interface ShopifyProductTagSales {
  tag: string
  revenue: number
  unitsSold: number
  productCount: number
}

export interface ShopifyProductsResponse {
  products: ShopifyProduct[]
  summary: ShopifyProductsSummary
  enriched?: ShopifyProductEnriched[]
  salesByTag?: ShopifyProductTagSales[]
}

export interface ShopifyCustomersSummary {
  totalCount: number
  totalSpent: number
  avgSpent: number
  withOrdersCount: number
  totalOrders: number
  currency: string
  avgOrderValue?: number
  returningRate?: number
  emailSubscribers?: number
  smsSubscribers?: number
  topSpenders?: number
  atRisk?: number
  atRiskCustomers?: ShopifyAtRiskCustomer[]
  newLast30d?: number
  /** Average days between first and second order */
  avgDaysBetweenOrders?: number
  /** Repeat purchase rate: customers with 2+ orders / customers with 1+ orders */
  repeatPurchaseRate?: number
  /** Average order frequency (orders per customer among those with orders) */
  avgOrderFrequency?: number
  /** Number of customers predicted as HIGH spend tier by Shopify ML */
  predictedHighTier?: number
  /** Total outstanding store credit liability across all customers */
  totalStoreCredit?: number
  /** Number of customers with at least one store credit account with a positive balance */
  customersWithStoreCredit?: number
}

/** VIP customer entry for the top spenders / most ordered section */
export interface ShopifyVIPCustomer {
  name: string
  email: string | null
  totalSpent: number
  ordersCount: number
  avgOrderValue: number
  lastOrderDate: string | null
  currency: string
}

/** Retention cohort: group of customers by first-purchase month */
export interface ShopifyRetentionCohort {
  cohortMonth: string
  customersInCohort: number
  /** Percentage that purchased again within 30/60/90 days */
  retainedAt30d: number
  retainedAt60d: number
  retainedAt90d: number
}

export interface ShopifyCustomerAcquisitionPoint {
  date: string
  newCustomers: number
  totalSpent: number
}

export interface ShopifyAtRiskCustomer {
  email: string | null
  name: string
  totalSpent: string
  currency: string
  lastOrderDate: string
  orderCount: number
}

export interface ShopifyCustomersResponse {
  customers: ShopifyCustomer[]
  graphqlCustomers?: ShopifyGraphQLCustomerNode[]
  summary: ShopifyCustomersSummary
  acquisitionTrend?: ShopifyCustomerAcquisitionPoint[]
  atRiskCustomers?: ShopifyAtRiskCustomer[]
  vipCustomers?: ShopifyVIPCustomer[]
  mostOrdered?: Array<{ productTitle: string; totalOrdered: number; uniqueCustomers: number }>
  retentionCohorts?: ShopifyRetentionCohort[]
  warning?: string
  graphqlWarning?: string
  storeTimezone?: string
}

export interface ShopifyLocationSummary {
  id: number
  name: string
  address: string | null
  city: string | null
  country: string | null
  active: boolean
}

export interface ShopifyEnrichedInventoryLevel {
  inventory_item_id: number
  location_id: number
  available: number | null
  updated_at: string
  admin_graphql_api_id: string
  productTitle?: string
  variantTitle?: string
  sku?: string
  unitCost?: number | null
  costCurrency?: string
  onHand?: number | null
  committed?: number | null
  incoming?: number | null
}

export interface ShopifyInventoryByLocation {
  location: ShopifyLocationSummary
  levels: ShopifyEnrichedInventoryLevel[]
  totalItems: number
  totalAvailable: number
  totalOnHand?: number
  totalCommitted?: number
  inventoryValue?: number | null
}

export interface ShopifyInventorySummary {
  totalLocations: number
  totalTrackedItems: number
  totalAvailableUnits: number
  totalOnHand?: number
  totalCommitted?: number
  totalIncoming?: number
  totalInventoryValue?: number | null
  lowStockCount?: number
  outOfStockCount?: number
  costCurrency?: string
}

export interface ShopifyInventoryResponse {
  inventoryByLocation: ShopifyInventoryByLocation[]
  summary: ShopifyInventorySummary
}

export interface ShopifyShopSummary {
  name: string
  email: string
  domain: string
  currency: string
  timezone: string
  plan: string
  country: string
}

export interface ShopifyOrdersSummarySummary {
  total: number
  financialOrderCount: number
  cancelledCount: number
  grossSales: number
  totalRevenue: number
  avgOrderValue: number
  recentCount: number
  recentGrossSales: number
  recentRevenue: number
  currency: string
}

export interface ShopifyPayoutEntry {
  id: number
  status: string
  amount: number
  date: string
}

export interface ShopifyFinancials {
  grossSales: number
  netSales: number
  revenue: number
  netRevenue: number
  grossProfit: number
  totalTax: number
  totalDiscounts: number
  totalShipping: number
  totalRefunded: number
  refundedOrderCount: number
  avgOrderValue: number
  revenueChange: number | null
  cashBalance: number | null
  currency: string
  recentPayouts: ShopifyPayoutEntry[]
}

export interface ShopifySummaryResponse {
  shop: ShopifyShopSummary
  summary: {
    orders: ShopifyOrdersSummarySummary
    products: { total: number; active: number }
    customers: { total: number; totalSpend: number; returning: number }
  }
  financials: ShopifyFinancials | null
}

export interface ShopifyAnalyticsSummary {
  totalSales: number
  grossSales: number
  netSales: number
  orders: number
  discounts: number
  returns: number
  taxes: number
  shipping: number
}

export interface ShopifyDailyTrend {
  date: string | null
  totalSales: number
  grossSales: number
  discounts: number
  netSales: number
  shipping: number
  taxes: number
  orders: number
}

export interface ShopifyProductSales {
  name: string
  totalSales: number
  netSales?: number
  orders: number
}

export interface ShopifyChannelSales {
  name: string
  totalSales: number
  orders: number
}

export interface ShopifyGeoSales {
  country: string
  totalSales: number
  orders: number
}

export interface ShopifyDiscountPerformance {
  code: string
  totalSales: number
  orders: number
  discountAmount: number
}

export interface ShopifyReferrerSales {
  source: string
  totalSales: number
  orders: number
}

export interface ShopifyHourlySales {
  hour: string
  totalSales: number
  orders: number
}

export interface ShopifyAOVTrendPoint {
  date: string | null
  averageOrderValue: number
}

export interface ShopifyDiscountTrendPoint {
  date: string | null
  discounts: number
  orders: number
}

export interface ShopifyReturnsTrendPoint {
  date: string | null
  returns: number
}

export interface ShopifySessionsTrendPoint {
  date: string | null
  sessions: number
}

export interface ShopifyProductTypeSales {
  name: string
  totalSales: number
  orders: number
}

export interface ShopifyAnalyticsResponse {
  summary: ShopifyAnalyticsSummary | null
  dailyTrend: ShopifyDailyTrend[]
  topProducts: ShopifyProductSales[]
  salesByChannel: ShopifyChannelSales[]
  salesByCountry: ShopifyGeoSales[]
  discountPerformance: ShopifyDiscountPerformance[]
  salesByReferrer: ShopifyReferrerSales[]
  hourlySales: ShopifyHourlySales[]
  aovTrend?: ShopifyAOVTrendPoint[]
  prevAovTrend?: ShopifyAOVTrendPoint[]
  discountTrend?: ShopifyDiscountTrendPoint[]
  returnsTrend?: ShopifyReturnsTrendPoint[]
  sessionsTrend?: ShopifySessionsTrendPoint[]
  prevSessionsTrend?: ShopifySessionsTrendPoint[]
  salesByProductType?: ShopifyProductTypeSales[]
  salesByVendor?: ShopifyProductTypeSales[]
  period: string
  dateFilter: string
}

// ─── Fulfillments (GraphQL) ─────────────────────────────

export interface ShopifyFulfillmentTrackingInfo {
  number: string | null
  url: string | null
  company: string | null
}

export interface ShopifyFulfillmentEvent {
  status: string
  happenedAt: string
  city: string | null
  province: string | null
  country: string | null
  message: string | null
}

export interface ShopifyGraphQLFulfillment {
  id: string
  status: string
  createdAt: string
  updatedAt: string
  deliveredAt: string | null
  estimatedDeliveryAt: string | null
  displayStatus: string | null
  trackingInfo: ShopifyFulfillmentTrackingInfo[]
  events: ShopifyFulfillmentEvent[]
}

// ─── Risk Assessments (GraphQL) ─────────────────────────

export interface ShopifyRiskFact {
  description: string
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
}

export interface ShopifyRiskAssessment {
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | 'PENDING'
  facts: ShopifyRiskFact[]
}

// ─── Customer GraphQL Types ─────────────────────────────

export interface ShopifyGraphQLCustomerNode {
  id: string
  displayName: string
  email: string | null
  phone: string | null
  numberOfOrders: string
  amountSpent: { amount: string; currencyCode: string }
  createdAt: string
  updatedAt: string
  tags: string[]
  note: string | null
  emailMarketingConsent: {
    marketingState: 'SUBSCRIBED' | 'NOT_SUBSCRIBED' | 'UNSUBSCRIBED' | 'PENDING'
    marketingOptInLevel: 'SINGLE_OPT_IN' | 'CONFIRMED_OPT_IN' | 'UNKNOWN'
    consentUpdatedAt: string | null
  } | null
  smsMarketingConsent: {
    marketingState: string
    marketingOptInLevel: string
    consentUpdatedAt: string | null
  } | null
  lastOrder: {
    id: string
    createdAt: string
    totalPriceSet: ShopifyGraphQLMoneyField
  } | null
  defaultAddress: {
    city: string | null
    provinceCode: string | null
    countryCode: string | null
  } | null
  /** Shopify-computed customer statistics (predictive ML output) */
  statistics?: {
    /** Predicted lifetime spend tier — Shopify ML output */
    predictedSpendTier?: 'HIGH' | 'MEDIUM' | 'LOW' | null
    /** Recency-Frequency-Monetary segmentation group */
    rfmGroup?: string | null
  } | null
  /** Store credit accounts attached to this customer */
  storeCreditAccounts?: {
    edges: Array<{
      node: ShopifyStoreCreditAccount
    }>
  }
}

/** A single store credit account balance for a customer */
export interface ShopifyStoreCreditAccount {
  id: string
  balance: { amount: string; currencyCode: string }
}

// ─── Inventory GraphQL Types ────────────────────────────

export interface ShopifyInventoryQuantity {
  name: string
  quantity: number
  updatedAt: string
}

export interface ShopifyGraphQLInventoryLevel {
  id: string
  location: { id: string; name: string }
  quantities: ShopifyInventoryQuantity[]
}

export interface ShopifyGraphQLInventoryItem {
  id: string
  sku: string | null
  tracked: boolean
  unitCost: { amount: string; currencyCode: string } | null
  variant: {
    id: string
    title: string
    price: string
    product: { id: string; title: string; status: string }
  } | null
  inventoryLevels: {
    edges: Array<{ node: ShopifyGraphQLInventoryLevel }>
  }
}

// ─── GraphQL Order Types ────────────────────────────────

export interface ShopifyGraphQLMoneyField {
  shopMoney: { amount: string; currencyCode: string }
}

export interface ShopifyGraphQLOrderNode {
  id: string
  name: string
  createdAt: string
  displayFinancialStatus: string | null
  displayFulfillmentStatus: string | null
  totalPriceSet: ShopifyGraphQLMoneyField
  subtotalPriceSet: ShopifyGraphQLMoneyField
  totalTaxSet: ShopifyGraphQLMoneyField
  totalDiscountsSet: ShopifyGraphQLMoneyField
  totalShippingPriceSet: ShopifyGraphQLMoneyField
  totalRefundedSet: ShopifyGraphQLMoneyField
  netPaymentSet: ShopifyGraphQLMoneyField
  currentTotalPriceSet: ShopifyGraphQLMoneyField
  totalTipReceivedSet?: ShopifyGraphQLMoneyField | null
  currentTotalDutiesSet?: ShopifyGraphQLMoneyField | null
  totalOutstandingSet?: ShopifyGraphQLMoneyField | null
  paymentGatewayNames?: string[] | null
  edited?: boolean | null
  unpaid?: boolean | null
  poNumber?: string | null
  purchasingEntity?: {
    __typename?: 'Customer' | 'PurchasingCompany' | string
  } | null
  cancelReason?: string | null
  cancelledAt?: string | null
  channelInformation?: {
    channelDefinition: {
      handle: string | null
      channelName: string | null
      subChannelName: string | null
    } | null
  } | null
  app?: { name: string } | null
  publication?: { name: string } | null
  paymentTerms?: {
    dueInDays: number | null
    paymentTermsName: string | null
    paymentTermsType: string | null
  } | null
  customerOrderIndex?: number | null
  retailLocation?: { name: string } | null
  staffMember?: { name: string | null } | null
}

// ─── GraphQL Order Detail Types ─────────────────────────

export interface ShopifyOrderDetailLineItem {
  id: string
  title: string
  quantity: number
  fulfillmentStatus: string | null
  variant: {
    id: string
    title: string
    sku: string | null
    price: string
    image: { url: string; altText: string | null } | null
  } | null
  originalTotalSet: ShopifyGraphQLMoneyField
  discountAllocations: Array<{
    allocatedAmountSet: ShopifyGraphQLMoneyField
  }>
  taxLines: Array<{
    title: string
    rate: number
    priceSet: ShopifyGraphQLMoneyField
  }>
}

export interface ShopifyOrderDetailTransaction {
  id: string
  kind: string
  status: string
  amountSet: ShopifyGraphQLMoneyField
  gateway: string
  formattedGateway: string
  createdAt: string
  errorCode: string | null
}

export interface ShopifyOrderDetailFulfillment {
  id: string
  status: string
  displayStatus: string | null
  createdAt: string
  deliveredAt: string | null
  estimatedDeliveryAt: string | null
  trackingInfo: Array<{
    number: string | null
    url: string | null
    company: string | null
  }>
  fulfillmentLineItems: {
    edges: Array<{
      node: {
        id: string
        quantity: number
        lineItem: { title: string }
      }
    }>
  }
}

export interface ShopifyOrderDetailRefund {
  id: string
  createdAt: string
  note: string | null
  totalRefundedSet: ShopifyGraphQLMoneyField
  refundLineItems: {
    edges: Array<{
      node: {
        quantity: number
        restockType: string
        lineItem: { title: string; sku: string | null }
        subtotalSet: ShopifyGraphQLMoneyField
      }
    }>
  }
}

export interface ShopifyOrderDetailRisk {
  level: string
  message: string
}

export interface ShopifyOrderDetailEvent {
  message: string
  createdAt: string
}

export interface ShopifyOrderDetail {
  id: string
  name: string
  createdAt: string
  note: string | null
  tags: string[]
  returnStatus: string | null
  customer: {
    id: string
    displayName: string
    email: string | null
    phone: string | null
    numberOfOrders: string
    amountSpent: { amount: string; currencyCode: string }
  } | null
  billingAddress: { formatted: string[] } | null
  shippingAddress: { formatted: string[] } | null
  lineItems: {
    edges: Array<{ node: ShopifyOrderDetailLineItem }>
  }
  transactions: ShopifyOrderDetailTransaction[]
  fulfillments: ShopifyOrderDetailFulfillment[]
  refunds: ShopifyOrderDetailRefund[]
  risks: ShopifyOrderDetailRisk[]
  events: {
    edges: Array<{ node: ShopifyOrderDetailEvent }>
  }
  subtotalPriceSet: ShopifyGraphQLMoneyField
  totalTaxSet: ShopifyGraphQLMoneyField
  totalDiscountsSet: ShopifyGraphQLMoneyField
  totalShippingPriceSet: ShopifyGraphQLMoneyField
  totalPriceSet: ShopifyGraphQLMoneyField
  totalRefundedSet: ShopifyGraphQLMoneyField
  currentTotalPriceSet: ShopifyGraphQLMoneyField
}

// ─── Inventory Item Detail Types ─────────────────────────

export interface ShopifyInventoryItemDetail {
  id: string
  sku: string | null
  tracked: boolean
  requiresShipping: boolean
  createdAt: string
  updatedAt: string
  unitCost: { amount: string; currencyCode: string } | null
  countryCodeOfOrigin: string | null
  provinceCodeOfOrigin: string | null
  harmonizedSystemCode: string | null
  countryHarmonizedSystemCodes: {
    edges: Array<{ node: { harmonizedSystemCode: string; countryCode: string } }>
  }
  measurement: {
    weight: { unit: string; value: number } | null
  } | null
  variant: {
    id: string
    title: string
    sku: string | null
    barcode: string | null
    price: string
    compareAtPrice: string | null
    image: { url: string; altText: string | null } | null
    selectedOptions: Array<{ name: string; value: string }>
    product: {
      id: string
      title: string
      status: string
      vendor: string
      productType: string
      handle: string
      featuredImage: { url: string; altText: string | null } | null
      onlineStoreUrl: string | null
    } | null
  } | null
  inventoryLevels: {
    edges: Array<{
      node: {
        id: string
        location: { id: string; name: string; isActive: boolean }
        quantities: Array<{ name: string; quantity: number; updatedAt: string | null }>
      }
    }>
  }
}

// ─── Collection Detail Types ─────────────────────────────

export interface ShopifyCollectionDetailProduct {
  id: string
  title: string
  handle: string
  status: string
  vendor: string
  productType: string
  totalInventory: number
  priceRangeV2: {
    minVariantPrice: { amount: string; currencyCode: string }
    maxVariantPrice: { amount: string; currencyCode: string }
  }
  featuredImage: { url: string; altText: string | null } | null
  variants: {
    edges: Array<{
      node: {
        id: string
        title: string
        price: string
        compareAtPrice: string | null
      }
    }>
  }
}

export interface ShopifyCollectionDetailRule {
  column: string
  relation: string
  condition: string
}

export interface ShopifyCollectionDetail {
  id: string
  title: string
  handle: string
  descriptionHtml: string | null
  sortOrder: string
  updatedAt: string
  publishedAt: string | null
  templateSuffix: string | null
  image: { url: string; altText: string | null; width: number; height: number } | null
  seo: { title: string | null; description: string | null } | null
  productsCount: { count: number }
  ruleSet: {
    appliedDisjunctively: boolean
    rules: ShopifyCollectionDetailRule[]
  } | null
  products: {
    edges: Array<{ node: ShopifyCollectionDetailProduct }>
  }
  metafields: {
    edges: Array<{ node: { namespace: string; key: string; value: string; type: string } }>
  }
}

// ─── Refund Detail Types ─────────────────────────────────

export interface ShopifyRefundDetailLineItem {
  quantity: number
  restockType: string
  restocked: boolean
  location: { id: string; name: string } | null
  lineItem: {
    id: string
    title: string
    sku: string | null
    quantity: number
    image: { url: string; altText: string | null } | null
    variant: {
      id: string
      title: string
      sku: string | null
      image: { url: string; altText: string | null } | null
      price: string
    } | null
  }
  priceSet: { shopMoney: { amount: string; currencyCode: string } } | null
  subtotalSet: { shopMoney: { amount: string; currencyCode: string } } | null
  totalTaxSet: { shopMoney: { amount: string; currencyCode: string } } | null
}

export interface ShopifyRefundDetailReturn {
  id: string
  status: string
  returnLineItems: {
    edges: Array<{
      node: {
        id: string
        quantity: number
        returnReason: string | null
        returnReasonNote: string | null
        customerNote: string | null
      }
    }>
  }
}

export interface ShopifyRefundDetailEntry {
  id: string
  createdAt: string
  note: string | null
  totalRefundedSet: { shopMoney: { amount: string; currencyCode: string } }
  refundLineItems: {
    edges: Array<{ node: ShopifyRefundDetailLineItem }>
  }
  transactions: {
    edges: Array<{
      node: {
        id: string
        kind: string
        status: string
        processedAt: string | null
        amountSet: { shopMoney: { amount: string; currencyCode: string } }
        gateway: string
        formattedGateway: string
      }
    }>
  }
  return: ShopifyRefundDetailReturn | null
}

export interface ShopifyRefundDetailOrder {
  id: string
  name: string
  createdAt: string
  customer: {
    id: string
    displayName: string
    email: string | null
    phone: string | null
  } | null
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } }
  displayFinancialStatus: string | null
  displayFulfillmentStatus: string | null
  refunds: ShopifyRefundDetailEntry[]
}

// ─── Draft Order Detail Types ────────────────────────────

export interface ShopifyDraftOrderPaymentTerms {
  paymentTermsName: string
  paymentTermsType: string
  dueInDays: number | null
  overdue: boolean
  paymentSchedules?: {
    edges: Array<{
      node: {
        issuedAt: string | null
        dueAt: string | null
        completedAt: string | null
      }
    }>
  }
}

export interface ShopifyDraftOrderPurchasingEntity {
  company: { id: string; name: string } | null
  contact: { id: string } | null
  location: { id: string; name: string } | null
}

export interface ShopifyDraftOrderDetail {
  id: string
  name: string
  status: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
  note2: string | null
  tags: string[]
  email: string | null
  phone: string | null
  invoiceUrl: string | null
  invoiceSentAt: string | null
  taxesIncluded: boolean
  taxExempt: boolean
  currencyCode: string
  ready: boolean
  visibleToCustomer: boolean
  totalQuantityOfLineItems: number
  poNumber: string | null
  purchasingEntity: ShopifyDraftOrderPurchasingEntity | null
  paymentTerms: ShopifyDraftOrderPaymentTerms | null
  subtotalPriceSet: { shopMoney: { amount: string; currencyCode: string } }
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } }
  totalTaxSet: { shopMoney: { amount: string; currencyCode: string } }
  totalShippingPriceSet: { shopMoney: { amount: string; currencyCode: string } } | null
  totalDiscountsSet: { shopMoney: { amount: string; currencyCode: string } } | null
  customer: {
    id: string
    displayName: string
    email: string | null
    phone: string | null
    numberOfOrders: string
    amountSpent: { amount: string; currencyCode: string }
  } | null
  billingAddress: { formatted: string[] } | null
  shippingAddress: { formatted: string[] } | null
  shippingLine: {
    title: string
    custom: boolean
    originalPriceSet: { shopMoney: { amount: string; currencyCode: string } } | null
  } | null
  appliedDiscount: {
    title: string | null
    description: string | null
    value: number
    valueType: string
    amountSet: { shopMoney: { amount: string; currencyCode: string } } | null
  } | null
  lineItems: {
    edges: Array<{
      node: {
        id: string
        title: string
        quantity: number
        sku: string | null
        variantTitle: string | null
        vendor: string | null
        requiresShipping: boolean
        taxable: boolean
        originalUnitPriceSet: { shopMoney: { amount: string; currencyCode: string } }
        discountedUnitPriceSet: { shopMoney: { amount: string; currencyCode: string } } | null
        totalDiscountSet: { shopMoney: { amount: string; currencyCode: string } } | null
        image: { url: string; altText: string | null } | null
        variant: {
          id: string
          title: string
          sku: string | null
          image: { url: string; altText: string | null } | null
          product: { id: string; title: string; handle: string } | null
        } | null
        appliedDiscount: {
          title: string | null
          value: number
          valueType: string
          amountSet: { shopMoney: { amount: string; currencyCode: string } } | null
        } | null
        taxLines: Array<{
          title: string
          rate: number
          priceSet: { shopMoney: { amount: string; currencyCode: string } }
        }>
      }
    }>
  }
  taxLines: Array<{
    title: string
    rate: number
    priceSet: { shopMoney: { amount: string; currencyCode: string } }
  }>
  order: { id: string; name: string } | null
  metafields: {
    edges: Array<{ node: { namespace: string; key: string; value: string; type: string } }>
  }
}

// ─── Dispute Detail Types ────────────────────────────────

export interface ShopifyDisputeEvidence {
  id: number
  payments_dispute_id: number
  access_activity_log: string | null
  billing_address: any | null
  cancellation_policy_disclosure: string | null
  cancellation_rebuttal: string | null
  customer_email_address: string | null
  customer_first_name: string | null
  customer_last_name: string | null
  refund_policy_disclosure: string | null
  refund_refusal_explanation: string | null
  shipping_address: any | null
  uncategorized_text: string | null
  submitted: boolean
}

export interface ShopifyDisputeLinkedOrder {
  id: number
  name: string
  created_at: string
  total_price: string
  currency: string
  financial_status: string
  fulfillment_status: string | null
  customer: {
    id: number
    first_name: string | null
    last_name: string | null
    email: string | null
  } | null
  line_items: Array<{
    id: number
    title: string
    quantity: number
    price: string
  }>
  shipping_address: any | null
  billing_address: any | null
}

export interface ShopifyDisputeDetail extends ShopifyDispute {
  evidence: ShopifyDisputeEvidence | null
  order: ShopifyDisputeLinkedOrder | null
}

// ─── GraphQL Product Detail Types ────────────────────────

export interface ShopifyProductDetail {
  id: string
  title: string
  descriptionHtml: string | null
  handle: string
  status: string
  vendor: string
  productType: string
  tags: string[]
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  onlineStoreUrl: string | null
  totalInventory: number
  tracksInventory: boolean
  hasOnlyDefaultVariant: boolean
  priceRangeV2: {
    minVariantPrice: { amount: string; currencyCode: string }
    maxVariantPrice: { amount: string; currencyCode: string }
  }
  featuredMedia: {
    preview: {
      image: { url: string; altText: string | null; width: number; height: number } | null
    } | null
  } | null
  seo: { title: string | null; description: string | null } | null
  collections: {
    edges: Array<{ node: { id: string; title: string; handle: string } }>
  }
  variants: {
    edges: Array<{
      node: {
        id: string
        title: string
        sku: string | null
        barcode: string | null
        price: string
        compareAtPrice: string | null
        inventoryQuantity: number
        selectedOptions: Array<{ name: string; value: string }>
        image: { url: string; altText: string | null } | null
        inventoryItem: {
          id: string
          unitCost: { amount: string; currencyCode: string } | null
          tracked: boolean
          countryCodeOfOrigin: string | null
          harmonizedSystemCode: string | null
          inventoryLevels: {
            edges: Array<{
              node: {
                location: { id: string; name: string }
                quantities: Array<{ name: string; quantity: number }>
              }
            }>
          }
        } | null
      }
    }>
  }
  media: {
    edges: Array<{
      node: {
        mediaContentType: string
        preview: {
          image: { url: string; altText: string | null; width: number; height: number } | null
        } | null
      }
    }>
  }
  metafields: {
    edges: Array<{ node: { namespace: string; key: string; value: string; type: string } }>
  }
}

// ─── GraphQL Customer Detail Types ──────────────────────

export interface ShopifyCustomerDetail {
  id: string
  displayName: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  locale: string | null
  note: string | null
  tags: string[]
  state: string
  verifiedEmail: boolean
  createdAt: string
  updatedAt: string
  numberOfOrders: string
  amountSpent: { amount: string; currencyCode: string }
  lifetimeDuration: string
  image: { url: string; altText: string | null } | null
  emailMarketingConsent: {
    marketingState: string
    marketingOptInLevel: string
    consentUpdatedAt: string | null
  } | null
  smsMarketingConsent: {
    marketingState: string
    marketingOptInLevel: string
    consentUpdatedAt: string | null
  } | null
  defaultAddress: {
    address1: string | null
    address2: string | null
    city: string | null
    company: string | null
    country: string | null
    countryCodeV2: string | null
    province: string | null
    provinceCode: string | null
    zip: string | null
    phone: string | null
    formatted: string[]
  } | null
  addresses: Array<{
    address1: string | null
    city: string | null
    company: string | null
    country: string | null
    province: string | null
    zip: string | null
    formatted: string[]
  }>
  orders: {
    edges: Array<{
      node: {
        id: string
        name: string
        createdAt: string
        displayFinancialStatus: string | null
        displayFulfillmentStatus: string | null
        totalPriceSet: { shopMoney: { amount: string; currencyCode: string } }
      }
    }>
  }
  lastOrder: {
    id: string
    name: string
    createdAt: string
    totalPriceSet: { shopMoney: { amount: string; currencyCode: string } }
  } | null
  taxExempt: boolean
  metafields: {
    edges: Array<{ node: { namespace: string; key: string; value: string; type: string } }>
  }
  /** Shopify-computed customer statistics (predictive ML output) */
  statistics?: {
    predictedSpendTier?: 'HIGH' | 'MEDIUM' | 'LOW' | null
    rfmGroup?: string | null
  } | null
  /** Store credit accounts attached to this customer */
  storeCreditAccounts?: {
    edges: Array<{
      node: ShopifyStoreCreditAccount
    }>
  }
  /** Customer activity timeline events (BasicEvent + CommentEvent from Shopify Admin) */
  events?: {
    edges: Array<{
      node: ShopifyCustomerEvent
    }>
  }
}

/**
 * Customer activity timeline event from Shopify GraphQL Admin API.
 * Implements the Event interface — concrete typename is BasicEvent or CommentEvent.
 */
export interface ShopifyCustomerEvent {
  __typename: 'BasicEvent' | 'CommentEvent' | string
  id: string
  /** Verb-style action key (e.g. "placed_order", "comment", "update", "create") */
  action: string
  /** Pre-formatted HTML message from Shopify (FormattedString!) — sanitize before rendering */
  message: string
  createdAt: string
  appTitle: string | null
  attributeToApp: boolean
  attributeToUser: boolean
  /** True for high-priority alerts (e.g. fraud, chargeback) */
  criticalAlert: boolean
}

// ─── ShopifyQL (GraphQL) ────────────────────────────────

export type ShopifyQLColumnDataType =
  | 'DAY_TIMESTAMP'
  | 'DECIMAL'
  | 'FLOAT'
  | 'INTEGER'
  | 'MONEY'
  | 'PERCENT'
  | 'STRING'
  | 'BOOLEAN'
  | 'MONTH_TIMESTAMP'
  | 'WEEK_TIMESTAMP'
  | 'YEAR_TIMESTAMP'
  | 'QUARTER_TIMESTAMP'
  | 'HOUR_TIMESTAMP'
  | 'MINUTE_TIMESTAMP'
  | 'SECOND_TIMESTAMP'
  | 'TIMESTAMP'
  | 'UNSPECIFIED'

export interface ShopifyQLColumn {
  name: string
  dataType: ShopifyQLColumnDataType
  displayName: string
}

export type ShopifyQLRow = (string | null)[]

export interface ShopifyQLTableData {
  columns: ShopifyQLColumn[]
  rows: ShopifyQLRow[]
}

// ─── Refunds & Returns (API Response) ──────────────────

export interface ShopifyRefundItem {
  orderId: number
  orderName: string
  refundId: number
  createdAt: string
  note: string | null
  lineItems: Array<{
    title: string
    quantity: number
    subtotal: number
    restockType: string
  }>
  transactions: Array<{
    amount: number
    currency: string
    gateway: string
    kind: string
  }>
  totalRefunded: number
  currency: string
}

export interface ShopifyRefundsSummary {
  totalRefunds: number
  totalRefundedAmount: number
  avgRefundAmount: number
  fullyRefundedOrders: number
  partiallyRefundedOrders: number
  restockedCount: number
  notRestockedCount: number
  topRefundedProducts: Array<{ title: string; quantity: number; amount: number }>
  refundsByPeriod: Array<{
    date: string
    count: number
    amount: number
    /** Gross revenue for this period bucket (denominator for refundPct) */
    revenue?: number
    /** Refund amount as a percentage of gross revenue for this period (0–100) */
    refundPct?: number
  }>
  currency: string
}

export interface ShopifyRestockTrendPoint {
  date: string
  restocked: number
  notRestocked: number
}

export interface ShopifyRefundsResponse {
  refunds: ShopifyRefundItem[]
  summary: ShopifyRefundsSummary
  enhancedSummary?: ShopifyRefundEnhancedSummary
  restockTrend?: ShopifyRestockTrendPoint[]
  trendGranularity?: 'day' | 'week' | 'month'
}

// ─── Tag-Based Product Reporting ─────────────────────────

export interface ShopifyTagPerformance {
  tag: string
  grossSales: number
  netSales: number
  unitsSold: number
  orderCount: number
  refundAmount: number
  refundUnits: number
  discountAmount: number
  avgOrderValue: number
  /** Number of unique line items attributed to this tag (for de-duplication tracking) */
  lineItemCount: number
  /** Number of disputes whose originating order contained a product with this tag */
  disputeCount: number
  /** Sum of dispute amounts attributed to this tag */
  disputeAmount: number
  /** Disputes ÷ orders — fraud-prone cohort signal */
  disputeRate: number
  /** Total inventory $ value tied up in products with this tag (unit_cost × on_hand) */
  inventoryValue: number
  /** Total on-hand units across products with this tag */
  inventoryUnits: number
}

export interface ShopifyTagTrendPoint {
  date: string
  tag: string
  grossSales: number
  unitsSold: number
}

export interface ShopifyTagComparisonData {
  tags: string[]
  periods: Array<{
    date: string
    values: Record<string, { grossSales: number; unitsSold: number }>
  }>
}

export interface ShopifyTagReportingSummary {
  totalTags: number
  totalGrossSales: number
  totalNetSales: number
  totalUnitsSold: number
  totalRefundAmount: number
  totalDiscountAmount: number
  /** Total dispute amount across all tagged orders (de-duplicated) */
  totalDisputeAmount: number
  /** Total count of disputes linked to any tagged order (de-duplicated) */
  totalDisputeCount: number
  /** Total inventory $ value across all tagged products */
  totalInventoryValue: number
  /** Total on-hand units across all tagged products (useful when unit_cost is missing) */
  totalInventoryUnits: number
  /** Count of tagged inventory items where unit_cost was null/zero */
  inventoryItemsMissingCost: number
  /**
   * How inventory value was calculated:
   *   cost    — every matched item had unit_cost set (totalInventoryValue is reliable)
   *   partial — some items had cost, some did not (totalInventoryValue undercounts — fall back to units in UI)
   *   none    — no matched items had unit_cost (totalInventoryValue is 0 — UI should show units only)
   */
  inventoryValuationMethod: 'cost' | 'partial' | 'none'
  /** How products with multiple tags are handled */
  attributionMethod: 'full' | 'fractional'
  currency: string
}

/** A product within a tag, with its sales contribution to that tag */
export interface ShopifyTagProduct {
  productId: number
  title: string
  imageUrl?: string | null
  grossSales: number
  unitsSold: number
  orderCount: number
  /** All tags on this product */
  tags: string[]
}

export interface ShopifyTagReportingResponse {
  tags: ShopifyTagPerformance[]
  summary: ShopifyTagReportingSummary
  tagTrend: ShopifyTagTrendPoint[]
  comparison?: ShopifyTagComparisonData
  trendGranularity: 'day' | 'week' | 'month'
  /** All unique tags found across products in the period */
  availableTags: string[]
  /** Products grouped by tag — keyed by tag name */
  productsByTag?: Record<string, ShopifyTagProduct[]>
  warning?: string
}

// ─── Enhanced Refund Analytics ──────────────────────────

export interface ShopifyRefundTimingBucket {
  label: string
  minDays: number
  maxDays: number
  count: number
  amount: number
  percentage: number
}

export interface ShopifyRefundByTag {
  tag: string
  refundCount: number
  refundAmount: number
  refundUnits: number
  refundRate: number
}

/** An exchange detected from refund+new order patterns */
export interface ShopifyExchangeItem {
  orderId: number
  orderName: string
  refundDate: string
  refundedItems: Array<{ title: string; quantity: number; amount: number }>
  /** New order placed within exchange window (if detected) */
  newOrderName?: string
  newOrderDate?: string
  newOrderAmount?: number
}

export interface ShopifyRefundEnhancedSummary {
  /** Refund amount as % of gross revenue */
  refundRateByValue: number
  /** Orders with refunds as % of total orders */
  refundRateByCount: number
  /** Average days from purchase to refund */
  avgDaysToRefund: number
  /** Median days from purchase to refund */
  medianDaysToRefund: number
  /** Distribution across timing buckets */
  timingBuckets: ShopifyRefundTimingBucket[]
  /** Refund metrics broken down by product tag */
  refundsByTag: ShopifyRefundByTag[]
  /** Total gross revenue in the period (denominator for refund rate) */
  totalGrossRevenue: number
  /** Total order count in the period */
  totalOrderCount: number
  /** Estimated monthly returns provision based on refund rate and revenue */
  estimatedMonthlyProvision?: number
  /** 3-month rolling average refund rate for provision calculation */
  rollingRefundRate?: number
  /** Number of exchanges detected (refund + reorder from same customer within 7 days) */
  exchangeCount?: number
  /** Exchange details */
  exchanges?: ShopifyExchangeItem[]
  /** Pure refund count (refunds minus exchanges) */
  pureRefundCount?: number
}

// ─── Disputes / Chargebacks ────────────────────────────

export interface ShopifyDispute {
  id: number
  order_id: number | null
  type: string
  amount: string
  currency: string
  reason: string
  network_reason_code: string | null
  status: string
  evidence_due_by: string | null
  evidence_sent_on: string | null
  finalized_on: string | null
  initiated_at: string
}

export interface ShopifyDisputesSummary {
  totalDisputes: number
  totalDisputedAmount: number
  openDisputes: number
  wonDisputes: number
  lostDisputes: number
  needsResponse: number
  disputesByReason: Array<{ reason: string; count: number; amount: number }>
  disputesByStatus: Array<{ status: string; count: number }>
  currency: string
}

export interface ShopifyDisputeTrendPoint {
  date: string
  count: number
  amount: number
  won: number
  lost: number
}

export interface ShopifyDisputesResponse {
  disputes: ShopifyDispute[]
  summary: ShopifyDisputesSummary
  disputeTrend?: ShopifyDisputeTrendPoint[]
}

// ─── Collections ───────────────────────────────────────

export interface ShopifyCollection {
  id: number
  admin_graphql_api_id: string
  title: string
  handle: string
  body_html: string | null
  sort_order: string
  published_at: string | null
  published_scope: string
  updated_at: string
  image: ShopifyProductImage | null
  products_count?: number
  collection_type: 'smart' | 'custom'
}

export interface ShopifyCollectionsSummary {
  totalCollections: number
  smartCollections: number
  customCollections: number
  publishedCount: number
}

export interface ShopifyCollectionsResponse {
  collections: ShopifyCollection[]
  summary: ShopifyCollectionsSummary
}

// ─── Draft Orders ──────────────────────────────────────

export interface ShopifyDraftOrder {
  id: number
  admin_graphql_api_id: string
  name: string
  status: 'open' | 'invoice_sent' | 'completed'
  created_at: string
  updated_at: string
  completed_at: string | null
  invoice_sent_at: string | null
  currency: string
  total_price: string
  subtotal_price: string
  total_tax: string
  customer: ShopifyOrderCustomer | null
  email: string | null
  note: string | null
  tags: string
  line_items: ShopifyLineItem[]
  invoice_url: string | null
  /** GraphQL-enriched fields (only present when fetched via GraphQL route) */
  ready?: boolean
  visibleToCustomer?: boolean
  totalQuantityOfLineItems?: number
  poNumber?: string | null
  purchasingEntity?: ShopifyDraftOrderPurchasingEntity | null
  paymentTerms?: ShopifyDraftOrderPaymentTerms | null
  isB2B?: boolean
  convertedOrderName?: string | null
}

export interface ShopifyDraftOrdersSummary {
  totalDrafts: number
  openCount: number
  invoiceSentCount: number
  completedCount: number
  totalValue: number
  avgValue: number
  currency: string
  /** Count of drafts flagged ready for checkout */
  readyCount?: number
  /** Count of B2B drafts (have a purchasingEntity) */
  b2bCount?: number
  /** Count of drafts with payment terms set */
  paymentTermsCount?: number
  /** Total line-item quantity across all drafts */
  totalLineItemQty?: number
  /** Breakdown of payment terms types */
  paymentTermsBreakdown?: Array<{ name: string; count: number }>
}

export interface ShopifyDraftOrderTrendPoint {
  date: string
  created: number
  completed: number
  totalValue: number
}

export interface ShopifyDraftOrdersResponse {
  draftOrders: ShopifyDraftOrder[]
  summary: ShopifyDraftOrdersSummary
  draftTrend?: ShopifyDraftOrderTrendPoint[]
}

// ─── Marketing Activities & Events ─────────────────────

export interface ShopifyMarketingActivity {
  id: string
  title: string
  status: string
  tactic: string
  marketingChannelType: string
  adSpend: { amount: string; currencyCode: string } | null
  budget: {
    budgetType: string
  } | null
  createdAt: string
  updatedAt: string
  sourceAndMedium: string
  utmParameters: {
    source: string | null
    medium: string | null
    campaign: string | null
  } | null
  marketingEvent: {
    id: string
    startedAt: string | null
    endedAt: string | null
    remoteId: string | null
  } | null
  app: { title: string } | null
}

export interface ShopifyMarketingEvent {
  id: number
  event_type: string
  marketing_channel: string
  started_at: string | null
  ended_at: string | null
  scheduled_to_end_at: string | null
  budget: string | null
  currency: string | null
  budget_type: string | null
  utm_campaign: string | null
  utm_source: string | null
  utm_medium: string | null
  description: string | null
  marketed_resources: Array<{ type: string; id: number }>
}

export interface ShopifyMarketingSummary {
  totalActivities: number
  activeCount: number
  pausedCount: number
  totalAdSpend: number
  byChannel: Array<{ channel: string; count: number; spend: number }>
  byTactic: Array<{ tactic: string; count: number; spend: number }>
  byStatus: Array<{ status: string; count: number }>
  spendTrend: Array<{ date: string; spend: number; count: number }>
  currency: string
}

export interface ShopifyMarketingResponse {
  activities: ShopifyMarketingActivity[]
  events: ShopifyMarketingEvent[]
  summary: ShopifyMarketingSummary
  warning?: string
}

// ─── Marketing Attribution (ShopifyQL Sessions) ────────

export interface ShopifyMarketingChannelRow {
  channel: string
  type: string
  sessions: number
  orders: number
  totalSales: number
  conversionRate: number
  adSpend?: number
  roas?: number | null
  newCustomers?: number
  returningCustomers?: number
}

export interface ShopifyMarketingAttributionSummary {
  totalSessions: number
  totalOrders: number
  totalSales: number
  conversionRate: number
  currency: string
  totalAdSpend?: number
  roas?: number | null
}

export interface ShopifyMarketingSessionTrend {
  date: string
  channel: string
  sessions: number
}

export interface ShopifyMarketingAttributionResponse {
  summary: ShopifyMarketingAttributionSummary
  channels: ShopifyMarketingChannelRow[]
  sessionsTrend: ShopifyMarketingSessionTrend[]
  warning?: string
}

// ─── Abandoned Checkouts ───────────────────────────────

export interface ShopifyAbandonedCheckout {
  id: number
  abandoned_checkout_url: string | null
  buyer_accepts_marketing: boolean
  buyer_accepts_sms_marketing: boolean
  email: string | null
  phone: string | null
  referring_site: string | null
  landing_site: string | null
  source_name: string | null
  created_at: string
  completed_at: string | null
  updated_at: string
  total_price: string
  subtotal_price: string
  total_discounts: string
  total_tax: string
  currency: string
  customer: ShopifyOrderCustomer | null
  discount_codes: Array<{ code: string; amount: string; type: string }>
  line_items: Array<{
    title: string
    quantity: number
    price: string
    variant_title: string | null
    product_id: number | null
  }>
}

export interface ShopifyAbandonedCheckoutTrendPoint {
  date: string
  abandoned: number
  recovered: number
  totalValue: number
}

export interface ShopifyAbandonedProductItem {
  title: string
  count: number
  totalValue: number
}

export interface ShopifyAbandonedCheckoutsSummary {
  totalAbandoned: number
  totalRecovered: number
  recoveryRate: number
  totalAbandonedValue: number
  avgCartValue: number
  marketingConsentRate: number
  topAbandonedProducts: ShopifyAbandonedProductItem[]
  byReferrer: Array<{ source: string; count: number; value: number }>
  currency: string
}

export interface ShopifyAbandonedCheckoutsResponse {
  checkouts: ShopifyAbandonedCheckout[]
  summary: ShopifyAbandonedCheckoutsSummary
  abandonmentTrend: ShopifyAbandonedCheckoutTrendPoint[]
  warning?: string
}

// ─── Returns (RMA workflow) ────────────────────────────
//
// The Returns page surfaces the *operational* RMA workflow that precedes a
// refund: a return is requested, approved/declined, items are shipped back via
// a reverse fulfillment, and a refund is eventually issued. The Refunds page
// shows the financial event at the end; this fills in the steps before it.

/** Shopify ReturnStatus enum values */
export type ShopifyReturnStatus = 'OPEN' | 'CLOSED' | 'CANCELED' | 'DECLINED' | 'REQUESTED'

/** A line item being returned (subset of Shopify ReturnLineItem) */
export interface ShopifyReturnLineItem {
  id: string
  quantity: number
  /** Shopify enum: SIZE_TOO_LARGE, COLOR, DEFECTIVE, NOT_AS_DESCRIBED, etc. */
  returnReason: string
  returnReasonNote: string | null
  customerNote: string | null
  /** Restocking fee applied (0 if none) */
  restockingFeeAmount: number
  /** Title from the underlying line item, for display in tables */
  title: string
  sku: string | null
  imageUrl: string | null
}

/** A line item being sent out as part of an exchange (subset of ExchangeLineItem) */
export interface ShopifyReturnExchangeLineItem {
  id: string
  quantity: number
  title: string
  sku: string | null
  /** Unit price of the exchange item */
  unitPrice: number
}

/** Reverse fulfillment status for inbound shipping of returned items */
export interface ShopifyReturnReverseFulfillment {
  id: string
  status: string
  /** Carrier tracking number, if a label has been generated */
  trackingNumber: string | null
  trackingUrl: string | null
  trackingCompany: string | null
}

/** A Refund linked to this Return — used to deep-link into the Refunds page */
export interface ShopifyReturnLinkedRefund {
  id: string
  /** Numeric portion of the refund GID, for use in URL params */
  numericId: number
  createdAt: string
  totalRefunded: number
  currency: string
}

export interface ShopifyReturnItem {
  /** Full Shopify GID, e.g. "gid://shopify/Return/123" */
  id: string
  /** Numeric portion, for table keys and URL params */
  numericId: number
  /** Display name, e.g. "#1001-R1" */
  name: string
  status: ShopifyReturnStatus
  createdAt: string
  /** When the return moved to a terminal state (CLOSED/DECLINED/CANCELED) */
  processedAt: string | null
  totalQuantity: number
  /** Reason given when the merchant declined the return (null unless DECLINED) */
  declineReason: string | null
  declineNote: string | null
  /** Source order */
  orderId: number
  orderName: string
  /** Customer who initiated the return */
  customerId: number | null
  customerName: string | null
  customerEmail: string | null
  /** Items being returned */
  returnLineItems: ShopifyReturnLineItem[]
  /** Items going out as exchanges (length > 0 means this is an exchange) */
  exchangeLineItems: ShopifyReturnExchangeLineItem[]
  /** Inbound shipment(s) for the returned items */
  reverseFulfillments: ShopifyReturnReverseFulfillment[]
  /** Linked refunds (deep-link to Refunds page) */
  linkedRefunds: ShopifyReturnLinkedRefund[]
  currency: string
}

/** Aggregated reason breakdown */
export interface ShopifyReturnReasonBucket {
  reason: string
  count: number
  /** Units returned with this reason */
  quantity: number
}

/** Status funnel data point */
export interface ShopifyReturnStatusBucket {
  status: ShopifyReturnStatus
  count: number
}

/** Top returned product */
export interface ShopifyReturnTopProduct {
  title: string
  quantity: number
  /** Number of distinct returns containing this product */
  returnCount: number
}

/** Per-period trend point */
export interface ShopifyReturnTrendPoint {
  date: string
  /** Total returns initiated in this period */
  count: number
  /** Total order count in this period (denominator for return rate) */
  orderCount: number
  /** Return rate as a percentage (0–100) */
  returnRate: number
}

export interface ShopifyReturnsSummary {
  /** Total returns in the period */
  totalReturns: number
  /** Currently open/requested returns (action queue) */
  openCount: number
  /** Returns moved to CLOSED status */
  closedCount: number
  /** Returns the merchant declined */
  declinedCount: number
  /** Returns the customer canceled */
  canceledCount: number
  /** Returns containing exchange line items */
  exchangeCount: number
  /** Total units coming back across all returns */
  totalUnitsReturned: number
  /** Return rate by count: returns ÷ orders × 100 */
  returnRateByCount: number
  /** Total order count in the period (for context / denominator) */
  totalOrderCount: number
  /** Average days from createdAt to processedAt (resolution SLA) */
  avgResolutionDays: number
  /** Median days from createdAt to processedAt */
  medianResolutionDays: number
  /** Decline rate as a percentage */
  declineRate: number
  /** Exchange rate as a percentage */
  exchangeRate: number
  /** Top return reasons by count */
  topReasons: ShopifyReturnReasonBucket[]
  /** Status breakdown for funnel chart */
  statusBuckets: ShopifyReturnStatusBucket[]
  /** Top returned products */
  topProducts: ShopifyReturnTopProduct[]
  /** Per-period count + rate trend */
  returnsByPeriod: ShopifyReturnTrendPoint[]
  currency: string
}

export interface ShopifyReturnsResponse {
  returns: ShopifyReturnItem[]
  summary: ShopifyReturnsSummary
  trendGranularity: 'day' | 'week' | 'month'
  /** Set when the GraphQL query partially failed or hit a cap */
  warning?: string
}

// ─── Fulfillment Operations (GraphQL FulfillmentOrder) ──

export type ShopifyFulfillmentOrderStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'CLOSED'
  | 'CANCELLED'
  | 'INCOMPLETE'
  | 'SCHEDULED'
  | 'ON_HOLD'

export type ShopifyFulfillmentOrderRequestStatus =
  | 'UNSUBMITTED'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLATION_REQUESTED'
  | 'CANCELLATION_ACCEPTED'
  | 'CANCELLATION_REJECTED'
  | 'CLOSED'

export type ShopifyFulfillmentHoldReason =
  | 'AWAITING_PAYMENT'
  | 'AWAITING_RETURN_ITEMS'
  | 'HIGH_RISK_OF_FRAUD'
  | 'INCORRECT_ADDRESS'
  | 'INVENTORY_OUT_OF_STOCK'
  | 'ONLINE_STORE_POST_PURCHASE_CROSS_SELL'
  | 'OTHER'
  | 'UNKNOWN_DELIVERY_DATE'

export type ShopifyDeliveryMethodType =
  | 'SHIPPING'
  | 'LOCAL'
  | 'PICK_UP'
  | 'PICKUP_POINT'
  | 'RETAIL'
  | 'NONE'

export interface ShopifyFulfillmentHold {
  reason: ShopifyFulfillmentHoldReason
  reasonNotes: string | null
  displayReason: string | null
  heldByApp: { name: string } | null
}

export interface ShopifyFulfillmentOrderAssignedLocation {
  name: string | null
  city: string | null
  province: string | null
  countryCode: string | null
  location: { id: string; name: string } | null
}

export interface ShopifyFulfillmentOrderDestination {
  firstName: string | null
  lastName: string | null
  company: string | null
  city: string | null
  province: string | null
  countryCode: string | null
}

export interface ShopifyFulfillmentOrderLineItem {
  id: string
  productTitle: string | null
  variantTitle: string | null
  sku: string | null
  totalQuantity: number
  remainingQuantity: number
  image: { url: string; altText: string | null } | null
  vendor: string | null
}

export interface ShopifyFulfillmentOrderMerchantRequest {
  kind: 'FULFILLMENT_REQUEST' | 'CANCELLATION_REQUEST'
  message: string | null
  sentAt: string
  responseData: any | null
}

export interface ShopifyFulfillmentOrderFulfillment {
  id: string
  status: string
  displayStatus: string | null
  createdAt: string
  deliveredAt: string | null
  estimatedDeliveryAt: string | null
  inTransitAt: string | null
  trackingInfo: ShopifyFulfillmentTrackingInfo[]
}

/** Flattened fulfillment order row for the page table */
export interface ShopifyFulfillmentOrderItem {
  id: string
  status: ShopifyFulfillmentOrderStatus
  requestStatus: ShopifyFulfillmentOrderRequestStatus
  createdAt: string
  updatedAt: string
  fulfillBy: string | null
  fulfillAt: string | null
  orderName: string
  orderId: string
  assignedLocation: string | null
  assignedLocationCity: string | null
  destination: ShopifyFulfillmentOrderDestination | null
  deliveryMethodType: ShopifyDeliveryMethodType | null
  holds: ShopifyFulfillmentHold[]
  lineItems: ShopifyFulfillmentOrderLineItem[]
  totalQuantity: number
  merchantRequests: ShopifyFulfillmentOrderMerchantRequest[]
  fulfillments: ShopifyFulfillmentOrderFulfillment[]
  supportedActions: string[]
  /** Hours from order creation to first fulfillment (null if not yet fulfilled) */
  processingHours: number | null
  /** Whether this order has breached its SLA (fulfillBy passed without fulfillment) */
  slaBreach: boolean
  /** Hours until SLA deadline (negative = overdue) */
  slaHoursRemaining: number | null
}

export interface ShopifyFulfillmentOpsSummary {
  totalFulfillmentOrders: number
  openCount: number
  inProgressCount: number
  onHoldCount: number
  scheduledCount: number
  closedCount: number
  cancelledCount: number
  incompleteCount: number
  /** Orders with a fulfillBy date that was missed */
  slaBreachCount: number
  /** SLA compliance rate (0-100): fulfilled before fulfillBy */
  slaComplianceRate: number
  /** Average hours from FO creation to first fulfillment */
  avgProcessingHours: number
  medianProcessingHours: number
  /** 3PL rejection rate (0-100) */
  rejectionRate: number
  /** Hold rate: % of FOs that went through ON_HOLD (0-100) */
  holdRate: number
  /** Breakdown by hold reason */
  holdReasonBreakdown: Array<{ reason: ShopifyFulfillmentHoldReason; count: number }>
  /** Breakdown by status for pipeline chart */
  statusBreakdown: Array<{ status: ShopifyFulfillmentOrderStatus; count: number }>
  /** Breakdown by delivery method */
  deliveryMethodBreakdown: Array<{ method: ShopifyDeliveryMethodType; count: number }>
  /** Breakdown by assigned location */
  locationBreakdown: Array<{
    location: string
    count: number
    avgProcessingHours: number
    slaBreachCount: number
  }>
  /** Per-period trend */
  trend: ShopifyFulfillmentOpsTrendPoint[]
  currency: string
}

export interface ShopifyFulfillmentOpsTrendPoint {
  date: string
  created: number
  fulfilled: number
  onHold: number
  avgProcessingHours: number
}

export interface ShopifyFulfillmentOpsResponse {
  fulfillmentOrders: ShopifyFulfillmentOrderItem[]
  summary: ShopifyFulfillmentOpsSummary
  trendGranularity: 'day' | 'week' | 'month'
  warning?: string
}
