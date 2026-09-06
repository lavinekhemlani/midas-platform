import { FinancialData } from '../types'

/**
 * Calculate Total Payables Outstanding
 * Sum of all aged payables balances
 */
export function calculatePayablesOutstanding(data: FinancialData): number {
  if (!data.agedPayables || data.agedPayables.length === 0) {
    // Fallback to balance sheet accounts payable
    if (data.balanceSheet?.accounts_payable !== undefined) {
      return Math.round(data.balanceSheet.accounts_payable * 100) / 100
    }
    return 0
  }

  const total = data.agedPayables.reduce((sum, item) => sum + (item.total || 0), 0)
  return Math.round(total * 100) / 100
}

/**
 * Calculate Payables Overdue Amount
 * Sum of payables past 30 days
 */
export function calculatePayablesOverdue(data: FinancialData): number {
  if (!data.agedPayables || data.agedPayables.length === 0) {
    return 0
  }

  const overdue = data.agedPayables.reduce((sum, item) => {
    const pastDue = (item.days_31_60 || 0) +
                    (item.days_61_90 || 0) +
                    (item.days_over_90 || 0)
    return sum + pastDue
  }, 0)

  return Math.round(overdue * 100) / 100
}

/**
 * Calculate Payables Past Due Percentage
 * Percentage of payables that are overdue
 */
export function calculatePayablesPastDuePercentage(data: FinancialData): number {
  const total = calculatePayablesOutstanding(data)
  if (total === 0) return 0

  const overdue = calculatePayablesOverdue(data)
  const percentage = (overdue / total) * 100
  return Math.round(percentage * 10) / 10 // 1 decimal place
}

/**
 * Calculate Average Bill Size
 * Average value of bills in the period
 */
export function calculateAverageBillSize(data: FinancialData): number {
  if (!data.bills || data.bills.length === 0) {
    // Fallback to total payables / vendor count
    if (data.agedPayables && data.agedPayables.length > 0) {
      const total = calculatePayablesOutstanding(data)
      const vendorCount = calculateVendorCount(data)
      if (vendorCount > 0) {
        return Math.round((total / vendorCount) * 100) / 100
      }
    }
    return 0
  }

  const validBills = data.bills.filter(bill =>
    bill.status !== 'cancelled' &&
    bill.status !== 'deleted' &&
    bill.total > 0
  )

  if (validBills.length === 0) return 0

  const totalAmount = validBills.reduce((sum, bill) => sum + (bill.total || 0), 0)
  const avgSize = totalAmount / validBills.length
  return Math.round(avgSize * 100) / 100
}

/**
 * Calculate Vendor Count
 * Number of unique vendors with outstanding payables
 */
export function calculateVendorCount(data: FinancialData): number {
  if (!data.agedPayables || data.agedPayables.length === 0) {
    // Fallback to count from bills
    if (data.bills && data.bills.length > 0) {
      const uniqueVendors = new Set(
        data.bills
          .filter(bill => bill.status !== 'cancelled' && bill.status !== 'paid')
          .map(bill => bill.vendor_id || bill.vendor_name)
          .filter(id => id)
      )
      return uniqueVendors.size
    }
    return 0
  }

  // Count entries in aged payables (each entry is typically a vendor)
  return data.agedPayables.length
}

/**
 * Calculate Payables Current Percentage
 * Percentage of payables that are current (not overdue)
 */
export function calculatePayablesCurrentPercentage(data: FinancialData): number {
  if (!data.agedPayables || data.agedPayables.length === 0) {
    return 0
  }

  const total = calculatePayablesOutstanding(data)
  if (total === 0) return 0

  const current = data.agedPayables.reduce((sum, item) =>
    sum + (item.current || 0), 0
  )

  const percentage = (current / total) * 100
  return Math.round(percentage * 10) / 10 // 1 decimal place
}

/**
 * Calculate Payables 90+ Days Percentage
 * Percentage of payables over 90 days old (potential relationship issues)
 */
export function calculatePayables90PlusPercentage(data: FinancialData): number {
  if (!data.agedPayables || data.agedPayables.length === 0) {
    return 0
  }

  const total = calculatePayablesOutstanding(data)
  if (total === 0) return 0

  const over90 = data.agedPayables.reduce((sum, item) =>
    sum + (item.days_over_90 || 0), 0
  )

  const percentage = (over90 / total) * 100
  return Math.round(percentage * 10) / 10 // 1 decimal place
}

