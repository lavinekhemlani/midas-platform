'use client'

import { useMemo, useCallback, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency, getProductTypeColor } from '@/lib/sales-utils'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import {
  ReactECharts,
  COLORS,
  useThemeEChartsConfig,
  canvasHighDpiOpts,
} from '@/components/chat/visualizations/shared'
import { KPICard } from '../KPICard'
import { ProductDetailPanel } from '../ProductDetailPanel'
import { useSelectionState } from '../../hooks/useSelectionState'
import type { Product, ProductSummary, ProductSortField, SortOrder } from '../../types'

interface ProductsSectionProps {
  products: Product[]
  productSummary: ProductSummary
  currency: string
}

export function ProductsSection({ products, productSummary, currency }: ProductsSectionProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const {
    selected,
    selectedTransaction,
    select,
    clearSelection,
    selectTransaction,
    clearTransaction,
  } = useSelectionState<Product>()

  // Local sort state
  const [sortBy, setSortBy] = useState<ProductSortField>('totalSales')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const handleSort = useCallback(
    (field: ProductSortField) => {
      if (sortBy === field) {
        setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortBy(field)
        setSortOrder('desc')
      }
    },
    [sortBy]
  )

  // Sort products
  const sortedData = useMemo(() => {
    return [...products].sort((a, b) => {
      let aVal: number | string, bVal: number | string
      switch (sortBy) {
        case 'name':
          return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
        case 'type':
          return sortOrder === 'asc'
            ? (a.type || '').localeCompare(b.type || '')
            : (b.type || '').localeCompare(a.type || '')
        case 'totalSales':
          aVal = a.total
          bVal = b.total
          break
        case 'marketShare':
          aVal = a.total / (productSummary.totalSales || 1)
          bVal = b.total / (productSummary.totalSales || 1)
          break
        case 'quantity':
          aVal = a.quantity || 0
          bVal = b.quantity || 0
          break
        case 'avgUnitPrice':
          aVal = a.avgUnitPrice || 0
          bVal = b.avgUnitPrice || 0
          break
        default:
          aVal = a.total
          bVal = b.total
      }
      return sortOrder === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
  }, [products, sortBy, sortOrder, productSummary.totalSales])

  const { tooltipStyle } = useThemeEChartsConfig()

  // Sort icon component
  const SortIcon = ({ field }: { field: ProductSortField }) => {
    const isActive = sortBy === field
    const isAsc = isActive && sortOrder === 'asc'
    const isDesc = isActive && sortOrder === 'desc'

    return (
      <span className="inline-flex flex-col ml-1 -space-y-1.5 align-middle">
        <ChevronUp
          className={`w-3 h-3 transition-opacity ${isAsc ? 'opacity-100' : isActive ? 'opacity-20' : 'opacity-30'}`}
        />
        <ChevronDown
          className={`w-3 h-3 transition-opacity ${isDesc ? 'opacity-100' : isActive ? 'opacity-20' : 'opacity-30'}`}
        />
      </span>
    )
  }

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
    <div className="flex flex-col gap-4">
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

      {/* Product Table with Side Panel */}
      <div className="flex gap-6 min-w-0">
        <div
          className={`transition-all duration-300 ease-out min-w-0 ${selected ? '@5xl:flex-1 @5xl:block hidden' : 'w-full'}`}
        >
          {/* Table Container with fixed height */}
          <div className="flex flex-col h-[500px] overflow-x-auto">
            {/* Fixed Header */}
            <div
              className="flex-shrink-0"
              style={{ borderBottom: '1px solid var(--theme-card-border)' }}
            >
              <table className="w-full">
                <thead>
                  <tr>
                    <th
                      className="text-left py-3 pr-4 text-[11px] font-medium uppercase tracking-wider theme-text-secondary cursor-pointer hover:theme-text-primary transition-colors select-none"
                      onClick={() => handleSort('name')}
                    >
                      Product
                      <SortIcon field="name" />
                    </th>
                    <th
                      className="text-left py-3 px-4 text-[11px] font-medium uppercase tracking-wider theme-text-secondary cursor-pointer hover:theme-text-primary transition-colors select-none whitespace-nowrap"
                      onClick={() => handleSort('type')}
                    >
                      Type
                      <SortIcon field="type" />
                    </th>
                    <th
                      className="text-right py-3 px-4 text-[11px] font-medium uppercase tracking-wider theme-text-secondary cursor-pointer hover:theme-text-primary transition-colors select-none whitespace-nowrap"
                      onClick={() => handleSort('totalSales')}
                    >
                      Sales
                      <SortIcon field="totalSales" />
                    </th>
                    <th
                      className="text-right py-3 px-4 text-[11px] font-medium uppercase tracking-wider theme-text-secondary cursor-pointer hover:theme-text-primary transition-colors select-none whitespace-nowrap"
                      onClick={() => handleSort('quantity')}
                    >
                      Qty
                      <SortIcon field="quantity" />
                    </th>
                    <th
                      className="text-right py-3 pl-4 text-[11px] font-medium uppercase tracking-wider theme-text-secondary cursor-pointer hover:theme-text-primary transition-colors select-none whitespace-nowrap"
                      onClick={() => handleSort('avgUnitPrice')}
                    >
                      Avg Price
                      <SortIcon field="avgUnitPrice" />
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
              </table>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto styled-scrollbar min-h-0">
              <table className="w-full">
                <tbody>
                  {sortedData.map((product, index) => {
                    const percentOfTotal =
                      productSummary.totalSales > 0
                        ? (product.total / productSummary.totalSales) * 100
                        : 0
                    const isSelected = selected?.id === product.id

                    return (
                      <tr
                        key={product.id}
                        className={cn(
                          'group cursor-pointer transition-colors duration-150',
                          isSelected
                            ? 'bg-purple-500/10'
                            : index % 2 === 0
                              ? isLight
                                ? 'bg-stone-200/60'
                                : 'bg-white/[0.02]'
                              : '',
                          isSelected
                            ? 'hover:bg-purple-500/15'
                            : isLight
                              ? 'hover:bg-stone-300/50'
                              : 'hover:bg-white/[0.05]'
                        )}
                        style={{ borderBottom: '1px solid var(--theme-card-border)' }}
                        onClick={() => select(product)}
                      >
                        {/* Product Name */}
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-1 h-7 rounded-full flex-shrink-0 transition-all duration-200 bg-purple-500 ${
                                isSelected ? 'scale-y-110' : ''
                              }`}
                            />
                            <div className="min-w-0">
                              <p
                                className={`font-medium text-sm truncate transition-colors ${
                                  isSelected
                                    ? 'text-purple-500 dark:text-purple-400'
                                    : 'theme-text-primary'
                                }`}
                              >
                                {product.name}
                              </p>
                              {/* Share bar */}
                              <div className="flex items-center gap-2 mt-1">
                                <div
                                  className="w-14 h-1 rounded-full overflow-hidden"
                                  style={{ backgroundColor: 'var(--theme-card-border)' }}
                                >
                                  <div
                                    className="h-full bg-purple-500/80 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min(percentOfTotal, 100)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] theme-text-secondary tabular-nums">
                                  {percentOfTotal.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="py-3 px-4">
                          <Badge variant="secondary" className={getProductTypeColor(product.type)}>
                            {product.type}
                          </Badge>
                        </td>

                        {/* Sales */}
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm tabular-nums font-semibold theme-text-primary">
                            {formatCurrency(product.total, currency)}
                          </span>
                        </td>

                        {/* Quantity */}
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm tabular-nums theme-text-primary">
                            {product.quantity?.toLocaleString() || 0}
                          </span>
                        </td>

                        {/* Avg Price */}
                        <td className="py-3 pl-4 text-right">
                          <span className="text-sm tabular-nums theme-text-secondary">
                            {formatCurrency(product.avgUnitPrice || 0, currency)}
                          </span>
                        </td>

                        {/* Chevron */}
                        <td className="py-3 pl-2 w-8">
                          <ChevronRight
                            className={`w-4 h-4 theme-text-secondary transition-all duration-200 ${
                              isSelected
                                ? 'opacity-100 text-purple-500 translate-x-0'
                                : 'opacity-0 group-hover:opacity-60 -translate-x-1 group-hover:translate-x-0'
                            }`}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Fixed Footer */}
            <div
              className="flex-shrink-0"
              style={{ borderTop: '1px solid var(--theme-card-border)' }}
            >
              <table className="w-full">
                <tfoot>
                  <tr>
                    <td className="py-3 pr-4">
                      <span className="text-xs font-medium uppercase tracking-wider theme-text-secondary">
                        Total ({products.length})
                      </span>
                    </td>
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm tabular-nums font-bold theme-text-primary">
                        {formatCurrency(productSummary.totalSales, currency)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm tabular-nums font-semibold theme-text-primary">
                        {productSummary.totalQuantity?.toLocaleString() || 0}
                      </span>
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <span className="text-sm tabular-nums theme-text-secondary">
                        {formatCurrency(
                          productSummary.totalQuantity > 0
                            ? productSummary.totalSales / productSummary.totalQuantity
                            : 0,
                          currency
                        )}
                      </span>
                    </td>
                    <td className="w-8" />
                  </tr>
                </tfoot>
              </table>
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

      {/* Charts Row */}
      <div className="grid gap-3 @3xl:grid-cols-2">
        {/* Donut Chart */}
        <Card
          className="glass-luxury-card"
          style={{ border: '1px solid var(--theme-card-border)' }}
        >
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
        <Card
          className="glass-luxury-card"
          style={{ border: '1px solid var(--theme-card-border)' }}
        >
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
    </div>
  )
}
