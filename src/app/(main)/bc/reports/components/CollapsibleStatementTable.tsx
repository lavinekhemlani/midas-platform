'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatStatementAmount, formatPnLCurrency, getCurrencySymbol } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip, type InfoTooltipProps } from '@/components/ui/InfoTooltip'

export interface StatementLine {
  lineNumber: number
  display: string
  lineType: string // 'header' | 'detail' | 'total' | 'spacer' | 'computed'
  indentation: number
  _category?: string
  _accountNumber?: string
  _accountType?: string
  _computed?: boolean
  [key: string]: any
}

interface CollapsibleStatementTableProps {
  lines: StatementLine[]
  amountKey: 'netChange' | 'balance'
  currency: string
  title: string
  asOfDate?: string
  dateRange?: { start: string; end: string }
  isLoading?: boolean
  /** Balance indicator badge for Balance Sheet */
  balanceCheck?: { isBalanced: boolean; difference: number }
  /** Optional export buttons to render in header */
  exportButtons?: React.ReactNode
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
  /** Max width for the table body — wraps in a bordered panel */
  tableMaxWidth?: string
  /** Callback when a detail row with an account number is clicked */
  onAccountClick?: (line: StatementLine) => void
  /** Which account is currently selected for inline detail */
  selectedAccountNumber?: string | null
  /** Render function for the inline account detail card */
  renderAccountDetail?: () => React.ReactNode
}

function buildSectionKey(line: StatementLine): string {
  return `${line._category || ''}-${line.indentation}-${line._accountNumber || line.display}`
}

/**
 * For a header at index `headerIdx`, find its matching total (same indentation)
 * and count all detail children within the range (including nested ones).
 */
function findSectionEnd(
  lines: StatementLine[],
  headerIdx: number,
  amountKey: string
): { totalIdx: number; childCount: number; totalAmount: number | undefined } {
  const headerIndent = lines[headerIdx].indentation
  let childCount = 0

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.lineType === 'spacer' || line.lineType === 'computed') continue

    // Found matching total at same indentation
    if (line.lineType === 'total' && line.indentation === headerIndent) {
      return { totalIdx: i, childCount, totalAmount: line[amountKey] }
    }

    // Hit another header at same or lower indentation — section ended without total
    if (line.lineType === 'header' && line.indentation <= headerIndent) {
      return { totalIdx: -1, childCount, totalAmount: undefined }
    }

    if (line.lineType === 'detail') childCount++
  }

  return { totalIdx: -1, childCount, totalAmount: undefined }
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Shared collapsible statement table for both P&L and Balance Sheet OAuth views.
 *
 * Accepts the flat line array from the BC API routes (`income-statement-test?mode=pnl`
 * or `balance-sheet-test?mode=bs`) and renders a fully interactive, collapsible
 * statement table that matches the styling of the warehouse components
 * (WarehousePnLStatement / WarehouseBalanceSheet).
 */
