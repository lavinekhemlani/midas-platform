'use client'

import React from 'react'
import { Document, Page, View, Text, StyleSheet, Svg, Rect, Line } from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS } from '@/lib/pdf/fontConfig'

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
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    fontSize: 8,
    fontWeight: 600,
  },
  badgeGreen: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  badgeRed: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  badgeGray: {
    backgroundColor: '#f3f4f6',
    color: '#4b5563',
  },

  // Metrics grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  metricBox: {
    width: '31%',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  metricLabel: {
    fontSize: 7,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 700,
  },
  metricSubValue: {
    fontSize: 7,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Section
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 600,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  // Metadata grid
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metadataRow: {
    width: '50%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  metadataLabel: {
    fontSize: 8,
    color: COLORS.textSecondary,
  },
  metadataValue: {
    fontSize: 8,
    color: COLORS.textPrimary,
    fontFamily: PDF_FONTS.MONO,
  },

  // Movement summary
  movementGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  movementBox: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
  },
  movementLabel: {
    fontSize: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  movementValue: {
    fontSize: 11,
    fontWeight: 700,
  },
  movementPeriod: {
    fontSize: 7,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },

  // Chart
  chartContainer: {
    marginTop: 8,
    height: 120,
    backgroundColor: COLORS.bgCard,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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

  // Ledger page
  ledgerHeader: {
    marginBottom: 16,
  },
  ledgerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: COLORS.textPrimary,
  },
  ledgerSubtitle: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Table
  table: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 8,
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
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },
  tableCell: {
    fontSize: 8,
    color: COLORS.textPrimary,
    fontFamily: PDF_FONTS.MONO,
  },
  tableCellMuted: {
    color: COLORS.textSecondary,
  },
  entryTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 7,
    fontWeight: 500,
  },
  entryTypeSale: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  entryTypePurchase: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  entryTypeOther: {
    backgroundColor: '#f3f4f6',
    color: '#4b5563',
  },

  // Dimensions
  dimensionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    marginBottom: 4,
  },
  dimensionCode: {
    fontSize: 8,
    color: COLORS.textSecondary,
  },
  dimensionValue: {
    fontSize: 8,
    color: COLORS.textPrimary,
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
interface LedgerEntry {
  entryNumber: number
  postingDate: string
  entryType: string
  documentNumber: string
  quantity: number
  costAmountActual: number
  salesAmountActual: number
}

interface Dimension {
  dimensionCode: string
  dimensionValueCode: string
}

interface MovementByMonth {
  month: string
  purchases_cost: number
  sales_cost: number
  positive_adjustments_cost: number
  negative_adjustments_cost: number
  transfers_cost: number
}

interface ItemData {
  displayName: string
  number: string
  itemCategoryCode?: string
  inventory: number
  unitCost: number
  unitPrice: number
  baseUnitOfMeasureCode?: string
  type?: string
  gtin?: string
  generalProductPostingGroupCode?: string
  inventoryPostingGroupCode?: string
  lastModifiedDateTime?: string
  blocked?: boolean
}

export interface ItemDetailPDFProps {
  item: ItemData
  ledgerEntries: LedgerEntry[]
  dimensions: Dimension[]
  movementByMonth: MovementByMonth[]
  ledgerBasedValue?: number | null
  totalPurchased: number
  totalSold: number
  netMovement: number
  firstTransaction: string | null
  lastTransaction: string | null
  currency?: string
  abcClass?: 'A' | 'B' | 'C'
  healthScore?: number
}

// Simple bar chart component
function SimpleBarChart({
  data,
  currency,
}: {
  data: {
    month: string
    purchases: number
    sales: number
    positiveAdjustments: number
    negativeAdjustments: number
    transfers: number
  }[]
  currency: string
}) {
  if (data.length === 0) return null

  const allValues = data.flatMap((d) => [
    d.purchases,
    d.sales,
    d.positiveAdjustments,
    d.negativeAdjustments,
    d.transfers,
  ])
  const maxValue = Math.max(...allValues, 1)
  const chartWidth = 480
  const chartHeight = 80
  const seriesCount = 5
  const barWidth = Math.min(12, (chartWidth - 40) / data.length / seriesCount - 2)
  const groupWidth = barWidth * seriesCount + (seriesCount - 1) * 2 + 8

  const legendItems = [
    { label: 'Purchases', color: COLORS.blue },
    { label: 'Sales', color: COLORS.green },
    { label: 'Adj (+)', color: '#16a34a' },
    { label: 'Adj (−)', color: '#dc2626' },
    { label: 'Transfers', color: '#7c3aed' },
  ]

  return (
    <View style={styles.chartContainer}>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
        {legendItems.map((item) => (
          <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, backgroundColor: item.color, borderRadius: 2 }} />
            <Text style={{ fontSize: 6, color: COLORS.textSecondary }}>{item.label}</Text>
          </View>
        ))}
      </View>
      <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {/* Baseline */}
        <Line
          x1="0"
          y1={chartHeight - 15}
          x2={chartWidth}
          y2={chartHeight - 15}
          stroke="#e5e7eb"
          strokeWidth="1"
        />

        {data.map((d, i) => {
          const x = 20 + i * groupWidth
          const bars = [
            { value: d.purchases, color: COLORS.blue },
            { value: d.sales, color: COLORS.green },
            { value: d.positiveAdjustments, color: '#16a34a' },
            { value: d.negativeAdjustments, color: '#dc2626' },
            { value: d.transfers, color: '#7c3aed' },
          ]

          return (
            <React.Fragment key={i}>
              {bars.map((bar, j) => {
                const barHeight = (bar.value / maxValue) * (chartHeight - 25)
                return (
                  <Rect
                    key={j}
                    x={x + j * (barWidth + 2)}
                    y={chartHeight - 15 - barHeight}
                    width={barWidth}
                    height={barHeight}
                    fill={bar.color}
                    rx="2"
                  />
                )
              })}
            </React.Fragment>
          )
        })}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 4 }}>
        {data.map((d, i) => (
          <Text key={i} style={{ fontSize: 6, color: COLORS.textMuted, textAlign: 'center' }}>
            {d.month}
          </Text>
        ))}
      </View>
    </View>
  )
}

