// src/lib/pdf/dynamodbParser.ts
/**
 * Parse DynamoDB JSON format to regular JSON
 * Handles S (string), N (number), M (map), L (list), BOOL (boolean), NULL (null)
 */
export function parseDynamoDBValue(value: any): any {
  if (value === null || value === undefined) return null

  // String
  if ('S' in value) return value.S

  // Number
  if ('N' in value) return parseFloat(value.N)

  // Boolean
  if ('BOOL' in value) return value.BOOL

  // Null
  if ('NULL' in value) return null

  // Map (object)
  if ('M' in value) {
    const result: any = {}
    for (const key in value.M) {
      result[key] = parseDynamoDBValue(value.M[key])
    }
    return result
  }

  // List (array)
  if ('L' in value) {
    return value.L.map((item: any) => parseDynamoDBValue(item))
  }

  // If no type descriptor, return as-is (already plain JSON)
  return value
}

/**
 * Parse a complete DynamoDB report to regular JSON
 */
export function parseDynamoDBReport(dynamoReport: any): any {
  // If it's already plain JSON, return as-is
  if (!dynamoReport.PK && !dynamoReport.components?.L) {
    return dynamoReport
  }

  const result: any = {}

  for (const key in dynamoReport) {
    // Skip DynamoDB-specific keys
    if (key === 'PK' || key === 'SK') continue

    result[key] = parseDynamoDBValue(dynamoReport[key])
  }

  return result
}

/**
 * Extract table data from various component types
 */
export function extractTableFromComponent(component: any): {
  data: any[]
  columns: any[]
  title: string
  currency?: string
} | null {
  const type = component.type
  const props = component.props || {}
  const currency = props.currency

  // Handle advanced_table and dynamic_table
  if (type === 'advanced_table' || type === 'dynamic_table') {
    return {
      data: props.data || [],
      columns: props.columns || [],
      title: props.title || 'Data Table',
      currency,
    }
  }

  // Handle cash_flow_breakdown as a special table
  if (type === 'cash_flow_breakdown') {
    const sections = props.sections || []
    const rows: any[] = []

    // Convert cash flow sections to table rows
    sections.forEach((section: any) => {
      // Add section header row
      rows.push({
        item: section.title,
        amount: section.total,
        isSection: true,
        color: section.color,
      })

      // Add item rows
      if (section.items) {
        section.items.forEach((item: any) => {
          rows.push({
            item: item.isSubItem ? `  • ${item.item}` : item.item,
            amount: item.amount,
            isSubItem: item.isSubItem,
          })
        })
      }
    })

    return {
      data: rows,
      columns: [
        { key: 'item', label: 'Item', format: 'text' },
        { key: 'amount', label: 'Amount', format: 'currency' },
      ],
      title: 'Cash Flow Details',
      currency,
    }
  }

  // Handle pnl_line_items as a special table
  if (type === 'pnl_line_items') {
    const sections = props.sections || []
    const rows: any[] = []

    // Convert P&L sections to table rows
    sections.forEach((section: any) => {
      // Add section header row
      rows.push({
        item: section.title,
        amount: section.total,
        percentage: '',
        isSection: true,
        color: section.color,
      })

      // Add item rows
      if (section.items) {
        section.items.forEach((item: any) => {
          rows.push({
            item: item.item,
            amount: item.amount,
            percentage: item.percentage || '',
            isSubItem: false,
          })
        })
      }
    })

    // Add summary row if available
    if (props.summary) {
      rows.push({
        item: 'Net Income',
        amount: props.summary.netIncome,
        percentage: '',
        isSection: true,
        color: 'blue',
      })
    }

    return {
      data: rows,
      columns: [
        { key: 'item', label: 'Item', format: 'text' },
        { key: 'amount', label: 'Amount', format: 'currency' },
        { key: 'percentage', label: '% of Total', format: 'text' },
      ],
      title: 'Profit & Loss Line Items',
      currency,
    }
  }

  // Handle customer_analysis
  if (type === 'customer_analysis') {
    return {
      data: props.customers || [],
      columns: [
        { key: 'name', label: 'Customer', format: 'text' },
        { key: 'totalRevenue', label: 'Total Revenue', format: 'currency' },
        { key: 'outstandingAmount', label: 'Outstanding', format: 'currency' },
        { key: 'status', label: 'Status', format: 'badge' },
      ],
      title: 'Top Customers by Revenue',
      currency,
    }
  }

  // Handle invoice_status
  if (type === 'invoice_status') {
    return {
      data: props.invoices || [],
      columns: [
        { key: 'number', label: 'Invoice #', format: 'text' },
        { key: 'customer', label: 'Customer', format: 'text' },
        { key: 'amount', label: 'Amount', format: 'currency' },
        { key: 'dueDate', label: 'Due Date', format: 'date' },
        { key: 'status', label: 'Status', format: 'badge' },
      ],
      title: 'Invoice Status',
      currency,
    }
  }

  // Handle recent_transactions
  if (type === 'recent_transactions') {
    return {
      data: props.transactions || [],
      columns: [
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'description', label: 'Description', format: 'text' },
        { key: 'amount', label: 'Amount', format: 'currency' },
        { key: 'type', label: 'Type', format: 'badge' },
      ],
      title: 'Recent Transactions',
      currency,
    }
  }

  return null
}
