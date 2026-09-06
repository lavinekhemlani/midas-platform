'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Calendar,
  FileText,
  X,
  ChevronRight,
  BookOpen,
  BarChart3,
  TrendingUp,
  Activity,
  Layers,
  Scale,
  Hash,
  CircleDollarSign,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useJournalReport } from '@/hooks/useReportData'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { cn } from '@/lib/utils'

// Estimated row height for virtualization
const ROW_HEIGHT = 52

// Virtualized Journal Table Component
interface JournalEntry {
  id?: string
  date: string
  transactionType: string
  account: string
  memo?: string
  debit?: number
  credit?: number
  num?: string
}

interface VirtualizedJournalTableProps {
  entries: JournalEntry[]
  onSelectEntry: (entry: JournalEntry) => void
}

function VirtualizedJournalTable({ entries, onSelectEntry }: VirtualizedJournalTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  })

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Scrollable container with sticky header inside */}
      <div ref={parentRef} className="flex-1 overflow-auto styled-scrollbar">
        <table className="w-full" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 60 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 'auto' }} />
            <col style={{ width: 200 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 100 }} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700">
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-50">
                #
              </th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-50">
                Date
              </th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-50">
                Type
              </th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-50">
                Account
              </th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-50">
                Memo
              </th>
              <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-50">
                Debit
              </th>
              <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-50">
                Credit
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Spacer row for virtualization offset */}
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    height: rowVirtualizer.getVirtualItems()[0]?.start ?? 0,
                    padding: 0,
                    border: 'none',
                  }}
                />
              </tr>
            )}
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const entry = entries[virtualRow.index]
              const index = virtualRow.index
              return (
                <tr
                  key={entry.id || index}
                  data-index={index}
                  className="group hover:bg-amber-500/5 cursor-pointer border-b border-gray-200/5"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => onSelectEntry(entry)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/20 group-hover:from-amber-500/30 group-hover:to-amber-600/30 transition-all">
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                        {index + 1}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm theme-text-secondary">{entry.date}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs bg-gray-500/10 border-gray-500/20">
                      {entry.transactionType}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm theme-text-primary group-hover:text-amber-400 transition-colors truncate">
                        {entry.account}
                      </span>
                      <ChevronRight className="h-4 w-4 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm theme-text-secondary truncate block">
                      {entry.memo || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-semibold text-theme-green">
                      {entry.debit ? `$${entry.debit.toLocaleString()}` : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-semibold text-theme-blue">
                      {entry.credit ? `$${entry.credit.toLocaleString()}` : '-'}
                    </span>
                  </td>
                </tr>
              )
            })}
            {/* Spacer row for remaining content */}
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    height:
                      rowVirtualizer.getTotalSize() -
                      (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]
                        ?.end ?? 0),
                    padding: 0,
                    border: 'none',
                  }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Helper function to format date to YYYY-MM-DD without timezone issues
