// src/lib/pdf/components/PDFComparison.tsx
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
  comparisonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  comparisonCard: {
    width: '48%',
    border: '1 solid #e5e7eb',
    borderRadius: 4,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  comparisonCardFull: {
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
    marginBottom: 8,
  },
  valuesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  periodContainer: {
    flex: 1,
  },
  periodLabel: {
    fontSize: 7,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#9ca3af',
    marginBottom: 2,
  },
  periodValue: {
    fontSize: 14,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#111827',
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 8,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderRadius: 4,
    backgroundColor: '#f9fafb',
  },
  changeIndicator: {
    fontSize: 12,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    marginRight: 4,
  },
  changeValue: {
    fontSize: 11,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
  },
  changeLabel: {
    fontSize: 7,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#6b7280',
    marginLeft: 4,
  },
  positive: {
    color: '#059669',
  },
  negative: {
    color: '#dc2626',
  },
  neutral: {
    color: '#6b7280',
  },
  positiveBackground: {
    backgroundColor: '#ecfdf5',
  },
  negativeBackground: {
    backgroundColor: '#fef2f2',
  },
  insight: {
    fontSize: 8,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#6b7280',
    marginTop: 6,
    paddingTop: 6,
    borderTop: '1 solid #f3f4f6',
    fontStyle: 'italic',
  },
  // Multi-period styles
  multiPeriodContainer: {
    border: '1 solid #e5e7eb',
    borderRadius: 4,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  multiPeriodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  multiPeriodItem: {
    flex: 1,
    alignItems: 'center',
  },
  multiPeriodLabel: {
    fontSize: 8,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#9ca3af',
    marginBottom: 2,
    textAlign: 'center',
  },
  multiPeriodValue: {
    fontSize: 12,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#111827',
    textAlign: 'center',
  },
  changeArrow: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  changeArrowSymbol: {
    fontSize: 10,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
  },
  changeArrowPercent: {
    fontSize: 8,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
  },
  changeLabelCenter: {
    fontSize: 7,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 6,
  },
})

// Format value based on format type - shows full numbers without rounding
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
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)
    case 'percentage':
      return `${value.toFixed(2)}%`
    case 'number':
    default:
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 10,
      }).format(value)
  }
}

/**
 * Calculate percentage change between two values
 */
function calculateChange(prevValue: number, currentValue: number): number {
  if (prevValue === 0) return 0
  return ((currentValue - prevValue) / prevValue) * 100
}

// Legacy interface for backwards compatibility
interface ComparisonItem {
  label: string
  currentValue: number
  previousValue: number
  currentLabel?: string
  previousLabel?: string
  format: 'currency' | 'number' | 'percentage'
  isIncreaseGood?: boolean // Whether an increase is positive (default: true)
  insight?: string // Optional insight text
}

// New multi-period interface
interface ComparisonPeriod {
  label: string
  value: number
  format?: 'currency' | 'number' | 'percentage'
}

interface PDFComparisonProps {
  title?: string
  items?: ComparisonItem[] // Legacy format
  periods?: ComparisonPeriod[] // New multi-period format
  showChange?: boolean
  changeLabel?: string
  currency?: string
  layout?: 'grid' | 'full'
}

