'use client'

import React, { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatStatementAmount, getCurrencySymbol } from '@/lib/utils/currency'
import { StatementExportDropdown } from '@/components/reports/StatementExportDropdown'
import type { StatementLineItem } from '@/lib/utils/statementExport'
import { InfoTooltip, type InfoTooltipProps } from '@/components/ui/InfoTooltip'

export interface CashFlowLineItem {
  id: string
  name: string
  amount: number
  accountNo?: string
}

export interface CashFlowSection {
  name: string
  items: CashFlowLineItem[]
  subtotal: number
}

export interface CashFlowStatementData {
  beginningCash: number
  operatingActivities: {
    netIncome: number
    adjustments: {
      depreciation: number
      accountsReceivableChange: number
      inventoryChange: number
      accountsPayableChange: number
      prepaidChange: number
      accruedLiabilitiesChange: number
      deferredRevenueChange: number
      otherAdjustments: number
    }
    totalOperating: number
  }
  investingActivities: {
    capitalExpenditures: number
    assetSales: number
    investments: number
    totalInvesting: number
  }
  financingActivities: {
    debtProceeds: number
    debtRepayments: number
    equityChanges: number
    dividends: number
    totalFinancing: number
  }
  exchangeRateEffect?: number
  netCashChange: number
  endingCash: number
}

interface CashFlowStatementCardProps {
  data: CashFlowStatementData | null
  isLoading: boolean
  dateRange?: { start: string; end: string }
  currency?: string
  isLight?: boolean
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
  /** Callback when an item row is clicked for drill-down */
  onItemClick?: (item: { id: string; name: string }) => void
  /** Which item is currently selected for inline detail */
  selectedItemId?: string | null
  /** Render function for the inline item detail card */
  renderItemDetail?: () => React.ReactNode
}

type RowType = 'header' | 'item' | 'subtotal' | 'total' | 'spacer'

interface DisplayRow {
  id: string
  type: RowType
  name: string
  accountNo?: string
  amount?: number
  sectionKey?: string
  isCollapsible?: boolean
  childCount?: number
}

const SECTION_NAMES = ['Operating Activities', 'Investing Activities', 'Financing Activities']

