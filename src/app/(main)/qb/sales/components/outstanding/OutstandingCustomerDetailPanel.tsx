'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, FileText, ArrowLeft, Download, AlertCircle, RefreshCw } from 'lucide-react'
import { formatCurrency } from '@/lib/sales-utils'
import { useCurrency } from '@/contexts/CurrencyContext'

interface Invoice {
  id: string
  docNumber: string
  date: string
  dueDate: string
  amount: number
  balance: number
  isOverdue: boolean
  memo: string | null
}

interface CustomerSummary {
  totalInvoices: number
  totalBalance: number
  overdueBalance: number
  overdueCount: number
}

interface OutstandingCustomer {
  id?: string
  name: string
  total: number
  current: number
  overdue: number
  byPeriod: Record<string, number>
}

interface OutstandingCustomerDetailPanelProps {
  customer: OutstandingCustomer
  selectedInvoice: Invoice | null
  onClose: () => void
  onInvoiceClick: (invoice: Invoice) => void
  onInvoiceClose: () => void
}

export function OutstandingCustomerDetailPanel({
  customer,
  selectedInvoice,
  onClose,
  onInvoiceClick,
  onInvoiceClose,
}: OutstandingCustomerDetailPanelProps) {
  const { currency } = useCurrency()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [summary, setSummary] = useState<CustomerSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (customer.id) {
      fetchOpenInvoices()
    }
  }, [customer.id])

  const fetchOpenInvoices = async () => {
    if (!customer.id) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/customer/${customer.id}/open-invoices`)
      const data = await response.json()

      if (data.success) {
        setInvoices(data.invoices || [])
        setSummary(data.summary || null)
      } else {
        setError(data.error || 'Failed to fetch invoices')
      }
    } catch (err) {
      setError('Failed to fetch invoices')
      console.error('Error fetching open invoices:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div
      className="@5xl:w-1/3 @5xl:min-w-[320px] w-full flex-shrink-0 animate-in slide-in-from-right duration-300 pl-6 relative z-10"
      style={{ borderLeft: '1px solid var(--theme-card-border)' }}
    >
      <div className="h-[500px] flex flex-col">
        {!selectedInvoice ? (
          <>
            {/* Header */}
            <div
              className="flex-shrink-0 flex items-center justify-between py-3"
              style={{ borderBottom: '1px solid var(--theme-card-border)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-1 h-8 rounded-full ${
                    customer.overdue > 0 ? 'bg-red-500' : 'bg-green-500'
                  }`}
                />
                <div>
                  <h2 className="text-base font-semibold theme-text-primary">{customer.name}</h2>
                  <p className="text-[10px] theme-text-secondary font-mono">
                    {customer.id ? `ID: ${customer.id}` : 'Outstanding Balance'}
                  </p>
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
                  Outstanding
                </p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">
                  {formatCurrency(customer.total, currency)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider theme-text-secondary mb-1">
                  Overdue
                </p>
                <p className="text-lg font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                  {formatCurrency(customer.overdue, currency)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider theme-text-secondary mb-1">
                  Current
                </p>
                <p className="text-base font-semibold text-green-600 dark:text-green-400 tabular-nums">
                  {formatCurrency(customer.current, currency)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider theme-text-secondary mb-1">
                  Invoices
                </p>
                <p className="text-base font-semibold theme-text-primary tabular-nums">
                  {summary?.totalInvoices ?? invoices.length}
                </p>
              </div>
            </div>

            {/* Aging Breakdown */}
            {Object.keys(customer.byPeriod).length > 0 && (
              <div
                className="flex-shrink-0 py-3"
                style={{ borderBottom: '1px solid var(--theme-card-border)' }}
              >
                <h3 className="text-[11px] font-medium uppercase tracking-wider theme-text-secondary mb-2">
                  Aging
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(customer.byPeriod).map(([period, amount]) => (
                    <div
                      key={period}
                      className="flex items-center gap-1.5 py-0.5 px-2 rounded text-[10px]"
                      style={{ backgroundColor: 'var(--theme-card-border)', opacity: 0.7 }}
                    >
                      <span className="theme-text-secondary">{period}:</span>
                      <span
                        className={`font-medium ${
                          period.toLowerCase().includes('current')
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-orange-600 dark:text-orange-400'
                        }`}
                      >
                        {formatCurrency(amount, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invoices List */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0 pt-3">
              <h3 className="text-[11px] font-medium uppercase tracking-wider theme-text-secondary mb-2 flex-shrink-0">
                Open Invoices ({summary?.totalInvoices ?? invoices.length})
              </h3>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-500"></div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <p className="text-xs text-red-500">{error}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchOpenInvoices}
                    className="h-6 px-2 text-[10px] gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </Button>
                </div>
              ) : invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <FileText className="h-6 w-6 theme-text-secondary opacity-40 mb-1" />
                  <p className="text-xs theme-text-secondary">No open invoices</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto styled-scrollbar space-y-1">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      onClick={() => onInvoiceClick(invoice)}
                      className="py-2.5 px-3 -mx-3 rounded-md hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium theme-text-primary">
                            #{invoice.docNumber}
                          </span>
                          {invoice.isOverdue && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 bg-red-500/15 text-red-500 border-red-500/20"
                            >
                              overdue
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums">
                          {formatCurrency(invoice.balance, currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[10px]">
                        <span className="theme-text-secondary">{formatDate(invoice.date)}</span>
                        {invoice.dueDate && (
                          <span
                            className={
                              invoice.isOverdue
                                ? 'text-red-600 dark:text-red-400'
                                : 'theme-text-secondary'
                            }
                          >
                            Due: {formatDate(invoice.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Invoice Detail Header */}
            <div
              className="flex-shrink-0 flex items-center justify-between py-3"
              style={{ borderBottom: '1px solid var(--theme-card-border)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-1 h-8 rounded-full ${
                    selectedInvoice.isOverdue ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold theme-text-primary">
                      Invoice #{selectedInvoice.docNumber}
                    </h2>
                    {selectedInvoice.isOverdue && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 bg-red-500/15 text-red-500 border-red-500/20"
                      >
                        overdue
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] theme-text-secondary font-mono">
                    ID: {selectedInvoice.id}
                  </p>
                </div>
              </div>
              <button
                onClick={onInvoiceClose}
                className="flex items-center gap-1.5 text-xs theme-text-secondary hover:theme-text-primary transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            </div>

            {/* PDF Actions */}
            <div
              className="flex-shrink-0 flex gap-2 py-4"
              style={{ borderBottom: '1px solid var(--theme-card-border)' }}
            >
              <Button
                onClick={() => {
                  window.open(`/api/invoice/${selectedInvoice.id}/pdf`, '_blank')
                }}
                size="sm"
                className="flex-1 bg-red-500 hover:bg-red-600 text-white h-8 text-xs"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                View PDF
              </Button>
              <Button
                onClick={() => {
                  const link = document.createElement('a')
                  link.href = `/api/invoice/${selectedInvoice.id}/pdf`
                  link.download = `invoice-${selectedInvoice.docNumber}.pdf`
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

            {/* Invoice Content */}
            <div className="flex-1 overflow-y-auto styled-scrollbar py-4 space-y-4">
              {/* Customer Info */}
              <div>
                <h3 className="text-[11px] font-medium uppercase tracking-wider theme-text-secondary mb-2">
                  Customer
                </h3>
                <p className="text-sm font-medium theme-text-primary">{customer.name}</p>
                {customer.id && (
                  <p className="text-[10px] theme-text-secondary font-mono">ID: {customer.id}</p>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-[11px] font-medium uppercase tracking-wider theme-text-secondary mb-1">
                    Invoice Date
                  </h3>
                  <p className="text-sm theme-text-primary">{formatDate(selectedInvoice.date)}</p>
                </div>
                {selectedInvoice.dueDate && (
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-wider theme-text-secondary mb-1">
                      Due Date
                    </h3>
                    <p
                      className={`text-sm ${
                        selectedInvoice.isOverdue
                          ? 'text-red-600 dark:text-red-400'
                          : 'theme-text-primary'
                      }`}
                    >
                      {formatDate(selectedInvoice.dueDate)}
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
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                      {formatCurrency(selectedInvoice.amount, currency)}
                    </p>
                  </div>
                  <div
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--theme-card-border)', opacity: 0.5 }}
                  >
                    <p className="text-[10px] theme-text-secondary mb-1">Balance</p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">
                      {formatCurrency(selectedInvoice.balance, currency)}
                    </p>
                  </div>
                </div>

                <div
                  className="mt-3 pt-3"
                  style={{ borderTop: '1px solid var(--theme-card-border)' }}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs theme-text-secondary">Paid</span>
                    <span className="text-sm font-semibold theme-text-primary tabular-nums">
                      {formatCurrency(selectedInvoice.amount - selectedInvoice.balance, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs theme-text-secondary">Status</span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 ${
                        selectedInvoice.balance === 0
                          ? 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20'
                          : selectedInvoice.balance < selectedInvoice.amount
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20'
                      }`}
                    >
                      {selectedInvoice.balance === 0
                        ? 'Paid'
                        : selectedInvoice.balance < selectedInvoice.amount
                          ? 'Partial'
                          : 'Unpaid'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
