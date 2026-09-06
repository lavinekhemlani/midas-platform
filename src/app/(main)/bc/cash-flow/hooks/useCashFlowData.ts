'use client'

import useSWR from 'swr'
import { useMemo } from 'react'

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Date range filter type for cash flow queries
 */
export interface DateRange {
  startDate: string | null // ISO format YYYY-MM-DD
  endDate: string | null // ISO format YYYY-MM-DD
}

/**
 * Generic query result type
 */
interface QueryResult<T> {
  success: boolean
  data: T[]
  count: number
  columns: string[]
  totalCount?: number
  error?: string
}

/**
 * Bank ledger transaction entry
 */
export interface BankLedgerTransactionRow {
  month: string
  entry_type: 'debit' | 'credit'
  transaction_count: number
  total_amount: number
  bank_account_no: string
  bank_account_name: string
}

/**
 * Cash flow by activity classification
 */
export interface CashFlowByActivityRow {
  month: string
  activity_type: 'operating' | 'investing' | 'financing'
  net_amount: number
  debit_amount: number
  credit_amount: number
}

/**
 * Monthly cash position trend
 */
export interface CashPositionTrendRow {
  month: string
  ending_cash: number
  cash_inflows: number
  cash_outflows: number
  net_change: number
}

/**
 * Cash flow statement summary
 */
export interface CashFlowStatementData {
  beginningCash: number
  operatingActivities: {
    netIncome: number
    adjustments: {
      depreciation: number
      accountsReceivableChange: number
      inventoryChange: number
      accountsPayableChange: number
      prepaidChange: number
      accruedLiabilitiesChange: number
      deferredRevenueChange: number
      otherAdjustments: number
    }
    totalOperating: number
  }
  investingActivities: {
    capitalExpenditures: number
    assetSales: number
    investments: number
    totalInvesting: number
  }
  financingActivities: {
    debtProceeds: number
    debtRepayments: number
    equityChanges: number
    dividends: number
    totalFinancing: number
  }
  netCashChange: number
  endingCash: number
}

/**
 * Key cash metrics
 */
export interface CashMetrics {
  operatingCashFlow: number
  freeCashFlow: number // OCF - CapEx
  cashRunway: number | null // months until cash depleted
  burnRate: number // monthly average net cash change
  cashConversionCycle: number | null // DSO + DIO - DPO
  operatingCashFlowRatio: number | null // OCF / Current Liabilities
}

/**
 * Bank account ledger entry row from database
 */
export interface BankAccountLedgerEntryRow {
  entry_no: number
  bank_account_no: string
  posting_date: string
  document_type: string
  document_no: string
  description: string
  debit_amount: number
  credit_amount: number
  amount: number
  bal_account_type: string
  bal_account_no: string
}

/**
 * Monthly bank ledger summary
 */
export interface MonthlyBankLedgerSummary {
  month: string
  total_debits: number
  total_credits: number
  net_change: number
  transaction_count: number
}

// ============================================================================
// Fetcher Function
// ============================================================================

/**
 * Fetcher function for warehouse API queries
 */
async function warehouseFetcher<T>(query: string): Promise<QueryResult<T>> {
  console.log('[useCashFlowData] Executing query:', query.substring(0, 100) + '...')

  const response = await fetch('/api/redshift/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    if (response.status === 403) {
      console.warn('[useCashFlowData] Schema access denied (403) — returning empty result')
      return { success: false, data: [] } as unknown as QueryResult<T>
    }
    console.error('[useCashFlowData] Query failed:', response.status, response.statusText)
    throw new Error(`Warehouse query failed: ${response.statusText}`)
  }

  const result = await response.json()
  console.log('[useCashFlowData] Query result:', {
    success: result.success,
    count: result.data?.length,
    error: result.error,
  })

  return result
}

// ============================================================================
// Hook: Bank Ledger Transactions
// ============================================================================

/**
 * Query bank_account_ledger_entry for cash movements
 * Groups by month and entry type (debit/credit)
 */
