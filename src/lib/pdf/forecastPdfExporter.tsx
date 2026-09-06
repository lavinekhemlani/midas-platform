// src/lib/pdf/forecastPdfExporter.tsx
'use client'

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  pdf,
  Svg,
  Path,
  Line,
  Circle,
  Rect,
} from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS, normalizeForPdf } from './fontConfig'
import type { ForecastData, ForecastLineItem, ForecastPeriod } from '@/types/forecasting'
import { formatCompactCurrency, formatCurrency as formatCurrencyUtil } from '@/lib/utils/currency'

registerPdfFonts()

// =============================================================================
// Styles
// =============================================================================

const s = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    paddingTop: 50,
    paddingBottom: 60,
    fontFamily: 'Noto Sans',
  },
  pageHeader: {
    position: 'absolute',
    top: 15,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoBox: { width: 60, height: 15 },
  logo: { width: '100%', height: '100%', objectFit: 'contain' },
  headerMeta: { fontSize: 7, color: '#9ca3af', fontFamily: 'Noto Sans', textAlign: 'right' },
  titleBlock: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: '5 solid #df1e5a',
  },
  orgName: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 6,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: 'Noto Sans',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Tinos',
    fontWeight: 400,
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: { fontSize: 10, color: '#6b7280', fontFamily: 'Noto Sans' },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    fontFamily: 'Noto Sans',
    color: '#9ca3af',
    borderTop: '1 solid #e5e7eb',
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Tinos',
    color: '#1e3a5f',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: '2 solid #df1e5a',
  },
  subTitle: {
    fontSize: 12,
    fontFamily: 'Noto Sans',
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  // KPI cards
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f8fafc',
    border: '1 solid #e2e8f0',
    borderRadius: 4,
  },
  kpiLabel: { fontSize: 8, color: '#6b7280', fontFamily: 'Noto Sans', marginBottom: 3 },
  kpiValue: { fontSize: 14, fontFamily: 'Noto Sans', fontWeight: 'bold', color: '#111827' },
  kpiSub: { fontSize: 7, color: '#9ca3af', fontFamily: 'Noto Sans', marginTop: 2 },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    borderBottom: '2 solid #df1e5a',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e2e8f0',
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: '1 solid #e2e8f0',
    backgroundColor: '#f8fafc',
  },
  tableRowSummary: {
    flexDirection: 'row',
    borderBottom: '1 solid #cbd5e1',
    backgroundColor: '#f1f5f9',
  },
  thCell: {
    fontSize: 7,
    fontFamily: 'Noto Sans',
    fontWeight: 'bold',
    color: '#ffffff',
    padding: 5,
  },
  tdCell: {
    fontSize: 7,
    fontFamily: 'Noto Sans',
    color: '#374151',
    padding: 5,
  },
  tdCellBold: {
    fontSize: 7,
    fontFamily: 'Noto Sans',
    fontWeight: 'bold',
    color: '#111827',
    padding: 5,
  },
  // Legend
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 8, fontFamily: 'Noto Sans', color: '#374151' },
  // Assumptions
  assumptionRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e2e8f0',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  assumptionLabel: { fontSize: 9, fontFamily: 'Noto Sans', color: '#6b7280', width: 180 },
  assumptionValue: { fontSize: 9, fontFamily: 'Noto Sans', fontWeight: 'bold', color: '#111827' },
  // Memory table
  memoryHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottom: '1 solid #cbd5e1',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  memoryRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e2e8f0',
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  memoryCell: { fontSize: 8, fontFamily: 'Noto Sans', color: '#374151' },
  memoryCellBold: { fontSize: 8, fontFamily: 'Noto Sans', fontWeight: 'bold', color: '#111827' },
})

// =============================================================================
// Chart SVG helpers
// =============================================================================

const CHART_W = 720
const CHART_H = 220
const PAD = { top: 20, right: 20, bottom: 30, left: 60 }

function plotX(index: number, total: number): number {
  return PAD.left + (index / Math.max(total - 1, 1)) * (CHART_W - PAD.left - PAD.right)
}

function plotY(value: number, min: number, max: number): number {
  const range = max - min || 1
  return PAD.top + (CHART_H - PAD.top - PAD.bottom) * (1 - (value - min) / range)
}

function buildLinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  let d = `M ${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const c = points[i]
    const n = points[i + 1]
    const dx = (n.x - c.x) * 0.4
    d += ` C ${c.x + dx},${c.y} ${n.x - dx},${n.y} ${n.x},${n.y}`
  }
  return d
}

function niceAxis(min: number, max: number, ticks: number = 5) {
  const range = max - min || 1
  const padded = { min: min - range * 0.08, max: max + range * 0.08 }
  const step = (padded.max - padded.min) / ticks
  const values: number[] = []
  for (let i = 0; i <= ticks; i++) values.push(padded.min + step * i)
  return { min: padded.min, max: padded.max, values }
}

function compactNum(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}K`
  return `${sign}${abs.toFixed(0)}`
}

// =============================================================================
// Chart Component
// =============================================================================

const ForecastChartSVG: React.FC<{
  periods: ForecastPeriod[]
  currency: string
  horizonLabel: string
}> = ({ periods, currency, horizonLabel }) => {
  // Compute data lines
  const historicalEnd = periods.findIndex((p) => !p.isHistorical)
  const splitIdx = historicalEnd > 0 ? historicalEnd : periods.length

  // Compute y range across all lines
  const allVals = periods.flatMap((p) => [p.cumulativeCash, p.cumulativeCash + p.memoryAdjustment])
  const rawMin = Math.min(...allVals)
  const rawMax = Math.max(...allVals)
  const axis = niceAxis(rawMin, rawMax)

  // Points
  const cashPoints = periods.map((p, i) => ({
    x: plotX(i, periods.length),
    y: plotY(p.cumulativeCash, axis.min, axis.max),
  }))

  const withMemPoints = periods.map((p, i) => ({
    x: plotX(i, periods.length),
    y: plotY(p.cumulativeCash + p.memoryAdjustment, axis.min, axis.max),
  }))

  // Historical vs forecast split
  const histPoints = cashPoints.slice(0, splitIdx)
  const forecastPoints = cashPoints.slice(Math.max(splitIdx - 1, 0))
  const forecastMemPoints = withMemPoints.slice(Math.max(splitIdx - 1, 0))

  // Today line x
  const todayX = splitIdx > 0 ? plotX(splitIdx - 1, periods.length) : plotX(0, periods.length)

  // Zero line
  const zeroY = plotY(0, axis.min, axis.max)
  const showZero = axis.min < 0 && axis.max > 0

  // X-axis labels (show ~6)
  const xStep = Math.max(1, Math.floor(periods.length / 6))
  const xLabels = periods
    .filter((_, i) => i % xStep === 0 || i === periods.length - 1)
    .map((p, _, arr) => ({
      label: p.label.length > 8 ? p.label.slice(0, 8) : p.label,
      x: plotX(periods.indexOf(p), periods.length),
    }))

  return (
    <View>
      <Svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
        {/* Grid lines */}
        {axis.values.map((v, i) => {
          const y = plotY(v, axis.min, axis.max)
          return (
            <React.Fragment key={`g${i}`}>
              <Line
                x1={PAD.left}
                y1={y}
                x2={CHART_W - PAD.right}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth={0.5}
              />
              <Text
                x={PAD.left - 4}
                y={y + 3}
                style={{ fontSize: 7, fill: '#6b7280', textAnchor: 'end', fontFamily: 'Noto Sans' }}
              >
                {compactNum(v)}
              </Text>
            </React.Fragment>
          )
        })}

        {/* X labels */}
        {xLabels.map((xl, i) => (
          <Text
            key={`xl${i}`}
            x={xl.x}
            y={CHART_H - PAD.bottom + 14}
            style={{
              fontSize: 6.5,
              fill: '#6b7280',
              textAnchor: 'middle',
              fontFamily: 'Noto Sans',
            }}
          >
            {xl.label}
          </Text>
        ))}

        {/* Zero line */}
        {showZero && (
          <Line
            x1={PAD.left}
            y1={zeroY}
            x2={CHART_W - PAD.right}
            y2={zeroY}
            stroke="#94a3b8"
            strokeWidth={0.7}
            strokeDasharray="4 3"
          />
        )}

        {/* Today vertical line */}
        <Line
          x1={todayX}
          y1={PAD.top}
          x2={todayX}
          y2={CHART_H - PAD.bottom}
          stroke="#f59e0b"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
        <Text
          x={todayX}
          y={PAD.top - 4}
          style={{ fontSize: 7, fill: '#f59e0b', textAnchor: 'middle', fontFamily: 'Noto Sans' }}
        >
          Today
        </Text>

        {/* Historical line (solid blue) */}
        {histPoints.length > 1 && (
          <Path d={buildLinePath(histPoints)} fill="none" stroke="#3b82f6" strokeWidth={2} />
        )}

        {/* Forecast line (dashed red) */}
        {forecastPoints.length > 1 && (
          <Path
            d={buildLinePath(forecastPoints)}
            fill="none"
            stroke="#f87171"
            strokeWidth={2}
            strokeDasharray="6 3"
          />
        )}

        {/* With memories line (dashed amber) */}
        {forecastMemPoints.length > 1 && (
          <Path
            d={buildLinePath(forecastMemPoints)}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}

        {/* Dots */}
        {cashPoints.map((pt, i) => (
          <Circle
            key={`d${i}`}
            cx={pt.x}
            cy={pt.y}
            r={2}
            fill={i < splitIdx ? '#3b82f6' : '#f87171'}
          />
        ))}

        {/* Axes */}
        <Line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={CHART_H - PAD.bottom}
          stroke="#374151"
          strokeWidth={1}
        />
        <Line
          x1={PAD.left}
          y1={CHART_H - PAD.bottom}
          x2={CHART_W - PAD.right}
          y2={CHART_H - PAD.bottom}
          stroke="#374151"
          strokeWidth={1}
        />
      </Svg>

      {/* Legend */}
      <View style={s.legendRow}>
        <View style={s.legendItem}>
          <View style={{ width: 16, height: 2, backgroundColor: '#3b82f6' }} />
          <Text style={s.legendText}>Historical</Text>
        </View>
        <View style={s.legendItem}>
          <View
            style={{ width: 16, height: 2, backgroundColor: '#f87171', borderStyle: 'dashed' }}
          />
          <Text style={s.legendText}>Forecast</Text>
        </View>
        <View style={s.legendItem}>
          <View
            style={{ width: 16, height: 2, backgroundColor: '#fbbf24', borderStyle: 'dashed' }}
          />
          <Text style={s.legendText}>With Memories</Text>
        </View>
      </View>
    </View>
  )
}

// =============================================================================
// Table Component
// =============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  operating: 'Operating Activities',
  investing: 'Investing Activities',
  financing: 'Financing Activities',
  'memory-income': 'Memories: Scheduled Income',
  'memory-expense': 'Memories: Scheduled Expenses',
  income: 'Income',
  cogs: 'Cost of Goods Sold',
  opex: 'Operating Expenses',
  'other-income': 'Other Income',
  'other-expense': 'Other Expenses',
}

