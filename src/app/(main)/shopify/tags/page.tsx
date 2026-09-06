'use client'

import { Fragment, useState, useMemo, useEffect, useRef } from 'react'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useShopifyTags } from '../hooks/useShopifyData'
import { PeriodPicker } from '@/app/(main)/bc/components/PeriodPicker'
import { useShopifyDateRange } from '../hooks/useShopifyDateRange'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { ReactECharts } from '@/components/chat/visualizations/shared'
import { KPIStrip, type KPICardConfig } from '../components/KPIStrip'
import type { ShopifyTagPerformance, ShopifyTagProduct } from '@/lib/providers/shopify/types'
import {
  RefreshCw,
  Loader2,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  X,
} from 'lucide-react'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

function formatNumber(n: number) {
  return new Intl.NumberFormat('en-US').format(n)
}

function formatPercent(n: number) {
  return `${n.toFixed(1)}%`
}

export default function ShopifyTagsPage() {
  const { connected, isLoading: connLoading } = useShopifyConnection()
  const {
    selectedPeriod,
    setSelectedPeriod,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    dateRange,
  } = useShopifyDateRange()

  const [attribution, setAttribution] = useState<'full' | 'fractional'>('full')
  // null = user hasn't explicitly chosen, default to all available tags
  const [compareTags, setCompareTags] = useState<string[] | null>(null)
  const [compareDropdownOpen, setCompareDropdownOpen] = useState(false)
  const [compareSearch, setCompareSearch] = useState('')
  const compareDropdownRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, error, mutate, compareLoading } = useShopifyTags(connected, dateRange, {
    attribution,
    compareTags: compareTags && compareTags.length >= 2 ? compareTags : undefined,
  })

  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !data)
  }, [isLoading, data, welcomeContext])

  const availableTagsFromData = data?.availableTags ?? []
  // Effective compare tags: user's selection or all available
  const effectiveCompareTags = compareTags ?? availableTagsFromData

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (compareDropdownRef.current && !compareDropdownRef.current.contains(e.target as Node)) {
        setCompareDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [search, setSearch] = useState('')
  const { theme } = useTheme()
  const isDark = theme !== 'light'
  const isLight = theme === 'light'
  const [sortKey, setSortKey] = useState<keyof ShopifyTagPerformance>('grossSales')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedTag, setExpandedTag] = useState<string | null>(null)

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-amber-500" />
    ) : (
      <ChevronDown className="w-3 h-3 text-amber-500" />
    )
  }

  const handleSort = (col: keyof ShopifyTagPerformance) => {
    if (sortKey === col) setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(col)
      setSortDir(col === 'tag' ? 'asc' : 'desc')
    }
  }

  const toggleCompareTag = (tag: string) => {
    setCompareTags((prev) => {
      const current = prev ?? availableTagsFromData
      return current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]
    })
  }

  const selectAllCompareTags = () => {
    setCompareTags([...availableTagsFromData])
  }

  const clearAllCompareTags = () => {
    setCompareTags([])
  }

  if (connLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#7AB55C]" />
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

  const tags = data?.tags ?? []
  const summary = data?.summary
  const cur = summary?.currency ?? 'USD'
  // When the store has no COGS set, the cost-based $ total is meaningless;
  // swap the column to units on hand (honest, actionable).
  const showInventoryUnits = summary?.inventoryValuationMethod === 'none'
  const tagTrend = data?.tagTrend ?? []
  const comparison = data?.comparison
  const trendGranularity = data?.trendGranularity ?? 'month'
  const availableTags = data?.availableTags ?? []
  const productsByTag = data?.productsByTag ?? {}

  const tagsWithSales = useMemo(() => new Set(tags.map((t) => t.tag)), [tags])
  const noSalesTags = useMemo(
    () => availableTags.filter((t) => !tagsWithSales.has(t)),
    [availableTags, tagsWithSales]
  )

  const filtered = useMemo(() => {
    let items = tags.filter((t) => !search || t.tag.toLowerCase().includes(search.toLowerCase()))
    items = [...items].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal as string)
        return sortDir === 'asc' ? cmp : -cmp
      }
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
    return items
  }, [tags, search, sortKey, sortDir])

  // Chart helpers
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const labelColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'

  const formatTrendDate = (dateStr: string) => {
    if (trendGranularity === 'day' || trendGranularity === 'week') {
      const d = new Date(dateStr + 'T00:00:00Z')
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    }
    const [y, m] = dateStr.split('-')
    const d = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, 1))
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  }

  // Top 10 tags bar chart
  const topTags = tags.slice(0, 10)
  const topTagsChartOption = {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? '#1e1e2e' : '#fff',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
    },
    grid: { top: 8, right: 16, bottom: 60, left: 16, containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: topTags.map((t) => t.tag),
      axisLabel: {
        color: labelColor,
        fontSize: 10,
        rotate: 35,
        overflow: 'truncate' as const,
        width: 80,
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: {
        color: labelColor,
        fontSize: 10,
        formatter: (v: number) => formatCurrency(v, cur),
      },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: [
      {
        name: 'Gross Sales',
        type: 'bar',
        data: topTags.map((t) => t.grossSales),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(122, 181, 92, 0.9)' },
              { offset: 1, color: 'rgba(122, 181, 92, 0.5)' },
            ],
          },
          borderRadius: 0,
        },
        barMaxWidth: 32,
      },
    ],
  }

  // Comparison trend chart (when compareTags selected)
  const tagColors = ['#7AB55C', '#f59e0b', '#ef4444', '#6366f1', '#06b6d4', '#ec4899']
  const comparisonChartOption =
    comparison && comparison.tags.length >= 2
      ? {
          tooltip: {
            trigger: 'axis' as const,
            backgroundColor: isDark ? '#1e1e2e' : '#fff',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            textStyle: { color: isDark ? '#e0e0e0' : '#333', fontSize: 12 },
          },
          legend: {
            data: comparison.tags,
            textStyle: { color: labelColor, fontSize: 10 },
            top: 0,
            right: 0,
            emphasis: { selectorLabel: { show: false } },
          },
          grid: { top: 28, right: 16, bottom: 24, left: 60 },
          xAxis: {
            type: 'category' as const,
            data: comparison.periods.map((p) => formatTrendDate(p.date)),
            axisLabel: { color: labelColor, fontSize: 10 },
            axisLine: { lineStyle: { color: gridColor } },
            axisTick: { show: false },
          },
          yAxis: {
            type: 'value' as const,
            axisLabel: {
              color: labelColor,
              fontSize: 10,
              formatter: (v: number) => formatCurrency(v, cur),
            },
            splitLine: { lineStyle: { color: gridColor } },
          },
          series: comparison.tags.map((tag, i) => ({
            name: tag,
            type: 'line',
            data: comparison.periods.map((p) => p.values[tag]?.grossSales ?? 0),
            smooth: true,
            lineStyle: { color: tagColors[i % tagColors.length], width: 2 },
            itemStyle: { color: tagColors[i % tagColors.length] },
            showSymbol: false,
            emphasis: { focus: 'series' as const, lineStyle: { width: 3 } },
            blur: { lineStyle: { opacity: 0.15, width: 1 }, itemStyle: { opacity: 0.1 } },
          })),
        }
      : null

  // KPI cards
  const kpiCards: KPICardConfig[] = summary
    ? [
        {
          label: 'Tags Found',
          kpi: { value: summary.totalTags },
          format: (v) => formatNumber(v),
          tooltip: {
            description:
              'Number of unique product tags with sales activity in the selected period.',
            calculationTooltip: { formula: 'Count of distinct tags on sold products' },
          },
        },
        {
          label: 'Gross Sales',
          kpi: { value: summary.totalGrossSales },
          format: (v) => formatCurrency(v, cur),
          tooltip: {
            description:
              attribution === 'full'
                ? 'Sum of gross sales attributed to tags. Products with multiple tags count toward each tag, so this total will exceed actual revenue.'
                : 'Sum of gross sales split fractionally across tags. A product with 3 tags attributes 1/3 of its revenue to each.',
            calculationTooltip: {
              formula:
                attribution === 'full'
                  ? 'Σ line_item.price × quantity per tag'
                  : 'Σ (line_item.price × quantity) ÷ tag_count per product',
            },
          },
        },
        {
          label: 'Units Sold',
          kpi: { value: summary.totalUnitsSold },
          format: (v) => formatNumber(v),
          tooltip: {
            description:
              'Total units sold across all tagged products. Units may be counted multiple times if a product has multiple tags.',
            calculationTooltip: { formula: 'Σ quantity per tagged line item' },
          },
        },
        {
          label: 'Refunds',
          kpi: { value: summary.totalRefundAmount },
          format: (v) => formatCurrency(v, cur),
          valueColor: 'text-red-500',
          tooltip: {
            description: 'Total refund amount attributed to tagged products.',
            calculationTooltip: { formula: 'Σ refund amounts on tagged line items' },
          },
        },
        {
          label: 'Discounts',
          kpi: { value: summary.totalDiscountAmount },
          format: (v) => formatCurrency(v, cur),
          tooltip: {
            description: 'Total discount amount applied to tagged products.',
            calculationTooltip: { formula: 'Σ discount allocations on tagged line items' },
          },
        },
        {
          label: 'Disputes',
          kpi: { value: summary.totalDisputeAmount },
          format: (v) => formatCurrency(v, cur),
          valueColor: 'text-red-500',
          tooltip: {
            description: `${formatNumber(summary.totalDisputeCount)} dispute${summary.totalDisputeCount !== 1 ? 's' : ''} originated from orders containing tagged products. Use the table to spot fraud-prone cohorts.`,
            calculationTooltip: {
              formula: 'Σ dispute.amount where dispute.order_id ∈ orders with tagged line items',
            },
          },
        },
        // When the store hasn't set COGS we show units on hand instead of a
        // fake $ number — an honest, actionable signal (which tag cohorts are
        // holding the most stock) without pretending to know cost.
        summary.inventoryValuationMethod === 'none'
          ? {
              label: 'Inventory Units',
              kpi: { value: summary.totalInventoryUnits },
              format: (v) => formatNumber(v),
              tooltip: {
                description:
                  summary.totalInventoryUnits === 0
                    ? 'No on-hand inventory found for tagged products. Tagged products may all be out of stock, untracked, or beyond the 250-item inventory fetch cap.'
                    : `${formatNumber(summary.totalInventoryUnits)} units on hand across tagged products. $ exposure is not shown because unit costs aren't set in Shopify — set COGS in Shopify > Products > Inventory to see cost-based working capital exposure here.`,
                calculationTooltip: { formula: 'Σ on_hand across tagged inventory items' },
              },
            }
          : {
              label:
                summary.inventoryValuationMethod === 'partial'
                  ? 'Inventory $ (partial)'
                  : 'Inventory $',
              kpi: { value: summary.totalInventoryValue },
              format: (v) => formatCurrency(v, cur),
              tooltip: {
                description:
                  summary.inventoryValuationMethod === 'partial'
                    ? `Partial coverage: ${formatNumber(summary.inventoryItemsMissingCost)} tagged inventory item${summary.inventoryItemsMissingCost !== 1 ? 's' : ''} are missing unit_cost in Shopify and are excluded from this total. Real exposure is higher. Set COGS on those items for a complete reading.`
                    : `${formatNumber(summary.totalInventoryUnits)} units on hand × unit_cost. Working capital tied up in tagged inventory.`,
                calculationTooltip: {
                  formula: 'Σ unit_cost × on_hand across tagged inventory items',
                },
              },
            },
      ]
    : []

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
            <h1 className="text-[36px] font-light theme-text-primary tracking-tight">
              Product Tag Performance
            </h1>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#7AB55C]/80 mt-2">
              Shopify
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
              className="p-1.5 theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-sm text-red-500">Failed to load tag data. Please try again.</p>
        </div>
      ) : isLoading && !data ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
        </div>
      ) : (
        <>
          {/* Attribution warning */}
          {data?.warning && (
            <div
              className={cn(
                'flex items-start gap-2 px-3 py-2 rounded-lg text-xs',
                isLight
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-amber-900/20 text-amber-400 border border-amber-800/30'
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{data.warning}</span>
            </div>
          )}

          {/* Attribution toggle */}
          <div className="flex items-center gap-4">
            <span className="text-xs theme-text-secondary">Attribution:</span>
            <div
              className={cn(
                'flex rounded-lg overflow-hidden border text-xs',
                isLight ? 'border-stone-200' : 'border-white/[0.08]'
              )}
            >
              <button
                onClick={() => setAttribution('full')}
                className={cn(
                  'px-3 py-1.5 transition-colors',
                  attribution === 'full'
                    ? isLight
                      ? 'bg-[#7AB55C]/10 text-[#7AB55C] font-medium'
                      : 'bg-[#7AB55C]/20 text-[#7AB55C] font-medium'
                    : isLight
                      ? 'text-stone-500 hover:bg-stone-50'
                      : 'text-gray-400 hover:bg-white/[0.04]'
                )}
              >
                Full
              </button>
              <button
                onClick={() => setAttribution('fractional')}
                className={cn(
                  'px-3 py-1.5 transition-colors border-l',
                  isLight ? 'border-stone-200' : 'border-white/[0.08]',
                  attribution === 'fractional'
                    ? isLight
                      ? 'bg-[#7AB55C]/10 text-[#7AB55C] font-medium'
                      : 'bg-[#7AB55C]/20 text-[#7AB55C] font-medium'
                    : isLight
                      ? 'text-stone-500 hover:bg-stone-50'
                      : 'text-gray-400 hover:bg-white/[0.04]'
                )}
              >
                Fractional
              </button>
            </div>
            <InfoTooltip
              description={
                attribution === 'full'
                  ? "Full: Each product's full revenue counts toward every tag it has. Useful for understanding tag reach, but totals exceed actual revenue."
                  : "Fractional: Revenue is split evenly across a product's tags. Totals will match actual revenue, but per-tag numbers are diluted."
              }
            />
          </div>

          {/* KPI Strip */}
          <KPIStrip cards={kpiCards} isLoading={isLoading} isLight={isLight} />

          {/* Charts */}
          <div className="grid @xl:grid-cols-2 gap-10 items-stretch">
            {topTags.length > 0 && (
              <section
                className={cn(
                  'group relative z-0 hover:z-10 -mx-3 px-3 pt-4 pb-6 flex flex-col',
                  'transition-all duration-300 ease-out',
                  'hover:scale-[1.02] hover:z-10 origin-center',
                  isLight
                    ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] hover:bg-white/80'
                    : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] hover:bg-[#1e1e2e]/80'
                )}
              >
                <div className="mb-3">
                  <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                    Top Tags by Gross Sales
                    <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                  </span>
                </div>
                <div className="flex-1 min-h-0">
                  <ReactECharts
                    option={topTagsChartOption}
                    style={{ width: '100%', height: '100%' }}
                    opts={{ renderer: 'canvas' }}
                  />
                </div>
              </section>
            )}

            {/* Comparison section */}
            <section
              className={cn(
                'group relative z-0 hover:z-10 -mx-3 px-3 pt-4 pb-6',
                'transition-all duration-300 ease-out',
                'hover:scale-[1.02] hover:z-10 origin-center',
                isLight
                  ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] hover:bg-white/80'
                  : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] hover:bg-[#1e1e2e]/80'
              )}
            >
              <div className="mb-3">
                <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
                  Compare Tags
                  <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
                </span>
              </div>

              {/* Tag selector for comparison */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="relative" ref={compareDropdownRef}>
                  <button
                    onClick={() => setCompareDropdownOpen((prev) => !prev)}
                    className={cn(
                      'h-8 px-3 rounded-lg text-xs focus:outline-none transition-colors',
                      'border bg-transparent inline-flex items-center gap-2 min-w-[200px]',
                      isLight ? 'border-stone-200' : 'border-white/[0.08]',
                      isLight ? 'text-stone-900' : 'text-white',
                      compareDropdownOpen && 'border-amber-500/40'
                    )}
                  >
                    <span className="truncate flex-1 text-left">
                      {effectiveCompareTags.length === 0
                        ? 'Select tags...'
                        : effectiveCompareTags.length === availableTags.length
                          ? 'All tags selected'
                          : `${effectiveCompareTags.length} tag${effectiveCompareTags.length !== 1 ? 's' : ''} selected`}
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-3 h-3 flex-shrink-0 transition-transform',
                        compareDropdownOpen && 'rotate-180'
                      )}
                    />
                  </button>

                  {compareDropdownOpen && (
                    <div
                      className={cn(
                        'absolute z-50 top-full left-0 mt-1 w-64 rounded-lg border shadow-lg overflow-hidden',
                        isLight
                          ? 'bg-white border-stone-200 shadow-stone-200/50'
                          : 'bg-[#141414] border-white/[0.08] shadow-black/40'
                      )}
                    >
                      {/* Search */}
                      <div
                        className={cn(
                          'px-2 py-2 border-b',
                          isLight ? 'border-stone-100' : 'border-white/[0.06]'
                        )}
                      >
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-stone-400 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Search tags..."
                            value={compareSearch}
                            onChange={(e) => setCompareSearch(e.target.value)}
                            className={cn(
                              'w-full h-7 pl-7 pr-2 rounded text-xs focus:outline-none transition-colors',
                              'border bg-transparent',
                              isLight ? 'border-stone-200' : 'border-white/[0.08]',
                              isLight ? 'text-stone-900' : 'text-white',
                              'placeholder:text-stone-400'
                            )}
                            autoFocus
                          />
                        </div>
                      </div>

                      {/* Select all / Clear */}
                      <div
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 border-b text-[10px]',
                          isLight ? 'border-stone-100' : 'border-white/[0.06]'
                        )}
                      >
                        <button
                          onClick={selectAllCompareTags}
                          className="text-[#7AB55C] hover:underline"
                        >
                          Select all
                        </button>
                        <span className="text-stone-400">|</span>
                        <button
                          onClick={clearAllCompareTags}
                          className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:underline"
                        >
                          Clear all
                        </button>
                      </div>

                      {/* Options list */}
                      <div className="max-h-[240px] overflow-y-auto styled-scrollbar">
                        {availableTags
                          .filter(
                            (t) =>
                              !compareSearch ||
                              t.toLowerCase().includes(compareSearch.toLowerCase())
                          )
                          .map((tag) => {
                            const isSelected = effectiveCompareTags.includes(tag)
                            return (
                              <button
                                key={tag}
                                onClick={() => toggleCompareTag(tag)}
                                className={cn(
                                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors',
                                  isLight ? 'hover:bg-stone-50' : 'hover:bg-white/[0.04]',
                                  isSelected && (isLight ? 'bg-[#7AB55C]/5' : 'bg-[#7AB55C]/10')
                                )}
                              >
                                <div
                                  className={cn(
                                    'w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center transition-colors',
                                    isSelected
                                      ? 'bg-[#7AB55C] border-[#7AB55C]'
                                      : isLight
                                        ? 'border-stone-300'
                                        : 'border-white/20'
                                  )}
                                >
                                  {isSelected && (
                                    <svg
                                      className="w-2.5 h-2.5 text-white"
                                      viewBox="0 0 12 12"
                                      fill="none"
                                    >
                                      <path
                                        d="M2 6l3 3 5-5"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  )}
                                </div>
                                <span
                                  className={cn(
                                    'truncate',
                                    isLight ? 'text-stone-700' : 'text-stone-200'
                                  )}
                                >
                                  {tag}
                                </span>
                                {!tagsWithSales.has(tag) && (
                                  <span className="text-[9px] text-stone-400 flex-shrink-0 ml-auto">
                                    no sales
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        {availableTags.filter(
                          (t) =>
                            !compareSearch || t.toLowerCase().includes(compareSearch.toLowerCase())
                        ).length === 0 && (
                          <div className="px-3 py-3 text-xs text-stone-400 text-center">
                            No tags match &ldquo;{compareSearch}&rdquo;
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Selected tag pills (show a few) */}
                {effectiveCompareTags.length > 0 &&
                  effectiveCompareTags.length <= 6 &&
                  effectiveCompareTags.map((tag) => (
                    <span
                      key={tag}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md',
                        isLight
                          ? 'bg-[#7AB55C]/10 text-[#7AB55C] border border-[#7AB55C]/20'
                          : 'bg-[#7AB55C]/20 text-[#7AB55C] border border-[#7AB55C]/30'
                      )}
                    >
                      {tag}
                      <button
                        onClick={() => toggleCompareTag(tag)}
                        className="hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                {effectiveCompareTags.length > 6 && (
                  <span className="text-xs text-stone-400">
                    +{effectiveCompareTags.length - 6} more
                  </span>
                )}
              </div>

              {compareLoading && effectiveCompareTags.length >= 2 ? (
                <div className="flex items-center justify-center h-[200px]">
                  <Loader2 className="w-5 h-5 animate-spin text-[#7AB55C]" />
                </div>
              ) : comparisonChartOption ? (
                <ReactECharts
                  option={comparisonChartOption}
                  style={{ width: '100%', height: 280 }}
                  opts={{ renderer: 'canvas' }}
                />
              ) : (
                <div className="flex items-center justify-center h-[200px]">
                  <p className="text-xs text-stone-400">
                    Select at least 2 tags above to see a comparison chart
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Search */}
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter tags..."
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

          {/* No sales note */}
          {noSalesTags.length > 0 && (
            <p className="text-[11px] text-stone-400">
              {noSalesTags.length} tag{noSalesTags.length !== 1 ? 's' : ''} not shown in table (no
              sales data in this period):{' '}
              <span className="text-stone-500">
                {noSalesTags.slice(0, 5).join(', ')}
                {noSalesTags.length > 5 && `, +${noSalesTags.length - 5} more`}
              </span>
            </p>
          )}

          {/* Tag performance table */}
          <div className="overflow-x-auto overflow-y-auto max-h-[900px] scrollbar-thin scrollbar-thumb-stone-300 dark:scrollbar-thumb-stone-700 scrollbar-track-transparent">
            <table className="w-full text-sm">
              <thead className={cn('sticky top-0 z-10', isLight ? 'bg-white' : 'bg-[#0a0a0a]')}>
                <tr
                  className={cn('border-b', isLight ? 'border-stone-200' : 'border-white/[0.08]')}
                >
                  {(
                    [
                      { key: 'tag', label: 'Tag', align: 'left' },
                      { key: 'grossSales', label: 'Gross Sales', align: 'right' },
                      { key: 'netSales', label: 'Net Sales', align: 'right' },
                      { key: 'unitsSold', label: 'Units', align: 'right' },
                      { key: 'orderCount', label: 'Orders', align: 'right' },
                      { key: 'refundAmount', label: 'Refunds', align: 'right' },
                      { key: 'disputeRate', label: 'Dispute Rate', align: 'right' },
                      showInventoryUnits
                        ? {
                            key: 'inventoryUnits' as const,
                            label: 'Inventory Units',
                            align: 'right' as const,
                          }
                        : {
                            key: 'inventoryValue' as const,
                            label: 'Inventory $',
                            align: 'right' as const,
                          },
                      { key: 'discountAmount', label: 'Discounts', align: 'right' },
                      { key: 'avgOrderValue', label: 'AOV', align: 'right' },
                    ] as const
                  ).map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        'py-2 px-3 font-medium text-stone-500 text-[12px] uppercase tracking-wider',
                        col.align === 'right' ? 'text-right' : 'text-left'
                      )}
                    >
                      <button
                        onClick={() => handleSort(col.key)}
                        className={cn(
                          'inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300 transition-colors',
                          col.align === 'right' && 'ml-auto'
                        )}
                      >
                        {col.label} <SortIcon col={col.key} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tag, i) => {
                  const isExpanded = expandedTag === tag.tag
                  const tagProducts = productsByTag[tag.tag] ?? []
                  return (
                    <Fragment key={tag.tag}>
                      <tr
                        className={cn(
                          'transition-colors cursor-pointer',
                          i % 2 === 1 ? (isLight ? 'bg-stone-50' : 'bg-white/[0.02]') : '',
                          isLight ? 'hover:bg-stone-100' : 'hover:bg-white/[0.04]',
                          isExpanded && (isLight ? 'bg-stone-100' : 'bg-white/[0.04]')
                        )}
                        onClick={() => setExpandedTag(isExpanded ? null : tag.tag)}
                      >
                        <td
                          className={cn(
                            'py-2.5 px-3 font-medium',
                            isLight ? 'text-stone-900' : 'text-white'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3 flex-shrink-0 theme-text-secondary" />
                            ) : (
                              <ChevronRight className="w-3 h-3 flex-shrink-0 theme-text-secondary" />
                            )}
                            <span>{tag.tag}</span>
                            <span className="text-[10px] text-stone-400 font-normal">
                              {tagProducts.length} product{tagProducts.length !== 1 ? 's' : ''}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleCompareTag(tag.tag)
                              }}
                              className={cn(
                                'text-[10px] transition-colors ml-auto',
                                effectiveCompareTags.includes(tag.tag)
                                  ? 'text-[#7AB55C] hover:text-red-400'
                                  : 'text-stone-400 hover:text-[#7AB55C]'
                              )}
                              title={
                                effectiveCompareTags.includes(tag.tag)
                                  ? 'Remove from comparison'
                                  : 'Add to comparison'
                              }
                            >
                              {effectiveCompareTags.includes(tag.tag) ? '- compare' : '+ compare'}
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {formatCurrency(tag.grossSales, cur)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-stone-500">
                          {formatCurrency(tag.netSales, cur)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {formatNumber(tag.unitsSold)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {formatNumber(tag.orderCount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-red-500">
                          {tag.refundAmount > 0 ? formatCurrency(tag.refundAmount, cur) : '-'}
                        </td>
                        <td
                          className={cn(
                            'py-2.5 px-3 text-right font-mono tabular-nums',
                            tag.disputeRate >= 1
                              ? 'text-red-500 font-semibold'
                              : tag.disputeRate > 0
                                ? 'text-amber-500'
                                : 'text-stone-500'
                          )}
                          title={
                            tag.disputeCount > 0
                              ? `${formatNumber(tag.disputeCount)} dispute${tag.disputeCount !== 1 ? 's' : ''} · ${formatCurrency(tag.disputeAmount, cur)}`
                              : undefined
                          }
                        >
                          {tag.disputeCount > 0 ? formatPercent(tag.disputeRate) : '-'}
                        </td>
                        <td
                          className="py-2.5 px-3 text-right font-mono tabular-nums text-stone-500"
                          title={
                            showInventoryUnits
                              ? tag.inventoryUnits > 0
                                ? 'Cost-based $ exposure unavailable — unit_cost not set in Shopify for these items.'
                                : undefined
                              : tag.inventoryUnits > 0
                                ? `${formatNumber(tag.inventoryUnits)} units on hand`
                                : undefined
                          }
                        >
                          {showInventoryUnits
                            ? tag.inventoryUnits > 0
                              ? formatNumber(tag.inventoryUnits)
                              : '-'
                            : tag.inventoryValue > 0
                              ? formatCurrency(tag.inventoryValue, cur)
                              : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-stone-500">
                          {tag.discountAmount > 0 ? formatCurrency(tag.discountAmount, cur) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {formatCurrency(tag.avgOrderValue, cur)}
                        </td>
                      </tr>
                      {isExpanded && tagProducts.length > 0 && (
                        <tr>
                          <td colSpan={10} className="p-0 border-none">
                            <div
                              className={cn(
                                'px-6 py-3 border-b',
                                isLight
                                  ? 'bg-stone-50 border-stone-200'
                                  : 'bg-white/[0.01] border-white/[0.06]'
                              )}
                            >
                              <p className="text-[10px] font-medium theme-text-secondary uppercase tracking-wider mb-2">
                                Products in &ldquo;{tag.tag}&rdquo;
                              </p>
                              <div className="max-h-[300px] overflow-y-auto styled-scrollbar space-y-0">
                                {tagProducts.map((p, j) => (
                                  <div
                                    key={p.productId}
                                    className={cn(
                                      'flex items-center gap-3 py-2 px-2 text-sm',
                                      j < tagProducts.length - 1 && 'border-b',
                                      isLight ? 'border-stone-100' : 'border-white/[0.04]'
                                    )}
                                  >
                                    <span className="text-[10px] font-mono text-stone-400 w-5 text-right flex-shrink-0">
                                      {j + 1}
                                    </span>
                                    {p.imageUrl && (
                                      <img
                                        src={p.imageUrl}
                                        alt={p.title}
                                        className="w-8 h-8 rounded object-cover flex-shrink-0"
                                      />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div
                                        className={cn(
                                          'font-medium truncate',
                                          isLight ? 'text-stone-900' : 'text-white'
                                        )}
                                      >
                                        {p.title}
                                      </div>
                                      {p.tags.length > 1 && (
                                        <div className="flex gap-1 mt-0.5 flex-wrap">
                                          {p.tags
                                            .filter((t) => t !== tag.tag)
                                            .slice(0, 3)
                                            .map((t) => (
                                              <span
                                                key={t}
                                                className="text-[9px] px-1 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                                              >
                                                {t}
                                              </span>
                                            ))}
                                          {p.tags.filter((t) => t !== tag.tag).length > 3 && (
                                            <span className="text-[9px] text-stone-400">
                                              +{p.tags.filter((t) => t !== tag.tag).length - 3}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-2">
                                      <div
                                        className={cn(
                                          'font-mono tabular-nums text-sm',
                                          isLight ? 'text-stone-900' : 'text-white'
                                        )}
                                      >
                                        {formatCurrency(p.grossSales, cur)}
                                      </div>
                                      <div className="text-[10px] text-stone-500">
                                        {formatNumber(p.unitsSold)} units ·{' '}
                                        {formatNumber(p.orderCount)} orders
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      {isExpanded && tagProducts.length === 0 && (
                        <tr>
                          <td colSpan={10} className="p-0 border-none">
                            <div
                              className={cn(
                                'px-6 py-4 text-xs text-stone-400 border-b',
                                isLight
                                  ? 'bg-stone-50 border-stone-200'
                                  : 'bg-white/[0.01] border-white/[0.06]'
                              )}
                            >
                              No products found for this tag.
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-stone-500">
                      {tags.length === 0
                        ? 'No tagged products found. Ensure products in Shopify have tags assigned.'
                        : 'No matching tags.'}
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