export function useBankLedgerTransactions(schema: string | null, dateRange?: DateRange) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND e.posting_date >= '${dateRange.startDate}' AND e.posting_date <= '${dateRange.endDate}'`
      : ''

  const query = schema
    ? `
    SELECT
      DATE_TRUNC('month', e.posting_date) AS month,
      b.no AS bank_account_no,
      b.name AS bank_account_name,
      CASE WHEN e.debit_amount > 0 THEN 'debit' ELSE 'credit' END AS entry_type,
      COUNT(*) AS transaction_count,
      SUM(CASE WHEN e.debit_amount > 0 THEN e.debit_amount ELSE e.credit_amount END) AS total_amount
    FROM ${schema}.bank_account_ledger_entry e
    JOIN ${schema}.bank_account b
      ON e.bank_account_no = b.no
      AND e.company_id = b.company_id
    WHERE e._fivetran_deleted = false
      AND b._fivetran_deleted = false
      ${dateFilter}
    GROUP BY DATE_TRUNC('month', e.posting_date), b.no, b.name,
             CASE WHEN e.debit_amount > 0 THEN 'debit' ELSE 'credit' END
    ORDER BY month DESC, bank_account_no
    LIMIT 200
  `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<BankLedgerTransactionRow>>(
    query ? ['bank-ledger-transactions', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher<BankLedgerTransactionRow>(query!),
    { revalidateOnFocus: false }
  )

  // Process data: group by month for summary
  const processedData = useMemo(() => {
    if (!data?.data?.length) return { byMonth: [], byAccount: [] }

    const byMonthMap = new Map<
      string,
      { month: string; debits: number; credits: number; transactions: number }
    >()
    const byAccountMap = new Map<
      string,
      { account_no: string; account_name: string; debits: number; credits: number }
    >()

    for (const row of data.data) {
      // Aggregate by month
      const monthKey = row.month
      const monthData = byMonthMap.get(monthKey) || {
        month: monthKey,
        debits: 0,
        credits: 0,
        transactions: 0,
      }
      if (row.entry_type === 'debit') {
        monthData.debits += Number(row.total_amount)
      } else {
        monthData.credits += Number(row.total_amount)
      }
      monthData.transactions += Number(row.transaction_count)
      byMonthMap.set(monthKey, monthData)

      // Aggregate by account
      const accountKey = row.bank_account_no
      const accountData = byAccountMap.get(accountKey) || {
        account_no: row.bank_account_no,
        account_name: row.bank_account_name,
        debits: 0,
        credits: 0,
      }
      if (row.entry_type === 'debit') {
        accountData.debits += Number(row.total_amount)
      } else {
        accountData.credits += Number(row.total_amount)
      }
      byAccountMap.set(accountKey, accountData)
    }

    return {
      byMonth: Array.from(byMonthMap.values()).sort(
        (a, b) => new Date(b.month).getTime() - new Date(a.month).getTime()
      ),
      byAccount: Array.from(byAccountMap.values()).sort(
        (a, b) => b.debits + b.credits - (a.debits + a.credits)
      ),
    }
  }, [data])

  return {
    data: data?.data || [],
    byMonth: processedData.byMonth,
    byAccount: processedData.byAccount,
    isLoading,
    error,
    mutate,
  }
}

// ============================================================================
// Hook: Cash Flow by Activity
// ============================================================================

/**
 * Classify cash flows into Operating/Investing/Financing activities
 * Uses g_l_entry joined with g_l_account and classifies based on account_category
 */
export function useCashFlowByActivity(schema: string | null, dateRange?: DateRange) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND e.posting_date >= '${dateRange.startDate}' AND e.posting_date <= '${dateRange.endDate}'`
      : ''

  // Classification logic:
  // - Operating: Income, Expense, Cost of Goods Sold accounts
  // - Investing: Asset accounts (excluding current assets like Cash, AR, Inventory)
  // - Financing: Liability and Equity accounts (excluding current liabilities like AP)
  const query = schema
    ? `
    SELECT
      DATE_TRUNC('month', e.posting_date) AS month,
      CASE
        WHEN a.account_category IN ('Income', 'Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
          THEN 'operating'
        WHEN a.account_category = 'Assets'
          AND a.account_subcategory_descript NOT ILIKE '%current%'
          AND a.account_subcategory_descript NOT ILIKE '%cash%'
          AND a.account_subcategory_descript NOT ILIKE '%receivable%'
          AND a.account_subcategory_descript NOT ILIKE '%inventory%'
          THEN 'investing'
        WHEN a.account_category IN ('Liabilities', 'Equity')
          AND a.account_subcategory_descript NOT ILIKE '%payable%'
          AND a.account_subcategory_descript NOT ILIKE '%accrued%'
          AND a.account_subcategory_descript NOT ILIKE '%current%'
          THEN 'financing'
        ELSE 'operating'
      END AS activity_type,
      SUM(e.debit_amount) AS debit_amount,
      SUM(e.credit_amount) AS credit_amount,
      SUM(e.credit_amount - e.debit_amount) AS net_amount
    FROM ${schema}.g_l_entry e
    JOIN ${schema}.g_l_account a
      ON e.g_laccount_no = a.no
      AND e.company_id = a.company_id
    WHERE e._fivetran_deleted = false
      AND e.reversed = false
      AND a._fivetran_deleted = false
      AND a.account_type = 'Posting'
      ${dateFilter}
    GROUP BY DATE_TRUNC('month', e.posting_date),
      CASE
        WHEN a.account_category IN ('Income', 'Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
          THEN 'operating'
        WHEN a.account_category = 'Assets'
          AND a.account_subcategory_descript NOT ILIKE '%current%'
          AND a.account_subcategory_descript NOT ILIKE '%cash%'
          AND a.account_subcategory_descript NOT ILIKE '%receivable%'
          AND a.account_subcategory_descript NOT ILIKE '%inventory%'
          THEN 'investing'
        WHEN a.account_category IN ('Liabilities', 'Equity')
          AND a.account_subcategory_descript NOT ILIKE '%payable%'
          AND a.account_subcategory_descript NOT ILIKE '%accrued%'
          AND a.account_subcategory_descript NOT ILIKE '%current%'
          THEN 'financing'
        ELSE 'operating'
      END
    ORDER BY month DESC, activity_type
    LIMIT 100
  `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<CashFlowByActivityRow>>(
    query ? ['cash-flow-by-activity', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher<CashFlowByActivityRow>(query!),
    { revalidateOnFocus: false }
  )

  // Process data: aggregate by activity type
  const summary = useMemo(() => {
    if (!data?.data?.length) return null

    const totals = {
      operating: 0,
      investing: 0,
      financing: 0,
    }

    for (const row of data.data) {
      const activity = row.activity_type as keyof typeof totals
      if (activity in totals) {
        totals[activity] += Number(row.net_amount)
      }
    }

    return totals
  }, [data])

  return {
    data: data?.data || [],
    summary,
    isLoading,
    error,
    mutate,
  }
}

