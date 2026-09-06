// src/app/(main)/components/RevenueChart.tsx
'use client'

import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useTheme } from '@/hooks/useTheme'

interface RevenueDataPoint {
  month: string
  revenue: number
  expenses: number
  profit: number
}

interface RevenueChartProps {
  data: RevenueDataPoint[]
  currency?: string
  height?: number
  onPeriodChange?: (period: string) => void
  currentPeriod?: string
  isLoading?: boolean
  viewType?: 'monthly' | 'weekly'
  onViewTypeChange?: (type: 'monthly' | 'weekly') => void
  dataSource?: {
    revenue?: string
    expenses?: string
    calculation?: string
  }
}

export default function RevenueChart({
  data,
  currency: propCurrency,
  height = 300,
  onPeriodChange,
  currentPeriod = '3months',
  isLoading = false,
  viewType = 'monthly',
  onViewTypeChange,
  dataSource,
}: RevenueChartProps) {
  const { currency: contextCurrency } = useCurrency()
  const currency = propCurrency || contextCurrency
  const { theme } = useTheme()
  const isLightTheme = theme === 'light'

  const [selectedMetrics, setSelectedMetrics] = useState({
    revenue: true,
    expenses: true,
    profit: true,
  })

  const CustomTooltip = ({ active, payload, label, coordinate, viewBox }: any) => {
    if (active && payload && payload.length) {
      // Determine if tooltip is on left or right side
      const isLeftSide = coordinate && viewBox && coordinate.x > viewBox.width / 2
      const xOffset = isLeftSide ? -10 : 10

      const textPrimary = isLightTheme ? '#1f2937' : '#f3f4f6'
      const textSecondary = isLightTheme ? '#6b7280' : '#9ca3af'

      return (
        <div
          className="pointer-events-none px-3 py-2 rounded shadow-lg text-xs"
          style={{
            transform: `translate(${xOffset}px, -10px)`,
            backgroundColor: isLightTheme ? 'rgba(255,255,255,0.95)' : 'rgba(30,30,35,0.95)',
            color: textPrimary,
            border: `1px solid ${isLightTheme ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
          }}
        >
          <p className="font-semibold mb-1.5" style={{ color: textPrimary }}>
            {label}
          </p>
          {payload.map((entry: any) => (
            <div key={entry.name} className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span style={{ color: textSecondary }} className="capitalize">
                  {entry.dataKey}
                </span>
              </div>
              <span className="font-semibold" style={{ color: textPrimary }}>
                {formatCompactCurrency(entry.value, currency)}
              </span>
            </div>
          ))}
          {payload.find((p: any) => p.dataKey === 'profit') &&
            payload.find((p: any) => p.dataKey === 'revenue') && (
              <div
                className="mt-1.5 pt-1.5"
                style={{
                  borderTop: `1px solid ${isLightTheme ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <p style={{ color: textSecondary, fontSize: '10px' }}>
                  Profit Margin:{' '}
                  {(
                    (payload.find((p: any) => p.dataKey === 'profit')?.value /
                      payload.find((p: any) => p.dataKey === 'revenue')?.value) *
                    100
                  ).toFixed(1)}
                  %
                </p>
              </div>
            )}
        </div>
      )
    }
    return null
  }

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex items-center justify-center space-x-4 mt-2">
        {payload.map((entry: any, index: number) => (
          <button
            key={`item-${index}`}
            className={cn(
              'flex items-center space-x-1.5 text-xs transition-opacity',
              !selectedMetrics[entry.value as keyof typeof selectedMetrics] && 'opacity-40'
            )}
            onClick={() =>
              setSelectedMetrics((prev) => ({
                ...prev,
                [entry.value]: !prev[entry.value as keyof typeof selectedMetrics],
              }))
            }
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="theme-text-primary capitalize">{entry.value}</span>
          </button>
        ))}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div style={{ width: '100%', height: height }}>
        <div className="skeleton h-full animate-pulse" />
      </div>
    )
  }

  return (
    <div className="w-full">
      {onPeriodChange && (
        <div className="flex items-center justify-between mb-4">
          {/* Left side: View Type and Period controls */}
          <div className="flex items-center space-x-3">
            {/* View Type Toggle for 3 months */}
            {currentPeriod === '3months' && onViewTypeChange && (
              <div className="flex items-center space-x-1 bg-slate-500/10 rounded-lg p-1">
                <button
                  onClick={() => onViewTypeChange('weekly')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-all',
                    viewType === 'weekly'
                      ? 'bg-blue-500 text-white'
                      : 'theme-text-secondary hover:theme-text-primary'
                  )}
                >
                  Weekly
                </button>
                <button
                  onClick={() => onViewTypeChange('monthly')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-all',
                    viewType === 'monthly'
                      ? 'bg-blue-500 text-white'
                      : 'theme-text-secondary hover:theme-text-primary'
                  )}
                >
                  Monthly
                </button>
              </div>
            )}

            {/* Period Selector - Only 12M and 3M */}
            <div className="flex items-center space-x-1 bg-slate-500/10 rounded-lg p-1">
              <button
                onClick={() => onPeriodChange('12months')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded transition-all',
                  currentPeriod === '12months'
                    ? 'bg-amber-500 text-white'
                    : 'theme-text-secondary hover:theme-text-primary'
                )}
              >
                1Y
              </button>
              <button
                onClick={() => onPeriodChange('3months')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded transition-all',
                  currentPeriod === '3months'
                    ? 'bg-amber-500 text-white'
                    : 'theme-text-secondary hover:theme-text-primary'
                )}
              >
                3M
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-2" style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148, 163, 184, 0.1)"
              vertical={false}
            />

            <XAxis
              dataKey="month"
              stroke="rgba(148, 163, 184, 0.6)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />

            <YAxis
              stroke="rgba(148, 163, 184, 0.6)"
              fontSize={11}
              tickFormatter={(value) => formatCompactCurrency(value, currency)}
              tickLine={false}
              axisLine={false}
            />

            <Tooltip
              content={<CustomTooltip />}
              wrapperStyle={{
                pointerEvents: 'none',
                zIndex: 1000,
              }}
              position={{ y: 0 }}
              allowEscapeViewBox={{ x: false, y: false }}
            />

            <Legend content={<CustomLegend />} />

            {selectedMetrics.revenue && (
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#revenueGradient)"
                name="revenue"
                dot={false}
              />
            )}

            {selectedMetrics.expenses && (
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#expensesGradient)"
                name="expenses"
                dot={false}
              />
            )}

            {selectedMetrics.profit && (
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="url(#profitGradient)"
                name="profit"
                dot={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
