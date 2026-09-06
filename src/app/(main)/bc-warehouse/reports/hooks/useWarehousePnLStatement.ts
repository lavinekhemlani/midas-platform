'use client'

import useSWR from 'swr'
import { useMemo } from 'react'

// Redshift Data API returns DECIMAL/NUMERIC as stringValue — must parse to number
const num = (v: unknown): number => {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v) || 0
  return 0
}

// Date range filter type
export interface DateRange {
  startDate: string | null // ISO format YYYY-MM-DD
  endDate: string | null // ISO format YYYY-MM-DD
}

// Types for G/L Account from Business Central
export interface GLAccount {
  no: string
  name: string
  account_type: string // 'Posting', 'Heading', 'Total', 'Begin-Total', 'End-Total' (Fivetran encodes as _x002D_ for hyphens)
  account_category: string // 'Income', 'Expense', 'Cost of Goods Sold', 'Assets', 'Liabilities', 'Equity', '' (Fivetran encodes spaces as _x0020_)
  account_subcategory_descript: string // More granular category
  debit_credit: string // 'Debit', 'Credit', 'Both'
  blocked: boolean
  indentation?: number // BC uses this for hierarchy
  totaling?: string // For total accounts, which accounts to sum
}

// Types for GL Entry aggregated by account
export interface GLAccountTotal {
  g_laccount_no: string
  g_laccount_name: string
  account_type: string
  account_category: string
  account_subcategory_descript: string
  total_debits: number
  total_credits: number
  net_balance: number
  debit_credit: string
}

// P&L Line Item (similar to QuickBooks structure)
export interface PnLLineItem {
  id: string
  name: string
  accountNo?: string
  amount: number
  category: 'Revenue' | 'Cost of Goods Sold' | 'Expenses' | 'Other Income' | 'Other Expenses'
  subcategory?: string

  // Display flags
  isHeader?: boolean
  isSubHeader?: boolean
  isChild?: boolean
  isSubtotal?: boolean
  isTotal?: boolean
  isFinalTotal?: boolean
  isCollapsible?: boolean
  isExpanded?: boolean

  // Hierarchy
  nestingLevel: number
  childCount?: number
  children?: PnLLineItem[]
}

// Query result type
interface QueryResult<T> {
  success: boolean
  data: T[]
  count: number
  columns: string[]
  error?: string
}

// Fetcher for warehouse queries
async function warehouseFetcher<T>(query: string): Promise<QueryResult<T>> {
  console.log('[useWarehousePnLStatement] Executing query:', query.substring(0, 100) + '...')

  const response = await fetch('/api/redshift/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    if (response.status === 403) {
      console.warn('[pnlStatement] Schema access denied (403) — returning empty result')
      return { success: false, data: [] } as any
    }
    throw new Error(`Query failed: ${response.statusText}`)
  }

  const result = await response.json()
  console.log('[useWarehousePnLStatement] Query result:', {
    success: result.success,
    count: result.data?.length,
    error: result.error,
  })

  return result
}

