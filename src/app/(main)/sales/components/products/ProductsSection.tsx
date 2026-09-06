'use client'

import { useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { formatCurrency, getProductTypeColor } from '@/lib/sales-utils'
import {
  ReactECharts,
  COLORS,
  useThemeEChartsConfig,
  canvasHighDpiOpts,
} from '@/components/chat/visualizations/shared'
import { KPICard } from '../KPICard'
import { ProductDetailPanel } from '../ProductDetailPanel'
import { SortableTableHeader } from '../shared/SortableTableHeader'
import { useTableSort } from '../../hooks/useTableSort'
import { useSelectionState } from '../../hooks/useSelectionState'
import { sortProducts } from '../../utils/sortUtils'
import type { Product, ProductSummary, ProductSortField, SortOrder } from '../../types'

interface ProductsSectionProps {
  products: Product[]
  productSummary: ProductSummary
  currency: string
}

export function ProductsSection({ products, productSummary, currency }: ProductsSectionProps) {
  const {
    selected,
    selectedTransaction,
    select,
    clearSelection,
    selectTransaction,
    clearTransaction,
  } = useSelectionState<Product>()

  const sortFn = useCallback(
    (a: Product, b: Product, sortBy: ProductSortField, sortOrder: SortOrder) =>
      sortProducts(a, b, sortBy, sortOrder, productSummary.totalSales),
    [productSummary.totalSales]
  )

  const { sortedData, sortBy, sortOrder, handleSort } = useTableSort<Product, ProductSortField>({
    data: products,
    initialSortBy: 'totalSales',
    sortFn,
  })

  const { tooltipStyle } = useThemeEChartsConfig()

  // Donut chart options for ECharts
  const donutChartOption = useMemo(() => {
    if (!products.length) return null

    const chartData = products.slice(0, 8)
    const total = chartData.reduce((sum, p) => sum + p.total, 0)
    const formattedTotal =
      total >= 1000000
        ? `$${(total / 1000000).toFixed(1)}M`
        : total >= 1000
          ? `$${(total / 1000).toFixed(1)}K`
          : `$${total}`

    const pieColors = [COLORS.amber, COLORS.blue, COLORS.emerald, COLORS.purple, COLORS.cyan]

    return {
      backgroundColor: 'transparent',
      tooltip: {
        ...tooltipStyle,
        trigger: 'item' as const,
      },
      graphic: {
        type: 'text',
        left: 'center',
        top: 'center',
        style: {
          text: formattedTotal,
          fontSize: 22,
          fontWeight: 'bold',
          fill: COLORS.amber,
          textAlign: 'center',
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['35%', '65%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          data: chartData.map((item, idx) => ({
            value: item.total,
            name: item.name,
            itemStyle: {
              color: pieColors[idx % pieColors.length],
            },
          })),
          label: { show: false },
          emphasis: {
            label: { show: false },
          },
        },
      ],
    }
  }, [products, tooltipStyle])

  const typeChartData = useMemo(
    () =>
      ['Service', 'Inventory', 'NonInventory'].map((type) => {
        const typeProducts = products.filter((p) => p.type === type)
        return {
          name: type,
          revenue: typeProducts.reduce((sum, p) => sum + p.total, 0),
          count: typeProducts.length,
        }
      }),
    [products]
  )

  return (
    <div className="flex flex-col gap-3">
      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 @2xl:grid-cols-4">
        <KPICard
          title="Total Sales"
          value={formatCurrency(productSummary.totalSales || 0, currency)}
          tooltip="Revenue from all product sales"
          subtitle="All products"
          valueColorClass="text-theme-yellow"
          dotColorClass="bg-amber-500"
        />
        <KPICard
          title="Products"
          value={productSummary.productCount || 0}
          tooltip="Unique products sold"
          subtitle="Products sold"
          valueColorClass="text-theme-blue"
          dotColorClass="bg-blue-500"
        />
        <KPICard
          title="Quantity Sold"
          value={(productSummary.totalQuantity || 0).toLocaleString()}
          tooltip="Total units sold"
          subtitle="Total units"
          valueColorClass="text-theme-purple"
          dotColorClass="bg-purple-500"
        />
        <KPICard
          title="Avg Product Value"
          value={formatCurrency(
            productSummary.productCount > 0
              ? productSummary.totalSales / productSummary.productCount
              : 0,
            currency
          )}
          tooltip="Average sales per product"
          subtitle="Per product"
          valueColorClass="text-theme-green"
          dotColorClass="bg-green-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-3 @3xl:grid-cols-2">
        {/* Donut Chart */}
        <Card className="glass-luxury-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm theme-text-primary">Product Distribution</CardTitle>
            <p className="text-xs theme-text-secondary">Sales by product</p>
          </CardHeader>
          <CardContent className="pt-0">
            {products.length > 0 && donutChartOption && (
              <div className="h-[260px] w-full">
                <ReactECharts
                  option={donutChartOption}
                  style={{ width: '100%', height: '100%' }}
                  opts={canvasHighDpiOpts}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card className="glass-luxury-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm theme-text-primary">Sales by Type</CardTitle>
            <p className="text-xs theme-text-secondary">Revenue breakdown</p>
          </CardHeader>
          <CardContent>
            {products.length > 0 && (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={typeChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                    className="theme-text-secondary"
                  />
                  <YAxis
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                    className="theme-text-secondary"
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <RechartsTooltip
                    formatter={(value: any) => [formatCurrency(value, currency), 'Revenue']}
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.85)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Product Table with Side Panel */}
      <div className="flex gap-4">
        <div
          className={`transition-all duration-300 ${selected ? '@5xl:w-2/3 @5xl:block hidden' : 'w-full'}`}
        >
          <div className="group glass-luxury-card rounded-xl border border-gray-200/10 overflow-hidden flex flex-col relative">
            {/* Subtle top accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent z-20" />
            <div className="overflow-x-auto">
              <div className="overflow-y-auto styled-scrollbar max-h-[600px]">
                <table className="w-full min-w-max">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-muted/90 dark:bg-muted/50 backdrop-blur-md border-b border-gray-200/10">
                      <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-50 whitespace-nowrap">
                        #
                      </th>
                      <SortableTableHeader
                        label="Product"
                        sortKey="name"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        label="Type"
                        sortKey="type"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        label="Total Sales"
                        sortKey="totalSales"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                        align="right"
                      />
                      <SortableTableHeader
                        label="Share"
                        sortKey="marketShare"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                        align="right"
                      />
                      <SortableTableHeader
                        label="Qty"
                        sortKey="quantity"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                        align="right"
                      />
                      <SortableTableHeader
                        label="Avg Price"
                        sortKey="avgUnitPrice"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={handleSort}
                        align="right"
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/5">
                    {sortedData.map((product, index) => {
                      const percentOfTotal =
                        productSummary.totalSales > 0
                          ? (product.total / productSummary.totalSales) * 100
                          : 0

                      return (
                        <tr
                          key={product.id}
                          onClick={() => select(product)}
                          className={`group hover:bg-purple-500/[0.03] transition-all duration-200 cursor-pointer ${
                            selected?.id === product.id
                              ? 'bg-purple-500/10 hover:bg-purple-500/10'
                              : ''
                          }`}
                        >
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold theme-text-secondary tabular-nums">
                              {index + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-sm theme-text-primary group-hover:text-purple-400 transition-colors">
                                {product.name}
                              </span>
                              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0">
                                <span className="text-[10px] text-purple-400 whitespace-nowrap font-medium">
                                  details
                                </span>
                                <ChevronRight className="h-3.5 w-3.5 text-purple-400" />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant="secondary"
                              className={getProductTypeColor(product.type)}
                            >
                              {product.type}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-sm theme-text-primary tabular-nums">
                              {formatCurrency(product.total, currency)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-xs font-bold theme-text-primary tabular-nums">
                              {percentOfTotal.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-semibold theme-text-primary tabular-nums">
                              {product.quantity?.toLocaleString() || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-semibold theme-text-primary tabular-nums">
                              {formatCurrency(product.avgUnitPrice || 0, currency)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Product Detail Side Panel */}
        {selected && (
          <ProductDetailPanel
            product={selected}
            selectedTransaction={selectedTransaction}
            onClose={clearSelection}
            onTransactionClick={selectTransaction}
            onTransactionClose={clearTransaction}
          />
        )}
      </div>
    </div>
  )
}
