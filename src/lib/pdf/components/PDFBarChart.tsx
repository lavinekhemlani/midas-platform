// src/lib/pdf/components/PDFBarChart.tsx
import React from 'react'
import { View, Text, Svg, Rect, Line, StyleSheet } from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS, PDF_FONT_SIZES } from '../fontConfig'

// Register fonts from shared config
registerPdfFonts()

// Colors for bars
const BAR_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
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
})

// Format currency
function formatCurrency(value: number, currency: string = 'USD'): string {
  if (Math.abs(value) >= 1000000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  }
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 0,
    }).format(value)
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
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}K`
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

interface BarDataPoint {
  label: string
  value: number
}

interface PDFBarChartProps {
  data: BarDataPoint[]
  title?: string
  currency?: string
  format?: 'currency' | 'number'
  horizontal?: boolean
}

export const PDFBarChart: React.FC<PDFBarChartProps> = ({
  data,
  title,
  currency = 'USD',
  format = 'currency',
  horizontal = true,
}) => {
  if (!data || data.length === 0) return null

  // Filter out items with invalid values (NaN, undefined, null, non-finite)
  const validData = data.filter(
    (d) => d && typeof d.value === 'number' && Number.isFinite(d.value) && d.label
  )

  if (validData.length === 0) return null

  // Sort data by value descending
  const sortedData = [...validData].sort((a, b) => b.value - a.value)

  // Calculate max value for scaling, guard against division by zero and NaN
  let maxValue = Math.max(...sortedData.map((d) => Math.abs(d.value)))
  if (!Number.isFinite(maxValue) || maxValue === 0) {
    maxValue = 1 // Prevent division by zero or NaN
  }

  // SVG dimensions for horizontal bar chart
  const width = 450
  const labelWidth = 120
  const valueWidth = 70
  const barAreaWidth = width - labelWidth - valueWidth - 20
  const barHeight = 20
  const barGap = 8
  const height = sortedData.length * (barHeight + barGap) + 20

  const formatValue = (value: number) => {
    return format === 'currency' ? formatCurrency(value, currency) : formatNumber(value)
  }

  return (
    <View style={styles.container} wrap={true}>
      {title && <Text style={styles.title}>{title}</Text>}

      <View style={styles.chartWrapper}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {sortedData.map((item, index) => {
            const y = 10 + index * (barHeight + barGap)
            const barWidth = (Math.abs(item.value) / maxValue) * barAreaWidth
            const color = BAR_COLORS[index % BAR_COLORS.length]

            return (
              <React.Fragment key={index}>
                {/* Label */}
                <Text
                  x={5}
                  y={y + barHeight / 2 + 4}
                  style={{
                    fontSize: 9,
                    fontFamily: PDF_FONTS.PRIMARY,
                    fill: '#374151',
                  }}
                >
                  {item.label.length > 18 ? item.label.substring(0, 18) + '...' : item.label}
                </Text>

                {/* Bar background */}
                <Rect
                  x={labelWidth}
                  y={y}
                  width={barAreaWidth}
                  height={barHeight}
                  fill="#f3f4f6"
                  rx={3}
                />

                {/* Bar */}
                <Rect
                  x={labelWidth}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  rx={3}
                />

                {/* Value */}
                <Text
                  x={labelWidth + barAreaWidth + 10}
                  y={y + barHeight / 2 + 4}
                  style={{
                    fontSize: 9,
                    fontFamily: PDF_FONTS.PRIMARY,
                    fontWeight: 700,
                    fill: '#111827',
                  }}
                >
                  {formatValue(item.value)}
                </Text>
              </React.Fragment>
            )
          })}
        </Svg>
      </View>
    </View>
  )
}
