'use client'

import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Svg,
  Rect,
  Circle,
  Line,
} from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS } from '@/lib/pdf/fontConfig'
import type { ABCClassification, StockHealth, FullItem } from '../../hooks/useBCInventoryEnhanced'

registerPdfFonts()

// Light theme colors
const COLORS = {
  bg: '#ffffff',
  bgCard: '#f9fafb',
  bgCardAlt: '#f3f4f6',
  border: '#e5e7eb',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  blue: '#2563eb',
  green: '#059669',
  amber: '#d97706',
  purple: '#7c3aed',
  red: '#dc2626',
  cyan: '#0891b2',
  orange: '#ea580c',
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.bg,
    padding: 32,
    fontFamily: PDF_FONTS.PRIMARY,
  },
  // Header
  header: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  dateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLORS.bgCard,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateBadgeText: {
    fontSize: 8,
    color: COLORS.textSecondary,
    fontFamily: PDF_FONTS.MONO,
  },

  // Key Metrics Strip
  metricsStrip: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 7,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 700,
    fontFamily: PDF_FONTS.MONO,
  },

  // Section
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: COLORS.textPrimary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Two Column Layout
  twoColumn: {
    flexDirection: 'row',
    gap: 16,
  },
  column: {
    flex: 1,
  },

  // ABC Classification
  abcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
    borderRadius: 4,
  },
  abcLabel: {
    fontSize: 9,
    fontWeight: 600,
  },
  abcStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  abcCount: {
    fontSize: 8,
    color: COLORS.textSecondary,
  },
  abcValue: {
    fontSize: 9,
    fontWeight: 600,
    fontFamily: PDF_FONTS.MONO,
  },
  abcBar: {
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },

  // Stock Health
  healthScoreBox: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  healthScoreValue: {
    fontSize: 28,
    fontWeight: 700,
    fontFamily: PDF_FONTS.MONO,
  },
  healthScoreLabel: {
    fontSize: 8,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  healthDistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 2,
    borderRadius: 4,
  },
  healthDistLabel: {
    fontSize: 8,
    fontWeight: 500,
  },
  healthDistValue: {
    fontSize: 8,
    fontFamily: PDF_FONTS.MONO,
    color: COLORS.textSecondary,
  },

  // Turnover
  turnoverBox: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  turnoverValue: {
    fontSize: 24,
    fontWeight: 700,
    fontFamily: PDF_FONTS.MONO,
  },
  turnoverLabel: {
    fontSize: 8,
    color: COLORS.textSecondary,
  },
  turnoverMetric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },

  // Slow Moving Table
  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontWeight: 600,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableRowAlt: {
    backgroundColor: COLORS.bgCard,
  },
  tableCell: {
    fontSize: 8,
    color: COLORS.textPrimary,
  },
  tableCellMuted: {
    color: COLORS.textSecondary,
  },
  riskBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 6,
    fontWeight: 600,
  },

  // Out of Stock
  outOfStockSummary: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  outOfStockBox: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: COLORS.textMuted,
  },
  pageNumber: {
    fontSize: 7,
    color: COLORS.textMuted,
    fontFamily: PDF_FONTS.MONO,
  },
})

// Format currency compactly
function formatCompact(value: number, currency: string = 'USD'): string {
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
    maximumFractionDigits: 2,
  }).format(value)
}

// Types
interface SlowMovingItem {
  item_no: string
  description: string
  inventory: number
  unit_cost: number
  inventory_value: number
  sales_qty: number
  purchases_qty: number
  turnover_ratio: number
  days_since_last_sale: number | null
}

interface TurnoverData {
  cogs_annual: number
  average_inventory: number
  current_inventory: number
  turnover_ratio: number
  days_inventory_outstanding: number
}

interface TurnoverByCategory {
  category: string
  invValue: number
  turnoverRatio: number
  dio: number
}

