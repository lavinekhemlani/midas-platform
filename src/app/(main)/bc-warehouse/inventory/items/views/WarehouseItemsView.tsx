'use client'

import { useState, useMemo, useRef } from 'react'
import { useWarehouseInventoryItems } from '../../hooks/useWarehouseInventoryItems'
import type { WarehouseItem } from '../../hooks/useWarehouseInventoryItems'
import { WarehouseItemDetailDrawer } from '../../components/WarehouseItemDetailDrawer'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { getDateRangeForPeriod, PERIOD_OPTION_GROUPS } from '@/lib/utils/dateRanges'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import {
  useWarehouseConfig,
  useWarehouseCompanyInfo,
} from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'
import {
  Search,
  Package,
  Calendar,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useVirtualizer } from '@tanstack/react-virtual'

type SortKey =
  | 'description'
  | 'inventory_value'
  | 'inventory'
  | 'health_score'
  | 'days_since_last_sale'
type SortDir = 'asc' | 'desc'

const ROW_HEIGHT = 48

export function WarehouseItemsView() {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [selectedPeriod, setSelectedPeriod] = useState('last_year')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [abcFilter, setAbcFilter] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('inventory_value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedItemNo, setSelectedItemNo] = useState<string | null>(null)

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
    const range = getDateRangeForPeriod(selectedPeriod)
    return { startDate: range.start, endDate: range.end }
  }, [selectedPeriod])

  // Warehouse config
  const {
    config,
    schema,
    isLoading: configLoading,
    error: configError,
    isEnabled,
  } = useWarehouseConfig()

  const { data: companyInfo } = useWarehouseCompanyInfo(schema)
  const currency = companyInfo?.currencyCode || 'USD'
  const companyName = companyInfo?.companyName || ''

  const { data: allItems, isLoading, mutate } = useWarehouseInventoryItems(schema, dateRange)

  // Extract unique categories
  const categoryOptions = useMemo(() => {
    const cats = [...new Set(allItems.map((i) => i.item_category_code).filter(Boolean))].sort()
    return cats
  }, [allItems])

  // Filter + sort
  const filteredItems = useMemo(() => {
    let items = [...allItems]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (i) =>
          i.description.toLowerCase().includes(q) ||
          i.item_no.toLowerCase().includes(q) ||
          i.item_category_code.toLowerCase().includes(q)
      )
    }

    if (categoryFilter !== 'all') {
      items = items.filter((i) => i.item_category_code === categoryFilter)
    }

    if (abcFilter !== 'all') {
      items = items.filter((i) => i.abc_class === abcFilter)
    }

    if (stockFilter === 'in_stock') {
      items = items.filter((i) => i.inventory > 0)
    } else if (stockFilter === 'out_of_stock') {
      items = items.filter((i) => i.inventory === 0)
    }

    items.sort((a, b) => {
      let aVal: any = a[sortKey]
      let bVal: any = b[sortKey]
      if (aVal === null) aVal = sortDir === 'desc' ? -Infinity : Infinity
      if (bVal === null) bVal = sortDir === 'desc' ? -Infinity : Infinity
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })

    return items
  }, [allItems, searchQuery, categoryFilter, abcFilter, stockFilter, sortKey, sortDir])

  const filteredValue = useMemo(
    () => filteredItems.reduce((s, i) => s + i.inventory_value, 0),
    [filteredItems]
  )

  const totalOnHand = useMemo(
    () => filteredItems.reduce((s, i) => s + i.inventory, 0),
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
    if (!selectedItemNo) return null
    return allItems.find((i) => i.item_no === selectedItemNo) ?? null
  }, [selectedItemNo, allItems])

  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  })

  const fmt = (v: number, c: string) => formatCompactCurrency(v, c)

  // ── Structured tooltip builders ──

  const headerTooltipProps = useMemo(() => {
    const aCount = allItems.filter((i) => i.abc_class === 'A').length
    const bCount = allItems.filter((i) => i.abc_class === 'B').length
    const cCount = allItems.filter((i) => i.abc_class === 'C').length
    const totalVal = allItems.reduce((s, i) => s + i.inventory_value, 0)
    return {
      description:
        'Complete list of inventory items from the warehouse (Redshift). Each item includes computed ABC classification, health score, and movement metrics from item_ledger_entry.',
      calculationTooltip: {
        formula:
          'Items from item table\n+ movements from item_ledger_entry\nABC & health computed in SQL',
        components: [
          { label: 'Total Items', value: allItems.length },
          { label: 'A-Class', value: `${aCount} items` },
          { label: 'B-Class', value: `${bCount} items` },
          { label: 'C-Class', value: `${cCount} items` },
          { label: 'Total Value', value: fmt(totalVal, currency), highlight: true },
        ],
      },
      note: `Source: ${schema}.item LEFT JOIN ${schema}.item_ledger_entry. ABC = cumulative value cutoffs at 80%/95%. Health = turnover + recency + availability + value tier (0–100). Limited to top 1000 items by value.`,
    }
  }, [allItems, currency, schema])

  const metricsTooltipProps = useMemo(() => {
    const inStockCount = filteredItems.filter((i) => i.inventory > 0).length
    const outOfStockCount = filteredItems.filter((i) => i.inventory === 0).length
    return {
      description:
        'Summary metrics for the currently filtered item set. Value and on-hand reflect current balances from the item table and do not change with the date period.',
      calculationTooltip: {
        formula: 'Filtered Value = Σ (inventory × unit_cost) for shown items',
        components: [
          { label: 'Items Shown', value: filteredItems.length },
          { label: 'In Stock', value: inStockCount },
          { label: 'Out of Stock', value: outOfStockCount },
          { label: 'Total On Hand', value: `${totalOnHand.toLocaleString()} units` },
          { label: 'Total Value', value: fmt(filteredValue, currency), highlight: true },
        ],
      },
      note: `Source: ${schema}.item. Stock and value are current snapshots. Only movement metrics (sales qty, purchases qty, last sale) are period-sensitive.`,
    }
  }, [filteredItems, totalOnHand, filteredValue, currency, schema])

  // Config loading / error states
  if (configLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
          <p className="text-sm theme-text-secondary">Loading...</p>
        </div>
      </div>
    )
  }

  if (configError || !config || !isEnabled) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-sm theme-text-secondary">
            {configError?.message || 'Warehouse not enabled'}
          </p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!schema) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm theme-text-secondary">No schema configured</p>
      </div>
    )
  }

  return (
    <div className="@container max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-cyan-400" />
          <div>
            <h1 className={cn('text-lg font-semibold', styles.text)}>All Items</h1>
            <p className={cn('text-xs font-mono', styles.textMuted)}>
              {companyName && `${companyName} · `}
              {schema} · Warehouse
            </p>
          </div>
          <InfoTooltip {...headerTooltipProps} />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-[140px]">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod} disabled={isLoading}>
              <SelectTrigger className="w-full h-9 glass-luxury-card border-amber-500/20 hover:border-amber-500/40 transition-all duration-200 text-sm">
                <Calendar className="w-3.5 h-3.5 mr-2 text-amber-500" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-luxury-card max-h-[400px]">
                {PERIOD_OPTION_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel className="text-[10px] uppercase tracking-wider text-amber-500/70 font-semibold px-2 py-1">
                      {group.label}
                    </SelectLabel>
                    {group.options.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="text-sm cursor-pointer"
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            onClick={() => mutate()}
            disabled={isLoading}
            className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* As-of note */}
      <p className={cn('text-xs mt-6', styles.textMuted)}>
        Stock on hand, unit cost, and inventory value reflect current balances and do not change
        with the selected time period. Only movement-related metrics (sales qty, purchases qty, last
        sale) are period-sensitive.
      </p>

      {/* Key metrics strip */}
      <div className={cn('flex flex-wrap gap-6 sm:gap-10 py-5 mt-6 border-y', styles.border)}>
        <div>
          <div
            className={cn(
              'text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1',
              styles.textMuted
            )}
          >
            Items Shown
            <InfoTooltip {...metricsTooltipProps} />
          </div>
          <div className={cn('text-2xl font-mono font-semibold tabular-nums', styles.text)}>
            {filteredItems.length.toLocaleString()}
          </div>
        </div>
        <div>
          <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
            Total Value
          </div>
          <div className={cn('text-2xl font-mono font-semibold tabular-nums', styles.text)}>
            {formatCompactCurrency(filteredValue, currency)}
          </div>
        </div>
        <div>
          <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
            Total On Hand
          </div>
          <div className={cn('text-2xl font-mono font-semibold tabular-nums', styles.text)}>
            {totalOnHand.toLocaleString()}
          </div>
        </div>
        {abcFilter === 'all' && filteredItems.length > 0 && (
          <>
            <div>
              <div className={cn('text-[10px] uppercase tracking-wider mb-1 text-amber-500')}>
                A-Class
              </div>
              <div className="text-2xl font-mono font-semibold tabular-nums text-amber-500">
                {filteredItems.filter((i) => i.abc_class === 'A').length}
              </div>
            </div>
            <div>
              <div className={cn('text-[10px] uppercase tracking-wider mb-1 text-blue-400')}>
                B-Class
              </div>
              <div className="text-2xl font-mono font-semibold tabular-nums text-blue-400">
                {filteredItems.filter((i) => i.abc_class === 'B').length}
              </div>
            </div>
            <div>
              <div className={cn('text-[10px] uppercase tracking-wider mb-1', styles.textMuted)}>
                C-Class
              </div>
              <div
                className={cn('text-2xl font-mono font-semibold tabular-nums', styles.textMuted)}
              >
                {filteredItems.filter((i) => i.abc_class === 'C').length}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mt-6">
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
        <div className="flex items-center justify-center min-h-[300px] mt-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
        </div>
      ) : filteredItems.length > 0 ? (
        <div className={cn('rounded-t-lg border-x border-t overflow-hidden mt-6', styles.border)}>
          <div
            ref={parentRef}
            className="overflow-auto"
            style={{ height: 'calc(100vh - 420px)', contain: 'strict' }}
          >
            <table className="w-full text-xs" style={{ tableLayout: 'auto' }}>
              <thead className={cn('sticky top-0 z-10', styles.headerBg, '[&_th]:bg-inherit')}>
                <tr className={cn('border-b', styles.border)}>
                  <th className={cn('text-left p-3 font-medium w-8', styles.textMuted)}>#</th>
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
                  <th className="w-8 p-3"></th>
                </tr>
              </thead>
              <tbody>
                {/* Top spacer for virtualized rows */}
                {rowVirtualizer.getVirtualItems().length > 0 && (
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
                )}
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const item = filteredItems[virtualRow.index]
                  const idx = virtualRow.index
                  return (
                    <tr
                      key={item.item_no}
                      data-index={virtualRow.index}
                      className={cn(
                        'group border-b cursor-pointer',
                        styles.border,
                        styles.rowHover,
                        idx % 2 === 0 ? styles.rowBg : ''
                      )}
                      style={{ height: ROW_HEIGHT }}
                      onClick={() => setSelectedItemNo(item.item_no)}
                    >
                      <td className={cn('p-3 text-[10px] font-mono', styles.textMuted)}>
                        {idx + 1}
                      </td>
                      <td className="p-3">
                        <div
                          className={cn(
                            'text-xs truncate max-w-[200px] font-medium',
                            'group-hover:text-cyan-500 group-hover:underline underline-offset-2',
                            styles.text
                          )}
                          title={item.description}
                        >
                          {item.description}
                        </div>
                        <div className={cn('text-[10px] font-mono mt-0.5', styles.textMuted)}>
                          {item.item_no}
                        </div>
                      </td>
                      <td className={cn('p-3 text-[10px]', styles.textMuted)}>
                        {item.item_category_code}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] font-semibold',
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
                              'px-1.5 py-0.5 rounded text-[10px] font-medium',
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
                          <span className={cn('text-[10px]', styles.textMuted)}>—</span>
                        )}
                      </td>
                      <td className={cn('p-3 text-right text-[10px] font-mono', styles.textMuted)}>
                        {item.days_since_last_sale !== null ? `${item.days_since_last_sale}d` : '—'}
                      </td>
                      <td className="p-3 text-center">
                        <ChevronRight
                          className={cn(
                            'w-4 h-4',
                            'opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5',
                            'text-cyan-500'
                          )}
                        />
                      </td>
                    </tr>
                  )
                })}
                {/* Bottom spacer for virtualized rows */}
                {rowVirtualizer.getVirtualItems().length > 0 && (
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
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-[200px]">
          <p className={cn('text-sm', styles.textMuted)}>No items match your filters</p>
        </div>
      )}

      {/* Item Detail Drawer */}
      <WarehouseItemDetailDrawer
        open={!!selectedItemNo}
        onClose={() => setSelectedItemNo(null)}
        schema={schema}
        itemNo={selectedItemNo}
        dateRange={dateRange}
        currency={currency}
        abcClass={selectedItemData?.abc_class}
        healthScore={selectedItemData?.health_score}
      />
    </div>
  )
}
