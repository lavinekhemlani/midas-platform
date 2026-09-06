'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users,
  Package,
  DollarSign,
  ShoppingCart,
  FileText,
  Clock,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react'
import { formatCurrency } from '@/lib/sales-utils'
import { KPICard } from '../KPICard'
import { useOutstandingPayments } from '@/hooks/useOutstandingPayments'
import { cn } from '@/lib/utils'
import type { Customer, Product, CustomerSummary, ProductSummary } from '../../types'

interface OverviewSectionProps {
  customers: Customer[]
  products: Product[]
  customerSummary: CustomerSummary
  productSummary: ProductSummary
  totalOutstanding: number
  outstandingCount: number
  currency: string
  onViewCustomers: () => void
  onViewProducts: () => void
  onViewOutstanding: () => void
}

export function OverviewSection({
  customers,
  products,
  customerSummary,
  productSummary,
  totalOutstanding,
  outstandingCount,
  currency,
  onViewCustomers,
  onViewProducts,
  onViewOutstanding,
}: OverviewSectionProps) {
  // Fetch AR aging data for the outstanding card
  const { outstandingData } = useOutstandingPayments()

  // Get top overdue customers
  const topOverdueCustomers = (outstandingData?.topCustomers || [])
    .filter((c) => c.overdue > 0)
    .slice(0, 5)

  const overdueCustomers = outstandingData?.overdueCustomers || 0

  return (
    <div className="@container flex flex-col gap-4">
      {/* Main KPI Cards Row */}
      <div className="grid gap-3 grid-cols-2 @2xl:grid-cols-4">
        <KPICard
          title="Total Revenue"
          value={formatCurrency(customerSummary.totalSales || 0, currency)}
          tooltip="Combined revenue from all sales in the selected period"
          subtitle="All sales combined"
          valueColorClass="text-theme-yellow"
          dotColorClass="bg-amber-500"
        />
        <KPICard
          title="Customers"
          value={customerSummary.customerCount || 0}
          tooltip="Number of unique customers with sales activity"
          subtitle="Active this period"
          valueColorClass="text-theme-blue"
          dotColorClass="bg-blue-500"
        />
        <KPICard
          title="Products Sold"
          value={productSummary.productCount || 0}
          tooltip="Number of unique products sold"
          subtitle={`${(productSummary.totalQuantity || 0).toLocaleString()} units`}
          valueColorClass="text-theme-purple"
          dotColorClass="bg-purple-500"
        />
        <KPICard
          title="Transactions"
          value={customerSummary.totalTransactions || 0}
          tooltip="Total number of invoices and sales receipts"
          subtitle="This period"
          valueColorClass="text-theme-green"
          dotColorClass="bg-green-500"
        />
      </div>

      {/* Quick Stats Grid - matches SummaryView layout */}
      {/* At @5xl: 6 cols (Top Customers 2, Top Products 2, Outstanding 2) */}
      {/* At @2xl: 2 cols (each card spans 1) */}
      {/* At mobile: 1 col stack */}
      <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-6 gap-4">
        {/* Top Customers Quick View */}
        <div className="h-full @5xl:col-span-2">
          <Card
            className="glass-luxury-card group h-full flex flex-col gap-0 hover:border-blue-500/20 transition-colors duration-300 min-h-[280px] relative overflow-hidden"
            style={{ border: '1px solid var(--theme-card-border)' }}
          >
            {/* Subtle accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 transition-all duration-200 group-hover:scale-105 group-hover:bg-blue-500/15">
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <CardTitle className="text-sm font-semibold theme-text-primary tracking-tight">
                    Top Customers
                  </CardTitle>
                </div>
                <button
                  onClick={onViewCustomers}
                  className="flex items-center gap-1 text-blue-500 hover:text-blue-400 transition-colors text-xs font-medium group/btn"
                >
                  <span>View all</span>
                  <ArrowUpRight className="w-3 h-3 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 flex-1 flex flex-col">
              <div className="space-y-2.5 flex-1">
                {customers.slice(0, 5).map((customer, index) => {
                  const shareOfTotal =
                    customerSummary.totalSales > 0
                      ? (customer.totalSales / customerSummary.totalSales) * 100
                      : 0
                  return (
                    <div
                      key={customer.id}
                      className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors duration-150"
                    >
                      <span className="text-[10px] font-bold theme-text-secondary w-4 text-center tabular-nums">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm theme-text-primary truncate font-medium">
                            {customer.name}
                          </span>
                          <span className="text-sm font-bold theme-text-primary whitespace-nowrap tabular-nums">
                            {formatCurrency(customer.totalSales, currency)}
                          </span>
                        </div>
                        <div
                          className="mt-1.5 h-1 rounded-full overflow-hidden"
                          style={{ backgroundColor: 'var(--theme-card-border)' }}
                        >
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                            style={{ width: `${shareOfTotal}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Products Quick View */}
        <div className="h-full @5xl:col-span-2">
          <Card
            className="glass-luxury-card group h-full flex flex-col gap-0 hover:border-purple-500/20 transition-colors duration-300 min-h-[280px] relative overflow-hidden"
            style={{ border: '1px solid var(--theme-card-border)' }}
          >
            {/* Subtle accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 transition-all duration-200 group-hover:scale-105 group-hover:bg-purple-500/15">
                    <Package className="w-4 h-4 text-purple-400" />
                  </div>
                  <CardTitle className="text-sm font-semibold theme-text-primary tracking-tight">
                    Top Products
                  </CardTitle>
                </div>
                <button
                  onClick={onViewProducts}
                  className="flex items-center gap-1 text-purple-500 hover:text-purple-400 transition-colors text-xs font-medium group/btn"
                >
                  <span>View all</span>
                  <ArrowUpRight className="w-3 h-3 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 flex-1 flex flex-col">
              <div className="space-y-2.5 flex-1">
                {products.slice(0, 5).map((product, index) => {
                  const shareOfTotal =
                    productSummary.totalSales > 0
                      ? (product.total / productSummary.totalSales) * 100
                      : 0
                  return (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors duration-150"
                    >
                      <span className="text-[10px] font-bold theme-text-secondary w-4 text-center tabular-nums">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm theme-text-primary truncate font-medium">
                            {product.name}
                          </span>
                          <span className="text-sm font-bold theme-text-primary whitespace-nowrap tabular-nums">
                            {formatCurrency(product.total, currency)}
                          </span>
                        </div>
                        <div
                          className="mt-1.5 h-1 rounded-full overflow-hidden"
                          style={{ backgroundColor: 'var(--theme-card-border)' }}
                        >
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500"
                            style={{ width: `${shareOfTotal}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Outstanding Payments Summary */}
        <div className="h-full @5xl:col-span-2">
          <Card
            className="glass-luxury-card group h-full flex flex-col gap-0 hover:border-amber-500/20 transition-colors duration-300 min-h-[280px] relative overflow-hidden"
            style={{ border: '1px solid var(--theme-card-border)' }}
          >
            {/* Subtle accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 transition-all duration-200 group-hover:scale-105 group-hover:bg-amber-500/15">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold theme-text-primary tracking-tight">
                      Outstanding Payments
                    </CardTitle>
                    <p className="text-[10px] theme-text-secondary mt-0.5">
                      Unpaid invoices from customers
                    </p>
                  </div>
                </div>
                {outstandingCount > 0 && (
                  <button
                    onClick={onViewOutstanding}
                    className="flex items-center gap-1 text-amber-500 hover:text-amber-400 transition-colors text-xs font-medium group/btn"
                  >
                    <span>View all</span>
                    <ArrowUpRight className="w-3 h-3 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 flex-1 flex flex-col">
              {outstandingCount > 0 ? (
                <>
                  {/* Main Metrics */}
                  <div
                    className="flex items-center justify-between mb-3 pb-3"
                    style={{ borderBottom: '1px solid var(--theme-card-border)' }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-xl font-bold tabular-nums',
                          totalOutstanding > 0 ? 'text-amber-500' : 'text-green-500'
                        )}
                      >
                        {formatCurrency(totalOutstanding, currency)}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider theme-text-secondary font-medium">
                        Total Due
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3 h-3 text-gray-400" />
                          <span className="text-sm font-bold theme-text-primary tabular-nums">
                            {outstandingCount}
                          </span>
                        </div>
                        <span className="text-[9px] theme-text-secondary">Customers</span>
                      </div>
                      {overdueCustomers > 0 && (
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-red-400" />
                            <span className="text-sm font-bold text-red-500 tabular-nums">
                              {overdueCustomers}
                            </span>
                          </div>
                          <span className="text-[9px] theme-text-secondary">Overdue</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Top Overdue Customers */}
                  {topOverdueCustomers.length > 0 && (
                    <div className="flex-1 min-h-0 flex flex-col">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Users className="w-3 h-3 text-amber-400" />
                        <span className="text-[10px] font-semibold theme-text-secondary uppercase tracking-wider">
                          Top Overdue
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {topOverdueCustomers.map((customer, index) => (
                          <div
                            key={customer.id || index}
                            className="flex items-center justify-between py-1 px-2 -mx-2 rounded hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                                  index === 0
                                    ? 'bg-red-500'
                                    : index === 1
                                      ? 'bg-red-400'
                                      : index === 2
                                        ? 'bg-amber-500'
                                        : index === 3
                                          ? 'bg-amber-400'
                                          : 'bg-amber-300'
                                )}
                              />
                              <span className="text-[11px] theme-text-primary truncate font-medium">
                                {customer.name}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-amber-500 flex-shrink-0 tabular-nums">
                              {formatCurrency(customer.total, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-3">
                    <DollarSign className="w-6 h-6 text-green-400" />
                  </div>
                  <p className="text-sm font-semibold text-green-500">All Paid!</p>
                  <p className="text-[10px] theme-text-secondary mt-0.5">No outstanding payments</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Metrics Row */}
      <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-4">
        <Card
          className="glass-luxury-card group h-full hover:border-amber-500/20 p-4 transition-all duration-200 relative overflow-hidden"
          style={{ border: '1px solid var(--theme-card-border)' }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider theme-text-secondary">
                Avg Order
              </p>
              <p className="text-base font-bold theme-text-primary mt-1.5 tabular-nums">
                {formatCurrency(
                  customerSummary.totalTransactions > 0
                    ? customerSummary.totalSales / customerSummary.totalTransactions
                    : 0,
                  currency
                )}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors">
              <ShoppingCart className="w-5 h-5 text-amber-500/40 group-hover:text-amber-500/60 transition-colors" />
            </div>
          </div>
        </Card>

        <Card
          className="glass-luxury-card group h-full hover:border-blue-500/20 p-4 transition-all duration-200 relative overflow-hidden"
          style={{ border: '1px solid var(--theme-card-border)' }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider theme-text-secondary">
                Avg/Customer
              </p>
              <p className="text-base font-bold theme-text-primary mt-1.5 tabular-nums">
                {formatCurrency(
                  customerSummary.customerCount > 0
                    ? customerSummary.totalSales / customerSummary.customerCount
                    : 0,
                  currency
                )}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors">
              <Users className="w-5 h-5 text-blue-500/40 group-hover:text-blue-500/60 transition-colors" />
            </div>
          </div>
        </Card>

        <Card
          className="glass-luxury-card group h-full hover:border-purple-500/20 p-4 transition-all duration-200 relative overflow-hidden"
          style={{ border: '1px solid var(--theme-card-border)' }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider theme-text-secondary">
                Avg Unit Price
              </p>
              <p className="text-base font-bold theme-text-primary mt-1.5 tabular-nums">
                {formatCurrency(
                  productSummary.totalQuantity > 0
                    ? productSummary.totalSales / productSummary.totalQuantity
                    : 0,
                  currency
                )}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors">
              <Package className="w-5 h-5 text-purple-500/40 group-hover:text-purple-500/60 transition-colors" />
            </div>
          </div>
        </Card>

        <Card
          className="glass-luxury-card group h-full hover:border-green-500/20 p-4 transition-all duration-200 relative overflow-hidden"
          style={{ border: '1px solid var(--theme-card-border)' }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider theme-text-secondary">
                Collection Rate
              </p>
              <p className="text-base font-bold theme-text-primary mt-1.5 tabular-nums">
                {customerSummary.totalSales > 0
                  ? (
                      ((customerSummary.totalSales - totalOutstanding) /
                        customerSummary.totalSales) *
                      100
                    ).toFixed(1)
                  : 100}
                %
              </p>
            </div>
            <div className="p-2 rounded-lg bg-green-500/5 group-hover:bg-green-500/10 transition-colors">
              <TrendingUp className="w-5 h-5 text-green-500/40 group-hover:text-green-500/60 transition-colors" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
