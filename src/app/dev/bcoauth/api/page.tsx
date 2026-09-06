'use client'

import React, { useState, useCallback } from 'react'
import { useBCOAuthDev } from '../_shared/BCOAuthDevLayout'
import { fmt, LineItemsTable, EndpointDef } from '../_shared/components'

// ── Endpoint Definitions ──────────────────────────────────────────────────────

const ENDPOINTS: EndpointDef[] = [
  {
    id: 'income-statement-test',
    label: 'P&L Filter Diagnostic',
    description:
      'Tests native BC hierarchy (Begin/End-Total) and date filter syntaxes on accounts CRUD entity.',
    path: '/api/providers/dynamics/income-statement-test',
    usesDateRange: true,
    dateRangeMode: 'range',
  },
  {
    id: 'balance-sheet-test',
    label: 'BS Filter Diagnostic',
    description:
      'Tests native BC hierarchy (Begin/End-Total) and GL cumulative balances for Balance Sheet.',
    path: '/api/providers/dynamics/balance-sheet-test',
    usesDateRange: true,
    dateRangeMode: 'asOf',
  },
  {
    id: 'income-statement',
    label: 'Income Statement (P&L)',
    description: 'Tries incomeStatement report entity first, falls back to accounts CRUD entity.',
    path: '/api/providers/dynamics/income-statement',
    usesDateRange: true,
    dateRangeMode: 'range',
  },
  {
    id: 'balance-sheet',
    label: 'Balance Sheet',
    description: 'Tries balanceSheet report entity first, falls back to accounts CRUD entity.',
    path: '/api/providers/dynamics/balance-sheet',
    usesDateRange: true,
    dateRangeMode: 'asOf',
  },
  {
    id: 'financial-summary',
    label: 'Financial Summary',
    description: 'Uses CRUD entities to compute revenue, expenses, cash, AR, AP, health score.',
    path: '/api/providers/dynamics/financial-summary',
    usesDateRange: true,
    dateRangeMode: 'range',
  },
]

