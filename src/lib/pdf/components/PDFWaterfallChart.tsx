// src/lib/pdf/components/PDFWaterfallChart.tsx
import React from 'react'
import { View, Text, Svg, Rect, Line, StyleSheet } from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS, PDF_FONT_SIZES } from '../fontConfig'

// Register fonts from shared config
registerPdfFonts()

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
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 8,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#6b7280',
  },
})

// Colors for waterfall chart
const COLORS = {
  initial: '#3b82f6', // blue for starting value
  positive: '#10b981', // green for increases
  negative: '#ef4444', // red for decreases
  final: '#8b5cf6', // purple for final value
}

// Format currency
function formatCurrency(value: number, currency: string = 'USD'): string {
  const absValue = Math.abs(value)
  if (absValue >= 1000000) {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value / 1000000)
    return formatted.replace(/[\d,.]+/, (m) => m + 'M')
  }
  if (absValue >= 1000) {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value / 1000)
    return formatted.replace(/[\d,.]+/, (m) => m + 'K')
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Format number
function formatNumber(value: number): string {
  const absValue = Math.abs(value)
  if (absValue >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (absValue >= 1000) {
    return `${(value / 1000).toFixed(0)}K`
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

interface WaterfallDataPoint {
  label: string
  value: number
  type: 'initial' | 'positive' | 'negative' | 'final'
}

interface PDFWaterfallChartProps {
  data: WaterfallDataPoint[]
  title?: string
  currency?: string
  format?: 'currency' | 'number'
}

export const PDFWaterfallChart: React.FC<PDFWaterfallChartProps> = ({
  data,
  title,
  currency = 'USD',
  format = 'currency',
}) => {
  if (!data || data.length === 0) return null

  // Calculate running totals and bar positions
  let runningTotal = 0
  const processedData = data.map((item, index) => {
    let barStart: number
    let barEnd: number
    let color: string
    let displayValue: number = item.value

    if (item.type === 'initial') {
      runningTotal = item.value
      barStart = 0
      barEnd = item.value
      color = COLORS.initial
    } else if (item.type === 'final') {
      barStart = 0
      barEnd = item.value
      color = COLORS.final
    } else {
      // For intermediate values, use the ACTUAL sign of the value to determine direction
      // The 'type' field is a hint but value sign takes precedence
      const actualValue = item.value
      const isActuallyPositive = actualValue >= 0

      barStart = runningTotal
      runningTotal += actualValue
      barEnd = runningTotal

      // Color based on actual change direction
      if (isActuallyPositive) {
        color = COLORS.positive
      } else {
        color = COLORS.negative
      }
    }

    return {
      ...item,
      barStart,
      barEnd,
      runningTotal,
      color,
      displayValue,
    }
  })

  // Find min and max for scaling
  let minValue = 0
  let maxValue = 0
  processedData.forEach((d) => {
    minValue = Math.min(minValue, d.barStart, d.barEnd)
    maxValue = Math.max(maxValue, d.barStart, d.barEnd)
  })

  // Ensure zero is always included in the range for proper waterfall visualization
  minValue = Math.min(minValue, 0)
  maxValue = Math.max(maxValue, 0)

  // Guard against division by zero when all values are identical
  let range = maxValue - minValue
  if (range === 0) {
    const padding = maxValue === 0 ? 1 : Math.abs(maxValue) * 0.1
    minValue = minValue - padding
    maxValue = maxValue + padding
    range = maxValue - minValue
  }

  // Add padding
  minValue = minValue - range * 0.1
  maxValue = maxValue + range * 0.15 // More padding at top for labels

  // SVG dimensions
  const width = 450
  const height = 250
  const padding = { top: 30, right: 20, bottom: 60, left: 60 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Scale functions
  const scaleY = (value: number) => {
    return padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight
  }

  const barWidth = Math.min(50, (chartWidth / data.length) * 0.7)
  const barGap = (chartWidth - barWidth * data.length) / (data.length + 1)

  const formatValue = (value: number) => {
    return format === 'currency' ? formatCurrency(value, currency) : formatNumber(value)
  }

  return (
    <View style={styles.container} wrap={true}>
      {title && <Text style={styles.title}>{title}</Text>}

      <View style={styles.chartWrapper}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Y-axis gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
            const value = minValue + (maxValue - minValue) * ratio
            const y = scaleY(value)
            return (
              <React.Fragment key={index}>
                <Line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                />
                <Text
                  x={padding.left - 5}
                  y={y + 3}
                  style={{
                    fontSize: 8,
                    fontFamily: PDF_FONTS.PRIMARY,
                    fill: '#6b7280',
                    textAnchor: 'end',
                  }}
                >
                  {formatValue(value)}
                </Text>
              </React.Fragment>
            )
          })}

          {/* Zero line - always show when there are negative values */}
          {minValue < 0 && (
            <React.Fragment>
              <Line
                x1={padding.left}
                y1={scaleY(0)}
                x2={width - padding.right}
                y2={scaleY(0)}
                stroke="#374151"
                strokeWidth={2}
              />
              {/* Zero label */}
              <Text
                x={padding.left - 5}
                y={scaleY(0) + 3}
                style={{
                  fontSize: 8,
                  fontFamily: PDF_FONTS.PRIMARY,
                  fontWeight: 700,
                  fill: '#374151',
                  textAnchor: 'end',
                }}
              >
                {formatValue(0)}
              </Text>
            </React.Fragment>
          )}

          {/* Bars and connectors */}
          {processedData.map((item, index) => {
            const x = padding.left + barGap + index * (barWidth + barGap)
            const yTop = scaleY(Math.max(item.barStart, item.barEnd))
            const yBottom = scaleY(Math.min(item.barStart, item.barEnd))
            const barHeightPx = Math.max(2, yBottom - yTop)

            // Determine if this is a decrease (bar goes down from start)
            const isDecrease = item.barEnd < item.barStart

            // Connector line to next bar
            const showConnector =
              index < processedData.length - 1 &&
              item.type !== 'final' &&
              processedData[index + 1].type !== 'final'

            // For label positioning:
            // - For initial/final bars: label above the bar
            // - For increases: label above the bar (at barEnd level)
            // - For decreases: label above where the bar starts (at barStart level)
            const isInitialOrFinal = item.type === 'initial' || item.type === 'final'
            const labelY = isInitialOrFinal
              ? yTop - 5
              : isDecrease
                ? scaleY(item.barStart) - 5 // Above the start point for decreases
                : yTop - 5 // Above the bar top for increases

            // Ensure label doesn't go above chart area
            const safeLabelY = Math.max(labelY, padding.top - 5)

            return (
              <React.Fragment key={index}>
                {/* Connector line from previous running total */}
                {showConnector && (
                  <Line
                    x1={x + barWidth}
                    y1={scaleY(item.runningTotal)}
                    x2={x + barWidth + barGap}
                    y2={scaleY(item.runningTotal)}
                    stroke="#9ca3af"
                    strokeWidth={1}
                    strokeDasharray="3,2"
                  />
                )}

                {/* Bar */}
                <Rect
                  x={x}
                  y={yTop}
                  width={barWidth}
                  height={barHeightPx}
                  fill={item.color}
                  rx={2}
                />

                {/* Value label on bar */}
                <Text
                  x={x + barWidth / 2}
                  y={safeLabelY}
                  style={{
                    fontSize: 7,
                    fontFamily: PDF_FONTS.PRIMARY,
                    fontWeight: 700,
                    fill: item.value < 0 ? '#dc2626' : '#374151', // Red text for negative values
                    textAnchor: 'middle',
                  }}
                >
                  {formatValue(item.displayValue)}
                </Text>

                {/* X-axis label */}
                <Text
                  x={x + barWidth / 2}
                  y={height - padding.bottom + 15}
                  style={{
                    fontSize: 7,
                    fontFamily: PDF_FONTS.PRIMARY,
                    fill: '#374151',
                    textAnchor: 'middle',
                  }}
                >
                  {item.label.length > 12 ? item.label.substring(0, 12) + '...' : item.label}
                </Text>
              </React.Fragment>
            )
          })}

          {/* Y-axis */}
          <Line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={height - padding.bottom}
            stroke="#374151"
            strokeWidth={1.5}
          />

          {/* X-axis */}
          <Line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#374151"
            strokeWidth={1.5}
          />
        </Svg>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: COLORS.initial }]} />
          <Text style={styles.legendText}>Initial</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: COLORS.positive }]} />
          <Text style={styles.legendText}>Increase</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: COLORS.negative }]} />
          <Text style={styles.legendText}>Decrease</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: COLORS.final }]} />
          <Text style={styles.legendText}>Final</Text>
        </View>
      </View>
    </View>
  )
}
