'use client'

import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS } from '@/lib/pdf/fontConfig'
import type { FullItem } from '../../hooks/useBCInventoryEnhanced'

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
  blue: '#3b82f6',
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
    fontSize: 18,
    fontWeight: 700,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  filterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLORS.bgCard,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterBadgeText: {
    fontSize: 7,
    color: COLORS.textSecondary,
  },

  // Key Metrics Strip
  metricsStrip: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  metricItem: {
    minWidth: 70,
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
  },

  // Table
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
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    fontSize: 6,
    fontWeight: 600,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableRowAlt: {
    backgroundColor: COLORS.bgCard,
  },
  tableCell: {
    fontSize: 7,
    color: COLORS.textPrimary,
  },
  tableCellMuted: {
    color: COLORS.textSecondary,
  },
  tableCellMono: {
    fontFamily: PDF_FONTS.MONO,
  },

  // Badges
  abcBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 6,
    fontWeight: 600,
    textAlign: 'center',
  },
  healthBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 6,
    fontWeight: 500,
    textAlign: 'center',
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

function getABCColor(cls: 'A' | 'B' | 'C'): { bg: string; text: string } {
  if (cls === 'A') return { bg: '#fef3c7', text: '#b45309' }
  if (cls === 'B') return { bg: '#dbeafe', text: '#1d4ed8' }
  return { bg: '#f3f4f6', text: '#6b7280' }
}

function getHealthColor(score: number): { bg: string; text: string } {
  if (score >= 80) return { bg: '#dcfce7', text: '#166534' }
  if (score >= 60) return { bg: '#dbeafe', text: '#1d4ed8' }
  if (score >= 40) return { bg: '#fef3c7', text: '#b45309' }
  return { bg: '#fee2e2', text: '#991b1b' }
}

export interface ItemsListPDFProps {
  items: FullItem[]
  totalValue: number
  currency?: string
  dateRange?: { startDate: string; endDate: string }
  filters?: {
    search?: string
    category?: string
    abcClass?: string
    stockStatus?: string
  }
}

