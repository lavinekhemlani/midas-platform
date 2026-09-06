import { NextRequest, NextResponse } from 'next/server'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { withRetry, formatErrorResponse } from '@/quickbooks/utils/route-helpers'

// Helper function to convert QuickBooks date macros to date ranges
function getDateRangeFromMacro(macro: string): { start: string; end: string } | null {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth()
  const currentDate = today.getDate()

  const formatDate = (date: Date) => date.toISOString().split('T')[0]

  switch (macro.toLowerCase()) {
    case 'today':
      return { start: formatDate(today), end: formatDate(today) }

    case 'yesterday': {
      const yesterday = new Date(today)
      yesterday.setDate(currentDate - 1)
      return { start: formatDate(yesterday), end: formatDate(yesterday) }
    }

    case 'this week': {
      const startOfWeek = new Date(today)
      startOfWeek.setDate(currentDate - today.getDay())
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      return { start: formatDate(startOfWeek), end: formatDate(endOfWeek) }
    }

    case 'this month': {
      const startOfMonth = new Date(currentYear, currentMonth, 1)
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0)
      return { start: formatDate(startOfMonth), end: formatDate(endOfMonth) }
    }

    case 'last month': {
      const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1)
      const endOfLastMonth = new Date(currentYear, currentMonth, 0)
      return { start: formatDate(startOfLastMonth), end: formatDate(endOfLastMonth) }
    }

    case 'this quarter': {
      const quarterStart = Math.floor(currentMonth / 3) * 3
      const startOfQuarter = new Date(currentYear, quarterStart, 1)
      const endOfQuarter = new Date(currentYear, quarterStart + 3, 0)
      return { start: formatDate(startOfQuarter), end: formatDate(endOfQuarter) }
    }

    case 'this year': {
      const startOfYear = new Date(currentYear, 0, 1)
      const endOfYear = new Date(currentYear, 11, 31)
      return { start: formatDate(startOfYear), end: formatDate(endOfYear) }
    }

    case 'last year': {
      const startOfLastYear = new Date(currentYear - 1, 0, 1)
      const endOfLastYear = new Date(currentYear - 1, 11, 31)
      return { start: formatDate(startOfLastYear), end: formatDate(endOfLastYear) }
    }

    default:
      return null
  }
}

