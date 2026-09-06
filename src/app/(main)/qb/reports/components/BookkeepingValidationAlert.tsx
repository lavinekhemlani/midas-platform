'use client'

import { AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info'
  code: string
  title: string
  description: string
  expected?: string | number
  actual?: string | number
  difference?: string | number
  suggestion?: string
}

interface BookkeepingValidationAlertProps {
  issues: ValidationIssue[]
  reportType: 'pnl' | 'balance_sheet' | 'cash_flow'
  className?: string
  collapsible?: boolean
  defaultExpanded?: boolean
}

export function BookkeepingValidationAlert({
  issues,
  reportType,
  className,
  collapsible = true,
  defaultExpanded = false,
}: BookkeepingValidationAlertProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed || !issues || issues.length === 0) {
    return null
  }

  const errors = issues.filter((i) => i.type === 'error')
  const warnings = issues.filter((i) => i.type === 'warning')
  const infos = issues.filter((i) => i.type === 'info')

  const hasErrors = errors.length > 0
  const hasWarnings = warnings.length > 0

  const reportName =
    reportType === 'pnl'
      ? 'Income Statement'
      : reportType === 'balance_sheet'
        ? 'Balance Sheet'
        : 'Cash Flow Statement'

  const variant = hasErrors ? 'destructive' : hasWarnings ? 'warning' : 'default'

  const formatValue = (value: string | number | undefined): string => {
    if (value === undefined) return '-'
    if (typeof value === 'number') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(value)
    }
    return value
  }

  return (
    <Alert variant={variant} className={cn('mb-4 relative', className)}>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-transparent"
              onClick={() => setIsDismissed(true)}
              aria-label="Dismiss alert"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </Button>
            <div className="flex items-center gap-2">
              <p className="font-semibold">
                {hasErrors
                  ? `${reportName} has ${errors.length} potential issue${errors.length > 1 ? 's' : ''}`
                  : hasWarnings
                    ? `${reportName} has ${warnings.length} warning${warnings.length > 1 ? 's' : ''}`
                    : `${reportName} has ${infos.length} note${infos.length > 1 ? 's' : ''}`}
              </p>
              {collapsible && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>

            {(!collapsible || isExpanded) && (
              <div className="mt-3 space-y-3">
                {issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'rounded-md p-3 text-sm',
                      issue.type === 'error'
                        ? 'bg-destructive/10'
                        : issue.type === 'warning'
                          ? 'bg-amber-500/10'
                          : 'border border-amber-500/40'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium',
                          issue.type === 'error'
                            ? 'bg-destructive/20 text-destructive'
                            : issue.type === 'warning'
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-200'
                              : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {issue.type.toUpperCase()}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium">{issue.title}</p>
                        <p className="text-muted-foreground mt-1">{issue.description}</p>

                        {(issue.expected !== undefined ||
                          issue.actual !== undefined ||
                          issue.difference !== undefined) && (
                          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                            {issue.expected !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Expected:</span>
                                <span className="ml-1 font-mono">
                                  {formatValue(issue.expected)}
                                </span>
                              </div>
                            )}
                            {issue.actual !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Actual:</span>
                                <span className="ml-1 font-mono">{formatValue(issue.actual)}</span>
                              </div>
                            )}
                            {issue.difference !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Difference:</span>
                                <span className="ml-1 font-mono text-destructive">
                                  {formatValue(issue.difference)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {issue.suggestion && (
                          <p className="mt-2 text-xs text-muted-foreground italic">
                            Suggestion: {issue.suggestion}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <p className="text-xs text-muted-foreground mt-2">
                  These validations compare calculated values against reported totals. Discrepancies
                  may indicate data entry issues in your accounting software.
                </p>
              </div>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  )
}

// Helper function to generate P&L validation issues
export function validatePnLData(data: {
  totalRevenue: number
  costOfGoodsSold: number
  operatingExpenses: number
  otherExpenses: number
  otherIncome: number
  grossProfit: number
  netIncome: number
}): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Validate Gross Profit = Revenue - COGS
  const expectedGrossProfit = data.totalRevenue - data.costOfGoodsSold
  if (Math.abs(expectedGrossProfit - data.grossProfit) > 0.02 && data.grossProfit !== 0) {
    issues.push({
      type: 'warning',
      code: 'GROSS_PROFIT_MISMATCH',
      title: 'Gross Profit Calculation Discrepancy',
      description: 'Gross Profit does not equal Revenue minus Cost of Goods Sold.',
      expected: expectedGrossProfit,
      actual: data.grossProfit,
      difference: Math.abs(expectedGrossProfit - data.grossProfit),
      suggestion: 'Check if all COGS items are properly categorized in your accounting software.',
    })
  }

  // Validate Net Income = Revenue + Other Income - COGS - Operating Expenses - Other Expenses
  const expectedNetIncome =
    data.totalRevenue +
    data.otherIncome -
    data.costOfGoodsSold -
    data.operatingExpenses -
    data.otherExpenses
  const netIncomeDiff = Math.abs(expectedNetIncome - data.netIncome)

  if (netIncomeDiff > 0.02 && data.netIncome !== 0) {
    // Check if the difference might be explained by missing Other Income
    // (actual net income is higher than expected AND no other income is recorded)
    if (data.netIncome > expectedNetIncome && Math.abs(data.otherIncome) < 0.01) {
      issues.push({
        type: 'info',
        code: 'POSSIBLE_OTHER_INCOME',
        title: 'Possible Missing Other Income',
        description:
          'Net Income is higher than calculated Operating Income. There may be non-operating income (like interest) not shown separately.',
        expected: expectedNetIncome,
        actual: data.netIncome,
        difference: netIncomeDiff,
        suggestion:
          'Check your accounting software for "Other Income" items between Operating Income and Net Income.',
      })
    } else {
      issues.push({
        type: 'warning',
        code: 'NET_INCOME_MISMATCH',
        title: 'Net Income Calculation Discrepancy',
        description:
          'Net Income does not match the expected calculation from revenue and expense components.',
        expected: expectedNetIncome,
        actual: data.netIncome,
        difference: netIncomeDiff,
        suggestion:
          'Review all income and expense categories to ensure proper classification. Check for missing line items or miscategorized transactions.',
      })
    }
  }

  return issues
}

// Helper function to generate Balance Sheet validation issues
export function validateBalanceSheetData(data: {
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  netIncomeFromPnL?: number
  netIncomeInEquity?: number
}): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Validate Assets = Liabilities + Equity
  const expectedLiabilitiesEquity = data.totalLiabilities + data.totalEquity
  const balanceDiff = Math.abs(data.totalAssets - expectedLiabilitiesEquity)

  if (balanceDiff > 0.02 && data.totalAssets !== 0) {
    issues.push({
      type: 'error',
      code: 'BALANCE_SHEET_IMBALANCE',
      title: 'Balance Sheet Does Not Balance',
      description: 'Total Assets does not equal Total Liabilities plus Total Equity.',
      expected: data.totalAssets,
      actual: expectedLiabilitiesEquity,
      difference: balanceDiff,
      suggestion:
        'This is a fundamental accounting error. Review recent journal entries and ensure all transactions are properly balanced.',
    })
  }

  // Validate Net Income consistency between P&L and Balance Sheet
  if (
    data.netIncomeFromPnL !== undefined &&
    data.netIncomeInEquity !== undefined &&
    data.netIncomeFromPnL !== 0
  ) {
    const netIncomeDiff = Math.abs(data.netIncomeFromPnL - data.netIncomeInEquity)
    if (netIncomeDiff > 0.02) {
      issues.push({
        type: 'warning',
        code: 'NET_INCOME_INCONSISTENCY',
        title: 'Net Income Mismatch Between Reports',
        description:
          'The Net Income shown in the Balance Sheet Equity section differs from the Income Statement Net Income.',
        expected: data.netIncomeFromPnL,
        actual: data.netIncomeInEquity,
        difference: netIncomeDiff,
        suggestion:
          'This may indicate timing differences, adjusting entries, or data sync issues. Verify both reports use the same date range and refresh the data.',
      })
    }
  }

  return issues
}

// Helper function to generate Cash Flow validation issues
export function validateCashFlowData(data: {
  beginningCash: number
  endingCash: number
  netChangeInCash: number
  operatingCashFlow: number
  investingCashFlow: number
  financingCashFlow: number
}): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Validate Ending Cash = Beginning Cash + Net Change
  const expectedEndingCash = data.beginningCash + data.netChangeInCash
  const endingCashDiff = Math.abs(expectedEndingCash - data.endingCash)

  if (endingCashDiff > 0.02 && data.endingCash !== 0) {
    issues.push({
      type: 'error',
      code: 'CASH_BALANCE_MISMATCH',
      title: 'Ending Cash Balance Discrepancy',
      description: 'Ending Cash Balance does not equal Beginning Cash plus Net Change in Cash.',
      expected: expectedEndingCash,
      actual: data.endingCash,
      difference: endingCashDiff,
      suggestion: 'Review cash transactions and ensure all cash movements are properly recorded.',
    })
  }

  // Validate Net Change = Operating + Investing + Financing
  const calculatedNetChange =
    data.operatingCashFlow + data.investingCashFlow + data.financingCashFlow
  const netChangeDiff = Math.abs(calculatedNetChange - data.netChangeInCash)

  if (
    netChangeDiff > 0.02 &&
    data.netChangeInCash !== 0 &&
    (data.investingCashFlow !== 0 || data.financingCashFlow !== 0)
  ) {
    issues.push({
      type: 'warning',
      code: 'NET_CHANGE_MISMATCH',
      title: 'Net Change in Cash Calculation Discrepancy',
      description:
        'Net Change in Cash does not equal the sum of Operating, Investing, and Financing activities.',
      expected: calculatedNetChange,
      actual: data.netChangeInCash,
      difference: netChangeDiff,
      suggestion:
        'Verify all cash flow categories are properly classified and no transactions are missing.',
    })
  }

  return issues
}
