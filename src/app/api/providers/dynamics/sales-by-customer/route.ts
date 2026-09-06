import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined

    let resolvedConnectionId = connectionId
    if (!resolvedConnectionId) {
      resolvedConnectionId = (await getActiveBCConnectionId(organizationId)) || undefined
    }
    if (!resolvedConnectionId) {
      return NextResponse.json({ error: 'No active BC connection' }, { status: 404 })
    }

    const credentials = await getBCConnectionCredentials(organizationId, resolvedConnectionId)
    if (!credentials?.connected || !credentials?.access_token) {
      return NextResponse.json({ error: 'Connection not active' }, { status: 404 })
    }

    const client = new BusinessCentralClient({ organizationId, connectionId: resolvedConnectionId })

    // 1. Fetch all customers (so 0-invoice customers still appear)
    const allCustomers = await client.listCustomers({
      $select: 'id,number,displayName,balanceDue',
    })

    // 2. Build invoice date filter
    const filterParts: string[] = []
    if (startDate && endDate) {
      filterParts.push(`postingDate ge ${startDate} and postingDate le ${endDate}`)
    } else if (startDate) {
      filterParts.push(`postingDate ge ${startDate}`)
    } else if (endDate) {
      filterParts.push(`postingDate le ${endDate}`)
    }
    const invoiceParams: Record<string, any> = {
      $select: 'number,customerNumber,customerName,postingDate,totalAmountIncludingTax,status',
    }
    if (filterParts.length > 0) invoiceParams.$filter = filterParts.join(' and ')

    // 3. Fetch invoices and credit memos in parallel
    let creditMemos: any[] = []
    let creditMemosError: string | null = null

    const cmParams: Record<string, any> = {
      $select: 'number,customerNumber,customerName,postingDate,totalAmountIncludingTax',
    }
    if (filterParts.length > 0) cmParams.$filter = filterParts.join(' and ')

    const [invoices, cmResult] = await Promise.all([
      client.listSalesInvoices(invoiceParams),
      client.queryAll('salesCreditMemos', cmParams).catch((err: any) => {
        creditMemosError = err instanceof Error ? err.message : 'Credit memos not available'
        return [] as any[]
      }),
    ])
    creditMemos = cmResult

    // 4. Seed map with all customers at 0
    const arBalance = new Map<string, number>()
    const byCustomer = new Map<
      string,
      {
        customerNumber: string
        customerName: string
        totalSales: number
        totalReturns: number
        invoiceCount: number
        creditMemoCount: number
      }
    >()

    for (const c of allCustomers) {
      if (!c.number) continue
      arBalance.set(c.number, c.balanceDue ?? 0)
      byCustomer.set(c.number, {
        customerNumber: c.number,
        customerName: c.displayName || c.number,
        totalSales: 0,
        totalReturns: 0,
        invoiceCount: 0,
        creditMemoCount: 0,
      })
    }

    // 5. Accumulate invoices
    for (const inv of invoices) {
      const custKey = inv.customerNumber || inv.customerId || 'Unknown'
      const custName = inv.customerName || custKey
      const amount = inv.totalAmountIncludingTax ?? 0
      if (!byCustomer.has(custKey)) {
        byCustomer.set(custKey, {
          customerNumber: custKey,
          customerName: custName,
          totalSales: 0,
          totalReturns: 0,
          invoiceCount: 0,
          creditMemoCount: 0,
        })
      }
      const cust = byCustomer.get(custKey)!
      cust.totalSales += amount
      cust.invoiceCount++
    }

    // 6. Accumulate credit memos
    for (const cm of creditMemos) {
      const custKey = cm.customerNumber || cm.customerId || 'Unknown'
      const custName = cm.customerName || custKey
      const amount = cm.totalAmountIncludingTax ?? 0
      if (!byCustomer.has(custKey)) {
        byCustomer.set(custKey, {
          customerNumber: custKey,
          customerName: custName,
          totalSales: 0,
          totalReturns: 0,
          invoiceCount: 0,
          creditMemoCount: 0,
        })
      }
      const cust = byCustomer.get(custKey)!
      cust.totalReturns += amount
      cust.creditMemoCount++
    }

    // 7. Build customer list sorted by net sales desc
    const customerList = [...byCustomer.values()]
      .filter((c) => c.customerNumber !== 'Unknown')
      .map((c) => ({
        customerNumber: c.customerNumber,
        customerName: c.customerName,
        invoiceCount: c.invoiceCount,
        creditMemoCount: c.creditMemoCount,
        totalSales: Math.round(c.totalSales * 100) / 100,
        totalReturns: Math.round(c.totalReturns * 100) / 100,
        netSales: Math.round((c.totalSales - c.totalReturns) * 100) / 100,
        arBalance: Math.round((arBalance.get(c.customerNumber) ?? 0) * 100) / 100,
      }))
      .sort((a, b) => b.netSales - a.netSales)

    // 8. Top 10 for chart
    const topCustomers = customerList.slice(0, 10).map((c) => ({
      name: c.customerName,
      total: c.netSales,
      invoiceCount: c.invoiceCount,
    }))

    // 9. Invoice list sorted by amount desc
    const invoiceList = invoices
      .map((inv: any) => ({
        invoiceNumber: inv.number,
        customerNumber: inv.customerNumber || inv.customerId || 'Unknown',
        customerName: inv.customerName || 'Unknown',
        postingDate: inv.postingDate,
        amount: Math.round((inv.totalAmountIncludingTax ?? 0) * 100) / 100,
        status: inv.status || 'Posted',
      }))
      .sort((a: any, b: any) => b.amount - a.amount)

    // 10. Summary
    const totalSales = customerList.reduce((s, c) => s + c.totalSales, 0)
    const totalReturns = customerList.reduce((s, c) => s + c.totalReturns, 0)

    const companyName = credentials.company_name || null

    logger.info('BC sales by customer fetched', {
      organizationId,
      connectionId: resolvedConnectionId,
      customerCount: customerList.length,
      totalInvoices: invoices.length,
      totalCreditMemos: creditMemos.length,
      startDate,
      endDate,
    })

    return NextResponse.json({
      data: {
        customers: customerList,
        topCustomers,
        invoices: invoiceList,
        summary: {
          totalCustomers: customerList.length,
          totalInvoices: invoices.length,
          totalCreditMemos: creditMemos.length,
          totalSales: Math.round(totalSales * 100) / 100,
          totalReturns: Math.round(totalReturns * 100) / 100,
          netSales: Math.round((totalSales - totalReturns) * 100) / 100,
          totalArBalance:
            Math.round(customerList.reduce((s, c) => s + (c.arBalance ?? 0), 0) * 100) / 100,
        },
        creditMemos: {
          available: !creditMemosError,
          error: creditMemosError,
          count: creditMemos.length,
        },
        companyName,
        period: { startDate: startDate || null, endDate: endDate || null },
      },
    })
  } catch (error) {
    logger.error('Failed to fetch BC sales by customer', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to fetch sales by customer',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
