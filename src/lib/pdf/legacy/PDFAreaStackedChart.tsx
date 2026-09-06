// src/lib/pdf/components/PDFAreaStackedChart.tsx
import React from 'react'
import { View, Text, Svg, Path, Line, StyleSheet, Font } from '@react-pdf/renderer'

// Register Noto Sans for full Unicode support (including ₱ and other currency symbols)
Font.register({
  family: 'Noto Sans',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSans/hinted/ttf/NotoSans-Regular.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSans/hinted/ttf/NotoSans-Bold.ttf',
      fontWeight: 700,
    },
  ],
})

// Register Noto Serif for serif text
Font.register({
  family: 'Noto Serif',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSerif/hinted/ttf/NotoSerif-Regular.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSerif/hinted/ttf/NotoSerif-Bold.ttf',
      fontWeight: 700,
    },
  ],
})

// Colors for stacked areas (slightly muted for better stacking visibility)
const AREA_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
]

// Styles for PDF Stacked Area Chart
const styles = StyleSheet.create({
  areaChartContainer: {
    marginVertical: 20,
  },
  chartTitle: {
    fontSize: 20,
    fontFamily: 'Noto Serif',
    color: '#1f2937',
    marginBottom: 25,
    paddingBottom: 8,
    paddingTop: 8,
    paddingHorizontal: 20,
    borderBottom: '2 solid #df1e5a',
    alignSelf: 'center',
    backgroundColor: '#f3f4f6',
  },
  chartSvg: {
    marginBottom: 15,
  },
  axisLabel: {
    fontSize: 10,
    fontFamily: 'Noto Sans',
    color: '#6b7280',
    textAlign: 'center',
  },
  yAxisLabel: {
    fontSize: 10,
    fontFamily: 'Noto Sans',
    color: '#6b7280',
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 15,
    paddingHorizontal: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendBox: {
    width: 12,
    height: 12,
    marginRight: 6,
  },
  legendText: {
    fontSize: 9,
    fontFamily: 'Noto Sans',
    color: '#374151',
  },
})

// Format currency helper
function formatCurrency(value: number, currency: string = 'USD'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  if (Math.abs(value) >= 1000000) {
    const formatted = formatter.format(1)
    const abbreviated = (value / 1000000).toFixed(1) + 'M'
    return formatted.replace('1', abbreviated)
  }
  if (Math.abs(value) >= 1000) {
    const formatted = formatter.format(1)
    const abbreviated = (value / 1000).toFixed(0) + 'K'
    return formatted.replace('1', abbreviated)
  }
  return formatter.format(value)
}

// Format number helper
function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}K`
  }
  return value.toFixed(0)
}

// Calculate smooth stacked area path using cubic Bezier curves
function calculateStackedAreaPath(
  data: any[],
  dataKey: string,
  baselineData: number[], // Cumulative baseline values from previous series
  width: number,
  height: number,
  minY: number,
  maxY: number
): string {
  if (!data || data.length === 0) return ''

  const padding = 40
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2

  // Calculate top points (current series + baseline)
  const topPoints = data
    .map((point, index) => {
      const value = point[dataKey]
      if (value === undefined || value === null) return null

      const stackedValue = (baselineData[index] || 0) + value
      const x = padding + (index / (data.length - 1)) * chartWidth
      const y = padding + chartHeight - ((stackedValue - minY) / (maxY - minY)) * chartHeight

      return { x, y }
    })
    .filter((p) => p !== null)

  // Calculate bottom points (baseline)
  const bottomPoints = data
    .map((point, index) => {
      const baseValue = baselineData[index] || 0
      const x = padding + (index / (data.length - 1)) * chartWidth
      const y = padding + chartHeight - ((baseValue - minY) / (maxY - minY)) * chartHeight

      return { x, y }
    })
    .filter((p) => p !== null)

  if (topPoints.length === 0) return ''

  // Start at first bottom point
  let path = `M ${bottomPoints[0].x},${bottomPoints[0].y}`

  // Draw to first top point
  path += ` L ${topPoints[0].x},${topPoints[0].y}`

  // Draw smooth curves through top points
  for (let i = 0; i < topPoints.length - 1; i++) {
    const current = topPoints[i]
    const next = topPoints[i + 1]

    const controlPointDistance = (next.x - current.x) * 0.5
    const cp1x = current.x + controlPointDistance
    const cp1y = current.y
    const cp2x = next.x - controlPointDistance
    const cp2y = next.y

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`
  }

  // Draw down to last bottom point
  path += ` L ${bottomPoints[bottomPoints.length - 1].x},${bottomPoints[bottomPoints.length - 1].y}`

  // Draw smooth curves back through bottom points (in reverse)
  for (let i = bottomPoints.length - 2; i >= 0; i--) {
    const current = bottomPoints[i + 1]
    const next = bottomPoints[i]

    const controlPointDistance = (current.x - next.x) * 0.5
    const cp1x = current.x - controlPointDistance
    const cp1y = current.y
    const cp2x = next.x + controlPointDistance
    const cp2y = next.y

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`
  }

  // Close path
  path += ` Z`

  return path
}

// PDF Stacked Area Chart Component
export const PDFAreaStackedChart: React.FC<{
  data: any[]
  title?: string
  currency?: string
  xAxisKey?: string
  xAxisLabel?: string
  yAxisLabel?: string
  yAxisFormat?: string
  series?: Array<{ key: string; name: string; color?: string }>
}> = ({
  data,
  title,
  currency = 'USD',
  xAxisKey = 'x',
  xAxisLabel = '',
  yAxisLabel = '',
  yAxisFormat = 'number',
  series = [],
}) => {
  if (!data || data.length === 0) return null

  // Determine series if not provided
  let areaSeries = series
  if (areaSeries.length === 0) {
    const defaultKeys = [
      'value',
      'revenue',
      'expenses',
      'profit',
      'inflow',
      'outflow',
      'series1',
      'series2',
      'series3',
    ]
    areaSeries = defaultKeys
      .filter((key) => data.some((d) => d[key] !== undefined))
      .map((key) => ({ key, name: key.charAt(0).toUpperCase() + key.slice(1) }))
  }

  if (areaSeries.length === 0) return null

  // Calculate cumulative values for stacking
  const stackedData: number[][] = []
  for (let i = 0; i < data.length; i++) {
    stackedData[i] = []
    let cumulative = 0
    areaSeries.forEach((s, seriesIndex) => {
      const value = data[i][s.key] || 0
      cumulative += value
      stackedData[i][seriesIndex] = cumulative
    })
  }

  // Calculate min/max for Y axis (based on maximum stack)
  const minY = 0 // Stacked charts typically start at 0
  let maxY = Math.max(...stackedData.map((row) => Math.max(...row)))

  // Add padding to the range
  const range = maxY - minY
  maxY = maxY + range * 0.1

  // Round to nice numbers
  maxY = Math.ceil(maxY / 10) * 10

  // SVG dimensions
  const width = 500
  const height = 300
  const padding = 40

  // Generate Y-axis ticks
  const numTicks = 5
  const yTicks = []
  for (let i = 0; i <= numTicks; i++) {
    const value = minY + ((maxY - minY) / numTicks) * i
    const y =
      padding + height - padding * 2 - ((value - minY) / (maxY - minY)) * (height - padding * 2)
    yTicks.push({ value, y })
  }

  // Generate X-axis ticks (show first, middle, last)
  const xTicks: Array<{ label: string; x: number }> = []
  const indices = [0, Math.floor(data.length / 2), data.length - 1]
  indices.forEach((index) => {
    if (index < data.length) {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2)
      const label = data[index][xAxisKey] || ''
      xTicks.push({ label, x })
    }
  })

  // Format Y-axis value
  const formatYValue = (value: number) => {
    if (yAxisFormat === 'currency') {
      return formatCurrency(value, currency)
    }
    return formatNumber(value)
  }

  return (
    <View style={styles.areaChartContainer}>
      {title && <Text style={styles.chartTitle}>{title}</Text>}

      {/* Stacked Area Chart SVG */}
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={styles.chartSvg}>
        {/* Grid lines */}
        {yTicks.map((tick, index) => (
          <React.Fragment key={`grid-${index}`}>
            <Line
              x1={padding}
              y1={tick.y}
              x2={width - padding}
              y2={tick.y}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
          </React.Fragment>
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick, index) => (
          <React.Fragment key={`y-tick-${index}`}>
            <Text
              x={padding - 5}
              y={tick.y}
              style={{ fontSize: 8, fill: '#6b7280', textAnchor: 'end', fontFamily: 'Noto Sans' }}
            >
              {formatYValue(tick.value)}
            </Text>
          </React.Fragment>
        ))}

        {/* X-axis labels */}
        {xTicks.map((tick, index) => (
          <React.Fragment key={`x-tick-${index}`}>
            <Text
              x={tick.x}
              y={height - padding + 15}
              style={{
                fontSize: 8,
                fill: '#6b7280',
                textAnchor: 'middle',
                fontFamily: 'Noto Sans',
              }}
            >
              {tick.label}
            </Text>
          </React.Fragment>
        ))}

        {/* Axes */}
        <Line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#374151"
          strokeWidth={2}
        />
        <Line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#374151"
          strokeWidth={2}
        />

        {/* Draw stacked areas (reverse order so first series appears on top visually) */}
        {areaSeries.map((s, index) => {
          const color = s.color || AREA_COLORS[index % AREA_COLORS.length]

          // Calculate baseline: cumulative sum of all previous series
          const baselineData = data.map((_, dataIndex) => {
            if (index === 0) return 0
            let sum = 0
            for (let j = 0; j < index; j++) {
              sum += data[dataIndex][areaSeries[j].key] || 0
            }
            return sum
          })

          const areaPath = calculateStackedAreaPath(
            data,
            s.key,
            baselineData,
            width,
            height,
            minY,
            maxY
          )

          return (
            <React.Fragment key={s.key}>
              <Path d={areaPath} fill={color} opacity={0.7} />
            </React.Fragment>
          )
        })}
      </Svg>

      {/* Axis Labels */}
      {yAxisLabel && (
        <View style={{ position: 'absolute', left: 10, top: height / 2 }}>
          <Text style={styles.yAxisLabel}>{yAxisLabel}</Text>
        </View>
      )}
      {xAxisLabel && (
        <View style={{ marginTop: 5 }}>
          <Text style={styles.axisLabel}>{xAxisLabel}</Text>
        </View>
      )}

      {/* Legend */}
      {areaSeries.length > 1 && (
        <View style={styles.legendGrid}>
          {areaSeries.map((s, index) => {
            const color = s.color || AREA_COLORS[index % AREA_COLORS.length]
            return (
              <View key={s.key} style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{s.name}</Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
