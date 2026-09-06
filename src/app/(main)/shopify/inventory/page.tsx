'use client'

import { Fragment, useState, useMemo, useEffect, useRef } from 'react'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useShopifyInventory, useShopifySellThrough } from '../hooks/useShopifyData'
import { ReactECharts } from '@/components/chat/visualizations/shared'
import { InventoryDetailPanel } from './InventoryDetailPanel'
import type {
  ShopifyInventoryByLocation,
  ShopifyEnrichedInventoryLevel,
} from '@/lib/providers/shopify/types'
import {
  AlertTriangle,
  TrendingDown,
  DollarSign,
  ArrowDown,
  Package,
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  BarChart3,
  List,
  ShoppingCart,
  Download,
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

type SortKey =
  | 'productTitle'
  | 'variantTitle'
  | 'sku'
  | 'available'
  | 'onHand'
  | 'committed'
  | 'unitCost'
  | 'value'

export default function ShopifyInventoryPage() {
  const { connected, isLoading: connLoading } = useShopifyConnection()

  const { data, isLoading, error, mutate } = useShopifyInventory(connected)
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !data)
  }, [isLoading, data, welcomeContext])
  const { data: sellThroughData } = useShopifySellThrough(connected)
  const demandForecast = (data as any)?.demandForecast as Array<{
    productTitle: string
    available: number
    onHand: number
    incoming: number
    unitsSold30d: number
    dailyVelocity: number
    forecast7d: number
    forecast30d: number
    daysOfStock: number | null
    status: 'critical' | 'warning' | 'healthy' | 'out_of_stock' | 'no_demand'
    dailySales?: number[]
    variantsTotal: number
    variantsInStock: number
    variantsOutOfStock: number
    // Demand analytics
    weightedVelocity: number
    forecastBaseVelocity: number
    trendSlope: number
    demandTrend: 'accelerating' | 'decelerating' | 'stable'
    demandVariability: number
    stdDevDailyDemand: number
    safetyStock: number
    reorderPoint: number
    weeklyForecast?: number[]
    unitCost: number | null
  }> | null
  const [search, setSearch] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [sortKey, setSortKey] = useState<SortKey>('productTitle')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [expandedItem, setExpandedItem] = useState<number | null>(null)
  const [stockFilter, setStockFilter] = useState<'out_of_stock' | 'low_stock' | null>(null)
  const [stockHealthView, setStockHealthView] = useState<'chart' | 'table' | 'restock'>('chart')
  const [forecastRange] = useState<30>(30)
  const [selectedProducts, setSelectedProducts] = useState<Set<string> | null>(null) // null = use defaults
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [productPickerSearch, setProductPickerSearch] = useState('')
  const [forecastMethod, setForecastMethod] = useState<'trend' | 'weighted' | 'constant'>('trend')
  const [confidenceLevel, setConfidenceLevel] = useState<80 | 90 | 95>(90)
  const [targetCoverageDays, setTargetCoverageDays] = useState<30 | 60 | 90>(30)
  const productPickerRef = useRef<HTMLDivElement>(null)
  const stockChartRef = useRef<any>(null)
  const [forecastPage, setForecastPage] = useState(0)
  const FORECAST_PAGE_SIZE = 20

  // Close picker on outside click
  useEffect(() => {
    if (!productPickerOpen) return
    const handler = (e: MouseEvent) => {
      if (productPickerRef.current && !productPickerRef.current.contains(e.target as Node)) {
        setProductPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [productPickerOpen])
  const { theme } = useTheme()
  const isLight = theme === 'light'

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

  const activeLocationData = useMemo(() => {
    if (!data) return null
    const { inventoryByLocation } = data
    return selectedLocation
      ? (inventoryByLocation.find(
          (loc: ShopifyInventoryByLocation) => String(loc.location.id) === selectedLocation
        ) ?? null)
      : (inventoryByLocation[0] ?? null)
  }, [data, selectedLocation])

  const filteredLevels = useMemo(() => {
    if (!activeLocationData) return []

    let items = (activeLocationData.levels || []).filter(
      (item: ShopifyEnrichedInventoryLevel) =>
        !search ||
        item.productTitle?.toLowerCase().includes(search.toLowerCase()) ||
        item.sku?.toLowerCase().includes(search.toLowerCase())
    )

    items.sort((a, b) => {
      // When a stock filter is active, pin matching items to the top
      if (stockFilter) {
        const aMatch =
          stockFilter === 'out_of_stock'
            ? (a.available ?? 0) <= 0
            : (a.available ?? 0) > 0 && (a.available ?? 0) < 10
        const bMatch =
          stockFilter === 'out_of_stock'
            ? (b.available ?? 0) <= 0
            : (b.available ?? 0) > 0 && (b.available ?? 0) < 10
        if (aMatch !== bMatch) return aMatch ? -1 : 1
      }

      let aVal: any
      let bVal: any

      if (sortKey === 'value') {
        aVal = (a.unitCost ?? 0) * (a.onHand ?? 0)
        bVal = (b.unitCost ?? 0) * (b.onHand ?? 0)
      } else {
        aVal = a[sortKey as keyof ShopifyEnrichedInventoryLevel]
        bVal = b[sortKey as keyof ShopifyEnrichedInventoryLevel]
      }

      if (aVal == null) aVal = sortDir === 'desc' ? -Infinity : Infinity
      if (bVal == null) bVal = sortDir === 'desc' ? -Infinity : Infinity

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }

      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })

    return items
  }, [activeLocationData, search, sortKey, sortDir, stockFilter])

  const inventoryByLocation = data?.inventoryByLocation ?? []
  const summary = data?.summary
  const locations = inventoryByLocation.map((loc: ShopifyInventoryByLocation) => loc.location)

  if (connLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm theme-text-secondary">
          No Shopify connection found. Please connect via Settings.
        </p>
      </div>
    )
  }

  return (
    <div className="@container space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div
        className={cn(
          'mb-10 pt-2 pb-4 border-b shadow-sm',
          isLight
            ? 'border-stone-200/80 shadow-stone-200/50'
            : 'border-white/[0.06] shadow-black/20'
        )}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[36px] font-light theme-text-primary tracking-tight">Inventory</h1>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#7AB55C]/80 mt-2">
              Shopify
            </p>
          </div>
          <button
            onClick={() => mutate()}
            disabled={isLoading}
            className="p-1.5 theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-sm text-red-500">Failed to load inventory. Please try again.</p>
        </div>
      ) : isLoading && !data ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
        </div>
      ) : (
        <>
          {/* Metrics + Sell-Through side by side */}
          <div className="flex flex-col @xl:flex-row gap-6">
            {/* Left: KPI cards */}
            <div className="@xl:flex-1 min-w-0">
              <div className="mb-3">
                <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                  Overview
                  <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                </span>
              </div>
              <div className="grid grid-cols-2 @lg:grid-cols-3 gap-3">
                {/* Locations */}
                <div className={cn(
                  'group/kpi flex flex-col gap-1.5 px-5 py-4',
                  isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]'
                )}>
                  <span className={cn(
                    'text-[11px] font-medium tracking-wide decoration-current/15 underline-offset-2 group-hover/kpi:underline flex items-center gap-1 whitespace-nowrap',
                    isLight ? 'text-stone-500' : 'text-gray-400'
                  )}>
                    Locations
                    <InfoTooltip
                      description="Number of warehouses, stores, or fulfillment centers tracking inventory."
                      calculationTooltip={{
                        formula: 'Count of active inventory locations',
                        components: [
                          { label: 'Locations', value: String(summary?.totalLocations ?? 0), highlight: true },
                        ],
                      }}
                    />
                  </span>
                  <span className={cn(
                    'text-[22px] font-semibold font-mono tabular-nums leading-none',
                    isLight ? 'text-stone-900' : 'text-white'
                  )}>
                    {summary?.totalLocations ?? 0}
                  </span>
                </div>

                {/* Tracked Items */}
                <div className={cn(
                  'group/kpi flex flex-col gap-1.5 px-5 py-4',
                  isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]'
                )}>
                  <span className={cn(
                    'text-[11px] font-medium tracking-wide decoration-current/15 underline-offset-2 group-hover/kpi:underline flex items-center gap-1 whitespace-nowrap',
                    isLight ? 'text-stone-500' : 'text-gray-400'
                  )}>
                    Tracked Items
                    <InfoTooltip
                      description="Product variants with inventory tracking enabled."
                      calculationTooltip={{
                        formula: 'Count of variants where tracked = true',
                        components: [
                          { label: 'Tracked Variants', value: String(summary?.totalTrackedItems ?? 0), highlight: true },
                        ],
                      }}
                    />
                  </span>
                  <span className={cn(
                    'text-[22px] font-semibold font-mono tabular-nums leading-none',
                    isLight ? 'text-stone-900' : 'text-white'
                  )}>
                    {summary?.totalTrackedItems ?? 0}
                  </span>
                </div>

                {/* Available Units */}
                <div className={cn(
                  'group/kpi flex flex-col gap-1.5 px-5 py-4',
                  isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]'
                )}>
                  <span className={cn(
                    'text-[11px] font-medium tracking-wide decoration-current/15 underline-offset-2 group-hover/kpi:underline flex items-center gap-1 whitespace-nowrap',
                    isLight ? 'text-stone-500' : 'text-gray-400'
                  )}>
                    Available Units
                    <InfoTooltip
                      description="Units available for new sales across all locations."
                      calculationTooltip={{
                        formula: 'On Hand − Committed',
                        components: [
                          { label: 'On Hand', value: (summary?.totalOnHand ?? 0).toLocaleString() },
                          { label: '− Committed', value: (summary?.totalCommitted ?? 0).toLocaleString() },
                          { label: '= Available', value: (summary?.totalAvailableUnits ?? 0).toLocaleString(), highlight: true },
                        ],
                      }}
                    />
                  </span>
                  <span className={cn(
                    'text-[22px] font-semibold font-mono tabular-nums leading-none',
                    isLight ? 'text-stone-900' : 'text-white'
                  )}>
                    {(summary?.totalAvailableUnits ?? 0).toLocaleString()}
                  </span>
                </div>

                {/* On Hand */}
                {summary?.totalOnHand != null && (
                  <div className={cn(
                    'group/kpi flex flex-col gap-1.5 px-5 py-4',
                    isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]'
                  )}>
                    <span className={cn(
                      'text-[11px] font-medium tracking-wide decoration-current/15 underline-offset-2 group-hover/kpi:underline flex items-center gap-1 whitespace-nowrap',
                      isLight ? 'text-stone-500' : 'text-gray-400'
                    )}>
                      <Package className="w-3 h-3" />
                      On Hand
                      <InfoTooltip
                        description="Total units physically in stock, including committed."
                        calculationTooltip={{
                          formula: 'Available + Committed',
                          components: [
                            { label: 'Available', value: (summary?.totalAvailableUnits ?? 0).toLocaleString() },
                            { label: '+ Committed', value: (summary?.totalCommitted ?? 0).toLocaleString() },
                            { label: '= On Hand', value: (summary?.totalOnHand ?? 0).toLocaleString(), highlight: true },
                          ],
                        }}
                      />
                    </span>
                    <span className={cn(
                      'text-[22px] font-semibold font-mono tabular-nums leading-none',
                      isLight ? 'text-stone-900' : 'text-white'
                    )}>
                      {summary?.totalOnHand?.toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Committed */}
                {summary?.totalCommitted != null && (
                  <div className={cn(
                    'group/kpi flex flex-col gap-1.5 px-5 py-4',
                    isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]'
                  )}>
                    <span className={cn(
                      'text-[11px] font-medium tracking-wide decoration-current/15 underline-offset-2 group-hover/kpi:underline flex items-center gap-1 whitespace-nowrap',
                      isLight ? 'text-stone-500' : 'text-gray-400'
                    )}>
                      Committed
                      <InfoTooltip
                        description="Units reserved for unfulfilled orders — on hand but not available for new sales."
                        calculationTooltip={{
                          formula: 'On Hand − Available',
                          components: [
                            { label: 'On Hand', value: (summary?.totalOnHand ?? 0).toLocaleString() },
                            { label: '− Available', value: (summary?.totalAvailableUnits ?? 0).toLocaleString() },
                            { label: '= Committed', value: (summary?.totalCommitted ?? 0).toLocaleString(), highlight: true },
                          ],
                        }}
                      />
                    </span>
                    <span className={cn(
                      'text-[22px] font-semibold font-mono tabular-nums leading-none',
                      isLight ? 'text-amber-600' : 'text-amber-400'
                    )}>
                      {summary?.totalCommitted?.toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Incoming */}
                {summary?.totalIncoming != null && (
                  <div className={cn(
                    'group/kpi flex flex-col gap-1.5 px-5 py-4',
                    isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]'
                  )}>
                    <span className={cn(
                      'text-[11px] font-medium tracking-wide decoration-current/15 underline-offset-2 group-hover/kpi:underline flex items-center gap-1 whitespace-nowrap',
                      isLight ? 'text-stone-500' : 'text-gray-400'
                    )}>
                      <ArrowDown className="w-3 h-3" />
                      Incoming
                      <InfoTooltip
                        description="Units in transit from suppliers or transfers. Not yet received into stock."
                        calculationTooltip={{
                          formula: 'Sum of incoming quantities across all locations',
                          components: [
                            { label: 'Incoming', value: (summary?.totalIncoming ?? 0).toLocaleString(), highlight: true },
                          ],
                        }}
                      />
                    </span>
                    <span className={cn(
                      'text-[22px] font-semibold font-mono tabular-nums leading-none',
                      isLight ? 'text-blue-600' : 'text-blue-400'
                    )}>
                      {summary?.totalIncoming?.toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Inventory Value */}
                {summary?.totalInventoryValue != null && (
                  <div className={cn(
                    'group/kpi flex flex-col gap-1.5 px-5 py-4',
                    isLight ? 'bg-stone-200/60' : 'bg-white/[0.08]'
                  )}>
                    <span className={cn(
                      'text-[11px] font-medium tracking-wide decoration-current/15 underline-offset-2 group-hover/kpi:underline flex items-center gap-1 whitespace-nowrap',
                      isLight ? 'text-stone-500' : 'text-gray-400'
                    )}>
                      <DollarSign className="w-3 h-3" />
                      Inventory Value
                      <InfoTooltip
                        description="Total cost value of all on-hand inventory."
                        calculationTooltip={{
                          formula: 'Sum of (unit cost × on hand quantity) per variant',
                          components: [
                            { label: 'Total Value', value: formatCurrency(summary?.totalInventoryValue ?? 0, summary?.costCurrency || 'USD'), highlight: true },
                          ],
                        }}
                        note="Based on unit cost set in Shopify. Missing costs are excluded."
                      />
                    </span>
                    <span className={cn(
                      'text-[22px] font-semibold font-mono tabular-nums leading-none',
                      isLight ? 'text-stone-900' : 'text-white'
                    )}>
                      {formatCurrency(summary?.totalInventoryValue ?? 0, summary?.costCurrency || 'USD')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Sell-Through Rate Chart */}
            {sellThroughData?.sellThroughRate?.length > 0 && (
              <div className={cn(
                '@xl:flex-1 min-w-0 group relative rounded-[4px] transition-all duration-300 ease-out hover:scale-[1.01] origin-center',
                isLight
                  ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)]'
                  : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]'
              )}>
                <div className="mb-3">
                  <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                    Sell-Through Rate · Last 30 days
                    <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                  </span>
                </div>
                {/* Progress bar list with fade edges */}
                <div className="relative">
                  <div
                    className={cn(
                      'pointer-events-none absolute top-0 left-0 right-0 h-6 z-10 transition-opacity duration-200',
                      isLight
                        ? 'bg-gradient-to-b from-[#f1f5f9] to-transparent'
                        : 'bg-gradient-to-b from-[#000000] to-transparent'
                    )}
                    style={{ opacity: 0 }}
                    id="sell-through-fade-top"
                  />
                  <div
                    className="overflow-y-auto max-h-[280px] styled-scrollbar space-y-1.5"
                    onScroll={(e) => {
                      const el = e.currentTarget
                      const topFade = document.getElementById('sell-through-fade-top')
                      const bottomFade = document.getElementById('sell-through-fade-bottom')
                      if (topFade) topFade.style.opacity = el.scrollTop > 4 ? '1' : '0'
                      if (bottomFade) bottomFade.style.opacity = el.scrollTop + el.clientHeight < el.scrollHeight - 4 ? '1' : '0'
                    }}
                  >
                    {sellThroughData.sellThroughRate.map((item: any, i: number) => {
                      const rate = item.sellThroughRate ?? 0
                      const pct = (rate * 100).toFixed(0)
                      const unitsSold = item.unitsSold ?? 0
                      const pillColor = rate >= 0.7
                        ? isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-400'
                        : rate >= 0.3
                          ? isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400'
                          : isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-400'

                      return (
                        <div
                          key={item.name || i}
                          className={cn(
                            'flex items-center gap-3 px-2 py-1.5 rounded transition-colors',
                            i % 2 === 0
                              ? isLight ? 'bg-stone-100/60' : 'bg-white/[0.03]'
                              : '',
                            isLight ? 'hover:bg-stone-200/60' : 'hover:bg-white/[0.06]'
                          )}
                        >
                          <span className={cn(
                            'text-[12px] font-mono tabular-nums w-[20px] text-right',
                            isLight ? 'text-stone-400' : 'text-stone-600'
                          )}>
                            {i + 1}
                          </span>
                          <span className={cn(
                            'text-[12px] flex-1 truncate',
                            isLight ? 'text-stone-800' : 'text-stone-200'
                          )}>
                            {item.name}
                          </span>
                          <span className={cn(
                            'text-[12px] font-mono tabular-nums px-2 py-0.5 rounded-full font-medium',
                            pillColor
                          )}>
                            {pct}%
                          </span>
                          <span className={cn(
                            'text-[12px] font-mono tabular-nums w-[55px] text-right',
                            isLight ? 'text-stone-500' : 'text-stone-400'
                          )}>
                            {unitsSold} sold
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <div
                    className={cn(
                      'pointer-events-none absolute bottom-0 left-0 right-0 h-8 z-10 transition-opacity duration-200',
                      isLight
                        ? 'bg-gradient-to-t from-[#f1f5f9] to-transparent'
                        : 'bg-gradient-to-t from-[#000000] to-transparent'
                    )}
                    id="sell-through-fade-bottom"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Low stock / Out of stock alerts */}
          {((summary?.lowStockCount || 0) > 0 || (summary?.outOfStockCount || 0) > 0) && (
            <div className="flex flex-wrap gap-3">
              {(summary?.outOfStockCount || 0) > 0 && (
                <button
                  onClick={() =>
                    setStockFilter((f) => (f === 'out_of_stock' ? null : 'out_of_stock'))
                  }
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
                    stockFilter === 'out_of_stock'
                      ? 'border-red-500 bg-red-100 dark:bg-red-900/40 ring-1 ring-red-500/50'
                      : 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 hover:border-red-300 dark:hover:border-red-800'
                  )}
                >
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-600 dark:text-red-400">
                    {summary?.outOfStockCount} items out of stock
                  </span>
                </button>
              )}
              {(summary?.lowStockCount || 0) > 0 && (
                <button
                  onClick={() => setStockFilter((f) => (f === 'low_stock' ? null : 'low_stock'))}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
                    stockFilter === 'low_stock'
                      ? 'border-yellow-500 bg-yellow-100 dark:bg-yellow-900/40 ring-1 ring-yellow-500/50'
                      : 'border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-900/20 hover:border-yellow-300 dark:hover:border-yellow-800'
                  )}
                >
                  <TrendingDown className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-yellow-600 dark:text-yellow-400">
                    {summary?.lowStockCount} items low stock
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Stock Health — Per-product demand forecast */}
          {demandForecast &&
            demandForecast.length > 0 &&
            (() => {
              const gridColor = !isLight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
              const labelColor = !isLight ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'
              const chartItems = demandForecast.slice(0, 15)
              const statusColors = {
                out_of_stock: 'text-red-500 bg-red-500/10',
                critical: 'text-red-400 bg-red-400/10',
                warning: 'text-amber-400 bg-amber-400/10',
                healthy: 'text-emerald-400 bg-emerald-400/10',
                no_demand: 'text-stone-400 bg-stone-400/10',
              }
              const statusLabel = {
                out_of_stock: 'Out of Stock',
                critical: 'Critical',
                warning: 'Low Stock',
                healthy: 'Healthy',
                no_demand: 'No Demand',
              }

              return (
                <div className={cn(
                  'pt-2 group relative rounded-[4px] transition-all duration-300 ease-out hover:scale-[1.01] origin-center',
                  isLight
                    ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)]'
                    : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]'
                )}>
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                        Stock Health
                        <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                      </span>
                      <InfoTooltip
                        description="Per-product demand analysis using 30 days of daily sales data. Forecasting uses trend regression, weighted velocity, or linear projection with statistical confidence bands."
                        calculationTooltip={{
                          formula: 'Trend: demand(d) = base_velocity + slope × d',
                          components: [
                            {
                              label: 'Trend',
                              value: 'Linear regression on daily sales for curved projection',
                            },
                            {
                              label: 'Weighted',
                              value:
                                'Exponentially weighted recent velocity (recent days count more)',
                            },
                            {
                              label: 'Linear',
                              value: 'Simple average daily velocity (constant rate)',
                            },
                            {
                              label: 'Confidence band',
                              value: 'Z × σ × √d — widens with forecast horizon',
                            },
                            { label: 'Safety stock', value: 'Z(95%) × σ_daily × √(lead_time)' },
                          ],
                        }}
                      />
                    </div>
                    <div
                      className={cn(
                        'flex rounded-lg border overflow-hidden',
                        isLight ? 'border-stone-200' : 'border-white/[0.08]'
                      )}
                    >
                      <button
                        onClick={() => setStockHealthView('chart')}
                        className={cn(
                          'px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors',
                          stockHealthView === 'chart'
                            ? isLight
                              ? 'bg-stone-100 text-stone-900'
                              : 'bg-white/[0.08] text-white'
                            : 'theme-text-secondary hover:theme-text-primary'
                        )}
                      >
                        <BarChart3 className="w-3.5 h-3.5" /> Chart
                      </button>
                      <button
                        onClick={() => setStockHealthView('table')}
                        className={cn(
                          'px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors',
                          stockHealthView === 'table'
                            ? isLight
                              ? 'bg-stone-100 text-stone-900'
                              : 'bg-white/[0.08] text-white'
                            : 'theme-text-secondary hover:theme-text-primary'
                        )}
                      >
                        <List className="w-3.5 h-3.5" /> Table
                      </button>
                      <button
                        onClick={() => setStockHealthView('restock')}
                        className={cn(
                          'px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors',
                          stockHealthView === 'restock'
                            ? isLight
                              ? 'bg-stone-100 text-stone-900'
                              : 'bg-white/[0.08] text-white'
                            : 'theme-text-secondary hover:theme-text-primary'
                        )}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" /> Restock
                      </button>
                    </div>
                  </div>

                  {stockHealthView === 'chart' ? (
                    (() => {
                      // Monthly history (12 months) + weekly forecast (8 weeks / 2 months)
                      const FORECAST_DAYS = forecastRange
                      const FORECAST_WEEKS = 8
                      const today = new Date()

                      // Build 12 monthly history points
                      const monthDates: Date[] = []
                      const labels: string[] = []
                      const quarterLabels: { idx: number; label: string }[] = []
                      for (let m = 11; m >= 0; m--) {
                        const d = new Date(today.getFullYear(), today.getMonth() - m, 1)
                        monthDates.push(d)
                        const monthName = d.toLocaleDateString('en-US', { month: 'short' })
                        labels.push(monthName)
                        // Mark quarter starts
                        if (d.getMonth() % 3 === 0) {
                          const qNum = Math.floor(d.getMonth() / 3) + 1
                          const yr = String(d.getFullYear()).slice(2)
                          quarterLabels.push({ idx: labels.length - 1, label: `Q${qNum}'${yr}` })
                        }
                      }
                      // "Today" point
                      const todayIdx = labels.length
                      labels.push('Today')
                      monthDates.push(today)
                      // 4 weekly forecast points
                      for (let w = 1; w <= FORECAST_WEEKS; w++) {
                        const d = new Date(today)
                        d.setDate(d.getDate() + w * 7)
                        monthDates.push(d)
                        labels.push(
                          d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        )
                      }
                      const totalPts = labels.length // 12 + 1 + 4 = 17

                      const allEligible = (demandForecast ?? []).filter(
                        (d) => d.dailyVelocity > 0 && d.available > 0
                      )
                      const defaults = new Set(allEligible.slice(0, 5).map((d) => d.productTitle))
                      const activeSelection =
                        selectedProducts !== null ? selectedProducts : defaults
                      const topItems = allEligible.filter((d) =>
                        activeSelection.has(d.productTitle)
                      )
                      const colors = [
                        '#ef4444',
                        '#f59e0b',
                        '#8b5cf6',
                        '#3b82f6',
                        '#10b981',
                        '#06b6d4',
                        '#ec4899',
                        '#f97316',
                        '#84cc16',
                        '#14b8a6',
                      ]
                      const filteredPicker = (demandForecast ?? [])
                        .filter(
                          (d) =>
                            !productPickerSearch ||
                            d.productTitle.toLowerCase().includes(productPickerSearch.toLowerCase())
                        )
                        .sort((a, b) => b.unitsSold30d - a.unitsSold30d)

                      const truncate = (s: string, n: number) =>
                        s.length > n ? s.slice(0, n) + '...' : s

                      const CI_Z =
                        confidenceLevel === 95 ? 1.96 : confidenceLevel === 90 ? 1.65 : 1.28

                      // Pre-compute stockout info using DES weekly forecast
                      const productMeta = topItems.map((item) => {
                        const wf = item.weeklyForecast ?? []
                        let cumDemand = 0
                        let stockoutDay: number | null = null
                        // Use DES forecast for first 8 weeks, then extrapolate
                        for (let w = 0; w < 52; w++) {
                          const weekDemand =
                            w < wf.length ? wf[w] : (wf[wf.length - 1] ?? item.dailyVelocity * 7)
                          cumDemand += weekDemand
                          if (stockoutDay === null && item.available - cumDemand <= 0) {
                            stockoutDay = (w + 1) * 7
                          }
                        }
                        const stockoutDate =
                          stockoutDay !== null
                            ? new Date(today.getTime() + stockoutDay * 86400000)
                            : null
                        return { ...item, stockoutDay, stockoutDate, daysLeft: item.daysOfStock }
                      })

                      // Pre-compute per-product stock history + forecast for demand derivation
                      const productStockArrays = topItems.map((item) => {
                        const allSales = item.dailySales ?? []
                        const pts: number[] = []
                        // History: reconstruct monthly stock levels
                        for (let pi = 0; pi < totalPts; pi++) {
                          if (pi === todayIdx) {
                            pts.push(item.available)
                          } else if (pi < todayIdx) {
                            const monthsBack = todayIdx - 1 - pi
                            const daysBack = monthsBack * 30 + today.getDate()
                            if (allSales.length > 0) {
                              const dayIdx = allSales.length - daysBack
                              if (dayIdx >= 0) {
                                const soldSince = allSales.slice(dayIdx).reduce((s, v) => s + v, 0)
                                pts.push(Math.round(item.available + soldSince))
                              } else {
                                const totalSold = allSales.reduce((s, v) => s + v, 0)
                                pts.push(
                                  Math.round(
                                    item.available +
                                      totalSold +
                                      item.dailyVelocity * Math.abs(dayIdx)
                                  )
                                )
                              }
                            } else {
                              pts.push(Math.round(item.available + item.dailyVelocity * daysBack))
                            }
                          } else {
                            // Forecast: use DES weekly forecast
                            const weekNum = pi - todayIdx
                            const wf = item.weeklyForecast ?? []
                            const prevStock = pts[pts.length - 1] ?? item.available
                            const weekDemand =
                              weekNum > 0 && weekNum <= wf.length
                                ? wf[weekNum - 1]
                                : (wf[wf.length - 1] ?? item.dailyVelocity * 7)
                            pts.push(Math.max(0, +(prevStock - weekDemand).toFixed(1)))
                          }
                        }
                        return pts
                      })

                      // Demand = stock drop between consecutive points, summed across products
                      const demandData: (number | null)[] = labels.map((_, pi) => {
                        if (pi === 0) return null // no previous point to diff from
                        let totalDemand = 0
                        for (let p = 0; p < productStockArrays.length; p++) {
                          const prev = productStockArrays[p][pi - 1] ?? 0
                          const curr = productStockArrays[p][pi] ?? 0
                          // Demand = how much stock dropped (positive = sold)
                          totalDemand += Math.max(0, prev - curr)
                        }
                        return +totalDemand.toFixed(1)
                      })

                      return (
                        <div>
                          {/* Subtitle + product picker */}
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[12px] theme-text-secondary">
                              Projected stock remaining over time &middot; lines show how each
                              product's inventory depletes from today forward
                            </p>
                            <div className="relative" ref={productPickerRef}>
                              <button
                                onClick={() => setProductPickerOpen(!productPickerOpen)}
                                className={cn(
                                  'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                                  isLight
                                    ? 'border-stone-200 hover:bg-stone-50'
                                    : 'border-white/[0.08] hover:bg-white/[0.04]',
                                  productPickerOpen && (isLight ? 'bg-stone-50' : 'bg-white/[0.04]')
                                )}
                              >
                                <Package className="w-3.5 h-3.5" />
                                {topItems.length} product{topItems.length !== 1 ? 's' : ''} selected
                                <ChevronDown
                                  className={cn(
                                    'w-3 h-3 transition-transform',
                                    productPickerOpen && 'rotate-180'
                                  )}
                                />
                              </button>
                              {productPickerOpen && (
                                <div
                                  className={cn(
                                    'absolute right-0 top-full mt-1 z-50 w-72 rounded-lg border shadow-xl',
                                    isLight
                                      ? 'bg-white border-stone-200'
                                      : 'bg-[#1a1a1a] border-white/[0.08]'
                                  )}
                                >
                                  <div
                                    className="p-2 border-b"
                                    style={{
                                      borderColor: isLight ? '#e5e7eb' : 'rgba(255,255,255,0.06)',
                                    }}
                                  >
                                    <input
                                      type="text"
                                      placeholder="Search products..."
                                      value={productPickerSearch}
                                      onChange={(e) => setProductPickerSearch(e.target.value)}
                                      className={cn(
                                        'w-full px-2 py-1.5 text-xs rounded border bg-transparent focus:outline-none focus:border-amber-500/40',
                                        isLight ? 'border-stone-200' : 'border-white/[0.08]'
                                      )}
                                    />
                                  </div>
                                  <div className="max-h-52 overflow-y-auto p-1">
                                    {filteredPicker.map((item) => {
                                      const isSelected = activeSelection.has(item.productTitle)
                                      return (
                                        <button
                                          key={item.productTitle}
                                          onClick={() => {
                                            const next = new Set(activeSelection)
                                            if (isSelected) next.delete(item.productTitle)
                                            else next.add(item.productTitle)
                                            setSelectedProducts(next)
                                          }}
                                          className={cn(
                                            'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors',
                                            isLight ? 'hover:bg-stone-50' : 'hover:bg-white/[0.04]'
                                          )}
                                        >
                                          <span
                                            className={cn(
                                              'w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                                              isSelected
                                                ? 'bg-amber-500 border-amber-500'
                                                : isLight
                                                  ? 'border-stone-300'
                                                  : 'border-white/20'
                                            )}
                                          >
                                            {isSelected && (
                                              <span className="text-white text-[9px]">✓</span>
                                            )}
                                          </span>
                                          <span
                                            className={cn(
                                              'flex-1 truncate',
                                              isLight ? 'text-stone-700' : 'text-white/80'
                                            )}
                                          >
                                            {item.productTitle}
                                          </span>
                                          <span className="text-[12px] font-mono text-stone-500">
                                            {item.unitsSold30d} sold
                                          </span>
                                        </button>
                                      )
                                    })}
                                  </div>
                                  <div
                                    className="p-1.5 border-t flex gap-1"
                                    style={{
                                      borderColor: isLight ? '#e5e7eb' : 'rgba(255,255,255,0.06)',
                                    }}
                                  >
                                    <button
                                      onClick={() =>
                                        setSelectedProducts(
                                          new Set(allEligible.map((d) => d.productTitle))
                                        )
                                      }
                                      className="flex-1 text-[12px] py-1 rounded theme-text-secondary hover:theme-text-primary transition-colors"
                                    >
                                      Select All
                                    </button>
                                    <button
                                      onClick={() => setSelectedProducts(new Set())}
                                      className="flex-1 text-[12px] py-1 rounded theme-text-secondary hover:theme-text-primary transition-colors"
                                    >
                                      Clear All
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedProducts(null)
                                        setProductPickerOpen(false)
                                      }}
                                      className="flex-1 text-[12px] py-1 rounded text-amber-500 hover:text-amber-400 transition-colors"
                                    >
                                      Reset Default
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Chart + right sidebar layout */}
                          <div className="flex gap-0">
                            {/* Chart area — track mouse Y for nearest-line tooltip */}
                            <div className="flex-1 min-w-0">
                              <ReactECharts
                                key={`sh-${forecastRange}-${forecastMethod}-${confidenceLevel}-${topItems.map((d) => d.productTitle).join(',')}`}
                                notMerge={true}
                                onChartReady={(instance: any) => {
                                  stockChartRef.current = instance
                                  // Track mouse Y in canvas coordinates (same space as convertToPixel)
                                  instance.getZr().on('mousemove', (e: any) => {
                                    ;(window as any).__stockChartMouseY = e.offsetY
                                  })
                                }}
                                option={{
                                  tooltip: {
                                    trigger: 'axis' as const,
                                    axisPointer: {
                                      type: 'none' as const,
                                    },
                                    backgroundColor: !isLight ? '#1c1c1c' : '#fff',
                                    borderColor: !isLight
                                      ? 'rgba(255,255,255,0.1)'
                                      : 'rgba(0,0,0,0.1)',
                                    textStyle: {
                                      color: !isLight ? '#e0e0e0' : '#333',
                                      fontSize: 12,
                                    },
                                    formatter: (params: any) => {
                                      const arr = (
                                        Array.isArray(params) ? params : [params]
                                      ).filter(
                                        (p: any) =>
                                          p.value != null &&
                                          !p.seriesName?.startsWith('_') &&
                                          p.seriesName !== 'Demand'
                                      )
                                      // Deduplicate (history + forecast share names)
                                      const seen = new Set<string>()
                                      const products = arr.filter((p: any) => {
                                        if (seen.has(p.seriesName)) return false
                                        seen.add(p.seriesName)
                                        return true
                                      })
                                      if (products.length === 0) return ''

                                      const period =
                                        (Array.isArray(params) ? params : [params])[0]?.axisValue ??
                                        ''
                                      const di =
                                        (Array.isArray(params) ? params : [params])[0]?.dataIndex ??
                                        0
                                      const isForecast = di >= todayIdx

                                      // Find which product line is closest to cursor Y
                                      // using ECharts' own coordinate conversion (no manual math)
                                      const mouseY = (window as any).__stockChartMouseY ?? 0
                                      const chart = stockChartRef.current
                                      let p = products[0]
                                      let closestDist = Infinity
                                      if (chart) {
                                        for (const candidate of products) {
                                          if (candidate.value == null) continue
                                          const pixel = chart.convertToPixel({ gridIndex: 0 }, [
                                            di,
                                            candidate.value,
                                          ])
                                          if (pixel) {
                                            const dist = Math.abs(mouseY - pixel[1])
                                            if (dist < closestDist) {
                                              closestDist = dist
                                              p = candidate
                                            }
                                          }
                                        }
                                      }
                                      // Only show tooltip when cursor is near a line (within 20px)
                                      if (closestDist > 20) return ''
                                      const meta = productMeta.find(
                                        (m) => truncate(m.productTitle, 30) === p.seriesName
                                      )
                                      if (!meta) return ''
                                      const units =
                                        typeof p.value === 'number'
                                          ? p.value % 1 === 0
                                            ? p.value
                                            : p.value.toFixed(1)
                                          : p.value
                                      const daysColor =
                                        (meta.daysLeft ?? 999) <= 14
                                          ? '#ef4444'
                                          : (meta.daysLeft ?? 999) > 60
                                            ? '#10b981'
                                            : '#f59e0b'
                                      const stockoutStr = meta.stockoutDate
                                        ? `<div style="margin-top:4px">Stockout Date: <span style="color:#ef4444;font-weight:600">${meta.stockoutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>`
                                        : ''
                                      return `<div style="padding:4px 2px;min-width:200px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}"></span><span style="font-size:13px;font-weight:700">${meta.productTitle}</span></div><div style="font-size:11px;line-height:1.8">Stock${isForecast ? ' (forecast)' : ''}: <strong>${units}</strong><br/>Current Stock: <strong>${meta.available}</strong><br/>Days Remaining: <strong style="color:${daysColor}">${meta.daysLeft ?? '--'}</strong><br/>Demand (30d): <strong style="color:#f59e0b">${meta.unitsSold30d} units</strong>${stockoutStr}</div></div>`
                                    },
                                  },
                                  legend: {
                                    bottom: 0,
                                    textStyle: { color: labelColor, fontSize: 12 },
                                    itemWidth: 14,
                                    itemHeight: 2,
                                    icon: 'roundRect',
                                    data: [
                                      ...topItems.map((d) => truncate(d.productTitle, 25)),
                                      'Demand',
                                    ],
                                  },
                                  grid: { top: 16, right: 50, bottom: 52, left: 44 },
                                  xAxis: {
                                    type: 'category' as const,
                                    data: labels,
                                    axisLabel: {
                                      color: labelColor,
                                      fontSize: 12,
                                      interval: 0,
                                    },
                                    axisLine: { lineStyle: { color: gridColor } },
                                    axisTick: { alignWithLabel: true, interval: 0 },
                                    // Highlight forecast zone
                                    splitArea: {
                                      show: true,
                                      areaStyle: {
                                        color: labels.map((_, i) =>
                                          i > todayIdx
                                            ? !isLight
                                              ? 'rgba(255,255,255,0.02)'
                                              : 'rgba(0,0,0,0.02)'
                                            : 'transparent'
                                        ),
                                      },
                                    },
                                  },
                                  yAxis: [
                                    {
                                      type: 'value' as const,
                                      axisLabel: {
                                        color: labelColor,
                                        fontSize: 12,
                                        formatter: (v: number) => Math.round(v).toString(),
                                      },
                                      splitLine: {
                                        lineStyle: {
                                          color: gridColor,
                                          type: 'dashed' as const,
                                        },
                                      },
                                      min: 0,
                                      minInterval: 1,
                                    },
                                    {
                                      type: 'value' as const,
                                      name: 'demand/mo',
                                      nameTextStyle: {
                                        color: '#f59e0b80',
                                        fontSize: 12,
                                      },
                                      axisLabel: {
                                        color: '#f59e0b80',
                                        fontSize: 12,
                                        formatter: (v: number) => Math.round(v).toString(),
                                      },
                                      splitLine: { show: false },
                                      min: 0,
                                    },
                                  ],
                                  series: [
                                    // Demand — dotted line on secondary y-axis (distinct from solid/dashed stock lines)
                                    {
                                      name: 'Demand',
                                      type: 'line' as const,
                                      yAxisIndex: 1,
                                      smooth: 0.3,
                                      showSymbol: false,
                                      silent: true,
                                      lineStyle: {
                                        color: '#f59e0b',
                                        width: 2,
                                        type: 'dotted' as const,
                                      },
                                      data: demandData,
                                      z: 1,
                                    },
                                    // "Today" divider
                                    {
                                      name: '_today',
                                      type: 'line' as const,
                                      markLine: {
                                        silent: true,
                                        symbol: 'none',
                                        lineStyle: {
                                          color: !isLight
                                            ? 'rgba(255,255,255,0.25)'
                                            : 'rgba(0,0,0,0.15)',
                                          type: 'dashed' as const,
                                          width: 1,
                                        },
                                        label: { show: false },
                                        data: [{ xAxis: todayIdx }],
                                      },
                                      data: [],
                                    },
                                    // Per-product stock lines
                                    ...topItems.flatMap((item, idx) => {
                                      const color = colors[idx % colors.length]
                                      const name = truncate(item.productTitle, 30)
                                      const meta = productMeta[idx]

                                      // History: monthly end-of-month stock from daily sales
                                      const allSales = item.dailySales ?? []
                                      const historyData: (number | null)[] = []
                                      for (let pi = 0; pi < totalPts; pi++) {
                                        if (pi <= todayIdx) {
                                          if (pi === todayIdx) {
                                            historyData.push(item.available)
                                          } else {
                                            // Months from today (0 = current month start)
                                            const monthsBack = todayIdx - 1 - pi
                                            const daysBack = monthsBack * 30 + today.getDate()
                                            if (allSales.length > 0) {
                                              const dayIdx = allSales.length - daysBack
                                              if (dayIdx >= 0) {
                                                const soldSince = allSales
                                                  .slice(dayIdx)
                                                  .reduce((s, v) => s + v, 0)
                                                historyData.push(
                                                  Math.round(item.available + soldSince)
                                                )
                                              } else {
                                                // Extrapolate before data range
                                                const totalSold = allSales.reduce(
                                                  (s, v) => s + v,
                                                  0
                                                )
                                                const extraDays = Math.abs(dayIdx)
                                                historyData.push(
                                                  Math.round(
                                                    item.available +
                                                      totalSold +
                                                      item.dailyVelocity * extraDays
                                                  )
                                                )
                                              }
                                            } else {
                                              historyData.push(
                                                Math.round(
                                                  item.available + item.dailyVelocity * daysBack
                                                )
                                              )
                                            }
                                          }
                                        } else {
                                          historyData.push(null)
                                        }
                                      }

                                      // Forecast: Holt-Winters DES from API (level + trend per week)
                                      const wf = item.weeklyForecast ?? []
                                      let cumDemand = 0
                                      const forecastData: (number | null)[] = []

                                      for (let pi = 0; pi < totalPts; pi++) {
                                        if (pi >= todayIdx) {
                                          const weekNum = pi - todayIdx
                                          if (weekNum === 0) {
                                            forecastData.push(item.available)
                                          } else {
                                            // Use DES weekly forecast (already unique per product)
                                            const weekDemand =
                                              weekNum <= wf.length
                                                ? wf[weekNum - 1]
                                                : (wf[wf.length - 1] ?? item.dailyVelocity * 7)
                                            cumDemand += weekDemand
                                            forecastData.push(
                                              Math.max(0, +(item.available - cumDemand).toFixed(1))
                                            )
                                          }
                                        } else {
                                          forecastData.push(null)
                                        }
                                      }

                                      // Stockout marker
                                      const stockoutWeek =
                                        meta.stockoutDay != null
                                          ? Math.ceil(meta.stockoutDay / 7)
                                          : null
                                      const stockoutMarker =
                                        stockoutWeek != null && stockoutWeek <= FORECAST_WEEKS
                                          ? {
                                              markPoint: {
                                                symbol: 'circle',
                                                symbolSize: 10,
                                                itemStyle: {
                                                  color,
                                                  borderColor: !isLight ? '#1a1a1a' : '#fff',
                                                  borderWidth: 2,
                                                },
                                                label: { show: false },
                                                data: [{ coord: [todayIdx + stockoutWeek, 0] }],
                                              },
                                            }
                                          : {}

                                      return [
                                        // Solid history line (no area fill — it blocks hover on lines below)
                                        {
                                          name,
                                          type: 'line' as const,
                                          smooth: 0.3,
                                          showSymbol: false,
                                          lineStyle: { color, width: 2.5 },
                                          itemStyle: { color },
                                          emphasis: {
                                            lineStyle: { width: 5 },
                                            focus: 'series' as const,
                                          },
                                          data: historyData,
                                          connectNulls: false,
                                          z: 2,
                                        },
                                        // Dashed forecast line
                                        {
                                          name,
                                          type: 'line' as const,
                                          smooth: 0.3,
                                          showSymbol: false,
                                          lineStyle: {
                                            color,
                                            width: 2.5,
                                            type: 'dashed' as const,
                                          },
                                          itemStyle: { color },
                                          emphasis: {
                                            lineStyle: { width: 5 },
                                            focus: 'series' as const,
                                          },
                                          ...stockoutMarker,
                                          data: forecastData,
                                          connectNulls: false,
                                          z: 2,
                                        },
                                      ]
                                    }),
                                  ],
                                }}
                                style={{ width: '100%', height: 420 }}
                                opts={{ renderer: 'canvas' }}
                              />
                            </div>

                            {/* Right sidebar */}
                            <div
                              className={cn(
                                'w-60 flex-shrink-0 rounded-lg border ml-3 self-start overflow-hidden',
                                isLight
                                  ? 'bg-stone-50/50 border-stone-200'
                                  : 'bg-white/[0.02] border-white/[0.06]'
                              )}
                            >
                              {/* Demand summary */}
                              {(() => {
                                const histDemand = demandData
                                  .slice(0, todayIdx)
                                  .filter((v): v is number => v !== null)
                                const totalDemand = histDemand.reduce((s, v) => s + v, 0)
                                const avgMonthly = Math.round(
                                  totalDemand / Math.max(histDemand.length, 1)
                                )
                                return (
                                  <div
                                    className={cn(
                                      'px-3 py-2.5 border-b',
                                      isLight ? 'border-stone-200' : 'border-white/[0.06]'
                                    )}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-[12px] uppercase tracking-wider text-stone-500 font-medium">
                                        Demand (12mo)
                                      </span>
                                      <span
                                        className={cn(
                                          'text-sm font-semibold',
                                          isLight ? 'text-stone-800' : 'text-white/90'
                                        )}
                                      >
                                        {totalDemand} units
                                      </span>
                                    </div>
                                    <span className="text-[12px] text-stone-500">
                                      ~{avgMonthly}/mo avg
                                    </span>
                                  </div>
                                )
                              })()}
                              {/* Product list */}
                              <div className="p-2 space-y-0.5">
                                {productMeta.map((item, idx) => {
                                  const color = colors[idx % colors.length]
                                  const isUrgent = item.daysLeft !== null && item.daysLeft <= 14
                                  const isSafe = item.daysLeft === null || item.daysLeft > 60
                                  return (
                                    <div
                                      key={item.productTitle}
                                      className={cn(
                                        'flex items-center gap-2 py-1.5 px-2 rounded-md',
                                        isLight ? 'hover:bg-stone-100/80' : 'hover:bg-white/[0.03]'
                                      )}
                                    >
                                      <span
                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: color }}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p
                                          className={cn(
                                            'text-[12px] font-medium truncate leading-tight',
                                            isLight ? 'text-stone-700' : 'text-white/80'
                                          )}
                                        >
                                          {item.productTitle}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-px">
                                          <span className="text-[12px] text-stone-500">
                                            {item.available} in stock
                                          </span>
                                          <span className="text-[12px] text-stone-500/50">
                                            &middot;
                                          </span>
                                          <span className="text-[12px] text-stone-500">
                                            {item.unitsSold30d} sold/30d
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-end flex-shrink-0">
                                        <span
                                          className={cn(
                                            'text-[12px] font-bold',
                                            isUrgent
                                              ? 'text-red-400'
                                              : isSafe
                                                ? 'text-emerald-400'
                                                : 'text-amber-400'
                                          )}
                                        >
                                          {item.daysLeft !== null ? `${item.daysLeft}d` : '>1yr'}
                                        </span>
                                        {item.stockoutDate && (
                                          <span className="text-[12px] text-red-400/70">
                                            {item.stockoutDate.toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: 'numeric',
                                            })}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                                {productMeta.length === 0 && (
                                  <p className="text-xs text-stone-500 text-center py-4">
                                    No products selected
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Forecast method label */}
                          <div
                            className={cn(
                              'flex items-center justify-center pt-2 mt-1 border-t',
                              isLight ? 'border-stone-100' : 'border-white/[0.04]'
                            )}
                          >
                            <span className="text-[12px] text-stone-500">
                              Holt-Winters Double Exponential Smoothing (α=0.3, β=0.1)
                            </span>
                          </div>
                        </div>
                      )
                    })()
                  ) : stockHealthView === 'table' ? (
                    <div>
                      <p className="text-[12px] theme-text-secondary mb-3">
                        Projected demand &middot; how many units each product is expected to sell in
                        the next 7 and 30 days
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr
                              className={cn(
                                'border-b',
                                isLight ? 'border-stone-200' : 'border-white/[0.08]'
                              )}
                            >
                              <th className="text-left py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500">
                                Product
                              </th>
                              <th className="text-right py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500">
                                Available
                              </th>
                              <th className="text-right py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500">
                                Velocity
                              </th>
                              <th className="text-center py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500">
                                Trend
                              </th>
                              <th className="text-right py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500">
                                7d Forecast
                              </th>
                              <th className="text-right py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500">
                                30d Forecast
                              </th>
                              <th className="text-right py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500">
                                Days Left
                              </th>
                              <th className="text-right py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500">
                                Safety Stock
                              </th>
                              <th className="text-center py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {demandForecast
                              .slice(
                                forecastPage * FORECAST_PAGE_SIZE,
                                (forecastPage + 1) * FORECAST_PAGE_SIZE
                              )
                              .map((item) => {
                                const belowReorder =
                                  item.reorderPoint > 0 &&
                                  item.available <= item.reorderPoint &&
                                  item.available > 0
                                return (
                                  <tr
                                    key={item.productTitle}
                                    className={cn(
                                      'border-b transition-colors',
                                      isLight
                                        ? 'border-stone-100 hover:bg-stone-50'
                                        : 'border-white/[0.04] hover:bg-white/[0.02]'
                                    )}
                                  >
                                    <td
                                      className={cn(
                                        'py-2.5 px-3 font-medium max-w-[220px] truncate',
                                        isLight ? 'text-stone-900' : 'text-white'
                                      )}
                                    >
                                      {item.productTitle}
                                    </td>
                                    <td
                                      className={cn(
                                        'py-2.5 px-3 text-right font-mono tabular-nums',
                                        item.available <= 0
                                          ? 'text-red-400'
                                          : belowReorder
                                            ? 'text-amber-400'
                                            : isLight
                                              ? 'text-stone-900'
                                              : 'text-white'
                                      )}
                                    >
                                      {item.available}
                                      {belowReorder && (
                                        <span className="block text-[12px] text-amber-400 font-normal">
                                          below reorder
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono tabular-nums theme-text-secondary">
                                      {item.weightedVelocity ?? item.dailyVelocity}/day
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      {item.demandTrend === 'accelerating' ? (
                                        <span
                                          className="inline-flex items-center gap-1 text-xs text-red-400"
                                          title={`+${((item.trendSlope / Math.max(item.dailyVelocity, 0.1)) * 100).toFixed(0)}%/day`}
                                        >
                                          <ChevronUp className="w-3.5 h-3.5" />
                                          <span className="font-mono text-[12px]">Rising</span>
                                        </span>
                                      ) : item.demandTrend === 'decelerating' ? (
                                        <span
                                          className="inline-flex items-center gap-1 text-xs text-emerald-400"
                                          title={`${((item.trendSlope / Math.max(item.dailyVelocity, 0.1)) * 100).toFixed(0)}%/day`}
                                        >
                                          <ChevronDown className="w-3.5 h-3.5" />
                                          <span className="font-mono text-[12px]">Falling</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-xs theme-text-secondary">
                                          <span className="font-mono text-[12px]">Stable</span>
                                        </span>
                                      )}
                                      {item.demandVariability > 1 && (
                                        <span
                                          className="block text-[12px] text-amber-400 mt-0.5"
                                          title="High demand variability — forecast less reliable"
                                        >
                                          erratic
                                        </span>
                                      )}
                                    </td>
                                    <td
                                      className={cn(
                                        'py-2.5 px-3 text-right font-mono tabular-nums',
                                        item.forecast7d > item.available
                                          ? 'text-red-400'
                                          : 'theme-text-secondary'
                                      )}
                                    >
                                      {item.forecast7d} units
                                    </td>
                                    <td
                                      className={cn(
                                        'py-2.5 px-3 text-right font-mono tabular-nums',
                                        item.forecast30d > item.available
                                          ? 'text-red-400'
                                          : 'theme-text-secondary'
                                      )}
                                    >
                                      {item.forecast30d} units
                                    </td>
                                    <td
                                      className={cn(
                                        'py-2.5 px-3 text-right font-mono tabular-nums font-semibold',
                                        item.daysOfStock === null
                                          ? 'theme-text-secondary'
                                          : item.daysOfStock < 7
                                            ? 'text-red-400'
                                            : item.daysOfStock < 14
                                              ? 'text-amber-400'
                                              : 'text-emerald-400'
                                      )}
                                    >
                                      {item.daysOfStock !== null ? `${item.daysOfStock}d` : '—'}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[12px] theme-text-secondary">
                                      {item.safetyStock > 0 ? (
                                        <span title={`Reorder at ${item.reorderPoint} units`}>
                                          {item.safetyStock} units
                                        </span>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <span
                                        className={cn(
                                          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                                          statusColors[item.status]
                                        )}
                                      >
                                        {statusLabel[item.status]}
                                      </span>
                                      {item.variantsOutOfStock > 0 && item.variantsTotal > 1 && (
                                        <span className="block text-[12px] text-red-400 mt-0.5">
                                          {item.variantsOutOfStock}/{item.variantsTotal} variants
                                          out
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </table>
                        {/* Pagination */}
                        {(() => {
                          const filteredCount = demandForecast.length
                          const totalPages = Math.ceil(filteredCount / FORECAST_PAGE_SIZE)
                          return filteredCount > FORECAST_PAGE_SIZE ? (
                            <div
                              className={cn(
                                'flex items-center justify-between px-3 py-2.5 border-t',
                                isLight ? 'border-stone-200' : 'border-white/[0.08]'
                              )}
                            >
                              <span className="text-[12px] theme-text-secondary">
                                {forecastPage * FORECAST_PAGE_SIZE + 1}–
                                {Math.min((forecastPage + 1) * FORECAST_PAGE_SIZE, filteredCount)}{' '}
                                of {filteredCount} products
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setForecastPage((p) => Math.max(0, p - 1))}
                                  disabled={forecastPage === 0}
                                  className={cn(
                                    'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                                    forecastPage === 0
                                      ? 'opacity-40 cursor-not-allowed'
                                      : isLight
                                        ? 'hover:bg-stone-100'
                                        : 'hover:bg-white/[0.06]',
                                    isLight ? 'text-stone-600' : 'text-white/70'
                                  )}
                                >
                                  Prev
                                </button>
                                <span className="text-[12px] font-mono theme-text-secondary">
                                  {forecastPage + 1}/{totalPages}
                                </span>
                                <button
                                  onClick={() =>
                                    setForecastPage((p) => Math.min(totalPages - 1, p + 1))
                                  }
                                  disabled={forecastPage >= totalPages - 1}
                                  className={cn(
                                    'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                                    forecastPage >= totalPages - 1
                                      ? 'opacity-40 cursor-not-allowed'
                                      : isLight
                                        ? 'hover:bg-stone-100'
                                        : 'hover:bg-white/[0.06]',
                                    isLight ? 'text-stone-600' : 'text-white/70'
                                  )}
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          ) : null
                        })()}
                      </div>
                    </div>
                  ) : stockHealthView === 'restock' ? (
                    (() => {
                      // Restock recommendations: products needing replenishment
                      const restockItems = (demandForecast ?? [])
                        .filter((d) => d.dailyVelocity > 0 || d.available <= 0)
                        .map((item) => {
                          const velocity = item.weightedVelocity ?? item.dailyVelocity
                          const targetStock = Math.ceil(
                            velocity * targetCoverageDays + item.safetyStock
                          )
                          const currentSupply = item.available + (item.incoming || 0)
                          const restockQty = Math.max(0, targetStock - currentSupply)
                          const estimatedCost =
                            item.unitCost != null ? restockQty * item.unitCost : null
                          const urgency: 'critical' | 'urgent' | 'upcoming' | 'ok' =
                            item.available <= 0
                              ? 'critical'
                              : item.daysOfStock !== null && item.daysOfStock < 7
                                ? 'critical'
                                : item.available <= item.reorderPoint
                                  ? 'urgent'
                                  : item.daysOfStock !== null &&
                                      item.daysOfStock < targetCoverageDays
                                    ? 'upcoming'
                                    : 'ok'
                          return {
                            ...item,
                            velocity,
                            targetStock,
                            restockQty,
                            estimatedCost,
                            urgency,
                          }
                        })
                        .filter((d) => d.urgency !== 'ok')
                        .sort((a, b) => {
                          const order = { critical: 0, urgent: 1, upcoming: 2, ok: 3 }
                          return order[a.urgency] - order[b.urgency] || b.restockQty - a.restockQty
                        })

                      const urgencyColors = {
                        critical: 'text-red-500 bg-red-500/10',
                        urgent: 'text-amber-500 bg-amber-500/10',
                        upcoming: 'text-blue-400 bg-blue-400/10',
                        ok: 'text-emerald-400 bg-emerald-400/10',
                      }
                      const urgencyLabel = {
                        critical: 'Restock Now',
                        urgent: 'Order Soon',
                        upcoming: 'Plan Ahead',
                        ok: 'OK',
                      }

                      const totalUnits = restockItems.reduce((s, d) => s + d.restockQty, 0)
                      const totalCost = restockItems.reduce((s, d) => s + (d.estimatedCost ?? 0), 0)
                      const criticalCount = restockItems.filter(
                        (d) => d.urgency === 'critical'
                      ).length

                      const exportCSV = () => {
                        const headers = [
                          'Product',
                          'Available',
                          'Incoming',
                          'Velocity/Day',
                          'Days Left',
                          'Reorder Point',
                          'Safety Stock',
                          'Restock Qty',
                          'Urgency',
                        ]
                        const rows = restockItems.map((d) => [
                          `"${d.productTitle}"`,
                          d.available,
                          d.incoming || 0,
                          d.velocity,
                          d.daysOfStock ?? 'N/A',
                          d.reorderPoint,
                          d.safetyStock,
                          d.restockQty,
                          urgencyLabel[d.urgency],
                        ])
                        const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
                        const blob = new Blob([csv], { type: 'text/csv' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `restock-recommendations-${new Date().toISOString().slice(0, 10)}.csv`
                        a.click()
                        URL.revokeObjectURL(url)
                      }

                      return (
                        <div>
                          {/* Summary bar */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-6">
                              <div>
                                <p className="text-[12px] uppercase tracking-wider text-stone-500 font-medium">
                                  Products to Restock
                                </p>
                                <p
                                  className={cn(
                                    'text-lg font-mono font-semibold tabular-nums',
                                    isLight ? 'text-stone-900' : 'text-white'
                                  )}
                                >
                                  {restockItems.length}
                                  {criticalCount > 0 && (
                                    <span className="text-sm text-red-400 ml-1.5">
                                      ({criticalCount} critical)
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-[12px] uppercase tracking-wider text-stone-500 font-medium">
                                  Total Units Needed
                                </p>
                                <p
                                  className={cn(
                                    'text-lg font-mono font-semibold tabular-nums',
                                    isLight ? 'text-stone-900' : 'text-white'
                                  )}
                                >
                                  {totalUnits.toLocaleString()}
                                </p>
                              </div>
                              {totalCost > 0 && (
                                <div>
                                  <p className="text-[12px] uppercase tracking-wider text-stone-500 font-medium">
                                    Est. Restock Cost
                                  </p>
                                  <p
                                    className={cn(
                                      'text-lg font-mono font-semibold tabular-nums',
                                      isLight ? 'text-stone-900' : 'text-white'
                                    )}
                                  >
                                    {new Intl.NumberFormat('en-US', {
                                      style: 'currency',
                                      currency: summary?.costCurrency || 'USD',
                                      maximumFractionDigits: 0,
                                    }).format(totalCost)}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              {/* Target coverage */}
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] uppercase tracking-wider text-stone-500 font-medium">
                                  Cover
                                </span>
                                <div
                                  className={cn(
                                    'flex rounded-lg border overflow-hidden',
                                    isLight ? 'border-stone-200' : 'border-white/[0.08]'
                                  )}
                                >
                                  {([30, 60, 90] as const).map((d) => (
                                    <button
                                      key={d}
                                      onClick={() => setTargetCoverageDays(d)}
                                      className={cn(
                                        'px-2.5 py-1 text-[12px] font-medium transition-colors',
                                        targetCoverageDays === d
                                          ? isLight
                                            ? 'bg-stone-100 text-stone-900'
                                            : 'bg-white/[0.08] text-white'
                                          : 'theme-text-secondary hover:theme-text-primary'
                                      )}
                                    >
                                      {d}d
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {/* Export */}
                              <button
                                onClick={exportCSV}
                                disabled={restockItems.length === 0}
                                className={cn(
                                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40',
                                  isLight
                                    ? 'border-stone-200 hover:bg-stone-50 text-stone-700'
                                    : 'border-white/[0.08] hover:bg-white/[0.04] text-white/80'
                                )}
                              >
                                <Download className="w-3.5 h-3.5" />
                                Export CSV
                              </button>
                            </div>
                          </div>

                          {restockItems.length === 0 ? (
                            <div className="flex items-center justify-center py-12">
                              <p className="text-sm theme-text-secondary">
                                All products are sufficiently stocked for {targetCoverageDays} days
                                of coverage.
                              </p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr
                                    className={cn(
                                      'border-b',
                                      isLight ? 'border-stone-200' : 'border-white/[0.08]'
                                    )}
                                  >
                                    <th className="text-left py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500">
                                      Product
                                    </th>
                                    <th className="text-right py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500">
                                      In Stock
                                    </th>
                                    <th className="text-right py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500">
                                      Incoming
                                    </th>
                                    <th className="text-right py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500">
                                      Velocity
                                    </th>
                                    <th className="text-right py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500">
                                      Days Left
                                    </th>
                                    <th className="text-right py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500">
                                      Reorder Pt
                                    </th>
                                    <th className="text-right py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500 font-semibold">
                                      Restock Qty
                                    </th>
                                    {totalCost > 0 && (
                                      <th className="text-right py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500">
                                        Est. Cost
                                      </th>
                                    )}
                                    <th className="text-center py-2 px-3 text-[12px] font-medium uppercase tracking-wider text-stone-500">
                                      Urgency
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {restockItems.map((item) => (
                                    <tr
                                      key={item.productTitle}
                                      className={cn(
                                        'border-b transition-colors',
                                        isLight
                                          ? 'border-stone-100 hover:bg-stone-50'
                                          : 'border-white/[0.04] hover:bg-white/[0.02]'
                                      )}
                                    >
                                      <td
                                        className={cn(
                                          'py-2.5 px-3 font-medium max-w-[220px] truncate',
                                          isLight ? 'text-stone-900' : 'text-white'
                                        )}
                                      >
                                        {item.productTitle}
                                      </td>
                                      <td
                                        className={cn(
                                          'py-2.5 px-3 text-right font-mono tabular-nums',
                                          item.available <= 0
                                            ? 'text-red-400'
                                            : isLight
                                              ? 'text-stone-900'
                                              : 'text-white'
                                        )}
                                      >
                                        {item.available}
                                      </td>
                                      <td
                                        className={cn(
                                          'py-2.5 px-3 text-right font-mono tabular-nums',
                                          item.incoming > 0
                                            ? isLight
                                              ? 'text-blue-600'
                                              : 'text-blue-400'
                                            : 'theme-text-secondary'
                                        )}
                                      >
                                        {item.incoming || 0}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono tabular-nums theme-text-secondary">
                                        {item.velocity}/day
                                      </td>
                                      <td
                                        className={cn(
                                          'py-2.5 px-3 text-right font-mono tabular-nums font-semibold',
                                          item.daysOfStock === null
                                            ? 'theme-text-secondary'
                                            : item.daysOfStock < 7
                                              ? 'text-red-400'
                                              : item.daysOfStock < 14
                                                ? 'text-amber-400'
                                                : 'text-emerald-400'
                                        )}
                                      >
                                        {item.daysOfStock !== null ? `${item.daysOfStock}d` : '—'}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono tabular-nums theme-text-secondary">
                                        {item.reorderPoint}
                                      </td>
                                      <td
                                        className={cn(
                                          'py-2.5 px-3 text-right font-mono tabular-nums font-semibold',
                                          isLight ? 'text-stone-900' : 'text-white'
                                        )}
                                      >
                                        {item.restockQty.toLocaleString()}
                                      </td>
                                      {totalCost > 0 && (
                                        <td className="py-2.5 px-3 text-right font-mono tabular-nums theme-text-secondary text-[12px]">
                                          {item.estimatedCost != null
                                            ? new Intl.NumberFormat('en-US', {
                                                style: 'currency',
                                                currency: summary?.costCurrency || 'USD',
                                                maximumFractionDigits: 0,
                                              }).format(item.estimatedCost)
                                            : '—'}
                                        </td>
                                      )}
                                      <td className="py-2.5 px-3 text-center">
                                        <span
                                          className={cn(
                                            'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                                            urgencyColors[item.urgency]
                                          )}
                                        >
                                          {urgencyLabel[item.urgency]}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )
                    })()
                  ) : null}
                </div>
              )
            })()}

          {/* Inventory section title */}
          <div className="flex items-center gap-3">
            <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
              Inventory
            </h2>
            <div className="h-px flex-1 section-divider-line" />
          </div>

          {/* Location cards */}
          {locations.length > 1 && (
            <div
              className={cn(
                'flex items-end border-b shadow-sm',
                isLight
                  ? 'border-stone-200 shadow-stone-200/50'
                  : 'border-white/[0.06] shadow-black/20'
              )}
            >
              {inventoryByLocation.map((loc) => {
                const isActive =
                  String(loc.location.id) ===
                  (selectedLocation || String(inventoryByLocation[0]?.location.id))
                return (
                  <button
                    key={loc.location.id}
                    onClick={() => setSelectedLocation(String(loc.location.id))}
                    className={cn(
                      'text-center px-12 py-2.5 text-sm font-medium uppercase tracking-wider transition-colors border-b-2 -mb-px',
                      isActive
                        ? cn(
                            'border-amber-500',
                            isLight ? 'bg-stone-200/80' : 'bg-white/[0.08]',
                            isLight ? 'text-stone-900' : 'text-white'
                          )
                        : cn(
                            'border-transparent',
                            isLight
                              ? 'bg-stone-100/50 hover:bg-stone-200/50 hover:text-stone-700 text-stone-500'
                              : 'bg-white/[0.03] hover:bg-white/[0.06] hover:text-stone-300 text-stone-500'
                          )
                    )}
                  >
                    <p>{loc.location.name}</p>
                    <p className="text-xs text-stone-500 font-normal normal-case tracking-normal">
                      {loc.totalItems} items &middot; {loc.totalAvailable.toLocaleString()} units
                      {loc.inventoryValue != null &&
                        ` · ${formatCurrency(loc.inventoryValue, summary?.costCurrency || 'USD')}`}
                    </p>
                  </button>
                )
              })}
            </div>
          )}

          {/* Search */}
          <div className="relative w-full max-w-sm ml-auto">
            <Search
              className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
                isLight ? 'text-stone-400' : 'text-stone-500'
              )}
            />
            <input
              type="text"
              placeholder="Search by product or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                'w-full h-9 pl-9 pr-3 rounded-lg text-sm focus:outline-none transition-colors',
                'border bg-transparent',
                isLight ? 'border-stone-200' : 'border-white/[0.08]',
                isLight ? 'text-stone-900' : 'text-white',
                'placeholder:text-stone-400',
                'focus:border-amber-500/40'
              )}
            />
          </div>

          {/* Inventory table */}
          <div
            className="overflow-auto max-h-[900px] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 dark:[&::-webkit-scrollbar-thumb]:bg-stone-600"
            style={{ scrollbarWidth: 'thin' }}
          >
            <table className="w-full text-sm">
              <thead
                className={cn(
                  'sticky top-0 z-10',
                  isLight ? 'bg-stone-100' : 'bg-[#1a1a1a]',
                  '[&_th]:bg-inherit'
                )}
              >
                <tr
                  className={cn(
                    'border-b',
                    isLight ? 'border-stone-200' : 'border-white/[0.08]',
                    isLight
                      ? '[&_th:nth-child(odd)]:bg-stone-100 [&_th:nth-child(even)]:bg-stone-50'
                      : '[&_th:nth-child(odd)]:bg-[#1a1a1a] [&_th:nth-child(even)]:bg-white/[0.03]'
                  )}
                >
                  <th
                    className={cn(
                      'text-left px-4 py-3 font-medium cursor-pointer hover:text-amber-500 transition-colors',
                      'text-stone-500'
                    )}
                    onClick={() => handleSort('productTitle')}
                  >
                    <div className="flex items-center gap-1">
                      Product <SortIcon col="productTitle" />
                    </div>
                  </th>
                  <th
                    className={cn(
                      'text-left px-4 py-3 font-medium cursor-pointer hover:text-amber-500 transition-colors',
                      'text-stone-500'
                    )}
                    onClick={() => handleSort('variantTitle')}
                  >
                    <div className="flex items-center gap-1">
                      Variant <SortIcon col="variantTitle" />
                    </div>
                  </th>
                  <th
                    className={cn(
                      'text-left px-4 py-3 font-medium cursor-pointer hover:text-amber-500 transition-colors',
                      'text-stone-500'
                    )}
                    onClick={() => handleSort('sku')}
                  >
                    <div className="flex items-center gap-1">
                      SKU <SortIcon col="sku" />
                    </div>
                  </th>
                  <th
                    className={cn(
                      'text-right px-4 py-3 font-medium cursor-pointer hover:text-amber-500 transition-colors',
                      'text-stone-500'
                    )}
                    onClick={() => handleSort('available')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Available <SortIcon col="available" />
                    </div>
                  </th>
                  <th
                    className={cn(
                      'text-right px-4 py-3 font-medium cursor-pointer hover:text-amber-500 transition-colors',
                      'text-stone-500'
                    )}
                    onClick={() => handleSort('onHand')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      On Hand <SortIcon col="onHand" />
                    </div>
                  </th>
                  <th
                    className={cn(
                      'text-right px-4 py-3 font-medium cursor-pointer hover:text-amber-500 transition-colors',
                      'text-stone-500'
                    )}
                    onClick={() => handleSort('committed')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Committed <SortIcon col="committed" />
                    </div>
                  </th>
                  <th
                    className={cn(
                      'text-right px-4 py-3 font-medium cursor-pointer hover:text-amber-500 transition-colors',
                      'text-stone-500'
                    )}
                    onClick={() => handleSort('unitCost')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Unit Cost <SortIcon col="unitCost" />
                    </div>
                  </th>
                  <th
                    className={cn(
                      'text-right px-4 py-3 font-medium cursor-pointer hover:text-amber-500 transition-colors',
                      'text-stone-500'
                    )}
                    onClick={() => handleSort('value')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Value <SortIcon col="value" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLevels.map((item, i) => (
                  <Fragment key={`${item.inventory_item_id}-${i}`}>
                    <tr
                      onClick={() =>
                        setExpandedItem(
                          expandedItem === item.inventory_item_id ? null : item.inventory_item_id
                        )
                      }
                      className={cn(
                        'transition-colors cursor-pointer',
                        i % 2 === 0 ? (isLight ? 'bg-stone-50' : 'bg-white/[0.02]') : '',
                        isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.04]',
                        expandedItem === item.inventory_item_id &&
                          (isLight ? 'bg-stone-100' : 'bg-white/[0.04]')
                      )}
                    >
                      <td
                        className={cn(
                          'px-4 py-3 font-medium',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight
                            className={cn(
                              'w-3.5 h-3.5 text-stone-400 transition-transform flex-shrink-0',
                              expandedItem === item.inventory_item_id && 'rotate-90'
                            )}
                          />
                          {item.productTitle || `Item #${item.inventory_item_id}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-500">{item.variantTitle || '-'}</td>
                      <td className="px-4 py-3 text-stone-500 font-mono tabular-nums text-xs">
                        {item.sku || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            'font-medium font-mono tabular-nums',
                            (item.available || 0) <= 0
                              ? 'text-red-600'
                              : (item.available || 0) < 10
                                ? 'text-yellow-600'
                                : isLight
                                  ? 'text-stone-900'
                                  : 'text-white'
                          )}
                        >
                          {item.available ?? 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-stone-500 font-mono tabular-nums">
                        {item.onHand != null ? item.onHand : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {item.committed != null && item.committed > 0 ? (
                          <span className={isLight ? 'text-amber-600' : 'text-amber-400'}>
                            {item.committed}
                          </span>
                        ) : (
                          <span className="text-stone-500">
                            {item.committed != null ? '0' : '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-stone-500 font-mono tabular-nums">
                        {item.unitCost != null
                          ? formatCurrency(item.unitCost, item.costCurrency || 'USD')
                          : '-'}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-medium font-mono tabular-nums',
                          isLight ? 'text-stone-900' : 'text-white'
                        )}
                      >
                        {item.unitCost != null && item.onHand != null
                          ? formatCurrency(item.unitCost * item.onHand, item.costCurrency || 'USD')
                          : '-'}
                      </td>
                    </tr>
                    {expandedItem === item.inventory_item_id && (
                      <tr key={`${item.inventory_item_id}-details`}>
                        <td colSpan={8} className="p-0 border-none">
                          <InventoryDetailPanel
                            inventoryItemId={item.inventory_item_id}
                            isLight={isLight}
                            onClose={() => setExpandedItem(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {filteredLevels.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-stone-500">
                      No inventory items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