export const PDFComparison: React.FC<PDFComparisonProps> = ({
  title,
  items,
  periods,
  showChange = true,
  changeLabel,
  currency = 'USD',
  layout = 'grid',
}) => {
  // Handle new multi-period format
  if (periods && periods.length >= 2) {
    const format = periods[0].format || 'number'

    return (
      <View style={styles.container} wrap={true}>
        {title && <Text style={styles.title}>{title}</Text>}

        <View style={styles.multiPeriodContainer}>
          <View style={styles.multiPeriodRow}>
            {periods.map((period, index) => {
              const prevPeriod = index > 0 ? periods[index - 1] : null
              const change = prevPeriod ? calculateChange(prevPeriod.value, period.value) : null
              const isPositive = change !== null && change > 0
              const isNeutral = change === 0

              return (
                <React.Fragment key={period.label}>
                  {/* Show change indicator before this period (except for the first) */}
                  {showChange && change !== null && (
                    <View style={styles.changeArrow}>
                      <Text
                        style={[
                          styles.changeArrowSymbol,
                          isNeutral
                            ? styles.neutral
                            : isPositive
                              ? styles.positive
                              : styles.negative,
                        ]}
                      >
                        {isNeutral ? '\u2192' : isPositive ? '\u2191' : '\u2193'}
                      </Text>
                      <Text
                        style={[
                          styles.changeArrowPercent,
                          isNeutral
                            ? styles.neutral
                            : isPositive
                              ? styles.positive
                              : styles.negative,
                        ]}
                      >
                        {change.toFixed(1)}%
                      </Text>
                    </View>
                  )}

                  {/* Period value */}
                  <View style={styles.multiPeriodItem}>
                    <Text style={styles.multiPeriodLabel}>{period.label}</Text>
                    <Text style={styles.multiPeriodValue}>
                      {formatValue(
                        period.value,
                        (period.format || format) as 'currency' | 'number' | 'percentage',
                        currency
                      )}
                    </Text>
                  </View>
                </React.Fragment>
              )
            })}
          </View>
          {changeLabel && <Text style={styles.changeLabelCenter}>{changeLabel}</Text>}
        </View>
      </View>
    )
  }

  // Legacy format with items
  if (!items || items.length === 0) return null

  const renderComparison = (item: ComparisonItem, index: number) => {
    const changeValue = item.currentValue - item.previousValue
    const changePercentage =
      item.previousValue !== 0 ? (changeValue / Math.abs(item.previousValue)) * 100 : 0

    const isIncrease = changeValue > 0
    const isDecrease = changeValue < 0
    const isFlat = changeValue === 0

    const isIncreaseGood = item.isIncreaseGood !== false // Default to true
    const isGood = isFlat ? null : isIncrease ? isIncreaseGood : !isIncreaseGood

    const changeColor = isFlat ? styles.neutral : isGood ? styles.positive : styles.negative

    const changeBackground = isFlat
      ? {}
      : isGood
        ? styles.positiveBackground
        : styles.negativeBackground

    const getTrendSymbol = () => {
      if (isFlat) return '\u2192' // Right arrow
      return isIncrease ? '\u2191' : '\u2193' // Up or down arrow
    }

    const cardStyle = layout === 'full' ? styles.comparisonCardFull : styles.comparisonCard

    return (
      <View key={index} style={cardStyle}>
        <Text style={styles.label}>{item.label}</Text>

        <View style={styles.valuesRow}>
          {/* Previous Period */}
          <View style={styles.periodContainer}>
            <Text style={styles.periodLabel}>{item.previousLabel || 'Previous'}</Text>
            <Text style={styles.periodValue}>
              {formatValue(item.previousValue, item.format, currency)}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Current Period */}
          <View style={styles.periodContainer}>
            <Text style={styles.periodLabel}>{item.currentLabel || 'Current'}</Text>
            <Text style={styles.periodValue}>
              {formatValue(item.currentValue, item.format, currency)}
            </Text>
          </View>
        </View>

        {/* Change Indicator */}
        <View style={[styles.changeContainer, changeBackground]}>
          <Text style={[styles.changeIndicator, changeColor]}>{getTrendSymbol()}</Text>
          <Text style={[styles.changeValue, changeColor]}>{changePercentage.toFixed(1)}%</Text>
          <Text style={styles.changeLabel}>
            ({formatValue(Math.abs(changeValue), item.format, currency)})
          </Text>
        </View>

        {/* Optional Insight */}
        {item.insight && <Text style={styles.insight}>{item.insight}</Text>}
      </View>
    )
  }

  return (
    <View style={styles.container} wrap={true}>
      {title && <Text style={styles.title}>{title}</Text>}

      {layout === 'grid' ? (
        <View style={styles.comparisonGrid}>{items.map(renderComparison)}</View>
      ) : (
        <View>{items.map(renderComparison)}</View>
      )}
    </View>
  )
}
