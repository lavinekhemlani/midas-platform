// src/lib/pdf/components/PDFTreemapChart.tsx
import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { PDF_FONTS, PDF_FONT_SIZES } from '../fontConfig'

// Styles for PDF Treemap Chart (rendered as hierarchical indented list)
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
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottom: '1 solid #f3f4f6',
  },
  itemRowLast: {
    borderBottom: 'none',
  },
  itemLabel: {
    fontSize: 10,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#374151',
    flex: 1,
  },
  itemValue: {
    fontSize: 10,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#111827',
    textAlign: 'right',
    minWidth: 80,
  },
  childContainer: {
    paddingLeft: 16,
    borderLeft: '2 solid #e5e7eb',
    marginLeft: 8,
  },
  percentageBar: {
    height: 4,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
    marginTop: 2,
  },
  percentageBarContainer: {
    height: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 2,
    marginTop: 2,
    flex: 1,
    maxWidth: 100,
    marginRight: 8,
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
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
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

interface TreemapDataPoint {
  label: string
  value: number
  children?: TreemapDataPoint[]
}

interface PDFTreemapChartProps {
  data: TreemapDataPoint[]
  title?: string
  currency?: string
  format?: 'currency' | 'number'
}

// Recursive component to render treemap items
const TreemapItem: React.FC<{
  item: TreemapDataPoint
  totalValue: number
  currency: string
  format: 'currency' | 'number'
  isLast: boolean
  depth: number
}> = ({ item, totalValue, currency, format, isLast, depth }) => {
  const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0
  const formattedValue =
    format === 'currency' ? safeFormatCurrency(item.value, currency) : formatNumber(item.value)

  // Calculate child total if there are children
  const childTotal = item.children?.reduce((sum, child) => sum + child.value, 0) ?? 0

  return (
    <View>
      <View style={[styles.itemRow, isLast && !item.children && styles.itemRowLast]}>
        <Text style={[styles.itemLabel, { paddingLeft: depth * 8 }]}>
          {depth > 0 && '└ '}
          {item.label}
        </Text>
        <View style={styles.percentageBarContainer}>
          <View style={[styles.percentageBar, { width: `${Math.min(percentage, 100)}%` }]} />
        </View>
        <Text style={styles.itemValue}>{formattedValue}</Text>
      </View>
      {item.children && item.children.length > 0 && (
        <View style={styles.childContainer}>
          {item.children.map((child, idx) => (
            <TreemapItem
              key={child.label || idx}
              item={child}
              totalValue={childTotal > 0 ? childTotal : totalValue}
              currency={currency}
              format={format}
              isLast={idx === item.children!.length - 1}
              depth={depth + 1}
            />
          ))}
        </View>
      )}
    </View>
  )
}

export const PDFTreemapChart: React.FC<PDFTreemapChartProps> = ({
  data,
  title,
  currency = 'USD',
  format = 'number',
}) => {
  if (!data || data.length === 0) return null

  // Calculate total value for percentage calculations
  const totalValue = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <View style={styles.container} wrap={true}>
      {title && <Text style={styles.title}>{title}</Text>}
      {data.map((item, idx) => (
        <TreemapItem
          key={item.label || idx}
          item={item}
          totalValue={totalValue}
          currency={currency}
          format={format}
          isLast={idx === data.length - 1}
          depth={0}
        />
      ))}
    </View>
  )
}
