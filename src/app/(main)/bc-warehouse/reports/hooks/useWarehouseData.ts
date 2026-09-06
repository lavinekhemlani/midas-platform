'use client'

import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'
import { useSession } from '@/contexts/SessionContext'

// Date range filter type (re-exported from useWarehousePnLStatement)
export interface DateRange {
  startDate: string | null // ISO format YYYY-MM-DD
  endDate: string | null // ISO format YYYY-MM-DD
}

// Types for warehouse configuration
export interface WarehouseSchema {
  schema_name: string
  source_type: 'business_central' | 'd365' | 'shopify' | 'meta_ads' | 'amazon' | 'tally' | 'manual'
  display_name: string
  connected_at: number
  last_synced?: number
  tables?: string[]
}

export interface WarehouseConfig {
  enabled: boolean
  schemas: WarehouseSchema[]
  default_schema?: string
}

export interface WarehouseConfigResult {
  success: boolean
  organizationId?: string
  organizationName?: string
  config?: WarehouseConfig
  error?: string
}

// Query result types
export interface QueryResult<T = Record<string, unknown>> {
  success: boolean
  data: T[]
  count: number
  columns: string[]
  totalCount?: number
  schema?: string
  error?: string
}

// P&L specific data types
export interface TrialBalanceRow {
  g_laccount_no: string
  g_laccount_name: string
  total_debits: number
  total_credits: number
  net_balance: number
}

export interface MonthlyPnLRow {
  month: string
  total_debits: number
  total_credits: number
  net_amount: number
}

export interface DocumentTypeRow {
  document_type: string
  transaction_count: number
  total_debits: number
  total_credits: number
}

export interface DepartmentRow {
  department: string
  total_debits: number
  total_credits: number
  net_amount: number
  entries: number
}

export interface CustomerRow {
  sell_to_customer_no: string
  sell_to_customer_name: string
  invoice_count: number
  total_revenue: number
}

export interface MonthlyRevenueRow {
  month: string
  invoice_count: number
  total_revenue: number
}

export interface DataDateRangeRow {
  earliest_date: string
  latest_date: string
  months_of_data: number
  total_entries: number
}

export interface ChartOfAccountRow {
  no: string
  name: string
  account_type: string
  account_category: string
  account_subcategory_descript: string
  debit_credit: string
  blocked: boolean
}

// Fetcher function for warehouse API
async function warehouseFetcher<T>(query: string, schema?: string): Promise<QueryResult<T>> {
  console.log('[warehouseFetcher] Executing query:', {
    query: query.substring(0, 100) + '...',
    schema,
  })

  const response = await fetch('/api/redshift/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, schema }),
  })

  if (!response.ok) {
    // For 403 (schema access denied), return empty result instead of throwing.
    // This prevents SWR from retrying — 403s won't resolve on retry.
    if (response.status === 403) {
      console.warn('[warehouseFetcher] Schema access denied (403) — returning empty result')
      return { success: false, data: [] } as unknown as QueryResult<T>
    }
    console.error('[warehouseFetcher] Query failed:', response.status, response.statusText)
    const err: any = new Error(`Warehouse query failed: ${response.statusText}`)
    err.status = response.status
    throw err
  }

  const result = await response.json()
  console.log('[warehouseFetcher] Query result:', {
    success: result.success,
    dataLength: result.data?.length,
    columns: result.columns,
    error: result.error,
  })

  return result
}

// Config fetcher
async function configFetcher(): Promise<WarehouseConfigResult> {
  console.log('[configFetcher] Fetching warehouse config...')

  const response = await fetch('/api/redshift/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_warehouse_config' }),
  })

  if (!response.ok) {
    // 403 is expected when warehouse is not enabled — return a disabled config
    // instead of throwing, so SWR doesn't retry (403 won't resolve on retry).
    if (response.status === 403) {
      console.warn('[configFetcher] Access denied (403) — returning disabled config')
      return { success: false, config: { enabled: false, schemas: [] }, error: 'Access denied' }
    }
    console.log('[configFetcher] Failed:', response.status, response.statusText)
    throw new Error(`Failed to fetch warehouse config: ${response.statusText}`)
  }

  const result = await response.json()
  console.log('[configFetcher] Config result:', {
    success: result.success,
    organizationId: result.organizationId,
    hasConfig: !!result.config,
    enabled: result.config?.enabled,
    schemasCount: result.config?.schemas?.length,
    error: result.error,
  })

  return result
}

// Hook for warehouse configuration
// Supports ?bc=xxx or legacy ?schema=xxx URL param to override the default schema (for multi-schema BC navigation)
// The optional `enabled` parameter allows callers to skip fetching entirely (e.g., when only BC OAuth is connected)
export function useWarehouseConfig(enabled: boolean = true) {
  const { status } = useSession()
  const searchParams = useSearchParams()
  // Support both new unified ?bc= param and legacy ?schema= param
  const schemaOverride = searchParams.get('bc') || searchParams.get('schema')

  console.log('[useWarehouseConfig] Session status:', status, 'enabled:', enabled)

  // Only fetch if both authenticated AND enabled
  const shouldFetch = enabled && status === 'authenticated'

  const { data, error, isLoading, mutate } = useSWR(
    shouldFetch ? 'warehouse-config' : null,
    configFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  )

  console.log('[useWarehouseConfig] Response:', {
    success: data?.success,
    hasConfig: !!data?.config,
    enabled: data?.config?.enabled,
    schemas: data?.config?.schemas?.map((s: any) => s.schema_name),
    defaultSchema: data?.config?.default_schema,
    schemaOverride,
    error: error?.message || data?.error,
  })

  // Validate default_schema is in the schemas list (may be stale after disconnect)
  const availableSchemas = data?.config?.schemas || []
  const schemaNames = availableSchemas.map((s: any) => s.schema_name)
  const validDefault =
    data?.config?.default_schema && schemaNames.includes(data.config.default_schema)
      ? data.config.default_schema
      : availableSchemas[0]?.schema_name || null

  // URL ?schema= override takes precedence, then validated default, then first available
  const schema = schemaOverride || validDefault

  return {
    config: data?.config || null,
    schema, // The actual schema name to use in queries
    organizationName: data?.organizationName,
    organizationId: data?.organizationId,
    isLoading,
    error,
    mutate,
    isEnabled: data?.success && data?.config?.enabled && availableSchemas.length > 0,
  }
}

