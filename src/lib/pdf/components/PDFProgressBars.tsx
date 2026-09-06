// src/lib/pdf/components/PDFProgressBars.tsx
import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
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
  itemContainer: {
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#111827',
  },
  valueText: {
    fontSize: 9,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#6b7280',
  },
  progressBarBackground: {
    height: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    border: '1 solid #e5e7eb',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 8,
  },
  targetMarker: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: '#dc2626',
    top: 0,
  },
  percentageLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    fontSize: 8,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#111827',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
    marginTop: 12,
    paddingTop: 8,
    borderTop: '1 solid #e5e7eb',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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

// Format value based on format type
function formatValue(
  value: number,
  formatType: 'currency' | 'number' | 'percentage',
  currency: string = 'USD'
): string {
  switch (formatType) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    case 'percentage':
      return `${value.toFixed(1)}%`
    case 'number':
    default:
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
  }
}

// Get color based on progress percentage
function getProgressColor(percentage: number, target?: number): string {
  if (target) {
    const targetPercentage = (target / 100) * 100
    if (percentage >= targetPercentage) return '#059669' // Green - target met
    if (percentage >= targetPercentage * 0.8) return '#f59e0b' // Amber - close to target
    return '#dc2626' // Red - far from target
  }

  // Default color scheme without target
  if (percentage >= 90) return '#059669'
  if (percentage >= 70) return '#3b82f6'
  if (percentage >= 50) return '#f59e0b'
  return '#dc2626'
}

interface ProgressItem {
  label: string
  value: number
  max: number
  target?: number // Optional target value (same scale as max)
  format?: 'currency' | 'number' | 'percentage'
}

interface PDFProgressBarsProps {
  title?: string
  items: ProgressItem[]
  currency?: string
  showLegend?: boolean
}

export const PDFProgressBars: React.FC<PDFProgressBarsProps> = ({
  title,
  items,
  currency = 'USD',
  showLegend = false,
}) => {
  if (!items || items.length === 0) return null

  const renderProgressBar = (item: ProgressItem, index: number) => {
    const percentage = Math.min((item.value / item.max) * 100, 100)
    const targetPercentage = item.target ? (item.target / item.max) * 100 : undefined
    const color = getProgressColor(percentage, targetPercentage)
    const format = item.format || 'number'

    return (
      <View key={index} style={styles.itemContainer}>
        <View style={styles.itemHeader}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.valueText}>
            {formatValue(item.value, format, currency)} / {formatValue(item.max, format, currency)}
          </Text>
        </View>

        <View style={styles.progressBarBackground}>
          {/* Progress fill */}
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${percentage}%`,
                backgroundColor: color,
              },
            ]}
          />

          {/* Target marker */}
          {targetPercentage && (
            <View
              style={[
                styles.targetMarker,
                {
                  left: `${targetPercentage}%`,
                },
              ]}
            />
          )}

          {/* Percentage label */}
          <View style={styles.percentageLabel}>
            <Text style={styles.percentageText}>{percentage.toFixed(0)}%</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container} wrap={true}>
      {title && <Text style={styles.title}>{title}</Text>}

      <View>{items.map(renderProgressBar)}</View>

      {showLegend && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#059669' }]} />
            <Text style={styles.legendText}>Target Met</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.legendText}>In Progress</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#dc2626' }]} />
            <Text style={styles.legendText}>Needs Attention</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#dc2626', width: 2 }]} />
            <Text style={styles.legendText}>Target Line</Text>
          </View>
        </View>
      )}
    </View>
  )
}