/**
 * Calculate Payment Efficiency
 * Ratio of current payables to total (managing cash flow vs vendor relationships)
 */
export function calculatePaymentEfficiency(data: FinancialData): number {
  const currentPct = calculatePayablesCurrentPercentage(data)
  const over90Pct = calculatePayables90PlusPercentage(data)

  // Balance between keeping cash (good) and maintaining vendor relationships
  // Optimal is around 70-80% current, not too early, not too late
  let efficiency = 0
  if (currentPct >= 70 && currentPct <= 85) {
    efficiency = 100 // Optimal range
  } else if (currentPct > 85) {
    efficiency = 100 - ((currentPct - 85) * 2) // Paying too early
  } else if (currentPct < 70) {
    efficiency = currentPct * 1.2 // Paying too late
  }

  // Penalty for very old payables
  efficiency -= over90Pct * 2

  return Math.max(0, Math.round(efficiency * 10) / 10)
}

/**
 * Assess payables health
 * Returns semantic interpretation of payables metrics
 */
export function assessPayablesHealth(data: FinancialData): {
  status: 'optimal' | 'good' | 'concerning' | 'critical'
  insights: string[]
  metrics: {
    outstanding: number
    overdue: number
    pastDuePct: number
    currentPct: number
    over90Pct: number
    vendorCount: number
    avgBillSize: number
  }
} {
  const outstanding = calculatePayablesOutstanding(data)
  const overdue = calculatePayablesOverdue(data)
  const pastDuePct = calculatePayablesPastDuePercentage(data)
  const currentPct = calculatePayablesCurrentPercentage(data)
  const over90Pct = calculatePayables90PlusPercentage(data)
  const vendorCount = calculateVendorCount(data)
  const avgBillSize = calculateAverageBillSize(data)

  const insights: string[] = []
  let status: 'optimal' | 'good' | 'concerning' | 'critical' = 'good'

  // Assess payment timing (balance cash flow management with vendor relationships)
  if (currentPct >= 70 && currentPct <= 85) {
    insights.push(`Optimal payment timing - ${currentPct}% current (good cash flow management)`)
    status = 'optimal'
  } else if (currentPct > 90) {
    insights.push(`Paying bills very early - ${currentPct}% current (consider holding cash longer)`)
    status = 'good'
  } else if (currentPct >= 60) {
    insights.push(`Acceptable payment timing - ${currentPct}% current`)
    status = 'good'
  } else if (currentPct >= 40) {
    insights.push(`Delayed payment pattern - ${currentPct}% current (vendor relationships at risk)`)
    status = 'concerning'
  } else {
    insights.push(`Critical payment delays - only ${currentPct}% current`)
    status = 'critical'
  }

  // Assess very old payables
  if (over90Pct > 25) {
    insights.push(`Severe payment delays - ${over90Pct}% over 90 days (vendor relationships damaged)`)
    status = 'critical'
  } else if (over90Pct > 15) {
    insights.push(`Significant old payables - ${over90Pct}% over 90 days`)
    if (status === 'good' || status === 'optimal') status = 'concerning'
  } else if (over90Pct > 5) {
    insights.push(`Some aged payables - ${over90Pct}% over 90 days`)
  }

  // Assess vendor concentration
  if (vendorCount > 0 && outstanding > 0) {
    const avgPerVendor = outstanding / vendorCount
    if (vendorCount < 5 && outstanding > 50000) {
      insights.push(`High vendor concentration - only ${vendorCount} vendors`)
    } else if (avgPerVendor > 25000) {
      insights.push(`Large average payable - ${Math.round(avgPerVendor)} per vendor`)
    }
  }

  // Compare to cash position if available
  if (data.cashFlow?.cash_at_end && outstanding > 0) {
    const cashToPayablesRatio = data.cashFlow.cash_at_end / outstanding
    if (cashToPayablesRatio < 0.5) {
      insights.push(`Low cash coverage - cash covers only ${Math.round(cashToPayablesRatio * 100)}% of payables`)
      if (status === 'optimal') status = 'good'
    } else if (cashToPayablesRatio > 3) {
      insights.push(`Strong cash position - can cover payables ${cashToPayablesRatio.toFixed(1)}x`)
    }
  }

  return {
    status,
    insights,
    metrics: {
      outstanding,
      overdue,
      pastDuePct,
      currentPct,
      over90Pct,
      vendorCount,
      avgBillSize
    }
  }
}