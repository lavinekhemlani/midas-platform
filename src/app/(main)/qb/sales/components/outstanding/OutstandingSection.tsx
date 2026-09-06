'use client'

import React, { useMemo, useCallback, useState } from 'react'
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '@/lib/sales-utils'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
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
  const { theme } = useTheme()
  const isLight = theme === 'light'

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

  const handleSort = useCallback(
    (field: ARAgingSortField) => {
      if (sortBy === field) {
        // Same column - toggle direction
        setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'))
      } else {
        // New column - set to descending
        setSortBy(field)
        setSortOrder('desc')
      }
    },
    [sortBy]
  )

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
      <div className="space-y-6">
        {/* Summary skeleton */}
        <div className="flex items-baseline gap-8">
          <div className="h-10 w-40 bg-gray-200/10 dark:bg-gray-700/20 animate-pulse" />
          <div className="h-6 w-24 bg-gray-200/10 dark:bg-gray-700/20 animate-pulse" />
          <div className="h-6 w-24 bg-gray-200/10 dark:bg-gray-700/20 animate-pulse" />
        </div>
        {/* Table skeleton */}
        <div className="space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-14 bg-gray-200/5 dark:bg-gray-700/10 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (arError) {
    return (
      <div className="py-16 text-center">
        <p className="text-red-500 dark:text-red-400 font-medium">Failed to load data</p>
        <p className="text-sm theme-text-secondary mt-1">{arError.message || 'Please try again'}</p>
      </div>
    )
  }

  // No data state
  if (!outstandingData || outstandingData.totalOutstanding === 0) {
    return (
      <div className="py-20 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-4">
          <svg
            className="w-6 h-6 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-lg font-medium theme-text-primary">All caught up</p>
        <p className="text-sm theme-text-secondary mt-1">No outstanding invoices</p>
      </div>
    )
  }

  const { totalOutstanding, numberOfCustomers, overdueAmount, overdueCustomers } = outstandingData

  const currentAmount = totalOutstanding - overdueAmount

  // Sort icon component - always visible, highlights when active
  const SortIcon = ({ field }: { field: ARAgingSortField }) => {
    const isActive = sortBy === field
    const isAsc = isActive && sortOrder === 'asc'
    const isDesc = isActive && sortOrder === 'desc'

    return (
      <span className="inline-flex flex-col ml-1 -space-y-1.5 align-middle">
        <ChevronUp
          className={`w-3 h-3 transition-opacity ${isAsc ? 'opacity-100' : isActive ? 'opacity-20' : 'opacity-30'}`}
        />
        <ChevronDown
          className={`w-3 h-3 transition-opacity ${isDesc ? 'opacity-100' : isActive ? 'opacity-20' : 'opacity-30'}`}
        />
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Minimal Summary Header */}
      <div
        className="flex flex-wrap items-baseline gap-x-10 gap-y-3 pb-4 border-b"
        style={{ borderColor: 'var(--theme-card-border)' }}
      >
        <div>
          <span className="text-3xl font-semibold theme-text-primary tracking-tight tabular-nums">
            {formatCurrency(totalOutstanding, currency)}
          </span>
          <span className="text-sm theme-text-secondary ml-3">outstanding</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm tabular-nums theme-text-secondary">
            {formatCurrency(currentAmount, currency)} current
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-sm tabular-nums theme-text-secondary">
            {formatCurrency(overdueAmount, currency)} overdue
          </span>
        </div>
        <div className="text-sm theme-text-secondary opacity-60">
          {numberOfCustomers} customer{numberOfCustomers !== 1 ? 's' : ''}
          {overdueCustomers > 0 && ` · ${overdueCustomers} overdue`}
        </div>
      </div>

      {/* Clean Table with Side Panel */}
      <div className="flex gap-6 min-w-0">
        <div
          className={`transition-all duration-300 ease-out min-w-0 ${selectedCustomer ? '@5xl:flex-1 @5xl:block hidden' : 'w-full'}`}
        >
          {/* Table Container with fixed height */}
          <div className="flex flex-col h-[500px] overflow-x-auto">
            {/* Fixed Header */}
            <div
              className="flex-shrink-0"
              style={{ borderBottom: '1px solid var(--theme-card-border)' }}
            >
              <table className="w-full">
                <thead>
                  <tr>
                    <th
                      className="text-left py-3 pr-4 text-[11px] font-medium uppercase tracking-wider theme-text-secondary cursor-pointer hover:theme-text-primary transition-colors select-none"
                      onClick={() => handleSort('name')}
                    >
                      Customer
                      <SortIcon field="name" />
                    </th>
                    <th
                      className="text-right py-3 px-4 text-[11px] font-medium uppercase tracking-wider theme-text-secondary cursor-pointer hover:theme-text-primary transition-colors select-none whitespace-nowrap"
                      onClick={() => handleSort('current')}
                    >
                      Current
                      <SortIcon field="current" />
                    </th>
                    <th
                      className="text-right py-3 px-4 text-[11px] font-medium uppercase tracking-wider theme-text-secondary cursor-pointer hover:theme-text-primary transition-colors select-none whitespace-nowrap"
                      onClick={() => handleSort('overdue')}
                    >
                      Overdue
                      <SortIcon field="overdue" />
                    </th>
                    <th
                      className="text-right py-3 pl-4 text-[11px] font-medium uppercase tracking-wider theme-text-secondary cursor-pointer hover:theme-text-primary transition-colors select-none whitespace-nowrap"
                      onClick={() => handleSort('total')}
                    >
                      Total
                      <SortIcon field="total" />
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
              </table>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto styled-scrollbar min-h-0">
              <table className="w-full">
                <tbody>
                  {sortedCustomers.map((customer, index) => {
                    const isOverdue = customer.overdue > 0
                    const overduePercent =
                      customer.total > 0 ? (customer.overdue / customer.total) * 100 : 0
                    const isSelected = selectedCustomer?.name === customer.name

                    return (
                      <tr
                        key={customer.id || customer.name}
                        className={cn(
                          'group cursor-pointer transition-colors duration-150',
                          isSelected
                            ? 'bg-amber-500/10'
                            : index % 2 === 0
                              ? isLight
                                ? 'bg-stone-200/60'
                                : 'bg-white/[0.02]'
                              : '',
                          isSelected
                            ? 'hover:bg-amber-500/15'
                            : isLight
                              ? 'hover:bg-stone-300/50'
                              : 'hover:bg-white/[0.05]'
                        )}
                        style={{ borderBottom: '1px solid var(--theme-card-border)' }}
                        onClick={() => handleCustomerClick(customer)}
                      >
                        {/* Customer Name */}
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            {/* Status indicator */}
                            <div
                              className={`w-1 h-7 rounded-full flex-shrink-0 transition-all duration-200 ${
                                isOverdue ? 'bg-red-500' : 'bg-green-500'
                              } ${isSelected ? 'scale-y-110' : ''}`}
                            />
                            <div className="min-w-0">
                              <p
                                className={`font-medium text-sm truncate transition-colors ${
                                  isSelected
                                    ? 'text-amber-500 dark:text-amber-400'
                                    : 'theme-text-primary'
                                }`}
                              >
                                {customer.name}
                              </p>
                              {/* Aging bar */}
                              {isOverdue && (
                                <div className="flex items-center gap-2 mt-1">
                                  <div
                                    className="w-14 h-1 rounded-full overflow-hidden"
                                    style={{ backgroundColor: 'var(--theme-card-border)' }}
                                  >
                                    <div
                                      className="h-full bg-red-500/80 rounded-full transition-all duration-300"
                                      style={{ width: `${Math.min(overduePercent, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-red-500 dark:text-red-400 tabular-nums">
                                    {overduePercent.toFixed(0)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Current Amount */}
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`text-sm tabular-nums ${
                              customer.current > 0
                                ? 'theme-text-primary'
                                : 'theme-text-secondary opacity-40'
                            }`}
                          >
                            {customer.current > 0
                              ? formatCurrency(customer.current, currency)
                              : '—'}
                          </span>
                        </td>

                        {/* Overdue Amount */}
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`text-sm tabular-nums font-medium ${
                              customer.overdue > 0
                                ? 'text-red-500 dark:text-red-400'
                                : 'theme-text-secondary opacity-40'
                            }`}
                          >
                            {customer.overdue > 0
                              ? formatCurrency(customer.overdue, currency)
                              : '—'}
                          </span>
                        </td>

                        {/* Total */}
                        <td className="py-3 pl-4 text-right">
                          <span className="text-sm tabular-nums font-semibold theme-text-primary">
                            {formatCurrency(customer.total, currency)}
                          </span>
                        </td>

                        {/* Chevron */}
                        <td className="py-3 pl-2 w-8">
                          <ChevronRight
                            className={`w-4 h-4 theme-text-secondary transition-all duration-200 ${
                              isSelected
                                ? 'opacity-100 text-amber-500 translate-x-0'
                                : 'opacity-0 group-hover:opacity-60 -translate-x-1 group-hover:translate-x-0'
                            }`}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Fixed Footer */}
            <div
              className="flex-shrink-0"
              style={{ borderTop: '1px solid var(--theme-card-border)' }}
            >
              <table className="w-full">
                <tfoot>
                  <tr>
                    <td className="py-3 pr-4">
                      <span className="text-xs font-medium uppercase tracking-wider theme-text-secondary">
                        Total ({sortedCustomers.length})
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm tabular-nums font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(currentAmount, currency)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm tabular-nums font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(overdueAmount, currency)}
                      </span>
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <span className="text-sm tabular-nums font-bold theme-text-primary">
                        {formatCurrency(totalOutstanding, currency)}
                      </span>
                    </td>
                    <td className="w-8" />
                  </tr>
                </tfoot>
              </table>
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