// Country code to ISO currency code mapping (ISO 3166-1 alpha-2 → ISO 4217)
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: 'USD',
  CA: 'CAD',
  GB: 'GBP',
  AU: 'AUD',
  NZ: 'NZD',
  NG: 'NGN',
  KE: 'KES',
  GH: 'GHS',
  ZA: 'ZAR',
  TZ: 'TZS',
  UG: 'UGX',
  EG: 'EGP',
  IN: 'INR',
  JP: 'JPY',
  CN: 'CNY',
  HK: 'HKD',
  SG: 'SGD',
  MY: 'MYR',
  PH: 'PHP',
  ID: 'IDR',
  TH: 'THB',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  IE: 'EUR',
  PT: 'EUR',
  FI: 'EUR',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  CH: 'CHF',
  PL: 'PLN',
  BR: 'BRL',
  MX: 'MXN',
  AE: 'AED',
  SA: 'SAR',
  KR: 'KRW',
  TW: 'TWD',
  RU: 'RUB',
}

// Company info type
export interface WarehouseCompanyInfo {
  companyName: string
  countryCode: string
  currencyCode: string
}

// Hook for company information (name + currency derived from country)
export function useWarehouseCompanyInfo(schema: string | null) {
  const query = schema
    ? `SELECT name, country_region_code FROM ${schema}.company_information WHERE _fivetran_deleted = false LIMIT 1`
    : null

  const { data, error, isLoading } = useSWR<
    QueryResult<{ name: string; country_region_code: string }>
  >(
    query ? ['company-info', schema] : null,
    () => warehouseFetcher<{ name: string; country_region_code: string }>(query!),
    { revalidateOnFocus: false, dedupingInterval: 300000 } // Cache 5 min — rarely changes
  )

  const companyInfo: WarehouseCompanyInfo | null = data?.data?.[0]
    ? {
        companyName: data.data[0].name || '',
        countryCode: data.data[0].country_region_code || '',
        currencyCode:
          COUNTRY_TO_CURRENCY[data.data[0].country_region_code?.toUpperCase() || ''] || 'USD',
      }
    : null

  return { data: companyInfo, isLoading, error }
}

// Hook for trial balance data
export function useTrialBalance(schema: string | null, dateRange?: DateRange) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND posting_date >= '${dateRange.startDate}' AND posting_date <= '${dateRange.endDate}'`
      : ''

  const query = schema
    ? `SELECT g_laccount_no, g_laccount_name, SUM(debit_amount) AS total_debits, SUM(credit_amount) AS total_credits, SUM(amount) AS net_balance FROM ${schema}.g_l_entry WHERE _fivetran_deleted = false AND reversed = false ${dateFilter} GROUP BY g_laccount_no, g_laccount_name ORDER BY g_laccount_no`
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<TrialBalanceRow>>(
    query ? ['trial-balance', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher<TrialBalanceRow>(query!),
    { revalidateOnFocus: false }
  )

  return {
    data: data?.data || [],
    isLoading,
    error,
    mutate,
  }
}

// Hook for monthly P&L trend
export function useMonthlyPnL(schema: string | null, dateRange?: DateRange) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND posting_date >= '${dateRange.startDate}' AND posting_date <= '${dateRange.endDate}'`
      : ''

  const query = schema
    ? `SELECT DATE_TRUNC('month', posting_date) AS month, SUM(debit_amount) AS total_debits, SUM(credit_amount) AS total_credits, SUM(amount) AS net_amount FROM ${schema}.g_l_entry WHERE _fivetran_deleted = false AND reversed = false ${dateFilter} GROUP BY DATE_TRUNC('month', posting_date) ORDER BY month DESC LIMIT 24`
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<MonthlyPnLRow>>(
    query ? ['monthly-pnl', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher<MonthlyPnLRow>(query!),
    { revalidateOnFocus: false }
  )

  return {
    data: data?.data || [],
    isLoading,
    error,
    mutate,
  }
}

// Monthly P&L trend data type (revenue/cogs/expenses per month)
export interface MonthlyPnLTrendRow {
  month: string
  revenue: number
  cogs: number
  expenses: number
  net_income: number
}

