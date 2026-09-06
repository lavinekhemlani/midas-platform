'use client'

import { useMemo, useCallback, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '@/lib/sales-utils'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { KPICard } from '../KPICard'
import { CustomerDetailPanel } from '../CustomerDetailPanel'
import { useSelectionState } from '../../hooks/useSelectionState'
import { getCustomerOutstanding, hasOverduePayments } from '../../utils/sortUtils'
import type { Customer, CustomerSummary, CustomerSortField, SortOrder } from '../../types'

interface CustomersSectionProps {
  customers: Customer[]
  customerSummary: CustomerSummary
  currency: string
}

export function CustomersSection({ customers, customerSummary, currency }: CustomersSectionProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const {
    selected,
    selectedTransaction,
    select,
    clearSelection,
    selectTransaction,
    clearTransaction,
  } = useSelectionState<Customer>()

  // Local sort state
  const [sortBy, setSortBy] = useState<CustomerSortField>('totalSales')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const handleSort = useCallback(
    (field: CustomerSortField) => {
      if (sortBy === field) {
        setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortBy(field)
        setSortOrder('desc')
      }
    },
    [sortBy]
  )

  // Sort customers
  const sortedData = useMemo(() => {
    return [...customers].sort((a, b) => {
      let aVal: number | string, bVal: number | string
      switch (sortBy) {
        case 'name':
          return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
        case 'totalSales':
          aVal = a.totalSales
          bVal = b.totalSales
          break
        case 'marketShare':
          aVal = a.totalSales / (customerSummary.totalSales || 1)
          bVal = b.totalSales / (customerSummary.totalSales || 1)
          break
        case 'transactions':
          aVal = (a.invoiceCount || 0) + (a.salesReceiptCount || 0)
          bVal = (b.invoiceCount || 0) + (b.salesReceiptCount || 0)
          break
        case 'outstandingBalance':
          aVal = getCustomerOutstanding(a)
          bVal = getCustomerOutstanding(b)
          break
        default:
          aVal = a.totalSales
          bVal = b.totalSales
      }
      return sortOrder === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
  }, [customers, sortBy, sortOrder, customerSummary.totalSales])

  // Sort icon component
  const SortIcon = ({ field }: { field: CustomerSortField }) => {
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
    <div className="flex flex-col gap-4">
      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 @2xl:grid-cols-4">
        <KPICard
          title="Total Sales"
          value={formatCurrency(customerSummary.totalSales || 0, currency)}
          tooltip="Combined revenue from all customer transactions"
          subtitle="All customers"
          valueColorClass="text-theme-yellow"
          dotColorClass="bg-amber-500"
        />
        <KPICard
          title="Customers"
          value={customerSummary.customerCount || 0}
          tooltip="Unique customers with activity"
          subtitle="Active customers"
          valueColorClass="text-theme-blue"
          dotColorClass="bg-blue-500"
        />
        <KPICard
          title="Transactions"
          value={customerSummary.totalTransactions || 0}
          tooltip="Total invoices and receipts"
          subtitle="This period"
          valueColorClass="text-theme-purple"
          dotColorClass="bg-purple-500"
        />
        <KPICard
          title="Avg/Customer"
          value={formatCurrency(
            customerSummary.customerCount > 0
              ? customerSummary.totalSales / customerSummary.customerCount
              : 0,
            currency
          )}
          tooltip="Average sales per customer"
          subtitle="Per customer"
          valueColorClass="text-theme-green"
          dotColorClass="bg-green-500"
        />
      </div>

      {/* Customer Table with Side Panel */}
      <div className="flex gap-6 min-w-0">
        <div
          className={`transition-all duration-300 ease-out min-w-0 ${selected ? '@5xl:flex-1 @5xl:block hidden' : 'w-full'}`}
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
                      onClick={() => handleSort('totalSales')}
                    >
                      Sales
                      <SortIcon field="totalSales" />
                    </th>
                    <th
                      className="text-right py-3 px-4 text-[11px] font-medium uppercase tracking-wider theme-text-secondary cursor-pointer hover:theme-text-primary transition-colors select-none whitespace-nowrap"
                      onClick={() => handleSort('marketShare')}
                    >
                      Share
                      <SortIcon field="marketShare" />
                    </th>
                    <th
                      className="text-right py-3 px-4 text-[11px] font-medium uppercase tracking-wider theme-text-secondary cursor-pointer hover:theme-text-primary transition-colors select-none whitespace-nowrap"
                      onClick={() => handleSort('transactions')}
                    >
                      Txns
                      <SortIcon field="transactions" />
                    </th>
                    <th
                      className="text-right py-3 pl-4 text-[11px] font-medium uppercase tracking-wider theme-text-secondary cursor-pointer hover:theme-text-primary transition-colors select-none whitespace-nowrap"
                      onClick={() => handleSort('outstandingBalance')}
                    >
                      Due
                      <SortIcon field="outstandingBalance" />
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
                  {sortedData.map((customer, index) => {
                    const totalTransactions =
                      (customer.invoiceCount || 0) + (customer.salesReceiptCount || 0)
                    const percentOfTotal =
                      customerSummary.totalSales > 0
                        ? (customer.totalSales / customerSummary.totalSales) * 100
                        : 0
                    const outstandingBalance = getCustomerOutstanding(customer)
                    const hasOverdue = hasOverduePayments(customer)
                    const isSelected = selected?.id === customer.id

                    return (
                      <tr
                        key={customer.id}
                        className={cn(
                          'group cursor-pointer transition-colors duration-150',
                          isSelected
                            ? 'bg-blue-500/10'
                            : index % 2 === 0
                              ? isLight
                                ? 'bg-stone-200/60'
                                : 'bg-white/[0.02]'
                              : '',
                          isSelected
                            ? 'hover:bg-blue-500/15'
                            : isLight
                              ? 'hover:bg-stone-300/50'
                              : 'hover:bg-white/[0.05]'
                        )}
                        style={{ borderBottom: '1px solid var(--theme-card-border)' }}
                        onClick={() => select(customer)}
                      >
                        {/* Customer Name */}
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-1 h-7 rounded-full flex-shrink-0 transition-all duration-200 ${
                                hasOverdue ? 'bg-red-500' : 'bg-blue-500'
                              } ${isSelected ? 'scale-y-110' : ''}`}
                            />
                            <div className="min-w-0">
                              <p
                                className={`font-medium text-sm truncate transition-colors ${
                                  isSelected
                                    ? 'text-blue-500 dark:text-blue-400'
                                    : 'theme-text-primary'
                                }`}
                              >
                                {customer.name}
                              </p>
                              {hasOverdue && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1.5 py-0 mt-0.5 bg-red-500/15 text-red-500 border-red-500/20 font-semibold"
                                >
                                  overdue
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Sales */}
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm tabular-nums font-semibold theme-text-primary">
                            {formatCurrency(customer.totalSales, currency)}
                          </span>
                        </td>

                        {/* Share */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div
                              className="w-12 h-1 rounded-full overflow-hidden"
                              style={{ backgroundColor: 'var(--theme-card-border)' }}
                            >
                              <div
                                className="h-full bg-blue-500/80 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(percentOfTotal, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums theme-text-secondary min-w-[2.5rem]">
                              {percentOfTotal.toFixed(1)}%
                            </span>
                          </div>
                        </td>

                        {/* Transactions */}
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm tabular-nums theme-text-primary">
                            {totalTransactions}
                          </span>
                        </td>

                        {/* Due */}
                        <td className="py-3 pl-4 text-right">
                          <span
                            className={`text-sm tabular-nums font-medium ${
                              outstandingBalance > 0
                                ? 'text-red-500 dark:text-red-400'
                                : 'theme-text-secondary opacity-40'
                            }`}
                          >
                            {outstandingBalance > 0
                              ? formatCurrency(outstandingBalance, currency)
                              : '—'}
                          </span>
                        </td>

                        {/* Chevron */}
                        <td className="py-3 pl-2 w-8">
                          <ChevronRight
                            className={`w-4 h-4 theme-text-secondary transition-all duration-200 ${
                              isSelected
                                ? 'opacity-100 text-blue-500 translate-x-0'
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
                        Total ({customers.length})
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm tabular-nums font-bold theme-text-primary">
                        {formatCurrency(customerSummary.totalSales, currency)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-xs tabular-nums theme-text-secondary">100%</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm tabular-nums font-semibold theme-text-primary">
                        {customerSummary.totalTransactions}
                      </span>
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <span className="text-sm tabular-nums font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(
                          customers.reduce((sum, c) => sum + getCustomerOutstanding(c), 0),
                          currency
                        )}
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
        {selected && (
          <CustomerDetailPanel
            customer={selected}
            selectedTransaction={selectedTransaction}
            onClose={clearSelection}
            onTransactionClick={selectTransaction}
            onTransactionClose={clearTransaction}
          />
        )}
      </div>
    </div>
  )
}
