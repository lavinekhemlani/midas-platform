'use client'

import { useState, useMemo, useCallback } from 'react'
import { useBCInventoryEnhanced } from '../../../hooks/useBCInventoryEnhanced'
import {
  ABCClassificationCard,
  StockHealthCard,
  InventoryTurnoverCard,
  SlowMovingInventoryCard,
  OutOfStockCard,
  ItemDetailDrawer,
  InfoTooltip,
} from '../../components'
import { StockAnalysisPDF } from '../../components/StockAnalysisPDF'
import { getDateRangeForPeriod } from '@/lib/utils/dateRanges'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import {
  Activity,
  Calendar,
  ChevronDown,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Download,
  Loader2,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { pdf } from '@react-pdf/renderer'
import { PERIOD_OPTION_GROUPS, PERIOD_OPTIONS } from '@/lib/utils/dateRanges'
import { PeriodPicker } from '../../../components/PeriodPicker'

const fmt = (v: number, c: string) => formatCompactCurrency(v, c)

export function BCOAuthStockAnalysisView({ connectionId }: { connectionId: string }) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [selectedPeriod, setSelectedPeriod] = useState('this_year')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedItemNumber, setSelectedItemNumber] = useState<string | null>(null)

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

  const {
    abcClassification,
    stockHealth,
    turnover,
    slowMoving,
    allItems,
    totalInventoryValue,
    currency,
    isLoading,
    mutate,
  } = useBCInventoryEnhanced(connectionId, dateRange)

  const c = currency || 'USD'

  const turnoverRating = useMemo((): 'excellent' | 'good' | 'fair' | 'poor' | null => {
    if (!turnover) return null
    const ratio = turnover.turnover_ratio
    if (ratio >= 8) return 'excellent'
    if (ratio >= 5) return 'good'
    if (ratio >= 2) return 'fair'
    return 'poor'
  }, [turnover])

  // Turnover by category
  const turnoverByCategory = useMemo(() => {
    const catMap: Record<string, { salesCost: number; invValue: number }> = {}
    for (const item of allItems) {
      const cat = item.item_category_code || 'Uncategorized'
      if (!catMap[cat]) catMap[cat] = { salesCost: 0, invValue: 0 }
      catMap[cat].invValue += item.inventory_value
      catMap[cat].salesCost += item.sales_qty * item.unit_cost
    }
    const periodDays =
      dateRange.startDate && dateRange.endDate
        ? (new Date(dateRange.endDate).getTime() - new Date(dateRange.startDate).getTime()) /
          (1000 * 60 * 60 * 24)
        : 365
    const annFactor = periodDays > 0 ? 365 / periodDays : 1

    return Object.entries(catMap)
      .map(([cat, data]) => {
        const ratio = data.invValue > 0 ? (data.salesCost * annFactor) / data.invValue : 0
        const dio = ratio > 0 ? 365 / ratio : 0
        return {
          category: cat,
          invValue: data.invValue,
          turnoverRatio: Math.round(ratio * 100) / 100,
          dio: Math.round(dio),
        }
      })
      .sort((a, b) => b.invValue - a.invValue)
  }, [allItems, dateRange])

  // ABC pie chart data
  const abcPieData = useMemo(
    () => [
      { name: 'A — High Value', value: abcClassification.A.totalValue, color: '#f59e0b' },
      { name: 'B — Medium', value: abcClassification.B.totalValue, color: '#3b82f6' },
      { name: 'C — Low', value: abcClassification.C.totalValue, color: '#6b7280' },
    ],
    [abcClassification]
  )

  // Full slow-moving list (uncapped)
  const fullSlowMovingItems = useMemo(() => {
    return allItems
      .filter(
        (i) => i.inventory > 0 && (i.days_since_last_sale === null || i.days_since_last_sale > 60)
      )
      .sort((a, b) => {
        if (a.days_since_last_sale === null && b.days_since_last_sale === null)
          return b.inventory_value - a.inventory_value
        if (a.days_since_last_sale === null) return -1
        if (b.days_since_last_sale === null) return 1
        return b.days_since_last_sale - a.days_since_last_sale
      })
      .map((i) => ({
        item_no: i.item_no,
        description: i.description,
        inventory: i.inventory,
        unit_cost: i.unit_cost,
        inventory_value: i.inventory_value,
        sales_qty: i.sales_qty,
        purchases_qty: i.purchases_qty,
        turnover_ratio: i.turnover_ratio,
        days_since_last_sale: i.days_since_last_sale,
      }))
  }, [allItems])

  const capitalAtRisk = useMemo(
    () => fullSlowMovingItems.reduce((s, i) => s + i.inventory_value, 0),
    [fullSlowMovingItems]
  )

  const selectedItemData = useMemo(() => {
    if (!selectedItemNumber) return null
    return allItems.find((i) => i.item_no === selectedItemNumber) ?? null
  }, [selectedItemNumber, allItems])

  // ── Structured tooltip builders ──

  const abcTooltipProps = useMemo(() => {
    const total =
      abcClassification.A.totalValue +
      abcClassification.B.totalValue +
      abcClassification.C.totalValue
    const totalCount =
      abcClassification.A.count + abcClassification.B.count + abcClassification.C.count
    return {
      description:
        'Ranks items by inventory value using the Pareto principle — a small number of items typically account for the majority of value.',
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
      note: 'Source: BC Items + Item Ledger Entries. Value from costAmountActual (fallback: qty × unitCost), cumulative cutoffs at 80%/95%/100%.',
    }
  }, [abcClassification, c])

  const turnoverTooltipProps = useMemo(() => {
    if (!turnover) return undefined
    return {
      description:
        'Measures how efficiently inventory is being sold and replaced. Higher turnover means less capital tied up in stock.',
      calculationTooltip: {
        formula: 'Turnover = Annualized COGS ÷ Current Inventory Value',
        components: [
          { label: 'Annualized COGS', value: fmt(turnover.cogs_annual, c) },
          { label: 'Current Inventory', value: fmt(turnover.current_inventory, c) },
          {
            label: 'Turnover Ratio',
            value: `${turnover.turnover_ratio.toFixed(1)}×`,
            highlight: true,
          },
          {
            label: 'Days in Inventory',
            value: `${Math.round(turnover.days_inventory_outstanding)} days`,
          },
        ],
      },
      note: 'Source: Sale-type Item Ledger Entries, annualized. DIO = 365 ÷ Turnover. Target: 5–12× for most industries.',
    }
  }, [turnover, c])

  const zeroSalesCount = fullSlowMovingItems.filter((i) => i.days_since_last_sale === null).length
  const zeroSalesValue = fullSlowMovingItems
    .filter((i) => i.days_since_last_sale === null)
    .reduce((s, i) => s + i.inventory_value, 0)

  const slowMovingTooltipProps = useMemo(() => {
    const pctOfTotal =
      totalInventoryValue > 0 ? ((capitalAtRisk / totalInventoryValue) * 100).toFixed(1) : '0'
    return {
      description:
        'Full list of items with stock but no sales or >60 days since last sale. Capital at risk that may need markdown, bundling, or discontinuation.',
      calculationTooltip: {
        formula: 'Slow = in stock & (no sales OR >60 days since last sale)',
        components: [
          { label: 'Slow-Moving Items', value: fullSlowMovingItems.length },
          { label: 'Never-Sold Items', value: `${zeroSalesCount} — ${fmt(zeroSalesValue, c)}` },
          { label: 'Capital at Risk', value: fmt(capitalAtRisk, c), highlight: true },
          { label: '% of Total Inventory', value: `${pctOfTotal}%` },
        ],
      },
      note: 'Source: BC Items + Item Ledger Entries. Risk: No Sales > Critical (>180d) > High (>90d) > Medium (>60d). Click items for full detail.',
    }
  }, [fullSlowMovingItems, capitalAtRisk, zeroSalesCount, zeroSalesValue, totalInventoryValue, c])

  const capitalAtRiskPct =
    totalInventoryValue > 0 ? ((capitalAtRisk / totalInventoryValue) * 100).toFixed(1) : '0'

  // PDF Download state and handler
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false)

  const outOfStockItems = useMemo(() => {
    return allItems
      .filter((i) => i.inventory === 0 && !i.blocked)
      .sort((a, b) => {
        if (a.days_since_last_sale === null && b.days_since_last_sale === null)
          return b.unit_cost - a.unit_cost
        if (a.days_since_last_sale === null) return 1
        if (b.days_since_last_sale === null) return -1
        return a.days_since_last_sale - b.days_since_last_sale
      })
  }, [allItems])

  const handleDownloadPDF = useCallback(async () => {
    setIsDownloadingPDF(true)
    try {
      const blob = await pdf(
        <StockAnalysisPDF
          abcClassification={abcClassification}
          stockHealth={stockHealth}
          turnover={turnover}
          turnoverByCategory={turnoverByCategory}
          slowMovingItems={fullSlowMovingItems}
          outOfStockItems={outOfStockItems}
          totalInventoryValue={totalInventoryValue}
          itemsAnalyzed={allItems.filter((i) => i.inventory > 0).length}
          capitalAtRisk={capitalAtRisk}
          currency={c}
          dateRange={dateRange}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `stock-analysis-${dateRange.startDate}-${dateRange.endDate}.pdf`
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
    abcClassification,
    stockHealth,
    turnover,
    turnoverByCategory,
    fullSlowMovingItems,
    outOfStockItems,
    totalInventoryValue,
    allItems,
    capitalAtRisk,
    c,
    dateRange,
  ])

  const sectionHover = cn(
    'group relative -mx-3 px-3 -mt-4 pt-4 -mb-6 pb-6 rounded-[4px]',
    'transition-all duration-300 ease-out',
    'hover:scale-[1.02] origin-center',
    isLight
      ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
      : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
  )

  return (
    <div className="@container space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="group flex items-center gap-3">
          <div>
            <h1 className={cn('text-[36px] font-light tracking-tight', styles.text)}>
              Stock Analysis
            </h1>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-amber-500/80">
              Business Central · Health & Risk Assessment
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
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloadingPDF || isLoading}
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
            <div className={cn('text-[12px] uppercase tracking-wider mb-1', styles.text)}>
              Items Analyzed
            </div>
            <div className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}>
              {allItems.filter((i) => i.inventory > 0).length.toLocaleString()}
            </div>
          </div>
          <div>
            <div className={cn('text-[12px] uppercase tracking-wider mb-1', styles.text)}>
              Total Value
            </div>
            <div className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}>
              {formatCompactCurrency(totalInventoryValue, currency)}
            </div>
          </div>
          <div>
            <div
              className={cn(
                'text-[12px] uppercase tracking-wider mb-1',
                stockHealth && stockHealth.averageScore >= 60
                  ? 'text-green-400'
                  : stockHealth && stockHealth.averageScore >= 40
                    ? 'text-amber-500'
                    : 'text-red-400'
              )}
            >
              Avg Health
            </div>
            <div
              className={cn(
                'text-[28px] font-mono font-semibold tabular-nums',
                stockHealth && stockHealth.averageScore >= 60
                  ? 'text-green-400'
                  : stockHealth && stockHealth.averageScore >= 40
                    ? 'text-amber-500'
                    : 'text-red-400'
              )}
            >
              {stockHealth ? stockHealth.averageScore : '—'}
            </div>
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-wider mb-1 text-red-400">
              Capital at Risk
            </div>
            <div className="text-[28px] font-mono font-semibold tabular-nums text-red-400">
              {formatCompactCurrency(capitalAtRisk, currency)}
            </div>
          </div>
          <div>
            <div className={cn('text-[12px] uppercase tracking-wider mb-1', styles.text)}>
              Slow-Moving
            </div>
            <div className={cn('text-[28px] font-mono font-semibold tabular-nums', styles.text)}>
              {fullSlowMovingItems.length}
            </div>
          </div>
        </div>
        <InfoTooltip
          description="Deep analysis of your inventory health across multiple dimensions. Combines stock health scoring, Pareto (ABC) classification, turnover analysis, and slow-moving risk assessment."
          calculationTooltip={{
            formula:
              'Health Score = Turnover (30) + Recency (30) + Availability (20) + Value Tier (20)',
            components: [
              {
                label: 'Items Analyzed',
                value: allItems.filter((i) => i.inventory > 0).length,
              },
              { label: 'Total Value', value: fmt(totalInventoryValue, c) },
              {
                label: 'Avg Health Score',
                value: stockHealth ? `${stockHealth.averageScore}/100` : 'N/A',
                highlight: true,
              },
            ],
          }}
          note="Source: BC Items + Item Ledger Entries. Scores combine turnover velocity, sales recency, stock availability, and ABC value tier."
        />
      </div>

      {/* Stock Health + ABC Classification */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-20 pt-6')}>
        {/* Stock Health */}
        <section
          className={cn(
            '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
            isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
            sectionHover
          )}
        >
          <StockHealthCard data={stockHealth} isLoading={isLoading} />
        </section>

        {/* ABC Classification */}
        <section className={sectionHover}>
          <ABCClassificationCard
            data={abcClassification}
            isLoading={isLoading}
            currency={currency}
            tooltipProps={abcTooltipProps}
          />
        </section>
      </div>

      {/* ABC Pie + Turnover by Category */}
      <div
        className={cn(
          'grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-20 pt-6 border-t',
          styles.border
        )}
      >
        {/* ABC Value Distribution Pie */}
        <section
          className={cn(
            '@3xl:pr-8 relative @3xl:after:absolute @3xl:after:right-0 @3xl:after:top-4 @3xl:after:bottom-4 @3xl:after:w-px',
            isLight ? '@3xl:after:bg-stone-200' : '@3xl:after:bg-white/[0.08]',
            sectionHover
          )}
        >
          <div className="flex items-center gap-2 mb-5">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              ABC Value Distribution
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            <InfoTooltip
              description="Visual breakdown of how total inventory value is distributed across ABC classes."
              calculationTooltip={{
                formula: 'Slice size = Class Total Value ÷ Grand Total Value',
                components: [
                  {
                    label: 'A-Class Value',
                    value: `${fmt(abcClassification.A.totalValue, c)} (${abcClassification.A.percentage.toFixed(1)}%)`,
                  },
                  {
                    label: 'B-Class Value',
                    value: `${fmt(abcClassification.B.totalValue, c)} (${abcClassification.B.percentage.toFixed(1)}%)`,
                  },
                  {
                    label: 'C-Class Value',
                    value: `${fmt(abcClassification.C.totalValue, c)} (${abcClassification.C.percentage.toFixed(1)}%)`,
                  },
                ],
              }}
              note="A-class items typically represent ~80% of value but only ~20% of SKU count."
            />
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-[200px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stacked bar */}
              <div className="flex h-3 w-full overflow-hidden">
                {abcPieData.map((d) => {
                  const total = abcPieData.reduce((s, i) => s + i.value, 0)
                  const pct = total > 0 ? (d.value / total) * 100 : 0
                  return (
                    <div
                      key={d.name}
                      className="h-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: d.color }}
                    />
                  )
                })}
              </div>

              {/* Legend rows */}
              <div className="space-y-2">
                {abcPieData.map((d) => {
                  const total = abcPieData.reduce((s, i) => s + i.value, 0)
                  const pct = total > 0 ? (d.value / total) * 100 : 0
                  return (
                    <div key={d.name} className="flex items-center justify-between text-[14px]">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5" style={{ backgroundColor: d.color }} />
                        <span className={isLight ? 'text-stone-700' : 'text-stone-300'}>
                          {d.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'text-[12px] font-medium font-mono tabular-nums',
                            styles.textMuted
                          )}
                        >
                          {pct.toFixed(1)}%
                        </span>
                        <span
                          className={cn(
                            'text-[16px] font-mono font-semibold tabular-nums',
                            styles.text
                          )}
                        >
                          {formatCompactCurrency(d.value, currency)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        {/* Turnover by Category Table */}
        <section className={sectionHover}>
          <div className="flex items-center gap-2 mb-5">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Turnover by Category
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            <InfoTooltip
              description="Inventory turnover ratio and Days Inventory Outstanding (DIO) broken down by item category. Identifies which product lines move fastest."
              calculationTooltip={{
                formula:
                  'Category Turnover = Annualized (Sales Qty × Unit Cost) ÷ Category Inventory Value',
                components:
                  turnoverByCategory.length > 0
                    ? [
                        { label: 'Categories', value: turnoverByCategory.length },
                        {
                          label: 'Best Turnover',
                          value: `${turnoverByCategory.reduce((best, r) => (r.turnoverRatio > best.turnoverRatio ? r : best), turnoverByCategory[0]).category} — ${turnoverByCategory.reduce((best, r) => (r.turnoverRatio > best.turnoverRatio ? r : best), turnoverByCategory[0]).turnoverRatio.toFixed(1)}×`,
                        },
                        {
                          label: 'Worst Turnover',
                          value: `${turnoverByCategory.reduce((worst, r) => (r.turnoverRatio < worst.turnoverRatio ? r : worst), turnoverByCategory[0]).category} — ${turnoverByCategory.reduce((worst, r) => (r.turnoverRatio < worst.turnoverRatio ? r : worst), turnoverByCategory[0]).turnoverRatio.toFixed(1)}×`,
                        },
                      ]
                    : [],
              }}
              note="DIO = 365 ÷ Turnover. Lower DIO is better. Categories sorted by inventory value."
            />
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-[200px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
            </div>
          ) : turnoverByCategory.length > 0 ? (
            <div className={cn('border-x border-t overflow-hidden', styles.border)}>
              <div className="max-h-[250px] overflow-y-auto overflow-x-hidden">
                <table className="w-full text-[14px]">
                  <thead className={cn('sticky top-0 z-10', styles.headerBg, '[&_th]:bg-inherit')}>
                    <tr className={cn('border-b', styles.border)}>
                      <th className={cn('text-left p-3 font-medium', styles.textMuted)}>
                        Category
                      </th>
                      <th className={cn('text-right p-3 font-medium', styles.textMuted)}>Value</th>
                      <th className={cn('text-right p-3 font-medium', styles.textMuted)}>
                        Turnover
                      </th>
                      <th className={cn('text-right p-3 font-medium', styles.textMuted)}>DIO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turnoverByCategory.map((row, idx) => (
                      <tr
                        key={row.category}
                        className={cn(
                          'border-b',
                          styles.border,
                          styles.rowHover,
                          idx % 2 === 0 && styles.rowBg
                        )}
                      >
                        <td className={cn('p-3 truncate max-w-[120px] font-medium', styles.text)}>
                          {row.category}
                        </td>
                        <td
                          className={cn('p-3 text-right font-mono tabular-nums', styles.textMuted)}
                        >
                          {formatCompactCurrency(row.invValue, currency)}
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={cn(
                              'font-mono font-semibold tabular-nums',
                              row.turnoverRatio >= 8
                                ? 'text-green-400'
                                : row.turnoverRatio >= 5
                                  ? 'text-blue-400'
                                  : row.turnoverRatio >= 2
                                    ? 'text-yellow-400'
                                    : 'text-red-400'
                            )}
                          >
                            {row.turnoverRatio.toFixed(1)}×
                          </span>
                        </td>
                        <td
                          className={cn('p-3 text-right font-mono tabular-nums', styles.textMuted)}
                        >
                          {row.dio > 0 ? `${row.dio}d` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className={cn('text-sm text-center py-8', styles.textMuted)}>No category data</p>
          )}
        </section>
      </div>

      {/* Turnover + Slow Moving */}
      <div
        className={cn(
          'grid grid-cols-1 @3xl:grid-cols-2 gap-x-12 gap-y-20 pt-6 border-t',
          styles.border
        )}
      >
        {/* Turnover */}
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

        {/* Slow Moving */}
        <section className={sectionHover}>
          <SlowMovingInventoryCard
            data={fullSlowMovingItems}
            summary={{
              totalItems: fullSlowMovingItems.length,
              totalValue: capitalAtRisk,
              zeroSalesCount,
              zeroSalesValue,
            }}
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

      {/* Capital at Risk Summary Banner */}
      {!isLoading && fullSlowMovingItems.length > 0 && (
        <div
          className={cn(
            'group flex items-center justify-between p-4 border mt-8',
            styles.border,
            'bg-red-500/5'
          )}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className={cn('text-[14px] font-medium', styles.text)}>Capital at Risk</span>
            <InfoTooltip
              description="Total inventory value tied up in slow-moving items that could potentially be freed through markdowns, bundling, returns to vendor, or discontinuation."
              calculationTooltip={{
                formula: 'Capital at Risk = Σ inventory value of slow-moving items',
                components: [
                  { label: 'Slow-Moving Items', value: fullSlowMovingItems.length },
                  { label: 'Capital at Risk', value: fmt(capitalAtRisk, c), highlight: true },
                  { label: 'Total Inventory Value', value: fmt(totalInventoryValue, c) },
                  { label: 'Exposure %', value: `${capitalAtRiskPct}%` },
                ],
              }}
              note="Compare against total inventory value to assess exposure. Items never sold carry highest risk."
            />
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className={cn('text-[12px] uppercase tracking-wider', styles.textMuted)}>
                At Risk
              </div>
              <div className="text-[20px] font-mono font-semibold tabular-nums text-red-400">
                {formatCompactCurrency(capitalAtRisk, currency)}
              </div>
            </div>
            <div className="text-right">
              <div className={cn('text-[12px] uppercase tracking-wider', styles.textMuted)}>
                % of Total
              </div>
              <div className={cn('text-[20px] font-mono font-semibold tabular-nums', styles.text)}>
                {capitalAtRiskPct}%
              </div>
            </div>
            <div className="text-right">
              <div className={cn('text-[12px] uppercase tracking-wider', styles.textMuted)}>
                Items
              </div>
              <div className={cn('text-[20px] font-mono font-semibold tabular-nums', styles.text)}>
                {fullSlowMovingItems.length}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Out of Stock */}
      <div className={cn('pt-6 border-t', styles.border)}>
        <section className={sectionHover}>
          <OutOfStockCard
            allItems={allItems}
            isLoading={isLoading}
            currency={currency}
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
    </div>
  )
}
