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
  cyan: '#0891b2',
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.bg,
    padding: 32,
    fontFamily: PDF_FONTS.PRIMARY,
  },
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
    fontSize: 14,
    fontWeight: 700,
    fontFamily: PDF_FONTS.MONO,
  },
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
  twoColumn: {
    flexDirection: 'row',
    gap: 16,
  },
  column: {
    flex: 1,
  },
  ratioBox: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  ratioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  ratioLabel: {
    fontSize: 8,
    color: COLORS.textSecondary,
  },
  ratioValue: {
    fontSize: 10,
    fontWeight: 600,
    fontFamily: PDF_FONTS.MONO,
  },
  tableRowHeader: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tableRowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 5,
    marginTop: 4,
  },
  tableRowGrandTotal: {
    borderTopWidth: 2,
    borderTopColor: '#333',
    paddingTop: 8,
    marginTop: 8,
    backgroundColor: '#f0f0f0',
  },
  indent1: {
    paddingLeft: 12,
  },
  indent2: {
    paddingLeft: 24,
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

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

// Types
interface PnLTotals {
  totalRevenue: number
  totalCOGS: number
  grossProfit: number
  totalExpenses: number
  operatingIncome: number
  netIncome: number
}

interface IncomeStatementLine {
  lineNumber: number
  display: string
  netChange: number
  lineType: string
  indentation: number
}

interface MonthlyTrend {
  month: string
  revenue: number
  cogs: number
  expenses: number
  net_income: number
}

interface TopCustomer {
  name: string
  total_revenue: number
}

interface TopVendor {
  vendor_name: string
  total_spend: number
}

export interface PnLPDFProps {
  totals: PnLTotals | null
  lines: IncomeStatementLine[]
  monthlyTrend: MonthlyTrend[]
  topCustomers: TopCustomer[]
  topVendors: TopVendor[]
  companyName?: string | null
  currency?: string
  dateRange?: { start: string; end: string }
}

export function PnLPDF({
  totals,
  lines,
  monthlyTrend,
  topCustomers,
  topVendors,
  companyName,
  currency = 'USD',
  dateRange,
}: PnLPDFProps) {
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Calculate margins
  const grossMargin =
    totals && totals.totalRevenue !== 0 ? (totals.grossProfit / totals.totalRevenue) * 100 : 0
  const operatingMargin =
    totals && totals.totalRevenue !== 0 ? (totals.operatingIncome / totals.totalRevenue) * 100 : 0
  const netMargin =
    totals && totals.totalRevenue !== 0 ? (totals.netIncome / totals.totalRevenue) * 100 : 0

  // Filter lines for display (non-zero, meaningful rows)
  const displayLines = lines.filter((l) => l.netChange !== 0 || l.lineType === 'header')

  return (
    <Document>
      {/* Page 1: Overview & Key Metrics */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>Profit & Loss Report</Text>
              <Text style={styles.subtitle}>
                Business Central{companyName ? ` · ${companyName}` : ''}
              </Text>
            </View>
            {dateRange && (
              <View style={styles.dateBadge}>
                <Text style={styles.dateBadgeText}>
                  {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Key Metrics Strip */}
        {totals && (
          <View style={styles.metricsStrip}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Revenue</Text>
              <Text style={[styles.metricValue, { color: COLORS.green }]}>
                {formatCompact(totals.totalRevenue, currency)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>COGS</Text>
              <Text style={[styles.metricValue, { color: COLORS.red }]}>
                {formatCompact(-totals.totalCOGS, currency)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Gross Profit</Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: totals.grossProfit >= 0 ? COLORS.green : COLORS.red },
                ]}
              >
                {formatCompact(totals.grossProfit, currency)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Net Income</Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: totals.netIncome >= 0 ? COLORS.green : COLORS.red },
                ]}
              >
                {formatCompact(totals.netIncome, currency)}
              </Text>
            </View>
          </View>
        )}

        {/* Two Column: Margins + Top Customers */}
        <View style={styles.twoColumn}>
          {/* Margins */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Profit Margins</Text>
            <View style={styles.ratioBox}>
              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Gross Margin</Text>
                <Text
                  style={[
                    styles.ratioValue,
                    { color: grossMargin >= 0 ? COLORS.green : COLORS.red },
                  ]}
                >
                  {formatPercent(grossMargin)}
                </Text>
              </View>
              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Operating Margin</Text>
                <Text
                  style={[
                    styles.ratioValue,
                    { color: operatingMargin >= 0 ? COLORS.green : COLORS.red },
                  ]}
                >
                  {formatPercent(operatingMargin)}
                </Text>
              </View>
              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Net Margin</Text>
                <Text
                  style={[styles.ratioValue, { color: netMargin >= 0 ? COLORS.green : COLORS.red }]}
                >
                  {formatPercent(netMargin)}
                </Text>
              </View>
            </View>
          </View>

          {/* Top Customers */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Top Customers</Text>
            <View style={styles.ratioBox}>
              {topCustomers.length > 0 ? (
                topCustomers.slice(0, 5).map((c, idx) => (
                  <View key={idx} style={styles.ratioRow}>
                    <Text style={[styles.ratioLabel, { flex: 1 }]}>{c.name}</Text>
                    <Text style={[styles.ratioValue, { color: COLORS.green }]}>
                      {formatCompact(c.total_revenue, currency)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ fontSize: 9, color: COLORS.textMuted }}>No customer data</Text>
              )}
            </View>
          </View>
        </View>

        {/* Top Vendors */}
        <View style={[styles.section, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>Top Vendors</Text>
          <View style={[styles.ratioBox, { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }]}>
            {topVendors.length > 0 ? (
              topVendors.slice(0, 5).map((v, idx) => (
                <View key={idx} style={{ width: '45%' }}>
                  <View style={styles.ratioRow}>
                    <Text style={[styles.ratioLabel, { flex: 1 }]}>{v.vendor_name}</Text>
                    <Text style={[styles.ratioValue, { color: COLORS.amber }]}>
                      {formatCompact(v.total_spend, currency)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={{ fontSize: 9, color: COLORS.textMuted }}>No vendor data</Text>
            )}
          </View>
        </View>

        {/* Income Statement Summary */}
        {totals && (
          <View style={[styles.section, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>Income Statement Summary</Text>
            <View>
              {/* Revenue */}
              <View style={[{ flexDirection: 'row', paddingVertical: 6 }, styles.tableRowHeader]}>
                <Text style={{ flex: 3, fontSize: 9, fontWeight: 700 }}>Revenue</Text>
                <Text
                  style={{
                    flex: 1,
                    textAlign: 'right',
                    fontSize: 9,
                    fontFamily: PDF_FONTS.MONO,
                    fontWeight: 700,
                    color: COLORS.green,
                  }}
                >
                  {formatCompact(totals.totalRevenue, currency)}
                </Text>
              </View>

              {/* COGS */}
              <View
                style={[
                  {
                    flexDirection: 'row',
                    paddingVertical: 4,
                    borderBottomWidth: 0.5,
                    borderBottomColor: '#e0e0e0',
                  },
                  styles.indent1,
                ]}
              >
                <Text style={{ flex: 3, fontSize: 9, color: COLORS.textSecondary }}>
                  Cost of Goods Sold
                </Text>
                <Text
                  style={{
                    flex: 1,
                    textAlign: 'right',
                    fontSize: 9,
                    fontFamily: PDF_FONTS.MONO,
                    color: COLORS.red,
                  }}
                >
                  {formatCompact(-totals.totalCOGS, currency)}
                </Text>
              </View>

              {/* Gross Profit */}
              <View style={[{ flexDirection: 'row', paddingVertical: 4 }, styles.tableRowTotal]}>
                <Text style={{ flex: 3, fontSize: 9, fontWeight: 700 }}>Gross Profit</Text>
                <Text
                  style={[
                    {
                      flex: 1,
                      textAlign: 'right',
                      fontSize: 9,
                      fontFamily: PDF_FONTS.MONO,
                      fontWeight: 700,
                    },
                    totals.grossProfit >= 0 ? { color: COLORS.green } : { color: COLORS.red },
                  ]}
                >
                  {formatCompact(totals.grossProfit, currency)}
                </Text>
              </View>

              {/* Operating Expenses */}
              <View
                style={[
                  { flexDirection: 'row', paddingVertical: 6, marginTop: 8 },
                  styles.tableRowHeader,
                ]}
              >
                <Text style={{ flex: 3, fontSize: 9, fontWeight: 700 }}>Operating Expenses</Text>
                <Text
                  style={{
                    flex: 1,
                    textAlign: 'right',
                    fontSize: 9,
                    fontFamily: PDF_FONTS.MONO,
                    fontWeight: 700,
                    color: COLORS.red,
                  }}
                >
                  {formatCompact(-totals.totalExpenses, currency)}
                </Text>
              </View>

              {/* Operating Income */}
              <View style={[{ flexDirection: 'row', paddingVertical: 4 }, styles.tableRowTotal]}>
                <Text style={{ flex: 3, fontSize: 9, fontWeight: 700 }}>Operating Income</Text>
                <Text
                  style={[
                    {
                      flex: 1,
                      textAlign: 'right',
                      fontSize: 9,
                      fontFamily: PDF_FONTS.MONO,
                      fontWeight: 700,
                    },
                    totals.operatingIncome >= 0 ? { color: COLORS.green } : { color: COLORS.red },
                  ]}
                >
                  {formatCompact(totals.operatingIncome, currency)}
                </Text>
              </View>

              {/* Net Income */}
              <View
                style={[{ flexDirection: 'row', paddingVertical: 6 }, styles.tableRowGrandTotal]}
              >
                <Text style={{ flex: 3, fontSize: 10, fontWeight: 700 }}>Net Income</Text>
                <Text
                  style={[
                    {
                      flex: 1,
                      textAlign: 'right',
                      fontSize: 10,
                      fontFamily: PDF_FONTS.MONO,
                      fontWeight: 700,
                    },
                    totals.netIncome >= 0 ? { color: COLORS.green } : { color: COLORS.red },
                  ]}
                >
                  {formatCompact(totals.netIncome, currency)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {generatedAt}</Text>
          <Text style={styles.pageNumber}>Page 1 of 2</Text>
        </View>
      </Page>

      {/* Page 2: Monthly Trend */}
      <Page size="A4" style={styles.page}>
        {/* Monthly P&L Trend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly P&L Trend</Text>
          {monthlyTrend.length > 0 ? (
            <View>
              {/* Table Header */}
              <View
                style={[
                  {
                    flexDirection: 'row',
                    paddingVertical: 6,
                    borderBottomWidth: 1,
                    borderBottomColor: '#333',
                  },
                  { backgroundColor: COLORS.bgCard },
                ]}
              >
                <Text
                  style={{ flex: 2, fontSize: 8, fontWeight: 600, color: COLORS.textSecondary }}
                >
                  Month
                </Text>
                <Text
                  style={{
                    flex: 1.5,
                    fontSize: 8,
                    fontWeight: 600,
                    color: COLORS.green,
                    textAlign: 'right',
                  }}
                >
                  Revenue
                </Text>
                <Text
                  style={{
                    flex: 1.5,
                    fontSize: 8,
                    fontWeight: 600,
                    color: COLORS.red,
                    textAlign: 'right',
                  }}
                >
                  COGS
                </Text>
                <Text
                  style={{
                    flex: 1.5,
                    fontSize: 8,
                    fontWeight: 600,
                    color: COLORS.amber,
                    textAlign: 'right',
                  }}
                >
                  Expenses
                </Text>
                <Text
                  style={{
                    flex: 1.5,
                    fontSize: 8,
                    fontWeight: 600,
                    color: COLORS.textSecondary,
                    textAlign: 'right',
                  }}
                >
                  Net Income
                </Text>
              </View>

              {/* Table Rows */}
              {monthlyTrend.map((m, idx) => {
                const date = new Date(m.month + '-01')
                const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                return (
                  <View
                    key={m.month}
                    style={[
                      {
                        flexDirection: 'row',
                        paddingVertical: 4,
                        borderBottomWidth: 0.5,
                        borderBottomColor: '#e0e0e0',
                      },
                      idx % 2 === 0 ? { backgroundColor: COLORS.bgCard } : {},
                    ]}
                  >
                    <Text style={{ flex: 2, fontSize: 8, fontFamily: PDF_FONTS.MONO }}>
                      {label}
                    </Text>
                    <Text
                      style={{
                        flex: 1.5,
                        fontSize: 8,
                        fontFamily: PDF_FONTS.MONO,
                        textAlign: 'right',
                        color: COLORS.green,
                      }}
                    >
                      {formatCompact(m.revenue, currency)}
                    </Text>
                    <Text
                      style={{
                        flex: 1.5,
                        fontSize: 8,
                        fontFamily: PDF_FONTS.MONO,
                        textAlign: 'right',
                        color: COLORS.red,
                      }}
                    >
                      {formatCompact(-m.cogs, currency)}
                    </Text>
                    <Text
                      style={{
                        flex: 1.5,
                        fontSize: 8,
                        fontFamily: PDF_FONTS.MONO,
                        textAlign: 'right',
                        color: COLORS.amber,
                      }}
                    >
                      {formatCompact(-m.expenses, currency)}
                    </Text>
                    <Text
                      style={{
                        flex: 1.5,
                        fontSize: 8,
                        fontFamily: PDF_FONTS.MONO,
                        textAlign: 'right',
                        fontWeight: 600,
                        color: m.net_income >= 0 ? COLORS.green : COLORS.red,
                      }}
                    >
                      {m.net_income >= 0 ? '+' : ''}
                      {formatCompact(m.net_income, currency)}
                    </Text>
                  </View>
                )
              })}

              {/* Totals Row */}
              {(() => {
                const totalRevenue = monthlyTrend.reduce((s, m) => s + m.revenue, 0)
                const totalCogs = monthlyTrend.reduce((s, m) => s + m.cogs, 0)
                const totalExpenses = monthlyTrend.reduce((s, m) => s + m.expenses, 0)
                const totalNet = monthlyTrend.reduce((s, m) => s + m.net_income, 0)
                return (
                  <View
                    style={[
                      { flexDirection: 'row', paddingVertical: 6 },
                      styles.tableRowGrandTotal,
                    ]}
                  >
                    <Text style={{ flex: 2, fontSize: 9, fontWeight: 700 }}>Total</Text>
                    <Text
                      style={{
                        flex: 1.5,
                        fontSize: 9,
                        fontFamily: PDF_FONTS.MONO,
                        textAlign: 'right',
                        fontWeight: 700,
                        color: COLORS.green,
                      }}
                    >
                      {formatCompact(totalRevenue, currency)}
                    </Text>
                    <Text
                      style={{
                        flex: 1.5,
                        fontSize: 9,
                        fontFamily: PDF_FONTS.MONO,
                        textAlign: 'right',
                        fontWeight: 700,
                        color: COLORS.red,
                      }}
                    >
                      {formatCompact(-totalCogs, currency)}
                    </Text>
                    <Text
                      style={{
                        flex: 1.5,
                        fontSize: 9,
                        fontFamily: PDF_FONTS.MONO,
                        textAlign: 'right',
                        fontWeight: 700,
                        color: COLORS.amber,
                      }}
                    >
                      {formatCompact(-totalExpenses, currency)}
                    </Text>
                    <Text
                      style={{
                        flex: 1.5,
                        fontSize: 9,
                        fontFamily: PDF_FONTS.MONO,
                        textAlign: 'right',
                        fontWeight: 700,
                        color: totalNet >= 0 ? COLORS.green : COLORS.red,
                      }}
                    >
                      {totalNet >= 0 ? '+' : ''}
                      {formatCompact(totalNet, currency)}
                    </Text>
                  </View>
                )
              })()}
            </View>
          ) : (
            <Text style={{ fontSize: 9, color: COLORS.textMuted }}>No monthly trend data</Text>
          )}
        </View>

        {/* Detailed Income Statement */}
        {displayLines.length > 0 && (
          <View style={[styles.section, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>Detailed Income Statement</Text>
            <View>
              {displayLines.slice(0, 30).map((line, idx) => {
                const isHeader = line.lineType === 'header' || line.indentation === 0
                const isTotal =
                  line.lineType === 'total' || line.display.toLowerCase().includes('total')
                const indent = line.indentation > 0 ? line.indentation * 8 : 0

                return (
                  <View
                    key={idx}
                    style={[
                      {
                        flexDirection: 'row',
                        paddingVertical: isHeader ? 5 : 3,
                        borderBottomWidth: 0.5,
                        borderBottomColor: '#e0e0e0',
                        paddingLeft: indent,
                      },
                      isHeader ? styles.tableRowHeader : {},
                      isTotal ? { borderTopWidth: 1, borderTopColor: '#ccc', marginTop: 2 } : {},
                    ]}
                  >
                    <Text
                      style={[
                        { flex: 3, fontSize: isHeader ? 9 : 8 },
                        isHeader || isTotal ? { fontWeight: 700 } : { color: COLORS.textSecondary },
                      ]}
                    >
                      {line.display}
                    </Text>
                    <Text
                      style={[
                        {
                          flex: 1,
                          textAlign: 'right',
                          fontSize: isHeader ? 9 : 8,
                          fontFamily: PDF_FONTS.MONO,
                        },
                        isHeader || isTotal ? { fontWeight: 700 } : {},
                        line.netChange < 0
                          ? { color: COLORS.red }
                          : line.netChange > 0
                            ? { color: COLORS.green }
                            : {},
                      ]}
                    >
                      {line.netChange !== 0 ? formatCompact(line.netChange, currency) : ''}
                    </Text>
                  </View>
                )
              })}
              {displayLines.length > 30 && (
                <Text
                  style={{
                    fontSize: 8,
                    color: COLORS.textMuted,
                    marginTop: 8,
                    textAlign: 'center',
                  }}
                >
                  ... and {displayLines.length - 30} more line items
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {generatedAt}</Text>
          <Text style={styles.pageNumber}>Page 2 of 2</Text>
        </View>
      </Page>
    </Document>
  )
}