// ============================================================================
// Hook: Cash Position Trend
// ============================================================================

/**
 * Monthly cash position over time
 * Queries bank_account balances or cumulative g_l_entry for cash accounts
 */
export function useCashPositionTrend(schema: string | null, dateRange?: DateRange) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND e.posting_date >= '${dateRange.startDate}' AND e.posting_date <= '${dateRange.endDate}'`
      : `AND e.posting_date >= CURRENT_DATE - INTERVAL '24 months'`

  // Query cash account transactions to track monthly cash position
  // Cash accounts are typically identified by subcategory containing 'cash' or 'bank'
  const query = schema
    ? `
    WITH monthly_cash AS (
      SELECT
        DATE_TRUNC('month', e.posting_date) AS month,
        SUM(CASE WHEN e.credit_amount > e.debit_amount THEN e.credit_amount - e.debit_amount ELSE 0 END) AS cash_inflows,
        SUM(CASE WHEN e.debit_amount > e.credit_amount THEN e.debit_amount - e.credit_amount ELSE 0 END) AS cash_outflows,
        SUM(e.debit_amount - e.credit_amount) AS net_change
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no
        AND e.company_id = a.company_id
      WHERE e._fivetran_deleted = false
        AND e.reversed = false
        AND a._fivetran_deleted = false
        AND a.account_type = 'Posting'
        AND a.account_category = 'Assets'
        AND (a.account_subcategory_descript ILIKE '%cash%'
             OR a.account_subcategory_descript ILIKE '%bank%'
             OR a.name ILIKE '%cash%'
             OR a.name ILIKE '%bank%')
        ${dateFilter}
      GROUP BY DATE_TRUNC('month', e.posting_date)
    )
    SELECT
      month,
      cash_inflows,
      cash_outflows,
      net_change,
      SUM(net_change) OVER (ORDER BY month ASC) AS ending_cash
    FROM monthly_cash
    ORDER BY month DESC
    LIMIT 24
  `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<CashPositionTrendRow>>(
    query ? ['cash-position-trend', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher<CashPositionTrendRow>(query!),
    { revalidateOnFocus: false }
  )

  // Calculate overall statistics
  const statistics = useMemo(() => {
    if (!data?.data?.length) return null

    const sorted = [...data.data].sort(
      (a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()
    )
    const latestMonth = sorted[sorted.length - 1]
    const previousMonth = sorted.length > 1 ? sorted[sorted.length - 2] : null

    const avgMonthlyChange =
      sorted.reduce((sum, row) => sum + Number(row.net_change), 0) / sorted.length
    const avgInflows =
      sorted.reduce((sum, row) => sum + Number(row.cash_inflows), 0) / sorted.length
    const avgOutflows =
      sorted.reduce((sum, row) => sum + Number(row.cash_outflows), 0) / sorted.length

    return {
      currentCash: Number(latestMonth?.ending_cash) || 0,
      previousCash: Number(previousMonth?.ending_cash) || 0,
      monthOverMonthChange: previousMonth
        ? Number(latestMonth?.ending_cash) - Number(previousMonth.ending_cash)
        : 0,
      avgMonthlyChange,
      avgInflows,
      avgOutflows,
      monthsOfData: sorted.length,
    }
  }, [data])

  return {
    data: data?.data || [],
    statistics,
    isLoading,
    error,
    mutate,
  }
}

// ============================================================================
// Hook: Cash Flow Statement
// ============================================================================

/**
 * Full cash flow statement data
 * Returns complete indirect method cash flow statement
 */
export function useCashFlowStatement(schema: string | null, dateRange?: DateRange) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND e.posting_date >= '${dateRange.startDate}' AND e.posting_date <= '${dateRange.endDate}'`
      : ''

  const priorDateFilter = dateRange?.startDate
    ? `AND e.posting_date < '${dateRange.startDate}'`
    : `AND e.posting_date < CURRENT_DATE - INTERVAL '12 months'`

  // Comprehensive query for cash flow statement components
  const query = schema
    ? `
    WITH
    -- Beginning cash (cumulative balance before start date)
    beginning_cash AS (
      SELECT COALESCE(SUM(e.debit_amount - e.credit_amount), 0) AS amount
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no AND e.company_id = a.company_id
      WHERE e._fivetran_deleted = false AND e.reversed = false
        AND a._fivetran_deleted = false AND a.account_type = 'Posting'
        AND a.account_category = 'Assets'
        AND (a.account_subcategory_descript ILIKE '%cash%' OR a.account_subcategory_descript ILIKE '%bank%')
        ${priorDateFilter}
    ),

    -- Net Income for the period
    net_income AS (
      SELECT
        SUM(CASE WHEN a.account_category = 'Income' THEN e.credit_amount - e.debit_amount ELSE 0 END)
        - SUM(CASE WHEN a.account_category IN ('Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
              THEN e.debit_amount - e.credit_amount ELSE 0 END) AS amount
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no AND e.company_id = a.company_id
      WHERE e._fivetran_deleted = false AND e.reversed = false
        AND a._fivetran_deleted = false AND a.account_type = 'Posting'
        AND a.account_category IN ('Income', 'Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
        ${dateFilter}
    ),

    -- Depreciation (non-cash expense) - typically in accumulated depreciation accounts
    depreciation AS (
      SELECT COALESCE(SUM(e.credit_amount - e.debit_amount), 0) AS amount
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no AND e.company_id = a.company_id
      WHERE e._fivetran_deleted = false AND e.reversed = false
        AND a._fivetran_deleted = false AND a.account_type = 'Posting'
        AND (a.name ILIKE '%depreciation%' OR a.account_subcategory_descript ILIKE '%depreciation%')
        ${dateFilter}
    ),

    -- Change in AR (decrease = cash inflow)
    ar_change AS (
      SELECT COALESCE(SUM(e.credit_amount - e.debit_amount), 0) AS amount
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no AND e.company_id = a.company_id
      WHERE e._fivetran_deleted = false AND e.reversed = false
        AND a._fivetran_deleted = false AND a.account_type = 'Posting'
        AND a.account_category = 'Assets'
        AND (a.account_subcategory_descript ILIKE '%receivable%' OR a.name ILIKE '%receivable%')
        ${dateFilter}
    ),

    -- Change in Inventory (decrease = cash inflow)
    inventory_change AS (
      SELECT COALESCE(SUM(e.credit_amount - e.debit_amount), 0) AS amount
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no AND e.company_id = a.company_id
      WHERE e._fivetran_deleted = false AND e.reversed = false
        AND a._fivetran_deleted = false AND a.account_type = 'Posting'
        AND a.account_category = 'Assets'
        AND (a.account_subcategory_descript ILIKE '%inventory%' OR a.name ILIKE '%inventory%')
        ${dateFilter}
    ),

    -- Change in AP (increase = cash inflow)
    ap_change AS (
      SELECT COALESCE(SUM(e.credit_amount - e.debit_amount), 0) AS amount
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no AND e.company_id = a.company_id
      WHERE e._fivetran_deleted = false AND e.reversed = false
        AND a._fivetran_deleted = false AND a.account_type = 'Posting'
        AND a.account_category = 'Liabilities'
        AND (a.account_subcategory_descript ILIKE '%payable%' OR a.name ILIKE '%payable%')
        ${dateFilter}
    ),

    -- Change in Prepaid Expenses (decrease = cash was spent earlier, no current cash impact)
    prepaid_change AS (
      SELECT COALESCE(SUM(e.credit_amount - e.debit_amount), 0) AS amount
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no AND e.company_id = a.company_id
      WHERE e._fivetran_deleted = false AND e.reversed = false
        AND a._fivetran_deleted = false AND a.account_type = 'Posting'
        AND a.account_category = 'Assets'
        AND (a.account_subcategory_descript ILIKE '%prepaid%' OR a.name ILIKE '%prepaid%')
        ${dateFilter}
    ),

    -- Change in Accrued Liabilities (increase = cash inflow, expense recognized but not yet paid)
    accrued_liabilities_change AS (
      SELECT COALESCE(SUM(e.credit_amount - e.debit_amount), 0) AS amount
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no AND e.company_id = a.company_id
      WHERE e._fivetran_deleted = false AND e.reversed = false
        AND a._fivetran_deleted = false AND a.account_type = 'Posting'
        AND a.account_category = 'Liabilities'
        AND (a.account_subcategory_descript ILIKE '%accrued%' OR a.name ILIKE '%accrued%')
        ${dateFilter}
    ),

    -- Change in Deferred Revenue (increase = cash received but not yet earned)
    deferred_revenue_change AS (
      SELECT COALESCE(SUM(e.credit_amount - e.debit_amount), 0) AS amount
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no AND e.company_id = a.company_id
      WHERE e._fivetran_deleted = false AND e.reversed = false
        AND a._fivetran_deleted = false AND a.account_type = 'Posting'
        AND a.account_category = 'Liabilities'
        AND (a.account_subcategory_descript ILIKE '%deferred%' OR a.name ILIKE '%deferred%' OR a.name ILIKE '%unearned%')
        ${dateFilter}
    ),

    -- Fixed asset changes (investing)
    fixed_asset_change AS (
      SELECT COALESCE(SUM(e.debit_amount - e.credit_amount), 0) AS amount
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no AND e.company_id = a.company_id
      WHERE e._fivetran_deleted = false AND e.reversed = false
        AND a._fivetran_deleted = false AND a.account_type = 'Posting'
        AND a.account_category = 'Assets'
        AND (a.account_subcategory_descript ILIKE '%fixed%'
             OR a.account_subcategory_descript ILIKE '%property%'
             OR a.account_subcategory_descript ILIKE '%equipment%')
        ${dateFilter}
    ),

    -- Debt changes (financing)
    debt_change AS (
      SELECT COALESCE(SUM(e.credit_amount - e.debit_amount), 0) AS amount
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no AND e.company_id = a.company_id
      WHERE e._fivetran_deleted = false AND e.reversed = false
        AND a._fivetran_deleted = false AND a.account_type = 'Posting'
        AND a.account_category = 'Liabilities'
        AND a.account_subcategory_descript NOT ILIKE '%payable%'
        AND a.account_subcategory_descript NOT ILIKE '%accrued%'
        AND a.account_subcategory_descript NOT ILIKE '%current%'
        ${dateFilter}
    ),

    -- Equity changes (financing)
    equity_change AS (
      SELECT COALESCE(SUM(e.credit_amount - e.debit_amount), 0) AS amount
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no AND e.company_id = a.company_id
      WHERE e._fivetran_deleted = false AND e.reversed = false
        AND a._fivetran_deleted = false AND a.account_type = 'Posting'
        AND a.account_category = 'Equity'
        ${dateFilter}
    ),

    -- Ending cash balance (cumulative up to end date)
    ending_cash AS (
      SELECT COALESCE(SUM(e.debit_amount - e.credit_amount), 0) AS amount
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no AND e.company_id = a.company_id
      WHERE e._fivetran_deleted = false AND e.reversed = false
        AND a._fivetran_deleted = false AND a.account_type = 'Posting'
        AND a.account_category = 'Assets'
        AND (a.account_subcategory_descript ILIKE '%cash%' OR a.account_subcategory_descript ILIKE '%bank%')
        ${dateRange?.endDate ? `AND e.posting_date <= '${dateRange.endDate}'` : ''}
    )

    SELECT
      (SELECT amount FROM beginning_cash) AS beginning_cash,
      (SELECT amount FROM net_income) AS net_income,
      (SELECT amount FROM depreciation) AS depreciation,
      (SELECT amount FROM ar_change) AS ar_change,
      (SELECT amount FROM inventory_change) AS inventory_change,
      (SELECT amount FROM ap_change) AS ap_change,
      (SELECT amount FROM prepaid_change) AS prepaid_change,
      (SELECT amount FROM accrued_liabilities_change) AS accrued_liabilities_change,
      (SELECT amount FROM deferred_revenue_change) AS deferred_revenue_change,
      (SELECT amount FROM fixed_asset_change) AS fixed_asset_change,
      (SELECT amount FROM debt_change) AS debt_change,
      (SELECT amount FROM equity_change) AS equity_change,
      (SELECT amount FROM ending_cash) AS ending_cash
  `
    : null

  const { data, error, isLoading, mutate } = useSWR<
    QueryResult<{
      beginning_cash: number
      net_income: number
      depreciation: number
      ar_change: number
      inventory_change: number
      ap_change: number
      prepaid_change: number
      accrued_liabilities_change: number
      deferred_revenue_change: number
      fixed_asset_change: number
      debt_change: number
      equity_change: number
      ending_cash: number
    }>
  >(
    query ? ['cash-flow-statement', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher(query!),
    { revalidateOnFocus: false }
  )

  // Process into structured cash flow statement
  const statement = useMemo((): CashFlowStatementData | null => {
    if (!data?.data?.[0]) return null

    const raw = data.data[0]
    const beginningCash = Number(raw.beginning_cash) || 0
    const netIncome = Number(raw.net_income) || 0
    const depreciation = Number(raw.depreciation) || 0
    const arChange = Number(raw.ar_change) || 0 // Decrease in AR = cash inflow
    const inventoryChange = Number(raw.inventory_change) || 0 // Decrease = cash inflow
    const apChange = Number(raw.ap_change) || 0 // Increase in AP = cash inflow
    const prepaidChange = Number(raw.prepaid_change) || 0 // Decrease in prepaid = cash inflow
    const accruedLiabilitiesChange = Number(raw.accrued_liabilities_change) || 0 // Increase = cash inflow
    const deferredRevenueChange = Number(raw.deferred_revenue_change) || 0 // Increase = cash inflow
    const fixedAssetChange = -Number(raw.fixed_asset_change) || 0 // Negative = capital expenditure
    const debtChange = Number(raw.debt_change) || 0
    const equityChange = Number(raw.equity_change) || 0
    const endingCash = Number(raw.ending_cash) || 0

    // Operating activities (indirect method)
    const otherAdjustments = prepaidChange + accruedLiabilitiesChange + deferredRevenueChange
    const totalOperating =
      netIncome + depreciation + arChange + inventoryChange + apChange + otherAdjustments

    // Investing activities
    const capitalExpenditures = Math.min(fixedAssetChange, 0) // Only outflows
    const assetSales = Math.max(fixedAssetChange, 0) // Only inflows
    const totalInvesting = fixedAssetChange

    // Financing activities
    const debtProceeds = Math.max(debtChange, 0)
    const debtRepayments = Math.min(debtChange, 0)
    const totalFinancing = debtChange + equityChange

    const netCashChange = totalOperating + totalInvesting + totalFinancing

    return {
      beginningCash,
      operatingActivities: {
        netIncome,
        adjustments: {
          depreciation,
          accountsReceivableChange: arChange,
          inventoryChange,
          accountsPayableChange: apChange,
          prepaidChange,
          accruedLiabilitiesChange,
          deferredRevenueChange,
          otherAdjustments,
        },
        totalOperating,
      },
      investingActivities: {
        capitalExpenditures,
        assetSales,
        investments: 0,
        totalInvesting,
      },
      financingActivities: {
        debtProceeds,
        debtRepayments,
        equityChanges: equityChange,
        dividends: 0, // Would need specific dividend account tracking
        totalFinancing,
      },
      netCashChange,
      endingCash: beginningCash + netCashChange,
    }
  }, [data])

  return {
    data: statement,
    rawData: data?.data?.[0] || null,
    isLoading,
    error,
    mutate,
  }
}