// Hook to fetch P&L data with account hierarchy
export function useWarehousePnLStatement(schema: string | null, dateRange?: DateRange) {
  // Build date filter clause
  const dateFilter =
    dateRange?.startDate && dateRange?.endDate
      ? `AND e.posting_date >= '${dateRange.startDate}' AND e.posting_date <= '${dateRange.endDate}'`
      : ''

  // Query that joins g_l_account with g_l_entry totals
  // This gives us account metadata + transaction totals
  const query = schema
    ? `
    SELECT
      a.no AS g_laccount_no,
      a.name AS g_laccount_name,
      a.account_type,
      REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') AS account_category,
      REPLACE(REPLACE(a.account_subcategory_descript, '_x0020_', ' '), '_x002D_', '-') AS account_subcategory_descript,
      a.debit_credit,
      COALESCE(SUM(e.debit_amount), 0) AS total_debits,
      COALESCE(SUM(e.credit_amount), 0) AS total_credits,
      COALESCE(SUM(e.amount), 0) AS net_balance
    FROM ${schema}.g_l_account a
    LEFT JOIN ${schema}.g_l_entry e
      ON a.no = e.g_laccount_no
      AND a.company_id = e.company_id
      AND e._fivetran_deleted = false
      AND e.reversed = false
      ${dateFilter}
    WHERE a._fivetran_deleted = false
      AND a.account_type = 'Posting'
      AND a.account_category IN ('Income', 'Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
    GROUP BY a.no, a.name, a.account_type, a.account_category, a.account_subcategory_descript, a.debit_credit
    HAVING COALESCE(SUM(e.debit_amount), 0) != 0 OR COALESCE(SUM(e.credit_amount), 0) != 0
    ORDER BY a.no
    LIMIT 10000
  `
    : null

  const { data, error, isLoading, isValidating, mutate } = useSWR<QueryResult<GLAccountTotal>>(
    query ? ['pnl-statement', schema, dateRange?.startDate, dateRange?.endDate] : null,
    () => warehouseFetcher<GLAccountTotal>(query!),
    { revalidateOnFocus: false }
  )

  // Process data into P&L hierarchy
  const pnlData = useMemo(() => {
    if (!data?.data?.length) {
      console.log('[useWarehousePnLStatement] No data to process')
      return null
    }

    console.log('[useWarehousePnLStatement] Processing', data.data.length, 'accounts')

    // Categorize accounts
    const revenueAccounts: GLAccountTotal[] = []
    const cogsAccounts: GLAccountTotal[] = []
    const expenseAccounts: GLAccountTotal[] = []
    const otherIncomeAccounts: GLAccountTotal[] = []
    const otherExpenseAccounts: GLAccountTotal[] = []

    for (const account of data.data) {
      // In BC, Income accounts with Credit balance = Revenue
      // Expense accounts with Debit balance = Expenses
      // COGS is explicitly categorized

      if (account.account_category === 'Income') {
        // Check subcategory for other income vs revenue
        const subcat = account.account_subcategory_descript?.toLowerCase() || ''
        if (subcat.includes('other') || subcat.includes('interest') || subcat.includes('gain')) {
          otherIncomeAccounts.push(account)
        } else {
          revenueAccounts.push(account)
        }
      } else if (account.account_category === 'Cost of Goods Sold') {
        cogsAccounts.push(account)
      } else if (account.account_category === 'Expense') {
        // Check subcategory for other expenses
        const subcat = account.account_subcategory_descript?.toLowerCase() || ''
        if (subcat.includes('other') || subcat.includes('interest') || subcat.includes('loss')) {
          otherExpenseAccounts.push(account)
        } else {
          expenseAccounts.push(account)
        }
      }
    }

    // Group by subcategory
    const groupBySubcategory = (accounts: GLAccountTotal[]) => {
      const groups: Record<string, GLAccountTotal[]> = {}
      for (const acc of accounts) {
        const key = acc.account_subcategory_descript || 'Other'
        if (!groups[key]) groups[key] = []
        groups[key].push(acc)
      }
      return groups
    }

    const revenueGroups = groupBySubcategory(revenueAccounts)
    const cogsGroups = groupBySubcategory(cogsAccounts)
    const expenseGroups = groupBySubcategory(expenseAccounts)
    const otherIncomeGroups = groupBySubcategory(otherIncomeAccounts)
    const otherExpenseGroups = groupBySubcategory(otherExpenseAccounts)

    // Calculate totals - for income accounts, credit increases the balance
    // For expense accounts, debit increases the balance
    const calcTotal = (accounts: GLAccountTotal[], isIncome: boolean) => {
      return accounts.reduce((sum, acc) => {
        // Income: credits are positive (revenue)
        // Expense: debits are positive (expenses)
        if (isIncome) {
          return sum + num(acc.total_credits) - num(acc.total_debits)
        } else {
          return sum + num(acc.total_debits) - num(acc.total_credits)
        }
      }, 0)
    }

    const totalRevenue = calcTotal(revenueAccounts, true)
    const totalCOGS = calcTotal(cogsAccounts, false)
    const totalExpenses = calcTotal(expenseAccounts, false)
    const totalOtherIncome = calcTotal(otherIncomeAccounts, true)
    const totalOtherExpenses = calcTotal(otherExpenseAccounts, false)

    const grossProfit = totalRevenue - totalCOGS
    const operatingIncome = grossProfit - totalExpenses
    const netOtherIncome = totalOtherIncome - totalOtherExpenses
    const netIncome = operatingIncome + netOtherIncome

    console.log('[useWarehousePnLStatement] Totals:', {
      revenue: totalRevenue,
      cogs: totalCOGS,
      grossProfit,
      expenses: totalExpenses,
      operatingIncome,
      otherIncome: totalOtherIncome,
      otherExpenses: totalOtherExpenses,
      netIncome,
    })

    return {
      revenueAccounts,
      revenueGroups,
      cogsAccounts,
      cogsGroups,
      expenseAccounts,
      expenseGroups,
      otherIncomeAccounts,
      otherIncomeGroups,
      otherExpenseAccounts,
      otherExpenseGroups,

      totals: {
        totalRevenue,
        totalCOGS,
        grossProfit,
        totalExpenses,
        operatingIncome,
        totalOtherIncome,
        totalOtherExpenses,
        netOtherIncome,
        netIncome,
      },
    }
  }, [data])

  return {
    data: pnlData,
    rawData: data?.data || [],
    isLoading,
    isValidating,
    error,
    mutate,
  }
}

