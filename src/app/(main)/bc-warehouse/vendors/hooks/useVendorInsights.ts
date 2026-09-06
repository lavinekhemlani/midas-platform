'use client'

import useSWR from 'swr'

// Re-export DateRange for consistency
export interface DateRange {
  startDate: string | null // ISO format YYYY-MM-DD
  endDate: string | null // ISO format YYYY-MM-DD
}

// Types
export interface VendorPaymentRiskRow {
  no: string
  name: string
  balance_lcy: number
  balance_due_lcy: number
  purchases_lcy: number
  payment_terms_code: string
  blocked: string | null
  overdue_ratio: number // calculated
  risk_score: 'low' | 'medium' | 'high' | 'critical'
}

export interface VendorConcentration {
  no: string
  name: string
  purchases_lcy: number
  percentage: number
}

export interface OutstandingPayablesSummary {
  total_outstanding_ap: number
  total_overdue_ap: number
  vendors_with_balance: number
  vendors_with_overdue: number
}

export interface VendorPaymentTermsSummary {
  payment_terms_code: string
  vendor_count: number
  total_balance: number
  total_balance_due: number
  total_purchases: number
}

export interface PaymentRiskSummary {
  total_balance: number
  total_balance_due: number
  vendors_with_balance: number
  vendors_overdue: number
  high_risk_vendors: number
  overdue_ratio: number
}

export interface VendorOverviewData {
  total_vendors: number
  vendors_with_balance: number
  blocked_vendors: number
  total_purchases: number
  total_ap: number
  total_overdue: number
}

interface QueryResult<T> {
  success: boolean
  data: T[]
  count: number
  columns: string[]
  totalCount?: number
}

// Fetcher for warehouse queries
async function warehouseFetcher<T>(query: string): Promise<QueryResult<T>> {
  const response = await fetch('/api/redshift/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    if (response.status === 403) {
      console.warn('[vendorInsights] Schema access denied (403) — returning empty result')
      return { success: false, data: [], count: 0, columns: [] } as QueryResult<T>
    }
    throw new Error(`Warehouse query failed: ${response.statusText}`)
  }

  return response.json()
}

