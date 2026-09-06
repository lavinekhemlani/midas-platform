/**
 * Shared utility functions for financial reports
 * Provides common functionality for aged receivables, payables, and other reports
 */

import { QuickBooksClient } from '@/lib/providers/quickbooks/client'

// Import for internal use
import {
  formatDate as formatDateUtil,
  getAgingBucket as getAgingBucketUtil,
} from '@/lib/utils/financial/dateHelpers'

// Re-export core financial utilities
export {
  formatDate,
  getAgingBucket,
  getLastQuarters,
  getLastMonths,
  getDateRange as getDateRangeByDays,
} from '@/lib/utils/financial/dateHelpers'

export { calculateDaysOutstanding, calculatePercentage } from '@/lib/utils/financial/calculations'

/**
 * Paginated query for QuickBooks entities
 */
export async function paginatedQuery<T>(
  client: QuickBooksClient,
  baseQuery: string,
  maxResults: number = 500
): Promise<T[]> {
  const results: T[] = []
  let startPosition = 1
  let hasMore = true

  while (hasMore) {
    const query = `${baseQuery} STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`

    try {
      const response = await client.query(query)
      const entityName = Object.keys(response.QueryResponse || {})[0]
      const items = response.QueryResponse?.[entityName] || []

      results.push(...items)

      // Check if there are more results
      hasMore = items.length === maxResults
      startPosition += maxResults
    } catch (error) {
      console.error('Paginated query error:', error)
      hasMore = false
    }
  }

  return results
}

/**
 * Apply vendor credits to bills
 */
export interface BillWithCredit {
  id: string
  vendorId: string
  vendorName: string
  originalBalance: number
  creditApplied: number
  adjustedBalance: number
  dueDate: string
  txnDate: string
  daysOverdue: number
  bucket: string
}

export function applyVendorCredits(
  bills: any[],
  credits: any[],
  asOfDate: string
): {
  adjustedBills: BillWithCredit[]
  totalCreditsApplied: number
  unusedCredits: number
} {
  // Group credits by vendor
  const creditsByVendor = new Map<string, number>()

  credits.forEach((credit) => {
    const vendorId = credit.VendorRef?.value
    const balance = parseFloat(credit.TotalAmt || '0')
    if (vendorId && balance > 0) {
      creditsByVendor.set(vendorId, (creditsByVendor.get(vendorId) || 0) + balance)
    }
  })

  const totalCreditsAvailable = Array.from(creditsByVendor.values()).reduce(
    (sum, val) => sum + val,
    0
  )
  let totalCreditsApplied = 0

  // Apply credits to bills
  const adjustedBills: BillWithCredit[] = bills
    .map((bill) => {
      const balance = parseFloat(bill.Balance || '0')
      const vendorId = bill.VendorRef?.value
      const dueDate = bill.DueDate || bill.TxnDate

      // Calculate days overdue
      const due = new Date(dueDate)
      const asOf = new Date(asOfDate)
      const daysOverdue = Math.floor((asOf.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))

      // Apply available credits
      const availableCredit = creditsByVendor.get(vendorId) || 0
      const creditToApply = Math.min(balance, availableCredit)

      if (creditToApply > 0) {
        creditsByVendor.set(vendorId, availableCredit - creditToApply)
        totalCreditsApplied += creditToApply
      }

      const adjustedBalance = balance - creditToApply

      return {
        id: bill.Id,
        vendorId: vendorId || '',
        vendorName: bill.VendorRef?.name || 'Unknown',
        originalBalance: balance,
        creditApplied: creditToApply,
        adjustedBalance,
        dueDate,
        txnDate: bill.TxnDate,
        daysOverdue: Math.max(0, daysOverdue),
        bucket: getAgingBucketUtil(dueDate, asOfDate),
      }
    })
    .filter((bill) => bill.adjustedBalance > 0) // Only include bills with outstanding balance

  const unusedCredits = totalCreditsAvailable - totalCreditsApplied

  return {
    adjustedBills,
    totalCreditsApplied,
    unusedCredits,
  }
}

