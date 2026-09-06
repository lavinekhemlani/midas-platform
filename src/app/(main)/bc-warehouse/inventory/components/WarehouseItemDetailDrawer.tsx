'use client'

import { useMemo, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { formatCompactCurrency, formatAxisCurrency } from '@/lib/utils/currency'
import { EChartsBar } from '@/components/charts/echarts'
import { useWarehouseItemDetail } from '../hooks/useWarehouseItemDetail'
import { InfoTooltip, type InfoTooltipProps } from '@/components/ui/InfoTooltip'
import { useTheme } from '@/hooks/useTheme'

interface WarehouseItemDetailDrawerProps {
  open: boolean
  onClose: () => void
  schema: string | null
  itemNo: string | null
  dateRange?: { startDate: string | null; endDate: string | null }
  currency?: string
  abcClass?: 'A' | 'B' | 'C'
  healthScore?: number
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
    <div className={cn('rounded-lg p-2.5 border', bgColor)}>
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-[10px] uppercase tracking-wider font-medium theme-text-secondary">
          {label}
        </span>
        {tooltipProps && <InfoTooltip {...tooltipProps} side="bottom" />}
      </div>
      <div className={cn('text-lg font-bold', color)}>{value}</div>
      {subValue && <div className="text-[10px] theme-text-secondary mt-0.5">{subValue}</div>}
    </div>
  )
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold',
        className
      )}
    >
      {children}
    </span>
  )
}

