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

interface BCCustomer {
  id: string
  number: string
  displayName: string
  email?: string
  phoneNumber?: string
  balanceDue: number
  creditLimit?: number
  currencyCode?: string
}

interface BCAgedReceivable {
  customerId: string
  customerNumber: string
  name: string
  currencyCode?: string
  balanceDue: number
  currentAmount: number
  period1Amount: number
  period2Amount: number
  period3Amount: number
  agedAsOfDate?: string
}

interface BCCustomerSummary {
  totalAR: number
  customerCount: number
  customersWithBalance: number
}

export interface BCCustomersPDFProps {
  customers: BCCustomer[]
  agedReceivables: BCAgedReceivable[]
  summary: BCCustomerSummary | null
  companyName?: string | null
  currency?: string
}

const CUSTOMERS_PER_PAGE = 30
const RECEIVABLES_PER_PAGE = 25

export function BCCustomersPDF({
  customers,
  agedReceivables,
  summary,
  companyName,
  currency = 'USD',
}: BCCustomersPDFProps) {
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const agedTotals = agedReceivables.reduce(
    (acc, ar) => ({
      balanceDue: acc.balanceDue + ar.balanceDue,
      current: acc.current + ar.currentAmount,
      period1: acc.period1 + ar.period1Amount,
      period2: acc.period2 + ar.period2Amount,
      period3: acc.period3 + ar.period3Amount,
    }),
    { balanceDue: 0, current: 0, period1: 0, period2: 0, period3: 0 }
  )

  const customerPages: BCCustomer[][] = []
  for (let i = 0; i < customers.length; i += CUSTOMERS_PER_PAGE) {
    customerPages.push(customers.slice(i, i + CUSTOMERS_PER_PAGE))
  }

  const receivablePages: BCAgedReceivable[][] = []
  for (let i = 0; i < agedReceivables.length; i += RECEIVABLES_PER_PAGE) {
    receivablePages.push(agedReceivables.slice(i, i + RECEIVABLES_PER_PAGE))
  }

  let pageNumber = 0

  return (
    <Document>
      {/* Aged Receivables Pages */}
      {receivablePages.map((pageReceivables, pageIdx) => {
        pageNumber++
        return (
          <Page key={`receivables-${pageIdx}`} size="A4" style={styles.page}>
            {pageIdx === 0 && (
              <>
                <View style={styles.header}>
                  <View style={styles.titleRow}>
                    <View>
                      <Text style={styles.title}>Customers Report</Text>
                      <Text style={styles.subtitle}>
                        {companyName ? `${companyName} · ` : ''}Business Central
                      </Text>
                    </View>
                  </View>
                </View>

                {summary && (
                  <View style={styles.metricsStrip}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Total Customers</Text>
                      <Text style={[styles.metricValue, { color: COLORS.textPrimary }]}>
                        {summary.customerCount.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Total AR</Text>
                      <Text style={[styles.metricValue, { color: COLORS.green }]}>
                        {formatCompact(summary.totalAR, currency)}
                      </Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>With Balance</Text>
                      <Text style={[styles.metricValue, { color: COLORS.textPrimary }]}>
                        {summary.customersWithBalance.toLocaleString()}
                      </Text>
                    </View>
                    {agedReceivables.length > 0 && (
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>Overdue (61-90+)</Text>
                        <Text style={[styles.metricValue, { color: COLORS.orange }]}>
                          {formatCompact(agedTotals.period3, currency)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Aged Accounts Receivable
                {receivablePages.length > 1
                  ? ` (Page ${pageIdx + 1} of ${receivablePages.length})`
                  : ''}
              </Text>

              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { width: '6%' }]}>#</Text>
                  <Text style={[styles.tableHeaderCell, { width: '30%' }]}>Customer</Text>
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
                {pageReceivables.map((ar, idx) => {
                  const globalIdx = pageIdx * RECEIVABLES_PER_PAGE + idx
                  return (
                    <View
                      key={ar.customerId || idx}
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
                        {ar.name.length > 26 ? ar.name.substring(0, 26) + '...' : ar.name}
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
                        {formatCompact(ar.balanceDue, currency)}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          styles.tableCellMuted,
                          { width: '12%', textAlign: 'right', fontFamily: PDF_FONTS.MONO },
                        ]}
                      >
                        {formatCompact(ar.currentAmount, currency)}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          styles.tableCellMuted,
                          { width: '12%', textAlign: 'right', fontFamily: PDF_FONTS.MONO },
                        ]}
                      >
                        {formatCompact(ar.period1Amount, currency)}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          styles.tableCellMuted,
                          { width: '12%', textAlign: 'right', fontFamily: PDF_FONTS.MONO },
                        ]}
                      >
                        {formatCompact(ar.period2Amount, currency)}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          {
                            width: '12%',
                            textAlign: 'right',
                            fontFamily: PDF_FONTS.MONO,
                            color: ar.period3Amount > 0 ? COLORS.red : COLORS.textMuted,
                            fontWeight: ar.period3Amount > 0 ? 600 : 400,
                          },
                        ]}
                      >
                        {formatCompact(ar.period3Amount, currency)}
                      </Text>
                    </View>
                  )
                })}
                {pageIdx === receivablePages.length - 1 && (
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

            <View style={styles.footer} fixed>
              <Text style={styles.footerText}>Generated {generatedAt}</Text>
              <Text style={styles.pageNumber}>Page {pageNumber}</Text>
            </View>
          </Page>
        )
      })}

      {/* Customer List Pages */}
      {customerPages.map((pageCustomers, pageIdx) => {
        pageNumber++
        return (
          <Page key={`customers-${pageIdx}`} size="A4" style={styles.page}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                All Customers
                {customerPages.length > 1
                  ? ` (Page ${pageIdx + 1} of ${customerPages.length})`
                  : ''}
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
                {pageCustomers.map((customer, idx) => {
                  const globalIdx = pageIdx * CUSTOMERS_PER_PAGE + idx
                  return (
                    <View
                      key={customer.id || idx}
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
                        {customer.displayName.length > 30
                          ? customer.displayName.substring(0, 30) + '...'
                          : customer.displayName}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          styles.tableCellMuted,
                          { width: '12%', fontFamily: PDF_FONTS.MONO },
                        ]}
                      >
                        {customer.number}
                      </Text>
                      <Text style={[styles.tableCell, styles.tableCellMuted, { width: '30%' }]}>
                        {customer.email
                          ? customer.email.length > 28
                            ? customer.email.substring(0, 28) + '...'
                            : customer.email
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
                            color: customer.balanceDue > 0 ? COLORS.textPrimary : COLORS.textMuted,
                          },
                        ]}
                      >
                        {formatCompact(customer.balanceDue || 0, currency)}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </View>

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
