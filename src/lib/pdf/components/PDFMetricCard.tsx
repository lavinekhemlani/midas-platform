// src/lib/pdf/components/PDFMetricCard.tsx
import React from 'react'
import { View, Text, StyleSheet, Svg, Path } from '@react-pdf/renderer'
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '48%',
    border: '1 solid #e5e7eb',
    borderRadius: 4,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  cardFull: {
    width: '100%',
    border: '1 solid #e5e7eb',
    borderRadius: 4,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  label: {
    fontSize: 9,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  value: {
    fontSize: 20,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#111827',
  },
  valuePositive: {
    color: '#059669',
  },
  valueNegative: {
    color: '#dc2626',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  trendIndicator: {
    fontSize: 10,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    marginRight: 4,
  },
  trendText: {
    fontSize: 8,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#6b7280',
  },
  trendGood: {
    color: '#059669',
  },
  trendBad: {
    color: '#dc2626',
  },
  trendNeutral: {
    color: '#6b7280',
  },
  sparklineContainer: {
    height: 24,
    marginTop: 8,
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
      if (Math.abs(value) >= 1000000) {
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
        }).format(value / 1000000)
        return formatted + 'M'
      }
      if (Math.abs(value) >= 1000) {
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value / 1000)
        return formatted + 'K'
      }
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
        maximumFractionDigits: 2,
      }).format(value)
  }
}

// Generate sparkline path from data points
function generateSparklinePath(data: number[], width: number, height: number): string {
  if (data.length < 2) return ''

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const pointWidth = width / (data.length - 1)
  const points = data.map((value, index) => {
    const x = index * pointWidth
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  })

  return `M ${points.join(' L ')}`
}

interface Metric {
  label: string
  value: number
  format: 'currency' | 'number' | 'percentage'
  trend?: {
    direction: 'up' | 'down' | 'flat'
    value: number
    isGood: boolean
  }
  sparkline?: number[]
}

interface PDFMetricCardProps {
  title?: string
  metrics: Metric[]
  currency?: string
  layout?: 'grid' | 'full'
}

export const PDFMetricCard: React.FC<PDFMetricCardProps> = ({
  title,
  metrics,
  currency = 'USD',
  layout = 'grid',
}) => {
  if (!metrics || metrics.length === 0) return null

  const getTrendColor = (trend?: Metric['trend']) => {
    if (!trend) return styles.trendNeutral
    return trend.isGood ? styles.trendGood : styles.trendBad
  }

  const getTrendSymbol = (direction: 'up' | 'down' | 'flat') => {
    switch (direction) {
      case 'up':
        return '\u2191' // Up arrow
      case 'down':
        return '\u2193' // Down arrow
      default:
        return '\u2192' // Right arrow (flat)
    }
  }

  const getValueColor = (value: number, format: string) => {
    if (format === 'currency' || format === 'number') {
      if (value > 0) return styles.valuePositive
      if (value < 0) return styles.valueNegative
    }
    return {}
  }

  const renderMetric = (metric: Metric, index: number) => {
    const cardStyle = layout === 'full' ? styles.cardFull : styles.card

    return (
      <View key={index} style={cardStyle}>
        <Text style={styles.label}>{metric.label}</Text>

        <View style={styles.valueRow}>
          <Text style={[styles.value, getValueColor(metric.value, metric.format)]}>
            {formatValue(metric.value, metric.format, currency)}
          </Text>

          {metric.trend && (
            <View style={styles.trendContainer}>
              <Text style={[styles.trendIndicator, getTrendColor(metric.trend)]}>
                {getTrendSymbol(metric.trend.direction)}
              </Text>
              {metric.trend.direction !== 'flat' && (
                <Text style={[styles.trendText, getTrendColor(metric.trend)]}>
                  {Math.abs(metric.trend.value).toFixed(1)}%
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Sparkline */}
        {metric.sparkline && metric.sparkline.length > 1 && (
          <View style={styles.sparklineContainer}>
            <Svg width="100%" height="24" viewBox="0 0 120 24">
              <Path
                d={generateSparklinePath(metric.sparkline, 120, 24)}
                stroke={metric.trend?.isGood ? '#059669' : '#6b7280'}
                strokeWidth="2"
                fill="none"
              />
            </Svg>
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container} wrap={true}>
      {title && <Text style={styles.title}>{title}</Text>}

      {layout === 'grid' ? (
        <View style={styles.grid}>{metrics.map(renderMetric)}</View>
      ) : (
        <View>{metrics.map(renderMetric)}</View>
      )}
    </View>
  )
}
