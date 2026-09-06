'use client'

import useSWR from 'swr'
import type { KeyedMutator } from 'swr'

// Re-export DateRange for consistency
export interface DateRange {
  startDate: string | null // ISO format YYYY-MM-DD
  endDate: string | null // ISO format YYYY-MM-DD
}

// Types
export interface CustomerRiskRow {
  no: string
  name: string
  credit_limit_lcy: number
  balance_lcy: number
  balance_due_lcy: number
  outstanding_orders_lcy: number
  outstanding_invoices_lcy: number
  sales_lcy: number
  profit_lcy: number
  payment_terms_code: string
  blocked: string | null
  credit_utilization: number // calculated
  risk_score: 'low' | 'medium' | 'high' | 'critical'
}

export interface CustomerConcentration {
  no: string
  name: string
  sales_lcy: number
  percentage: number
}

export interface OutstandingOrdersSummary {
  total_outstanding_orders: number
  total_outstanding_invoices: number
  total_shipped_not_invoiced: number
  customers_with_orders: number
  customers_with_invoices: number
}

export interface CustomerPaymentSummary {
  payment_terms_code: string
  customer_count: number
  total_balance: number
  total_balance_due: number
  total_sales: number
}

export interface CreditRiskSummary {
  total_credit_limit: number
  total_balance: number
  total_balance_due: number
  overall_utilization: number
  customers_over_limit: number
  customers_overdue: number
  high_risk_customers: number
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
      console.warn('[customerInsights] Schema access denied (403) — returning empty result')
      return { success: false, data: [], count: 0, columns: [] } as QueryResult<T>
    }
    throw new Error(`Warehouse query failed: ${response.statusText}`)
  }

  return response.json()
}

