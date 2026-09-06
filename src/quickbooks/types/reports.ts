/**
 * QuickBooks Reports API Types
 *
 * Type definitions for QuickBooks Online Reports API responses.
 * Reports provide aggregated financial data without exposing raw transaction details.
 *
 * @see https://developer.intuit.com/app/developer/qbo/docs/workflows/run-reports
 */

// ============================================================================
// Common Report Types
// ============================================================================

/**
 * Report column definition
 */
export interface QBReportColumn {
  ColTitle: string
  ColType: 'Account' | 'Money' | 'Text' | 'Date' | string
  MetaData?: Array<{
    Name: string
    Value: string
  }>
}

/**
 * Report row data
 */
export interface QBReportRowData {
  ColData: Array<{
    value: string
    id?: string
    href?: string
  }>
}

/**
 * Report row (can be header, data, or section)
 */
export interface QBReportRow {
  type?: 'Section' | 'Data' | string
  group?: string
  Header?: QBReportRowData
  Rows?: {
    Row: QBReportRow[]
  }
  ColData?: Array<{
    value: string
    id?: string
    href?: string
  }>
  Summary?: QBReportRowData
}

/**
 * Base report response structure
 */
export interface QBReportResponse {
  Header: {
    Time: string
    ReportName: string
    ReportBasis?: 'Accrual' | 'Cash'
    StartPeriod: string
    EndPeriod: string
    Currency: string
    Option?: Array<{
      Name: string
      Value: string
    }>
  }
  Columns: {
    Column: QBReportColumn[]
  }
  Rows: {
    Row: QBReportRow[]
  }
}

// ============================================================================
// Report Query Parameters
// ============================================================================

/**
 * Common report query parameters
 */
export interface QBReportQueryParams {
  /** Start date (YYYY-MM-DD) */
  start_date?: string
  /** End date (YYYY-MM-DD) */
  end_date?: string
  /** Date macro (e.g., 'This Fiscal Year-to-date', 'Last Month') */
  date_macro?: QBDateMacro
  /** Accounting method */
  accounting_method?: 'Accrual' | 'Cash'
  /** Summarize columns by period */
  summarize_column_by?: 'Total' | 'Month' | 'Week' | 'Days' | 'Quarter' | 'Year'
  /** Customer ID filter */
  customer?: string
  /** Vendor ID filter */
  vendor?: string
  /** Department ID filter */
  department?: string
  /** Class ID filter */
  class?: string
  /** API minor version */
  minorversion?: number
}

/**
 * Date macro options for reports
 */
export type QBDateMacro =
  | 'Today'
  | 'Yesterday'
  | 'This Week'
  | 'This Week-to-date'
  | 'Last Week'
  | 'Last Week-to-date'
  | 'This Month'
  | 'This Month-to-date'
  | 'Last Month'
  | 'Last Month-to-date'
  | 'This Fiscal Quarter'
  | 'This Fiscal Quarter-to-date'
  | 'Last Fiscal Quarter'
  | 'Last Fiscal Quarter-to-date'
  | 'This Fiscal Year'
  | 'This Fiscal Year-to-date'
  | 'Last Fiscal Year'
  | 'Last Fiscal Year-to-date'

// ============================================================================
// Specific Report Types
// ============================================================================

/**
 * Profit and Loss (Income Statement) report parameters
 */
export interface QBProfitAndLossParams extends QBReportQueryParams {
  /** Include sub-columns for comparison */
  qzurl?: boolean
}

/**
 * Balance Sheet report parameters
 */
export interface QBBalanceSheetParams extends QBReportQueryParams {
  /** As of date (YYYY-MM-DD) - for point-in-time snapshot */
  as_of_date?: string
}

/**
 * Cash Flow report parameters
 * Currently uses the same parameters as the base report query
 */
export type QBCashFlowParams = QBReportQueryParams

/**
 * Aged Receivables/Payables report parameters
 */
export interface QBAgedReportParams extends QBReportQueryParams {
  /** Aging period (default: 30) */
  aging_period?: number
  /** Number of periods (default: 4) */
  num_periods?: number
  /** Report date */
  report_date?: string
}

/**
 * General Ledger report parameters
 */
export interface QBGeneralLedgerParams extends QBReportQueryParams {
  /** Account ID filter */
  account?: string
  /** Source account type filter */
  source_account_type?: string
  /** Sort by */
  sort_by?: 'txn_date' | 'create_date' | 'last_mod_date'
  /** Sort order */
  sort_order?: 'ascend' | 'descend'
}

/**
 * Trial Balance report parameters
 */
export interface QBTrialBalanceParams extends QBReportQueryParams {
  /** As of date (YYYY-MM-DD) */
  as_of_date?: string
}

/**
 * Transaction List report parameters
 */
export interface QBTransactionListParams extends QBReportQueryParams {
  /** Transaction type filter */
  transaction_type?: string
  /** Source account */
  source_account?: string
  /** Sort by */
  sort_by?: 'txn_date' | 'create_date' | 'last_mod_date' | 'doc_num'
  /** Sort order */
  sort_order?: 'ascend' | 'descend'
  /** Columns to include */
  columns?: string
}

