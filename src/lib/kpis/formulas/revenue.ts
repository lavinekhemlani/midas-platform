import { FinancialData } from '../types'

/**
 * Calculate Annual Recurring Revenue
 * Priority: Quarterly P&L > Monthly P&L > Invoices > Deposits
 * See: docs/api-v2/kpi-definitions/catalog.md#arr
 */
export function calculateARR(data: FinancialData): number {
  // Use period-based revenue if available
  if (data.pnl?.total_income && data.period) {
    const monthsInPeriod = data.period.months || 1
    const annualizedRevenue = (data.pnl.total_income / monthsInPeriod) * 12
    return Math.round(annualizedRevenue * 100) / 100
  }

  // Fallback to invoice data
  if (data.invoices && data.invoices.length > 0) {
    // Filter paid/active invoices from last 30 days for monthly estimate
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentInvoices = data.invoices.filter(inv => {
      const invDate = new Date(inv.date)
      return invDate >= thirtyDaysAgo && inv.status !== 'cancelled'
    })

    const monthlyInvoiceTotal = recentInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0)
    return Math.round(monthlyInvoiceTotal * 12 * 100) / 100
  }

  // Fallback to sales receipts
  if (data.salesReceipts && data.salesReceipts.length > 0) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentReceipts = data.salesReceipts.filter(receipt => {
      const receiptDate = new Date(receipt.date)
      return receiptDate >= thirtyDaysAgo
    })

    const monthlyReceiptTotal = recentReceipts.reduce((sum, receipt) => sum + (receipt.total || 0), 0)
    return Math.round(monthlyReceiptTotal * 12 * 100) / 100
  }

  // Fallback to deposit data (edge case: payment processors)
  if (data.deposits && data.deposits.length > 0) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentDeposits = data.deposits.filter(dep => {
      const depDate = new Date(dep.date)
      return depDate >= thirtyDaysAgo
    })

    const incomeDeposits = recentDeposits.filter(dep =>
      dep.lines?.some(line =>
        line.account_type === 'Income' ||
        line.account_name?.toLowerCase().includes('revenue') ||
        line.account_name?.toLowerCase().includes('sales')
      )
    )

    const monthlyDepositTotal = incomeDeposits.reduce((sum, dep) => {
      const incomeLines = dep.lines?.filter(line =>
        line.account_type === 'Income' ||
        line.account_name?.toLowerCase().includes('revenue') ||
        line.account_name?.toLowerCase().includes('sales')
      ) || []
      return sum + incomeLines.reduce((lineSum, line) => lineSum + (line.amount || 0), 0)
    }, 0)

    return Math.round(monthlyDepositTotal * 12 * 100) / 100
  }

  return 0
}

/**
 * Calculate Monthly Recurring Revenue
 * Formula: ARR / 12
 */
export function calculateMRR(data: FinancialData): number {
  const arr = calculateARR(data)
  return Math.round((arr / 12) * 100) / 100
}

/**
 * Calculate total revenue for period
 * Priority: P&L Report > Sum of Invoices > Sum of Sales Receipts > Income Deposits
 */
export function calculateRevenue(data: FinancialData): number {
  // Primary source: P&L report
  if (data.pnl?.total_income !== undefined) {
    return Math.round(data.pnl.total_income * 100) / 100
  }

  // Fallback: Sum of invoices
  if (data.invoices && data.invoices.length > 0) {
    const total = data.invoices
      .filter(inv => inv.status !== 'cancelled' && inv.status !== 'deleted')
      .reduce((sum, inv) => sum + (inv.total || 0), 0)
    return Math.round(total * 100) / 100
  }

  // Fallback: Sum of sales receipts
  if (data.salesReceipts && data.salesReceipts.length > 0) {
    const total = data.salesReceipts.reduce((sum, receipt) => sum + (receipt.total || 0), 0)
    return Math.round(total * 100) / 100
  }

  // Fallback: Income deposits
  if (data.deposits && data.deposits.length > 0) {
    const incomeTotal = data.deposits.reduce((sum, dep) => {
      const incomeLines = dep.lines?.filter(line =>
        line.account_type === 'Income' ||
        line.account_name?.toLowerCase().includes('revenue') ||
        line.account_name?.toLowerCase().includes('sales')
      ) || []
      return sum + incomeLines.reduce((lineSum, line) => lineSum + (line.amount || 0), 0)
    }, 0)
    return Math.round(incomeTotal * 100) / 100
  }

  return 0
}

/**
 * Calculate Revenue Growth Rate
 * Requires comparison with previous period
 */
export function calculateRevenueGrowth(
  currentData: FinancialData,
  previousData?: FinancialData
): number {
  if (!previousData) return 0

  const currentRevenue = calculateRevenue(currentData)
  const previousRevenue = calculateRevenue(previousData)

  if (previousRevenue === 0) {
    return currentRevenue > 0 ? 100 : 0
  }

  const growthRate = ((currentRevenue - previousRevenue) / previousRevenue) * 100
  return Math.round(growthRate * 10) / 10 // 1 decimal place for percentages
}