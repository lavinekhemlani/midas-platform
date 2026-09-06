# Sales Page Implementation Guide

## Quick Start

This guide provides concrete code examples for implementing the redesigned Sales page architecture. Reference the main architecture document (`sales-page-redesign.md`) for the complete design rationale.

---

## Phase 1: Foundation Setup

### 1.1 Create Type Definitions

**File:** `src/app/(main)/sales/types/sales.ts`

```typescript
// Core domain types
export interface DateRange {
  start: string
  end: string
}

export interface Customer {
  id: string
  name: string
  totalSales: number
  invoiceCount: number
  salesReceiptCount: number
  transactions: Transaction[]
}

export interface Product {
  id: string
  name: string
  type: 'Service' | 'Inventory' | 'NonInventory'
  total: number
  quantity: number
  avgUnitPrice: number
  transactionCount: number
  transactions: ProductTransaction[]
}

export interface Transaction {
  id: string
  type: 'Invoice' | 'SalesReceipt'
  docNumber: string
  date: string
  amount: number
  balance?: number
  dueDate?: string
}

export interface ProductTransaction extends Transaction {
  customer: string
  quantity: number
  unitPrice: number
  productName: string
  productType: string
}

export interface CustomerSummary {
  totalSales: number
  customerCount: number
  totalTransactions: number
}

export interface ProductSummary {
  totalSales: number
  productCount: number
  totalQuantity: number
  totalTransactions: number
}

// Sort field types
export type CustomerSortField =
  | 'name'
  | 'totalSales'
  | 'marketShare'
  | 'transactions'
  | 'avgTransaction'
  | 'outstandingBalance'

export type ProductSortField =
  | 'name'
  | 'type'
  | 'totalSales'
  | 'marketShare'
  | 'quantity'
  | 'avgUnitPrice'
  | 'transactions'

export type OutstandingSortField =
  | 'customerName'
  | 'docNumber'
  | 'date'
  | 'dueDate'
  | 'amount'
  | 'amountPaid'
  | 'balance'

export type SortOrder = 'asc' | 'desc'
export type TabId = 'overview' | 'customers' | 'products' | 'outstanding'

// Component Props interfaces
export interface SectionProps {
  loading: boolean
  error?: string
  dateRange: DateRange
  period: string
}

export interface CustomersSectionProps extends SectionProps {
  data: {
    customers: Customer[]
    summary: CustomerSummary
  }
}

export interface ProductsSectionProps extends SectionProps {
  data: {
    products: Product[]
    summary: ProductSummary
    allTransactions?: ProductTransaction[]
  }
}
```

### 1.2 Create Generic Table Sort Hook

**File:** `src/app/(main)/sales/hooks/useTableSort.ts`

```typescript
import { useState, useMemo } from 'react'
import { SortOrder } from '../types/sales'

interface UseTableSortOptions<T> {
  data: T[]
  initialSortBy: keyof T
  initialSortOrder?: SortOrder
  customComparator?: (a: T, b: T, sortBy: keyof T) => number
}

export function useTableSort<T>({
  data,
  initialSortBy,
  initialSortOrder = 'desc',
  customComparator,
}: UseTableSortOptions<T>) {
  const [sortBy, setSortBy] = useState<keyof T>(initialSortBy)
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder)

  const handleSort = (field: keyof T) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return []

    return [...data].sort((a, b) => {
      // Use custom comparator if provided
      if (customComparator) {
        const result = customComparator(a, b, sortBy)
        return sortOrder === 'asc' ? result : -result
      }

      // Default comparison
      const aValue = a[sortBy]
      const bValue = b[sortBy]

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase())
        return sortOrder === 'asc' ? comparison : -comparison
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
      }

      return 0
    })
  }, [data, sortBy, sortOrder, customComparator])

  return {
    sortedData,
    sortBy,
    sortOrder,
    handleSort,
  }
}
```

### 1.3 Create Selection State Hook

**File:** `src/app/(main)/sales/hooks/useSelectionState.ts`

