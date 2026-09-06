'use client'

import React, { useState, useCallback } from 'react'
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

// =============================================================================
// Types
// =============================================================================

type EntityType = 'vendor' | 'customer' | 'item'
type ExportFormat = 'csv' | 'pdf'

interface DateRange {
  startDate: string
  endDate: string
}

interface EntityExportDropdownProps {
  entityType: EntityType
  schema: string
  currency: string
  totalCount: number
  companyName?: string
  dateRange?: DateRange
}

interface ColumnDef {
  key: string
  label: string
  format?: 'currency' | 'number'
  width?: number // percentage width for PDF
}

// =============================================================================
// Column definitions per entity
// =============================================================================

const VENDOR_COLUMNS: ColumnDef[] = [
  { key: 'no', label: 'No.' },
  { key: 'name', label: 'Name' },
  { key: 'purchases_lcy', label: 'Purchases', format: 'currency' },
  { key: 'balance_lcy', label: 'Balance', format: 'currency' },
  { key: 'balance_due_lcy', label: 'Overdue', format: 'currency' },
  { key: 'payment_terms_code', label: 'Payment Terms' },
  { key: 'blocked', label: 'Blocked' },
]

const CUSTOMER_COLUMNS: ColumnDef[] = [
  { key: 'no', label: 'No.' },
  { key: 'name', label: 'Name' },
  { key: 'sales_lcy', label: 'Sales', format: 'currency' },
  { key: 'balance_lcy', label: 'Balance', format: 'currency' },
  { key: 'balance_due_lcy', label: 'Overdue', format: 'currency' },
  { key: 'credit_limit_lcy', label: 'Credit Limit', format: 'currency' },
  { key: 'payment_terms_code', label: 'Payment Terms' },
  { key: 'blocked', label: 'Blocked' },
]

// Original item columns (no date range)
// const ITEM_COLUMNS_ORIGINAL: ColumnDef[] = [
//   { key: 'no', label: 'No.' },
//   { key: 'description', label: 'Description' },
//   { key: 'item_category_code', label: 'Category' },
//   { key: 'base_unit_of_measure', label: 'Unit' },
//   { key: 'unit_cost', label: 'Unit Cost', format: 'currency' },
// ]

const ITEM_COLUMNS: ColumnDef[] = [
  { key: 'item_code', label: 'No.', width: 4 },
  { key: 'item_description', label: 'DESCRIPTION', width: 8 },
  { key: 'kg_ctn', label: 'KG/CTN', format: 'number', width: 4 },
  { key: 'lot_no', label: 'LOT NO.', width: 12 },
  { key: 'division', label: 'DIVISION', width: 5 },
  { key: 'location_code', label: 'LOCATION CODE', width: 6 },
  { key: 'bin_code', label: 'BIN CODE', width: 6 },
]

// Original movement columns
// const ITEM_MOVEMENT_COLUMNS_ORIGINAL: ColumnDef[] = [
//   { key: 'opening_stock_qty', label: 'Opening Stock (Unit)', format: 'number' },
//   { key: 'opening_stock_value', label: 'Opening Stock (Value)', format: 'currency' },
//   { key: 'period_purchases_qty', label: 'Purchases (Unit)', format: 'number' },
//   { key: 'period_sales_qty', label: 'Sales (Unit)', format: 'number' },
//   { key: 'period_adjustments_qty', label: 'Adjustments (Unit)', format: 'number' },
//   { key: 'closing_stock_qty', label: 'Closing Stock (Unit)', format: 'number' },
//   { key: 'closing_stock_value', label: 'Closing Stock (Value)', format: 'currency' },
// ]