const ForecastTablePDF: React.FC<{
  lineItems: ForecastLineItem[]
  periods: ForecastPeriod[]
  currency: string
}> = ({ lineItems, periods, currency }) => {
  // Show max ~13 period columns in landscape
  const maxCols = 13
  const displayPeriods =
    periods.length > maxCols
      ? periods
          .filter(
            (_, i) => i % Math.ceil(periods.length / maxCols) === 0 || i === periods.length - 1
          )
          .slice(0, maxCols)
      : periods
  const periodIndices = displayPeriods.map((p) => periods.indexOf(p))
  const periodKeys = periods.map((_, i) => `period_${i}`)

  const nameWidth = 140
  const colWidth = (CHART_W - nameWidth) / displayPeriods.length

  // Group items by category
  const grouped = new Map<string, ForecastLineItem[]>()
  for (const item of lineItems) {
    if (!grouped.has(item.category)) grouped.set(item.category, [])
    grouped.get(item.category)!.push(item)
  }

  // Compute section subtotals
  const sectionTotals: Record<string, Record<string, number>> = {}
  for (const [cat, items] of grouped.entries()) {
    const totals: Record<string, number> = {}
    for (const key of periodKeys) {
      totals[key] = items
        .filter((i) => !i.isSummary)
        .reduce((sum, item) => sum + (item.values[key] || 0), 0)
    }
    sectionTotals[cat] = totals
  }

  // Grand totals
  const grandTotals: Record<string, number> = {}
  for (const key of periodKeys) {
    grandTotals[key] = Object.values(sectionTotals).reduce(
      (sum, section) => sum + (section[key] || 0),
      0
    )
  }

  // Beginning cash
  const beginningCash: Record<string, number> = {}
  for (let i = 0; i < periods.length; i++) {
    const key = `period_${i}`
    beginningCash[key] =
      i === 0 ? periods[0].cumulativeCash - (grandTotals[key] || 0) : periods[i - 1].cumulativeCash
  }

  let rowIdx = 0

  function renderValueRow(
    label: string,
    getVal: (pi: number) => number,
    bold: boolean,
    bg?: string
  ) {
    const idx = rowIdx++
    const baseStyle = bold ? s.tdCellBold : s.tdCell
    return (
      <View
        key={`val-${label}-${idx}`}
        style={[
          bold ? s.tableRowSummary : idx % 2 === 0 ? s.tableRow : s.tableRowAlt,
          bg ? { backgroundColor: bg } : {},
        ]}
        wrap={false}
      >
        <View style={{ width: nameWidth, paddingLeft: 8 }}>
          <Text style={baseStyle}>{label}</Text>
        </View>
        {periodIndices.map((pi) => {
          const val = getVal(pi)
          return (
            <View key={pi} style={{ width: colWidth, alignItems: 'flex-end' }}>
              <Text
                style={[
                  baseStyle,
                  val < 0 ? { color: '#ef4444' } : val > 0 ? { color: '#10b981' } : {},
                ]}
              >
                {compactNum(val)}
              </Text>
            </View>
          )
        })}
      </View>
    )
  }

  function renderItemRow(item: ForecastLineItem) {
    const idx = rowIdx++
    const isMemory = item.isMemory
    return (
      <View key={item.id} style={idx % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
        <View style={{ width: nameWidth, paddingLeft: 20 }}>
          <Text style={[s.tdCell, isMemory ? { color: '#8b5cf6' } : {}]}>
            {normalizeForPdf(item.name)}
          </Text>
        </View>
        {periodIndices.map((pi) => {
          const val = item.values[`period_${pi}`]
          const isNeg = val !== undefined && val < 0
          return (
            <View key={pi} style={{ width: colWidth, alignItems: 'flex-end' }}>
              <Text style={[s.tdCell, isNeg ? { color: '#ef4444' } : {}]}>
                {val !== undefined ? compactNum(val) : ''}
              </Text>
            </View>
          )
        })}
      </View>
    )
  }

  const categories = [...grouped.keys()]

  return (
    <View>
      {/* Header */}
      <View style={s.tableHeader}>
        <View style={{ width: nameWidth }}>
          <Text style={s.thCell}>Category</Text>
        </View>
        {displayPeriods.map((p, i) => (
          <View key={i} style={{ width: colWidth, alignItems: 'flex-end' }}>
            <Text style={s.thCell}>{p.label.length > 7 ? p.label.slice(0, 7) : p.label}</Text>
          </View>
        ))}
      </View>

      {/* Beginning Cash */}
      {renderValueRow(
        'Beginning Cash',
        (pi) => beginningCash[`period_${pi}`] || 0,
        true,
        '#f8fafc'
      )}

      {/* Sections */}
      {categories.map((cat) => {
        const items = grouped.get(cat)!.filter((i) => !i.isSummary)
        const catLabel = CATEGORY_LABELS[cat] || cat
        const subtotals = sectionTotals[cat] || {}

        return (
          <React.Fragment key={cat}>
            {/* Section header */}
            <View style={[s.tableRowSummary, { borderBottom: '1.5 solid #cbd5e1' }]} wrap={false}>
              <View style={{ width: nameWidth, paddingLeft: 8 }}>
                <Text style={[s.tdCellBold, { color: '#1e3a5f' }]}>{catLabel}</Text>
              </View>
              {periodIndices.map((pi) => (
                <View key={pi} style={{ width: colWidth }} />
              ))}
            </View>

            {/* Line items */}
            {items.map((item) => renderItemRow(item))}

            {/* Section subtotal */}
            {renderValueRow(`Total ${catLabel}`, (pi) => subtotals[`period_${pi}`] || 0, true)}
          </React.Fragment>
        )
      })}

      {/* Net Change in Cash */}
      {renderValueRow(
        'Net Change in Cash',
        (pi) => grandTotals[`period_${pi}`] || 0,
        true,
        '#f1f5f9'
      )}

      {/* Ending Cash */}
      {renderValueRow('Ending Cash', (pi) => periods[pi]?.cumulativeCash || 0, true, '#f8fafc')}
    </View>
  )
}

// =============================================================================
// KPI Summary
// =============================================================================

const KPISummary: React.FC<{ data: ForecastData }> = ({ data }) => {
  const { summary, currency } = data
  const fmt = (v: number) => formatCurrencyUtil(v, { currency, compact: true })

  return (
    <View style={s.kpiRow}>
      <View style={s.kpiCard}>
        <Text style={s.kpiLabel}>Current Cash</Text>
        <Text style={s.kpiValue}>{fmt(summary.currentCash)}</Text>
      </View>
      <View style={s.kpiCard}>
        <Text style={s.kpiLabel}>Projected Ending Cash</Text>
        <Text style={[s.kpiValue, summary.projectedEndingCash < 0 ? { color: '#ef4444' } : {}]}>
          {fmt(summary.projectedEndingCash)}
        </Text>
      </View>
      <View style={s.kpiCard}>
        <Text style={s.kpiLabel}>Net Change</Text>
        <Text style={[s.kpiValue, { color: summary.netChange >= 0 ? '#10b981' : '#ef4444' }]}>
          {fmt(summary.netChange)}
        </Text>
      </View>
      <View style={s.kpiCard}>
        <Text style={s.kpiLabel}>Lowest Cash Point</Text>
        <Text style={[s.kpiValue, summary.lowestCashPoint.amount < 0 ? { color: '#ef4444' } : {}]}>
          {fmt(summary.lowestCashPoint.amount)}
        </Text>
        <Text style={s.kpiSub}>{summary.lowestCashPoint.date}</Text>
      </View>
      <View style={s.kpiCard}>
        <Text style={s.kpiLabel}>Runway</Text>
        <Text style={s.kpiValue}>
          {summary.runway !== null ? `${summary.runway} mo` : 'Infinite'}
        </Text>
      </View>
    </View>
  )
}

// =============================================================================
// Assumptions Section (inline after tables)
// =============================================================================

const AssumptionsSection: React.FC<{ data: ForecastData }> = ({ data }) => {
  const a = data.assumptions

  return (
    <View style={{ marginTop: 14 }}>
      <Text style={s.subTitle}>Forecast Assumptions</Text>
      <View style={{ border: '1 solid #e2e8f0', borderRadius: 4 }}>
        {[
          ['Growth Rate', `${a.growthRate}%`],
          ['Inflow Growth Rate', `${a.inflowGrowthRate}%`],
          ['Outflow Growth Rate', `${a.outflowGrowthRate}%`],
          ['Rolling Average Window', `${a.rollingAverageDays} days`],
          ['Confidence Level', `${a.confidenceLevel}%`],
        ].map(([label, value], i) => (
          <View
            key={i}
            style={[s.assumptionRow, i % 2 === 1 ? { backgroundColor: '#f8fafc' } : {}]}
          >
            <Text style={s.assumptionLabel}>{label}</Text>
            <Text style={s.assumptionValue}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// =============================================================================
// Memories Page
// =============================================================================

const MemoriesPage: React.FC<{ data: ForecastData }> = ({ data }) => {
  const memories = data.memories
  if (memories.income.length === 0 && memories.expenses.length === 0) return null

  return (
    <View>
      <Text style={s.sectionTitle}>Scheduled Memory Events</Text>

      {memories.income.length > 0 && (
        <>
          <Text style={s.subTitle}>Income Events</Text>
          <View style={{ border: '1 solid #e2e8f0', borderRadius: 4, marginBottom: 10 }}>
            <View style={s.memoryHeader}>
              <Text style={[s.memoryCellBold, { width: 220 }]}>Description</Text>
              <Text
                style={[s.memoryCellBold, { width: 100, textAlign: 'right', paddingRight: 12 }]}
              >
                Amount
              </Text>
              <Text style={[s.memoryCellBold, { width: 90 }]}>Date</Text>
              <Text style={[s.memoryCellBold, { width: 80 }]}>Frequency</Text>
            </View>
            {memories.income.map((m, i) => (
              <View key={i} style={s.memoryRow}>
                <Text style={[s.memoryCell, { width: 220 }]}>{normalizeForPdf(m.description)}</Text>
                <Text
                  style={[
                    s.memoryCell,
                    { width: 100, textAlign: 'right', paddingRight: 12, color: '#10b981' },
                  ]}
                >
                  {formatCurrencyUtil(m.amount, { currency: data.currency })}
                </Text>
                <Text style={[s.memoryCell, { width: 90 }]}>{m.date}</Text>
                <Text style={[s.memoryCell, { width: 80 }]}>
                  {m.recurring ? m.frequency || 'One-time' : 'One-time'}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {memories.expenses.length > 0 && (
        <>
          <Text style={s.subTitle}>Expense Events</Text>
          <View style={{ border: '1 solid #e2e8f0', borderRadius: 4, marginBottom: 10 }}>
            <View style={s.memoryHeader}>
              <Text style={[s.memoryCellBold, { width: 220 }]}>Description</Text>
              <Text
                style={[s.memoryCellBold, { width: 100, textAlign: 'right', paddingRight: 12 }]}
              >
                Amount
              </Text>
              <Text style={[s.memoryCellBold, { width: 90 }]}>Date</Text>
              <Text style={[s.memoryCellBold, { width: 80 }]}>Frequency</Text>
            </View>
            {memories.expenses.map((m, i) => (
              <View key={i} style={s.memoryRow}>
                <Text style={[s.memoryCell, { width: 220 }]}>{normalizeForPdf(m.description)}</Text>
                <Text
                  style={[
                    s.memoryCell,
                    { width: 100, textAlign: 'right', paddingRight: 12, color: '#ef4444' },
                  ]}
                >
                  {formatCurrencyUtil(m.amount, { currency: data.currency })}
                </Text>
                <Text style={[s.memoryCell, { width: 90 }]}>{m.date}</Text>
                <Text style={[s.memoryCell, { width: 80 }]}>
                  {m.recurring ? m.frequency || 'One-time' : 'One-time'}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Net impact summary */}
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
        <View style={[s.kpiCard, { flex: 1 }]}>
          <Text style={s.kpiLabel}>Total Income Impact</Text>
          <Text style={[s.kpiValue, { color: '#10b981' }]}>
            {formatCurrencyUtil(memories.totalIncomeImpact, { currency: data.currency })}
          </Text>
        </View>
        <View style={[s.kpiCard, { flex: 1 }]}>
          <Text style={s.kpiLabel}>Total Expense Impact</Text>
          <Text style={[s.kpiValue, { color: '#ef4444' }]}>
            {formatCurrencyUtil(memories.totalExpenseImpact, { currency: data.currency })}
          </Text>
        </View>
        <View style={[s.kpiCard, { flex: 1 }]}>
          <Text style={s.kpiLabel}>Net Memory Impact</Text>
          <Text style={[s.kpiValue, { color: memories.netImpact >= 0 ? '#10b981' : '#ef4444' }]}>
            {formatCurrencyUtil(memories.netImpact, { currency: data.currency })}
          </Text>
        </View>
      </View>
    </View>
  )
}

// =============================================================================
// Main Document
// =============================================================================

const ForecastPDFDocument: React.FC<{
  data13Week: ForecastData
  data6Month: ForecastData
  logoImage: string | null
  organizationName?: string
}> = ({ data13Week, data6Month, logoImage, organizationName }) => {
  const genDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const Header = (
    <View style={s.pageHeader} fixed>
      {logoImage ? (
        <View style={s.logoBox}>
          <Image src={logoImage} style={s.logo} />
        </View>
      ) : (
        <View style={s.logoBox} />
      )}
      <Text style={s.headerMeta}>{genDate}</Text>
    </View>
  )

  const Footer = (
    <View style={s.footer} fixed>
      <Text>Confidential Financial Report</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  )

  return (
    <Document>
      {/* Page 1: 13-Week Chart + KPIs */}
      <Page size="A4" orientation="landscape" style={s.page} wrap>
        {Header}
        <View style={{ height: 20 }} />
        <View style={s.titleBlock}>
          {organizationName && <Text style={s.orgName}>{organizationName}</Text>}
          <Text style={s.title}>Cash Flow Forecast Report</Text>
          <Text style={s.subtitle}>
            {data13Week.startDate} to {data6Month.endDate}
          </Text>
        </View>

        <Text style={s.sectionTitle}>13-Week Cash Flow Projection</Text>
        <KPISummary data={data13Week} />
        <ForecastChartSVG
          periods={data13Week.periods}
          currency={data13Week.currency}
          horizonLabel="13-Week"
        />
        {Footer}
      </Page>

      {/* Page 2: 13-Week Table + Assumptions */}
      <Page size="A4" orientation="landscape" style={s.page} wrap>
        {Header}
        <View style={{ height: 20 }} />
        <Text style={s.sectionTitle}>13-Week Detailed Breakdown</Text>
        <ForecastTablePDF
          lineItems={data13Week.lineItems.cashFlow}
          periods={data13Week.periods}
          currency={data13Week.currency}
        />
        <AssumptionsSection data={data13Week} />
        {Footer}
      </Page>

      {/* Page 3: 6-Month Chart + KPIs */}
      <Page size="A4" orientation="landscape" style={s.page} wrap>
        {Header}
        <View style={{ height: 20 }} />
        <Text style={s.sectionTitle}>6-Month Cash Flow Projection</Text>
        <KPISummary data={data6Month} />
        <ForecastChartSVG
          periods={data6Month.periods}
          currency={data6Month.currency}
          horizonLabel="6-Month"
        />
        {Footer}
      </Page>

      {/* Page 4: 6-Month Table + Assumptions */}
      <Page size="A4" orientation="landscape" style={s.page} wrap>
        {Header}
        <View style={{ height: 20 }} />
        <Text style={s.sectionTitle}>6-Month Detailed Breakdown</Text>
        <ForecastTablePDF
          lineItems={data6Month.lineItems.cashFlow}
          periods={data6Month.periods}
          currency={data6Month.currency}
        />
        <AssumptionsSection data={data6Month} />
        {Footer}
      </Page>

      {/* Page 5: Memories (only if any exist) */}
      {(data13Week.memories.income.length > 0 || data13Week.memories.expenses.length > 0) && (
        <Page size="A4" orientation="landscape" style={s.page} wrap>
          {Header}
          <View style={{ height: 20 }} />
          <MemoriesPage data={data13Week} />
          {Footer}
        </Page>
      )}
    </Document>
  )
}

// =============================================================================
// Logo loader (reused pattern from chatPdfExporter)
// =============================================================================

async function loadLogoAsBase64(): Promise<string | null> {
  try {
    const response = await fetch('/images/hero/logo_type_gold_new.svg')
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// =============================================================================
// Export Interface
// =============================================================================

export interface ForecastPdfOptions {
  organizationName?: string
  onProgress?: (msg: string) => void
}

export class ForecastPdfExporter {
  static async export(
    data13Week: ForecastData,
    data6Month: ForecastData,
    options: ForecastPdfOptions = {}
  ): Promise<void> {
    const { organizationName, onProgress } = options

    onProgress?.('Loading resources...')
    const logoImage = await loadLogoAsBase64()

    onProgress?.('Generating PDF...')
    const doc = (
      <ForecastPDFDocument
        data13Week={data13Week}
        data6Month={data6Month}
        logoImage={logoImage}
        organizationName={organizationName}
      />
    )

    const blob = await pdf(doc).toBlob()

    onProgress?.('Downloading...')
    const filename = `Cash_Flow_Forecast_${new Date().toISOString().split('T')[0]}.pdf`
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)

    onProgress?.('Complete!')
  }

  static async generateBlob(
    data13Week: ForecastData,
    data6Month: ForecastData,
    options: Omit<ForecastPdfOptions, 'onProgress'> = {}
  ): Promise<Blob> {
    const logoImage = await loadLogoAsBase64()
    const doc = (
      <ForecastPDFDocument
        data13Week={data13Week}
        data6Month={data6Month}
        logoImage={logoImage}
        organizationName={options.organizationName}
      />
    )
    return await pdf(doc).toBlob()
  }
}
