'use client'

import {
  BookkeepingValidationAlert,
  validatePnLData,
  validateBalanceSheetData,
  validateCashFlowData,
} from '../reports/components/BookkeepingValidationAlert'

// P&L data that triggers GROSS_PROFIT_MISMATCH and POSSIBLE_OTHER_INCOME
const pnlDataWithPossibleOtherIncome = {
  totalRevenue: 100000,
  costOfGoodsSold: 40000,
  operatingExpenses: 30000,
  otherExpenses: 5000,
  otherIncome: 0, // No other income recorded
  grossProfit: 55000, // Should be 60000, triggers GROSS_PROFIT_MISMATCH
  netIncome: 30000, // Higher than expected (25000), triggers POSSIBLE_OTHER_INCOME
}

// P&L data that triggers NET_INCOME_MISMATCH (when actual < expected)
const pnlDataWithNetIncomeMismatch = {
  totalRevenue: 100000,
  costOfGoodsSold: 40000,
  operatingExpenses: 30000,
  otherExpenses: 5000,
  otherIncome: 2000,
  grossProfit: 60000, // Correct
  netIncome: 20000, // Lower than expected (27000), triggers NET_INCOME_MISMATCH
}

const balanceSheetData = {
  totalAssets: 500000,
  totalLiabilities: 200000,
  totalEquity: 290000, // Should be 300000, triggers BALANCE_SHEET_IMBALANCE
  netIncomeFromPnL: 30000,
  netIncomeInEquity: 25000, // Mismatch triggers NET_INCOME_INCONSISTENCY
}

const cashFlowData = {
  beginningCash: 50000,
  endingCash: 70000, // Should be 65000, triggers CASH_BALANCE_MISMATCH
  netChangeInCash: 15000,
  operatingCashFlow: 20000,
  investingCashFlow: -10000,
  financingCashFlow: 2000, // Sum is 12000, not 15000, triggers NET_CHANGE_MISMATCH
}

export default function ValidationsTestPage() {
  const pnlIssuesWithOtherIncome = validatePnLData(pnlDataWithPossibleOtherIncome)
  const pnlIssuesWithMismatch = validatePnLData(pnlDataWithNetIncomeMismatch)
  const balanceSheetIssues = validateBalanceSheetData(balanceSheetData)
  const cashFlowIssues = validateCashFlowData(cashFlowData)

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2 theme-text-primary">Bookkeeping Validation Test</h1>
      <p className="text-muted-foreground mb-8">
        This page tests all validation alerts from BookkeepingValidationAlert.
      </p>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4 theme-text-primary">
            P&L: Gross Profit Mismatch + Possible Other Income
          </h2>
          <BookkeepingValidationAlert
            issues={pnlIssuesWithOtherIncome}
            reportType="pnl"
            defaultExpanded={true}
            collapsible={true}
          />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 theme-text-primary">
            P&L: Net Income Mismatch
          </h2>
          <BookkeepingValidationAlert
            issues={pnlIssuesWithMismatch}
            reportType="pnl"
            defaultExpanded={true}
            collapsible={true}
          />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 theme-text-primary">
            Balance Sheet Validations
          </h2>
          <BookkeepingValidationAlert
            issues={balanceSheetIssues}
            reportType="balance_sheet"
            defaultExpanded={true}
            collapsible={true}
          />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 theme-text-primary">
            Cash Flow Statement Validations
          </h2>
          <BookkeepingValidationAlert
            issues={cashFlowIssues}
            reportType="cash_flow"
            defaultExpanded={true}
            collapsible={true}
          />
        </section>
      </div>
    </div>
  )
}
