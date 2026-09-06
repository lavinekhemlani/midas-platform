// src/app/(main)/components/RevenueBreakdown.tsx
'use client'

import { useMemo, useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts'
import PieChart from '@/components/charts/PieChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  BarChart3,
  Users,
  Package,
  Zap,
  Calendar,
  HelpCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/contexts/CurrencyContext'

export interface RevenueSource {
  source: string
  amount: number
  percentage: number
  count?: number
  growth?: number
  category?: 'product' | 'service' | 'subscription' | 'other'
  customerSegment?: string
}

interface RevenueBreakdownProps {
  data: RevenueSource[]
  totalRevenue: number
  previousPeriodRevenue?: number
  currency?: string
  period?: string
  showGrowth?: boolean
  showSegmentation?: boolean
  className?: string
  isLoading?: boolean
  dataSource?: {
    type?: 'invoices' | 'deposits' | 'mixed'
    count?: number
    description?: string
  }
}

export default function RevenueBreakdown({
  data,
  totalRevenue,
  previousPeriodRevenue,
  currency: propCurrency,
  period = 'This Month',
  showGrowth = true,
  showSegmentation = true,
  className,
  isLoading = false,
  dataSource,
}: RevenueBreakdownProps) {
  const { currency: contextCurrency } = useCurrency()
  const currency = propCurrency || contextCurrency
  const { theme } = useTheme()
  const isLightTheme = theme === 'light'
  // Set default active index to 0 (largest slice) - same as landing page
  const [activeIndex, setActiveIndex] = useState<number | undefined>(0)
  const [viewType, setViewType] = useState<'pie' | 'bar' | 'segmented'>('bar')
  const [showTooltip, setShowTooltip] = useState(false)

  // Normalize data to ensure percentages are calculated and sort by highest amount
  const normalizedData = useMemo(() => {
    const total = totalRevenue || data.reduce((sum, item) => sum + item.amount, 0)
    return data
      .map((item) => ({
        ...item,
        percentage: item.percentage ?? (item.amount / total) * 100,
      }))
      .sort((a, b) => b.amount - a.amount) // Sort by highest amount first
  }, [data, totalRevenue])

  const COLORS = [
    '#10b981', // emerald-500
    '#3b82f6', // blue-500
    '#8b5cf6', // purple-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#06b6d4', // cyan-500
    '#f97316', // orange-500
    '#84cc16', // lime-500
    '#ec4899', // pink-500
    '#14b8a6', // teal-500
  ]

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: Math.abs(value) >= 1000000 ? 'compact' : 'standard',
      compactDisplay: 'short',
    }).format(value)
  }

  const formatPercentage = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) {
      return '0.0%'
    }
    return `${value.toFixed(1)}%`
  }

  // Calculate growth rate
  const growthRate = previousPeriodRevenue
    ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
    : 0

  // Group data by category if available
  const segmentedData = useMemo(() => {
    if (!showSegmentation) return {}

    const segments: Record<string, { total: number; sources: RevenueSource[] }> = {}

    normalizedData.forEach((source) => {
      const category = source.category || 'other'
      if (!segments[category]) {
        segments[category] = { total: 0, sources: [] }
      }
      segments[category].total += source.amount
      segments[category].sources.push(source)
    })

    return segments
  }, [normalizedData, showSegmentation])

  // Transform data for PieChart component
  const pieChartData = useMemo(() => {
    return normalizedData.map((item) => ({
      name: item.source,
      value: item.amount,
      percentage: item.percentage,
      count: item.count,
      growth: item.growth,
      category: item.category,
      customerSegment: item.customerSegment,
    }))
  }, [normalizedData])

  // Custom tooltip formatter for PieChart
  const formatPieTooltip = (value: number, item: any) => {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <p className="font-semibold theme-text-primary text-sm">{item.name}</p>
          <p className="font-bold text-emerald-400 text-sm">{formatCurrency(value)}</p>
        </div>
        <div className="flex items-center justify-between text-xs theme-text-secondary">
          <span>Percentage</span>
          <span className="font-medium theme-text-primary">
            {formatPercentage(item.percentage)}
          </span>
        </div>
        {item.count && (
          <div className="flex items-center justify-between text-xs theme-text-secondary">
            <span>Transactions</span>
            <span className="font-medium theme-text-primary">{item.count}</span>
          </div>
        )}
        {showGrowth && item.growth !== undefined && (
          <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-700/50 dark:border-gray-700/50 light:border-gray-300/50 dark:border-gray-800/50">
            <span className="theme-text-secondary">Growth</span>
            <span
              className={cn(
                'font-medium flex items-center gap-1',
                item.growth >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {item.growth >= 0 ? '↑' : '↓'} {formatPercentage(Math.abs(item.growth))}
            </span>
          </div>
        )}
      </div>
    )
  }

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: Array<{ payload: RevenueSource }>
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const textPrimary = isLightTheme ? '#1f2937' : '#f3f4f6'
      const textSecondary = isLightTheme ? '#6b7280' : '#9ca3af'
      return (
        <div
          className="pointer-events-none px-3 py-2 rounded shadow-lg text-xs"
          style={{
            backgroundColor: isLightTheme ? 'rgba(255,255,255,0.95)' : 'rgba(30,30,35,0.95)',
            color: textPrimary,
            border: `1px solid ${isLightTheme ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
          }}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <p className="font-semibold" style={{ color: textPrimary }}>
                {data.source}
              </p>
              <p className="font-semibold" style={{ color: '#10b981' }}>
                {formatCurrency(data.amount)}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: textSecondary }}>Percentage</span>
              <span className="font-semibold" style={{ color: textPrimary }}>
                {formatPercentage(data.percentage)}
              </span>
            </div>
            {data.count && (
              <div className="flex items-center justify-between">
                <span style={{ color: textSecondary }}>Transactions</span>
                <span className="font-semibold" style={{ color: textPrimary }}>
                  {data.count}
                </span>
              </div>
            )}
            {showGrowth && data.growth !== undefined && (
              <div
                className="flex items-center justify-between pt-1.5"
                style={{
                  borderTop: `1px solid ${isLightTheme ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <span style={{ color: textSecondary }}>Growth</span>
                <span
                  className="font-semibold flex items-center gap-1"
                  style={{
                    color:
                      data.growth >= 0
                        ? '#10b981'
                        : isLightTheme
                          ? '#D51323'
                          : '#EE3D4C',
                  }}
                >
                  {data.growth >= 0 ? '↑' : '↓'} {formatPercentage(Math.abs(data.growth))}
                </span>
              </div>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'product':
        return Package
      case 'service':
        return Users
      case 'subscription':
        return Calendar
      default:
        return DollarSign
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'product':
        return 'text-blue-400 bg-blue-400/10'
      case 'service':
        return 'text-emerald-400 bg-emerald-400/10'
      case 'subscription':
        return 'text-purple-400 bg-purple-400/10'
      default:
        return 'text-gray-400 bg-gray-400/10'
    }
  }

  // Check if we have no data
  const hasData = normalizedData && normalizedData.length > 0

  return (
    <Card className={cn('chart-container group relative', className)}>
      <CardHeader>
        <div className="flex flex-col space-y-3">
          {/* Top row: Title and Info Button */}
          <div className="flex items-center justify-between">
            <CardTitle className="chart-title">
              <PieChartIcon className="w-5 h-5 text-emerald-500" />
              Revenue Breakdown
            </CardTitle>
            {/* Data Source Info Button */}
            <div
              className="relative"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'w-7 h-7 hover:bg-amber-500/10 transition-opacity duration-300',
                  'opacity-0 group-hover:opacity-100'
                )}
              >
                <HelpCircle className="w-4 h-4 theme-text-secondary" />
              </Button>
              {showTooltip && (
                <div
                  className="absolute top-0 right-full mr-2 w-72 px-3 py-2 rounded shadow-lg text-xs"
                  style={{
                    zIndex: 50,
                    backgroundColor: isLightTheme
                      ? 'rgba(255,255,255,0.95)'
                      : 'rgba(30,30,35,0.95)',
                    color: isLightTheme ? '#1f2937' : '#f3f4f6',
                    border: `1px solid ${isLightTheme ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  <div className="font-semibold theme-text-primary mb-2">Revenue Data Source</div>
                  <div className="theme-text-secondary leading-relaxed space-y-2">
                    {dataSource?.type === 'deposits' ? (
                      <>
                        <div className="text-amber-400 font-semibold">
                          Using Payment Processor Deposits (Fallback)
                        </div>
                        <div>
                          <span className="font-semibold text-cyan-400">Source:</span> QuickBooks
                          Deposits categorized as Revenue/Income
                        </div>
                        <div>
                          <span className="font-semibold text-blue-400">Count:</span>{' '}
                          {dataSource?.count || 0} deposits found
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Note: Customer shows payment processor (e.g., Stripe) instead of end
                          customer
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="font-semibold text-emerald-400">Source:</span> Invoices
                          and Sales Receipts
                        </div>
                        <div>
                          <span className="font-semibold text-cyan-400">Period:</span>{' '}
                          {period || 'Last 30 days'}
                        </div>
                        <div>
                          <span className="font-semibold text-amber-400">Calculation:</span> Sum of
                          paid invoice amounts grouped by customer
                        </div>
                      </>
                    )}
                    <div className="border-t border-gray-700 pt-2 text-[10px] text-gray-400">
                      Updated in Phase 2 data fetch. Shows top revenue sources by{' '}
                      {period ? period.toLowerCase() : 'period'}.
                    </div>
                  </div>
                  <div className="absolute top-3 left-full -ml-1 w-0 h-0 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-current opacity-90"></div>
                </div>
              )}
            </div>
          </div>

          {/* Second row: Revenue info and view toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs theme-text-secondary">{period}</p>
              <p className="text-lg font-bold theme-text-primary">{formatCurrency(totalRevenue)}</p>
              {showGrowth && previousPeriodRevenue && (
                <p
                  className={cn(
                    'text-xs font-medium flex items-center justify-end',
                    growthRate >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {growthRate >= 0 ? (
                    <TrendingUp className="w-3 h-3 mr-1" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-1" />
                  )}
                  {formatPercentage(growthRate)}
                </p>
              )}
            </div>
            {hasData && (
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setViewType('pie')}
                  className={cn(
                    'h-7 w-7 p-0 rounded inline-flex items-center justify-center transition-all theme-text-secondary hover:theme-text-primary',
                    viewType === 'pie' && 'outline-2 outline-slate-500/40'
                  )}
                >
                  <PieChartIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewType('bar')}
                  className={cn(
                    'h-7 w-7 p-0 rounded inline-flex items-center justify-center transition-all theme-text-secondary hover:theme-text-primary',
                    viewType === 'bar' && 'outline-2 outline-slate-500/40'
                  )}
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
                {showSegmentation && (
                  <button
                    onClick={() => setViewType('segmented')}
                    className={cn(
                      'h-7 w-7 p-0 rounded inline-flex items-center justify-center transition-all theme-text-secondary hover:theme-text-primary',
                      viewType === 'segmented' && 'outline-2 outline-amber-500'
                    )}
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        {!hasData ? (
          <div className="flex items-center justify-center h-64">
            {isLoading ? (
              <div className="w-full h-full relative overflow-hidden rounded-lg">
                <span className="absolute inset-0 shimmer-bg-10" />
                <span className="absolute inset-0 shimmer-gradient-light animate-shimmer-fast" />
              </div>
            ) : (
              <div className="text-center space-y-3">
                <PieChartIcon className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto opacity-50" />
                <p className="text-sm theme-text-secondary">No revenue data available</p>
                <p className="text-xs theme-text-secondary opacity-60">
                  Connect your accounting provider to see revenue breakdown
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {viewType === 'pie' && (
              <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                <PieChart
                  data={pieChartData}
                  height={280}
                  activeIndex={activeIndex}
                  onActiveIndexChange={setActiveIndex}
                  colors={COLORS}
                  formatTooltip={formatPieTooltip}
                  formatLabel={formatCurrency}
                  showActiveShape={true}
                  showTooltip={true}
                  showLegend={true}
                  legendPosition="left"
                  dataKey="value"
                  nameKey="name"
                />
              </div>
            )}

            {viewType === 'bar' && (
              <div className="px-2 flex-1" style={{ width: '100%', minHeight: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={normalizedData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                  >
                    <defs>
                      {COLORS.map((color, index) => (
                        <linearGradient
                          key={`barGradient-${index}`}
                          id={`barGradient-${index}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="5%" stopColor={color} stopOpacity={0.6} />
                          <stop offset="95%" stopColor={color} stopOpacity={0.9} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(148, 163, 184, 0.1)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="source"
                      stroke="rgba(148, 163, 184, 0.6)"
                      fontSize={11}
                      angle={-45}
                      textAnchor="end"
                    />
                    <YAxis
                      stroke="rgba(148, 163, 184, 0.6)"
                      fontSize={11}
                      tickFormatter={formatCurrency}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="amount" radius={[8, 8, 0, 0]} stroke="none">
                      {normalizedData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={`url(#barGradient-${index % COLORS.length})`}
                          stroke="none"
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {viewType === 'segmented' && showSegmentation && (
              <div className="space-y-4">
                {Object.entries(segmentedData).map(([category, segment]) => {
                  const CategoryIcon = getCategoryIcon(category)
                  const percentage = (segment.total / totalRevenue) * 100

                  return (
                    <div key={category} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className={cn('p-2 rounded-lg', getCategoryColor(category))}>
                            <CategoryIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-medium theme-text-primary capitalize">
                              {category}
                            </h4>
                            <p className="text-xs theme-text-secondary">
                              {segment.sources.length} sources
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold theme-text-primary">
                            {formatCurrency(segment.total)}
                          </p>
                          <p className="text-xs theme-text-secondary">
                            {formatPercentage(percentage)}
                          </p>
                        </div>
                      </div>

                      <div className="pl-12 space-y-1">
                        {segment.sources.slice(0, 3).map((source, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span className="theme-text-secondary">{source.source}</span>
                            <span className="theme-text-primary">
                              {formatCurrency(source.amount)}
                            </span>
                          </div>
                        ))}
                        {segment.sources.length > 3 && (
                          <p className="text-xs theme-text-secondary">
                            +{segment.sources.length - 3} more sources
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Growth Analysis */}
            {showGrowth && normalizedData.some((s) => s.growth !== undefined) && (
              <div className="mt-6 pt-6 border-t border-amber-500/10">
                <h4 className="text-sm font-semibold theme-text-primary mb-3">Growth Analysis</h4>
                <div className="grid grid-cols-2 gap-3">
                  {normalizedData
                    .filter((s) => s.growth !== undefined)
                    .sort((a, b) => (b.growth || 0) - (a.growth || 0))
                    .slice(0, 6)
                    .map((source, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-500/5"
                      >
                        <span className="text-sm theme-text-primary">{source.source}</span>
                        <div
                          className={cn(
                            'flex items-center space-x-1 text-sm font-medium',
                            (source.growth || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                          )}
                        >
                          {(source.growth || 0) >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          <span>{formatPercentage(source.growth || 0)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