export interface StockAnalysisPDFProps {
  abcClassification: ABCClassification
  stockHealth: StockHealth
  turnover: TurnoverData | null
  turnoverByCategory: TurnoverByCategory[]
  slowMovingItems: SlowMovingItem[]
  outOfStockItems: FullItem[]
  totalInventoryValue: number
  itemsAnalyzed: number
  capitalAtRisk: number
  currency?: string
  dateRange?: { startDate: string; endDate: string }
}

// Helper components
function getRiskColor(daysSinceSale: number | null): { bg: string; text: string; label: string } {
  if (daysSinceSale === null) return { bg: '#fee2e2', text: '#991b1b', label: 'No Sales' }
  if (daysSinceSale > 180) return { bg: '#fee2e2', text: '#991b1b', label: 'Critical' }
  if (daysSinceSale > 90) return { bg: '#ffedd5', text: '#c2410c', label: 'High' }
  return { bg: '#fef3c7', text: '#b45309', label: 'Medium' }
}

function getHealthColor(score: number): string {
  if (score >= 80) return COLORS.green
  if (score >= 60) return COLORS.blue
  if (score >= 40) return COLORS.amber
  return COLORS.red
}

function getTurnoverColor(ratio: number): string {
  if (ratio >= 8) return COLORS.green
  if (ratio >= 5) return COLORS.blue
  if (ratio >= 2) return COLORS.amber
  return COLORS.red
}

