import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, FileText, Receipt, ArrowLeft, Download } from 'lucide-react'
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

  const totalTransactions = (customer.invoiceCount || 0) + (customer.salesReceiptCount || 0)

  return (
    <div
      className="@5xl:w-1/3 @5xl:min-w-[320px] w-full flex-shrink-0 animate-in slide-in-from-right duration-300 pl-6 relative z-10"
      style={{ borderLeft: '1px solid var(--theme-card-border)' }}
    >
      <div className="h-[500px] flex flex-col">
        {!selectedTransaction ? (
          <>
            {/* Header */}
            <div
              className="flex-shrink-0 flex items-center justify-between py-3"
              style={{ borderBottom: '1px solid var(--theme-card-border)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 rounded-full bg-blue-500" />
                <div>
                  <h2 className="text-base font-semibold theme-text-primary">{customer.name}</h2>
                  <p className="text-[10px] theme-text-secondary font-mono">ID: {customer.id}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
              >
                <X className="h-4 w-4 theme-text-secondary" />
              </button>
            </div>

            {/* Summary Stats */}
            <div
              className="flex-shrink-0 py-4 grid grid-cols-2 gap-3"
              style={{ borderBottom: '1px solid var(--theme-card-border)' }}
            >
              <div>
                <p className="text-[10px] uppercase tracking-wider theme-text-secondary mb-1">
                  Total Sales
                </p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                  {formatCurrency(customer.totalSales, currency)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider theme-text-secondary mb-1">
                  Transactions
                </p>
                <p className="text-lg font-bold theme-text-primary tabular-nums">
                  {totalTransactions}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider theme-text-secondary mb-1">
                  Invoices
                </p>
                <p className="text-base font-semibold theme-text-primary tabular-nums">
                  {customer.invoiceCount || 0}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider theme-text-secondary mb-1">
                  Receipts
                </p>
                <p className="text-base font-semibold theme-text-primary tabular-nums">
                  {customer.salesReceiptCount || 0}
                </p>
              </div>
            </div>

            {/* Transactions List */}
            {customer.transactions && customer.transactions.length > 0 && (
              <div className="flex-1 overflow-hidden flex flex-col min-h-0 pt-3">
                <h3 className="text-[11px] font-medium uppercase tracking-wider theme-text-secondary mb-2 flex-shrink-0">
                  Recent Transactions
                </h3>
                <div className="flex-1 overflow-y-auto styled-scrollbar space-y-1">
                  {customer.transactions.map((transaction, index) => (
                    <div
                      key={`${transaction.id}-${index}`}
                      onClick={() => onTransactionClick(transaction)}
                      className="py-2.5 px-3 -mx-3 rounded-md hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 ${
                              transaction.type === 'Invoice'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                            }`}
                          >
                            {transaction.type}
                          </Badge>
                          <span className="text-xs theme-text-secondary font-mono">
                            #{transaction.docNumber}
                          </span>
                        </div>
                        <span className="text-sm font-semibold theme-text-primary tabular-nums">
                          {formatCurrency(transaction.amount, currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] theme-text-secondary">
                          {formatDate(transaction.date)}
                        </span>
                        {transaction.balance !== undefined && transaction.balance > 0 && (
                          <span className="text-[10px] font-medium text-red-500">
                            Due: {formatCurrency(transaction.balance, currency)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Transaction Detail Header */}
            <div
              className="flex-shrink-0 flex items-center justify-between py-3"
              style={{ borderBottom: '1px solid var(--theme-card-border)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-1 h-8 rounded-full ${
                    selectedTransaction.type === 'Invoice' ? 'bg-blue-500' : 'bg-green-500'
                  }`}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold theme-text-primary">
                      {selectedTransaction.type} #{selectedTransaction.docNumber}
                    </h2>
                    {selectedTransaction.type === 'Invoice' &&
                      selectedTransaction.dueDate &&
                      selectedTransaction.balance !== undefined &&
                      selectedTransaction.balance > 0 &&
                      new Date(selectedTransaction.dueDate) < new Date() && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 bg-red-500/15 text-red-500 border-red-500/20"
                        >
                          overdue
                        </Badge>
                      )}
                  </div>
                  <p className="text-[10px] theme-text-secondary font-mono">
                    ID: {selectedTransaction.id}
                  </p>
                </div>
              </div>
              <button
                onClick={onTransactionClose}
                className="flex items-center gap-1.5 text-xs theme-text-secondary hover:theme-text-primary transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            </div>

            {/* PDF Actions */}
            {(selectedTransaction.type === 'Invoice' ||
              selectedTransaction.type === 'SalesReceipt') && (
              <div
                className="flex-shrink-0 flex gap-2 py-4"
                style={{ borderBottom: '1px solid var(--theme-card-border)' }}
              >
                <Button
                  onClick={() => {
                    const endpoint =
                      selectedTransaction.type === 'Invoice'
                        ? `/api/invoice/${selectedTransaction.id}/pdf`
                        : `/api/salesreceipt/${selectedTransaction.id}/pdf`
                    window.open(endpoint, '_blank')
                  }}
                  size="sm"
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white h-8 text-xs"
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  View PDF
                </Button>
                <Button
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
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download
                </Button>
              </div>
            )}

            {/* Transaction Content */}
            <div className="flex-1 overflow-y-auto styled-scrollbar py-4 space-y-4">
              {/* Customer Info */}
              <div>
                <h3 className="text-[11px] font-medium uppercase tracking-wider theme-text-secondary mb-2">
                  Customer
                </h3>
                <p className="text-sm font-medium theme-text-primary">{customer.name}</p>
                <p className="text-[10px] theme-text-secondary font-mono">ID: {customer.id}</p>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-[11px] font-medium uppercase tracking-wider theme-text-secondary mb-1">
                    Date
                  </h3>
                  <p className="text-sm theme-text-primary">
                    {new Date(selectedTransaction.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                {selectedTransaction.dueDate && selectedTransaction.type === 'Invoice' && (
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-wider theme-text-secondary mb-1">
                      Due Date
                    </h3>
                    <p className="text-sm theme-text-primary">
                      {new Date(selectedTransaction.dueDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>

              {/* Amounts */}
              <div className="pt-4" style={{ borderTop: '1px solid var(--theme-card-border)' }}>
                <h3 className="text-[11px] font-medium uppercase tracking-wider theme-text-secondary mb-3">
                  Amount Details
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--theme-card-border)', opacity: 0.5 }}
                  >
                    <p className="text-[10px] theme-text-secondary mb-1">Total</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">
                      {formatCurrency(selectedTransaction.amount, currency)}
                    </p>
                  </div>
                  {selectedTransaction.balance !== undefined &&
                    selectedTransaction.type === 'Invoice' && (
                      <div
                        className="p-3 rounded-lg"
                        style={{ backgroundColor: 'var(--theme-card-border)', opacity: 0.5 }}
                      >
                        <p className="text-[10px] theme-text-secondary mb-1">Balance</p>
                        <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">
                          {formatCurrency(selectedTransaction.balance, currency)}
                        </p>
                      </div>
                    )}
                </div>

                {selectedTransaction.balance !== undefined &&
                  selectedTransaction.type === 'Invoice' && (
                    <div
                      className="mt-3 pt-3"
                      style={{ borderTop: '1px solid var(--theme-card-border)' }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs theme-text-secondary">Paid</span>
                        <span className="text-sm font-semibold theme-text-primary tabular-nums">
                          {formatCurrency(
                            selectedTransaction.amount - selectedTransaction.balance,
                            currency
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs theme-text-secondary">Status</span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 ${
                            selectedTransaction.balance === 0
                              ? 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20'
                              : selectedTransaction.balance < selectedTransaction.amount
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20'
                          }`}
                        >
                          {selectedTransaction.balance === 0
                            ? 'Paid'
                            : selectedTransaction.balance < selectedTransaction.amount
                              ? 'Partial'
                              : 'Unpaid'}
                        </Badge>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