export function ItemsListPDF({
  items,
  totalValue,
  currency = 'USD',
  dateRange,
  filters,
}: ItemsListPDFProps) {
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // Build filter description
  const filterParts: string[] = []
  if (filters?.search) filterParts.push(`Search: "${filters.search}"`)
  if (filters?.category && filters.category !== 'all')
    filterParts.push(`Category: ${filters.category}`)
  if (filters?.abcClass && filters.abcClass !== 'all') filterParts.push(`ABC: ${filters.abcClass}`)
  if (filters?.stockStatus && filters.stockStatus !== 'all') {
    filterParts.push(filters.stockStatus === 'in_stock' ? 'In Stock Only' : 'Out of Stock Only')
  }
  const filterDescription = filterParts.length > 0 ? filterParts.join(' | ') : 'All Items'

  // Calculate summary stats
  const aClassCount = items.filter((i) => i.abc_class === 'A').length
  const bClassCount = items.filter((i) => i.abc_class === 'B').length
  const cClassCount = items.filter((i) => i.abc_class === 'C').length

  // Split items into pages (max ~35 per page for readability)
  const itemsPerPage = 35
  const pages: FullItem[][] = []
  for (let i = 0; i < items.length; i += itemsPerPage) {
    pages.push(items.slice(i, i + itemsPerPage))
  }

  // If no items, show single page with message
  if (pages.length === 0) {
    pages.push([])
  }

  return (
    <Document>
      {pages.map((pageItems, pageIdx) => (
        <Page key={pageIdx} size="A4" style={styles.page}>
          {/* Header (only on first page) */}
          {pageIdx === 0 && (
            <>
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <View>
                    <Text style={styles.title}>Inventory Items Report</Text>
                    <Text style={styles.subtitle}>Business Central · Full Inventory List</Text>
                  </View>
                  {dateRange && (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>
                        {dateRange.startDate} — {dateRange.endDate}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={[styles.filterBadge, { marginTop: 6, alignSelf: 'flex-start' }]}>
                  <Text style={styles.filterBadgeText}>{filterDescription}</Text>
                </View>
              </View>

              {/* Key Metrics Strip */}
              <View style={styles.metricsStrip}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Items Shown</Text>
                  <Text style={[styles.metricValue, { color: COLORS.textPrimary }]}>
                    {items.length.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Total Value</Text>
                  <Text style={[styles.metricValue, { color: COLORS.textPrimary }]}>
                    {formatCompact(totalValue, currency)}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricLabel, { color: COLORS.amber }]}>A-Class</Text>
                  <Text style={[styles.metricValue, { color: COLORS.amber }]}>{aClassCount}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricLabel, { color: COLORS.blue }]}>B-Class</Text>
                  <Text style={[styles.metricValue, { color: COLORS.blue }]}>{bClassCount}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>C-Class</Text>
                  <Text style={[styles.metricValue, { color: COLORS.textMuted }]}>
                    {cClassCount}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Table */}
          {pageItems.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { width: '5%' }]}>#</Text>
                <Text style={[styles.tableHeaderCell, { width: '25%' }]}>Item</Text>
                <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Category</Text>
                <Text style={[styles.tableHeaderCell, { width: '8%', textAlign: 'center' }]}>
                  ABC
                </Text>
                <Text style={[styles.tableHeaderCell, { width: '10%', textAlign: 'right' }]}>
                  On Hand
                </Text>
                <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>
                  Unit Cost
                </Text>
                <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>
                  Value
                </Text>
                <Text style={[styles.tableHeaderCell, { width: '8%', textAlign: 'center' }]}>
                  Health
                </Text>
                <Text style={[styles.tableHeaderCell, { width: '8%', textAlign: 'right' }]}>
                  Last Sale
                </Text>
              </View>
              {pageItems.map((item, idx) => {
                const globalIdx = pageIdx * itemsPerPage + idx
                const abcColors = getABCColor(item.abc_class)
                const healthColors =
                  item.health_score > 0 ? getHealthColor(item.health_score) : null

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
                        { width: '5%' },
                      ]}
                    >
                      {globalIdx + 1}
                    </Text>
                    <View style={{ width: '25%' }}>
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
                    <Text style={[styles.tableCell, styles.tableCellMuted, { width: '12%' }]}>
                      {item.item_category_code.length > 12
                        ? item.item_category_code.substring(0, 12) + '...'
                        : item.item_category_code}
                    </Text>
                    <View style={{ width: '8%', alignItems: 'center' }}>
                      <Text
                        style={[
                          styles.abcBadge,
                          { backgroundColor: abcColors.bg, color: abcColors.text },
                        ]}
                      >
                        {item.abc_class}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellMono,
                        { width: '10%', textAlign: 'right' },
                      ]}
                    >
                      {item.inventory.toLocaleString()}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellMuted,
                        styles.tableCellMono,
                        { width: '12%', textAlign: 'right' },
                      ]}
                    >
                      {formatCompact(item.unit_cost, currency)}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellMono,
                        { width: '12%', textAlign: 'right', fontWeight: 600 },
                      ]}
                    >
                      {formatCompact(item.inventory_value, currency)}
                    </Text>
                    <View style={{ width: '8%', alignItems: 'center' }}>
                      {healthColors ? (
                        <Text
                          style={[
                            styles.healthBadge,
                            { backgroundColor: healthColors.bg, color: healthColors.text },
                          ]}
                        >
                          {item.health_score}
                        </Text>
                      ) : (
                        <Text style={[styles.tableCell, styles.tableCellMuted]}>—</Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellMuted,
                        styles.tableCellMono,
                        { width: '8%', textAlign: 'right' },
                      ]}
                    >
                      {item.days_since_last_sale !== null ? `${item.days_since_last_sale}d` : '—'}
                    </Text>
                  </View>
                )
              })}
            </View>
          ) : (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 10, color: COLORS.textMuted }}>
                No items match your filters
              </Text>
            </View>
          )}

          {/* Legend (only on first page) */}
          {pageIdx === 0 && pageItems.length > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View
                  style={{ width: 8, height: 8, backgroundColor: COLORS.amber, borderRadius: 2 }}
                />
                <Text style={{ fontSize: 6, color: COLORS.textSecondary }}>
                  A — High Value (80%)
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View
                  style={{ width: 8, height: 8, backgroundColor: COLORS.blue, borderRadius: 2 }}
                />
                <Text style={{ fontSize: 6, color: COLORS.textSecondary }}>B — Medium (15%)</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View
                  style={{ width: 8, height: 8, backgroundColor: '#9ca3af', borderRadius: 2 }}
                />
                <Text style={{ fontSize: 6, color: COLORS.textSecondary }}>C — Low (5%)</Text>
              </View>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>Generated {generatedAt}</Text>
            <Text style={styles.pageNumber}>
              Page {pageIdx + 1} of {pages.length}
              {items.length > 0 && ` · ${items.length} items`}
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  )
}