export function StockAnalysisPDF({
  abcClassification,
  stockHealth,
  turnover,
  turnoverByCategory,
  slowMovingItems,
  outOfStockItems,
  totalInventoryValue,
  itemsAnalyzed,
  capitalAtRisk,
  currency = 'USD',
  dateRange,
}: StockAnalysisPDFProps) {
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const capitalAtRiskPct =
    totalInventoryValue > 0 ? ((capitalAtRisk / totalInventoryValue) * 100).toFixed(1) : '0'

  const withPriorSales = outOfStockItems.filter((i) => i.sales_qty > 0)

  return (
    <Document>
      {/* Page 1: Overview & Analysis */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>Stock Analysis Report</Text>
              <Text style={styles.subtitle}>Business Central · Health & Risk Assessment</Text>
            </View>
            {dateRange && (
              <View style={styles.dateBadge}>
                <Text style={styles.dateBadgeText}>
                  {dateRange.startDate} — {dateRange.endDate}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Key Metrics Strip */}
        <View style={styles.metricsStrip}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Items Analyzed</Text>
            <Text style={[styles.metricValue, { color: COLORS.textPrimary }]}>
              {itemsAnalyzed.toLocaleString()}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Total Value</Text>
            <Text style={[styles.metricValue, { color: COLORS.textPrimary }]}>
              {formatCompact(totalInventoryValue, currency)}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text
              style={[
                styles.metricLabel,
                { color: stockHealth.averageScore >= 60 ? COLORS.green : COLORS.amber },
              ]}
            >
              Avg Health
            </Text>
            <Text style={[styles.metricValue, { color: getHealthColor(stockHealth.averageScore) }]}>
              {stockHealth.averageScore}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: COLORS.red }]}>Capital at Risk</Text>
            <Text style={[styles.metricValue, { color: COLORS.red }]}>
              {formatCompact(capitalAtRisk, currency)}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Slow-Moving</Text>
            <Text style={[styles.metricValue, { color: COLORS.textPrimary }]}>
              {slowMovingItems.length}
            </Text>
          </View>
        </View>

        {/* Two Column: Stock Health + ABC Classification */}
        <View style={styles.twoColumn}>
          {/* Stock Health */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Stock Health Distribution</Text>
            <View style={styles.healthScoreBox}>
              <Text
                style={[
                  styles.healthScoreValue,
                  { color: getHealthColor(stockHealth.averageScore) },
                ]}
              >
                {stockHealth.averageScore.toFixed(1)}
              </Text>
              <Text style={styles.healthScoreLabel}>Average Score (out of 100)</Text>
            </View>
            {[
              { key: 'excellent', label: 'Excellent (80-100)', color: COLORS.green },
              { key: 'good', label: 'Good (60-79)', color: COLORS.blue },
              { key: 'fair', label: 'Fair (40-59)', color: COLORS.amber },
              { key: 'poor', label: 'Poor (0-39)', color: COLORS.red },
            ].map((item, idx) => {
              const count =
                stockHealth.distribution[item.key as keyof typeof stockHealth.distribution]
              const total = Object.values(stockHealth.distribution).reduce((a, b) => a + b, 0)
              const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0'
              return (
                <View
                  key={item.key}
                  style={[
                    styles.healthDistRow,
                    { backgroundColor: idx % 2 === 0 ? COLORS.bgCard : 'transparent' },
                  ]}
                >
                  <Text style={[styles.healthDistLabel, { color: item.color }]}>{item.label}</Text>
                  <Text style={styles.healthDistValue}>
                    {count} ({pct}%)
                  </Text>
                </View>
              )
            })}
          </View>

          {/* ABC Classification */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>ABC Classification</Text>
            {[
              { key: 'A', label: 'A — High Value', color: COLORS.amber, bg: '#fef3c7' },
              { key: 'B', label: 'B — Medium Value', color: COLORS.blue, bg: '#dbeafe' },
              { key: 'C', label: 'C — Low Value', color: '#6b7280', bg: '#f3f4f6' },
            ].map((cls) => {
              const data = abcClassification[cls.key as keyof ABCClassification]
              const totalItems =
                abcClassification.A.count + abcClassification.B.count + abcClassification.C.count
              const countPct = totalItems > 0 ? ((data.count / totalItems) * 100).toFixed(0) : '0'
              return (
                <View key={cls.key} style={{ marginBottom: 8 }}>
                  <View style={[styles.abcRow, { backgroundColor: cls.bg }]}>
                    <View>
                      <Text style={[styles.abcLabel, { color: cls.color }]}>{cls.label}</Text>
                      <Text style={styles.abcCount}>
                        {data.count} items ({countPct}% of SKUs)
                      </Text>
                    </View>
                    <View style={styles.abcStats}>
                      <Text style={[styles.abcValue, { color: cls.color }]}>
                        {data.percentage.toFixed(1)}%
                      </Text>
                      <Text style={styles.abcValue}>
                        {formatCompact(data.totalValue, currency)}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.abcBar, { backgroundColor: '#e5e7eb' }]}>
                    <View
                      style={{
                        width: `${Math.max(2, data.percentage)}%`,
                        height: '100%',
                        backgroundColor: cls.color,
                        borderRadius: 2,
                      }}
                    />
                  </View>
                </View>
              )
            })}
          </View>
        </View>

        {/* Two Column: Turnover + Turnover by Category */}
        <View style={[styles.twoColumn, { marginTop: 16 }]}>
          {/* Inventory Turnover */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Inventory Turnover</Text>
            {turnover ? (
              <View style={styles.turnoverBox}>
                <Text
                  style={[
                    styles.turnoverValue,
                    { color: getTurnoverColor(turnover.turnover_ratio) },
                  ]}
                >
                  {turnover.turnover_ratio.toFixed(1)}x
                </Text>
                <Text style={styles.turnoverLabel}>times per year</Text>
                <View style={styles.turnoverMetric}>
                  <View>
                    <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>
                      Days in Inventory
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: PDF_FONTS.MONO,
                        color: COLORS.textPrimary,
                      }}
                    >
                      {Math.round(turnover.days_inventory_outstanding)} days
                    </Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>Annual COGS</Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: PDF_FONTS.MONO,
                        color: COLORS.textPrimary,
                      }}
                    >
                      {formatCompact(turnover.cogs_annual, currency)}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <Text style={{ fontSize: 9, color: COLORS.textMuted }}>
                No turnover data available
              </Text>
            )}
          </View>

          {/* Turnover by Category */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Turnover by Category</Text>
            {turnoverByCategory.length > 0 ? (
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { width: '40%' }]}>Category</Text>
                  <Text style={[styles.tableHeaderCell, { width: '25%', textAlign: 'right' }]}>
                    Value
                  </Text>
                  <Text style={[styles.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>
                    Turnover
                  </Text>
                  <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'right' }]}>
                    DIO
                  </Text>
                </View>
                {turnoverByCategory.slice(0, 6).map((row, idx) => (
                  <View
                    key={row.category}
                    style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
                    wrap={false}
                  >
                    <Text style={[styles.tableCell, { width: '40%' }]}>
                      {row.category.length > 20
                        ? row.category.substring(0, 20) + '...'
                        : row.category}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellMuted,
                        { width: '25%', textAlign: 'right', fontFamily: PDF_FONTS.MONO },
                      ]}
                    >
                      {formatCompact(row.invValue, currency)}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        {
                          width: '20%',
                          textAlign: 'right',
                          fontFamily: PDF_FONTS.MONO,
                          color: getTurnoverColor(row.turnoverRatio),
                        },
                      ]}
                    >
                      {row.turnoverRatio.toFixed(1)}x
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellMuted,
                        { width: '15%', textAlign: 'right', fontFamily: PDF_FONTS.MONO },
                      ]}
                    >
                      {row.dio > 0 ? `${row.dio}d` : '—'}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 9, color: COLORS.textMuted }}>No category data</Text>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {generatedAt}</Text>
          <Text style={styles.pageNumber}>Page 1</Text>
        </View>
      </Page>

      {/* Page 2: Slow Moving & Out of Stock */}
      <Page size="A4" style={styles.page}>
        {/* Slow Moving Inventory */}
        <View style={styles.section}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Text style={styles.sectionTitle}>Slow Moving Inventory</Text>
            <Text
              style={{
                fontSize: 9,
                color: COLORS.red,
                fontFamily: PDF_FONTS.MONO,
                fontWeight: 600,
              }}
            >
              {formatCompact(capitalAtRisk, currency)} at risk ({capitalAtRiskPct}% of total)
            </Text>
          </View>

          {slowMovingItems.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { width: '8%' }]}>#</Text>
                <Text style={[styles.tableHeaderCell, { width: '32%' }]}>Item</Text>
                <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Risk</Text>
                <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'right' }]}>
                  On Hand
                </Text>
                <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'right' }]}>
                  Value
                </Text>
                <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'right' }]}>
                  Last Sale
                </Text>
              </View>
              {slowMovingItems.slice(0, 25).map((item, idx) => {
                const risk = getRiskColor(item.days_since_last_sale)
                return (
                  <View
                    key={item.item_no}
                    style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
                    wrap={false}
                  >
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellMuted,
                        { width: '8%', fontFamily: PDF_FONTS.MONO },
                      ]}
                    >
                      {idx + 1}
                    </Text>
                    <Text style={[styles.tableCell, { width: '32%' }]}>
                      {item.description.length > 28
                        ? item.description.substring(0, 28) + '...'
                        : item.description}
                    </Text>
                    <View style={{ width: '15%' }}>
                      <Text
                        style={[styles.riskBadge, { backgroundColor: risk.bg, color: risk.text }]}
                      >
                        {risk.label}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: '15%', textAlign: 'right', fontFamily: PDF_FONTS.MONO },
                      ]}
                    >
                      {item.inventory.toLocaleString()}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        {
                          width: '15%',
                          textAlign: 'right',
                          fontFamily: PDF_FONTS.MONO,
                          fontWeight: 600,
                        },
                      ]}
                    >
                      {formatCompact(item.inventory_value, currency)}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellMuted,
                        { width: '15%', textAlign: 'right', fontFamily: PDF_FONTS.MONO },
                      ]}
                    >
                      {item.days_since_last_sale !== null
                        ? `${item.days_since_last_sale}d`
                        : 'Never'}
                    </Text>
                  </View>
                )
              })}
            </View>
          ) : (
            <Text style={{ fontSize: 9, color: COLORS.green, textAlign: 'center', padding: 20 }}>
              No slow-moving inventory — all items have healthy turnover
            </Text>
          )}
          {slowMovingItems.length > 25 && (
            <Text
              style={{ fontSize: 8, color: COLORS.textMuted, textAlign: 'center', marginTop: 4 }}
            >
              Showing top 25 of {slowMovingItems.length} slow-moving items
            </Text>
          )}
        </View>

        {/* Out of Stock */}
        <View style={[styles.section, { marginTop: 16 }]}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Text style={styles.sectionTitle}>Out of Stock Items</Text>
            <Text
              style={{
                fontSize: 9,
                color: COLORS.red,
                fontFamily: PDF_FONTS.MONO,
                fontWeight: 600,
              }}
            >
              {outOfStockItems.length} items
            </Text>
          </View>

          <View style={styles.outOfStockSummary}>
            <View
              style={[styles.outOfStockBox, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}
            >
              <Text
                style={{ fontSize: 7, color: COLORS.textSecondary, textTransform: 'uppercase' }}
              >
                Had Prior Sales
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: PDF_FONTS.MONO,
                  color: COLORS.orange,
                }}
              >
                {withPriorSales.length}
              </Text>
            </View>
            <View
              style={[
                styles.outOfStockBox,
                { backgroundColor: COLORS.bgCard, borderColor: COLORS.border },
              ]}
            >
              <Text
                style={{ fontSize: 7, color: COLORS.textSecondary, textTransform: 'uppercase' }}
              >
                Never Sold
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: PDF_FONTS.MONO,
                  color: COLORS.textPrimary,
                }}
              >
                {outOfStockItems.length - withPriorSales.length}
              </Text>
            </View>
          </View>

          {outOfStockItems.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { width: '8%' }]}>#</Text>
                <Text style={[styles.tableHeaderCell, { width: '42%' }]}>Item</Text>
                <Text style={[styles.tableHeaderCell, { width: '25%' }]}>Category</Text>
                <Text style={[styles.tableHeaderCell, { width: '25%', textAlign: 'right' }]}>
                  Last Sale
                </Text>
              </View>
              {outOfStockItems.slice(0, 20).map((item, idx) => (
                <View
                  key={item.item_no}
                  style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
                  wrap={false}
                >
                  <Text
                    style={[
                      styles.tableCell,
                      styles.tableCellMuted,
                      { width: '8%', fontFamily: PDF_FONTS.MONO },
                    ]}
                  >
                    {idx + 1}
                  </Text>
                  <Text style={[styles.tableCell, { width: '42%' }]}>
                    {item.description.length > 35
                      ? item.description.substring(0, 35) + '...'
                      : item.description}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellMuted, { width: '25%' }]}>
                    {item.item_category_code.length > 15
                      ? item.item_category_code.substring(0, 15) + '...'
                      : item.item_category_code}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      styles.tableCellMuted,
                      { width: '25%', textAlign: 'right', fontFamily: PDF_FONTS.MONO },
                    ]}
                  >
                    {item.days_since_last_sale !== null
                      ? `${item.days_since_last_sale}d ago`
                      : item.sales_qty > 0
                        ? 'Has prior'
                        : 'Never sold'}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 9, color: COLORS.green, textAlign: 'center', padding: 20 }}>
              All active items are in stock
            </Text>
          )}
          {outOfStockItems.length > 20 && (
            <Text
              style={{ fontSize: 8, color: COLORS.textMuted, textAlign: 'center', marginTop: 4 }}
            >
              Showing first 20 of {outOfStockItems.length} out-of-stock items
            </Text>
          )}
        </View>

        {/* Risk Legend */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 16 }}>
          {[
            { label: 'No Sales / >6mo', color: '#ef4444' },
            { label: '3-6 months', color: '#f97316' },
            { label: '2-3 months', color: '#f59e0b' },
          ].map((item) => (
            <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 8, height: 8, backgroundColor: item.color, borderRadius: 2 }} />
              <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {generatedAt}</Text>
          <Text style={styles.pageNumber}>Page 2</Text>
        </View>
      </Page>
    </Document>
  )
}
