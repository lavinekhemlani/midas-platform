/**
 * QuickBooks Report View Components
 *
 * Formatted view components for displaying QuickBooks financial reports and entities.
 * These components provide a clean, table-based UI for viewing financial data.
 */

import {
  NormalizedProfitAndLoss,
  NormalizedBalanceSheet,
  NormalizedCashFlow,
  NormalizedReportLine,
} from '@/quickbooks/types/reports'

// ============================================================================
// Types
// ============================================================================

export type ViewMode = 'json' | 'formatted'

interface ViewModeToggleProps {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}

interface EntityFormattedViewProps {
  data: any
  entityType: string
}

interface ReportLineProps {
  line: NormalizedReportLine
  currency?: string
  indent?: number
}

interface ProfitLossViewProps {
  data: NormalizedProfitAndLoss
}

interface BalanceSheetViewProps {
  data: NormalizedBalanceSheet
}

interface CashFlowViewProps {
  data: NormalizedCashFlow
}

// ============================================================================
// Utility Functions
// ============================================================================

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
// View Mode Toggle Component
// ============================================================================

export function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
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

// ============================================================================
// Entity Formatted View Component
// ============================================================================

export function EntityFormattedView({ data, entityType }: EntityFormattedViewProps) {
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
// Financial Report Line Component (Helper)
// ============================================================================

export function ReportLine({ line, currency = 'USD', indent = 0 }: ReportLineProps) {
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

export function ProfitLossFormattedView({ data }: ProfitLossViewProps) {
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
        {section.lines.map((line: NormalizedReportLine, idx: number) => (
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

export function BalanceSheetFormattedView({ data }: BalanceSheetViewProps) {
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
        {section.lines.map((line: NormalizedReportLine, idx: number) => (
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
                {data.equity.lines?.map((line: NormalizedReportLine, idx: number) => (
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

export function CashFlowFormattedView({ data }: CashFlowViewProps) {
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
        {section.lines?.map((line: NormalizedReportLine, idx: number) => (
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
