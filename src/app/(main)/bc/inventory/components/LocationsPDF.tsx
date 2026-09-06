'use client'

import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS } from '@/lib/pdf/fontConfig'
import type { LocationRow } from '../../hooks/useBCInventoryEnhanced'

registerPdfFonts()

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
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.bg,
    padding: 32,
    fontFamily: PDF_FONTS.PRIMARY,
  },
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
  metricsStrip: {
    flexDirection: 'row',
    gap: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  metricItem: {
    minWidth: 80,
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
    color: COLORS.textPrimary,
  },
  summaryTableTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCardAlt,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRowAlt: {
    backgroundColor: COLORS.bgCard,
  },
  tableTotalRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: COLORS.bgCardAlt,
    borderTopWidth: 1,
    borderTopColor: COLORS.textSecondary,
  },
  tableHeaderText: {
    fontSize: 6.5,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: COLORS.textSecondary,
  },
  tableCellText: {
    fontSize: 7.5,
    color: COLORS.textPrimary,
  },
  tableCellMono: {
    fontSize: 7.5,
    color: COLORS.textPrimary,
    fontFamily: PDF_FONTS.MONO,
  },
  tableTotalText: {
    fontSize: 7.5,
    fontWeight: 700,
    color: COLORS.textPrimary,
    fontFamily: PDF_FONTS.MONO,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionStat: {
    fontSize: 8,
    color: COLORS.textSecondary,
    fontFamily: PDF_FONTS.MONO,
  },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationCard: {
    width: '48.5%',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  locationCode: {
    fontSize: 7,
    color: COLORS.textSecondary,
    fontFamily: PDF_FONTS.MONO,
  },
  locationName: {
    fontSize: 9,
    fontWeight: 600,
    color: COLORS.textPrimary,
    marginTop: 1,
  },
  locationAddress: {
    fontSize: 7,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  locationStats: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  locationStatBox: {
    flex: 1,
    padding: 6,
    borderRadius: 4,
  },
  locationStatLabel: {
    fontSize: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: COLORS.textSecondary,
  },
  locationStatValue: {
    fontSize: 9,
    fontWeight: 600,
    fontFamily: PDF_FONTS.MONO,
    marginTop: 2,
  },
  locationStatSub: {
    fontSize: 6,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  locationNetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  locationNetLabel: {
    fontSize: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: COLORS.textSecondary,
  },
  locationNetValue: {
    fontSize: 8,
    fontWeight: 600,
    fontFamily: PDF_FONTS.MONO,
    color: COLORS.textPrimary,
  },
  countryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: COLORS.bgCardAlt,
    borderRadius: 10,
  },
  countryBadgeText: {
    fontSize: 6,
    color: COLORS.textSecondary,
  },
  dataSourceNote: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  dataSourceText: {
    fontSize: 6.5,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
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

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString()
}

// Table column widths
const COL_WITH_STATS = {
  code: '10%',
  name: '20%',
  location: '16%',
  contact: '16%',
  netQty: '9%',
  value: '10%',
  purchases: '10%',
  sales: '9%',
}
const COL_NO_STATS = {
  code: '14%',
  name: '28%',
  location: '22%',
  contact: '36%',
}

export interface LocationsPDFProps {
  locations: LocationRow[]
  currency?: string
  dateRange?: { startDate: string; endDate: string }
}

export function LocationsPDF({ locations, currency = 'USD', dateRange }: LocationsPDFProps) {
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // Aggregate stats
  let locationsWithContact = 0
  let locationsWithAddress = 0
  let locationsWithStats = 0
  let totalInventoryValue = 0
  let totalNetQty = 0
  let totalPurchasesCost = 0
  let totalSalesCost = 0
  const countrySet = new Set<string>()

  for (const loc of locations) {
    if (loc.contact || loc.phoneNumber || loc.email) locationsWithContact++
    if (loc.city || loc.address) locationsWithAddress++
    if (loc.country) countrySet.add(loc.country)
    if (loc.inventory_stats && loc.inventory_stats.entry_count > 0) {
      locationsWithStats++
      totalInventoryValue += loc.inventory_stats.total_cost
      totalNetQty += loc.inventory_stats.net_quantity
      totalPurchasesCost += loc.inventory_stats.purchases_cost
      totalSalesCost += loc.inventory_stats.sales_cost
    }
  }
  const hasInventoryStats = locationsWithStats > 0

  // Sort by inventory value desc, or name asc
  const sortedForTable = [...locations].sort((a, b) => {
    if (hasInventoryStats) {
      return (b.inventory_stats?.total_cost ?? 0) - (a.inventory_stats?.total_cost ?? 0)
    }
    return a.name.localeCompare(b.name)
  })

  // Paginate table rows
  const tableRowsPerPage = 28
  const tablePages: LocationRow[][] = []
  for (let i = 0; i < sortedForTable.length; i += tableRowsPerPage) {
    tablePages.push(sortedForTable.slice(i, i + tableRowsPerPage))
  }

  // Paginate cards
  const cardsPerPage = hasInventoryStats ? 8 : 10
  const cardPages: LocationRow[][] = []
  for (let i = 0; i < sortedForTable.length; i += cardsPerPage) {
    cardPages.push(sortedForTable.slice(i, i + cardsPerPage))
  }

  const totalPages = tablePages.length + cardPages.length
  const COL = hasInventoryStats ? COL_WITH_STATS : COL_NO_STATS

  return (
    <Document>
      {/* ── Summary Table Pages ── */}
      {tablePages.map((tableRows, tpIdx) => (
        <Page key={`table-${tpIdx}`} size="A4" style={styles.page}>
          {tpIdx === 0 && (
            <>
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <View>
                    <Text style={styles.title}>Locations Report</Text>
                    <Text style={styles.subtitle}>Business Central · Warehouse & Fulfillment</Text>
                  </View>
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeText}>
                      {dateRange
                        ? `${dateRange.startDate} — ${dateRange.endDate}`
                        : `Generated ${generatedAt}`}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.metricsStrip}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Total Locations</Text>
                  <Text style={styles.metricValue}>{locations.length}</Text>
                </View>
                {hasInventoryStats ? (
                  <>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Total Inventory Value</Text>
                      <Text style={styles.metricValue}>
                        {formatCompact(totalInventoryValue, currency)}
                      </Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Net Quantity</Text>
                      <Text style={styles.metricValue}>{formatNumber(totalNetQty)}</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>With Stock Data</Text>
                      <Text style={styles.metricValue}>{locationsWithStats}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>With Address</Text>
                      <Text style={styles.metricValue}>{locationsWithAddress}</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>With Contact Info</Text>
                      <Text style={styles.metricValue}>{locationsWithContact}</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Countries</Text>
                      <Text style={styles.metricValue}>{countrySet.size}</Text>
                    </View>
                  </>
                )}
              </View>

              <Text style={styles.summaryTableTitle}>
                {hasInventoryStats ? 'Location Inventory Summary' : 'Location Directory'}
              </Text>
            </>
          )}

          {/* Table */}
          <View>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderText, { width: COL.code }]}>Code</Text>
              <Text style={[styles.tableHeaderText, { width: COL.name }]}>Name</Text>
              <Text style={[styles.tableHeaderText, { width: COL.location }]}>City / Country</Text>
              <Text style={[styles.tableHeaderText, { width: COL.contact }]}>Contact</Text>
              {hasInventoryStats && (
                <>
                  <Text
                    style={[
                      styles.tableHeaderText,
                      { width: (COL as typeof COL_WITH_STATS).netQty, textAlign: 'right' },
                    ]}
                  >
                    Net Qty
                  </Text>
                  <Text
                    style={[
                      styles.tableHeaderText,
                      { width: (COL as typeof COL_WITH_STATS).value, textAlign: 'right' },
                    ]}
                  >
                    Value
                  </Text>
                  <Text
                    style={[
                      styles.tableHeaderText,
                      { width: (COL as typeof COL_WITH_STATS).purchases, textAlign: 'right' },
                    ]}
                  >
                    Purchases
                  </Text>
                  <Text
                    style={[
                      styles.tableHeaderText,
                      { width: (COL as typeof COL_WITH_STATS).sales, textAlign: 'right' },
                    ]}
                  >
                    Sales
                  </Text>
                </>
              )}
            </View>

            {tableRows.map((loc, idx) => {
              const stats = loc.inventory_stats
              const cityCountry = [loc.city, loc.country].filter(Boolean).join(', ')
              const contactName = loc.contact || loc.phoneNumber || loc.email || ''

              return (
                <View
                  key={loc.code}
                  style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
                  wrap={false}
                >
                  <Text
                    style={[
                      styles.tableCellMono,
                      { width: COL.code, fontSize: 6.5, color: COLORS.textSecondary },
                    ]}
                  >
                    {loc.code}
                  </Text>
                  <Text style={[styles.tableCellText, { width: COL.name, fontWeight: 500 }]}>
                    {loc.name.length > 24 ? loc.name.substring(0, 24) + '...' : loc.name}
                  </Text>
                  <Text
                    style={[
                      styles.tableCellText,
                      { width: COL.location, fontSize: 6.5, color: COLORS.textSecondary },
                    ]}
                  >
                    {cityCountry.length > 20 ? cityCountry.substring(0, 20) + '...' : cityCountry}
                  </Text>
                  <Text
                    style={[
                      styles.tableCellText,
                      { width: COL.contact, fontSize: 6.5, color: COLORS.textSecondary },
                    ]}
                  >
                    {contactName.length > 22
                      ? contactName.substring(0, 22) + '...'
                      : contactName || '—'}
                  </Text>
                  {hasInventoryStats && (
                    <>
                      <Text
                        style={[
                          styles.tableCellMono,
                          {
                            width: (COL as typeof COL_WITH_STATS).netQty,
                            textAlign: 'right',
                            fontSize: 7,
                          },
                        ]}
                      >
                        {stats && stats.entry_count > 0 ? formatNumber(stats.net_quantity) : '—'}
                      </Text>
                      <Text
                        style={[
                          styles.tableCellMono,
                          {
                            width: (COL as typeof COL_WITH_STATS).value,
                            textAlign: 'right',
                            fontSize: 7,
                            fontWeight: 600,
                          },
                        ]}
                      >
                        {stats && stats.entry_count > 0
                          ? formatCompact(stats.total_cost, currency)
                          : '—'}
                      </Text>
                      <Text
                        style={[
                          styles.tableCellMono,
                          {
                            width: (COL as typeof COL_WITH_STATS).purchases,
                            textAlign: 'right',
                            fontSize: 7,
                            color: COLORS.green,
                          },
                        ]}
                      >
                        {stats && stats.entry_count > 0
                          ? formatCompact(stats.purchases_cost, currency)
                          : '—'}
                      </Text>
                      <Text
                        style={[
                          styles.tableCellMono,
                          {
                            width: (COL as typeof COL_WITH_STATS).sales,
                            textAlign: 'right',
                            fontSize: 7,
                            color: COLORS.blue,
                          },
                        ]}
                      >
                        {stats && stats.entry_count > 0
                          ? formatCompact(stats.sales_cost, currency)
                          : '—'}
                      </Text>
                    </>
                  )}
                </View>
              )
            })}

            {/* Totals row on last table page */}
            {tpIdx === tablePages.length - 1 && hasInventoryStats && (
              <View style={styles.tableTotalRow}>
                <Text style={[styles.tableTotalText, { width: COL.code }]}></Text>
                <Text
                  style={[
                    styles.tableTotalText,
                    { width: COL.name, fontFamily: PDF_FONTS.PRIMARY },
                  ]}
                >
                  Total ({locations.length} locations)
                </Text>
                <Text style={[styles.tableTotalText, { width: COL.location }]}></Text>
                <Text style={[styles.tableTotalText, { width: COL.contact }]}></Text>
                <Text
                  style={[
                    styles.tableTotalText,
                    {
                      width: (COL as typeof COL_WITH_STATS).netQty,
                      textAlign: 'right',
                    },
                  ]}
                >
                  {formatNumber(totalNetQty)}
                </Text>
                <Text
                  style={[
                    styles.tableTotalText,
                    {
                      width: (COL as typeof COL_WITH_STATS).value,
                      textAlign: 'right',
                    },
                  ]}
                >
                  {formatCompact(totalInventoryValue, currency)}
                </Text>
                <Text
                  style={[
                    styles.tableTotalText,
                    {
                      width: (COL as typeof COL_WITH_STATS).purchases,
                      textAlign: 'right',
                      color: COLORS.green,
                    },
                  ]}
                >
                  {formatCompact(totalPurchasesCost, currency)}
                </Text>
                <Text
                  style={[
                    styles.tableTotalText,
                    {
                      width: (COL as typeof COL_WITH_STATS).sales,
                      textAlign: 'right',
                      color: COLORS.blue,
                    },
                  ]}
                >
                  {formatCompact(totalSalesCost, currency)}
                </Text>
              </View>
            )}
          </View>

          {/* Data source note on last table page */}
          {tpIdx === tablePages.length - 1 && (
            <View style={styles.dataSourceNote}>
              <Text style={styles.dataSourceText}>
                {hasInventoryStats
                  ? 'Source: BC API v2.0 → locations (master data) + OData Web Service → Item Ledger Entries with Location_Code. Net Qty = Σ ledger.quantity per location. Value = Σ |ledger.costAmountActual| per location. Purchases/Sales filtered by entry type.'
                  : 'Source: BC API v2.0 → companies({companyId})/locations. Per-location inventory stats not available (requires OData Web Service exposing Location_Code on Item Ledger Entries).'}
              </Text>
            </View>
          )}

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>Generated {generatedAt}</Text>
            <Text style={styles.pageNumber}>
              Page {tpIdx + 1} of {totalPages}
            </Text>
          </View>
        </Page>
      ))}

      {/* ── Detail Card Pages ── */}
      {cardPages.map((pageLocations, pageIdx) => (
        <Page key={`cards-${pageIdx}`} size="A4" style={styles.page}>
          {pageIdx === 0 && (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Location Details</Text>
              <Text style={styles.sectionStat}>{locations.length} locations</Text>
            </View>
          )}

          <View style={styles.locationGrid}>
            {pageLocations.map((loc) => {
              const addressParts = [loc.address, loc.addressLine2].filter(Boolean)
              const cityLine = [loc.city, loc.state, loc.postalCode].filter(Boolean).join(', ')
              const hasContact = loc.contact || loc.phoneNumber || loc.email
              const stats = loc.inventory_stats
              const hasStats = stats && stats.entry_count > 0

              return (
                <View key={loc.code} style={styles.locationCard} wrap={false}>
                  <View>
                    <Text style={styles.locationCode}>{loc.code}</Text>
                    <Text style={styles.locationName}>
                      {loc.name.length > 30 ? loc.name.substring(0, 30) + '...' : loc.name}
                    </Text>
                    {(addressParts.length > 0 || cityLine) && (
                      <View style={{ marginTop: 2 }}>
                        {addressParts.map((line, i) => (
                          <Text key={i} style={styles.locationAddress}>
                            {line}
                          </Text>
                        ))}
                        {cityLine && <Text style={styles.locationAddress}>{cityLine}</Text>}
                      </View>
                    )}
                  </View>

                  {hasContact && (
                    <View
                      style={{
                        marginTop: 8,
                        paddingTop: 8,
                        borderTopWidth: 1,
                        borderTopColor: COLORS.border,
                        gap: 3,
                      }}
                    >
                      {loc.contact && (
                        <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>
                          Contact: {loc.contact}
                        </Text>
                      )}
                      {loc.phoneNumber && (
                        <Text
                          style={{
                            fontSize: 7,
                            color: COLORS.textSecondary,
                            fontFamily: PDF_FONTS.MONO,
                          }}
                        >
                          Phone: {loc.phoneNumber}
                        </Text>
                      )}
                      {loc.email && (
                        <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>
                          Email: {loc.email}
                        </Text>
                      )}
                      {loc.website && (
                        <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>
                          Web: {loc.website}
                        </Text>
                      )}
                    </View>
                  )}

                  {hasStats && (
                    <View style={styles.locationStats}>
                      <View style={[styles.locationStatBox, { backgroundColor: '#f0fdf4' }]}>
                        <Text style={styles.locationStatLabel}>Purchases</Text>
                        <Text style={[styles.locationStatValue, { color: COLORS.green }]}>
                          {formatCompact(stats.purchases_cost, currency)}
                        </Text>
                        <Text style={styles.locationStatSub}>
                          {stats.purchases_qty.toLocaleString()} units
                        </Text>
                      </View>
                      <View style={[styles.locationStatBox, { backgroundColor: '#eff6ff' }]}>
                        <Text style={styles.locationStatLabel}>Sales</Text>
                        <Text style={[styles.locationStatValue, { color: COLORS.blue }]}>
                          {formatCompact(stats.sales_cost, currency)}
                        </Text>
                        <Text style={styles.locationStatSub}>
                          {stats.sales_qty.toLocaleString()} units
                        </Text>
                      </View>
                      <View style={[styles.locationStatBox, { backgroundColor: '#fffbeb' }]}>
                        <Text style={styles.locationStatLabel}>Items</Text>
                        <Text style={[styles.locationStatValue, { color: COLORS.amber }]}>
                          {stats.unique_items}
                        </Text>
                        <Text style={styles.locationStatSub}>{stats.entry_count} entries</Text>
                      </View>
                    </View>
                  )}

                  {hasStats && (
                    <View style={styles.locationNetRow}>
                      <View>
                        <Text style={styles.locationNetLabel}>Net Qty</Text>
                        <Text style={styles.locationNetValue}>
                          {formatNumber(stats.net_quantity)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.locationNetLabel}>Value</Text>
                        <Text style={styles.locationNetValue}>
                          {formatCompact(stats.total_cost, currency)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {loc.country && !hasStats && (
                    <View style={[styles.countryBadge, { marginTop: 6, alignSelf: 'flex-start' }]}>
                      <Text style={styles.countryBadgeText}>{loc.country}</Text>
                    </View>
                  )}
                </View>
              )
            })}
          </View>

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>Generated {generatedAt}</Text>
            <Text style={styles.pageNumber}>
              Page {tablePages.length + pageIdx + 1} of {totalPages}
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  )
}
