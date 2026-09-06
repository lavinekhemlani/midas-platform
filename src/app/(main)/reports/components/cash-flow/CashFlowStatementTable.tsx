import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatPnLCurrency } from '@/lib/utils/currency'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { CashFlowItem } from '@/app/(main)/reports/types'
import { StatementExportDropdown } from '@/components/reports/StatementExportDropdown'

export interface CashFlowStatementTableProps {
  data: CashFlowItem[]
  dateRange: {
    start: string | null
    end: string | null
  }
  toggleSection: (category: string) => void
  currency?: string
  /** Full hierarchical data for exports (all sections expanded) */
  exportData?: CashFlowItem[]
}

export function CashFlowStatementTable({
  data,
  dateRange,
  toggleSection,
  currency = 'USD',
  exportData,
}: CashFlowStatementTableProps) {
  // Get hierarchical border classes based on item type
  const getRowBorderClasses = (item: CashFlowItem) => {
    const mainHeaders = ['Operating Activities', 'Investing Activities', 'Financing Activities']
    if (item.isHeader && mainHeaders.includes(item.name)) {
      return 'border-t-2 border-b-2 border-gray-400 dark:border-gray-600'
    }
    return ''
  }

  // Check if amount should have a line above it (for subtotals/totals)
  const shouldHaveAmountBorder = (item: CashFlowItem) => {
    return item.isSubtotal || item.isTotal || item.isFinalTotal
  }

  // Calculate left offset for the line based on indentation
  const getLineLeftOffset = (item: CashFlowItem) => {
    const baseLeft = 24 // pl-6
    const chevronAndGap = 24 // w-5 (20px) + gap-1 (4px)

    let indentation = 0
    if (item.isChild) indentation = 24
    else if (item.isSubtotal) indentation = 16
    else if (item.isTotal && !item.isFinalTotal) indentation = 0

    return baseLeft + indentation + chevronAndGap
  }

  // Get hierarchical indentation classes
  const getIndentationClasses = (item: CashFlowItem) => {
    if (item.isChild) return 'pl-6'
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
                Cash Flow Statement
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
                  title: 'Cash Flow Statement',
                  statementType: 'cash-flow',
                  dateRange:
                    dateRange.start && dateRange.end
                      ? { start: dateRange.start, end: dateRange.end }
                      : undefined,
                  currency,
                  basis: 'Cash',
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
                    Activity
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
                            item.isSubtotal && 'font-bold',
                            item.isTotal && 'font-bold',
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
                                  // Main headers - bright
                                  item.isHeader && 'theme-text-primary font-semibold',
                                  // Subtotals and totals - primary bold
                                  (item.isSubtotal || item.isTotal) &&
                                    'theme-text-primary font-bold',
                                  // Final total - bold
                                  item.isFinalTotal && 'theme-text-primary font-bold',
                                  // Child accounts - secondary
                                  item.isChild && 'theme-text-secondary'
                                )}
                              >
                                {item.name}
                              </span>
                              {/* Show account count for collapsible headers only when collapsed */}
                              {isCollapsibleHeader && !item.isExpanded && childCount > 0 && (
                                <span className="text-xs theme-text-secondary ml-1">
                                  ({childCount} {childCount === 1 ? 'item' : 'items'})
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td
                          className={cn(
                            'px-6 py-2.5 text-right',
                            item.isSubtotal && 'font-bold',
                            item.isTotal && 'font-bold',
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
                                (item.isSubtotal || item.isTotal) && 'font-bold',
                                // Final total - special color
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
                <span>Cash basis</span>
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
