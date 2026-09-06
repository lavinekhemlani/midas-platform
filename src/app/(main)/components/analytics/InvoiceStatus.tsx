// src/app/(main)/components/InvoiceStatus.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Receipt,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { useCurrency } from '@/contexts/CurrencyContext'

export interface InvoiceData {
  id: string
  invoiceNumber: string
  customerName: string
  amount: number
  dueDate: string
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'partially_paid' | 'void'
  daysPastDue?: number
  paidAmount?: number
}

interface InvoiceStatusProps {
  invoices: InvoiceData[]
  currency?: string
  className?: string
}

export default function InvoiceStatus({
  invoices,
  currency: propCurrency,
  className
}: InvoiceStatusProps) {
  const { currency: contextCurrency } = useCurrency()
  const currency = propCurrency || contextCurrency
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  // Calculate status counts and amounts
  const statusSummary = invoices.reduce((acc, invoice) => {
    if (!acc[invoice.status]) {
      acc[invoice.status] = { count: 0, amount: 0 }
    }
    acc[invoice.status].count++
    acc[invoice.status].amount += invoice.amount
    return acc
  }, {} as Record<string, { count: number; amount: number }>)

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0)
  const paidAmount = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0)
  const overdueAmount = invoices
    .filter(inv => inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.amount, 0)

  const collectionRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return CheckCircle
      case 'overdue': return AlertTriangle
      case 'sent': case 'viewed': return Clock
      case 'void': return XCircle
      default: return Receipt
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      case 'overdue': return 'text-red-400 bg-red-500/10 border-red-500/30'
      case 'sent': case 'viewed': return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      case 'partially_paid': return 'text-orange-400 bg-orange-500/10 border-orange-500/30'
      case 'void': return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
      default: return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
    }
  }

  const filteredInvoices = selectedStatus === 'all'
    ? invoices
    : invoices.filter(inv => inv.status === selectedStatus)

  const statusOrder = ['overdue', 'sent', 'viewed', 'partially_paid', 'paid', 'draft', 'void']
  const sortedStatuses = Object.keys(statusSummary).sort((a, b) => 
    statusOrder.indexOf(a) - statusOrder.indexOf(b)
  )

  return (
    <Card className={cn("chart-container", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="chart-title">
            <Receipt className="w-5 h-5 text-purple-500" />
            Invoice Status Overview
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="border-purple-500/30 text-purple-400">
              {invoices.length} Total
            </Badge>
            <Badge 
              variant="outline" 
              className={cn(
                "border-emerald-500/30",
                collectionRate >= 80 ? 'text-emerald-400' :
                collectionRate >= 60 ? 'text-amber-400' :
                'text-red-400'
              )}
            >
              {collectionRate.toFixed(0)}% Collected
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">PAID</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {formatCurrency(paidAmount, { currency, compact: true })}
            </div>
            <p className="text-xs theme-text-secondary mt-1">
              {statusSummary.paid?.count || 0} invoices
            </p>
          </div>

          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-medium text-amber-400">PENDING</span>
            </div>
            <div className="text-2xl font-bold text-amber-400">
              {formatCurrency(
                totalAmount - paidAmount - overdueAmount, 
                { currency, compact: true }
              )}
            </div>
            <p className="text-xs theme-text-secondary mt-1">
              {((statusSummary.sent?.count || 0) + 
                (statusSummary.viewed?.count || 0) + 
                (statusSummary.partially_paid?.count || 0))} invoices
            </p>
          </div>

          <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-xs font-medium text-red-400">OVERDUE</span>
            </div>
            <div className="text-2xl font-bold text-red-400">
              {formatCurrency(overdueAmount, { currency, compact: true })}
            </div>
            <p className="text-xs theme-text-secondary mt-1">
              {statusSummary.overdue?.count || 0} invoices
            </p>
          </div>
        </div>

        {/* Collection Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium theme-text-primary">Collection Progress</span>
            <span className="text-sm theme-text-secondary">
              {formatCurrency(paidAmount, { currency })} of {formatCurrency(totalAmount, { currency })}
            </span>
          </div>
          <Progress value={collectionRate} className="h-2" />
        </div>

        {/* Status Breakdown */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold theme-text-primary mb-3">Status Breakdown</h4>
          {sortedStatuses.map(status => {
            const StatusIcon = getStatusIcon(status)
            const data = statusSummary[status]
            const percentage = totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0

            return (
              <button
                key={status}
                onClick={() => setSelectedStatus(selectedStatus === status ? 'all' : status)}
                className={cn(
                  "w-full p-3 rounded-lg transition-all",
                  selectedStatus === status 
                    ? "bg-amber-500/10 border border-amber-500/30" 
                    : "bg-slate-500/5 hover:bg-slate-500/10"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <StatusIcon className={cn("w-4 h-4", getStatusColor(status).split(' ')[0])} />
                    <div className="text-left">
                      <p className="text-sm font-medium theme-text-primary capitalize">
                        {status.replace('_', ' ')}
                      </p>
                      <p className="text-xs theme-text-secondary">
                        {data.count} invoice{data.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold theme-text-primary">
                      {formatCurrency(data.amount, { currency, compact: true })}
                    </p>
                    <p className="text-xs theme-text-secondary">
                      {percentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Selected Invoices List */}
        {selectedStatus !== 'all' && filteredInvoices.length > 0 && (
          <div className="mt-6 pt-6 border-t border-amber-500/10">
            <h4 className="text-sm font-semibold theme-text-primary mb-3">
              {selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1).replace('_', ' ')} Invoices
            </h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto styled-scrollbar pr-2">
              {filteredInvoices.slice(0, 10).map(invoice => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-500/5"
                >
                  <div>
                    <p className="text-sm font-medium theme-text-primary">
                      {invoice.customerName}
                    </p>
                    <p className="text-xs theme-text-secondary">
                      #{invoice.invoiceNumber} • Due {new Date(invoice.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold theme-text-primary">
                      {formatCurrency(invoice.amount, { currency })}
                    </p>
                    {invoice.daysPastDue && invoice.daysPastDue > 0 && (
                      <p className="text-xs text-red-400">
                        {invoice.daysPastDue}d overdue
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {filteredInvoices.length > 10 && (
                <p className="text-xs theme-text-secondary text-center py-2">
                  +{filteredInvoices.length - 10} more invoices
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}