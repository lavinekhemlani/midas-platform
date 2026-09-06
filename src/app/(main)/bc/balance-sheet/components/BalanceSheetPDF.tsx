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
  healthScoreBox: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  healthScoreValue: {
    fontSize: 28,
    fontWeight: 700,
    fontFamily: PDF_FONTS.MONO,
  },
  healthScoreRating: {
    fontSize: 10,
    fontWeight: 500,
    marginTop: 2,
  },
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
  tableRowHeader: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  indent1: {
    paddingLeft: 12,
  },
  indent2: {
    paddingLeft: 24,
  },
  indent3: {
    paddingLeft: 36,
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
  agingBar: {
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    flexDirection: 'row',
    overflow: 'hidden',
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

function getHealthScoreColor(score: number): string {
  if (score >= 80) return COLORS.green
  if (score >= 60) return COLORS.blue
  if (score >= 40) return COLORS.amber
  return COLORS.red
}

function getRatioColor(value: number | null, goodThreshold: number, badThreshold: number): string {
  if (value === null) return COLORS.textMuted
  if (value >= goodThreshold) return COLORS.green
  if (value >= badThreshold) return COLORS.amber
  return COLORS.red
}

// Types
interface BSTotals {
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  netIncome: number
}

interface BSLine {
  lineNumber: number
  display: string
  balance: number
  lineType: string
  indentation: number
}

interface FinancialRatios {
  currentRatio: number | null
  quickRatio: number | null
  debtToEquity: number | null
  workingCapital: number
  grossMargin: number | null
  netMargin: number | null
  operatingMargin: number | null
}

interface EfficiencyMetrics {
  dso: number | null
  dpo: number | null
  inventoryTurnover: number | null
  cashConversionCycle: number | null
  arTurnover: number | null
  apTurnover: number | null
}

interface CashRunwayData {
  totalCash: number
  monthlyExpenses: number
  monthlyRevenue: number
  grossBurnRate: number
  netBurnRate: number
  cashRunwayMonths: number | null
  avgMonthlyNetIncome: number
}

interface FinancialHealthScore {
  score: number
  rating: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention' | 'Critical'
  components: {
    liquidity: { score: number; weight: number; details: string }
    profitability: { score: number; weight: number; details: string }
    efficiency: { score: number; weight: number; details: string }
    leverage: { score: number; weight: number; details: string }
  }
}

interface AgedSummary {
  current: number
  days_1_30: number
  days_31_60: number
  days_61_90: number
  days_over_90: number
  total: number
}

export interface BalanceSheetPDFProps {
  totals: BSTotals | null
  lines: BSLine[]
  ratios: FinancialRatios | null
  efficiencyMetrics: EfficiencyMetrics | null
  healthScore: FinancialHealthScore | null
  cashRunwayData: CashRunwayData | null
  agedReceivables: AgedSummary | null
  agedPayables: AgedSummary | null
  companyName?: string | null
  currency?: string
  asOfDate?: string
}

export function BalanceSheetPDF({
  totals,
  lines,
  ratios,
  efficiencyMetrics,
  healthScore,
  cashRunwayData,
  agedReceivables,
  agedPayables,
  companyName,
  currency = 'USD',
  asOfDate,
}: BalanceSheetPDFProps) {
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // Filter lines for display - remove spacers and balance check line
  const displayLines = lines.filter(
    (l) => l.lineType !== 'spacer' && l.display !== 'Balance Check (A - L - E)'
  )

  // Helper function to get indent style
  const getIndentStyle = (indent: number) => {
    if (indent === 1) return styles.indent1
    if (indent === 2) return styles.indent2
    if (indent >= 3) return styles.indent3
    return {}
  }

  return (
    <Document>
      {/* Page 1: Overview & Key Metrics */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>Balance Sheet Report</Text>
              <Text style={styles.subtitle}>
                Business Central{companyName ? ` · ${companyName}` : ''}
              </Text>
            </View>
            {asOfDate && (
              <View style={styles.dateBadge}>
                <Text style={styles.dateBadgeText}>As of {asOfDate}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Key Metrics Strip */}
        {totals && (
          <View style={styles.metricsStrip}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Total Assets</Text>
              <Text style={[styles.metricValue, { color: COLORS.green }]}>
                {formatCompact(totals.totalAssets, currency)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Total Liabilities</Text>
              <Text style={[styles.metricValue, { color: COLORS.red }]}>
                {formatCompact(totals.totalLiabilities, currency)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Total Equity</Text>
              <Text style={[styles.metricValue, { color: COLORS.textPrimary }]}>
                {formatCompact(totals.totalEquity, currency)}
              </Text>
            </View>
            {healthScore && (
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Health Score</Text>
                <Text
                  style={[styles.metricValue, { color: getHealthScoreColor(healthScore.score) }]}
                >
                  {healthScore.score}/100
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Two Column: Ratios + Health Score */}
        <View style={styles.twoColumn}>
          {/* Financial Ratios */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Financial Ratios</Text>
            <View style={styles.ratioBox}>
              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Current Ratio</Text>
                <Text
                  style={[
                    styles.ratioValue,
                    { color: getRatioColor(ratios?.currentRatio ?? null, 1.5, 1.0) },
                  ]}
                >
                  {ratios?.currentRatio != null ? ratios.currentRatio.toFixed(2) : '—'}
                </Text>
              </View>
              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Quick Ratio</Text>
                <Text
                  style={[
                    styles.ratioValue,
                    { color: getRatioColor(ratios?.quickRatio ?? null, 1.0, 0.5) },
                  ]}
                >
                  {ratios?.quickRatio != null ? ratios.quickRatio.toFixed(2) : '—'}
                </Text>
              </View>
              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Debt to Equity</Text>
                <Text
                  style={[
                    styles.ratioValue,
                    {
                      color:
                        ratios?.debtToEquity != null
                          ? ratios.debtToEquity <= 1
                            ? COLORS.green
                            : ratios.debtToEquity <= 2
                              ? COLORS.amber
                              : COLORS.red
                          : COLORS.textMuted,
                    },
                  ]}
                >
                  {ratios?.debtToEquity != null ? ratios.debtToEquity.toFixed(2) : '—'}
                </Text>
              </View>
              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Working Capital</Text>
                <Text
                  style={[
                    styles.ratioValue,
                    { color: (ratios?.workingCapital ?? 0) >= 0 ? COLORS.green : COLORS.red },
                  ]}
                >
                  {ratios?.workingCapital !== undefined
                    ? formatCompact(ratios.workingCapital, currency)
                    : '—'}
                </Text>
              </View>
            </View>

            {/* Profitability Ratios */}
            <View style={styles.ratioBox}>
              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Gross Margin</Text>
                <Text
                  style={[
                    styles.ratioValue,
                    { color: getRatioColor(ratios?.grossMargin ?? null, 30, 15) },
                  ]}
                >
                  {ratios?.grossMargin != null ? `${ratios.grossMargin.toFixed(1)}%` : '—'}
                </Text>
              </View>
              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Operating Margin</Text>
                <Text
                  style={[
                    styles.ratioValue,
                    { color: getRatioColor(ratios?.operatingMargin ?? null, 15, 5) },
                  ]}
                >
                  {ratios?.operatingMargin != null ? `${ratios.operatingMargin.toFixed(1)}%` : '—'}
                </Text>
              </View>
              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Net Margin</Text>
                <Text
                  style={[
                    styles.ratioValue,
                    { color: getRatioColor(ratios?.netMargin ?? null, 10, 0) },
                  ]}
                >
                  {ratios?.netMargin != null ? `${ratios.netMargin.toFixed(1)}%` : '—'}
                </Text>
              </View>
            </View>
          </View>

          {/* Health Score & Efficiency */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Financial Health</Text>
            {healthScore ? (
              <View style={styles.healthScoreBox}>
                <Text
                  style={[
                    styles.healthScoreValue,
                    { color: getHealthScoreColor(healthScore.score) },
                  ]}
                >
                  {healthScore.score}
                </Text>
                <Text
                  style={[
                    styles.healthScoreRating,
                    { color: getHealthScoreColor(healthScore.score) },
                  ]}
                >
                  {healthScore.rating}
                </Text>
                <View style={{ marginTop: 8, width: '100%' }}>
                  {Object.entries(healthScore.components).map(([key, comp]) => (
                    <View
                      key={key}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginTop: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 7,
                          color: COLORS.textSecondary,
                          textTransform: 'capitalize',
                        }}
                      >
                        {key}
                      </Text>
                      <Text
                        style={{
                          fontSize: 7,
                          fontFamily: PDF_FONTS.MONO,
                          color: COLORS.textPrimary,
                        }}
                      >
                        {comp.score}/100
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.ratioBox}>
                <Text style={{ fontSize: 9, color: COLORS.textMuted }}>
                  Insufficient data for health score
                </Text>
              </View>
            )}

            {/* Efficiency Metrics */}
            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Efficiency Metrics</Text>
            <View style={styles.ratioBox}>
              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Days Sales Outstanding</Text>
                <Text style={[styles.ratioValue, { color: COLORS.textPrimary }]}>
                  {efficiencyMetrics?.dso != null
                    ? `${Math.round(efficiencyMetrics.dso)} days`
                    : '—'}
                </Text>
              </View>
              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Days Payable Outstanding</Text>
                <Text style={[styles.ratioValue, { color: COLORS.textPrimary }]}>
                  {efficiencyMetrics?.dpo != null
                    ? `${Math.round(efficiencyMetrics.dpo)} days`
                    : '—'}
                </Text>
              </View>
              <View style={styles.ratioRow}>
                <Text style={styles.ratioLabel}>Cash Conversion Cycle</Text>
                <Text style={[styles.ratioValue, { color: COLORS.textPrimary }]}>
                  {efficiencyMetrics?.cashConversionCycle != null
                    ? `${Math.round(efficiencyMetrics.cashConversionCycle)} days`
                    : '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Cash Runway */}
        {cashRunwayData && (
          <View style={[styles.section, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>Cash Runway</Text>
            <View
              style={[styles.ratioBox, { flexDirection: 'row', justifyContent: 'space-between' }]}
            >
              <View>
                <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>Total Cash</Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: PDF_FONTS.MONO,
                    color: COLORS.green,
                  }}
                >
                  {formatCompact(cashRunwayData.totalCash, currency)}
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>Monthly Burn</Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: PDF_FONTS.MONO,
                    color: cashRunwayData.netBurnRate > 0 ? COLORS.red : COLORS.green,
                  }}
                >
                  {formatCompact(Math.abs(cashRunwayData.netBurnRate), currency)}
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>Runway</Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: PDF_FONTS.MONO,
                    color:
                      cashRunwayData.cashRunwayMonths === null
                        ? COLORS.green
                        : cashRunwayData.cashRunwayMonths >= 12
                          ? COLORS.green
                          : cashRunwayData.cashRunwayMonths >= 6
                            ? COLORS.amber
                            : COLORS.red,
                  }}
                >
                  {cashRunwayData.cashRunwayMonths !== null
                    ? `${cashRunwayData.cashRunwayMonths.toFixed(1)} mo`
                    : '∞'}
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

      {/* Page 2: Aged AR/AP + Balance Sheet Lines */}
      <Page size="A4" style={styles.page}>
        {/* Aged AR/AP */}
        <View style={styles.twoColumn}>
          {/* Aged Receivables */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Aged Receivables</Text>
            {agedReceivables ? (
              <View style={styles.ratioBox}>
                <View style={styles.ratioRow}>
                  <Text style={styles.ratioLabel}>Current</Text>
                  <Text style={[styles.ratioValue, { color: COLORS.green }]}>
                    {formatCompact(agedReceivables.current, currency)}
                  </Text>
                </View>
                <View style={styles.ratioRow}>
                  <Text style={styles.ratioLabel}>1-30 Days</Text>
                  <Text style={[styles.ratioValue, { color: COLORS.textPrimary }]}>
                    {formatCompact(agedReceivables.days_1_30, currency)}
                  </Text>
                </View>
                <View style={styles.ratioRow}>
                  <Text style={styles.ratioLabel}>31-60 Days</Text>
                  <Text style={[styles.ratioValue, { color: COLORS.amber }]}>
                    {formatCompact(agedReceivables.days_31_60, currency)}
                  </Text>
                </View>
                <View style={styles.ratioRow}>
                  <Text style={styles.ratioLabel}>61-90 Days</Text>
                  <Text style={[styles.ratioValue, { color: COLORS.amber }]}>
                    {formatCompact(agedReceivables.days_61_90, currency)}
                  </Text>
                </View>
                <View style={styles.ratioRow}>
                  <Text style={styles.ratioLabel}>Over 90 Days</Text>
                  <Text style={[styles.ratioValue, { color: COLORS.red }]}>
                    {formatCompact(agedReceivables.days_over_90, currency)}
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
                  <Text style={[styles.ratioLabel, { fontWeight: 600 }]}>Total</Text>
                  <Text style={[styles.ratioValue, { color: COLORS.textPrimary }]}>
                    {formatCompact(agedReceivables.total, currency)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.ratioBox}>
                <Text style={{ fontSize: 9, color: COLORS.textMuted }}>No receivables data</Text>
              </View>
            )}
          </View>

          {/* Aged Payables */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Aged Payables</Text>
            {agedPayables ? (
              <View style={styles.ratioBox}>
                <View style={styles.ratioRow}>
                  <Text style={styles.ratioLabel}>Current</Text>
                  <Text style={[styles.ratioValue, { color: COLORS.green }]}>
                    {formatCompact(agedPayables.current, currency)}
                  </Text>
                </View>
                <View style={styles.ratioRow}>
                  <Text style={styles.ratioLabel}>1-30 Days</Text>
                  <Text style={[styles.ratioValue, { color: COLORS.textPrimary }]}>
                    {formatCompact(agedPayables.days_1_30, currency)}
                  </Text>
                </View>
                <View style={styles.ratioRow}>
                  <Text style={styles.ratioLabel}>31-60 Days</Text>
                  <Text style={[styles.ratioValue, { color: COLORS.amber }]}>
                    {formatCompact(agedPayables.days_31_60, currency)}
                  </Text>
                </View>
                <View style={styles.ratioRow}>
                  <Text style={styles.ratioLabel}>61-90 Days</Text>
                  <Text style={[styles.ratioValue, { color: COLORS.amber }]}>
                    {formatCompact(agedPayables.days_61_90, currency)}
                  </Text>
                </View>
                <View style={styles.ratioRow}>
                  <Text style={styles.ratioLabel}>Over 90 Days</Text>
                  <Text style={[styles.ratioValue, { color: COLORS.red }]}>
                    {formatCompact(agedPayables.days_over_90, currency)}
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
                  <Text style={[styles.ratioLabel, { fontWeight: 600 }]}>Total</Text>
                  <Text style={[styles.ratioValue, { color: COLORS.textPrimary }]}>
                    {formatCompact(agedPayables.total, currency)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.ratioBox}>
                <Text style={{ fontSize: 9, color: COLORS.textMuted }}>No payables data</Text>
              </View>
            )}
          </View>
        </View>

        {/* Balance Sheet Summary */}
        <View style={[styles.section, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>Balance Sheet</Text>
          {displayLines.length > 0 ? (
            <View>
              {displayLines.map((line, idx) => {
                const isHeader = line.lineType === 'header'
                const isTotal = line.lineType === 'total'
                const isGrandTotal =
                  isTotal &&
                  (line.display.toLowerCase().includes('total assets') ||
                    line.display.toLowerCase().includes('total liabilities') ||
                    line.display.toLowerCase().includes('total equity'))

                const rowStyles = [
                  {
                    flexDirection: 'row' as const,
                    paddingVertical: 3,
                    borderBottomWidth: 0.5,
                    borderBottomColor: '#e0e0e0',
                  },
                  ...(isHeader ? [styles.tableRowHeader] : []),
                  ...(isTotal && !isGrandTotal ? [styles.tableRowTotal] : []),
                  ...(isGrandTotal ? [styles.tableRowGrandTotal] : []),
                  getIndentStyle(line.indentation),
                ]

                const accountStyles = [
                  { flex: 3, fontSize: 9 },
                  ...(isHeader || isTotal
                    ? [{ fontFamily: PDF_FONTS.PRIMARY, fontWeight: 700 }]
                    : []),
                ]

                const amountStyles = [
                  { flex: 1, textAlign: 'right' as const, fontSize: 9, fontFamily: PDF_FONTS.MONO },
                  ...(isHeader || isTotal ? [{ fontWeight: 700 }] : []),
                  ...(line.balance < 0 ? [{ color: COLORS.red }] : []),
                ]

                return (
                  <View key={idx} style={rowStyles} wrap={false}>
                    <Text style={accountStyles}>{line.display}</Text>
                    <Text style={amountStyles}>
                      {isHeader ? '' : formatCompact(line.balance, currency)}
                    </Text>
                  </View>
                )
              })}
            </View>
          ) : (
            <Text style={{ fontSize: 9, color: COLORS.textMuted }}>No balance sheet data</Text>
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
