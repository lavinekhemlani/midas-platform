// src/lib/pdf/components/PDFPieChart.tsx
import React from 'react'
import { View, Text, Svg, Path, StyleSheet, Font } from '@react-pdf/renderer'

// Register Noto Sans for full Unicode support (including ₱ and other currency symbols)
// Using Google's Noto fonts GitHub repo for complete character coverage
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

// Flat colors for PDF pie charts
const PDF_PIE_COLORS = [
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

// Styles for PDF Pie Chart
const styles = StyleSheet.create({
  pieChartContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  pieChartSvg: {
    marginBottom: 20,
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
    width: '45%',
  },
  legendColor: {
    width: 12,
    height: 12,
    marginRight: 6,
  },
  legendText: {
    fontSize: 9,
    fontFamily: 'Noto Sans',
    color: '#374151',
    flex: 1,
  },
  legendValue: {
    fontSize: 9,
    fontFamily: 'Noto Sans',
    fontWeight: 700,
    color: '#111827',
    marginLeft: 4,
  },
})

// Format currency helper
function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Calculate SVG path for pie slice (for fill)
function calculatePieSlicePath(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const startRadians = (startAngle * Math.PI) / 180
  const endRadians = (endAngle * Math.PI) / 180

  const x1 = centerX + radius * Math.cos(startRadians)
  const y1 = centerY + radius * Math.sin(startRadians)
  const x2 = centerX + radius * Math.cos(endRadians)
  const y2 = centerY + radius * Math.sin(endRadians)

  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

  return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`
}

// Calculate SVG path for outer arc only (for stroke)
function calculateArcPath(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const startRadians = (startAngle * Math.PI) / 180
  const endRadians = (endAngle * Math.PI) / 180

  const x1 = centerX + radius * Math.cos(startRadians)
  const y1 = centerY + radius * Math.sin(startRadians)
  const x2 = centerX + radius * Math.cos(endRadians)
  const y2 = centerY + radius * Math.sin(endRadians)

  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

  // Only the arc, no lines to center
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`
}

// PDF Pie Chart Component
export const PDFPieChart: React.FC<{
  data: any[]
  title?: string
  currency?: string
}> = ({ data, title, currency = 'USD' }) => {
  if (!data || data.length === 0) return null

  // Process data to calculate percentages and totals
  const processedData = data
    .filter((item) => {
      // Filter out negative or zero values (e.g., discounts, refunds)
      const rawValue = item.value || item.amount || 0
      return rawValue >= 0
    })
    .map((item) => {
      const value = Math.abs(item.value || item.amount || 0)
      const name = item.name || item.category || item.label || 'Unknown'
      return { name, value }
    })

  // Recalculate percentages based on filtered positive values
  const total = processedData.reduce((sum, item) => sum + item.value, 0)
  const dataWithPercentages = processedData.map((item) => ({
    ...item,
    // Always recalculate percentage based on the new total (after filtering negatives)
    percentage: (item.value / total) * 100,
  }))

  // Sort by value descending
  const sortedData = [...dataWithPercentages].sort((a, b) => b.value - a.value)

  // Calculate pie slices
  const centerX = 200
  const centerY = 200
  const radius = 120
  let currentAngle = -90 // Start at top

  const slices = sortedData.map((item, index) => {
    const sliceAngle = (item.percentage / 100) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + sliceAngle
    const fillPath = calculatePieSlicePath(centerX, centerY, radius, startAngle, endAngle)
    const arcPath = calculateArcPath(centerX, centerY, radius, startAngle, endAngle)
    currentAngle = endAngle

    return {
      ...item,
      fillPath,
      arcPath,
      color: PDF_PIE_COLORS[index % PDF_PIE_COLORS.length],
    }
  })

  return (
    <View style={styles.pieChartContainer}>
      {title && <Text style={styles.chartTitle}>{title}</Text>}

      {/* Pie Chart SVG */}
      <Svg width="400" height="400" viewBox="0 0 400 400" style={styles.pieChartSvg}>
        {slices.map((slice, index) => (
          <React.Fragment key={index}>
            {/* Fill the slice without stroke */}
            <Path d={slice.fillPath} fill={slice.color} stroke="none" />
            {/* Stroke only the outer arc */}
            <Path d={slice.arcPath} fill="none" stroke="#000000" strokeWidth={2} />
          </React.Fragment>
        ))}
      </Svg>

      {/* Legend */}
      <View style={styles.legendGrid}>
        {slices.map((slice, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: slice.color }]} />
            <Text style={styles.legendText}>
              {index + 1}. {slice.name}
            </Text>
            <Text style={styles.legendValue}>
              {formatCurrency(slice.value, currency)} ({slice.percentage.toFixed(1)}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