// ============================================================================
// Normalized Report Types (for frontend consumption)
// ============================================================================

/**
 * Normalized line item for financial reports
 */
export interface NormalizedReportLine {
  /** Account or category name */
  name: string
  /** Account ID (if applicable) */
  accountId?: string
  /** Values by column (for multi-period reports) */
  values: Record<string, number>
  /** Alias for total (for enricher compatibility) */
  value?: number
  /** Total value */
  total: number
  /** Nesting level (0 = top level) */
  level: number
  /** Whether this is a subtotal/summary row */
  isSummary: boolean
  /** Child lines (for hierarchical reports) */
  children?: NormalizedReportLine[]
}

/**
 * Normalized Profit & Loss report
 */
export interface NormalizedProfitAndLoss {
  reportName: string
  reportBasis: 'Accrual' | 'Cash'
  startDate: string
  endDate: string
  currency: string
  generatedAt: string

  /** Income section */
  income: {
    lines: NormalizedReportLine[]
    total: number
    /** Hierarchical structure for QuickBooks-style nesting */
    hierarchy?: Array<{
      name: string
      total: number
      children: Array<{ name: string; value: number }>
    }>
  }

  /** Cost of Goods Sold section */
  costOfGoodsSold: {
    lines: NormalizedReportLine[]
    total: number
    /** Hierarchical structure for QuickBooks-style nesting */
    hierarchy?: Array<{
      name: string
      total: number
      children: Array<{ name: string; value: number }>
    }>
  }

  /** Gross Profit */
  grossProfit: number

  /** Expenses section */
  expenses: {
    lines: NormalizedReportLine[]
    total: number
    /** Hierarchical structure for QuickBooks-style nesting */
    hierarchy?: Array<{
      name: string
      total: number
      children: Array<{ name: string; value: number }>
    }>
  }

  /** Other Income section */
  otherIncome: {
    lines: NormalizedReportLine[]
    total: number
    /** Hierarchical structure for QuickBooks-style nesting */
    hierarchy?: Array<{
      name: string
      total: number
      children: Array<{ name: string; value: number }>
    }>
  }

  /** Other Expenses section */
  otherExpenses: {
    lines: NormalizedReportLine[]
    total: number
    /** Hierarchical structure for QuickBooks-style nesting */
    hierarchy?: Array<{
      name: string
      total: number
      children: Array<{ name: string; value: number }>
    }>
  }

  /** Net Operating Income */
  netOperatingIncome: number

  /** Net Income (Profit) */
  netIncome: number

  /** Column headers (for multi-period reports) */
  columns: string[]
}

/**
 * Normalized Balance Sheet report
 */
export interface NormalizedBalanceSheet {
  reportName: string
  reportBasis: 'Accrual' | 'Cash'
  asOfDate: string
  currency: string
  generatedAt: string

  /** Assets section */
  assets: {
    current: {
      lines: NormalizedReportLine[]
      total: number
      /** Hierarchical structure for QuickBooks-style nesting (e.g., Bank Accounts → Checking, Savings) */
      hierarchy?: Array<{
        name: string
        total: number
        children: Array<{ name: string; value: number }>
      }>
    }
    fixed: {
      lines: NormalizedReportLine[]
      total: number
      /** Hierarchical structure for QuickBooks-style nesting (e.g., Truck → Original Cost, Depreciation) */
      hierarchy?: Array<{
        name: string
        total: number
        children: Array<{ name: string; value: number }>
      }>
    }
    other: {
      lines: NormalizedReportLine[]
      total: number
      /** Hierarchical structure for QuickBooks-style nesting */
      hierarchy?: Array<{
        name: string
        total: number
        children: Array<{ name: string; value: number }>
      }>
    }
    total: number
  }

  /** Liabilities section */
  liabilities: {
    current: {
      lines: NormalizedReportLine[]
      total: number
      /** Hierarchical structure for QuickBooks-style nesting */
      hierarchy?: Array<{
        name: string
        total: number
        children: Array<{ name: string; value: number }>
      }>
    }
    longTerm: {
      lines: NormalizedReportLine[]
      total: number
      /** Hierarchical structure for QuickBooks-style nesting */
      hierarchy?: Array<{
        name: string
        total: number
        children: Array<{ name: string; value: number }>
      }>
    }
    total: number
  }

  /** Equity section */
  equity: {
    lines: NormalizedReportLine[]
    total: number
  }

  /** Total Liabilities and Equity (should equal Total Assets) */
  totalLiabilitiesAndEquity: number

  /** Column headers (for multi-period reports) */
  columns: string[]
}

/**
 * Normalized Cash Flow report
 */
export interface NormalizedCashFlow {
  reportName: string
  startDate: string
  endDate: string
  currency: string
  generatedAt: string

  /** Operating Activities */
  operatingActivities: {
    lines: NormalizedReportLine[]
    total: number
  }

  /** Investing Activities */
  investingActivities: {
    lines: NormalizedReportLine[]
    total: number
  }

  /** Financing Activities */
  financingActivities: {
    lines: NormalizedReportLine[]
    total: number
  }

  /** Net Change in Cash */
  netCashChange: number

