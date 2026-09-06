'use client'

import React, { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  LabelList,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'

interface WaterfallDataPoint {
  name: string
  value: number
  type: 'initial' | 'positive' | 'negative' | 'final'
  fill?: string
  cumulative?: number
}

interface CashFlowWaterfallProps {
  data: WaterfallDataPoint[]
  currency?: string
  height?: number
  className?: string
  showLabels?: boolean
}

export default function CashFlowWaterfall({
  data,
  currency = 'USD',
  height = 400,
  className,
  showLabels = true,
}: CashFlowWaterfallProps) {
  const { theme } = useTheme()
  const isLightTheme = theme === 'light'

  // Theme-aware colors
  const initialBlue = isLightTheme ? '#0D54A8' : '#66A7F3'
  const themeRed = isLightTheme ? '#D51323' : '#EE3D4C'

  // Process data to calculate cumulative values for waterfall effect
  const processedData = useMemo(
    () =>
      data.map((item, index) => {
        let cumulative = 0
        let previousCumulative = 0

        if (index === 0) {
          cumulative = item.value
        } else {
          // Calculate cumulative based on previous items
          for (let i = 0; i < index; i++) {
            previousCumulative += data[i].value
          }
          cumulative = previousCumulative + item.value
        }

        // For waterfall chart, we need to show the starting point and height
        const barValue =
          item.type === 'initial' || item.type === 'final' ? item.value : Math.abs(item.value)

        const barBase =
          item.type === 'initial'
            ? 0
            : item.type === 'final'
              ? 0
              : item.type === 'positive'
                ? previousCumulative
                : cumulative

        return {
          ...item,
          cumulative,
          previousCumulative,
          barValue,
          barBase,
          displayValue: item.value,
          fill:
            item.type === 'initial'
              ? initialBlue
              : item.type === 'positive'
                ? '#10b981'
                : item.type === 'negative'
                  ? themeRed
                  : '#a855f7',
        }
      }),
    [data, initialBlue, themeRed]
  )

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
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
            {data.name}
          </p>
          <div className="flex items-center justify-between gap-4">
            <span style={{ color: isLightTheme ? '#6b7280' : '#9ca3af' }}>Amount:</span>
            <span
              className="font-semibold"
              style={{
                color:
                  data.type === 'positive'
                    ? '#10b981'
                    : data.type === 'negative'
                      ? isLightTheme
                        ? '#D51323'
                        : '#EE3D4C'
                      : isLightTheme
                        ? '#1f2937'
                        : '#f3f4f6',
              }}
            >
              {data.type === 'negative' ? '-' : ''}
              {formatCompactCurrency(Math.abs(data.displayValue), currency)}
            </span>
          </div>
          {data.type !== 'initial' && (
            <div className="flex items-center justify-between gap-4 mt-1">
              <span style={{ color: isLightTheme ? '#6b7280' : '#9ca3af' }}>Total:</span>
              <span
                className="font-semibold"
                style={{ color: isLightTheme ? '#1f2937' : '#f3f4f6' }}
              >
                {formatCompactCurrency(data.cumulative, currency)}
              </span>
            </div>
          )}
        </div>
      )
    }
    return null
  }

  // Custom label to show values on bars
  const renderCustomLabel = (props: any) => {
    const { x, y, width, height, value, payload } = props
    if (!showLabels || !payload || !payload.type || value === undefined) return null

    const isNegative = payload.type === 'negative'
    const yPos = isNegative ? y + height + 15 : y - 5

    return (
      <text
        x={x + width / 2}
        y={yPos}
        fill={isNegative ? themeRed : '#10b981'}
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
      >
        {isNegative ? '-' : '+'}
        {formatCompactCurrency(Math.abs(value), currency)}
      </text>
    )
  }

  // Calculate summary metrics
  const totalInflow = processedData
    .filter((d) => d.type === 'positive')
    .reduce((sum, d) => sum + d.value, 0)

  const totalOutflow = Math.abs(
    processedData.filter((d) => d.type === 'negative').reduce((sum, d) => sum + d.value, 0)
  )

  const netChange = totalInflow - totalOutflow

  return (
    <Card className={cn('glass-luxury-card gap-0', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-purple-500" />
            Cash Flow Waterfall
          </span>
          <span
            className={cn(
              'text-sm font-medium flex items-center gap-1',
              netChange >= 0 ? 'text-emerald-400' : 'text-theme-red'
            )}
          >
            {netChange >= 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            {formatCompactCurrency(netChange, currency)}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(55 65 81 / 0.3)" vertical={false} />

            <XAxis
              dataKey="name"
              stroke="rgb(156 163 175 / 0.5)"
              tick={{ fill: 'rgb(156 163 175 / 0.8)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              angle={-45}
              textAnchor="end"
              height={80}
            />

            <YAxis
              stroke="rgb(156 163 175 / 0.5)"
              tick={{ fill: 'rgb(156 163 175 / 0.8)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCompactCurrency(value, currency)}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgb(55 65 81 / 0.1)' }} />

            {/* Reference line at zero */}
            <ReferenceLine y={0} stroke="rgb(156 163 175 / 0.3)" />

            {/* Connector lines between bars */}
            {processedData.map((item, index) => {
              if (index === 0 || item.type === 'final') return null

              const prevItem = processedData[index - 1]
              const startY = prevItem.cumulative
              const endY = item.cumulative

              return (
                <ReferenceLine
                  key={`connector-${index}`}
                  segment={[
                    { x: prevItem.name, y: startY },
                    { x: item.name, y: item.type === 'positive' ? startY : endY },
                  ]}
                  stroke="rgb(156 163 175 / 0.3)"
                  strokeDasharray="2 2"
                />
              )
            })}

            <Bar dataKey="barValue" radius={[4, 4, 0, 0]}>
              <LabelList content={renderCustomLabel} />
              {processedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>

            {/* Stacked bars for waterfall effect */}
            <Bar dataKey="barBase" stackId="stack" fill="transparent" />
          </BarChart>
        </ResponsiveContainer>

        {/* Summary Statistics */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs theme-text-secondary">Total Inflow</span>
              <TrendingUp className="w-3 h-3 text-emerald-400" />
            </div>
            <p className="text-lg font-bold text-emerald-400">
              {formatCompactCurrency(totalInflow, currency)}
            </p>
          </div>

          <div className="p-3 bg-theme-red/10 rounded-lg border border-theme-red/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs theme-text-secondary">Total Outflow</span>
              <TrendingDown className="w-3 h-3 text-theme-red" />
            </div>
            <p className="text-lg font-bold text-theme-red">
              {formatCompactCurrency(totalOutflow, currency)}
            </p>
          </div>

          <div
            className={cn(
              'p-3 rounded-lg border',
              netChange >= 0
                ? 'bg-purple-500/10 border-purple-500/20'
                : 'bg-orange-500/10 border-orange-500/20'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs theme-text-secondary">Net Change</span>
              {netChange >= 0 ? (
                <TrendingUp className="w-3 h-3 text-purple-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-orange-400" />
              )}
            </div>
            <p
              className={cn(
                'text-lg font-bold',
                netChange >= 0 ? 'text-purple-400' : 'text-orange-400'
              )}
            >
              {formatCompactCurrency(netChange, currency)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
