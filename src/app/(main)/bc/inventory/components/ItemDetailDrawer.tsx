'use client'

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency, formatAxisCurrency } from '@/lib/utils/currency'
import {
  ReactECharts,
  useThemeEChartsConfig,
  canvasHighDpiOpts,
} from '@/app/(main)/components/charts/shared'
import { useBCItemDetail } from '../../hooks/useBCItemDetail'
import { InfoTooltip, type InfoTooltipProps } from './InfoTooltip'
import { useTheme } from '@/hooks/useTheme'
import { Download, Loader2, X } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { ItemDetailPDF } from './ItemDetailPDF'

interface ItemDetailDrawerProps {
  open: boolean
  onClose: () => void
  connectionId: string
  itemNumber: string | null
  dateRange?: { startDate: string; endDate: string }
  currency?: string
  /** Optional pre-computed fields from allItems list */
  abcClass?: 'A' | 'B' | 'C'
  healthScore?: number
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
    </div>
  )
}

function MetricBox({
  label,
  value,
  subValue,
  color,
  bgColor,
  tooltipProps,
}: {
  label: string
  value: string | number
  subValue?: string
  color: string
  bgColor: string
  tooltipProps?: Omit<InfoTooltipProps, 'className'>
}) {
  return (
    <div className={cn('p-3', bgColor)}>
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[12px] uppercase tracking-wider font-medium theme-text-secondary">
          {label}
        </span>
        {tooltipProps && <InfoTooltip {...tooltipProps} side="bottom" />}
      </div>
      <div className={cn('text-[20px] font-mono font-semibold tabular-nums leading-tight', color)}>
        {value}
      </div>
      {subValue && <div className="text-[12px] theme-text-secondary mt-0.5">{subValue}</div>}
    </div>
  )
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[12px] font-semibold',
        className
      )}
    >
      {children}
    </span>
  )
}