const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function JournalReportPage() {
  const [period, setPeriod] = useState('last_year')
  const [dateRange, setDateRange] = useState({
    start: '',
    end: '',
  })
  const [selectedEntry, setSelectedEntry] = useState<any>(null)

  // Initialize date range on mount
  useEffect(() => {
    handlePeriodChange('last_year')
  }, [])

  // Fetch data from API
  const { reportData, isLoading, error, refetch } = useJournalReport(dateRange.start, dateRange.end)

  // Report loading state to WelcomeContext for coordinated loading UI
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !reportData)
  }, [isLoading, reportData, welcomeContext])

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

  // Extract data from API response
  const data = reportData?.data || {}
  const isBalanced = Math.abs((data.kpis?.totalDebits || 0) - (data.kpis?.totalCredits || 0)) < 0.01

  // Calculate derived metrics
  const totalVolume = (data.kpis?.totalDebits || 0) + (data.kpis?.totalCredits || 0)
  const avgTransactionSize =
    data.kpis?.totalTransactions > 0 ? totalVolume / 2 / data.kpis.totalTransactions : 0
  const debitPercentage =
    totalVolume > 0 ? ((data.kpis?.totalDebits || 0) / (totalVolume / 2)) * 100 : 50

  // Loading state
  if (isLoading && !reportData) {
    return (
      <div className="@container space-y-4">
        {/* Header skeleton */}
        <div className="flex items-center justify-between gap-4">
          <span className="text-xl theme-text-secondary">
            Complete record of all general ledger transactions
          </span>
          <div className="flex items-center gap-3">
            <span className="inline-block w-32 h-4 bg-gray-700/30 animate-pulse" />
            <Select value={period} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-[160px] h-9 glass-luxury-card border-amber-500/20 hover:border-amber-500/40 transition-all duration-200 text-sm">
                <Calendar className="w-3.5 h-3.5 mr-2 text-amber-500" />
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent className="glass-luxury-card">
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="this_quarter">This Quarter</SelectItem>
                <SelectItem value="last_quarter">Last Quarter</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
                <SelectItem value="last_year">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
            <p className="text-sm theme-text-secondary">Generating report...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>Failed to load report data. Please try again later.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="@container space-y-4">
      {/* Header - matching reports page style */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-xl theme-text-secondary">
          Complete record of all general ledger transactions
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm theme-text-secondary whitespace-nowrap">
            {dateRange.start && dateRange.end && (
              <span className="flex items-center gap-2">
                <span className="font-serif italic text-[0.9rem] theme-text-primary">from</span>
                <span>
                  {new Date(
                    (reportData?.fromDate || dateRange.start) + 'T00:00:00'
                  ).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="font-serif italic text-[0.9rem] theme-text-primary">to</span>
                <span>
                  {new Date((reportData?.toDate || dateRange.end) + 'T00:00:00').toLocaleDateString(
                    'en-US',
                    {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    }
                  )}
                </span>
              </span>
            )}
          </span>
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[160px] h-9 glass-luxury-card border-amber-500/20 hover:border-amber-500/40 transition-all duration-200 text-sm">
              <Calendar className="w-3.5 h-3.5 mr-2 text-amber-500" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent className="glass-luxury-card">
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="this_quarter">This Quarter</SelectItem>
              <SelectItem value="last_quarter">Last Quarter</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="last_year">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
            <p className="text-sm theme-text-secondary">Generating report...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards Grid - Clean 3-card layout */}
          <div className="grid grid-cols-1 @2xl:grid-cols-3 gap-3">
            {/* Journal Activity Card */}
            <Card className="glass-luxury-card h-full flex flex-col gap-0 border border-gray-200/10 !pt-0">
              <CardHeader className="px-4 pt-5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg text-amber-400">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-lg font-bold theme-text-primary">
                    Journal Activity
                  </CardTitle>
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-4 flex-1 flex flex-col justify-center">
                <div className="space-y-4">
                  {/* Primary metric - Total Entries */}
                  <div className="text-center py-2">
                    <div className="text-4xl font-bold text-amber-400 tabular-nums">
                      {(data.kpis?.totalEntries || 0).toLocaleString()}
                    </div>
                    <div className="text-sm theme-text-secondary mt-1">journal entries</div>
                  </div>

                  {/* Secondary metrics */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200/10">
                    <div className="text-center">
                      <div className="text-xl font-semibold theme-text-primary tabular-nums">
                        {(data.kpis?.totalTransactions || 0).toLocaleString()}
                      </div>
                      <div className="text-xs theme-text-secondary">transaction lines</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-semibold theme-text-primary tabular-nums">
                        {data.kpis?.totalEntries > 0
                          ? (data.kpis?.totalTransactions / data.kpis?.totalEntries).toFixed(1)
                          : '0'}
                      </div>
                      <div className="text-xs theme-text-secondary">lines per entry</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Debit/Credit Balance Card */}
            <Card className="glass-luxury-card h-full flex flex-col gap-0 border border-gray-200/10 !pt-0">
              <CardHeader className="px-4 pt-5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg text-theme-green">
                    <Scale className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-lg font-bold theme-text-primary flex-1">
                    Balance Check
                  </CardTitle>
                  <div
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                      isBalanced
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                    )}
                  >
                    {isBalanced ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    {isBalanced ? 'Balanced' : 'Unbalanced'}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-4 flex-1 flex flex-col justify-center">
                <div className="space-y-3">
                  {/* Debit row */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm theme-text-secondary">Debits</span>
                    </div>
                    <span className="text-lg font-bold text-emerald-400 tabular-nums">
                      $
                      {(data.kpis?.totalDebits || 0).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>

                  {/* Credit row */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                    <div className="flex items-center gap-2">
                      <ArrowDownRight className="w-4 h-4 text-blue-400" />
                      <span className="text-sm theme-text-secondary">Credits</span>
                    </div>
                    <span className="text-lg font-bold text-blue-400 tabular-nums">
                      $
                      {(data.kpis?.totalCredits || 0).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>

                  {/* Difference row */}
                  <div
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border',
                      isBalanced ? 'border-gray-200/10' : 'bg-red-500/5 border-red-500/10'
                    )}
                  >
                    <span className="text-sm theme-text-secondary">Difference</span>
                    <span
                      className={cn(
                        'text-lg font-bold tabular-nums',
                        isBalanced ? 'text-theme-green' : 'text-red-400'
                      )}
                    >
                      {isBalanced
                        ? '$0'
                        : `$${Math.abs((data.kpis?.totalDebits || 0) - (data.kpis?.totalCredits || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Volume & Period Card */}
            <Card className="glass-luxury-card h-full flex flex-col gap-0 border border-gray-200/10 !pt-0">
              <CardHeader className="px-4 pt-5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg text-theme-blue">
                    <CircleDollarSign className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-lg font-bold theme-text-primary">
                    Volume & Period
                  </CardTitle>
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-4 flex-1 flex flex-col justify-center">
                <div className="space-y-4">
                  {/* Primary metric - Total Volume */}
                  <div className="text-center py-2">
                    <div className="text-4xl font-bold text-theme-blue tabular-nums">
                      ${(totalVolume / 2).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-sm theme-text-secondary mt-1">total volume</div>
                  </div>

                  {/* Secondary metrics */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200/10">
                    <div className="text-center">
                      <div className="text-xl font-semibold theme-text-primary tabular-nums">
                        {dateRange.start
                          ? Math.ceil(
                              (new Date(dateRange.end).getTime() -
                                new Date(dateRange.start).getTime()) /
                                (1000 * 60 * 60 * 24)
                            )
                          : 0}
                      </div>
                      <div className="text-xs theme-text-secondary">days in period</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-semibold theme-text-primary tabular-nums">
                        $
                        {avgTransactionSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-xs theme-text-secondary">avg per line</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Journal Entries Table Section */}
          <div className="flex gap-4">
            {/* Table Container */}
            <div
              className={cn(
                'transition-all duration-300',
                selectedEntry ? '@5xl:w-2/3 @5xl:block hidden' : 'w-full'
              )}
            >
              <Card className="glass-luxury-card border border-gray-200/10 overflow-hidden">
                <div className="h-[600px] flex flex-col">
                  <VirtualizedJournalTable
                    entries={data.entries || []}
                    onSelectEntry={setSelectedEntry}
                  />
                </div>
              </Card>
            </div>

            {/* Entry Detail Side Panel */}
            {selectedEntry && (
              <div className="@5xl:w-1/3 w-full animate-in slide-in-from-right duration-300">
                <Card className="glass-luxury-card border border-gray-200/10 h-[600px] flex flex-col">
                  <CardHeader className="px-4 pt-4 pb-3 border-b border-gray-200/10 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-bold theme-text-primary">
                          {selectedEntry.account}
                        </CardTitle>
                        <p className="text-xs theme-text-secondary mt-1">Journal Entry Details</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedEntry(null)}
                        className="h-8 w-8 p-0 hover:bg-gray-500/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pt-4 flex-1 overflow-y-auto styled-scrollbar space-y-6">
                    {/* Entry Information */}
                    <div>
                      <h3 className="text-sm font-semibold theme-text-primary mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-400" />
                        Entry Information
                      </h3>
                      <div className="space-y-3 pl-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-xs theme-text-secondary block mb-1">Date</span>
                            <span className="font-medium theme-text-primary text-sm">
                              {selectedEntry.date}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs theme-text-secondary block mb-1">
                              Transaction Type
                            </span>
                            <Badge
                              variant="outline"
                              className="text-xs bg-gray-500/10 border-gray-500/20"
                            >
                              {selectedEntry.transactionType}
                            </Badge>
                          </div>
                        </div>
                        {selectedEntry.num && (
                          <div>
                            <span className="text-xs theme-text-secondary block mb-1">
                              Document Number
                            </span>
                            <span className="font-medium theme-text-primary text-sm">
                              {selectedEntry.num}
                            </span>
                          </div>
                        )}
                        {selectedEntry.memo && (
                          <div>
                            <span className="text-xs theme-text-secondary block mb-1">Memo</span>
                            <span className="theme-text-primary text-sm">{selectedEntry.memo}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Amount Details */}
                    <div>
                      <h3 className="text-sm font-semibold theme-text-primary mb-3 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-theme-blue" />
                        Amount Details
                      </h3>
                      <div className="space-y-3 pl-6">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20">
                            <span className="text-xs theme-text-secondary block mb-2">Debit</span>
                            <div className="text-2xl font-bold text-theme-green">
                              ${selectedEntry.debit ? selectedEntry.debit.toLocaleString() : '0.00'}
                            </div>
                          </div>
                          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20">
                            <span className="text-xs theme-text-secondary block mb-2">Credit</span>
                            <div className="text-2xl font-bold text-theme-blue">
                              $
                              {selectedEntry.credit
                                ? selectedEntry.credit.toLocaleString()
                                : '0.00'}
                            </div>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-gray-200/10">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm theme-text-secondary">Net Amount</span>
                            <span className="font-bold theme-text-primary">
                              $
                              {Math.abs(
                                (selectedEntry.debit || 0) - (selectedEntry.credit || 0)
                              ).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm theme-text-secondary">Entry Type</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs',
                                (selectedEntry.debit || 0) > 0
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              )}
                            >
                              {(selectedEntry.debit || 0) > 0 ? 'Debit Entry' : 'Credit Entry'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Account Information */}
                    <div>
                      <h3 className="text-sm font-semibold theme-text-primary mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-amber-400" />
                        Account Information
                      </h3>
                      <div className="pl-6">
                        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                          <span className="font-medium text-sm theme-text-primary">
                            {selectedEntry.account}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