export function CollapsibleStatementTable({
  lines,
  amountKey,
  currency,
  title,
  asOfDate,
  dateRange,
  isLoading,
  balanceCheck,
  exportButtons,
  tooltipProps,
  tableMaxWidth,
  onAccountClick,
  selectedAccountNumber,
  renderAccountDetail,
}: CollapsibleStatementTableProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  // Track COLLAPSED sections — default is all expanded
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      rowEven: isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]',
      rowHover: isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]',
      positive: isLight ? 'text-green-600' : 'text-green-400',
      negative: isLight ? 'text-red-600' : 'text-red-400',
    }),
    [isLight]
  )

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // Build visible lines — skip children of collapsed headers
  const visibleRows = useMemo(() => {
    interface VisibleRow {
      line: StatementLine
      lineIdx: number
      sectionKey?: string
      isCollapsible: boolean
      isExpanded: boolean
      childCount: number
      displayAmount?: number
    }

    const result: VisibleRow[] = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]

      if (line.lineType === 'header') {
        const sectionKey = buildSectionKey(line)
        const isExpanded = !collapsedSections.has(sectionKey)
        const { totalIdx, childCount, totalAmount } = findSectionEnd(lines, i, amountKey)
        const hasChildren = childCount > 0 || totalIdx > i + 1

        result.push({
          line,
          lineIdx: i,
          sectionKey,
          isCollapsible: hasChildren,
          isExpanded,
          childCount,
          displayAmount: !isExpanded && hasChildren ? totalAmount : undefined,
        })

        // When collapsed, skip everything up to and including the matching total
        if (!isExpanded && totalIdx >= 0) {
          i = totalIdx + 1
          continue
        }
      } else {
        result.push({
          line,
          lineIdx: i,
          isCollapsible: false,
          isExpanded: false,
          childCount: 0,
        })
      }

      i++
    }

    return result
  }, [lines, collapsedSections, amountKey])

  if (isLoading) {
    return (
      <div className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <h2
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            {title}
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </h2>
          {tooltipProps && <InfoTooltip {...tooltipProps} />}
        </div>
        <div
          className={cn('h-[300px] animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')}
        />
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <h2
            className={cn(
              'relative text-base font-normal uppercase tracking-wider',
              isLight ? 'text-stone-800' : 'text-stone-300'
            )}
          >
            {title}
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
          </h2>
          {tooltipProps && <InfoTooltip {...tooltipProps} />}
        </div>
        <p className={cn('text-sm py-4', styles.textMuted)}>No data available for this period</p>
      </div>
    )
  }

  return (
    <div>
      {/* Statement body — optionally constrained in a bordered panel */}
      <div
        className={cn(
          tableMaxWidth && 'mx-auto border px-6 py-4',
          tableMaxWidth && styles.border,
          tableMaxWidth && (isLight ? 'bg-white/60' : 'bg-white/[0.01]')
        )}
        style={tableMaxWidth ? { maxWidth: tableMaxWidth } : undefined}
      >
        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              {title}
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
            </h3>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <div className="flex items-center gap-3">
            {dateRange && (
              <span className={cn('text-xs font-mono', styles.textMuted)}>
                {fmtDate(dateRange.start)} - {fmtDate(dateRange.end)}
              </span>
            )}
            {asOfDate && (
              <span className={cn('text-xs font-mono', styles.textMuted)}>
                as of {fmtDate(asOfDate)}
              </span>
            )}
            {balanceCheck && (
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  balanceCheck.isBalanced
                    ? isLight
                      ? 'bg-green-500/10 text-green-600'
                      : 'bg-green-500/20 text-green-400'
                    : isLight
                      ? 'bg-red-500/10 text-red-600'
                      : 'bg-red-500/20 text-red-400'
                )}
              >
                {balanceCheck.isBalanced
                  ? 'Balanced'
                  : `Difference: ${formatPnLCurrency(balanceCheck.difference, currency)}`}
              </span>
            )}
            {exportButtons}
          </div>
        </div>
        {/* Column header */}
        <div
          className={cn(
            'flex items-center justify-between py-2 px-2 -mx-2 text-[12px] uppercase tracking-wider font-medium border-b',
            styles.textMuted,
            styles.border
          )}
        >
          <span>Description</span>
          <span className="font-currency">Amount ({getCurrencySymbol(currency)})</span>
        </div>

        {/* Table rows */}
        <div>
          {(() => {
            let detailIndex = 0

            return visibleRows.map(
              ({
                line,
                lineIdx,
                sectionKey,
                isCollapsible,
                isExpanded,
                childCount,
                displayAmount,
              }) => {
                if (line.lineType === 'spacer') {
                  return <div key={`spacer-${lineIdx}`} className="h-3" />
                }

                const isHeader = line.lineType === 'header'
                const isDetail = line.lineType === 'detail'
                const isTotal = line.lineType === 'total'
                const isComputed = line.lineType === 'computed'
                const indent = line.indentation * 16

                const amount =
                  isHeader && !isExpanded && displayAmount !== undefined
                    ? displayAmount
                    : (line[amountKey] ?? 0)

                const showAmount =
                  isDetail ||
                  isTotal ||
                  isComputed ||
                  (isHeader && isCollapsible && !isExpanded && displayAmount !== undefined)

                // Alternating background for detail rows
                const isEven = isDetail ? detailIndex++ % 2 === 0 : false
                const isClickableAccount = isDetail && !!line._accountNumber && !!onAccountClick

                return (
                  <React.Fragment key={`line-${lineIdx}`}>
                    <div
                      className={cn(
                        'group/row flex items-center justify-between py-2 px-2 -mx-2 text-[14px] transition-colors',
                        isHeader && isCollapsible && !isExpanded && styles.rowEven,
                        isDetail && isEven && styles.rowEven,
                        (isTotal || isComputed) && cn('border-t', styles.border),
                        (isCollapsible || isClickableAccount) && 'cursor-pointer',
                        styles.rowHover
                      )}
                      onClick={
                        isCollapsible
                          ? () => toggleSection(sectionKey!)
                          : isClickableAccount
                            ? () => onAccountClick!(line)
                            : undefined
                      }
                    >
                      <div className="flex items-center gap-1.5" style={{ paddingLeft: indent }}>
                        {/* Chevron for collapsible headers, spacer for alignment otherwise */}
                        {isCollapsible ? (
                          <div className="w-4 flex-shrink-0">
                            {isExpanded ? (
                              <ChevronDown className={cn('w-3.5 h-3.5', styles.textMuted)} />
                            ) : (
                              <ChevronRight className={cn('w-3.5 h-3.5', styles.textMuted)} />
                            )}
                          </div>
                        ) : isDetail || (isHeader && !isCollapsible) ? (
                          <div className="w-4 flex-shrink-0" />
                        ) : (isTotal || isComputed) && line.indentation > 0 ? (
                          <div className="w-4 flex-shrink-0" />
                        ) : null}

                        <span
                          className={cn(
                            isHeader && cn('font-semibold', styles.text),
                            isDetail && styles.textMuted,
                            isTotal && cn('font-bold', styles.text),
                            isComputed && cn('font-bold', styles.text)
                          )}
                        >
                          {line.display}
                        </span>

                        {/* Drill-down chevron beside name — rotates when detail open */}
                        {isClickableAccount &&
                          (line._accountNumber === selectedAccountNumber ? (
                            <ChevronDown
                              className={cn('w-3.5 h-3.5 flex-shrink-0', styles.textMuted)}
                            />
                          ) : (
                            <ChevronRight
                              className={cn(
                                'w-3.5 h-3.5 opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 flex-shrink-0',
                                styles.textMuted
                              )}
                            />
                          ))}

                        {/* Child count badge when collapsed */}
                        {isCollapsible && !isExpanded && childCount > 0 && (
                          <span className={cn('text-[12px]', styles.textMuted)}>
                            ({childCount})
                          </span>
                        )}
                      </div>

                      {showAmount && (
                        <span
                          className={cn(
                            'font-currency tabular-nums',
                            amount >= 0 ? styles.text : styles.negative,
                            isTotal && 'font-bold',
                            isTotal && line.indentation === 0 && amount >= 0 && styles.positive,
                            isTotal && line.indentation === 0 && amount < 0 && styles.negative,
                            isTotal && line.indentation === 0 && 'text-[16px]',
                            isComputed && amount >= 0 && styles.positive,
                            isComputed && amount < 0 && styles.negative,
                            isComputed && 'font-bold text-[16px]'
                          )}
                        >
                          {formatStatementAmount(amount, currency)}
                        </span>
                      )}
                    </div>
                    {isClickableAccount &&
                      line._accountNumber === selectedAccountNumber &&
                      renderAccountDetail?.()}
                  </React.Fragment>
                )
              }
            )
          })()}
        </div>

        {/* Footer */}
        <div
          className={cn(
            'flex items-center justify-between py-2 px-2 -mx-2 mt-3 border-t text-[10px]',
            styles.border,
            styles.textMuted
          )}
        >
          <span>Accrual Basis</span>
          <span className="font-mono">
            {new Date().toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>
    </div>
  )
}
