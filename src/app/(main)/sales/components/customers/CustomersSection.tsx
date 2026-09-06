'use client'

import { useMemo, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/sales-utils'
import { KPICard } from '../KPICard'
import { CustomerDetailPanel } from '../CustomerDetailPanel'
import { SortableTableHeader } from '../shared/SortableTableHeader'
import { useTableSort } from '../../hooks/useTableSort'
import { useSelectionState } from '../../hooks/useSelectionState'
import { sortCustomers, getCustomerOutstanding, hasOverduePayments } from '../../utils/sortUtils'
import type { Customer, CustomerSummary, CustomerSortField, SortOrder } from '../../types'

interface CustomersSectionProps {
  customers: Customer[]
  customerSummary: CustomerSummary
  currency: string
}

export function CustomersSection({ customers, customerSummary, currency }: CustomersSectionProps) {
  const {
    selected,
    selectedTransaction,
    select,
    clearSelection,
    selectTransaction,
    clearTransaction,
  } = useSelectionState<Customer>()

  const sortFn = useCallback(
    (a: Customer, b: Customer, sortBy: CustomerSortField, sortOrder: SortOrder) =>
      sortCustomers(a, b, sortBy, sortOrder, customerSummary.totalSales),
    [customerSummary.totalSales]
  )

  const { sortedData, sortBy, sortOrder, handleSort } = useTableSort<Customer, CustomerSortField>({
    data: customers,
    initialSortBy: 'totalSales',
    sortFn,
  })

  return (
    <div className="flex flex-col gap-3">
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
      <div className="flex gap-4">
        <div
          className={`transition-all duration-300 ${selected ? '@5xl:w-2/3 @5xl:block hidden' : 'w-full'}`}
        >
          <div className="group glass-luxury-card rounded-xl border border-gray-200/10 overflow-hidden flex flex-col relative">
            {/* Subtle top accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent z-20" />
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
                        label="Total Sales"
                        sortKey="totalSales"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                        align="right"
                      />
                      <SortableTableHeader
                        label="% of Sales"
                        sortKey="marketShare"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                        align="right"
                        tooltip="Percentage of total sales"
                      />
                      <SortableTableHeader
                        label="Transactions"
                        sortKey="transactions"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                        align="right"
                        tooltip="Total invoices and receipts"
                      />
                      <SortableTableHeader
                        label="Avg Transaction"
                        sortKey="avgTransaction"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                        align="right"
                        tooltip="Average value per transaction"
                      />
                      <SortableTableHeader
                        label="Due Payments"
                        sortKey="outstandingBalance"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                        align="right"
                        tooltip="Outstanding balance from unpaid invoices"
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/5">
                    {sortedData.map((customer, index) => {
                      const totalTransactions =
                        (customer.invoiceCount || 0) + (customer.salesReceiptCount || 0)
                      const avgTransaction =
                        totalTransactions > 0 ? customer.totalSales / totalTransactions : 0
                      const percentOfTotal =
                        customerSummary.totalSales > 0
                          ? (customer.totalSales / customerSummary.totalSales) * 100
                          : 0
                      const outstandingBalance = getCustomerOutstanding(customer)
                      const hasOverdue = hasOverduePayments(customer)

                      return (
                        <tr
                          key={customer.id}
                          className={`group hover:bg-blue-500/[0.03] transition-all duration-200 cursor-pointer ${
                            selected?.id === customer.id
                              ? 'bg-blue-500/10 hover:bg-blue-500/10'
                              : ''
                          }`}
                          onClick={() => select(customer)}
                        >
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold theme-text-secondary tabular-nums">
                              {index + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col flex-1">
                                <span className="font-semibold text-sm theme-text-primary group-hover:text-blue-400 transition-colors">
                                  {customer.name}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] theme-text-secondary font-mono opacity-60">
                                    ID: {customer.id}
                                  </span>
                                  {hasOverdue && (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] px-1.5 py-0 bg-red-500/15 text-red-500 border-red-500/20 font-semibold"
                                    >
                                      overdue
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0">
                                <span className="text-[10px] text-blue-400 whitespace-nowrap font-medium">
                                  details
                                </span>
                                <ChevronRight className="h-3.5 w-3.5 text-blue-400" />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-sm theme-text-primary tabular-nums">
                              {formatCurrency(customer.totalSales, currency)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-14 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(percentOfTotal, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold theme-text-primary min-w-[2.5rem] tabular-nums">
                                {percentOfTotal.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-bold theme-text-primary tabular-nums">
                                {totalTransactions}
                              </span>
                              <span className="text-[10px] theme-text-secondary opacity-70">
                                {customer.invoiceCount || 0} inv · {customer.salesReceiptCount || 0}{' '}
                                rcpt
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-semibold text-sm theme-text-primary tabular-nums">
                              {formatCurrency(avgTransaction, currency)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span
                              className={`font-bold text-sm tabular-nums ${
                                outstandingBalance > 0
                                  ? 'text-red-500'
                                  : 'theme-text-secondary opacity-50'
                              }`}
                            >
                              {outstandingBalance > 0
                                ? formatCurrency(outstandingBalance, currency)
                                : '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
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
