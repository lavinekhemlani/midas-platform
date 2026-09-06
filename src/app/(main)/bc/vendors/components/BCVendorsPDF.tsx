'use client'

import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
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
  red: '#dc2626',
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

  // Key Metrics Strip
  metricsStrip: {
    flexDirection: 'row',
    gap: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  metricItem: {},
  metricLabel: {
    fontSize: 7,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 18,
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

interface BCVendor {
  id: string
  number: string
  displayName: string
  email?: string
  phoneNumber?: string
  balance: number
  currencyCode?: string
}

interface BCAgedPayable {
  vendorId: string
  vendorNumber: string
  name: string
  currencyCode?: string
  balanceDue: number
  currentAmount: number
  period1Amount: number
  period2Amount: number
  period3Amount: number
  agedAsOfDate?: string
}

interface BCVendorSummary {
  totalAP: number
  vendorCount: number
  vendorsWithBalance: number
}

export interface BCVendorsPDFProps {
  vendors: BCVendor[]
  agedPayables: BCAgedPayable[]
  summary: BCVendorSummary | null
  companyName?: string | null
  currency?: string
}

const VENDORS_PER_PAGE = 30
const PAYABLES_PER_PAGE = 25

export function BCVendorsPDF({
  vendors,
  agedPayables,
  summary,
  companyName,
  currency = 'USD',
}: BCVendorsPDFProps) {
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // Calculate totals for aged payables
  const agedTotals = agedPayables.reduce(
    (acc, ap) => ({
      balanceDue: acc.balanceDue + ap.balanceDue,
      current: acc.current + ap.currentAmount,
      period1: acc.period1 + ap.period1Amount,
      period2: acc.period2 + ap.period2Amount,
      period3: acc.period3 + ap.period3Amount,
    }),
    { balanceDue: 0, current: 0, period1: 0, period2: 0, period3: 0 }
  )

  // Paginate vendors
  const vendorPages: BCVendor[][] = []
  for (let i = 0; i < vendors.length; i += VENDORS_PER_PAGE) {
    vendorPages.push(vendors.slice(i, i + VENDORS_PER_PAGE))
  }

  // Paginate aged payables
  const payablePages: BCAgedPayable[][] = []
  for (let i = 0; i < agedPayables.length; i += PAYABLES_PER_PAGE) {
    payablePages.push(agedPayables.slice(i, i + PAYABLES_PER_PAGE))
  }

  let pageNumber = 0

  return (
    <Document>
      {/* Aged Payables Pages */}
      {payablePages.map((pagePayables, pageIdx) => {
        pageNumber++
        return (
          <Page key={`payables-${pageIdx}`} size="A4" style={styles.page}>
            {/* Header - only on first page */}
            {pageIdx === 0 && (
              <>
                <View style={styles.header}>
                  <View style={styles.titleRow}>
                    <View>
                      <Text style={styles.title}>Vendors Report</Text>
                      <Text style={styles.subtitle}>
                        {companyName ? `${companyName} · ` : ''}Business Central
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Key Metrics Strip */}
                {summary && (
                  <View style={styles.metricsStrip}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Total Vendors</Text>
                      <Text style={[styles.metricValue, { color: COLORS.textPrimary }]}>
                        {summary.vendorCount.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>
                        Total AP{currency !== 'USD' ? ` (${currency})` : ''}
                      </Text>
                      <Text style={[styles.metricValue, { color: COLORS.red }]}>
                        {formatCompact(summary.totalAP, currency)}
                      </Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>With Balance</Text>
                      <Text style={[styles.metricValue, { color: COLORS.textPrimary }]}>
                        {summary.vendorsWithBalance.toLocaleString()}
                      </Text>
                    </View>
                    {agedPayables.length > 0 && (
                      <>
                        <View style={styles.metricItem}>
                          <Text style={styles.metricLabel}>Overdue (61-90+)</Text>
                          <Text style={[styles.metricValue, { color: COLORS.orange }]}>
                            {formatCompact(agedTotals.period3, currency)}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                )}
              </>
            )}

            {/* Aged Payables Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Aged Accounts Payable{currency !== 'USD' ? ` (${currency})` : ''}
                {payablePages.length > 1 ? ` (Page ${pageIdx + 1} of ${payablePages.length})` : ''}
              </Text>

              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { width: '6%' }]}>#</Text>
                  <Text style={[styles.tableHeaderCell, { width: '30%' }]}>Vendor</Text>
                  <Text style={[styles.tableHeaderCell, { width: '16%', textAlign: 'right' }]}>
                    Balance
                  </Text>
                  <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>
                    Current
                  </Text>
                  <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>
                    1-30
                  </Text>
                  <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>
                    31-60
                  </Text>
                  <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>
                    61-90+
                  </Text>
                </View>
                {pagePayables.map((ap, idx) => {
                  const globalIdx = pageIdx * PAYABLES_PER_PAGE + idx
                  return (
                    <View
                      key={ap.vendorId || idx}
                      style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
                      wrap={false}
                    >
                      <Text
                        style={[
                          styles.tableCell,
                          styles.tableCellMuted,
                          { width: '6%', fontFamily: PDF_FONTS.MONO },
                        ]}
                      >
                        {globalIdx + 1}
                      </Text>
                      <Text style={[styles.tableCell, { width: '30%' }]}>
                        {ap.name.length > 26 ? ap.name.substring(0, 26) + '...' : ap.name}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          {
                            width: '16%',
                            textAlign: 'right',
                            fontFamily: PDF_FONTS.MONO,
                            fontWeight: 600,
                          },
                        ]}
                      >
                        {formatCompact(ap.balanceDue, currency)}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          styles.tableCellMuted,
                          { width: '12%', textAlign: 'right', fontFamily: PDF_FONTS.MONO },
                        ]}
                      >
                        {formatCompact(ap.currentAmount, currency)}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          styles.tableCellMuted,
                          { width: '12%', textAlign: 'right', fontFamily: PDF_FONTS.MONO },
                        ]}
                      >
                        {formatCompact(ap.period1Amount, currency)}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          styles.tableCellMuted,
                          { width: '12%', textAlign: 'right', fontFamily: PDF_FONTS.MONO },
                        ]}
                      >
                        {formatCompact(ap.period2Amount, currency)}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          {
                            width: '12%',
                            textAlign: 'right',
                            fontFamily: PDF_FONTS.MONO,
                            color: ap.period3Amount > 0 ? COLORS.red : COLORS.textMuted,
                            fontWeight: ap.period3Amount > 0 ? 600 : 400,
                          },
                        ]}
                      >
                        {formatCompact(ap.period3Amount, currency)}
                      </Text>
                    </View>
                  )
                })}
                {/* Totals row on last page */}
                {pageIdx === payablePages.length - 1 && (
                  <View
                    style={[
                      styles.tableRow,
                      {
                        backgroundColor: COLORS.bgCardAlt,
                        borderTopWidth: 1,
                        borderTopColor: COLORS.border,
                      },
                    ]}
                    wrap={false}
                  >
                    <Text style={[styles.tableCell, { width: '6%', fontWeight: 600 }]}></Text>
                    <Text style={[styles.tableCell, { width: '30%', fontWeight: 600 }]}>TOTAL</Text>
                    <Text
                      style={[
                        styles.tableCell,
                        {
                          width: '16%',
                          textAlign: 'right',
                          fontFamily: PDF_FONTS.MONO,
                          fontWeight: 700,
                        },
                      ]}
                    >
                      {formatCompact(agedTotals.balanceDue, currency)}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        {
                          width: '12%',
                          textAlign: 'right',
                          fontFamily: PDF_FONTS.MONO,
                          fontWeight: 600,
                        },
                      ]}
                    >
                      {formatCompact(agedTotals.current, currency)}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        {
                          width: '12%',
                          textAlign: 'right',
                          fontFamily: PDF_FONTS.MONO,
                          fontWeight: 600,
                        },
                      ]}
                    >
                      {formatCompact(agedTotals.period1, currency)}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        {
                          width: '12%',
                          textAlign: 'right',
                          fontFamily: PDF_FONTS.MONO,
                          fontWeight: 600,
                        },
                      ]}
                    >
                      {formatCompact(agedTotals.period2, currency)}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        {
                          width: '12%',
                          textAlign: 'right',
                          fontFamily: PDF_FONTS.MONO,
                          fontWeight: 700,
                          color: agedTotals.period3 > 0 ? COLORS.red : COLORS.textPrimary,
                        },
                      ]}
                    >
                      {formatCompact(agedTotals.period3, currency)}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer} fixed>
              <Text style={styles.footerText}>Generated {generatedAt}</Text>
              <Text style={styles.pageNumber}>Page {pageNumber}</Text>
            </View>
          </Page>
        )
      })}

      {/* Vendor List Pages */}
      {vendorPages.map((pageVendors, pageIdx) => {
        pageNumber++
        return (
          <Page key={`vendors-${pageIdx}`} size="A4" style={styles.page}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                All Vendors
                {vendorPages.length > 1 ? ` (Page ${pageIdx + 1} of ${vendorPages.length})` : ''}
              </Text>

              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { width: '6%' }]}>#</Text>
                  <Text style={[styles.tableHeaderCell, { width: '34%' }]}>Name</Text>
                  <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Number</Text>
                  <Text style={[styles.tableHeaderCell, { width: '30%' }]}>Email</Text>
                  <Text style={[styles.tableHeaderCell, { width: '18%', textAlign: 'right' }]}>
                    Balance
                  </Text>
                </View>
                {pageVendors.map((vendor, idx) => {
                  const globalIdx = pageIdx * VENDORS_PER_PAGE + idx
                  return (
                    <View
                      key={vendor.id || idx}
                      style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
                      wrap={false}
                    >
                      <Text
                        style={[
                          styles.tableCell,
                          styles.tableCellMuted,
                          { width: '6%', fontFamily: PDF_FONTS.MONO },
                        ]}
                      >
                        {globalIdx + 1}
                      </Text>
                      <Text style={[styles.tableCell, { width: '34%' }]}>
                        {vendor.displayName.length > 30
                          ? vendor.displayName.substring(0, 30) + '...'
                          : vendor.displayName}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          styles.tableCellMuted,
                          { width: '12%', fontFamily: PDF_FONTS.MONO },
                        ]}
                      >
                        {vendor.number}
                      </Text>
                      <Text style={[styles.tableCell, styles.tableCellMuted, { width: '30%' }]}>
                        {vendor.email
                          ? vendor.email.length > 28
                            ? vendor.email.substring(0, 28) + '...'
                            : vendor.email
                          : '—'}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          {
                            width: '18%',
                            textAlign: 'right',
                            fontFamily: PDF_FONTS.MONO,
                            fontWeight: 600,
                            color: vendor.balance > 0 ? COLORS.textPrimary : COLORS.textMuted,
                          },
                        ]}
                      >
                        {formatCompact(vendor.balance || 0, vendor.currencyCode || currency)}
                        {vendor.currencyCode && vendor.currencyCode !== currency
                          ? ` ${vendor.currencyCode}`
                          : ''}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer} fixed>
              <Text style={styles.footerText}>Generated {generatedAt}</Text>
              <Text style={styles.pageNumber}>Page {pageNumber}</Text>
            </View>
          </Page>
        )
      })}
    </Document>
  )
}