  /** Beginning Cash Balance */
  beginningCash: number

  /** Ending Cash Balance */
  endingCash: number

  /** Column headers (for multi-period reports) */
  columns: string[]
}

/**
 * Normalized Aged Report (Receivables/Payables) - Summary Version
 * Shows aging buckets aggregated by customer/vendor without invoice-level details
 */
export interface NormalizedAgedReport {
  reportName: string
  reportDate: string
  currency: string
  generatedAt: string

  /** Aging periods (e.g., ['Current', '1-30', '31-60', '61-90', '91+']) */
  periods: string[]

  /** Line items by customer/vendor */
  lines: Array<{
    name: string
    entityId?: string
    /** Values by period */
    byPeriod: Record<string, number>
    total: number
  }>

  /** Totals by period */
  totals: Record<string, number>

  /** Grand total */
  grandTotal: number
}

/**
 * Individual transaction detail within an aged report
 */
export interface AgedReportTransaction {
  /** Transaction type (Invoice, Bill, etc.) */
  type: string
  /** Document number */
  docNumber?: string
  /** Transaction date */
  txnDate: string
  /** Due date */
  dueDate?: string
  /** Days past due (negative if not yet due) */
  daysPastDue?: number
  /** Original amount */
  amount: number
  /** Outstanding balance */
  balance: number
  /** Payment terms */
  terms?: string
  /** Transaction ID */
  txnId?: string
  /** Memo or description */
  memo?: string
}

/**
 * Customer/Vendor entry with transaction details
 */
export interface AgedReportDetailLine {
  /** Customer or vendor name */
  name: string
  /** Entity ID */
  entityId?: string
  /** All transactions for this entity */
  transactions: AgedReportTransaction[]
  /** Total outstanding balance */
  total: number
  /** Values by aging period */
  byPeriod: Record<string, number>
}

/**
 * Normalized Aged Report Detail (Receivables/Payables) - Detail Version
 * Shows individual invoices/bills with dates, due dates, terms, and aging
 */
export interface NormalizedAgedReportDetail {
  reportName: string
  reportDate: string
  currency: string
  generatedAt: string

  /** Aging periods (e.g., ['Current', '1-30', '31-60', '61-90', '91+']) */
  periods: string[]

  /** Line items by customer/vendor with transaction details */
  lines: AgedReportDetailLine[]

  /** Totals by period */
  totals: Record<string, number>

  /** Grand total */
  grandTotal: number

  /** Total transaction count */
  transactionCount: number
}

/**
 * Normalized General Ledger report
 */
export interface NormalizedGeneralLedger {
  reportName: string
  startDate: string
  endDate: string
  currency: string
  generatedAt: string

  /** Transactions grouped by account */
  accounts: Array<{
    accountId: string
    accountName: string
    accountType: string
    beginningBalance: number
    endingBalance: number
    transactions: Array<{
      date: string
      transactionType: string
      docNumber?: string
      name?: string
      memo?: string
      debit?: number
      credit?: number
      balance: number
    }>
  }>
}

/**
 * Normalized Trial Balance report
 */
export interface NormalizedTrialBalance {
  reportName: string
  asOfDate: string
  currency: string
  generatedAt: string

  /** Account balances */
  accounts: Array<{
    accountId: string
    accountName: string
    accountType: string
    debit: number
    credit: number
  }>

  /** Total debits */
  totalDebits: number

  /** Total credits */
  totalCredits: number

  /** Whether balanced (debits = credits) */
  isBalanced: boolean
}

// ============================================================================
// Report Type Union
// ============================================================================

/**
 * All available report types
 */
export type QBReportType =
  | 'ProfitAndLoss'
  | 'ProfitAndLossDetail'
  | 'BalanceSheet'
  | 'CashFlow'
  | 'GeneralLedger'
  | 'TrialBalance'
  | 'AgedReceivables'
  | 'AgedReceivableDetail'
  | 'AgedPayables'
  | 'AgedPayableDetail'
  | 'TransactionList'
  | 'CustomerIncome'
  | 'CustomerBalance'
  | 'CustomerBalanceDetail'
  | 'VendorBalance'
  | 'VendorBalanceDetail'
  | 'AccountListDetail'

/**
 * Map of report types to their parameter types
 */
export interface QBReportParamsMap {
  ProfitAndLoss: QBProfitAndLossParams
  ProfitAndLossDetail: QBProfitAndLossParams
  BalanceSheet: QBBalanceSheetParams
  CashFlow: QBCashFlowParams
  GeneralLedger: QBGeneralLedgerParams
  TrialBalance: QBTrialBalanceParams
  AgedReceivables: QBAgedReportParams
  AgedReceivableDetail: QBAgedReportParams
  AgedPayables: QBAgedReportParams
  AgedPayableDetail: QBAgedReportParams
  TransactionList: QBTransactionListParams
  CustomerIncome: QBReportQueryParams
  CustomerBalance: QBReportQueryParams
  CustomerBalanceDetail: QBReportQueryParams
  VendorBalance: QBReportQueryParams
  VendorBalanceDetail: QBReportQueryParams
  AccountListDetail: QBReportQueryParams
}
