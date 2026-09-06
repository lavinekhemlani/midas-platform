import { NextResponse } from 'next/server'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import {
  formatDate,
  getAgingBucket,
  getLastQuarters,
  paginatedQuery,
  applyVendorCredits,
  calculateAgingSummary,
  buildOptimizedQuery,
  calculateDaysOutstanding,
  getDateRange,
  calculatePercentage,
} from '@/lib/utils/reportHelpers'
import { throttledRequests, withRetry } from '@/lib/utils/throttle'
import { getProviderCompanyMetadata, updateProviderCompanyMetadata } from '@/lib/providers/database'

// Get default as-of date (today)
function getDefaultAsOfDate(): string {
  return formatDate(new Date())
}

// Get detailed bill aging
// Type definitions for aged payables data
interface AgingSummary {
  current: number
  '31-60': number
  '61-90': number
  '91-120': number
  '120+': number
  total: number
  credits: number
  unusedCredits: number
}

interface ProcessedBill {
  id: string
  vendor: string
  vendorId: string
  balance: number
  creditApplied: number
  dueDate: string
  txnDate: string
  daysOverdue: number
  bucket: string
}

interface BillAgingResult {
  bills: ProcessedBill[]
  summary: AgingSummary | {}
}

interface APData {
  total?: number
  payables?: Array<{
    current?: number
    days_1_30?: number
    days_31_60?: number
    days_61_90?: number
    days_over_90?: number
    total?: number
  }>
}

async function getBillAging(
  orgId: string,
  asOfDate: string,
  providerId: string,
  realmId?: string
): Promise<BillAgingResult> {
  if (providerId !== 'quickbooks') {
    return { bills: [], summary: {} }
  }

  try {
    const client = new QuickBooksClient({ organizationId: orgId, realmId })

    // Query all open bills with pagination
    const billQuery = `SELECT * FROM Bill WHERE Balance > '0'`
    const bills = await paginatedQuery<any>(client, billQuery, 500)

    // Also get vendor credits to offset payables with pagination
    const creditQuery = `SELECT * FROM VendorCredit`
    const credits = await paginatedQuery<any>(client, creditQuery, 500)

    // Apply vendor credits and calculate aging
    const { adjustedBills, totalCreditsApplied, unusedCredits } = applyVendorCredits(
      bills,
      credits,
      asOfDate
    )

    // Calculate aging summary
    const agingSummary = calculateAgingSummary(adjustedBills)

    // Map aging buckets for compatibility with existing UI
    const summaryWithCredits = {
      current: agingSummary.current,
      '31-60': agingSummary['1-30'] || 0, // Map 1-30 to 31-60 for UI compatibility
      '61-90': agingSummary['31-60'] || 0, // Map 31-60 to 61-90 for UI compatibility
      '91-120': agingSummary['61-90'] || 0, // Map 61-90 to 91-120 for UI compatibility
      '120+': agingSummary['91+'] || 0, // Map 91+ to 120+ for UI compatibility
      total: agingSummary.total,
      credits: totalCreditsApplied,
      unusedCredits,
    }

    // Format bills for response
    const processedBills = adjustedBills.map((bill) => ({
      id: bill.id,
      vendor: bill.vendorName,
      vendorId: bill.vendorId,
      balance: bill.adjustedBalance,
      creditApplied: bill.creditApplied,
      dueDate: bill.dueDate,
      txnDate: bill.txnDate,
      daysOverdue: bill.daysOverdue,
      bucket: bill.bucket,
    }))

    return { bills: processedBills, summary: summaryWithCredits }
  } catch (error) {
    console.error('Error fetching bill aging:', error)
    return { bills: [], summary: {} }
  }
}

