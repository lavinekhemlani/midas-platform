import { NextRequest, NextResponse } from 'next/server'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { withRetry, formatErrorResponse } from '@/quickbooks/utils/route-helpers'

export const GET = withActiveProvider(async (request: NextRequest, { organizationId, realmId }) => {
  try {
    const url = new URL(request.url)

    // Extract query parameters
    const startDate = url.searchParams.get('start_date')
    const endDate = url.searchParams.get('end_date')
    const summarizeColumnBy = url.searchParams.get('summarize_column_by') || 'Customer'
    const minorversion = url.searchParams.get('minorversion') || '65'

    const client = new QuickBooksClient({ organizationId, realmId })

    try {
      // Try to use the official SalesByCustomer report endpoint first
      const reportParams = new URLSearchParams()
      if (startDate) reportParams.append('start_date', startDate)
      if (endDate) reportParams.append('end_date', endDate)
      if (summarizeColumnBy) reportParams.append('summarize_column_by', summarizeColumnBy)
      reportParams.append('minorversion', minorversion)

      const reportUrl = `reports/SalesByCustomer?${reportParams.toString()}`

      let reportResponse
      try {
        // Attempt official report endpoint
        reportResponse = await withRetry(() => client.makeRequest(reportUrl, 'GET'))
      } catch (_reportError) {
        console.log('Official report endpoint failed, falling back to manual aggregation')

        // Fallback: Manual aggregation using invoices and sales receipts
        let dateCondition = ''
        if (startDate && endDate) {
          dateCondition = `WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`
        }

        // Get invoices
        const invoicesQuery = dateCondition
          ? `SELECT * FROM Invoice ${dateCondition} ORDERBY TxnDate DESC MAXRESULTS 1000`
          : 'SELECT * FROM Invoice ORDERBY TxnDate DESC MAXRESULTS 1000'

        const invoicesResponse = await withRetry(() => client.query(invoicesQuery))
        const invoices = invoicesResponse.QueryResponse?.Invoice || []

        // Get sales receipts
        const salesReceiptsQuery = dateCondition
          ? `SELECT * FROM SalesReceipt ${dateCondition} ORDERBY TxnDate DESC MAXRESULTS 1000`
          : 'SELECT * FROM SalesReceipt ORDERBY TxnDate DESC MAXRESULTS 1000'

        const salesReceiptsResponse = await withRetry(() => client.query(salesReceiptsQuery))
        const salesReceipts = salesReceiptsResponse.QueryResponse?.SalesReceipt || []

        // Get customers for reference
        const customersResponse = await withRetry(() => client.query('SELECT * FROM Customer'))
        const customers = customersResponse.QueryResponse?.Customer || []

        // Aggregate sales by customer
        const customerSales: { [key: string]: any } = {}

        // Process invoices
        invoices.forEach((invoice: any) => {
          const customerId = invoice.CustomerRef?.value
          const customerName =
            invoice.CustomerRef?.name ||
            customers.find((c: any) => c.Id === customerId)?.Name ||
            'Unknown'
          const amount = parseFloat(invoice.TotalAmt || '0')

          if (customerId) {
            if (!customerSales[customerId]) {
              customerSales[customerId] = {
                id: customerId,
                name: customerName,
                totalSales: 0,
                invoiceCount: 0,
                salesReceiptCount: 0,
                transactions: [],
              }
            }

            customerSales[customerId].totalSales += amount
            customerSales[customerId].invoiceCount += 1
            customerSales[customerId].transactions.push({
              id: invoice.Id,
              type: 'Invoice',
              date: invoice.TxnDate,
              amount: amount,
              docNumber: invoice.DocNumber,
              dueDate: invoice.DueDate,
              balance: parseFloat(invoice.Balance || '0'),
            })
          }
        })

        // Process sales receipts
        salesReceipts.forEach((receipt: any) => {
          const customerId = receipt.CustomerRef?.value
          const customerName =
            receipt.CustomerRef?.name ||
            customers.find((c: any) => c.Id === customerId)?.Name ||
            'Unknown'
          const amount = parseFloat(receipt.TotalAmt || '0')

          if (customerId) {
            if (!customerSales[customerId]) {
              customerSales[customerId] = {
                id: customerId,
                name: customerName,
                totalSales: 0,
                invoiceCount: 0,
                salesReceiptCount: 0,
                transactions: [],
              }
            }

            customerSales[customerId].totalSales += amount
            customerSales[customerId].salesReceiptCount += 1
            customerSales[customerId].transactions.push({
              id: receipt.Id,
              type: 'SalesReceipt',
              date: receipt.TxnDate,
              amount: amount,
              docNumber: receipt.DocNumber,
            })
          }
        })

        // Convert to array and sort by total sales
        const salesByCustomer = Object.values(customerSales).sort(
          (a: any, b: any) => b.totalSales - a.totalSales
        )

        // Calculate summary
        const totalSales = salesByCustomer.reduce(
          (sum: any, customer: any) => sum + customer.totalSales,
          0
        )
        const totalTransactions = salesByCustomer.reduce(
          (sum: any, customer: any) => sum + customer.invoiceCount + customer.salesReceiptCount,
          0
        )

        return NextResponse.json({
          success: true,
          data: {
            Header: {
              Time: new Date().toISOString(),
              ReportName: 'SalesByCustomer',
              ReportBasis: 'Accrual',
              StartPeriod: startDate,
              EndPeriod: endDate,
              SummarizeColumnsBy: summarizeColumnBy,
              Currency: 'USD',
            },
            Rows: salesByCustomer.map((customer: any) => ({
              group: customer.name,
              ColData: [
                { value: customer.name },
                { value: customer.totalSales.toFixed(2) },
                { value: (customer.invoiceCount + customer.salesReceiptCount).toString() },
              ],
            })),
            Columns: [
              { ColTitle: 'Customer', ColType: 'Customer' },
              { ColTitle: 'Total', ColType: 'Money' },
              { ColTitle: 'Transactions', ColType: 'Number' },
            ],
          },
          summary: {
            totalSales,
            totalTransactions,
            customerCount: salesByCustomer.length,
          },
          salesByCustomer,
          metadata: {
            generatedAt: new Date().toISOString(),
            source: 'Manual aggregation',
            invoiceCount: invoices.length,
            salesReceiptCount: salesReceipts.length,
          },
        })
      }

      // If official report endpoint worked, return its response
      return NextResponse.json({
        success: true,
        data: reportResponse,
        metadata: {
          generatedAt: new Date().toISOString(),
          source: 'Official QuickBooks report endpoint',
        },
      })
    } catch (error: any) {
      return formatErrorResponse(error, 'Failed to fetch sales by customer data from QuickBooks')
    }
  } catch (error: any) {
    return formatErrorResponse(error, 'Failed to fetch sales by customer data')
  }
})
