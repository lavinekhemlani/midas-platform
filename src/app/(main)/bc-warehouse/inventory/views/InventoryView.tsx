'use client'

import { useMemo, useEffect, useState } from 'react'
import {
  Package,
  RefreshCw,
  AlertCircle,
  TrendingDown,
  AlertTriangle,
  Calendar,
  X,
} from 'lucide-react'
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
import { useCurrency } from '@/contexts/CurrencyContext'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import {
  useWarehouseConfig,
  useWarehouseCompanyInfo,
} from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'
import { useBCConnection } from '@/hooks/useBCConnection'
import { useBCInventoryEnhanced } from '@/app/(main)/bc/hooks/useBCInventoryEnhanced'
import {
  useInventoryOverview,
  useInventoryByCategory,
  useTopItemsByValue,
  useSlowMovingInventory,
  useInventoryMovementTrend,
  useInventoryTurnover,
  useInventoryValuation,
  type InventoryByCategoryRow,
  type DateRange,
} from '@/app/(main)/bc/inventory/hooks/useInventoryData'
import { DateRangeInputs } from '@/app/(main)/reports/components/DateRangeInputs'
import { getDateRangeForPeriod } from '@/lib/utils/dateRanges'
import { EntityExportDropdown } from '@/app/(main)/bc/components/EntityExportDropdown'
import { SlowMovingInventoryDonut } from '@/app/(main)/bc/inventory/components/SlowMovingInventoryDonut'
import { TopItemsHorizontalChart } from '@/app/(main)/bc/inventory/components/TopItemsHorizontalChart'
import { ValuationComparisonChart } from '@/app/(main)/bc/inventory/components/ValuationComparisonChart'

