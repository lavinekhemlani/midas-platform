'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useTheme } from '@/hooks/useTheme'
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Sector,
  Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { processPieChartData } from '@/lib/utils/chartUtils'

export interface PieChartDataItem {
  name: string
  value: number
  percentage?: number
  [key: string]: any // Allow additional custom properties
}

interface PieChartProps {
  data: PieChartDataItem[]
  height?: number
  innerRadius?: number
  outerRadius?: number
  activeIndex?: number
  onActiveIndexChange?: (index: number | undefined) => void
  colors?: string[]
  showActiveShape?: boolean
  showTooltip?: boolean
  showLegend?: boolean
  legendPosition?: 'bottom' | 'right' | 'left'
  formatTooltip?: (value: number, item: PieChartDataItem) => React.ReactNode
  formatLabel?: (value: number) => string
  className?: string
  centerLabel?: React.ReactNode
  dataKey?: string
  nameKey?: string
  paddingAngle?: number
  startAngle?: number
  endAngle?: number
  cx?: string | number
  cy?: string | number
  // New props for sorting and grouping
  enableSorting?: boolean
  enableGrouping?: boolean
  maxItems?: number
  minPercentage?: number
  othersLabel?: string
}

const DEFAULT_COLORS = [
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

export default function PieChart({
  data,
  height = 300,
  innerRadius = 60,
  outerRadius = 100,
  activeIndex: controlledActiveIndex,
  onActiveIndexChange,
  colors = DEFAULT_COLORS,
  showActiveShape = true,
  showTooltip = true,
  showLegend = true,
  legendPosition = 'bottom',
  formatTooltip,
  formatLabel,
  className,
  centerLabel,
  dataKey = 'value',
  nameKey = 'name',
  paddingAngle = 0,
  startAngle = 90,
  endAngle = -270,
  cx = '50%',
  cy = '50%',
  enableSorting = true,
  enableGrouping = true,
  maxItems = 8,
  minPercentage = 2,
  othersLabel = 'Others',
}: PieChartProps) {
  const { theme } = useTheme()
  const isLightTheme = theme === 'light'
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)

  // Measure container width and update on resize
  useEffect(() => {
    if (!containerRef.current) return

    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    // Initial measurement
    updateWidth()

    // Create ResizeObserver to watch for container size changes
    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  // Determine if we should use left or bottom legend based on available width
  // Switch to bottom legend earlier (at 600px) for better responsiveness when chat panel is open
  const shouldUseBottomLegend =
    legendPosition === 'left' && containerWidth > 0 && containerWidth < 600

  // Process data: sort and group if enabled
  const processedData = useMemo(() => {
    if (!enableSorting && !enableGrouping) {
      return data
    }

    return processPieChartData(data, {
      maxItems: enableGrouping ? maxItems : 999,
      minPercentage: enableGrouping ? minPercentage : 0,
      sortOrder: enableSorting ? 'desc' : 'asc',
      othersLabel,
      valueKey: dataKey,
      nameKey,
    })
  }, [data, enableSorting, enableGrouping, maxItems, minPercentage, othersLabel, dataKey, nameKey])

  // Find the index of the largest slice
  const largestSliceIndex = useMemo(() => {
    if (!processedData || processedData.length === 0) return 0
    let maxIndex = 0
    let maxValue = processedData[0]?.[dataKey] || 0

    processedData.forEach((item, index) => {
      const value = item[dataKey]
      if (value > maxValue) {
        maxValue = value
        maxIndex = index
      }
    })

    return maxIndex
  }, [processedData, dataKey])

  const [internalActiveIndex, setInternalActiveIndex] = useState<number | undefined>(
    largestSliceIndex
  )

  // Use controlled activeIndex if provided, otherwise use internal state
  const activeIndex =
    controlledActiveIndex !== undefined ? controlledActiveIndex : internalActiveIndex
  const setActiveIndex = onActiveIndexChange || setInternalActiveIndex

  // Theme-aware text colors
  const getTextColor = () => {
    switch (theme) {
      case 'light':
        return '#1e293b' // Dark text for light theme
      case 'dark':
      case 'dark':
        return '#ffffff' // White text for dark themes
      default:
        return '#ffffff'
    }
  }

  const getSecondaryTextColor = () => {
    switch (theme) {
      case 'light':
        return '#64748b' // Gray text for light theme
      case 'dark':
      case 'dark':
        return 'rgba(255,255,255,0.7)' // Semi-transparent white for dark themes
      default:
        return 'rgba(255,255,255,0.7)'
    }
  }

  // Custom active shape renderer
  const renderActiveShape = (props: any) => {
    const {
      cx,
      cy,
      midAngle,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      fill,
      payload,
      percent,
      value,
    } = props
    const RADIAN = Math.PI / 180
    const sin = Math.sin(-RADIAN * midAngle)
    const cos = Math.cos(-RADIAN * midAngle)
    const sx = cx + (outerRadius + 10) * cos
    const sy = cy + (outerRadius + 10) * sin
    const mx = cx + (outerRadius + 30) * cos
    const my = cy + (outerRadius + 30) * sin
    const ex = mx + (cos >= 0 ? 1 : -1) * 22
    const ey = my
    const textAnchor = cos >= 0 ? 'start' : 'end'

    const formatPercentage = (value: number) => {
      if (value === undefined || value === null || isNaN(value)) {
        return '0.0%'
      }
      return `${value.toFixed(1)}%`
    }

    return (
      <g>
        {/* Centered percentage inside pie chart with segment color */}
        {!centerLabel && (
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={fill}
            className="text-2xl font-bold"
          >
            {formatPercentage(percent)}
          </text>
        )}
        {centerLabel && (
          <foreignObject x={cx - 60} y={cy - 30} width={120} height={60}>
            <div className="flex items-center justify-center h-full">{centerLabel}</div>
          </foreignObject>
        )}
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 6}
          outerRadius={outerRadius + 10}
          fill={fill}
        />
        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
        <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
        {/* Label text with dynamic sizing based on length */}
        <text
          x={ex + (cos >= 0 ? 1 : -1) * 12}
          y={ey}
          dy={-8}
          textAnchor={textAnchor}
          fill={getTextColor()}
          className={
            payload[nameKey].length > 20 ? 'text-xs font-semibold' : 'text-sm font-semibold'
          }
        >
          {payload[nameKey]}
        </text>
        {/* Larger value text with gray for hierarchy */}
        <text
          x={ex + (cos >= 0 ? 1 : -1) * 12}
          y={ey}
          dy={18}
          textAnchor={textAnchor}
          fill={getSecondaryTextColor()}
          className="text-lg font-semibold"
          opacity={0.7}
        >
          {formatLabel ? formatLabel(value) : value}
        </text>
      </g>
    )
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      const value = item[dataKey]

      const tooltipBaseStyle = {
        backgroundColor: isLightTheme ? 'rgba(255,255,255,0.95)' : 'rgba(30,30,35,0.95)',
        color: isLightTheme ? '#1f2937' : '#f3f4f6',
        border: `1px solid ${isLightTheme ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
      }
      const textPrimary = isLightTheme ? '#1f2937' : '#f3f4f6'
      const textSecondary = isLightTheme ? '#6b7280' : '#9ca3af'

      if (formatTooltip) {
        return (
          <div
            className="pointer-events-none px-3 py-2 rounded shadow-lg text-xs"
            style={tooltipBaseStyle}
          >
            {formatTooltip(value, item)}
          </div>
        )
      }

      // Handle "Others" group with special tooltip
      if (item.isOthersGroup && item.groupedItems) {
        const formattedValue = formatLabel ? formatLabel(value) : value
        return (
          <div
            className="pointer-events-none px-3 py-2 rounded shadow-lg text-xs max-w-xs"
            style={tooltipBaseStyle}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-4">
                <p className="font-semibold" style={{ color: textPrimary }}>
                  {item[nameKey]}
                </p>
                <p className="font-semibold" style={{ color: '#10b981' }}>
                  {formattedValue}
                </p>
              </div>
              {item.percentage !== undefined && (
                <div className="flex items-center justify-between">
                  <span style={{ color: textSecondary }}>Percentage</span>
                  <span className="font-semibold" style={{ color: textPrimary }}>
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
              )}
              <div
                className="mt-1.5 pt-1.5"
                style={{
                  borderTop: `1px solid ${isLightTheme ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <div className="font-semibold mb-1" style={{ color: textPrimary }}>
                  Includes:
                </div>
                {item.groupedItems.slice(0, 5).map((grouped: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex justify-between gap-2"
                    style={{ color: textSecondary }}
                  >
                    <span>{grouped.name}</span>
                    <span>
                      {formatLabel ? formatLabel(grouped.value) : grouped.value} (
                      {grouped.percentage?.toFixed(1)}%)
                    </span>
                  </div>
                ))}
                {item.groupedItems.length > 5 && (
                  <div className="mt-1 italic" style={{ color: textSecondary }}>
                    ...and {item.groupedItems.length - 5} more
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      return (
        <div
          className="pointer-events-none px-3 py-2 rounded shadow-lg text-xs"
          style={tooltipBaseStyle}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <p className="font-semibold" style={{ color: textPrimary }}>
                {item[nameKey]}
              </p>
              <p className="font-semibold" style={{ color: '#10b981' }}>
                {formatLabel ? formatLabel(value) : value}
              </p>
            </div>
            {item.percentage !== undefined && (
              <div className="flex items-center justify-between">
                <span style={{ color: textSecondary }}>Percentage</span>
                <span className="font-semibold" style={{ color: textPrimary }}>
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  // Custom legend formatter
  const legendFormatter = (value: string) => (
    <span className="text-xs theme-text-secondary">{value}</span>
  )

  // Custom legend content for left position with values
  const CustomLegend = ({ payload }: any) => {
    if (!payload || payload.length === 0) return null

    return (
      <div className="flex flex-col gap-1.5 py-2">
        {payload.map((entry: any, index: number) => {
          const item = processedData[index]
          const value = item ? item[dataKey] : entry.value
          const formattedValue = formatLabel ? formatLabel(value) : value

          return (
            <div
              key={`legend-item-${index}`}
              className="flex items-center justify-between gap-3 text-sm hover:opacity-75 transition-opacity cursor-pointer"
              onMouseEnter={() => showActiveShape && setActiveIndex(index)}
              onMouseLeave={() => showActiveShape && setActiveIndex(largestSliceIndex)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="theme-text-primary text-xs leading-tight">{entry.value}</span>
              </div>
              <span className="font-medium theme-text-primary flex-shrink-0 text-xs opacity-70">
                {formattedValue}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  // For left legend, we need to restructure the layout with responsive behavior
  if (showLegend && legendPosition === 'left') {
    // Use responsive chart width - shrinks with container
    const chartWidth = Math.min(
      typeof height === 'number' ? height * 2 : 500,
      containerWidth > 0 ? containerWidth - 220 : 500 // Leave space for legend
    )

    // If container is too narrow, use bottom legend instead
    if (shouldUseBottomLegend) {
      return (
        <div ref={containerRef} className={cn('w-full', className)}>
          <div style={{ height }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <defs>
                  {colors.map((color, index) => (
                    <radialGradient key={`gradient-${index}`} id={`pieGradient-${index}`}>
                      <stop offset="0%" stopColor={color} stopOpacity={0.6} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.9} />
                    </radialGradient>
                  ))}
                </defs>
                <Pie
                  activeIndex={showActiveShape ? activeIndex : undefined}
                  activeShape={showActiveShape ? renderActiveShape : undefined}
                  data={processedData}
                  cx={cx}
                  cy={cy}
                  innerRadius={innerRadius}
                  outerRadius={outerRadius}
                  paddingAngle={paddingAngle}
                  dataKey={dataKey}
                  nameKey={nameKey}
                  startAngle={startAngle}
                  endAngle={endAngle}
                  stroke="rgba(148, 163, 184, 0.2)"
                  onMouseEnter={showActiveShape ? (_, index) => setActiveIndex(index) : undefined}
                  onMouseLeave={
                    showActiveShape ? () => setActiveIndex(largestSliceIndex) : undefined
                  }
                >
                  {processedData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={colors[index % colors.length]}
                      stroke="none"
                    />
                  ))}
                </Pie>
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
          {/* Bottom legend with values in rows */}
          <div className="mt-1 pb-6 flex flex-wrap justify-center gap-x-4 gap-y-1.5 px-2">
            {processedData.map((item, index) => {
              const value = item[dataKey]
              const formattedValue = formatLabel ? formatLabel(value) : value
              return (
                <div
                  key={`bottom-legend-${index}`}
                  className="flex items-center gap-1.5 cursor-pointer hover:opacity-75 transition-opacity"
                  onMouseEnter={() => showActiveShape && setActiveIndex(index)}
                  onMouseLeave={() => showActiveShape && setActiveIndex(largestSliceIndex)}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: colors[index % colors.length] }}
                  />
                  <span className="theme-text-primary text-xs whitespace-nowrap">
                    {item[nameKey]}
                  </span>
                  <span className="font-medium theme-text-primary text-xs opacity-70 whitespace-nowrap">
                    {formattedValue}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    // Wide enough for left legend layout
    return (
      <div ref={containerRef} className={cn('w-full overflow-visible', className)}>
        <div
          className="flex items-center justify-center gap-6 flex-wrap overflow-visible"
          style={{ minHeight: height }}
        >
          {/* Left Legend - wider to show full labels */}
          <div className="flex-shrink-0 w-56">
            <CustomLegend
              payload={processedData.map((item, index) => ({
                value: item[nameKey],
                color: colors[index % colors.length],
                payload: item,
              }))}
            />
          </div>
          {/* Pie Chart - flex to fill remaining space, overflow visible for labels */}
          <div className="flex-1 min-w-[300px] max-w-[550px] overflow-visible" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <defs>
                  {colors.map((color, index) => (
                    <radialGradient key={`gradient-${index}`} id={`pieGradient-${index}`}>
                      <stop offset="0%" stopColor={color} stopOpacity={0.6} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.9} />
                    </radialGradient>
                  ))}
                </defs>
                <Pie
                  activeIndex={showActiveShape ? activeIndex : undefined}
                  activeShape={showActiveShape ? renderActiveShape : undefined}
                  data={processedData}
                  cx={cx}
                  cy={cy}
                  innerRadius={innerRadius}
                  outerRadius={outerRadius}
                  paddingAngle={paddingAngle}
                  dataKey={dataKey}
                  nameKey={nameKey}
                  startAngle={startAngle}
                  endAngle={endAngle}
                  stroke="rgba(148, 163, 184, 0.2)"
                  onMouseEnter={showActiveShape ? (_, index) => setActiveIndex(index) : undefined}
                  onMouseLeave={
                    showActiveShape ? () => setActiveIndex(largestSliceIndex) : undefined
                  }
                >
                  {processedData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={colors[index % colors.length]}
                      stroke="none"
                    />
                  ))}
                </Pie>
                {/* No tooltip for left legend layout - info shown in expanded segment */}
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    )
  }

  // Standard layout (bottom legend with values)
  if (showLegend && legendPosition === 'bottom') {
    return (
      <div ref={containerRef} className={cn('w-full', className)}>
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <defs>
                {colors.map((color, index) => (
                  <radialGradient key={`gradient-${index}`} id={`pieGradient-${index}`}>
                    <stop offset="0%" stopColor={color} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.9} />
                  </radialGradient>
                ))}
              </defs>
              <Pie
                activeIndex={showActiveShape ? activeIndex : undefined}
                activeShape={showActiveShape ? renderActiveShape : undefined}
                data={processedData}
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                paddingAngle={paddingAngle}
                dataKey={dataKey}
                nameKey={nameKey}
                startAngle={startAngle}
                endAngle={endAngle}
                stroke="rgba(148, 163, 184, 0.2)"
                onMouseEnter={showActiveShape ? (_, index) => setActiveIndex(index) : undefined}
                onMouseLeave={showActiveShape ? () => setActiveIndex(largestSliceIndex) : undefined}
              >
                {processedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="none" />
                ))}
              </Pie>
              {showTooltip && <Tooltip content={<CustomTooltip />} />}
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
        {/* Bottom legend with values in centered rows */}
        <div className="mt-1 pb-6 flex flex-wrap justify-center gap-x-4 gap-y-1.5 px-2">
          {processedData.map((item, index) => {
            const value = item[dataKey]
            const formattedValue = formatLabel ? formatLabel(value) : value
            return (
              <div
                key={`bottom-legend-${index}`}
                className="flex items-center gap-1.5 cursor-pointer hover:opacity-75 transition-opacity"
                onMouseEnter={() => showActiveShape && setActiveIndex(index)}
                onMouseLeave={() => showActiveShape && setActiveIndex(largestSliceIndex)}
              >
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="theme-text-primary text-xs whitespace-nowrap">
                  {item[nameKey]}
                </span>
                <span className="font-medium theme-text-primary text-xs opacity-70 whitespace-nowrap">
                  {formattedValue}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Right legend layout
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <defs>
            {colors.map((color, index) => (
              <radialGradient key={`gradient-${index}`} id={`pieGradient-${index}`}>
                <stop offset="0%" stopColor={color} stopOpacity={0.6} />
                <stop offset="100%" stopColor={color} stopOpacity={0.9} />
              </radialGradient>
            ))}
          </defs>
          <Pie
            activeIndex={showActiveShape ? activeIndex : undefined}
            activeShape={showActiveShape ? renderActiveShape : undefined}
            data={processedData}
            cx={cx}
            cy={cy}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={paddingAngle}
            dataKey={dataKey}
            nameKey={nameKey}
            startAngle={startAngle}
            endAngle={endAngle}
            stroke="rgba(148, 163, 184, 0.2)"
            onMouseEnter={showActiveShape ? (_, index) => setActiveIndex(index) : undefined}
            onMouseLeave={showActiveShape ? () => setActiveIndex(largestSliceIndex) : undefined}
          >
            {processedData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="none" />
            ))}
          </Pie>
          {showTooltip && <Tooltip content={<CustomTooltip />} />}
          {showLegend && (
            <Legend
              verticalAlign="middle"
              align="right"
              layout="vertical"
              formatter={legendFormatter}
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  )
}
