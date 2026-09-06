// src/app/(main)/reports/types/table.ts

/**
 * Base interface for table row items across all financial reports.
 * Provides common properties for hierarchical data display with collapsible sections.
 */
export interface BaseTableItem {
  /** Category or section this item belongs to */
  category: string
  /** Display name of the item */
  name: string
  /** Monetary amount or value */
  amount: number
  /** Whether this row is a header (section title) */
  isHeader?: boolean
  /** Whether this section can be collapsed/expanded */
  isCollapsible?: boolean
  /** Whether this section is currently expanded */
  isExpanded?: boolean
  /** Whether this row is a child item (indented under a section) */
  isChild?: boolean
  /** Whether this row is a subtotal (sum of children) */
  isSubtotal?: boolean
  /** Whether this row is a total (sum of multiple sections) */
  isTotal?: boolean
  /** Whether this is the final total row of the entire statement */
  isFinalTotal?: boolean
  /** Number of child accounts in this section (for collapsible headers) */
  childCount?: number
}

/**
 * Profit & Loss (Income Statement) table row item.
 * Used for displaying revenue, expenses, and profitability data.
 *
 * @example
 * ```typescript
 * const revenueHeader: PnLItem = {
 *   category: 'Revenue',
 *   name: 'Revenue',
 *   amount: 0,
 *   isHeader: true,
 *   isCollapsible: true,
 *   isExpanded: true
 * }
 * ```
 */
export interface PnLItem extends BaseTableItem {
  /** QuickBooks account ID for this line item */
  accountId?: string
  /** Account number from Chart of Accounts (e.g., "4001") */
  accountNumber?: string
  /** Hierarchy depth (0 = top level, 1 = first sub-level, etc.) - kept for backwards compatibility */
  depth?: number
  /** Parent account ID for hierarchy */
  parentAccountId?: string
  /** Whether this is a sub-header (parent account under main header) */
  isSubHeader?: boolean
  /** Whether this row is a nested child (under a sub-header) */
  isNestedChild?: boolean
  /** Whether this is a nested subtotal (subtotal of nested children) */
  isNestedSubtotal?: boolean
  /**
   * Nesting level for proper indentation (QuickBooks-style hierarchy)
   * 0 = Main headers (Revenue, Operating Expenses, etc.)
   * 1 = Sub-headers (Product Sales, Payroll, etc.)
   * 2 = Leaf items (individual accounts)
   * 3 = Deeply nested items (if any)
   */
  nestingLevel?: number
}

/**
 * Balance Sheet table row item with additional nesting levels.
 * Supports hierarchical display of assets, liabilities, and equity.
 *
 * @example
 * ```typescript
 * const assetsHeader: BalanceSheetItem = {
 *   category: 'Assets',
 *   name: 'Current Assets',
 *   amount: 0,
 *   isHeader: true,
 *   isSubHeader: true,
 *   isCollapsible: true
 * }
 * ```
 */
export interface BalanceSheetItem extends BaseTableItem {
  /** Whether this is a sub-header (second level header) */
  isSubHeader?: boolean
  /** Whether this row is a nested child (under a sub-header) */
  isNestedChild?: boolean
  /** Whether this is a nested subtotal (subtotal of nested children) */
  isNestedSubtotal?: boolean
  /**
   * Nesting level for proper indentation (QuickBooks-style hierarchy)
   * 0 = Main headers (Assets, Liabilities & Equity)
   * 1 = Sub-headers (Current Assets, Fixed Assets, Liabilities, Equity)
   * 2 = Sub-sub-headers (Bank Accounts, Accounts Receivable, Truck, etc.)
   * 3 = Leaf items (Checking Account, Savings Account, Original Cost, etc.)
   * 4 = Deeply nested items (if any)
   */
  nestingLevel?: number
}

/**
 * Cash Flow Statement table row item.
 * Used for displaying operating, investing, and financing activities.
 *
 * @example
 * ```typescript
 * const operatingActivity: CashFlowItem = {
 *   category: 'Operating',
 *   name: 'Net Income',
 *   amount: 50000,
 *   isChild: true
 * }
 * ```
 */
