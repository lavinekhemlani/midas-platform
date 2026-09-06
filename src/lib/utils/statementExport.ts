// src/lib/utils/statementExport.ts

/**
 * Statement Export Utilities
 *
 * Provides export functionality for financial statement line items to PDF, CSV, and Markdown formats.
 * Independent implementation - does not use any other export logic in the codebase.
 */

import { formatPnLCurrency, formatCurrency, getCurrencyInfo } from './currency'

// =============================================================================
// Types
// =============================================================================

export interface StatementLineItem {
  name: string
  amount: number
  category?: string
  isHeader?: boolean
  isSubHeader?: boolean
  isChild?: boolean
  isNestedChild?: boolean
  isSubtotal?: boolean
  isNestedSubtotal?: boolean
  isTotal?: boolean
  isFinalTotal?: boolean
  isCollapsible?: boolean
  isExpanded?: boolean
  nestingLevel?: number
  depth?: number
  childCount?: number
}

export type StatementType = 'pnl' | 'balance-sheet' | 'cash-flow'

export interface ExportMetadata {
  title: string
  statementType: StatementType
  dateRange?: { start: string; end: string }
  asOfDate?: string
  currency?: string
  basis?: 'Accrual' | 'Cash'
}

export type ExportFormat = 'pdf' | 'csv' | 'markdown'

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get indentation string based on nesting level
 */
function getIndentation(item: StatementLineItem, format: 'spaces' | 'tabs' = 'spaces'): string {
  let level = 0

  if (item.nestingLevel !== undefined) {
    level = item.nestingLevel
  } else if (item.depth !== undefined) {
    level = item.depth
  } else if (item.isNestedChild) {
    level = 3
  } else if (item.isChild || item.isNestedSubtotal) {
    level = 2
  } else if (item.isSubHeader || (item.isSubtotal && !item.isNestedSubtotal)) {
    level = 1
  }

  const char = format === 'tabs' ? '\t' : '  '
  return char.repeat(level)
}

/**
 * Determine if a line item should be displayed (filter out collapsed children)
 */
