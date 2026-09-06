'use client'

import React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

// ── Currency Formatter ────────────────────────────────────────────────────────

export const fmt = (v: number | null | undefined) => {
  if (v == null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TestResult {
  status: 'idle' | 'loading' | 'success' | 'error'
  data?: any
  error?: string
  duration?: number
  url?: string
}

export interface EndpointDef {
  id: string
  label: string
  description: string
  path: string
  usesDateRange: boolean
  dateRangeMode?: 'range' | 'asOf'
}

// ── Diagnostic Test Card ──────────────────────────────────────────────────────

export function DiagnosticTestCard({ test }: { test: any }) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        test.success ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded font-medium ${
              test.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {test.success ? 'OK' : 'FAIL'}
          </span>
          <span className="font-medium theme-text-primary">{test.label}</span>
        </div>
        <span className="text-xs theme-text-secondary">{test.durationMs}ms</span>
      </div>

      <p className="text-xs font-mono theme-text-secondary mb-1">{test.detail}</p>

      {test.success ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="theme-text-secondary">
              Rows: <span className="theme-text-primary font-mono">{test.rowCount}</span>
            </span>
            {test.hasHierarchy != null && (
              <span className="theme-text-secondary">
                Hierarchy:{' '}
                <span className={test.hasHierarchy ? 'text-emerald-400' : 'text-amber-400'}>
                  {test.hasHierarchy ? 'YES' : 'NO (flat)'}
                </span>
              </span>
            )}
            {test.maxIndentation != null && (
              <span className="theme-text-secondary">
                Max indent:{' '}
                <span className="theme-text-primary font-mono">{test.maxIndentation}</span>
              </span>
            )}
            {test.lineTypes && (
              <span className="theme-text-secondary">
                Line types: <span className="theme-text-primary">{test.lineTypes.join(', ')}</span>
              </span>
            )}
          </div>

          {test.sampleRows?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs mt-2">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-1 px-2 theme-text-secondary">#</th>
                    <th className="text-left py-1 px-2 theme-text-secondary">display</th>
                    <th className="text-left py-1 px-2 theme-text-secondary">lineType</th>
                    <th className="text-right py-1 px-2 theme-text-secondary">indent</th>
                    <th className="text-right py-1 px-2 theme-text-secondary">netChange</th>
                  </tr>
                </thead>
                <tbody>
                  {test.sampleRows.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-white/5">
                      <td className="py-1 px-2 theme-text-secondary">{row.lineNumber ?? i}</td>
                      <td
                        className="py-1 px-2 theme-text-primary"
                        style={{ paddingLeft: `${0.5 + (row.indentation || 0) * 1}rem` }}
                      >
                        {row.display || '-'}
                      </td>
                      <td className="py-1 px-2 theme-text-secondary">{row.lineType || '-'}</td>
                      <td className="py-1 px-2 text-right font-mono theme-text-secondary">
                        {row.indentation ?? 0}
                      </td>
                      <td className="py-1 px-2 text-right font-mono theme-text-primary">
                        {row.netChange != null ? fmt(row.netChange) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs theme-text-secondary mt-1">
                Showing first {test.sampleRows.length} of {test.rowCount} rows
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-red-400">{test.error}</p>
      )}
    </div>
  )
}

// ── Line Items Table ──────────────────────────────────────────────────────────

export function LineItemsTable({
  lines,
  amountField,
  amountLabel,
}: {
  lines: any[]
  amountField: string
  amountLabel: string
}) {
  if (!lines?.length) return <p className="text-sm theme-text-secondary">No line items</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-2 px-3 theme-text-secondary font-medium">Line</th>
            <th className="text-left py-2 px-3 theme-text-secondary font-medium">Display</th>
            <th className="text-left py-2 px-3 theme-text-secondary font-medium">Type</th>
            <th className="text-right py-2 px-3 theme-text-secondary font-medium">{amountLabel}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line: any, idx: number) => {
            const indent = (line.indentation || 0) * 1.25
            const isHeader = line.lineType === 'header'
            const isTotal = line.lineType === 'total'
            const amount = line[amountField] ?? 0
            return (
              <tr
                key={idx}
                className={
                  isHeader
                    ? 'bg-white/5'
                    : isTotal
                      ? 'bg-white/10 font-semibold border-t border-white/10'
                      : 'hover:bg-white/5'
                }
              >
                <td className="py-1.5 px-3 theme-text-secondary font-mono text-xs">
                  {line.lineNumber ?? idx}
                </td>
                <td
                  className={`py-1.5 px-3 theme-text-primary ${isHeader || isTotal ? 'font-semibold' : ''}`}
                  style={{ paddingLeft: `${0.75 + indent}rem` }}
                >
                  {line.display || '-'}
                </td>
                <td className="py-1.5 px-3">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      isHeader
                        ? 'bg-blue-500/20 text-blue-400'
                        : isTotal
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-white/10 theme-text-secondary'
                    }`}
                  >
                    {line.lineType || 'detail'}
                  </span>
                </td>
                <td
                  className={`py-1.5 px-3 text-right font-mono ${
                    amount < 0 ? 'text-red-400' : 'theme-text-primary'
                  }`}
                >
                  {isHeader ? '' : fmt(amount)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Collapsible Section ───────────────────────────────────────────────────────

export function CollapsibleSection({
  title,
  badge,
  isExpanded,
  onToggle,
  children,
}: {
  title: string
  badge?: string | number
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="glass-luxury-card border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 theme-text-secondary" />
          ) : (
            <ChevronRight className="w-4 h-4 theme-text-secondary" />
          )}
          <span className="font-medium theme-text-primary text-sm">{title}</span>
        </div>
        {badge != null && (
          <span className="text-xs px-2 py-0.5 rounded bg-white/10 theme-text-secondary">
            {badge}
          </span>
        )}
      </button>
      {isExpanded && <div className="px-4 pb-4 border-t border-white/10">{children}</div>}
    </div>
  )
}
