'use client'

import { useMemo } from 'react'
import { StatementExportDropdown } from '@/components/reports/StatementExportDropdown'
import type { StatementLineItem } from '@/lib/utils/statementExport'

// Types for BC Balance Sheet lines
interface BSLine {
  lineNumber: number
  display: string
  balance: number
  lineType: string
  indentation: number
  _category?: string
  _accountNumber?: string
}

interface BSTotals {
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  netIncome: number
}

interface BalanceSheetExportDropdownProps {
  lines: BSLine[]
  totals: BSTotals | null
  companyName?: string | null
  currency: string
  asOfDate?: string
}

export function BalanceSheetExportButtons({
  lines,
  totals,
  companyName,
  currency,
  asOfDate,
}: BalanceSheetExportDropdownProps) {
  // Transform BC balance sheet lines to StatementLineItem format for export
  const exportData = useMemo((): StatementLineItem[] => {
    if (!lines || lines.length === 0) return []

    // Filter out spacers and balance check line
    const filteredLines = lines.filter(
      (l) => l.lineType !== 'spacer' && l.display !== 'Balance Check (A - L - E)'
    )

    return filteredLines.map((line) => {
      const isHeader = line.lineType === 'header'
      const isTotal = line.lineType === 'total'
      const isDetail = line.lineType === 'detail'

      // Determine nesting level based on indentation
      const nestingLevel = line.indentation

      return {
        name: line.display,
        amount: line.balance,
        isHeader: isHeader,
        isSubHeader: !isHeader && !isTotal && nestingLevel === 1,
        isChild: isDetail && nestingLevel >= 2,
        isTotal: isTotal && line.display.toLowerCase().includes('total'),
        isFinalTotal:
          isTotal &&
          (line.display.toLowerCase().includes('total assets') ||
            line.display.toLowerCase().includes('total liabilities') ||
            line.display.toLowerCase().includes('total equity')),
        nestingLevel,
        depth: nestingLevel,
      }
    })
  }, [lines])

  const hasData = lines.length > 0

  if (!hasData) return null

  return (
    <StatementExportDropdown
      data={exportData}
      metadata={{
        title: companyName ? `${companyName} - Balance Sheet` : 'Balance Sheet',
        statementType: 'balance-sheet',
        asOfDate: asOfDate,
        currency,
        basis: 'Accrual',
      }}
      compact
    />
  )
}
