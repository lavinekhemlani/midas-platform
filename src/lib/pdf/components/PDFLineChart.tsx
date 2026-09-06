// src/lib/pdf/components/PDFLineChart.tsx
import React from 'react'
import { View, Text, Svg, Path, Line, Circle, StyleSheet } from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS, PDF_FONT_SIZES } from '../fontConfig'

// Register fonts from shared config
registerPdfFonts()

// Colors for PDF line charts (matching the default colors)
const PDF_LINE_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
]

// Styles for PDF Line Chart
const styles = StyleSheet.create({
  lineChartContainer: {
    marginVertical: 10,
    border: '1 solid #e5e7eb',
    borderRadius: 4,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  chartTitle: {
    fontSize: PDF_FONT_SIZES.BODY,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 6,
  },
  chartSvg: {
    marginBottom: 4,
  },
  axisLabel: {
    fontSize: 10,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#6b7280',
    textAlign: 'center',
  },
  yAxisLabel: {
    fontSize: 10,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#6b7280',
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
    paddingHorizontal: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendLine: {
    width: 20,
    height: 3,
    marginRight: 6,
  },
  legendText: {
    fontSize: 9,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#111827',
  },
})

// Format currency helper - shows full numbers without rounding
function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Format number helper - shows full numbers without rounding
function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 10,
  }).format(value)
}

// Calculate smooth curve path for line chart using cubic Bezier curves
function calculateLinePath(
  data: any[],
  dataKey: string,
  width: number,
  height: number,
  minY: number,
  maxY: number,
  xKey: string
): string {
  if (!data || data.length === 0) return ''

  const padding = 40
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2

  const points = data
    .map((point, index) => {
      const value = point[dataKey]
      // Guard against undefined, null, NaN, and non-finite values
      if (
        value === undefined ||
        value === null ||
        typeof value !== 'number' ||
        !Number.isFinite(value)
      )
        return null

      const x = padding + (index / (data.length - 1)) * chartWidth
      const yRatio = maxY - minY !== 0 ? (value - minY) / (maxY - minY) : 0.5
      const y = padding + chartHeight - yRatio * chartHeight

      // Guard against NaN in calculated coordinates
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null

      return { x, y }
    })
    .filter((p) => p !== null)

  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`

  // Create smooth curves using cubic Bezier
  let path = `M ${points[0].x},${points[0].y}`

  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i]
    const next = points[i + 1]

    // Calculate control points for smooth curve
    const controlPointDistance = (next.x - current.x) * 0.5

    const cp1x = current.x + controlPointDistance
    const cp1y = current.y

    const cp2x = next.x - controlPointDistance
    const cp2y = next.y

    // Cubic Bezier curve
    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`
  }

  return path
}

// Get plot points for rendering dots
function getPlotPoints(
  data: any[],
  dataKey: string,
  width: number,
  height: number,
  minY: number,
  maxY: number
): Array<{ x: number; y: number }> {
  if (!data || data.length === 0) return []

  const padding = 40
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2

  return data
    .map((point, index) => {
      const value = point[dataKey]
      // Guard against undefined, null, NaN, and non-finite values
      if (
        value === undefined ||
        value === null ||
        typeof value !== 'number' ||
        !Number.isFinite(value)
      )
        return null

      const x = padding + (index / (data.length - 1)) * chartWidth
      const yRatio = maxY - minY !== 0 ? (value - minY) / (maxY - minY) : 0.5
      const y = padding + chartHeight - yRatio * chartHeight

      // Guard against NaN in calculated coordinates
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null

      return { x, y }
    })
    .filter((p) => p !== null) as Array<{ x: number; y: number }>
}