```typescript
import { useState } from 'react'

interface SelectionState<T, U = any> {
  selectedItem: T | null
  selectedDetail: U | null
  setSelectedItem: (item: T | null) => void
  setSelectedDetail: (detail: U | null) => void
  clearSelection: () => void
  toggleItem: (item: T, idKey: keyof T) => void
}

export function useSelectionState<T, U = any>(
  idKey: keyof T = 'id' as keyof T
): SelectionState<T, U> {
  const [selectedItem, setSelectedItem] = useState<T | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<U | null>(null)

  const clearSelection = () => {
    setSelectedItem(null)
    setSelectedDetail(null)
  }

  const toggleItem = (item: T) => {
    if (selectedItem && selectedItem[idKey] === item[idKey]) {
      clearSelection()
    } else {
      setSelectedItem(item)
      setSelectedDetail(null) // Clear detail when switching items
    }
  }

  return {
    selectedItem,
    selectedDetail,
    setSelectedItem,
    setSelectedDetail,
    clearSelection,
    toggleItem,
  }
}
```

### 1.4 Create Sales Calculations Utility

**File:** `src/app/(main)/sales/utils/salesCalculations.ts`

```typescript
import { Customer, Product, Transaction } from '../types/sales'

export function calculateOutstandingPayments(customers: Customer[]) {
  return customers.flatMap((customer) =>
    (customer.transactions || [])
      .filter(
        (transaction) =>
          transaction.type === 'Invoice' &&
          transaction.balance !== undefined &&
          transaction.balance > 0
      )
      .map((transaction) => ({
        ...transaction,
        customerName: customer.name,
        customerId: customer.id,
        daysOverdue: transaction.dueDate
          ? Math.max(
              0,
              Math.floor(
                (new Date().getTime() - new Date(transaction.dueDate).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            )
          : 0,
      }))
  )
}

export function calculateMarketShare(itemTotal: number, totalSales: number): number {
  return totalSales > 0 ? (itemTotal / totalSales) * 100 : 0
}

export function calculateAverageTransaction(totalSales: number, transactionCount: number): number {
  return transactionCount > 0 ? totalSales / transactionCount : 0
}

export function calculateOutstandingBalance(customer: Customer): number {
  return (customer.transactions || [])
    .filter((t) => t.type === 'Invoice' && t.balance !== undefined && t.balance > 0)
    .reduce((sum, t) => sum + (t.balance || 0), 0)
}

export function hasOverduePayments(customer: Customer): boolean {
  return (customer.transactions || []).some(
    (t) =>
      t.type === 'Invoice' &&
      t.balance !== undefined &&
      t.balance > 0 &&
      t.dueDate &&
      new Date(t.dueDate) < new Date()
  )
}

export function groupProductsByType(products: Product[]) {
  const types = ['Service', 'Inventory', 'NonInventory'] as const

  return types.map((type) => {
    const typeProducts = products.filter((p) => p.type === type)
    const typeTotal = typeProducts.reduce((sum, p) => sum + p.total, 0)
    const typeQuantity = typeProducts.reduce((sum, p) => sum + (p.quantity || 0), 0)

    return {
      type,
      products: typeProducts,
      total: typeTotal,
      quantity: typeQuantity,
      count: typeProducts.length,
    }
  })
}
```

---

## Phase 2: Shared Components

### 2.1 Sortable Table Header Component

**File:** `src/app/(main)/sales/components/shared/SortableTableHeader.tsx`