// Hook: Customer Credit Risk Analysis
export function useCustomerCreditRisk(
  schema: string | null,
  limit: number = 20,
  dateRange?: DateRange
) {
  // For customer table data, we use ledger entries to get date-filtered balances
  // When dateRange is provided, we calculate balances from customer_ledger_entry
  const hasDateFilter = dateRange?.startDate && dateRange?.endDate

  const query = schema
    ? hasDateFilter
      ? `
      WITH customer_balances AS (
        SELECT
          customer_no,
          SUM(CASE WHEN COALESCE(open, false) = true THEN COALESCE(amount, 0) ELSE 0 END) as balance_lcy,
          SUM(CASE WHEN COALESCE(open, false) = true AND due_date < CURRENT_DATE THEN COALESCE(amount, 0) ELSE 0 END) as balance_due_lcy,
          SUM(CASE WHEN document_type = 'Invoice' THEN COALESCE(amount, 0) ELSE 0 END) as sales_lcy
        FROM ${schema}.cust_ledger_entry
        WHERE COALESCE(_fivetran_deleted, false) = false
          AND posting_date >= '${dateRange.startDate}'
          AND posting_date <= '${dateRange.endDate}'
        GROUP BY customer_no
      )
      SELECT
        c.no,
        c.name,
        COALESCE(c.credit_limit_lcy, 0) as credit_limit_lcy,
        COALESCE(cb.balance_lcy, 0) as balance_lcy,
        COALESCE(cb.balance_due_lcy, 0) as balance_due_lcy,
        COALESCE(c.outstanding_orders_lcy, 0) as outstanding_orders_lcy,
        COALESCE(c.outstanding_invoices_lcy, 0) as outstanding_invoices_lcy,
        COALESCE(cb.sales_lcy, c.sales_lcy, 0) as sales_lcy,
        COALESCE(c.profit_lcy, 0) as profit_lcy,
        COALESCE(c.payment_terms_code, '') as payment_terms_code,
        c.blocked
      FROM ${schema}.customer c
      LEFT JOIN customer_balances cb ON c.no = cb.customer_no
      WHERE COALESCE(c._fivetran_deleted, false) = false
        AND (COALESCE(cb.balance_lcy, c.balance_lcy, 0) > 0 OR COALESCE(c.credit_limit_lcy, 0) > 0)
      ORDER BY COALESCE(cb.balance_lcy, c.balance_lcy, 0) DESC
      LIMIT ${limit}
      `
      : `
      SELECT
        no,
        name,
        COALESCE(credit_limit_lcy, 0) as credit_limit_lcy,
        COALESCE(balance_lcy, 0) as balance_lcy,
        COALESCE(balance_due_lcy, 0) as balance_due_lcy,
        COALESCE(outstanding_orders_lcy, 0) as outstanding_orders_lcy,
        COALESCE(outstanding_invoices_lcy, 0) as outstanding_invoices_lcy,
        COALESCE(sales_lcy, 0) as sales_lcy,
        COALESCE(profit_lcy, 0) as profit_lcy,
        COALESCE(payment_terms_code, '') as payment_terms_code,
        blocked
      FROM ${schema}.customer
      WHERE COALESCE(_fivetran_deleted, false) = false
        AND (COALESCE(balance_lcy, 0) > 0 OR COALESCE(credit_limit_lcy, 0) > 0)
      ORDER BY balance_lcy DESC
      LIMIT ${limit}
      `
    : null

  const { data, error, isLoading, mutate } = useSWR<
    QueryResult<Omit<CustomerRiskRow, 'credit_utilization' | 'risk_score'>>
  >(
    query
      ? ['customer-credit-risk', schema, limit, dateRange?.startDate, dateRange?.endDate]
      : null,
    () => warehouseFetcher(query!),
    {
      revalidateOnFocus: false,
    }
  )

  // Calculate credit utilization and risk score
  const enrichedData: CustomerRiskRow[] = (data?.data || []).map((customer) => {
    const creditLimit = Number(customer.credit_limit_lcy)
    const balance = Number(customer.balance_lcy)
    const balanceDue = Number(customer.balance_due_lcy)

    // Credit utilization percentage
    const creditUtilization = creditLimit > 0 ? (balance / creditLimit) * 100 : 0

    // Risk score calculation - Note: "_x0020_" is BC's encoding for space (meaning "not blocked")
    const isBlocked =
      customer.blocked && customer.blocked !== '_x0020_' && customer.blocked.trim() !== ''
    let riskScore: CustomerRiskRow['risk_score'] = 'low'
    if (isBlocked) {
      riskScore = 'critical'
    } else if (creditUtilization > 100 || balanceDue > balance * 0.5) {
      riskScore = 'high'
    } else if (creditUtilization > 80 || balanceDue > balance * 0.25) {
      riskScore = 'medium'
    }

    return {
      ...customer,
      credit_limit_lcy: creditLimit,
      balance_lcy: balance,
      balance_due_lcy: balanceDue,
      outstanding_orders_lcy: Number(customer.outstanding_orders_lcy),
      outstanding_invoices_lcy: Number(customer.outstanding_invoices_lcy),
      sales_lcy: Number(customer.sales_lcy),
      profit_lcy: Number(customer.profit_lcy),
      credit_utilization: creditUtilization,
      risk_score: riskScore,
    }
  })

  // Calculate summary
  const summary: CreditRiskSummary | null =
    enrichedData.length > 0
      ? {
          total_credit_limit: enrichedData.reduce((sum, c) => sum + c.credit_limit_lcy, 0),
          total_balance: enrichedData.reduce((sum, c) => sum + c.balance_lcy, 0),
          total_balance_due: enrichedData.reduce((sum, c) => sum + c.balance_due_lcy, 0),
          overall_utilization: 0, // calculated below
          customers_over_limit: enrichedData.filter((c) => c.credit_utilization > 100).length,
          customers_overdue: enrichedData.filter((c) => c.balance_due_lcy > 0).length,
          high_risk_customers: enrichedData.filter(
            (c) => c.risk_score === 'high' || c.risk_score === 'critical'
          ).length,
        }
      : null

  if (summary && summary.total_credit_limit > 0) {
    summary.overall_utilization = (summary.total_balance / summary.total_credit_limit) * 100
  }

  return { data: enrichedData, summary, isLoading, error, mutate }
}

