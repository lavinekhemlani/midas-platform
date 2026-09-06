'use client'

import { useState, useEffect, useMemo } from 'react'
import { BookOpen, RefreshCw, Calendar, AlertCircle } from 'lucide-react'
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
import { useJournalReport } from '@/hooks/useReportData'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { JournalEntryTable, TransactionTypeStrip, AccountActivityStrip } from '../components'

// Helper function to format date to YYYY-MM-DD without timezone issues
const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function JournalInsightsView() {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const welcomeContext = useWelcomeContextOptional()

  const [period, setPeriod] = useState('last_year')
  const [dateRange, setDateRange] = useState(() => {
    const year = new Date().getFullYear()
    return {
      start: formatDateLocal(new Date(year - 1, 0, 1)),
      end: formatDateLocal(new Date(year - 1, 11, 31)),
    }
  })
  const [selectedEntry, setSelectedEntry] = useState<any>(null)

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

  const { reportData, isLoading, error, refetch } = useJournalReport(
    dateRange.start,
    dateRange.end,
    'quickbooks'
  )

  // Report loading state to WelcomeContext
  useEffect(() => {
    const hasData = !!reportData
    welcomeContext?.setDataLoading(isLoading && !hasData)
  }, [welcomeContext, isLoading, reportData])

  const data = reportData?.data || {}
  const entries = data.entries || []
  const kpis = data.kpis || {}

  // Calculate metrics
  const isBalanced = Math.abs((kpis.totalDebits || 0) - (kpis.totalCredits || 0)) < 0.01
  const totalVolume = (kpis.totalDebits || 0) + (kpis.totalCredits || 0)
  const avgPerEntry = kpis.totalEntries > 0 ? totalVolume / 2 / kpis.totalEntries : 0
  const daysInPeriod = dateRange.start
    ? Math.ceil(
        (new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0
  const entriesPerDay = daysInPeriod > 0 ? (kpis.totalEntries || 0) / daysInPeriod : 0

  // Aggregate transaction types from entries
  const transactionTypes = useMemo(() => {
    const typeMap = new Map<string, { count: number; debit: number; credit: number }>()
    entries.forEach((entry: any) => {
      const type = entry.transactionType || 'Other'
      const existing = typeMap.get(type) || { count: 0, debit: 0, credit: 0 }
      typeMap.set(type, {
        count: existing.count + 1,
        debit: existing.debit + (entry.debit || 0),
        credit: existing.credit + (entry.credit || 0),
      })
    })
    return Array.from(typeMap.entries())
      .map(([type, data]) => ({
        type,
        count: data.count,
        total: data.debit + data.credit,
        percentage: totalVolume > 0 ? ((data.debit + data.credit) / (totalVolume / 2)) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
  }, [entries, totalVolume])

  // Aggregate account activity from entries
  const accountActivity = useMemo(() => {
    const accountMap = new Map<string, { debit: number; credit: number; count: number }>()
    entries.forEach((entry: any) => {
      const account = entry.account || 'Unknown'
      const existing = accountMap.get(account) || { debit: 0, credit: 0, count: 0 }
      accountMap.set(account, {
        debit: existing.debit + (entry.debit || 0),
        credit: existing.credit + (entry.credit || 0),
        count: existing.count + 1,
      })
    })
    return Array.from(accountMap.entries())
      .map(([account, data]) => ({
        account,
        debit: data.debit,
        credit: data.credit,
        total: data.debit + data.credit,
        count: data.count,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [entries])

  if (isLoading && !reportData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          <p className="text-sm theme-text-secondary">Loading journal entries...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-sm theme-text-secondary">
            {error?.message || 'Failed to load journal data'}
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
          <BookOpen className="w-5 h-5 text-amber-400" />
          <div>
            <h1 className={cn('text-lg font-semibold', styles.text)}>Journal</h1>
            <p className={cn('text-xs font-mono', styles.textMuted)}>
              {reportData?.organizationName || 'General Ledger'} · QuickBooks
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

      {/* Key metrics strip + Transaction Types side by side */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 py-5 border-b', styles.border)}>
        {/* Left: Key Metrics */}
        <div
          className={cn('flex flex-wrap gap-x-10 gap-y-4 @3xl:border-r @3xl:pr-8', styles.border)}
        >
          <div>
            <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
              Entries
            </div>
            <div className={cn('text-2xl font-mono font-semibold tabular-nums', styles.text)}>
              {(kpis.totalEntries || 0).toLocaleString()}
            </div>
          </div>
          <div>
            <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
              Volume
            </div>
            <div className={cn('text-2xl font-mono font-semibold tabular-nums', styles.text)}>
              {formatCompactCurrency(totalVolume / 2, 'USD')}
            </div>
          </div>
          <div>
            <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
              Debits
            </div>
            <div
              className={cn(
                'text-2xl font-mono font-semibold tabular-nums',
                isLight ? 'text-emerald-600' : 'text-emerald-400'
              )}
            >
              {formatCompactCurrency(kpis.totalDebits || 0, 'USD')}
            </div>
          </div>
          <div>
            <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
              Credits
            </div>
            <div
              className={cn(
                'text-2xl font-mono font-semibold tabular-nums',
                isLight ? 'text-blue-600' : 'text-blue-400'
              )}
            >
              {formatCompactCurrency(kpis.totalCredits || 0, 'USD')}
            </div>
          </div>
          <div>
            <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
              Balance
            </div>
            <div
              className={cn(
                'text-2xl font-mono font-semibold tabular-nums',
                isBalanced
                  ? isLight
                    ? 'text-emerald-600'
                    : 'text-emerald-400'
                  : isLight
                    ? 'text-red-600'
                    : 'text-red-400'
              )}
            >
              {isBalanced
                ? '✓'
                : formatCompactCurrency(
                    Math.abs((kpis.totalDebits || 0) - (kpis.totalCredits || 0)),
                    'USD'
                  )}
            </div>
          </div>
        </div>

        {/* Right: Transaction Types */}
        <div>
          <h2 className={cn('text-sm font-semibold mb-3', styles.text)}>Transaction Types</h2>
          <TransactionTypeStrip
            data={transactionTypes}
            isLoading={isLoading}
            totalEntries={kpis.totalEntries || 0}
          />
        </div>
      </div>

      {/* Top Accounts section */}
      <section className="pt-6">
        <h2 className={cn('text-sm font-semibold mb-4', styles.text)}>Top Accounts</h2>
        <AccountActivityStrip
          data={accountActivity}
          isLoading={isLoading}
          totalVolume={totalVolume / 2}
        />
      </section>

      {/* Journal Entries Table */}
      <section className={cn('pt-6 border-t', styles.border)}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={cn('text-sm font-semibold', styles.text)}>Journal Entries</h2>
          <span className={cn('text-xs font-mono', styles.textMuted)}>
            {entries.length.toLocaleString()} lines
          </span>
        </div>
        <JournalEntryTable
          entries={entries}
          isLoading={isLoading}
          selectedEntry={selectedEntry}
          onSelectEntry={setSelectedEntry}
        />
      </section>
    </div>
  )
}
