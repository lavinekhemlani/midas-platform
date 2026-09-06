import { NextRequest, NextResponse } from 'next/server'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { withRetry, formatErrorResponse } from '@/quickbooks/utils/route-helpers'

export const GET = withActiveProvider(async (request: NextRequest, { organizationId, realmId }) => {
  try {
    const url = new URL(request.url)
    const startDate = url.searchParams.get('start_date')
    const endDate = url.searchParams.get('end_date')
    const customerId = url.searchParams.get('customer_id')
    const limit = parseInt(url.searchParams.get('limit') || '100')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const client = new QuickBooksClient({ organizationId, realmId })

    // Build the query for sales receipts
    let query = 'SELECT * FROM SalesReceipt'
    const conditions = []

    if (startDate && endDate) {
      conditions.push(`TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`)
    }

    if (customerId) {
      conditions.push(`CustomerRef = '${customerId}'`)
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }

    query += ' ORDERBY TxnDate DESC'

    if (limit) {
      query += ` MAXRESULTS ${limit}`
    }

    if (offset) {
      query += ` STARTPOSITION ${offset + 1}`
    }

    const salesReceiptsResponse = await withRetry(() => client.query(query))
    const salesReceipts = salesReceiptsResponse.QueryResponse?.SalesReceipt || []

    // Get customers for reference
    const customersResponse = await withRetry(() =>
      client.query('SELECT * FROM Customer MAXRESULTS 1000')
    )
    const customers = customersResponse.QueryResponse?.Customer || []

    // Get payment methods for reference
    const paymentMethodsResponse = await withRetry(() =>
      client.query('SELECT * FROM PaymentMethod')
    )
    const paymentMethods = paymentMethodsResponse.QueryResponse?.PaymentMethod || []

    // Process sales receipts data
    const processedReceipts = salesReceipts.map((receipt: any) => {
      const customer = customers.find((c: any) => c.Id === receipt.CustomerRef?.value)
      const paymentMethod = paymentMethods.find(
        (pm: any) => pm.Id === receipt.PaymentMethodRef?.value
      )

      // Process line items
      const lineItems = (receipt.Line || [])
        .filter((line: any) => line.DetailType === 'SalesItemLineDetail')
        .map((line: any) => ({
          id: line.Id,
          description: line.Description,
          amount: parseFloat(line.Amount || '0'),
          quantity: parseFloat(line.SalesItemLineDetail?.Qty || '1'),
          unitPrice: parseFloat(line.SalesItemLineDetail?.UnitPrice || '0'),
          itemRef: line.SalesItemLineDetail?.ItemRef,
        }))

      return {
        id: receipt.Id,
        docNumber: receipt.DocNumber,
        txnDate: receipt.TxnDate,
        customer: {
          id: receipt.CustomerRef?.value,
          name: receipt.CustomerRef?.name || customer?.Name || 'Unknown Customer',
        },
        totalAmount: parseFloat(receipt.TotalAmt || '0'),
        paymentMethod: {
          id: receipt.PaymentMethodRef?.value,
          name: receipt.PaymentMethodRef?.name || paymentMethod?.Name,
        },
        depositToAccount: {
          id: receipt.DepositToAccountRef?.value,
          name: receipt.DepositToAccountRef?.name,
        },
        lineItems,
        customerMemo: receipt.CustomerMemo?.value,
        privateNote: receipt.PrivateNote,
        emailStatus: receipt.EmailStatus,
        printStatus: receipt.PrintStatus,
        balance: parseFloat(receipt.Balance || '0'),
        createdTime: receipt.MetaData?.CreateTime,
        lastModifiedTime: receipt.MetaData?.LastUpdatedTime,
        syncToken: receipt.SyncToken,
      }
    })

    // Calculate summary statistics
    const totalAmount = processedReceipts.reduce(
      (sum: any, receipt: any) => sum + receipt.totalAmount,
      0
    )
    const totalCount = processedReceipts.length
    const uniqueCustomers = new Set(processedReceipts.map((r: any) => r.customer.id)).size

    // Group by status and payment method for insights
    const statusBreakdown = processedReceipts.reduce((acc: any, receipt: any) => {
      const status = receipt.emailStatus || 'NotSent'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    const paymentMethodBreakdown = processedReceipts.reduce((acc: any, receipt: any) => {
      const method = receipt.paymentMethod.name || 'Unknown'
      if (!acc[method]) {
        acc[method] = { count: 0, total: 0 }
      }
      acc[method].count += 1
      acc[method].total += receipt.totalAmount
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalAmount,
          totalCount,
          uniqueCustomers,
          avgReceiptAmount: totalCount > 0 ? totalAmount / totalCount : 0,
          dateRange: startDate && endDate ? { startDate, endDate } : null,
        },
        receipts: processedReceipts,
        insights: {
          statusBreakdown,
          paymentMethodBreakdown,
          topCustomers: Object.entries(
            processedReceipts.reduce((acc: any, receipt: any) => {
              const customerId = receipt.customer.id
              if (!acc[customerId]) {
                acc[customerId] = {
                  id: customerId,
                  name: receipt.customer.name,
                  count: 0,
                  total: 0,
                }
              }
              acc[customerId].count += 1
              acc[customerId].total += receipt.totalAmount
              return acc
            }, {})
          )
            .map(([_, customer]: any) => customer)
            .sort((a: any, b: any) => b.total - a.total)
            .slice(0, 5),
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          totalCustomers: customers.length,
          totalPaymentMethods: paymentMethods.length,
          limit,
          offset,
        },
      },
    })
  } catch (error: any) {
    return formatErrorResponse(error, 'Failed to fetch sales receipts')
  }
})
