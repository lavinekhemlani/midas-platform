'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useBCInventoryEnhanced } from '../../hooks/useBCInventoryEnhanced'
import { useBCStockMovement } from '../../hooks/useBCStockMovement'
import {
  InventoryOverviewCard,
  InventoryByCategoryCard,
  InventoryMovementTrendCard,
  InventoryTurnoverCard,
  SlowMovingInventoryCard,
  TopItemsByValueCard,
  LocationsCard,
  ABCClassificationCard,
  ItemDetailDrawer,
  InventoryOverviewPDF,
  StockMovementReportCard,
} from '../components'
import { getDateRangeForPeriod } from '@/lib/utils/dateRanges'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import {
  AlertCircle,
  RefreshCw,
  Calendar,
  ChevronDown,
  ArrowRight,
  Download,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { PERIOD_OPTION_GROUPS, PERIOD_OPTIONS } from '@/lib/utils/dateRanges'
import { PeriodPicker } from '../../components/PeriodPicker'
import { pdf } from '@react-pdf/renderer'

const fmt = (v: number, c: string) => formatCompactCurrency(v, c)

export function BCOAuthInventoryView({ connectionId }: { connectionId: string }) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [selectedPeriod, setSelectedPeriod] = useState('this_year')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedItemNumber, setSelectedItemNumber] = useState<string | null>(null)
  const [selectedTopItem, setSelectedTopItem] = useState<string | null>(null)
  const searchParams = useSearchParams()

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      sectionBg: isLight ? 'bg-white' : 'bg-white/[0.02]',
      hoverBg: isLight ? 'hover:bg-stone-50' : 'hover:bg-white/[0.04]',
    }),
    [isLight]
  )

  const sectionHover = cn(
    'group relative -mx-3 px-3 -mt-4 pt-4 -mb-6 pb-6 rounded-[4px]',
    'transition-all duration-300 ease-out',
    'hover:scale-[1.02] origin-center',
    isLight
      ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
      : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
  )

  const dateRange = useMemo(() => {
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate }
    }
    const range = getDateRangeForPeriod(selectedPeriod)
    return { startDate: range.start, endDate: range.end }
  }, [selectedPeriod, customStartDate, customEndDate])

  const {
    overview,
    byCategory,
    movementTrend,
    turnover,
    slowMoving,
    topItemsByValue,
    totalInventoryValue,
    locations,
    abcClassification,
    allItems,
    companyName,
    currency,
    isLoading,
    error,
    mutate,
  } = useBCInventoryEnhanced(connectionId, dateRange)

  const {
    periodEntries: smPeriodEntries,
    priorEntries: smPriorEntries,
    itemWeights: smItemWeights,
    isLoading: smLoading,
    currency: smCurrency,
  } = useBCStockMovement(connectionId, dateRange)

  // Build sub-page hrefs preserving connectionId param
  const connParam = searchParams.get('connectionId')
  const subPageHref = (path: string) => (connParam ? `${path}?connectionId=${connParam}` : path)

  // Report loading state to WelcomeContext for coordinated loading UI
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    const hasData = !!overview
    const allDoneLoading = !isLoading
    if (hasData || allDoneLoading) {
      welcomeContext?.setDataLoading(false)
    } else {
      welcomeContext?.setDataLoading(true)
    }
  }, [welcomeContext, isLoading, overview])

  // Compute turnover rating from ratio
  const turnoverRating = useMemo((): 'excellent' | 'good' | 'fair' | 'poor' | null => {
    if (!turnover) return null
    const ratio = turnover.turnover_ratio
    if (ratio >= 8) return 'excellent'
    if (ratio >= 5) return 'good'
    if (ratio >= 2) return 'fair'
    return 'poor'
  }, [turnover])

  // Find pre-computed data for the selected item (for drawer)
  const selectedItemData = useMemo(() => {
    if (!selectedItemNumber) return null
    return allItems.find((i) => i.item_no === selectedItemNumber) ?? null
  }, [selectedItemNumber, allItems])

  const selectedTopItemData = useMemo(() => {
    if (!selectedTopItem) return null
    return allItems.find((i) => i.item_no === selectedTopItem) ?? null
  }, [selectedTopItem, allItems])

  // PDF Download state and handler
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false)

  const handleDownloadPDF = useCallback(async () => {
    setIsDownloadingPDF(true)
    try {
      const blob = await pdf(
        <InventoryOverviewPDF
          overview={overview}
          byCategory={byCategory}
          abcClassification={abcClassification}
          turnover={turnover}
          slowMovingSummary={slowMoving.summary}
          topItemsByValue={topItemsByValue}
          locations={locations}
          companyName={companyName}
          currency={currency}
          dateRange={dateRange}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `inventory-overview-${dateRange.startDate}-${dateRange.endDate}.pdf`
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
    overview,
    byCategory,
    abcClassification,
    turnover,
    slowMoving.summary,
    topItemsByValue,
    locations,
    companyName,
    currency,
    dateRange,
  ])

  // ── Structured tooltip builders (computed from real data) ──

  const c = currency || 'USD'

  const overviewTooltipProps = useMemo(() => {
    if (!overview) return undefined
    return {
      description: 'High-level snapshot of your current inventory position from Business Central.',
      calculationTooltip: {
        formula:
          'Total Value = Σ costAmountActual from Item Ledger Entries per item (fallback: qty × unitCost)',
        components: [
          { label: 'Total Items', value: overview.total_items.toLocaleString() },
          {
            label: 'Items with Stock',
            value: `${overview.items_with_stock.toLocaleString()} (${overview.total_items > 0 ? ((overview.items_with_stock / overview.total_items) * 100).toFixed(1) : 0}%)`,
          },
          { label: 'Total Units', value: overview.total_units_on_hand.toLocaleString() },
          { label: 'Total Value', value: fmt(overview.total_inventory_value, c), highlight: true },
          { label: 'Avg Unit Cost', value: fmt(overview.average_unit_cost, c) },
        ],
      },
      note: 'Source: BC Items (counts/qty) + Item Ledger Entries (cost valuation). Value is at cost basis, not market/selling price.',
    }
  }, [overview, c])

  const abcTooltipProps = useMemo(() => {
    const total =
      abcClassification.A.totalValue +
      abcClassification.B.totalValue +
      abcClassification.C.totalValue
    const totalCount =
      abcClassification.A.count + abcClassification.B.count + abcClassification.C.count
    return {
      description:
        'ABC analysis ranks items by inventory value using the Pareto principle — a small number of items typically account for the majority of value.',
      calculationTooltip: {
        formula: 'Sort items by value desc → A = top 80%, B = next 15%, C = last 5%',
        components: [
          {
            label: 'A-Class Items',
            value: `${abcClassification.A.count} items — ${fmt(abcClassification.A.totalValue, c)} (${abcClassification.A.percentage.toFixed(1)}%)`,
          },
          {
            label: 'B-Class Items',
            value: `${abcClassification.B.count} items — ${fmt(abcClassification.B.totalValue, c)} (${abcClassification.B.percentage.toFixed(1)}%)`,
          },
          {
            label: 'C-Class Items',
            value: `${abcClassification.C.count} items — ${fmt(abcClassification.C.totalValue, c)} (${abcClassification.C.percentage.toFixed(1)}%)`,
          },
          {
            label: 'Total Classified',
            value: `${totalCount} items — ${fmt(total, c)}`,
            highlight: true,
          },
        ],
      },
      note: 'Source: BC Items + Item Ledger Entries. Value per item from costAmountActual (fallback: qty × unitCost), sorted descending with cumulative cutoffs at 80% / 95% / 100%.',
    }
  }, [abcClassification, c])

  const categoryTooltipProps = useMemo(() => {
    if (!byCategory || byCategory.length === 0) return undefined
    const totalVal = byCategory.reduce((s, cat) => s + cat.total_value, 0)
    const topCat = byCategory[0]
    return {
      description:
        'Inventory value grouped by Item Category Code from Business Central. Helps identify which product lines hold the most capital.',
      calculationTooltip: {
        formula: 'Category Value = Σ costAmountActual per category (fallback: qty × unitCost)',
        components: [
          { label: 'Categories', value: byCategory.length },
          {
            label: 'Largest Category',
            value: `${topCat?.item_category_code || 'N/A'} — ${fmt(topCat?.total_value || 0, c)}`,
          },
          { label: 'Total Value', value: fmt(totalVal, c), highlight: true },
        ],
      },
      note: 'Source: BC Items grouped by itemCategoryCode + Item Ledger Entries for cost valuation. Items without a category are grouped as "Uncategorized".',
    }
  }, [byCategory, c])

  const movementTooltipProps = useMemo(() => {
    if (!movementTrend || movementTrend.length === 0) return undefined
    const totalPurchases = movementTrend
      .filter((m) => m.entry_type === 'Purchase')
      .reduce((s, m) => s + m.total_cost, 0)
    const totalSales = movementTrend
      .filter((m) => m.entry_type === 'Sale')
      .reduce((s, m) => s + Math.abs(m.total_cost), 0)
    const totalAdj = movementTrend
      .filter((m) => !['Purchase', 'Sale'].includes(m.entry_type))
      .reduce((s, m) => s + Math.abs(m.total_cost), 0)
    return {
      description:
        'Monthly inventory movements from Item Ledger Entries. Shows the flow of goods in (purchases), out (sales), and adjustments over time.',
      calculationTooltip: {
        formula: 'Monthly totals from costAmountActual on Item Ledger Entries',
        components: [
          { label: 'Total Purchases', value: fmt(totalPurchases, c) },
          { label: 'Total Sales (COGS)', value: fmt(totalSales, c) },
          { label: 'Total Adjustments', value: fmt(totalAdj, c) },
          { label: 'Net Movement', value: fmt(totalPurchases - totalSales, c), highlight: true },
        ],
      },
      note: 'Source: BC Item Ledger Entries for the selected period. Values are absolute costAmountActual amounts.',
    }
  }, [movementTrend, c])

  const turnoverTooltipProps = useMemo(() => {
    if (!turnover) return undefined
    return {
      description:
        'Measures how efficiently inventory is being sold and replaced. Higher turnover means inventory moves faster, freeing up capital.',
      calculationTooltip: {
        formula: 'Turnover Ratio = Annualized COGS ÷ Current Inventory Value',
        components: [
          { label: 'Annualized COGS', value: fmt(turnover.cogs_annual, c) },
          { label: 'Current Inventory Value', value: fmt(turnover.current_inventory, c) },
          {
            label: 'Turnover Ratio',
            value: `${turnover.turnover_ratio.toFixed(1)}×`,
            highlight: true,
          },
          {
            label: 'Days Inventory Outstanding',
            value: `${Math.round(turnover.days_inventory_outstanding)} days`,
          },
        ],
      },
      note: 'Source: COGS from Sale-type Item Ledger Entries, annualized from the selected period. DIO = 365 ÷ Turnover Ratio. Target: 5–12× for most industries.',
    }
  }, [turnover, c])

  const slowMovingTooltipProps = useMemo(() => {
    const items = slowMoving.items
    const summary = slowMoving.summary
    const totalAtRisk = summary?.totalValue ?? items.reduce((s, i) => s + i.inventory_value, 0)
    const zeroCount =
      summary?.zeroSalesCount ?? items.filter((i) => i.days_since_last_sale === null).length
    const pctOfTotal =
      totalInventoryValue > 0 ? ((totalAtRisk / totalInventoryValue) * 100).toFixed(1) : '0'
    return {
      description:
        'Items with stock on hand but infrequent or no sales. Capital tied up in slow movers is at risk and may need markdown, bundling, or discontinuation.',
      calculationTooltip: {
        formula: 'Slow = items with stock & (no sales OR >60 days since last sale)',
        components: [
          { label: 'Slow-Moving Items', value: summary?.totalItems ?? items.length },
          { label: 'Never-Sold Items', value: zeroCount },
          { label: 'Capital at Risk', value: fmt(totalAtRisk, c), highlight: true },
          { label: '% of Total Inventory', value: `${pctOfTotal}%` },
        ],
      },
      note: 'Source: BC Items + Item Ledger Entries. Risk tiers: No Sales > Critical (>180d) > High (>90d) > Medium (>60d).',
    }
  }, [slowMoving, totalInventoryValue, c])

  const topItemsTooltipProps = useMemo(() => {
    if (!topItemsByValue || topItemsByValue.length === 0) return undefined
    const top10Val = topItemsByValue.reduce((s, i) => s + i.inventory_value, 0)
    const pctOfTotal =
      totalInventoryValue > 0 ? ((top10Val / totalInventoryValue) * 100).toFixed(1) : '0'
    return {
      description:
        'Top items ranked by inventory value (quantity × unit cost). Reveals value concentration — often a few items hold most of the value (Pareto principle).',
      calculationTooltip: {
        formula:
          'Item Value = Σ costAmountActual from Item Ledger Entries (fallback: qty × unitCost)',
        components: [
          { label: `Top ${topItemsByValue.length} Items Value`, value: fmt(top10Val, c) },
          { label: 'Total Inventory Value', value: fmt(totalInventoryValue, c) },
          { label: 'Concentration', value: `${pctOfTotal}% of total`, highlight: true },
        ],
      },
      note: 'Source: BC Items + Item Ledger Entries for cost valuation, sorted by value descending. Click any item for its full detail.',
    }
  }, [topItemsByValue, totalInventoryValue, c])

  const locationsTooltipProps = useMemo(
    () => ({
      description:
        'Warehouse and fulfillment locations from the BC Locations entity. Includes all storage points: FBA centers, offices, partner locations, transit points.',
      calculationTooltip: {
        formula: 'Count of all active BC Location records',
        components: [{ label: 'Total Locations', value: locations.length, highlight: true }],
      },
      note: 'Source: BC Locations entity. Per-location inventory quantities require Item Ledger Entry aggregation — see the Locations sub-page for detailed breakdown.',
    }),
    [locations]
  )

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500" />
          <h3 className="text-lg font-semibold theme-text-primary">Data Load Error</h3>
          <p className="text-sm theme-text-secondary">
            {error instanceof Error ? error.message : 'Failed to load inventory data.'}
          </p>
          <Button variant="outline" onClick={() => mutate()} className="mt-2">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Format date for display
  const formatDisplayDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="@container space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-10 pt-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="dashboard-title text-[36px] font-light theme-text-primary tracking-tight">
              Inventory
            </h1>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-amber-500/80 mt-2">
              Business Central
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
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloadingPDF || isLoading || !overview}
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
      </div>

      {/* Overview + Category */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-20 pt-6')}>
        {/* Overview Section */}
        <section
          className={cn(
            '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
            isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
            sectionHover
          )}
        >
          <InventoryOverviewCard
            data={overview}
            isLoading={isLoading}
            currency={currency}
            tooltipProps={overviewTooltipProps}
          />
        </section>

        {/* Category Section */}
        <section className={sectionHover}>
          <InventoryByCategoryCard
            data={byCategory}
            isLoading={isLoading}
            currency={currency}
            tooltipProps={categoryTooltipProps}
          />
        </section>
      </div>

      {/* Turnover + Movement Trend */}
      <div
        className={cn(
          'grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-20 pt-6 border-t',
          styles.border
        )}
      >
        {/* Turnover Section */}
        <section
          className={cn(
            '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
            isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
            sectionHover
          )}
        >
          <InventoryTurnoverCard
            data={turnover}
            rating={turnoverRating}
            isLoading={isLoading}
            currency={currency}
            tooltipProps={turnoverTooltipProps}
          />
        </section>

        {/* Movement Trend */}
        <section className={sectionHover}>
          <InventoryMovementTrendCard
            data={movementTrend}
            isLoading={isLoading}
            currency={currency}
            tooltipProps={movementTooltipProps}
          />
        </section>
      </div>

      {/* ABC Classification + Top Items */}
      <div
        className={cn(
          'grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-20 pt-6 border-t',
          styles.border
        )}
      >
        {/* ABC Classification */}
        <section
          className={cn(
            '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
            isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
            sectionHover
          )}
        >
          <ABCClassificationCard
            data={abcClassification}
            isLoading={isLoading}
            currency={currency}
            tooltipProps={abcTooltipProps}
          />
        </section>

        {/* Top Items by Value */}
        <section className={sectionHover}>
          <TopItemsByValueCard
            data={topItemsByValue}
            totalValue={totalInventoryValue}
            isLoading={isLoading}
            currency={currency}
            tooltipProps={topItemsTooltipProps}
            onItemClick={(itemNo) =>
              setSelectedTopItem((prev) => (prev === itemNo ? null : itemNo))
            }
            selectedItemNumber={selectedTopItem}
            renderItemDetail={() => (
              <ItemDetailDrawer
                open={!!selectedTopItem}
                onClose={() => setSelectedTopItem(null)}
                connectionId={connectionId}
                itemNumber={selectedTopItem}
                dateRange={dateRange}
                currency={currency}
                abcClass={selectedTopItemData?.abc_class}
                healthScore={selectedTopItemData?.health_score}
              />
            )}
          />
        </section>
      </div>

      {/* Slow Moving Inventory */}
      <div
        className={cn(
          'grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-20 pt-6 border-t',
          styles.border
        )}
      >
        <section className={sectionHover}>
          <SlowMovingInventoryCard
            data={slowMoving.items}
            summary={slowMoving.summary}
            isLoading={isLoading}
            currency={currency}
            tooltipProps={slowMovingTooltipProps}
            onItemClick={(itemNo) =>
              setSelectedItemNumber((prev) => (prev === itemNo ? null : itemNo))
            }
            selectedItemNumber={selectedItemNumber}
            renderItemDetail={() => (
              <ItemDetailDrawer
                open={!!selectedItemNumber}
                onClose={() => setSelectedItemNumber(null)}
                connectionId={connectionId}
                itemNumber={selectedItemNumber}
                dateRange={dateRange}
                currency={currency}
                abcClass={selectedItemData?.abc_class}
                healthScore={selectedItemData?.health_score}
              />
            )}
          />
        </section>
      </div>

      {/* Locations */}
      {(isLoading || locations.length > 0) && (
        <div className={cn('pt-6 border-t', styles.border)}>
          <section className={sectionHover}>
            <LocationsCard
              data={locations}
              isLoading={isLoading}
              tooltipProps={locationsTooltipProps}
            />
          </section>
        </div>
      )}

      {/* Stock Movement Report */}
      <div className={cn('pt-6 border-t', styles.border)}>
        <section>
          <StockMovementReportCard
            entries={smPeriodEntries}
            priorEntries={smPriorEntries}
            itemWeights={smItemWeights}
            isLoading={smLoading || isLoading}
            currency={smCurrency || currency}
            onItemClick={(itemNo) =>
              setSelectedItemNumber((prev) => (prev === itemNo ? null : itemNo))
            }
            dateRange={
              dateRange.startDate && dateRange.endDate
                ? { start: dateRange.startDate, end: dateRange.endDate }
                : undefined
            }
            selectedItemNumber={selectedItemNumber}
            renderItemDetail={() => (
              <ItemDetailDrawer
                open={!!selectedItemNumber}
                onClose={() => setSelectedItemNumber(null)}
                connectionId={connectionId}
                itemNumber={selectedItemNumber}
                dateRange={dateRange}
                currency={currency}
                abcClass={selectedItemData?.abc_class}
                healthScore={selectedItemData?.health_score}
              />
            )}
          />
        </section>
      </div>

      {/* Navigation Links to Sub-Pages */}
      {!isLoading && (
        <div
          className={cn(
            'grid grid-cols-1 @md:grid-cols-2 @xl:grid-cols-4 gap-3 pt-6 border-t',
            styles.border
          )}
        >
          <Link
            href={subPageHref('/bc/inventory/items')}
            className={cn(
              'flex items-center justify-between p-4 rounded-lg border transition-all duration-200 group',
              styles.border,
              styles.hoverBg,
              'hover:border-cyan-500/40'
            )}
          >
            <div>
              <div className={cn('text-sm font-medium', styles.text)}>View All Items</div>
              <div className={cn('text-[10px] mt-0.5', styles.textMuted)}>
                Search, filter & sort {allItems.length} items
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-cyan-400 transition-colors" />
          </Link>
          <Link
            href={subPageHref('/bc/inventory/stock-analysis')}
            className={cn(
              'flex items-center justify-between p-4 rounded-lg border transition-all duration-200 group',
              styles.border,
              styles.hoverBg,
              'hover:border-cyan-500/40'
            )}
          >
            <div>
              <div className={cn('text-sm font-medium', styles.text)}>Stock Analysis</div>
              <div className={cn('text-[10px] mt-0.5', styles.textMuted)}>
                Health scores, ABC deep-dive, slow-movers
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-cyan-400 transition-colors" />
          </Link>
          <Link
            href={subPageHref('/bc/inventory/locations')}
            className={cn(
              'flex items-center justify-between p-4 rounded-lg border transition-all duration-200 group',
              styles.border,
              styles.hoverBg,
              'hover:border-cyan-500/40'
            )}
          >
            <div>
              <div className={cn('text-sm font-medium', styles.text)}>Explore Locations</div>
              <div className={cn('text-[10px] mt-0.5', styles.textMuted)}>
                {locations.length} locations grouped by type
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-cyan-400 transition-colors" />
          </Link>
          <Link
            href={subPageHref('/bc/inventory/ledger-entries')}
            className={cn(
              'flex items-center justify-between p-4 rounded-lg border transition-all duration-200 group',
              styles.border,
              styles.hoverBg,
              'hover:border-cyan-500/40'
            )}
          >
            <div>
              <div className={cn('text-sm font-medium', styles.text)}>Ledger Entries</div>
              <div className={cn('text-[10px] mt-0.5', styles.textMuted)}>
                Raw transaction log from BC
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-cyan-400 transition-colors" />
          </Link>
        </div>
      )}
    </div>
  )
}
