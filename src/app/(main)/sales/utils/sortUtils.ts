import type { Customer, Product, OutstandingPayment, SortOrder } from '../types'

// Customer sort function
export function sortCustomers(
  a: Customer,
  b: Customer,
  sortBy: string,
  sortOrder: SortOrder,
  totalSales: number
): number {
  let aValue: any
  let bValue: any

  switch (sortBy) {
    case 'name':
      aValue = a.name.toLowerCase()
      bValue = b.name.toLowerCase()
      break
    case 'totalSales':
      aValue = a.totalSales
      bValue = b.totalSales
      break
    case 'marketShare':
      aValue = totalSales > 0 ? (a.totalSales / totalSales) * 100 : 0
      bValue = totalSales > 0 ? (b.totalSales / totalSales) * 100 : 0
      break
    case 'transactions':
      aValue = (a.invoiceCount || 0) + (a.salesReceiptCount || 0)
      bValue = (b.invoiceCount || 0) + (b.salesReceiptCount || 0)
      break
    case 'avgTransaction':
      const aTotalTrans = (a.invoiceCount || 0) + (a.salesReceiptCount || 0)
      const bTotalTrans = (b.invoiceCount || 0) + (b.salesReceiptCount || 0)
      aValue = aTotalTrans > 0 ? a.totalSales / aTotalTrans : 0
      bValue = bTotalTrans > 0 ? b.totalSales / bTotalTrans : 0
      break
    case 'outstandingBalance':
      aValue = getCustomerOutstanding(a)
      bValue = getCustomerOutstanding(b)
      break
    default:
      return 0
  }

  if (sortOrder === 'asc') {
    return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
  }
  return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
}

// Product sort function
export function sortProducts(
  a: Product,
  b: Product,
  sortBy: string,
  sortOrder: SortOrder,
  totalSales: number
): number {
  let aValue: any
  let bValue: any

  switch (sortBy) {
    case 'name':
      aValue = a.name.toLowerCase()
      bValue = b.name.toLowerCase()
      break
    case 'type':
      aValue = a.type.toLowerCase()
      bValue = b.type.toLowerCase()
      break
    case 'totalSales':
      aValue = a.total
      bValue = b.total
      break
    case 'marketShare':
      aValue = totalSales > 0 ? (a.total / totalSales) * 100 : 0
      bValue = totalSales > 0 ? (b.total / totalSales) * 100 : 0
      break
    case 'quantity':
      aValue = a.quantity || 0
      bValue = b.quantity || 0
      break
    case 'avgUnitPrice':
      aValue = a.avgUnitPrice || 0
      bValue = b.avgUnitPrice || 0
      break
    case 'transactions':
      aValue = a.transactionCount || 0
      bValue = b.transactionCount || 0
      break
    default:
      return 0
  }

  if (sortOrder === 'asc') {
    return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
  }
  return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
}

// Outstanding payments sort function
export function sortOutstandingPayments(
  a: OutstandingPayment,
  b: OutstandingPayment,
  sortBy: string,
  sortOrder: SortOrder
): number {
  let aValue: any
  let bValue: any

  switch (sortBy) {
    case 'customerName':
      aValue = a.customerName.toLowerCase()
      bValue = b.customerName.toLowerCase()
      break
    case 'docNumber':
      aValue = a.docNumber || ''
      bValue = b.docNumber || ''
      break
    case 'date':
      aValue = new Date(a.date).getTime()
      bValue = new Date(b.date).getTime()
      break
    case 'dueDate':
      aValue = a.dueDate ? new Date(a.dueDate).getTime() : 0
      bValue = b.dueDate ? new Date(b.dueDate).getTime() : 0
      break
    case 'amount':
      aValue = a.amount || 0
      bValue = b.amount || 0
      break
    case 'amountPaid':
      aValue = (a.amount || 0) - (a.balance || 0)
      bValue = (b.amount || 0) - (b.balance || 0)
      break
    case 'balance':
      aValue = a.balance || 0
      bValue = b.balance || 0
      break
    default:
      return 0
  }

  if (sortOrder === 'asc') {
    return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
  }
  return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
}

// Helper to get customer outstanding balance
export function getCustomerOutstanding(customer: Customer): number {
  return (customer.transactions || [])
    .filter((t: any) => t.type === 'Invoice' && t.balance !== undefined && t.balance > 0)
    .reduce((sum: number, t: any) => sum + t.balance, 0)
}

// Helper to check if customer has overdue payments
export function hasOverduePayments(customer: Customer): boolean {
  return (customer.transactions || []).some(
    (t: any) =>
      t.type === 'Invoice' &&
      t.balance !== undefined &&
      t.balance > 0 &&
      t.dueDate &&
      new Date(t.dueDate) < new Date()
  )
}

// Calculate outstanding payments from customers
export function calculateOutstandingPayments(customers: Customer[]): OutstandingPayment[] {
  return customers.flatMap((customer) =>
    (customer.transactions || [])
      .filter(
        (transaction: any) =>
          transaction.type === 'Invoice' &&
          transaction.balance !== undefined &&
          transaction.balance > 0
      )
      .map((transaction: any) => ({
        id: transaction.id,
        customerId: customer.id,
        customerName: customer.name,
        docNumber: transaction.docNumber,
        date: transaction.date,
        dueDate: transaction.dueDate,
        amount: transaction.amount,
        balance: transaction.balance,
        daysOverdue: transaction.dueDate
          ? Math.max(
              0,
              Math.floor(
                (new Date().getTime() - new Date(transaction.dueDate).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            )
          : 0,
      }))
  )
}