export function CashFlowStatementCard({
  data,
  isLoading,
  dateRange,
  currency = 'USD',
  isLight = false,
  tooltipProps,
  onItemClick,
  selectedItemId,
  renderItemDetail,
}: CashFlowStatementCardProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['Operating Activities', 'Investing Activities', 'Financing Activities'])
  )

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      rowEven: isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]',
      rowHover: isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]',
    }),
    [isLight]
  )

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const rows = useMemo((): DisplayRow[] => {
    if (!data) return []

    const result: DisplayRow[] = []

    result.push({
      id: 'beginning-cash',
      type: 'total',
      name: 'Beginning Cash Balance',
      amount: data.beginningCash,
    })

    result.push({ id: 'spacer-0', type: 'spacer', name: '' })

    const operatingSection: CashFlowSection = {
      name: 'Operating Activities',
      items: [
        { id: 'net-income', name: 'Net Income', amount: data.operatingActivities.netIncome },
        {
          id: 'depreciation',
          name: 'Depreciation & Amortization',
          amount: data.operatingActivities.adjustments.depreciation,
        },
        {
          id: 'ar-change',
          name: 'Change in Accounts Receivable',
          amount: data.operatingActivities.adjustments.accountsReceivableChange,
        },
        {
          id: 'inventory-change',
          name: 'Change in Inventory',
          amount: data.operatingActivities.adjustments.inventoryChange,
        },
        {
          id: 'ap-change',
          name: 'Change in Accounts Payable',
          amount: data.operatingActivities.adjustments.accountsPayableChange,
        },
        {
          id: 'prepaid-change',
          name: 'Change in Prepaid Expenses',
          amount: data.operatingActivities.adjustments.prepaidChange,
        },
        {
          id: 'accrued-change',
          name: 'Change in Accrued Liabilities',
          amount: data.operatingActivities.adjustments.accruedLiabilitiesChange,
        },
        {
          id: 'deferred-revenue-change',
          name: 'Change in Deferred Revenue',
          amount: data.operatingActivities.adjustments.deferredRevenueChange,
        },
      ].filter((item) => item.amount != null && isFinite(item.amount) && item.amount !== 0),
      subtotal: data.operatingActivities.totalOperating,
    }

    const investingSection: CashFlowSection = {
      name: 'Investing Activities',
      items: [
        {
          id: 'capex',
          name: 'Capital Expenditures',
          amount: data.investingActivities.capitalExpenditures,
        },
        { id: 'asset-sales', name: 'Asset Sales', amount: data.investingActivities.assetSales },
        { id: 'investments', name: 'Investments', amount: data.investingActivities.investments },
      ].filter((item) => item.amount != null && isFinite(item.amount) && item.amount !== 0),
      subtotal: data.investingActivities.totalInvesting,
    }

    const financingSection: CashFlowSection = {
      name: 'Financing Activities',
      items: [
        {
          id: 'debt-proceeds',
          name: 'Debt Proceeds',
          amount: data.financingActivities.debtProceeds,
        },
        {
          id: 'debt-repayments',
          name: 'Debt Repayments',
          amount: data.financingActivities.debtRepayments,
        },
        {
          id: 'equity-changes',
          name: 'Equity Changes',
          amount: data.financingActivities.equityChanges,
        },
        { id: 'dividends', name: 'Dividends', amount: data.financingActivities.dividends },
      ].filter((item) => item.amount != null && isFinite(item.amount) && item.amount !== 0),
      subtotal: data.financingActivities.totalFinancing,
    }

    const addSection = (section: CashFlowSection, sectionName: string, sectionKey: string) => {
      const isExpanded = expandedSections.has(sectionKey)

      result.push({
        id: `header-${sectionKey}`,
        type: 'header',
        name: sectionName,
        amount: isExpanded ? undefined : section.subtotal,
        sectionKey,
        isCollapsible: true,
        childCount: section.items.length,
      })

      if (isExpanded) {
        for (const item of section.items) {
          result.push({
            id: `item-${item.id}`,
            type: 'item',
            name: item.name,
            accountNo: item.accountNo,
            amount: item.amount,
          })
        }

        result.push({
          id: `subtotal-${sectionKey}`,
          type: 'subtotal',
          name: `Net Cash from ${sectionName}`,
          amount: section.subtotal,
        })
      }
    }

    addSection(operatingSection, 'Operating Activities', 'Operating Activities')
    result.push({ id: 'spacer-1', type: 'spacer', name: '' })

    addSection(investingSection, 'Investing Activities', 'Investing Activities')
    result.push({ id: 'spacer-2', type: 'spacer', name: '' })

    addSection(financingSection, 'Financing Activities', 'Financing Activities')

    if (data.exchangeRateEffect && Math.abs(data.exchangeRateEffect) > 0.5) {
      result.push({ id: 'spacer-3', type: 'spacer', name: '' })
      result.push({
        id: 'fx-effect',
        type: 'item',
        name: 'Effect of Exchange Rate Changes',
        amount: data.exchangeRateEffect,
      })
    }

    result.push({ id: 'spacer-4', type: 'spacer', name: '' })

    result.push({
      id: 'net-change',
      type: 'subtotal',
      name: 'Net Change in Cash',
      amount: data.netCashChange,
    })

    result.push({ id: 'spacer-5', type: 'spacer', name: '' })

    result.push({
      id: 'ending-cash',
      type: 'total',
      name: 'Ending Cash Balance',
      amount: data.endingCash,
    })

    return result
  }, [data, expandedSections])

  // Transform data for export (always expanded)
  const exportData = useMemo((): StatementLineItem[] => {
    if (!data) return []

    const result: StatementLineItem[] = []

    result.push({
      name: 'Beginning Cash Balance',
      amount: data.beginningCash,
      isTotal: true,
    })

    // Operating Activities
    result.push({
      name: 'Operating Activities',
      amount: data.operatingActivities.totalOperating,
      isHeader: true,
      isCollapsible: true,
      isExpanded: true,
    })

    const operatingItems = [
      { name: 'Net Income', amount: data.operatingActivities.netIncome },
      {
        name: 'Depreciation & Amortization',
        amount: data.operatingActivities.adjustments.depreciation,
      },
      {
        name: 'Change in Accounts Receivable',
        amount: data.operatingActivities.adjustments.accountsReceivableChange,
      },
      { name: 'Change in Inventory', amount: data.operatingActivities.adjustments.inventoryChange },
      {
        name: 'Change in Accounts Payable',
        amount: data.operatingActivities.adjustments.accountsPayableChange,
      },
    ].filter((item) => item.amount != null && isFinite(item.amount) && item.amount !== 0)

    for (const item of operatingItems) {
      result.push({ ...item, isChild: true })
    }

    result.push({
      name: 'Net Cash from Operating Activities',
      amount: data.operatingActivities.totalOperating,
      isSubtotal: true,
    })

    // Investing Activities
    result.push({
      name: 'Investing Activities',
      amount: data.investingActivities.totalInvesting,
      isHeader: true,
      isCollapsible: true,
      isExpanded: true,
    })

    const investingItems = [
      { name: 'Capital Expenditures', amount: data.investingActivities.capitalExpenditures },
      { name: 'Asset Sales', amount: data.investingActivities.assetSales },
      { name: 'Investments', amount: data.investingActivities.investments },
    ].filter((item) => item.amount != null && isFinite(item.amount) && item.amount !== 0)

    for (const item of investingItems) {
      result.push({ ...item, isChild: true })
    }

    result.push({
      name: 'Net Cash from Investing Activities',
      amount: data.investingActivities.totalInvesting,
      isSubtotal: true,
    })

    // Financing Activities
    result.push({
      name: 'Financing Activities',
      amount: data.financingActivities.totalFinancing,
      isHeader: true,
      isCollapsible: true,
      isExpanded: true,
    })

    const financingItems = [
      { name: 'Debt Proceeds', amount: data.financingActivities.debtProceeds },
      { name: 'Debt Repayments', amount: data.financingActivities.debtRepayments },
      { name: 'Equity Changes', amount: data.financingActivities.equityChanges },
      { name: 'Dividends', amount: data.financingActivities.dividends },
    ].filter((item) => item.amount != null && isFinite(item.amount) && item.amount !== 0)

    for (const item of financingItems) {
      result.push({ ...item, isChild: true })
    }

    result.push({
      name: 'Net Cash from Financing Activities',
      amount: data.financingActivities.totalFinancing,
      isSubtotal: true,
    })

    if (data.exchangeRateEffect && Math.abs(data.exchangeRateEffect) > 0.5) {
      result.push({
        name: 'Effect of Exchange Rate Changes',
        amount: data.exchangeRateEffect,
        isChild: true,
      })
    }

    result.push({
      name: 'Net Change in Cash',
      amount: data.netCashChange,
      isSubtotal: true,
    })

    result.push({
      name: 'Ending Cash Balance',
      amount: data.endingCash,
      isFinalTotal: true,
    })

    return result
  }, [data])

  if (isLoading) {
    return (
      <div>
        <div
          className={cn(
            'mx-auto border px-6 py-4',
            styles.border,
            isLight ? 'bg-white/60' : 'bg-white/[0.01]'
          )}
          style={{ maxWidth: '1000px' }}
        >
          <div className="flex items-center gap-1.5 mb-4">
            <h2
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Statement of Cash Flows
            </h2>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <div
            className={cn('h-[300px] animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')}
          />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <div
          className={cn(
            'mx-auto border px-6 py-4',
            styles.border,
            isLight ? 'bg-white/60' : 'bg-white/[0.01]'
          )}
          style={{ maxWidth: '1000px' }}
        >
          <div className="flex items-center gap-1.5 mb-4">
            <h2
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Statement of Cash Flows
            </h2>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <p className={cn('text-sm py-4', styles.textMuted)}>No cash flow data available</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div
        className={cn(
          'mx-auto border px-6 py-4',
          styles.border,
          isLight ? 'bg-white/60' : 'bg-white/[0.01]'
        )}
        style={{ maxWidth: '1000px' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <h2
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Statement of Cash Flows
            </h2>
            {tooltipProps && <InfoTooltip {...tooltipProps} />}
          </div>
          <div className="flex items-center gap-3">
            {dateRange && (
              <span className={cn('text-xs font-mono', styles.textMuted)}>
                {new Date(dateRange.start + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                -{' '}
                {new Date(dateRange.end + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
            <StatementExportDropdown
              data={exportData}
              metadata={{
                title: 'Statement of Cash Flows',
                statementType: 'cash-flow',
                dateRange: dateRange,
                currency,
                basis: 'Cash',
              }}
              compact
            />
          </div>
        </div>

        {/* Table header */}
        <div
          className={cn(
            'flex items-center justify-between py-2 px-2 -mx-2 text-[10px] uppercase tracking-wider font-medium border-b',
            styles.textMuted,
            styles.border
          )}
        >
          <span>Description</span>
          <span className="font-currency">Amount ({getCurrencySymbol(currency)})</span>
        </div>

        {/* Table rows */}
        <div>
          {rows.map((row, index) => {
            if (row.type === 'spacer') {
              return <div key={row.id} className="h-3" />
            }

            const isExpanded = row.sectionKey ? expandedSections.has(row.sectionKey) : false
            const isCollapsibleRow = !!row.isCollapsible
            const isMainHeader = row.type === 'header' && SECTION_NAMES.includes(row.name)
            const isClickableItem = row.type === 'item' && !!onItemClick

            const showAmount =
              row.type === 'item' ||
              row.type === 'subtotal' ||
              row.type === 'total' ||
              (row.type === 'header' && isCollapsibleRow && !isExpanded)

            const rowItemId = row.id.replace('item-', '')

            return (
              <React.Fragment key={row.id}>
                <div
                  className={cn(
                    'group/row flex items-center justify-between py-2 px-2 -mx-2 text-xs transition-colors',
                    isMainHeader && !isExpanded && styles.rowEven,
                    row.type === 'item' && index % 2 === 0 && styles.rowEven,
                    row.type === 'subtotal' && cn('border-t', styles.border),
                    row.type === 'total' && cn('border-t', styles.border),
                    (isCollapsibleRow || isClickableItem) && 'cursor-pointer',
                    styles.rowHover
                  )}
                  onClick={
                    isCollapsibleRow
                      ? () => toggleSection(row.sectionKey!)
                      : isClickableItem
                        ? () => onItemClick!({ id: row.id.replace('item-', ''), name: row.name })
                        : undefined
                  }
                >
                  <div className="flex items-center gap-1.5">
                    {isCollapsibleRow && (
                      <div className="w-4 flex-shrink-0">
                        {isExpanded ? (
                          <ChevronDown className={cn('w-3.5 h-3.5', styles.textMuted)} />
                        ) : (
                          <ChevronRight className={cn('w-3.5 h-3.5', styles.textMuted)} />
                        )}
                      </div>
                    )}
                    {row.type === 'item' && (
                      <div className="w-4 flex-shrink-0">
                        {isClickableItem &&
                          (rowItemId === selectedItemId ? (
                            <ChevronDown className={cn('w-3 h-3', styles.textMuted)} />
                          ) : (
                            <ChevronRight
                              className={cn(
                                'w-3 h-3 opacity-0 group-hover/row:opacity-100 transition-opacity',
                                styles.textMuted
                              )}
                            />
                          ))}
                      </div>
                    )}
                    <span
                      className={cn(
                        row.type === 'header' && 'font-semibold',
                        row.type === 'item' && styles.textMuted,
                        row.type === 'subtotal' && 'font-bold',
                        row.type === 'total' && 'font-bold',
                        row.type === 'header' ? styles.text : '',
                        row.type === 'subtotal' ? styles.text : '',
                        row.type === 'total' ? styles.text : ''
                      )}
                    >
                      {row.name}
                    </span>
                    {isCollapsibleRow &&
                      !isExpanded &&
                      row.childCount !== undefined &&
                      row.childCount > 0 && (
                        <span className={cn('text-[10px]', styles.textMuted)}>
                          ({row.childCount})
                        </span>
                      )}
                  </div>
                  {showAmount && row.amount !== undefined && (
                    <span
                      className={cn(
                        'font-currency tabular-nums',
                        row.amount >= 0 ? styles.text : isLight ? 'text-red-600' : 'text-red-400',
                        row.type === 'subtotal' && 'font-bold',
                        row.type === 'total' &&
                          row.amount >= 0 &&
                          (isLight ? 'text-green-600' : 'text-green-400'),
                        row.type === 'total' &&
                          row.amount < 0 &&
                          (isLight ? 'text-red-600' : 'text-red-400'),
                        row.type === 'total' && 'font-bold text-base'
                      )}
                    >
                      {formatStatementAmount(row.amount, currency)}
                    </span>
                  )}
                </div>
                {isClickableItem && rowItemId === selectedItemId && renderItemDetail?.()}
              </React.Fragment>
            )
          })}
        </div>

        {/* Footer */}
        <div
          className={cn(
            'flex items-center justify-between py-2 px-2 -mx-2 mt-3 border-t text-[10px]',
            styles.border,
            styles.textMuted
          )}
        >
          <span>Indirect Method</span>
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
