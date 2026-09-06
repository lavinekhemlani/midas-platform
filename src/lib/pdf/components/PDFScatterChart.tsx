// src/lib/pdf/components/PDFScatterChart.tsx
import React from 'react'
import { View, Text, Svg, Circle, Line, StyleSheet } from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS, PDF_FONT_SIZES } from '../fontConfig'

// Register fonts from shared config
registerPdfFonts()

// Colors for scatter chart series
const SCATTER_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
]

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    border: '1 solid #e5e7eb',
    borderRadius: 4,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: PDF_FONT_SIZES.BODY,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 10,
  },
  chartWrapper: {
    alignItems: 'center',
  },
  axisLabel: {
    fontSize: 10,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 5,
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
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 9,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#111827',
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

interface ScatterDataPoint {
  x: number
  y: number
  label?: string
  [key: string]: any
}

interface ScatterSeries {
  name: string
  data: ScatterDataPoint[]
  color?: string
}

interface PDFScatterChartProps {
  series: ScatterSeries[]
  title?: string
  xAxisLabel?: string
  yAxisLabel?: string
  xAxisFormat?: 'currency' | 'number'
  yAxisFormat?: 'currency' | 'number'
  currency?: string
  showGrid?: boolean
}

export const PDFScatterChart: React.FC<PDFScatterChartProps> = ({
  series,
  title,
  xAxisLabel = '',
  yAxisLabel = '',
  xAxisFormat = 'number',
  yAxisFormat = 'number',
  currency = 'USD',
  showGrid = true,
}) => {
  if (!series || series.length === 0) return null

  // Flatten all data points to find min/max
  const allPoints = series.flatMap((s) => s.data)
  if (allPoints.length === 0) return null

  // Calculate min/max for both axes
  let minX = Math.min(...allPoints.map((p) => p.x))
  let maxX = Math.max(...allPoints.map((p) => p.x))
  let minY = Math.min(...allPoints.map((p) => p.y))
  let maxY = Math.max(...allPoints.map((p) => p.y))

  // Guard against division by zero when all values are identical
  let rangeX = maxX - minX
  let rangeY = maxY - minY
  if (rangeX === 0) {
    const padding = maxX === 0 ? 1 : Math.abs(maxX) * 0.1
    minX = minX - padding
    maxX = maxX + padding
    rangeX = maxX - minX
  }
  if (rangeY === 0) {
    const padding = maxY === 0 ? 1 : Math.abs(maxY) * 0.1
    minY = minY - padding
    maxY = maxY + padding
    rangeY = maxY - minY
  }

  // Add padding to ranges
  minX = minX - rangeX * 0.1
  maxX = maxX + rangeX * 0.1
  minY = minY - rangeY * 0.1
  maxY = maxY + rangeY * 0.1

  // Round to nice numbers
  minX = Math.floor(minX / 10) * 10
  maxX = Math.ceil(maxX / 10) * 10
  minY = Math.floor(minY / 10) * 10
  maxY = Math.ceil(maxY / 10) * 10

  // SVG dimensions
  const width = 500
  const height = 350
  const padding = 50
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2

  // Generate axis ticks
  const numTicks = 5
  const xTicks = []
  const yTicks = []

  for (let i = 0; i <= numTicks; i++) {
    // X-axis ticks
    const xValue = minX + ((maxX - minX) / numTicks) * i
    const x = padding + (i / numTicks) * chartWidth
    xTicks.push({ value: xValue, x })

    // Y-axis ticks
    const yValue = minY + ((maxY - minY) / numTicks) * i
    const y = padding + chartHeight - (i / numTicks) * chartHeight
    yTicks.push({ value: yValue, y })
  }

  // Format axis values
  const formatXValue = (value: number) => {
    return xAxisFormat === 'currency' ? formatCurrency(value, currency) : formatNumber(value)
  }

  const formatYValue = (value: number) => {
    return yAxisFormat === 'currency' ? formatCurrency(value, currency) : formatNumber(value)
  }

  // Convert data points to SVG coordinates
  const getPointCoordinates = (point: ScatterDataPoint) => {
    const x = padding + ((point.x - minX) / (maxX - minX)) * chartWidth
    const y = padding + chartHeight - ((point.y - minY) / (maxY - minY)) * chartHeight
    return { x, y }
  }

  return (
    <View style={styles.container} wrap={true}>
      {title && <Text style={styles.title}>{title}</Text>}

      <View style={styles.chartWrapper}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Grid lines */}
          {showGrid && (
            <>
              {/* Vertical grid lines */}
              {xTicks.map((tick, index) => (
                <Line
                  key={`x-grid-${index}`}
                  x1={tick.x}
                  y1={padding}
                  x2={tick.x}
                  y2={padding + chartHeight}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                />
              ))}
              {/* Horizontal grid lines */}
              {yTicks.map((tick, index) => (
                <Line
                  key={`y-grid-${index}`}
                  x1={padding}
                  y1={tick.y}
                  x2={padding + chartWidth}
                  y2={tick.y}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                />
              ))}
            </>
          )}

          {/* X-axis */}
          <Line
            x1={padding}
            y1={padding + chartHeight}
            x2={padding + chartWidth}
            y2={padding + chartHeight}
            stroke="#374151"
            strokeWidth={2}
          />

          {/* Y-axis */}
          <Line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={padding + chartHeight}
            stroke="#374151"
            strokeWidth={2}
          />

          {/* X-axis ticks and labels */}
          {xTicks.map((tick, index) => (
            <React.Fragment key={`x-tick-${index}`}>
              {/* Tick mark */}
              <Line
                x1={tick.x}
                y1={padding + chartHeight}
                x2={tick.x}
                y2={padding + chartHeight + 5}
                stroke="#374151"
                strokeWidth={2}
              />
              {/* Label */}
              <Text
                x={tick.x}
                y={padding + chartHeight + 18}
                style={{
                  fontSize: 8,
                  fontFamily: PDF_FONTS.PRIMARY,
                  fill: '#6b7280',
                  textAnchor: 'middle',
                }}
              >
                {formatXValue(tick.value)}
              </Text>
            </React.Fragment>
          ))}

          {/* Y-axis ticks and labels */}
          {yTicks.map((tick, index) => (
            <React.Fragment key={`y-tick-${index}`}>
              {/* Tick mark */}
              <Line
                x1={padding - 5}
                y1={tick.y}
                x2={padding}
                y2={tick.y}
                stroke="#374151"
                strokeWidth={2}
              />
              {/* Label */}
              <Text
                x={padding - 10}
                y={tick.y + 3}
                style={{
                  fontSize: 8,
                  fontFamily: PDF_FONTS.PRIMARY,
                  fill: '#6b7280',
                  textAnchor: 'end',
                }}
              >
                {formatYValue(tick.value)}
              </Text>
            </React.Fragment>
          ))}

          {/* Plot data points for each series */}
          {series.map((s, seriesIndex) => {
            const color = s.color || SCATTER_COLORS[seriesIndex % SCATTER_COLORS.length]

            return (
              <React.Fragment key={seriesIndex}>
                {s.data.map((point, pointIndex) => {
                  const coords = getPointCoordinates(point)
                  return (
                    <Circle
                      key={`${seriesIndex}-${pointIndex}`}
                      cx={coords.x}
                      cy={coords.y}
                      r={4}
                      fill={color}
                      opacity={0.8}
                    />
                  )
                })}
              </React.Fragment>
            )
          })}
        </Svg>
      </View>

      {/* Axis labels */}
      {xAxisLabel && (
        <View style={{ marginTop: 5 }}>
          <Text style={styles.axisLabel}>{xAxisLabel}</Text>
        </View>
      )}
      {yAxisLabel && (
        <View style={{ position: 'absolute', left: 10, top: height / 2 }}>
          <Text
            style={{
              fontSize: 10,
              fontFamily: PDF_FONTS.PRIMARY,
              color: '#6b7280',
            }}
          >
            {yAxisLabel}
          </Text>
        </View>
      )}

      {/* Legend */}
      {series.length > 1 && (
        <View style={styles.legendGrid}>
          {series.map((s, index) => {
            const color = s.color || SCATTER_COLORS[index % SCATTER_COLORS.length]
            return (
              <View key={index} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{s.name}</Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