// Hook for monthly P&L trend broken down by account category
export function useWarehouseMonthlyPnLTrend(schema: string | null, dateRange?: DateRange) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND e.posting_date >= '${dateRange.startDate}' AND e.posting_date <= '${dateRange.endDate}'`
      : ''

  const query = schema
    ? `
    SELECT
      DATE_TRUNC('month', e.posting_date) AS month,
      SUM(CASE WHEN a.account_category = 'Income'
           THEN e.credit_amount - e.debit_amount ELSE 0 END) AS revenue,
      SUM(CASE WHEN a.account_category = 'Cost_x0020_of_x0020_Goods_x0020_Sold'
           THEN e.debit_amount - e.credit_amount ELSE 0 END) AS cogs,
      SUM(CASE WHEN a.account_category = 'Expense'
           THEN e.debit_amount - e.credit_amount ELSE 0 END) AS expenses,
      SUM(CASE WHEN a.account_category = 'Income'
           THEN e.credit_amount - e.debit_amount ELSE 0 END)
      - SUM(CASE WHEN a.account_category = 'Cost_x0020_of_x0020_Goods_x0020_Sold'
             THEN e.debit_amount - e.credit_amount ELSE 0 END)
      - SUM(CASE WHEN a.account_category = 'Expense'
             THEN e.debit_amount - e.credit_amount ELSE 0 END) AS net_income
    FROM ${schema}.g_l_entry e
    JOIN ${schema}.g_l_account a
      ON e.g_laccount_no = a.no
      AND e.company_id = a.company_id
    WHERE e._fivetran_deleted = false
      AND e.reversed = false
      AND a._fivetran_deleted = false
      AND a.account_type = 'Posting'
      AND a.account_category IN ('Income', 'Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
      ${dateFilter}
    GROUP BY DATE_TRUNC('month', e.posting_date)
    ORDER BY month ASC
    LIMIT 24
  `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<MonthlyPnLTrendRow>>(
    query ? ['monthly-pnl-trend', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher<MonthlyPnLTrendRow>(query!),
    { revalidateOnFocus: false }
  )

  return {
    data: data?.data || [],
    isLoading,
    error,
    mutate,
  }
}

// Hook for document type breakdown
export function useDocumentTypeBreakdown(schema: string | null, dateRange?: DateRange) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND posting_date >= '${dateRange.startDate}' AND posting_date <= '${dateRange.endDate}'`
      : ''

  const query = schema
    ? `SELECT document_type, COUNT(*) AS transaction_count, SUM(debit_amount) AS total_debits, SUM(credit_amount) AS total_credits FROM ${schema}.g_l_entry WHERE _fivetran_deleted = false AND reversed = false ${dateFilter} GROUP BY document_type ORDER BY transaction_count DESC`
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<DocumentTypeRow>>(
    query ? ['document-type', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher<DocumentTypeRow>(query!),
    { revalidateOnFocus: false }
  )

  return {
    data: data?.data || [],
    isLoading,
    error,
    mutate,
  }
}

// Hook for department breakdown
export function useDepartmentBreakdown(schema: string | null, dateRange?: DateRange) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND posting_date >= '${dateRange.startDate}' AND posting_date <= '${dateRange.endDate}'`
      : ''

  const query = schema
    ? `SELECT global_dimension_1_code AS department, SUM(debit_amount) AS total_debits, SUM(credit_amount) AS total_credits, SUM(amount) AS net_amount, COUNT(*) AS entries FROM ${schema}.g_l_entry WHERE _fivetran_deleted = false AND reversed = false AND global_dimension_1_code IS NOT NULL AND global_dimension_1_code != '' ${dateFilter} GROUP BY global_dimension_1_code ORDER BY net_amount DESC LIMIT 20`
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<DepartmentRow>>(
    query ? ['department', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher<DepartmentRow>(query!),
    { revalidateOnFocus: false }
  )

  return {
    data: data?.data || [],
    isLoading,
    error,
    mutate,
  }
}

// Hook for top customers
export function useTopCustomers(schema: string | null, dateRange?: DateRange) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND h.posting_date >= '${dateRange.startDate}' AND h.posting_date <= '${dateRange.endDate}'`
      : ''

  const query = schema
    ? `SELECT h.sell_to_customer_no, h.sell_to_customer_name, COUNT(*) AS invoice_count, SUM(l.amount) AS total_revenue FROM ${schema}.sales_invoice_header h JOIN ${schema}.sales_invoice_line l ON h.no = l.document_no AND h.company_id = l.company_id WHERE h._fivetran_deleted = false AND l._fivetran_deleted = false ${dateFilter} GROUP BY h.sell_to_customer_no, h.sell_to_customer_name ORDER BY total_revenue DESC LIMIT 10`
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<CustomerRow>>(
    query ? ['top-customers', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher<CustomerRow>(query!),
    { revalidateOnFocus: false }
  )

  return {
    data: data?.data || [],
    isLoading,
    error,
    mutate,
  }
}

// Hook for monthly revenue trend
export function useMonthlyRevenue(schema: string | null, dateRange?: DateRange) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND h.posting_date >= '${dateRange.startDate}' AND h.posting_date <= '${dateRange.endDate}'`
      : ''

  const query = schema
    ? `SELECT DATE_TRUNC('month', h.posting_date) AS month, COUNT(DISTINCT h.no) AS invoice_count, SUM(l.amount) AS total_revenue FROM ${schema}.sales_invoice_header h JOIN ${schema}.sales_invoice_line l ON h.no = l.document_no AND h.company_id = l.company_id WHERE h._fivetran_deleted = false AND l._fivetran_deleted = false ${dateFilter} GROUP BY DATE_TRUNC('month', h.posting_date) ORDER BY month DESC LIMIT 24`
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<MonthlyRevenueRow>>(
    query ? ['monthly-revenue', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher<MonthlyRevenueRow>(query!),
    { revalidateOnFocus: false }
  )

  return {
    data: data?.data || [],
    isLoading,
    error,
    mutate,
  }
}

// Hook for data date range
export function useDataDateRange(schema: string | null) {
  const query = schema
    ? `SELECT MIN(posting_date) AS earliest_date, MAX(posting_date) AS latest_date, COUNT(DISTINCT DATE_TRUNC('month', posting_date)) AS months_of_data, COUNT(*) AS total_entries FROM ${schema}.g_l_entry WHERE _fivetran_deleted = false AND reversed = false`
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<DataDateRangeRow>>(
    query ? ['data-range', schema] : null,
    () => warehouseFetcher<DataDateRangeRow>(query!),
    { revalidateOnFocus: false }
  )

  return {
    data: data?.data?.[0] || null,
    isLoading,
    error,
    mutate,
  }
}

// Hook for chart of accounts
export function useChartOfAccounts(schema: string | null) {
  const query = schema
    ? `SELECT no, name, REPLACE(REPLACE(account_type, '_x002D_', '-'), '_x0020_', ' ') AS account_type, REPLACE(REPLACE(account_category, '_x0020_', ' '), '_x002D_', '-') AS account_category, account_subcategory_descript, debit_credit, blocked FROM ${schema}.g_l_account WHERE _fivetran_deleted = false ORDER BY no`
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<ChartOfAccountRow>>(
    query ? ['chart-of-accounts', schema] : null,
    () => warehouseFetcher<ChartOfAccountRow>(query!),
    { revalidateOnFocus: false }
  )

  return {
    data: data?.data || [],
    isLoading,
    error,
    mutate,
  }
}

// --- Dashboard card hooks ---

// Accounts Receivable / Payable summary
export interface ARAPSummary {
  customer_count: number
  total_ar: number
  ar_overdue: number
  vendor_count: number
  total_ap: number
}

export function useWarehouseARAP(schema: string | null) {
  const query = schema
    ? `
    SELECT
      (SELECT COUNT(*) FROM ${schema}.customer WHERE _fivetran_deleted = false) AS customer_count,
      (SELECT COALESCE(SUM(balance_lcy), 0) FROM ${schema}.customer WHERE _fivetran_deleted = false AND balance_lcy > 0) AS total_ar,
      (SELECT COALESCE(SUM(balance_due_lcy), 0) FROM ${schema}.customer WHERE _fivetran_deleted = false AND balance_due_lcy > 0) AS ar_overdue,
      (SELECT COUNT(*) FROM ${schema}.vendor WHERE _fivetran_deleted = false) AS vendor_count,
      (SELECT COALESCE(SUM(balance_lcy), 0) FROM ${schema}.vendor WHERE _fivetran_deleted = false AND balance_lcy > 0) AS total_ap
  `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<ARAPSummary>>(
    query ? ['arap-summary', schema] : null,
    () => warehouseFetcher<ARAPSummary>(query!),
    { revalidateOnFocus: false }
  )

  return { data: data?.data?.[0] || null, isLoading, error, mutate }
}

// Cash position (bank account balances)
export interface BankAccountRow {
  no: string
  name: string
  balance_lcy: number
  currency_code: string
}

export function useWarehouseBankAccounts(schema: string | null) {
  const query = schema
    ? `SELECT no, name, balance_lcy, currency_code
       FROM ${schema}.bank_account
       WHERE _fivetran_deleted = false AND balance_lcy != 0
       ORDER BY balance_lcy DESC
       LIMIT 10`
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<BankAccountRow>>(
    query ? ['bank-accounts', schema] : null,
    () => warehouseFetcher<BankAccountRow>(query!),
    { revalidateOnFocus: false }
  )

  const totalCash = (data?.data || []).reduce((sum, b) => sum + Number(b.balance_lcy), 0)

  return { data: data?.data || [], totalCash, isLoading, error, mutate }
}

// Top customers by revenue (from sales invoices)
export interface TopCustomerRow {
  name: string
  total_revenue: number
  invoice_count: number
}

export function useWarehouseTopCustomers(schema: string | null, dateRange?: DateRange) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND h.posting_date >= '${dateRange.startDate}' AND h.posting_date <= '${dateRange.endDate}'`
      : ''

  const query = schema
    ? `SELECT h.sell_to_customer_name AS name,
              COUNT(DISTINCT h.no) AS invoice_count,
              SUM(l.amount) AS total_revenue
       FROM ${schema}.sales_invoice_header h
       JOIN ${schema}.sales_invoice_line l ON h.no = l.document_no AND h.company_id = l.company_id
       WHERE h._fivetran_deleted = false AND l._fivetran_deleted = false
         ${dateFilter}
       GROUP BY h.sell_to_customer_name
       ORDER BY total_revenue DESC
       LIMIT 5`
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<TopCustomerRow>>(
    query ? ['top-customers-dashboard', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher<TopCustomerRow>(query!),
    { revalidateOnFocus: false }
  )

  return { data: data?.data || [], isLoading, error, mutate }
}

// --- New Dashboard Hooks ---

// Aged Receivables by bucket
export interface AgedReceivablesRow {
  customer_no: string
  customer_name: string
  current_amount: number
  days_1_30: number
  days_31_60: number
  days_61_90: number
  days_over_90: number
  total_outstanding: number
}

export interface AgedReceivablesSummary {
  current: number
  days_1_30: number
  days_31_60: number
  days_61_90: number
  days_over_90: number
  total: number
  customer_count: number
}

export function useWarehouseAgedReceivables(schema: string | null) {
  // Simplified query using customer table's balance fields
  // BC stores balance_lcy (total outstanding) and balance_due_lcy (overdue portion)
  // We approximate aging buckets: current = balance - overdue, overdue goes to 90+
  // For more accurate aging, the cust_ledger_entry table would need to be explored
  const query = schema
    ? `
    SELECT
      c.no AS customer_no,
      c.name AS customer_name,
      GREATEST(COALESCE(c.balance_lcy, 0) - COALESCE(c.balance_due_lcy, 0), 0) AS current_amount,
      0 AS days_1_30,
      0 AS days_31_60,
      0 AS days_61_90,
      COALESCE(c.balance_due_lcy, 0) AS days_over_90,
      COALESCE(c.balance_lcy, 0) AS total_outstanding
    FROM ${schema}.customer c
    WHERE c._fivetran_deleted = false
      AND c.balance_lcy > 0
    ORDER BY c.balance_lcy DESC
    LIMIT 50
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<AgedReceivablesRow>>(
    query ? ['aged-receivables', schema] : null,
    () => warehouseFetcher<AgedReceivablesRow>(query!),
    { revalidateOnFocus: false }
  )

  // Calculate summary
  const summary: AgedReceivablesSummary | null = data?.data
    ? {
        current: data.data.reduce((sum, r) => sum + Number(r.current_amount), 0),
        days_1_30: data.data.reduce((sum, r) => sum + Number(r.days_1_30), 0),
        days_31_60: data.data.reduce((sum, r) => sum + Number(r.days_31_60), 0),
        days_61_90: data.data.reduce((sum, r) => sum + Number(r.days_61_90), 0),
        days_over_90: data.data.reduce((sum, r) => sum + Number(r.days_over_90), 0),
        total: data.data.reduce((sum, r) => sum + Number(r.total_outstanding), 0),
        customer_count: data.data.length,
      }
    : null

  return { data: data?.data || [], summary, isLoading, error, mutate }
}

// Aged Payables by bucket
export interface AgedPayablesRow {
  vendor_no: string
  vendor_name: string
  current_amount: number
  days_1_30: number
  days_31_60: number
  days_61_90: number
  days_over_90: number
  total_outstanding: number
}

export interface AgedPayablesSummary {
  current: number
  days_1_30: number
  days_31_60: number
  days_61_90: number
  days_over_90: number
  total: number
  vendor_count: number
}

export function useWarehouseAgedPayables(schema: string | null) {
  // Simplified query using vendor table's balance fields
  // BC stores balance_lcy (total outstanding) - for vendors this is typically negative or we use ABS
  // We approximate: current = balance (non-overdue), overdue goes to 90+
  // Note: vendor balance_lcy is often stored as positive in BC even though it's a liability
  const query = schema
    ? `
    SELECT
      v.no AS vendor_no,
      v.name AS vendor_name,
      GREATEST(ABS(COALESCE(v.balance_lcy, 0)) - ABS(COALESCE(v.balance_due_lcy, 0)), 0) AS current_amount,
      0 AS days_1_30,
      0 AS days_31_60,
      0 AS days_61_90,
      ABS(COALESCE(v.balance_due_lcy, 0)) AS days_over_90,
      ABS(COALESCE(v.balance_lcy, 0)) AS total_outstanding
    FROM ${schema}.vendor v
    WHERE v._fivetran_deleted = false
      AND v.balance_lcy != 0
    ORDER BY ABS(v.balance_lcy) DESC
    LIMIT 50
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<AgedPayablesRow>>(
    query ? ['aged-payables', schema] : null,
    () => warehouseFetcher<AgedPayablesRow>(query!),
    { revalidateOnFocus: false }
  )

  // Calculate summary
  const summary: AgedPayablesSummary | null = data?.data
    ? {
        current: data.data.reduce((sum, r) => sum + Number(r.current_amount), 0),
        days_1_30: data.data.reduce((sum, r) => sum + Number(r.days_1_30), 0),
        days_31_60: data.data.reduce((sum, r) => sum + Number(r.days_31_60), 0),
        days_61_90: data.data.reduce((sum, r) => sum + Number(r.days_61_90), 0),
        days_over_90: data.data.reduce((sum, r) => sum + Number(r.days_over_90), 0),
        total: data.data.reduce((sum, r) => sum + Number(r.total_outstanding), 0),
        vendor_count: data.data.length,
      }
    : null

  return { data: data?.data || [], summary, isLoading, error, mutate }
}

// Top Vendors by spend
export interface TopVendorRow {
  vendor_no: string
  vendor_name: string
  invoice_count: number
  total_spend: number
}

export function useWarehouseTopVendors(
  schema: string | null,
  dateRange?: DateRange,
  limit: number = 5
) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND h.posting_date >= '${dateRange.startDate}' AND h.posting_date <= '${dateRange.endDate}'`
      : ''

  const query = schema
    ? `
    SELECT
      h.buy_from_vendor_no AS vendor_no,
      h.buy_from_vendor_name AS vendor_name,
      COUNT(DISTINCT h.no) AS invoice_count,
      SUM(l.amount) AS total_spend
    FROM ${schema}.purch_inv_header h
    JOIN ${schema}.purch_inv_line l
      ON h.no = l.document_no
      AND h.company_id = l.company_id
    WHERE h._fivetran_deleted = false
      AND l._fivetran_deleted = false
      ${dateFilter}
    GROUP BY h.buy_from_vendor_no, h.buy_from_vendor_name
    ORDER BY total_spend DESC
    LIMIT ${limit}
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<TopVendorRow>>(
    query ? ['top-vendors', schema, dateRange?.startDate, dateRange?.endDate, limit] : null,
    () => warehouseFetcher<TopVendorRow>(query!),
    { revalidateOnFocus: false }
  )

  return { data: data?.data || [], isLoading, error, mutate }
}

