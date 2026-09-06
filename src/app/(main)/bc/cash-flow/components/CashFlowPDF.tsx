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

// Types
interface CashFlowStatementData {
  beginningCash: number
  operatingActivities: {
    netIncome: number
    adjustments: {
      depreciation: number
      accountsReceivableChange: number
      inventoryChange: number
      accountsPayableChange: number
      prepaidChange: number
      accruedLiabilitiesChange: number
      deferredRevenueChange: number
      otherAdjustments: number
    }
    totalOperating: number
  }
  investingActivities: {
    capitalExpenditures: number
    assetSales: number
    investments: number
    totalInvesting: number
  }
  financingActivities: {
    debtProceeds: number
    debtRepayments: number
    equityChanges: number
    dividends: number
    totalFinancing: number
  }
  netCashChange: number
  endingCash: number
}

interface MonthlyTrendAccount {
  accountNumber: string
  accountName: string
  inflow: number
  outflow: number
  netChange: number
}

interface MonthlyTrend {
  month: string
  inflow: number
  outflow: number
  netChange: number
  runningBalance: number
  accounts?: MonthlyTrendAccount[]
}

interface CashFlowMetrics {
  operatingCashFlow: number
  freeCashFlow: number
  cashRunway: number | null
  burnRate: number
}

export interface CashFlowPDFProps {
  statement: CashFlowStatementData | null
  monthlyTrend: MonthlyTrend[]
  metrics: CashFlowMetrics | null
  companyName?: string | null
  currency?: string
  dateRange?: { start: string; end: string }
}