// Hook: Vendor Payment Risk Analysis
export function useVendorPaymentRisk(
  schema: string | null,
  limit: number = 20,
  dateRange?: DateRange
) {
  const hasDateFilter = dateRange?.startDate && dateRange?.endDate

  const query = schema
    ? hasDateFilter
      ? `
      WITH vendor_balances AS (
        SELECT
          vendor_no,
          SUM(CASE WHEN COALESCE(open, false) = true THEN COALESCE(amount, 0) ELSE 0 END) as balance_lcy,
          SUM(CASE WHEN COALESCE(open, false) = true AND due_date < CURRENT_DATE THEN COALESCE(amount, 0) ELSE 0 END) as balance_due_lcy,
          SUM(CASE WHEN document_type = 'Invoice' THEN COALESCE(amount, 0) ELSE 0 END) as purchases_lcy
        FROM ${schema}.vendor_ledger_entry
        WHERE COALESCE(_fivetran_deleted, false) = false
          AND posting_date >= '${dateRange.startDate}'
          AND posting_date <= '${dateRange.endDate}'
        GROUP BY vendor_no
      )
      SELECT
        v.no,
        v.name,
        COALESCE(vb.balance_lcy, 0) as balance_lcy,
        COALESCE(vb.balance_due_lcy, 0) as balance_due_lcy,
        COALESCE(vb.purchases_lcy, v.purchases_lcy, 0) as purchases_lcy,
        COALESCE(v.payment_terms_code, '') as payment_terms_code,
        v.blocked
      FROM ${schema}.vendor v
      LEFT JOIN vendor_balances vb ON v.no = vb.vendor_no
      WHERE COALESCE(v._fivetran_deleted, false) = false
        AND COALESCE(vb.balance_lcy, v.balance_lcy, 0) > 0
      ORDER BY COALESCE(vb.balance_due_lcy, v.balance_due_lcy, 0) DESC, COALESCE(vb.balance_lcy, v.balance_lcy, 0) DESC
      LIMIT ${limit}
      `
      : `
      SELECT
        no,
        name,
        COALESCE(balance_lcy, 0) as balance_lcy,
        COALESCE(balance_due_lcy, 0) as balance_due_lcy,
        COALESCE(purchases_lcy, 0) as purchases_lcy,
        COALESCE(payment_terms_code, '') as payment_terms_code,
        blocked
      FROM ${schema}.vendor
      WHERE COALESCE(_fivetran_deleted, false) = false
        AND COALESCE(balance_lcy, 0) > 0
      ORDER BY balance_due_lcy DESC, balance_lcy DESC
      LIMIT ${limit}
      `
    : null

  const { data, error, isLoading, mutate } = useSWR<
    QueryResult<Omit<VendorPaymentRiskRow, 'overdue_ratio' | 'risk_score'>>
  >(
    query ? ['vendor-payment-risk', schema, limit, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher(query!),
    {
      revalidateOnFocus: false,
    }
  )

  // Calculate overdue ratio and risk score
  const enrichedData: VendorPaymentRiskRow[] = (data?.data || []).map((vendor) => {
    const balance = Number(vendor.balance_lcy)
    const balanceDue = Number(vendor.balance_due_lcy)

    // Overdue ratio percentage
    const overdueRatio = balance > 0 ? (balanceDue / balance) * 100 : 0

    // Risk score calculation - Note: "_x0020_" is BC's encoding for space (meaning "not blocked")
    const isBlocked = vendor.blocked && vendor.blocked !== '_x0020_' && vendor.blocked.trim() !== ''
    let riskScore: VendorPaymentRiskRow['risk_score'] = 'low'
    if (isBlocked) {
      riskScore = 'critical'
    } else if (overdueRatio > 75 || balanceDue > 100000) {
      riskScore = 'high'
    } else if (overdueRatio > 50 || balanceDue > 50000) {
      riskScore = 'medium'
    }

    return {
      ...vendor,
      balance_lcy: balance,
      balance_due_lcy: balanceDue,
      purchases_lcy: Number(vendor.purchases_lcy),
      overdue_ratio: overdueRatio,
      risk_score: riskScore,
    }
  })

  // Calculate summary
  const summary: PaymentRiskSummary | null =
    enrichedData.length > 0
      ? {
          total_balance: enrichedData.reduce((sum, v) => sum + v.balance_lcy, 0),
          total_balance_due: enrichedData.reduce((sum, v) => sum + v.balance_due_lcy, 0),
          vendors_with_balance: enrichedData.length,
          vendors_overdue: enrichedData.filter((v) => v.balance_due_lcy > 0).length,
          high_risk_vendors: enrichedData.filter(
            (v) => v.risk_score === 'high' || v.risk_score === 'critical'
          ).length,
          overdue_ratio: 0, // calculated below
        }
      : null

  if (summary && summary.total_balance > 0) {
    summary.overdue_ratio = (summary.total_balance_due / summary.total_balance) * 100
  }

  return { data: enrichedData, summary, isLoading, error, mutate }
}

// Hook: Vendor Concentration (Top vendors by purchases)
export function useVendorConcentration(
  schema: string | null,
  limit: number = 10,
  dateRange?: DateRange
) {
  const hasDateFilter = dateRange?.startDate && dateRange?.endDate

  const query = schema
    ? hasDateFilter
      ? `
      WITH vendor_purchases AS (
        SELECT
          vendor_no,
          SUM(CASE WHEN document_type = 'Invoice' THEN COALESCE(amount, 0) ELSE 0 END) as purchases_lcy
        FROM ${schema}.vendor_ledger_entry
        WHERE COALESCE(_fivetran_deleted, false) = false
          AND posting_date >= '${dateRange.startDate}'
          AND posting_date <= '${dateRange.endDate}'
        GROUP BY vendor_no
      ),
      total_purchases AS (
        SELECT SUM(purchases_lcy) as grand_total FROM vendor_purchases
      )
      SELECT
        v.no,
        v.name,
        COALESCE(vp.purchases_lcy, 0) as purchases_lcy,
        CASE
          WHEN t.grand_total > 0 THEN (COALESCE(vp.purchases_lcy, 0) / t.grand_total) * 100
          ELSE 0
        END as percentage
      FROM ${schema}.vendor v
      JOIN vendor_purchases vp ON v.no = vp.vendor_no
      CROSS JOIN total_purchases t
      WHERE COALESCE(v._fivetran_deleted, false) = false
        AND COALESCE(vp.purchases_lcy, 0) > 0
      ORDER BY vp.purchases_lcy DESC
      LIMIT ${limit}
      `
      : `
      WITH total_purchases AS (
        SELECT SUM(COALESCE(purchases_lcy, 0)) as grand_total
        FROM ${schema}.vendor
        WHERE COALESCE(_fivetran_deleted, false) = false
      )
      SELECT
        v.no,
        v.name,
        COALESCE(v.purchases_lcy, 0) as purchases_lcy,
        CASE
          WHEN t.grand_total > 0 THEN (COALESCE(v.purchases_lcy, 0) / t.grand_total) * 100
          ELSE 0
        END as percentage
      FROM ${schema}.vendor v
      CROSS JOIN total_purchases t
      WHERE COALESCE(v._fivetran_deleted, false) = false
        AND COALESCE(v.purchases_lcy, 0) > 0
      ORDER BY v.purchases_lcy DESC
      LIMIT ${limit}
      `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<VendorConcentration>>(
    query
      ? ['vendor-concentration', schema, limit, dateRange?.startDate, dateRange?.endDate]
      : null,
    () => warehouseFetcher(query!),
    { revalidateOnFocus: false }
  )

  // Calculate concentration metrics
  const vendors = data?.data || []
  const topVendorPercentage = vendors.length > 0 ? vendors[0]?.percentage || 0 : 0
  const top5Percentage = vendors.slice(0, 5).reduce((sum, v) => sum + Number(v.percentage), 0)
  const top10Percentage = vendors.slice(0, 10).reduce((sum, v) => sum + Number(v.percentage), 0)

  const concentrationRisk: 'low' | 'medium' | 'high' =
    top5Percentage > 50 ? 'high' : top5Percentage > 30 ? 'medium' : 'low'

  return {
    data: vendors.map((v) => ({
      ...v,
      purchases_lcy: Number(v.purchases_lcy),
      percentage: Number(v.percentage),
    })),
    metrics: {
      topVendorPercentage,
      top5Percentage,
      top10Percentage,
      concentrationRisk,
    },
    isLoading,
    error,
    mutate,
  }
}

// Hook: Outstanding Payables Summary
export function useOutstandingPayables(schema: string | null) {
  const query = schema
    ? `
    SELECT
      COALESCE(SUM(COALESCE(balance_lcy, 0)), 0) as total_outstanding_ap,
      COALESCE(SUM(COALESCE(balance_due_lcy, 0)), 0) as total_overdue_ap,
      COUNT(CASE WHEN COALESCE(balance_lcy, 0) > 0 THEN 1 END) as vendors_with_balance,
      COUNT(CASE WHEN COALESCE(balance_due_lcy, 0) > 0 THEN 1 END) as vendors_with_overdue
    FROM ${schema}.vendor
    WHERE COALESCE(_fivetran_deleted, false) = false
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<OutstandingPayablesSummary>>(
    query ? ['outstanding-payables-summary', schema] : null,
    () => warehouseFetcher(query!),
    { revalidateOnFocus: false }
  )

  const summary: OutstandingPayablesSummary | null = data?.data?.[0]
    ? {
        total_outstanding_ap: Number(data.data[0].total_outstanding_ap),
        total_overdue_ap: Number(data.data[0].total_overdue_ap),
        vendors_with_balance: Number(data.data[0].vendors_with_balance),
        vendors_with_overdue: Number(data.data[0].vendors_with_overdue),
      }
    : null

  return { data: summary, isLoading, error, mutate }
}

// Hook: Top Vendors by Outstanding Balance
export function useTopVendorsByBalance(schema: string | null, limit: number = 10) {
  const query = schema
    ? `
    SELECT
      no,
      name,
      COALESCE(balance_lcy, 0) as balance_lcy,
      COALESCE(balance_due_lcy, 0) as balance_due_lcy,
      COALESCE(purchases_lcy, 0) as purchases_lcy,
      COALESCE(payment_terms_code, '') as payment_terms_code
    FROM ${schema}.vendor
    WHERE COALESCE(_fivetran_deleted, false) = false
      AND COALESCE(balance_lcy, 0) > 0
    ORDER BY balance_lcy DESC
    LIMIT ${limit}
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<
    QueryResult<{
      no: string
      name: string
      balance_lcy: number
      balance_due_lcy: number
      purchases_lcy: number
      payment_terms_code: string
    }>
  >(query ? ['top-vendors-balance', schema, limit] : null, () => warehouseFetcher(query!), {
    revalidateOnFocus: false,
  })

  return {
    data: (data?.data || []).map((v) => ({
      ...v,
      balance_lcy: Number(v.balance_lcy),
      balance_due_lcy: Number(v.balance_due_lcy),
      purchases_lcy: Number(v.purchases_lcy),
    })),
    isLoading,
    error,
    mutate,
  }
}

// Hook: Vendor Payment Terms Distribution
export function useVendorPaymentTermsDistribution(schema: string | null) {
  const query = schema
    ? `
    SELECT
      COALESCE(payment_terms_code, 'Not Set') as payment_terms_code,
      COUNT(*) as vendor_count,
      COALESCE(SUM(COALESCE(balance_lcy, 0)), 0) as total_balance,
      COALESCE(SUM(COALESCE(balance_due_lcy, 0)), 0) as total_balance_due,
      COALESCE(SUM(COALESCE(purchases_lcy, 0)), 0) as total_purchases
    FROM ${schema}.vendor
    WHERE COALESCE(_fivetran_deleted, false) = false
    GROUP BY COALESCE(payment_terms_code, 'Not Set')
    ORDER BY total_purchases DESC
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<VendorPaymentTermsSummary>>(
    query ? ['vendor-payment-terms-distribution', schema] : null,
    () => warehouseFetcher(query!),
    { revalidateOnFocus: false }
  )

  return {
    data: (data?.data || []).map((p) => ({
      ...p,
      vendor_count: Number(p.vendor_count),
      total_balance: Number(p.total_balance),
      total_balance_due: Number(p.total_balance_due),
      total_purchases: Number(p.total_purchases),
    })),
    isLoading,
    error,
    mutate,
  }
}

// Hook: Vendor Overview Stats
export function useVendorOverview(schema: string | null, dateRange?: DateRange) {
  const hasDateFilter = dateRange?.startDate && dateRange?.endDate

  const query = schema
    ? hasDateFilter
      ? `
      WITH vendor_ledger_data AS (
        SELECT
          vendor_no,
          SUM(CASE WHEN COALESCE(open, false) = true THEN COALESCE(amount, 0) ELSE 0 END) as balance_lcy,
          SUM(CASE WHEN COALESCE(open, false) = true AND due_date < CURRENT_DATE THEN COALESCE(amount, 0) ELSE 0 END) as balance_due_lcy,
          SUM(CASE WHEN document_type = 'Invoice' THEN COALESCE(amount, 0) ELSE 0 END) as purchases_lcy
        FROM ${schema}.vendor_ledger_entry
        WHERE COALESCE(_fivetran_deleted, false) = false
          AND posting_date >= '${dateRange.startDate}'
          AND posting_date <= '${dateRange.endDate}'
        GROUP BY vendor_no
      )
      SELECT
        COUNT(DISTINCT v.no) as total_vendors,
        COUNT(DISTINCT CASE WHEN COALESCE(vl.balance_lcy, 0) > 0 THEN v.no END) as vendors_with_balance,
        COUNT(DISTINCT CASE WHEN v.blocked IS NOT NULL AND v.blocked != '' AND v.blocked != '_x0020_' THEN v.no END) as blocked_vendors,
        COALESCE(SUM(COALESCE(vl.purchases_lcy, 0)), 0) as total_purchases,
        COALESCE(SUM(COALESCE(vl.balance_lcy, 0)), 0) as total_ap,
        COALESCE(SUM(COALESCE(vl.balance_due_lcy, 0)), 0) as total_overdue
      FROM ${schema}.vendor v
      LEFT JOIN vendor_ledger_data vl ON v.no = vl.vendor_no
      WHERE COALESCE(v._fivetran_deleted, false) = false
      `
      : `
      SELECT
        COUNT(*) as total_vendors,
        COUNT(CASE WHEN COALESCE(balance_lcy, 0) > 0 THEN 1 END) as vendors_with_balance,
        COUNT(CASE WHEN blocked IS NOT NULL AND blocked != '' AND blocked != '_x0020_' THEN 1 END) as blocked_vendors,
        COALESCE(SUM(COALESCE(purchases_lcy, 0)), 0) as total_purchases,
        COALESCE(SUM(COALESCE(balance_lcy, 0)), 0) as total_ap,
        COALESCE(SUM(COALESCE(balance_due_lcy, 0)), 0) as total_overdue
      FROM ${schema}.vendor
      WHERE COALESCE(_fivetran_deleted, false) = false
      `
    : null

  const { data, error, isLoading, mutate } = useSWR<
    QueryResult<{
      total_vendors: number
      vendors_with_balance: number
      blocked_vendors: number
      total_purchases: number
      total_ap: number
      total_overdue: number
    }>
  >(
    query ? ['vendor-overview', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher(query!),
    {
      revalidateOnFocus: false,
    }
  )

  const overview = data?.data?.[0]
    ? {
        total_vendors: Number(data.data[0].total_vendors),
        vendors_with_balance: Number(data.data[0].vendors_with_balance),
        blocked_vendors: Number(data.data[0].blocked_vendors),
        total_purchases: Number(data.data[0].total_purchases),
        total_ap: Number(data.data[0].total_ap),
        total_overdue: Number(data.data[0].total_overdue),
      }
    : null

  return { data: overview, isLoading, error, mutate }
}
