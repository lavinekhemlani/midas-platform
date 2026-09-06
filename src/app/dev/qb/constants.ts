// View mode type
export type ViewMode = 'json' | 'formatted'

// Date period presets
export interface DatePreset {
  label: string
  getRange: () => { start: string; end: string }
}

const formatDateISO = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

const getStartOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1)
const getEndOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth() + 1, 0)
const getStartOfQuarter = (date: Date): Date => {
  const quarter = Math.floor(date.getMonth() / 3)
  return new Date(date.getFullYear(), quarter * 3, 1)
}
const getEndOfQuarter = (date: Date): Date => {
  const quarter = Math.floor(date.getMonth() / 3)
  return new Date(date.getFullYear(), (quarter + 1) * 3, 0)
}
const getStartOfYear = (date: Date): Date => new Date(date.getFullYear(), 0, 1)
const getEndOfYear = (date: Date): Date => new Date(date.getFullYear(), 11, 31)

export const DATE_PRESETS: Record<string, DatePreset> = {
  thisMonth: {
    label: 'This Month',
    getRange: () => {
      const now = new Date()
      return { start: formatDateISO(getStartOfMonth(now)), end: formatDateISO(now) }
    },
  },
  lastMonth: {
    label: 'Last Month',
    getRange: () => {
      const now = new Date()
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return {
        start: formatDateISO(getStartOfMonth(lastMonth)),
        end: formatDateISO(getEndOfMonth(lastMonth)),
      }
    },
  },
  last3Months: {
    label: 'Last 3 Months',
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      return { start: formatDateISO(start), end: formatDateISO(now) }
    },
  },
  last6Months: {
    label: 'Last 6 Months',
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 6, 1)
      return { start: formatDateISO(start), end: formatDateISO(now) }
    },
  },
  thisQuarter: {
    label: 'This Quarter',
    getRange: () => {
      const now = new Date()
      return { start: formatDateISO(getStartOfQuarter(now)), end: formatDateISO(now) }
    },
  },
  lastQuarter: {
    label: 'Last Quarter',
    getRange: () => {
      const now = new Date()
      const lastQuarter = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      return {
        start: formatDateISO(getStartOfQuarter(lastQuarter)),
        end: formatDateISO(getEndOfQuarter(lastQuarter)),
      }
    },
  },
  thisYear: {
    label: 'This Year',
    getRange: () => {
      const now = new Date()
      return { start: formatDateISO(getStartOfYear(now)), end: formatDateISO(now) }
    },
  },
  lastYear: {
    label: 'Last Year',
    getRange: () => {
      const now = new Date()
      const lastYear = new Date(now.getFullYear() - 1, 0, 1)
      return {
        start: formatDateISO(getStartOfYear(lastYear)),
        end: formatDateISO(getEndOfYear(lastYear)),
      }
    },
  },
  last2Years: {
    label: 'Last 2 Years',
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear() - 2, now.getMonth(), 1)
      return { start: formatDateISO(start), end: formatDateISO(now) }
    },
  },
  ytd: {
    label: 'Year to Date',
    getRange: () => {
      const now = new Date()
      return { start: formatDateISO(getStartOfYear(now)), end: formatDateISO(now) }
    },
  },
  custom: {
    label: 'Custom',
    getRange: () => ({ start: '', end: '' }),
  },
}

// Entity types supported by QuickBooks
export const ENTITY_TYPES = [
  // Financial transactions
  {
    category: 'Financial',
    types: ['Invoice', 'Bill', 'Payment', 'BillPayment', 'Deposit', 'Transfer', 'JournalEntry'],
  },
  // Purchase transactions
  { category: 'Purchase', types: ['Purchase', 'PurchaseOrder', 'VendorCredit'] },
  // Sales transactions
  { category: 'Sales', types: ['Estimate', 'SalesReceipt', 'CreditMemo', 'RefundReceipt'] },
  // Reference entities
  {
    category: 'Reference',
    types: ['Customer', 'Vendor', 'Employee', 'Account', 'Item', 'Class', 'Department'],
  },
  // Configuration
  {
    category: 'Configuration',
    types: ['Term', 'PaymentMethod', 'TaxCode', 'TaxRate', 'TaxAgency'],
  },
  // System
  { category: 'System', types: ['CompanyInfo', 'Preferences'] },
  // Other
  { category: 'Other', types: ['TimeActivity', 'Budget', 'Attachable', 'ExchangeRate'] },
]

// Report types supported
export const REPORT_TYPES = [
  { category: 'Financial Statements', types: ['ProfitAndLoss', 'BalanceSheet', 'CashFlow'] },
  { category: 'Trial Balance', types: ['TrialBalance', 'GeneralLedger'] },
  { category: 'Aging Reports', types: ['AgedReceivables', 'AgedPayables'] },
  { category: 'Customer/Vendor', types: ['CustomerIncome', 'CustomerBalance', 'VendorBalance'] },
]
