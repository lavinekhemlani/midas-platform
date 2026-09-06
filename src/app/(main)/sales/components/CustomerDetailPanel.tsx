import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, FileText, Receipt, ArrowLeft, DollarSign, ShoppingCart, Download } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/sales-utils'
import { useCurrency } from '@/contexts/CurrencyContext'

interface Transaction {
  id: string
  type: string
  docNumber: string
  date: string
  amount: number
  balance?: number
  dueDate?: string
}

interface Customer {
  id: string
  name: string
  totalSales: number
  invoiceCount?: number
  salesReceiptCount?: number
  transactions?: Transaction[]
}

interface CustomerDetailPanelProps {
  customer: Customer
  selectedTransaction: Transaction | null
  onClose: () => void
  onTransactionClick: (transaction: Transaction) => void
  onTransactionClose: () => void
}

export function CustomerDetailPanel({
  customer,
  selectedTransaction,
  onClose,
  onTransactionClick,
  onTransactionClose,
}: CustomerDetailPanelProps) {
  const { currency } = useCurrency()
  return (
    <div className="@5xl:w-1/3 w-full animate-in slide-in-from-right duration-300">
      <Card className="glass-luxury-card border border-gray-200/10 h-[664px] flex flex-col">
        {!selectedTransaction ? (
          <>
            <CardHeader className="px-6 py-4 border-b border-gray-200/10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold theme-text-primary">
                      {customer.name}
                    </CardTitle>
                    <p className="text-xs theme-text-secondary mt-0.5">
                      Customer ID: {customer.id}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0 hover:bg-white/5"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 flex-1 overflow-hidden flex flex-col">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3 flex-shrink-0">
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">
                      Total Sales
                    </p>
                  </div>
                  <p className="text-lg font-bold theme-text-primary">
                    {formatCurrency(customer.totalSales, currency)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingCart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">
                      Transactions
                    </p>
                  </div>
                  <p className="text-lg font-bold theme-text-primary">
                    {(customer.invoiceCount || 0) + (customer.salesReceiptCount || 0)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">
                      Invoices
                    </p>
                  </div>
                  <p className="text-lg font-bold theme-text-primary">
                    {customer.invoiceCount || 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Receipt className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">
                      Receipts
                    </p>
                  </div>
                  <p className="text-lg font-bold theme-text-primary">
                    {customer.salesReceiptCount || 0}
                  </p>
                </div>
              </div>

              {/* Transactions List */}
              {customer.transactions && customer.transactions.length > 0 && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <h3 className="text-sm font-semibold theme-text-primary mb-3 flex-shrink-0">
                    Transactions
                  </h3>
                  <div className="space-y-2 overflow-y-auto styled-scrollbar flex-1">
                    {customer.transactions.map((transaction, index) => (
                      <div
                        key={`${transaction.id}-${index}`}
                        onClick={() => onTransactionClick(transaction)}
                        className="p-3 rounded-lg border border-gray-200/10 hover:bg-white/5 transition-colors duration-150 cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge
                            variant="secondary"
                            className={
                              transaction.type === 'Invoice'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            }
                          >
                            {transaction.type}
                          </Badge>
                          <span className="text-xs theme-text-secondary">
                            {formatDate(transaction.date)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs theme-text-secondary font-mono">
                            #{transaction.docNumber}
                          </span>
                          <span className="text-sm font-semibold theme-text-primary">
                            {formatCurrency(transaction.amount, currency)}
                          </span>
                        </div>
                        {transaction.balance !== undefined && transaction.balance > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200/10">
                            <div className="flex items-center justify-between text-xs">
                              <span className="theme-text-secondary">Balance Due</span>
                              <span className="font-medium text-red-600 dark:text-red-400">
                                {formatCurrency(transaction.balance, currency)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="px-6 py-4 border-b border-gray-200/10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    {selectedTransaction.type === 'Invoice' ? (
                      <FileText className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Receipt className="h-5 w-5 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-bold theme-text-primary">
                        {selectedTransaction.type} #{selectedTransaction.docNumber}
                      </CardTitle>
                      {selectedTransaction.type === 'Invoice' &&
                        selectedTransaction.dueDate &&
                        selectedTransaction.balance !== undefined &&
                        selectedTransaction.balance > 0 &&
                        new Date(selectedTransaction.dueDate) < new Date() && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30"
                          >
                            overdue
                          </Badge>
                        )}
                    </div>
                    <p className="text-xs theme-text-secondary mt-0.5">
                      Transaction ID: {selectedTransaction.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onTransactionClose}
                  className="flex items-center gap-2 theme-text-primary hover:underline transition-all"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto styled-scrollbar flex flex-col">
              {/* View PDF Button for Invoices and Sales Receipts */}
              {(selectedTransaction.type === 'Invoice' ||
                selectedTransaction.type === 'SalesReceipt') && (
                <div className="flex gap-2 mb-4">
                  <Button
                    onClick={() => {
                      const endpoint =
                        selectedTransaction.type === 'Invoice'
                          ? `/api/invoice/${selectedTransaction.id}/pdf`
                          : `/api/salesreceipt/${selectedTransaction.id}/pdf`
                      window.open(endpoint, '_blank')
                    }}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View PDF
                  </Button>
                  <button
                    onClick={() => {
                      const link = document.createElement('a')
                      const endpoint =
                        selectedTransaction.type === 'Invoice'
                          ? `/api/invoice/${selectedTransaction.id}/pdf`
                          : `/api/salesreceipt/${selectedTransaction.id}/pdf`
                      const filePrefix =
                        selectedTransaction.type === 'Invoice' ? 'invoice' : 'salesreceipt'
                      link.href = endpoint
                      link.download = `${filePrefix}-${selectedTransaction.docNumber}.pdf`
                      link.click()
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all border bg-white shadow-xs hover:bg-gray-100 h-9 px-4 py-2"
                    style={{ color: 'black' }}
                  >
                    <Download className="h-4 w-4" style={{ color: 'black' }} />
                    Download PDF
                  </button>
                </div>
              )}

              {/* Customer Information */}
              <div className="pb-3 border-b border-gray-200/10 flex-1">
                <h3 className="text-sm font-semibold theme-text-primary mb-2">
                  Customer Information
                </h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs theme-text-secondary">Customer Name</span>
                      <div className="font-bold theme-text-primary text-lg">{customer.name}</div>
                    </div>
                    <div>
                      <span className="text-xs theme-text-secondary">Customer ID</span>
                      <div className="font-mono theme-text-primary text-xs">{customer.id}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction Information */}
              <div className="pt-4 pb-3 border-b border-gray-200/10 flex-1">
                <h3 className="text-sm font-semibold theme-text-primary mb-2">
                  Transaction Information
                </h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs theme-text-secondary">Transaction Date</span>
                      <div className="font-medium theme-text-primary text-sm">
                        {new Date(selectedTransaction.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                    {selectedTransaction.dueDate && selectedTransaction.type === 'Invoice' && (
                      <div>
                        <span className="text-xs theme-text-secondary">Due Date</span>
                        <div className="font-medium theme-text-primary text-sm">
                          {new Date(selectedTransaction.dueDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Amount Details */}
              <div className="pt-4 flex-1">
                <h3 className="text-sm font-semibold theme-text-primary mb-2">Amount Details</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                      <span className="text-xs theme-text-secondary block mb-1">Total Amount</span>
                      <div className="font-bold theme-text-primary text-xl text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(selectedTransaction.amount, currency)}
                      </div>
                    </div>
                    {selectedTransaction.balance !== undefined &&
                      selectedTransaction.type === 'Invoice' && (
                        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                          <span className="text-xs theme-text-secondary block mb-1">
                            Balance Due
                          </span>
                          <div className="font-bold theme-text-primary text-xl text-blue-600 dark:text-blue-400">
                            {formatCurrency(selectedTransaction.balance, currency)}
                          </div>
                        </div>
                      )}
                  </div>

                  {selectedTransaction.balance !== undefined &&
                    selectedTransaction.type === 'Invoice' && (
                      <div className="pt-2 border-t border-gray-200/10 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm theme-text-secondary">Amount Paid</span>
                          <div className="font-bold theme-text-primary text-base">
                            {formatCurrency(
                              selectedTransaction.amount - selectedTransaction.balance,
                              currency
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm theme-text-secondary">Payment Status</span>
                          <Badge
                            variant="outline"
                            className={
                              selectedTransaction.balance === 0
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : selectedTransaction.balance < selectedTransaction.amount
                                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                  : 'bg-red-500/20 text-red-400 border-red-500/30'
                            }
                          >
                            {selectedTransaction.balance === 0
                              ? 'Paid in Full'
                              : selectedTransaction.balance < selectedTransaction.amount
                                ? 'Partially Paid'
                                : 'Unpaid'}
                          </Badge>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
