// src/app/(main)/components/DailyCashFlowChart.tsx
'use client'

import { useState, useMemo } from 'react'
import { logger } from '@/lib/logger'
import {
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
import { useCurrency } from '@/contexts/CurrencyContext'
import { useTheme } from '@/hooks/useTheme'

interface DailyCashFlowData {
  date: string
  day: string
  inflow: number
  outflow: number
  net: number
}

interface DailyCashFlowChartProps {
  data: DailyCashFlowData[]
  currency?: string
  height?: number
  isLoading?: boolean
  dataSource?: {
    inflowTypes?: string[]
    outflowTypes?: string[]
    period?: string
    counts?: {
      invoices?: number
      deposits?: number
      expenses?: number
    }
  }
}

export default function DailyCashFlowChart({
  data,
  currency: propCurrency,
  height = 320,
  isLoading = false,
  dataSource,
}: DailyCashFlowChartProps) {
  // Debug log to check data structure
  if (data && data.length > 0) {
    logger.debug('DailyCashFlowChart data sample', {
      component: 'DailyCashFlowChart',
      sample: data[0],
      totalOutflows: data.reduce((sum, d) => sum + d.outflow, 0),
    })
  }
  const { currency: contextCurrency } = useCurrency()
  const currency = propCurrency || contextCurrency
  const { theme } = useTheme()
  const isLightTheme = theme === 'light'

  // Check if we have no data
  const hasData = data && data.length > 0

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: Math.abs(value) >= 10000 ? 'compact' : 'standard',
      compactDisplay: 'short',
    }).format(Math.abs(value))
  }

  const formatCurrencyPrecise = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(value))
  }

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const CustomTooltip = ({ active, payload, label, coordinate, viewBox }: any) => {
    if (active && payload && payload.length) {
      // Determine if tooltip is on left or right side
      const isLeftSide = coordinate && viewBox && coordinate.x > viewBox.width / 2
      const xOffset = isLeftSide ? -10 : 10

      const date = new Date(label)
      const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })

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
            {formattedDate}
          </p>

          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span style={{ color: textSecondary }}>
                  {entry.dataKey === 'inflow'
                    ? 'Money In'
                    : entry.dataKey === 'outflow'
                      ? 'Money Out'
                      : 'Net Flow'}
                </span>
              </div>
              <span
                className="font-semibold"
                style={{
                  color:
                    entry.dataKey === 'inflow'
                      ? '#10b981'
                      : entry.dataKey === 'outflow'
                        ? isLightTheme
                          ? '#D51323'
                          : '#EE3D4C'
                        : entry.value >= 0
                          ? '#10b981'
                          : isLightTheme
                            ? '#D51323'
                            : '#EE3D4C',
                }}
              >
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}

          {payload.find((p: any) => p.dataKey === 'net') && (
            <div
              className="mt-1.5 pt-1.5"
              style={{
                borderTop: `1px solid ${isLightTheme ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <p style={{ color: textSecondary, fontSize: '10px' }}>
                Daily Balance:{' '}
                {formatCurrency(payload.find((p: any) => p.dataKey === 'net')?.value || 0)}
              </p>
            </div>
          )}
        </div>
      )
    }
    return null
  }

  // Memoize gradient IDs to prevent recreation
  const [inflowGradientId] = useState(`inflowGradient-${Math.random().toString(36).substr(2, 9)}`)
  const [outflowGradientId] = useState(`outflowGradient-${Math.random().toString(36).substr(2, 9)}`)

  // Sort data chronologically before processing - FIX: ensure dates are in ascending order
  const sortedData = useMemo(() => {
    if (!hasData) return []
    return [...data].sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateA - dateB // Ascending order (oldest to newest)
    })
  }, [data, hasData])

  // Memoize summary statistics
  const summaryStats = useMemo(() => {
    const totalInflow = sortedData.reduce((sum, day) => sum + day.inflow, 0)
    const totalOutflow = sortedData.reduce((sum, day) => sum + day.outflow, 0)
    const netFlow = totalInflow - totalOutflow
    const avgDailyInflow = totalInflow / (sortedData.length || 1)
    const avgDailyOutflow = totalOutflow / (sortedData.length || 1)

    const stats = {
      totalInflow,
      totalOutflow,
      netFlow,
      avgDailyNet: avgDailyInflow - avgDailyOutflow,
    }

    logger.debug('Summary stats calculated', {
      component: 'DailyCashFlowChart',
      stats,
      dataLength: sortedData.length,
    })

    return stats
  }, [sortedData])

  // Memoize chart configuration
  const chartMargin = useMemo(() => ({ top: 5, right: 20, left: 0, bottom: 50 }), [])

  if (isLoading || (!hasData && isLoading !== false)) {
    return (
      <div className="w-full relative overflow-hidden rounded-lg" style={{ height }}>
        <span className="absolute inset-0 shimmer-bg-10" />
        <span className="absolute inset-0 shimmer-gradient-light animate-shimmer-fast" />
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height }}>
        <div className="text-center">
          <p className="theme-text-secondary text-sm">No cash flow data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="px-2" style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sortedData} margin={chartMargin}>
            <defs>
              {/* Inflow gradient */}
              <linearGradient id={inflowGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>

              {/* Outflow gradient */}
              <linearGradient id={outflowGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148, 163, 184, 0.1)"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              stroke="rgba(148, 163, 184, 0.6)"
              fontSize={10}
              fontWeight={500}
              tickLine={false}
              interval={4}
              axisLine={false}
              tickFormatter={formatDateLabel}
              angle={-45}
              textAnchor="end"
              height={60}
            />

            <YAxis
              stroke="rgba(148, 163, 184, 0.6)"
              fontSize={11}
              fontWeight={500}
              tickFormatter={formatCurrency}
              tickLine={false}
              axisLine={false}
              width={80}
            />

            <Tooltip
              content={<CustomTooltip />}
              wrapperStyle={{
                pointerEvents: 'none',
                zIndex: 1000,
              }}
              position={{ y: 0 }}
              allowEscapeViewBox={{ x: false, y: false }}
              cursor={{ strokeDasharray: '3 3' }}
              isAnimationActive={false}
            />

            <Legend
              iconType="circle"
              wrapperStyle={{
                paddingTop: '4px',
                fontSize: '12px',
                fontWeight: '500',
              }}
              formatter={(value) => (
                <span className="theme-text-secondary">
                  {value === 'inflow' ? 'Money In' : value === 'outflow' ? 'Money Out' : 'Net Flow'}
                </span>
              )}
            />

            {/* Zero line reference */}
            <ReferenceLine y={0} stroke="rgba(148, 163, 184, 0.3)" strokeDasharray="2 2" />

            {/* Areas */}
            <Area
              type="monotone"
              dataKey="inflow"
              stroke="#10b981"
              strokeWidth={2}
              fill={`url(#${inflowGradientId})`}
              name="inflow"
            />

            <Area
              type="monotone"
              dataKey="outflow"
              stroke="#ef4444"
              strokeWidth={2}
              fill={`url(#${outflowGradientId})`}
              name="outflow"
            />

            <Area
              type="monotone"
              dataKey="net"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="none"
              strokeDasharray="4 4"
              name="net"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Summary statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-1 pt-2 border-t border-amber-500/10">
        <div className="text-center">
          <div className="text-xs theme-text-secondary mb-1">30-Day Inflow</div>
          <div className="text-sm font-bold text-emerald-400">
            {formatCurrencyPrecise(summaryStats.totalInflow)}
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs theme-text-secondary mb-1">30-Day Outflow</div>
          <div className="text-sm font-bold text-red-400">
            {formatCurrencyPrecise(summaryStats.totalOutflow)}
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs theme-text-secondary mb-1">Net Flow</div>
          <div
            className={`text-sm font-bold ${summaryStats.netFlow >= 0 ? 'text-emerald-400' : 'text-red-400'} flex items-center justify-center space-x-1`}
          >
            <span>{formatCurrencyPrecise(summaryStats.netFlow)}</span>
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs theme-text-secondary mb-1">Avg Daily Net</div>
          <div
            className={`text-sm font-bold ${summaryStats.avgDailyNet >= 0 ? 'text-emerald-400' : 'text-red-400'} flex items-center justify-center space-x-1`}
          >
            <span>{formatCurrencyPrecise(summaryStats.avgDailyNet)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