// Hook to fetch Balance Sheet data
// IMPORTANT: This hook also fetches Income/Expense accounts to calculate "Profit for the Period"
// which is added to Equity for a properly balanced Balance Sheet (Assets = Liabilities + Equity)
//
// Both BS and P&L queries use CUMULATIVE filters (posting_date <= endDate, no start date).
// This matches BC's behavior: BC's year-end "Close Income Statement" zeroes P&L for closed years,
// so cumulative P&L automatically equals only the current unclosed fiscal year's profit.
// This approach works for ANY selected period (last week, last quarter, last 6 months, custom, etc.)
export function useWarehouseBalanceSheet(schema: string | null, dateRange?: DateRange) {
  // Cumulative "as of" filter — both BS accounts and P&L use the same cutoff
  const cumulativeDateFilter = dateRange?.endDate
    ? `AND e.posting_date <= '${dateRange.endDate}'`
    : ''

  // Query for Balance Sheet accounts (Assets, Liabilities, Equity) — cumulative up to endDate
  const bsQuery = schema
    ? `
    SELECT
      a.no AS g_laccount_no,
      a.name AS g_laccount_name,
      a.account_type,
      REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') AS account_category,
      REPLACE(REPLACE(a.account_subcategory_descript, '_x0020_', ' '), '_x002D_', '-') AS account_subcategory_descript,
      a.debit_credit,
      COALESCE(SUM(e.debit_amount), 0) AS total_debits,
      COALESCE(SUM(e.credit_amount), 0) AS total_credits,
      COALESCE(SUM(e.amount), 0) AS net_balance
    FROM ${schema}.g_l_account a
    LEFT JOIN ${schema}.g_l_entry e
      ON a.no = e.g_laccount_no
      AND a.company_id = e.company_id
      AND e._fivetran_deleted = false
      AND e.reversed = false
      ${cumulativeDateFilter}
    WHERE a._fivetran_deleted = false
      AND a.account_type = 'Posting'
      AND a.account_category IN ('Assets', 'Liabilities', 'Equity')
    GROUP BY a.no, a.name, a.account_type, a.account_category, a.account_subcategory_descript, a.debit_credit
    ORDER BY a.no
    LIMIT 10000
  `
    : null

  // Query for Income/Expense accounts — ALSO cumulative up to endDate
  // BC's closing entries zero P&L for closed fiscal years, so cumulative P&L = current open year's profit
  const pnlQuery = schema
    ? `
    SELECT
      a.no AS g_laccount_no,
      a.name AS g_laccount_name,
      a.account_type,
      REPLACE(REPLACE(a.account_category, '_x0020_', ' '), '_x002D_', '-') AS account_category,
      REPLACE(REPLACE(a.account_subcategory_descript, '_x0020_', ' '), '_x002D_', '-') AS account_subcategory_descript,
      a.debit_credit,
      COALESCE(SUM(e.debit_amount), 0) AS total_debits,
      COALESCE(SUM(e.credit_amount), 0) AS total_credits,
      COALESCE(SUM(e.amount), 0) AS net_balance
    FROM ${schema}.g_l_account a
    LEFT JOIN ${schema}.g_l_entry e
      ON a.no = e.g_laccount_no
      AND a.company_id = e.company_id
      AND e._fivetran_deleted = false
      AND e.reversed = false
      ${cumulativeDateFilter}
    WHERE a._fivetran_deleted = false
      AND a.account_type = 'Posting'
      AND a.account_category IN ('Income', 'Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
    GROUP BY a.no, a.name, a.account_type, a.account_category, a.account_subcategory_descript, a.debit_credit
    HAVING COALESCE(SUM(e.debit_amount), 0) != 0 OR COALESCE(SUM(e.credit_amount), 0) != 0
    ORDER BY a.no
    LIMIT 10000
  `
    : null

  // Fetch Balance Sheet accounts
  const {
    data: bsData,
    error: bsError,
    isLoading: bsLoading,
    mutate: bsMutate,
  } = useSWR<QueryResult<GLAccountTotal>>(
    bsQuery ? ['balance-sheet', schema, dateRange?.endDate] : null,
    () => warehouseFetcher<GLAccountTotal>(bsQuery!),
    { revalidateOnFocus: false }
  )

  // Fetch P&L accounts for Profit for the Period calculation
  const {
    data: pnlData,
    error: pnlError,
    isLoading: pnlLoading,
    mutate: pnlMutate,
  } = useSWR<QueryResult<GLAccountTotal>>(
    pnlQuery ? ['balance-sheet-pnl', schema, dateRange?.endDate] : null,
    () => warehouseFetcher<GLAccountTotal>(pnlQuery!),
    { revalidateOnFocus: false }
  )

  // Process data into Balance Sheet hierarchy
  const processedData = useMemo(() => {
    if (!bsData?.data?.length) return null

    // Normalize numeric fields (Redshift Data API returns DECIMAL as strings)
    const normalize = (acc: GLAccountTotal): GLAccountTotal => ({
      ...acc,
      total_debits: num(acc.total_debits),
      total_credits: num(acc.total_credits),
      net_balance: num(acc.net_balance),
    })

    // Categorize Balance Sheet accounts
    const assetAccounts: GLAccountTotal[] = []
    const liabilityAccounts: GLAccountTotal[] = []
    const equityAccounts: GLAccountTotal[] = []

    for (const account of bsData.data) {
      const normalized = normalize(account)
      if (account.account_category === 'Assets') {
        assetAccounts.push(normalized)
      } else if (account.account_category === 'Liabilities') {
        liabilityAccounts.push(normalized)
      } else if (account.account_category === 'Equity') {
        equityAccounts.push(normalized)
      }
    }

    // Calculate Net Income from P&L accounts
    // Income accounts: Credits increase (positive), Debits decrease
    // Expense/COGS accounts: Debits increase (negative to net income)
    let netIncomeForPeriod = 0
    let totalIncomeCredits = 0
    let totalIncomeDebits = 0
    let totalExpenseDebits = 0
    let totalExpenseCredits = 0
    let totalCogsDebits = 0
    let totalCogsCredits = 0

    if (pnlData?.data?.length) {
      for (const account of pnlData.data) {
        const credits = num(account.total_credits)
        const debits = num(account.total_debits)
        if (account.account_category === 'Income') {
          totalIncomeCredits += credits
          totalIncomeDebits += debits
          // Income: Credits - Debits (positive = income)
          netIncomeForPeriod += credits - debits
        } else if (account.account_category === 'Expense') {
          totalExpenseDebits += debits
          totalExpenseCredits += credits
          // Expense: Debits - Credits (reduces net income)
          netIncomeForPeriod -= debits - credits
        } else if (account.account_category === 'Cost of Goods Sold') {
          totalCogsDebits += debits
          totalCogsCredits += credits
          // COGS: Debits - Credits (reduces net income)
          netIncomeForPeriod -= debits - credits
        }
      }
    }

    console.log('[useWarehouseBalanceSheet] Profit for the Period calculated:', netIncomeForPeriod)

    // Create a synthetic "Profit for the Period" account to add to equity (matches BC terminology)
    const netIncomeSyntheticAccount: GLAccountTotal = {
      g_laccount_no: 'NET-INCOME',
      g_laccount_name: 'Profit for the Period',
      account_type: 'Posting',
      account_category: 'Equity',
      account_subcategory_descript: 'Retained Earnings',
      debit_credit: 'Credit',
      total_debits: netIncomeForPeriod < 0 ? Math.abs(netIncomeForPeriod) : 0,
      total_credits: netIncomeForPeriod >= 0 ? netIncomeForPeriod : 0,
      net_balance: netIncomeForPeriod,
    }

    // Add net income to equity accounts if there's P&L data
    const equityAccountsWithNetIncome = pnlData?.data?.length
      ? [...equityAccounts, netIncomeSyntheticAccount]
      : equityAccounts

    // Group by subcategory
    const groupBySubcategory = (accounts: GLAccountTotal[]) => {
      const groups: Record<string, GLAccountTotal[]> = {}
      for (const acc of accounts) {
        const key = acc.account_subcategory_descript || 'Other'
        if (!groups[key]) groups[key] = []
        groups[key].push(acc)
      }
      return groups
    }

    const assetGroups = groupBySubcategory(assetAccounts)
    const liabilityGroups = groupBySubcategory(liabilityAccounts)
    const equityGroups = groupBySubcategory(equityAccountsWithNetIncome)

    // Calculate totals - Assets are debit balance, Liabilities/Equity are credit balance
    const calcTotal = (accounts: GLAccountTotal[], isDebitNormal: boolean) => {
      return accounts.reduce((sum, acc) => {
        if (isDebitNormal) {
          return sum + num(acc.total_debits) - num(acc.total_credits)
        } else {
          return sum + num(acc.total_credits) - num(acc.total_debits)
        }
      }, 0)
    }

    const totalAssets = calcTotal(assetAccounts, true)
    const totalLiabilities = calcTotal(liabilityAccounts, false)
    const totalEquityBeforeNetIncome = calcTotal(equityAccounts, false)
    const totalEquity = totalEquityBeforeNetIncome + netIncomeForPeriod
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity

    console.log('[useWarehouseBalanceSheet] Final Totals:', {
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity,
      difference: totalAssets - totalLiabilitiesAndEquity,
    })

    return {
      assetAccounts,
      assetGroups,
      liabilityAccounts,
      liabilityGroups,
      equityAccounts: equityAccountsWithNetIncome,
      equityGroups,
      netIncomeForPeriod,

      totals: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalLiabilitiesAndEquity,
      },
    }
  }, [bsData, pnlData])

  const mutate = () => {
    bsMutate()
    pnlMutate()
  }

  return {
    data: processedData,
    rawData: bsData?.data || [],
    isLoading: bsLoading || pnlLoading,
    error: bsError || pnlError,
    mutate,
  }
}
