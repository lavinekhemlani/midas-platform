// Sales page types

export type CustomerSortField =
  | 'name'
  | 'totalSales'
  | 'marketShare'
  | 'transactions'
  | 'avgTransaction'
  | 'outstandingBalance'

export type ProductSortField =
  | 'name'
  | 'type'
  | 'totalSales'
  | 'marketShare'
  | 'quantity'
  | 'avgUnitPrice'
  | 'transactions'

export type OutstandingSortField =
  | 'customerName'
  | 'docNumber'
  | 'date'
  | 'dueDate'
  | 'amount'
  | 'amountPaid'
  | 'balance'

export type SortOrder = 'asc' | 'desc'

export type SalesTab = 'overview' | 'customers' | 'products' | 'outstanding'

export interface Customer {
  id: string
  name: string
  totalSales: number
  invoiceCount?: number
  salesReceiptCount?: number
  transactions?: Transaction[]
}

export interface Transaction {
  id: string
  type: string
  docNumber: string
  date: string
  amount: number
  balance?: number
  dueDate?: string
}

export interface Product {
  id: string
  name: string
  type: string
  total: number
  quantity?: number
  avgUnitPrice?: number
  transactionCount?: number
  transactions?: ProductTransaction[]
}

export interface ProductTransaction {
  id: string
  type: string
  docNumber: string
  date: string
  amount: number
  customer: string
  quantity: number
  unitPrice: number
}

export interface OutstandingPayment {
  id: string
  customerId: string
  customerName: string
  docNumber: string
  date: string
  dueDate?: string
  amount: number
  balance: number
  daysOverdue: number
}

export interface CustomerSummary {
  totalSales: number
  customerCount: number
  totalTransactions: number
}

export interface ProductSummary {
  totalSales: number
  productCount: number
  totalQuantity: number
  totalTransactions: number
}
