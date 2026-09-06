'use client'

import { useMemo } from 'react'
import { StatementExportDropdown } from '@/components/reports/StatementExportDropdown'
import type { StatementLineItem } from '@/lib/utils/statementExport'

// Types for BC P&L lines
interface PnLLine {
  lineNumber: number
  display: string
  netChange: number
  lineType: string
  indentation: number
  _category?: string
  _accountNumber?: string
}

interface PnLTotals {
  totalRevenue: number
  totalCOGS: number
  grossProfit: number
  totalExpenses: number
  operatingIncome: number
  netIncome: number
}

interface PnLExportButtonsProps {
  lines: PnLLine[]
  totals: PnLTotals | null
  companyName?: string | null
  currency: string
  dateRange?: { start: string; end: string }
}

export function PnLExportButtons({
  lines,
  totals,
  companyName,
  currency,
  dateRange,
}: PnLExportButtonsProps) {
  // Transform BC P&L lines to StatementLineItem format for export
  const exportData = useMemo((): StatementLineItem[] => {
    if (!lines || lines.length === 0) return []

    // Filter out spacers
    const filteredLines = lines.filter((l) => l.lineType !== 'spacer')

    return filteredLines.map((line) => {
      const isHeader = line.lineType === 'header'
      const isTotal = line.lineType === 'total'
      const isDetail = line.lineType === 'detail'

      // Determine nesting level based on indentation
      const nestingLevel = line.indentation

      return {
        name: line.display,
        amount: line.netChange,
        isHeader: isHeader,
        isSubHeader: !isHeader && !isTotal && nestingLevel === 1,
        isChild: isDetail && nestingLevel >= 2,
        isTotal: isTotal && line.display.toLowerCase().includes('total'),
        isFinalTotal:
          isTotal &&
          (line.display.toLowerCase().includes('net income') ||
            line.display.toLowerCase().includes('gross profit') ||
            line.display.toLowerCase().includes('operating income')),
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
        title: companyName ? `${companyName} - Income Statement` : 'Income Statement',
        statementType: 'pnl',
        dateRange: dateRange,
        currency,
        basis: 'Accrual',
      }}
      compact
    />
  )
}
