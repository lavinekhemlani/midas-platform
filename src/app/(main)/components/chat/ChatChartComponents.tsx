// src/app/(main)/components/chat/ChatChartComponents.tsx
'use client'

import React, { useState } from 'react'
import { logger } from '@/lib/logger'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ScatterChart as RechartsScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ZAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCurrency } from '@/contexts/CurrencyContext'
import { formatCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'
import DynamicDataTable from '../tables/DynamicDataTable'

// Dynamic imports for new components
const ScatterChart = dynamic(() => import('../charts/ScatterChart'), {
  ssr: false,
  loading: () => <div className="h-[300px] flex items-center justify-center">Loading chart...</div>,
})

// Color palette for charts
const CHART_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#f97316', // orange
  '#84cc16', // lime
  '#14b8a6', // teal
]

// Base chart props
interface BaseChartProps {
  data: any[]
  title?: string
  height?: number
  showLegend?: boolean
  className?: string
}

// Financial Chart - flexible chart that can render different types
export function FinancialChart({
  data,
  title,
  type = 'line',
  xKey = 'date',
  yKeys = ['value'],
  height = 300,
  showLegend = true,
  className,
  stacked = false,
  showGrid = true,
  colors = CHART_COLORS,
}: BaseChartProps & {
  type?: 'line' | 'bar' | 'area'
  xKey?: string
  yKeys?: string[]
  stacked?: boolean
  showGrid?: boolean
  colors?: string[]
}) {
  const { currency } = useCurrency()

  // Sort data by date if xKey is date-like
  const sortedData = React.useMemo(() => {
    if (xKey === 'date' || xKey === 'month' || xKey === 'period') {
      return [...data].sort((a, b) => {
        const dateA = new Date(a[xKey]).getTime()
        const dateB = new Date(b[xKey]).getTime()
        return dateA - dateB
      })
    }
    return data
  }, [data, xKey])

  const formatYAxis = (value: number) => {
    return formatCurrency(value, { currency, compact: true })
  }

  const formatXAxis = (value: string) => {
    // If it looks like a date, format it
    if (value && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    }
    return value
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-luxury-card p-3 border border-amber-500/20 shadow-xl">
          <p className="font-semibold theme-text-primary mb-2">{formatXAxis(label)}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-sm theme-text-secondary capitalize">
                  {entry.name.replace(/_/g, ' ')}
                </span>
              </div>
              <span className="text-sm font-semibold theme-text-primary ml-4">
                {formatCurrency(entry.value, { currency })}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  const renderChart = () => {
    const commonProps = {
      data: sortedData,
      children: (
        <>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />}
          <XAxis
            dataKey={xKey}
            stroke="rgba(148, 163, 184, 0.6)"
            fontSize={11}
            tickFormatter={formatXAxis}
          />
          <YAxis stroke="rgba(148, 163, 184, 0.6)" fontSize={11} tickFormatter={formatYAxis} />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend />}
        </>
      ),
    }

    if (type === 'line') {
      return (
        <LineChart {...commonProps}>
          {commonProps.children}
          {yKeys.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[index % colors.length]}
              fill={colors[index % colors.length]}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      )
    } else if (type === 'bar') {
      return (
        <BarChart {...commonProps}>
          {commonProps.children}
          {yKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              stroke={colors[index % colors.length]}
              fill={colors[index % colors.length]}
              stackId={stacked ? 'stack' : undefined}
              radius={8}
            />
          ))}
        </BarChart>
      )
    } else {
      return (
        <AreaChart {...commonProps}>
          {commonProps.children}
          {yKeys.map((key, index) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[index % colors.length]}
              fill={colors[index % colors.length]}
              fillOpacity={0.3}
              strokeWidth={2}
              stackId={stacked ? 'stack' : undefined}
            />
          ))}
        </AreaChart>
      )
    }
  }

  return (
    <Card className={cn('chart-container overflow-hidden', className)}>
      {title && (
        <CardHeader className="pb-4">
          <CardTitle className="chart-title text-sm sm:text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-2 sm:p-4">
        <div style={{ width: '100%', height, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// Metric Card - for displaying KPIs
export function MetricCard({
  title,
  value,
  change,
  changeType = 'percentage',
  icon,
  trend,
  subtitle,
  className,
}: {
  title: string
  value: number | string
  change?: number
  changeType?: 'percentage' | 'absolute'
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'stable'
  subtitle?: string
  className?: string
}) {
  const { currency } = useCurrency()

  const formattedValue = typeof value === 'number' ? formatCurrency(value, { currency }) : value

  const getTrendColor = () => {
    if (!trend) return 'theme-text-secondary'
    if (trend === 'up') return 'text-emerald-400'
    if (trend === 'down') return 'text-red-400'
    return 'text-amber-400'
  }

  return (
    <Card className={cn('glass-luxury-card', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium theme-text-secondary flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold theme-text-primary">{formattedValue}</div>
        {subtitle && <p className="text-xs theme-text-secondary mt-1">{subtitle}</p>}
        {change !== undefined && (
          <div className={cn('text-sm mt-2', getTrendColor())}>
            {change}
            {changeType === 'percentage' ? '%' : ''}
            {trend && <span className="text-xs ml-1">vs last period</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Data Table - for tabular data
export function DataTable({
  data,
  columns,
  title,
  showPagination = false,
  className,
}: {
  data: any[]
  columns: Array<{
    key: string
    header: string
    format?: 'currency' | 'percentage' | 'date' | 'text'
    align?: 'left' | 'center' | 'right'
  }>
  title?: string
  showPagination?: boolean
  className?: string
}) {
  const { currency } = useCurrency()
  const [currentPage, setCurrentPage] = useState(0)
  const itemsPerPage = 10

  const formatCell = (value: any, format?: string) => {
    if (value === null || value === undefined) return '-'

    switch (format) {
      case 'currency':
        return formatCurrency(value, { currency })
      case 'percentage':
        return `${value.toFixed(1)}%`
      case 'date':
        return new Date(value).toLocaleDateString()
      default:
        return value
    }
  }

  const paginatedData = showPagination
    ? data.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage)
    : data

  const totalPages = Math.ceil(data.length / itemsPerPage)

  return (
    <Card className={cn('chart-container', className)}>
      {title && (
        <CardHeader>
          <CardTitle className="chart-title">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-amber-500/10">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'py-3 px-2 text-sm font-medium theme-text-secondary',
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-amber-500/5 hover:bg-slate-500/5">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'py-3 px-2 text-sm theme-text-primary',
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                      )}
                    >
                      {formatCell(row[col.key], col.format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showPagination && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-amber-500/10">
            <span className="text-sm theme-text-secondary">
              Showing {currentPage * itemsPerPage + 1}-
              {Math.min((currentPage + 1) * itemsPerPage, data.length)} of {data.length}
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((prev: number) => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
                className="px-3 py-1 text-sm rounded-md bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((prev: number) => Math.min(totalPages - 1, prev + 1))}
                disabled={currentPage === totalPages - 1}
                className="px-3 py-1 text-sm rounded-md bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Correlation Chart - wrapper for ScatterChart
export function CorrelationChart({
  data,
  title,
  xLabel,
  yLabel,
  zLabel,
  showTrendLine = true,
  bubbleChart = false,
  className,
}: {
  data: any[]
  title?: string
  xLabel: string
  yLabel: string
  zLabel?: string
  showTrendLine?: boolean
  bubbleChart?: boolean
  className?: string
}) {
  // ScatterChart doesn't accept className, so we wrap it
  return (
    <div className={className}>
      <ScatterChart
        data={data}
        title={title}
        xLabel={xLabel}
        yLabel={yLabel}
        zLabel={zLabel}
        showTrendLine={showTrendLine}
        bubbleChart={bubbleChart}
      />
    </div>
  )
}

// Advanced Table - wrapper for DynamicDataTable
export function AdvancedTable({
  data,
  columns,
  title,
  subtitle,
  enableSearch = true,
  enableSort = true,
  enableFilter = true,
  enableExport = true,
  enablePagination = true,
  enableAggregation = false,
  customActions,
  className,
}: {
  data: any[]
  columns: any[]
  title?: string
  subtitle?: string
  enableSearch?: boolean
  enableSort?: boolean
  enableFilter?: boolean
  enableExport?: boolean
  enablePagination?: boolean
  enableAggregation?: boolean
  customActions?: Array<{
    label: string
    href?: string
    onClick?: () => void
    variant?: 'default' | 'outline' | 'ghost'
    icon?: React.ReactNode
  }>
  className?: string
}) {
  // Map the props to match DynamicDataTable's interface
  logger.debug('AdvancedTable props received', {
    component: 'AdvancedTable',
    dataLength: data?.length,
    dataIsArray: Array.isArray(data),
    columnsLength: columns?.length,
    title,
    subtitle,
    sampleData: data?.length > 0 ? data[0] : 'No data',
  })

  return (
    <DynamicDataTable
      data={data || []}
      columns={columns || []}
      title={title}
      subtitle={subtitle}
      searchable={enableSearch}
      exportable={enableExport}
      paginate={enablePagination}
      showAggregations={enableAggregation}
      customActions={customActions}
      className={className}
    />
  )
}

// Insight Card - for AI insights
export function InsightCard({
  title,
  description,
  type = 'info',
  priority = 'medium',
  actions,
  icon,
  className,
}: {
  title: string
  description: string
  type?: 'info' | 'warning' | 'critical' | 'success'
  priority?: 'high' | 'medium' | 'low'
  actions?: Array<{ label: string; onClick: () => void }>
  icon?: React.ReactNode
  className?: string
}) {
  const getTypeStyles = () => {
    switch (type) {
      case 'critical':
        return 'border-red-500/30 bg-red-500/5'
      case 'warning':
        return 'border-amber-500/30 bg-amber-500/5'
      case 'success':
        return 'border-emerald-500/30 bg-emerald-500/5'
      default:
        return 'border-blue-500/30 bg-blue-500/5'
    }
  }

  const getIconColor = () => {
    switch (type) {
      case 'critical':
        return 'text-red-400'
      case 'warning':
        return 'text-amber-400'
      case 'success':
        return 'text-emerald-400'
      default:
        return 'text-blue-400'
    }
  }

  return (
    <div className={cn('p-4 rounded-lg border transition-all', getTypeStyles(), className)}>
      <div className="flex items-start space-x-3">
        {icon && <div className={cn('mt-0.5', getIconColor())}>{icon}</div>}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-medium theme-text-primary">{title}</h4>
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                priority === 'high'
                  ? 'border-red-500/30 text-red-400'
                  : priority === 'low'
                    ? 'border-gray-500/30 text-gray-400'
                    : 'border-amber-500/30 text-amber-400'
              )}
            >
              {priority}
            </Badge>
          </div>
          <p className="text-sm theme-text-secondary">{description}</p>

          {actions && actions.length > 0 && (
            <div className="flex items-center space-x-2 mt-3">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
