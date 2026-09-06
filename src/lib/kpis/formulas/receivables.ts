import { FinancialData } from '../types'

/**
 * Calculate Total Receivables Outstanding
 * Sum of all aged receivables balances
 */
export function calculateReceivablesOutstanding(data: FinancialData): number {
  if (!data.agedReceivables || data.agedReceivables.length === 0) {
    // Fallback to balance sheet accounts receivable
    if (data.balanceSheet?.accounts_receivable !== undefined) {
      return Math.round(data.balanceSheet.accounts_receivable * 100) / 100
    }
    return 0
  }

  const total = data.agedReceivables.reduce((sum, item) => sum + (item.total || 0), 0)
  return Math.round(total * 100) / 100
}

/**
 * Calculate Receivables Overdue Amount
 * Sum of receivables past 30 days
 */
export function calculateReceivablesOverdue(data: FinancialData): number {
  if (!data.agedReceivables || data.agedReceivables.length === 0) {
    return 0
  }

  const overdue = data.agedReceivables.reduce((sum, item) => {
    const pastDue = (item.days_31_60 || 0) +
                    (item.days_61_90 || 0) +
                    (item.days_over_90 || 0)
    return sum + pastDue
  }, 0)

  return Math.round(overdue * 100) / 100
}

/**
 * Calculate Receivables Past Due Percentage
 * Percentage of receivables that are overdue
 */
export function calculateReceivablesPastDuePercentage(data: FinancialData): number {
  const total = calculateReceivablesOutstanding(data)
  if (total === 0) return 0

  const overdue = calculateReceivablesOverdue(data)
  const percentage = (overdue / total) * 100
  return Math.round(percentage * 10) / 10 // 1 decimal place
}

/**
 * Calculate Average Invoice Size
 * Average value of invoices in the period
 */
export function calculateAverageInvoiceSize(data: FinancialData): number {
  if (!data.invoices || data.invoices.length === 0) {
    // Fallback to total receivables / customer count
    if (data.agedReceivables && data.agedReceivables.length > 0) {
      const total = calculateReceivablesOutstanding(data)
      const customerCount = calculateCustomerCount(data)
      if (customerCount > 0) {
        return Math.round((total / customerCount) * 100) / 100
      }
    }
    return 0
  }

  const validInvoices = data.invoices.filter(inv =>
    inv.status !== 'cancelled' &&
    inv.status !== 'deleted' &&
    inv.total > 0
  )

  if (validInvoices.length === 0) return 0

  const totalAmount = validInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0)
  const avgSize = totalAmount / validInvoices.length
  return Math.round(avgSize * 100) / 100
}

/**
 * Calculate Customer Count
 * Number of unique customers with outstanding receivables
 */
export function calculateCustomerCount(data: FinancialData): number {
  if (!data.agedReceivables || data.agedReceivables.length === 0) {
    // Fallback to count from invoices
    if (data.invoices && data.invoices.length > 0) {
      const uniqueCustomers = new Set(
        data.invoices
          .filter(inv => inv.status !== 'cancelled' && inv.status !== 'paid')
          .map(inv => inv.customer_id || inv.customer_name)
          .filter(id => id)
      )
      return uniqueCustomers.size
    }
    return 0
  }

  // Count entries in aged receivables (each entry is typically a customer)
  return data.agedReceivables.length
}

/**
 * Calculate Receivables Current Percentage
 * Percentage of receivables that are current (not overdue)
 */
export function calculateReceivablesCurrentPercentage(data: FinancialData): number {
  if (!data.agedReceivables || data.agedReceivables.length === 0) {
    return 0
  }

  const total = calculateReceivablesOutstanding(data)
  if (total === 0) return 0

  const current = data.agedReceivables.reduce((sum, item) =>
    sum + (item.current || 0), 0
  )

  const percentage = (current / total) * 100
  return Math.round(percentage * 10) / 10 // 1 decimal place
}

/**
 * Calculate Receivables 90+ Days Percentage
 * Percentage of receivables over 90 days old (high collection risk)
 */
export function calculateReceivables90PlusPercentage(data: FinancialData): number {
  if (!data.agedReceivables || data.agedReceivables.length === 0) {
    return 0
  }

  const total = calculateReceivablesOutstanding(data)
  if (total === 0) return 0

  const over90 = data.agedReceivables.reduce((sum, item) =>
    sum + (item.days_over_90 || 0), 0
  )

  const percentage = (over90 / total) * 100
  return Math.round(percentage * 10) / 10 // 1 decimal place
}

/**
 * Calculate Collection Efficiency
 * Ratio of current receivables to total (higher is better)
 */
export function calculateCollectionEfficiency(data: FinancialData): number {
  const currentPct = calculateReceivablesCurrentPercentage(data)
  const pastDuePct = calculateReceivablesPastDuePercentage(data)

  // Simple efficiency score: current % minus penalty for past due
  const efficiency = currentPct - (pastDuePct * 0.5)
  return Math.max(0, Math.round(efficiency * 10) / 10)
}

/**
 * Assess receivables health
 * Returns semantic interpretation of receivables metrics
 */
export function assessReceivablesHealth(data: FinancialData): {
  status: 'excellent' | 'good' | 'concerning' | 'critical'
  insights: string[]
  metrics: {
    outstanding: number
    overdue: number
    pastDuePct: number
    currentPct: number
    over90Pct: number
    customerCount: number
    avgInvoiceSize: number
  }
} {
  const outstanding = calculateReceivablesOutstanding(data)
  const overdue = calculateReceivablesOverdue(data)
  const pastDuePct = calculateReceivablesPastDuePercentage(data)
  const currentPct = calculateReceivablesCurrentPercentage(data)
  const over90Pct = calculateReceivables90PlusPercentage(data)
  const customerCount = calculateCustomerCount(data)
  const avgInvoiceSize = calculateAverageInvoiceSize(data)

  const insights: string[] = []
  let status: 'excellent' | 'good' | 'concerning' | 'critical' = 'good'

  // Assess past due percentage
  if (pastDuePct <= 10) {
    insights.push(`Excellent collection rate - only ${pastDuePct}% past due`)
    status = 'excellent'
  } else if (pastDuePct <= 25) {
    insights.push(`Good collection rate - ${pastDuePct}% past due`)
    status = 'good'
  } else if (pastDuePct <= 40) {
    insights.push(`Concerning collection issues - ${pastDuePct}% past due`)
    status = 'concerning'
  } else {
    insights.push(`Critical collection problems - ${pastDuePct}% past due`)
    status = 'critical'
  }

  // Assess 90+ days percentage
  if (over90Pct > 20) {
    insights.push(`High collection risk - ${over90Pct}% over 90 days old`)
    if (status === 'good') status = 'concerning'
    if (over90Pct > 30) status = 'critical'
  } else if (over90Pct > 10) {
    insights.push(`Moderate collection risk - ${over90Pct}% over 90 days old`)
  }

  // Assess concentration risk
  if (customerCount > 0 && outstanding > 0) {
    const avgPerCustomer = outstanding / customerCount
    if (avgPerCustomer > 50000) {
      insights.push(`High concentration risk - average ${Math.round(avgPerCustomer)} per customer`)
    }
  }

  // Assess collection efficiency
  if (currentPct >= 80) {
    insights.push(`Strong collection efficiency - ${currentPct}% current`)
  } else if (currentPct >= 60) {
    insights.push(`Fair collection efficiency - ${currentPct}% current`)
  } else {
    insights.push(`Poor collection efficiency - only ${currentPct}% current`)
    if (status === 'good') status = 'concerning'
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
      customerCount,
      avgInvoiceSize
    }
  }
}