'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { Card, CardContent } from '@/components/ui/card'
import { useSalesCustomer, useSalesProduct } from '@/hooks/useSalesData'
import { useSalesContext } from '@/contexts/SalesContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { getDateRangeForPeriod } from '@/lib/report-utils'
import { useCompanyMetadata } from '@/hooks/useCompanyMetadata'
import { AIAnalysisCard } from '@/components/ai-analysis'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useOutstandingPayments } from '@/hooks/useOutstandingPayments'
import { SalesHeader } from './components/header'
import { OverviewSection } from './components/overview'
import { CustomersSection } from './components/customers'
import { ProductsSection } from './components/products'
import { OutstandingSection } from './components/outstanding'
import { calculateOutstandingPayments } from './utils/sortUtils'
import type {
  SalesTab,
  Customer,
  Product,
  CustomerSummary,
  ProductSummary,
  OutstandingPayment,
} from './types'

export default function SalesPage() {
  const { period, dateRange, setPeriod, setDateRange } = useSalesContext()
  const { currency } = useCurrency()
  const { data: companyData } = useCompanyMetadata()
  const searchParams = useSearchParams()

  // Get tab from URL parameter, falling back to local state
  const tabParam = searchParams.get('tab') as SalesTab | null
  const validTabs: SalesTab[] = ['overview', 'customers', 'products', 'outstanding']

  const [localTab, setActiveTab] = useState<SalesTab>('overview')
  const activeTab: SalesTab = tabParam && validTabs.includes(tabParam) ? tabParam : localTab

  // Fetch data - explicitly specify quickbooks provider for QB routes
  const {
    salesData: customerData,
    isLoading: customerLoading,
    error: customerError,
  } = useSalesCustomer(dateRange.start, dateRange.end, 'quickbooks')
  const {
    salesData: productData,
    isLoading: productLoading,
    error: productError,
  } = useSalesProduct(period, dateRange.start, dateRange.end, 'quickbooks')

  // Fetch AR aging data for accurate outstanding totals (not date-filtered)
  const { outstandingData: arData } = useOutstandingPayments()

  const loading = customerLoading || productLoading
  const error = customerError || productError

  // Report loading state to WelcomeContext for coordinated loading UI
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(loading && !customerData && !productData)
  }, [loading, customerData, productData, welcomeContext])

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
    const range = getDateRangeForPeriod(newPeriod)
    setDateRange(range)
  }

  // Parse data
  const customers: Customer[] = customerData?.salesByCustomer || []
  const customerSummary: CustomerSummary = customerData?.summary || {
    totalSales: 0,
    customerCount: 0,
    totalTransactions: 0,
  }
  const products: Product[] = productData?.salesByProduct || []
  const productSummary: ProductSummary = productData?.summary || {
    totalSales: 0,
    productCount: 0,
    totalQuantity: 0,
    totalTransactions: 0,
  }

  // Calculate outstanding payments from date-filtered sales data (for table display)
  const outstandingPayments: OutstandingPayment[] = useMemo(
    () => calculateOutstandingPayments(customers),
    [customers]
  )

  // Use AR aging data for accurate outstanding totals (not date-filtered)
  // Falls back to calculated values if AR aging data isn't available yet
  const totalOutstanding =
    arData?.totalOutstanding ?? outstandingPayments.reduce((sum, p) => sum + p.balance, 0)
  const outstandingCount = arData?.numberOfCustomers ?? outstandingPayments.length

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

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              Error:{' '}
              {typeof error === 'string' ? error : error?.message || 'An unknown error occurred'}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

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
    <div className="@container space-y-4">
      {/* Header with tabs */}
      <SalesHeader
        period={period}
        dateRange={dateRange}
        activeTab={activeTab}
        outstandingCount={outstandingCount}
        onPeriodChange={handlePeriodChange}
        onTabChange={setActiveTab}
      />

      {/* Tab Content with View Transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          {activeTab === 'overview' && (
            <>
              <OverviewSection
                customers={customers}
                products={products}
                customerSummary={customerSummary}
                productSummary={productSummary}
                totalOutstanding={totalOutstanding}
                outstandingCount={outstandingCount}
                currency={currency}
                onViewCustomers={() => setActiveTab('customers')}
                onViewProducts={() => setActiveTab('products')}
                onViewOutstanding={() => setActiveTab('outstanding')}
              />

              {/* AI Analysis Section */}
              <div className="mt-6">
                <AIAnalysisCard
                  pageType="sales"
                  data={{
                    metrics: {
                      totalSales: customerSummary.totalSales || 0,
                      transactionCount: customerSummary.totalTransactions || 0,
                      averageDealSize:
                        customerSummary.totalTransactions > 0
                          ? (customerSummary.totalSales || 0) / customerSummary.totalTransactions
                          : 0,
                      topCustomers: customers.slice(0, 5).map((c) => {
                        const totalTransactions = (c.invoiceCount || 0) + (c.salesReceiptCount || 0)
                        return {
                          name: c.name,
                          sales: c.totalSales,
                          percentage:
                            customerSummary.totalSales > 0
                              ? ((c.totalSales / customerSummary.totalSales) * 100).toFixed(1)
                              : 0,
                          transactionCount: totalTransactions,
                        }
                      }),
                    },
                    customerData: {
                      count: customerSummary.customerCount || 0,
                      topCustomers: customers.slice(0, 10),
                      outstandingBalance: totalOutstanding,
                    },
                    productData: {
                      count: productSummary.productCount || 0,
                      topProducts: products.slice(0, 10).map((p) => ({
                        name: p.name,
                        type: p.type,
                        total: p.total,
                        quantity: p.quantity || 0,
                        avgUnitPrice: p.avgUnitPrice || 0,
                        transactionCount: p.transactionCount || 0,
                      })),
                      totalQuantity: productSummary.totalQuantity || 0,
                    },
                    previousPeriod: {
                      previousSales: 0,
                      growthRate: 0,
                    },
                  }}
                  dateRange={dateRange}
                  context={{
                    period,
                    companyName: companyData?.identity?.name,
                    topCustomerPercentage:
                      customers.length > 0 && customerSummary.totalSales > 0
                        ? ((customers[0].totalSales / customerSummary.totalSales) * 100).toFixed(1)
                        : 0,
                  }}
                  autoGenerate={true}
                  dataLoadingStates={{
                    customer: customerLoading,
                    product: productLoading,
                  }}
                />
              </div>
            </>
          )}

          {activeTab === 'customers' && (
            <CustomersSection
              customers={customers}
              customerSummary={customerSummary}
              currency={currency}
            />
          )}

          {activeTab === 'products' && (
            <ProductsSection
              products={products}
              productSummary={productSummary}
              currency={currency}
            />
          )}

          {activeTab === 'outstanding' && (
            <OutstandingSection
              outstandingPayments={outstandingPayments}
              customers={customers}
              currency={currency}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
