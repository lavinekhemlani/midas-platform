import { NextRequest, NextResponse } from 'next/server'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { withRetry, formatErrorResponse } from '@/quickbooks/utils/route-helpers'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ customerId: string }> }
) {
  return withActiveProvider(
    async (req: NextRequest, { organizationId }: { organizationId: string }) => {
      try {
        const { customerId } = await context.params

        if (!customerId) {
          return NextResponse.json(
            { success: false, error: 'Customer ID is required' },
            { status: 400 }
          )
        }

        const client = new QuickBooksClient({ organizationId })

        try {
          // Fetch open invoices for this customer (Balance > 0)
          const invoicesQuery = `SELECT * FROM Invoice WHERE CustomerRef = '${customerId}' AND Balance > '0' ORDERBY DueDate ASC MAXRESULTS 100`

          const invoicesResponse = await withRetry(() => client.query(invoicesQuery))
          const invoices = invoicesResponse.QueryResponse?.Invoice || []

          // Get customer details
          const customerQuery = `SELECT * FROM Customer WHERE Id = '${customerId}'`
          const customerResponse = await withRetry(() => client.query(customerQuery))
          const customer = customerResponse.QueryResponse?.Customer?.[0]

          // Transform invoices to a cleaner format
          const openInvoices = invoices.map((invoice: any) => ({
            id: invoice.Id,
            docNumber: invoice.DocNumber,
            date: invoice.TxnDate,
            dueDate: invoice.DueDate,
            amount: parseFloat(invoice.TotalAmt || '0'),
            balance: parseFloat(invoice.Balance || '0'),
            isOverdue: invoice.DueDate ? new Date(invoice.DueDate) < new Date() : false,
            memo: invoice.PrivateNote || invoice.CustomerMemo?.value || null,
          }))

          // Calculate totals
          const totalBalance = openInvoices.reduce((sum: number, inv: any) => sum + inv.balance, 0)
          const overdueBalance = openInvoices
            .filter((inv: any) => inv.isOverdue)
            .reduce((sum: number, inv: any) => sum + inv.balance, 0)

          return NextResponse.json({
            success: true,
            customer: customer
              ? {
                  id: customer.Id,
                  name: customer.DisplayName || customer.CompanyName || 'Unknown',
                  email: customer.PrimaryEmailAddr?.Address,
                  phone: customer.PrimaryPhone?.FreeFormNumber,
                }
              : null,
            invoices: openInvoices,
            summary: {
              totalInvoices: openInvoices.length,
              totalBalance,
              overdueBalance,
              overdueCount: openInvoices.filter((inv: any) => inv.isOverdue).length,
            },
            metadata: {
              generatedAt: new Date().toISOString(),
            },
          })
        } catch (error: any) {
          return formatErrorResponse(error, 'Failed to fetch open invoices from QuickBooks')
        }
      } catch (error: any) {
        console.error('Open invoices API error:', error)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to fetch open invoices',
            message: error.message,
          },
          { status: 500 }
        )
      }
    }
  )(request)
}
