'use client'

import { useState, useMemo } from 'react'
import { useBCLedgerEntries } from '../../../hooks/useBCLedgerEntries'
import type { LedgerEntry } from '../../../hooks/useBCLedgerEntries'
import { getDateRangeForPeriod } from '@/lib/utils/dateRanges'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import {
  Search,
  Calendar,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  BookOpen,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PERIOD_OPTION_GROUPS, PERIOD_OPTIONS } from '@/lib/utils/dateRanges'
import { PeriodPicker } from '../../../components/PeriodPicker'

type SortKey =
  | 'entryNumber'
  | 'postingDate'
  | 'itemNumber'
  | 'entryType'
  | 'quantity'
  | 'costAmountActual'
  | 'salesAmountActual'
  | 'documentNumber'
type SortDir = 'asc' | 'desc'

export function BCOAuthLedgerEntriesView({ connectionId }: { connectionId: string }) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [selectedPeriod, setSelectedPeriod] = useState('this_year')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [entryTypeFilter, setEntryTypeFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('postingDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      rowBg: isLight ? 'bg-stone-50/50' : 'bg-white/[0.02]',
      rowHover: isLight ? 'hover:bg-stone-100/80' : 'hover:bg-white/[0.06]',
      headerBg: isLight ? 'bg-stone-100' : 'bg-[#1a1a1a]',
    }),
    [isLight]
  )

  const dateRange = useMemo(() => {
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate }
    }
    const range = getDateRangeForPeriod(selectedPeriod)
    return { startDate: range.start, endDate: range.end }
  }, [selectedPeriod, customStartDate, customEndDate])

  const { entries, summary, currency, isLoading, error, mutate } = useBCLedgerEntries(
    connectionId,
    dateRange
  )

  // Extract unique entry types for filter
  const entryTypeOptions = useMemo(() => {
    const types = [...new Set(entries.map((e) => e.entryType))].filter(Boolean).sort()
    return types
  }, [entries])

  // Filter + sort
  const filteredEntries = useMemo(() => {
    let items = [...entries]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (e) =>
          e.itemNumber.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.documentNumber.toLowerCase().includes(q) ||
          e.sourceNumber.toLowerCase().includes(q)
      )
    }

    if (entryTypeFilter !== 'all') {
      items = items.filter((e) => e.entryType === entryTypeFilter)
    }

    items.sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === 'string') {
        return sortDir === 'asc'
          ? (aVal as string).localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal as string)
      }
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })

    return items
  }, [entries, searchQuery, entryTypeFilter, sortKey, sortDir])

  const filteredTotalCost = useMemo(
    () => filteredEntries.reduce((s, e) => s + Math.abs(e.costAmountActual), 0),
    [filteredEntries]
  )

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'postingDate' || key === 'entryNumber' ? 'desc' : 'asc')
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-amber-500" />
    ) : (
      <ChevronDown className="w-3 h-3 text-amber-500" />
    )
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const entryTypeBadge = (type: string) => {
    const t = type.toLowerCase()
    if (t.includes('sale') || t.includes('negative'))
      return isLight ? 'bg-green-100 text-green-700' : 'bg-green-500/15 text-green-400'
    if (t.includes('purchase') || t.includes('positive'))
      return isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/15 text-blue-400'
    return isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-400'
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500" />
          <h3 className="text-lg font-semibold theme-text-primary">Data Load Error</h3>
          <p className="text-sm theme-text-secondary">
            {error instanceof Error ? error.message : 'Failed to load ledger entries.'}
          </p>
          <Button variant="outline" onClick={() => mutate()} className="mt-2">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="@container space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className={cn('text-[36px] font-light tracking-tight', styles.text)}>
              Item Ledger Entries
            </h1>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-amber-500/80">
              Business Central · Raw Transaction Log
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PeriodPicker
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomStartDateChange={setCustomStartDate}
            onCustomEndDateChange={setCustomEndDate}
            disabled={isLoading}
          />
          <button
            onClick={() => mutate()}
            disabled={isLoading}
            className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className={cn('flex flex-wrap gap-6 sm:gap-10 py-5 border-b', styles.border)}>
        <div>
          <div className={cn('text-[12px] uppercase tracking-wider mb-1', styles.textMuted)}>
            Total Entries
          </div>
          <div className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}>
            {filteredEntries.length.toLocaleString()}
          </div>
        </div>
        <div>
          <div
            className={cn(
              'text-[12px] uppercase tracking-wider mb-1',
              isLight ? 'text-blue-600' : 'text-blue-400'
            )}
          >
            Purchases
          </div>
          <div
            className={cn(
              'text-[28px] font-mono font-semibold tabular-nums',
              isLight ? 'text-blue-600' : 'text-blue-400'
            )}
          >
            {formatCompactCurrency(summary.purchases.cost, currency)}
          </div>
          <div className={cn('text-[10px] font-mono', styles.textMuted)}>
            {summary.purchases.quantity.toLocaleString()} units
          </div>
        </div>
        <div>
          <div
            className={cn(
              'text-[12px] uppercase tracking-wider mb-1',
              isLight ? 'text-green-600' : 'text-green-400'
            )}
          >
            Sales
          </div>
          <div
            className={cn(
              'text-[28px] font-mono font-semibold tabular-nums',
              isLight ? 'text-green-600' : 'text-green-400'
            )}
          >
            {formatCompactCurrency(summary.sales.cost, currency)}
          </div>
          <div className={cn('text-[10px] font-mono', styles.textMuted)}>
            {summary.sales.quantity.toLocaleString()} units
          </div>
        </div>
        <div>
          <div className={cn('text-[12px] uppercase tracking-wider mb-1 text-amber-500')}>
            Adjustments
          </div>
          <div className="text-[28px] font-mono font-semibold tabular-nums text-amber-500">
            {formatCompactCurrency(summary.adjustments.cost, currency)}
          </div>
          <div className={cn('text-[10px] font-mono', styles.textMuted)}>
            {summary.adjustments.quantity.toLocaleString()} units
          </div>
        </div>
        <div>
          <div className={cn('text-[12px] uppercase tracking-wider mb-1', styles.textMuted)}>
            Filtered Cost
          </div>
          <div className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}>
            {formatCompactCurrency(filteredTotalCost, currency)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4', styles.textMuted)}
          />
          <input
            type="text"
            placeholder="Search by item, document, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full h-9 pl-9 pr-3 rounded-lg text-sm focus:outline-none transition-colors',
              'border bg-transparent',
              styles.border,
              styles.text,
              'placeholder:text-stone-400',
              'focus:border-cyan-500/40'
            )}
          />
        </div>
        <Select value={entryTypeFilter} onValueChange={setEntryTypeFilter}>
          <SelectTrigger className={cn('w-[150px] h-9 text-sm border', styles.border)}>
            <SelectValue placeholder="Entry Type" />
          </SelectTrigger>
          <SelectContent className="glass-luxury-card">
            <SelectItem value="all">All Types</SelectItem>
            {entryTypeOptions.map((type) => (
              <SelectItem key={type} value={type} className="text-sm">
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
        </div>
      ) : filteredEntries.length > 0 ? (
        <div className={cn('rounded-lg border overflow-hidden', styles.border)}>
          <div className="max-h-[calc(100vh-340px)] min-h-[400px] overflow-auto">
            <table className="w-full text-xs">
              <thead className={cn('sticky top-0 z-10', styles.headerBg, '[&_th]:bg-inherit')}>
                <tr className={cn('border-b', styles.border)}>
                  <th className={cn('text-left p-3 font-medium w-8', styles.textMuted)}>#</th>
                  <th
                    className={cn(
                      'text-left p-3 font-medium cursor-pointer hover:text-cyan-400 transition-colors',
                      styles.textMuted
                    )}
                    onClick={() => handleSort('entryNumber')}
                  >
                    <div className="flex items-center gap-1">
                      Entry # <SortIcon col="entryNumber" />
                    </div>
                  </th>
                  <th
                    className={cn(
                      'text-left p-3 font-medium cursor-pointer hover:text-cyan-400 transition-colors',
                      styles.textMuted
                    )}
                    onClick={() => handleSort('postingDate')}
                  >
                    <div className="flex items-center gap-1">
                      Date <SortIcon col="postingDate" />
                    </div>
                  </th>
                  <th
                    className={cn(
                      'text-left p-3 font-medium cursor-pointer hover:text-cyan-400 transition-colors',
                      styles.textMuted
                    )}
                    onClick={() => handleSort('entryType')}
                  >
                    <div className="flex items-center gap-1">
                      Type <SortIcon col="entryType" />
                    </div>
                  </th>
                  <th
                    className={cn(
                      'text-left p-3 font-medium cursor-pointer hover:text-cyan-400 transition-colors',
                      styles.textMuted
                    )}
                    onClick={() => handleSort('itemNumber')}
                  >
                    <div className="flex items-center gap-1">
                      Item # <SortIcon col="itemNumber" />
                    </div>
                  </th>
                  <th className={cn('text-left p-3 font-medium', styles.textMuted)}>Description</th>
                  <th
                    className={cn(
                      'text-left p-3 font-medium cursor-pointer hover:text-cyan-400 transition-colors',
                      styles.textMuted
                    )}
                    onClick={() => handleSort('documentNumber')}
                  >
                    <div className="flex items-center gap-1">
                      Document # <SortIcon col="documentNumber" />
                    </div>
                  </th>
                  <th className={cn('text-left p-3 font-medium', styles.textMuted)}>Doc Type</th>
                  <th
                    className={cn(
                      'text-right p-3 font-medium cursor-pointer hover:text-cyan-400 transition-colors',
                      styles.textMuted
                    )}
                    onClick={() => handleSort('quantity')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Quantity <SortIcon col="quantity" />
                    </div>
                  </th>
                  <th className={cn('text-right p-3 font-medium', styles.textMuted)}>Remaining</th>
                  <th
                    className={cn(
                      'text-right p-3 font-medium cursor-pointer hover:text-cyan-400 transition-colors',
                      styles.textMuted
                    )}
                    onClick={() => handleSort('costAmountActual')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Cost Amount <SortIcon col="costAmountActual" />
                    </div>
                  </th>
                  <th
                    className={cn(
                      'text-right p-3 font-medium cursor-pointer hover:text-cyan-400 transition-colors',
                      styles.textMuted
                    )}
                    onClick={() => handleSort('salesAmountActual')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Sales Amount <SortIcon col="salesAmountActual" />
                    </div>
                  </th>
                  <th className={cn('text-left p-3 font-medium', styles.textMuted)}>Source</th>
                  <th className={cn('text-left p-3 font-medium', styles.textMuted)}>Location</th>
                  <th className={cn('text-center p-3 font-medium', styles.textMuted)}>Open</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry, idx) => (
                  <tr
                    key={`${entry.entryNumber}-${idx}`}
                    className={cn(
                      'border-b transition-all duration-150',
                      styles.border,
                      styles.rowHover,
                      idx % 2 === 0 ? styles.rowBg : ''
                    )}
                  >
                    <td className={cn('p-3 text-[10px] font-mono', styles.textMuted)}>{idx + 1}</td>
                    <td className={cn('p-3 font-mono', styles.textMuted)}>{entry.entryNumber}</td>
                    <td className={cn('p-3 font-mono whitespace-nowrap', styles.text)}>
                      {formatDate(entry.postingDate)}
                    </td>
                    <td className="p-3">
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap',
                          entryTypeBadge(entry.entryType)
                        )}
                      >
                        {entry.entryType}
                      </span>
                    </td>
                    <td className={cn('p-3 font-mono font-medium', styles.text)}>
                      {entry.itemNumber}
                    </td>
                    <td className={cn('p-3 max-w-[200px]', styles.text)}>
                      <span className="truncate block" title={entry.description}>
                        {entry.description || '—'}
                      </span>
                    </td>
                    <td className={cn('p-3 font-mono', styles.text)}>
                      {entry.documentNumber || '—'}
                    </td>
                    <td className={cn('p-3', styles.textMuted)}>{entry.documentType || '—'}</td>
                    <td
                      className={cn(
                        'p-3 text-right font-mono font-semibold tabular-nums',
                        entry.quantity < 0 ? 'text-red-400' : styles.text
                      )}
                    >
                      {entry.quantity.toLocaleString()}
                    </td>
                    <td className={cn('p-3 text-right font-mono tabular-nums', styles.textMuted)}>
                      {entry.remainingQuantity.toLocaleString()}
                    </td>
                    <td
                      className={cn(
                        'p-3 text-right font-mono font-semibold tabular-nums whitespace-nowrap',
                        entry.costAmountActual < 0 ? 'text-red-400' : styles.text
                      )}
                    >
                      {formatCompactCurrency(entry.costAmountActual, currency)}
                    </td>
                    <td
                      className={cn(
                        'p-3 text-right font-mono tabular-nums whitespace-nowrap',
                        entry.salesAmountActual > 0
                          ? isLight
                            ? 'text-green-600'
                            : 'text-green-400'
                          : styles.textMuted
                      )}
                    >
                      {entry.salesAmountActual !== 0
                        ? formatCompactCurrency(entry.salesAmountActual, currency)
                        : '—'}
                    </td>
                    <td className={cn('p-3 font-mono', styles.textMuted)}>
                      {entry.sourceNumber || '—'}
                    </td>
                    <td className={cn('p-3 font-mono', styles.textMuted)}>
                      {entry.locationCode || '—'}
                    </td>
                    <td className="p-3 text-center">
                      {entry.open ? (
                        <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-stone-500/30 inline-block" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-[200px]">
          <p className={cn('text-sm', styles.textMuted)}>No ledger entries match your filters</p>
        </div>
      )}
    </div>
  )
}