export function ItemDetailPDF({
  item,
  ledgerEntries,
  dimensions,
  movementByMonth,
  ledgerBasedValue,
  totalPurchased,
  totalSold,
  netMovement,
  firstTransaction,
  lastTransaction,
  currency = 'USD',
  abcClass,
  healthScore,
}: ItemDetailPDFProps) {
  const inventoryValue =
    ledgerBasedValue != null ? ledgerBasedValue : item.inventory * item.unitCost
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // Calculate average selling price from sale-type ledger entries
  const avgSellingPrice = (() => {
    const salesEntries = ledgerEntries.filter(
      (e) => e.entryType === 'Sale' && e.quantity !== 0 && e.salesAmountActual !== 0
    )
    if (salesEntries.length === 0) return null
    const totalSalesAmount = salesEntries.reduce((sum, e) => sum + Math.abs(e.salesAmountActual), 0)
    const totalSalesQty = salesEntries.reduce((sum, e) => sum + Math.abs(e.quantity), 0)
    return totalSalesQty > 0 ? totalSalesAmount / totalSalesQty : null
  })()

  // Format chart data
  const chartData = movementByMonth.map((m) => ({
    month: new Date(m.month + '-01').toLocaleDateString('en-US', {
      month: 'short',
    }),
    purchases: m.purchases_cost,
    sales: m.sales_cost,
    positiveAdjustments: m.positive_adjustments_cost,
    negativeAdjustments: m.negative_adjustments_cost,
    transfers: m.transfers_cost,
  }))

  // Metadata rows
  const metadata = [
    { label: 'Type', value: item.type || '—' },
    { label: 'Base UOM', value: item.baseUnitOfMeasureCode || '—' },
    { label: 'GTIN', value: item.gtin || '—' },
    { label: 'Gen. Posting Group', value: item.generalProductPostingGroupCode || '—' },
    { label: 'Inventory Posting Group', value: item.inventoryPostingGroupCode || '—' },
    {
      label: 'Last Modified',
      value: item.lastModifiedDateTime
        ? new Date(item.lastModifiedDateTime).toLocaleDateString()
        : '—',
    },
  ]

  return (
    <Document>
      {/* Page 1: Item Overview */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>{item.displayName || item.number}</Text>
              <Text style={styles.subtitle}>
                {item.number}
                {item.itemCategoryCode && ` — ${item.itemCategoryCode}`}
              </Text>
            </View>
            <View style={styles.badgeRow}>
              {item.inventory > 0 ? (
                <Text style={[styles.badge, styles.badgeGreen]}>In Stock</Text>
              ) : (
                <Text style={[styles.badge, styles.badgeRed]}>Out of Stock</Text>
              )}
              {item.blocked && <Text style={[styles.badge, styles.badgeGray]}>Blocked</Text>}
            </View>
          </View>
        </View>

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricBox, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
            <Text style={styles.metricLabel}>On Hand</Text>
            <Text style={[styles.metricValue, { color: COLORS.blue }]}>
              {item.inventory.toLocaleString()}
            </Text>
            <Text style={styles.metricSubValue}>{item.baseUnitOfMeasureCode || 'units'}</Text>
          </View>

          <View style={[styles.metricBox, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
            <Text style={styles.metricLabel}>Unit Cost</Text>
            <Text style={[styles.metricValue, { color: COLORS.orange }]}>
              {formatCompact(item.unitCost, currency)}
            </Text>
            <Text style={styles.metricSubValue}>Standard cost</Text>
          </View>

          <View style={[styles.metricBox, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
            <Text style={styles.metricLabel}>Total Value</Text>
            <Text style={[styles.metricValue, { color: COLORS.green }]}>
              {formatCompact(inventoryValue, currency)}
            </Text>
            <Text style={styles.metricSubValue}>
              {ledgerBasedValue != null ? 'Ledger cost basis' : 'Qty x Unit Cost'}
            </Text>
          </View>

          <View style={[styles.metricBox, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
            <Text style={styles.metricLabel}>Avg Sale Price</Text>
            <Text style={[styles.metricValue, { color: COLORS.purple }]}>
              {avgSellingPrice !== null ? formatCompact(avgSellingPrice, currency) : '—'}
            </Text>
            <Text style={styles.metricSubValue}>
              {avgSellingPrice !== null ? 'From transactions' : 'No sales data'}
            </Text>
          </View>

          {abcClass && (
            <View
              style={[
                styles.metricBox,
                {
                  backgroundColor:
                    abcClass === 'A' ? '#fffbeb' : abcClass === 'B' ? '#eff6ff' : '#f9fafb',
                  borderColor:
                    abcClass === 'A' ? '#fde68a' : abcClass === 'B' ? '#bfdbfe' : '#e5e7eb',
                },
              ]}
            >
              <Text style={styles.metricLabel}>ABC Class</Text>
              <Text
                style={[
                  styles.metricValue,
                  {
                    color:
                      abcClass === 'A'
                        ? COLORS.amber
                        : abcClass === 'B'
                          ? COLORS.blue
                          : COLORS.textMuted,
                  },
                ]}
              >
                {abcClass}
              </Text>
              <Text style={styles.metricSubValue}>
                {abcClass === 'A'
                  ? 'Top 80% value'
                  : abcClass === 'B'
                    ? 'Next 15% value'
                    : 'Bottom 5% value'}
              </Text>
            </View>
          )}

          {healthScore !== undefined && healthScore > 0 && (
            <View
              style={[
                styles.metricBox,
                {
                  backgroundColor:
                    healthScore >= 80
                      ? '#ecfdf5'
                      : healthScore >= 60
                        ? '#eff6ff'
                        : healthScore >= 40
                          ? '#fefce8'
                          : '#fef2f2',
                  borderColor:
                    healthScore >= 80
                      ? '#a7f3d0'
                      : healthScore >= 60
                        ? '#bfdbfe'
                        : healthScore >= 40
                          ? '#fde047'
                          : '#fecaca',
                },
              ]}
            >
              <Text style={styles.metricLabel}>Health</Text>
              <Text
                style={[
                  styles.metricValue,
                  {
                    color:
                      healthScore >= 80
                        ? COLORS.green
                        : healthScore >= 60
                          ? COLORS.blue
                          : healthScore >= 40
                            ? '#ca8a04'
                            : COLORS.red,
                  },
                ]}
              >
                {healthScore}/100
              </Text>
              <Text style={styles.metricSubValue}>
                {healthScore >= 80
                  ? 'Excellent'
                  : healthScore >= 60
                    ? 'Good'
                    : healthScore >= 40
                      ? 'Fair'
                      : 'Poor'}
              </Text>
            </View>
          )}
        </View>

        {/* Item Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Item Details</Text>
          <View style={styles.metadataGrid}>
            {metadata.map((row, i) => (
              <View key={i} style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>{row.label}</Text>
                <Text style={styles.metadataValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Period Movement */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Period Movement</Text>
          <View style={styles.movementGrid}>
            <View
              style={[styles.movementBox, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
            >
              <Text style={styles.movementLabel}>Purchased</Text>
              <Text style={[styles.movementValue, { color: COLORS.blue }]}>
                {totalPurchased.toLocaleString()}
              </Text>
            </View>
            <View
              style={[styles.movementBox, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}
            >
              <Text style={styles.movementLabel}>Sold</Text>
              <Text style={[styles.movementValue, { color: COLORS.green }]}>
                {totalSold.toLocaleString()}
              </Text>
            </View>
            <View
              style={[styles.movementBox, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}
            >
              <Text style={styles.movementLabel}>Net</Text>
              <Text
                style={[
                  styles.movementValue,
                  { color: netMovement >= 0 ? COLORS.green : COLORS.red },
                ]}
              >
                {netMovement >= 0 ? '+' : ''}
                {netMovement.toLocaleString()}
              </Text>
            </View>
          </View>
          {firstTransaction && lastTransaction && (
            <Text style={styles.movementPeriod}>
              {firstTransaction} — {lastTransaction}
            </Text>
          )}
        </View>

        {/* Monthly Movement Chart */}
        {chartData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Monthly Movement</Text>
            <SimpleBarChart data={chartData} currency={currency} />
          </View>
        )}

        {/* Dimensions */}
        {dimensions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dimensions</Text>
            {dimensions.map((dim, i) => (
              <View key={i} style={styles.dimensionRow}>
                <Text style={styles.dimensionCode}>{dim.dimensionCode}</Text>
                <Text style={styles.dimensionValue}>{dim.dimensionValueCode}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {generatedAt}</Text>
          <Text style={styles.footerText}>Business Central Inventory</Text>
        </View>
      </Page>

      {/* Page 2: Ledger Entries (if any) */}
      {ledgerEntries.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.ledgerHeader}>
            <Text style={styles.ledgerTitle}>Ledger Entries</Text>
            <Text style={styles.ledgerSubtitle}>
              {item.displayName || item.number} — {ledgerEntries.length} entries
            </Text>
          </View>

          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Date</Text>
              <Text style={[styles.tableHeaderCell, { width: '22%' }]}>Type</Text>
              <Text style={[styles.tableHeaderCell, { width: '26%' }]}>Document #</Text>
              <Text style={[styles.tableHeaderCell, { width: '18%', textAlign: 'right' }]}>
                Qty
              </Text>
              <Text style={[styles.tableHeaderCell, { width: '22%', textAlign: 'right' }]}>
                Cost
              </Text>
            </View>

            {/* Rows */}
            {ledgerEntries.slice(0, 50).map((entry, i) => (
              <View
                key={`${entry.entryNumber}-${i}`}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                wrap={false}
              >
                <Text style={[styles.tableCell, styles.tableCellMuted, { width: '12%' }]}>
                  {entry.postingDate
                    ? new Date(entry.postingDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}
                </Text>
                <View style={{ width: '22%', flexDirection: 'row' }}>
                  <Text
                    style={[
                      styles.entryTypeBadge,
                      entry.entryType === 'Sale'
                        ? styles.entryTypeSale
                        : entry.entryType === 'Purchase'
                          ? styles.entryTypePurchase
                          : styles.entryTypeOther,
                    ]}
                  >
                    {entry.entryType}
                  </Text>
                </View>
                <Text style={[styles.tableCell, styles.tableCellMuted, { width: '26%' }]}>
                  {entry.documentNumber || '—'}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    {
                      width: '18%',
                      textAlign: 'right',
                      color: entry.quantity < 0 ? COLORS.red : COLORS.textPrimary,
                    },
                  ]}
                >
                  {entry.quantity.toLocaleString()}
                </Text>
                <Text style={[styles.tableCell, { width: '22%', textAlign: 'right' }]}>
                  {formatCompact(Math.abs(entry.costAmountActual), currency)}
                </Text>
              </View>
            ))}
          </View>

          {ledgerEntries.length > 50 && (
            <Text
              style={{ fontSize: 8, color: COLORS.textMuted, textAlign: 'center', marginTop: 8 }}
            >
              Showing first 50 of {ledgerEntries.length} entries
            </Text>
          )}

          {/* Footer */}
          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>Generated {generatedAt}</Text>
            <Text style={styles.footerText}>Ledger Entries — Page 2</Text>
          </View>
        </Page>
      )}
    </Document>
  )
}
