'use client'

import React, { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, BarChart3, Activity } from 'lucide-react'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'

interface TrendDataPoint {
  month: string
  revenue: number
  expenses: number
  profit: number
  cashFlow: number
  [key: string]: any
}

interface TrendChartProps {
  data: TrendDataPoint[]
  currency?: string
  height?: number
  showArea?: boolean
  className?: string
  title?: string
  showLegend?: boolean
}

export default function TrendChart({
  data,
  currency = 'USD',
  height = 350,
  showArea = true,
  className,
  title = 'Financial Trends',
  showLegend = true,
}: TrendChartProps) {
  const { theme } = useTheme()
  const isLightTheme = theme === 'light'

  // Theme-aware blue color
  const themeBlue = isLightTheme ? '#0D54A8' : '#66A7F3'

  const [chartType, setChartType] = useState<'area' | 'line'>('area')
  const [selectedMetrics, setSelectedMetrics] = useState({
    revenue: true,
    expenses: true,
    profit: true,
    cashFlow: false,
  })

  const toggleMetric = (metric: keyof typeof selectedMetrics) => {
    setSelectedMetrics((prev) => ({
      ...prev,
      [metric]: !prev[metric],
    }))
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="pointer-events-none px-3 py-2 rounded shadow-lg text-xs"
          style={{
            backgroundColor: isLightTheme ? 'rgba(255,255,255,0.95)' : 'rgba(30,30,35,0.95)',
            color: isLightTheme ? '#1f2937' : '#f3f4f6',
            border: `1px solid ${isLightTheme ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
          }}
        >
          <p
            className="font-semibold mb-1.5"
            style={{ color: isLightTheme ? '#1f2937' : '#f3f4f6' }}
          >
            {label}
          </p>
          {payload.map((entry: any) => (
            <div key={entry.name} className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span style={{ color: isLightTheme ? '#6b7280' : '#9ca3af' }} className="capitalize">
                  {entry.dataKey}
                </span>
              </div>
              <span
                className="font-semibold"
                style={{ color: isLightTheme ? '#1f2937' : '#f3f4f6' }}
              >
                {formatCompactCurrency(entry.value, currency)}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  const ChartComponent = chartType === 'area' ? AreaChart : LineChart
  const DataComponent = chartType === 'area' ? Area : Line

  // Calculate average values for reference lines
  const avgRevenue = data.reduce((sum, d) => sum + d.revenue, 0) / data.length
  const avgProfit = data.reduce((sum, d) => sum + d.profit, 0) / data.length

  return (
    <Card className={cn('glass-luxury-card gap-0', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-theme-blue" />
            {title}
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* Chart Type Toggle */}
            <div className="flex gap-1 p-1 bg-gray-800/30 rounded-lg">
              <Button
                size="sm"
                variant={chartType === 'area' ? 'default' : 'ghost'}
                onClick={() => setChartType('area')}
                className="h-7 px-2"
              >
                <Activity className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant={chartType === 'line' ? 'default' : 'ghost'}
                onClick={() => setChartType('line')}
                className="h-7 px-2"
              >
                <TrendingUp className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Metric Toggles */}
        <div className="flex flex-wrap gap-2 mt-4">
          {Object.entries(selectedMetrics).map(([metric, isActive]) => (
            <button
              key={metric}
              onClick={() => toggleMetric(metric as keyof typeof selectedMetrics)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-all',
                isActive
                  ? 'bg-theme-blue/20 text-theme-blue border border-theme-blue/30'
                  : 'bg-gray-800/30 text-gray-400 border border-gray-700/30 hover:bg-gray-800/40'
              )}
            >
              {metric.charAt(0).toUpperCase() + metric.slice(1)}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <ChartComponent data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={themeBlue} stopOpacity={0.8} />
                <stop offset="95%" stopColor={themeBlue} stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorCashFlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0.1} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgb(55 65 81 / 0.3)" vertical={false} />

            <XAxis
              dataKey="month"
              stroke="rgb(156 163 175 / 0.5)"
              tick={{ fill: 'rgb(156 163 175 / 0.8)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />

            <YAxis
              stroke="rgb(156 163 175 / 0.5)"
              tick={{ fill: 'rgb(156 163 175 / 0.8)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCompactCurrency(value, currency)}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Reference Lines */}
            {selectedMetrics.revenue && (
              <ReferenceLine
                y={avgRevenue}
                stroke="#10b981"
                strokeDasharray="5 5"
                strokeOpacity={0.3}
              />
            )}
            {selectedMetrics.profit && (
              <ReferenceLine
                y={avgProfit}
                stroke={themeBlue}
                strokeDasharray="5 5"
                strokeOpacity={0.3}
              />
            )}

            {/* Data Lines/Areas */}
            {selectedMetrics.revenue &&
              React.createElement(DataComponent as any, {
                type: 'monotone',
                dataKey: 'revenue',
                stroke: '#10b981',
                strokeWidth: 2,
                fill: chartType === 'area' ? 'url(#colorRevenue)' : undefined,
                fillOpacity: chartType === 'area' ? 1 : undefined,
                dot: { fill: '#10b981', strokeWidth: 2, r: 3 },
                activeDot: { r: 5 },
              })}

            {selectedMetrics.expenses &&
              React.createElement(DataComponent as any, {
                type: 'monotone',
                dataKey: 'expenses',
                stroke: '#f97316',
                strokeWidth: 2,
                fill: chartType === 'area' ? 'url(#colorExpenses)' : undefined,
                fillOpacity: chartType === 'area' ? 1 : undefined,
                dot: { fill: '#f97316', strokeWidth: 2, r: 3 },
                activeDot: { r: 5 },
              })}

            {selectedMetrics.profit &&
              React.createElement(DataComponent as any, {
                type: 'monotone',
                dataKey: 'profit',
                stroke: themeBlue,
                strokeWidth: 2,
                fill: chartType === 'area' ? 'url(#colorProfit)' : undefined,
                fillOpacity: chartType === 'area' ? 1 : undefined,
                dot: { fill: themeBlue, strokeWidth: 2, r: 3 },
                activeDot: { r: 5 },
              })}

            {selectedMetrics.cashFlow &&
              React.createElement(DataComponent as any, {
                type: 'monotone',
                dataKey: 'cashFlow',
                stroke: '#a855f7',
                strokeWidth: 2,
                fill: chartType === 'area' ? 'url(#colorCashFlow)' : undefined,
                fillOpacity: chartType === 'area' ? 1 : undefined,
                dot: { fill: '#a855f7', strokeWidth: 2, r: 3 },
                activeDot: { r: 5 },
              })}

            {showLegend && (
              <Legend
                wrapperStyle={{
                  paddingTop: '20px',
                }}
                iconType="circle"
                formatter={(value) => (
                  <span className="text-xs theme-text-secondary capitalize">{value}</span>
                )}
              />
            )}
          </ChartComponent>
        </ResponsiveContainer>

        {/* Trend Summary */}
        <div className="mt-4 grid grid-cols-2 @md:grid-cols-4 gap-3">
          {Object.entries(selectedMetrics)
            .filter(([_, isActive]) => isActive)
            .map(([metric]) => {
              const latestValue = data[data.length - 1]?.[metric] || 0
              const previousValue = data[data.length - 2]?.[metric] || 0
              const change = ((latestValue - previousValue) / previousValue) * 100

              return (
                <div
                  key={metric}
                  className="p-2 bg-gray-800/20 rounded-lg border border-gray-700/30"
                >
                  <p className="text-xs theme-text-secondary capitalize mb-1">{metric}</p>
                  <p className="text-sm font-semibold theme-text-primary">
                    {formatCompactCurrency(latestValue, currency)}
                  </p>
                  <p className={cn('text-xs', change > 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {change.toFixed(1)}%
                  </p>
                </div>
              )
            })}
        </div>
      </CardContent>
    </Card>
  )
}
