// src/app/(main)/components/ExpenseBreakdown.tsx
'use client'

import { useState, useMemo } from 'react'
import PieChart from '@/components/charts/PieChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingDown, DollarSign, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { useCurrency } from '@/contexts/CurrencyContext'

export interface ExpenseCategory {
  category: string
  amount: number
  percentage: number
  vendorCount?: number
  transactionCount?: number
  trend?: {
    direction: 'up' | 'down' | 'stable'
    percentage: number
  }
}

interface ExpenseBreakdownProps {
  categories: ExpenseCategory[]
  totalAmount: number
  currency?: string
  period?: string
  className?: string
}

export default function ExpenseBreakdown({
  categories,
  totalAmount,
  currency: propCurrency,
  period = 'This Month',
  className,
}: ExpenseBreakdownProps) {
  const { currency: contextCurrency } = useCurrency()
  const currency = propCurrency || contextCurrency
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)
  const [showAllCategories, setShowAllCategories] = useState(false)

  // Ensure all categories have percentage field and sort by amount
  const sortedCategories = categories
    .map((cat) => ({
      ...cat,
      percentage: cat.percentage ?? (totalAmount > 0 ? (cat.amount / totalAmount) * 100 : 0),
    }))
    .sort((a, b) => b.amount - a.amount) // Sort by highest amount first

  // Process categories - show top 5 + Others if more than 6 categories
  const processedCategories =
    sortedCategories.length > 6 && !showAllCategories
      ? (() => {
          const top5 = sortedCategories.slice(0, 5)
          const othersAmount = sortedCategories.slice(5).reduce((sum, cat) => sum + cat.amount, 0)
          const othersPercentage = totalAmount > 0 ? (othersAmount / totalAmount) * 100 : 0
          return [
            ...top5,
            {
              category: 'Others',
              amount: othersAmount,
              percentage: othersPercentage,
              vendorCount: sortedCategories
                .slice(5)
                .reduce((sum, cat) => sum + (cat.vendorCount || 1), 0),
            },
          ]
        })()
      : sortedCategories

  const COLORS = [
    '#ef4444', // red
    '#f97316', // orange
    '#f59e0b', // amber
    '#eab308', // yellow
    '#84cc16', // lime
    '#22c55e', // green
    '#10b981', // emerald
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#3b82f6', // blue
  ]

  // Transform data for PieChart component
  const pieChartData = useMemo(() => {
    return processedCategories.map((item) => ({
      name: item.category,
      value: item.amount,
      percentage: item.percentage,
      vendorCount: item.vendorCount,
      transactionCount: item.transactionCount,
      trend: item.trend,
    }))
  }, [processedCategories])

  // Custom tooltip formatter for PieChart
  const formatPieTooltip = (value: number, item: any) => {
    return (
      <div className="glass-luxury-card p-2 border border-amber-500/10 bg-opacity-80 backdrop-blur-sm">
        <p className="font-medium theme-text-primary text-xs">{item.name}</p>
        <div className="space-y-0.5 mt-1">
          <p className="text-xs theme-text-secondary">
            {formatCurrency(value, { currency })} ({(item.percentage || 0).toFixed(1)}%)
          </p>
          {item.vendorCount && (
            <p className="text-xs theme-text-secondary">{item.vendorCount} vendors</p>
          )}
          {item.transactionCount && (
            <p className="text-xs theme-text-secondary">{item.transactionCount} transactions</p>
          )}
          {item.trend && (
            <p
              className={cn(
                'text-xs font-medium',
                item.trend.direction === 'up'
                  ? 'text-red-400'
                  : item.trend.direction === 'down'
                    ? 'text-emerald-400'
                    : 'theme-text-secondary'
              )}
            >
              {item.trend.direction === 'up' ? '↑' : item.trend.direction === 'down' ? '↓' : '→'}{' '}
              {(item.trend.percentage || 0).toFixed(1)}% vs last period
            </p>
          )}
        </div>
      </div>
    )
  }

  // Find top spending categories
  const topCategories = [...processedCategories].sort((a, b) => b.amount - a.amount).slice(0, 3)

  // Calculate if any category is over budget threshold (e.g., 30% of total)
  const highSpendCategories = processedCategories.filter((cat) => cat.percentage > 30)

  // Format label for PieChart
  const formatPieLabel = (value: number) => {
    return formatCurrency(value, { currency })
  }

  return (
    <Card className={cn('chart-container', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="chart-title">
            <TrendingDown className="w-5 h-5 text-red-500" />
            Expense Breakdown
          </CardTitle>
          <div className="flex items-center gap-4">
            {sortedCategories.length > 6 && (
              <button
                onClick={() => setShowAllCategories(!showAllCategories)}
                className="text-xs theme-text-secondary hover:text-amber-500 transition-colors"
              >
                {showAllCategories ? 'Show Top 5' : `Show All (${sortedCategories.length})`}
              </button>
            )}
            <div className="text-right">
              <p className="text-xs theme-text-secondary">{period}</p>
              <p className="text-lg font-bold text-red-400">
                {formatCurrency(totalAmount, { currency })}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <PieChart
            data={pieChartData}
            height={320}
            activeIndex={activeIndex}
            onActiveIndexChange={setActiveIndex}
            colors={COLORS}
            formatTooltip={formatPieTooltip}
            formatLabel={formatPieLabel}
            showActiveShape={true}
            showTooltip={true}
            showLegend={true}
            legendPosition="left"
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          />

          {/* Category List */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold theme-text-primary mb-3">Expense Categories</h4>
            <div className="space-y-2 max-h-[280px] overflow-y-auto styled-scrollbar pr-2">
              {processedCategories.map((category, index) => (
                <div
                  key={category.category}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-500/5 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm theme-text-primary truncate">{category.category}</p>
                      {category.vendorCount && (
                        <p className="text-xs theme-text-secondary">
                          {category.vendorCount} vendors
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold theme-text-primary">
                      {formatCurrency(category.amount, { currency, compact: true })}
                    </p>
                    <p className="text-xs theme-text-secondary">
                      {(category.percentage || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alerts and Insights */}
        {highSpendCategories.length > 0 && (
          <div className="mt-6 p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-400 mb-1">High Spending Alert</h4>
                <p className="text-sm theme-text-secondary">
                  {highSpendCategories.map((cat) => cat.category).join(', ')}
                  {highSpendCategories.length === 1 ? ' accounts' : ' account'} for over 30% of
                  total expenses. Consider reviewing these categories for cost optimization.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Top Categories Summary */}
        <div className="mt-6 pt-6 border-t border-amber-500/10">
          <h4 className="text-sm font-semibold theme-text-primary mb-3">Top Spending Areas</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topCategories.map((category, index) => (
              <div
                key={category.category}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-500/5"
              >
                <div className="flex items-center space-x-2">
                  <Badge
                    className={cn(
                      'text-xs',
                      index === 0
                        ? 'bg-red-500/10 text-red-400 border-red-500/30'
                        : index === 1
                          ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    )}
                  >
                    #{index + 1}
                  </Badge>
                  <span className="text-sm theme-text-primary">{category.category}</span>
                </div>
                <span className="text-sm font-bold text-red-400">
                  {(category.percentage || 0).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