```typescript
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { SortOrder } from '../../types/sales'

interface SortableTableHeaderProps<T> {
  label: string
  field: T
  currentSortBy: T
  currentSortOrder: SortOrder
  onSort: (field: T) => void
  align?: 'left' | 'right' | 'center'
  tooltip?: string
  className?: string
}

export function SortableTableHeader<T extends string>({
  label,
  field,
  currentSortBy,
  currentSortOrder,
  onSort,
  align = 'left',
  tooltip,
  className = ''
}: SortableTableHeaderProps<T>) {
  const isActive = currentSortBy === field
  const alignClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'

  return (
    <th
      className={`px-6 py-4 text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-50 cursor-pointer hover:text-amber-900 dark:hover:text-white transition-colors whitespace-nowrap ${className}`}
      onClick={() => onSort(field)}
    >
      <div className={`flex items-center gap-1 ${alignClass}`}>
        {tooltip ? (
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  {label}
                  <HelpCircle className="w-3 h-3 text-amber-800 dark:text-amber-200 opacity-60" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span>{label}</span>
        )}
        {isActive ? (
          currentSortOrder === 'asc' ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )
        ) : (
          <ChevronsUpDown className="w-4 h-4 opacity-30" />
        )}
      </div>
    </th>
  )
}
```

### 2.2 Section Header Component

**File:** `src/app/(main)/sales/components/shared/SectionHeader.tsx`

```typescript
import { LucideIcon } from 'lucide-react'

interface SectionHeaderProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  badge?: {
    count: number
    variant?: 'default' | 'warning' | 'danger'
  }
}

export function SectionHeader({ icon: Icon, title, subtitle, badge }: SectionHeaderProps) {
  const getBadgeClasses = () => {
    switch (badge?.variant) {
      case 'warning':
        return 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
      case 'danger':
        return 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30'
      default:
        return 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30'
    }
  }

  return (
    <div className="flex items-center gap-3 mb-6">
      <Icon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-serif font-light italic theme-text-primary">
            {title}
          </h2>
          {badge && (
            <Badge variant="outline" className={`text-xs px-2 py-1 ${getBadgeClasses()}`}>
              {badge.count}
            </Badge>
          )}
        </div>
        {subtitle && (
          <p className="text-sm theme-text-secondary mt-1">{subtitle}</p>
        )}
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-purple-500/30 via-purple-500/10 to-transparent" />
    </div>
  )
}
```

---

## Phase 3: Header Components

### 3.1 Sales Tabs Component

**File:** `src/app/(main)/sales/components/header/SalesTabs.tsx`

```typescript
'use client'

import { TrendingUp, Users, Package, DollarSign } from 'lucide-react'
import { TabId } from '../../types/sales'
import { Badge } from '@/components/ui/badge'

interface Tab {
  id: TabId
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

interface SalesTabsProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  outstandingCount?: number
}

export function SalesTabs({ activeTab, onTabChange, outstandingCount }: SalesTabsProps) {
  const tabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'outstanding', label: 'Outstanding', icon: DollarSign, badge: outstandingCount }
  ]

  return (
    <div className="glass-luxury-card rounded-xl border border-border/50 p-1 mb-6">
      <div className="flex gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                transition-all duration-200 font-medium text-sm
                ${
                  isActive
                    ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg'
                    : 'hover:bg-muted/50 theme-text-secondary hover:theme-text-primary'
                }
              `}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <Badge
                  variant="outline"
                  className={`
                    text-xs px-1.5 py-0
                    ${
                      isActive
                        ? 'bg-white/20 text-white border-white/30'
                        : 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30'
                    }
                  `}
                >
                  {tab.badge}
                </Badge>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

### 3.2 Sales Header Component

**File:** `src/app/(main)/sales/components/header/SalesHeader.tsx`

```typescript
'use client'

import { Calendar } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { DateRange } from '../../types/sales'

const periodOptions = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' }
]

interface SalesHeaderProps {
  period: string
  dateRange: DateRange
  onPeriodChange: (period: string) => void
}

export function SalesHeader({ period, dateRange, onPeriodChange }: SalesHeaderProps) {
  const formatDateRange = () => {
    if (!dateRange.start || !dateRange.end) return null

    const start = new Date(dateRange.start).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    const end = new Date(dateRange.end).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })

    return (
      <span className="flex items-center gap-2">
        <span className="font-serif italic text-[0.9rem] theme-text-primary">from</span>
        <span>{start}</span>
        <span className="font-serif italic text-[0.9rem] theme-text-primary">to</span>
        <span>{end}</span>
      </span>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4 mb-6">
      <span className="text-xl theme-text-secondary">
        Comprehensive sales analysis by customer and product
      </span>
      <div className="flex items-center gap-3">
        <span className="text-sm theme-text-secondary whitespace-nowrap">
          {formatDateRange()}
        </span>
        <Select value={period} onValueChange={onPeriodChange}>
          <SelectTrigger className="w-[180px] glass-morphism">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
```