// ============================================================================
// Hook: Cash Metrics
// ============================================================================

/**
 * Key cash metrics including:
 * - Operating Cash Flow
 * - Free Cash Flow (OCF - CapEx)
 * - Cash Runway (months until cash depleted)
 * - Burn Rate (monthly average)
 */
export function useCashMetrics(schema: string | null, dateRange?: DateRange) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND e.posting_date >= '${dateRange.startDate}' AND e.posting_date <= '${dateRange.endDate}'`
      : `AND e.posting_date >= CURRENT_DATE - INTERVAL '12 months'`

  const query = schema
    ? `
    WITH
    -- Current cash balance
    current_cash AS (
      SELECT COALESCE(SUM(balance_lcy), 0) AS amount
      FROM ${schema}.bank_account
      WHERE _fivetran_deleted = false
    ),

    -- Operating metrics (last 12 months or date range)
    operating_metrics AS (
      SELECT
        -- Net Income
        SUM(CASE WHEN a.account_category = 'Income'
            THEN e.credit_amount - e.debit_amount ELSE 0 END) AS revenue,
        SUM(CASE WHEN a.account_category IN ('Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
            THEN e.debit_amount - e.credit_amount ELSE 0 END) AS expenses,
        -- Depreciation add-back
        SUM(CASE WHEN a.name ILIKE '%depreciation%' OR a.account_subcategory_descript ILIKE '%depreciation%'
            THEN e.credit_amount - e.debit_amount ELSE 0 END) AS depreciation,
        -- Working capital changes
        SUM(CASE WHEN a.account_category = 'Assets'
            AND (a.account_subcategory_descript ILIKE '%receivable%')
            THEN e.credit_amount - e.debit_amount ELSE 0 END) AS ar_change,
        SUM(CASE WHEN a.account_category = 'Liabilities'
            AND (a.account_subcategory_descript ILIKE '%payable%')
            THEN e.credit_amount - e.debit_amount ELSE 0 END) AS ap_change,
        SUM(CASE WHEN a.account_category = 'Assets'
            AND (a.account_subcategory_descript ILIKE '%prepaid%' OR a.name ILIKE '%prepaid%')
            THEN e.credit_amount - e.debit_amount ELSE 0 END) AS prepaid_change,
        SUM(CASE WHEN a.account_category = 'Liabilities'
            AND (a.account_subcategory_descript ILIKE '%accrued%' OR a.name ILIKE '%accrued%')
            THEN e.credit_amount - e.debit_amount ELSE 0 END) AS accrued_liabilities_change,
        SUM(CASE WHEN a.account_category = 'Liabilities'
            AND (a.account_subcategory_descript ILIKE '%deferred%' OR a.name ILIKE '%deferred%' OR a.name ILIKE '%unearned%')
            THEN e.credit_amount - e.debit_amount ELSE 0 END) AS deferred_revenue_change,
        COUNT(DISTINCT DATE_TRUNC('month', e.posting_date)) AS months_count
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no AND e.company_id = a.company_id
      WHERE e._fivetran_deleted = false AND e.reversed = false
        AND a._fivetran_deleted = false AND a.account_type = 'Posting'
        ${dateFilter}
    ),

    -- Capital expenditures (fixed asset purchases)
    capex AS (
      SELECT COALESCE(SUM(e.debit_amount - e.credit_amount), 0) AS amount
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no AND e.company_id = a.company_id
      WHERE e._fivetran_deleted = false AND e.reversed = false
        AND a._fivetran_deleted = false AND a.account_type = 'Posting'
        AND a.account_category = 'Assets'
        AND (a.account_subcategory_descript ILIKE '%fixed%'
             OR a.account_subcategory_descript ILIKE '%property%'
             OR a.account_subcategory_descript ILIKE '%equipment%')
        ${dateFilter}
    ),

    -- Current liabilities for OCF ratio
    current_liabilities AS (
      SELECT COALESCE(SUM(e.credit_amount - e.debit_amount), 0) AS amount
      FROM ${schema}.g_l_entry e
      JOIN ${schema}.g_l_account a
        ON e.g_laccount_no = a.no AND e.company_id = a.company_id
      WHERE e._fivetran_deleted = false AND e.reversed = false
        AND a._fivetran_deleted = false AND a.account_type = 'Posting'
        AND a.account_category = 'Liabilities'
        AND (a.account_subcategory_descript ILIKE '%current%'
             OR a.account_subcategory_descript ILIKE '%payable%'
             OR a.account_subcategory_descript ILIKE '%accrued%')
    )

    SELECT
      (SELECT amount FROM current_cash) AS current_cash,
      om.revenue,
      om.expenses,
      om.depreciation,
      om.ar_change,
      om.ap_change,
      om.prepaid_change,
      om.accrued_liabilities_change,
      om.deferred_revenue_change,
      om.months_count,
      (SELECT amount FROM capex) AS capex,
      (SELECT amount FROM current_liabilities) AS current_liabilities
    FROM operating_metrics om
  `
    : null

  const { data, error, isLoading, mutate } = useSWR<
    QueryResult<{
      current_cash: number
      revenue: number
      expenses: number
      depreciation: number
      ar_change: number
      ap_change: number
      prepaid_change: number
      accrued_liabilities_change: number
      deferred_revenue_change: number
      months_count: number
      capex: number
      current_liabilities: number
    }>
  >(
    query ? ['cash-metrics', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher(query!),
    { revalidateOnFocus: false }
  )

  // Calculate metrics
  const metrics = useMemo((): CashMetrics | null => {
    if (!data?.data?.[0]) return null

    const raw = data.data[0]
    const currentCash = Number(raw.current_cash) || 0
    const revenue = Number(raw.revenue) || 0
    const expenses = Number(raw.expenses) || 0
    const depreciation = Number(raw.depreciation) || 0
    const arChange = Number(raw.ar_change) || 0
    const apChange = Number(raw.ap_change) || 0
    const prepaidChange = Number(raw.prepaid_change) || 0
    const accruedLiabilitiesChange = Number(raw.accrued_liabilities_change) || 0
    const deferredRevenueChange = Number(raw.deferred_revenue_change) || 0
    const monthsCount = Math.max(Number(raw.months_count) || 1, 1)
    const capex = Number(raw.capex) || 0
    const currentLiabilities = Number(raw.current_liabilities) || 0

    // Net Income
    const netIncome = revenue - expenses

    // Operating Cash Flow = Net Income + Depreciation + Working Capital Changes
    const otherWcChanges = prepaidChange + accruedLiabilitiesChange + deferredRevenueChange
    const operatingCashFlow = netIncome + depreciation + arChange + apChange + otherWcChanges

    // Free Cash Flow = OCF - Capital Expenditures
    const freeCashFlow = operatingCashFlow - capex

    // Monthly averages
    const monthlyOCF = operatingCashFlow / monthsCount
    const monthlyFCF = freeCashFlow / monthsCount

    // Burn Rate (if negative FCF)
    const burnRate = monthlyFCF < 0 ? Math.abs(monthlyFCF) : 0

    // Cash Runway (months until cash depleted)
    let cashRunway: number | null = null
    if (burnRate > 0 && currentCash > 0) {
      cashRunway = currentCash / burnRate
    } else if (monthlyFCF >= 0) {
      cashRunway = null // Not burning cash
    }

    // Operating Cash Flow Ratio = OCF / Current Liabilities
    const operatingCashFlowRatio =
      currentLiabilities > 0 ? operatingCashFlow / currentLiabilities : null

    return {
      operatingCashFlow,
      freeCashFlow,
      cashRunway,
      burnRate,
      cashConversionCycle: null, // Would need DSO, DIO, DPO calculation
      operatingCashFlowRatio,
    }
  }, [data])

  return {
    data: metrics,
    rawData: data?.data?.[0] || null,
    isLoading,
    error,
    mutate,
  }
}

// ============================================================================
// Hook: Monthly Bank Ledger Summary
// ============================================================================

/**
 * Monthly summary of bank account ledger entries
 */
export function useMonthlyBankLedgerSummary(schema: string | null, dateRange?: DateRange) {
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND posting_date >= '${dateRange.startDate}' AND posting_date <= '${dateRange.endDate}'`
      : `AND posting_date >= CURRENT_DATE - INTERVAL '24 months'`

  const query = schema
    ? `
    SELECT
      DATE_TRUNC('month', posting_date) AS month,
      SUM(debit_amount) AS total_debits,
      SUM(credit_amount) AS total_credits,
      SUM(debit_amount - credit_amount) AS net_change,
      COUNT(*) AS transaction_count
    FROM ${schema}.bank_account_ledger_entry
    WHERE _fivetran_deleted = false
      ${dateFilter}
    GROUP BY DATE_TRUNC('month', posting_date)
    ORDER BY month DESC
    LIMIT 24
  `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<MonthlyBankLedgerSummary>>(
    query
      ? ['monthly-bank-ledger-summary', schema, dateRange?.startDate, dateRange?.endDate]
      : null,
    () => warehouseFetcher<MonthlyBankLedgerSummary>(query!),
    { revalidateOnFocus: false }
  )

  return {
    data: data?.data || [],
    isLoading,
    error,
    mutate,
  }
}