function shouldDisplayItem(item: StatementLineItem): boolean {
  // Always show headers, subtotals, totals, and non-child items
  if (item.isHeader || item.isSubtotal || item.isTotal || item.isFinalTotal) {
    return true
  }
  // Show child items (they should already be filtered in the view if collapsed)
  return true
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Get current timestamp for footer
 */
function getTimestamp(): string {
  return new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

/**
 * Get report title based on statement type
 */
function getReportTitle(statementType: StatementType): string {
  switch (statementType) {
    case 'pnl':
      return 'P&L Statement'
    case 'balance-sheet':
      return 'Balance Sheet'
    case 'cash-flow':
      return 'Cash Flow Statement'
    default:
      return 'Financial Statement'
  }
}

/**
 * Escape CSV value (handle quotes, commas, newlines)
 */
function escapeCSVValue(value: string): string {
  // If value contains quotes, commas, or newlines, wrap in quotes and escape internal quotes
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Trigger file download in browser
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate filename for export
 */
function generateFilename(metadata: ExportMetadata, format: ExportFormat): string {
  const title = metadata.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
  const date = metadata.asOfDate
    ? formatDate(metadata.asOfDate).replace(/[^a-zA-Z0-9]/g, '-')
    : metadata.dateRange
      ? `${formatDate(metadata.dateRange.start)}-to-${formatDate(metadata.dateRange.end)}`.replace(
          /[^a-zA-Z0-9]/g,
          '-'
        )
      : new Date().toISOString().split('T')[0]

  const extension = format === 'markdown' ? 'md' : format
  return `${title}-${date}.${extension}`
}

// =============================================================================
// CSV Export
// =============================================================================

/**
 * Check if an item is a collapsible header (has children and a corresponding Total row)
 * These headers should not show amounts - only the Total row shows the amount
 */
function isCollapsibleHeader(item: StatementLineItem): boolean {
  return !!(item.isHeader && item.isCollapsible)
}

/**
 * Export statement line items to CSV format
 */
export function exportToCSV(data: StatementLineItem[], metadata: ExportMetadata): void {
  const currency = metadata.currency || 'USD'
  const currencyInfo = getCurrencyInfo(currency)
  const lines: string[] = []

  // Header metadata rows
  lines.push(escapeCSVValue(metadata.title || getReportTitle(metadata.statementType)))

  if (metadata.dateRange) {
    lines.push(
      `"From ${formatDate(metadata.dateRange.start)} to ${formatDate(metadata.dateRange.end)}"`
    )
  } else if (metadata.asOfDate) {
    lines.push(`"As of ${formatDate(metadata.asOfDate)}"`)
  }

  lines.push(`"${metadata.basis || 'Accrual'} basis"`)
  lines.push(`"${getTimestamp()}"`)
  lines.push('') // Empty row separator

  // Column headers
  lines.push('Account,Amount')

  // Data rows
  data.filter(shouldDisplayItem).forEach((item) => {
    const indent = getIndentation(item, 'spaces')
    const name = escapeCSVValue(indent + item.name)

    // Don't show amount for collapsible headers - only the Total row shows the amount
    if (isCollapsibleHeader(item)) {
      lines.push(`${name},`)
    } else {
      // Format amount - show raw number for CSV (easier for spreadsheet processing)
      const amount = item.amount.toFixed(currencyInfo.decimals)
      lines.push(`${name},${amount}`)
    }
  })

  const content = lines.join('\n')
  const filename = generateFilename(metadata, 'csv')
  downloadFile(content, filename, 'text/csv;charset=utf-8')
}

// =============================================================================
// Markdown Export
// =============================================================================

/**
 * Export statement line items to Markdown format
 */
export function exportToMarkdown(data: StatementLineItem[], metadata: ExportMetadata): void {
  const currency = metadata.currency || 'USD'
  const lines: string[] = []

  // Title
  lines.push(`# ${metadata.title || getReportTitle(metadata.statementType)}`)
  lines.push('')

  // Date range/as-of
  if (metadata.dateRange) {
    lines.push(
      `*From ${formatDate(metadata.dateRange.start)} to ${formatDate(metadata.dateRange.end)}*`
    )
  } else if (metadata.asOfDate) {
    lines.push(`*As of ${formatDate(metadata.asOfDate)}*`)
  }

  lines.push(`*${metadata.basis || 'Accrual'} basis*`)
  lines.push('')

  // Table header
  lines.push('| Account | Amount |')
  lines.push('| :--- | ---: |')

  // Data rows
  data.filter(shouldDisplayItem).forEach((item) => {
    const indent = getIndentation(item, 'spaces')
    let name = indent + item.name

    // Apply formatting based on item type
    if (item.isHeader && !item.isSubHeader) {
      name = `**${name}**`
    } else if (item.isSubtotal || item.isTotal) {
      name = `**${name}**`
    } else if (item.isFinalTotal) {
      name = `**${name}**`
    }

    // Don't show amount for collapsible headers - only the Total row shows the amount
    let amountStr = ''
    if (!isCollapsibleHeader(item)) {
      // Format amount
      amountStr = formatPnLCurrency(item.amount, currency)

      // Bold for subtotals and totals
      if (item.isSubtotal || item.isTotal || item.isFinalTotal) {
        amountStr = `**${amountStr}**`
      }
    }

    // Escape pipe characters in name
    name = name.replace(/\|/g, '\\|')
    amountStr = amountStr.replace(/\|/g, '\\|')

    lines.push(`| ${name} | ${amountStr} |`)
  })

  lines.push('')

  // Footer
  lines.push('---')
  lines.push(`*${getTimestamp()}*`)

  const content = lines.join('\n')
  const filename = generateFilename(metadata, 'markdown')
  downloadFile(content, filename, 'text/markdown;charset=utf-8')
}

// =============================================================================
// PDF Export (using @react-pdf/renderer)
// =============================================================================

// PDF export is handled separately in a React component due to @react-pdf/renderer requirements
// See: StatementPDFExport.tsx

/**
 * Format data for PDF export (preparation function)
 * Returns structured data that can be passed to the PDF component
 */
export interface PDFExportData {
  title: string
  subtitle: string
  basis: string
  timestamp: string
  currency: string
  items: Array<{
    name: string
    amount: string
    indent: number
    isHeader: boolean
    isSubtotal: boolean
    isTotal: boolean
    isFinalTotal: boolean
  }>
}

export function preparePDFData(data: StatementLineItem[], metadata: ExportMetadata): PDFExportData {
  const currency = metadata.currency || 'USD'

  let subtitle = ''
  if (metadata.dateRange) {
    subtitle = `From ${formatDate(metadata.dateRange.start)} to ${formatDate(metadata.dateRange.end)}`
  } else if (metadata.asOfDate) {
    subtitle = `As of ${formatDate(metadata.asOfDate)}`
  }

  const items = data.filter(shouldDisplayItem).map((item) => {
    let indent = 0
    if (item.nestingLevel !== undefined) {
      indent = item.nestingLevel
    } else if (item.depth !== undefined) {
      indent = item.depth
    } else if (item.isNestedChild) {
      indent = 3
    } else if (item.isChild || item.isNestedSubtotal) {
      indent = 2
    } else if (item.isSubHeader || (item.isSubtotal && !item.isNestedSubtotal)) {
      indent = 1
    }

    // Don't show amount for collapsible headers - only the Total row shows the amount
    const showAmount = !isCollapsibleHeader(item)
    // Cash flow statements need signed amounts (negative = cash outflow)
    // P&L and balance sheet use absolute values (context provides the sign)
    const isCashFlow = metadata.statementType === 'cash-flow'
    const formattedAmount = showAmount
      ? isCashFlow
        ? formatCurrency(item.amount, { currency })
        : formatPnLCurrency(item.amount, currency)
      : ''

    return {
      name: item.name,
      amount: formattedAmount,
      indent,
      isHeader: !!(item.isHeader && !item.isSubHeader),
      isSubtotal: !!(item.isSubtotal || item.isNestedSubtotal),
      isTotal: !!item.isTotal,
      isFinalTotal: !!item.isFinalTotal,
    }
  })

  return {
    title: metadata.title || getReportTitle(metadata.statementType),
    subtitle,
    basis: `${metadata.basis || 'Accrual'} basis`,
    timestamp: getTimestamp(),
    currency,
    items,
  }
}

// =============================================================================
// Main Export Function
// =============================================================================

/**
 * Export statement to specified format
 * Note: For PDF export, use the StatementPDFExport component directly
 */
export function exportStatement(
  format: Exclude<ExportFormat, 'pdf'>,
  data: StatementLineItem[],
  metadata: ExportMetadata
): void {
  switch (format) {
    case 'csv':
      exportToCSV(data, metadata)
      break
    case 'markdown':
      exportToMarkdown(data, metadata)
      break
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}