const ITEM_MOVEMENT_COLUMNS: ColumnDef[] = [
  // OPENING STOCK (3.5 + 3.5 + 4.75 = 11.75%)
  { key: 'opening_stock_ctns', label: 'CTNS', format: 'number', width: 4 },
  { key: 'opening_stock_mt', label: 'MT', format: 'number', width: 4 },
  { key: 'opening_stock_value', label: 'VALUE', format: 'currency', width: 5 },
  // PURCHASES
  { key: 'purchases_ctns', label: 'CTNS', format: 'number', width: 4 },
  { key: 'purchases_mt', label: 'MT', format: 'number', width: 4 },
  { key: 'purchases_value', label: 'VALUE', format: 'currency', width: 5 },
  // SALES
  { key: 'sales_ctns', label: 'CTNS', format: 'number', width: 4 },
  { key: 'sales_mt', label: 'MT', format: 'number', width: 4 },
  { key: 'sales_value', label: 'VALUE', format: 'currency', width: 5 },
  // CLOSING STOCK
  { key: 'closing_stock_ctns', label: 'CTNS', format: 'number', width: 4 },
  { key: 'closing_stock_mt', label: 'MT', format: 'number', width: 4 },
  { key: 'closing_stock_value', label: 'VALUE', format: 'currency', width: 5 },
]

// Header groups for the two-row header (like the Excel)
// Each group spans N columns. Empty label = no group row (spans both rows)
interface HeaderGroup {
  label: string
  colSpan: number
}

const ITEM_HEADER_GROUPS: HeaderGroup[] = [
  { label: '', colSpan: 7 },           // ITEM CODE through BIN CODE (no group header)
  { label: 'OPENING STOCK', colSpan: 3 },
  { label: 'PURCHASES', colSpan: 3 },
  { label: 'SALES', colSpan: 3 },
  { label: 'CLOSING STOCK', colSpan: 3 },
]

// =============================================================================
// SQL query builders
// =============================================================================

function buildVendorQuery(schema: string): string {
  return `
    SELECT
      no,
      name,
      COALESCE(purchases_lcy, 0) as purchases_lcy,
      COALESCE(balance_lcy, 0) as balance_lcy,
      COALESCE(balance_due_lcy, 0) as balance_due_lcy,
      COALESCE(payment_terms_code, '') as payment_terms_code,
      CASE
        WHEN blocked IS NULL OR blocked = '' OR blocked = '_x0020_' THEN ''
        ELSE blocked
      END as blocked
    FROM ${schema}.vendor
    WHERE COALESCE(_fivetran_deleted, false) = false
    ORDER BY name
  `
}

function buildCustomerQuery(schema: string): string {
  return `
    SELECT
      no,
      name,
      COALESCE(sales_lcy, 0) as sales_lcy,
      COALESCE(balance_lcy, 0) as balance_lcy,
      COALESCE(balance_due_lcy, 0) as balance_due_lcy,
      COALESCE(credit_limit_lcy, 0) as credit_limit_lcy,
      COALESCE(payment_terms_code, '') as payment_terms_code,
      CASE
        WHEN blocked IS NULL OR blocked = '' OR blocked = '_x0020_' THEN ''
        ELSE blocked
      END as blocked
    FROM ${schema}.customer
    WHERE COALESCE(_fivetran_deleted, false) = false
    ORDER BY name
  `
}

// Original buildItemQuery
// function buildItemQuery_original(schema: string, dateRange?: DateRange): string {
//   if (dateRange?.startDate && dateRange?.endDate) {
//     return `
//       WITH item_movements AS (
//         SELECT item_no, company_id,
//           COALESCE(SUM(CASE WHEN posting_date < '...' THEN quantity ELSE 0 END), 0) as opening_stock_qty,
//           ...
//         FROM ${schema}.item_ledger_entry
//         WHERE COALESCE(_fivetran_deleted, false) = false
//         GROUP BY item_no, company_id
//       )
//       SELECT i.no, i.description, ... m.opening_stock_qty, ...
//       FROM ${schema}.item i
//       INNER JOIN item_movements m ON m.item_no = i.no AND m.company_id = i.company_id
//       WHERE COALESCE(i._fivetran_deleted, false) = false
//       ORDER BY i.description
//     `
//   }
//   return `
//     SELECT no, description, item_category_code, type, base_unit_of_measure, inventory, unit_cost, unit_price,
//       inventory * unit_cost as inventory_value
//     FROM ${schema}.item
//     WHERE COALESCE(_fivetran_deleted, false) = false
//     ORDER BY description
//   `
// }