/**
 * Apply customer credits to invoices (similar logic for AR)
 */
export function applyCustomerCredits(
  invoices: any[],
  credits: any[],
  asOfDate: string
): {
  adjustedInvoices: any[]
  totalCreditsApplied: number
  unusedCredits: number
} {
  // Group credits by customer
  const creditsByCustomer = new Map<string, number>()

  credits.forEach((credit) => {
    const customerId = credit.CustomerRef?.value
    const balance = parseFloat(credit.TotalAmt || '0')
    if (customerId && balance > 0) {
      creditsByCustomer.set(customerId, (creditsByCustomer.get(customerId) || 0) + balance)
    }
  })

  const totalCreditsAvailable = Array.from(creditsByCustomer.values()).reduce(
    (sum, val) => sum + val,
    0
  )
  let totalCreditsApplied = 0

  // Apply credits to invoices
  const adjustedInvoices = invoices
    .map((invoice) => {
      const balance = parseFloat(invoice.Balance || '0')
      const customerId = invoice.CustomerRef?.value
      const availableCredit = creditsByCustomer.get(customerId) || 0
      const creditToApply = Math.min(balance, availableCredit)

      if (creditToApply > 0) {
        creditsByCustomer.set(customerId, availableCredit - creditToApply)
        totalCreditsApplied += creditToApply
      }

      return {
        ...invoice,
        originalBalance: balance,
        creditApplied: creditToApply,
        adjustedBalance: balance - creditToApply,
      }
    })
    .filter((invoice) => invoice.adjustedBalance > 0)

  const unusedCredits = totalCreditsAvailable - totalCreditsApplied

  return {
    adjustedInvoices,
    totalCreditsApplied,
    unusedCredits,
  }
}

/**
 * Calculate aging summary from bills/invoices
 */
export interface AgingSummary {
  current: number
  '1-30': number
  '31-60': number
  '61-90': number
  '91+': number
  total: number
}

export function calculateAgingSummary(
  items: Array<{ adjustedBalance: number; bucket: string }>
): AgingSummary {
  const summary: AgingSummary = {
    current: 0,
    '1-30': 0,
    '31-60': 0,
    '61-90': 0,
    '91+': 0,
    total: 0,
  }

  items.forEach((item) => {
    const amount = item.adjustedBalance
    summary.total += amount

    switch (item.bucket) {
      case 'current':
        summary.current += amount
        break
      case '1-30':
        summary['1-30'] += amount
        break
      case '31-60':
        summary['31-60'] += amount
        break
      case '61-90':
        summary['61-90'] += amount
        break
      default:
        summary['91+'] += amount
    }
  })

  return summary
}

/**
 * Build optimized query with field selection
 */
export function buildOptimizedQuery(
  entity: string,
  fields: string[],
  conditions: string[] = [],
  maxResults: number = 500,
  startPosition?: number
): string {
  let query = `SELECT ${fields.join(', ')} FROM ${entity}`

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`
  }

  if (startPosition && startPosition > 1) {
    query += ` STARTPOSITION ${startPosition}`
  }

  query += ` MAXRESULTS ${maxResults}`

  return query
}

// calculateDaysOutstanding and calculatePercentage are now imported from '@/lib/utils/financial/calculations'
// getDateRange (as getDateRangeByDays) is now imported from '@/lib/utils/financial/dateHelpers'

/**
 * Generate date range for queries (backward compatibility wrapper)
 */
export interface DateRange {
  start: string
  end: string
  days: number
}

export function getDateRange(asOfDate: string | Date, daysBack: number): DateRange {
  // Direct implementation to avoid circular reference
  const asOf = typeof asOfDate === 'string' ? new Date(asOfDate) : asOfDate
  const start = new Date(asOf.getTime() - daysBack * 24 * 60 * 60 * 1000)

  return {
    start: start.toISOString().split('T')[0],
    end: asOf.toISOString().split('T')[0],
    days: daysBack,
  }
}

/**
 * Group items by a property
 */
export function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>()

  items.forEach((item) => {
    const key = keyFn(item)
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(item)
  })

  return grouped
}
