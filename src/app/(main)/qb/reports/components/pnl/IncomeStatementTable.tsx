import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatPnLCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { PnLItem } from '@/app/(main)/reports/types'
import { StatementExportDropdown } from '@/components/reports/StatementExportDropdown'

interface IncomeStatementTableProps {
  data: PnLItem[]
  dateRange: { start: string; end: string }
  toggleSection: (category: string) => void
  currency?: string
  /** Full hierarchical data for exports (all sections expanded) */
  exportData?: PnLItem[]
}

export function IncomeStatementTable({
  data,
  dateRange,
  toggleSection,
  currency = 'USD',
  exportData,
}: IncomeStatementTableProps) {
  // Check if this is a key total row (Gross Profit, Net Operating Income, Net Other Income)
  const isKeyTotalRow = (item: PnLItem) => {
    const name = item.name?.toLowerCase() || ''
    return (
      item.isSubtotal &&
      (name.includes('gross profit') ||
        name.includes('operating income') ||
        name.includes('net operating income') ||
        name.includes('net other income'))
    )
  }

  // Get hierarchical border classes based on item type
  // Only main section headers (nestingLevel 0) get thick borders, not sub-headers
  const getRowBorderClasses = (item: PnLItem) => {
    const thickBorderHeaders = ['Revenue', 'Expenses', 'Other Income', 'Other Expenses']
    if (item.isHeader && !item.isSubHeader && thickBorderHeaders.includes(item.name)) {
      return 'border-t-2 border-b-2 border-gray-400 dark:border-gray-600'
    }
    // No borders for all other rows
    return ''
  }

  // Get hierarchical background classes based on item type
  const getRowBackgroundClasses = () => {
    // No backgrounds - clean look that matches theme
    return ''
  }

  // Check if amount should have a line above it (for subtotals/totals)
  const shouldHaveAmountBorder = (item: PnLItem) => {
    return item.isSubtotal || item.isNestedSubtotal || item.isTotal || item.isFinalTotal
  }

  // Calculate left offset for the line based on indentation
  const getLineLeftOffset = (item: PnLItem) => {
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

  // Get hierarchical indentation classes based on nestingLevel
  // QuickBooks-style progressive indentation for clear visual hierarchy
  const getIndentationClasses = (item: PnLItem) => {
    // If nestingLevel is provided, use it for precise indentation (matches Balance Sheet)
    if (item.nestingLevel !== undefined) {
      switch (item.nestingLevel) {
        case 0:
          return '' // Main headers (Revenue, Expenses) - no indent
        case 1:
          return 'pl-4' // Sub-headers (parent accounts) - small indent
        case 2:
          return 'pl-8' // Nested children - medium indent
        case 3:
          return 'pl-12' // Deeply nested items - large indent
        case 4:
          return 'pl-16' // Extra deep nesting
        default:
          return 'pl-20' // Even deeper nesting
      }
    }

    // Fallback to depth-based logic for backwards compatibility
    if (item.depth !== undefined) {
      if (item.isChild || item.isSubtotal) {
        switch (item.depth) {
          case 0:
            return 'pl-4'
          case 1:
            return 'pl-8'
          case 2:
            return 'pl-12'
          case 3:
            return 'pl-16'
          default:
            return 'pl-20'
        }
      }
    }

    // Fallback for items without depth or nestingLevel
    if (item.isChild) return 'pl-8'
    if (item.isSubtotal) return 'pl-4'
    if (item.isTotal && !item.isFinalTotal) return ''
    return ''
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
                P&L Statement
              </h2>
              {dateRange.start && dateRange.end && (
                <div className="flex items-center justify-center gap-2 text-xs theme-text-secondary">
                  <span className="font-serif italic">from</span>
                  <span>
                    {new Date(dateRange.start).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="font-serif italic">to</span>
                  <span>
                    {new Date(dateRange.end).toLocaleDateString('en-US', {
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
                  title: 'P&L Statement',
                  statementType: 'pnl',
                  dateRange,
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
            <table className="w-full max-w-5xl mx-auto">
              <thead>
                <tr className="border-b border-gray-200/10">
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

                  // For collapsible headers: show amount when collapsed, hide when expanded
                  const isCollapsibleHeader = item.isHeader && item.isCollapsible
                  const showHeaderAmount = isCollapsibleHeader && !item.isExpanded

                  // Get child count from item data
                  const childCount = item.childCount || 0

                  // Check if this row needs a line above it
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
                      <tr
                        className={cn(
                          'transition-colors report-table-row',
                          isLastItem ? 'report-table-row-last' : '',
                          // Use hierarchical background classes
                          getRowBackgroundClasses(),
                          // Use hierarchical border classes
                          getRowBorderClasses(item),
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
                            'px-6 py-2.5',
                            item.isHeader && 'font-semibold',
                            (item.isSubtotal || item.isNestedSubtotal) && 'font-bold',
                            (item.isTotal || isKeyTotalRow(item)) && 'font-bold',
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
                                  // Main headers (Revenue, Expenses) - bright
                                  item.isHeader &&
                                    !item.isSubHeader &&
                                    'theme-text-primary font-semibold',
                                  // Sub-headers at nestingLevel 1 (parent accounts) - same color as main headers
                                  item.isSubHeader &&
                                    item.nestingLevel === 1 &&
                                    'theme-text-primary',
                                  // Sub-headers at deeper levels - secondary color
                                  item.isSubHeader &&
                                    item.nestingLevel !== 1 &&
                                    'theme-text-secondary',
                                  // Subtotals and totals (not nested) - primary bold
                                  (item.isSubtotal || item.isTotal) &&
                                    !item.isNestedSubtotal &&
                                    'theme-text-primary font-bold',
                                  // Nested subtotals - primary bold
                                  item.isNestedSubtotal && 'theme-text-primary font-bold',
                                  // Final total - bold
                                  item.isFinalTotal && 'theme-text-primary font-bold',
                                  // Child/nested child accounts - secondary
                                  (item.isChild || item.isNestedChild) &&
                                    !item.isSubHeader &&
                                    'theme-text-secondary'
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
                            'px-6 py-2.5 text-right',
                            (item.isSubtotal || item.isNestedSubtotal) && 'font-bold',
                            (item.isTotal || isKeyTotalRow(item)) && 'font-bold',
                            item.isFinalTotal && 'font-bold'
                          )}
                        >
                          {/* Show amount for: non-headers, collapsed headers with amount, subtotals, totals */}
                          {(showHeaderAmount ||
                            (!item.isHeader && !isCollapsibleHeader) ||
                            item.isSubtotal ||
                            item.isTotal) && (
                            <span
                              className={cn(
                                'text-sm font-mono',
                                // Default: negative values in red, positive in primary
                                item.amount >= 0 ? 'theme-text-primary' : 'text-theme-red',
                                // All subtotals and totals - bold
                                (item.isSubtotal || item.isNestedSubtotal || item.isTotal) &&
                                  'font-bold',
                                // Key totals (Gross Profit, Net Operating Income) - emphasized styling
                                isKeyTotalRow(item) &&
                                  item.amount >= 0 &&
                                  'theme-text-primary font-bold',
                                isKeyTotalRow(item) &&
                                  item.amount < 0 &&
                                  'text-theme-red font-bold',
                                // Final total (Net Income) - special color
                                item.isFinalTotal && item.amount >= 0 && 'text-theme-green',
                                item.isFinalTotal && item.amount < 0 && 'text-theme-red'
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
