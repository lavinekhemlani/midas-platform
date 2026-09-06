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

    // Get all invoices with item information
    const invoicesQuery =
      startDate && endDate
        ? `SELECT * FROM Invoice WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`
        : 'SELECT * FROM Invoice ORDERBY TxnDate DESC MAXRESULTS 1000'

    const invoicesResponse = await withRetry(() => client.query(invoicesQuery))
    const invoices = invoicesResponse.QueryResponse?.Invoice || []

    // Get all sales receipts with item information
    const salesReceiptsQuery =
      startDate && endDate
        ? `SELECT * FROM SalesReceipt WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`
        : 'SELECT * FROM SalesReceipt ORDERBY TxnDate DESC MAXRESULTS 1000'

    const salesReceiptsResponse = await withRetry(() => client.query(salesReceiptsQuery))
    const salesReceipts = salesReceiptsResponse.QueryResponse?.SalesReceipt || []

    // Get all items for reference
    const itemsResponse = await withRetry(() => client.query('SELECT * FROM Item'))
    const items = itemsResponse.QueryResponse?.Item || []

    // Process sales data by product/item
    const salesByProduct: { [key: string]: any } = {}

    // Helper function to process line items
    const processLineItems = (transaction: any, type: 'Invoice' | 'SalesReceipt') => {
      const lines = transaction.Line || []
      lines.forEach((line: any) => {
        if (line.DetailType === 'SalesItemLineDetail') {
          const amount = parseFloat(line.Amount || '0')
          const qty = parseFloat(line.SalesItemLineDetail?.Qty || '1')
          const unitPrice = parseFloat(line.SalesItemLineDetail?.UnitPrice || '0')
          const itemRef = line.SalesItemLineDetail?.ItemRef

          if (itemRef && itemRef.value) {
            const itemId = itemRef.value
            const itemName =
              itemRef.name || items.find((i: any) => i.Id === itemId)?.Name || `Item ${itemId}`
            const item = items.find((i: any) => i.Id === itemId)

            if (!salesByProduct[itemId]) {
              salesByProduct[itemId] = {
                id: itemId,
                name: itemName,
                type: item?.Type || 'Unknown',
                total: 0,
                quantity: 0,
                transactionCount: 0,
                avgUnitPrice: 0,
                transactions: [],
              }
            }

            salesByProduct[itemId].total += amount
            salesByProduct[itemId].quantity += qty
            salesByProduct[itemId].transactionCount += 1
            salesByProduct[itemId].transactions.push({
              id: transaction.Id,
              type,
              docNumber: transaction.DocNumber || transaction.Id,
              date: transaction.TxnDate,
              amount,
              quantity: qty,
              unitPrice,
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

    // Calculate averages and convert to array
    const result = Object.values(salesByProduct).map((product: any) => ({
      ...product,
      avgUnitPrice: product.quantity > 0 ? product.total / product.quantity : 0,
    }))

    // Sort by total amount descending
    result.sort((a: any, b: any) => b.total - a.total)

    // Calculate totals
    const totalSales = result.reduce((sum: number, item: any) => sum + item.total, 0)
    const totalQuantity = result.reduce((sum: number, item: any) => sum + item.quantity, 0)
    const totalTransactions = result.reduce(
      (sum: number, item: any) => sum + item.transactionCount,
      0
    )

    // Flatten all transactions from all products into a single list
    const allTransactions: any[] = []
    result.forEach((product: any) => {
      product.transactions.forEach((transaction: any) => {
        allTransactions.push({
          ...transaction,
          productId: product.id,
          productName: product.name,
          productType: product.type,
        })
      })
    })

    // Sort by date descending
    allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalSales,
          totalQuantity,
          totalTransactions,
          productCount: result.length,
          avgSalesPerProduct: result.length > 0 ? totalSales / result.length : 0,
          dateRange: startDate && endDate ? { startDate, endDate } : null,
          summarizeColumnBy,
        },
        salesByProduct: result,
        allTransactions,
        metadata: {
          generatedAt: new Date().toISOString(),
          invoiceCount: invoices.length,
          salesReceiptCount: salesReceipts.length,
          totalItems: items.length,
        },
      },
    })
  } catch (error) {
    return formatErrorResponse(error, 'Failed to fetch sales by product data')
  }
})
