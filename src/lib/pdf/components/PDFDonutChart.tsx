// src/lib/pdf/components/PDFDonutChart.tsx
import React from 'react'
import { View, Text, Svg, Path, StyleSheet } from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS, PDF_FONT_SIZES } from '../fontConfig'

// Register fonts from shared config
registerPdfFonts()

// Colors for donut chart segments
const DONUT_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#ec4899', // pink
  '#14b8a6', // teal
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
  chartContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 15,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    width: 400,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 4,
  },
  legendColor: {
    width: 10,
    height: 10,
    marginRight: 6,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 9,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#111827',
    flex: 1,
  },
  legendValue: {
    fontSize: 9,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#111827',
    marginLeft: 8,
  },
  centerText: {
    position: 'absolute',
    textAlign: 'center',
  },
  totalLabel: {
    fontSize: 8,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#6b7280',
  },
  totalValue: {
    fontSize: 12,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#111827',
  },
})

// Format currency (compact for large values)
function formatCurrency(value: number, currency: string = 'USD'): string {
  if (Math.abs(value) >= 1e6) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
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
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

// Calculate donut slice path
function calculateDonutSlicePath(
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const startRad = (startAngle * Math.PI) / 180
  const endRad = (endAngle * Math.PI) / 180

  // Outer arc points
  const outerX1 = centerX + outerRadius * Math.cos(startRad)
  const outerY1 = centerY + outerRadius * Math.sin(startRad)
  const outerX2 = centerX + outerRadius * Math.cos(endRad)
  const outerY2 = centerY + outerRadius * Math.sin(endRad)

  // Inner arc points
  const innerX1 = centerX + innerRadius * Math.cos(startRad)
  const innerY1 = centerY + innerRadius * Math.sin(startRad)
  const innerX2 = centerX + innerRadius * Math.cos(endRad)
  const innerY2 = centerY + innerRadius * Math.sin(endRad)

  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

  // Move to outer start, arc to outer end, line to inner end, arc back to inner start, close
  return `
    M ${outerX1} ${outerY1}
    A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerX2} ${outerY2}
    L ${innerX2} ${innerY2}
    A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerX1} ${innerY1}
    Z
  `
}

interface DonutDataPoint {
  label: string
  value: number
}

interface PDFDonutChartProps {
  data: DonutDataPoint[]
  title?: string
  currency?: string
  format?: 'currency' | 'number'
}

export const PDFDonutChart: React.FC<PDFDonutChartProps> = ({
  data,
  title,
  currency = 'USD',
  format = 'currency',
}) => {
  if (!data || data.length === 0) return null

  // Filter and sort data
  const filteredData = data.filter((d) => d.value > 0)
  const sortedData = [...filteredData].sort((a, b) => b.value - a.value)

  // Calculate total and percentages
  const total = sortedData.reduce((sum, d) => sum + d.value, 0)
  const dataWithPercentages = sortedData.map((d) => ({
    ...d,
    percentage: (d.value / total) * 100,
  }))

  // SVG dimensions
  const size = 180
  const centerX = size / 2
  const centerY = size / 2
  const outerRadius = 80
  const innerRadius = 50

  // Calculate slices
  let currentAngle = -90
  const slices = dataWithPercentages.map((item, index) => {
    const sliceAngle = (item.percentage / 100) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + sliceAngle
    const path = calculateDonutSlicePath(
      centerX,
      centerY,
      outerRadius,
      innerRadius,
      startAngle,
      endAngle
    )
    currentAngle = endAngle

    return {
      ...item,
      path,
      color: DONUT_COLORS[index % DONUT_COLORS.length],
    }
  })

  const formatValue = (value: number) => {
    return format === 'currency' ? formatCurrency(value, currency) : formatNumber(value)
  }

  return (
    <View style={styles.container} wrap={true}>
      {title && <Text style={styles.title}>{title}</Text>}

      <View style={styles.chartContainer}>
        {/* Donut Chart SVG */}
        <View>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {slices.map((slice, index) => (
              <Path
                key={index}
                d={slice.path}
                fill={slice.color}
                stroke="#ffffff"
                strokeWidth={1}
              />
            ))}
          </Svg>
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          {slices.slice(0, 8).map((slice, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: slice.color }]} />
              <Text style={styles.legendLabel}>{slice.label}</Text>
              <Text style={styles.legendValue}>
                {formatValue(slice.value)} ({slice.percentage.toFixed(1)}%)
              </Text>
            </View>
          ))}
          {slices.length > 8 && (
            <Text style={[styles.legendLabel, { fontStyle: 'italic' }]}>
              +{slices.length - 8} more items
            </Text>
          )}
        </View>
      </View>
    </View>
  )
}
