'use client'

import React, { useMemo, useCallback, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/sales-utils'
import { KPICard } from '../KPICard'
import { SortableTableHeader } from '../shared/SortableTableHeader'
import { OutstandingCustomerDetailPanel } from './OutstandingCustomerDetailPanel'
import { useOutstandingPayments } from '@/hooks/useOutstandingPayments'
import type { OutstandingPayment, Customer, SortOrder } from '../../types'

// Sort field type for AR aging table
type ARAgingSortField = 'name' | 'current' | 'overdue' | 'total'

// Type for outstanding customer from AR aging
interface OutstandingCustomer {
  id?: string
  name: string
  total: number
  current: number
  overdue: number
  byPeriod: Record<string, number>
}

// Type for invoice in detail panel
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

interface OutstandingSectionProps {
  outstandingPayments: OutstandingPayment[] // kept for backward compatibility
  customers: Customer[]
  currency: string
  onCustomerClick?: (customer: Customer, transaction: OutstandingPayment) => void
}

export function OutstandingSection({
  outstandingPayments,
  customers,
  currency,
  onCustomerClick,
}: OutstandingSectionProps) {
  // Fetch AR aging data from QuickBooks for accurate totals
  const { outstandingData, isLoading: arLoading, error: arError } = useOutstandingPayments()

  // Local sort state for AR aging table
  const [sortBy, setSortBy] = useState<ARAgingSortField>('total')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Selection state for customer detail panel
  const [selectedCustomer, setSelectedCustomer] = useState<OutstandingCustomer | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  const handleCustomerClick = useCallback((customer: OutstandingCustomer) => {
    setSelectedCustomer((prev) => {
      if (prev?.name === customer.name) {
        setSelectedInvoice(null)
        return null
      }
      setSelectedInvoice(null)
      return customer
    })
  }, [])

  const handleClosePanel = useCallback(() => {
    setSelectedCustomer(null)
    setSelectedInvoice(null)
  }, [])

  const handleInvoiceClick = useCallback((invoice: Invoice) => {
    setSelectedInvoice(invoice)
  }, [])

  const handleInvoiceClose = useCallback(() => {
    setSelectedInvoice(null)
  }, [])

  const handleSort = useCallback((field: ARAgingSortField) => {
    setSortBy((prev) => {
      if (prev === field) {
        setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortOrder('desc')
      return field
    })
  }, [])

  // Sort customers based on selected field
  const sortedCustomers = useMemo(() => {
    if (!outstandingData?.topCustomers) return []

    return [...outstandingData.topCustomers].sort((a, b) => {
      let aVal: number, bVal: number
      switch (sortBy) {
        case 'name':
          return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
        case 'current':
          aVal = a.current
          bVal = b.current
          break
        case 'overdue':
          aVal = a.overdue
          bVal = b.overdue
          break
        case 'total':
        default:
          aVal = a.total
          bVal = b.total
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [outstandingData?.topCustomers, sortBy, sortOrder])

  // Loading state
  if (arLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-2 @3xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-luxury-card rounded-xl border border-border/50 p-4">
              <div className="h-4 w-24 bg-gray-700/30 animate-pulse mb-2" />
              <div className="h-8 w-32 bg-gray-700/30 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="glass-luxury-card rounded-xl border border-border/50 p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto mb-4" />
            <p className="text-sm theme-text-secondary">Loading AR aging data...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (arError) {
    return (
      <div className="space-y-4">
        <div className="glass-luxury-card rounded-xl border border-red-500/30 p-6 text-center">
          <p className="text-red-500 mb-2">Failed to load AR aging data</p>
          <p className="text-sm theme-text-secondary">
            {arError.message || 'Please try again later'}
          </p>
        </div>
      </div>
    )
  }

  // No data state
  if (!outstandingData || outstandingData.totalOutstanding === 0) {
    return (
      <div className="space-y-4">
        <div className="glass-luxury-card rounded-xl border border-border/50 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold theme-text-primary mb-2">All Caught Up!</h3>
          <p className="text-sm theme-text-secondary">
            No outstanding payments. All invoices have been paid.
          </p>
        </div>
      </div>
    )
  }

  const {
    totalOutstanding,
    numberOfCustomers,
    overdueAmount,
    overdueCustomers,
    periods = [],
  } = outstandingData

  // Get period names for aging buckets (excluding "Current")
  const agingPeriods = periods.filter((p) => !p.toLowerCase().includes('current'))

  return (
    <div className="flex flex-col gap-3">
      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 @2xl:grid-cols-4">
        <KPICard
          title="Total Outstanding"
          value={formatCurrency(totalOutstanding, currency)}
          tooltip="Total balance due from all unpaid invoices"
          subtitle={`${numberOfCustomers} customer${numberOfCustomers !== 1 ? 's' : ''}`}
          valueColorClass="text-theme-red"
          dotColorClass="bg-red-500"
        />
        <KPICard
          title="Current"
          value={formatCurrency(totalOutstanding - overdueAmount, currency)}
          tooltip="Amount not yet due"
          subtitle="Not yet due"
          valueColorClass="text-theme-green"
          dotColorClass="bg-green-500"
        />
        <KPICard
          title="Overdue"
          value={formatCurrency(overdueAmount, currency)}
          tooltip="Total amount past due date"
          subtitle={`${overdueCustomers} customer${overdueCustomers !== 1 ? 's' : ''} overdue`}
          valueColorClass="text-theme-yellow"
          dotColorClass="bg-orange-500"
        />
        <KPICard
          title="Overdue %"
          value={`${totalOutstanding > 0 ? ((overdueAmount / totalOutstanding) * 100).toFixed(1) : 0}%`}
          tooltip="Percentage of outstanding that is overdue"
          subtitle="Past due percentage"
          valueColorClass="text-theme-yellow"
          dotColorClass="bg-amber-500"
        />
      </div>

      {/* AR Aging Table by Customer with Side Panel */}
      <div className="flex gap-4">
        <div
          className={`transition-all duration-300 ${selectedCustomer ? '@5xl:w-2/3 @5xl:block hidden' : 'w-full'}`}
        >
          <div className="group glass-luxury-card rounded-xl border border-gray-200/10 overflow-hidden flex flex-col relative">
            {/* Subtle top accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent z-20" />
            <div className="overflow-x-auto">
              <div className="overflow-y-auto styled-scrollbar max-h-[600px]">
                <table className="w-full min-w-max">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-muted/90 dark:bg-muted/50 backdrop-blur-md border-b border-gray-200/10">
                      <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-50 whitespace-nowrap">
                        #
                      </th>
                      <SortableTableHeader
                        label="Customer"
                        sortKey="name"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        label="Current"
                        sortKey="current"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                        align="right"
                      />
                      {/* Dynamic aging period columns */}
                      {agingPeriods.map((period) => (
                        <th
                          key={period}
                          className="text-right px-6 py-4 text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-50 whitespace-nowrap"
                        >
                          {period}
                        </th>
                      ))}
                      <SortableTableHeader
                        label="Overdue"
                        sortKey="overdue"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                        align="right"
                      />
                      <SortableTableHeader
                        label="Total"
                        sortKey="total"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                        align="right"
                      />
                      <th className="text-center px-6 py-4 text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-50 whitespace-nowrap">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/5">
                    {sortedCustomers.map((customer, index) => {
                      const isOverdue = customer.overdue > 0
                      const hasOnlyCurrent = customer.current > 0 && customer.overdue === 0
                      const isSelected = selectedCustomer?.name === customer.name

                      return (
                        <tr
                          key={customer.id || customer.name}
                          className={`group hover:bg-amber-500/[0.03] transition-all duration-200 cursor-pointer ${
                            isSelected ? 'bg-amber-500/10 hover:bg-amber-500/10' : ''
                          }`}
                          onClick={() => handleCustomerClick(customer)}
                        >
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold theme-text-secondary tabular-nums">
                              {index + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col flex-1">
                                <span className="font-semibold text-sm theme-text-primary group-hover:text-amber-400 transition-colors">
                                  {customer.name}
                                </span>
                                {customer.id && (
                                  <span className="text-[10px] theme-text-secondary font-mono opacity-60">
                                    ID: {customer.id}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0">
                                <span className="text-[10px] text-amber-400 whitespace-nowrap font-medium">
                                  details
                                </span>
                                <ChevronRight className="h-3.5 w-3.5 text-amber-400" />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-semibold text-green-600 dark:text-green-400 tabular-nums">
                              {formatCurrency(customer.current, currency)}
                            </span>
                          </td>
                          {/* Dynamic aging period values */}
                          {agingPeriods.map((period) => {
                            const amount = customer.byPeriod?.[period] || 0
                            return (
                              <td key={period} className="px-6 py-4 text-right">
                                <span
                                  className={`text-sm font-semibold tabular-nums ${
                                    amount > 0
                                      ? 'text-orange-600 dark:text-orange-400'
                                      : 'theme-text-secondary opacity-50'
                                  }`}
                                >
                                  {amount > 0 ? formatCurrency(amount, currency) : '—'}
                                </span>
                              </td>
                            )
                          })}
                          <td className="px-6 py-4 text-right">
                            <span
                              className={`text-sm font-bold tabular-nums ${
                                customer.overdue > 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'theme-text-secondary opacity-50'
                              }`}
                            >
                              {customer.overdue > 0
                                ? formatCurrency(customer.overdue, currency)
                                : '—'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums">
                              {formatCurrency(customer.total, currency)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 font-semibold ${
                                isOverdue
                                  ? 'bg-red-500/15 text-red-500 border-red-500/20'
                                  : hasOnlyCurrent
                                    ? 'bg-green-500/15 text-green-500 border-green-500/20'
                                    : 'bg-amber-500/15 text-amber-500 border-amber-500/20'
                              }`}
                            >
                              {isOverdue ? 'overdue' : hasOnlyCurrent ? 'current' : 'mixed'}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {/* Footer with totals */}
                  <tfoot className="sticky bottom-0">
                    <tr className="bg-muted/90 dark:bg-muted/50 backdrop-blur-md border-t border-gray-200/10">
                      <td className="px-6 py-4" />
                      <td className="px-6 py-4">
                        <span className="font-bold text-xs uppercase tracking-wider text-amber-950 dark:text-amber-50">
                          Total
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-sm text-green-600 dark:text-green-400 tabular-nums">
                          {formatCurrency(totalOutstanding - overdueAmount, currency)}
                        </span>
                      </td>
                      {agingPeriods.map((period) => (
                        <td key={period} className="px-6 py-4 text-right">
                          <span className="font-bold text-sm text-orange-600 dark:text-orange-400 tabular-nums">
                            {formatCurrency(outstandingData.totals?.[period] || 0, currency)}
                          </span>
                        </td>
                      ))}
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-sm text-red-600 dark:text-red-400 tabular-nums">
                          {formatCurrency(overdueAmount, currency)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-sm text-red-600 dark:text-red-400 tabular-nums">
                          {formatCurrency(totalOutstanding, currency)}
                        </span>
                      </td>
                      <td className="px-6 py-4" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Detail Side Panel */}
        {selectedCustomer && (
          <OutstandingCustomerDetailPanel
            customer={selectedCustomer}
            selectedInvoice={selectedInvoice}
            onClose={handleClosePanel}
            onInvoiceClick={handleInvoiceClick}
            onInvoiceClose={handleInvoiceClose}
          />
        )}
      </div>
    </div>
  )
}