export const GET = withActiveProvider(async (request: NextRequest, { organizationId, realmId }) => {
  try {
    const url = new URL(request.url)

    // All supported QuickBooks API parameters for SalesByClassSummary
    const startDate = url.searchParams.get('start_date')
    const endDate = url.searchParams.get('end_date')
    const dateMacro = url.searchParams.get('date_macro')
    const accountingMethod = url.searchParams.get('accounting_method') || 'Accrual'
    const summarizeColumnBy = url.searchParams.get('summarize_column_by') || 'Total'
    const customer = url.searchParams.get('customer') // comma-separated customer IDs
    const department = url.searchParams.get('department') // comma-separated department IDs
    const classFilter = url.searchParams.get('class') // comma-separated class IDs
    const item = url.searchParams.get('item') // comma-separated item IDs

    const client = new QuickBooksClient({ organizationId, realmId })

    // QuickBooks doesn't have a direct "SalesByClass" report endpoint in the standard API
    // We need to implement this by querying invoices and sales receipts with class information
    try {
      // Build date conditions
      let dateCondition = ''
      if (startDate && endDate) {
        dateCondition = `WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`
      } else if (dateMacro) {
        // Handle QuickBooks date macros
        const dateRange = getDateRangeFromMacro(dateMacro)
        if (dateRange) {
          dateCondition = `WHERE TxnDate >= '${dateRange.start}' AND TxnDate <= '${dateRange.end}'`
        }
      }

      // Build additional filters
      const filters = []
      if (customer) {
        const customerIds = customer
          .split(',')
          .map((id) => `'${id}'`)
          .join(',')
        filters.push(`CustomerRef IN (${customerIds})`)
      }
      if (department) {
        const deptIds = department
          .split(',')
          .map((id) => `'${id}'`)
          .join(',')
        filters.push(`DepartmentRef IN (${deptIds})`)
      }

      const additionalConditions =
        filters.length > 0
          ? dateCondition
            ? ` AND ${filters.join(' AND ')}`
            : `WHERE ${filters.join(' AND ')}`
          : ''

      // Get all invoices with class information
      const invoicesQuery =
        dateCondition || additionalConditions
          ? `SELECT * FROM Invoice ${dateCondition}${additionalConditions} ORDERBY TxnDate DESC MAXRESULTS 2000`
          : 'SELECT * FROM Invoice ORDERBY TxnDate DESC MAXRESULTS 1000'

      const invoicesResponse = await withRetry(() => client.query(invoicesQuery))
      const invoices = invoicesResponse.QueryResponse?.Invoice || []

      // Get all sales receipts with class information
      const salesReceiptsQuery =
        dateCondition || additionalConditions
          ? `SELECT * FROM SalesReceipt ${dateCondition}${additionalConditions} ORDERBY TxnDate DESC MAXRESULTS 2000`
          : 'SELECT * FROM SalesReceipt ORDERBY TxnDate DESC MAXRESULTS 1000'

      const salesReceiptsResponse = await withRetry(() => client.query(salesReceiptsQuery))
      const salesReceipts = salesReceiptsResponse.QueryResponse?.SalesReceipt || []

      // Get all classes for reference
      const classesResponse = await withRetry(() => client.query('SELECT * FROM Class'))
      const classes = classesResponse.QueryResponse?.Class || []

      // Process sales data by class
      const salesByClass: { [key: string]: any } = {}
      const unclassifiedSales = { total: 0, count: 0, transactions: [] as any[] }

      // Helper function to process line items
      const processLineItems = (transaction: any, type: 'Invoice' | 'SalesReceipt') => {
        const lines = transaction.Line || []
        lines.forEach((line: any) => {
          if (line.DetailType === 'SalesItemLineDetail') {
            const amount = parseFloat(line.Amount || '0')
            const classRef = line.SalesItemLineDetail?.ClassRef
            const itemRef = line.SalesItemLineDetail?.ItemRef

            // Apply item filter if specified
            if (item) {
              const itemIds = item.split(',')
              if (itemRef?.value && !itemIds.includes(itemRef.value)) {
                return // Skip this line item if it doesn't match the item filter
              }
            }

            // Apply class filter if specified
            if (classFilter) {
              const classIds = classFilter.split(',')
              if (classRef?.value && !classIds.includes(classRef.value)) {
                return // Skip this line item if it doesn't match the class filter
              }
            }

            if (classRef && classRef.value) {
              const className =
                classRef.name ||
                classes.find((c: any) => c.Id === classRef.value)?.Name ||
                `Class ${classRef.value}`

              if (!salesByClass[className]) {
                salesByClass[className] = {
                  name: className,
                  id: classRef.value,
                  total: 0,
                  count: 0,
                  transactions: [],
                }
              }

              salesByClass[className].total += amount
              salesByClass[className].count += 1
              salesByClass[className].transactions.push({
                id: transaction.Id,
                type,
                date: transaction.TxnDate,
                amount,
                customer: transaction.CustomerRef?.name || 'Unknown',
                item: itemRef?.name || 'Unknown Item',
              })
            } else {
              // Unclassified
              unclassifiedSales.total += amount
              unclassifiedSales.count += 1
              unclassifiedSales.transactions.push({
                id: transaction.Id,
                type,
                date: transaction.TxnDate,
                amount,
                customer: transaction.CustomerRef?.name || 'Unknown',
                item: itemRef?.name || 'Unknown Item',
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
      const result = Object.values(salesByClass)
      if (unclassifiedSales.count > 0) {
        result.push({
          name: 'Unclassified',
          id: 'unclassified',
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
            classCount: result.length,
            dateRange: startDate && endDate ? { startDate, endDate } : null,
            dateMacro,
            accountingMethod,
            summarizeColumnBy,
          },
          salesByClass: result,
          filters: {
            customer,
            department,
            class: classFilter,
            item,
            appliedFilters: [
              customer && 'Customer',
              department && 'Department',
              classFilter && 'Class',
              item && 'Item',
            ].filter(Boolean),
          },
          metadata: {
            generatedAt: new Date().toISOString(),
            invoiceCount: invoices.length,
            salesReceiptCount: salesReceipts.length,
            classCount: classes.length,
            reportBasis: accountingMethod,
            hasFilters: !!(customer || department || classFilter || item),
          },
        },
      })
    } catch (error) {
      console.error('Error fetching sales by class data:', error)
      return formatErrorResponse(error, 'Failed to fetch sales by class')
    }
  } catch (error) {
    console.error('Sales by class API error:', error)
    return formatErrorResponse(error, 'Failed to fetch sales by class')
  }
})
