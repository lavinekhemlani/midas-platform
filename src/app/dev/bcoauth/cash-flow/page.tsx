'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  formatPnLCurrency,
  formatCompactCurrency,
  formatStatementAmount,
  getCurrencySymbol,
} from '@/lib/utils/currency'
import { useBCOAuthDev } from '../_shared/BCOAuthDevLayout'
import { DiagnosticTestCard, fmt, CollapsibleSection } from '../_shared/components'

// ── Sub-Tab Type ──────────────────────────────────────────────────────────────

type CashFlowTab = 'cf-preview' | 'cf-diagnostic' | 'bs-preview' | 'bs-diagnostics'

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BCOAuthCashFlowPage() {
  const { connectionId, startDate, endDate } = useBCOAuthDev()
  const [activeTab, setActiveTab] = useState<CashFlowTab>('cf-preview')

  return (
    <div className="space-y-6">
      {/* Sub-Tab Switcher */}
      <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10 w-fit">
        {[
          { id: 'cf-preview' as const, label: 'Cash Flow' },
          { id: 'cf-diagnostic' as const, label: 'CF Diagnostic' },
          { id: 'bs-preview' as const, label: 'BS Preview' },
          { id: 'bs-diagnostics' as const, label: 'BS Diagnostics' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'theme-text-secondary hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'cf-preview' && (
        <CashFlowPreviewSection
          connectionId={connectionId}
          startDate={startDate}
          endDate={endDate}
        />
      )}
      {activeTab === 'cf-diagnostic' && (
        <CashFlowDiagnosticSection
          connectionId={connectionId}
          startDate={startDate}
          endDate={endDate}
        />
      )}
      {activeTab === 'bs-preview' && (
        <BSPreviewSection connectionId={connectionId} endDate={endDate} />
      )}
      {activeTab === 'bs-diagnostics' && (
        <BSDiagnosticsSection connectionId={connectionId} startDate={startDate} endDate={endDate} />
      )}
    </div>
  )
}

// ── Cash Flow Preview Section ─────────────────────────────────────────────────

function CashFlowPreviewSection({
  connectionId,
  startDate,
  endDate,
}: {
  connectionId: string
  startDate: string
  endDate: string
}) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [showRawJson, setShowRawJson] = useState(false)

  const fetchData = useCallback(async () => {
    if (!connectionId) return
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ connectionId })
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)

    const t0 = Date.now()
    try {
      const res = await fetch(`/api/providers/dynamics/cash-flow-statement?${params}`)
      const json = await res.json()
      setDurationMs(Date.now() - t0)
      if (!res.ok) {
        setError(json.error || json.details || `HTTP ${res.status}`)
      } else {
        setData(json.data)
      }
    } catch (err) {
      setDurationMs(Date.now() - t0)
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [connectionId, startDate, endDate])

  return (
    <div className="glass-luxury-card p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-medium theme-text-primary">Cash Flow Statement</h2>
          <p className="text-sm theme-text-secondary mt-1">
            BC cash flow via cashFlowStatement entity, trialBalance, or GL entries fallback.
            {data?.source && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400">
                Source: {data.source}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {durationMs != null && (
            <span className="text-xs theme-text-secondary">{durationMs}ms</span>
          )}
          <button
            onClick={fetchData}
            disabled={!connectionId || loading}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : data ? 'Refresh' : 'Fetch Cash Flow'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 font-medium">{error}</p>
        </div>
      )}

      {data && !loading && (
        <>
          {data.totals && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { label: 'Operating', value: data.totals.totalOperating },
                { label: 'Investing', value: data.totals.totalInvesting },
                { label: 'Financing', value: data.totals.totalFinancing },
                { label: 'Net Change', value: data.totals.netChange },
                { label: 'Total Balance', value: data.totals.totalBalance },
              ]
                .filter((t) => t.value !== 0 || t.label === 'Net Change')
                .map((t) => (
                  <div key={t.label} className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-[10px] uppercase tracking-wider theme-text-secondary">
                      {t.label}
                    </p>
                    <p
                      className={`text-sm font-semibold mt-1 font-mono ${
                        t.value < 0 ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {fmt(t.value)}
                    </p>
                  </div>
                ))}
            </div>
          )}

          {data.bankAccounts?.length > 0 && (
            <div>
              <h3 className="text-sm font-medium theme-text-primary mb-2">
                Bank Accounts ({data.bankAccounts.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {data.bankAccounts.map((ba: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-white/5 border border-white/10 flex justify-between items-center"
                  >
                    <div className="min-w-0">
                      <p className="text-sm theme-text-primary truncate">
                        {ba.displayName || ba.name || ba.number}
                      </p>
                      <p className="text-xs font-mono theme-text-secondary">{ba.number || ba.no}</p>
                    </div>
                    <p className="text-sm font-mono font-semibold theme-text-primary ml-3">
                      {fmt(ba.balance ?? ba.balance_lcy ?? 0)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.lines?.length > 0 && (
            <div>
              <h3 className="text-sm font-medium theme-text-primary mb-2">
                Cash Flow Lines ({data.lines.length})
              </h3>
              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="text-left py-2 px-3 theme-text-secondary font-medium">#</th>
                      <th className="text-left py-2 px-3 theme-text-secondary font-medium">
                        Account
                      </th>
                      <th className="text-left py-2 px-3 theme-text-secondary font-medium">Type</th>
                      <th className="text-right py-2 px-3 theme-text-secondary font-medium">
                        Net Change
                      </th>
                      <th className="text-right py-2 px-3 theme-text-secondary font-medium">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lines.map((line: any, idx: number) => {
                      const indent = (line.indentation || 0) * 1.25
                      const isHeader = line.lineType === 'header'
                      const isTotal = line.lineType === 'total'
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
                              (line.netChange ?? 0) < 0 ? 'text-red-400' : 'theme-text-primary'
                            }`}
                          >
                            {isHeader ? '' : fmt(line.netChange)}
                          </td>
                          <td
                            className={`py-1.5 px-3 text-right font-mono ${
                              (line.balance ?? 0) < 0 ? 'text-red-400' : 'theme-text-primary'
                            }`}
                          >
                            {isHeader ? '' : fmt(line.balance)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="flex items-center gap-2 text-xs font-medium theme-text-secondary"
            >
              {showRawJson ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              Raw JSON Response
            </button>
            {showRawJson && (
              <pre className="mt-2 p-4 rounded-lg bg-black/20 overflow-x-auto text-xs font-mono theme-text-primary max-h-[400px] overflow-y-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Cash Flow Diagnostic Section ──────────────────────────────────────────────

function CashFlowDiagnosticSection({
  connectionId,
  startDate,
  endDate,
}: {
  connectionId: string
  startDate: string
  endDate: string
}) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const fetchData = useCallback(async () => {
    if (!connectionId) return
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ connectionId })
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)

    const t0 = Date.now()
    try {
      const res = await fetch(`/api/providers/dynamics/cash-flow-test?${params}`)
      const json = await res.json()
      setDurationMs(Date.now() - t0)
      if (!res.ok) {
        setError(json.error || json.details || `HTTP ${res.status}`)
      } else {
        setData(json.data)
      }
    } catch (err) {
      setDurationMs(Date.now() - t0)
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [connectionId, startDate, endDate])

  const entityProbe = data?.entityProbe
  const cashAccountAnalysis = data?.cashAccountAnalysis
  const methodComparison = data?.methodComparison
  const monthlyCashFlow = data?.monthlyCashFlow
  const cashRunway = data?.cashRunway

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={fetchData}
          disabled={!connectionId || loading}
          className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? 'Running Cash Flow Diagnostic...'
            : data
              ? 'Re-run Diagnostic'
              : 'Run Cash Flow Diagnostic'}
        </button>
        {durationMs != null && (
          <span className="text-xs theme-text-secondary">{durationMs}ms total</span>
        )}
        {data && (
          <button
            onClick={() => navigator.clipboard.writeText(JSON.stringify(data, null, 2))}
            className="px-3 py-1.5 text-xs rounded-lg border border-white/10 theme-text-secondary hover:bg-white/5 transition-colors"
          >
            Copy JSON
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-[200px]">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
            <p className="text-sm theme-text-secondary">
              Probing BC API entities for cash flow data...
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 font-medium">{error}</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Entity Probe */}
          <CollapsibleSection
            title="Entity Probe"
            badge={`${entityProbe?.available?.length ?? 0} available / ${entityProbe?.unavailable?.length ?? 0} unavailable`}
            isExpanded={expandedSections['entity-probe'] ?? false}
            onToggle={() => toggleSection('entity-probe')}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
              {Object.entries(entityProbe?.details ?? {}).map(([name, info]: [string, any]) => (
                <div
                  key={name}
                  className={`p-2 rounded-lg text-xs ${
                    info.available
                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                      : 'bg-red-500/10 border border-red-500/20'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${info.available ? 'bg-emerald-400' : 'bg-red-400'}`}
                    />
                    <span className="font-medium theme-text-primary">{name}</span>
                  </div>
                  <p className="theme-text-secondary mt-0.5">{info.description}</p>
                  {info.available && info.count != null && (
                    <p className="theme-text-secondary">
                      {info.count} records | {info.durationMs}ms
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Cash Account Analysis */}
          {cashAccountAnalysis && (
            <CollapsibleSection
              title="Cash Account Analysis"
              badge={`${cashAccountAnalysis.postingCashAccounts?.length ?? 0} posting accounts`}
              isExpanded={expandedSections['cash-accounts'] ?? false}
              onToggle={() => toggleSection('cash-accounts')}
            >
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-2 rounded bg-white/5 border border-white/10">
                    <p className="text-[10px] uppercase tracking-wider theme-text-secondary">
                      Total Cash Accounts
                    </p>
                    <p className="text-lg font-semibold theme-text-primary">
                      {cashAccountAnalysis.totalCashAccounts ?? 0}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-white/5 border border-white/10">
                    <p className="text-[10px] uppercase tracking-wider theme-text-secondary">
                      Posting Only
                    </p>
                    <p className="text-lg font-semibold theme-text-primary">
                      {cashAccountAnalysis.postingCashAccounts?.length ?? 0}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-white/5 border border-white/10">
                    <p className="text-[10px] uppercase tracking-wider theme-text-secondary">
                      Sub-Categories
                    </p>
                    <p className="text-sm font-mono theme-text-primary mt-1">
                      {cashAccountAnalysis.subCategories?.join(', ') || 'none'}
                    </p>
                  </div>
                </div>
                {cashAccountAnalysis.postingCashAccounts?.length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-1 px-2 theme-text-secondary">Number</th>
                        <th className="text-left py-1 px-2 theme-text-secondary">Name</th>
                        <th className="text-left py-1 px-2 theme-text-secondary">Sub-Category</th>
                        <th className="text-right py-1 px-2 theme-text-secondary">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashAccountAnalysis.postingCashAccounts.map((acc: any, i: number) => (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="py-1 px-2 font-mono theme-text-secondary">{acc.number}</td>
                          <td className="py-1 px-2 theme-text-primary">{acc.displayName}</td>
                          <td className="py-1 px-2 theme-text-secondary">{acc.subCategory}</td>
                          <td className="py-1 px-2 text-right font-mono theme-text-primary">
                            {fmt(acc.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Method Comparison */}
          {methodComparison && (
            <CollapsibleSection
              title="Method Comparison"
              badge={`${methodComparison.length} methods`}
              isExpanded={expandedSections['methods'] ?? false}
              onToggle={() => toggleSection('methods')}
            >
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-1 px-2 theme-text-secondary">Method</th>
                      <th className="text-center py-1 px-2 theme-text-secondary">Available</th>
                      <th className="text-right py-1 px-2 theme-text-secondary">Total Cash</th>
                      <th className="text-right py-1 px-2 theme-text-secondary">Accounts</th>
                      <th className="text-right py-1 px-2 theme-text-secondary">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {methodComparison.map((m: any, i: number) => (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="py-1 px-2 theme-text-primary font-medium">{m.method}</td>
                        <td className="py-1 px-2 text-center">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              m.available
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {m.available ? 'YES' : 'NO'}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-right font-mono theme-text-primary">
                          {m.totalCash != null ? fmt(m.totalCash) : '-'}
                        </td>
                        <td className="py-1 px-2 text-right font-mono theme-text-secondary">
                          {m.accountCount ?? '-'}
                        </td>
                        <td className="py-1 px-2 text-right theme-text-secondary">
                          {m.durationMs ?? '-'}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          )}

          {/* Monthly Cash Flow */}
          {monthlyCashFlow && (
            <CollapsibleSection
              title="Monthly Cash Movement"
              badge={`${monthlyCashFlow.byMonth?.length ?? 0} months | Net: ${fmt(monthlyCashFlow.periodNetChange)}`}
              isExpanded={expandedSections['monthly'] ?? true}
              onToggle={() => toggleSection('monthly')}
            >
              <div className="mt-3 space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-1 px-2 theme-text-secondary">Month</th>
                        <th className="text-right py-1 px-2 text-emerald-400">Inflow</th>
                        <th className="text-right py-1 px-2 text-red-400">Outflow</th>
                        <th className="text-right py-1 px-2 theme-text-secondary">Net Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyCashFlow.byMonth?.map((m: any, i: number) => (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="py-1 px-2 font-mono theme-text-primary">{m.month}</td>
                          <td className="py-1 px-2 text-right font-mono text-emerald-400">
                            {fmt(m.inflow)}
                          </td>
                          <td className="py-1 px-2 text-right font-mono text-red-400">
                            -{fmt(m.outflow)}
                          </td>
                          <td
                            className={`py-1 px-2 text-right font-mono ${
                              m.netChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {m.netChange >= 0 ? '+' : ''}
                            {fmt(m.netChange)}
                          </td>
                        </tr>
                      ))}
                      {/* Totals row */}
                      <tr className="border-t border-white/20 font-semibold">
                        <td className="py-1.5 px-2 theme-text-primary">Total</td>
                        <td className="py-1.5 px-2 text-right font-mono text-emerald-400">
                          {fmt(
                            monthlyCashFlow.byMonth?.reduce(
                              (s: number, m: any) => s + (m.inflow || 0),
                              0
                            ) ?? 0
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-red-400">
                          -
                          {fmt(
                            monthlyCashFlow.byMonth?.reduce(
                              (s: number, m: any) => s + (m.outflow || 0),
                              0
                            ) ?? 0
                          )}
                        </td>
                        <td
                          className={`py-1.5 px-2 text-right font-mono ${
                            (monthlyCashFlow.periodNetChange ?? 0) >= 0
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}
                        >
                          {(monthlyCashFlow.periodNetChange ?? 0) >= 0 ? '+' : ''}
                          {fmt(monthlyCashFlow.periodNetChange ?? 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {monthlyCashFlow.byDocumentType?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium theme-text-primary mb-2">
                      By Document Type
                    </h4>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-1 px-2 theme-text-secondary">Type</th>
                          <th className="text-right py-1 px-2 theme-text-secondary">Count</th>
                          <th className="text-right py-1 px-2 theme-text-secondary">Debit</th>
                          <th className="text-right py-1 px-2 theme-text-secondary">Credit</th>
                          <th className="text-right py-1 px-2 theme-text-secondary">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyCashFlow.byDocumentType.map((dt: any, i: number) => (
                          <tr key={i} className="hover:bg-white/5">
                            <td className="py-1 px-2 theme-text-primary">{dt.documentType}</td>
                            <td className="py-1 px-2 text-right font-mono theme-text-secondary">
                              {dt.count}
                            </td>
                            <td className="py-1 px-2 text-right font-mono text-emerald-400">
                              {fmt(dt.totalDebit)}
                            </td>
                            <td className="py-1 px-2 text-right font-mono text-red-400">
                              {fmt(dt.totalCredit)}
                            </td>
                            <td
                              className={`py-1 px-2 text-right font-mono ${dt.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                            >
                              {fmt(dt.net)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Cash Runway */}
          {cashRunway && (
            <CollapsibleSection
              title="Cash Runway"
              badge={cashRunway.runwayStatus}
              isExpanded={expandedSections['runway'] ?? false}
              onToggle={() => toggleSection('runway')}
            >
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2 rounded bg-white/5 border border-white/10">
                  <p className="text-[10px] uppercase tracking-wider theme-text-secondary">
                    Current Cash
                  </p>
                  <p className="text-sm font-semibold text-emerald-400">
                    {fmt(cashRunway.currentCash)}
                  </p>
                </div>
                <div className="p-2 rounded bg-white/5 border border-white/10">
                  <p className="text-[10px] uppercase tracking-wider theme-text-secondary">
                    Monthly Net
                  </p>
                  <p
                    className={`text-sm font-semibold ${cashRunway.monthlyNetChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {fmt(cashRunway.monthlyNetChange)}
                  </p>
                </div>
                <div className="p-2 rounded bg-white/5 border border-white/10">
                  <p className="text-[10px] uppercase tracking-wider theme-text-secondary">
                    Runway
                  </p>
                  <p className="text-sm font-semibold theme-text-primary">
                    {cashRunway.runwayMonths != null ? `${cashRunway.runwayMonths} months` : 'N/A'}
                  </p>
                </div>
                <div className="p-2 rounded bg-white/5 border border-white/10">
                  <p className="text-[10px] uppercase tracking-wider theme-text-secondary">
                    Status
                  </p>
                  <p
                    className={`text-sm font-semibold ${
                      cashRunway.runwayStatus?.includes('Healthy') ||
                      cashRunway.runwayStatus?.includes('positive')
                        ? 'text-emerald-400'
                        : cashRunway.runwayStatus?.includes('Warning')
                          ? 'text-red-400'
                          : 'text-amber-400'
                    }`}
                  >
                    {cashRunway.runwayStatus}
                  </p>
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Raw JSON */}
          <CollapsibleSection
            title="Raw JSON Response"
            isExpanded={expandedSections['raw-json'] ?? false}
            onToggle={() => toggleSection('raw-json')}
          >
            <pre className="mt-3 p-4 rounded-lg bg-black/20 overflow-x-auto text-xs font-mono theme-text-primary max-h-[400px] overflow-y-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </CollapsibleSection>
        </>
      )}
    </div>
  )
}

// ── BS Display Helpers ────────────────────────────────────────────────────────

const BS_MAIN_SECTIONS = ['Assets', 'Liabilities', 'Equity']

function getBSIndentClasses(level: number): string {
  switch (level) {
    case 0:
      return ''
    case 1:
      return 'pl-4'
    case 2:
      return 'pl-8'
    case 3:
      return 'pl-12'
    case 4:
      return 'pl-16'
    default:
      return 'pl-20'
  }
}

function getBSLineLeftOffset(nestingLevel: number): number {
  return 24 + nestingLevel * 16 + 24
}

interface BSDisplayRow {
  id: string
  type: 'header' | 'subheader' | 'account' | 'subtotal' | 'total' | 'final-total' | 'spacer'
  name: string
  amount?: number
  nestingLevel: number
  isCollapsible?: boolean
  sectionKey?: string
  childCount?: number
}

function buildBSDisplayRows(lines: any[]): BSDisplayRow[] {
  const rows: BSDisplayRow[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const indent = line.indentation ?? 0

    if (line.lineType === 'spacer') {
      rows.push({ id: `spacer-${i}`, type: 'spacer', name: '', nestingLevel: 0 })
      continue
    }
    if (line.lineType === 'computed') {
      rows.push({
        id: `computed-${i}`,
        type: 'final-total',
        name: line.display,
        amount: line.balance,
        nestingLevel: 0,
      })
      continue
    }
    if (line.lineType === 'header') {
      let totalAmount: number | undefined
      let childCount = 0
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j]
        const nextIndent = next.indentation ?? 0
        if (nextIndent <= indent && next.lineType !== 'header' && next.lineType !== 'spacer') {
          if (next.lineType === 'total') totalAmount = next.balance
          break
        }
        if (nextIndent > indent && (next.lineType === 'detail' || next.lineType === 'header')) {
          childCount++
        }
      }
      const sectionKey = line._accountNumber || `section-${i}`
      const isMainSection = indent === 0 && BS_MAIN_SECTIONS.some((s) => line._category === s)
      rows.push({
        id: `header-${sectionKey}`,
        type: isMainSection ? 'header' : 'subheader',
        name: line.display,
        amount: totalAmount,
        nestingLevel: indent,
        isCollapsible: childCount > 0,
        sectionKey,
        childCount,
      })
      continue
    }
    if (line.lineType === 'total') {
      rows.push({
        id: `total-${line._accountNumber || i}`,
        type: indent === 0 ? 'total' : 'subtotal',
        name: line.display,
        amount: line.balance,
        nestingLevel: indent,
      })
      continue
    }
    rows.push({
      id: `account-${line._accountNumber || i}`,
      type: 'account',
      name: line.display,
      amount: line.balance,
      nestingLevel: indent,
    })
  }
  return rows
}

// ── BS Preview Section ────────────────────────────────────────────────────────

function BSPreviewSection({ connectionId, endDate }: { connectionId: string; endDate: string }) {
  const [bsData, setBsData] = useState<any>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [fetchedDate, setFetchedDate] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set<string>())

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const fetchBS = useCallback(async () => {
    if (!connectionId) return
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ connectionId, mode: 'bs' })
    if (endDate) params.set('endDate', endDate)

    const t0 = Date.now()
    try {
      const res = await fetch(`/api/providers/dynamics/balance-sheet-test?${params}`)
      const json = await res.json()
      setDurationMs(Date.now() - t0)
      if (!res.ok) {
        setError(json.error || json.details || `HTTP ${res.status}`)
      } else {
        setBsData(json.data)
        setDebugInfo(json._debug)
        setFetchedDate(endDate)
        const mainKeys = new Set<string>()
        for (const line of json.data?.lines || []) {
          if (line.lineType === 'header' && (line.indentation ?? 0) === 0 && line._accountNumber) {
            mainKeys.add(line._accountNumber)
          }
        }
        setExpandedSections(mainKeys)
      }
    } catch (err) {
      setDurationMs(Date.now() - t0)
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [connectionId, endDate])

  useEffect(() => {
    if (!bsData || loading) return
    if (fetchedDate !== endDate) fetchBS()
  }, [endDate, bsData, loading, fetchedDate, fetchBS])

  const currency = bsData?.currency || 'USD'
  const totals = bsData?.totals
  const lines: any[] = bsData?.lines || []
  const displayRows = useMemo(() => buildBSDisplayRows(lines), [lines])

  const visibleRows = useMemo(() => {
    const result: BSDisplayRow[] = []
    const collapsedStack: Array<{ indent: number }> = []
    for (const row of displayRows) {
      const indent = row.nestingLevel
      while (
        collapsedStack.length > 0 &&
        collapsedStack[collapsedStack.length - 1].indent >= indent
      ) {
        collapsedStack.pop()
      }
      if (collapsedStack.length > 0) continue
      result.push(row)
      if (
        (row.type === 'header' || row.type === 'subheader') &&
        row.isCollapsible &&
        row.sectionKey &&
        !expandedSections.has(row.sectionKey)
      ) {
        collapsedStack.push({ indent })
      }
    }
    return result
  }, [displayRows, expandedSections])

  const isBalanced = totals
    ? Math.abs(totals.totalAssets - totals.totalLiabilities - totals.totalEquity) < 1
    : true
  const difference = totals ? totals.totalAssets - totals.totalLiabilities - totals.totalEquity : 0

  const fmtDate = (d: string) =>
    d
      ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : ''

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={fetchBS}
          disabled={!connectionId || loading}
          className="px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading BS...' : bsData ? 'Reload BS' : 'Load Balance Sheet'}
        </button>
        {durationMs != null && <span className="text-xs theme-text-secondary">{durationMs}ms</span>}
        {bsData?.source && (
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
            Source: {bsData.source}
          </span>
        )}
        {debugInfo && (
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
          >
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </button>
        )}
      </div>

      {showDebug && debugInfo && (
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-mono space-y-2">
          <p className="text-blue-400 font-semibold mb-2">Debug: Balance Sheet Analysis</p>
          <pre className="overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap theme-text-secondary">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 font-medium">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-[300px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
        </div>
      )}

      {!loading && bsData && (
        <>
          {totals && (
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              {[
                { label: 'Total Assets', value: totals.totalAssets, color: 'text-emerald-400' },
                {
                  label: 'Total Liabilities',
                  value: totals.totalLiabilities,
                  color: 'text-red-400',
                },
                { label: 'Total Equity', value: totals.totalEquity, color: 'text-blue-400' },
                {
                  label: 'Net Income',
                  value: totals.netIncome ?? 0,
                  color: (totals.netIncome ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
                },
                { label: 'L + E', value: totals.totalLiabilities + totals.totalEquity, color: '' },
                {
                  label: 'A - L - E',
                  value: difference,
                  color: isBalanced ? 'text-emerald-400' : 'text-red-400',
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="glass-luxury-card rounded-xl p-4 border border-gray-200/10"
                >
                  <p className="text-[10px] uppercase tracking-wider theme-text-secondary font-medium mb-1">
                    {card.label}
                  </p>
                  <p className={`text-lg font-semibold ${card.color || 'theme-text-primary'}`}>
                    {formatCompactCurrency(card.value, currency)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <Card className="glass-luxury-card border border-gray-200/10 overflow-hidden gap-0">
            <CardHeader className="pb-3">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-light font-serif italic theme-text-primary">
                  Balance Sheet
                </h2>
                {bsData.companyName && (
                  <p className="text-sm theme-text-secondary">{bsData.companyName}</p>
                )}
                {endDate && (
                  <div className="flex items-center justify-center gap-2 text-xs theme-text-secondary">
                    <span className="font-serif italic">as of</span>
                    <span>{fmtDate(endDate)}</span>
                  </div>
                )}
                <div className="flex items-center justify-center pt-1">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      isBalanced
                        ? 'bg-green-500/10 text-green-500 dark:bg-green-500/20 dark:text-green-400'
                        : 'bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400'
                    )}
                  >
                    {isBalanced
                      ? 'Balanced'
                      : `Difference: ${formatPnLCurrency(difference, currency)}`}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full max-w-5xl mx-auto">
                  <thead>
                    <tr className="border-b border-gray-200/10">
                      <th className="text-left px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider">
                        Account
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider">
                        Balance ({getCurrencySymbol(currency)})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      if (row.type === 'spacer') {
                        return (
                          <tr key={row.id}>
                            <td colSpan={2} className="py-2"></td>
                          </tr>
                        )
                      }
                      const isExpanded = row.sectionKey
                        ? expandedSections.has(row.sectionKey)
                        : false
                      const isCollapsibleRow = !!row.isCollapsible
                      const isMainHeader =
                        row.type === 'header' &&
                        BS_MAIN_SECTIONS.some((s) =>
                          row.name.toUpperCase().includes(s.toUpperCase())
                        )
                      const showAmount =
                        row.type === 'account' ||
                        row.type === 'subtotal' ||
                        row.type === 'total' ||
                        row.type === 'final-total' ||
                        (row.type === 'subheader' && row.amount !== undefined && !isExpanded) ||
                        (row.type === 'header' && isCollapsibleRow && !isExpanded)
                      const needsLine =
                        row.type === 'subtotal' ||
                        row.type === 'total' ||
                        row.type === 'final-total'

                      return (
                        <React.Fragment key={row.id}>
                          {needsLine && (
                            <tr>
                              <td colSpan={2} className="p-0 h-0">
                                <div
                                  className="h-px bg-gray-400 dark:bg-gray-500"
                                  style={{
                                    marginLeft: getBSLineLeftOffset(row.nestingLevel),
                                    marginRight: 24,
                                  }}
                                />
                              </td>
                            </tr>
                          )}
                          <tr
                            className={cn(
                              'transition-colors',
                              isMainHeader &&
                                'border-t-2 border-b-2 border-gray-400 dark:border-gray-600',
                              isCollapsibleRow &&
                                'cursor-pointer hover:bg-gray-100/40 dark:hover:bg-gray-800/40'
                            )}
                            onClick={
                              isCollapsibleRow ? () => toggleSection(row.sectionKey!) : undefined
                            }
                          >
                            <td
                              className={cn(
                                'px-6 py-2.5',
                                row.type === 'header' && 'font-semibold',
                                (row.type === 'subtotal' || row.type === 'total') && 'font-bold',
                                row.type === 'final-total' && 'font-bold'
                              )}
                            >
                              <div
                                className={cn(
                                  'flex items-center',
                                  getBSIndentClasses(row.nestingLevel)
                                )}
                              >
                                <div className="flex items-center gap-1">
                                  {isCollapsibleRow ? (
                                    <div className="flex items-center w-5 flex-shrink-0">
                                      {isExpanded ? (
                                        <ChevronDown className="w-4 h-4 theme-text-secondary" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 theme-text-secondary" />
                                      )}
                                    </div>
                                  ) : (
                                    <div className="w-5 flex-shrink-0" />
                                  )}
                                  <span
                                    className={cn(
                                      'text-sm',
                                      row.type === 'header' && 'theme-text-primary font-semibold',
                                      row.type === 'subheader' && 'theme-text-primary',
                                      row.type === 'account' && 'theme-text-secondary',
                                      (row.type === 'subtotal' || row.type === 'total') &&
                                        'theme-text-primary font-bold',
                                      row.type === 'final-total' && 'theme-text-primary font-bold'
                                    )}
                                  >
                                    {row.name}
                                  </span>
                                  {isCollapsibleRow &&
                                    !isExpanded &&
                                    row.childCount !== undefined &&
                                    row.childCount > 0 && (
                                      <span className="text-xs theme-text-secondary ml-1">
                                        ({row.childCount}{' '}
                                        {row.childCount === 1 ? 'account' : 'accounts'})
                                      </span>
                                    )}
                                </div>
                              </div>
                            </td>
                            <td
                              className={cn(
                                'px-6 py-2.5 text-right',
                                (row.type === 'subtotal' || row.type === 'total') && 'font-bold',
                                row.type === 'final-total' && 'font-bold'
                              )}
                            >
                              {showAmount && row.amount !== undefined && (
                                <span
                                  className={cn(
                                    'text-sm font-mono',
                                    row.amount >= 0 ? 'theme-text-primary' : 'text-theme-red',
                                    (row.type === 'subtotal' || row.type === 'total') &&
                                      'font-medium',
                                    (row.type === 'total' || row.type === 'final-total') &&
                                      'font-bold',
                                    row.type === 'final-total' &&
                                      row.amount >= 0 &&
                                      'text-theme-green',
                                    row.type === 'final-total' && row.amount < 0 && 'text-theme-red'
                                  )}
                                >
                                  {formatStatementAmount(row.amount, currency)}
                                </span>
                              )}
                            </td>
                          </tr>
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-3 border-t border-gray-200/10">
                <div className="flex items-center justify-between text-xs theme-text-secondary">
                  <span>Source: {bsData.source || 'GL entries'}</span>
                  <span>
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// ── BS Diagnostics Section ────────────────────────────────────────────────────

function BSDiagnosticsSection({
  connectionId,
  startDate,
  endDate,
}: {
  connectionId: string
  startDate: string
  endDate: string
}) {
  const [results, setResults] = useState<Record<string, any>>({})

  const runTest = useCallback(
    async (endpoint: { id: string; path: string; usesDateRange: boolean }) => {
      if (!connectionId) return
      setResults((prev) => ({ ...prev, [endpoint.id]: { status: 'loading' } }))

      const params = new URLSearchParams({ connectionId })
      if (endDate) params.set('endDate', endDate)

      const url = `${endpoint.path}?${params.toString()}`
      const t0 = Date.now()

      try {
        const response = await fetch(url)
        const json = await response.json()
        if (!response.ok) {
          setResults((prev) => ({
            ...prev,
            [endpoint.id]: {
              status: 'error',
              error: json.error || json.details || `HTTP ${response.status}`,
              data: json,
              duration: Date.now() - t0,
            },
          }))
        } else {
          setResults((prev) => ({
            ...prev,
            [endpoint.id]: { status: 'success', data: json, duration: Date.now() - t0 },
          }))
        }
      } catch (err) {
        setResults((prev) => ({
          ...prev,
          [endpoint.id]: {
            status: 'error',
            error: err instanceof Error ? err.message : 'Network error',
            duration: Date.now() - t0,
          },
        }))
      }
    },
    [connectionId, endDate]
  )

  return (
    <div className="glass-luxury-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium theme-text-primary">Balance Sheet Diagnostic</h2>
          <p className="text-sm theme-text-secondary mt-1">
            7 tests comparing different BS computation methods. Uses cumulative GL entries
            (point-in-time snapshot), range-based chart structure walk, and Net Income injection
            into Equity to produce a balanced BS (A-L-E=0).
          </p>
        </div>
        <button
          onClick={() =>
            runTest({
              id: 'balance-sheet-test',
              path: '/api/providers/dynamics/balance-sheet-test',
              usesDateRange: true,
            })
          }
          disabled={!connectionId || results['balance-sheet-test']?.status === 'loading'}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {results['balance-sheet-test']?.status === 'loading' ? 'Testing...' : 'Run Diagnostic'}
        </button>
      </div>

      {results['balance-sheet-test']?.status === 'loading' && (
        <div className="flex items-center justify-center h-[100px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )}

      {results['balance-sheet-test']?.status === 'error' && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 font-medium">{results['balance-sheet-test'].error}</p>
        </div>
      )}

      {results['balance-sheet-test']?.status === 'success' &&
        results['balance-sheet-test'].data?.tests && (
          <div className="space-y-3">
            {results['balance-sheet-test'].data.tests.map((t: any) => (
              <DiagnosticTestCard key={t.id} test={t} />
            ))}
          </div>
        )}
    </div>
  )
}