export interface CashFlowItem extends BaseTableItem {}

/**
 * Trial Balance table row item.
 * Used for displaying account debit/credit balances organized by classification.
 */
export interface TrialBalanceItem extends BaseTableItem {
  /** QuickBooks account ID */
  accountId: string
  /** Account number from Chart of Accounts */
  accountNumber?: string
  /** Account type (Bank, Expense, etc.) */
  accountType: string
  /** Classification (Asset, Liability, Equity, Revenue, Expense) */
  classification: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'
  /** Debit balance */
  debit: number
  /** Credit balance */
  credit: number
  /** Hierarchy depth (0 = top level, 1 = first sub-level, etc.) */
  depth?: number
  /** Parent account ID for hierarchy */
  parentAccountId?: string
  /** Full path name with colons (e.g., "Landscaping Services:Job Materials:Plants") */
  fullyQualifiedName?: string
  /** Whether this is a sub-header (e.g., account type within classification) */
  isSubHeader?: boolean
  /** Whether this row is a nested child */
  isNestedChild?: boolean
}

/**
 * General Ledger transaction detail.
 */
export interface GeneralLedgerTransaction {
  /** Transaction date */
  date: string
  /** Transaction type (Invoice, Bill, etc.) */
  transactionType: string
  /** Document/Reference number */
  docNumber?: string
  /** Customer/Vendor name */
  name?: string
  /** Transaction memo */
  memo?: string
  /** Debit amount */
  debit?: number
  /** Credit amount */
  credit?: number
  /** Running balance */
  balance: number
}

/**
 * General Ledger table row item.
 * Used for displaying account-level transaction details.
 */
export interface GeneralLedgerItem extends BaseTableItem {
  /** QuickBooks account ID */
  accountId: string
  /** Account number from Chart of Accounts */
  accountNumber?: string
  /** Account type (Bank, Expense, etc.) */
  accountType: string
  /** Classification (Asset, Liability, Equity, Revenue, Expense) */
  classification: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'
  /** Beginning balance for the period */
  beginningBalance: number
  /** Ending balance for the period */
  endingBalance: number
  /** Total debits for the period */
  totalDebits: number
  /** Total credits for the period */
  totalCredits: number
  /** Net change (debits - credits) */
  netChange: number
  /** Hierarchy depth (0 = top level, 1 = first sub-level, etc.) */
  depth?: number
  /** Parent account ID for hierarchy */
  parentAccountId?: string
  /** Transactions within this account */
  transactions: GeneralLedgerTransaction[]
}

/**
 * Generic table row item that can represent any financial statement line.
 * Use this when you need flexibility across different report types.
 */
export interface TableRowItem extends BaseTableItem {
  /** Optional additional metadata */
  metadata?: Record<string, any>
}

/**
 * Props for table components that display collapsible financial statements
 */
export interface FinancialStatementTableProps<T extends BaseTableItem> {
  /** Array of table row items to display */
  data: T[]
  /** Date range being displayed */
  dateRange: { start: string; end: string }
  /** Function to toggle section expansion */
  toggleSection: (section: string) => void
}

/**
 * Props specifically for Balance Sheet table
 */
export interface BalanceSheetTableProps extends FinancialStatementTableProps<BalanceSheetItem> {
  /** As-of date for the balance sheet */
  asOfDate: string
}

/**
 * Table sorting configuration
 */
export interface TableSortConfig {
  /** Column key to sort by */
  key: keyof BaseTableItem
  /** Sort direction */
  direction: 'asc' | 'desc'
}

/**
 * Table filter configuration
 */
export interface TableFilterConfig {
  /** Search query to filter rows */
  searchQuery?: string
  /** Category to filter by */
  category?: string
  /** Minimum amount threshold */
  minAmount?: number
  /** Maximum amount threshold */
  maxAmount?: number
}
