'use client'

import React, { useState, useCallback } from 'react'
import { useBCOAuthDev } from '../_shared/BCOAuthDevLayout'

// ── Types ────────────────────────────────────────────────────────────────────

interface DiagResult {
  status: 'idle' | 'loading' | 'success' | 'error'
  data?: any
  error?: string
  durationMs?: number
}

const fmt = (v: number | null | undefined) => {
  if (v == null) return '-'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AgedARAPDiagnosticPage() {
  const { connectionId } = useBCOAuthDev()
  const [arResult, setArResult] = useState<DiagResult>({ status: 'idle' })
  const [apResult, setApResult] = useState<DiagResult>({ status: 'idle' })
  const [bucketResult, setBucketResult] = useState<DiagResult>({ status: 'idle' })
  const [activeTab, setActiveTab] = useState<'ar' | 'ap' | 'buckets'>('ar')

  const runDiagnostic = useCallback(
    async (type: 'ar' | 'ap') => {
      if (!connectionId) return
      const setter = type === 'ar' ? setArResult : setApResult
      setter({ status: 'loading' })

      const path =
        type === 'ar'
          ? '/api/providers/dynamics/aged-receivables-test'
          : '/api/providers/dynamics/aged-payables-test'

      const t0 = Date.now()
      try {
        const res = await fetch(`${path}?connectionId=${connectionId}`)
        const json = await res.json()
        const durationMs = Date.now() - t0
        if (!res.ok) {
          setter({
            status: 'error',
            error: json.error || `HTTP ${res.status}`,
            data: json,
            durationMs,
          })
        } else {
          setter({ status: 'success', data: json.data, durationMs })
        }
      } catch (err) {
        setter({
          status: 'error',
          error: err instanceof Error ? err.message : 'Network error',
          durationMs: Date.now() - t0,
        })
      }
    },
    [connectionId]
  )

  const runBucketResearch = useCallback(async () => {
    if (!connectionId) return
    setBucketResult({ status: 'loading' })
    const t0 = Date.now()
    try {
      const res = await fetch(
        `/api/providers/dynamics/aging-bucket-test?connectionId=${connectionId}`
      )
      const json = await res.json()
      const durationMs = Date.now() - t0
      if (!res.ok) {
        setBucketResult({
          status: 'error',
          error: json.error || `HTTP ${res.status}`,
          data: json,
          durationMs,
        })
      } else {
        setBucketResult({ status: 'success', data: json.data, durationMs })
      }
    } catch (err) {
      setBucketResult({
        status: 'error',
        error: err instanceof Error ? err.message : 'Network error',
        durationMs: Date.now() - t0,
      })
    }
  }, [connectionId])

  const runBoth = useCallback(async () => {
    await Promise.all([runDiagnostic('ar'), runDiagnostic('ap')])
  }, [runDiagnostic])

  const currentResult = activeTab === 'ar' ? arResult : activeTab === 'ap' ? apResult : bucketResult

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-luxury-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold theme-text-primary">
              Aged AR / AP — Endpoint Probe Diagnostic
            </h2>
            <p className="text-sm theme-text-secondary mt-1">
              Tests multiple BC API entity names and alternative approaches to find which endpoints
              are accessible. Compares singular vs plural names, report entities vs CRUD entities,
              stable v2.0 vs beta Finance Reports API.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => runDiagnostic('ar')}
              disabled={!connectionId || arResult.status === 'loading'}
              className="px-4 py-2 text-sm rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50"
            >
              {arResult.status === 'loading' ? 'Probing AR...' : 'Probe AR'}
            </button>
            <button
              onClick={() => runDiagnostic('ap')}
              disabled={!connectionId || apResult.status === 'loading'}
              className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
            >
              {apResult.status === 'loading' ? 'Probing AP...' : 'Probe AP'}
            </button>
            <button
              onClick={runBoth}
              disabled={
                !connectionId || arResult.status === 'loading' || apResult.status === 'loading'
              }
              className="px-6 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors disabled:opacity-50"
            >
              Probe Both
            </button>
            <div className="w-px bg-white/20 mx-1" />
            <button
              onClick={runBucketResearch}
              disabled={!connectionId || bucketResult.status === 'loading'}
              className="px-5 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50"
            >
              {bucketResult.status === 'loading' ? 'Researching...' : 'Research Aging Buckets'}
            </button>
          </div>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10 w-fit">
          {[
            { id: 'ar' as const, label: 'Receivables Probes', color: 'bg-amber-600' },
            { id: 'ap' as const, label: 'Payables Probes', color: 'bg-red-600' },
            { id: 'buckets' as const, label: 'Aging Bucket Research', color: 'bg-blue-600' },
          ].map((tab) => {
            const result = tab.id === 'ar' ? arResult : tab.id === 'ap' ? apResult : bucketResult
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.id
                    ? `${tab.color} text-white`
                    : 'theme-text-secondary hover:bg-white/5'
                }`}
              >
                {tab.label}
                {result.status === 'success' && result.data && (
                  <span className="ml-2 text-xs opacity-75">
                    {result.data.successCount}/{result.data.totalTests || result.data.totalProbes}{' '}
                    passed
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {currentResult.status === 'error' && (
        <div className="glass-luxury-card p-6 border border-red-500/20">
          <p className="text-red-400 font-medium">{currentResult.error}</p>
          {currentResult.data && (
            <pre className="mt-2 text-xs font-mono theme-text-secondary max-h-40 overflow-auto">
              {JSON.stringify(currentResult.data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Loading */}
      {currentResult.status === 'loading' && (
        <div className="glass-luxury-card p-12 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span className="theme-text-secondary">
              Running {activeTab === 'ar' ? '10 receivable' : '10 payable'} endpoint probes...
            </span>
          </div>
        </div>
      )}

      {/* Results */}
      {currentResult.status === 'success' &&
        currentResult.data &&
        (activeTab === 'buckets' ? (
          <BucketResearchResults data={currentResult.data} />
        ) : (
          <ProbeResults data={currentResult.data} type={activeTab} />
        ))}
    </div>
  )
}

// ── Probe Results Display ────────────────────────────────────────────────────

function ProbeResults({ data, type }: { data: any; type: 'ar' | 'ap' }) {
  const [expandedProbes, setExpandedProbes] = useState<Record<string, boolean>>({})
  const [viewModes, setViewModes] = useState<Record<string, 'summary' | 'records' | 'json'>>({})

  const toggleExpand = (id: string) => setExpandedProbes((prev) => ({ ...prev, [id]: !prev[id] }))

  const setViewMode = (id: string, mode: 'summary' | 'records' | 'json') =>
    setViewModes((prev) => ({ ...prev, [id]: mode }))

  return (
    <div className="space-y-4">
      {/* Overview Banner */}
      <div className="glass-luxury-card p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs theme-text-secondary mb-1">Company</p>
            <p className="font-medium theme-text-primary">{data.companyName || '—'}</p>
          </div>
          <div>
            <p className="text-xs theme-text-secondary mb-1">Total Probes</p>
            <p className="font-mono font-medium theme-text-primary">{data.totalProbes}</p>
          </div>
          <div>
            <p className="text-xs theme-text-secondary mb-1">Succeeded</p>
            <p className="font-mono font-medium text-emerald-400">{data.successCount}</p>
          </div>
          <div>
            <p className="text-xs theme-text-secondary mb-1">Failed</p>
            <p className="font-mono font-medium text-red-400">{data.failedCount}</p>
          </div>
        </div>
      </div>

      {/* Quick Summary Table */}
      <div className="glass-luxury-card p-6">
        <h3 className="text-lg font-medium theme-text-primary mb-4">Probe Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 theme-text-secondary font-medium">Status</th>
                <th className="text-left py-2 px-3 theme-text-secondary font-medium">Endpoint</th>
                <th className="text-right py-2 px-3 theme-text-secondary font-medium">Records</th>
                <th className="text-right py-2 px-3 theme-text-secondary font-medium">Fields</th>
                <th className="text-right py-2 px-3 theme-text-secondary font-medium">Time</th>
                <th className="text-left py-2 px-3 theme-text-secondary font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {(data.summary || []).map((s: any) => (
                <tr
                  key={s.id}
                  className={`border-b border-white/5 hover:bg-white/5 cursor-pointer ${
                    s.success ? '' : 'opacity-60'
                  }`}
                  onClick={() => toggleExpand(s.id)}
                >
                  <td className="py-2 px-3">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        s.success ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                  </td>
                  <td className="py-2 px-3 font-mono text-xs theme-text-primary">{s.label}</td>
                  <td className="py-2 px-3 text-right font-mono theme-text-primary">
                    {s.recordCount}
                  </td>
                  <td className="py-2 px-3 text-right font-mono theme-text-secondary">
                    {s.fieldCount}
                  </td>
                  <td className="py-2 px-3 text-right font-mono theme-text-secondary">
                    {s.durationMs}ms
                  </td>
                  <td className="py-2 px-3 text-xs text-red-400 truncate max-w-[300px]">
                    {s.error || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Probe Cards */}
      {(data.probes || []).map((probe: any) => {
        const isExpanded = expandedProbes[probe.id]
        const viewMode = viewModes[probe.id] || 'summary'

        return (
          <div
            key={probe.id}
            className={`glass-luxury-card overflow-hidden border ${
              probe.success ? 'border-emerald-500/20' : 'border-red-500/20'
            }`}
          >
            {/* Probe Header */}
            <button
              onClick={() => toggleExpand(probe.id)}
              className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    probe.success ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                <div className="text-left">
                  <span className="font-medium theme-text-primary">{probe.label}</span>
                  <p className="text-xs theme-text-secondary mt-0.5">{probe.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {probe.success && (
                  <span className="px-2 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-400">
                    {probe.recordCount} records
                  </span>
                )}
                <span className="text-xs theme-text-secondary">{probe.durationMs}ms</span>
                <span className="theme-text-secondary">{isExpanded ? '▾' : '▸'}</span>
              </div>
            </button>

            {/* Error inline */}
            {!probe.success && probe.error && (
              <div className="mx-5 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400 font-mono">{probe.error}</p>
              </div>
            )}

            {/* Expanded Content */}
            {isExpanded && probe.success && (
              <div className="px-5 pb-5 space-y-4">
                {/* View mode toggles */}
                <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10 w-fit">
                  {['summary', 'records', 'json'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(probe.id, mode as any)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                        viewMode === mode
                          ? 'bg-blue-600 text-white'
                          : 'theme-text-secondary hover:bg-white/5'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                  <button
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(probe, null, 2))}
                    className="px-3 py-1.5 text-xs rounded-md border border-white/10 theme-text-secondary hover:bg-white/5"
                  >
                    Copy
                  </button>
                </div>

                {viewMode === 'summary' && (
                  <div className="space-y-4">
                    {/* Fields */}
                    <div>
                      <p className="text-sm font-medium theme-text-primary mb-2">
                        Fields ({probe.fields.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {probe.fields.map((f: string) => (
                          <span
                            key={f}
                            className={`px-2 py-1 text-xs rounded font-mono ${
                              f === 'currencyCode'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : f.toLowerCase().includes('amount') ||
                                    f.toLowerCase().includes('balance') ||
                                    f.toLowerCase().includes('due')
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : f.toLowerCase().includes('period')
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-white/10 theme-text-secondary'
                            }`}
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Sample Record */}
                    {probe.sampleRecord && (
                      <div>
                        <p className="text-sm font-medium theme-text-primary mb-2">Sample Record</p>
                        <pre className="p-3 rounded-lg bg-black/20 text-xs font-mono theme-text-secondary overflow-x-auto max-h-60 overflow-y-auto">
                          {JSON.stringify(probe.sampleRecord, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {viewMode === 'records' && (
                  <div>
                    {probe.records.length === 0 ? (
                      <p className="text-sm theme-text-secondary italic">No records returned</p>
                    ) : (
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-[var(--theme-bg)]">
                            <tr className="border-b border-white/10">
                              <th className="text-left py-2 px-2 theme-text-secondary font-medium">
                                #
                              </th>
                              {probe.fields.map((f: string) => (
                                <th
                                  key={f}
                                  className={`text-left py-2 px-2 font-medium whitespace-nowrap ${
                                    f === 'currencyCode'
                                      ? 'text-amber-400'
                                      : f.toLowerCase().includes('amount')
                                        ? 'text-emerald-400'
                                        : 'theme-text-secondary'
                                  }`}
                                >
                                  {f}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {probe.records.map((rec: any, i: number) => (
                              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                <td className="py-1.5 px-2 font-mono theme-text-secondary">
                                  {i + 1}
                                </td>
                                {probe.fields.map((f: string) => {
                                  const val = rec[f]
                                  const isNum = typeof val === 'number'
                                  return (
                                    <td
                                      key={f}
                                      className={`py-1.5 px-2 font-mono whitespace-nowrap ${
                                        isNum ? 'text-right' : 'text-left'
                                      } ${
                                        f === 'currencyCode'
                                          ? 'text-amber-400'
                                          : 'theme-text-primary'
                                      }`}
                                    >
                                      {isNum
                                        ? fmt(val)
                                        : val === null || val === undefined
                                          ? '—'
                                          : String(val).length > 40
                                            ? String(val).slice(0, 40) + '...'
                                            : String(val)}
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {viewMode === 'json' && (
                  <pre className="p-4 rounded-lg bg-black/20 text-xs font-mono theme-text-secondary overflow-x-auto max-h-[600px] overflow-y-auto whitespace-pre-wrap">
                    {JSON.stringify(probe.records, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Aging Bucket Research Results ────────────────────────────────────────────

function BucketResearchResults({ data }: { data: any }) {
  const [expandedTests, setExpandedTests] = useState<Record<string, boolean>>({})

  const toggleExpand = (id: string) => setExpandedTests((prev) => ({ ...prev, [id]: !prev[id] }))

  const strategyColors: Record<string, string> = {
    periodLengthFilter: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    openInvoices: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    periodLabels: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    crossReference: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    ledgerEntries: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    agedAsOfDate: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  }

  return (
    <div className="space-y-4">
      {/* Overview */}
      <div className="glass-luxury-card p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs theme-text-secondary mb-1">Company</p>
            <p className="font-medium theme-text-primary">{data.companyName || '—'}</p>
          </div>
          <div>
            <p className="text-xs theme-text-secondary mb-1">Total Tests</p>
            <p className="font-mono font-medium theme-text-primary">{data.totalTests}</p>
          </div>
          <div>
            <p className="text-xs theme-text-secondary mb-1">Succeeded</p>
            <p className="font-mono font-medium text-emerald-400">{data.successCount}</p>
          </div>
          <div>
            <p className="text-xs theme-text-secondary mb-1">Strategies</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {(data.strategies || []).map((s: string) => (
                <span
                  key={s}
                  className={`px-2 py-0.5 text-xs rounded border ${strategyColors[s] || 'bg-white/10 theme-text-secondary'}`}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary table */}
      <div className="glass-luxury-card p-6">
        <h3 className="text-lg font-medium theme-text-primary mb-4">Test Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 theme-text-secondary font-medium">Status</th>
                <th className="text-left py-2 px-3 theme-text-secondary font-medium">Test</th>
                <th className="text-left py-2 px-3 theme-text-secondary font-medium">Strategy</th>
                <th className="text-right py-2 px-3 theme-text-secondary font-medium">Time</th>
                <th className="text-left py-2 px-3 theme-text-secondary font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {(data.summary || []).map((s: any) => (
                <tr
                  key={s.id}
                  className={`border-b border-white/5 hover:bg-white/5 cursor-pointer ${s.success ? '' : 'opacity-60'}`}
                  onClick={() => toggleExpand(s.id)}
                >
                  <td className="py-2 px-3">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${s.success ? 'bg-emerald-500' : 'bg-red-500'}`}
                    />
                  </td>
                  <td className="py-2 px-3 font-mono text-xs theme-text-primary">{s.label}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 text-xs rounded border ${strategyColors[s.strategy] || 'bg-white/10 theme-text-secondary'}`}
                    >
                      {s.strategy}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono theme-text-secondary">
                    {s.durationMs}ms
                  </td>
                  <td className="py-2 px-3 text-xs text-red-400 truncate max-w-[300px]">
                    {s.error || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual test cards */}
      {(data.tests || []).map((t: any) => {
        const isExpanded = expandedTests[t.id]
        return (
          <div
            key={t.id}
            className={`glass-luxury-card overflow-hidden border ${t.success ? 'border-emerald-500/20' : 'border-red-500/20'}`}
          >
            <button
              onClick={() => toggleExpand(t.id)}
              className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${t.success ? 'bg-emerald-500' : 'bg-red-500'}`}
                />
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium theme-text-primary">{t.label}</span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded border ${strategyColors[t.strategy] || 'bg-white/10'}`}
                    >
                      {t.strategy}
                    </span>
                  </div>
                  <p className="text-xs theme-text-secondary mt-0.5">{t.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs theme-text-secondary">{t.durationMs}ms</span>
                <span className="theme-text-secondary">{isExpanded ? '▾' : '▸'}</span>
              </div>
            </button>

            {!t.success && t.error && (
              <div className="mx-5 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400 font-mono">{t.error}</p>
              </div>
            )}

            {isExpanded && t.success && (
              <div className="px-5 pb-5 space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(t.result, null, 2))}
                    className="px-3 py-1.5 text-xs rounded-md border border-white/10 theme-text-secondary hover:bg-white/5"
                  >
                    Copy Result
                  </button>
                </div>
                <pre className="p-4 rounded-lg bg-black/20 text-xs font-mono theme-text-secondary overflow-x-auto max-h-[600px] overflow-y-auto whitespace-pre-wrap">
                  {JSON.stringify(t.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