// Hook: Customer Concentration (Top customers by sales)
export function useCustomerConcentration(
  schema: string | null,
  limit: number = 10,
  dateRange?: DateRange
) {
  const hasDateFilter = dateRange?.startDate && dateRange?.endDate

  const query = schema
    ? hasDateFilter
      ? `
      WITH customer_sales AS (
        SELECT
          customer_no,
          SUM(CASE WHEN document_type = 'Invoice' THEN COALESCE(amount, 0) ELSE 0 END) as sales_lcy
        FROM ${schema}.cust_ledger_entry
        WHERE COALESCE(_fivetran_deleted, false) = false
          AND posting_date >= '${dateRange.startDate}'
          AND posting_date <= '${dateRange.endDate}'
        GROUP BY customer_no
      ),
      total_sales AS (
        SELECT SUM(sales_lcy) as grand_total FROM customer_sales
      )
      SELECT
        c.no,
        c.name,
        COALESCE(cs.sales_lcy, 0) as sales_lcy,
        CASE
          WHEN t.grand_total > 0 THEN (COALESCE(cs.sales_lcy, 0) / t.grand_total) * 100
          ELSE 0
        END as percentage
      FROM ${schema}.customer c
      JOIN customer_sales cs ON c.no = cs.customer_no
      CROSS JOIN total_sales t
      WHERE COALESCE(c._fivetran_deleted, false) = false
        AND COALESCE(cs.sales_lcy, 0) > 0
      ORDER BY cs.sales_lcy DESC
      LIMIT ${limit}
      `
      : `
      WITH total_sales AS (
        SELECT SUM(COALESCE(sales_lcy, 0)) as grand_total
        FROM ${schema}.customer
        WHERE COALESCE(_fivetran_deleted, false) = false
      )
      SELECT
        c.no,
        c.name,
        COALESCE(c.sales_lcy, 0) as sales_lcy,
        CASE
          WHEN t.grand_total > 0 THEN (COALESCE(c.sales_lcy, 0) / t.grand_total) * 100
          ELSE 0
        END as percentage
      FROM ${schema}.customer c
      CROSS JOIN total_sales t
      WHERE COALESCE(c._fivetran_deleted, false) = false
        AND COALESCE(c.sales_lcy, 0) > 0
      ORDER BY c.sales_lcy DESC
      LIMIT ${limit}
      `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<CustomerConcentration>>(
    query
      ? ['customer-concentration', schema, limit, dateRange?.startDate, dateRange?.endDate]
      : null,
    () => warehouseFetcher(query!),
    { revalidateOnFocus: false }
  )

  // Calculate concentration metrics
  const customers = data?.data || []
  const topCustomerPercentage = customers.length > 0 ? customers[0]?.percentage || 0 : 0
  const top5Percentage = customers.slice(0, 5).reduce((sum, c) => sum + Number(c.percentage), 0)
  const top10Percentage = customers.slice(0, 10).reduce((sum, c) => sum + Number(c.percentage), 0)

  const concentrationRisk: 'low' | 'medium' | 'high' =
    top5Percentage > 50 ? 'high' : top5Percentage > 30 ? 'medium' : 'low'

  return {
    data: customers.map((c) => ({
      ...c,
      sales_lcy: Number(c.sales_lcy),
      percentage: Number(c.percentage),
    })),
    metrics: {
      topCustomerPercentage,
      top5Percentage,
      top10Percentage,
      concentrationRisk,
    },
    isLoading,
    error,
    mutate,
  }
}

