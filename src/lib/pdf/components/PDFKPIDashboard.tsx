// src/lib/pdf/components/PDFKPIDashboard.tsx
import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS } from '../fontConfig'

// Register fonts from shared config
registerPdfFonts()

const styles = StyleSheet.create({
  // Main container with professional styling - NO overflow hidden
  container: {
    marginVertical: 12,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    border: '1 solid #e2e8f0',
  },
  // Professional title header
  titleHeader: {
    backgroundColor: '#1e3a5f',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottom: '3 solid #d4af37',
  },
  title: {
    fontSize: 13,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  // Metrics grid
  metricsGrid: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  rowLast: {
    marginBottom: 0,
  },
  // Individual metric card
  metricCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    padding: 12,
    marginHorizontal: 4,
    border: '1 solid #e2e8f0',
  },
  metricCardFirst: {
    marginLeft: 0,
  },
  metricCardLast: {
    marginRight: 0,
  },
  // Metric label
  label: {
    fontSize: 8,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  // Value container - stacked layout to prevent overlap
  valueContainer: {
    flexDirection: 'column',
  },
  // Main value
  value: {
    fontSize: 16,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#1e293b',
  },
  // Smaller value for long text
  valueSmall: {
    fontSize: 12,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#1e293b',
  },
  valuePositive: {
    color: '#059669',
  },
  valueNegative: {
    color: '#dc2626',
  },
  // Trend indicator - now below value
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  trendGoodBg: {
    backgroundColor: '#d1fae5',
  },
  trendBadBg: {
    backgroundColor: '#fee2e2',
  },
  trendNeutralBg: {
    backgroundColor: '#f1f5f9',
  },
  trendText: {
    fontSize: 9,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 600,
  },
  trendGood: {
    color: '#059669',
  },
  trendBad: {
    color: '#dc2626',
  },
  trendNeutral: {
    color: '#64748b',
  },
  // Subtext
  subtext: {
    fontSize: 8,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#94a3b8',
    marginTop: 4,
  },
})

// Format value based on format type
function formatValue(
  value: number | string,
  formatType: 'currency' | 'number' | 'percentage',
  currency: string = 'USD'
): string {
  // Handle string values (like "≈ 300 characters")
  if (typeof value === 'string') {
    return value
  }

  switch (formatType) {
    case 'currency':
      // Use compact notation for large numbers
      if (Math.abs(value) >= 1000000) {
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
        maximumFractionDigits: 2,
      }).format(value)
    case 'percentage':
      return `${value.toFixed(1)}%`
    case 'number':
    default:
      if (Math.abs(value) >= 1000000) {
        return new Intl.NumberFormat('en-US', {
          notation: 'compact',
          maximumFractionDigits: 1,
        }).format(value)
      }
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value)
  }
}

// Chunk array into groups of n
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

interface KPIMetric {
  label: string
  value: number | string
  format: 'currency' | 'number' | 'percentage'
  subtext?: string
  trend?: {
    direction: 'up' | 'down' | 'flat'
    value: number
    isGood?: boolean
  }
}

interface PDFKPIDashboardProps {
  title?: string
  metrics: KPIMetric[]
  currency?: string
  columns?: number
}

export const PDFKPIDashboard: React.FC<PDFKPIDashboardProps> = ({
  title,
  metrics,
  currency = 'USD',
  columns = 3,
}) => {
  if (!metrics || metrics.length === 0) return null

  const getTrendStyle = (trend?: KPIMetric['trend']) => {
    if (!trend) return { bg: styles.trendNeutralBg, text: styles.trendNeutral }
    const isGood = trend.isGood ?? trend.direction === 'up'
    return isGood
      ? { bg: styles.trendGoodBg, text: styles.trendGood }
      : { bg: styles.trendBadBg, text: styles.trendBad }
  }

  const getTrendSymbol = (direction: 'up' | 'down' | 'flat') => {
    switch (direction) {
      case 'up':
        return '↑'
      case 'down':
        return '↓'
      default:
        return '→'
    }
  }

  const getValueColor = (value: number | string, format: string) => {
    if (typeof value === 'string') return {}
    if (format === 'currency' || format === 'number') {
      if (value > 0) return styles.valuePositive
      if (value < 0) return styles.valueNegative
    }
    return {}
  }

  // Chunk metrics into rows
  const rows = chunkArray(metrics, columns)

  return (
    <View style={styles.container} wrap={true}>
      {/* Professional title header */}
      {title && (
        <View style={styles.titleHeader}>
          <Text style={styles.title}>{title}</Text>
        </View>
      )}

      {/* Metrics grid */}
      <View style={styles.metricsGrid}>
        {rows.map((rowMetrics, rowIndex) => {
          const isLastRow = rowIndex === rows.length - 1
          const rowStyle = {
            ...styles.row,
            ...(isLastRow ? styles.rowLast : {}),
          }
          return (
            <View key={rowIndex} style={rowStyle}>
              {rowMetrics.map((metric, colIndex) => {
                const isFirst = colIndex === 0
                const isLast = colIndex === rowMetrics.length - 1
                const trendStyle = getTrendStyle(metric.trend)

                const cardStyle = {
                  ...styles.metricCard,
                  ...(isFirst ? styles.metricCardFirst : {}),
                  ...(isLast ? styles.metricCardLast : {}),
                }

                const trendContainerStyle = { ...styles.trendContainer, ...trendStyle.bg }
                const trendTextStyle = { ...styles.trendText, ...trendStyle.text }

                // Check if value is long (string values tend to be longer)
                const formattedValue = formatValue(metric.value, metric.format, currency)
                const isLongValue = formattedValue.length > 10

                // Use smaller font for long values to prevent overflow
                const valueStyle = {
                  ...(isLongValue ? styles.valueSmall : styles.value),
                  ...getValueColor(metric.value, metric.format),
                }

                return (
                  <View key={colIndex} style={cardStyle}>
                    <Text style={styles.label}>{metric.label}</Text>
                    <View style={styles.valueContainer}>
                      <Text style={valueStyle}>{formattedValue}</Text>
                      {metric.trend && (
                        <View style={trendContainerStyle}>
                          <Text style={trendTextStyle}>
                            {getTrendSymbol(metric.trend.direction)} {metric.trend.value.toFixed(1)}
                            %
                          </Text>
                        </View>
                      )}
                    </View>
                    {metric.subtext && <Text style={styles.subtext}>{metric.subtext}</Text>}
                  </View>
                )
              })}
              {/* Fill empty cells */}
              {rowMetrics.length < columns &&
                Array.from({ length: columns - rowMetrics.length }).map((_, i) => (
                  <View key={`empty-${i}`} style={{ ...styles.metricCard, opacity: 0 }} />
                ))}
            </View>
          )
        })}
      </View>
    </View>
  )
}
