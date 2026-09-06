// Unified Expense Data Service
// Consolidates Bills, Purchases, and VendorCredits fetching
// Provides transformations for different expense views

import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { formatDate } from '@/quickbooks/utils/accounts'
import { withRetry } from '@/lib/utils/throttle'
import { QUERY_LIMITS } from '@/lib/providers/quickbooks/constants'

export interface ExpenseDataOptions {
  startDate?: string
  endDate?: string
  asOfDate?: string
  includeVendorCredits?: boolean
  realmId?: string
}

export interface ConsolidatedExpenseData {
  bills: any[]
  purchases: any[]
  vendorCredits: any[]
  metadata: {
    dateRange?: { start: string; end: string }
    asOfDate?: string
    fetchedAt: string
    cached: boolean
  }
}

/**
 * Fetch all expense data in a single optimized batch
 */
export async function fetchConsolidatedExpenseData(
  orgId: string,
  options: ExpenseDataOptions
): Promise<ConsolidatedExpenseData> {
  const client = new QuickBooksClient({ organizationId: orgId, realmId: options.realmId })

  try {
    // Build queries based on date parameters
    let billsQuery: string
    let purchasesQuery: string
    let creditsQuery: string

    if (options.asOfDate) {
      // Point-in-time queries (for AP Aging, Vendor Balance)
      billsQuery = `SELECT * FROM Bill WHERE TxnDate <= '${options.asOfDate}' MAXRESULTS 1000`
      purchasesQuery = `SELECT * FROM Purchase WHERE TxnDate <= '${options.asOfDate}' AND PaymentType IN ('Cash', 'Check', 'CreditCard') MAXRESULTS 1000`
      creditsQuery = `SELECT * FROM VendorCredit WHERE TxnDate <= '${options.asOfDate}' MAXRESULTS 1000`
    } else {
      // Date range queries (for Bills Management, Vendor Expenses)
      const start = options.startDate || formatDate(new Date(new Date().getFullYear(), 0, 1))
      const end = options.endDate || formatDate(new Date())

      billsQuery = `SELECT * FROM Bill WHERE TxnDate >= '${start}' AND TxnDate <= '${end}' MAXRESULTS 1000`
      purchasesQuery = `SELECT * FROM Purchase WHERE TxnDate >= '${start}' AND TxnDate <= '${end}' AND PaymentType IN ('Cash', 'Check', 'CreditCard') MAXRESULTS 1000`
      creditsQuery = `SELECT * FROM VendorCredit WHERE TxnDate >= '${start}' AND TxnDate <= '${end}' MAXRESULTS 1000`
    }

    console.log('Fetching consolidated expense data...')
    console.log('Bills Query:', billsQuery)
    console.log('Purchases Query:', purchasesQuery)

    // Execute all queries in parallel for maximum performance
    const promises = [
      withRetry(() => client.query(billsQuery), 3),
      withRetry(() => client.query(purchasesQuery), 3),
    ]

    if (options.includeVendorCredits) {
      console.log('Credits Query:', creditsQuery)
      promises.push(withRetry(() => client.query(creditsQuery), 3))
    }

    const results = await Promise.all(promises)

    const bills = results[0].QueryResponse?.Bill || []
    const purchases = results[1].QueryResponse?.Purchase || []
    const vendorCredits = options.includeVendorCredits
      ? results[2]?.QueryResponse?.VendorCredit || []
      : []

    console.log(
      `Fetched ${bills.length} bills, ${purchases.length} purchases, ${vendorCredits.length} credits`
    )

    const data: ConsolidatedExpenseData = {
      bills,
      purchases,
      vendorCredits,
      metadata: {
        dateRange:
          options.startDate && options.endDate
            ? { start: options.startDate, end: options.endDate }
            : undefined,
        asOfDate: options.asOfDate,
        fetchedAt: new Date().toISOString(),
        cached: false,
      },
    }

    return data
  } catch (error) {
    console.error('Error fetching consolidated expense data:', error)
    return {
      bills: [],
      purchases: [],
      vendorCredits: [],
      metadata: {
        dateRange:
          options.startDate && options.endDate
            ? { start: options.startDate, end: options.endDate }
            : undefined,
        asOfDate: options.asOfDate,
        fetchedAt: new Date().toISOString(),
        cached: false,
      },
    }
  }
}

