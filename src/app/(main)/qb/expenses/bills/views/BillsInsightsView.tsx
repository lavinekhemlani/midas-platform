'use client'

import { useState, useEffect, useMemo } from 'react'
import { FileText, RefreshCw, Calendar, AlertCircle } from 'lucide-react'
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
import { useBills } from '@/hooks/useReportData'
import { useSession } from '@/hooks/useSession'
import { useCurrency } from '@/contexts/CurrencyContext'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import PieChart from '@/components/charts/PieChart'
import { ReportChart } from '@/components/reports'
import { BillsTable, UnpaidBillsTable, AgingStrip, StatusBreakdownStrip } from '../components'

const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function BillsInsightsView() {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const welcomeContext = useWelcomeContextOptional()
  const { currency } = useCurrency()
  const { organization } = useSession()

  const [period, setPeriod] = useState('last_year')
  const [dateRange, setDateRange] = useState(() => {
    const year = new Date().getFullYear()
    return {
      start: formatDateLocal(new Date(year - 1, 0, 1)),
      end: formatDateLocal(new Date(year - 1, 11, 31)),
    }
  })
  const [selectedBill, setSelectedBill] = useState<any>(null)

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      sectionBg: isLight ? 'bg-white' : 'bg-white/[0.02]',
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

  const { reportData, isLoading, error, refetch } = useBills(
    dateRange.start,
    dateRange.end,
    'bills',
    organization?.organization_id
  )

  const { reportData: agingData, isLoading: isLoadingAging } = useBills(
    dateRange.start,
    dateRange.end,
    'aging',
    organization?.organization_id
  )

  useEffect(() => {
    welcomeContext?.setDataLoading((isLoading && !reportData) || isLoadingAging)
  }, [isLoading, reportData, isLoadingAging, welcomeContext])

  const data = reportData?.data || {}
  const kpis = data.kpis || {}
  const bills = data.bills || []

  // Calculate derived values
  const totalBills = kpis.totalBills || 0
  const paidCount = kpis.paidCount || 0
  const unpaidCount = kpis.unpaidCount || 0
  const overdueCount = kpis.overdueCount || 0
  const totalAmount = kpis.totalAmount || 0
  const totalPaid = kpis.totalPaid || 0
  const totalUnpaid = kpis.totalUnpaid || 0
  const overdueAmount = kpis.overdueAmount || 0

  const paidPct = totalBills > 0 ? (paidCount / totalBills) * 100 : 0
  const unpaidPct = totalBills > 0 ? (unpaidCount / totalBills) * 100 : 0
  const overduePct = totalBills > 0 ? (overdueCount / totalBills) * 100 : 0

  if ((isLoading && !reportData) || isLoadingAging) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          <p className={cn('text-sm', styles.textMuted)}>Loading bills...</p>
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
            {error?.message || 'Failed to load bills data'}
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
          <FileText className="w-5 h-5 text-amber-400" />
          <div>
            <h1 className={cn('text-lg font-semibold', styles.text)}>Bills</h1>
            <p className={cn('text-xs font-mono', styles.textMuted)}>
              {reportData?.organizationName || 'Accounts Payable'} · QuickBooks
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
            Total Bills
          </div>
          <div className={cn('text-2xl font-mono font-semibold tabular-nums', styles.text)}>
            {totalBills}
          </div>
        </div>
        <div>
          <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
            Total Amount
          </div>
          <div
            className={cn(
              'text-2xl font-mono font-semibold tabular-nums',
              isLight ? 'text-blue-600' : 'text-blue-400'
            )}
          >
            {formatCompactCurrency(totalAmount, 'USD')}
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
            {formatCompactCurrency(totalPaid, 'USD')}
          </div>
        </div>
        <div>
          <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
            Unpaid
          </div>
          <div
            className={cn(
              'text-2xl font-mono font-semibold tabular-nums',
              isLight ? 'text-amber-600' : 'text-amber-400'
            )}
          >
            {formatCompactCurrency(totalUnpaid, 'USD')}
          </div>
        </div>
        <div>
          <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
            Overdue
          </div>
          <div
            className={cn(
              'text-2xl font-mono font-semibold tabular-nums',
              isLight ? 'text-red-600' : 'text-red-400'
            )}
          >
            {formatCompactCurrency(overdueAmount, 'USD')}
          </div>
        </div>
        <div>
          <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
            Paid %
          </div>
          <div className={cn('text-2xl font-mono font-semibold tabular-nums', styles.text)}>
            {paidPct.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Unpaid Bills - Priority section */}
      {agingData?.data?.bills && agingData.data.bills.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className={cn('text-sm font-semibold', styles.text)}>Unpaid Bills</h2>
            <span className={cn('text-xs font-mono', styles.textMuted)}>
              {agingData.data.bills.length} bills ·{' '}
              {formatCompactCurrency(
                agingData.data.bills.reduce((sum: number, b: any) => sum + (b.balance || 0), 0),
                'USD'
              )}
            </span>
          </div>
          <UnpaidBillsTable bills={agingData.data.bills} isLoading={isLoadingAging} />
        </section>
      )}

      {/* Aging Distribution */}
      {agingData?.data?.agingDistribution && agingData.data.agingDistribution.length > 0 && (
        <section className={cn('pt-6 border-t', styles.border)}>
          <h2 className={cn('text-sm font-semibold mb-4', styles.text)}>Aging Distribution</h2>
          <AgingStrip
            data={agingData.data.agingDistribution}
            isLoading={isLoadingAging}
            totalUnpaid={agingData.data.bills?.length || 0}
          />
        </section>
      )}

      {/* Status Breakdown Strip */}
      <section className={cn('pt-6 border-t', styles.border)}>
        <h2 className={cn('text-sm font-semibold mb-4', styles.text)}>Status Breakdown</h2>
        <StatusBreakdownStrip
          paidCount={paidCount}
          unpaidCount={unpaidCount}
          overdueCount={overdueCount}
          totalBills={totalBills}
          paidAmount={totalPaid}
          unpaidAmount={totalUnpaid}
          overdueAmount={overdueAmount}
          totalAmount={totalAmount}
          isLoading={isLoading}
        />
      </section>

      {/* Charts row */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6 border-t', styles.border)}>
        {/* Status Distribution Pie - Keep donut chart */}
        <div>
          <h2 className={cn('text-sm font-semibold mb-4', styles.text)}>Status Distribution</h2>
          <PieChart
            data={(data.statusDistribution || []).map((item: any) => {
              const total =
                data.statusDistribution?.reduce((sum: number, i: any) => sum + i.count, 0) || 1
              return {
                name: item.status,
                value: item.count,
                percentage: (item.count / total) * 100,
              }
            })}
            height={280}
            formatLabel={(value) => `${value} bills`}
            showActiveShape={true}
          />
        </div>

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
      </div>

      {/* All Bills Table */}
      <section className={cn('pt-6 border-t', styles.border)}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={cn('text-sm font-semibold', styles.text)}>All Bills</h2>
          <span className={cn('text-xs font-mono', styles.textMuted)}>{bills.length} bills</span>
        </div>
        <BillsTable
          bills={bills}
          isLoading={isLoading}
          selectedBill={selectedBill}
          onSelectBill={setSelectedBill}
        />
      </section>
    </div>
  )
}
