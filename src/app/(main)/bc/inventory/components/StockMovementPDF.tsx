'use client'

import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS } from '@/lib/pdf/fontConfig'

registerPdfFonts()

interface SmRow {
  item_no: string
  item_name: string
  location_code: string
  lot_no: string
  uom: number
  opn_ctn: number
  opn_mt: number
  val_opn: number
  pur_ctn: number
  pur_mt: number
  sal_ctn: number
  sal_mt: number
  pa_ctn: number
  pa_mt: number
  na_ctn: number
  na_mt: number
  cl_ctn: number
  cl_mt: number
  val_cls: number
}

interface Props {
  rows: SmRow[]
  currency: string
  dateRange?: { start: string; end: string }
}

const C = {
  bg: '#ffffff',
  headerBg: '#f8f7f6',
  itemBg: '#ffffff',
  locBg: '#f5f5f4',
  lotBg: '#ffffff',
  border: '#e7e5e4',
  borderLight: '#f0eeec',
  text: '#1c1917',
  muted: '#78716c',
  accent: '#0891b2',
  green: '#059669',
  red: '#dc2626',
}

const s = StyleSheet.create({
  page: {
    padding: 28,
    paddingBottom: 40,
    fontFamily: PDF_FONTS.PRIMARY,
    fontSize: 7,
    color: C.text,
    backgroundColor: C.bg,
  },
  // ── Title ──
  titleBlock: { marginBottom: 16 },
  title: { fontSize: 16, fontFamily: PDF_FONTS.HEADING, fontWeight: 700, color: C.text },
  subtitle: { fontSize: 8, color: C.muted, marginTop: 3 },
  // ── Table header ──
  headerRow: {
    flexDirection: 'row',
    backgroundColor: C.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  subHeaderRow: {
    flexDirection: 'row',
    backgroundColor: C.headerBg,
    borderBottomWidth: 1.5,
    borderBottomColor: C.border,
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  headerText: {
    fontSize: 5.5,
    fontFamily: PDF_FONTS.HEADING,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: C.muted,
  },
  groupLabel: {
    fontSize: 5.5,
    fontFamily: PDF_FONTS.HEADING,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: C.accent,
    textAlign: 'center',
  },
  // ── Item row (bold, full border) ──
  itemRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 4,
    paddingHorizontal: 2,
    backgroundColor: C.itemBg,
  },
  // ── Location row (indented, lighter) ──
  locRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.borderLight,
    paddingVertical: 3,
    paddingHorizontal: 2,
    backgroundColor: C.locBg,
  },
  // ── Lot row (most indented, lightest) ──
  lotRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.borderLight,
    paddingVertical: 2.5,
    paddingHorizontal: 2,
    backgroundColor: C.lotBg,
  },
  // ── Column widths ──
  colItem: { width: '13%', paddingHorizontal: 2 },
  colLoc: { width: '6%', paddingHorizontal: 2 },
  colLot: { width: '15%', paddingHorizontal: 2 },
  colUom: { width: '3%', paddingHorizontal: 1, textAlign: 'right' as const },
  colNum: { width: '4.5%', paddingHorizontal: 1, textAlign: 'right' as const },
  // ── Text styles ──
  itemText: { fontSize: 7, fontFamily: PDF_FONTS.HEADING, fontWeight: 700 },
  itemName: { fontSize: 6.5, color: C.muted },
  locText: { fontSize: 6.5, fontFamily: PDF_FONTS.HEADING, fontWeight: 600, paddingLeft: 8 },
  lotText: { fontSize: 6, color: C.muted, paddingLeft: 16 },
  cellText: { fontSize: 6.5 },
  cellBold: { fontSize: 6.5, fontFamily: PDF_FONTS.HEADING, fontWeight: 700 },
  cellMuted: { fontSize: 6.5, color: C.muted },
  cellGreen: { fontSize: 6.5, color: C.green },
  cellRed: { fontSize: 6.5, color: C.red },
  // ── Totals ──
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: C.text,
    paddingVertical: 5,
    paddingHorizontal: 2,
    backgroundColor: C.headerBg,
  },
  // ── Page number ──
  pageNum: { position: 'absolute' as const, bottom: 14, right: 28, fontSize: 6, color: C.muted },
})