/**
 * Transform consolidated data for Bills Management view
 */
export function transformForBillsView(data: ConsolidatedExpenseData) {
  const processedBills: any[] = []
  const vendorMap = new Map<string, number>()

  let totalAmount = 0
  let totalPaid = 0
  let totalUnpaid = 0
  let overdueCount = 0
  let overdueAmount = 0

  const today = new Date()

  data.bills.forEach((bill) => {
    const vendorName = bill.VendorRef?.name || 'Unknown Vendor'
    const totalAmt = parseFloat(bill.TotalAmt || '0')
    const balance = parseFloat(bill.Balance || '0')
    const isPaid = balance === 0
    const dueDate = bill.DueDate || bill.TxnDate
    const isOverdue = !isPaid && new Date(dueDate) < today

    totalAmount += totalAmt

    if (isPaid) {
      totalPaid += totalAmt
    } else {
      totalUnpaid += balance
    }

    if (isOverdue) {
      overdueCount++
      overdueAmount += balance
    }

    // Track by vendor
    vendorMap.set(vendorName, (vendorMap.get(vendorName) || 0) + 1)

    // Calculate days until/past due
    const dueDateObj = new Date(dueDate)
    const diffTime = dueDateObj.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    // Get line items
    const lineItems =
      bill.Line?.filter((line: any) => line.DetailType === 'AccountBasedExpenseLineDetail').map(
        (line: any) => ({
          description: line.Description || 'No description',
          account: line.AccountBasedExpenseLineDetail?.AccountRef?.name || 'Unknown',
          amount: parseFloat(line.Amount || '0'),
        })
      ) || []

    processedBills.push({
      id: bill.Id,
      docNumber: bill.DocNumber || '',
      vendor: vendorName,
      vendorId: bill.VendorRef?.value || '',
      txnDate: new Date(bill.TxnDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      dueDate: new Date(dueDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      totalAmount: totalAmt,
      balance: balance,
      paidAmount: totalAmt - balance,
      status: isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Unpaid',
      daysUntilDue: diffDays,
      lineItems,
      memo: bill.PrivateNote || '',
      originalTxnDate: bill.TxnDate,
      originalDueDate: dueDate,
    })
  })

  // Sort bills by due date (most urgent first)
  processedBills.sort(
    (a, b) => new Date(a.originalDueDate).getTime() - new Date(b.originalDueDate).getTime()
  )

  // Vendor summary
  const vendorSummary = Array.from(vendorMap.entries())
    .map(([vendor, count]) => ({ vendor, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Status distribution
  const statusCounts = {
    paid: processedBills.filter((b) => b.status === 'Paid').length,
    unpaid: processedBills.filter((b) => b.status === 'Unpaid').length,
    overdue: processedBills.filter((b) => b.status === 'Overdue').length,
  }

  const statusDistribution = [
    { status: 'Paid', count: statusCounts.paid },
    { status: 'Unpaid', count: statusCounts.unpaid },
    { status: 'Overdue', count: statusCounts.overdue },
  ]

  // Monthly trend
  const monthlyMap = new Map<string, { amount: number; count: number }>()
  processedBills.forEach((bill) => {
    const month = new Date(bill.originalTxnDate).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    })
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, { amount: 0, count: 0 })
    }
    const monthData = monthlyMap.get(month)!
    monthData.amount += bill.totalAmount
    monthData.count++
  })

  const monthlyTrend = Array.from(monthlyMap.entries())
    .map(([month, monthData]) => ({ month, amount: monthData.amount, count: monthData.count }))
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

  return {
    bills: processedBills,
    kpis: {
      totalBills: data.bills.length,
      totalAmount,
      totalPaid,
      totalUnpaid,
      overdueCount,
      overdueAmount,
      paidCount: statusCounts.paid,
      unpaidCount: statusCounts.unpaid,
      vendorCount: vendorMap.size,
    },
    vendorSummary,
    statusDistribution,
    monthlyTrend,
  }
}

/**
 * Transform consolidated data for AP Aging view
 */
export function transformForAPAgingView(data: ConsolidatedExpenseData, asOfDate: string) {
  // Filter for unpaid bills only
  const unpaidBills = data.bills.filter((bill: any) => {
    const balance = parseFloat(bill.Balance || '0')
    return balance > 0
  })

  const vendorMap = new Map<
    string,
    {
      totalBalance: number
      current: number
      days1to30: number
      days31to60: number
      days61to90: number
      days90plus: number
      billCount: number
      oldestBill: string
    }
  >()

  const agingBuckets = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days90plus: 0,
  }

  const agingBucketCounts = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days90plus: 0,
  }

  const billDetails: any[] = []
  let totalBalance = 0
  let overdueBalance = 0

  const getDaysOverdue = (dueDate: string, asOf: string): number => {
    const due = new Date(dueDate)
    const asOfDateObj = new Date(asOf)
    const diffTime = asOfDateObj.getTime() - due.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getAgingBucket = (daysOverdue: number): string => {
    if (daysOverdue < 0) return 'Current'
    if (daysOverdue <= 30) return '1-30'
    if (daysOverdue <= 60) return '31-60'
    if (daysOverdue <= 90) return '61-90'
    return '90+'
  }

  unpaidBills.forEach((bill) => {
    const vendorName = bill.VendorRef?.name || 'Unknown Vendor'
    const balance = parseFloat(bill.Balance || '0')
    const dueDate = bill.DueDate || bill.TxnDate
    const daysOverdue = getDaysOverdue(dueDate, asOfDate)
    const bucket = getAgingBucket(daysOverdue)

    totalBalance += balance
    if (daysOverdue > 0) {
      overdueBalance += balance
    }

    // Track by vendor
    if (!vendorMap.has(vendorName)) {
      vendorMap.set(vendorName, {
        totalBalance: 0,
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90plus: 0,
        billCount: 0,
        oldestBill: dueDate,
      })
    }

    const vendorData = vendorMap.get(vendorName)!
    vendorData.totalBalance += balance
    vendorData.billCount++

    // Update oldest bill date
    if (dueDate < vendorData.oldestBill) {
      vendorData.oldestBill = dueDate
    }

    // Distribute into buckets
    switch (bucket) {
      case 'Current':
        vendorData.current += balance
        agingBuckets.current += balance
        agingBucketCounts.current++
        break
      case '1-30':
        vendorData.days1to30 += balance
        agingBuckets.days1to30 += balance
        agingBucketCounts.days1to30++
        break
      case '31-60':
        vendorData.days31to60 += balance
        agingBuckets.days31to60 += balance
        agingBucketCounts.days31to60++
        break
      case '61-90':
        vendorData.days61to90 += balance
        agingBuckets.days61to90 += balance
        agingBucketCounts.days61to90++
        break
      case '90+':
        vendorData.days90plus += balance
        agingBuckets.days90plus += balance
        agingBucketCounts.days90plus++
        break
    }

    // Add to bill details
    billDetails.push({
      vendor: vendorName,
      docNumber: bill.DocNumber || '',
      txnDate: new Date(bill.TxnDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      dueDate: new Date(dueDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      balance: balance,
      daysOverdue: Math.max(0, daysOverdue),
      bucket: bucket,
      originalTxnDate: bill.TxnDate,
      originalDueDate: dueDate,
    })
  })

  // Sort bill details by days overdue (most overdue first)
  billDetails.sort((a, b) => b.daysOverdue - a.daysOverdue)

  // Convert vendor map to array
  const vendorSummary = Array.from(vendorMap.entries())
    .map(([vendor, vendorData]) => ({
      vendor,
      totalBalance: vendorData.totalBalance,
      current: vendorData.current,
      days1to30: vendorData.days1to30,
      days31to60: vendorData.days31to60,
      days61to90: vendorData.days61to90,
      days90plus: vendorData.days90plus,
      billCount: vendorData.billCount,
      oldestBillDate: new Date(vendorData.oldestBill).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      daysOverdue: getDaysOverdue(vendorData.oldestBill, asOfDate),
    }))
    .sort((a, b) => b.totalBalance - a.totalBalance)

  // Aging distribution for chart
  const agingDistribution = [
    { bucket: 'Current', amount: agingBuckets.current, count: agingBucketCounts.current },
    { bucket: '1-30 Days', amount: agingBuckets.days1to30, count: agingBucketCounts.days1to30 },
    { bucket: '31-60 Days', amount: agingBuckets.days31to60, count: agingBucketCounts.days31to60 },
    { bucket: '61-90 Days', amount: agingBuckets.days61to90, count: agingBucketCounts.days61to90 },
    { bucket: '90+ Days', amount: agingBuckets.days90plus, count: agingBucketCounts.days90plus },
  ]

  // Top overdue vendors
  const topOverdueVendors = vendorSummary
    .filter((v) => v.totalBalance > v.current)
    .slice(0, 10)
    .map((v) => ({
      vendor: v.vendor,
      amount: v.totalBalance - v.current,
    }))

  // Calculate average days outstanding
  const totalDaysOverdue = billDetails.reduce((sum, bill) => sum + bill.daysOverdue, 0)
  const avgDaysOutstanding =
    billDetails.length > 0 ? Math.round(totalDaysOverdue / billDetails.length) : 0

  return {
    bills: billDetails,
    kpis: {
      totalBalance,
      overdueBalance,
      currentBalance: agingBuckets.current,
      billCount: unpaidBills.length,
      vendorCount: vendorMap.size,
      avgDaysOutstanding,
      percentOverdue: totalBalance > 0 ? Math.round((overdueBalance / totalBalance) * 100) : 0,
    },
    vendorSummary,
    agingDistribution,
    topOverdueVendors,
    agingBuckets,
  }
}

/**
 * Transform consolidated data for Vendor Analysis view
 */
export function transformForVendorAnalysisView(data: ConsolidatedExpenseData, asOfDate?: string) {
  const vendorMap = new Map<
    string,
    {
      // Balance info
      balance: number
      billCount: number
      creditCount: number
      totalBilled: number
      totalCredits: number
      oldestBillDate: string
      newestBillDate: string
      // Spending info
      totalAmount: number
      transactionCount: number
      bills: number
      expenses: number
      paid: number
      unpaid: number
      // Aging info (if asOfDate provided)
      current?: number
      days1to30?: number
      days31to60?: number
      days61to90?: number
      days90plus?: number
    }
  >()

  const categoryMap = new Map<string, number>()
  const monthlyMap = new Map<string, { amount: number; count: number }>()
  const transactions: any[] = []

  let totalExpenses = 0
  let totalBillsAmount = 0
  let totalPurchasesAmount = 0
  let totalPaid = 0
  let totalUnpaid = 0

  const today = new Date()

  // Process Bills
  data.bills.forEach((bill) => {
    const vendorName = bill.VendorRef?.name || 'Unknown Vendor'
    const amount = parseFloat(bill.TotalAmt || '0')
    const balance = parseFloat(bill.Balance || '0')
    const isPaid = balance === 0
    const txnDate = bill.TxnDate
    const month = new Date(txnDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    totalExpenses += amount
    totalBillsAmount += amount

    if (isPaid) {
      totalPaid += amount
    } else {
      totalUnpaid += balance // Use balance (unpaid portion), not total amount
    }

    // Track by vendor
    if (!vendorMap.has(vendorName)) {
      vendorMap.set(vendorName, {
        balance: 0,
        billCount: 0,
        creditCount: 0,
        totalBilled: 0,
        totalCredits: 0,
        oldestBillDate: txnDate,
        newestBillDate: txnDate,
        totalAmount: 0,
        transactionCount: 0,
        bills: 0,
        expenses: 0,
        paid: 0,
        unpaid: 0,
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90plus: 0,
      })
    }

    const vendorData = vendorMap.get(vendorName)!
    vendorData.balance += balance
    vendorData.billCount++
    vendorData.totalBilled += amount
    vendorData.totalAmount += amount
    vendorData.transactionCount++
    vendorData.bills += amount

    if (isPaid) {
      vendorData.paid += amount
    } else {
      vendorData.unpaid += balance // Use balance (unpaid portion), not total amount
    }

    // Update oldest/newest bill dates
    if (txnDate < vendorData.oldestBillDate) {
      vendorData.oldestBillDate = txnDate
    }
    if (txnDate > vendorData.newestBillDate) {
      vendorData.newestBillDate = txnDate
    }

    // Track by month
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, { amount: 0, count: 0 })
    }
    const monthData = monthlyMap.get(month)!
    monthData.amount += amount
    monthData.count++

    // Process line items for categories
    bill.Line?.forEach((line: any) => {
      if (line.DetailType === 'AccountBasedExpenseLineDetail') {
        const categoryName = line.AccountBasedExpenseLineDetail?.AccountRef?.name || 'Uncategorized'
        categoryMap.set(
          categoryName,
          (categoryMap.get(categoryName) || 0) + parseFloat(line.Amount || '0')
        )
      }
    })

    // Add to transactions
    transactions.push({
      date: new Date(txnDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      vendor: vendorName,
      type: 'Bill',
      docNumber: bill.DocNumber || '',
      amount: amount,
      balance: balance,
      status: isPaid ? 'Paid' : 'Unpaid',
      originalDate: txnDate,
    })
  })

  // Process Purchases
  data.purchases.forEach((purchase) => {
    const vendorName = purchase.EntityRef?.name || 'Unknown Vendor'
    const amount = parseFloat(purchase.TotalAmt || '0')
    const txnDate = purchase.TxnDate
    const month = new Date(txnDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    const paymentType = purchase.PaymentType || 'Cash'

    totalExpenses += amount
    totalPurchasesAmount += amount
    totalPaid += amount // Purchases are always paid

    // Track by vendor
    if (!vendorMap.has(vendorName)) {
      vendorMap.set(vendorName, {
        balance: 0,
        billCount: 0,
        creditCount: 0,
        totalBilled: 0,
        totalCredits: 0,
        oldestBillDate: txnDate,
        newestBillDate: txnDate,
        totalAmount: 0,
        transactionCount: 0,
        bills: 0,
        expenses: 0,
        paid: 0,
        unpaid: 0,
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90plus: 0,
      })
    }

    const vendorData = vendorMap.get(vendorName)!
    vendorData.totalAmount += amount
    vendorData.transactionCount++
    vendorData.expenses += amount
    vendorData.paid += amount

    // Track by month
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, { amount: 0, count: 0 })
    }
    const monthData = monthlyMap.get(month)!
    monthData.amount += amount
    monthData.count++

    // Process line items for categories
    purchase.Line?.forEach((line: any) => {
      if (line.DetailType === 'AccountBasedExpenseLineDetail') {
        const categoryName = line.AccountBasedExpenseLineDetail?.AccountRef?.name || 'Uncategorized'
        categoryMap.set(
          categoryName,
          (categoryMap.get(categoryName) || 0) + parseFloat(line.Amount || '0')
        )
      }
    })

    // Add to transactions
    transactions.push({
      date: new Date(txnDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      vendor: vendorName,
      type: paymentType,
      docNumber: purchase.DocNumber || '',
      amount: amount,
      balance: 0,
      status: 'Paid',
      originalDate: txnDate,
    })
  })

  // Process Vendor Credits
  data.vendorCredits.forEach((credit) => {
    const vendorName = credit.VendorRef?.name || 'Unknown Vendor'
    const creditAmt = parseFloat(credit.TotalAmt || '0')
    const txnDate = credit.TxnDate

    if (!vendorMap.has(vendorName)) {
      vendorMap.set(vendorName, {
        balance: 0,
        billCount: 0,
        creditCount: 0,
        totalBilled: 0,
        totalCredits: 0,
        oldestBillDate: credit.TxnDate,
        newestBillDate: credit.TxnDate,
        totalAmount: 0,
        transactionCount: 0,
        bills: 0,
        expenses: 0,
        paid: 0,
        unpaid: 0,
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90plus: 0,
      })
    }

    const vendorData = vendorMap.get(vendorName)!
    vendorData.balance -= creditAmt // Credits reduce the balance
    vendorData.creditCount++
    vendorData.totalCredits += creditAmt

    // Add to transactions array
    transactions.push({
      date: new Date(txnDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      vendor: vendorName,
      type: 'VendorCredit',
      docNumber: credit.DocNumber || '',
      amount: -creditAmt, // Negative because it's a credit
      balance: 0,
      status: 'Credit',
      originalDate: txnDate,
    })
  })

  // Sort transactions by date (newest first)
  transactions.sort(
    (a, b) => new Date(b.originalDate).getTime() - new Date(a.originalDate).getTime()
  )

  // Convert maps to arrays
  const vendorSummary = Array.from(vendorMap.entries())
    .map(([name, vendorData]) => ({
      vendor: name,
      // Balance fields
      balance: vendorData.balance,
      billCount: vendorData.billCount,
      creditCount: vendorData.creditCount,
      totalBilled: vendorData.totalBilled,
      totalCredits: vendorData.totalCredits,
      oldestBillDate: new Date(vendorData.oldestBillDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      newestBillDate: new Date(vendorData.newestBillDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      // Spending fields
      totalAmount: vendorData.totalAmount,
      transactionCount: vendorData.transactionCount,
      billsAmount: vendorData.bills,
      expensesAmount: vendorData.expenses,
      paidAmount: vendorData.paid,
      unpaidAmount: vendorData.unpaid,
      // Aging fields
      current: vendorData.current,
      days1to30: vendorData.days1to30,
      days31to60: vendorData.days31to60,
      days61to90: vendorData.days61to90,
      days90plus: vendorData.days90plus,
      originalOldestDate: vendorData.oldestBillDate,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const monthlyTrend = Array.from(monthlyMap.entries())
    .map(([month, monthData]) => ({
      month,
      amount: monthData.amount,
      count: monthData.count,
    }))
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

  const topVendors = vendorSummary
    .filter((v) => v.totalAmount > 0) // Filter out vendors with no spending
    .sort((a, b) => b.totalAmount - a.totalAmount) // Sort by amount descending
    .slice(0, 10)
    .map((v) => ({
      vendor: v.vendor,
      amount: v.totalAmount,
    }))

  // Balance distribution
  const balanceRanges = {
    under1000: 0,
    from1000to5000: 0,
    from5000to10000: 0,
    from10000to25000: 0,
    over25000: 0,
  }

  vendorSummary.forEach((v) => {
    // Only count vendors with actual balances
    if (v.balance > 0) {
      if (v.balance < 1000) {
        balanceRanges.under1000++
      } else if (v.balance < 5000) {
        balanceRanges.from1000to5000++
      } else if (v.balance < 10000) {
        balanceRanges.from5000to10000++
      } else if (v.balance < 25000) {
        balanceRanges.from10000to25000++
      } else {
        balanceRanges.over25000++
      }
    }
  })

  const balanceDistribution = [
    { range: 'Under $1K', count: balanceRanges.under1000 },
    { range: '$1K-$5K', count: balanceRanges.from1000to5000 },
    { range: '$5K-$10K', count: balanceRanges.from5000to10000 },
    { range: '$10K-$25K', count: balanceRanges.from10000to25000 },
    { range: 'Over $25K', count: balanceRanges.over25000 },
  ]

  const totalBalance = vendorSummary.reduce((sum, v) => sum + v.balance, 0)
  const largestBalance = vendorSummary.length > 0 ? vendorSummary[0].balance : 0
  const largestVendor = vendorSummary.length > 0 ? vendorSummary[0].vendor : ''
  const avgBalance = vendorSummary.length > 0 ? totalBalance / vendorSummary.length : 0

  // Create dynamic transaction type breakdown from actual transaction data
  const transactionTypeMap = new Map<string, number>()
  transactions.forEach((txn: any) => {
    const type = txn.type || 'Unknown'
    transactionTypeMap.set(type, (transactionTypeMap.get(type) || 0) + 1)
  })

  const transactionTypeBreakdown = Array.from(transactionTypeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  return {
    transactions,
    vendorSummary,
    categoryBreakdown,
    monthlyTrend,
    topVendors,
    balanceDistribution,
    transactionTypeBreakdown,
    kpis: {
      // Spending KPIs
      totalExpenses,
      totalTransactions: transactions.length,
      totalBills: totalBillsAmount,
      averageExpense: transactions.length > 0 ? totalExpenses / transactions.length : 0,
      totalPaid,
      totalUnpaid,
      vendorCount: vendorMap.size,
      categoryCount: categoryMap.size,
      // Balance KPIs
      totalBalance,
      largestBalance,
      largestVendor,
      avgBalance,
      totalBillCount: data.bills.length,
      totalCredits: data.vendorCredits.length,
    },
  }
}