// Calculate smooth path for area chart (filled) using cubic Bezier curves
function calculateAreaPath(
  data: any[],
  dataKey: string,
  width: number,
  height: number,
  minY: number,
  maxY: number,
  xKey: string
): string {
  if (!data || data.length === 0) return ''

  const padding = 40
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2

  const points = data
    .map((point, index) => {
      const value = point[dataKey]
      // Guard against undefined, null, NaN, and non-finite values
      if (
        value === undefined ||
        value === null ||
        typeof value !== 'number' ||
        !Number.isFinite(value)
      )
        return null

      const x = padding + (index / (data.length - 1)) * chartWidth
      const yRatio = maxY - minY !== 0 ? (value - minY) / (maxY - minY) : 0.5
      const y = padding + chartHeight - yRatio * chartHeight

      // Guard against NaN in calculated coordinates
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null

      return { x, y }
    })
    .filter((p) => p !== null)

  if (points.length === 0) return ''

  // Start at bottom left
  const baseline = padding + chartHeight
  let path = `M ${points[0].x},${baseline}`

  // Draw line to first point
  path += ` L ${points[0].x},${points[0].y}`

  // Draw smooth curves through all points
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i]
    const next = points[i + 1]

    // Calculate control points for smooth curve
    const controlPointDistance = (next.x - current.x) * 0.5

    const cp1x = current.x + controlPointDistance
    const cp1y = current.y

    const cp2x = next.x - controlPointDistance
    const cp2y = next.y

    // Cubic Bezier curve
    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`
  }

  // Close path back to baseline
  path += ` L ${points[points.length - 1].x},${baseline}`
  path += ` Z`

  return path
}

// PDF Line Chart Component
export const PDFLineChart: React.FC<{
  data: any[]
  title?: string
  currency?: string
  xAxisKey?: string
  xAxisLabel?: string
  yAxisLabel?: string
  yAxisFormat?: string
  series?: Array<{ key: string; name: string; color?: string; type?: string }>
  chartType?: 'line' | 'area'
}> = ({
  data,
  title,
  currency = 'USD',
  xAxisKey = 'x',
  xAxisLabel = '',
  yAxisLabel = '',
  yAxisFormat = 'number',
  series = [],
  chartType = 'line',
}) => {
  if (!data || data.length === 0) return null

  // Determine series if not provided
  let lineSeries = series
  if (lineSeries.length === 0) {
    const defaultKeys = [
      'value',
      'revenue',
      'expenses',
      'profit',
      'inflow',
      'outflow',
      'cumulative',
    ]
    lineSeries = defaultKeys
      .filter((key) => data.some((d) => d[key] !== undefined))
      .map((key) => ({ key, name: key.charAt(0).toUpperCase() + key.slice(1) }))
  }

  if (lineSeries.length === 0) return null

  // Calculate min/max for Y axis
  let minY = Infinity
  let maxY = -Infinity

  data.forEach((point) => {
    lineSeries.forEach((s) => {
      const value = point[s.key]
      // Guard against undefined, null, NaN, and non-numeric values
      if (
        value !== undefined &&
        value !== null &&
        typeof value === 'number' &&
        !Number.isNaN(value) &&
        Number.isFinite(value)
      ) {
        minY = Math.min(minY, value)
        maxY = Math.max(maxY, value)
      }
    })
  })

  // Guard against Infinity (no valid data points found) and division by zero
  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
    // No valid data - use safe defaults
    minY = 0
    maxY = 100
  }

  let range = maxY - minY
  if (range === 0) {
    const padding = maxY === 0 ? 1 : Math.abs(maxY) * 0.1
    minY = minY - padding
    maxY = maxY + padding
    range = maxY - minY
  }

  // Add padding to the range
  minY = minY - range * 0.1
  maxY = maxY + range * 0.1

  // Round to nice numbers
  minY = Math.floor(minY / 10) * 10
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
    <View style={styles.lineChartContainer} wrap={true}>
      {title && <Text style={styles.chartTitle}>{title}</Text>}

      {/* Line Chart SVG */}
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
              style={{
                fontSize: 8,
                fill: '#6b7280',
                textAnchor: 'end',
                fontFamily: PDF_FONTS.PRIMARY,
              }}
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
                fontFamily: PDF_FONTS.PRIMARY,
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

        {/* Draw lines/areas */}
        {lineSeries.map((s, index) => {
          const color = s.color || PDF_LINE_COLORS[index % PDF_LINE_COLORS.length]
          const plotPoints = getPlotPoints(data, s.key, width, height, minY, maxY)

          if (chartType === 'area') {
            const areaPath = calculateAreaPath(data, s.key, width, height, minY, maxY, xAxisKey)
            const linePath = calculateLinePath(data, s.key, width, height, minY, maxY, xAxisKey)

            return (
              <React.Fragment key={s.key}>
                {/* Fill area */}
                <Path d={areaPath} fill={color} opacity={0.3} />
                {/* Draw line on top */}
                <Path d={linePath} fill="none" stroke={color} strokeWidth={2} />
                {/* Draw plot points */}
                {plotPoints.map((point, idx) => (
                  <Circle
                    key={`${s.key}-dot-${idx}`}
                    cx={point.x}
                    cy={point.y}
                    r={3}
                    fill={color}
                  />
                ))}
              </React.Fragment>
            )
          } else {
            const linePath = calculateLinePath(data, s.key, width, height, minY, maxY, xAxisKey)

            return (
              <React.Fragment key={s.key}>
                {/* Draw line */}
                <Path d={linePath} fill="none" stroke={color} strokeWidth={2.5} />
                {/* Draw plot points */}
                {plotPoints.map((point, idx) => (
                  <Circle
                    key={`${s.key}-dot-${idx}`}
                    cx={point.x}
                    cy={point.y}
                    r={3}
                    fill={color}
                  />
                ))}
              </React.Fragment>
            )
          }
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
      {lineSeries.length > 1 && (
        <View style={styles.legendGrid}>
          {lineSeries.map((s, index) => {
            const color = s.color || PDF_LINE_COLORS[index % PDF_LINE_COLORS.length]
            return (
              <View key={s.key} style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{s.name}</Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
