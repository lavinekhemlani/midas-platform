'use client'

import React, { useMemo, useCallback, useState } from 'react'
import { getDateRangeForPeriod } from '@/lib/utils/dateRanges'
import { PeriodPicker } from '../../../components/PeriodPicker'
import { useBCInventoryEnhanced, type LocationRow } from '../../../hooks/useBCInventoryEnhanced'
import { InfoTooltip } from '../../components'
import { LocationsPDF } from '../../components/LocationsPDF'
import { LocationDetailDrawer } from '../../components/LocationDetailDrawer'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import {
  MapPin,
  RefreshCw,
  Download,
  Loader2,
  Phone,
  Mail,
  Globe,
  User,
  Search,
  LayoutGrid,
  Table2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react'
import { pdf } from '@react-pdf/renderer'

type SortKey =
  | 'name'
  | 'code'
  | 'country'
  | 'total_cost'
  | 'net_quantity'
  | 'unique_items'
  | 'sales_cost'
  | 'purchases_cost'
type SortDir = 'asc' | 'desc'
type ViewMode = 'cards' | 'table'

export function BCOAuthLocationsView({ connectionId }: { connectionId: string }) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [selectedPeriod, setSelectedPeriod] = useState('this_year')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      cardBg: isLight ? 'bg-stone-50/50' : 'bg-white/[0.02]',
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

  const { locations, locationStatsAvailable, currency, isLoading, mutate } = useBCInventoryEnhanced(
    connectionId,
    dateRange
  )

  // UI state
  const [searchQuery, setSearchQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<LocationRow | null>(null)

  const cur = currency || 'USD'

  // Unique countries for filter
  const countries = useMemo(() => {
    const set = new Set<string>()
    for (const loc of locations) {
      if (loc.country) set.add(loc.country)
    }
    return [...set].sort()
  }, [locations])

  // Filter + sort
  const filteredLocations = useMemo(() => {
    let result = [...locations]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (loc) =>
          loc.code.toLowerCase().includes(q) ||
          loc.name.toLowerCase().includes(q) ||
          loc.city.toLowerCase().includes(q) ||
          loc.country.toLowerCase().includes(q) ||
          loc.contact.toLowerCase().includes(q)
      )
    }

    if (countryFilter !== 'all') {
      result = result.filter((loc) => loc.country === countryFilter)
    }

    result.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'code':
          cmp = a.code.localeCompare(b.code)
          break
        case 'country':
          cmp = (a.country || '').localeCompare(b.country || '')
          break
        case 'total_cost':
          cmp = (a.inventory_stats?.total_cost ?? 0) - (b.inventory_stats?.total_cost ?? 0)
          break
        case 'net_quantity':
          cmp = (a.inventory_stats?.net_quantity ?? 0) - (b.inventory_stats?.net_quantity ?? 0)
          break
        case 'unique_items':
          cmp = (a.inventory_stats?.unique_items ?? 0) - (b.inventory_stats?.unique_items ?? 0)
          break
        case 'sales_cost':
          cmp = (a.inventory_stats?.sales_cost ?? 0) - (b.inventory_stats?.sales_cost ?? 0)
          break
        case 'purchases_cost':
          cmp = (a.inventory_stats?.purchases_cost ?? 0) - (b.inventory_stats?.purchases_cost ?? 0)
          break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })

    return result
  }, [locations, searchQuery, countryFilter, sortKey, sortDir])

  // Aggregate stats
  const totalStats = useMemo(() => {
    let locationsWithContact = 0
    let locationsWithAddress = 0
    let locationsWithStats = 0
    let totalInventoryValue = 0
    let totalNetQty = 0
    let totalSalesCost = 0
    let totalPurchasesCost = 0

    for (const loc of locations) {
      if (loc.contact || loc.phoneNumber || loc.email) locationsWithContact++
      if (loc.city || loc.address) locationsWithAddress++
      if (loc.inventory_stats && loc.inventory_stats.entry_count > 0) {
        locationsWithStats++
        totalInventoryValue += loc.inventory_stats.total_cost
        totalNetQty += loc.inventory_stats.net_quantity
        totalSalesCost += loc.inventory_stats.sales_cost
        totalPurchasesCost += loc.inventory_stats.purchases_cost
      }
    }
    return {
      locationsWithContact,
      locationsWithAddress,
      locationsWithStats,
      totalInventoryValue,
      totalNetQty,
      totalSalesCost,
      totalPurchasesCost,
    }
  }, [locations])

  // Sort handler
  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey(key)
        setSortDir(key === 'name' || key === 'code' || key === 'country' ? 'asc' : 'desc')
      }
    },
    [sortKey]
  )

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    )
  }

  // PDF download
  const handleDownloadPDF = useCallback(async () => {
    setIsDownloadingPDF(true)
    try {
      const blob = await pdf(
        <LocationsPDF locations={locations} currency={cur} dateRange={dateRange} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const today = new Date().toISOString().split('T')[0]
      link.download = `locations-report-${today}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF generation failed:', err)
    } finally {
      setIsDownloadingPDF(false)
    }
  }, [locations, cur])

  return (
    <div className="@container space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn('text-[36px] font-light tracking-tight', styles.text)}>Locations</h1>
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-amber-500/80">
            Business Central · Warehouse & Fulfillment
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodPicker
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomStartDateChange={setCustomStartDate}
            onCustomEndDateChange={setCustomEndDate}
            disabled={isLoading}
          />
          {/* View toggle */}
          <div className={cn('flex items-center border rounded-lg overflow-hidden', styles.border)}>
            <button
              onClick={() => setViewMode('cards')}
              className={cn(
                'p-1.5 transition-colors',
                viewMode === 'cards'
                  ? isLight
                    ? 'bg-stone-200 text-stone-900'
                    : 'bg-white/10 text-white'
                  : 'text-stone-500 hover:text-stone-300'
              )}
              title="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'p-1.5 transition-colors',
                viewMode === 'table'
                  ? isLight
                    ? 'bg-stone-200 text-stone-900'
                    : 'bg-white/10 text-white'
                  : 'text-stone-500 hover:text-stone-300'
              )}
              title="Table view"
            >
              <Table2 className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => mutate()}
            disabled={isLoading}
            className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloadingPDF || isLoading || locations.length === 0}
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
        <div className="flex flex-wrap gap-6 sm:gap-10">
          <div>
            <div className={cn('text-[12px] uppercase tracking-wider mb-1', styles.textMuted)}>
              Total Locations
            </div>
            <div className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}>
              {locations.length}
            </div>
          </div>
          {locationStatsAvailable ? (
            <>
              <div>
                <div className={cn('text-[12px] uppercase tracking-wider mb-1', styles.textMuted)}>
                  Total Inventory Value
                </div>
                <div
                  className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}
                >
                  {formatCompactCurrency(totalStats.totalInventoryValue, cur)}
                </div>
              </div>
              <div>
                <div className={cn('text-[12px] uppercase tracking-wider mb-1', styles.textMuted)}>
                  Net Quantity
                </div>
                <div
                  className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}
                >
                  {Math.round(totalStats.totalNetQty).toLocaleString()}
                </div>
              </div>
              <div>
                <div className={cn('text-[12px] uppercase tracking-wider mb-1', styles.textMuted)}>
                  With Stock Data
                </div>
                <div
                  className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}
                >
                  {totalStats.locationsWithStats}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className={cn('text-[12px] uppercase tracking-wider mb-1', styles.textMuted)}>
                  With Address
                </div>
                <div
                  className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}
                >
                  {totalStats.locationsWithAddress}
                </div>
              </div>
              <div>
                <div className={cn('text-[12px] uppercase tracking-wider mb-1', styles.textMuted)}>
                  With Contact Info
                </div>
                <div
                  className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}
                >
                  {totalStats.locationsWithContact}
                </div>
              </div>
              <div>
                <div className={cn('text-[12px] uppercase tracking-wider mb-1', styles.textMuted)}>
                  Countries
                </div>
                <div
                  className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}
                >
                  {countries.length}
                </div>
              </div>
            </>
          )}
        </div>
        <InfoTooltip
          description={
            locationStatsAvailable
              ? 'Physical warehouse, fulfillment, and storage locations from Business Central, enriched with per-location inventory activity computed from Item Ledger Entries. Each location shows net stock quantity, cost value, and purchase/sale breakdown.'
              : 'Physical warehouse, fulfillment, and storage locations from Business Central. Shows address and contact details. Per-location inventory data is not available because the standard BC API v2.0 itemLedgerEntries endpoint does not expose the locationCode field.'
          }
          calculationTooltip={{
            formula: locationStatsAvailable
              ? 'Net Qty = Σ ledger.quantity (grouped by Location_Code)\nValue = Σ |ledger.costAmountActual| (grouped by Location_Code)\nPurchases = Σ |cost| where entryType contains "Purchase"\nSales = Σ |cost| where entryType contains "Sale"\nItems = COUNT(DISTINCT itemNumber) per location'
              : 'Total Locations = COUNT(locations)\nWith Address = locations where city OR addressLine1 is populated\nWith Contact = locations where contact OR phoneNumber OR email is populated',
            components: [
              { label: 'Total Locations', value: locations.length, highlight: true },
              ...(locationStatsAvailable
                ? [
                    { label: 'Locations With Stock Data', value: totalStats.locationsWithStats },
                    {
                      label: 'Total Inventory Value',
                      value: formatCompactCurrency(totalStats.totalInventoryValue, cur),
                    },
                    {
                      label: 'Total Net Quantity',
                      value: Math.round(totalStats.totalNetQty).toLocaleString(),
                    },
                    {
                      label: 'Total Purchases',
                      value: formatCompactCurrency(totalStats.totalPurchasesCost, cur),
                    },
                    {
                      label: 'Total Sales',
                      value: formatCompactCurrency(totalStats.totalSalesCost, cur),
                    },
                  ]
                : [
                    { label: 'With Contact Info', value: totalStats.locationsWithContact },
                    { label: 'With Address', value: totalStats.locationsWithAddress },
                    { label: 'Countries', value: countries.length },
                  ]),
            ],
          }}
          note={
            locationStatsAvailable
              ? 'Source: BC API v2.0 → locations (master data) + OData Web Service → ItemLedgerEntries with Location_Code (inventory activity). Inventory stats are computed server-side by grouping ledger entries by Location_Code and aggregating quantity and costAmountActual.'
              : 'Source: BC API v2.0 → companies({companyId})/locations. Per-location inventory stats require an OData Web Service page that exposes the Item Ledger Entry table with the Location_Code field (not available in the standard API v2.0 itemLedgerEntries endpoint).'
          }
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
        </div>
      ) : locations.length > 0 ? (
        <>
          {/* Search + filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-[360px]">
              <Search
                className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4', styles.textMuted)}
              />
              <input
                type="text"
                placeholder="Search by name, code, city, country..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-transparent outline-none',
                  'placeholder:text-stone-500 focus:border-amber-500/50 transition-colors',
                  styles.border,
                  styles.text
                )}
              />
            </div>

            {/* Country filter */}
            {countries.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setCountryFilter('all')}
                  className={cn(
                    'px-2.5 py-1 text-[12px] font-medium rounded border transition-colors',
                    countryFilter === 'all'
                      ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                      : cn('border-transparent', styles.textMuted, 'hover:text-amber-400')
                  )}
                >
                  All ({locations.length})
                </button>
                {countries.map((country) => {
                  const count = locations.filter((l) => l.country === country).length
                  const isActive = countryFilter === country
                  return (
                    <button
                      key={country}
                      onClick={() => setCountryFilter(isActive ? 'all' : country)}
                      className={cn(
                        'px-2.5 py-1 text-[12px] font-medium rounded border transition-colors',
                        isActive
                          ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                          : cn('border-transparent', styles.textMuted, 'hover:text-amber-400')
                      )}
                    >
                      {country} ({count})
                    </button>
                  )
                })}
              </div>
            )}

            {/* Result count */}
            {(searchQuery || countryFilter !== 'all') && (
              <span className={cn('text-[12px] font-mono ml-auto', styles.textMuted)}>
                {filteredLocations.length} of {locations.length}
              </span>
            )}
          </div>

          {/* ── Table View ── */}
          {viewMode === 'table' ? (
            <div className={cn('border rounded-lg overflow-hidden', styles.border)}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={cn(styles.headerBg)}>
                      <th className="text-left px-3 py-2.5 font-medium">
                        <button
                          onClick={() => handleSort('code')}
                          className={cn(
                            'flex items-center gap-1 hover:text-amber-400',
                            styles.textMuted
                          )}
                        >
                          Code <SortIcon col="code" />
                        </button>
                      </th>
                      <th className="text-left px-3 py-2.5 font-medium">
                        <button
                          onClick={() => handleSort('name')}
                          className={cn(
                            'flex items-center gap-1 hover:text-amber-400',
                            styles.textMuted
                          )}
                        >
                          Name <SortIcon col="name" />
                        </button>
                      </th>
                      <th className="text-left px-3 py-2.5 font-medium">
                        <button
                          onClick={() => handleSort('country')}
                          className={cn(
                            'flex items-center gap-1 hover:text-amber-400',
                            styles.textMuted
                          )}
                        >
                          Location <SortIcon col="country" />
                        </button>
                      </th>
                      <th className={cn('text-left px-3 py-2.5 font-medium', styles.textMuted)}>
                        Contact
                      </th>
                      {locationStatsAvailable && (
                        <>
                          <th className="text-right px-3 py-2.5 font-medium">
                            <button
                              onClick={() => handleSort('net_quantity')}
                              className={cn(
                                'flex items-center gap-1 ml-auto hover:text-amber-400',
                                styles.textMuted
                              )}
                            >
                              Net Qty <SortIcon col="net_quantity" />
                            </button>
                          </th>
                          <th className="text-right px-3 py-2.5 font-medium">
                            <button
                              onClick={() => handleSort('total_cost')}
                              className={cn(
                                'flex items-center gap-1 ml-auto hover:text-amber-400',
                                styles.textMuted
                              )}
                            >
                              Value <SortIcon col="total_cost" />
                            </button>
                          </th>
                          <th className="text-right px-3 py-2.5 font-medium">
                            <button
                              onClick={() => handleSort('purchases_cost')}
                              className={cn(
                                'flex items-center gap-1 ml-auto hover:text-amber-400',
                                styles.textMuted
                              )}
                            >
                              Purchases <SortIcon col="purchases_cost" />
                            </button>
                          </th>
                          <th className="text-right px-3 py-2.5 font-medium">
                            <button
                              onClick={() => handleSort('sales_cost')}
                              className={cn(
                                'flex items-center gap-1 ml-auto hover:text-amber-400',
                                styles.textMuted
                              )}
                            >
                              Sales <SortIcon col="sales_cost" />
                            </button>
                          </th>
                          <th className="text-right px-3 py-2.5 font-medium">
                            <button
                              onClick={() => handleSort('unique_items')}
                              className={cn(
                                'flex items-center gap-1 ml-auto hover:text-amber-400',
                                styles.textMuted
                              )}
                            >
                              Items <SortIcon col="unique_items" />
                            </button>
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLocations.map((loc, idx) => {
                      const stats = loc.inventory_stats
                      const cityLine = [loc.city, loc.state].filter(Boolean).join(', ')
                      return (
                        <React.Fragment key={loc.code}>
                          <tr
                            onClick={() =>
                              setSelectedLocation((prev) => (prev?.code === loc.code ? null : loc))
                            }
                            className={cn(
                              'border-t transition-colors cursor-pointer',
                              styles.border,
                              idx % 2 === 0 ? '' : styles.rowBg,
                              styles.rowHover
                            )}
                          >
                            <td className={cn('px-3 py-2.5 font-mono text-xs', styles.textMuted)}>
                              {loc.code}
                            </td>
                            <td className={cn('px-3 py-2.5 font-medium', styles.text)}>
                              <div className="truncate max-w-[220px]">{loc.name}</div>
                            </td>
                            <td className={cn('px-3 py-2.5 text-xs', styles.textMuted)}>
                              <div className="truncate max-w-[180px]">
                                {cityLine && <span>{cityLine}</span>}
                                {loc.country && (
                                  <span className="ml-1 opacity-60">{loc.country}</span>
                                )}
                              </div>
                            </td>
                            <td className={cn('px-3 py-2.5 text-xs', styles.textMuted)}>
                              <div className="flex items-center gap-2 truncate max-w-[180px]">
                                {loc.contact && <span className="truncate">{loc.contact}</span>}
                                {loc.phoneNumber && !loc.contact && (
                                  <span className="font-mono">{loc.phoneNumber}</span>
                                )}
                                {loc.email && !loc.contact && !loc.phoneNumber && (
                                  <span className="truncate">{loc.email}</span>
                                )}
                                {!loc.contact && !loc.phoneNumber && !loc.email && (
                                  <span className="opacity-40">—</span>
                                )}
                              </div>
                            </td>
                            {locationStatsAvailable && (
                              <>
                                <td
                                  className={cn(
                                    'px-3 py-2.5 text-right font-mono tabular-nums',
                                    styles.text
                                  )}
                                >
                                  {stats ? (
                                    Math.round(stats.net_quantity).toLocaleString()
                                  ) : (
                                    <span className="opacity-30">—</span>
                                  )}
                                </td>
                                <td
                                  className={cn(
                                    'px-3 py-2.5 text-right font-mono tabular-nums font-semibold',
                                    styles.text
                                  )}
                                >
                                  {stats ? (
                                    formatCompactCurrency(stats.total_cost, cur)
                                  ) : (
                                    <span className="opacity-30">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-green-400">
                                  {stats ? (
                                    formatCompactCurrency(stats.purchases_cost, cur)
                                  ) : (
                                    <span className="opacity-30">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-blue-400">
                                  {stats ? (
                                    formatCompactCurrency(stats.sales_cost, cur)
                                  ) : (
                                    <span className="opacity-30">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-amber-400">
                                  {stats ? (
                                    stats.unique_items
                                  ) : (
                                    <span className="opacity-30">—</span>
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                          {selectedLocation?.code === loc.code && (
                            <tr>
                              <td colSpan={100} className="p-0 border-none">
                                <LocationDetailDrawer
                                  open
                                  onClose={() => setSelectedLocation(null)}
                                  connectionId={connectionId}
                                  location={selectedLocation}
                                  currency={cur}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ── Card View ── */
            <div className="grid grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3 gap-4">
              {filteredLocations.map((loc) => {
                const addressParts = [loc.address, loc.addressLine2].filter(Boolean)
                const cityLine = [loc.city, loc.state, loc.postalCode].filter(Boolean).join(', ')
                const hasContact = loc.contact || loc.phoneNumber || loc.email
                const stats = loc.inventory_stats
                const hasStats = stats && stats.entry_count > 0

                return (
                  <React.Fragment key={loc.code}>
                    <div
                      onClick={() =>
                        setSelectedLocation((prev) => (prev?.code === loc.code ? null : loc))
                      }
                      className={cn(
                        'flex flex-col gap-3 p-4 border transition-shadow hover:shadow-md cursor-pointer',
                        styles.border,
                        styles.cardBg
                      )}
                    >
                      {/* Location header */}
                      <div className="flex items-start gap-3">
                        <div className={cn('p-1.5', isLight ? 'bg-stone-100' : 'bg-white/5')}>
                          <MapPin
                            className={cn(
                              'w-3.5 h-3.5',
                              isLight ? 'text-stone-400' : 'text-stone-500'
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn('text-[12px] font-mono', styles.textMuted)}>
                              {loc.code}
                            </span>
                            <span className={cn('text-[14px] font-medium truncate', styles.text)}>
                              {loc.name}
                            </span>
                          </div>
                          {(addressParts.length > 0 || cityLine) && (
                            <div className={cn('text-[12px] mt-0.5', styles.textMuted)}>
                              {addressParts.map((line, i) => (
                                <p key={i} className="truncate">
                                  {line}
                                </p>
                              ))}
                              {cityLine && <p className="truncate">{cityLine}</p>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Contact details */}
                      {hasContact && (
                        <div className={cn('flex flex-col gap-1.5 pt-3 border-t', styles.border)}>
                          {loc.contact && (
                            <div className="flex items-center gap-2">
                              <User className={cn('w-3 h-3 shrink-0', styles.textMuted)} />
                              <span className={cn('text-[12px] truncate', styles.text)}>
                                {loc.contact}
                              </span>
                            </div>
                          )}
                          {loc.phoneNumber && (
                            <div className="flex items-center gap-2">
                              <Phone className={cn('w-3 h-3 shrink-0', styles.textMuted)} />
                              <span className={cn('text-[12px] font-mono', styles.text)}>
                                {loc.phoneNumber}
                              </span>
                            </div>
                          )}
                          {loc.email && (
                            <div className="flex items-center gap-2">
                              <Mail className={cn('w-3 h-3 shrink-0', styles.textMuted)} />
                              <span className={cn('text-[12px] truncate', styles.text)}>
                                {loc.email}
                              </span>
                            </div>
                          )}
                          {loc.website && (
                            <div className="flex items-center gap-2">
                              <Globe className={cn('w-3 h-3 shrink-0', styles.textMuted)} />
                              <span className={cn('text-[12px] truncate', styles.text)}>
                                {loc.website}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Inventory stats */}
                      {hasStats && (
                        <div className={cn('grid grid-cols-3 gap-2 pt-3 border-t', styles.border)}>
                          <div className="p-2 bg-green-500/5 rounded">
                            <div
                              className={cn(
                                'text-[10px] uppercase tracking-wider',
                                styles.textMuted
                              )}
                            >
                              Purchases
                            </div>
                            <div className="text-[14px] font-mono font-semibold text-green-400">
                              {formatCompactCurrency(stats.purchases_cost, cur)}
                            </div>
                            <div className={cn('text-[10px]', styles.textMuted)}>
                              {stats.purchases_qty.toLocaleString()} units
                            </div>
                          </div>
                          <div className="p-2 bg-blue-500/5 rounded">
                            <div
                              className={cn(
                                'text-[10px] uppercase tracking-wider',
                                styles.textMuted
                              )}
                            >
                              Sales
                            </div>
                            <div className="text-[14px] font-mono font-semibold text-blue-400">
                              {formatCompactCurrency(stats.sales_cost, cur)}
                            </div>
                            <div className={cn('text-[10px]', styles.textMuted)}>
                              {stats.sales_qty.toLocaleString()} units
                            </div>
                          </div>
                          <div className="p-2 bg-amber-500/5 rounded">
                            <div
                              className={cn(
                                'text-[10px] uppercase tracking-wider',
                                styles.textMuted
                              )}
                            >
                              Items
                            </div>
                            <div className="text-[14px] font-mono font-semibold text-amber-400">
                              {stats.unique_items}
                            </div>
                            <div className={cn('text-[10px]', styles.textMuted)}>
                              {stats.entry_count} entries
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Net quantity + value bar */}
                      {hasStats && (
                        <div
                          className={cn(
                            'flex items-center justify-between pt-2 border-t',
                            styles.border
                          )}
                        >
                          <div>
                            <span
                              className={cn(
                                'text-[10px] uppercase tracking-wider mr-2',
                                styles.textMuted
                              )}
                            >
                              Net Qty
                            </span>
                            <span
                              className={cn(
                                'text-[14px] font-mono font-semibold tabular-nums',
                                styles.text
                              )}
                            >
                              {Math.round(stats.net_quantity).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span
                              className={cn(
                                'text-[10px] uppercase tracking-wider mr-2',
                                styles.textMuted
                              )}
                            >
                              Value
                            </span>
                            <span
                              className={cn(
                                'text-[14px] font-mono font-semibold tabular-nums',
                                styles.text
                              )}
                            >
                              {formatCompactCurrency(stats.total_cost, cur)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Country badge */}
                      {loc.country && !hasStats && (
                        <span
                          className={cn(
                            'self-start text-[12px] px-2 py-0.5',
                            isLight ? 'bg-stone-100 text-stone-500' : 'bg-white/5 text-stone-400'
                          )}
                        >
                          {loc.country}
                        </span>
                      )}
                    </div>
                    {selectedLocation?.code === loc.code && (
                      <div className="col-span-full">
                        <LocationDetailDrawer
                          open
                          onClose={() => setSelectedLocation(null)}
                          connectionId={connectionId}
                          location={selectedLocation}
                          currency={cur}
                        />
                      </div>
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center min-h-[300px]">
          <p className={cn('text-sm', styles.textMuted)}>No location data available</p>
        </div>
      )}
    </div>
  )
}
