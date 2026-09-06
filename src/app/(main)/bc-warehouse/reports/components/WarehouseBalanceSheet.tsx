'use client'

import React, { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatStatementAmount, formatPnLCurrency, getCurrencySymbol } from '@/lib/utils/currency'
import { StatementExportDropdown } from '@/components/reports/StatementExportDropdown'
import { useTheme } from '@/hooks/useTheme'
import type { StatementLineItem } from '@/lib/utils/statementExport'
import type { GLAccountTotal } from '../hooks/useWarehousePnLStatement'

interface WarehouseBalanceSheetProps {
  data: {
    assetAccounts: GLAccountTotal[]
    assetGroups: Record<string, GLAccountTotal[]>
    liabilityAccounts: GLAccountTotal[]
    liabilityGroups: Record<string, GLAccountTotal[]>
    equityAccounts: GLAccountTotal[]
    equityGroups: Record<string, GLAccountTotal[]>
    netIncomeForPeriod?: number
    totals: {
      totalAssets: number
      totalLiabilities: number
      totalEquity: number
      totalLiabilitiesAndEquity: number
    }
  } | null
  isLoading: boolean
  asOfDate?: string
  currency?: string
}

type RowType = 'header' | 'subheader' | 'account' | 'subtotal' | 'total' | 'final-total' | 'spacer'

interface DisplayRow {
  id: string
  type: RowType
  name: string
  accountNo?: string
  amount?: number
  nestingLevel: number
  isCollapsible?: boolean
  sectionKey?: string
  childCount?: number
}

const MAIN_SECTION_HEADERS = ['Assets', 'Liabilities', 'Equity']