function fmt(v: number, d = 0): string {
  if (v === 0) return '-'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function fmtCur(v: number, c: string): string {
  if (v === 0) return '-'
  try {
    return v.toLocaleString('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 })
  } catch {
    return `${c} ${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }
}

function sumRows(rs: SmRow[]): SmRow {
  const t: SmRow = {
    item_no: '',
    item_name: '',
    location_code: '',
    lot_no: '',
    uom: rs[0]?.uom ?? 0,
    opn_ctn: 0,
    opn_mt: 0,
    val_opn: 0,
    pur_ctn: 0,
    pur_mt: 0,
    sal_ctn: 0,
    sal_mt: 0,
    pa_ctn: 0,
    pa_mt: 0,
    na_ctn: 0,
    na_mt: 0,
    cl_ctn: 0,
    cl_mt: 0,
    val_cls: 0,
  }
  for (const r of rs) {
    t.opn_ctn += r.opn_ctn
    t.opn_mt += r.opn_mt
    t.val_opn += r.val_opn
    t.pur_ctn += r.pur_ctn
    t.pur_mt += r.pur_mt
    t.sal_ctn += r.sal_ctn
    t.sal_mt += r.sal_mt
    t.pa_ctn += r.pa_ctn
    t.pa_mt += r.pa_mt
    t.na_ctn += r.na_ctn
    t.na_mt += r.na_mt
    t.cl_ctn += r.cl_ctn
    t.cl_mt += r.cl_mt
    t.val_cls += r.val_cls
  }
  return t
}

function NumCells({ r, bold = false, cur }: { r: SmRow; bold?: boolean; cur: string }) {
  const cs = bold ? s.cellBold : s.cellText
  return (
    <>
      <Text style={[s.colNum, cs]}>{fmt(r.opn_ctn)}</Text>
      <Text style={[s.colNum, s.cellMuted]}>{fmt(r.opn_mt, 3)}</Text>
      <Text style={[s.colNum, cs]}>{fmtCur(r.val_opn, cur)}</Text>
      <Text style={[s.colNum, s.cellGreen]}>{fmt(r.pur_ctn)}</Text>
      <Text style={[s.colNum, s.cellMuted]}>{fmt(r.pur_mt, 3)}</Text>
      <Text style={[s.colNum, s.cellRed]}>{fmt(r.sal_ctn)}</Text>
      <Text style={[s.colNum, s.cellMuted]}>{fmt(r.sal_mt, 3)}</Text>
      <Text style={[s.colNum, cs]}>{fmt(r.pa_ctn)}</Text>
      <Text style={[s.colNum, s.cellMuted]}>{fmt(r.pa_mt, 3)}</Text>
      <Text style={[s.colNum, cs]}>{fmt(r.na_ctn)}</Text>
      <Text style={[s.colNum, s.cellMuted]}>{fmt(r.na_mt, 3)}</Text>
      <Text style={[s.colNum, cs]}>{fmt(r.cl_ctn)}</Text>
      <Text style={[s.colNum, s.cellMuted]}>{fmt(r.cl_mt, 3)}</Text>
      <Text style={[s.colNum, cs]}>{fmtCur(r.val_cls, cur)}</Text>
    </>
  )
}

export function StockMovementPDFDocument({ rows, currency, dateRange }: Props) {
  const hasLotData = rows.some((r) => r.lot_no)

  // Group: Item → Location → Lots
  const itemMap = new Map<string, SmRow[]>()
  for (const r of rows)
    (itemMap.get(r.item_no) || (itemMap.set(r.item_no, []), itemMap.get(r.item_no)!)).push(r)

  const items = Array.from(itemMap.entries())
    .map(([itemNo, itemRows]) => {
      const locMap = new Map<string, SmRow[]>()
      for (const r of itemRows)
        (
          locMap.get(r.location_code) ||
          (locMap.set(r.location_code, []), locMap.get(r.location_code)!)
        ).push(r)
      const locations = Array.from(locMap.entries()).map(([loc, lots]) => ({
        loc,
        total: sumRows(lots),
        lots,
      }))
      return {
        itemNo,
        itemName: itemRows[0].item_name,
        uom: itemRows[0].uom,
        total: sumRows(itemRows),
        locations,
      }
    })
    .sort((a, b) => b.total.val_cls - a.total.val_cls)

  const grand = sumRows(rows)

  const periodStr = dateRange
    ? `${new Date(dateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to ${new Date(dateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : ''

  return (
    <Document>
      <Page size="A3" orientation="landscape" style={s.page}>
        {/* Title — fixed on every page */}
        <View style={s.titleBlock} fixed>
          <Text style={s.title}>Stock Movement Report</Text>
          <Text style={s.subtitle}>
            {periodStr}
            {periodStr ? ' · ' : ''}
            {items.length} items · {rows.length} entries
          </Text>
        </View>

        {/* Table Header — fixed on every page */}
        <View fixed>
          {/* Group headers */}
          <View style={s.headerRow}>
            <Text style={[s.colItem, s.headerText]}>Item No &amp; Name</Text>
            <Text style={[s.colLoc, s.headerText]}>Location</Text>
            {hasLotData && <Text style={[s.colLot, s.headerText]}>Lot No</Text>}
            <Text style={[s.colUom, s.headerText]}>UOM</Text>
            <Text style={[{ width: '13.5%' }, s.groupLabel]}>Opening</Text>
            <Text style={[{ width: '9%' }, s.groupLabel]}>Purchases</Text>
            <Text style={[{ width: '9%' }, s.groupLabel]}>Sales</Text>
            <Text style={[{ width: '9%' }, s.groupLabel]}>+ve Adj</Text>
            <Text style={[{ width: '9%' }, s.groupLabel]}>-ve Adj</Text>
            <Text style={[{ width: '13.5%' }, s.groupLabel]}>Closing</Text>
          </View>
          {/* Sub headers */}
          <View style={s.subHeaderRow}>
            <Text style={[s.colItem, s.headerText]} />
            <Text style={[s.colLoc, s.headerText]} />
            {hasLotData && <Text style={[s.colLot, s.headerText]} />}
            <Text style={[s.colUom, s.headerText]} />
            <Text style={[s.colNum, s.headerText]}>CTN</Text>
            <Text style={[s.colNum, s.headerText]}>MT</Text>
            <Text style={[s.colNum, s.headerText]}>Value</Text>
            <Text style={[s.colNum, s.headerText]}>CTN</Text>
            <Text style={[s.colNum, s.headerText]}>MT</Text>
            <Text style={[s.colNum, s.headerText]}>CTN</Text>
            <Text style={[s.colNum, s.headerText]}>MT</Text>
            <Text style={[s.colNum, s.headerText]}>CTN</Text>
            <Text style={[s.colNum, s.headerText]}>MT</Text>
            <Text style={[s.colNum, s.headerText]}>CTN</Text>
            <Text style={[s.colNum, s.headerText]}>MT</Text>
            <Text style={[s.colNum, s.headerText]}>CTN</Text>
            <Text style={[s.colNum, s.headerText]}>MT</Text>
            <Text style={[s.colNum, s.headerText]}>Value</Text>
          </View>
        </View>

        {/* Data — grouped by Item → Location → Lot */}
        {items.map((item) => (
          <React.Fragment key={item.itemNo}>
            {/* ── Item total row ── */}
            <View style={s.itemRow} wrap={false}>
              <View style={[s.colItem]}>
                <Text style={s.itemText}>{item.itemNo}</Text>
                <Text style={s.itemName}>{item.itemName}</Text>
              </View>
              <Text style={[s.colLoc, s.cellMuted]}>
                {item.locations.length > 1
                  ? `${item.locations.length} loc`
                  : item.locations[0]?.loc}
              </Text>
              {hasLotData && (
                <Text style={[s.colLot, s.cellMuted]}>
                  {item.locations.length === 1 && item.locations[0].lots.length === 1
                    ? item.locations[0].lots[0].lot_no
                    : ''}
                </Text>
              )}
              <Text style={[s.colUom, s.cellText]}>{item.uom || '-'}</Text>
              <NumCells r={item.total} bold cur={currency} />
            </View>

            {/* ── Location rows ── */}
            {item.locations.map((loc) => (
              <React.Fragment key={`${item.itemNo}-${loc.loc}`}>
                {item.locations.length > 1 && (
                  <View style={s.locRow} wrap={false}>
                    <Text style={[s.colItem]} />
                    <Text style={[s.colLoc, s.locText]}>{loc.loc}</Text>
                    {hasLotData && (
                      <Text style={[s.colLot, s.cellMuted]}>
                        {loc.lots.length === 1 ? loc.lots[0].lot_no : ''}
                      </Text>
                    )}
                    <Text style={[s.colUom, s.cellText]}>{item.uom || '-'}</Text>
                    <NumCells r={loc.total} bold cur={currency} />
                  </View>
                )}

                {/* ── Lot rows (only if multiple lots at this location) ── */}
                {loc.lots.length > 1 &&
                  loc.lots.map((lot, li) => (
                    <View key={`${item.itemNo}-${loc.loc}-${li}`} style={s.lotRow} wrap={false}>
                      <Text style={[s.colItem]} />
                      <Text style={[s.colLoc]} />
                      {hasLotData && (
                        <Text style={[s.colLot, s.lotText]}>{lot.lot_no || '(no lot)'}</Text>
                      )}
                      <Text style={[s.colUom, s.cellMuted]}>{item.uom || '-'}</Text>
                      <NumCells r={lot} cur={currency} />
                    </View>
                  ))}
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}

        {/* Grand Total */}
        <View style={s.totalRow} wrap={false}>
          <View style={[s.colItem]}>
            <Text style={s.itemText}>GRAND TOTAL</Text>
            <Text style={s.itemName}>{items.length} items</Text>
          </View>
          <Text style={[s.colLoc]} />
          {hasLotData && <Text style={[s.colLot]} />}
          <Text style={[s.colUom]} />
          <NumCells r={grand} bold cur={currency} />
        </View>

        {/* Page number */}
        <Text
          fixed
          style={s.pageNum}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  )
}
