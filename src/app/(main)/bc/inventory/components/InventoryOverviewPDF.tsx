'use client'

import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS } from '@/lib/pdf/fontConfig'
import type { ABCClassification, FullItem, LocationRow } from '../../hooks/useBCInventoryEnhanced'

registerPdfFonts()

// Local type definitions for data passed to PDF
interface CategoryData {
  item_category_code: string
  total_value: number
  item_count: number
  total_units?: number
}

interface TopItemData {
  item_no: string
  description: string
  inventory: number
  unit_cost: number
  inventory_value: number
  item_category_code: string
  abc_class?: 'A' | 'B' | 'C'
}

interface TurnoverData {
  cogs_annual: number
  average_inventory: number
  current_inventory: number
  turnover_ratio: number
  days_inventory_outstanding: number
}

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
    marginBottom: 16,
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
    gap: 12,
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
    fontSize: 14,
    fontWeight: 700,
    fontFamily: PDF_FONTS.MONO,
    color: COLORS.textPrimary,
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

  // Category Table
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
    letterSpacing: 0.3,
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
  tableCellMono: {
    fontFamily: PDF_FONTS.MONO,
  },

  // Turnover Box
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

  // Locations
  locationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLORS.bgCard,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  locationText: {
    fontSize: 7,
    color: COLORS.textPrimary,
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

function getTurnoverColor(ratio: number): string {
  if (ratio >= 8) return COLORS.green
  if (ratio >= 5) return COLORS.blue
  if (ratio >= 2) return COLORS.amber
  return COLORS.red
}

function getTurnoverRating(ratio: number): string {
  if (ratio >= 8) return 'Excellent'
  if (ratio >= 5) return 'Good'
  if (ratio >= 2) return 'Fair'
  return 'Poor'
}

interface SlowMovingSummary {
  totalItems: number
  totalValue: number
  zeroSalesCount: number
}

export interface InventoryOverviewPDFProps {
  overview: {
    total_items: number
    items_with_stock: number
    total_units_on_hand: number
    total_inventory_value: number
    average_unit_cost: number
  } | null
  byCategory: CategoryData[]
  abcClassification: ABCClassification
  turnover: TurnoverData | null
  slowMovingSummary: SlowMovingSummary | null
  topItemsByValue: TopItemData[]
  locations: LocationRow[]
  companyName?: string | null
  currency?: string
  dateRange?: { startDate: string; endDate: string }
}

export function InventoryOverviewPDF({
  overview,
  byCategory,
  abcClassification,
  turnover,
  slowMovingSummary,
  topItemsByValue,
  locations,
  companyName,
  currency = 'USD',
  dateRange,
}: InventoryOverviewPDFProps) {
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const totalABCValue =
    abcClassification.A.totalValue + abcClassification.B.totalValue + abcClassification.C.totalValue

  return (
    <Document>
      {/* Page 1: Overview & Key Metrics */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>Inventory Overview Report</Text>
              <Text style={styles.subtitle}>
                Business Central{companyName ? ` · ${companyName}` : ''}
              </Text>
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
        {overview && (
          <View style={styles.metricsStrip}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Total Items</Text>
              <Text style={styles.metricValue}>{overview.total_items.toLocaleString()}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>In Stock</Text>
              <Text style={styles.metricValue}>{overview.items_with_stock.toLocaleString()}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Total Value</Text>
              <Text style={styles.metricValue}>
                {formatCompact(overview.total_inventory_value, currency)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Units on Hand</Text>
              <Text style={styles.metricValue}>
                {overview.total_units_on_hand.toLocaleString()}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Avg Unit Cost</Text>
              <Text style={styles.metricValue}>
                {formatCompact(overview.average_unit_cost, currency)}
              </Text>
            </View>
          </View>
        )}

        {/* Two Column: ABC Classification + Turnover */}
        <View style={styles.twoColumn}>
          {/* ABC Classification */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>ABC Classification</Text>
            {[
              { key: 'A', label: 'A — High Value (80%)', color: COLORS.amber, bg: '#fef3c7' },
              { key: 'B', label: 'B — Medium (15%)', color: COLORS.blue, bg: '#dbeafe' },
              { key: 'C', label: 'C — Low (5%)', color: '#6b7280', bg: '#f3f4f6' },
            ].map((cls) => {
              const data = abcClassification[cls.key as keyof ABCClassification]
              return (
                <View key={cls.key} style={{ marginBottom: 8 }}>
                  <View style={[styles.abcRow, { backgroundColor: cls.bg }]}>
                    <View>
                      <Text style={[styles.abcLabel, { color: cls.color }]}>{cls.label}</Text>
                      <Text style={styles.abcCount}>{data.count} items</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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

          {/* Turnover */}
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
                  {turnover.turnover_ratio.toFixed(1)}×
                </Text>
                <Text style={styles.turnoverLabel}>
                  times per year · {getTurnoverRating(turnover.turnover_ratio)}
                </Text>
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
              <View style={styles.turnoverBox}>
                <Text style={{ fontSize: 9, color: COLORS.textMuted }}>
                  No turnover data available for this period
                </Text>
              </View>
            )}

            {/* Slow Moving Summary */}
            {slowMovingSummary && slowMovingSummary.totalItems > 0 && (
              <View style={[styles.turnoverBox, { marginTop: 12 }]}>
                <Text style={styles.sectionTitle}>Slow Moving Inventory</Text>
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}
                >
                  <View>
                    <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>Items at Risk</Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        fontFamily: PDF_FONTS.MONO,
                        color: COLORS.red,
                      }}
                    >
                      {slowMovingSummary.totalItems}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>
                      Capital at Risk
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        fontFamily: PDF_FONTS.MONO,
                        color: COLORS.red,
                      }}
                    >
                      {formatCompact(slowMovingSummary.totalValue, currency)}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>Never Sold</Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        fontFamily: PDF_FONTS.MONO,
                        color: COLORS.orange,
                      }}
                    >
                      {slowMovingSummary.zeroSalesCount}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Stock by Category */}
        <View style={[styles.section, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>Stock by Category</Text>
          {byCategory.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { width: '45%' }]}>Category</Text>
                <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'right' }]}>
                  Items
                </Text>
                <Text style={[styles.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>
                  Value
                </Text>
                <Text style={[styles.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>
                  % of Total
                </Text>
              </View>
              {byCategory.slice(0, 12).map((cat, idx) => {
                const totalValue = byCategory.reduce((s, c) => s + c.total_value, 0)
                const pct = totalValue > 0 ? ((cat.total_value / totalValue) * 100).toFixed(1) : '0'
                return (
                  <View
                    key={cat.item_category_code}
                    style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
                    wrap={false}
                  >
                    <Text style={[styles.tableCell, { width: '45%' }]}>
                      {cat.item_category_code.length > 30
                        ? cat.item_category_code.substring(0, 30) + '...'
                        : cat.item_category_code}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellMono,
                        { width: '15%', textAlign: 'right' },
                      ]}
                    >
                      {cat.item_count.toLocaleString()}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellMono,
                        { width: '20%', textAlign: 'right', fontWeight: 600 },
                      ]}
                    >
                      {formatCompact(cat.total_value, currency)}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellMono,
                        styles.tableCellMuted,
                        { width: '20%', textAlign: 'right' },
                      ]}
                    >
                      {pct}%
                    </Text>
                  </View>
                )
              })}
            </View>
          ) : (
            <Text style={{ fontSize: 9, color: COLORS.textMuted }}>No category data available</Text>
          )}
          {byCategory.length > 12 && (
            <Text
              style={{ fontSize: 8, color: COLORS.textMuted, textAlign: 'center', marginTop: 4 }}
            >
              Showing top 12 of {byCategory.length} categories
            </Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {generatedAt}</Text>
          <Text style={styles.pageNumber}>Page 1 of 2</Text>
        </View>
      </Page>

      {/* Page 2: Top Items & Locations */}
      <Page size="A4" style={styles.page}>
        {/* Top Items by Value */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Items by Value</Text>
          {topItemsByValue.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { width: '6%' }]}>#</Text>
                <Text style={[styles.tableHeaderCell, { width: '34%' }]}>Item</Text>
                <Text style={[styles.tableHeaderCell, { width: '18%' }]}>Category</Text>
                <Text style={[styles.tableHeaderCell, { width: '14%', textAlign: 'right' }]}>
                  On Hand
                </Text>
                <Text style={[styles.tableHeaderCell, { width: '14%', textAlign: 'right' }]}>
                  Value
                </Text>
                <Text style={[styles.tableHeaderCell, { width: '14%', textAlign: 'right' }]}>
                  % of Total
                </Text>
              </View>
              {topItemsByValue.slice(0, 20).map((item, idx) => {
                const pct =
                  totalABCValue > 0
                    ? ((item.inventory_value / totalABCValue) * 100).toFixed(1)
                    : '0'
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
                        styles.tableCellMono,
                        { width: '6%' },
                      ]}
                    >
                      {idx + 1}
                    </Text>
                    <View style={{ width: '34%' }}>
                      <Text style={styles.tableCell}>
                        {item.description.length > 30
                          ? item.description.substring(0, 30) + '...'
                          : item.description}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          styles.tableCellMuted,
                          styles.tableCellMono,
                          { fontSize: 6 },
                        ]}
                      >
                        {item.item_no}
                      </Text>
                    </View>
                    <Text style={[styles.tableCell, styles.tableCellMuted, { width: '18%' }]}>
                      {item.item_category_code.length > 15
                        ? item.item_category_code.substring(0, 15) + '...'
                        : item.item_category_code}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellMono,
                        { width: '14%', textAlign: 'right' },
                      ]}
                    >
                      {item.inventory.toLocaleString()}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellMono,
                        { width: '14%', textAlign: 'right', fontWeight: 600 },
                      ]}
                    >
                      {formatCompact(item.inventory_value, currency)}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellMono,
                        styles.tableCellMuted,
                        { width: '14%', textAlign: 'right' },
                      ]}
                    >
                      {pct}%
                    </Text>
                  </View>
                )
              })}
            </View>
          ) : (
            <Text style={{ fontSize: 9, color: COLORS.textMuted }}>No items to display</Text>
          )}
          {topItemsByValue.length > 20 && (
            <Text
              style={{ fontSize: 8, color: COLORS.textMuted, textAlign: 'center', marginTop: 4 }}
            >
              Showing top 20 of {topItemsByValue.length} items
            </Text>
          )}
        </View>

        {/* Locations */}
        {locations.length > 0 && (
          <View style={[styles.section, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>Locations ({locations.length})</Text>
            <View style={styles.locationsGrid}>
              {locations.slice(0, 24).map((loc) => (
                <View key={loc.code} style={styles.locationChip}>
                  <Text style={styles.locationText}>{loc.name || loc.code}</Text>
                </View>
              ))}
              {locations.length > 24 && (
                <View style={[styles.locationChip, { backgroundColor: COLORS.bgCardAlt }]}>
                  <Text style={[styles.locationText, { color: COLORS.textMuted }]}>
                    +{locations.length - 24} more
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Legend */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, backgroundColor: COLORS.amber, borderRadius: 2 }} />
            <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>A — High Value (80%)</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, backgroundColor: COLORS.blue, borderRadius: 2 }} />
            <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>B — Medium (15%)</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, backgroundColor: '#9ca3af', borderRadius: 2 }} />
            <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>C — Low (5%)</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {generatedAt}</Text>
          <Text style={styles.pageNumber}>Page 2 of 2</Text>
        </View>
      </Page>
    </Document>
  )
}