function buildItemQuery(schema: string, dateRange?: DateRange): string {
  if (dateRange?.startDate && dateRange?.endDate) {
    return `
      WITH movements AS (
        SELECT
          ile.item_no,
          ile.company_id,
          COALESCE(ile.lot_no, '') as lot_no,
          COALESCE(ile.location_code, '') as location_code,
          -- Pick primary values per item+lot+location
          MAX(ile.description) as description,
          MAX(ile.unit_of_measure_code) as unit_of_measure_code,
          CAST(REGEXP_SUBSTR(MAX(ile.unit_of_measure_code), '[0-9]+') AS DECIMAL(10,2)) as kg_ctn,
          MAX(ile.global_dimension_2_code) as division,

          -- OPENING STOCK (before period start)
          COALESCE(SUM(CASE WHEN ile.posting_date < '${dateRange.startDate}' THEN ile.quantity ELSE 0 END), 0) as opening_stock_ctns,
          COALESCE(SUM(CASE WHEN ile.posting_date < '${dateRange.startDate}' THEN ile.cost_amount_actual ELSE 0 END), 0) as opening_stock_value,

          -- PURCHASES (within period)
          COALESCE(SUM(CASE WHEN ile.posting_date >= '${dateRange.startDate}' AND ile.posting_date <= '${dateRange.endDate}' AND ile.entry_type = 'Purchase' THEN ABS(ile.quantity) ELSE 0 END), 0) as purchases_ctns,
          COALESCE(SUM(CASE WHEN ile.posting_date >= '${dateRange.startDate}' AND ile.posting_date <= '${dateRange.endDate}' AND ile.entry_type = 'Purchase' THEN ABS(ile.cost_amount_actual) ELSE 0 END), 0) as purchases_value,

          -- SALES (within period)
          COALESCE(SUM(CASE WHEN ile.posting_date >= '${dateRange.startDate}' AND ile.posting_date <= '${dateRange.endDate}' AND ile.entry_type = 'Sale' THEN ABS(ile.quantity) ELSE 0 END), 0) as sales_ctns,
          COALESCE(SUM(CASE WHEN ile.posting_date >= '${dateRange.startDate}' AND ile.posting_date <= '${dateRange.endDate}' AND ile.entry_type = 'Sale' THEN ABS(ile.sales_amount_actual) ELSE 0 END), 0) as sales_value,

          -- CLOSING STOCK (up to period end)
          COALESCE(SUM(CASE WHEN ile.posting_date <= '${dateRange.endDate}' THEN ile.quantity ELSE 0 END), 0) as closing_stock_ctns,
          COALESCE(SUM(CASE WHEN ile.posting_date <= '${dateRange.endDate}' THEN ile.cost_amount_actual ELSE 0 END), 0) as closing_stock_value

        FROM ${schema}.item_ledger_entry ile
        WHERE COALESCE(ile._fivetran_deleted, false) = false
          AND ile.item_no IS NOT NULL AND ile.item_no != ''
        GROUP BY ile.item_no, ile.company_id, COALESCE(ile.lot_no, ''), COALESCE(ile.location_code, '')
      ),
      bin_codes AS (
        SELECT DISTINCT
          no as item_no,
          location_code,
          bin_code
        FROM ${schema}.sales_invoice_line
        WHERE COALESCE(_fivetran_deleted, false) = false
          AND no IS NOT NULL AND no != ''
          AND bin_code IS NOT NULL AND bin_code != ''
      )
      SELECT
        m.item_no as item_code,
        COALESCE(i.description, m.description, '') as item_description,
        COALESCE(m.kg_ctn, 0) as kg_ctn,
        m.lot_no,
        COALESCE(m.division, '') as division,
        m.location_code,
        COALESCE(bc.bin_code, '') as bin_code,

        -- OPENING STOCK
        m.opening_stock_ctns,
        ROUND(m.opening_stock_ctns * COALESCE(m.kg_ctn, 0) / 1000.0, 2) as opening_stock_mt,
        m.opening_stock_value,

        -- PURCHASES
        m.purchases_ctns,
        ROUND(m.purchases_ctns * COALESCE(m.kg_ctn, 0) / 1000.0, 2) as purchases_mt,
        m.purchases_value,

        -- SALES
        m.sales_ctns,
        ROUND(m.sales_ctns * COALESCE(m.kg_ctn, 0) / 1000.0, 2) as sales_mt,
        m.sales_value,

        -- CLOSING STOCK
        m.closing_stock_ctns,
        ROUND(m.closing_stock_ctns * COALESCE(m.kg_ctn, 0) / 1000.0, 2) as closing_stock_mt,
        m.closing_stock_value

      FROM movements m
      LEFT JOIN ${schema}.item i
        ON i.no = m.item_no AND i.company_id = m.company_id
        AND COALESCE(i._fivetran_deleted, false) = false
      LEFT JOIN bin_codes bc
        ON bc.item_no = m.item_no AND bc.location_code = m.location_code
      ORDER BY m.item_no, m.lot_no, m.location_code
      LIMIT 50000
    `
  }

  // No date range: show current stock per item+lot+location
  return `
    WITH bin_codes AS (
      SELECT DISTINCT
        no as item_no,
        location_code,
        bin_code
      FROM ${schema}.sales_invoice_line
      WHERE COALESCE(_fivetran_deleted, false) = false
        AND no IS NOT NULL AND no != ''
        AND bin_code IS NOT NULL AND bin_code != ''
    )
    SELECT
      ile.item_no as item_code,
      MAX(ile.description) as item_description,
      CAST(REGEXP_SUBSTR(MAX(ile.unit_of_measure_code), '[0-9]+') AS DECIMAL(10,2)) as kg_ctn,
      COALESCE(ile.lot_no, '') as lot_no,
      MAX(ile.global_dimension_2_code) as division,
      COALESCE(ile.location_code, '') as location_code,
      COALESCE(MAX(bc.bin_code), '') as bin_code
    FROM ${schema}.item_ledger_entry ile
    LEFT JOIN bin_codes bc
      ON bc.item_no = ile.item_no AND bc.location_code = ile.location_code
    WHERE COALESCE(ile._fivetran_deleted, false) = false
      AND ile.item_no IS NOT NULL AND ile.item_no != ''
    GROUP BY ile.item_no, COALESCE(ile.lot_no, ''), COALESCE(ile.location_code, '')
    ORDER BY ile.item_no, lot_no, location_code
    LIMIT 50000
  `
}

