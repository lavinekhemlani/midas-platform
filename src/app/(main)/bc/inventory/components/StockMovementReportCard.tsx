'use client'

import React, { useMemo, useState, useCallback } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  Download,
  FileText,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { useTheme } from '@/hooks/useTheme'
import { InfoTooltip } from './InfoTooltip'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { pdf } from '@react-pdf/renderer'
import type { LedgerEntry } from '../../hooks/useBCLedgerEntries'
import type { ItemWeight } from '../../hooks/useBCStockMovement'

// ── Types ──────────────────────────────────────────────────────────────────────

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
  entries: LedgerEntry[]
  priorEntries: LedgerEntry[]
  itemWeights: Map<string, ItemWeight>
  isLoading: boolean
  currency?: string
  onItemClick?: (itemNo: string) => void
  dateRange?: { start: string; end: string }
  /** Which item is currently selected for inline detail */
  selectedItemNumber?: string | null
  /** Render function for the inline item detail card */
  renderItemDetail?: () => React.ReactNode
}

type SortField = 'item_no' | 'cl_ctn' | 'val_cls' | 'sal_ctn' | 'pur_ctn'

// ── Build data ─────────────────────────────────────────────────────────────────

function buildRows(
  period: LedgerEntry[],
  prior: LedgerEntry[],
  weights: Map<string, ItemWeight>
): SmRow[] {
  const map = new Map<string, SmRow>()
  const w = (itemNo: string) => {
    const code = weights.get(itemNo)?.baseUnitOfMeasureCode || ''
    const match = code.match(/\d+/)
    return match ? parseInt(match[0], 10) : 0
  }
  const nm = (itemNo: string, d: string) => weights.get(itemNo)?.displayName || d || itemNo

  const get = (itemNo: string, loc: string, lot: string, desc: string): SmRow => {
    const k = `${itemNo}||${loc}||${lot}`
    let r = map.get(k)
    if (!r) {
      r = {
        item_no: itemNo,
        item_name: nm(itemNo, desc),
        location_code: loc || '(blank)',
        lot_no: lot,
        uom: w(itemNo),
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
      map.set(k, r)
    }
    return r
  }

  for (const e of prior) {
    const r = get(e.itemNumber, e.locationCode, e.lotNo, e.description)
    r.opn_ctn += e.quantity ?? 0
    r.val_opn += e.costAmountActual ?? 0
  }

  for (const e of period) {
    const r = get(e.itemNumber, e.locationCode, e.lotNo, e.description)
    const q = e.quantity ?? 0
    const t = (e.entryType || '').toLowerCase()
    if (t === 'purchase') r.pur_ctn += q
    else if (t === 'sale') r.sal_ctn += Math.abs(q)
    else if (t.includes('positive')) r.pa_ctn += q
    else if (t.includes('negative')) r.na_ctn += Math.abs(q)
  }

  for (const r of map.values()) {
    r.cl_ctn = r.opn_ctn + r.pur_ctn - r.sal_ctn + r.pa_ctn - r.na_ctn
    const kg = r.uom / 1000
    r.opn_mt = r.opn_ctn * kg
    r.pur_mt = r.pur_ctn * kg
    r.sal_mt = r.sal_ctn * kg
    r.pa_mt = r.pa_ctn * kg
    r.na_mt = r.na_ctn * kg
    r.cl_mt = r.cl_ctn * kg
    const pc = period
      .filter(
        (e) =>
          e.itemNumber === r.item_no &&
          (e.locationCode || '(blank)') === r.location_code &&
          (e.lotNo || '') === r.lot_no
      )
      .reduce((s, e) => s + (e.costAmountActual ?? 0), 0)
    r.val_cls = r.val_opn + pc
  }

  return Array.from(map.values())
}

function sumRows(rs: SmRow[]): SmRow {
  const s: SmRow = {
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
    s.opn_ctn += r.opn_ctn
    s.opn_mt += r.opn_mt
    s.val_opn += r.val_opn
    s.pur_ctn += r.pur_ctn
    s.pur_mt += r.pur_mt
    s.sal_ctn += r.sal_ctn
    s.sal_mt += r.sal_mt
    s.pa_ctn += r.pa_ctn
    s.pa_mt += r.pa_mt
    s.na_ctn += r.na_ctn
    s.na_mt += r.na_mt
    s.cl_ctn += r.cl_ctn
    s.cl_mt += r.cl_mt
    s.val_cls += r.val_cls
  }
  return s
}

// ── Flat row types for rendering ───────────────────────────────────────────────

type FlatRow =
  | {
      type: 'item'
      itemNo: string
      itemName: string
      uom: number
      locCount: number
      lotNo: string
      data: SmRow
    }
  | {
      type: 'loc'
      itemNo: string
      locCode: string
      uom: number
      lotCount: number
      lotNo: string
      data: SmRow
    }
  | { type: 'lot'; lotNo: string; uom: number; data: SmRow }

// ── Component ──────────────────────────────────────────────────────────────────

export function StockMovementReportCard({
  entries,
  priorEntries,
  itemWeights,
  isLoading,
  currency = 'USD',
  onItemClick,
  dateRange,
  selectedItemNumber,
  renderItemDetail,
}: Props) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [sortField, setSortField] = useState<SortField>('val_cls')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [expandedLocs, setExpandedLocs] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)
  const [isExporting, setIsExporting] = useState<'csv' | 'pdf' | null>(null)

  const allRows = useMemo(
    () => buildRows(entries, priorEntries, itemWeights),
    [entries, priorEntries, itemWeights]
  )

  // Hide Lot No column if no entries have lot data
  const hasLotData = useMemo(() => allRows.some((r) => r.lot_no), [allRows])

  // Group into items → locations → lots
  const itemGroups = useMemo(() => {
    const iMap = new Map<string, SmRow[]>()
    for (const r of allRows)
      (iMap.get(r.item_no) || (iMap.set(r.item_no, []), iMap.get(r.item_no)!)).push(r)

    return Array.from(iMap.entries()).map(([itemNo, rows]) => {
      const lMap = new Map<string, SmRow[]>()
      for (const r of rows)
        (
          lMap.get(r.location_code) || (lMap.set(r.location_code, []), lMap.get(r.location_code)!)
        ).push(r)
      const locations = Array.from(lMap.entries()).map(([loc, lots]) => ({
        loc,
        total: sumRows(lots),
        lots,
      }))
      return {
        itemNo,
        itemName: rows[0].item_name,
        uom: rows[0].uom,
        total: sumRows(rows),
        locations,
      }
    })
  }, [allRows])

  const sorted = useMemo(() => {
    return [...itemGroups].sort((a, b) => {
      const av = (a.total as any)[sortField] ?? ''
      const bv = (b.total as any)[sortField] ?? ''
      return typeof av === 'number' && typeof bv === 'number'
        ? sortDir === 'asc'
          ? av - bv
          : bv - av
        : sortDir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av))
    })
  }, [itemGroups, sortField, sortDir])

  const displayed = showAll ? sorted : sorted.slice(0, 50)

  // Build flat row list for rendering
  const flatRows: FlatRow[] = useMemo(() => {
    const out: FlatRow[] = []
    for (const g of displayed) {
      const itemLotNo =
        g.locations.length === 1 && g.locations[0].lots.length === 1
          ? g.locations[0].lots[0].lot_no
          : ''
      out.push({
        type: 'item',
        itemNo: g.itemNo,
        itemName: g.itemName,
        uom: g.uom,
        locCount: g.locations.length,
        lotNo: itemLotNo,
        data: g.total,
      })
      if (expandedItems.has(g.itemNo)) {
        for (const loc of g.locations) {
          const locLotNo = loc.lots.length === 1 ? loc.lots[0].lot_no : ''
          out.push({
            type: 'loc',
            itemNo: g.itemNo,
            locCode: loc.loc,
            uom: g.uom,
            lotCount: loc.lots.length,
            lotNo: locLotNo,
            data: loc.total,
          })
          const lk = `${g.itemNo}||${loc.loc}`
          if (expandedLocs.has(lk) && loc.lots.length > 1) {
            for (const lot of loc.lots)
              out.push({ type: 'lot', lotNo: lot.lot_no, uom: g.uom, data: lot })
          }
        }
      }
    }
    return out
  }, [displayed, expandedItems, expandedLocs])

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(f)
      setSortDir('desc')
    }
  }
  const toggleItem = (i: string) =>
    setExpandedItems((p) => {
      const n = new Set(p)
      n.has(i) ? n.delete(i) : n.add(i)
      return n
    })
  const toggleLoc = (k: string) =>
    setExpandedLocs((p) => {
      const n = new Set(p)
      n.has(k) ? n.delete(k) : n.add(k)
      return n
    })

  // ── Export handlers ──────────────────────────────────────────────────────────

  const handleExportCSV = useCallback(() => {
    if (isExporting) return
    setIsExporting('csv')
    try {
      const headers = [
        'Item No',
        'Item Name',
        'Location',
        'Lot No',
        'UOM (g)',
        'Opn CTN',
        'Opn MT',
        'Opn Value',
        'Pur CTN',
        'Pur MT',
        'Sal CTN',
        'Sal MT',
        '+Adj CTN',
        '+Adj MT',
        '-Adj CTN',
        '-Adj MT',
        'Cls CTN',
        'Cls MT',
        'Cls Value',
      ]
      const csvRows = allRows.map((r) =>
        [
          r.item_no,
          `"${r.item_name.replace(/"/g, '""')}"`,
          r.location_code,
          r.lot_no,
          r.uom,
          r.opn_ctn,
          r.opn_mt.toFixed(3),
          r.val_opn.toFixed(2),
          r.pur_ctn,
          r.pur_mt.toFixed(3),
          r.sal_ctn,
          r.sal_mt.toFixed(3),
          r.pa_ctn,
          r.pa_mt.toFixed(3),
          r.na_ctn,
          r.na_mt.toFixed(3),
          r.cl_ctn,
          r.cl_mt.toFixed(3),
          r.val_cls.toFixed(2),
        ].join(',')
      )
      const csv = [headers.join(','), ...csvRows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `stock-movement-report.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(null)
    }
  }, [allRows, isExporting])

  const handleExportPDF = useCallback(async () => {
    if (isExporting) return
    setIsExporting('pdf')
    try {
      const { StockMovementPDFDocument } = await import('./StockMovementPDF')
      const blob = await pdf(
        <StockMovementPDFDocument rows={allRows} currency={currency} dateRange={dateRange} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `stock-movement-report.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF generation failed:', err)
    } finally {
      setIsExporting(null)
    }
  }, [allRows, currency, isExporting])

  const st = {
    text: isLight ? 'text-stone-900' : 'text-white',
    muted: isLight ? 'text-stone-500' : 'text-stone-500',
    hBg: isLight ? 'bg-stone-50' : 'bg-white/[0.04]',
    rHov: isLight ? 'hover:bg-stone-50' : 'hover:bg-white/[0.03]',
    bdr: isLight ? 'border-stone-200' : 'border-white/[0.08]',
    eBg: isLight ? 'bg-stone-50/60' : 'bg-white/[0.015]',
    lBg: isLight ? 'bg-stone-100/40' : 'bg-white/[0.01]',
  }

  const f = (v: number, d = 0) =>
    v === 0
      ? '-'
      : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
  const fc = (v: number) => (v === 0 ? '-' : formatCompactCurrency(v, currency))

  if (isLoading) {
    return (
      <div>
        <h3 className={cn('text-base font-semibold mb-4', st.text)}>Stock Movement Report</h3>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={cn('h-10 animate-pulse', st.hBg)} />
          ))}
        </div>
      </div>
    )
  }
  if (allRows.length === 0) {
    return (
      <div>
        <h3 className={cn('text-base font-semibold mb-4', st.text)}>Stock Movement Report</h3>
        <p className={cn('text-sm', st.muted)}>No stock movement data for this period.</p>
      </div>
    )
  }

  const th = cn(
    'px-2 py-1.5 text-[9px] font-medium uppercase tracking-wider whitespace-nowrap',
    st.muted
  )
  const td = cn('px-2 py-1.5 text-[11px] whitespace-nowrap text-center')
  const R = 'text-center tabular-nums'

  // 14 numeric cells matching headers: opn_ctn, opn_mt, val_opn, pur_ctn, pur_mt, sal_ctn, sal_mt, pa_ctn, pa_mt, na_ctn, na_mt, cl_ctn, cl_mt, val_cls
  const numCells = (d: SmRow, bold = false) => {
    const b = bold ? 'font-semibold' : ''
    return (
      <>
        <td className={cn(td, R, b, st.text)}>{f(d.opn_ctn)}</td>
        <td className={cn(td, R, st.muted)}>{f(d.opn_mt, 3)}</td>
        <td className={cn(td, R, b, st.text)}>{fc(d.val_opn)}</td>
        <td className={cn(td, R, 'text-emerald-500')}>{f(d.pur_ctn)}</td>
        <td className={cn(td, R, 'text-emerald-500/70')}>{f(d.pur_mt, 3)}</td>
        <td className={cn(td, R, 'text-rose-500')}>{f(d.sal_ctn)}</td>
        <td className={cn(td, R, 'text-rose-500/70')}>{f(d.sal_mt, 3)}</td>
        <td className={cn(td, R, st.text)}>{f(d.pa_ctn)}</td>
        <td className={cn(td, R, st.muted)}>{f(d.pa_mt, 3)}</td>
        <td className={cn(td, R, st.text)}>{f(d.na_ctn)}</td>
        <td className={cn(td, R, st.muted)}>{f(d.na_mt, 3)}</td>
        <td className={cn(td, R, b, st.text)}>{f(d.cl_ctn)}</td>
        <td className={cn(td, R, st.muted)}>{f(d.cl_mt, 3)}</td>
        <td className={cn(td, R, b, st.text)}>{fc(d.val_cls)}</td>
      </>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div>
            <h3 className={cn('text-base font-semibold', st.text)}>Stock Movement Report</h3>
            {dateRange && (
              <p className={cn('text-xs mt-0.5', st.muted)}>
                {new Date(dateRange.start).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
                {' — '}
                {new Date(dateRange.end).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
          <InfoTooltip
            description="Detailed stock movement report showing opening balance, purchases, sales, adjustments, and closing balance per item, location, and lot."
            calculationTooltip={{
              formula: 'Closing = Opening + Purchases − Sales + Pos Adj − Neg Adj',
              components: [
                { label: 'Items', value: `${itemGroups.length}` },
                { label: 'Total Rows', value: `${allRows.length}` },
                { label: 'CTN', value: 'Carton quantity' },
                { label: 'MT', value: 'Metric tonnes (CTN × UOM ÷ 1000)' },
              ],
            }}
            note="Source: BC Item Ledger Entries. Opening balance from entries before the selected period. Period movements from entries within the date range."
          />
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu
            align="end"
            triggerMode="hover"
            trigger={
              <button
                disabled={!!isExporting || allRows.length === 0}
                className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
                title="Download Stock Movement Report"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
            }
            className="min-w-[160px]"
          >
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer"
              onSelect={handleExportPDF}
            >
              <FileText className="w-4 h-4 text-red-500" />
              <span>Export as PDF</span>
              {isExporting === 'pdf' && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer"
              onSelect={handleExportCSV}
            >
              <FileSpreadsheet className="w-4 h-4 text-green-500" />
              <span>Export as CSV</span>
              {isExporting === 'csv' && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
            </DropdownMenuItem>
          </DropdownMenu>
          <span className={cn('text-xs', st.muted)}>
            {itemGroups.length} items &middot; {allRows.length} rows
          </span>
        </div>
      </div>

      <div
        className="overflow-x-auto rounded-lg border"
        style={{ borderColor: isLight ? '#e7e5e4' : 'rgba(255,255,255,0.08)' }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className={st.hBg}>
              <th className={cn(th, 'w-5 border-b', st.bdr)} rowSpan={2} />
              <th className={cn(th, 'text-left border-b', st.bdr)} rowSpan={2}>
                <span
                  className="inline-flex items-center gap-0.5 cursor-pointer"
                  onClick={() => toggleSort('item_no')}
                >
                  Item Number &amp; Name <ArrowUpDown className="w-2.5 h-2.5" />
                </span>
              </th>
              <th className={cn(th, 'text-left border-b', st.bdr)} rowSpan={2}>
                Location
              </th>
              {hasLotData && (
                <th className={cn(th, 'text-left border-b', st.bdr)} rowSpan={2}>
                  Lot No
                </th>
              )}
              <th className={cn(th, R, 'border-b', st.bdr)} rowSpan={2}>
                UOM
              </th>
              <th className={cn(th, 'text-center border-l border-b', st.bdr)} colSpan={3}>
                Opening
              </th>
              <th className={cn(th, 'text-center border-l border-b', st.bdr)} colSpan={2}>
                Purchases
              </th>
              <th className={cn(th, 'text-center border-l border-b', st.bdr)} colSpan={2}>
                Sales
              </th>
              <th className={cn(th, 'text-center border-l border-b', st.bdr)} colSpan={2}>
                +ve Adj
              </th>
              <th className={cn(th, 'text-center border-l border-b', st.bdr)} colSpan={2}>
                -ve Adj
              </th>
              <th className={cn(th, 'text-center border-l border-b', st.bdr)} colSpan={3}>
                Closing
              </th>
            </tr>
            <tr className={st.hBg}>
              <th className={cn(th, R, 'border-l', st.bdr)}>CTN</th>
              <th className={cn(th, R)}>MT</th>
              <th className={cn(th, R)}>Value</th>
              <th className={cn(th, R, 'border-l', st.bdr)}>CTN</th>
              <th className={cn(th, R)}>MT</th>
              <th className={cn(th, R, 'border-l', st.bdr)}>CTN</th>
              <th className={cn(th, R)}>MT</th>
              <th className={cn(th, R, 'border-l', st.bdr)}>CTN</th>
              <th className={cn(th, R)}>MT</th>
              <th className={cn(th, R, 'border-l', st.bdr)}>CTN</th>
              <th className={cn(th, R)}>MT</th>
              <th
                className={cn(th, R, 'border-l cursor-pointer', st.bdr)}
                onClick={() => toggleSort('cl_ctn')}
              >
                <span className="inline-flex items-center gap-0.5 justify-end">
                  CTN <ArrowUpDown className="w-2.5 h-2.5" />
                </span>
              </th>
              <th className={cn(th, R)}>MT</th>
              <th className={cn(th, R, 'cursor-pointer')} onClick={() => toggleSort('val_cls')}>
                <span className="inline-flex items-center gap-0.5 justify-end">
                  Value <ArrowUpDown className="w-2.5 h-2.5" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {flatRows.map((row, idx) => {
              if (row.type === 'item') {
                const hasMulti = row.locCount > 1
                return (
                  <React.Fragment key={`i-${row.itemNo}`}>
                    <tr
                      className={cn(st.rHov, 'group/item cursor-pointer')}
                      onClick={() => toggleItem(row.itemNo)}
                    >
                      <td className={cn(td, 'w-5 text-center', st.text)}>
                        {expandedItems.has(row.itemNo) ? (
                          <ChevronDown className="w-3 h-3 inline" />
                        ) : (
                          <ChevronRight className="w-3 h-3 inline" />
                        )}
                      </td>
                      <td className={cn(td, 'font-semibold text-left', st.text)}>
                        {row.itemNo}
                        <span
                          className={cn(
                            'ml-1.5 font-normal hover:underline hover:text-amber-500 transition-colors',
                            st.muted
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            onItemClick?.(row.itemNo)
                          }}
                        >
                          {row.itemName}
                        </span>
                      </td>
                      <td className={cn(td, 'text-left', st.muted)}>
                        {hasMulti
                          ? `${row.locCount} loc`
                          : displayed.find((g) => g.itemNo === row.itemNo)?.locations[0]?.loc}
                      </td>
                      {hasLotData && (
                        <td
                          className={cn(
                            td,
                            'text-left text-[10px] max-w-[200px] truncate',
                            st.muted
                          )}
                          title={row.lotNo}
                        >
                          {row.lotNo}
                        </td>
                      )}
                      <td className={cn(td, R, st.text)}>{row.uom || '-'}</td>
                      {numCells(row.data, true)}
                    </tr>
                    {row.itemNo === selectedItemNumber && renderItemDetail && (
                      <tr>
                        <td colSpan={100} className="p-0 border-none">
                          {renderItemDetail()}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              }
              if (row.type === 'loc') {
                const lk = `${row.itemNo}||${row.locCode}`
                const hasLots = row.lotCount > 1
                return (
                  <tr
                    key={`l-${lk}`}
                    className={cn(st.eBg, st.rHov, hasLots && 'cursor-pointer')}
                    onClick={() => hasLots && toggleLoc(lk)}
                  >
                    <td className={cn(td, 'w-5', st.text)} />
                    <td className={td} />
                    <td className={cn(td, 'text-left font-medium', st.text)}>
                      <span className="inline-flex items-center gap-1">
                        {hasLots &&
                          (expandedLocs.has(lk) ? (
                            <ChevronDown className="w-2.5 h-2.5" />
                          ) : (
                            <ChevronRight className="w-2.5 h-2.5" />
                          ))}
                        {row.locCode}
                      </span>
                    </td>
                    {hasLotData && (
                      <td
                        className={cn(td, 'text-left text-[10px] max-w-[200px] truncate', st.muted)}
                        title={row.lotNo}
                      >
                        {row.lotNo}
                      </td>
                    )}
                    <td className={cn(td, R, st.text)}>{row.uom || '-'}</td>
                    {numCells(row.data, true)}
                  </tr>
                )
              }
              // lot
              return (
                <tr key={`t-${idx}`} className={st.lBg}>
                  <td className={td} />
                  <td className={td} />
                  <td className={td} />
                  {hasLotData && (
                    <td
                      className={cn(td, 'text-left text-[10px] max-w-[200px] truncate', st.muted)}
                      title={row.lotNo}
                    >
                      {row.lotNo || '(no lot)'}
                    </td>
                  )}
                  <td className={cn(td, R, st.text)}>{row.uom || '-'}</td>
                  {numCells(row.data)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {sorted.length > 50 && !showAll && (
        <button
          className="mt-3 text-xs text-cyan-500 hover:text-cyan-400 transition-colors"
          onClick={() => setShowAll(true)}
        >
          Show all {sorted.length} items...
        </button>
      )}
    </div>
  )
}
