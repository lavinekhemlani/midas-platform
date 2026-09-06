'use client'

import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS } from '@/lib/pdf/fontConfig'
import type {
  BCVendorProfile,
  BCPurchaseInvoice,
  BCPurchaseOrder,
  BCPurchaseCreditMemo,
  BCPurchaseReceipt,
  BCAgedPayableDetail,
  BCVendorDetailSummary,
} from '../hooks/useBCVendorDetail'

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
  vendorNumber: {
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
  dividerThin: { height: 1, backgroundColor: C.borderLight, marginVertical: 10 },
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

const INVOICES_PER_PAGE = 22
const ORDERS_PER_PAGE = 24
const CM_PER_PAGE = 24

export interface BCVendorDetailPDFProps {
  vendor: BCVendorProfile
  invoices: BCPurchaseInvoice[]
  orders: BCPurchaseOrder[]
  creditMemos: BCPurchaseCreditMemo[]
  receipts: BCPurchaseReceipt[]
  agedPayable: BCAgedPayableDetail | null
  lcyCurrencyCode: string
  summary: BCVendorDetailSummary | null
  companyName?: string | null
}

export function BCVendorDetailPDF({
  vendor,
  invoices,
  orders,
  creditMemos,
  receipts,
  agedPayable,
  lcyCurrencyCode,
  summary,
  companyName,
}: BCVendorDetailPDFProps) {
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const lcyCcy = lcyCurrencyCode || 'USD'
  const vendorCcy = vendor.currencyCode || lcyCcy

  const address = [
    vendor.addressLine1,
    vendor.addressLine2,
    [vendor.city, vendor.state, vendor.postalCode].filter(Boolean).join(', '),
    vendor.country,
  ]
    .filter(Boolean)
    .join(', ')

  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.totalAmountIncludingTax || 0), 0)
  const totalCM = creditMemos.reduce((sum, cm) => sum + (cm.totalAmountIncludingTax || 0), 0)
  const totalOrders = orders.reduce((sum, o) => sum + (o.totalAmountIncludingTax || 0), 0)

  let pageNumber = 0

  // Paginate invoices
  const invoicePages: BCPurchaseInvoice[][] = []
  for (let i = 0; i < invoices.length; i += INVOICES_PER_PAGE) {
    invoicePages.push(invoices.slice(i, i + INVOICES_PER_PAGE))
  }

  // Paginate orders
  const orderPages: BCPurchaseOrder[][] = []
  for (let i = 0; i < orders.length; i += ORDERS_PER_PAGE) {
    orderPages.push(orders.slice(i, i + ORDERS_PER_PAGE))
  }

  // Paginate credit memos
  const cmPages: BCPurchaseCreditMemo[][] = []
  for (let i = 0; i < creditMemos.length; i += CM_PER_PAGE) {
    cmPages.push(creditMemos.slice(i, i + CM_PER_PAGE))
  }

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
              <Text style={s.title}>{vendor.displayName}</Text>
              <Text style={s.vendorNumber}>{vendor.number}</Text>
            </View>
            <View>
              <Text style={s.dateLine}>Vendor Statement</Text>
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
            {address ? (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Address</Text>
                <Text style={[s.infoValue, { maxWidth: 160, textAlign: 'right' as const }]}>
                  {address}
                </Text>
              </View>
            ) : null}
            {vendor.phoneNumber ? (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Phone</Text>
                <Text style={s.infoValue}>{vendor.phoneNumber}</Text>
              </View>
            ) : null}
            {vendor.email ? (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Email</Text>
                <Text style={s.infoValue}>{vendor.email}</Text>
              </View>
            ) : null}
            {vendor.website ? (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Website</Text>
                <Text style={s.infoValue}>{vendor.website}</Text>
              </View>
            ) : null}
            {!address && !vendor.phoneNumber && !vendor.email && !vendor.website && (
              <Text style={s.infoLabel}>No contact information</Text>
            )}
          </View>

          {/* Financial Terms */}
          <View style={s.infoCard}>
            <Text style={s.infoCardTitle}>Financial Terms</Text>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Payment Terms</Text>
              <Text style={s.infoValue}>
                {vendor.paymentTerms?.displayName || vendor.paymentTerms?.code || '—'}
              </Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Payment Method</Text>
              <Text style={s.infoValue}>
                {vendor.paymentMethod?.displayName || vendor.paymentMethod?.code || '—'}
              </Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Currency</Text>
              <Text style={s.infoValue}>{vendorCcy}</Text>
            </View>
            {vendor.taxRegistrationNumber ? (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Tax Reg. #</Text>
                <Text style={s.infoValueMono}>{vendor.taxRegistrationNumber}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Key Metrics */}
        <View style={s.metricsStrip}>
          <View>
            <Text style={s.metricLabel}>Balance Due ({lcyCcy})</Text>
            <Text style={[s.metricValue, { color: vendor.balance > 0 ? C.red : C.text }]}>
              {fmt(vendor.balance, lcyCcy)}
            </Text>
          </View>
          <View>
            <Text style={s.metricLabel}>Total Invoiced ({vendorCcy})</Text>
            <Text style={[s.metricValue, { color: C.text }]}>{fmt(totalInvoiced, vendorCcy)}</Text>
            <Text style={s.metricSub}>
              {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View>
            <Text style={s.metricLabel}>Credit Memos ({vendorCcy})</Text>
            <Text style={[s.metricValue, { color: C.text }]}>{fmt(totalCM, vendorCcy)}</Text>
            <Text style={s.metricSub}>
              {creditMemos.length} memo{creditMemos.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View>
            <Text style={s.metricLabel}>Open POs</Text>
            <Text style={[s.metricValue, { color: C.text }]}>
              {summary?.openOrders ?? orders.filter((o) => o.status === 'Open').length}
            </Text>
            <Text style={s.metricSub}>of {orders.length} total</Text>
          </View>
        </View>

        {/* Aging Summary */}
        {agedPayable && (
          <View style={{ marginBottom: 20 }}>
            <Text style={s.sectionTitle}>Aging Summary ({lcyCcy})</Text>
            <View style={s.agingRow}>
              <View style={s.agingItem}>
                <Text style={s.agingLabel}>Current</Text>
                <Text style={[s.agingValue, { color: C.green }]}>
                  {fmt(agedPayable.currentAmount, lcyCcy)}
                </Text>
              </View>
              <View style={s.agingItem}>
                <Text style={s.agingLabel}>1-30 Days</Text>
                <Text style={[s.agingValue, { color: C.amber }]}>
                  {fmt(agedPayable.period1Amount, lcyCcy)}
                </Text>
              </View>
              <View style={s.agingItem}>
                <Text style={s.agingLabel}>31-60 Days</Text>
                <Text style={[s.agingValue, { color: C.amber }]}>
                  {fmt(agedPayable.period2Amount, lcyCcy)}
                </Text>
              </View>
              <View style={s.agingItem}>
                <Text style={s.agingLabel}>61+ Days</Text>
                <Text style={[s.agingValue, { color: C.red }]}>
                  {fmt(agedPayable.period3Amount, lcyCcy)}
                </Text>
              </View>
              <View style={[s.agingItem, { backgroundColor: '#f3f4f6' }]}>
                <Text style={[s.agingLabel, { fontWeight: 600 }]}>Total</Text>
                <Text style={[s.agingValue, { color: C.text }]}>
                  {fmt(agedPayable.balanceDue, lcyCcy)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Invoices preview (first page) */}
        {invoices.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>
              Purchase Invoices ({invoices.length})
              {invoicePages.length > 1 ? ' — continued on next page' : ''}
            </Text>
            <View style={s.table}>
              <View style={s.th}>
                <Text style={[s.thCell, { width: '14%' }]}>Invoice #</Text>
                <Text style={[s.thCell, { width: '16%' }]}>Vendor Ref</Text>
                <Text style={[s.thCell, { width: '14%' }]}>Date</Text>
                <Text style={[s.thCell, { width: '14%' }]}>Due Date</Text>
                <Text style={[s.thCell, { width: '12%' }]}>Status</Text>
                <Text style={[s.thCell, { width: '15%', textAlign: 'right' as const }]}>
                  Excl. Tax
                </Text>
                <Text style={[s.thCell, { width: '15%', textAlign: 'right' as const }]}>
                  Incl. Tax
                </Text>
              </View>
              {invoicePages[0].map((inv, idx) => (
                <View key={inv.id || idx} style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]} wrap={false}>
                  <Text style={[s.tdMono, { width: '14%' }]}>{inv.number}</Text>
                  <Text style={[s.tdMuted, { width: '16%' }]}>
                    {(inv.vendorInvoiceNumber || '—').substring(0, 16)}
                  </Text>
                  <Text style={[s.td, { width: '14%' }]}>{fmtDate(inv.invoiceDate)}</Text>
                  <Text style={[s.td, { width: '14%' }]}>{fmtDate(inv.dueDate)}</Text>
                  <Text style={[s.td, { width: '12%' }]}>{inv.status}</Text>
                  <Text style={[s.tdMono, { width: '15%', textAlign: 'right' as const }]}>
                    {fmt(inv.totalAmountExcludingTax, inv.currencyCode || lcyCcy)}
                  </Text>
                  <Text style={[s.tdBold, { width: '15%', textAlign: 'right' as const }]}>
                    {fmt(inv.totalAmountIncludingTax, inv.currencyCode || lcyCcy)}
                  </Text>
                </View>
              ))}
              {/* Total on last page of invoices or here if only one page */}
              {invoicePages.length === 1 && (
                <View style={s.trTotal} wrap={false}>
                  <Text style={[s.tdBold, { width: '70%' }]}>
                    TOTAL ({invoices.length} invoice{invoices.length !== 1 ? 's' : ''})
                  </Text>
                  <Text style={[s.tdBold, { width: '15%', textAlign: 'right' as const }]}>
                    {fmt(
                      invoices.reduce((sum, inv) => sum + (inv.totalAmountExcludingTax || 0), 0),
                      vendorCcy
                    )}
                  </Text>
                  <Text style={[s.tdBold, { width: '15%', textAlign: 'right' as const }]}>
                    {fmt(totalInvoiced, vendorCcy)}
                  </Text>
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
              Purchase Invoices — Page {pageIdx + 2} of {invoicePages.length}
            </Text>
            <View style={s.table}>
              <View style={s.th}>
                <Text style={[s.thCell, { width: '14%' }]}>Invoice #</Text>
                <Text style={[s.thCell, { width: '16%' }]}>Vendor Ref</Text>
                <Text style={[s.thCell, { width: '14%' }]}>Date</Text>
                <Text style={[s.thCell, { width: '14%' }]}>Due Date</Text>
                <Text style={[s.thCell, { width: '12%' }]}>Status</Text>
                <Text style={[s.thCell, { width: '15%', textAlign: 'right' as const }]}>
                  Excl. Tax
                </Text>
                <Text style={[s.thCell, { width: '15%', textAlign: 'right' as const }]}>
                  Incl. Tax
                </Text>
              </View>
              {pageInvoices.map((inv, idx) => (
                <View key={inv.id || idx} style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]} wrap={false}>
                  <Text style={[s.tdMono, { width: '14%' }]}>{inv.number}</Text>
                  <Text style={[s.tdMuted, { width: '16%' }]}>
                    {(inv.vendorInvoiceNumber || '—').substring(0, 16)}
                  </Text>
                  <Text style={[s.td, { width: '14%' }]}>{fmtDate(inv.invoiceDate)}</Text>
                  <Text style={[s.td, { width: '14%' }]}>{fmtDate(inv.dueDate)}</Text>
                  <Text style={[s.td, { width: '12%' }]}>{inv.status}</Text>
                  <Text style={[s.tdMono, { width: '15%', textAlign: 'right' as const }]}>
                    {fmt(inv.totalAmountExcludingTax, inv.currencyCode || lcyCcy)}
                  </Text>
                  <Text style={[s.tdBold, { width: '15%', textAlign: 'right' as const }]}>
                    {fmt(inv.totalAmountIncludingTax, inv.currencyCode || lcyCcy)}
                  </Text>
                </View>
              ))}
              {/* Total on last page */}
              {pageIdx === invoicePages.length - 2 && (
                <View style={s.trTotal} wrap={false}>
                  <Text style={[s.tdBold, { width: '70%' }]}>
                    TOTAL ({invoices.length} invoice{invoices.length !== 1 ? 's' : ''})
                  </Text>
                  <Text style={[s.tdBold, { width: '15%', textAlign: 'right' as const }]}>
                    {fmt(
                      invoices.reduce((sum, inv) => sum + (inv.totalAmountExcludingTax || 0), 0),
                      vendorCcy
                    )}
                  </Text>
                  <Text style={[s.tdBold, { width: '15%', textAlign: 'right' as const }]}>
                    {fmt(totalInvoiced, vendorCcy)}
                  </Text>
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

      {/* Purchase Orders pages */}
      {orders.length > 0 &&
        orderPages.map((pageOrders, pageIdx) => {
          pageNumber++
          return (
            <Page key={`po-${pageIdx}`} size="A4" style={s.page}>
              <Text style={s.sectionTitle}>
                Purchase Orders ({orders.length})
                {orderPages.length > 1 ? ` — Page ${pageIdx + 1} of ${orderPages.length}` : ''}
              </Text>
              <View style={s.table}>
                <View style={s.th}>
                  <Text style={[s.thCell, { width: '16%' }]}>PO #</Text>
                  <Text style={[s.thCell, { width: '18%' }]}>Order Date</Text>
                  <Text style={[s.thCell, { width: '16%' }]}>Status</Text>
                  <Text style={[s.thCell, { width: '14%' }]}>Received</Text>
                  <Text style={[s.thCell, { width: '18%', textAlign: 'right' as const }]}>
                    Excl. Tax
                  </Text>
                  <Text style={[s.thCell, { width: '18%', textAlign: 'right' as const }]}>
                    Incl. Tax
                  </Text>
                </View>
                {pageOrders.map((order, idx) => (
                  <View
                    key={order.id || idx}
                    style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]}
                    wrap={false}
                  >
                    <Text style={[s.tdMono, { width: '16%' }]}>{order.number}</Text>
                    <Text style={[s.td, { width: '18%' }]}>{fmtDate(order.orderDate)}</Text>
                    <Text style={[s.td, { width: '16%' }]}>{order.status}</Text>
                    <Text style={[s.td, { width: '14%' }]}>
                      {order.fullyReceived ? 'Yes' : 'Partial'}
                    </Text>
                    <Text style={[s.tdMono, { width: '18%', textAlign: 'right' as const }]}>
                      {fmt(order.totalAmountExcludingTax, order.currencyCode || lcyCcy)}
                    </Text>
                    <Text style={[s.tdBold, { width: '18%', textAlign: 'right' as const }]}>
                      {fmt(order.totalAmountIncludingTax, order.currencyCode || lcyCcy)}
                    </Text>
                  </View>
                ))}
                {pageIdx === orderPages.length - 1 && (
                  <View style={s.trTotal} wrap={false}>
                    <Text style={[s.tdBold, { width: '64%' }]}>
                      TOTAL ({orders.length} order{orders.length !== 1 ? 's' : ''})
                    </Text>
                    <Text style={[s.tdBold, { width: '18%', textAlign: 'right' as const }]}>
                      {fmt(
                        orders.reduce((sum, o) => sum + (o.totalAmountExcludingTax || 0), 0),
                        vendorCcy
                      )}
                    </Text>
                    <Text style={[s.tdBold, { width: '18%', textAlign: 'right' as const }]}>
                      {fmt(totalOrders, vendorCcy)}
                    </Text>
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
                  <Text style={[s.thCell, { width: '16%' }]}>CM #</Text>
                  <Text style={[s.thCell, { width: '18%' }]}>Date</Text>
                  <Text style={[s.thCell, { width: '18%' }]}>Linked Invoice</Text>
                  <Text style={[s.thCell, { width: '14%' }]}>Status</Text>
                  <Text style={[s.thCell, { width: '17%', textAlign: 'right' as const }]}>
                    Excl. Tax
                  </Text>
                  <Text style={[s.thCell, { width: '17%', textAlign: 'right' as const }]}>
                    Incl. Tax
                  </Text>
                </View>
                {pageCMs.map((cm, idx) => (
                  <View
                    key={cm.id || idx}
                    style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]}
                    wrap={false}
                  >
                    <Text style={[s.tdMono, { width: '16%' }]}>{cm.number}</Text>
                    <Text style={[s.td, { width: '18%' }]}>{fmtDate(cm.creditMemoDate)}</Text>
                    <Text style={[s.tdMuted, { width: '18%', fontFamily: PDF_FONTS.MONO }]}>
                      {cm.invoiceNumber || '—'}
                    </Text>
                    <Text style={[s.td, { width: '14%' }]}>{cm.status}</Text>
                    <Text style={[s.tdMono, { width: '17%', textAlign: 'right' as const }]}>
                      {fmt(cm.totalAmountExcludingTax, cm.currencyCode || lcyCcy)}
                    </Text>
                    <Text style={[s.tdBold, { width: '17%', textAlign: 'right' as const }]}>
                      {fmt(cm.totalAmountIncludingTax, cm.currencyCode || lcyCcy)}
                    </Text>
                  </View>
                ))}
                {pageIdx === cmPages.length - 1 && (
                  <View style={s.trTotal} wrap={false}>
                    <Text style={[s.tdBold, { width: '66%' }]}>
                      TOTAL ({creditMemos.length} credit memo{creditMemos.length !== 1 ? 's' : ''})
                    </Text>
                    <Text style={[s.tdBold, { width: '17%', textAlign: 'right' as const }]}>
                      {fmt(
                        creditMemos.reduce((sum, cm) => sum + (cm.totalAmountExcludingTax || 0), 0),
                        vendorCcy
                      )}
                    </Text>
                    <Text style={[s.tdBold, { width: '17%', textAlign: 'right' as const }]}>
                      {fmt(totalCM, vendorCcy)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Receipts on last credit memo page (or its own page if no CMs) */}
              {pageIdx === cmPages.length - 1 && receipts.length > 0 && receipts.length <= 20 && (
                <View style={{ marginTop: 20 }}>
                  <Text style={s.sectionTitle}>Purchase Receipts ({receipts.length})</Text>
                  <View style={s.table}>
                    <View style={s.th}>
                      <Text style={[s.thCell, { width: '30%' }]}>Receipt #</Text>
                      <Text style={[s.thCell, { width: '35%' }]}>Posting Date</Text>
                      <Text style={[s.thCell, { width: '35%' }]}>PO #</Text>
                    </View>
                    {receipts.map((r, idx) => (
                      <View
                        key={r.id || idx}
                        style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]}
                        wrap={false}
                      >
                        <Text style={[s.tdMono, { width: '30%' }]}>{r.number}</Text>
                        <Text style={[s.td, { width: '35%' }]}>{fmtDate(r.postingDate)}</Text>
                        <Text style={[s.tdMuted, { width: '35%', fontFamily: PDF_FONTS.MONO }]}>
                          {r.orderNumber || '—'}
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

      {/* Standalone receipts page if no credit memos or too many receipts */}
      {receipts.length > 0 && (creditMemos.length === 0 || receipts.length > 20) && (
        <Page size="A4" style={s.page}>
          {(() => {
            pageNumber++
            return null
          })()}
          <Text style={s.sectionTitle}>Purchase Receipts ({receipts.length})</Text>
          <View style={s.table}>
            <View style={s.th}>
              <Text style={[s.thCell, { width: '30%' }]}>Receipt #</Text>
              <Text style={[s.thCell, { width: '35%' }]}>Posting Date</Text>
              <Text style={[s.thCell, { width: '35%' }]}>PO #</Text>
            </View>
            {receipts.map((r, idx) => (
              <View key={r.id || idx} style={[s.tr, idx % 2 === 1 ? s.trAlt : {}]} wrap={false}>
                <Text style={[s.tdMono, { width: '30%' }]}>{r.number}</Text>
                <Text style={[s.td, { width: '35%' }]}>{fmtDate(r.postingDate)}</Text>
                <Text style={[s.tdMuted, { width: '35%', fontFamily: PDF_FONTS.MONO }]}>
                  {r.orderNumber || '—'}
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