export function WarehouseBalanceSheet({
  data,
  isLoading,
  asOfDate,
  currency = 'USD',
}: WarehouseBalanceSheetProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['Assets', 'Liabilities', 'Equity'])
  )

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
    const {
      assetGroups,
      liabilityGroups,
      equityGroups,
      totals,
      assetAccounts,
      liabilityAccounts,
      equityAccounts,
    } = data

    const addSection = (
      sectionName: string,
      sectionKey: string,
      groups: Record<string, GLAccountTotal[]>,
      accounts: GLAccountTotal[],
      sectionTotal: number,
      isDebitNormal: boolean
    ) => {
      const isExpanded = expandedSections.has(sectionKey)

      result.push({
        id: `header-${sectionKey}`,
        type: 'header',
        name: sectionName,
        amount: sectionTotal,
        nestingLevel: 0,
        isCollapsible: true,
        sectionKey,
        childCount: accounts.length,
      })

      if (isExpanded) {
        const sortedGroups = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))

        for (const [subcat, accts] of sortedGroups) {
          const subcatKey = `${sectionKey}-${subcat}`
          const isSubcatExpanded = expandedSections.has(subcatKey)

          const subcatTotal = accts.reduce((sum, acc) => {
            if (isDebitNormal) {
              return sum + acc.total_debits - acc.total_credits
            } else {
              return sum + acc.total_credits - acc.total_debits
            }
          }, 0)

          if (accts.length > 1) {
            result.push({
              id: `subheader-${subcatKey}`,
              type: 'subheader',
              name: subcat,
              nestingLevel: 1,
              isCollapsible: true,
              sectionKey: subcatKey,
              childCount: accts.length,
              amount: isSubcatExpanded ? undefined : subcatTotal,
            })

            if (isSubcatExpanded) {
              for (const acc of accts) {
                const accAmount = isDebitNormal
                  ? acc.total_debits - acc.total_credits
                  : acc.total_credits - acc.total_debits
                result.push({
                  id: `account-${acc.g_laccount_no}`,
                  type: 'account',
                  name: acc.g_laccount_name,
                  accountNo: acc.g_laccount_no,
                  amount: accAmount,
                  nestingLevel: 2,
                })
              }

              result.push({
                id: `subtotal-${subcatKey}`,
                type: 'subtotal',
                name: `Total ${subcat}`,
                amount: subcatTotal,
                nestingLevel: 1,
              })
            }
          } else {
            const acc = accts[0]
            const accAmount = isDebitNormal
              ? acc.total_debits - acc.total_credits
              : acc.total_credits - acc.total_debits
            result.push({
              id: `account-${acc.g_laccount_no}`,
              type: 'account',
              name: acc.g_laccount_name,
              accountNo: acc.g_laccount_no,
              amount: accAmount,
              nestingLevel: 1,
            })
          }
        }

        result.push({
          id: `total-${sectionKey}`,
          type: 'total',
          name: `Total ${sectionName}`,
          amount: sectionTotal,
          nestingLevel: 0,
        })
      }
    }

    // Assets section (debit normal)
    addSection('Assets', 'Assets', assetGroups, assetAccounts, totals.totalAssets, true)

    result.push({ id: 'spacer-1', type: 'spacer', name: '', nestingLevel: 0 })

    // Liabilities section (credit normal)
    addSection(
      'Liabilities',
      'Liabilities',
      liabilityGroups,
      liabilityAccounts,
      totals.totalLiabilities,
      false
    )

    result.push({ id: 'spacer-2', type: 'spacer', name: '', nestingLevel: 0 })

    // Equity section (credit normal)
    addSection('Equity', 'Equity', equityGroups, equityAccounts, totals.totalEquity, false)

    result.push({ id: 'spacer-3', type: 'spacer', name: '', nestingLevel: 0 })

    // Total Liabilities & Equity
    result.push({
      id: 'total-liabilities-equity',
      type: 'final-total',
      name: 'Total Liabilities & Equity',
      amount: totals.totalLiabilitiesAndEquity,
      nestingLevel: 0,
    })

    return result
  }, [data, expandedSections])

  // Check if balance sheet balances
  const isBalanced = data
    ? Math.abs(data.totals.totalAssets - data.totals.totalLiabilitiesAndEquity) < 0.01
    : true
  const difference = data ? data.totals.totalAssets - data.totals.totalLiabilitiesAndEquity : 0

  // Transform data for export (always expanded)
  const exportData = useMemo((): StatementLineItem[] => {
    if (!data) return []

    const result: StatementLineItem[] = []
    const {
      assetGroups,
      liabilityGroups,
      equityGroups,
      totals,
      assetAccounts,
      liabilityAccounts,
      equityAccounts,
    } = data

    const addExportSection = (
      sectionName: string,
      groups: Record<string, GLAccountTotal[]>,
      sectionTotal: number,
      isDebitNormal: boolean
    ) => {
      result.push({
        name: sectionName,
        amount: sectionTotal,
        isHeader: true,
        isCollapsible: true,
        isExpanded: true,
      })

      const sortedGroups = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))

      for (const [subcat, accts] of sortedGroups) {
        if (accts.length > 1) {
          const subcatTotal = accts.reduce((sum, acc) => {
            return isDebitNormal
              ? sum + acc.total_debits - acc.total_credits
              : sum + acc.total_credits - acc.total_debits
          }, 0)

          result.push({
            name: subcat,
            amount: subcatTotal,
            isSubHeader: true,
            isCollapsible: true,
            isExpanded: true,
          })

          for (const acc of accts) {
            const accAmount = isDebitNormal
              ? acc.total_debits - acc.total_credits
              : acc.total_credits - acc.total_debits
            result.push({
              name: acc.g_laccount_name,
              amount: accAmount,
              isChild: true,
            })
          }

          result.push({
            name: `Total ${subcat}`,
            amount: subcatTotal,
            isSubtotal: true,
          })
        } else {
          const acc = accts[0]
          const accAmount = isDebitNormal
            ? acc.total_debits - acc.total_credits
            : acc.total_credits - acc.total_debits
          result.push({
            name: acc.g_laccount_name,
            amount: accAmount,
            isChild: true,
          })
        }
      }

      result.push({
        name: `Total ${sectionName}`,
        amount: sectionTotal,
        isTotal: true,
      })
    }

    addExportSection('Assets', assetGroups, totals.totalAssets, true)
    addExportSection('Liabilities', liabilityGroups, totals.totalLiabilities, false)
    addExportSection('Equity', equityGroups, totals.totalEquity, false)

    result.push({
      name: 'Total Liabilities & Equity',
      amount: totals.totalLiabilitiesAndEquity,
      isFinalTotal: true,
    })

    return result
  }, [data])

  if (isLoading) {
    return (
      <div className="pt-6">
        <h2 className={cn('text-3xl font-medium tracking-wide mb-4', styles.text)}>
          Balance Sheet
        </h2>
        <div
          className={cn('h-[300px] animate-pulse', isLight ? 'bg-stone-100' : 'bg-white/[0.02]')}
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="pt-6">
        <h2 className={cn('text-3xl font-medium tracking-wide mb-4', styles.text)}>
          Balance Sheet
        </h2>
        <p className={cn('text-sm py-4', styles.textMuted)}>No balance sheet data available</p>
      </div>
    )
  }

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className={cn('text-3xl font-medium tracking-wide', styles.text)}>Balance Sheet</h2>
        <div className="flex items-center gap-3">
          {asOfDate && (
            <span className={cn('text-xs font-mono', styles.textMuted)}>
              as of{' '}
              {new Date(asOfDate + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          )}
          <span
            className={cn(
              'px-2 py-0.5 rounded text-xs font-medium',
              isBalanced
                ? isLight
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-green-500/20 text-green-400'
                : isLight
                  ? 'bg-red-500/10 text-red-600'
                  : 'bg-red-500/20 text-red-400'
            )}
          >
            {isBalanced ? 'Balanced' : `Difference: ${formatPnLCurrency(difference, currency)}`}
          </span>
          <StatementExportDropdown
            data={exportData}
            metadata={{
              title: 'Balance Sheet',
              statementType: 'balance-sheet',
              asOfDate: asOfDate,
              currency,
              basis: 'Accrual',
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
        {(() => {
          let itemIndex = 0
          return rows.map((row) => {
            if (row.type === 'spacer') {
              return <div key={row.id} className="h-3" />
            }

            const isExpanded = row.sectionKey ? expandedSections.has(row.sectionKey) : false
            const isCollapsibleRow = !!row.isCollapsible
            const isMainHeader = row.type === 'header' && MAIN_SECTION_HEADERS.includes(row.name)

            const showAmount =
              row.type === 'account' ||
              row.type === 'subtotal' ||
              row.type === 'total' ||
              row.type === 'final-total' ||
              (row.type === 'subheader' && row.amount !== undefined) ||
              (row.type === 'header' && isCollapsibleRow && !isExpanded)

            // Track item index for alternating rows
            const currentItemIndex = row.type === 'account' ? itemIndex++ : -1
            const isEvenItem = currentItemIndex >= 0 && currentItemIndex % 2 === 0

            return (
              <div
                key={row.id}
                className={cn(
                  'flex items-center justify-between py-2 px-2 -mx-2 text-xs transition-colors',
                  isMainHeader && !isExpanded && styles.rowEven,
                  row.type === 'account' && isEvenItem && styles.rowEven,
                  row.type === 'subtotal' && cn('border-t', styles.border),
                  row.type === 'total' && cn('border-t', styles.border),
                  row.type === 'final-total' && cn('border-t', styles.border),
                  isCollapsibleRow && 'cursor-pointer',
                  styles.rowHover
                )}
                onClick={isCollapsibleRow ? () => toggleSection(row.sectionKey!) : undefined}
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
                  {row.type === 'account' && <div className="w-4 flex-shrink-0" />}
                  {row.type === 'subheader' && row.nestingLevel === 1 && (
                    <div className="w-4 flex-shrink-0" />
                  )}
                  {(row.type === 'subtotal' ||
                    row.type === 'total' ||
                    row.type === 'final-total') &&
                    row.nestingLevel > 0 && <div className="w-4 flex-shrink-0" />}
                  <span
                    className={cn(
                      row.type === 'header' && cn('font-semibold', styles.text),
                      row.type === 'subheader' && styles.text,
                      row.type === 'account' && styles.textMuted,
                      row.type === 'subtotal' && cn('font-bold', styles.text),
                      row.type === 'total' && cn('font-bold', styles.text),
                      row.type === 'final-total' && cn('font-bold', styles.text)
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
                      row.amount >= 0 ? styles.text : styles.negative,
                      row.type === 'subtotal' && 'font-bold',
                      row.type === 'total' && row.amount >= 0 && styles.positive,
                      row.type === 'total' && row.amount < 0 && styles.negative,
                      row.type === 'total' && 'font-bold text-base',
                      row.type === 'final-total' && row.amount >= 0 && styles.positive,
                      row.type === 'final-total' && row.amount < 0 && styles.negative,
                      row.type === 'final-total' && 'font-bold text-base'
                    )}
                  >
                    {formatStatementAmount(row.amount, currency)}
                  </span>
                )}
              </div>
            )
          })
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
  )
}