const ALL_API_ENDPOINTS: Array<{
  id: string
  label: string
  description: string
  path: string
  dateRangeMode?: 'range' | 'asOf' | 'none'
}> = [
  {
    id: 'diag-company-info',
    label: 'Company Info',
    description: 'companyInformation entity — name, currency, country',
    path: '/api/providers/dynamics/companies',
    dateRangeMode: 'none',
  },
  {
    id: 'diag-income-statement',
    label: 'Income Statement (P&L)',
    description: 'GL entries + chart hierarchy → revenue, COGS, expenses, net income',
    path: '/api/providers/dynamics/income-statement',
    dateRangeMode: 'range',
  },
  {
    id: 'diag-pnl-test',
    label: 'P&L Diagnostic (income-statement-test)',
    description: 'Tests native BC hierarchy with multiple filter syntaxes',
    path: '/api/providers/dynamics/income-statement-test',
    dateRangeMode: 'range',
  },
  {
    id: 'diag-balance-sheet',
    label: 'Balance Sheet',
    description: 'Cumulative GL entries + chart hierarchy → assets, liabilities, equity',
    path: '/api/providers/dynamics/balance-sheet',
    dateRangeMode: 'asOf',
  },
  {
    id: 'diag-bs-test',
    label: 'Balance Sheet Diagnostic',
    description: '7 tests comparing different BS computation methods',
    path: '/api/providers/dynamics/balance-sheet-test',
    dateRangeMode: 'asOf',
  },
  {
    id: 'diag-cash-flow',
    label: 'Cash Flow Statement',
    description: 'cashFlowStatement → trialBalance → GL entries fallback chain',
    path: '/api/providers/dynamics/cash-flow-statement',
    dateRangeMode: 'range',
  },
  {
    id: 'diag-cash-flow-test',
    label: 'Cash Flow Diagnostic',
    description: 'Entity probes, 6 method comparison, monthly movements, cash runway',
    path: '/api/providers/dynamics/cash-flow-test',
    dateRangeMode: 'range',
  },
  {
    id: 'diag-cash-flow-indirect',
    label: 'Cash Flow — Indirect Method',
    description:
      'GL-based indirect method: net income + depreciation + working capital adjustments',
    path: '/api/providers/dynamics/cash-flow-indirect',
    dateRangeMode: 'range',
  },
  {
    id: 'diag-financial-summary',
    label: 'Financial Summary (Dashboard)',
    description: 'GL-based P&L + cash + AR/AP + health score — powers the dashboard card',
    path: '/api/providers/dynamics/financial-summary',
    dateRangeMode: 'range',
  },
  {
    id: 'diag-enhanced',
    label: 'Enhanced Financial Data',
    description:
      'Top customers/vendors, aged AR/AP, ratios, bank accounts, efficiency, cash runway',
    path: '/api/providers/dynamics/enhanced-financial-data',
    dateRangeMode: 'range',
  },
  {
    id: 'diag-monthly-trend',
    label: 'Monthly P&L Trend',
    description: 'Monthly revenue, COGS, expenses, net income from GL entries',
    path: '/api/providers/dynamics/monthly-pnl-trend',
    dateRangeMode: 'range',
  },
  {
    id: 'diag-trial-balance',
    label: 'Trial Balance',
    description: 'trialBalance entity with balanceAtDate and period totals',
    path: '/api/providers/dynamics/trial-balance',
    dateRangeMode: 'asOf',
  },
  {
    id: 'diag-customers',
    label: 'Customers',
    description: 'Customer list with balance and contact info',
    path: '/api/providers/dynamics/customers',
    dateRangeMode: 'none',
  },
  {
    id: 'diag-vendors',
    label: 'Vendors',
    description: 'Vendor list with balance and contact info',
    path: '/api/providers/dynamics/vendors',
    dateRangeMode: 'none',
  },
  {
    id: 'diag-inventory',
    label: 'Inventory',
    description: 'Items with stock levels, unit costs, categories',
    path: '/api/providers/dynamics/inventory',
    dateRangeMode: 'none',
  },
  {
    id: 'diag-inventory-test',
    label: 'Inventory Diagnostic',
    description: 'Entity probes, item metrics, movements, turnover analysis',
    path: '/api/providers/dynamics/inventory-test',
    dateRangeMode: 'range',
  },
  {
    id: 'diag-diagnostic',
    label: 'Core Diagnostic (all entities)',
    description: 'Runs all standard diagnostic tests: entity probe, BS, P&L, AR/AP, health, etc.',
    path: '/api/providers/dynamics/diagnostic',
    dateRangeMode: 'range',
  },
  {
    id: 'diag-aged-ar',
    label: 'Aged Receivables Diagnostic',
    description:
      'Raw agedAccountsReceivable records, field discovery, currency analysis, per-record breakdown',
    path: '/api/providers/dynamics/aged-receivables-test',
    dateRangeMode: 'none',
  },
  {
    id: 'diag-aged-ap',
    label: 'Aged Payables Diagnostic',
    description:
      'Raw agedAccountsPayable records, field discovery, currency analysis, per-record breakdown',
    path: '/api/providers/dynamics/aged-payables-test',
    dateRangeMode: 'none',
  },
  {
    id: 'diag-aging-bucket',
    label: 'Aging Bucket Research',
    description:
      'Tests multiple strategies to derive 61-90 and 90+ buckets from BC API (periodLengthFilter, open invoices, ledger entries, cross-reference)',
    path: '/api/providers/dynamics/aging-bucket-test',
    dateRangeMode: 'none',
  },
  {
    id: 'diag-ile-webservice',
    label: 'ILE Web Service (ODataV4)',
    description:
      'Item Ledger Entries via ODataV4 Web Services (Page 38) — exposes ALL columns unlike the v2.0 API (15 fields). Returns top 50 by default.',
    path: '/api/providers/dynamics/ile-webservice',
    dateRangeMode: 'range',
  },
  {
    id: 'diag-warehouse-entries-ws',
    label: 'Warehouse Entries (ODataV4)',
    description:
      'Warehouse Entries via ODataV4 Web Services (Warehouse_Entries_Excel) — all warehouse movement columns. Returns top 50 by default.',
    path: '/api/providers/dynamics/warehouse-entries-webservice',
    dateRangeMode: 'range',
  },
]