---

## Phase 4: Main Page Implementation

### 4.1 New page.tsx (Orchestrator)

**File:** `src/app/(main)/sales/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSalesCustomer, useSalesProduct } from '@/hooks/useSalesData'
import { useSalesContext } from '@/contexts/SalesContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useCompanyMetadata } from '@/hooks/useCompanyMetadata'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { getDateRangeForPeriod } from '@/lib/report-utils'
import { SalesHeader } from './components/header/SalesHeader'
import { SalesTabs } from './components/header/SalesTabs'
import { OverviewSection } from './components/overview/OverviewSection'
import { CustomersSection } from './components/customers/CustomersSection'
import { ProductsSection } from './components/products/ProductsSection'
import { OutstandingSection } from './components/outstanding/OutstandingSection'
import { calculateOutstandingPayments } from './utils/salesCalculations'
import { TabId } from './types/sales'

export default function SalesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Navigation state - can be URL-based or local
  const [activeTab, setActiveTab] = useState<TabId>(
    (searchParams?.get('tab') as TabId) || 'overview'
  )

  // Context state
  const { period, dateRange, setPeriod, setDateRange } = useSalesContext()
  const { currency } = useCurrency()
  const { data: companyData } = useCompanyMetadata()

  // Data fetching
  const {
    salesData: customerData,
    isLoading: customerLoading,
    error: customerError
  } = useSalesCustomer(dateRange.start, dateRange.end)

  const {
    salesData: productData,
    isLoading: productLoading,
    error: productError
  } = useSalesProduct(period, dateRange.start, dateRange.end)

  // Derived data
  const customers = customerData?.salesByCustomer || []
  const customerSummary = customerData?.summary || {}
  const products = productData?.salesByProduct || []
  const productSummary = productData?.summary || {}
  const outstandingPayments = calculateOutstandingPayments(customers)

  // Loading and error states
  const loading = customerLoading || productLoading
  const error = customerError || productError

  // Report loading state for coordinated UI
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(loading && !customerData && !productData)
  }, [loading, customerData, productData, welcomeContext])

  // Handlers
  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
    const range = getDateRangeForPeriod(newPeriod)
    setDateRange(range)
  }

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    // Optional: Update URL
    router.push(`/sales?tab=${tab}`)
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-sm theme-text-secondary">Loading sales data...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              Error: {typeof error === 'string' ? error : error?.message || 'An unknown error occurred'}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No data state
  if (!customerData && !productData) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">No sales data available</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="@container space-y-6">
      <SalesHeader
        period={period}
        dateRange={dateRange}
        onPeriodChange={handlePeriodChange}
      />

      <SalesTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        outstandingCount={outstandingPayments.length}
      />

      {activeTab === 'overview' && (
        <OverviewSection
          data={{
            customers,
            customerSummary,
            products,
            productSummary,
            outstandingPayments
          }}
          loading={loading}
          dateRange={dateRange}
          period={period}
        />
      )}

      {activeTab === 'customers' && (
        <CustomersSection
          data={{
            customers,
            summary: customerSummary
          }}
          loading={loading}
          error={customerError}
          dateRange={dateRange}
          period={period}
        />
      )}

      {activeTab === 'products' && (
        <ProductsSection
          data={{
            products,
            summary: productSummary,
            allTransactions: productData?.allTransactions
          }}
          loading={loading}
          error={productError}
          dateRange={dateRange}
          period={period}
        />
      )}

      {activeTab === 'outstanding' && (
        <OutstandingSection
          data={{
            payments: outstandingPayments,
            customers
          }}
          loading={loading}
          dateRange={dateRange}
          period={period}
        />
      )}
    </div>
  )
}
```