// Financial Ratios from Balance Sheet
export interface FinancialRatios {
  currentRatio: number | null
  quickRatio: number | null
  debtToEquity: number | null
  workingCapital: number
  grossMargin: number | null
  netMargin: number | null
  operatingMargin: number | null
  /** Underlying component values for tooltip formula breakdowns */
  currentAssets?: number
  currentLiabilities?: number
  inventory?: number
  totalLiabilities?: number
  totalEquity?: number
}

// Non-current subcategory patterns (everything else is treated as current)
const NON_CURRENT_ASSET_RE =
  /non.?current|property|plant|equipment|intangible|depreciation|amortization|long.?term|fixed.?asset/i
const NON_CURRENT_LIABILITY_RE = /non.?current|long.?term|pension|deferred|employee.?end/i
const INVENTORY_RE = /inventor/i

/**
 * Derive financial ratios from balance sheet data (industry standard).
 * Professional approach: single source of truth from the BS, not a separate query.
 *
 * - Current Ratio = Current Assets / Current Liabilities
 * - Quick Ratio  = (Current Assets − Inventories) / Current Liabilities
 * - Debt/Equity  = Total Liabilities / Total Equity (equity already includes Profit for the Period)
 * - Working Capital = Current Assets − Current Liabilities
 */
export function computeRatiosFromBalanceSheet(bsData: {
  assetGroups: Record<string, { total_debits: number; total_credits: number }[]>
  liabilityGroups: Record<string, { total_debits: number; total_credits: number }[]>
  totals: { totalAssets: number; totalLiabilities: number; totalEquity: number }
}): FinancialRatios {
  // Classify asset subcategories into current vs non-current
  let nonCurrentAssets = 0
  let inventoryTotal = 0

  for (const [subcat, accounts] of Object.entries(bsData.assetGroups)) {
    const groupTotal = accounts.reduce(
      (sum, acc) => sum + (acc.total_debits - acc.total_credits),
      0
    )
    if (NON_CURRENT_ASSET_RE.test(subcat)) {
      nonCurrentAssets += groupTotal
    }
    if (INVENTORY_RE.test(subcat)) {
      inventoryTotal += groupTotal
    }
  }
  const currentAssets = bsData.totals.totalAssets - nonCurrentAssets

  // Classify liability subcategories into current vs non-current
  let nonCurrentLiabilities = 0
  for (const [subcat, accounts] of Object.entries(bsData.liabilityGroups)) {
    const groupTotal = accounts.reduce(
      (sum, acc) => sum + (acc.total_credits - acc.total_debits),
      0
    )
    if (NON_CURRENT_LIABILITY_RE.test(subcat)) {
      nonCurrentLiabilities += groupTotal
    }
  }
  const currentLiabilities = bsData.totals.totalLiabilities - nonCurrentLiabilities

  return {
    currentRatio: currentLiabilities !== 0 ? currentAssets / currentLiabilities : null,
    quickRatio:
      currentLiabilities !== 0 ? (currentAssets - inventoryTotal) / currentLiabilities : null,
    debtToEquity:
      bsData.totals.totalEquity !== 0
        ? bsData.totals.totalLiabilities / bsData.totals.totalEquity
        : null,
    workingCapital: currentAssets - currentLiabilities,
    grossMargin: null,
    netMargin: null,
    operatingMargin: null,
    currentAssets,
    currentLiabilities,
    inventory: inventoryTotal,
    totalLiabilities: bsData.totals.totalLiabilities,
    totalEquity: bsData.totals.totalEquity,
  }
}

