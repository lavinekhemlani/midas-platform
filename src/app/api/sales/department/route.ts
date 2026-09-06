import { NextRequest, NextResponse } from 'next/server'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { withRetry, formatErrorResponse } from '@/quickbooks/utils/route-helpers'

export const GET = withActiveProvider(async (request: NextRequest, { organizationId, realmId }) => {
  try {
    const url = new URL(request.url)
    const startDate = url.searchParams.get('start_date')
    const endDate = url.searchParams.get('end_date')
    const summarizeColumnBy = url.searchParams.get('summarize_column_by') || 'Month'

    const client = new QuickBooksClient({ organizationId, realmId })

    // Get all invoices with department information
    const invoicesQuery =
      startDate && endDate
        ? `SELECT * FROM Invoice WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`
        : 'SELECT * FROM Invoice ORDERBY TxnDate DESC MAXRESULTS 1000'

    const invoicesResponse = await withRetry(() => client.query(invoicesQuery))
    const invoices = invoicesResponse.QueryResponse?.Invoice || []

    // Get all sales receipts with department information
    const salesReceiptsQuery =
      startDate && endDate
        ? `SELECT * FROM SalesReceipt WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`
        : 'SELECT * FROM SalesReceipt ORDERBY TxnDate DESC MAXRESULTS 1000'

    const salesReceiptsResponse = await withRetry(() => client.query(salesReceiptsQuery))
    const salesReceipts = salesReceiptsResponse.QueryResponse?.SalesReceipt || []

    // Get all departments for reference
    const departmentsResponse = await withRetry(() => client.query('SELECT * FROM Department'))
    const departments = departmentsResponse.QueryResponse?.Department || []

    // Process sales data by department
    const salesByDepartment: { [key: string]: any } = {}
    const unclassifiedSales = { total: 0, count: 0, transactions: [] as any[] }

    // Helper function to process line items
    const processLineItems = (transaction: any, type: 'Invoice' | 'SalesReceipt') => {
      const lines = transaction.Line || []
      lines.forEach((line: any) => {
        if (line.DetailType === 'SalesItemLineDetail') {
          const amount = parseFloat(line.Amount || '0')
          const departmentRef = line.SalesItemLineDetail?.DepartmentRef

          if (departmentRef && departmentRef.value) {
            const departmentName =
              departmentRef.name ||
              departments.find((d: any) => d.Id === departmentRef.value)?.Name ||
              `Department ${departmentRef.value}`

            if (!salesByDepartment[departmentName]) {
              salesByDepartment[departmentName] = {
                name: departmentName,
                id: departmentRef.value,
                total: 0,
                count: 0,
                transactions: [],
              }
            }

            salesByDepartment[departmentName].total += amount
            salesByDepartment[departmentName].count += 1
            salesByDepartment[departmentName].transactions.push({
              id: transaction.Id,
              type,
              date: transaction.TxnDate,
              amount,
              customer: transaction.CustomerRef?.name || 'Unknown',
            })
          } else {
            // Unclassified by department
            unclassifiedSales.total += amount
            unclassifiedSales.count += 1
            unclassifiedSales.transactions.push({
              id: transaction.Id,
              type,
              date: transaction.TxnDate,
              amount,
              customer: transaction.CustomerRef?.name || 'Unknown',
            })
          }
        }
      })
    }

    // Process invoices
    invoices.forEach((invoice: any) => {
      processLineItems(invoice, 'Invoice')
    })

    // Process sales receipts
    salesReceipts.forEach((receipt: any) => {
      processLineItems(receipt, 'SalesReceipt')
    })

    // Convert to array and add unclassified if there are any
    const result = Object.values(salesByDepartment)
    if (unclassifiedSales.count > 0) {
      result.push({
        name: 'Unassigned',
        id: 'unassigned',
        ...unclassifiedSales,
      })
    }

    // Sort by total amount descending
    result.sort((a: any, b: any) => b.total - a.total)

    // Calculate totals
    const totalSales = result.reduce((sum: number, item: any) => sum + item.total, 0)
    const totalTransactions = result.reduce((sum: number, item: any) => sum + item.count, 0)

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalSales,
          totalTransactions,
          departmentCount: result.length,
          dateRange: startDate && endDate ? { startDate, endDate } : null,
          summarizeColumnBy,
        },
        salesByDepartment: result,
        metadata: {
          generatedAt: new Date().toISOString(),
          invoiceCount: invoices.length,
          salesReceiptCount: salesReceipts.length,
          departmentCount: departments.length,
        },
      },
    })
  } catch (error) {
    return formatErrorResponse(error, 'Failed to fetch sales by department')
  }
})