// Period options for inventory reports
const inventoryPeriodOptions = [
  { value: 'all_time', label: 'All Time' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' },
]

// Local PeriodSelect component
function InventoryPeriodSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (period: string) => void
  disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full h-9 glass-luxury-card border-amber-500/20 hover:border-amber-500/40 transition-all duration-200 text-sm">
        <Calendar className="w-3.5 h-3.5 mr-2 text-amber-500" />
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent className="glass-luxury-card">
        {inventoryPeriodOptions.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-sm cursor-pointer">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// Category colors for the strip visualization
const CATEGORY_COLORS = [
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
]

// ============================================================================
// Minimal Donut Chart Component
// ============================================================================
interface DonutChartProps {
  data: Array<{ value: number; color: string; label: string }>
  size?: number
  thickness?: number
  isLight: boolean
  centerLabel?: string
  centerValue?: string
}

function DonutChart({
  data,
  size = 140,
  thickness = 20,
  isLight,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2
  const total = data.reduce((sum, d) => sum + d.value, 0)

  let cumulativePercentage = 0

  return (
    <div className="relative overflow-visible" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90 overflow-visible">
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={isLight ? '#e5e7eb' : 'rgba(255,255,255,0.06)'}
          strokeWidth={thickness}
        />
        {/* Segments */}
        {data.map((segment, i) => {
          const percentage = total > 0 ? (segment.value / total) * 100 : 0
          const startOffset = (cumulativePercentage / 100) * circumference
          const segmentLength = (percentage / 100) * circumference
          cumulativePercentage += percentage

          const isHovered = hoveredIndex === i

          return (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={isHovered ? thickness + 4 : thickness}
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={-startOffset}
              className="transition-all duration-200 cursor-pointer"
              style={{ opacity: hoveredIndex !== null && !isHovered ? 0.4 : 1 }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          )
        })}
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {hoveredIndex !== null && data[hoveredIndex] ? (
          <>
            <span
              className={cn(
                'text-lg font-mono font-bold',
                isLight ? 'text-stone-900' : 'text-white'
              )}
            >
              {((data[hoveredIndex].value / total) * 100).toFixed(0)}%
            </span>
            <span
              className={cn(
                'text-[9px] uppercase tracking-wider text-center px-2',
                isLight ? 'text-stone-500' : 'text-stone-400'
              )}
            >
              {data[hoveredIndex].label.length > 10
                ? data[hoveredIndex].label.substring(0, 10) + '...'
                : data[hoveredIndex].label}
            </span>
          </>
        ) : null}
      </div>
    </div>
  )
}

// ============================================================================
// Turnover Gauge Component
// ============================================================================
interface TurnoverGaugeProps {
  ratio: number
  rating: 'excellent' | 'good' | 'fair' | 'poor' | null
  isLight: boolean
}

function TurnoverGauge({ ratio, rating, isLight }: TurnoverGaugeProps) {
  const size = 120
  const thickness = 12
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  // Normalize ratio to 0-100% (assuming max 12x is excellent)
  const maxRatio = 12
  const percentage = Math.min((ratio / maxRatio) * 100, 100)
  const segmentLength = (percentage / 100) * circumference * 0.75 // 75% of circle (270 degrees)

  const ratingColor =
    rating === 'excellent'
      ? '#10b981'
      : rating === 'good'
        ? '#3b82f6'
        : rating === 'fair'
          ? '#f59e0b'
          : '#ef4444'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform rotate-[135deg]">
        {/* Background arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={isLight ? '#e5e7eb' : 'rgba(255,255,255,0.06)'}
          strokeWidth={thickness}
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
        />
        {/* Value arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={ratingColor}
          strokeWidth={thickness}
          strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
          className="transition-all duration-700"
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
        <span
          className={cn(
            'text-2xl font-mono font-bold tracking-tight',
            isLight ? 'text-stone-900' : 'text-white'
          )}
        >
          {ratio.toFixed(2)}x
        </span>
        <span
          className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5"
          style={{ color: ratingColor, backgroundColor: `${ratingColor}15` }}
        >
          {rating}
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// Movement Flow Bar Component
// ============================================================================
interface MovementFlowBarProps {
  purchases: number
  sales: number
  adjustments: number
  isLight: boolean
  currency: string
}

function MovementFlowBar({
  purchases,
  sales,
  adjustments,
  isLight,
  currency,
}: MovementFlowBarProps) {
  const total = purchases + sales + adjustments
  const purchasesPct = total > 0 ? (purchases / total) * 100 : 0
  const salesPct = total > 0 ? (sales / total) * 100 : 0
  const adjustmentsPct = total > 0 ? (adjustments / total) * 100 : 0

  return (
    <div className="space-y-2">
      {/* Stacked bar - straight edges */}
      <div className="h-3 overflow-hidden flex">
        <div
          className="bg-blue-500 transition-all duration-500"
          style={{ width: `${purchasesPct}%` }}
          title={`Purchases: ${formatCompactCurrency(purchases, currency)}`}
        />
        <div
          className="bg-green-500 transition-all duration-500"
          style={{ width: `${salesPct}%` }}
          title={`Sales: ${formatCompactCurrency(sales, currency)}`}
        />
        <div
          className="bg-amber-500 transition-all duration-500"
          style={{ width: `${adjustmentsPct}%` }}
          title={`Adjustments: ${formatCompactCurrency(adjustments, currency)}`}
        />
      </div>
    </div>
  )
}

export function InventoryView() {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const welcomeContext = useWelcomeContextOptional()

  // Date range filter state - default to last_year to match Summary page
  const [selectedPeriod, setSelectedPeriod] = useState<string>('last_year')
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  })

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      sectionBg: isLight ? 'bg-white' : 'bg-white/[0.02]',
      filterBg: isLight ? 'bg-stone-50' : 'bg-white/[0.02]',
      filterBorder: isLight ? 'border-stone-200' : 'border-white/[0.08]',
    }),
    [isLight]
  )

  const sectionHover = cn(
    'group relative -mx-3 px-3 -mt-4 pt-4 -mb-10 pb-10 rounded-[4px]',
    'transition-all duration-300 ease-out',
    'hover:-translate-y-1 hover:z-10',
    isLight
      ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
      : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
  )

  // Calculate effective date range based on selected period
  const effectiveDateRange: DateRange | undefined = useMemo(() => {
    if (selectedPeriod === 'all_time') {
      return undefined
    }
    if (selectedPeriod === 'custom') {
      if (customDateRange.start && customDateRange.end) {
        return { startDate: customDateRange.start, endDate: customDateRange.end }
      }
      return undefined
    }
    // Use preset period
    const range = getDateRangeForPeriod(selectedPeriod)
    return { startDate: range.start, endDate: range.end }
  }, [selectedPeriod, customDateRange])

  // Format date for display
  const formatDisplayDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Format date range for display
  const formatDateRange = () => {
    if (!effectiveDateRange) return null
    return (
      <span className="flex items-center gap-2 text-sm theme-text-secondary">
        <span className="font-serif italic text-[0.9rem] theme-text-primary">from</span>
        <span>{formatDisplayDate(effectiveDateRange.startDate)}</span>
        <span className="font-serif italic text-[0.9rem] theme-text-primary">to</span>
        <span>{formatDisplayDate(effectiveDateRange.endDate)}</span>
      </span>
    )
  }

  // Handle period change
  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
    if (period !== 'custom') {
      setCustomDateRange({ start: '', end: '' })
    } else {
      const range = getDateRangeForPeriod(
        selectedPeriod === 'all_time' ? 'last_year' : selectedPeriod
      )
      setCustomDateRange({ start: range.start, end: range.end })
    }
  }

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
  const { setCurrency } = useCurrency()

  // Sync BC currency into the global context so TopBar can display it
  useEffect(() => {
    if (currency) setCurrency(currency)
  }, [currency, setCurrency])

  const {
    data: overviewData,
    isLoading: overviewLoading,
    mutate: mutateOverview,
    // KPIs are always as-of-today from item_ledger_entry, not affected by date range
  } = useInventoryOverview(schema)

  const {
    data: categoryData,
    isLoading: categoryLoading,
    mutate: mutateCategory,
  } = useInventoryByCategory(schema)

  // Redshift (dead code — kept for reference)
  // const {
  //   data: topItemsData,
  //   totalValue: topItemsTotalValue,
  //   isLoading: topItemsLoading,
  //   mutate: mutateTopItems,
  // } = useTopItemsByValue(schema)

  // OAuth: use live BC API so values match the agent
  const { activeConnection } = useBCConnection()
  const oauthInventory = useBCInventoryEnhanced(
    activeConnection?.id ?? null,
    effectiveDateRange?.startDate && effectiveDateRange?.endDate
      ? { startDate: effectiveDateRange.startDate, endDate: effectiveDateRange.endDate }
      : undefined
  )
  const {
    topItemsByValue: oauthTopItems,
    totalInventoryValue: oauthTopItemsTotalValue,
    isLoading: topItemsLoading,
    mutate: mutateTopItems,
  } = oauthInventory
  const topItemsData = oauthTopItems
  const topItemsTotalValue = oauthTopItemsTotalValue

  const {
    data: slowMovingData,
    summary: slowMovingSummary,
    isLoading: slowMovingLoading,
    mutate: mutateSlowMoving,
  } = useSlowMovingInventory(schema, effectiveDateRange)

  const {
    data: movementTrendData,
    isLoading: movementTrendLoading,
    mutate: mutateMovementTrend,
  } = useInventoryMovementTrend(schema, effectiveDateRange)

  // Redshift (dead code — kept for reference)
  // const {
  //   data: turnoverData,
  //   rating: turnoverRating,
  //   isLoading: turnoverLoading,
  //   mutate: mutateTurnover,
  // } = useInventoryTurnover(schema, effectiveDateRange)

  // OAuth: use live BC API so values match the agent
  const turnoverData = oauthInventory.turnover
  const turnoverLoading = oauthInventory.isLoading
  const mutateTurnover = oauthInventory.mutate
  let turnoverRating: 'excellent' | 'good' | 'fair' | 'poor' | null = null
  if (turnoverData && turnoverData.turnover_ratio > 0) {
    if (turnoverData.turnover_ratio >= 8) turnoverRating = 'excellent'
    else if (turnoverData.turnover_ratio >= 4) turnoverRating = 'good'
    else if (turnoverData.turnover_ratio >= 2) turnoverRating = 'fair'
    else turnoverRating = 'poor'
  }

  const {
    data: valuationData,
    summary: valuationSummary,
    isLoading: valuationLoading,
    mutate: mutateValuation,
  } = useInventoryValuation(schema)

  const isLoading =
    overviewLoading ||
    categoryLoading ||
    topItemsLoading ||
    slowMovingLoading ||
    movementTrendLoading ||
    turnoverLoading ||
    valuationLoading

  useEffect(() => {
    const hasData = !!overviewData || !!categoryData
    welcomeContext?.setDataLoading(configLoading || (isLoading && !hasData))
  }, [welcomeContext, configLoading, isLoading, overviewData, categoryData])

  const mutateAll = () => {
    mutateOverview()
    mutateCategory()
    mutateTopItems()
    mutateSlowMoving()
    mutateMovementTrend()
    mutateTurnover()
    mutateValuation()
  }

  // Process movement trend data for display
  const movementSummary = useMemo(() => {
    if (!movementTrendData || movementTrendData.length === 0) return null

    let purchases = 0
    let sales = 0
    let adjustments = 0

    for (const row of movementTrendData) {
      const entryType = (row.entry_type || '').toLowerCase()
      if (entryType.includes('purchase') || entryType.includes('positive')) {
        purchases += Math.abs(row.total_cost)
      } else if (entryType.includes('sale') || entryType.includes('negative')) {
        sales += Math.abs(row.total_cost)
      } else {
        adjustments += Math.abs(row.total_cost)
      }
    }

    return { purchases, sales, adjustments }
  }, [movementTrendData])

  const totalCategoryValue = categoryData?.reduce((sum, c) => sum + c.total_value, 0) || 0

  const fmt = (v: number, c: string) => formatCompactCurrency(v, c)

  // ── Tooltip builders (matching bc/inventory pattern) ──

  const overviewTooltipProps = useMemo(() => {
    if (!overviewData) return undefined
    return {
      description:
        'Current inventory snapshot from item_ledger_entry. Shows items with posted transactions and their current stock position as of today.',
      calculationTooltip: {
        formula:
          'Total Value = Σ closing_value per item\nFrom: item_ledger_entry\nGROUP BY item_no HAVING SUM(qty) > 0',
        components: [
          { label: 'Total Items', value: overviewData.total_items.toLocaleString() },
          {
            label: 'Items with Stock',
            value: `${overviewData.items_with_stock.toLocaleString()} (${overviewData.total_items > 0 ? ((overviewData.items_with_stock / overviewData.total_items) * 100).toFixed(1) : 0}%)`,
          },
          { label: 'Total Units', value: overviewData.total_units_on_hand.toLocaleString() },
          {
            label: 'Total Value',
            value: fmt(overviewData.total_inventory_value, currency),
            highlight: true,
          },
          { label: 'Avg Unit Cost', value: fmt(overviewData.average_unit_cost, currency) },
        ],
      },
      note: `Source: ${schema}.item_ledger_entry (all time, as of today). Total Items = distinct items with any ledger entry. Stock values = current position.`,
    }
  }, [overviewData, currency, schema])

  const categoryTooltipProps = useMemo(() => {
    if (!categoryData || categoryData.length === 0) return undefined
    const topCat = categoryData[0]
    return {
      description:
        'Inventory value grouped by item_category_code from the warehouse item table. Helps identify which product lines hold the most capital.',
      calculationTooltip: {
        formula: 'Category Value =\nΣ (inventory × unit_cost)\nGROUP BY item_category_code',
        components: [
          { label: 'Categories', value: categoryData.length },
          {
            label: 'Largest Category',
            value: `${topCat?.item_category_code || 'N/A'} — ${fmt(topCat?.total_value || 0, currency)}`,
          },
          { label: 'Total Value', value: fmt(totalCategoryValue, currency), highlight: true },
        ],
      },
      note: `Source: ${schema}.item grouped by item_category_code. Items without a category are grouped as "Uncategorized". Top 20 categories shown.`,
    }
  }, [categoryData, totalCategoryValue, currency, schema])

  const turnoverTooltipProps = useMemo(() => {
    if (!turnoverData) return undefined
    return {
      description:
        'Measures how efficiently inventory is being sold and replaced. Higher turnover means inventory moves faster, freeing up capital.',
      calculationTooltip: {
        formula: 'Turnover Ratio =\nCOGS ÷ Current Inventory Value',
        components: [
          { label: 'COGS (Period)', value: fmt(turnoverData.cogs_annual, currency) },
          {
            label: 'Current Inventory Value',
            value: fmt(turnoverData.current_inventory, currency),
          },
          {
            label: 'Turnover Ratio',
            value: `${turnoverData.turnover_ratio.toFixed(2)}×`,
            highlight: true,
          },
          {
            label: 'Days Inventory Outstanding',
            value: `${Math.round(turnoverData.days_inventory_outstanding)} days`,
          },
        ],
      },
      note: `Source: COGS from ${schema}.g_l_entry joined with g_l_account (account_category = Cost of Goods Sold). Inventory from ${schema}.item. DIO = (Inventory ÷ COGS) × 365. Rating: ≥8× excellent, ≥4× good, ≥2× fair, <2× poor.`,
    }
  }, [turnoverData, currency, schema])

  const valuationTooltipProps = useMemo(() => {
    if (!valuationSummary) return undefined
    return {
      description:
        'Compares inventory value under different costing methods: Unit Cost (actual), Standard Cost (predetermined), and Last Direct Cost (most recent purchase price).',
      calculationTooltip: {
        formula: 'Value = Σ (inventory × cost)\nFor each costing method',
        components: [
          {
            label: 'At Unit Cost',
            value: fmt(valuationSummary.total_value_at_unit_cost, currency),
          },
          {
            label: 'At Standard Cost',
            value: fmt(valuationSummary.total_value_at_standard_cost, currency),
          },
          {
            label: 'At Last Direct Cost',
            value: fmt(valuationSummary.total_value_at_last_direct_cost, currency),
          },
          {
            label: 'Variance (Unit vs Std)',
            value: fmt(
              valuationSummary.total_value_at_unit_cost -
                valuationSummary.total_value_at_standard_cost,
              currency
            ),
            highlight: true,
          },
        ],
      },
      note: `Source: ${schema}.item (unit_cost, standard_cost, last_direct_cost fields). Only items with inventory > 0 are included. Top 50 items by value.`,
    }
  }, [valuationSummary, currency, schema])

  const topItemsTooltipProps = useMemo(() => {
    if (!topItemsData || topItemsData.length === 0) return undefined
    const top10Val = topItemsTotalValue || 0
    const totalVal = overviewData?.total_inventory_value || 0
    const pctOfTotal = totalVal > 0 ? ((top10Val / totalVal) * 100).toFixed(1) : '0'
    return {
      description:
        'Top items ranked by inventory value (quantity × unit cost). Reveals value concentration — often a few items hold most of the total value (Pareto principle).',
      calculationTooltip: {
        formula: 'Item Value = inventory × unit_cost, sorted DESC',
        components: [
          { label: `Top ${topItemsData.length} Items Value`, value: fmt(top10Val, currency) },
          { label: 'Total Inventory Value', value: fmt(totalVal, currency) },
          { label: 'Concentration', value: `${pctOfTotal}% of total`, highlight: true },
        ],
      },
      note: `Source: ${schema}.item where inventory > 0. Ordered by inventory × unit_cost descending, limited to top 20.`,
    }
  }, [topItemsData, topItemsTotalValue, overviewData, currency, schema])

  const slowMovingTooltipProps = useMemo(() => {
    if (!slowMovingSummary) return undefined
    const totalVal = overviewData?.total_inventory_value || 0
    const pctOfTotal =
      totalVal > 0 ? ((slowMovingSummary.totalValue / totalVal) * 100).toFixed(1) : '0'
    return {
      description:
        'Items with stock on hand but infrequent or no sales. Capital tied up in slow movers is at risk and may need markdown, bundling, or discontinuation.',
      calculationTooltip: {
        formula:
          'Slow = items with inventory > 0\nSorted by turnover_ratio ASC\n(lowest turnover first)',
        components: [
          { label: 'Slow-Moving Items', value: slowMovingSummary.totalItems },
          { label: 'Never-Sold Items', value: slowMovingSummary.zeroSalesCount },
          {
            label: 'Capital at Risk',
            value: fmt(slowMovingSummary.totalValue, currency),
            highlight: true,
          },
          { label: '% of Total Inventory', value: `${pctOfTotal}%` },
        ],
      },
      note: `Source: ${schema}.item LEFT JOIN item_ledger_entry (for period sales). Turnover = period_sales_qty ÷ inventory. Items with zero sales appear first, then lowest turnover.`,
    }
  }, [slowMovingSummary, overviewData, currency, schema])

  const movementTooltipProps = useMemo(() => {
    if (!movementSummary) return undefined
    const total = movementSummary.purchases + movementSummary.sales + movementSummary.adjustments
    return {
      description:
        'Inventory movements from item_ledger_entry, grouped by entry type. Shows the flow of goods in (purchases), out (sales), and adjustments over the selected period.',
      calculationTooltip: {
        formula:
          'Monthly totals =\nΣ cost_amount_actual\nFROM item_ledger_entry\nGROUP BY month, entry_type',
        components: [
          { label: 'Total Purchases (In)', value: fmt(movementSummary.purchases, currency) },
          { label: 'Total Sales (Out)', value: fmt(movementSummary.sales, currency) },
          { label: 'Total Adjustments', value: fmt(movementSummary.adjustments, currency) },
          {
            label: 'Net Flow',
            value: fmt(movementSummary.purchases - movementSummary.sales, currency),
            highlight: true,
          },
        ],
      },
      note: `Source: ${schema}.item_ledger_entry. Entry types containing "purchase"/"positive" → Purchases, "sale"/"negative" → Sales, others → Adjustments. Values are absolute cost_amount_actual.`,
    }
  }, [movementSummary, currency, schema])

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn('text-[36px] font-light tracking-tight', styles.text)}>Inventory</h1>
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-amber-500/80">
            {companyName && `${companyName} · `}
            {schema}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedPeriod === 'custom' && (
            <DateRangeInputs
              startDate={customDateRange.start}
              endDate={customDateRange.end}
              onStartChange={(date) => setCustomDateRange((prev) => ({ ...prev, start: date }))}
              onEndChange={(date) => setCustomDateRange((prev) => ({ ...prev, end: date }))}
              compact
            />
          )}
          {selectedPeriod !== 'custom' && (
            <span className="hidden sm:inline">{formatDateRange()}</span>
          )}
          <div className="w-[160px]">
            <InventoryPeriodSelect
              value={selectedPeriod}
              onChange={handlePeriodChange}
              disabled={isLoading}
            />
          </div>
          {selectedPeriod !== 'all_time' && (
            <button
              onClick={() => setSelectedPeriod('all_time')}
              className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors"
              title="Clear date filter"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={mutateAll}
            disabled={isLoading}
            className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ── CURRENT INVENTORY OVERVIEW ── */}
      <div className="pt-6 overflow-visible">
        <div className="flex items-center gap-3 mb-8">
          <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
            Current Inventory Overview
          </h2>
          <div className="h-px flex-1 section-divider-line" />
          {overviewData && (
            <EntityExportDropdown
              entityType="item"
              schema={schema}
              currency={currency}
              totalCount={overviewData.total_items}
              companyName={companyName}
              dateRange={
                effectiveDateRange?.startDate && effectiveDateRange?.endDate
                  ? { startDate: effectiveDateRange.startDate, endDate: effectiveDateRange.endDate }
                  : undefined
              }
            />
          )}
        </div>

        <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 overflow-visible')}>
          {/* Overview Mini Cards */}
          <section
            className={cn('pb-6 @3xl:pb-0 @3xl:pr-8 @3xl:border-r', styles.border, sectionHover)}
          >
            <div className="flex items-center gap-1.5 mb-5">
              <span
                className={cn(
                  'relative text-base font-normal uppercase tracking-wider',
                  isLight ? 'text-stone-800' : 'text-stone-300'
                )}
              >
                Inventory Overview
                <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
              </span>
              {overviewTooltipProps && <InfoTooltip {...overviewTooltipProps} />}
            </div>
            {overviewLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-[72px] animate-pulse rounded-lg',
                      isLight ? 'bg-stone-200' : 'bg-white/[0.04]'
                    )}
                  />
                ))}
              </div>
            ) : overviewData ? (
              <div className="grid grid-cols-2 gap-3 pb-8">
                {[
                  {
                    label: 'Total Items',
                    value: overviewData.total_items.toLocaleString(),
                    subValue: `${overviewData.total_items > 0 ? ((overviewData.items_with_stock / overviewData.total_items) * 100).toFixed(1) : 0}% with stock`,
                    color: 'text-orange-500',
                  },
                  {
                    label: 'Items with Stock',
                    value: overviewData.items_with_stock.toLocaleString(),
                    subValue: 'Active SKUs',
                    color: isLight ? 'text-blue-600' : 'text-blue-400',
                  },
                  {
                    label: 'Total Value',
                    value: formatCompactCurrency(overviewData.total_inventory_value, currency),
                    subValue: 'Inventory at cost',
                    color: isLight ? 'text-green-600' : 'text-green-400',
                  },
                  {
                    label: 'Total Units',
                    value: overviewData.total_units_on_hand.toLocaleString(),
                    subValue: 'Quantity on hand',
                    color: 'text-purple-500',
                  },
                  {
                    label: 'Avg Unit Cost',
                    value: formatCompactCurrency(overviewData.average_unit_cost, currency),
                    subValue: 'Weighted average',
                    color: 'text-amber-500',
                  },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className={cn('p-3', isLight ? 'bg-stone-200/40' : 'bg-white/[0.03]')}
                  >
                    <div
                      className={cn(
                        'text-[12px] uppercase tracking-wider font-medium mb-1',
                        styles.textMuted
                      )}
                    >
                      {metric.label}
                    </div>
                    <div
                      className={cn(
                        'text-[20px] font-mono font-semibold tabular-nums leading-tight',
                        metric.color
                      )}
                    >
                      {metric.value}
                    </div>
                    <div className={cn('text-[12px] mt-0.5', styles.textMuted)}>
                      {metric.subValue}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={cn('text-sm py-4', styles.textMuted)}>No inventory data available</p>
            )}
          </section>

          {/* Stock by Category */}
          <section className={sectionHover}>
            <div className="flex items-center gap-1.5 mb-5">
              <span
                className={cn(
                  'relative text-base font-normal uppercase tracking-wider',
                  isLight ? 'text-stone-800' : 'text-stone-300'
                )}
              >
                Stock by Category
                <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
              </span>
              {categoryTooltipProps && <InfoTooltip {...categoryTooltipProps} />}
            </div>
            {categoryLoading ? (
              <div className="flex gap-6">
                <div
                  className={cn(
                    'w-[140px] h-[140px] rounded-full animate-pulse flex-shrink-0',
                    isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
                  )}
                />
                <div className="flex-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-7 animate-pulse',
                        i % 2 === 0 ? (isLight ? 'bg-slate-100/70' : 'bg-white/[0.02]') : ''
                      )}
                    />
                  ))}
                </div>
              </div>
            ) : categoryData && categoryData.length > 0 ? (
              <div className="flex gap-6 items-center">
                {/* Donut Chart */}
                <div className="flex-shrink-0 flex flex-col items-center">
                  <DonutChart
                    data={categoryData.slice(0, 8).map((cat, i) => ({
                      value: cat.total_value,
                      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                      label: cat.item_category_code,
                    }))}
                    size={140}
                    thickness={28}
                    isLight={isLight}
                    centerValue=""
                    centerLabel=""
                  />
                  <div className="flex flex-col items-center mt-2">
                    <span
                      className={cn(
                        'text-[28px] font-mono font-bold',
                        isLight ? 'text-stone-700' : 'text-stone-300'
                      )}
                    >
                      {formatCompactCurrency(totalCategoryValue, currency)}
                    </span>
                    <span
                      className={cn(
                        'text-[12px] uppercase tracking-widest',
                        isLight ? 'text-stone-400' : 'text-stone-500'
                      )}
                    >
                      Total
                    </span>
                  </div>
                </div>

                {/* Category list */}
                <div
                  className="flex-1 min-w-0 max-h-[300px] overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 dark:[&::-webkit-scrollbar-thumb]:bg-stone-600"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: isLight ? '#a8a29e transparent' : '#57534e transparent',
                  }}
                >
                  {categoryData.map((cat, i) => {
                    const pct =
                      totalCategoryValue > 0 ? (cat.total_value / totalCategoryValue) * 100 : 0
                    return (
                      <div
                        key={cat.item_category_code}
                        className={cn(
                          'flex items-center gap-2 py-1.5 px-2 text-xs transition-colors',
                          i % 2 === 0 ? (isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]') : '',
                          isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]'
                        )}
                      >
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                        />
                        <span
                          className={cn('flex-1 truncate font-normal text-[14px]', styles.text)}
                          title={cat.item_category_code}
                        >
                          {cat.item_category_code}
                        </span>
                        <span
                          className={cn(
                            'font-mono tabular-nums text-[10px] font-medium',
                            isLight ? 'text-stone-700' : 'text-stone-300'
                          )}
                        >
                          {pct.toFixed(0)}%
                        </span>
                        <span
                          className={cn(
                            'font-mono tabular-nums font-semibold text-[14px]',
                            isLight ? 'text-stone-700' : 'text-stone-300'
                          )}
                        >
                          {formatCompactCurrency(cat.total_value, currency)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className={cn('text-sm py-4', styles.textMuted)}>No category data</p>
            )}
          </section>
        </div>
      </div>

      {/* ── INVENTORY ANALYSIS ── */}
      <div className="flex items-center gap-3 mb-8 mt-12">
        <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
          Inventory Analysis
        </h2>
        <div className="h-px flex-1 section-divider-line" />
      </div>

      {/* Top Items by Value + Movement Trend */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6 pb-8 overflow-visible')}>
        {/* Top Items by Value */}
        <section
          className={cn('pb-6 @3xl:pb-0 @3xl:pr-8 @3xl:border-r', styles.border, sectionHover)}
        >
          <div className="flex items-center gap-1.5 mb-5">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Top Items by Value
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {topItemsTooltipProps && <InfoTooltip {...topItemsTooltipProps} />}
          </div>
          <TopItemsHorizontalChart
            data={topItemsData || []}
            totalValue={topItemsTotalValue || 0}
            isLoading={topItemsLoading}
            currency={currency}
          />
        </section>

        {/* Movement Trend */}
        <section className={sectionHover}>
          <div className="flex items-center gap-1.5 mb-5">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Movement Trend
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {movementTooltipProps && <InfoTooltip {...movementTooltipProps} />}
          </div>
          {movementTrendLoading ? (
            <div>
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-7 animate-pulse',
                    i % 2 === 0 ? (isLight ? 'bg-slate-100/70' : 'bg-white/[0.02]') : ''
                  )}
                />
              ))}
            </div>
          ) : movementSummary ? (
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <DonutChart
                  data={[
                    { value: movementSummary.purchases, color: '#3b82f6', label: 'Purchases' },
                    { value: movementSummary.sales, color: '#22c55e', label: 'Sales' },
                    { value: movementSummary.adjustments, color: '#f59e0b', label: 'Adjustments' },
                  ].filter((d) => d.value > 0)}
                  size={130}
                  thickness={16}
                  isLight={isLight}
                  centerValue={formatCompactCurrency(
                    movementSummary.purchases + movementSummary.sales + movementSummary.adjustments,
                    currency
                  )}
                  centerLabel="Total"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'flex items-center justify-between py-2.5 px-2 -mx-2 text-xs',
                    isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 bg-blue-500" />
                    <span className={cn('font-medium', styles.text)}>Purchases (In)</span>
                  </div>
                  <span className="text-base font-mono font-bold tabular-nums tracking-tight text-blue-500">
                    {formatCompactCurrency(movementSummary.purchases, currency)}
                  </span>
                </div>
                <div
                  className={cn(
                    'flex items-center justify-between py-2.5 px-2 -mx-2 text-xs',
                    isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 bg-green-500" />
                    <span className={cn('font-medium', styles.text)}>Sales (Out)</span>
                  </div>
                  <span className="text-base font-mono font-bold tabular-nums tracking-tight text-green-500">
                    {formatCompactCurrency(movementSummary.sales, currency)}
                  </span>
                </div>
                <div
                  className={cn(
                    'flex items-center justify-between py-2.5 px-2 -mx-2 text-xs',
                    isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 bg-amber-500" />
                    <span className={cn('font-medium', styles.text)}>Adjustments</span>
                  </div>
                  <span className="text-base font-mono font-bold tabular-nums tracking-tight text-amber-500">
                    {formatCompactCurrency(movementSummary.adjustments, currency)}
                  </span>
                </div>
                <div
                  className={cn(
                    'flex items-center justify-between py-3 px-2 -mx-2 text-xs mt-3 border-t',
                    styles.border
                  )}
                >
                  <span
                    className={cn(
                      'text-[9px] uppercase tracking-widest font-semibold',
                      styles.textMuted
                    )}
                  >
                    Net Flow (12 mo)
                  </span>
                  <span
                    className={cn(
                      'text-xl font-mono font-bold tabular-nums tracking-tight',
                      movementSummary.purchases > movementSummary.sales
                        ? 'text-blue-500'
                        : movementSummary.sales > movementSummary.purchases
                          ? 'text-green-500'
                          : styles.text
                    )}
                  >
                    {movementSummary.purchases > movementSummary.sales ? '+' : ''}
                    {formatCompactCurrency(
                      movementSummary.purchases - movementSummary.sales,
                      currency
                    )}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className={cn('text-sm py-4', styles.textMuted)}>No movement data available</p>
          )}
        </section>
      </div>

      {/* Turnover & Valuation */}
      <div
        className={cn(
          'grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-10 pb-8 mt-4 border-t overflow-visible',
          styles.border
        )}
      >
        {/* Turnover & Valuation */}
        <section
          className={cn('pb-6 @3xl:pb-0 @3xl:pr-8 @3xl:border-r', styles.border, sectionHover)}
        >
          <div className="flex items-center gap-1.5 mb-5">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Turnover & Valuation
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {turnoverTooltipProps && <InfoTooltip {...turnoverTooltipProps} />}
          </div>
          {turnoverLoading || valuationLoading ? (
            <div className="flex gap-6">
              <div
                className={cn(
                  'w-[120px] h-[120px] rounded-full animate-pulse flex-shrink-0',
                  isLight ? 'bg-stone-100' : 'bg-white/[0.02]'
                )}
              />
              <div className="flex-1">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-7 animate-pulse',
                      i % 2 === 0 ? (isLight ? 'bg-slate-100/70' : 'bg-white/[0.02]') : ''
                    )}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex gap-6">
              {turnoverData && (
                <div className="flex-shrink-0">
                  <TurnoverGauge
                    ratio={turnoverData.turnover_ratio}
                    rating={turnoverRating}
                    isLight={isLight}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-3">
                {turnoverData && (
                  <>
                    <div
                      className={cn(
                        'flex items-center justify-between py-1.5 px-2 -mx-2 text-xs',
                        isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]'
                      )}
                    >
                      <span className={cn('font-medium', styles.text)}>Days in Inventory</span>
                      <span
                        className={cn(
                          'text-base font-mono font-bold tabular-nums tracking-tight',
                          styles.text
                        )}
                      >
                        {Math.round(turnoverData.days_inventory_outstanding)}d
                      </span>
                    </div>
                    <div
                      className={cn(
                        'flex items-center justify-between py-1.5 px-2 -mx-2 text-xs',
                        isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]'
                      )}
                    >
                      <span className={cn('font-medium', styles.text)}>Annual COGS</span>
                      <span
                        className={cn(
                          'text-base font-mono font-bold tabular-nums tracking-tight',
                          styles.text
                        )}
                      >
                        {formatCompactCurrency(turnoverData.cogs_annual, currency)}
                      </span>
                    </div>
                  </>
                )}
                {valuationSummary && (
                  <>
                    <div
                      className={cn(
                        'flex items-center justify-between py-1.5 px-2 -mx-2 text-xs',
                        isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]'
                      )}
                    >
                      <span className={cn('font-medium', styles.text)}>Unit Cost</span>
                      <span className={cn('font-mono font-semibold tabular-nums', styles.text)}>
                        {formatCompactCurrency(valuationSummary.total_value_at_unit_cost, currency)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'flex items-center justify-between py-1.5 px-2 -mx-2 text-xs',
                        isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]'
                      )}
                    >
                      <span className={cn('font-medium', styles.text)}>Std Cost</span>
                      <span className={cn('font-mono font-semibold tabular-nums', styles.text)}>
                        {formatCompactCurrency(
                          valuationSummary.total_value_at_standard_cost,
                          currency
                        )}
                      </span>
                    </div>
                    {valuationSummary.total_value_at_unit_cost !==
                      valuationSummary.total_value_at_standard_cost && (
                      <div
                        className={cn(
                          'flex items-center justify-between py-1.5 px-2 -mx-2 text-xs',
                          isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]'
                        )}
                      >
                        <span className={cn('font-medium', styles.text)}>Variance</span>
                        <span
                          className={cn(
                            'font-mono font-bold tabular-nums',
                            valuationSummary.total_value_at_unit_cost >
                              valuationSummary.total_value_at_standard_cost
                              ? isLight
                                ? 'text-red-600'
                                : 'text-red-400'
                              : isLight
                                ? 'text-green-600'
                                : 'text-green-400'
                          )}
                        >
                          {valuationSummary.total_value_at_unit_cost >
                          valuationSummary.total_value_at_standard_cost
                            ? '+'
                            : ''}
                          {formatCompactCurrency(
                            valuationSummary.total_value_at_unit_cost -
                              valuationSummary.total_value_at_standard_cost,
                            currency
                          )}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Valuation Comparison */}
        <section className={sectionHover}>
          <div className="flex items-center gap-1.5 mb-5">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Valuation Comparison
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {valuationTooltipProps && <InfoTooltip {...valuationTooltipProps} />}
          </div>
          <ValuationComparisonChart
            summary={valuationSummary}
            isLoading={valuationLoading}
            currency={currency}
          />
        </section>
      </div>

      {/* Slow Moving Inventory */}
      <div
        className={cn(
          'grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-10 pb-8 mt-4 border-t overflow-visible',
          styles.border
        )}
      >
        <section className={sectionHover}>
          <div className="flex items-center gap-1.5 mb-5">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Slow Moving Inventory
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {slowMovingTooltipProps && <InfoTooltip {...slowMovingTooltipProps} />}
          </div>
          <SlowMovingInventoryDonut
            data={slowMovingData || []}
            summary={slowMovingSummary}
            isLoading={slowMovingLoading}
            currency={currency}
          />
        </section>
      </div>
    </div>
  )
}