// ── Tab Type ──────────────────────────────────────────────────────────────────

type ApiTab = 'api-tests' | 'all-calls'

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BCOAuthApiPage() {
  const { connectionId, startDate, endDate } = useBCOAuthDev()
  const [activeTab, setActiveTab] = useState<ApiTab>('all-calls')

  return (
    <div className="space-y-6">
      <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10 w-fit">
        {[
          { id: 'all-calls' as const, label: 'All Calls' },
          { id: 'api-tests' as const, label: 'API Tests' },
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

      {activeTab === 'all-calls' && (
        <AllCallsSection connectionId={connectionId} startDate={startDate} endDate={endDate} />
      )}
      {activeTab === 'api-tests' && (
        <ApiTestsSection connectionId={connectionId} startDate={startDate} endDate={endDate} />
      )}
    </div>
  )
}

// ── All Calls Section ─────────────────────────────────────────────────────────

function AllCallsSection({
  connectionId,
  startDate,
  endDate,
}: {
  connectionId: string
  startDate: string
  endDate: string
}) {
  const [results, setResults] = useState<
    Record<
      string,
      {
        status: 'idle' | 'loading' | 'success' | 'error'
        data?: any
        error?: string
        durationMs?: number
        httpStatus?: number
      }
    >
  >({})
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})

  const runSingle = useCallback(
    async (ep: (typeof ALL_API_ENDPOINTS)[number]) => {
      if (!connectionId) return
      setResults((prev) => ({ ...prev, [ep.id]: { status: 'loading' } }))

      const params = new URLSearchParams({ connectionId })
      if (ep.dateRangeMode === 'range') {
        if (startDate) params.set('startDate', startDate)
        if (endDate) params.set('endDate', endDate)
      } else if (ep.dateRangeMode === 'asOf') {
        if (endDate) params.set('endDate', endDate)
      }

      const t0 = Date.now()
      try {
        const res = await fetch(`${ep.path}?${params}`)
        const json = await res.json()
        const durationMs = Date.now() - t0
        if (!res.ok) {
          setResults((prev) => ({
            ...prev,
            [ep.id]: {
              status: 'error',
              error: json.error || json.details || `HTTP ${res.status}`,
              data: json,
              durationMs,
              httpStatus: res.status,
            },
          }))
        } else {
          setResults((prev) => ({
            ...prev,
            [ep.id]: { status: 'success', data: json, durationMs, httpStatus: res.status },
          }))
        }
      } catch (err) {
        setResults((prev) => ({
          ...prev,
          [ep.id]: {
            status: 'error',
            error: err instanceof Error ? err.message : 'Network error',
            durationMs: Date.now() - t0,
          },
        }))
      }
    },
    [connectionId, startDate, endDate]
  )

  const runAll = useCallback(async () => {
    await Promise.all(ALL_API_ENDPOINTS.map((ep) => runSingle(ep)))
  }, [runSingle])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const successCount = Object.values(results).filter((r) => r.status === 'success').length
  const errorCount = Object.values(results).filter((r) => r.status === 'error').length
  const loadingCount = Object.values(results).filter((r) => r.status === 'loading').length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={runAll}
          disabled={!connectionId || loadingCount > 0}
          className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingCount > 0 ? `Running... (${loadingCount} remaining)` : 'Run All API Calls'}
        </button>
        <span className="text-xs theme-text-secondary">
          {ALL_API_ENDPOINTS.length} endpoints
          {successCount > 0 && <span className="text-emerald-400 ml-2">{successCount} passed</span>}
          {errorCount > 0 && <span className="text-red-400 ml-2">{errorCount} failed</span>}
        </span>
      </div>

      <div className="grid gap-3">
        {ALL_API_ENDPOINTS.map((ep) => {
          const result = results[ep.id] || { status: 'idle' }
          const isExpanded = expandedIds[ep.id]

          return (
            <div
              key={ep.id}
              className={`glass-luxury-card border rounded-xl overflow-hidden transition-colors ${
                result.status === 'success'
                  ? 'border-emerald-500/20'
                  : result.status === 'error'
                    ? 'border-red-500/20'
                    : 'border-white/10'
              }`}
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      result.status === 'loading'
                        ? 'bg-blue-500 animate-pulse'
                        : result.status === 'success'
                          ? 'bg-emerald-500'
                          : result.status === 'error'
                            ? 'bg-red-500'
                            : 'bg-white/20'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium theme-text-primary text-sm">{ep.label}</span>
                      {result.durationMs != null && (
                        <span className="text-xs theme-text-secondary">{result.durationMs}ms</span>
                      )}
                      {result.httpStatus && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${result.httpStatus < 300 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}
                        >
                          {result.httpStatus}
                        </span>
                      )}
                    </div>
                    <p className="text-xs theme-text-secondary truncate">{ep.description}</p>
                    <p className="text-[10px] font-mono theme-text-secondary opacity-50 mt-0.5">
                      {ep.path}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => runSingle(ep)}
                    disabled={!connectionId || result.status === 'loading'}
                    className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                  >
                    {result.status === 'loading' ? '...' : 'Run'}
                  </button>
                  {(result.status === 'success' || result.status === 'error') && result.data && (
                    <button
                      onClick={() => toggleExpand(ep.id)}
                      className="px-2 py-1.5 text-xs rounded-lg border border-white/10 theme-text-secondary hover:bg-white/5 transition-colors"
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>
                  )}
                </div>
              </div>
              {result.status === 'error' && result.error && (
                <div className="mx-4 mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-400">{result.error}</p>
                </div>
              )}
              {isExpanded && result.data && (
                <div className="border-t border-white/10 p-4">
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(JSON.stringify(result.data, null, 2))
                      }
                      className="px-2 py-1 text-[10px] rounded border border-white/10 theme-text-secondary hover:bg-white/5"
                    >
                      Copy JSON
                    </button>
                  </div>
                  <pre className="text-xs font-mono theme-text-secondary overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── API Tests Section ─────────────────────────────────────────────────────────

function ApiTestsSection({
  connectionId,
  startDate,
  endDate,
}: {
  connectionId: string
  startDate: string
  endDate: string
}) {
  const [results, setResults] = useState<Record<string, any>>({})
  const [viewModes, setViewModes] = useState<Record<string, 'json' | 'formatted'>>({})

  const runTest = useCallback(
    async (endpoint: EndpointDef) => {
      if (!connectionId) return
      setResults((prev) => ({ ...prev, [endpoint.id]: { status: 'loading' } }))

      const params = new URLSearchParams({ connectionId })
      if (endpoint.usesDateRange) {
        if (endpoint.dateRangeMode === 'asOf') {
          if (endDate) params.set('endDate', endDate)
        } else {
          if (startDate) params.set('startDate', startDate)
          if (endDate) params.set('endDate', endDate)
        }
      }

      const url = `${endpoint.path}?${params.toString()}`
      const t0 = Date.now()

      try {
        const response = await fetch(url)
        const duration = Date.now() - t0
        const json = await response.json()
        if (!response.ok) {
          setResults((prev) => ({
            ...prev,
            [endpoint.id]: {
              status: 'error',
              error: json.error || json.details || `HTTP ${response.status}`,
              data: json,
              duration,
              url,
            },
          }))
        } else {
          setResults((prev) => ({
            ...prev,
            [endpoint.id]: { status: 'success', data: json, duration, url },
          }))
        }
      } catch (err) {
        setResults((prev) => ({
          ...prev,
          [endpoint.id]: {
            status: 'error',
            error: err instanceof Error ? err.message : 'Network error',
            duration: Date.now() - t0,
            url,
          },
        }))
      }
    },
    [connectionId, startDate, endDate]
  )

  const toggleView = useCallback((endpointId: string) => {
    setViewModes((prev) => ({
      ...prev,
      [endpointId]: prev[endpointId] === 'json' ? 'formatted' : 'json',
    }))
  }, [])

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={async () => {
            for (const ep of ENDPOINTS) {
              if (ep.id !== 'income-statement-test') await runTest(ep)
            }
          }}
          disabled={!connectionId}
          className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Run All API Tests
        </button>
      </div>

      {ENDPOINTS.filter((ep) => ep.id !== 'income-statement-test').map((endpoint) => {
        const result = results[endpoint.id] || { status: 'idle' }
        const viewMode = viewModes[endpoint.id] || 'formatted'
        const responseData = result.data?.data || result.data

        return (
          <div key={endpoint.id} className="glass-luxury-card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-medium theme-text-primary">{endpoint.label}</h2>
                  {result.status === 'success' && (
                    <span className="px-2 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-400">
                      {result.duration}ms
                    </span>
                  )}
                  {result.status === 'error' && (
                    <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-400">
                      Error
                    </span>
                  )}
                  {result.status === 'loading' && (
                    <span className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400 animate-pulse">
                      Loading...
                    </span>
                  )}
                  {responseData?.source && (
                    <span className="px-2 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-400">
                      Source: {responseData.source}
                    </span>
                  )}
                </div>
                <p className="text-sm theme-text-secondary mt-1">{endpoint.description}</p>
                {result.url && (
                  <p className="text-xs font-mono theme-text-secondary mt-1 break-all">
                    GET {result.url}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => runTest(endpoint)}
                  disabled={!connectionId || result.status === 'loading'}
                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {result.status === 'loading' ? 'Testing...' : 'Test'}
                </button>
                {result.status === 'success' && result.data && (
                  <>
                    <button
                      onClick={() => toggleView(endpoint.id)}
                      className="px-3 py-2 text-sm rounded-lg border border-white/10 theme-text-secondary hover:bg-white/5 transition-colors"
                    >
                      {viewMode === 'json' ? 'Formatted' : 'JSON'}
                    </button>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(JSON.stringify(result.data, null, 2))
                      }
                      className="px-3 py-2 text-sm rounded-lg border border-white/10 theme-text-secondary hover:bg-white/5 transition-colors"
                    >
                      Copy
                    </button>
                  </>
                )}
              </div>
            </div>

            {result.status === 'error' && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
                <p className="text-red-400 font-medium">{result.error}</p>
              </div>
            )}

            {result.status === 'success' && responseData && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  {responseData.companyName && (
                    <span className="theme-text-secondary">
                      Company:{' '}
                      <span className="theme-text-primary">{responseData.companyName}</span>
                    </span>
                  )}
                  {responseData.lines && (
                    <span className="theme-text-secondary">
                      Lines: <span className="theme-text-primary">{responseData.lines.length}</span>
                    </span>
                  )}
                </div>

                {viewMode === 'formatted' ? (
                  <>
                    {responseData.totals && (
                      <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {Object.entries(responseData.totals).map(([key, value]) => (
                            <div key={key} className="p-2 rounded bg-white/5">
                              <p className="text-xs theme-text-secondary mb-1">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </p>
                              <p className="font-mono theme-text-primary">
                                {typeof value === 'number' ? fmt(value) : String(value ?? '-')}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {responseData.lines && (
                      <LineItemsTable
                        lines={responseData.lines}
                        amountField={endpoint.id === 'balance-sheet' ? 'balance' : 'netChange'}
                        amountLabel={endpoint.id === 'balance-sheet' ? 'Balance' : 'Net Change'}
                      />
                    )}
                  </>
                ) : (
                  <pre className="p-4 rounded-lg bg-black/20 overflow-x-auto text-sm font-mono theme-text-primary max-h-[600px] overflow-y-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