export function useWarehouseFinancialRatios(schema: string | null) {
  // Query for current assets and current liabilities
  const query = schema
    ? `
    SELECT
      COALESCE(SUM(CASE
        WHEN a.account_category = 'Assets'
        AND (a.account_subcategory_descript ILIKE '%current%' OR a.account_subcategory_descript ILIKE '%cash%' OR a.account_subcategory_descript ILIKE '%receivable%' OR a.account_subcategory_descript ILIKE '%inventory%')
        THEN e.debit_amount - e.credit_amount
        ELSE 0
      END), 0) AS current_assets,
      COALESCE(SUM(CASE
        WHEN a.account_category = 'Assets'
        AND (a.account_subcategory_descript ILIKE '%cash%' OR a.account_subcategory_descript ILIKE '%receivable%')
        THEN e.debit_amount - e.credit_amount
        ELSE 0
      END), 0) AS quick_assets,
      COALESCE(SUM(CASE
        WHEN a.account_category = 'Liabilities'
        AND (a.account_subcategory_descript ILIKE '%current%' OR a.account_subcategory_descript ILIKE '%payable%' OR a.account_subcategory_descript ILIKE '%accrued%')
        THEN e.credit_amount - e.debit_amount
        ELSE 0
      END), 0) AS current_liabilities,
      COALESCE(SUM(CASE
        WHEN a.account_category = 'Liabilities'
        THEN e.credit_amount - e.debit_amount
        ELSE 0
      END), 0) AS total_liabilities,
      COALESCE(SUM(CASE
        WHEN a.account_category = 'Equity'
        THEN e.credit_amount - e.debit_amount
        ELSE 0
      END), 0) AS total_equity
    FROM ${schema}.g_l_entry e
    JOIN ${schema}.g_l_account a
      ON e.g_laccount_no = a.no
      AND e.company_id = a.company_id
    WHERE e._fivetran_deleted = false
      AND e.reversed = false
      AND a._fivetran_deleted = false
      AND a.account_type = 'Posting'
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<
    QueryResult<{
      current_assets: number
      quick_assets: number
      current_liabilities: number
      total_liabilities: number
      total_equity: number
    }>
  >(query ? ['financial-ratios', schema] : null, () => warehouseFetcher(query!), {
    revalidateOnFocus: false,
  })

  const ratios: FinancialRatios | null = data?.data?.[0]
    ? {
        currentRatio:
          data.data[0].current_liabilities !== 0
            ? data.data[0].current_assets / data.data[0].current_liabilities
            : null,
        quickRatio:
          data.data[0].current_liabilities !== 0
            ? data.data[0].quick_assets / data.data[0].current_liabilities
            : null,
        debtToEquity:
          data.data[0].total_equity !== 0
            ? data.data[0].total_liabilities / data.data[0].total_equity
            : null,
        workingCapital: data.data[0].current_assets - data.data[0].current_liabilities,
        grossMargin: null, // Set from P&L data
        netMargin: null,
        operatingMargin: null,
      }
    : null

  return { data: ratios, isLoading, error, mutate }
}

// --- NEW HIGH-PRIORITY HOOKS ---

// Inventory Summary Data
export interface InventorySummary {
  item_count: number
  total_inventory_value: number
  total_cost: number
  items_with_stock: number
}

export interface InventoryItem {
  item_no: string
  description: string
  inventory: number
  unit_cost: number
  inventory_value: number
  sales_qty: number
  purchases_qty: number
}

export function useWarehouseInventory(schema: string | null) {
  const query = schema
    ? `
    SELECT
      no AS item_no,
      description,
      COALESCE(inventory, 0) AS inventory,
      COALESCE(unit_cost, 0) AS unit_cost,
      COALESCE(inventory, 0) * COALESCE(unit_cost, 0) AS inventory_value,
      COALESCE(sales_qty, 0) AS sales_qty,
      COALESCE(purchases_qty, 0) AS purchases_qty
    FROM ${schema}.item
    WHERE _fivetran_deleted = false
      AND inventory > 0
    ORDER BY inventory * unit_cost DESC
    LIMIT 50
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<InventoryItem>>(
    query ? ['inventory-items', schema] : null,
    () => warehouseFetcher<InventoryItem>(query!),
    { revalidateOnFocus: false }
  )

  // Calculate summary
  const summary: InventorySummary | null = data?.data
    ? {
        item_count: data.data.length,
        total_inventory_value: data.data.reduce((sum, i) => sum + Number(i.inventory_value), 0),
        total_cost: data.data.reduce(
          (sum, i) => sum + Number(i.unit_cost) * Number(i.inventory),
          0
        ),
        items_with_stock: data.data.filter((i) => Number(i.inventory) > 0).length,
      }
    : null

  return { data: data?.data || [], summary, isLoading, error, mutate }
}