// Hook: Outstanding Orders Summary
export function useOutstandingOrders(schema: string | null) {
  const query = schema
    ? `
    SELECT
      COALESCE(SUM(COALESCE(outstanding_orders_lcy, 0)), 0) as total_outstanding_orders,
      COALESCE(SUM(COALESCE(outstanding_invoices_lcy, 0)), 0) as total_outstanding_invoices,
      COALESCE(SUM(COALESCE(shipped_not_invoiced_lcy, 0)), 0) as total_shipped_not_invoiced,
      COUNT(CASE WHEN COALESCE(outstanding_orders_lcy, 0) > 0 THEN 1 END) as customers_with_orders,
      COUNT(CASE WHEN COALESCE(outstanding_invoices_lcy, 0) > 0 THEN 1 END) as customers_with_invoices
    FROM ${schema}.customer
    WHERE COALESCE(_fivetran_deleted, false) = false
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<OutstandingOrdersSummary>>(
    query ? ['outstanding-orders-summary', schema] : null,
    () => warehouseFetcher(query!),
    { revalidateOnFocus: false }
  )

  const summary: OutstandingOrdersSummary | null = data?.data?.[0]
    ? {
        total_outstanding_orders: Number(data.data[0].total_outstanding_orders),
        total_outstanding_invoices: Number(data.data[0].total_outstanding_invoices),
        total_shipped_not_invoiced: Number(data.data[0].total_shipped_not_invoiced),
        customers_with_orders: Number(data.data[0].customers_with_orders),
        customers_with_invoices: Number(data.data[0].customers_with_invoices),
      }
    : null

  return { data: summary, isLoading, error, mutate }
}

// Hook: Top Customers by Outstanding Balance
export function useTopCustomersByBalance(schema: string | null, limit: number = 10) {
  const query = schema
    ? `
    SELECT
      no,
      name,
      COALESCE(balance_lcy, 0) as balance_lcy,
      COALESCE(balance_due_lcy, 0) as balance_due_lcy,
      COALESCE(credit_limit_lcy, 0) as credit_limit_lcy,
      COALESCE(sales_lcy, 0) as sales_lcy,
      COALESCE(payment_terms_code, '') as payment_terms_code
    FROM ${schema}.customer
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
      credit_limit_lcy: number
      sales_lcy: number
      payment_terms_code: string
    }>
  >(query ? ['top-customers-balance', schema, limit] : null, () => warehouseFetcher(query!), {
    revalidateOnFocus: false,
  })

  return {
    data: (data?.data || []).map((c) => ({
      ...c,
      balance_lcy: Number(c.balance_lcy),
      balance_due_lcy: Number(c.balance_due_lcy),
      credit_limit_lcy: Number(c.credit_limit_lcy),
      sales_lcy: Number(c.sales_lcy),
    })),
    isLoading,
    error,
    mutate,
  }
}

// Hook: Payment Terms Distribution
export function usePaymentTermsDistribution(schema: string | null) {
  const query = schema
    ? `
    SELECT
      COALESCE(payment_terms_code, 'Not Set') as payment_terms_code,
      COUNT(*) as customer_count,
      COALESCE(SUM(COALESCE(balance_lcy, 0)), 0) as total_balance,
      COALESCE(SUM(COALESCE(balance_due_lcy, 0)), 0) as total_balance_due,
      COALESCE(SUM(COALESCE(sales_lcy, 0)), 0) as total_sales
    FROM ${schema}.customer
    WHERE COALESCE(_fivetran_deleted, false) = false
    GROUP BY COALESCE(payment_terms_code, 'Not Set')
    ORDER BY total_sales DESC
    `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<CustomerPaymentSummary>>(
    query ? ['payment-terms-distribution', schema] : null,
    () => warehouseFetcher(query!),
    { revalidateOnFocus: false }
  )

  return {
    data: (data?.data || []).map((p) => ({
      ...p,
      customer_count: Number(p.customer_count),
      total_balance: Number(p.total_balance),
      total_balance_due: Number(p.total_balance_due),
      total_sales: Number(p.total_sales),
    })),
    isLoading,
    error,
    mutate,
  }
}

