// src/lib/pdf/components/PDFBoxplotChart.tsx
import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { PDF_FONTS, PDF_FONT_SIZES } from '../fontConfig'

// Styles for PDF Boxplot Chart (rendered as statistical summary table)
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
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottom: '2 solid #e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRowAlt: {
    backgroundColor: '#fafbfc',
  },
  tableRowLast: {
    borderBottom: 'none',
  },
  headerCell: {
    fontSize: 8,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cell: {
    fontSize: 9,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#334155',
  },
  cellBold: {
    fontWeight: 700,
    color: '#1e293b',
  },
  labelCell: {
    flex: 2,
  },
  valueCell: {
    flex: 1,
    textAlign: 'right',
  },
  statLabel: {
    fontSize: 8,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#64748b',
  },
})

// Safe currency formatter to handle invalid currency codes
function safeFormatCurrency(value: number, currency: string): string {
  if (!Number.isFinite(value)) return '$0'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }
}

// Format number
function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

// Calculate statistics from values array
function calculateStats(values: number[]): {
  min: number
  q1: number
  median: number
  q3: number
  max: number
} {
  if (!values || values.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0 }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length

  const min = sorted[0]
  const max = sorted[n - 1]
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)]

  // Calculate Q1 and Q3 using linear interpolation
  const q1Index = (n - 1) * 0.25
  const q3Index = (n - 1) * 0.75

  const q1 =
    sorted[Math.floor(q1Index)] +
    (q1Index % 1) * (sorted[Math.ceil(q1Index)] - sorted[Math.floor(q1Index)])
  const q3 =
    sorted[Math.floor(q3Index)] +
    (q3Index % 1) * (sorted[Math.ceil(q3Index)] - sorted[Math.floor(q3Index)])

  return { min, q1, median, q3, max }
}

interface BoxplotDataPoint {
  label: string
  values?: number[]
  min?: number
  q1?: number
  value?: number // median
  q3?: number
  max?: number
}

interface PDFBoxplotChartProps {
  data: BoxplotDataPoint[]
  title?: string
  currency?: string
  format?: 'currency' | 'number'
}

export const PDFBoxplotChart: React.FC<PDFBoxplotChartProps> = ({
  data,
  title,
  currency = 'USD',
  format = 'number',
}) => {
  if (!data || data.length === 0) return null

  const formatValue = (value: number | undefined): string => {
    if (value === undefined || !Number.isFinite(value)) return '-'
    return format === 'currency' ? safeFormatCurrency(value, currency) : formatNumber(value)
  }

  // Process data to ensure we have all statistics
  const processedData = data.map((item) => {
    // If we have raw values, calculate statistics
    if (item.values && item.values.length > 0) {
      const stats = calculateStats(item.values)
      return {
        label: item.label,
        ...stats,
      }
    }
    // Otherwise use provided statistics
    return {
      label: item.label,
      min: item.min ?? 0,
      q1: item.q1 ?? 0,
      median: item.value ?? 0,
      q3: item.q3 ?? 0,
      max: item.max ?? 0,
    }
  })

  return (
    <View style={styles.container} wrap={true}>
      {title && <Text style={styles.title}>{title}</Text>}

      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, styles.labelCell]}>Category</Text>
        <Text style={[styles.headerCell, styles.valueCell]}>Min</Text>
        <Text style={[styles.headerCell, styles.valueCell]}>Q1</Text>
        <Text style={[styles.headerCell, styles.valueCell]}>Median</Text>
        <Text style={[styles.headerCell, styles.valueCell]}>Q3</Text>
        <Text style={[styles.headerCell, styles.valueCell]}>Max</Text>
      </View>

      {/* Table Rows */}
      {processedData.map((item, idx) => (
        <View
          key={item.label || idx}
          style={[
            styles.tableRow,
            idx % 2 === 1 && styles.tableRowAlt,
            idx === processedData.length - 1 && styles.tableRowLast,
          ]}
        >
          <Text style={[styles.cell, styles.cellBold, styles.labelCell]}>{item.label}</Text>
          <Text style={[styles.cell, styles.valueCell]}>{formatValue(item.min)}</Text>
          <Text style={[styles.cell, styles.valueCell]}>{formatValue(item.q1)}</Text>
          <Text style={[styles.cell, styles.cellBold, styles.valueCell]}>
            {formatValue(item.median)}
          </Text>
          <Text style={[styles.cell, styles.valueCell]}>{formatValue(item.q3)}</Text>
          <Text style={[styles.cell, styles.valueCell]}>{formatValue(item.max)}</Text>
        </View>
      ))}

      {/* Legend explaining statistics */}
      <View style={{ marginTop: 8, paddingTop: 8, borderTop: '1 solid #e5e7eb' }}>
        <Text style={styles.statLabel}>
          Q1 = 25th percentile | Median = 50th percentile | Q3 = 75th percentile
        </Text>
      </View>
    </View>
  )
}
