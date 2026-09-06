'use client'

import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS } from '@/lib/pdf/fontConfig'
import type {
  VendorPaymentRiskRow,
  VendorConcentration,
  OutstandingPayablesSummary,
  VendorPaymentTermsSummary,
  PaymentRiskSummary,
  VendorOverviewData,
} from '../hooks/useVendorInsights'

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
  purple: '#7c3aed',
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

  // Card Box
  cardBox: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 700,
    fontFamily: PDF_FONTS.MONO,
  },
  cardLabel: {
    fontSize: 8,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // AP Status Bar
  apStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
    borderRadius: 4,
  },
  apStatusLabel: {
    fontSize: 9,
    fontWeight: 500,
  },
  apStatusValue: {
    fontSize: 9,
    fontWeight: 600,
    fontFamily: PDF_FONTS.MONO,
  },

  // Risk Distribution
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
    borderRadius: 4,
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  riskLabel: {
    flex: 1,
    fontSize: 9,
  },
  riskCount: {
    fontSize: 8,
    color: COLORS.textSecondary,
    marginRight: 8,
  },
  riskValue: {
    fontSize: 9,
    fontWeight: 600,
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

  // Concentration Donut (simplified as bars)
  concentrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 2,
    borderRadius: 4,
  },
  concentrationRank: {
    width: 16,
    fontSize: 8,
    fontFamily: PDF_FONTS.MONO,
    color: COLORS.textMuted,
  },
  concentrationName: {
    flex: 1,
    fontSize: 8,
    color: COLORS.textPrimary,
  },
  concentrationPct: {
    fontSize: 8,
    fontWeight: 600,
    fontFamily: PDF_FONTS.MONO,
    marginRight: 8,
  },
  concentrationValue: {
    fontSize: 8,
    fontFamily: PDF_FONTS.MONO,
    color: COLORS.textSecondary,
  },

  // Payment Terms
  termsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 2,
    borderRadius: 4,
  },
  termsCode: {
    fontSize: 8,
    fontWeight: 500,
    color: COLORS.textPrimary,
  },
  termsCount: {
    fontSize: 8,
    color: COLORS.textSecondary,
  },
  termsValue: {
    fontSize: 8,
    fontWeight: 600,
    fontFamily: PDF_FONTS.MONO,
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

// Risk level colors
function getRiskColor(riskScore: string): { bg: string; text: string } {
  switch (riskScore) {
    case 'critical':
      return { bg: '#fee2e2', text: '#991b1b' }
    case 'high':
      return { bg: '#ffedd5', text: '#c2410c' }
    case 'medium':
      return { bg: '#fef3c7', text: '#b45309' }
    default:
      return { bg: '#dcfce7', text: '#166534' }
  }
}

function getRiskDotColor(riskScore: string): string {
  switch (riskScore) {
    case 'critical':
      return COLORS.red
    case 'high':
      return COLORS.orange
    case 'medium':
      return COLORS.amber
    default:
      return COLORS.green
  }
}

export interface VendorsPDFProps {
  overview: VendorOverviewData | null
  paymentRiskData: VendorPaymentRiskRow[]
  paymentRiskSummary: PaymentRiskSummary | null
  concentrationData: VendorConcentration[]
  concentrationMetrics: {
    topVendorPercentage: number
    top5Percentage: number
    top10Percentage: number
    concentrationRisk: 'low' | 'medium' | 'high'
  }
  outstandingPayables: OutstandingPayablesSummary | null
  topByBalance: Array<{
    no: string
    name: string
    balance_lcy: number
    balance_due_lcy: number
    purchases_lcy: number
    payment_terms_code: string
  }>
  paymentTerms: VendorPaymentTermsSummary[]
  currency?: string
  companyName?: string
  schema?: string
  dateRange?: { startDate: string; endDate: string }
}

export function VendorsPDF({
  overview,
  paymentRiskData,
  paymentRiskSummary,
  concentrationData,
  concentrationMetrics,
  outstandingPayables,
  topByBalance,
  paymentTerms,
  currency = 'USD',
  companyName,
  schema,
  dateRange,
}: VendorsPDFProps) {
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // Calculate risk distribution
  const riskDistribution = {
    critical: paymentRiskData.filter((v) => v.risk_score === 'critical').length,
    high: paymentRiskData.filter((v) => v.risk_score === 'high').length,
    medium: paymentRiskData.filter((v) => v.risk_score === 'medium').length,
    low: paymentRiskData.filter((v) => v.risk_score === 'low').length,
  }

  const riskAmounts = {
    critical: paymentRiskData
      .filter((v) => v.risk_score === 'critical')
      .reduce((sum, v) => sum + v.balance_due_lcy, 0),
    high: paymentRiskData
      .filter((v) => v.risk_score === 'high')
      .reduce((sum, v) => sum + v.balance_due_lcy, 0),
    medium: paymentRiskData
      .filter((v) => v.risk_score === 'medium')
      .reduce((sum, v) => sum + v.balance_due_lcy, 0),
    low: paymentRiskData
      .filter((v) => v.risk_score === 'low')
      .reduce((sum, v) => sum + v.balance_due_lcy, 0),
  }

  return (
    <Document>
      {/* Page 1: Overview, Risk Distribution, AP Status, and Payment Risk Details */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>Vendor Insights Report</Text>
              <Text style={styles.subtitle}>
                {companyName ? `${companyName} · ` : ''}
                {schema || 'Business Central'} · Payment Risk & Concentration Analysis
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
              <Text style={styles.metricLabel}>Vendors</Text>
              <Text style={[styles.metricValue, { color: COLORS.textPrimary }]}>
                {overview.total_vendors.toLocaleString()}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Purchases</Text>
              <Text style={[styles.metricValue, { color: COLORS.textPrimary }]}>
                {formatCompact(overview.total_purchases, currency)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>AP Balance</Text>
              <Text style={[styles.metricValue, { color: COLORS.textPrimary }]}>
                {formatCompact(overview.total_ap, currency)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: COLORS.red }]}>Overdue</Text>
              <Text style={[styles.metricValue, { color: COLORS.red }]}>
                {formatCompact(overview.total_overdue, currency)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Blocked</Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: overview.blocked_vendors > 0 ? COLORS.red : COLORS.textPrimary },
                ]}
              >
                {overview.blocked_vendors}
              </Text>
            </View>
          </View>
        )}

        {/* Two Column: Risk Distribution & AP Status */}
        <View style={styles.twoColumn}>
          {/* Risk Distribution */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Risk Distribution</Text>
            {[
              { key: 'critical', label: 'Critical', color: COLORS.red },
              { key: 'high', label: 'High', color: COLORS.orange },
              { key: 'medium', label: 'Medium', color: COLORS.amber },
              { key: 'low', label: 'Low', color: COLORS.green },
            ].map((risk, idx) => {
              const count = riskDistribution[risk.key as keyof typeof riskDistribution]
              const amount = riskAmounts[risk.key as keyof typeof riskAmounts]
              return (
                <View
                  key={risk.key}
                  style={[
                    styles.riskRow,
                    { backgroundColor: idx % 2 === 0 ? COLORS.bgCard : 'transparent' },
                  ]}
                >
                  <View style={[styles.riskDot, { backgroundColor: risk.color }]} />
                  <Text style={styles.riskLabel}>{risk.label}</Text>
                  <Text style={styles.riskCount}>{count} vendors</Text>
                  <Text style={[styles.riskValue, { color: risk.color }]}>
                    {formatCompact(amount, currency)}
                  </Text>
                </View>
              )
            })}
          </View>

          {/* AP Status */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>AP Status</Text>
            {outstandingPayables ? (
              <>
                <View style={[styles.apStatusRow, { backgroundColor: COLORS.bgCard }]}>
                  <Text style={styles.apStatusLabel}>Total Outstanding</Text>
                  <Text style={[styles.apStatusValue, { color: COLORS.textPrimary }]}>
                    {formatCompact(outstandingPayables.total_outstanding_ap, currency)}
                  </Text>
                </View>
                <View style={styles.apStatusRow}>
                  <Text style={[styles.apStatusLabel, { color: COLORS.red }]}>Total Overdue</Text>
                  <Text style={[styles.apStatusValue, { color: COLORS.red }]}>
                    {formatCompact(outstandingPayables.total_overdue_ap, currency)}
                  </Text>
                </View>
                <View style={[styles.apStatusRow, { backgroundColor: COLORS.bgCard }]}>
                  <Text style={styles.apStatusLabel}>Vendors with Balance</Text>
                  <Text style={styles.apStatusValue}>
                    {outstandingPayables.vendors_with_balance}
                  </Text>
                </View>
                <View style={styles.apStatusRow}>
                  <Text style={styles.apStatusLabel}>Vendors Overdue</Text>
                  <Text style={[styles.apStatusValue, { color: COLORS.orange }]}>
                    {outstandingPayables.vendors_with_overdue}
                  </Text>
                </View>
                {outstandingPayables.total_outstanding_ap > 0 && (
                  <View style={[styles.apStatusRow, { backgroundColor: COLORS.bgCard }]}>
                    <Text style={styles.apStatusLabel}>Overdue Ratio</Text>
                    <Text style={[styles.apStatusValue, { color: COLORS.amber }]}>
                      {(
                        (outstandingPayables.total_overdue_ap /
                          outstandingPayables.total_outstanding_ap) *
                        100
                      ).toFixed(1)}
                      %
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={{ fontSize: 9, color: COLORS.textMuted }}>No AP data available</Text>
            )}
          </View>
        </View>

        {/* Payment Risk Details Table */}
        <View style={[styles.section, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>Payment Risk Details</Text>
          {paymentRiskData.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { width: '6%' }]}>#</Text>
                <Text style={[styles.tableHeaderCell, { width: '30%' }]}>Vendor</Text>
                <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Risk</Text>
                <Text style={[styles.tableHeaderCell, { width: '14%', textAlign: 'right' }]}>
                  Balance
                </Text>
                <Text style={[styles.tableHeaderCell, { width: '14%', textAlign: 'right' }]}>
                  Overdue
                </Text>
                <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>
                  Ratio
                </Text>
                <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Terms</Text>
              </View>
              {paymentRiskData.slice(0, 15).map((vendor, idx) => {
                const riskColors = getRiskColor(vendor.risk_score)
                return (
                  <View
                    key={vendor.no}
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
                      {idx + 1}
                    </Text>
                    <Text style={[styles.tableCell, { width: '30%' }]}>
                      {vendor.name.length > 24 ? vendor.name.substring(0, 24) + '...' : vendor.name}
                    </Text>
                    <View style={{ width: '12%' }}>
                      <Text
                        style={[
                          styles.riskBadge,
                          { backgroundColor: riskColors.bg, color: riskColors.text },
                        ]}
                      >
                        {vendor.risk_score.charAt(0).toUpperCase() + vendor.risk_score.slice(1)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: '14%', textAlign: 'right', fontFamily: PDF_FONTS.MONO },
                      ]}
                    >
                      {formatCompact(vendor.balance_lcy, currency)}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        {
                          width: '14%',
                          textAlign: 'right',
                          fontFamily: PDF_FONTS.MONO,
                          color: vendor.balance_due_lcy > 0 ? COLORS.red : COLORS.textSecondary,
                        },
                      ]}
                    >
                      {formatCompact(vendor.balance_due_lcy, currency)}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        {
                          width: '12%',
                          textAlign: 'right',
                          fontFamily: PDF_FONTS.MONO,
                          color:
                            vendor.overdue_ratio > 75
                              ? COLORS.red
                              : vendor.overdue_ratio > 50
                                ? COLORS.orange
                                : COLORS.textSecondary,
                        },
                      ]}
                    >
                      {vendor.overdue_ratio.toFixed(0)}%
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableCellMuted,
                        { width: '12%', fontFamily: PDF_FONTS.MONO },
                      ]}
                    >
                      {vendor.payment_terms_code.length > 8
                        ? vendor.payment_terms_code.substring(0, 8)
                        : vendor.payment_terms_code || '—'}
                    </Text>
                  </View>
                )
              })}
            </View>
          ) : (
            <Text style={{ fontSize: 9, color: COLORS.green, textAlign: 'center', padding: 20 }}>
              No vendors with outstanding balances
            </Text>
          )}
          {paymentRiskData.length > 15 && (
            <Text
              style={{ fontSize: 8, color: COLORS.textMuted, textAlign: 'center', marginTop: 4 }}
            >
              Showing top 15 of {paymentRiskData.length} vendors with balances
            </Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {generatedAt}</Text>
          <Text style={styles.pageNumber}>Page 1</Text>
        </View>
      </Page>

      {/* Page 2: Spend Concentration, Top Balances, Payment Terms */}
      <Page size="A4" style={styles.page}>
        {/* Two Column: Spend Concentration & Top Balances */}
        <View style={styles.twoColumn}>
          {/* Spend Concentration */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Spend Concentration</Text>
            <View style={styles.cardBox}>
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}
              >
                <View>
                  <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>Top Vendor</Text>
                  <Text
                    style={[
                      styles.cardValue,
                      {
                        fontSize: 18,
                        color:
                          concentrationMetrics.topVendorPercentage > 25
                            ? COLORS.orange
                            : COLORS.textPrimary,
                      },
                    ]}
                  >
                    {concentrationMetrics.topVendorPercentage.toFixed(1)}%
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>Top 5</Text>
                  <Text
                    style={[
                      styles.cardValue,
                      {
                        fontSize: 18,
                        color:
                          concentrationMetrics.top5Percentage > 50
                            ? COLORS.red
                            : COLORS.textPrimary,
                      },
                    ]}
                  >
                    {concentrationMetrics.top5Percentage.toFixed(1)}%
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>Top 10</Text>
                  <Text style={[styles.cardValue, { fontSize: 18, color: COLORS.textPrimary }]}>
                    {concentrationMetrics.top10Percentage.toFixed(1)}%
                  </Text>
                </View>
              </View>
              <View
                style={{
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderColor: COLORS.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 8, color: COLORS.textSecondary }}>
                  Concentration Risk:{' '}
                </Text>
                <Text
                  style={{
                    fontSize: 8,
                    fontWeight: 600,
                    color:
                      concentrationMetrics.concentrationRisk === 'high'
                        ? COLORS.red
                        : concentrationMetrics.concentrationRisk === 'medium'
                          ? COLORS.amber
                          : COLORS.green,
                  }}
                >
                  {concentrationMetrics.concentrationRisk.toUpperCase()}
                </Text>
              </View>
            </View>

            {concentrationData.length > 0 && (
              <View style={{ marginTop: 8 }}>
                {concentrationData.slice(0, 10).map((vendor, idx) => (
                  <View
                    key={vendor.no}
                    style={[
                      styles.concentrationRow,
                      { backgroundColor: idx % 2 === 0 ? COLORS.bgCard : 'transparent' },
                    ]}
                  >
                    <Text style={styles.concentrationRank}>{idx + 1}</Text>
                    <Text style={styles.concentrationName}>
                      {vendor.name.length > 20 ? vendor.name.substring(0, 20) + '...' : vendor.name}
                    </Text>
                    <Text
                      style={[
                        styles.concentrationPct,
                        { color: vendor.percentage > 15 ? COLORS.orange : COLORS.textPrimary },
                      ]}
                    >
                      {vendor.percentage.toFixed(1)}%
                    </Text>
                    <Text style={styles.concentrationValue}>
                      {formatCompact(vendor.purchases_lcy, currency)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Top Balances */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Top Balances</Text>
            {topByBalance.length > 0 ? (
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { width: '8%' }]}>#</Text>
                  <Text style={[styles.tableHeaderCell, { width: '42%' }]}>Vendor</Text>
                  <Text style={[styles.tableHeaderCell, { width: '25%', textAlign: 'right' }]}>
                    Balance
                  </Text>
                  <Text style={[styles.tableHeaderCell, { width: '25%', textAlign: 'right' }]}>
                    Due
                  </Text>
                </View>
                {topByBalance.slice(0, 12).map((vendor, idx) => (
                  <View
                    key={vendor.no}
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
                      {vendor.name.length > 22 ? vendor.name.substring(0, 22) + '...' : vendor.name}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        {
                          width: '25%',
                          textAlign: 'right',
                          fontFamily: PDF_FONTS.MONO,
                          fontWeight: 600,
                        },
                      ]}
                    >
                      {formatCompact(vendor.balance_lcy, currency)}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        {
                          width: '25%',
                          textAlign: 'right',
                          fontFamily: PDF_FONTS.MONO,
                          color: vendor.balance_due_lcy > 0 ? COLORS.red : COLORS.textMuted,
                        },
                      ]}
                    >
                      {vendor.balance_due_lcy > 0
                        ? formatCompact(vendor.balance_due_lcy, currency)
                        : '—'}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 9, color: COLORS.textMuted }}>No balance data</Text>
            )}
          </View>
        </View>

        {/* Payment Terms Distribution */}
        <View style={[styles.section, { marginTop: 20 }]}>
          <Text style={styles.sectionTitle}>Payment Terms Distribution</Text>
          {paymentTerms.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Terms Code</Text>
                <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'right' }]}>
                  Vendors
                </Text>
                <Text style={[styles.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>
                  Purchases
                </Text>
                <Text style={[styles.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>
                  Balance
                </Text>
                <Text style={[styles.tableHeaderCell, { width: '25%', textAlign: 'right' }]}>
                  Overdue
                </Text>
              </View>
              {paymentTerms.slice(0, 10).map((term, idx) => (
                <View
                  key={term.payment_terms_code}
                  style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
                  wrap={false}
                >
                  <Text style={[styles.tableCell, { width: '20%', fontWeight: 500 }]}>
                    {term.payment_terms_code.length > 12
                      ? term.payment_terms_code.substring(0, 12) + '...'
                      : term.payment_terms_code}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      styles.tableCellMuted,
                      { width: '15%', textAlign: 'right', fontFamily: PDF_FONTS.MONO },
                    ]}
                  >
                    {term.vendor_count}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      { width: '20%', textAlign: 'right', fontFamily: PDF_FONTS.MONO },
                    ]}
                  >
                    {formatCompact(term.total_purchases, currency)}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      { width: '20%', textAlign: 'right', fontFamily: PDF_FONTS.MONO },
                    ]}
                  >
                    {formatCompact(term.total_balance, currency)}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      {
                        width: '25%',
                        textAlign: 'right',
                        fontFamily: PDF_FONTS.MONO,
                        color: term.total_balance_due > 0 ? COLORS.red : COLORS.textMuted,
                      },
                    ]}
                  >
                    {term.total_balance_due > 0
                      ? formatCompact(term.total_balance_due, currency)
                      : '—'}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 9, color: COLORS.textMuted }}>No payment terms data</Text>
          )}
        </View>

        {/* Summary Box */}
        {paymentRiskSummary && (
          <View
            style={[
              styles.cardBox,
              { marginTop: 16, flexDirection: 'row', justifyContent: 'space-around' },
            ]}
          >
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 7, color: COLORS.textSecondary, marginBottom: 2 }}>
                Total Balance
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: PDF_FONTS.MONO,
                  color: COLORS.textPrimary,
                }}
              >
                {formatCompact(paymentRiskSummary.total_balance, currency)}
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 7, color: COLORS.textSecondary, marginBottom: 2 }}>
                Total Overdue
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: PDF_FONTS.MONO,
                  color: COLORS.red,
                }}
              >
                {formatCompact(paymentRiskSummary.total_balance_due, currency)}
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 7, color: COLORS.textSecondary, marginBottom: 2 }}>
                Overdue Ratio
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: PDF_FONTS.MONO,
                  color:
                    paymentRiskSummary.overdue_ratio > 50
                      ? COLORS.red
                      : paymentRiskSummary.overdue_ratio > 25
                        ? COLORS.orange
                        : COLORS.green,
                }}
              >
                {paymentRiskSummary.overdue_ratio.toFixed(1)}%
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 7, color: COLORS.textSecondary, marginBottom: 2 }}>
                High Risk Vendors
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: PDF_FONTS.MONO,
                  color: paymentRiskSummary.high_risk_vendors > 0 ? COLORS.orange : COLORS.green,
                }}
              >
                {paymentRiskSummary.high_risk_vendors}
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {generatedAt}</Text>
          <Text style={styles.pageNumber}>Page 2</Text>
        </View>
      </Page>
    </Document>
  )
}
