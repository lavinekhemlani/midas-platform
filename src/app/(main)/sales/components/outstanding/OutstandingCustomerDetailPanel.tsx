'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  X,
  FileText,
  ArrowLeft,
  DollarSign,
  Clock,
  Download,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
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

  // Fetch open invoices when customer changes
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
    <div className="@5xl:w-1/3 w-full animate-in slide-in-from-right duration-300">
      <Card className="glass-luxury-card border border-gray-200/10 h-[600px] flex flex-col">
        {!selectedInvoice ? (
          <>
            <CardHeader className="px-6 py-4 border-b border-gray-200/10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold theme-text-primary">
                      {customer.name}
                    </CardTitle>
                    <p className="text-xs theme-text-secondary mt-0.5">
                      {customer.id ? `Customer ID: ${customer.id}` : 'Outstanding Balance Details'}
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
              {/* Summary Stats - 2x2 Grid */}
              <div className="grid grid-cols-2 gap-3 flex-shrink-0">
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">
                      Outstanding
                    </p>
                  </div>
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(customer.total, currency)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">
                      Overdue
                    </p>
                  </div>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    {formatCurrency(customer.overdue, currency)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">
                      Current
                    </p>
                  </div>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(customer.current, currency)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide">
                      Invoices
                    </p>
                  </div>
                  <p className="text-lg font-bold theme-text-primary">
                    {summary?.totalInvoices ?? invoices.length}
                  </p>
                </div>
              </div>

              {/* Aging Breakdown - Compact horizontal */}
              {Object.keys(customer.byPeriod).length > 0 && (
                <div className="flex-shrink-0">
                  <h3 className="text-sm font-semibold theme-text-primary mb-3">Aging Breakdown</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(customer.byPeriod).map(([period, amount]) => (
                      <div
                        key={period}
                        className="flex items-center gap-1.5 py-0.5 px-2 rounded bg-muted/30 text-[10px]"
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

              {/* Open Invoices List */}
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <h3 className="text-sm font-semibold theme-text-primary mb-3 flex-shrink-0">
                  Open Invoices ({summary?.totalInvoices ?? invoices.length})
                </h3>

                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-500"></div>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center py-4 gap-2">
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
                  <div className="flex flex-col items-center justify-center py-4">
                    <FileText className="h-6 w-6 text-gray-400 mb-1" />
                    <p className="text-xs theme-text-secondary">No open invoices found</p>
                    {!customer.id && (
                      <p className="text-[10px] theme-text-secondary mt-1">
                        Customer ID not available
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 overflow-y-auto styled-scrollbar flex-1 pr-1">
                    {invoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        onClick={() => onInvoiceClick(invoice)}
                        className="p-3 rounded-lg border border-gray-200/10 hover:bg-white/5 transition-colors duration-150 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            <span className="text-[11px] font-medium theme-text-primary">
                              #{invoice.docNumber}
                            </span>
                            {invoice.isOverdue && (
                              <span className="text-[9px] font-medium text-red-600 dark:text-red-400">
                                overdue
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-red-600 dark:text-red-400">
                            {formatCurrency(invoice.balance, currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[10px]">
                          <span className="theme-text-secondary">{formatDate(invoice.date)}</span>
                          {invoice.dueDate && (
                            <span
                              className={`${
                                invoice.isOverdue
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'theme-text-secondary'
                              }`}
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
            </CardContent>
          </>
        ) : (
          <>
            {/* Invoice Detail View */}
            <CardHeader className="px-6 py-4 border-b border-gray-200/10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-bold theme-text-primary">
                        Invoice #{selectedInvoice.docNumber}
                      </CardTitle>
                      {selectedInvoice.isOverdue && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30"
                        >
                          overdue
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs theme-text-secondary mt-0.5">
                      Invoice ID: {selectedInvoice.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onInvoiceClose}
                  className="flex items-center gap-2 theme-text-primary hover:underline transition-all"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto styled-scrollbar flex flex-col">
              {/* View/Download PDF Buttons */}
              <div className="flex gap-2 mb-4 mt-4">
                <Button
                  onClick={() => {
                    window.open(`/api/invoice/${selectedInvoice.id}/pdf`, '_blank')
                  }}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View PDF
                </Button>
                <button
                  onClick={() => {
                    const link = document.createElement('a')
                    link.href = `/api/invoice/${selectedInvoice.id}/pdf`
                    link.download = `invoice-${selectedInvoice.docNumber}.pdf`
                    link.click()
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all border bg-white shadow-xs hover:bg-gray-100 h-9 px-4 py-2"
                  style={{ color: 'black' }}
                >
                  <Download className="h-4 w-4" style={{ color: 'black' }} />
                  Download PDF
                </button>
              </div>

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
                    {customer.id && (
                      <div>
                        <span className="text-xs theme-text-secondary">Customer ID</span>
                        <div className="font-mono theme-text-primary text-xs">{customer.id}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Invoice Information */}
              <div className="pt-4 pb-3 border-b border-gray-200/10 flex-1">
                <h3 className="text-sm font-semibold theme-text-primary mb-2">
                  Invoice Information
                </h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs theme-text-secondary">Invoice Date</span>
                      <div className="font-medium theme-text-primary text-sm">
                        {new Date(selectedInvoice.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                    {selectedInvoice.dueDate && (
                      <div>
                        <span className="text-xs theme-text-secondary">Due Date</span>
                        <div
                          className={`font-medium text-sm ${
                            selectedInvoice.isOverdue
                              ? 'text-red-600 dark:text-red-400'
                              : 'theme-text-primary'
                          }`}
                        >
                          {new Date(selectedInvoice.dueDate).toLocaleDateString('en-US', {
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
                    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <span className="text-xs theme-text-secondary block mb-1">Total Amount</span>
                      <div className="font-bold theme-text-primary text-xl text-blue-600 dark:text-blue-400">
                        {formatCurrency(selectedInvoice.amount, currency)}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                      <span className="text-xs theme-text-secondary block mb-1">Balance Due</span>
                      <div className="font-bold theme-text-primary text-xl text-red-600 dark:text-red-400">
                        {formatCurrency(selectedInvoice.balance, currency)}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200/10 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm theme-text-secondary">Amount Paid</span>
                      <div className="font-bold theme-text-primary text-base">
                        {formatCurrency(selectedInvoice.amount - selectedInvoice.balance, currency)}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm theme-text-secondary">Payment Status</span>
                      <Badge
                        variant="outline"
                        className={
                          selectedInvoice.balance === 0
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : selectedInvoice.balance < selectedInvoice.amount
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }
                      >
                        {selectedInvoice.balance === 0
                          ? 'Paid in Full'
                          : selectedInvoice.balance < selectedInvoice.amount
                            ? 'Partially Paid'
                            : 'Unpaid'}
                      </Badge>
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