// ============================================================================
// Hook: Current Bank Account Balances
// ============================================================================

/**
 * Current bank account balances for cash position
 */
export interface BankAccountBalance {
  no: string
  name: string
  balance_lcy: number
  currency_code: string
}

export function useBankAccountBalances(schema: string | null) {
  const query = schema
    ? `
    SELECT
      no,
      name,
      COALESCE(balance_lcy, 0) AS balance_lcy,
      COALESCE(currency_code, '') AS currency_code
    FROM ${schema}.bank_account
    WHERE _fivetran_deleted = false
    ORDER BY balance_lcy DESC
  `
    : null

  const { data, error, isLoading, mutate } = useSWR<QueryResult<BankAccountBalance>>(
    query ? ['bank-account-balances', schema] : null,
    () => warehouseFetcher<BankAccountBalance>(query!),
    { revalidateOnFocus: false }
  )

  const totalCash = useMemo(() => {
    if (!data?.data?.length) return 0
    return data.data.reduce((sum, account) => sum + Number(account.balance_lcy), 0)
  }, [data])

  return {
    data: data?.data || [],
    totalCash,
    isLoading,
    error,
    mutate,
  }
}

// ============================================================================
// Aggregated Hook: All Cash Flow Data
// ============================================================================

/**
 * Aggregated hook for all cash flow data
 * Provides a single hook to fetch all cash flow related data
 */