export function CashFlowPDF({
  statement,
  monthlyTrend,
  metrics,
  companyName,
  currency = 'USD',
  dateRange,
}: CashFlowPDFProps) {
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

  return (
    <Document>
      {/* Page 1: Overview & Key Metrics */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>Cash Flow Report</Text>
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
        {statement && (
          <View style={styles.metricsStrip}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Operating</Text>
              <Text
                style={[
                  styles.metricValue,
                  {
                    color:
                      statement.operatingActivities.totalOperating >= 0 ? COLORS.green : COLORS.red,
                  },
                ]}
              >
                {formatCompact(statement.operatingActivities.totalOperating, currency)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Investing</Text>
              <Text
                style={[
                  styles.metricValue,
                  {
                    color:
                      statement.investingActivities.totalInvesting >= 0 ? COLORS.green : COLORS.red,
                  },
                ]}
              >
                {formatCompact(statement.investingActivities.totalInvesting, currency)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Financing</Text>
              <Text
                style={[
                  styles.metricValue,
                  {
                    color:
                      statement.financingActivities.totalFinancing >= 0 ? COLORS.green : COLORS.red,
                  },
                ]}
              >
                {formatCompact(statement.financingActivities.totalFinancing, currency)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Net Change</Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: statement.netCashChange >= 0 ? COLORS.green : COLORS.red },
                ]}
              >
                {formatCompact(statement.netCashChange, currency)}
              </Text>
            </View>
          </View>
        )}

        {/* Two Column: Cash Flow Metrics + Cash Position */}
        <View style={styles.twoColumn}>
          {/* Cash Flow Metrics */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Cash Flow Metrics</Text>
            <View style={styles.ratioBox}>
              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Operating Cash Flow</Text>
                <Text
                  style={[
                    styles.ratioValue,
                    { color: (metrics?.operatingCashFlow ?? 0) >= 0 ? COLORS.green : COLORS.red },
                  ]}
                >
                  {metrics?.operatingCashFlow != null
                    ? formatCompact(metrics.operatingCashFlow, currency)
                    : '—'}
                </Text>
              </View>
              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Free Cash Flow</Text>
                <Text
                  style={[
                    styles.ratioValue,
                    { color: (metrics?.freeCashFlow ?? 0) >= 0 ? COLORS.green : COLORS.red },
                  ]}
                >
                  {metrics?.freeCashFlow != null
                    ? formatCompact(metrics.freeCashFlow, currency)
                    : '—'}
                </Text>
              </View>
              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Monthly Burn Rate</Text>
                <Text style={[styles.ratioValue, { color: COLORS.textPrimary }]}>
                  {metrics?.burnRate != null ? formatCompact(metrics.burnRate, currency) : '—'}
                </Text>
              </View>
              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Cash Runway</Text>
                <Text
                  style={[
                    styles.ratioValue,
                    {
                      color:
                        metrics?.cashRunway === null
                          ? (metrics?.burnRate ?? 0) <= 0
                            ? COLORS.green
                            : COLORS.red
                          : (metrics?.cashRunway ?? 0) >= 12
                            ? COLORS.green
                            : (metrics?.cashRunway ?? 0) >= 6
                              ? COLORS.amber
                              : COLORS.red,
                    },
                  ]}
                >
                  {metrics?.cashRunway != null
                    ? `${metrics.cashRunway.toFixed(1)} months`
                    : (metrics?.burnRate ?? 0) <= 0
                      ? '∞'
                      : '0.0 months'}
                </Text>
              </View>
            </View>
          </View>

          {/* Cash Position */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Cash Position</Text>
            {statement ? (
              <View style={styles.ratioBox}>
                <View style={styles.ratioRow}>
                  <Text style={styles.ratioLabel}>Beginning Cash</Text>
                  <Text style={[styles.ratioValue, { color: COLORS.textPrimary }]}>
                    {formatCompact(statement.beginningCash, currency)}
                  </Text>
                </View>
                <View style={styles.ratioRow}>
                  <Text style={styles.ratioLabel}>Net Cash Change</Text>
                  <Text
                    style={[
                      styles.ratioValue,
                      { color: statement.netCashChange >= 0 ? COLORS.green : COLORS.red },
                    ]}
                  >
                    {statement.netCashChange >= 0 ? '+' : ''}
                    {formatCompact(statement.netCashChange, currency)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.ratioRow,
                    {
                      borderTopWidth: 1,
                      borderTopColor: COLORS.border,
                      marginTop: 4,
                      paddingTop: 4,
                    },
                  ]}
                >
                  <Text style={[styles.ratioLabel, { fontWeight: 600 }]}>Ending Cash</Text>
                  <Text style={[styles.ratioValue, { color: COLORS.green }]}>
                    {formatCompact(statement.endingCash, currency)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.ratioBox}>
                <Text style={{ fontSize: 9, color: COLORS.textMuted }}>No cash position data</Text>
              </View>
            )}
          </View>
        </View>

        {/* Cash Flow Statement */}
        {statement && (
          <View style={[styles.section, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>Statement of Cash Flows</Text>
            <View>
              {/* Beginning Cash */}
              <View
                style={[
                  {
                    flexDirection: 'row',
                    paddingVertical: 4,
                    borderBottomWidth: 0.5,
                    borderBottomColor: '#e0e0e0',
                  },
                  styles.tableRowTotal,
                ]}
              >
                <Text style={{ flex: 3, fontSize: 9, fontWeight: 700 }}>
                  Beginning Cash Balance
                </Text>
                <Text
                  style={{
                    flex: 1,
                    textAlign: 'right',
                    fontSize: 9,
                    fontFamily: PDF_FONTS.MONO,
                    fontWeight: 700,
                  }}
                >
                  {formatCompact(statement.beginningCash, currency)}
                </Text>
              </View>

              {/* Operating Activities */}
              <View
                style={[
                  { flexDirection: 'row', paddingVertical: 6, marginTop: 8 },
                  styles.tableRowHeader,
                ]}
              >
                <Text style={{ flex: 3, fontSize: 9, fontWeight: 700 }}>Operating Activities</Text>
                <Text style={{ flex: 1, textAlign: 'right', fontSize: 9 }}></Text>
              </View>
              {[
                { name: 'Net Income', amount: statement.operatingActivities.netIncome },
                {
                  name: 'Depreciation & Amortization',
                  amount: statement.operatingActivities.adjustments.depreciation,
                },
                {
                  name: 'Change in Accounts Receivable',
                  amount: statement.operatingActivities.adjustments.accountsReceivableChange,
                },
                {
                  name: 'Change in Inventory',
                  amount: statement.operatingActivities.adjustments.inventoryChange,
                },
                {
                  name: 'Change in Accounts Payable',
                  amount: statement.operatingActivities.adjustments.accountsPayableChange,
                },
                {
                  name: 'Change in Prepaid Expenses',
                  amount: statement.operatingActivities.adjustments.prepaidChange,
                },
                {
                  name: 'Change in Accrued Liabilities',
                  amount: statement.operatingActivities.adjustments.accruedLiabilitiesChange,
                },
                {
                  name: 'Change in Deferred Revenue',
                  amount: statement.operatingActivities.adjustments.deferredRevenueChange,
                },
              ]
                .filter((item) => item.amount != null && isFinite(item.amount) && item.amount !== 0)
                .map((item, idx) => (
                  <View
                    key={idx}
                    style={[
                      {
                        flexDirection: 'row',
                        paddingVertical: 3,
                        borderBottomWidth: 0.5,
                        borderBottomColor: '#e0e0e0',
                      },
                      styles.indent1,
                    ]}
                  >
                    <Text style={{ flex: 3, fontSize: 9, color: COLORS.textSecondary }}>
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        { flex: 1, textAlign: 'right', fontSize: 9, fontFamily: PDF_FONTS.MONO },
                        item.amount < 0 ? { color: COLORS.red } : {},
                      ]}
                    >
                      {formatCompact(item.amount, currency)}
                    </Text>
                  </View>
                ))}
              <View style={[{ flexDirection: 'row', paddingVertical: 4 }, styles.tableRowTotal]}>
                <Text style={{ flex: 3, fontSize: 9, fontWeight: 700 }}>
                  Net Cash from Operating
                </Text>
                <Text
                  style={[
                    {
                      flex: 1,
                      textAlign: 'right',
                      fontSize: 9,
                      fontFamily: PDF_FONTS.MONO,
                      fontWeight: 700,
                    },
                    statement.operatingActivities.totalOperating < 0
                      ? { color: COLORS.red }
                      : { color: COLORS.green },
                  ]}
                >
                  {formatCompact(statement.operatingActivities.totalOperating, currency)}
                </Text>
              </View>

              {/* Investing Activities */}
              <View
                style={[
                  { flexDirection: 'row', paddingVertical: 6, marginTop: 8 },
                  styles.tableRowHeader,
                ]}
              >
                <Text style={{ flex: 3, fontSize: 9, fontWeight: 700 }}>Investing Activities</Text>
                <Text style={{ flex: 1, textAlign: 'right', fontSize: 9 }}></Text>
              </View>
              {[
                {
                  name: 'Capital Expenditures',
                  amount: statement.investingActivities.capitalExpenditures,
                },
                { name: 'Asset Sales', amount: statement.investingActivities.assetSales },
                { name: 'Investments', amount: statement.investingActivities.investments },
              ]
                .filter((item) => item.amount != null && isFinite(item.amount) && item.amount !== 0)
                .map((item, idx) => (
                  <View
                    key={idx}
                    style={[
                      {
                        flexDirection: 'row',
                        paddingVertical: 3,
                        borderBottomWidth: 0.5,
                        borderBottomColor: '#e0e0e0',
                      },
                      styles.indent1,
                    ]}
                  >
                    <Text style={{ flex: 3, fontSize: 9, color: COLORS.textSecondary }}>
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        { flex: 1, textAlign: 'right', fontSize: 9, fontFamily: PDF_FONTS.MONO },
                        item.amount < 0 ? { color: COLORS.red } : {},
                      ]}
                    >
                      {formatCompact(item.amount, currency)}
                    </Text>
                  </View>
                ))}
              <View style={[{ flexDirection: 'row', paddingVertical: 4 }, styles.tableRowTotal]}>
                <Text style={{ flex: 3, fontSize: 9, fontWeight: 700 }}>
                  Net Cash from Investing
                </Text>
                <Text
                  style={[
                    {
                      flex: 1,
                      textAlign: 'right',
                      fontSize: 9,
                      fontFamily: PDF_FONTS.MONO,
                      fontWeight: 700,
                    },
                    statement.investingActivities.totalInvesting < 0
                      ? { color: COLORS.red }
                      : { color: COLORS.green },
                  ]}
                >
                  {formatCompact(statement.investingActivities.totalInvesting, currency)}
                </Text>
              </View>

              {/* Financing Activities */}
              <View
                style={[
                  { flexDirection: 'row', paddingVertical: 6, marginTop: 8 },
                  styles.tableRowHeader,
                ]}
              >
                <Text style={{ flex: 3, fontSize: 9, fontWeight: 700 }}>Financing Activities</Text>
                <Text style={{ flex: 1, textAlign: 'right', fontSize: 9 }}></Text>
              </View>
              {[
                { name: 'Debt Proceeds', amount: statement.financingActivities.debtProceeds },
                { name: 'Debt Repayments', amount: statement.financingActivities.debtRepayments },
                { name: 'Equity Changes', amount: statement.financingActivities.equityChanges },
                { name: 'Dividends', amount: statement.financingActivities.dividends },
              ]
                .filter((item) => item.amount != null && isFinite(item.amount) && item.amount !== 0)
                .map((item, idx) => (
                  <View
                    key={idx}
                    style={[
                      {
                        flexDirection: 'row',
                        paddingVertical: 3,
                        borderBottomWidth: 0.5,
                        borderBottomColor: '#e0e0e0',
                      },
                      styles.indent1,
                    ]}
                  >
                    <Text style={{ flex: 3, fontSize: 9, color: COLORS.textSecondary }}>
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        { flex: 1, textAlign: 'right', fontSize: 9, fontFamily: PDF_FONTS.MONO },
                        item.amount < 0 ? { color: COLORS.red } : {},
                      ]}
                    >
                      {formatCompact(item.amount, currency)}
                    </Text>
                  </View>
                ))}
              <View style={[{ flexDirection: 'row', paddingVertical: 4 }, styles.tableRowTotal]}>
                <Text style={{ flex: 3, fontSize: 9, fontWeight: 700 }}>
                  Net Cash from Financing
                </Text>
                <Text
                  style={[
                    {
                      flex: 1,
                      textAlign: 'right',
                      fontSize: 9,
                      fontFamily: PDF_FONTS.MONO,
                      fontWeight: 700,
                    },
                    statement.financingActivities.totalFinancing < 0
                      ? { color: COLORS.red }
                      : { color: COLORS.green },
                  ]}
                >
                  {formatCompact(statement.financingActivities.totalFinancing, currency)}
                </Text>
              </View>

              {/* Net Change & Ending Cash */}
              <View
                style={[
                  { flexDirection: 'row', paddingVertical: 6, marginTop: 8 },
                  styles.tableRowGrandTotal,
                ]}
              >
                <Text style={{ flex: 3, fontSize: 10, fontWeight: 700 }}>Net Change in Cash</Text>
                <Text
                  style={[
                    {
                      flex: 1,
                      textAlign: 'right',
                      fontSize: 10,
                      fontFamily: PDF_FONTS.MONO,
                      fontWeight: 700,
                    },
                    statement.netCashChange < 0 ? { color: COLORS.red } : { color: COLORS.green },
                  ]}
                >
                  {statement.netCashChange >= 0 ? '+' : ''}
                  {formatCompact(statement.netCashChange, currency)}
                </Text>
              </View>
              <View
                style={[{ flexDirection: 'row', paddingVertical: 6 }, styles.tableRowGrandTotal]}
              >
                <Text style={{ flex: 3, fontSize: 10, fontWeight: 700 }}>Ending Cash Balance</Text>
                <Text
                  style={{
                    flex: 1,
                    textAlign: 'right',
                    fontSize: 10,
                    fontFamily: PDF_FONTS.MONO,
                    fontWeight: 700,
                    color: statement.endingCash >= 0 ? COLORS.green : COLORS.red,
                  }}
                >
                  {formatCompact(statement.endingCash, currency)}
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
        {/* Monthly Cash Movement */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Cash Movement</Text>
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
                  Inflow
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
                  Outflow
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
                  Net Change
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
                  Balance
                </Text>
              </View>

              {/* Table Rows */}
              {monthlyTrend.map((m, idx) => {
                const date = new Date(m.month + '-01')
                const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                return (
                  <React.Fragment key={m.month}>
                    {/* Month summary row */}
                    <View
                      style={[
                        {
                          flexDirection: 'row',
                          paddingVertical: 4,
                          borderBottomWidth: 0.5,
                          borderBottomColor: '#e0e0e0',
                        },
                        { backgroundColor: COLORS.bgCardAlt },
                      ]}
                    >
                      <Text
                        style={{
                          flex: 2,
                          fontSize: 8,
                          fontFamily: PDF_FONTS.MONO,
                          fontWeight: 600,
                        }}
                      >
                        {label}
                      </Text>
                      <Text
                        style={{
                          flex: 1.5,
                          fontSize: 8,
                          fontFamily: PDF_FONTS.MONO,
                          textAlign: 'right',
                          color: COLORS.green,
                          fontWeight: 600,
                        }}
                      >
                        {formatCompact(m.inflow, currency)}
                      </Text>
                      <Text
                        style={{
                          flex: 1.5,
                          fontSize: 8,
                          fontFamily: PDF_FONTS.MONO,
                          textAlign: 'right',
                          color: COLORS.red,
                          fontWeight: 600,
                        }}
                      >
                        {formatCompact(-m.outflow, currency)}
                      </Text>
                      <Text
                        style={{
                          flex: 1.5,
                          fontSize: 8,
                          fontFamily: PDF_FONTS.MONO,
                          textAlign: 'right',
                          fontWeight: 600,
                          color: m.netChange >= 0 ? COLORS.green : COLORS.red,
                        }}
                      >
                        {m.netChange >= 0 ? '+' : ''}
                        {formatCompact(m.netChange, currency)}
                      </Text>
                      <Text
                        style={{
                          flex: 1.5,
                          fontSize: 8,
                          fontFamily: PDF_FONTS.MONO,
                          textAlign: 'right',
                          fontWeight: 600,
                        }}
                      >
                        {formatCompact(m.runningBalance, currency)}
                      </Text>
                    </View>
                    {/* Per-account detail rows */}
                    {m.accounts?.map((acc) => (
                      <View
                        key={acc.accountNumber}
                        style={{
                          flexDirection: 'row',
                          paddingVertical: 2,
                          paddingLeft: 12,
                          borderBottomWidth: 0.5,
                          borderBottomColor: '#f0f0f0',
                        }}
                      >
                        <Text
                          style={{
                            flex: 2,
                            fontSize: 7,
                            color: COLORS.textSecondary,
                          }}
                        >
                          {acc.accountNumber} {acc.accountName}
                        </Text>
                        <Text
                          style={{
                            flex: 1.5,
                            fontSize: 7,
                            fontFamily: PDF_FONTS.MONO,
                            textAlign: 'right',
                            color: COLORS.green,
                          }}
                        >
                          {acc.inflow > 0 ? formatCompact(acc.inflow, currency) : '—'}
                        </Text>
                        <Text
                          style={{
                            flex: 1.5,
                            fontSize: 7,
                            fontFamily: PDF_FONTS.MONO,
                            textAlign: 'right',
                            color: COLORS.red,
                          }}
                        >
                          {acc.outflow > 0 ? formatCompact(-acc.outflow, currency) : '—'}
                        </Text>
                        <Text
                          style={{
                            flex: 1.5,
                            fontSize: 7,
                            fontFamily: PDF_FONTS.MONO,
                            textAlign: 'right',
                            color: acc.netChange >= 0 ? COLORS.green : COLORS.red,
                          }}
                        >
                          {acc.netChange >= 0 ? '+' : ''}
                          {formatCompact(acc.netChange, currency)}
                        </Text>
                        <Text style={{ flex: 1.5 }}></Text>
                      </View>
                    ))}
                  </React.Fragment>
                )
              })}

              {/* Totals Row */}
              {(() => {
                const totalInflow = monthlyTrend.reduce((s, m) => s + m.inflow, 0)
                const totalOutflow = monthlyTrend.reduce((s, m) => s + m.outflow, 0)
                const totalNet = totalInflow - totalOutflow
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
                      {formatCompact(totalInflow, currency)}
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
                      {formatCompact(-totalOutflow, currency)}
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
                    <Text style={{ flex: 1.5, fontSize: 9 }}></Text>
                  </View>
                )
              })()}
            </View>
          ) : (
            <Text style={{ fontSize: 9, color: COLORS.textMuted }}>No monthly trend data</Text>
          )}
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