// =============================================================================
// Fetch all entity data
// =============================================================================

async function fetchAllEntityData(
  entityType: EntityType,
  schema: string,
  dateRange?: DateRange
): Promise<Record<string, any>[]> {
  const query =
    entityType === 'vendor'
      ? buildVendorQuery(schema)
      : entityType === 'customer'
        ? buildCustomerQuery(schema)
        : buildItemQuery(schema, dateRange)

  const response = await fetch('/api/redshift/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  // if (!response.ok) {
  //   throw new Error(`Failed to fetch ${entityType} data: ${response.statusText}`)
  // }
  const result = await response.json()
  if (!response.ok || !result.success) {
    throw new Error(
      result.error || `Failed to fetch ${entityType} data (status ${response.status})`
    )
  }

  return result.data || []
}

// =============================================================================
// CSV Export
// =============================================================================

function escapeCSV(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function exportToCSV(
  data: Record<string, any>[],
  columns: ColumnDef[],
  entityType: EntityType,
  currency: string,
  dateRange?: DateRange,
  headerGroups?: HeaderGroup[]
): void {
  const lines: string[] = []

  // Build header rows
  if (headerGroups) {
    // Row 1: Group headers (empty cells for ungrouped columns, group name spanning grouped columns)
    const groupRow: string[] = []
    let colIdx = 0
    for (const group of headerGroups) {
      for (let i = 0; i < group.colSpan; i++) {
        // Put group label in first cell of group, empty for the rest
        groupRow.push(i === 0 && group.label ? escapeCSV(group.label) : '')
        colIdx++
      }
    }
    lines.push(groupRow.join(','))

    // Row 2: Sub-column headers
    lines.push(columns.map((col) => escapeCSV(col.label)).join(','))
  } else {
    // Single header row
    lines.push(columns.map((col) => escapeCSV(col.label)).join(','))
  }

  // Data rows
  for (const row of data) {
    const values = columns.map((col) => {
      const val = row[col.key]
      if (val === null || val === undefined) return ''
      return escapeCSV(String(val))
    })
    lines.push(values.join(','))
  }

  const content = lines.join('\n')
  const dateSuffix =
    dateRange?.startDate && dateRange?.endDate
      ? `${dateRange.startDate}-to-${dateRange.endDate}`
      : new Date().toISOString().split('T')[0]
  const filename = `all-${entityType}s-${dateSuffix}.csv`
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// =============================================================================
// PDF Export
// =============================================================================

async function exportToPDF(
  data: Record<string, any>[],
  columns: ColumnDef[],
  entityType: EntityType,
  currency: string,
  companyName?: string,
  dateRange?: DateRange,
  headerGroups?: HeaderGroup[],
  totalRows?: number
): Promise<void> {
  const React = (await import('react')).default
  const { Document, Page, Text, View, StyleSheet, pdf } = await import('@react-pdf/renderer')
  const { PDFTableVisualization } = await import('@/lib/pdf/components/PDFTableVisualization')
  const { registerPdfFonts, PDF_FONTS, PDF_FONT_SIZES } = await import('@/lib/pdf/fontConfig')

  registerPdfFonts()

  const pdfColumns = columns.map((col) => ({
    key: col.key,
    label: col.label,
    align: (col.format === 'currency' || col.format === 'number' ? 'right' : 'left') as
      | 'left'
      | 'right',
    format: col.format,
    ...(col.width ? { width: `${col.width}%` } : {}),
  }))

  const entityLabel =
    entityType === 'vendor' ? 'Vendors' : entityType === 'customer' ? 'Customers' : 'Items'
  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const periodStr =
    dateRange?.startDate && dateRange?.endDate
      ? `${formatDate(dateRange.startDate)} – ${formatDate(dateRange.endDate)}`
      : null

  const pageStyles = StyleSheet.create({
    page: {
      paddingTop: 60,
      paddingBottom: 60,
      paddingHorizontal: 40,
      backgroundColor: '#ffffff',
      fontFamily: PDF_FONTS.PRIMARY,
    },
    header: {
      marginBottom: 20,
    },
    orgName: {
      fontSize: 10,
      color: '#64748b',
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    title: {
      fontSize: 18,
      fontWeight: 700,
      color: '#1e3a5f',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 9,
      color: '#94a3b8',
    },
    footer: {
      position: 'absolute',
      bottom: 30,
      left: 40,
      right: 40,
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTop: '1 solid #e2e8f0',
      paddingTop: 8,
    },
    footerText: {
      fontSize: 7,
      color: '#94a3b8',
      fontFamily: PDF_FONTS.PRIMARY,
    },
  })

  const doc = (
    <Document>
      <Page size="A4" orientation="landscape" style={pageStyles.page}>
        <View style={pageStyles.header} fixed>
          {companyName && <Text style={pageStyles.orgName}>{companyName}</Text>}
          <Text style={pageStyles.title}>All {entityLabel}</Text>
          <Text style={pageStyles.subtitle}>
            {data.length} records{totalRows ? ` of ${totalRows} (use CSV for full data)` : ''}{periodStr ? ` | ${periodStr}` : ''} | Generated {dateStr}
          </Text>
        </View>

        <PDFTableVisualization
          title={`${entityLabel} Data`}
          columns={pdfColumns}
          data={data}
          currency={currency}
          headerGroups={headerGroups}
        />

        <View style={pageStyles.footer} fixed>
          <Text style={pageStyles.footerText}>Generated by Midas | Confidential</Text>
          <Text
            style={pageStyles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )

  const blob = await pdf(doc).toBlob()
  const pdfDateSuffix =
    dateRange?.startDate && dateRange?.endDate
      ? `${dateRange.startDate}-to-${dateRange.endDate}`
      : new Date().toISOString().split('T')[0]
  const filename = `all-${entityType}s-${pdfDateSuffix}.pdf`
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// =============================================================================
// Component
// =============================================================================

export function EntityExportDropdown({
  entityType,
  schema,
  currency,
  totalCount,
  companyName,
  dateRange,
}: EntityExportDropdownProps) {
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null)
  const hasDateRange = entityType === 'item' && !!(dateRange?.startDate && dateRange?.endDate)
  const baseColumns =
    entityType === 'vendor'
      ? VENDOR_COLUMNS
      : entityType === 'customer'
        ? CUSTOMER_COLUMNS
        : ITEM_COLUMNS
  const columns = hasDateRange ? [...baseColumns, ...ITEM_MOVEMENT_COLUMNS] : baseColumns
  const entityLabel =
    entityType === 'vendor' ? 'Vendors' : entityType === 'customer' ? 'Customers' : 'Items'

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (isExporting) return
      setIsExporting(format)

      try {
        const data = await fetchAllEntityData(
          entityType,
          schema,
          hasDateRange ? dateRange : undefined
        )

        if (format === 'csv') {
          // CSV: all items with every lot_no and location_code
          exportToCSV(data, columns, entityType, currency, hasDateRange ? dateRange : undefined, entityType === 'item' ? ITEM_HEADER_GROUPS : undefined)
        } else {
          // PDF: limit to 20 items for readability
          const pdfData = entityType === 'item' ? data.slice(0, 20) : data
          // Defer PDF generation to next frame so the UI can show loading state
          await new Promise((resolve) => setTimeout(resolve, 100))
          await exportToPDF(
            pdfData,
            columns,
            entityType,
            currency,
            companyName,
            hasDateRange ? dateRange : undefined,
            entityType === 'item' ? ITEM_HEADER_GROUPS : undefined,
            entityType === 'item' ? data.length : undefined
          )
        }
      } catch (error) {
        console.error(`Failed to export ${entityType}s as ${format}:`, error)
      } finally {
        setIsExporting(null)
      }
    },
    [entityType, schema, currency, columns, companyName, dateRange, hasDateRange, isExporting]
  )

  return (
    <DropdownMenu
      align="end"
      triggerMode="hover"
      trigger={
        <button
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md',
            'text-[10px] font-medium uppercase tracking-wider transition-colors',
            'text-stone-500 hover:text-amber-500',
            'hover:bg-amber-500/10',
            'border border-transparent hover:border-amber-500/20'
          )}
        >
          <Download className="w-3.5 h-3.5" />
          <span>{`Download All ${entityLabel}`}</span>
        </button>
      }
      className="min-w-[160px]"
    >
      <DropdownMenuItem
        className="flex items-center gap-2 cursor-pointer"
        onSelect={() => handleExport('csv')}
      >
        {isExporting === 'csv' ? (
          <Loader2 className="w-4 h-4 animate-spin text-green-500" />
        ) : (
          <FileSpreadsheet className="w-4 h-4 text-green-500" />
        )}
        <span>{isExporting === 'csv' ? 'Exporting CSV...' : 'Export as CSV'}</span>
      </DropdownMenuItem>

      <DropdownMenuItem
        className="flex items-center gap-2 cursor-pointer"
        onSelect={() => handleExport('pdf')}
      >
        {isExporting === 'pdf' ? (
          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
        ) : (
          <FileText className="w-4 h-4 text-red-500" />
        )}
        <span>{isExporting === 'pdf' ? 'Generating PDF...' : 'Export as PDF'}</span>
      </DropdownMenuItem>
    </DropdownMenu>
  )
}
