import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  X,
  FileText,
  Receipt,
  ArrowLeft,
  DollarSign,
  ShoppingCart,
  Package,
  TrendingUp,
  Download,
} from 'lucide-react'
import { formatCurrency, formatDate, getProductTypeColor } from '@/lib/sales-utils'
import { useCurrency } from '@/contexts/CurrencyContext'

interface ProductTransaction {
  id: string
  type: string
  docNumber: string
  date: string
  amount: number
  customer: string
  quantity: number
  unitPrice: number
}

interface Product {
  id: string
  name: string
  type: string
  total: number
  quantity?: number
  avgUnitPrice?: number
  transactionCount?: number
  transactions?: ProductTransaction[]
}

interface ProductDetailPanelProps {
  product: Product
  selectedTransaction: ProductTransaction | null
  onClose: () => void
  onTransactionClick: (transaction: ProductTransaction) => void
  onTransactionClose: () => void
}

export function ProductDetailPanel({
  product,
  selectedTransaction,
  onClose,
  onTransactionClick,
  onTransactionClose,
}: ProductDetailPanelProps) {
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
                    <Package className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold theme-text-primary">
                      {product.name}
                    </CardTitle>
                    <p className="text-xs theme-text-secondary mt-0.5">Product ID: {product.id}</p>
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
                    {formatCurrency(product.total, currency)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingCart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">
                      Quantity
                    </p>
                  </div>
                  <p className="text-lg font-bold theme-text-primary">
                    {product.quantity?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">
                      Type
                    </p>
                  </div>
                  <Badge variant="secondary" className={getProductTypeColor(product.type)}>
                    {product.type}
                  </Badge>
                </div>
                <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">
                      Avg Unit Price
                    </p>
                  </div>
                  <p className="text-lg font-bold theme-text-primary">
                    {formatCurrency(product.avgUnitPrice || 0, currency)}
                  </p>
                </div>
              </div>

              {/* Transactions List */}
              {product.transactions && product.transactions.length > 0 && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <h3 className="text-sm font-semibold theme-text-primary mb-3 flex-shrink-0">
                    Transactions ({product.transactionCount || 0})
                  </h3>
                  <div className="space-y-2 overflow-y-auto styled-scrollbar flex-1">
                    {product.transactions.map((transaction, index) => (
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
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs theme-text-secondary font-mono">
                            #{transaction.docNumber}
                          </span>
                          <span className="text-sm font-semibold theme-text-primary">
                            {formatCurrency(transaction.amount, currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs theme-text-secondary">
                          <span>{transaction.customer}</span>
                          <span>
                            {transaction.quantity} units @{' '}
                            {formatCurrency(transaction.unitPrice, currency)}
                          </span>
                        </div>
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
                    <CardTitle className="text-lg font-bold theme-text-primary">
                      {selectedTransaction.type} #{selectedTransaction.docNumber}
                    </CardTitle>
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
                    className="flex-1"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              )}

              {/* Product Information */}
              <div className="pb-3 border-b border-gray-200/10 flex-1">
                <h3 className="text-sm font-semibold theme-text-primary mb-2">
                  Product Information
                </h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs theme-text-secondary">Product Name</span>
                      <div className="font-medium theme-text-primary text-sm">{product.name}</div>
                    </div>
                    <div>
                      <span className="text-xs theme-text-secondary">Product ID</span>
                      <div className="font-mono theme-text-primary text-xs">{product.id}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs theme-text-secondary">Product Type</span>
                      <div>
                        <Badge variant="secondary" className={getProductTypeColor(product.type)}>
                          {product.type}
                        </Badge>
                      </div>
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
                    <div>
                      <span className="text-xs theme-text-secondary">Customer</span>
                      <div className="font-medium theme-text-primary text-sm">
                        {selectedTransaction.customer}
                      </div>
                    </div>
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
                    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <span className="text-xs theme-text-secondary block mb-1">Quantity</span>
                      <div className="font-bold theme-text-primary text-xl text-blue-600 dark:text-blue-400">
                        {selectedTransaction.quantity}
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-200/10">
                    <div className="flex justify-between items-center">
                      <span className="text-sm theme-text-secondary">Unit Price</span>
                      <div className="font-bold theme-text-primary text-base">
                        {formatCurrency(selectedTransaction.unitPrice, currency)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
