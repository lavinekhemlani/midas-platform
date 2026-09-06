'use client'

import { useMemo } from 'react'
import { useChartThemeColors } from '@/components/charts/useChartThemeColors'
import { cn } from '@/lib/utils'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  LabelList,
} from 'recharts'
import PieChart from '@/components/charts/PieChart'
import { useTheme } from '@/hooks/useTheme'

export type ChartType =
  | 'line'
  | 'bar'
  | 'area'
  | 'pie'
  | 'stacked-bar'
  | 'multi-line'
  | 'waterfall'
  | 'diverging-bar'
  | 'bar-line'
  | 'combo'

interface ReferenceLineConfig {
  y?: number
  x?: number
  label?: string
  color?: string
  strokeDasharray?: string
}

interface ReportChartProps {
  data: any[]
  type: ChartType
  dataKeys: string[] | { key: string; color?: string; name?: string; isLine?: boolean }[]
  xKey?: string
  height?: number
  className?: string
  colors?: string[]
  showGrid?: boolean
  showLegend?: boolean
  showTooltip?: boolean
  formatTooltip?: (value: any) => string
  formatAxis?: (value: any) => string
  orientation?: 'horizontal' | 'vertical'
  customColors?: string[]
  stacked?: boolean
  referenceLines?: ReferenceLineConfig[]
}

// Factory function for theme-aware default colors
function getDefaultColors(isLightTheme: boolean) {
  const themeRed = isLightTheme ? '#D51323' : '#EE3D4C'
  return [
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    isLightTheme ? '#0D54A8' : '#66A7F3', // theme-aware blue
    themeRed, // theme-aware red
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#84cc16', // lime-500
  ]
}

// Format axis values with $K/$M abbreviations
function formatAxisCompact(value: number): string {
  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (absValue >= 1_000_000) {
    return `${sign}$${(absValue / 1_000_000).toFixed(absValue % 1_000_000 === 0 ? 0 : 1)}M`
  }
  if (absValue >= 1_000) {
    return `${sign}$${Math.round(absValue / 1_000)}K`
  }
  if (absValue === 0) {
    return '$0'
  }
  return `${sign}$${Math.round(absValue)}`
}

// Strip year from month labels (e.g., "Jan 2025" -> "Jan")
function formatMonthLabel(value: string): string {
  if (typeof value === 'string' && value.includes(' ')) {
    return value.split(' ')[0]
  }
  return value
}

