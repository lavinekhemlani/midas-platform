import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatPnLCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { BalanceSheetItem } from '@/app/(main)/reports/types'
import { StatementExportDropdown } from '@/components/reports/StatementExportDropdown'

interface BalanceSheetTableProps {
  data: BalanceSheetItem[]
  asOfDate: string
  toggleSection: (category: string) => void
  currency?: string
  /** Full hierarchical data for exports (all sections expanded) */
  exportData?: BalanceSheetItem[]
}

export function BalanceSheetTable({
  data,
  asOfDate,
  toggleSection,
  currency = 'USD',
  exportData,
}: BalanceSheetTableProps) {
  // Check if a subtotal/total row should have thick borders (when its section is expanded)
  const shouldHaveThickBorders = (item: BalanceSheetItem, index: number) => {
    // For subtotals (like "Total Liabilities", "Total Equity"), check if parent header is expanded
    if (item.isSubtotal && !item.isNestedSubtotal) {
      // Find the corresponding header for this subtotal
      for (let i = index - 1; i >= 0; i--) {
        const prevItem = data[i]
        if (prevItem.isHeader && prevItem.category === item.category) {
          return prevItem.isExpanded === true
        }
      }
    }
    // For nested subtotals (like "Total Current Liabilities"), always show thick borders when visible
    if (item.isNestedSubtotal) {
      return true
    }
    // For the "Total Assets" row when Assets section is expanded
    if (item.isTotal && item.category === 'Assets') {
      const assetsHeader = data.find((d) => d.isHeader && d.category === 'Assets')
      return assetsHeader?.isExpanded === true
    }
    return false
  }

  // Check if this is a main total row (Total Assets)
  const isMainTotalRow = (item: BalanceSheetItem) => {
    return item.isTotal && item.category === 'Assets'
  }

  // Get hierarchical border classes based on item type
  const getRowBorderClasses = (item: BalanceSheetItem, hasThickBorders: boolean) => {
    // Main headers (Assets, Liabilities & Equity) get thick borders
    const mainHeaders = ['Assets', 'Liabilities & Equity']
    if (item.isHeader && !item.isSubHeader && mainHeaders.includes(item.name)) {
      return 'border-t-2 border-b-2 border-gray-400 dark:border-gray-600'
    }
    // No row-level borders for subtotals - handled at amount level
    return ''
  }

  // Check if amount should have a line above it (for subtotals/totals)
  const shouldHaveAmountBorder = (item: BalanceSheetItem) => {
    return item.isSubtotal || item.isNestedSubtotal || item.isTotal || item.isFinalTotal
  }

  // Calculate left offset for the line based on indentation
  const getLineLeftOffset = (item: BalanceSheetItem) => {
    const baseLeft = 24 // pl-6
    const chevronAndGap = 24 // w-5 (20px) + gap-1 (4px)

    let indentation = 0
    if (item.nestingLevel !== undefined) {
      switch (item.nestingLevel) {
        case 0:
          indentation = 0
          break
        case 1:
          indentation = 16
          break // pl-4
        case 2:
          indentation = 32
          break // pl-8
        case 3:
          indentation = 48
          break // pl-12
        case 4:
          indentation = 64
          break // pl-16
        default:
          indentation = 80
          break // pl-20
      }
    } else {
      // Fallback to boolean-based logic
      if (item.isNestedChild) indentation = 48
      else if (item.isChild && !item.isNestedChild) indentation = 32
      else if (item.isNestedSubtotal) indentation = 32
      else if (item.isSubHeader) indentation = 16
      else if (item.isSubtotal && !item.isNestedSubtotal) indentation = 16
    }

    return baseLeft + indentation + chevronAndGap
  }

  // Get hierarchical background classes based on item type
  const getRowBackgroundClasses = (item: BalanceSheetItem) => {
    // No backgrounds - clean look that matches theme
    return ''
  }

  // Get hierarchical indentation classes based on nesting level
  // QuickBooks-style progressive indentation for clear visual hierarchy
  const getIndentationClasses = (item: BalanceSheetItem) => {
    // If nestingLevel is provided, use it for precise indentation
    if (item.nestingLevel !== undefined) {
      switch (item.nestingLevel) {
        case 0:
          return '' // Main headers (Assets, Liabilities & Equity) - no indent
        case 1:
          return 'pl-4' // Sub-headers (Current Assets, Fixed Assets) - small indent
        case 2:
          return 'pl-8' // Sub-sub-headers (Bank Accounts, Truck) - medium indent
        case 3:
          return 'pl-12' // Leaf items (Checking, Original Cost) - large indent
        case 4:
          return 'pl-16' // Deeply nested items - extra large indent
        default:
          return 'pl-20' // Even deeper nesting
      }
    }

    // Fallback to boolean-based logic for backward compatibility
    if (item.isNestedChild) return 'pl-12' // Nested child accounts - deeply indented
    if (item.isChild && !item.isNestedChild) return 'pl-8' // Regular child accounts
    if (item.isNestedSubtotal) return 'pl-8' // Nested subtotals
    if (item.isSubHeader) return 'pl-4' // Sub-headers
    if (item.isSubtotal && !item.isNestedSubtotal) return 'pl-4' // Section subtotals
    if (item.isTotal && !item.isFinalTotal) return '' // Main totals - no indent
    return '' // Main headers and final total - no indent
  }

  return (
    <div className="mt-6">
      <Card className="glass-luxury-card border border-gray-200/10 overflow-hidden gap-0">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            {/* Left spacer for centering */}
            <div className="w-24" />

            {/* Centered title and date */}
            <div className="text-center space-y-1 flex-1">
              <h2 className="text-2xl font-light font-serif italic theme-text-primary">
                Balance Sheet
              </h2>
              {asOfDate && (
                <div className="flex items-center justify-center gap-2 text-xs theme-text-secondary">
                  <span className="font-serif italic">as of</span>
                  <span>
                    {new Date(asOfDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Export dropdown */}
            <div className="w-24 flex justify-end">
              <StatementExportDropdown
                data={exportData || data}
                metadata={{
                  title: 'Balance Sheet',
                  statementType: 'balance-sheet',
                  asOfDate,
                  currency,
                  basis: 'Accrual',
                }}
                compact
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full max-w-5xl mx-auto border-collapse">
              <thead>
                <tr className="border-b border-gray-200/20">
                  <th className="text-left px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider">
                    Account
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => {
                  const isLastItem = index === data.length - 1
                  const hasThickBorders = shouldHaveThickBorders(item, index)

                  // For collapsible headers: show amount when collapsed, hide when expanded
                  const isCollapsibleHeader = item.isHeader && item.isCollapsible
                  const showHeaderAmount = isCollapsibleHeader && !item.isExpanded

                  // Get child count from item data
                  const childCount = item.childCount || 0

                  const needsLine = shouldHaveAmountBorder(item)

                  return (
                    <React.Fragment key={index}>
                      {/* Line row for subtotals/totals */}
                      {needsLine && (
                        <tr>
                          <td colSpan={2} className="p-0 h-0">
                            <div
                              className="h-px bg-gray-400 dark:bg-gray-500"
                              style={{
                                marginLeft: getLineLeftOffset(item),
                                marginRight: 24,
                              }}
                            />
                          </td>
                        </tr>
                      )}
                      {/* Content row */}
                      <tr
                        className={cn(
                          'transition-colors report-table-row',
                          isLastItem ? 'report-table-row-last' : '',
                          // Use hierarchical background classes
                          getRowBackgroundClasses(item),
                          // Use hierarchical border classes
                          getRowBorderClasses(item, hasThickBorders),
                          // Clickable header rows
                          isCollapsibleHeader &&
                            'cursor-pointer hover:bg-gray-100/40 dark:hover:bg-gray-800/40'
                        )}
                        onClick={
                          isCollapsibleHeader ? () => toggleSection(item.category) : undefined
                        }
                      >
                        <td
                          className={cn(
                            'py-2 pl-6 pr-0',
                            item.isHeader && 'font-semibold',
                            item.isSubtotal && 'font-semibold',
                            (item.isTotal || isMainTotalRow(item)) && 'font-bold',
                            item.isFinalTotal && 'font-bold'
                          )}
                        >
                          <div className={cn('flex items-center', getIndentationClasses(item))}>
                            <div className="flex items-center gap-1">
                              {/* Chevron on the left for collapsible headers */}
                              {isCollapsibleHeader ? (
                                <div className="flex items-center w-5 flex-shrink-0">
                                  {item.isExpanded ? (
                                    <ChevronDown className="w-4 h-4 theme-text-secondary" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 theme-text-secondary" />
                                  )}
                                </div>
                              ) : (
                                // Spacer for non-collapsible rows to maintain alignment
                                <div className="w-5 flex-shrink-0" />
                              )}
                              <span
                                className={cn(
                                  'text-sm',
                                  // Main headers (Assets, Liabilities & Equity)
                                  item.isHeader &&
                                    !item.isSubHeader &&
                                    'theme-text-primary font-semibold',
                                  // Sub-headers at nestingLevel 1 (Current Assets, Fixed Assets, Liabilities, Equity) - same color as parents
                                  item.isSubHeader &&
                                    item.nestingLevel === 1 &&
                                    'theme-text-primary',
                                  // Sub-headers at deeper levels (Bank Accounts, Accounts Payable, etc.)
                                  item.isSubHeader &&
                                    item.nestingLevel !== 1 &&
                                    'theme-text-secondary',
                                  // Subtotals and totals
                                  (item.isSubtotal || item.isTotal) &&
                                    'theme-text-primary font-medium',
                                  // Main total (Total Assets) and Final total
                                  (isMainTotalRow(item) || item.isFinalTotal) &&
                                    'theme-text-primary font-bold',
                                  // Child accounts
                                  (item.isChild || item.isNestedChild) && 'theme-text-secondary'
                                )}
                              >
                                {item.name}
                              </span>
                              {/* Show account count for collapsible headers only when collapsed */}
                              {isCollapsibleHeader && !item.isExpanded && childCount > 0 && (
                                <span className="text-xs theme-text-secondary ml-1">
                                  ({childCount} {childCount === 1 ? 'account' : 'accounts'})
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td
                          className={cn(
                            'py-2 pl-0 pr-6 text-right',
                            item.isSubtotal && 'font-semibold',
                            (item.isTotal || isMainTotalRow(item)) && 'font-bold',
                            item.isFinalTotal && 'font-bold'
                          )}
                        >
                          {/* Show amount for: non-headers, collapsed headers with amount, subtotals, totals */}
                          {(showHeaderAmount ||
                            (!item.isHeader && !isCollapsibleHeader) ||
                            item.isSubtotal ||
                            item.isTotal ||
                            item.isFinalTotal) && (
                            <span
                              className={cn(
                                'text-sm font-mono',
                                // Default: negative values in red, positive in theme primary
                                item.amount >= 0 ? 'theme-text-primary' : 'text-theme-red',
                                // Subtotals - medium weight
                                item.isSubtotal && 'font-medium',
                                // Main total (Total Assets) and Final total - bold
                                (isMainTotalRow(item) || item.isFinalTotal) && 'font-bold'
                              )}
                            >
                              {formatPnLCurrency(item.amount, currency)}
                            </span>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>

            {/* Footer with date/basis info */}
            <div className="px-6 py-3 border-t border-gray-200/10">
              <div className="flex items-center justify-between text-xs theme-text-secondary">
                <span>Accrual basis</span>
                <span>
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short',
                  })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
