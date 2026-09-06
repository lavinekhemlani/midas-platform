'use client'

import { useState, useEffect, useMemo } from 'react'
import { Store, RefreshCw, Calendar, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useVendorAnalysis } from '@/hooks/useReportData'
import { useCurrency } from '@/contexts/CurrencyContext'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import PieChart from '@/components/charts/PieChart'
import { ReportChart } from '@/components/reports'
import { VendorSummaryTable, CategoryBreakdownStrip, TransactionTable } from '../components'

const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function VendorInsightsView() {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const welcomeContext = useWelcomeContextOptional()
  const { currency } = useCurrency()

  const [period, setPeriod] = useState('last_year')
  const [dateRange, setDateRange] = useState(() => {
    const year = new Date().getFullYear()
    return {
      start: formatDateLocal(new Date(year - 1, 0, 1)),
      end: formatDateLocal(new Date(year - 1, 11, 31)),
    }
  })
  const [selectedVendor, setSelectedVendor] = useState<any>(null)
  const [activeSection, setActiveSection] = useState<'overview' | 'transactions'>('overview')

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      sectionBg: isLight ? 'bg-white' : 'bg-white/[0.02]',
      rowAlt: isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]',
      rowHover: isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]',
    }),
    [isLight]
  )

  const handlePeriodChange = (value: string) => {
    setPeriod(value)
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()

    switch (value) {
      case 'this_month':
        setDateRange({
          start: formatDateLocal(new Date(year, month, 1)),
          end: formatDateLocal(today),
        })
        break
      case 'last_month':
        setDateRange({
          start: formatDateLocal(new Date(year, month - 1, 1)),
          end: formatDateLocal(new Date(year, month, 0)),
        })
        break
      case 'this_quarter':
        const quarter = Math.floor(month / 3)
        setDateRange({
          start: formatDateLocal(new Date(year, quarter * 3, 1)),
          end: formatDateLocal(today),
        })
        break
      case 'last_quarter':
        const lastQuarter = Math.floor(month / 3) - 1
        const qYear = lastQuarter < 0 ? year - 1 : year
        const qStart = lastQuarter < 0 ? 9 : lastQuarter * 3
        setDateRange({
          start: formatDateLocal(new Date(qYear, qStart, 1)),
          end: formatDateLocal(new Date(qYear, qStart + 3, 0)),
        })
        break
      case 'this_year':
        setDateRange({
          start: formatDateLocal(new Date(year, 0, 1)),
          end: formatDateLocal(today),
        })
        break
      case 'last_year':
        setDateRange({
          start: formatDateLocal(new Date(year - 1, 0, 1)),
          end: formatDateLocal(new Date(year - 1, 11, 31)),
        })
        break
    }
  }

  const { reportData, isLoading, error, refetch } = useVendorAnalysis(
    dateRange.start,
    dateRange.end,
    'quickbooks'
  )

  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !reportData)
  }, [isLoading, reportData, welcomeContext])

  const data = reportData?.data || {}
  const kpis = data.kpis || {}
  const vendors = data.vendorSummary || []
  const transactions = data.transactions || []

  // Calculate derived metrics
  const vendorsWithBalance = vendors.filter((v: any) => v.balance > 0).length
  const avgPerVendor = vendors.length > 0 ? (kpis.totalExpenses || 0) / vendors.length : 0
  const paidPercentage =
    (kpis.totalExpenses || 0) > 0 ? ((kpis.totalPaid || 0) / (kpis.totalExpenses || 0)) * 100 : 0

  if (isLoading && !reportData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          <p className={cn('text-sm', styles.textMuted)}>Loading vendor data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className={cn('text-sm', styles.textMuted)}>
            {error?.message || 'Failed to load vendor data'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Store className="w-5 h-5 text-amber-400" />
          <div>
            <h1 className={cn('text-lg font-semibold', styles.text)}>Vendors</h1>
            <p className={cn('text-xs font-mono', styles.textMuted)}>
              {reportData?.organizationName || 'Vendor Analysis'} · QuickBooks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn('text-xs', styles.textMuted)}>
            {dateRange.start && dateRange.end && (
              <>
                {new Date(dateRange.start + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                –{' '}
                {new Date(dateRange.end + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </>
            )}
          </span>
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className={cn('w-[140px] h-8 text-xs', styles.border)}>
              <Calendar className="w-3.5 h-3.5 mr-2 text-amber-400" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="this_quarter">This Quarter</SelectItem>
              <SelectItem value="last_quarter">Last Quarter</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="last_year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            disabled={isLoading}
            className="h-8"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Key metrics strip */}
      <div className={cn('flex flex-wrap gap-x-10 gap-y-4 py-5 border-b', styles.border)}>
        <div>
          <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
            Total Expenses
          </div>
          <div
            className={cn(
              'text-2xl font-mono font-semibold tabular-nums',
              isLight ? 'text-red-600' : 'text-red-400'
            )}
          >
            {formatCompactCurrency(kpis.totalExpenses || 0, 'USD')}
          </div>
        </div>
        <div>
          <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
            Paid
          </div>
          <div
            className={cn(
              'text-2xl font-mono font-semibold tabular-nums',
              isLight ? 'text-emerald-600' : 'text-emerald-400'
            )}
          >
            {formatCompactCurrency(kpis.totalPaid || 0, 'USD')}
          </div>
        </div>
        <div>
          <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
            Balance
          </div>
          <div
            className={cn(
              'text-2xl font-mono font-semibold tabular-nums',
              isLight ? 'text-amber-600' : 'text-amber-400'
            )}
          >
            {formatCompactCurrency(kpis.totalBalance || 0, 'USD')}
          </div>
        </div>
        <div>
          <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
            Vendors
          </div>
          <div className={cn('text-2xl font-mono font-semibold tabular-nums', styles.text)}>
            {vendors.length}
          </div>
        </div>
        <div>
          <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
            Transactions
          </div>
          <div className={cn('text-2xl font-mono font-semibold tabular-nums', styles.text)}>
            {kpis.totalTransactions || 0}
          </div>
        </div>
        <div>
          <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
            Avg/Vendor
          </div>
          <div className={cn('text-2xl font-mono font-semibold tabular-nums', styles.text)}>
            {formatCompactCurrency(avgPerVendor, 'USD')}
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className={cn('flex gap-4 border-b', styles.border)}>
        <button
          onClick={() => setActiveSection('overview')}
          className={cn(
            'pb-2 text-sm font-medium border-b-2 transition-colors',
            activeSection === 'overview'
              ? 'border-amber-500 text-amber-500'
              : cn('border-transparent', styles.textMuted, 'hover:text-amber-400')
          )}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveSection('transactions')}
          className={cn(
            'pb-2 text-sm font-medium border-b-2 transition-colors',
            activeSection === 'transactions'
              ? 'border-amber-500 text-amber-500'
              : cn('border-transparent', styles.textMuted, 'hover:text-amber-400')
          )}
        >
          Transactions
        </button>
      </div>

      {activeSection === 'overview' && (
        <>
          {/* Charts row - Trend and Category Pie */}
          <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8')}>
            {/* Monthly Trend */}
            <div>
              <h2 className={cn('text-sm font-semibold mb-4', styles.text)}>Monthly Trend</h2>
              <div className="h-[280px]">
                <ReportChart
                  type="area"
                  data={data.monthlyTrend || []}
                  dataKeys={[{ key: 'amount', color: '#f59e0b', name: 'Amount' }]}
                  xKey="month"
                  height={280}
                  formatTooltip={(value) => formatCurrency(value as number, { currency })}
                />
              </div>
            </div>

            {/* Category Breakdown - Keep donut chart */}
            <div>
              <h2 className={cn('text-sm font-semibold mb-4', styles.text)}>Category Breakdown</h2>
              <PieChart
                data={(() => {
                  const items = (data.categoryBreakdown || []).slice(0, 8)
                  const total = items.reduce((sum: number, i: any) => sum + i.value, 0) || 1
                  return items.map((item: any) => ({
                    name: item.name,
                    value: item.value,
                    percentage: (item.value / total) * 100,
                  }))
                })()}
                height={280}
                formatLabel={(value) => formatCurrency(value as number, { currency })}
                showActiveShape={true}
              />
            </div>
          </div>

          {/* Category strip below charts */}
          <section className={cn('pt-6 border-t', styles.border)}>
            <h2 className={cn('text-sm font-semibold mb-4', styles.text)}>Spending by Category</h2>
            <CategoryBreakdownStrip
              data={data.categoryBreakdown || []}
              isLoading={isLoading}
              totalAmount={kpis.totalExpenses || 0}
            />
          </section>

          {/* Vendor Summary Table */}
          <section className={cn('pt-6 border-t', styles.border)}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn('text-sm font-semibold', styles.text)}>Vendor Summary</h2>
              <span className={cn('text-xs font-mono', styles.textMuted)}>
                {vendors.length} vendors
              </span>
            </div>
            <VendorSummaryTable
              vendors={vendors}
              isLoading={isLoading}
              selectedVendor={selectedVendor}
              onSelectVendor={setSelectedVendor}
            />
          </section>
        </>
      )}

      {activeSection === 'transactions' && (
        <>
          {/* Transaction Distribution Charts */}
          <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8')}>
            {/* Type Distribution - Keep donut chart */}
            <div>
              <h2 className={cn('text-sm font-semibold mb-4', styles.text)}>By Type</h2>
              <PieChart
                data={
                  data.transactionTypeBreakdown?.map((item: any) => {
                    const total =
                      data.transactionTypeBreakdown?.reduce(
                        (sum: number, i: any) => sum + i.count,
                        0
                      ) || 1
                    return {
                      name: item.type,
                      value: item.count,
                      percentage: (item.count / total) * 100,
                    }
                  }) || []
                }
                height={280}
                formatLabel={(value) => `${value} txns`}
                showActiveShape={true}
              />
            </div>

            {/* Status Distribution - Keep donut chart */}
            <div>
              <h2 className={cn('text-sm font-semibold mb-4', styles.text)}>By Status</h2>
              <PieChart
                data={(() => {
                  const statusMap = new Map<string, number>()
                  transactions.forEach((t: any) => {
                    const status = t.status || 'Open'
                    statusMap.set(status, (statusMap.get(status) || 0) + 1)
                  })
                  const entries = Array.from(statusMap.entries())
                  const total = entries.reduce((sum, [, count]) => sum + count, 0) || 1
                  return entries.map(([status, count]) => ({
                    name: status,
                    value: count,
                    percentage: (count / total) * 100,
                  }))
                })()}
                height={280}
                formatLabel={(value) => `${value} txns`}
                showActiveShape={true}
              />
            </div>
          </div>

          {/* Transaction Table */}
          <section className={cn('pt-6 border-t', styles.border)}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn('text-sm font-semibold', styles.text)}>All Transactions</h2>
              <span className={cn('text-xs font-mono', styles.textMuted)}>
                {transactions.length} transactions
              </span>
            </div>
            <TransactionTable transactions={transactions} isLoading={isLoading} />
          </section>
        </>
      )}
    </div>
  )
}
