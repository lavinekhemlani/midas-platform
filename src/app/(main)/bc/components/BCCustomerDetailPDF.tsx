'use client'

import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS } from '@/lib/pdf/fontConfig'
import type {
  CustomerDetailCustomer,
  CustomerDetailInvoice,
  CustomerDetailCreditMemo,
  CustomerDetailShipment,
  CustomerDetailAgedAR,
  CustomerDetailSummary,
} from '../hooks/useBCCustomerDetail'

registerPdfFonts()

const C = {
  bg: '#ffffff',
  bgCard: '#f9fafb',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  text: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  amber: '#d97706',
  green: '#059669',
  red: '#dc2626',
}

const s = StyleSheet.create({
  page: { backgroundColor: C.bg, padding: 36, fontFamily: PDF_FONTS.PRIMARY },
  // Header
  header: { marginBottom: 24 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 22, fontWeight: 700, color: C.text, fontFamily: PDF_FONTS.HEADING },
  customerNumber: {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: 1.5,
    color: C.amber,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  dateLine: { fontSize: 8, color: C.textMuted, textAlign: 'right' as const },
  // Divider
  divider: { height: 1, backgroundColor: C.border, marginVertical: 16 },
  // Info grid
  infoGrid: { flexDirection: 'row', gap: 24, marginBottom: 20 },
  infoCard: { flex: 1 },
  infoCardTitle: {
    fontSize: 7,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: C.textSecondary,
    marginBottom: 8,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  infoLabel: { fontSize: 8, color: C.textSecondary },
  infoValue: { fontSize: 8, color: C.text, fontWeight: 500 },
  infoValueMono: { fontSize: 8, color: C.text, fontWeight: 600, fontFamily: PDF_FONTS.MONO },
  // Metrics
  metricsStrip: {
    flexDirection: 'row',
    gap: 28,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
  },
  metricLabel: {
    fontSize: 6.5,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: C.textSecondary,
    marginBottom: 2,
  },
  metricValue: { fontSize: 16, fontWeight: 700, fontFamily: PDF_FONTS.MONO },
  metricSub: { fontSize: 7, color: C.textMuted, fontFamily: PDF_FONTS.MONO, marginTop: 1 },
  // Aging bar
  agingRow: { flexDirection: 'row', gap: 6 },
  agingItem: {
    flex: 1,
    backgroundColor: C.bgCard,
    borderRadius: 4,
    padding: 6,
    alignItems: 'center' as const,
  },
  agingLabel: { fontSize: 6.5, color: C.textSecondary, marginBottom: 2 },
  agingValue: { fontSize: 9, fontWeight: 600, fontFamily: PDF_FONTS.MONO },
  // Section
  sectionTitle: {
    fontSize: 9,
    fontWeight: 600,
    color: C.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  // Table
  table: { borderWidth: 1, borderColor: C.border, borderRadius: 4, overflow: 'hidden' },
  th: {
    flexDirection: 'row',
    backgroundColor: C.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  thCell: { fontSize: 6.5, fontWeight: 600, color: C.textSecondary, textTransform: 'uppercase' },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  trAlt: { backgroundColor: C.bgCard },
  trTotal: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  td: { fontSize: 7.5, color: C.text },
  tdMuted: { fontSize: 7.5, color: C.textSecondary },
  tdMono: { fontSize: 7.5, color: C.text, fontFamily: PDF_FONTS.MONO },
  tdBold: { fontSize: 7.5, color: C.text, fontWeight: 600, fontFamily: PDF_FONTS.MONO },
  tdRed: { fontSize: 7.5, color: C.red, fontWeight: 600, fontFamily: PDF_FONTS.MONO },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: C.textMuted },
  pageNum: { fontSize: 7, color: C.textMuted, fontFamily: PDF_FONTS.MONO },
})

function fmt(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

function fmtDate(d: string | undefined | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return d
  }
}

const INVOICES_PER_PAGE = 24
const CM_PER_PAGE = 28

export interface BCCustomerDetailPDFProps {
  customer: CustomerDetailCustomer
  invoices: CustomerDetailInvoice[]
  creditMemos: CustomerDetailCreditMemo[]
  shipments: CustomerDetailShipment[]
  agedReceivable: CustomerDetailAgedAR | null
  lcyCurrencyCode: string
  summary: CustomerDetailSummary | null
  companyName?: string | null
}

export function BCCustomerDetailPDF({
  customer,
  invoices,
  creditMemos,
  shipments,
  agedReceivable,
  lcyCurrencyCode,
  summary,
  companyName,
}: BCCustomerDetailPDFProps) {
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const custCcy = customer.currencyCode || 'USD'
  const lcyCcy = lcyCurrencyCode || custCcy

  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
  const totalRemaining = invoices.reduce((sum, inv) => sum + (inv.remainingAmount || 0), 0)
  const totalCredited = creditMemos.reduce((sum, cm) => sum + (cm.amount || 0), 0)

  // Paginate invoices
  const invoicePages: CustomerDetailInvoice[][] = []
  for (let i = 0; i < invoices.length; i += INVOICES_PER_PAGE) {
    invoicePages.push(invoices.slice(i, i + INVOICES_PER_PAGE))
  }

  // Paginate credit memos
  const cmPages: CustomerDetailCreditMemo[][] = []
  for (let i = 0; i < creditMemos.length; i += CM_PER_PAGE) {
    cmPages.push(creditMemos.slice(i, i + CM_PER_PAGE))
  }

  let pageNumber = 0

  return (
    <Document>
      {/* Page 1: Overview */}
      <Page size="A4" style={s.page}>
        {(() => {
          pageNumber++
          return null
        })()}
        {/* Header */}
        <View style={s.header}>
          <View style={s.titleRow}>
            <View>
              <Text style={s.title}>{customer.displayName}</Text>
              <Text style={s.customerNumber}>{customer.number}</Text>
            </View>
            <View>
              <Text style={s.dateLine}>Customer Statement</Text>
              <Text style={s.dateLine}>{generatedAt}</Text>
              {companyName && <Text style={[s.dateLine, { marginTop: 2 }]}>{companyName}</Text>}
            </View>
          </View>
        </View>

        <View style={s.divider} />

        {/* Info Cards Row */}
        <View style={s.infoGrid}>
          {/* Contact */}
          <View style={s.infoCard}>
            <Text style={s.infoCardTitle}>Contact Information</Text>
            {customer.phoneNumber ? (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Phone</Text>
                <Text style={s.infoValue}>{customer.phoneNumber}</Text>
              </View>
            ) : null}
            {customer.email ? (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Email</Text>
                <Text style={s.infoValue}>{customer.email}</Text>
              </View>
            ) : null}
            {!customer.phoneNumber && !customer.email && (
              <Text style={s.infoLabel}>No contact information</Text>
            )}
          </View>

          {/* Financial Terms */}
          <View style={s.infoCard}>
            <Text style={s.infoCardTitle}>Financial Terms</Text>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Currency</Text>
              <Text style={s.infoValue}>{custCcy}</Text>
            </View>
            {customer.creditLimit > 0 && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Credit Limit</Text>
                <Text style={s.infoValueMono}>{fmt(customer.creditLimit, custCcy)}</Text>
              </View>
            )}
            {lcyCcy && lcyCcy !== custCcy && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Company LCY</Text>
                <Text style={s.infoValue}>{lcyCcy}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Key Metrics */}
        <View style={s.metricsStrip}>
          <View>
            <Text style={s.metricLabel}>Balance Due ({custCcy})</Text>
            <Text style={[s.metricValue, { color: customer.balanceDue > 0 ? C.red : C.text }]}>
              {fmt(customer.balanceDue, custCcy)}
            </Text>
          </View>
          <View>
            <Text style={s.metricLabel}>Total Invoiced ({custCcy})</Text>
            <Text style={[s.metricValue, { color: C.text }]}>{fmt(totalInvoiced, custCcy)}</Text>
            <Text style={s.metricSub}>
              {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View>
            <Text style={s.metricLabel}>Total Remaining ({custCcy})</Text>
            <Text style={[s.metricValue, { color: totalRemaining > 0 ? C.red : C.text }]}>
              {fmt(totalRemaining, custCcy)}
            </Text>
          </View>
          <View>
            <Text style={s.metricLabel}>Credit Memos</Text>
            <Text style={[s.metricValue, { color: C.text }]}>{fmt(totalCredited, custCcy)}</Text>
            <Text style={s.metricSub}>
              {creditMemos.length} memo{creditMemos.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Aging Summary */}
        {agedReceivable && (
          <View style={{ marginBottom: 20 }}>
            <Text style={s.sectionTitle}>Aging Summary ({lcyCcy})</Text>
            <View style={s.agingRow}>
              <View style={s.agingItem}>
                <Text style={s.agingLabel}>Current</Text>
                <Text style={[s.agingValue, { color: C.green }]}>
                  {fmt(agedReceivable.currentAmount, lcyCcy)}
                </Text>
              </View>
              <View style={s.agingItem}>
                <Text style={s.agingLabel}>1-30 Days</Text>
                <Text style={[s.agingValue, { color: C.amber }]}>
                  {fmt(agedReceivable.period1Amount, lcyCcy)}
                </Text>
              </View>
              <View style={s.agingItem}>
                <Text style={s.agingLabel}>31-60 Days</Text>
                <Text style={[s.agingValue, { color: C.amber }]}>
                  {fmt(agedReceivable.period2Amount, lcyCcy)}
                </Text>
              </View>
              <View style={s.agingItem}>
                <Text style={s.agingLabel}>61+ Days</Text>
                <Text style={[s.agingValue, { color: C.red }]}>
                  {fmt(agedReceivable.period3Amount, lcyCcy)}
                </Text>
              </View>
              <View style={[s.agingItem, { backgroundColor: '#f3f4f6' }]}>
                <Text style={[s.agingLabel, { fontWeight: 600 }]}>Total</Text>
                <Text style={[s.agingValue, { color: C.text }]}>
                  {fmt(agedReceivable.balanceDue, lcyCcy)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Invoices (first page) */}
        {invoices.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>
              Sales Invoices ({invoices.length})
              {invoicePages.length > 1 ? ' — continued on next page' : ''}
            </Text>
            <View style={s.table}>
              <View style={s.th}>
                <Text style={[s.thCell, { width: '14%' }]}>Invoice #</Text>
                <Text style={[s.thCell, { width: '14%' }]}>Date</Text>
                <Text style={[s.thCell, { width: '14%' }]}>Due Date</Text>
                <Text style={[s.thCell, { width: '18%', textAlign: 'right' as const }]}>
                  Amount
                </Text>
                <Text style={[s.thCell, { width: '18%', textAlign: 'right' as const }]}>
                  Remaining
                </Text>
                <Text style={[s.thCell, { width: '12%' }]}>Status</Text>
                <Text style={[s.thCell, { width: '10%' }]}>Order</Text>
              </View>
              {invoicePages[0].map((inv, idx) => {
                const now = new Date().toISOString().split('T')[0]
                const isOverdue = inv.dueDate && inv.dueDate < now && inv.remainingAmount > 0
                return (
                  <View
                    key={inv.id || idx}
                    style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]}
                    wrap={false}
                  >
                    <Text style={[s.tdMono, { width: '14%' }]}>{inv.number}</Text>
                    <Text style={[s.td, { width: '14%' }]}>{fmtDate(inv.postingDate)}</Text>
                    <Text style={[s.td, { width: '14%' }]}>{fmtDate(inv.dueDate)}</Text>
                    <Text style={[s.tdBold, { width: '18%', textAlign: 'right' as const }]}>
                      {fmt(inv.amount, custCcy)}
                    </Text>
                    <Text
                      style={[
                        inv.remainingAmount > 0 ? s.tdRed : s.tdMuted,
                        { width: '18%', textAlign: 'right' as const },
                      ]}
                    >
                      {inv.remainingAmount > 0 ? fmt(inv.remainingAmount, custCcy) : '—'}
                    </Text>
                    <Text style={[s.td, { width: '12%', color: isOverdue ? C.red : C.text }]}>
                      {isOverdue ? 'Overdue' : inv.status}
                    </Text>
                    <Text style={[s.tdMuted, { width: '10%', fontFamily: PDF_FONTS.MONO }]}>
                      {inv.orderNumber || '—'}
                    </Text>
                  </View>
                )
              })}
              {invoicePages.length === 1 && (
                <View style={s.trTotal} wrap={false}>
                  <Text style={[s.tdBold, { width: '42%' }]}>
                    TOTAL ({invoices.length} invoice{invoices.length !== 1 ? 's' : ''})
                  </Text>
                  <Text style={[s.tdBold, { width: '18%', textAlign: 'right' as const }]}>
                    {fmt(totalInvoiced, custCcy)}
                  </Text>
                  <Text
                    style={[
                      totalRemaining > 0 ? s.tdRed : s.tdBold,
                      { width: '18%', textAlign: 'right' as const },
                    ]}
                  >
                    {fmt(totalRemaining, custCcy)}
                  </Text>
                  <Text style={[s.td, { width: '22%' }]} />
                </View>
              )}
            </View>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generated {generatedAt}</Text>
          <Text style={s.pageNum} render={({ pageNumber: pn }) => `Page ${pn}`} />
        </View>
      </Page>

      {/* Additional invoice pages */}
      {invoicePages.slice(1).map((pageInvoices, pageIdx) => {
        pageNumber++
        return (
          <Page key={`inv-${pageIdx}`} size="A4" style={s.page}>
            <Text style={s.sectionTitle}>
              Sales Invoices — Page {pageIdx + 2} of {invoicePages.length}
            </Text>
            <View style={s.table}>
              <View style={s.th}>
                <Text style={[s.thCell, { width: '14%' }]}>Invoice #</Text>
                <Text style={[s.thCell, { width: '14%' }]}>Date</Text>
                <Text style={[s.thCell, { width: '14%' }]}>Due Date</Text>
                <Text style={[s.thCell, { width: '18%', textAlign: 'right' as const }]}>
                  Amount
                </Text>
                <Text style={[s.thCell, { width: '18%', textAlign: 'right' as const }]}>
                  Remaining
                </Text>
                <Text style={[s.thCell, { width: '12%' }]}>Status</Text>
                <Text style={[s.thCell, { width: '10%' }]}>Order</Text>
              </View>
              {pageInvoices.map((inv, idx) => {
                const now = new Date().toISOString().split('T')[0]
                const isOverdue = inv.dueDate && inv.dueDate < now && inv.remainingAmount > 0
                return (
                  <View
                    key={inv.id || idx}
                    style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]}
                    wrap={false}
                  >
                    <Text style={[s.tdMono, { width: '14%' }]}>{inv.number}</Text>
                    <Text style={[s.td, { width: '14%' }]}>{fmtDate(inv.postingDate)}</Text>
                    <Text style={[s.td, { width: '14%' }]}>{fmtDate(inv.dueDate)}</Text>
                    <Text style={[s.tdBold, { width: '18%', textAlign: 'right' as const }]}>
                      {fmt(inv.amount, custCcy)}
                    </Text>
                    <Text
                      style={[
                        inv.remainingAmount > 0 ? s.tdRed : s.tdMuted,
                        { width: '18%', textAlign: 'right' as const },
                      ]}
                    >
                      {inv.remainingAmount > 0 ? fmt(inv.remainingAmount, custCcy) : '—'}
                    </Text>
                    <Text style={[s.td, { width: '12%', color: isOverdue ? C.red : C.text }]}>
                      {isOverdue ? 'Overdue' : inv.status}
                    </Text>
                    <Text style={[s.tdMuted, { width: '10%', fontFamily: PDF_FONTS.MONO }]}>
                      {inv.orderNumber || '—'}
                    </Text>
                  </View>
                )
              })}
              {pageIdx === invoicePages.length - 2 && (
                <View style={s.trTotal} wrap={false}>
                  <Text style={[s.tdBold, { width: '42%' }]}>
                    TOTAL ({invoices.length} invoice{invoices.length !== 1 ? 's' : ''})
                  </Text>
                  <Text style={[s.tdBold, { width: '18%', textAlign: 'right' as const }]}>
                    {fmt(totalInvoiced, custCcy)}
                  </Text>
                  <Text
                    style={[
                      totalRemaining > 0 ? s.tdRed : s.tdBold,
                      { width: '18%', textAlign: 'right' as const },
                    ]}
                  >
                    {fmt(totalRemaining, custCcy)}
                  </Text>
                  <Text style={[s.td, { width: '22%' }]} />
                </View>
              )}
            </View>
            <View style={s.footer} fixed>
              <Text style={s.footerText}>Generated {generatedAt}</Text>
              <Text style={s.pageNum} render={({ pageNumber: pn }) => `Page ${pn}`} />
            </View>
          </Page>
        )
      })}

      {/* Credit Memos pages */}
      {creditMemos.length > 0 &&
        cmPages.map((pageCMs, pageIdx) => {
          pageNumber++
          return (
            <Page key={`cm-${pageIdx}`} size="A4" style={s.page}>
              <Text style={s.sectionTitle}>
                Credit Memos ({creditMemos.length})
                {cmPages.length > 1 ? ` — Page ${pageIdx + 1} of ${cmPages.length}` : ''}
              </Text>
              <View style={s.table}>
                <View style={s.th}>
                  <Text style={[s.thCell, { width: '20%' }]}>Memo #</Text>
                  <Text style={[s.thCell, { width: '25%' }]}>Date</Text>
                  <Text style={[s.thCell, { width: '25%' }]}>Linked Invoice</Text>
                  <Text style={[s.thCell, { width: '30%', textAlign: 'right' as const }]}>
                    Amount
                  </Text>
                </View>
                {pageCMs.map((cm, idx) => (
                  <View
                    key={cm.id || idx}
                    style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]}
                    wrap={false}
                  >
                    <Text style={[s.tdMono, { width: '20%' }]}>{cm.number}</Text>
                    <Text style={[s.td, { width: '25%' }]}>{fmtDate(cm.postingDate)}</Text>
                    <Text style={[s.tdMuted, { width: '25%', fontFamily: PDF_FONTS.MONO }]}>
                      {cm.invoiceNumber || '—'}
                    </Text>
                    <Text style={[s.tdBold, { width: '30%', textAlign: 'right' as const }]}>
                      {fmt(cm.amount, custCcy)}
                    </Text>
                  </View>
                ))}
                {pageIdx === cmPages.length - 1 && (
                  <View style={s.trTotal} wrap={false}>
                    <Text style={[s.tdBold, { width: '70%' }]}>
                      TOTAL ({creditMemos.length} credit memo{creditMemos.length !== 1 ? 's' : ''})
                    </Text>
                    <Text style={[s.tdBold, { width: '30%', textAlign: 'right' as const }]}>
                      {fmt(totalCredited, custCcy)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Shipments on last CM page if they fit */}
              {pageIdx === cmPages.length - 1 && shipments.length > 0 && shipments.length <= 20 && (
                <View style={{ marginTop: 20 }}>
                  <Text style={s.sectionTitle}>Shipments ({shipments.length})</Text>
                  <View style={s.table}>
                    <View style={s.th}>
                      <Text style={[s.thCell, { width: '30%' }]}>Shipment #</Text>
                      <Text style={[s.thCell, { width: '35%' }]}>Posting Date</Text>
                      <Text style={[s.thCell, { width: '35%' }]}>Order #</Text>
                    </View>
                    {shipments.map((sh, idx) => (
                      <View
                        key={sh.id || idx}
                        style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]}
                        wrap={false}
                      >
                        <Text style={[s.tdMono, { width: '30%' }]}>{sh.number}</Text>
                        <Text style={[s.td, { width: '35%' }]}>{fmtDate(sh.postingDate)}</Text>
                        <Text style={[s.tdMuted, { width: '35%', fontFamily: PDF_FONTS.MONO }]}>
                          {sh.orderNumber || '—'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={s.footer} fixed>
                <Text style={s.footerText}>Generated {generatedAt}</Text>
                <Text style={s.pageNum} render={({ pageNumber: pn }) => `Page ${pn}`} />
              </View>
            </Page>
          )
        })}

      {/* Standalone shipments page if no credit memos or too many shipments */}
      {shipments.length > 0 && (creditMemos.length === 0 || shipments.length > 20) && (
        <Page size="A4" style={s.page}>
          {(() => {
            pageNumber++
            return null
          })()}
          <Text style={s.sectionTitle}>Shipments ({shipments.length})</Text>
          <View style={s.table}>
            <View style={s.th}>
              <Text style={[s.thCell, { width: '30%' }]}>Shipment #</Text>
              <Text style={[s.thCell, { width: '35%' }]}>Posting Date</Text>
              <Text style={[s.thCell, { width: '35%' }]}>Order #</Text>
            </View>
            {shipments.map((sh, idx) => (
              <View key={sh.id || idx} style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]} wrap={false}>
                <Text style={[s.tdMono, { width: '30%' }]}>{sh.number}</Text>
                <Text style={[s.td, { width: '35%' }]}>{fmtDate(sh.postingDate)}</Text>
                <Text style={[s.tdMuted, { width: '35%', fontFamily: PDF_FONTS.MONO }]}>
                  {sh.orderNumber || '—'}
                </Text>
              </View>
            ))}
          </View>
          <View style={s.footer} fixed>
            <Text style={s.footerText}>Generated {generatedAt}</Text>
            <Text style={s.pageNum} render={({ pageNumber: pn }) => `Page ${pn}`} />
          </View>
        </Page>
      )}
    </Document>
  )
}
