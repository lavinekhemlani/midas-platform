import { NextResponse } from 'next/server'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import {
  formatDate,
  getAgingBucket,
  getLastQuarters,
  getLastMonths,
  paginatedQuery,
  applyCustomerCredits,
  calculateAgingSummary,
  buildOptimizedQuery,
  calculateDaysOutstanding,
  getDateRange,
  calculatePercentage,
  groupBy,
} from '@/lib/utils/reportHelpers'
import { throttledRequests, withRetry, createRateLimiter } from '@/lib/utils/throttle'
import { getProviderCompanyMetadata, updateProviderCompanyMetadata } from '@/lib/providers/database'

// Get default as-of date (today)
function getDefaultAsOfDate(): string {
  return formatDate(new Date())
}

// Get detailed invoice aging
async function getInvoiceAging(orgId: string, asOfDate: string, providerId: string, realmId?: string) {
  if (providerId !== 'quickbooks') {
    return {
      invoices: [],
      summary: {
        current: 0,
        '1-30': 0,
        '31-60': 0,
        '61-90': 0,
        '91+': 0,
        total: 0,
      },
      totalCreditsApplied: 0,
      unusedCredits: 0,
    }
  }

  try {
    const client = new QuickBooksClient({ organizationId: orgId, realmId })

    // Query all open invoices with pagination and optimized fields
    const invoiceFields = [
      'Id',
      'DocNumber',
      'CustomerRef',
      'TotalAmt',
      'Balance',
      'DueDate',
      'TxnDate',
      'CurrencyRef',
    ]
    const invoiceQuery = buildOptimizedQuery('Invoice', invoiceFields, ["Balance > '0'"])
    const invoices = await paginatedQuery<any>(
      client,
      invoiceQuery.replace(' MAXRESULTS 500', ''),
      500
    )

    // Also get credit memos to offset receivables
    const creditMemoFields = ['Id', 'DocNumber', 'CustomerRef', 'TotalAmt', 'Balance', 'TxnDate']
    const creditQuery = buildOptimizedQuery('CreditMemo', creditMemoFields, ["Balance > '0'"])
    const creditMemos = await paginatedQuery<any>(
      client,
      creditQuery.replace(' MAXRESULTS 500', ''),
      500
    )

    // Apply customer credits and calculate aging
    const { adjustedInvoices, totalCreditsApplied, unusedCredits } = applyCustomerCredits(
      invoices,
      creditMemos,
      asOfDate
    )
    // Process each adjusted invoice
    const processedInvoices = adjustedInvoices.map((invoice: any) => {
      const dueDate = invoice.DueDate || invoice.TxnDate
      const due = new Date(dueDate)
      const asOf = new Date(asOfDate)
      const daysPastDue = Math.max(
        0,
        Math.floor((asOf.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
      )
      const bucket = getAgingBucket(dueDate, asOfDate)

      return {
        id: invoice.Id,
        number: invoice.DocNumber,
        customer: invoice.CustomerRef?.name || 'Unknown',
        customerId: invoice.CustomerRef?.value,
        amount: parseFloat(invoice.TotalAmt || '0'),
        originalBalance: invoice.originalBalance,
        creditApplied: invoice.creditApplied,
        balance: invoice.adjustedBalance,
        dueDate,
        daysPastDue,
        bucket,
      }
    })

    // Calculate aging summary using consistent buckets
    const agingSummary = calculateAgingSummary(
      processedInvoices.map((inv) => ({
        adjustedBalance: inv.balance,
        bucket: inv.bucket,
      }))
    )

    return {
      invoices: processedInvoices,
      summary: agingSummary,
      totalCreditsApplied,
      unusedCredits,
    }
  } catch (error) {
    console.error('Error fetching invoice aging:', error)
    return {
      invoices: [],
      summary: {
        current: 0,
        '1-30': 0,
        '31-60': 0,
        '61-90': 0,
        '91+': 0,
        total: 0,
      },
      totalCreditsApplied: 0,
      unusedCredits: 0,
    }
  }
}

// Get top customers with aging breakdown
async function getTopCustomers(invoices: any[], limit: number = 20) {
  // Group invoices by customer
  const customerMap = new Map<string, any>()

  invoices.forEach((invoice) => {
    const customerId = invoice.customerId || invoice.customer
    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, {
        customer: invoice.customer,
        current: 0,
        days1_30: 0,
        days31_60: 0,
        days61_90: 0,
        over90: 0,
        total: 0,
        creditApplied: 0,
      })
    }

    const customer = customerMap.get(customerId)
    const balance = invoice.balance
    customer.creditApplied += invoice.creditApplied || 0

    // Add to appropriate bucket based on consistent aging logic
    const bucket = invoice.bucket
    if (bucket === 'current') {
      customer.current += balance
    } else if (bucket === '1-30') {
      customer.days1_30 += balance
    } else if (bucket === '31-60') {
      customer.days31_60 += balance
    } else if (bucket === '61-90') {
      customer.days61_90 += balance
    } else {
      customer.over90 += balance
    }
    customer.total += balance
  })

  // Convert to array and sort by total
  return Array.from(customerMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

// Calculate collection metrics
async function getCollectionMetrics(
  orgId: string,
  asOfDate: string,
  totalOutstanding: number,
  providerId: string,
  processedInvoices: any[]
) {
  if (providerId !== 'quickbooks') {
    return {
      collectionRate: 0,
      avgDaysOutstanding: 0,
      avgInvoiceSize: 0,
    }
  }

  try {
    const client = new QuickBooksClient({ organizationId: orgId, realmId })

    // Get date ranges
    const { start: thirtyDaysAgo, end: today } = getDateRange(asOfDate, 30)
    const { start: ninetyDaysAgo } = getDateRange(asOfDate, 90)

    // Use optimized queries with field selection
    const paymentFields = ['Id', 'TotalAmt', 'TxnDate', 'CustomerRef']
    const paymentQuery = buildOptimizedQuery('Payment', paymentFields, [
      `TxnDate >= '${thirtyDaysAgo}'`,
      `TxnDate <= '${today}'`,
    ])

    // Use withRetry for reliability
    const payments = await withRetry(async () => {
      return await paginatedQuery<any>(client, paymentQuery.replace(' MAXRESULTS 500', ''), 500)
    })

    // Calculate total collected
    const totalCollected = payments.reduce(
      (sum: number, payment: any) => sum + parseFloat(payment.TotalAmt || '0'),
      0
    )

    // Reuse existing invoice data for 30-day metrics
    const recentInvoices = processedInvoices.filter((inv) => {
      const txnDate = new Date(inv.dueDate)
      const thirtyDate = new Date(thirtyDaysAgo)
      const todayDate = new Date(today)
      return txnDate >= thirtyDate && txnDate <= todayDate
    })

    const totalInvoiced = recentInvoices.reduce((sum, inv) => sum + inv.amount, 0)
    const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0
    const avgInvoiceSize = recentInvoices.length > 0 ? totalInvoiced / recentInvoices.length : 0

    // Get 90-day revenue for DSO calculation
    const invoiceFields = ['Id', 'TotalAmt', 'TxnDate']
    const revenueQuery = buildOptimizedQuery('Invoice', invoiceFields, [
      `TxnDate >= '${ninetyDaysAgo}'`,
      `TxnDate <= '${today}'`,
    ])

    const revenueInvoices = await withRetry(async () => {
      return await paginatedQuery<any>(client, revenueQuery.replace(' MAXRESULTS 500', ''), 500)
    })

    const totalRevenue = revenueInvoices.reduce(
      (sum: number, inv: any) => sum + parseFloat(inv.TotalAmt || '0'),
      0
    )

    const dailyRevenue = totalRevenue / 90
    const avgDaysOutstanding = calculateDaysOutstanding(totalOutstanding, dailyRevenue)

    return {
      collectionRate: Math.round(collectionRate * 10) / 10,
      avgDaysOutstanding,
      avgInvoiceSize: Math.round(avgInvoiceSize),
    }
  } catch (error) {
    console.error('Error calculating collection metrics:', error)
    return {
      collectionRate: 0,
      avgDaysOutstanding: 0,
      avgInvoiceSize: 0,
    }
  }
}

// Get quarterly trend data with throttling
async function getQuarterlyTrend(
  orgId: string,
  asOfDate: string,
  provider: any,
  apiClient: any,
  providerId: string
) {
  // Skip for QuickBooks - the provider abstraction doesn't support it
  if (providerId === 'quickbooks') {
    return []
  }

  try {
    // Get last 3 quarters instead of 6 months
    const quarters = getLastQuarters(asOfDate, 3)

    // Create throttled request functions
    const requestFunctions = quarters.map((quarter) => async () => {
      try {
        const arData = await withRetry(async () => {
          return await provider.reports.agedReceivables(
            orgId,
            {
              end_date: quarter.end,
            },
            apiClient
          )
        })

        // Calculate totals from the receivables data
        let current = 0
        let overdue = 0
        let total = 0

        if (arData.receivables && Array.isArray(arData.receivables)) {
          arData.receivables.forEach((rec: any) => {
            current += rec.current || 0
            overdue +=
              (rec.days_1_30 || 0) +
              (rec.days_31_60 || 0) +
              (rec.days_61_90 || 0) +
              (rec.days_over_90 || 0)
            total += rec.total || 0
          })
        }

        return {
          period: quarter.label,
          total: arData.total || total,
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
    })

    // Execute with throttling - max 2 concurrent requests
    const quarterlyData = await throttledRequests(
      requestFunctions,
      2, // max concurrent
      500 // delay between batches
    )

    return quarterlyData
  } catch (error) {
    console.error('Error fetching quarterly trend:', error)
    return []
  }
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
        }).catch((err) => console.warn('[AR Report] Failed to store metadata:', err))
      }

      // Get detailed invoice aging (primary source for QuickBooks)
      // For QuickBooks, we fetch detailed invoice data directly instead of using the provider abstraction
      // which doesn't have a proper implementation
      const { invoices, summary, totalCreditsApplied, unusedCredits } = await getInvoiceAging(
        organizationId,
        asOfDate,
        providerId,
        realmId
      )

      // CORE DATA: Use provider's aged receivables for non-QuickBooks, fallback to invoice data
      let arData: { receivables?: any[]; total?: number } = { total: summary.total }
      if (providerId !== 'quickbooks') {
        try {
          console.log(`Fetching aged receivables for ${organizationId} as of ${asOfDate}`)
          arData = await (provider.reports.agedReceivables as any)(
            organizationId,
            {
              end_date: asOfDate,
            },
            apiClient
          )
        } catch (err) {
          console.warn('[AR Report] Provider agedReceivables failed, using invoice data:', err)
          // Continue with invoice-based data
        }
      }

      // Get collection metrics
      const collectionMetrics = await getCollectionMetrics(
        organizationId,
        asOfDate,
        summary.total || arData.total,
        providerId,
        invoices
      )

      // Get top customers
      const topCustomers = includeDetails ? await getTopCustomers(invoices) : null

      // Get quarterly trend with throttling (skipped for QuickBooks)
      const quarterlyTrend = await getQuarterlyTrend(
        organizationId,
        asOfDate,
        provider,
        apiClient,
        providerId
      )

      // Calculate aging buckets for chart with consistent naming
      const total = summary.total || arData.total || 0
      const agingBuckets = [
        {
          range: 'Current',
          amount: summary.current || 0,
          percentage: calculatePercentage(summary.current || 0, total),
          color: '#10b981',
        },
        {
          range: '1-30 days',
          amount: summary['1-30'] || 0,
          percentage: calculatePercentage(summary['1-30'] || 0, total),
          color: '#f59e0b',
        },
        {
          range: '31-60 days',
          amount: summary['31-60'] || 0,
          percentage: calculatePercentage(summary['31-60'] || 0, total),
          color: '#ef4444',
        },
        {
          range: '61-90 days',
          amount: summary['61-90'] || 0,
          percentage: calculatePercentage(summary['61-90'] || 0, total),
          color: '#dc2626',
        },
        {
          range: '91+ days',
          amount: summary['91+'] || 0,
          percentage: calculatePercentage(summary['91+'] || 0, total),
          color: '#991b1b',
        },
      ]

      // Calculate risk analysis with consistent buckets
      const lowRisk = summary.current || 0
      const mediumRisk = (summary['1-30'] || 0) + (summary['31-60'] || 0)
      const highRisk = (summary['61-90'] || 0) + (summary['91+'] || 0)
      const overdueAmount = total - (summary.current || 0)

      // Count unique customers
      const uniqueCustomers = new Set(invoices.map((inv: any) => inv.customerId)).size

      // Calculate past due percentage
      const pastDuePercentage = total > 0 ? (overdueAmount / total) * 100 : 0

      // Build response
      const reportData = {
        reportType: 'aged_receivables',
        organizationId,
        organizationName: storedMetadata.companyName || 'Organization',
        asOfDate,
        currency,
        generated: new Date().toISOString(),
        data: {
          kpis: {
            totalOutstanding: total,
            currentAmount: summary.current || 0,
            overdueAmount,
            averageDaysOutstanding: collectionMetrics.avgDaysOutstanding,
            collectionRate: collectionMetrics.collectionRate,
            numberOfCustomers: uniqueCustomers || arData.receivables?.length || 0,
            avgInvoiceSize: collectionMetrics.avgInvoiceSize,
            pastDuePercentage: Math.round(pastDuePercentage * 10) / 10,
            dsoTarget: 30, // Standard target
          },
          agingBuckets,
          riskAnalysis: {
            low_risk: lowRisk,
            medium_risk: mediumRisk,
            high_risk: highRisk,
            collection_rate: collectionMetrics.collectionRate,
          },
          quarterlyTrend: quarterlyTrend.length > 0 ? quarterlyTrend : undefined,
          creditsApplied: totalCreditsApplied || 0,
          unusedCredits: unusedCredits || 0,
          topCustomers,
        },
      }

      return NextResponse.json(reportData)
    } catch (error) {
      console.error('Error generating aged receivables report:', error)
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
