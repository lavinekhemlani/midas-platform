'use client'

import React, { useState, useMemo, useCallback, useRef } from 'react'
import { useBCInventoryEnhanced } from '../../../hooks/useBCInventoryEnhanced'
import type { FullItem } from '../../../hooks/useBCInventoryEnhanced'
import { ItemDetailDrawer, InfoTooltip } from '../../components'
import { ItemsListPDF } from '../../components/ItemsListPDF'
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
  ChevronRight,
  Download,
  Loader2,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { pdf } from '@react-pdf/renderer'
import { PERIOD_OPTION_GROUPS, PERIOD_OPTIONS } from '@/lib/utils/dateRanges'
import { PeriodPicker } from '../../../components/PeriodPicker'
import { useVirtualizer } from '@tanstack/react-virtual'

const ROW_HEIGHT = 48

const periodPickerLabel = (value: string) =>
  PERIOD_OPTIONS.find((o) => o.value === value)?.label ?? value

type SortKey =
  | 'description'
  | 'inventory_value'
  | 'inventory'
  | 'health_score'
  | 'days_since_last_sale'
type SortDir = 'asc' | 'desc'

export function BCOAuthInventoryItemsView({ connectionId }: { connectionId: string }) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [selectedPeriod, setSelectedPeriod] = useState('this_year')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [abcFilter, setAbcFilter] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('inventory_value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedItemNumber, setSelectedItemNumber] = useState<string | null>(null)

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

  const { allItems, categories, currency, isLoading, mutate } = useBCInventoryEnhanced(
    connectionId,
    dateRange
  )

  // Extract unique categories for filter dropdown
  const categoryOptions = useMemo(() => {
    const cats = [...new Set(allItems.map((i) => i.item_category_code))].sort()
    return cats
  }, [allItems])

  // Filter + sort
  const filteredItems = useMemo(() => {
    let items = [...allItems]

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (i) =>
          i.description.toLowerCase().includes(q) ||
          i.item_no.toLowerCase().includes(q) ||
          i.item_category_code.toLowerCase().includes(q)
      )
    }

    // Category
    if (categoryFilter !== 'all') {
      items = items.filter((i) => i.item_category_code === categoryFilter)
    }

    // ABC
    if (abcFilter !== 'all') {
      items = items.filter((i) => i.abc_class === abcFilter)
    }

    // Stock
    if (stockFilter === 'in_stock') {
      items = items.filter((i) => i.inventory > 0)
    } else if (stockFilter === 'out_of_stock') {
      items = items.filter((i) => i.inventory === 0)
    }

    // Sort
    items.sort((a, b) => {
      let aVal: any = a[sortKey]
      let bVal: any = b[sortKey]
      // Handle nulls for days_since_last_sale
      if (aVal === null) aVal = sortDir === 'desc' ? -Infinity : Infinity
      if (bVal === null) bVal = sortDir === 'desc' ? -Infinity : Infinity
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })

    return items
  }, [allItems, searchQuery, categoryFilter, abcFilter, stockFilter, sortKey, sortDir])

  // Summary of visible set
  const filteredValue = useMemo(
    () => filteredItems.reduce((s, i) => s + i.inventory_value, 0),
    [filteredItems]
  )

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
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

  const selectedItemData = useMemo(() => {
    if (!selectedItemNumber) return null
    return allItems.find((i) => i.item_no === selectedItemNumber) ?? null
  }, [selectedItemNumber, allItems])

  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  })

  // PDF Download state and handler
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false)

  const handleDownloadPDF = useCallback(async () => {
    setIsDownloadingPDF(true)
    try {
      const blob = await pdf(
        <ItemsListPDF
          items={filteredItems}
          totalValue={filteredValue}
          currency={currency}
          dateRange={dateRange}
          filters={{
            search: searchQuery || undefined,
            category: categoryFilter !== 'all' ? categoryFilter : undefined,
            abcClass: abcFilter !== 'all' ? abcFilter : undefined,
            stockStatus: stockFilter !== 'all' ? stockFilter : undefined,
          }}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `inventory-items-${dateRange.startDate}-${dateRange.endDate}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF generation failed:', err)
    } finally {
      setIsDownloadingPDF(false)
    }
  }, [
    filteredItems,
    filteredValue,
    currency,
    dateRange,
    searchQuery,
    categoryFilter,
    abcFilter,
    stockFilter,
  ])

  return (
    <div className="@container space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn('text-[36px] font-light tracking-tight', styles.text)}>All Items</h1>
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-amber-500/80">
            Business Central · Full Inventory List
          </p>
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
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloadingPDF || isLoading || filteredItems.length === 0}
            className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Download PDF Report"
          >
            {isDownloadingPDF ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Key metrics strip */}
      <div className={cn('flex items-center justify-between py-5 border-b', styles.border)}>
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          <div>
            <div className="text-[12px] uppercase tracking-wider mb-1 theme-text-secondary">
              Items Shown
            </div>
            {isLoading ? (
              <div
                className={cn(
                  'h-[34px] w-20 animate-pulse mt-1',
                  isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
                )}
              />
            ) : (
              <div className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}>
                {filteredItems.length.toLocaleString()}
              </div>
            )}
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-wider mb-1 theme-text-secondary">
              Total Value
            </div>
            {isLoading ? (
              <div
                className={cn(
                  'h-[34px] w-28 animate-pulse mt-1',
                  isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
                )}
              />
            ) : (
              <div className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}>
                {formatCompactCurrency(filteredValue, currency)}
              </div>
            )}
          </div>
          {isLoading ? (
            <>
              <div>
                <div className="text-[12px] uppercase tracking-wider mb-1 text-amber-500">
                  A-Class
                </div>
                <div
                  className={cn(
                    'h-[34px] w-12 animate-pulse mt-1',
                    isLight ? 'bg-amber-200/60' : 'bg-amber-500/10'
                  )}
                />
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wider mb-1 text-blue-400">
                  B-Class
                </div>
                <div
                  className={cn(
                    'h-[34px] w-12 animate-pulse mt-1',
                    isLight ? 'bg-blue-200/60' : 'bg-blue-400/10'
                  )}
                />
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wider mb-1 theme-text-secondary">
                  C-Class
                </div>
                <div
                  className={cn(
                    'h-[34px] w-12 animate-pulse mt-1',
                    isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
                  )}
                />
              </div>
            </>
          ) : abcFilter === 'all' && filteredItems.length > 0 ? (
            <>
              <div>
                <div className="text-[12px] uppercase tracking-wider mb-1 text-amber-500">
                  A-Class
                </div>
                <div className="text-[28px] font-mono font-semibold tabular-nums text-amber-500">
                  {filteredItems.filter((i) => i.abc_class === 'A').length}
                </div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wider mb-1 text-blue-400">
                  B-Class
                </div>
                <div className="text-[28px] font-mono font-semibold tabular-nums text-blue-400">
                  {filteredItems.filter((i) => i.abc_class === 'B').length}
                </div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wider mb-1 theme-text-secondary">
                  C-Class
                </div>
                <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-secondary">
                  {filteredItems.filter((i) => i.abc_class === 'C').length}
                </div>
              </div>
            </>
          ) : null}
        </div>
        <InfoTooltip
          description="Full searchable inventory list from Business Central. Filter by category, ABC class, or stock status. Each item shows health score, value, and sales activity."
          calculationTooltip={{
            formula: 'Value = On-Hand Qty × Unit Cost per item',
            components: [
              { label: 'Total Items', value: `${allItems.length}` },
              { label: 'Showing', value: `${filteredItems.length}` },
              {
                label: 'Total Value',
                value: formatCompactCurrency(filteredValue, currency),
                highlight: true,
              },
            ],
          }}
          note="Source: BC Items entity. Health score (0-100) combines turnover, recency, availability, and value tier. ABC class uses cumulative value cutoffs at 80%/95%/100%."
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4', styles.textMuted)}
          />
          <input
            type="text"
            placeholder="Search items by name or number..."
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
        {/* Category */}
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className={cn('w-[150px] h-9 text-sm border', styles.border)}>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="glass-luxury-card">
            <SelectItem value="all">All Categories</SelectItem>
            {categoryOptions.map((cat) => (
              <SelectItem key={cat} value={cat} className="text-sm">
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* ABC */}
        <Select value={abcFilter} onValueChange={setAbcFilter}>
          <SelectTrigger className={cn('w-[100px] h-9 text-sm border', styles.border)}>
            <SelectValue placeholder="ABC" />
          </SelectTrigger>
          <SelectContent className="glass-luxury-card">
            <SelectItem value="all">All ABC</SelectItem>
            <SelectItem value="A">A — High</SelectItem>
            <SelectItem value="B">B — Medium</SelectItem>
            <SelectItem value="C">C — Low</SelectItem>
          </SelectContent>
        </Select>
        {/* Stock */}
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className={cn('w-[130px] h-9 text-sm border', styles.border)}>
            <SelectValue placeholder="Stock" />
          </SelectTrigger>
          <SelectContent className="glass-luxury-card">
            <SelectItem value="all">All Stock</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
        </div>
      ) : filteredItems.length > 0 ? (
        <div className={cn('rounded-t-lg border-x border-t overflow-hidden', styles.border)}>
          <div
            ref={parentRef}
            className="overflow-auto"
            style={{ height: 'calc(100vh - 420px)', contain: 'strict' }}
          >
            <table className="w-full text-[12px]" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 48 }} />
                <col />
                <col style={{ width: 120 }} />
                <col style={{ width: 56 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 88 }} />
                <col style={{ width: 40 }} />
              </colgroup>
              <thead className={cn('sticky top-0 z-10', styles.headerBg, '[&_th]:bg-inherit')}>
                <tr className={cn('border-b', styles.border)}>
                  <th className={cn('text-left p-3 font-medium', styles.textMuted)}>#</th>
                  <th
                    className={cn(
                      'text-left p-3 font-medium cursor-pointer hover:text-cyan-400 transition-colors',
                      styles.textMuted
                    )}
                    onClick={() => handleSort('description')}
                  >
                    <div className="flex items-center gap-1">
                      Item <SortIcon col="description" />
                    </div>
                  </th>
                  <th className={cn('text-left p-3 font-medium', styles.textMuted)}>Category</th>
                  <th className={cn('text-center p-3 font-medium', styles.textMuted)}>ABC</th>
                  <th
                    className={cn(
                      'text-right p-3 font-medium cursor-pointer hover:text-cyan-400 transition-colors',
                      styles.textMuted
                    )}
                    onClick={() => handleSort('inventory')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      On Hand <SortIcon col="inventory" />
                    </div>
                  </th>
                  <th className={cn('text-right p-3 font-medium', styles.textMuted)}>Unit Cost</th>
                  <th
                    className={cn(
                      'text-right p-3 font-medium cursor-pointer hover:text-cyan-400 transition-colors',
                      styles.textMuted
                    )}
                    onClick={() => handleSort('inventory_value')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Value <SortIcon col="inventory_value" />
                    </div>
                  </th>
                  <th
                    className={cn(
                      'text-center p-3 font-medium cursor-pointer hover:text-cyan-400 transition-colors',
                      styles.textMuted
                    )}
                    onClick={() => handleSort('health_score')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Health <SortIcon col="health_score" />
                    </div>
                  </th>
                  <th
                    className={cn(
                      'text-right p-3 font-medium cursor-pointer hover:text-cyan-400 transition-colors',
                      styles.textMuted
                    )}
                    onClick={() => handleSort('days_since_last_sale')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Last Sale <SortIcon col="days_since_last_sale" />
                    </div>
                  </th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              {/* Top spacer */}
              {rowVirtualizer.getVirtualItems().length > 0 && (
                <tbody>
                  <tr>
                    <td
                      colSpan={10}
                      style={{
                        height: rowVirtualizer.getVirtualItems()[0]?.start ?? 0,
                        padding: 0,
                        border: 'none',
                      }}
                    />
                  </tr>
                </tbody>
              )}
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = filteredItems[virtualRow.index]
                const idx = virtualRow.index
                const isSelected = item.item_no === selectedItemNumber
                return (
                  <tbody
                    key={item.item_no}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                  >
                    <tr
                      className={cn(
                        'group border-b cursor-pointer',
                        styles.border,
                        styles.rowHover,
                        idx % 2 === 0 ? styles.rowBg : ''
                      )}
                      style={{ height: ROW_HEIGHT }}
                      onClick={() =>
                        setSelectedItemNumber((prev) =>
                          prev === item.item_no ? null : item.item_no
                        )
                      }
                    >
                      <td className={cn('p-3 font-mono', styles.textMuted)}>{idx + 1}</td>
                      <td className="p-3">
                        <div
                          className={cn(
                            'truncate max-w-[200px] font-medium',
                            'group-hover:text-cyan-500 group-hover:underline underline-offset-2',
                            styles.text
                          )}
                          title={item.description}
                        >
                          {item.description}
                        </div>
                        <div className={cn('text-[12px] font-mono mt-0.5', styles.textMuted)}>
                          {item.item_no}
                        </div>
                      </td>
                      <td className={cn('p-3', styles.textMuted)}>{item.item_category_code}</td>
                      <td className="p-3 text-center">
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded font-semibold',
                            item.abc_class === 'A'
                              ? 'bg-amber-500/15 text-amber-400'
                              : item.abc_class === 'B'
                                ? 'bg-blue-500/15 text-blue-400'
                                : 'bg-gray-500/15 text-gray-400'
                          )}
                        >
                          {item.abc_class}
                        </span>
                      </td>
                      <td className={cn('p-3 text-right font-mono tabular-nums', styles.text)}>
                        {item.inventory.toLocaleString()}
                      </td>
                      <td className={cn('p-3 text-right font-mono tabular-nums', styles.textMuted)}>
                        {formatCompactCurrency(item.unit_cost, currency)}
                      </td>
                      <td
                        className={cn(
                          'p-3 text-right font-mono font-semibold tabular-nums',
                          styles.text
                        )}
                      >
                        {formatCompactCurrency(item.inventory_value, currency)}
                      </td>
                      <td className="p-3 text-center">
                        {item.health_score > 0 ? (
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded font-medium',
                              item.health_score >= 80
                                ? 'bg-green-500/15 text-green-400'
                                : item.health_score >= 60
                                  ? 'bg-blue-500/15 text-blue-400'
                                  : item.health_score >= 40
                                    ? 'bg-yellow-500/15 text-yellow-400'
                                    : 'bg-red-500/15 text-red-400'
                            )}
                          >
                            {item.health_score}
                          </span>
                        ) : (
                          <span className={styles.textMuted}>—</span>
                        )}
                      </td>
                      <td className={cn('p-3 text-right font-mono', styles.textMuted)}>
                        {item.days_since_last_sale !== null ? `${item.days_since_last_sale}d` : '—'}
                      </td>
                      <td className="p-3 text-center">
                        {isSelected ? (
                          <ChevronDown className="w-4 h-4 text-cyan-500" />
                        ) : (
                          <ChevronRight
                            className={cn(
                              'w-4 h-4',
                              'opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5',
                              'text-cyan-500'
                            )}
                          />
                        )}
                      </td>
                    </tr>
                    {isSelected && (
                      <tr>
                        <td colSpan={10} className="p-0 border-none">
                          <ItemDetailDrawer
                            open
                            onClose={() => setSelectedItemNumber(null)}
                            connectionId={connectionId}
                            itemNumber={selectedItemNumber}
                            dateRange={dateRange}
                            currency={currency}
                            abcClass={selectedItemData?.abc_class}
                            healthScore={selectedItemData?.health_score}
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                )
              })}
              {/* Bottom spacer */}
              {rowVirtualizer.getVirtualItems().length > 0 && (
                <tbody>
                  <tr>
                    <td
                      colSpan={10}
                      style={{
                        height:
                          rowVirtualizer.getTotalSize() -
                          (rowVirtualizer.getVirtualItems().at(-1)?.end ?? 0),
                        padding: 0,
                        border: 'none',
                      }}
                    />
                  </tr>
                </tbody>
              )}
            </table>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-[200px]">
          <p className={cn('text-sm', styles.textMuted)}>No items match your filters</p>
        </div>
      )}
    </div>
  )
}