export function ReportChart({
  data,
  type,
  dataKeys,
  xKey = 'name',
  height = 300,
  className,
  colors: propColors,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  formatTooltip,
  formatAxis,
  orientation = 'vertical',
  customColors,
  stacked = false,
  referenceLines = [],
}: ReportChartProps) {
  const { theme } = useTheme()
  const isLightTheme = theme === 'light'

  // Get theme-aware default colors
  const defaultColors = useMemo(() => getDefaultColors(isLightTheme), [isLightTheme])
  const colors = propColors || defaultColors

  // Get theme-reactive colors for tooltips
  const chartColors = useChartThemeColors()
  const tooltipBg = chartColors.tooltipBg
  const tooltipBorder = chartColors.tooltipBorder
  const tooltipTextPrimary = chartColors.tooltipText
  const tooltipTextSecondary = chartColors.textColor
  const axisTextColor = chartColors.textColor

  const processedKeys = useMemo(() => {
    return dataKeys.map((key, index) => {
      if (typeof key === 'string') {
        return {
          key,
          color: colors[index % colors.length],
          name: key,
          isLine: false,
        }
      }
      return {
        ...key,
        color: key.color || colors[index % colors.length],
        isLine: key.isLine || false,
      }
    })
  }, [dataKeys, colors])

  const customTooltip = useMemo(
    () =>
      showTooltip
        ? {
            content: ({ active, payload, label }: any) => {
              if (!active || !payload) return null

              return (
                <div
                  className="rounded-lg p-3 shadow-xl"
                  style={{
                    backgroundColor: tooltipBg,
                    border: 'none',
                  }}
                >
                  <p className="text-sm font-medium mb-2" style={{ color: tooltipTextPrimary }}>
                    {label}
                  </p>
                  {payload.map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-4">
                      <span className="text-xs" style={{ color: tooltipTextSecondary }}>
                        {item.name}:
                      </span>
                      <span className="text-xs font-medium" style={{ color: item.color }}>
                        {formatTooltip ? formatTooltip(item.value) : item.value}
                      </span>
                    </div>
                  ))}
                </div>
              )
            },
          }
        : undefined,
    [showTooltip, tooltipBg, tooltipBorder, tooltipTextPrimary, tooltipTextSecondary, formatTooltip]
  )

  const axisProps = {
    stroke: '#9ca3af', // Made more solid (lighter gray)
    strokeWidth: 2, // Thicker axis line
    style: { fontSize: 11, fill: axisTextColor }, // Theme-reactive axis text color
    tickFormatter: formatAxis,
  }

  const gridProps = showGrid
    ? {
        stroke: '#374151',
        strokeDasharray: '3 3',
        opacity: 0.3,
      }
    : { stroke: 'transparent' }

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} />
            {customTooltip && <Tooltip {...customTooltip} />}
            {showLegend && <Legend />}
            {referenceLines.map((refLine, index) => (
              <ReferenceLine
                key={`ref-${index}`}
                y={refLine.y}
                x={refLine.x}
                stroke={refLine.color || '#666'}
                strokeDasharray={refLine.strokeDasharray || '3 3'}
                strokeWidth={1}
                label={
                  refLine.label
                    ? {
                        value: refLine.label,
                        position: 'right',
                        fill: refLine.color || '#666',
                        fontSize: 10,
                      }
                    : undefined
                }
              />
            ))}
            {processedKeys.map((item) => (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                stroke={item.color}
                name={item.name}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        )

      case 'bar':
        return (
          <BarChart data={data} layout={orientation === 'horizontal' ? 'horizontal' : 'vertical'}>
            <CartesianGrid {...gridProps} />
            {orientation === 'horizontal' ? (
              <>
                <XAxis type="number" {...axisProps} />
                <YAxis dataKey={xKey} type="category" {...axisProps} />
              </>
            ) : (
              <>
                <XAxis dataKey={xKey} {...axisProps} />
                <YAxis {...axisProps} />
              </>
            )}
            {customTooltip && <Tooltip {...customTooltip} />}
            {showLegend && <Legend />}
            {processedKeys.map((item) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                fill={item.color}
                name={item.name}
                stackId={stacked ? 'stack' : undefined}
              >
                {customColors &&
                  data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={customColors[index]} />
                  ))}
              </Bar>
            ))}
          </BarChart>
        )

      case 'area':
        return (
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} />
            {customTooltip && <Tooltip {...customTooltip} />}
            {showLegend && <Legend wrapperStyle={{ fontSize: '13px' }} />}
            {processedKeys.map((item) => {
              // Check if this key should be rendered as a line (for totalCash)
              const isLine =
                item.name?.toLowerCase().includes('total cash') || item.key === 'totalCash'

              if (isLine) {
                // Render as a line for Total Cash
                return (
                  <Line
                    key={item.key}
                    type="monotone"
                    dataKey={item.key}
                    stroke={item.color}
                    strokeWidth={3}
                    dot={false}
                    name={item.name}
                  />
                )
              } else {
                // Render as area for cash flow activities
                return (
                  <Area
                    key={item.key}
                    type="monotone"
                    dataKey={item.key}
                    stroke={item.color}
                    strokeWidth={2}
                    fill={item.color}
                    fillOpacity={0.2}
                    name={item.name}
                  />
                )
              }
            })}
          </AreaChart>
        )

      case 'pie':
        const pieData = data.map((item) => ({
          name: item[xKey],
          value: item[processedKeys[0].key],
          ...item, // Include all other properties for custom tooltips
        }))

        // Custom tooltip formatter that uses the provided formatTooltip function
        const pieTooltipFormatter = formatTooltip
          ? (value: number, item: any) => {
              return (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-semibold theme-text-primary text-sm">{item.name}</span>
                    <span className="font-bold text-emerald-400 text-sm">
                      {formatTooltip(value)}
                    </span>
                  </div>
                </div>
              )
            }
          : undefined

        return (
          <PieChart
            data={pieData}
            height={height}
            colors={colors}
            showActiveShape={true}
            showTooltip={showTooltip}
            showLegend={false}
            formatTooltip={pieTooltipFormatter}
            formatLabel={formatTooltip}
            dataKey="value"
            nameKey="name"
            innerRadius={0}
            outerRadius={80}
          />
        )

      case 'waterfall':
        // Get the data key to use
        const waterfallKey = processedKeys[0]?.key || 'value'

        // Prepare data for waterfall chart - simplified with single value
        const waterfallData = data
          .map((item) => {
            const currentValue = item[waterfallKey] || 0
            return {
              ...item,
              name: item.name || item[xKey],
              [waterfallKey]: currentValue,
              displayValue: currentValue,
              fillColor: currentValue < 0 ? (isLightTheme ? '#D51323' : '#EE3D4C') : '#10b981',
            }
          })
          .filter((item) => item[waterfallKey] !== 0) // Filter out zero values

        return (
          <BarChart
            data={waterfallData}
            layout="horizontal"
            margin={{ top: 20, right: 80, left: 120, bottom: 20 }}
          >
            <CartesianGrid {...gridProps} />
            <XAxis type="number" {...axisProps} />
            <YAxis dataKey="name" type="category" {...axisProps} width={100} />
            {customTooltip && <Tooltip {...customTooltip} />}
            <ReferenceLine x={0} stroke="#666" strokeWidth={2} />

            {/* Single bar with color based on value sign */}
            <Bar dataKey={waterfallKey} fill="#10b981" minPointSize={5}>
              {waterfallData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fillColor} />
              ))}
              {formatTooltip && (
                <LabelList
                  dataKey={waterfallKey}
                  position="right"
                  formatter={formatTooltip}
                  style={{ fill: '#9ca3af', fontSize: '11px' }}
                />
              )}
            </Bar>
          </BarChart>
        )

      case 'diverging-bar':
        // Get the data key to use
        const divergingKey = processedKeys[0]?.key || 'value'

        // Prepare data for diverging bar chart - simplified with single value
        const divergingData = data
          .map((item) => ({
            ...item,
            name: item.name || item[xKey],
            [divergingKey]: item[divergingKey] || 0,
            fillColor:
              (item[divergingKey] || 0) < 0 ? (isLightTheme ? '#D51323' : '#EE3D4C') : '#10b981',
          }))
          .filter((item) => item[divergingKey] !== 0) // Filter out zero values

        return (
          <BarChart
            data={divergingData}
            layout="horizontal"
            margin={{ top: 20, right: 80, left: 120, bottom: 20 }}
          >
            <CartesianGrid {...gridProps} />
            <XAxis type="number" {...axisProps} domain={['auto', 'auto']} />
            <YAxis dataKey="name" type="category" {...axisProps} width={100} />
            {customTooltip && <Tooltip {...customTooltip} />}
            <ReferenceLine x={0} stroke="#666" strokeWidth={2} />

            {/* Single bar with color based on value sign */}
            <Bar dataKey={divergingKey} fill="#10b981" minPointSize={5}>
              {divergingData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fillColor} />
              ))}
              {formatTooltip && (
                <LabelList
                  dataKey={divergingKey}
                  position="right"
                  formatter={formatTooltip}
                  style={{ fill: '#9ca3af', fontSize: '11px' }}
                />
              )}
            </Bar>
          </BarChart>
        )

      case 'combo':
        // Combo chart with grouped bars and line overlay
        // This handles positive and negative values better than stacking
        const comboBarKeys = processedKeys.filter((k) => !k.isLine)
        const comboLineKeys = processedKeys.filter((k) => k.isLine)

        return (
          <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 25 }}>
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey={xKey}
              {...axisProps}
              axisLine={{ stroke: '#94a3b8', strokeWidth: 2 }}
              tick={{ fill: axisTextColor, fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={50}
            />
            <YAxis {...axisProps} tick={{ fill: axisTextColor, fontSize: 10 }} />
            <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} />{' '}
            {/* Solid but thinner zero line */}
            {customTooltip && <Tooltip {...customTooltip} />}
            {showLegend && <Legend wrapperStyle={{ fontSize: '11px' }} />}
            {/* Render grouped bars (not stacked) for cash flow activities */}
            {comboBarKeys.map((item, index) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                fill={item.color}
                name={item.name}
                // Position bars side by side instead of stacking
                maxBarSize={20}
              />
            ))}
            {/* Render line for total cash */}
            {comboLineKeys.map((item) => (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                stroke={item.color}
                strokeWidth={3}
                dot={false}
                name={item.name}
              />
            ))}
          </ComposedChart>
        )

      case 'bar-line':
        // Stacked bar chart with line overlay using stackOffset="sign" for waterfall effect
        const barKeys = processedKeys.filter((k) => !k.isLine)
        const lineKeys = processedKeys.filter((k) => k.isLine)

        return (
          <ComposedChart
            data={data}
            stackOffset="sign" // Automatically handles positive/negative stacking
            margin={{ top: 5, right: 5, left: 0, bottom: 25 }}
          >
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey={xKey}
              {...axisProps}
              axisLine={{ stroke: '#94a3b8', strokeWidth: 2 }}
              tick={{ fill: axisTextColor, fontSize: 10 }}
              tickFormatter={formatMonthLabel}
              angle={-45}
              textAnchor="end"
              height={50}
            />
            <YAxis
              {...axisProps}
              tick={{ fill: axisTextColor, fontSize: 10 }}
              tickFormatter={formatAxisCompact}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} />{' '}
            {/* Solid but thinner zero line */}
            {customTooltip && <Tooltip {...customTooltip} />}
            {showLegend && <Legend wrapperStyle={{ fontSize: '11px' }} />}
            {/* Stacked bars - stackOffset="sign" separates pos/neg values */}
            {barKeys.map((item) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                stackId="a" // Single stack ID, stackOffset handles the rest
                fill={item.color}
                name={item.name}
              />
            ))}
            {/* Render line for total cash */}
            {lineKeys.map((item) => (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                stroke={item.color}
                strokeWidth={3}
                dot={false}
                name={item.name}
              />
            ))}
          </ComposedChart>
        )

      default:
        return <div />
    }
  }

  const chart = renderChart()
  if (!chart) return null

  return (
    <div className={cn('w-full overflow-visible', className)}>
      <ResponsiveContainer width="100%" height={height}>
        {chart}
      </ResponsiveContainer>
    </div>
  )
}