// Hook: Customer Overview Stats
export function useCustomerOverview(schema: string | null, dateRange?: DateRange) {
  const hasDateFilter = dateRange?.startDate && dateRange?.endDate

  const query = schema
    ? hasDateFilter
      ? `
      WITH customer_ledger_data AS (
        SELECT
          customer_no,
          SUM(CASE WHEN COALESCE(open, false) = true THEN COALESCE(amount, 0) ELSE 0 END) as balance_lcy,
          SUM(CASE WHEN COALESCE(open, false) = true AND due_date < CURRENT_DATE THEN COALESCE(amount, 0) ELSE 0 END) as balance_due_lcy,
          SUM(CASE WHEN document_type = 'Invoice' THEN COALESCE(amount, 0) ELSE 0 END) as sales_lcy
        FROM ${schema}.cust_ledger_entry
        WHERE COALESCE(_fivetran_deleted, false) = false
          AND posting_date >= '${dateRange.startDate}'
          AND posting_date <= '${dateRange.endDate}'
        GROUP BY customer_no
      )
      SELECT
        COUNT(DISTINCT c.no) as total_customers,
        COUNT(DISTINCT CASE WHEN COALESCE(cl.balance_lcy, 0) > 0 THEN c.no END) as customers_with_balance,
        COUNT(DISTINCT CASE WHEN c.blocked IS NOT NULL AND c.blocked != '' AND c.blocked != '_x0020_' THEN c.no END) as blocked_customers,
        COALESCE(SUM(COALESCE(cl.sales_lcy, 0)), 0) as total_sales,
        COALESCE(SUM(COALESCE(cl.balance_lcy, 0)), 0) as total_ar,
        COALESCE(SUM(COALESCE(cl.balance_due_lcy, 0)), 0) as total_overdue,
        COALESCE(SUM(COALESCE(c.profit_lcy, 0)), 0) as total_profit,
        COALESCE(SUM(COALESCE(c.credit_limit_lcy, 0)), 0) as total_credit_limit
      FROM ${schema}.customer c
      LEFT JOIN customer_ledger_data cl ON c.no = cl.customer_no
      WHERE COALESCE(c._fivetran_deleted, false) = false
      `
      : `
      SELECT
        COUNT(*) as total_customers,
        COUNT(CASE WHEN COALESCE(balance_lcy, 0) > 0 THEN 1 END) as customers_with_balance,
        COUNT(CASE WHEN blocked IS NOT NULL AND blocked != '' AND blocked != '_x0020_' THEN 1 END) as blocked_customers,
        COALESCE(SUM(COALESCE(sales_lcy, 0)), 0) as total_sales,
        COALESCE(SUM(COALESCE(balance_lcy, 0)), 0) as total_ar,
        COALESCE(SUM(COALESCE(balance_due_lcy, 0)), 0) as total_overdue,
        COALESCE(SUM(COALESCE(profit_lcy, 0)), 0) as total_profit,
        COALESCE(SUM(COALESCE(credit_limit_lcy, 0)), 0) as total_credit_limit
      FROM ${schema}.customer
      WHERE COALESCE(_fivetran_deleted, false) = false
      `
    : null

  const { data, error, isLoading, mutate } = useSWR<
    QueryResult<{
      total_customers: number
      customers_with_balance: number
      blocked_customers: number
      total_sales: number
      total_ar: number
      total_overdue: number
      total_profit: number
      total_credit_limit: number
    }>
  >(
    query ? ['customer-overview', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher(query!),
    {
      revalidateOnFocus: false,
    }
  )

  const overview = data?.data?.[0]
    ? {
        total_customers: Number(data.data[0].total_customers),
        customers_with_balance: Number(data.data[0].customers_with_balance),
        blocked_customers: Number(data.data[0].blocked_customers),
        total_sales: Number(data.data[0].total_sales),
        total_ar: Number(data.data[0].total_ar),
        total_overdue: Number(data.data[0].total_overdue),
        total_profit: Number(data.data[0].total_profit),
        total_credit_limit: Number(data.data[0].total_credit_limit),
      }
    : null

  return { data: overview, isLoading, error, mutate }
}
