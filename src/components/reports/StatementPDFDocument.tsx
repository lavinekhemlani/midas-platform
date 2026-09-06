// src/components/reports/StatementPDFDocument.tsx
'use client'

/**
 * PDF Document Component for Financial Statement Export
 *
 * Uses @react-pdf/renderer to generate clean, professional PDF exports
 * of financial statement line items. No watermarks or branding.
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import type { PDFExportData } from '@/lib/utils/statementExport'
import { registerPdfFonts, PDF_FONTS } from '@/lib/pdf/fontConfig'

// Register fonts for PDF rendering (includes Noto Sans for currency symbols)
registerPdfFonts()

// =============================================================================
// PDF Styles
// =============================================================================

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: PDF_FONTS.PRIMARY,
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
    fontFamily: PDF_FONTS.PRIMARY,
  },
  subtitle: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 4,
    fontFamily: PDF_FONTS.PRIMARY,
  },
  basis: {
    fontSize: 9,
    color: '#888888',
    fontFamily: PDF_FONTS.PRIMARY,
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: PDF_FONTS.PRIMARY,
    textTransform: 'uppercase',
    color: '#666666',
  },
  accountHeader: {
    flex: 3,
  },
  amountHeader: {
    flex: 1,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 3,
    minHeight: 16,
  },
  rowHeader: {
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    backgroundColor: '#f5f5f5',
    paddingVertical: 5,
  },
  rowSubtotal: {
    borderTopWidth: 0.5,
    borderTopColor: '#999999',
    paddingTop: 4,
  },
  rowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#666666',
    paddingTop: 5,
  },
  rowFinalTotal: {
    borderTopWidth: 1.5,
    borderTopColor: '#333333',
    paddingTop: 6,
    marginTop: 4,
  },
  accountCell: {
    flex: 3,
  },
  amountCell: {
    flex: 1,
    textAlign: 'right',
  },
  textNormal: {
    fontSize: 9,
    color: '#333333',
    fontFamily: PDF_FONTS.PRIMARY,
  },
  textHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#000000',
  },
  textSubtotal: {
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#333333',
  },
  textTotal: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#000000',
  },
  textFinalTotal: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#000000',
  },
  textNegative: {
    color: '#cc0000',
  },
  textPositive: {
    color: '#006600',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 8,
    color: '#888888',
    borderTopWidth: 0.5,
    borderTopColor: '#cccccc',
    paddingTop: 10,
    fontFamily: PDF_FONTS.PRIMARY,
  },
  pageNumber: {
    fontSize: 8,
    color: '#888888',
    fontFamily: PDF_FONTS.PRIMARY,
  },
})

// =============================================================================
// PDF Document Component
// =============================================================================

interface StatementPDFDocumentProps {
  data: PDFExportData
}

export function StatementPDFDocument({ data }: StatementPDFDocumentProps) {
  // Calculate indentation in points (8pt per level)
  const getIndentStyle = (indent: number) => ({
    paddingLeft: indent * 12,
  })

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{data.title}</Text>
          {data.subtitle && <Text style={styles.subtitle}>{data.subtitle}</Text>}
          <Text style={styles.basis}>{data.basis}</Text>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.accountHeader]}>Account</Text>
            <Text style={[styles.tableHeaderCell, styles.amountHeader]}>Total</Text>
          </View>

          {/* Table Rows */}
          {data.items.map((item, index) => {
            // Determine row style
            let rowStyle = [styles.row]
            if (item.isHeader) {
              rowStyle = [styles.row, styles.rowHeader]
            } else if (item.isFinalTotal) {
              rowStyle = [styles.row, styles.rowFinalTotal]
            } else if (item.isTotal) {
              rowStyle = [styles.row, styles.rowTotal]
            } else if (item.isSubtotal) {
              rowStyle = [styles.row, styles.rowSubtotal]
            }

            // Determine text style
            let textStyle = styles.textNormal
            if (item.isHeader) {
              textStyle = styles.textHeader
            } else if (item.isFinalTotal) {
              textStyle = styles.textFinalTotal
            } else if (item.isTotal) {
              textStyle = styles.textTotal
            } else if (item.isSubtotal) {
              textStyle = styles.textSubtotal
            }

            // Check if amount is negative (by looking for minus sign in formatted string)
            const isNegative = item.amount.includes('-')

            return (
              <View key={index} style={rowStyle}>
                <View style={[styles.accountCell, getIndentStyle(item.indent)]}>
                  <Text style={textStyle}>{item.name}</Text>
                </View>
                <View style={styles.amountCell}>
                  <Text style={[textStyle, isNegative && !item.isHeader && styles.textNegative]}>
                    {/* Don't show amount for headers unless it's a collapsed one with a value */}
                    {!item.isHeader && item.amount}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>{data.basis}</Text>
          <Text>{data.timestamp}</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}

// =============================================================================
// PDF Export Function
// =============================================================================

/**
 * Generate and download PDF
 */
export async function downloadStatementPDF(data: PDFExportData, filename: string): Promise<void> {
  const blob = await pdf(<StatementPDFDocument data={data} />).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