export function useCashFlowData(schema: string | null, dateRange?: DateRange) {
  console.log('[useCashFlowData] Called with schema:', schema, 'dateRange:', dateRange)

  const bankLedger = useBankLedgerTransactions(schema, dateRange)
  const cashFlowByActivity = useCashFlowByActivity(schema, dateRange)
  const cashPositionTrend = useCashPositionTrend(schema, dateRange)
  const cashFlowStatement = useCashFlowStatement(schema, dateRange)
  const cashMetrics = useCashMetrics(schema, dateRange)
  const bankBalances = useBankAccountBalances(schema)
  const monthlyBankLedger = useMonthlyBankLedgerSummary(schema, dateRange)

  const isLoading =
    bankLedger.isLoading ||
    cashFlowByActivity.isLoading ||
    cashPositionTrend.isLoading ||
    cashFlowStatement.isLoading ||
    cashMetrics.isLoading ||
    bankBalances.isLoading ||
    monthlyBankLedger.isLoading

  const hasError =
    bankLedger.error ||
    cashFlowByActivity.error ||
    cashPositionTrend.error ||
    cashFlowStatement.error ||
    cashMetrics.error ||
    bankBalances.error ||
    monthlyBankLedger.error

  // Mutate all function to refresh all data
  const mutateAll = () => {
    console.log('[useCashFlowData] Refreshing all data...')
    bankLedger.mutate()
    cashFlowByActivity.mutate()
    cashPositionTrend.mutate()
    cashFlowStatement.mutate()
    cashMetrics.mutate()
    bankBalances.mutate()
    monthlyBankLedger.mutate()
  }

  return {
    // Individual data sets
    bankLedgerTransactions: bankLedger.data,
    bankLedgerByMonth: bankLedger.byMonth,
    bankLedgerByAccount: bankLedger.byAccount,
    cashFlowByActivity: cashFlowByActivity.data,
    cashFlowActivitySummary: cashFlowByActivity.summary,
    cashPositionTrend: cashPositionTrend.data,
    cashPositionStatistics: cashPositionTrend.statistics,
    cashFlowStatement: cashFlowStatement.data,
    cashMetrics: cashMetrics.data,
    bankAccountBalances: bankBalances.data,
    totalCash: bankBalances.totalCash,
    monthlyBankLedger: monthlyBankLedger.data,

    // Status
    isLoading,
    error: hasError,
    mutate: mutateAll,
  }
}