export function WarehouseItemDetailDrawer({
  open,
  onClose,
  schema,
  itemNo,
  dateRange,
  currency = 'USD',
  abcClass,
  healthScore,
}: WarehouseItemDetailDrawerProps) {
  const {
    item,
    ledgerEntries,
    movementByMonth,
    totalPurchased,
    totalSold,
    netMovement,
    firstTransaction,
    lastTransaction,
    isLoading,
    error,
  } = useWarehouseItemDetail(open ? schema : null, open ? itemNo : null, dateRange)

  const { theme } = useTheme()
  const purchaseColor = theme === 'light' ? '#0D54A8' : '#3b82f6'
  const salesColor = theme === 'light' ? '#178E66' : '#10b981'
  const positiveAdjustmentColor = theme === 'light' ? '#16a34a' : '#4ade80'
  const negativeAdjustmentColor = theme === 'light' ? '#dc2626' : '#f87171'
  const transferColor = theme === 'light' ? '#7c3aed' : '#a78bfa'

  // Ledger entries pagination
  const ENTRIES_PER_PAGE = 50
  const [ledgerPage, setLedgerPage] = useState(1)
  const totalLedgerPages = Math.ceil(ledgerEntries.length / ENTRIES_PER_PAGE)
  const paginatedLedgerEntries = ledgerEntries.slice(
    (ledgerPage - 1) * ENTRIES_PER_PAGE,
    ledgerPage * ENTRIES_PER_PAGE
  )

  const chartData = useMemo(() => {
    return movementByMonth.map((m) => {
      // Redshift DATE_TRUNC returns various formats: "2024-01-01T00:00:00.000Z", "2024-01-01", etc.
      const dateStr = String(m.month).substring(0, 10) // extract YYYY-MM-DD
      const [year, month] = dateStr.split('-')
      const d = new Date(Number(year), Number(month) - 1, 1)
      return {
        month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        purchases: m.purchases_cost,
        sales: m.sales_cost,
        positiveAdjustments: m.positive_adjustments_cost,
        negativeAdjustments: m.negative_adjustments_cost,
        transfers: m.transfers_cost,
      }
    })
  }, [movementByMonth])

  const inventoryValue = item ? item.inventory * item.unit_cost : 0

  // Calculate average selling price from sale-type ledger entries
  const avgSellingPrice = useMemo(() => {
    const salesEntries = ledgerEntries.filter(
      (e) => e.entry_type === 'Sale' && e.cost_amount_actual !== 0
    )
    if (salesEntries.length === 0) return null
    const totalCost = salesEntries.reduce((sum, e) => sum + Math.abs(e.cost_amount_actual), 0)
    const totalQty = salesEntries.reduce((sum, e) => sum + Math.abs(e.quantity), 0)
    return totalQty > 0 ? totalCost / totalQty : null
  }, [ledgerEntries])

  const fmt = (v: number, c: string) => formatCompactCurrency(v, c)

  // ── Structured tooltip builders ──

  const onHandTooltipProps = useMemo((): Omit<InfoTooltipProps, 'className'> | undefined => {
    if (!item) return undefined
    return {
      description:
        'Current on-hand quantity from the item card. This is the live balance and does not change with the selected date range.',
      calculationTooltip: {
        formula: 'On Hand = item.inventory (current snapshot)',
        components: [
          { label: 'On Hand Qty', value: item.inventory.toLocaleString(), highlight: true },
        ],
      },
      note: `Source: ${schema}.item WHERE no = '${item.item_no}'. This is the current inventory field, not a point-in-time calculation.`,
    }
  }, [item, schema])

  const unitCostTooltipProps = useMemo((): Omit<InfoTooltipProps, 'className'> | undefined => {
    if (!item) return undefined
    return {
      description:
        'The unit cost from the item card. Represents the cost basis used for inventory valuation. Compare with Standard Cost and Last Direct Cost below.',
      calculationTooltip: {
        formula: 'Unit Cost = item.unit_cost (from item card)',
        components: [
          { label: 'Unit Cost', value: fmt(item.unit_cost, currency), highlight: true },
          { label: 'Standard Cost', value: fmt(item.standard_cost, currency) },
          { label: 'Last Direct Cost', value: fmt(item.last_direct_cost, currency) },
          { label: 'Costing Method', value: item.costing_method || 'N/A' },
        ],
      },
      note: `Source: ${schema}.item. Unit cost may differ from standard/last direct cost depending on the costing method (${item.costing_method || 'not set'}).`,
    }
  }, [item, currency, schema])

  const totalValueTooltipProps = useMemo((): Omit<InfoTooltipProps, 'className'> | undefined => {
    if (!item) return undefined
    return {
      description:
        'Total inventory value for this item, calculated by multiplying the on-hand quantity by the unit cost.',
      calculationTooltip: {
        formula: 'Total Value = On Hand × Unit Cost',
        components: [
          { label: 'On Hand', value: item.inventory.toLocaleString() },
          { label: 'Unit Cost', value: fmt(item.unit_cost, currency) },
          { label: 'Total Value', value: fmt(inventoryValue, currency), highlight: true },
        ],
      },
      note: `Source: ${schema}.item. Computed as inventory × unit_cost. This is cost-basis valuation, not market value.`,
    }
  }, [item, inventoryValue, currency, schema])

  const avgCostTooltipProps = useMemo((): Omit<InfoTooltipProps, 'className'> | undefined => {
    if (!item) return undefined
    const salesEntries = ledgerEntries.filter(
      (e) => e.entry_type === 'Sale' && e.cost_amount_actual !== 0
    )
    const totalCost = salesEntries.reduce((sum, e) => sum + Math.abs(e.cost_amount_actual), 0)
    const totalQty = salesEntries.reduce((sum, e) => sum + Math.abs(e.quantity), 0)
    return {
      description:
        'Average cost per unit from sale-type ledger entries in the selected period. Shows the actual cost flowing through COGS per unit sold.',
      calculationTooltip: {
        formula: 'Avg Cost/Sale =\nΣ |cost_amount_actual| ÷ Σ |quantity|\n(for Sale entries only)',
        components: [
          { label: 'Sale Entries', value: salesEntries.length },
          { label: 'Total Sale Cost', value: fmt(totalCost, currency) },
          { label: 'Total Qty Sold', value: totalQty.toLocaleString() },
          {
            label: 'Avg Cost/Sale',
            value: avgSellingPrice !== null ? fmt(avgSellingPrice, currency) : '—',
            highlight: true,
          },
        ],
      },
      note: `Source: ${schema}.item_ledger_entry WHERE entry_type = 'Sale' AND item_no = '${item.item_no}'. Only entries with non-zero cost_amount_actual are included.`,
    }
  }, [item, ledgerEntries, avgSellingPrice, currency, schema])

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
      note: `Source: ${schema}.item. All items with inventory > 0 ranked by inventory_value DESC, cumulative sum compared against total.`,
    }
  }, [item, abcClass, inventoryValue, currency, schema])

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
      note: `Source: Computed in SQL from ${schema}.item + item_ledger_entry. Turnover = sales_qty ÷ inventory for the selected period.`,
    }
  }, [item, healthScore, schema])

  const itemDetailsTooltipProps = useMemo((): Omit<InfoTooltipProps, 'className'> | undefined => {
    if (!item) return undefined
    return {
      description:
        'Metadata fields from the item card in the warehouse. Shows category, costing method, and cost comparisons.',
      calculationTooltip: {
        formula: 'Direct read from item table fields',
        components: [
          { label: 'Category', value: item.item_category_code || '—' },
          { label: 'Costing Method', value: item.costing_method || '—' },
          { label: 'Unit Cost', value: fmt(item.unit_cost, currency) },
          { label: 'Standard Cost', value: fmt(item.standard_cost, currency) },
          { label: 'Last Direct Cost', value: fmt(item.last_direct_cost, currency) },
        ],
      },
      note: `Source: ${schema}.item WHERE no = '${item.item_no}'. Fields: item_category_code, costing_method, unit_cost, standard_cost, last_direct_cost.`,
    }
  }, [item, currency, schema])

  const periodMovementTooltipProps = useMemo(():
    | Omit<InfoTooltipProps, 'className'>
    | undefined => {
    if (!item) return undefined
    return {
      description:
        'Aggregated purchase and sale quantities from Item Ledger Entries within the selected date range. Net = total purchased − total sold.',
      calculationTooltip: {
        formula:
          'Purchased = Σ qty WHERE entry_type = Purchase\nSold = Σ |qty| WHERE entry_type = Sale\nNet = Σ all qty',
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
      note: `Source: ${schema}.item_ledger_entry WHERE item_no = '${item.item_no}'. Date range: ${dateRange?.startDate || 'last 12mo'} to ${dateRange?.endDate || 'now'}.`,
    }
  }, [item, totalPurchased, totalSold, netMovement, ledgerEntries.length, schema, dateRange])

  const monthlyMovementTooltipProps = useMemo(():
    | Omit<InfoTooltipProps, 'className'>
    | undefined => {
    if (!item || chartData.length === 0) return undefined
    const totalPurchCost = movementByMonth.reduce((s, m) => s + m.purchases_cost, 0)
    const totalSalesCost = movementByMonth.reduce((s, m) => s + m.sales_cost, 0)
    const totalAdjCost = movementByMonth.reduce(
      (s, m) => s + m.positive_adjustments_cost + m.negative_adjustments_cost,
      0
    )
    const totalTransferCost = movementByMonth.reduce((s, m) => s + m.transfers_cost, 0)
    return {
      description:
        'Monthly cost breakdown of inventory movements by type. Each bar segment shows the absolute cost_amount_actual for that entry type.',
      calculationTooltip: {
        formula: 'Monthly totals =\nΣ |cost_amount_actual|\nGROUP BY month, entry_type',
        components: [
          { label: 'Purchases', value: fmt(totalPurchCost, currency) },
          { label: 'Sales', value: fmt(totalSalesCost, currency) },
          { label: 'Adjustments', value: fmt(totalAdjCost, currency) },
          { label: 'Transfers', value: fmt(totalTransferCost, currency) },
          { label: 'Months Shown', value: chartData.length, highlight: true },
        ],
      },
      note: `Source: ${schema}.item_ledger_entry WHERE item_no = '${item.item_no}', grouped by DATE_TRUNC('month', posting_date). Entry types: Purchase, Sale, *Adjmt*, Transfer.`,
    }
  }, [item, chartData, movementByMonth, currency, schema])

  const ledgerEntriesTooltipProps = useMemo((): Omit<InfoTooltipProps, 'className'> | undefined => {
    if (!item || ledgerEntries.length === 0) return undefined
    const entryTypes = [...new Set(ledgerEntries.map((e) => e.entry_type))].join(', ')
    const totalCostAbs = ledgerEntries.reduce((s, e) => s + Math.abs(e.cost_amount_actual), 0)
    return {
      description:
        'Individual Item Ledger Entry rows for this item. Each row represents a single inventory transaction: purchase, sale, adjustment, or transfer.',
      calculationTooltip: {
        formula: 'Raw rows from item_ledger_entry\nORDER BY posting_date DESC',
        components: [
          { label: 'Total Entries', value: ledgerEntries.length },
          { label: 'Entry Types', value: entryTypes },
          { label: 'Total Cost (absolute)', value: fmt(totalCostAbs, currency), highlight: true },
        ],
      },
      note: `Source: ${schema}.item_ledger_entry WHERE item_no = '${item.item_no}'. Limited to 200 entries. Date range: ${dateRange?.startDate || 'last 12mo'} to ${dateRange?.endDate || 'now'}.`,
    }
  }, [item, ledgerEntries, currency, schema, dateRange])

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[600px] overflow-y-auto p-0"
        style={{ background: 'var(--theme-bg)' }}
      >
        {isLoading ? (
          <div className="p-6">
            <SheetHeader>
              <SheetTitle className="theme-text-primary">Loading item...</SheetTitle>
              <SheetDescription className="theme-text-secondary">
                Fetching details from warehouse
              </SheetDescription>
            </SheetHeader>
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
            </div>
          </div>
        ) : (error || !item) && open ? (
          <div className="p-6">
            <SheetHeader>
              <SheetTitle className="theme-text-primary">Item Detail</SheetTitle>
              <SheetDescription className="text-theme-red">
                {error instanceof Error ? error.message : 'Failed to load item details'}
              </SheetDescription>
            </SheetHeader>
          </div>
        ) : !item ? (
          <div className="p-6">
            <SheetHeader>
              <SheetTitle className="theme-text-primary">Item Detail</SheetTitle>
              <SheetDescription className="theme-text-secondary" />
            </SheetHeader>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header */}
            <div className="p-6 pb-0">
              <SheetHeader>
                <div className="flex items-start justify-between gap-3 pr-8">
                  <div>
                    <SheetTitle className="theme-text-primary text-lg">
                      {item.description || item.item_no}
                    </SheetTitle>
                    <SheetDescription className="theme-text-secondary mt-1">
                      {item.item_no}
                      {item.item_category_code && ` — ${item.item_category_code}`}
                    </SheetDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.inventory > 0 ? (
                      <Badge className="bg-green-500/15 text-green-400">In Stock</Badge>
                    ) : (
                      <Badge className="bg-red-500/15 text-red-400">Out of Stock</Badge>
                    )}
                  </div>
                </div>
              </SheetHeader>
            </div>

            {/* Metrics Row */}
            <div className="px-6">
              <div className="grid grid-cols-3 gap-2">
                <MetricBox
                  label="On Hand"
                  value={item.inventory.toLocaleString()}
                  subValue="units"
                  color="text-theme-blue"
                  bgColor="bg-blue-500/5 border-blue-500/10"
                  tooltipProps={onHandTooltipProps}
                />
                <MetricBox
                  label="Unit Cost"
                  value={formatCompactCurrency(item.unit_cost, currency)}
                  subValue="Standard cost"
                  color="text-orange-400"
                  bgColor="bg-orange-500/5 border-orange-500/10"
                  tooltipProps={unitCostTooltipProps}
                />
                <MetricBox
                  label="Total Value"
                  value={formatCompactCurrency(inventoryValue, currency)}
                  subValue="Qty x Unit Cost"
                  color="text-theme-green"
                  bgColor="bg-green-500/5 border-green-500/10"
                  tooltipProps={totalValueTooltipProps}
                />
                <MetricBox
                  label="Avg Cost/Sale"
                  value={
                    avgSellingPrice !== null
                      ? formatCompactCurrency(avgSellingPrice, currency)
                      : '—'
                  }
                  subValue={avgSellingPrice !== null ? 'From transactions' : 'No sales data'}
                  color="text-purple-400"
                  bgColor="bg-purple-500/5 border-purple-500/10"
                  tooltipProps={avgCostTooltipProps}
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
                        ? 'text-amber-400'
                        : abcClass === 'B'
                          ? 'text-blue-400'
                          : 'text-gray-400'
                    }
                    bgColor={
                      abcClass === 'A'
                        ? 'bg-amber-500/5 border-amber-500/10'
                        : abcClass === 'B'
                          ? 'bg-blue-500/5 border-blue-500/10'
                          : 'bg-gray-500/5 border-gray-500/10'
                    }
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
                        ? 'text-theme-green'
                        : healthScore >= 60
                          ? 'text-theme-blue'
                          : healthScore >= 40
                            ? 'text-yellow-400'
                            : 'text-theme-red'
                    }
                    bgColor={
                      healthScore >= 80
                        ? 'bg-green-500/5 border-green-500/10'
                        : healthScore >= 60
                          ? 'bg-blue-500/5 border-blue-500/10'
                          : healthScore >= 40
                            ? 'bg-yellow-500/5 border-yellow-500/10'
                            : 'bg-red-500/5 border-red-500/10'
                    }
                    tooltipProps={healthTooltipProps}
                  />
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="px-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold theme-text-primary">Item Details</span>
                {itemDetailsTooltipProps && <InfoTooltip {...itemDetailsTooltipProps} />}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {[
                  { label: 'Category', value: item.item_category_code || '—' },
                  { label: 'Costing Method', value: item.costing_method || '—' },
                  {
                    label: 'Standard Cost',
                    value: item.standard_cost
                      ? formatCompactCurrency(item.standard_cost, currency)
                      : '—',
                  },
                  {
                    label: 'Last Direct Cost',
                    value: item.last_direct_cost
                      ? formatCompactCurrency(item.last_direct_cost, currency)
                      : '—',
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between py-1 border-b border-gray-200/5"
                  >
                    <span className="theme-text-secondary">{row.label}</span>
                    <span className="theme-text-primary font-mono">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Movement Summary */}
            <div className="px-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold theme-text-primary">Period Movement</span>
                {periodMovementTooltipProps && <InfoTooltip {...periodMovementTooltipProps} />}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg p-2 bg-blue-500/5 border border-blue-500/10 text-center">
                  <div className="text-[10px] uppercase tracking-wider theme-text-secondary">
                    Purchased
                  </div>
                  <div className="text-sm font-bold text-theme-blue">
                    {totalPurchased.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg p-2 bg-green-500/5 border border-green-500/10 text-center">
                  <div className="text-[10px] uppercase tracking-wider theme-text-secondary">
                    Sold
                  </div>
                  <div className="text-sm font-bold text-theme-green">
                    {totalSold.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg p-2 bg-purple-500/5 border border-purple-500/10 text-center">
                  <div className="text-[10px] uppercase tracking-wider theme-text-secondary">
                    Net
                  </div>
                  <div
                    className={cn(
                      'text-sm font-bold',
                      netMovement >= 0 ? 'text-theme-green' : 'text-theme-red'
                    )}
                  >
                    {netMovement >= 0 ? '+' : ''}
                    {netMovement.toLocaleString()}
                  </div>
                </div>
              </div>
              {firstTransaction && lastTransaction && (
                <div className="mt-1.5 text-[10px] theme-text-secondary text-center">
                  {new Date(firstTransaction).toLocaleDateString()} —{' '}
                  {new Date(lastTransaction).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Movement Chart */}
            {chartData.length > 0 && (
              <div className="px-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold theme-text-primary">Monthly Movement</span>
                  {monthlyMovementTooltipProps && <InfoTooltip {...monthlyMovementTooltipProps} />}
                </div>
                <div className="h-[180px]">
                  <EChartsBar
                    data={chartData}
                    xKey="month"
                    series={[
                      { key: 'purchases', name: 'Purchases', color: purchaseColor },
                      { key: 'sales', name: 'Sales', color: salesColor },
                      {
                        key: 'positiveAdjustments',
                        name: 'Adjustments (+)',
                        color: positiveAdjustmentColor,
                      },
                      {
                        key: 'negativeAdjustments',
                        name: 'Adjustments (−)',
                        color: negativeAdjustmentColor,
                      },
                      { key: 'transfers', name: 'Transfers', color: transferColor },
                    ]}
                    formatY={formatAxisCurrency(currency)}
                    showLegend={true}
                    height={180}
                  />
                </div>
              </div>
            )}

            {/* Ledger Entries Table */}
            {ledgerEntries.length > 0 && (
              <div className="px-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold theme-text-primary">Ledger Entries</span>
                    {ledgerEntriesTooltipProps && <InfoTooltip {...ledgerEntriesTooltipProps} />}
                  </div>
                  <span className="text-[10px] theme-text-secondary">
                    {ledgerEntries.length} entries
                  </span>
                </div>
                <div className="max-h-[300px] overflow-y-auto rounded-lg border border-gray-200/10">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr
                        className={cn(
                          'border-b border-gray-200/10',
                          theme === 'light' ? 'bg-stone-100' : 'bg-[#1a1a1a]'
                        )}
                      >
                        <th className="text-left p-2 theme-text-secondary font-medium">Date</th>
                        <th className="text-left p-2 theme-text-secondary font-medium">Type</th>
                        <th className="text-left p-2 theme-text-secondary font-medium">Doc #</th>
                        <th className="text-right p-2 theme-text-secondary font-medium">Qty</th>
                        <th className="text-right p-2 theme-text-secondary font-medium">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLedgerEntries.map((entry, i) => (
                        <tr
                          key={`${entry.entry_no}-${i}`}
                          className="border-b border-gray-200/5 hover:bg-gray-500/5"
                        >
                          <td className="p-2 theme-text-secondary font-mono">
                            {entry.posting_date
                              ? new Date(entry.posting_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : '—'}
                          </td>
                          <td className="p-2">
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[10px] font-medium',
                                entry.entry_type === 'Sale'
                                  ? 'bg-green-500/10 text-green-400'
                                  : entry.entry_type === 'Purchase'
                                    ? 'bg-blue-500/10 text-blue-400'
                                    : 'bg-gray-500/10 text-gray-400'
                              )}
                            >
                              {entry.entry_type}
                            </span>
                          </td>
                          <td className="p-2 theme-text-secondary font-mono truncate max-w-[100px]">
                            {entry.document_no || '—'}
                          </td>
                          <td
                            className={cn(
                              'p-2 text-right font-mono',
                              entry.quantity < 0 ? 'text-theme-red' : 'theme-text-primary'
                            )}
                          >
                            {entry.quantity.toLocaleString()}
                          </td>
                          <td className="p-2 text-right font-mono theme-text-primary">
                            {formatCompactCurrency(Math.abs(entry.cost_amount_actual), currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {totalLedgerPages > 1 && (
                    <div className="flex items-center justify-between px-2 py-2 border-t border-gray-200/10">
                      <span className="text-[10px] theme-text-secondary">
                        {(ledgerPage - 1) * ENTRIES_PER_PAGE + 1}–
                        {Math.min(ledgerPage * ENTRIES_PER_PAGE, ledgerEntries.length)} of{' '}
                        {ledgerEntries.length}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                          disabled={ledgerPage === 1}
                          className="px-2 py-0.5 text-[10px] rounded border border-gray-200/10 theme-text-secondary hover:bg-gray-500/5 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Prev
                        </button>
                        <button
                          onClick={() => setLedgerPage((p) => Math.min(totalLedgerPages, p + 1))}
                          disabled={ledgerPage === totalLedgerPages}
                          className="px-2 py-0.5 text-[10px] rounded border border-gray-200/10 theme-text-secondary hover:bg-gray-500/5 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bottom padding */}
            <div className="h-6" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
