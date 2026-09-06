'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/contexts/SessionContext'
import { useQuickBooksChanges } from '@/hooks/useQuickBooksEvents'

// View mode type
type ViewMode = 'json' | 'formatted'

// Date period presets
interface DatePreset {
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

const DATE_PRESETS: Record<string, DatePreset> = {
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

// Currency formatter
const formatCurrency = (value: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Format date
const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

// ============================================================================
// Entity Formatted View Component
// ============================================================================
interface EntityFormattedViewProps {
  data: any
  entityType: string
}

function EntityFormattedView({ data, entityType }: EntityFormattedViewProps) {
  if (!data || !Array.isArray(data)) {
    return <p className="text-gray-500">No data to display</p>
  }

  // Get common columns based on entity type
  const getColumns = () => {
    const baseColumns = ['id', 'displayName', 'syncToken']
    const typeColumns: Record<string, string[]> = {
      Customer: ['companyName', 'primaryEmailAddr', 'primaryPhone', 'balance', 'active'],
      Vendor: ['companyName', 'primaryEmailAddr', 'primaryPhone', 'balance', 'active'],
      Invoice: ['docNumber', 'customerRef', 'totalAmt', 'balance', 'dueDate', 'txnDate'],
      Bill: ['docNumber', 'vendorRef', 'totalAmt', 'balance', 'dueDate', 'txnDate'],
      Payment: ['customerRef', 'totalAmt', 'txnDate', 'paymentMethodRef'],
      Account: ['name', 'accountType', 'accountSubType', 'currentBalance', 'active'],
      Item: ['name', 'type', 'unitPrice', 'purchaseCost', 'active'],
      Employee: ['displayName', 'primaryEmailAddr', 'primaryPhone', 'active'],
      Estimate: ['docNumber', 'customerRef', 'totalAmt', 'txnDate', 'expirationDate'],
      JournalEntry: ['docNumber', 'totalAmt', 'txnDate', 'privateNote'],
      default: ['displayName', 'name', 'active'],
    }
    return typeColumns[entityType] || typeColumns.default
  }

  const columns = getColumns()

  // Get display value for a field
  const getDisplayValue = (item: any, field: string): string => {
    const value = item[field]
    if (value === undefined || value === null) return '-'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'number') {
      // Format as currency if it looks like a money field
      if (['totalAmt', 'balance', 'currentBalance', 'unitPrice', 'purchaseCost'].includes(field)) {
        return formatCurrency(value)
      }
      return value.toLocaleString()
    }
    if (typeof value === 'object') {
      // Handle ref objects
      if (value.name) return value.name
      if (value.value) return value.value
      return JSON.stringify(value)
    }
    // Format dates
    if (field.toLowerCase().includes('date')) {
      return formatDate(value)
    }
    return String(value)
  }

  // Format column header
  const formatHeader = (field: string): string => {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .replace(/Ref$/, '')
      .trim()
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                {formatHeader(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((item: any, index: number) => (
            <tr key={item.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              {columns.map((col) => (
                <td
                  key={col}
                  className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200 whitespace-nowrap"
                >
                  {getDisplayValue(item, col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================================
// Financial Report Line Component
// ============================================================================
interface ReportLineProps {
  line: any
  currency?: string
  indent?: number
}

function ReportLine({ line, currency = 'USD', indent = 0 }: ReportLineProps) {
  const paddingLeft = `${indent * 1.5}rem`
  const isSummary = line.isSummary || line.name?.toLowerCase().includes('total')

  return (
    <tr className={isSummary ? 'font-semibold bg-gray-50 dark:bg-gray-900' : ''}>
      <td
        className="px-4 py-2 text-sm text-gray-900 dark:text-gray-200"
        style={{ paddingLeft: `calc(1rem + ${paddingLeft})` }}
      >
        {line.name}
      </td>
      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-200 text-right">
        {formatCurrency(line.total || 0, currency)}
      </td>
    </tr>
  )
}

// ============================================================================
// Profit & Loss Formatted View
// ============================================================================
interface ProfitLossViewProps {
  data: any
}

function ProfitLossFormattedView({ data }: ProfitLossViewProps) {
  if (!data) return <p className="text-gray-500">No data</p>

  const currency = data.currency || 'USD'

  const renderSection = (title: string, section: any, bgColor: string = '') => {
    if (!section || !section.lines || section.lines.length === 0) return null
    return (
      <>
        <tr className={`bg-gray-100 dark:bg-gray-800 ${bgColor}`}>
          <td colSpan={2} className="px-4 py-2 font-bold text-gray-900 dark:text-white">
            {title}
          </td>
        </tr>
        {section.lines.map((line: any, idx: number) => (
          <ReportLine key={idx} line={line} currency={currency} indent={line.level || 0} />
        ))}
        <tr className="font-semibold border-t border-gray-300 dark:border-gray-600">
          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-200">Total {title}</td>
          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-200 text-right">
            {formatCurrency(section.total || 0, currency)}
          </td>
        </tr>
      </>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-bold text-lg text-gray-900 dark:text-white">
          {data.reportName || 'Profit & Loss'}
        </h3>
        <p className="text-sm text-gray-500">
          {formatDate(data.startDate)} - {formatDate(data.endDate)} | {data.reportBasis} Basis
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Account
              </th>
              <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {renderSection('Income', data.income)}
            {renderSection('Cost of Goods Sold', data.costOfGoodsSold)}

            <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold">
              <td className="px-4 py-2 text-gray-900 dark:text-white">Gross Profit</td>
              <td className="px-4 py-2 text-right text-gray-900 dark:text-white">
                {formatCurrency(data.grossProfit || 0, currency)}
              </td>
            </tr>

            {renderSection('Expenses', data.expenses)}
            {renderSection('Other Income', data.otherIncome)}
            {renderSection('Other Expenses', data.otherExpenses)}

            <tr className="bg-green-50 dark:bg-green-900/20 font-bold text-lg">
              <td className="px-4 py-3 text-gray-900 dark:text-white">Net Income</td>
              <td
                className={`px-4 py-3 text-right ${(data.netIncome || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {formatCurrency(data.netIncome || 0, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================================
// Balance Sheet Formatted View
// ============================================================================
interface BalanceSheetViewProps {
  data: any
}

function BalanceSheetFormattedView({ data }: BalanceSheetViewProps) {
  if (!data) return <p className="text-gray-500">No data</p>

  const currency = data.currency || 'USD'

  const renderSubSection = (title: string, section: any) => {
    if (!section || !section.lines || section.lines.length === 0) return null
    return (
      <>
        <tr className="bg-gray-50 dark:bg-gray-900">
          <td colSpan={2} className="px-4 py-2 font-semibold text-gray-800 dark:text-gray-200 pl-8">
            {title}
          </td>
        </tr>
        {section.lines.map((line: any, idx: number) => (
          <ReportLine key={idx} line={line} currency={currency} indent={(line.level || 0) + 1} />
        ))}
        <tr className="border-t border-gray-200 dark:border-gray-700">
          <td className="px-4 py-1 text-sm text-gray-700 dark:text-gray-300 pl-8">Total {title}</td>
          <td className="px-4 py-1 text-sm text-gray-900 dark:text-gray-200 text-right font-medium">
            {formatCurrency(section.total || 0, currency)}
          </td>
        </tr>
      </>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-bold text-lg text-gray-900 dark:text-white">
          {data.reportName || 'Balance Sheet'}
        </h3>
        <p className="text-sm text-gray-500">
          As of {formatDate(data.asOfDate)} | {data.reportBasis} Basis
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Account
              </th>
              <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                Balance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {/* Assets */}
            <tr className="bg-blue-100 dark:bg-blue-900/30">
              <td colSpan={2} className="px-4 py-2 font-bold text-gray-900 dark:text-white">
                ASSETS
              </td>
            </tr>
            {data.assets && (
              <>
                {renderSubSection('Current Assets', data.assets.current)}
                {renderSubSection('Fixed Assets', data.assets.fixed)}
                {renderSubSection('Other Assets', data.assets.other)}
                <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold">
                  <td className="px-4 py-2 text-gray-900 dark:text-white">Total Assets</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-white">
                    {formatCurrency(data.assets.total || 0, currency)}
                  </td>
                </tr>
              </>
            )}

            {/* Liabilities */}
            <tr className="bg-red-100 dark:bg-red-900/30">
              <td colSpan={2} className="px-4 py-2 font-bold text-gray-900 dark:text-white">
                LIABILITIES
              </td>
            </tr>
            {data.liabilities && (
              <>
                {renderSubSection('Current Liabilities', data.liabilities.current)}
                {renderSubSection('Long-Term Liabilities', data.liabilities.longTerm)}
                <tr className="bg-red-50 dark:bg-red-900/20 font-bold">
                  <td className="px-4 py-2 text-gray-900 dark:text-white">Total Liabilities</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-white">
                    {formatCurrency(data.liabilities.total || 0, currency)}
                  </td>
                </tr>
              </>
            )}

            {/* Equity */}
            <tr className="bg-green-100 dark:bg-green-900/30">
              <td colSpan={2} className="px-4 py-2 font-bold text-gray-900 dark:text-white">
                EQUITY
              </td>
            </tr>
            {data.equity && (
              <>
                {data.equity.lines?.map((line: any, idx: number) => (
                  <ReportLine key={idx} line={line} currency={currency} indent={line.level || 0} />
                ))}
                <tr className="bg-green-50 dark:bg-green-900/20 font-bold">
                  <td className="px-4 py-2 text-gray-900 dark:text-white">Total Equity</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-white">
                    {formatCurrency(data.equity.total || 0, currency)}
                  </td>
                </tr>
              </>
            )}

            {/* Total */}
            <tr className="bg-gray-200 dark:bg-gray-700 font-bold text-lg">
              <td className="px-4 py-3 text-gray-900 dark:text-white">
                Total Liabilities & Equity
              </td>
              <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                {formatCurrency(data.totalLiabilitiesAndEquity || 0, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================================
// Cash Flow Formatted View
// ============================================================================
interface CashFlowViewProps {
  data: any
}

function CashFlowFormattedView({ data }: CashFlowViewProps) {
  if (!data) return <p className="text-gray-500">No data</p>

  const currency = data.currency || 'USD'

  const renderSection = (title: string, section: any, bgColor: string) => {
    if (!section) return null
    return (
      <>
        <tr className={bgColor}>
          <td colSpan={2} className="px-4 py-2 font-bold text-gray-900 dark:text-white">
            {title}
          </td>
        </tr>
        {section.lines?.map((line: any, idx: number) => (
          <ReportLine key={idx} line={line} currency={currency} indent={line.level || 0} />
        ))}
        <tr className="border-t border-gray-300 dark:border-gray-600 font-semibold">
          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-200">
            Net Cash from {title}
          </td>
          <td
            className={`px-4 py-2 text-sm text-right ${(section.total || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {formatCurrency(section.total || 0, currency)}
          </td>
        </tr>
      </>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-bold text-lg text-gray-900 dark:text-white">
          {data.reportName || 'Statement of Cash Flows'}
        </h3>
        <p className="text-sm text-gray-500">
          {formatDate(data.startDate)} - {formatDate(data.endDate)}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </th>
              <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {renderSection(
              'Operating Activities',
              data.operatingActivities,
              'bg-blue-100 dark:bg-blue-900/30'
            )}
            {renderSection(
              'Investing Activities',
              data.investingActivities,
              'bg-purple-100 dark:bg-purple-900/30'
            )}
            {renderSection(
              'Financing Activities',
              data.financingActivities,
              'bg-orange-100 dark:bg-orange-900/30'
            )}

            <tr className="bg-gray-100 dark:bg-gray-900 font-bold">
              <td className="px-4 py-2 text-gray-900 dark:text-white">Net Change in Cash</td>
              <td
                className={`px-4 py-2 text-right ${(data.netCashChange || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {formatCurrency(data.netCashChange || 0, currency)}
              </td>
            </tr>

            <tr>
              <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                Beginning Cash Balance
              </td>
              <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-gray-200">
                {formatCurrency(data.beginningCash || 0, currency)}
              </td>
            </tr>

            <tr className="bg-green-50 dark:bg-green-900/20 font-bold text-lg">
              <td className="px-4 py-3 text-gray-900 dark:text-white">Ending Cash Balance</td>
              <td className="px-4 py-3 text-right text-green-600">
                {formatCurrency(data.endingCash || 0, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================================
// View Mode Toggle Component
// ============================================================================
interface ViewModeToggleProps {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}

function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
      <button
        onClick={() => onChange('formatted')}
        className={`px-3 py-1 text-sm transition-colors ${
          mode === 'formatted'
            ? 'bg-blue-600 text-white'
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        Formatted
      </button>
      <button
        onClick={() => onChange('json')}
        className={`px-3 py-1 text-sm transition-colors ${
          mode === 'json'
            ? 'bg-blue-600 text-white'
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        JSON
      </button>
    </div>
  )
}

// Entity types supported by QuickBooks
const ENTITY_TYPES = [
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
const REPORT_TYPES = [
  { category: 'Financial Statements', types: ['ProfitAndLoss', 'BalanceSheet', 'CashFlow'] },
  { category: 'Trial Balance', types: ['TrialBalance', 'GeneralLedger'] },
  {
    category: 'Aging Reports',
    types: ['AgedReceivables', 'AgedReceivableDetail', 'AgedPayables', 'AgedPayableDetail'],
  },
  { category: 'Customer/Vendor', types: ['CustomerIncome', 'CustomerBalance', 'VendorBalance'] },
]

interface QueryResult {
  success?: boolean
  error?: string
  message?: string
  entityType?: string
  count?: number
  data?: unknown
  statusCode?: number
  details?: unknown
}

interface ConnectionStatus {
  connected: boolean
  provider?: string
  realmId?: string
  error?: string
}

export default function QuickBooksDevPage() {
  const { organization, status: sessionStatus } = useSession()

  // Use PK (with ORG# prefix) for database queries, fallback to constructing it
  const organizationId =
    organization?.PK ||
    (organization?.organization_id ? `ORG#${organization.organization_id}` : undefined)

  // Check connection from organization providers
  const qbCredentials = (organization as any)?.providers?.quickbooks?.credentials
  const isConnected = qbCredentials?.connected === true
  const realmId = qbCredentials?.realm_id

  // State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)
  const [selectedEntityType, setSelectedEntityType] = useState<string>('Customer')
  const [entityId, setEntityId] = useState<string>('')
  const [queryLimit, setQueryLimit] = useState<number>(10)
  const [whereClause, setWhereClause] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [exportResult, setExportResult] = useState<any>(null)

  // CDC Testing State
  const [cdcTestResult, setCdcTestResult] = useState<any>(null)
  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState(false)
  const [simulateEntityType, setSimulateEntityType] = useState('Invoice')

  // Reports Testing State
  const [selectedReportType, setSelectedReportType] = useState('ProfitAndLoss')
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')
  const [reportSummarizeBy, setReportSummarizeBy] = useState('Total')
  const [accountingMethod, setAccountingMethod] = useState('Accrual')
  const [isLoadingReport, setIsLoadingReport] = useState(false)
  const [reportResult, setReportResult] = useState<any>(null)
  const [selectedDatePreset, setSelectedDatePreset] = useState<string>('thisYear')

  // View mode state
  const [entityViewMode, setEntityViewMode] = useState<ViewMode>('formatted')
  const [reportViewMode, setReportViewMode] = useState<ViewMode>('formatted')

  // Apply date preset
  const applyDatePreset = useCallback((presetKey: string) => {
    setSelectedDatePreset(presetKey)
    if (presetKey !== 'custom') {
      const preset = DATE_PRESETS[presetKey]
      if (preset) {
        const { start, end } = preset.getRange()
        setReportStartDate(start)
        setReportEndDate(end)
      }
    }
  }, [])

  // CDC Hook - polls for changes
  const {
    timestamps: cdcTimestamps,
    hasChanges,
    changedTypes,
    isPolling,
    lastPollAt,
    error: cdcError,
    poll: manualPoll,
    clearChanges,
  } = useQuickBooksChanges({
    organizationId,
    enabled: isConnected,
    pollInterval: 30000, // 30 seconds
    onChanges: (types) => {
      console.log('[CDC] Changes detected:', types)
    },
  })

  // Update connection status from session
  useEffect(() => {
    setConnectionStatus({
      connected: isConnected,
      provider: 'quickbooks',
      realmId: realmId,
    })
  }, [isConnected, realmId])

  // Check connection status via API (for refresh)
  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch('/api/providers/status')
      const data = await response.json()
      // API returns { connected, provider: { providerName, organizationName, connected }, activeProvider }
      const isQBConnected = data.connected && data.activeProvider === 'quickbooks'
      setConnectionStatus({
        connected: isQBConnected,
        provider: 'quickbooks',
        realmId: data.provider?.organizationName,
      })
    } catch {
      setConnectionStatus({
        connected: false,
        provider: 'quickbooks',
        error: 'Failed to check status',
      })
    }
  }, [])

  // Query entity
  const handleQuery = async () => {
    if (!organizationId) {
      setError('No organization ID available')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const params = new URLSearchParams({
        organizationId,
        entityType: selectedEntityType,
        limit: queryLimit.toString(),
      })

      if (entityId.trim()) {
        params.set('entityId', entityId.trim())
      }

      if (whereClause.trim()) {
        params.set('where', whereClause.trim())
      }

      const response = await fetch(`/api/quickbooks/query?${params}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Query failed')
        setResult(data)
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setIsLoading(false)
    }
  }

  // Connect to QuickBooks using existing provider auth
  const handleConnect = () => {
    const currentUrl = encodeURIComponent(window.location.href)
    window.location.href = `/api/providers/quickbooks/login?redirect_uri=${currentUrl}`
  }

  // Export all entity samples to JSON files
  const handleExportAll = async () => {
    if (!organizationId) {
      setError('No organization ID available')
      return
    }

    setIsExporting(true)
    setExportResult(null)
    setError(null)

    try {
      const response = await fetch('/api/quickbooks/export-samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, limit: 3 }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Export failed')
      }
      setExportResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  // Fetch current CDC timestamps
  const fetchCdcTimestamps = async () => {
    if (!organizationId) return
    try {
      const response = await fetch(
        `/api/quickbooks/changes?orgId=${encodeURIComponent(organizationId)}`
      )
      const data = await response.json()
      setCdcTestResult(data)
    } catch (err) {
      setCdcTestResult({ error: err instanceof Error ? err.message : 'Failed to fetch' })
    }
  }

  // Simulate a webhook (for testing - updates timestamps directly)
  const simulateWebhook = async () => {
    if (!organizationId) return
    setIsSimulatingWebhook(true)
    try {
      // This directly calls the CDC timestamp update (simulating what webhook would do)
      const response = await fetch('/api/quickbooks/webhook/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          entityType: simulateEntityType,
          timestamp: new Date().toISOString(),
        }),
      })
      const data = await response.json()
      setCdcTestResult(data)
      // Trigger a manual poll to see the changes
      await manualPoll()
    } catch (err) {
      setCdcTestResult({ error: err instanceof Error ? err.message : 'Simulation failed' })
    } finally {
      setIsSimulatingWebhook(false)
    }
  }

  // Fetch report
  const handleFetchReport = async () => {
    if (!organizationId) {
      setError('No organization ID available')
      return
    }

    setIsLoadingReport(true)
    setReportResult(null)
    setError(null)

    try {
      const params = new URLSearchParams({
        orgId: organizationId,
        type: selectedReportType,
      })

      if (reportStartDate) params.set('start_date', reportStartDate)
      if (reportEndDate) params.set('end_date', reportEndDate)
      if (reportSummarizeBy) params.set('summarize_column_by', reportSummarizeBy)
      if (accountingMethod) params.set('accounting_method', accountingMethod)

      const response = await fetch(`/api/quickbooks/reports?${params}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Report fetch failed')
      }
      setReportResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report request failed')
    } finally {
      setIsLoadingReport(false)
    }
  }

  // Loading state
  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-300">Loading session...</div>
      </div>
    )
  }

  // Not authenticated
  if (sessionStatus !== 'authenticated') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
          <h1 className="text-xl font-bold text-red-600 mb-2">Authentication Required</h1>
          <p className="text-gray-600 dark:text-gray-300">Please sign in to use this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            QuickBooks API Explorer
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Test and explore QuickBooks API endpoints
          </p>
        </div>

        {/* Connection Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Connection Status
          </h2>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Organization:</span>
              <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {organizationId || 'Not available'}
              </code>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
              {connectionStatus === null ? (
                <span className="text-gray-500">Checking...</span>
              ) : connectionStatus.connected ? (
                <span className="flex items-center gap-1 text-green-600">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-600">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Not Connected
                </span>
              )}
            </div>

            {!connectionStatus?.connected && (
              <button
                onClick={handleConnect}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Connect QuickBooks
              </button>
            )}

            <button
              onClick={checkConnection}
              className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Query Builder */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Query Builder
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Entity Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Entity Type
              </label>
              <select
                value={selectedEntityType}
                onChange={(e) => setSelectedEntityType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {ENTITY_TYPES.map((category) => (
                  <optgroup key={category.category} label={category.category}>
                    {category.types.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Entity ID (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Entity ID (optional)
              </label>
              <input
                type="text"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="e.g., 123"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>

            {/* Limit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Limit
              </label>
              <input
                type="number"
                value={queryLimit}
                onChange={(e) => setQueryLimit(parseInt(e.target.value) || 10)}
                min={1}
                max={100}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Query Button */}
            <div className="flex items-end">
              <button
                onClick={handleQuery}
                disabled={isLoading || !connectionStatus?.connected}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Loading...' : 'Execute Query'}
              </button>
            </div>
          </div>

          {/* Where Clause */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Where Clause (optional)
            </label>
            <input
              type="text"
              value={whereClause}
              onChange={(e) => setWhereClause(e.target.value)}
              placeholder="e.g., Active = true"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
            <p className="mt-1 text-xs text-gray-500">
              QuickBooks query syntax. Example: Balance {`>`} &apos;0&apos; AND Active = true
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h3 className="text-red-800 dark:text-red-200 font-semibold mb-1">Error</h3>
            <p className="text-red-600 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Response
                {result.success && result.count !== undefined && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({result.count} {result.count === 1 ? 'record' : 'records'})
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-3">
                <ViewModeToggle mode={entityViewMode} onChange={setEntityViewMode} />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(result, null, 2))
                  }}
                  className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-300 dark:border-gray-600"
                >
                  Copy JSON
                </button>
              </div>
            </div>

            {entityViewMode === 'formatted' && result.success && result.data ? (
              <EntityFormattedView data={result.data} entityType={selectedEntityType} />
            ) : (
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm text-gray-800 dark:text-gray-200 max-h-[600px] overflow-y-auto">
                <code>{JSON.stringify(result, null, 2)}</code>
              </pre>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>

          <div className="flex flex-wrap gap-2">
            {['Customer', 'Invoice', 'Account', 'Item', 'Vendor', 'Bill', 'Payment'].map((type) => (
              <button
                key={type}
                onClick={() => {
                  setSelectedEntityType(type)
                  setEntityId('')
                  setWhereClause('')
                }}
                className={`px-3 py-1 text-sm rounded border transition-colors ${
                  selectedEntityType === type
                    ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Export All Samples */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Export All Samples
          </h2>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Fetch 3 records from each entity type and save to JSON files in{' '}
            <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">qb-sample-json/</code>
          </p>

          <button
            onClick={handleExportAll}
            disabled={isExporting || !connectionStatus?.connected}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? 'Exporting... (this may take a minute)' : 'Export All Entity Samples'}
          </button>

          {/* Export Results */}
          {exportResult && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Export {exportResult.success ? 'Complete' : 'Failed'}
              </h3>

              {exportResult.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {exportResult.summary.totalEntityTypes}
                    </div>
                    <div className="text-xs text-gray-500">Entity Types</div>
                  </div>
                  <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                    <div className="text-2xl font-bold text-green-600">
                      {exportResult.summary.successful}
                    </div>
                    <div className="text-xs text-gray-500">Successful</div>
                  </div>
                  <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                    <div className="text-2xl font-bold text-red-600">
                      {exportResult.summary.failed}
                    </div>
                    <div className="text-xs text-gray-500">Failed</div>
                  </div>
                  <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                    <div className="text-2xl font-bold text-blue-600">
                      {exportResult.summary.totalRecords}
                    </div>
                    <div className="text-xs text-gray-500">Total Records</div>
                  </div>
                </div>
              )}

              {exportResult.results && (
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-gray-600 dark:text-gray-400">
                      <tr>
                        <th className="pb-2">Entity Type</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Records</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-800 dark:text-gray-200">
                      {exportResult.results.map((r: any) => (
                        <tr
                          key={r.entityType}
                          className="border-t border-gray-200 dark:border-gray-700"
                        >
                          <td className="py-1">{r.entityType}</td>
                          <td className="py-1">
                            {r.success ? (
                              <span className="text-green-600">OK</span>
                            ) : (
                              <span className="text-red-600" title={r.error}>
                                Failed
                              </span>
                            )}
                          </td>
                          <td className="py-1">{r.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-3 text-xs text-gray-500">
                Files saved to: <code>{exportResult.outputDir}</code>
              </p>
            </div>
          )}
        </div>

        {/* Reports Testing Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Financial Reports Testing
          </h2>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Test QuickBooks financial reports API. Reports are fetched in real-time (not stored).
          </p>

          {/* Time Period Presets */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Time Period
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(DATE_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyDatePreset(key)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    selectedDatePreset === key
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
            {/* Report Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Report Type
              </label>
              <select
                value={selectedReportType}
                onChange={(e) => setSelectedReportType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {REPORT_TYPES.map((category) => (
                  <optgroup key={category.category} label={category.category}>
                    {category.types.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={reportStartDate}
                onChange={(e) => {
                  setReportStartDate(e.target.value)
                  setSelectedDatePreset('custom')
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={reportEndDate}
                onChange={(e) => {
                  setReportEndDate(e.target.value)
                  setSelectedDatePreset('custom')
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Summarize By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Summarize By
              </label>
              <select
                value={reportSummarizeBy}
                onChange={(e) => setReportSummarizeBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="Total">Total</option>
                <option value="Month">Month</option>
                <option value="Quarter">Quarter</option>
                <option value="Year">Year</option>
              </select>
            </div>

            {/* Accounting Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Accounting Method
              </label>
              <select
                value={accountingMethod}
                onChange={(e) => setAccountingMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="Accrual">Accrual</option>
                <option value="Cash">Cash</option>
              </select>
            </div>

            {/* Fetch Button */}
            <div className="flex items-end">
              <button
                onClick={handleFetchReport}
                disabled={isLoadingReport || !connectionStatus?.connected}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoadingReport ? 'Loading...' : 'Fetch Report'}
              </button>
            </div>
          </div>

          {/* Quick Report Type Buttons */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 mr-2 py-1">Report:</span>
            {['ProfitAndLoss', 'BalanceSheet', 'CashFlow', 'AgedReceivables', 'TrialBalance'].map(
              (type) => (
                <button
                  key={type}
                  onClick={() => setSelectedReportType(type)}
                  className={`px-3 py-1 text-sm rounded border transition-colors ${
                    selectedReportType === type
                      ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {type}
                </button>
              )
            )}
          </div>

          {/* Report Results */}
          {reportResult && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {reportResult.reportType} Report
                  {reportResult.success && (
                    <span className="ml-2 text-sm font-normal text-green-600">Success</span>
                  )}
                </h3>
                <div className="flex items-center gap-3">
                  <ViewModeToggle mode={reportViewMode} onChange={setReportViewMode} />
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(JSON.stringify(reportResult, null, 2))
                    }
                    className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-300 dark:border-gray-600"
                  >
                    Copy JSON
                  </button>
                </div>
              </div>

              {reportViewMode === 'formatted' && reportResult.success && reportResult.data ? (
                <div className="space-y-4">
                  {/* Render appropriate formatted view based on report type */}
                  {(reportResult.reportType === 'ProfitAndLoss' ||
                    reportResult.reportType === 'ProfitAndLossDetail') && (
                    <ProfitLossFormattedView data={reportResult.data} />
                  )}
                  {reportResult.reportType === 'BalanceSheet' && (
                    <BalanceSheetFormattedView data={reportResult.data} />
                  )}
                  {reportResult.reportType === 'CashFlow' && (
                    <CashFlowFormattedView data={reportResult.data} />
                  )}
                  {/* Fallback for other report types */}
                  {!['ProfitAndLoss', 'ProfitAndLossDetail', 'BalanceSheet', 'CashFlow'].includes(
                    reportResult.reportType
                  ) && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                        Formatted view not yet available for {reportResult.reportType}. Showing JSON
                        below.
                      </p>
                      <pre className="mt-3 bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm text-gray-800 dark:text-gray-200 max-h-[400px] overflow-y-auto">
                        <code>{JSON.stringify(reportResult.data, null, 2)}</code>
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm text-gray-800 dark:text-gray-200 max-h-[400px] overflow-y-auto">
                  <code>{JSON.stringify(reportResult, null, 2)}</code>
                </pre>
              )}
            </div>
          )}
        </div>

        {/* CDC Testing Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            CDC (Change Data Capture) Testing
          </h2>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Test the polling-based change detection system. When QuickBooks sends webhook events,
            timestamps are stored in DynamoDB. The client polls every 30 seconds to detect changes.
          </p>

          {/* CDC Status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
              <div
                className={`text-2xl font-bold ${isPolling ? 'text-blue-600' : 'text-gray-400'}`}
              >
                {isPolling ? '●' : '○'}
              </div>
              <div className="text-xs text-gray-500">Polling</div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
              <div
                className={`text-2xl font-bold ${hasChanges ? 'text-orange-600' : 'text-green-600'}`}
              >
                {hasChanges ? 'Yes' : 'No'}
              </div>
              <div className="text-xs text-gray-500">Has Changes</div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {Object.keys(cdcTimestamps).length}
              </div>
              <div className="text-xs text-gray-500">Entity Types</div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
              <div className="text-sm font-mono text-gray-900 dark:text-white truncate">
                {lastPollAt ? new Date(lastPollAt).toLocaleTimeString() : '-'}
              </div>
              <div className="text-xs text-gray-500">Last Poll</div>
            </div>
          </div>

          {/* Changed Types */}
          {changedTypes.length > 0 && (
            <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-orange-800 dark:text-orange-200">
                    Changes Detected:
                  </span>
                  <span className="ml-2 text-orange-600 dark:text-orange-300">
                    {changedTypes.join(', ')}
                  </span>
                </div>
                <button
                  onClick={clearChanges}
                  className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* CDC Error */}
          {cdcError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <span className="text-red-600 dark:text-red-300">{cdcError.message}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={fetchCdcTimestamps}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Fetch Timestamps
            </button>
            <button
              onClick={() => manualPoll()}
              disabled={isPolling}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
            >
              Manual Poll
            </button>
          </div>

          {/* Simulate Webhook */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Simulate Webhook Event
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              This updates the timestamp for an entity type as if a webhook was received.
            </p>
            <div className="flex gap-3">
              <select
                value={simulateEntityType}
                onChange={(e) => setSimulateEntityType(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {['Invoice', 'Customer', 'Bill', 'Vendor', 'Payment', 'Account', 'Item'].map(
                  (type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  )
                )}
              </select>
              <button
                onClick={simulateWebhook}
                disabled={isSimulatingWebhook}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
              >
                {isSimulatingWebhook ? 'Simulating...' : 'Simulate Webhook'}
              </button>
            </div>
          </div>

          {/* Current Timestamps */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Current Change Timestamps
            </h3>
            {Object.keys(cdcTimestamps).length > 0 ? (
              <div className="space-y-1 text-sm">
                {Object.entries(cdcTimestamps).map(([type, timestamp]) => (
                  <div key={type} className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{type}</span>
                    <span className="font-mono text-gray-900 dark:text-white">
                      {new Date(timestamp as string).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No timestamps yet. Webhooks update these.</p>
            )}
          </div>

          {/* Test Result */}
          {cdcTestResult && (
            <div className="mt-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">API Response</h3>
              <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg overflow-x-auto text-xs text-gray-800 dark:text-gray-200 max-h-40">
                <code>{JSON.stringify(cdcTestResult, null, 2)}</code>
              </pre>
            </div>
          )}
        </div>

        {/* API Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            API Endpoints
          </h2>

          <div className="space-y-3 text-sm">
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
              <code className="text-green-600 dark:text-green-400">GET</code>{' '}
              <code className="text-gray-800 dark:text-gray-200">/api/quickbooks/query</code>
              <p className="text-gray-500 mt-1">
                Query entities. Params: organizationId, entityType, entityId?, limit?, where?
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
              <code className="text-blue-600 dark:text-blue-400">POST</code>{' '}
              <code className="text-gray-800 dark:text-gray-200">/api/quickbooks/query</code>
              <p className="text-gray-500 mt-1">Raw query. Body: {`{ organizationId, query }`}</p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
              <code className="text-green-600 dark:text-green-400">GET</code>{' '}
              <code className="text-gray-800 dark:text-gray-200">/api/providers/status</code>
              <p className="text-gray-500 mt-1">Check all provider connection statuses</p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
              <code className="text-green-600 dark:text-green-400">GET</code>{' '}
              <code className="text-gray-800 dark:text-gray-200">
                /api/providers/quickbooks/login
              </code>
              <p className="text-gray-500 mt-1">Start OAuth flow. Params: redirect_uri?</p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
              <code className="text-blue-600 dark:text-blue-400">POST</code>{' '}
              <code className="text-gray-800 dark:text-gray-200">
                /api/providers/quickbooks/disconnect
              </code>
              <p className="text-gray-500 mt-1">Disconnect QuickBooks integration</p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded border-l-4 border-purple-500">
              <code className="text-green-600 dark:text-green-400">GET</code>{' '}
              <code className="text-gray-800 dark:text-gray-200">/api/quickbooks/changes</code>
              <p className="text-gray-500 mt-1">
                CDC polling endpoint. Params: orgId. Returns change timestamps.
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded border-l-4 border-purple-500">
              <code className="text-blue-600 dark:text-blue-400">POST</code>{' '}
              <code className="text-gray-800 dark:text-gray-200">/api/quickbooks/webhook</code>
              <p className="text-gray-500 mt-1">
                QuickBooks webhook receiver. Updates change timestamps in DynamoDB.
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded border-l-4 border-yellow-500">
              <code className="text-blue-600 dark:text-blue-400">POST</code>{' '}
              <code className="text-gray-800 dark:text-gray-200">
                /api/quickbooks/webhook/simulate
              </code>
              <p className="text-gray-500 mt-1">
                [DEV ONLY] Simulate webhook. Body: {`{ organizationId, entityType }`}
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded border-l-4 border-indigo-500">
              <code className="text-green-600 dark:text-green-400">GET</code>{' '}
              <code className="text-gray-800 dark:text-gray-200">/api/quickbooks/reports</code>
              <p className="text-gray-500 mt-1">
                Fetch financial reports. Params: orgId, type, start_date?, end_date?,
                summarize_column_by?, accounting_method?
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded border-l-4 border-indigo-500">
              <code className="text-green-600 dark:text-green-400">GET</code>{' '}
              <code className="text-gray-800 dark:text-gray-200">
                /api/quickbooks/reports/profit-loss
              </code>
              <p className="text-gray-500 mt-1">Convenience endpoint for P&L reports</p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded border-l-4 border-indigo-500">
              <code className="text-green-600 dark:text-green-400">GET</code>{' '}
              <code className="text-gray-800 dark:text-gray-200">
                /api/quickbooks/reports/balance-sheet
              </code>
              <p className="text-gray-500 mt-1">Convenience endpoint for Balance Sheet reports</p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded border-l-4 border-indigo-500">
              <code className="text-green-600 dark:text-green-400">GET</code>{' '}
              <code className="text-gray-800 dark:text-gray-200">
                /api/quickbooks/reports/cash-flow
              </code>
              <p className="text-gray-500 mt-1">Convenience endpoint for Cash Flow reports</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