---

## Testing Examples

### Unit Test Example

**File:** `src/app/(main)/sales/utils/salesCalculations.test.ts`

```typescript
import { describe, it, expect } from '@jest/globals'
import { calculateOutstandingPayments, hasOverduePayments } from './salesCalculations'
import { Customer } from '../types/sales'

describe('salesCalculations', () => {
  describe('calculateOutstandingPayments', () => {
    it('should return empty array for customers with no outstanding balance', () => {
      const customers: Customer[] = [
        {
          id: '1',
          name: 'Test Customer',
          totalSales: 1000,
          invoiceCount: 1,
          salesReceiptCount: 0,
          transactions: [
            {
              id: 'inv1',
              type: 'Invoice',
              docNumber: '1001',
              date: '2025-01-01',
              amount: 1000,
              balance: 0, // Fully paid
            },
          ],
        },
      ]

      const result = calculateOutstandingPayments(customers)
      expect(result).toEqual([])
    })

    it('should include invoices with outstanding balance', () => {
      const customers: Customer[] = [
        {
          id: '1',
          name: 'Test Customer',
          totalSales: 1000,
          invoiceCount: 1,
          salesReceiptCount: 0,
          transactions: [
            {
              id: 'inv1',
              type: 'Invoice',
              docNumber: '1001',
              date: '2025-01-01',
              amount: 1000,
              balance: 500,
            },
          ],
        },
      ]

      const result = calculateOutstandingPayments(customers)
      expect(result).toHaveLength(1)
      expect(result[0].balance).toBe(500)
      expect(result[0].customerName).toBe('Test Customer')
    })
  })

  describe('hasOverduePayments', () => {
    it('should return true for customer with overdue invoices', () => {
      const customer: Customer = {
        id: '1',
        name: 'Test Customer',
        totalSales: 1000,
        invoiceCount: 1,
        salesReceiptCount: 0,
        transactions: [
          {
            id: 'inv1',
            type: 'Invoice',
            docNumber: '1001',
            date: '2025-01-01',
            amount: 1000,
            balance: 500,
            dueDate: '2025-01-15', // Past due
          },
        ],
      }

      const result = hasOverduePayments(customer)
      expect(result).toBe(true)
    })
  })
})
```

---

## Migration Checklist

### Week 1: Foundation

- [ ] Create `/types/sales.ts` with all TypeScript interfaces
- [ ] Create `useTableSort` hook
- [ ] Create `useSelectionState` hook
- [ ] Create `salesCalculations.ts` utility
- [ ] Create `SortableTableHeader` component
- [ ] Create `SectionHeader` component
- [ ] Write unit tests for utilities and hooks

### Week 2-3: Sections

- [ ] Create `SalesHeader` component
- [ ] Create `SalesTabs` component
- [ ] Create `OverviewSection` (reuse existing charts/KPIs)
- [ ] Create `CustomersSection` (migrate existing table)
- [ ] Create `ProductsSection` (migrate existing table)
- [ ] Create `OutstandingSection` (migrate existing table)
- [ ] Write integration tests for each section

### Week 4: Integration

- [ ] Update `page.tsx` to use new architecture
- [ ] Add feature flag for gradual rollout
- [ ] Test all user flows
- [ ] Performance testing
- [ ] Accessibility testing
- [ ] Cross-browser testing

### Week 5: Launch & Cleanup

- [ ] Monitor metrics (performance, errors)
- [ ] Collect user feedback
- [ ] Remove old code
- [ ] Update documentation
- [ ] Celebrate!

---

**Document Version:** 1.0
**Last Updated:** 2025-12-26
**Companion to:** sales-page-redesign.md, sales-page-component-tree.md