// Get top vendors with aging breakdown
async function getTopVendors(bills: any[], limit: number = 20) {
  // Group bills by vendor
  const vendorMap = new Map<string, any>()

  bills.forEach((bill) => {
    const vendorId = bill.vendorId || bill.vendor
    if (!vendorMap.has(vendorId)) {
      vendorMap.set(vendorId, {
        vendor: bill.vendor,
        current: 0,
        days31_60: 0,
        days61_90: 0,
        days91_120: 0,
        over120: 0,
        total: 0,
        billCount: 0,
      })
    }

    const vendor = vendorMap.get(vendorId)
    const balance = bill.balance
    vendor.billCount++

    // Add to appropriate bucket
    if (bill.daysOverdue <= 0) {
      vendor.current += balance
    } else if (bill.daysOverdue <= 30) {
      vendor.days31_60 += balance
    } else if (bill.daysOverdue <= 60) {
      vendor.days61_90 += balance
    } else if (bill.daysOverdue <= 90) {
      vendor.days91_120 += balance
    } else {
      vendor.over120 += balance
    }
    vendor.total += balance
  })

  // Convert to array and sort by total
  return Array.from(vendorMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

// Calculate payment metrics including DPO
async function getPaymentMetrics(
  orgId: string,
  asOfDate: string,
  totalOutstanding: number,
  providerId: string,
  realmId?: string
) {
  if (providerId !== 'quickbooks') {
    return {
      paymentCompliance: 0,
      avgDaysOutstanding: 0,
      avgInvoiceSize: 0,
      dpoTarget: 30,
    }
  }

  try {
    const client = new QuickBooksClient({ organizationId: orgId, realmId })

    // Get payments from last 30 days
    const { start: thirtyDaysAgo, end } = getDateRange(asOfDate, 30)

    // Query bill payments with optimized fields
    const paymentQuery = buildOptimizedQuery(
      'BillPayment',
      ['Id', 'TxnDate', 'TotalAmt', 'VendorRef'],
      [`TxnDate >= '${thirtyDaysAgo}'`, `TxnDate <= '${end}'`],
      500
    )
    const paymentResult = await withRetry(() => client.query(paymentQuery))
    const paymentList = paymentResult.QueryResponse?.BillPayment || []

    // Calculate total paid
    const totalPaid = paymentList.reduce(
      (sum: number, payment: any) => sum + parseFloat(payment.TotalAmt || '0'),
      0
    )

    // Get bills created in last 30 days with optimized fields
    const billQuery = buildOptimizedQuery(
      'Bill',
      ['Id', 'TxnDate', 'TotalAmt', 'Balance', 'VendorRef'],
      [`TxnDate >= '${thirtyDaysAgo}'`, `TxnDate <= '${end}'`],
      500
    )
    const billResult = await withRetry(() => client.query(billQuery))
    const billList = billResult.QueryResponse?.Bill || []

    const totalBilled = billList.reduce(
      (sum: number, bill: any) => sum + parseFloat(bill.TotalAmt || '0'),
      0
    )

    // Calculate metrics
    const paymentCompliance = calculatePercentage(totalPaid, totalBilled, 1)

    // Calculate average invoice size
    const avgInvoiceSize = billList.length > 0 ? totalBilled / billList.length : 0

    // Calculate DPO (Days Payable Outstanding)
    // Get purchases from last 90 days for DPO calculation
    const { start: ninetyDaysAgo } = getDateRange(asOfDate, 90)

    // Optimized purchase query with field selection (Purchase uses EntityRef, not VendorRef)
    const purchaseQuery = buildOptimizedQuery(
      'Purchase',
      ['Id', 'TxnDate', 'TotalAmt', 'EntityRef', 'AccountRef'],
      [`TxnDate >= '${ninetyDaysAgo}'`, `TxnDate <= '${asOfDate}'`],
      500
    )
    const purchaseResult = await withRetry(() => client.query(purchaseQuery))
    const purchaseList = purchaseResult.QueryResponse?.Purchase || []

    // Reuse the existing bill list for expenses to avoid duplicate query
    const expenseQuery = buildOptimizedQuery(
      'Bill',
      ['Id', 'TxnDate', 'TotalAmt', 'VendorRef'],
      [`TxnDate >= '${ninetyDaysAgo}'`, `TxnDate <= '${asOfDate}'`],
      500
    )
    const expenseResult = await withRetry(() => client.query(expenseQuery))
    const expenseList = expenseResult.QueryResponse?.Bill || []

    // Calculate total purchases (bills + direct purchases)
    const totalPurchases =
      purchaseList.reduce((sum: number, p: any) => sum + parseFloat(p.TotalAmt || '0'), 0) +
      expenseList.reduce((sum: number, b: any) => sum + parseFloat(b.TotalAmt || '0'), 0)

    const dailyPurchases = totalPurchases / 90
    const avgDaysOutstanding = calculateDaysOutstanding(totalOutstanding, dailyPurchases)

    return {
      paymentCompliance: Math.round(paymentCompliance * 10) / 10,
      avgDaysOutstanding,
      avgInvoiceSize: Math.round(avgInvoiceSize),
      dpoTarget: 30, // Standard industry target
    }
  } catch (error) {
    console.error('Error calculating payment metrics:', error)
    return {
      paymentCompliance: 0,
      avgDaysOutstanding: 0,
      avgInvoiceSize: 0,
      dpoTarget: 30,
    }
  }
}

// Get vendor categories
async function getVendorCategories(bills: any[]) {
  // Group bills by vendor and categorize
  const categoryMap = new Map<string, number>()

  bills.forEach((bill) => {
    // Simple categorization based on vendor name or memo
    // In production, this could use vendor classification from QuickBooks
    const vendor = bill.vendor?.toLowerCase() || ''
    const memo = bill.memo?.toLowerCase() || ''

    let category = 'Other'

    if (
      vendor.includes('software') ||
      vendor.includes('cloud') ||
      vendor.includes('tech') ||
      vendor.includes('microsoft') ||
      vendor.includes('amazon') ||
      vendor.includes('google')
    ) {
      category = 'IT & Software'
    } else if (
      vendor.includes('office') ||
      vendor.includes('supplies') ||
      vendor.includes('staples')
    ) {
      category = 'Office Supplies'
    } else if (
      vendor.includes('consulting') ||
      vendor.includes('services') ||
      vendor.includes('agency')
    ) {
      category = 'Professional Services'
    } else if (
      vendor.includes('rent') ||
      vendor.includes('utilities') ||
      vendor.includes('facilities')
    ) {
      category = 'Facilities'
    } else if (
      vendor.includes('insurance') ||
      vendor.includes('legal') ||
      vendor.includes('accounting')
    ) {
      category = 'Professional Services'
    } else if (vendor.includes('marketing') || vendor.includes('advertising')) {
      category = 'Marketing'
    }

    categoryMap.set(category, (categoryMap.get(category) || 0) + bill.balance)
  })

  // Calculate total for percentages
  const total = Array.from(categoryMap.values()).reduce((sum, val) => sum + val, 0)

  // Convert to array format
  return Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: calculatePercentage(amount, total, 1),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10) // Top 10 categories
}

// Get payment schedule forecast
async function getPaymentSchedule(bills: any[], asOfDate: string) {
  const asOf = new Date(asOfDate)
  const next7Days = new Date(asOf)
  next7Days.setDate(next7Days.getDate() + 7)
  const next30Days = new Date(asOf)
  next30Days.setDate(next30Days.getDate() + 30)
  const next60Days = new Date(asOf)
  next60Days.setDate(next60Days.getDate() + 60)

  const schedule = {
    overdue: 0,
    next7Days: 0,
    next30Days: 0,
    next60Days: 0,
    beyond60Days: 0,
    dpo_average: 0,
  }

  bills.forEach((bill) => {
    const dueDate = new Date(bill.dueDate)
    const balance = bill.balance

    if (dueDate < asOf) {
      schedule.overdue += balance
    } else if (dueDate <= next7Days) {
      schedule.next7Days += balance
    } else if (dueDate <= next30Days) {
      schedule.next30Days += balance
    } else if (dueDate <= next60Days) {
      schedule.next60Days += balance
    } else {
      schedule.beyond60Days += balance
    }
  })

  // Calculate average DPO from current bills
  if (bills.length > 0) {
    const totalDays = bills.reduce((sum, bill) => {
      const txnDate = new Date(bill.txnDate)
      const dueDate = new Date(bill.dueDate)
      return sum + Math.floor((dueDate.getTime() - txnDate.getTime()) / (1000 * 60 * 60 * 24))
    }, 0)
    schedule.dpo_average = Math.round(totalDays / bills.length)
  }

  return schedule
}

// Get quarterly trend data (reduced from monthly for performance)
async function getQuarterlyTrend(orgId: string, asOfDate: string, provider: any, apiClient: any) {
  try {
    const quarters = getLastQuarters(asOfDate, 3)

    // Fetch aged payables for each quarter end with throttling
    const quarterlyData = await throttledRequests(
      quarters.map((quarter) => async () => {
        try {
          const apData: APData = await withRetry(() =>
            provider.reports.agedPayables(
              orgId,
              {
                end_date: quarter.end,
              },
              apiClient
            )
          )

          // Calculate totals from the payables data
          let current = 0
          let overdue = 0
          let total = 0

          if (apData.payables && Array.isArray(apData.payables)) {
            apData.payables.forEach((pay: any) => {
              current += pay.current || 0
              overdue +=
                (pay.days_1_30 || 0) +
                (pay.days_31_60 || 0) +
                (pay.days_61_90 || 0) +
                (pay.days_over_90 || 0)
              total += pay.total || 0
            })
          }

          return {
            period: quarter.label,
            total: apData.total || total,
            current,
            overdue,
          }
        } catch (error) {
          console.error(`Error fetching quarter ${quarter.label}:`, error)
          return {
            period: quarter.label,
            total: 0,
            current: 0,
            overdue: 0,
          }
        }
      }),
      2, // Max 2 concurrent requests
      500 // 500ms delay between batches
    )

    return quarterlyData
  } catch (error) {
    console.error('Error fetching monthly trend:', error)
    return []
  }
}

// Generate action items based on data
function generateActionItems(
  summary: any,
  paymentSchedule: any,
  paymentCompliance: number,
  totalOutstanding: number
) {
  const items = []

  // High priority: Very overdue bills
  const veryOverdue = (summary['91-120'] || 0) + (summary['120+'] || 0)
  if (veryOverdue > 0) {
    items.push({
      priority: 'high',
      title: 'Critical Overdue Payments',
      message: `$${veryOverdue.toLocaleString()} in payments are 91+ days overdue. Contact vendors immediately to negotiate payment terms and avoid service disruptions.`,
    })
  }

  // Medium priority: Upcoming payments
  if (paymentSchedule.next7Days > 0) {
    items.push({
      priority: 'medium',
      title: 'Upcoming Payments',
      message: `$${paymentSchedule.next7Days.toLocaleString()} due in next 7 days. Ensure sufficient cash flow for these payments.`,
    })
  }

  // Check payment compliance
  if (paymentCompliance < 70) {
    items.push({
      priority: 'medium',
      title: 'Payment Compliance',
      message: `Payment compliance rate is ${paymentCompliance}%. Review AP processes to improve on-time payment rate and maintain vendor relationships.`,
    })
  }

  // Optimization opportunities
  if (summary.current > totalOutstanding * 0.5) {
    const potentialSavings = Math.round(summary.current * 0.02) // 2% early payment discount
    items.push({
      priority: 'low',
      title: 'Early Payment Discounts',
      message: `Consider early payment discounts for current payables. Potential savings of $${potentialSavings.toLocaleString()} on $${summary.current.toLocaleString()}.`,
    })
  }

  // Cash flow optimization
  if (paymentSchedule.dpo_average < 25) {
    items.push({
      priority: 'low',
      title: 'Cash Flow Optimization',
      message: `Average DPO is ${paymentSchedule.dpo_average} days. Consider negotiating longer payment terms to improve cash flow.`,
    })
  }

  // Vendor credits available
  if (summary.credits > 0) {
    items.push({
      priority: 'medium',
      title: 'Vendor Credits Available',
      message: `$${summary.credits.toLocaleString()} in vendor credits available. Apply these to outstanding bills to reduce payables.`,
    })
  }

  return items
}

export const GET = withActiveProvider(
  async (request, { provider, apiClient, organizationId, providerId, realmId }) => {
    try {
      const { searchParams } = new URL(request.url)
      const asOfDate = searchParams.get('date') || getDefaultAsOfDate()
      const includeDetails = searchParams.get('details') !== 'false'

      // Get company metadata - prefer stored values to avoid API calls
      const storedMetadata = await getProviderCompanyMetadata(organizationId, providerId)
      let currency: string = storedMetadata.homeCurrency || ''

      if (!currency) {
        // Fallback: fetch from provider API (also stores for future use)
        const orgInfo = await (provider.organizations.getOrganizationInfo as any)(
          organizationId,
          apiClient
        )
        currency = orgInfo.currency_code || 'USD'

        // Store metadata for future requests
        updateProviderCompanyMetadata(organizationId, providerId, {
          homeCurrency: currency,
          companyName: orgInfo.name || undefined,
        }).catch((err) => console.warn('[AP Report] Failed to store metadata:', err))
      }

      // CORE DATA: Use existing aged payables function
      console.log(`Fetching aged payables for ${organizationId} as of ${asOfDate}`)
      const apData: APData = await (provider.reports.agedPayables as any)(
        organizationId,
        {
          end_date: asOfDate,
        },
        apiClient
      )

      // Get detailed bill aging
      const { bills, summary } = await getBillAging(organizationId, asOfDate, providerId, realmId)

      // Get payment metrics
      const paymentMetrics = await getPaymentMetrics(
        organizationId,
        asOfDate,
        ('total' in summary ? summary.total : 0) || apData.total || 0,
        providerId,
        realmId
      )

      // Get top vendors
      const topVendors = includeDetails ? await getTopVendors(bills) : null

      // Get vendor categories
      const vendorCategories = await getVendorCategories(bills)

      // Get payment schedule
      const paymentSchedule = await getPaymentSchedule(bills, asOfDate)

      // Get quarterly trend (reduced from monthly for performance)
      const quarterlyTrend = await getQuarterlyTrend(organizationId, asOfDate, provider, apiClient)

      // Calculate aging buckets for chart
      const isFullSummary = (s: any): s is AgingSummary => 'total' in s
      const total = (isFullSummary(summary) ? summary.total : 0) || apData.total || 0
      const agingBuckets = [
        {
          range: 'Current',
          amount: isFullSummary(summary) ? summary.current : 0,
          percentage: calculatePercentage(isFullSummary(summary) ? summary.current : 0, total),
          color: '#10b981',
        },
        {
          range: '1-30 days',
          amount: isFullSummary(summary) ? summary['31-60'] : 0,
          percentage: calculatePercentage(isFullSummary(summary) ? summary['31-60'] : 0, total),
          color: '#f59e0b',
        },
        {
          range: '31-60 days',
          amount: isFullSummary(summary) ? summary['61-90'] : 0,
          percentage: calculatePercentage(isFullSummary(summary) ? summary['61-90'] : 0, total),
          color: '#ef4444',
        },
        {
          range: '61-90 days',
          amount: isFullSummary(summary) ? summary['91-120'] : 0,
          percentage: calculatePercentage(isFullSummary(summary) ? summary['91-120'] : 0, total),
          color: '#dc2626',
        },
        {
          range: '90+ days',
          amount: isFullSummary(summary) ? summary['120+'] : 0,
          percentage: calculatePercentage(isFullSummary(summary) ? summary['120+'] : 0, total),
          color: '#991b1b',
        },
      ]

      // Calculate overdue amount
      const overdueAmount = total - (isFullSummary(summary) ? summary.current : 0)

      // Count unique vendors
      const uniqueVendors = new Set(bills.map((bill: any) => bill.vendorId)).size

      // Calculate past due percentage
      const pastDuePercentage = calculatePercentage(overdueAmount, total, 1)

      // Generate action items
      const actionItems = generateActionItems(
        summary,
        paymentSchedule,
        paymentMetrics.paymentCompliance,
        total
      )

      // Build response
      const reportData = {
        reportType: 'aged_payables',
        organizationId,
        organizationName: storedMetadata.companyName || 'Organization',
        asOfDate,
        currency,
        generated: new Date().toISOString(),
        data: {
          kpis: {
            totalOutstanding: total,
            currentAmount: isFullSummary(summary) ? summary.current : 0,
            overdueAmount,
            averageDaysOutstanding: paymentMetrics.avgDaysOutstanding,
            paymentCompliance: paymentMetrics.paymentCompliance,
            numberOfVendors: uniqueVendors || apData.payables?.length || 0,
            avgInvoiceSize: paymentMetrics.avgInvoiceSize,
            pastDuePercentage,
            dpoTarget: paymentMetrics.dpoTarget,
            vendorCredits: isFullSummary(summary) ? summary.credits : 0,
          },
          agingBuckets,
          paymentSchedule,
          quarterlyTrend: quarterlyTrend.length > 0 ? quarterlyTrend : undefined,
          vendorCategories: vendorCategories.length > 0 ? vendorCategories : undefined,
          topVendors,
          actionItems,
        },
      }

      return NextResponse.json(reportData)
    } catch (error) {
      console.error('Error generating aged payables report:', error)
      return NextResponse.json(
        {
          error: 'Failed to generate report',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  }
)