// Cash Runway & Burn Rate
export interface CashRunwayData {
  totalCash: number
  monthlyExpenses: number
  monthlyRevenue: number
  grossBurnRate: number // Monthly expenses
  netBurnRate: number // Monthly expenses - revenue (if negative = burning)
  cashRunwayMonths: number | null // Months until cash runs out
  avgMonthlyNetIncome: number
}

export function useWarehouseCashRunway(
  schema: string | null,
  totalCash: number,
  dateRange?: DateRange
) {
  // Get last 6 months of P&L data to calculate average burn rate
  const query = schema
    ? `
    SELECT
      SUM(CASE WHEN a.account_category = 'Income'
           THEN e.credit_amount - e.debit_amount ELSE 0 END) AS total_revenue,
      SUM(CASE WHEN a.account_category IN ('Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
           THEN e.debit_amount - e.credit_amount ELSE 0 END) AS total_expenses,
      COUNT(DISTINCT DATE_TRUNC('month', e.posting_date)) AS months_count
    FROM ${schema}.g_l_entry e
    JOIN ${schema}.g_l_account a
      ON e.g_laccount_no = a.no
      AND e.company_id = a.company_id
    WHERE e._fivetran_deleted = false
      AND e.reversed = false
      AND a._fivetran_deleted = false
      AND a.account_type = 'Posting'
      AND a.account_category IN ('Income', 'Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
      AND e.posting_date >= CURRENT_DATE - INTERVAL '6 months'
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<
    QueryResult<{ total_revenue: number; total_expenses: number; months_count: number }>
  >(query ? ['cash-runway', schema] : null, () => warehouseFetcher(query!), {
    revalidateOnFocus: false,
  })

  const runwayData: CashRunwayData | null = data?.data?.[0]
    ? (() => {
        const months = Math.max(Number(data.data[0].months_count) || 1, 1)
        const totalRevenue = Number(data.data[0].total_revenue) || 0
        const totalExpenses = Number(data.data[0].total_expenses) || 0
        const monthlyRevenue = totalRevenue / months
        const monthlyExpenses = totalExpenses / months
        const grossBurnRate = monthlyExpenses
        const netBurnRate = monthlyExpenses - monthlyRevenue // Positive = burning cash
        const avgMonthlyNetIncome = monthlyRevenue - monthlyExpenses

        // Cash runway = Cash / Net Burn Rate (only if burning cash)
        let cashRunwayMonths: number | null = null
        if (netBurnRate > 0 && totalCash > 0) {
          cashRunwayMonths = totalCash / netBurnRate
        } else if (netBurnRate <= 0) {
          cashRunwayMonths = null // Not burning cash, infinite runway
        }

        return {
          totalCash,
          monthlyExpenses,
          monthlyRevenue,
          grossBurnRate,
          netBurnRate,
          cashRunwayMonths,
          avgMonthlyNetIncome,
        }
      })()
    : null

  return { data: runwayData, isLoading, error, mutate }
}

// DSO / DPO / Efficiency Metrics
export interface EfficiencyMetrics {
  dso: number | null // Days Sales Outstanding
  dpo: number | null // Days Payable Outstanding
  inventoryTurnover: number | null // COGS / Average Inventory
  cashConversionCycle: number | null // DSO - DPO (simplified)
  arTurnover: number | null // Revenue / AR
  apTurnover: number | null // COGS / AP
  _components?: {
    totalAR: number
    totalAP: number
    annualizedRevenue: number
    annualizedCOGS: number
    inventoryBalance: number
  }
}

export function useWarehouseEfficiencyMetrics(schema: string | null, dateRange?: DateRange) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND e.posting_date >= '${dateRange.startDate}' AND e.posting_date <= '${dateRange.endDate}'`
      : `AND e.posting_date >= CURRENT_DATE - INTERVAL '12 months'`

  const query = schema
    ? `
    SELECT
      -- Revenue (last 12 months or date range)
      (SELECT COALESCE(SUM(e.credit_amount - e.debit_amount), 0)
       FROM ${schema}.g_l_entry e
       JOIN ${schema}.g_l_account a ON e.g_laccount_no = a.no AND e.company_id = a.company_id
       WHERE e._fivetran_deleted = false AND e.reversed = false
         AND a._fivetran_deleted = false AND a.account_type = 'Posting'
         AND a.account_category = 'Income'
         ${dateFilter}) AS annual_revenue,

      -- COGS (last 12 months or date range)
      (SELECT COALESCE(SUM(e.debit_amount - e.credit_amount), 0)
       FROM ${schema}.g_l_entry e
       JOIN ${schema}.g_l_account a ON e.g_laccount_no = a.no AND e.company_id = a.company_id
       WHERE e._fivetran_deleted = false AND e.reversed = false
         AND a._fivetran_deleted = false AND a.account_type = 'Posting'
         AND a.account_category = 'Cost_x0020_of_x0020_Goods_x0020_Sold'
         ${dateFilter}) AS annual_cogs,

      -- Total AR (current balance)
      (SELECT COALESCE(SUM(balance_lcy), 0)
       FROM ${schema}.customer
       WHERE _fivetran_deleted = false AND balance_lcy > 0) AS total_ar,

      -- Total AP (current balance)
      (SELECT COALESCE(SUM(ABS(balance_lcy)), 0)
       FROM ${schema}.vendor
       WHERE _fivetran_deleted = false AND balance_lcy != 0) AS total_ap,

      -- Total Inventory Value
      (SELECT COALESCE(SUM(inventory * unit_cost), 0)
       FROM ${schema}.item
       WHERE _fivetran_deleted = false AND inventory > 0) AS total_inventory
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<
    QueryResult<{
      annual_revenue: number
      annual_cogs: number
      total_ar: number
      total_ap: number
      total_inventory: number
    }>
  >(
    query ? ['efficiency-metrics', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher(query!),
    { revalidateOnFocus: false }
  )

  const metrics: EfficiencyMetrics | null = data?.data?.[0]
    ? (() => {
        const annualRevenue = Number(data.data[0].annual_revenue) || 0
        const annualCogs = Number(data.data[0].annual_cogs) || 0
        const totalAR = Number(data.data[0].total_ar) || 0
        const totalAP = Number(data.data[0].total_ap) || 0
        const totalInventory = Number(data.data[0].total_inventory) || 0

        // Daily revenue/cogs (assuming 365 days)
        const dailyRevenue = annualRevenue / 365
        const dailyCogs = annualCogs / 365

        // DSO = (AR / Annual Revenue) * 365
        const dso = dailyRevenue > 0 ? totalAR / dailyRevenue : null

        // DPO = (AP / Annual COGS) * 365
        const dpo = dailyCogs > 0 ? totalAP / dailyCogs : null

        // Inventory Turnover = COGS / Inventory
        const inventoryTurnover = totalInventory > 0 ? annualCogs / totalInventory : null

        // Cash Conversion Cycle = DSO - DPO (simplified, no DIO)
        const cashConversionCycle = dso !== null && dpo !== null ? dso - dpo : null

        // AR Turnover = Revenue / AR
        const arTurnover = totalAR > 0 ? annualRevenue / totalAR : null

        // AP Turnover = COGS / AP
        const apTurnover = totalAP > 0 ? annualCogs / totalAP : null

        return {
          dso,
          dpo,
          inventoryTurnover,
          cashConversionCycle,
          arTurnover,
          apTurnover,
        }
      })()
    : null

  return { data: metrics, isLoading, error, mutate }
}

// Sales by Salesperson
export interface SalespersonRow {
  salesperson_code: string
  invoice_count: number
  total_sales: number
}

export function useWarehouseSalesBySalesperson(
  schema: string | null,
  dateRange?: DateRange,
  limit: number = 10
) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND h.posting_date >= '${dateRange.startDate}' AND h.posting_date <= '${dateRange.endDate}'`
      : ''

  const query = schema
    ? `
    SELECT
      COALESCE(h.salesperson_code, 'Unassigned') AS salesperson_code,
      COUNT(DISTINCT h.no) AS invoice_count,
      SUM(l.amount) AS total_sales
    FROM ${schema}.sales_invoice_header h
    JOIN ${schema}.sales_invoice_line l
      ON h.no = l.document_no
      AND h.company_id = l.company_id
    WHERE h._fivetran_deleted = false
      AND l._fivetran_deleted = false
      ${dateFilter}
    GROUP BY COALESCE(h.salesperson_code, 'Unassigned')
    ORDER BY total_sales DESC
    LIMIT ${limit}
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<SalespersonRow>>(
    query
      ? ['sales-by-salesperson', schema, dateRange?.startDate, dateRange?.endDate, limit]
      : null,
    () => warehouseFetcher<SalespersonRow>(query!),
    { revalidateOnFocus: false }
  )

  return { data: data?.data || [], isLoading, error, mutate }
}

// Financial Health Score calculation (composite metric)
export interface FinancialHealthScore {
  score: number // 0-100
  rating: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention' | 'Critical'
  components: {
    liquidity: { score: number; weight: number; details: string }
    profitability: { score: number; weight: number; details: string }
    efficiency: { score: number; weight: number; details: string }
    leverage: { score: number; weight: number; details: string }
  }
}

export function calculateFinancialHealthScore(
  ratios: FinancialRatios | null,
  efficiency: EfficiencyMetrics | null,
  cashRunway: CashRunwayData | null,
  pnlTotals: { totalRevenue: number; netIncome: number } | null
): FinancialHealthScore | null {
  if (!ratios && !efficiency && !cashRunway && !pnlTotals) return null

  // Liquidity Score (25% weight)
  let liquidityScore = 50 // default
  let liquidityDetails = 'Insufficient data'
  if (ratios && ratios.currentRatio !== null) {
    const cr = ratios.currentRatio
    if (cr >= 2) liquidityScore = 100
    else if (cr >= 1.5) liquidityScore = 80
    else if (cr >= 1) liquidityScore = 60
    else if (cr >= 0.5) liquidityScore = 40
    else liquidityScore = 20
    liquidityDetails = `Current Ratio: ${cr.toFixed(2)}`
  } else if (cashRunway && cashRunway.cashRunwayMonths !== null) {
    const runway = cashRunway.cashRunwayMonths
    if (runway >= 24) liquidityScore = 100
    else if (runway >= 12) liquidityScore = 80
    else if (runway >= 6) liquidityScore = 60
    else if (runway >= 3) liquidityScore = 40
    else liquidityScore = 20
    liquidityDetails = `Runway: ${runway.toFixed(1)} months`
  }

  // Profitability Score (25% weight)
  let profitabilityScore = 50
  let profitabilityDetails = 'Insufficient data'
  if (pnlTotals && pnlTotals.totalRevenue > 0) {
    const netMargin = (pnlTotals.netIncome / pnlTotals.totalRevenue) * 100
    if (netMargin >= 20) profitabilityScore = 100
    else if (netMargin >= 10) profitabilityScore = 80
    else if (netMargin >= 5) profitabilityScore = 60
    else if (netMargin >= 0) profitabilityScore = 40
    else profitabilityScore = 20
    profitabilityDetails = `Net Margin: ${netMargin.toFixed(1)}%`
  }

  // Efficiency Score (25% weight)
  let efficiencyScore = 50
  let efficiencyDetails = 'Insufficient data'
  if (efficiency && efficiency.dso !== null) {
    const dso = efficiency.dso
    if (dso <= 30) efficiencyScore = 100
    else if (dso <= 45) efficiencyScore = 80
    else if (dso <= 60) efficiencyScore = 60
    else if (dso <= 90) efficiencyScore = 40
    else efficiencyScore = 20
    efficiencyDetails = `DSO: ${dso.toFixed(0)} days`
  }

  // Leverage Score (25% weight)
  let leverageScore = 50
  let leverageDetails = 'Insufficient data'
  if (ratios && ratios.debtToEquity !== null) {
    const de = ratios.debtToEquity
    if (de <= 0.5) leverageScore = 100
    else if (de <= 1) leverageScore = 80
    else if (de <= 2) leverageScore = 60
    else if (de <= 3) leverageScore = 40
    else leverageScore = 20
    leverageDetails = `D/E: ${de.toFixed(2)}`
  }

  // Calculate weighted score
  const totalScore =
    liquidityScore * 0.25 +
    profitabilityScore * 0.25 +
    efficiencyScore * 0.25 +
    leverageScore * 0.25

  // Determine rating
  let rating: FinancialHealthScore['rating']
  if (totalScore >= 80) rating = 'Excellent'
  else if (totalScore >= 60) rating = 'Good'
  else if (totalScore >= 40) rating = 'Fair'
  else if (totalScore >= 20) rating = 'Needs Attention'
  else rating = 'Critical'

  return {
    score: Math.round(totalScore),
    rating,
    components: {
      liquidity: { score: liquidityScore, weight: 25, details: liquidityDetails },
      profitability: { score: profitabilityScore, weight: 25, details: profitabilityDetails },
      efficiency: { score: efficiencyScore, weight: 25, details: efficiencyDetails },
      leverage: { score: leverageScore, weight: 25, details: leverageDetails },
    },
  }
}

// Aggregated hook for all warehouse P&L data
export function useWarehousePnLData(schema: string | null, dateRange?: DateRange) {
  console.log('[useWarehousePnLData] Called with schema:', schema, 'dateRange:', dateRange)

  const trialBalance = useTrialBalance(schema, dateRange)
  const monthlyPnL = useMonthlyPnL(schema, dateRange)
  const documentTypes = useDocumentTypeBreakdown(schema, dateRange)
  const departments = useDepartmentBreakdown(schema, dateRange)
  const topCustomers = useTopCustomers(schema, dateRange)
  const monthlyRevenue = useMonthlyRevenue(schema, dateRange)
  const dataRange = useDataDateRange(schema)

  // Debug logging
  console.log('[useWarehousePnLData] Trial Balance:', {
    isLoading: trialBalance.isLoading,
    dataLength: trialBalance.data?.length,
    error: trialBalance.error,
  })
  console.log('[useWarehousePnLData] Monthly PnL:', {
    isLoading: monthlyPnL.isLoading,
    dataLength: monthlyPnL.data?.length,
    error: monthlyPnL.error,
  })
  console.log('[useWarehousePnLData] Document Types:', {
    isLoading: documentTypes.isLoading,
    dataLength: documentTypes.data?.length,
    error: documentTypes.error,
  })

  const isLoading =
    trialBalance.isLoading ||
    monthlyPnL.isLoading ||
    documentTypes.isLoading ||
    departments.isLoading ||
    topCustomers.isLoading ||
    monthlyRevenue.isLoading ||
    dataRange.isLoading

  const hasError =
    trialBalance.error ||
    monthlyPnL.error ||
    documentTypes.error ||
    departments.error ||
    topCustomers.error ||
    monthlyRevenue.error ||
    dataRange.error

  // Mutate all function to refresh all data
  const mutateAll = () => {
    console.log('[useWarehousePnLData] Refreshing all data...')
    trialBalance.mutate()
    monthlyPnL.mutate()
    documentTypes.mutate()
    departments.mutate()
    topCustomers.mutate()
    monthlyRevenue.mutate()
    dataRange.mutate()
  }

  return {
    trialBalance: trialBalance.data,
    monthlyPnL: monthlyPnL.data,
    documentTypes: documentTypes.data,
    departments: departments.data,
    topCustomers: topCustomers.data,
    monthlyRevenue: monthlyRevenue.data,
    dataRange: dataRange.data,
    isLoading,
    error: hasError,
    mutate: mutateAll,
  }
}