export function ItemDetailDrawer({
  open,
  onClose,
  connectionId,
  itemNumber,
  dateRange,
  currency = 'USD',
  abcClass,
  healthScore,
}: ItemDetailDrawerProps) {
  const {
    item,
    ledgerEntries,
    dimensions,
    movementByMonth,
    ledgerBasedValue,
    totalPurchased,
    totalSold,
    netMovement,
    firstTransaction,
    lastTransaction,
    isLoading,
    error,
  } = useBCItemDetail(open ? connectionId : null, open ? itemNumber : null, dateRange)

  const { theme } = useTheme()
  const isLight = theme === 'light'
  const { tooltipStyle, axisLabelStyle, splitLineStyle, isLightTheme } = useThemeEChartsConfig()

  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [open, itemNumber])
  const purchaseColor = '#3b82f6' // blue — matches net/total in dashboard
  const salesColor = '#10b981' // emerald — matches inflow in dashboard
  const positiveAdjustmentColor = '#f59e0b' // amber — matches profit in dashboard
  const negativeAdjustmentColor = '#ef4444' // red — matches outflow in dashboard
  const transferColor = '#8b5cf6' // purple — matches financing in dashboard

  const styles = useMemo(
    () => ({
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      rowBg: isLight ? 'bg-stone-50/50' : 'bg-white/[0.02]',
      rowHover: isLight ? 'hover:bg-stone-100/80' : 'hover:bg-white/[0.06]',
      headerBg: isLight ? 'bg-stone-100' : 'bg-[#1a1a1a]',
      cardBg: isLight ? 'bg-stone-200/40' : 'bg-white/[0.03]',
    }),
    [isLight]
  )

  const [isDownloading, setIsDownloading] = useState(false)

  // Ledger entries pagination
  const ENTRIES_PER_PAGE = 50
  const [ledgerPage, setLedgerPage] = useState(1)
  const totalLedgerPages = Math.ceil(ledgerEntries.length / ENTRIES_PER_PAGE)
  const paginatedLedgerEntries = ledgerEntries.slice(
    (ledgerPage - 1) * ENTRIES_PER_PAGE,
    ledgerPage * ENTRIES_PER_PAGE
  )

  const handleDownloadPDF = useCallback(async () => {
    if (!item) return
    setIsDownloading(true)
    try {
      const blob = await pdf(
        <ItemDetailPDF
          item={item}
          ledgerEntries={ledgerEntries}
          dimensions={dimensions}
          movementByMonth={movementByMonth}
          ledgerBasedValue={ledgerBasedValue}
          totalPurchased={totalPurchased}
          totalSold={totalSold}
          netMovement={netMovement}
          firstTransaction={firstTransaction}
          lastTransaction={lastTransaction}
          currency={currency}
          abcClass={abcClass}
          healthScore={healthScore}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${item.number}-detail.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF generation failed:', err)
    } finally {
      setIsDownloading(false)
    }
  }, [
    item,
    ledgerEntries,
    dimensions,
    movementByMonth,
    ledgerBasedValue,
    totalPurchased,
    totalSold,
    netMovement,
    firstTransaction,
    lastTransaction,
    currency,
    abcClass,
    healthScore,
  ])

  // Format movement chart option
  const chartOption = useMemo(() => {
    if (movementByMonth.length === 0) return null

    const months = movementByMonth.map((m) =>
      new Date(m.month + '-01').toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      })
    )

    const seriesConfig = [
      {
        name: 'Purchases',
        data: movementByMonth.map((m) => m.purchases_cost),
        color: purchaseColor,
      },
      { name: 'Sales', data: movementByMonth.map((m) => m.sales_cost), color: salesColor },
      {
        name: 'Adj (+)',
        data: movementByMonth.map((m) => m.positive_adjustments_cost),
        color: positiveAdjustmentColor,
      },
      {
        name: 'Adj (−)',
        data: movementByMonth.map((m) => m.negative_adjustments_cost),
        color: negativeAdjustmentColor,
      },
      {
        name: 'Transfers',
        data: movementByMonth.map((m) => m.transfers_cost),
        color: transferColor,
      },
    ]

    return {
      backgroundColor: 'transparent',
      tooltip: {
        ...tooltipStyle,
        trigger: 'axis' as const,
        confine: true,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return ''
          const textPrimary = isLightTheme ? '#1f2937' : '#f3f4f6'
          const textSecondary = isLightTheme ? '#6b7280' : '#9ca3af'
          let content = `<div style="font-weight:600;margin-bottom:8px;color:${textPrimary}">${params[0].axisValue}</div>`
          params.forEach((p: any) => {
            if (p.value === 0) return
            content += `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:2px 0">
                <span style="display:flex;align-items:center;gap:6px">
                  ${p.marker}
                  <span style="color:${textSecondary}">${p.seriesName}</span>
                </span>
                <span style="font-weight:600;font-family:monospace;color:${textPrimary}">
                  ${formatCompactCurrency(p.value, currency)}
                </span>
              </div>
            `
          })
          return content
        },
      },
      legend: {
        data: seriesConfig.map((s) => s.name),
        bottom: 20,
        left: 'center',
        itemWidth: 10,
        itemHeight: 10,
        icon: 'circle',
        textStyle: {
          color: isLightTheme ? '#374151' : '#94a3b8',
          fontSize: 12,
          fontWeight: 500,
        },
        itemGap: 12,
      },
      grid: {
        left: '3%',
        right: '3%',
        top: '12%',
        bottom: '25%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: months,
        axisLabel: {
          ...axisLabelStyle,
          fontSize: 12,
          fontWeight: 500,
          rotate: 45,
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          ...axisLabelStyle,
          fontSize: 12,
          fontWeight: 500,
          formatter: formatAxisCurrency(currency),
          margin: 12,
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          lineStyle: {
            color: splitLineStyle.color,
            type: 'dashed' as const,
          },
        },
        minInterval: 1,
        maxInterval: undefined,
        splitNumber: 4,
      },
      series: seriesConfig.map((s, i) => ({
        name: s.name,
        type: 'bar' as const,
        data: s.data,
        barGap: '20%',
        barCategoryGap: '40%',
        itemStyle: {
          color: s.color,
          borderRadius: 0,
        },
        barMaxWidth: 16,
      })),
    }
  }, [
    movementByMonth,
    purchaseColor,
    salesColor,
    positiveAdjustmentColor,
    negativeAdjustmentColor,
    transferColor,
    tooltipStyle,
    axisLabelStyle,
    splitLineStyle,
    isLightTheme,
    currency,
  ])

  // Use ledger-based valuation (SUM of costAmountActual) to match the dashboard cards.
  // Falls back to qty × unitCost when ledger data isn't available.
  const inventoryValue = item
    ? ledgerBasedValue != null
      ? ledgerBasedValue
      : item.inventory * item.unitCost
    : 0

  // Calculate average selling price from sale-type ledger entries
  const avgSellingPrice = useMemo(() => {
    const salesEntries = ledgerEntries.filter(
      (e) => e.entryType === 'Sale' && e.quantity !== 0 && e.salesAmountActual !== 0
    )
    if (salesEntries.length === 0) return null
    const totalSalesAmount = salesEntries.reduce((sum, e) => sum + Math.abs(e.salesAmountActual), 0)
    const totalSalesQty = salesEntries.reduce((sum, e) => sum + Math.abs(e.quantity), 0)
    return totalSalesQty > 0 ? totalSalesAmount / totalSalesQty : null
  }, [ledgerEntries])

  const fmt = (v: number, c: string) => formatCompactCurrency(v, c)

  // ── Structured tooltip builders ──

  const onHandTooltipProps = useMemo((): Omit<InfoTooltipProps, 'className'> | undefined => {
    if (!item) return undefined
    return {
      description:
        'Current on-hand quantity from the BC item card. This is the live inventory balance and does not change with the selected date range.',
      calculationTooltip: {
        formula: 'On Hand = items.inventory (current snapshot)',
        components: [
          { label: 'On Hand Qty', value: item.inventory.toLocaleString(), highlight: true },
          { label: 'UOM', value: item.baseUnitOfMeasureCode || 'units' },
        ],
      },
      note: `Source: BC API → items?$filter=number eq '${item.number}'. This is the current inventory field, not a point-in-time calculation.`,
    }
  }, [item])

  const unitCostTooltipProps = useMemo((): Omit<InfoTooltipProps, 'className'> | undefined => {
    if (!item) return undefined
    return {
      description:
        'Standard cost per unit from the BC item card. This is the cost basis used for inventory valuation.',
      calculationTooltip: {
        formula: 'Unit Cost = items.unitCost (from item card)',
        components: [
          { label: 'Unit Cost', value: fmt(item.unitCost, currency), highlight: true },
          { label: 'Unit Price (sell)', value: fmt(item.unitPrice ?? 0, currency) },
        ],
      },
      note: `Source: BC API → items?$filter=number eq '${item.number}'. unitCost field from the item card.`,
    }
  }, [item, currency])

  const totalValueTooltipProps = useMemo((): Omit<InfoTooltipProps, 'className'> | undefined => {
    if (!item) return undefined
    const usesLedger = ledgerBasedValue != null
    return {
      description: usesLedger
        ? "Total inventory value from summing costAmountActual across all item ledger entries. This matches BC's Inventory Valuation report (Report 1001)."
        : 'Total inventory value for this item, calculated by multiplying the on-hand quantity by the unit cost.',
      calculationTooltip: {
        formula: usesLedger
          ? 'Total Value = Σ costAmountActual (all ledger entries)'
          : 'Total Value = On Hand × Unit Cost',
        components: [
          { label: 'On Hand', value: item.inventory.toLocaleString() },
          { label: 'Unit Cost (card)', value: fmt(item.unitCost, currency) },
          { label: 'Total Value', value: fmt(inventoryValue, currency), highlight: true },
        ],
      },
      note: usesLedger
        ? `Source: Σ costAmountActual from itemLedgerEntries for item '${item.number}'. Reflects actual costs across all purchases, sales, and adjustments.`
        : `Source: Computed as items.inventory × items.unitCost. This is cost-basis valuation, not market value.`,
    }
  }, [item, inventoryValue, ledgerBasedValue, currency])

  const avgSalePriceTooltipProps = useMemo((): Omit<InfoTooltipProps, 'className'> | undefined => {
    if (!item) return undefined
    const salesEntries = ledgerEntries.filter(
      (e) => e.entryType === 'Sale' && e.quantity !== 0 && e.salesAmountActual !== 0
    )
    const totalSalesAmount = salesEntries.reduce((sum, e) => sum + Math.abs(e.salesAmountActual), 0)
    const totalSalesQty = salesEntries.reduce((sum, e) => sum + Math.abs(e.quantity), 0)
    return {
      description:
        'Average selling price calculated from actual sale transactions in the selected period. Shows the revenue per unit sold.',
      calculationTooltip: {
        formula: 'Avg Sale Price =\nΣ |salesAmountActual| ÷ Σ |quantity|\n(for Sale entries only)',
        components: [
          { label: 'Sale Entries', value: salesEntries.length },
          { label: 'Total Sales Amount', value: fmt(totalSalesAmount, currency) },
          { label: 'Total Qty Sold', value: totalSalesQty.toLocaleString() },
          {
            label: 'Avg Sale Price',
            value: avgSellingPrice !== null ? fmt(avgSellingPrice, currency) : '—',
            highlight: true,
          },
        ],
      },
      note: `Source: BC API → itemLedgerEntries WHERE entryType = 'Sale' AND itemNumber = '${item.number}'. Only entries with non-zero salesAmountActual.`,
    }
  }, [item, ledgerEntries, avgSellingPrice, currency])

  const abcTooltipProps = useMemo((): Omit<InfoTooltipProps, 'className'> | undefined => {
    if (!item || !abcClass) return undefined
    return {
      description:
        'ABC classification from Pareto analysis of all inventory values. Items are sorted by value descending with cumulative cutoffs.',
      calculationTooltip: {
        formula: 'Cumulative value ≤ 80% → A, ≤ 95% → B, else → C',
        components: [
          { label: 'This Item Value', value: fmt(inventoryValue, currency) },
          {
            label: 'Classification',
            value: `${abcClass}-Class (${abcClass === 'A' ? 'top 80%' : abcClass === 'B' ? 'next 15%' : 'bottom 5%'} of total value)`,
            highlight: true,
          },
        ],
      },
      note: `Source: Computed from all items with inventory > 0, ranked by (inventory × unitCost) DESC, cumulative sum compared against total.`,
    }
  }, [item, abcClass, inventoryValue, currency])

  const healthTooltipProps = useMemo((): Omit<InfoTooltipProps, 'className'> | undefined => {
    if (!item || !healthScore || healthScore <= 0) return undefined
    return {
      description:
        'Composite health score (0–100) measuring how well this item is performing across four dimensions.',
      calculationTooltip: {
        formula:
          'Health = Turnover (0–30)\n+ Recency (0–30)\n+ Availability (0–20)\n+ Value Tier (0–20)',
        components: [
          { label: 'Turnover', value: '≥6× → 30, ≥3× → 20, ≥1× → 10, else → 0' },
          { label: 'Recency', value: '≤30d → 30, ≤90d → 20, ≤180d → 10, else → 0' },
          { label: 'Availability', value: 'In stock → 20, out → 0' },
          { label: 'Value Tier', value: 'A → 20, B → 10, C → 5' },
          {
            label: 'Total Score',
            value: `${healthScore}/100 (${healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : healthScore >= 40 ? 'Fair' : 'Poor'})`,
            highlight: true,
          },
        ],
      },
      note: `Source: Computed from items + itemLedgerEntries. Turnover = sales qty ÷ inventory for the selected period.`,
    }
  }, [item, healthScore])

  const itemDetailsTooltipProps = useMemo((): Omit<InfoTooltipProps, 'className'> | undefined => {
    if (!item) return undefined
    return {
      description:
        'Metadata fields from the BC item card. Shows type, unit of measure, posting groups, and identifiers.',
      calculationTooltip: {
        formula: 'Direct read from BC items API',
        components: [
          { label: 'Type', value: item.type || '—' },
          { label: 'Base UOM', value: item.baseUnitOfMeasureCode || '—' },
          { label: 'Gen. Posting Group', value: item.generalProductPostingGroupCode || '—' },
          { label: 'Inv. Posting Group', value: item.inventoryPostingGroupCode || '—' },
        ],
      },
      note: `Source: BC API → items?$filter=number eq '${item.number}'. Fields: type, baseUnitOfMeasureCode, gtin, generalProductPostingGroupCode, inventoryPostingGroupCode.`,
    }
  }, [item])

  const periodMovementTooltipProps = useMemo(():
    | Omit<InfoTooltipProps, 'className'>
    | undefined => {
    if (!item) return undefined
    return {
      description:
        'Aggregated purchase and sale quantities from Item Ledger Entries within the selected date range. Net = sum of all entry quantities.',
      calculationTooltip: {
        formula:
          'Purchased = Σ |qty| WHERE entryType = Purchase\nSold = Σ |qty| WHERE entryType = Sale\nNet = Σ all qty',
        components: [
          { label: 'Purchased (In)', value: `${totalPurchased.toLocaleString()} units` },
          { label: 'Sold (Out)', value: `${totalSold.toLocaleString()} units` },
          {
            label: 'Net Movement',
            value: `${netMovement >= 0 ? '+' : ''}${netMovement.toLocaleString()} units`,
            highlight: true,
          },
          { label: 'Ledger Entries', value: ledgerEntries.length },
        ],
      },
      note: `Source: BC API → itemLedgerEntries?$filter=itemNumber eq '${item.number}'. Date range: ${dateRange?.startDate || 'period start'} to ${dateRange?.endDate || 'period end'}.`,
    }
  }, [item, totalPurchased, totalSold, netMovement, ledgerEntries.length, dateRange])

  const monthlyMovementTooltipProps = useMemo(():
    | Omit<InfoTooltipProps, 'className'>
    | undefined => {
    if (!item || movementByMonth.length === 0) return undefined
    const totalPurchCost = movementByMonth.reduce((s, m) => s + m.purchases_cost, 0)
    const totalSalesCost = movementByMonth.reduce((s, m) => s + m.sales_cost, 0)
    const totalAdjCost = movementByMonth.reduce(
      (s, m) => s + m.positive_adjustments_cost + m.negative_adjustments_cost,
      0
    )
    const totalTransferCost = movementByMonth.reduce((s, m) => s + m.transfers_cost, 0)
    return {
      description:
        'Monthly cost breakdown of inventory movements by type. Each bar shows the absolute costAmountActual for that entry type.',
      calculationTooltip: {
        formula: 'Monthly totals =\nΣ |costAmountActual|\nGROUP BY month, entryType',
        components: [
          { label: 'Purchases', value: fmt(totalPurchCost, currency) },
          { label: 'Sales', value: fmt(totalSalesCost, currency) },
          { label: 'Adjustments', value: fmt(totalAdjCost, currency) },
          { label: 'Transfers', value: fmt(totalTransferCost, currency) },
          { label: 'Months Shown', value: movementByMonth.length, highlight: true },
        ],
      },
      note: `Source: BC API → itemLedgerEntries for '${item.number}', grouped by month from postingDate. Entry types: Purchase, Sale, Positive/Negative Adjmt., Transfer.`,
    }
  }, [item, movementByMonth, currency])

  const ledgerEntriesTooltipProps = useMemo((): Omit<InfoTooltipProps, 'className'> | undefined => {
    if (!item || ledgerEntries.length === 0) return undefined
    const entryTypes = [...new Set(ledgerEntries.map((e) => e.entryType))].join(', ')
    const totalCostAbs = ledgerEntries.reduce((s, e) => s + Math.abs(e.costAmountActual), 0)
    return {
      description:
        'Individual Item Ledger Entry rows for this item. Each row is a single inventory transaction: purchase, sale, adjustment, or transfer.',
      calculationTooltip: {
        formula: 'Raw rows from itemLedgerEntries\nORDER BY postingDate DESC',
        components: [
          { label: 'Total Entries', value: ledgerEntries.length },
          { label: 'Entry Types', value: entryTypes },
          { label: 'Total Cost (absolute)', value: fmt(totalCostAbs, currency), highlight: true },
        ],
      },
      note: `Source: BC API → itemLedgerEntries?$filter=itemNumber eq '${item.number}'. Qty is signed (+purchase, −sale). Cost from costAmountActual, sales from salesAmountActual.`,
    }
  }, [item, ledgerEntries, currency])

  const dimensionsTooltipProps = useMemo((): Omit<InfoTooltipProps, 'className'> | undefined => {
    if (!item || dimensions.length === 0) return undefined
    return {
      description:
        'Default Dimensions assigned to this item. Dimensions are analysis tags (e.g., Department, Project, Region) used for reporting and cost allocation.',
      calculationTooltip: {
        formula: 'Direct read from BC defaultDimensions API',
        components: [
          { label: 'Dimensions Assigned', value: dimensions.length, highlight: true },
          ...dimensions.map((d) => ({
            label: d.dimensionCode,
            value: d.dimensionValueCode,
          })),
        ],
      },
      note: `Source: BC API → defaultDimensions?$filter=parentId eq '${item.number}'. Each dimension maps a code to a value for reporting.`,
    }
  }, [item, dimensions])

  if (!open) return null

  return (
    <div
      ref={cardRef}
      className={cn(
        'my-3 rounded-xl border overflow-hidden scroll-mt-4',
        isLight
          ? 'border-stone-200 bg-white shadow-lg shadow-stone-200/50'
          : 'border-white/[0.08] bg-[#0f0f15] shadow-lg shadow-black/30'
      )}
      style={{ background: 'var(--theme-bg)' }}
    >
      {isLoading ? (
        <div className="p-6">
          <h3 className="theme-text-primary text-base font-semibold">Loading item...</h3>
          <p className="theme-text-secondary text-sm mt-1">
            Fetching details from Business Central
          </p>
          <LoadingSpinner />
        </div>
      ) : error || !item ? (
        <div className="p-6">
          <h3 className="theme-text-primary text-base font-semibold">Item Detail</h3>
          <p className="text-theme-red text-sm mt-1">
            {error instanceof Error ? error.message : 'Failed to load item details'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <div className={cn('p-6 pb-4 border-b', styles.border)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className={cn('text-base font-semibold', styles.text)}>
                  {item.displayName || item.number}
                </h3>
                <p className={cn('mt-1 text-[12px] font-mono', styles.textMuted)}>
                  {item.number}
                  {item.itemCategoryCode && ` — ${item.itemCategoryCode}`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.inventory > 0 ? (
                  <Badge className="bg-green-500/15 text-green-400">In stock</Badge>
                ) : (
                  <Badge className="bg-red-500/15 text-red-400">Out of stock</Badge>
                )}
                {item.blocked && <Badge className="bg-gray-500/15 text-gray-400">Blocked</Badge>}
                <button
                  onClick={handleDownloadPDF}
                  disabled={isDownloading}
                  className={cn(
                    'p-1.5 rounded-full opacity-80 transition-all duration-200 hover:opacity-100 hover:bg-slate-500/10 hover:scale-110 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                  title="Download PDF"
                >
                  {isDownloading ? (
                    <Loader2 className={cn('h-4 w-4 animate-spin', styles.textMuted)} />
                  ) : (
                    <Download className={cn('h-4 w-4', styles.textMuted)} />
                  )}
                </button>
                <button
                  onClick={onClose}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors shrink-0',
                    isLight
                      ? 'hover:bg-stone-100 text-stone-400'
                      : 'hover:bg-white/[0.06] text-stone-500'
                  )}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="px-6">
            <div className="grid grid-cols-3 gap-3">
              <MetricBox
                label="On Hand"
                value={item.inventory.toLocaleString()}
                subValue={item.baseUnitOfMeasureCode || 'units'}
                color={isLight ? 'text-blue-600' : 'text-blue-400'}
                bgColor={styles.cardBg}
                tooltipProps={onHandTooltipProps}
              />
              <MetricBox
                label="Unit Cost"
                value={formatCompactCurrency(item.unitCost, currency)}
                subValue="Standard cost"
                color="text-orange-500"
                bgColor={styles.cardBg}
                tooltipProps={unitCostTooltipProps}
              />
              <MetricBox
                label="Total Value"
                value={formatCompactCurrency(inventoryValue, currency)}
                subValue={ledgerBasedValue != null ? 'Ledger cost basis' : 'Qty x Unit Cost'}
                color={isLight ? 'text-green-600' : 'text-green-400'}
                bgColor={styles.cardBg}
                tooltipProps={totalValueTooltipProps}
              />
              <MetricBox
                label="Avg Sale Price"
                value={
                  avgSellingPrice !== null ? formatCompactCurrency(avgSellingPrice, currency) : '—'
                }
                subValue={avgSellingPrice !== null ? 'From transactions' : 'No sales data'}
                color={isLight ? 'text-purple-600' : 'text-purple-400'}
                bgColor={styles.cardBg}
                tooltipProps={avgSalePriceTooltipProps}
              />
              {abcClass && (
                <MetricBox
                  label="ABC Class"
                  value={abcClass}
                  subValue={
                    abcClass === 'A'
                      ? 'Top 80% value'
                      : abcClass === 'B'
                        ? 'Next 15% value'
                        : 'Bottom 5% value'
                  }
                  color={
                    abcClass === 'A'
                      ? 'text-amber-500'
                      : abcClass === 'B'
                        ? isLight
                          ? 'text-blue-600'
                          : 'text-blue-400'
                        : styles.textMuted
                  }
                  bgColor={styles.cardBg}
                  tooltipProps={abcTooltipProps}
                />
              )}
              {healthScore !== undefined && healthScore > 0 && (
                <MetricBox
                  label="Health"
                  value={`${healthScore}/100`}
                  subValue={
                    healthScore >= 80
                      ? 'Excellent'
                      : healthScore >= 60
                        ? 'Good'
                        : healthScore >= 40
                          ? 'Fair'
                          : 'Poor'
                  }
                  color={
                    healthScore >= 80
                      ? isLight
                        ? 'text-green-600'
                        : 'text-green-400'
                      : healthScore >= 60
                        ? isLight
                          ? 'text-blue-600'
                          : 'text-blue-400'
                        : healthScore >= 40
                          ? 'text-yellow-500'
                          : isLight
                            ? 'text-red-600'
                            : 'text-red-400'
                  }
                  bgColor={styles.cardBg}
                  tooltipProps={healthTooltipProps}
                />
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="px-6">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn('text-[14px] uppercase tracking-wider font-medium', styles.textMuted)}
              >
                Item Details
              </span>
              {itemDetailsTooltipProps && <InfoTooltip {...itemDetailsTooltipProps} />}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0 text-xs">
              {[
                { label: 'Type', value: item.type || '—' },
                { label: 'Base UOM', value: item.baseUnitOfMeasureCode || '—' },
                { label: 'GTIN', value: item.gtin || '—' },
                {
                  label: 'Gen. Posting Group',
                  value: item.generalProductPostingGroupCode || '—',
                },
                {
                  label: 'Inventory Posting Group',
                  value: item.inventoryPostingGroupCode || '—',
                },
                {
                  label: 'Last Modified',
                  value: item.lastModifiedDateTime
                    ? new Date(item.lastModifiedDateTime).toLocaleDateString()
                    : '—',
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className={cn('flex justify-between py-1.5 border-b', styles.border)}
                >
                  <span className={cn('text-[12px]', styles.textMuted)}>{row.label}</span>
                  <span className={cn('text-[12px] font-mono tabular-nums', styles.text)}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Movement Summary */}
          <div className="px-6">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn('text-[14px] uppercase tracking-wider font-medium', styles.textMuted)}
              >
                Period Movement
              </span>
              {periodMovementTooltipProps && <InfoTooltip {...periodMovementTooltipProps} />}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className={cn('p-3 text-center', styles.cardBg)}>
                <div className={cn('text-[12px] uppercase tracking-wider mb-1', styles.textMuted)}>
                  Purchased
                </div>
                <div
                  className={cn(
                    'text-[20px] font-mono font-semibold tabular-nums leading-tight',
                    isLight ? 'text-blue-600' : 'text-blue-400'
                  )}
                >
                  {totalPurchased.toLocaleString()}
                </div>
              </div>
              <div className={cn('p-3 text-center', styles.cardBg)}>
                <div className={cn('text-[12px] uppercase tracking-wider mb-1', styles.textMuted)}>
                  Sold
                </div>
                <div
                  className={cn(
                    'text-[20px] font-mono font-semibold tabular-nums leading-tight',
                    isLight ? 'text-green-600' : 'text-green-400'
                  )}
                >
                  {totalSold.toLocaleString()}
                </div>
              </div>
              <div className={cn('p-3 text-center', styles.cardBg)}>
                <div className={cn('text-[12px] uppercase tracking-wider mb-1', styles.textMuted)}>
                  Net
                </div>
                <div
                  className={cn(
                    'text-[20px] font-mono font-semibold tabular-nums leading-tight',
                    netMovement >= 0
                      ? isLight
                        ? 'text-green-600'
                        : 'text-green-400'
                      : isLight
                        ? 'text-red-600'
                        : 'text-red-400'
                  )}
                >
                  {netMovement >= 0 ? '+' : ''}
                  {netMovement.toLocaleString()}
                </div>
              </div>
            </div>
            {firstTransaction && lastTransaction && (
              <div className={cn('mt-1.5 text-[12px] text-center', styles.textMuted)}>
                {firstTransaction} — {lastTransaction}
              </div>
            )}
          </div>

          {/* Movement Chart */}
          {chartOption && (
            <div className="px-6">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={cn(
                    'text-[14px] uppercase tracking-wider font-medium',
                    styles.textMuted
                  )}
                >
                  Monthly Movement
                </span>
                {monthlyMovementTooltipProps && <InfoTooltip {...monthlyMovementTooltipProps} />}
              </div>
              <div className={cn('border', styles.border)}>
                <ReactECharts
                  option={chartOption}
                  style={{ height: '240px', width: '100%' }}
                  opts={canvasHighDpiOpts}
                  notMerge={true}
                  lazyUpdate={true}
                />
              </div>
            </div>
          )}

          {/* Ledger Entries Table */}
          {ledgerEntries.length > 0 && (
            <div className="px-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-[14px] uppercase tracking-wider font-medium',
                      styles.textMuted
                    )}
                  >
                    Ledger Entries
                  </span>
                  {ledgerEntriesTooltipProps && <InfoTooltip {...ledgerEntriesTooltipProps} />}
                </div>
                <span className={cn('text-[12px] font-mono tabular-nums', styles.textMuted)}>
                  {ledgerEntries.length} entries
                </span>
              </div>
              <div
                className={cn(
                  'max-h-[300px] overflow-y-auto overflow-x-hidden border-x border-t',
                  styles.border
                )}
              >
                <table className="w-full text-[12px]">
                  <thead className={cn('sticky top-0 z-10', styles.headerBg, '[&_th]:bg-inherit')}>
                    <tr className={cn('border-b', styles.border)}>
                      <th className={cn('text-left p-3 font-medium', styles.textMuted)}>Date</th>
                      <th className={cn('text-left p-3 font-medium', styles.textMuted)}>Type</th>
                      <th className={cn('text-left p-3 font-medium', styles.textMuted)}>Doc #</th>
                      <th className={cn('text-right p-3 font-medium', styles.textMuted)}>Qty</th>
                      <th className={cn('text-right p-3 font-medium', styles.textMuted)}>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLedgerEntries.map((entry, i) => (
                      <tr
                        key={`${entry.entryNumber}-${i}`}
                        className={cn(
                          'border-b',
                          styles.border,
                          styles.rowHover,
                          i % 2 === 0 ? styles.rowBg : ''
                        )}
                      >
                        <td className={cn('p-3 font-mono tabular-nums', styles.textMuted)}>
                          {entry.postingDate
                            ? new Date(entry.postingDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="p-3">
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded text-[12px] font-semibold',
                              entry.entryType === 'Sale'
                                ? 'bg-green-500/15 text-green-400'
                                : entry.entryType === 'Purchase'
                                  ? 'bg-blue-500/15 text-blue-400'
                                  : 'bg-gray-500/15 text-gray-400'
                            )}
                          >
                            {entry.entryType}
                          </span>
                        </td>
                        <td
                          className={cn('p-3 font-mono truncate max-w-[100px]', styles.textMuted)}
                        >
                          {entry.documentNumber || '—'}
                        </td>
                        <td
                          className={cn(
                            'p-3 text-right font-mono tabular-nums',
                            entry.quantity < 0
                              ? isLight
                                ? 'text-red-600'
                                : 'text-red-400'
                              : styles.text
                          )}
                        >
                          {entry.quantity.toLocaleString()}
                        </td>
                        <td
                          className={cn(
                            'p-3 text-right font-mono font-semibold tabular-nums',
                            styles.text
                          )}
                        >
                          {formatCompactCurrency(Math.abs(entry.costAmountActual), currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalLedgerPages > 1 && (
                  <div
                    className={cn(
                      'flex items-center justify-between px-3 py-2 border-t',
                      styles.border,
                      styles.headerBg
                    )}
                  >
                    <span className={cn('text-[12px] font-mono tabular-nums', styles.textMuted)}>
                      {(ledgerPage - 1) * ENTRIES_PER_PAGE + 1}–
                      {Math.min(ledgerPage * ENTRIES_PER_PAGE, ledgerEntries.length)} of{' '}
                      {ledgerEntries.length}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                        disabled={ledgerPage === 1}
                        className={cn(
                          'px-2 py-0.5 text-[12px] border',
                          styles.border,
                          styles.textMuted,
                          'hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed'
                        )}
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setLedgerPage((p) => Math.min(totalLedgerPages, p + 1))}
                        disabled={ledgerPage === totalLedgerPages}
                        className={cn(
                          'px-2 py-0.5 text-[12px] border',
                          styles.border,
                          styles.textMuted,
                          'hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed'
                        )}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dimensions */}
          {dimensions.length > 0 && (
            <div className="px-6 pb-6">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={cn(
                    'text-[14px] uppercase tracking-wider font-medium',
                    styles.textMuted
                  )}
                >
                  Dimensions
                </span>
                {dimensionsTooltipProps && <InfoTooltip {...dimensionsTooltipProps} />}
              </div>
              <div className="space-y-0">
                {dimensions.map((dim, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center justify-between p-3 border-b',
                      styles.border,
                      i % 2 === 0 ? styles.rowBg : ''
                    )}
                  >
                    <span className={cn('text-[12px]', styles.textMuted)}>{dim.dimensionCode}</span>
                    <span className={cn('text-[12px] font-mono tabular-nums', styles.text)}>
                      {dim.dimensionValueCode}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom padding */}
          <div className="h-6" />
        </div>
      )}
    </div>
  )
}
